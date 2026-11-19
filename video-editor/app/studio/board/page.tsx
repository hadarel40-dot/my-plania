"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { ACCOUNTS, FORMATS, NICHES, STAGES, labelOf, type Account, type Stage } from "@/lib/studio/config";
import { db, formatDate, studioCall } from "@/lib/studio/client";
import { Btn, Field, Loading, PageHead, Select, Tag, inputCls, toast } from "@/components/studio/ui";
import { VoiceSuggestions, type Suggestion } from "@/components/studio/voice-suggestions";

interface Item {
  id?: string; title: string; account: Account; niche: string | null; format: string; stage: Stage; planned_date: string | null;
  hook: string; caption: string; notes: string; draft_id: string | null; ig_permalink: string;
}

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const monthLabel = (key: string) => new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric" }).format(new Date(`${key}-15T12:00:00`));
const shiftMonth = (key: string, n: number) => { const [y, m] = key.split("-").map(Number); return monthKey(new Date(y, m - 1 + n, 15)); };

export default function BoardPage() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [account, setAccount] = useState<"all" | Account>("all");
  const [editing, setEditing] = useState<Item | null>(null);
  useEffect(() => {
    db().from("studio_items").select("*").order("planned_date", { nullsFirst: false }).limit(500).then(({ data }) => setItems((data as Item[]) ?? []));
  }, []);
  const visible = useMemo(() => (items ?? []).filter((i) => (account === "all" || i.account === account) && (!i.planned_date || i.planned_date.startsWith(month))), [items, month, account]);
  const save = (saved: Item) => setItems((all) => (all?.some((x) => x.id === saved.id) ? all.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...(all ?? [])]));

  // השלב משתנה רק כאן, בבחירה שלה, ואחרי אישור
  const move = async (item: Item, stage: Stage) => {
    if (stage === item.stage) return;
    if (!window.confirm(`להעביר את "${item.title}" ל"${labelOf(STAGES, stage)}"?`)) return;
    const { data, error } = await db().from("studio_items").update({ stage }).eq("id", item.id!).select("*").single();
    if (error) return toast(error.message, true);
    save(data as Item);
  };

  return (
    <>
      <PageHead title="לוח תוכן" sub="השלבים זזים רק כשאת מזיזה אותם. הסטודיו לא מפרסם כלום: הפרסום נשאר אצלך.">
        <Btn onClick={() => setEditing({ title: "", account: account === "all" ? "hadarelifergan" : account, niche: "travel", format: "reel", stage: "idea", planned_date: null, hook: "", caption: "", notes: "", draft_id: null, ig_permalink: "" })}>
          <Plus className="size-4" /> פריט חדש
        </Btn>
      </PageHead>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center border border-[#D9CFC2]">
          <button type="button" aria-label="החודש הקודם" className="p-2 hover:bg-[#FBF8F3]" onClick={() => setMonth((m) => shiftMonth(m, -1))}><ChevronRight className="size-4" /></button>
          <span className="s-serif min-w-[120px] px-2 text-center">{monthLabel(month)}</span>
          <button type="button" aria-label="החודש הבא" className="p-2 hover:bg-[#FBF8F3]" onClick={() => setMonth((m) => shiftMonth(m, 1))}><ChevronLeft className="size-4" /></button>
        </div>
        <Select value={account} onChange={setAccount} options={[{ value: "all" as const, label: "שני החשבונות" }, ...ACCOUNTS]} className="w-auto" />
        <span className="text-xs text-[#6A6158]">מוצגים פריטים מהחודש הזה ופריטים בלי תאריך.</span>
      </div>
      {!items ? <Loading /> : (
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          {STAGES.map((stage) => {
            const list = visible.filter((i) => i.stage === stage.value);
            return (
              <section key={stage.value} className="min-w-0 border-t-2 border-[#5E1D1D]/70 bg-[#EDE5D8]/60 p-2">
                <h2 className="s-serif mb-2 flex items-baseline justify-between px-1 text-base">{stage.label}<span className="text-xs font-normal text-[#6A6158]">{list.length}</span></h2>
                <ul className="space-y-2">
                  {list.map((item) => (
                    <li key={item.id} className="border border-[#D9CFC2] bg-[#FBF8F3] p-2.5">
                      <button type="button" className="w-full text-right" onClick={() => setEditing(item)}>
                        <span className="block text-sm font-semibold leading-snug">{item.title}</span>
                        <span className="mt-1 flex flex-wrap gap-1"><Tag>{labelOf(FORMATS, item.format)}</Tag><Tag tone={item.account === "plania.il" ? "green" : "wine"}>{labelOf(ACCOUNTS, item.account)}</Tag></span>
                        <span className="mt-1 block text-[11px] text-[#6A6158]">{item.planned_date ? formatDate(item.planned_date) : "בלי תאריך"}</span>
                      </button>
                      <select aria-label="שלב" value={item.stage} onChange={(e) => move(item, e.target.value as Stage)} className="mt-2 w-full border border-[#CFC4B5] bg-[#FFFDF9] px-1.5 py-1 text-xs">
                        {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
      {editing && <ItemEditor item={editing} onClose={() => setEditing(null)} onSaved={save} onDeleted={(id) => setItems((all) => all?.filter((x) => x.id !== id) ?? null)} />}
    </>
  );
}

function ItemEditor({ item, onClose, onSaved, onDeleted }: { item: Item; onClose: () => void; onSaved: (i: Item) => void; onDeleted: (id: string) => void }) {
  const [form, setForm] = useState(item);
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const set = <K extends keyof Item>(k: K) => (v: Item[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.title.trim()) return toast("צריך כותרת", true);
    setBusy(true);
    try {
      const { id, stage, ...rest } = form;
      const data = { ...rest, planned_date: rest.planned_date || null };
      // שלב של פריט קיים זז רק מהבורר בלוח, לא מכאן
      const res = id ? await db().from("studio_items").update(data).eq("id", id).select("*").single() : await db().from("studio_items").insert({ ...data, stage }).select("*").single();
      if (res.error) throw new Error(res.error.message);
      onSaved(res.data as Item);
      if (id && item.caption.trim() && form.caption.trim() && item.caption !== form.caption) {
        const r = await studioCall<{ suggestions: Suggestion[] }>("voice-suggest", { account: form.account, before: item.caption, after: form.caption }).catch(() => ({ suggestions: [] }));
        if (r.suggestions.length) { setSuggestions(r.suggestions); return; }
      }
      onClose();
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!item.id || !window.confirm("למחוק את הפריט?")) return;
    await db().from("studio_items").delete().eq("id", item.id);
    onDeleted(item.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-start bg-[#2A2622]/30" onClick={onClose}>
      <div className="h-full w-full max-w-lg overflow-y-auto border-l border-[#D9CFC2] bg-[#F4EEE4] p-5" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="עריכת פריט">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="s-serif text-xl">{item.id ? "עריכת פריט" : "פריט חדש"}</h2>
          <button type="button" aria-label="סגירה" onClick={onClose}><X className="size-5" /></button>
        </div>
        {suggestions.length ? <VoiceSuggestions account={form.account} suggestions={suggestions} onDone={onClose} /> : (
          <div className="space-y-3">
            <Field label="כותרת"><input className={inputCls} value={form.title} onChange={(e) => set("title")(e.target.value)} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="חשבון"><Select value={form.account} onChange={set("account")} options={ACCOUNTS} /></Field>
              <Field label="נישה"><Select value={(form.niche ?? "travel") as string} onChange={(v) => set("niche")(v)} options={NICHES} /></Field>
              <Field label="פורמט"><Select value={form.format} onChange={(v) => set("format")(v)} options={FORMATS} /></Field>
              <Field label="תאריך מתוכנן"><input type="date" className={inputCls} value={form.planned_date ?? ""} onChange={(e) => set("planned_date")(e.target.value || null)} /></Field>
            </div>
            {!item.id && <Field label="שלב"><Select value={form.stage} onChange={set("stage")} options={STAGES} /></Field>}
            <Field label="הוק"><input className={inputCls} value={form.hook} onChange={(e) => set("hook")(e.target.value)} /></Field>
            <Field label="כיתוב" hint="כשאת מתקנת כיתוב, אציע מה ללמוד ממנו לפרופיל הקול."><textarea rows={5} className={inputCls} value={form.caption} onChange={(e) => set("caption")(e.target.value)} /></Field>
            <Field label="הערות"><textarea rows={2} className={inputCls} value={form.notes} onChange={(e) => set("notes")(e.target.value)} /></Field>
            <Field label="קישור לפוסט אחרי שפרסמת"><input dir="ltr" className={inputCls} value={form.ig_permalink} onChange={(e) => set("ig_permalink")(e.target.value)} /></Field>
            {item.draft_id && <Link href={`/studio/reel?id=${item.draft_id}`} className="block text-sm text-[#5E1D1D] underline">לתסריט ולשוטים בסטודיו</Link>}
            <div className="flex justify-between gap-2 pt-2">
              {item.id ? <Btn variant="ghost" onClick={remove}>מחיקה</Btn> : <span />}
              <Btn busy={busy} onClick={submit}>שמירה</Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
