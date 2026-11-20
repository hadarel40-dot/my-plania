"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { ACCOUNTS, labelOf, type Draft } from "@/lib/studio/config";
import { db, editorHref, studioCall } from "@/lib/studio/client";
import { Btn, Label, Loading, Note, PageHead, Panel, Tag, toast } from "@/components/studio/ui";
import { cn } from "@/lib/utils";

/** מה לצלם: כל תסריט מוכן עם רשימת השוטים, כרשימת סימון ליום הצילום (נשמרת בדפדפן הזה) */
export default function FilmPage() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [shot, setShot] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState("");
  useEffect(() => {
    db().from("studio_drafts").select("*").order("updated_at", { ascending: false }).limit(60).then(({ data }) => setDrafts(((data as Draft[]) ?? []).filter((d) => d.data.shots?.length)));
    try { setShot(JSON.parse(localStorage.getItem("studio-shots") ?? "{}")); } catch { /* מצב פרטי */ }
  }, []);
  const toggle = (k: string) => setShot((s) => { const n = { ...s, [k]: !s[k] }; try { localStorage.setItem("studio-shots", JSON.stringify(n)); } catch { /* מצב פרטי */ } return n; });
  const toEditor = async (d: Draft) => {
    setBusy(d.id);
    try { router.push(editorHref((await studioCall<{ projectId: string }>("to-editor", { draftId: d.id })).projectId, d.data.template)); }
    catch (e) { toast((e as Error).message, true); setBusy(""); }
  };

  return (
    <>
      <PageHead label="יצירה" title="מה" accent="לצלם" sub="כל תסריט מוכן, עם השוטים לפי הסדר. לכל שוט יש גם דרך לצלם בלי פנים. מסמנים מה צולם, ואז פותחים בעורך." />
      {!drafts ? <Loading /> : drafts.length === 0 ? <Note>אין עדיין תסריטים מוכנים לצילום. כותבים אחד ב"תסריטים".</Note> : (
        <div className="space-y-4">
          {drafts.map((d) => {
            const shots = d.data.shots ?? [];
            const doneCount = shots.filter((s) => shot[`${d.id}-${s.n}`]).length;
            return (
              <Panel key={d.id} label={`${labelOf(ACCOUNTS, d.account)} · ${d.data.script?.total_seconds ?? "?"} שניות · 9:16`} title={d.idea.slice(0, 90)}
                aside={<Tag tone={doneCount === shots.length ? "green" : undefined}>{doneCount}/{shots.length} צולמו</Tag>}>
                <ol className="divide-y divide-[#ECE7DE]">
                  {shots.map((s) => {
                    const k = `${d.id}-${s.n}`;
                    return (
                      <li key={k} className="flex gap-3 py-2.5">
                        <button type="button" aria-label="צולם" onClick={() => toggle(k)} className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-[1.5px] border-[#1F1B16]", shot[k] && "bg-[#1F1B16]")}>
                          {shot[k] && <Check className="size-3 text-[#FBF8F2]" />}
                        </button>
                        <div className={cn("grid flex-1 gap-1 text-sm md:grid-cols-[1.4fr_1fr_1fr]", shot[k] && "opacity-50")}>
                          <p><span className="s-serif">{s.n}. </span><span className="font-semibold">{s.frame}</span><span className="block text-[12px] text-[#6F675C]">{s.angle} · {s.seconds} ש׳{s.says ? ` · "${s.says}"` : ""}</span></p>
                          <p className="text-[12px] text-[#4E473E]"><Label>בלי פנים</Label>{s.faceless}</p>
                          <p className="text-[12px] text-[#4E473E]"><Label>תנאים</Label>{s.conditions}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
                {(d.data.checklist ?? []).length > 0 && (
                  <div className="mt-2 rounded-xl bg-[#F4EFE6] p-3">
                    <Label className="mb-1">מה צריך להיות בקליפ</Label>
                    <ul className="grid gap-1 text-[13px] sm:grid-cols-2">{d.data.checklist!.map((c) => <li key={c}>· {c}</li>)}</ul>
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  <Btn busy={busy === d.id} onClick={() => toEditor(d)}>{d.project_id ? "לפתוח בעורך" : "לפתוח פרויקט בעורך"}</Btn>
                  <Link href={`/studio/reel?id=${d.id}`} className="inline-flex items-center rounded-[5px] border border-[#1F1B16] px-3.5 py-2 text-[13px] font-bold">לתסריט</Link>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </>
  );
}
