import type { Overlay } from "./types";

type PresetFields = Omit<Overlay, "id" | "start" | "end">;

export interface OverlayPreset {
  id: string;
  label: string;
  /** כמה זמן הפריט נשאר על המסך כשמוסיפים אותו, בשניות */
  duration: number;
  fields: PresetFields;
}

const base: PresetFields = {
  kind: "text",
  text: "",
  x: 0.5,
  y: 0.3,
  size: 96,
  color: "#ffffff",
  background: null,
  stroke: true,
  weight: 900,
  rotate: 0,
  animIn: "pop",
  loop: "none",
  animOut: "fade",
};

/** תבניות מוכנות לטקסטים ואימוג'ים מונפשים. אחרי ההוספה אפשר לשנות כל שדה */
export const OVERLAY_PRESETS: OverlayPreset[] = [
  { id: "title-pop", label: "כותרת קופצת", duration: 2.5, fields: { ...base, text: "כותרת חזקה", animIn: "pop" } },
  { id: "title-bounce", label: "כותרת מקפצת", duration: 2.5, fields: { ...base, text: "וואו!", size: 130, color: "#facc15", animIn: "bounce", loop: "pulse" } },
  { id: "label-slide", label: "תווית מחליקה", duration: 3, fields: { ...base, text: "טיפ #1", size: 64, stroke: false, background: "#7c3aed", weight: 700, y: 0.75, animIn: "slide-up", animOut: "slide-down" } },
  { id: "side-slide", label: "כניסה מהצד", duration: 3, fields: { ...base, text: "שימו לב 👈", size: 72, stroke: false, background: "#111111", weight: 700, y: 0.62, animIn: "slide-side" } },
  { id: "typewriter", label: "מכונת כתיבה", duration: 3.5, fields: { ...base, text: "ככה עושים את זה", size: 72, stroke: false, background: "#ffffffee", color: "#111111", weight: 700, y: 0.82, animIn: "typewriter" } },
  { id: "zoom-in", label: "זום פנימה", duration: 2, fields: { ...base, text: "עכשיו!", size: 150, color: "#f43f5e", animIn: "zoom", animOut: "pop" } },
  { id: "shake", label: "רעידה", duration: 2, fields: { ...base, text: "חשוב!!", size: 110, color: "#ef4444", animIn: "pop", loop: "shake" } },
  { id: "emoji-fire", label: "אימוג'י 🔥", duration: 2, fields: { ...base, kind: "emoji", text: "🔥", size: 220, x: 0.78, y: 0.2, stroke: false, animIn: "bounce", loop: "wiggle", animOut: "pop" } },
  { id: "emoji-heart", label: "לב פועם ❤️", duration: 2.5, fields: { ...base, kind: "emoji", text: "❤️", size: 200, x: 0.22, y: 0.22, stroke: false, animIn: "pop", loop: "pulse", animOut: "pop" } },
  { id: "emoji-point", label: "חץ מרחף 👇", duration: 3, fields: { ...base, kind: "emoji", text: "👇", size: 180, y: 0.62, stroke: false, animIn: "slide-up", loop: "float" } },
  { id: "emoji-laugh", label: "צחוק 😂", duration: 2, fields: { ...base, kind: "emoji", text: "😂", size: 200, x: 0.75, y: 0.45, stroke: false, animIn: "zoom", loop: "wiggle", animOut: "pop" } },
  { id: "emoji-wow", label: "הלם 🤯", duration: 2, fields: { ...base, kind: "emoji", text: "🤯", size: 200, x: 0.25, y: 0.45, stroke: false, animIn: "bounce", loop: "shake", animOut: "pop" } },
];

export const presetById = (id: string) => OVERLAY_PRESETS.find((p) => p.id === id) ?? OVERLAY_PRESETS[0];

export const ANIM_IN_LABELS: Record<Overlay["animIn"], string> = {
  pop: "קפיצה", bounce: "ניתור", "slide-up": "מלמטה", "slide-side": "מהצד",
  zoom: "זום", typewriter: "הקלדה", fade: "דהייה", none: "בלי",
};
export const LOOP_LABELS: Record<Overlay["loop"], string> = {
  none: "בלי", pulse: "פעימה", wiggle: "נדנוד", float: "ריחוף", shake: "רעידה",
};
export const ANIM_OUT_LABELS: Record<Overlay["animOut"], string> = {
  fade: "דהייה", pop: "התכווצות", "slide-down": "למטה", none: "בלי",
};
