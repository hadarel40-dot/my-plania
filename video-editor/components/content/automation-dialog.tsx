"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Copy, KeyRound, Loader2, X, Zap } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { fullDateTime } from "@/lib/content/dates";

/**
 * חיבור תרחיש הפרסום (Make): יוצרים מפתח אישי, ומדביקים אותו בתרחיש.
 * רק ה-hash נשמר במסד, ולכן המפתח מוצג פעם אחת. מפתח חדש מבטל את הקודם.
 */
export function AutomationDialog({ automation, onClose }: {
  automation: { created_at: string; last_seen_at: string | null } | null; onClose: () => void;
}) {
  const router = useRouter();
  const [key, setKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(location.origin), []);

  async function generate() {
    if (automation && !confirm("מפתח חדש יבטל את הקודם, וצריך יהיה לעדכן אותו בתרחיש. להמשיך?")) return;
    setBusy(true);
    setError(null);
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const k = "plk_" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(k));
    const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
    const supabase = getSupabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    const { error: e } = await supabase.from("content_automation")
      .upsert({ owner_id: user?.id, key_hash: hash, created_at: new Date().toISOString(), last_seen_at: null });
    setBusy(false);
    if (e) { setError(e.message); return; }
    setKey(k);
    router.refresh();
  }

  const copy = (id: string, text: string) => { void navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied(null), 1500); };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
        <div className="flex items-center gap-2">
          <Zap className="size-5 text-emerald-400" />
          <h2 className="font-semibold">פרסום אוטומטי</h2>
          <button onClick={onClose} className="ms-auto rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white" aria-label="סגירה"><X className="size-4" /></button>
        </div>

        <ol className="list-decimal space-y-1.5 ps-5 text-sm leading-relaxed text-zinc-300">
          <li>פוסט שסימנת <b>"מאושר לפרסום"</b>, עם קובץ, כיתוב ותאריך, נכנס לתור.</li>
          <li>תרחיש ב-Make בודק את התור כל רבע שעה, ומפרסם לחשבון הנכון בשעה שקבעת.</li>
          <li>אחרי הפרסום הפוסט עובר ל"פורסם", עם קישור לאינסטגרם. אם משהו נכשל, תראי כאן את הסיבה.</li>
        </ol>

        {automation && !key && (
          <p className="rounded-xl bg-emerald-500/10 p-3 text-xs text-emerald-200">
            יש מפתח פעיל מ-{fullDateTime(automation.created_at)}.{" "}
            {automation.last_seen_at ? `התרחיש בדק את התור לאחרונה ב-${fullDateTime(automation.last_seen_at)}.` : "התרחיש עוד לא התחבר."}
          </p>
        )}

        {key && (
          <div className="space-y-2 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3">
            <p className="text-xs text-amber-100">זה המפתח. הוא מוצג רק עכשיו, אז כדאי להעתיק אותו לתרחיש מיד.</p>
            <CopyRow id="key" value={key} copied={copied} onCopy={copy} />
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs text-zinc-500">כתובות לתרחיש (עם הכותרת Authorization: Bearer &lt;המפתח&gt;):</p>
          <CopyRow id="due" label="GET" value={`${origin}/api/content/due`} copied={copied} onCopy={copy} />
          <CopyRow id="report" label="POST" value={`${origin}/api/content/report`} copied={copied} onCopy={copy} />
        </div>

        {error && <p className="rounded-lg bg-red-500/10 p-2 text-xs text-red-200">{error}</p>}

        <button onClick={generate} disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
          {automation ? "מפתח חדש (מבטל את הקודם)" : "יצירת מפתח"}
        </button>
      </div>
    </div>
  );
}

function CopyRow({ id, label, value, copied, onCopy }: {
  id: string; label?: string; value: string; copied: string | null; onCopy: (id: string, v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-zinc-900 px-2.5 py-2">
      {label && <span className="rounded bg-zinc-800 px-1.5 text-[10px] font-semibold text-zinc-300">{label}</span>}
      <code dir="ltr" className="min-w-0 flex-1 truncate text-start text-xs text-zinc-200">{value}</code>
      <button onClick={() => onCopy(id, value)} className="shrink-0 text-zinc-400 hover:text-white" aria-label="העתקה">
        {copied === id ? <CheckCircle2 className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
      </button>
    </div>
  );
}
