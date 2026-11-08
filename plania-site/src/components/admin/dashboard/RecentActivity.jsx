import { useMemo } from 'react';

const SERVICE_LABELS = { travel: 'טיולים', business: 'עסקים', plania: 'פלאניה' };

function when(value) {
  if (!value) return '';
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return 'עכשיו';
  if (hours < 24) return `לפני ${hours} שעות`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'אתמול';
  if (days < 7) return `לפני ${days} ימים`;
  return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
}

export default function RecentActivity({ data }) {
  const events = useMemo(() => {
    const projectNames = Object.fromEntries((data.projects || []).map((p) => [p.id, p.name]));
    const list = [];

    (data.leads || []).forEach((lead) => {
      const service = SERVICE_LABELS[lead.service] || '';
      list.push({
        id: `lead-${lead.id}`,
        at: lead.created_date,
        title: `פנייה חדשה · ${lead.name || 'ללא שם'}`,
        detail: service,
      });
    });
    (data.travel || []).forEach((record) => {
      list.push({ id: `travel-${record.id}`, at: record.created_date, title: `שאלון טיול · ${record.name}`, detail: '' });
    });
    (data.business || []).forEach((record) => {
      list.push({ id: `business-${record.id}`, at: record.created_date, title: `שאלון עסק · ${record.name}`, detail: '' });
    });
    (data.materials || []).forEach((record) => {
      list.push({
        id: `material-${record.id}`,
        at: record.created_date,
        title: 'חומרים מהלקוח',
        detail: projectNames[record.project_id] || '',
      });
    });

    return list
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .slice(0, 8);
  }, [data]);

  return (
    <section className="bg-[#faf6f1] border border-[#e3d9cc] p-4">
      <h3 className="font-heading text-lg text-[#5E1D1D]">פעילות אחרונה</h3>
      <p className="text-[11px] text-[#6a6158] mt-0.5">פניות, שאלונים וחומרים שהתקבלו באתר</p>
      {events.length === 0 ? (
        <p className="text-sm text-[#6a6158] py-6 text-center">אין פעילות עדיין.</p>
      ) : (
        <ul className="mt-3 divide-y divide-[#e6dccd]">
          {events.map((event) => (
            <li key={event.id} className="flex items-start justify-between gap-3 py-2">
              <div>
                <p className="text-sm text-[#2a2622]">{event.title}</p>
                {event.detail && <p className="text-[11px] text-[#6a6158] mt-0.5">{event.detail}</p>}
              </div>
              <span className="text-[11px] text-[#6a6158] shrink-0">{when(event.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}