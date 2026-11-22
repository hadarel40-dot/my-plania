import "server-only";
import { createSign } from "node:crypto";

/**
 * Google Drive דרך חשבון שירות (service account), קריאה בלבד.
 * GOOGLE_SERVICE_ACCOUNT_JSON: קובץ המפתח של חשבון השירות (JSON מלא). את התיקייה בדרייב משתפים
 * עם כתובת המייל של חשבון השירות. השרת מנפיק טוקן קצר (שעה) והדפדפן של המנהלת מוריד
 * את הקבצים ישר מדרייב, כך שקבצי MOV גדולים לא עוברים דרך השרת.
 */
interface ServiceAccount { client_email: string; private_key: string }

/**
 * קורא את המפתח בכל צורה נפוצה שבה הוא מודבק: JSON רגיל, עטוף במרכאות, JSON בתוך מחרוזת,
 * base64, או מפתח פרטי עם \n מילולי במקום ירידות שורה. מחזיר גם סיבה כשלא מצליח (בלי לחשוף את המפתח).
 */
type Parsed = { sa: ServiceAccount | null; problem: string | null };
function parseAccount(): Parsed {
  let raw = (process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "").trim();
  if (!raw) return { sa: null, problem: "המשתנה GOOGLE_SERVICE_ACCOUNT_JSON לא מוגדר" };
  // עטוף בגרש או בגרש הפוך (מרכאות כפולות מטופלות למטה, כ-JSON בתוך מחרוזת)
  if (/^['`]/.test(raw) && raw.at(-1) === raw[0]) raw = raw.slice(1, -1).trim();
  if (!raw.startsWith("{") && !raw.startsWith('"')) {
    try { const dec = Buffer.from(raw, "base64").toString("utf8").trim(); if (dec.startsWith("{")) raw = dec; } catch { /* לא base64 */ }
  }
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
    if (typeof obj === "string") obj = JSON.parse(obj);
  } catch {
    // לפעמים ירידות השורה בתוך המפתח הפרטי נשברות בהדבקה
    const fixed = raw.replace(/("private_key"\s*:\s*")([\s\S]*?)("\s*[,}])/, (_m, p1: string, key: string, p3: string) => p1 + key.replace(/\r?\n/g, "\\n") + p3);
    try { obj = JSON.parse(fixed); } catch { return { sa: null, problem: "התוכן של GOOGLE_SERVICE_ACCOUNT_JSON הוא לא JSON תקין. צריך להדביק את כל הקובץ, מהסוגר { הראשון ועד } האחרון" }; }
  }
  const sa = obj as Partial<ServiceAccount> & { type?: string };
  if (!sa?.client_email || !sa?.private_key) return { sa: null, problem: "בקובץ חסרים client_email או private_key. בדקי שהדבקת את קובץ המפתח (JSON) של חשבון השירות ולא קובץ אחר" };
  return { sa: { client_email: sa.client_email, private_key: sa.private_key.replace(/\\n/g, "\n") }, problem: null };
}

function account(): ServiceAccount | null {
  return parseAccount().sa;
}
export const driveProblem = () => parseAccount().problem;

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

export interface DriveFile {
  id: string; name: string; mimeType: string; size?: string; description?: string; createdTime?: string; modifiedTime?: string;
  thumbnailLink?: string; videoMediaMetadata?: { durationMillis?: string; width?: number; height?: number }; imageMediaMetadata?: { width?: number; height?: number };
}

/** תיקיית ברירת המחדל: GOOGLE_DRIVE_FOLDER (קישור או מזהה). אפשר להעביר תיקייה אחרת בבקשה */
export function folderIdFrom(link?: string | null) {
  const raw = (link || process.env.GOOGLE_DRIVE_FOLDER || "").trim();
  return raw.match(/folders\/([\w-]+)/)?.[1] ?? raw.match(/[?&]id=([\w-]+)/)?.[1] ?? (raw || null);
}

/** סרטונים ותמונות בתיקייה (ובתיקיות שבתוכה, רמה אחת), החדשים קודם */
export async function listDriveMedia(folder?: string | null, limit = 150): Promise<DriveFile[]> {
  const token = await driveAccessToken();
  const fields = "files(id,name,mimeType,size,description,createdTime,modifiedTime,thumbnailLink,videoMediaMetadata,imageMediaMetadata)";
  const list = async (q: string, pageSize = 200) => {
    const params = new URLSearchParams({ q, pageSize: String(pageSize), orderBy: "modifiedTime desc", fields, supportsAllDrives: "true", includeItemsFromAllDrives: "true" });
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
    const body = await res.json();
    if (!res.ok) throw new Error(`דרייב: ${body?.error?.message ?? res.status}`);
    return (body.files ?? []) as DriveFile[];
  };
  const media = "(mimeType contains 'video/' or mimeType contains 'image/') and trashed = false";
  const id = folderIdFrom(folder);
  if (!id) return (await list(media)).slice(0, limit);
  const direct = await list(`'${id.replace(/'/g, "")}' in parents and ${media}`);
  const subfolders = await list(`'${id.replace(/'/g, "")}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`, 50);
  const nested = (await Promise.all(subfolders.slice(0, 20).map((f) => list(`'${f.id}' in parents and ${media}`, 100).then((files) => files.map((x) => ({ ...x, description: [f.name, x.description].filter(Boolean).join(" · ") }))))).catch(() => [])).flat();
  return [...direct, ...nested].sort((a, b) => (b.modifiedTime ?? "").localeCompare(a.modifiedTime ?? "")).slice(0, limit);
}

/** תמונה ממוזערת של קובץ, כ-data URL קטן (כדי שהמודל יראה מה יש בו) */
export async function driveThumb(file: DriveFile): Promise<string | null> {
  if (!file.thumbnailLink) return null;
  try {
    const token = await driveAccessToken();
    const res = await fetch(file.thumbnailLink.replace(/=s\d+$/, "=s320"), { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!res.ok || !/jpe?g/i.test(res.headers.get("content-type") ?? "")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 400_000) return null;
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}
