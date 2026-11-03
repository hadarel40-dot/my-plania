import { NextResponse } from "next/server";
import { TrendsSchema, type TrendsRequest } from "@/lib/ai/smart-plan";
import { askBrain, brainProvider, BrainError } from "@/lib/ai/brain";
import { supabaseEnabled } from "@/lib/supabase/env";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SYSTEM = `You help a Hebrew-speaking creator in Israel make Instagram Reels that ride current trends.
Use web search to find what is trending on Instagram Reels and TikTok right now (this week or this month): formats, editing styles, hook patterns, and popular Reels sounds. Prefer recent, specific sources; ignore generic evergreen advice.
Then fit the findings to the creator's video. Everything the creator reads is in Hebrew, natural spoken style, neutral gender forms.
For "how": write one concrete instruction an editor could apply to this specific video (pace, text on screen, order of shots, style).
For audio: only sounds you actually found trending; say in "note" what kind of moment it fits.`;

/** מה טרנדי עכשיו, מותאם לסרטון: המוח מחפש ברשת (חיפוש גוגל / web search) ומחזיר רעיונות */
export async function POST(request: Request) {
  if (!brainProvider()) return NextResponse.json({ error: "צריך לחבר את העריכה החכמה כדי לחפש טרנדים" }, { status: 404 });
  if (supabaseEnabled && !(await getUser()).user) return NextResponse.json({ error: "צריך להתחבר" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as TrendsRequest | null;
  const topic = (body?.topic ?? "").trim().slice(0, 3000);
  const kind = body?.kind === "talking" ? "a talking-to-camera video" : "an aesthetic vibe video (short shots, music, no talking)";
  try {
    const trends = await askBrain({
      system: SYSTEM,
      schema: TrendsSchema,
      search: true,
      parts: [{ text: `The video is ${kind}. What it is about (from the creator's notes and transcript):\n${topic || "(not specified - suggest broadly useful trends for Israeli Reels)"}\n\nToday's date: ${new Date().toISOString().slice(0, 10)}.` }],
    });
    return NextResponse.json(trends);
  } catch (e) {
    if (e instanceof BrainError) return NextResponse.json({ error: e.message, detail: e.detail }, { status: e.status });
    throw e;
  }
}
