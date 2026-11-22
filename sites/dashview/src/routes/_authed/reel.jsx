import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { db } from "@/lib/studio/client";
import { ReelPlayer } from "@/components/reel/reel-player";
import { DesignerChat } from "@/components/reel/designer-chat";
import { Loading, Note, Panel, Tag } from "@/components/reel/ui";

export const Route = createFileRoute("/_authed/reel")({
  validateSearch: (s) => ({ id: typeof s.id === "string" ? s.id : "" }),
  component: ReelPage,
  head: () => ({ meta: [{ title: "הריל · Plania Studio" }] }),
});

/** מסך הריל: הנגן, הגרסאות, ערכות העיצוב, העיצוב, כל כרטיס בנפרד, הקריינות והמעצב. בלי עורך */
function ReelPage() {
  const { id } = Route.useSearch();
  const [draft, setDraft] = useState(null);
  const [state, setState] = useState("loading");
  useEffect(() => {
    if (!id) return setState("missing");
    db().from("studio_drafts").select("*").eq("id", id).single().then(({ data }) => {
      if (data) { setDraft(data); setState("ok"); } else setState("missing");
    });
  }, [id]);

  return (
    <div className="space-y-5">
      <Link to="/" className="inline-flex items-center gap-1 text-[13px] font-bold text-studio-wine underline-offset-4 hover:underline">
        <ChevronRight className="size-4" />חזרה לשבוע
      </Link>
      {state === "loading" && <Loading />}
      {state === "missing" && <Note tone="bad">הריל לא נמצא.</Note>}
      {draft && (
        <>
          <Panel title={draft.idea} aside={draft.data?.content_type ? <Tag tone="butter">{draft.data.content_type}</Tag> : undefined}>
            <p className="text-xs text-[#6A6158]">{draft.account}</p>
          </Panel>
          {draft.data?.edit ? <ReelPlayer draft={draft} onChange={setDraft} /> : <Note>לטיוטה הזאת עוד אין ריל. אפשר ליצור ריל מהסרטונים שלך.</Note>}
          {draft.data?.edit && <DesignerChat draft={draft} onChange={setDraft} />}
        </>
      )}
    </div>
  );
}
