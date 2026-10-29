"use client";
import { useEffect, useMemo, useRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { TimelineComposition, type CompositionProps } from "@/remotion/timeline-composition";
import { useEditor } from "@/stores/editor-store";
import { usePlayback } from "@/stores/playback-store";
import { ASPECT_SIZE, type Aspect } from "@/lib/editor/types";
import { formatTime, layoutClips, timelineDuration } from "@/lib/editor/timeline-utils";
import { cn } from "@/lib/utils";
import { OverlayHandles } from "./overlay-handles";

export function Preview() {
  const playerRef = useRef<PlayerRef>(null);
  const timeline = useEditor((s) => s.timeline);
  const assets = useEditor((s) => s.assets);
  const previewVariantId = useEditor((s) => s.previewVariantId);
  const previewVariant = useEditor((s) => (previewVariantId ? s.variants[previewVariantId] : null));
  const setAspect = useEditor((s) => s.setAspect);
  const { setPlayer, setCurrentTime, setPlaying, seek, currentTime, playing } = usePlayback();

  const { width, height } = ASPECT_SIZE[timeline.aspect];
  const duration = timelineDuration(timeline);
  const durationInFrames = Math.max(1, Math.ceil(duration * timeline.fps));

  const inputProps = useMemo<CompositionProps>(() => ({
    timeline,
    assets,
    override: previewVariant?.result
      ? { clipId: previewVariant.clipId, ...previewVariant.result }
      : null,
  }), [timeline, assets, previewVariant]);

  // בתצוגה מקדימה של וריאציה, קופצים לתחילת הקליפ שלה
  useEffect(() => {
    if (!previewVariant) return;
    const hit = layoutClips(timeline.clips).find((l) => l.clip.id === previewVariant.clipId);
    if (hit && (currentTime < hit.start || currentTime >= hit.end)) seek(hit.start);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewVariantId]);

  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    setPlayer(p, timeline.fps);
    const onFrame = (e: { detail: { frame: number } }) => setCurrentTime(e.detail.frame / timeline.fps);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    p.addEventListener("frameupdate", onFrame);
    p.addEventListener("seeked", onFrame);
    p.addEventListener("play", onPlay);
    p.addEventListener("pause", onPause);
    p.addEventListener("ended", onPause);
    return () => {
      p.removeEventListener("frameupdate", onFrame);
      p.removeEventListener("seeked", onFrame);
      p.removeEventListener("play", onPlay);
      p.removeEventListener("pause", onPause);
      p.removeEventListener("ended", onPause);
      setPlayer(null, timeline.fps);
    };
  }, [setPlayer, setCurrentTime, setPlaying, timeline.fps]);

  const step = (frames: number) => seek(currentTime + frames / timeline.fps);

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-2 p-2 md:gap-3 md:p-4">
      <div className="relative flex min-h-0 w-full flex-1 items-center justify-center">
        {/* Remotion ממקם את הקומפוזיציה בהנחת LTR. הכתוביות עצמן מוגדרות RTL */}
        <div
          dir="ltr"
          className="relative h-full max-w-full overflow-hidden rounded-lg bg-black shadow-2xl ring-1 ring-zinc-800"
          style={{ aspectRatio: `${width} / ${height}` }}
        >
          {duration > 0 ? (
            <Player
              ref={playerRef}
              component={TimelineComposition}
              inputProps={inputProps}
              durationInFrames={durationInFrames}
              fps={timeline.fps}
              compositionWidth={width}
              compositionHeight={height}
              style={{ width: "100%", height: "100%" }}
              clickToPlay
            />
          ) : (
            <div dir="rtl" className="grid h-full place-items-center px-6 text-center text-sm text-zinc-500">
              הוסיפו קליפ מספריית המדיה לציר הזמן
            </div>
          )}
          {duration > 0 && <OverlayHandles />}
          {previewVariant && (
            <div dir="rtl" className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-blue-600/80 to-transparent px-3 py-2 text-xs font-medium">
              תצוגה מקדימה: וריאציה {previewVariant.label} · עדיין לא הוחלה
            </div>
          )}
        </div>
      </div>

      <div dir="ltr" className="flex w-full max-w-xl items-center justify-between gap-3">
        <span className="w-24 font-mono text-xs tabular-nums text-zinc-400">
          {formatTime(currentTime, timeline.fps)}
        </span>
        <div className="flex items-center gap-1">
          <CtrlBtn label="פריים אחורה" onClick={() => step(-1)}><SkipBack className="size-4" /></CtrlBtn>
          <button
            onClick={() => playerRef.current?.toggle()}
            aria-label={playing ? "השהה" : "נגן"}
            className="grid size-10 place-items-center rounded-full bg-white text-zinc-950 hover:bg-zinc-200"
          >
            {playing ? <Pause className="size-5" /> : <Play className="size-5 translate-x-px" />}
          </button>
          <CtrlBtn label="פריים קדימה" onClick={() => step(1)}><SkipForward className="size-4" /></CtrlBtn>
        </div>
        <div className="flex w-24 justify-end gap-1">
          {(Object.keys(ASPECT_SIZE) as Aspect[]).map((a) => (
            <button
              key={a}
              onClick={() => setAspect(a)}
              className={cn(
                "rounded px-1.5 py-0.5 text-[11px] tabular-nums",
                a === timeline.aspect ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300",
              )}
            >
              {a}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function CtrlBtn({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} title={label} aria-label={label}
      className="grid size-8 place-items-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-white">
      {children}
    </button>
  );
}
