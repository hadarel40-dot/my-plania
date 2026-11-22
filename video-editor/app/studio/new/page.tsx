"use client";
import Link from "next/link";
import { useState } from "react";
import { Check } from "lucide-react";
import { ACCOUNTS, NICHES, type Account, type Draft, type Niche } from "@/lib/studio/config";
import { TEMPLATES } from "@/lib/studio/templates";
import { db, studioCall, todayIL } from "@/lib/studio/client";
import { Btn, Field, Note, PageHead, Panel, Select, Tag, inputCls, toast } from "@/components/studio/ui";
import { cn } from "@/lib/utils";

/**
 * ריל חדש בשלושה צעדים, בלי לעבור בין דפים:
 * 1. נושא במשפט  2. בוחרים הוק (הסטודיו מסמן את החזק)  3. מוכן לצילום: תסריט, טקסט למסך ושוטים, ושיבוץ ביום.
 */
export default function NewReelPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [idea, setIdea] = useState("");
  const [account, setAccount] = useState<Account>("plania.il");
  const niches = NICHES.filter((n) => n.account === account);
  const [niche, setNiche] = useState<Niche>(niches[0].value);
  const [template, setTemplate] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState("");
  const [day, setDay] = useState(() => { const d = new Date(`${todayIL()}T12:00:00`); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); });
  const [placed, setPlaced] = useState(false);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try { await fn(); } catch (e) { toast((e as Error).message, true); } finally { setBusy(""); }
  };
  const writeHooks = () => run("hooks", async () => {
    if (idea.trim().length < 8) throw new Error("כתבי את הנושא במשפט אחד");
    const { data, error } = await db().from("studio_drafts").insert({ idea: idea.trim(), account, niche, mode: "full", facts: "", data: template ? { template } : {} }).select("*").single();
    if (error) throw new Error(error.message);
    setDraft((await studioCall<{ draft: Draft }>("hooks", { draftId: data.id })).draft);
    setStep(2);
  });
  const pick = (i: number) => run(`hook-${i}`, async () => {
    setDraft((await studioCall<{ draft: Draft }>("script", { draftId: draft!.id, hookIndex: i })).draft);
    setStep(3);
  });
  const place = () => run("place", async () => {
    const d = draft!;
    const hook = d.data.hooks?.[d.data.chosen ?? 0];
    const { error } = await db().from("studio_items").insert({
      title: d.idea.slice(0, 80), account: d.account, niche: d.niche, format: "reel", stage: "draft", planned_date: day,
      hook: hook?.spoken ?? "", hook_screen: hook?.on_screen ?? "", caption: d.data.script?.caption_first_line ?? "", draft_id: d.id, notes: "",
    });
    if (error) throw new Error(error.message);
    setPlaced(true);
    toast("שובץ בלוח, מוכן לצילום");
  });

  // ההוק המומלץ: הציון הגבוה. היא יכולה לבחור אחר
  const hooks = draft?.data.hooks ?? [];
  const best = hooks.reduce((b, h, i) => (h.score > (hooks[b]?.score ?? -1) ? i : b), 0);

  return (
    <>
      <PageHead label="יצירה" title="ריל" accent="חדש" sub="שלושה צעדים: נושא, הוק, ומוכן לצילום. הסטודיו לא מפרסם כלום." />
      <ol className="mb-5 flex gap-2 text-[13px] font-bold">
        {["נושא", "הוק", "מוכן לצילום"].map((l, i) => (
          <li key={l} className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1.5", step === i + 1 ? "border-[#5E1D1D] bg-[#EFD9DD]" : step > i + 1 ? "border-[#3E6B4F] text-[#3E6B4F]" : "border-[#E3D9CC] text-[#6A6158]")}>
            {step > i + 1 ? <Check className="size-4" /> : <span>{i + 1}</span>}{l}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <Panel title="על מה הריל?">
          <div className="space-y-3">
            <Field label="הנושא, במשפט אחד">
              <textarea rows={2} className={inputCls} value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="למשל: למה אני מתכננת את הארוחות של השבוע ביום ראשון בבוקר" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="חשבון"><Select value={account} onChange={(v) => { setAccount(v); setNiche(NICHES.find((n) => n.account === v)!.value); }} options={ACCOUNTS} /></Field>
              <Field label="נישה"><Select value={niche} onChange={setNiche} options={niches} /></Field>
              <Field label="תבנית (לא חובה)">
                <Select value={template} onChange={setTemplate} options={[{ value: "", label: "בלי תבנית" }, ...TEMPLATES.filter((t) => t.kind === "reel").map((t) => ({ value: t.id, label: t.name }))]} />
              </Field>
            </div>
            <Btn busy={busy === "hooks"} onClick={writeHooks}>{busy === "hooks" ? "כותבת שלושה הוקים..." : "להמשיך להוקים"}</Btn>
          </div>
        </Panel>
      )}

      {step === 2 && draft && (
        <Panel title="איזה הוק?" aside={<Btn variant="ghost" busy={busy === "rehook"} onClick={() => run("rehook", async () => setDraft((await studioCall<{ draft: Draft }>("hooks", { draftId: draft.id })).draft))}>הוקים אחרים</Btn>}>
          <p className="mb-3 text-[13px] text-[#4E4540]">שלוש השניות הראשונות קובעות אם ממשיכים לצפות. ההוק עם הציון הגבוה מסומן, ואפשר לבחור כל אחד.</p>
          {!hooks.length ? <Note>לא נכתבו הוקים. נסי "הוקים אחרים".</Note> : (
            <div className="grid gap-3 md:grid-cols-3">
              {hooks.map((h, i) => (
                <button key={i} type="button" disabled={!!busy} onClick={() => pick(i)}
                  className={cn("rounded-xl border bg-[#FAF6F1] p-3 text-right transition hover:border-[#5E1D1D] disabled:opacity-60", i === best ? "border-2 border-[#3E6B4F]" : "border-[#E3D9CC]")}>
                  <div className="mb-2 flex items-center justify-between">
                    {i === best ? <Tag tone="green">מומלץ</Tag> : <Tag>{h.formula}</Tag>}
                    <span className={cn("s-serif text-2xl", h.ready ? "text-[#3E6B4F]" : "text-[#A3402F]")}>{h.score}</span>
                  </div>
                  <p className="s-serif text-xl leading-snug">{h.on_screen}</p>
                  <p className="mt-2 text-[13px] text-[#4E4540]">אומרים: {h.spoken}</p>
                  <span className="mt-3 block text-[12px] font-bold underline underline-offset-4">{busy === `hook-${i}` ? "כותבת תסריט ושוטים..." : "לבחור ולהמשיך"}</span>
                </button>
              ))}
            </div>
          )}
        </Panel>
      )}

      {step === 3 && draft && (
        <div className="space-y-4">
          <Panel title="מוכן לצילום" accent={draft.data.script ? `${draft.data.script.total_seconds} שניות` : undefined}>
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <p className="mb-1 text-[12px] font-bold text-[#6A6158]">טקסט על המסך</p>
                <ol className="space-y-1.5">{(draft.data.cards ?? []).map((c, i) => <li key={i} className="rounded-lg bg-[#F2ECE4] px-3 py-1.5 text-sm font-semibold">{c.text}</li>)}</ol>
              </div>
              <div>
                <p className="mb-1 text-[12px] font-bold text-[#6A6158]">מה מצלמים</p>
                <ol className="list-decimal space-y-1.5 pr-5 text-sm">{(draft.data.shots ?? []).map((s, i) => <li key={i}>{s.frame}<span className="text-[#6A6158]"> · {s.angle} · {s.seconds} ש׳</span></li>)}</ol>
              </div>
            </div>
          </Panel>
          <Panel title="לשבץ ביום">
            {placed ? (
              <div className="flex flex-wrap gap-2">
                <Link href="/studio/film" className="rounded-xl bg-[#5E1D1D] px-3.5 py-2 text-[13px] font-bold text-[#FAF6F1]">לרשימת הצילום</Link>
                <Link href={`/studio/reel?id=${draft.id}`} className="rounded-xl border border-[#5E1D1D] px-3.5 py-2 text-[13px] font-bold">לפתוח את הטיוטה</Link>
                <Btn variant="ghost" onClick={() => { setStep(1); setIdea(""); setDraft(null); setPlaced(false); }}>ריל נוסף</Btn>
              </div>
            ) : (
              <div className="flex flex-wrap items-end gap-2">
                <Field label="יום"><input type="date" className={inputCls} value={day} min={todayIL()} onChange={(e) => setDay(e.target.value)} /></Field>
                <Btn busy={busy === "place"} onClick={place}>לשבץ בלוח</Btn>
                <Link href={`/studio/reel?id=${draft.id}`} className="pb-2 text-[13px] underline underline-offset-4">לערוך את התסריט קודם</Link>
              </div>
            )}
          </Panel>
        </div>
      )}
    </>
  );
}
