"use client";
import { useEffect, useMemo, useState } from "react";
import type { IgAccount } from "@/lib/studio/instagram";
import { formatDate, num, studioCall } from "@/lib/studio/client";
import { Btn, Loading, Note, PageHead, Panel, Tag } from "@/components/studio/ui";

type Acc = (IgAccount & { ok: true }) | { ok: false; error: string };
interface Data { configured: boolean; accounts: Acc[]; history: { date: string; account: string; followers: number }[] }

export default function PerformancePage() {
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [pick, setPick] = useState(0);
  const load = async () => {
    setBusy(true);
    try { setData(await studioCall<Data>("instagram")); setError(""); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  useEffect(() => { load(); }, []);
  const acc = data?.accounts[pick];

  return (
    <>
      <PageHead title="ביצועים" sub="שמירות ושיתופים לפני לייקים: הם מה שאומר לאינסטגרם שהתוכן שווה הפצה.">
        {data && data.accounts.length > 1 && data.accounts.map((a, i) => a.ok && <Btn key={a.profile.username} variant={pick === i ? "solid" : "line"} onClick={() => setPick(i)}>@{a.profile.username}</Btn>)}
        <Btn variant="line" busy={busy} onClick={load}>רענון</Btn>
      </PageHead>
      {busy && !data && <Loading>קוראת מאינסטגרם...</Loading>}
      {error && <Note tone="bad">{error}</Note>}
      {data && !data.configured && (
        <Panel title="אינסטגרם עוד לא מחובר">
          <p className="text-sm leading-relaxed text-[#6A6158]">צריך להגדיר בשרת את INSTAGRAM_ACCESS_TOKENS (טוקן לכל חשבון, עם ההרשאות instagram_business_basic ו-instagram_business_manage_insights). ההוראות ב-README של העורך, בפרק "סטודיו התוכן".</p>
        </Panel>
      )}
      {acc && !acc.ok && <Note tone="bad">החשבון לא נקרא: {acc.error}</Note>}
      {acc?.ok && <AccountView acc={acc} history={(data?.history ?? []).filter((h) => h.account === acc.profile.username)} />}
    </>
  );
}

function FollowersLine({ history }: { history: { date: string; followers: number }[] }) {
  if (history.length < 2) return <p className="text-xs text-[#6A6158]">הגרף מתמלא מהיום: כל יום שנכנסים לעמוד הזה נשמרת נקודה.</p>;
  const values = history.map((h) => h.followers);
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * 300).toFixed(1)},${(62 - ((v - min) / span) * 54).toFixed(1)}`).join(" ");
  const change = values[values.length - 1] - values[0];
  return (
    <div>
      <p className="mb-1 flex justify-between text-[11px] text-[#6A6158]"><span>עוקבים לאורך זמן</span><span className={change >= 0 ? "font-semibold text-[#2F4A3A]" : "font-semibold text-[#A33A2B]"}>{change >= 0 ? "+" : ""}{change} מאז {formatDate(history[0].date)}</span></p>
      <svg viewBox="0 0 300 70" className="h-[70px] w-full" preserveAspectRatio="none" role="img" aria-label="גרף עוקבים"><polyline fill="none" stroke="#5E1D1D" strokeWidth="2" points={pts} /></svg>
    </div>
  );
}

function AccountView({ acc, history }: { acc: IgAccount; history: { date: string; followers: number }[] }) {
  const value = (m: IgAccount["media"][number]) => acc.insightsAvailable
    ? (m.insights?.saved ?? 0) * 2 + (m.insights?.shares ?? 0) * 2 + (m.comments_count ?? 0)
    : (m.comments_count ?? 0) * 2 + (m.like_count ?? 0) / 10;
  const posts = [...acc.media].sort((a, b) => value(b) - value(a));
  // ימים שבהם העוקבים עלו, ליד מה שפורסם ביומיים שלפני. מתאם בזמן, לא הוכחה
  const gains = useMemo(() => {
    const out: { date: string; delta: number; near: typeof acc.media }[] = [];
    for (let i = 1; i < history.length; i++) {
      const delta = history[i].followers - history[i - 1].followers;
      if (delta <= 0) continue;
      const end = history[i].date;
      const start = new Date(new Date(`${end}T12:00:00`).getTime() - 2 * 86_400_000).toISOString().slice(0, 10);
      out.push({ date: end, delta, near: acc.media.filter((m) => m.timestamp.slice(0, 10) >= start && m.timestamp.slice(0, 10) <= end) });
    }
    return out.reverse().slice(0, 8);
  }, [history, acc.media]);
  const cell = (v?: number) => (acc.insightsAvailable ? num(v) : "אין הרשאה");

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        {!acc.insightsAvailable && <Note tone="bad">לטוקן של החשבון הזה אין הרשאת תובנות (instagram_business_manage_insights), אז אין כאן שמירות, שיתופים וחשיפה. מוצגים רק לייקים ותגובות.</Note>}
        <Panel title="מה עבד, לפי שמירות ושיתופים">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead><tr className="border-b border-[#D9CFC2] text-right text-[11px] text-[#6A6158]">{["פוסט", "שמירות", "שיתופים", "חשיפה", "תגובות", "לייקים"].map((h) => <th key={h} className="py-1.5 pl-2 font-semibold">{h}</th>)}</tr></thead>
              <tbody>
                {posts.map((m) => (
                  <tr key={m.id} className="border-b border-[#D9CFC2]/60 align-top">
                    <td className="max-w-[260px] py-2 pl-2">
                      <a href={m.permalink} target="_blank" rel="noopener noreferrer" className="line-clamp-2 hover:text-[#5E1D1D]">{(m.caption ?? "בלי כיתוב").split("\n")[0]}</a>
                      <span className="text-[11px] text-[#6A6158]">{formatDate(m.timestamp)} · {m.media_product_type === "REELS" ? "ריל" : m.media_type === "CAROUSEL_ALBUM" ? "קרוסלה" : "פוסט"}</span>
                    </td>
                    <td className="pl-2 font-semibold">{cell(m.insights?.saved)}</td>
                    <td className="pl-2 font-semibold">{cell(m.insights?.shares)}</td>
                    <td className="pl-2">{cell(m.insights?.reach)}</td>
                    <td className="pl-2">{num(m.comments_count)}</td>
                    <td className="text-[#6A6158]">{num(m.like_count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
      <div className="space-y-5">
        <Panel title={`@${acc.profile.username}`}>
          <p className="s-serif text-3xl text-[#5E1D1D]">{num(acc.profile.followers_count)}</p>
          <p className="mb-3 text-xs text-[#6A6158]">עוקבים · {num(acc.profile.media_count)} פוסטים</p>
          <FollowersLine history={history} />
        </Panel>
        <Panel title="מה הביא עוקבים">
          <p className="mb-2 text-[11px] text-[#6A6158]">ימים שבהם העוקבים עלו, ליד מה שפורסם ביומיים שלפני. זה מתאם בזמן, לא הוכחה.</p>
          {gains.length === 0 ? <p className="text-sm text-[#6A6158]">עוד אין מספיק ימים בהיסטוריה.</p> : (
            <ul className="space-y-2 text-sm">
              {gains.map((g) => (
                <li key={g.date} className="border-b border-dashed border-[#D9CFC2] pb-2">
                  <span className="font-semibold">{formatDate(g.date)}</span> <Tag tone="green">+{g.delta}</Tag>
                  {g.near.length ? g.near.map((m) => <span key={m.id} className="block text-xs text-[#6A6158]">{(m.caption ?? "").split("\n")[0].slice(0, 70)}</span>) : <span className="block text-xs text-[#6A6158]">לא פורסם כלום ביומיים שלפני</span>}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
