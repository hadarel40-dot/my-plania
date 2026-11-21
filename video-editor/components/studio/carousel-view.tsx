"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2, X } from "lucide-react";
import type { Carousel, Draft, Slide } from "@/lib/studio/config";
import { NEW_SLIDE } from "@/lib/studio/carousel-blank";
import { downloadZip, renderAll } from "@/lib/studio/carousel-render";
import { db, studioCall } from "@/lib/studio/client";
import { MEDIA_BUCKET } from "@/lib/supabase/env";
import { Btn, Label, Loading, Note, Panel, Select, Tag, inputCls, toast } from "./ui";
import { VoiceSuggestions, type Suggestion } from "./voice-suggestions";

const KIND: Record<Slide["kind"], string> = { cover: "שער", stake: "למה זה חשוב", point: "רעיון", recap: "סיכום", cta: "קריאה לפעולה" };
const KIND_OPTIONS = (Object.keys(KIND) as Slide["kind"][]).map((k) => ({ value: k, label: KIND[k] }));
const flat = (c: Carousel) => [...c.slides.map((s) => `${s.headline}\n${s.body}`), c.caption].join("\n");

/** כתובות צפייה לתמונות שהעלתה לשקופיות (נשמרות באחסון הפרטי שלה) */
function useStorageUrls(c: Carousel | undefined | null) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const paths = (c?.slides ?? []).flatMap((s) => (s.image?.kind === "storage" ? [s.image.path] : []));
  const key = paths.join("|");
  useEffect(() => {
    const missing = paths.filter((p) => !urls[p]);
    if (!missing.length) return;
    db().storage.from(MEDIA_BUCKET).createSignedUrls(missing, 6 * 60 * 60).then(({ data }) => {
      if (data?.length) setUrls((u) => ({ ...u, ...Object.fromEntries(data.flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl]] : []))) }));
    });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return urls;
}

/** קרוסלה: תצוגה של השקופיות כמו שיעלו, עורך מלא (טקסט, סדר, סוג, תמונות), והורדה */
export function CarouselView({ draft, onChange }: { draft: Draft; onChange: (d: Draft) => void }) {
  const c = draft.data.carousel;
  const [images, setImages] = useState<string[] | null>(null);
  const [edit, setEdit] = useState<Carousel | null>(null);
  const [busy, setBusy] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const shown = edit ?? c;
  const storageUrls = useStorageUrls(shown);

  // תמונה לכל שקופית: מה שהיא בחרה לשקופית קודם, ואם אין, ההתאמה מהדרייב
  const photos = useMemo(() => {
    const out: Record<number, string> = {};
    const m = draft.data.materials;
    for (const x of m?.matches ?? []) {
      const n = Number(x.target.match(/שקופית\s*(\d+)/)?.[1]);
      const f = m?.files.find((ff) => ff.id === x.file_id);
      if (n && f?.mimeType.startsWith("image/")) out[n - 1] = `/api/studio/drive-thumb?id=${f.id}&size=1200`;
    }
    (shown?.slides ?? []).forEach((s, i) => {
      if (s.image?.kind === "storage" && storageUrls[s.image.path]) out[i] = storageUrls[s.image.path];
      else if (s.image?.kind === "drive") out[i] = `/api/studio/drive-thumb?id=${s.image.id}&size=1200`;
    });
    return out;
  }, [draft.data.materials, shown, storageUrls]);
  const photoKey = JSON.stringify(photos);

  // תצוגה חיה: מציירת מחדש רגע אחרי שמפסיקים להקליד
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      if (shown) renderAll(shown, JSON.parse(photoKey)).then((imgs) => live && setImages(imgs)).catch(() => live && setImages([]));
    }, edit ? 350 : 0);
    return () => { live = false; clearTimeout(t); };
  }, [shown, photoKey, edit]);

  const persist = async (carousel: Carousel) => {
    const { data, error } = await db().from("studio_drafts").update({ data: { ...draft.data, carousel } }).eq("id", draft.id).select("*").single();
    if (error) throw new Error(error.message);
    onChange(data as Draft);
  };

  const regen = async () => {
    setBusy("regen");
    try { onChange((await studioCall<{ draft: Draft }>("carousel", { draftId: draft.id })).draft); setEdit(null); }
    catch (e) { toast((e as Error).message, true); }
    finally { setBusy(""); }
  };
  const save = async () => {
    if (!edit) return;
    if (!edit.slides.length) return toast("צריך לפחות שקופית אחת", true);
    setBusy("save");
    try {
      await persist(edit);
      const before = c ? flat(c) : "", after = flat(edit);
      setEdit(null);
      toast("נשמר");
      // רק כשהיא שינתה טקסט שהסטודיו כתב, יש ממה ללמוד על הקול שלה
      if (c && before !== after && draft.data.checks?.length) {
        const res = await studioCall<{ suggestions: Suggestion[] }>("voice-suggest", { account: draft.account, before: before.slice(0, 6000), after: after.slice(0, 6000) }).catch(() => ({ suggestions: [] as Suggestion[] }));
        if (res.suggestions.length) setSuggestions(res.suggestions);
      }
    } catch (e) { toast((e as Error).message, true); }
    finally { setBusy(""); }
  };
  const setStyle = async (style: NonNullable<Carousel["style"]>) => {
    if (edit) return setEdit({ ...edit, style });
    if (!c) return;
    try { await persist({ ...c, style }); } catch (e) { toast((e as Error).message, true); }
  };

  if (!c) {
    return (
      <Panel title="הקרוסלה">
        <Note>עוד לא נכתבה. </Note>
        <Btn className="mt-3" busy={busy === "regen"} onClick={regen}>לכתוב את הקרוסלה</Btn>
      </Panel>
    );
  }

  const style = shown?.style ?? "cream";

  return (
    <>
      <Panel label={`${shown!.slides.length} שקופיות · 1080x1350`} title="הקרוסלה" accent="שלך"
        aside={
          <div className="flex flex-wrap gap-2">
            {edit ? (
              <>
                <Btn variant="ghost" onClick={() => setEdit(null)}>ביטול</Btn>
                <Btn busy={busy === "save"} onClick={save}>שמירה</Btn>
              </>
            ) : (
              <>
                <Btn variant="ghost" busy={busy === "regen"} onClick={regen}>לכתוב מחדש עם AI</Btn>
                <Btn variant="line" onClick={() => setEdit(structuredClone(c))}>לערוך</Btn>
                <Btn busy={busy === "zip"} onClick={async () => { setBusy("zip"); try { await downloadZip(c, draft.idea, photos); } finally { setBusy(""); } }}>להוריד את התמונות</Btn>
              </>
            )}
          </div>
        }>
        {!images ? <Loading>מכינה את השקופיות...</Loading> : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {images.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={src} alt={i === 0 ? shown!.alt : `שקופית ${i + 1}`} className="h-[300px] w-[240px] shrink-0 rounded-xl border border-[#E2DACD] object-cover shadow-[0_1px_2px_rgba(31,27,22,0.08)]" />
            ))}
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Label>עיצוב:</Label>
          {([["photo", "תמונה"], ["cream", "שמנת"], ["ink", "כהה"], ["butter", "צהוב"]] as const).map(([v, l]) => (
            <button key={v} type="button" onClick={() => setStyle(v)}
              className={`rounded-lg border px-2.5 py-1 text-[12px] font-semibold ${style === v ? "border-[#1F1B16] bg-[#1F1B16] text-[#FBF8F2]" : "border-[#E2DACD] bg-white/70"}`}>{l}</button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-[#6F675C]">ההורדה כוללת את כל השקופיות כ-PNG ואת הכיתוב. מעלים אותן לאינסטגרם לפי הסדר. הסטודיו לא מפרסם בעצמו.</p>
      </Panel>

      {edit && <SlideEditor edit={edit} setEdit={setEdit} images={images} />}

      {suggestions.length > 0 && <VoiceSuggestions account={draft.account} suggestions={suggestions} onDone={() => setSuggestions([])} />}

      {!edit && (
        <Panel title="הכיתוב" aside={<Tag>{c.caption.length} תווים</Tag>}>
          {c.caption ? <p className="whitespace-pre-line text-sm leading-relaxed">{c.caption}</p> : <Note>עוד אין כיתוב. "לערוך" כדי לכתוב.</Note>}
          {c.caption && <Btn variant="ghost" className="mt-2 px-0" onClick={() => navigator.clipboard.writeText(c.caption).then(() => toast("הכיתוב הועתק"))}>להעתיק</Btn>}
        </Panel>
      )}
    </>
  );
}

/** העורך: כל שקופית עם תמונה ממוזערת חיה, סוג, טקסט, תמונה, וסידור */
function SlideEditor({ edit, setEdit, images }: { edit: Carousel; setEdit: (c: Carousel) => void; images: string[] | null }) {
  const [uploading, setUploading] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const target = useRef(0);
  const slides = edit.slides;
  const put = (next: Slide[]) => setEdit({ ...edit, slides: next });
  const setSlide = (i: number, patch: Partial<Slide>) => put(slides.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= slides.length) return;
    const next = [...slides];
    [next[i], next[j]] = [next[j], next[i]];
    put(next);
  };
  const remove = (i: number) => put(slides.filter((_, j) => j !== i));
  const addAfter = (i: number) => put([...slides.slice(0, i + 1), { ...NEW_SLIDE }, ...slides.slice(i + 1)]);

  const upload = async (file: File) => {
    const i = target.current;
    if (!file.type.startsWith("image/")) return toast("אפשר להעלות רק תמונה", true);
    if (file.size > 15 * 1024 * 1024) return toast("התמונה גדולה מדי (עד 15MB)", true);
    setUploading(i);
    try {
      const supabase = db();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("צריך להתחבר מחדש");
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `${user.id}/studio/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw new Error(error.message);
      setSlide(i, { image: { kind: "storage", path } });
    } catch (e) { toast((e as Error).message, true); }
    finally { setUploading(null); }
  };

  return (
    <Panel title="עריכת" accent="השקופיות" aside={<Tag>{slides.length} שקופיות</Tag>}>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f); }} />
      <p className="mb-3 text-[12px] text-[#6F675C]">כל שינוי מופיע בתצוגה למעלה. תמונה עובדת הכי טוב בשער ובשקופיות רעיון. מומלץ 6 עד 10 שקופיות.</p>
      <ol className="space-y-3">
        {slides.map((s, i) => (
          <li key={i} className="rounded-xl bg-[#F4EFE6] p-3">
            <div className="flex gap-3">
              {images?.[i] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={images[i]} alt="" className="hidden h-[125px] w-[100px] shrink-0 rounded-lg border border-[#E2DACD] object-cover sm:block" />
              ) : <div className="hidden h-[125px] w-[100px] shrink-0 rounded-lg border border-dashed border-[#DDD4C6] sm:block" />}
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="s-serif text-lg">{i + 1}</span>
                  <Select className="w-auto" value={s.kind} onChange={(kind) => setSlide(i, { kind })} options={KIND_OPTIONS} />
                  <div className="ms-auto flex gap-1">
                    <IconBtn label="למעלה" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="size-4" /></IconBtn>
                    <IconBtn label="למטה" disabled={i === slides.length - 1} onClick={() => move(i, 1)}><ArrowDown className="size-4" /></IconBtn>
                    <IconBtn label="למחוק" disabled={slides.length <= 1} onClick={() => remove(i)}><Trash2 className="size-4" /></IconBtn>
                  </div>
                </div>
                <input className={inputCls} value={s.headline} placeholder="כותרת" onChange={(e) => setSlide(i, { headline: e.target.value })} />
                <textarea rows={s.kind === "recap" ? 5 : 2} className={`${inputCls} mt-1.5`} value={s.body} placeholder={s.kind === "recap" ? "שורה לכל נקודה" : "טקסט (לא חובה)"} onChange={(e) => setSlide(i, { body: e.target.value })} />
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <Btn variant="ghost" className="px-1.5 text-[12px]" busy={uploading === i} onClick={() => { target.current = i; fileRef.current?.click(); }}>
                    <ImagePlus className="size-4" />{s.image ? "להחליף תמונה" : "להוסיף תמונה"}
                  </Btn>
                  {s.image && <Btn variant="ghost" className="px-1.5 text-[12px]" onClick={() => setSlide(i, { image: undefined })}><X className="size-4" />להוריד תמונה</Btn>}
                  <Btn variant="ghost" className="ms-auto px-1.5 text-[12px]" onClick={() => addAfter(i)}><Plus className="size-4" />שקופית אחרי</Btn>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ol>
      <Label className="mb-1 mt-4">כיתוב</Label>
      <textarea rows={6} className={inputCls} value={edit.caption} placeholder="השורה הראשונה היא מה שרואים לפני ה'עוד'" onChange={(e) => setEdit({ ...edit, caption: e.target.value })} />
      <Label className="mb-1 mt-3">תיאור לקוראי מסך</Label>
      <input className={inputCls} value={edit.alt} onChange={(e) => setEdit({ ...edit, alt: e.target.value })} />
    </Panel>
  );
}

function IconBtn({ children, label, onClick, disabled }: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" title={label} aria-label={label} disabled={disabled} onClick={onClick}
      className="rounded-md border border-[#E2DACD] bg-white/70 p-1 text-[#1F1B16] disabled:opacity-30">{children}</button>
  );
}
