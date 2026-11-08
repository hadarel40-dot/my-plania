import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { emailRow, emailLinkRow, emailShell } from '../../shared/notify.ts';

const NOTIFY_EMAIL = 'planiasmartplan@gmail.com';
const MAX_FILES = 10;
const LINK_TTL_SECONDS = 604800;

export default async function (req) {
  try {
    const body = await req.json();
    const type = body?.type === 'business' ? 'business' : 'travel';
    const name = String(body?.name ?? '').trim();
    const phone = String(body?.phone ?? '').trim();
    const email = String(body?.email ?? '').trim();
    const rawAnswers = Array.isArray(body?.answers) ? body.answers : [];
    const rawFiles = Array.isArray(body?.files) ? body.files.slice(0, MAX_FILES) : [];

    if (!name) {
      return Response.json({ error: 'חסר שם' }, { status: 400 });
    }
    if (rawAnswers.length > 200) {
      return Response.json({ error: 'יותר מדי תשובות' }, { status: 400 });
    }

    const answers = rawAnswers.map((item) => ({
      section: String(item?.section ?? '').slice(0, 200),
      question: String(item?.question ?? '').slice(0, 300),
      answer: String(item?.answer ?? '').slice(0, 2000),
    }));

    const base44 = createClientFromRequest(req);

    const fileRows = [];
    for (const file of rawFiles) {
      const fileName = String(file?.name ?? '').slice(0, 200);
      const fileUri = String(file?.uri ?? '');
      if (!fileUri) continue;
      let signedUrl = '';
      try {
        const result = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
          file_uri: fileUri,
          expires_in: LINK_TTL_SECONDS,
        });
        signedUrl = result?.signed_url || '';
      } catch {
        signedUrl = '';
      }
      fileRows.push(emailLinkRow(fileName || 'קובץ מצורף', fileName || 'קובץ מצורף', signedUrl));
    }

    const rows = [
      emailRow('שם מלא', name),
      emailRow('טלפון', phone),
      emailRow('מייל', email),
      ...answers.map((item) =>
        emailRow(item.section ? `${item.section} · ${item.question}` : item.question, item.answer)
      ),
      ...fileRows,
    ].join('');

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: NOTIFY_EMAIL,
      subject: `שאלון חדש – ${name}`,
      html: emailShell(`שאלון חדש – ${name}`, rows),
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}