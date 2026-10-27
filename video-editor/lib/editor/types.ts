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
  origin: "sample" | "upload" | "ai_variant";
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
  | null;

/** הפרויקט כפי שהוא נשמר (בדפדפן או בטבלת projects) */
export interface SavedProject {
  title: string;
  timeline: Timeline;
  assets: Record<string, MediaAsset>;
  variants: Record<string, Variant>;
}
