import { createClientFromRequest } from '../_shared/base44.ts';
import { emailRow, emailLinkRow, emailShell } from '../_shared/notify.ts';

const NOTIFY_EMAIL = 'planiasmartplan@gmail.com';
const MAX_FILES = 20;
const MAX_TEXT = 5000;
const MAX_MATERIALS_PER_PROJECT = 300;
const MAX_PER_HOUR = 15;
const LINK_TTL_SECONDS = 604800;

// Public: the client sends text and files from a private link. The random token
// is the only credential. Everything is saved with the service role, so the
// client never gets write access to the entities themselves.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const token = String(body?.token ?? '').trim();
    const text = String(body?.text ?? '').trim().slice(0, MAX_TEXT);
    const requestedItem = String(body?.requested_item ?? '').trim().slice(0, 150);
    const rawFiles = Array.isArray(body?.files) ? body.files.slice(0, MAX_FILES) : [];

    if (token.length < 12) {
      return Response.json({ error: 'invalid' }, { status: 404 });
    }

    const files = rawFiles
      .map((file) => ({
        name: String(file?.name ?? '').slice(0, 200),
        uri: String(file?.uri ?? ''),
      }))
      .filter((file) => file.uri);

    if (!text && files.length === 0) {
      return Response.json({ error: 'empty' }, { status: 400 });
    }

    const matches = await base44.asServiceRole.entities.ClientProject.filter({ portal_token: token });
    const project = matches?.[0];
    if (!project || project.portal_enabled === false) {
      return Response.json({ error: 'invalid' }, { status: 404 });
    }

    const existing = await base44.asServiceRole.entities.ClientMaterial.filter(
      { project_id: project.id },
      '-created_date',
      MAX_MATERIALS_PER_PROJECT + 1
    );
    if ((existing?.length || 0) > MAX_MATERIALS_PER_PROJECT) {
      return Response.json({ error: 'limit' }, { status: 429 });
    }

    const hourAgo = Date.now() - 60 * 60 * 1000;
    const recent = (existing || []).filter((item) => new Date(item.created_date).getTime() > hourAgo);
    if (recent.length >= MAX_PER_HOUR) {
      return Response.json({ error: 'rate' }, { status: 429 });
    }

    await base44.asServiceRole.entities.ClientMaterial.create({
      project_id: project.id,
      text,
      files,
      requested_item: requestedItem,
      seen: false,
    });

    const patch: Record<string, unknown> = { last_material_at: new Date().toISOString() };
    if (requestedItem && Array.isArray(project.requested_items)) {
      patch.requested_items = project.requested_items.map((item) =>
        item.label === requestedItem ? { ...item, received: true } : item
      );
    }
    await base44.asServiceRole.entities.ClientProject.update(project.id, patch);

    try {
      const fileRows = [];
      for (const file of files) {
        let signedUrl = '';
        try {
          const result = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
            file_uri: file.uri,
            expires_in: LINK_TTL_SECONDS,
          });
          signedUrl = result?.signed_url || '';
        } catch {
          signedUrl = '';
        }
        fileRows.push(emailLinkRow('קובץ', file.name || 'קובץ מצורף', signedUrl));
      }
      const rows = [
        emailRow('לקוח', project.name),
        emailRow('פרויקט', project.business_name || project.project_type || ''),
        emailRow('שייך ל', requestedItem),
        emailRow('הודעה', text),
        emailRow('כמות קבצים', String(files.length)),
        ...fileRows,
        emailLinkRow('ניהול', 'פתיחת אזור הניהול', 'https://hadarelifergan.com/hp-manage-7k2x'),
      ].join('');
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: NOTIFY_EMAIL,
        subject: `חומרים חדשים מ${project.name}`,
        html: emailShell(`חומרים חדשים מ${project.name}`, rows),
      });
    } catch (mailError) {
      // המייל הוא תוספת בלבד, החומר כבר נשמר
      console.error('notify email failed', mailError?.message);
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
