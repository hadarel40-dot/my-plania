"use client";
import type { MediaAsset } from "@/lib/editor/types";

/** מדדים לפריים אחד, לבחירת הרגעים היפים בסרטון אווירה */
export interface FrameSample {
  clipId: string;
  /** זמן בתוך קובץ המקור (שניות) */
  t: number;
  /** חדות (שונות של לפלסיאן): פריים מטושטש או רועד מקבל ערך נמוך */
  sharp: number;
  /** בהירות ממוצעת 0..1 */
  bright: number;
  /** עושר צבעים (מדד Hasler-Süsstrunk) */
  color: number;
  /** כמה התמונה השתנתה מהפריים הקודם 0..1 (תנועה; קפיצה גדולה = חיתוך סצנה או רעידה) */
  motion: number;
  /** תמונה קטנה לבחירה עם Claude */
  thumb: string;
}

const W = 96;
const THUMB_W = 256;

function loadVideo(url: string) {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.preload = "auto";
  if (!url.startsWith("blob:")) video.crossOrigin = "anonymous";
  video.src = url;
  return new Promise<HTMLVideoElement>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("הסרטון לא נטען")), 20000);
    video.onloadeddata = () => { clearTimeout(timer); resolve(video); };
    video.onerror = () => { clearTimeout(timer); reject(new Error("הסרטון לא נטען")); };
    video.load();
  });
}

function seek(video: HTMLVideoElement, time: number) {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 3000);
    video.onseeked = () => { clearTimeout(timer); resolve(); };
    video.currentTime = time;
  });
}

/**
 * דוגם פריימים לאורך הקטע [from, to] של קליפ ומחשב לכל אחד מדדי איכות.
 * step: כל כמה שניות דוגמים.
 */
export async function sampleClip(
  asset: MediaAsset, clipId: string, from: number, to: number, step: number,
  onFrame?: () => void,
): Promise<FrameSample[]> {
  const video = await loadVideo(asset.url);
  const h = Math.max(2, Math.round((W * video.videoHeight) / Math.max(1, video.videoWidth)));
  const small = document.createElement("canvas");
  small.width = W; small.height = h;
  const ctx = small.getContext("2d", { willReadFrequently: true })!;
  const thumbCanvas = document.createElement("canvas");
  thumbCanvas.width = THUMB_W;
  thumbCanvas.height = Math.round((THUMB_W * video.videoHeight) / Math.max(1, video.videoWidth));
  const tctx = thumbCanvas.getContext("2d")!;

  const out: FrameSample[] = [];
  let prev: Float32Array | null = null;
  for (let t = from + step / 2; t < to; t += step) {
    await seek(video, t);
    ctx.drawImage(video, 0, 0, W, h);
    const { data } = ctx.getImageData(0, 0, W, h);
    const gray = new Float32Array(W * h);
    let sum = 0, rg = 0, rg2 = 0, yb = 0, yb2 = 0;
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const y = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      gray[p] = y; sum += y;
      const a = r - g, c = 0.5 * (r + g) - b;
      rg += a; rg2 += a * a; yb += c; yb2 += c * c;
    }
    const n = W * h;
    // חדות: שונות הלפלסיאן
    let lap = 0, lap2 = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        const v = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - W] - gray[i + W];
        lap += v; lap2 += v * v;
      }
    }
    const m = (W - 2) * (h - 2);
    const sharp = lap2 / m - (lap / m) ** 2;
    const sdRg = Math.sqrt(Math.max(0, rg2 / n - (rg / n) ** 2));
    const sdYb = Math.sqrt(Math.max(0, yb2 / n - (yb / n) ** 2));
    const color = Math.sqrt(sdRg ** 2 + sdYb ** 2) + 0.3 * Math.sqrt((rg / n) ** 2 + (yb / n) ** 2);
    let motion = 0;
    if (prev) {
      let d = 0;
      for (let i = 0; i < n; i++) d += Math.abs(gray[i] - prev[i]);
      motion = d / n;
    }
    prev = gray;
    tctx.drawImage(video, 0, 0, thumbCanvas.width, thumbCanvas.height);
    out.push({ clipId, t: +t.toFixed(3), sharp, bright: sum / n, color, motion, thumb: thumbCanvas.toDataURL("image/jpeg", 0.6) });
    onFrame?.();
  }
  video.removeAttribute("src");
  video.load();
  return out;
}

export interface Shot {
  id: number;
  clipId: string;
  start: number;
  end: number;
  score: number;
  /** פריים מייצג מאמצע הקטע */
  thumb: string;
}

const zscore = (values: number[]) => {
  const mean = values.reduce((s, v) => s + v, 0) / Math.max(1, values.length);
  const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, values.length)) || 1;
  return (v: number) => (v - mean) / sd;
};

/**
 * הופך את הדגימות לקטעים מועמדים באורך shotLen ומדרג אותם: חד, מואר טוב,
 * צבעוני, עם תנועה עדינה. מעניש טשטוש, חושך/שרוף, רעידות ומעברי סצנה באמצע.
 */
export function rankShots(samples: FrameSample[], clips: { id: string; in: number; out: number }[], shotLen: number, step: number): Shot[] {
  if (!samples.length) return [];
  const zs = zscore(samples.map((s) => Math.log(s.sharp + 1e-6)));
  const zc = zscore(samples.map((s) => s.color));
  const motions = samples.map((s) => s.motion).sort((a, b) => a - b);
  const sharps = samples.map((s) => s.sharp).sort((a, b) => a - b);
  const medianSharp = sharps[Math.floor(sharps.length / 2)] || 1;
  const p90 = motions[Math.floor(motions.length * 0.9)] || 1;
  const sampleScore = (s: FrameSample) => {
    const exposure = s.bright < 0.12 ? -2 : s.bright > 0.92 ? -1.5 : s.bright < 0.2 ? -0.6 : 0;
    // תנועה: קצת תנועה טוב (חי), הרבה מאוד = רעידה או חיתוך
    const m = s.motion / (p90 || 1);
    const motion = m > 1.6 ? -1.2 : m < 0.03 ? -0.2 : 0.2;
    // פריים מטושטש בבירור (פחות משליש מהחדות הרגילה בצילומים) כמעט לא נבחר
    const blur = s.sharp < medianSharp * 0.33 ? -2 : s.sharp < medianSharp * 0.6 ? -0.7 : 0;
    return 0.45 * zs(Math.log(s.sharp + 1e-6)) + 0.3 * zc(s.color) + exposure + motion + blur;
  };

  const shots: Shot[] = [];
  let id = 0;
  for (const clip of clips) {
    const own = samples.filter((s) => s.clipId === clip.id).sort((a, b) => a.t - b.t);
    // צילום קצר מאורך הקטע: הקטע הוא כמעט כל הצילום (בלי השוליים)
    const len = Math.min(shotLen, (clip.out - clip.in) * 0.9);
    if (len < 0.5) continue;
    const per = Math.max(1, Math.min(own.length, Math.round(len / step)));
    for (let i = 0; i + per <= own.length; i++) {
      const win = own.slice(i, i + per);
      const start = Math.max(clip.in, Math.min(win[0].t - step / 2, clip.out - len));
      const end = Math.min(clip.out, start + len);
      if (end - start < len * 0.8) continue;
      // חיתוך סצנה באמצע הקטע (קפיצה חדה בתמונה) פוסל אותו
      const cutInside = win.slice(1).some((s) => s.motion > p90 * 2.2);
      const score = win.reduce((sum, s) => sum + sampleScore(s), 0) / win.length - (cutInside ? 3 : 0);
      shots.push({ id: id++, clipId: clip.id, start, end, score, thumb: win[Math.floor(win.length / 2)].thumb });
    }
  }
  return shots;
}

/**
 * בוחר את הקטעים הטובים עד שמגיעים לאורך היעד, כמו בסרטון אווירה: כמה שניות מכל
 * צילום, מתחלפים. קודם הקטע הכי טוב מכל צילום (כדי שכל הצילומים ייכנסו), ואז
 * עוד קטעים לפי איכות. בלי חפיפה ובלי שני קטעים צמודים מאותו מקום.
 * קטע גרוע (מטושטש, חשוך, רועד) לא נכנס רק כדי למלא זמן: עדיף סרטון קצר יותר.
 */
export function pickShots(shots: Shot[], target: number, clipOrder: string[]): Shot[] {
  const chosen: Shot[] = [];
  let total = 0;
  const sorted = [...shots].sort((a, b) => b.score - a.score);
  const median = sorted[Math.floor(sorted.length / 2)]?.score ?? 0;
  const floor = Math.min(-0.8, median - 1.5);
  const tryAdd = (s: Shot) => {
    const len = s.end - s.start;
    const clash = chosen.some((c) => c.clipId === s.clipId && s.start < c.end + len * 0.75 && c.start < s.end + len * 0.75);
    if (clash) return;
    chosen.push(s);
    total += len;
  };
  // סבב ראשון: הקטע הכי טוב מכל צילום (אם הוא לא גרוע)
  for (const clipId of clipOrder) {
    if (total >= target) break;
    const best = sorted.find((s) => s.clipId === clipId);
    if (best && best.score >= floor) tryAdd(best);
  }
  for (const s of sorted) {
    if (total >= target) break;
    // מתחת לרף נכנסים רק אם עוד אין כמעט כלום (פחות משלוש שניות)
    if (s.score < floor && total >= 3) break;
    if (!chosen.includes(s)) tryAdd(s);
  }
  return orderShots(chosen, clipOrder);
}

export const orderShots = (shots: Shot[], clipOrder: string[]) =>
  [...shots].sort((a, b) => clipOrder.indexOf(a.clipId) - clipOrder.indexOf(b.clipId) || a.start - b.start);
