import { NextResponse } from "next/server";
import { driveAccessToken, driveConfigured } from "@/lib/studio/drive";
import { StudioError, requireStudioAdmin } from "@/lib/studio/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** חתיכה מקסימלית לבקשה אחת, כדי שכל תשובה תהיה קטנה ומהירה (הנגן מבקש את מה שהוא צריך) */
const MAX = 3 * 1024 * 1024;
/** גודל וסוג של קובץ, נשמרים בזיכרון של השרת כדי שכל בקשת טווח לא תשאל את הדרייב מחדש */
const metaCache = new Map<string, { size: number; mimeType: string }>();

/**
 * סרטון מהדרייב שמתנגן ישר בנגן, בלי להעתיק אותו: הנגן מבקש טווחי בתים (Range),
 * והשרת מביא בדיוק אותם מהדרייב. רק למנהלת. כך גם סרטון אייפון גדול עובד, כי יורד רק מה שמתנגן.
 */
async function handle(request: Request, head: boolean) {
  try {
    await requireStudioAdmin();
    const id = new URL(request.url).searchParams.get("id") ?? "";
    if (!driveConfigured() || !/^[\w-]{10,}$/.test(id)) return new NextResponse(null, { status: 404 });
    const token = await driveAccessToken();
    const meta = metaCache.get(id) ?? await fetch(`https://www.googleapis.com/drive/v3/files/${id}?fields=size,mimeType&supportsAllDrives=true`, { headers: { authorization: `Bearer ${token}` }, cache: "no-store" }).then((r) => r.json());
    if (meta?.size) metaCache.set(id, { size: Number(meta.size), mimeType: meta.mimeType });
    const size = Number(meta?.size ?? 0);
    if (!size) return new NextResponse(null, { status: 404 });
    // MOV של אייפון מתנגן בדפדפנים כ-mp4
    const type = meta.mimeType === "video/quicktime" ? "video/mp4" : meta.mimeType || "video/mp4";
    const base = { "accept-ranges": "bytes", "content-type": type, "cache-control": "private, max-age=3600" };
    if (head) return new NextResponse(null, { status: 200, headers: { ...base, "content-length": String(size) } });

    const m = (request.headers.get("range") ?? "").match(/bytes=(\d*)-(\d*)/);
    let start = m?.[1] ? Number(m[1]) : 0;
    let end = m?.[2] ? Number(m[2]) : size - 1;
    if (m && !m[1] && m[2]) { start = Math.max(0, size - Number(m[2])); end = size - 1; }
    end = Math.min(end, size - 1, start + MAX - 1);
    if (start >= size || start > end) return new NextResponse(null, { status: 416, headers: { "content-range": `bytes */${size}` } });

    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`, {
      headers: { authorization: `Bearer ${token}`, range: `bytes=${start}-${end}` }, cache: "no-store",
    });
    if (!res.ok && res.status !== 206) { console.warn("drive-stream", id, res.status); return new NextResponse(null, { status: 502 }); }
    return new NextResponse(res.body, {
      status: 206,
      headers: { ...base, "content-range": `bytes ${start}-${end}/${size}`, "content-length": String(end - start + 1) },
    });
  } catch (e) {
    return new NextResponse(null, { status: e instanceof StudioError ? e.status : 500 });
  }
}

export const GET = (request: Request) => handle(request, false);
export const HEAD = (request: Request) => handle(request, true);
