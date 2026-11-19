import "server-only";
import { z } from "zod";
import { askBrain } from "@/lib/ai/brain";
import { cleanDeep } from "./clean";
import { ACCOUNTS, DEFAULT_VOICE, NICHES, type Account, type TrendItem, type VoiceProfile } from "./config";
import { loadAccount, loadAccounts } from "./instagram";

// ---------- טרנדים

const TrendSchema = z.object({
  items: z.array(z.object({
    kind: z.enum(["format", "audio", "topic", "hook"]),
    title: z.string(),
    summary: z.string(),
    source_name: z.string(),
    source_url: z.string(),
    why_relevant: z.string(),
    reel_idea: z.string(),
  })),
});

/** טרנד נשאר רק אם הקישור שלו באמת נטען */
async function urlLoads(url: string) {
  if (!/^https?:\/\/[^\s]+\.[^\s]+/.test(url)) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { redirect: "follow", signal: controller.signal, headers: { "user-agent": "Mozilla/5.0 (link check)" }, cache: "no-store" });
    await res.body?.cancel().catch(() => {});
    return res.status < 400;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** חיפוש ברשת לכל נישה, במקביל. מחזיר רק טרנדים עם מקור שנבדק */
export async function researchTrends(): Promise<{ items: TrendItem[]; dropped: number }> {
  const today = new Date().toISOString().slice(0, 10);
  const batches = await Promise.all(NICHES.map(async (niche) => {
    const account = ACCOUNTS.find((a) => a.value === niche.account)!;
    try {
      const { items } = cleanDeep(await askBrain({
        schema: TrendSchema,
        search: true,
        searchRequired: true,
        system: "את חוקרת טרנדים לתוכן קצר באינסטגרם עבור יוצרת ישראלית. עונה בעברית. כל פריט חייב מקור אמיתי שמצאת בחיפוש.",
        parts: [{ text: `התאריך היום: ${today}.
חפשי ברשת מה עולה עכשיו (ב-14 הימים האחרונים) ברילס של אינסטגרם ובטיקטוק בנישה: ${niche.search}.
הקהל: ${account.about}
ארבעה סוגים: פורמטים של רילס (format), אודיו או סאונד טרנדי (audio), נושאים שמדברים עליהם (topic), וסוגי הוקים שחוזרים (hook).
עדיפות למקורות ישראליים, ואחריהם מקורות בינלאומיים טובים (כתבות, דוחות טרנדים, פוסטים של יוצרים, עמודי מגמות של הפלטפורמות).

כללים מחייבים:
- לכל פריט source_url אמיתי ומדויק של העמוד שבו זה מופיע, כפי שמצאת בחיפוש. אין קישור אמיתי: לא מכניסים את הפריט.
- אסור להמציא מספרים. מספר מופיע רק אם הוא כתוב במקור.
- אודיו רק אם המקור מציין את שם האודיו.
- why_relevant: למה זה רלוונטי ל${account.label} ולקהל שלו, במשפט.
- reel_idea: רעיון מוכן לריל שהיא יכולה לצלם השבוע, במשפט או שניים, בקול שלה: ישיר, חם, פרקטי.
- בלי אימוג'י ובלי מקפים ארוכים. עד 5 פריטים.` }],
      }));
      return items.slice(0, 5).map((it) => ({ ...it, niche: niche.value, account: niche.account }));
    } catch (e) {
      console.warn("trend search failed", niche.value, (e as Error).message);
      return [];
    }
  }));
  const candidates = batches.flat();
  const checked = await Promise.all(candidates.map(async (it) => ((await urlLoads(it.source_url)) ? it : null)));
  const items: TrendItem[] = checked.filter((x) => x !== null);
  return { items, dropped: candidates.length - items.length };
}

// ---------- ביצועים, בקיצור, למודל

export async function performanceSummary(limit = 12) {
  const accounts = await loadAccounts({ limit });
  if (!accounts.length) return "אינסטגרם לא מחובר, אין נתוני ביצועים.";
  return accounts.map((a) => {
    if (!a.ok) return `חשבון שלא נקרא: ${a.error}`;
    const rows = a.media.map((m) => ({
      first_line: (m.caption ?? "").split("\n")[0].slice(0, 90),
      type: m.media_product_type,
      date: m.timestamp.slice(0, 10),
      likes: m.like_count,
      comments: m.comments_count,
      saves: m.insights?.saved,
      shares: m.insights?.shares,
      reach: m.insights?.reach,
    }));
    return `@${a.profile.username}, ${a.profile.followers_count} עוקבים. ${a.insightsAvailable ? "יש שמירות ושיתופים." : "אין הרשאה לשמירות ושיתופים, רק לייקים ותגובות."}\n${JSON.stringify(rows)}`;
  }).join("\n\n");
}

// ---------- היום

const TodaySchema = z.object({
  recommendations: z.array(z.object({
    title: z.string(),
    why: z.string(),
    what_to_shoot: z.string(),
    action: z.enum(["studio", "board", "trends", "performance"]),
    action_label: z.string(),
    idea: z.string(),
    account: z.enum(["hadarelifergan", "plania.il"]),
    niche: z.enum(["travel", "business", "home", "meals"]),
    impact: z.enum(["גבוהה", "בינונית", "נמוכה"]),
  })),
});
export type Recommendation = z.infer<typeof TodaySchema>["recommendations"][number];

export async function planToday(input: { trends: TrendItem[]; trendDate: string | null; board: Record<string, number>; planned: unknown[]; waiting: unknown[] }) {
  const performance = await performanceSummary();
  const { recommendations } = cleanDeep(await askBrain({
    schema: TodaySchema,
    system: "את מנהלת הסושיאל שלה. היא נכנסת לדשבורד ורוצה לדעת מה לצלם היום, איך ולמה זה יעבוד. עברית ישירה וחמה, בלי אימוג'י, בלי מקפים ארוכים, בלי קלישאות.",
    parts: [{ text: `שני חשבונות: @hadarelifergan (אישי: תכנון טיולים ומערכות לעסקים קטנים) ו-@plania.il (Plania: ארגון הבית ותכנון ארוחות).

טרנדים מאומתים מהדוח האחרון (${input.trendDate ?? "אין דוח"}):
${JSON.stringify(input.trends.slice(0, 12).map((t) => ({ niche: t.niche, kind: t.kind, title: t.title, idea: t.reel_idea, source: t.source_name })))}

לוח התוכן לפי שלב: ${JSON.stringify(input.board)} (idea רעיון, draft טיוטה, review ממתין לאישור, approved מאושר, published פורסם)
מתוכנן לשבוע הקרוב: ${JSON.stringify(input.planned)}
ממתין לאישור שלה: ${JSON.stringify(input.waiting)}

ביצועים אחרונים (שמירות ושיתופים חשובים יותר מלייקים):
${performance}

תני בדיוק שלוש המלצות, מהשפעה גבוהה לנמוכה. לכל אחת:
- title: מה לעשות, במשפט קצר וברור.
- why: למה זה יעבוד, רק לפי הנתונים שלמעלה. אם מבססים על פוסט שהצליח, לציין איזה. בלי מספרים שלא מופיעים למעלה.
- what_to_shoot: מה לצלם ואיך, בשורה או שתיים, כולל אופציה בלי פנים.
- action: studio לריל חדש (idea חובה), board לפריט קיים, trends או performance.
- action_label: הטקסט על הכפתור, עד 4 מילים.
- idea: הרעיון לריל, אם action הוא studio. אחרת ריק.
- account ו-niche: למי זה שייך.
- impact: גבוהה, בינונית או נמוכה.` }],
  }));
  return recommendations.slice(0, 3);
}

// ---------- סקירה שבועית

export async function weeklyStats(weekAgo: string, snapshots: { date: string; account: string; followers: number }[], board: Record<string, number>) {
  const accounts = await loadAccounts({ limit: 30 });
  const stats: Record<string, unknown> = { period_start: weekAgo, board };
  stats.accounts = accounts.map((a) => {
    if (!a.ok) return { error: a.error };
    const week = a.media.filter((m) => m.timestamp.slice(0, 10) >= weekAgo);
    const sum = (f: (m: (typeof week)[number]) => number | undefined) => week.reduce((s, m) => s + (Number(f(m)) || 0), 0);
    const snaps = snapshots.filter((s) => s.account === a.profile.username && s.date >= weekAgo).sort((x, y) => x.date.localeCompare(y.date));
    return {
      account: a.profile.username,
      followers: a.profile.followers_count,
      followers_change: snaps.length >= 2 ? snaps[snaps.length - 1].followers - snaps[0].followers : null,
      posts: week.length,
      likes: sum((m) => m.like_count),
      comments: sum((m) => m.comments_count),
      saves: a.insightsAvailable ? sum((m) => m.insights?.saved) : null,
      shares: a.insightsAvailable ? sum((m) => m.insights?.shares) : null,
      reach: a.insightsAvailable ? sum((m) => m.insights?.reach) : null,
      posts_detail: week.map((m) => ({ first_line: (m.caption ?? "").split("\n")[0].slice(0, 90), date: m.timestamp.slice(0, 10), likes: m.like_count, comments: m.comments_count, saves: m.insights?.saved, shares: m.insights?.shares })),
    };
  });
  if (!accounts.length) stats.instagram = "לא מחובר";
  return stats;
}

export async function writeReview(stats: Record<string, unknown>) {
  const { body } = cleanDeep(await askBrain({
    schema: z.object({ body: z.string() }),
    system: "את מנהלת סושיאל שמבינה שיווק וכותבת לה סקירה שבועית. עברית ישירה, חמה, פרקטית. בלי אימוג'י ובלי מקפים ארוכים.",
    parts: [{ text: `הנתונים. אלה המספרים היחידים שמותר להשתמש בהם: אל תחשבי מספרים חדשים ואל תמציאי.
${JSON.stringify(stats)}

מבנה, בפסקאות קצרות עם כותרות (## כותרת):
## מה קרה השבוע
## מה עבד ולמה (שמירות ושיתופים לפני לייקים, אם יש)
## מה הביא עוקבים (רק אם יש שינוי בעוקבים. לכתוב במפורש שזה מתאם בזמן ולא הוכחה)
## מה לעשות בשבוע הבא (שלושה צעדים)
אם חסרים נתונים, להגיד מה חסר ואיך משיגים אותו.` }],
  }));
  return body;
}

// ---------- הקול

const VoiceSchema = z.object({
  tone: z.string(),
  sentence_style: z.string(),
  favorite_words: z.array(z.string()),
  avoid_words: z.array(z.string()),
  rules: z.array(z.string()),
  audience: z.string(),
});

export async function buildVoice(account: Account, current: VoiceProfile | null, pasted: string) {
  let captions: string[] = [];
  let note = "";
  const ig = await loadAccount(account, { limit: 30, insights: false }).catch(() => undefined);
  if (ig) captions = ig.media.map((m) => (m.caption ?? "").trim()).filter((c) => c.length > 20).slice(0, 20);
  else note = `החשבון ${account} לא מחובר כאן, אז הפרופיל נבנה רק מהטקסטים שהדבקת.`;
  if (!captions.length && !pasted.trim()) throw new Error(`${note} הדביקי כמה כיתובים שכתבת כדי שיהיה ממה ללמוד.`);
  const samples = [...captions, pasted.trim()].filter(Boolean);
  const profile = cleanDeep(await askBrain({
    schema: VoiceSchema,
    system: "את עורכת תוכן שמנתחת את הקול של יוצרת תוכן ישראלית, כדי שכל טיוטה עתידית תישמע בדיוק כמוה. בלי אימוג'י ובלי מקפים ארוכים בתשובה.",
    parts: [{ text: `${ACCOUNTS.find((a) => a.value === account)!.about}

נקודת המוצא (מה שהיא כתבה על עצמה):
${JSON.stringify(current ?? DEFAULT_VOICE)}

הטקסטים האמיתיים שלה:
${samples.map((c, i) => `--- ${i + 1}\n${c}`).join("\n")}

נתחי רק לפי הטקסטים. בעברית:
- tone: הטון בשניים-שלושה משפטים.
- sentence_style: אורך משפטים ממוצע ומבנה טיפוסי, עם דוגמה קצרה מתוך הטקסטים.
- favorite_words: עד 15 מילים או ביטויים שהיא באמת חוזרת עליהם (רק כאלה שמופיעים בטקסטים).
- avoid_words: מילים ושפה שלא מתאימות לה. תמיד כולל שפה שיווקית מנופחת.
- rules: עד 8 כללי כתיבה קבועים. חובה לכלול: בלי אימוג'י, בלי מקפים ארוכים, בלי קלישאות.
- audience: למי היא מדברת, אם עולה מהטקסטים (אחרת ריק).` }],
  }));
  return { profile, samples, used: captions.length, note };
}

const SuggestSchema = z.object({
  suggestions: z.array(z.object({ kind: z.enum(["favorite_word", "avoid_word", "rule"]), value: z.string(), reason: z.string() })),
});
export type VoiceSuggestion = z.infer<typeof SuggestSchema>["suggestions"][number];

/** מה התיקון הידני שלה מלמד על הקול. רק הצעות: שום דבר לא נשמר בפרופיל בלי אישור */
export async function suggestFromEdit(voice: string, before: string, after: string) {
  const { suggestions } = cleanDeep(await askBrain({
    schema: SuggestSchema,
    system: "את עוזרת ללמוד את הקול של יוצרת מתוך התיקונים שהיא עושה לטיוטות.",
    parts: [{ text: `פרופיל הקול הנוכחי:
${voice}

טיוטה שנכתבה עבורה:
${before}

הגרסה אחרי שהיא תיקנה בעצמה:
${after}

הציעי עד 4 עדכונים לפרופיל, רק כאלה שהתיקון באמת מראה:
- favorite_word: מילה או ביטוי שהיא הוסיפה.
- avoid_word: מילה שהיא מחקה או החליפה.
- rule: כלל כתיבה (למשל "משפט פתיחה בלי שאלה").
לא להציע מה שכבר בפרופיל. reason במשפט אחד בעברית, עם הדוגמה מהתיקון. אין מה ללמוד: רשימה ריקה.` }],
  }));
  return suggestions.slice(0, 4);
}
