"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Check, Lightbulb, Sparkles } from "lucide-react";
import { ACCOUNTS, NICHES, labelOf, type Account, type Stage } from "@/lib/studio/config";
import { db, studioCall, todayIL } from "@/lib/studio/client";
import { Btn, Loading, Note, Panel, Tag, toast } from "@/components/studio/ui";
import { TodayPost, WeekStrip } from "@/components/studio/today";
import { cn } from "@/lib/utils";

interface Rec { title: string; why: string; what_to_shoot: string; action: string; action_label: string; idea: string; account: string; niche: string; impact: string }
interface Item { id: string; title: string; account: Account; niche: string | null; format: string; stage: Stage; planned_date: string | null; notes: string; auto: boolean; draft_id: string | null; content_type?: string | null }

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** שבוע ישראלי: מתחיל ביום ראשון */
function weekStart(dateIso: string, offsetWeeks = 0) {
  const d = new Date(`${dateIso}T12:00:00`);
  d.setDate(d.getDate() - d.getDay() + offsetWeeks * 7);
  return d;
}

/** העמוד הראשי עונה על שאלה אחת: מה עושים היום. השבוע מופיע פעם אחת, בקטן */
export default function HomePage() {
  const today = todayIL();
  const [items, setItems] = useState<Item[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    db().from("studio_items").select("*").neq("stage", "published").order("planned_date", { nullsFirst: false }).limit(300).then(({ data }) => setItems((data as Item[]) ?? []));
    db().from("studio_suggestions").select("id", { count: "exact", head: true }).eq("status", "new").then(({ count }) => setOpen(count ?? 0));
  }, []);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <Reset today={today} items={items} />
        <TodayPost today={today} />
      </div>
      <WeekStrip today={today} />
      <div className="flex flex-wrap gap-2">
        <Link href="/studio/new" className="inline-flex items-center gap-2 rounded-full bg-[#1F1B16] px-4 py-2 text-[13px] font-bold text-[#FBF8F2]">+ ריל חדש</Link>
        <Link href="/studio/ideas" className="inline-flex items-center gap-2 rounded-full border border-[#E2DACD] bg-[#FBF8F2] px-4 py-2 text-[13px] font-bold hover:bg-[#F4EFE6]">
          <Lightbulb className="size-4" />הצעות לרעיונות{open ? ` (${open})` : ""}
        </Link>
        <Link href="/studio/ideas#inspiration" className="inline-flex items-center gap-2 rounded-full border border-[#E2DACD] bg-[#FBF8F2] px-4 py-2 text-[13px] font-bold hover:bg-[#F4EFE6]">
          <Sparkles className="size-4" />השראה מקישור, תמונה או סרטון
        </Link>
      </div>
    </div>
  );
}

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
