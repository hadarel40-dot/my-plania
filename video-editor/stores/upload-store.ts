"use client";
import { create } from "zustand";
import { importFile } from "@/lib/media/import";
import { uid } from "@/lib/editor/timeline-utils";
import { errorText, logEvent } from "@/lib/telemetry";
import { useEditor } from "./editor-store";
import { keepAwake } from "@/lib/keep-awake";
import type { MediaAsset } from "@/lib/editor/types";

export interface UploadItem {
  id: string;
  name: string;
  progress: number;
  stage: "waiting" | "compress" | "upload";
}

interface UploadState {
  items: UploadItem[];
  errors: string[];
  /** כמה קבצים נכנסו בסבב הנוכחי (לתצוגה "3 מתוך 8") */
  total: number;
  done: number;
  /** בחירת קבצים פתוחה, או שהאייפון מכין את הסרטונים שנבחרו (עוד לפני שהם מגיעים לאתר) */
  picking: boolean;
  enqueue: (files: File[]) => void;
  clearErrors: () => void;
  setPicking: (picking: boolean) => void;
}

/** כמה קבצים עולים יחד. כיווץ (כבד לטלפון) תמיד אחד-אחד, ההעלאה עצמה במקביל */
const PARALLEL = 3;

/**
 * תור ההעלאות. חי מחוץ לקומפוננטות, כדי שההעלאה תמשיך גם כשעוברים בטלפון
 * ללשונית אחרת. כמה קבצים עולים במקביל, אבל נכנסים לציר הזמן לפי הסדר שנבחרו.
 */
export const useUploads = create<UploadState>((set) => ({
  items: [],
  errors: [],
  total: 0,
  done: 0,
  picking: false,
  enqueue: (files) => {
    const added = files.map((file) => ({ file, order: nextOrder++, item: { id: uid("up"), name: file.name, progress: 0, stage: "waiting" as const } }));
    set((s) => ({
      items: [...s.items, ...added.map((a) => a.item)],
      total: (s.items.length ? s.total : 0) + added.length,
      done: s.items.length ? s.done : 0,
      picking: false,
    }));
    queue.push(...added);
    pump();
  },
  clearErrors: () => set({ errors: [] }),
  setPicking: (picking) => {
    set({ picking });
    clearTimeout(pickTimer);
    // אם לא הגיעו קבצים (למשל סגרו את הגלריה), לא משאירים את ההודעה לנצח
    if (picking) pickTimer = setTimeout(() => set({ picking: false }), 90_000);
  },
}));

let pickTimer: ReturnType<typeof setTimeout> | undefined;
let nextOrder = 0;
const queue: { file: File; order: number; item: UploadItem }[] = [];
let active = 0;
let release: (() => void) | null = null;

/** תוצאות שהסתיימו לפני קבצים שנבחרו לפניהן מחכות, כדי שהסדר בציר הזמן יישמר */
const finished = new Map<number, MediaAsset | null>();
let nextToPlace = 0;

function pump() {
  if (!release && queue.length) release = keepAwake();
  while (active < PARALLEL && queue.length) {
    const job = queue.shift()!;
    active++;
    void runOne(job).finally(() => {
      active--;
      if (!queue.length && active === 0) { release?.(); release = null; }
      pump();
    });
  }
}

function place() {
  while (finished.has(nextToPlace)) {
    const asset = finished.get(nextToPlace)!;
    finished.delete(nextToPlace);
    nextToPlace++;
    if (!asset) continue;
    useEditor.getState().addAsset(asset);
    // סרטון שהועלה נכנס ישר לסוף ציר הזמן, כמו בעורכים בטלפון
    if (asset.kind !== "audio") useEditor.getState().addClip(asset.id);
  }
}

async function runOne({ file, order, item }: { file: File; order: number; item: UploadItem }) {
  const update = (patch: Partial<UploadItem>) =>
    useUploads.setState((s) => ({ items: s.items.map((x) => (x.id === item.id ? { ...x, ...patch } : x)) }));
  const info = { name: file.name, size: file.size, type: file.type };
  const started = Date.now();
  let lastStage = "waiting";
  logEvent("upload_start", info);
  try {
    const asset = await importFile(file, (progress, stage) => { lastStage = stage; update({ progress, stage }); });
    finished.set(order, asset);
    logEvent("upload_done", { ...info, ms: Date.now() - started });
  } catch (e) {
    finished.set(order, null);
    logEvent("upload_failed", { ...info, stage: lastStage, ms: Date.now() - started, error: errorText(e) });
    const message = e instanceof Error ? e.message : "ההעלאה נכשלה";
    useUploads.setState((s) => ({ errors: [...s.errors, `${file.name}: ${message}`] }));
  } finally {
    place();
    useUploads.setState((s) => ({ items: s.items.filter((x) => x.id !== item.id), done: s.done + 1 }));
  }
}
