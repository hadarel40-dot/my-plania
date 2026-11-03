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

export interface SourceRange { start: number; end: number }

/**
 * מחליף קליפים בקטעים מתוכם (בזמן המקור), למשל אחרי הסרת שתיקות. מחזיר את
 * הקליפים החדשים ופונקציה שממפה זמן מציר הזמן הישן לחדש, כדי להזיז אחריהם
 * כתוביות וטקסטים. זמן שנפל בקטע שנחתך עובר לתחילת הקטע הבא.
 */
export function cutClips(clips: Clip[], plan: Map<string, SourceRange[]>) {
  const pieces: { oldStart: number; clip: Clip; newStart: number; srcIn: number; srcOut: number }[] = [];
  const next: Clip[] = [];
  let newT = 0;
  for (const { clip, start } of layoutClips(clips)) {
    const ranges = (plan.get(clip.id) ?? [{ start: clip.in, end: clip.out }])
      .map((r) => ({ start: Math.max(clip.in, r.start), end: Math.min(clip.out, r.end) }))
      .filter((r) => r.end - r.start >= MIN_CLIP_SEC);
    ranges.forEach((r, i) => {
      const piece: Clip = { ...clip, id: i === 0 ? clip.id : uid("clip"), in: r.start, out: r.end };
      if (i > 0) piece.activeVariantId = null;
      next.push(piece);
      pieces.push({ oldStart: start, clip, newStart: newT, srcIn: r.start, srcOut: r.end });
      newT += r.end - r.start;
    });
  }
  const oldEnd = clips.reduce((s, c) => s + clipLength(c), 0);
  const mapTime = (t: number) => {
    if (t >= oldEnd) return newT + (t - oldEnd);
    for (const p of pieces) {
      const src = p.clip.in + (t - p.oldStart);
      if (t < p.oldStart) return p.newStart;
      if (src < p.srcOut && t < p.oldStart + clipLength(p.clip)) {
        if (src < p.srcIn) return p.newStart;
        return p.newStart + (src - p.srcIn);
      }
    }
    return newT;
  };
  return { clips: next, mapTime };
}
