// כניסה לדף הניהול: סיסמה אחת, עוגייה חתומה ל-30 יום
import type { Env } from "./types";
import { DAY, MINUTE } from "./types";
import { hmacHex, timingSafeEqual } from "./crypto";

const COOKIE = "__Host-igdm";
const SESSION_DAYS = 30;
const MAX_FAILS = 8;
const FAIL_WINDOW = 15 * MINUTE;

/** החלפת הסיסמה מנתקת אוטומטית את כל החיבורים הקיימים */
function sessionKey(env: Env) {
  return `${env.ADMIN_PASSWORD}|${env.IG_APP_SECRET}|session`;
}

export async function makeSessionCookie(env: Env): Promise<string> {
  const exp = Date.now() + SESSION_DAYS * DAY;
  const sig = await hmacHex(sessionKey(env), `s:${exp}`);
  return `${COOKIE}=${exp}.${sig}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_DAYS * 86400}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export async function isLoggedIn(request: Request, env: Env): Promise<boolean> {
  if (!env.ADMIN_PASSWORD) return false;
  const cookie = request.headers.get("Cookie") ?? "";
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE.replace(/[-]/g, "\\-")}=(\\d+)\\.([0-9a-f]{64})`));
  if (!m) return false;
  const exp = Number(m[1]);
  if (!(exp > Date.now())) return false;
  const expected = await hmacHex(sessionKey(env), `s:${exp}`);
  return timingSafeEqual(m[2], expected);
}

function clientIp(request: Request): string {
  return request.headers.get("CF-Connecting-IP") ?? "local";
}

/** מחזיר null אם הסיסמה נכונה, או הודעת שגיאה */
export async function checkLogin(request: Request, env: Env, password: string): Promise<string | null> {
  if (!env.ADMIN_PASSWORD) return "עוד לא הוגדרה סיסמה (ADMIN_PASSWORD)";
  const ip = clientIp(request);
  const now = Date.now();
  const row = await env.DB.prepare("SELECT count, window_start FROM login_attempts WHERE ip = ?")
    .bind(ip)
    .first<{ count: number; window_start: number }>();
  const inWindow = row && now - row.window_start < FAIL_WINDOW;
  if (inWindow && row.count >= MAX_FAILS) return "יותר מדי ניסיונות. נסי שוב בעוד רבע שעה";

  // משווים חתימות ולא את הסיסמה עצמה, כדי שהאורך לא ידלוף
  const a = await hmacHex("pw", password);
  const b = await hmacHex("pw", env.ADMIN_PASSWORD);
  if (timingSafeEqual(a, b)) {
    await env.DB.prepare("DELETE FROM login_attempts WHERE ip = ?").bind(ip).run();
    return null;
  }
  await env.DB.prepare(
    `INSERT INTO login_attempts (ip, count, window_start) VALUES (?, 1, ?)
     ON CONFLICT(ip) DO UPDATE SET
       count = CASE WHEN ? - window_start < ? THEN count + 1 ELSE 1 END,
       window_start = CASE WHEN ? - window_start < ? THEN window_start ELSE ? END`,
  )
    .bind(ip, now, now, FAIL_WINDOW, now, FAIL_WINDOW, now)
    .run();
  return "סיסמה שגויה";
}

/** טופס שנשלח מאתר אחר לא יעבור */
export function sameOrigin(request: Request): boolean {
  const origin = new URL(request.url).origin;
  const o = request.headers.get("Origin");
  if (o) return o === origin;
  const r = request.headers.get("Referer");
  return !!r && (r === origin || r.startsWith(origin + "/"));
}
