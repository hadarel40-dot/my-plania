"use client";
import { useState } from "react";
import { Check, Copy, Loader2, Share2, UserPlus, X } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

/**
 * הזמנת משתמשת נוספת: יוצר קישור הזמנה חד-פעמי (תקף 14 יום) ששולחים בוואטסאפ.
 * מי שפותחת אותו בוחרת מייל וסיסמה ומקבלת אזור אישי משלה, עם פרויקטים נפרדים.
 */
export function InviteButton() {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "making" | "error">("idle");
  const [copied, setCopied] = useState(false);

  async function make() {
    setState("making");
    const bytes = crypto.getRandomValues(new Uint8Array(18));
    const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    const supabase = getSupabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("invites").insert({ token, created_by: user?.id });
    if (error) { setState("error"); return; }
    setLink(`${location.origin}/invite/${token}`);
    setState("idle");
  }

  const text = "הזמנה לעורך הווידאו: פותחים את הקישור, בוחרים מייל וסיסמה, וזהו 🎬";
  return (
    <>
      <button type="button" onClick={() => { setOpen(true); if (!link) void make(); }} title="הזמנת משתמשת נוספת" aria-label="הזמנת משתמשת נוספת"
        className="rounded-md p-1.5 hover:bg-zinc-800 hover:text-white">
        <UserPlus className="size-4" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-sm text-zinc-200">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold"><UserPlus className="size-5 text-violet-400" /> הזמנת משתמשת נוספת</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="סגור" className="rounded p-1 text-zinc-400 hover:bg-zinc-800"><X className="size-4" /></button>
            </div>
            <p className="leading-relaxed text-zinc-400">
              שולחים לה את הקישור. היא בוחרת מייל וסיסמה ומקבלת אזור אישי משלה: הפרויקטים שלה נפרדים, ואף אחת לא רואה את של השנייה.
            </p>
            {state === "making" && <p className="flex items-center gap-2 text-zinc-400"><Loader2 className="size-4 animate-spin" /> יוצר קישור…</p>}
            {state === "error" && <p className="text-red-300">לא הצלחנו ליצור קישור. נסו שוב.</p>}
            {link && (
              <>
                <p dir="ltr" className="break-all rounded-md bg-zinc-950 p-2 text-xs text-zinc-300">{link}</p>
                <div className="grid grid-cols-2 gap-2">
                  {typeof navigator !== "undefined" && "share" in navigator && (
                    <button type="button" onClick={() => navigator.share({ text: `${text}\n${link}` }).catch(() => undefined)}
                      className="flex items-center justify-center gap-1.5 rounded-lg bg-violet-600 py-2.5 font-medium">
                      <Share2 className="size-4" /> שליחה
                    </button>
                  )}
                  <button type="button" onClick={() => { void navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-zinc-700 py-2.5">
                    {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "הועתק" : "העתקה"}
                  </button>
                </div>
                <p className="text-[11px] text-zinc-500">הקישור עובד פעם אחת, למשך 14 יום. לעוד משתמשת יוצרים קישור חדש.</p>
                <button type="button" onClick={() => { setLink(null); void make(); }} className="text-xs text-zinc-400 underline">קישור חדש</button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
