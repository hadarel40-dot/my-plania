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
  caption_font: z.enum(["heebo", "rubik", "secular", "suez", "frank", "varela", "amatic", "karantina"]).default("secular")
    .describe("גופן לכתוביות: secular/rubik נקיים ובולטים, karantina צר ודרמטי, frank ספרותי, amatic כתב יד, varela רך"),
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
  /** ההוראות שנכתבו לעורך */
  notes?: string;
}

/** תוכנית לסרטון אווירה: אילו קטעים, באיזה סדר, ואיזו מוזיקה */
export const VibePlanSchema = z.object({
  order: z.array(z.number().int()).describe("מספרי הקטעים שנבחרו, בסדר שבו יופיעו בסרטון"),
  music: z.enum(["happy", "chill", "energetic", "inspiring", "pop", "hiphop", "romantic", "cinematic", "acoustic"]),
  color_style: z.enum(["none", "cinematic", "vivid", "warm", "cold", "vintage", "matte", "bw", "noir"]),
  title: z.string().describe("שם קצר לפרויקט"),
  text: z.string().describe("טקסט קצר ועדין על המסך בפתיחה (עד 5 מילים), או מחרוזת ריקה"),
  target_seconds: z.number().default(0).describe("אורך הסרטון שהיוצרת ביקשה בהוראות, בשניות; 0 אם לא ביקשה"),
  summary: z.string().describe("משפט או שניים בעברית: מה נבחר ולמה"),
});

export type VibePlan = z.infer<typeof VibePlanSchema>;

export interface VibePlanRequest {
  shots: { id: number; start: number; end: number; clip: number; image: string }[];
  /** כמה שניות בערך הסרטון הסופי */
  target: number;
  hasMusic: boolean;
  notes?: string;
}

/** תמלול: מקטעים קצרים עם זמנים (בשניות מתחילת קטע הסאונד) */
export const TranscriptSchema = z.object({
  segments: z.array(z.object({ start: z.number(), end: z.number(), text: z.string() })),
});

/** טרנדים עכשוויים לסרטון, ש-Claude מצא בחיפוש ברשת */
export const TrendsSchema = z.object({
  trends: z.array(z.object({
    name: z.string().describe("שם הטרנד בעברית, קצר"),
    why: z.string().describe("משפט: מה זה ולמה זה עובד עכשיו"),
    how: z.string().describe("הוראה קצרה לעורך איך להחיל את זה על הסרטון הזה"),
  })).describe("3-5 טרנדים עדכניים שמתאימים לסרטון"),
  hooks: z.array(z.string()).describe("3 הוקים בעברית בסגנון שעובד עכשיו, עד 8 מילים כל אחד"),
  caption: z.string().describe("טקסט לתיאור הפוסט בעברית, 1-3 שורות, עם קריאה לפעולה"),
  hashtags: z.array(z.string()).describe("5-10 האשטגים רלוונטיים, עם #"),
  audio: z.array(z.object({ title: z.string(), artist: z.string(), note: z.string() }))
    .describe("2-4 צלילים/שירים טרנדיים ברילס שמתאימים, להוספה באפליקציה של אינסטגרם"),
});

export type Trends = z.infer<typeof TrendsSchema>;

export interface TrendsRequest {
  /** על מה הסרטון: ההוראות, השם, ותחילת התמלול אם יש */
  topic: string;
  kind: "talking" | "vibe";
}
