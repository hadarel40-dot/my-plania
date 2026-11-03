import type { Clip, Timeline } from "./types";

/** מהירות הקליפ (1 = רגיל) */
export const clipSpeed = (c: Clip) => c.speed ?? 1;
/** האורך בציר הזמן: קליפ מהיר תופס פחות זמן ממה שצולם */
export const clipLength = (c: Clip) => (c.out - c.in) / clipSpeed(c);

/** מעברים שבהם שני הקליפים חופפים (הבא נכנס מעל הקודם), כמו ב-CapCut */
export const OVERLAP_TRANSITIONS = ["fade", "slide", "zoom", "blur"] as const;

/** כמה שניות הקליפ חופף לקודם בגלל מעבר (עד חצי מכל אחד מהם) */
export function transitionOverlap(clip: Clip, prevLength: number) {
  const t = clip.transitionIn;
  if (!t || !(OVERLAP_TRANSITIONS as readonly string[]).includes(t.type)) return 0;
  return Math.max(0, Math.min(t.duration, prevLength / 2, clipLength(clip) / 2));
}

/** מיקום כל קליפ על ציר הזמן, נגזר מהסדר (מסלול מגנטי). מעבר חופף מקדים את הקליפ */
export function layoutClips(clips: Clip[]) {
  let t = 0;
  let prevLength = 0;
  return clips.map((clip, i) => {
    const start = i > 0 ? t - transitionOverlap(clip, prevLength) : t;
    prevLength = clipLength(clip);
    t = start + prevLength;
    return { clip, start, end: t };
  });
}

/** סוף הווידאו בציר הזמן (כולל החפיפות של המעברים) */
export const videoEnd = (clips: Clip[]) => layoutClips(clips).at(-1)?.end ?? 0;

export function timelineDuration(tl: Timeline) {
  const end = videoEnd(tl.clips);
  const captionsEnd = Math.max(0, ...tl.captions.map((c) => c.end));
  const overlaysEnd = Math.max(0, ...(tl.overlays ?? []).map((o) => o.end));
  // כשיש וידאו, הסרטון נגמר עם הווידאו: שיר ארוך לא מוסיף מסך שחור בסוף
  const audioEnd = tl.clips.length ? 0 : Math.max(0, ...(tl.audio ?? []).map((a) => a.start + a.out - a.in));
  return Math.max(end, captionsEnd, overlaysEnd, audioEnd);
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
    const speed = clipSpeed(clip);
    ranges.forEach((r, i) => {
      const piece: Clip = { ...clip, id: i === 0 ? clip.id : uid("clip"), in: r.start, out: r.end };
      if (i > 0) { piece.activeVariantId = null; delete piece.transitionIn; }
      next.push(piece);
      pieces.push({ oldStart: start, clip, newStart: newT, srcIn: r.start, srcOut: r.end });
      newT += (r.end - r.start) / speed;
    });
  }
  const oldEnd = videoEnd(clips);
  const mapTime = (t: number) => {
    if (t >= oldEnd) return newT + (t - oldEnd);
    for (const p of pieces) {
      const speed = clipSpeed(p.clip);
      const src = p.clip.in + (t - p.oldStart) * speed;
      if (t < p.oldStart) return p.newStart;
      if (src < p.srcOut && t < p.oldStart + clipLength(p.clip)) {
        if (src < p.srcIn) return p.newStart;
        return p.newStart + (src - p.srcIn) / speed;
      }
    }
    return newT;
  };
  return { clips: next, mapTime };
}
