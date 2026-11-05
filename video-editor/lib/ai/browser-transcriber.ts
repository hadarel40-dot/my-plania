"use client";
import type { Transcriber } from "./transcriber";
import { decodeAssetAudio } from "@/lib/audio/decode";
import { perAssetCache, segmentsToCaptions, type Segment } from "./segments";

/**
 * "small" מדויק יותר בעברית אבל כבד (כ-250MB). בטלפון הוא איטי מאוד ועלול לקרוס
 * מחוסר זיכרון, ולכן בטלפון משתמשים ב-"base", קל ומהיר יותר.
 */
function whisperModel() {
  if (process.env.NEXT_PUBLIC_WHISPER_MODEL) return process.env.NEXT_PUBLIC_WHISPER_MODEL;
  const phone = typeof window !== "undefined" && window.matchMedia("(pointer: coarse) and (max-width: 900px)").matches;
  return phone ? "onnx-community/whisper-base" : "onnx-community/whisper-small";
}
const LANGUAGE = process.env.NEXT_PUBLIC_WHISPER_LANGUAGE || "hebrew";


let worker: Worker | null = null;
let nextId = 1;

function getWorker() {
  worker ??= new Worker(new URL("./whisper.worker.ts", import.meta.url), { type: "module" });
  return worker;
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
    // עותק: הגל המקורי שמור במטמון ומשמש גם לניתוחים אחרים
    const copy = audio.slice();
    w.postMessage({ type: "transcribe", id, audio: copy, model: whisperModel(), language: LANGUAGE }, [copy.buffer]);
  });
}

/**
 * תמלול חינמי שרץ כולו בדפדפן. כל קובץ מקור מתומלל פעם אחת, והמקטעים
 * ממופים לציר הזמן לפי נקודות החיתוך של כל קליפ.
 */
export function createBrowserTranscriber(): Transcriber {
  return {
    id: "browser-whisper",
    async transcribe(timeline, assets, onStatus = () => {}) {
      const segmentsFor = perAssetCache(async (asset) => {
        onStatus("קורא את הסאונד…");
        const samples = await decodeAssetAudio(asset).catch(() => null);
        return samples ? runWhisper(samples, onStatus) : [];
      });
      return segmentsToCaptions(timeline, assets, segmentsFor);
    },
  };
}
