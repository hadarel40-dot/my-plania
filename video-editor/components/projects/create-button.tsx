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
      className="flex h-full min-h-60 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 text-sm text-zinc-400 transition hover:border-violet-500 hover:bg-violet-500/5 hover:text-white disabled:border-violet-500 disabled:text-violet-200">
      {pending ? <><Loader2 className="size-7 animate-spin" /> פותח את העורך…</> : <><Plus className="size-7" /> פרויקט חדש</>}
    </button>
  );
}
