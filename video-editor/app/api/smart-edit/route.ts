import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { SmartPlanSchema, type SmartPlanRequest } from "@/lib/ai/smart-plan";
import { supabaseEnabled } from "@/lib/supabase/env";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** ההוראות שהיוצרת כתבה לעורך גוברות על ברירות המחדל */
const notesBlock = (notes?: string) =>
  notes?.trim() ? `\n\nThe creator's instructions for this edit (follow them; they override the defaults above):\n${notes.trim().slice(0, 2000)}` : "";

const SYSTEM = `You are an expert editor of short-form vertical videos (Instagram Reels, TikTok) for a Hebrew-speaking creator.
You receive the transcript of a raw video as numbered segments with timestamps, and return an edit plan.

How to decide:
- remove_segments: cut false starts, a sentence that is said again right after (keep the last, cleanest take), filler and off-topic asides. Keep everything that carries the message. Cutting is the most valuable thing you do, but never cut so much that the story stops making sense; if the recording is already clean, return an empty list.
- hook: the line on screen during the first seconds. It must make a viewer stop scrolling and must be true to what the video actually says. Up to 7 words, in the language spoken in the video, natural spoken style, no hashtags.
- emojis: 2-5 moments where an emoji adds energy or meaning (a number, money, a surprise, a tip, a feeling). Use segment numbers from the input that you are keeping.
- template, caption_style, accent, color_style: pick what fits the content and mood (a calm explanation, a list of tips, a before/after, a high-energy rant).
- cta: a short call to action for the end that fits the content (for example to follow or comment), or an empty string when it would feel forced.
- title: a short project name.
- summary: one or two plain Hebrew sentences for the creator saying what you changed and why. Neutral gender forms.`;

/** בונה תוכנית עריכה מהתמלול בעזרת Claude. המפתח נשאר בשרת */
export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "העריכה החכמה לא מחוברת (חסר ANTHROPIC_API_KEY)" }, { status: 404 });
  }
  if (supabaseEnabled && !(await getUser()).user) {
    return NextResponse.json({ error: "צריך להתחבר" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as SmartPlanRequest | null;
  const segments = body?.segments?.slice(0, 600) ?? [];
  if (!segments.length) return NextResponse.json({ error: "אין תמלול" }, { status: 400 });

  const transcript = segments
    .map((s, i) => `[${i}] ${s.start.toFixed(1)}-${s.end.toFixed(1)}s: ${String(s.text).slice(0, 300)}`)
    .join("\n");

  const client = new Anthropic({ timeout: 55_000, maxRetries: 1 });
  try {
    const response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(SmartPlanSchema) },
      system: SYSTEM,
      messages: [{
        role: "user",
        content: `Video length: ${body!.duration.toFixed(1)}s. Background music: ${body!.hasMusic ? "yes" : "no"}.\n\nTranscript segments:\n${transcript}${notesBlock(body!.notes)}`,
      }],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return NextResponse.json({ error: "לא התקבלה תוכנית עריכה" }, { status: 502 });
    }
    const plan = response.parsed_output;
    // מקטעים שלא קיימים מסוננים, כדי שתשובה שגויה לא תמחק משהו אחר
    plan.remove_segments = plan.remove_segments.filter((i) => i >= 0 && i < segments.length);
    plan.emojis = plan.emojis.filter((e) => e.segment >= 0 && e.segment < segments.length).slice(0, 6);
    return NextResponse.json(plan);
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "המפתח של Claude לא תקין" }, { status: 500 });
    }
    if (e instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "יותר מדי בקשות, נסו שוב בעוד דקה" }, { status: 429 });
    }
    if (e instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `שגיאה מ-Claude (${e.status ?? "רשת"})` }, { status: 502 });
    }
    throw e;
  }
}
