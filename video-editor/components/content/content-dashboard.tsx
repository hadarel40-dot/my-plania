"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clapperboard, Columns3, Film, Images,
  Inbox, Lightbulb, Plus, Send, Sparkles, Zap,
} from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import {
  ACCOUNTS, STATUSES, accountOf, formatLabel, missingForPublish, publicUrl, statusOf,
  type Account, type ContentItem, type Status,
} from "@/lib/content/types";
import { addDays, atDay, dayKey, dayName, rangeLabel, shortDate, startOfWeek, timeLabel } from "@/lib/content/dates";
import { ItemEditor } from "./item-editor";
import { AutomationDialog } from "./automation-dialog";

type View = "week" | "board";
type Filter = "all" | Account;
type Editing = { item: ContentItem; isNew: boolean } | null;

export function ContentDashboard({ initialItems, loadError, projects, automation }: {
  initialItems: ContentItem[];
  loadError: string | null;
  projects: { id: string; title: string }[];
  automation: { created_at: string; last_seen_at: string | null } | null;
}) {
  const [items, setItems] = useState(initialItems);
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<View>("week");
  const [week, setWeek] = useState(() => startOfWeek(new Date()));
  const [editing, setEditing] = useState<Editing>(null);
  const [showAutomation, setShowAutomation] = useState(false);
  const [error, setError] = useState(loadError);

  const visible = useMemo(() => items.filter((i) => filter === "all" || i.account === filter), [items, filter]);

  const stats = useMemo(() => {
    const monthAgo = Date.now() - 30 * 86400_000;
    const stuck = (i: ContentItem) => i.status === "publishing" && Date.now() - new Date(i.updated_at).getTime() > 30 * 60_000;
    return {
      working: visible.filter((i) => i.status === "idea" || i.status === "draft").length,
      approved: visible.filter((i) => i.status === "approved").length,
      published: visible.filter((i) => i.status === "published" && i.published_at && new Date(i.published_at).getTime() > monthAgo).length,
      attention: visible.filter((i) => i.status === "failed" || stuck(i) || (i.status === "approved" && missingForPublish(i).length > 0)).length,
    };
  }, [visible]);

  function newItem(patch: Partial<ContentItem> = {}) {
    const now = new Date().toISOString();
    setEditing({
      isNew: true,
      item: {
        id: crypto.randomUUID(), account: filter === "all" ? "plania.il" : filter, format: "reel", status: "idea",
        title: "", hook: "", script: "", caption: "", notes: "", media: [], project_id: null, scheduled_at: null,
        published_at: null, ig_media_id: null, ig_permalink: null, error: null, source: "manual", created_at: now, updated_at: now,
        ...patch,
      },
    });
  }

  /** שינוי מהיר מהלוח (גרירה): מעדכן מיד במסך, ומחזיר אחורה אם השמירה נכשלה */
  async function quickUpdate(id: string, patch: Partial<ContentItem>) {
    const before = items.find((i) => i.id === id);
    if (!before) return;
    const next = { ...before, ...patch };
    if (patch.status === "approved") {
      const missing = missingForPublish(next);
      if (missing.length) {
        setError(`כדי לאשר את "${before.title || "הפוסט"}" חסר: ${missing.join(", ")}`);
        return;
      }
    }
    setItems((all) => all.map((i) => (i.id === id ? next : i)));
    const { error: e } = await getSupabaseBrowser().from("content_items").update(patch).eq("id", id);
    if (e) {
      setItems((all) => all.map((i) => (i.id === id ? before : i)));
      setError(`השמירה נכשלה: ${e.message}`);
    }
  }

  const onSaved = (saved: ContentItem) =>
    setItems((all) => (all.some((i) => i.id === saved.id) ? all.map((i) => (i.id === saved.id ? saved : i)) : [saved, ...all]));
  const onDeleted = (id: string) => setItems((all) => all.filter((i) => i.id !== id));

  return (
    <div className="h-dvh overflow-y-auto text-zinc-100">
      <header className="sticky top-0 z-30 border-b border-zinc-800/70 bg-zinc-950/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:px-6">
          <Link href="/" className="rounded-md p-1 text-zinc-400 hover:text-white" title="לפרויקטים" aria-label="לפרויקטים">
            <ChevronRight className="size-5" />
          </Link>
          <Sparkles className="size-5 text-violet-400" />
          <h1 className="text-sm font-semibold sm:text-base">מאגר התוכן</h1>
          <div className="ms-auto flex items-center gap-2">
            <button onClick={() => setShowAutomation(true)}
              className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition",
                automation ? "border-emerald-500/40 text-emerald-200 hover:border-emerald-400" : "border-zinc-700 text-zinc-300 hover:border-violet-500")}>
              <Zap className="size-3.5" />
              <span className="hidden sm:inline">{automation ? "פרסום אוטומטי מחובר" : "חיבור פרסום אוטומטי"}</span>
            </button>
            <button onClick={() => newItem()}
              className="flex items-center gap-1.5 rounded-full bg-violet-600 px-3.5 py-1.5 text-xs font-medium text-white shadow-lg shadow-violet-900/40 hover:bg-violet-500">
              <Plus className="size-4" /> פוסט חדש
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p className="flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-xs text-red-300 hover:text-white">סגירה</button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat icon={<Lightbulb className="size-4" />} label="רעיונות וטיוטות" value={stats.working} tone="text-amber-300" />
          <Stat icon={<CheckCircle2 className="size-4" />} label="מאושרים ומתוזמנים" value={stats.approved} tone="text-emerald-300" />
          <Stat icon={<Send className="size-4" />} label="פורסמו ב-30 יום" value={stats.published} tone="text-sky-300" />
          <Stat icon={<AlertTriangle className="size-4" />} label="דורשים תשומת לב" value={stats.attention} tone="text-red-300" highlight={stats.attention > 0} />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-full border border-zinc-800 bg-zinc-900/60 p-1">
            <Chip active={filter === "all"} onClick={() => setFilter("all")}>שני החשבונות</Chip>
            {ACCOUNTS.map((a) => (
              <Chip key={a.id} active={filter === a.id} onClick={() => setFilter(a.id)}>
                <span className={cn("size-2 rounded-full", a.dot)} /> <span dir="ltr">{a.label}</span>
              </Chip>
            ))}
          </div>
          <div className="ms-auto flex gap-1 rounded-full border border-zinc-800 bg-zinc-900/60 p-1">
            <Chip active={view === "week"} onClick={() => setView("week")}><CalendarDays className="size-3.5" /> שבוע</Chip>
            <Chip active={view === "board"} onClick={() => setView("board")}><Columns3 className="size-3.5" /> לוח</Chip>
          </div>
        </div>

        {view === "week" ? (
          <WeekView items={visible} week={week} setWeek={setWeek} onOpen={(item) => setEditing({ item, isNew: false })}
            onAdd={(day) => newItem({ scheduled_at: atDay(day, null), status: "draft" })} onMove={quickUpdate} />
        ) : (
          <BoardView items={visible} onOpen={(item) => setEditing({ item, isNew: false })} onMove={quickUpdate}
            onAdd={(status) => newItem({ status })} />
        )}
      </main>

      {editing && (
        <ItemEditor key={editing.item.id} initial={editing.item} isNew={editing.isNew} projects={projects}
          onClose={() => setEditing(null)} onSaved={onSaved} onDeleted={onDeleted}
          onDuplicate={(src) => setEditing({ isNew: true, item: { ...src, id: crypto.randomUUID(), title: `${src.title} (עותק)`, status: "draft", media: [],
            scheduled_at: null, published_at: null, ig_media_id: null, ig_permalink: null, error: null, source: "manual" } })} />
      )}
      {showAutomation && <AutomationDialog automation={automation} onClose={() => setShowAutomation(false)} />}
    </div>
  );
}

/* ---------- שבוע ---------- */

function WeekView({ items, week, setWeek, onOpen, onAdd, onMove }: {
  items: ContentItem[]; week: Date; setWeek: (d: Date) => void;
  onOpen: (i: ContentItem) => void; onAdd: (day: Date) => void; onMove: (id: string, patch: Partial<ContentItem>) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const todayKey = dayKey(new Date());
  const byDay = new Map<string, ContentItem[]>();
  for (const i of items) {
    if (!i.scheduled_at) continue;
    const k = dayKey(new Date(i.scheduled_at));
    byDay.set(k, [...(byDay.get(k) ?? []), i]);
  }
  for (const list of byDay.values()) list.sort((a, b) => a.scheduled_at!.localeCompare(b.scheduled_at!));
  const bank = items.filter((i) => !i.scheduled_at && i.status !== "published");

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_18rem]">
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setWeek(addDays(week, -7))} className="rounded-full border border-zinc-800 p-1.5 hover:border-zinc-600" aria-label="השבוע הקודם">
            <ChevronRight className="size-4" />
          </button>
          <button onClick={() => setWeek(addDays(week, 7))} className="rounded-full border border-zinc-800 p-1.5 hover:border-zinc-600" aria-label="השבוע הבא">
            <ChevronLeft className="size-4" />
          </button>
          <h2 className="text-sm font-semibold">{rangeLabel(week)}</h2>
          <button onClick={() => setWeek(startOfWeek(new Date()))} className="ms-auto rounded-full px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-white">
            היום
          </button>
        </div>

        <div className="grid gap-2 md:grid-cols-7">
          {days.map((d) => {
            const k = dayKey(d);
            const list = byDay.get(k) ?? [];
            const isToday = k === todayKey;
            return (
              <DropZone key={k} onDrop={(id) => {
                const it = items.find((x) => x.id === id);
                if (it) onMove(id, { scheduled_at: atDay(d, it.scheduled_at) });
              }}
                className={cn("group flex flex-col gap-2 rounded-2xl border bg-zinc-900/40 p-2 md:min-h-64",
                  isToday ? "border-violet-500/50 bg-violet-500/5" : "border-zinc-800/80")}>
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className={cn("text-xs font-semibold", isToday ? "text-violet-300" : "text-zinc-300")}>{dayName(d)}</span>
                    <span className="text-[11px] text-zinc-500">{shortDate(d)}</span>
                  </div>
                  <button onClick={() => onAdd(d)} title="פוסט ביום הזה" aria-label={`פוסט חדש ל${dayName(d)}`}
                    className="rounded-md p-0.5 text-zinc-500 opacity-100 hover:bg-zinc-800 hover:text-white md:opacity-0 md:group-hover:opacity-100">
                    <Plus className="size-4" />
                  </button>
                </div>
                {list.map((i) => <Card key={i.id} item={i} onOpen={() => onOpen(i)} compact />)}
                {!list.length && <p className="hidden px-1 pt-2 text-[11px] text-zinc-600 md:block">אין פוסט</p>}
              </DropZone>
            );
          })}
        </div>
      </section>

      <DropZone onDrop={(id) => onMove(id, { scheduled_at: null })}
        className="h-fit space-y-2 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-3">
        <div className="flex items-center gap-2 px-1">
          <Inbox className="size-4 text-zinc-400" />
          <h2 className="text-sm font-semibold">בנק רעיונות</h2>
          <span className="text-xs text-zinc-500">{bank.length}</span>
        </div>
        <p className="px-1 text-[11px] leading-relaxed text-zinc-500">בלי תאריך עדיין. במחשב אפשר לגרור פוסט ליום בשבוע.</p>
        <div className="max-h-[32rem] space-y-2 overflow-y-auto">
          {bank.map((i) => <Card key={i.id} item={i} onOpen={() => onOpen(i)} />)}
        </div>
      </DropZone>
    </div>
  );
}

/* ---------- לוח לפי סטטוס ---------- */

function BoardView({ items, onOpen, onMove, onAdd }: {
  items: ContentItem[]; onOpen: (i: ContentItem) => void;
  onMove: (id: string, patch: Partial<ContentItem>) => void; onAdd: (s: Status) => void;
}) {
  const columns = STATUSES.filter((s) => (s.id !== "publishing" && s.id !== "failed") || items.some((i) => i.status === s.id));
  const sorted = (s: Status) => items.filter((i) => i.status === s).sort((a, b) =>
    s === "published" ? (b.published_at ?? "").localeCompare(a.published_at ?? "")
      : (a.scheduled_at ?? "9").localeCompare(b.scheduled_at ?? "9"));

  return (
    <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
      {columns.map((s) => {
        const list = sorted(s.id);
        return (
          <DropZone key={s.id} onDrop={(id) => onMove(id, { status: s.id })}
            className="flex w-64 shrink-0 snap-start flex-col lg:w-auto lg:min-w-0 lg:flex-1 gap-2 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-2">
            <div className="flex items-center gap-2 px-1 py-1">
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", s.pill)}>{s.label}</span>
              <span className="text-xs text-zinc-500">{list.length}</span>
              {(s.id === "idea" || s.id === "draft") && (
                <button onClick={() => onAdd(s.id)} className="ms-auto rounded-md p-0.5 text-zinc-500 hover:bg-zinc-800 hover:text-white" aria-label={`${s.label} חדש`}>
                  <Plus className="size-4" />
                </button>
              )}
            </div>
            <div className="flex max-h-[65vh] flex-col gap-2 overflow-y-auto">
              {list.map((i) => <Card key={i.id} item={i} onOpen={() => onOpen(i)} showDate />)}
              {!list.length && <p className="px-1 py-6 text-center text-xs text-zinc-600">ריק</p>}
            </div>
          </DropZone>
        );
      })}
    </div>
  );
}

/* ---------- כרטיס ---------- */

function Card({ item: i, onOpen, compact, showDate }: { item: ContentItem; onOpen: () => void; compact?: boolean; showDate?: boolean }) {
  const acc = accountOf(i.account);
  const st = statusOf(i.status);
  const first = i.media[0];
  const missing = i.status === "approved" ? missingForPublish(i) : [];
  const FormatIcon = i.format === "carousel" ? Images : i.format === "reel" ? Clapperboard : Film;

  return (
    <button draggable onDragStart={(e) => { e.dataTransfer.setData("text/content-id", i.id); e.dataTransfer.effectAllowed = "move"; }}
      onClick={onOpen}
      className="group/card w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/80 text-start shadow-md shadow-black/20 transition hover:-translate-y-0.5 hover:border-violet-500/50">
      {first && !compact && (
        <div className="relative h-28 overflow-hidden bg-zinc-950">
          {first.type === "video"
            ? <video src={`${publicUrl(first.path)}#t=0.5`} muted playsInline preload="metadata" className="h-full w-full object-cover" />
            : <img src={publicUrl(first.path)} alt="" loading="lazy" className="h-full w-full object-cover" />}
          {i.media.length > 1 && <span className="absolute bottom-1.5 end-1.5 rounded bg-black/70 px-1.5 text-[10px]">{i.media.length}</span>}
        </div>
      )}
      <div className="space-y-1.5 p-2.5">
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
          <span className={cn("size-2 shrink-0 rounded-full", acc.dot)} title={acc.label} />
          <FormatIcon className="size-3.5" />
          <span>{formatLabel(i.format)}</span>
          {i.scheduled_at && (compact || showDate) && (
            <span className="ms-auto tabular-nums text-zinc-300">
              {showDate && new Date(i.scheduled_at).toLocaleDateString("he-IL", { day: "numeric", month: "numeric" }) + " · "}
              {timeLabel(i.scheduled_at)}
            </span>
          )}
        </div>
        <p className="line-clamp-2 text-[13px] font-medium leading-snug">{i.title || i.hook || "ללא כותרת"}</p>
        <div className="flex flex-wrap items-center gap-1">
          <span className={cn("rounded-full px-1.5 py-0.5 text-[10px]", st.pill)}>{st.label}</span>
          {first && compact && <span className="text-[10px] text-zinc-500">· {i.media.length} קבצים</span>}
          {i.source === "agent" && <span className="rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[10px] text-violet-200">מהסוכן</span>}
          {missing.length > 0 && <span className="text-[10px] text-red-300" title={missing.join(", ")}>חסר: {missing[0]}</span>}
        </div>
      </div>
    </button>
  );
}

/* ---------- עזר ---------- */

function DropZone({ onDrop, className, children }: { onDrop: (id: string) => void; className?: string; children: React.ReactNode }) {
  const [over, setOver] = useState(false);
  return (
    <div className={cn(className, over && "ring-2 ring-violet-500/60")}
      onDragOver={(e) => { if (e.dataTransfer.types.includes("text/content-id")) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const id = e.dataTransfer.getData("text/content-id"); if (id) onDrop(id); }}>
      {children}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={cn("flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition",
        active ? "bg-zinc-100 text-zinc-950" : "text-zinc-400 hover:text-white")}>
      {children}
    </button>
  );
}

function Stat({ icon, label, value, tone, highlight }: { icon: React.ReactNode; label: string; value: number; tone: string; highlight?: boolean }) {
  return (
    <div className={cn("rounded-2xl border bg-zinc-900/50 p-3.5", highlight ? "border-red-500/40" : "border-zinc-800")}>
      <div className={cn("flex items-center gap-1.5 text-xs", tone)}>{icon}<span className="text-zinc-400">{label}</span></div>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
