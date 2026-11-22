import { NextResponse } from "next/server";
import { driveAccessToken, driveConfigured, listDriveMedia } from "@/lib/studio/drive";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** מקסימום לחתיכה: מתחת למגבלת התשובה של Vercel */
const CHUNK = 4 * 1024 * 1024;

/**
 * לתהליך השבועי (קלוד קוד): השרת מוריד מהדרייב בשמו, ומחזיר את הקובץ בחתיכות.
 * הטוקן של חשבון השירות לא יוצא מהשרת. מוגן באותו סוד של המשימות האוטומטיות (CRON_SECRET).
 *   ?list=1                     רשימת הסרטונים והתמונות בתיקייה (GOOGLE_DRIVE_FOLDER)
 *   ?id=<fileId>&start=<byte>   חתיכה של עד 4MB מהקובץ, מהבייט start
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "not allowed" }, { status: 401 });
  }
  if (!driveConfigured()) return NextResponse.json({ error: "drive not configured" }, { status: 400 });
  const url = new URL(request.url);

  if (url.searchParams.get("list")) {
    try {
      const files = await listDriveMedia(null, 500);
      return NextResponse.json({ files: files.map((f) => ({ id: f.id, name: f.name, mimeType: f.mimeType, size: f.size, modifiedTime: f.modifiedTime })) });
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
  }

  const id = url.searchParams.get("id") ?? "";
  if (!/^[\w-]{10,}$/.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const start = Math.max(0, Number(url.searchParams.get("start") ?? 0) || 0);
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`, {
    headers: { authorization: `Bearer ${await driveAccessToken()}`, range: `bytes=${start}-${start + CHUNK - 1}` },
    cache: "no-store",
  });
  if (!res.ok && res.status !== 206) return NextResponse.json({ error: `drive ${res.status}` }, { status: res.status === 416 ? 416 : 502 });
  const body = await res.arrayBuffer();
  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": "application/octet-stream",
      "cache-control": "no-store",
      // הגודל המלא, כדי שהמוריד יידע מתי לעצור
      "x-total-size": res.headers.get("content-range")?.split("/")[1] ?? String(body.byteLength),
    },
  });
}
