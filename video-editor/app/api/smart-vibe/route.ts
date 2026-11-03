import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { VibePlanSchema, type VibePlanRequest } from "@/lib/ai/smart-plan";
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
- summary: one or two plain Hebrew sentences for the creator about what you picked and why. Neutral gender forms.`;

/** בוחר ומסדר את הקטעים לסרטון אווירה לפי תמונות מהם, בעזרת Claude */
export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "העריכה החכמה לא מחוברת (חסר ANTHROPIC_API_KEY)" }, { status: 404 });
  }
  if (supabaseEnabled && !(await getUser()).user) {
    return NextResponse.json({ error: "צריך להתחבר" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as VibePlanRequest | null;
  const shots = (body?.shots ?? []).slice(0, 30).filter((s) => /^data:image\/jpeg;base64,/.test(s.image));
  if (shots.length < 2) return NextResponse.json({ error: "אין מספיק קטעים" }, { status: 400 });

  const content: Anthropic.Beta.BetaContentBlockParam[] = [{
    type: "text",
    text: `Target length: about ${Math.round(body!.target)}s. Background music already chosen: ${body!.hasMusic ? "yes" : "no"}.\nCandidate shots follow.${notesBlock(body!.notes)}`,
  }];
  for (const s of shots) {
    content.push({ type: "text", text: `Shot ${s.id} (clip ${s.clip + 1}, ${s.start.toFixed(1)}-${s.end.toFixed(1)}s, ${(s.end - s.start).toFixed(1)}s long):` });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: s.image.split(",")[1] } });
  }

  const client = new Anthropic({ timeout: 55_000, maxRetries: 1 });
  try {
    const response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(VibePlanSchema) },
      system: SYSTEM,
      messages: [{ role: "user", content }],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return NextResponse.json({ error: "לא התקבלה תוכנית עריכה" }, { status: 502 });
    }
    const plan = response.parsed_output;
    const valid = new Set(shots.map((s) => s.id));
    plan.order = [...new Set(plan.order.filter((id) => valid.has(id)))];
    return NextResponse.json(plan);
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return NextResponse.json({ error: "המפתח של Claude לא תקין" }, { status: 500 });
    if (e instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "יותר מדי בקשות, נסו שוב בעוד דקה" }, { status: 429 });
    if (e instanceof Anthropic.APIError) return NextResponse.json({ error: `שגיאה מ-Claude (${e.status ?? "רשת"})` }, { status: 502 });
    throw e;
  }
}
