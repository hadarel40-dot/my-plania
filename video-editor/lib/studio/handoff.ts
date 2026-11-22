import "server-only";
import { initialProject } from "@/lib/editor/initial-project";
import { uid } from "@/lib/editor/timeline-utils";
import type { Overlay, SavedProject } from "@/lib/editor/types";
import { buildReelTimeline, styleForVariant } from "./reel-timeline";
import { SAFE, type Draft } from "./config";

/**
 * מתסריט לפרויקט בעורך: כרטיסי הטקסט נכנסים כשכבות טקסט בזמנים ובאזור הבטוח, והתסריט ורשימת
 * השוטים נכנסים להערות. את הקליפים מעלים בעורך (מהמכשיר או מדרייב), והכתוביות נוצרות שם מהקול.
 * הפרויקט בעורך הוא רשימת העריכה עצמה: כל החלטה נשמרת בו.
 */
export function projectFromDraft(draft: Draft): SavedProject & { notes: string } {
  const project = initialProject();
  const d = draft.data;
  const centerX = (SAFE.cardX + SAFE.cardW / 2) / SAFE.width;
  const overlays: Overlay[] = (d.cards ?? []).map((c, i) => ({
    id: uid("ov"),
    kind: "text",
    hook: i === 0,
    text: c.text,
    start: c.start,
    end: c.end,
    x: +centerX.toFixed(3),
    y: +((Math.min(Math.max(c.y, SAFE.top), SAFE.bottom - 200) + 100) / SAFE.height).toFixed(3),
    size: 64,
    color: "#2A2622",
    background: "#F4EEE4",
    stroke: false,
    weight: 700,
    rotate: 0,
    animIn: "pop",
    loop: "none",
    animOut: "fade",
  }));
  const script = (d.script?.beats ?? []).map((b) => `${b.start}-${b.end}ש׳ ${b.line || "(בלי דיבור)"}\n   בפריים: ${b.frame}`).join("\n");
  const shots = (d.shots ?? []).map((s) => `${s.n}. ${s.frame} | ${s.angle} | ${s.seconds}ש׳ | בלי פנים: ${s.faceless}`).join("\n");
  const hook = d.hooks?.[d.chosen ?? 0];
  project.title = draft.idea.slice(0, 60);
  project.notes = [
    hook ? `הוק: ${hook.spoken}` : "",
    "התסריט:",
    script,
    "",
    "שוטים:",
    shots,
    "",
    d.cta ? `קריאה לפעולה: ${d.cta}` : "",
    "שמרי על האזור הבטוח: לא מעל y=230, לא מתחת ל-1440, ו-230 פיקסלים פנויים מימין.",
  ].filter((l) => l !== null).join("\n").slice(0, 8000);
  project.timeline.overlays = overlays;

  // ריל מוכן מהתהליך השבועי: הקטעים עצמם נכנסים לציר הזמן, והטקסטים כשכבות שאפשר לערוך.
  // כך מחליפים סרטון, משנים טקסט ומייצאים בעורך, בלי לחכות לרינדור מחדש
  if (d.edit?.segments.length) {
    // אותו מנוע כמו הנגן בדשבורד: הקטעים והכתוביות בסגנון של הגרסה שנבחרה
    const built = buildReelTimeline(d.edit, styleForVariant(d.chosen_variant));
    project.assets = built.assets;
    project.timeline = { ...project.timeline, ...built.timeline };
    project.notes = `${project.notes}\n\nזה הריל מהסטודיו: כל קטע וידאו בציר הזמן, וכל מילה או כותרת היא שכבת טקסט. מוזיקה מוסיפים באינסטגרם.`.slice(0, 8000);
  }
  return project;
}
