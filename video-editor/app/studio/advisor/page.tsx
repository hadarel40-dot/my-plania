"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { ACCOUNTS, FORMATS, NICHES, labelOf } from "@/lib/studio/config";
import { db, studioCall } from "@/lib/studio/client";
import { Btn, Label, Loading, PageHead, Panel, Tag, toast } from "@/components/studio/ui";
import { cn } from "@/lib/utils";

interface Idea { title: string; idea: string; why: string; account: "hadarelifergan" | "plania.il"; niche: "travel" | "business" | "home" | "meals"; format: "reel" | "carousel" | "story" | "image" }
interface Msg { role: "user" | "assistant"; text: string; ideas?: Idea[] }

const STARTERS = [
  "מה הכי כדאי לי לפרסם השבוע, ולמה?",
  "מה עבד לי הכי טוב בחודש האחרון, ואיך לעשות עוד מזה?",
  "איך להגדיל שמירות ושיתופים בפלניה?",
  "תני לי רעיון לסדרת תוכן קבועה לעמוד האישי",
];
const KEY = "studio-advisor-chat";

export default function AdvisorPage() {
  const router = useRouter();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { try { setMsgs(JSON.parse(localStorage.getItem(KEY) ?? "[]")); } catch { /* מצב פרטי */ } }, []);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(msgs.slice(-40))); } catch { /* מצב פרטי */ } end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs]);

  const send = async (q: string) => {
    const question = q.trim();
    if (!question || busy) return;
    const next: Msg[] = [...msgs, { role: "user", text: question }];
    setMsgs(next);
    setText("");
    setBusy(true);
    try {
      const res = await studioCall<{ reply: string; ideas: Idea[] }>("advisor", { messages: next.map((m) => ({ role: m.role, text: m.text.slice(0, 4000) })).slice(-20) });
      setMsgs([...next, { role: "assistant", text: res.reply, ideas: res.ideas }]);
    } catch (e) {
      toast((e as Error).message, true);
      setMsgs(msgs);
      setText(question);
    } finally {
      setBusy(false);
    }
  };
  const addIdea = async (i: Idea) => {
    const { error } = await db().from("studio_items").insert({ title: i.title, account: i.account, niche: i.niche, format: i.format, stage: "idea", notes: `${i.idea}\n\nלמה: ${i.why}` });
    if (error) return toast(error.message, true);
    setAdded((a) => ({ ...a, [i.title]: true }));
    toast("נוסף לתור");
  };

  return (
    <>
      <PageHead label="ייעוץ" title="היועצת" accent="השיווקית" sub="שואלים כל שאלה על תוכן ושיווק. היא מכירה את הקול שלך, את הלוח, את הטרנדים ואת המספרים האמיתיים מאינסטגרם, ועונה עם המלצה ברורה.">
        {msgs.length > 0 && <Btn variant="ghost" onClick={() => { setMsgs([]); setAdded({}); }}>שיחה חדשה</Btn>}
      </PageHead>
      <div className="space-y-3">
        {msgs.length === 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {STARTERS.map((s) => (
              <button key={s} type="button" onClick={() => send(s)} className="rounded-2xl border border-[#E3D9CC] bg-[#FAF6F1] px-4 py-3 text-right text-sm font-semibold hover:border-[#5E1D1D]">{s}</button>
            ))}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-start" : "justify-end")}>
            <div className={cn("max-w-[760px] rounded-2xl px-4 py-3 text-[15px] leading-relaxed", m.role === "user" ? "bg-[#5E1D1D] text-[#FAF6F1]" : "border border-[#E3D9CC] bg-[#FAF6F1]")}>
              <p className="whitespace-pre-line">{m.text}</p>
              {!!m.ideas?.length && (
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {m.ideas.map((idea) => (
                    <Panel key={idea.title} className="bg-white/70 px-3 py-3">
                      <div className="mb-1 flex flex-wrap gap-1"><Tag tone="butter">{labelOf(FORMATS, idea.format)}</Tag><Tag>{labelOf(ACCOUNTS, idea.account)}</Tag><Tag>{labelOf(NICHES, idea.niche)}</Tag></div>
                      <p className="s-serif text-base leading-snug">{idea.title}</p>
                      <p className="mt-1 text-[13px]">{idea.idea}</p>
                      <p className="mt-1 text-[12px] text-[#6A6158]">{idea.why}</p>
                      <div className="mt-2 flex gap-2">
                        <Btn className="py-1.5" onClick={() => router.push(`/studio/reel?${new URLSearchParams({ idea: idea.idea, account: idea.account, niche: idea.niche, ...(idea.format === "carousel" ? { mode: "carousel" } : {}) })}`)}>לכתוב עכשיו</Btn>
                        <Btn variant="line" className="py-1.5" disabled={added[idea.title]} onClick={() => addIdea(idea)}>{added[idea.title] ? "בתור" : "להוסיף לתור"}</Btn>
                      </div>
                    </Panel>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && <div className="flex justify-end"><div className="rounded-2xl border border-[#E3D9CC] bg-[#FAF6F1] px-4 py-3"><Loading>חושבת, מסתכלת על המספרים...</Loading></div></div>}
        <div ref={end} />
      </div>
      <div className="sticky bottom-0 mt-4 rounded-2xl border border-[#E3D9CC] bg-[#FAF6F1] p-2 shadow-[0_-4px_20px_-10px_rgba(31,27,22,0.25)]">
        <Label className="px-2 pb-1">מה תרצי לשאול?</Label>
        <div className="flex items-end gap-2">
          <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }}
            placeholder="למשל: הריל על התפריט השבועי קיבל מעט שמירות. מה לשנות בפעם הבאה?" className="min-h-[52px] flex-1 resize-none rounded-xl border border-[#DDD4C6] bg-white/70 px-3 py-2 text-sm focus:border-[#5E1D1D] focus:outline-none" />
          <button type="button" aria-label="שליחה" disabled={busy || !text.trim()} onClick={() => send(text)} className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#5E1D1D] text-[#FAF6F1] disabled:opacity-40"><ArrowUp className="size-5" /></button>
        </div>
      </div>
    </>
  );
}
