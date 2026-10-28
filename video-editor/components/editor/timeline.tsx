"use client";
import { useMemo, useRef, useState } from "react";
import { Captions, Loader2, Plus, Redo2, Scissors, Sparkles, Trash2, Undo2, ZoomIn } from "lucide-react";
import { beginGesture, redo, undo, useEditor, useHistory } from "@/stores/editor-store";
import { usePlayback } from "@/stores/playback-store";
import { assignLanes, clipLength, formatTime, layoutClips, timelineDuration } from "@/lib/editor/timeline-utils";
import type { AudioClip, Clip } from "@/lib/editor/types";
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
  const { splitAt, removeSelected, addCaption, autoTranscribe } = useEditor.getState();
  const { canUndo, canRedo } = useHistory();
  const currentTime = usePlayback((s) => s.currentTime);
  const seek = usePlayback((s) => s.seek);
  const tracksRef = useRef<HTMLDivElement>(null);

  const duration = timelineDuration(timeline);
  const overlayLanes = useMemo(() => assignLanes(timeline.overlays), [timeline.overlays]);
  const audioLanes = useMemo(
    () => assignLanes(timeline.audio.map((a) => ({ id: a.id, start: a.start, end: a.start + a.out - a.in }))),
    [timeline.audio],
  );
  const width = Math.max(duration + 5, 20) * pps;

  const timeFromClientX = (clientX: number) => {
    const rect = tracksRef.current!.getBoundingClientRect();
    return Math.max(0, (clientX - rect.left - TRACK_LABEL_W) / pps);
  };

  return (
    <section dir="ltr" className="flex h-72 shrink-0 flex-col border-t border-zinc-800 bg-zinc-950">
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

          <Track label="Aa" lanes={overlayLanes.count}>
            {timeline.overlays.map((o) => (
              <TimedBlock key={o.id} kind="overlay" id={o.id} start={o.start} end={o.end} pps={pps}
                lane={overlayLanes.lanes.get(o.id) ?? 0}
                label={o.text} selected={selection?.kind === "overlay" && selection.id === o.id} />
            ))}
          </Track>

          <Track label="T" lanes={1}>
            {timeline.captions.map((cap) => (
              <TimedBlock key={cap.id} kind="caption" id={cap.id} start={cap.start} end={cap.end} pps={pps} lane={0}
                label={cap.text} selected={selection?.kind === "caption" && selection.id === cap.id} />
            ))}
          </Track>

          <Track label="♪" lanes={audioLanes.count}>
            {timeline.audio.map((a) => (
              <AudioBlock key={a.id} clip={a} pps={pps} lane={audioLanes.lanes.get(a.id) ?? 0}
                selected={selection?.kind === "audio" && selection.id === a.id} />
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

const LANE_H = 30;

function Track({ label, children, lanes }: { label: string; children: React.ReactNode; lanes?: number }) {
  return (
    <div className={cn("flex border-b border-zinc-800/70", !lanes && "h-16")}
      style={lanes ? { height: Math.min(lanes, 4) * LANE_H + 8 } : undefined}>
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

const BLOCK_COLORS = {
  overlay: { idle: "border-violet-500/60 bg-violet-900/70 hover:bg-violet-800", active: "bg-violet-700" },
  caption: { idle: "border-sky-600/60 bg-sky-900/70 hover:bg-sky-800", active: "bg-sky-700" },
};

/** פריט עם התחלה וסוף (טקסט / כתובית): גרירה מזיזה, הקצוות משנים אורך */
function TimedBlock({ kind, id, start, end, pps, label, selected, lane }: {
  kind: "overlay" | "caption"; id: string; start: number; end: number; pps: number; label: string; selected: boolean; lane: number;
}) {
  const { select, retimeItem } = useEditor.getState();
  const drag = (mode: "move" | "start" | "end") => (e: React.PointerEvent) => {
    select({ kind, id });
    const end0 = end, start0 = start;
    const finish = beginGesture();
    startDrag(e, (dx) => {
      const d = dx / pps;
      if (mode === "move") {
        const shift = Math.max(-start0, d);
        retimeItem(kind, id, start0 + shift, end0 + shift);
      } else if (mode === "start") {
        retimeItem(kind, id, Math.min(start0 + d, end0 - 0.2), end0);
      } else {
        retimeItem(kind, id, start0, Math.max(end0 + d, start0 + 0.2));
      }
    }, finish);
  };
  const colors = BLOCK_COLORS[kind];
  return (
    <div
      onPointerDown={drag("move")}
      className={cn("group absolute cursor-grab overflow-hidden rounded border text-[11px] select-none",
        selected ? `z-10 border-amber-400 ${colors.active}` : colors.idle)}
      style={{ left: start * pps, width: Math.max(8, (end - start) * pps), top: 4 + lane * LANE_H, height: LANE_H - 4 }}
      title={label}
    >
      <div dir="rtl" className="truncate px-2 py-0.5 leading-5">{label}</div>
      <Handle side="left" onPointerDown={drag("start")} />
      <Handle side="right" onPointerDown={drag("end")} />
    </div>
  );
}

/** קטע סאונד: גרירה מזיזה את ההתחלה בסרטון, הקצוות חותכים את הקובץ */
function AudioBlock({ clip, pps, selected, lane }: { clip: AudioClip; pps: number; selected: boolean; lane: number }) {
  const asset = useEditor((s) => s.assets[clip.assetId]);
  const { select, updateAudioClip } = useEditor.getState();
  const length = clip.out - clip.in;
  const drag = (mode: "move" | "in" | "out") => (e: React.PointerEvent) => {
    select({ kind: "audio", id: clip.id });
    const { start, in: in0, out: out0 } = clip;
    const finish = beginGesture();
    startDrag(e, (dx) => {
      const d = dx / pps;
      if (mode === "move") updateAudioClip(clip.id, { start: Math.max(0, start + d) });
      else if (mode === "in") {
        // חיתוך מההתחלה: הקובץ מתחיל מאוחר יותר והקטע זז ימינה באותה מידה
        const delta = Math.max(-in0, Math.min(d, out0 - in0 - 0.2));
        updateAudioClip(clip.id, { in: in0 + delta, start: start + delta });
      } else updateAudioClip(clip.id, { out: out0 + d });
    }, finish);
  };
  return (
    <div
      onPointerDown={drag("move")}
      className={cn("group absolute cursor-grab overflow-hidden rounded border text-[11px] select-none",
        selected ? "z-10 border-amber-400 bg-emerald-700" : "border-emerald-600/60 bg-emerald-900/70 hover:bg-emerald-800")}
      style={{ left: clip.start * pps, width: Math.max(8, length * pps), top: 4 + lane * LANE_H, height: LANE_H - 4 }}
      title={asset?.name}
    >
      <div className="absolute inset-0 opacity-40"
        style={{ background: "repeating-linear-gradient(90deg, transparent 0 3px, rgba(255,255,255,.35) 3px 4px)" }} />
      <div dir="rtl" className="relative truncate px-2 py-0.5 leading-5">{asset?.name ?? "סאונד"}</div>
      <Handle side="left" onPointerDown={drag("in")} />
      <Handle side="right" onPointerDown={drag("out")} />
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
