import { createClientFromRequest } from '../_shared/base44.ts';
import { emailRow, emailShell } from '../_shared/notify.ts';

const NOTIFY_EMAIL = 'planiasmartplan@gmail.com';
const SERVICE_LABELS = { travel: 'טיולים', business: 'לעסקים' };

export default async function (req) {
  try {
    const body = await req.json();
    const name = String(body?.name ?? '').trim();
    const phone = String(body?.phone ?? '').trim();
    const message = String(body?.message ?? '').trim();
    const service = body?.service === 'business' ? 'business' : 'travel';

    if (!name || !phone) {
      return Response.json({ error: 'נא למלא שם וטלפון' }, { status: 400 });
    }
    if (name.length > 120 || phone.length > 40 || message.length > 2000) {
      return Response.json({ error: 'התוכן ארוך מדי' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);
    const label = SERVICE_LABELS[service];
    const rows = [
      emailRow('שם מלא', name),
      emailRow('טלפון', phone),
      emailRow('שירות', label),
      emailRow('במה אפשר לעזור', message),
    ].join('');

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: NOTIFY_EMAIL,
      subject: `ליד חדש – ${label}`,
      html: emailShell(`ליד חדש – ${label}`, rows),
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}