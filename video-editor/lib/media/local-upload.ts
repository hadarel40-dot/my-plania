import type { MediaAsset } from "@/lib/editor/types";
import { uid } from "@/lib/editor/timeline-utils";

/**
 * מצב דמו: הקובץ נשאר בדפדפן (blob URL) ונמדד מקומית.
 * בענן, הפונקציה הזו מוחלפת בהעלאה ישירה ל-Storage (Mux Direct Upload / S3 multipart)
 * ובהמתנה ל-webhook שה-proxy וה-thumbnails מוכנים.
 */
export async function importLocalFile(file: File, onProgress?: (p: number) => void): Promise<MediaAsset> {
  if (!file.type.startsWith("video/")) throw new Error("רק קבצי וידאו נתמכים כרגע");
  const url = URL.createObjectURL(file);
  onProgress?.(30);

  const video = document.createElement("video");
  video.muted = true;
  video.preload = "auto";
  video.src = url;
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("הדפדפן לא מצליח לפענח את הקובץ (נסה MP4/H.264)"));
  });
  onProgress?.(60);

  const thumbnailUrl = await captureFrame(video, Math.min(1, video.duration / 2)).catch(() => null);
  onProgress?.(100);

  return {
    id: uid("asset"),
    name: file.name,
    url,
    thumbnailUrl,
    duration: video.duration,
    width: video.videoWidth,
    height: video.videoHeight,
    origin: "upload",
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
