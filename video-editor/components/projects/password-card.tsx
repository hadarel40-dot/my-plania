"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, KeyRound, Loader2, X } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

/**
 * בחירת סיסמה, כדי שבפעם הבאה אפשר יהיה להיכנס עם מייל וסיסמה בלי לחכות לקישור במייל.
 * מוצג אוטומטית למי שעוד לא בחר סיסמה, ובכל זמן מכפתור המפתח בכותרת (/?password=1).
 */
export function PasswordCard({ email, dismissible }: { email: string; dismissible: boolean }) {
  const router = useRouter();
  const close = () => router.replace("/");
  // עד שנבחרה סיסמה, הכרטיס נשאר (אין לו כפתור סגירה)
  const onClose = dismissible ? close : undefined;
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError("הסיסמה צריכה להיות לפחות 6 תווים");
      setState("error");
      return;
    }
    setState("saving");
    const { error } = await getSupabaseBrowser().auth.updateUser({ password, data: { has_password: true } });
    if (error) {
      setError(/reauth|recent/i.test(error.message)
        ? "מטעמי אבטחה צריך להתחבר מחדש עם קישור מהמייל, ואז לבחור סיסמה"
        : /same|different/i.test(error.message) ? "זו כבר הסיסמה הנוכחית" : error.message);
      setState("error");
    } else {
      // ה-JWT נושא את user_metadata: מרעננים כדי שהשרת יידע שכבר יש סיסמה
      await getSupabaseBrowser().auth.refreshSession().catch(() => undefined);
      setState("saved");
    }
  }

  if (state === "saved") {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-800 bg-emerald-950/40 p-4 text-sm text-emerald-200">
        <Check className="size-4 shrink-0" />
        <span className="flex-1">הסיסמה נשמרה. מעכשיו נכנסים עם המייל והסיסמה, בלי קוד מהמייל.</span>
        {<button onClick={close} aria-label="סגירה" className="rounded p-1 hover:bg-emerald-900/50"><X className="size-4" /></button>}
      </div>
    );
  }

  return (
    <form onSubmit={save} className="mb-4 space-y-3 rounded-xl border border-violet-800/60 bg-violet-950/30 p-4">
      <div className="flex items-start gap-2">
        <KeyRound className="mt-0.5 size-4 shrink-0 text-violet-300" />
        <div className="flex-1 text-sm">
          <p className="font-medium">בחירת סיסמה</p>
          <p className="text-zinc-400">אחרי שבוחרים סיסמה, נכנסים עם מייל וסיסמה ולא צריך לחכות לקישור במייל.</p>
        </div>
        {onClose && <button type="button" onClick={onClose} aria-label="סגירה" className="rounded p-1 text-zinc-400 hover:bg-zinc-800"><X className="size-4" /></button>}
      </div>
      {/* שדה המייל המוסתר עוזר לדפדפן לשמור את הסיסמה יחד עם המייל */}
      <input type="email" name="email" autoComplete="username" value={email} readOnly hidden />
      <div className="flex gap-2">
        <input type="password" name="password" autoComplete="new-password" value={password} dir="ltr"
          onChange={(e) => { setPassword(e.target.value); if (state === "error") setState("idle"); }}
          placeholder="סיסמה חדשה" aria-label="סיסמה חדשה"
          className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none" />
        <button disabled={state === "saving"}
          className="flex shrink-0 items-center gap-1.5 rounded-md bg-violet-600 px-4 text-sm font-medium hover:bg-violet-500 disabled:opacity-50">
          {state === "saving" && <Loader2 className="size-4 animate-spin" />} שמירה
        </button>
      </div>
      {state === "error" && <p className="text-xs text-red-300">{error}</p>}
    </form>
  );
}
