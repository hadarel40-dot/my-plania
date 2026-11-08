import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { findQuoteRecord, quoteType, QUOTE_ENTITIES } from '../../shared/quote.ts';
import { syncOnQuoteApproved } from '../../shared/leadSync.ts';

const ADMIN_EMAIL = 'planiasmartplan@gmail.com';

function shekel(value) {
  return `₪${Number(value).toLocaleString('he-IL')}`;
}

// Public: the client approves the quote from the emailed link. The random token
// is the only credential, and an already approved quote is never approved twice.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const type = quoteType(body?.type);
    const id = String(body?.id ?? '').trim();
    const token = String(body?.token ?? '').trim();
    const name = String(body?.name ?? '').trim().slice(0, 120);

    if (!name) {
      return Response.json({ error: 'missing_name' }, { status: 400 });
    }

    const record = await findQuoteRecord(base44, type, id, token);
    if (!record) {
      return Response.json({ error: 'invalid' }, { status: 404 });
    }

    if (record.quote_approved_at) {
      return Response.json({
        alreadyApproved: true,
        approved_at: record.quote_approved_at,
        approved_name: record.quote_approved_name || '',
      });
    }

    const approvedAt = new Date().toISOString();
    await base44.asServiceRole.entities[QUOTE_ENTITIES[type]].update(record.id, {
      quote_approved_at: approvedAt,
      quote_approved_name: name,
      status: 'הצעה אושרה',
    });

    await syncOnQuoteApproved(base44, record, type, name);

    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: ADMIN_EMAIL,
        subject: `${name} אישר/ה את הצעת המחיר`,
        body: [
          `${name} אישר/ה את הצעת המחיר.`,
          '',
          `שם הלקוח: ${record.name || ''}`,
          `מחיר: ${record.quote_price ? shekel(record.quote_price) : 'לא צוין'}`,
          `מקדמה: ${record.quote_deposit ? shekel(record.quote_deposit) : 'לא צוין'}`,
          `ההצעה נשלחה ב-${record.quote_sent_at || ''}`,
        ].join('\n'),
      });
    } catch {
      // המייל הוא תוספת בלבד – האישור כבר נשמר
    }

    return Response.json({ approved_at: approvedAt, approved_name: name });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}