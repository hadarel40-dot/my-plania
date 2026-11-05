"use client";
import { useEffect, useState } from "react";
import { create } from "zustand";
import { Check, ExternalLink, KeyRound, Loader2 } from "lucide-react";
import { getMyKey, setMyKey } from "@/lib/ai/my-key";
import { cn } from "@/lib/utils";

/** פתיחה מכל מקום (למשל מהודעה שהמכסה נגמרה) */
export const useMyKeyCard = create<{ open: boolean }>(() => ({ open: false }));

/**
 * "המכסה שלי": כל משתמשת מחברת מפתח Gemini חינמי משלה (דקה אחת, עם חשבון Gmail),
 * ואז העריכות שלה לא נספרות במכסה של האתר ולא נגמרות לאחרות.
 */
export function MyKeyCard() {
  const open = useMyKeyCard((s) => s.open);
  const [saved, setSaved] = useState("");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => { setSaved(getMyKey()); }, []);
  const toggle = () => useMyKeyCard.setState({ open: !open });

  async function save() {
    const key = value.trim();
    if (!key) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/key-check", { method: "POST", headers: { "x-gemini-key": key } });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setMsg({ ok: false, text: data?.error ?? "המפתח לא עבד" }); return; }
      setMyKey(key); setSaved(key); setValue("");
      setMsg({ ok: true, text: "מחובר! מעכשיו העריכות שלך משתמשות במכסה האישית שלך" });
    } catch {
      setMsg({ ok: false, text: "לא הצלחתי לבדוק עכשיו, אפשר לנסות שוב" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("rounded-xl border p-3", saved ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/40 bg-amber-500/5")}>
      <button onClick={toggle} className="flex w-full items-center gap-2 text-start">
        <KeyRound className={cn("size-4 shrink-0", saved ? "text-emerald-300" : "text-amber-300")} />
        <span className="flex-1 text-sm font-medium">
          {saved ? "המכסה האישית שלי: מחוברת ✓" : "שהעריכות לא ייגמרו: חיבור מכסה אישית (חינם)"}
        </span>
        <span className="text-xs text-zinc-400">{open ? "סגירה" : saved ? "פרטים" : "איך?"}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3 text-xs leading-relaxed text-zinc-300">
          <p>
            הבינה המלאכותית (Gemini של Google) נותנת מספר מוגבל של עריכות ביום לכל חשבון. כשמחברים חשבון אישי, לכל משתמשת יש
            מכסה משלה, בחינם, והיא לא נגמרת בגלל אחרות. בלי חשבון אישי משתמשים במכסה המשותפת של האתר.
          </p>
          <ol className="list-inside list-decimal space-y-1.5">
            <li>
              נכנסים ל-
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-violet-300 underline">
                aistudio.google.com/apikey <ExternalLink className="size-3" />
              </a>{" "}
              ומתחברים עם חשבון Gmail.
            </li>
            <li>לוחצים על <b>Create API key</b> (יצירת מפתח). אם שואלים על פרויקט, בוחרים את מה שמוצע.</li>
            <li>מעתיקים את המפתח (רצף ארוך של אותיות ומספרים) ומדביקים כאן:</li>
          </ol>
          <div className="flex gap-2">
            <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={saved ? "מפתח חדש (להחלפה)" : "הדבקת המפתח"} dir="ltr" autoComplete="off" spellCheck={false}
              className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-2 text-base focus:border-violet-500 focus:outline-none md:text-sm" />
            <button onClick={save} disabled={busy || !value.trim()} className="flex shrink-0 items-center gap-1 rounded-md bg-violet-600 px-3 text-sm font-medium disabled:opacity-40">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} חיבור
            </button>
          </div>
          {msg && <p className={msg.ok ? "text-emerald-300" : "text-red-300"}>{msg.ok ? "✓ " : ""}{msg.text}</p>}
          <p className="text-[11px] text-zinc-500">המפתח נשמר רק בטלפון הזה, ולא מופיע לאף אחד אחר. לא צריך כרטיס אשראי.</p>
          {saved && (
            <button onClick={() => { setMyKey(""); setSaved(""); setMsg({ ok: true, text: "המפתח הוסר. חוזרים למכסה המשותפת" }); }} className="text-[11px] text-zinc-400 underline">
              הסרת המפתח מהטלפון
            </button>
          )}
        </div>
      )}
    </div>
  );
}
