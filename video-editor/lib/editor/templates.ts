import type { CaptionPreset, Overlay } from "./types";
import { presetById } from "./overlay-presets";
import { CLIP_STYLES } from "./clip-styles";
import type { SfxId } from "./sfx";
import { uid } from "./timeline-utils";

/**
 * תבנית לרילס: מה מוסיפים לסרטון בלחיצה אחת. כל התבניות בנויות מהטקסטים,
 * האפקטים והסגנונות שכבר קיימים בעורך, כך שאחר כך אפשר לשנות כל פרט.
 */
export interface ReelTemplate {
  id: string;
  label: string;
  emoji: string;
  description: string;
  /** סגנון הצבע לכל הקליפים */
  style: string;
  captions: { preset: CaptionPreset; accent: string; y: number };
  /** טקסטים. זמן: מספר שניות מההתחלה, שלילי = מהסוף, "mid" = אמצע הסרטון */
  overlays: { preset: string; text: string; start: At; until?: At; patch?: Partial<Overlay> }[];
  sfx: { id: SfxId; at: At }[];
}

type At = number | "mid" | "end";

export const TEMPLATES: ReelTemplate[] = [
  {
    id: "talking",
    label: "רילס דיבור",
    emoji: "🎤",
    description: "הוק גדול בפתיחה, כתוביות מילה-מילה בצהוב, צבעים חיים",
    style: "vivid",
    captions: { preset: "word-pop", accent: "#facc15", y: 0.72 },
    overlays: [
      { preset: "title-pop", text: "כתבו כאן את ההוק 👀", start: 0, patch: { y: 0.18, size: 96 } },
      { preset: "emoji-point", text: "👇", start: -2.5 },
    ],
    sfx: [{ id: "whoosh", at: 0 }, { id: "pop", at: 0.15 }],
  },
  {
    id: "tips",
    label: "טיפים",
    emoji: "💡",
    description: "כותרת בפתיחה, תווית טיפ, וקריאה לעקוב בסוף",
    style: "warm",
    captions: { preset: "highlight-box", accent: "#22d3ee", y: 0.78 },
    overlays: [
      { preset: "title-bounce", text: "3 טיפים ש...", start: 0, patch: { y: 0.2, size: 110 } },
      { preset: "label-slide", text: "טיפ #1", start: 2.6, patch: { y: 0.32 } },
      { preset: "typewriter", text: "עקבו לעוד טיפים ✨", start: -3 },
    ],
    sfx: [{ id: "ding", at: 0 }, { id: "swipe", at: 2.6 }, { id: "success", at: -3 }],
  },
  {
    id: "before-after",
    label: "לפני / אחרי",
    emoji: "✨",
    description: "תווית לפני בהתחלה, אחרי באמצע, עם מעבר סאונד",
    style: "cinematic",
    captions: { preset: "minimal", accent: "#ffffff", y: 0.85 },
    overlays: [
      { preset: "side-slide", text: "לפני", start: 0, until: "mid", patch: { y: 0.15 } },
      { preset: "side-slide", text: "אחרי ✨", start: "mid", until: "end", patch: { y: 0.15, background: "#7c3aed" } },
    ],
    sfx: [{ id: "riser", at: "mid" }, { id: "boom", at: "mid" }],
  },
  {
    id: "energy",
    label: "אנרגטי",
    emoji: "🔥",
    description: "מילה אחת גדולה בכל פעם, אימוג'ים קופצים, הרבה אפקטים",
    style: "vivid",
    captions: { preset: "one-word", accent: "#f472b6", y: 0.6 },
    overlays: [
      { preset: "zoom-in", text: "רגע!", start: 0, patch: { y: 0.22 } },
      { preset: "emoji-fire", text: "🔥", start: 1.5 },
      { preset: "emoji-wow", text: "🤯", start: -2.5 },
    ],
    sfx: [{ id: "boom", at: 0 }, { id: "pop", at: 1.5 }, { id: "notify", at: -2.5 }],
  },
];

/** מה התבנית מוסיפה לסרטון באורך duration */
export function resolveTemplate(t: ReelTemplate, duration: number) {
  const at = (x: At) => (x === "mid" ? duration / 2 : x === "end" ? duration : Math.max(0, x < 0 ? duration + x : x));
  const style = CLIP_STYLES.find((s) => s.id === t.style)!;
  const overlays: Overlay[] = t.overlays.map((o) => {
    const preset = presetById(o.preset);
    const start = Math.min(at(o.start), Math.max(0, duration - 0.5));
    const end = o.until !== undefined ? at(o.until) : Math.min(duration, start + preset.duration);
    return { ...preset.fields, ...o.patch, text: o.text, id: uid("ovl"), start, end: Math.max(start + 0.5, end) };
  });
  const sfx = t.sfx.map((s) => ({ id: s.id, at: Math.min(at(s.at), Math.max(0, duration - 0.3)) }));
  return { look: style.look(0.7), overlays, sfx, captions: t.captions };
}
