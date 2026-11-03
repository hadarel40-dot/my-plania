"use client";
import type { FaceDetector } from "@mediapipe/tasks-vision";
import type { MediaAsset } from "@/lib/editor/types";

let detector: Promise<FaceDetector> | null = null;

/** טוען את מזהה הפנים (MediaPipe) פעם אחת. הקבצים מוגשים מהאתר עצמו */
function getDetector() {
  detector ??= (async () => {
    const { FaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");
    const vision = await FilesetResolver.forVisionTasks("/mediapipe");
    return FaceDetector.createFromOptions(vision, {
      baseOptions: { modelAssetPath: "/models/blaze_face_short_range.tflite" },
      runningMode: "IMAGE",
      minDetectionConfidence: 0.5,
    });
  })();
  detector.catch(() => { detector = null; });
  return detector;
}

function seek(video: HTMLVideoElement, time: number) {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 4000);
    video.onseeked = () => { clearTimeout(timer); resolve(); };
    video.currentTime = time;
  });
}

/**
 * איפה הפנים בקטע [from, to] של הסרטון: בודק כמה פריימים לאורך הקטע ומחזיר את
 * מרכז הפנים (0..1, חציון, כדי שתנועה רגעית לא תזיז). null אם לא נמצאו פנים.
 */
export async function findFaceFocus(asset: MediaAsset, from: number, to: number): Promise<{ x: number; y: number } | null> {
  const faces = await getDetector();
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.preload = "auto";
  if (!asset.url.startsWith("blob:")) video.crossOrigin = "anonymous";
  video.src = asset.url;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("הסרטון לא נטען")), 20000);
    video.onloadeddata = () => { clearTimeout(timer); resolve(); };
    video.onerror = () => { clearTimeout(timer); reject(new Error("הסרטון לא נטען")); };
    video.load();
  });

  const xs: number[] = [];
  const ys: number[] = [];
  const samples = 8;
  for (let i = 0; i < samples; i++) {
    await seek(video, from + ((to - from) * (i + 0.5)) / samples);
    const result = faces.detect(video);
    // הפנים הגדולות ביותר בפריים הן בדרך כלל של מי שמדבר
    const box = result.detections
      .map((d) => d.boundingBox)
      .filter((b): b is NonNullable<typeof b> => !!b)
      .sort((a, b) => b.width * b.height - a.width * a.height)[0];
    if (!box) continue;
    xs.push((box.originX + box.width / 2) / video.videoWidth);
    ys.push((box.originY + box.height / 2) / video.videoHeight);
  }
  video.removeAttribute("src");
  video.load();
  if (xs.length < 2) return null;
  const median = (a: number[]) => [...a].sort((p, q) => p - q)[Math.floor(a.length / 2)];
  return { x: median(xs), y: median(ys) };
}
