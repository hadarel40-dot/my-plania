"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { ACCOUNTS, CHECK_LABELS, NICHES, labelOf, type Account, type Draft, type Hook, type Niche } from "@/lib/studio/config";
import { db, editorHref, formatDate, studioCall } from "@/lib/studio/client";
import { Btn, Field, Loading, Meter, Note, PageHead, Panel, Select, Tag, inputCls, toast } from "@/components/studio/ui";
import { SafeZonePreview } from "@/components/studio/safe-zone";
import { VoiceSuggestions, type Suggestion } from "@/components/studio/voice-suggestions";
import { CarouselView } from "@/components/studio/carousel-view";
import { ReadyVideo } from "@/components/studio/ready-video";
import { MaterialsPanel } from "@/components/studio/materials";
import { TEMPLATES, templateById } from "@/lib/studio/templates";
import { blankCarousel } from "@/lib/studio/carousel-blank";

const ROLE: Record<string, string> = { hook: "הוק", stakes: "הסיכון", body: "גוף", payoff: "התמורה", cta: "קריאה לפעולה" };

export default function ReelPage() {
  return <Suspense fallback={<Loading />}><ReelStudio /></Suspense>;
}

function ReelStudio() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id");
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  useEffect(() => {
    db().from("studio_drafts").select("*").order("updated_at", { ascending: false }).limit(60).then(({ data }) => setDrafts((data as Draft[]) ?? []));
  }, []);
  const draft = useMemo(() => drafts?.find((d) => d.id === id) ?? null, [drafts, id]);
  const upsert = (saved: Draft) => setDrafts((all) => (all?.some((d) => d.id === saved.id) ? all.map((d) => (d.id === saved.id ? saved : d)) : [saved, ...(all ?? [])]));

  return (
    <>
      <PageHead label="יצירה" title="סטודיו" accent="הריל" sub="רעיון, שלושה הוקים עם ציון, תסריט, טקסט על המסך ורשימת שוטים. כל ריל עובר את הבדיקות של ig-reel לפני שמצלמים.">
        <Btn variant="line" onClick={() => router.push("/studio/reel")}>ריל חדש</Btn>
      </PageHead>
      <div className="grid gap-5 lg:grid-cols-[220px_1fr] xl:grid-cols-[220px_1fr_300px]">
        <aside className="order-2 lg:order-1">
          <p className="mb-2 text-xs font-semibold text-[#6F675C]">טיוטות אחרונות</p>
          {!drafts ? <Loading /> : drafts.length === 0 ? <p className="text-sm text-[#6F675C]">עוד אין טיוטות.</p> : (
            <ul className="space-y-1">
              {drafts.map((d) => (
                <li key={d.id}>
                  <Link href={`/studio/reel?id=${d.id}`} className={`block rounded-lg border px-2.5 py-2 text-sm ${d.id === id ? "border-[#1F1B16] bg-[#FBF8F2]" : "border-transparent hover:border-[#E2DACD]"}`}>
                    <span className="line-clamp-2 block">{d.idea}</span>
                    <span className="mt-0.5 block text-[11px] text-[#6F675C]">{labelOf(ACCOUNTS, d.account)} · {formatDate(d.updated_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>
        <div className="order-1 min-w-0 space-y-5 lg:order-2">
          {id && drafts && !draft ? <Note tone="bad">הטיוטה לא נמצאה.</Note>
            : draft ? (draft.mode === "carousel" ? <CarouselDraft key={draft.id} draft={draft} onChange={upsert} /> : <DraftView key={draft.id} draft={draft} onChange={upsert} />)
            : id ? <Loading />
            : <IdeaForm params={params} onCreated={(d) => { upsert(d); router.push(`/studio/reel?id=${d.id}`); }} />}
        </div>
        <aside className="order-3 hidden space-y-5 xl:block">{draft && <ChecksPanel draft={draft} />}</aside>
      </div>
    </>
  );
}

function IdeaForm({ params, onCreated }: { params: URLSearchParams; onCreated: (d: Draft) => void }) {
  const startAccount = (ACCOUNTS.find((a) => a.value === params.get("account"))?.value ?? "hadarelifergan") as Account;
  const [idea, setIdea] = useState(params.get("idea") ?? "");
  const [account, setAccount] = useState<Account>(startAccount);
  const [niche, setNiche] = useState<Niche>((NICHES.find((n) => n.value === params.get("niche"))?.value ?? ACCOUNTS.find((a) => a.value === startAccount)!.niches[0]) as Niche);
  const startTpl = templateById(params.get("template"));
  const [mode, setMode] = useState<"full" | "short" | "carousel">(startTpl ? (startTpl.kind === "carousel" ? "carousel" : startTpl.mode ?? "full") : params.get("mode") === "carousel" ? "carousel" : "full");
  const [template, setTemplate] = useState<string>(startTpl?.id ?? "");
  const tplOptions = TEMPLATES.filter((t) => (mode === "carousel") === (t.kind === "carousel"));
  useEffect(() => {
    // תבנית שלא מתאימה לפורמט שנבחר יורדת
    if (template && !tplOptions.some((t) => t.id === template)) setTemplate("");
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps
  const [facts, setFacts] = useState("");
  const [busy, setBusy] = useState(false);
  const niches = NICHES.filter((n) => n.account === account);
  useEffect(() => {
    if (!niches.some((n) => n.value === niche)) setNiche(niches[0].value);
  }, [account]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (idea.trim().length < 8) return toast("כתבי את הרעיון במשפט או שניים", true);
    setBusy(true);
    try {
      const { data, error } = await db().from("studio_drafts").insert({ idea: idea.trim(), account, niche, mode, facts, data: template ? { template } : {} }).select("*").single();
      if (error) throw new Error(error.message);
      const { draft } = await studioCall<{ draft: Draft }>(mode === "carousel" ? "carousel" : "hooks", { draftId: data.id });
      onCreated(draft);
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };

  // קרוסלה מהתבנית בלי AI: שלד של שקופיות לפי המבנה, והיא כותבת בעצמה בעורך
  const blank = async () => {
    if (idea.trim().length < 3) return toast("כתבי במשפט על מה הקרוסלה, זה יהיה השער", true);
    setBusy(true);
    try {
      const tpl = templateById(template);
      const carousel = blankCarousel(idea, account, tpl);
      const { data, error } = await db().from("studio_drafts").insert({ idea: idea.trim(), account, niche, mode: "carousel", facts, data: { ...(tpl ? { template: tpl.id } : {}), carousel } }).select("*").single();
      if (error) throw new Error(error.message);
      onCreated(data as Draft);
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="מה הרעיון?">
      <div className="space-y-4">
        <Field label="הרעיון" hint="רעיון אחד. מה קרה, למי, ומה זה עלה או החזיר.">
          <textarea rows={3} className={inputCls} value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="למשל: איך אני מתכננת תפריט שבועי בעשר דקות ביום ראשון" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="חשבון"><Select value={account} onChange={setAccount} options={ACCOUNTS} /></Field>
          <Field label="נישה"><Select value={niche} onChange={setNiche} options={niches} /></Field>
          <Field label="פורמט">
            <Select value={mode} onChange={setMode} options={[{ value: "full", label: "ריל: תסריט מלא, 15 עד 45 שניות" }, { value: "short", label: "ריל טקסט קצר, 7 עד 10 שניות" }, { value: "carousel", label: "קרוסלה, 6 עד 10 שקופיות" }] as const} />
          </Field>
        </div>
        <Field label="תבנית" hint={templateById(template)?.why ?? "לא חובה. תבנית נותנת מבנה מוכן שעובד, והתוכן נכתב בקול שלך."}>
          <Select value={template} onChange={(v) => { setTemplate(v); const t = templateById(v); if (t && t.kind === "reel" && t.mode) setMode(t.mode); }}
            options={[{ value: "", label: "בלי תבנית" }, ...tplOptions.map((t) => ({ value: t.id, label: `${t.name} (${t.tag})` }))]} />
        </Field>
        <Field label="מספרים ועובדות אמיתיים" hint="רק מכאן נלקחים מספרים. מה שחסר יסומן {{המספר שלך}}.">
          <textarea rows={2} className={inputCls} value={facts} onChange={(e) => setFacts(e.target.value)} placeholder="למשל: התכנון לוקח לי 10 דקות, פעם זה היה שעה." />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Btn busy={busy} onClick={submit}>{busy ? (mode === "carousel" ? "כותבת את הקרוסלה..." : "כותבת שלושה הוקים...") : mode === "carousel" ? "כתבי לי קרוסלה" : "כתבי לי הוקים"}</Btn>
          {mode === "carousel" && <Btn variant="line" disabled={busy} onClick={blank}>{template ? "לבנות לבד מהתבנית" : "לבנות לבד"}</Btn>}
        </div>
        {mode === "carousel" && <p className="text-[11px] text-[#6F675C]">"לבנות לבד" פותח את עורך הקרוסלות עם השקופיות של התבנית, בלי AI, ואת כותבת בעצמך.</p>}
      </div>
    </Panel>
  );
}

function HookCard({ hook, chosen, onPick }: { hook: Hook; chosen: boolean; onPick: () => void }) {
  return (
    <div className={`rounded-xl border bg-[#FBF8F2] p-3 ${chosen ? "border-[#1F1B16]" : "border-[#E2DACD]"}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <Tag tone="wine">{hook.formula}</Tag>
        <span className={`s-serif text-2xl ${hook.ready ? "text-[#3E6B4F]" : "text-[#A3402F]"}`}>{hook.score}</span>
      </div>
      <p className="text-[11px] text-[#6F675C]">אומרים</p>
      <p className="mb-2 font-semibold leading-snug">{hook.spoken}</p>
      <p className="text-[11px] text-[#6F675C]">על המסך</p>
      <p className="s-serif mb-3 text-lg leading-snug">{hook.on_screen}</p>
      <ul className="mb-3 space-y-1.5">
        {Object.entries(hook.checks).map(([key, c]) => (
          <li key={key}>
            <div className="flex justify-between text-[11px]"><span className={key === hook.weakest ? "font-semibold text-[#A3402F]" : ""}>{CHECK_LABELS[key]}</span><span>{c.score}</span></div>
            <Meter value={c.score} />
            <p className="text-[10px] text-[#6F675C]">{c.detail}</p>
          </li>
        ))}
      </ul>
      {hook.flags.map((f) => <p key={f} className="mb-1 text-xs text-[#A3402F]">{f}</p>)}
      {!hook.ready && <p className="mb-2 text-xs text-[#A3402F]">מתחת ל-50: ההוק לא מוכן. החלש ביותר: {CHECK_LABELS[hook.weakest]}.</p>}
      {hook.why && <p className="mb-3 text-xs text-[#6F675C]">{hook.why}</p>}
      <Btn variant={chosen ? "solid" : "line"} className="w-full" onClick={onPick}>{chosen ? "ההוק שנבחר" : "לבחור את ההוק הזה"}</Btn>
    </div>
  );
}

function DraftView({ draft, onChange }: { draft: Draft; onChange: (d: Draft) => void }) {
  const router = useRouter();
  const d = draft.data;
  const [busy, setBusy] = useState("");
  const [pick, setPick] = useState(d.chosen ?? 0);
  const [editing, setEditing] = useState(false);
  const [lines, setLines] = useState(() => (d.script?.beats ?? []).map((b) => b.line));
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [itemId, setItemId] = useState<string | null>(null);
  useEffect(() => {
    db().from("studio_items").select("id").eq("draft_id", draft.id).limit(1).then(({ data }) => setItemId(data?.[0]?.id ?? null));
  }, [draft.id]);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try { await fn(); } catch (e) { toast((e as Error).message, true); } finally { setBusy(""); }
  };
  const rehook = () => run("hooks", async () => onChange((await studioCall<{ draft: Draft }>("hooks", { draftId: draft.id })).draft));
  const writeScript = () => run("script", async () => {
    const { draft: saved } = await studioCall<{ draft: Draft }>("script", { draftId: draft.id, hookIndex: pick });
    onChange(saved);
    setLines((saved.data.script?.beats ?? []).map((b) => b.line));
  });
  const saveEdits = () => run("edit", async () => {
    const beats = d.script!.beats;
    const before = beats.map((b) => b.line).filter(Boolean).join("\n");
    const nextBeats = beats.map((b, i) => ({ ...b, line: lines[i] ?? b.line }));
    const { data, error } = await db().from("studio_drafts").update({ data: { ...d, script: { ...d.script!, beats: nextBeats } } }).eq("id", draft.id).select("*").single();
    if (error) throw new Error(error.message);
    onChange(data as Draft);
    setEditing(false);
    const after = nextBeats.map((b) => b.line).filter(Boolean).join("\n");
    if (before !== after) {
      const res = await studioCall<{ suggestions: Suggestion[] }>("voice-suggest", { account: draft.account, before, after });
      if (res.suggestions.length) setSuggestions(res.suggestions);
      else toast("נשמר. לא מצאתי מה ללמוד מהתיקון הזה.");
    }
  });
  const toBoard = () => run("board", async () => {
    const hook = d.hooks?.[d.chosen ?? 0];
    const { data, error } = await db().from("studio_items").insert({
      title: draft.idea.slice(0, 80), account: draft.account, niche: draft.niche, format: "reel", stage: "draft",
      hook: hook?.spoken ?? "", caption: d.script?.caption_first_line ?? "", draft_id: draft.id,
    }).select("id").single();
    if (error) throw new Error(error.message);
    setItemId(data.id);
    toast("נשמר בלוח כטיוטה");
  });
  const toEditor = () => run("editor", async () => {
    const { projectId } = await studioCall<{ projectId: string }>("to-editor", { draftId: draft.id });
    router.push(editorHref(projectId, draft.data.template));
  });

  const beats = d.script?.beats ?? [];
  return (
    <>
      <Panel title={draft.idea} aside={<span className="flex gap-1">{templateById(draft.data.template) && <Tag tone="butter">{templateById(draft.data.template)!.name}</Tag>}<Tag>{draft.mode === "short" ? "ריל טקסט קצר" : "תסריט מלא"}</Tag></span>}>
        <p className="text-xs text-[#6F675C]">{labelOf(ACCOUNTS, draft.account)} · {labelOf(NICHES, draft.niche)}{draft.facts ? ` · עובדות: ${draft.facts}` : " · לא הוזנו מספרים"}</p>
      </Panel>
      <ReadyVideo draft={draft} />

      {(!d.video || !!d.hooks?.length) && <Panel title="שלושה הוקים" aside={<Btn variant="ghost" busy={busy === "hooks"} onClick={rehook}>הוקים חדשים</Btn>}>
        {d.hooks?.length ? (
          <>
            <div className="grid gap-3 md:grid-cols-3">{d.hooks.map((h, i) => <HookCard key={i} hook={h} chosen={pick === i} onPick={() => setPick(i)} />)}</div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Btn busy={busy === "script"} onClick={writeScript}>{busy === "script" ? "כותבת תסריט, טקסט ושוטים..." : beats.length ? "לכתוב מחדש על ההוק שנבחר" : "לכתוב תסריט על ההוק שנבחר"}</Btn>
              {!d.hooks[pick]?.ready && <span className="text-xs text-[#A3402F]">ההוק הזה מתחת ל-50. עדיף לחזק אותו לפני שמצלמים.</span>}
            </div>
          </>
        ) : <Note>אין הוקים עדיין. <button className="underline" onClick={rehook}>לכתוב עכשיו</button></Note>}
      </Panel>}

      {beats.length > 0 && d.script && (
        <>
          <Panel title={`תסריט · ${d.script.total_seconds} שניות · ${d.script.total_words} מילים`}
            aside={editing ? (
              <div className="flex gap-2"><Btn variant="ghost" onClick={() => setEditing(false)}>ביטול</Btn><Btn busy={busy === "edit"} onClick={saveEdits}>שמירה</Btn></div>
            ) : <Btn variant="ghost" onClick={() => setEditing(true)}>לתקן בקול שלי</Btn>}>
            <ol className="divide-y divide-[#ECE7DE]">
              {beats.map((b, i) => (
                <li key={i} className="grid gap-2 py-2.5 sm:grid-cols-[92px_1fr]">
                  <div className="text-[11px] text-[#6F675C]"><span className="block font-semibold text-[#1F1B16]">{ROLE[b.role] ?? b.role}</span>{b.start}-{b.end} ש׳</div>
                  <div>
                    {editing
                      ? <textarea rows={2} className={inputCls} value={lines[i] ?? ""} onChange={(e) => setLines((l) => l.map((x, j) => (j === i ? e.target.value : x)))} />
                      : b.line && <p className="font-semibold leading-snug">{b.line}</p>}
                    <p className="mt-1 text-xs text-[#6F675C]">בפריים: {b.frame}</p>
                    {b.card && <p className="mt-1 text-xs">על המסך: <span className="s-serif text-sm">{b.card}</span></p>}
                  </div>
                </li>
              ))}
            </ol>
            {d.cta && <p className="mt-3 border-t border-[#E2DACD] pt-3 text-sm"><span className="font-semibold">הקריאה לפעולה:</span> {d.cta}</p>}
            {d.script.caption_first_line && <p className="mt-1 text-sm"><span className="font-semibold">שורה ראשונה בכיתוב:</span> {d.script.caption_first_line}</p>}
          </Panel>

          {suggestions.length > 0 && <VoiceSuggestions account={draft.account} suggestions={suggestions} onDone={() => setSuggestions([])} />}

          <div className="grid gap-5 md:grid-cols-[1fr_200px]">
            <Panel title="טקסט על המסך">
              <ul className="space-y-1.5 text-sm">
                {(d.cards ?? []).map((c, i) => (
                  <li key={i} className="flex justify-between gap-3 border-b border-dashed border-[#E2DACD] pb-1.5">
                    <span className="s-serif text-base">{c.text}</span><span className="shrink-0 text-[11px] text-[#6F675C]">{c.start}-{c.end} ש׳</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-[#6F675C]">עד שש מילים לכרטיס. האזור הבטוח: לא מעל y=230, לא מתחת ל-1440, ו-230 פיקסלים פנויים מימין.</p>
            </Panel>
            <SafeZonePreview cards={d.cards ?? []} />
          </div>

          <Panel title="מה לצלם" aside={<Tag tone="green">9:16 אנכי</Tag>}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead><tr className="border-b border-[#E2DACD] text-right text-[11px] text-[#6F675C]">
                  {["#", "מה בפריים", "זווית", "שניות", "מה אומרים", "תנאי צילום", "בלי פנים"].map((h) => <th key={h} className="py-1.5 pl-2 font-semibold">{h}</th>)}
                </tr></thead>
                <tbody className="align-top">
                  {(d.shots ?? []).map((s) => (
                    <tr key={s.n} className="border-b border-[#E2DACD]/60">
                      <td className="s-serif py-2 pl-2">{s.n}</td><td className="pl-2">{s.frame}</td><td className="pl-2 text-[#6F675C]">{s.angle}</td>
                      <td className="pl-2">{s.seconds}</td><td className="pl-2">{s.says || "בלי דיבור"}</td><td className="pl-2 text-[#6F675C]">{s.conditions}</td><td>{s.faceless}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(d.checklist ?? []).length > 0 && (
              <div className="mt-4 border-t border-[#E2DACD] pt-3">
                <p className="mb-1.5 text-sm font-semibold">מה צריך להיות בקליפ כדי שיהיה טוב</p>
                <ul className="grid gap-1 text-sm sm:grid-cols-2">{d.checklist!.map((c) => <li key={c} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-[#3E6B4F]" />{c}</li>)}</ul>
              </div>
            )}
          </Panel>

          <MaterialsPanel draft={draft} onChange={onChange} />

          <div className="xl:hidden"><ChecksPanel draft={draft} /></div>

          <div className="flex flex-wrap gap-2">
            {itemId ? <Link href="/studio/board" className="rounded-[5px] border border-[#3E6B4F] px-3 py-2 text-sm font-semibold text-[#3E6B4F]">נמצא בלוח התוכן</Link>
              : <Btn variant="green" busy={busy === "board"} onClick={toBoard}>לשמור בלוח כטיוטה</Btn>}
            <Btn variant="line" busy={busy === "editor"} onClick={toEditor}>{draft.project_id ? "לפתוח בעורך" : "לפתוח פרויקט בעורך"}</Btn>
          </div>
          <p className="text-[11px] text-[#6F675C]">בעורך: כרטיסי הטקסט כבר על ציר הזמן בזמנים ובאזור הבטוח, והתסריט והשוטים בהערות. מעלים קליפים (מהטלפון או מדרייב), וכתוביות נוצרות שם מהקול.</p>
        </>
      )}
    </>
  );
}

function ChecksPanel({ draft }: { draft: Draft }) {
  const checks = draft.data.checks ?? [];
  if (!checks.length) return null;
  return (
    <Panel title="בדיקות">
      <ul className="space-y-2">
        {checks.map((c) => (
          <li key={c.id} className="flex gap-2 text-sm">
            {c.info ? <span className="mt-0.5 size-4 shrink-0 border border-[#2A2622]/40" /> : c.pass ? <Check className="mt-0.5 size-4 shrink-0 text-[#3E6B4F]" /> : <X className="mt-0.5 size-4 shrink-0 text-[#A3402F]" />}
            <span><span className="block font-semibold">{c.label}</span><span className="block text-xs text-[#6F675C]">{c.detail}</span></span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function CarouselDraft({ draft, onChange }: { draft: Draft; onChange: (d: Draft) => void }) {
  const [itemId, setItemId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    db().from("studio_items").select("id").eq("draft_id", draft.id).limit(1).then(({ data }) => setItemId(data?.[0]?.id ?? null));
  }, [draft.id]);
  const toBoard = async () => {
    setBusy(true);
    const c = draft.data.carousel;
    const { data, error } = await db().from("studio_items").insert({
      title: draft.idea.slice(0, 80), account: draft.account, niche: draft.niche, format: "carousel", stage: "draft",
      hook: c?.slides[0]?.headline ?? "", caption: c?.caption ?? "", draft_id: draft.id,
    }).select("id").single();
    setBusy(false);
    if (error) return toast(error.message, true);
    setItemId(data.id);
    toast("נשמר בלוח כטיוטה");
  };
  return (
    <>
      <Panel title={draft.idea} aside={<span className="flex gap-1">{templateById(draft.data.template) && <Tag tone="butter">{templateById(draft.data.template)!.name}</Tag>}<Tag>קרוסלה</Tag></span>}>
        <p className="text-xs text-[#6F675C]">{labelOf(ACCOUNTS, draft.account)} · {labelOf(NICHES, draft.niche)}{draft.facts ? ` · עובדות: ${draft.facts}` : " · לא הוזנו מספרים"}</p>
      </Panel>
      <ReadyVideo draft={draft} title="הקרוסלה" accent="המונפשת" />
      <CarouselView draft={draft} onChange={onChange} />
      {draft.data.carousel && <MaterialsPanel draft={draft} onChange={onChange} />}
      <div className="xl:hidden"><ChecksPanel draft={draft} /></div>
      {itemId ? <Link href="/studio/board" className="inline-block rounded-[5px] border border-[#3E6B4F] px-3 py-2 text-sm font-semibold text-[#3E6B4F]">נמצא בלוח התוכן</Link>
        : <Btn variant="green" busy={busy} onClick={toBoard}>לשמור בלוח כטיוטה</Btn>}
    </>
  );
}
