import useVisitStats from '@/hooks/useVisitStats';

export default function TrafficMini() {
  const { loading, today, liveVisitors, sources, daily } = useVisitStats();
  const week = (daily || []).slice(-7);
  const max = Math.max(1, ...week.map((day) => day.count));

  return (
    <section className="bg-[#faf6f1] border border-[#e3d9cc] p-4">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="font-heading text-base text-[#2a2622]">התנועה לאתר</h3>
        <p className="text-[11px] text-[#6a6158]">{liveVisitors} גולשות עכשיו</p>
      </div>
      {loading ? (
        <p className="text-xs text-[#6a6158]">טוען...</p>
      ) : (
        <>
          <p className="text-xs text-[#6a6158] mb-3">
            {today.views} צפיות ו־{today.sessions} ביקורים היום
          </p>
          <div className="flex items-end gap-1.5 h-16 mb-3">
            {week.map((day) => (
              <div key={day.label} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                <div
                  className="w-full bg-[#5E1D1D]/70"
                  style={{ height: `${Math.max((day.count / max) * 100, day.count ? 5 : 1)}%` }}
                />
                <span className="text-[9px] text-[#8a8079]">{day.label}</span>
              </div>
            ))}
          </div>
          {sources.length > 0 && (
            <p className="text-[11px] text-[#6a6158] leading-relaxed">
              מגיעות מ: {sources.slice(0, 3).map((source) => `${source.label} (${source.count})`).join(' · ')}
            </p>
          )}
        </>
      )}
    </section>
  );
}