/** "המתכון" של הפרויקט. העורך משנה רק את המבנה הזה, אף פעם לא את קבצי המדיה. */

export type Aspect = "9:16" | "16:9" | "1:1";

export const ASPECT_SIZE: Record<Aspect, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
  "1:1": { width: 1080, height: 1080 },
};

export interface MediaAsset {
  id: string;
  name: string;
  /** בענן: כתובת ה-proxy (HLS/MP4 720p). בדמו: קובץ מקומי או blob: */
  url: string;
  thumbnailUrl: string | null;
  duration: number;
  width: number;
  height: number;
  origin: "sample" | "upload" | "ai_variant" | "library";
  /** וידאו (ברירת מחדל) או קובץ שמע: מוזיקה או אפקט סאונד */
  kind?: "video" | "audio";
  /** כתובת ציבורית בענן (למשל fal storage), כדי שמודלים יוכלו לקרוא את הקובץ */
  remoteUrl?: string;
  /** נתיב הקובץ ב-Supabase Storage (bucket media). כתובת הצפייה נחתמת מחדש בכל טעינה */
  storagePath?: string;
}

/** עיבוד ויזואלי שמוחל בזמן התצוגה. בדמו כך "מייצרים" וריאציות בלי ענן */
export interface Look {
  filter: string;
  zoom: number;
  flip: boolean;
}

export const NEUTRAL_LOOK: Look = { filter: "none", zoom: 1, flip: false };

export interface Clip {
  id: string;
  /** הקובץ המקורי שהקליפ נחתך ממנו. וריאציות תמיד נוצרות ממנו */
  sourceAssetId: string;
  /** הקובץ שמוצג כרגע: המקור או התוצאה של וריאציה שהוחלה */
  assetId: string;
  /** נקודת התחלה ונקודת סיום בתוך הקובץ, בשניות */
  in: number;
  out: number;
  look: Look;
  /** הוריאציה שהוחלה כרגע על הקליפ, אם יש */
  activeVariantId: string | null;
  /** עוצמת הסאונד המקורי של הקליפ, 0..1 (ברירת מחדל 1) */
  volume?: number;
}

/** אנימציית כניסה של טקסט או אימוג'י */
export type OverlayAnimIn = "pop" | "bounce" | "slide-up" | "slide-side" | "zoom" | "typewriter" | "fade" | "none";
/** תנועה חוזרת כל עוד הפריט על המסך */
export type OverlayLoop = "none" | "pulse" | "wiggle" | "float" | "shake";
export type OverlayAnimOut = "fade" | "pop" | "slide-down" | "none";

/** טקסט או אימוג'י שמונח מעל הווידאו, עם אנימציה */
export interface Overlay {
  id: string;
  kind: "text" | "emoji";
  text: string;
  start: number;
  end: number;
  /** מרכז הפריט, יחסי לגודל המסגרת (0..1) */
  x: number;
  y: number;
  /** גודל גופן בפיקסלים, ביחס למסגרת ברוחב 1080 */
  size: number;
  color: string;
  /** רקע "תווית" מאחורי הטקסט, או null בלי רקע */
  background: string | null;
  /** קו מתאר שחור סביב האותיות */
  stroke: boolean;
  weight: 400 | 700 | 900;
  rotate: number;
  animIn: OverlayAnimIn;
  loop: OverlayLoop;
  animOut: OverlayAnimOut;
}

/** קטע שמע במסלול הסאונד: מוזיקת רקע או אפקט */
export interface AudioClip {
  id: string;
  assetId: string;
  /** מיקום על ציר הזמן, בשניות */
  start: number;
  /** נקודות החיתוך בתוך הקובץ */
  in: number;
  out: number;
  volume: number;
  fadeIn: number;
  fadeOut: number;
}

export type CaptionPreset = "bold-pop" | "minimal" | "karaoke";

export interface Caption {
  id: string;
  start: number;
  end: number;
  text: string;
  preset: CaptionPreset;
}

/** מסלול הווידאו "מגנטי": קליפים צמודים זה לזה, והמיקום נגזר מהסדר */
export interface Timeline {
  fps: number;
  aspect: Aspect;
  clips: Clip[];
  captions: Caption[];
  overlays: Overlay[];
  audio: AudioClip[];
}

export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export interface VariantParams {
  prompt: string;
  style: string;
  strength: number;
  seed: number;
}

export interface Variant {
  id: string;
  clipId: string;
  label: string;
  status: JobStatus;
  progress: number;
  params: VariantParams;
  parentId: string | null;
  rating: -1 | 0 | 1;
  /** עבודה בצד השרת (variant_jobs). מאפשר להמשיך לעקוב אחריה אחרי רענון */
  jobId?: string;
  /** התוצאה מהענן: נכס חדש + look (בדמו: אותו נכס עם look שונה) */
  result: { assetId: string; look: Look } | null;
  createdAt: number;
}

export type Selection =
  | { kind: "clip"; id: string }
  | { kind: "caption"; id: string }
  | { kind: "overlay"; id: string }
  | { kind: "audio"; id: string }
  | null;

/** הפרויקט כפי שהוא נשמר (בדפדפן או בטבלת projects) */
export interface SavedProject {
  title: string;
  timeline: Timeline;
  assets: Record<string, MediaAsset>;
  variants: Record<string, Variant>;
}
