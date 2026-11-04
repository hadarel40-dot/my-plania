"use client";
import { useEditor } from "@/stores/editor-store";
import { usePlayback } from "@/stores/playback-store";
import type { ChatAction, ChatReply } from "@/lib/ai/edit-chat";
import type { MusicMood } from "@/lib/music/moods";
import { CLIP_STYLES, detectStyle } from "./clip-styles";
import { presetById } from "./overlay-presets";
import { layoutClips, uid, videoEnd, type SourceRange } from "./timeline-utils";
import { musicClip, currentStyle, T } from "./auto-edit";
import { rechunk, replaceEverywhere } from "./caption-edit";
import { currentAnimationLevel } from "./moments";

import {
  hasMusic, keepEndingAtEnd, makeShorter, moreEnergy, otherMusic, scaleSpeed, setAnimationLevel, setHookText, toggleCaptions, toggleMusic, canRestoreCaptions, currentHook,
} from "./quick-fixes";
import type { AnimationLevel, TransitionStyle } from "./types";
import { errorText, logEvent } from "@/lib/telemetry";

/** פותח כלי (מגירה בטלפון / לשונית במחשב). מאזינים ב-editor.tsx וב-side-panel.tsx */
export const OPEN_TOOL_EVENT = "editor:open-tool";
export type ToolName = "background" | "tricks" | "captions" | "music" | "text" | "media" | "smart";
export const openTool = (tool: ToolName) => window.dispatchEvent(new CustomEvent(OPEN_TOOL_EVENT, { detail: tool }));

/** תיאור הסרטון והמצב בעורך, בשביל העוזר */
export function chatContext(): string {
  const { timeline, assets, title, notes } = useEditor.getState();
  const caps = [...timeline.captions].sort((a, b) => a.start - b.start);
  const style = timeline.captionStyle ?? caps[0];
  const music = musicClip();
  const lines = [
    `Title: ${title || "-"}`,
    notes ? `Creator notes: ${notes}` : "",
    `Length: ${videoEnd(timeline.clips).toFixed(1)}s, ${timeline.clips.length} clips, aspect ${timeline.aspect}`,
    `Type: ${caps.length ? "talking (has speech captions)" : "vibe/no speech captions"}`,
    `Clip speed: ${[...new Set(timeline.clips.map((c) => c.speed ?? 1))].join(", ")}; color look: ${timeline.clips[0] ? detectStyle(timeline.clips[0].look).id : "-"}`,
    `Transitions: ${currentStyle()}; animations: ${currentAnimationLevel(timeline)}`,
    `Music: ${music ? `${assets[music.assetId]?.name ?? "song"} (volume ${music.volume ?? 1})` : "none"}`,
    `Opening line (hook): ${currentHook() ?? "none"}`,
    `Captions: ${caps.length ? `${caps.length}, style ${style?.preset}, text color ${style?.color ?? "#ffffff"}, highlight ${style?.accent ?? "#facc15"}, font ${style?.font ?? "default"}, size ${style?.size ?? 1}, position ${style?.y ?? 0.78}` : canRestoreCaptions() ? "hidden" : "none"}`,
    `Texts on screen: ${timeline.overlays.filter((o) => o.kind === "text").map((o) => `"${o.text}" ${o.start.toFixed(1)}-${o.end.toFixed(1)}s`).join("; ") || "none"}`,
    `Fonts: heebo rubik secular suez frank varela amatic karantina assistant fredoka playpen alef bellefair david miriam gveret bubbles glitch marker doodle`,
    caps.length ? `Transcript (timeline seconds):\n${caps.slice(0, 80).map((c) => `${c.start.toFixed(1)}: ${c.text}`).join("\n")}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

const LEVELS: TransitionStyle[] = ["none", "clean", "dynamic", "extreme"];

/** מבצע פעולה אחת. מחזיר משפט קצר על מה שנעשה (או null אם לא היה מה לעשות) */
async function run(a: ChatAction): Promise<string | null> {
  const st = useEditor.getState();
  const now = usePlayback.getState().currentTime;
  switch (a.type) {
    case "shorter": {
      if (a.value && a.value > 2) {
        const cur = videoEnd(st.timeline.clips);
        if (a.value < cur) {
          const factor = Math.min(2, cur / a.value);
          if (st.timeline.captions.length || st.timeline.clips.length < 4) {
            if (scaleSpeed(factor)) { keepEndingAtEnd(); return `קוצר ל-${Math.round(videoEnd(useEditor.getState().timeline.clips))} שניות`; }
          }
        }
      }
      return makeShorter();
    }
    case "more_energy": return moreEnergy();
    case "calmer": {
      const level = Math.max(0, LEVELS.indexOf(currentStyle()) - 1);
      st.setTransitionStyle(LEVELS[level]);
      for (const [k, c] of useEditor.getState().timeline.clips.entries()) {
        useEditor.getState().setClipLook(c.id, { ...c.look, zoom: 1 });
        if (k > 0) useEditor.getState().updateClip(c.id, { transitionIn: level > 0 ? T("fade", 0.35) : undefined });
      }
      return "רגוע יותר: מעברים רכים, בלי זומים";
    }
    case "transitions": {
      const lvl = (LEVELS as string[]).includes(a.level ?? "") ? (a.level as TransitionStyle) : "clean";
      st.setTransitionStyle(lvl);
      return `מעברים: ${({ none: "בלי", clean: "נקיים", dynamic: "דינמיים", extreme: "מוגזמים" } as const)[lvl]}`;
    }
    case "music_change": return hasMusic() ? otherMusic(a.mood as MusicMood | undefined) : toggleMusic(a.mood as MusicMood | undefined);
    case "music_off": return hasMusic() ? toggleMusic() : null;
    case "music_on": return hasMusic() ? null : toggleMusic(a.mood as MusicMood | undefined);
    case "music_volume": {
      const m = musicClip();
      if (!m || a.value === undefined) return null;
      const v = Math.min(1, Math.max(0, a.value));
      st.updateAudioClip(m.id, { volume: v });
      return `עוצמת המוזיקה: ${Math.round(v * 100)}%`;
    }
    case "captions_hide": return st.timeline.captions.length ? toggleCaptions() : null;
    case "captions_show": return !st.timeline.captions.length && canRestoreCaptions() ? toggleCaptions() : null;
    case "captions_create": {
      if (st.timeline.captions.length) return null;
      const n = await st.autoTranscribe();
      return n ? `נוצרו ${n} כתוביות` : "לא נמצא דיבור לכתוביות";
    }
    case "captions_style": if (!a.preset) return null; st.styleAllCaptions({ preset: a.preset }); return "סגנון הכתוביות הוחלף";
    case "captions_color": if (!a.color) return null; st.styleAllCaptions({ color: a.color }); return "צבע הכתוביות הוחלף";
    case "captions_highlight": if (!a.color) return null; st.styleAllCaptions({ accent: a.color }); return "צבע ההדגשה הוחלף";
    case "captions_font": if (!a.font) return null; st.styleAllCaptions({ font: a.font }); return "הגופן הוחלף";
    case "captions_size": if (!a.value) return null; st.styleAllCaptions({ size: Math.min(1.8, Math.max(0.6, a.value)) }); return "גודל הכתוביות שונה";
    case "captions_position": if (a.value === undefined) return null; st.styleAllCaptions({ y: Math.min(0.9, Math.max(0.1, a.value)) }); return "מיקום הכתוביות שונה";
    case "captions_words": if (!a.value) return null; rechunk(Math.min(4, Math.max(1, Math.round(a.value)))); return `עד ${Math.round(a.value)} מילים בכל כתובית`;
    case "replace_word": {
      if (!a.from || !a.to) return null;
      const n = replaceEverywhere(a.from, a.to, true);
      return n ? `"${a.from}" הוחלף ב"${a.to}" (${n})` : `לא נמצא "${a.from}"`;
    }
    case "set_hook": if (!a.text?.trim()) return null; setHookText(a.text.trim()); return "משפט הפתיחה עודכן";
    case "add_text": {
      if (!a.text?.trim()) return null;
      const start = a.start ?? now;
      const preset = presetById("title-pop");
      const end = a.end && a.end > start ? a.end : start + preset.duration;
      useEditor.setState((s) => ({ timeline: { ...s.timeline, overlays: [...s.timeline.overlays, { ...preset.fields, id: uid("ovl"), text: a.text!.trim(), start: +start.toFixed(2), end: +end.toFixed(2) }] } }));
      return "נוסף טקסט";
    }
    case "animations": {
      const lvl: AnimationLevel = a.level === "none" || a.level === "lots" ? a.level : "some";
      setAnimationLevel(lvl);
      return lvl === "none" ? "בלי אנימציות" : lvl === "lots" ? "הרבה אנימציות" : "אנימציות ברגעים החשובים";
    }
    case "filter": {
      const style = CLIP_STYLES.find((x) => x.id === a.filter);
      if (!style) return null;
      for (const c of useEditor.getState().timeline.clips) useEditor.getState().setClipLook(c.id, { ...c.look, filter: style.look(0.7).filter });
      return `גוון: ${style.label}`;
    }
    case "speed": {
      if (!a.value) return null;
      const cur = st.timeline.clips[0]?.speed ?? 1;
      return scaleSpeed(Math.min(3, Math.max(0.25, a.value)) / cur) ? `מהירות x${a.value}` : null;
    }
    case "cut_range": {
      if (a.start === undefined || a.end === undefined || a.end <= a.start) return null;
      const plan = new Map<string, SourceRange[]>();
      for (const { clip, start, end } of layoutClips(st.timeline.clips)) {
        if (a.end <= start || a.start >= end || clip.freeze) continue;
        const sp = clip.speed ?? 1;
        const src = (t: number) => clip.in + (Math.min(end, Math.max(start, t)) - start) * sp;
        const keep: SourceRange[] = [];
        if (a.start > start) keep.push({ start: clip.in, end: src(a.start) });
        if (a.end < end) keep.push({ start: src(a.end), end: clip.out });
        plan.set(clip.id, keep);
      }
      if (!plan.size) return null;
      st.applyCuts(plan);
      keepEndingAtEnd();
      return `נחתך הקטע ${a.start.toFixed(1)}-${a.end.toFixed(1)} שנ׳`;
    }
    case "freeze": st.freezeFrame(a.start ?? now); useEditor.setState({ selection: null }); return "נוספה הקפאת תמונה";
    case "aspect": if (!a.aspect) return null; st.setAspect(a.aspect); return `יחס ${a.aspect}`;
    case "reedit": {
      if (a.text) st.setNotes([st.notes, a.text].filter(Boolean).join("\n"));
      const { runAutoEdit } = await import("@/components/editor/smart-tab");
      openTool("smart");
      void runAutoEdit();
      return "מתחילה עריכה אוטומטית חדשה לפי הבקשה";
    }
    case "open_tool": {
      const t = (["background", "tricks", "captions", "music", "text", "media", "smart"] as ToolName[]).find((x) => x === a.text);
      if (t) openTool(t);
      return null;
    }
  }
  return null;
}

/** מבצע את כל הפעולות לפי הסדר; פעולה שנכשלה לא עוצרת את השאר */
export async function runActions(actions: ChatAction[]): Promise<string[]> {
  const done: string[] = [];
  for (const a of actions) {
    try {
      const msg = await run(a);
      if (msg) done.push(msg);
    } catch (e) {
      logEvent("chat_action_failed", { type: a.type, error: errorText(e) });
    }
  }
  return done;
}

/**
 * בלי מוח מחובר (או כשהוא לא עונה): מבינים בקשות פשוטות לפי מילים.
 */
export function localReply(message: string): ChatReply {
  const m = message;
  const actions: ChatAction[] = [];
  if (/קצר|ארוך מדי|לקצר/.test(m)) actions.push({ type: "shorter" });
  if (/אנרגטי|דינמי|קצבי|יותר אקשן/.test(m)) actions.push({ type: "more_energy" });
  if (/רגוע|עדין|פחות מעברים/.test(m)) actions.push({ type: "calmer" });
  if (/בלי מוזיקה|תוריד.{0,4}מוזיקה|להוריד.{0,4}מוזיקה/.test(m)) actions.push({ type: "music_off" });
  else if (/מוזיקה|שיר/.test(m)) actions.push({ type: "music_change" });
  if (/בלי כתוביות|להסתיר.{0,4}כתוביות|תוריד.{0,4}כתוביות/.test(m)) actions.push({ type: "captions_hide" });
  else if (/כתוביות/.test(m) && !useEditor.getState().timeline.captions.length) actions.push({ type: "captions_create" });
  const colors: [RegExp, string][] = [[/צהוב/, "#facc15"], [/ורוד/, "#f472b6"], [/אדום/, "#ef4444"], [/ירוק/, "#22c55e"], [/כחול/, "#3b82f6"], [/סגול/, "#a78bfa"], [/כתום/, "#fb923c"], [/לבן/, "#ffffff"]];
  const color = colors.find(([r]) => r.test(m))?.[1];
  if (color && /הדגש/.test(m)) actions.push({ type: "captions_highlight", color });
  else if (color && /כתובי|טקסט/.test(m)) actions.push({ type: "captions_color", color });
  if (/גדול/.test(m) && /כתובי/.test(m)) actions.push({ type: "captions_size", value: 1.3 });
  if (/קטן/.test(m) && /כתובי/.test(m)) actions.push({ type: "captions_size", value: 0.8 });
  if (/באמצע/.test(m) && /כתובי/.test(m)) actions.push({ type: "captions_position", value: 0.5 });
  if (/רקע/.test(m)) actions.push({ type: "open_tool", text: "background" });
  if (/תאומים|מפוצל|שכבה|אוברליי|חלון/.test(m)) actions.push({ type: "open_tool", text: "tricks" });
  if (/שחור.?לבן/.test(m)) actions.push({ type: "filter", filter: "bw" });
  else if (/חמים|חם/.test(m)) actions.push({ type: "filter", filter: "warm" });
  else if (/קולנוע/.test(m)) actions.push({ type: "filter", filter: "cinematic" });
  if (/אנימצי/.test(m)) actions.push({ type: "animations", level: /בלי/.test(m) ? "none" : "lots" });
  return actions.length
    ? { reply: "בוצע 👌", actions }
    : { reply: `לא הבנתי עד הסוף. אפשר לנסות במילים אחרות, למשל "יותר קצר", "מוזיקה אחרת", "כתוביות בצהוב"${useEditor.getState().cloud?.brain ? "" : " (עם Gemini מחובר העוזר מבין הכל)"}.`, actions: [] };
}
