"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Lightbulb } from "lucide-react";
import { ACCOUNTS, FORMATS, NICHES, labelOf, type Account, type Stage } from "@/lib/studio/config";
import type { IgAccount } from "@/lib/studio/instagram";
import { usualAndBest } from "@/lib/studio/metrics";
import { db, formatDate, num, studioCall, todayIL } from "@/lib/studio/client";
import { Btn, Label, Loading, Note, Panel, Tag, Title, inputCls, toast } from "@/components/studio/ui";
import { cn } from "@/lib/utils";

interface Rec { title: string; why: string; what_to_shoot: string; action: string; action_label: string; idea: string; account: string; niche: string; impact: string }
interface Item { id: string; title: string; account: Account; niche: string | null; format: string; stage: Stage; planned_date: string | null; notes: string; auto: boolean; draft_id: string | null }
type IgData = { configured: boolean; accounts: ((IgAccount & { ok: true }) | { ok: false; error: string })[] };

const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** שבוע ישראלי: מתחיל ביום ראשון */
function weekStart(dateIso: string, offsetWeeks = 0) {
  const d = new Date(`${dateIso}T12:00:00`);
  d.setDate(d.getDate() - d.getDay() + offsetWeeks * 7);
  return d;
}

export default function HomePage() {
  const today = todayIL();
  const [items, setItems] = useState<Item[] | null>(null);
  const loadItems = useCallback(() => db().from("studio_items").select("id, title, account, niche, format, stage, planned_date, notes, auto, draft_id").neq("stage", "published").order("created_at", { ascending: false }).limit(300).then(({ data }) => setItems((data as Item[]) ?? [])), []);
  useEffect(() => { loadItems(); }, [loadItems]);

  return (
    <div className="space-y-5">
      <PoppingOff />
      <PlanWeek onAdded={loadItems} />
      <ThisWeek items={items} setItems={setItems} today={today} />
      <Reset today={today} items={items} />
    </div>
  );
}

/** הריל שמתפוצץ עכשיו: רק כשהוא באמת לפחות פי 2 מהרגיל, מנתונים אמיתיים */
function PoppingOff() {
  const router = useRouter();
  const [ig, setIg] = useState<IgData | null>(null);
  useEffect(() => { studioCall<IgData>("instagram").then(setIg).catch(() => setIg(null)); }, []);
  if (!ig) return null;
  if (!ig.configured) {
    return (
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><Label>מתפוצץ עכשיו</Label><p className="text-sm text-[#4E473E]">כשאינסטגרם יחובר, כאן יופיע הריל שעובד הכי טוב השבוע, לעומת הרגיל שלך.</p></div>
          <Link href="/studio/performance" className="text-[13px] font-bold underline underline-offset-4">איך מחברים</Link>
        </div>
      </Panel>
    );
  }
  const hits = ig.accounts.flatMap((a) => {
    if (!a.ok) return [];
    const m = usualAndBest(a.media, a.insightsAvailable);
    return m?.best && m.ratio && m.ratio >= 2 ? [{ account: a.profile.username, ...m }] : [];
  }).sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0));
  const hit = hits[0];
  if (!hit?.best) return null;
  const first = (hit.best.caption ?? "").split("\n")[0].slice(0, 60) || "האחרון";
  return (
    <Panel>
      <div className="flex flex-wrap items-center gap-4">
        {(hit.best.thumbnail_url || hit.best.media_url) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hit.best.thumbnail_url || hit.best.media_url} alt="" className="h-16 w-12 shrink-0 rounded-lg object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <Label>מתפוצץ עכשיו · @{hit.account}</Label>
          <Title size="lg" accent="מתפוצץ">הריל &quot;{first}&quot;</Title>
          <p className="mt-1 text-sm text-[#4E473E]">{num(hit.bestValue)} {hit.metricLabel}, פי {hit.ratio} מהרגיל שלך. בואי נעשה עוד כמוהו.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn onClick={() => router.push(`/studio/reel?${new URLSearchParams({ idea: `עוד ריל באותו כיוון של: ${first}`, account: ACCOUNTS.some((a) => a.value === hit.account) ? hit.account : "hadarelifergan" })}`)}>לעשות עוד כזה</Btn>
          <Btn variant="line" onClick={() => router.push("/studio/performance")}>למה זה עבד</Btn>
          <a href={hit.best.permalink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-[5px] border border-[#1F1B16] px-3.5 py-2 text-[13px] font-bold">לפתוח את הפוסט</a>
        </div>
      </div>
    </Panel>
  );
}

function PlanWeek({ onAdded }: { onAdded: () => void }) {
  const [focus, setFocus] = useState("");
  const [busy, setBusy] = useState(false);
  const [autoBusy, setAutoBusy] = useState(false);
  // כמו המשימה של הבוקר, בלחיצה: רעיונות אם חסרים, ואז טיוטה אחת שמשובצת ביום פנוי
  const autoNow = async () => {
    setAutoBusy(true);
    try {
      const ideas = await studioCall<{ added?: number }>("auto", { step: "ideas" });
      const draft = await studioCall<{ day?: string; title?: string; skipped?: string }>("auto", { step: "draft" });
      toast(draft.day ? `"${draft.title}" מוכן ומשובץ ל${formatDate(draft.day)}` : draft.skipped ?? (ideas.added ? `נוספו ${ideas.added} רעיונות` : "אין מה להכין כרגע"));
      onAdded();
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setAutoBusy(false);
    }
  };
  const run = async () => {
    setBusy(true);
    try {
      const { items } = await studioCall<{ items: unknown[] }>("plan-week", { focus });
      toast(`נוספו ${items.length} רעיונות לתור. גררי אותם לימים.`);
      onAdded();
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel>
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[240px] flex-1">
          <Label>תכנון</Label>
          <Title size="lg" accent="השבוע">לייצר את הרעיונות של</Title>
          <p className="mt-1 text-sm text-[#4E473E]">ספרי לי מה את מקדמת השבוע. אקרא את הביצועים ואת הטרנדים ואביא חמישה רעיונות לבחירה.</p>
          <input className={cn(inputCls, "mt-3")} value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="למשל: השקת התבנית לתכנון טיול, או שבוע של מתכונים מהירים" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn busy={busy} onClick={run}>{busy ? "מתכננת..." : "לתכנן את השבוע"}</Btn>
          <Btn variant="butter" busy={autoBusy} onClick={autoNow}>{autoBusy ? "מכינה טיוטה, עד דקה..." : "להכין טיוטה עכשיו"}</Btn>
        </div>
      </div>
      <p className="mt-3 text-[12px] text-[#6F675C]">כל בוקר זה קורה לבד: אחרי מחקר הטרנדים נוספים רעיונות לתור, וטיוטה אחת מוכנה (תסריט ושוטים, או קרוסלה) משובצת ביום הפנוי הבא. רוצה עוד? "להכין טיוטה עכשיו". שום דבר לא מתפרסם בלי שתאשרי.</p>
    </Panel>
  );
}

function ItemChip({ item, onDragStart }: { item: Item; onDragStart: (e: React.DragEvent) => void }) {
  return (
    <div draggable onDragStart={onDragStart} className="cursor-grab rounded-lg border border-[#E2DACD] bg-white/80 px-2 py-1.5 text-[12px] leading-snug shadow-[0_1px_1px_rgba(31,27,22,0.05)] active:cursor-grabbing">
      <span className="mb-0.5 block text-[9px] font-bold tracking-[0.14em] text-[#6F675C]">{labelOf(FORMATS, item.format)} · {item.account === "plania.il" ? "פלניה" : "אישי"}{item.auto ? " · אוטומטי" : ""}</span>
      {item.draft_id ? <Link href={`/studio/reel?id=${item.draft_id}`} className="line-clamp-3 font-semibold hover:underline">{item.title}</Link> : <span className="line-clamp-3 font-semibold">{item.title}</span>}
      {item.stage === "draft" && <span className="mt-1 inline-block rounded bg-[#F6E7A6] px-1 text-[9px] font-bold">טיוטה מוכנה</span>}
    </div>
  );
}

function ThisWeek({ items, setItems, today }: { items: Item[] | null; setItems: (fn: (all: Item[] | null) => Item[] | null) => void; today: string }) {
  const [offset, setOffset] = useState(0);
  const [over, setOver] = useState<string | null>(null);
  const start = weekStart(today, offset);
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return iso(d); });
  const queue = (items ?? []).filter((i) => !i.planned_date);
  const range = `${formatDate(days[0])} עד ${formatDate(days[6])}`;

  // גרירה משנה רק את התאריך. שלב הפריט נשאר כמו שהוא
  const place = async (id: string, date: string | null) => {
    setOver(null);
    const prev = items?.find((i) => i.id === id);
    if (!prev || prev.planned_date === date) return;
    setItems((all) => all?.map((i) => (i.id === id ? { ...i, planned_date: date } : i)) ?? null);
    const { error } = await db().from("studio_items").update({ planned_date: date }).eq("id", id);
    if (error) {
      toast(error.message, true);
      setItems((all) => all?.map((i) => (i.id === id ? prev : i)) ?? null);
    }
  };
  const drag = (id: string) => (e: React.DragEvent) => { e.dataTransfer.setData("text/plain", id); e.dataTransfer.effectAllowed = "move"; };
  const drop = (date: string | null) => ({
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setOver(date ?? "queue"); },
    onDragLeave: () => setOver(null),
    onDrop: (e: React.DragEvent) => { e.preventDefault(); place(e.dataTransfer.getData("text/plain"), date); },
  });

  return (
    <section className="rounded-2xl border border-[#D8CFC1] bg-[#E3DDD2] p-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Title size="lg" accent="הזה">השבוע</Title>
          <p className="text-[12px] text-[#4E473E]">{range} · גוררים כל דבר ליום</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" aria-label="השבוע הקודם" onClick={() => setOffset((o) => o - 1)} className="grid size-8 place-items-center rounded-[5px] border border-[#1F1B16] bg-[#FBF8F2]"><ChevronRight className="size-4" /></button>
          <button type="button" aria-label="השבוע הבא" onClick={() => setOffset((o) => o + 1)} className="grid size-8 place-items-center rounded-[5px] border border-[#1F1B16] bg-[#FBF8F2]"><ChevronLeft className="size-4" /></button>
          {offset !== 0 && <Btn variant="line" className="py-1.5" onClick={() => setOffset(0)}>השבוע</Btn>}
          <Link href="/studio/board" className="rounded-[5px] bg-[#1F1B16] px-3 py-2 text-[12px] font-bold text-[#FBF8F2]">ללוח המלא</Link>
        </div>
      </div>
      {!items ? <Loading /> : (
        <div className="grid gap-2 md:grid-cols-[150px_repeat(7,minmax(0,1fr))]">
          <div {...drop(null)} className={cn("rounded-xl border border-dashed border-[#CFC6B7] bg-[#ECE7DE] p-2", over === "queue" && "border-[#1F1B16] bg-[#F6E7A6]/50")}>
            <Label className="mb-1.5">בתור · {queue.length}</Label>
            <div className="max-h-[320px] space-y-1.5 overflow-y-auto">
              {queue.slice(0, 30).map((i) => <ItemChip key={i.id} item={i} onDragStart={drag(i.id)} />)}
              {queue.length === 0 && <p className="text-[11px] text-[#6F675C]">התור ריק. "לתכנן את השבוע" ימלא אותו.</p>}
            </div>
          </div>
          {days.map((d, idx) => {
            const isToday = d === today;
            const list = items.filter((i) => i.planned_date === d);
            return (
              <div key={d} {...drop(d)} className={cn("min-h-[140px] rounded-xl border bg-[#FBF8F2] p-2", isToday ? "border-[#1F1B16] ring-2 ring-[#F6E7A6]" : "border-[#E2DACD]", over === d && "bg-[#F6E7A6]/50")}>
                <p className="text-[10px] font-bold tracking-[0.14em] text-[#6F675C]">{DAYS[idx]}{isToday ? " · היום" : ""}</p>
                <p className="s-serif mb-1.5 text-sm">{formatDate(d)}</p>
                <div className="space-y-1.5">
                  {list.map((i) => <ItemChip key={i.id} item={i} onDragStart={drag(i.id)} />)}
                  {list.length === 0 && <p className="rounded-lg border border-dashed border-[#E2DACD] py-3 text-center text-[10px] text-[#9A9184]">גוררים לכאן</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Link href="/studio/ideas" className="mt-3 flex items-center gap-2 rounded-xl bg-[#ECE7DE] px-3 py-2 text-[12px] font-bold">
        <Lightbulb className="size-4" /> מאגר הרעיונות · {(items ?? []).filter((i) => i.stage === "idea").length}
        <span className="font-normal text-[#6F675C]">לפתוח, ואז לגרור רעיונות ליום</span>
      </Link>
    </section>
  );
}

/** האיפוס של היום: ההמלצות של היום כרשימת סימון. הסימון נשמר בדפדפן הזה בלבד */
function Reset({ today, items }: { today: string; items: Item[] | null }) {
  const router = useRouter();
  const [recs, setRecs] = useState<Rec[] | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState<number | null>(null);
  const key = `studio-reset-${today}`;
  useEffect(() => { try { setDone(JSON.parse(localStorage.getItem(key) ?? "{}")); } catch { /* מצב פרטי */ } }, [key]);
  const toggle = (k: string) => setDone((d) => { const n = { ...d, [k]: !d[k] }; try { localStorage.setItem(key, JSON.stringify(n)); } catch { /* מצב פרטי */ } return n; });

  const load = async (refresh = false) => {
    setBusy(true);
    try { setRecs((await studioCall<{ plan: { recommendations: Rec[] } }>("today", { refresh })).plan.recommendations); setError(""); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  useEffect(() => { load(); }, []);

  const week = useMemo(() => {
    const s = weekStart(today);
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(s); d.setDate(d.getDate() + i); return iso(d); }).filter((d) => d >= today);
  }, [today]);
  const empty = week.filter((d) => !(items ?? []).some((i) => i.planned_date === d)).length;
  const act = (r: Rec) => {
    if (r.action === "studio") router.push(`/studio/reel?${new URLSearchParams({ idea: r.idea || r.title, account: r.account, niche: r.niche })}`);
    else router.push(r.action === "board" ? "/studio/board" : r.action === "trends" ? "/studio/trends" : "/studio/performance");
  };
  const weekday = new Intl.DateTimeFormat("he-IL", { weekday: "long", timeZone: "Asia/Jerusalem" }).format(new Date());

  const rows: { k: string; title: string; rec?: Rec; i?: number }[] = [
    ...(empty ? [{ k: "fill", title: `למלא את השבוע (${empty === 1 ? "יום אחד פנוי" : `${empty} ימים פנויים`})` }] : []),
    ...(recs ?? []).map((r, i) => ({ k: `rec-${i}-${r.title}`, title: r.title, rec: r, i })),
  ];

  return (
    <Panel label={`היום · ${weekday}`} title="האיפוס" accent="שלך" aside={<Btn variant="ghost" busy={busy} onClick={() => load(true)}>לחשב מחדש</Btn>}>
      {error && <Note tone="bad">{error}</Note>}
      {busy && !recs ? <Loading>מסתכלת על הטרנדים, הלוח והביצועים...</Loading> : (
        <ul className="divide-y divide-[#ECE7DE]">
          {rows.map((r) => (
            <li key={r.k} className="py-2.5">
              <div className="flex items-start gap-3">
                <button type="button" aria-label={done[r.k] ? "בטל סימון" : "סמני שבוצע"} onClick={() => toggle(r.k)}
                  className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-[1.5px] border-[#1F1B16]", done[r.k] && "bg-[#1F1B16]")}>
                  {done[r.k] && <Check className="size-3 text-[#FBF8F2]" />}
                </button>
                <button type="button" className={cn("flex-1 text-right text-[15px] font-semibold", done[r.k] && "text-[#9A9184] line-through")} onClick={() => (r.rec ? setOpen(open === r.i ? null : r.i!) : null)}>
                  {r.title}
                  {r.rec && <span className="mr-2 align-middle"><Tag tone={r.rec.impact === "גבוהה" ? "butter" : undefined}>השפעה {r.rec.impact}</Tag></span>}
                </button>
              </div>
              {r.rec && open === r.i && (
                <div className="mr-8 mt-2 space-y-2 rounded-xl bg-[#F4EFE6] p-3 text-sm leading-relaxed">
                  <p><span className="font-bold">למה: </span>{r.rec.why}</p>
                  {r.rec.what_to_shoot && <p><span className="font-bold">מה לצלם: </span>{r.rec.what_to_shoot}</p>}
                  <p className="text-[11px] text-[#6F675C]">{labelOf(ACCOUNTS, r.rec.account)} · {labelOf(NICHES, r.rec.niche)}</p>
                  <Btn onClick={() => act(r.rec!)}>{r.rec.action_label || "לפעולה"}</Btn>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[11px] text-[#6F675C]">לוחצים על משימה כדי לראות למה ומה לצלם. ההמלצות נבנות מנתונים אמיתיים בלבד.</p>
    </Panel>
  );
}
