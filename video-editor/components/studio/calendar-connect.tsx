"use client";
import { useState } from "react";
import { CalendarPlus, Copy, X } from "lucide-react";
import { db } from "@/lib/studio/client";
import { Btn, toast } from "./ui";

const KEY = "plania-calendar-feed";
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const write = (v: string) => { try { localStorage.setItem(KEY, v); } catch { /* מצב פרטי: לא נורא */ } };

/**
 * חיבור ליומן: קישור מנוי (ics) שהיומן מושך מעצמו. כל פוסט עם יום ושעה מופיע כ"לפרסם",
 * עם תזכורת רבע שעה לפני ובזמן. הקישור מוגן בקוד סודי, וקישור חדש מבטל את הקודם.
 */
export function CalendarConnect({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [feed, setFeed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const show = () => { setFeed(read()); setOpen(true); };
  const create = async () => {
    setBusy(true);
    try {
      const token = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
      const { error } = await db().rpc("studio_calendar_token_set", { p_token: token });
      if (error) throw new Error(error.message);
      const url = `${location.origin}/api/studio/calendar?k=${token}`;
      write(url); setFeed(url);
    } catch (e) { toast((e as Error).message, true); }
    finally { setBusy(false); }
  };
  const webcal = feed?.replace(/^https?:/, "webcal:");
  return (
    <>
      <button type="button" onClick={show} className={`inline-flex items-center gap-1 rounded-lg border border-[#E3D9CC] bg-white/70 px-2.5 py-1 text-[12px] font-bold text-[#5E1D1D] hover:border-[#5E1D1D] ${className}`}>
        <CalendarPlus className="size-3.5" />ליומן שלי
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#2A2622]/40 backdrop-blur-[2px] sm:items-center sm:p-6" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-t-3xl bg-[#FFFDFB] p-5 shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="חיבור ליומן">
            <div className="mb-2 flex items-center justify-between">
              <p className="s-serif text-[22px] text-[#5E1D1D]">חיבור ליומן שלך</p>
              <button type="button" aria-label="סגירה" onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-full hover:bg-[#F2ECE4]"><X className="size-5" /></button>
            </div>
            <p className="text-[13px] leading-relaxed text-[#4E4540]">כל פוסט שיש לו יום ושעה בלוח מופיע ביומן כ"לפרסם", עם תזכורת רבע שעה לפני ובזמן. שינוי בלוח מגיע ליומן לבד.</p>
            {!feed ? (
              <Btn busy={busy} onClick={create} className="mt-4 w-full">ליצור קישור ליומן</Btn>
            ) : (
              <div className="mt-4 space-y-3">
                <a href={webcal} className="flex min-h-[46px] items-center justify-center rounded-xl bg-[#5E1D1D] px-4 text-[15px] font-bold text-[#FAF6F1]">להוסיף ליומן באייפון</a>
                <div className="rounded-2xl bg-[#F2ECE4] p-3 text-[12px] leading-relaxed text-[#4E4540]">
                  <p className="font-bold text-[#2A2622]">ביומן גוגל (מהמחשב)</p>
                  <p>להעתיק את הקישור, ואז ביומן גוגל: "יומנים אחרים" (+) ← "מכתובת URL" ← להדביק.</p>
                  <p className="mt-1">ההתראות בגוגל נקבעות בהגדרות של היומן "Plania · לפרסם" (התראות ברירת מחדל).</p>
                  <Btn variant="line" className="mt-2 min-h-[36px] w-full text-[13px]" onClick={() => navigator.clipboard.writeText(feed).then(() => toast("הקישור הועתק"))}><Copy className="size-4" />להעתיק את הקישור</Btn>
                </div>
                <button type="button" disabled={busy} onClick={() => { if (window.confirm("קישור חדש יבטל את הקודם. להמשיך?")) void create(); }} className="text-[12px] font-bold text-[#9A8C85] underline underline-offset-4">ליצור קישור חדש (מבטל את הקודם)</button>
              </div>
            )}
            <p className="mt-3 text-[11px] text-[#9A8C85]">הקישור פרטי: מי שיש לו אותו רואה את רשימת הפוסטים. לא לשתף.</p>
          </div>
        </div>
      )}
    </>
  );
}
