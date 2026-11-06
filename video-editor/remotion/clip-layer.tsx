import { AbsoluteFill, Freeze, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { AlphaVideo } from "./alpha-video";
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
  /** כשהאדם בלי רקע: מה מופיע מאחוריו */
  backdrop?: MediaAsset | null;
  /** הקול המשופר (באותם זמנים כמו הסרטון): מתנגן במקום הקול של הסרטון */
  voice?: MediaAsset | null;
  Audio?: React.ComponentType<Record<string, unknown>>;
}

/**
 * קליפ אחד בקומפוזיציה, עם כל מה שמשפיע עליו: מהירות, תנועת מצלמה, התאמות צבע,
 * רקע מטושטש, ומעברים. הכל מחושב מהפריים, ולכן זהה בנגן ובייצוא.
 */
export function ClipLayer({ clip, asset, look, duration, intro, Video, mode, fps, backdrop, voice, Audio }: ClipLayerProps) {
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
  const alpha = !!asset.alphaPacked;
  const useVoice = !!(voice && Audio && !clip.freeze);
  // אדם בלי רקע: הוא ממוקם ומוגדל בתוך המסך, ומאחוריו הרקע שנבחר
  const cut = clip.cutout ?? { x: 0.5, y: 0.5, scale: 1 };
  const pw = W * cut.scale, ph = H * cut.scale;
  const box = alpha ? coverBoxFor(asset, pw, ph, clip.focusX ?? 0.5, clip.focusY ?? 0.5, "cover") : coverBox(asset, clip, W, H);
  const blurFill = !alpha && clip.fill === "blur" && !!asset.width && Math.abs(asset.width / asset.height - W / H) > 0.05;
  const common = {
    src: asset.url,
    trimBefore: Math.round(clip.in * fps),
    playbackRate: speed,
    ...(mode === "html5" ? { pauseWhenBuffering: true } : { objectFit: "fill" as const }),
  };

  return (
    <AbsoluteFill style={{ overflow: "hidden", ...outerStyle(intro, frame) }}>
      {alpha && backdrop && (
        <Video src={backdrop.url} volume={0} muted loop style={coverBoxFor(backdrop, W, H, 0.5, 0.5, "cover")}
          {...(mode === "html5" ? { pauseWhenBuffering: true } : { objectFit: "fill" as const })} />
      )}
      {blurFill && (
        // הרקע המטושטש מצויר ברבע גודל ואז מוגדל: נראה אותו דבר, אבל חישוב הטשטוש
        // קל פי 16 (בטלפון זה ההבדל בין נגינה חלקה לקטועה)
        <div style={{ position: "absolute", left: -0.075 * W, top: -0.075 * H, width: W / 4, height: H / 4, overflow: "hidden", transform: `scale(${4 * 1.15})`, transformOrigin: "0 0" }}>
          <Video {...common} volume={0} muted style={{ ...coverBoxFor(asset, W / 4, H / 4, 0.5, 0.5, "cover"), filter: `blur(${Math.round(W / 88)}px) brightness(0.65)` }} />
        </div>
      )}
      <AbsoluteFill style={{ transform: `${motion} scale(${look.zoom}) scaleX(${look.flip ? -1 : 1}) ${inStyle.transform ?? ""}`, opacity: inStyle.opacity }}>
        {alpha ? (
          <div style={{ position: "absolute", left: cut.x * W - pw / 2, top: cut.y * H - ph / 2, width: pw, height: ph, filter }}>
            {clip.freeze ? (
              <Freeze frame={0}><AlphaVideo Video={Video} mode={mode} common={{ ...common, volume: 0, muted: true }} style={box} /></Freeze>
            ) : (
              <AlphaVideo Video={Video} mode={mode} common={{ ...common, volume: useVoice ? 0 : clip.volume ?? 1, muted: useVoice }} style={box} />
            )}
          </div>
        ) : clip.freeze ? (
          // הקפאת תמונה: הפריים הראשון של הקטע נשאר על המסך, בלי סאונד
          <Freeze frame={0}>
            <Video {...common} volume={0} muted style={{ ...(blurFill ? coverBoxFor(asset, W, H, 0.5, 0.5, "contain") : box), filter }} />
          </Freeze>
        ) : (
          <Video {...common} volume={useVoice ? 0 : clip.volume ?? 1} muted={useVoice}
            style={{ ...(blurFill ? coverBoxFor(asset, W, H, 0.5, 0.5, "contain") : box), filter }} />
        )}
      </AbsoluteFill>
      {useVoice && Audio && <Audio src={voice!.url} trimBefore={Math.round(clip.in * fps)} playbackRate={speed} volume={clip.volume ?? 1} />}
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

/**
 * שכבת וידאו מעל הסרטון הראשי. הכל בנוי ממיקום וחיתוך (overflow) ולא ממסכות CSS,
 * כדי שייראה זהה בנגן ובייצוא.
 *  pip: חלון שמרכזו ב-x,y ורוחבו scale מהמסך, בצורת מלבן / מעוגל / עיגול, עם מסגרת לבנה.
 *  clone-left / clone-right: חצי מסך מהצילום השני, בלי להזיז את התמונה (אפקט תאומים).
 *  split-right / split-bottom: הסרטון השני ממלא חצי מסך (מסך מפוצל).
 */
export function VideoLayerView({ layer, asset, Video, mode, fps }: {
  layer: import("@/lib/editor/types").VideoLayer; asset: MediaAsset;
  Video: React.ComponentType<Record<string, unknown>>; mode: "html5" | "media"; fps: number;
}) {
  const { width: W, height: H } = useVideoConfig();
  const frame = useCurrentFrame();
  const common = {
    src: asset.url,
    trimBefore: Math.round(layer.in * fps),
    volume: layer.volume,
    muted: layer.volume === 0,
    ...(mode === "html5" ? { pauseWhenBuffering: true } : { objectFit: "fill" as const }),
  };
  const flip = layer.flip ? "scaleX(-1)" : undefined;
  const full = coverBoxFor(asset, W, H, 0.5, 0.5, "cover");

  if (asset.alphaPacked) {
    // אדם בלי רקע מעל הסרטון: מרכז ב-x,y, וגודל scale מהמסך (1 = כל המסך)
    const pw = W * layer.scale, ph = H * layer.scale;
    return (
      <div style={{ position: "absolute", left: layer.x * W - pw / 2, top: layer.y * H - ph / 2, width: pw, height: ph, opacity: layer.opacity, transform: flip }}>
        <AlphaVideo Video={Video} mode={mode} common={common} style={coverBoxFor(asset, pw, ph, 0.5, 0.5, "cover")} />
      </div>
    );
  }

  if (layer.layout === "clone-left" || layer.layout === "clone-right") {
    const left = layer.layout === "clone-left";
    return (
      <div style={{ position: "absolute", top: 0, height: H, width: W / 2, left: left ? 0 : W / 2, overflow: "hidden", opacity: layer.opacity }}>
        <div style={{ position: "absolute", top: 0, left: left ? 0 : -W / 2, width: W, height: H, transform: flip }}>
          <Video {...common} style={full} />
        </div>
      </div>
    );
  }
  if (layer.layout === "full" || layer.layout === "split-top") {
    // צילום מסך / תמונה / סרטון נוסף: על כל המסך או בחצי העליון. תמונה נשארת שלמה (בלי
    // חיתוך), על רקע מטושטש של עצמה, עם זום איטי עדין כדי שלא תרגיש "תקועה"
    const top = layer.layout === "split-top";
    const bw = W, bh = top ? H / 2 : H;
    const frames = Math.max(1, (layer.out - layer.in) * fps);
    const zoom = asset.still ? 1 + 0.05 * Math.min(1, frame / frames) : 1;
    const enter = Math.min(1, frame / Math.max(1, fps * 0.2));
    const fitBox = asset.still ? coverBoxFor(asset, bw * 0.94, bh * 0.94, 0.5, 0.5, "contain") : coverBoxFor(asset, bw, bh, 0.5, 0.5, "cover");
    return (
      <div style={{ position: "absolute", left: 0, top: 0, width: bw, height: bh, overflow: "hidden", opacity: layer.opacity * enter,
        borderBottom: top ? `${Math.round(W / 270)}px solid white` : undefined, backgroundColor: "#111" }}>
        {asset.still && (
          <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
            <Video {...common} volume={0} muted style={{ ...coverBoxFor(asset, bw, bh, 0.5, 0.5, "cover"), filter: `blur(${Math.round(W / 40)}px) brightness(0.55)` }} />
          </div>
        )}
        <div style={{ position: "absolute", left: asset.still ? bw * 0.03 : 0, top: asset.still ? bh * 0.03 : 0, width: asset.still ? bw * 0.94 : bw, height: asset.still ? bh * 0.94 : bh,
          transform: `${flip ?? ""} scale(${zoom * (0.92 + 0.08 * enter)})` }}>
          <Video {...common} style={{ ...fitBox, borderRadius: asset.still ? W / 60 : 0, boxShadow: asset.still ? `0 ${W / 80}px ${W / 25}px rgba(0,0,0,.5)` : undefined }} />
        </div>
      </div>
    );
  }
  if (layer.layout === "split-right" || layer.layout === "split-bottom") {
    const side = layer.layout === "split-right";
    const bw = side ? W / 2 : W, bh = side ? H : H / 2;
    return (
      <div style={{ position: "absolute", left: side ? W / 2 : 0, top: side ? 0 : H / 2, width: bw, height: bh, overflow: "hidden", opacity: layer.opacity,
        borderInlineStart: side ? `${Math.round(W / 270)}px solid white` : undefined, borderTop: side ? undefined : `${Math.round(W / 270)}px solid white` }}>
        <div style={{ position: "absolute", inset: 0, transform: flip }}>
          <Video {...common} style={coverBoxFor(asset, bw, bh, 0.5, 0.5, "cover")} />
        </div>
      </div>
    );
  }
  // חלון קטן
  const bw = Math.round(W * layer.scale);
  const ratio = layer.shape === "circle" ? 1 : asset.width && asset.height ? asset.height / asset.width : 16 / 9;
  const bh = Math.round(bw * ratio);
  const radius = layer.shape === "circle" ? bw / 2 : layer.shape === "rounded" ? W / 30 : 0;
  const border = layer.border ? Math.max(3, Math.round(W / 180)) : 0;
  return (
    <div style={{ position: "absolute", left: layer.x * W - bw / 2, top: layer.y * H - bh / 2, width: bw, height: bh, borderRadius: radius,
      overflow: "hidden", opacity: layer.opacity, boxShadow: `0 ${W / 90}px ${W / 30}px rgba(0,0,0,.45)`, border: border ? `${border}px solid white` : undefined, boxSizing: "border-box" }}>
      <div style={{ position: "absolute", inset: 0, transform: flip }}>
        <Video {...common} style={coverBoxFor(asset, bw - border * 2, bh - border * 2, 0.5, 0.5, "cover")} />
      </div>
    </div>
  );
}
