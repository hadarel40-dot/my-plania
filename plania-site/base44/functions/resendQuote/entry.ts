import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const ADMIN_EMAIL = 'planiasmartplan@gmail.com';
const WHATSAPP_URL = `https://wa.me/972539306048?text=${encodeURIComponent('אני מאשר/ת את הצעת המחיר')}`;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ENTITIES = { travel: 'TravelQuestionnaire', business: 'BusinessQuestionnaire' };
const SITE_URL = 'https://hadarelifergan.com';

function shekel(value) {
  return `₪${Number(value).toLocaleString('he-IL')}`;
}

// Admin only. Sends the already saved quote again, with the SAME token, so the
// link in the earlier email keeps working and an approval already given is kept.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const type = body?.type === 'business' ? 'business' : 'travel';
    const recordId = String(body?.recordId ?? '').trim();
    const email = String(body?.email ?? '').trim();

    if (!recordId) {
      return Response.json({ error: 'חסר מזהה שאלון' }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return Response.json({ error: 'כתובת מייל לא תקינה' }, { status: 400 });
    }

    const record = await base44.asServiceRole.entities[ENTITIES[type]].get(recordId);
    if (!record || !record.quote_sent_at || !record.quote_token || !record.quote_price) {
      return Response.json({ error: 'לא נמצאה הצעת מחיר שנשלחה' }, { status: 404 });
    }

    const deposit = Number(record.quote_deposit);
    const variables = {
      client_name: record.name || 'שלום',
      price: shekel(record.quote_price),
      deposit: Number.isFinite(deposit) && deposit > 0 ? shekel(deposit) : 'לא צוין',
      delivery: record.quote_delivery || 'לא צוין',
      brief: record.quote_brief || '',
      quote_url: `${SITE_URL}/quote/${type}/${record.id}?t=${record.quote_token}`,
      whatsapp_url: WHATSAPP_URL,
    };

    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: email,
        template_name: 'PriceQuote',
        subject: 'הצעת המחיר שלך מ-Plania’s (שליחה חוזרת)',
        variables,
      });
    } catch (error) {
      return Response.json({ error: `המייל ללקוח לא נשלח: ${error.message}` }, { status: 502 });
    }

    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: ADMIN_EMAIL,
        template_name: 'PriceQuote',
        subject: `עותק: הצעת המחיר נשלחה שוב אל ${record.name || email}`,
        variables,
      });
    } catch (mailError) {
      console.error('admin copy failed', mailError?.message);
    }

    return Response.json({ success: true, sent_to: email });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
