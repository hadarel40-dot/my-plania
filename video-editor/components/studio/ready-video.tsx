"use client";
import { ShareHint } from "./share-hint";
import { useEffect, useState } from "react";
import { CONTENT_TYPES, labelOf, type Draft } from "@/lib/studio/config";
import { db, editorHref, studioCall } from "@/lib/studio/client";
import { useRouter } from "next/navigation";
import { MEDIA_BUCKET } from "@/lib/supabase/env";
import { Btn, Note, Panel, Tag, toast } from "./ui";
import { shareToInstagram } from "@/lib/studio/share";

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
  const [sending, setSending] = useState(false);
  const [opening, setOpening] = useState(false);
  const router = useRouter();
  // הריל נפתח בעורך כפרויקט: הקטעים בציר הזמן והטקסטים כשכבות. מחליפים סרטון, משנים טקסט ומייצאים
  const openEditor = async () => {
    setOpening(true);
    try { router.push(editorHref((await studioCall<{ projectId: string }>("to-editor", { draftId: draft.id })).projectId, draft.data.template)); }
    catch (e) { toast((e as Error).message, true); setOpening(false); }
  };
  const send = async () => {
    if (!url) return;
    setSending(true);
    try {
      const blob = await (await fetch(url)).blob();
      const res = await shareToInstagram([new File([blob], "reel.mp4", { type: "video/mp4" })], caption);
      if (res === "unsupported") { toast("שליחה ישירה עובדת מהטלפון. במחשב: מורידים, ומעלים מהטלפון"); await download(); }
      else if (res === "shared") toast("הכיתוב הועתק. באינסטגרם: מוסיפים מוזיקה ומדביקים את הכיתוב");
    } catch (e) { toast((e as Error).message, true); }
    finally { setSending(false); }
  };
  return (
    <Panel title={title} accent={accent} aside={draft.data.content_type ? <Tag tone="butter">{labelOf(CONTENT_TYPES, draft.data.content_type)}</Tag> : undefined}>
      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        {failed ? <Note tone="bad">לא הצלחתי לטעון את הסרטון. נסי לרענן.</Note> : url ? (
          <video src={url} controls playsInline className="aspect-[9/16] w-full max-w-[260px] rounded-xl border border-[#E3D9CC] bg-black" />
        ) : <div className="aspect-[9/16] w-full max-w-[260px] animate-pulse rounded-xl bg-[#F0E8DF]" />}
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <Btn disabled={!url} busy={sending} onClick={send}>לשלוח לאינסטגרם</Btn>
            <Btn variant="line" disabled={!url} onClick={download}>להוריד</Btn>
            {draft.data.edit && <Btn variant="line" busy={opening} onClick={openEditor}>לערוך בעורך הווידאו</Btn>}
            {caption && <Btn variant="line" onClick={() => navigator.clipboard.writeText(caption).then(() => toast("הכיתוב הועתק"))}>להעתיק כיתוב</Btn>}
          </div>
<ShareHint />
          {caption && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{caption}</p>}
        </div>
      </div>
    </Panel>
  );
}
