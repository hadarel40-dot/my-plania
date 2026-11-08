import { shekel } from '@/lib/businessStats';

export default function MoneyTrend({ months }) {
  const max = Math.max(1, ...months.map((month) => month.value));

  return (
    <section className="bg-[#faf6f1] border border-[#e3d9cc] p-4">
      <h3 className="font-heading text-base text-[#2a2622]">הכנסות שנסגרו</h3>
      <p className="text-[11px] text-[#6a6158] mb-3">שווי עסקאות שנסגרו, שישה חודשים אחרונים</p>
      <div className="flex items-end justify-between gap-2 h-32">
        {months.map((month) => (
          <div key={month.key} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
            <span className="text-[9px] text-[#6a6158] leading-none">
              {month.value ? shekel(month.value) : ''}
            </span>
            <div
              className="w-full bg-[#5E1D1D]/85"
              style={{ height: `${Math.max((month.value / max) * 100, month.value ? 5 : 1)}%` }}
            />
            <span className="text-[10px] text-[#8a8079]">{month.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}