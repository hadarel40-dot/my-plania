"use client";
import type { Caption, MediaAsset } from "@/lib/editor/types";
import { layoutClips, uid } from "@/lib/editor/timeline-utils";
import type { Transcriber } from "./transcriber";

/** "small" מדויק יותר בעברית; "base" מהיר וקל יותר להורדה */
export const WHISPER_MODEL = process.env.NEXT_PUBLIC_WHISPER_MODEL || "onnx-community/whisper-small";
const LANGUAGE = process.env.NEXT_PUBLIC_WHISPER_LANGUAGE || "hebrew";
const SAMPLE_RATE = 16000;

interface Segment { start: number; end: number; text: string }

let worker: Worker | null = null;
let nextId = 1;

function getWorker() {
  worker ??= new Worker(new URL("./whisper.worker.ts", import.meta.url), { type: "module" });
  return worker;
}

/** מפענח את פס הקול של קובץ לגל מונו ב-16kHz, כפי ש-Whisper מצפה לקבל */
async function decodeAudio(url: string): Promise<Float32Array> {
  const data = await (await fetch(url)).arrayBuffer();
  const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
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
    ctx.close();
  }
}

function runWhisper(audio: Float32Array, onStatus: (s: string) => void): Promise<Segment[]> {
  const w = getWorker();
  const id = nextId++;
  const files = new Map<string, { loaded: number; total: number }>();
  return new Promise((resolve, reject) => {
    const onMessage = (e: MessageEvent) => {
      const m = e.data;
      if (m.id !== id) return;
      if (m.type === "download") {
        files.set(m.file, { loaded: m.loaded, total: m.total });
        const all = [...files.values()];
        const loaded = all.reduce((s, f) => s + f.loaded, 0);
        const total = all.reduce((s, f) => s + f.total, 0);
        onStatus(`מוריד מודל ${Math.round((loaded / total) * 100)}% (${Math.round(total / 1e6)}MB, פעם אחת בלבד)`);
      } else if (m.type === "status") {
        onStatus("מתמלל…");
      } else if (m.type === "result") {
        w.removeEventListener("message", onMessage);
        resolve(
          (m.chunks as { timestamp: [number, number | null]; text: string }[])
            .map((c) => ({ start: c.timestamp[0], end: c.timestamp[1] ?? c.timestamp[0] + 2, text: c.text.trim() }))
            .filter((c) => c.text),
        );
      } else if (m.type === "error") {
        w.removeEventListener("message", onMessage);
        const offline = /fetch|network|load/i.test(m.message);
        reject(new Error(offline
          ? "לא הצלחתי להוריד את מודל התמלול. כדאי לבדוק את החיבור לאינטרנט ולנסות שוב."
          : m.message));
      }
    };
    w.addEventListener("message", onMessage);
    w.postMessage({ type: "transcribe", id, audio, model: WHISPER_MODEL, language: LANGUAGE }, [audio.buffer]);
  });
}

/**
 * תמלול חינמי שרץ כולו בדפדפן. כל קובץ מקור מתומלל פעם אחת, והמקטעים
 * ממופים לציר הזמן לפי נקודות החיתוך של כל קליפ.
 */
export function createBrowserTranscriber(): Transcriber {
  const cache = new Map<string, Promise<Segment[]>>();

  function transcribeAsset(asset: MediaAsset, onStatus: (s: string) => void) {
    let pending = cache.get(asset.id);
    if (!pending) {
      pending = (async () => {
        onStatus("קורא את הסאונד…");
        return runWhisper(await decodeAudio(asset.url), onStatus);
      })();
      pending.catch(() => cache.delete(asset.id));
      cache.set(asset.id, pending);
    }
    return pending;
  }

  return {
    id: "browser-whisper",
    async transcribe(timeline, assets, onStatus = () => {}) {
      const captions: Caption[] = [];
      for (const { clip, start } of layoutClips(timeline.clips)) {
        const asset = assets[clip.sourceAssetId];
        if (!asset || clip.volume === 0) continue;
        for (const seg of await transcribeAsset(asset, onStatus)) {
          const s = Math.max(seg.start, clip.in);
          const e = Math.min(seg.end, clip.out);
          if (e - s < 0.2) continue;
          captions.push({
            id: uid("cap"),
            start: +(start + s - clip.in).toFixed(2),
            end: +(start + e - clip.in).toFixed(2),
            text: seg.text,
            preset: "bold-pop",
          });
        }
      }
      return captions;
    },
  };
}
