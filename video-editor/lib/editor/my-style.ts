"use client";
import type { CaptionPreset, TransitionStyle } from "./types";
import type { VideoGenre } from "./genres";

/**
 * "הסגנון שלי": העורך זוכר מה בוחרים בדרך כלל (גופן וסגנון כתוביות, מעברים,
 * איזו גרסה), ומהעריכה הבאה הוא מתחיל משם. נשמר בדפדפן של הטלפון.
 */
export interface MyStyle {
  genre?: VideoGenre;
  transitionStyle?: TransitionStyle;
  captionPreset?: CaptionPreset;
  captionFont?: string;
  accent?: string;
  /** כמה פעמים נבחרה כל גרסה (לפי סוג: talk-0, vibe-1...) */
  picks?: Record<string, number>;
}

const KEY = "ai-video-editor:my-style:v1";

export function loadMyStyle(): MyStyle {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as MyStyle;
  } catch {
    return {};
  }
}

export function rememberStyle(patch: Partial<MyStyle>) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...loadMyStyle(), ...patch }));
  } catch { /* מצב פרטי: פשוט לא זוכרים */ }
}

export function rememberPick(optionId: string) {
  const s = loadMyStyle();
  rememberStyle({ picks: { ...s.picks, [optionId]: (s.picks?.[optionId] ?? 0) + 1 } });
}

export function forgetMyStyle() {
  try { localStorage.removeItem(KEY); } catch { /* */ }
}

/** מספר הגרסה שנבחרה הכי הרבה מבין אלה שמתחילות ב-prefix (לפחות פעמיים), אם יש */
export function favoritePick(prefix: "vibe"): number | null {
  const picks = Object.entries(loadMyStyle().picks ?? {}).filter(([k]) => k.startsWith(prefix + "-"));
  const [best] = picks.sort((a, b) => b[1] - a[1]);
  return best && best[1] >= 2 ? Number(best[0].split("-")[1]) : null;
}

export const hasMyCaptionStyle = (s: MyStyle) => !!(s.captionPreset && s.captionFont);
