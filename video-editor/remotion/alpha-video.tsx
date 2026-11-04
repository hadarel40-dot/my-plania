import { useCallback, useRef } from "react";

/**
 * סרטון של אדם בלי רקע. הקובץ "כפול": בחצי השמאלי הצבע ובחצי הימני מסכת שקיפות
 * בשחור-לבן (H.264 רגיל, שעובד בכל טלפון, גם באייפון שלא מקודד שקיפות). כאן מרכיבים
 * את שניהם בכל פריים לקנבס שקוף: אותו קוד בנגן ובייצוא.
 *
 * במצב html5 (דפדפן בלי WebCodecs) אין גישה לפריימים: מציגים רק את החצי של הצבע,
 * בלי שקיפות, כדי שלפחות המיקום והתזמון יהיו נכונים.
 */
export function AlphaVideo({ Video, mode, common, style }: {
  Video: React.ComponentType<Record<string, unknown>>;
  mode: "html5" | "media";
  common: Record<string, unknown>;
  /** המיקום והגודל של התמונה (חצי הקובץ) */
  style: React.CSSProperties;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskRef = useRef<HTMLCanvasElement | null>(null);

  const draw = useCallback((frame: CanvasImageSource) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const fw = (frame as { width: number }).width, fh = (frame as { height: number }).height;
    if (!fw || !fh) return;
    const half = Math.floor(fw / 2);
    if (canvas.width !== half || canvas.height !== fh) { canvas.width = half; canvas.height = fh; }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // המסכה בחצי רזולוציה (מהיר), ואז מוגדלת בעדינות
    const mw = Math.max(1, Math.round(half / 2)), mh = Math.max(1, Math.round(fh / 2));
    const mask = (maskRef.current ??= document.createElement("canvas"));
    if (mask.width !== mw || mask.height !== mh) { mask.width = mw; mask.height = mh; }
    const mctx = mask.getContext("2d", { willReadFrequently: true });
    if (!mctx) return;
    mctx.clearRect(0, 0, mw, mh);
    mctx.drawImage(frame, half, 0, half, fh, 0, 0, mw, mh);
    const d = mctx.getImageData(0, 0, mw, mh);
    const px = d.data;
    for (let i = 0; i < px.length; i += 4) px[i + 3] = px[i];
    mctx.putImageData(d, 0, 0);
    ctx.globalCompositeOperation = "copy";
    ctx.drawImage(frame, 0, 0, half, fh, 0, 0, half, fh);
    ctx.globalCompositeOperation = "destination-in";
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(mask, 0, 0, half, fh);
    ctx.globalCompositeOperation = "source-over";
  }, []);

  if (mode === "html5") {
    return (
      <div style={{ ...style, overflow: "hidden" }}>
        <Video {...common} style={{ position: "absolute", left: 0, top: 0, width: "200%", height: "100%", maxWidth: "none", objectFit: "fill" }} />
      </div>
    );
  }
  return (
    <>
      <Video {...common} headless onVideoFrame={draw} />
      <canvas ref={canvasRef} style={{ ...style, objectFit: "fill" }} />
    </>
  );
}
