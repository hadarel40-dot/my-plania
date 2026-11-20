import "server-only";

/**
 * מקורות לטרנדים בלי חיפוש בתשלום: חיפוש בחדשות של גוגל (RSS ציבורי), בעברית ובאנגלית, מ-14 הימים
 * האחרונים. כל כתבה מגיעה עם קישור אמיתי, והמודל רק קורא ובוחר. הוא לא ממציא מקורות.
 */
export interface Article { title: string; link: string; source: string; date: string }

const decode = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
const tag = (block: string, name: string) => decode(block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1] ?? "");

async function search(query: string, lang: "he" | "en"): Promise<Article[]> {
  const params = lang === "he" ? "hl=he&gl=IL&ceid=IL:he" : "hl=en-US&gl=US&ceid=US:en";
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`${query} when:14d`)}&${params}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { "user-agent": "Mozilla/5.0 (content studio)" }, cache: "no-store" });
    if (!res.ok) return [];
    const xml = await res.text();
    return (xml.match(/<item>[\s\S]*?<\/item>/g) ?? []).slice(0, 8).map((item) => ({
      title: tag(item, "title"),
      link: tag(item, "link"),
      source: tag(item, "source"),
      date: tag(item, "pubDate"),
    })).filter((a) => a.title && /^https?:\/\//.test(a.link));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export const NEWS_QUERIES: { niche: string; q: string; lang: "he" | "en" }[] = [
  { niche: "travel", q: "טיולים טרנד רשתות חברתיות", lang: "he" },
  { niche: "travel", q: "travel planning trend TikTok OR Instagram", lang: "en" },
  { niche: "business", q: "עסקים קטנים אינסטגרם", lang: "he" },
  { niche: "business", q: "small business Instagram Reels trend", lang: "en" },
  { niche: "home", q: "ארגון הבית טיפים טרנד", lang: "he" },
  { niche: "home", q: "home organization TikTok trend", lang: "en" },
  { niche: "meals", q: "תכנון ארוחות מתכונים טרנד", lang: "he" },
  { niche: "meals", q: "meal prep TikTok trend", lang: "en" },
  { niche: "general", q: "Instagram Reels trends this week", lang: "en" },
  { niche: "general", q: "טרנד טיקטוק אינסטגרם", lang: "he" },
];

export async function newsForTrends(): Promise<(Article & { niche: string })[]> {
  const batches = await Promise.all(NEWS_QUERIES.map(async (q) => (await search(q.q, q.lang)).map((a) => ({ ...a, niche: q.niche }))));
  const seen = new Set<string>();
  return batches.flat().filter((a) => !seen.has(a.title) && !!seen.add(a.title)).slice(0, 70);
}
