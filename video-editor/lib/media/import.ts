import type { MediaAsset } from "@/lib/editor/types";
import { uid } from "@/lib/editor/timeline-utils";
import { getBackend } from "@/lib/backend";

/**
 * מייבא קובץ וידאו: מנגנים אותו מיד מהדפדפן (blob URL), ובמקביל שומרים אותו
 * ב-backend הפעיל: IndexedDB במצב מקומי, או העלאה resumable ל-Supabase Storage.
 */
export async function importFile(file: File, onProgress?: (p: number) => void): Promise<MediaAsset> {
  // בטלפון סוג הקובץ לפעמים ריק, ואז מזהים לפי הסיומת
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const isAudio = file.type.startsWith("audio/") || (!file.type && AUDIO_EXT.includes(ext));
  const isVideo = file.type.startsWith("video/") || (!file.type && VIDEO_EXT.includes(ext));
  if (!isAudio && !isVideo) throw new Error("אפשר להעלות קבצי וידאו או שמע (MP4, MOV, MP3, WAV, M4A)");
  const url = URL.createObjectURL(file);
  const asset = isAudio
    ? await probeAudio(url, file.name)
    : await probeVideo(url, { name: file.name, origin: "upload" })
        .catch((e) => probeVideoFile(file, url).catch(() => { throw e; }));
  onProgress?.(5);
  const stored = await getBackend().storeFile(asset.id, file, (p) => onProgress?.(5 + Math.round(p * 0.95)));
  return { ...asset, ...stored };
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
