"use client";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { Loader2, Pause, Play, SkipBack, SkipForward, Upload } from "lucide-react";
import { MediaTagsContext, TimelineComposition, type CompositionProps, type MediaTags } from "@/remotion/timeline-composition";
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
import { CaptionsSheet } from "./captions-sheet";
import { loadMyStyle, rememberStyle } from "@/lib/editor/my-style";
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
  const mediaTags = usePreviewMediaTags();

  const { width, height } = ASPECT_SIZE[timeline.aspect];
  const duration = timelineDuration(timeline);
  const durationInFrames = Math.max(1, Math.ceil(duration * timeline.fps));
  const hasPlayer = duration > 0;
  const busyUploading = useUploads((s) => s.picking || s.items.length > 0);

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
            <MediaTagsContext.Provider value={mediaTags}>
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
            </MediaTagsContext.Provider>
          ) : (
            <div dir="rtl" className="grid h-full place-items-center px-6 text-center text-sm text-zinc-400">
              <EmptyUploadState />
              <label className={cn("flex cursor-pointer flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-600 px-6 py-8 hover:border-violet-500 hover:text-white active:scale-95 transition", busyUploading && "hidden")}>
                <Upload className="size-8 text-violet-400" />
                <span className="font-medium">העלאת סרטונים</span>
                <span className="text-xs text-zinc-500">הסרטונים נכנסים לציר הזמן לפי הסדר</span>
                <FileInput onFiles={(files) => files?.length && useUploads.getState().enqueue([...files])} />
              </label>
            </div>
          )}
          {duration > 0 && <OverlayHandles />}
          <ActivityBar />
          <CaptionsSheet />
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

/** סך ההתקדמות של סבב ההעלאה (0..100) */
function useUploadSummary() {
  const items = useUploads((s) => s.items);
  const total = useUploads((s) => s.total);
  const done = useUploads((s) => s.done);
  const picking = useUploads((s) => s.picking);
  const percent = total ? Math.round((done * 100 + items.reduce((sum, i) => sum + i.progress, 0)) / total) : 0;
  const compressing = items.some((i) => i.stage === "compress");
  return { uploading: items.length > 0, picking, total, done, percent, compressing };
}

/** בפרויקט ריק: במקום כפתור ההעלאה, מה קורה עכשיו (בוחרים / מכינים / מעלים) */
function EmptyUploadState() {
  const { uploading, picking, total, done, percent, compressing } = useUploadSummary();
  if (!uploading && !picking) return null;
  return (
    <div className="flex w-full max-w-60 flex-col items-center gap-3">
      <Loader2 className="size-8 animate-spin text-violet-400" />
      <p className="font-medium text-zinc-200">
        {uploading ? `מעלה סרטונים · ${Math.min(done + 1, total)} מתוך ${total}` : "מחכה לסרטונים מהגלריה…"}
      </p>
      {uploading
        ? <div className="h-1.5 w-full overflow-hidden rounded bg-zinc-800"><div className="h-full rounded bg-gradient-to-l from-violet-500 to-fuchsia-500 transition-[width]" style={{ width: `${percent}%` }} /></div>
        : <>
            <p className="text-xs text-zinc-500">אחרי הבחירה האייפון מכין את הסרטונים. זה יכול לקחת כמה שניות</p>
            <label className="cursor-pointer text-xs text-violet-300 underline">
              לבחור שוב
              <FileInput onFiles={(files) => files?.length && useUploads.getState().enqueue([...files])} />
            </label>
          </>}
      {compressing && <p className="text-xs text-zinc-500">סרטון גדול מכווץ קודם, כדי שייכנס</p>}
    </div>
  );
}

/** פס מצב קטן בראש הנגן: העלאה, או עריכה אוטומטית שרצה */
function ActivityBar() {
  const { uploading, picking, total, done, percent } = useUploadSummary();
  const hasClips = useEditor((s) => s.timeline.clips.length > 0);
  const busy = useAutoEditRun((s) => s.busy);
  const text = busy
    ? busy
    : uploading ? `מעלה ${Math.min(done + 1, total)} מתוך ${total} · ${percent}%`
      : picking ? "מחכה לסרטונים מהגלריה…" : null;
  if (!text || (!hasClips && !busy)) return null;
  return (
    <div dir="rtl" className="pointer-events-none absolute inset-x-1.5 top-1.5 z-10 overflow-hidden rounded-xl bg-black/80 shadow-lg backdrop-blur">
      <div className="flex items-start gap-1.5 px-2 py-1.5 text-[11px] font-medium">
        <Loader2 className="mt-px size-3.5 shrink-0 animate-spin text-fuchsia-400" />
        <span className="min-w-0 leading-snug">{busy ? `✨ ${text}` : text}</span>
      </div>
      {uploading && !busy && <div className="h-0.5 bg-gradient-to-l from-violet-500 to-fuchsia-500 transition-[width]" style={{ width: `${percent}%` }} />}
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
  const [noMusic, setNoMusic] = useState(() => (typeof window === "undefined" ? false : loadMyStyle().withMusic === false));
  if (uploading || !untouched || ran || dismissed) return null;
  const go = (genre: VideoGenre) => {
    window.dispatchEvent(new Event(OPEN_SMART_EVENT));
    void runAutoEdit(genre);
  };
  return (
    <div dir="rtl" className="absolute inset-x-1.5 bottom-1.5 max-h-[calc(100%-12px)] overflow-y-auto rounded-xl bg-black/80 p-2 shadow-2xl backdrop-blur">
      <div className="mb-1 flex items-center justify-between">
        <p className="flex items-center gap-1 whitespace-nowrap text-xs font-semibold"><Sparkles className="size-3.5 text-fuchsia-400" /> מה הסרטון?</p>
        <button onClick={() => setDismissed(true)} aria-label="לא עכשיו" className="grid size-6 place-items-center rounded-full text-zinc-400 hover:bg-white/10">
          <XIcon className="size-3.5" />
        </button>
      </div>
      <div className="grid gap-1">
        {GENRES.map((g) => (
          <button key={g.id} onClick={() => go(g.id)}
            className={cn("flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-start text-[11px] font-medium leading-tight",
              last === g.id ? "bg-gradient-to-l from-violet-600 to-fuchsia-600" : "bg-white/10 hover:bg-white/20")}>
            <span className="shrink-0 text-sm leading-none">{g.emoji}</span>{g.label}
          </button>
        ))}
      </div>
      <label className="mt-1.5 flex items-center justify-center gap-1.5 text-[11px] text-zinc-300">
        <input type="checkbox" checked={noMusic} className="accent-violet-500"
          onChange={(e) => { setNoMusic(e.target.checked); rememberStyle({ withMusic: !e.target.checked }); }} />
        בלי מוזיקה (אוסיף בעצמי)
      </label>
      <button onClick={() => go("auto")} className="mt-1 w-full text-center text-[10px] text-zinc-400 underline">שהעורך יזהה לבד</button>
    </div>
  );
}

/**
 * מנוע הווידאו של התצוגה המקדימה. נגן הווידאו הרגיל של הדפדפן "תופס" כל קטע רק ברגע
 * החיתוך, ולכן הנגן עוצר לרגע בכל חיתוך (הקפיצות). כשיש WebCodecs (כמעט בכל דפדפן,
 * גם באייפון), משתמשים באותו מנוע של הייצוא: הוא מפענח כל פריים מראש ובדיוק, החיתוכים
 * חלקים, והתצוגה זהה לסרטון שיוצא. נטען ברקע; עד אז, הנגן הרגיל.
 */
let mediaTagsCache: MediaTags | null = null;
function usePreviewMediaTags(): MediaTags {
  const fallback = useContext(MediaTagsContext);
  const [tags, setTags] = useState<MediaTags>(() => mediaTagsCache ?? fallback);
  useEffect(() => {
    if (mediaTagsCache || typeof VideoDecoder === "undefined" || typeof AudioDecoder === "undefined") return;
    let alive = true;
    import("@/remotion/media-tags").then(({ MEDIA_TAGS }) => {
      mediaTagsCache = MEDIA_TAGS;
      if (alive) setTags(MEDIA_TAGS);
    }).catch(() => undefined);
    return () => { alive = false; };
  }, []);
  return tags;
}
