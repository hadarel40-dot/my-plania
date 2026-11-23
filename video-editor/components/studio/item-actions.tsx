"use client";
import { useState } from "react";
import { CheckCircle2, Circle, Loader2, Trash2, Wand2 } from "lucide-react";
import { db } from "@/lib/studio/client";
import { buildDriveReel } from "@/lib/studio/drive-reel";
import type { ContentType } from "@/lib/studio/config";
import { toast } from "./ui";
import { cn } from "@/lib/utils";

export interface ActionItem { id: string; title: string; account: string; format: string; stage: string; planned_date: string | null; hook: string; notes?: string | null; content_type?: string | null; draft_id: string | null }

/**
 * הפעולות על פוסט בלוח, בלחיצה אחת:
 * פורסם: היא מפרסמת בעצמה באינסטגרם, ומסמנת כאן (ואפשר לבטל את הסימון).
 * לבנות ריל: ריל שנשאר רעיון נבנה מהסרטונים בדרייב.
 * למחוק: הפוסט יורד מהלוח. הטיוטה עצמה נשארת בספרייה.
 */
export function ItemActions({ item, onChange, compact = false }: { item: ActionItem; onChange: (x: ActionItem | null) => void; compact?: boolean }) {
  const [busy, setBusy] = useState("");
  const published = item.stage === "published";

  const togglePublished = async () => {
    setBusy("pub");
    const stage = published ? (item.draft_id ? "draft" : "idea") : "published";
    const { data, error } = await db().from("studio_items").update({ stage }).eq("id", item.id).select("*").single();
    setBusy("");
    if (error) return toast(error.message, true);
    onChange(data as ActionItem);
    toast(published ? "הסימון בוטל" : "סומן שפורסם");
  };

  const remove = async () => {
    if (!window.confirm(`למחוק את "${item.title}" מהלוח?\nהטיוטה עצמה נשארת בספרייה.`)) return;
    setBusy("del");
    const { error } = await db().from("studio_items").delete().eq("id", item.id);
    setBusy("");
    if (error) return toast(error.message, true);
    onChange(null);
    toast("נמחק מהלוח");
  };

  const buildReel = async () => {
    setBusy("reel");
    try {
      const idea = (item.notes ?? "").split("\n\nלמה:")[0].trim() || item.title;
      await buildDriveReel({
        account: item.account, idea, hook: item.hook || item.title, title: item.title,
        content_type: (item.content_type as ContentType) || "value", date: item.planned_date ?? "", itemId: item.id,
        onStep: (s) => setBusy(`reel:${s}`),
      });
      const { data } = await db().from("studio_items").select("*").eq("id", item.id).single();
      if (data) onChange(data as ActionItem);
      toast("הריל מוכן");
    } catch (e) { toast((e as Error).message, true); }
    finally { setBusy(""); }
  };

  const step = busy.startsWith("reel:") ? busy.slice(5) : "";
  const building = busy.startsWith("reel");
  const btn = "inline-flex min-h-[34px] items-center justify-center gap-1 whitespace-nowrap rounded-full border text-[12px] font-bold transition";
  return (
    <div className={cn("space-y-1.5", compact ? "px-1.5 pb-1.5" : "pt-1")}>
      {item.format === "reel" && !item.draft_id && item.planned_date && (
        building ? (
          <div className="rounded-xl bg-[#F7E4E7] px-2 py-1.5" role="status">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#5E1D1D]"><Loader2 className="size-3.5 shrink-0 animate-spin" /><span className="line-clamp-2 leading-snug">{step || "בונה ריל..."}</span></div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/70"><div className="h-full w-1/3 animate-[slide_1.2s_ease-in-out_infinite] rounded-full bg-[#5E1D1D]" /></div>
          </div>
        ) : (
          <button type="button" disabled={!!busy} onClick={buildReel} className={cn(btn, "w-full border-[#5E1D1D] bg-[#5E1D1D] px-3 text-[#FAF6F1]")}>
            <Wand2 className="size-3.5" />לבנות ריל
          </button>
        )
      )}
      <div className="flex items-center gap-1.5">
        <button type="button" disabled={!!busy} onClick={togglePublished} aria-pressed={published} title={published ? "לבטל את הסימון" : "לסמן שפורסם באינסטגרם"}
          className={cn(btn, "min-w-0 flex-1 px-2 disabled:opacity-60", published ? "border-[#3E6B4F] bg-[#3E6B4F] text-white" : "border-[#D9CFC4] bg-transparent text-[#6A6158] hover:border-[#3E6B4F] hover:text-[#3E6B4F]")}>
          {busy === "pub" ? <Loader2 className="size-4 animate-spin" /> : published ? <CheckCircle2 className="size-4 shrink-0" /> : <Circle className="size-4 shrink-0" />}<span className="truncate">פורסם</span>
        </button>
        <button type="button" disabled={!!busy} onClick={remove} aria-label="למחוק מהלוח" title="למחוק מהלוח"
          className={cn(btn, "size-[34px] shrink-0 border-transparent text-[#B5A79E] hover:bg-[#F7E4E7] hover:text-[#B5484B] disabled:opacity-60")}>
          {busy === "del" ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-4" />}
        </button>
      </div>
    </div>
  );
}
