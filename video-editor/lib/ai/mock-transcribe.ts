import type { Caption } from "@/lib/editor/types";
import { uid } from "@/lib/editor/timeline-utils";

const LINES = [
  "היי, ברוכים הבאים לסרטון",
  "היום נראה משהו שישנה לכם את העבודה",
  "שימו לב לרגע הזה",
  "זה בדיוק הטריק",
  "ככה זה נראה בפועל",
  "תשמרו את זה לפעם הבאה",
  "ואם זה עזר לכם",
  "תעקבו לעוד כאלה",
];

/** מדמה תמלול: מחלק את משך הסרטון למקטעים של כ-2 שניות עם טקסט לדוגמה */
export async function mockTranscribe(duration: number): Promise<Caption[]> {
  await new Promise((r) => setTimeout(r, 1200));
  const captions: Caption[] = [];
  let t = 0.2;
  let i = 0;
  while (t < duration - 0.5) {
    const len = Math.min(1.6 + (i % 3) * 0.3, duration - t);
    captions.push({
      id: uid("cap"),
      start: +t.toFixed(2),
      end: +(t + len).toFixed(2),
      text: LINES[i % LINES.length],
      preset: "bold-pop",
    });
    t += len + 0.15;
    i++;
  }
  return captions;
}
