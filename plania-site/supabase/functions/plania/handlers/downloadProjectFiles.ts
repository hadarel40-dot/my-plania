import { createClientFromRequest } from '../_shared/base44.ts';
import { signDownload } from '../_shared/downloadLink.ts';

const MAX_FILES = 300;
const LINK_TTL_SECONDS = 900;
const ENTITIES = { travel: 'TravelQuestionnaire', business: 'BusinessQuestionnaire' };

// Admin-only: counts the client's files for a project and hands back a signed,
// short-lived link that streams them all as one ZIP (built in downloadProjectZip).
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const projectId = String(body?.projectId ?? '').trim();
    if (!projectId) {
      return Response.json({ error: 'חסר מזהה פרויקט' }, { status: 400 });
    }

    const project = await base44.asServiceRole.entities.ClientProject
      .get(projectId)
      .catch((e) => (e.status === 404 ? null : Promise.reject(e)));
    if (!project) {
      return Response.json({ error: 'הפרויקט לא נמצא' }, { status: 404 });
    }
    if (!project.portal_token) {
      return Response.json({ error: 'אין קישור חומרים לפרויקט הזה' }, { status: 400 });
    }

    const materials = await base44.asServiceRole.entities.ClientMaterial.filter(
      { project_id: projectId },
      '-created_date',
      MAX_FILES
    );

    let count = 0;
    for (const material of materials || []) {
      count += (material.files || []).filter((file) => file?.uri).length;
    }

    const entity = ENTITIES[project.source_type];
    if (entity && project.source_id) {
      const questionnaire = await base44.asServiceRole.entities[entity]
        .get(project.source_id)
        .catch(() => null);
      count += (questionnaire?.files || []).filter((file) => file?.uri).length;
    }

    if (count === 0) {
      return Response.json({ error: 'אין קבצים להורדה בפרויקט הזה' }, { status: 400 });
    }

    const exp = Math.floor(Date.now() / 1000) + LINK_TTL_SECONDS;
    const sig = await signDownload(projectId, exp, project.portal_token);

    const origin = Deno.env.get('SUPABASE_URL')!;

    const url = `${origin.replace(/\/$/, '')}/functions/v1/plania/downloadProjectZip?p=${encodeURIComponent(projectId)}&e=${exp}&s=${sig}`;

    return Response.json({ success: true, url, count });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}