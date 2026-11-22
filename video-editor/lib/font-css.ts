"use client";
/**
 * קבצי הגופנים של גוגל נטענים אחרי שהדף כבר מוצג, ולא חוסמים את הפתיחה (בעיקר בטלפון בקליטה חלשה).
 * ייצוא וציור קרוסלות מחכים ל-fontCssReady, כדי שהגופנים יהיו מוגדרים לפני שמציירים.
 */
const loading = new Map<string, Promise<void>>();

export function loadFontCss(href: string): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  let p = loading.get(href);
  if (!p) {
    p = new Promise<void>((resolve) => {
      const existing = [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].find((l) => l.href === href);
      if (existing) return resolve();
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.onload = () => resolve();
      link.onerror = () => resolve();
      setTimeout(resolve, 8000);
      document.head.appendChild(link);
    });
    loading.set(href, p);
  }
  return p;
}

/** כל קבצי הגופנים שהתבקשו עד עכשיו נטענו */
export const fontCssReady = () => Promise.all([...loading.values()]).then(() => undefined);
