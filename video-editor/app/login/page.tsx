"use client";
import { useEffect, useState } from "react";
import { Clapperboard, KeyRound, Loader2, Mail } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { supabaseEnabled } from "@/lib/supabase/env";

/**
 * התחברות עם מייל וסיסמה. מי שעוד אין לו סיסמה (או ששכח) מקבל קישור חד-פעמי למייל,
 * ואחרי הכניסה בוחר סיסמה במסך הפרויקטים.
 */
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"password" | "link">("password");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  const networkError = (e: { name: string; message: string }) =>
    e.name === "AuthRetryableFetchError" || /fetch/i.test(e.message);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const { error } = await getSupabaseBrowser().auth.signInWithPassword({ email, password });
    if (error) {
      setError(networkError(error)
        ? "אין חיבור לשרת ההתחברות. כדאי לבדוק את החיבור לאינטרנט ולנסות שוב."
        : /invalid/i.test(error.message)
          ? "המייל או הסיסמה לא נכונים. עוד לא בחרתם סיסמה? היכנסו עם קישור למייל ובחרו סיסמה."
          : error.message);
      setState("error");
      return;
    }
    // טעינה מלאה, כדי שהשרת יקרא את העוגיות של ההתחברות
    location.href = "/";
  }

  useEffect(() => {
    if (new URLSearchParams(location.search).get("error")) {
      setError("הקישור לא תקף או שפג תוקפו. אפשר לשלוח קישור חדש");
      setMode("link");
      setState("error");
    }
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const { error } = await getSupabaseBrowser().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    if (error) {
      // שגיאת רשת (Supabase לא נגיש) מגיעה כ-"Failed to fetch"; מציגים הסבר במקום זה
      setError(networkError(error) ? "אין חיבור לשרת ההתחברות. כדאי לבדוק את החיבור לאינטרנט ולנסות שוב." : error.message);
      setState("error");
    }
    else setState("sent");
  }

  return (
    <div className="grid h-screen place-items-center bg-zinc-950 p-4 text-zinc-100">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8">
        <div className="flex items-center gap-2">
          <Clapperboard className="size-6 text-violet-400" />
          <h1 className="text-lg font-semibold">כניסה לעורך</h1>
        </div>

        {!supabaseEnabled ? (
          <p className="text-sm text-zinc-400">Supabase לא מוגדר, והעורך עובד במצב מקומי. <a href="/" className="underline">לעורך</a></p>
        ) : state === "sent" ? (
          <p className="text-sm leading-relaxed text-zinc-300">
            שלחנו קישור כניסה ל-<span dir="ltr" className="font-medium">{email}</span>. פתחו את המייל ולחצו על הקישור.
          </p>
        ) : mode === "password" ? (
          <form onSubmit={signIn} className="space-y-3">
            <EmailField email={email} setEmail={setEmail} />
            <label className="block text-sm">
              <span className="text-zinc-400">סיסמה</span>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr"
                autoComplete="current-password"
                className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 focus:border-violet-500 focus:outline-none" />
            </label>
            {state === "error" && <p className="text-xs text-red-300">{error}</p>}
            <button disabled={state === "sending"}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-violet-600 py-2 text-sm font-medium hover:bg-violet-500 disabled:opacity-50">
              {state === "sending" ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
              כניסה
            </button>
            <button type="button" onClick={() => { setMode("link"); setState("idle"); }}
              className="w-full text-center text-xs text-zinc-400 underline hover:text-white">
              עוד אין סיסמה, או ששכחתם? כניסה עם קישור למייל
            </button>
          </form>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <EmailField email={email} setEmail={setEmail} />
            {state === "error" && <p className="text-xs text-red-300">{error}</p>}
            <button disabled={state === "sending"}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-violet-600 py-2 text-sm font-medium hover:bg-violet-500 disabled:opacity-50">
              {state === "sending" ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
              שלח לי קישור כניסה
            </button>
            <button type="button" onClick={() => { setMode("password"); setState("idle"); }}
              className="w-full text-center text-xs text-zinc-400 underline hover:text-white">
              כבר יש סיסמה? כניסה עם סיסמה
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function EmailField({ email, setEmail }: { email: string; setEmail: (v: string) => void }) {
  return (
    <label className="block text-sm">
      <span className="text-zinc-400">מייל</span>
      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr"
        autoComplete="username" placeholder="you@example.com"
        className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 focus:border-violet-500 focus:outline-none" />
    </label>
  );
}
