"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Heart, ImagePlus, Link2, Sparkles } from "lucide-react";
import { ACCOUNTS, FORMATS, NICHES, labelOf, type Hook } from "@/lib/studio/config";
import { templateById } from "@/lib/studio/templates";
import { db, formatDate, studioCall, todayIL } from "@/lib/studio/client";
import { Btn, Label, Loading, Note, Panel, Tag, Title, inputCls, toast } from "./ui";
import { cn } from "@/lib/utils";

export interface Suggestion {
  id: string; title: string; idea: string; why: string; account: string; niche: string | null; format: string;
  hooks: Hook[]; source: string; source_url: string | null; source_note: string | null; status: string; created_at: string; template: string | null;
}

const REASONS = ["לא בקול שלי", "הנושא לא מעניין אותי", "קשה לצלם", "כבר עשיתי דומה", "לא מתאים לקהל"];
const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

/** פריים מסרטון או תמונה, מוקטנים ל-JPEG, כדי שהמודל יראה מה יש בהשראה */
async function fileToFrames(file: File): Promise<string[]> {
  const draw = (src: CanvasImageSource, w: number, h: number) => {
    const scale = Math.min(1, 768 / Math.max(w, h));
    const c = document.createElement("canvas");
    c.width = Math.round(w * scale);
    c.height = Math.round(h * scale);
    c.getContext("2d")!.drawImage(src, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.8);
  };
  const url = URL.createObjectURL(file);
  try {
    if (file.type.startsWith("image/")) {
      const img = new Image();
      await new Promise((ok, bad) => { img.onload = ok; img.onerror = bad; img.src = url; });
      return [draw(img, img.naturalWidth, img.naturalHeight)];
    }
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.src = url;
    await new Promise((ok, bad) => { v.onloadedmetadata = ok; v.onerror = bad; });
    const frames: string[] = [];
    for (const at of [0.1, 0.4, 0.75]) {
      v.currentTime = Math.max(0.1, (v.duration || 1) * at);
      await new Promise((ok) => { v.onseeked = ok; });
      frames.push(draw(v, v.videoWidth, v.videoHeight));
    }
    return frames;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function Inspiration({ onAdded }: { onAdded: (s: Suggestion[]) => void }) {
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const send = async () => {
    if (!url.trim() && !files.length && !note.trim()) return toast("הדביקי קישור, העלי תמונה או סרטון, או כתבי מה אהבת", true);
    setBusy(true);
    try {
      const images = (await Promise.all(files.slice(0, 2).map(fileToFrames))).flat().slice(0, 4);
      const res = await studioCall<{ suggestions: Suggestion[]; readPage: boolean }>("inspire", { ...(url.trim() ? { url: url.trim() } : {}), note, images });
      onAdded(res.suggestions);
      toast(url && !res.readPage && !files.length ? "אינסטגרם לא נתן לקרוא את הקישור, אז הרעיון נבנה לפי מה שכתבת. צילום מסך יעזור." : "נוספו הצעות מההשראה");
      setUrl(""); setNote(""); setFiles([]);
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
    <span id="inspiration" className="block scroll-mt-4" />
    <Panel label="השראה" title="ראית משהו" accent="שאהבת?">
      <p className="mb-3 text-sm text-[#4E4540]">קישור לריל או לטיקטוק, צילום מסך, תמונה או סרטון. אבין מה עובד בו, ואהפוך אותו לרעיון שמתאים לך ולעסק.</p>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Link2 className="size-4 shrink-0 text-[#6A6158]" />
          <input dir="ltr" className={inputCls} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.instagram.com/reel/..." />
        </div>
        <textarea rows={2} className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="מה אהבת בזה? (לא חובה, אבל עוזר)" />
        <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => setFiles([...(e.target.files ?? [])].slice(0, 2))} />
        <div className="flex flex-wrap items-center gap-2">
          <Btn variant="line" onClick={() => fileRef.current?.click()}><ImagePlus className="size-4" />{files.length ? `${files.length} קבצים נבחרו` : "תמונה או סרטון"}</Btn>
          <Btn busy={busy} onClick={send}>{busy ? "מנתחת את ההשראה..." : "להפוך לרעיון"}</Btn>
        </div>
      </div>
    </Panel>
    </>
  );
}

function SuggestionCard({ s, busyDays, onDone }: { s: Suggestion; busyDays: Set<string>; onDone: (id: string) => void }) {
  const router = useRouter();
  const [pick, setPick] = useState(0);
  const [mode, setMode] = useState<"" | "save" | "no">("");
  const [liked, setLiked] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState(false);
  const today = todayIL();
  const hook = s.hooks[pick];

  const likeHook = async (i: number) => {
    const h = s.hooks[i];
    const on = !liked[i];
    setLiked((l) => ({ ...l, [i]: on }));
    if (on) await db().from("studio_feedback").insert({ kind: "hook", text: `${h.spoken} (${h.formula})`, verdict: "like", account: s.account });
  };
  const save = async (date: string | null) => {
    setBusy(true);
    try {
      const { data: item, error } = await db().from("studio_items").insert({
        title: s.title, account: s.account, niche: s.niche, format: s.format, stage: "idea", planned_date: date, auto: true,
        hook: hook?.spoken ?? "", hook_screen: hook?.on_screen ?? "", notes: `${s.idea}\n\nלמה: ${s.why}`, template: s.template,
      }).select("id").single();
      if (error) throw new Error(error.message);
      await Promise.all([
        db().from("studio_suggestions").update({ status: "saved", item_id: item.id }).eq("id", s.id),
        db().from("studio_feedback").insert({ kind: "idea", text: s.title, verdict: "like", account: s.account }),
        ...(hook ? [db().from("studio_feedback").insert({ kind: "hook", text: `${hook.spoken} (${hook.formula})`, verdict: "like", account: s.account })] : []),
      ]);
      toast(date ? `נשמר ל${formatDate(date)}. הטיוטה תוכן לבד בבוקר, או "להכין טיוטה עכשיו".` : "נשמר בתור, בלי תאריך");
      onDone(s.id);
    } catch (e) {
      toast((e as Error).message, true);
      setBusy(false);
    }
  };
  const dismiss = async (reason: string) => {
    setBusy(true);
    await Promise.all([
      db().from("studio_suggestions").update({ status: "dismissed" }).eq("id", s.id),
      db().from("studio_feedback").insert({ kind: "idea", text: `${s.title}: ${s.idea}`, verdict: "dislike", reason, account: s.account }),
    ]);
    toast("הבנתי. אציע פחות דברים כאלה.");
    onDone(s.id);
  };

  return (
    <Panel className="flex flex-col">
      <div className="mb-2 flex flex-wrap gap-1.5">
        <Tag tone="butter">{labelOf(FORMATS, s.format)}</Tag>
        <Tag>{labelOf(ACCOUNTS, s.account)}</Tag>
        {s.niche && <Tag>{labelOf(NICHES, s.niche)}</Tag>}
        {s.source === "trend" && s.source_url && <a href={s.source_url} target="_blank" rel="noopener noreferrer"><Tag tone="green">מטרנד ↗</Tag></a>}
        {s.source === "inspiration" && <Tag tone="green">מההשראה שלך</Tag>}
        {templateById(s.template) && <Tag>תבנית: {templateById(s.template)!.name}</Tag>}
      </div>
      <Title size="sm">{s.title}</Title>
      <p className="mt-1 text-sm leading-relaxed">{s.idea}</p>
      <p className="mt-1 text-[12px] leading-relaxed text-[#6A6158]"><b>למה: </b>{s.why}</p>

      {s.hooks.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <Label>הוקים · בחרי אחד</Label>
          {s.hooks.map((h, i) => (
            <div key={i} className={cn("flex items-start gap-2 rounded-xl border px-2.5 py-2", pick === i ? "border-[#5E1D1D] bg-white/80" : "border-[#E3D9CC]")}>
              <button type="button" onClick={() => setPick(i)} className="min-w-0 flex-1 text-right">
                <span className="block text-[14px] font-semibold leading-snug">{h.spoken}</span>
                <span className="block text-[11px] text-[#6A6158]">על המסך: {h.on_screen} · {h.formula}</span>
              </button>
              <span className={cn("shrink-0 rounded-md px-1.5 text-[12px] font-bold", h.score >= 70 ? "bg-[#DCE8DF] text-[#2C4F39]" : h.score >= 50 ? "bg-[#F0E8DF]" : "bg-[#F3DCD5] text-[#8A3324]")}>{h.score}</span>
              <button type="button" aria-label="אהבתי את ההוק" onClick={() => likeHook(i)} className="shrink-0 pt-0.5"><Heart className={cn("size-4", liked[i] ? "fill-[#A3402F] text-[#A3402F]" : "text-[#9A8C85]")} /></button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-auto pt-3">
        {mode === "" && (
          <div className="flex flex-wrap gap-2">
            <Btn onClick={() => setMode("save")}>לשמור ולשבץ</Btn>
            <Btn variant="line" onClick={() => router.push(`/studio/reel?${new URLSearchParams({ idea: s.idea, account: s.account, niche: s.niche ?? "", ...(s.format === "carousel" ? { mode: "carousel" } : {}), ...(s.template ? { template: s.template } : {}) })}`)}>לכתוב עכשיו</Btn>
            <Btn variant="ghost" onClick={() => setMode("no")}>לא בשבילי</Btn>
          </div>
        )}
        {mode === "save" && (
          <div>
            <Label className="mb-1.5">לאיזה יום?</Label>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 7 }, (_, i) => addDays(today, i + 1)).map((d) => (
                <button key={d} type="button" disabled={busy} onClick={() => save(d)}
                  className={cn("rounded-lg border px-2 py-1 text-[12px] font-semibold", busyDays.has(d) ? "border-[#E3D9CC] text-[#9A8C85]" : "border-[#5E1D1D] bg-white/80")}>
                  {DAYS[new Date(`${d}T12:00:00`).getDay()]} {formatDate(d)}{busyDays.has(d) ? " · תפוס" : ""}
                </button>
              ))}
              <button type="button" disabled={busy} onClick={() => save(null)} className="rounded-lg border border-dashed border-[#9A8C85] px-2 py-1 text-[12px]">בלי תאריך</button>
            </div>
            <button type="button" className="mt-2 text-[12px] underline" onClick={() => setMode("")}>ביטול</button>
          </div>
        )}
        {mode === "no" && (
          <div>
            <Label className="mb-1.5">למה לא? (כדי שאלמד)</Label>
            <div className="flex flex-wrap gap-1.5">
              {REASONS.map((r) => <button key={r} type="button" disabled={busy} onClick={() => dismiss(r)} className="rounded-lg border border-[#E3D9CC] bg-white/80 px-2 py-1 text-[12px] hover:border-[#5E1D1D]">{r}</button>)}
            </div>
            <button type="button" className="mt-2 text-[12px] underline" onClick={() => setMode("")}>ביטול</button>
          </div>
        )}
      </div>
    </Panel>
  );
}

/** "הצעות בשבילך": מה הסטודיו מציע עכשיו. שומרים ומשבצים, או "לא בשבילי" */
export function Suggestions({ compact = false }: { compact?: boolean }) {
  const [list, setList] = useState<Suggestion[] | null>(null);
  const [busyDays, setBusyDays] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [focus, setFocus] = useState("");
  const load = useCallback(async () => {
    const [{ data }, { data: items }] = await Promise.all([
      db().from("studio_suggestions").select("*").eq("status", "new").order("created_at", { ascending: false }).limit(30),
      db().from("studio_items").select("planned_date").gte("planned_date", todayIL()).neq("stage", "published"),
    ]);
    setList((data as Suggestion[]) ?? []);
    setBusyDays(new Set((items ?? []).map((i) => i.planned_date as string)));
  }, []);
  useEffect(() => { load(); }, [load]);
  const more = async () => {
    setBusy(true);
    try {
      const res = await studioCall<{ added?: number }>("suggest", { focus: focus.trim() || undefined });
      await load();
      toast(res.added ? `נוספו ${res.added} הצעות` : "לא נוספו הצעות");
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };
  const done = (id: string) => { setList((l) => l?.filter((x) => x.id !== id) ?? null); load(); };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Label>כל בוקר, ובלחיצה</Label>
          <Title size="lg" accent="בשבילך">הצעות</Title>
          <p className="mt-1 text-sm text-[#4E4540]">רעיונות עם הוקים, לפי הטרנדים, העסק, מה שעובד לך ומה שסימנת שאת אוהבת. שומרים ומשבצים ביום, או "לא בשבילי", ואני לומדת מזה.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!compact && <input className={cn(inputCls, "w-56")} value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="מה את מקדמת השבוע? (לא חובה)" />}
          <Btn busy={busy} onClick={more}><Sparkles className="size-4" />{busy ? "חושבת על רעיונות..." : "עוד הצעות"}</Btn>
        </div>
      </div>
      {!list ? <Loading /> : list.length === 0 ? <Note>אין כרגע הצעות פתוחות. "עוד הצעות" מביא חמש חדשות, ובבוקר יגיעו לבד.</Note> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.slice(0, compact ? 6 : 30).map((s) => <SuggestionCard key={s.id} s={s} busyDays={busyDays} onDone={done} />)}
        </div>
      )}
      {!compact && <Inspiration onAdded={(s) => setList((l) => [...s, ...(l ?? [])])} />}
    </section>
  );
}
