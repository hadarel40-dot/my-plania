import { NextResponse } from "next/server";
import { TranscriptSchema } from "@/lib/ai/smart-plan";
import { askBrain, brainProvider, BrainError } from "@/lib/ai/brain";
import { supabaseEnabled } from "@/lib/supabase/env";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SYSTEM = `You are a professional Hebrew transcriber making captions for a creator's video. The speaker is usually Israeli, speaking casual spoken Hebrew, sometimes with English words, brand names or slang.
Listen to the WHOLE audio and write down every single word that is spoken, from the very first word to the very last one, exactly as said (verbatim). Never summarize, never skip a sentence, never stop before the end of the audio, never translate, never invent words that were not said. Hebrew is written in Hebrew letters with normal spelling; English words stay in English letters. Skip music, noise and breathing.
Return the speech as segments: one segment per sentence or phrase (up to about 12 words), split where the speaker pauses. Each segment has start and end in seconds from the start of this audio (two decimals), as precise as you can. Segments are in order and do not overlap. If there is no speech at all, return an empty list.`;

/** רוב האותיות בתמלול צריכות להיות בעברית או באנגלית */
function looksRight(segments: { text: string }[]) {
  const letters = segments.map((s) => s.text).join("").replace(/[^\p{L}]/gu, "");
  if (!letters.length) return true;
  const ok = letters.replace(/[^\u05d0-\u05eaA-Za-z]/g, "").length;
  return ok / letters.length > 0.8;
}

/** תמלול קטע סאונד (WAV) לכתוביות עם Gemini */
export async function POST(request: Request) {
  if (brainProvider() !== "gemini") return NextResponse.json({ error: "תמלול בענן זמין רק עם Gemini" }, { status: 404 });
  if (supabaseEnabled && !(await getUser()).user) return NextResponse.json({ error: "צריך להתחבר" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { audio?: string; duration?: number; hints?: string[] } | null;
  // מילים ושמות שהיוצרת כבר תיקנה בעבר: כדי ש-Gemini יכתוב אותם נכון מההתחלה
  const hints = (body?.hints ?? []).filter((h) => typeof h === "string" && h.length < 40).slice(0, 60);
  const hintText = hints.length ? `\nWords and names that appear in this creator's videos (spell them exactly like this): ${hints.join(", ")}` : "";
  if (!body?.audio || body.audio.length > 4_200_000) return NextResponse.json({ error: "קטע הסאונד חסר או גדול מדי" }, { status: 400 });
  try {
    const ask = (extra = "") => askBrain({
      system: SYSTEM + hintText + extra,
      schema: TranscriptSchema,
      parts: [{ text: `Audio length: ${(body.duration ?? 0).toFixed(1)}s.` }, { audioWav: body.audio! }],
    });
    let { segments } = await ask();
    // שומר: תמלול שיצא באותיות של שפה אחרת (קרה עם גרסה חדשה של Gemini) לא נכנס לכתוביות
    if (!looksRight(segments)) {
      console.warn("transcribe: wrong script", segments.slice(0, 3).map((s) => s.text));
      ({ segments } = await ask("\nIMPORTANT: Hebrew must be written in Hebrew letters (א-ת). Never output Armenian, Cyrillic or other scripts."));
      if (!looksRight(segments)) return NextResponse.json({ error: "התמלול יצא לא תקין", detail: segments.slice(0, 3).map((s) => s.text).join(" | ") }, { status: 422 });
    }
    const max = (body.duration ?? Infinity) + 0.5;
    return NextResponse.json({
      segments: segments
        .filter((s) => s.text.trim() && s.end > s.start && s.start < max)
        .sort((a, b) => a.start - b.start),
    });
  } catch (e) {
    if (e instanceof BrainError) return NextResponse.json({ error: e.message, detail: e.detail }, { status: e.status });
    throw e;
  }
}
