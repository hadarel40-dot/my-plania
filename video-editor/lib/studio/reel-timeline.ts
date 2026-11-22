import { uid } from "@/lib/editor/timeline-utils";
import { NEUTRAL_LOOK, type Clip, type MediaAsset, type Overlay, type Timeline, type TransitionType } from "@/lib/editor/types";
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
  play?: "calm" | "bounce" | "type" | "zoom";
  /** המעבר בין הקטעים. בלי בחירה: מעבר רך קצר, כדי שלא ייראה קטוע */
  transition?: TransitionType | "cut";
  /** אנימציות קופצות שקשורות לטקסט (לפי מילים בכרטיס), או אחת שנבחרה לכרטיס */
  stickers?: boolean;
  cardStickers?: Record<string, string>;
  /** צילומי מסך שקופצים מעל הסרטון בכרטיס מסוים */
  shots?: { card: number; path: string; w: number; h: number; place?: "top" | "middle" | "bottom" }[];
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
  const playIn = (fallback: Overlay["animIn"]): Overlay["animIn"] => (design.play === "bounce" ? "bounce" : design.play === "type" ? "typewriter" : design.play === "zoom" ? "zoom" : design.play === "calm" ? "fade" : fallback);
  const dark = (c: string) => ["#5E1D1D", "#2A2622", "#B5848E"].includes(c);
  const base = { kind: "text" as const, studio: true, x: 0.5, background: null, rotate: 0, loop: "none" as const };
  const out: Overlay[] = [];

  const globalStyle = style;
  cards.forEach((c, ci) => {
    const style = design.perCard?.[String(ci + 1)]?.style ?? globalStyle;
    const placeOf = design.perCard?.[String(ci + 1)]?.place ?? design.place;
    const dy = placeOf === "top" ? -0.24 : placeOf === "bottom" ? 0.22 : 0;
    const emphasis = design.emphasis ?? style === "editorial";
    const headFont = design.headFont ?? design.font ?? (style === "editorial" ? "frank" : style === "stairs" ? "secular" : "assistant");
    const emFont = design.emFont ?? (style === "editorial" ? "gveret" : headFont);
    const per = design.breaks === "many" ? 2 : design.breaks === "few" ? 4 : style === "editorial" ? 2 : style === "stairs" ? 1 : 3;
    // אנימציה קופצת לכרטיס
    const sticker = design.cardStickers?.[String(ci + 1)] ?? (design.stickers ? stickerFor(`${c.headline ?? c.text} ${c.body ?? ""}`) : "");
    if (sticker) {
      out.push({ ...base, id: uid("ov"), kind: "emoji", text: sticker, start: +(c.start + 0.35).toFixed(2), end: c.end, x: ci % 2 ? 0.2 : 0.8, y: Math.max(0.12, 0.3 + dy), size: 150, color: "#FFFFFF", weight: 400, stroke: false, rotate: ci % 2 ? -8 : 8, animIn: "bounce", loop: "float", animOut: "pop" });
    }
    // צילום מסך שקופץ בכרטיס
    for (const sh of (design.shots ?? []).filter((x) => x.card === ci + 1)) {
      const src = shotUrls[sh.path];
      if (!src) continue;
      const wPx = sh.h > sh.w ? 520 : 820;
      out.push({ ...base, id: uid("ov"), kind: "image", src, text: "", start: +(c.start + 0.2).toFixed(2), end: c.end, x: 0.5, y: sh.place === "top" ? 0.3 : sh.place === "bottom" ? 0.68 : 0.5, size: wPx, color: "#FFFFFF", weight: 400, stroke: false, rotate: ci % 2 ? 2 : -2, animIn: "pop", loop: "none", animOut: "fade" });
    }
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
    const hs = (style === "chips" || style === "marker" ? 84 : style === "editorial" ? 104 : style === "stairs" ? 120 : style === "outline" ? 120 : 96) * k;
    const bs = 60 * k;
    const rows = [
      ...head.map((l, li) => ({ ...l, size: l.em ? hs * (style === "editorial" ? 1.7 : 1.35) : style === "stairs" ? hs * (li % 2 ? 0.72 : 1.08) : hs, kind: "head" as const })),
      ...sub.map((l) => ({ ...l, size: bs, kind: "body" as const })),
    ];
    const gap = (r: { size: number; kind: string; em: boolean }) => r.size * (style === "chips" || style === "marker" ? 1.45 : style === "stairs" ? 1.02 : 1.18) + (r.kind === "body" ? 6 : 0) + (r.em ? r.size * 0.18 : 0);
    const total = rows.reduce((n, r) => n + gap(r), 0) + (sub.length ? 30 * k : 0);
    let y = (0.5 + dy) * 1920 - total / 2;
    rows.forEach((r, ri) => {
      if (r.kind === "body" && ri === head.length) y += 30 * k;
      const h = gap(r);
      const cy = (y + h / 2) / 1920;
      y += h;
      const start = +(c.start + 0.1 + ri * 0.22).toFixed(2);
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
  return out;
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
  return {
    timeline: { fps: 30, aspect: "9:16", clips, captions: [], overlays, audio: [] },
    assets,
  };
}
