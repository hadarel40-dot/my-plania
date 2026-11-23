"use client";
import { ALL_FORMATS, BufferTarget, CanvasSink, Conversion, CustomSource, EncodedPacketSink, Input, Mp4OutputFormat, Output, QUALITY_HIGH, type InputVideoTrack } from "mediabunny";
import { db } from "./client";
import { MEDIA_BUCKET } from "@/lib/supabase/env";

const CHUNK = 3 * 1024 * 1024;
const streamUrl = (id: string) => `/api/studio/drive-stream?id=${encodeURIComponent(id)}`;

async function fetchRange(id: string, start: number, end: number) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(streamUrl(id), { headers: { range: `bytes=${start}-${end}` }, cache: "no-store" });
      if (!res.ok) throw new Error(`הדרייב החזיר ${res.status}`);
      return { buf: new Uint8Array(await res.arrayBuffer()), total: Number(res.headers.get("content-range")?.split("/")[1] ?? 0) };
    } catch (e) {
      if (attempt >= 3) throw e;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
}

/** ציון לפריים קטן: חדות (שונות של לפלסיאן), חשיפה (לא כהה ולא שרוף), ואפור לשונות בין פריימים */
function frameStats(c: HTMLCanvasElement | OffscreenCanvas) {
  const ctx = c.getContext("2d") as CanvasRenderingContext2D;
  const { width: w, height: h } = c;
  const d = ctx.getImageData(0, 0, w, h).data;
  const g = new Float32Array(w * h);
  let sum = 0;
  for (let i = 0; i < w * h; i++) { const v = (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) / 255; g[i] = v; sum += v; }
  const mean = sum / (w * h);
  let lsum = 0, lsq = 0, n = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    const l = g[i - 1] + g[i + 1] + g[i - w] + g[i + w] - 4 * g[i];
    lsum += l; lsq += l * l; n++;
  }
  const sharp = lsq / n - (lsum / n) ** 2;
  return { g, mean, sharp };
}

/**
 * הרגע הכי טוב בסרטון: בודקים פריימי מפתח לאורך כל הסרטון (מהדרייב יורדים רק הם),
 * ונותנים ציון: חד, מואר טוב, עם קצת תנועה אבל בלי רעידות, ולא בשנייה הראשונה או האחרונה (שם הטלפון זז).
 * מחזיר זמן התחלה שנופל על פריים מפתח, כך שגם ההמרה זולה יותר.
 */
async function bestMoment(track: InputVideoTrack, duration: number, seconds: number) {
  const latest = duration - seconds - 0.3;
  if (latest <= 0.6) return Math.max(0, (duration - seconds) / 2);
  const packets = new EncodedPacketSink(track);
  const want = Array.from({ length: 9 }, (_, i) => 0.6 + ((latest - 0.6) * i) / 8);
  const keys = [...new Set((await Promise.all(want.map((t) => packets.getKeyPacket(t).catch(() => null)))).flatMap((p) => (p ? [+p.timestamp.toFixed(3)] : [])))].sort((a, b) => a - b);
  if (keys.length < 2) return Math.max(0, (duration - seconds) / 2);
  const sink = new CanvasSink(track, { width: 90, height: 160, fit: "cover", poolSize: 0 });
  const stats: { t: number; mean: number; sharp: number; g: Float32Array }[] = [];
  for await (const wc of sink.canvasesAtTimestamps(keys)) if (wc) stats.push({ t: wc.timestamp, ...frameStats(wc.canvas) });
  if (!stats.length) return Math.max(0, (duration - seconds) / 2);
  const maxSharp = Math.max(...stats.map((x) => x.sharp)) || 1;
  const scored = stats.map((x, i) => {
    const prev = stats[i - 1] ?? stats[i + 1];
    let diff = 0;
    if (prev && prev !== x) { for (let k = 0; k < x.g.length; k += 3) diff += Math.abs(x.g[k] - prev.g[k]); diff /= x.g.length / 3; }
    const exposure = Math.max(0, 1 - Math.abs(x.mean - 0.5) * 2.2);
    const motion = diff < 0.02 ? 0.5 : diff < 0.18 ? 1 : 0.3;
    return { t: x.t, score: (x.sharp / maxSharp) * 0.5 + exposure * 0.3 + motion * 0.2 };
  }).filter((x) => x.t <= latest + 0.01);
  const best = scored.sort((a, b) => b.score - a.score)[0];
  return best ? Math.max(0, best.t) : Math.max(0, (duration - seconds) / 2);
}

/**
 * קטע קצר מסרטון בדרייב, כקובץ קל: רק השניות שהריל צריך, 1080 פיקסלים, H.264, בצבעים רגילים
 * (סרטון אייפון הוא 4K ו-HDR, כבד מדי לנגינה ונראה דהוי בדפדפנים). הכל קורה בדפדפן:
 * מהדרייב יורדים רק הבתים של הקטע, לא כל הסרטון.
 */
export async function driveClip(id: string, opts: { from?: number; seconds?: number; onProgress?: (p: number) => void } = {}) {
  let size = 0;
  const source = new CustomSource({
    getSize: async () => { const r = await fetchRange(id, 0, 0); size = r.total; return size; },
    read: async (start, end) => {
      // end לא כולל. מביאים בחתיכות של עד 3MB (מגבלת השרת)
      const out = new Uint8Array(end - start);
      for (let p = start; p < end; p += CHUNK) {
        const { buf } = await fetchRange(id, p, Math.min(end, p + CHUNK) - 1);
        out.set(buf.subarray(0, Math.min(buf.length, end - p)), p - start);
      }
      return out;
    },
    prefetchProfile: "network",
    maxCacheSize: 48 * 1024 * 1024,
  });
  const input = new Input({ source, formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error("אין וידאו בקובץ");
    const duration = await input.computeDuration();
    const seconds = Math.min(opts.seconds ?? 3, duration);
    // בלי זמן מוגדר: מחפשים את הרגע הכי טוב בסרטון (ואם הבדיקה נכשלת, את האמצע)
    const picked = opts.from ?? await bestMoment(track, duration, seconds).catch(() => (duration - seconds) / 2);
    const from = Math.max(0, Math.min(picked, duration - seconds));
    // הצד הארוך 1920, הקצר 1080 (או פחות, אם המקור קטן יותר)
    const dw = track.displayWidth, dh = track.displayHeight;
    const scale = Math.min(1, 1920 / Math.max(dw, dh), 1080 / Math.min(dw, dh));
    const w = Math.round((dw * scale) / 2) * 2, h = Math.round((dh * scale) / 2) * 2;
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d")!;
    const target = new BufferTarget();
    const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target });
    const conversion = await Conversion.init({
      input, output,
      trim: { start: from, end: from + seconds },
      video: {
        codec: "avc", quality: QUALITY_HIGH, frameRate: 30, allowTransformationMetadata: false, keyFrameInterval: 1,
        // ציור על קנבס רגיל: הדפדפן ממיר HDR לצבעים רגילים, ומסובב לפי הסרטון
        process: (sample) => { sample.drawWithFit(ctx, { fit: "cover" }); return canvas; },
        processedWidth: w, processedHeight: h,
      },
      audio: { discard: true },
    });
    if (!conversion.isValid) throw new Error(`הסרטון לא הומר (${conversion.discardedTracks.map((t) => t.reason).join(", ")})`);
    if (opts.onProgress) conversion.onProgress = (p) => opts.onProgress!(p);
    await conversion.execute();
    return { blob: new Blob([target.buffer!], { type: "video/mp4" }), w, h, seconds: +seconds.toFixed(2), from: +from.toFixed(2), sourceSeconds: duration };
  } finally {
    input.dispose();
  }
}

/** ממיר ומעלה לספרייה. מחזיר קטע מוכן לריל */
export async function driveClipToLibrary(id: string, opts: { from?: number; seconds?: number; onProgress?: (p: number) => void } = {}) {
  const c = await driveClip(id, opts);
  const { data: u } = await db().auth.getUser();
  if (!u.user) throw new Error("צריך להתחבר מחדש");
  const path = `${u.user.id}/studio/drive/${id}-${Math.round(c.from * 10)}-${Date.now()}.mp4`;
  const { error } = await db().storage.from(MEDIA_BUCKET).upload(path, c.blob, { contentType: "video/mp4" });
  if (error) throw new Error(error.message);
  return { path, w: c.w, h: c.h, seconds: c.seconds };
}
