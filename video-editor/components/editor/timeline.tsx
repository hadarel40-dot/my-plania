"use client";
import { useRef, useState } from "react";
import { Captions, Loader2, Plus, Redo2, Scissors, Sparkles, Trash2, Undo2, ZoomIn } from "lucide-react";
import { beginGesture, redo, undo, useEditor, useHistory } from "@/stores/editor-store";
import { usePlayback } from "@/stores/playback-store";
import { clipLength, formatTime, layoutClips, timelineDuration } from "@/lib/editor/timeline-utils";
import { mockTranscribe } from "@/lib/ai/mock-transcribe";
import type { Caption, Clip } from "@/lib/editor/types";
import { cn } from "@/lib/utils";

const TRACK_LABEL_W = 44;

/** גרירה עם pointer capture. מחזיר את התזוזה בפיקסלים מתחילת הגרירה */
function startDrag(
  e: React.PointerEvent,
  onMove: (dx: number, ev: PointerEvent) => void,
  onEnd?: (moved: boolean) => void,
) {
  e.stopPropagation();
  const startX = e.clientX;
  let moved = false;
  const move = (ev: PointerEvent) => {
    const dx = ev.clientX - startX;
    if (Math.abs(dx) > 3) moved = true;
    if (moved) onMove(dx, ev);
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    onEnd?.(moved);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

export function TimelinePanel() {
  const [pps, setPps] = useState(80); // פיקסלים לשנייה
  const timeline = useEditor((s) => s.timeline);
  const selection = useEditor((s) => s.selection);
  const transcribing = useEditor((s) => s.transcribing);
  const { splitAt, removeSelected, addCaption, setCaptions, setTranscribing } = useEditor.getState();
  const { canUndo, canRedo } = useHistory();
  const currentTime = usePlayback((s) => s.currentTime);
  const seek = usePlayback((s) => s.seek);
  const tracksRef = useRef<HTMLDivElement>(null);

  const duration = timelineDuration(timeline);
  const width = Math.max(duration + 5, 20) * pps;

  const timeFromClientX = (clientX: number) => {
    const rect = tracksRef.current!.getBoundingClientRect();
    return Math.max(0, (clientX - rect.left - TRACK_LABEL_W) / pps);
  };

  async function autoTranscribe() {
    setTranscribing(true);
    setCaptions(await mockTranscribe(timelineDuration(useEditor.getState().timeline)));
    setTranscribing(false);
  }

  return (
    <section dir="ltr" className="flex h-56 shrink-0 flex-col border-t border-zinc-800 bg-zinc-950">
      <div className="flex items-center gap-1 border-b border-zinc-800 px-3 py-1.5 text-xs">
        <ToolBtn label="ביטול (Ctrl+Z)" onClick={undo} disabled={!canUndo}><Undo2 className="size-4" /></ToolBtn>
        <ToolBtn label="חזרה (Ctrl+Shift+Z)" onClick={redo} disabled={!canRedo}><Redo2 className="size-4" /></ToolBtn>
        <Sep />
        <ToolBtn label="פיצול בנקודת הניגון (S)" onClick={() => splitAt(currentTime)}><Scissors className="size-4" /></ToolBtn>
        <ToolBtn label="מחיקה (Delete)" onClick={removeSelected} disabled={!selection}><Trash2 className="size-4" /></ToolBtn>
        <Sep />
        <ToolBtn label="הוסף כתובית בנקודת הניגון" onClick={() => addCaption(currentTime)}><Plus className="size-4" /></ToolBtn>
        <button
          onClick={autoTranscribe}
          disabled={transcribing || timeline.clips.length === 0}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
        >
          {transcribing ? <Loader2 className="size-3.5 animate-spin" /> : <Captions className="size-3.5" />}
          <span dir="rtl">{transcribing ? "מתמלל…" : "תמלול אוטומטי"}</span>
        </button>
        <div className="ms-auto flex items-center gap-2 text-zinc-500">
          <span className="font-mono tabular-nums">{formatTime(duration, timeline.fps)}</span>
          <ZoomIn className="size-3.5" />
          <input type="range" min={20} max={240} value={pps} onChange={(e) => setPps(+e.target.value)}
            aria-label="זום ציר זמן" className="w-24 accent-zinc-400" />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div ref={tracksRef} className="relative" style={{ width: width + TRACK_LABEL_W }}>
          <Ruler pps={pps} width={width} fps={timeline.fps}
            onScrub={(e) => {
              seek(timeFromClientX(e.clientX));
              startDrag(e, (_dx, ev) => seek(timeFromClientX(ev.clientX)));
            }} />

          <Track label="V1">
            {layoutClips(timeline.clips).map(({ clip, start }, index) => (
              <ClipBlock key={clip.id} clip={clip} start={start} index={index} pps={pps}
                selected={selection?.kind === "clip" && selection.id === clip.id}
                timeFromClientX={timeFromClientX} />
            ))}
          </Track>

          <Track label="T">
            {timeline.captions.map((cap) => (
              <CaptionBlock key={cap.id} caption={cap} pps={pps}
                selected={selection?.kind === "caption" && selection.id === cap.id} />
            ))}
          </Track>

          <div className="pointer-events-none absolute inset-y-0 z-20 w-px bg-red-500"
            style={{ left: TRACK_LABEL_W + currentTime * pps }}>
            <div className="absolute -left-1.5 top-0 size-3 rotate-45 bg-red-500" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Ruler({ pps, width, fps, onScrub }: {
  pps: number; width: number; fps: number; onScrub: (e: React.PointerEvent) => void;
}) {
  const step = pps >= 120 ? 1 : pps >= 50 ? 2 : 5;
  const ticks = Array.from({ length: Math.ceil(width / pps / step) + 1 }, (_, i) => i * step);
  return (
    <div className="sticky top-0 z-10 flex h-6 bg-zinc-900">
      <div className="shrink-0 border-r border-zinc-800" style={{ width: TRACK_LABEL_W }} />
      <div className="relative flex-1 cursor-pointer border-b border-zinc-800" onPointerDown={onScrub}>
        {ticks.map((t) => (
          <span key={t} className="absolute top-0 h-full border-l border-zinc-700 ps-1 text-[10px] text-zinc-500"
            style={{ left: t * pps }}>
            {formatTime(t, fps).slice(0, 5)}
          </span>
        ))}
      </div>
    </div>
  );
}

function Track({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex h-16 border-b border-zinc-800/70">
      <div className="sticky left-0 z-10 grid shrink-0 place-items-center border-r border-zinc-800 bg-zinc-900 text-[11px] font-semibold text-zinc-500"
        style={{ width: TRACK_LABEL_W }}>
        {label}
      </div>
      <div className="relative flex-1">{children}</div>
    </div>
  );
}

function ClipBlock({ clip, start, index, pps, selected, timeFromClientX }: {
  clip: Clip; start: number; index: number; pps: number; selected: boolean;
  timeFromClientX: (x: number) => number;
}) {
  const asset = useEditor((s) => s.assets[clip.assetId]);
  const variantCount = useEditor((s) => Object.values(s.variants).filter((v) => v.clipId === clip.id).length);
  const activeLabel = useEditor((s) => (clip.activeVariantId ? s.variants[clip.activeVariantId]?.label : null));
  const { select, trimClip, moveClip } = useEditor.getState();
  const [dragging, setDragging] = useState(false);
  const w = clipLength(clip) * pps;

  const onBodyDown = (e: React.PointerEvent) => {
    select({ kind: "clip", id: clip.id });
    const end = beginGesture();
    startDrag(
      e,
      (_dx, ev) => {
        setDragging(true);
        // היעד: כמה קליפים אחרים נמצאים משמאל לסמן
        const t = timeFromClientX(ev.clientX);
        const others = layoutClips(useEditor.getState().timeline.clips).filter((l) => l.clip.id !== clip.id);
        const target = others.filter((l) => (l.start + l.end) / 2 < t).length;
        moveClip(clip.id, target);
      },
      () => { setDragging(false); end(); },
    );
  };

  const onEdgeDown = (edge: "in" | "out") => (e: React.PointerEvent) => {
    select({ kind: "clip", id: clip.id });
    const initial = clip[edge];
    const end = beginGesture();
    startDrag(e, (dx) => trimClip(clip.id, edge, initial + dx / pps), end);
  };

  return (
    <div
      onPointerDown={onBodyDown}
      className={cn(
        "group absolute inset-y-1.5 cursor-grab overflow-hidden rounded-md border bg-zinc-800 select-none",
        selected ? "z-10 border-amber-400 ring-1 ring-amber-400" : "border-zinc-700 hover:border-zinc-500",
        dragging && "cursor-grabbing opacity-80",
      )}
      style={{ left: start * pps, width: w }}
      data-index={index}
    >
      {asset?.thumbnailUrl && (
        <div className="absolute inset-0 bg-repeat-x opacity-80"
          style={{ backgroundImage: `url(${asset.thumbnailUrl})`, backgroundSize: "auto 100%", filter: clip.look.filter }} />
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-1 truncate bg-gradient-to-t from-black/80 px-2 pb-0.5 pt-3 text-[10px]">
        {activeLabel && (
          <span className="flex items-center gap-0.5 rounded bg-violet-600 px-1 font-semibold">
            <Sparkles className="size-2.5" />{activeLabel}
          </span>
        )}
        <span className="truncate">{asset?.name ?? "מדיה חסרה"}</span>
        {variantCount > 0 && !activeLabel && <span className="text-violet-300">✨{variantCount}</span>}
      </div>
      <Handle side="left" onPointerDown={onEdgeDown("in")} />
      <Handle side="right" onPointerDown={onEdgeDown("out")} />
    </div>
  );
}

function Handle({ side, onPointerDown }: { side: "left" | "right"; onPointerDown: (e: React.PointerEvent) => void }) {
  return (
    <div onPointerDown={onPointerDown}
      className={cn("absolute inset-y-0 w-2 cursor-ew-resize bg-amber-400/0 hover:bg-amber-400/70 group-hover:bg-amber-400/30",
        side === "left" ? "left-0" : "right-0")} />
  );
}

function CaptionBlock({ caption, pps, selected }: { caption: Caption; pps: number; selected: boolean }) {
  const { select, updateCaption } = useEditor.getState();
  const onDown = (e: React.PointerEvent) => {
    select({ kind: "caption", id: caption.id });
    const { start, end: capEnd } = caption;
    const end = beginGesture();
    startDrag(e, (dx) => {
      const shift = Math.max(-start, dx / pps);
      updateCaption(caption.id, { start: +(start + shift).toFixed(2), end: +(capEnd + shift).toFixed(2) });
    }, end);
  };
  return (
    <div
      onPointerDown={onDown}
      dir="rtl"
      className={cn(
        "absolute inset-y-3 cursor-grab truncate rounded border px-1.5 py-1 text-[11px] select-none",
        selected ? "z-10 border-amber-400 bg-sky-700" : "border-sky-600/60 bg-sky-900/70 hover:bg-sky-800",
      )}
      style={{ left: caption.start * pps, width: Math.max(8, (caption.end - caption.start) * pps) }}
      title={caption.text}
    >
      {caption.text}
    </div>
  );
}

function ToolBtn({ children, label, onClick, disabled }: {
  children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled} title={label} aria-label={label}
      className="grid size-7 place-items-center rounded-md text-zinc-300 hover:bg-zinc-800 disabled:opacity-30">
      {children}
    </button>
  );
}

const Sep = () => <span className="mx-1 h-4 w-px bg-zinc-800" />;
