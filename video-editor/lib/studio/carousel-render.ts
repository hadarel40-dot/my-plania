"use client";
import type { Carousel, Slide } from "./config";

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
const SANS = '"Assistant", "Heebo", Arial, sans-serif';
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

export async function renderSlide(c: Carousel, index: number): Promise<HTMLCanvasElement> {
  if (document.fonts) {
    await Promise.all([document.fonts.load(`900 80px ${SERIF}`), document.fonts.load(`600 40px ${SANS}`), document.fonts.load(`800 26px ${SANS}`)]).catch(() => {});
  }
  const slide = c.slides[index];
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  const bg = slide.kind === "cover" ? BUTTER : slide.kind === "cta" ? INK : CREAM;
  const fg = slide.kind === "cta" ? CREAM : INK;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // מספור, כדי שרואים איפה נגמר
  ctx.font = `800 26px ${SANS}`;
  ctx.fillStyle = slide.kind === "cta" ? "#CFC6B7" : MUTED;
  ctx.textAlign = "left";
  ctx.direction = "ltr";
  ctx.fillText(`${index + 1}/${c.slides.length}`, M, M);
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  const label = slide.kind === "point" ? `${c.slides.slice(0, index + 1).filter((s) => s.kind === "point").length}` : KIND[slide.kind];
  if (label) ctx.fillText(label, W - M, M);

  if (slide.kind === "cover") {
    let y = block(ctx, slide.headline, (s) => `900 ${s}px ${SERIF}`, 120, 330, 560, INK, 1.08);
    ctx.fillStyle = INK;
    ctx.fillRect(W - M - 160, y + 40, 160, 8);
    y = block(ctx, slide.body, (s) => `600 ${s}px ${SANS}`, 46, y + 70, 260, INK, 1.3);
  } else if (slide.kind === "recap") {
    let y = block(ctx, slide.headline, (s) => `900 ${s}px ${SERIF}`, 76, 200, 220, fg, 1.1);
    const rows = slide.body.split("\n").map((r) => r.replace(/^[-•·\d.\s]+/, "").trim()).filter(Boolean);
    ctx.font = `600 40px ${SANS}`;
    for (const r of rows) {
      ctx.fillStyle = INK;
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
    block(ctx, slide.body, (s) => `600 ${s}px ${SANS}`, 44, y + 50, H - y - 50 - M - 90, slide.kind === "cta" ? "#E9E2D6" : "#3A332B", 1.35);
  }

  // הכינוי בכל שקופית, קטן, בפינה: צילומי מסך מסתובבים בלי ההקשר
  if (c.handle) {
    ctx.font = `700 26px ${SANS}`;
    ctx.fillStyle = slide.kind === "cta" ? "#CFC6B7" : MUTED;
    ctx.textAlign = "left";
    ctx.direction = "ltr";
    ctx.fillText(c.handle, M, H - M + 40);
  }
  return canvas;
}

export async function renderAll(c: Carousel) {
  return Promise.all(c.slides.map((_, i) => renderSlide(c, i).then((cv) => cv.toDataURL("image/png"))));
}

export async function downloadZip(c: Carousel, name: string) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  for (let i = 0; i < c.slides.length; i++) {
    const canvas = await renderSlide(c, i);
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
