"use client";
import type { Draft } from "@/lib/studio/config";
import { db } from "@/lib/studio/client";
import { toast } from "./ui";
import { cn } from "@/lib/utils";

/** הגרסאות של הפוסט, בתוך הטיוטה עצמה: לחיצה מחליפה את הגרסה שמוצגת, נשלחת לאינסטגרם ומופיעה בלוח */
export function VariantSwitch({ draft, onChange }: { draft: Draft; onChange: (d: Draft) => void }) {
  const variants = draft.data.variants ?? [];
  if (variants.length < 2) return null;
  const chosen = draft.data.chosen_variant ?? variants[0].id;
  const choose = async (id: string) => {
    const v = variants.find((x) => x.id === id);
    if (!v || id === chosen) return;
    const data = { ...draft.data, chosen_variant: id, ...(v.video ? { video: v.video } : {}), ...(v.carousel ? { carousel: v.carousel } : {}) };
    const { data: saved, error } = await db().from("studio_drafts").update({ data }).eq("id", draft.id).select("*").single();
    if (error) return toast(error.message, true);
    if (v.carousel) await db().from("studio_items").update({ caption: v.carousel.caption, hook: v.carousel.slides[0]?.headline ?? "" }).eq("draft_id", draft.id);
    onChange(saved as Draft);
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[12px] font-bold text-[#6F675C]">גרסה:</span>
      {variants.map((v) => (
        <button key={v.id} type="button" onClick={() => choose(v.id)} title={v.label}
          className={cn("rounded-full border px-3 py-1 text-[12px] font-semibold", v.id === chosen ? "border-[#1F1B16] bg-[#1F1B16] text-[#FBF8F2]" : "border-[#E2DACD] bg-white/70 hover:border-[#1F1B16]")}>
          {v.id} · {v.label}
        </button>
      ))}
    </div>
  );
}
