"use client";
import { useEffect, useState } from "react";
import { CONTENT_TYPES, labelOf, type Draft } from "@/lib/studio/config";
import { db } from "@/lib/studio/client";
import { MEDIA_BUCKET } from "@/lib/supabase/env";
import { Btn, Note, Panel, Tag, toast } from "./ui";

/** סרטון מוכן שהתהליך השבועי יצר: צפייה, הורדה, והכיתוב להעתקה. מוסיפים מוזיקה באינסטגרם */
export function ReadyVideo({ draft, title = "הריל", accent = "מוכן" }: { draft: Draft; title?: string; accent?: string }) {
  const v = draft.data.video;
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!v) return;
    db().storage.from(MEDIA_BUCKET).createSignedUrl(v.path, 6 * 60 * 60).then(({ data }) => (data?.signedUrl ? setUrl(data.signedUrl) : setFailed(true)));
  }, [v?.path]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!v) return null;
  const caption = draft.data.caption ?? draft.data.carousel?.caption ?? "";
  const download = async () => {
    if (!url) return;
    try {
      const blob = await (await fetch(url)).blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${draft.idea.slice(0, 40) || "reel"}.mp4`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
    } catch { window.open(url, "_blank"); }
  };
  return (
    <Panel title={title} accent={accent} aside={draft.data.content_type ? <Tag tone="butter">{labelOf(CONTENT_TYPES, draft.data.content_type)}</Tag> : undefined}>
      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        {failed ? <Note tone="bad">לא הצלחתי לטעון את הסרטון. נסי לרענן.</Note> : url ? (
          <video src={url} controls playsInline className="aspect-[9/16] w-full max-w-[260px] rounded-xl border border-[#E2DACD] bg-black" />
        ) : <div className="aspect-[9/16] w-full max-w-[260px] animate-pulse rounded-xl bg-[#ECE7DE]" />}
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <Btn disabled={!url} onClick={download}>להוריד את הסרטון</Btn>
            {caption && <Btn variant="line" onClick={() => navigator.clipboard.writeText(caption).then(() => toast("הכיתוב הועתק"))}>להעתיק כיתוב</Btn>}
          </div>
          <p className="mt-2 text-[12px] text-[#6F675C]">בלי מוזיקה בכוונה: מוסיפים צליל טרנדי באינסטגרם לפני שמעלים. הסטודיו לא מפרסם בעצמו.</p>
          {caption && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{caption}</p>}
        </div>
      </div>
    </Panel>
  );
}
