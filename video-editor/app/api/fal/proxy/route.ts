import { createRouteHandler } from "@fal-ai/server-proxy/nextjs";
import { getCloudConfig } from "@/lib/ai/fal-config";

const cloud = getCloudConfig();

/**
 * Proxy ל-fal: הדפדפן קורא ל-fal דרך הנתיב הזה, ו-FAL_KEY נשאר בשרת.
 * רק המודלים שהוגדרו ב-env מותרים, כדי שאי אפשר יהיה להריץ דרכנו מודלים אחרים.
 *
 * עד שיהיה Auth (Supabase), ה-proxy פתוח רק בפיתוח מקומי. בפריסה ציבורית הוא
 * חסום, אלא אם הוגדר ALLOW_PUBLIC_FAL_PROXY=true במודע.
 */
export const { GET, POST, PUT } = createRouteHandler({
  allowedEndpoints: [cloud.video, cloud.transcribe].filter((m): m is string => !!m),
  allowUnauthorizedRequests: false,
  isAuthenticated: async () =>
    process.env.NODE_ENV === "development" || process.env.ALLOW_PUBLIC_FAL_PROXY === "true",
});
