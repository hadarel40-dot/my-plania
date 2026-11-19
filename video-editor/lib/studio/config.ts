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
export interface Slide { kind: "cover" | "stake" | "point" | "recap" | "cta"; headline: string; body: string }
export interface Carousel { slides: Slide[]; caption: string; alt: string; handle: string }
export interface DraftData {
  carousel?: Carousel;
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
