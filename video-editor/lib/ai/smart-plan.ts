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
  moments: z.array(z.object({
    segment: z.number().int(),
    kind: z.enum(["keyword", "number", "step", "emoji"]),
    text: z.string().describe("מה מקפיצים על המסך: 1-3 מילים, מספר, 'טיפ 2', או אימוג'י אחד"),
    importance: z.number().int().min(1).max(3).describe("3 = הרגע הכי חשוב בסרטון"),
  })).default([]).describe("רגעים להקפיץ בהם אנימציה"),
  caption_style: z.enum(["word-pop", "highlight-box", "one-word", "karaoke", "bold-pop", "minimal"]),
  accent: z.enum(["#facc15", "#22d3ee", "#a3e635", "#f472b6", "#fb923c", "#ffffff"]),
  caption_font: z.enum(["heebo", "rubik", "secular", "suez", "frank", "varela", "amatic", "karantina", "assistant", "fredoka", "playpen", "bellefair", "ibmplex"]).default("secular")
    .describe("גופן לכתוביות: secular/rubik נקיים ובולטים, karantina צר ודרמטי, frank ספרותי, amatic כתב יד, varela רך"),
  template: z.enum(["talking", "tips", "before-after", "energy"]),
  color_style: z.enum(["none", "cinematic", "vivid", "warm", "cold", "vintage", "matte", "bw", "noir"]),
  cta: z.string().describe("קריאה לפעולה קצרה לסוף הסרטון, או מחרוזת ריקה אם לא מתאים"),
  summary: z.string().describe("משפט או שניים בעברית: מה נעשה בעריכה ולמה"),
  inserts: z.array(z.object({
    insert: z.number().int().describe("מספר הקובץ הנוסף (צילום מסך / תמונה / קטע)"),
    segment: z.number().int().describe("המקטע בדיבור שבו הוא נכנס (כשמדברים עליו)"),
    seconds: z.number().describe("כמה זמן על המסך"),
    layout: z.enum(["full", "top", "pip"]).describe("full: כל המסך; top: חצי עליון והמדברת למטה; pip: חלון קטן"),
  })).default([]).describe("איפה כל קובץ נוסף נכנס בסרטון"),
});

export type SmartPlan = z.infer<typeof SmartPlanSchema>;

export interface SmartPlanRequest {
  /** מקטעי התמלול לפי הסדר, בזמני ציר הזמן */
  segments: { start: number; end: number; text: string }[];
  duration: number;
  hasMusic: boolean;
  /** ההוראות שנכתבו לעורך */
  notes?: string;
  /** קבצים נוספים (צילומי מסך, תמונות, קטעים בלי דיבור) שצריך לשלב בסרטון */
  inserts?: { kind: "image" | "video"; name: string; seconds: number; image: string | null }[];
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

/** שלוש הצעות למשפט הפתיחה (ההוק) */
export const HooksSchema = z.object({
  hooks: z.array(z.string()).describe("שלושה משפטי פתיחה שונים, עד 8 מילים כל אחד"),
});

export interface HooksRequest {
  /** סוג הסרטון, ההוראות, התמלול ותקציר העריכה */
  context: string;
  current?: string;
}

/**
 * "הבמאי": המוח צופה בסרטונים עצמם (תמונה, תנועה וסאונד) ובונה רשימת עריכה כמו
 * עורך אנושי: אילו רגעים, באיזה סדר, ואיפה להשאיר את הסאונד המקורי.
 */
export const DirectorPlanSchema = z.object({
  understanding: z.string().describe("משפט או שניים בעברית: מה רואים ושומעים בצילומים"),
  shots: z.array(z.object({
    clip: z.number().int().describe("מספר הסרטון (1 והלאה)"),
    start: z.number().describe("תחילת הרגע, בשניות מתחילת אותו סרטון"),
    end: z.number().describe("סוף הרגע, בשניות מתחילת אותו סרטון"),
    sound: z.boolean().default(false).describe("true אם הסאונד המקורי חשוב ברגע הזה (צחוק, משפט, תגובה, רעש מיוחד)"),
  })).describe("הרגעים לסרטון, לפי הסדר שבו יופיעו"),
  music: z.enum(["happy", "chill", "energetic", "inspiring", "pop", "hiphop", "romantic", "cinematic", "acoustic"]),
  color_style: z.enum(["none", "cinematic", "vivid", "warm", "cold", "vintage", "matte", "bw", "noir"]),
  title: z.string().describe("שם קצר לפרויקט"),
  text: z.string().describe("טקסט פתיחה קצר על המסך (עד 6 מילים), או מחרוזת ריקה"),
  target_seconds: z.number().default(0),
  summary: z.string().describe("משפט או שניים בעברית: מה נבחר ולמה, כמו עורך שמסביר"),
});

export type DirectorPlan = z.infer<typeof DirectorPlanSchema>;

export interface DirectorRequest {
  clips: { duration: number; video: string }[];
  target: number;
  hasMusic: boolean;
  notes?: string;
}
