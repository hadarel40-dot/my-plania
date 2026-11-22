import type { BrandKit, Theme } from "./brand";
/** סטודיו התוכן: הגדרות שמשותפות לדפדפן ולשרת */

export type Account = "hadarelifergan" | "plania.il";
export type Niche = "travel" | "business" | "home" | "meals";
export type Stage = "idea" | "draft" | "review" | "approved" | "published";

export const ACCOUNTS: { value: Account; label: string; niches: Niche[]; about: string }[] = [
  {
    value: "hadarelifergan",
    label: "@hadarelifergan",
    niches: ["travel", "business"],
    about: "העמוד האישי. בעיקר אישי, עם פרסום עדין לשירותים: תכנון טיולים עם אפליקציה אישית שכוללת את המסלול, ואתרים ומערכות דיגיטליות לעסקים קטנים.",
  },
  {
    value: "plania.il",
    label: "@plania.il",
    niches: ["home", "meals"],
    about: "העמוד העסקי של Plania, אפליקציה לתכנון השבוע והארוחות. מדברת לנשים צעירות שמנהלות בית, עבודה וילדים ומרגישות שיש להן מיליון דברים בראש.",
  },
];

export const NICHES: { value: Niche; label: string; account: Account; search: string }[] = [
  { value: "travel", label: "תכנון טיולים", account: "hadarelifergan", search: "תכנון טיולים (משפחות ישראליות, טיולים לחו\"ל ובארץ, מסלולים, תקציב, אפליקציות ומסמכים)" },
  { value: "business", label: "מערכות לעסקים קטנים", account: "hadarelifergan", search: "מערכות ואוטומציות לעסקים קטנים (אתרים, ניהול לקוחות, הצעות מחיר, כלים דיגיטליים לבעלות עסקים בישראל)" },
  { value: "home", label: "ארגון הבית", account: "plania.il", search: "ארגון הבית (שגרה, ניהול משק בית, הפרעת קשב בבית, רשימות, מערכות פשוטות לאמהות עובדות)" },
  { value: "meals", label: "תכנון ארוחות", account: "plania.il", search: "תכנון ארוחות (תפריט שבועי, רשימת קניות, הכנה מראש, מה מכינים היום, בישול משפחתי)" },
];

export const STAGES: { value: Stage; label: string }[] = [
  { value: "idea", label: "רעיון" },
  { value: "draft", label: "טיוטה" },
  { value: "review", label: "ממתין לאישור" },
  { value: "approved", label: "מאושר" },
  { value: "published", label: "פורסם" },
];

export const FORMATS = [
  { value: "reel", label: "ריל" },
  { value: "carousel", label: "קרוסלה" },
  { value: "story", label: "סטורי" },
  { value: "image", label: "תמונה" },
] as const;

export const TREND_KINDS: Record<string, string> = { format: "פורמט", audio: "אודיו", topic: "נושא", hook: "הוק" };
export const CHECK_LABELS: Record<string, string> = { length: "אורך", specificity: "ספציפיות", stakes: "סיכון", front: "חזית", direct: "פנייה ישירה" };

export const labelOf = (list: readonly { value: string; label: string }[], value?: string | null) =>
  list.find((x) => x.value === value)?.label ?? value ?? "";

export interface VoiceProfile {
  tone: string;
  sentence_style: string;
  favorite_words: string[];
  avoid_words: string[];
  rules: string[];
  audience?: string;
  offer?: string;
  /** ערכת המותג: פלטה ופונטים */
  brand?: BrandKit;
  /** מה למדנו מהפוסטים שפורסמו (מתעדכן מנתוני אינסטגרם) */
  learnings?: Learnings;
}

/** מסקנות מהביצועים: כל מסקנה עם הראיה מהמספרים האמיתיים */
export interface Learnings { at: string; posts: number; works: string[]; stop: string[]; try_next: string[] }

/** הפוסט באינסטגרם שהפריט הזה הפך אליו, עם המספרים שלו */
export interface PublishedPost {
  media_id: string; permalink: string; posted_at: string; type: string;
  stats: { reach?: number; views?: number; saved?: number; shares?: number; likes?: number; comments?: number };
  updated_at: string;
}

/** הקול כפי שנכתב ב-.claude/instagram/voice.md, עד שהפרופיל נבנה מהכיתובים ותוקן ידנית */
export const DEFAULT_VOICE: VoiceProfile = {
  tone: "כנה, אישית, חמה ופשוטה. סיפור מהחיים בגוף ראשון, בלי לייפות ובלי לשווק בכוח. מודה בקושי בגלוי ומראה איך יצאתי ממנו.",
  sentence_style: "משפטים קצרים בשפה מדוברת. כותרת אחת ועוד שורה קצרה שמשלימה אותה.",
  favorite_words: ["לא ממש", "פשוט", "ביום יום", "מיליון דברים בראש", "שבירת ראש", "התחלתי בקטן", "משהו אמיתי", "ממש לא", "ואז הבנתי", "וככה"],
  avoid_words: ["מהפכני", "משנה חיים", "הפתרון האולטימטיבי", "ז'רגון של מאמנים", "אנגלית מיותרת"],
  rules: ["ישיר, חם, פרקטי", "בלי קלישאות", "בלי אימוג'י", "בלי מקפים ארוכים", "רעיון אחד בכל פעם"],
};

export interface HookCheck { score: number; detail: string }
export interface Hook {
  formula: string;
  spoken: string;
  on_screen: string;
  why?: string;
  checks: Record<"length" | "specificity" | "stakes" | "front" | "direct", HookCheck>;
  weakest: string;
  flags: string[];
  score: number;
  ready: boolean;
}
export interface Beat { n: number; role: "hook" | "stakes" | "body" | "payoff" | "cta"; line: string; frame: string; card?: string; start: number; end: number; words: number }
export interface ScreenCard { text: string; start: number; end: number; y: number }
export interface Shot { n: number; frame: string; angle: string; seconds: number; says?: string; conditions: string; faceless: string }
export interface Check { id: string; label: string; pass: boolean; info?: boolean; detail: string }
/** תמונה לשקופית: קובץ שהעלתה (Supabase Storage) או קובץ מהדרייב */
export type SlideImage = { kind: "storage"; path: string } | { kind: "drive"; id: string };
export interface Slide { kind: "cover" | "stake" | "point" | "recap" | "cta"; headline: string; body: string; image?: SlideImage }
export interface Carousel { slides: Slide[]; caption: string; alt: string; handle: string; style?: "cream" | "ink" | "butter" | "photo"; theme?: Theme }
export interface MaterialFile { id: string; name: string; mimeType: string; duration?: number }
export interface Materials { files: MaterialFile[]; matches: { target: string; file_id: string; reason: string }[]; missing: string[]; checked_at: string }
/** ארבעת סוגי התוכן */
export const CONTENT_TYPES = [
  { value: "story", label: "סיפור אישי" },
  { value: "viral", label: "ויראלי" },
  { value: "value", label: "ערך" },
  { value: "trust", label: "אמון והוכחה" },
] as const;
export type ContentType = (typeof CONTENT_TYPES)[number]["value"];

/** סרטון מוכן שהתהליך השבועי יצר (ריל, או קרוסלה מונפשת) */
export interface ReadyVideo { path: string; cover?: string; seconds?: number }

/** גרסה אחת של פוסט (ריל או קרוסלה). היא בוחרת אחת ומשאירה הערה על כל גרסה */
export interface Variant { id: string; label: string; video?: ReadyVideo; carousel?: Carousel; comment?: string; reaction?: "like" | "dislike" }

/** הודעה בצ'אט עם המעצב */
export interface ChatMessage { role: "me" | "designer"; text: string; at: string }
/** בקשת שינוי בריל, שמחכה לעיבוד (רינדור הווידאו) */
export interface ReelRequest { text: string; changes: { card: number | null; action: string; detail: string }[]; status: "pending" | "done"; at: string }

/** הריל כחומר גלם לעורך: הקטעים לפי הסדר (באחסון) והכרטיסים בזמנים שלהם */
export interface ReelEditKit { /** הקול של הסרטונים נשמע (סרטון דיבור) */ sound?: boolean; segments: { path: string; seconds: number; width: number; height: number; from?: number }[]; cards: { text: string; start: number; end: number; headline?: string; body?: string }[] }

export interface DraftData {
  /** הריל המוכן כפרויקט לעריכה בעורך הווידאו */
  edit?: ReelEditKit;
  chat?: ChatMessage[];
  requests?: ReelRequest[];
  /** כמה גרסאות לבחירה, והגרסה שנבחרה */
  variants?: Variant[];
  chosen_variant?: string;
  /** הפוסט שפורסם באינסטגרם (נמצא לפי הכיתוב), והפוסטים שהיא אמרה שהם לא זה */
  published?: PublishedPost;
  /** עיצוב הכתוביות שנבחר בדשבורד (גופן, צבעים, גודל, מיקום) */
  reel_design?: import("./reel-timeline").ReelDesign;
  published_reject?: string[];
  /** הגרסאות הקודמות של הריל, כדי לבטל שינוי של המעצב */
  edit_history?: ReelEditKit[];
  /** קריינות שהוקלטה או הועלתה לריל */
  voiceover?: { path: string; seconds: number; volume?: number };
  /** סרטון מוכן לעלייה */
  video?: ReadyVideo;
  /** כיתוב לריל מוכן (לקרוסלה הכיתוב בתוך carousel) */
  caption?: string;
  content_type?: ContentType;
  /** תבנית מוכנה (lib/studio/templates.ts) */
  template?: string;
  carousel?: Carousel;
  /** הקרוסלות שלפני כל "לכתוב מחדש עם AI", האחרונה ראשונה (עד 5), כדי שאפשר לחזור אחורה */
  carousel_history?: Carousel[];
  materials?: Materials;
  hooks?: Hook[];
  chosen?: number;
  one_idea?: string;
  script?: { beats: Beat[]; total_seconds: number; total_words: number; echo_word: string; caption_first_line: string };
  cards?: ScreenCard[];
  shots?: Shot[];
  checklist?: string[];
  cta?: string;
  checks?: Check[];
}
export interface Draft { id: string; idea: string; account: Account; niche: Niche | null; mode: "full" | "short" | "carousel"; facts: string; data: DraftData; project_id: string | null; created_at: string; updated_at: string }

export interface TrendItem { niche: Niche; account: Account; kind: string; title: string; summary: string; source_name: string; source_url: string; why_relevant: string; reel_idea: string }

/** האזור הבטוח של אינסטגרם על מסגרת 1080x1920 */
export const SAFE = { width: 1080, height: 1920, top: 230, bottom: 1440, right: 230, cardX: 80, cardW: 770 };
