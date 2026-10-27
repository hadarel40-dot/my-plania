"use client";
import { useEffect } from "react";
import { AlertTriangle, Check, Clapperboard, Cloud, Download, FilePlus2, Loader2, X } from "lucide-react";
import { redo, undo, useEditor, type AiMode } from "@/stores/editor-store";
import { usePlayback } from "@/stores/playback-store";
import { MediaBin } from "./media-bin";
import { Preview } from "./preview";
import { TimelinePanel } from "./timeline";
import { VariantsPanel } from "./variants-panel";
import { CaptionInspector } from "./caption-inspector";
import { useProjectBootstrap, type SaveState } from "./use-project-bootstrap";
import { clearProject } from "@/lib/persistence";
import { cn } from "@/lib/utils";

export function Editor() {
  useShortcuts();
  const { ready, saveState } = useProjectBootstrap();
  const caption = useEditor((s) =>
    s.selection?.kind === "caption" ? s.timeline.captions.find((c) => c.id === s.selection!.id) ?? null : null);

  if (!ready) {
    return <div className="grid h-screen place-items-center text-sm text-zinc-500">טוען פרויקט…</div>;
  }

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      <TopBar saveState={saveState} />
      <ErrorBar />
      <div className="flex min-h-0 flex-1">
        <MediaBin />
        <main className="flex min-w-0 flex-1 flex-col">
          <Preview />
        </main>
        {caption ? <CaptionInspector caption={caption} /> : <VariantsPanel />}
      </div>
      <TimelinePanel />
    </div>
  );
}

function TopBar({ saveState }: { saveState: SaveState }) {
  const title = useEditor((s) => s.title);
  const setTitle = useEditor((s) => s.setTitle);

  async function startNew() {
    if (!confirm("להתחיל פרויקט חדש? הפרויקט הנוכחי והקבצים שהועלו יימחקו מהדפדפן.")) return;
    await clearProject();
    useEditor.getState().newProject();
    useEditor.temporal.getState().clear();
  }

  // ייצוא ה"מתכון" כ-JSON. בשלב הענן, אותו JSON נשלח ל-Remotion Lambda לרינדור MP4
  function exportJson() {
    const { timeline, assets } = useEditor.getState();
    const blob = new Blob([JSON.stringify({ title, timeline, assets }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${title || "project"}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-zinc-800 px-4">
      <Clapperboard className="size-5 text-violet-400" />
      <input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="שם הפרויקט"
        className="w-56 rounded bg-transparent px-1.5 py-0.5 text-sm font-medium hover:bg-zinc-900 focus:bg-zinc-900 focus:outline-none" />
      <SaveIndicator state={saveState} />
      <ModeSwitch />
      <div className="ms-auto flex items-center gap-2">
        <span className="hidden text-[11px] text-zinc-600 xl:inline" dir="ltr">Space · S · Del · Ctrl+Z</span>
        <button onClick={startNew}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800">
          <FilePlus2 className="size-3.5" /> פרויקט חדש
        </button>
        <button onClick={exportJson}
          className="flex items-center gap-1.5 rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-white">
          <Download className="size-3.5" /> ייצוא פרויקט
        </button>
      </div>
    </header>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  const map = {
    saving: { icon: <Loader2 className="size-3 animate-spin" />, text: "שומר…", cls: "text-zinc-500" },
    saved: { icon: <Check className="size-3" />, text: "נשמר בדפדפן", cls: "text-zinc-500" },
    error: { icon: <AlertTriangle className="size-3" />, text: "השמירה נכשלה", cls: "text-red-400" },
  }[state];
  return <span className={cn("flex items-center gap-1 text-[11px]", map.cls)}>{map.icon}{map.text}</span>;
}

/** מעבר בין דמו מקומי לעיבוד בענן. הענן זמין רק אם הוגדר FAL_KEY בשרת */
function ModeSwitch() {
  const aiMode = useEditor((s) => s.aiMode);
  const cloud = useEditor((s) => s.cloud);
  const setAiMode = useEditor((s) => s.setAiMode);
  const cloudAvailable = !!(cloud?.video || cloud?.transcribe);

  const options: { id: AiMode; label: string; disabled: boolean; title: string }[] = [
    { id: "mock", label: "דמו", disabled: false, title: "עיבוד מדומה, מקומי וחינמי" },
    {
      id: "cloud",
      label: "ענן",
      disabled: !cloudAvailable,
      title: cloudAvailable
        ? `וריאציות: ${cloud?.video ?? "לא הוגדר מודל (FAL_VIDEO_MODEL)"} · תמלול: ${cloud?.transcribe ?? "-"}`
        : "כדי להפעיל, הגדר FAL_KEY ו-FAL_VIDEO_MODEL בשרת",
    },
  ];

  return (
    <div className="flex items-center rounded-md bg-zinc-900 p-0.5 text-[11px]">
      {options.map((o) => (
        <button key={o.id} disabled={o.disabled} title={o.title} onClick={() => setAiMode(o.id)}
          className={cn("flex items-center gap-1 rounded px-2 py-0.5 disabled:cursor-not-allowed disabled:opacity-40",
            aiMode === o.id
              ? o.id === "cloud" ? "bg-sky-500/20 text-sky-200" : "bg-amber-500/15 text-amber-300"
              : "text-zinc-500 hover:text-zinc-300")}>
          {o.id === "cloud" && <Cloud className="size-3" />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ErrorBar() {
  const error = useEditor((s) => s.error);
  const setError = useEditor((s) => s.setError);
  if (!error) return null;
  return (
    <div role="alert" className="flex items-center gap-2 border-b border-red-900/50 bg-red-950/60 px-4 py-1.5 text-xs text-red-200">
      <AlertTriangle className="size-3.5 shrink-0" />
      <span className="flex-1 truncate">{error}</span>
      <button onClick={() => setError(null)} aria-label="סגור" className="rounded p-0.5 hover:bg-red-900/50"><X className="size-3.5" /></button>
    </div>
  );
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable=true]")) return;
      const mod = e.metaKey || e.ctrlKey;
      const { splitAt, removeSelected, select } = useEditor.getState();
      const { currentTime, toggle } = usePlayback.getState();

      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (e.code === "Space") {
        e.preventDefault();
        toggle();
      } else if (e.key.toLowerCase() === "s" && !mod) {
        splitAt(currentTime);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        removeSelected();
      } else if (e.key === "Escape") {
        select(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
