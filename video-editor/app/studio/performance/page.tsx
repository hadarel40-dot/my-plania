"use client";
import { useEffect, useMemo, useState } from "react";
import type { IgAccount } from "@/lib/studio/instagram";
import { usualAndBest } from "@/lib/studio/metrics";
import { formatDate, num, studioCall } from "@/lib/studio/client";
import { LearnPanel } from "@/components/studio/learn-panel";
import { Btn, Label, Loading, Note, PageHead, Panel, StatTile, Tag, Title } from "@/components/studio/ui";

type Acc = (IgAccount & { ok: true }) | { ok: false; error: string };
interface Data { configured: boolean; accounts: Acc[]; history: { date: string; account: string; followers: number }[] }

export default function PerformancePage() {
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [pick, setPick] = useState(0);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  // התוצאה האחרונה נשמרת בדפדפן ומוצגת מיד, והרענון רץ ברקע
  const load = async () => {
    setBusy(true);
    try {
      const fresh = await studioCall<Data>("instagram");
      setData(fresh); setError(""); setCachedAt(null);
      try { localStorage.setItem("studio-ig-cache", JSON.stringify({ at: new Date().toISOString(), data: fresh })); } catch { /* מצב פרטי */ }
    } catch (e) {
      setError(`לא הצלחתי לקרוא מאינסטגרם עכשיו: ${(e as Error).message}`);
    } finally { setBusy(false); }
  };
  useEffect(() => {
    try {
      const c = JSON.parse(localStorage.getItem("studio-ig-cache") ?? "null");
      if (c?.data) { setData(c.data); setCachedAt(c.at); }
    } catch { /* אין שמור */ }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const acc = data?.accounts[pick];

  return (
    <>
      <PageHead label="למידה" title="כל" accent="התוצאות" sub="שמירות ושיתופים לפני לייקים: הם מה שאומר לאינסטגרם שהתוכן שווה הפצה.">
        {data && data.accounts.length > 1 && data.accounts.map((a, i) => a.ok && <Btn key={a.profile.username} variant={pick === i ? "solid" : "line"} onClick={() => setPick(i)}>@{a.profile.username}</Btn>)}
        <Btn variant="line" busy={busy} onClick={load}>רענון</Btn>
      </PageHead>
      {busy && !data && <Loading>קוראת מאינסטגרם... (עד חצי דקה)</Loading>}
      {cachedAt && <p className="mb-3 text-[12px] text-[#6F675C]">{busy ? "מתעדכן... " : ""}מוצגים הנתונים מ-{new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(cachedAt))}.</p>}
      {error && <Note tone="bad">{error}</Note>}
      {data && !data.configured && (
        <Panel title="אינסטגרם עוד לא מחובר">
          <p className="text-sm leading-relaxed text-[#6F675C]">צריך להגדיר ב-Vercel את INSTAGRAM_ACCESS_TOKENS: הטוקן שמפיקים באפליקציה ב-Meta (API setup with Unified login), עם ההרשאה instagram_manage_insights. ההוראות ב-README של העורך, בפרק "סטודיו התוכן".</p>
        </Panel>
      )}
      <div className="mb-4"><LearnPanel /></div>
      {acc && !acc.ok && <Note tone="bad">החשבון לא נקרא: {acc.error}</Note>}
      {acc?.ok && <AccountView acc={acc} history={(data?.history ?? []).filter((h) => h.account === acc.profile.username)} />}
    </>
  );
}

function FollowersLine({ history }: { history: { date: string; followers: number }[] }) {
  if (history.length < 2) return <p className="text-xs text-[#6F675C]">הגרף מתמלא מהיום: כל יום שנכנסים לעמוד הזה נשמרת נקודה.</p>;
  const values = history.map((h) => h.followers);
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * 300).toFixed(1)},${(62 - ((v - min) / span) * 54).toFixed(1)}`).join(" ");
  const change = values[values.length - 1] - values[0];
  return (
    <div>
      <p className="mb-1 flex justify-between text-[11px] text-[#6F675C]"><span>עוקבים לאורך זמן</span><span className={change >= 0 ? "font-semibold text-[#3E6B4F]" : "font-semibold text-[#A3402F]"}>{change >= 0 ? "+" : ""}{change} מאז {formatDate(history[0].date)}</span></p>
      <svg viewBox="0 0 300 70" className="h-[70px] w-full" preserveAspectRatio="none" role="img" aria-label="גרף עוקבים"><polyline fill="none" stroke="#1F1B16" strokeWidth="2" points={pts} /></svg>
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
  const m = usualAndBest(acc.media, acc.insightsAvailable);
  const metric = (p: IgAccount["media"][number]) => (acc.insightsAvailable ? p.insights?.reach : p.like_count);
  // כותרת לפי הנתונים: השבוע האחרון מול שמונת השבועות שלפניו
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const lastWeek = acc.media.filter((p) => p.timestamp >= weekAgo).reduce((s, p) => s + (metric(p) ?? 0), 0);
  const earlier = Array.from({ length: 8 }, (_, w) => acc.media.filter((p) => {
    const t = Date.parse(p.timestamp); const end = Date.now() - (w + 1) * 7 * 86_400_000;
    return t < end && t >= end - 7 * 86_400_000;
  }).reduce((s, p) => s + (metric(p) ?? 0), 0));
  const best = lastWeek > 0 && earlier.every((v) => lastWeek > v);
  const recent = [...acc.media].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 6);
  // מה הכי נשלח השבוע: שליחות ביחס להגעה, האות שאינסטגרם נותנת לו הכי הרבה משקל להפצה לא-עוקבים
  const sharesRate = (p: IgAccount["media"][number]) => ((p.insights?.reach ?? 0) > 0 ? (p.insights?.shares ?? 0) / p.insights!.reach! : 0);
  const weekPosts = acc.media.filter((p) => p.timestamp >= weekAgo);
  // האם אינסטגרם החזירה בכלל את מספר השליחות (אפס אמיתי), או שהנתון חסר
  const sharesRead = weekPosts.some((p) => typeof p.insights?.shares === "number");
  const topShared = acc.insightsAvailable ? acc.media.filter((p) => p.timestamp >= weekAgo && (p.insights?.shares ?? 0) > 0).sort((a, b) => sharesRate(b) - sharesRate(a))[0] : undefined;

  return (
    <>
    <section className="mb-5">
      <Label className="mb-1">תוצאות · @{acc.profile.username}</Label>
      <Title size="xl" accent={best ? "הכי טוב שלך" : "האחרון"}>{best ? "השבוע שעבר היה השבוע" : "ככה הלך השבוע"}</Title>
      <p className="mt-1.5 text-sm text-[#4E473E]">רילס ופוסטים אחרונים מאינסטגרם. {m?.metricLabel === "לייקים" ? "בלי הרשאת תובנות, החישוב לפי לייקים." : "החשיפה הרגילה היא החציון של הפוסטים האחרונים."}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <StatTile label={m?.metricLabel === "לייקים" ? "הלייקים הרגילים שלך" : "החשיפה הרגילה שלך"} value={m ? num(m.usual) : "אין נתון"} />
        <StatTile label="הכי טוב עכשיו" value={m?.best ? num(m.bestValue) : "אין נתון"} chip={m?.ratio && m.ratio >= 1.5 ? `פי ${m.ratio} מהרגיל` : undefined} hint={m?.best ? (m.best.caption ?? "").split("\n")[0].slice(0, 40) : "אין פוסטים בשבועיים האחרונים"} />
        <StatTile label="הכי נשלח השבוע" value={!acc.insightsAvailable ? "אין הרשאה" : topShared ? `${num(topShared.insights?.shares)} שליחות` : weekPosts.length === 0 ? "אין פוסטים השבוע" : sharesRead ? "0 שליחות השבוע" : "השליחות לא נקראו"}
          chip={topShared ? `${(sharesRate(topShared) * 100).toFixed(1)} לכל 100 שהגיעו` : undefined}
          hint={topShared ? (topShared.caption ?? "").split("\n")[0].slice(0, 40) : weekPosts.length && !sharesRead ? "אינסטגרם לא החזירה את מספר השליחות לפוסטים של השבוע" : "שליחה בהודעה היא האות החזק ביותר להגעה לאנשים חדשים"} />
      </div>
      <Panel label="רילס אחרונים" className="mt-3">
        <ul className="divide-y divide-[#ECE7DE]">
          {recent.map((p) => (
            <li key={p.id} className="py-2">
              <a href={p.permalink} target="_blank" rel="noopener noreferrer" className="block font-semibold leading-snug hover:underline">{(p.caption ?? "בלי כיתוב").split("\n")[0].slice(0, 90)}</a>
              <span className="text-[12px] text-[#6F675C]">{formatDate(p.timestamp)} · {num(metric(p))} {m?.metricLabel ?? ""}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </section>
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        {!acc.insightsAvailable && <Note tone="bad">לטוקן של החשבון הזה אין הרשאת תובנות (instagram_manage_insights), אז אין כאן שמירות, שיתופים וחשיפה. מוצגים רק לייקים ותגובות.</Note>}
        <Panel title="מה עבד, לפי שמירות ושיתופים">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead><tr className="border-b border-[#E2DACD] text-right text-[11px] text-[#6F675C]">{["פוסט", "שמירות", "שיתופים", "חשיפה", "תגובות", "לייקים"].map((h) => <th key={h} className="py-1.5 pl-2 font-semibold">{h}</th>)}</tr></thead>
              <tbody>
                {posts.map((m) => (
                  <tr key={m.id} className="border-b border-[#E2DACD]/60 align-top">
                    <td className="max-w-[260px] py-2 pl-2">
                      <a href={m.permalink} target="_blank" rel="noopener noreferrer" className="line-clamp-2 hover:text-[#1F1B16]">{(m.caption ?? "בלי כיתוב").split("\n")[0]}</a>
                      <span className="text-[11px] text-[#6F675C]">{formatDate(m.timestamp)} · {m.media_product_type === "REELS" ? "ריל" : m.media_type === "CAROUSEL_ALBUM" ? "קרוסלה" : "פוסט"}</span>
                    </td>
                    <td className="pl-2 font-semibold">{cell(m.insights?.saved)}</td>
                    <td className="pl-2 font-semibold">{cell(m.insights?.shares)}</td>
                    <td className="pl-2">{cell(m.insights?.reach)}</td>
                    <td className="pl-2">{num(m.comments_count)}</td>
                    <td className="text-[#6F675C]">{num(m.like_count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
      <div className="space-y-5">
        <Panel title={`@${acc.profile.username}`}>
          <p className="s-serif text-3xl text-[#1F1B16]">{num(acc.profile.followers_count)}</p>
          <p className="mb-3 text-xs text-[#6F675C]">עוקבים · {num(acc.profile.media_count)} פוסטים</p>
          <FollowersLine history={history} />
        </Panel>
        <Panel title="מה הביא עוקבים">
          <p className="mb-2 text-[11px] text-[#6F675C]">ימים שבהם העוקבים עלו, ליד מה שפורסם ביומיים שלפני. זה מתאם בזמן, לא הוכחה.</p>
          {gains.length === 0 ? <p className="text-sm text-[#6F675C]">עוד אין מספיק ימים בהיסטוריה.</p> : (
            <ul className="space-y-2 text-sm">
              {gains.map((g) => (
                <li key={g.date} className="border-b border-dashed border-[#E2DACD] pb-2">
                  <span className="font-semibold">{formatDate(g.date)}</span> <Tag tone="green">+{g.delta}</Tag>
                  {g.near.length ? g.near.map((m) => <span key={m.id} className="block text-xs text-[#6F675C]">{(m.caption ?? "").split("\n")[0].slice(0, 70)}</span>) : <span className="block text-xs text-[#6F675C]">לא פורסם כלום ביומיים שלפני</span>}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
    </>
  );
}
