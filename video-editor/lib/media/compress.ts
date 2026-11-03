"use client";
import { errorText, logEvent } from "@/lib/telemetry";

/**
 * בחשבון החינמי של Supabase אפשר להעלות קובץ של עד 50MB, וסרטון מהאייפון בדרך כלל
 * גדול בהרבה. לכן סרטון גדול מכווצים לפני ההעלאה בתוך הדפדפן: H.264 ברזולוציה של
 * עד 1080p, בקצב שנכנס במגבלה. קובץ שכבר קטן מספיק עולה כמו שהוא (פחות שלבים
 * שיכולים להיכשל בטלפון).
 */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const TARGET_BYTES = 45 * 1024 * 1024; // מרווח ביטחון מתחת ל-50MB
const AUDIO_BPS = 192_000; // הערכה לפס הקול (בדרך כלל AAC שמועתק כמו שהוא)
const MIN_VIDEO_BPS = 600_000; // מתחת לזה האיכות כבר לא שווה
const STALL_MS = 30_000; // בלי התקדמות כל הזמן הזה: הכיווץ נתקע

export const mb = (bytes: number) => Math.round(bytes / 1024 / 1024);

/** onProgress מקבל 0..1 */
export async function prepareVideoForUpload(file: File, onProgress?: (p: number) => void): Promise<File> {
  if (file.size <= TARGET_BYTES) return file;
  const started = Date.now();
  try {
    const result = await compress(file, onProgress);
    logEvent("compress_done", { from: file.size, to: result.size, ms: Date.now() - started });
    return result;
  } catch (e) {
    logEvent("compress_failed", { size: file.size, type: file.type, ms: Date.now() - started, error: errorText(e) });
    if (e instanceof TooLarge) throw e;
    throw new Error(`הסרטון גדול מדי (${mb(file.size)}MB, המקסימום 50MB) והטלפון לא הצליח לכווץ אותו. אפשר לקצר אותו בגלריה ולנסות שוב.`);
  }
}

async function compress(file: File, onProgress?: (p: number) => void): Promise<File> {
  const { Input, Output, Conversion, BlobSource, BufferTarget, Mp4OutputFormat, ALL_FORMATS } = await import("mediabunny");
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error("no video track");
    const duration = await input.computeDuration();
    const shortSide = Math.min(track.displayWidth, track.displayHeight);
    logEvent("compress_start", {
      size: file.size, codec: track.codec, w: track.displayWidth, h: track.displayHeight, duration,
      webcodecs: typeof VideoEncoder !== "undefined" && typeof VideoDecoder !== "undefined",
    });

    const videoBudget = (TARGET_BYTES * 8) / duration - AUDIO_BPS;
    if (videoBudget < MIN_VIDEO_BPS) {
      const maxMinutes = Math.floor((TARGET_BYTES * 8) / (MIN_VIDEO_BPS + AUDIO_BPS) / 60);
      throw new TooLarge(`הסרטון ארוך מדי (עד ${maxMinutes} דקות לסרטון). אפשר לקצר אותו בגלריה ולהעלות שוב.`);
    }
    // סרטון ארוך מקבל 720p, כדי שהאיכות תישאר טובה בתוך המגבלה
    const target = shortSide > 720 && videoBudget >= 2_500_000 ? 1080 : 720;
    const scale = Math.min(1, target / shortSide);
    const even = (n: number) => Math.max(2, Math.round((n * scale) / 2) * 2);
    const bitrate = Math.round(Math.min(target === 1080 ? 6_000_000 : 3_000_000, videoBudget * 0.92));

    const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
    const conversion = await Conversion.init({
      input,
      output,
      video: {
        width: even(track.displayWidth),
        height: even(track.displayHeight),
        fit: "fill",
        codec: "avc",
        bitrate,
        forceTranscode: true,
        // הסיבוב נצרב בתמונה עצמה, כדי שכל נגן יציג אותה עומדת
        allowTransformationMetadata: false,
      },
      audio: { codec: "aac" },
    });
    // אם הדפדפן לא יודע לכווץ (או שהקול היה הולך לאיבוד), אין טעם להמשיך
    const lost = conversion.discardedTracks.filter((d) => d.reason !== "discarded_by_user").map((d) => `${d.track.type}:${d.reason}`);
    if (!conversion.isValid || lost.length) throw new Error(`conversion invalid ${lost.join(",")}`);

    // שומר: אם אין התקדמות חצי דקה, מבטלים במקום להיתקע לנצח
    let lastProgress = Date.now();
    conversion.onProgress = (p) => { lastProgress = Date.now(); onProgress?.(p); };
    let stalled = false;
    const watchdog = setInterval(() => {
      if (Date.now() - lastProgress > STALL_MS) { stalled = true; void conversion.cancel(); }
    }, 2000);
    try {
      await conversion.execute();
    } catch (e) {
      throw stalled ? new Error("compression stalled") : e;
    } finally {
      clearInterval(watchdog);
    }

    const buffer = output.target.buffer!;
    if (buffer.byteLength > MAX_UPLOAD_BYTES) {
      throw new TooLarge(`גם אחרי כיווץ הסרטון גדול מדי (${mb(buffer.byteLength)}MB). אפשר לקצר אותו בגלריה ולהעלות שוב.`);
    }
    return new File([buffer], file.name.replace(/\.[^.]+$/, "") + ".mp4", { type: "video/mp4" });
  } finally {
    input.dispose();
  }
}

/** הודעה שמוצגת כמו שהיא: הסרטון לא ייכנס גם אחרי כיווץ */
class TooLarge extends Error {}
