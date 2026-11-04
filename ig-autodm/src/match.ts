// התאמת מילות מפתח ובניית ההודעה. בלי תלות ב-Cloudflare, כדי שאפשר יהיה לבדוק ב-Node

/** אותיות קטנות, בלי ניקוד וטעמים, בלי סימני כיווניות, רווחים מאוחדים */
export function normalize(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[֑-ׇ]/g, "") // ניקוד וטעמים
    .replace(/[​-‏‪-‮⁦-⁩﻿]/g, "") // תווים בלתי נראים
    .replace(/\s+/g, " ")
    .trim();
}

/** "מדריך, מדרך ,guide" ← ["מדריך","מדרך","guide"] */
export function parseKeywords(raw: string): string[] {
  const seen = new Set<string>();
  for (const part of raw.split(/[,،\n]/)) {
    const k = normalize(part);
    if (k) seen.add(k);
  }
  return [...seen];
}

/** התאמה חלקית: "אני רוצה את המדריך!!" מתאים ל"מדריך" */
export function matchesKeyword(commentText: string, keywords: string[]): boolean {
  const text = normalize(commentText);
  if (!text) return false;
  return keywords.some((k) => k && text.includes(k));
}

/** מחליף {שם} בשם המשתמש, או מוחק אותו ומסדר את הרווחים כשהשם כבוי */
export function buildMessage(template: string, username: string, useName: boolean): string {
  const name = useName ? username.trim() : "";
  let out = template.replace(/\{\s*(שם|name)\s*\}/gi, name);
  if (!name) {
    out = out
      .replace(/[ \t]+([!?.,:;])/g, "$1") // "היי !" ← "היי!"
      .replace(/[ \t]{2,}/g, " ");
  }
  return out.trim();
}

export function pickRandom<T>(items: T[]): T | undefined {
  if (!items.length) return undefined;
  return items[Math.floor(Math.random() * items.length)];
}

/** נוסחי התגובה הפומבית נשמרים כשורה לכל נוסח */
export function parseVariants(raw: string): string[] {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export function validateRuleInput(input: {
  media_id: string;
  keywords: string;
  message: string;
  button_title: string;
  button_url: string;
}): string[] {
  const errors: string[] = [];
  if (!/^\d+$/.test(input.media_id)) errors.push("צריך לבחור ריל");
  if (!parseKeywords(input.keywords).length) errors.push("צריך לפחות מילת מפתח אחת");
  if (!input.message.trim()) errors.push("צריך טקסט להודעה");
  if (input.message.length > 600) errors.push("ההודעה ארוכה מדי (עד 600 תווים)");
  const title = input.button_title.trim();
  if (!title) errors.push("צריך טקסט לכפתור");
  if ([...title].length > 20) errors.push("טקסט הכפתור עד 20 תווים");
  try {
    const u = new URL(input.button_url.trim());
    if (u.protocol !== "https:") errors.push("הקישור חייב להתחיל ב-https://");
  } catch {
    errors.push("הקישור לא תקין");
  }
  return errors;
}
