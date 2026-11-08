import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from 'recharts';

export default function VisitsChart({ data }) {
  const empty = data.every((day) => day.count === 0);

  return (
    <section className="bg-[#faf6f1] border border-[#e3d9cc] p-4">
      <h3 className="font-heading text-lg text-[#5E1D1D] mb-3">צפיות ב־14 הימים האחרונים</h3>
      {empty ? (
        <p className="text-sm text-[#6a6158] py-10 text-center">אין נתוני פעילות עדיין.</p>
      ) : (
        <div className="h-48 w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#e3d9cc" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6a6158' }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, background: '#faf6f1', border: '1px solid #e3d9cc' }}
                labelStyle={{ color: '#6a6158' }}
                formatter={(value) => [value, 'צפיות']}
              />
              <Bar dataKey="count" fill="#5E1D1D" radius={[2, 2, 0, 0]} maxBarSize={26} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}