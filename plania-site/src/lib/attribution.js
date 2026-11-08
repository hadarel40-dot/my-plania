// Where did this visitor come from? Read from the tracking link (utm_source), the app they
// opened the link in (Instagram's own browser says so), or the referring site.
const KEY = 'plania_attribution';
const MAX_AGE_MS = 30 * 86400000;

export const SOURCE_NAMES = {
  instagram: 'אינסטגרם',
  facebook: 'פייסבוק',
  whatsapp: 'וואטסאפ',
  google: 'גוגל',
  bing: 'בינג',
  linkedin: 'לינקדאין',
  tiktok: 'טיקטוק',
  youtube: 'יוטיוב',
  waze: 'ווייז',
};

const UTM_ALIASES = {
  ig: 'instagram',
  instagram: 'instagram',
  fb: 'facebook',
  facebook: 'facebook',
  wa: 'whatsapp',
  whatsapp: 'whatsapp',
  google: 'google',
  tiktok: 'tiktok',
  linkedin: 'linkedin',
  youtube: 'youtube',
};

const HOST_HINTS = [
  ['instagram', 'instagram'],
  ['facebook', 'facebook'],
  ['fb.', 'facebook'],
  ['whatsapp', 'whatsapp'],
  ['wa.me', 'whatsapp'],
  ['google', 'google'],
  ['bing', 'bing'],
  ['linkedin', 'linkedin'],
  ['tiktok', 'tiktok'],
  ['youtube', 'youtube'],
  ['waze', 'waze'],
];

function keyFromText(text) {
  const value = String(text || '').toLowerCase();
  if (!value) return '';
  const hit = HOST_HINTS.find(([needle]) => value.includes(needle));
  return hit ? hit[1] : '';
}

export function sourceName(key) {
  return SOURCE_NAMES[key] || key || 'כניסה ישירה';
}

export function detectSource() {
  try {
    const params = new URLSearchParams(window.location.search);
    const utm = String(params.get('utm_source') || '').toLowerCase().trim();
    const campaign = String(params.get('utm_content') || params.get('utm_campaign') || '').trim().slice(0, 60);

    let source = UTM_ALIASES[utm] || keyFromText(utm) || utm.slice(0, 30);

    if (!source) {
      const agent = navigator.userAgent || '';
      if (/Instagram/i.test(agent)) source = 'instagram';
      else if (/FBAN|FBAV/i.test(agent)) source = 'facebook';
    }

    if (!source) {
      const ref = document.referrer || '';
      if (ref && !ref.includes(window.location.hostname)) source = keyFromText(ref);
    }

    return source ? { source, campaign } : null;
  } catch {
    return null;
  }
}

// The last known source is kept for 30 days, so a lead who comes back later still counts.
export function rememberAttribution() {
  const found = detectSource();
  if (!found) return null;
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...found, at: Date.now() }));
  } catch {
    // אין אחסון בדפדפן, ממשיכים בלי לזכור
  }
  return found;
}

export function getAttribution() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && Date.now() - raw.at < MAX_AGE_MS) {
      return { source: raw.source || '', campaign: raw.campaign || '' };
    }
  } catch {
    // ממשיכים בלי מקור
  }
  const found = detectSource();
  return found || { source: '', campaign: '' };
}
