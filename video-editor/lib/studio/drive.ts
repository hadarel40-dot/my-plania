import "server-only";
import { createSign } from "node:crypto";

/**
 * Google Drive דרך חשבון שירות (service account), קריאה בלבד.
 * GOOGLE_SERVICE_ACCOUNT_JSON: קובץ המפתח של חשבון השירות (JSON מלא). את התיקייה בדרייב משתפים
 * עם כתובת המייל של חשבון השירות. השרת מנפיק טוקן קצר (שעה) והדפדפן של המנהלת מוריד
 * את הקבצים ישר מדרייב, כך שקבצי MOV גדולים לא עוברים דרך השרת.
 */
interface ServiceAccount { client_email: string; private_key: string }

function account(): ServiceAccount | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw) as ServiceAccount;
    return sa.client_email && sa.private_key ? sa : null;
  } catch {
    return null;
  }
}

export const driveConfigured = () => !!account();
export const driveEmail = () => account()?.client_email ?? null;

const b64url = (s: string | Buffer) => Buffer.from(s).toString("base64url");

let cached: { token: string; until: number } | null = null;

export async function driveAccessToken(): Promise<string> {
  if (cached && cached.until > Date.now() + 60_000) return cached.token;
  const sa = account();
  if (!sa) throw new Error("דרייב לא מחובר (חסר GOOGLE_SERVICE_ACCOUNT_JSON)");
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/drive.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const signature = createSign("RSA-SHA256").update(`${head}.${claim}`).sign(sa.private_key, "base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${claim}.${signature}` }),
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) throw new Error(`דרייב סירב: ${body.error_description ?? body.error ?? res.status}`);
  cached = { token: body.access_token, until: Date.now() + (Number(body.expires_in) || 3600) * 1000 };
  return cached.token;
}
