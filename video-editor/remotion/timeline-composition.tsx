import { AbsoluteFill, Html5Audio, Html5Video, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { AudioClip, Caption, Look, MediaAsset, Timeline } from "@/lib/editor/types";
import { Audio as MediaAudio, Video as MediaVideo } from "@remotion/media";
import { OverlayView } from "./overlay-view";
import { layoutClips } from "@/lib/editor/timeline-utils";

export interface CompositionProps extends Record<string, unknown> {
  timeline: Timeline;
  assets: Record<string, MediaAsset>;
  /** וריאציה בתצוגה מקדימה: מחליפה זמנית קליפ אחד בלי לשנות את ציר הזמן */
  override: { clipId: string; assetId: string; look: Look } | null;
  /**
   * html5: תגיות video/audio רגילות (לתצוגה בנגן). media: רכיבי @remotion/media,
   * שנדרשים לרינדור לקובץ בתוך הדפדפן.
   */
  mediaMode?: "html5" | "media";
}

/**
 * אותה קומפוזיציה משמשת לתצוגה החיה בדפדפן (Remotion Player, על ה-proxy)
 * ולרינדור הסופי בענן (Remotion Lambda, על קבצי המקור).
 */
export function TimelineComposition({ timeline, assets, override, mediaMode = "html5" }: CompositionProps) {
  const { fps } = timeline;
  const VideoTag = mediaMode === "media" ? MediaVideo : Html5Video;
  const AudioTag = mediaMode === "media" ? MediaAudio : Html5Audio;
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
            <VideoTag
              src={asset.url}
              trimBefore={Math.round(clip.in * fps)}
              volume={clip.volume ?? 1}
              {...(mediaMode === "html5" ? { pauseWhenBuffering: true } : { objectFit: "cover" as const })}
              style={{
                width: "100%",
                height: "100%",
                ...(mediaMode === "html5" ? { objectFit: "cover" as const } : {}),
                filter: look.filter,
                transform: `scale(${look.zoom}) scaleX(${look.flip ? -1 : 1})`,
              }}
            />
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
            <AudioTag src={asset.url} trimBefore={Math.round(a.in * fps)} volume={(f) => audioVolume(a, f, duration, fps)} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}

/** עוצמה לפי פריים: דהייה פנימה בהתחלה ודהייה החוצה בסוף */
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
  const pop = Math.min(1, frame / (fps * 0.12));

  const words = caption.text.split(" ");
  const spoken = Math.floor((frame / ((caption.end - caption.start) * fps)) * words.length);

  const common: React.CSSProperties = {
    position: "absolute",
    insetInline: 60 * base,
    bottom: "18%",
    textAlign: "center",
    direction: "rtl",
    fontFamily: "'Heebo', 'Rubik', system-ui, sans-serif",
    lineHeight: 1.2,
  };

  if (caption.preset === "minimal") {
    return (
      <div style={{ ...common, fontSize: 48 * base, fontWeight: 500, color: "white", textShadow: "0 2px 8px rgba(0,0,0,.8)" }}>
        <span style={{ background: "rgba(0,0,0,.45)", padding: `${6 * base}px ${16 * base}px`, borderRadius: 8 * base }}>
          {caption.text}
        </span>
      </div>
    );
  }

  if (caption.preset === "karaoke") {
    return (
      <div style={{ ...common, fontSize: 64 * base, fontWeight: 800, WebkitTextStroke: `${3 * base}px black`, paintOrder: "stroke fill" }}>
        {words.map((w, i) => (
          <span key={i} style={{ color: i <= spoken ? "#facc15" : "white" }}>{w} </span>
        ))}
      </div>
    );
  }

  return (
    <div
      style={{
        ...common,
        fontSize: 72 * base,
        fontWeight: 900,
        color: "white",
        WebkitTextStroke: `${4 * base}px black`,
        paintOrder: "stroke fill",
        transform: `scale(${0.85 + 0.15 * pop})`,
        opacity: pop,
      }}
    >
      {caption.text}
    </div>
  );
}
