import type { CaptionStyle } from "./types";

/**
 * סגנונות כתוביות מוכנים: כל אחד הוא שילוב שלם של אנימציה, גופן, צבעים, קו מתאר
 * ורקע, כמו התבניות בעורכים בטלפון. אחרי הבחירה אפשר לשנות כל פרט.
 */
export interface CaptionTemplate { id: string; label: string; style: Required<Pick<CaptionStyle, "preset" | "font" | "accent">> & Partial<CaptionStyle> }

export const CAPTION_TEMPLATES: CaptionTemplate[] = [
  { id: "classic", label: "קלאסי צהוב", style: { preset: "word-pop", font: "secular", accent: "#facc15", color: undefined, outline: undefined, box: "none", size: 1 } },
  { id: "box-cyan", label: "מסגרת תכלת", style: { preset: "highlight-box", font: "rubik", accent: "#22d3ee", color: undefined, outline: undefined, box: "none", size: 1 } },
  { id: "neon", label: "ניאון ורוד", style: { preset: "word-pop", font: "fredoka", accent: "#f472b6", color: "#ffffff", outline: "bold", box: "none", size: 1.05 } },
  { id: "big-one", label: "מילה ענקית", style: { preset: "one-word", font: "karantina", accent: "#ffffff", outline: "bold", box: "none", size: 1.15 } },
  { id: "karaoke-green", label: "קריוקי ירוק", style: { preset: "karaoke", font: "varela", accent: "#a3e635", outline: undefined, box: "none", size: 1 } },
  { id: "dark-pill", label: "בועה כהה", style: { preset: "karaoke", font: "assistant", accent: "#facc15", outline: "none", box: "dark", size: 0.9 } },
  { id: "white-pill", label: "בועה לבנה", style: { preset: "highlight-box", font: "heebo", accent: "#7c3aed", outline: "none", box: "light", size: 0.9 } },
  { id: "elegant", label: "אלגנטי", style: { preset: "bold-pop", font: "bellefair", accent: "#ffffff", color: "#fff7e6", outline: "thin", box: "none", size: 1 } },
  { id: "hand", label: "כתב יד", style: { preset: "word-pop", font: "playpen", accent: "#fb923c", outline: "thin", box: "none", size: 1 } },
  { id: "minimal", label: "מינימלי", style: { preset: "minimal", font: "ibmplex", accent: "#ffffff", outline: "none", box: "none", size: 1 } },
  { id: "bold-orange", label: "כתום חזק", style: { preset: "word-pop", font: "suez", accent: "#fb923c", outline: "bold", box: "none", size: 1.1 } },
  { id: "news", label: "חדשות", style: { preset: "bold-pop", font: "ibmplex", accent: "#ef4444", color: "#ffffff", outline: "none", box: "dark", size: 0.95 } },
];

export const CAPTION_COLORS = ["#ffffff", "#facc15", "#22d3ee", "#a3e635", "#f472b6", "#fb923c", "#ef4444", "#a78bfa", "#111111"];
