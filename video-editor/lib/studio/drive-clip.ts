"use client";
import { ALL_FORMATS, BufferTarget, Conversion, CustomSource, Input, Mp4OutputFormat, Output, QUALITY_HIGH } from "mediabunny";
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
    const from = Math.max(0, Math.min(opts.from ?? (duration - seconds) / 2, duration - seconds));
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
