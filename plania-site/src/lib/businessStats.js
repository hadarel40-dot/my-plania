import { closedAt, leadStatus } from '@/lib/leadStatus';
import { balanceOf, isProjectOverdue } from '@/lib/adminInsights';
import { DEFAULT_STATUS, getStatus } from '@/lib/recordStatus';
import { todayISO } from '@/lib/formatDate';

const WON = ['נסגר', 'לקוח פעיל'];
const PIPELINE = ['ליד חדש', 'בשיחה', 'הצעת מחיר נשלחה'];
const LOST = 'לא רלוונטי';
const DONE_STAGES = ['הושלם', 'תחזוקה'];
const MONTHS = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'];

export const shekel = (value) => `₪${Math.round(Number(value) || 0).toLocaleString('he-IL')}`;

const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

// The business at a glance: money, pipeline, projects and open paperwork.
export function buildBusinessStats(data = {}) {
  const leads = data.leads || [];
  const projects = data.projects || [];
  const questionnaires = [
    ...(data.travel || []).map((record) => ({ ...record, __type: 'travel' })),
    ...(data.business || []).map((record) => ({ ...record, __type: 'business' })),
  ];

  const now = new Date();
  const thisMonth = monthKey(now);
  const lastMonth = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const today = todayISO();
  const weekAhead = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10);

  const statusOf = (lead) => leadStatus(lead);
  const valueOf = (lead) => Number(lead.deal_value) || 0;
  const sum = (list) => list.reduce((total, lead) => total + valueOf(lead), 0);

  const pipeline = leads.filter((lead) => PIPELINE.includes(statusOf(lead)));
  const won = leads.filter((lead) => WON.includes(statusOf(lead)));
  const lost = leads.filter((lead) => statusOf(lead) === LOST);
  const wonIn = (key) => won.filter((lead) => String(closedAt(lead)).slice(0, 7) === key);

  const months = [];
  for (let i = 5; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(date);
    const deals = wonIn(key);
    months.push({ key, label: MONTHS[date.getMonth()], value: sum(deals), count: deals.length });
  }

  const activeProjects = projects.filter((project) => !DONE_STAGES.includes(project.stage));

  const funnel = ['ליד חדש', 'בשיחה', 'הצעת מחיר נשלחה', 'נסגר', 'לקוח פעיל'].map((status) => {
    const list = leads.filter((lead) => statusOf(lead) === status);
    return { status, count: list.length, value: sum(list) };
  });

  return {
    leadsThisMonth: leads.filter((lead) => String(lead.created_date).slice(0, 7) === thisMonth).length,
    leadsLastMonth: leads.filter((lead) => String(lead.created_date).slice(0, 7) === lastMonth).length,
    pipelineCount: pipeline.length,
    pipelineValue: sum(pipeline),
    wonThisMonth: wonIn(thisMonth).length,
    incomeThisMonth: sum(wonIn(thisMonth)),
    incomeLastMonth: sum(wonIn(lastMonth)),
    winRate:
      won.length + lost.length > 0
        ? Math.round((won.length / (won.length + lost.length)) * 100)
        : 0,
    activeProjects: activeProjects.length,
    dueSoon: activeProjects.filter(
      (project) => project.due_date && project.due_date >= today && project.due_date <= weekAhead
    ).length,
    overdue: projects.filter(isProjectOverdue).length,
    receivables: projects.reduce((total, project) => total + balanceOf(project), 0),
    questionnairesNew: questionnaires.filter((record) => getStatus(record) === DEFAULT_STATUS).length,
    quotesWaiting: questionnaires.filter((record) => record.quote_sent_at && !record.quote_approved_at).length,
    funnel,
    months,
  };
}