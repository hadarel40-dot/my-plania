"use client";
import { create } from "zustand";
import type { MediaAsset } from "@/lib/editor/types";
import { loadFile, saveFile } from "@/lib/persistence";
import { errorText, logEvent } from "@/lib/telemetry";
import { transcode } from "./compress";

/**
 * עותק קטן של כל סרטון, רק לתצוגה המקדימה (כמו שעורכים מקצועיים עושים):
 * 540p, עם תמונת מפתח כל חצי שנייה. הנגן קופץ בין הרבה קטעים קצרים, ובקובץ
 * המקורי כל קפיצה כזאת איטית (וב-iPhone גם כבדה). הייצוא תמיד משתמש במקור.
 *
 * העותקים נוצרים ברקע, אחד-אחד, ונשמרים בדפדפן כדי שבפעם הבאה הם יהיו מוכנים מיד.
 * אם משהו נכשל, פשוט נשארים עם הקובץ המקורי.
 */
const SHORT_SIDE = 540;
const BITRATE = 1_400_000;
const KEYFRAME_SEC = 0.5;
const MAX_SOURCE_SEC = 10 * 60;

export const usePreviewProxies = create<{ urls: Record<string, string> }>(() => ({ urls: {} }));

const queue: MediaAsset[] = [];
const seen = new Set<string>();
let running = false;
let paused: () => boolean = () => false;

/** בזמן העלאה או עריכה אוטומטית לא מתחילים עותק חדש, כדי לא להאט אותן */
export function setProxyPause(fn: () => boolean) {
  paused = fn;
}

export function ensurePreviewProxies(assets: MediaAsset[]) {
  if (typeof window === "undefined" || typeof VideoEncoder === "undefined" || typeof VideoDecoder === "undefined") return;
  for (const a of assets) {
    if (a.kind === "audio" || !a.url || seen.has(a.id)) continue;
    if (a.duration > MAX_SOURCE_SEC) continue;
    seen.add(a.id);
    queue.push(a);
  }
  if (!running && queue.length) void run();
}

const cacheKey = (a: MediaAsset) => `proxy:v1:${a.storagePath ?? a.id}`;

async function run() {
  running = true;
  try {
    while (queue.length) {
      while (paused()) await sleep(1500);
      const asset = queue.shift()!;
      const blob = await loadFile(cacheKey(asset)).catch(() => undefined) ?? await make(asset);
      if (blob) usePreviewProxies.setState((s) => ({ urls: { ...s.urls, [asset.id]: URL.createObjectURL(blob) } }));
      // נותנים לטלפון לנשום בין סרטון לסרטון
      await sleep(300);
    }
  } finally {
    running = false;
  }
}

async function make(asset: MediaAsset): Promise<Blob | null> {
  const started = Date.now();
  const { Input, BlobSource, UrlSource, ALL_FORMATS } = await import("mediabunny");
  let input: InstanceType<typeof Input> | null = null;
  try {
    // קובץ שהועלה עכשיו כבר נמצא בטלפון. קובץ מהענן נקרא ישירות משם
    const source = asset.url.startsWith("blob:")
      ? new BlobSource(await (await fetch(asset.url)).blob())
      : new UrlSource(asset.url);
    input = new Input({ source, formats: ALL_FORMATS });
    const { buffer } = await transcode(input, {
      shortSide: SHORT_SIDE, bitrate: BITRATE, keyFrameInterval: KEYFRAME_SEC, allowSilent: false,
    });
    const blob = new Blob([buffer], { type: "video/mp4" });
    // בדיקה שהעותק באמת באורך של המקור, אחרת הקטעים בתצוגה לא יתאימו
    const check = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
    const proxyDuration = await check.computeDuration().finally(() => check.dispose());
    if (Math.abs(proxyDuration - asset.duration) > 0.25) {
      logEvent("proxy_mismatch", { duration: asset.duration, proxyDuration });
      return null;
    }
    void saveFile(cacheKey(asset), blob);
    logEvent("proxy_done", { ms: Date.now() - started, from: asset.width, size: blob.size, duration: asset.duration });
    return blob;
  } catch (e) {
    logEvent("proxy_failed", { ms: Date.now() - started, error: errorText(e) });
    return null;
  } finally {
    input?.dispose();
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
