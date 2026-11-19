"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { NICHES, TREND_KINDS, labelOf, type TrendItem } from "@/lib/studio/config";
import { db, formatDate, studioCall } from "@/lib/studio/client";
import { Btn, Loading, Note, PageHead, Panel, Tag, toast } from "@/components/studio/ui";

interface Report { date: string; status: string; items: TrendItem[]; dropped: number; error: string | null }

export default function TrendsPage() {
  const router = useRouter();
  const [reports, setReports] = useState<Report[] | null>(null);
  const [picked, setPicked] = useState("");
  const [niche, setNiche] = useState("all");
  const [busy, setBusy] = useState(false);
  const load = () => db().from("studio_trends").select("*").order("date", { ascending: false }).limit(14).then(({ data }) => setReports((data as Report[]) ?? []));
  useEffect(() => { load(); }, []);
  const report = useMemo(() => reports?.find((r) => r.date === picked) ?? reports?.[0], [reports, picked]);
  const items = (report?.items ?? []).filter((i) => i.source_url && (niche === "all" || i.niche === niche));

  const runNow = async () => {
    setBusy(true);
    try {
      const res = await studioCall<{ count: number; dropped: number }>("trends");
      toast(`נמצאו ${res.count} טרנדים עם מקור${res.dropped ? `, ${res.dropped} נפסלו` : ""}`);
      setPicked("");
      await load();
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead title="טרנדים" sub="מתעדכן כל בוקר. כל טרנד מופיע רק עם מקור שנבדק ונטען. טרנד בלי מקור לא מוצג, ומספרים מופיעים רק כשהם כתובים במקור.">
        <Btn variant="line" busy={busy} onClick={runNow}>{busy ? "מחפשת ברשת, עד דקה" : "לחפש עכשיו"}</Btn>
      </PageHead>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {[{ value: "all", label: "הכל" }, ...NICHES].map((n) => (
          <button key={n.value} type="button" onClick={() => setNiche(n.value)}
            className={`border px-3 py-1.5 text-sm ${niche === n.value ? "border-[#5E1D1D] bg-[#5E1D1D] text-[#FBF8F3]" : "border-[#D9CFC2] hover:border-[#5E1D1D]"}`}>{n.label}</button>
        ))}
        {(reports?.length ?? 0) > 1 && (
          <select value={report?.date ?? ""} onChange={(e) => setPicked(e.target.value)} className="mr-auto border border-[#CFC4B5] bg-[#FFFDF9] px-2 py-1.5 text-sm">
            {reports!.map((r) => <option key={r.date} value={r.date}>{formatDate(r.date)}</option>)}
          </select>
        )}
      </div>
      {!reports ? <Loading /> : !report ? <Note>עוד אין דוח. לחצי "לחפש עכשיו", או חכי לבוקר.</Note> : (
        <>
          {report.status === "running" && <Note>החיפוש רץ עכשיו.</Note>}
          {report.status === "failed" && <Note tone="bad">החיפוש נכשל: {report.error}</Note>}
          {report.dropped > 0 && <p className="mb-3 text-xs text-[#6A6158]">{report.dropped} טרנדים נפסלו בדוח הזה כי הקישור שלהם לא נטען.</p>}
          {items.length === 0 ? <Note>אין טרנדים עם מקור מאומת בסינון הזה.</Note> : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((t, i) => (
                <Panel key={i} className="flex flex-col">
                  <div className="mb-2 flex flex-wrap gap-1.5"><Tag tone="wine">{TREND_KINDS[t.kind] ?? t.kind}</Tag><Tag>{labelOf(NICHES, t.niche)}</Tag></div>
                  <h2 className="s-serif mb-1.5 text-lg leading-snug">{t.title}</h2>
                  <p className="mb-2 text-sm leading-relaxed">{t.summary}</p>
                  <p className="mb-2 text-sm text-[#6A6158]"><span className="font-semibold text-[#2A2622]">למה זה רלוונטי אלייך: </span>{t.why_relevant}</p>
                  <p className="mb-3 border-r-2 border-[#2F4A3A] pr-2 text-sm"><span className="font-semibold">רעיון לסרטון: </span>{t.reel_idea}</p>
                  <a href={t.source_url} target="_blank" rel="noopener noreferrer" className="mb-3 inline-flex items-center gap-1 text-xs text-[#5E1D1D] underline underline-offset-2">
                    <ExternalLink className="size-3" />{t.source_name || "המקור"}
                  </a>
                  <Btn className="mt-auto" variant="line" onClick={() => router.push(`/studio/reel?${new URLSearchParams({ idea: t.reel_idea, account: t.account, niche: t.niche })}`)}>לכתוב את הריל הזה</Btn>
                </Panel>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
