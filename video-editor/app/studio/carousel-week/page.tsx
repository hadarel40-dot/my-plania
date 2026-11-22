"use client";
import Link from "next/link";
import { useState } from "react";
import { ACCOUNTS, labelOf, NICHES, type Account, type Draft } from "@/lib/studio/config";
import { db, formatDate, studioCall, todayIL } from "@/lib/studio/client";
import { Btn, Field, Note, PageHead, Panel, Select, Tag, toast } from "@/components/studio/ui";
import { CarouselView } from "@/components/studio/carousel-view";

const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

/**
 * צור שבוע: כמה קרוסלות בבת אחת. הסטודיו מוצא את הימים הפנויים בשבוע הקרוב, כותב קרוסלה לכל יום
 * (בעיצוב, בקריאה לפעולה ובתגיות של החשבון, עם תמונות מהדרייב), ומציג אותן לאישור אחת אחרי השנייה.
 * אישור משבץ בלוח כטיוטה. שום דבר לא מתפרסם.
 */
export default function CarouselWeekPage() {
  const [account, setAccount] = useState<Account>("plania.il");
  const [count, setCount] = useState("5");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [queue, setQueue] = useState<{ draft: Draft; day: string; status: "open" | "placed" | "skipped" }[]>([]);
  const [at, setAt] = useState(0);

  const build = async () => {
    setBusy(true);
    setQueue([]);
    setAt(0);
    try {
      // הימים הפנויים בשבוע הקרוב בחשבון הזה
      const from = addDays(todayIL(), 1);
      const days = Array.from({ length: 10 }, (_, i) => addDays(from, i));
      const { data: items } = await db().from("studio_items").select("planned_date").eq("account", account).gte("planned_date", from).lte("planned_date", days[days.length - 1]);
      const busyDays = new Set((items ?? []).map((i) => i.planned_date as string));
      const free = days.filter((d) => !busyDays.has(d) && new Date(`${d}T12:00:00`).getDay() !== 6).slice(0, Number(count));
      if (!free.length) throw new Error("אין ימים פנויים בעשרת הימים הקרובים");
      setProgress("חושבת על רעיונות לשבוע...");
      const { ideas } = await studioCall<{ ideas: { idea: string; niche: string; template: string }[] }>("carousel-ideas", { account, count: free.length });
      const done: { draft: Draft; day: string; status: "open" }[] = [];
      for (const [i, idea] of ideas.entries()) {
        setProgress(`כותבת קרוסלה ${i + 1} מתוך ${ideas.length}: ${idea.idea.slice(0, 50)}`);
        const { data, error } = await db().from("studio_drafts").insert({ idea: idea.idea, account, niche: idea.niche, mode: "carousel", facts: "", data: { template: idea.template } }).select("*").single();
        if (error) throw new Error(error.message);
        let draft = (await studioCall<{ draft: Draft }>("carousel", { draftId: data.id })).draft;
        // תמונות מהדרייב לשקופיות (אם הדרייב מחובר)
        setProgress(`מוצאת תמונות בדרייב לקרוסלה ${i + 1}...`);
        draft = await studioCall<{ draft: Draft }>("drive-match", { draftId: draft.id }).then((r) => r.draft).catch(() => draft);
        done.push({ draft, day: free[i], status: "open" });
        setQueue([...done]);
      }
      setProgress("");
      toast(`${done.length} קרוסלות מוכנות לאישור`);
    } catch (e) {
      toast((e as Error).message, true);
      setProgress("");
    } finally {
      setBusy(false);
    }
  };

  const place = async (i: number) => {
    const q = queue[i];
    const c = q.draft.data.carousel;
    const { error } = await db().from("studio_items").insert({
      title: q.draft.idea.slice(0, 80), account: q.draft.account, niche: q.draft.niche, format: "carousel", stage: "draft",
      planned_date: q.day, hook: c?.slides[0]?.headline ?? "", caption: c?.caption ?? "", draft_id: q.draft.id, notes: "נוצר ב\"צור שבוע\"",
    });
    if (error) return toast(error.message, true);
    setQueue((all) => all.map((x, j) => (j === i ? { ...x, status: "placed" } : x)));
    toast(`שובץ ל${formatDate(q.day)}`);
    if (i + 1 < queue.length) setAt(i + 1);
  };
  const skip = (i: number) => { setQueue((all) => all.map((x, j) => (j === i ? { ...x, status: "skipped" } : x))); if (i + 1 < queue.length) setAt(i + 1); };
  const cur = queue[at];

  return (
    <>
      <PageHead label="יצירה" title="צור" accent="שבוע" sub="כמה קרוסלות בבת אחת, לימים הפנויים בשבוע הקרוב. כל אחת בעיצוב, בקריאה לפעולה ובתגיות של החשבון, עם תמונות מהדרייב. מאשרים אחת אחרי השנייה." />
      {!queue.length && (
        <Panel title="מה מכינים?">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="חשבון"><Select value={account} onChange={setAccount} options={ACCOUNTS} /></Field>
            <Field label="כמה קרוסלות"><Select value={count} onChange={setCount} options={["3", "4", "5", "6", "7"].map((n) => ({ value: n, label: n }))} /></Field>
            <Btn busy={busy} onClick={build}>{busy ? "עובדת..." : "צור שבוע"}</Btn>
          </div>
          {progress && <p className="mt-3 text-sm text-[#4E4540]">{progress}</p>}
          <p className="mt-3 text-[12px] text-[#6A6158]">כל קרוסלה לוקחת בערך חצי דקה. אפשר להתחיל לאשר כשהראשונה מוכנה.</p>
        </Panel>
      )}
      {queue.length > 0 && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-1.5">
            {queue.map((q, i) => (
              <button key={q.draft.id} type="button" onClick={() => setAt(i)}
                className={`rounded-full border px-3 py-1 text-[12px] font-bold ${i === at ? "border-[#5E1D1D] bg-[#EFD9DD]" : "border-[#E3D9CC] bg-[#FAF6F1]"}`}>
                {formatDate(q.day)}{q.status === "placed" ? " ✓" : q.status === "skipped" ? " · דילוג" : ""}
              </button>
            ))}
            {busy && <span className="text-[12px] text-[#6A6158]">{progress}</span>}
          </div>
          {cur && (
            <div className="space-y-3">
              <Panel label={`${at + 1} מתוך ${queue.length} · ${formatDate(cur.day)} · ${labelOf(NICHES, cur.draft.niche)}`} title={cur.draft.idea}
                aside={cur.status === "placed" ? <Tag tone="green">שובץ בלוח</Tag> : cur.status === "skipped" ? <Tag>דילגת</Tag> : undefined}>
                <div className="flex flex-wrap gap-2">
                  {cur.status !== "placed" && <Btn onClick={() => place(at)}>לאשר ולשבץ ל{formatDate(cur.day)}</Btn>}
                  {cur.status === "open" && <Btn variant="ghost" onClick={() => skip(at)}>לדלג</Btn>}
                  <Link href={`/studio/reel?id=${cur.draft.id}`} className="self-center text-[13px] underline underline-offset-4">לפתוח לעריכה מלאה</Link>
                </div>
              </Panel>
              <CarouselView draft={cur.draft} onChange={(d) => setQueue((all) => all.map((x, j) => (j === at ? { ...x, draft: d } : x)))} />
            </div>
          )}
          {!busy && queue.every((q) => q.status !== "open") && (
            <Note>סיימת. {queue.filter((q) => q.status === "placed").length} קרוסלות שובצו בלוח. <Link href="/studio/board" className="font-bold underline">ללוח</Link></Note>
          )}
        </>
      )}
    </>
  );
}
