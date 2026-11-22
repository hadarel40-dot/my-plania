"use client";
import { useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import type { Draft } from "@/lib/studio/config";
import { studioCall } from "@/lib/studio/client";
import { Btn, inputCls, toast } from "./ui";
import { cn } from "@/lib/utils";

const EXAMPLES = {
  carousel: ["השער ארוך מדי", "תחליפי את הטקסט בשקופית 3", "בלי השקופית האחרונה", "תמונה אחרת לשער"],
  reel: ["הסרטון האחרון לא מתאים", "לשנות את הטקסט בכרטיס 2", "יותר מהיר", "להוריד את הכרטיס השלישי"],
};

/** צ'אט עם המעצב: מבקשים שינוי קטן במילים. קרוסלה משתנה מיד, ריל מתעדכן בעיבוד הבא */
export function DesignerChat({ draft, onChange }: { draft: Draft; onChange: (d: Draft) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const isCarousel = draft.mode === "carousel";
  const chat = draft.data.chat ?? [];
  const pending = (draft.data.requests ?? []).filter((r) => r.status === "pending").length;

  const send = async (msg = text) => {
    if (msg.trim().length < 2) return;
    setBusy(true);
    try {
      onChange((await studioCall<{ draft: Draft }>("designer", { draftId: draft.id, message: msg.trim() })).draft);
      setText("");
    } catch (e) { toast((e as Error).message, true); }
    finally { setBusy(false); }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-full border border-[#1F1B16] bg-[#FBF8F2] px-4 py-2 text-[13px] font-bold hover:bg-[#F4EFE6]">
        <MessageCircle className="size-4" />משהו לא מתאים? לכתוב למעצב{pending ? ` · ${pending} בקשות בעבודה` : ""}
      </button>
    );
  }
  return (
    <div className="rounded-2xl border border-[#E2DACD] bg-[#FBF8F2] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-bold">המעצב</span>
        <button type="button" onClick={() => setOpen(false)} className="text-[12px] underline">לסגור</button>
      </div>
      <p className="mb-2 text-[12px] text-[#6F675C]">
        {isCarousel ? "כותבים מה לשנות, והקרוסלה משתנה מיד. לא אהבת? \"לחזור לגרסה הקודמת\"." : "כותבים מה לשנות. הסרטון המעודכן מגיע בעיבוד הבא (בריצה השבועית, או כשמבקשים ממני בצ'אט)."}
      </p>
      {chat.length > 0 && (
        <ul className="mb-2 max-h-64 space-y-1.5 overflow-y-auto">
          {chat.map((m, i) => (
            <li key={i} className={cn("max-w-[85%] rounded-xl px-3 py-1.5 text-[13px]", m.role === "me" ? "mr-0 ml-auto bg-[#F6E7A6]" : "ml-0 mr-auto bg-[#F4EFE6]")}>{m.text}</li>
          ))}
        </ul>
      )}
      <div className="mb-2 flex flex-wrap gap-1.5">
        {EXAMPLES[isCarousel ? "carousel" : "reel"].map((e) => (
          <button key={e} type="button" disabled={busy} onClick={() => send(e)} className="rounded-full border border-[#E2DACD] bg-white/70 px-2.5 py-1 text-[12px] hover:border-[#1F1B16]">{e}</button>
        ))}
      </div>
      <div className="flex gap-2">
        <input className={inputCls} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !busy && send()} placeholder="למשל: הסרטון האחרון לא מתאים" />
        <Btn busy={busy} onClick={() => send()}><Send className="size-4" /></Btn>
      </div>
    </div>
  );
}
