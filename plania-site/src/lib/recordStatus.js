export const DEFAULT_STATUS = 'חדש';

export const STATUS_OPTIONS = ['חדש', 'יצרתי קשר', 'נשלח שאלון', 'נשלחה הצעת מחיר', 'הצעה אושרה', 'נסגרה עסקה', 'לא רלוונטי'];

export function getStatus(record) {
  return record?.status || DEFAULT_STATUS;
}

export function countNew(records, status = DEFAULT_STATUS) {
  return records.filter((record) => getStatus(record) === status).length;
}

export function sortNewFirst(records) {
  return [...records].sort((a, b) => {
    const aNew = getStatus(a) === DEFAULT_STATUS ? 0 : 1;
    const bNew = getStatus(b) === DEFAULT_STATUS ? 0 : 1;
    if (aNew !== bNew) return aNew - bNew;
    return new Date(b.created_date).getTime() - new Date(a.created_date).getTime();
  });
}