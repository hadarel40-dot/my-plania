import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { autoDraft, autoSuggest, cronStore } from "@/lib/studio/auto";
import { researchTrends } from "@/lib/studio/insights";
import { todayIL } from "@/lib/studio/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * מחקר הטרנדים של כל בוקר, ואחריו התוכן האוטומטי (Vercel Cron, ראו vercel.json). אין כאן משתמשת מחוברת:
 * Vercel שולח את CRON_SECRET, ומסד הנתונים בודק את אותו סוד (שמור אצלו כ-hash) לפני כל כתיבה.
 * רץ פעם אחת ביום לכל היותר.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "not allowed" }, { status: 401 });
  }
  const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });

  // תוכן אוטומטי: ?job=ideas (רעיונות לתור) או ?job=draft (טיוטה אחת ושיבוץ). כל ריצה קצרה
  const job = new URL(request.url).searchParams.get("job");
  if (job === "ideas" || job === "draft") {
    try {
      const store = cronStore(db, secret);
      return NextResponse.json(job === "ideas" ? await autoSuggest(store) : await autoDraft(store));
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
  }

  const date = todayIL();
  const call = (p_status: string | null, p_items: unknown = null, p_dropped = 0, p_error: string | null = null) =>
    db.rpc("studio_cron_trends", { p_secret: secret, p_date: date, p_status, p_items, p_dropped, p_error });

  const { data: status, error } = await call(null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (status === "done" || status === "running") return NextResponse.json({ skipped: status });

  await call("running");
  try {
    const { items, dropped } = await researchTrends();
    await call("done", items, dropped);
    return NextResponse.json({ ok: true, count: items.length, dropped });
  } catch (e) {
    await call("failed", [], 0, (e as Error).message);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
