"use client";
import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  Check, GitBranch, Loader2, RefreshCw, RotateCcw, SlidersHorizontal, Sparkles,
  ThumbsDown, ThumbsUp, Trash2, Wand2,
} from "lucide-react";
import { useEditor } from "@/stores/editor-store";
import { STYLE_PRESETS, estimateCostUsd, styleById } from "@/lib/ai/styles";
import { clipLength } from "@/lib/editor/timeline-utils";
import type { Clip, MediaAsset, Variant } from "@/lib/editor/types";
import { cn } from "@/lib/utils";

type SortMode = "new" | "rating";

export function VariantsPanel() {
  const clip = useEditor((s) =>
    s.selection?.kind === "clip" ? s.timeline.clips.find((c) => c.id === s.selection!.id) ?? null : null);
  const source = useEditor((s) => (clip ? s.assets[clip.sourceAssetId] : null));
  const variants = useEditor(useShallow((s) =>
    clip ? Object.values(s.variants).filter((v) => v.clipId === clip.id) : []));
  const previewVariantId = useEditor((s) => s.previewVariantId);
  const { generateVariants, previewVariant, applyVariant, revertClip } = useEditor.getState();
  const cloudVideo = useEditor((s) => s.aiMode === "cloud" && !!s.cloud?.video);

  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState(STYLE_PRESETS[0].id);
  const [strength, setStrength] = useState(0.6);
  const [count, setCount] = useState(4);
  const [remixOf, setRemixOf] = useState<Variant | null>(null);
  const [sort, setSort] = useState<SortMode>("new");

  // מעבר לקליפ אחר מנקה את מצב ה-remix
  useEffect(() => setRemixOf(null), [clip?.id]);

  if (!clip || !source) {
    return (
      <Shell>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-sm text-zinc-500">
          <Sparkles className="size-8 text-zinc-700" />
          בחר קליפ בציר הזמן כדי ליצור לו וריאציות AI ולבחור ביניהן
        </div>
      </Shell>
    );
  }

  // הסבב החדש ראשון, ובתוך סבב לפי סדר האותיות
  const sorted = [...variants].sort((a, b) =>
    (sort === "rating" ? b.rating - a.rating : 0) || b.createdAt - a.createdAt || a.label.localeCompare(b.label));
  const running = variants.filter((v) => v.status === "queued" || v.status === "running").length;

  function submit() {
    generateVariants(clip!.id, { prompt, style, strength }, count, remixOf?.id);
    setRemixOf(null);
  }

  /** "שנה את זה": טוען את הפרמטרים של וריאציה קיימת לטופס, כבסיס לסבב הבא */
  function remix(v: Variant) {
    setPrompt(v.params.prompt);
    setStyle(v.params.style);
    setStrength(v.params.strength);
    setRemixOf(v);
  }

  /** "עוד כמו זה": מייצר מיד 2 וריאציות נוספות עם אותם פרמטרים ו-seed חדש */
  function more(v: Variant) {
    generateVariants(clip!.id, { prompt: v.params.prompt, style: v.params.style, strength: v.params.strength }, 2, v.id);
  }

  /** וריאציה שנכשלה: מוחקים ומריצים שוב עם אותם פרמטרים */
  function retry(v: Variant) {
    useEditor.getState().deleteVariant(v.id);
    generateVariants(clip!.id, { prompt: v.params.prompt, style: v.params.style, strength: v.params.strength }, 1, v.parentId ?? undefined);
  }

  return (
    <Shell
      extra={
        <div className="flex items-center gap-2 text-[11px] text-zinc-500">
          {running > 0 && <span className="flex items-center gap-1 text-blue-300"><Loader2 className="size-3 animate-spin" />{running} בעבודה</span>}
          <select value={sort} onChange={(e) => setSort(e.target.value as SortMode)} aria-label="מיון"
            className="rounded bg-zinc-800 px-1 py-0.5 text-zinc-300">
            <option value="new">חדש</option>
            <option value="rating">דירוג</option>
          </select>
        </div>
      }
    >
      <OriginalRow clip={clip} source={source} onRevert={() => revertClip(clip.id)} />

      <div className="grid min-h-0 flex-1 auto-rows-max grid-cols-2 content-start gap-2.5 overflow-y-auto p-3">
        {sorted.map((v) => (
          <VariantCard
            key={v.id}
            variant={v}
            clip={clip}
            source={source}
            parentLabel={v.parentId ? variants.find((p) => p.id === v.parentId)?.label ?? null : null}
            isActive={clip.activeVariantId === v.id}
            isPreviewing={previewVariantId === v.id}
            onPreview={() => previewVariant(previewVariantId === v.id ? null : v.id)}
            onApply={() => applyVariant(v.id)}
            onRemix={() => remix(v)}
            onMore={() => (v.status === "failed" ? retry(v) : more(v))}
          />
        ))}
        {variants.length === 0 && (
          <p className="col-span-2 py-6 text-center text-xs leading-relaxed text-zinc-500">
            עדיין אין וריאציות לקליפ הזה.<br />תאר מה לשנות, בחר סגנון ולחץ "צור".
          </p>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); submit(); }}
        className="space-y-3 border-t border-zinc-800 bg-zinc-900/80 p-3"
      >
        {remixOf && (
          <div className="flex items-center justify-between rounded-md bg-violet-500/10 px-2 py-1.5 text-xs text-violet-200">
            <span className="flex items-center gap-1"><GitBranch className="size-3.5" /> וריאציה על {remixOf.label}</span>
            <button type="button" onClick={() => setRemixOf(null)} className="text-violet-300 hover:text-white">ביטול</button>
          </div>
        )}
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={2}
          placeholder="תאר את השינוי: 'שקיעה זהובה, תנועת מצלמה איטית'…"
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }}
          className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 p-2 text-sm placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none"
        />
        <div className="flex flex-wrap gap-1.5">
          {STYLE_PRESETS.map((s) => (
            <button key={s.id} type="button" onClick={() => setStyle(s.id)}
              className={cn("rounded-full border px-2.5 py-1 text-xs transition",
                s.id === style ? "border-blue-500 bg-blue-500/15 text-blue-200" : "border-zinc-700 text-zinc-400 hover:border-zinc-500")}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-3">
          <label className="flex-1 text-xs text-zinc-400">
            <span className="flex items-center gap-1"><SlidersHorizontal className="size-3" /> עוצמה: {Math.round(strength * 100)}%</span>
            <input type="range" min={0.1} max={1} step={0.05} value={strength}
              onChange={(e) => setStrength(+e.target.value)} className="mt-1 w-full accent-blue-500" />
          </label>
          <label className="text-xs text-zinc-400">
            כמות
            <select value={count} onChange={(e) => setCount(+e.target.value)}
              className="mt-1 block rounded bg-zinc-800 px-2 py-1 text-zinc-200">
              {[1, 2, 4].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>
        <button type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 py-2 text-sm font-medium hover:bg-blue-500">
          <Wand2 className="size-4" />
          צור {count} וריאציות
          <span className="text-xs font-normal text-blue-200">
            {cloudVideo ? `· ≈$${estimateCostUsd(count, clipLength(clip))}` : "· חינם בדמו"}
          </span>
        </button>
      </form>
    </Shell>
  );
}

function Shell({ children, extra }: { children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <aside className="flex min-h-0 w-full shrink-0 flex-col border-zinc-800 bg-zinc-900/40 md:w-[22rem] md:border-s">
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4 text-violet-400" /> וריאציות AI</h2>
        {extra}
      </header>
      {children}
    </aside>
  );
}

function OriginalRow({ clip, source, onRevert }: { clip: Clip; source: MediaAsset; onRevert: () => void }) {
  return (
    <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2 text-xs">
      <img src={source.thumbnailUrl ?? ""} alt="" className="h-10 w-7 rounded object-cover" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-zinc-300">{source.name}</p>
        <p className="text-zinc-500">{clip.activeVariantId ? "וריאציה מוחלת" : "מקור"}</p>
      </div>
      {clip.activeVariantId && (
        <button onClick={onRevert} className="flex items-center gap-1 rounded px-2 py-1 text-zinc-400 hover:bg-zinc-800 hover:text-white">
          <RotateCcw className="size-3.5" /> חזרה למקור
        </button>
      )}
    </div>
  );
}

function VariantCard({ variant: v, clip, source, parentLabel, isActive, isPreviewing, onPreview, onApply, onRemix, onMore }: {
  variant: Variant; clip: Clip; source: MediaAsset; parentLabel: string | null;
  isActive: boolean; isPreviewing: boolean;
  onPreview: () => void; onApply: () => void; onRemix: () => void; onMore: () => void;
}) {
  const asset = useEditor((s) => (v.result ? s.assets[v.result.assetId] : null));
  const { rateVariant, deleteVariant } = useEditor.getState();
  const videoRef = useRef<HTMLVideoElement>(null);
  const ready = v.status === "succeeded" && v.result && asset;
  const look = v.result?.look;

  // Hover מנגן את הקטע של הקליפ בלבד, בלולאה
  function onEnter() {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = clip.in;
    el.play().catch(() => {});
  }
  function onLeave() {
    const el = videoRef.current;
    if (!el) return;
    el.pause();
    el.currentTime = clip.in + 0.5;
  }
  function onTime() {
    const el = videoRef.current;
    if (el && el.currentTime >= clip.out) el.currentTime = clip.in;
  }

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border bg-zinc-950 transition",
        isActive ? "border-emerald-500 ring-1 ring-emerald-500/40"
          : isPreviewing ? "border-blue-500 ring-1 ring-blue-500/40"
          : "border-zinc-800 hover:border-zinc-600",
      )}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <button
        onClick={onPreview}
        onDoubleClick={ready ? onApply : undefined}
        disabled={!ready}
        title={ready ? "לחיצה: תצוגה בנגן · לחיצה כפולה: החלה" : undefined}
        className="relative block aspect-square w-full overflow-hidden bg-zinc-900"
      >
        {ready ? (
          <video
            ref={videoRef}
            src={`${asset!.url}#t=${clip.in + 0.5}`}
            muted
            playsInline
            preload="metadata"
            onTimeUpdate={onTime}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ filter: look!.filter, transform: `scale(${look!.zoom}) scaleX(${look!.flip ? -1 : 1})` }}
          />
        ) : v.status === "failed" ? (
          <span className="absolute inset-0 grid place-items-center text-xs text-red-400">העיבוד נכשל</span>
        ) : (
          <>
            {source.thumbnailUrl && (
              <img src={source.thumbnailUrl} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-30 blur-md" />
            )}
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs text-zinc-300">
              <Loader2 className="size-5 animate-spin" />
              {v.status === "queued" ? "בתור…" : `מעבד ${v.progress}%`}
              <span className="h-1 w-2/3 overflow-hidden rounded bg-zinc-800">
                <span className="block h-full bg-blue-500 transition-[width]" style={{ width: `${v.progress}%` }} />
              </span>
            </span>
          </>
        )}

        <span className="absolute start-1.5 top-1.5 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-xs font-bold">
          {v.label}
          {parentLabel && <span className="flex items-center text-[10px] font-normal text-violet-300"><GitBranch className="size-2.5" />{parentLabel}</span>}
        </span>
        {isActive && (
          <span className="absolute end-1.5 top-1.5 rounded-full bg-emerald-500 p-0.5"><Check className="size-3" /></span>
        )}
        <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/90 px-1.5 pb-1 pt-4 text-start text-[10px] text-zinc-300">
          {styleById(v.params.style).label} · {Math.round(v.params.strength * 100)}%
          {v.params.prompt && ` · ${v.params.prompt}`}
        </span>
      </button>

      <div className="flex items-center justify-between px-1 py-1">
        <div className="flex">
          <IconBtn title="אהבתי" onClick={() => rateVariant(v.id, 1)} active={v.rating === 1} disabled={!ready}><ThumbsUp className="size-3.5" /></IconBtn>
          <IconBtn title="לא אהבתי" onClick={() => rateVariant(v.id, -1)} active={v.rating === -1} disabled={!ready}><ThumbsDown className="size-3.5" /></IconBtn>
          <IconBtn title="מחק" onClick={() => deleteVariant(v.id)} disabled={isActive}><Trash2 className="size-3.5" /></IconBtn>
        </div>
        <div className="flex">
          <IconBtn title="שנה את זה (טען פרמטרים לטופס)" onClick={onRemix} disabled={!ready}><Wand2 className="size-3.5" /></IconBtn>
          <IconBtn title={v.status === "failed" ? "נסה שוב" : "עוד כמו זה"} onClick={onMore}
            disabled={!ready && v.status !== "failed"}><RefreshCw className="size-3.5" /></IconBtn>
          <IconBtn title="החל על ציר הזמן" onClick={onApply} disabled={!ready || isActive} primary><Check className="size-3.5" /></IconBtn>
        </div>
      </div>
    </div>
  );
}

function IconBtn({ children, onClick, title, active, primary, disabled }: {
  children: React.ReactNode; onClick: () => void; title: string;
  active?: boolean; primary?: boolean; disabled?: boolean;
}) {
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick} disabled={disabled}
      className={cn("rounded p-1 transition disabled:opacity-30",
        primary ? "bg-emerald-600 text-white hover:bg-emerald-500 disabled:bg-zinc-800"
          : active ? "text-blue-400" : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200")}>
      {children}
    </button>
  );
}
