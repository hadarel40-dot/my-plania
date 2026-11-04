import { NextResponse } from "next/server";
import { DirectorPlanSchema, type DirectorRequest } from "@/lib/ai/smart-plan";
import { askBrain, brainProvider, BrainError, type BrainPart } from "@/lib/ai/brain";
import { supabaseEnabled } from "@/lib/supabase/env";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SYSTEM = `You are a top human video editor making an Instagram Reel from a creator's raw phone footage.
You WATCH and LISTEN to every clip (they are small previews of the real files; timestamps match the originals).

Edit it the way a great human editor would:
- First understand the footage: who and what is in it, the place, the story, the emotion, the funny or impressive moments, what is said.
- Pick only the moments worth watching: the action itself (not the seconds before it), reactions, reveals, beautiful light, clear subjects. Cut out fumbling, camera searching, blur, shaky pans, dead time and near-duplicates.
- Never cut in the middle of a word, a laugh, a gesture or a movement: start a moment just before it begins and end right after it finishes.
- Structure: open with the single most striking moment (the hook, ideally under 2 seconds), build through the middle with variety (wide and close, different subjects), and end on a satisfying payoff or a beautiful closing shot.
- Typical moment length: 0.8 to 3 seconds; longer only when something is happening the whole time or someone is saying something worth hearing.
- sound=true for moments where the original sound matters (a laugh, a sentence, a reaction, a splash); music plays quietly under them.
- If the footage is a recipe or a process, keep the real order of the steps. If it is a product or business, make the product the star and end with it.
- Aim for the requested length unless the creator asked otherwise (target_seconds = what she asked, or 0).
- music, color_style: what fits the footage. text: a short opening line in Hebrew that makes people stay (or empty).
- understanding and summary: plain, warm Hebrew for the creator, neutral gender forms. Say what you saw and what you chose, like an editor explaining their cut.
The creator's instructions, when given, override all defaults.`;

const notesBlock = (notes?: string) =>
  notes?.trim() ? `\n\nThe creator's instructions (follow them; they override the defaults):\n${notes.trim().slice(0, 2000)}` : "";

/** המוח צופה בכל הסרטונים ומחזיר רשימת עריכה (רק Gemini יודע לצפות בווידאו) */
export async function POST(request: Request) {
  if (brainProvider() !== "gemini") return NextResponse.json({ error: "צפייה בסרטונים זמינה רק עם Gemini" }, { status: 404 });
  if (supabaseEnabled && !(await getUser()).user) return NextResponse.json({ error: "צריך להתחבר" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as DirectorRequest | null;
  const clips = (body?.clips ?? []).slice(0, 30).filter((c) => typeof c.video === "string" && c.video.length > 100);
  if (!clips.length) return NextResponse.json({ error: "אין סרטונים" }, { status: 400 });

  const parts: BrainPart[] = [{
    text: `Target length: about ${Math.round(body!.target)}s. Background music will be added: ${body!.hasMusic ? "the creator's own song" : "yes"}.\n${clips.length} clips follow, in shooting order.${notesBlock(body!.notes)}`,
  }];
  clips.forEach((c, i) => {
    parts.push({ text: `Clip ${i + 1} (${c.duration.toFixed(1)}s long):` });
    parts.push({ videoMp4: c.video });
  });
  try {
    const plan = await askBrain({ system: SYSTEM, schema: DirectorPlanSchema, parts, budgetMs: 55_000, attemptMs: 42_000 });
    // רק רגעים שבאמת קיימים בסרטונים
    plan.shots = plan.shots
      .filter((s) => s.clip >= 1 && s.clip <= clips.length)
      .map((s) => {
        const dur = clips[s.clip - 1].duration;
        const start = Math.max(0, Math.min(s.start, dur - 0.3));
        return { ...s, start, end: Math.min(dur, Math.max(s.end, start + 0.3)) };
      });
    return NextResponse.json(plan);
  } catch (e) {
    if (e instanceof BrainError) return NextResponse.json({ error: e.message, detail: e.detail }, { status: e.status });
    throw e;
  }
}
