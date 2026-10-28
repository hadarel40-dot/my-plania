"use client";
import { create, useStore } from "zustand";
import { immer } from "zustand/middleware/immer";
import { temporal } from "zundo";
import {
  NEUTRAL_LOOK,
  type Aspect,
  type AudioClip,
  type Caption,
  type Clip,
  type Look,
  type Overlay,
  type MediaAsset,
  type SavedProject,
  type Selection,
  type Timeline,
  type Variant,
  type VariantParams,
} from "@/lib/editor/types";
import { clipLength, layoutClips, MIN_CLIP_SEC, uid } from "@/lib/editor/timeline-utils";
import { initialProject, makeClip, normalizeProject } from "@/lib/editor/initial-project";
import { presetById } from "@/lib/editor/overlay-presets";
import { sfxAsset, type SfxId } from "@/lib/editor/sfx";
import { mockProvider, type GenerateResult, type VariantProvider } from "@/lib/ai/provider";
import type { Transcriber } from "@/lib/ai/transcriber";
import type { CloudConfig } from "@/lib/ai/fal-config";

const LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export type AiMode = "mock" | "cloud";

/** הספקים הפעילים. מוחלפים יחד כשעוברים בין דמו לענן */
const engines: { provider: VariantProvider; transcriber: Transcriber | null } = {
  provider: mockProvider,
  transcriber: null,
};
export function setEngines(provider: VariantProvider, transcriber: Transcriber) {
  engines.provider = provider;
  engines.transcriber = transcriber;
}

interface EditorState {
  title: string;
  timeline: Timeline;
  assets: Record<string, MediaAsset>;
  variants: Record<string, Variant>;
  selection: Selection;
  /** וריאציה שמוצגת זמנית בנגן, לפני שהוחלה על ציר הזמן */
  previewVariantId: string | null;
  transcribing: boolean;
  aiMode: AiMode;
  /** מה זמין בענן (מ-/api/config). null עד שנטען */
  cloud: CloudConfig | null;
  error: string | null;

  hydrate: (project: SavedProject) => void;
  newProject: () => void;
  setAiMode: (mode: AiMode) => void;
  setCloud: (cloud: CloudConfig) => void;
  setError: (error: string | null) => void;
  addAsset: (asset: MediaAsset) => void;
  setAssetRemoteUrl: (assetId: string, url: string) => void;
  addClip: (assetId: string) => void;
  moveClip: (clipId: string, toIndex: number) => void;
  trimClip: (clipId: string, edge: "in" | "out", value: number) => void;
  splitAt: (time: number) => void;
  removeSelected: () => void;
  setAspect: (aspect: Aspect) => void;
  setTitle: (title: string) => void;

  setClipLook: (clipId: string, look: Look) => void;
  setClipVolume: (clipId: string, volume: number) => void;

  addOverlay: (presetId: string, at: number) => void;
  updateOverlay: (id: string, patch: Partial<Omit<Overlay, "id">>) => void;
  /** הזזה או חיתוך של פריט מתוזמן (טקסט / כתובית) על ציר הזמן */
  retimeItem: (kind: "overlay" | "caption", id: string, start: number, end: number) => void;

  addSfx: (sfxId: SfxId, at: number) => void;
  addAudioClip: (assetId: string, at: number) => void;
  updateAudioClip: (id: string, patch: Partial<Omit<AudioClip, "id" | "assetId">>) => void;

  setCaptions: (captions: Caption[]) => void;
  updateCaption: (id: string, patch: Partial<Omit<Caption, "id">>) => void;
  addCaption: (start: number) => void;

  select: (selection: Selection) => void;
  previewVariant: (variantId: string | null) => void;
  generateVariants: (clipId: string, params: Omit<VariantParams, "seed">, count: number, parentId?: string) => Promise<void>;
  /** ממשיך לעקוב אחרי עבודות שרת שעדיין רצות (אחרי טעינת פרויקט) */
  resumePendingVariants: (provider: VariantProvider) => void;
  applyVariant: (variantId: string) => void;
  revertClip: (clipId: string) => void;
  rateVariant: (variantId: string, rating: -1 | 1) => void;
  deleteVariant: (variantId: string) => void;
  autoTranscribe: () => Promise<void>;
}

/** וריאציות שכבר עוקבים אחריהן, כדי לא להתחיל מעקב כפול */
const resuming = new Set<string>();

/** מריץ עבודה של וריאציה אחת ומעדכן את הכרטיס שלה: התקדמות, תוצאה או כשל */
async function trackVariant(
  variantId: string,
  run: (onProgress: (p: number) => void) => Promise<GenerateResult>,
) {
  const set = useEditor.setState as (fn: (s: EditorState) => void) => void;
  resuming.add(variantId);
  try {
    const result = await run((progress) =>
      set((s) => { const cur = s.variants[variantId]; if (cur) { cur.status = "running"; cur.progress = progress; } }));
    set((s) => {
      if (result.asset) s.assets[result.asset.id] = result.asset;
      const cur = s.variants[variantId];
      if (cur) { cur.status = "succeeded"; cur.progress = 100; cur.result = { assetId: result.assetId, look: result.look }; }
    });
  } catch (e) {
    set((s) => {
      const cur = s.variants[variantId];
      if (cur) cur.status = "failed";
      s.error = `יצירת וריאציה נכשלה: ${e instanceof Error ? e.message : String(e)}`;
    });
  } finally {
    resuming.delete(variantId);
  }
}

export const useEditor = create<EditorState>()(
  temporal(
    immer((set, get) => ({
      ...initialProject(),
      selection: null,
      previewVariantId: null,
      transcribing: false,
      aiMode: "mock",
      cloud: null,
      error: null,

      hydrate: (project) =>
        set((s) => {
          Object.assign(s, normalizeProject(project));
          s.selection = null;
          s.previewVariantId = null;
        }),
      newProject: () =>
        set((s) => {
          Object.assign(s, initialProject());
          s.selection = null;
          s.previewVariantId = null;
        }),
      setAiMode: (mode) => set((s) => { s.aiMode = mode; }),
      setCloud: (cloud) => set((s) => { s.cloud = cloud; }),
      setError: (error) => set((s) => { s.error = error; }),

      addAsset: (asset) => set((s) => { s.assets[asset.id] = asset; }),
      setAssetRemoteUrl: (assetId, url) =>
        set((s) => { const a = s.assets[assetId]; if (a) a.remoteUrl = url; }),

      addClip: (assetId) =>
        set((s) => {
          const asset = s.assets[assetId];
          if (!asset) return;
          const clip = makeClip(asset);
          s.timeline.clips.push(clip);
          s.selection = { kind: "clip", id: clip.id };
        }),

      moveClip: (clipId, toIndex) =>
        set((s) => {
          const from = s.timeline.clips.findIndex((c) => c.id === clipId);
          if (from < 0) return;
          const target = Math.max(0, Math.min(toIndex, s.timeline.clips.length - 1));
          if (from === target) return;
          const [clip] = s.timeline.clips.splice(from, 1);
          s.timeline.clips.splice(target, 0, clip);
        }),

      trimClip: (clipId, edge, value) =>
        set((s) => {
          const clip = s.timeline.clips.find((c) => c.id === clipId);
          if (!clip) return;
          const asset = s.assets[clip.assetId];
          if (edge === "in") {
            clip.in = Math.max(0, Math.min(value, clip.out - MIN_CLIP_SEC));
          } else {
            clip.out = Math.min(asset?.duration ?? clip.out, Math.max(value, clip.in + MIN_CLIP_SEC));
          }
        }),

      splitAt: (time) =>
        set((s) => {
          const hit = layoutClips(s.timeline.clips).find(({ start, end }) => time > start && time < end);
          if (!hit) return;
          const { clip, start } = hit;
          const cut = clip.in + (time - start);
          if (cut - clip.in < MIN_CLIP_SEC || clip.out - cut < MIN_CLIP_SEC) return;
          const index = s.timeline.clips.findIndex((c) => c.id === clip.id);
          const second: Clip = { ...clip, id: uid("clip"), in: cut, activeVariantId: null };
          s.timeline.clips[index].out = cut;
          s.timeline.clips.splice(index + 1, 0, second);
        }),

      removeSelected: () =>
        set((s) => {
          const sel = s.selection;
          if (!sel) return;
          if (sel.kind === "clip") s.timeline.clips = s.timeline.clips.filter((c) => c.id !== sel.id);
          else if (sel.kind === "caption") s.timeline.captions = s.timeline.captions.filter((c) => c.id !== sel.id);
          else if (sel.kind === "overlay") s.timeline.overlays = s.timeline.overlays.filter((o) => o.id !== sel.id);
          else s.timeline.audio = s.timeline.audio.filter((a) => a.id !== sel.id);
          s.selection = null;
          s.previewVariantId = null;
        }),

      setAspect: (aspect) => set((s) => { s.timeline.aspect = aspect; }),
      setTitle: (title) => set((s) => { s.title = title; }),

      setClipLook: (clipId, look) =>
        set((s) => {
          const clip = s.timeline.clips.find((c) => c.id === clipId);
          if (clip) clip.look = look;
        }),
      setClipVolume: (clipId, volume) =>
        set((s) => {
          const clip = s.timeline.clips.find((c) => c.id === clipId);
          if (clip) clip.volume = Math.max(0, Math.min(1, volume));
        }),

      addOverlay: (presetId, at) =>
        set((s) => {
          const preset = presetById(presetId);
          const overlay: Overlay = { ...preset.fields, id: uid("ovl"), start: at, end: at + preset.duration };
          s.timeline.overlays.push(overlay);
          s.selection = { kind: "overlay", id: overlay.id };
        }),
      updateOverlay: (id, patch) =>
        set((s) => {
          const o = s.timeline.overlays.find((x) => x.id === id);
          if (o) Object.assign(o, patch);
        }),
      retimeItem: (kind, id, start, end) =>
        set((s) => {
          const list = kind === "overlay" ? s.timeline.overlays : s.timeline.captions;
          const item = list.find((x) => x.id === id);
          if (!item) return;
          item.start = Math.max(0, +start.toFixed(2));
          item.end = Math.max(item.start + MIN_CLIP_SEC, +end.toFixed(2));
        }),

      addSfx: (sfxId, at) =>
        set((s) => {
          const asset = sfxAsset(sfxId);
          s.assets[asset.id] ??= asset;
          const clip: AudioClip = { id: uid("aud"), assetId: asset.id, start: at, in: 0, out: asset.duration, volume: 1, fadeIn: 0, fadeOut: 0 };
          s.timeline.audio.push(clip);
          s.selection = { kind: "audio", id: clip.id };
        }),
      addAudioClip: (assetId, at) =>
        set((s) => {
          const asset = s.assets[assetId];
          if (!asset) return;
          // מוזיקה ארוכה מקבלת דהייה רכה בהתחלה ובסוף
          const long = asset.duration > 5;
          const clip: AudioClip = {
            id: uid("aud"), assetId, start: at, in: 0, out: asset.duration,
            volume: long ? 0.6 : 1, fadeIn: long ? 1 : 0, fadeOut: long ? 2 : 0,
          };
          s.timeline.audio.push(clip);
          s.selection = { kind: "audio", id: clip.id };
        }),
      updateAudioClip: (id, patch) =>
        set((s) => {
          const a = s.timeline.audio.find((x) => x.id === id);
          if (!a) return;
          Object.assign(a, patch);
          const dur = s.assets[a.assetId]?.duration ?? a.out;
          a.start = Math.max(0, a.start);
          a.in = Math.max(0, Math.min(a.in, a.out - MIN_CLIP_SEC));
          a.out = Math.min(dur, Math.max(a.out, a.in + MIN_CLIP_SEC));
        }),

      setCaptions: (captions) => set((s) => { s.timeline.captions = captions; }),
      updateCaption: (id, patch) =>
        set((s) => {
          const cap = s.timeline.captions.find((c) => c.id === id);
          if (cap) Object.assign(cap, patch);
        }),
      addCaption: (start) =>
        set((s) => {
          const cap: Caption = { id: uid("cap"), start, end: start + 2, text: "טקסט חדש", preset: "bold-pop" };
          s.timeline.captions.push(cap);
          s.timeline.captions.sort((a, b) => a.start - b.start);
          s.selection = { kind: "caption", id: cap.id };
        }),

      select: (selection) => set((s) => { s.selection = selection; s.previewVariantId = null; }),
      previewVariant: (variantId) => set((s) => { s.previewVariantId = variantId; }),

      generateVariants: async (clipId, params, count, parentId) => {
        const clip = get().timeline.clips.find((c) => c.id === clipId);
        const source = clip && get().assets[clip.sourceAssetId];
        if (!clip || !source) return;

        const existing = Object.values(get().variants).filter((v) => v.clipId === clipId).length;
        const batchAt = Date.now();
        const created: Variant[] = Array.from({ length: count }, (_, i) => ({
          id: uid("var"),
          clipId,
          label: LABELS[(existing + i) % LABELS.length] + (existing + i >= LABELS.length ? "2" : ""),
          status: "queued",
          progress: 0,
          params: { ...params, seed: Math.floor(Math.random() * 2 ** 31) },
          parentId: parentId ?? null,
          rating: 0,
          result: null,
          createdAt: batchAt,
        }));
        set((s) => { for (const v of created) s.variants[v.id] = v; });

        // כל וריאציה רצה במקביל ומעדכנת את הכרטיס שלה בנפרד
        const provider = engines.provider;
        await Promise.all(created.map((v) =>
          trackVariant(v.id, (onProgress) => provider.generate({
            variantId: v.id,
            source,
            clip,
            params: v.params,
            onJob: (jobId) => set((s) => { const cur = s.variants[v.id]; if (cur) cur.jobId = jobId; }),
          }, onProgress)),
        ));
      },

      resumePendingVariants: (provider) => {
        const resume = provider.resume?.bind(provider);
        if (!resume) return;
        const { variants, timeline, assets } = get();
        for (const v of Object.values(variants)) {
          if (!v.jobId || v.status === "succeeded" || v.status === "failed" || resuming.has(v.id)) continue;
          const clip = timeline.clips.find((c) => c.id === v.clipId);
          const name = (clip && assets[clip.sourceAssetId]?.name) || "וריאציה";
          const jobId = v.jobId;
          trackVariant(v.id, (onProgress) => resume(jobId, name, onProgress));
        }
      },

      applyVariant: (variantId) =>
        set((s) => {
          const v = s.variants[variantId];
          const clip = v && s.timeline.clips.find((c) => c.id === v.clipId);
          if (!v?.result || !clip) return;
          clip.assetId = v.result.assetId;
          clip.look = v.result.look;
          clip.activeVariantId = v.id;
          const asset = s.assets[clip.assetId];
          // וריאציה יכולה להיות קצרה מהמקור; שומרים על אורך הקליפ ככל שאפשר
          if (asset && clip.out > asset.duration) {
            const len = clipLength(clip);
            clip.out = asset.duration;
            clip.in = Math.max(0, asset.duration - len);
          }
          s.previewVariantId = null;
        }),

      revertClip: (clipId) =>
        set((s) => {
          const clip = s.timeline.clips.find((c) => c.id === clipId);
          if (!clip) return;
          clip.assetId = clip.sourceAssetId;
          clip.look = NEUTRAL_LOOK;
          clip.activeVariantId = null;
          s.previewVariantId = null;
        }),

      rateVariant: (variantId, rating) =>
        set((s) => {
          const v = s.variants[variantId];
          if (v) v.rating = v.rating === rating ? 0 : rating;
        }),

      deleteVariant: (variantId) =>
        set((s) => {
          delete s.variants[variantId];
          if (s.previewVariantId === variantId) s.previewVariantId = null;
        }),

      autoTranscribe: async () => {
        if (get().transcribing || !engines.transcriber) return;
        set((s) => { s.transcribing = true; s.error = null; });
        try {
          const { timeline, assets } = get();
          const captions = await engines.transcriber.transcribe(timeline, assets);
          set((s) => { s.timeline.captions = captions; });
        } catch (e) {
          set((s) => { s.error = `התמלול נכשל: ${e instanceof Error ? e.message : String(e)}`; });
        } finally {
          set((s) => { s.transcribing = false; });
        }
      },
    })),
    {
      // רק ציר הזמן נכנס להיסטוריית undo. בחירה, תצוגה מקדימה וסטטוס jobs לא
      partialize: (s) => ({ timeline: s.timeline }),
      equality: (a, b) => a.timeline === b.timeline,
      limit: 100,
    },
  ),
);

/**
 * מחוות גרירה (trim/הזזה) מייצרות עשרות עדכונים. עוטפים אותן כך שייכנס
 * להיסטוריה צעד undo אחד בלבד.
 */
export function beginGesture() {
  const before = useEditor.getState().timeline;
  const temporalStore = useEditor.temporal.getState();
  temporalStore.pause();
  return function endGesture() {
    const t = useEditor.temporal;
    t.getState().resume();
    if (useEditor.getState().timeline !== before) {
      t.setState((st) => ({ pastStates: [...st.pastStates, { timeline: before }], futureStates: [] }));
    }
  };
}

/** האם יש לאן לבטל / לחזור. לכפתורים בממשק */
export const useHistory = () => ({
  canUndo: useStore(useEditor.temporal, (s) => s.pastStates.length > 0),
  canRedo: useStore(useEditor.temporal, (s) => s.futureStates.length > 0),
});

export const undo = () => useEditor.temporal.getState().undo();
export const redo = () => useEditor.temporal.getState().redo();
