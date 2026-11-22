"use client";
import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { useEditor } from "@/stores/editor-store";
import type { Draft } from "@/lib/studio/config";
import { REEL_STYLES, reelCaptions, styleForVariant } from "@/lib/studio/reel-timeline";
import { cn } from "@/lib/utils";

/**
 * גרסאות הריל מהסטודיו, בתוך העורך: אותם סגנונות כמו בדשבורד. החלפה מחליפה רק את הכתוביות של הסטודיו
 * (לא נוגעת בטקסטים שהוספת בעצמך), ושומרת את הבחירה גם בטיוטה בסטודיו.
 */
export function StudioVersions() {
  const [draft, setDraft] = useState<Draft | null>(null);
  useEffect(() => {
    const projectId = window.location.pathname.match(/^\/p\/([\w-]+)/)?.[1];
    if (!projectId) return;
    getSupabaseBrowser().from("studio_drafts").select("*").eq("project_id", projectId).limit(1).then(({ data }) => setDraft((data?.[0] as Draft) ?? null));
  }, []);
  if (!draft?.data.edit) return null;
  const current = styleForVariant(draft.data.chosen_variant);
  const choose = async (variant: string) => {
    const style = styleForVariant(variant);
    useEditor.setState((s) => ({ timeline: { ...s.timeline, overlays: [...s.timeline.overlays.filter((o) => !o.studio), ...reelCaptions(draft.data.edit!.cards, style)] } }));
    const data = { ...draft.data, chosen_variant: variant };
    setDraft({ ...draft, data });
    await getSupabaseBrowser().from("studio_drafts").update({ data }).eq("id", draft.id);
  };
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
      <p className="mb-2 text-sm font-semibold">גרסאות מהסטודיו</p>
      <div className="flex flex-wrap gap-1.5">
        {REEL_STYLES.map((s) => (
          <button key={s.id} type="button" onClick={() => choose(s.variant)}
            className={cn("rounded-full border px-3 py-1 text-xs font-semibold", current === s.id ? "border-violet-500 bg-violet-500/15" : "border-zinc-700 hover:border-violet-500")}>
            {s.variant} · {s.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-zinc-500">אותו מראה בדיוק כמו בדשבורד. השינויים כאן מופיעים גם שם.</p>
    </div>
  );
}
