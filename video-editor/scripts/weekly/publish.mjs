/**
 * מעלה את התוכן השבועי לאחסון ומכין SQL שמכניס אותו ללוח (טיוטות, ביום שהן אמורות לעלות).
 * לא מפרסם כלום. שלב הפריטים הוא "טיוטה" עד שהיא מאשרת.
 *
 * שימוש: node publish.mjs <תיקיית השבוע> <תיקיית תמונות jpg> <טוקן העלאה>
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

const [weekDir, photoDir, token] = process.argv.slice(2);
if (!weekDir || !photoDir || !token || token.length < 32) { console.error("usage: node publish.mjs <weekDir> <photoDir> <token(32+)>"); process.exit(1); }
const plan = JSON.parse(fs.readFileSync(path.join(weekDir, "plan.json"), "utf8"));
const out = path.resolve(weekDir, "out");
const base = `inbox/${token}/${plan.week}`;

async function upload(file, dest, type) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/media/${dest}`, {
    method: "POST",
    headers: { apikey: ANON, authorization: `Bearer ${ANON}`, "content-type": type, "x-upsert": "true" },
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
for (const post of plan.posts) {
  const video = await upload(path.join(out, `${post.id}.mp4`), `${base}/${post.id}.mp4`, "video/mp4");
  const cover = await upload(path.join(out, `${post.id}-cover.jpg`), `${base}/${post.id}-cover.jpg`, "image/jpeg");
  const seconds = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path.join(out, `${post.id}.mp4`)]).toString().trim());
  const data = { content_type: post.content_type, video: { path: video, cover, seconds: Math.round(seconds * 10) / 10 }, weekly: plan.week };
  let mode = post.montage ? "short" : "full";
  if (post.format === "carousel") {
    mode = "carousel";
    const slides = [];
    for (const s of post.slides) {
      const slide = { kind: s.kind, headline: s.headline, body: s.body };
      if (s.photo) slide.image = { kind: "storage", path: await upload(slidePhoto(s.photo), `${base}/photos/${s.photo}.jpg`, "image/jpeg") };
      slides.push(slide);
    }
    data.carousel = { slides, caption: post.caption, alt: post.alt, handle: "@plania.il", style: "photo" };
  } else {
    data.caption = post.caption;
    // הכרטיסים על המסך, לעריכה בעורך הווידאו
    const per = post.montage ? 1.6 : 2.6; // כמו ב-render.mjs
    data.cards = post.slides.map((s, i) => ({ text: [s.headline, s.body].filter(Boolean).join(" "), start: Math.round(i * per * 10) / 10, end: Math.round((i + 1) * per * 10) / 10, y: 700 }));
  }
  const notes = `${post.idea}\n\nסוג תוכן: ${post.content_type}. נוצר בתהליך השבועי (${plan.week}).`;
  sql.push(`with d as (insert into public.studio_drafts (idea, account, niche, mode, facts, data) values (${q(post.title)}, 'plania.il', ${q(NICHE[post.content_type])}, ${q(mode)}, '', ${q(JSON.stringify(data))}::jsonb) returning id)
insert into public.studio_items (title, account, niche, format, stage, planned_date, hook, caption, notes, draft_id, auto, content_type)
select ${q(post.title)}, 'plania.il', ${q(NICHE[post.content_type])}, ${q(post.format)}, 'draft', ${q(post.date)}::date, ${q(post.slides[0].headline)}, ${q(post.caption)}, ${q(notes)}, d.id, false, ${q(post.content_type)} from d;`);
  console.log("uploaded", post.id);
}
sql.push("commit;");
for (const f of fs.readdirSync(out)) if (f.startsWith("_")) fs.unlinkSync(path.join(out, f));
fs.writeFileSync(path.join(weekDir, "publish.sql"), sql.join("\n\n") + "\n");
console.log("wrote publish.sql");
