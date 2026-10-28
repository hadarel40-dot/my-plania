import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Overlay } from "@/lib/editor/types";

const OUT_SEC = 0.3;

/**
 * טקסט או אימוג'י מונפש. כל האנימציה נגזרת מהפריים הנוכחי בלבד, כך שהתצוגה
 * בדפדפן והרינדור לקובץ ייראו בדיוק אותו דבר.
 */
export function OverlayView({ overlay: o, durationInFrames }: { overlay: Overlay; durationInFrames: number }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const unit = width / 1080;
  const t = frame / fps;

  // כניסה: קפיץ 0→1 (עם "קפיצת יתר" בניתור)
  const p = spring({ frame, fps, config: o.animIn === "bounce" ? { damping: 7, mass: 0.7 } : { damping: 14, mass: 0.6 } });
  let scale = 1;
  let opacity = 1;
  let dx = 0;
  let dy = 0;
  let rotate = o.rotate;
  let text = o.text;

  switch (o.animIn) {
    case "pop":
    case "bounce":
      scale = p;
      opacity = Math.min(1, frame / (0.08 * fps));
      break;
    case "slide-up":
      dy = (1 - p) * height * 0.12;
      opacity = p;
      break;
    case "slide-side":
      dx = (1 - p) * width * 0.6;
      opacity = Math.min(1, p * 1.5);
      break;
    case "zoom":
      scale = interpolate(p, [0, 1], [2.6, 1]);
      opacity = Math.min(1, p * 1.4);
      break;
    case "fade":
      opacity = interpolate(frame, [0, 0.4 * fps], [0, 1], { extrapolateRight: "clamp" });
      break;
    case "typewriter": {
      const chars = [...o.text];
      text = chars.slice(0, Math.floor(frame / (0.055 * fps)) + 1).join("");
      break;
    }
  }

  // תנועה חוזרת
  switch (o.loop) {
    case "pulse": scale *= 1 + 0.07 * Math.sin(t * Math.PI * 3); break;
    case "wiggle": rotate += 9 * Math.sin(t * Math.PI * 4); break;
    case "float": dy += 18 * unit * Math.sin(t * Math.PI * 1.6); break;
    case "shake": dx += 9 * unit * Math.sin(t * Math.PI * 24); break;
  }

  // יציאה ב-0.3 השניות האחרונות
  const out = interpolate(frame, [durationInFrames - OUT_SEC * fps, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  switch (o.animOut) {
    case "fade": opacity *= 1 - out; break;
    case "pop": scale *= 1 - out; break;
    case "slide-down": dy += out * height * 0.12; opacity *= 1 - out; break;
  }

  const fontSize = o.size * unit;
  return (
    <div
      style={{
        position: "absolute",
        left: o.x * width,
        top: o.y * height,
        transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px) rotate(${rotate}deg) scale(${Math.max(0, scale)})`,
        opacity,
        maxWidth: width * 0.9,
        width: "max-content",
        direction: "rtl",
        textAlign: "center",
        whiteSpace: "pre-wrap",
        lineHeight: 1.15,
        fontFamily: "'Heebo', 'Rubik', system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif",
        fontSize,
        fontWeight: o.weight,
        color: o.color,
        ...(o.stroke ? { WebkitTextStroke: `${Math.max(2, fontSize * 0.05)}px black`, paintOrder: "stroke fill" } : {}),
        ...(o.background
          ? { background: o.background, padding: `${fontSize * 0.18}px ${fontSize * 0.4}px`, borderRadius: fontSize * 0.3 }
          : {}),
        textShadow: o.stroke || o.background || o.kind === "emoji" ? undefined : "0 4px 16px rgba(0,0,0,.6)",
      }}
    >
      {text}
    </div>
  );
}
