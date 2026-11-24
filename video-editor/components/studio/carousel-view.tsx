"use client";
import { ShareHint } from "./share-hint";
import { HookLab, RewriteChips } from "./hook-lab";
import { LOOKS, PHOTO_DEFAULT } from "@/lib/studio/brand";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Download, FolderOpen, ImagePlus, Palette, Pencil, Plus, Send, Sparkles, Trash2, Undo2, X } from "lucide-react";
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
        aside={edit ? <Tag>מצב עריכה</Tag> : undefined}>
        {!images ? <Loading>מכינה את השקופיות...</Loading> : (
          // בטלפון מחליקים הצידה, במחשב כל השקופיות ברשת (גלגלת העכבר לא גוללת הצידה)
          <div className="flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-[repeat(auto-fill,minmax(170px,1fr))] md:overflow-visible">
            {images.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={src} alt={i === 0 ? shown!.alt : `שקופית ${i + 1}`} className="h-[300px] w-[240px] shrink-0 rounded-xl border border-[#E3D9CC] object-cover shadow-[0_1px_2px_rgba(31,27,22,0.08)] md:aspect-[4/5] md:h-auto md:w-full" />
            ))}
          </div>
        )}
        {/* כל הפעולות בשורה אחת מסודרת: שליחה והורדה קודם, עריכה אחריהן */}
        <div className="mt-3 flex flex-wrap items-center gap-2 border-y border-[#E3D9CC] py-3">
          {edit ? (
            <>
              <Btn busy={busy === "save"} onClick={save}>שמירה</Btn>
              <Btn variant="line" disabled={!undoCount} onClick={undoLast}><Undo2 className="size-4" />ביטול שינוי</Btn>
              <Btn variant="line" onClick={() => setEdit(null)}>יציאה בלי לשמור</Btn>
            </>
          ) : (
            <>
              <Btn busy={busy === "send"} onClick={sendToInstagram}><Send className="size-4" />לשלוח לאינסטגרם</Btn>
              <Btn variant="line" busy={busy === "zip"} onClick={async () => { setBusy("zip"); try { await downloadZip(shown ?? c, draft.idea, photos); } finally { setBusy(""); } }}><Download className="size-4" />להוריד</Btn>
              <span className="mx-1 hidden h-6 w-px bg-[#E3D9CC] sm:block" />
              <Btn variant="line" onClick={() => setEdit(structuredClone(c))}><Pencil className="size-4" />לערוך שקופיות</Btn>
              <Btn variant="line" busy={busy === "regen"} onClick={regen}><Sparkles className="size-4" />לכתוב מחדש</Btn>
              {history.length > 0 && <Btn variant="line" busy={busy === "revert"} onClick={revert}><Undo2 className="size-4" />לגרסה הקודמת</Btn>}
            </>
          )}
        </div>
        <div className="mt-3">
          <Label>מראה</Label>
          {/* בטלפון מחליקים הצידה, במחשב הכול מוצג ברשת */}
          <div className="mt-1.5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] md:grid md:grid-cols-[repeat(auto-fill,minmax(104px,1fr))] md:overflow-visible">
            {LOOKS.map((l) => {
              const t = { ...PHOTO_DEFAULT, ...l.theme };
              const on = style === "photo" && lookOf(shown?.theme) === l.id;
              return (
                <button key={l.id} type="button" onClick={() => applyLook(l.theme)} aria-pressed={on} title={l.hint}
                  className={`w-[104px] shrink-0 overflow-hidden rounded-xl border text-right transition md:w-auto ${on ? "border-2 border-[#5E1D1D]" : "border-[#E3D9CC] hover:border-[#5E1D1D]"}`}>
                  <span className="flex h-[64px] flex-col justify-center px-2" style={{ background: t.bg, textAlign: t.align === "center" ? "center" : "right" }}>
                    {l.theme.card ? (
                      // מסגרת: פתק, פולרואיד, נייר, בועה, מחברת או מסקינטייפ, בקטן
                      <span className="relative mx-auto block w-[76%] px-1.5 py-1 shadow-[0_3px_6px_rgba(0,0,0,0.25)]" style={{
                        background: l.theme.card === "note" ? "#FFE98F" : l.theme.card === "tape" ? l.theme.accent : "#FFFFFF",
                        borderRadius: l.theme.card === "bubble" ? 10 : 2,
                        transform: `rotate(${l.theme.card === "note" || l.theme.card === "polaroid" ? -3 : 0}deg)`,
                        borderRight: l.theme.card === "notebook" ? `2px solid ${l.theme.accent}` : undefined,
                        paddingTop: l.theme.card === "polaroid" ? 14 : undefined,
                      }}>
                        {l.theme.card === "note" && <span className="absolute left-1/2 top-[-3px] size-[7px] -translate-x-1/2 rounded-full" style={{ background: l.theme.accent }} />}
                        {l.theme.card === "polaroid" && <span className="absolute inset-x-1.5 top-1 h-[10px] bg-[#B5A79E]" />}
                        <span className="block truncate text-[12px] leading-tight" style={{ fontFamily: `"${t.headFont}"`, color: t.headColor, fontWeight: 700, textAlign: "center" }}>כותרת</span>
                      </span>
                    ) : (
                      <>
                        <span className="block truncate text-[16px] leading-tight" style={{ fontFamily: `"${t.headFont}"`, color: t.headColor, fontWeight: 700 }}>כותרת</span>
                        <span className="block truncate text-[12px]" style={{ fontFamily: `"${t.bodyFont}"`, color: t.bodyColor, fontSize: t.bodyFont === "Amatic SC" ? 16 : 12 }}>שורה קטנה</span>
                      </>
                    )}
                  </span>
                  <span className="block bg-white px-2 py-1">
                    <span className="block truncate text-[12px] font-bold text-[#2A2622]">{l.name}</span>
                    <span className="block truncate text-[10px] text-[#9A8C85]">{l.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Btn variant="line" busy={busy === "photos"} onClick={pullPhotos}><ImagePlus className="size-4" />{busy === "photos" ? "מחפשת בדרייב..." : draft.data.materials?.matches.length ? "תמונות אחרות מהדרייב" : "תמונות מהדרייב"}</Btn>
            <Btn variant={designOpen ? "solid" : "line"} onClick={() => setDesignOpen(!designOpen)}><Palette className="size-4" />{designOpen ? "לסגור" : "פונטים וצבעים"}</Btn>
            <div className="flex items-center gap-1 rounded-xl border border-[#E3D9CC] bg-white/70 p-1" role="radiogroup" aria-label="סגנון בלי תמונות">
              <span className="px-1.5 text-[12px] font-bold text-[#6A6158]">בלי תמונות</span>
              {([["cream", "שמנת"], ["ink", "כהה"], ["butter", "צהוב"]] as const).map(([v, l]) => (
                <button key={v} type="button" role="radio" aria-checked={style === v} onClick={() => setStyle(v)}
                  className={`min-h-[32px] rounded-lg px-2.5 text-[12px] font-bold transition ${style === v ? "bg-[#5E1D1D] text-[#FAF6F1]" : "text-[#5E1D1D] hover:bg-[#F2ECE4]"}`}>{l}</button>
              ))}
            </div>
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

      {/* בעריכה: השמירה תמיד גלויה בתחתית המסך, גם כשגוללים לשקופיות למטה */}
      {edit && (
        <div className="sticky bottom-3 z-30 flex flex-wrap items-center gap-2 rounded-2xl border border-[#5E1D1D] bg-[#FFFDFB] p-3 shadow-[0_10px_30px_-12px_rgba(31,27,22,0.5)]">
          <Btn busy={busy === "save"} onClick={save} className="min-w-[120px]">שמירה</Btn>
          <Btn variant="line" disabled={!undoCount} onClick={undoLast}><Undo2 className="size-4" />ביטול שינוי</Btn>
          <Btn variant="ghost" onClick={() => setEdit(null)}>יציאה בלי לשמור</Btn>
          <span className="text-[12px] text-[#6A6158]">השינויים נראים בשקופיות למעלה, ונשמרים בלחיצה על שמירה.</span>
        </div>
      )}

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
  const [picking, setPicking] = useState<number | null>(null);
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
                {/* מיקום ויישור לשקופית הזאת בלבד */}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <SlideChoice label="מיקום" value={s.pos} onChange={(pos) => setSlide(i, { pos })} options={[["top", "למעלה"], ["center", "באמצע"], ["bottom", "למטה"]]} />
                  <SlideChoice label="יישור" value={s.align} onChange={(align) => setSlide(i, { align })} options={[["right", "לימין"], ["center", "למרכז"]]} />
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <Btn variant="ghost" className="px-1.5 text-[12px]" busy={uploading === i} onClick={() => { target.current = i; fileRef.current?.click(); }}>
                    <ImagePlus className="size-4" />{s.image ? "להעלות תמונה אחרת" : "להעלות תמונה"}
                  </Btn>
                  <Btn variant="ghost" className="px-1.5 text-[12px]" onClick={() => setPicking(i)}><FolderOpen className="size-4" />מהדרייב</Btn>
                  {s.image && <Btn variant="ghost" className="px-1.5 text-[12px]" onClick={() => setSlide(i, { image: undefined })}><X className="size-4" />להוריד תמונה</Btn>}
                  <Btn variant="ghost" className="ms-auto px-1.5 text-[12px]" onClick={() => addAfter(i)}><Plus className="size-4" />שקופית אחרי</Btn>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ol>
      {picking !== null && <DrivePicker onClose={() => setPicking(null)} onPick={(id) => { setSlide(picking, { image: { kind: "drive", id } }); setPicking(null); }} />}
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

interface DriveItem { id: string; name: string; mimeType: string; description?: string }
let driveCache: DriveItem[] | null = null;

/** בחירת תמונה (או פריים מסרטון) מהדרייב לשקופית: רשת של כל מה שיש, עם חיפוש לפי שם או תיקייה */
function DrivePicker({ onPick, onClose }: { onPick: (id: string) => void; onClose: () => void }) {
  const [files, setFiles] = useState<DriveItem[] | null>(driveCache);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | "image" | "video">("all");
  const [error, setError] = useState("");
  useEffect(() => {
    if (driveCache) return;
    studioCall<{ configured: boolean; files: DriveItem[] }>("drive-files", {})
      .then((r) => { if (!r.configured) throw new Error("הדרייב עוד לא מחובר"); driveCache = r.files; setFiles(r.files); })
      .catch((e) => setError((e as Error).message));
  }, []);
  const shown = (files ?? []).filter((f) => (kind === "all" || f.mimeType.startsWith(kind)) && (!q.trim() || `${f.name} ${f.description ?? ""}`.includes(q.trim())));
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#2A2622]/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-6" onClick={onClose}>
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col rounded-t-3xl bg-[#FFFDFB] p-4 shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="תמונה מהדרייב">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="s-serif text-[20px] text-[#5E1D1D]">תמונה מהדרייב</p>
          <button type="button" aria-label="סגירה" onClick={onClose} className="grid size-9 place-items-center rounded-full hover:bg-[#F2ECE4]"><X className="size-5" /></button>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input className={`${inputCls} min-w-[160px] flex-1`} placeholder="חיפוש לפי שם או תיקייה" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="flex gap-1 rounded-xl border border-[#E3D9CC] bg-white p-1">
            {([["all", "הכול"], ["image", "תמונות"], ["video", "מסרטונים"]] as const).map(([v, l]) => (
              <button key={v} type="button" onClick={() => setKind(v)} className={`min-h-[32px] rounded-lg px-2.5 text-[12px] font-bold ${kind === v ? "bg-[#5E1D1D] text-[#FAF6F1]" : "text-[#5E1D1D]"}`}>{l}</button>
            ))}
          </div>
        </div>
        <div className="min-h-[200px] overflow-y-auto">
          {error ? <Note tone="bad">{error}</Note> : !files ? <Loading>טוענת את הדרייב...</Loading> : !shown.length ? <Note>לא נמצא כלום.</Note> : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {shown.slice(0, 120).map((f) => (
                <button key={f.id} type="button" onClick={() => onPick(f.id)} title={f.name}
                  className="group relative aspect-[4/5] overflow-hidden rounded-xl border border-[#E3D9CC] bg-[#F2ECE4] hover:border-[#5E1D1D]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/studio/drive-thumb?id=${f.id}&size=400`} alt={f.name} loading="lazy" className="size-full object-cover transition group-hover:scale-[1.04]" />
                  {f.mimeType.startsWith("video/") && <span className="absolute bottom-1 right-1 rounded-full bg-black/60 px-1.5 text-[10px] font-bold text-white">מסרטון</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="mt-2 text-[11px] text-[#9A8C85]">מסרטון: נלקח הפריים שהדרייב שומר לסרטון.</p>
      </div>
    </div>
  );
}

/** בחירה קטנה לשקופית אחת: "כמו בכולן" או ערך משלה */
function SlideChoice<T extends string>({ label, value, onChange, options }: { label: string; value: T | undefined; onChange: (v: T | undefined) => void; options: [T, string][] }) {
  const chip = (on: boolean) => `min-h-[30px] rounded-lg px-2 text-[12px] font-bold transition ${on ? "bg-[#5E1D1D] text-[#FAF6F1]" : "text-[#5E1D1D] hover:bg-[#F2ECE4]"}`;
  return (
    <div className="flex items-center gap-1 rounded-xl border border-[#E3D9CC] bg-white/80 p-1" role="radiogroup" aria-label={label}>
      <span className="px-1 text-[11px] font-bold text-[#9A8C85]">{label}</span>
      <button type="button" role="radio" aria-checked={!value} onClick={() => onChange(undefined)} className={chip(!value)}>כמו בכולן</button>
      {options.map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)} className={chip(value === v)}>{l}</button>)}
    </div>
  );
}
