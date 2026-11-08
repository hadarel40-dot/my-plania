const CARDS = [
  { key: 'views', label: 'צפיות היום' },
  { key: 'sessions', label: 'מבקרים היום' },
  { key: 'entries', label: 'כניסות לאתר' },
  { key: 'pagesPerSession', label: 'עמודים לביקור' },
];

export default function VisitStats({ today, totalViews }) {
  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {CARDS.map((card) => (
          <div key={card.key} className="bg-[#faf6f1] border border-[#e3d9cc] px-3 py-3">
            <p className="text-[11px] text-[#6a6158]">{card.label}</p>
            <p className="font-heading text-2xl mt-1 text-[#5E1D1D]">{today[card.key]}</p>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-[#6a6158] mt-2">{totalViews} צפיות בסך הכול מאז פתיחת האתר</p>
    </div>
  );
}