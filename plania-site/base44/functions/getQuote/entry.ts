import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { findQuoteRecord, quoteType } from '../../shared/quote.ts';

// Public: the client opens this from the email link. Access is granted only by
// the random token stored on the record, and only the quote fields are returned.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const type = quoteType(body?.type);
    const id = String(body?.id ?? '').trim();
    const token = String(body?.token ?? '').trim();

    const record = await findQuoteRecord(base44, type, id, token);
    if (!record) {
      return Response.json({ quote: null });
    }

    return Response.json({
      quote: {
        name: record.name || '',
        price: record.quote_price ?? null,
        deposit: record.quote_deposit ?? null,
        delivery: record.quote_delivery || '',
        brief: record.quote_brief || '',
        payment_url: record.quote_payment_url || '',
        sent_at: record.quote_sent_at || '',
        approved_at: record.quote_approved_at || '',
        approved_name: record.quote_approved_name || '',
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}