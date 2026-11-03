"use client";
import type { MediaAsset } from "@/lib/editor/types";

/** קצב הדגימה של כל ניתוחי הסאונד (כמו ש-Whisper מצפה לקבל) */
export const ANALYSIS_RATE = 16000;

const cache = new Map<string, Promise<Float32Array>>();

/**
 * פס הקול של קובץ כגל מונו ב-16kHz. מפוענח פעם אחת לכל קובץ ונשמר בזיכרון, כי
 * הסרת שתיקות, סנכרון לקצב ותמלול משתמשים באותו גל.
 * המערך משותף: מי שמעביר אותו ל-Worker צריך להעביר עותק.
 */
export function decodeAssetAudio(asset: Pick<MediaAsset, "id" | "url">): Promise<Float32Array> {
  let pending = cache.get(asset.id);
  if (!pending) {
    pending = decode(asset.url);
    pending.catch(() => cache.delete(asset.id));
    cache.set(asset.id, pending);
  }
  return pending;
}

async function decode(url: string): Promise<Float32Array> {
  const data = await (await fetch(url)).arrayBuffer();
  const ctx = new AudioContext({ sampleRate: ANALYSIS_RATE });
  try {
    const buf = await ctx.decodeAudioData(data);
    if (buf.numberOfChannels === 1) return buf.getChannelData(0);
    const mono = new Float32Array(buf.length);
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const ch = buf.getChannelData(c);
      for (let i = 0; i < ch.length; i++) mono[i] += ch[i] / buf.numberOfChannels;
    }
    return mono;
  } catch {
    throw new Error("לא הצלחתי לקרוא את הסאונד מהקובץ (אולי אין בו פס קול)");
  } finally {
    void ctx.close();
  }
}
