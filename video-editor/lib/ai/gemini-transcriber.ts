"use client";
import { brainHeaders } from "@/lib/ai/my-key";
import { dictionaryHints } from "@/lib/editor/dictionary";
import { useEditor } from "@/stores/editor-store";
import type { Transcriber } from "./transcriber";
import { perAssetCache, segmentsToCaptions, type Segment } from "./segments";
import { decodeAssetAudio } from "@/lib/audio/decode";
import { findSpeech } from "@/lib/audio/silence";
import { wavBase64 } from "@/lib/audio/wav";
import { logEvent } from "@/lib/telemetry";

/**
 * כמה שניות סאונד בבקשה אחת: דקה (בערך 2.5MB, מתחת למגבלת הגודל של השרת). פחות בקשות
 * = פחות מהמכסה היומית החינמית של Gemini. Gemini מחזיר משפטים שלמים (תשובה קצרה, ולכן
 * הוא לא נעצר באמצע), והחלוקה לכתוביות קצרות נעשית כאן לפי הדיבור עצמו.
 */
const CHUNK_SEC = 60;
const PARALLEL = 2;
/** גרסת שיטת התמלול: תמלול שנשמר בשיטה ישנה (עם החורים) מתומלל מחדש */
const TRANSCRIPT_V = 2;

type Speech = { start: number; end: number };

/**
 * כתוביות עם Gemini לכל הסרטון:
 *  1. התמלול נשמר עם הסרטון, ועריכה נוספת לא מתמללת שוב (חוסך מכסה, וזה גם מיידי).
 *  2. הסאונד נשלח בחלקים של עד דקה, שנחתכים בשקט (לא באמצע מילה).
 *  3. בדיקת כיסוי: כל מקום שמדברים בו ואין לו טקסט נשלח שוב, רק הוא, לתמלול.
 *  4. אם Gemini לא זמין (המכסה היומית נגמרה): הודעה ברורה, ולא כתוביות שגויות
 *     מתמלול חלש בדפדפן.
 */
export function createGeminiTranscriber(): Transcriber {
  return {
    id: "gemini",
    async transcribe(timeline, assets, onStatus = () => {}) {
      const segmentsFor = perAssetCache(async (asset) => {
        const saved = useEditor.getState().assets[asset.id]?.transcript;
        if (saved?.v === TRANSCRIPT_V) { logEvent("transcribe_cached", { segments: saved.segments.length }); return saved.segments; }
        onStatus("קורא את הסאונד…");
        const samples = await decodeAssetAudio(asset);
        const speech = findSpeech(samples);
        if (!speech.length) return [];
        const chunks = chunkBySilence(speech, CHUNK_SEC);
        let done = 0;
        onStatus(`Gemini מקשיב לדיבור… ${chunks.length > 1 ? `0/${chunks.length}` : ""}`);
        const results = await mapLimit(chunks, PARALLEL, async (c) => {
          const segs = await ask(samples, c.start, c.end);
          onStatus(`Gemini מקשיב לדיבור… ${chunks.length > 1 ? `${++done}/${chunks.length}` : ""}`);
          return segs;
        });
        let segs = results.flat().sort((a, b) => a.start - b.start);

        // בדיקת כיסוי: דיבור שאין לו טקסט נשלח שוב (רק הקטעים האלה)
        const gaps = uncovered(speech, segs);
        if (gaps.length) {
          onStatus("משלים קטעים שחסרים…");
          const before = segs.length;
          for (const w of groupWindows(gaps, CHUNK_SEC).slice(0, 3)) {
            const more = await ask(samples, w.start, w.end).catch(() => []);
            segs.push(...more.filter((s) => { const mid = (s.start + s.end) / 2; return gaps.some((g) => mid >= g.start - 0.3 && mid <= g.end + 0.3); }));
          }
          segs = dedupe(segs.sort((a, b) => a.start - b.start));
          const left = uncovered(speech, segs);
          logEvent("transcribe_repair", { gaps: gaps.length, gapSec: +sum(gaps).toFixed(1), added: segs.length - before, leftSec: +sum(left).toFixed(1) });
        }
        // נשמר עם הסרטון (גם בענן), לעריכות הבאות
        const cur = useEditor.getState().assets[asset.id];
        if (cur) useEditor.getState().addAsset({ ...cur, transcript: { v: TRANSCRIPT_V, segments: segs } });
        logEvent("transcribe_done", { chunks: chunks.length, segments: segs.length, speechSec: +sum(speech).toFixed(1) });
        return segs;
      });
      try {
        return await segmentsToCaptions(timeline, assets, segmentsFor);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logEvent("transcribe_failed", { error: msg });
        throw new Error(/מכסה/.test(msg)
          ? "המכסה היומית החינמית של Gemini נגמרה, ולכן לא נוצרו כתוביות (כדי לא לכתוב מילים לא נכונות). כדי שזה לא יקרה: לחברי מכסה אישית בחינם בלשונית ״חכם״ (דקה אחת), או לנסות שוב מאוחר יותר."
          : msg);
      }
    },
  };
}

/** בקשה אחת לשרת: עד שני ניסיונות. זמנים בתשובה מתחילת הקובץ */
async function ask(samples: Float32Array, from: number, to: number): Promise<Segment[]> {
  let error = "התמלול נכשל";
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch("/api/transcribe", {
      method: "POST",
      headers: brainHeaders(),
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
    error = data?.error ?? error;
    logEvent("brain_failed", { route: "transcribe", status: res?.status ?? 0, error: data?.error, detail: data?.detail, attempt });
    // מכסה שנגמרה: אין טעם לנסות שוב מיד
    if (res?.status === 429) break;
  }
  throw new Error(error);
}

/** קטעי דיבור (מעל חצי שנייה) שאין להם שום טקסט בתמלול */
function uncovered(speech: Speech[], segs: Segment[]): Speech[] {
  const out: Speech[] = [];
  for (const r of speech) {
    if (r.end - r.start < 0.5) continue;
    // החלקים של הקטע שלא נוגעים באף משפט (עם מרווח קטן, כי הזמנים של Gemini משוערים)
    let pieces: Speech[] = [{ ...r }];
    for (const s of segs) {
      const a = s.start - 0.6, b = s.end + 0.6;
      pieces = pieces.flatMap((p) => (b <= p.start || a >= p.end ? [p] : [
        ...(a > p.start ? [{ start: p.start, end: a }] : []),
        ...(b < p.end ? [{ start: b, end: p.end }] : []),
      ]));
    }
    out.push(...pieces.filter((p) => p.end - p.start >= 0.8));
  }
  return out;
}

/** מאחד חורים קרובים לחלונות של עד maxSec (פחות בקשות) */
function groupWindows(gaps: Speech[], maxSec: number): Speech[] {
  const out: Speech[] = [];
  for (const g of gaps) {
    const last = out.at(-1);
    if (last && g.end - last.start <= maxSec) last.end = g.end;
    else out.push({ ...g });
  }
  return out.map((w) => ({ start: Math.max(0, w.start - 0.4), end: w.end + 0.4 }));
}

/** משפט שהגיע פעמיים (מהחלק הרגיל ומההשלמה) נשאר פעם אחת */
function dedupe(segs: Segment[]): Segment[] {
  const out: Segment[] = [];
  for (const s of segs) {
    const prev = out.at(-1);
    if (prev && s.start < prev.end - 0.2 && (s.text === prev.text || prev.text.includes(s.text) || s.text.includes(prev.text))) {
      if (s.text.length > prev.text.length) out[out.length - 1] = { start: Math.min(prev.start, s.start), end: Math.max(prev.end, s.end), text: s.text };
      continue;
    }
    out.push(s);
  }
  return out;
}

const sum = (rs: Speech[]) => rs.reduce((a, r) => a + r.end - r.start, 0);

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
  // שוליים, כדי לא לקטוע את תחילת המילה הראשונה ואת סוף האחרונה
  return chunks.map((c) => ({ start: Math.max(0, c.start - 0.3), end: c.end + 0.3 }));
}
