"use client";
import { useEditor } from "@/stores/editor-store";
import type { MusicMood } from "@/lib/music/moods";
import { autoStrength, CLIP_STYLES, detectStyle } from "./clip-styles";
import { loadMyStyle, rememberStyle } from "./my-style";
import { currentAnimationLevel } from "./moments";
import { uid } from "./timeline-utils";
import type { AnimationLevel, CaptionPreset, TransitionStyle, TransitionType } from "./types";

/**
 * ספריית סגנונות: כל סגנון הוא "מתכון" שלם לסרטון (כתוביות, גופן, צבעים, גוון, זום,
 * מעברים, אנימציות, מוזיקה וקצב). בוחרים סגנון, והעריכה האוטומטית בונה איתו את הגרסה
 * הראשונה; או מחילים אותו על הסרטון הנוכחי בלחיצה. כל שינוי שאהבתם נשמר כסגנון משלכם.
 */
export interface EditStyle {
  id: string;
  name: string;
  emoji: string;
  description: string;
  builtin?: boolean;
  preset: CaptionPreset;
  font: string;
  /** צבע ההדגשה של המילה הנאמרת */
  accent: string;
  /** צבע הטקסט (ברירת מחדל לבן) */
  textColor?: string;
  /** גוון התמונה (מזהה מ-clip-styles) */
  color: string;
  /** תבנית הטקסטים (הוק וקריאה לפעולה) */
  template: "talking" | "tips" | "energy" | "before-after";
  /** זום לסירוגין בכל חיתוך */
  punchZoom: boolean;
  /** מעבר בכל חיתוך (בדיבור) */
  cut: TransitionType | null;
  transitions: TransitionStyle;
  animation: AnimationLevel;
  /** מצב רוח של המוזיקה (null: העורך בוחר לפי התוכן) */
  mood: MusicMood | null;
  /** אורך קטע בסרטון אווירה, בשניות */
  pace: [number, number];
}

export const BUILTIN_STYLES: EditStyle[] = [
  { id: "bw-poster", name: "שחור-לבן פוסטר", emoji: "🖤", description: "נקי וחד, כמו פוסטר שזז", builtin: true,
    preset: "bold-pop", font: "secular", accent: "#ffffff", textColor: "#ffffff", color: "bw", template: "talking",
    punchZoom: true, cut: null, transitions: "clean", animation: "some", mood: "cinematic", pace: [1.4, 2.6] },
  { id: "pink-energy", name: "אנרגטי ורוד", emoji: "💗", description: "מילה גדולה, פאנץ' בכל חיתוך", builtin: true,
    preset: "one-word", font: "karantina", accent: "#f472b6", color: "vivid", template: "energy",
    punchZoom: true, cut: "punch", transitions: "dynamic", animation: "lots", mood: "energetic", pace: [0.7, 1.3] },
  { id: "classic-yellow", name: "קלאסי צהוב", emoji: "💛", description: "מילה קופצת בצהוב, הכי ויראלי", builtin: true,
    preset: "word-pop", font: "secular", accent: "#facc15", color: "vivid", template: "talking",
    punchZoom: true, cut: null, transitions: "clean", animation: "some", mood: "pop", pace: [1.2, 2.2] },
  { id: "clean-minimal", name: "נקי ומינימליסטי", emoji: "🤍", description: "בלי רעש: כתוביות עדינות, גוון חם", builtin: true,
    preset: "minimal", font: "assistant", accent: "#ffffff", color: "warm", template: "tips",
    punchZoom: false, cut: null, transitions: "clean", animation: "none", mood: "chill", pace: [2, 3.2] },
  { id: "cinematic-calm", name: "קולנועי רגוע", emoji: "🎬", description: "קריוקי בזהב, קטעים ארוכים", builtin: true,
    preset: "karaoke", font: "frank", accent: "#fbbf24", color: "cinematic", template: "before-after",
    punchZoom: false, cut: null, transitions: "clean", animation: "some", mood: "romantic", pace: [2.2, 3.4] },
  { id: "neon-night", name: "ניאון לילה", emoji: "💙", description: "ניאון תכלת, גוון קר, מעברים חדים", builtin: true,
    preset: "neon", font: "rubik", accent: "#22d3ee", color: "cold", template: "energy",
    punchZoom: true, cut: "flash", transitions: "dynamic", animation: "lots", mood: "hiphop", pace: [0.9, 1.6] },
];

export const myStyles = (): EditStyle[] => loadMyStyle().styles ?? [];
export const allStyles = (): EditStyle[] => [...myStyles(), ...BUILTIN_STYLES];
export const activeStyle = (): EditStyle | null => allStyles().find((s) => s.id === loadMyStyle().activeStyle) ?? null;
export const setActiveStyle = (id: string | null) => rememberStyle({ activeStyle: id });

/** שומר את הסגנון של הסרטון שפתוח עכשיו כסגנון חדש בספרייה שלי */
export function saveCurrentAsStyle(name: string): EditStyle {
  const { timeline } = useEditor.getState();
  const cs = timeline.captionStyle ?? timeline.captions[0];
  const clips = timeline.clips;
  const base = activeStyle() ?? BUILTIN_STYLES[2];
  const style: EditStyle = {
    ...base,
    id: uid("style"), name: name.trim() || "הסגנון שלי", emoji: "⭐", description: "נשמר מסרטון שערכתי", builtin: false,
    preset: cs?.preset ?? base.preset, font: cs?.font ?? base.font, accent: cs?.accent ?? base.accent, textColor: cs?.color,
    color: clips[0] ? (detectStyle(clips[0].look).id === "custom" ? base.color : detectStyle(clips[0].look).id) : base.color,
    punchZoom: clips.some((c) => c.look.zoom > 1.04),
    cut: clips.slice(1).find((c) => c.transitionIn)?.transitionIn?.type ?? null,
    transitions: timeline.transitionStyle ?? base.transitions,
    animation: currentAnimationLevel(timeline),
  };
  rememberStyle({ styles: [style, ...myStyles()].slice(0, 30), activeStyle: style.id });
  return style;
}

export function deleteMyStyle(id: string) {
  const s = loadMyStyle();
  rememberStyle({ styles: (s.styles ?? []).filter((x) => x.id !== id), activeStyle: s.activeStyle === id ? null : s.activeStyle });
}

/** מחיל סגנון על הסרטון הנוכחי (כתוביות, גוון, זום, מעברים, אנימציות ומוזיקה) */
export async function applyStyleNow(style: EditStyle): Promise<string> {
  const st = useEditor.getState();
  if (st.timeline.captions.length) st.styleAllCaptions({ preset: style.preset, font: style.font, accent: style.accent, color: style.textColor ?? "#ffffff" });
  const filter = CLIP_STYLES.find((c) => c.id === style.color);
  st.setTransitionStyle(style.transitions);
  useEditor.getState().timeline.clips.forEach((clip, k) => {
    useEditor.getState().setClipLook(clip.id, { ...clip.look, filter: filter ? filter.look(autoStrength(filter.id)).filter : clip.look.filter, zoom: style.punchZoom && k % 2 ? 1.12 : 1 });
    if (k > 0) useEditor.getState().updateClip(clip.id, { transitionIn: style.cut ? { type: style.cut, duration: 0.22 } : style.transitions === "none" ? undefined : { type: "fade", duration: 0.25 } });
  });
  const { setAnimationLevel, hasMusic, otherMusic } = await import("./quick-fixes");
  setAnimationLevel(style.animation);
  if (style.mood && hasMusic()) await otherMusic(style.mood).catch(() => undefined);
  return `הסגנון "${style.name}" הוחל`;
}
