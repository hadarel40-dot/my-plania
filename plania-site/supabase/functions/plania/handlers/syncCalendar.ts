import { createClientFromRequest } from '../_shared/base44.ts';

// Admin-only: mirrors follow-up dates, project delivery dates and project tasks into the
// primary Google Calendar as all-day events. Every event has a fixed id built from the
// record id, so saving again updates the same event, and clearing a date removes it.

const CAL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const CLOSED_LEAD = ['נסגר', 'לא רלוונטי'];
const DONE_STAGES = ['הושלם', 'תחזוקה'];
const STALE_TASK_SLOTS = 12;

const cleanId = (value) => String(value).toLowerCase().replace(/[^a-v0-9]/g, '');

function addDays(date, days) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const dayOfWeek = (date) => new Date(`${date}T00:00:00Z`).getUTCDay();

// No tasks on Friday or Saturday: follow-ups and tasks move to Sunday
function toWorkday(date) {
  const dow = dayOfWeek(date);
  if (dow === 5) return addDays(date, 2);
  if (dow === 6) return addDays(date, 1);
  return date;
}

// A delivery deadline cannot move later, so it is reminded on the Thursday before
function toDeadlineReminder(date) {
  const dow = dayOfWeek(date);
  if (dow === 5) return addDays(date, -1);
  if (dow === 6) return addDays(date, -2);
  return date;
}

function shortDate(date) {
  const [, month, day] = date.split('-');
  return `${day}.${month}`;
}

function allDay(summary, date, description = '') {
  return {
    summary,
    description,
    start: { date },
    end: { date: addDays(date, 1) },
    transparency: 'transparent',
  };
}

async function upsert(token, id, event) {
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const body = JSON.stringify({ ...event, id, status: 'confirmed' });
  const updated = await fetch(`${CAL}/${id}`, { method: 'PUT', headers, body });
  if (updated.ok) return true;
  if (updated.status !== 404) throw new Error(`Google Calendar ${updated.status}`);
  const created = await fetch(CAL, { method: 'POST', headers, body });
  if (!created.ok) throw new Error(`Google Calendar ${created.status}`);
  return true;
}

async function remove(token, id) {
  const response = await fetch(`${CAL}/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok && response.status !== 404 && response.status !== 410) {
    throw new Error(`Google Calendar ${response.status}`);
  }
}

async function syncLead(token, lead) {
  const id = `lead${cleanId(lead.id)}`;
  const open = !CLOSED_LEAD.includes(lead.status || 'ליד חדש');
  if (lead.follow_up_date && open) {
    const note = [lead.phone, lead.message].filter(Boolean).join('\n');
    await upsert(token, id, allDay(`לחזור ל${lead.name}`, toWorkday(lead.follow_up_date), note));
    return { synced: 1, removed: 0 };
  }
  await remove(token, id);
  return { synced: 0, removed: 1 };
}

async function syncProject(token, project, { cleanStale }) {
  const pid = cleanId(project.id);
  let synced = 0;
  let removed = 0;

  const dueId = `pdue${pid}`;
  if (project.due_date && !DONE_STAGES.includes(project.stage)) {
    const reminder = toDeadlineReminder(project.due_date);
    const title =
      reminder === project.due_date
        ? `מסירה: ${project.name}`
        : `מסירה: ${project.name} (מועד המסירה ${shortDate(project.due_date)})`;
    await upsert(token, dueId, allDay(title, reminder, project.phone || ''));
    synced += 1;
  } else {
    await remove(token, dueId);
    removed += 1;
  }

  const tasks = Array.isArray(project.tasks) ? project.tasks : [];
  for (let i = 0; i < tasks.length; i += 1) {
    const task = tasks[i];
    const taskId = `ptask${pid}${i}`;
    if (task?.text && task.due && !task.done) {
      await upsert(token, taskId, allDay(`${task.text} · ${project.name}`, toWorkday(task.due)));
      synced += 1;
    } else {
      await remove(token, taskId);
      removed += 1;
    }
  }

  if (cleanStale) {
    const slots = Array.from({ length: STALE_TASK_SLOTS }, (_, k) => tasks.length + k);
    await Promise.all(slots.map((i) => remove(token, `ptask${pid}${i}`)));
  }
  return { synced, removed };
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    let token = '';
    try {
      token = await base44.asServiceRole.connectors.getAccessToken('googlecalendar');
    } catch {
      token = '';
    }
    if (!token) {
      return Response.json({ error: 'היומן עוד לא מחובר' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const totals = { synced: 0, removed: 0 };
    const add = (result) => {
      totals.synced += result.synced;
      totals.removed += result.removed;
    };

    if (body?.all) {
      const [leads, projects] = await Promise.all([
        base44.asServiceRole.entities.Lead.list('-created_date', 500),
        base44.asServiceRole.entities.ClientProject.list('-created_date', 500),
      ]);
      for (const lead of leads || []) {
        if (lead.follow_up_date) add(await syncLead(token, lead));
      }
      for (const project of projects || []) {
        add(await syncProject(token, project, { cleanStale: false }));
      }
      return Response.json({ success: true, ...totals });
    }

    const kind = body?.kind === 'project' ? 'project' : 'lead';
    const id = String(body?.id ?? '').trim();
    if (!id) {
      return Response.json({ error: 'חסר מזהה' }, { status: 400 });
    }

    if (body?.deleted) {
      if (kind === 'lead') {
        await remove(token, `lead${cleanId(id)}`);
      } else {
        const pid = cleanId(id);
        await remove(token, `pdue${pid}`);
        await Promise.all(Array.from({ length: 30 }, (_, i) => remove(token, `ptask${pid}${i}`)));
      }
      return Response.json({ success: true, synced: 0, removed: 1 });
    }

    if (kind === 'lead') {
      const lead = await base44.asServiceRole.entities.Lead.get(id);
      add(await syncLead(token, lead));
    } else {
      const project = await base44.asServiceRole.entities.ClientProject.get(id);
      add(await syncProject(token, project, { cleanStale: true }));
    }
    return Response.json({ success: true, ...totals });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
