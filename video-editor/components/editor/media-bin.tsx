"use client";
import { useEffect, useRef, useState } from "react";
import { Film, Loader2, Music, Plus, Upload } from "lucide-react";
import { usePlayback } from "@/stores/playback-store";
import { useEditor } from "@/stores/editor-store";
import { useUploads } from "@/stores/upload-store";
import { logEvent } from "@/lib/telemetry";
import { formatTime } from "@/lib/editor/timeline-utils";
import { cn } from "@/lib/utils";

const UPLOAD_STAGE = { waiting: "ממתין", compress: "מכינים", upload: "מעלה" } as const;

export function MediaBin() {
  const assets = useEditor((s) => s.assets);
  const { addClip, addAudioClip } = useEditor.getState();
  // וידאו נכנס לסוף מסלול הווידאו; שמע נכנס למסלול הסאונד בנקודת הניגון
  const addToTimeline = (a: { id: string; kind?: string }) =>
    a.kind === "audio" ? addAudioClip(a.id, usePlayback.getState().currentTime) : addClip(a.id);
  const uploads = useUploads((s) => s.items);
  const errors = useUploads((s) => s.errors);
  const [dragOver, setDragOver] = useState(false);

  function handleFiles(files: FileList | null) {
    logEvent("files_selected", { count: files?.length ?? 0 });
    if (!files?.length) return;
    useUploads.getState().clearErrors();
    useUploads.getState().enqueue([...files]);
  }

  return (
    <aside className="flex min-h-0 w-full flex-1 flex-col border-zinc-800 bg-zinc-900/40 md:w-64 md:flex-none md:shrink-0 md:border-e">
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Film className="size-4" /> מדיה</h2>
        {/* label ולא כפתור שקורא ל-click(): באייפון זו הדרך האמינה לפתוח את בחירת הקבצים */}
        <label className="flex cursor-pointer items-center gap-1 rounded-md bg-zinc-800 px-2 py-1 text-xs hover:bg-zinc-700">
          <Upload className="size-3.5" /> העלאה
          <FileInput onFiles={handleFiles} />
        </label>
      </header>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        className={cn("flex-1 space-y-2 overflow-y-auto p-3 transition", dragOver && "bg-blue-500/10 ring-2 ring-inset ring-blue-500")}
      >
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-700 py-4 text-sm text-zinc-300 hover:border-violet-500 hover:text-white md:hidden">
          <Upload className="size-4" /> העלאת סרטונים מהטלפון
          <FileInput onFiles={handleFiles} />
        </label>
        {uploads.length > 0 && (
          <p className="rounded-md bg-amber-500/10 p-2 text-[11px] leading-relaxed text-amber-200">
            כדאי להשאיר את המסך פתוח עד שההעלאה מסתיימת.
          </p>
        )}
        {uploads.map((u) => (
          <div key={u.id} className="rounded-md border border-zinc-800 p-2 text-xs">
            <div className="flex items-center gap-2">
              {u.stage === "waiting" ? <span className="size-3" /> : <Loader2 className="size-3 shrink-0 animate-spin" />}
              <span className="min-w-0 flex-1 truncate">{u.name}</span>
              <span className="shrink-0 text-zinc-500">{UPLOAD_STAGE[u.stage]} {u.stage !== "waiting" && `${u.progress}%`}</span>
            </div>
            <div className="mt-1.5 h-1 rounded bg-zinc-800"><div className="h-full rounded bg-blue-500 transition-[width]" style={{ width: `${u.progress}%` }} /></div>
          </div>
        ))}
        {errors.map((e) => <p key={e} className="rounded-md bg-red-500/10 p-2 text-xs text-red-300">{e}</p>)}

        {/* תוצאות AI מופיעות בפאנל הווריאציות, לא בספרייה */}
        {Object.values(assets).filter((a) => a.origin !== "ai_variant" && a.origin !== "library").map((a) => (
          <div key={a.id} onDoubleClick={() => addToTimeline(a)}
            className="group flex gap-2 rounded-md border border-transparent p-1.5 hover:border-zinc-700 hover:bg-zinc-800/50">
            <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded bg-zinc-800">
              {a.kind === "audio"
                ? <div className="grid h-full place-items-center bg-emerald-900/60 text-emerald-300"><Music className="size-4" /></div>
                : a.thumbnailUrl && <img src={a.thumbnailUrl} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1 text-xs">
              <p className="truncate font-medium">{a.name}</p>
              <p className="text-zinc-500" dir="ltr">{formatTime(a.duration).slice(0, 5)}{a.kind === "audio" ? " · שמע" : ` · ${a.width}×${a.height}`}</p>
              <p className="text-[10px] text-zinc-600">
                {a.origin === "sample" ? "דוגמה" : a.storagePath ? "בענן" : "מקומי"}
              </p>
            </div>
            {a.kind !== "audio" && (
              <button onClick={() => useEditor.getState().addLayer(a.id, usePlayback.getState().currentTime)} title="שכבה מעל הסרטון (אוברליי)" aria-label="הוספה כשכבה"
                className="self-center rounded-md border border-emerald-600/60 px-1.5 py-1 text-[11px] text-emerald-300 hover:bg-emerald-900/40">
                ⧉ שכבה
              </button>
            )}
            <button onClick={() => addToTimeline(a)} title="הוסף לציר הזמן" aria-label="הוסף לציר הזמן"
              className="self-center rounded p-1 text-zinc-500 hover:bg-zinc-700 hover:text-white md:opacity-0 md:group-hover:opacity-100">
              <Plus className="size-4" />
            </button>
          </div>
        ))}

        <p className="pt-2 text-center text-[11px] leading-relaxed text-zinc-600">
          <span className="md:hidden">+ מוסיף לסוף הסרטון · ⧉ שכבה מוסיף מעל הסרטון (חלון, תאומים, מסך מפוצל)</span>
          <span className="hidden md:inline">גרור קבצים לכאן · לחיצה כפולה מוסיפה לציר הזמן</span>
        </p>
      </div>
    </aside>
  );
}

export function FileInput({ onFiles }: { onFiles: (files: FileList | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  // סגירת הגלריה בלי לבחור: מורידים את ההודעה "בוחרים סרטונים"
  useEffect(() => {
    const el = ref.current;
    const cancel = () => useUploads.getState().setPicking(false);
    el?.addEventListener("cancel", cancel);
    return () => el?.removeEventListener("cancel", cancel);
  }, []);
  return (
    <input ref={ref} type="file" accept="video/*,image/*,audio/*" multiple className="sr-only"
      // מיד בלחיצה מראים שמשהו קורה: באייפון עוברות כמה שניות בין הבחירה לבין הגעת הקבצים
      onClick={() => useUploads.getState().setPicking(true)}
      onChange={(e) => {
        const files = e.target.files;
        if (!files?.length) useUploads.getState().setPicking(false);
        onFiles(files);
        e.target.value = "";
      }} />
  );
}
