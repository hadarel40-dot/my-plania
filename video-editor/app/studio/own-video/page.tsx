"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ACCOUNTS, CONTENT_TYPES, NICHES, type Account, type ContentType } from "@/lib/studio/config";
import { db, editorHref, formatDate, studioCall, todayIL } from "@/lib/studio/client";
import { Btn, Field, PageHead, Panel, Select, inputCls, toast } from "@/components/studio/ui";

const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

/**
 * סרטון שצילמתי בעצמי (דיבור למצלמה, וולוג, כל דבר): נכנס לתוכן השבועי ביום שבחרתי, ונפתח בעורך.
 * בעורך: מעלים את הסרטון (מהטלפון או מהדרייב), "עריכה אוטומטית" חותכת שתיקות ומוסיפה כתוביות מהדיבור,
 * וייצוא מחזיר את הסרטון הערוך לסטודיו: לטיוטה, ללוח ול"מה עולה היום".
 */
export default function OwnVideoPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [account, setAccount] = useState<Account>("plania.il");
  const [type, setType] = useState<ContentType>("story");
  const [day, setDay] = useState(addDays(todayIL(), 1));
  const [busy, setBusy] = useState(false);
  // היום הפנוי הקרוב כברירת מחדל
  useEffect(() => {
    const days = Array.from({ length: 10 }, (_, i) => addDays(todayIL(), i + 1));
    db().from("studio_items").select("planned_date").eq("account", account).in("planned_date", days).then(({ data }) => {
      const used = new Set((data ?? []).map((x) => x.planned_date as string));
      const free = days.find((d) => !used.has(d) && new Date(`${d}T12:00:00`).getDay() !== 6);
      if (free) setDay(free);
    });
  }, [account]);

  const open = async () => {
    if (title.trim().length < 3) return toast("כתבי במשפט על מה הסרטון", true);
    setBusy(true);
    try {
      const niche = NICHES.find((n) => n.account === account)?.value ?? null;
      const { data: draft, error } = await db().from("studio_drafts").insert({ idea: title.trim(), account, niche, mode: "full", facts: "", data: { content_type: type, own_video: true } }).select("id").single();
      if (error) throw new Error(error.message);
      const { error: e2 } = await db().from("studio_items").insert({ title: title.trim().slice(0, 80), account, niche, format: "reel", stage: "draft", planned_date: day, content_type: type, draft_id: draft.id, notes: "סרטון שצילמתי. נערך בעורך הווידאו, והייצוא חוזר לכאן." });
      if (e2) throw new Error(e2.message);
      const { projectId } = await studioCall<{ projectId: string }>("to-editor", { draftId: draft.id });
      router.push(editorHref(projectId));
    } catch (e) { toast((e as Error).message, true); setBusy(false); }
  };

  return (
    <>
      <PageHead label="יצירה" title="סרטון" accent="שצילמתי" sub="דיבור למצלמה, וולוג או כל סרטון שלך: משבצים ביום, עורכים בעורך, והגרסה הערוכה חוזרת לתוכן השבועי." />
      <Panel title="שלושה צעדים">
        <ol className="mb-4 list-decimal space-y-1 pr-5 text-sm text-[#4E4540]">
          <li>כותבים על מה הסרטון ובוחרים יום. הוא נכנס ללוח.</li>
          <li>בעורך מעלים את הסרטון (מהטלפון, או "דרייב" מהתיקייה), ולוחצים "עריכה אוטומטית": חותכת שתיקות ומוסיפה כתוביות מהדיבור. אפשר לתקן הכול ידנית.</li>
          <li>"ייצוא סרטון": הגרסה הערוכה חוזרת לסטודיו, ללוח ול"מה עולה היום", ומשם "לשלוח לאינסטגרם".</li>
        </ol>
        <div className="space-y-3">
          <Field label="על מה הסרטון"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="למשל: למה אני מתכננת ארוחות ביום ראשון" /></Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="חשבון"><Select value={account} onChange={setAccount} options={ACCOUNTS} /></Field>
            <Field label="סוג תוכן"><Select value={type} onChange={setType} options={CONTENT_TYPES} /></Field>
            <Field label={`יום (${formatDate(day)})`}><input type="date" className={inputCls} value={day} min={todayIL()} onChange={(e) => setDay(e.target.value)} /></Field>
          </div>
          <Btn busy={busy} onClick={open}>לשבץ ולפתוח בעורך</Btn>
        </div>
      </Panel>
    </>
  );
}
