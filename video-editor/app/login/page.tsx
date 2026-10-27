"use client";
import { useEffect, useState } from "react";
import { Clapperboard, Loader2, Mail } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { supabaseEnabled } from "@/lib/supabase/env";

/** התחברות בלי סיסמה: קישור חד-פעמי נשלח למייל */
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    if (new URLSearchParams(location.search).get("error")) {
      setError("הקישור לא תקף או שפג תוקפו. שלח קישור חדש");
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
    if (error) { setError(error.message); setState("error"); }
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
            שלחנו קישור כניסה ל-<span dir="ltr" className="font-medium">{email}</span>. פתח את המייל ולחץ על הקישור.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <label className="block text-sm">
              <span className="text-zinc-400">מייל</span>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr"
                autoComplete="email" placeholder="you@example.com"
                className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 focus:border-violet-500 focus:outline-none" />
            </label>
            {state === "error" && <p className="text-xs text-red-300">{error}</p>}
            <button disabled={state === "sending"}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-violet-600 py-2 text-sm font-medium hover:bg-violet-500 disabled:opacity-50">
              {state === "sending" ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
              שלח לי קישור כניסה
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
