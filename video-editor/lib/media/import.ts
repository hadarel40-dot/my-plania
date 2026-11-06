import type { MediaAsset } from "@/lib/editor/types";
import { uid } from "@/lib/editor/timeline-utils";
import { getBackend } from "@/lib/backend";
import { errorText, logEvent } from "@/lib/telemetry";
import { MAX_UPLOAD_BYTES, mb, prepareVideoForUpload } from "./compress";
import { saveOriginal } from "./originals";

/**
 * מייבא קובץ וידאו: מנגנים אותו מיד מהדפדפן (blob URL), ובמקביל שומרים אותו
 * ב-backend הפעיל: IndexedDB במצב מקומי, או העלאה resumable ל-Supabase Storage.
 */
export async function importFile(
  file: File,
  onProgress?: (p: number, stage: "compress" | "upload") => void,
): Promise<MediaAsset> {
  // בטלפון סוג הקובץ לפעמים ריק, ואז מזהים לפי הסיומת
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const isAudio = file.type.startsWith("audio/") || (!file.type && AUDIO_EXT.includes(ext));
  const isVideo = file.type.startsWith("video/") || (!file.type && VIDEO_EXT.includes(ext));
  const isImage = file.type.startsWith("image/") || IMAGE_EXT.includes(ext);
  // תמונה או צילום מסך: נשמרים כסרטון קצר של תמונה קבועה (עובד בנגן ובייצוא כמו כל סרטון)
  if (isImage && !isVideo) {
    const { imageToVideo } = await import("@/lib/video/still-video");
    const preview = await imagePreview(file);
    const video = await imageToVideo(file, "own", 8);
    const asset = await importFile(video, onProgress);
    return { ...asset, name: file.name, still: true, thumbnailUrl: preview ?? asset.thumbnailUrl };
  }
  if (!isAudio && !isVideo) throw new Error("אפשר להעלות סרטונים, תמונות וצילומי מסך, או קבצי שמע");
  // בענן יש מגבלת גודל לקובץ: וידאו מכווצים קודם (חצי ראשון של ההתקדמות), ואז מעלים
  const cloud = getBackend().kind === "cloud";
  const original = file;
  if (cloud && isVideo) {
    file = await prepareVideoForUpload(file, (p) => onProgress?.(Math.round(p * 50), "compress"));
  } else if (cloud && file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`הקובץ גדול מדי (${mb(file.size)}MB, המקסימום 50MB)`);
  }
  const base = file !== original ? 50 : 5;
  const url = URL.createObjectURL(file);
  const asset = isAudio ? await probeAudio(url, file.name) : await probeUploadedVideo(file, url);
  onProgress?.(base, "upload");
  const stored = await getBackend().storeFile(asset.id, file, (p) => onProgress?.(base + Math.round((p * (100 - base)) / 100), "upload"));
  // סרטון שכווץ כדי להיכנס למגבלת הענן: המקור באיכות מלאה נשמר בטלפון, והייצוא ממנו
  let hasOriginal = false;
  if (file !== original) hasOriginal = await saveOriginal(asset.id, original);
  return { ...asset, ...stored, ...(hasOriginal ? { hasOriginal: true } : {}) };
}

/**
 * מדידת וידאו שהועלה: קודם קוראים את המשך והמידות ישירות מהקובץ (הכי אמין בטלפון),
 * ואז מנסים לייצר תמונה ממוזערת דרך נגן הדפדפן, עם זמן מקסימלי. בלי תמונה ממשיכים.
 */
async function probeUploadedVideo(file: File, url: string): Promise<MediaAsset> {
  try {
    const asset = await probeVideoFile(file, url);
    const thumb = await Promise.race([
      probeVideo(url, { name: file.name, origin: "upload" }).then((a) => a.thumbnailUrl),
      new Promise<null>((r) => setTimeout(() => r(null), 10_000)),
    ]).catch(() => null);
    return { ...asset, thumbnailUrl: thumb };
  } catch (e) {
    logEvent("probe_file_failed", { size: file.size, type: file.type, error: errorText(e) });
    return probeVideo(url, { name: file.name, origin: "upload" });
  }
}

const IMAGE_EXT = ["jpg", "jpeg", "png", "heic", "heif", "webp", "gif"];

/** תמונה ממוזערת בגודל קריא (עד 768 פיקסלים), כדי שהבינה המלאכותית תוכל לקרוא צילום מסך */
async function imagePreview(file: File): Promise<string | null> {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 768 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close();
    return c.toDataURL("image/jpeg", 0.8);
  } catch { return null; }
}

const VIDEO_EXT = ["mp4", "mov", "m4v", "webm", "3gp"];
const AUDIO_EXT = ["mp3", "wav", "m4a", "aac", "ogg"];

/**
 * מחכה לאירוע של אלמנט מדיה. ב-iPhone חלק מהאירועים לפעמים לא מגיעים בכלל,
 * ולכן תמיד יש זמן מקסימלי, כדי שההעלאה לא תיתקע לנצח.
 */
function waitForEvent(el: HTMLMediaElement, event: string, ms: number, errorMessage: string) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(new Error(errorMessage)); }, ms);
    const ok = () => { cleanup(); resolve(); };
    const fail = () => { cleanup(); reject(new Error(errorMessage)); };
    const cleanup = () => {
      clearTimeout(timer);
      el.removeEventListener(event, ok);
      el.removeEventListener("error", fail);
    };
    el.addEventListener(event, ok);
    el.addEventListener("error", fail);
  });
}

/** מודד קובץ שמע (משך) בדפדפן */
export async function probeAudio(url: string, name: string): Promise<MediaAsset> {
  const audio = document.createElement("audio");
  audio.preload = "metadata";
  audio.src = url;
  const loaded = waitForEvent(audio, "loadedmetadata", 20000, "הדפדפן לא מצליח לפענח את קובץ השמע (כדאי לנסות MP3)");
  audio.load();
  await loaded;
  return {
    id: uid("asset"), name, url, thumbnailUrl: null, duration: audio.duration,
    width: 0, height: 0, origin: "upload", kind: "audio",
  };
}

/** מודד וידאו בדפדפן (משך, מידות) ומייצר תמונה ממוזערת. עובד גם על כתובות מהענן */
export async function probeVideo(
  url: string,
  meta: Pick<MediaAsset, "name" | "origin"> & Partial<MediaAsset>,
): Promise<MediaAsset> {
  const video = document.createElement("video");
  video.muted = true;
  // בלי playsinline, ב-iPhone הווידאו לא נטען ברקע
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.preload = "auto";
  if (!url.startsWith("blob:")) video.crossOrigin = "anonymous";
  video.src = url;
  const loaded = waitForEvent(video, "loadedmetadata", 20000, "הדפדפן לא מצליח לפענח את הקובץ (נסו MP4)");
  video.load();
  await loaded;
  // ב-iPhone המשך לפעמים מגיע רק אחרי רגע
  if (!Number.isFinite(video.duration)) {
    await waitForEvent(video, "durationchange", 3000, "").catch(() => undefined);
  }
  if (!Number.isFinite(video.duration) || video.duration <= 0) throw new Error("לא הצלחנו לקרוא את אורך הסרטון");
  // התמונה הממוזערת היא רק קישוט: אם היא נתקעת, ממשיכים בלעדיה
  const thumbnailUrl = await captureFrame(video, Math.min(1, video.duration / 2)).catch(() => null);
  return {
    id: uid("asset"),
    url,
    thumbnailUrl,
    duration: video.duration,
    width: video.videoWidth,
    height: video.videoHeight,
    ...meta,
  };
}

/**
 * גיבוי למדידה: קורא את המשך והמידות ישירות מתוך הקובץ, בלי נגן הווידאו של הדפדפן
 * (שב-iPhone לפעמים לא נטען). בלי תמונה ממוזערת.
 */
async function probeVideoFile(file: File, url: string): Promise<MediaAsset> {
  const { Input, BlobSource, ALL_FORMATS } = await import("mediabunny");
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const duration = await input.computeDuration();
    const track = await input.getPrimaryVideoTrack();
    if (!track || !(duration > 0)) throw new Error("no video track");
    return {
      id: uid("asset"), url, thumbnailUrl: null, duration,
      width: track.displayWidth, height: track.displayHeight,
      name: file.name, origin: "upload",
    };
  } finally {
    input.dispose();
  }
}

async function captureFrame(video: HTMLVideoElement, time: number) {
  const seeked = waitForEvent(video, "seeked", 5000, "seek timeout");
  video.currentTime = time;
  await seeked;
  const canvas = document.createElement("canvas");
  const scale = 180 / Math.max(1, video.videoWidth);
  canvas.width = 180;
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.7);
}
