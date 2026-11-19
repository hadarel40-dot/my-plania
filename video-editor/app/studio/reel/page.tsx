"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { ACCOUNTS, CHECK_LABELS, NICHES, labelOf, type Account, type Draft, type Hook, type Niche } from "@/lib/studio/config";
import { db, formatDate, studioCall } from "@/lib/studio/client";
import { Btn, Field, Loading, Meter, Note, PageHead, Panel, Select, Tag, inputCls, toast } from "@/components/studio/ui";
import { SafeZonePreview } from "@/components/studio/safe-zone";
import { VoiceSuggestions, type Suggestion } from "@/components/studio/voice-suggestions";

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
      <PageHead title="סטודיו" sub="רעיון, שלושה הוקים עם ציון, תסריט, טקסט על המסך ורשימת שוטים. כל ריל עובר את הבדיקות של ig-reel לפני שמצלמים.">
        <Btn variant="line" onClick={() => router.push("/studio/reel")}>ריל חדש</Btn>
      </PageHead>
      <div className="grid gap-5 lg:grid-cols-[220px_1fr] xl:grid-cols-[220px_1fr_300px]">
        <aside className="order-2 lg:order-1">
          <p className="mb-2 text-xs font-semibold text-[#6A6158]">טיוטות אחרונות</p>
          {!drafts ? <Loading /> : drafts.length === 0 ? <p className="text-sm text-[#6A6158]">עוד אין טיוטות.</p> : (
            <ul className="space-y-1">
              {drafts.map((d) => (
                <li key={d.id}>
                  <Link href={`/studio/reel?id=${d.id}`} className={`block border px-2.5 py-2 text-sm ${d.id === id ? "border-[#5E1D1D] bg-[#FBF8F3]" : "border-transparent hover:border-[#D9CFC2]"}`}>
                    <span className="line-clamp-2 block">{d.idea}</span>
                    <span className="mt-0.5 block text-[11px] text-[#6A6158]">{labelOf(ACCOUNTS, d.account)} · {formatDate(d.updated_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>
        <div className="order-1 min-w-0 space-y-5 lg:order-2">
          {id && drafts && !draft ? <Note tone="bad">הטיוטה לא נמצאה.</Note>
            : draft ? <DraftView key={draft.id} draft={draft} onChange={upsert} />
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
  const [mode, setMode] = useState<"full" | "short">("full");
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
      const { data, error } = await db().from("studio_drafts").insert({ idea: idea.trim(), account, niche, mode, facts }).select("*").single();
      if (error) throw new Error(error.message);
      const { draft } = await studioCall<{ draft: Draft }>("hooks", { draftId: data.id });
      onCreated(draft);
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
          <Field label="סוג ריל">
            <Select value={mode} onChange={setMode} options={[{ value: "full", label: "תסריט מלא, 15 עד 45 שניות" }, { value: "short", label: "ריל טקסט קצר, 7 עד 10 שניות" }] as const} />
          </Field>
        </div>
        <Field label="מספרים ועובדות אמיתיים" hint="רק מכאן נלקחים מספרים. מה שחסר יסומן {{המספר שלך}}.">
          <textarea rows={2} className={inputCls} value={facts} onChange={(e) => setFacts(e.target.value)} placeholder="למשל: התכנון לוקח לי 10 דקות, פעם זה היה שעה." />
        </Field>
        <Btn busy={busy} onClick={submit}>{busy ? "כותבת שלושה הוקים..." : "כתבי לי הוקים"}</Btn>
      </div>
    </Panel>
  );
}

function HookCard({ hook, chosen, onPick }: { hook: Hook; chosen: boolean; onPick: () => void }) {
  return (
    <div className={`border bg-[#FBF8F3] p-3 ${chosen ? "border-[#5E1D1D]" : "border-[#D9CFC2]"}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <Tag tone="wine">{hook.formula}</Tag>
        <span className={`s-serif text-2xl ${hook.ready ? "text-[#2F4A3A]" : "text-[#A33A2B]"}`}>{hook.score}</span>
      </div>
      <p className="text-[11px] text-[#6A6158]">אומרים</p>
      <p className="mb-2 font-semibold leading-snug">{hook.spoken}</p>
      <p className="text-[11px] text-[#6A6158]">על המסך</p>
      <p className="s-serif mb-3 text-lg leading-snug">{hook.on_screen}</p>
      <ul className="mb-3 space-y-1.5">
        {Object.entries(hook.checks).map(([key, c]) => (
          <li key={key}>
            <div className="flex justify-between text-[11px]"><span className={key === hook.weakest ? "font-semibold text-[#A33A2B]" : ""}>{CHECK_LABELS[key]}</span><span>{c.score}</span></div>
            <Meter value={c.score} />
            <p className="text-[10px] text-[#6A6158]">{c.detail}</p>
          </li>
        ))}
      </ul>
      {hook.flags.map((f) => <p key={f} className="mb-1 text-xs text-[#A33A2B]">{f}</p>)}
      {!hook.ready && <p className="mb-2 text-xs text-[#A33A2B]">מתחת ל-50: ההוק לא מוכן. החלש ביותר: {CHECK_LABELS[hook.weakest]}.</p>}
      {hook.why && <p className="mb-3 text-xs text-[#6A6158]">{hook.why}</p>}
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
    router.push(`/p/${projectId}`);
  });

  const beats = d.script?.beats ?? [];
  return (
    <>
      <Panel title={draft.idea} aside={<Tag>{draft.mode === "short" ? "ריל טקסט קצר" : "תסריט מלא"}</Tag>}>
        <p className="text-xs text-[#6A6158]">{labelOf(ACCOUNTS, draft.account)} · {labelOf(NICHES, draft.niche)}{draft.facts ? ` · עובדות: ${draft.facts}` : " · לא הוזנו מספרים"}</p>
      </Panel>

      <Panel title="שלושה הוקים" aside={<Btn variant="ghost" busy={busy === "hooks"} onClick={rehook}>הוקים חדשים</Btn>}>
        {d.hooks?.length ? (
          <>
            <div className="grid gap-3 md:grid-cols-3">{d.hooks.map((h, i) => <HookCard key={i} hook={h} chosen={pick === i} onPick={() => setPick(i)} />)}</div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Btn busy={busy === "script"} onClick={writeScript}>{busy === "script" ? "כותבת תסריט, טקסט ושוטים..." : beats.length ? "לכתוב מחדש על ההוק שנבחר" : "לכתוב תסריט על ההוק שנבחר"}</Btn>
              {!d.hooks[pick]?.ready && <span className="text-xs text-[#A33A2B]">ההוק הזה מתחת ל-50. עדיף לחזק אותו לפני שמצלמים.</span>}
            </div>
          </>
        ) : <Note>אין הוקים עדיין. <button className="underline" onClick={rehook}>לכתוב עכשיו</button></Note>}
      </Panel>

      {beats.length > 0 && d.script && (
        <>
          <Panel title={`תסריט · ${d.script.total_seconds} שניות · ${d.script.total_words} מילים`}
            aside={editing ? (
              <div className="flex gap-2"><Btn variant="ghost" onClick={() => setEditing(false)}>ביטול</Btn><Btn busy={busy === "edit"} onClick={saveEdits}>שמירה</Btn></div>
            ) : <Btn variant="ghost" onClick={() => setEditing(true)}>לתקן בקול שלי</Btn>}>
            <ol className="divide-y divide-[#D9CFC2]">
              {beats.map((b, i) => (
                <li key={i} className="grid gap-2 py-2.5 sm:grid-cols-[92px_1fr]">
                  <div className="text-[11px] text-[#6A6158]"><span className="block font-semibold text-[#2A2622]">{ROLE[b.role] ?? b.role}</span>{b.start}-{b.end} ש׳</div>
                  <div>
                    {editing
                      ? <textarea rows={2} className={inputCls} value={lines[i] ?? ""} onChange={(e) => setLines((l) => l.map((x, j) => (j === i ? e.target.value : x)))} />
                      : b.line && <p className="font-semibold leading-snug">{b.line}</p>}
                    <p className="mt-1 text-xs text-[#6A6158]">בפריים: {b.frame}</p>
                    {b.card && <p className="mt-1 text-xs">על המסך: <span className="s-serif text-sm">{b.card}</span></p>}
                  </div>
                </li>
              ))}
            </ol>
            {d.cta && <p className="mt-3 border-t border-[#D9CFC2] pt-3 text-sm"><span className="font-semibold">הקריאה לפעולה:</span> {d.cta}</p>}
            {d.script.caption_first_line && <p className="mt-1 text-sm"><span className="font-semibold">שורה ראשונה בכיתוב:</span> {d.script.caption_first_line}</p>}
          </Panel>

          {suggestions.length > 0 && <VoiceSuggestions account={draft.account} suggestions={suggestions} onDone={() => setSuggestions([])} />}

          <div className="grid gap-5 md:grid-cols-[1fr_200px]">
            <Panel title="טקסט על המסך">
              <ul className="space-y-1.5 text-sm">
                {(d.cards ?? []).map((c, i) => (
                  <li key={i} className="flex justify-between gap-3 border-b border-dashed border-[#D9CFC2] pb-1.5">
                    <span className="s-serif text-base">{c.text}</span><span className="shrink-0 text-[11px] text-[#6A6158]">{c.start}-{c.end} ש׳</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-[#6A6158]">עד שש מילים לכרטיס. האזור הבטוח: לא מעל y=230, לא מתחת ל-1440, ו-230 פיקסלים פנויים מימין.</p>
            </Panel>
            <SafeZonePreview cards={d.cards ?? []} />
          </div>

          <Panel title="מה לצלם" aside={<Tag tone="green">9:16 אנכי</Tag>}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead><tr className="border-b border-[#D9CFC2] text-right text-[11px] text-[#6A6158]">
                  {["#", "מה בפריים", "זווית", "שניות", "מה אומרים", "תנאי צילום", "בלי פנים"].map((h) => <th key={h} className="py-1.5 pl-2 font-semibold">{h}</th>)}
                </tr></thead>
                <tbody className="align-top">
                  {(d.shots ?? []).map((s) => (
                    <tr key={s.n} className="border-b border-[#D9CFC2]/60">
                      <td className="s-serif py-2 pl-2">{s.n}</td><td className="pl-2">{s.frame}</td><td className="pl-2 text-[#6A6158]">{s.angle}</td>
                      <td className="pl-2">{s.seconds}</td><td className="pl-2">{s.says || "בלי דיבור"}</td><td className="pl-2 text-[#6A6158]">{s.conditions}</td><td>{s.faceless}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(d.checklist ?? []).length > 0 && (
              <div className="mt-4 border-t border-[#D9CFC2] pt-3">
                <p className="mb-1.5 text-sm font-semibold">מה צריך להיות בקליפ כדי שיהיה טוב</p>
                <ul className="grid gap-1 text-sm sm:grid-cols-2">{d.checklist!.map((c) => <li key={c} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-[#2F4A3A]" />{c}</li>)}</ul>
              </div>
            )}
          </Panel>

          <div className="xl:hidden"><ChecksPanel draft={draft} /></div>

          <div className="flex flex-wrap gap-2">
            {itemId ? <Link href="/studio/board" className="border border-[#2F4A3A] px-3 py-2 text-sm font-semibold text-[#2F4A3A]">נמצא בלוח התוכן</Link>
              : <Btn variant="green" busy={busy === "board"} onClick={toBoard}>לשמור בלוח כטיוטה</Btn>}
            <Btn variant="line" busy={busy === "editor"} onClick={toEditor}>{draft.project_id ? "לפתוח בעורך" : "לפתוח פרויקט בעורך"}</Btn>
          </div>
          <p className="text-[11px] text-[#6A6158]">בעורך: כרטיסי הטקסט כבר על ציר הזמן בזמנים ובאזור הבטוח, והתסריט והשוטים בהערות. מעלים קליפים (מהטלפון או מדרייב), וכתוביות נוצרות שם מהקול.</p>
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
            {c.info ? <span className="mt-0.5 size-4 shrink-0 border border-[#2A2622]/40" /> : c.pass ? <Check className="mt-0.5 size-4 shrink-0 text-[#2F4A3A]" /> : <X className="mt-0.5 size-4 shrink-0 text-[#A33A2B]" />}
            <span><span className="block font-semibold">{c.label}</span><span className="block text-xs text-[#6A6158]">{c.detail}</span></span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
