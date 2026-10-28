"use client";
import { useRef, useState } from "react";
import { Download, Film, Loader2, X } from "lucide-react";
import { useEditor } from "@/stores/editor-store";
import { renderToMp4, type ExportQuality } from "@/lib/export/render-video";
import { cn } from "@/lib/utils";

type Phase = { kind: "idle" } | { kind: "rendering"; progress: number } | { kind: "done"; url: string; size: number } | { kind: "error"; message: string };

/** ייצוא הפרויקט לקובץ MP4, כולו בתוך הדפדפן */
export function ExportDialog({ onClose }: { onClose: () => void }) {
  const title = useEditor((s) => s.title);
  const [quality, setQuality] = useState<ExportQuality>("1080p");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  async function start() {
    const { timeline, assets } = useEditor.getState();
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase({ kind: "rendering", progress: 0 });
    try {
      const blob = await renderToMp4(timeline, assets, {
        quality,
        signal: controller.signal,
        onProgress: (progress) => setPhase({ kind: "rendering", progress }),
      });
      setPhase({ kind: "done", url: URL.createObjectURL(blob), size: blob.size });
    } catch (e) {
      if (controller.signal.aborted) setPhase({ kind: "idle" });
      else setPhase({ kind: "error", message: e instanceof Error ? e.message : "הייצוא נכשל" });
    }
  }

  function close() {
    abortRef.current?.abort();
    if (phase.kind === "done") URL.revokeObjectURL(phase.url);
    onClose();
  }

  const fileName = `${(title || "video").replace(/[\\/:*?"<>|]+/g, "-")}.mp4`;

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
              הסרטון נוצר כאן במחשב, בלי לשלוח אותו לשום מקום. זה לוקח בערך כמו אורך הסרטון, ובזמן הזה כדאי להשאיר את הלשונית פתוחה.
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
            <video src={phase.url} controls className="max-h-64 w-full rounded-lg bg-black" />
            <a href={phase.url} download={fileName}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-sm font-medium hover:bg-emerald-500">
              <Download className="size-4" /> הורדת הסרטון ({(phase.size / 1024 / 1024).toFixed(1)}MB)
            </a>
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
