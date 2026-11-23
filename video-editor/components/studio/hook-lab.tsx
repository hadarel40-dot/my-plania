"use client";
import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { studioCall } from "@/lib/studio/client";
import { toast } from "./ui";
import { cn } from "@/lib/utils";

export interface LabHook { headline: string; body: string }

/**
 * מעבדת הוקים: חמש פתיחות חלופיות לשער או לכרטיס הראשון, כל אחת בזווית אחרת.
 * לחיצה על פתיחה מחליפה אותה מיד (ואפשר לחזור אחורה מהכפתור של הגרסה הקודמת).
 */
export function HookLab({ draftId, onPick, current }: { draftId: string; current: string; onPick: (h: LabHook) => Promise<void> | void }) {
  const [hooks, setHooks] = useState<LabHook[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(-1);
  const load = async () => {
    setBusy(true);
    try { setHooks((await studioCall<{ hooks: LabHook[] }>("hook-lab", { draftId })).hooks); }
    catch (e) { toast((e as Error).message, true); }
    finally { setBusy(false); }
  };
  return (
    <div className="rounded-2xl border border-[#E3D9CC] bg-[#FFFDFB] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[14px] font-bold text-[#5E1D1D]">מעבדת הוקים</p>
          <p className="truncate text-[12px] text-[#6A6158]">עכשיו: {current}</p>
        </div>
        <button type="button" onClick={load} disabled={busy}
          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-full bg-[#5E1D1D] px-4 text-[13px] font-bold text-[#FAF6F1] disabled:opacity-60">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{hooks ? "5 אחרות" : "5 פתיחות אחרות"}
        </button>
      </div>
      {hooks && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {hooks.map((h, i) => (
            <button key={`${h.headline}${i}`} type="button" disabled={picking >= 0}
              onClick={async () => { setPicking(i); try { await onPick(h); toast("הפתיחה הוחלפה"); } finally { setPicking(-1); } }}
              className={cn("rounded-xl border border-[#E3D9CC] bg-white p-3 text-right transition hover:border-[#5E1D1D] disabled:opacity-60", picking === i && "border-[#5E1D1D]")}>
              <span className="s-serif block text-[17px] leading-snug text-[#2A2622]">{h.headline}</span>
              {h.body && <span className="mt-0.5 block text-[12px] text-[#6A6158]">{h.body}</span>}
              <span className="mt-1.5 block text-[11px] font-bold text-[#B5848E]">{picking === i ? "מחליפה..." : "להחליף לזו"}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const HOW = [["short", "קצר יותר"], ["sharp", "חד יותר"], ["personal", "אישי יותר"], ["simple", "פשוט יותר"]] as const;

/** שכתוב מהיר לשקופית או לכרטיס: הטקסט מתחלף בשדות, ונשמר עם "שמירה" */
export function RewriteChips({ account, headline, body, onDone }: { account: string; headline: string; body: string; onDone: (h: string, b: string) => void }) {
  const [busy, setBusy] = useState("");
  const go = async (how: string) => {
    if (!headline.trim() && !body.trim()) return;
    setBusy(how);
    try {
      const r = await studioCall<{ headline: string; body: string }>("rewrite", { account, headline, body, how });
      onDone(r.headline, body.trim() ? r.body : "");
    } catch (e) { toast((e as Error).message, true); }
    finally { setBusy(""); }
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] font-bold text-[#9A8C85]">לשכתב:</span>
      {HOW.map(([v, l]) => (
        <button key={v} type="button" disabled={!!busy} onClick={() => go(v)}
          className="inline-flex min-h-[30px] items-center gap-1 rounded-full border border-[#E3D9CC] bg-white px-2.5 text-[12px] font-bold text-[#5E1D1D] hover:border-[#5E1D1D] disabled:opacity-50">
          {busy === v && <Loader2 className="size-3 animate-spin" />}{l}
        </button>
      ))}
    </div>
  );
}
