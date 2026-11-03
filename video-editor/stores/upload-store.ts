"use client";
import { create } from "zustand";
import { importFile } from "@/lib/media/import";
import { uid } from "@/lib/editor/timeline-utils";
import { useEditor } from "./editor-store";

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
  const release = await keepAwake();
  window.addEventListener("beforeunload", warnOnLeave);
  try {
    while (queue.length) {
      const { file, item } = queue.shift()!;
      const update = (patch: Partial<UploadItem>) =>
        useUploads.setState((s) => ({ items: s.items.map((x) => (x.id === item.id ? { ...x, ...patch } : x)) }));
      try {
        const asset = await importFile(file, (progress, stage) => update({ progress, stage }));
        useEditor.getState().addAsset(asset);
      } catch (e) {
        const message = e instanceof Error ? e.message : "ההעלאה נכשלה";
        useUploads.setState((s) => ({ errors: [...s.errors, `${file.name}: ${message}`] }));
      } finally {
        useUploads.setState((s) => ({ items: s.items.filter((x) => x.id !== item.id) }));
      }
    }
  } finally {
    window.removeEventListener("beforeunload", warnOnLeave);
    release();
    running = false;
  }
}

function warnOnLeave(e: BeforeUnloadEvent) {
  e.preventDefault();
}

/** מונע מהמסך להיכבות באמצע כיווץ והעלאה (בטלפון זה עוצר את הכל) */
async function keepAwake(): Promise<() => void> {
  let lock: WakeLockSentinel | null = null;
  const acquire = async () => {
    try { lock = await navigator.wakeLock?.request("screen"); } catch { /* לא נתמך או נדחה */ }
  };
  // הנעילה משתחררת כשהלשונית מוסתרת, ולכן מבקשים אותה שוב כשחוזרים
  const onVisible = () => { if (document.visibilityState === "visible") void acquire(); };
  await acquire();
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    document.removeEventListener("visibilitychange", onVisible);
    void lock?.release().catch(() => undefined);
  };
}
