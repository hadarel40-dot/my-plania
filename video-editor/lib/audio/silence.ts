import { ANALYSIS_RATE } from "./decode";

export interface Range { start: number; end: number }

const FRAME_SEC = 0.02;

/**
 * מוצא את קטעי הדיבור בגל (בשניות), כדי לחתוך את השתיקות שביניהם (ג'אמפ קאטים).
 * הסף מחושב מהקובץ עצמו: בין רעש הרקע (אחוזון 10) לדיבור (אחוזון 90), כך שזה עובד
 * גם בחדר שקט וגם ברחוב.
 *
 * minSilence: שתיקה קצרה מזה נשארת (נשימה טבעית בין מילים).
 * pad: כמה להשאיר לפני ואחרי כל קטע דיבור, כדי לא לקטוע עיצורים.
 */
export function findSpeech(
  samples: Float32Array,
  { from = 0, to = samples.length / ANALYSIS_RATE, minSilence = 0.45, pad = 0.12 }: { from?: number; to?: number; minSilence?: number; pad?: number } = {},
): Range[] {
  const frameLen = Math.round(FRAME_SEC * ANALYSIS_RATE);
  const first = Math.floor((from * ANALYSIS_RATE) / frameLen);
  const last = Math.floor((Math.min(to, samples.length / ANALYSIS_RATE) * ANALYSIS_RATE) / frameLen);
  const db: number[] = [];
  for (let f = first; f < last; f++) {
    let sum = 0;
    for (let i = f * frameLen; i < (f + 1) * frameLen; i++) sum += samples[i] * samples[i];
    db.push(10 * Math.log10(sum / frameLen + 1e-10));
  }
  if (!db.length) return [];

  const sorted = [...db].sort((a, b) => a - b);
  const floor = sorted[Math.floor(sorted.length * 0.1)];
  const loud = sorted[Math.floor(sorted.length * 0.9)];
  // קליפ בלי הבדל ברור בין שקט לדיבור (מוזיקה רציפה, או שקט מוחלט): לא נוגעים
  if (loud - floor < 10) return [{ start: from, end: to }];
  const threshold = floor + (loud - floor) * 0.3;

  const ranges: Range[] = [];
  let runStart = -1;
  for (let i = 0; i <= db.length; i++) {
    const voiced = i < db.length && db[i] > threshold;
    if (voiced && runStart < 0) runStart = i;
    if (!voiced && runStart >= 0) {
      ranges.push({ start: from + runStart * FRAME_SEC, end: from + i * FRAME_SEC });
      runStart = -1;
    }
  }

  // מאחדים קטעים עם הפסקה קצרה ביניהם, מוסיפים שוליים, ומסננים רעשים בודדים
  const merged: Range[] = [];
  for (const r of ranges) {
    const prev = merged[merged.length - 1];
    if (prev && r.start - prev.end < minSilence) prev.end = r.end;
    else merged.push({ ...r });
  }
  return merged
    .filter((r) => r.end - r.start >= 0.15)
    .map((r) => ({ start: Math.max(from, r.start - pad), end: Math.min(to, r.end + pad) }))
    .reduce<Range[]>((out, r) => {
      const prev = out[out.length - 1];
      if (prev && r.start <= prev.end) prev.end = r.end;
      else out.push(r);
      return out;
    }, []);
}
