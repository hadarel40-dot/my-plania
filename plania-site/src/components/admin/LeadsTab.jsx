import { useMemo, useState } from 'react';
import LeadCard from './LeadCard';
import LeadFilters from './LeadFilters';
import { DEFAULT_LEAD_STATUS } from '@/lib/leadStatus';
import { waNumber } from '@/lib/phone';

const HIDDEN_STATUS = 'לא רלוונטי';

export default function LeadsTab({
  leads,
  onUpdate,
  onDelete,
  questionnairesByPhone = {},
  projectByPhone = {},
  onOpenProject,
  onCreateProject,
  compact = false,
}) {
  const [service, setService] = useState('all');
  const [status, setStatus] = useState(compact ? 'all' : 'active');
  const [sort, setSort] = useState('followup_asc');

  const visible = useMemo(() => {
    const list = leads.filter((lead) => {
      const leadStatus = lead.status || DEFAULT_LEAD_STATUS;
      const statusOk =
        status === 'all' || (status === 'active' ? leadStatus !== HIDDEN_STATUS : leadStatus === status);
      return (service === 'all' || lead.service === service) && statusOk;
    });
    const date = (lead) => lead.follow_up_date || '9999-12-31';

    if (sort === 'followup_desc') return [...list].sort((a, b) => date(b).localeCompare(date(a)));
    if (sort === 'created') {
      return [...list].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    }
    return [...list].sort((a, b) => date(a).localeCompare(date(b)));
  }, [leads, service, status, sort]);

  if (!leads.length) {
    return <p className="text-center text-sm text-[#6a6158] py-10">אין לידים עדיין.</p>;
  }

  return (
    <div className="space-y-3">
      {!compact && (
        <>
          <LeadFilters
            service={service}
            status={status}
            sort={sort}
            onService={setService}
            onStatus={setStatus}
            onSort={setSort}
          />

          <p className="text-xs text-[#6a6158]">
            מציג {visible.length} מתוך {leads.length} לידים
          </p>
        </>
      )}

      {visible.length === 0 ? (
        <p className="text-center text-sm text-[#6a6158] py-8">אין לידים שמתאימים לסינון.</p>
      ) : (
        visible.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            onUpdate={(patch) => onUpdate(lead.id, patch)}
            onDelete={() => onDelete(lead.id)}
            questionnaires={questionnairesByPhone[waNumber(lead.phone)] || []}
            project={projectByPhone[waNumber(lead.phone)]}
            onOpenProject={onOpenProject}
            onCreateProject={onCreateProject ? () => onCreateProject(lead) : undefined}
          />
        ))
      )}
    </div>
  );
}
