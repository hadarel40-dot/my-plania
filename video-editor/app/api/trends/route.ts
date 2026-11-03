import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { TrendsSchema, type TrendsRequest } from "@/lib/ai/smart-plan";
import { supabaseEnabled } from "@/lib/supabase/env";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SYSTEM = `You help a Hebrew-speaking creator in Israel make Instagram Reels that ride current trends.
Use web search to find what is trending on Instagram Reels and TikTok right now (this week or this month): formats, editing styles, hook patterns, and popular Reels sounds. Prefer recent, specific sources; ignore generic evergreen advice.
Then fit the findings to the creator's video. Everything the creator reads is in Hebrew, natural spoken style, neutral gender forms.
For "how": write one concrete instruction an editor could apply to this specific video (pace, text on screen, order of shots, style).
For audio: only sounds you actually found trending; say in "note" what kind of moment it fits.`;

/** מה טרנדי עכשיו, מותאם לסרטון: Claude מחפש ברשת ומחזיר רעיונות */
export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "צריך לחבר את Claude (ANTHROPIC_API_KEY) כדי לחפש טרנדים" }, { status: 404 });
  }
  if (supabaseEnabled && !(await getUser()).user) return NextResponse.json({ error: "צריך להתחבר" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as TrendsRequest | null;
  const topic = (body?.topic ?? "").trim().slice(0, 3000);
  const kind = body?.kind === "talking" ? "a talking-to-camera video" : "an aesthetic vibe video (short shots, music, no talking)";

  const client = new Anthropic({ timeout: 55_000, maxRetries: 0 });
  const messages: Anthropic.Beta.BetaMessageParam[] = [{
    role: "user",
    content: `The video is ${kind}. What it is about (from the creator's notes and transcript):\n${topic || "(not specified - suggest broadly useful trends for Israeli Reels)"}\n\nToday's date: ${new Date().toISOString().slice(0, 10)}.`,
  }];
  try {
    // חיפוש ברשת יכול לעצור באמצע (pause_turn); ממשיכים מאותה נקודה, עד 3 פעמים
    for (let i = 0; i < 4; i++) {
      const response = await client.beta.messages.parse({
        model: "claude-opus-5-5",
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 4 }],
        output_config: { effort: "low", format: betaZodOutputFormat(TrendsSchema) },
        system: SYSTEM,
        messages,
      });
      if (response.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: response.content });
        continue;
      }
      if (response.stop_reason === "refusal" || !response.parsed_output) break;
      return NextResponse.json(response.parsed_output);
    }
    return NextResponse.json({ error: "לא הצלחתי למצוא טרנדים כרגע, נסו שוב" }, { status: 502 });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return NextResponse.json({ error: "המפתח של Claude לא תקין" }, { status: 500 });
    if (e instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "יותר מדי בקשות, נסו שוב בעוד דקה" }, { status: 429 });
    if (e instanceof Anthropic.APIConnectionTimeoutError) return NextResponse.json({ error: "החיפוש לקח יותר מדי זמן, נסו שוב" }, { status: 504 });
    if (e instanceof Anthropic.APIError) return NextResponse.json({ error: `שגיאה מ-Claude (${e.status ?? "רשת"})` }, { status: 502 });
    throw e;
  }
}
