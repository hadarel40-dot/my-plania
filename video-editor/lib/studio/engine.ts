import "server-only";
import { z } from "zod";
import { askBrain } from "@/lib/ai/brain";
import { cleanDeep } from "./clean";
import { NICHES, type Beat, type Check, type Draft, type DraftData, type Hook, type ScreenCard } from "./config";
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
עובדות ומספרים אמיתיים שהיא נתנה (רק מהם מותר לקחת מספרים): ${draft.facts.slice(0, 3000) || "לא נתנה. כל מספר שצריך יופיע כ-{{המספר שלך}}."}`;
}

export async function writeHooks(draft: Draft, voice: string): Promise<DraftData> {
  const raw = cleanDeep(await askBrain({
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
    { id: "cta", label: "קריאה אחת לפעולה, בסוף", pass: ctas.length === 1 && last?.role === "cta", detail: `${ctas.length} קריאות` },
    { id: "safe", label: "טקסט בתוך האזור הבטוח", pass: true, detail: "בין y=230 ל-1440, 230 פיקסלים פנויים מימין" },
  ];
  if (placeholders.length) checks.push({ id: "facts", label: "מספרים שחסרים לך", pass: true, info: true, detail: placeholders.join(", ") });

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
  let result = finish(cleanDeep(await askBrain({ schema: ScriptSchema, system, parts: [{ text: prompt("") }] })), hook, draft.mode);
  const failed = result.checks.filter((c) => !c.pass && !c.info);
  // לשרת יש דקה לבקשה: מתקנים רק אם נשאר זמן, ואחרת הבדיקות שנכשלו מוצגות לה כמו שהן
  if (failed.length && Date.now() - started < 22_000) {
    // ניסיון אחד לתקן, עם רשימת הבדיקות שנכשלו
    const note = failed.map((c) => `${c.label}: ${c.detail}`).join("; ");
    result = finish(cleanDeep(await askBrain({ schema: ScriptSchema, system, parts: [{ text: prompt(`\nבגרסה הקודמת נכשלו הבדיקות האלה, תקני אותן: ${note}`) }] })), hook, draft.mode);
  }
  const keep = (draft.data.checks ?? []).filter((c) => c.id === "one_idea" || c.id === "missing");
  return { ...draft.data, chosen: hookIndex, ...result, checks: [...keep, ...result.checks] };
}
