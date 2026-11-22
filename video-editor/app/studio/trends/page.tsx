"use client";
import { dropForeign } from "@/lib/studio/clean";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { NICHES, TREND_KINDS, labelOf, type TrendItem } from "@/lib/studio/config";
import { db, formatDate, studioCall } from "@/lib/studio/client";
import { Btn, Loading, Note, PageHead, Panel, Tag, toast } from "@/components/studio/ui";

interface Report { date: string; status: string; items: TrendItem[]; dropped: number; error: string | null; updated_at: string }

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
      <PageHead label="תכנון" title="מה" accent="עולה עכשיו" sub="מתעדכן כל בוקר. כל טרנד מופיע רק עם מקור שנבדק ונטען. טרנד בלי מקור לא מוצג, ומספרים מופיעים רק כשהם כתובים במקור.">
        <Btn variant="line" busy={busy} onClick={runNow}>{busy ? "מחפשת ברשת, עד דקה" : "לחפש עכשיו"}</Btn>
      </PageHead>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {[{ value: "all", label: "הכל" }, ...NICHES].map((n) => (
          <button key={n.value} type="button" onClick={() => setNiche(n.value)}
            className={`rounded-full border px-3 py-1.5 text-sm ${niche === n.value ? "border-[#1F1B16] bg-[#1F1B16] text-[#FBF8F3]" : "border-[#E2DACD] hover:border-[#1F1B16]"}`}>{n.label}</button>
        ))}
        {(reports?.length ?? 0) > 1 && (
          <select value={report?.date ?? ""} onChange={(e) => setPicked(e.target.value)} className="mr-auto rounded-lg border border-[#DDD4C6] bg-white/70 px-2 py-1.5 text-sm">
            {reports!.map((r) => <option key={r.date} value={r.date}>{formatDate(r.date)}</option>)}
          </select>
        )}
      </div>
      {!reports ? <Loading /> : !report ? <Note>עוד אין דוח. לחצי "לחפש עכשיו", או חכי לבוקר.</Note> : (
        <>
          {report.status === "running" && <Note>החיפוש רץ עכשיו.</Note>}
          {report.status === "failed" && (
            <Note tone="bad">
              החיפוש האחרון ({new Intl.DateTimeFormat("he-IL", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit" }).format(new Date(report.updated_at))}) נכשל: {report.error}
              <br />זו הודעה שמורה מהחיפוש הקודם. "לחפש עכשיו" מריץ חיפוש חדש.
            </Note>
          )}
          {report.dropped > 0 && <p className="mb-3 text-xs text-[#6F675C]">{report.dropped} טרנדים נפסלו בדוח הזה כי הקישור שלהם לא נטען.</p>}
          {items.length === 0 ? <Note>אין טרנדים עם מקור מאומת בסינון הזה.</Note> : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((t, i) => (
                <Panel key={i} className="flex flex-col">
                  <div className="mb-2 flex flex-wrap gap-1.5"><Tag tone="wine">{TREND_KINDS[t.kind] ?? t.kind}</Tag><Tag>{labelOf(NICHES, t.niche)}</Tag></div>
                  <h2 className="s-serif mb-1.5 text-lg leading-snug">{dropForeign(t.title)}</h2>
                  <p className="mb-2 text-sm leading-relaxed">{t.summary}</p>
                  <p className="mb-2 text-sm text-[#6F675C]"><span className="font-semibold text-[#1F1B16]">למה זה רלוונטי אלייך: </span>{t.why_relevant}</p>
                  <p className="mb-3 border-r-2 border-[#3E6B4F] pr-2 text-sm"><span className="font-semibold">רעיון לסרטון: </span>{t.reel_idea}</p>
                  <a href={t.source_url} target="_blank" rel="noopener noreferrer" className="mb-3 inline-flex items-center gap-1 text-xs text-[#1F1B16] underline underline-offset-2">
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
