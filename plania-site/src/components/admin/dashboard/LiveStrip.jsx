import { RefreshCw } from 'lucide-react';

export default function LiveStrip({ visitors, lastUpdated, onRefresh, refreshing }) {
  const time = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <section className="bg-[#2a2622] text-[#f0e8df] px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full rounded-full bg-[#B5848E] opacity-70 animate-ping" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#B5848E]" />
        </span>
        <div>
          <p className="font-heading text-xl leading-none">{visitors} מבקרים</p>
          <p className="text-[11px] text-[#f0e8df]/65 mt-1">באתר ב־30 הדקות האחרונות</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        className="flex items-center gap-1.5 text-[11px] border border-[#f0e8df]/30 px-2.5 py-1.5 hover:bg-[#f0e8df]/10 disabled:opacity-50"
      >
        <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
        {time ? `עודכן ${time}` : 'רענון'}
      </button>
    </section>
  );
}