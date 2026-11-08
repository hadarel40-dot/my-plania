import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ProjectEditor from './ProjectEditor';
import PhoneActions from './PhoneActions';
import DeleteButton from './DeleteButton';
import { useAdminActions } from './AdminActions';
import { balanceOf, projectNextStep } from '@/lib/adminInsights';
import { PROJECT_STAGES, portalLink, toBlankProject } from '@/lib/projects';
import { buildProjectFields } from '@/lib/questionnaireImport';
import { formatDateOnly, formatDateTime, todayISO } from '@/lib/formatDate';
import { Download, RefreshCw } from 'lucide-react';

const BLANK = '__blank';
const DONE_STAGES = ['הושלם', 'תחזוקה'];

const isOverdue = (project) =>
  Boolean(project.due_date) && project.due_date < todayISO() && !DONE_STAGES.includes(project.stage);

function csvCell(value) {
  const text = String(value ?? '').replace(/"/g, '""');
  return `"${text}"`;
}

function exportCsv(projects) {
  const header = [
    'לקוח', 'עסק', 'טלפון', 'מייל', 'סוג', 'שלב', 'תאריך התחלה', 'תאריך מסירה',
    'מחיר', 'מקדמה ששולמה', 'יתרה ששולמה', 'נשאר לגבות', 'חומרים שהתקבלו', 'משימות פתוחות',
  ];
  const rows = projects.map((p) => {
    const paid = Number(p.deposit_paid || 0) + Number(p.balance_paid || 0);
    const items = p.requested_items || [];
    return [
      p.name, p.business_name, p.phone, p.email, p.project_type, p.stage,
      p.start_date, p.due_date, p.price ?? '', p.deposit_paid ?? '', p.balance_paid ?? '',
      Math.max(Number(p.price || 0) - paid, 0),
      `${items.filter((i) => i.received).length}/${items.length}`,
      (p.tasks || []).filter((t) => !t.done).length,
    ];
  });
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `פרויקטים ${todayISO()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function ProjectRow({ project, materials, questionnaire, openRequest, onUpdate, onDelete, onMarkSeen }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const unseen = materials.filter((m) => !m.seen).length;
  const items = project.requested_items || [];
  const tasks = project.tasks || [];
  const receivedCount = items.filter((i) => i.received).length;
  const openTasks = tasks.filter((t) => !t.done).length;
  const overdue = isOverdue(project);
  const { openClient } = useAdminActions();
  const nextStep = projectNextStep(project, unseen);
  const remaining = balanceOf(project);

  useEffect(() => {
    if (openRequest && openRequest.id === project.id) setOpen(true);
  }, [openRequest, project.id]);

  const copyLink = async () => {
    await navigator.clipboard.writeText(portalLink(project.portal_token));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const metaParts = [
    project.project_type,
    project.due_date ? `מסירה ${formatDateOnly(project.due_date)}` : '',
    items.length ? `חומרים ${receivedCount}/${items.length}` : '',
    openTasks ? `${openTasks} משימות פתוחות` : '',
    project.last_material_at ? `חומר אחרון ${formatDateTime(project.last_material_at)}` : '',
  ].filter(Boolean);

  return (
    <div className="bg-[#faf6f1] border-r-4 px-4 py-3" style={{ borderRightColor: '#5E1D1D' }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-heading text-lg text-[#2a2622]">{project.name}</p>
            {unseen > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full text-white bg-[#5E1D1D]">
                {unseen} חומרים חדשים
              </span>
            )}
            {overdue && (
              <span className="text-[10px] px-2 py-0.5 rounded-full text-white bg-[#c0392b]">באיחור</span>
            )}
          </div>
          {project.business_name && <p className="text-xs text-[#2a2622]">{project.business_name}</p>}
          {(nextStep || (Number(project.price) > 0 && remaining > 0)) && (
            <p className="text-xs mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
              {nextStep && <span className="font-bold text-[#5E1D1D]">הצעד הבא: {nextStep}</span>}
              {Number(project.price) > 0 && remaining > 0 && (
                <span className="text-[#6a6158]">נשאר לגבות ₪{remaining.toLocaleString('he-IL')}</span>
              )}
            </p>
          )}
          <p className="text-xs text-[#6a6158]">{metaParts.join(' · ')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={project.stage || undefined} onValueChange={(value) => onUpdate({ stage: value })}>
            <SelectTrigger className="h-8 w-[150px] text-xs bg-white border-[#d9cfc2] text-[#2a2622]">
              <SelectValue placeholder="שלב" />
            </SelectTrigger>
            <SelectContent dir="rtl">
              {PROJECT_STAGES.map((stage) => (
                <SelectItem key={stage} value={stage} className="text-xs">{stage}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <PhoneActions phone={project.phone} name={project.name} />
          <Button size="sm" variant="outline" className="text-xs" onClick={copyLink}>
            {copied ? 'הועתק' : 'קישור להעלאת חומרים'}
          </Button>
          <Button size="sm" variant="outline" className="text-xs" onClick={() => openClient(project)}>
            כרטיס לקוח
          </Button>
          <Button size="sm" className="text-xs bg-[#5E1D1D] hover:bg-[#4a1717] text-white" onClick={() => setOpen(true)}>
            פתיחת הפרויקט
          </Button>
          <DeleteButton name={project.name} what="הפרויקט" onDelete={onDelete} />
        </div>
      </div>

      <ProjectEditor
        project={project}
        materials={materials}
        questionnaire={questionnaire}
        open={open}
        onOpenChange={setOpen}
        onUpdate={onUpdate}
        onMarkSeen={onMarkSeen}
      />
    </div>
  );
}

export default function ProjectsTab({
  projects,
  materials,
  questionnaires,
  openRequest,
  lastRefreshed,
  refreshing,
  onRefresh,
  onCreate,
  onUpdate,
  onDelete,
  onMarkSeen,
  compact = false,
}) {
  const [source, setSource] = useState(BLANK);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [stageFilter, setStageFilter] = useState('all');
  const [showDone, setShowDone] = useState(false);
  const doneCount = projects.filter((p) => p.stage === 'הושלם').length;

  const materialsByProject = useMemo(() => {
    const map = {};
    materials.forEach((m) => {
      map[m.project_id] = [...(map[m.project_id] || []), m];
    });
    return map;
  }, [materials]);

  const questionnaireById = useMemo(() => {
    const map = {};
    questionnaires.forEach((q) => {
      map[q.id] = q;
    });
    return map;
  }, [questionnaires]);

  const stageCounts = useMemo(() => {
    const counts = {};
    projects.forEach((p) => {
      const stage = p.stage || 'ללא שלב';
      counts[stage] = (counts[stage] || 0) + 1;
    });
    return counts;
  }, [projects]);

  const attention = useMemo(() => {
    const unseen = projects.filter((p) => (materialsByProject[p.id] || []).some((m) => !m.seen)).length;
    const overdue = projects.filter(isOverdue).length;
    const dueTasks = projects.reduce(
      (sum, p) => sum + (p.tasks || []).filter((t) => !t.done && t.due && t.due <= todayISO()).length,
      0
    );
    return { unseen, overdue, dueTasks };
  }, [projects, materialsByProject]);

  const visible = useMemo(() => {
    const list =
      stageFilter === 'all'
        ? projects.filter((p) => showDone || compact || p.stage !== 'הושלם')
        : projects.filter((p) => (p.stage || 'ללא שלב') === stageFilter);
    const rank = (p) => {
      const unseen = (materialsByProject[p.id] || []).some((m) => !m.seen) ? 0 : 1;
      return [unseen, isOverdue(p) ? 0 : 1, p.due_date || '9999-12-31'];
    };
    return [...list].sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      return ra[0] - rb[0] || ra[1] - rb[1] || ra[2].localeCompare(rb[2]);
    });
  }, [projects, stageFilter, materialsByProject, showDone, compact]);

  const chosen = source === BLANK ? null : questionnaireById[source];

  const create = async () => {
    const projectName = (chosen?.name || name).trim();
    if (!projectName) return;
    setCreating(true);
    try {
      await onCreate(
        toBlankProject({
          name: projectName,
          phone: chosen?.phone || '',
          email: chosen?.email || '',
          source_type: chosen ? chosen.__type : '',
          source_id: chosen ? chosen.id : '',
          price: chosen?.quote_price ?? undefined,
          ...(chosen?.__type === 'travel' ? { project_type: 'אחר', requested_items: [] } : {}),
          ...(chosen ? buildProjectFields(chosen, chosen.__type).fields : {}),
        })
      );
      setName('');
      setSource(BLANK);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-3">
      {!compact && (attention.unseen > 0 || attention.overdue > 0 || attention.dueTasks > 0) && (
        <div className="bg-[#f3e7e1] border border-[#e3cfc6] px-4 py-3 text-sm text-[#2a2622]">
          <p className="font-heading text-base mb-1">דורש טיפול</p>
          <ul className="text-xs text-[#6a6158] space-y-0.5">
            {attention.unseen > 0 && <li>{attention.unseen} פרויקטים עם חומרים חדשים מהלקוח</li>}
            {attention.overdue > 0 && <li>{attention.overdue} פרויקטים שעבר תאריך המסירה שלהם</li>}
            {attention.dueTasks > 0 && <li>{attention.dueTasks} משימות שהגיע מועדן</li>}
          </ul>
        </div>
      )}

      <div className={`${compact ? 'hidden' : 'flex'} flex-wrap items-center justify-between gap-2`}>
        <div className="flex flex-wrap gap-1.5">
          {[['all', `הכל (${projects.length})`], ...PROJECT_STAGES.concat(['ללא שלב'])
            .filter((stage) => stageCounts[stage])
            .map((stage) => [stage, `${stage} (${stageCounts[stage]})`])].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStageFilter(value)}
              className={`text-xs px-3 py-1.5 border transition-colors ${
                stageFilter === value
                  ? 'bg-[#5E1D1D] text-white border-[#5E1D1D]'
                  : 'bg-[#faf6f1] text-[#2a2622] border-[#d9cfc2] hover:border-[#5E1D1D]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {lastRefreshed && (
            <span className="text-[11px] text-[#6a6158]">עודכן {formatDateTime(lastRefreshed).split(', ').pop()}</span>
          )}
          <Button size="sm" variant="outline" className="text-xs" onClick={onRefresh} disabled={refreshing}>
            <RefreshCw className={`w-3.5 h-3.5 ml-1 ${refreshing ? 'animate-spin' : ''}`} />
            רענון
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={() => exportCsv(visible)}
            disabled={visible.length === 0}
          >
            <Download className="w-3.5 h-3.5 ml-1" />
            ייצוא לאקסל
          </Button>
        </div>
      </div>

      {!compact && doneCount > 0 && stageFilter === 'all' && (
        <button
          type="button"
          onClick={() => setShowDone((value) => !value)}
          className="text-xs text-[#6a6158] underline underline-offset-4"
        >
          {showDone ? 'להסתיר פרויקטים שהושלמו' : `להציג גם פרויקטים שהושלמו (${doneCount})`}
        </button>
      )}

      <div className={`${compact ? 'hidden' : ''} bg-[#e6dccd] px-4 py-3 space-y-3`}>
        <p className="font-heading text-base text-[#2a2622]">פרויקט חדש</p>
        <div className="flex flex-wrap gap-2">
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className="h-9 w-full sm:w-[260px] text-sm bg-white border-[#d9cfc2]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent dir="rtl">
              <SelectItem value={BLANK}>פרויקט ריק</SelectItem>
              {questionnaires.map((q) => (
                <SelectItem key={q.id} value={q.id}>מהשאלון של {q.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!chosen && (
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="שם הלקוח"
              className="h-9 w-full sm:w-[200px] text-sm bg-white border-[#d9cfc2]"
            />
          )}
          <Button
            onClick={create}
            disabled={creating || (!chosen && !name.trim())}
            className="h-9 bg-[#5E1D1D] hover:bg-[#4a1717] text-white rounded-[6px]"
          >
            {creating ? 'יוצר...' : 'יצירה'}
          </Button>
        </div>
      </div>

      {visible.length === 0 && (
        <p className="text-center text-sm text-[#6a6158] py-8">אין פרויקטים להצגה.</p>
      )}

      {visible.map((project) => (
        <ProjectRow
          key={project.id}
          project={project}
          materials={materialsByProject[project.id] || []}
          questionnaire={project.source_id ? questionnaireById[project.source_id] : undefined}
          openRequest={openRequest}
          onUpdate={(patch) => onUpdate(project.id, patch)}
          onDelete={() => onDelete(project.id)}
          onMarkSeen={onMarkSeen}
        />
      ))}
    </div>
  );
}
