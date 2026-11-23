"use client";
import { fontCssReady } from "@/lib/font-css";
import type { Carousel, Slide } from "./config";
import { PHOTO_DEFAULT, boldOf, fontStack, regularOf, sizeFactor } from "./brand";

/**
 * שקופיות קרוסלה בגודל 1080x1350, נכתבות בדפדפן (שם עברית מימין לשמאל נכונה), בעיצוב הסטודיו:
 * שער בצהוב חמאה, שקופיות שמנת, קריאה לפעולה בדיו. 120 פיקסלים שוליים מכל צד, כך שהחיתוך של הגריד לא נוגע בטקסט.
 */
export const W = 1080;
export const H = 1350;
const M = 120;
const INK = "#1F1B16";
const CREAM = "#FBF8F2";
const BUTTER = "#F6E7A6";
const MUTED = "#6F675C";
const SERIF = '"Frank Ruhl Libre", "David Libre", Georgia, serif';
const SERIF_BASE = SERIF;
const SANS = '"Assistant", "Heebo", Arial, sans-serif';
const SANS_BASE = SANS;
const HAND = '"Amatic SC", "Assistant", cursive';
const KIND: Record<Slide["kind"], string> = { cover: "", stake: "למה זה חשוב", point: "", recap: "בקיצור", cta: "ועכשיו" };

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const out: string[] = [];
  for (const para of String(text).split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > max && line) { out.push(line); line = word; } else line = next;
    }
    out.push(line);
  }
  return out;
}

/** שורות של סיכום: כל נקודה נשברת לרוחב, והתבליט רק בשורה הראשונה שלה */
function wrapRows(ctx: CanvasRenderingContext2D, rows: string[], max: number) {
  const lines: string[] = [];
  const starts = new Set<number>();
  for (const r of rows) { starts.add(lines.length); lines.push(...wrap(ctx, r, max)); }
  return { lines, starts };
}

/** כותב שורות מימין, ומקטין את הגופן עד שהטקסט נכנס לגובה */
function block(ctx: CanvasRenderingContext2D, text: string, font: (size: number) => string, size: number, top: number, maxH: number, color: string, lineH = 1.18) {
  let s = size;
  let lines: string[] = [];
  for (; s > 28; s -= 4) {
    ctx.font = font(s);
    lines = wrap(ctx, text, W - M * 2);
    if (lines.length * s * lineH <= maxH) break;
  }
  ctx.fillStyle = color;
  lines.forEach((l, i) => ctx.fillText(l, W - M, top + s + i * s * lineH));
  return top + lines.length * s * lineH;
}

const imageCache = new Map<string, Promise<HTMLImageElement | null>>();
function loadImage(src: string) {
  if (!imageCache.has(src)) {
    imageCache.set(src, new Promise((resolve) => {
      const img = new Image();
      // תמונות מהאחסון מגיעות מדומיין אחר: בלי זה הקנבס "מתלכלך" ואי אפשר לייצא PNG
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    }));
  }
  return imageCache.get(src)!;
}

/** ממלא מלבן בתמונה, חתוכה למרכז (כמו object-fit: cover) */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale, sh = h / scale;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

/** images: מספר שקופית -> כתובת תמונה (מהדרייב) */
/** מקום שמחכה למספר שלה מופיע כ-[המספר שלך], בלי הסוגריים הגולמיים */
const fill = (s: string) => s.replace(/\{\{\s*([^}]+?)\s*\}\}/g, "[$1]");

export async function renderSlide(c0: Carousel, index: number, images: Record<number, string> = {}): Promise<HTMLCanvasElement> {
  const c: Carousel = { ...c0, slides: c0.slides.map((s) => ({ ...s, headline: fill(s.headline), body: fill(s.body) })) };
  await fontCssReady();
  if (document.fonts) {
    await Promise.all([document.fonts.load(`900 80px ${SERIF_BASE}`), document.fonts.load(`600 40px ${SANS_BASE}`), document.fonts.load(`800 26px ${SANS_BASE}`), document.fonts.load(`700 60px ${HAND}`)]).catch(() => {});
  }
  if ((c.style ?? "cream") === "photo") return renderPhotoSlide(c, index, images);
  const th = c.theme ?? {};
  const SERIF = fontStack(th.headFont, SERIF_BASE), SANS = fontStack(th.bodyFont, SANS_BASE);
  await fontCssReady();
  if (document.fonts && (th.headFont || th.bodyFont)) await Promise.all([document.fonts.load(`900 80px ${SERIF}`), document.fonts.load(`600 40px ${SANS}`)]).catch(() => {});
  const slide = c.slides[index];
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  // שלושה סגנונות: שמנת (שער צהוב, קריאה לפעולה כהה), כהה, וצהוב נועז
  const style = c.style ?? "cream";
  const dark = style === "ink" ? slide.kind !== "cover" : slide.kind === "cta";
  const bg = style === "ink" ? (slide.kind === "cover" ? BUTTER : INK)
    : style === "butter" ? (slide.kind === "cta" ? INK : BUTTER)
    : slide.kind === "cover" ? BUTTER : slide.kind === "cta" ? INK : CREAM;
  const fg = th.headColor ?? (dark ? CREAM : INK);
  ctx.fillStyle = th.bg && slide.kind !== "cover" ? th.bg : bg;
  ctx.fillRect(0, 0, W, H);

  // מספור, כדי שרואים איפה נגמר
  ctx.font = `800 26px ${SANS}`;
  ctx.fillStyle = dark ? "#CFC6B7" : MUTED;
  ctx.textAlign = "left";
  ctx.direction = "ltr";
  ctx.fillText(`${index + 1}/${c.slides.length}`, M, M);
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  const label = slide.kind === "point" ? `${c.slides.slice(0, index + 1).filter((s) => s.kind === "point").length}` : KIND[slide.kind];
  if (label) ctx.fillText(label, W - M, M);

  const photo = images[index] ? await loadImage(images[index]) : null;
  if (photo && slide.kind === "cover") {
    // שער עם תמונה: תמונה על כל המסגרת, וכרטיס שמנת עם הכותרת בתחתית
    drawCover(ctx, photo, 0, 0, W, H);
    ctx.fillStyle = "rgba(31,27,22,0.10)";
    ctx.fillRect(0, 0, W, H);
    // גובה הכרטיס לפי הטקסט: מודדים קודם, מציירים אחר כך
    ctx.font = `900 92px ${SERIF}`;
    const headLines = wrap(ctx, slide.headline, W - M * 2).length;
    ctx.font = `600 40px ${SANS}`;
    const bodyLines = slide.body ? wrap(ctx, slide.body, W - M * 2).length : 0;
    const boxH = 60 + headLines * 92 * 1.08 + (bodyLines ? 30 + bodyLines * 40 * 1.3 : 0) + 50;
    const boxTop = H - M - boxH;
    ctx.fillStyle = BUTTER;
    ctx.fillRect(M - 40, boxTop, W - (M - 40) * 2, boxH);
    const y = block(ctx, slide.headline, (s) => `900 ${s}px ${SERIF}`, 92, boxTop + 30, headLines * 92 * 1.1, INK, 1.08);
    if (slide.body) block(ctx, slide.body, (s) => `600 ${s}px ${SANS}`, 40, y + 20, bodyLines * 40 * 1.35, INK, 1.3);
    ctx.font = `800 26px ${SANS}`;
    ctx.fillStyle = "#FBF8F2";
    ctx.textAlign = "left";
    ctx.direction = "ltr";
    ctx.fillText(`${index + 1}/${c.slides.length}`, M, M);
  } else if (photo && (slide.kind === "point" || slide.kind === "stake")) {
    // שקופית עם תמונה: התמונה למעלה, הטקסט מתחת
    drawCover(ctx, photo, M, M + 50, W - M * 2, 560);
    const y = block(ctx, slide.headline, (s) => `900 ${s}px ${SERIF}`, 72, M + 640, 230, fg, 1.1);
    block(ctx, slide.body, (s) => `600 ${s}px ${SANS}`, 38, y + 30, H - y - 30 - M - 60, dark ? "#E9E2D6" : "#3A332B", 1.35);
  } else if (slide.kind === "cover") {
    let y = block(ctx, slide.headline, (s) => `900 ${s}px ${SERIF}`, 120, 330, 560, INK, 1.08);
    ctx.fillStyle = INK;
    ctx.fillRect(W - M - 160, y + 40, 160, 8);
    y = block(ctx, slide.body, (s) => `600 ${s}px ${SANS}`, 46, y + 70, 260, INK, 1.3);
  } else if (slide.kind === "recap") {
    let y = block(ctx, slide.headline, (s) => `900 ${s}px ${SERIF}`, 76, 200, 220, fg, 1.1);
    const rows = slide.body.split("\n").map((r) => r.replace(/^[-•·\d.\s]+/, "").trim()).filter(Boolean);
    ctx.font = `600 40px ${SANS}`;
    for (const r of rows) {
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(W - M - 10, y + 52, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = `600 40px ${SANS}`;
      const lines = wrap(ctx, r, W - M * 2 - 44);
      lines.forEach((l, i) => ctx.fillText(l, W - M - 40, y + 64 + i * 50));
      y += 30 + lines.length * 50;
      if (y > H - M - 120) break;
    }
  } else {
    const y = block(ctx, slide.headline, (s) => `900 ${s}px ${SERIF}`, slide.kind === "cta" ? 96 : 84, 280, 460, fg, 1.1);
    if (style === "ink" && slide.kind !== "cta") { ctx.fillStyle = BUTTER; ctx.fillRect(W - M - 120, y + 22, 120, 7); }
    block(ctx, slide.body, (s) => `600 ${s}px ${SANS}`, 44, y + 50, H - y - 50 - M - 90, dark ? "#E9E2D6" : "#3A332B", 1.35);
  }

  // הכינוי בכל שקופית, קטן, בפינה: צילומי מסך מסתובבים בלי ההקשר
  if (c.handle) {
    ctx.font = `700 26px ${SANS}`;
    ctx.fillStyle = dark || (photo && slide.kind === "cover") ? "#FBF8F2" : MUTED;
    ctx.textAlign = "left";
    ctx.direction = "ltr";
    ctx.fillText(c.handle, M, photo && slide.kind === "cover" ? H - 50 : H - M + 40);
  }
  return canvas;
}

/**
 * הסגנון שלה (כמו בתהליך השבועי): תמונה אישית על כל המסגרת, מוחשכת,
 * כותרת מודגשת בוורוד בהיר ושורת המשך בכתב יד לבן. שקופית בלי תמונה מקבלת רקע כהה חם.
 */
async function renderPhotoSlide(c: Carousel, index: number, images: Record<number, string>): Promise<HTMLCanvasElement> {
  const t = { ...PHOTO_DEFAULT, ...(c.theme ?? {}) };
  const HEAD = fontStack(t.headFont, SANS), BODY = fontStack(t.bodyFont, HAND);
  const hw = boldOf(t.headFont), bw = t.bodyFont === "Amatic SC" ? 700 : regularOf(t.bodyFont) >= 500 ? regularOf(t.bodyFont) : 600;
  await fontCssReady();
  if (document.fonts) await Promise.all([document.fonts.load(`${hw} 80px ${HEAD}`), document.fonts.load(`${bw} 60px ${BODY}`)]).catch(() => {});
  const slide = c.slides[index];
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const photo = images[index] ? await loadImage(images[index]) : null;
  if (t.card) {
    drawFramed(ctx, c, index, photo, t, { HEAD, BODY, hw, bw });
    return canvas;
  }
  if (photo) {
    drawCover(ctx, photo, 0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, `rgba(20,16,12,${(t.overlay * 0.55).toFixed(2)})`);
    g.addColorStop(1, `rgba(20,16,12,${Math.min(0.9, t.overlay * 1.38).toFixed(2)})`);
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = t.bg;
  }
  ctx.fillRect(0, 0, W, H);
  ctx.direction = "rtl";
  ctx.textAlign = t.align === "center" ? "center" : "right";
  const X = t.align === "center" ? W / 2 : W - 100;
  ctx.shadowColor = photo ? "rgba(0,0,0,0.45)" : "transparent";
  ctx.shadowBlur = 18;
  const P = 100;
  const pos = slide.kind === "cover" || slide.kind === "cta" ? "center" : t.position;
  const headSize = Math.round((slide.kind === "cover" ? 112 : 84) * t.headScale);
  const recap = slide.kind === "recap";
  // כתב יד נראה קטן יותר באותו גודל, אז מגדילים אותו
  const bodySize = Math.round((recap ? 52 : 48 * sizeFactor(t.bodyFont)) * t.bodyScale);
  ctx.font = `${hw} ${headSize}px ${HEAD}`;
  const head = wrap(ctx, slide.headline, W - P * 2);
  const rows = recap ? slide.body.split("\n").map((r) => r.replace(/^[-•·\d.\s]+/, "").trim()).filter(Boolean) : [];
  ctx.font = `${bw} ${bodySize}px ${BODY}`;
  const centered = t.align === "center";
  const rr = wrapRows(ctx, rows, W - P * 2 - (centered ? 0 : 40));
  const body = recap ? rr.lines : slide.body ? wrap(ctx, slide.body, W - P * 2) : [];
  const bodyLH = Math.round(bodySize * (recap ? 1.5 : 1.05));
  const total = head.length * headSize * 1.05 + (body.length ? 22 + body.length * bodyLH : 0);
  let y = pos === "center" ? (H - total) / 2 : pos === "top" ? 170 : H - P - 60 - total;
  ctx.fillStyle = t.headColor;
  ctx.font = `${hw} ${headSize}px ${HEAD}`;
  for (const l of head) { y += headSize * 1.05; ctx.fillText(l, X, y - headSize * 0.2); }
  if (body.length) {
    y += 22;
    ctx.fillStyle = t.bodyColor;
    ctx.font = `${bw} ${bodySize}px ${BODY}`;
    body.forEach((l, li) => {
      // שורת המשך של אותה נקודה מקבלת פחות רווח, כדי שיהיה ברור מה שייך למה
      y += recap && !rr.starts.has(li) ? bodySize * 1.12 : bodyLH;
      if (recap && !centered && rr.starts.has(li)) { ctx.save(); ctx.fillStyle = t.accent; ctx.beginPath(); ctx.arc(W - P - 10, y - bodySize * 0.35, 8, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
      ctx.fillText(l, recap && !centered ? W - P - 40 : X, y - 14);
    });
  }
  ctx.shadowBlur = 0;
  ctx.font = `800 30px ${SANS}`;
  ctx.fillStyle = photo ? "rgba(255,255,255,0.85)" : t.bodyColor;
  ctx.textAlign = "left";
  ctx.direction = "ltr";
  if (slide.kind !== "cover") ctx.fillText(`${index + 1}/${c.slides.length}`, P, 100);
  if (c.handle) ctx.fillText(c.handle, P, H - 60);
  return canvas;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * שקופית עם מסגרת חמודה לטקסט, על התמונה (או על רקע, אם אין תמונה):
 * פתק נעוץ, פולרואיד, נייר קרוע עם מסקינטייפ, בועת דיבור, דף מחברת, או שורות על פסי דבק.
 */
function drawFramed(ctx: CanvasRenderingContext2D, c: Carousel, index: number, photo: HTMLImageElement | null, t: typeof PHOTO_DEFAULT & { card?: string }, f: { HEAD: string; BODY: string; hw: number; bw: number }) {
  const slide = c.slides[index];
  const kind = t.card!;
  const tilt = (index % 2 ? 1 : -1) * (kind === "note" ? 2.2 : kind === "polaroid" ? 2.6 : kind === "notebook" ? 1 : kind === "paper" ? 1.2 : 0);
  // רקע: התמונה על כל המסגרת (בפולרואיד: רק בתוך המסגרת)
  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, W, H);
  if (photo && kind !== "polaroid") {
    drawCover(ctx, photo, 0, 0, W, H);
    if (t.overlay) { ctx.fillStyle = `rgba(20,16,12,${t.overlay})`; ctx.fillRect(0, 0, W, H); }
  }
  const big = slide.kind === "cover" || slide.kind === "cta";
  const recap = slide.kind === "recap";
  const CW = kind === "polaroid" ? 780 : kind === "tape" ? 860 : 820;
  const PAD = kind === "bubble" ? 64 : kind === "tape" ? 0 : 72;
  const tw = CW - PAD * 2 - (kind === "notebook" ? 60 : 0);
  const hs = Math.round((big ? 92 : 72) * (kind === "tape" ? 1.12 : 1) * t.headScale), bs = Math.round((recap ? 46 : 42) * sizeFactor(t.bodyFont) * t.bodyScale);
  ctx.direction = "rtl";
  ctx.font = `${f.hw} ${hs}px ${f.HEAD}`;
  const head = wrap(ctx, slide.headline, tw);
  ctx.font = `${f.bw} ${bs}px ${f.BODY}`;
  const rows = recap ? slide.body.split("\n").map((r) => r.replace(/^[-•·\d.\s]+/, "").trim()).filter(Boolean) : [];
  const centerF = t.align === "center" || kind === "polaroid";
  const fr = wrapRows(ctx, rows, tw - (centerF ? 0 : 30));
  const body = recap ? fr.lines : slide.body ? wrap(ctx, slide.body, tw) : [];
  const hl = hs * 1.14, bl = bs * (recap ? 1.5 : 1.3);
  const textH = head.length * hl + (body.length ? 26 + body.length * bl : 0);
  const photoH = kind === "polaroid" ? (photo ? 640 : 0) : 0;
  const CH = kind === "polaroid" ? 44 + photoH + 40 + textH + 70 : Math.max(textH + PAD * 2, kind === "note" ? CW * 0.62 : 0);
  const pos = big || kind === "polaroid" ? "center" : t.position;
  const cx = W / 2;
  const top = pos === "top" ? 150 : pos === "bottom" ? H - 150 - CH : (H - CH) / 2;
  const cy = top + CH / 2;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((tilt * Math.PI) / 180);
  const x0 = -CW / 2, y0 = -CH / 2;
  ctx.shadowColor = "rgba(0,0,0,0.32)"; ctx.shadowBlur = 34; ctx.shadowOffsetY = 16;
  if (kind === "note") {
    ctx.fillStyle = "#FFE98F"; ctx.fillRect(x0, y0, CW, CH);
    ctx.shadowColor = "transparent";
    const g = ctx.createLinearGradient(0, y0 + CH * 0.7, 0, y0 + CH);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(120,90,0,0.10)");
    ctx.fillStyle = g; ctx.fillRect(x0, y0, CW, CH);
    // הנעץ
    ctx.shadowColor = "rgba(0,0,0,0.35)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 5;
    ctx.fillStyle = t.accent; ctx.beginPath(); ctx.arc(0, y0 + 26, 22, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = "transparent"; ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.beginPath(); ctx.arc(-7, y0 + 19, 7, 0, Math.PI * 2); ctx.fill();
  } else if (kind === "polaroid") {
    ctx.fillStyle = "#FFFFFF"; ctx.fillRect(x0, y0, CW, CH);
    ctx.shadowColor = "transparent";
    if (photo) {
      ctx.save(); ctx.beginPath(); ctx.rect(x0 + 40, y0 + 44, CW - 80, photoH); ctx.clip();
      drawCover(ctx, photo, x0 + 40, y0 + 44, CW - 80, photoH); ctx.restore();
    }
  } else if (kind === "paper") {
    ctx.fillStyle = "#FBF8F2";
    ctx.beginPath(); ctx.moveTo(x0, y0 + 10);
    for (let x = x0; x <= x0 + CW; x += 28) ctx.lineTo(x, y0 + (Math.round(x) % 56 === 0 ? 0 : 14));
    ctx.lineTo(x0 + CW, y0 + CH - 10);
    for (let x = x0 + CW; x >= x0; x -= 28) ctx.lineTo(x, y0 + CH - (Math.round(x) % 56 === 0 ? 0 : 14));
    ctx.closePath(); ctx.fill();
    ctx.shadowColor = "transparent";
    // שני פסי מסקינטייפ בפינות
    for (const [tx, rot] of [[x0 + 60, -0.5], [x0 + CW - 60, 0.5]] as const) {
      ctx.save(); ctx.translate(tx, y0 + 6); ctx.rotate(rot);
      ctx.fillStyle = "rgba(230,211,168,0.88)"; ctx.fillRect(-80, -22, 160, 44); ctx.restore();
    }
  } else if (kind === "bubble") {
    ctx.fillStyle = "#FFFFFF"; roundRect(ctx, x0, y0, CW, CH, 56); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x0 + CW - 170, y0 + CH - 4); ctx.lineTo(x0 + CW - 90, y0 + CH + 70); ctx.lineTo(x0 + CW - 90, y0 + CH - 4); ctx.closePath(); ctx.fill();
  } else if (kind === "notebook") {
    ctx.fillStyle = "#FFFFFF"; ctx.fillRect(x0, y0, CW, CH);
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = t.accent; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x0 + CW - 70, y0); ctx.lineTo(x0 + CW - 70, y0 + CH); ctx.stroke();
  }
  ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

  // הטקסט
  const center = t.align === "center" || kind === "polaroid";
  ctx.textAlign = center ? "center" : "right";
  const tx = center ? 0 : x0 + CW - PAD - (kind === "notebook" ? 60 : 0);
  let y = kind === "polaroid" ? y0 + 44 + photoH + 40 : y0 + (CH - textH) / 2;
  // דף מחברת: קו כחול מתחת לכל שורת טקסט
  const rule = (by: number) => {
    if (kind !== "notebook") return;
    ctx.save(); ctx.strokeStyle = "rgba(90,130,200,0.38)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x0 + 20, by + 12); ctx.lineTo(x0 + CW - 20, by + 12); ctx.stroke(); ctx.restore();
  };
  for (const l of head) {
    y += hl;
    if (kind === "tape") {
      ctx.font = `${f.hw} ${hs}px ${f.HEAD}`;
      const lw = Math.min(W - 120, ctx.measureText(l).width + 70);
      ctx.save(); ctx.translate(center ? 0 : tx + 35 - lw / 2, y - hs * 0.35); ctx.rotate(((head.indexOf(l) % 2 ? 1 : -1) * 1.2 * Math.PI) / 180);
      ctx.fillStyle = t.accent; ctx.globalAlpha = 0.95; ctx.fillRect(-lw / 2, -hs * 0.62, lw, hs * 1.12); ctx.globalAlpha = 1; ctx.restore();
    }
    ctx.fillStyle = t.headColor; ctx.font = `${f.hw} ${hs}px ${f.HEAD}`;
    ctx.fillText(l, tx, y - hs * 0.2);
    rule(y - hs * 0.2);
  }
  if (body.length) {
    y += 26;
    for (const l of body) {
      y += bl;
      ctx.font = `${f.bw} ${bs}px ${f.BODY}`;
      if (kind === "tape") {
        const lw = Math.min(W - 160, ctx.measureText(l).width + 50 + (recap ? 30 : 0));
        ctx.fillStyle = "rgba(255,255,255,0.92)"; ctx.fillRect(center ? -lw / 2 : tx + 25 - lw, y - bs * 1.0, lw, bs * 1.25);
      }
      if (recap && !center && fr.starts.has(body.indexOf(l))) { ctx.save(); ctx.fillStyle = kind === "tape" ? t.headColor : t.accent; ctx.beginPath(); ctx.arc(tx - 6, y - bs * 0.38, 7, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
      ctx.fillStyle = t.bodyColor;
      ctx.fillText(l, recap && !center ? tx - 30 : tx, y - bs * 0.22);
      rule(y - bs * 0.22);
    }
  }
  ctx.restore();

  // מספור וכינוי
  ctx.font = `800 30px ${SANS}`;
  ctx.fillStyle = photo && kind !== "polaroid" ? "rgba(255,255,255,0.9)" : "rgba(42,38,34,0.7)";
  ctx.textAlign = "left"; ctx.direction = "ltr";
  if (slide.kind !== "cover") ctx.fillText(`${index + 1}/${c.slides.length}`, 100, 100);
  if (c.handle) ctx.fillText(c.handle, 100, H - 60);
}

export async function renderAll(c: Carousel, images: Record<number, string> = {}) {
  return Promise.all(c.slides.map((_, i) => renderSlide(c, i, images).then((cv) => cv.toDataURL("image/png"))));
}

export async function downloadZip(c: Carousel, name: string, images: Record<number, string> = {}) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  for (let i = 0; i < c.slides.length; i++) {
    const canvas = await renderSlide(c, i, images);
    const blob: Blob = await new Promise((r) => canvas.toBlob((b) => r(b!), "image/png"));
    zip.file(`${String(i + 1).padStart(2, "0")}.png`, blob);
  }
  zip.file("caption.txt", `${c.caption}\n\nAlt: ${c.alt}`);
  const out = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(out);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name.slice(0, 40) || "carousel"}.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
