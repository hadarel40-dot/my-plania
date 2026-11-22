import "server-only";
import { z } from "zod";
import { askBrain, type BrainPart } from "@/lib/ai/brain";
import { cleanDeep } from "./clean";
import { ACCOUNTS, DEFAULT_VOICE, NICHES, type Account, type Hook, type TrendItem, type VoiceProfile } from "./config";
import { scoreHook } from "./hookscore";
import { TEMPLATES } from "./templates";
import { loadAccount, loadAccounts } from "./instagram";
import { newsForTrends } from "./news";

// ---------- טרנדים

const TrendPickSchema = z.object({
  items: z.array(z.object({
    article: z.number(),
    niche: z.enum(["travel", "business", "home", "meals"]),
    kind: z.enum(["format", "audio", "topic", "hook"]),
    title: z.string(),
    summary: z.string(),
    why_relevant: z.string(),
    reel_idea: z.string(),
  })),
});

/**
 * טרנדים מכתבות אמיתיות: חיפוש חינמי בחדשות של גוגל (14 ימים אחרונים), והמודל רק בוחר מה רלוונטי
 * ומסביר. המקור והקישור נלקחים מהכתבה עצמה, לא מהמודל, ולכן אין מקורות מומצאים.
 */
export async function researchTrends(): Promise<{ items: TrendItem[]; dropped: number }> {
  const articles = await newsForTrends();
  if (!articles.length) throw new Error("לא הצלחתי להביא כתבות מהחדשות של גוגל כרגע. נסי שוב בעוד כמה דקות.");
  const list = articles.map((a, i) => `#${i} [${a.niche}] ${a.title} (${a.source}, ${a.date.slice(5, 16)})`).join("\n");
  const niches = NICHES.map((n) => `- ${n.value}: ${n.search} (לחשבון ${ACCOUNTS.find((a) => a.value === n.account)!.label})`).join("\n");
  const { items } = cleanDeep(await askBrain({
    prefer: "claude",
    schema: TrendPickSchema,
    system: "את חוקרת טרנדים לתוכן קצר באינסטגרם עבור יוצרת ישראלית. עונה בעברית, רק על סמך הכתבות שקיבלת.",
    parts: [{ text: `אלה כתבות מ-14 הימים האחרונים (מספר, נישת חיפוש, כותרת, מקור, תאריך):
${list}

הנישות שלה:
${niches}

בחרי עד 12 כתבות שמראות משהו שעולה עכשיו ושאפשר להפוך לתוכן אצלה (פורמט, נושא, סוג הוק, או אודיו אם הכותרת מציינת אותו). עד 3 לכל נישה. כתבה שלא רלוונטית לאף נישה, לא בוחרים.
לכל פריט:
- article: מספר הכתבה.
- niche: travel, business, home או meals.
- kind: format, audio, topic או hook.
- title: הטרנד במילים שלך, קצר.
- summary: מה הכתבה אומרת, רק לפי הכותרת. בלי פרטים שלא כתובים בה, ובלי מספרים שלא כתובים בה.
- why_relevant: למה זה רלוונטי לחשבון ולקהל שלו, במשפט.
- reel_idea: רעיון מוכן לריל שהיא יכולה לצלם השבוע, במשפט או שניים, בקול שלה: ישיר, חם, פרקטי.
בלי אימוג'י ובלי מקפים ארוכים.` }],
  }));
  const kept: TrendItem[] = items
    .filter((it) => articles[it.article])
    .slice(0, 12)
    .map((it) => {
      const a = articles[it.article];
      return {
        niche: it.niche, kind: it.kind, title: it.title, summary: it.summary, why_relevant: it.why_relevant, reel_idea: it.reel_idea,
        account: NICHES.find((n) => n.value === it.niche)!.account,
        source_name: a.source || "Google News",
        source_url: a.link,
      };
    });
  return { items: kept, dropped: 0 };
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
  const { recommendations } = cleanDeep(await askBrain({ prefer: "claude",
    schema: TodaySchema,
    system: "את מנהלת הסושיאל שלה. היא נכנסת לדשבורד ורוצה לדעת מה לצלם היום, איך ולמה זה יעבוד. עברית ישירה וחמה, בלי אימוג'י, בלי מקפים ארוכים, בלי קלישאות.",
    parts: [{ text: `כרגע היא מתמקדת רק ב-@plania.il: Plania, אפליקציה לתכנון השבוע והארוחות בבית, לנשים צעירות עם בית, עבודה וילדים.
כל שלוש ההמלצות חייבות להיות על @plania.il, על תכנון ארוחות, "מה מכינים היום", הפשרה, קניות, או ניהול השבוע בבית. לא עסקים, לא טיולים, לא ארגון ארונות ומדפים.
את שם האפליקציה כותבים באנגלית: Plania.

טרנדים מאומתים מהדוח האחרון (${input.trendDate ?? "אין דוח"}):
${JSON.stringify(input.trends.slice(0, 12).map((t) => ({ niche: t.niche, kind: t.kind, title: t.title, idea: t.reel_idea, source: t.source_name })))}

לוח התוכן לפי שלב: ${JSON.stringify(input.board)} (idea רעיון, draft טיוטה, review ממתין לאישור, approved מאושר, published פורסם)
מתוכנן לשבוע הקרוב: ${JSON.stringify(input.planned)}
ממתין לאישור שלה: ${JSON.stringify(input.waiting)}

ביצועים אחרונים (שמירות ושיתופים חשובים יותר מלייקים):
${performance}

תני בדיוק שלוש המלצות, מהשפעה גבוהה לנמוכה. לכל אחת:
- title: מה לעשות, במשפט קצר וברור.
- why: למה זה יעבוד, רק לפי הנתונים שלמעלה. אם מבססים על פוסט שהצליח, לציין איזה. בלי מספרים שלא מופיעים למעלה. אם אין נתוני ביצועים, לכתוב שזה מבוסס על הטרנדים והלוח, ולא לטעון שזה "עבד לך".
- what_to_shoot: מה לצלם ואיך, בשורה או שתיים, כולל אופציה בלי פנים.
- action: studio לריל חדש (idea חובה), board לפריט קיים, trends או performance.
- action_label: הטקסט על הכפתור, עד 4 מילים.
- idea: הרעיון לריל, אם action הוא studio. אחרת ריק.
- account ו-niche: למי זה שייך.
- impact: גבוהה, בינונית או נמוכה.` }],
  }));
  return recommendations.slice(0, 3);
}

// ---------- רעיונות לשבוע

const WeekSchema = z.object({
  ideas: z.array(z.object({
    title: z.string(),
    idea: z.string(),
    why: z.string(),
    account: z.enum(["hadarelifergan", "plania.il"]),
    niche: z.enum(["travel", "business", "home", "meals"]),
    format: z.enum(["reel", "carousel", "story", "image"]),
  })),
});

/** רעיונות לשבוע: מהטרנדים המאומתים, מהביצועים ומה שהיא מקדמת. נכנסים לתור כרעיונות, בלי תאריך */
export async function planWeek(input: { focus: string; trends: TrendItem[]; existing: string[] }) {
  const performance = await performanceSummary(12);
  const { ideas } = cleanDeep(await askBrain({ prefer: "claude",
    schema: WeekSchema,
    system: "את מנהלת הסושיאל שלה ומתכננת איתה את השבוע. עברית ישירה וחמה, בלי אימוג'י, בלי מקפים ארוכים, בלי קלישאות. אסור להמציא מספרים.",
    parts: [{ text: `שני חשבונות: @hadarelifergan (אישי: תכנון טיולים ומערכות לעסקים קטנים) ו-@plania.il (Plania: ארגון הבית ותכנון ארוחות).
מה היא מקדמת השבוע: ${input.focus.trim() || "לא כתבה. לפי מה שעובד ומה שעולה עכשיו."}

טרנדים מאומתים: ${JSON.stringify(input.trends.slice(0, 12).map((t) => ({ niche: t.niche, kind: t.kind, title: t.title, idea: t.reel_idea })))}
ביצועים אחרונים (שמירות ושיתופים לפני לייקים):
${performance}
רעיונות שכבר יש לה (לא לחזור עליהם): ${JSON.stringify(input.existing.slice(0, 40))}

תני 5 רעיונות לשבוע, מגוונים בין שני החשבונות ובין הפורמטים, ורובם רילס. לכל רעיון:
- title: כותרת פנימית קצרה, עד 8 מילים.
- idea: הרעיון במשפט או שניים: מה קורה בסרטון ומה הצופה מקבלת.
- why: למה זה יעבוד, לפי הנתונים למעלה בלבד.
- account, niche, format.` }],
  }));
  return ideas.slice(0, 5);
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
  const { body } = cleanDeep(await askBrain({ prefer: "claude",
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
  const profile = cleanDeep(await askBrain({ prefer: "claude",
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
  const { suggestions } = cleanDeep(await askBrain({ prefer: "claude",
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

// ---------- היועצת השיווקית

const AdvisorSchema = z.object({
  reply: z.string(),
  ideas: z.array(z.object({
    title: z.string(),
    idea: z.string(),
    why: z.string(),
    account: z.enum(["hadarelifergan", "plania.il"]),
    niche: z.enum(["travel", "business", "home", "meals"]),
    format: z.enum(["reel", "carousel", "story", "image"]),
  })),
});
export type AdvisorIdea = z.infer<typeof AdvisorSchema>["ideas"][number];

/** שיחה עם יועצת שיווק שמכירה את הקול, הלוח, הטרנדים והמספרים האמיתיים. רק עונה ומציעה; לא משנה כלום בעצמה */
export async function advise(input: { messages: { role: "user" | "assistant"; text: string }[]; voices: string; board: string; trends: TrendItem[] }) {
  const performance = await performanceSummary(12).catch(() => "לא הצלחתי לקרוא ביצועים.");
  const history = input.messages.slice(-12).map((m) => `${m.role === "user" ? "היא" : "את"}: ${m.text}`).join("\n\n");
  return cleanDeep(await askBrain({
    prefer: "claude",
    schema: AdvisorSchema,
    system: `את יועצת השיווק והסושיאל האישית שלה. מבינה שיווק לעומק: רילס, קרוסלות, הוקים, משפך מכירה, בניית קהל, מה גורם לשמירות ושיתופים. עונה כמו מנהלת סושיאל בכירה שמכירה אותה: ישירה, חמה, פרקטית, עם המלצה ברורה ולא סקירה של כל האפשרויות.
עברית מדוברת, בלי אימוג'י, בלי מקפים ארוכים, בלי קלישאות. תשובה קצרה וממוקדת (עד 180 מילים), אפשר עם רשימה קצרה.
מספרים רק מהנתונים למטה. אם חסר נתון, אומרים מה חסר.
ideas: רק כשהיא מבקשת רעיונות או כשרעיון קונקרטי עוזר לתשובה, עד 4. אחרת רשימה ריקה.`,
    parts: [{ text: `הקול שלה בשני החשבונות:
${input.voices}

הלוח שלה: ${input.board}

טרנדים מאומתים אחרונים: ${JSON.stringify(input.trends.slice(0, 10).map((t) => ({ niche: t.niche, kind: t.kind, title: t.title, source: t.source_name })))}

ביצועים (שמירות ושיתופים לפני לייקים):
${performance}

השיחה עד עכשיו:
${history}` }],
  }));
}

// ---------- הצעות: רעיון והוקים, לפי טרנדים, העסק, הביצועים ומה שהיא אוהבת

export interface Feedback { kind: "idea" | "hook"; text: string; verdict: "like" | "dislike"; reason?: string | null }

/** מה היא אהבה ומה לא, בשביל המודל */
export function preferencesBlock(feedback: Feedback[]) {
  const liked = feedback.filter((f) => f.verdict === "like").slice(0, 25);
  const disliked = feedback.filter((f) => f.verdict === "dislike").slice(0, 25);
  if (!liked.length && !disliked.length) return "עוד אין לה סימונים של אהבתי ולא אהבתי.";
  const line = (f: Feedback) => `- (${f.kind === "hook" ? "הוק" : "רעיון"}) ${f.text}${f.reason ? ` | למה: ${f.reason}` : ""}`;
  return `מה היא אהבה (לכתוב עוד בכיוון הזה):\n${liked.map(line).join("\n") || "- אין עדיין"}\n\nמה היא לא אהבה (להתרחק מזה, ובמיוחד מהסיבות):\n${disliked.map(line).join("\n") || "- אין עדיין"}`;
}

const HookDraft = z.object({
  formula: z.string(), spoken: z.string(), on_screen: z.string(), key_word: z.string(),
  named_entities: z.array(z.string()), stakes_score: z.number(), stakes_reason: z.string(), direct_score: z.number(),
});
const IdeaSuggestSchema = z.object({
  suggestions: z.array(z.object({
    title: z.string(),
    idea: z.string(),
    why: z.string(),
    account: z.enum(["hadarelifergan", "plania.il"]),
    niche: z.enum(["travel", "business", "home", "meals"]),
    format: z.enum(["reel", "carousel", "story", "image"]),
    trend: z.number(),
    template: z.string(),
    hooks: z.array(HookDraft),
  })),
});
export interface SuggestionOut { title: string; idea: string; why: string; account: Account; niche: string; format: string; hooks: Hook[]; source: "studio" | "trend" | "inspiration"; source_url: string | null; template: string | null }

const TEMPLATE_LIST = TEMPLATES.map((t) => `${t.id}: ${t.kind === "carousel" ? "קרוסלה" : "ריל"}, ${t.name}`).join("\n");
const TEMPLATE_RULE = `template: תבנית מוכנה שמתאימה לרעיון, מתוך הרשימה (המזהה בלבד, ריל לרילס וקרוסלה לקרוסלות), או "" אם אף אחת לא מתאימה:\n${TEMPLATE_LIST}`;

const HOOK_RULES = `לכל רעיון שלושה הוקים מנוסחות שונות (Cost Confession, Negative Command, Nobody Tells You, The Receipt, Before And After, The Objection, Contrarian Flip, Time Collapse, Permission, The Callout ועוד). לכל הוק:
- spoken: 5 עד 12 מילים, בלי ברכה ובלי הקדמה, המילה החשובה בשלוש הראשונות, פונה לצופה כשזה טבעי.
- on_screen: עד שש מילים. formula: שם הנוסחה באנגלית. key_word: המילה החשובה. named_entities: שמות, מקומות או מחירים בהוק.
- stakes_score ו-direct_score בין 0 ל-100, stakes_reason במשפט.
מספר שלא מבוסס על משהו אמיתי נכתב {{המספר שלך}}.`;

function finishSuggestions(raw: z.infer<typeof IdeaSuggestSchema>, trends: TrendItem[], source: SuggestionOut["source"], sourceUrl: string | null): SuggestionOut[] {
  return raw.suggestions.map((x) => {
    const trend = trends[x.trend];
    const hooks: Hook[] = x.hooks.slice(0, 3).map((h) => ({ formula: h.formula, spoken: h.spoken, on_screen: h.on_screen, ...scoreHook(h.spoken, h) })).sort((a, b) => b.score - a.score);
    const tpl = TEMPLATES.find((t) => t.id === x.template && (t.kind === "carousel") === (x.format === "carousel"));
    return {
      title: x.title, idea: x.idea, why: x.why, account: x.account, niche: x.niche, format: x.format, hooks, template: tpl?.id ?? null,
      source: source === "studio" && trend ? "trend" : source,
      source_url: source === "studio" ? trend?.source_url ?? null : sourceUrl,
    };
  });
}

/** חמש הצעות חדשות. היא בוחרת מה לשמור ומה לא */
export async function generateSuggestions(input: { trends: TrendItem[]; feedback: Feedback[]; existing: string[]; voices: string; count?: number; focus?: string }) {
  const performance = await performanceSummary(12).catch(() => "לא הצלחתי לקרוא ביצועים.");
  const raw = cleanDeep(await askBrain({
    prefer: "claude",
    schema: IdeaSuggestSchema,
    system: "את מנהלת הסושיאל שלה. מציעה רעיונות שמתאימים בדיוק לעסק ולקול שלה, נשענים על מה שעולה עכשיו ועל מה שעבד לה, ולומדת ממה שהיא אהבה ולא אהבה. עברית מדוברת, בלי אימוג'י, בלי מקפים ארוכים, בלי קלישאות. אסור להמציא מספרים.",
    parts: [{ text: `שני חשבונות: @hadarelifergan (אישי: תכנון טיולים ומערכות לעסקים קטנים) ו-@plania.il (Plania: ארגון הבית ותכנון ארוחות).

הקול שלה:
${input.voices}

${preferencesBlock(input.feedback)}

טרנדים מאומתים (מספר, נישה, טרנד, רעיון):
${input.trends.slice(0, 12).map((t, i) => `#${i} [${t.niche}] ${t.title}: ${t.reel_idea}`).join("\n") || "אין טרנדים עדכניים."}

ביצועים אחרונים (שמירות ושיתופים לפני לייקים):
${performance}

${input.focus ? `מה היא מקדמת עכשיו (לתת לזה עדיפות): ${input.focus}\n\n` : ""}כבר הוצע או קיים (לא לחזור): ${JSON.stringify(input.existing.slice(0, 60))}

תני ${input.count ?? 5} הצעות מגוונות: בין שני החשבונות, בין הנישות ובין הפורמטים (רובם רילס, לפחות קרוסלה אחת). לכל הצעה:
- title: כותרת קצרה, עד 8 מילים. idea: מה קורה בסרטון או בקרוסלה ומה הצופה מקבלת, במשפט או שניים.
- why: למה זה יעבוד, לפי הנתונים למעלה (טרנד מסוים, פוסט שעבד, או משהו שהיא אהבה).
- trend: מספר הטרנד שההצעה נשענת עליו, או -1.
- account, niche, format.
${TEMPLATE_RULE}
${HOOK_RULES}` }],
  }));
  return finishSuggestions(raw, input.trends, "studio", null);
}

/** השראה: קישור לסרטון או תמונות ממנו (או שלה), והופכים אותה לרעיון שמתאים לה */
export async function inspire(input: { url: string | null; pageText: string; note: string; images: string[]; voices: string; feedback: Feedback[] }) {
  const parts: BrainPart[] = [{ text: `היא שלחה השראה. ${input.url ? `קישור: ${input.url}` : "בלי קישור."}
${input.pageText ? `מה שמופיע בעמוד (כותרת ותיאור):\n${input.pageText}` : ""}
${input.note ? `מה היא כתבה: ${input.note}` : ""}
${input.images.length ? "מצורפות תמונות מההשראה (פריימים מהסרטון או התמונה עצמה)." : ""}

שני חשבונות: @hadarelifergan (אישי: תכנון טיולים ומערכות לעסקים קטנים) ו-@plania.il (Plania: ארגון הבית ותכנון ארוחות).
הקול שלה:
${input.voices}

${preferencesBlock(input.feedback)}

הבינו מה עובד בהשראה (הפורמט, ההוק, המבנה, הצילום), ותני 2 הצעות שלוקחות את זה לעולם שלה. לא מעתיקים: מתאימים לעסק ולקול שלה.
לכל הצעה: title, idea, why (מה לקחנו מההשראה ולמה זה יעבוד אצלה), trend: -1, account, niche, format.
${TEMPLATE_RULE}
${HOOK_RULES}
בלי אימוג'י ובלי מקפים ארוכים. אם אי אפשר להבין מההשראה כלום (אין טקסט ואין תמונה), כתבי ב-why מה חסר, ועדיין הציעי לפי ההערה שלה.` }];
  input.images.slice(0, 4).forEach((img) => parts.push({ image: img }));
  const raw = cleanDeep(await askBrain({ prefer: "claude", schema: IdeaSuggestSchema, system: "את מנהלת סושיאל שהופכת השראה לרעיון מקורי שמתאים ליוצרת.", parts }));
  return finishSuggestions(raw, [], "inspiration", input.url);
}
