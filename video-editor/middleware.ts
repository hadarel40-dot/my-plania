import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseEnabled } from "@/lib/supabase/env";

const PUBLIC_PATHS = ["/login", "/auth", "/api"];

/** מרענן את סשן ה-Supabase בכל בקשה, ומפנה משתמש לא מחובר לעמוד ההתחברות */
export async function middleware(request: NextRequest) {
  if (!supabaseEnabled) return NextResponse.next();

  // אם כתובת ה-callback לא ברשימת ה-Redirect URLs של Supabase, הקישור מהמייל
  // מגיע ל-Site URL (ברירת המחדל: http://localhost:3000/?code=...). מעבירים אותו ל-callback
  const { pathname, searchParams } = request.nextUrl;
  if (!pathname.startsWith("/auth/") && (searchParams.has("code") || searchParams.has("token_hash"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const isPublic = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|samples/).*)"],
};
