import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnabled } from "@/lib/supabase/env";
import { anonClient, keyFrom } from "@/lib/content/api";

export const dynamic = "force-dynamic";

/**
 * דיווח מתרחיש הפרסום אחרי כל פוסט:
 * { "id": "...", "ok": true, "ig_media_id": "...", "permalink": "https://www.instagram.com/..." }
 * או { "id": "...", "ok": false, "error": "..." }
 */
export async function POST(req: NextRequest) {
  if (!supabaseEnabled) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const key = keyFrom(req);
  if (!key) return NextResponse.json({ error: "missing key" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const id = typeof body?.id === "string" ? body.id : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const ok = body?.ok === true || body?.ok === "true";
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 1000) : null);

  const { error } = await anonClient().rpc("content_report", {
    p_key: key, p_id: id, p_ok: ok,
    p_ig_media_id: str(body?.ig_media_id), p_permalink: str(body?.permalink), p_error: str(body?.error),
  });
  if (error) {
    const status = error.code === "28000" ? 401 : error.code === "P0002" ? 404 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ ok: true });
}
