import type { Clip, Timeline } from "./types";

export const clipLength = (c: Clip) => c.out - c.in;

/** מיקום כל קליפ על ציר הזמן, נגזר מהסדר (מסלול מגנטי) */
export function layoutClips(clips: Clip[]) {
  let t = 0;
  return clips.map((clip) => {
    const start = t;
    t += clipLength(clip);
    return { clip, start, end: t };
  });
}

export function timelineDuration(tl: Timeline) {
  const videoEnd = tl.clips.reduce((sum, c) => sum + clipLength(c), 0);
  const captionsEnd = Math.max(0, ...tl.captions.map((c) => c.end));
  const overlaysEnd = Math.max(0, ...(tl.overlays ?? []).map((o) => o.end));
  const audioEnd = Math.max(0, ...(tl.audio ?? []).map((a) => a.start + a.out - a.in));
  return Math.max(videoEnd, captionsEnd, overlaysEnd, audioEnd);
}

/** הקליפ שנמצא בזמן נתון, והזמן היחסי בתוכו */
export function clipAtTime(tl: Timeline, time: number) {
  return layoutClips(tl.clips).find(({ start, end }) => time >= start && time < end) ?? null;
}

export const MIN_CLIP_SEC = 0.2;

export function formatTime(sec: number, fps = 30) {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  const ff = Math.floor((s % 1) * fps);
  return `${m.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}:${ff.toString().padStart(2, "0")}`;
}

export const uid = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 9)}`;

/**
 * מחלק פריטים שחופפים בזמן לשורות, כדי שבציר הזמן לא יוצגו זה על גבי זה.
 * מחזיר לכל פריט את מספר השורה, ואת מספר השורות הכולל.
 */
export function assignLanes(items: { id: string; start: number; end: number }[]) {
  const laneEnds: number[] = [];
  const lanes = new Map<string, number>();
  for (const item of [...items].sort((a, b) => a.start - b.start)) {
    let lane = laneEnds.findIndex((end) => end <= item.start + 0.001);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(0); }
    laneEnds[lane] = item.end;
    lanes.set(item.id, lane);
  }
  return { lanes, count: Math.max(1, laneEnds.length) };
}
