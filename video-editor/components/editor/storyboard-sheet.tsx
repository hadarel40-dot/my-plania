"use client";
import { useEffect, useState } from "react";
import { Check, Loader2, MessageSquarePlus, RotateCcw, Scissors } from "lucide-react";
import { useStoryboard, type Scene } from "@/lib/editor/storyboard";
import { formatTime } from "@/lib/editor/timeline-utils";
import { cn } from "@/lib/utils";

const LAYOUT_NAMES: Record<string, string> = { full: "על כל המסך", top: "בחצי העליון", pip: "בחלון קטן" };

/**
 * הסטוריבורד: התוכנית של העורך לפני שהוא בונה. כל סצנה עם תמונה, זמן והטקסט, מה נשאר
 * ומה נחתך, ואיזה צילום מסך נכנס בה. מאשרים, משנים, או משאירים הערה והעורך מתקן.
 */
export function StoryboardSheet() {
  const { open, busy, scenes: initial, hook: initialHook, cta, summary, round, resolve } = useStoryboard();
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [hook, setHook] = useState("");
  const [general, setGeneral] = useState("");
  const [noteOpen, setNoteOpen] = useState<number | null>(null);
  useEffect(() => { setScenes(initial); setHook(initialHook); setGeneral(""); setNoteOpen(null); }, [initial, initialHook]);
  if (!open) return null;

  const kept = scenes.filter((s) => s.keep);
  const seconds = kept.reduce((sum, s) => sum + s.end - s.start, 0);
  const hasNotes = !!general.trim() || scenes.some((s) => s.note.trim());
  const patch = (i: number, p: Partial<Scene>) => setScenes((list) => list.map((s, k) => (k === i ? { ...s, ...p } : s)));

  return (
    <div dir="rtl" className="fixed inset-0 z-[60] flex flex-col bg-zinc-950/95 backdrop-blur md:items-center md:justify-center md:p-6">
      <div className="flex min-h-0 w-full flex-1 flex-col md:max-w-2xl md:flex-none md:rounded-2xl md:border md:border-zinc-800 md:bg-zinc-900 md:max-h-[90dvh]">
        <header className="border-b border-zinc-800 px-4 py-3">
          <h2 className="text-base font-semibold">📋 התוכנית לסרטון{round ? ` (גרסה ${round + 1})` : ""}</h2>
          <p className="text-xs leading-relaxed text-zinc-400">{summary || "ככה אני מתכנן לערוך. אפשר לשנות לפני שאני בונה."}</p>
          <p className="mt-1 text-[11px] text-zinc-500">{kept.length} מתוך {scenes.length} משפטים נשארים · בערך {Math.round(seconds)} שניות דיבור</p>
        </header>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          <label className="block space-y-1 rounded-xl bg-violet-500/10 p-2.5">
            <span className="text-xs font-medium text-violet-200">🪝 ההוק (מופיע בשניות הראשונות)</span>
            <input value={hook} onChange={(e) => setHook(e.target.value)} dir="auto"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-base focus:border-violet-400 focus:outline-none md:text-sm" />
          </label>

          {scenes.map((s, i) => (
            <div key={s.index} className={cn("rounded-xl border p-2 transition", s.keep ? "border-zinc-800 bg-zinc-900" : "border-red-900/40 bg-red-950/20")}>
              <div className="flex gap-2">
                <div className={cn("relative h-20 w-14 shrink-0 overflow-hidden rounded-md bg-zinc-800", !s.keep && "opacity-40 grayscale")}>
                  {s.thumb && <img src={s.thumb} alt="" className="size-full object-cover" />}
                  <span className="absolute bottom-0 inset-x-0 bg-black/60 text-center font-mono text-[9px] text-white" dir="ltr">{formatTime(s.start).slice(0, 5)}</span>
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className={cn("text-sm leading-snug", !s.keep && "text-zinc-500 line-through")}>{s.text}</p>
                  <div className="flex flex-wrap gap-1 text-[11px]">
                    {s.moment && s.keep && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-200">✨ קופץ: {s.moment}</span>}
                    {s.insert && s.keep && (
                      <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-200">
                        {s.insert.image && <img src={s.insert.image} alt="" className="size-4 rounded object-cover" />}
                        {s.insert.name.slice(0, 18)} · {LAYOUT_NAMES[s.insert.layout] ?? ""} · {Math.round(s.insert.seconds)} שנ׳
                      </span>
                    )}
                    {!s.keep && <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-red-200">✂ נחתך</span>}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <button onClick={() => patch(i, { keep: !s.keep })} aria-label={s.keep ? "לחתוך את המשפט" : "להשאיר את המשפט"}
                    className={cn("flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px]", s.keep ? "border-zinc-700 text-zinc-300" : "border-emerald-600 text-emerald-300")}>
                    {s.keep ? <><Scissors className="size-3" /> לחתוך</> : <><RotateCcw className="size-3" /> להשאיר</>}
                  </button>
                  <button onClick={() => setNoteOpen(noteOpen === i ? null : i)} aria-label="הערה לסצנה"
                    className={cn("flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px]", s.note ? "border-violet-500 text-violet-200" : "border-zinc-700 text-zinc-400")}>
                    <MessageSquarePlus className="size-3" /> הערה
                  </button>
                </div>
              </div>
              {noteOpen === i && (
                <input autoFocus value={s.note} onChange={(e) => patch(i, { note: e.target.value })} dir="auto" placeholder="למשל: כאן לשים את צילום המסך של המחיר"
                  className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-base focus:border-violet-400 focus:outline-none md:text-sm" />
              )}
            </div>
          ))}

          {cta && <p className="rounded-xl bg-zinc-900 p-2.5 text-xs text-zinc-300">📣 בסוף: &quot;{cta}&quot;</p>}
          <textarea value={general} onChange={(e) => setGeneral(e.target.value)} rows={2} dir="auto" placeholder="הערה כללית (לא חובה): למשל &quot;לפתוח במשפט על המחיר&quot;"
            className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-base focus:border-violet-400 focus:outline-none md:text-sm" />
        </div>

        <footer className="space-y-2 border-t border-zinc-800 p-3 pb-[max(env(safe-area-inset-bottom),12px)]">
          {busy ? (
            <p className="flex items-center justify-center gap-2 py-2 text-sm text-zinc-300"><Loader2 className="size-4 animate-spin" /> {busy}</p>
          ) : (
            <>
              <button onClick={() => resolve?.({ action: "approve", scenes, hook })}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-violet-600 to-fuchsia-600 py-3 text-base font-semibold">
                <Check className="size-5" /> אישור, לבנות את הסרטון
              </button>
              <div className="flex gap-2">
                <button onClick={() => resolve?.({ action: "notes", scenes, hook, general })} disabled={!hasNotes}
                  className="flex-1 rounded-xl border border-violet-500/60 py-2 text-sm text-violet-200 disabled:opacity-40">🔁 לתקן לפי ההערות</button>
                <button onClick={() => resolve?.({ action: "skip" })} className="rounded-xl border border-zinc-700 px-3 py-2 text-xs text-zinc-400">בלי שינויים</button>
              </div>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
