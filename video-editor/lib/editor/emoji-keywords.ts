import type { Caption, Overlay } from "./types";
import { presetById } from "./overlay-presets";
import { uid } from "./timeline-utils";

/** מילים בכתוביות שמקבלות אימוג'י קופץ. בודקים לפי תחילת המילה, כדי לתפוס גם הטיות */
const KEYWORDS: [RegExp, string][] = [
  [/^(ה|ו|ב|ל)?(כסף|שקל|מחיר|חינם|הנחה)/, "💰"],
  [/^(ה|ו|ב|ל)?(אהב|לב|מתה על)/, "❤️"],
  [/^(ה|ו)?(וואו|מטורף|מדהים|לא יאמן|הלם)/, "🤯"],
  [/^(ה|ו|ב|ל)?(טיפ|סוד|טריק)/, "💡"],
  [/^(ה|ו|ב|ל)?(אוכל|מתכון|טעים|ארוחה)/, "😋"],
  [/^(ה|ו|ב|ל)?(צחוק|מצחיק|חחח)/, "😂"],
  [/^(ה|ו|ב|ל)?(אש|לוהט|חם)/, "🔥"],
  [/^(ה|ו|ב|ל)?(זמן|שעה|דקה|מהר)/, "⏰"],
  [/^(ה|ו|ב|ל)?(הצלח|ניצח|מטרה)/, "🏆"],
  [/^(ה|ו)?(שימו לב|חשוב|אזהרה)/, "⚠️"],
  [/^(ה|ו|ב|ל)?(בית|דירה)/, "🏠"],
  [/^(ה|ו|ב|ל)?(טיול|טיסה|חופש)/, "✈️"],
];

/** מוסיף עד max אימוג'ים קופצים ליד מילות מפתח בכתוביות, ברווח של לפחות 3 שניות */
export function emojiOverlays(captions: Caption[], max = 4): Overlay[] {
  const out: Overlay[] = [];
  let lastAt = -10;
  const positions = [{ x: 0.78, y: 0.3 }, { x: 0.22, y: 0.32 }];
  for (const cap of captions) {
    if (out.length >= max) break;
    if (cap.start - lastAt < 3) continue;
    const words = cap.text.split(/\s+/);
    const hit = KEYWORDS.find(([re]) => words.some((w) => re.test(w)));
    if (!hit) continue;
    const base = presetById("emoji-fire").fields;
    out.push({
      ...base, ...positions[out.length % 2], id: uid("ovl"), text: hit[1],
      start: cap.start, end: Math.max(cap.end, cap.start + 1.5), fromTemplate: true,
    });
    lastAt = cap.start;
  }
  return out;
}
