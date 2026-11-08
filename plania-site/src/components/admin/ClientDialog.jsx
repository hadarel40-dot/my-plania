import { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import PhoneActions from './PhoneActions';
import { clientKeyOf, balanceOf } from '@/lib/adminInsights';
import { formatDateTime } from '@/lib/formatDate';
import { serviceMeta } from '@/lib/leadStatus';
import { sourceName } from '@/lib/attribution';

const shekel = (value) => `₪${Number(value || 0).toLocaleString('he-IL')}`;
const TYPE_LABEL = { travel: 'טיולים', business: 'עסקים' };

function Stat({ label, value }) {
  return (
    <div className="bg-white border border-[#e3d9cc] px-3 py-2">
      <p className="text-[11px] text-[#6a6158]">{label}</p>
      <p className="font-heading text-lg text-[#5E1D1D]">{value}</p>
    </div>
  );
}

// Everything about one client in one place: what happened and when, money, notes.
export default function ClientDialog({ client, data, onClose, onOpenProject }) {
  const card = useMemo(() => {
    if (!client) return null;
    const same = (record) => clientKeyOf(record) === client.key;
    const leads = data.leads.filter(same);
    const questionnaires = [
      ...data.business.map((q) => ({ ...q, __type: 'business' })),
      ...data.travel.map((q) => ({ ...q, __type: 'travel' })),
    ].filter(same);
    const questionnaireIds = new Set(questionnaires.map((q) => q.id));
    const projects = data.projects.filter(
      (project) => same(project) || (project.source_id && questionnaireIds.has(project.source_id))
    );
    const projectIds = new Set(projects.map((project) => project.id));
    const materials = data.materials.filter((material) => projectIds.has(material.project_id));

    const events = [];
    const add = (at, title, detail = '') => {
      if (at && !Number.isNaN(new Date(at).getTime())) events.push({ at, title, detail });
    };

    leads.forEach((lead) => {
      add(
        lead.created_date,
        `ליד נכנס · ${serviceMeta(lead.service).label}${lead.source ? ` · מ${sourceName(lead.source)}` : ''}`,
        lead.message
      );
      (Array.isArray(lead.history) ? lead.history : []).forEach((entry) => add(entry.at, entry.text));
    });
    questionnaires.forEach((q) => {
      add(q.created_date, `מילא שאלון ${TYPE_LABEL[q.__type]}${q.source ? ` · מ${sourceName(q.source)}` : ''}`);
      if (q.contract_signed) add(q.signed_at, 'חתם על ההסכם', q.signer_name);
      if (q.quote_sent_at) add(q.quote_sent_at, 'נשלחה הצעת מחיר', q.quote_price ? shekel(q.quote_price) : '');
      if (q.quote_approved_at) add(q.quote_approved_at, 'ההצעה אושרה', q.quote_approved_name);
    });
    projects.forEach((project) => {
      add(project.created_date, `נפתח פרויקט: ${project.name}`);
      (project.log || []).forEach((entry) => add(entry.at, entry.text));
    });
    materials.forEach((material) => {
      const count = (material.files || []).length;
      const parts = [
        material.requested_item,
        count ? `${count} קבצים` : '',
        material.text ? String(material.text).slice(0, 120) : '',
      ].filter(Boolean);
      add(material.created_date, 'הלקוח שלח חומרים', parts.join(' · '));
    });
    events.sort((a, b) => new Date(b.at) - new Date(a.at));

    const notes = [...leads, ...questionnaires].map((record) => record.notes).filter(Boolean);
    return { leads, questionnaires, projects, events, notes };
  }, [client, data]);

  return (
    <Dialog open={Boolean(client)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent dir="rtl" className="max-w-[560px] max-h-[88vh] overflow-y-auto bg-[#faf6f1]">
        {client && card && (
          <>
            <DialogHeader>
              <DialogTitle className="font-heading text-xl text-[#2a2622] text-right">{client.name}</DialogTitle>
            </DialogHeader>

            <PhoneActions phone={client.phone} name={client.name} />

            {card.projects.map((project) => (
              <div key={project.id} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-[#2a2622]">
                    {project.name}
                    {project.stage ? ` · ${project.stage}` : ''}
                  </p>
                  <Button
                    size="sm"
                    className="text-xs bg-[#5E1D1D] hover:bg-[#4a1717] text-white"
                    onClick={() => onOpenProject(project.id)}
                  >
                    פתיחת הפרויקט
                  </Button>
                </div>
                {Number(project.price) > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    <Stat label="מחיר" value={shekel(project.price)} />
                    <Stat
                      label="שולם"
                      value={shekel(Number(project.deposit_paid || 0) + Number(project.balance_paid || 0))}
                    />
                    <Stat label="נשאר" value={shekel(balanceOf(project))} />
                  </div>
                )}
              </div>
            ))}

            {card.notes.length > 0 && (
              <div className="bg-white border border-dashed border-[#e3d9cc] px-3 py-2">
                <p className="text-[11px] font-bold text-[#6a6158] mb-1">הערות</p>
                {card.notes.map((note, index) => (
                  <p key={index} className="text-sm text-[#2a2622] whitespace-pre-wrap">
                    {note}
                  </p>
                ))}
              </div>
            )}

            <div>
              <p className="font-heading text-base text-[#2a2622] mb-2">מה קרה עד עכשיו</p>
              {card.events.length === 0 ? (
                <p className="text-sm text-[#6a6158]">עוד אין פעילות.</p>
              ) : (
                <ul className="border-r-2 border-[#d9cfc2] pr-3 space-y-3">
                  {card.events.map((event, index) => (
                    <li key={index} className="relative">
                      <span className="absolute -right-[19px] top-1.5 w-2 h-2 bg-[#5E1D1D]" />
                      <p className="text-[11px] text-[#8a8079]">{formatDateTime(event.at)}</p>
                      <p className="text-sm text-[#2a2622]">{event.title}</p>
                      {event.detail && <p className="text-xs text-[#6a6158] whitespace-pre-wrap">{event.detail}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
