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
  /** קרדיט ליוצר (מוזיקה מהספרייה החינמית, ברישיון שדורש ייחוס) */
  credit?: string;
  /** קצב ידוע מראש (מוזיקה מובנית); אחרת מזוהה מהסאונד */
  bpm?: number;
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
  /**
   * נקודת המיקוד כשהסרטון לא באותו יחס כמו המסך (למשל צולם לרוחב והמסך עומד):
   * איזה חלק מהתמונה נשאר במסגרת. 0..1, ברירת מחדל 0.5 (מרכז)
   */
  focusX?: number;
  focusY?: number;
  /** מהירות: 0.25 (הילוך איטי) עד 4. האורך בציר הזמן הוא (out - in) / speed */
  speed?: number;
  /** המעבר מהקליפ הקודם אל הקליפ הזה */
  transitionIn?: Transition;
  /** תנועת מצלמה על כל הקליפ */
  effect?: ClipEffect;
  /** התאמות תמונה, כל אחת בין -1 ל-1 (0 = בלי שינוי) */
  adjust?: Adjust;
  /** כשהסרטון לא ממלא את המסך: חיתוך (ברירת מחדל) או רקע מטושטש מאותו סרטון */
  fill?: "crop" | "blur";
}

export type TransitionType = "fade" | "slide" | "zoom" | "blur" | "flash" | "punch" | "glitch" | "whip";
export interface Transition { type: TransitionType; /** שניות */ duration: number }

export type ClipEffect = "none" | "zoom-in" | "zoom-out" | "pan-left" | "pan-right" | "shake" | "pulse";

export interface Adjust { brightness: number; contrast: number; saturation: number; warmth: number }

/** אנימציית כניסה של טקסט או אימוג'י */
export type OverlayAnimIn = "pop" | "bounce" | "slide-up" | "slide-side" | "zoom" | "typewriter" | "fade" | "none";
/** תנועה חוזרת כל עוד הפריט על המסך */
export type OverlayLoop = "none" | "pulse" | "wiggle" | "float" | "shake";
export type OverlayAnimOut = "fade" | "pop" | "slide-down" | "none";

/** טקסט או אימוג'י שמונח מעל הווידאו, עם אנימציה */
export interface Overlay {
  /** נוסף מתבנית (מוחלף כשבוחרים תבנית אחרת) */
  fromTemplate?: boolean;
  /** משפט הפתיחה (ההוק): אפשר להחליף אותו בלחיצה באחת ההצעות */
  hook?: boolean;
  /** אנימציה שהעורך הקפיץ ברגע חשוב בדיבור (מתחלפת כשמשנים את כמות האנימציות) */
  moment?: boolean;
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
  /** גופן (מזהה מ-lib/editor/fonts). בלי: הגופן הרגיל */
  font?: string;
  rotate: number;
  animIn: OverlayAnimIn;
  loop: OverlayLoop;
  animOut: OverlayAnimOut;
}

/** קטע שמע במסלול הסאונד: מוזיקת רקע או אפקט */
export interface AudioClip {
  /** נוסף מתבנית (מוחלף כשבוחרים תבנית אחרת) */
  fromTemplate?: boolean;
  /** שיר שהעריכה האוטומטית בחרה (מוחלף בעריכה אוטומטית חוזרת) */
  auto?: boolean;
  /** צליל קטן של אנימציה ברגע חשוב */
  moment?: boolean;
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

export type CaptionPreset = "word-pop" | "highlight-box" | "one-word" | "bold-pop" | "karaoke" | "minimal";

export interface Caption {
  id: string;
  start: number;
  end: number;
  text: string;
  preset: CaptionPreset;
  /** צבע ההדגשה של המילה הנאמרת (ברירת מחדל: צהוב) */
  accent?: string;
  /** גובה על המסך, 0 (למעלה) עד 1 (למטה). ברירת מחדל 0.78 */
  y?: number;
  /** גופן (מזהה מ-lib/editor/fonts) */
  font?: string;
  /** גודל יחסי (1 = רגיל) */
  size?: number;
  /** צבע הטקסט (ברירת מחדל לבן) */
  color?: string;
  /** קו מתאר סביב האותיות */
  outline?: "none" | "thin" | "bold";
  /** רקע מאחורי הכתובית */
  box?: "none" | "dark" | "light";
}

/** מסלול הווידאו "מגנטי": קליפים צמודים זה לזה, והמיקום נגזר מהסדר */
export type CaptionStyle = Pick<Caption, "preset" | "accent" | "y" | "font" | "size" | "color" | "outline" | "box">;

export type AnimationLevel = "none" | "some" | "lots";

/** רגע חשוב בדיבור: מילת מפתח, מספר, שלב ברשימה, או רגש לאימוג'י */
export interface Moment {
  captionId: string;
  kind: "keyword" | "number" | "step" | "emoji";
  /** מה להקפיץ: 1-3 מילים, מספר, "טיפ 2", או אימוג'י */
  text: string;
  /** 3 = הכי חשוב */
  importance: number;
}

/** כמה "רעש" במעברים ובתנועה: בלי, נקי, דינמי או מוגזם */
export type TransitionStyle = "none" | "clean" | "dynamic" | "extreme";

export interface Timeline {
  /** סגנון המעברים שהעריכה האוטומטית משתמשת בו (ברירת מחדל: נקי) */
  transitionStyle?: TransitionStyle;
  /** הסגנון לכתוביות חדשות (מתבנית או מהבחירה האחרונה) */
  captionStyle?: CaptionStyle;
  /** הצילומים המקוריים, לפני העריכה האוטומטית: עריכה חוזרת מתחילה מהם ולא מהגרסה הערוכה */
  raw?: Clip[];
  /** כמה אנימציות להקפיץ ברגעים החשובים בדיבור */
  animationLevel?: AnimationLevel;
  /** הרגעים החשובים שהעורך מצא (מהם נבנות האנימציות, לפי הכמות שנבחרה) */
  moments?: Moment[];
  /** זום קצר פנימה ברגעים של הדגשה (כמו עורך שמקרב לפנים במשפט חשוב) */
  zooms?: { start: number; end: number; scale: number }[];
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
  /** הוראות והערות לעורך (נשלחות ל-Claude בעריכה האוטומטית) */
  notes?: string;
  timeline: Timeline;
  assets: Record<string, MediaAsset>;
  variants: Record<string, Variant>;
}
