import type { Caption, MediaAsset, Timeline } from "@/lib/editor/types";
import { layoutClips, uid } from "@/lib/editor/timeline-utils";

export interface Segment { start: number; end: number; text: string }

/**
 * ממפה מקטעי תמלול (בזמן של קובץ המקור) לכתוביות על ציר הזמן, לפי נקודות החיתוך
 * והמהירות של כל קליפ. כל קובץ מתומלל פעם אחת, גם אם הוא מופיע בכמה קליפים.
 */
export async function segmentsToCaptions(
  timeline: Timeline,
  assets: Record<string, MediaAsset>,
  segmentsFor: (asset: MediaAsset) => Promise<Segment[]>,
): Promise<Caption[]> {
  const captions: Caption[] = [];
  for (const { clip, start } of layoutClips(timeline.clips)) {
    const asset = assets[clip.sourceAssetId];
    if (!asset || clip.volume === 0) continue;
    const speed = clip.speed ?? 1;
    for (const seg of await segmentsFor(asset)) {
      const s = Math.max(seg.start, clip.in);
      const e = Math.min(seg.end, clip.out);
      if (e - s < 0.2) continue;
      captions.push({
        id: uid("cap"),
        start: +(start + (s - clip.in) / speed).toFixed(2),
        end: +(start + (e - clip.in) / speed).toFixed(2),
        text: seg.text,
        preset: "bold-pop",
      });
    }
  }
  return captions;
}

/** מטמון לפי קובץ: אותו קובץ לא מתומלל פעמיים. כישלון לא נשמר */
export function perAssetCache(run: (asset: MediaAsset) => Promise<Segment[]>) {
  const cache = new Map<string, Promise<Segment[]>>();
  return (asset: MediaAsset) => {
    let pending = cache.get(asset.id);
    if (!pending) {
      pending = run(asset);
      pending.catch(() => cache.delete(asset.id));
      cache.set(asset.id, pending);
    }
    return pending;
  };
}
