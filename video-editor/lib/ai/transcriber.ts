"use client";
import type { Caption, MediaAsset, Timeline } from "@/lib/editor/types";
import { layoutClips, timelineDuration, uid } from "@/lib/editor/timeline-utils";
import { useEditor } from "@/stores/editor-store";
import type { CloudConfig } from "./fal-config";
import { ensureRemoteUrl, fal } from "./fal-client";
import { mockTranscribe } from "./mock-transcribe";

export interface Transcriber {
  id: string;
  transcribe(timeline: Timeline, assets: Record<string, MediaAsset>): Promise<Caption[]>;
}

export const mockTranscriber: Transcriber = {
  id: "mock",
  transcribe: (timeline) => mockTranscribe(timelineDuration(timeline)),
};

interface Segment { start: number; end: number; text: string }

/**
 * Whisper דרך fal: מתמלל כל קובץ מקור פעם אחת, ואז ממפה את המקטעים
 * לציר הזמן לפי נקודות החיתוך של כל קליפ.
 */
export function createFalTranscriber(cloud: CloudConfig): Transcriber {
  const model = cloud.transcribe!;
  const cache = new Map<string, Promise<Segment[]>>();

  async function transcribeAsset(asset: MediaAsset): Promise<Segment[]> {
    const audioUrl = await ensureRemoteUrl(asset, (url) => useEditor.getState().setAssetRemoteUrl(asset.id, url));
    const { data } = await fal.subscribe(model, {
      input: {
        audio_url: audioUrl,
        task: "transcribe",
        chunk_level: "segment",
        ...(cloud.transcribeLanguage ? { language: cloud.transcribeLanguage } : {}),
      },
      pollInterval: 1500,
    });
    const chunks = (data as { chunks?: { timestamp: [number, number | null]; text: string }[] }).chunks ?? [];
    return chunks
      .map((c) => ({ start: c.timestamp[0], end: c.timestamp[1] ?? c.timestamp[0] + 2, text: c.text.trim() }))
      .filter((c) => c.text);
  }

  return {
    id: "fal",
    async transcribe(timeline, assets) {
      const captions: Caption[] = [];
      for (const { clip, start } of layoutClips(timeline.clips)) {
        const asset = assets[clip.sourceAssetId];
        if (!asset) continue;
        let pending = cache.get(asset.id);
        if (!pending) {
          pending = transcribeAsset(asset);
          pending.catch(() => cache.delete(asset.id));
          cache.set(asset.id, pending);
        }
        for (const seg of await pending) {
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
