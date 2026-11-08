import { useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import KpiGrid from './overview/KpiGrid';
import PipelineFunnel from './overview/PipelineFunnel';
import MoneyTrend from './overview/MoneyTrend';
import TrafficMini from './overview/TrafficMini';
import { buildBusinessStats } from '@/lib/businessStats';

// The whole business on one screen: money, pipeline, projects, site traffic and what is pending.
export default function OverviewTab({ data, actionItems, onOpenClient, onOpenProject, onNavigate }) {
  const stats = useMemo(() => buildBusinessStats(data), [data]);

  const open = (item) =>
    item.target.type === 'project'
      ? onOpenProject(item.target.record.id)
      : onOpenClient(item.target.record);

  return (
    <div className="space-y-5">
      <KpiGrid stats={stats} />

      <div className="grid gap-4 md:grid-cols-2">
        <PipelineFunnel funnel={stats.funnel} />
        <MoneyTrend months={stats.months} />
      </div>

      <TrafficMini />

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-heading text-lg text-[#2a2622]">
            דורש טיפול עכשיו
            {actionItems.length > 0 && <span className="text-xs text-[#6a6158]"> ({actionItems.length})</span>}
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('today')}
            className="flex items-center gap-1 text-xs font-bold text-[#5E1D1D]"
          >
            לכל המשימות
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        </div>
        {actionItems.length === 0 ? (
          <p className="bg-[#faf6f1] border border-[#e3d9cc] px-4 py-3 text-xs text-[#6a6158]">
            הכל מטופל כרגע.
          </p>
        ) : (
          <div className="space-y-2">
            {actionItems.slice(0, 4).map((item) => (
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
    </div>
  );
}