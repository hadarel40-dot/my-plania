"use client";
import { useRef, useState } from "react";
import { Film, Loader2, Music, Plus, Upload } from "lucide-react";
import { usePlayback } from "@/stores/playback-store";
import { useEditor } from "@/stores/editor-store";
import { importFile } from "@/lib/media/import";
import { formatTime } from "@/lib/editor/timeline-utils";
import { cn } from "@/lib/utils";

export function MediaBin() {
  const assets = useEditor((s) => s.assets);
  const { addAsset, addClip, addAudioClip } = useEditor.getState();
  // וידאו נכנס לסוף מסלול הווידאו; שמע נכנס למסלול הסאונד בנקודת הניגון
  const addToTimeline = (a: { id: string; kind?: string }) =>
    a.kind === "audio" ? addAudioClip(a.id, usePlayback.getState().currentTime) : addClip(a.id);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<{ name: string; progress: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    setError(null);
    await Promise.all([...files].map(async (file) => {
      setUploads((u) => [...u, { name: file.name, progress: 0 }]);
      try {
        const asset = await importFile(file, (progress) =>
          setUploads((u) => u.map((x) => (x.name === file.name ? { ...x, progress } : x))));
        addAsset(asset);
      } catch (e) {
        setError(e instanceof Error ? e.message : "ההעלאה נכשלה");
      } finally {
        setUploads((u) => u.filter((x) => x.name !== file.name));
      }
    }));
  }

  return (
    <aside className="flex w-full min-h-0 shrink-0 flex-col border-zinc-800 bg-zinc-900/40 md:w-64 md:border-e">
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Film className="size-4" /> מדיה</h2>
        <button onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1 rounded-md bg-zinc-800 px-2 py-1 text-xs hover:bg-zinc-700">
          <Upload className="size-3.5" /> העלאה
        </button>
        <input ref={inputRef} type="file" accept="video/*,audio/*" multiple hidden
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
      </header>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        className={cn("flex-1 space-y-2 overflow-y-auto p-3 transition", dragOver && "bg-blue-500/10 ring-2 ring-inset ring-blue-500")}
      >
        {uploads.map((u) => (
          <div key={u.name} className="rounded-md border border-zinc-800 p-2 text-xs">
            <div className="flex items-center gap-2 truncate"><Loader2 className="size-3 animate-spin" />{u.name}</div>
            <div className="mt-1.5 h-1 rounded bg-zinc-800"><div className="h-full rounded bg-blue-500" style={{ width: `${u.progress}%` }} /></div>
          </div>
        ))}
        {error && <p className="rounded-md bg-red-500/10 p-2 text-xs text-red-300">{error}</p>}

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
            <button onClick={() => addToTimeline(a)} title="הוסף לציר הזמן" aria-label="הוסף לציר הזמן"
              className="self-center rounded p-1 text-zinc-500 hover:bg-zinc-700 hover:text-white md:opacity-0 md:group-hover:opacity-100">
              <Plus className="size-4" />
            </button>
          </div>
        ))}

        <p className="pt-2 text-center text-[11px] leading-relaxed text-zinc-600">
          <span className="md:hidden">לחיצה על + מוסיפה לציר הזמן</span>
          <span className="hidden md:inline">גרור קבצים לכאן · לחיצה כפולה מוסיפה לציר הזמן</span>
        </p>
      </div>
    </aside>
  );
}
