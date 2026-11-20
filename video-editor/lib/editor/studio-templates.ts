import type { Overlay } from "./types";
import type { ReelTemplate } from "./templates";

/**
 * התבניות של סטודיו התוכן, בתוך העורך: אותם מבנים (lib/studio/templates.ts), כטקסטים על ציר הזמן.
 * כרטיסי טקסט בעיצוב הסטודיו (שמנת ודיו), בתוך האזור הבטוח. הטקסטים הם מקום לכתוב, וכל אחד ניתן לשינוי.
 */
const CARD: Partial<Overlay> = { background: "#F4EEE4", color: "#2A2622", stroke: false, weight: 700, font: "frank", size: 70 };
const LABEL: Partial<Overlay> = { background: "#1F1B16", color: "#FBF8F2", stroke: false, weight: 700, font: "assistant", size: 56 };
const caps = { preset: "highlight-box" as const, accent: "#F6E7A6", y: 0.76, font: "assistant" };

export const STUDIO_REEL_TEMPLATES: ReelTemplate[] = [
  {
    id: "st-text-7s", label: "ריל טקסט של 7 שניות", emoji: "", description: "שוט אחד, כרטיסי טקסט שלוקח זמן לקרוא, צופים שוב",
    style: "warm", captions: caps,
    overlays: [
      { preset: "typewriter", text: "ההוק שלך כאן, עד שש מילים", start: 0, until: 2.6, patch: { ...CARD, y: 0.3 } },
      { preset: "typewriter", text: "משפט שני: התובנה", start: 2.6, until: 5, patch: { ...CARD, y: 0.42 } },
      { preset: "typewriter", text: "שמרי לפעם הבאה", start: 5, until: "end", patch: { ...CARD, y: 0.42 } },
    ],
    sfx: [{ id: "typing", at: 0 }],
  },
  {
    id: "st-montage-10s", label: "מונטאז' של 10 שניות", emoji: "", description: "קטעים קצרים לפי הקצב, וכרטיס אחד שמחבר",
    style: "warm", captions: caps,
    overlays: [{ preset: "title-pop", text: "ההוק שלך לאורך כל הסרטון", start: 0, until: "end", patch: { ...CARD, y: 0.28 } }],
    sfx: [{ id: "whoosh", at: 0 }],
  },
  {
    id: "st-mistakes-3", label: "3 טעויות", emoji: "", description: "הוק, שלוש תוויות של טעות ותיקון, וקריאה לשמור",
    style: "warm", captions: caps,
    overlays: [
      { preset: "title-pop", text: "3 טעויות ש...", start: 0, until: 3, patch: { ...CARD, y: 0.26 } },
      { preset: "label-slide", text: "טעות 1", start: 3.2, patch: { ...LABEL, y: 0.2 } },
      { preset: "label-slide", text: "טעות 2", start: "mid", patch: { ...LABEL, y: 0.2 } },
      { preset: "label-slide", text: "טעות 3", start: -7, patch: { ...LABEL, y: 0.2 } },
      { preset: "typewriter", text: "תשמרי לפני הפעם הבאה", start: -3, until: "end", patch: { ...CARD, y: 0.4 } },
    ],
    sfx: [{ id: "pop", at: 0 }, { id: "swipe", at: 3.2 }, { id: "swipe", at: "mid" }, { id: "swipe", at: -7 }],
  },
  {
    id: "st-before-after", label: "לפני ואחרי (סטודיו)", emoji: "", description: "התוצאה בפתיחה, לפני, הצעדים, ואחרי",
    style: "warm", captions: caps,
    overlays: [
      { preset: "label-slide", text: "לפני", start: 0, until: "mid", patch: { ...LABEL, y: 0.2 } },
      { preset: "label-slide", text: "אחרי", start: "mid", until: "end", patch: { ...LABEL, y: 0.2, background: "#F6E7A6", color: "#1F1B16" } },
    ],
    sfx: [{ id: "riser", at: "mid" }],
  },
  {
    id: "st-myth-fact", label: "מיתוס מול אמת", emoji: "", description: "המיתוס בכרטיס אדמדם, האמת בכרטיס ירוק",
    style: "warm", captions: caps,
    overlays: [
      { preset: "title-pop", text: "מיתוס: ...", start: 0, until: "mid", patch: { ...CARD, y: 0.26, background: "#F3DCD5" } },
      { preset: "title-pop", text: "האמת: ...", start: "mid", until: "end", patch: { ...CARD, y: 0.26, background: "#DCE8DF" } },
    ],
    sfx: [{ id: "ding", at: "mid" }],
  },
  {
    id: "st-pov", label: "POV", emoji: "", description: "סיטואציה מוכרת בגוף ראשון, ותפנית",
    style: "warm", captions: caps,
    overlays: [
      { preset: "typewriter", text: "POV: את...", start: 0, until: "mid", patch: { ...CARD, y: 0.26 } },
      { preset: "typewriter", text: "ואז יש לך שיטה", start: "mid", until: "end", patch: { ...CARD, y: 0.26 } },
    ],
    sfx: [{ id: "notify", at: 0 }],
  },
  {
    id: "st-steps-3", label: "מדריך ב-3 צעדים", emoji: "", description: "התוצאה בהוק, שלושה צעדים מסומנים, ושמירה",
    style: "warm", captions: caps,
    overlays: [
      { preset: "title-pop", text: "ככה אני ... בעשר דקות", start: 0, until: 3, patch: { ...CARD, y: 0.26 } },
      { preset: "label-slide", text: "שלב 1", start: 3.2, patch: { ...LABEL, y: 0.2 } },
      { preset: "label-slide", text: "שלב 2", start: "mid", patch: { ...LABEL, y: 0.2 } },
      { preset: "label-slide", text: "שלב 3", start: -7, patch: { ...LABEL, y: 0.2 } },
      { preset: "typewriter", text: "תשמרי לפעם הבאה", start: -3, until: "end", patch: { ...CARD, y: 0.4 } },
    ],
    sfx: [{ id: "pop", at: 0 }, { id: "click", at: 3.2 }, { id: "click", at: "mid" }, { id: "click", at: -7 }, { id: "success", at: -3 }],
  },
  {
    id: "st-day-in-life", label: "יום אחד איתי", emoji: "", description: "הוק, רגעים מהיום, וקריאה רכה לעקוב",
    style: "warm", captions: caps,
    overlays: [
      { preset: "title-pop", text: "יום אחד של ...", start: 0, until: 3, patch: { ...CARD, y: 0.26 } },
      { preset: "typewriter", text: "עקבי לעוד ימים כאלה", start: -3, until: "end", patch: { ...CARD, y: 0.4 } },
    ],
    sfx: [{ id: "whoosh", at: 0 }],
  },
  {
    id: "st-things-i-do", label: "דברים שאני עושה כל ראשון", emoji: "", description: "כרטיס פתיחה ורשימה של הרגלים",
    style: "warm", captions: caps,
    overlays: [
      { preset: "typewriter", text: "דברים שאני עושה כל ראשון כדי ש...", start: 0, until: 3, patch: { ...CARD, y: 0.26 } },
      { preset: "label-slide", text: "1", start: 3, patch: { ...LABEL, y: 0.2 } },
      { preset: "label-slide", text: "2", start: "mid", patch: { ...LABEL, y: 0.2 } },
      { preset: "label-slide", text: "3", start: -4, patch: { ...LABEL, y: 0.2 } },
    ],
    sfx: [{ id: "pop", at: 3 }, { id: "pop", at: "mid" }, { id: "pop", at: -4 }],
  },
  {
    id: "st-this-vs-that", label: "זה מול זה", emoji: "", description: "שני צדדים, ומה ניצח",
    style: "warm", captions: caps,
    overlays: [
      { preset: "label-slide", text: "א", start: 0, until: "mid", patch: { ...LABEL, y: 0.2 } },
      { preset: "label-slide", text: "ב", start: "mid", until: -3, patch: { ...LABEL, y: 0.2, background: "#F6E7A6", color: "#1F1B16" } },
      { preset: "typewriter", text: "ואת, איזה צוות?", start: -3, until: "end", patch: { ...CARD, y: 0.4 } },
    ],
    sfx: [{ id: "swipe", at: "mid" }],
  },
  {
    id: "st-storytime", label: "סיפור עם תפנית", emoji: "", description: "פתיחה מאמצע הסיפור, 'ואז הבנתי', וסיום",
    style: "warm", captions: caps,
    overlays: [
      { preset: "typewriter", text: "הרגע הכי קשה, במשפט", start: 0, until: 3, patch: { ...CARD, y: 0.26 } },
      { preset: "typewriter", text: "ואז הבנתי ש...", start: "mid", patch: { ...CARD, y: 0.26 } },
    ],
    sfx: [{ id: "riser", at: "mid" }],
  },
  {
    id: "st-save-checklist", label: "צ'קליסט לשמירה (ריל)", emoji: "", description: "כרטיס פתיחה, פריטים מהירים, ושמירה",
    style: "warm", captions: caps,
    overlays: [
      { preset: "typewriter", text: "תשמרי את זה לפני ה...", start: 0, until: 2.5, patch: { ...CARD, y: 0.26 } },
      { preset: "typewriter", text: "שמרת? עכשיו את מוכנה", start: -2.5, until: "end", patch: { ...CARD, y: 0.4 } },
    ],
    sfx: [{ id: "ding", at: -2.5 }],
  },
  {
    id: "st-green-screen", label: "מגיבה לכתבה או לטרנד", emoji: "", description: "הכותרת למעלה, והזווית שלך מתחת",
    style: "warm", captions: caps,
    overlays: [
      { preset: "title-pop", text: "כולן מדברות על ...", start: 0, until: 3, patch: { ...CARD, y: 0.2 } },
      { preset: "typewriter", text: "הנה מה שאף אחד לא אומר", start: 3, until: 6, patch: { ...CARD, y: 0.2 } },
    ],
    sfx: [{ id: "notify", at: 0 }],
  },
];

/** התבנית בעורך שמתאימה לתבנית בסטודיו */
export const editorTemplateFor = (studioId?: string | null) => (studioId ? STUDIO_REEL_TEMPLATES.find((t) => t.id === `st-${studioId}`) ?? null : null);
