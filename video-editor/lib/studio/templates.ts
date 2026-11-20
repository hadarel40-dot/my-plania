/**
 * תבניות מוכנות לרילס ולקרוסלות: מבנים שחוזרים עכשיו בתוכן קצר, כתובים כמבנה ולא כהעתקה של יוצר מסוים.
 * "למה זה עובד" מתאר את המנגנון, בלי מספרים, כי אין לנו נתונים שמוכיחים מספר כזה.
 * המנוע מקבל את המבנה ככללים, וכותב לפיו בקול שלה.
 */
import type { Niche } from "./config";

export type TemplateKind = "reel" | "carousel";
export type CarouselStyle = "cream" | "ink" | "butter";

export interface Template {
  id: string;
  kind: TemplateKind;
  name: string;
  /** רמז קצר לפורמט, כמו שמחפשים אותו ברשת */
  tag: string;
  why: string;
  /** reel: full או short (טקסט קצר). carousel: מספר שקופיות מומלץ */
  mode?: "full" | "short";
  structure: string[];
  /** לרילס: מה מצלמים, כולל אופציה בלי פנים */
  shots?: string[];
  example: string;
  niches: Niche[];
  style?: CarouselStyle;
  /** מילים שמחברות את התבנית לטרנד בדוח (כותרות של טרנדים מסוג format/hook) */
  match: string[];
}

export const TEMPLATES: Template[] = [
  // ---------- רילס
  {
    id: "text-7s", kind: "reel", mode: "short", name: "ריל טקסט של 7 שניות", tag: "Text-on-screen reel",
    why: "שוט אחד פשוט וטקסט שלוקח יותר זמן לקרוא מאורך הסרטון. צופות חוזרות כדי לסיים לקרוא, והריל נצפה שוב ושוב.",
    structure: ["שוט אחד רגוע מהחיים (מטבח, שולחן, מסך), בלי דיבור", "כרטיס 1: ההוק, עד שש מילים", "כרטיס 2 ו-3: התובנה, משפט קצר בכל אחד", "כרטיס אחרון: פעולה אחת (לשמור, להגיב במילה)"],
    shots: ["שוט אחד יציב 7 עד 9 שניות, תנועה קטנה בפריים (יד, אדים, דף מתהפך)", "בלי פנים: ידיים על מקלדת או על מחברת"],
    example: "יד מערבבת סיר. כרטיס: 'הסוד לשבוע רגוע מתחיל ביום ראשון'.",
    niches: ["home", "meals", "travel", "business"], match: ["text", "טקסט", "caption reel", "silent", "aesthetic"],
  },
  {
    id: "montage-10s", kind: "reel", mode: "short", name: "מונטאז' של 10 שניות", tag: "Quick-cut b-roll",
    why: "הרבה קטעים קצרים שמתחלפים בקצב של המוזיקה, עם טקסט אחד שמחבר. קל לצלם ממה שכבר יש בגלריה.",
    structure: ["6 עד 10 קטעים של שנייה בערך, לפי הביט", "כרטיס אחד לאורך כל הסרטון: ההוק", "הקטע האחרון: התוצאה (שולחן ערוך, מזוודה סגורה, מסך מוכן)"],
    shots: ["קטעים קצרים מהיום: קניות, הכנה, אריזה, תכנון", "בלי פנים: הכל ידיים וחפצים"],
    example: "קטעים מהכנת אוכל לשבוע. כרטיס: 'שעה אחת ביום ראשון. שבוע שלם רגוע'.",
    niches: ["meals", "home", "travel"], match: ["montage", "b-roll", "broll", "aesthetic", "cuts", "מונטאז"],
  },
  {
    id: "mistakes-3", kind: "reel", mode: "full", name: "3 טעויות", tag: "Mistakes list",
    why: "טעות היא סיכון: הצופה רוצה לבדוק שהיא לא עושה אותה. מספר ברור מבטיח סוף, ולכן נשארים עד הסוף.",
    structure: ["הוק: 'שלוש טעויות ש...' (מה מפסידים)", "הסיכון: מה זה עולה, במשפט", "טעות 1 ומה עושים במקום", "טעות 2 ומה עושים במקום", "טעות 3, החשובה ביותר", "קריאה לפעולה שמהדהדת את ההוק"],
    shots: ["פריים שונה לכל טעות", "בלי פנים: מסך או מחברת עם X ו-V"],
    example: "שלוש טעויות שעולות לך יום שלם בטיול.",
    niches: ["travel", "business", "home", "meals"], match: ["mistake", "טעויות", "don't", "avoid", "stop"],
  },
  {
    id: "before-after", kind: "reel", mode: "full", name: "לפני ואחרי", tag: "Before / After",
    why: "השינוי נראה בעין, בלי הסבר. ההוק הוא התוצאה, והצופה נשארת כדי לראות איך הגיעו אליה.",
    structure: ["פתיחה בתוצאה (אחרי), שנייה אחת", "חזרה ל'לפני', הבלגן", "2 עד 3 צעדים שעשו את השינוי", "חזרה לאחרי", "קריאה לפעולה"],
    shots: ["אותה זווית בדיוק ללפני ולאחרי (סימן על הרצפה או חצובה)", "בלי פנים: מגירה, מקרר, מסך יומן"],
    example: "המקרר ביום חמישי מול המקרר אחרי תכנון של עשר דקות.",
    niches: ["home", "meals", "business"], match: ["before", "after", "transformation", "glow up", "makeover", "לפני"],
  },
  {
    id: "myth-fact", kind: "reel", mode: "full", name: "מיתוס מול אמת", tag: "Myth vs fact",
    why: "שוברים משהו שכולן מאמינות בו. זה מעורר תגובות ('אבל אני...') ושיתופים למי שצריכה לשמוע.",
    structure: ["הוק: המיתוס, כמו שאומרים אותו", "'זה לא נכון, והנה למה'", "האמת במשפט אחד", "דוגמה מהחיים שלך", "קריאה לפעולה: 'תשלחי למי שעדיין חושבת ש...'"],
    shots: ["כרטיס 'מיתוס' אדום וכרטיס 'אמת' ירוק על אותו שוט", "בלי פנים: טקסט על רקע מהבית"],
    example: "מיתוס: תכנון ארוחות לוקח שעות.",
    niches: ["meals", "home", "business", "travel"], match: ["myth", "fact", "unpopular", "truth", "מיתוס"],
  },
  {
    id: "pov", kind: "reel", mode: "short", name: "POV", tag: "POV",
    why: "הצופה נכנסת לסיטואציה בגוף ראשון ומזהה את עצמה. עובד בלי דיבור, עם טקסט ומוזיקה.",
    structure: ["כרטיס: 'POV: את...' (סיטואציה מוכרת מאוד)", "שוט שמראה את הרגע", "תפנית: מה משתנה כשיש שיטה", "כרטיס סיום קצר"],
    shots: ["שוט מנקודת המבט שלה (הטלפון ביד, המקרר נפתח)", "בלי פנים: הכל מנקודת מבט"],
    example: "POV: חמש בערב ואין לך מושג מה מכינים.",
    niches: ["meals", "home", "travel"], match: ["pov", "relatable", "point of view"],
  },
  {
    id: "steps-3", kind: "reel", mode: "full", name: "מדריך ב-3 צעדים", tag: "How-to in 3 steps",
    why: "תועלת מיידית שאפשר ליישם היום. סרטון כזה נשמר כדי לחזור אליו.",
    structure: ["הוק: התוצאה בזמן קצר ('ככה אני ... בעשר דקות')", "צעד 1", "צעד 2", "צעד 3", "התוצאה", "קריאה לפעולה: 'תשמרי לפעם הבאה'"],
    shots: ["כל צעד מצולם בנפרד, קרוב", "בלי פנים: מסך מוקלט או ידיים"],
    example: "ככה אני מתכננת מסלול טיול שלם בשלושה צעדים.",
    niches: ["travel", "business", "meals", "home"], match: ["how to", "tutorial", "steps", "hack", "מדריך", "טיפ"],
  },
  {
    id: "day-in-life", kind: "reel", mode: "full", name: "יום אחד איתי", tag: "Day in my life",
    why: "חיבור אישי. הצופות מכירות את מי שמאחורי העסק, ומשם מגיעים אמון ועוקבות.",
    structure: ["הוק: מה מיוחד ביום הזה", "בוקר", "רגע עבודה (המוצר או השירות בפעולה, בעדינות)", "רגע אישי", "סיום עם תובנה אחת", "קריאה לפעולה רכה (לעקוב)"],
    shots: ["5 עד 7 רגעים מהיום, שנייה או שתיים לכל אחד", "בלי פנים: ידיים, קפה, מסך, נוף"],
    example: "יום עבודה של אמא שבונה אפליקציה.",
    niches: ["business", "home", "travel"], match: ["day in", "vlog", "routine", "יום"],
  },
  {
    id: "things-i-do", kind: "reel", mode: "short", name: "דברים שאני עושה כל ראשון", tag: "Things I do every…",
    why: "רשימה קצרה של הרגלים. קל להעתיק, ולכן שומרים ושולחים.",
    structure: ["כרטיס: 'דברים שאני עושה כל ראשון כדי ש...'", "4 עד 5 הרגלים, כרטיס לכל אחד, על שוט מתחלף", "סיום: התוצאה (שבוע רגוע)"],
    shots: ["שוט קצר לכל הרגל", "בלי פנים: ידיים ופריטים"],
    example: "דברים שאני עושה כל ראשון כדי שהשבוע לא יברח לי.",
    niches: ["home", "meals", "business"], match: ["things i do", "habits", "reset", "sunday", "routine"],
  },
  {
    id: "this-vs-that", kind: "reel", mode: "full", name: "זה מול זה", tag: "This vs that",
    why: "השוואה ברורה עוזרת להחליט. אנשים מגיבים עם הצד שלהם.",
    structure: ["הוק: 'א מול ב, ניסיתי את שניהם'", "איך זה נראה עם א", "איך זה נראה עם ב", "מה ניצח ולמה, במשפט", "קריאה לפעולה: 'ואת, איזה צוות?'"],
    shots: ["מסך מפוצל או שני שוטים מתחלפים", "בלי פנים: שני מסכים או שתי מחברות"],
    example: "פתקים מול אפליקציה לתכנון שבוע.",
    niches: ["business", "travel", "home", "meals"], match: ["vs", "versus", "comparison", "which", "מול"],
  },
  {
    id: "storytime", kind: "reel", mode: "full", name: "סיפור קצר עם תפנית", tag: "Storytime",
    why: "סיפור אישי עם קושי ותפנית נשמע כמוך, ובונה חיבור. זה גם המבנה הטבעי בקול שלך.",
    structure: ["הוק: הרגע הכי קשה, באמצע הסיפור", "מה ניסיתי ולא עבד", "'ואז הבנתי ש...'", "מה השתנה", "פתיחה לעתיד או קריאה לפעולה רכה"],
    shots: ["בי-רול מהבית שמתאים לכל שלב", "בלי פנים: כל הסיפור כטקסט על שוטים"],
    example: "יש לי הפרעת קשב, ועם האוכל תמיד הסתבכתי.",
    niches: ["home", "meals", "business", "travel"], match: ["story", "storytime", "confession", "סיפור"],
  },
  {
    id: "save-checklist-reel", kind: "reel", mode: "short", name: "צ'קליסט לשמירה", tag: "Save this checklist",
    why: "רשימה שאפשר לחזור אליה היא סיבה ברורה לשמור, ושמירות הן סימן חזק לאינסטגרם.",
    structure: ["כרטיס: 'תשמרי את זה לפני ה...'", "5 עד 7 פריטים קצרים, כרטיס כל שנייה", "כרטיס אחרון: 'שמרת? עכשיו את מוכנה'"],
    shots: ["שוט רקע אחד או שניים, רגוע", "בלי פנים: רשימה על דף או מסך"],
    example: "תשמרי את זה לפני שאת אורזת לטיול עם ילדים.",
    niches: ["travel", "home", "meals", "business"], match: ["checklist", "save this", "list", "רשימה"],
  },
  {
    id: "green-screen", kind: "reel", mode: "full", name: "מגיבה לכתבה או לטרנד", tag: "Green screen reaction",
    why: "לוקחים משהו שכולן כבר מדברות עליו ומוסיפים את הזווית שלך. נשען על טרנד קיים בלי להעתיק.",
    structure: ["הוק: הכותרת או הטרנד על המסך", "'הנה מה שאף אחד לא אומר על זה'", "הזווית שלך ב-2 עד 3 ביטים", "מה לעשות עם זה", "קריאה לפעולה"],
    shots: ["צילום מסך של הכתבה ברקע (כמו גרין סקרין)", "בלי פנים: רק המסך עם טקסט"],
    example: "כולן מדברות על הכנת אוכל מראש. הנה הגרסה שעובדת עם ילדים קטנים.",
    niches: ["business", "meals", "travel", "home"], match: ["reaction", "react", "green screen", "trend", "news"],
  },

  // ---------- קרוסלות
  {
    id: "car-steps", kind: "carousel", name: "שלב אחרי שלב", tag: "Step-by-step", style: "cream",
    why: "רעיון אחד מפורק לשלבים. כל החלקה מתקדמת, וזה הפורמט שהכי מחזיק עד השקופית האחרונה.",
    structure: ["שער: התוצאה בשש מילים", "למה זה חשוב", "שלב 1", "שלב 2", "שלב 3", "שלב 4", "סיכום לשמירה", "קריאה לפעולה"],
    example: "תפריט שבועי בארבעה שלבים.",
    niches: ["meals", "travel", "business", "home"], match: ["step", "guide", "how to", "carousel", "מדריך"],
  },
  {
    id: "car-mistakes", kind: "carousel", name: "טעויות ומה במקום", tag: "Mistakes carousel", style: "ink",
    why: "כל שקופית היא טעות ותיקון. הצופה בודקת את עצמה, ושולחת לחברה שעושה את אותה טעות.",
    structure: ["שער: 'X טעויות ש...'", "מה הן עולות לך", "טעות 1 ותיקון", "טעות 2 ותיקון", "טעות 3 ותיקון", "סיכום: כל התיקונים ברשימה", "קריאה לפעולה"],
    example: "4 טעויות בבניית אתר לעסק קטן.",
    niches: ["business", "travel", "home", "meals"], match: ["mistake", "avoid", "don't", "טעויות"],
  },
  {
    id: "car-myths", kind: "carousel", name: "מיתוסים ואמת", tag: "Myth vs fact", style: "butter",
    why: "שובר אמונה נפוצה. זה מזמין ויכוח בתגובות ושיתופים.",
    structure: ["שער: 'מה שאמרו לך על X לא נכון'", "מיתוס 1 מול אמת", "מיתוס 2 מול אמת", "מיתוס 3 מול אמת", "מה כן עובד", "קריאה לפעולה"],
    example: "3 מיתוסים על תכנון ארוחות.",
    niches: ["meals", "home", "business", "travel"], match: ["myth", "fact", "truth", "מיתוס"],
  },
  {
    id: "car-checklist", kind: "carousel", name: "צ'קליסט לשמירה", tag: "Checklist / Save this", style: "cream",
    why: "כל שקופית חלק מרשימה, והאחרונה היא הרשימה המלאה. בדיוק מה ששומרים ושולחים.",
    structure: ["שער: 'הצ'קליסט שלי ל...'", "למה צריך אותו", "קטגוריה 1 ופריטים", "קטגוריה 2 ופריטים", "קטגוריה 3 ופריטים", "כל הרשימה בשקופית אחת", "קריאה לפעולה: לשמור"],
    example: "הצ'קליסט שלי לטיסה עם ילדים.",
    niches: ["travel", "home", "meals", "business"], match: ["checklist", "list", "packing", "רשימה"],
  },
  {
    id: "car-before-after", kind: "carousel", name: "לפני ואחרי", tag: "Before / After", style: "cream",
    why: "השוואה ויזואלית: 'לפני' בשקופית אחת, 'אחרי' בבאה. עובד במיוחד עם תמונות שלך.",
    structure: ["שער: התוצאה", "לפני: מה היה", "מה שיניתי 1", "מה שיניתי 2", "אחרי: מה יש עכשיו", "סיכום", "קריאה לפעולה"],
    example: "יומן העבודה שלי לפני ואחרי מערכת אחת.",
    niches: ["business", "home", "meals"], match: ["before", "after", "transformation", "לפני"],
  },
  {
    id: "car-story", kind: "carousel", name: "סיפור בשקופיות", tag: "Story carousel", style: "ink",
    why: "סיפור אישי שמתקדם בכל החלקה, כמו פרקים. מתאים לקול שלך ולסיפור של פלניה.",
    structure: ["שער: משפט מהאמצע של הסיפור", "הקושי", "מה ניסיתי", "'ואז הבנתי'", "מה השתנה", "מה זה אומר בשבילך", "קריאה לפעולה רכה"],
    example: "איך הפרעת קשב הובילה אותי לבנות את פלניה.",
    niches: ["home", "business", "meals", "travel"], match: ["story", "journey", "confession", "סיפור"],
  },
  {
    id: "car-stack", kind: "carousel", name: "הכלים שלי", tag: "My stack / tools", style: "butter",
    why: "רשימת כלים שאפשר לאמץ מחר. שומרים, ושואלים בתגובות.",
    structure: ["שער: 'X כלים שחוסכים לי...'", "כלי 1: מה הוא עושה לי", "כלי 2", "כלי 3", "כלי 4", "איך הם עובדים יחד", "קריאה לפעולה: 'איזה כלי חסר?'"],
    example: "5 כלים שמנהלים לי את העסק מהטלפון.",
    niches: ["business", "travel", "home"], match: ["tools", "apps", "stack", "favorites", "כלים"],
  },
  {
    id: "car-week-plan", kind: "carousel", name: "תוכנית שבוע", tag: "Weekly plan", style: "cream",
    why: "יום בכל שקופית. מוחשי, ואפשר להעתיק כמו שהוא.",
    structure: ["שער: 'השבוע שלי ב...'", "ראשון", "שני", "שלישי", "רביעי", "חמישי", "סיכום: כל השבוע בשקופית אחת", "קריאה לפעולה"],
    example: "תפריט לשבוע שלם מרשימת קניות אחת.",
    niches: ["meals", "home", "travel"], match: ["weekly", "week", "plan", "meal plan", "שבוע"],
  },
];

export const templateById = (id?: string | null) => TEMPLATES.find((t) => t.id === id) ?? null;

/** הכללים של התבנית, כפי שהמנוע מקבל אותם */
export function templateBrief(t: Template | null) {
  if (!t) return "";
  return `
התבנית שנבחרה: ${t.name} (${t.tag}).
למה היא עובדת: ${t.why}
המבנה, לפי הסדר (חובה לעקוב אחריו):
${t.structure.map((s, i) => `${i + 1}. ${s}`).join("\n")}
${t.shots?.length ? `מה מצלמים:\n${t.shots.map((s) => `- ${s}`).join("\n")}` : ""}
דוגמה לכיוון בלבד (לא להעתיק): ${t.example}`;
}

/** תבניות שמתאימות לטרנד מסוג פורמט או הוק, לפי מילים בכותרת */
export function templatesForTrend(text: string) {
  const t = text.toLowerCase();
  return TEMPLATES.filter((x) => x.match.some((m) => t.includes(m.toLowerCase())));
}
