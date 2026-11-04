"use client";
import { useEditor } from "@/stores/editor-store";
import { searchLibrary, addLibraryTrack, addBuiltinTrack, markLastAudioAuto } from "@/lib/music/add";
import { BUILTIN_TRACKS } from "@/lib/music/builtin";
import { MUSIC_MOODS, type MusicMood } from "@/lib/music/moods";
import { errorText, logEvent } from "@/lib/telemetry";
import { MOTION_BY_STYLE, T, applyMotion, currentStyle, musicClip, syncToBeat } from "./auto-edit";
import { layoutClips, uid, videoEnd, type SourceRange } from "./timeline-utils";
import type { AnimationLevel, Caption, Overlay, TransitionStyle } from "./types";
import { applyMoments, currentAnimationLevel } from "./moments";
import { rememberStyle } from "./my-style";

/**
 * תיקונים בלחיצה מתחת לגרסאות: כל אחד משנה דבר אחד בסרטון שמוצג, בלי לגעת בשאר.
 * כל תיקון מחזיר משפט קצר שמוצג אחרי הלחיצה.
 */

const isTalking = () => useEditor.getState().timeline.captions.length > 0;

/** יותר קצר: בסרטון דיבור מאיצים קצת (כמו 1.15x ברילס); בסרטון אווירה מורידים קטעים */
export async function makeShorter(): Promise<string> {
  const { timeline } = useEditor.getState();
  const before = videoEnd(timeline.clips);
  if (isTalking() || timeline.clips.length < 4) {
    const factor = 1.15;
    const old = layoutClips(timeline.clips);
    if (old.some(({ clip }) => (clip.speed ?? 1) * factor > 2)) return "הסרטון כבר מהיר מאוד, אי אפשר לקצר יותר בלי לאבד את הדיבור";
    useEditor.setState((s) => {
      const clips = s.timeline.clips.map((c) => ({ ...c, speed: +((c.speed ?? 1) * factor).toFixed(3) }));
      const next = layoutClips(clips);
      const mapTime = (t: number) => {
        const k = old.findIndex((l) => t < l.end);
        if (k < 0) return t - before + videoEnd(clips);
        return next[k].start + Math.max(0, t - old[k].start) / factor;
      };
      const remap = <X extends { start: number; end: number }>(items: X[]) =>
        items.map((it) => ({ ...it, start: +mapTime(it.start).toFixed(2), end: +Math.max(mapTime(it.end), mapTime(it.start) + 0.2).toFixed(2) }));
      return { timeline: { ...s.timeline, clips, captions: remap(s.timeline.captions), overlays: remap(s.timeline.overlays) } };
    });
  } else {
    // מורידים בערך שליש מהקטעים, בפיזור, ושומרים על הראשון והאחרון
    const ids = timeline.clips.map((c) => c.id);
    const drop = Math.max(1, Math.round(ids.length * 0.3));
    const removable = ids.slice(1, -1);
    const plan = new Map<string, SourceRange[]>();
    const picks = new Set(Array.from({ length: Math.min(drop, removable.length) }, (_, k) => Math.floor(((k + 0.5) * removable.length) / drop)));
    for (const k of picks) plan.set(removable[k], []);
    useEditor.getState().applyCuts(plan);
    if (musicClip()) await syncToBeat(() => undefined).catch(() => undefined);
  }
  keepEndingAtEnd();
  // האנימציות נבנות מחדש לפי הזמנים החדשים של הכתוביות
  if (useEditor.getState().timeline.moments?.length) applyMoments();
  const after = videoEnd(useEditor.getState().timeline.clips);
  return `קוצר מ-${Math.round(before)} ל-${Math.round(after)} שניות`;
}

/** הקריאה לפעולה תמיד בשלוש השניות האחרונות, גם אחרי קיצור */
function keepEndingAtEnd() {
  const end = videoEnd(useEditor.getState().timeline.clips);
  useEditor.setState((s) => ({
    timeline: {
      ...s.timeline,
      overlays: s.timeline.overlays
        .map((o) => (o.fromTemplate && o.end > end - 0.5 && o.start > 1 ? { ...o, start: Math.max(0, end - 3), end } : o))
        .filter((o) => o.start < end),
    },
  }));
}

const LEVELS: TransitionStyle[] = ["none", "clean", "dynamic", "extreme"];

/** יותר אנרגטי: מעברים ותנועה ברמה אחת מעל, וזום לסירוגין בדיבור */
export function moreEnergy(): string {
  const level = LEVELS.indexOf(currentStyle());
  const next = LEVELS[Math.min(LEVELS.length - 1, level + 1)];
  useEditor.getState().setTransitionStyle(next);
  const { updateClip, setClipLook } = useEditor.getState();
  if (isTalking()) {
    // בדיבור: זום לסירוגין בכל חיתוך, ופאנץ'/הבזק במעברים
    useEditor.getState().timeline.clips.forEach((clip, k) => {
      setClipLook(clip.id, { ...clip.look, zoom: k % 2 ? 1.14 : 1 });
      if (k > 0 && next !== "clean") updateClip(clip.id, { transitionIn: k % 2 ? T("flash", 0.2) : T("punch", 0.25) });
    });
  } else {
    applyMotion(MOTION_BY_STYLE[next][1]);
  }
  const names: Record<TransitionStyle, string> = { none: "בלי", clean: "נקיים", dynamic: "דינמיים", extreme: "מוגזמים" };
  return level === LEVELS.length - 1 ? "כבר ברמה הכי אנרגטית. הוספנו עוד תנועה" : `המעברים עכשיו ${names[next]}`;
}

const MOOD_CYCLE: MusicMood[] = ["energetic", "happy", "pop", "chill", "cinematic", "hiphop", "romantic", "acoustic", "inspiring"];
let moodTurn = 0;

/** מוזיקה אחרת: מחליף את השיר בשיר אחר (מהספרייה הגדולה, ואם לא זמינה, מהמובנים) */
export async function otherMusic(): Promise<string> {
  const old = musicClip();
  const oldAsset = old ? useEditor.getState().assets[old.assetId] : null;
  const volume = old?.volume;
  // מסירים את השיר הקודם
  if (old) useEditor.setState((s) => ({ timeline: { ...s.timeline, audio: s.timeline.audio.filter((a) => a.id !== old.id) } }));
  const mood = MOOD_CYCLE[moodTurn++ % MOOD_CYCLE.length];
  let name = "";
  try {
    const tracks = await searchLibrary(MUSIC_MOODS[mood], { timeoutMs: 4000 });
    const fresh = tracks.filter((t) => !oldAsset?.name.startsWith(t.title));
    const track = fresh[Math.floor(Math.random() * Math.min(5, fresh.length))];
    if (!track) throw new Error("לא נמצא שיר");
    await addLibraryTrack(track, { select: false });
    name = track.title;
  } catch (e) {
    logEvent("quick_music_fallback", { mood, error: errorText(e) });
    const options = BUILTIN_TRACKS.filter((t) => oldAsset?.remoteUrl !== `/music/${t.id}.mp3`);
    const builtin = options[moodTurn % options.length];
    addBuiltinTrack(builtin, { select: false });
    name = builtin.title;
  }
  markLastAudioAuto();
  const added = musicClip();
  if (added && volume !== undefined) useEditor.getState().updateAudioClip(added.id, { volume });
  // בסרטון אווירה החיתוכים זזים לקצב של השיר החדש
  if (!isTalking() && useEditor.getState().timeline.clips.length > 1) await syncToBeat(() => undefined).catch(() => undefined);
  return `שיר חדש: ${name}`;
}

/** הכתוביות שהוסתרו, כדי להחזיר אותן בלחיצה */
let hiddenCaptions: Caption[] = [];

export function toggleCaptions(): string {
  const { timeline } = useEditor.getState();
  if (timeline.captions.length) {
    hiddenCaptions = timeline.captions;
    useEditor.setState((s) => ({ timeline: { ...s.timeline, captions: [] } }));
    return "הכתוביות הוסתרו";
  }
  useEditor.setState((s) => ({ timeline: { ...s.timeline, captions: hiddenCaptions } }));
  hiddenCaptions = [];
  return "הכתוביות חזרו";
}

export const canRestoreCaptions = () => hiddenCaptions.length > 0;

/** מחליף את משפט הפתיחה (או מוסיף אותו, אם אין) */
export function setHookText(text: string) {
  useEditor.setState((s) => {
    const overlays = s.timeline.overlays;
    const i = overlays.findIndex((o) => o.hook) >= 0
      ? overlays.findIndex((o) => o.hook)
      : overlays.findIndex((o) => o.fromTemplate && o.kind === "text" && o.start < 1);
    if (i >= 0) {
      const next = [...overlays];
      next[i] = { ...next[i], text, hook: true };
      return { timeline: { ...s.timeline, overlays: next } };
    }
    const hook: Overlay = {
      id: uid("ovl"), kind: "text", text, start: 0.2, end: 3.2, x: 0.5, y: 0.18, size: 76, color: "#ffffff",
      background: null, stroke: true, weight: 900, rotate: 0, animIn: "pop", loop: "none", animOut: "fade",
      fromTemplate: true, hook: true,
    };
    return { timeline: { ...s.timeline, overlays: [...overlays, hook] } };
  });
}

export const currentHook = () => useEditor.getState().timeline.overlays.find((o) => o.hook)?.text ?? null;

const NEXT_LEVEL: Record<AnimationLevel, AnimationLevel> = { none: "some", some: "lots", lots: "none" };
export const ANIMATION_LABELS: Record<AnimationLevel, string> = { none: "בלי", some: "מעט", lots: "הרבה" };

/** כמות האנימציות ברגעים החשובים: בלי → מעט → הרבה */
export function cycleAnimations(): string {
  const next = NEXT_LEVEL[currentAnimationLevel(useEditor.getState().timeline)];
  setAnimationLevel(next);
  return next === "none" ? "בלי אנימציות" : `אנימציות: ${ANIMATION_LABELS[next]}`;
}

export function setAnimationLevel(level: AnimationLevel) {
  rememberStyle({ animationLevel: level });
  if (useEditor.getState().timeline.moments?.length) applyMoments(level);
  else useEditor.setState((s) => ({ timeline: { ...s.timeline, animationLevel: level } }));
}

export const hasMoments = () => !!useEditor.getState().timeline.moments?.length;

/** בלי מוזיקה: מוריד את השיר ומחזיר את הסאונד המקורי של הסרטונים. ועם: מוסיף שיר */
export async function toggleMusic(): Promise<string> {
  const music = musicClip();
  const talking = isTalking();
  if (music) {
    useEditor.setState((s) => ({
      timeline: {
        ...s.timeline,
        audio: s.timeline.audio.filter((a) => a.id !== music.id),
        clips: s.timeline.clips.map((c) => ({ ...c, volume: 1 })),
      },
    }));
    return "המוזיקה הוסרה, והסאונד המקורי חזר. אפשר להוסיף מוזיקה אחר כך, גם באינסטגרם";
  }
  const msg = await otherMusic();
  // בסרטון אווירה השיר מחליף את הסאונד המקורי; בדיבור הדיבור נשאר והשיר שקט מתחתיו
  const added = musicClip();
  if (added && talking) useEditor.getState().updateAudioClip(added.id, { volume: 0.15 });
  if (!talking) useEditor.setState((s) => ({ timeline: { ...s.timeline, clips: s.timeline.clips.map((c) => ({ ...c, volume: 0 })) } }));
  return msg;
}

export const hasMusic = () => !!musicClip();
