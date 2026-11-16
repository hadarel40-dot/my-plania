import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";

/** המפתח של תרחיש הפרסום מגיע ב-Authorization: Bearer <key> (או x-api-key) */
export const keyFrom = (req: NextRequest) =>
  req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || req.headers.get("x-api-key")?.trim() || "";

/** לקוח בלי משתמש: הפונקציות במסד בודקות את המפתח בעצמן */
export const anonClient = () => createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
