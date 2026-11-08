export const PROJECT_TYPES = ['דף נחיתה', 'אתר', 'אפליקציה', 'CRM', 'אחר'];

export const PROJECT_STAGES = [
  'אפיון',
  'ממתין לחומרים',
  'בבנייה',
  'בבדיקה אצל הלקוח',
  'הושלם',
  'תחזוקה',
  'בהמתנה',
];

export const DEFAULT_STAGE = 'אפיון';

export const DEFAULT_REQUESTED_ITEMS = [
  'לוגו (קובץ מקורי אם יש)',
  'תמונות לאתר',
  'טקסטים ותכנים',
  'צבעים וגופנים',
  'דוגמאות לאתרים שאהבתם',
  'פרטי יצירת קשר להצגה באתר',
  'פרטי הדומיין (אם יש)',
];

export const DEFAULT_PORTAL_NOTE =
  'כאן אפשר להעלות כל חומר לפרויקט: קבצים, תמונות וטקסטים. אפשר לחזור לקישור הזה בכל זמן ולהוסיף עוד.';

// Short, clean private token (16 characters from a 31 letter alphabet, no look-alike characters).
const TOKEN_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

export function newPortalToken() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => TOKEN_ALPHABET[byte % TOKEN_ALPHABET.length]).join('');
}

// Always the real site address, never the long address of the editor preview.
export const SITE_ORIGIN = 'https://hadarelifergan.com';

export function portalLink(token) {
  return `${SITE_ORIGIN}/m/${token}`;
}

export function portalWhatsAppText(name, link) {
  return `היי ${name}, פתחתי לך מקום מסודר להעלאת כל החומרים לפרויקט: קבצים, תמונות וטקסטים. אפשר להוסיף בכל זמן.\n${link}`;
}

export function toBlankProject(overrides = {}) {
  return {
    name: '',
    stage: DEFAULT_STAGE,
    project_type: 'אתר',
    requested_items: DEFAULT_REQUESTED_ITEMS.map((label) => ({ label, received: false })),
    tasks: [],
    log: [],
    portal_token: newPortalToken(),
    portal_enabled: true,
    portal_note: DEFAULT_PORTAL_NOTE,
    ...overrides,
  };
}

export function answersToText(answers) {
  return (Array.isArray(answers) ? answers : [])
    .filter((item) => item?.answer)
    .map((item) => `${item.section ? `${item.section} · ` : ''}${item.question}\n${item.answer}`)
    .join('\n\n');
}
