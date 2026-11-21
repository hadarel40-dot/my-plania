/**
 * מייצר את התוכן השבועי מתוך plan.json:
 * - קרוסלה: PNG לכל שקופית (1080x1350) בסגנון שלה: תמונה מוחשכת, כותרת ורודה, שורה בכתב יד לבן
 * - ריל: MP4 אנכי (1080x1920) רק מקטעי וידאו שלה (clip + start לכל כרטיס), הטקסט נכנס בתנועה, מעבר רך.
 *   אף פעם לא תמונות שעוברות כמו מצגת (המשוב שלה). כל שקופית בקרוסלה חייבת תמונה.
 * שימוש: node render.mjs <תיקיית השבוע> <תיקיית תמונות jpg> <תיקיית סרטונים>
 * בלי מוזיקה: מוסיפים צליל טרנדי באינסטגרם.
 */
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// playwright מותקן גלובלית בסביבה, ו-import רגיל לא מוצא אותו
const { chromium } = createRequire(import.meta.url)("playwright");
const HERE = path.dirname(fileURLToPath(import.meta.url));
const [weekDir, photoDir, clipDir] = process.argv.slice(2);
if (!weekDir || !photoDir || !clipDir) { console.error("usage: node render.mjs <weekDir> <photoDir> <clipDir>"); process.exit(1); }
const plan = JSON.parse(fs.readFileSync(path.join(weekDir, "plan.json"), "utf8"));
const out = path.resolve(weekDir, "out");
fs.mkdirSync(out, { recursive: true });
const fontsCss = fs.readFileSync(path.join(HERE, "fonts/fonts.css"), "utf8").replace(/url\((f\d\.ttf)\)/g, (_, f) => `url(file://${path.join(HERE, "fonts", f)})`);

const PINK = "#F7C9D6";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const photoUrl = (p) => (p ? `file://${path.resolve(photoDir, `${p}.jpg`)}` : "");

/** HTML של שקופית. layer: all (קרוסלה), bg (רק תמונה), text (רק טקסט על רקע שקוף) */
function html(slide, i, n, { w, h, layer, safe }) {
  const isCover = slide.kind === "cover";
  const recap = slide.kind === "recap";
  const rows = recap ? slide.body.split("\n").filter(Boolean) : [];
  // באזור הבטוח של ריל: הטקסט בין 230 ל-1440, והצד הימני (הכפתורים של אינסטגרם בעברית בצד שמאל, אבל משאירים שוליים בשני הצדדים)
  const pad = safe ? "padding: 300px 140px 520px 120px;" : "padding: 110px 100px;";
  const align = isCover || slide.kind === "cta" ? "justify-content:center;" : safe ? "justify-content:center;" : "justify-content:flex-end;";
  const bg = layer !== "text" ? (slide.photo ? `background:#1F1B16 url('${photoUrl(slide.photo)}') center/cover no-repeat;` : "background:#2A2622;") : "background:transparent;";
  const shade = layer === "all" && slide.photo ? `<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(20,16,12,.25),rgba(20,16,12,.62))"></div>` : "";
  const text = layer === "bg" ? "" : `
    <div class="t" style="position:absolute;inset:0;display:flex;flex-direction:column;${align}${pad}">
      ${!safe && !isCover ? `<div class="num">${i + 1}/${n}</div>` : ""}
      <div class="h" style="font-size:${isCover ? (safe ? 118 : 112) : safe ? 96 : 84}px">${esc(slide.headline)}</div>
      ${recap ? `<ul>${rows.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : slide.body ? `<div class="b" style="font-size:${safe ? 92 : 80}px">${esc(slide.body)}</div>` : ""}
      ${!safe ? `<div class="handle">@plania.il</div>` : ""}
    </div>`;
  return `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>
    ${fontsCss}
    html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;background:transparent}
    .s{position:relative;width:${w}px;height:${h}px;${bg}}
    .h{font-family:'Assistant';font-weight:800;color:${PINK};line-height:1.05;text-shadow:0 3px 18px rgba(0,0,0,.45)}
    .b{font-family:'Amatic SC';font-weight:700;color:#fff;line-height:1.05;margin-top:22px;text-shadow:0 3px 14px rgba(0,0,0,.5)}
    ul{margin:30px 0 0;padding:0 50px 0 0;font-family:'Assistant';font-weight:600;font-size:${safe ? 58 : 52}px;color:#fff;line-height:1.5;text-shadow:0 2px 10px rgba(0,0,0,.5)}
    li::marker{color:${PINK}}
    .num{position:absolute;top:70px;left:100px;font-family:'Assistant';font-weight:800;font-size:30px;color:rgba(255,255,255,.8);direction:ltr}
    .handle{position:absolute;bottom:60px;left:100px;font-family:'Assistant';font-weight:800;font-size:30px;color:rgba(255,255,255,.85);direction:ltr}
  </style></head><body><div class="s">${shade}${text}</div></body></html>`;
}

const run = (args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: "inherit" });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
async function shot(htmlStr, file, w, h, transparent) {
  await page.setViewportSize({ width: w, height: h });
  // נטען מקובץ ולא מ-setContent: רק כך הדפדפן מסכים לטעון תמונות וגופנים מקבצים מקומיים
  const tmp = path.join(out, "_slide.html");
  fs.writeFileSync(tmp, htmlStr);
  await page.goto(`file://${tmp}`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: file, omitBackground: transparent, type: file.endsWith(".png") ? "png" : "jpeg", ...(file.endsWith(".jpg") ? { quality: 92 } : {}) });
}

for (const post of plan.posts) {
  const dir = path.join(out, post.id);
  fs.mkdirSync(dir, { recursive: true });
  const n = post.slides.length;

  // קרוסלה סטטית: לכל פוסט של קרוסלה
  if (post.format === "carousel") {
    for (const [i, s] of post.slides.entries()) await shot(html(s, i, n, { w: 1080, h: 1350, layer: "all" }), path.join(dir, `${String(i + 1).padStart(2, "0")}.png`), 1080, 1350, false);
  }

  // קרוסלה: כל שקופית על תמונה
  if (post.format === "carousel") {
    const bare = post.slides.findIndex((s) => !s.photo);
    if (bare >= 0) throw new Error(`${post.id}: שקופית ${bare + 1} בלי תמונה`);
    console.log("done", post.id);
    continue;
  }

  // ריל: רק מקטעי וידאו
  const segs = [];
  const per = post.montage ? 1.6 : 2.6; // שניות לכרטיס
  const fps = 30;
  for (const [i, s] of post.slides.entries()) {
    if (!s.clip) throw new Error(`${post.id}: כרטיס ${i + 1} בלי קטע וידאו`);
    const clip = path.resolve(clipDir, `${s.clip}.mov`);
    const fg = path.join(dir, `fg${i}.png`), seg = path.join(dir, `seg${i}.mp4`);
    await shot(html(s, i, n, { w: 1080, h: 1920, layer: "text", safe: true }), fg, 1080, 1920, true);
    const d = per + (i === n - 1 ? 1.2 : 0);
    // הקטע: חיתוך למילוי המסך האנכי, הכהיה קלה, ואם הוא קצר מדי הפריים האחרון מוחזק
    run(["-ss", String(s.start ?? 0), "-i", clip, "-loop", "1", "-i", fg, "-filter_complex",
      `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=${fps},tpad=stop_mode=clone:stop_duration=${d},` +
      `eq=brightness=-0.06:saturation=0.97,drawbox=c=black@0.30:t=fill,setsar=1[b];` +
      `[1:v]format=rgba,fade=t=in:st=0.1:d=0.4:alpha=1[t];` +
      `[b][t]overlay=x=0:y='if(lt(t,0.5),40*(1-t/0.5),0)':format=auto,format=yuv420p[v]`,
      "-map", "[v]", "-an", "-t", String(d), "-r", String(fps), "-c:v", "libx264", "-preset", "medium", "-crf", "19", seg]);
    segs.push({ file: seg, d });
  }
  // מעבר רך בין השקופיות
  const xf = post.montage ? 0.15 : 0.3;
  const inputs = segs.flatMap((s) => ["-i", s.file]);
  let chain = "", last = "[0:v]", offset = 0;
  segs.slice(1).forEach((s, k) => {
    offset += segs[k].d - xf;
    const lab = `[x${k}]`;
    chain += `${last}[${k + 1}:v]xfade=transition=fade:duration=${xf}:offset=${offset.toFixed(2)}${lab};`;
    last = lab;
  });
  const video = path.join(out, `${post.id}.mp4`);
  run([...inputs, "-filter_complex", chain.replace(/;$/, ""), "-map", last, "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", video]);
  // תמונת שער לריל
  run(["-i", video, "-ss", "1.0", "-frames:v", "1", path.join(out, `${post.id}-cover.jpg`)]);
  for (const f of fs.readdirSync(dir)) if (/^(bg|fg|seg)\d/.test(f)) fs.unlinkSync(path.join(dir, f));
  console.log("done", post.id);
}
await browser.close();
fs.rmSync(path.join(out, "_slide.html"), { force: true });
