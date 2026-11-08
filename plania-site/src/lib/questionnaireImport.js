import { answersToText } from './projects';

export const IMPORT_FIELD_LABELS = {
  project_type: 'סוג הפרויקט',
  business_name: 'שם העסק',
  existing_site: 'אתר או אפליקציה קיימים',
  goal: 'מטרת הפרויקט',
  audience: 'קהל יעד',
  pages_features: "עמודים ופיצ'רים",
  brand: 'מיתוג',
  references: 'דוגמאות והשראות',
  requirements: 'דרישות ופרטי אפיון',
};

// Questionnaires saved over time were worded differently ("אתם" / "את", older and newer
// versions), so answers are matched by what the question is about, not by exact text.
// Each rule: [project field, short heading, pattern on the question text].
// The first rule that matches wins, so specific rules come before general ones.
const RULES = [
  ['business_name', '', /^שם העסק/],
  ['existing_site', '', /לינקים|קישורים|איפה אתם נמצאים/],
  ['references', '', /אוהבים ורוצים משהו דומה|דוגמאות|השראה/],
  ['project_type', '', /^מה (אתם )?צריכים\??$|^מה צריך\??$|מה עולה לכם בראש|חושבים על פתרון/],

  ['goal', 'על העסק', /מה העסק עושה|במה העסק עוסק|במה העסק שלכם/],
  ['goal', 'הבעיה לפתור', /איזו בעיה/],
  ['goal', 'מה רוצים לשפר', /רוצים לשפר|לפשוט יותר/],
  ['goal', 'מה הכי מפריע', /מה הכי מפריע/],
  ['goal', 'איך נדע שהצליח', /איך תדעו|דמיינו שהפתרון/],
  ['goal', 'הכי חשוב בהתחלה', /הכי חשוב שיעבוד|דבר אחד שיעבוד/],

  ['audience', 'הלקוחות', /מי יש?תמש|מי הלקוחות שישתמשו/],
  ['audience', 'מכשיר עיקרי', /מאיפה הן|מאיזה מכשיר/],
  ['audience', 'סוגי לקוחות', /סוגים שונים של לקוחות/],

  ['pages_features', 'אזור אישי', /אזור אישי/],
  ['pages_features', 'יכולות', /אילו יכולות|מה צריך שיהיה|מה הייתם רוצים שתוכלו/],
  ['pages_features', 'תשלום דרך המערכת', /(ישלמו|משלמ\S*|משלמים) דרך/],
  ['pages_features', 'סוג התשלום', /^סוג התשלום|איזה סוג תשלום/],
  ['pages_features', 'מסלולים ומחירים', /מסלולים או מחירים/],

  ['brand', 'לוגו', /לוגו/],
  ['brand', 'צבעי המותג', /צבעי/],
  ['brand', 'אווירה', /שלוש מילים/],
  ['brand', 'מה לא לעשות בעיצוב', /לא.*בעיצוב/],
  ['brand', 'שפה', /שפה/],

  ['requirements', 'כמה זמן העסק קיים', /כמה זמן העסק/],
  ['requirements', 'איך מנהלים את זה היום', /מנהלים|מנהלת/],
  ['requirements', 'תהליך הלקוח', /התהליך/],
  ['requirements', 'מי עוד צריך גישה', /גישה/],
  ['requirements', 'מי מעדכן תוכן', /מי [יתא]?עדכ/],
  ['requirements', 'מצב התוכן', /התוכן.*מוכן/],
  ['requirements', 'מערכת סליקה', /סליקה|מערכת תשלומים/],
  ['requirements', 'מועד השקה', /מתי ת/],
  ['requirements', 'תקציב', /תקציב/],
  ['requirements', 'עוד', /עוד משהו/],
];

const PROJECT_TYPE_KEYWORDS = [
  ['דף נחיתה', 'דף נחיתה'],
  ['CRM', 'CRM'],
  ['ניהול לקוחות', 'CRM'],
  ['אפליקציה', 'אפליקציה'],
  ['אתר', 'אתר'],
];

const norm = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

function projectTypeOf(answer) {
  const text = norm(answer);
  if (/לא בטוח/.test(text)) return '';
  const hit = PROJECT_TYPE_KEYWORDS.find(([keyword]) => text.includes(keyword));
  return hit ? hit[1] : '';
}

// Turns a saved questionnaire into project fields: each answer goes to the field it
// belongs to. Anything that matches no rule goes to "requirements", so nothing is lost.
export function buildProjectFields(record, type = 'business') {
  const answers = Array.isArray(record?.answers) ? record.answers.filter((a) => a?.answer) : [];

  if (type !== 'business') {
    const text = answersToText(answers);
    return { fields: text ? { requirements: text } : {} };
  }

  const groups = {};
  const add = (field, title, text) => {
    groups[field] = [...(groups[field] || []), { title, text }];
  };
  let projectType = '';

  answers.forEach((item) => {
    const question = norm(item.question);
    const answer = String(item.answer).trim();
    const rule = RULES.find(([, , pattern]) => pattern.test(question));

    if (!rule) {
      add('requirements', question, answer);
      return;
    }
    const [field, title] = rule;
    if (field === 'project_type') {
      const mapped = projectTypeOf(answer);
      if (mapped) projectType = mapped;
      else add('requirements', 'מה צריך', answer);
      return;
    }
    add(field, title, answer);
  });

  const fields = {};
  Object.entries(groups).forEach(([field, items]) => {
    fields[field] = items
      .map((entry) => (entry.title ? `${entry.title}: ${entry.text}` : entry.text))
      .join(field === 'business_name' || field === 'existing_site' || field === 'references' ? '\n' : '\n\n');
  });
  if (projectType) fields.project_type = projectType;

  return { fields };
}

// Merges imported fields into the editor draft without overwriting what is already
// there. Returns what was filled and what was left untouched.
export function mergeIntoDraft(draft, fields) {
  const updates = {};
  const filled = [];
  const skipped = [];

  Object.entries(fields).forEach(([key, value]) => {
    const current = draft[key];
    if (key === 'project_type') {
      if (current !== value) {
        updates[key] = value;
        filled.push(key);
      }
      return;
    }
    if (!current) {
      updates[key] = value;
      filled.push(key);
    } else if (!String(current).includes(value)) {
      skipped.push(key);
    }
  });

  return { updates, filled, skipped };
}
