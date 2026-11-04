import type { Caption, MediaAsset, Timeline } from "@/lib/editor/types";
import { layoutClips, uid } from "@/lib/editor/timeline-utils";
import { decodeAssetAudio } from "@/lib/audio/decode";
import { alignSegments, type AlignedSegment } from "./align";

export interface Segment { start: number; end: number; text: string }

/**
 * ממפה את התמלול לכתוביות על ציר הזמן. הזמנים מותאמים קודם לדיבור עצמו (alignSegments),
 * ואז כל מילה נכנסת רק לקטע הסרטון שבו היא נאמרת: בלי כתוביות כפולות כשמשפט נחתך בין
 * שני קטעים, ובלי מילים שנחתכו מהסרטון. כתובית היא עד 3 מילים, ומתחלקת גם בהפסקה בדיבור.
 */
export async function segmentsToCaptions(
  timeline: Timeline,
  assets: Record<string, MediaAsset>,
  segmentsFor: (asset: MediaAsset) => Promise<Segment[]>,
): Promise<Caption[]> {
  const aligned = new Map<string, Promise<AlignedSegment[]>>();
  const alignedFor = (asset: MediaAsset) => {
    let p = aligned.get(asset.id);
    if (!p) {
      p = (async () => {
        const segs = await segmentsFor(asset);
        try { return alignSegments(segs, await decodeAssetAudio(asset)); }
        catch { return alignSegments(segs, new Float32Array(0)); }
      })();
      aligned.set(asset.id, p);
    }
    return p;
  };

  const captions: Caption[] = [];
  for (const { clip, start } of layoutClips(timeline.clips)) {
    // גם קליפ שהסאונד שלו מושתק (למשל כשיש מוזיקה) מקבל כתוביות: הכתוביות הן לכל הסרטון
    const asset = assets[clip.sourceAssetId];
    if (!asset) continue;
    const speed = clip.speed ?? 1;
    const at = (t: number) => +(start + (Math.min(Math.max(t, clip.in), clip.out) - clip.in) / speed).toFixed(2);
    for (const seg of await alignedFor(asset)) {
      // רק המילים שנאמרות בתוך הקטע הזה (לפי אמצע המילה)
      const words = seg.words.filter((w) => { const mid = (w.start + w.end) / 2; return mid >= clip.in && mid < clip.out; });
      let group: typeof words = [];
      const flush = () => {
        if (!group.length) return;
        captions.push({ id: uid("cap"), start: at(group[0].start), end: at(group[group.length - 1].end), text: group.map((w) => w.text).join(" "), preset: "bold-pop" });
        group = [];
      };
      for (const w of words) {
        const last = group[group.length - 1];
        if (last && (group.length >= 3 || w.start - last.end > 0.3)) flush();
        group.push(w);
      }
      flush();
    }
  }
  // כתוביות לא חופפות: כל אחת נגמרת לכל המאוחר כשהבאה מתחילה
  captions.sort((a, b) => a.start - b.start);
  for (let i = 0; i < captions.length - 1; i++) captions[i].end = Math.min(captions[i].end, captions[i + 1].start);
  return captions.filter((c) => c.end - c.start >= 0.08);
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
