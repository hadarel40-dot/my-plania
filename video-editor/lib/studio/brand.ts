/**
 * ערכת מותג ועיצוב לקרוסלות: פונטים בעברית וצבעים.
 * ערכת המותג נשמרת לכל חשבון (בפרופיל הקול, profile.brand), ועיצוב של קרוסלה מסוימת נשמר עליה (carousel.theme).
 */

/** פונטים מ-Google Fonts שתומכים בעברית. נטענים בסטודיו (layout) ובמנוע השבועי */
export const FONTS = [
  { family: "Assistant", label: "Assistant · נקי", weights: [600, 800] },
  { family: "Heebo", label: "Heebo · מודרני", weights: [500, 800] },
  { family: "Rubik", label: "Rubik · עגול", weights: [500, 800] },
  { family: "Varela Round", label: "Varela Round · רך", weights: [400] },
  { family: "Secular One", label: "Secular One · כותרת חזקה", weights: [400] },
  { family: "Suez One", label: "Suez One · סריף כבד", weights: [400] },
  { family: "Frank Ruhl Libre", label: "Frank Ruhl · סריף קלאסי", weights: [500, 900] },
  { family: "David Libre", label: "David Libre · ספרותי", weights: [500, 700] },
  { family: "Bellefair", label: "Bellefair · אלגנטי", weights: [400] },
  { family: "Amatic SC", label: "Amatic SC · כתב יד", weights: [700] },
  { family: "Karantina", label: "Karantina · צר ודרמטי", weights: [400, 700] },
  { family: "Noto Sans Hebrew", label: "Noto Sans · ניטרלי", weights: [500, 800] },
] as const;
export type FontFamily = (typeof FONTS)[number]["family"];

export const fontsHref = `https://fonts.googleapis.com/css2?${FONTS.map((f) => `family=${f.family.replace(/ /g, "+")}:wght@${f.weights.join(";")}`).join("&")}&display=swap`;

/** משקל מודגש של פונט (מה שקיים בו) */
export const boldOf = (family: string) => Math.max(...(FONTS.find((f) => f.family === family)?.weights ?? [700]));
export const regularOf = (family: string) => Math.min(...(FONTS.find((f) => f.family === family)?.weights ?? [400]));

/** עיצוב של קרוסלה. כל שדה לא חובה: מה שחסר נלקח מהסגנון (תמונה, שמנת, כהה, צהוב) */
export interface Theme {
  headFont?: string;
  bodyFont?: string;
  headColor?: string;
  bodyColor?: string;
  /** רקע לשקופית בלי תמונה */
  bg?: string;
  /** צבע הדגשה (נקודות ברשימה, קווים) */
  accent?: string;
  /** כמה להחשיך את התמונה: 0 עד 0.8 */
  overlay?: number;
  /** גודל הכותרת ביחס לרגיל: 0.7 עד 1.4 */
  headScale?: number;
  bodyScale?: number;
  /** יישור הטקסט */
  align?: "right" | "center";
  /** מיקום הטקסט בשקופית רגילה */
  position?: "bottom" | "center" | "top";
}

/** ערכת המותג של חשבון: פלטת צבעים ופונטים קבועים */
export interface BrandKit extends Theme {
  palette?: string[];
}

/** המראה של הקרוסלות שלה (כמו בפוסט "וככה פלניה נולדה"): כותרת ורודה, כתב יד לבן */
export const PHOTO_DEFAULT: Required<Pick<Theme, "headFont" | "bodyFont" | "headColor" | "bodyColor" | "bg" | "accent" | "overlay" | "headScale" | "bodyScale" | "align" | "position">> = {
  headFont: "Assistant", bodyFont: "Amatic SC", headColor: "#F7C9D6", bodyColor: "#FFFFFF", bg: "#2A2622", accent: "#F7C9D6",
  overlay: 0.45, headScale: 1, bodyScale: 1, align: "right", position: "bottom",
};

export const fontStack = (family: string | undefined, fallback: string) => (family ? `"${family}", ${fallback}` : fallback);
