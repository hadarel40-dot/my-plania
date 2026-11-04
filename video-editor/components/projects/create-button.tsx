"use client";
import { useFormStatus } from "react-dom";
import { Loader2, Plus } from "lucide-react";

/**
 * כפתור "פרויקט חדש". בטלפון פתיחת העורך לוקחת כמה שניות, ולכן הכפתור ננעל ומראה
 * שהוא עובד: אחרת כל לחיצה נוספת יוצרת עוד פרויקט ומתחילה את המעבר מחדש.
 */
export function CreateButton() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} aria-busy={pending}
      className="group flex h-full min-h-36 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-600/20 via-fuchsia-600/10 to-transparent text-sm text-zinc-200 shadow-lg shadow-violet-950/30 transition hover:border-violet-400/60 hover:from-violet-600/30 disabled:opacity-80 sm:min-h-60">
      {pending ? <><Loader2 className="size-8 animate-spin text-violet-300" /> פותח את העורך…</> : (
        <>
          <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-900/50 transition group-hover:scale-105"><Plus className="size-6" /></span>
          <span className="font-semibold">פרויקט חדש</span>
          <span className="text-[11px] text-zinc-400">מעלים סרטונים, והעורך עושה את השאר</span>
        </>
      )}
    </button>
  );
}
