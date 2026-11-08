import { createClientFromRequest } from '../_shared/base44.ts';
import { syncOnQuoteSent } from '../_shared/leadSync.ts';

const ADMIN_EMAIL = 'planiasmartplan@gmail.com';
const WHATSAPP_URL = `https://wa.me/972539306048?text=${encodeURIComponent('אני מאשר/ת את הצעת המחיר')}`;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ENTITIES = { travel: 'TravelQuestionnaire', business: 'BusinessQuestionnaire' };
const SITE_URL = 'https://hadarelifergan.com';

function shekel(value) {
  return `₪${Number(value).toLocaleString('he-IL')}`;
}

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
    const clientName = String(body?.name ?? '').trim().slice(0, 120);
    const email = String(body?.email ?? '').trim();
    const price = Number(body?.price);
    const deposit = Number(body?.deposit);
    const delivery = String(body?.delivery ?? '').trim().slice(0, 200);
    const brief = String(body?.brief ?? '').trim().slice(0, 5000);
    const paymentUrl = String(body?.paymentUrl ?? '').trim().slice(0, 500);

    if (!recordId) {
      return Response.json({ error: 'חסר מזהה שאלון' }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return Response.json({ error: 'כתובת מייל לא תקינה' }, { status: 400 });
    }
    if (!Number.isFinite(price) || price <= 0) {
      return Response.json({ error: 'נא להקליד מחיר' }, { status: 400 });
    }
    if (!brief) {
      return Response.json({ error: 'נא לכתוב בריף' }, { status: 400 });
    }
    if (paymentUrl && !paymentUrl.startsWith('https://')) {
      return Response.json({ error: 'קישור התשלום צריך להתחיל ב-https://' }, { status: 400 });
    }

    const hasDeposit = Number.isFinite(deposit) && deposit > 0;
    const token = crypto.randomUUID();
    const variables = {
      client_name: clientName || 'שלום',
      price: shekel(price),
      deposit: hasDeposit ? shekel(deposit) : 'לא צוין',
      delivery: delivery || 'לא צוין',
      brief,
      quote_url: `${SITE_URL}/quote/${type}/${recordId}?t=${token}`,
      whatsapp_url: WHATSAPP_URL,
    };

    // A quote that replaces an earlier one is marked as updated in the email subject.
    let previous = null;
    try {
      previous = await base44.asServiceRole.entities[ENTITIES[type]].get(recordId);
    } catch {
      previous = null;
    }
    const isUpdate = Boolean(previous?.quote_sent_at);

    // Save first, so the link in the email always matches what is stored.
    // Empty values are '' / 0 rather than null, which the schema rejects.
    const patch = {
      quote_price: price,
      quote_deposit: hasDeposit ? deposit : 0,
      quote_delivery: delivery,
      quote_brief: brief,
      quote_sent_at: new Date().toISOString(),
      quote_token: token,
      quote_payment_url: paymentUrl,
      quote_approved_at: '',
      quote_approved_name: '',
      status: 'נשלחה הצעת מחיר',
    };
    await base44.asServiceRole.entities[ENTITIES[type]].update(recordId, patch);

    // The lead and the project follow the new quote, even if the email fails below.
    const synced = await syncOnQuoteSent(base44, { id: recordId, phone: previous?.phone }, type, patch);

    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: email,
        template_name: 'PriceQuote',
        ...(isUpdate ? { subject: 'הצעת מחיר מעודכנת מ-Plania’s' } : {}),
        variables,
      });
    } catch (error) {
      return Response.json(
        { error: `ההצעה נשמרה אבל המייל ללקוח לא נשלח: ${error.message}`, patch, synced },
        { status: 502 }
      );
    }

    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: ADMIN_EMAIL,
        template_name: 'PriceQuote',
        subject: `עותק: הצעת מחיר נשלחה אל ${clientName || email}`,
        variables,
      });
    } catch {
      // העותק אליי הוא תוספת בלבד – ההצעה כבר נשלחה ללקוח
    }

    return Response.json({ success: true, patch, synced });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}