import { NextResponse } from "next/server";
import { VibePlanSchema, type VibePlanRequest } from "@/lib/ai/smart-plan";
import { askBrain, brainProvider, BrainError, type BrainPart } from "@/lib/ai/brain";
import { supabaseEnabled } from "@/lib/supabase/env";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** ההוראות שהיוצרת כתבה לעורך גוברות על ברירות המחדל */
const notesBlock = (notes?: string) =>
  notes?.trim() ? `\n\nThe creator's instructions for this edit (follow them; they override the defaults above):\n${notes.trim().slice(0, 2000)}` : "";

const SYSTEM = `You are an expert editor of aesthetic "vibe" Reels (travel, food, places, lifestyle) with no talking.
You receive candidate shots, each a frame from the middle of a short clip, numbered and tagged with the source clip and time.

Pick and order the shots for the final reel:
- Choose the most beautiful and interesting moments: good light, sharp, strong composition, a clear subject, emotion or movement. Skip blurry, dark, shaky, accidental or near-duplicate shots (when two look alike, keep the better one).
- Aim for roughly the requested total length. Variety matters: mix wide and close shots, different places and subjects.
- Order for a story: start with the strongest, most eye-catching shot (it is the hook), build through the middle, and end on a satisfying shot. Keeping shooting order is fine when it tells the story best.
- music: the mood that fits the footage. color_style: a grade that suits it (cinematic, warm or vivid usually; none if it already looks great).
- text: a short, soft line for the opening (place name, feeling), up to 5 words, in Hebrew, or an empty string if the shots speak for themselves.
- target_seconds: the total length the creator asked for in her instructions, or 0 if she did not ask.
- summary: one or two plain Hebrew sentences for the creator about what you picked and why. Neutral gender forms.
The creator's instructions, when given, come first: follow them over these defaults (which shots to include or open with, length, mood, pace, text).`;

/** בוחר ומסדר את הקטעים לסרטון אווירה לפי תמונות מהם, בעזרת המוח (Gemini או Claude) */
export async function POST(request: Request) {
  if (!brainProvider()) return NextResponse.json({ error: "העריכה החכמה לא מחוברת" }, { status: 404 });
  if (supabaseEnabled && !(await getUser()).user) return NextResponse.json({ error: "צריך להתחבר" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as VibePlanRequest | null;
  const shots = (body?.shots ?? []).slice(0, 30).filter((s) => /^data:image\/jpeg;base64,/.test(s.image));
  if (shots.length < 2) return NextResponse.json({ error: "אין מספיק קטעים" }, { status: 400 });

  const parts: BrainPart[] = [{
    text: `Target length: about ${Math.round(body!.target)}s. Background music already chosen: ${body!.hasMusic ? "yes" : "no"}.\nCandidate shots follow.${notesBlock(body!.notes)}`,
  }];
  for (const s of shots) {
    parts.push({ text: `Shot ${s.id} (clip ${s.clip + 1}, ${s.start.toFixed(1)}-${s.end.toFixed(1)}s, ${(s.end - s.start).toFixed(1)}s long):` });
    parts.push({ image: s.image });
  }
  try {
    const plan = await askBrain({ system: SYSTEM, schema: VibePlanSchema, parts });
    const valid = new Set(shots.map((s) => s.id));
    plan.order = [...new Set(plan.order.filter((id) => valid.has(id)))];
    return NextResponse.json(plan);
  } catch (e) {
    if (e instanceof BrainError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
