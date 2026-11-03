import { z } from "zod";

/**
 * תוכנית העריכה ש-Claude מחזיר לפי התמלול. משותף לשרת (הבקשה ל-Claude)
 * ולדפדפן (החלת התוכנית על ציר הזמן).
 */
export const SmartPlanSchema = z.object({
  title: z.string().describe("שם קצר לפרויקט, 2-5 מילים"),
  hook: z.string().describe("ההוק לשניות הראשונות: עד 7 מילים, באותה שפה שבה מדברים בסרטון"),
  remove_segments: z.array(z.number().int()).describe("מספרי המקטעים להסרה: התחלות שנכשלו, טייקים חוזרים, מילוי"),
  emojis: z.array(z.object({ segment: z.number().int(), emoji: z.string() })).describe("2-5 אימוג'ים ברגעים בולטים"),
  caption_style: z.enum(["word-pop", "highlight-box", "one-word", "karaoke", "bold-pop", "minimal"]),
  accent: z.enum(["#facc15", "#22d3ee", "#a3e635", "#f472b6", "#fb923c", "#ffffff"]),
  template: z.enum(["talking", "tips", "before-after", "energy"]),
  color_style: z.enum(["none", "cinematic", "vivid", "warm", "cold", "vintage", "matte", "bw", "noir"]),
  cta: z.string().describe("קריאה לפעולה קצרה לסוף הסרטון, או מחרוזת ריקה אם לא מתאים"),
  summary: z.string().describe("משפט או שניים בעברית: מה נעשה בעריכה ולמה"),
});

export type SmartPlan = z.infer<typeof SmartPlanSchema>;

export interface SmartPlanRequest {
  /** מקטעי התמלול לפי הסדר, בזמני ציר הזמן */
  segments: { start: number; end: number; text: string }[];
  duration: number;
  hasMusic: boolean;
}
