"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { NICHES, TREND_KINDS, labelOf, type TrendItem } from "@/lib/studio/config";
import { TEMPLATES, templatesForTrend, type Template } from "@/lib/studio/templates";
import { db, formatDate } from "@/lib/studio/client";
import { Label, Note, PageHead, Panel, Tag, Title } from "@/components/studio/ui";
import { cn } from "@/lib/utils";
import { dropForeign } from "@/lib/studio/clean";

const STYLE: Record<string, { cover: string; slide: string; text: string }> = {
  cream: { cover: "#F6E7A6", slide: "#FBF8F2", text: "#1F1B16" },
  ink: { cover: "#F6E7A6", slide: "#1F1B16", text: "#FBF8F2" },
  butter: { cover: "#F6E7A6", slide: "#F6E7A6", text: "#1F1B16" },
};

function hrefFor(t: Template, idea?: string) {
  return `/studio/reel?${new URLSearchParams({ template: t.id, ...(t.kind === "carousel" ? { mode: "carousel" } : {}), ...(idea ? { idea } : {}) })}`;
}

/** המטרה של כל תבנית: מה היא אמורה להביא. לפי המנגנון של התבנית, לא לפי מספרים */
type Goal = "saves" | "comments" | "connection";
const GOAL_LABEL: Record<Goal, string> = { saves: "לשמירות", comments: "לתגובות", connection: "לחיבור" };
const GOAL: Record<string, Goal> = {
  "text-7s": "connection", "montage-10s": "connection", "mistakes-3": "saves", "before-after": "connection", "myth-fact": "comments",
  pov: "comments", "steps-3": "saves", "day-in-life": "connection", "things-i-do": "saves", "this-vs-that": "comments",
  storytime: "connection", "save-checklist-reel": "saves", "green-screen": "comments",
  "car-steps": "saves", "car-mistakes": "saves", "car-myths": "comments", "car-checklist": "saves", "car-before-after": "connection",
  "car-story": "connection", "car-stack": "saves", "car-week-plan": "saves",
};
const goalOf = (t: Template): Goal => GOAL[t.id] ?? "saves";
const kindLabel = (t: Template) => (t.kind === "carousel" ? "קרוסלה" : t.mode === "short" ? "ריל טקסט קצר" : "ריל עם תסריט");

function TemplateCard({ t }: { t: Template }) {
  const [open, setOpen] = useState(false);
  const st = STYLE[t.style ?? "cream"];
  return (
    <Panel className="flex flex-col">
      <div className="mb-1.5"><Tag tone="butter">{kindLabel(t)} · {GOAL_LABEL[goalOf(t)]}</Tag></div>
      <Title size="sm">{t.name}</Title>
      <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-[#4E4540]">{t.why}</p>
      {open && (
        <div className="mt-3 space-y-2">
          {t.kind === "carousel" ? (
            <div className="flex gap-1.5 overflow-hidden" dir="rtl">
              {t.structure.slice(0, 5).map((x, i) => (
                <div key={i} className="flex aspect-[4/5] w-[58px] shrink-0 items-center justify-center rounded-md p-1 text-center text-[8px] font-bold leading-tight"
                  style={{ background: i === 0 ? st.cover : st.slide, color: i === 0 ? "#1F1B16" : st.text, border: "1px solid #E2DACD" }}>{x}</div>
              ))}
            </div>
          ) : (
            <ol className="space-y-1 text-[13px]">
              {t.structure.map((x, i) => <li key={i} className="flex gap-2"><span className="s-serif shrink-0">{i + 1}.</span><span>{x}</span></li>)}
            </ol>
          )}
          {t.shots && <p className="text-[12px] text-[#6A6158]"><b>מצלמים: </b>{t.shots.join(" · ")}</p>}
          <p className="text-[12px] text-[#6A6158]"><b>לדוגמה: </b>{t.example}</p>
        </div>
      )}
      <div className="mt-3 flex items-center gap-3 pt-1 md:mt-auto">
        <Link href={hrefFor(t)} className="inline-flex flex-1 justify-center rounded-[5px] bg-[#5E1D1D] px-3.5 py-2 text-[13px] font-bold text-[#FAF6F1]">להשתמש בתבנית</Link>
        <button type="button" onClick={() => setOpen(!open)} className="text-[12px] font-bold underline underline-offset-4">{open ? "פחות" : "השלבים"}</button>
      </div>
    </Panel>
  );
}

export default function TemplatesPage() {
  const [tab, setTab] = useState<"all" | "reel" | "carousel">("all");
  const [goal, setGoal] = useState<"all" | Goal>("all");
  const [trends, setTrends] = useState<{ date: string; items: TrendItem[] } | null>(null);
  useEffect(() => {
    db().from("studio_trends").select("date, items").eq("status", "done").order("date", { ascending: false }).limit(1).maybeSingle().then(({ data }) => setTrends(data as { date: string; items: TrendItem[] } | null));
  }, []);
  // טרנדים מסוג פורמט או הוק, עם התבנית שמתאימה להם
  const trendy = (trends?.items ?? [])
    .filter((t) => t.kind === "format" || t.kind === "hook")
    .map((t) => ({ t, tpl: templatesForTrend(`${t.title} ${t.summary}`)[0] ?? null }))
    .slice(0, 6);
  const list = TEMPLATES.filter((t) => (tab === "all" || t.kind === tab) && (goal === "all" || goalOf(t) === goal));

  return (
    <>
      <PageHead label="יצירה" title="תבניות" accent="מוכנות" sub="מבנים של רילס וקרוסלות שחוזרים עכשיו. בוחרים תבנית, כותבים נושא במשפט, והסטודיו כותב לפי המבנה, בקול שלך." />

      <section className="mb-8">
        <Label className="mb-2">מהטרנדים של השבוע{trends ? ` · ${formatDate(trends.date)}` : ""}</Label>
        {!trends ? <Note>עוד אין דוח טרנדים. "לחפש עכשיו" במסך הטרנדים.</Note> : trendy.length === 0 ? <Note>בדוח האחרון אין טרנדים של פורמט או הוק. התבניות למטה מתאימות תמיד.</Note> : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {trendy.map(({ t, tpl }, i) => (
              <Panel key={i} className="flex flex-col">
                <div className="mb-1.5 flex flex-wrap gap-1.5"><Tag tone="green">{TREND_KINDS[t.kind]}</Tag><Tag>{labelOf(NICHES, t.niche)}</Tag>{tpl && <Tag tone="butter">תבנית: {tpl.name}</Tag>}</div>
                <p className="s-serif text-base leading-snug">{dropForeign(t.title)}</p>
                <p className="mt-1 text-[13px]">{t.reel_idea}</p>
                <a href={t.source_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[11px] underline"><ExternalLink className="size-3" />{t.source_name}</a>
                <Link href={tpl ? `/studio/reel?${new URLSearchParams({ template: tpl.id, idea: t.reel_idea, account: t.account, niche: t.niche, ...(tpl.kind === "carousel" ? { mode: "carousel" } : {}) })}` : `/studio/reel?${new URLSearchParams({ idea: t.reel_idea, account: t.account, niche: t.niche })}`}
                  className="mt-3 inline-flex justify-center rounded-[5px] bg-[#5E1D1D] px-3.5 py-2 text-[13px] font-bold text-[#FAF6F1]">לכתוב לפי הטרנד</Link>
              </Panel>
            ))}
          </div>
        )}
      </section>

      <p className="mb-3 text-[12px] text-[#6A6158]">תבניות הרילס נמצאות גם בעורך הווידאו, בלשונית החכמה. בקרוסלה אפשר לכתוב עם AI או לבנות לבד בעורך הקרוסלות.</p>
      <div className="mb-4 flex flex-wrap gap-2">
        {([["all", "הכל"], ["reel", "רילס"], ["carousel", "קרוסלות"]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={cn("rounded-full border px-3 py-1.5 text-sm font-semibold", tab === k ? "border-[#5E1D1D] bg-[#5E1D1D] text-[#FAF6F1]" : "border-[#E3D9CC] bg-[#FAF6F1]")}>{l}</button>
        ))}
        <span className="mx-1 self-center text-[#D9CBBE]">|</span>
        {([["all", "כל מטרה"], ["saves", "לשמירות"], ["comments", "לתגובות"], ["connection", "לחיבור"]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setGoal(k)} className={cn("rounded-full border px-3 py-1.5 text-sm font-semibold", goal === k ? "border-[#5E1D1D] bg-[#EFD9DD]" : "border-[#E3D9CC] bg-[#FAF6F1]")}>{l}</button>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{list.map((t) => <TemplateCard key={t.id} t={t} />)}</div>
    </>
  );
}
