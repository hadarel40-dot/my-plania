import { NextResponse } from "next/server";
import { createRouteHandler } from "@fal-ai/server-proxy/nextjs";
import { getCloudConfig } from "@/lib/ai/fal-config";
import { supabaseEnabled } from "@/lib/supabase/env";
import { getUser } from "@/lib/supabase/server";

const cloud = getCloudConfig();
const allowedEndpoints = [cloud.video, cloud.transcribe].filter((m): m is string => !!m);

/**
 * Proxy ל-fal: הדפדפן קורא ל-fal דרך הנתיב הזה, ו-FAL_KEY נשאר בשרת.
 * רק המודלים שהוגדרו ב-env מותרים, כדי שאי אפשר יהיה להריץ דרכנו מודלים אחרים.
 * בלי אף מודל מוגדר (בלי FAL_KEY) הנתיב סגור לגמרי.
 *
 * מי מורשה: עם Supabase, רק משתמש מחובר. בלי Supabase אין Auth, ולכן ה-proxy
 * פתוח רק בפיתוח מקומי (או אם הוגדר ALLOW_PUBLIC_FAL_PROXY=true במודע).
 */
const handlers = allowedEndpoints.length
  ? createRouteHandler({
      allowedEndpoints,
      allowUnauthorizedRequests: false,
      isAuthenticated: async () => {
        if (supabaseEnabled) return !!(await getUser()).user;
        return process.env.NODE_ENV === "development" || process.env.ALLOW_PUBLIC_FAL_PROXY === "true";
      },
    })
  : null;

const closed = async () => NextResponse.json({ error: "fal לא מוגדר" }, { status: 404 });

export const GET = handlers?.GET ?? closed;
export const POST = handlers?.POST ?? closed;
export const PUT = handlers?.PUT ?? closed;
