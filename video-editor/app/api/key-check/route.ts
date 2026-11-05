import { NextResponse } from "next/server";
import { checkGeminiKey } from "@/lib/ai/brain";
import { supabaseEnabled } from "@/lib/supabase/env";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** בודק מפתח Gemini אישי לפני שהוא נשמר בטלפון. המפתח לא נשמר בשרת */
export async function POST(request: Request) {
  if (supabaseEnabled && !(await getUser()).user) return NextResponse.json({ error: "צריך להתחבר" }, { status: 401 });
  const key = request.headers.get("x-gemini-key")?.trim() ?? "";
  if (key.length < 20 || key.length > 200 || !/^[A-Za-z0-9_\-.]+$/.test(key)) {
    return NextResponse.json({ error: "זה לא נראה כמו מפתח של Gemini. צריך להעתיק את כל המפתח (מתחיל בדרך כלל ב-AIza)" }, { status: 400 });
  }
  const error = await checkGeminiKey(key);
  return error ? NextResponse.json({ error }, { status: 400 }) : NextResponse.json({ ok: true });
}
