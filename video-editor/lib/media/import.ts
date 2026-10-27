import type { MediaAsset } from "@/lib/editor/types";
import { uid } from "@/lib/editor/timeline-utils";
import { getBackend } from "@/lib/backend";

/**
 * מייבא קובץ וידאו: מנגנים אותו מיד מהדפדפן (blob URL), ובמקביל שומרים אותו
 * ב-backend הפעיל: IndexedDB במצב מקומי, או העלאה resumable ל-Supabase Storage.
 */
export async function importFile(file: File, onProgress?: (p: number) => void): Promise<MediaAsset> {
  if (!file.type.startsWith("video/")) throw new Error("רק קבצי וידאו נתמכים כרגע");
  const url = URL.createObjectURL(file);
  const asset = await probeVideo(url, { name: file.name, origin: "upload" });
  onProgress?.(5);
  const stored = await getBackend().storeFile(asset.id, file, (p) => onProgress?.(5 + Math.round(p * 0.95)));
  return { ...asset, ...stored };
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
