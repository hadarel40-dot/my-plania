export default function PathList({ title, rows, hint }) {
  const max = rows[0]?.count || 1;

  return (
    <section className="bg-[#faf6f1] border border-[#e3d9cc] p-4">
      <h3 className="font-heading text-lg text-[#5E1D1D]">{title}</h3>
      {hint && <p className="text-[11px] text-[#6a6158] mt-0.5">{hint}</p>}
      {rows.length === 0 ? (
        <p className="text-sm text-[#6a6158] py-6 text-center">אין נתונים עדיין.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((row) => (
            <li key={row.raw}>
              <div className="flex items-center justify-between text-sm text-[#2a2622]">
                <span>{row.label}</span>
                <span className="text-[#6a6158] tabular-nums">{row.count}</span>
              </div>
              <div className="h-[3px] bg-[#e6dccd] mt-1">
                <div className="h-full bg-[#5E1D1D]" style={{ width: `${Math.max(6, (row.count / max) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}