import { NextResponse } from "next/server";
import { TranscriptSchema } from "@/lib/ai/smart-plan";
import { askBrain, brainProvider, BrainError } from "@/lib/ai/brain";
import { supabaseEnabled } from "@/lib/supabase/env";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SYSTEM = `You transcribe speech for video captions. The speaker is usually Hebrew-speaking, sometimes mixing in English words.
Transcribe exactly what is said, in the language it is said in (Hebrew stays Hebrew, never translate). Fix nothing, invent nothing, skip music and noise.
Return short caption segments of 1-5 words that follow natural phrasing, each with start and end in seconds from the start of the audio, as precise as you can (two decimals).
Segments must be in order and must not overlap. If there is no speech, return an empty list.`;

/** תמלול קטע סאונד (WAV) לכתוביות עם Gemini */
export async function POST(request: Request) {
  if (brainProvider() !== "gemini") return NextResponse.json({ error: "תמלול בענן זמין רק עם Gemini" }, { status: 404 });
  if (supabaseEnabled && !(await getUser()).user) return NextResponse.json({ error: "צריך להתחבר" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { audio?: string; duration?: number } | null;
  if (!body?.audio || body.audio.length > 4_000_000) return NextResponse.json({ error: "קטע הסאונד חסר או גדול מדי" }, { status: 400 });
  try {
    const { segments } = await askBrain({
      system: SYSTEM,
      schema: TranscriptSchema,
      parts: [{ text: `Audio length: ${(body.duration ?? 0).toFixed(1)}s.` }, { audioWav: body.audio }],
    });
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
