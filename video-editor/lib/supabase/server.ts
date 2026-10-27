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

export async function getUser() {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
}
