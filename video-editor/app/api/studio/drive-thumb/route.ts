import { NextResponse } from "next/server";
import { driveAccessToken, driveConfigured } from "@/lib/studio/drive";
import { StudioError, requireStudioAdmin } from "@/lib/studio/server";

export const dynamic = "force-dynamic";

/** תמונה ממוזערת של קובץ בדרייב, רק למנהלת (הקישורים של גוגל דורשים הרשאה) */
export async function GET(request: Request) {
  try {
    await requireStudioAdmin();
    const url = new URL(request.url);
    const id = url.searchParams.get("id") ?? "";
    const size = Math.min(1600, Math.max(100, Number(url.searchParams.get("size")) || 400));
    if (!driveConfigured() || !/^[\w-]{10,}$/.test(id)) return new NextResponse(null, { status: 404 });
    const token = await driveAccessToken();
    const meta = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?fields=thumbnailLink&supportsAllDrives=true`, { headers: { authorization: `Bearer ${token}` }, cache: "no-store" }).then((r) => r.json());
    if (!meta?.thumbnailLink) return new NextResponse(null, { status: 404 });
    const img = await fetch(String(meta.thumbnailLink).replace(/=s\d+$/, `=s${size}`), { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!img.ok) return new NextResponse(null, { status: 404 });
    return new NextResponse(img.body, { headers: { "content-type": img.headers.get("content-type") ?? "image/jpeg", "cache-control": "private, max-age=3600" } });
  } catch (e) {
    return new NextResponse(null, { status: e instanceof StudioError ? e.status : 500 });
  }
}
