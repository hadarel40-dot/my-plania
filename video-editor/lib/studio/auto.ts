import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ACCOUNTS, DEFAULT_VOICE, type Account, type Draft, type DraftData, type Niche, type TrendItem, type VoiceProfile } from "./config";
import { writeCarousel, writeHooks, writeScript } from "./engine";
import { planWeek } from "./insights";
import { todayIL, voiceBlock } from "./server";

/**
 * תוכן אוטומטי: כל בוקר רעיונות לתור, ואז טיוטה אחת בכל ריצה (הוקים ותסריט, או קרוסלה),
 * שמשובצת ביום הפנוי הבא. לא מפרסם, ונוגע רק בפריטים שנוצרו אוטומטית (auto = true).
 * רץ בשלבים קטנים, כי לכל ריצה בשרת יש דקה.
 */

export interface AutoItem {
  id: string; title: string; account: Account; niche: Niche | null; format: string; stage: string;
  planned_date: string | null; notes: string; auto: boolean; draft_id: string | null; created_at: string;
}
export interface AutoContext { items: AutoItem[]; voice: Partial<Record<Account, Partial<VoiceProfile>>>; trends: TrendItem[] }
export interface AutoStore {
  context(): Promise<AutoContext>;
  addItems(items: { title: string; account: Account; niche: Niche; format: string; notes: string }[]): Promise<number>;
  addDraft(itemId: string, draft: { idea: string; account: Account; niche: Niche | null; mode: Draft["mode"]; data: DraftData; hook: string; caption: string }, planned: string): Promise<string>;
}

const IDEAS_PER_DAY = 5;
const DRAFTS_AHEAD = 7;

function voiceFor(ctx: AutoContext, account: Account) {
  const v = { ...DEFAULT_VOICE };
  for (const [k, val] of Object.entries(ctx.voice[account] ?? {})) {
    if (val === null || val === undefined || val === "" || (Array.isArray(val) && !val.length)) continue;
    (v as Record<string, unknown>)[k] = val;
  }
  return voiceBlock(v, account);
}

/** היום הפנוי הבא בשבוע הקרוב, החל ממחר */
function nextFreeDay(items: AutoItem[]) {
  for (let i = 1; i <= DRAFTS_AHEAD; i++) {
    const day = todayIL(i);
    if (!items.some((it) => it.planned_date === day && it.stage !== "published")) return day;
  }
  return null;
}

export async function autoIdeas(store: AutoStore) {
  const ctx = await store.context();
  const today = todayIL();
  const madeToday = ctx.items.filter((i) => i.auto && i.created_at.slice(0, 10) >= todayIL(-1) && i.created_at.slice(0, 10) <= today).length;
  const open = ctx.items.filter((i) => i.auto && i.stage === "idea" && !i.draft_id).length;
  if (madeToday >= IDEAS_PER_DAY || open >= IDEAS_PER_DAY) return { skipped: "יש מספיק רעיונות אוטומטיים פתוחים" };
  const ideas = await planWeek({ focus: "", trends: ctx.trends, existing: ctx.items.map((i) => i.title) });
  const added = await store.addItems(ideas.map((i) => ({ title: i.title, account: i.account, niche: i.niche, format: i.format, notes: `${i.idea}\n\nלמה: ${i.why}` })));
  return { added };
}

export async function autoDraft(store: AutoStore) {
  const ctx = await store.context();
  const day = nextFreeDay(ctx.items);
  if (!day) return { skipped: "השבוע הקרוב כבר מלא" };
  const item = ctx.items.find((i) => i.auto && i.stage === "idea" && !i.draft_id);
  if (!item) return { skipped: "אין רעיון אוטומטי פתוח" };

  const account = (ACCOUNTS.some((a) => a.value === item.account) ? item.account : "hadarelifergan") as Account;
  const idea = item.notes ? item.notes.split("\n\nלמה:")[0] : item.title;
  const mode: Draft["mode"] = item.format === "carousel" ? "carousel" : "full";
  const base: Draft = { id: "", idea, account, niche: item.niche, mode, facts: "", data: {}, project_id: null, created_at: "", updated_at: "" };
  const voice = voiceFor(ctx, account);

  let data: DraftData;
  if (mode === "carousel") {
    data = await writeCarousel(base, voice);
  } else {
    const hooks = await writeHooks(base, voice);
    data = await writeScript({ ...base, data: hooks }, voice, 0);
  }
  const hook = mode === "carousel" ? data.carousel?.slides[0]?.headline ?? "" : data.hooks?.[0]?.spoken ?? "";
  const caption = mode === "carousel" ? data.carousel?.caption ?? "" : data.script?.caption_first_line ?? "";
  const draftId = await store.addDraft(item.id, { idea, account, niche: item.niche, mode, data, hook, caption }, day);
  return { draftId, day, title: item.title };
}

/** בתוך הסטודיו: המנהלת מחוברת, וההרשאות של המסד חלות */
export function adminStore(supabase: SupabaseClient): AutoStore {
  return {
    async context() {
      const [{ data: items }, { data: voice }, { data: trend }] = await Promise.all([
        supabase.from("studio_items").select("id, title, account, niche, format, stage, planned_date, notes, auto, draft_id, created_at").order("created_at", { ascending: false }).limit(300),
        supabase.from("studio_voice").select("account, profile"),
        supabase.from("studio_trends").select("items").eq("status", "done").order("date", { ascending: false }).limit(1).maybeSingle(),
      ]);
      return {
        items: (items ?? []) as AutoItem[],
        voice: Object.fromEntries((voice ?? []).map((v) => [v.account, v.profile])),
        trends: (trend?.items ?? []) as TrendItem[],
      };
    },
    async addItems(items) {
      const { data, error } = await supabase.from("studio_items").insert(items.map((i) => ({ ...i, stage: "idea", auto: true }))).select("id");
      if (error) throw new Error(error.message);
      return data?.length ?? 0;
    },
    async addDraft(itemId, d, planned) {
      const { data, error } = await supabase.from("studio_drafts").insert({ idea: d.idea, account: d.account, niche: d.niche, mode: d.mode, facts: "", data: d.data }).select("id").single();
      if (error) throw new Error(error.message);
      const { error: e2 } = await supabase.from("studio_items").update({ draft_id: data.id, stage: "draft", planned_date: planned, hook: d.hook.slice(0, 500), caption: d.caption.slice(0, 4000) })
        .eq("id", itemId).eq("auto", true).eq("stage", "idea");
      if (e2) throw new Error(e2.message);
      return data.id as string;
    },
  };
}

/** במשימה של הבוקר: בלי משתמשת מחוברת, רק דרך הפונקציות במסד שבודקות את הסוד */
export function cronStore(db: SupabaseClient, secret: string): AutoStore {
  const rpc = async <T>(fn: string, args: Record<string, unknown>) => {
    const { data, error } = await db.rpc(fn, { p_secret: secret, ...args });
    if (error) throw new Error(error.message);
    return data as T;
  };
  return {
    context: () => rpc<AutoContext>("studio_cron_context", {}),
    addItems: (items) => rpc<number>("studio_cron_add_items", { p_items: items }),
    addDraft: (itemId, d, planned) => rpc<string>("studio_cron_add_draft", { p_item_id: itemId, p_draft: d, p_planned: planned }),
  };
}
