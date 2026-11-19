import type { Hook, HookCheck } from "./config";

/**
 * ציון הוק: גרסה עברית של hookscore.py מהסקיל ig-reel. חמש בדיקות, כל אחת 0 עד 100.
 * הבדיקה החלשה קובעת את הציון, ומתחת ל-50 ההוק לא מוכן. נבדק בקוד, לא אצל המודל.
 * המודל רק משלים מה שקוד לא יכול לדעת: מה המילה החשובה, ואיזה שמות יש בשורה.
 */

const SPOKEN_NUMBERS = new Set([
  "אפס", "שתיים", "שניים", "שתי", "שני", "שלוש", "שלושה", "ארבע", "ארבעה", "חמש", "חמישה", "שש", "שישה", "שבע", "שבעה",
  "שמונה", "תשע", "תשעה", "עשר", "עשרה", "עשרים", "שלושים", "ארבעים", "חמישים", "מאה", "מאות", "אלף", "אלפים", "מיליון",
  "חצי", "פעמיים", "שקל", "שקלים", "אחוז", "אחוזים", "דולר", "יורו",
]);
const STAKES = new Set([
  "אל", "לא", "אף", "אסור", "תפסיקי", "תפסיק", "תפסיקו", "די", "טעות", "טעויות", "הפסדתי", "הפסד", "מפסידה", "מפסידים", "עלה", "עלתה",
  "עולה", "שילמתי", "בזבזתי", "בזבוז", "זרקתי", "מחקתי", "נכשלתי", "פספסתי", "פספוס", "חבל", "מתחרטת", "סוד", "האמת", "אמת", "בעיה",
  "סכנה", "רק", "בלי", "במקום", "לפני", "אבל", "חוץ", "הכי", "גרוע", "חינם", "שקר", "נמאס", "שונאת", "קנס", "ויתרתי", "עדיין", "כבר",
]);
const WEAK_OPENERS = ["אז", "היי", "הי", "שלום", "בוקר", "ערב", "היום", "תקשיבו", "בואו", "בואי", "רציתי", "בסרטון", "בריל", "יש לי", "אני רוצה", "מה קורה"];
const IMPERATIVES = new Set(["אל", "תפסיקי", "תפסיק", "קחי", "תעתיקי", "תשמרי", "תנסי", "תעשי", "תמחקי", "תבדקי", "תכתבי", "תתחילי", "שימי", "שמרי", "נסי", "עשי", "בדקי"]);
const SECOND_PERSON = new Set(["את", "אתה", "אתם", "אתן", "לך", "שלך", "שלכם", "לכם", "אותך", "אותכם", "בשבילך", "עלייך", "עליך", "אלייך"]);
const FIRST_PERSON = new Set(["אני", "שלי", "לי", "אותי", "אנחנו", "שלנו", "לנו"]);
const PREFIXES = ["ו", "ה", "ב", "ל", "מ", "ש", "כ"];

export function words(text: string): string[] {
  return String(text || "")
    .replace(/(?<=\d),(?=\d)/g, "")
    .replace(/[^\p{L}\p{N}{}₪%$'"׳״\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** המילה בלי עד שתי אותיות שימוש בתחילתה (וכשאת -> את) */
function bare(token: string): string {
  let t = token.replace(/['"׳״]/g, "");
  for (let i = 0; i < 2 && t.length > 2 && PREFIXES.includes(t[0]); i++) t = t.slice(1);
  return t;
}
const has = (set: Set<string>, token: string) => set.has(token) || set.has(bare(token));
const isNumber = (token: string) => /\d|₪|%|\$|\{\{/.test(token) || has(SPOKEN_NUMBERS, token);
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export interface HookHints {
  key_word?: string;
  named_entities?: string[];
  stakes_score?: number;
  stakes_reason?: string;
  direct_score?: number;
}

export function scoreHook(text: string, hints: HookHints = {}): Pick<Hook, "checks" | "weakest" | "flags" | "score" | "ready"> {
  const w = words(text);
  const n = w.length;
  const names = (hints.named_entities ?? []).filter((name) => name && text.includes(name));

  // אורך: 5 עד 12 מילים נאמרות בשתי שניות בערך
  let length = n >= 5 && n <= 12 ? 100 : n < 5 ? 100 - (5 - n) * 20 : 100 - (n - 12) * 11;
  if (text.trim().length > 60) length -= 12;

  // ספציפיות: מספר, מחיר או שם
  const nums = w.filter(isNumber);
  const hits = nums.length + names.length;
  const specificity = hits === 0 ? 15 : 45 + hits * 30;

  // סיכון: מה הצופה יפסיד אם יגלול הלאה
  const stakeHits = [...new Set(w.filter((t) => has(STAKES, t)))];
  if (/₪|\$/.test(text)) stakeHits.push("מחיר");
  let stakes = stakeHits.length === 0 ? 20 : stakeHits.length === 1 ? 70 : 100;
  let stakesDetail = stakeHits.length ? `מילות סיכון: ${stakeHits.slice(0, 4).join(", ")}` : "שום דבר לא על הכף";
  if (typeof hints.stakes_score === "number" && hints.stakes_score > stakes) {
    stakes = Math.min(hints.stakes_score, 75);
    stakesDetail = `${stakesDetail}. לפי הניתוח: ${hints.stakes_reason ?? ""}`.trim();
  }

  // חזית: המילה החשובה בשלוש המילים הראשונות
  const key = bare(words(hints.key_word ?? "")[0] ?? "");
  const payload = w.findIndex((t) => isNumber(t) || has(STAKES, t) || (!!key && bare(t) === key) || names.some((nm) => nm.startsWith(t)));
  const opener = w.slice(0, 2).join(" ");
  const weak = WEAK_OPENERS.find((o) => opener === o || opener.startsWith(`${o} `) || w[0] === o);
  let front = payload < 0 ? 30 : payload <= 2 ? 100 : payload <= 5 ? 60 : 30;
  if (weak) front -= 30;

  // פנייה ישירה לצופה אחת
  let direct = 35;
  let directDetail = "גוף שלישי, אף אחד לא בחדר";
  if (w.some((t) => has(SECOND_PERSON, t))) {
    direct = 100;
    directDetail = "פונה ישירות לצופה";
  } else if (w[0] && (has(IMPERATIVES, w[0]) || (/^ת.+י$/.test(w[0]) && w[0].length > 3))) {
    direct = 90;
    directDetail = `פתיחה בציווי ("${w[0]}")`;
  } else if (w.some((t) => has(FIRST_PERSON, t) || /תי$/.test(t))) {
    direct = 70;
    directDetail = "גוף ראשון, בלי פנייה לצופה";
  }
  // בעברית פונים לצופה גם דרך צורת הפועל, שרשימת מילים מפספסת. הניתוח יכול להעלות, עם תקרה
  if (typeof hints.direct_score === "number" && hints.direct_score > direct) {
    direct = Math.min(hints.direct_score, 85);
    directDetail = "פונה לצופה דרך צורת הפועל (לפי הניתוח)";
  }

  const flags: string[] = [];
  if (/^(היי|הי|שלום|מה קורה)/.test(text.trim())) flags.push("פתיחה בברכה. אף אחד לא הגיע לפיד כדי שיגידו לו שלום.");
  if (/בסרטון הזה|בריל הזה|אני הולכת להראות|אני אראה לכם/.test(text)) flags.push("הקדמה. למחוק ולפתוח ישר בתמורה.");
  if (/#/.test(text)) flags.push("האשטג בהוק.");

  const checks: Record<"length" | "specificity" | "stakes" | "front" | "direct", HookCheck> = {
    length: { score: clamp(length), detail: `${n} מילים, כ-${(n / 2.75).toFixed(1)} שניות בדיבור (רוצים 5 עד 12)` },
    specificity: { score: clamp(specificity), detail: hits ? `סימנים קונקרטיים: ${[...nums, ...names].slice(0, 4).join(", ")}` : "אין מספר, מחיר או שם" },
    stakes: { score: clamp(stakes), detail: stakesDetail },
    front: { score: clamp(front), detail: (payload < 0 ? "אין מילה חשובה בשורה" : `המילה החשובה במקום ${payload + 1}`) + (weak ? `, פתיחה חלשה "${weak}"` : "") },
    direct: { score: clamp(direct), detail: directDetail },
  };
  const entries = Object.entries(checks);
  const weakest = entries.reduce((a, b) => (b[1].score < a[1].score ? b : a))[0];
  const score = clamp(Math.min(...entries.map(([, c]) => c.score)) - flags.length * 15);
  return { checks, weakest, flags, score, ready: score >= 50 };
}
