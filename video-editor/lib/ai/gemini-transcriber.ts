"use client";
import { dictionaryHints } from "@/lib/editor/dictionary";
import type { Transcriber } from "./transcriber";
import { createBrowserTranscriber } from "./browser-transcriber";
import { perAssetCache, segmentsToCaptions, type Segment } from "./segments";
import { decodeAssetAudio } from "@/lib/audio/decode";
import { findSpeech } from "@/lib/audio/silence";
import { wavBase64 } from "@/lib/audio/wav";
import { logEvent } from "@/lib/telemetry";

/** עד כמה שניות סאונד בבקשה אחת (כדי להישאר מתחת למגבלת הגודל של השרת) */
const CHUNK_SEC = 70;

/**
 * כתוביות עם Gemini: הסאונד נשלח בקטעים של עד כדקה, נחתך בשקט כדי לא לקטוע מילה.
 * מדויק בעברית ועובד גם בטלפון, בלי להוריד מודל. אם Gemini לא זמין, עוברים לתמלול בדפדפן.
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
          const out: Segment[] = [];
          for (const [i, c] of chunks.entries()) {
            onStatus(`Gemini מתמלל ${i + 1}/${chunks.length}…`);
            const res = await fetch("/api/transcribe", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ audio: wavBase64(samples, c.start, c.end), duration: c.end - c.start, hints: dictionaryHints() }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data) {
              logEvent("brain_failed", { route: "transcribe", status: res.status, error: data?.error, detail: data?.detail });
              throw new Error(data?.error ?? "התמלול נכשל");
            }
            for (const s of data.segments as Segment[]) {
              const start = c.start + Math.max(0, s.start);
              const end = c.start + Math.min(c.end - c.start, Math.max(s.end, s.start + 0.3));
              if (s.text.trim() && end > start) out.push({ start, end, text: s.text.trim() });
            }
          }
          return out;
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

