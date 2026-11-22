/**
 * מעלה את התוכן השבועי לאחסון ומכין SQL שמכניס אותו ללוח (טיוטות, ביום שהן אמורות לעלות).
 * לא מפרסם כלום. שלב הפריטים הוא "טיוטה" עד שהיא מאשרת.
 *
 * שימוש: node publish.mjs <תיקיית השבוע> <תיקיית תמונות jpg> <טוקן העלאה>
 * (רילס: מה-render.mjs נוצר MP4 מקטעי וידאו. קרוסלות: רק תמונות.)
 * הטוקן: מחרוזת אקראית; הגיבוב שלה נשמר קודם ב-studio_secrets (name = 'upload') דרך המסד.
 * הפלט: <תיקיית השבוע>/publish.sql להרצה במסד.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const SUPABASE_URL = "https://szactsolcqhvtyhlhwtb.supabase.co";
// מפתח ציבורי (anon): מותר רק מה שמדיניות האחסון מתירה, כאן רק העלאה לנתיב עם הטוקן
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6YWN0c29sY3FodnR5aGxod3RiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NTA2MjAsImV4cCI6MjA5ODAyNjYyMH0.QT-frnoYHRC_5Ewm1vokf2BxuksYF4us0_5Tqs0cARI";
const NICHE = { story: "home", viral: "meals", value: "meals", trust: "home" };

const [weekDir, photoDir, token, ...flags] = process.argv.slice(2);
if (!weekDir || !photoDir || !token || token.length < 32) { console.error("usage: node publish.mjs <weekDir> <photoDir> <token(32+)> [--clips <clipDir>] [--edit-only]"); process.exit(1); }
const clipDir = flags.includes("--clips") ? flags[flags.indexOf("--clips") + 1] : null;
const editOnly = flags.includes("--edit-only");
const plan = JSON.parse(fs.readFileSync(path.join(weekDir, "plan.json"), "utf8"));
const out = path.resolve(weekDir, "out");
const base = `inbox/${token}/${plan.week}`;

async function upload(file, dest, type) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/media/${dest}`, {
    method: "POST",
    headers: { apikey: ANON, authorization: `Bearer ${ANON}`, "content-type": type },
    body: fs.readFileSync(file),
  });
  if (!res.ok) throw new Error(`upload ${dest}: ${res.status} ${await res.text()}`);
  return dest;
}

/** התמונה לשקופית בעורך הקרוסלות: מוקטנת ל-1350 גובה, JPG */
function slidePhoto(name) {
  const src = path.resolve(photoDir, `${name}.jpg`);
  const dst = path.join(out, `_${name}.jpg`);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", src, "-vf", "scale=-2:1600", "-q:v", "3", dst]);
  return dst;
}

const q = (s) => `'${String(s ?? "").replace(/'/g, "''")}'`;
const sql = ["-- נוצר אוטומטית ע\"י publish.mjs: טיוטות לשבוע " + plan.week, "begin;"];
/**
 * ערכת עריכה לריל: כל קטע (cut) נחתך ומוכן לאנכי, ונכנס לעורך הווידאו כקליפ, והכרטיסים כשכבות טקסט.
 * כך היא עורכת בעצמה בעורך (מחליפה סרטון, משנה טקסט) ומייצאת.
 */
async function editKit(post) {
  if (!clipDir) return null;
  const per = post.montage ? 1.6 : 2.6; // כמו ב-render.mjs
  const segments = [], cards = [];
  let t = 0;
  for (const [i, s] of post.slides.entries()) {
    const cuts = s.clips ?? (s.clip ? [{ clip: s.clip, start: s.start ?? 0 }] : []);
    const d = per + (i === post.slides.length - 1 ? 1.2 : 0);
    const len = d / cuts.length;
    for (const [k, c] of cuts.entries()) {
      const out = path.join(out_, `_seg_${post.id}_${i}_${k}.mp4`);
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(c.start ?? 0), "-i", path.resolve(clipDir, `${c.clip}.mov`), "-t", len.toFixed(2),
        "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,tpad=stop_mode=clone:stop_duration=3", "-t", len.toFixed(2),
        "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "21", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out]);
      segments.push({ path: await upload(out, `${base}/edit/${post.id}/${String(segments.length + 1).padStart(2, "0")}.mp4`, "video/mp4"), seconds: Math.round(len * 100) / 100, width: 1080, height: 1920 });
    }
    cards.push({ text: [s.headline, s.body].filter(Boolean).join(" "), headline: s.headline, body: s.body ?? "", start: Math.round(t * 100) / 100, end: Math.round((t + d) * 100) / 100 });
    t += d;
  }
  return { segments, cards };
}
const out_ = out;

const photoCache = new Map();
async function photo(name) {
  if (!photoCache.has(name)) photoCache.set(name, await upload(slidePhoto(name), `${base}/photos/${name}.jpg`, "image/jpeg"));
  return photoCache.get(name);
}

if (editOnly) {
  // רק ערכות עריכה לרילס שכבר בלוח: מעדכן את הטיוטה הקיימת (לפי כותרת ושבוע)
  for (const post of plan.posts.filter((p) => p.format === "reel")) {
    const kit = await editKit(post);
    if (!kit) throw new Error("--edit-only צריך --clips <clipDir>");
    sql.push(`update public.studio_drafts set data = data || ${q(JSON.stringify({ edit: kit }))}::jsonb where idea = ${q(post.title)} and data->>'weekly' = ${q(plan.week)};`);
    console.log("edit kit", post.id, kit.segments.length);
  }
  sql.push("commit;");
  for (const f of fs.readdirSync(out)) if (f.startsWith("_")) fs.unlinkSync(path.join(out, f));
  fs.writeFileSync(path.join(weekDir, "edit.sql"), sql.join("\n\n") + "\n");
  console.log("wrote edit.sql");
  process.exit(0);
}

for (const post of plan.posts) {
  const data = { content_type: post.content_type, weekly: plan.week };
  const vs = post.variants?.length ? post.variants : [{ id: "A", label: "גרסה A" }];
  const variants = [];
  for (const v of vs) {
    const vid = `${post.id}-${v.id}`;
    const variant = { id: v.id, label: v.label ?? `גרסה ${v.id}` };
    const mp4 = path.join(out, `${vid}.mp4`);
    if (fs.existsSync(mp4)) {
      // ריל: הסרטון של הגרסה
      const seconds = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp4]).toString().trim());
      variant.video = {
        path: await upload(mp4, `${base}/${vid}.mp4`, "video/mp4"),
        cover: await upload(path.join(out, `${vid}-cover.jpg`), `${base}/${vid}-cover.jpg`, "image/jpeg"),
        seconds: Math.round(seconds * 10) / 10,
      };
    } else {
      // קרוסלה: השקופיות של הגרסה, עם התמונות באחסון (לעריכה בעורך הקרוסלות)
      let slides = v.slides ?? post.slides;
      if (v.cover) slides = slides.map((sl, i) => (i === 0 ? { ...sl, ...v.cover } : sl));
      const out2 = [];
      for (const sl of slides) out2.push({ kind: sl.kind, headline: sl.headline, body: sl.body, ...(sl.photo ? { image: { kind: "storage", path: await photo(sl.photo) } } : {}) });
      variant.carousel = { slides: out2, caption: post.caption, alt: post.alt, handle: "@plania.il", style: "photo", ...(plan.brand ? { theme: plan.brand } : {}) };
    }
    variants.push(variant);
    console.log("uploaded", vid);
  }
  data.variants = variants;
  // עד שהיא בוחרת, הטיוטה מציגה את גרסה A
  if (variants[0].video) data.video = variants[0].video;
  if (variants[0].carousel) data.carousel = variants[0].carousel;
  if (post.format !== "carousel") {
    const kit = await editKit(post);
    if (kit) data.edit = kit;
    data.caption = post.caption;
    const per = post.montage ? 1.6 : 2.6; // כמו ב-render.mjs
    data.cards = post.slides.map((sl, i) => ({ text: [sl.headline, sl.body].filter(Boolean).join(" "), start: Math.round(i * per * 10) / 10, end: Math.round((i + 1) * per * 10) / 10, y: 700 }));
  }
  const mode = post.format === "carousel" ? "carousel" : post.montage ? "short" : "full";
  const notes = `${post.idea}\n\nסוג תוכן: ${post.content_type}. ${variants.length} גרסאות לבחירה במסך "לבחירה". נוצר בתהליך השבועי (${plan.week}).`;
  // אם הפוסט כבר בלוח (אותה כותרת ואותו יום), מצרפים אליו את הטיוטה. אחרת יוצרים פריט חדש
  sql.push(`with d as (insert into public.studio_drafts (idea, account, niche, mode, facts, data) values (${q(post.title)}, 'plania.il', ${q(NICHE[post.content_type])}, ${q(mode)}, '', ${q(JSON.stringify(data))}::jsonb) returning id),
u as (update public.studio_items i set draft_id = d.id, content_type = ${q(post.content_type)}, notes = ${q(notes)}, caption = ${q(post.caption)}, hook = ${q(post.slides[0].headline)}
      from d where i.account = 'plania.il' and i.title = ${q(post.title)} and i.planned_date = ${q(post.date)}::date and i.draft_id is null returning i.id)
insert into public.studio_items (title, account, niche, format, stage, planned_date, hook, caption, notes, draft_id, auto, content_type)
select ${q(post.title)}, 'plania.il', ${q(NICHE[post.content_type])}, ${q(post.format)}, 'draft', ${q(post.date)}::date, ${q(post.slides[0].headline)}, ${q(post.caption)}, ${q(notes)}, d.id, false, ${q(post.content_type)} from d
where not exists (select 1 from u);`);
}
sql.push("commit;");
for (const f of fs.readdirSync(out)) if (f.startsWith("_")) fs.unlinkSync(path.join(out, f));
fs.writeFileSync(path.join(weekDir, "publish.sql"), sql.join("\n\n") + "\n");
console.log("wrote publish.sql");
