"use client";
import type { MediaAsset } from "@/lib/editor/types";
import { logEvent } from "@/lib/telemetry";
import { usePreviewProxies } from "@/lib/media/preview-proxy";

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
    // שומר: בטלפון פענוח לפעמים נתקע בלי שגיאה. אחרי 90 שניות ממשיכים בלי הסאונד של הקובץ
    pending = Promise.race([
      decodeFast(asset),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("קריאת הסאונד לקחה יותר מדי זמן")), 90_000)),
    ]);
    pending.catch(() => cache.delete(asset.id));
    cache.set(asset.id, pending);
  }
  return pending;
}

/**
 * קריאת הסאונד בדרך המהירה ביותר שיש: קודם מהעותק הקטן של התצוגה המקדימה (כמה MB במקום
 * עשרות), אחר כך רק פס הקול מתוך הקובץ (בלי לטעון את כל הווידאו לזיכרון; בסרטון ארוך
 * מהאייפון זה ההבדל בין שניות לדקה), ורק בסוף בדרך הישנה.
 */
async function decodeFast(asset: Pick<MediaAsset, "id" | "url">): Promise<Float32Array> {
  const started = Date.now();
  const proxy = usePreviewProxies.getState().urls[asset.id];
  if (proxy) {
    try {
      const out = await decode(proxy);
      logEvent("audio_decoded", { via: "proxy", ms: Date.now() - started });
      return out;
    } catch { /* ננסה בדרך הבאה */ }
  }
  try {
    const out = await decodeAudioTrack(asset.url);
    logEvent("audio_decoded", { via: "track", ms: Date.now() - started });
    return out;
  } catch (e) {
    logEvent("audio_track_decode_failed", { error: e instanceof Error ? e.message : String(e) });
  }
  return decode(asset.url);
}

/** רק פס הקול, בעזרת mediabunny: נקרא חתיכה אחרי חתיכה, מומר למונו ול-16kHz */
async function decodeAudioTrack(url: string): Promise<Float32Array> {
  const { Input, BlobSource, UrlSource, ALL_FORMATS, AudioBufferSink } = await import("mediabunny");
  const source = url.startsWith("blob:") ? new BlobSource(await (await fetch(url)).blob()) : new UrlSource(url);
  const input = new Input({ source, formats: ALL_FORMATS });
  try {
    // באייפון יש לפעמים כמה פסי קול: לוקחים את הראשון שאפשר לפענח
    let track = null;
    for (const t of await input.getAudioTracks()) if (await t.canDecode()) { track = t; break; }
    if (!track) throw new Error("אין פס קול שאפשר לפענח");
    const duration = await input.computeDuration();
    const rate = track.sampleRate;
    const mono = new Float32Array(Math.ceil(duration * rate) + rate);
    for await (const { buffer, timestamp } of new AudioBufferSink(track).buffers()) {
      const offset = Math.max(0, Math.round(timestamp * rate));
      const chans = buffer.numberOfChannels;
      for (let c = 0; c < chans; c++) {
        const data = buffer.getChannelData(c);
        for (let i = 0; i < data.length && offset + i < mono.length; i++) mono[offset + i] += data[i] / chans;
      }
    }
    if (rate === ANALYSIS_RATE) return mono;
    const off = new OfflineAudioContext(1, Math.ceil(mono.length * ANALYSIS_RATE / rate), ANALYSIS_RATE);
    const buf = off.createBuffer(1, mono.length, rate);
    buf.copyToChannel(mono, 0);
    const src = off.createBufferSource();
    src.buffer = buf;
    src.connect(off.destination);
    src.start();
    return (await off.startRendering()).getChannelData(0);
  } finally {
    input.dispose();
  }
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
