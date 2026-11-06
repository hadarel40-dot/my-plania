import { createContext, useContext } from "react";
import { AbsoluteFill, Html5Audio, Html5Video, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { AudioClip, Caption, Look, MediaAsset, Timeline } from "@/lib/editor/types";
import { OverlayView } from "./overlay-view";
import { layoutClips, transitionOverlap } from "@/lib/editor/timeline-utils";
import { ClipLayer, VideoLayerView } from "./clip-layer";
import { wordTimes } from "@/lib/editor/captions";
import { fontFamily } from "@/lib/editor/fonts";

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
  const { width, height, durationInFrames: totalFrames } = useVideoConfig();
  const { mode: mediaMode, Video: VideoTag, Audio: AudioTag } = useContext(MediaTagsContext);
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <ZoomLayer zooms={timeline.zooms} fps={fps}>
      {layoutClips(timeline.clips).map(({ clip, start, end }, i, all) => {
        const ov = override?.clipId === clip.id ? override : null;
        const asset = assets[ov?.assetId ?? clip.assetId];
        const look = ov?.look ?? clip.look;
        const from = Math.round(start * fps);
        const duration = Math.max(1, Math.round(end * fps) - from);
        if (!asset) return null;
        // מעבר: בחפיפה, אורך המעבר הוא בדיוק החפיפה עם הקליפ הקודם (layoutClips כבר הקדים את הקליפ)
        const own = i > 0 ? clip.transitionIn : undefined;
        const overlap = own ? transitionOverlap(clip, all[i - 1].end - all[i - 1].start) : 0;
        const intro = own
          ? { type: own.type, frames: Math.max(1, Math.round((overlap || Math.min(own.duration, (end - start) / 2)) * fps)) }
          : null;
        return (
          <Sequence key={clip.id} from={from} durationInFrames={duration} premountFor={Math.round(fps * 1.5)}>
            <ClipLayer clip={clip} asset={asset} look={look} duration={duration} fps={fps} mode={mediaMode} Video={VideoTag} intro={intro}
              backdrop={clip.backdrop ? assets[clip.backdrop] ?? null : null}
              voice={timeline.voice === "clean" && assets[clip.sourceAssetId]?.cleanAudio ? assets[assets[clip.sourceAssetId].cleanAudio!] ?? null : null}
              Audio={AudioTag} />
          </Sequence>
        );
      })}
      </ZoomLayer>

      {(timeline.layers ?? []).map((l) => {
        const asset = assets[l.assetId];
        if (!asset) return null;
        const from = Math.round(l.start * fps);
        const duration = Math.max(1, Math.round((l.out - l.in) * fps));
        return (
          <Sequence key={l.id} from={from} durationInFrames={duration} premountFor={Math.round(fps * 1.5)}>
            <VideoLayerView layer={l} asset={asset} Video={VideoTag} mode={mediaMode} fps={fps} />
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
        // שיר שממשיך אחרי סוף הסרטון נחתך שם, עם דהייה קצרה במקום קטיעה
        const cut = Math.max(1, Math.round(totalFrames - from));
        const audible = Math.min(duration, cut);
        const fade = audible < duration ? { ...a, fadeOut: Math.max(a.fadeOut, END_FADE_SEC) } : a;
        return (
          <Sequence key={a.id} from={from} durationInFrames={audible} layout="none">
            <AudioTag src={asset.url} trimBefore={Math.round(a.in * fps)} volume={(f: number) => audioVolume(fade, f, audible, fps)} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}

/**
 * זום קצר פנימה ברגעי הדגשה: נכנס מהר, נשאר, ויוצא בעדינות. רק הווידאו מתקרב,
 * הכתוביות והטקסטים נשארים במקום.
 */
function ZoomLayer({ zooms, fps, children }: { zooms?: { start: number; end: number; scale: number }[]; fps: number; children: React.ReactNode }) {
  const frame = useCurrentFrame();
  const t = frame / fps;
  let scale = 1;
  for (const z of zooms ?? []) {
    if (t < z.start || t > z.end + 0.25) continue;
    const inP = Math.min(1, (t - z.start) / 0.12);
    const outP = t > z.end ? Math.max(0, 1 - (t - z.end) / 0.25) : 1;
    const ease = 1 - Math.pow(1 - inP, 3);
    scale = Math.max(scale, 1 + (z.scale - 1) * ease * outP);
  }
  return <AbsoluteFill style={scale !== 1 ? { transform: `scale(${scale.toFixed(4)})` } : undefined}>{children}</AbsoluteFill>;
}

/** עוצמה לפי פריים: דהייה פנימה בהתחלה ודהייה החוצה בסוף */

/** דהייה בסוף הסרטון לשיר שממשיך אחרי שהווידאו נגמר */
export const END_FADE_SEC = 1.2;

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
  const white = caption.color ?? "white";
  // גודל: לפי הבחירה (ברירת מחדל 1), ביחס לרוחב 1080
  const k = base * (caption.size ?? 1);
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
    fontFamily: fontFamily(caption.font),
    lineHeight: 1.25,
  };
  // קו מתאר: לפי הבחירה (דק / עבה / בלי), אחרת ברירת המחדל של הסגנון
  const stroke = (px: number): React.CSSProperties => {
    const w = caption.outline === "none" ? 0 : caption.outline === "thin" ? px * 0.5 : caption.outline === "bold" ? px * 1.6 : px;
    return w ? { WebkitTextStroke: `${w * k}px black`, paintOrder: "stroke fill" } : {};
  };
  // רקע מאחורי כל הכתובית (כהה או בהיר). על רקע בהיר הטקסט הרגיל כהה
  const plain = caption.box === "light" && !caption.color ? "#111" : white;
  const panel: React.CSSProperties = caption.box && caption.box !== "none"
    ? { background: caption.box === "dark" ? "rgba(0,0,0,.62)" : "rgba(255,255,255,.93)", padding: `${8 * k}px ${22 * k}px`, borderRadius: 22 * k, display: "inline-block" }
    : {};
  const wrap = (node: React.ReactNode) => (panel.background ? <span style={panel}>{node}</span> : node);

  switch (caption.preset) {
    case "minimal":
      return (
        <div style={{ ...box, fontSize: 48 * k, fontWeight: 500, color: plain, textShadow: "0 2px 8px rgba(0,0,0,.8)" }}>
          <span style={{ background: "rgba(0,0,0,.45)", padding: `${6 * k}px ${16 * k}px`, borderRadius: 8 * k }}>
            {/* המילה הנאמרת בצבע ההדגשה (כשבוחרים צבע הדגשה שאינו לבן) */}
            {words.map((w, i) => <span key={i} style={{ color: i === active && caption.accent && caption.accent !== "#ffffff" ? accent : undefined }}>{w.word} </span>)}
          </span>
        </div>
      );

    case "karaoke":
      return (
        <div style={{ ...box, fontSize: 76 * k, fontWeight: 800, ...stroke(4) }}>
          {wrap(words.map((w, i) => (
            <span key={i} style={{ color: i <= active ? accent : plain }}>{w.word} </span>
          )))}
        </div>
      );

    // כל המילים על המסך; המילה הנאמרת קופצת, גדלה ונצבעת
    case "word-pop":
      return (
        <div style={{ ...box, fontSize: 92 * k, fontWeight: 900, ...stroke(6) }}>
          {wrap(words.map((w, i) => {
            const on = i === active;
            const s = on ? 1 + 0.18 * pop(w.start) - 0.08 * Math.max(0, pop(w.start) - 1) : 1;
            return (
              <span key={i} style={{ display: "inline-block", margin: `0 ${10 * k}px`, color: on ? accent : plain, transform: `scale(${s})`, opacity: t >= w.start - 0.05 || i === 0 ? 1 : 0.85 }}>
                {w.word}
              </span>
            );
          }))}
        </div>
      );

    // המילה הנאמרת בתוך מלבן צבעוני
    case "highlight-box":
      return (
        <div style={{ ...box, fontSize: 86 * k, fontWeight: 900, color: plain, textShadow: `0 ${3 * k}px ${10 * k}px rgba(0,0,0,.6)` }}>
          {wrap(words.map((w, i) => (
            <span key={i} style={{
              display: "inline-block", margin: `${4 * k}px ${6 * k}px`, padding: `${2 * k}px ${14 * k}px`,
              borderRadius: 14 * k, background: i === active ? accent : "transparent",
              color: i === active ? "#111" : plain,
              transform: `scale(${i === active ? 0.9 + 0.1 * pop(w.start) : 1})`,
            }}>
              {w.word}
            </span>
          )))}
        </div>
      );

    // רק המילה הנוכחית, גדולה, קופצת מילה אחרי מילה
    case "one-word": {
      const w = words[active];
      if (!w) return null;
      const p = pop(w.start);
      return (
        <div style={{ ...box, fontSize: 140 * k, fontWeight: 900, color: accent, ...stroke(7), transform: `translateY(-50%) scale(${0.6 + 0.4 * p})`, opacity: Math.min(1, p * 1.5) }}>
          {wrap(w.word)}
        </div>
      );
    }

    // ניאון: כל הטקסט זוהר בעדינות, והמילה הנאמרת זוהרת חזק בצבע ההדגשה
    case "neon":
      return (
        <div style={{ ...box, fontSize: 88 * k, fontWeight: 800 }}>
          {wrap(words.map((w, i) => {
            const on = i === active;
            return (
              <span key={i} style={{ margin: `0 ${8 * k}px`, color: on ? "#fff" : plain,
                textShadow: on ? `0 0 ${10 * k}px ${accent}, 0 0 ${24 * k}px ${accent}, 0 0 ${48 * k}px ${accent}` : `0 0 ${10 * k}px rgba(255,255,255,.45)` }}>
                {w.word}
              </span>
            );
          }))}
        </div>
      );

    // קו בצבע ההדגשה שנמתח מתחת למילה הנאמרת
    case "underline":
      return (
        <div style={{ ...box, fontSize: 86 * k, fontWeight: 900, color: plain, ...stroke(5) }}>
          {wrap(words.map((w, i) => {
            const on = i === active;
            const grow = on ? Math.min(1, pop(w.start)) : i < active ? 1 : 0;
            return (
              <span key={i} style={{ position: "relative", display: "inline-block", margin: `0 ${9 * k}px` }}>
                {w.word}
                <span style={{ position: "absolute", insetInline: 0, bottom: -6 * k, height: 10 * k, borderRadius: 6 * k, background: accent, transform: `scaleX(${grow})`, transformOrigin: "right", opacity: on ? 1 : 0.55 }} />
              </span>
            );
          }))}
        </div>
      );

    // כל מילה בבועה משלה; הבועה של המילה הנאמרת בצבע ההדגשה וקופצת
    case "bubble":
      return (
        <div style={{ ...box, fontSize: 70 * k, fontWeight: 800 }}>
          {words.map((w, i) => {
            const on = i === active;
            return (
              <span key={i} style={{ display: "inline-block", margin: `${6 * k}px ${5 * k}px`, padding: `${6 * k}px ${22 * k}px`, borderRadius: 999,
                background: on ? accent : "rgba(15,12,28,.78)", color: on ? "#111" : plain === "#111" ? "#fff" : plain,
                transform: `scale(${on ? 0.92 + 0.12 * pop(w.start) : 1})`, boxShadow: `0 ${4 * k}px ${14 * k}px rgba(0,0,0,.35)` }}>
                {w.word}
              </span>
            );
          })}
        </div>
      );

    // מכונת כתיבה: האותיות מופיעות אחת אחרי השנייה, בקצב הדיבור
    case "typewriter": {
      const shown = Math.ceil(caption.text.length * Math.min(1, t / Math.max(0.2, (caption.end - caption.start) * 0.8)));
      return (
        <div style={{ ...box, fontSize: 74 * k, fontWeight: 700, color: plain, ...stroke(4) }}>
          {wrap(<>{caption.text.slice(0, shown)}<span style={{ color: accent, opacity: frame % 16 < 8 ? 1 : 0 }}>|</span></>)}
        </div>
      );
    }

    // החלקה: הכתובית עולה מלמטה ונכנסת, המילה הנאמרת בצבע ההדגשה
    case "slide": {
      const p = Math.min(1, frame / (fps * 0.22));
      const ease = 1 - Math.pow(1 - p, 3);
      return (
        <div style={{ ...box, fontSize: 82 * k, fontWeight: 900, ...stroke(5), transform: `translateY(calc(-50% + ${(1 - ease) * 60 * k}px))`, opacity: ease }}>
          {wrap(words.map((w, i) => <span key={i} style={{ color: i === active ? accent : plain }}>{w.word} </span>))}
        </div>
      );
    }

    // חלול: אותיות עם קו מתאר בלבד, והמילה הנאמרת מתמלאת בצבע
    case "outline":
      return (
        <div style={{ ...box, fontSize: 96 * k, fontWeight: 900 }}>
          {wrap(words.map((w, i) => {
            const on = i <= active;
            return (
              <span key={i} style={{ margin: `0 ${8 * k}px`, color: on ? accent : "transparent", WebkitTextStroke: `${3 * k}px ${on ? accent : plain === "#111" ? "#111" : "#fff"}`,
                transform: `scale(${i === active ? 0.94 + 0.08 * pop(w.start) : 1})`, display: "inline-block" }}>
                {w.word}
              </span>
            );
          }))}
        </div>
      );

    // תלת-ממד: צל עמוק בצבע ההדגשה, כמו אותיות בולטות
    case "shadow3d": {
      const depth = [1, 2, 3, 4, 5, 6].map((d) => `${d * 1.6 * k}px ${d * 1.6 * k}px 0 ${accent}`).join(", ");
      return (
        <div style={{ ...box, fontSize: 90 * k, fontWeight: 900, color: plain === "#111" ? "#fff" : plain, textShadow: depth }}>
          {wrap(words.map((w, i) => (
            <span key={i} style={{ display: "inline-block", margin: `0 ${8 * k}px`, transform: `scale(${i === active ? 1 + 0.12 * pop(w.start) - 0.06 * Math.max(0, pop(w.start) - 1) : 1})` }}>{w.word}</span>
          )))}
        </div>
      );
    }

    // גרדיאנט: מעבר צבעים מצבע ההדגשה ללבן לאורך הטקסט
    case "gradient":
      return (
        <div style={{ ...box, fontSize: 92 * k, fontWeight: 900, filter: `drop-shadow(0 ${3 * k}px ${4 * k}px rgba(0,0,0,.6))` }}>
          {wrap(words.map((w, i) => (
            <span key={i} style={{ display: "inline-block", margin: `0 ${8 * k}px`, backgroundImage: `linear-gradient(90deg, ${accent}, ${plain === "#111" ? "#7c3aed" : "#ffffff"})`,
              WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", transform: `scale(${i === active ? 1 + 0.1 * pop(w.start) - 0.05 * Math.max(0, pop(w.start) - 1) : 1})` }}>
              {w.word}
            </span>
          )))}
        </div>
      );

    default: {
      const p = Math.min(1, frame / (fps * 0.12));
      return (
        <div style={{ ...box, fontSize: 72 * k, fontWeight: 900, color: plain, ...stroke(4), transform: `translateY(-50%) scale(${0.85 + 0.15 * p})`, opacity: p }}>
          {wrap(words.map((w, i) => <span key={i} style={{ color: i === active ? accent : plain }}>{w.word} </span>))}
        </div>
      );
    }
  }
}
