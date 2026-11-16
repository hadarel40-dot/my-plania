"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDown, ArrowUp, CheckCircle2, Copy, CopyPlus, ExternalLink, Loader2, RotateCcw, Trash2, Upload, X,
} from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import {
  ACCOUNTS, CAPTION_MAX, FORMATS, HASHTAG_MAX, STATUSES, countHashtags, missingForPublish, publicUrl,
  type ContentItem, type MediaFile,
} from "@/lib/content/types";
import { fromLocalInput, fullDateTime, toLocalInput } from "@/lib/content/dates";
import { removeContentFiles, uploadContentFile } from "@/lib/content/upload";

/** השדות שהדאשבורד עורך. השאר (פורסם, קישור, שגיאה) מגיעים מהתרחיש */
const EDITABLE = ["account", "format", "status", "title", "hook", "script", "caption", "notes", "media", "project_id", "scheduled_at"] as const;

export function ItemEditor({ initial, isNew, projects, onClose, onSaved, onDeleted, onDuplicate }: {
  initial: ContentItem; isNew: boolean; projects: { id: string; title: string }[];
  onClose: () => void; onSaved: (i: ContentItem) => void; onDeleted: (id: string) => void; onDuplicate: (i: ContentItem) => void;
}) {
  const [item, setItem] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploads, setUploads] = useState<{ name: string; pct: number }[]>([]);
  const [copied, setCopied] = useState(false);
  // קבצים שהועלו בעריכה הזו: אם סוגרים פוסט חדש בלי לשמור, מוחקים אותם
  const uploadedHere = useRef<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const dirty = JSON.stringify(EDITABLE.map((k) => item[k])) !== JSON.stringify(EDITABLE.map((k) => initial[k]));
  const set = <K extends keyof ContentItem>(k: K, v: ContentItem[K]) => setItem((i) => ({ ...i, [k]: v }));
  const missing = missingForPublish(item);
  const locked = item.status === "publishing" || item.status === "published";

  function close() {
    if (dirty && !confirm("יש שינויים שלא נשמרו. לסגור בלי לשמור?")) return;
    if (uploadedHere.current.length) void removeContentFiles(uploadedHere.current);
    onClose();
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function save(patch: Partial<ContentItem> = {}) {
    const next = { ...item, ...patch };
    if (next.status === "approved") {
      const m = missingForPublish(next);
      if (m.length) { setError(`כדי לאשר לפרסום חסר: ${m.join(", ")}`); return; }
    }
    setSaving(true);
    setError(null);
    const row = Object.fromEntries(EDITABLE.map((k) => [k, next[k]]));
    const supabase = getSupabaseBrowser();
    const { data, error: e } = isNew
      ? await supabase.from("content_items").insert({ id: next.id, ...row }).select().single()
      : await supabase.from("content_items").update(row).eq("id", next.id).select().single();
    setSaving(false);
    if (e || !data) { setError(`השמירה נכשלה: ${e?.message ?? "לא ידוע"}`); return; }
    // קבצים שהוסרו מהפוסט נמחקים מהאחסון רק אחרי שהשמירה הצליחה
    const kept = new Set(next.media.map((m) => m.path));
    void removeContentFiles(initial.media.map((m) => m.path).filter((p) => !kept.has(p)));
    onSaved(data as ContentItem);
    onClose();
  }

  async function remove() {
    if (!confirm("למחוק את הפוסט ואת הקבצים שלו?")) return;
    setSaving(true);
    if (!isNew) {
      const { error: e } = await getSupabaseBrowser().from("content_items").delete().eq("id", item.id);
      if (e) { setSaving(false); setError(`המחיקה נכשלה: ${e.message}`); return; }
    }
    await removeContentFiles([...new Set([...initial.media, ...item.media].map((m) => m.path))]);
    onDeleted(item.id);
    onClose();
  }

  async function addFiles(files: FileList | File[]) {
    for (const file of Array.from(files)) {
      setUploads((u) => [...u, { name: file.name, pct: 0 }]);
      try {
        const media = await uploadContentFile(item.id, file, (pct) =>
          setUploads((u) => u.map((x) => (x.name === file.name ? { ...x, pct } : x))));
        uploadedHere.current.push(media.path);
        setItem((i) => ({ ...i, media: [...i.media, media] }));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setUploads((u) => u.filter((x) => x.name !== file.name));
      }
    }
  }

  function moveMedia(idx: number, dir: -1 | 1) {
    const m = [...item.media];
    const j = idx + dir;
    if (j < 0 || j >= m.length) return;
    [m[idx], m[j]] = [m[j], m[idx]];
    set("media", m);
  }

  function dropMedia(f: MediaFile) {
    set("media", item.media.filter((m) => m.path !== f.path));
    // קובץ שהועלה עכשיו נמחק מיד; קובץ קיים נמחק רק אחרי שמירה (כדי שביטול יחזיר אותו)
    if (uploadedHere.current.includes(f.path)) void removeContentFiles([f.path]);
  }

  const copyCaption = () => { void navigator.clipboard.writeText(item.caption); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const tags = countHashtags(item.caption);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <aside className="flex h-full w-full max-w-xl flex-col border-s border-zinc-800 bg-zinc-950 shadow-2xl">
        <header className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
          <h2 className="font-semibold">{isNew ? "פוסט חדש" : "עריכת פוסט"}</h2>
          {item.source === "agent" && <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[11px] text-violet-200">נכתב ע״י הסוכן</span>}
          <div className="ms-auto flex items-center gap-1">
            {!isNew && (
              <button onClick={() => onDuplicate(item)} title="שכפול" aria-label="שכפול" className="rounded-md p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white">
                <CopyPlus className="size-4" />
              </button>
            )}
            <button onClick={remove} title="מחיקה" aria-label="מחיקה" className="rounded-md p-2 text-zinc-400 hover:bg-red-500/15 hover:text-red-300">
              <Trash2 className="size-4" />
            </button>
            <button onClick={close} title="סגירה" aria-label="סגירה" className="rounded-md p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white">
              <X className="size-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          {item.status === "published" && (
            <Banner tone="sky">
              פורסם {item.published_at && fullDateTime(item.published_at)}.
              {item.ig_permalink && (
                <a href={item.ig_permalink} target="_blank" rel="noreferrer" className="ms-1 inline-flex items-center gap-1 underline">
                  לפוסט באינסטגרם <ExternalLink className="size-3" />
                </a>
              )}
            </Banner>
          )}
          {item.status === "failed" && (
            <Banner tone="red">
              הפרסום נכשל{item.error ? `: ${item.error}` : "."}
              <button onClick={() => save({ status: "approved" })} className="ms-2 inline-flex items-center gap-1 underline"><RotateCcw className="size-3" /> לנסות שוב</button>
            </Banner>
          )}
          {item.status === "publishing" && (
            <Banner tone="violet">
              התרחיש מפרסם את הפוסט עכשיו. אם זה נתקע יותר מחצי שעה:
              <button onClick={() => save({ status: "approved" })} className="ms-1 underline">להחזיר לתור</button>
            </Banner>
          )}

          <Field label="חשבון">
            <div className="grid grid-cols-2 gap-2">
              {ACCOUNTS.map((a) => (
                <button key={a.id} onClick={() => set("account", a.id)} disabled={locked}
                  className={cn("flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm transition",
                    item.account === a.id ? `border-transparent ring-2 ${a.ring} ${a.soft}` : "border-zinc-800 text-zinc-400 hover:border-zinc-600")}>
                  <span className={cn("size-2 rounded-full", a.dot)} /><span dir="ltr">{a.label}</span>
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="פורמט">
              <select value={item.format} onChange={(e) => set("format", e.target.value as ContentItem["format"])} disabled={locked} className={input}>
                {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </Field>
            <Field label="מתי לפרסם">
              <input type="datetime-local" value={toLocalInput(item.scheduled_at)} disabled={locked}
                onChange={(e) => set("scheduled_at", fromLocalInput(e.target.value))} className={cn(input, "tabular-nums")} />
            </Field>
          </div>

          <Field label="כותרת (רק בשבילך)">
            <input value={item.title} onChange={(e) => set("title", e.target.value)} placeholder="למשל: שש בערב" className={input} maxLength={200} />
          </Field>

          <Field label="הפתיח / הטקסט על המסך">
            <textarea value={item.hook} onChange={(e) => set("hook", e.target.value)} rows={2} className={input} maxLength={1000}
              placeholder="המשפט שעוצר את הגלילה" />
          </Field>

          <Field label="מה מצלמים / תסריט">
            <textarea value={item.script} onChange={(e) => set("script", e.target.value)} rows={4} className={input} maxLength={10000} />
          </Field>

          <Field label="כיתוב לאינסטגרם" extra={
            <div className="flex items-center gap-3 text-[11px] tabular-nums">
              <span className={cn(tags > HASHTAG_MAX ? "text-red-300" : "text-zinc-500")}># {tags}/{HASHTAG_MAX}</span>
              <span className={cn(item.caption.length > CAPTION_MAX ? "text-red-300" : "text-zinc-500")}>{item.caption.length}/{CAPTION_MAX}</span>
              <button onClick={copyCaption} className="flex items-center gap-1 text-zinc-400 hover:text-white">
                {copied ? <CheckCircle2 className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />} העתקה
              </button>
            </div>
          }>
            <textarea value={item.caption} onChange={(e) => set("caption", e.target.value)} rows={8} className={cn(input, "leading-relaxed")} />
            {item.caption && (
              <p className="mt-1 text-[11px] text-zinc-500">
                מה שרואים לפני "עוד": <span className="text-zinc-300">{item.caption.split("\n")[0].slice(0, 125)}</span>
              </p>
            )}
          </Field>

          <Field label={item.format === "carousel" ? "תמונות וסרטונים (לפי הסדר, עד 10)" : "הקובץ לפרסום"}>
            <div
              onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) e.preventDefault(); }}
              onDrop={(e) => { e.preventDefault(); if (!locked) void addFiles(e.dataTransfer.files); }}
              className="space-y-2 rounded-xl border border-dashed border-zinc-700 p-2">
              {item.media.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {item.media.map((m, idx) => (
                    <div key={m.path} className="group relative aspect-[4/5] overflow-hidden rounded-lg bg-zinc-900">
                      {m.type === "video"
                        ? <video src={publicUrl(m.path)} muted playsInline controls preload="metadata" className="h-full w-full object-cover" />
                        : <img src={publicUrl(m.path)} alt="" className="h-full w-full object-cover" />}
                      <span className="absolute start-1 top-1 rounded bg-black/70 px-1.5 text-[10px]">{idx + 1}</span>
                      {!locked && (
                        <div className="absolute end-1 top-1 flex flex-col gap-1">
                          <IconBtn onClick={() => dropMedia(m)} label="הסרה"><X className="size-3" /></IconBtn>
                          {item.media.length > 1 && <>
                            <IconBtn onClick={() => moveMedia(idx, -1)} label="קודם"><ArrowUp className="size-3" /></IconBtn>
                            <IconBtn onClick={() => moveMedia(idx, 1)} label="אחר כך"><ArrowDown className="size-3" /></IconBtn>
                          </>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {uploads.map((u) => (
                <div key={u.name} className="flex items-center gap-2 text-xs text-zinc-400">
                  <Loader2 className="size-3.5 animate-spin" /> <span className="truncate">{u.name}</span>
                  <div className="h-1 flex-1 overflow-hidden rounded bg-zinc-800"><div className="h-full bg-violet-500" style={{ width: `${u.pct}%` }} /></div>
                  <span className="tabular-nums">{u.pct}%</span>
                </div>
              ))}
              {!locked && (
                <button onClick={() => fileInput.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-white">
                  <Upload className="size-4" /> העלאה או גרירה לכאן (MP4, MOV, JPG, PNG · עד 50MB)
                </button>
              )}
              <input ref={fileInput} type="file" hidden multiple accept="video/mp4,video/quicktime,image/jpeg,image/png,image/webp"
                onChange={(e) => { if (e.target.files) void addFiles(e.target.files); e.target.value = ""; }} />
            </div>
          </Field>

          <Field label="פרויקט בעורך">
            <div className="flex gap-2">
              <select value={item.project_id ?? ""} onChange={(e) => set("project_id", e.target.value || null)} className={input}>
                <option value="">בלי</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
              {item.project_id && (
                <Link href={`/p/${item.project_id}`} className="flex shrink-0 items-center gap-1 rounded-xl border border-zinc-700 px-3 text-xs text-zinc-300 hover:border-violet-500">
                  לעורך <ExternalLink className="size-3" />
                </Link>
              )}
            </div>
          </Field>

          <Field label="הערות">
            <textarea value={item.notes} onChange={(e) => set("notes", e.target.value)} rows={2} className={input} maxLength={5000} />
          </Field>

          {!locked && (
            <Field label="סטטוס">
              <div className="flex flex-wrap gap-1.5">
                {STATUSES.filter((s) => s.id === "idea" || s.id === "draft" || s.id === "approved").map((s) => (
                  <button key={s.id} onClick={() => set("status", s.id)}
                    className={cn("rounded-full px-3 py-1 text-xs transition", item.status === s.id ? s.pill + " ring-1 ring-current" : "text-zinc-500 hover:text-white")}>
                    {s.label}
                  </button>
                ))}
              </div>
            </Field>
          )}
        </div>

        <footer className="space-y-2 border-t border-zinc-800 p-4">
          {error && <p className="rounded-lg bg-red-500/10 p-2 text-xs text-red-200">{error}</p>}
          {!locked && item.status !== "approved" && missing.length > 0 && (
            <p className="text-[11px] text-zinc-500">כדי שהפוסט ייצא לבד חסר: {missing.join(", ")}</p>
          )}
          <div className="flex gap-2">
            <button onClick={() => save()} disabled={saving || uploads.length > 0}
              className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-sm font-medium hover:border-zinc-500 disabled:opacity-50">
              {saving ? <Loader2 className="mx-auto size-4 animate-spin" /> : "שמירה"}
            </button>
            {!locked && item.status !== "approved" && (
              <button onClick={() => save({ status: "approved" })} disabled={saving || uploads.length > 0 || missing.length > 0}
                title={missing.length ? `חסר: ${missing.join(", ")}` : "הפוסט ייצא לבד בזמן שנקבע"}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500">
                <CheckCircle2 className="size-4" /> אישור לפרסום
              </button>
            )}
          </div>
        </footer>
      </aside>
    </div>
  );
}

const input = "w-full rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none disabled:opacity-60";

function Field({ label, extra, children }: { label: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-xs font-medium text-zinc-400"><span>{label}</span>{extra}</div>
      {children}
    </div>
  );
}

function Banner({ tone, children }: { tone: "sky" | "red" | "violet"; children: React.ReactNode }) {
  const c = { sky: "border-sky-500/30 bg-sky-500/10 text-sky-100", red: "border-red-500/30 bg-red-500/10 text-red-100", violet: "border-violet-500/30 bg-violet-500/10 text-violet-100" }[tone];
  return <div className={cn("rounded-xl border p-3 text-sm", c)}>{children}</div>;
}

function IconBtn({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={(e) => { e.preventDefault(); onClick(); }} title={label} aria-label={label}
      className="grid size-6 place-items-center rounded-full bg-black/70 text-white hover:bg-black">
      {children}
    </button>
  );
}
