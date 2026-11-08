const CARDS = [
  { key: 'openCount', label: 'לידים פתוחים' },
  { key: 'closedThisMonth', label: 'נסגרו החודש' },
  { key: 'dueToday', label: 'משימות להיום' },
  { key: 'openValue', label: 'שווי לידים פתוחים' },
];

export default function LeadsSummary({ summary }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {CARDS.map((card) => {
        const isValue = card.key === 'openValue';
        const value = isValue
          ? `${summary.openValue.toLocaleString('he-IL')}₪`
          : summary[card.key];
        const alert = card.key === 'dueToday' && summary.dueToday > 0;

        return (
          <div
            key={card.key}
            className={`bg-[#faf6f1] border px-3 py-3 ${alert ? 'border-[#c0392b]' : 'border-[#e3d9cc]'}`}
          >
            <p className="text-[11px] text-[#6a6158]">{card.label}</p>
            <p
              className={`font-heading text-2xl mt-1 ${alert ? 'text-[#c0392b]' : 'text-[#5E1D1D]'}`}
            >
              {value}
            </p>
          </div>
        );
      })}
    </div>
  );
}