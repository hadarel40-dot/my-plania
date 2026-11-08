import { useState } from 'react';
import LeadsSummary from './LeadsSummary';
import FollowUpToday from './FollowUpToday';
import DashboardTab from './DashboardTab';
import { CalendarDays, ChevronDown, Loader2 } from 'lucide-react';

// The home screen: what needs doing right now, then the site numbers on demand.
export default function TodayTab({
  data,
  summary,
  followUps,
  actionItems,
  onOpenClient,
  onOpenProject,
  calendar = { state: 'unknown', text: '' },
  calendarBusy = false,
  onSyncCalendar,
}) {
  const [showStats, setShowStats] = useState(false);

  const open = (item) => {
    if (item.target.type === 'project') onOpenProject(item.target.record.id);
    else onOpenClient(item.target.record);
  };

  return (
    <div>
      <LeadsSummary summary={summary} />

      <section className="mb-6">
        <h2 className="font-heading text-lg text-[#2a2622] mb-2">
          דורש טיפול
          {actionItems.length > 0 && <span className="text-xs text-[#6a6158]"> ({actionItems.length})</span>}
        </h2>
        {actionItems.length === 0 ? (
          <p className="bg-[#faf6f1] border border-[#e3d9cc] px-4 py-3 text-xs text-[#6a6158]">
            הכל מטופל כרגע.
          </p>
        ) : (
          <div className="space-y-2">
            {actionItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => open(item)}
                className="w-full text-right bg-[#faf6f1] border-r-4 px-3 py-2.5 flex items-center justify-between gap-3 hover:bg-white transition-colors"
                style={{ borderRightColor: item.color }}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-[#2a2622] truncate">{item.name}</span>
                  <span className="block text-xs text-[#6a6158] truncate">{item.text}</span>
                </span>
                <span
                  className="shrink-0 text-[10px] px-2 py-0.5 rounded-full text-white"
                  style={{ background: item.color }}
                >
                  {item.tag}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <FollowUpToday leads={followUps} />

      <section className="mb-6 bg-[#faf6f1] border border-[#e3d9cc] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-heading text-base text-[#2a2622] flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-[#5E1D1D]" />
            יומן גוגל
          </p>
          <button
            type="button"
            onClick={onSyncCalendar}
            disabled={calendarBusy}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 border border-[#5E1D1D] text-[#5E1D1D] hover:bg-[#5E1D1D] hover:text-white transition-colors disabled:opacity-60"
          >
            {calendarBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {calendarBusy ? 'מעדכנת...' : 'סנכרון הכל ליומן'}
          </button>
        </div>
        <p className={`text-xs mt-1.5 ${calendar.state === 'error' || calendar.state === 'off' ? 'text-[#a33]' : 'text-[#6a6158]'}`}>
          {calendar.text ||
            'תאריכי מעקב, מועדי מסירה ומשימות עם תאריך נכנסים ליומן אוטומטית. שישי ושבת עוברים לראשון.'}
        </p>
      </section>

      <button
        type="button"
        onClick={() => setShowStats((value) => !value)}
        className="w-full flex items-center justify-between gap-2 bg-[#e6dccd] px-4 py-3 text-sm font-bold text-[#5E1D1D]"
      >
        <span>סטטיסטיקת האתר</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${showStats ? 'rotate-180' : ''}`} />
      </button>
      {showStats && (
        <div className="mt-3">
          <DashboardTab data={data} />
        </div>
      )}
    </div>
  );
}
