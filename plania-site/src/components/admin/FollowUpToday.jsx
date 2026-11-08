import PhoneActions from './PhoneActions';
import { serviceMeta } from '@/lib/leadStatus';
import { todayISO, formatDateOnly } from '@/lib/formatDate';

export default function FollowUpToday({ leads }) {
  return (
    <section className="mb-6">
      <h2 className="font-heading text-lg text-[#2a2622] mb-2">
        לחזור היום
        {leads.length > 0 && <span className="text-xs text-[#6a6158]"> ({leads.length})</span>}
      </h2>

      {leads.length === 0 ? (
        <p className="bg-[#faf6f1] border border-[#e3d9cc] px-4 py-3 text-xs text-[#6a6158]">
          אין מעקבים להיום.
        </p>
      ) : (
        <div className="space-y-2">
          {leads.map((lead) => {
            const overdue = lead.follow_up_date < todayISO();
            const meta = serviceMeta(lead.service);

            return (
              <div
                key={lead.id}
                className="bg-[#faf6f1] border-r-4 px-3 py-2 flex flex-wrap items-center justify-between gap-2"
                style={{ borderRightColor: overdue ? '#c0392b' : meta.color }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <p className="text-sm font-bold text-[#2a2622]">{lead.name}</p>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full text-white"
                    style={{ background: meta.color }}
                  >
                    {meta.label}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`text-xs font-bold ${overdue ? 'text-[#c0392b]' : 'text-[#6a6158]'}`}
                  >
                    {overdue ? 'באיחור · ' : 'היום · '}
                    {formatDateOnly(lead.follow_up_date)}
                  </span>
                  <PhoneActions phone={lead.phone} name={lead.name} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}