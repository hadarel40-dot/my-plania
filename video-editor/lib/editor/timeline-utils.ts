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
  return Math.max(videoEnd, captionsEnd);
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
