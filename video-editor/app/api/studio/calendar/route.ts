import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

type Row = { id: string; title: string; format: string; planned_date: string; post_time: string | null; caption: string | null; stage: string; draft_id: string | null; account: string; updated_at: string };

const FORMAT: Record<string, string> = { reel: "ריל", carousel: "קרוסלה", story: "סטורי", image: "תמונה" };
/** טקסט בטוח ל-ics: בורחים מתווים מיוחדים, וקופלים שורות ארוכות */
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
function fold(line: string) {
  const out: string[] = [];
  let cur = "";
  for (const ch of line) {
    if (new TextEncoder().encode(cur + ch).length > 72) { out.push(cur); cur = " " + ch; } else cur += ch;
  }
  out.push(cur);
  return out.join("\r\n");
}
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const addMin = (hhmm: string, m: number) => { const [h, mm] = hhmm.split(":").map(Number); const t = h * 60 + mm + m; return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}${String(t % 60).padStart(2, "0")}00`; };

/**
 * יומן מנויים: כל פוסט עם יום (ושעה, אם נקבעה) הופך לאירוע "לפרסם", עם תזכורת בזמן ורבע שעה לפני.
 * אפליקציית היומן מושכת את הקישור הזה מעצמה, כך שכל שינוי בלוח מגיע ליומן. מוגן בקוד סודי.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const k = url.searchParams.get("k") ?? "";
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("studio_calendar_feed", { p_token: k });
  if (error) return new Response("not allowed", { status: 401 });
  const origin = `${url.protocol}//${url.host}`;
  const now = stamp(new Date());
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Plania//Studio//HE", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:Plania · לפרסם", "X-WR-TIMEZONE:Asia/Jerusalem", "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H",
  ];
  for (const r of (data ?? []) as Row[]) {
    const day = r.planned_date.replace(/-/g, "");
    const done = r.stage === "published";
    const link = r.draft_id ? `${origin}/studio/reel?id=${r.draft_id}` : `${origin}/studio/board`;
    const summary = `${done ? "פורסם: " : "לפרסם: "}${FORMAT[r.format] ?? r.format} · ${r.title}`;
    const desc = [`@${r.account}`, r.caption ? `הכיתוב:\n${r.caption}` : "", `לפתוח בסטודיו: ${link}`].filter(Boolean).join("\n\n");
    lines.push("BEGIN:VEVENT", `UID:${r.id}@plania-studio`, `DTSTAMP:${now}`, `LAST-MODIFIED:${stamp(new Date(r.updated_at))}`);
    if (r.post_time) {
      lines.push(`DTSTART;TZID=Asia/Jerusalem:${day}T${r.post_time.replace(":", "")}00`, `DTEND;TZID=Asia/Jerusalem:${day}T${addMin(r.post_time, 15)}`);
    } else {
      // בלי שעה: אירוע של כל היום, עם תזכורת בבוקר
      const next = new Date(`${r.planned_date}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
      lines.push(`DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${next.toISOString().slice(0, 10).replace(/-/g, "")}`);
    }
    lines.push(fold(`SUMMARY:${esc(summary)}`), fold(`DESCRIPTION:${esc(desc)}`), fold(`URL:${link}`), "TRANSP:TRANSPARENT");
    if (!done) {
      if (r.post_time) {
        lines.push("BEGIN:VALARM", "ACTION:DISPLAY", fold(`DESCRIPTION:${esc(`עוד רבע שעה: ${summary}`)}`), "TRIGGER:-PT15M", "END:VALARM");
        lines.push("BEGIN:VALARM", "ACTION:DISPLAY", fold(`DESCRIPTION:${esc(`הגיע הזמן: ${summary}`)}`), "TRIGGER:PT0M", "END:VALARM");
      } else {
        lines.push("BEGIN:VALARM", "ACTION:DISPLAY", fold(`DESCRIPTION:${esc(`היום: ${summary}`)}`), "TRIGGER:PT9H", "END:VALARM");
      }
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return new Response(lines.join("\r\n") + "\r\n", {
    headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": 'inline; filename="plania.ics"', "cache-control": "no-store" },
  });
}
