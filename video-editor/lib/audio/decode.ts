"use client";
import type { MediaAsset } from "@/lib/editor/types";
import { logEvent } from "@/lib/telemetry";

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
    // שומר: בטלפון פענוח לפעמים נתקע בלי שגיאה. אחרי 40 שניות ממשיכים בלי הסאונד של הקובץ
    pending = Promise.race([
      decode(asset.url),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("קריאת הסאונד לקחה יותר מדי זמן")), 40_000)),
    ]);
    pending.catch(() => cache.delete(asset.id));
    cache.set(asset.id, pending);
  }
  return pending;
}

async function decode(url: string): Promise<Float32Array> {
  const data = await (await fetch(url)).arrayBuffer();
  const ctx = new AudioContext({ sampleRate: ANALYSIS_RATE });
  try {
    let buf = await ctx.decodeAudioData(data);
    // יש טלפונים שמתעלמים מקצב הדגימה שביקשנו: אז ממירים ל-16kHz בעצמנו, אחרת הסאונד
    // נשמע מואט (והתמלול, זיהוי השתיקות והקצב יוצאים שגויים)
    if (buf.sampleRate !== ANALYSIS_RATE) {
      logEvent("audio_resample", { from: buf.sampleRate, ctx: ctx.sampleRate });
      const off = new OfflineAudioContext(buf.numberOfChannels, Math.ceil(buf.duration * ANALYSIS_RATE), ANALYSIS_RATE);
      const src = off.createBufferSource();
      src.buffer = buf;
      src.connect(off.destination);
      src.start();
      buf = await off.startRendering();
    }
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
