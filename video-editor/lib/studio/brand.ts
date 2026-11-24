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
  { family: "Gveret Levin", label: "גברת לוין · כתב יד", weights: [400] },
  { family: "Playpen Sans Hebrew", label: "Playpen · כתב יד עגול", weights: [400, 700] },
  { family: "Amatic SC", label: "Amatic SC · כתב יד צר", weights: [700] },
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
  /** מסגרת חמודה לטקסט: פתק נעוץ, פולרואיד, נייר קרוע, בועת דיבור, מחברת, או מסקינטייפ */
  card?: CardFrame;
  /** פריסה "השער שלי": כותרת ענקית למעלה (האות הראשונה בצבע הדגשה), ולמטה שורה מודגשת, שורה בכתב יד ושורה עם חץ */
  layout?: "split";
}

export type CardFrame = "note" | "polaroid" | "paper" | "bubble" | "notebook" | "tape";

/** ערכת המותג של חשבון: פלטת צבעים ופונטים קבועים */
export interface BrandKit extends Theme {
  palette?: string[];
  /** שורת הקריאה לפעולה שבסוף כל כיתוב (למשל: "הקישור בביו") */
  cta?: string;
  /** התגיות הקבועות, מופרדות ברווח */
  hashtags?: string;
}

/** הכיתוב עם הקריאה לפעולה והתגיות של החשבון: התגיות שהמודל כתב מוחלפות בקבועות */
export function applyCaptionDefaults(caption: string, kit?: BrandKit | null) {
  if (!kit?.cta && !kit?.hashtags) return caption;
  let text = caption.trim();
  if (kit.hashtags) text = text.replace(/(\s*#[^\s#]+)+\s*$/u, "").trim();
  if (kit.cta && !text.includes(kit.cta.trim())) text = `${text}\n${kit.cta.trim()}`;
  if (kit.hashtags) text = `${text}\n\n${kit.hashtags.trim().split(/\s+/).map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}`;
  return text;
}

/** המראה של הקרוסלות שלה (כמו בפוסט "וככה פלניה נולדה"): כותרת ורודה, כתב יד לבן */
export const PHOTO_DEFAULT: Required<Pick<Theme, "headFont" | "bodyFont" | "headColor" | "bodyColor" | "bg" | "accent" | "overlay" | "headScale" | "bodyScale" | "align" | "position">> = {
  headFont: "Assistant", bodyFont: "Amatic SC", headColor: "#F7C9D6", bodyColor: "#FFFFFF", bg: "#2A2622", accent: "#F7C9D6",
  overlay: 0.45, headScale: 1, bodyScale: 1, align: "right", position: "bottom",
};

/** כמה להגדיל טקסט בפונט הזה כדי שייראה באותו גודל כמו פונט רגיל (כתב יד נראה קטן יותר) */
export const sizeFactor = (family?: string) => (family === "Amatic SC" ? 1.65 : family === "Gveret Levin" ? 1.2 : 1);

export const fontStack = (family: string | undefined, fallback: string) => (family ? `"${family}", ${fallback}` : fallback);

/**
 * סגנונות מוכנים לקרוסלה עם תמונות: כל אחד הוא מראה שלם (פונטים, צבעים, החשכה, מיקום).
 * רקע הוא לשקופית בלי תמונה, ולכן הטקסט תמיד בניגוד אליו.
 */
export const SPLIT_LOOK: Theme = { layout: "split", headFont: "Rubik", bodyFont: "Gveret Levin", headColor: "#FBF3D8", bodyColor: "#FBF3D8", bg: "#2A2622", accent: "#E7A3CF", overlay: 0.3, headScale: 1, bodyScale: 1, align: "right", position: "bottom" };

export const LOOKS: { id: string; name: string; hint: string; theme: Theme }[] = [
  { id: "split", name: "השער שלי", hint: "כותרת ענקית, כתב יד וחץ", theme: SPLIT_LOOK },
  { id: "plania", name: "Plania's", hint: "ורוד בהיר וכתב יד", theme: { ...PHOTO_DEFAULT } },
  { id: "clean", name: "נקי ובהיר", hint: "לבן, פשוט, הרבה אוויר", theme: { headFont: "Assistant", bodyFont: "Assistant", headColor: "#FFFFFF", bodyColor: "#F4EEE6", bg: "#8C7B6B", accent: "#FFFFFF", overlay: 0.3, headScale: 0.95, bodyScale: 0.9, align: "center", position: "center" } },
  { id: "editorial", name: "מגזין", hint: "סריף אלגנטי, כמו כתבה", theme: { headFont: "Frank Ruhl Libre", bodyFont: "Assistant", headColor: "#FBF8F2", bodyColor: "#E9E2D6", bg: "#1F1B16", accent: "#F6E7A6", overlay: 0.5, headScale: 1.05, bodyScale: 0.95, align: "right", position: "bottom" } },
  { id: "oldmoney", name: "קלאסי", hint: "שמנת וזהב, שקט ויוקרתי", theme: { headFont: "Bellefair", bodyFont: "David Libre", headColor: "#F3E6C8", bodyColor: "#FBF8F2", bg: "#3B2F25", accent: "#C9A96E", overlay: 0.55, headScale: 1.1, bodyScale: 1, align: "center", position: "center" } },
  { id: "notes", name: "פתק בטלפון", hint: "כמו פתק שכתבת לעצמך", theme: { headFont: "Heebo", bodyFont: "Heebo", headColor: "#1F1B16", bodyColor: "#3A332B", bg: "#FFF8D9", accent: "#E8B23A", overlay: 0.05, headScale: 0.9, bodyScale: 0.9, align: "right", position: "top" } },
  { id: "noir", name: "ורוד כהה", hint: "כהה עם ורוד חזק", theme: { headFont: "Rubik", bodyFont: "Assistant", headColor: "#F7A8C0", bodyColor: "#FFFFFF", bg: "#1A1214", accent: "#F7A8C0", overlay: 0.65, headScale: 1.05, bodyScale: 0.95, align: "right", position: "bottom" } },
  { id: "pinned", name: "פתק נעוץ", hint: "פתק צהוב עם נעץ על התמונה", theme: { card: "note", headFont: "Playpen Sans Hebrew", bodyFont: "Playpen Sans Hebrew", headColor: "#2A2622", bodyColor: "#4E4540", bg: "#E9DFD3", accent: "#D9534F", overlay: 0.12, headScale: 1, bodyScale: 1, align: "right", position: "center" } },
  { id: "polaroid", name: "פולרואיד", hint: "תמונה במסגרת, כתב יד מתחת", theme: { card: "polaroid", headFont: "Playpen Sans Hebrew", bodyFont: "Assistant", headColor: "#2A2622", bodyColor: "#6A6158", bg: "#EFE6DC", accent: "#B5848E", overlay: 0, headScale: 1, bodyScale: 1, align: "center", position: "center" } },
  { id: "paper", name: "נייר קרוע", hint: "פיסת נייר עם מסקינטייפ", theme: { card: "paper", headFont: "Frank Ruhl Libre", bodyFont: "Assistant", headColor: "#1F1B16", bodyColor: "#4E4540", bg: "#D9CFC4", accent: "#E6D3A8", overlay: 0.15, headScale: 1, bodyScale: 1, align: "right", position: "bottom" } },
  { id: "bubble", name: "בועת דיבור", hint: "כאילו את אומרת את זה", theme: { card: "bubble", headFont: "Rubik", bodyFont: "Assistant", headColor: "#2A2622", bodyColor: "#4E4540", bg: "#F7C9D6", accent: "#FFFFFF", overlay: 0.1, headScale: 1, bodyScale: 1, align: "right", position: "top" } },
  { id: "notebook", name: "דף מחברת", hint: "שורות כחולות וקו אדום", theme: { card: "notebook", headFont: "Playpen Sans Hebrew", bodyFont: "Playpen Sans Hebrew", headColor: "#1F2A44", bodyColor: "#2F3B57", bg: "#E6E0D6", accent: "#E06A6A", overlay: 0.12, headScale: 0.95, bodyScale: 0.95, align: "right", position: "center" } },
  { id: "tape", name: "מסקינטייפ", hint: "כל שורה על פס דבק", theme: { card: "tape", headFont: "Secular One", bodyFont: "Assistant", headColor: "#2A2622", bodyColor: "#2A2622", bg: "#3B2F25", accent: "#EADBB8", overlay: 0.2, headScale: 1, bodyScale: 1, align: "right", position: "center" } },
  { id: "bold", name: "נועז", hint: "כותרת גדולה וצהובה", theme: { headFont: "Secular One", bodyFont: "Assistant", headColor: "#F6E7A6", bodyColor: "#FFFFFF", bg: "#5E1D1D", accent: "#F6E7A6", overlay: 0.5, headScale: 1.25, bodyScale: 0.95, align: "right", position: "center" } },
];
