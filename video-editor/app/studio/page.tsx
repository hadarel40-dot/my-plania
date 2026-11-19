"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ACCOUNTS, NICHES, labelOf } from "@/lib/studio/config";
import { db, formatDate, studioCall, todayIL } from "@/lib/studio/client";
import { Btn, Loading, Note, PageHead, Panel, Tag } from "@/components/studio/ui";

interface Rec { title: string; why: string; what_to_shoot: string; action: string; action_label: string; idea: string; account: string; niche: string; impact: string }
interface Item { id: string; title: string; stage: string; planned_date: string | null }

export default function TodayPage() {
  const router = useRouter();
  const [recs, setRecs] = useState<Rec[] | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState<Item[]>([]);

  const load = async (refresh = false) => {
    setBusy(true);
    try {
      const { plan } = await studioCall<{ plan: { recommendations: Rec[] } }>("today", { refresh });
      setRecs(plan.recommendations);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    load();
    db().from("studio_items").select("id, title, stage, planned_date").neq("stage", "published").order("planned_date").then(({ data }) => setItems(data ?? []));
  }, []);

  const act = (r: Rec) => {
    if (r.action === "studio") router.push(`/studio/reel?${new URLSearchParams({ idea: r.idea || r.title, account: r.account, niche: r.niche })}`);
    else router.push(r.action === "board" ? "/studio/board" : r.action === "trends" ? "/studio/trends" : "/studio/performance");
  };
  const today = todayIL();
  const waiting = items.filter((i) => i.stage === "review");
  const next = items.filter((i) => i.planned_date && i.planned_date >= today).slice(0, 5);

  return (
    <>
      <PageHead title="היום" sub={`${formatDate(today)}. שלושה דברים לפי סדר ההשפעה, כל אחד עם סיבה ופעולה.`}>
        <Btn variant="line" busy={busy} onClick={() => load(true)}>לחשב מחדש</Btn>
      </PageHead>
      {error && <Note tone="bad">{error}</Note>}
      {busy && !recs ? (
        <Loading>מסתכלת על הטרנדים, הלוח והביצועים...</Loading>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {(recs ?? []).map((r, i) => (
            <Panel key={i} tone={i === 0 ? "wine" : undefined} className="flex flex-col">
              <div className="mb-2 flex items-center justify-between">
                <span className="s-serif text-4xl leading-none text-[#5E1D1D]/80">{i + 1}</span>
                <Tag tone={r.impact === "גבוהה" ? "wine" : undefined}>השפעה {r.impact}</Tag>
              </div>
              <h2 className="s-serif mb-2 text-xl leading-snug">{r.title}</h2>
              <p className="mb-2 text-sm leading-relaxed"><span className="font-semibold">למה: </span>{r.why}</p>
              {r.what_to_shoot && <p className="mb-3 text-sm leading-relaxed text-[#6A6158]"><span className="font-semibold text-[#2A2622]">מה לצלם: </span>{r.what_to_shoot}</p>}
              <p className="mb-3 text-[11px] text-[#6A6158]">{labelOf(ACCOUNTS, r.account)} · {labelOf(NICHES, r.niche)}</p>
              <Btn className="mt-auto" onClick={() => act(r)}>{r.action_label || "לפעולה"}</Btn>
            </Panel>
          ))}
        </div>
      )}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="ממתין לאישור שלך">
          {waiting.length === 0 ? <p className="text-sm text-[#6A6158]">אין כרגע פריטים שממתינים לך.</p> : (
            <ul className="divide-y divide-[#D9CFC2]">{waiting.map((i) => <li key={i.id} className="py-2 text-sm"><Link href="/studio/board" className="hover:text-[#5E1D1D]">{i.title}</Link></li>)}</ul>
          )}
        </Panel>
        <Panel title="מתוכנן קדימה">
          {next.length === 0 ? <p className="text-sm text-[#6A6158]">אין תאריכים בלוח. אפשר לשבץ פריטים בלוח התוכן.</p> : (
            <ul className="divide-y divide-[#D9CFC2]">{next.map((i) => <li key={i.id} className="flex justify-between gap-3 py-2 text-sm"><span>{i.title}</span><span className="shrink-0 text-[#6A6158]">{formatDate(i.planned_date)}</span></li>)}</ul>
          )}
        </Panel>
      </div>
      <p className="mt-4 text-[11px] text-[#6A6158]">ההמלצות נבנות מנתונים אמיתיים בלבד: הטרנדים המאומתים, הלוח והביצועים. כשחסר מידע (למשל אינסטגרם לא מחובר), זה כתוב בנימוק.</p>
    </>
  );
}
