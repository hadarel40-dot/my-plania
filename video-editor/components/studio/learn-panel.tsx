"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ACCOUNTS, CONTENT_TYPES, labelOf, type Account, type Learnings, type PublishedPost } from "@/lib/studio/config";
import { db, formatDate, num, studioCall } from "@/lib/studio/client";
import { variantLabel } from "@/lib/studio/reel-timeline";
import { Btn, Note, Panel, Select, Tag, toast } from "./ui";

interface Linked { itemId: string; title: string; format: string; content_type: string | null; draftId: string; chosen_variant: string | null; edit: boolean; post: PublishedPost; matchedNow: boolean }
interface Result { connected: boolean; linked?: Linked[]; learnings?: Learnings | null; insightsAvailable?: boolean; baseline?: Record<string, number | null> }

/**
 * מה למדנו מהפוסטים: כל פוסט שהסטודיו הכין ופורסם מתחבר לנתונים שלו באינסטגרם (לפי הכיתוב),
 * ומהם יוצאות מסקנות שנכנסות לכל כתיבה ולתכנון השבוע הבא.
 */
export function LearnPanel() {
  const [account, setAccount] = useState<Account>("plania.il");
  const [res, setRes] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [stages, setStages] = useState<Record<string, string>>({});

  const run = async () => {
    setBusy(true);
    try {
      const r = await studioCall<Result>("learn", { account });
      setRes(r);
      const ids = (r.linked ?? []).map((l) => l.itemId);
      if (ids.length) {
        const { data } = await db().from("studio_items").select("id, stage").in("id", ids);
        setStages(Object.fromEntries((data ?? []).map((x) => [x.id, x.stage])));
      }
      const fresh = (r.linked ?? []).filter((l) => l.matchedNow).length;
      if (fresh) toast(`נמצאו ${fresh} פוסטים חדשים באינסטגרם`);
    } catch (e) { toast((e as Error).message, true); }
    finally { setBusy(false); }
  };
  useEffect(() => { setRes(null); void run(); }, [account]); // eslint-disable-line react-hooks/exhaustive-deps

  const unlink = async (l: Linked) => {
    await studioCall("unlink", { draftId: l.draftId }).catch((e) => toast((e as Error).message, true));
    setRes((r) => r && { ...r, linked: r.linked?.filter((x) => x.draftId !== l.draftId) });
  };
  // רק בלחיצה שלה
  const markPublished = async (l: Linked) => {
    const { error } = await db().from("studio_items").update({ stage: "published" }).eq("id", l.itemId);
    if (error) return toast(error.message, true);
    setStages((s) => ({ ...s, [l.itemId]: "published" }));
  };

  const linked = res?.linked ?? [];
  const L = res?.learnings;
  return (
    <Panel label="למידה" title="מה למדנו" accent="מהפוסטים שלך"
      aside={<span className="flex items-center gap-2"><Select value={account} onChange={setAccount} options={ACCOUNTS} /><Btn variant="line" busy={busy} onClick={run}>לעדכן</Btn></span>}>
      {busy && !res && <p className="text-sm text-[#6F675C]">מחפשת את הפוסטים שפרסמת באינסטגרם...</p>}
      {res && !res.connected && (
        <Note tone="bad">@{account} לא מחובר לאינסטגרם בסטודיו, אז אין ממה ללמוד. צריך להוסיף אותו לטוקן של אינסטגרם (INSTAGRAM_ACCESS_TOKENS ב-Vercel), עם הרשאה לנתוני חשיפה.</Note>
      )}
      {res?.connected && (
        <div className="space-y-4">
          {L && (L.works.length + L.stop.length + L.try_next.length > 0) ? (
            <div className="grid gap-3 md:grid-cols-3">
              <Lesson title="מה עובד" items={L.works} tone="green" />
              <Lesson title="להפסיק" items={L.stop} tone="red" />
              <Lesson title="לנסות השבוע" items={L.try_next} />
              <p className="text-[11px] text-[#6F675C] md:col-span-3">מתוך {L.posts} פוסטים, עודכן ב-{formatDate(L.at.slice(0, 10))}. המסקנות האלה נכנסות לכל קרוסלה, ריל ותכנון שבוע מעכשיו.</p>
            </div>
          ) : (
            <Note>{linked.length < 3 ? `צריך לפחות 3 פוסטים שפורסמו מהסטודיו כדי ללמוד. כרגע: ${linked.length}. אחרי שתפרסמי, לוחצים "לעדכן", והסטודיו ימצא אותם לבד לפי הכיתוב.` : "עוד אין דפוס ברור. ממשיכים לפרסם ובודקים שוב."}</Note>
          )}
          {!res.insightsAvailable && <p className="text-[12px] text-[#6F675C]">אין הרשאה לחשיפה, שמירות ושיתופים, אז הלמידה רק מלייקים ותגובות.</p>}
          {linked.length > 0 && (
            <ul className="divide-y divide-[#ECE7DE]">
              {linked.map((l) => (
                <li key={l.draftId} className="flex flex-wrap items-center gap-2 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">{l.title}</p>
                    <p className="mt-0.5 flex flex-wrap gap-1">
                      <Tag>{l.format === "carousel" ? "קרוסלה" : "ריל"}</Tag>
                      {l.content_type && <Tag tone="butter">{labelOf(CONTENT_TYPES, l.content_type)}</Tag>}
                      {(l.edit || l.chosen_variant) && <Tag>גרסה {l.edit ? variantLabel(l.chosen_variant) : l.chosen_variant}</Tag>}
                      <span className="text-[11px] text-[#6F675C]">פורסם {formatDate(l.post.posted_at.slice(0, 10))}</span>
                    </p>
                  </div>
                  <p className="text-[12px] tabular-nums text-[#4E473E]">
                    {[["חשיפה", l.post.stats.reach], ["צפיות", l.post.stats.views], ["שמירות", l.post.stats.saved], ["שיתופים", l.post.stats.shares], ["לייקים", l.post.stats.likes], ["תגובות", l.post.stats.comments]]
                      .filter(([, v]) => typeof v === "number").map(([k, v]) => `${k} ${num(v as number)}`).join(" · ")}
                  </p>
                  <span className="flex gap-1.5">
                    <a href={l.post.permalink} target="_blank" rel="noopener noreferrer" className="text-[12px] font-bold underline underline-offset-4">לפוסט</a>
                    {stages[l.itemId] !== "published" && <Btn variant="line" onClick={() => markPublished(l)}>לסמן כפורסם</Btn>}
                    <Btn variant="ghost" onClick={() => unlink(l)}>לא זה</Btn>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-[#6F675C]">פוסט שהסטודיו לא מצא? מדביקים את הקישור שלו בפריט ב<Link href="/studio/board" className="underline">לוח</Link>, ולוחצים "לעדכן".</p>
        </div>
      )}
    </Panel>
  );
}

function Lesson({ title, items, tone }: { title: string; items: string[]; tone?: "green" | "red" }) {
  return (
    <div className="rounded-xl border border-[#E2DACD] bg-white/70 p-3">
      <p className={tone === "green" ? "mb-1.5 text-sm font-bold text-[#3E6B4F]" : tone === "red" ? "mb-1.5 text-sm font-bold text-[#A3402F]" : "mb-1.5 text-sm font-bold"}>{title}</p>
      {items.length ? <ul className="list-disc space-y-1 pr-4 text-[13px] leading-snug">{items.map((t, i) => <li key={i}>{t}</li>)}</ul> : <p className="text-[12px] text-[#6F675C]">עוד אין</p>}
    </div>
  );
}
