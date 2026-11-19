"use client";
import { useEffect, useState } from "react";
import type { Carousel, Draft, Slide } from "@/lib/studio/config";
import { downloadZip, renderAll } from "@/lib/studio/carousel-render";
import { db, studioCall } from "@/lib/studio/client";
import { Btn, Label, Loading, Note, Panel, Tag, inputCls, toast } from "./ui";
import { VoiceSuggestions, type Suggestion } from "./voice-suggestions";

const KIND: Record<Slide["kind"], string> = { cover: "שער", stake: "למה זה חשוב", point: "רעיון", recap: "סיכום", cta: "קריאה לפעולה" };
const flat = (c: Carousel) => [...c.slides.map((s) => `${s.headline}\n${s.body}`), c.caption].join("\n");

/** קרוסלה: תצוגה של השקופיות כמו שיעלו, עריכת הטקסט, והורדה של כל התמונות והכיתוב */
export function CarouselView({ draft, onChange }: { draft: Draft; onChange: (d: Draft) => void }) {
  const c = draft.data.carousel;
  const [images, setImages] = useState<string[] | null>(null);
  const [edit, setEdit] = useState<Carousel | null>(null);
  const [busy, setBusy] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const shown = edit ?? c;

  useEffect(() => {
    let live = true;
    if (shown) renderAll(shown).then((imgs) => live && setImages(imgs)).catch(() => live && setImages([]));
    return () => { live = false; };
  }, [shown]);

  const regen = async () => {
    setBusy("regen");
    try { onChange((await studioCall<{ draft: Draft }>("carousel", { draftId: draft.id })).draft); setEdit(null); }
    catch (e) { toast((e as Error).message, true); }
    finally { setBusy(""); }
  };
  const save = async () => {
    if (!edit || !c) return;
    setBusy("save");
    try {
      const { data, error } = await db().from("studio_drafts").update({ data: { ...draft.data, carousel: edit } }).eq("id", draft.id).select("*").single();
      if (error) throw new Error(error.message);
      onChange(data as Draft);
      const before = flat(c), after = flat(edit);
      setEdit(null);
      if (before !== after) {
        const res = await studioCall<{ suggestions: Suggestion[] }>("voice-suggest", { account: draft.account, before: before.slice(0, 6000), after: after.slice(0, 6000) });
        if (res.suggestions.length) setSuggestions(res.suggestions);
      }
    } catch (e) { toast((e as Error).message, true); }
    finally { setBusy(""); }
  };
  const setSlide = (i: number, patch: Partial<Slide>) => setEdit((e) => (e ? { ...e, slides: e.slides.map((s, j) => (j === i ? { ...s, ...patch } : s)) } : e));

  if (!c) {
    return (
      <Panel title="הקרוסלה">
        <Note>עוד לא נכתבה. </Note>
        <Btn className="mt-3" busy={busy === "regen"} onClick={regen}>לכתוב את הקרוסלה</Btn>
      </Panel>
    );
  }

  return (
    <>
      <Panel label={`${c.slides.length} שקופיות · 1080x1350`} title="הקרוסלה" accent="שלך"
        aside={
          <div className="flex flex-wrap gap-2">
            {edit ? (
              <>
                <Btn variant="ghost" onClick={() => setEdit(null)}>ביטול</Btn>
                <Btn busy={busy === "save"} onClick={save}>שמירה</Btn>
              </>
            ) : (
              <>
                <Btn variant="ghost" busy={busy === "regen"} onClick={regen}>לכתוב מחדש</Btn>
                <Btn variant="line" onClick={() => setEdit(structuredClone(c))}>לתקן בקול שלי</Btn>
                <Btn busy={busy === "zip"} onClick={async () => { setBusy("zip"); try { await downloadZip(c, draft.idea); } finally { setBusy(""); } }}>להוריד את התמונות</Btn>
              </>
            )}
          </div>
        }>
        {!images ? <Loading>מכינה את השקופיות...</Loading> : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {images.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={src} alt={i === 0 ? c.alt : `שקופית ${i + 1}`} className="h-[300px] w-[240px] shrink-0 rounded-xl border border-[#E2DACD] object-cover shadow-[0_1px_2px_rgba(31,27,22,0.08)]" />
            ))}
          </div>
        )}
        <p className="mt-2 text-[11px] text-[#6F675C]">ההורדה כוללת את כל השקופיות כ-PNG ואת הכיתוב. מעלים אותן לאינסטגרם לפי הסדר. הסטודיו לא מפרסם בעצמו.</p>
      </Panel>

      {edit && (
        <Panel title="עריכת הטקסט">
          <ol className="space-y-3">
            {edit.slides.map((s, i) => (
              <li key={i} className="rounded-xl bg-[#F4EFE6] p-3">
                <Label className="mb-1">{i + 1} · {KIND[s.kind]}</Label>
                <input className={inputCls} value={s.headline} onChange={(e) => setSlide(i, { headline: e.target.value })} />
                <textarea rows={s.kind === "recap" ? 5 : 2} className={`${inputCls} mt-1.5`} value={s.body} onChange={(e) => setSlide(i, { body: e.target.value })} />
              </li>
            ))}
          </ol>
          <Label className="mb-1 mt-4">כיתוב</Label>
          <textarea rows={6} className={inputCls} value={edit.caption} onChange={(e) => setEdit({ ...edit, caption: e.target.value })} />
        </Panel>
      )}

      {suggestions.length > 0 && <VoiceSuggestions account={draft.account} suggestions={suggestions} onDone={() => setSuggestions([])} />}

      {!edit && (
        <Panel title="הכיתוב" aside={<Tag>{c.caption.length} תווים</Tag>}>
          <p className="whitespace-pre-line text-sm leading-relaxed">{c.caption}</p>
          <Btn variant="ghost" className="mt-2 px-0" onClick={() => navigator.clipboard.writeText(c.caption).then(() => toast("הכיתוב הועתק"))}>להעתיק</Btn>
        </Panel>
      )}
    </>
  );
}
