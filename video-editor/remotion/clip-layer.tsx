import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { Adjust, Clip, ClipEffect, Look, MediaAsset, TransitionType } from "@/lib/editor/types";

export interface ClipLayerProps {
  clip: Clip;
  asset: MediaAsset;
  look: Look;
  /** אורך הקליפ בציר הזמן (פריימים) */
  duration: number;
  /** המעבר בתחילת הקליפ. במעברים חופפים הקליפ נכנס מעל הקודם, שעדיין מתנגן מתחתיו */
  intro: { type: TransitionType; frames: number } | null;
  Video: React.ComponentType<Record<string, unknown>>;
  mode: "html5" | "media";
  fps: number;
}

/**
 * קליפ אחד בקומפוזיציה, עם כל מה שמשפיע עליו: מהירות, תנועת מצלמה, התאמות צבע,
 * רקע מטושטש, ומעברים. הכל מחושב מהפריים, ולכן זהה בנגן ובייצוא.
 */
export function ClipLayer({ clip, asset, look, duration, intro, Video, mode, fps }: ClipLayerProps) {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const speed = clip.speed ?? 1;

  // מעבר כניסה (בתחילת הקליפ)
  let inStyle: React.CSSProperties = {};
  let flash = 0;
  if (intro && frame < intro.frames) {
    const p = frame / intro.frames;
    ({ style: inStyle, flash } = enterStyle(intro.type, p, frame));
  }

  const motion = effectTransform(clip.effect ?? "none", frame, duration, fps);
  const filter = [look.filter !== "none" ? look.filter : "", adjustFilter(clip.adjust), inStyle.filter ?? ""].filter(Boolean).join(" ") || undefined;
  const box = coverBox(asset, clip, W, H);
  const blurFill = clip.fill === "blur" && !!asset.width && Math.abs(asset.width / asset.height - W / H) > 0.05;
  const common = {
    src: asset.url,
    trimBefore: Math.round(clip.in * fps),
    playbackRate: speed,
    ...(mode === "html5" ? { pauseWhenBuffering: true } : { objectFit: "fill" as const }),
  };

  return (
    <AbsoluteFill style={{ overflow: "hidden", ...outerStyle(intro, frame) }}>
      {blurFill && (
        <AbsoluteFill style={{ transform: "scale(1.15)" }}>
          <Video {...common} volume={0} muted style={{ ...coverBoxFor(asset, W, H, 0.5, 0.5, "cover"), filter: `blur(${Math.round(W / 22)}px) brightness(0.65)` }} />
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{ transform: `${motion} scale(${look.zoom}) scaleX(${look.flip ? -1 : 1}) ${inStyle.transform ?? ""}`, opacity: inStyle.opacity }}>
        <Video {...common} volume={clip.volume ?? 1}
          style={{ ...(blurFill ? coverBoxFor(asset, W, H, 0.5, 0.5, "contain") : box), filter }} />
      </AbsoluteFill>
      {flash > 0 && <AbsoluteFill style={{ backgroundColor: "white", opacity: flash }} />}
    </AbsoluteFill>
  );
}

/**
 * מעבר חופף: כל הקליפ (כולל הרקע המטושטש) נכנס מעל הקודם. החלקה מימין, זום מתוך
 * המרכז, טשטוש שמתבהר, או המסה רגילה.
 */
function outerStyle(intro: ClipLayerProps["intro"], frame: number): React.CSSProperties {
  if (!intro || frame >= intro.frames) return {};
  const p = frame / intro.frames;
  const ease = 1 - Math.pow(1 - p, 2);
  switch (intro.type) {
    case "fade": return { opacity: ease };
    case "slide": return { transform: `translateX(${(1 - ease) * 100}%)` };
    case "zoom": return { transform: `scale(${0.6 + 0.4 * ease})`, opacity: ease };
    case "blur": return { filter: `blur(${(1 - ease) * 24}px)`, opacity: ease };
    default: return {};
  }
}

/** כניסה של קליפ: p עולה מ-0 ל-1. flash: עוצמת ההבזק הלבן */
function enterStyle(type: TransitionType, p: number, frame: number): { style: React.CSSProperties; flash: number } {
  const out = 1 - p;
  switch (type) {
    case "flash": return { style: {}, flash: out * out };
    case "punch": return { style: { transform: `scale(${1 + 0.25 * out * out})` }, flash: 0 };
    case "whip": return { style: { transform: `translateX(${out * out * 40}%)`, filter: `blur(${out * 18}px)` }, flash: 0 };
    case "glitch": {
      // קפיצות קטנות ושינוי גוון לסירוגין, דטרמיניסטי לפי הפריים
      const jitter = ((frame * 37) % 11) - 5;
      return { style: { transform: `translate(${jitter * out * 1.2}%, ${((frame * 13) % 5 - 2) * out}%)`, filter: frame % 2 ? `hue-rotate(${90 * out}deg) saturate(${1 + out * 2})` : "" }, flash: 0 };
    }
    default: return { style: {}, flash: 0 };
  }
}

/** תנועת מצלמה לאורך כל הקליפ */
function effectTransform(effect: ClipEffect, frame: number, duration: number, fps: number): string {
  const p = Math.min(1, Math.max(0, frame / Math.max(1, duration)));
  switch (effect) {
    case "zoom-in": return `scale(${interpolate(p, [0, 1], [1, 1.18])})`;
    case "zoom-out": return `scale(${interpolate(p, [0, 1], [1.18, 1])})`;
    case "pan-left": return `scale(1.15) translateX(${interpolate(p, [0, 1], [5, -5])}%)`;
    case "pan-right": return `scale(1.15) translateX(${interpolate(p, [0, 1], [-5, 5])}%)`;
    case "shake": {
      const t = frame / fps;
      return `scale(1.06) translate(${Math.sin(t * 31) * 0.9 + Math.sin(t * 17) * 0.6}%, ${Math.cos(t * 27) * 0.8}%)`;
    }
    case "pulse": {
      // דופק כל חצי שנייה (בערך הקצב של רוב השירים)
      const beat = (frame / fps) % 0.5;
      return `scale(${1 + 0.06 * Math.exp(-beat * 12)})`;
    }
    default: return "";
  }
}

/** בהירות, ניגודיות, רוויה וחום כפילטר CSS */
export function adjustFilter(a?: Adjust): string {
  if (!a) return "";
  const parts: string[] = [];
  if (a.brightness) parts.push(`brightness(${(1 + a.brightness * 0.5).toFixed(2)})`);
  if (a.contrast) parts.push(`contrast(${(1 + a.contrast * 0.5).toFixed(2)})`);
  if (a.saturation) parts.push(`saturate(${Math.max(0, 1 + a.saturation).toFixed(2)})`);
  if (a.warmth > 0) parts.push(`sepia(${(a.warmth * 0.35).toFixed(2)}) hue-rotate(${(-a.warmth * 8).toFixed(1)}deg)`);
  if (a.warmth < 0) parts.push(`hue-rotate(${(-a.warmth * 18).toFixed(1)}deg) saturate(${(1 + a.warmth * 0.15).toFixed(2)})`);
  return parts.join(" ");
}

/**
 * ממלא את המסגרת בסרטון (כמו object-fit: cover), עם נקודת מיקוד: כשהסרטון רחב
 * מהמסך, focusX קובע איזה חלק ממנו נשאר בתמונה. גודל ומיקום מפורשים עובדים זהה
 * בנגן ובייצוא (רכיב הייצוא לא תומך ב-object-position).
 */
export function coverBox(asset: MediaAsset, clip: { focusX?: number; focusY?: number }, W: number, H: number): React.CSSProperties {
  return coverBoxFor(asset, W, H, clip.focusX ?? 0.5, clip.focusY ?? 0.5, "cover");
}

function coverBoxFor(asset: MediaAsset, W: number, H: number, fx: number, fy: number, fit: "cover" | "contain"): React.CSSProperties {
  if (!asset.width || !asset.height) return { width: "100%", height: "100%", objectFit: fit };
  const scale = (fit === "cover" ? Math.max : Math.min)(W / asset.width, H / asset.height);
  const w = asset.width * scale;
  const h = asset.height * scale;
  // הפנים במרכז המסגרת, אבל בלי לחשוף שוליים ריקים
  const left = fit === "contain" ? (W - w) / 2 : Math.min(0, Math.max(W - w, W / 2 - fx * w));
  const top = fit === "contain" ? (H - h) / 2 : Math.min(0, Math.max(H - h, H / 2 - fy * h));
  return { position: "absolute", left, top, width: w, height: h, maxWidth: "none", objectFit: "fill" };
}
