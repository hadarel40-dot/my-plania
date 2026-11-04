import type { CaptionStyle } from "./types";

/**
 * סגנונות כתוביות מוכנים: כל אחד הוא שילוב שלם של אנימציה, גופן, צבעים, קו מתאר ורקע.
 * מסודרים בקטגוריות. אחרי הבחירה אפשר לשנות כל פרט (צבע, גודל, גופן, מיקום).
 */
export interface CaptionTemplate {
  id: string;
  label: string;
  group: "popular" | "neon" | "clean" | "fun";
  style: Required<Pick<CaptionStyle, "preset" | "font" | "accent">> & Partial<CaptionStyle>;
}

export const TEMPLATE_GROUPS: { id: CaptionTemplate["group"]; label: string }[] = [
  { id: "popular", label: "🔥 פופולרי" },
  { id: "neon", label: "✨ ניאון וזוהר" },
  { id: "clean", label: "🤍 נקי ואלגנטי" },
  { id: "fun", label: "🎨 כיפי ומיוחד" },
];

const base = { color: undefined, outline: undefined, box: "none" as const, size: 1 };
const t = (id: string, label: string, group: CaptionTemplate["group"], style: CaptionTemplate["style"]): CaptionTemplate =>
  ({ id, label, group, style: { ...base, ...style } });

export const CAPTION_TEMPLATES: CaptionTemplate[] = [
  // פופולרי
  t("classic", "קלאסי צהוב", "popular", { preset: "word-pop", font: "secular", accent: "#facc15" }),
  t("box-cyan", "מסגרת תכלת", "popular", { preset: "highlight-box", font: "rubik", accent: "#22d3ee" }),
  t("box-pink", "מסגרת ורודה", "popular", { preset: "highlight-box", font: "rubik", accent: "#f472b6" }),
  t("big-one", "מילה ענקית", "popular", { preset: "one-word", font: "karantina", accent: "#ffffff", outline: "bold", size: 1.15 }),
  t("big-yellow", "מילה ענקית צהובה", "popular", { preset: "one-word", font: "secular", accent: "#facc15", outline: "bold", size: 1.1 }),
  t("karaoke-green", "קריוקי ירוק", "popular", { preset: "karaoke", font: "varela", accent: "#a3e635" }),
  t("bold-orange", "כתום חזק", "popular", { preset: "word-pop", font: "suez", accent: "#fb923c", outline: "bold", size: 1.1 }),
  t("underline-y", "קו צהוב", "popular", { preset: "underline", font: "heebo", accent: "#facc15" }),
  t("bubbles-dark", "בועות", "popular", { preset: "bubble", font: "rubik", accent: "#facc15", size: 0.95 }),
  // ניאון וזוהר
  t("neon-pink", "ניאון ורוד", "neon", { preset: "neon", font: "fredoka", accent: "#ec4899" }),
  t("neon-blue", "ניאון כחול", "neon", { preset: "neon", font: "assistant", accent: "#38bdf8" }),
  t("neon-green", "ניאון ירוק", "neon", { preset: "neon", font: "karantina", accent: "#4ade80", size: 1.1 }),
  t("neon-purple", "ניאון סגול", "neon", { preset: "neon", font: "secular", accent: "#a855f7" }),
  t("glow-gold", "זהב זוהר", "neon", { preset: "neon", font: "bellefair", accent: "#fbbf24", color: "#fff7e6" }),
  t("grad-sunset", "שקיעה", "neon", { preset: "gradient", font: "secular", accent: "#fb7185" }),
  t("grad-ocean", "אוקיינוס", "neon", { preset: "gradient", font: "rubik", accent: "#22d3ee" }),
  t("grad-candy", "סוכרייה", "neon", { preset: "gradient", font: "fredoka", accent: "#e879f9" }),
  t("outline-cyan", "חלול תכלת", "neon", { preset: "outline", font: "rubik", accent: "#22d3ee" }),
  // נקי ואלגנטי
  t("minimal", "מינימלי", "clean", { preset: "minimal", font: "ibmplex", accent: "#ffffff", outline: "none" }),
  t("dark-pill", "בועה כהה", "clean", { preset: "karaoke", font: "assistant", accent: "#facc15", outline: "none", box: "dark", size: 0.9 }),
  t("white-pill", "בועה לבנה", "clean", { preset: "highlight-box", font: "heebo", accent: "#7c3aed", outline: "none", box: "light", size: 0.9 }),
  t("elegant", "אלגנטי", "clean", { preset: "bold-pop", font: "bellefair", accent: "#ffffff", color: "#fff7e6", outline: "thin" }),
  t("serif-gold", "סריף זהב", "clean", { preset: "karaoke", font: "frank", accent: "#d4a373", outline: "thin" }),
  t("news", "חדשות", "clean", { preset: "bold-pop", font: "ibmplex", accent: "#ef4444", color: "#ffffff", outline: "none", box: "dark", size: 0.95 }),
  t("slide-clean", "החלקה נקייה", "clean", { preset: "slide", font: "assistant", accent: "#38bdf8", outline: "thin" }),
  t("typewriter", "הקלדה", "clean", { preset: "typewriter", font: "notoserif", accent: "#facc15", outline: "none", box: "dark", size: 0.85 }),
  t("underline-pink", "קו ורוד", "clean", { preset: "underline", font: "notosans", accent: "#f472b6", outline: "thin" }),
  // כיפי ומיוחד
  t("hand", "כתב יד", "fun", { preset: "word-pop", font: "playpen", accent: "#fb923c", outline: "thin" }),
  t("gveret", "כתב יד גברת", "fun", { preset: "karaoke", font: "gveret", accent: "#f472b6", outline: "thin", size: 1.1 }),
  t("bubbles-font", "גופן בועות", "fun", { preset: "word-pop", font: "bubbles", accent: "#38bdf8", outline: "none", size: 1.05 }),
  t("glitch", "גליץ'", "fun", { preset: "word-pop", font: "glitch", accent: "#22d3ee", outline: "none" }),
  t("wetpaint", "צבע נוטף", "fun", { preset: "one-word", font: "wetpaint", accent: "#ef4444", outline: "none", size: 1.1 }),
  t("graffiti", "גרפיטי", "fun", { preset: "word-pop", font: "spray", accent: "#a3e635", outline: "none" }),
  t("retro80", "שנות ה-80", "fun", { preset: "shadow3d", font: "fade80", accent: "#e879f9", outline: "none" }),
  t("comic3d", "קומיקס תלת-ממד", "fun", { preset: "shadow3d", font: "secular", accent: "#2563eb", color: "#facc15", outline: "none" }),
  t("pixels", "פיקסלים", "fun", { preset: "karaoke", font: "pixels", accent: "#4ade80", outline: "none" }),
];

export const CAPTION_COLORS = ["#ffffff", "#facc15", "#fb923c", "#ef4444", "#f472b6", "#e879f9", "#a78bfa", "#38bdf8", "#22d3ee", "#4ade80", "#a3e635", "#111111"];
