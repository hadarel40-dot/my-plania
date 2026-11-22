import { Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Overlay } from "@/lib/editor/types";
import { fontFamily } from "@/lib/editor/fonts";

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
  let blur = 0;
  let clip: string | undefined;

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
    case "blur": {
      // מטושטש לחד, כמו פוקוס של מצלמה
      const q = interpolate(frame, [0, 0.45 * fps], [0, 1], { extrapolateRight: "clamp" });
      blur = (1 - q) * 22 * unit;
      opacity = q;
      scale = interpolate(q, [0, 1], [1.08, 1]);
      break;
    }
    case "wipe": {
      // נחשף מימין לשמאל, כמו מסכה
      const q = interpolate(frame, [0, 0.5 * fps], [0, 1], { extrapolateRight: "clamp" });
      clip = `inset(-20% -5% -20% ${(1 - q) * 105}%)`;
      break;
    }
    case "drop":
      dy = -(1 - spring({ frame, fps, config: { damping: 9, mass: 0.8 } })) * height * 0.18;
      opacity = Math.min(1, frame / (0.1 * fps));
      break;
    case "spin":
      rotate += (1 - p) * -35;
      scale = interpolate(p, [0, 1], [0.3, 1]);
      opacity = Math.min(1, p * 1.5);
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
  if (o.kind === "shape") {
    return <ShapeView o={o} frame={frame} fps={fps} width={width} height={height} unit={unit} opacity={opacity} />;
  }
  if (o.kind === "image" && o.src) {
    // צילום מסך שקופץ מעל הסרטון: פינות עגולות, מסגרת לבנה וצל
    return (
      <div style={{ position: "absolute", left: o.x * width, top: o.y * height, transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px) rotate(${rotate}deg) scale(${Math.max(0, scale)})`, opacity }}>
        <Img src={o.src} crossOrigin="anonymous" style={{ width: fontSize, display: "block", borderRadius: fontSize * 0.06, border: `${Math.max(3, fontSize * 0.012)}px solid #fff`, boxShadow: "0 20px 50px rgba(0,0,0,.45)" }} />
      </div>
    );
  }
  return (
    <div
      style={{
        position: "absolute",
        left: o.x * width,
        top: o.y * height,
        transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px) rotate(${rotate}deg) scale(${Math.max(0, scale)})`,
        opacity,
        ...(blur ? { filter: `blur(${blur}px)` } : {}),
        ...(clip ? { clipPath: clip } : {}),
        maxWidth: width * 0.9,
        width: "max-content",
        direction: "rtl",
        textAlign: "center",
        whiteSpace: "pre-wrap",
        lineHeight: 1.15,
        fontFamily: fontFamily(o.font),
        fontSize,
        fontWeight: o.weight,
        color: o.color,
        ...(o.stroke ? { WebkitTextStroke: `${Math.max(1, fontSize * (o.strokeWidth ?? 0.05))}px ${o.strokeColor ?? "black"}`, paintOrder: "stroke fill" } : {}),
        ...(o.background
          ? { background: o.background, padding: `${fontSize * 0.18}px ${fontSize * 0.4}px`, borderRadius: fontSize * 0.3 }
          : {}),
        textShadow: o.shadow ?? (o.stroke || o.background || o.kind === "emoji" ? undefined : "0 4px 16px rgba(0,0,0,.6)"),
      }}
    >
      {text}
    </div>
  );
}

/**
 * גרפיקה שנכתבת על המסך: קו בכתב יד מתחת למילה, עיגול סביבה, חץ, ניצוצות או קרני הדגשה.
 * הקו "נכתב" בהדרגה (כמו טוש), ואז נשאר. size הוא הרוחב, text הוא סוג הצורה.
 */
function ShapeView({ o, frame, fps, width, height, unit, opacity }: { o: Overlay; frame: number; fps: number; width: number; height: number; unit: number; opacity: number }) {
  const w = o.size * unit;
  const draw = interpolate(frame, [0, 0.55 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sw = Math.max(4, w * 0.018);
  const common = { fill: "none", stroke: o.color, strokeWidth: sw, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - draw };
  let svg: React.ReactNode = null;
  let h = w * 0.3;
  switch (o.text) {
    case "underline":
      h = w * 0.16;
      svg = <path d="M4 60 C 120 30, 260 26, 396 44 M 60 76 C 170 58, 290 58, 360 68" {...common} />;
      break;
    case "circle":
      h = w * 0.5;
      svg = <path d="M 330 20 C 400 40, 410 140, 300 176 C 180 210, 30 190, 12 120 C -4 60, 90 12, 210 10 C 280 8, 360 30, 372 60" {...common} />;
      break;
    case "arrow":
      h = w * 0.7;
      svg = <><path d="M 360 20 C 300 40, 200 80, 120 210" {...common} /><path d="M 90 170 L 118 214 L 168 196" {...common} strokeDashoffset={draw > 0.85 ? 0 : 1} /></>;
      break;
    case "sparkles": {
      h = w * 0.6;
      const s = interpolate(frame, [0, 0.35 * fps, 0.6 * fps], [0, 1.15, 1], { extrapolateRight: "clamp" });
      const tw = 0.8 + 0.2 * Math.sin((frame / fps) * Math.PI * 3);
      const star = (x: number, y: number, r: number) => (
        <g transform={`translate(${x} ${y}) scale(${s * tw})`} key={`${x}${y}`}>
          <path d={`M 0 ${-r} L ${r * 0.22} ${-r * 0.22} L ${r} 0 L ${r * 0.22} ${r * 0.22} L 0 ${r} L ${-r * 0.22} ${r * 0.22} L ${-r} 0 L ${-r * 0.22} ${-r * 0.22} Z`} fill={o.color} />
        </g>
      );
      svg = <>{star(40, 40, 30)}{star(360, 70, 22)}{star(330, 210, 34)}{star(70, 200, 18)}</>;
      break;
    }
    case "burst": {
      h = w * 0.6;
      const len = interpolate(frame, [0, 0.35 * fps], [0, 1], { extrapolateRight: "clamp" });
      const fade = interpolate(frame, [0.5 * fps, 1.1 * fps], [1, 0.35], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
      const rays = Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2;
        const r1 = 120, r2 = 120 + 70 * len;
        return <line key={i} x1={200 + Math.cos(a) * r1 * 1.4} y1={120 + Math.sin(a) * r1 * 0.75} x2={200 + Math.cos(a) * r2 * 1.4} y2={120 + Math.sin(a) * r2 * 0.75} stroke={o.color} strokeWidth={sw} strokeLinecap="round" opacity={fade} />;
      });
      svg = <>{rays}</>;
      break;
    }
  }
  const vbH = o.text === "underline" ? 80 : o.text === "circle" ? 200 : o.text === "arrow" ? 240 : 240;
  return (
    <svg viewBox={`-10 -10 420 ${vbH + 20}`} preserveAspectRatio="none"
      style={{ position: "absolute", left: o.x * width - w / 2, top: o.y * height - h / 2, width: w, height: h, opacity, overflow: "visible", transform: `rotate(${o.rotate}deg)`, filter: "drop-shadow(0 3px 6px rgba(0,0,0,.35))" }}>
      {svg}
    </svg>
  );
}
