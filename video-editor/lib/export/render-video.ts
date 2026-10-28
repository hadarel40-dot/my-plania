"use client";
import { canRenderMediaOnWeb, renderMediaOnWeb } from "@remotion/web-renderer";
import { TimelineComposition, type CompositionProps } from "@/remotion/timeline-composition";
import { ASPECT_SIZE, type MediaAsset, type Timeline } from "@/lib/editor/types";
import { timelineDuration } from "@/lib/editor/timeline-utils";

export type ExportQuality = "720p" | "1080p";

/**
 * מרנדר את הפרויקט לקובץ MP4 בתוך הדפדפן (WebCodecs), בלי שרת ובלי תשלום.
 * אותה קומפוזיציה כמו בנגן, רק עם רכיבי מדיה שמתאימים לרינדור.
 */
export async function renderToMp4(
  timeline: Timeline,
  assets: Record<string, MediaAsset>,
  { quality, onProgress, signal }: { quality: ExportQuality; onProgress: (p: number) => void; signal: AbortSignal },
): Promise<Blob> {
  const full = ASPECT_SIZE[timeline.aspect];
  const scale = quality === "720p" ? 2 / 3 : 1;
  // קידוד H.264 דורש מידות זוגיות
  const even = (n: number) => Math.round((n * scale) / 2) * 2;
  const width = even(full.width);
  const height = even(full.height);
  const durationInFrames = Math.max(1, Math.ceil(timelineDuration(timeline) * timeline.fps));

  const check = await canRenderMediaOnWeb({ width, height, container: "mp4", videoCodec: "h264" });
  if (!check.canRender) {
    throw new Error("הדפדפן הזה לא תומך בייצוא וידאו. כדאי לנסות ב-Chrome או Edge במחשב.");
  }

  const inputProps: CompositionProps = { timeline, assets, override: null, mediaMode: "media" };
  const result = await renderMediaOnWeb({
    composition: {
      id: "export",
      component: TimelineComposition as unknown as React.ComponentType<Record<string, unknown>>,
      width,
      height,
      fps: timeline.fps,
      durationInFrames,
    },
    inputProps,
    container: "mp4",
    videoCodec: "h264",
    audioCodec: "aac",
    videoBitrate: "high",
    signal,
    onProgress: (p) => onProgress(Math.round(p.progress * 100)),
    licenseKey: process.env.NEXT_PUBLIC_REMOTION_LICENSE_KEY || null,
    logLevel: "warn",
  });
  return result.getBlob();
}
