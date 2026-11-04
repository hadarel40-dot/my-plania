"use client";
import { useRef, useState } from "react";
import { Download, Film, Loader2, Share2, X } from "lucide-react";
import { useEditor } from "@/stores/editor-store";
import type { ExportQuality } from "@/lib/export/render-video";
import { cn } from "@/lib/utils";
import { keepAwake } from "@/lib/keep-awake";
import { errorText, logEvent } from "@/lib/telemetry";

/** בטלפון: תפריט השיתוף של המכשיר, שבו יש "שמירה" לגלריה (ואינסטגרם, וואטסאפ...) */
function canShareFiles(files: File[]) {
  if (typeof navigator === "undefined" || !navigator.canShare) return false;
  try { return navigator.canShare({ files }); } catch { return false; }
}

async function shareFiles(files: File[]) {
  try {
    await navigator.share({ files });
    logEvent("export_shared", { files: files.length });
  } catch { /* המשתמש סגר את התפריט */ }
}

type Phase = { kind: "idle" } | { kind: "rendering"; progress: number } | { kind: "done"; url: string; size: number; blob: Blob } | { kind: "error"; message: string };
type Cover = { blob: Blob; url: string } | "making" | null;

/** ייצוא הפרויקט לקובץ MP4, כולו בתוך הדפדפן */
export function ExportDialog({ onClose }: { onClose: () => void }) {
  const title = useEditor((s) => s.title);
  // בטלפון 720p כברירת מחדל: מהיר יותר ופחות עומס על הזיכרון
  const [quality, setQuality] = useState<ExportQuality>(() =>
    typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches ? "720p" : "1080p");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const abortRef = useRef<AbortController | null>(null);
  const [cover, setCover] = useState<Cover>(null);

  async function start() {
    const { timeline, assets } = useEditor.getState();
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase({ kind: "rendering", progress: 0 });
    const release = keepAwake();
    const started = Date.now();
    logEvent("export_start", { quality, clips: timeline.clips.length });
    try {
      // מנוע הייצוא כבד, ולכן נטען רק כשמייצאים
      const { renderToMp4 } = await import("@/lib/export/render-video");
      const blob = await renderToMp4(timeline, assets, {
        quality,
        signal: controller.signal,
        onProgress: (progress) => setPhase({ kind: "rendering", progress }),
      });
      logEvent("export_done", { quality, size: blob.size, ms: Date.now() - started });
      setPhase({ kind: "done", url: URL.createObjectURL(blob), size: blob.size, blob });
      // תמונת שער: הפריים הכי יפה עם משפט הפתיחה (אם לא מצליח, שומרים רק את הסרטון)
      setCover("making");
      import("@/lib/export/cover")
        .then(({ makeCover }) => makeCover(timeline, assets))
        .then((c) => setCover(c ? { blob: c, url: URL.createObjectURL(c) } : null))
        .catch((e) => { logEvent("cover_failed", { error: errorText(e) }); setCover(null); });
    } catch (e) {
      if (controller.signal.aborted) setPhase({ kind: "idle" });
      else {
        logEvent("export_failed", { quality, ms: Date.now() - started, error: errorText(e) });
        setPhase({ kind: "error", message: e instanceof Error ? e.message : "הייצוא נכשל" });
      }
    } finally {
      release();
    }
  }

  function close() {
    abortRef.current?.abort();
    if (phase.kind === "done") URL.revokeObjectURL(phase.url);
    if (cover && cover !== "making") URL.revokeObjectURL(cover.url);
    onClose();
  }

  const baseName = (title || "video").replace(/[\\/:*?"<>|]+/g, "-");
  const fileName = `${baseName}.mp4`;
  const files = phase.kind === "done"
    ? [new File([phase.blob], fileName, { type: "video/mp4" }), ...(cover && cover !== "making" ? [new File([cover.blob], `${baseName} - שער.jpg`, { type: "image/jpeg" })] : [])]
    : [];
  // אם המכשיר לא יודע לשתף סרטון ותמונה יחד, משתפים רק את הסרטון
  const shareable = files.length && canShareFiles(files) ? files : files.length && canShareFiles(files.slice(0, 1)) ? files.slice(0, 1) : null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={close}>
      <div role="dialog" aria-label="ייצוא סרטון" onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold"><Film className="size-5 text-violet-400" /> ייצוא סרטון</h2>
          <button onClick={close} aria-label="סגור" className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"><X className="size-4" /></button>
        </div>

        {phase.kind === "idle" && (
          <>
            <div className="grid grid-cols-2 gap-2">
              {(["720p", "1080p"] as const).map((q) => (
                <button key={q} onClick={() => setQuality(q)}
                  className={cn("rounded-lg border p-3 text-sm", q === quality ? "border-violet-500 bg-violet-500/15" : "border-zinc-700 hover:border-zinc-500")}>
                  <div className="font-semibold" dir="ltr">{q}</div>
                  <div className="text-xs text-zinc-400">{q === "720p" ? "מהיר, קובץ קטן" : "איכות מלאה"}</div>
                </button>
              ))}
            </div>
            <p className="text-xs leading-relaxed text-zinc-400">
              הסרטון נוצר כאן במכשיר, בלי לשלוח אותו לשום מקום. זה לוקח בערך כמו אורך הסרטון, ובזמן הזה כדאי להשאיר את הלשונית פתוחה.
            </p>
            <button onClick={start} className="w-full rounded-lg bg-violet-600 py-2.5 text-sm font-medium hover:bg-violet-500">
              התחלת ייצוא
            </button>
          </>
        )}

        {phase.kind === "rendering" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm"><Loader2 className="size-4 animate-spin" /> מייצר את הסרטון… {phase.progress}%</div>
            <div className="h-2 overflow-hidden rounded bg-zinc-800">
              <div className="h-full bg-violet-500 transition-[width]" style={{ width: `${phase.progress}%` }} />
            </div>
            <button onClick={() => abortRef.current?.abort()} className="w-full rounded-lg border border-zinc-700 py-2 text-sm hover:bg-zinc-800">ביטול</button>
          </div>
        )}

        {phase.kind === "done" && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <video src={phase.url} controls playsInline className="max-h-64 min-w-0 flex-1 rounded-lg bg-black" />
              {cover && (
                <div className="w-24 shrink-0 text-center">
                  {cover === "making"
                    ? <div className="grid aspect-[9/16] place-items-center rounded-lg bg-zinc-800"><Loader2 className="size-4 animate-spin" /></div>
                    // eslint-disable-next-line @next/next/no-img-element
                    : <img src={cover.url} alt="תמונת שער" className="aspect-[9/16] w-full rounded-lg object-cover" />}
                  <span className="text-[10px] text-zinc-400">תמונת שער</span>
                </div>
              )}
            </div>
            {shareable && (
              <button onClick={() => shareFiles(shareable)} disabled={cover === "making"}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-l from-violet-600 to-fuchsia-600 py-3 text-sm font-semibold disabled:opacity-60">
                <Share2 className="size-4" /> {cover === "making" ? "מכין תמונת שער…" : shareable.length > 1 ? "שמירה לגלריה (סרטון + שער)" : "שמירה לגלריה או שיתוף"}
              </button>
            )}
            {shareable && shareable.length > 1 && (
              <p className="text-[11px] leading-relaxed text-zinc-400">בתפריט שנפתח בוחרים &quot;שמירה&quot;. באינסטגרם: עריכת שער ← הוספה מהגלריה ← תמונת השער.</p>
            )}
            <a href={phase.url} download={fileName}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-sm font-medium hover:bg-emerald-500">
              <Download className="size-4" /> הורדת הסרטון ({(phase.size / 1024 / 1024).toFixed(1)}MB)
            </a>
            {cover && cover !== "making" && (
              <a href={cover.url} download={`${baseName} - שער.jpg`} className="block text-center text-xs text-zinc-400 underline">הורדת תמונת השער</a>
            )}
          </div>
        )}

        {phase.kind === "error" && (
          <div className="space-y-3">
            <p className="rounded-md bg-red-500/10 p-3 text-sm text-red-300">{phase.message}</p>
            <button onClick={() => setPhase({ kind: "idle" })} className="w-full rounded-lg border border-zinc-700 py-2 text-sm hover:bg-zinc-800">נסו שוב</button>
          </div>
        )}
      </div>
    </div>
  );
}
