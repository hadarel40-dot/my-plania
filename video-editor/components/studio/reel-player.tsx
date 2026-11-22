"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Player } from "@remotion/player";
import { TimelineComposition, type CompositionProps } from "@/remotion/timeline-composition";
import { normalizeProject } from "@/lib/editor/initial-project";
import { timelineDuration } from "@/lib/editor/timeline-utils";
import type { MediaAsset, SavedProject, Timeline } from "@/lib/editor/types";
import { CONTENT_TYPES, labelOf, type Draft } from "@/lib/studio/config";
import { db, editorHref, studioCall } from "@/lib/studio/client";
import { REEL_STYLES, buildReelTimeline, styleForVariant } from "@/lib/studio/reel-timeline";
import { canShareFiles, shareToInstagram } from "@/lib/studio/share";
import { MEDIA_BUCKET } from "@/lib/supabase/env";
import { Btn, Loading, Panel, Tag, toast } from "./ui";
import { ShareHint } from "./share-hint";
import { cn } from "@/lib/utils";

/** כתובות צפייה לכל הקבצים של הפרויקט (מהאחסון) */
async function signAssets(assets: Record<string, MediaAsset>) {
  const paths = Object.values(assets).flatMap((a) => (a.storagePath ? [a.storagePath] : []));
  if (!paths.length) return assets;
  const { data } = await db().storage.from(MEDIA_BUCKET).createSignedUrls(paths, 6 * 60 * 60);
  const byPath = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return Object.fromEntries(Object.entries(assets).map(([id, a]) => [id, a.storagePath && byPath.get(a.storagePath) ? { ...a, url: byPath.get(a.storagePath)! } : a]));
}

/**
 * הריל בדשבורד, באותו מנוע של העורך: אותו נגן, אותם פונטים, אותו קצב.
 * אם נפתח פרויקט בעורך, מוצג הפרויקט עצמו (כל עריכה שם נראית כאן מיד). אחרת, הריל מהסטודיו בגרסה שנבחרה.
 * "לשלוח לאינסטגרם" ו"להוריד" מייצאים מאותו ציר זמן, כך שהקובץ זהה למה שרואים.
 */
export function ReelPlayer({ draft, onChange }: { draft: Draft; onChange: (d: Draft) => void }) {
  const router = useRouter();
  const kit = draft.data.edit!;
  const [project, setProject] = useState<{ timeline: Timeline; assets: Record<string, MediaAsset> } | null>(null);
  const [fromEditor, setFromEditor] = useState(false);
  const [busy, setBusy] = useState("");
  const [progress, setProgress] = useState(0);
  const abort = useRef<AbortController | null>(null);
  const variant = draft.data.chosen_variant;
  const caption = draft.data.caption ?? "";

  useEffect(() => {
    let live = true;
    (async () => {
      // פרויקט בעורך קיים: הוא המקור. אחרת בונים מהערכה של הסטודיו
      if (draft.project_id) {
        const { data } = await db().from("projects").select("title, doc").eq("id", draft.project_id).maybeSingle();
        if (data?.doc) {
          const p = normalizeProject({ ...(data.doc as Omit<SavedProject, "title">), title: data.title } as SavedProject);
          const assets = await signAssets(p.assets);
          if (live) { setProject({ timeline: p.timeline, assets }); setFromEditor(true); }
          return;
        }
      }
      const built = buildReelTimeline(kit, styleForVariant(variant));
      const assets = await signAssets(built.assets);
      if (live) { setProject({ timeline: built.timeline, assets }); setFromEditor(false); }
    })().catch(() => live && setProject(null));
    return () => { live = false; };
  }, [draft.project_id, variant, kit]);

  const inputProps = useMemo<CompositionProps | null>(() => (project ? { timeline: project.timeline, assets: project.assets, override: null } : null), [project]);
  const frames = project ? Math.max(1, Math.ceil(timelineDuration(project.timeline) * project.timeline.fps)) : 1;

  const chooseStyle = async (variantId: string) => {
    if (variantId === variant) return;
    const { data, error } = await db().from("studio_drafts").update({ data: { ...draft.data, chosen_variant: variantId } }).eq("id", draft.id).select("*").single();
    if (error) return toast(error.message, true);
    onChange(data as Draft);
  };

  // ייצוא מאותו ציר זמן (אותו מנוע כמו בעורך)
  const exportMp4 = async () => {
    if (!project) throw new Error("הריל עוד נטען");
    const { renderToMp4 } = await import("@/lib/export/render-video");
    abort.current = new AbortController();
    const phone = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
    return renderToMp4(project.timeline, project.assets, { quality: phone ? "720p" : "1080p", signal: abort.current.signal, onProgress: setProgress });
  };
  const send = async () => {
    setBusy("send"); setProgress(0);
    try {
      const blob = await exportMp4();
      const file = new File([blob], "reel.mp4", { type: "video/mp4" });
      const res = await shareToInstagram([file], caption);
      if (res === "unsupported") save(blob);
      else if (res === "shared") toast("הכיתוב הועתק. באינסטגרם: מוסיפים מוזיקה ומדביקים את הכיתוב");
    } catch (e) { if (!abort.current?.signal.aborted) toast((e as Error).message, true); }
    finally { setBusy(""); }
  };
  const save = (blob: Blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${draft.idea.slice(0, 40) || "reel"}.mp4`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
  };
  const download = async () => {
    setBusy("download"); setProgress(0);
    try { save(await exportMp4()); } catch (e) { if (!abort.current?.signal.aborted) toast((e as Error).message, true); }
    finally { setBusy(""); }
  };
  const openEditor = async () => {
    setBusy("editor");
    try { router.push(editorHref((await studioCall<{ projectId: string }>("to-editor", { draftId: draft.id })).projectId, draft.data.template)); }
    catch (e) { toast((e as Error).message, true); setBusy(""); }
  };

  return (
    <Panel title="הריל" accent="שלך" aside={<span className="flex flex-wrap gap-1">{draft.data.content_type && <Tag tone="butter">{labelOf(CONTENT_TYPES, draft.data.content_type)}</Tag>}{fromEditor && <Tag tone="green">מסונכרן עם העורך</Tag>}</span>}>
      {!fromEditor && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] font-bold text-[#6F675C]">גרסה:</span>
          {REEL_STYLES.map((s) => (
            <button key={s.id} type="button" onClick={() => chooseStyle(s.variant)}
              className={cn("rounded-full border px-3 py-1 text-[12px] font-semibold", (variant ? styleForVariant(variant) === s.id : s.id === "pop") ? "border-[#1F1B16] bg-[#1F1B16] text-[#FBF8F2]" : "border-[#E2DACD] bg-white/70 hover:border-[#1F1B16]")}>
              {s.label}
            </button>
          ))}
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-[270px_1fr]">
        {/* הנגן מחושב משמאל לימין: בדף בעברית הוא זז מחוץ למסגרת בלי זה */}
        <div dir="ltr" className="aspect-[9/16] w-full max-w-[270px] overflow-hidden rounded-xl bg-black">
          {inputProps ? (
            <Player component={TimelineComposition} inputProps={inputProps} durationInFrames={frames} fps={project!.timeline.fps}
              compositionWidth={1080} compositionHeight={1920} style={{ width: "100%", height: "100%" }} controls clickToPlay />
          ) : <Loading>טוענת את הריל...</Loading>}
        </div>
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap gap-2">
            <Btn busy={busy === "send"} onClick={send}>{busy === "send" ? `מכינה את הקובץ ${progress}%` : canShareFiles() ? "לשלוח לאינסטגרם" : "להוריד ולשלוח"}</Btn>
            <Btn variant="line" busy={busy === "download"} onClick={download}>{busy === "download" ? `${progress}%` : "להוריד"}</Btn>
            <Btn variant="line" busy={busy === "editor"} onClick={openEditor}>לערוך בעורך הווידאו</Btn>
            {busy && (busy === "send" || busy === "download") && <Btn variant="ghost" onClick={() => abort.current?.abort()}>לעצור</Btn>}
          </div>
          <ShareHint />
          <p className="text-[12px] text-[#6F675C]">{fromEditor ? "מוצג הפרויקט מהעורך: כל שינוי שם מופיע כאן מיד, וגם בקובץ שנשלח." : "זה בדיוק מה שייפתח בעורך ומה שייצא בקובץ. בעורך אפשר להחליף קטע או לשנות טקסט."}</p>
          {caption && <p className="whitespace-pre-line text-sm leading-relaxed">{caption}</p>}
        </div>
      </div>
    </Panel>
  );
}
