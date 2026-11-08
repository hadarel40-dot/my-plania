import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { shekel } from '@/lib/businessStats';

function Card({ label, value, hint, accent }) {
  return (
    <div className="bg-[#faf6f1] border border-[#e3d9cc] px-3 py-3">
      <p className="text-[11px] text-[#6a6158]">{label}</p>
      <p className={`font-heading text-2xl mt-0.5 ${accent ? 'text-[#5E1D1D]' : 'text-[#2a2622]'}`}>{value}</p>
      {hint && <p className="text-[10px] text-[#8a8079] mt-0.5">{hint}</p>}
    </div>
  );
}

export default function KpiGrid({ stats }) {
  const delta = stats.incomeThisMonth - stats.incomeLastMonth;
  const positive = delta >= 0;

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card
          label="הכנסות החודש"
          value={shekel(stats.incomeThisMonth)}
          hint={`${stats.wonThisMonth} עסקאות שנסגרו`}
          accent
        />
        <Card
          label="בצינור עכשיו"
          value={shekel(stats.pipelineValue)}
          hint={`${stats.pipelineCount} פניות פתוחות`}
          accent
        />
        <Card
          label="פניות החודש"
          value={stats.leadsThisMonth}
          hint={`${stats.leadsLastMonth} בחודש שעבר · סגירה ${stats.winRate}%`}
        />
        <Card
          label="פרויקטים פעילים"
          value={stats.activeProjects}
          hint={
            stats.overdue > 0
              ? `${stats.overdue} באיחור · ${stats.dueSoon} למסירה השבוע`
              : `${stats.dueSoon} למסירה בשבוע הקרוב`
          }
        />
        <Card label="יתרה לגבייה" value={shekel(stats.receivables)} hint="מפרויקטים פתוחים" />
        <Card
          label="שאלונים ממתינים"
          value={stats.questionnairesNew}
          hint={`${stats.quotesWaiting} הצעות מחכות לתשובה`}
        />
      </div>
      <p
        className={`flex items-center gap-1 text-[11px] mt-2 ${
          positive ? 'text-[#4A6355]' : 'text-[#a33]'
        }`}
      >
        {positive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
        {positive ? '+' : '-'}
        {shekel(Math.abs(delta))} לעומת החודש שעבר
      </p>
    </div>
  );
}