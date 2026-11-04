"use client";
import { useEditor } from "@/stores/editor-store";
import { uid } from "./timeline-utils";
import { wordTimes } from "./captions";
import type { Caption } from "./types";
import { loadMyStyle, rememberStyle } from "./my-style";
import { replaceInText } from "./dictionary";
export { applyDictionary, dictionaryHints, replaceInText } from "./dictionary";

/** עריכת הכתוביות עצמן: תיקון מילים, החלפה בכולן, מיזוג, פיצול וכמה מילים בכל כתובית */

/** מחליף בכל הכתוביות. מחזיר בכמה כתוביות היה שינוי */
export function replaceEverywhere(from: string, to: string, remember: boolean): number {
  let count = 0;
  useEditor.setState((s) => ({
    timeline: {
      ...s.timeline,
      captions: s.timeline.captions.map((c) => {
        const text = replaceInText(c.text, from, to);
        if (text !== c.text) count++;
        return text === c.text ? c : { ...c, text };
      }),
    },
  }));
  if (remember && from.trim() && to.trim()) rememberStyle({ dictionary: { ...loadMyStyle().dictionary, [from.trim()]: to.trim() } });
  return count;
}

/** אם בעריכה התחלפה בדיוק מילה אחת, מחזיר אותה (כדי להציע להחליף בכל הכתוביות) */
export function singleWordChange(before: string, after: string): { from: string; to: string } | null {
  const a = before.split(/\s+/).filter(Boolean);
  const b = after.split(/\s+/).filter(Boolean);
  if (a.length !== b.length) return null;
  const diff = a.map((w, i) => [w, b[i]] as const).filter(([x, y]) => x !== y);
  if (diff.length !== 1) return null;
  const clean = (w: string) => w.replace(/[.,!?:;"'״]/g, "");
  return { from: clean(diff[0][0]), to: clean(diff[0][1]) };
}

export function mergeWithNext(id: string) {
  useEditor.setState((s) => {
    const caps = [...s.timeline.captions].sort((a, b) => a.start - b.start);
    const i = caps.findIndex((c) => c.id === id);
    if (i < 0 || i >= caps.length - 1) return {};
    const merged = { ...caps[i], text: `${caps[i].text} ${caps[i + 1].text}`, end: caps[i + 1].end };
    caps.splice(i, 2, merged);
    return { timeline: { ...s.timeline, captions: caps } };
  });
}

/** פיצול לשתיים באמצע (לפי מילים), כשהזמן מתחלק לפי אורך המילים */
export function splitInHalf(id: string) {
  useEditor.setState((s) => {
    const caps = [...s.timeline.captions];
    const i = caps.findIndex((c) => c.id === id);
    if (i < 0) return {};
    const c = caps[i];
    const words = wordTimes(c.text, c.end - c.start);
    if (words.length < 2) return {};
    const mid = Math.ceil(words.length / 2);
    const at = c.start + words[mid - 1].end;
    caps.splice(i, 1,
      { ...c, text: words.slice(0, mid).map((w) => w.word).join(" "), end: +at.toFixed(2) },
      { ...c, id: uid("cap"), text: words.slice(mid).map((w) => w.word).join(" "), start: +at.toFixed(2) });
    return { timeline: { ...s.timeline, captions: caps } };
  });
}

export function removeCaption(id: string) {
  useEditor.setState((s) => ({ timeline: { ...s.timeline, captions: s.timeline.captions.filter((c) => c.id !== id) } }));
}

/**
 * כמה מילים בכל כתובית: מחלק מחדש את כל הכתוביות. מילים שנאמרו ברצף מתחברות,
 * ובהפסקה בדיבור (או בסוף משפט) מתחילה כתובית חדשה.
 */
export function rechunk(maxWords: number) {
  useEditor.setState((s) => {
    const caps = [...s.timeline.captions].sort((a, b) => a.start - b.start);
    if (!caps.length) return {};
    const words = caps.flatMap((c, ci) => {
      const ws = wordTimes(c.text, c.end - c.start);
      // first: המילה הראשונה בכתובית המקורית, ו-rest: כמה מילים יש בה
      return ws.map((w, wi) => ({ ...w, start: c.start + w.start, end: c.start + w.end, style: c, first: wi === 0 && ci > 0, size: ws.length }));
    });
    const out: Caption[] = [];
    let group: typeof words = [];
    const flush = () => {
      if (!group.length) return;
      const { id: _id, text: _t, start: _s, end: _e, ...style } = group[0].style;
      out.push({ ...style, id: uid("cap"), text: group.map((w) => w.word).join(" "), start: +group[0].start.toFixed(2), end: +group.at(-1)!.end.toFixed(2) });
      group = [];
    };
    for (const w of words) {
      const last = group.at(-1);
      // בגבול בין כתוביות מקוריות מתחילים חדשה אם הכתובית הבאה לא נכנסת בשלמותה (כדי לא לחבר סוף משפט לתחילת הבא)
      const boundary = w.first && maxWords - group.length < Math.min(w.size, maxWords);
      if (last && (group.length >= maxWords || boundary || w.start - last.end > 0.35 || /[.!?]$/.test(last.word))) flush();
      group.push(w);
    }
    flush();
    return { timeline: { ...s.timeline, captions: out } };
  });
}
