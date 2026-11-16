import { NextResponse, type NextRequest } from "next/server";
import { anonClient, keyFrom } from "@/lib/content/api";
import { publicUrl, type ContentItem } from "@/lib/content/types";
import { supabaseEnabled } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

/**
 * לתרחיש הפרסום (Make): מחזיר את הפוסטים המאושרים שהגיע זמנם, ומסמן אותם "בפרסום".
 * כל פוסט מגיע עם כתובות פתוחות לקבצים, כפי שאינסטגרם צריכה.
 */
export async function GET(req: NextRequest) {
  if (!supabaseEnabled) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const key = keyFrom(req);
  if (!key) return NextResponse.json({ error: "missing key" }, { status: 401 });

  const { data, error } = await anonClient().rpc("content_take_due", { p_key: key });
  if (error) {
    const unauthorized = error.code === "28000";
    return NextResponse.json({ error: unauthorized ? "invalid key" : error.message }, { status: unauthorized ? 401 : 500 });
  }

  const items = ((data ?? []) as ContentItem[]).map((c) => {
    const video = c.media.find((m) => m.type === "video");
    const image = c.media.find((m) => m.type === "image");
    return {
      id: c.id,
      account: c.account,
      format: c.format,
      title: c.title,
      caption: c.caption,
      scheduled_at: c.scheduled_at,
      video_url: video ? publicUrl(video.path) : null,
      image_url: image ? publicUrl(image.path) : null,
      media: c.media.map((m) => ({ type: m.type, url: publicUrl(m.path) })),
    };
  });
  return NextResponse.json({ count: items.length, items });
}
