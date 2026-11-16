import { SUPABASE_URL } from "@/lib/supabase/env";

/** מאגר התוכן לאינסטגרם: אותו מבנה כמו הטבלה content_items (מיגרציה 0006) */

export const CONTENT_BUCKET = "content";

export type Account = "plania.il" | "hadarelifergan";
export type Format = "reel" | "carousel" | "image" | "story";
export type Status = "idea" | "draft" | "approved" | "publishing" | "published" | "failed";

export interface MediaFile { path: string; type: "video" | "image" }

export interface ContentItem {
  id: string;
  account: Account;
  format: Format;
  status: Status;
  title: string;
  hook: string;
  script: string;
  caption: string;
  notes: string;
  media: MediaFile[];
  project_id: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  ig_media_id: string | null;
  ig_permalink: string | null;
  error: string | null;
  source: "manual" | "agent" | "import";
  created_at: string;
  updated_at: string;
}

export const ACCOUNTS: { id: Account; label: string; dot: string; ring: string; soft: string }[] = [
  { id: "plania.il", label: "@plania.il", dot: "bg-rose-400", ring: "ring-rose-400/60", soft: "bg-rose-400/10 text-rose-200" },
  { id: "hadarelifergan", label: "@hadarelifergan", dot: "bg-sky-400", ring: "ring-sky-400/60", soft: "bg-sky-400/10 text-sky-200" },
];
export const accountOf = (id: Account) => ACCOUNTS.find((a) => a.id === id) ?? ACCOUNTS[0];

export const FORMATS: { id: Format; label: string }[] = [
  { id: "reel", label: "ריל" },
  { id: "carousel", label: "קרוסלה" },
  { id: "image", label: "תמונה" },
  { id: "story", label: "סטורי" },
];
export const formatLabel = (f: Format) => FORMATS.find((x) => x.id === f)?.label ?? f;

/** הסדר הוא גם סדר העמודות בלוח */
export const STATUSES: { id: Status; label: string; pill: string }[] = [
  { id: "idea", label: "רעיון", pill: "bg-zinc-700/60 text-zinc-200" },
  { id: "draft", label: "טיוטה", pill: "bg-amber-400/15 text-amber-200" },
  { id: "approved", label: "מאושר לפרסום", pill: "bg-emerald-400/15 text-emerald-200" },
  { id: "publishing", label: "בפרסום", pill: "bg-violet-400/20 text-violet-200" },
  { id: "published", label: "פורסם", pill: "bg-sky-400/15 text-sky-200" },
  { id: "failed", label: "נכשל", pill: "bg-red-500/15 text-red-200" },
];
export const statusOf = (s: Status) => STATUSES.find((x) => x.id === s) ?? STATUSES[0];

/** כתובת פתוחה לקובץ, כדי שאינסטגרם תוכל להוריד אותו */
export const publicUrl = (path: string) =>
  `${SUPABASE_URL}/storage/v1/object/public/${CONTENT_BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`;

export const CAPTION_MAX = 2200;
export const HASHTAG_MAX = 30;
export const countHashtags = (s: string) => (s.match(/#[^\s#]+/g) ?? []).length;

/** מה חסר כדי שהפוסט יוכל לצאת לבד. ריק = מוכן */
export function missingForPublish(item: Pick<ContentItem, "format" | "caption" | "media" | "scheduled_at">): string[] {
  const out: string[] = [];
  if (!item.media.length) out.push(item.format === "reel" || item.format === "story" ? "קובץ וידאו או תמונה" : "תמונות");
  if (item.format === "reel" && item.media.length && !item.media.some((m) => m.type === "video")) out.push("וידאו (ריל חייב להיות וידאו)");
  if (item.format === "carousel" && item.media.length < 2) out.push("לפחות 2 קבצים לקרוסלה");
  if (item.format === "carousel" && item.media.length > 10) out.push("עד 10 קבצים בקרוסלה");
  if (item.format !== "story" && !item.caption.trim()) out.push("כיתוב");
  if (!item.scheduled_at) out.push("תאריך ושעה");
  if (item.caption.length > CAPTION_MAX) out.push(`כיתוב קצר מ-${CAPTION_MAX} תווים`);
  if (countHashtags(item.caption) > HASHTAG_MAX) out.push(`עד ${HASHTAG_MAX} האשטגים`);
  return out;
}
