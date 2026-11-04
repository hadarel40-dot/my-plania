"use client";
import type { MediaAsset, Timeline } from "@/lib/editor/types";
import { layoutClips, videoEnd } from "@/lib/editor/timeline-utils";
import { fontFamily } from "@/lib/editor/fonts";
import { loadVideo, seekVideo } from "@/lib/video/analyze";
import { usePreviewProxies } from "@/lib/media/preview-proxy";

/**
 * תמונת שער לרילס: העורך בוחר לבד את הפריים הכי יפה מהחלק הראשון של הסרטון
 * (חד, מואר טוב, צבעוני), ומוסיף עליו את משפט הפתיחה בגדול. נשמרת לגלריה ליד
 * הסרטון, ובאינסטגרם בוחרים אותה ב"עריכת שער" > "הוספה מהגלריה".
 */
export async function makeCover(timeline: Timeline, assets: Record<string, MediaAsset>): Promise<Blob | null> {
  const layout = layoutClips(timeline.clips).filter(({ clip }) => assets[clip.assetId]?.kind !== "audio");
  if (!layout.length) return null;
  const end = videoEnd(timeline.clips);
  const W = 1080, H = 1920;

  // מועמדים: 8 רגעים לאורך 70% הראשונים של הסרטון
  const candidates = Array.from({ length: 8 }, (_, i) => ((i + 0.5) / 8) * end * 0.7).flatMap((t) => {
    const hit = layout.find((l) => t >= l.start && t < l.end);
    return hit ? [{ clip: hit.clip, src: hit.clip.in + (t - hit.start) * (hit.clip.speed ?? 1) }] : [];
  });
  const proxies = usePreviewProxies.getState().urls;
  const videos = new Map<string, HTMLVideoElement>();
  const videoFor = async (assetId: string) => {
    if (!videos.has(assetId)) videos.set(assetId, await loadVideo(proxies[assetId] ?? assets[assetId].url));
    return videos.get(assetId)!;
  };

  try {
    const probe = document.createElement("canvas");
    probe.width = 72; probe.height = 128;
    const pctx = probe.getContext("2d", { willReadFrequently: true })!;
    let best: { clip: (typeof candidates)[number]["clip"]; src: number; score: number } | null = null;
    for (const c of candidates) {
      try {
        const video = await videoFor(c.clip.assetId);
        await seekVideo(video, c.src);
        pctx.drawImage(video, 0, 0, probe.width, probe.height);
        const score = frameScore(pctx.getImageData(0, 0, probe.width, probe.height));
        if (!best || score > best.score) best = { ...c, score };
      } catch { /* מדלגים על רגע שלא נטען */ }
    }
    if (!best) return null;

    // הפריים שנבחר, באיכות מלאה מהקובץ המקורי
    const full = await loadVideo(assets[best.clip.assetId].url);
    videos.set("__full", full);
    await seekVideo(full, best.src);
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    const vw = full.videoWidth || W, vh = full.videoHeight || H;
    const scale = Math.max(W / vw, H / vh) * (best.clip.look.zoom || 1);
    const dw = vw * scale, dh = vh * scale;
    const fx = best.clip.focusX ?? 0.5, fy = best.clip.focusY ?? 0.5;
    const left = Math.min(0, Math.max(W - dw, W / 2 - fx * dw));
    const top = Math.min(0, Math.max(H - dh, H / 2 - fy * dh));
    if (best.clip.look.filter && best.clip.look.filter !== "none") ctx.filter = best.clip.look.filter;
    ctx.drawImage(full, left, top, dw, dh);
    ctx.filter = "none";

    const hook = timeline.overlays.find((o) => o.hook) ?? null;
    const text = (hook?.text ?? "").trim();
    if (text) {
      // הצללה עדינה למעלה, כדי שהטקסט ייקרא על כל רקע
      const grad = ctx.createLinearGradient(0, 0, 0, H * 0.45);
      grad.addColorStop(0, "rgba(0,0,0,0.55)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H * 0.45);
      const family = fontFamily(hook?.font ?? timeline.captionStyle?.font ?? "secular");
      const size = text.length > 30 ? 84 : 104;
      await document.fonts.load(`900 ${size}px ${family}`).catch(() => undefined);
      ctx.font = `900 ${size}px ${family}`;
      ctx.direction = "rtl";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      const lines = wrap(ctx, text, W * 0.84);
      const y0 = H * 0.2 - ((lines.length - 1) * size * 1.15) / 2;
      lines.forEach((line, i) => {
        const y = y0 + i * size * 1.15;
        ctx.lineWidth = size * 0.16;
        ctx.strokeStyle = "rgba(0,0,0,0.85)";
        ctx.strokeText(line, W / 2, y);
        // תמיד לבן עם קו מתאר: נקרא על כל תמונה
        ctx.fillStyle = "#ffffff";
        ctx.fillText(line, W / 2, y);
      });
    }
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  } finally {
    for (const v of videos.values()) { v.removeAttribute("src"); v.load(); }
  }
}

/** ציון לפריים: חדות, בהירות קרובה לאמצע, ועושר צבעים */
function frameScore({ data, width, height }: ImageData) {
  const gray = new Float32Array(width * height);
  let sum = 0, rg = 0, rg2 = 0, yb = 0, yb2 = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const y = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    gray[p] = y; sum += y;
    const a = r - g, c = 0.5 * (r + g) - b;
    rg += a; rg2 += a * a; yb += c; yb2 += c * c;
  }
  const n = width * height;
  let lap2 = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const v = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - width] - gray[i + width];
      lap2 += v * v;
    }
  }
  const sharp = Math.log(lap2 / n + 1e-6);
  const bright = sum / n;
  const color = Math.sqrt(Math.max(0, rg2 / n - (rg / n) ** 2) + Math.max(0, yb2 / n - (yb / n) ** 2)) / 100;
  return sharp + color * 2 - Math.abs(bright - 0.55) * 6;
}

/** שבירת טקסט לשורות לפי רוחב */
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > max && line) { lines.push(line); line = w; } else line = next;
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}
