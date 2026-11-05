"use client";

/**
 * מפתח Gemini אישי (חינמי, מ-aistudio.google.com): לכל משתמשת מכסה יומית משלה.
 * נשמר רק בדפדפן שלה (לכל משתמשת בנפרד), ונשלח לשרת שלנו רק בכותרת של הבקשה.
 */
const BASE = "ai-video-editor:gemini-key";
let KEY = BASE;

export function setMyKeyUser(userId: string) { KEY = `${BASE}:${userId}`; }

export function getMyKey(): string {
  try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; }
}

export function setMyKey(key: string) {
  try {
    if (key) localStorage.setItem(KEY, key.trim());
    else localStorage.removeItem(KEY);
  } catch { /* מצב פרטי */ }
}

/** כותרות לבקשה לשרת שמשתמשת ב-Gemini */
export function brainHeaders(extra: Record<string, string> = { "content-type": "application/json" }): Record<string, string> {
  const key = getMyKey();
  return key ? { ...extra, "x-gemini-key": key } : extra;
}
