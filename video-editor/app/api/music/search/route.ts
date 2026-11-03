import { NextResponse } from "next/server";
import { searchMusic } from "@/lib/music/openverse";
import { supabaseEnabled } from "@/lib/supabase/env";
import { getUser } from "@/lib/supabase/server";

/** חיפוש בספריית המוזיקה החינמית */
export async function GET(request: Request) {
  if (supabaseEnabled && !(await getUser()).user) return NextResponse.json({ error: "צריך להתחבר" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim().slice(0, 100);
  if (!q) return NextResponse.json({ tracks: [] });
  try {
    const tracks = await searchMusic(q, Math.max(1, Math.min(10, Number(searchParams.get("page")) || 1)));
    return NextResponse.json({ tracks });
  } catch {
    return NextResponse.json({ error: "ספריית המוזיקה לא זמינה כרגע, נסו שוב בעוד רגע" }, { status: 502 });
  }
}
