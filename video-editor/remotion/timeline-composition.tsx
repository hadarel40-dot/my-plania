import { createContext, useContext } from "react";
import { AbsoluteFill, Html5Audio, Html5Video, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { AudioClip, Caption, Look, MediaAsset, Timeline } from "@/lib/editor/types";
import { OverlayView } from "./overlay-view";
import { layoutClips } from "@/lib/editor/timeline-utils";
import { wordTimes } from "@/lib/editor/captions";

export interface CompositionProps extends Record<string, unknown> {
  timeline: Timeline;
  assets: Record<string, MediaAsset>;
  /** וריאציה בתצוגה מקדימה: מחליפה זמנית קליפ אחד בלי לשנות את ציר הזמן */
  override: { clipId: string; assetId: string; look: Look } | null;
}

/**
 * אילו רכיבי וידאו/שמע הקומפוזיציה משתמשת. בנגן: תגיות video/audio רגילות.
 * בייצוא (remotion/export-composition) מוחלפים ברכיבי @remotion/media. דרך context,
 * כדי ש-@remotion/media (כמעט 2MB) ייטען רק כשמייצאים ולא בפתיחת העורך.
 */
export interface MediaTags {
  mode: "html5" | "media";
  Video: React.ComponentType<Record<string, unknown>>;
  Audio: React.ComponentType<Record<string, unknown>>;
}
export const MediaTagsContext = createContext<MediaTags>({
  mode: "html5",
  Video: Html5Video as unknown as MediaTags["Video"],
  Audio: Html5Audio as unknown as MediaTags["Audio"],
});

/**
 * אותה קומפוזיציה משמשת לתצוגה החיה בדפדפן (Remotion Player, על ה-proxy)
 * ולרינדור הסופי בענן (Remotion Lambda, על קבצי המקור).
 */
export function TimelineComposition({ timeline, assets, override }: CompositionProps) {
  const { fps } = timeline;
  const { width, height } = useVideoConfig();
  const { mode: mediaMode, Video: VideoTag, Audio: AudioTag } = useContext(MediaTagsContext);
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {layoutClips(timeline.clips).map(({ clip, start, end }) => {
        const ov = override?.clipId === clip.id ? override : null;
        const asset = assets[ov?.assetId ?? clip.assetId];
        const look = ov?.look ?? clip.look;
        const from = Math.round(start * fps);
        const duration = Math.max(1, Math.round(end * fps) - from);
        if (!asset) return null;
        return (
          <Sequence key={clip.id} from={from} durationInFrames={duration} premountFor={fps}>
            <AbsoluteFill style={{ overflow: "hidden", transform: `scale(${look.zoom}) scaleX(${look.flip ? -1 : 1})` }}>
              <VideoTag
                src={asset.url}
                trimBefore={Math.round(clip.in * fps)}
                volume={clip.volume ?? 1}
                {...(mediaMode === "html5" ? { pauseWhenBuffering: true } : { objectFit: "fill" as const })}
                style={{ ...coverBox(asset, clip, width, height), filter: look.filter }}
              />
            </AbsoluteFill>
          </Sequence>
        );
      })}

      {timeline.captions.map((cap) => {
        const from = Math.round(cap.start * fps);
        const duration = Math.max(1, Math.round(cap.end * fps) - from);
        return (
          <Sequence key={cap.id} from={from} durationInFrames={duration} layout="none">
            <CaptionView caption={cap} />
          </Sequence>
        );
      })}

      {(timeline.overlays ?? []).map((o) => {
        const from = Math.round(o.start * fps);
        const duration = Math.max(1, Math.round(o.end * fps) - from);
        return (
          <Sequence key={o.id} from={from} durationInFrames={duration} layout="none">
            <OverlayView overlay={o} durationInFrames={duration} />
          </Sequence>
        );
      })}

      {(timeline.audio ?? []).map((a) => {
        const asset = assets[a.assetId];
        if (!asset) return null;
        const from = Math.round(a.start * fps);
        const duration = Math.max(1, Math.round((a.out - a.in) * fps));
        return (
          <Sequence key={a.id} from={from} durationInFrames={duration} layout="none">
            <AudioTag src={asset.url} trimBefore={Math.round(a.in * fps)} volume={(f: number) => audioVolume(a, f, duration, fps)} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}

/** עוצמה לפי פריים: דהייה פנימה בהתחלה ודהייה החוצה בסוף */
/**
 * ממלא את המסגרת בסרטון (כמו object-fit: cover), אבל עם נקודת מיקוד: כשהסרטון רחב
 * מהמסך, focusX קובע איזה חלק ממנו נשאר בתמונה. גודל ומיקום מפורשים עובדים זהה
 * בנגן ובייצוא (רכיב הייצוא לא תומך ב-object-position).
 */
function coverBox(asset: MediaAsset, clip: { focusX?: number; focusY?: number }, W: number, H: number): React.CSSProperties {
  if (!asset.width || !asset.height) return { width: "100%", height: "100%", objectFit: "cover" };
  const scale = Math.max(W / asset.width, H / asset.height);
  const w = asset.width * scale;
  const h = asset.height * scale;
  const fx = clip.focusX ?? 0.5;
  const fy = clip.focusY ?? 0.5;
  // הפנים במרכז המסגרת, אבל בלי לחשוף שוליים ריקים
  const left = Math.min(0, Math.max(W - w, W / 2 - fx * w));
  const top = Math.min(0, Math.max(H - h, H / 2 - fy * h));
  return { position: "absolute", left, top, width: w, height: h, maxWidth: "none", objectFit: "fill" };
}

function audioVolume(a: AudioClip, frame: number, duration: number, fps: number) {
  const fadeIn = a.fadeIn > 0 ? interpolate(frame, [0, a.fadeIn * fps], [0, 1], { extrapolateRight: "clamp" }) : 1;
  const fadeOut = a.fadeOut > 0
    ? interpolate(frame, [duration - a.fadeOut * fps, duration], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 1;
  return a.volume * Math.min(fadeIn, fadeOut);
}

function CaptionView({ caption }: { caption: Caption }) {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const base = width / 1080;
  const t = frame / fps;
  const accent = caption.accent ?? "#facc15";
  const words = wordTimes(caption.text, caption.end - caption.start);
  // המילה שנאמרת עכשיו (אחרי הסוף נשארת האחרונה)
  const active = Math.max(0, words.findIndex((w) => t < w.end) === -1 ? words.length - 1 : words.findIndex((w) => t < w.end));
  const pop = (start: number) => spring({ frame: frame - Math.round(start * fps), fps, config: { damping: 12, stiffness: 220, mass: 0.6 } });

  const box: React.CSSProperties = {
    position: "absolute",
    insetInline: 60 * base,
    top: `${(caption.y ?? 0.78) * 100}%`,
    transform: "translateY(-50%)",
    textAlign: "center",
    direction: "rtl",
    fontFamily: "'Heebo', 'Rubik', system-ui, sans-serif",
    lineHeight: 1.25,
  };
  const stroke = (px: number): React.CSSProperties => ({ WebkitTextStroke: `${px * base}px black`, paintOrder: "stroke fill" });

  switch (caption.preset) {
    case "minimal":
      return (
        <div style={{ ...box, fontSize: 48 * base, fontWeight: 500, color: "white", textShadow: "0 2px 8px rgba(0,0,0,.8)" }}>
          <span style={{ background: "rgba(0,0,0,.45)", padding: `${6 * base}px ${16 * base}px`, borderRadius: 8 * base }}>
            {caption.text}
          </span>
        </div>
      );

    case "karaoke":
      return (
        <div style={{ ...box, fontSize: 76 * base, fontWeight: 800, ...stroke(4) }}>
          {words.map((w, i) => (
            <span key={i} style={{ color: i <= active ? accent : "white" }}>{w.word} </span>
          ))}
        </div>
      );

    // כל המילים על המסך; המילה הנאמרת קופצת, גדלה ונצבעת
    case "word-pop":
      return (
        <div style={{ ...box, fontSize: 92 * base, fontWeight: 900, ...stroke(6) }}>
          {words.map((w, i) => {
            const on = i === active;
            const s = on ? 1 + 0.18 * pop(w.start) - 0.08 * Math.max(0, pop(w.start) - 1) : 1;
            return (
              <span key={i} style={{ display: "inline-block", margin: `0 ${10 * base}px`, color: on ? accent : "white", transform: `scale(${s})`, opacity: t >= w.start - 0.05 || i === 0 ? 1 : 0.85 }}>
                {w.word}
              </span>
            );
          })}
        </div>
      );

    // המילה הנאמרת בתוך מלבן צבעוני
    case "highlight-box":
      return (
        <div style={{ ...box, fontSize: 86 * base, fontWeight: 900, color: "white", textShadow: `0 ${3 * base}px ${10 * base}px rgba(0,0,0,.6)` }}>
          {words.map((w, i) => (
            <span key={i} style={{
              display: "inline-block", margin: `${4 * base}px ${6 * base}px`, padding: `${2 * base}px ${14 * base}px`,
              borderRadius: 14 * base, background: i === active ? accent : "transparent",
              color: i === active ? "#111" : "white",
              transform: `scale(${i === active ? 0.9 + 0.1 * pop(w.start) : 1})`,
            }}>
              {w.word}
            </span>
          ))}
        </div>
      );

    // רק המילה הנוכחית, גדולה, קופצת מילה אחרי מילה
    case "one-word": {
      const w = words[active];
      if (!w) return null;
      const p = pop(w.start);
      return (
        <div style={{ ...box, fontSize: 140 * base, fontWeight: 900, color: accent, ...stroke(7), transform: `translateY(-50%) scale(${0.6 + 0.4 * p})`, opacity: Math.min(1, p * 1.5) }}>
          {w.word}
        </div>
      );
    }

    default: {
      const p = Math.min(1, frame / (fps * 0.12));
      return (
        <div style={{ ...box, fontSize: 72 * base, fontWeight: 900, color: "white", ...stroke(4), transform: `translateY(-50%) scale(${0.85 + 0.15 * p})`, opacity: p }}>
          {caption.text}
        </div>
      );
    }
  }
}
