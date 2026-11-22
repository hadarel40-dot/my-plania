import { uid } from "@/lib/editor/timeline-utils";
import { NEUTRAL_LOOK, type Clip, type MediaAsset, type Overlay, type Timeline } from "@/lib/editor/types";
import type { ReelEditKit } from "./config";

/**
 * מנוע אחד לריל: אותה פונקציה בונה את ציר הזמן לנגן בדשבורד, לפרויקט בעורך ולייצוא.
 * כך מה שרואים בדשבורד ומה שנפתח בעורך זהים: אותם פונטים, אותו קצב, אותן אנימציות.
 * הגרסאות הן סגנונות כתוביות שונים על אותם קטעים.
 */
export type CaptionStyleId = "pop" | "chips" | "lines" | "editorial";
export const REEL_STYLES: { id: CaptionStyleId; variant: string; label: string }[] = [
  { id: "pop", variant: "C", label: "מילה אחת גדולה בכל פעם" },
  { id: "chips", variant: "A", label: "כותרת בתיבה ורודה" },
  { id: "lines", variant: "B", label: "שורה אחרי שורה" },
  { id: "editorial", variant: "D", label: "מגזין: מילה בכתב יד" },
];
/** השם של גרסה, זהה בכל מקום (דשבורד, "מה עולה היום") */
export const variantLabel = (v?: string | null) => { const s = REEL_STYLES.find((x) => x.variant === (v ?? "C")) ?? REEL_STYLES[0]; return `${s.variant} · ${s.label}`; };
export const styleForVariant = (v?: string | null): CaptionStyleId => REEL_STYLES.find((s) => s.variant === v)?.id ?? "pop";

const PINK = "#F7C9D6";
const SHADOW = "0 4px 6px rgba(0,0,0,.55), 0 8px 34px rgba(0,0,0,.45)";

/**
 * העיצוב שהיא בוחרת בדשבורד, בלי עורך. כותרת ראשית וכותרת משנית מעוצבות בנפרד,
 * ומשחקי אותיות: מילה מודגשת, ירידות שורה ותנועה.
 */
export interface ReelDesign {
  /** ישן: גופן אחד לכול (נשאר לתאימות) */
  font?: string;
  headFont?: string; bodyFont?: string; emFont?: string;
  /** צבע הכותרת הראשית */
  main?: string;
  /** צבע הכותרת המשנית */
  body?: string;
  /** צבע ההדגשה: תיבות, קו מתאר, המילה המודגשת */
  accent?: string;
  size?: "s" | "m" | "l";
  place?: "top" | "middle" | "bottom";
  /** מילה אחת בכותרת קופצת: גדולה, בצבע ההדגשה ובגופן משלה */
  emphasis?: boolean;
  /** כמה מילים בשורה: מעט ירידות (3-4) או הרבה (1-2) */
  breaks?: "few" | "many";
  /** איך האותיות נכנסות */
  play?: "calm" | "bounce" | "type" | "zoom";
}
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

const clean = (t: string) => t.replace(/\*/g, "").trim();
/** המילה המודגשת: מה שבין כוכביות, ואם אין, המילה הכי ארוכה */
function keyWord(text: string) {
  const marked = text.match(/\*([^*]+)\*/);
  if (marked) return marked[1].trim();
  const words = clean(text).split(/\s+/).filter((w) => w.replace(/[^\p{L}]/gu, "").length >= 3);
  return words.sort((a, b) => b.length - a.length)[0] ?? "";
}
/** שורות לפי כמות המילים בשורה. המילה המודגשת יורדת לשורה משלה */
function toLines(text: string, perLine: number, em: string): { t: string; em: boolean }[] {
  const words = clean(text).split(/\s+/).filter(Boolean);
  const out: { t: string; em: boolean }[] = [];
  let cur: string[] = [];
  const flush = () => { if (cur.length) out.push({ t: cur.join(" "), em: false }); cur = []; };
  for (const w of words) {
    if (em && w === em) { flush(); out.push({ t: w, em: true }); continue; }
    cur.push(w);
    if (cur.length >= perLine) flush();
  }
  flush();
  return out;
}

function captions(cards: ReelEditKit["cards"], style: CaptionStyleId, design: ReelDesign = {}): Overlay[] {
  const HEAD = design.main ?? "#FFFFFF";
  const BODY = design.body ?? design.accent ?? PINK;
  const ACC = design.accent ?? PINK;
  const headFont = design.headFont ?? design.font ?? (style === "editorial" ? "frank" : "assistant");
  const bodyFont = design.bodyFont ?? design.font ?? "assistant";
  const emFont = design.emFont ?? (style === "editorial" ? "gveret" : headFont);
  const emphasis = design.emphasis ?? style === "editorial";
  const k = design.size === "s" ? 0.8 : design.size === "l" ? 1.2 : 1;
  const dy = design.place === "top" ? -0.24 : design.place === "bottom" ? 0.22 : 0;
  const per = design.breaks === "many" ? 2 : design.breaks === "few" ? 4 : style === "editorial" ? 2 : 3;
  const playIn = (fallback: Overlay["animIn"]): Overlay["animIn"] => (design.play === "bounce" ? "bounce" : design.play === "type" ? "typewriter" : design.play === "zoom" ? "zoom" : design.play === "calm" ? "fade" : fallback);
  const dark = (c: string) => ["#5E1D1D", "#2A2622", "#B5848E"].includes(c);
  const base = { kind: "text" as const, studio: true, x: 0.5, background: null, rotate: 0, loop: "none" as const };
  const out: Overlay[] = [];

  cards.forEach((c, ci) => {
    const headline = c.headline ?? c.text;
    const body = c.headline ? c.body ?? "" : "";
    const dur = c.end - c.start;
    const em = emphasis ? keyWord(headline) : "";

    if (style === "pop") {
      // מילה אחת בכל פעם, במרכז. המילה המודגשת גדולה יותר, בצבע ההדגשה, ונשארת רגע יותר
      const words = [...clean(headline).split(/\s+/).filter(Boolean).map((w) => ({ w, head: true })), ...clean(body).split(/\s+/).filter(Boolean).map((w) => ({ w, head: false }))];
      const step = (dur * 0.85) / Math.max(1, words.length);
      words.forEach((x, wi) => {
        const start = +(c.start + 0.1 + wi * step).toFixed(2);
        const isEm = !!em && x.head && x.w === em;
        out.push({
          ...base, id: uid("ov"), hook: ci === 0 && wi === 0, text: x.w, start, end: wi === words.length - 1 ? c.end : +(start + step).toFixed(2),
          y: 0.487 + dy, size: Math.round((isEm ? 190 : x.head ? 150 : 120) * k), color: isEm ? ACC : x.head ? HEAD : BODY, weight: 900,
          font: isEm ? emFont : x.head ? headFont : bodyFont, rotate: isEm ? -4 : 0,
          stroke: x.head && !isEm, strokeColor: ACC, strokeWidth: 0.02, shadow: SHADOW, animIn: isEm ? "bounce" : playIn("pop"), animOut: "none",
        });
      });
      return;
    }

    // כל שאר הסגנונות: שורות אחת מתחת לשנייה, כל שורה נכנסת קצת אחרי הקודמת
    const head = toLines(headline, per, em);
    const sub = body ? toLines(body, per + 1, "") : [];
    const hs = (style === "chips" ? 84 : style === "editorial" ? 104 : 96) * k;
    const bs = 60 * k;
    const rows = [
      ...head.map((l) => ({ ...l, size: l.em ? hs * (style === "editorial" ? 1.7 : 1.35) : hs, kind: "head" as const })),
      ...sub.map((l) => ({ ...l, size: bs, kind: "body" as const })),
    ];
    const gap = (r: { size: number; kind: string; em: boolean }) => r.size * (style === "chips" ? 1.45 : 1.18) + (r.kind === "body" ? 6 : 0) + (r.em ? r.size * 0.18 : 0);
    const total = rows.reduce((n, r) => n + gap(r), 0) + (sub.length ? 30 * k : 0);
    let y = (0.5 + dy) * 1920 - total / 2;
    rows.forEach((r, ri) => {
      if (r.kind === "body" && ri === head.length) y += 30 * k;
      const h = gap(r);
      const cy = (y + h / 2) / 1920;
      y += h;
      const start = +(c.start + 0.1 + ri * 0.22).toFixed(2);
      if (r.kind === "head") {
        const boxed = style === "chips";
        const emColor = boxed ? (dark(ACC) ? "#FFFFFF" : "#2A2622") : ACC;
        out.push({
          ...base, id: uid("ov"), hook: ci === 0 && ri === 0, text: r.t, start, end: c.end, y: +cy.toFixed(4), size: Math.round(r.size),
          font: r.em ? emFont : headFont, weight: r.em && emFont === "gveret" ? 400 : 900,
          color: boxed ? (r.em ? HEAD === "#FFFFFF" ? "#5E1D1D" : HEAD : dark(ACC) ? "#FFFFFF" : "#2A2622") : r.em ? emColor : HEAD,
          background: boxed ? (r.em ? (HEAD === "#FFFFFF" ? "#FFFFFF" : ACC) : ACC) : null,
          rotate: r.em && style !== "chips" ? -4 : 0,
          stroke: false, shadow: boxed ? undefined : SHADOW,
          animIn: r.em ? (style === "editorial" ? "zoom" : "bounce") : playIn(style === "chips" ? "pop" : "slide-up"),
          loop: r.em && style === "editorial" ? "float" : "none", animOut: "fade",
        });
      } else {
        out.push({
          ...base, id: uid("ov"), text: r.t, start: +(start + 0.15).toFixed(2), end: c.end, y: +cy.toFixed(4), size: Math.round(r.size),
          font: bodyFont, weight: 700, color: BODY, stroke: false, shadow: SHADOW, animIn: playIn("fade"), animOut: "fade",
        });
      }
    });
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
