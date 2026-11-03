import { NextResponse } from "next/server";
import { trackFileUrl } from "@/lib/music/openverse";
import { supabaseEnabled } from "@/lib/supabase/env";
import { getUser } from "@/lib/supabase/server";

const MAX_BYTES = 25 * 1024 * 1024;

/**
 * קובץ השמע של שיר מהספרייה, דרך השרת שלנו: כך הדפדפן מקבל אותו מאותו מקור
 * (בלי בעיות CORS), גם להשמעה וגם לשמירה בפרויקט.
 */
export async function GET(request: Request) {
  if (supabaseEnabled && !(await getUser()).user) return NextResponse.json({ error: "צריך להתחבר" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const url = await trackFileUrl(id);
  if (!url) return NextResponse.json({ error: "השיר לא נמצא" }, { status: 404 });
  const upstream = await fetch(url);
  const size = Number(upstream.headers.get("content-length") ?? 0);
  if (!upstream.ok || !upstream.body) return NextResponse.json({ error: "השיר לא זמין" }, { status: 502 });
  if (size > MAX_BYTES) return NextResponse.json({ error: "השיר גדול מדי" }, { status: 413 });
  return new Response(upstream.body, {
    headers: {
      "content-type": "audio/mpeg",
      ...(size ? { "content-length": String(size) } : {}),
      "cache-control": "private, max-age=3600",
    },
  });
}
