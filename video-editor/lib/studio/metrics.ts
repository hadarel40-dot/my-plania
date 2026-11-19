import type { IgMedia } from "./instagram";

/** "החשיפה הרגילה" והפוסט הכי חזק עכשיו, מנתונים אמיתיים בלבד. בלי תובנות: לפי לייקים, ונאמר כך */
export function usualAndBest(media: IgMedia[], insights: boolean, days = 14) {
  const metric = (m: IgMedia) => (insights ? m.insights?.reach : m.like_count) ?? null;
  const values = media.map(metric).filter((v): v is number => typeof v === "number").sort((a, b) => a - b);
  if (!values.length) return null;
  const usual = values[Math.floor(values.length / 2)];
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const recent = media.filter((m) => m.timestamp >= since && typeof metric(m) === "number");
  const best = recent.sort((a, b) => (metric(b) ?? 0) - (metric(a) ?? 0))[0] ?? null;
  const bestValue = best ? metric(best) ?? 0 : 0;
  return { metricLabel: insights ? "חשיפה" : "לייקים", usual, best, bestValue, ratio: usual > 0 ? Math.round((bestValue / usual) * 10) / 10 : null };
}
