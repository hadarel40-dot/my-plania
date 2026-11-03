"use client";
import { create } from "zustand";
import { importFile } from "@/lib/media/import";
import { uid } from "@/lib/editor/timeline-utils";
import { errorText, logEvent } from "@/lib/telemetry";
import { useEditor } from "./editor-store";
import { keepAwake } from "@/lib/keep-awake";

export interface UploadItem {
  id: string;
  name: string;
  progress: number;
  stage: "waiting" | "compress" | "upload";
}

interface UploadState {
  items: UploadItem[];
  errors: string[];
  enqueue: (files: File[]) => void;
  clearErrors: () => void;
}

/**
 * תור ההעלאות. חי מחוץ לקומפוננטות, כדי שההעלאה תמשיך גם כשעוברים בטלפון
 * ללשונית אחרת. הקבצים מטופלים אחד-אחד: כיווץ במקביל כבד מדי לטלפון.
 */
export const useUploads = create<UploadState>((set, get) => ({
  items: [],
  errors: [],
  enqueue: (files) => {
    const added = files.map((file) => ({ file, item: { id: uid("up"), name: file.name, progress: 0, stage: "waiting" as const } }));
    set((s) => ({ items: [...s.items, ...added.map((a) => a.item)] }));
    queue.push(...added);
    if (!running) void run();
  },
  clearErrors: () => set({ errors: [] }),
}));

const queue: { file: File; item: UploadItem }[] = [];
let running = false;

async function run() {
  running = true;
  const release = keepAwake();
  try {
    while (queue.length) {
      const { file, item } = queue.shift()!;
      const update = (patch: Partial<UploadItem>) =>
        useUploads.setState((s) => ({ items: s.items.map((x) => (x.id === item.id ? { ...x, ...patch } : x)) }));
      const info = { name: file.name, size: file.size, type: file.type };
      const started = Date.now();
      let lastStage = "waiting";
      logEvent("upload_start", info);
      try {
        const asset = await importFile(file, (progress, stage) => { lastStage = stage; update({ progress, stage }); });
        useEditor.getState().addAsset(asset);
        // סרטון שהועלה נכנס ישר לסוף ציר הזמן, כמו בעורכים בטלפון
        if (asset.kind !== "audio") useEditor.getState().addClip(asset.id);
        logEvent("upload_done", { ...info, ms: Date.now() - started });
      } catch (e) {
        logEvent("upload_failed", { ...info, stage: lastStage, ms: Date.now() - started, error: errorText(e) });
        const message = e instanceof Error ? e.message : "ההעלאה נכשלה";
        useUploads.setState((s) => ({ errors: [...s.errors, `${file.name}: ${message}`] }));
      } finally {
        useUploads.setState((s) => ({ items: s.items.filter((x) => x.id !== item.id) }));
      }
    }
  } finally {
    release();
    running = false;
  }
}

