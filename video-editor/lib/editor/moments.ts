"use client";
import { useEditor } from "@/stores/editor-store";
import { presetById } from "./overlay-presets";
import { sfxAsset, type SfxId } from "./sfx";
import { uid, videoEnd } from "./timeline-utils";
import type { AnimationLevel, AudioClip, Caption, MediaAsset, Moment, Overlay, Timeline } from "./types";
import { emojiOverlays } from "./emoji-keywords";

/**
 * אנימציות ברגעים החשובים בדיבור, כמו שעורך אנושי עושה בסרטוני הסבר:
 * מילת מפתח קופצת, מספר גדול, "טיפ 2" כשעוברים לשלב הבא, אימוג'י ברגע של רגש,
 * צליל קטן, וזום קצר לפנים. הרגעים עצמם נבחרים פעם אחת (בעיקר על ידי Gemini),
 * והכמות שמוצגת נקבעת לפי הבחירה: בלי / מעט / הרבה.
 */

const LEVEL: Record<Exclude<AnimationLevel, "none">, { gap: number; perSec: number; minImportance: number }> = {
  some: { gap: 4, perSec: 1 / 6, minImportance: 2 },
  lots: { gap: 1.8, perSec: 1 / 2.5, minImportance: 1 },
};

export const currentAnimationLevel = (t: Timeline): AnimationLevel => t.animationLevel ?? "some";

/**
 * בונה מחדש את האנימציות בציר הזמן הנוכחי לפי הרגעים השמורים והכמות. מוחק קודם
 * את האנימציות הקודמות של הרגעים (לא נוגע בטקסטים שהוספתם בעצמכם).
 */
export function applyMoments(level: AnimationLevel = currentAnimationLevel(useEditor.getState().timeline), accent?: string) {
  useEditor.setState((s) => {
    const tl = s.timeline;
    const overlays = tl.overlays.filter((o) => !o.moment);
    const audio = tl.audio.filter((a) => !a.moment);
    const base = { ...tl, animationLevel: level, overlays, audio, zooms: [] as NonNullable<Timeline["zooms"]> };
    if (level === "none" || !tl.moments?.length) return { timeline: base };

    const { gap, perSec, minImportance } = LEVEL[level];
    const end = videoEnd(tl.clips);
    const caps = new Map(tl.captions.map((c) => [c.id, c]));
    const color = accent ?? tl.captionStyle?.accent ?? "#facc15";
    const font = tl.captionStyle?.font;
    // הכי חשובים קודם, ובלי להתנגש עם ההוק (בהתחלה) והקריאה לפעולה (בסוף)
    const candidates = tl.moments
      .map((m) => ({ m, cap: caps.get(m.captionId) }))
      .filter((x): x is { m: Moment; cap: Caption } => !!x.cap && x.cap.start > 2.6 && x.cap.start < end - 3 && x.m.importance >= minImportance)
      .sort((a, b) => b.m.importance - a.m.importance || a.cap.start - b.cap.start);
    const max = Math.max(1, Math.round(end * perSec));
    const chosen: { m: Moment; cap: Caption }[] = [];
    for (const c of candidates) {
      if (chosen.length >= max) break;
      if (chosen.some((x) => Math.abs(x.cap.start - c.cap.start) < gap)) continue;
      chosen.push(c);
    }
    chosen.sort((a, b) => a.cap.start - b.cap.start);

    const assets: Record<string, MediaAsset> = { ...s.assets };
    const sfx = (id: SfxId, at: number, volume = 0.7): AudioClip => {
      const a = sfxAsset(id);
      assets[a.id] ??= a;
      return { id: uid("aud"), assetId: a.id, start: Math.max(0, at - 0.03), in: 0, out: a.duration, volume, fadeIn: 0, fadeOut: 0, moment: true };
    };
    let side = 0;
    const newOverlays: Overlay[] = [];
    const newAudio: AudioClip[] = [];
    const zooms: NonNullable<Timeline["zooms"]> = [];
    for (const { m, cap } of chosen) {
      const start = cap.start;
      const stay = Math.min(2.4, Math.max(1.3, cap.end - cap.start + 0.5));
      const common = { id: uid("ovl"), start, end: start + stay, fromTemplate: true, moment: true };
      if (m.kind === "keyword") {
        newOverlays.push({ ...presetById("title-pop").fields, ...common, text: m.text, size: m.text.length > 12 ? 92 : 116, color, font, y: 0.24, animIn: "pop", loop: "pulse", animOut: "pop" });
        newAudio.push(sfx("pop", start));
        if (m.importance >= 2) zooms.push({ start, end: Math.min(cap.end + 0.4, start + 1.6), scale: 1.12 });
      } else if (m.kind === "number") {
        newOverlays.push({ ...presetById("title-bounce").fields, ...common, text: m.text, size: 170, color, font, y: 0.26, animIn: "bounce", loop: "none", animOut: "pop" });
        newAudio.push(sfx("ding", start, 0.45));
        zooms.push({ start, end: Math.min(cap.end + 0.4, start + 1.6), scale: 1.15 });
      } else if (m.kind === "step") {
        newOverlays.push({ ...presetById("label-slide").fields, ...common, end: start + 2.6, text: m.text, size: 72, background: color, color: "#111111", stroke: false, font, y: 0.17, animIn: "slide-side", animOut: "fade" });
        newAudio.push(sfx("whoosh", start, 0.5));
      } else {
        const x = side++ % 2 ? 0.22 : 0.78;
        newOverlays.push({ ...presetById("emoji-fire").fields, ...common, text: m.text, x, y: 0.3, size: 200, animIn: "bounce", loop: "wiggle", animOut: "pop" });
        newAudio.push(sfx("pop", start, 0.5));
      }
    }
    return { assets, timeline: { ...base, overlays: [...overlays, ...newOverlays], audio: [...audio, ...newAudio], zooms } };
  });
}

const NUMBER_WORD = /^(ה|ו|ב|ל)?(\d[\d,.]*%?|₪\d+|אחד|אחת|שניים|שתיים|שלוש|שלושה|ארבע|ארבעה|חמש|חמישה|עשר|עשרה|מאה|אלף|מיליון|חצי|פי)$/;
const STEP_WORD = /^(ה|ו)?(ראשון|ראשונה|שני|שנייה|שלישי|שלישית|רביעי|רביעית|אחרון|אחרונה|טיפ|שלב|דבר)$/;

/** בלי מוח מחובר: רגעים לפי המילים בכתוביות (מספרים, שלבים, ומילים רגשיות לאימוג'י) */
export function guessMoments(captions: Caption[]): Moment[] {
  const out: Moment[] = [];
  let step = 0;
  for (const cap of captions) {
    const words = cap.text.split(/\s+/);
    const num = words.findIndex((w) => NUMBER_WORD.test(w));
    if (words.some((w) => STEP_WORD.test(w))) {
      step++;
      out.push({ captionId: cap.id, kind: "step", text: `טיפ ${step}`, importance: 2 });
    } else if (num >= 0) {
      out.push({ captionId: cap.id, kind: "number", text: words.slice(num, num + 2).join(" "), importance: 2 });
    }
  }
  for (const o of emojiOverlays(captions, 8)) {
    const cap = captions.find((c) => Math.abs(c.start - o.start) < 0.01);
    if (cap && !out.some((m) => m.captionId === cap.id)) out.push({ captionId: cap.id, kind: "emoji", text: o.text, importance: 1 });
  }
  return out;
}
