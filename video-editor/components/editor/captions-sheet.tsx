"use client";
import { useState } from "react";
import { create } from "zustand";
import { Merge, Scissors, Search, Trash2, X } from "lucide-react";
import { beginGesture, useEditor } from "@/stores/editor-store";
import { usePlayback } from "@/stores/playback-store";
import { mergeWithNext, rechunk, removeCaption, replaceEverywhere, singleWordChange, splitInHalf } from "@/lib/editor/caption-edit";
import { loadMyStyle, rememberStyle } from "@/lib/editor/my-style";
import { formatTime } from "@/lib/editor/timeline-utils";
import type { Caption } from "@/lib/editor/types";
import { cn } from "@/lib/utils";

/** מגירת "כל הכתוביות": פתיחה מכל מקום (מהבודק של כתובית, מלשונית טקסט, מהתיקונים בלחיצה) */
export const useCaptionsSheet = create<{ open: boolean }>(() => ({ open: false }));
export const openCaptionsSheet = () => useCaptionsSheet.setState({ open: true });

/**
 * כל הכתוביות ברשימה אחת, לתיקון מהיר: עורכים טקסט במקום, לחיצה על הזמן קופצת לשם בנגן,
 * ואפשר לאחד, לפצל ולמחוק. מילה שתוקנה אפשר להחליף בכל הכתוביות, והעורך זוכר את התיקון
 * לתמלולים הבאים (וגם מלמד את Gemini את המילה).
 */
export function CaptionsSheet() {
  const open = useCaptionsSheet((s) => s.open);
  const captions = useEditor((s) => s.timeline.captions);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [remember, setRemember] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [suggest, setSuggest] = useState<{ from: string; to: string } | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  if (!open) return null;
  const sorted = [...captions].sort((a, b) => a.start - b.start);
  const close = () => { useCaptionsSheet.setState({ open: false }); setMessage(null); setSuggest(null); };

  const doReplace = (f: string, t: string) => {
    const end = beginGesture();
    const n = replaceEverywhere(f, t, remember);
    end();
    setMessage(n ? `הוחלף ב-${n} כתוביות${remember ? " · נזכור את זה לפעם הבאה" : ""}` : `לא נמצא "${f}"`);
    setSuggest(null);
  };

  return (
    <div dir="rtl" className="fixed inset-x-0 bottom-0 z-50 flex h-[64dvh] flex-col rounded-t-2xl border-t border-zinc-700 bg-zinc-900 shadow-2xl md:inset-x-auto md:end-4 md:bottom-4 md:h-[80dvh] md:w-[26rem] md:rounded-2xl md:border">
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5">
        <h2 className="text-sm font-semibold">✏️ כל הכתוביות ({sorted.length})</h2>
        <button onClick={close} aria-label="סגירה" className="grid size-8 place-items-center rounded-full text-zinc-400 hover:bg-zinc-800"><X className="size-4" /></button>
      </header>

      <div className="space-y-2 border-b border-zinc-800 px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <Search className="size-4 shrink-0 text-zinc-500" />
          <input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="מילה שגויה" dir="auto"
            className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm focus:border-violet-500 focus:outline-none" />
          <span className="text-zinc-500">←</span>
          <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="המילה הנכונה" dir="auto"
            className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm focus:border-violet-500 focus:outline-none" />
          <button onClick={() => doReplace(from, to)} disabled={!from.trim()}
            className="shrink-0 rounded-md bg-violet-600 px-2.5 py-1.5 text-xs font-medium disabled:opacity-40">החלפה בכולן</button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <label className="flex items-center gap-1.5 text-zinc-400">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="accent-violet-500" />
            לזכור את התיקון לסרטונים הבאים
          </label>
          <span className="flex items-center gap-1 text-zinc-400">
            מילים בכל כתובית:
            {[1, 2, 3, 4].map((n) => (
              <button key={n} onClick={() => { const end = beginGesture(); rechunk(n); end(); setMessage(`עכשיו עד ${n} ${n === 1 ? "מילה" : "מילים"} בכל כתובית`); }}
                className="rounded border border-zinc-700 px-2 py-0.5 hover:border-violet-500">{n}</button>
            ))}
          </span>
        </div>
        {message && <p className="text-[11px] text-emerald-300">✓ {message}</p>}
        {suggest && (
          <div className="flex items-center gap-2 rounded-md bg-violet-500/15 p-2 text-xs">
            <span className="flex-1">להחליף את &quot;{suggest.from}&quot; ב&quot;{suggest.to}&quot; בכל הכתוביות?</span>
            <button onClick={() => doReplace(suggest.from, suggest.to)} className="rounded bg-violet-600 px-2 py-1 font-medium">כן, בכולן</button>
            <button onClick={() => setSuggest(null)} className="text-zinc-400">לא</button>
          </div>
        )}
        <Dictionary />
      </div>

      <div className="min-h-0 flex-1 divide-y divide-zinc-800 overflow-y-auto">
        {!sorted.length && <p className="p-6 text-center text-sm text-zinc-500">אין עדיין כתוביות. אפשר ליצור אותן ב&quot;כתוביות אוטומטיות&quot; בציר הזמן.</p>}
        {sorted.map((c, i) => (
          <Row key={c.id} caption={c} last={i === sorted.length - 1} active={current === c.id}
            onFocus={() => { setCurrent(c.id); usePlayback.getState().seek(c.start + 0.01); }}
            onWordFix={(fix) => setSuggest(fix)} />
        ))}
      </div>
    </div>
  );
}

function Row({ caption, last, active, onFocus, onWordFix }: {
  caption: Caption; last: boolean; active: boolean; onFocus: () => void; onWordFix: (fix: { from: string; to: string }) => void;
}) {
  const [before, setBefore] = useState(caption.text);
  return (
    <div className={cn("flex items-start gap-2 px-3 py-2", active && "bg-violet-500/10")}>
      <button onClick={onFocus} className="mt-1.5 shrink-0 font-mono text-[11px] tabular-nums text-zinc-500 hover:text-white" dir="ltr">
        {formatTime(caption.start).slice(0, 5)}
      </button>
      <textarea value={caption.text} rows={caption.text.length > 22 ? 2 : 1} dir="auto"
        onFocus={() => { setBefore(caption.text); onFocus(); }}
        onChange={(e) => useEditor.getState().updateCaption(caption.id, { text: e.target.value })}
        onBlur={(e) => { const fix = singleWordChange(before, e.target.value); if (fix && fix.from && fix.to) onWordFix(fix); }}
        className="min-h-9 flex-1 resize-none rounded-md border border-transparent bg-transparent px-2 py-1.5 text-[15px] leading-snug hover:border-zinc-700 focus:border-violet-500 focus:bg-zinc-950 focus:outline-none" />
      <div className="flex shrink-0 items-center gap-0.5 pt-1 text-zinc-500">
        <IconBtn label="פיצול לשתיים" onClick={() => splitInHalf(caption.id)}><Scissors className="size-3.5" /></IconBtn>
        {!last && <IconBtn label="איחוד עם הבאה" onClick={() => mergeWithNext(caption.id)}><Merge className="size-3.5" /></IconBtn>}
        <IconBtn label="מחיקה" onClick={() => removeCaption(caption.id)}><Trash2 className="size-3.5" /></IconBtn>
      </div>
    </div>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={() => { const end = beginGesture(); onClick(); end(); }} title={label} aria-label={label}
      className="grid size-7 place-items-center rounded hover:bg-zinc-800 hover:text-white">{children}</button>
  );
}

/** המילון שלי: התיקונים שנזכרים, עם אפשרות למחוק */
function Dictionary() {
  const [dict, setDict] = useState(() => (typeof window === "undefined" ? {} : loadMyStyle().dictionary ?? {}));
  const entries = Object.entries(dict);
  if (!entries.length) return null;
  const remove = (k: string) => {
    const next = { ...dict };
    delete next[k];
    rememberStyle({ dictionary: next });
    setDict(next);
  };
  return (
    <details className="text-[11px] text-zinc-400">
      <summary className="cursor-pointer">📖 המילון שלי ({entries.length}): מתוקן אוטומטית בכל תמלול</summary>
      <div className="mt-1 flex flex-wrap gap-1">
        {entries.map(([k, v]) => (
          <span key={k} className="flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-0.5">
            {k} ← {v}
            <button onClick={() => remove(k)} aria-label="מחיקה מהמילון" className="text-zinc-500 hover:text-white">×</button>
          </span>
        ))}
      </div>
    </details>
  );
}
