"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { AlertTriangle, Check, FileJson, ChevronRight, Clapperboard, Cloud, Download, Film, FilePlus2, GanttChart, Loader2, LogOut, Music, Palette, Pencil, Sparkles, Type, X } from "lucide-react";
import { redo, undo, useEditor, type AiMode } from "@/stores/editor-store";
import { usePlayback } from "@/stores/playback-store";
import { MediaBin } from "./media-bin";
import { Preview } from "./preview";
import { TimelinePanel } from "./timeline";
import { SidePanel, type Tab } from "./side-panel";
import { ExportDialog } from "./export-dialog";
import { useProjectBootstrap, type SaveState } from "./use-project-bootstrap";
import { clearProject } from "@/lib/persistence";
import type { ProjectBackend } from "@/lib/backend";
import { cn } from "@/lib/utils";

export interface EditorProps {
  backend: ProjectBackend;
  /** במצב ענן: המשתמש המחובר */
  account?: { email: string };
}

export function Editor({ backend, account }: EditorProps) {
  useShortcuts();
  const { ready, loadError, saveState } = useProjectBootstrap(backend);

  if (loadError) {
    return (
      <div className="grid h-screen place-items-center text-center text-sm">
        <div className="space-y-3">
          <p className="text-red-300">{loadError}</p>
          {account && <Link href="/" className="text-zinc-400 underline">חזרה לפרויקטים</Link>}
        </div>
      </div>
    );
  }
  if (!ready) {
    return <div className="grid h-screen place-items-center text-sm text-zinc-500">טוען פרויקט…</div>;
  }

  return <Layout top={<TopBar saveState={saveState} cloudSave={backend.kind === "cloud"} account={account} />} />;
}

function Layout({ top }: { top: React.ReactNode }) {
  const phone = useMediaQuery("(max-width: 767px)");
  if (phone) return <PhoneLayout top={top} />;
  return (
    <div className="flex h-dvh flex-col bg-zinc-950 text-zinc-100">
      {top}
      <ErrorBar />
      <div className="flex min-h-0 flex-1">
        <MediaBin />
        <main className="flex min-w-0 flex-1 flex-col">
          <Preview />
        </main>
        <SidePanel />
      </div>
      <TimelinePanel />
    </div>
  );
}

type Sheet = "edit" | "media" | Exclude<Tab, "ai"> | "ai";

/**
 * מסך העריכה בטלפון: הנגן למעלה, ציר הזמן מתחתיו, וסרגל כפתורים בתחתית.
 * כל כפתור מחליף את ציר הזמן במגירה (מדיה, טקסט, סאונד, סגנון), כך שהנגן נשאר גלוי.
 */
function PhoneLayout({ top }: { top: React.ReactNode }) {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const editable = useEditor((s) => (s.selection && s.selection.kind !== "clip" ? s.selection.id : null));
  const aiAvailable = useEditor((s) => !!s.cloud?.video);

  // פריט שנוסף מלשונית טקסט/סאונד נפתח מיד לעריכה. כשהבחירה מתבטלת, מגירת העריכה נסגרת
  useEffect(() => {
    setSheet((v) => (!editable ? (v === "edit" ? null : v) : v && v !== "media" ? "edit" : v));
  }, [editable]);

  const buttons: { id: Sheet | null; label: string; icon: React.ReactNode }[] = [
    { id: null, label: "ציר הזמן", icon: <GanttChart className="size-5" /> },
    ...(editable ? [{ id: "edit" as Sheet, label: "עריכה", icon: <Pencil className="size-5" /> }] : []),
    { id: "media", label: "מדיה", icon: <Film className="size-5" /> },
    { id: "text", label: "טקסט", icon: <Type className="size-5" /> },
    { id: "sound", label: "סאונד", icon: <Music className="size-5" /> },
    { id: "style", label: "סגנון", icon: <Palette className="size-5" /> },
    ...(aiAvailable ? [{ id: "ai" as Sheet, label: "AI", icon: <Sparkles className="size-5" /> }] : []),
  ];

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      {top}
      <ErrorBar />
      <main className="flex min-h-0 flex-1 flex-col">
        <Preview />
      </main>
      {sheet ? (
        <div className="flex h-[46dvh] shrink-0 flex-col border-t border-zinc-800 bg-zinc-900">
          {sheet === "media" ? <MediaBin /> : <SidePanel tab={sheet === "edit" ? "text" : sheet} inspect={sheet === "edit"} />}
        </div>
      ) : (
        <TimelinePanel />
      )}
      <nav className="flex shrink-0 border-t border-zinc-800 bg-zinc-950 pb-[env(safe-area-inset-bottom)]">
        {buttons.map((b) => (
          <button key={b.id ?? "timeline"} onClick={() => setSheet((v) => (v === b.id ? null : b.id))}
            className={cn("flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]",
              sheet === b.id ? "text-violet-300" : b.id === "edit" ? "text-amber-300" : "text-zinc-400")}>
            {b.icon}{b.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

function TopBar({ saveState, cloudSave, account }: {
  saveState: SaveState; cloudSave: boolean; account?: { email: string };
}) {
  const title = useEditor((s) => s.title);
  const setTitle = useEditor((s) => s.setTitle);
  const [exporting, setExporting] = useState(false);

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
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-zinc-800 px-2 sm:gap-3 sm:px-4">
      {account ? (
        <Link href="/" title="הפרויקטים שלי" className="flex items-center gap-1 rounded px-1 py-0.5 text-zinc-400 hover:bg-zinc-900 hover:text-white">
          <ChevronRight className="size-4" /><Clapperboard className="size-5 text-violet-400" />
        </Link>
      ) : (
        <Clapperboard className="size-5 text-violet-400" />
      )}
      <input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="שם הפרויקט"
        className="w-28 min-w-0 rounded bg-transparent sm:w-56 px-1.5 py-0.5 text-sm font-medium hover:bg-zinc-900 focus:bg-zinc-900 focus:outline-none" />
      <SaveIndicator state={saveState} cloud={cloudSave} />
      <ModeSwitch />
      <div className="ms-auto flex shrink-0 items-center gap-1 sm:gap-2">
        <span className="hidden text-[11px] text-zinc-600 xl:inline" dir="ltr">Space · S · Del · Ctrl+Z</span>
        {account ? (
          <form action="/auth/signout" method="post" className="flex items-center gap-2">
            <span className="hidden text-[11px] text-zinc-500 md:inline" dir="ltr">{account.email}</span>
            <button title="התנתקות" aria-label="התנתקות" className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white">
              <LogOut className="size-3.5" />
            </button>
          </form>
        ) : (
          <button onClick={startNew}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800">
            <FilePlus2 className="size-3.5" /><span className="hidden sm:inline">פרויקט חדש</span>
          </button>
        )}
        <button onClick={exportJson} title="גיבוי הפרויקט כקובץ JSON" aria-label="גיבוי פרויקט"
          className="hidden rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white sm:block">
          <FileJson className="size-4" />
        </button>
        <button onClick={() => setExporting(true)}
          className="flex items-center gap-1.5 rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-white">
          <Download className="size-3.5" /> ייצוא<span className="hidden sm:inline"> סרטון</span>
        </button>
        {exporting && <ExportDialog onClose={() => setExporting(false)} />}
      </div>
    </header>
  );
}

function SaveIndicator({ state, cloud }: { state: SaveState; cloud: boolean }) {
  if (state === "idle") return null;
  const map = {
    saving: { icon: <Loader2 className="size-3 animate-spin" />, text: "שומר…", cls: "text-zinc-500" },
    saved: { icon: <Check className="size-3" />, text: cloud ? "נשמר בענן" : "נשמר בדפדפן", cls: "text-zinc-500" },
    error: { icon: <AlertTriangle className="size-3" />, text: "השמירה נכשלה", cls: "text-red-400" },
  }[state];
  return <span title={map.text} className={cn("flex shrink-0 items-center gap-1 text-[11px]", map.cls)}>{map.icon}<span className="hidden sm:inline">{map.text}</span></span>;
}

/** מעבר בין דמו מקומי לעיבוד בענן. הענן זמין רק אם הוגדר FAL_KEY בשרת */
function ModeSwitch() {
  const aiMode = useEditor((s) => s.aiMode);
  const cloud = useEditor((s) => s.cloud);
  const setAiMode = useEditor((s) => s.setAiMode);
  const cloudAvailable = !!(cloud?.video || cloud?.transcribe);
  // בלי שירות AI מחובר אין מה להחליף, ולכן המתג לא מוצג בכלל
  if (!cloudAvailable) return null;

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
