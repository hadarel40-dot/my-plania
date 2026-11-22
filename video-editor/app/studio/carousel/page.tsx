"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ACCOUNTS, labelOf, type Draft } from "@/lib/studio/config";
import { db, formatDate, versionLabels } from "@/lib/studio/client";
import { Label, Loading, Note, PageHead, Panel, Tag } from "@/components/studio/ui";

export default function CarouselsPage() {
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  useEffect(() => { db().from("studio_drafts").select("*").eq("mode", "carousel").order("updated_at", { ascending: false }).limit(60).then(({ data }) => setDrafts((data as Draft[]) ?? [])); }, []);
  return (
    <>
      <PageHead label="יצירה" title="כל" accent="הקרוסלות" sub="קרוסלה היא רעיון אחד מפורק לשלבים: שער שמושך להחליק, רעיון אחד בכל שקופית, שקופית סיכום ששולחים לחברה, וקריאה אחת לפעולה.">
        <Link href="/studio/carousel-week" className="rounded-xl bg-[#5E1D1D] px-3.5 py-2 text-[13px] font-bold text-[#FAF6F1]">צור שבוע</Link>
        <Link href="/studio/reel?mode=carousel" className="rounded-xl border border-[#5E1D1D] px-3.5 py-2 text-[13px] font-bold">קרוסלה חדשה</Link>
      </PageHead>
      {!drafts ? <Loading /> : drafts.length === 0 ? <Note>עוד אין קרוסלות. "קרוסלה חדשה" כותבת אחת מרעיון.</Note> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {drafts.map((d, _i, all) => {
            const v = versionLabels(all)[d.id] ?? "";
            const c = d.data.carousel;
            return (
              <Link key={d.id} href={`/studio/reel?id=${d.id}`}>
                <Panel className="h-full transition-shadow hover:shadow-md">
                  <div className="mb-3 grid aspect-[4/5] place-items-center rounded-xl bg-[#EFD9DD] p-5">
                    <p className="s-serif text-center text-2xl leading-tight">{c?.slides[0]?.headline ?? d.idea}</p>
                  </div>
                  <Label>{labelOf(ACCOUNTS, d.account)} · {c?.slides.length ?? 0} שקופיות · {formatDate(d.updated_at)}</Label>
                  <p className="mt-1 line-clamp-2 text-sm">{d.idea}{v && <span className="font-bold">{v}</span>}</p>
                  {(d.data.checks ?? []).some((x) => !x.pass && !x.info) && <span className="mt-2 inline-block"><Tag tone="bad">יש בדיקות שנכשלו</Tag></span>}
                </Panel>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
