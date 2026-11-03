import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

/** לקוח Supabase לצד השרת (Server Components, Route Handlers, Server Actions) */
export async function createSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // נקרא מ-Server Component, שלא יכול לכתוב עוגיות. ה-middleware מרענן את הסשן
        }
      },
    },
  });
}

export interface SessionUser {
  id: string;
  email?: string;
  user_metadata: Record<string, unknown>;
}

/**
 * המשתמש המחובר, מתוך ה-JWT. החתימה נבדקת מקומית (מפתח ES256 של הפרויקט), בלי
 * לפנות לשרת ההתחברות בכל טעינת עמוד: השרת של Supabase רחוק, וזה חוסך זמן ניכר.
 */
export async function getUser(): Promise<{ supabase: Awaited<ReturnType<typeof createSupabaseServer>>; user: SessionUser | null }> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return { supabase, user: null };
  return {
    supabase,
    user: { id: claims.sub, email: claims.email, user_metadata: (claims.user_metadata as Record<string, unknown>) ?? {} },
  };
}
