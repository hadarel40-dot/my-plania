export const QUOTE_ENTITIES = {
  travel: 'TravelQuestionnaire',
  business: 'BusinessQuestionnaire',
};

export function quoteType(value) {
  return value === 'business' ? 'business' : 'travel';
}

// Returns the questionnaire record only when the supplied token matches the
// one stored on it. Any failure (missing record, wrong token) returns null so
// the caller can answer with a single generic message.
export async function findQuoteRecord(base44, type, id, token) {
  if (!id || !token) return null;
  try {
    const record = await base44.asServiceRole.entities[QUOTE_ENTITIES[type]].get(id);
    if (!record || !record.quote_token || record.quote_token !== token) return null;
    return record;
  } catch {
    return null;
  }
}