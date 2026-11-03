"use client";

/**
 * בחשבון החינמי של Supabase אפשר להעלות קובץ של עד 50MB, וסרטון מהאייפון בדרך כלל
 * גדול בהרבה (ולרוב בפורמט HEVC, שלא כל דפדפן במחשב מנגן). לכן לפני ההעלאה מכווצים
 * אותו בתוך הדפדפן: H.264 ברזולוציה של עד 1080p, בקצב שנכנס במגבלה.
 */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const TARGET_BYTES = 45 * 1024 * 1024; // מרווח ביטחון מתחת ל-50MB
const AUDIO_BPS = 192_000; // הערכה לפס הקול (בדרך כלל AAC שמועתק כמו שהוא)
const MIN_VIDEO_BPS = 600_000; // מתחת לזה האיכות כבר לא שווה

export const mb = (bytes: number) => Math.round(bytes / 1024 / 1024);

/**
 * מחזיר קובץ מוכן להעלאה: המקורי אם הוא כבר קטן ותואם, אחרת גרסה מכווצת.
 * onProgress מקבל 0..1.
 */
export async function prepareVideoForUpload(file: File, onProgress?: (p: number) => void): Promise<File> {
  const { Input, Output, Conversion, BlobSource, BufferTarget, Mp4OutputFormat, ALL_FORMATS } = await import("mediabunny");
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) return file;
    const duration = await input.computeDuration();
    const shortSide = Math.min(track.displayWidth, track.displayHeight);
    if (track.codec === "avc" && file.size <= TARGET_BYTES && shortSide <= 1080) return file;

    const videoBudget = (TARGET_BYTES * 8) / duration - AUDIO_BPS;
    if (videoBudget < MIN_VIDEO_BPS) {
      const maxMinutes = Math.floor((TARGET_BYTES * 8) / (MIN_VIDEO_BPS + AUDIO_BPS) / 60);
      throw new TooLarge(`הסרטון ארוך מדי (עד ${maxMinutes} דקות לסרטון). אפשר לקצר אותו בטלפון ולהעלות שוב.`);
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
    // אם הדפדפן לא יודע לכווץ (או שהקול היה הולך לאיבוד), לא מכווצים
    const lostTrack = conversion.discardedTracks.some((d) => d.reason !== "discarded_by_user");
    if (!conversion.isValid || lostTrack) throw new CompressionUnsupported();

    conversion.onProgress = (p) => onProgress?.(p);
    await conversion.execute();
    const buffer = output.target.buffer!;
    if (buffer.byteLength > MAX_UPLOAD_BYTES) {
      throw new TooLarge(`גם אחרי כיווץ הסרטון גדול מדי (${mb(buffer.byteLength)}MB). אפשר לקצר אותו ולהעלות שוב.`);
    }
    return new File([buffer], file.name.replace(/\.[^.]+$/, "") + ".mp4", { type: "video/mp4" });
  } catch (e) {
    if (e instanceof TooLarge) throw e;
    // הכיווץ לא הצליח: אם המקורי נכנס במגבלה, מעלים אותו כמו שהוא
    if (file.size <= MAX_UPLOAD_BYTES) return file;
    throw new Error(`הסרטון גדול מדי (${mb(file.size)}MB, המקסימום 50MB) והדפדפן הזה לא מצליח לכווץ אותו. אפשר לקצר אותו בטלפון ולנסות שוב.`);
  } finally {
    input.dispose();
  }
}

class CompressionUnsupported extends Error {}
/** הודעה שמוצגת כמו שהיא: הסרטון לא ייכנס גם אחרי כיווץ */
class TooLarge extends Error {}
