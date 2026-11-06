"use client";
import { useState } from "react";
import { Loader2, Mic } from "lucide-react";
import { beginGesture, useEditor } from "@/stores/editor-store";
import { cleanVoices, setVoice } from "@/lib/editor/voice-fix";
import { cn } from "@/lib/utils";

/** הקול שלי: ניקוי רעשים + קול פודקאסט בלחיצה, ומעבר בין הקול המקורי לנקי */
export function VoiceCard() {
  const voice = useEditor((s) => s.timeline.voice);
  const ready = useEditor((s) => s.timeline.clips.some((c) => s.assets[c.sourceAssetId]?.cleanAudio));
  const hasClips = useEditor((s) => s.timeline.clips.length > 0);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setMsg(null); setBusy("מתחיל…");
    const end = beginGesture();
    try {
      const { noiseCutDb } = await cleanVoices(setBusy);
      setMsg(`הקול נוקה${noiseCutDb >= 3 ? ` (רעש הרקע ירד ב-${Math.round(noiseCutDb)} dB)` : ""} ושופר לקול פודקאסט`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "לא הצלחתי לשפר את הקול");
    } finally {
      end(); setBusy(null);
    }
  }
  const toggle = (clean: boolean) => { const end = beginGesture(); setVoice(clean); end(); };

  return (
    <div className="space-y-2 rounded-xl border border-violet-500/30 bg-violet-500/5 p-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold"><Mic className="size-4 text-violet-300" /> הקול שלי</p>
      <p className="text-[11px] leading-relaxed text-zinc-400">ניקוי רעשי רקע (מזגן, רחוב, הד) וקול פודקאסט: חם, ברור ובעוצמה אחידה. הכל קורה בטלפון, והחיתוכים והכתוביות נשארים במקום.</p>
      {busy ? (
        <p className="flex items-center gap-1.5 text-xs text-zinc-300"><Loader2 className="size-3.5 animate-spin" /> {busy}</p>
      ) : ready ? (
        <div className="grid grid-cols-2 gap-1.5">
          {([[false, "🎤 קול מקורי"], [true, "🎙️ קול נקי (פודקאסט)"]] as const).map(([clean, label]) => (
            <button key={label} onClick={() => toggle(clean)}
              className={cn("rounded-lg border py-2 text-xs", (voice === "clean") === clean ? "border-violet-400 bg-violet-500/15 text-white" : "border-zinc-700 text-zinc-400")}>{label}</button>
          ))}
        </div>
      ) : (
        <button onClick={run} disabled={!hasClips} className="w-full rounded-lg bg-gradient-to-l from-violet-600 to-fuchsia-600 py-2.5 text-sm font-semibold disabled:opacity-40">
          ✨ ניקוי רעשים + קול פודקאסט
        </button>
      )}
      {msg && <p className="text-xs text-emerald-300">✓ {msg}</p>}
    </div>
  );
}
