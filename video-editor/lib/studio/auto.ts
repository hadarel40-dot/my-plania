import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ACCOUNTS, DEFAULT_VOICE, type Account, type Draft, type DraftData, type Niche, type TrendItem, type VoiceProfile } from "./config";
import { writeCarousel, writeHooks, writeScript } from "./engine";
import { scoreHook } from "./hookscore";
import { generateSuggestions, preferencesBlock, type Feedback, type SuggestionOut } from "./insights";
import { todayIL, voiceBlock } from "./server";

/**
 * אוטומטי, אבל היא מחליטה:
 * - בוקר: הצעות חדשות (רעיון ושלושה הוקים) נכנסות ל"הצעות בשבילך". היא שומרת ומשבצת, או מסמנת "לא בשבילי".
 * - אחר כך: לפריט שהיא שמרה ושיבצה, הסטודיו מכין טיוטה (תסריט ושוטים, או קרוסלה) עם ההוק שהיא בחרה.
 * לא מפרסם, ונוגע רק בפריטים שנוצרו מהצעות (auto = true).
 */

export interface AutoItem {
  id: string; title: string; account: Account; niche: Niche | null; format: string; stage: string;
  planned_date: string | null; notes: string; auto: boolean; draft_id: string | null; created_at: string; hook?: string; hook_screen?: string;
}
export interface AutoContext {
  items: AutoItem[]; voice: Partial<Record<Account, Partial<VoiceProfile>>>; trends: TrendItem[];
  feedback: Feedback[]; suggested: string[]; open_suggestions: number;
}
export interface AutoStore {
  context(): Promise<AutoContext>;
  addSuggestions(items: SuggestionOut[]): Promise<number>;
  addDraft(itemId: string, draft: { idea: string; account: Account; niche: Niche | null; mode: Draft["mode"]; data: DraftData; hook: string; caption: string }, planned: string | null): Promise<string>;
}

const OPEN_LIMIT = 8;

function voiceFor(ctx: AutoContext, account: Account) {
  const v = { ...DEFAULT_VOICE };
  for (const [k, val] of Object.entries(ctx.voice[account] ?? {})) {
    if (val === null || val === undefined || val === "" || (Array.isArray(val) && !val.length)) continue;
    (v as Record<string, unknown>)[k] = val;
  }
  return voiceBlock(v, account);
}

export async function autoSuggest(store: AutoStore, count = 5, opts: { force?: boolean; focus?: string } = {}) {
  const ctx = await store.context();
  if (!opts.force && ctx.open_suggestions >= OPEN_LIMIT) return { skipped: "יש כבר הצעות שמחכות לך" };
  const voices = ACCOUNTS.map((a) => voiceFor(ctx, a.value)).join("\n\n");
  const existing = [...ctx.suggested, ...ctx.items.map((i) => i.title)];
  const suggestions = await generateSuggestions({ trends: ctx.trends, feedback: ctx.feedback, existing, voices, count, focus: opts.focus });
  return { added: await store.addSuggestions(suggestions) };
}

/** טיוטה לפריט הבא שהיא שמרה ושיבצה (התאריך הקרוב ביותר), עם ההוק שהיא בחרה */
export async function autoDraft(store: AutoStore) {
  const ctx = await store.context();
  const today = todayIL();
  const item = ctx.items
    .filter((i) => i.auto && i.stage === "idea" && !i.draft_id && i.planned_date && i.planned_date >= today)
    .sort((a, b) => (a.planned_date ?? "").localeCompare(b.planned_date ?? ""))[0];
  if (!item) return { skipped: "אין רעיון שמור ומשובץ שמחכה לטיוטה" };

  const account = (ACCOUNTS.some((a) => a.value === item.account) ? item.account : "hadarelifergan") as Account;
  const idea = item.notes ? item.notes.split("\n\nלמה:")[0] : item.title;
  const mode: Draft["mode"] = item.format === "carousel" ? "carousel" : "full";
  const base: Draft = { id: "", idea, account, niche: item.niche, mode, facts: "", data: {}, project_id: null, created_at: "", updated_at: "" };
  const voice = `${voiceFor(ctx, account)}\n\n${preferencesBlock(ctx.feedback)}`;

  let data: DraftData;
  if (mode === "carousel") {
    data = await writeCarousel(base, voice);
  } else if (item.hook) {
    // ההוק שהיא בחרה בהצעה
    const hook = { formula: "שנבחר", spoken: item.hook, on_screen: item.hook_screen || item.hook, ...scoreHook(item.hook) };
    data = await writeScript({ ...base, data: { hooks: [hook], chosen: 0 } }, voice, 0);
  } else {
    const hooks = await writeHooks(base, voice);
    data = await writeScript({ ...base, data: hooks }, voice, 0);
  }
  const hook = mode === "carousel" ? data.carousel?.slides[0]?.headline ?? "" : data.hooks?.[data.chosen ?? 0]?.spoken ?? "";
  const caption = mode === "carousel" ? data.carousel?.caption ?? "" : data.script?.caption_first_line ?? "";
  const draftId = await store.addDraft(item.id, { idea, account, niche: item.niche, mode, data, hook, caption }, item.planned_date);
  return { draftId, day: item.planned_date, title: item.title };
}

/** בתוך הסטודיו: המנהלת מחוברת, וההרשאות של המסד חלות */
export function adminStore(supabase: SupabaseClient): AutoStore {
  return {
    async context() {
      const [{ data: items }, { data: voice }, { data: trend }, { data: feedback }, { data: sugg }, { count }] = await Promise.all([
        supabase.from("studio_items").select("id, title, account, niche, format, stage, planned_date, notes, auto, draft_id, created_at, hook, hook_screen").order("created_at", { ascending: false }).limit(300),
        supabase.from("studio_voice").select("account, profile"),
        supabase.from("studio_trends").select("items").eq("status", "done").order("date", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("studio_feedback").select("kind, text, verdict, reason").order("created_at", { ascending: false }).limit(60),
        supabase.from("studio_suggestions").select("title").order("created_at", { ascending: false }).limit(60),
        supabase.from("studio_suggestions").select("id", { count: "exact", head: true }).eq("status", "new"),
      ]);
      return {
        items: (items ?? []) as AutoItem[],
        voice: Object.fromEntries((voice ?? []).map((v) => [v.account, v.profile])),
        trends: (trend?.items ?? []) as TrendItem[],
        feedback: (feedback ?? []) as Feedback[],
        suggested: (sugg ?? []).map((x) => x.title),
        open_suggestions: count ?? 0,
      };
    },
    async addSuggestions(items) {
      const { data, error } = await supabase.from("studio_suggestions").insert(items).select("id");
      if (error) throw new Error(error.message);
      return data?.length ?? 0;
    },
    async addDraft(itemId, d, planned) {
      const { data, error } = await supabase.from("studio_drafts").insert({ idea: d.idea, account: d.account, niche: d.niche, mode: d.mode, facts: "", data: d.data }).select("id").single();
      if (error) throw new Error(error.message);
      const { error: e2 } = await supabase.from("studio_items").update({ draft_id: data.id, stage: "draft", hook: d.hook.slice(0, 500), caption: d.caption.slice(0, 4000), ...(planned ? {} : { planned_date: todayIL(1) }) })
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
    addSuggestions: (items) => rpc<number>("studio_cron_add_suggestions", { p_items: items }),
    addDraft: (itemId, d, planned) => rpc<string>("studio_cron_add_draft", { p_item_id: itemId, p_draft: d, p_planned: planned }),
  };
}
