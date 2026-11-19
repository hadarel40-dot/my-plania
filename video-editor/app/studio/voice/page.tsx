"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { ACCOUNTS, DEFAULT_VOICE, labelOf, type Account, type VoiceProfile } from "@/lib/studio/config";
import { db, formatDate, studioCall } from "@/lib/studio/client";
import { Btn, Field, Loading, Note, PageHead, Panel, inputCls, toast } from "@/components/studio/ui";
import { VoiceSuggestions, type Suggestion } from "@/components/studio/voice-suggestions";

interface Row { account: Account; profile: Partial<VoiceProfile>; pending: Suggestion[]; built_at: string | null }

export default function VoicePage() {
  const [account, setAccount] = useState<Account>("hadarelifergan");
  const [rows, setRows] = useState<Row[] | null>(null);
  const load = () => db().from("studio_voice").select("account, profile, pending, built_at").then(({ data }) => setRows((data as Row[]) ?? []));
  useEffect(() => { load(); }, []);
  const row = rows?.find((r) => r.account === account);
  return (
    <>
      <PageHead title="הקול שלי" sub="כל טיוטה בסטודיו נכתבת לפי הפרופיל הזה. אפשר לבנות אותו מהכיתובים באינסטגרם ולתקן ידנית. כשאת מתקנת טיוטה, אציע מה להוסיף כאן.">
        {ACCOUNTS.map((a) => <Btn key={a.value} variant={account === a.value ? "solid" : "line"} onClick={() => setAccount(a.value)}>{a.label}</Btn>)}
      </PageHead>
      {!rows ? <Loading /> : <Editor key={account + (row?.built_at ?? "")} account={account} row={row} onSaved={load} />}
    </>
  );
}

function WordList({ label, values, onChange }: { label: string; values: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => { const v = draft.trim(); if (v && !values.includes(v)) onChange([...values, v]); setDraft(""); };
  return (
    <Field label={label}>
      <div className="flex flex-wrap gap-1.5 border border-[#CFC4B5] bg-[#FFFDF9] p-2">
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 border border-[#D9CFC2] bg-[#FBF8F3] px-2 py-0.5 text-sm">
            {v}<button type="button" aria-label={`להסיר ${v}`} onClick={() => onChange(values.filter((x) => x !== v))}><X className="size-3" /></button>
          </span>
        ))}
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} onBlur={add}
          placeholder="להוסיף ולהקיש Enter" className="min-w-[140px] flex-1 bg-transparent px-1 text-sm focus:outline-none" />
      </div>
    </Field>
  );
}

function Editor({ account, row, onSaved }: { account: Account; row?: Row; onSaved: () => void }) {
  const [form, setForm] = useState<VoiceProfile>({ ...DEFAULT_VOICE, audience: "", offer: "", ...(row?.profile ?? {}) });
  const [busy, setBusy] = useState("");
  const [pasted, setPasted] = useState("");
  const [note, setNote] = useState("");
  const set = <K extends keyof VoiceProfile>(k: K) => (v: VoiceProfile[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setBusy("save");
    const { error } = await db().from("studio_voice").upsert({ account, profile: form });
    setBusy("");
    if (error) return toast(error.message, true);
    toast("הפרופיל נשמר");
    onSaved();
  };
  const build = async () => {
    setBusy("build");
    try {
      const res = await studioCall<{ used: number; note: string }>("voice-build", { account, text: pasted });
      setNote(`נבנה מ-${res.used} כיתובים מאינסטגרם${pasted ? " ומהטקסט שהדבקת" : ""}. ${res.note}`);
      onSaved();
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy("");
    }
  };
  const area = (k: "tone" | "sentence_style" | "audience" | "offer", label: string, rows = 2) => (
    <Field label={label}><textarea rows={rows} className={inputCls} value={form[k] ?? ""} onChange={(e) => set(k)(e.target.value)} /></Field>
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <Panel title={labelOf(ACCOUNTS, account)} aside={row?.built_at && <span className="text-[11px] text-[#6A6158]">נבנה {formatDate(row.built_at)}</span>}>
        {!row && <Note>עוד אין פרופיל לחשבון הזה. מוצג הקול הבסיסי מ-voice.md. אפשר לשמור אותו כמו שהוא או לבנות מהכיתובים.</Note>}
        <div className="mt-3 space-y-4">
          {area("tone", "טון", 3)}
          {area("sentence_style", "אורך ומבנה משפטים")}
          <WordList label="מילים וביטויים שלי" values={form.favorite_words} onChange={set("favorite_words")} />
          <WordList label="מילים שאני נמנעת מהן" values={form.avoid_words} onChange={set("avoid_words")} />
          <WordList label="כללים קבועים" values={form.rules} onChange={set("rules")} />
          <div className="grid gap-3 sm:grid-cols-2">{area("audience", "למי אני מדברת")}{area("offer", "מה אני מוכרת כאן")}</div>
          <Btn busy={busy === "save"} onClick={save}>שמירת הפרופיל</Btn>
        </div>
      </Panel>
      <div className="space-y-5">
        {(row?.pending?.length ?? 0) > 0 && <VoiceSuggestions account={account} suggestions={row!.pending} onDone={onSaved} />}
        <Panel title="לבנות מהכיתובים שלי">
          <p className="mb-3 text-sm text-[#6A6158]">קורא עד 20 כיתובים אחרונים של החשבון (אם הוא מחובר), ומוסיף טקסטים שתדביקי כאן. מחליף את השדות בפרופיל, אז אחר כך כדאי לעבור ולתקן.</p>
          <textarea rows={6} className={inputCls} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="אפשר להדביק כאן כיתובים או תמלולים שכתבת" />
          <Btn className="mt-3 w-full" variant="green" busy={busy === "build"} onClick={build}>לבנות את הפרופיל</Btn>
          {note && <p className="mt-2 text-xs text-[#6A6158]">{note}</p>}
        </Panel>
      </div>
    </div>
  );
}
