import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import FileLinks from './FileLinks';
import { PROJECT_STAGES, PROJECT_TYPES, newPortalToken, portalLink, portalWhatsAppText } from '@/lib/projects';
import { IMPORT_FIELD_LABELS, buildProjectFields, mergeIntoDraft } from '@/lib/questionnaireImport';
import { formatDateTime } from '@/lib/formatDate';
import { base44 } from '@/api/base44Client';
import { Download, Loader2, Plus, X } from 'lucide-react';

const FIELD_KEYS = [
  'name', 'business_name', 'phone', 'email', 'project_type', 'stage', 'start_date', 'due_date',
  'price', 'deposit_paid', 'balance_paid', 'domain', 'platform', 'existing_site', 'goal', 'audience',
  'pages_features', 'brand', 'references', 'requirements', 'notes', 'requested_items', 'tasks', 'log',
  'portal_enabled', 'portal_note',
];

const shekel = (value) => `₪${Number(value || 0).toLocaleString('he-IL')}`;

function Field({ label, children, className = '' }) {
  return (
    <div className={className}>
      <label className="text-xs text-[#6a6158] block mb-1">{label}</label>
      {children}
    </div>
  );
}

function pickDraft(project) {
  const draft = {};
  FIELD_KEYS.forEach((key) => {
    draft[key] = project[key] ?? (['requested_items', 'tasks', 'log'].includes(key) ? [] : '');
  });
  if (project.portal_enabled === undefined) draft.portal_enabled = true;
  return draft;
}

export default function ProjectEditor({ project, materials, questionnaire, open, onOpenChange, onUpdate, onMarkSeen }) {
  const [draft, setDraft] = useState(() => pickDraft(project));
  const baseRef = useRef(pickDraft(project));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newItem, setNewItem] = useState('');
  const [newTask, setNewTask] = useState('');
  const [newLog, setNewLog] = useState('');
  const [copied, setCopied] = useState(false);
  const [importNote, setImportNote] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  useEffect(() => {
    if (open) {
      setImportNote('');
      baseRef.current = pickDraft(project);
      setDraft(pickDraft(project));
      setSaved(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project.id]);

  useEffect(() => {
    if (!open) return;
    materials.filter((m) => !m.seen).forEach((m) => onMarkSeen(m.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, materials.length]);

  const set = (key, value) => {
    setSaved(false);
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const num = (key) => (
    <Input
      type="number"
      inputMode="numeric"
      dir="ltr"
      value={draft[key] ?? ''}
      onChange={(event) => set(key, event.target.value === '' ? '' : Number(event.target.value))}
      className="bg-white border-[#d9cfc2] text-sm"
    />
  );

  const text = (key, props = {}) => (
    <Input
      value={draft[key] ?? ''}
      onChange={(event) => set(key, event.target.value)}
      className="bg-white border-[#d9cfc2] text-sm"
      {...props}
    />
  );

  const area = (key, rows = 4, placeholder = '') => (
    <Textarea
      value={draft[key] ?? ''}
      onChange={(event) => set(key, event.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="bg-white border-[#d9cfc2] text-sm"
    />
  );

  const save = async () => {
    setSaving(true);
    try {
      const patch = {};
      Object.keys(draft).forEach((key) => {
        if (JSON.stringify(draft[key]) !== JSON.stringify(baseRef.current[key])) patch[key] = draft[key];
      });
      ['price', 'deposit_paid', 'balance_paid', 'start_date', 'due_date'].forEach((key) => {
        if (key in patch && patch[key] === '') patch[key] = null;
      });
      if (Object.keys(patch).length > 0) await onUpdate(patch);
      baseRef.current = { ...draft };
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  const importFromQuestionnaire = () => {
    const type = questionnaire.__type || project.source_type || 'business';
    const { fields } = buildProjectFields(questionnaire, type);
    const { updates, filled, skipped } = mergeIntoDraft(draft, fields);
    if (Object.keys(updates).length > 0) {
      setSaved(false);
      setDraft((prev) => ({ ...prev, ...updates }));
    }
    const names = (keys) => keys.map((key) => IMPORT_FIELD_LABELS[key] || key).join(', ');
    const parts = [];
    if (filled.length) parts.push(`יובאו: ${names(filled)}`);
    if (skipped.length) parts.push(`לא נדרסו שדות שכבר מלאים: ${names(skipped)}`);
    if (!parts.length) parts.push('אין מה לייבא, הכל כבר בפנים');
    setImportNote(`${parts.join('. ')}. לא לשכוח ללחוץ על שמירה.`);
  };

  const link = portalLink(project.portal_token);
  const copyLink = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const allFilesCount =
    materials.reduce((sum, material) => sum + (material.files?.length || 0), 0) +
    (questionnaire?.files?.length || 0);

  const downloadAll = async () => {
    setDownloadError('');
    setDownloading(true);
    try {
      const response = await base44.functions.invoke('downloadProjectFiles', { projectId: project.id });
      const url = response?.data?.url;
      if (!url) throw new Error(response?.data?.error || 'לא הצלחתי להוריד את הקבצים');
      // Same tab: the server answers with a file download, so the page stays where it is,
      // and phones do not block it as a pop-up the way they block a new tab.
      window.location.assign(url);
    } catch (error) {
      setDownloadError(error?.response?.data?.error || 'לא הצלחתי להוריד את הקבצים, נסו שוב');
    } finally {
      setDownloading(false);
    }
  };

  const paid = Number(draft.deposit_paid || 0) + Number(draft.balance_paid || 0);
  const remaining = Math.max(Number(draft.price || 0) - paid, 0);

  const items = draft.requested_items || [];
  const tasks = draft.tasks || [];
  const log = draft.log || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-[720px] max-h-[90vh] overflow-y-auto text-right">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl text-[#2a2622]">{project.name}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="details">
          <TabsList className="w-full h-auto flex-wrap bg-[#e6dccd]">
            <TabsTrigger value="details" className="flex-1 text-xs">פרטים</TabsTrigger>
            <TabsTrigger value="brief" className="flex-1 text-xs">אפיון</TabsTrigger>
            <TabsTrigger value="materials" className="flex-1 text-xs">
              חומרים{materials.length ? ` (${materials.length})` : ''}
            </TabsTrigger>
            <TabsTrigger value="tasks" className="flex-1 text-xs">משימות</TabsTrigger>
            <TabsTrigger value="log" className="flex-1 text-xs">יומן</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-3 pt-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="שם הלקוח">{text('name')}</Field>
              <Field label="שם העסק או הפרויקט">{text('business_name')}</Field>
              <Field label="טלפון">{text('phone', { dir: 'ltr' })}</Field>
              <Field label="מייל">{text('email', { dir: 'ltr' })}</Field>
              <Field label="סוג הפרויקט">
                <Select value={draft.project_type || undefined} onValueChange={(v) => set('project_type', v)}>
                  <SelectTrigger className="bg-white border-[#d9cfc2] text-sm"><SelectValue placeholder="בחירה" /></SelectTrigger>
                  <SelectContent dir="rtl">
                    {PROJECT_TYPES.map((type) => (<SelectItem key={type} value={type}>{type}</SelectItem>))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="שלב בעבודה">
                <Select value={draft.stage || undefined} onValueChange={(v) => set('stage', v)}>
                  <SelectTrigger className="bg-white border-[#d9cfc2] text-sm"><SelectValue placeholder="בחירה" /></SelectTrigger>
                  <SelectContent dir="rtl">
                    {PROJECT_STAGES.map((stage) => (<SelectItem key={stage} value={stage}>{stage}</SelectItem>))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="תאריך התחלה">{text('start_date', { type: 'date', dir: 'ltr' })}</Field>
              <Field label="תאריך מסירה">{text('due_date', { type: 'date', dir: 'ltr' })}</Field>
              <Field label="דומיין">{text('domain', { dir: 'ltr' })}</Field>
              <Field label="פלטפורמה או אחסון">{text('platform')}</Field>
              <Field label="אתר או אפליקציה קיימים" className="sm:col-span-2">
                {text('existing_site', { dir: 'ltr' })}
              </Field>
            </div>

            <div className="border-t border-[#e3d9cc] pt-3">
              <p className="font-heading text-base text-[#2a2622] mb-2">כסף</p>
              <div className="grid sm:grid-cols-3 gap-3">
                <Field label="מחיר מסוכם">
                  {num('price')}
                  {questionnaire?.quote_price > 0 && Number(questionnaire.quote_price) !== Number(draft.price || 0) && (
                    <button
                      type="button"
                      className="text-[11px] underline text-[#5E1D1D] mt-1"
                      onClick={() => set('price', Number(questionnaire.quote_price))}
                    >
                      עדכון מהצעת המחיר ({shekel(questionnaire.quote_price)})
                    </button>
                  )}
                </Field>
                <Field label="מקדמה ששולמה">{num('deposit_paid')}</Field>
                <Field label="יתרה ששולמה">{num('balance_paid')}</Field>
              </div>
              <p className="text-xs text-[#6a6158] mt-2">
                שולם {shekel(paid)} · נשאר לגבות {shekel(remaining)}
              </p>
            </div>

            <div className="border-t border-[#e3d9cc] pt-3">
              <Field label="הערות פנימיות (הלקוח לא רואה)">{area('notes', 4)}</Field>
            </div>
          </TabsContent>

          <TabsContent value="brief" className="space-y-3 pt-3">
            {questionnaire && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={importFromQuestionnaire}
              >
                ייבוא התשובות מהשאלון
              </Button>
            )}
            {importNote && <p className="text-xs text-[#4A6355]">{importNote}</p>}
            <Field label="מטרת הפרויקט">{area('goal', 3)}</Field>
            <Field label="קהל יעד">{area('audience', 3)}</Field>
            <Field label="עמודים ופיצ'רים">{area('pages_features', 5, 'לדוגמה: דף בית, אודות, שירותים, יצירת קשר, אזור אישי...')}</Field>
            <Field label="מיתוג: צבעים, גופנים, לוגו">{area('brand', 3)}</Field>
            <Field label="דוגמאות והשראות">{area('references', 3, 'קישורים לאתרים שהלקוח אוהב ומה אהב בהם')}</Field>
            <Field label="דרישות ופרטי אפיון נוספים">{area('requirements', 10)}</Field>
          </TabsContent>

          <TabsContent value="materials" className="space-y-4 pt-3">
            <div className="bg-[#faf6f1] border border-[#e3d9cc] p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-heading text-base text-[#2a2622]">קישור להעלאת חומרים</p>
                <label className="flex items-center gap-2 text-xs text-[#6a6158]">
                  פעיל
                  <Switch checked={!!draft.portal_enabled} onCheckedChange={(v) => set('portal_enabled', v)} />
                </label>
              </div>
              <p className="text-xs text-[#6a6158] break-all" dir="ltr">{link}</p>
              {String(project.portal_token || '').length > 20 && (
                <div className="text-xs text-[#6a6158]">
                  הקישור הזה ארוך.{' '}
                  <button
                    type="button"
                    className="underline text-[#5E1D1D]"
                    onClick={async () => {
                      if (window.confirm('ליצור קישור קצר חדש? הקישור הישן יפסיק לעבוד.')) {
                        await onUpdate({ portal_token: newPortalToken() });
                      }
                    }}
                  >
                    יצירת קישור קצר חדש
                  </button>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="text-xs" onClick={copyLink}>
                  {copied ? 'הועתק' : 'העתקת קישור'}
                </Button>
                <a
                  href={`https://wa.me/${String(project.phone || '').replace(/\D/g, '').replace(/^0/, '972')}?text=${encodeURIComponent(portalWhatsAppText(project.name, link))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-3 py-1.5 border border-[#5E1D1D] text-[#5E1D1D] text-xs hover:bg-[#5E1D1D] hover:text-white transition-colors"
                >
                  שליחה בוואטסאפ
                </a>
              </div>
              <Field label="הודעה שהלקוח רואה בראש העמוד">{area('portal_note', 3)}</Field>
            </div>

            <div>
              <p className="font-heading text-base text-[#2a2622] mb-2">רשימת חומרים שהתבקשו</p>
              <ul className="space-y-1.5">
                {items.map((entry, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!entry.received}
                      onChange={(event) => set('requested_items', items.map((it, i) => (i === index ? { ...it, received: event.target.checked } : it)))}
                      className="w-4 h-4 accent-[#5E1D1D]"
                    />
                    <span className={`text-sm flex-1 ${entry.received ? 'text-[#6a6158] line-through' : 'text-[#2a2622]'}`}>{entry.label}</span>
                    <button
                      type="button"
                      aria-label="הסרה"
                      onClick={() => set('requested_items', items.filter((_, i) => i !== index))}
                      className="text-[#8a8079] hover:text-[#c0392b]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2 mt-2">
                <Input
                  value={newItem}
                  onChange={(event) => setNewItem(event.target.value)}
                  placeholder="פריט חדש שהלקוח צריך להעביר"
                  className="bg-white border-[#d9cfc2] text-sm"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!newItem.trim()}
                  onClick={() => {
                    set('requested_items', [...items, { label: newItem.trim(), received: false }]);
                    setNewItem('');
                  }}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div>
              {allFilesCount > 0 && (
                <Button
                  type="button"
                  className="w-full mb-4 text-white"
                  style={{ background: '#5E1D1D' }}
                  onClick={downloadAll}
                  disabled={downloading}
                >
                  {downloading ? (
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 ml-2" />
                  )}
                  {downloading ? 'אוספת את הקבצים...' : `הורדת כל החומרים בלחיצה אחת (${allFilesCount})`}
                </Button>
              )}
              {downloadError && <p className="text-xs text-[#a33] mb-3">{downloadError}</p>}
              {questionnaire?.files?.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-[#6a6158] mb-1">קבצים שצורפו לשאלון המקורי</p>
                  <FileLinks files={questionnaire.files} />
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <p className="font-heading text-base text-[#2a2622]">מה הלקוח שלח</p>
              </div>
              {materials.length === 0 && <p className="text-sm text-[#6a6158]">עדיין לא נשלח כלום.</p>}
              <div className="space-y-3">
                {materials.map((material) => (
                  <div key={material.id} className="bg-white border border-[#e3d9cc] p-3">
                    <p className="text-[11px] text-[#6a6158] mb-1">
                      {formatDateTime(material.created_date)}
                      {material.requested_item ? ` · ${material.requested_item}` : ''}
                    </p>
                    {material.text && <p className="text-sm text-[#2a2622] whitespace-pre-wrap mb-2">{material.text}</p>}
                    <FileLinks files={material.files} />
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="tasks" className="space-y-3 pt-3">
            <ul className="space-y-1.5">
              {tasks.map((task, index) => (
                <li key={index} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!task.done}
                    onChange={(event) => set('tasks', tasks.map((t, i) => (i === index ? { ...t, done: event.target.checked } : t)))}
                    className="w-4 h-4 accent-[#5E1D1D]"
                  />
                  <span className={`text-sm flex-1 ${task.done ? 'text-[#6a6158] line-through' : 'text-[#2a2622]'}`}>{task.text}</span>
                  <input
                    type="date"
                    dir="ltr"
                    value={task.due || ''}
                    onChange={(event) => set('tasks', tasks.map((t, i) => (i === index ? { ...t, due: event.target.value } : t)))}
                    className="text-xs bg-white border border-[#d9cfc2] px-1.5 py-1"
                  />
                  <button
                    type="button"
                    aria-label="הסרה"
                    onClick={() => set('tasks', tasks.filter((_, i) => i !== index))}
                    className="text-[#8a8079] hover:text-[#c0392b]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
              {tasks.length === 0 && <p className="text-sm text-[#6a6158]">אין משימות עדיין.</p>}
            </ul>
            <div className="flex gap-2">
              <Input
                value={newTask}
                onChange={(event) => setNewTask(event.target.value)}
                placeholder="משימה חדשה"
                className="bg-white border-[#d9cfc2] text-sm"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!newTask.trim()}
                onClick={() => {
                  set('tasks', [...tasks, { text: newTask.trim(), done: false, due: '' }]);
                  setNewTask('');
                }}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="log" className="space-y-3 pt-3">
            <div className="flex gap-2">
              <Input
                value={newLog}
                onChange={(event) => setNewLog(event.target.value)}
                placeholder="עדכון, שיחה או החלטה"
                className="bg-white border-[#d9cfc2] text-sm"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!newLog.trim()}
                onClick={() => {
                  set('log', [{ at: new Date().toISOString(), text: newLog.trim() }, ...log]);
                  setNewLog('');
                }}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <ul className="space-y-2">
              {log.map((entry, index) => (
                <li key={index} className="bg-white border border-[#e3d9cc] px-3 py-2">
                  <p className="text-[11px] text-[#6a6158]">{formatDateTime(entry.at)}</p>
                  <p className="text-sm text-[#2a2622] whitespace-pre-wrap">{entry.text}</p>
                </li>
              ))}
              {log.length === 0 && <p className="text-sm text-[#6a6158]">היומן ריק.</p>}
            </ul>
          </TabsContent>
        </Tabs>

        <div className="sticky bottom-0 bg-background pt-3 flex items-center gap-3">
          <Button onClick={save} disabled={saving} className="bg-[#5E1D1D] hover:bg-[#4a1717] text-white rounded-[6px]">
            {saving ? 'שומר...' : 'שמירה'}
          </Button>
          {saved && <span className="text-xs text-[#4A6355]">נשמר</span>}
        </div>
      </DialogContent>
    </Dialog>
  );
}