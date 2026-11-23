"use client";
import { ShareHint } from "./share-hint";
import { HookLab, RewriteChips } from "./hook-lab";
import { LOOKS, PHOTO_DEFAULT } from "@/lib/studio/brand";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2, Undo2, X } from "lucide-react";
import type { Carousel, Draft, Slide } from "@/lib/studio/config";
import { NEW_SLIDE } from "@/lib/studio/carousel-blank";
import { downloadZip, renderAll, renderSlide } from "@/lib/studio/carousel-render";
import { canvasToJpeg, shareToInstagram } from "@/lib/studio/share";
import { db, studioCall } from "@/lib/studio/client";
import { MEDIA_BUCKET } from "@/lib/supabase/env";
import { Btn, Label, Loading, Note, Panel, Select, Tag, inputCls, toast } from "./ui";
import { VoiceSuggestions, type Suggestion } from "./voice-suggestions";
import { DesignPanel } from "./design-panel";
import type { Theme } from "@/lib/studio/brand";

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
  const [edit, setEditRaw] = useState<Carousel | null>(null);
  // ביטול שינוי בעריכה: כל שינוי נשמר במחסנית. הקלדה רצופה נספרת כשינוי אחד
  const undo = useRef<Carousel[]>([]);
  const lastPush = useRef(0);
  const [undoCount, setUndoCount] = useState(0);
  const setEdit = (next: Carousel | null) => {
    if (next === null) { undo.current = []; setUndoCount(0); setEditRaw(null); return; }
    setEditRaw((cur) => {
      if (cur && Date.now() - lastPush.current > 700) {
        undo.current = [...undo.current.slice(-49), cur];
        setUndoCount(undo.current.length);
      }
      lastPush.current = Date.now();
      return next;
    });
  };
  const undoLast = () => {
    const prev = undo.current.pop();
    setUndoCount(undo.current.length);
    if (prev) { lastPush.current = 0; setEditRaw(prev); }
  };
  useEffect(() => {
    if (!edit) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      // בתוך שדה טקסט, Ctrl+Z של הדפדפן מבטל הקלדה; מחוץ לשדה, מבטל את השינוי האחרון בקרוסלה
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !["INPUT", "TEXTAREA"].includes(el.tagName)) { e.preventDefault(); undoLast(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [edit]); // eslint-disable-line react-hooks/exhaustive-deps
  const [busy, setBusy] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  // עיצוב שמשתנה בלי מצב עריכה: התצוגה מתעדכנת מיד, והשמירה רגע אחרי שמפסיקים להזיז
  const [themeLocal, setThemeLocal] = useState<Theme | undefined>(undefined);
  const [designOpen, setDesignOpen] = useState(false);
  const themeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shown = edit ?? (c && themeLocal !== undefined ? { ...c, theme: themeLocal } : c);
  const storageUrls = useStorageUrls(shown);

  // תמונה לכל שקופית: מה שהיא בחרה לשקופית קודם, ואם אין, ההתאמה מהדרייב
  const photos = useMemo(() => {
    const out: Record<number, string> = {};
    const m = draft.data.materials;
    for (const x of m?.matches ?? []) {
      const n = Number(x.target.match(/שקופית\s*(\d+)/)?.[1]);
      const f = m?.files.find((ff) => ff.id === x.file_id);
      // תמונה מהדרייב, או פריים מסרטון כשאין תמונה מתאימה (הדרייב שלה הוא בעיקר סרטונים)
      if (n && f && (f.mimeType.startsWith("image/") || f.mimeType.startsWith("video/"))) out[n - 1] = `/api/studio/drive-thumb?id=${f.id}&size=1600`;
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
    // סנכרון ללוח: הכיתוב והשער
    await db().from("studio_items").update({ caption: carousel.caption, hook: carousel.slides[0]?.headline ?? "" }).eq("draft_id", draft.id);
    onChange(data as Draft);
  };

  const regen = async () => {
    setBusy("regen");
    try { onChange((await studioCall<{ draft: Draft }>("carousel", { draftId: draft.id })).draft); setEdit(null); }
    catch (e) { toast((e as Error).message, true); }
    finally { setBusy(""); }
  };
  // מהטלפון: כל השקופיות נפתחות באינסטגרם כקרוסלה, ושם מוסיפים מוזיקה טרנדית
  const sendToInstagram = async () => {
    const car = shown ?? c;
    if (!car) return;
    setBusy("send");
    try {
      const files = await Promise.all(car.slides.map((_, i) => renderSlide(car, i, photos).then((cv) => canvasToJpeg(cv, `${String(i + 1).padStart(2, "0")}.jpg`))));
      const res = await shareToInstagram(files, car.caption);
      if (res === "unsupported") { toast("שליחה ישירה עובדת מהטלפון. במחשב: מורידים, ומעלים מהטלפון"); await downloadZip(car, draft.idea, photos); }
      else if (res === "shared") toast("הכיתוב הועתק. באינסטגרם: מוסיפים מוזיקה ומדביקים את הכיתוב");
    } catch (e) { toast((e as Error).message, true); }
    finally { setBusy(""); }
  };
  const history = draft.data.carousel_history ?? [];
  const revert = async () => {
    if (!history.length) return;
    setBusy("revert");
    try {
      const { data, error } = await db().from("studio_drafts").update({ data: { ...draft.data, carousel: history[0], carousel_history: history.slice(1) } }).eq("id", draft.id).select("*").single();
      if (error) throw new Error(error.message);
      onChange(data as Draft);
      toast("חזרתי לגרסה הקודמת");
    } catch (e) { toast((e as Error).message, true); }
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
  // תמונות מתאימות מהדרייב לכל שקופית (תמונה, או פריים מסרטון), ומעבר למראה עם תמונות
  const pullPhotos = async () => {
    setBusy("photos");
    try {
      const fresh = (await studioCall<{ draft: Draft }>("drive-match", { draftId: draft.id })).draft;
      onChange(fresh);
      if (c && (c.style ?? "cream") !== "photo") await persistOn(fresh, { ...c, style: "photo" });
      toast("התמונות מהדרייב בפנים");
    } catch (e) { toast((e as Error).message, true); }
    finally { setBusy(""); }
  };
  const persistOn = async (base: Draft, carousel: Carousel) => {
    const { data, error } = await db().from("studio_drafts").update({ data: { ...base.data, carousel } }).eq("id", base.id).select("*").single();
    if (error) throw new Error(error.message);
    onChange(data as Draft);
  };
  // מראה מוכן: עובר לסגנון "תמונה" עם הפונטים והצבעים של המראה
  const applyLook = async (theme: Theme) => {
    if (edit) return setEdit({ ...edit, style: "photo", theme });
    if (!c) return;
    setThemeLocal(theme);
    try { await persist({ ...c, style: "photo", theme }); } catch (e) { toast((e as Error).message, true); }
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
                <Btn variant="line" disabled={!undoCount} onClick={undoLast}><Undo2 className="size-4" />ביטול שינוי</Btn>
                <Btn variant="ghost" onClick={() => setEdit(null)}>יציאה בלי לשמור</Btn>
                <Btn busy={busy === "save"} onClick={save}>שמירה</Btn>
              </>
            ) : (
              <>
                {history.length > 0 && <Btn variant="line" busy={busy === "revert"} onClick={revert}><Undo2 className="size-4" />לחזור לגרסה הקודמת</Btn>}
                <Btn variant="ghost" busy={busy === "regen"} onClick={regen}>לכתוב מחדש עם AI</Btn>
                <Btn variant="line" onClick={() => setEdit(structuredClone(c))}>לערוך</Btn>
                <Btn busy={busy === "send"} onClick={sendToInstagram}>לשלוח לאינסטגרם</Btn>
                <Btn variant="line" busy={busy === "zip"} onClick={async () => { setBusy("zip"); try { await downloadZip(shown ?? c, draft.idea, photos); } finally { setBusy(""); } }}>להוריד</Btn>
              </>
            )}
          </div>
        }>
        {!images ? <Loading>מכינה את השקופיות...</Loading> : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {images.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={src} alt={i === 0 ? shown!.alt : `שקופית ${i + 1}`} className="h-[300px] w-[240px] shrink-0 rounded-xl border border-[#E3D9CC] object-cover shadow-[0_1px_2px_rgba(31,27,22,0.08)]" />
            ))}
          </div>
        )}
        <div className="mt-3">
          <Label>מראה</Label>
          <div className="mt-1.5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            {LOOKS.map((l) => {
              const t = { ...PHOTO_DEFAULT, ...l.theme };
              const on = style === "photo" && lookOf(shown?.theme) === l.id;
              return (
                <button key={l.id} type="button" onClick={() => applyLook(l.theme)} aria-pressed={on} title={l.hint}
                  className={`w-[104px] shrink-0 overflow-hidden rounded-xl border text-right transition ${on ? "border-2 border-[#5E1D1D]" : "border-[#E3D9CC] hover:border-[#5E1D1D]"}`}>
                  <span className="flex h-[64px] flex-col justify-center px-2" style={{ background: t.bg, textAlign: t.align === "center" ? "center" : "right" }}>
                    <span className="block truncate text-[16px] leading-tight" style={{ fontFamily: `"${t.headFont}"`, color: t.headColor, fontWeight: 700 }}>כותרת</span>
                    <span className="block truncate text-[12px]" style={{ fontFamily: `"${t.bodyFont}"`, color: t.bodyColor, fontSize: t.bodyFont === "Amatic SC" ? 16 : 12 }}>שורה קטנה</span>
                  </span>
                  <span className="block bg-white px-2 py-1">
                    <span className="block truncate text-[12px] font-bold text-[#2A2622]">{l.name}</span>
                    <span className="block truncate text-[10px] text-[#9A8C85]">{l.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[12px] font-bold text-[#6A6158]">בלי תמונות:</span>
            {([["cream", "שמנת"], ["ink", "כהה"], ["butter", "צהוב"]] as const).map(([v, l]) => (
              <button key={v} type="button" onClick={() => setStyle(v)}
                className={`rounded-lg border px-2.5 py-1 text-[12px] font-semibold ${style === v ? "border-[#5E1D1D] bg-[#5E1D1D] text-[#FAF6F1]" : "border-[#E3D9CC] bg-white/70"}`}>{l}</button>
            ))}
            <button type="button" onClick={pullPhotos} disabled={busy === "photos"} className="ms-auto inline-flex min-h-[32px] items-center gap-1 rounded-full border border-[#5E1D1D]/40 bg-white px-3 text-[12px] font-bold text-[#5E1D1D] disabled:opacity-60">
              {busy === "photos" ? "מחפשת בדרייב..." : draft.data.materials?.matches.length ? "לבחור מחדש מהדרייב" : "תמונות מהדרייב"}
            </button>
            <button type="button" onClick={() => setDesignOpen(!designOpen)} className="text-[12px] font-bold underline underline-offset-4">{designOpen ? "לסגור עיצוב" : "פונטים וצבעים"}</button>
          </div>
        </div>
        {designOpen && (
          <div className="mt-3">
            <DesignPanel account={draft.account} theme={shown?.theme} onChange={(t) => {
              if (edit) return setEdit({ ...edit, theme: t });
              if (!c) return;
              setThemeLocal(t);
              if (themeTimer.current) clearTimeout(themeTimer.current);
              themeTimer.current = setTimeout(() => { persist({ ...c, theme: t }).catch((e) => toast((e as Error).message, true)); }, 700);
            }} />
          </div>
        )}
        <ShareHint />
      </Panel>

      {!edit && (
        <HookLab draftId={draft.id} current={c.slides[0]?.headline ?? ""} onPick={async (h) => {
          // נשמר עם היסטוריה, כדי ש"לחזור לגרסה הקודמת" יחזיר את הפתיחה הקודמת
          const next = { ...c, slides: c.slides.map((s, i) => (i === 0 ? { ...s, headline: h.headline, body: h.body || s.body } : s)) };
          const { data, error } = await db().from("studio_drafts").update({ data: { ...draft.data, carousel: next, carousel_history: [c, ...history].slice(0, 5) } }).eq("id", draft.id).select("*").single();
          if (error) throw new Error(error.message);
          await db().from("studio_items").update({ hook: h.headline }).eq("draft_id", draft.id);
          onChange(data as Draft);
        }} />
      )}

      {edit && <SlideEditor edit={edit} setEdit={setEdit} images={images} account={draft.account} />}

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
function SlideEditor({ edit, setEdit, images, account }: { edit: Carousel; setEdit: (c: Carousel) => void; images: string[] | null; account: string }) {
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
  // שקופית חדשה מקבלת את התמונה של השקופית שלפניה: אף פעם לא שקופית בלי תמונה
  const addAfter = (i: number) => put([...slides.slice(0, i + 1), { ...NEW_SLIDE, ...(slides[i]?.image ? { image: slides[i].image } : {}) }, ...slides.slice(i + 1)]);

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
      <p className="mb-3 text-[12px] text-[#6A6158]">כל שינוי מופיע בתצוגה למעלה. תמונה עובדת הכי טוב בשער ובשקופיות רעיון. מומלץ 6 עד 10 שקופיות.</p>
      <ol className="space-y-3">
        {slides.map((s, i) => (
          <li key={i} className="rounded-xl bg-[#F2ECE4] p-3">
            <div className="flex gap-3">
              {images?.[i] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={images[i]} alt="" className="hidden h-[125px] w-[100px] shrink-0 rounded-lg border border-[#E3D9CC] object-cover sm:block" />
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
                <div className="mt-1.5"><RewriteChips account={account} headline={s.headline} body={s.body} onDone={(headline, body) => setSlide(i, { headline, body })} /></div>
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
      className="rounded-md border border-[#E3D9CC] bg-white/70 p-1 text-[#2A2622] disabled:opacity-30">{children}</button>
  );
}

/** איזה מראה מוכן פעיל עכשיו (אם העיצוב זהה לאחד מהם) */
function lookOf(theme?: Theme) {
  const cur = JSON.stringify({ ...PHOTO_DEFAULT, ...(theme ?? {}) });
  return LOOKS.find((l) => JSON.stringify({ ...PHOTO_DEFAULT, ...l.theme }) === cur)?.id ?? null;
}
