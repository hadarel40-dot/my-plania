/// <reference lib="webworker" />
// מריץ את מודל התמלול (Whisper) בתוך הדפדפן, ב-Worker נפרד כדי שהעורך לא ייתקע.
// המודל יורד פעם אחת מ-Hugging Face ונשמר במטמון של הדפדפן.
import { pipeline, type AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";

type Req = { type: "transcribe"; id: number; audio: Float32Array; model: string; language: string };

let asr: AutomaticSpeechRecognitionPipeline | null = null;
let loaded = "";

const post = (msg: unknown) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(msg);

self.onmessage = async (e: MessageEvent<Req>) => {
  const { id, audio, model, language } = e.data;
  try {
    if (!asr || loaded !== model) {
      const webgpu = "gpu" in navigator;
      // כמו בדוגמאות של transformers.js: ב-WebGPU המקודד ב-fp32 והמפענח מכווץ; ב-WASM הכול q8
      asr = (await pipeline("automatic-speech-recognition", model, {
        device: webgpu ? "webgpu" : "wasm",
        dtype: webgpu ? { encoder_model: "fp32", decoder_model_merged: "q4" } : "q8",
        progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
          if (p.status === "progress" && p.total) post({ type: "download", id, file: p.file, loaded: p.loaded, total: p.total });
        },
      })) as AutomaticSpeechRecognitionPipeline;
      loaded = model;
    }
    post({ type: "status", id, status: "transcribing" });
    const out = (await asr(audio, {
      language,
      task: "transcribe",
      return_timestamps: true,
      chunk_length_s: 30,
      stride_length_s: 5,
    })) as { text: string; chunks?: { timestamp: [number, number | null]; text: string }[] };
    post({ type: "result", id, chunks: out.chunks ?? [] });
  } catch (err) {
    post({ type: "error", id, message: err instanceof Error ? err.message : String(err) });
  }
};
