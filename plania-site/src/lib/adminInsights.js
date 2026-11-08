import { waNumber } from '@/lib/phone';
import { formatDateTime, todayISO } from '@/lib/formatDate';
import { DEFAULT_LEAD_STATUS, isOpen, leadStatus, serviceMeta } from '@/lib/leadStatus';
import { DEFAULT_STATUS, getStatus } from '@/lib/recordStatus';

const DONE_STAGES = ['הושלם', 'תחזוקה'];
const HIDDEN_STATUS = 'לא רלוונטי';

const shekel = (value) => `₪${Number(value || 0).toLocaleString('he-IL')}`;

// One client is recognised by phone number (name when there is no phone)
export function clientKeyOf(record) {
  const phone = waNumber(record?.phone);
  if (phone) return phone;
  const name = String(record?.name || '').trim().toLowerCase();
  return name ? `name:${name}` : '';
}

export function matchesQuery(record, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  const text = [record.name, record.business_name, record.email].filter(Boolean).join(' ').toLowerCase();
  if (text.includes(q)) return true;
  const digits = q.replace(/\D/g, '');
  if (digits.length >= 3) {
    const raw = String(record.phone || '').replace(/\D/g, '');
    return raw.includes(digits) || waNumber(record.phone).includes(waNumber(digits));
  }
  return false;
}

export function balanceOf(project) {
  const paid = Number(project.deposit_paid || 0) + Number(project.balance_paid || 0);
  return Math.max(Number(project.price || 0) - paid, 0);
}

export function isProjectOverdue(project) {
  return Boolean(project.due_date) && project.due_date < todayISO() && !DONE_STAGES.includes(project.stage);
}

// One short line: what to do next on this project
export function projectNextStep(project, unseenCount = 0) {
  if (unseenCount > 0) return 'לעבור על החומרים החדשים שהלקוח שלח';
  const tasks = (project.tasks || []).filter((task) => !task.done);
  const dueTask = tasks
    .filter((task) => task.due && task.due <= todayISO())
    .sort((a, b) => String(a.due).localeCompare(String(b.due)))[0];
  if (dueTask) return `משימה שהגיע מועדה: ${dueTask.text}`;
  if (project.stage === 'ממתין לחומרים') return 'מחכה לחומרים מהלקוח';
  if (DONE_STAGES.includes(project.stage) && Number(project.price) > 0 && balanceOf(project) > 0) {
    return `לגבות יתרה ${shekel(balanceOf(project))}`;
  }
  if (tasks[0]) return `משימה: ${tasks[0].text}`;
  return '';
}

// Everything that needs attention right now, in order of importance
export function buildActionItems(data) {
  const today = todayISO();
  const items = [];
  const unseenByProject = {};
  data.materials.forEach((material) => {
    if (!material.seen) unseenByProject[material.project_id] = (unseenByProject[material.project_id] || 0) + 1;
  });
  const projectBySource = {};
  data.projects.forEach((project) => {
    if (project.source_id) projectBySource[project.source_id] = project;
  });

  const projectItem = (project, kind, tag, color, text) =>
    items.push({
      id: `${kind}-${project.id}`,
      tag,
      color,
      name: project.name,
      text,
      target: { type: 'project', record: project },
    });

  data.projects.forEach((project) => {
    const unseen = unseenByProject[project.id] || 0;
    if (unseen > 0) projectItem(project, 'materials', 'חומרים חדשים', '#5E1D1D', `${unseen} קבצים או הודעות מהלקוח`);
  });
  data.projects.forEach((project) => {
    if (isProjectOverdue(project)) projectItem(project, 'overdue', 'באיחור', '#c0392b', `המסירה הייתה ב־${project.due_date}`);
  });
  data.projects.forEach((project) => {
    const due = (project.tasks || []).filter((task) => !task.done && task.due && task.due <= today);
    if (due.length > 0) projectItem(project, 'tasks', 'משימה', '#8a5a2b', due.map((task) => task.text).join(' · '));
  });

  data.leads
    .filter((lead) => isOpen(lead) && leadStatus(lead) === DEFAULT_LEAD_STATUS)
    .forEach((lead) =>
      items.push({
        id: `lead-${lead.id}`,
        tag: 'ליד חדש',
        color: '#5E1D1D',
        name: lead.name,
        text: `${serviceMeta(lead.service).label} · ${formatDateTime(lead.created_date)}`,
        target: { type: 'client', record: lead },
      })
    );

  const questionnaires = [
    ...data.business.map((q) => ({ ...q, __type: 'business' })),
    ...data.travel.map((q) => ({ ...q, __type: 'travel' })),
  ].filter((q) => q.status !== HIDDEN_STATUS);

  const typeLabel = (q) => (q.__type === 'travel' ? 'טיולים' : 'עסקים');

  questionnaires
    .filter((q) => getStatus(q) === DEFAULT_STATUS)
    .forEach((q) =>
      items.push({
        id: `q-new-${q.id}`,
        tag: 'שאלון חדש',
        color: '#4A6355',
        name: q.name,
        text: `${typeLabel(q)} · ${formatDateTime(q.created_date)}`,
        target: { type: 'client', record: q },
      })
    );
  questionnaires
    .filter((q) => q.quote_approved_at && !projectBySource[q.id])
    .forEach((q) =>
      items.push({
        id: `q-approved-${q.id}`,
        tag: 'הצעה אושרה',
        color: '#4A6355',
        name: q.name,
        text: 'עוד אין פרויקט. אפשר לפתוח אחד',
        target: { type: 'client', record: q },
      })
    );
  questionnaires
    .filter((q) => q.quote_sent_at && !q.quote_approved_at)
    .forEach((q) =>
      items.push({
        id: `q-quote-${q.id}`,
        tag: 'מחכה לתשובה',
        color: '#8a8079',
        name: q.name,
        text: `הצעת מחיר נשלחה ב־${formatDateTime(q.quote_sent_at)}`,
        target: { type: 'client', record: q },
      })
    );

  data.projects.forEach((project) => {
    if (DONE_STAGES.includes(project.stage) && Number(project.price) > 0 && balanceOf(project) > 0) {
      projectItem(project, 'balance', 'יתרה לגבייה', '#8a5a2b', `נשאר לגבות ${shekel(balanceOf(project))}`);
    }
  });

  return items;
}
