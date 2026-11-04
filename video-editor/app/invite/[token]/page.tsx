"use client";
import { use, useEffect, useState } from "react";
import { Clapperboard, Loader2, UserPlus } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

/** עמוד ההזמנה: בוחרים מייל וסיסמה, ונכנסים ישר לאזור אישי חדש */
export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [valid, setValid] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    getSupabaseBrowser().rpc("invite_valid", { p_token: token }).then(({ data }) => setValid(data === true));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setError("הסיסמה צריכה להיות לפחות 8 תווים"); setState("error"); return; }
    if (password !== again) { setError("שתי הסיסמאות לא זהות"); setState("error"); return; }
    setState("saving");
    const supabase = getSupabaseBrowser();
    const { data, error } = await supabase.rpc("redeem_invite", { p_token: token, p_email: email, p_password: password });
    const messages: Record<string, string> = {
      exists: "כבר יש חשבון עם המייל הזה. אפשר להיכנס בעמוד הכניסה.",
      invalid: "ההזמנה כבר נוצלה או שפג תוקפה. אפשר לבקש קישור חדש.",
      bad_email: "המייל לא נראה תקין",
      short_password: "הסיסמה צריכה להיות לפחות 8 תווים",
    };
    if (error || data !== "ok") { setError(messages[data as string] ?? "משהו השתבש, נסו שוב"); setState("error"); return; }
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) { location.href = "/login"; return; }
    location.href = "/";
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-zinc-950 p-4 text-zinc-100">
      <div className="w-full max-w-sm space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8">
        <div className="flex items-center gap-2">
          <Clapperboard className="size-6 text-violet-400" />
          <h1 className="text-lg font-semibold">הוזמנת לעורך הווידאו 🎬</h1>
        </div>
        {valid === null && <p className="flex items-center gap-2 text-sm text-zinc-400"><Loader2 className="size-4 animate-spin" /> בודק את ההזמנה…</p>}
        {valid === false && (
          <p className="text-sm leading-relaxed text-zinc-300">
            ההזמנה כבר נוצלה או שפג תוקפה. כבר נרשמת? <a href="/login" className="text-violet-300 underline">לכניסה</a>
          </p>
        )}
        {valid && (
          <form onSubmit={submit} className="space-y-3 text-sm">
            <p className="text-zinc-400">בוחרים מייל וסיסמה, ומקבלים אזור אישי עם פרויקטים משלך.</p>
            <Field label="מייל" type="email" value={email} onChange={setEmail} autoComplete="username" />
            <Field label="סיסמה (לפחות 8 תווים)" type="password" value={password} onChange={setPassword} autoComplete="new-password" />
            <Field label="שוב את הסיסמה" type="password" value={again} onChange={setAgain} autoComplete="new-password" />
            {state === "error" && <p className="text-xs text-red-300">{error}</p>}
            <button disabled={state === "saving"}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-violet-600 py-2.5 font-medium hover:bg-violet-500 disabled:opacity-50">
              {state === "saving" ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
              הרשמה וכניסה
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, type, value, onChange, autoComplete }: { label: string; type: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  return (
    <label className="block">
      <span className="text-zinc-400">{label}</span>
      <input type={type} required value={value} onChange={(e) => onChange(e.target.value)} dir="ltr" autoComplete={autoComplete}
        className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 focus:border-violet-500 focus:outline-none" />
    </label>
  );
}
