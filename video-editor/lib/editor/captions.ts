import type { Caption } from "./types";
import { uid } from "./timeline-utils";

/**
 * זמני המילים בתוך כתובית. Whisper בדפדפן נותן זמנים למשפט, ולא לכל מילה,
 * ולכן מחלקים את זמן המשפט לפי אורך המילים: מילה ארוכה נאמרת זמן רב יותר.
 */
export function wordTimes(text: string, duration: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const weights = words.map((w) => w.replace(/[^\p{L}\p{N}]/gu, "").length + 1.5);
  const total = weights.reduce((s, w) => s + w, 0) || 1;
  let t = 0;
  return words.map((word, i) => {
    const start = t;
    t += (weights[i] / total) * duration;
    return { word, start, end: t };
  });
}

/**
 * מפרק משפטים ארוכים לכתוביות קצרות של עד maxWords מילים, כמו ברילס:
 * קל לקרוא, והקצב מרגיש מהיר.
 */
export function splitCaptions(captions: Caption[], maxWords = 3): Caption[] {
  return captions.flatMap((cap) => {
    const words = wordTimes(cap.text, cap.end - cap.start);
    if (words.length <= maxWords) return [cap];
    const chunks: Caption[] = [];
    for (let i = 0; i < words.length; i += maxWords) {
      const group = words.slice(i, i + maxWords);
      chunks.push({
        ...cap,
        id: uid("cap"),
        text: group.map((w) => w.word).join(" "),
        start: +(cap.start + group[0].start).toFixed(2),
        end: +(cap.start + group[group.length - 1].end).toFixed(2),
      });
    }
    return chunks;
  });
}

export const CAPTION_ACCENTS = ["#facc15", "#22d3ee", "#a3e635", "#f472b6", "#fb923c", "#ffffff"];
