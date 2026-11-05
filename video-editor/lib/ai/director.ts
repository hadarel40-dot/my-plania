"use client";
import { brainHeaders } from "@/lib/ai/my-key";
import type { Clip, MediaAsset } from "@/lib/editor/types";
import type { DirectorPlan, DirectorRequest } from "./smart-plan";
import { transcode } from "@/lib/media/compress";
import { usePreviewProxies } from "@/lib/media/preview-proxy";
import { logEvent } from "@/lib/telemetry";

/**
 * "הבמאי": Gemini צופה בסרטונים עצמם (תמונה, תנועה וסאונד), כמו עורך אנושי, ומחזיר
 * אילו רגעים לקחת ובאיזה סדר. לשם כך נשלח עותק זעיר של כל סרטון (שני פריימים בשנייה,
 * קול מכווץ), כי לשרת מותר לקבל עד כ-4MB בבקשה.
 */
const MAX_FOOTAGE_SEC = 6 * 60;
const BASE64_BUDGET = 3_300_000;

export interface DirectorShot { clipId: string; start: number; end: number; sound: boolean }

const cache = new Map<string, string>();

export async function watchFootage(
  clips: Clip[], assets: Record<string, MediaAsset>,
  req: Omit<DirectorRequest, "clips">,
  onStatus: (s: string) => void,
): Promise<{ plan: DirectorPlan; shots: DirectorShot[] }> {
  const footage = clips.reduce((sum, c) => sum + (c.out - c.in), 0);
  if (footage > MAX_FOOTAGE_SEC) throw new Error("יותר מדי צילומים לצפייה אחת");
  // כמה ביטים לשנייה אפשר להרשות כדי שהכל ייכנס בבקשה אחת
  const bps = (BASE64_BUDGET * 0.75 * 8) / Math.max(1, footage);
  const audioBitrate = 24_000;
  const videoBitrate = Math.round(Math.min(320_000, Math.max(50_000, bps * 0.9 - audioBitrate)));
  const started = Date.now();

  const { Input, BlobSource, UrlSource, ALL_FORMATS } = await import("mediabunny");
  const proxies = usePreviewProxies.getState().urls;
  const videos: string[] = [];
  for (const [i, clip] of clips.entries()) {
    onStatus(`מכין את הסרטונים לצפייה ${i + 1}/${clips.length}`);
    const asset = assets[clip.assetId];
    const key = `${clip.assetId}:${clip.in}:${clip.out}:${videoBitrate}`;
    let b64 = cache.get(key);
    if (!b64) {
      const url = proxies[clip.assetId] ?? asset.url;
      const source = url.startsWith("blob:") ? new BlobSource(await (await fetch(url)).blob()) : new UrlSource(url);
      const input = new Input({ source, formats: ALL_FORMATS });
      try {
        const { buffer } = await transcode(input, {
          shortSide: 256, bitrate: videoBitrate, keyFrameInterval: 2, frameRate: 2,
          audioBitrate, allowSilent: true, trim: { start: clip.in, end: clip.out },
        });
        b64 = toBase64(new Uint8Array(buffer));
        cache.set(key, b64);
      } finally {
        input.dispose();
      }
    }
    videos.push(b64);
  }
  const size = videos.reduce((s, v) => s + v.length, 0);
  if (size > 4_000_000) throw new Error("הסרטונים גדולים מדי לשליחה");

  onStatus("Gemini צופה בסרטונים…");
  const body: DirectorRequest = { ...req, clips: clips.map((c, i) => ({ duration: c.out - c.in, video: videos[i] })) };
  const res = await fetch("/api/director", { method: "POST", headers: brainHeaders(), body: JSON.stringify(body) });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    logEvent("brain_failed", { route: "director", status: res.status, error: data?.error, detail: data?.detail, size });
    throw new Error(data?.error ?? "Gemini לא החזיר עריכה");
  }
  const plan = data as DirectorPlan;
  const shots = plan.shots.flatMap((s): DirectorShot[] => {
    const clip = clips[s.clip - 1];
    if (!clip) return [];
    const start = Math.max(clip.in, clip.in + s.start);
    const end = Math.min(clip.out, clip.in + s.end);
    return end - start >= 0.3 ? [{ clipId: clip.id, start, end, sound: !!s.sound }] : [];
  });
  logEvent("director_done", { ms: Date.now() - started, size, clips: clips.length, shots: shots.length, footage: Math.round(footage) });
  if (shots.length < 2) throw new Error("Gemini בחר פחות מדי רגעים");
  return { plan, shots };
}

function toBase64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

