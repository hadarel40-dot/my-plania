"use client";
import { create } from "zustand";
import { useEditor } from "@/stores/editor-store";
import { usePreviewProxies } from "@/lib/media/preview-proxy";
import { loadVideo, seekVideo } from "@/lib/video/analyze";
import type { SmartPlan } from "@/lib/ai/smart-plan";
import { loadMyStyle } from "./my-style";
import { layoutClips } from "./timeline-utils";

/** סצנה בסטוריבורד: משפט מהדיבור, עם תמונה מהרגע הזה, ומה העורך מתכנן לעשות בו */
export interface Scene {
  index: number;
  start: number;
  end: number;
  text: string;
  keep: boolean;
  thumb: string | null;
  /** צילום מסך / תמונה שנכנסים בסצנה הזו */
  insert?: { name: string; image: string | null; layout: string; seconds: number };
  /** מה יקפוץ על המסך */
  moment?: string;
  note: string;
}

export type StoryboardResult =
  | { action: "approve"; scenes: Scene[]; hook: string }
  | { action: "notes"; scenes: Scene[]; hook: string; general: string }
  | { action: "skip" };

interface StoryboardState {
  open: boolean;
  busy: string | null;
  scenes: Scene[];
  hook: string;
  cta: string;
  summary: string;
  round: number;
  resolve: ((r: StoryboardResult) => void) | null;
}

export const useStoryboard = create<StoryboardState>(() => ({ open: false, busy: null, scenes: [], hook: "", cta: "", summary: "", round: 0, resolve: null }));

/** האם להציג את התוכנית לאישור לפני הבנייה (ברירת מחדל: כן) */
export const wantsStoryboard = () => loadMyStyle().storyboard !== false;

/** מציג את הסטוריבורד ומחכה לתשובה */
export function askStoryboard(data: { scenes: Scene[]; hook: string; cta: string; summary: string; round: number }): Promise<StoryboardResult> {
  return new Promise((resolve) => {
    useStoryboard.setState({ ...data, open: true, busy: null, resolve: (r) => { useStoryboard.setState({ resolve: null, ...(r.action === "notes" ? { busy: "מתקן את התוכנית לפי ההערות…" } : { open: false }) }); resolve(r); } });
  });
}
export const closeStoryboard = () => useStoryboard.setState({ open: false, busy: null, resolve: null });
export const storyboardBusy = (busy: string) => useStoryboard.setState({ busy });

/**
 * בונה את הסצנות מהתוכנית: משפט לכל סצנה, תמונה מתחילת המשפט (מהעותק הקטן של הסרטון,
 * מהיר), מה נחתך, איזה צילום מסך נכנס, ומה קופץ על המסך.
 */
export async function buildScenes(
  plan: SmartPlan, lines: { start: number; end: number; text: string }[][],
  inserts: { name: string; image: string | null }[],
): Promise<Scene[]> {
  const removed = new Set(plan.remove_segments);
  const thumbs = await thumbsAt(lines.map((l) => l[0].start + 0.15));
  return lines.map((l, i) => {
    const ins = (plan.inserts ?? []).find((x) => x.segment === i);
    const file = ins ? inserts[ins.insert] : undefined;
    const m = plan.moments.find((x) => x.segment === i);
    return {
      index: i, start: l[0].start, end: l[l.length - 1].end, text: l.map((c) => c.text).join(" "), keep: !removed.has(i), thumb: thumbs[i] ?? null,
      insert: ins && file ? { name: file.name, image: file.image, layout: ins.layout, seconds: ins.seconds } : undefined,
      moment: m?.text, note: "",
    };
  });
}

/** תמונות קטנות מציר הזמן, בזמנים הנתונים (נגן אחד לכל סרטון, דילוג אחרי דילוג) */
async function thumbsAt(times: number[]): Promise<(string | null)[]> {
  const { timeline, assets } = useEditor.getState();
  const laid = layoutClips(timeline.clips);
  const proxies = usePreviewProxies.getState().urls;
  const videos = new Map<string, HTMLVideoElement | null>();
  const out: (string | null)[] = [];
  const canvas = document.createElement("canvas");
  for (const t of times) {
    try {
      const hit = laid.find((l) => t >= l.start && t < l.end) ?? laid.at(-1);
      const asset = hit && assets[hit.clip.assetId];
      if (!hit || !asset) { out.push(null); continue; }
      if (!videos.has(asset.id)) videos.set(asset.id, await loadVideo(proxies[asset.id] ?? asset.url).catch(() => null));
      const v = videos.get(asset.id);
      if (!v) { out.push(null); continue; }
      await seekVideo(v, hit.clip.in + (t - hit.start) * (hit.clip.speed ?? 1));
      const k = 120 / Math.max(1, v.videoWidth);
      canvas.width = 120; canvas.height = Math.round(v.videoHeight * k);
      canvas.getContext("2d")!.drawImage(v, 0, 0, canvas.width, canvas.height);
      out.push(canvas.toDataURL("image/jpeg", 0.6));
    } catch {
      out.push(null);
    }
  }
  for (const v of videos.values()) if (v) { v.removeAttribute("src"); v.load(); }
  return out;
}
