"use client";
import { dictionaryHints } from "@/lib/editor/dictionary";
import type { Transcriber } from "./transcriber";
import { createBrowserTranscriber } from "./browser-transcriber";
import { perAssetCache, segmentsToCaptions, type Segment } from "./segments";
import { decodeAssetAudio } from "@/lib/audio/decode";
import { findSpeech } from "@/lib/audio/silence";
import { wavBase64 } from "@/lib/audio/wav";
import { logEvent } from "@/lib/telemetry";

/**
 * כמה שניות סאונד בבקשה אחת. קטעים קצרים: Gemini מתמלל אותם עד הסוף (בקטע ארוך הוא
 * לפעמים עוצר באמצע), והם עולים מהר. כמה קטעים נשלחים במקביל.
 */
const CHUNK_SEC = 35;
const PARALLEL = 3;

type Speech = { start: number; end: number };

/**
 * כתוביות עם Gemini לכל הסרטון: הסאונד נשלח בקטעים קצרים, נחתך בשקט כדי לא לקטוע מילה.
 * קטע שנכשל מנוסה שוב; אם Gemini עצר לפני סוף הדיבור בקטע, מבקשים את ההמשך. רק אם הכל
 * נכשל עוברים לתמלול בדפדפן.
 */
export function createGeminiTranscriber(): Transcriber {
  const browser = createBrowserTranscriber();
  return {
    id: "gemini",
    async transcribe(timeline, assets, onStatus = () => {}) {
      try {
        const segmentsFor = perAssetCache(async (asset) => {
          onStatus("קורא את הסאונד…");
          const samples = await decodeAssetAudio(asset);
          const speech = findSpeech(samples);
          if (!speech.length) return [];
          const chunks = chunkBySilence(speech, CHUNK_SEC);
          let done = 0, failed = 0;
          onStatus(`Gemini מתמלל… 0/${chunks.length}`);
          const results = await mapLimit(chunks, PARALLEL, async (c) => {
            const segs = await transcribeChunk(samples, c, speech).catch(() => null);
            if (!segs) failed++;
            onStatus(`Gemini מתמלל… ${++done}/${chunks.length}`);
            return segs ?? [];
          });
          if (failed === chunks.length) throw new Error("התמלול נכשל");
          if (failed) logEvent("transcribe_partial", { failed, chunks: chunks.length });
          return results.flat().sort((a, b) => a.start - b.start);
        });
        return await segmentsToCaptions(timeline, assets, segmentsFor);
      } catch (e) {
        // Gemini לא זמין (מכסה, עומס): תמלול בתוך הדפדפן
        logEvent("transcribe_fallback", { error: e instanceof Error ? e.message : String(e) });
        onStatus("Gemini לא זמין, מתמלל בדפדפן…");
        return browser.transcribe(timeline, assets, onStatus);
      }
    },
  };
}

/** קטע אחד: עד שני ניסיונות, ואם התמלול נגמר הרבה לפני סוף הדיבור, בקשה נוספת להמשך */
async function transcribeChunk(samples: Float32Array, c: Speech, speech: Speech[]): Promise<Segment[]> {
  const ask = async (from: number, to: number) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ audio: wavBase64(samples, from, to), duration: to - from, hints: dictionaryHints() }),
      }).catch(() => null);
      const data = await res?.json().catch(() => null);
      if (res?.ok && data?.segments) {
        return (data.segments as Segment[]).flatMap((s) => {
          const start = from + Math.max(0, s.start);
          const end = from + Math.min(to - from, Math.max(s.end, s.start + 0.3));
          return s.text.trim() && end > start ? [{ start, end, text: s.text.trim() }] : [];
        });
      }
      logEvent("brain_failed", { route: "transcribe", status: res?.status ?? 0, error: data?.error, detail: data?.detail, attempt });
    }
    throw new Error("התמלול נכשל");
  };
  const out = await ask(c.start, c.end);
  // עד איפה מדברים בקטע הזה, ועד איפה הגיע התמלול
  const lastSpeech = Math.max(...speech.filter((r) => r.start < c.end && r.end > c.start).map((r) => Math.min(r.end, c.end)));
  const lastText = out.at(-1)?.end ?? c.start;
  if (lastSpeech - lastText > 3) {
    const more = await ask(Math.max(c.start, lastText - 0.3), c.end).catch(() => []);
    out.push(...more.filter((s) => s.start >= lastText - 0.1));
    logEvent("transcribe_continued", { gap: +(lastSpeech - lastText).toFixed(1), added: more.length });
  }
  return out;
}

/** מריץ עד limit משימות במקביל, ושומר על הסדר של התוצאות */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i]); } };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/** מחלק את קטעי הדיבור לחלקים של עד maxSec, ונחתך רק בשקט שבין קטעים */
function chunkBySilence(speech: { start: number; end: number }[], maxSec: number) {
  const chunks: { start: number; end: number }[] = [];
  let cur: { start: number; end: number } | null = null;
  for (const r of speech) {
    if (!cur) cur = { ...r };
    else if (r.end - cur.start <= maxSec) cur.end = r.end;
    else { chunks.push(cur); cur = { ...r }; }
    // קטע דיבור ארוך בלי שום הפסקה: חותכים בכוח
    while (cur.end - cur.start > maxSec) {
      chunks.push({ start: cur.start, end: cur.start + maxSec });
      cur = { start: cur.start + maxSec, end: cur.end };
    }
  }
  if (cur) chunks.push(cur);
  // שוליים קטנים, כדי לא לקטוע את תחילת המילה הראשונה
  return chunks.map((c) => ({ start: Math.max(0, c.start - 0.15), end: c.end + 0.15 }));
}

