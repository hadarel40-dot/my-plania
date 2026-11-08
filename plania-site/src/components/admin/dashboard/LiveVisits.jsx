function ago(value) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return 'עכשיו';
  if (minutes < 60) return `לפני ${minutes} דק׳`;
  const hours = Math.round(minutes / 60);
  return `לפני ${hours} שעות`;
}

export default function LiveVisits({ rows }) {
  return (
    <section className="bg-[#faf6f1] border border-[#e3d9cc] p-4">
      <h3 className="font-heading text-lg text-[#5E1D1D]">כניסות בזמן אמת</h3>
      <p className="text-[11px] text-[#6a6158] mt-0.5">שש הצפיות האחרונות מהשעתיים האחרונות</p>
      {rows.length === 0 ? (
        <p className="text-sm text-[#6a6158] py-6 text-center">אין כניסות ממש עכשיו.</p>
      ) : (
        <ul className="mt-3 divide-y divide-[#e6dccd]">
          {rows.map((row) => (
            <li key={row.id} className="py-2">
              <div className="flex items-center justify-between gap-2 text-sm text-[#2a2622]">
                <span>{row.page}</span>
                <span className="text-[11px] text-[#6a6158] shrink-0">{ago(row.at)}</span>
              </div>
              <p className="text-[11px] text-[#6a6158] mt-0.5">
                {row.source} · {row.device}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}