import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { askBrain } from "@/lib/ai/brain";
import { cleanDeep } from "./clean";
import { CONTENT_TYPES, labelOf, type Account, type Draft, type Learnings, type PublishedPost } from "./config";
import { loadAccount, type IgMedia } from "./instagram";
import { variantLabel } from "./reel-timeline";

/**
 * לומדים מהפוסטים שפורסמו:
 * 1. כל פריט בלוח מוצא את הפוסט שלו באינסטגרם לפי הכיתוב (היא מפרסמת ידנית, אז אין מזהה משותף).
 * 2. המספרים של הפוסט נשמרים בטיוטה, ליד סוג התוכן, הגרסה וההוק.
 * 3. מהטבלה הזאת יוצאות מסקנות, כל אחת עם הראיה מהמספרים. הן נכנסות לקול של החשבון,
 *    וכל כתיבה (קרוסלה, ריל, תכנון השבוע) משתמשת בהן.
 * שום דבר כאן לא מפרסם ולא משנה שלב של פריט.
 */

const norm = (s: string) => s.replace(/#[^\s#]+/g, " ").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim().toLowerCase();
const words = (s: string) => new Set(norm(s).split(" ").filter((w) => w.length > 1));

/** כמה הכיתובים דומים: חפיפת מילים בשלוש השורות הראשונות, ובונוס אם השורה הראשונה זהה */
export function captionScore(ours: string, theirs: string) {
  const head = (s: string) => s.split("\n").filter((l) => l.trim()).slice(0, 3).join(" ");
  const a = words(head(ours)), b = words(head(theirs));
  if (!a.size || !b.size) return 0;
  let both = 0;
  for (const w of a) if (b.has(w)) both++;
  const overlap = both / Math.min(a.size, b.size);
  const firstSame = norm(ours.split("\n")[0]).slice(0, 40) === norm(theirs.split("\n")[0]).slice(0, 40) ? 0.3 : 0;
  return Math.min(1, overlap + firstSame);
}

const statsOf = (m: IgMedia): PublishedPost["stats"] => ({
  reach: m.insights?.reach, views: m.insights?.views, saved: m.insights?.saved, shares: m.insights?.shares,
  likes: m.like_count, comments: m.comments_count,
});
const toPublished = (m: IgMedia): PublishedPost => ({
  media_id: m.id, permalink: m.permalink, posted_at: m.timestamp, type: m.media_product_type ?? m.media_type, stats: statsOf(m), updated_at: new Date().toISOString(),
});

interface Item { id: string; title: string; caption: string; planned_date: string | null; ig_permalink: string; draft_id: string | null; format: string; content_type?: string | null }

/** מחבר פריטים לפוסטים ומעדכן את המספרים. מחזיר את מה שמחובר עכשיו */
export async function matchPublished(supabase: SupabaseClient, account: Account) {
  const ig = await loadAccount(account, { limit: 40, insights: true });
  if (!ig) return { connected: false as const };
  const media = ig.media;
  const { data: items } = await supabase.from("studio_items").select("id, title, caption, planned_date, ig_permalink, draft_id, format, content_type").eq("account", account).not("draft_id", "is", null);
  const ids = (items ?? []).map((i) => i.draft_id as string);
  const { data: drafts } = ids.length ? await supabase.from("studio_drafts").select("*").in("id", ids) : { data: [] };
  const byDraft = new Map((drafts ?? []).map((d) => [d.id as string, d as Draft]));
  const taken = new Set<string>();
  const linked: { item: Item; draft: Draft; post: PublishedPost; matchedNow: boolean }[] = [];

  // קודם מה שכבר מחובר (או שהיא הדביקה קישור), אחר כך חיפוש לפי הכיתוב
  const ordered = ((items ?? []) as Item[]).sort((a, b) => Number(!!b.ig_permalink) - Number(!!a.ig_permalink));
  for (const item of ordered) {
    const draft = byDraft.get(item.draft_id!);
    if (!draft) continue;
    const reject = new Set(draft.data.published_reject ?? []);
    const known = draft.data.published?.media_id;
    let post = media.find((m) => (known && m.id === known) || (item.ig_permalink && m.permalink.replace(/\/$/, "") === item.ig_permalink.replace(/\/$/, "")));
    let matchedNow = false;
    if (!post) {
      const caption = draft.data.carousel?.caption || draft.data.caption || item.caption;
      if (!caption) continue;
      const from = item.planned_date ? new Date(`${item.planned_date}T00:00:00`).getTime() - 3 * 864e5 : 0;
      const best = media
        .filter((m) => !taken.has(m.id) && !reject.has(m.id) && new Date(m.timestamp).getTime() >= from)
        .map((m) => ({ m, s: captionScore(caption, m.caption ?? "") }))
        .sort((a, b) => b.s - a.s)[0];
      if (!best || best.s < 0.55) continue;
      post = best.m;
      matchedNow = true;
    }
    taken.add(post.id);
    const published = toPublished(post);
    await supabase.from("studio_drafts").update({ data: { ...draft.data, published } }).eq("id", draft.id);
    if (item.ig_permalink !== post.permalink) await supabase.from("studio_items").update({ ig_permalink: post.permalink }).eq("id", item.id);
    linked.push({ item, draft: { ...draft, data: { ...draft.data, published } }, post: published, matchedNow });
  }
  // הממוצע של כל הפוסטים בחשבון, כדי לדעת אם פוסט עבד "טוב" יחסית אליה ולא סתם
  const avg = (k: keyof PublishedPost["stats"]) => {
    const v = media.map((m) => statsOf(m)[k]).filter((x): x is number => typeof x === "number");
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
  };
  const baseline = { posts: media.length, reach: avg("reach"), views: avg("views"), saved: avg("saved"), shares: avg("shares"), likes: avg("likes"), comments: avg("comments") };
  return { connected: true as const, linked, baseline, insightsAvailable: ig.insightsAvailable };
}

const LearnSchema = z.object({
  works: z.array(z.string()).max(4),
  stop: z.array(z.string()).max(3),
  try_next: z.array(z.string()).max(3),
});

const DAY = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

/** מסקנות מהפוסטים המחוברים. פחות משלושה פוסטים: אין מספיק כדי ללמוד, לא ממציאים */
export async function learnFromPosts(rows: Awaited<ReturnType<typeof matchPublished>> & { connected: true }): Promise<Learnings | null> {
  if (rows.linked.length < 3) return null;
  const table = rows.linked.map(({ item, draft, post }) => {
    const d = new Date(post.posted_at);
    const local = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
    return {
      title: item.title,
      format: item.format === "carousel" ? "קרוסלה" : "ריל",
      content_type: labelOf(CONTENT_TYPES, item.content_type || draft.data.content_type || ""),
      version: draft.data.edit ? variantLabel(draft.data.chosen_variant) : draft.data.chosen_variant ?? null,
      hook: draft.data.carousel?.slides[0]?.headline ?? draft.data.hooks?.[draft.data.chosen ?? 0]?.spoken ?? null,
      slides: draft.data.carousel?.slides.length ?? null,
      seconds: draft.data.video?.seconds ?? null,
      own_video: !!(draft.data as { own_video?: boolean }).own_video,
      posted: `${DAY[local.getDay()]} ${String(local.getHours()).padStart(2, "0")}:00`,
      ...post.stats,
    };
  });
  const out = cleanDeep(await askBrain({
    prefer: "claude", schema: LearnSchema,
    system: "את אנליסטית סושיאל. עברית פשוטה, בלי אימוג'י, בלי מקפים ארוכים. כל מסקנה חייבת להישען על המספרים בטבלה, ולציין אותם. אסור להמציא מספרים או להסיק ממה שאין בטבלה. כשההבדל קטן או שיש מעט פוסטים, תגידי שזה כיוון ולא הוכחה.",
    parts: [{ text: `הפוסטים שהסטודיו הכין והיא פרסמה, עם המספרים מאינסטגרם:
${JSON.stringify(table)}

הממוצע של כל הפוסטים בחשבון (${rows.baseline.posts} פוסטים): ${JSON.stringify(rows.baseline)}
${rows.insightsAvailable ? "" : "אין הרשאה לנתוני חשיפה, שמירות ושיתופים. רק לייקים ותגובות."}

החזירי:
works: עד 4 דברים שעבדו (סוג תוכן, פורמט, גרסת כתוביות, סוג הוק, אורך, יום ושעה), כל אחד במשפט אחד עם המספר שמראה את זה.
stop: עד 3 דברים שכדאי להפסיק, עם המספר.
try_next: עד 3 ניסויים לשבוע הבא שנובעים מזה.
אם אין דפוס ברור, השאירי רשימה ריקה.` }],
  }));
  return { at: new Date().toISOString(), posts: table.length, ...out };
}

/** שומר את המסקנות בקול של החשבון, בלי לגעת בשאר הפרופיל */
export async function saveLearnings(supabase: SupabaseClient, account: Account, learnings: Learnings) {
  const { data } = await supabase.from("studio_voice").select("profile").eq("account", account).maybeSingle();
  const { error } = await supabase.from("studio_voice").upsert({ account, profile: { ...((data?.profile as object) ?? {}), learnings } });
  if (error) throw new Error(error.message);
}
