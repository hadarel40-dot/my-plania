import "server-only";
import { z } from "zod";
import { askBrain, type BrainPart } from "@/lib/ai/brain";
import type { DriveFile } from "./drive";
import { templateBrief, templateById } from "./templates";
import { cleanDeep } from "./clean";
import { SPLIT_LOOK, applyCaptionDefaults, type BrandKit } from "./brand";
import { ACCOUNTS, NICHES, type Beat, type Carousel, type Materials, type Check, type Draft, type DraftData, type Hook, type ScreenCard } from "./config";
import { scoreHook, words } from "./hookscore";

/**
 * מנוע הריל, לפי כללי הסקיל ig-reel. הוא כותב רק לטיוטה עצמה:
 * לא יוצר פריט בלוח, לא משנה שלב ולא מפרסם.
 */

const FORMULAS = `1. Cost Confession: {סכום מדויק} זה מה שטעות אחת עלתה לי.
2. Negative Command: תפסיקי {פעולה נפוצה}. תעשי {חלופה} במקום.
3. Nobody Tells You: אף אחד לא מספר לך ש{אמת לא נוחה על מה שרוצים}.
4. The Replacement: {הדבר הזה} החליף {דבר יקר} ב{מחיר}.
5. Time Collapse: זה היה לוקח לי {זמן ארוך}. היום {זמן קצר}.
6. The Receipt: עשיתי {דבר} במשך {N ימים}. הנה המספרים האמיתיים.
7. Wrong Way, Right Way: את עושה {דבר} לא נכון, וזו לא אשמתך. {התיקון}.
8. Insider Leak: {N שנים} הייתי {בפנים}. הנה מה שאף פעם לא אמרנו בקול.
9. The Steal: קחי את ה{תבנית/רשימה}. לקח לי {זמן} לדייק אותה.
10. If This, Then Watch: אם את {מצב ספציפי}, ה{זמן קצר} הזה פותר את זה.
11. Numbered With A Favourite: {N} {דברים} ש{תוצאה}. מספר {k} הוא זה שאף אחד לא משתמש בו.
12. The Objection: "{התנגדות שאומרים באמת}". בסדר. הנה הגרסה שעובדת בכל זאת.
13. Before And After: {הישן}. {החדש}. {משפט אחד על המנוף}.
14. The Callout: {קבוצה ספציפית}, זה הדבר שאתן מתעלמות ממנו.
15. The Flop Record: {N} הניסיונות הראשונים שלי לא עשו כלום. הנה מה שהשתנה ב{N+1}.
16. The Verbatim Question: "{שאלה בדיוק כמו ששאלו}". שואלים אותי את זה כל שבוע.
17. Head To Head: {א} מול {ב}. ניסיתי את שניהם {זמן} ואחד מהם לא היה קרוב.
18. Cold Open Demo: {פתיחה באמצע הפעולה}. תראי מה זה עושה.
19. The Deadline: {דבר} משתנה ב{תאריך}. תעשי {פעולה} לפני.
20. Permission: את לא צריכה {הדבר שכולם אומרים שצריך}.
21. Mid-Sentence Start: {...ואז בדיוק {התפנית}.}
22. Contrarian Flip: {אמירה מוכרת, הפוכה}.
23. The Statistic: {N}% מ{קבוצה} {עובדה מפתיעה}. רק עם מקור אמיתי.
24. The Reveal: זה ה{דבר} החדש.
25. Someone Else's Result: הייתה {אישה אחת} ש{תוצאה} ב{זמן}. רק אם זה קרה באמת.
26. The Superlative: ה{הכי מהיר/היחיד} {דבר} זה {התשובה}.`;

const HooksSchema = z.object({
  one_idea: z.string(),
  too_many_ideas: z.boolean(),
  missing_facts: z.array(z.string()),
  hooks: z.array(z.object({
    formula: z.string(),
    spoken: z.string(),
    on_screen: z.string(),
    key_word: z.string(),
    named_entities: z.array(z.string()),
    stakes_score: z.number(),
    stakes_reason: z.string(),
    direct_score: z.number(),
    why: z.string(),
  })),
});

const ScriptSchema = z.object({
  beats: z.array(z.object({
    role: z.enum(["hook", "stakes", "body", "payoff", "cta"]),
    line: z.string(),
    frame: z.string(),
    card: z.string(),
    seconds: z.number(),
  })),
  cta: z.string(),
  shots: z.array(z.object({
    frame: z.string(),
    angle: z.string(),
    seconds: z.number(),
    says: z.string(),
    conditions: z.string(),
    faceless: z.string(),
  })),
  clip_checklist: z.array(z.string()),
  caption_first_line: z.string(),
});

const WPS = 165 / 60;

function context(draft: Draft, voice: string) {
  return `הקול שלה:
${voice}

נישה: ${NICHES.find((n) => n.value === draft.niche)?.search ?? "לפי הרעיון"}
הרעיון: ${draft.idea.slice(0, 2000)}
עובדות ומספרים אמיתיים שהיא נתנה (רק מהם מותר לקחת מספרים): ${draft.facts.slice(0, 3000) || "לא נתנה. כל מספר שצריך יופיע כ-{{המספר שלך}}."}${templateBrief(templateById(draft.data.template))}`;
}

export async function writeHooks(draft: Draft, voice: string): Promise<DraftData> {
  const raw = cleanDeep(await askBrain({ prefer: "claude",
    schema: HooksSchema,
    system: "את מנהלת סושיאל שמבינה שיווק, וכותבת הוקים לריל אינסטגרם בעברית מדוברת.",
    parts: [{ text: `${context(draft, voice)}

הנוסחאות:
${FORMULAS}

כתבי שלושה הוקים, כל אחד מנוסחה אחרת שבאמת מתאימה לרעיון (לא שלושה ניסוחים של אותה נוסחה).
לכל הוק:
- spoken: השורה שאומרים, 5 עד 12 מילים, בלי הקדמה ובלי ברכה, המילה החשובה בשלוש המילים הראשונות, פונה לצופה כשזה טבעי.
- on_screen: השורה על המסך, עד שש מילים, קצרה וחדה יותר מהמדוברת.
- formula: שם הנוסחה באנגלית כמו ברשימה.
- key_word: המילה הכי חשובה בהוק, כפי שהיא כתובה בו.
- named_entities: שמות, מקומות, מותגים או מחירים שמופיעים בהוק (או רשימה ריקה).
- stakes_score 0-100 ו-stakes_reason: עד כמה ברור מה הצופה יפסיד אם תגלול הלאה.
- direct_score 0-100: עד כמה ההוק פונה לצופה אחת.
- why: למה ההוק הזה יעבוד לקהל הזה, במשפט.
אסור להמציא מספרים, לקוחות או תוצאות. מספר שלא הופיע בעובדות נכתב בדיוק כך: {{המספר שלך}}.
one_idea: הרעיון האחד של הריל במשפט. too_many_ideas: true אם הרעיון בעצם שניים.
missing_facts: מה כדאי שהיא תשלים (מספר, מחיר, זמן) כדי שההוק יהיה ספציפי.
בלי אימוג'י ובלי מקפים ארוכים.` }],
  }));
  const hooks: Hook[] = raw.hooks.slice(0, 3).map((h) => ({ formula: h.formula, spoken: h.spoken, on_screen: h.on_screen, why: h.why, ...scoreHook(h.spoken, h) }));
  hooks.sort((a, b) => b.score - a.score);
  const checks: Check[] = [];
  if (raw.too_many_ideas) checks.push({ id: "one_idea", label: "רעיון אחד לריל", pass: false, detail: `יש כאן יותר מרעיון אחד. הרעיון המרכזי: ${raw.one_idea}` });
  if (raw.missing_facts.length) checks.push({ id: "missing", label: "כדאי להשלים", pass: true, info: true, detail: raw.missing_facts.join(" | ") });
  return { hooks, chosen: 0, one_idea: raw.one_idea, checks };
}

/** תזמון, כרטיסי טקסט באזור הבטוח, והבדיקות של ig-reel. הכל מחושב כאן ולא אצל המודל */
function finish(raw: z.infer<typeof ScriptSchema>, hook: Hook, mode: Draft["mode"]) {
  let t = 0;
  const beats: Beat[] = raw.beats.map((b, i) => {
    const spoken = words(b.line).length;
    const dur = mode === "short" ? Math.max(0.8, Number(b.seconds) || 2) : Math.max(1.2, spoken / WPS);
    const row: Beat = { n: i + 1, role: b.role, line: b.line, frame: b.frame, card: b.card || undefined, start: +t.toFixed(1), end: +(t + dur).toFixed(1), words: spoken };
    t += dur;
    return row;
  });
  const total = +t.toFixed(1);
  const cards: ScreenCard[] = beats.filter((b) => b.card).map((b) => ({ text: b.card!, start: b.start, end: b.end, y: b.role === "hook" ? 420 : 1100 }));
  if (!cards.length || cards[0].start > 0) cards.unshift({ text: hook.on_screen, start: 0, end: beats[0]?.end ?? 2, y: 420 });

  const last = beats[beats.length - 1];
  const hookWords = words(hook.spoken).map((w) => w.replace(/^[והבלמשכ]{1,2}(?=.{3,})/, "")).filter((w) => w.length >= 3);
  const echo = hookWords.find((w) => `${last?.line ?? ""} ${last?.card ?? ""}`.includes(w));
  const range = mode === "short" ? [7, 12] : [15, 45];
  const longBeats = beats.filter((b) => b.end - b.start > 4).map((b) => b.n);
  const ctas = beats.filter((b) => b.role === "cta");
  const placeholders = [...new Set(JSON.stringify(raw).match(/\{\{[^}]+\}\}/g) ?? [])];

  const checks: Check[] = [
    { id: "hook_time", label: "ההוק נגמר עד 3 שניות", pass: (beats[0]?.end ?? 0) <= 3, detail: `${beats[0]?.end ?? 0} שניות` },
    { id: "length", label: `אורך ${range[0]} עד ${range[1]} שניות`, pass: total >= range[0] && total <= range[1], detail: `${total} שניות, ${beats.reduce((s, b) => s + b.words, 0)} מילים ב-165 לדקה` },
    { id: "beats", label: "כל ביט עד 4 שניות, הפריים משתנה", pass: longBeats.length === 0, detail: longBeats.length ? `ביטים ארוכים: ${longBeats.join(", ")}` : "תקין" },
    { id: "cards", label: "עד שש מילים לכרטיס", pass: cards.every((c) => words(c.text).length <= 6), detail: cards.filter((c) => words(c.text).length > 6).map((c) => c.text).join(" | ") || "תקין" },
    { id: "echo", label: "השורה האחרונה מהדהדת מילה מההוק", pass: !!echo, detail: echo ? `"${echo}"` : "אין מילה חוזרת" },
    { id: "cta", label: "קריאה אחת לפעולה, בסוף", pass: ctas.length === 1 && last?.role === "cta", detail: ctas.length === 1 ? "קריאה אחת" : ctas.length === 0 ? "אין קריאה לפעולה" : `${ctas.length} קריאות` },
    { id: "safe", label: "טקסט בתוך האזור הבטוח", pass: true, detail: "בין y=230 ל-1440, 230 פיקסלים פנויים מימין" },
  ];
  if (placeholders.length) checks.push({ id: "facts", label: "מספרים שחסרים לך", pass: true, info: true, detail: `יש ${placeholders.length === 1 ? "מקום אחד" : `${placeholders.length} מקומות`} שמחכים למספר אמיתי שלך. בטקסט כתוב שם "המספר שלך"` });

  return {
    script: { beats, total_seconds: total, total_words: beats.reduce((s, b) => s + b.words, 0), echo_word: echo ?? "", caption_first_line: raw.caption_first_line },
    cards,
    shots: raw.shots.map((s, i) => ({ ...s, n: i + 1 })),
    checklist: raw.clip_checklist,
    cta: raw.cta,
    checks,
  };
}

export async function writeScript(draft: Draft, voice: string, hookIndex: number): Promise<DraftData> {
  const hook = draft.data.hooks?.[hookIndex];
  if (!hook) throw new Error("קודם צריך הוקים");
  const shape = draft.mode === "short"
    ? "ריל טקסט קצר, 7 עד 10 שניות: שוט אחד עד שלושה מהחיים (בי-רול), בלי דיבור למצלמה. הטקסט על המסך הוא התוכן, והוא לוקח קצת יותר זמן לקרוא מאורך הסרטון, כדי שיצפו שוב. line ריק כשאין דיבור. seconds חובה בכל ביט."
    : `תסריט מלא של 15 עד 45 שניות בקצב 165 מילים לדקה:
- hook: עד 3 שניות, השורה המדוברת של ההוק בדיוק כפי שהיא.
- stakes: שורה אחת, למה זה חשוב לצופה ומה תפסיד.
- body: כמה ביטים, רעיון אחד בכל ביט, כל ביט עד 4 שניות (עד 11 מילים), והפריים משתנה בכל ביט.
- payoff: מקיים את ההבטחה של ההוק.
- cta: ביט אחרון, קריאה אחת לפעולה (שמירה, תגובה עם מילה, או מעקב). השורה הזו מהדהדת מילה מההוק.`;
  const prompt = (retry: string) => `${context(draft, voice)}

ההוק שנבחר (${hook.formula}):
מדובר: ${hook.spoken}
על המסך: ${hook.on_screen}

${shape}

לכל ביט: role, line (מה אומרים), frame (מה רואים בפריים, ספציפי), card (טקסט על המסך לביט הזה, עד שש מילים, או ריק), seconds.
טקסט על המסך הוא תסריט נפרד: קצר מהדיבור, לא חוזר עליו מילה במילה. כרטיס ההוק מופיע מהפריים הראשון.
אין הקדמה, אין "בסרטון הזה", אין שם ואין לוגו.

shots: רשימת שוטים לצילום, 9:16 אנכי. לכל שוט: frame (מה בפריים), angle (זווית וגובה מצלמה), seconds, says (מה אומרים בשוט, או ריק), conditions (אור, מקום, שעה, מה להכין לפני), faceless (אותו שוט בלי פנים: ידיים, מסך, חפצים או טקסט על המסך). היא לא תמיד בפריים, אז faceless חובה בכל שוט.
clip_checklist: 4 עד 7 דברים שחייבים להיות בקליפ כדי שיהיה טוב (תנועה בפריים הראשון, אור, יציבות, צליל, מה רואים בשנייה הראשונה).
caption_first_line: שורת הפתיחה של הכיתוב, עד 12 מילים.
מספרים: רק מהעובדות שהיא נתנה. כל מספר אחר נכתב {{המספר שלך}}. בלי אימוג'י ובלי מקפים ארוכים.${retry}`;
  const system = "את מנהלת סושיאל שמובילה יוצרת מרעיון עד סרטון מוכן. כותבת בעברית מדוברת, כמו שהיא מדברת.";

  const started = Date.now();
  let result = finish(cleanDeep(await askBrain({ prefer: "claude", schema: ScriptSchema, system, parts: [{ text: prompt("") }] })), hook, draft.mode);
  const failed = result.checks.filter((c) => !c.pass && !c.info);
  // לשרת יש דקה לבקשה: מתקנים רק אם נשאר זמן, ואחרת הבדיקות שנכשלו מוצגות לה כמו שהן
  if (failed.length && Date.now() - started < 22_000) {
    // ניסיון אחד לתקן, עם רשימת הבדיקות שנכשלו
    const note = failed.map((c) => `${c.label}: ${c.detail}`).join("; ");
    result = finish(cleanDeep(await askBrain({ prefer: "claude", schema: ScriptSchema, system, parts: [{ text: prompt(`\nבגרסה הקודמת נכשלו הבדיקות האלה, תקני אותן: ${note}`) }] })), hook, draft.mode);
  }
  const keep = (draft.data.checks ?? []).filter((c) => c.id === "one_idea" || c.id === "missing");
  return { ...draft.data, chosen: hookIndex, ...result, checks: [...keep, ...result.checks] };
}

// ---------- קרוסלה (לפי הסקיל ig-carousel)

const CarouselSchema = z.object({
  slides: z.array(z.object({ kind: z.enum(["cover", "stake", "point", "recap", "cta"]), headline: z.string(), body: z.string() })),
  caption: z.string(),
  alt: z.string(),
});

/** הבדיקות של ig-carousel, בקוד */
export function carouselChecks(c: Carousel): Check[] {
  const n = c.slides.length;
  const cover = c.slides[0];
  const points = c.slides.filter((x) => x.kind === "point");
  const ctas = c.slides.filter((x) => x.kind === "cta");
  const longBody = c.slides.filter((x) => words(x.body).length > 25).map((x, i) => i + 1);
  const badHead = points.filter((x) => words(x.headline).length < 1 || words(x.headline).length > 6).map((x) => x.headline);
  const placeholders = [...new Set(JSON.stringify(c).match(/\{\{[^}]+\}\}/g) ?? [])];
  const checks: Check[] = [
    { id: "count", label: "6 עד 10 שקופיות", pass: n >= 6 && n <= 10, detail: `${n} שקופיות` },
    { id: "cover", label: "כותרת השער עד שש מילים", pass: cover?.kind === "cover" && words(cover.headline).length <= 6, detail: cover ? `${words(cover.headline).length} מילים` : "אין שער" },
    { id: "body", label: "עד 25 מילים בכל שקופית", pass: longBody.length === 0, detail: longBody.length ? `ארוכות מדי: ${longBody.join(", ")}` : "תקין" },
    { id: "heads", label: "כותרת קצרה (עד 6 מילים) לכל רעיון", pass: badHead.length === 0, detail: badHead.join(" | ") || "תקין" },
    { id: "recap", label: "שקופית סיכום שאפשר לצלם ולשלוח", pass: c.slides.some((x) => x.kind === "recap"), detail: c.slides.some((x) => x.kind === "recap") ? "יש" : "חסרה" },
    { id: "cta", label: "קריאה אחת לפעולה, בסוף", pass: ctas.length === 1 && c.slides[n - 1]?.kind === "cta", detail: ctas.length === 1 ? "קריאה אחת" : ctas.length === 0 ? "אין קריאה לפעולה" : `${ctas.length} קריאות` },
  ];
  if (placeholders.length) checks.push({ id: "facts", label: "מספרים שחסרים לך", pass: true, info: true, detail: `יש ${placeholders.length === 1 ? "מקום אחד" : `${placeholders.length} מקומות`} שמחכים למספר אמיתי שלך. בטקסט כתוב שם "המספר שלך"` });
  return checks;
}

/**
 * כתיבה מחדש לא מורידה תמונות (המשוב שלה): התמונות של הקרוסלה הקודמת עוברות לשקופיות החדשות.
 * שער נשאר עם תמונת השער, השאר לפי הסדר, ואם יש יותר שקופיות מתמונות, התמונות חוזרות במעגל.
 * גם הסגנון נשמר (קרוסלת "תמונה" נשארת "תמונה").
 */
export function keepImages(prev: Carousel | undefined, next: Carousel): Carousel {
  const imgs = (prev?.slides ?? []).map((s) => s.image).filter((x): x is NonNullable<typeof x> => !!x);
  if (!imgs.length) return next;
  const cover = prev!.slides[0]?.image ?? imgs[0];
  const rest = imgs.filter((x) => x !== cover);
  const pool = rest.length ? rest : imgs;
  let k = 0;
  return {
    ...next,
    style: prev?.style ?? next.style,
    slides: next.slides.map((s, i) => ({ ...s, image: s.image ?? (i === 0 ? cover : pool[k++ % pool.length]) })),
  };
}

/** הסוף של פוסט לפי המטרה של השבוע */
export function goalCta(goal?: string) {
  if (goal === "sell") return "cta: הזמנה לכתוב מילה אחת קצרה בתגובה (מילת קוד, למשל \"תכנון\") כדי לקבל ממנה משהו שימושי בהודעה פרטית. מילה אחת, כתובה במפורש.";
  if (goal === "launch") return "cta: מזמינה להגיב במילה אחת קצרה כדי להיות הראשונות לשמוע כשזה יוצא. מילה אחת, כתובה במפורש.";
  if (goal === "authority") return "cta: לשמור את הפוסט לפעם הבאה שזה יקרה.";
  if (goal === "grow") return "cta: לשלוח למישהי שצריכה את זה, או לעקוב בשביל עוד כאלה.";
  return "cta: פעולה אחת בלבד, לפי סוג הקרוסלה שלמעלה (שמירה: לשמור. קרבה: שאלה לתגובות. פנייה: מילה בתגובה או בהודעה).";
}

/** המבנה של כל סוג קרוסלה (שמירה, קרבה, פנייה) */
function carouselKindBlock(type?: string) {
  if (type === "story") return `סוג: קרוסלת קרבה (אישית). רגע אמיתי אחד מהחיים שלה, מסופר שקופית אחרי שקופית כמו סיפור קצר: מה קרה, מה הרגישה, מה הבינה.
פרטים אמיתיים וקטנים, בלי הטפה. שקופית recap היא מה שהיא לקחה מזה. הסוף: שאלה אישית שמזמינה לספר בתגובות. המטרה: שירגישו קרובות וישארו.`;
  if (type === "trust") return `סוג: קרוסלת פנייה (איך זה לעבוד איתה, או להשתמש במה שהיא מציעה). מבנה: הבעיה של מי שפונה אליה, התהליך שלב אחרי שלב, לפני ואחרי, ומה יוצא בסוף.
רק דברים אמיתיים, בלי תוצאות ממוצאות ובלי לחץ. הסוף: הזמנה לכתוב מילה אחת בתגובה או בהודעה כדי לקבל פרטים. המטרה: שיפנו אליה.`;
  return `סוג: קרוסלת שמירה (ערך). ספציפית ומעשית: כל שקופית point היא רעיון אחד עם דוגמה קונקרטית מהחיים (body מתחיל ב"למשל" או מראה איך בפועל).
recap הוא רשימה שמצלמים ושומרים. הסוף: לשמור את הפוסט. המטרה: שישמרו וישתפו, וככה יגיעו אנשים חדשים.`;
}

export async function writeCarousel(draft: Draft, voice: string, kit?: BrandKit | null): Promise<DraftData> {
  const handle = ACCOUNTS.find((a) => a.value === draft.account)?.label ?? "";
  const prompt = (retry: string) => `${context(draft, voice)}

${carouselKindBlock(draft.data.content_type)}

כתבי קרוסלה לאינסטגרם, 6 עד 10 שקופיות, בסדר הזה:
1. cover: השער. headline עד שש מילים, חד וספציפי, body שורה אחת של הבטחה.
2. stake: למה זה חשוב לצופה, במשפט אחד. גם היא צריכה לעבוד כשער שני, אז לא הקדמה.
3 והלאה. point: רעיון אחד בכל שקופית. headline של 1 עד 5 מילים (מילה אחת חזקה עובדת הכי טוב), body עד 25 מילים.
body בשקופיות cover, stake ו-point: שלוש שורות קצרות, מופרדות בירידת שורה: משפט קצר ומודגש (עד 5 מילים), שורה אישית וקלילה (עד 8 מילים, יוצאת בכתב יד), ושורה שלישית קצרה של מה זה נותן לה (עד 4 מילים, יוצאת עם חץ).
לפני האחרונה. recap: הכל כרשימה קצרה, השקופית שמצלמים ושולחים. body עם שורה לכל נקודה.
אחרונה. ${goalCta(draft.data.goal)}
caption: הכיתוב לפוסט. שורה ראשונה שמושכת להמשיך לקרוא, גוף קצר בקול שלה, קריאה אחת לפעולה, ושלושה האשטגים רלוונטיים בסוף.
alt: תיאור קצר של השער, לקוראי מסך.
רעיון אחד לקרוסלה. מספרים רק מהעובדות, ואחרים נכתבים {{המספר שלך}}. בלי אימוג'י ובלי מקפים ארוכים.${retry}`;
  const system = "את מנהלת סושיאל שכותבת קרוסלות שמחזיקות עד השקופית האחרונה. עברית מדוברת, בקול שלה.";
  const started = Date.now();
  let raw = cleanDeep(await askBrain({ prefer: "claude", schema: CarouselSchema, system, parts: [{ text: prompt("") }] }));
  const style = templateById(draft.data.template)?.style ?? draft.data.carousel?.style ?? "cream";
  let carousel: Carousel = { ...raw, handle, style };
  let checks = carouselChecks(carousel);
  const failed = checks.filter((c) => !c.pass && !c.info);
  if (failed.length && Date.now() - started < 25_000) {
    raw = cleanDeep(await askBrain({ prefer: "claude", schema: CarouselSchema, system, parts: [{ text: prompt(`\nבגרסה הקודמת נכשלו הבדיקות האלה, תקני אותן: ${failed.map((c) => `${c.label}: ${c.detail}`).join("; ")}`) }] }));
    carousel = { ...raw, handle, style };
    checks = carouselChecks(carousel);
  }
  // ברירות המחדל של החשבון: עיצוב, קריאה לפעולה ותגיות
  const { palette: _palette, cta: _cta, hashtags: _tags, ...theme } = kit ?? {}; // eslint-disable-line @typescript-eslint/no-unused-vars
  // בלי עיצוב מותג ובלי עיצוב קודם: "השער שלי" (תמונה מלאה, כותרת ענקית, כתב יד וחץ)
  const look = Object.keys(theme).length ? theme : SPLIT_LOOK;
  const kept = keepImages(draft.data.carousel, { ...carousel, caption: applyCaptionDefaults(carousel.caption, kit), ...(!draft.data.carousel?.theme ? { theme: look, style: "photo" as const } : {}) });
  return { ...draft.data, carousel: kept, checks };
}

// ---------- חומרים מהדרייב

const MatchSchema = z.object({
  matches: z.array(z.object({ target: z.string(), file_index: z.number(), reason: z.string() })),
  missing: z.array(z.string()),
});

/** מתאים לכל שוט (או שקופית) קובץ מהדרייב, לפי שם, תאריך, תיקייה ותמונה ממוזערת. מה שאין, נכתב כ"חסר לצלם" */
export async function matchMaterials(draft: Draft, files: DriveFile[], thumbs: (string | null)[], opts: { redo?: boolean; avoid?: string[] } = {}): Promise<Materials> {
  const d = draft.data;
  const targets = draft.mode === "carousel"
    ? (d.carousel?.slides ?? []).map((sl, i) => `שקופית ${i + 1} (${sl.kind}): ${sl.headline}${sl.body ? ` | ${sl.body.replace(/\n/g, " / ")}` : ""}`)
    : (d.shots ?? []).map((sh) => `שוט ${sh.n}: ${sh.frame} | בלי פנים: ${sh.faceless}`);
  if (!targets.length) throw new Error("קודם צריך תסריט עם שוטים, או קרוסלה");
  const list = files.map((f, i) => {
    const dur = f.videoMediaMetadata?.durationMillis ? `${Math.round(Number(f.videoMediaMetadata.durationMillis) / 1000)} ש׳` : "";
    return `#${i} ${f.mimeType.startsWith("video/") ? "וידאו" : "תמונה"} | ${f.name}${f.description ? ` | ${f.description}` : ""}${dur ? ` | ${dur}` : ""} | ${(f.createdTime ?? "").slice(0, 10)}`;
  }).join("\n");
  const parts: BrainPart[] = [{ text: `הסרטון או הקרוסלה: ${draft.idea}

מה צריך:
${targets.join("\n")}

הקבצים בדרייב שלה (מספר, סוג, שם, תיקייה, אורך, תאריך):
${list}

אחרי הטקסט יש תמונות ממוזערות של חלק מהקבצים, כל אחת עם המספר שלה.
חובה לבחור קובץ לכל שוט ולכל שקופית ברשימה, בלי יוצא מן הכלל. target כתוב בדיוק כמו ברשימה למעלה (למשל "שוט 2" או "שקופית 1"). file_index הוא המספר של הקובץ.
תהיי יצירתית: אם אין צילום מדויק, בוחרים את הכי קרוב באווירה, בפעולה או בנושא. למשל ידיים במטבח במקום ידיים כותבות, סיר מבעבע במקום "מה מכינים היום", שולחן עם מחשב במקום תכנון, נוף או שקיעה לשקופית רגשית או לסוף.
reason במשפט קצר ואמיתי: מה רואים בקובץ ולמה הוא עובד כאן. בתחליף כותבים שזה תחליף ("תחליף: ...").
לא לחזור על אותו קובץ אם יש מספיק קבצים שונים.
missing לא חובה: רק אם צילום חדש ספציפי ישפר מאוד, הצעה קצרה. זה בנוסף לבחירה, לא במקומה.${draft.mode === "carousel" ? `
בקרוסלה: התמונה צריכה להראות את מה שכתוב בשקופית שלה (למשל שקופית על קניות: סופר או רשימה, על בישול: מטבח וסיר). לשער: התמונה הכי חזקה, עדיף איתה בפריים. לשקופית אישית: רגע אמיתי שלה. להעדיף תמונות על פני סרטונים.` : ""}${opts.redo ? `
חשוב: היא ביקשה לבחור מחדש, כי הבחירה הקודמת לא התאימה (תמונות לא מתאימות לטקסט, או במקום הלא נכון). תבחרי מחדש מאפס, שקופית אחרי שקופית, לפי מה שכתוב בה.${opts.avoid?.length ? ` אל תבחרי את הקבצים שכבר היו (${opts.avoid.length}), אלא אם אין שום חלופה.` : ""}` : ""}` }];
  thumbs.forEach((t, i) => { if (t) parts.push({ text: `#${i}` }, { image: t }); });
  const raw = cleanDeep(await askBrain({ prefer: "claude", schema: MatchSchema, system: "את עורכת וידאו שמכירה את הארכיון של היוצרת ומוצאת לכל שוט את הצילום שמתאים לו.", parts }));
  const matches = raw.matches
    .filter((m) => files[m.file_index])
    .map((m) => ({ target: m.target, file_id: files[m.file_index].id, reason: m.reason }));
  // רשת ביטחון: שוט או שקופית שנשארו בלי קובץ מקבלים קובץ שעוד לא שימש (וידאו לשוט, תמונה לשקופית)
  const key = (t: string) => t.match(/(שוט|שקופית)\s*\d+/)?.[0] ?? t;
  const covered = new Set(matches.map((m) => key(m.target)));
  const taken = new Set(matches.map((m) => m.file_id));
  const wantVideo = draft.mode !== "carousel";
  const avoid = new Set(opts.avoid ?? []);
  const pool = [...files.filter((f) => f.mimeType.startsWith(wantVideo ? "video/" : "image/")), ...files.filter((f) => !f.mimeType.startsWith(wantVideo ? "video/" : "image/"))]
    .sort((a, b) => Number(avoid.has(a.id)) - Number(avoid.has(b.id)));
  for (const t of targets) {
    const k = key(t);
    if (covered.has(k)) continue;
    const f = pool.find((x) => !taken.has(x.id)) ?? pool[0];
    if (!f) break;
    taken.add(f.id);
    matches.push({ target: k, file_id: f.id, reason: "תחליף: נבחר מהקבצים האחרונים בתיקייה. אפשר להחליף בעורך" });
  }
  const used = new Set(matches.map((m) => m.file_id));
  return {
    files: files.filter((f) => used.has(f.id)).map((f) => ({ id: f.id, name: f.name, mimeType: f.mimeType, duration: f.videoMediaMetadata?.durationMillis ? Math.round(Number(f.videoMediaMetadata.durationMillis) / 100) / 10 : undefined })),
    matches,
    missing: raw.missing,
    checked_at: new Date().toISOString(),
  };
}

// ---------- צ'אט עם המעצב

const CarouselEditSchema = z.object({
  reply: z.string(),
  slides: z.array(z.object({ kind: z.enum(["cover", "stake", "point", "recap", "cta"]), headline: z.string(), body: z.string(), keep_image_of: z.number().int().nullable() })),
  caption: z.string(),
});

/**
 * שינוי קטן בקרוסלה לפי בקשה בעברית פשוטה ("השער ארוך מדי", "תחליפי את שקופית 3", "בלי השקופית האחרונה").
 * התמונות נשמרות: לכל שקופית חדשה נאמר מאיזו שקופית קודמת לקחת את התמונה.
 */
export async function editCarouselByChat(draft: Draft, voice: string, message: string): Promise<{ carousel: Carousel; reply: string }> {
  const c = draft.data.carousel;
  if (!c) throw new Error("עוד אין קרוסלה לערוך");
  const before = c.slides.map((s, i) => ({ n: i + 1, kind: s.kind, headline: s.headline, body: s.body, has_image: !!s.image }));
  const out = cleanDeep(await askBrain({
    prefer: "claude", schema: CarouselEditSchema,
    system: "את המעצבת שלה. מקבלת בקשה קטנה על קרוסלה ומבצעת בדיוק אותה, בלי לשנות דברים שלא ביקשה. עברית מדוברת בקול שלה, בלי אימוג'י, בלי מקפים ארוכים, בלי מספרים מומצאים.",
    parts: [{ text: `${voice}

הקרוסלה עכשיו (n הוא מספר השקופית):
${JSON.stringify(before)}
הכיתוב: ${c.caption}

הבקשה שלה: "${message}"

החזירי את הקרוסלה אחרי השינוי:
- slides: כל השקופיות לפי הסדר החדש. מה שלא ביקשה לשנות נשאר מילה במילה.
- keep_image_of: מספר השקופית הקודמת (n) שהתמונה שלה עוברת לשקופית הזאת. בדרך כלל אותו מספר. אם ביקשה תמונה אחרת לשקופית, תני תמונה של שקופית אחרת שמתאימה יותר. null רק לשקופית חדשה לגמרי, ואז היא תקבל תמונה אוטומטית.
- caption: הכיתוב (משתנה רק אם ביקשה).
- reply: משפט אחד, מה שינית.` }],
  }));
  const slides = out.slides.map((s) => {
    const src = s.keep_image_of ? c.slides[s.keep_image_of - 1] : undefined;
    return { kind: s.kind, headline: s.headline, body: s.body, ...(src?.image ? { image: src.image } : {}) };
  });
  return { carousel: keepImages(c, { ...c, slides, caption: out.caption }), reply: out.reply };
}

const ReelRequestSchema = z.object({
  reply: z.string(),
  changes: z.array(z.object({
    card: z.number().int().nullable(),
    action: z.enum(["replace_clip", "edit_text", "remove_card", "reorder", "timing", "other"]),
    detail: z.string(),
  })),
});

/** בקשה על ריל: מבינים מה לשנות (כרטיס, פעולה), והסרטון מתעדכן בעיבוד הבא (רינדור הווידאו נעשה בתהליך השבועי) */
export async function understandReelRequest(draft: Draft, message: string) {
  const source = draft.data.edit?.cards ?? draft.data.cards ?? [];
  const cards = source.map((c, i) => ({ n: i + 1, text: c.text, from: c.start, to: c.end }));
  return cleanDeep(await askBrain({
    schema: ReelRequestSchema,
    system: "את עורכת הווידאו שלה. מבינה בקשה קצרה על ריל ומתרגמת אותה לשינויים מדויקים. עברית פשוטה, בלי אימוג'י.",
    parts: [{ text: `הכרטיסים בריל (n, הטקסט, משנייה עד שנייה):
${JSON.stringify(cards)}

הבקשה שלה: "${message}"

changes: מה לשנות. card הוא מספר הכרטיס (n), "האחרון" הוא ${cards.length || "האחרון"}. action: replace_clip (להחליף סרטון), edit_text (לשנות טקסט, detail הוא הטקסט החדש), remove_card, reorder, timing (מהירות, אורך), other.
timing: detail הוא "מהיר" או "איטי".
reply: משפט אחד קצר שמאשר מה הבנת.` }],
  }));
}

// ---------- צור שבוע של קרוסלות

const CarouselIdeasSchema = z.object({
  ideas: z.array(z.object({ idea: z.string(), niche: z.enum(["travel", "business", "home", "meals"]), template: z.string() })),
});

/** רעיונות לקרוסלות לשבוע שלם, שונים זה מזה ומהקיים, לפי הקול, הטרנדים והתבניות */
export async function carouselIdeas(account: Draft["account"], voice: string, count: number, existing: string[], trends: { title: string; reel_idea: string }[], templates: { id: string; name: string }[]) {
  const niches = NICHES.filter((n) => n.account === account).map((n) => n.value);
  const out = cleanDeep(await askBrain({
    schema: CarouselIdeasSchema,
    system: "את מנהלת הסושיאל שלה. מתכננת שבוע של קרוסלות שכל אחת שווה שמירה או שליחה לחברה. עברית מדוברת, בלי אימוג'י, בלי מקפים ארוכים, בלי מספרים מומצאים.",
    parts: [{ text: `${voice}

החשבון: ${account}. נישות מותרות: ${niches.join(", ")}.
טרנדים מאומתים: ${JSON.stringify(trends.slice(0, 10))}
כבר קיים (לא לחזור): ${JSON.stringify(existing.slice(0, 60))}
תבניות קרוסלה: ${JSON.stringify(templates)}

כתבי ${count} רעיונות לקרוסלות לשבוע הקרוב. כל רעיון במשפט אחד ספציפי (מה הצופה תקבל), מגוון בין ערך, סיפור, טעויות, צ'קליסט ומאחורי הקלעים.
niche מהרשימה המותרת. template הוא id של תבנית מהרשימה שהכי מתאימה.` }],
  }));
  return out.ideas.slice(0, count).map((x) => ({ ...x, niche: niches.includes(x.niche) ? x.niche : niches[0] }));
}

// ---------- ריל מסרטונים שהיא העלתה

const UploadReelSchema = z.object({
  title: z.string(),
  caption: z.string(),
  cards: z.array(z.object({ headline: z.string(), body: z.string() })),
});

/**
 * ריל מהסרטונים שהיא העלתה. סרטון דיבור: הכתוביות הן מה שנאמר (לא משנים מילה), ורק הכותרת והכיתוב נכתבים.
 * סרטונים בלי דיבור: נכתבים כרטיסי טקסט קצרים לפי הרעיון, אחד לכל קטע או שניים.
 */
export async function writeUploadReel(input: { voice: string; idea: string; transcript: string | null; cardCount: number; hook?: string; goal?: string }) {
  return cleanDeep(await askBrain({
    prefer: "claude", schema: UploadReelSchema,
    system: "את מנהלת הסושיאל שלה. עברית מדוברת וחמה, בלי אימוג'י, בלי מקפים ארוכים, בלי מספרים מומצאים. את שם האפליקציה כותבים Plania.",
    parts: [{ text: `${input.voice}

הרעיון של הריל (מה שהיא כתבה): ${input.idea || "לא כתבה, תסיקי מהדיבור"}
${input.transcript ? `מה שהיא אומרת בסרטון: "${input.transcript}"\n\ncards: רשימה ריקה (הכתוביות הן הדיבור עצמו).` : `אין דיבור בסרטונים. cards: בדיוק ${input.cardCount} כרטיסים לפי הסדר: headline עד 6 מילים שעוצר גלילה (הראשון הוא ההוק${input.hook ? `, והוא בדיוק: "${input.hook}"` : ""}), body עד 7 מילים או ריק.`}
title: שם קצר לריל (עד 7 מילים).
caption: כיתוב לפוסט: שורה ראשונה שמושכת, 2-4 שורות קצרות, ${input.goal ? `בסוף קריאה אחת לפעולה (${goalCta(input.goal).replace(/^cta: /, "")})` : "שאלה אחת בסוף"}, ושלושה האשטגים רלוונטיים בשורה אחרונה.` }],
  }));
}

const PickSchema = z.object({ picks: z.array(z.object({ file_index: z.number().int(), reason: z.string() })) });

/**
 * ריל מהדרייב בלי צילום חדש: בוחרים מהארכיון שלה כמה סרטונים שמתאימים לרעיון, לפי הסדר של הריל
 * (פתיחה שעוצרת, אמצע שמראה, סוף רגוע). exclude: סרטונים שכבר נבחרו לרילס אחרים באותו שבוע.
 */
export async function pickDriveClips(input: { idea: string; hook: string; files: DriveFile[]; thumbs: (string | null)[]; count: number; exclude: string[] }) {
  const videos = input.files.map((f, i) => ({ f, i })).filter(({ f }) => f.mimeType.startsWith("video/") && !input.exclude.includes(f.id));
  if (!videos.length) return [];
  const list = videos.map(({ f, i }) => {
    const dur = f.videoMediaMetadata?.durationMillis ? `${Math.round(Number(f.videoMediaMetadata.durationMillis) / 1000)} ש׳` : "";
    return `#${i} | ${f.name}${f.description ? ` | ${f.description}` : ""}${dur ? ` | ${dur}` : ""}`;
  }).join("\n");
  const parts: BrainPart[] = [{ text: `הרעיון של הריל: ${input.idea}
ההוק: ${input.hook}

הסרטונים בדרייב שלה (מספר, שם, תיקייה, אורך):
${list}

אחרי הטקסט יש תמונות ממוזערות של חלק מהקבצים, כל אחת עם המספר שלה.
בחרי בדיוק ${input.count} סרטונים שונים, לפי הסדר שבו יופיעו בריל: הראשון פותח ועוצר גלילה, האמצעיים מראים את הרעיון, האחרון רגוע וסוגר.
מעדיפים סרטונים אנכיים, עם תנועה, ושקשורים לנושא. אם אין צילום מדויק, בוחרים את הכי קרוב באווירה.
reason במשפט קצר: מה רואים ולמה זה מתאים.` }];
  input.thumbs.forEach((t, i) => { if (t && videos.some((v) => v.i === i)) parts.push({ text: `#${i}` }, { image: t }); });
  const raw = cleanDeep(await askBrain({ prefer: "claude", schema: PickSchema, system: "את עורכת וידאו שמכירה את הארכיון של היוצרת ובוחרת צילומים לריל.", parts }));
  const ok = new Set(videos.map((v) => v.i));
  const chosen: DriveFile[] = [];
  for (const p of raw.picks) {
    const f = ok.has(p.file_index) ? input.files[p.file_index] : undefined;
    if (f && !chosen.includes(f)) chosen.push(f);
  }
  // רשת ביטחון: משלימים מהסרטונים האחרונים שלא נבחרו
  for (const { f } of videos) { if (chosen.length >= input.count) break; if (!chosen.includes(f)) chosen.push(f); }
  return chosen.slice(0, input.count);
}

// ---------- מעבדת הוקים ושכתוב מהיר

const HookLabSchema = z.object({ hooks: z.array(z.object({ headline: z.string(), body: z.string() })) });

/** חמש פתיחות חלופיות לשקופית הראשונה (קרוסלה) או לכרטיס הראשון (ריל), שונות זו מזו בזווית */
export async function hookLab(input: { voice: string; idea: string; current: string; rest: string; format: "carousel" | "reel" }) {
  const raw = cleanDeep(await askBrain({
    prefer: "claude", schema: HookLabSchema,
    system: "את מנהלת סושיאל שכותבת פתיחות שעוצרות גלילה. עברית מדוברת, בקול שלה, בלי אימוג'י, בלי מקפים ארוכים, בלי מספרים מומצאים. את שם האפליקציה כותבים Plania.",
    parts: [{ text: `${input.voice}

${input.format === "carousel" ? "השער של קרוסלה" : "הכרטיס הראשון של ריל"}.
הרעיון: ${input.idea}
הפתיחה הנוכחית: ${input.current}
מה בא אחריה: ${input.rest.slice(0, 1200)}

כתבי 5 פתיחות חלופיות, כל אחת בזווית אחרת: סקרנות, טעות נפוצה, תוצאה, הזדהות אישית, ומשפט נועז. כולן חייבות להתאים למה שבא אחריהן.
headline עד 6 מילים. body ${input.format === "carousel" ? "שורה אחת קצרה של הבטחה" : "ריק"}. לא לחזור על הפתיחה הנוכחית.` }],
  }));
  return raw.hooks.slice(0, 5);
}

export const REWRITES = { short: "קצר יותר, חצי מהאורך בערך", sharp: "חד ונועז יותר, מילים חזקות", personal: "יותר אישי, מהחוויה שלה", simple: "פשוט וברור יותר, מילים יומיומיות" } as const;
const RewriteSchema = z.object({ headline: z.string(), body: z.string() });

/** שכתוב מהיר של שקופית או כרטיס, בלי לשנות את המשמעות */
export async function rewriteText(input: { voice: string; headline: string; body: string; how: keyof typeof REWRITES }) {
  return cleanDeep(await askBrain({
    prefer: "claude", schema: RewriteSchema,
    system: "את עורכת טקסט לסושיאל. עברית מדוברת, בקול שלה, בלי אימוג'י, בלי מקפים ארוכים, בלי מספרים מומצאים. את שם האפליקציה כותבים Plania.",
    parts: [{ text: `${input.voice}

כתבי מחדש את הטקסט הזה: ${REWRITES[input.how]}. אותה משמעות, אותו רעיון.
headline: ${input.headline}
body: ${input.body || "(ריק, להשאיר ריק)"}` }],
  }));
}
