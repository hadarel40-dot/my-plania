"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { HardDrive } from "lucide-react";
import type { Draft } from "@/lib/studio/config";
import { editorHref, studioCall } from "@/lib/studio/client";
import { Btn, Label, Note, Panel, Tag, toast } from "./ui";

/** חומרים מהדרייב: לכל שוט או שקופית, הקובץ שמתאים לו. ופתיחה בעורך כשהקליפים כבר בפנים */
export function MaterialsPanel({ draft, onChange }: { draft: Draft; onChange: (d: Draft) => void }) {
  const router = useRouter();
  const m = draft.data.materials;
  const [busy, setBusy] = useState("");
  const find = async () => {
    setBusy("find");
    try { onChange((await studioCall<{ draft: Draft }>("drive-match", { draftId: draft.id })).draft); }
    catch (e) { toast((e as Error).message, true); }
    finally { setBusy(""); }
  };
  const openEditor = async () => {
    setBusy("editor");
    try {
      const { projectId } = await studioCall<{ projectId: string }>("to-editor", { draftId: draft.id });
      const videos = (m?.files ?? []).filter((f) => f.mimeType.startsWith("video/") || f.mimeType.startsWith("image/")).map((f) => f.id);
      const href = editorHref(projectId, draft.data.template);
      router.push(videos.length ? `${href}${href.includes("?") ? "&" : "?"}drive=${videos.join(",")}` : href);
    } catch (e) {
      toast((e as Error).message, true);
      setBusy("");
    }
  };
  const byId = Object.fromEntries((m?.files ?? []).map((f) => [f.id, f]));

  return (
    <Panel label="חומרים" title="מה יש לך" accent="בדרייב"
      aside={<Btn variant={m ? "ghost" : "solid"} busy={busy === "find"} onClick={find}><HardDrive className="size-4" />{m ? "לחפש שוב" : "למצוא חומרים בדרייב"}</Btn>}>
      {!m ? (
        <p className="text-sm text-[#4E473E]">אעבור על הסרטונים והתמונות בתיקייה שלך בדרייב, לפי שם, תאריך ותמונה ממוזערת, ואתאים לכל {draft.mode === "carousel" ? "שקופית" : "שוט"} את מה שמתאים לו. מה שאין, ייכתב כ"חסר לצלם".</p>
      ) : (
        <>
          {m.matches.length === 0 ? <Note>לא מצאתי בדרייב קבצים שמתאימים באמת.</Note> : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {m.matches.map((x, i) => (
                <div key={i} className="flex gap-3 rounded-xl border border-[#E2DACD] bg-white/70 p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/studio/drive-thumb?id=${x.file_id}`} alt="" className="h-20 w-14 shrink-0 rounded-lg bg-[#ECE7DE] object-cover" />
                  <div className="min-w-0">
                    <Label>{x.target}</Label>
                    <p className="truncate text-[13px] font-semibold" title={byId[x.file_id]?.name}>{byId[x.file_id]?.name}</p>
                    <p className="text-[12px] leading-snug text-[#4E473E]">{x.reason}</p>
                    {byId[x.file_id]?.duration ? <Tag>{byId[x.file_id].duration} ש׳</Tag> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
          {m.missing.length > 0 && (
            <div className="mt-3 rounded-xl bg-[#F4EFE6] p-3">
              <Label className="mb-1">חסר לצלם</Label>
              <ul className="space-y-0.5 text-[13px]">{m.missing.map((x) => <li key={x}>· {x}</li>)}</ul>
            </div>
          )}
          {draft.mode !== "carousel" && m.files.length > 0 && (
            <Btn className="mt-3" busy={busy === "editor"} onClick={openEditor}>לפתוח בעורך עם החומרים ({m.files.length})</Btn>
          )}
        </>
      )}
    </Panel>
  );
}
