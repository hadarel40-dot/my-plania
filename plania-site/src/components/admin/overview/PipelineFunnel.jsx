import { shekel } from '@/lib/businessStats';

const COLORS = {
  'ליד חדש': '#5E1D1D',
  בשיחה: '#8a5a2b',
  'הצעת מחיר נשלחה': '#B5848E',
  נסגר: '#4A6355',
  'לקוח פעיל': '#2a2622',
};

export default function PipelineFunnel({ funnel }) {
  const max = Math.max(1, ...funnel.map((row) => row.count));

  return (
    <section className="bg-[#faf6f1] border border-[#e3d9cc] p-4">
      <h3 className="font-heading text-base text-[#2a2622]">מסלול הלקוח</h3>
      <p className="text-[11px] text-[#6a6158] mb-3">כמה פניות בכל שלב ומה השווי שלהן</p>
      <ul className="space-y-2.5">
        {funnel.map((row) => (
          <li key={row.status}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-[#2a2622]">{row.status}</span>
              <span className="text-[#6a6158]">
                {row.count} · {shekel(row.value)}
              </span>
            </div>
            <div className="h-2 bg-[#e6dccd]">
              <div
                className="h-full"
                style={{
                  width: `${(row.count / max) * 100}%`,
                  background: COLORS[row.status] || '#8a8079',
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}