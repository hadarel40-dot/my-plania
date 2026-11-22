import { uid } from "@/lib/editor/timeline-utils";
import { NEUTRAL_LOOK, type Clip, type MediaAsset, type Overlay, type Timeline, type TransitionType, type VideoLayer } from "@/lib/editor/types";
import { layoutClips } from "@/lib/editor/timeline-utils";
import type { ReelEditKit } from "./config";

/**
 * מנוע אחד לריל: אותה פונקציה בונה את ציר הזמן לנגן בדשבורד, לפרויקט בעורך ולייצוא.
 * כך מה שרואים בדשבורד ומה שנפתח בעורך זהים: אותם פונטים, אותו קצב, אותן אנימציות.
 * הגרסאות הן סגנונות כתוביות שונים על אותם קטעים.
 */
export type CaptionStyleId = "pop" | "chips" | "lines" | "editorial" | "marker" | "neon" | "outline" | "stairs";
export const REEL_STYLES: { id: CaptionStyleId; variant: string; label: string }[] = [
  { id: "pop", variant: "C", label: "מילה אחת גדולה בכל פעם" },
  { id: "chips", variant: "A", label: "כותרת בתיבה ורודה" },
  { id: "lines", variant: "B", label: "שורה אחרי שורה" },
  { id: "editorial", variant: "D", label: "מגזין: מילה בכתב יד" },
  { id: "marker", variant: "E", label: "מרקר על המילים" },
  { id: "neon", variant: "F", label: "ניאון זוהר" },
  { id: "outline", variant: "G", label: "אותיות חלולות" },
  { id: "stairs", variant: "H", label: "מדרגות: מילה בכל שורה" },
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
  play?: "calm" | "bounce" | "type" | "zoom" | "blur" | "wipe" | "drop" | "spin";
  /** גרפיקה שנכתבת על המסך ליד המילה החשובה: קו, עיגול, חץ, ניצוצות, קרניים. "auto" בוחר לפי הכרטיס */
  motion?: MotionId | "auto" | "off";
  cardMotion?: Record<string, MotionId | "off">;
  /** המעבר בין הקטעים. בלי בחירה: מעבר רך קצר, כדי שלא ייראה קטוע */
  transition?: TransitionType | "cut";
  /** אנימציות קופצות שקשורות לטקסט (לפי מילים בכרטיס), או אחת שנבחרה לכרטיס */
  stickers?: boolean;
  cardStickers?: Record<string, string>;
  /** צילומי מסך שקופצים מעל הסרטון בכרטיס מסוים */
  shots?: Shot[];
  /** משחק מלא לכל כרטיס בנפרד: סגנון ומיקום משלו */
  perCard?: Record<string, { style?: CaptionStyleId; place?: "top" | "middle" | "bottom" }>;
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
  { id: "heebo", label: "מודרני", family: "Heebo" },
  { id: "varela", label: "רך", family: "Varela Round" },
  { id: "fredoka", label: "שובב", family: "Fredoka" },
  { id: "karantina", label: "דרמטי", family: "Karantina" },
  { id: "amatic", label: "כתב יד צר", family: "Amatic SC" },
  { id: "alef", label: "פשוט", family: "Alef" },
  { id: "david", label: "דוד", family: "David Libre" },
  { id: "bonanova", label: "יוקרתי", family: "Bona Nova" },
  { id: "miriam", label: "מרים", family: "Miriam Libre" },
  { id: "bubbles", label: "בועות", family: "Rubik Bubbles" },
  { id: "marker", label: "טוש", family: "Rubik Marker Hatch" },
  { id: "doodle", label: "שרבוט", family: "Rubik Doodle Shadow" },
  { id: "spray", label: "גרפיטי", family: "Rubik Spray Paint" },
  { id: "wetpaint", label: "צבע נוטף", family: "Rubik Wet Paint" },
];
export const TRANSITIONS: { id: TransitionType | "cut"; label: string }[] = [
  { id: "fade", label: "רך" }, { id: "zoom", label: "זום" }, { id: "slide", label: "החלקה" }, { id: "blur", label: "טשטוש" },
  { id: "whip", label: "סיבוב מהיר" }, { id: "flash", label: "הבזק" }, { id: "cut", label: "חיתוך" },
];
export const STICKERS = ["✨", "💡", "🗓️", "🍲", "🛒", "⏰", "❤️", "✅", "💰", "😮‍💨", "👀", "🔥", "📌", "🎉"];

/** אנימציה קופצת שמתאימה לטקסט, לפי מילים */
export function stickerFor(text: string) {
  const rules: [RegExp, string][] = [
    [/אוכל|ארוח|מתכון|בישול|מבשל|מטבח|ערב/, "🍲"], [/קניות|סופר|רשימ/, "🛒"], [/שבוע|תכנו|לוח|מתכננ|יום/, "🗓️"],
    [/זמן|שעה|דקות|מהר|מהיר/, "⏰"], [/כסף|חיסכו|לחסוך|שקל|זול/, "💰"], [/רעיון|טיפ|סוד|הבנתי/, "💡"],
    [/אוהב|לב|אהבה/, "❤️"], [/עייפ|לחץ|בלגן|קשב|עומס/, "😮‍💨"], [/מוכן|עובד|הצלח|סוף סוף|פתרון/, "✅"],
  ];
  return rules.find(([r]) => r.test(text))?.[1] ?? "";
}
/** צילום או הקלטת מסך בכרטיס: איפה (תשעה מקומות), כמה גדול, מעל או מתחת לטקסט, ונטייה קלה */
export interface Shot {
  card: number; path: string; w: number; h: number; kind?: "image" | "video"; seconds?: number;
  place?: "top" | "middle" | "bottom";
  pos?: "tr" | "tc" | "tl" | "mr" | "mc" | "ml" | "br" | "bc" | "bl";
  scale?: "s" | "m" | "l";
  layer?: "front" | "back";
  tilt?: boolean;
}
export const shotXY = (s: Shot) => {
  const p = s.pos ?? (s.place === "top" ? "tc" : s.place === "bottom" ? "bc" : "mc");
  return { x: p[1] === "r" ? 0.72 : p[1] === "l" ? 0.28 : 0.5, y: p[0] === "t" ? 0.27 : p[0] === "b" ? 0.72 : 0.5 };
};
const shotWidth = (s: Shot) => {
  const v = s.h >= s.w;
  const k = s.scale === "s" ? 0 : s.scale === "l" ? 2 : 1;
  return (v ? [340, 520, 720] : [520, 780, 980])[k];
};

export type MotionId = "underline" | "circle" | "arrow" | "sparkles" | "burst";
export const MOTIONS: { id: MotionId; label: string }[] = [
  { id: "underline", label: "קו בכתב יד" }, { id: "circle", label: "עיגול סביב" }, { id: "arrow", label: "חץ" },
  { id: "sparkles", label: "ניצוצות" }, { id: "burst", label: "קרני הדגשה" },
];
export const PLAYS: { id: NonNullable<ReelDesign["play"]>; label: string }[] = [
  { id: "blur", label: "פוקוס" }, { id: "wipe", label: "חשיפה" }, { id: "drop", label: "נפילה" }, { id: "spin", label: "סיבוב" },
  { id: "bounce", label: "קופץ" }, { id: "zoom", label: "זום" }, { id: "type", label: "מכונת כתיבה" }, { id: "calm", label: "רגוע" },
];
/** גרפיקה אוטומטית לכרטיס: שאלה מקבלת חץ, מספר מקבל עיגול, והשאר מתחלפים כדי שלא יחזור על עצמו */
function autoMotion(text: string, i: number): MotionId {
  if (/\?/.test(text)) return "arrow";
  if (/\d/.test(text)) return "circle";
  return (["underline", "sparkles", "circle", "burst", "underline"] as MotionId[])[i % 5];
}

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

function captions(cards: ReelEditKit["cards"], style: CaptionStyleId, design: ReelDesign = {}, shotUrls: Record<string, string> = {}): Overlay[] {
  const HEAD = design.main ?? "#FFFFFF";
  const BODY = design.body ?? design.accent ?? PINK;
  const ACC = design.accent ?? PINK;
  const bodyFont = design.bodyFont ?? design.font ?? "assistant";
  const k = design.size === "s" ? 0.8 : design.size === "l" ? 1.2 : 1;
  const playIn = (fallback: Overlay["animIn"]): Overlay["animIn"] => {
    const m: Record<string, Overlay["animIn"]> = { bounce: "bounce", type: "typewriter", zoom: "zoom", calm: "fade", blur: "blur", wipe: "wipe", drop: "drop", spin: "spin" };
    return (design.play && m[design.play]) || fallback;
  };
  // הגרפיקה שנכתבת ליד השורה או המילה החשובה בכרטיס
  const motionFor = (ci: number, text: string): MotionId | null => {
    const per = design.cardMotion?.[String(ci + 1)];
    if (per) return per === "off" ? null : per;
    if (!design.motion || design.motion === "off") return null;
    return design.motion === "auto" ? autoMotion(text, ci) : design.motion;
  };
  const shape = (kind: MotionId, x: number, cy: number, textW: number, size: number, start: number, end: number, ci: number): Overlay => {
    const w = kind === "arrow" ? 240 : Math.min(1000, textW * (kind === "underline" ? 1.05 : kind === "circle" ? 1.35 : 1.3));
    const y = kind === "underline" ? cy + (size * 0.66) / 1920 : kind === "arrow" ? cy - (size * 1.05) / 1920 : cy;
    const sx = kind === "arrow" ? Math.min(0.9, x + textW / 2160 + 0.04) : x;
    return { ...base, id: uid("ov"), kind: "shape", text: kind, start: +start.toFixed(2), end, x: sx, y: +y.toFixed(4), size: Math.round(w), color: ACC, weight: 400, stroke: false, rotate: kind === "underline" ? (ci % 2 ? 1.5 : -1.5) : 0, animIn: "none", loop: "none", animOut: "fade" };
  };
  const dark = (c: string) => ["#5E1D1D", "#2A2622", "#B5848E"].includes(c);
  const base = { kind: "text" as const, studio: true, x: 0.5, background: null, rotate: 0, loop: "none" as const };
  const out: Overlay[] = [];
  const front: Overlay[] = [];

  const globalStyle = style;
  cards.forEach((c, ci) => {
    const style = design.perCard?.[String(ci + 1)]?.style ?? globalStyle;
    const placeOf = design.perCard?.[String(ci + 1)]?.place ?? design.place;
    const dy = placeOf === "top" ? -0.24 : placeOf === "bottom" ? 0.22 : 0;
    const emphasis = design.emphasis ?? style === "editorial";
    const headFont = design.headFont ?? design.font ?? (style === "editorial" ? "frank" : style === "stairs" ? "secular" : "assistant");
    const emFont = design.emFont ?? (style === "editorial" ? "gveret" : headFont);
    const per = design.breaks === "many" ? 2 : design.breaks === "few" ? 4 : style === "editorial" ? 2 : style === "stairs" ? 1 : 3;
    // צילום מסך שקופץ בכרטיס
    for (const sh of (design.shots ?? []).filter((x) => x.card === ci + 1 && x.kind !== "video")) {
      const src = shotUrls[sh.path];
      if (!src) continue;
      const { x, y: sy } = shotXY(sh);
      const ov: Overlay = { ...base, id: uid("ov"), kind: "image", src, text: "", start: +(c.start + 0.2).toFixed(2), end: c.end, x, y: sy, size: shotWidth(sh), color: "#FFFFFF", weight: 400, stroke: false, rotate: sh.tilt === false ? 0 : ci % 2 ? 3 : -3, animIn: "pop", loop: "none", animOut: "fade" };
      // מתחת לטקסט: נכנס לפני הכתוביות של הכרטיס. מעל: נשמר לסוף, כדי שיהיה מעל הכול
      if (sh.layer === "front") front.push(ov); else out.push(ov);
    }
    const headline = c.headline ?? c.text;
    const body = c.headline ? c.body ?? "" : "";
    const dur = c.end - c.start;
    const em = emphasis ? keyWord(headline) : "";

    if (style === "pop") {
      // מילה אחת בכל פעם, במרכז. המילה המודגשת גדולה יותר, בצבע ההדגשה, ונשארת רגע יותר
      const words = [...clean(headline).split(/\s+/).filter(Boolean).map((w) => ({ w, head: true })), ...clean(body).split(/\s+/).filter(Boolean).map((w) => ({ w, head: false }))];
      const step = (dur * 0.85) / Math.max(1, words.length);
      const mo = motionFor(ci, headline);
      const target = words.findIndex((x) => x.head && (em ? x.w === em : true));
      words.forEach((x, wi) => {
        const start = +(c.start + 0.1 + wi * step).toFixed(2);
        const isEm = !!em && x.head && x.w === em;
        if (mo && wi === target) {
          const sz = Math.round((isEm ? 190 : 150) * k);
          out.push(shape(mo, 0.5, 0.487 + dy, x.w.length * sz * 0.55, sz, start + 0.12, wi === words.length - 1 ? c.end : +(start + step).toFixed(2), ci));
        }
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
    const hs = (style === "chips" || style === "marker" ? 84 : style === "editorial" ? 104 : style === "stairs" ? 120 : style === "outline" ? 120 : 96) * k;
    const bs = 60 * k;
    let rows = [
      ...head.map((l, li) => ({ ...l, size: l.em ? hs * (style === "editorial" ? 1.6 : 1.3) : style === "stairs" ? hs * (li % 2 ? 0.72 : 1.08) : hs, kind: "head" as const })),
      ...sub.map((l) => ({ ...l, size: bs, kind: "body" as const })),
    ];
    const mo = motionFor(ci, headline);
    const targetRow = Math.max(0, rows.findIndex((r) => r.em));
    // גובה אמיתי של כל שורה: שורה ארוכה שנשברת לשתיים תופסת כפול, מילה מודגשת מוטה צריכה אוויר,
    // וקו מתחת למילה צריך מקום משלו, כדי ששום דבר לא יעלה על משהו אחר
    const lh = style === "chips" || style === "marker" ? 1.5 : style === "stairs" ? 1.12 : 1.3;
    const linesOf = (r: { t: string; size: number }) => Math.max(1, Math.ceil((r.t.length * r.size * 0.56) / (1080 * 0.86)));
    const textH = (r: { t: string; size: number; kind: string }) => r.size * (r.kind === "body" ? 1.3 : lh) * linesOf(r);
    const below = (r: { size: number; em: boolean; kind: string }, ri: number) =>
      (r.em ? r.size * 0.22 : 0) + (mo && ri === targetRow && r.kind === "head" ? (mo === "underline" ? r.size * 0.45 : mo === "circle" || mo === "burst" ? r.size * 0.3 : 0) : 0);
    const above = (r: { size: number; em: boolean; kind: string }, ri: number) =>
      (r.em ? r.size * 0.12 : 0) + (mo && ri === targetRow && r.kind === "head" && (mo === "arrow" || mo === "circle" || mo === "burst") ? r.size * 0.3 : 0);
    const blockH = () => rows.reduce((n, r, ri) => n + above(r, ri) + textH(r) + below(r, ri), 0) + (sub.length ? 36 * k : 0);
    // אם הכרטיס לא נכנס בגובה, מקטינים את כולו
    const room = 1920 * 0.62;
    if (blockH() > room) {
      const f = room / blockH();
      rows = rows.map((r) => ({ ...r, size: r.size * f }));
    }
    const total = blockH();
    let y = Math.min(Math.max((0.5 + dy) * 1920 - total / 2, 1920 * 0.1), 1920 * 0.86 - total);
    rows.forEach((r, ri) => {
      if (r.kind === "body" && ri === head.length) y += 36 * k;
      y += above(r, ri);
      const th = textH(r);
      const cy = (y + th / 2) / 1920;
      y += th + below(r, ri);
      const start = +(c.start + 0.1 + ri * 0.22).toFixed(2);
      if (mo && ri === targetRow && r.kind === "head") {
        const rx = style === "stairs" ? (ri % 2 ? 0.56 : 0.44) : 0.5;
        out.push(shape(mo, rx, cy, Math.min(980, r.t.length * r.size * 0.52), r.size, start + 0.3, c.end, ci));
      }
      if (r.kind === "head" && (style === "marker" || style === "neon" || style === "outline" || style === "stairs")) {
        const em = r.em;
        const look: Partial<Overlay> =
          style === "marker" ? { color: "#2A2622", background: em ? HEAD : `${ACC}E6`, shadow: undefined }
          : style === "neon" ? { color: em ? ACC : HEAD, shadow: `0 0 10px ${ACC}, 0 0 28px ${ACC}, 0 0 60px ${ACC}` }
          : style === "outline" ? { color: em ? ACC : "transparent", stroke: !em, strokeColor: HEAD, strokeWidth: 0.035, shadow: em ? SHADOW : undefined }
          : { color: em ? ACC : ri % 2 ? ACC : HEAD, shadow: SHADOW, x: ri % 2 ? 0.56 : 0.44 };
        out.push({
          ...base, id: uid("ov"), hook: ci === 0 && ri === 0, text: r.t, start, end: c.end, y: +cy.toFixed(4), size: Math.round(r.size),
          font: em ? emFont : headFont, weight: em && emFont === "gveret" ? 400 : 900, stroke: false,
          rotate: style === "marker" ? (ri % 2 ? 1.5 : -1.5) : em ? -4 : 0,
          animIn: em ? "bounce" : playIn(style === "neon" ? "fade" : style === "stairs" ? "slide-side" : "pop"),
          loop: style === "neon" && em ? "pulse" : "none", animOut: "fade",
          ...look,
        } as Overlay);
      } else if (r.kind === "head") {
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
  return [...out, ...front];
}

/** הכתוביות בלבד (לגרסאות בעורך: מחליפים כתוביות בלי לגעת בקטעים) */
export const reelCaptions = captions;

export function buildReelTimeline(kit: ReelEditKit, style: CaptionStyleId = "pop", design: ReelDesign = {}, shotUrls: Record<string, string> = {}): { timeline: Timeline; assets: Record<string, MediaAsset> } {
  const assets: Record<string, MediaAsset> = {};
  const clips: Clip[] = kit.segments.map((s, i) => {
    const id = `seg-${i + 1}`;
    assets[id] = { id, name: `קטע ${i + 1}`, url: "", thumbnailUrl: null, duration: s.seconds, width: s.width, height: s.height, origin: "library", storagePath: s.path };
    return { id: uid("clip"), sourceAssetId: id, assetId: id, in: 0, out: s.seconds, look: NEUTRAL_LOOK, activeVariantId: null, volume: 0 };
  });
  // מעבר בין הקטעים: בלי בחירה, מעבר רך קצר, כדי שהחיתוכים לא ייראו קטועים
  const tr = design.transition ?? "fade";
  if (tr !== "cut") clips.forEach((c, i) => { if (i > 0) c.transitionIn = { type: tr, duration: tr === "flash" || tr === "whip" ? 0.25 : 0.35 }; });
  // במעבר חופף הקטע הבא מתחיל מוקדם יותר; הכתוביות זזות איתו כדי להישאר על אותו קטע
  const laid = layoutClips(clips);
  const origStarts = kit.segments.reduce<number[]>((acc, s, i) => [...acc, i ? acc[i - 1] + kit.segments[i - 1].seconds : 0], []);
  const remap = (t: number) => {
    let i = origStarts.length - 1;
    while (i > 0 && t < origStarts[i]) i--;
    return +(laid[i]?.start + (t - origStarts[i])).toFixed(2);
  };
  const overlays = captions(kit.cards, style, design, shotUrls).map((o) => ({ ...o, start: Math.max(0, remap(o.start)), end: remap(o.end) }));
  // הקלטות מסך: חלון מעוגל עם מסגרת מעל הסרטון, בזמן של הכרטיס
  const layers: VideoLayer[] = [];
  (design.shots ?? []).filter((s) => s.kind === "video" && shotUrls[s.path]).forEach((s, i) => {
    const card = kit.cards[s.card - 1];
    if (!card) return;
    const id = `shot-${i + 1}`;
    assets[id] = { id, name: "הקלטת מסך", url: shotUrls[s.path], thumbnailUrl: null, duration: s.seconds ?? card.end - card.start, width: s.w, height: s.h, origin: "upload" };
    const start = remap(card.start + 0.2);
    const len = Math.max(0.5, Math.min(s.seconds ?? 99, remap(card.end) - start));
    const { x, y } = shotXY(s);
    layers.push({ id: uid("layer"), assetId: id, start, in: 0, out: +len.toFixed(2), layout: "pip", x, y, scale: shotWidth(s) / 1080, shape: "rounded", border: true, opacity: 1, volume: 0 });
  });
  return {
    timeline: { fps: 30, aspect: "9:16", clips, captions: [], overlays, audio: [], layers },
    assets,
  };
}

/** ערכות עיצוב מוכנות: כל אחת כיוון שלם (גרסה, גופנים, צבעים, כניסה, מעבר וגרפיקה) */
export const DESIGN_PRESETS: { id: string; label: string; variant: string; design: ReelDesign }[] = [
  { id: "clean", label: "נקי ומודרני", variant: "B", design: { headFont: "heebo", bodyFont: "heebo", main: "#FFFFFF", body: "#F7C9D6", accent: "#F7C9D6", play: "blur", transition: "fade", motion: "underline", emphasis: true } },
  { id: "magazine", label: "מגזין יוקרתי", variant: "D", design: { headFont: "frank", bodyFont: "assistant", emFont: "gveret", main: "#FAF6F1", body: "#F7C9D6", accent: "#F7C9D6", play: "wipe", transition: "zoom", motion: "circle" } },
  { id: "energy", label: "אנרגטי", variant: "C", design: { headFont: "secular", bodyFont: "rubik", main: "#FFFFFF", body: "#F6E7A6", accent: "#F6E7A6", play: "bounce", transition: "whip", motion: "burst", emphasis: true } },
  { id: "bold", label: "מרקר בולד", variant: "E", design: { headFont: "rubik", bodyFont: "rubik", main: "#FFFFFF", body: "#FFFFFF", accent: "#F7C9D6", play: "wipe", transition: "slide", motion: "arrow", emphasis: true } },
  { id: "soft", label: "כתב יד רך", variant: "B", design: { headFont: "playpen", bodyFont: "assistant", emFont: "gveret", main: "#FAF6F1", body: "#F7C9D6", accent: "#B5848E", play: "blur", transition: "blur", motion: "sparkles", emphasis: true } },
  { id: "night", label: "ניאון לילה", variant: "F", design: { headFont: "secular", bodyFont: "heebo", main: "#FFFFFF", body: "#F7C9D6", accent: "#F7C9D6", play: "blur", transition: "flash", motion: "sparkles", emphasis: true } },
  { id: "drama", label: "מדרגות דרמטי", variant: "H", design: { headFont: "karantina", bodyFont: "heebo", main: "#FFFFFF", body: "#F6E7A6", accent: "#F6E7A6", play: "drop", transition: "zoom", motion: "burst" } },
  { id: "hollow", label: "מינימלי חלול", variant: "G", design: { headFont: "heebo", bodyFont: "heebo", main: "#FFFFFF", body: "#FAF6F1", accent: "#F7C9D6", play: "spin", transition: "blur", motion: "circle", emphasis: true } },
];

/** הפתעה: שילוב אקראי אבל הרמוני (גופן ראשי בולט, גופן משני נקי, צבעי מותג) */
export function surpriseDesign(): { variant: string; design: ReelDesign } {
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  const heads = ["secular", "suez", "frank", "karantina", "rubik", "heebo", "playpen", "bonanova", "bubbles"];
  const bodies = ["assistant", "heebo", "rubik", "varela", "alef"];
  const pal = pick([["#FFFFFF", "#F7C9D6"], ["#FAF6F1", "#B5848E"], ["#FFFFFF", "#F6E7A6"], ["#FFFFFF", "#5E1D1D"], ["#2A2622", "#F7C9D6"]]);
  return {
    variant: pick(REEL_STYLES).variant,
    design: {
      headFont: pick(heads), bodyFont: pick(bodies), emFont: pick(["gveret", "playpen", "amatic", "frank"]),
      main: pal[0], body: pal[1], accent: pal[1], emphasis: Math.random() > 0.3,
      play: pick(PLAYS).id, transition: pick(TRANSITIONS.filter((t) => t.id !== "cut")).id, motion: pick([...MOTIONS.map((m) => m.id), "auto" as const]),
      breaks: pick([undefined, "few", "many"] as const),
    },
  };
}
