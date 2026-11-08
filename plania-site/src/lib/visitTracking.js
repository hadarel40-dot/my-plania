import { rememberAttribution, sourceName } from '@/lib/attribution';

const SESSION_KEY = 'plania_visit_id';

export const PATH_LABELS = {
  '/': 'דף הבית',
  '/plania': 'פלאניה',
  '/travel': 'טיולים',
  '/business': 'עסקים',
  '/privacy': 'מדיניות פרטיות',
  '/terms': 'תקנון',
  '/accessibility': 'נגישות',
  '/q/travel': 'שאלון טיול',
  '/q/business': 'שאלון עסק',
};

export function pathLabel(path) {
  if (PATH_LABELS[path]) return PATH_LABELS[path];
  if (path?.startsWith('/quote')) return 'הצעת מחיר';
  if (path?.startsWith('/m/') || path?.startsWith('/materials/')) return 'העלאת חומרים';
  return path || 'לא ידוע';
}

const SOURCE_LABELS = [
  ['instagram', 'אינסטגרם'],
  ['facebook', 'פייסבוק'],
  ['fb.', 'פייסבוק'],
  ['whatsapp', 'וואטסאפ'],
  ['wa.me', 'וואטסאפ'],
  ['google', 'גוגל'],
  ['bing', 'בינג'],
  ['linkedin', 'לינקדאין'],
  ['tiktok', 'טיקטוק'],
  ['youtube', 'יוטיוב'],
  ['waze', 'ווייז'],
];

export function sourceLabel(referrer) {
  if (!referrer) return 'כניסה ישירה';
  const host = String(referrer).toLowerCase();
  const hit = SOURCE_LABELS.find(([needle]) => host.includes(needle));
  return hit ? hit[1] : host;
}

// A visit's source: the tracked one when we have it, otherwise the referring site
export function visitSourceLabel(row) {
  return row?.source ? sourceName(row.source) : sourceLabel(row?.referrer);
}

function newId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `v-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function hostOf(url) {
  if (!url) return '';
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host && host !== window.location.hostname ? host : '';
  } catch {
    return '';
  }
}

// Builds one visit record for the current page. The first page of a session is the
// entry page, and only then do we keep the referrer (where the visitor came from).
export function buildVisit(path) {
  try {
    let sessionId = sessionStorage.getItem(SESSION_KEY);
    const isEntry = !sessionId;
    if (!sessionId) sessionId = newId();
    sessionStorage.setItem(SESSION_KEY, sessionId);
    const found = isEntry ? rememberAttribution() : null;

    return {
      path,
      session_id: sessionId,
      is_entry: isEntry,
      referrer: isEntry ? hostOf(document.referrer) : '',
      source: found?.source || '',
      campaign: found?.campaign || '',
      device: window.matchMedia('(max-width: 767px)').matches ? 'mobile' : 'desktop',
    };
  } catch {
    return null;
  }
}