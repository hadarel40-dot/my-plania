import { findSpeech, type Range } from "@/lib/audio/silence";

export interface Word { start: number; end: number; text: string }
export interface AlignedSegment { start: number; end: number; text: string; words: Word[] }

/**
 * מתאים את הטקסט לדיבור עצמו. התמלול (Gemini או Whisper) נותן טקסט מדויק, אבל זמנים
 * משוערים, ולכן כתוביות "ממהרות" או "מאחרות". כאן הזמנים נקבעים מהסאונד:
 *  1. מוצאים בדיוק איפה מדברים ואיפה יש הפסקות (גם הפסקות קצרות בין משפטים).
 *  2. כל משפט מתחיל בתחילת קטע הדיבור הקרוב לזמן שהתמלול נתן (עוגן).
 *  3. בין עוגן לעוגן, המילים מתחלקות על זמן הדיבור בלבד (לא על השתיקות), לפי אורך המילה.
 * כך כל מילה מופיעה כשאומרים אותה, וההפסקות נשארות הפסקות.
 */
export function alignSegments(segments: { start: number; end: number; text: string }[], samples: Float32Array): AlignedSegment[] {
  const segs = segments.filter((s) => s.text.trim()).sort((a, b) => a.start - b.start);
  if (!segs.length) return [];
  const runs = findSpeech(samples, { minSilence: 0.12, pad: 0.03 });
  if (!runs.length) return segs.map((s) => ({ ...s, words: spread(s.text, s.start, s.end) }));

  const axis = speechAxis(runs);
  // עוגן לכל משפט: תחילת קטע דיבור קרובה (עד 0.8 שנ׳) לזמן מהתמלול; אחרת הזמן מהתמלול
  const near = (t: number, edge: "start" | "end") => {
    let best: number | null = null;
    for (const r of runs) {
      const v = r[edge];
      if (Math.abs(v - t) <= 0.8 && (best === null || Math.abs(v - t) < Math.abs(best - t))) best = v;
    }
    return best ?? t;
  };
  const anchors = segs.map((s) => axis.toSpeech(near(s.start, "start")));
  anchors.push(axis.toSpeech(near(segs[segs.length - 1].end, "end")));
  // העוגנים חייבים לעלות; למשפט מינימום זמן לפי אורכו
  for (let i = 1; i < anchors.length; i++) {
    const min = anchors[i - 1] + Math.min(0.25, 0.04 * segs[i - 1].text.length);
    if (anchors[i] < min) anchors[i] = min;
  }
  const total = axis.total;
  for (let i = anchors.length - 1; i >= 0; i--) anchors[i] = Math.min(anchors[i], total);

  return segs.map((s, i) => {
    const a = anchors[i], b = Math.max(anchors[i + 1], a + 0.05);
    const words = weights(s.text);
    const sum = words.reduce((acc, w) => acc + w.weight, 0) || 1;
    let t = a;
    const out: Word[] = words.map((w) => {
      const start = t;
      t += ((b - a) * w.weight) / sum;
      return { text: w.text, start: axis.toReal(start, "start"), end: axis.toReal(t, "end") };
    });
    return { text: s.text, start: out[0]?.start ?? s.start, end: out.at(-1)?.end ?? s.end, words: out };
  });
}

/** ציר "זמן דיבור": השניות שבהן מדברים, ברצף, בלי השתיקות שביניהן */
function speechAxis(runs: Range[]) {
  const cum: number[] = [];
  let total = 0;
  for (const r of runs) { cum.push(total); total += r.end - r.start; }
  return {
    total,
    toSpeech(t: number) {
      for (let i = 0; i < runs.length; i++) {
        if (t < runs[i].start) return cum[i];
        if (t <= runs[i].end) return cum[i] + (t - runs[i].start);
      }
      return total;
    },
    /** בגבול בין קטעים: התחלה של מילה נופלת על תחילת הקטע הבא, וסוף על סוף הקטע הקודם */
    toReal(s: number, side: "start" | "end") {
      for (let i = 0; i < runs.length; i++) {
        const len = runs[i].end - runs[i].start;
        if (s < cum[i] + len || (side === "end" && s <= cum[i] + len)) return runs[i].start + Math.max(0, s - cum[i]);
      }
      return runs[runs.length - 1].end;
    },
  };
}

function weights(text: string) {
  return text.split(/\s+/).filter(Boolean).map((w) => ({ text: w, weight: w.replace(/[^\p{L}\p{N}]/gu, "").length + 1.5 }));
}

function spread(text: string, start: number, end: number): Word[] {
  const ws = weights(text);
  const sum = ws.reduce((a, w) => a + w.weight, 0) || 1;
  let t = start;
  return ws.map((w) => { const s = t; t += ((end - start) * w.weight) / sum; return { text: w.text, start: s, end: t }; });
}
