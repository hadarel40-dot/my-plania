"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CHECK_LABELS, type Draft, type Hook } from "@/lib/studio/config";
import { db, formatDate } from "@/lib/studio/client";
import { Label, Loading, Meter, Note, PageHead, Panel, Tag } from "@/components/studio/ui";

export default function HooksPage() {
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [onlyReady, setOnlyReady] = useState(false);
  useEffect(() => { db().from("studio_drafts").select("*").order("updated_at", { ascending: false }).limit(100).then(({ data }) => setDrafts((data as Draft[]) ?? [])); }, []);
  const hooks = useMemo(() => (drafts ?? []).flatMap((d) => (d.data.hooks ?? []).map((h: Hook, i: number) => ({ h, d, chosen: d.data.chosen === i && !!d.data.script })))
    .filter((x) => !onlyReady || x.h.ready).sort((a, b) => b.h.score - a.h.score), [drafts, onlyReady]);

  return (
    <>
      <PageHead label="תכנון" title="כל" accent="ההוקים" sub="כל ההוקים שנכתבו, מהחזק לחלש. הציון מחושב בקוד בחמש בדיקות, והבדיקה החלשה קובעת. מתחת ל-50 ההוק לא מוכן.">
        <label className="flex items-center gap-2 text-[13px] font-bold"><input type="checkbox" checked={onlyReady} onChange={(e) => setOnlyReady(e.target.checked)} />רק מוכנים</label>
        <Link href="/studio/reel" className="rounded-[5px] bg-[#1F1B16] px-3.5 py-2 text-[13px] font-bold text-[#FBF8F2]">הוק חדש</Link>
      </PageHead>
      {!drafts ? <Loading /> : hooks.length === 0 ? <Note>עוד אין הוקים. כותבים רעיון בסטודיו ומקבלים שלושה.</Note> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {hooks.map(({ h, d, chosen }, k) => (
            <Panel key={k} className="flex flex-col">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="flex flex-wrap gap-1.5"><Tag>{h.formula}</Tag>{chosen && <Tag tone="green">נבחר לתסריט</Tag>}</span>
                <span className={`s-serif text-3xl leading-none ${h.ready ? "text-[#3E6B4F]" : "text-[#A3402F]"}`}>{h.score}</span>
              </div>
              <Label>אומרים</Label>
              <p className="mb-2 font-semibold leading-snug">{h.spoken}</p>
              <Label>על המסך</Label>
              <p className="s-serif mb-3 text-lg leading-snug">{h.on_screen}</p>
              <div className="mb-3 grid grid-cols-5 gap-1.5">
                {Object.entries(h.checks).map(([key, c]) => (
                  <div key={key} title={c.detail}><Meter value={c.score} /><p className={`mt-0.5 text-[9px] font-bold ${key === h.weakest ? "text-[#A3402F]" : "text-[#6F675C]"}`}>{CHECK_LABELS[key]}</p></div>
                ))}
              </div>
              <Link href={`/studio/reel?id=${d.id}`} className="mt-auto text-[12px] text-[#4E473E] underline underline-offset-4">{d.idea.slice(0, 70)} · {formatDate(d.updated_at)}</Link>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
