import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import InstagramAccount from './InstagramAccount';
import { SITE_ORIGIN } from '@/lib/projects';
import { sourceName } from '@/lib/attribution';
import { visitSourceLabel } from '@/lib/visitTracking';
import { formatDateTime } from '@/lib/formatDate';
import { Check, Copy } from 'lucide-react';

const DAY = 86400000;
const WON_STATUSES = ['נסגר', 'לקוח פעיל'];

const TRACKING_LINKS = [
  { key: 'bio', label: 'הקישור בביו', path: '/', content: 'bio' },
  { key: 'story', label: 'סטורי', path: '/', content: 'story' },
  { key: 'reel', label: 'ריל', path: '/', content: 'reel' },
  { key: 'post', label: 'פוסט או הערה מוצמדת', path: '/', content: 'post' },
  { key: 'business', label: 'דף העסקים', path: '/business', content: 'business' },
  { key: 'travel', label: 'דף הטיולים', path: '/travel', content: 'travel' },
];

const trackingUrl = ({ path, content }) =>
  `${SITE_ORIGIN}${path}?utm_source=instagram&utm_medium=social&utm_content=${content}`;

function countBy(rows, keyFn) {
  const map = new Map();
  rows.forEach((row) => {
    const key = keyFn(row);
    map.set(key, (map.get(key) || 0) + 1);
  });
  return [...map.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

function Card({ label, value, hint, accent }) {
  return (
    <div className="bg-[#faf6f1] border border-[#e3d9cc] px-3 py-3">
      <p className="text-[11px] text-[#6a6158]">{label}</p>
      <p className={`font-heading text-2xl mt-1 ${accent ? 'text-[#5E1D1D]' : 'text-[#2a2622]'}`}>{value}</p>
      {hint && <p className="text-[10px] text-[#8a8079] mt-0.5">{hint}</p>}
    </div>
  );
}

function Bars({ rows, highlight }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <ul className="space-y-1.5">
      {rows.map((row) => (
        <li key={row.label} className="flex items-center gap-2 text-xs">
          <span className={`w-24 shrink-0 truncate ${row.label === highlight ? 'font-bold text-[#5E1D1D]' : 'text-[#2a2622]'}`}>
            {row.label}
          </span>
          <span className="flex-1 h-2 bg-[#e6dccd]">
            <span
              className="block h-full"
              style={{ width: `${(row.count / max) * 100}%`, background: row.label === highlight ? '#5E1D1D' : '#8a8079' }}
            />
          </span>
          <span className="w-8 text-left text-[#6a6158]">{row.count}</span>
        </li>
      ))}
    </ul>
  );
}

function CopyRow({ link }) {
  const [copied, setCopied] = useState(false);
  const url = trackingUrl(link);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('העתקת הקישור', url);
    }
  };
  return (
    <li className="flex items-center justify-between gap-3 bg-white border border-[#e3d9cc] px-3 py-2">
      <span className="min-w-0">
        <span className="block text-sm text-[#2a2622]">{link.label}</span>
        <span className="block text-[10px] text-[#8a8079] truncate" dir="ltr">
          {url}
        </span>
      </span>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 flex items-center gap-1.5 text-xs font-bold px-3 py-2 border border-[#5E1D1D] text-[#5E1D1D] hover:bg-[#5E1D1D] hover:text-white transition-colors"
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? 'הועתק' : 'העתקה'}
      </button>
    </li>
  );
}

// Everything that comes from social: how many arrive, who turns into a lead, and the account.
export default function SocialTab({ data, onOpenClient }) {
  const [range, setRange] = useState(30);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const since = new Date(Date.now() - 30 * DAY).toISOString();
    base44.entities.SiteVisit.filter(
      { created_date: { $gte: since }, is_entry: true },
      { sort: 'created_date', limit: 1000 }
    )
      .then((page) => {
        if (active) setVisits(page.items || []);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => {
    const sinceMs = Date.now() - range * DAY;
    const inRange = (row) => new Date(row.created_date).getTime() >= sinceMs;
    const entries = visits.filter(inRange);
    const igVisits = entries.filter((row) => row.source === 'instagram');
    const questionnaires = [
      ...data.travel.map((q) => ({ ...q, __kind: 'שאלון טיול' })),
      ...data.business.map((q) => ({ ...q, __kind: 'שאלון עסק' })),
    ];
    const igLeads = data.leads.filter((lead) => lead.source === 'instagram' && inRange(lead));
    const igQuestionnaires = questionnaires.filter((q) => q.source === 'instagram' && inRange(q));
    const won = igLeads.filter((lead) => WON_STATUSES.includes(lead.status));
    const wonValue = won.reduce((sum, lead) => sum + (Number(lead.deal_value) || 0), 0);
    const inquiries = igLeads.length + igQuestionnaires.length;

    const campaigns = new Map();
    igVisits.forEach((row) => {
      const key = row.campaign || 'ללא קישור מעקב';
      const item = campaigns.get(key) || { label: key, visits: 0, inquiries: 0 };
      item.visits += 1;
      campaigns.set(key, item);
    });
    [...igLeads, ...igQuestionnaires].forEach((row) => {
      const key = row.campaign || 'ללא קישור מעקב';
      const item = campaigns.get(key) || { label: key, visits: 0, inquiries: 0 };
      item.inquiries += 1;
      campaigns.set(key, item);
    });

    const recent = [
      ...igLeads.map((lead) => ({ id: lead.id, record: lead, name: lead.name, kind: 'ליד', campaign: lead.campaign, at: lead.created_date })),
      ...igQuestionnaires.map((q) => ({ id: q.id, record: q, name: q.name, kind: q.__kind, campaign: q.campaign, at: q.created_date })),
    ].sort((a, b) => new Date(b.at) - new Date(a.at));

    return {
      entries,
      igVisits,
      inquiries,
      wonCount: won.length,
      wonValue,
      conversion: igVisits.length ? Math.round((inquiries / igVisits.length) * 1000) / 10 : 0,
      sources: countBy(entries, visitSourceLabel).slice(0, 7),
      campaigns: [...campaigns.values()].sort((a, b) => b.visits + b.inquiries - (a.visits + a.inquiries)),
      recent,
    };
  }, [visits, range, data.leads, data.travel, data.business]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-heading text-lg text-[#2a2622]">מה מגיע מאינסטגרם</h2>
        <div className="flex gap-1.5">
          {[7, 30].map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => setRange(days)}
              className={`text-xs px-3 py-1.5 border transition-colors ${
                range === days
                  ? 'bg-[#5E1D1D] text-white border-[#5E1D1D]'
                  : 'bg-[#faf6f1] text-[#2a2622] border-[#d9cfc2] hover:border-[#5E1D1D]'
              }`}
            >
              {days} ימים
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-[#6a6158]">טוענת כניסות...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Card label="כניסות מאינסטגרם" value={stats.igVisits.length} hint={`מתוך ${stats.entries.length} כניסות לאתר`} accent />
            <Card label="פניות משם" value={stats.inquiries} hint="לידים ושאלונים" accent />
            <Card label="אחוז שהפכו לפנייה" value={`${stats.conversion}%`} hint="פניות חלקי כניסות" />
            <Card
              label="עסקאות שנסגרו"
              value={stats.wonCount}
              hint={stats.wonValue ? `${stats.wonValue.toLocaleString('he-IL')}₪` : 'לפי שווי העסקה בליד'}
            />
          </div>

          <section className="bg-[#faf6f1] border border-[#e3d9cc] px-4 py-4">
            <h3 className="font-heading text-base text-[#2a2622] mb-3">מאיפה מגיעים</h3>
            {stats.sources.length === 0 ? (
              <p className="text-xs text-[#6a6158]">עוד אין כניסות בתקופה הזאת.</p>
            ) : (
              <Bars rows={stats.sources} highlight={sourceName('instagram')} />
            )}
          </section>

          <section className="bg-[#faf6f1] border border-[#e3d9cc] px-4 py-4">
            <h3 className="font-heading text-base text-[#2a2622] mb-1">איזה קישור עובד</h3>
            <p className="text-[11px] text-[#6a6158] mb-3">רק כניסות שהגיעו דרך הקישורים עם המעקב שלמטה מקבלות שם.</p>
            {stats.campaigns.length === 0 ? (
              <p className="text-xs text-[#6a6158]">עוד אין נתונים. אחרי הכניסה הראשונה מאינסטגרם הם יופיעו כאן.</p>
            ) : (
              <ul className="divide-y divide-[#efe7dc]">
                {stats.campaigns.map((item) => (
                  <li key={item.label} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-[#2a2622]">{item.label}</span>
                    <span className="text-xs text-[#6a6158]">
                      {item.visits} כניסות · {item.inquiries} פניות
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {stats.recent.length > 0 && (
            <section>
              <h3 className="font-heading text-base text-[#2a2622] mb-2">פניות שהגיעו מאינסטגרם</h3>
              <div className="space-y-2">
                {stats.recent.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onOpenClient(item.record)}
                    className="w-full text-right bg-[#faf6f1] border-r-4 border-[#5E1D1D] px-3 py-2.5 hover:bg-white transition-colors"
                  >
                    <span className="block text-sm font-bold text-[#2a2622]">{item.name}</span>
                    <span className="block text-xs text-[#6a6158]">
                      {item.kind}
                      {item.campaign ? ` · ${item.campaign}` : ''} · {formatDateTime(item.at)}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <section className="bg-[#faf6f1] border border-[#e3d9cc] px-4 py-4">
        <h3 className="font-heading text-base text-[#2a2622] mb-1">קישורים עם מעקב</h3>
        <p className="text-[11px] text-[#6a6158] mb-3">
          כל מקום באינסטגרם מקבל קישור משלו, וככה רואים מה מביא אנשים. את הקישור של הביו מדביקים בהגדרות הפרופיל.
        </p>
        <ul className="space-y-2">
          {TRACKING_LINKS.map((link) => (
            <CopyRow key={link.key} link={link} />
          ))}
        </ul>
      </section>

      <InstagramAccount />
    </div>
  );
}
