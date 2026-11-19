"use client";
import { useEffect, useMemo, useState } from "react";
import { db, formatDate, num, studioCall } from "@/lib/studio/client";
import { Btn, Loading, Note, PageHead, Panel, toast } from "@/components/studio/ui";

interface Review { week_start: string; body: string; stats: { accounts?: Record<string, unknown>[] } }

/** ## כותרות, רשימות ופסקאות. בלי ספרייה */
function Prose({ text }: { text: string }) {
  return (
    <div className="space-y-2 leading-relaxed">
      {text.split(/\n{2,}|\n(?=##|- )/).map((block, i) => {
        const b = block.trim();
        if (!b) return null;
        if (b.startsWith("## ")) return <h3 key={i} className="s-serif mt-5 text-lg">{b.slice(3)}</h3>;
        if (b.startsWith("- ")) return <ul key={i} className="mr-5 list-disc">{b.split(/\n/).map((l, j) => <li key={j}>{l.replace(/^- /, "")}</li>)}</ul>;
        return <p key={i}>{b.replace(/\*\*/g, "")}</p>;
      })}
    </div>
  );
}

export default function ReviewPage() {
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [picked, setPicked] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => db().from("studio_reviews").select("*").order("week_start", { ascending: false }).limit(20).then(({ data }) => setReviews((data as Review[]) ?? []));
  useEffect(() => { load(); }, []);
  const review = useMemo(() => reviews?.find((r) => r.week_start === picked) ?? reviews?.[0], [reviews, picked]);
  const write = async () => {
    setBusy(true);
    try { await studioCall("review"); setPicked(""); await load(); } catch (e) { toast((e as Error).message, true); } finally { setBusy(false); }
  };
  const stat = (v: unknown) => (v === null || v === undefined ? "אין נתון" : num(v));

  return (
    <>
      <PageHead title="סקירה שבועית" sub="כל מספר בסקירה מחושב מהנתונים לפני שהטקסט נכתב. מה שחסר, כתוב שחסר.">
        <Btn busy={busy} onClick={write}>{busy ? "כותבת..." : "לכתוב סקירה לשבוע האחרון"}</Btn>
      </PageHead>
      {!reviews ? <Loading /> : !review ? <Note>עוד אין סקירות.</Note> : (
        <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
          <Panel title={`השבוע מ-${formatDate(review.week_start)}`}><Prose text={review.body} /></Panel>
          <div className="space-y-5">
            {(review.stats.accounts ?? []).map((a, i) => (
              <Panel key={i} title={a.account ? `@${a.account}` : "חשבון"}>
                {a.error ? <p className="text-xs text-[#A33A2B]">{String(a.error)}</p> : (
                  <dl className="grid grid-cols-2 gap-3">
                    {([["פוסטים", a.posts], ["שמירות", a.saves], ["שיתופים", a.shares], ["תגובות", a.comments], ["לייקים", a.likes], ["שינוי בעוקבים", a.followers_change]] as const).map(([l, v]) => (
                      <div key={l}><dt className="text-[11px] text-[#6A6158]">{l}</dt><dd className="s-serif text-xl">{stat(v)}</dd></div>
                    ))}
                  </dl>
                )}
              </Panel>
            ))}
            {reviews.length > 1 && (
              <Panel title="סקירות קודמות">
                <ul className="space-y-1 text-sm">{reviews.map((r) => <li key={r.week_start}><button type="button" onClick={() => setPicked(r.week_start)} className={r.week_start === review.week_start ? "font-semibold text-[#5E1D1D]" : "hover:text-[#5E1D1D]"}>{formatDate(r.week_start)}</button></li>)}</ul>
              </Panel>
            )}
          </div>
        </div>
      )}
    </>
  );
}
