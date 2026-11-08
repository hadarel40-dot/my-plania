export const LEAD_STATUSES = ['ליד חדש', 'בשיחה', 'הצעת מחיר נשלחה', 'נסגר', 'לקוח פעיל', 'לא רלוונטי'];

export const DEFAULT_LEAD_STATUS = 'ליד חדש';

export const CLOSED_STATUSES = ['נסגר', 'לא רלוונטי'];

export const SERVICE_KEYS = ['travel', 'business', 'plania'];

const SERVICE_META = {
  travel: { label: 'טיולים', color: '#B8838B' },
  business: { label: 'עסקים', color: '#5C1D1F' },
  plania: { label: 'Plania', color: '#4A6355' },
};

export function serviceMeta(key) {
  return SERVICE_META[key] || { label: key || '—', color: '#8a8079' };
}

export function leadStatus(lead) {
  return lead?.status || DEFAULT_LEAD_STATUS;
}

export function isOpen(lead) {
  return !CLOSED_STATUSES.includes(leadStatus(lead));
}

export function closedAt(lead) {
  const history = Array.isArray(lead.history) ? lead.history : [];
  const entry = [...history]
    .reverse()
    .find((item) => item.kind === 'status' && String(item.text).includes('נסגר'));
  return entry?.at || lead.updated_date || lead.created_date || '';
}

export function appendHistory(history, entry) {
  return [...(Array.isArray(history) ? history : []), { at: new Date().toISOString(), ...entry }];
}