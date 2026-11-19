/** בלי אימוג'י ובלי מקפים ארוכים בשום טקסט שנכתב עבורה */
const EMOJI = /\p{Extended_Pictographic}|\u{FE0F}|\u{200D}|[\u{1F1E6}-\u{1F1FF}]/gu;

export function cleanText(value: string): string {
  return value
    .replace(EMOJI, "")
    .replace(/\s*[—–―]\s*/g, ", ")
    .replace(/ ,/g, ",")
    .replace(/,\s*,/g, ",")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function cleanDeep<T>(value: T): T {
  if (typeof value === "string") return cleanText(value) as T;
  if (Array.isArray(value)) return value.map(cleanDeep) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, k.endsWith("url") ? v : cleanDeep(v)])) as T;
  }
  return value;
}
