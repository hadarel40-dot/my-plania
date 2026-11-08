import { createClientFromRequest } from '../_shared/base44.ts';

// Public: the client opens the materials page from a private link. The random
// token is the only credential, and only non-sensitive project fields are returned.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const token = String(body?.token ?? '').trim();
    if (token.length < 12) {
      return Response.json({ project: null });
    }

    const matches = await base44.asServiceRole.entities.ClientProject.filter({ portal_token: token });
    const project = matches?.[0];
    if (!project || project.portal_enabled === false) {
      return Response.json({ project: null });
    }

    const materials = await base44.asServiceRole.entities.ClientMaterial.filter(
      { project_id: project.id },
      '-created_date',
      100
    );

    return Response.json({
      project: {
        name: project.name || '',
        business_name: project.business_name || '',
        project_type: project.project_type || '',
        stage: project.stage || '',
        portal_note: project.portal_note || '',
        requested_items: (project.requested_items || []).map((item) => ({
          label: item.label || '',
          received: !!item.received,
        })),
      },
      submissions: (materials || []).map((item) => ({
        at: item.created_date,
        text: String(item.text || '').slice(0, 400),
        files: (item.files || []).map((file) => file.name),
        requested_item: item.requested_item || '',
      })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
