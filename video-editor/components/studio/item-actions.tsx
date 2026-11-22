"use client";
import { useState } from "react";
import { Check, Loader2, Trash2, Wand2 } from "lucide-react";
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

  const btn = "inline-flex min-h-[32px] items-center justify-center gap-1 rounded-lg border px-2 text-[11px] font-bold transition disabled:opacity-50";
  const step = busy.startsWith("reel:") ? busy.slice(5) : "";
  return (
    <div className={cn("flex flex-wrap gap-1 bg-[#FAF6F1]", compact ? "px-1.5 pb-1.5" : "pt-2")}>
      {item.format === "reel" && !item.draft_id && item.planned_date && (
        <button type="button" disabled={!!busy} onClick={buildReel} title={step || "לבנות ריל מהסרטונים בדרייב"}
          className={cn(btn, "w-full border-[#5E1D1D] bg-[#5E1D1D] text-[#FAF6F1]")}>
          {busy.startsWith("reel") ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
          <span className="truncate">{step || "לבנות ריל"}</span>
        </button>
      )}
      <button type="button" disabled={!!busy} onClick={togglePublished} aria-pressed={published} title={published ? "לבטל את הסימון" : "לסמן שפורסם באינסטגרם"}
        className={cn(btn, "flex-1", published ? "border-[#3E6B4F] bg-[#3E6B4F] text-white" : "border-[#E3D9CC] bg-white text-[#3E6B4F] hover:border-[#3E6B4F]")}>
        {busy === "pub" ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}{published ? "פורסם" : compact ? "פורסם?" : "סמני שפורסם"}
      </button>
      <button type="button" disabled={!!busy} onClick={remove} aria-label="למחוק מהלוח" title="למחוק מהלוח"
        className={cn(btn, "border-[#E3D9CC] bg-white px-2 text-[#9A8C85] hover:border-[#B5484B] hover:text-[#B5484B]")}>
        {busy === "del" ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
      </button>
    </div>
  );
}
