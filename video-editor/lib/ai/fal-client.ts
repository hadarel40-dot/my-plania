"use client";
import { fal } from "@fal-ai/client";
import type { MediaAsset } from "@/lib/editor/types";

fal.config({ proxyUrl: "/api/fal/proxy" });

export { fal };

const uploads = new Map<string, Promise<string>>();

/**
 * מודלים בענן צריכים כתובת ציבורית. קובץ מקומי (blob או /samples) עולה פעם אחת
 * ל-fal storage, והכתובת נשמרת על הנכס.
 */
export function ensureRemoteUrl(asset: MediaAsset, onUploaded: (url: string) => void): Promise<string> {
  if (asset.remoteUrl) return Promise.resolve(asset.remoteUrl);
  if (/^https?:\/\//.test(asset.url) && !asset.url.startsWith(location.origin)) {
    return Promise.resolve(asset.url);
  }
  let pending = uploads.get(asset.id);
  if (!pending) {
    pending = (async () => {
      const blob = await (await fetch(asset.url)).blob();
      const url = await fal.storage.upload(new File([blob], asset.name, { type: blob.type || "video/mp4" }));
      onUploaded(url);
      return url;
    })();
    pending.catch(() => uploads.delete(asset.id));
    uploads.set(asset.id, pending);
  }
  return pending;
}

/** שולף כתובת וידאו מתשובה של מודל. כל מודל מחזיר מבנה קצת אחר */
export function extractVideoUrl(data: unknown): string | null {
  const d = data as Record<string, any>;
  return d?.video?.url ?? d?.video_url ?? d?.output?.url ?? d?.videos?.[0]?.url ?? null;
}
