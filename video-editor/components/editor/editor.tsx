"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { AlertTriangle, Captions, MessageCircle, Check, Copy, Gauge, Layers, Scissors, Snowflake, Trash2, UserRound, FileJson, ChevronRight, Clapperboard, Cloud, Download, Film, FilePlus2, GanttChart, Loader2, LogOut, Music, Palette, Pencil, Sparkles, Type, Wand2, X } from "lucide-react";
import { beginGesture, redo, undo, useEditor, type AiMode } from "@/stores/editor-store";
import { usePlayback } from "@/stores/playback-store";
import { useUploads } from "@/stores/upload-store";
import { MediaBin } from "./media-bin";
import { Preview } from "./preview";
import { TimelinePanel } from "./timeline";
import { SidePanel, type Tab } from "./side-panel";
import { OPEN_SMART_EVENT } from "./smart-tab";
import { openCaptionsSheet } from "./captions-sheet";
import { OPEN_TOOL_EVENT, type ToolName } from "@/lib/editor/chat";
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
  useWheelScrollsSideways();
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
    <div className="flex h-dvh flex-col text-zinc-100">
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
  // המגירות שכבר נפתחו (נשארות בנויות). "עריכה" תלויה בפריט הנבחר, ולכן נבנית מחדש בכל פתיחה
  const [visited, setVisited] = useState<Set<Sheet>>(() => new Set());
  useEffect(() => {
    if (!sheet) return;
    setVisited((v) => {
      const next = new Set([...v].filter((x) => x !== "edit" || sheet === "edit"));
      next.add(sheet);
      return next.size === v.size && [...next].every((x) => v.has(x)) ? v : next;
    });
  }, [sheet]);
  // גובה אזור העריכה (חלק מגובה המסך). נשמר לפעם הבאה
  const [panel, setPanel] = useState(() => {
    try { const v = Number(localStorage.getItem(PANEL_KEY)); return v >= PANEL_MIN && v <= PANEL_MAX ? v : 0.42; } catch { return 0.42; }
  });
  useEffect(() => { try { localStorage.setItem(PANEL_KEY, String(panel)); } catch { /* */ } }, [panel]);
  const editable = useEditor((s) => (s.selection && s.selection.kind !== "clip" ? s.selection.id : null));
  // כמו במחשב: כשבוחרים קליפ, כפתור "סגנון" הופך ל"עריכת קליפ" (מהירות, אפקטים, צבע, מעבר)
  const clipSelected = useEditor((s) => s.selection?.kind === "clip");
  const aiAvailable = useEditor((s) => !!s.cloud?.video);
  const uploading = useUploads((s) => s.items.length > 0);

  // העוזר (או כל מקום אחר) יכול לפתוח כלי: הסרת רקע, טריקים, כתוביות...
  useEffect(() => {
    const open = (e: Event) => {
      const tool = (e as CustomEvent<ToolName>).detail;
      if (tool === "captions") { openCaptionsSheet(); return; }
      const map: Record<Exclude<ToolName, "captions">, Sheet> = { background: "bg", tricks: "tricks", music: "sound", text: "text", media: "media", smart: "smart" };
      useEditor.getState().select(null);
      setSheet(map[tool]);
    };
    window.addEventListener(OPEN_TOOL_EVENT, open);
    return () => window.removeEventListener(OPEN_TOOL_EVENT, open);
  }, []);

  // הכפתור "לערוך אוטומטית" שעל הנגן פותח את לשונית "חכם", שם מופיעות הגרסאות
  useEffect(() => {
    const open = () => setSheet("smart");
    window.addEventListener(OPEN_SMART_EVENT, open);
    return () => window.removeEventListener(OPEN_SMART_EVENT, open);
  }, []);

  // פריט שנוסף מלשונית טקסט/סאונד נפתח מיד לעריכה. כשהבחירה מתבטלת, מגירת העריכה נסגרת
  useEffect(() => {
    setSheet((v) => (!editable ? (v === "edit" ? null : v) : v && v !== "media" ? "edit" : v));
  }, [editable]);

  const hasCaptions = useEditor((s) => s.timeline.captions.length > 0);
  const transcribing = useEditor((s) => s.transcribing);
  const act = (fn: () => void) => () => { const end = beginGesture(); fn(); end(); };
  const now = () => usePlayback.getState().currentTime;
  // כמו בקאפקאט: כשקליפ נבחר, הסרגל מתחלף לכלים של הקליפ (וחץ חזרה לכלים הכלליים)
  const buttons: ToolButton[] = clipSelected ? [
    { id: "back", label: "חזרה", icon: <ChevronRight className="size-5" />, action: () => { useEditor.getState().select(null); setSheet(null); } },
    { id: "split", label: "פיצול", icon: <Scissors className="size-5" />, action: act(() => useEditor.getState().splitAt(now())) },
    { id: "style", sheet: "style", label: "מהירות ומעבר", icon: <Gauge className="size-5" /> },
    { id: "filters", sheet: "style", label: "פילטרים", icon: <Palette className="size-5" /> },
    { id: "bg", sheet: "bg", label: "הסרת רקע", icon: <UserRound className="size-5" /> },
    { id: "tricks", sheet: "tricks", label: "שכבות וטריקים", icon: <Layers className="size-5" /> },
    { id: "dup", label: "שכפול", icon: <Copy className="size-5" />, action: act(() => { const sel = useEditor.getState().selection; if (sel?.kind === "clip") useEditor.getState().duplicateClip(sel.id); }) },
    { id: "freeze", label: "הקפאה", icon: <Snowflake className="size-5" />, action: act(() => useEditor.getState().freezeFrame(now())) },
    { id: "delete", label: "מחיקה", icon: <Trash2 className="size-5" />, action: act(() => useEditor.getState().removeSelected()), tone: "danger" },
  ] : [
    { id: "timeline", sheet: null, label: "ציר הזמן", icon: <GanttChart className="size-5" /> },
    { id: "assistant", sheet: "assistant", label: "עוזר", icon: <MessageCircle className="size-5" />, tone: "brand" },
    ...(editable ? [{ id: "edit", sheet: "edit" as Sheet, label: "עריכה", icon: <Pencil className="size-5" />, tone: "active" as const }] : []),
    { id: "media", sheet: "media", label: "מדיה", icon: uploading ? <Loader2 className="size-5 animate-spin text-blue-400" /> : <Film className="size-5" /> },
    { id: "smart", sheet: "smart", label: "חכם", icon: <Wand2 className="size-5" /> },
    { id: "text", sheet: "text", label: "טקסט", icon: <Type className="size-5" /> },
    { id: "captions", label: "כתוביות", icon: transcribing ? <Loader2 className="size-5 animate-spin text-violet-300" /> : <Captions className="size-5" />,
      action: () => { if (hasCaptions) openCaptionsSheet(); else { setSheet(null); void useEditor.getState().autoTranscribe().catch(() => undefined); } } },
    { id: "sound", sheet: "sound", label: "סאונד", icon: <Music className="size-5" /> },
    { id: "style", sheet: "style", label: "סגנון", icon: <Palette className="size-5" /> },
    { id: "bg", sheet: "bg", label: "הסרת רקע", icon: <UserRound className="size-5" /> },
    { id: "tricks", sheet: "tricks", label: "שכבות וטריקים", icon: <Layers className="size-5" /> },
    ...(aiAvailable ? [{ id: "ai", sheet: "ai" as Sheet, label: "AI", icon: <Sparkles className="size-5" /> }] : []),
  ];

  return (
    <div className="flex h-dvh flex-col overflow-hidden text-zinc-100">
      {top}
      <ErrorBar />
      <main className="flex min-h-0 flex-1 flex-col">
        <Preview />
      </main>
      <ResizeHandle value={panel} onChange={setPanel} />
      <div className="flex shrink-0 flex-col overflow-hidden" style={{ height: `${panel * 100}dvh` }}>
        {/* מגירות שכבר נפתחו נשארות מוכנות ברקע (מוסתרות): מעבר ביניהן מיידי, בלי לבנות מחדש */}
        <div className={cn("min-h-0 flex-1 flex-col", sheet ? "hidden" : "flex")}><TimelinePanel fill /></div>
        {[...(sheet && !visited.has(sheet) ? new Set([...visited, sheet]) : visited)].map((id) => (
          <div key={id} className={cn("min-h-0 flex-1 flex-col overflow-hidden bg-zinc-900", sheet === id ? "flex" : "hidden")}>
            {id === "media" ? <MediaBin /> : <SidePanel tab={id === "edit" ? "text" : id} inspect={id === "edit"} />}
          </div>
        ))}
      </div>
      {/* הסרגל נגלל לצדדים: כל הכלים זמינים, וכל כפתור בגודל נוח ללחיצה */}
      <nav className="relative shrink-0 border-t border-zinc-800/70 bg-zinc-950 pb-[max(env(safe-area-inset-bottom),4px)]">
        <div data-hscroll className="no-scrollbar flex snap-x gap-0.5 overflow-x-auto px-1 pt-1">
        {buttons.map((b) => {
          const on = b.sheet !== undefined && sheet === b.sheet && (b.sheet !== "style" || b.id === "style");
          return (
            <button key={b.id} onClick={(e) => {
              e.currentTarget.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
              if (b.action) b.action();
              else setSheet((v) => (v === b.sheet ? null : b.sheet ?? null));
            }}
              className={cn("flex min-w-[4.1rem] flex-none snap-start flex-col items-center gap-0.5 whitespace-nowrap rounded-xl px-1.5 py-1.5 text-[11px] transition active:scale-95",
                on ? "bg-violet-500/15 text-violet-200" : b.tone === "danger" ? "text-red-300" : b.tone === "active" ? "text-amber-300" : b.tone === "brand" ? "text-fuchsia-300" : clipSelected ? "text-zinc-200" : "text-zinc-400")}>
              {b.icon}{b.label}
            </button>
          );
        })}
        </div>
        {/* רמז שיש עוד כפתורים בצד */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-zinc-950 to-transparent" />
      </nav>
    </div>
  );
}

interface ToolButton {
  id: string;
  label: string;
  icon: React.ReactNode;
  /** מגירה שנפתחת (null = ציר הזמן) */
  sheet?: Sheet | null;
  /** פעולה מיידית (פיצול, שכפול, מחיקה...) */
  action?: () => void;
  tone?: "danger" | "active" | "brand";
}

/**
 * במחשב: גלגלת העכבר מעל שורה שנגללת לצד (סרגלים, שבבים) גוללת אותה לצד.
 * בלי זה אי אפשר להגיע לכפתורים שמחוץ למסך בלי משטח מגע.
 */
function useWheelScrollsSideways() {
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || e.ctrlKey) return;
      const el = (e.target as Element | null)?.closest?.("[data-hscroll]") as HTMLElement | null;
      if (!el || el.scrollWidth <= el.clientWidth + 1) return;
      const before = el.scrollLeft;
      // בעברית (RTL) הגלילה לצד "קדימה" היא לשמאל
      el.scrollLeft += getComputedStyle(el).direction === "rtl" ? -e.deltaY : e.deltaY;
      if (el.scrollLeft !== before) e.preventDefault();
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);
}

const PANEL_KEY = "ai-video-editor:panel-height";
const PANEL_MIN = 0.24;
const PANEL_MAX = 0.6;

/**
 * ידית בין הנגן לכלי העריכה: גוררים למעלה כדי להגדיל את אזור העריכה, למטה כדי להגדיל
 * את הנגן. לחיצה כפולה מחזירה לגודל הרגיל.
 */
function ResizeHandle({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    const y0 = e.clientY, v0 = value, h = window.innerHeight;
    const move = (ev: PointerEvent) => onChange(Math.min(PANEL_MAX, Math.max(PANEL_MIN, v0 + (y0 - ev.clientY) / h)));
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };
  return (
    <div onPointerDown={start} onDoubleClick={() => onChange(0.42)} role="separator" aria-orientation="horizontal" aria-label="שינוי גודל אזור העריכה"
      className="group flex h-5 shrink-0 cursor-row-resize touch-none items-center justify-center border-t border-zinc-800/70 bg-zinc-950/80">
      <span className="h-1.5 w-12 rounded-full bg-zinc-600 transition group-active:w-16 group-active:bg-violet-400" />
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
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-zinc-800/70 bg-zinc-950 px-2 sm:gap-3 sm:px-4">
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
          className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white">
          <FileJson className="size-4" />
        </button>
        <button onClick={() => setExporting(true)}
          className="flex items-center gap-1.5 rounded-full bg-gradient-to-l from-violet-600 to-fuchsia-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg shadow-violet-900/40 hover:brightness-110">
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
