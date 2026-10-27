"use client";
import { useEffect } from "react";
import { Clapperboard, Download } from "lucide-react";
import { redo, undo, useEditor } from "@/stores/editor-store";
import { usePlayback } from "@/stores/playback-store";
import { MediaBin } from "./media-bin";
import { Preview } from "./preview";
import { TimelinePanel } from "./timeline";
import { VariantsPanel } from "./variants-panel";
import { CaptionInspector } from "./caption-inspector";

export function Editor() {
  useShortcuts();
  const caption = useEditor((s) =>
    s.selection?.kind === "caption" ? s.timeline.captions.find((c) => c.id === s.selection!.id) ?? null : null);

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      <TopBar />
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

function TopBar() {
  const title = useEditor((s) => s.title);
  const setTitle = useEditor((s) => s.setTitle);

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
      <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-300">מצב דמו · עיבוד מקומי</span>
      <div className="ms-auto flex items-center gap-2">
        <span className="hidden text-[11px] text-zinc-600 lg:inline" dir="ltr">Space · S · Del · Ctrl+Z</span>
        <button onClick={exportJson}
          className="flex items-center gap-1.5 rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-white">
          <Download className="size-3.5" /> ייצוא פרויקט
        </button>
      </div>
    </header>
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
