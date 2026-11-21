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
const fontsCss = ".lat{font-family:'Assistant'!important;font-weight:700}.b .lat,.body .lat{font-size:.7em}\n" + fs.readFileSync(path.join(HERE, "fonts/fonts.css"), "utf8").replace(/url\((f\d\.ttf)\)/g, (_, f) => `url(file://${path.join(HERE, "fonts", f)})`);

const PINK = "#F7C9D6";
// מילים באנגלית (Plania) בגופן הרגיל: בגופן כתב היד הן יוצאות באותיות גדולות
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/[A-Za-z][A-Za-z.]*/g, (m) => `<span class="lat">${m}</span>`);
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

/**
 * כתוביות לריל (שונות מהקרוסלות): כל מילה קופצת בתורה.
 * הכותרת בתיבות ורודות לכל שורה (טקסט כהה), שורת ההמשך בכתב יד לבן עם צל.
 * shown: כמה מילים כבר הופיעו. מילים שעוד לא הופיעו שקופות, כדי שהשורות לא יזוזו.
 */
function reelText(slide, shown, style = "chips") {
  if (style === "lines") return reelLines(slide, shown);
  if (style === "pop") return reelPop(slide, shown);
  const hw = slide.headline.split(/\s+/).filter(Boolean);
  const bw = (slide.body || "").split(/\s+/).filter(Boolean);
  let k = 0;
  const word = (w, cls) => `<span class="${cls}${k++ < shown ? "" : " off"}">${esc(w)}</span>`;
  const head = hw.map((w) => word(w, "hw")).join(" ");
  const body = bw.map((w) => word(w, "bw")).join(" ");
  return `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>
    ${fontsCss}
    html,body{margin:0;width:1080px;height:1920px;background:transparent;overflow:hidden}
    .wrap{position:absolute;left:130px;right:130px;top:980px;text-align:center}
    .head{font-family:'Assistant';font-weight:800;font-size:92px;line-height:1.32}
    .hw{background:${PINK};color:#2A2622;padding:2px 18px 10px;border-radius:18px;box-decoration-break:clone;-webkit-box-decoration-break:clone;box-shadow:0 6px 24px rgba(0,0,0,.18)}
    .body{margin-top:26px;font-family:'Amatic SC';font-weight:700;font-size:96px;line-height:1.05;color:#fff;text-shadow:0 2px 3px rgba(0,0,0,.55),0 4px 22px rgba(0,0,0,.45)}
    .off{visibility:hidden}
  </style></head><body><div class="wrap"><div class="head">${head}</div>${body ? `<div class="body">${body}</div>` : ""}</div></body></html>`;
}
/** שורה אחרי שורה: הכותרת נכנסת שלמה, ואחריה שורת ההמשך. טקסט לבן גדול עם צל, בלי תיבות */
function reelLines(slide, shown) {
  const units = [slide.headline, slide.body].filter(Boolean);
  return `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>
    ${fontsCss}
    html,body{margin:0;width:1080px;height:1920px;background:transparent;overflow:hidden}
    .wrap{position:absolute;left:120px;right:120px;top:900px;text-align:center}
    .h{font-family:'Assistant';font-weight:800;font-size:104px;line-height:1.08;color:#fff;text-shadow:0 3px 4px rgba(0,0,0,.6),0 6px 30px rgba(0,0,0,.5)}
    .b{margin-top:22px;font-family:'Assistant';font-weight:600;font-size:64px;line-height:1.15;color:${PINK};text-shadow:0 2px 4px rgba(0,0,0,.6),0 4px 22px rgba(0,0,0,.5)}
    .off{visibility:hidden}
  </style></head><body><div class="wrap">${units.map((u, i) => `<div class="${i ? "b" : "h"}${i < shown ? "" : " off"}">${esc(u)}</div>`).join("")}</div></body></html>`;
}

/** מילה אחת בכל פעם, גדולה במרכז: כל מילה מחליפה את הקודמת */
function reelPop(slide, shown) {
  const words = (slide.headline + " " + (slide.body || "")).split(/\s+/).filter(Boolean);
  const hwN = slide.headline.split(/\s+/).filter(Boolean).length;
  const w = words[Math.max(0, shown - 1)] ?? "";
  const isHead = shown <= hwN;
  return `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>
    ${fontsCss}
    html,body{margin:0;width:1080px;height:1920px;background:transparent;overflow:hidden}
    .w{position:absolute;left:100px;right:100px;top:860px;text-align:center;font-family:'Assistant';font-weight:800;font-size:${isHead ? 150 : 120}px;line-height:1;
       color:${isHead ? "#fff" : PINK};-webkit-text-stroke:${isHead ? `3px ${PINK}` : "0"};text-shadow:0 4px 6px rgba(0,0,0,.55),0 8px 34px rgba(0,0,0,.45)}
  </style></head><body><div class="w">${esc(w)}</div></body></html>`;
}

const unitCount = (s, style) => (style === "lines" ? [s.headline, s.body].filter(Boolean).length : wordCount(s));
const wordCount = (s) => (s.headline + " " + (s.body || "")).split(/\s+/).filter(Boolean).length;

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

// גרסאות: כל פוסט יוצא בכמה גרסאות (variants), והיא בוחרת בדשבורד.
// גרסה יכולה להחליף סגנון כתוביות (caption_style), את השער (cover) או את כל השקופיות (slides).
const jobs = plan.posts.flatMap((post) => (post.variants?.length ? post.variants : [{ id: "A" }]).map((v) => {
  let slides = v.slides ?? post.slides;
  if (v.cover) slides = slides.map((sl, i) => (i === 0 ? { ...sl, ...v.cover } : sl));
  return { ...post, id: `${post.id}-${v.id}`, slides, captionStyle: v.caption_style ?? "chips" };
}));
for (const post of jobs) {
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
    // כמה קטעים קצרים לכל כרטיס (clips), או קטע אחד (clip)
    const cuts = s.clips ?? (s.clip ? [{ clip: s.clip, start: s.start ?? 0 }] : []);
    if (!cuts.length) throw new Error(`${post.id}: כרטיס ${i + 1} בלי קטע וידאו`);
    const seg = path.join(dir, `seg${i}.mp4`);
    const d = per + (i === n - 1 ? 1.2 : 0);
    // מילה אחרי מילה: תמונת שכבה לכל מצב, ומופיעה בזמן שלה
    const words = unitCount(s, post.captionStyle);
    const step = post.captionStyle === "lines" ? Math.min(0.7, (d * 0.5) / words) : post.captionStyle === "pop" ? (d * 0.85) / words : Math.min(0.22, (d * 0.6) / words);
    const layers = [];
    for (let w = 1; w <= words; w++) {
      const f = path.join(dir, `fg${i}_${w}.png`);
      await shot(reelText(s, w, post.captionStyle), f, 1080, 1920, true);
      layers.push(f);
    }
    const t0 = 0.15;
    // הקטעים נחתכים ומחוברים בחיתוך חד, ורק אז הכתוביות עולות מעליהם
    const cutLen = d / cuts.length;
    let fc = "";
    cuts.forEach((_, c) => {
      fc += `[${c}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=${fps},tpad=stop_mode=clone:stop_duration=${cutLen.toFixed(2)},trim=duration=${cutLen.toFixed(2)},setpts=PTS-STARTPTS,setsar=1[c${c}];`;
    });
    fc += `${cuts.map((_, c) => `[c${c}]`).join("")}concat=n=${cuts.length}:v=1:a=0[v0];`;
    const L = cuts.length; // אינדקס הקלט הראשון של שכבות הכתוביות
    layers.forEach((_, w) => {
      const from = (t0 + w * step).toFixed(2);
      const to = w === layers.length - 1 ? d.toFixed(2) : (t0 + (w + 1) * step).toFixed(2);
      fc += `[v${w}][${w + L}:v]overlay=0:0:enable='between(t,${from},${to})'[v${w + 1}];`;
    });
    fc += `[v${layers.length}]format=yuv420p[out]`;
    run([...cuts.flatMap((c) => ["-ss", String(c.start ?? 0), "-i", path.resolve(clipDir, `${c.clip}.mov`)]), ...layers.flatMap((f) => ["-loop", "1", "-i", f]), "-filter_complex", fc,
      "-map", "[out]", "-an", "-t", String(d), "-r", String(fps), "-c:v", "libx264", "-preset", "medium", "-crf", "19", seg]);
    segs.push({ file: seg, d });
  }
  // מעבר רך בין השקופיות
  const xf = 0.12;
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
