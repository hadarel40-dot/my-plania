import { uid } from "@/lib/editor/timeline-utils";
import { NEUTRAL_LOOK, type Clip, type MediaAsset, type Overlay, type Timeline } from "@/lib/editor/types";
import type { ReelEditKit } from "./config";

/**
 * מנוע אחד לריל: אותה פונקציה בונה את ציר הזמן לנגן בדשבורד, לפרויקט בעורך ולייצוא.
 * כך מה שרואים בדשבורד ומה שנפתח בעורך זהים: אותם פונטים, אותו קצב, אותן אנימציות.
 * הגרסאות הן סגנונות כתוביות שונים על אותם קטעים.
 */
export type CaptionStyleId = "pop" | "chips" | "lines";
export const REEL_STYLES: { id: CaptionStyleId; variant: string; label: string }[] = [
  { id: "pop", variant: "C", label: "מילה אחת גדולה בכל פעם" },
  { id: "chips", variant: "A", label: "כותרת בתיבה ורודה" },
  { id: "lines", variant: "B", label: "שורה אחרי שורה" },
];
/** השם של גרסה, זהה בכל מקום (דשבורד, עורך, "מה עולה היום") */
export const variantLabel = (v?: string | null) => { const s = REEL_STYLES.find((x) => x.variant === (v ?? "C")) ?? REEL_STYLES[0]; return `${s.variant} · ${s.label}`; };
export const styleForVariant = (v?: string | null): CaptionStyleId => REEL_STYLES.find((s) => s.variant === v)?.id ?? "pop";

const PINK = "#F7C9D6";
const SHADOW = "0 4px 6px rgba(0,0,0,.55), 0 8px 34px rgba(0,0,0,.45)";

/** העיצוב שהיא בוחרת בדשבורד, בלי עורך: גופן, צבע ראשי, צבע הדגשה, גודל ומיקום */
export interface ReelDesign { font?: string; main?: string; accent?: string; size?: "s" | "m" | "l"; place?: "top" | "middle" | "bottom" }
export const REEL_FONTS: { id: string; label: string; family: string }[] = [
  { id: "assistant", label: "נקי", family: "Assistant" },
  { id: "rubik", label: "עגול", family: "Rubik" },
  { id: "secular", label: "כותרת", family: "Secular One" },
  { id: "suez", label: "קלאסי", family: "Suez One" },
  { id: "frank", label: "ספרותי", family: "Frank Ruhl Libre" },
  { id: "bellefair", label: "אלגנטי", family: "Bellefair" },
  { id: "gveret", label: "כתב יד", family: "Gveret Levin" },
  { id: "playpen", label: "כתב חמוד", family: "Playpen Sans Hebrew" },
];
export const REEL_COLORS = ["#FFFFFF", "#FAF6F1", "#F7C9D6", "#B5848E", "#5E1D1D", "#F6E7A6", "#2A2622"];

function captions(cards: ReelEditKit["cards"], style: CaptionStyleId, design: ReelDesign = {}): Overlay[] {
  const MAIN = design.main ?? "#FFFFFF";
  const ACC = design.accent ?? PINK;
  const k = design.size === "s" ? 0.8 : design.size === "l" ? 1.2 : 1;
  const dy = design.place === "top" ? -0.24 : design.place === "bottom" ? 0.22 : 0;
  const base = { kind: "text" as const, studio: true, x: 0.5, background: null, font: design.font ?? "assistant", rotate: 0, loop: "none" as const };
  const out: Overlay[] = [];
  cards.forEach((c, ci) => {
    const headline = c.headline ?? c.text;
    const body = c.headline ? c.body ?? "" : "";
    const dur = c.end - c.start;
    if (style === "pop") {
      // מילה אחת בכל פעם, במרכז: כותרת לבנה עם קו ורוד, המשך בוורוד
      const words = [...headline.split(/\s+/).filter(Boolean).map((w) => ({ w, head: true })), ...body.split(/\s+/).filter(Boolean).map((w) => ({ w, head: false }))];
      const step = (dur * 0.85) / Math.max(1, words.length);
      words.forEach((x, wi) => {
        const start = +(c.start + 0.1 + wi * step).toFixed(2);
        out.push({
          ...base, id: uid("ov"), hook: ci === 0 && wi === 0, text: x.w, start, end: wi === words.length - 1 ? c.end : +(start + step).toFixed(2),
          y: 0.487 + dy, size: Math.round((x.head ? 150 : 120) * k), color: x.head ? MAIN : ACC, weight: 900,
          stroke: x.head, strokeColor: ACC, strokeWidth: 0.02, shadow: SHADOW, animIn: "pop", animOut: "none",
        });
      });
    } else if (style === "chips") {
      // הכותרת בתיבה ורודה עם טקסט כהה, ההמשך בלבן מתחת
      out.push({ ...base, id: uid("ov"), hook: ci === 0, text: headline, start: c.start + 0.1, end: c.end, y: 0.5 + dy, size: Math.round(88 * k), color: ACC === "#5E1D1D" || ACC === "#2A2622" ? "#FFFFFF" : "#2A2622", background: ACC, weight: 900, stroke: false, animIn: "pop", animOut: "fade" });
      if (body) out.push({ ...base, id: uid("ov"), text: body, start: c.start + 0.5, end: c.end, y: 0.6 + dy, size: Math.round(64 * k), color: MAIN, weight: 700, stroke: false, shadow: SHADOW, animIn: "fade", animOut: "fade" });
    } else {
      // שורה אחרי שורה: הכותרת בלבן גדול, ההמשך בוורוד חצי שנייה אחריה
      out.push({ ...base, id: uid("ov"), hook: ci === 0, text: headline, start: c.start + 0.1, end: c.end, y: 0.48 + dy, size: Math.round(100 * k), color: MAIN, weight: 900, stroke: false, shadow: SHADOW, animIn: "slide-up", animOut: "fade" });
      if (body) out.push({ ...base, id: uid("ov"), text: body, start: c.start + 0.6, end: c.end, y: 0.58 + dy, size: Math.round(64 * k), color: ACC, weight: 700, stroke: false, shadow: SHADOW, animIn: "slide-up", animOut: "fade" });
    }
  });
  return out;
}

/** הכתוביות בלבד (לגרסאות בעורך: מחליפים כתוביות בלי לגעת בקטעים) */
export const reelCaptions = captions;

export function buildReelTimeline(kit: ReelEditKit, style: CaptionStyleId = "pop", design: ReelDesign = {}): { timeline: Timeline; assets: Record<string, MediaAsset> } {
  const assets: Record<string, MediaAsset> = {};
  const clips: Clip[] = kit.segments.map((s, i) => {
    const id = `seg-${i + 1}`;
    assets[id] = { id, name: `קטע ${i + 1}`, url: "", thumbnailUrl: null, duration: s.seconds, width: s.width, height: s.height, origin: "library", storagePath: s.path };
    return { id: uid("clip"), sourceAssetId: id, assetId: id, in: 0, out: s.seconds, look: NEUTRAL_LOOK, activeVariantId: null, volume: 0 };
  });
  return {
    timeline: { fps: 30, aspect: "9:16", clips, captions: [], overlays: captions(kit.cards, style, design), audio: [] },
    assets,
  };
}
