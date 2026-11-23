"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, RefreshCw } from "lucide-react";
import { ACCOUNTS, CONTENT_TYPES, NICHES, WEEK_GOALS, labelOf, type Account, type ContentType, type Draft, type WeekGoal } from "@/lib/studio/config";
import { db, formatDate, studioCall, todayIL } from "@/lib/studio/client";
import { buildDriveReel } from "@/lib/studio/drive-reel";
import { Btn, Field, Loading, Note, PageHead, Select, Tag, toast } from "@/components/studio/ui";
import { cn } from "@/lib/utils";

interface Option { content_type: ContentType; format: "reel" | "carousel"; title: string; idea: string; hook: string; why: string; template: string; trend?: string }
interface Item { id: string; title: string; format: string; stage: string; planned_date: string; content_type?: string | null; hook: string; draft_id: string | null }

const DAY = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const KEEP = -1;

/**
 * לתכנן את השבוע מחדש: לכל יום שלוש אפשרויות שונות (סוג תוכן, פורמט, זווית), ולידן מה שכבר בלוח.
 * בוחרים לכל יום, ו"לבנות את השבוע" משבץ. פוסט קיים שהוחלף לא נמחק: הוא יוצא מהיום ונשאר ברעיונות.
 * קרוסלות נכתבות מיד (בעיצוב ובתמונות מהדרייב). רילס נבנים מיד מהסרטונים בדרייב (כרטיסים לפי הרעיון),
 * ואם הדרייב לא זמין, הם נשארים כרעיון עם הוק.
 */
export default function ReplanPage() {
  const [account, setAccount] = useState<Account>("plania.il");
  const dates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(todayIL(), i + 1)).filter((d) => new Date(`${d}T12:00:00`).getDay() !== 6), []);
  const [current, setCurrent] = useState<Record<string, Item[]>>({});
  const [options, setOptions] = useState<Record<string, Option[]>>({});
  const [pick, setPick] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState("");
  const [progress, setProgress] = useState("");
  const [built, setBuilt] = useState(false);
  const [goal, setGoal] = useState<WeekGoal>("grow");
  // ימים שכבר יש בהם פוסט שפורסם: לא משבצים בהם עוד אחד
  const [publishedDays, setPublishedDays] = useState<Set<string>>(new Set());

  useEffect(() => {
    db().from("studio_items").select("id, title, format, stage, planned_date, content_type, hook, draft_id").eq("account", account).in("planned_date", dates)
      .then(({ data }) => {
        const by: Record<string, Item[]> = {};
        const pub = new Set<string>();
        for (const i of (data ?? []) as Item[]) {
          if (i.stage === "published") pub.add(i.planned_date); else (by[i.planned_date] ??= []).push(i);
        }
        setCurrent(by);
        setPublishedDays(pub);
        setPick(Object.fromEntries(dates.map((d) => [d, by[d]?.length || pub.has(d) ? KEEP : 0])));
      });
  }, [account, dates]);

  /**
   * הכול בלחיצה אחת: טרנדים עדכניים, שבוע מאוזן (ההמלצה של כל יום), וכל פוסט נבנה עד הסוף:
   * קרוסלות בעיצוב ובתמונות מהדרייב, רילס ערוכים מהסרטונים בדרייב.
   * יום שכבר יש בו פוסט מוכן או שפורסם נשאר כמו שהוא. רעיון בלי טיוטה מוחלף בפוסט מוכן (ונשאר ברעיונות).
   */
  const auto = async () => {
    setBusy("auto");
    setBuilt(false);
    try {
      const { data: last } = await db().from("studio_trends").select("date").eq("status", "done").order("date", { ascending: false }).limit(1).maybeSingle();
      if (!last || last.date < addDays(todayIL(), -3)) {
        setProgress("מחפשת טרנדים חדשים...");
        await studioCall("trends").catch(() => null);
      }
      setProgress("מתכננת שבוע מאוזן עם הטרנדים...");
      const { days } = await studioCall<{ days: { date: string; options: Option[] }[] }>("week-options", { account, dates, goal });
      const opts = Object.fromEntries(days.map((d) => [d.date, d.options.slice(0, 3)]));
      setOptions(opts);
      const picks = Object.fromEntries(dates.map((d) => {
        const ready = publishedDays.has(d) || (current[d] ?? []).some((i) => i.draft_id);
        return [d, ready || !opts[d]?.length ? KEEP : 0];
      }));
      setPick(picks);
      await build(opts, picks);
    } catch (e) { toast((e as Error).message, true); setProgress(""); }
    finally { setBusy(""); }
  };

  const generate = async (only?: string) => {
    setBusy(only ?? "all");
    try {
      const { days } = await studioCall<{ days: { date: string; options: Option[] }[] }>("week-options", { account, dates: only ? [only] : dates, goal });
      setOptions((o) => ({ ...o, ...Object.fromEntries(days.map((d) => [d.date, d.options.slice(0, 3)])) }));
    } catch (e) { toast((e as Error).message, true); }
    finally { setBusy(""); }
  };

  const build = async (options_ = options, pick_ = pick) => {
    const options = options_, pick = pick_;
    setBusy((b) => b || "build");
    try {
      const chosen = dates.filter((d) => pick[d] !== KEEP && options[d]?.[pick[d]]);
      const used: string[] = [];
      const failed: string[] = [];
      for (const [n, d] of chosen.entries()) {
        const o = options[d][pick[d]];
        setProgress(`${n + 1} מתוך ${chosen.length}: ${formatDate(d)} · ${o.title}`);
        // מה שהיה ביום הזה יוצא מהיום, ונשאר ברעיונות (לא נמחק)
        for (const old of current[d] ?? []) await db().from("studio_items").update({ planned_date: null }).eq("id", old.id);
        const niche = NICHES.find((x) => x.account === account && (o.content_type === "value" ? x.value === "meals" : true))?.value ?? null;
        const { data: item, error } = await db().from("studio_items").insert({
          title: o.title, account, niche, format: o.format, stage: "idea", planned_date: d, hook: o.hook, content_type: o.content_type, template: o.template || null,
          notes: `${o.idea}\n\nלמה: ${o.why}${o.trend ? `\n\nטרנד: ${o.trend}` : ""}`,
        }).select("id").single();
        if (error) throw new Error(error.message);
        if (o.format === "carousel") {
          // קרוסלה נכתבת מיד, בעיצוב החשבון ועם תמונות מהדרייב
          const { data: dr, error: e2 } = await db().from("studio_drafts").insert({ idea: o.trend ? `${o.idea} (בהשראת הטרנד: ${o.trend})` : o.idea, account, niche, mode: "carousel", facts: "", data: { template: o.template, content_type: o.content_type, goal } }).select("*").single();
          if (e2) throw new Error(e2.message);
          let draft = (await studioCall<{ draft: Draft }>("carousel", { draftId: dr.id })).draft;
          draft = await studioCall<{ draft: Draft }>("drive-match", { draftId: draft.id }).then((r) => r.draft).catch(() => draft);
          await db().from("studio_items").update({ draft_id: draft.id, stage: "draft", caption: draft.data.carousel?.caption ?? "" }).eq("id", item.id);
        } else if (o.format === "reel") {
          // ריל נבנה מיד מהסרטונים בדרייב. לא הצליח: נשאר רעיון עם הוק, ואפשר לבנות אותו אחר כך מהלוח
          try {
            const r = await buildDriveReel({
              account, idea: o.trend ? `${o.idea} (בהשראת הטרנד: ${o.trend})` : o.idea, hook: o.hook, title: o.title, content_type: o.content_type, date: d, itemId: item.id, exclude: used, goal,
              onStep: (st) => setProgress(`${n + 1} מתוך ${chosen.length}: ${o.title} · ${st}`),
            });
            used.push(...r.used);
          } catch { failed.push(o.title); }
        }
      }
      setProgress("");
      setBuilt(true);
      toast(failed.length ? `השבוע עודכן. ${failed.length === 1 ? "ריל אחד נשאר" : `${failed.length} רילס נשארו`} כרעיון (אפשר לבנות מהלוח)` : "השבוע עודכן בלוח", !!failed.length);
    } catch (e) { toast((e as Error).message, true); setProgress(""); }
    finally { setBusy(""); }
  };

  const hasOptions = Object.keys(options).length > 0;
  const changes = dates.filter((d) => pick[d] !== KEEP && options[d]?.[pick[d]]).length;

  return (
    <>
      <PageHead label="תכנון" title="ליצור את" accent="השבוע" sub="בלחיצה אחת: טרנדים עדכניים, שבוע מאוזן, וכל פוסט מוכן עד הסוף, כולל עריכת הרילס והקרוסלות. שום דבר לא נמחק ושום דבר לא מתפרסם." />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="חשבון"><Select value={account} onChange={(v) => { setAccount(v); setOptions({}); setBuilt(false); }} options={ACCOUNTS} /></Field>
      </div>
      <section className="mb-5 rounded-3xl border border-[#5E1D1D]/30 bg-[#FFFDFB] p-5 shadow-[0_24px_50px_-40px_rgba(94,29,29,0.6)]">
        <h2 className="s-serif text-[22px] leading-tight text-[#5E1D1D]">כל השבוע, מוכן להעלאה</h2>
        <p className="mt-3 text-[13px] font-bold text-[#2A2622]">מה המטרה השבוע?</p>
        <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="המטרה של השבוע">
          {WEEK_GOALS.map((g) => (
            <button key={g.value} type="button" role="radio" aria-checked={goal === g.value} onClick={() => setGoal(g.value)}
              className={cn("rounded-2xl border p-2.5 text-right transition", goal === g.value ? "border-[#5E1D1D] bg-[#5E1D1D] text-[#FAF6F1]" : "border-[#E3D9CC] bg-white hover:border-[#5E1D1D]")}>
              <span className="block text-[14px] font-bold">{g.label}</span>
              <span className={cn("mt-0.5 block text-[11px] leading-snug", goal === g.value ? "text-[#FAF6F1]/80" : "text-[#6A6158]")}>{g.hint}</span>
            </button>
          ))}
        </div>
        <ul className="mt-4 space-y-1 text-[13px] leading-relaxed text-[#4E4540]">
          <li>מחפשת טרנדים חדשים ובונה עליהם לפחות שני פוסטים</li>
          <li>שבוע מאוזן לפי המטרה, עם סוף שמתאים לה (לשמור, לשתף, או לכתוב מילה בתגובה)</li>
          <li>רילס ערוכים מהסרטונים בדרייב, קרוסלות מעוצבות עם התמונות שלך</li>
          <li>יום שכבר יש בו פוסט מוכן או שפורסם נשאר כמו שהוא</li>
        </ul>
        <Btn busy={busy === "auto"} disabled={!!busy && busy !== "auto"} onClick={auto} className="mt-4 min-h-[50px] w-full text-[15px]">{busy === "auto" ? "יוצרת את השבוע..." : "ליצור את כל השבוע"}</Btn>
        {busy === "auto" && progress && <p className="mt-2 text-center text-[13px] font-semibold text-[#5E1D1D]" role="status">{progress}</p>}
        {busy === "auto" && <p className="mt-1 text-center text-[11px] text-[#9A8C85]">זה לוקח כמה דקות. כדאי להישאר בדף ובוויי-פיי.</p>}
        {built && !busy && <Link href="/studio" className="mt-3 block text-center text-[14px] font-bold text-[#5E1D1D] underline underline-offset-4">לראות את השבוע</Link>}
      </section>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <p className="text-[13px] font-bold text-[#6A6158]">או לבחור בעצמך, יום אחרי יום:</p>
        <Btn variant="line" busy={busy === "all"} disabled={!!busy && busy !== "all"} onClick={() => generate()}>{busy === "all" ? "חושבת על השבוע..." : hasOptions ? "אפשרויות חדשות" : "להציע אפשרויות לכל יום"}</Btn>
      </div>
      {busy === "all" && <Loading>מכינה שלוש אפשרויות לכל יום...</Loading>}
      {publishedDays.size > 0 && hasOptions && <p className="mb-2 text-[12px] text-[#6A6158]">ימים עם פוסט שפורסם נשארים כמו שהם.</p>}

      {hasOptions && (
        <div className="space-y-4">
          {dates.map((d) => (
            <section key={d} className="rounded-2xl border border-[#E3D9CC] bg-[#FAF6F1] p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-bold">{DAY[new Date(`${d}T12:00:00`).getDay()]} · {formatDate(d)}</p>
                <button type="button" onClick={() => generate(d)} disabled={!!busy} className="inline-flex items-center gap-1 text-[12px] font-bold underline underline-offset-4">
                  <RefreshCw className={cn("size-3.5", busy === d && "animate-spin")} />אפשרויות אחרות ליום הזה
                </button>
              </div>
              <div className="grid gap-2 md:grid-cols-4">
                {current[d]?.length ? (
                  <Card on={pick[d] === KEEP} onClick={() => setPick((p) => ({ ...p, [d]: KEEP }))} label="להשאיר את מה שבלוח">
                    {current[d].map((i) => <p key={i.id} className="text-sm font-semibold">{i.title}</p>)}
                    <p className="mt-1 text-[11px] text-[#6A6158]">{current[d].map((i) => `${i.format === "carousel" ? "קרוסלה" : "ריל"}${i.content_type ? ` · ${labelOf(CONTENT_TYPES, i.content_type)}` : ""}`).join(", ")}</p>
                  </Card>
                ) : (
                  <Card on={pick[d] === KEEP} onClick={() => setPick((p) => ({ ...p, [d]: KEEP }))} label="יום פנוי">
                    <p className="text-[12px] text-[#6A6158]">לא לשבץ כלום ביום הזה</p>
                  </Card>
                )}
                {(options[d] ?? []).map((o, i) => (
                  <Card key={i} on={pick[d] === i} onClick={() => setPick((p) => ({ ...p, [d]: i }))}
                    label={`${o.format === "carousel" ? "קרוסלה" : "ריל"} · ${labelOf(CONTENT_TYPES, o.content_type)}`}>
                    <p className="s-serif text-lg leading-snug">{o.hook}</p>
                    <p className="mt-1 text-[13px]">{o.idea}</p>
                    <p className="mt-1 text-[11px] text-[#6A6158]">{o.why}</p>
                    {o.trend && <p className="mt-1.5 inline-block rounded-full bg-[#F6E7A6]/70 px-2 py-0.5 text-[11px] font-bold text-[#5E1D1D]">טרנד: {o.trend}</p>}
                  </Card>
                ))}
              </div>
            </section>
          ))}
          <div className="sticky bottom-3 flex flex-wrap items-center gap-3 rounded-2xl border border-[#5E1D1D] bg-[#FAF6F1] p-3 shadow-[0_8px_24px_-10px_rgba(31,27,22,0.4)]">
            <Btn busy={busy === "build"} disabled={!changes || !!busy} onClick={() => build()}>{busy === "build" ? "בונה..." : `לבנות את השבוע (${changes} שינויים)`}</Btn>
            {progress && <span className="text-[13px] text-[#4E4540]">{progress}</span>}
            {built && <Link href="/studio/board" className="text-[13px] font-bold underline">ללוח</Link>}
            <span className="text-[11px] text-[#6A6158]">קרוסלות ורילס נבנים מיד, מהתמונות והסרטונים בדרייב.</span>
          </div>
        </div>
      )}
    </>
  );
}

function Card({ on, onClick, label, children }: { on: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cn("relative rounded-xl border bg-white/70 p-3 text-right transition", on ? "border-2 border-[#5E1D1D] shadow-[0_0_0_3px_rgba(246,231,166,0.8)]" : "border-[#E3D9CC] hover:border-[#5E1D1D]")}>
      <span className="mb-1 flex items-center justify-between">
        <Tag tone={on ? "butter" : undefined}>{label}</Tag>
        {on && <Check className="size-4" />}
      </span>
      {children}
    </button>
  );
}
