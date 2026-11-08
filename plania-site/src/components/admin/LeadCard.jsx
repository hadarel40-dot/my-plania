import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import PhoneActions from './PhoneActions';
import DeleteButton from './DeleteButton';
import OpenProjectButton from './OpenProjectButton';
import { useAdminActions } from './AdminActions';
import StatusSelect from './StatusSelect';
import QuestionnaireAnswers from './QuestionnaireAnswers';
import {
  LEAD_STATUSES,
  DEFAULT_LEAD_STATUS,
  SERVICE_KEYS,
  serviceMeta,
  appendHistory,
} from '@/lib/leadStatus';
import { formatDateTime, todayISO, formatDateOnly } from '@/lib/formatDate';
import { sourceName } from '@/lib/attribution';

const inputClass =
  'w-full h-8 px-2 text-xs bg-white border border-[#d9cfc2] text-[#2a2622] focus:outline-none focus:border-[#5E1D1D]';

function Field({ label, children }) {
  return (
    <div>
      <span className="block text-[11px] text-[#6a6158] mb-1">{label}</span>
      {children}
    </div>
  );
}

export default function LeadCard({
  lead,
  onUpdate,
  onDelete,
  questionnaires = [],
  project,
  onOpenProject,
  onCreateProject,
}) {
  const { openClient } = useAdminActions();
  const status = lead.status || DEFAULT_LEAD_STATUS;
  const meta = serviceMeta(lead.service);
  const overdue = Boolean(lead.follow_up_date) && lead.follow_up_date < todayISO();

  const [notes, setNotes] = useState(lead.notes || '');
  const [savedNotes, setSavedNotes] = useState(lead.notes || '');
  const [value, setValue] = useState(lead.deal_value ?? '');
  const [saving, setSaving] = useState(false);

  // The value can change from outside (a new quote was sent), so the field follows it.
  useEffect(() => {
    setValue(lead.deal_value ?? '');
  }, [lead.deal_value]);

  const history = Array.isArray(lead.history) ? [...lead.history].reverse() : [];
  const answers = questionnaires.flatMap((item) => item.answers || []);

  const changeStatus = (next) => {
    onUpdate({
      status: next,
      history: appendHistory(lead.history, { kind: 'status', text: `סטטוס שונה ל${next}` }),
    });
  };

  const changeService = (next) => {
    onUpdate({
      service: next,
      history: appendHistory(lead.history, {
        kind: 'service',
        text: `שירות שונה ל${serviceMeta(next).label}`,
      }),
    });
  };

  const changeDate = (event) => {
    const next = event.target.value;
    onUpdate({
      follow_up_date: next,
      history: appendHistory(lead.history, {
        kind: 'date',
        text: next ? `תאריך מעקב נקבע ל${formatDateOnly(next)}` : 'תאריך המעקב נמחק',
      }),
    });
  };

  const saveValue = () => {
    const next = value === '' ? null : Number(value);
    if (next === (lead.deal_value ?? null)) return;
    onUpdate({
      deal_value: next,
      history: appendHistory(lead.history, {
        kind: 'value',
        text: `שווי עסקה עודכן ל־${(next || 0).toLocaleString('he-IL')}₪`,
      }),
    });
  };

  const saveNotes = async () => {
    setSaving(true);
    try {
      await onUpdate({
        notes,
        history: appendHistory(lead.history, { kind: 'note', text: `הערה: ${notes}` }),
      });
      setSavedNotes(notes);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-[#faf6f1] border-r-4 px-4 py-3" style={{ borderRightColor: meta.color }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-heading text-lg text-[#2a2622]">{lead.name}</p>
            <span
              className="text-[10px] px-2 py-0.5 rounded-full text-white"
              style={{ background: meta.color }}
            >
              {meta.label}
            </span>
            {status === DEFAULT_LEAD_STATUS && (
              <span className="text-[10px] px-2 py-0.5 rounded-full text-white bg-[#5E1D1D]">חדש</span>
            )}
            {overdue && (
              <span className="text-[10px] px-2 py-0.5 rounded-full text-white bg-[#c0392b]">באיחור</span>
            )}
          </div>
          <p className="text-xs text-[#6a6158]">
            {formatDateTime(lead.created_date)}
            {lead.source ? ` · מקור: ${sourceName(lead.source)}${lead.campaign ? ` (${lead.campaign})` : ''}` : ''}
          </p>
          {lead.message && <p className="text-xs text-[#6a6158] mt-1">{lead.message}</p>}
        </div>
        <div className="flex items-center gap-1">
          <PhoneActions phone={lead.phone} name={lead.name} />
          <Button size="sm" variant="outline" className="text-xs" onClick={() => openClient(lead)}>
            כרטיס לקוח
          </Button>
          {onCreateProject && (
            <OpenProjectButton project={project} onCreate={onCreateProject} onOpen={onOpenProject} />
          )}
          {onDelete && <DeleteButton name={lead.name} what="הליד" onDelete={onDelete} />}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="סטטוס">
          <StatusSelect value={status} options={LEAD_STATUSES} onChange={changeStatus} />
        </Field>
        <Field label="שירות">
          <Select value={lead.service || ''} onValueChange={changeService}>
            <SelectTrigger className="h-8 text-xs bg-white border-[#d9cfc2] text-[#2a2622]">
              <SelectValue placeholder="בחירת שירות" />
            </SelectTrigger>
            <SelectContent dir="rtl">
              {SERVICE_KEYS.map((key) => (
                <SelectItem key={key} value={key} className="text-xs">
                  {serviceMeta(key).label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="תאריך מעקב">
          <input
            type="date"
            value={lead.follow_up_date || ''}
            onChange={changeDate}
            className={`${inputClass} ${overdue ? 'text-[#c0392b] border-[#c0392b] font-bold' : ''}`}
          />
        </Field>
        <Field label="שווי עסקה (₪)">
          <input
            type="number"
            min="0"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onBlur={saveValue}
            placeholder="0"
            className={inputClass}
          />
        </Field>
      </div>

      <div className="mt-3">
        <Textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="הערות"
          rows={2}
          className="text-sm bg-white border-[#d9cfc2]"
        />
        {notes !== savedNotes && (
          <Button size="sm" className="mt-2 text-xs" onClick={saveNotes} disabled={saving}>
            {saving ? 'שומר...' : 'שמירת הערות'}
          </Button>
        )}
      </div>

      {answers.length > 0 && (
        <Collapsible className="mt-3">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="w-full flex items-center justify-between gap-2 bg-white border border-dashed border-[#e3d9cc] px-3 py-2 text-[11px] font-bold text-[#5E1D1D]"
            >
              <span>תשובות מהשאלון ({answers.length})</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <QuestionnaireAnswers items={answers} />
          </CollapsibleContent>
        </Collapsible>
      )}

      {history.length > 0 && (
        <div className="mt-3 border-t border-dashed border-[#e3d9cc] pt-2">
          <p className="text-[11px] font-bold text-[#6a6158] mb-1">היסטוריה</p>
          <ul className="space-y-1">
            {history.map((entry, index) => (
              <li key={index} className="text-[11px] text-[#6a6158]">
                <span className="text-[#8a8079]">{formatDateTime(entry.at)}</span> · {entry.text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}