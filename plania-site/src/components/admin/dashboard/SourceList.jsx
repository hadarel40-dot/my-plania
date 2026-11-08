export default function SourceList({ rows }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);

  return (
    <section className="bg-[#faf6f1] border border-[#e3d9cc] p-4">
      <h3 className="font-heading text-lg text-[#5E1D1D]">מאיפה מגיעים</h3>
      <p className="text-[11px] text-[#6a6158] mt-0.5">מקור הכניסה לאתר ב־14 הימים האחרונים</p>
      {rows.length === 0 ? (
        <p className="text-sm text-[#6a6158] py-6 text-center">אין נתונים עדיין.</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {rows.map((row) => {
            const share = total ? Math.round((row.count / total) * 100) : 0;
            return (
              <li key={row.raw}>
                <div className="flex items-center justify-between text-sm text-[#2a2622]">
                  <span>{row.label}</span>
                  <span className="text-[#6a6158] tabular-nums text-xs">
                    {row.count} · {share}%
                  </span>
                </div>
                <div className="h-[3px] bg-[#e6dccd] mt-1">
                  <div className="h-full bg-[#B5848E]" style={{ width: `${Math.max(6, share)}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}