import { AbsoluteFill, Html5Video, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import type { Caption, Look, MediaAsset, Timeline } from "@/lib/editor/types";
import { layoutClips } from "@/lib/editor/timeline-utils";

export interface CompositionProps extends Record<string, unknown> {
  timeline: Timeline;
  assets: Record<string, MediaAsset>;
  /** וריאציה בתצוגה מקדימה: מחליפה זמנית קליפ אחד בלי לשנות את ציר הזמן */
  override: { clipId: string; assetId: string; look: Look } | null;
}

/**
 * אותה קומפוזיציה משמשת לתצוגה החיה בדפדפן (Remotion Player, על ה-proxy)
 * ולרינדור הסופי בענן (Remotion Lambda, על קבצי המקור).
 */
export function TimelineComposition({ timeline, assets, override }: CompositionProps) {
  const { fps } = timeline;
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
            <Html5Video
              src={asset.url}
              trimBefore={Math.round(clip.in * fps)}
              pauseWhenBuffering
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
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
    </AbsoluteFill>
  );
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
