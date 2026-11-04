import type { MusicMood } from "@/lib/music/moods";

/** סוג הסרטון, לפי השאלה "מה הסרטון?". קובע איך העריכה האוטומטית עובדת */
export type VideoGenre = "auto" | "talking" | "vibe" | "product" | "recipe";

export interface GenreInfo {
  id: VideoGenre;
  emoji: string;
  label: string;
  /** איזה סוג עריכה: דיבור, אווירה, או לזהות לבד לפי הסאונד */
  mode: "auto" | "talking" | "vibe";
  /** מה המוח (Gemini) צריך לדעת על הסרטון. נוסף להוראות שנכתבו לעורך */
  hint: string;
  /** מוזיקה כשאין הנחיה אחרת */
  mood: MusicMood;
}

export const GENRES: GenreInfo[] = [
  { id: "talking", emoji: "🎤", label: "מדברת למצלמה", mode: "talking", mood: "happy",
    hint: "זה סרטון דיבור למצלמה. חשוב שהדיבור יהיה ברור וזורם, והוק חזק בשניות הראשונות." },
  { id: "vibe", emoji: "🌴", label: "וייב או טיול", mode: "vibe", mood: "chill",
    hint: "זה סרטון וייב או טיול: רגעים יפים, אווירה ותחושה. לבחור את הצילומים הכי יפים ומרשימים, ולפתוח עם הכי מרשים." },
  { id: "product", emoji: "🛍️", label: "מוצר או עסק", mode: "auto", mood: "pop",
    hint: "זה סרטון על מוצר או עסק. להבליט את המוצר ואת היתרון שלו, הוק שגורם לרצות אותו, ובסוף קריאה לפעולה (למשל: לשלוח הודעה, קישור בביו)." },
  { id: "recipe", emoji: "🍳", label: "מתכון", mode: "auto", mood: "happy",
    hint: "זה סרטון מתכון. לשמור על סדר שלבי ההכנה כמו שצולמו, להתחיל ברגע מגרה של התוצאה, וטקסט על המסך עם שם המנה." },
];

export const genreInfo = (id: VideoGenre | null | undefined) => GENRES.find((g) => g.id === id) ?? null;
