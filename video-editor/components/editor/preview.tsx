"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { Pause, Play, SkipBack, SkipForward, Upload } from "lucide-react";
import { TimelineComposition, type CompositionProps } from "@/remotion/timeline-composition";
import { useEditor } from "@/stores/editor-store";
import { usePlayback } from "@/stores/playback-store";
import { ASPECT_SIZE, type Aspect } from "@/lib/editor/types";
import { formatTime, layoutClips, timelineDuration } from "@/lib/editor/timeline-utils";
import { cn } from "@/lib/utils";
import { OverlayHandles } from "./overlay-handles";
import { FileInput } from "./media-bin";
import { OPEN_SMART_EVENT, runAutoEdit, useAutoEditRun } from "./smart-tab";
import { Sparkles, X as XIcon } from "lucide-react";
import { useUploads } from "@/stores/upload-store";
import { GENRES, type VideoGenre } from "@/lib/editor/genres";
import { loadMyStyle } from "@/lib/editor/my-style";
import { ensurePreviewProxies, setProxyPause, usePreviewProxies } from "@/lib/media/preview-proxy";

export function Preview() {
  const playerRef = useRef<PlayerRef>(null);
  const timeline = useEditor((s) => s.timeline);
  const assets = useEditor((s) => s.assets);
  const previewVariantId = useEditor((s) => s.previewVariantId);
  const previewVariant = useEditor((s) => (previewVariantId ? s.variants[previewVariantId] : null));
  const setAspect = useEditor((s) => s.setAspect);
  const { setPlayer, setCurrentTime, setPlaying } = usePlayback.getState();
  const playing = usePlayback((s) => s.playing);
  const proxies = usePreviewProxies((s) => s.urls);

  const { width, height } = ASPECT_SIZE[timeline.aspect];
  const duration = timelineDuration(timeline);
  const durationInFrames = Math.max(1, Math.ceil(duration * timeline.fps));
  const hasPlayer = duration > 0;

  // עותקים קטנים לתצוגה ברקע (הייצוא משתמש במקור)
  useEffect(() => {
    setProxyPause(() => useUploads.getState().items.length > 0 || !!useAutoEditRun.getState().busy || usePlayback.getState().playing);
    ensurePreviewProxies(Object.values(assets));
  }, [assets]);
  const previewAssets = useMemo(() => {
    if (!Object.keys(proxies).length) return assets;
    return Object.fromEntries(Object.entries(assets).map(([id, a]) => [id, proxies[id] ? { ...a, url: proxies[id] } : a]));
  }, [assets, proxies]);

  const inputProps = useMemo<CompositionProps>(() => ({
    timeline,
    assets: previewAssets,
    override: previewVariant?.result
      ? { clipId: previewVariant.clipId, ...previewVariant.result }
      : null,
  }), [timeline, previewAssets, previewVariant]);

  // בתצוגה מקדימה של וריאציה, קופצים לתחילת הקליפ שלה
  useEffect(() => {
    if (!previewVariant) return;
    const { currentTime, seek } = usePlayback.getState();
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
    // הנגן נוצר רק כשיש משהו בציר הזמן: בפרויקט חדש מתחברים אליו אחרי ההעלאה הראשונה
  }, [setPlayer, setCurrentTime, setPlaying, timeline.fps, hasPlayer]);

  const step = (frames: number) => {
    const { currentTime, seek } = usePlayback.getState();
    seek(currentTime + frames / timeline.fps);
  };

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
            <div dir="rtl" className="grid h-full place-items-center px-6 text-center text-sm text-zinc-400">
              <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-600 px-6 py-8 hover:border-violet-500 hover:text-white">
                <Upload className="size-8 text-violet-400" />
                <span className="font-medium">העלאת סרטונים</span>
                <span className="text-xs text-zinc-500">הסרטונים נכנסים לציר הזמן לפי הסדר</span>
                <FileInput onFiles={(files) => files?.length && useUploads.getState().enqueue([...files])} />
              </label>
            </div>
          )}
          {duration > 0 && <OverlayHandles />}
          {duration > 0 && <AutoEditSuggestion />}
          {previewVariant && (
            <div dir="rtl" className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-blue-600/80 to-transparent px-3 py-2 text-xs font-medium">
              תצוגה מקדימה: וריאציה {previewVariant.label} · עדיין לא הוחלה
            </div>
          )}
        </div>
      </div>

      <div dir="ltr" className="flex w-full max-w-xl items-center justify-between gap-3">
        <TimeLabel fps={timeline.fps} />
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

/** השעון מתעדכן 30 פעם בשנייה, ולכן הוא רכיב נפרד: רק הוא מתרנדר, לא כל הנגן */
function TimeLabel({ fps }: { fps: number }) {
  const t = usePlayback((s) => s.currentTime);
  return <span className="w-24 font-mono text-xs tabular-nums text-zinc-400">{formatTime(t, fps)}</span>;
}

function CtrlBtn({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} title={label} aria-label={label}
      className="grid size-8 place-items-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-white">
      {children}
    </button>
  );
}

/**
 * אחרי העלאה, כשעוד לא נערך כלום: שאלה אחת, "מה הסרטון?". לחיצה על תשובה מפעילה
 * את העריכה האוטומטית המתאימה ופותחת את לשונית "חכם" (שם הגרסאות לבחירה).
 */
function AutoEditSuggestion() {
  const uploading = useUploads((s) => s.items.length > 0);
  const untouched = useEditor((s) => s.timeline.overlays.length === 0 && s.timeline.captions.length === 0 && s.timeline.audio.length === 0);
  const ran = useAutoEditRun((s) => !!s.busy || s.options.length > 0 || !!s.report);
  const [dismissed, setDismissed] = useState(false);
  const [last] = useState(() => (typeof window === "undefined" ? undefined : loadMyStyle().genre));
  if (uploading || !untouched || ran || dismissed) return null;
  const go = (genre: VideoGenre) => {
    window.dispatchEvent(new Event(OPEN_SMART_EVENT));
    void runAutoEdit(genre);
  };
  return (
    <div dir="rtl" className="absolute inset-x-1.5 bottom-1.5 rounded-xl bg-black/80 p-2 shadow-2xl backdrop-blur">
      <div className="mb-1 flex items-center justify-between">
        <p className="flex items-center gap-1 text-xs font-semibold"><Sparkles className="size-3.5 text-fuchsia-400" /> מה הסרטון?</p>
        <button onClick={() => setDismissed(true)} aria-label="לא עכשיו" className="grid size-6 place-items-center rounded-full text-zinc-400 hover:bg-white/10">
          <XIcon className="size-3.5" />
        </button>
      </div>
      <div className="grid gap-1">
        {GENRES.map((g) => (
          <button key={g.id} onClick={() => go(g.id)}
            className={cn("flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1.5 text-start text-xs font-medium",
              last === g.id ? "bg-gradient-to-l from-violet-600 to-fuchsia-600" : "bg-white/10 hover:bg-white/20")}>
            <span className="text-sm leading-none">{g.emoji}</span>{g.label}
          </button>
        ))}
      </div>
      <button onClick={() => go("auto")} className="mt-1 w-full text-center text-[10px] text-zinc-400 underline">שהעורך יזהה לבד</button>
    </div>
  );
}
