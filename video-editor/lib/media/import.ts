import type { MediaAsset } from "@/lib/editor/types";
import { uid } from "@/lib/editor/timeline-utils";
import { getBackend } from "@/lib/backend";

/**
 * מייבא קובץ וידאו: מנגנים אותו מיד מהדפדפן (blob URL), ובמקביל שומרים אותו
 * ב-backend הפעיל: IndexedDB במצב מקומי, או העלאה resumable ל-Supabase Storage.
 */
export async function importFile(file: File, onProgress?: (p: number) => void): Promise<MediaAsset> {
  const isAudio = file.type.startsWith("audio/");
  if (!isAudio && !file.type.startsWith("video/")) throw new Error("אפשר להעלות קבצי וידאו או שמע (MP4, MOV, MP3, WAV, M4A)");
  const url = URL.createObjectURL(file);
  const asset = isAudio
    ? await probeAudio(url, file.name)
    : await probeVideo(url, { name: file.name, origin: "upload" });
  onProgress?.(5);
  const stored = await getBackend().storeFile(asset.id, file, (p) => onProgress?.(5 + Math.round(p * 0.95)));
  return { ...asset, ...stored };
}

/** מודד קובץ שמע (משך) בדפדפן */
export async function probeAudio(url: string, name: string): Promise<MediaAsset> {
  const audio = document.createElement("audio");
  audio.preload = "metadata";
  audio.src = url;
  await new Promise<void>((resolve, reject) => {
    audio.onloadedmetadata = () => resolve();
    audio.onerror = () => reject(new Error("הדפדפן לא מצליח לפענח את קובץ השמע (כדאי לנסות MP3)"));
  });
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
  video.preload = "auto";
  video.crossOrigin = "anonymous";
  video.src = url;
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("הדפדפן לא מצליח לפענח את הקובץ (נסה MP4/H.264)"));
  });
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

async function captureFrame(video: HTMLVideoElement, time: number) {
  video.currentTime = time;
  await new Promise<void>((r) => { video.onseeked = () => r(); });
  const canvas = document.createElement("canvas");
  const scale = 180 / Math.max(1, video.videoWidth);
  canvas.width = 180;
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.7);
}
