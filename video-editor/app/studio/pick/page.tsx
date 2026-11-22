"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CONTENT_TYPES, labelOf, type Draft, type Variant } from "@/lib/studio/config";
import { db, formatDate } from "@/lib/studio/client";
import { renderSlide } from "@/lib/studio/carousel-render";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { MEDIA_BUCKET } from "@/lib/supabase/env";
import { Btn, Loading, Note, PageHead, Panel, Tag, inputCls, toast } from "@/components/studio/ui";
import { cn } from "@/lib/utils";

interface Row { id: string; title: string; format: string; stage: string; planned_date: string | null; content_type?: string | null; draft_id: string; draft: Draft }

/** כתובות צפייה חתומות לכל הקבצים של הגרסאות, בבת אחת */
async function signAll(paths: string[]) {
  if (!paths.length) return {} as Record<string, string>;
  const { data } = await db().storage.from(MEDIA_BUCKET).createSignedUrls(paths, 6 * 60 * 60);
  return Object.fromEntries((data ?? []).flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl]] : [])));
}

/**
 * לבחירה: כל פוסט של השבוע עם כל הגרסאות שלו זו ליד זו.
 * היא בוחרת גרסה ("נבחר") ומשאירה הערה על כל גרסה. ההערות נקראות לפני השבוע הבא.
 * הבחירה לא מפרסמת ולא משנה את השלב בלוח.
 */
export default function PickPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const load = useCallback(async () => {
    const { data: items } = await db().from("studio_items").select("*").not("draft_id", "is", null).neq("stage", "published").order("planned_date", { nullsFirst: false }).limit(60);
    const ids = (items ?? []).map((i) => i.draft_id as string);
    const { data: drafts } = ids.length ? await db().from("studio_drafts").select("*").in("id", ids) : { data: [] };
    const byId = new Map((drafts ?? []).map((d) => [d.id, d as Draft]));
    setRows((items ?? []).flatMap((i) => {
      const d = byId.get(i.draft_id);
      return d?.data?.variants?.length ? [{ ...(i as Omit<Row, "draft">), draft: d }] : [];
    }));
  }, []);
  useEffect(() => { load(); }, [load]);


  return (
    <>
      <PageHead label="תכנון" title="לבחירה" accent="השבוע"
        sub="לכל פוסט יש ברירת מחדל, אז שום דבר לא מחכה לך. רוצה אחרת? לוחצים על הגרסה. אהבתי ולא אהבתי נכנסים ללמידה לשבוע הבא. הבחירה לא מפרסמת כלום." />
      {!rows ? <Loading>טוענת את הגרסאות...</Loading> : rows.length === 0 ? (
        <Note>עוד אין גרסאות לבחירה. התוכן השבועי נכנס לכאן בכל מוצאי שבת.</Note>
      ) : (
        <>
          <div className="space-y-3">{rows.map((r) => <PostCard key={r.id} row={r} onSaved={(draft) => setRows((rs) => rs!.map((x) => (x.id === r.id ? { ...x, draft } : x)))} />)}</div>
        </>
      )}
    </>
  );
}

function PostCard({ row, onSaved }: { row: Row; onSaved: (d: Draft) => void }) {
  const d = row.draft;
  const variants = d.data.variants ?? [];
  // בלי המתנה: עד שהיא בוחרת אחרת, גרסה A היא ברירת המחדל
  const chosenId = d.data.chosen_variant ?? variants[0]?.id;
  const explicit = !!d.data.chosen_variant;
  const [open, setOpen] = useState(!explicit);
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!open) return;
    const paths = variants.flatMap((v) => [v.video?.path, v.video?.cover, ...(v.carousel?.slides ?? []).map((s) => (s.image?.kind === "storage" ? s.image.path : undefined))]).filter(Boolean) as string[];
    signAll([...new Set(paths)]).then(setUrls);
  }, [d.id, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (data: Draft["data"], msg?: string) => {
    const { data: saved, error } = await db().from("studio_drafts").update({ data }).eq("id", d.id).select("*").single();
    if (error) return toast(error.message, true);
    onSaved(saved as Draft);
    if (msg) toast(msg);
  };
  const choose = (v: Variant) => {
    if (v.id === chosenId && explicit) return;
    save({ ...d.data, chosen_variant: v.id, ...(v.video ? { video: v.video } : {}), ...(v.carousel ? { carousel: v.carousel } : {}) }, `נבחרה גרסה ${v.id}`).then(() => setOpen(false));
  };
  // אהבתי / לא אהבתי: נשמר על הגרסה, וגם נכנס ללמידה (studio_feedback)
  const react = async (v: Variant, reaction: "like" | "dislike") => {
    const next = v.reaction === reaction ? undefined : reaction;
    await save({ ...d.data, variants: variants.map((x) => (x.id === v.id ? { ...x, reaction: next } : x)) });
    if (next) await db().from("studio_feedback").insert({ kind: "idea", text: `${row.title} · גרסה ${v.id}: ${v.label}`, verdict: next, account: d.account });
  };
  const comment = (v: Variant, text: string) => save({ ...d.data, variants: variants.map((x) => (x.id === v.id ? { ...x, comment: text } : x)) }, "ההערה נשמרה");
  const type = row.content_type || d.data.content_type;
  const chosen = variants.find((v) => v.id === chosenId);

  if (!open) {
    // פוסט שנבחר: שורה אחת
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex w-full flex-wrap items-center gap-2 rounded-2xl border border-[#E2DACD] bg-[#FBF8F2] px-4 py-3 text-right hover:bg-[#F4EFE6]">
        <span className="text-[12px] font-bold text-[#6F675C]">{row.planned_date ? formatDate(row.planned_date) : "בלי תאריך"}</span>
        <span className="font-semibold">{row.title}</span>
        {type && <Tag tone="butter">{labelOf(CONTENT_TYPES, type)}</Tag>}
        <span className="ms-auto text-[13px]"><Tag tone="green">נבחר: {chosen?.id} · {chosen?.label}</Tag></span>
        <span className="text-[12px] underline underline-offset-4">לשנות</span>
      </button>
    );
  }

  return (
    <Panel label={`${row.planned_date ? formatDate(row.planned_date) : "בלי תאריך"} · ${row.format === "carousel" ? "קרוסלה" : "ריל"}`} title={row.title}
      aside={<span className="flex flex-wrap items-center gap-1">{type && <Tag tone="butter">{labelOf(CONTENT_TYPES, type)}</Tag>}<Tag tone={explicit ? "green" : undefined}>{explicit ? `נבחר: ${chosenId}` : `ברירת מחדל: ${chosenId}`}</Tag>{explicit && <button type="button" className="text-[12px] underline" onClick={() => setOpen(false)}>לסגור</button>}</span>}>
      <p className="mb-3 text-[12px] text-[#6F675C]">לוחצים על גרסה כדי לבחור בה. בלי בחירה, גרסה {variants[0]?.id} עולה כברירת מחדל.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {variants.map((v) => <VariantCard key={v.id} v={v} urls={urls} chosen={chosenId === v.id} onChoose={() => choose(v)} onReact={(r) => react(v, r)} onComment={(t) => comment(v, t)} />)}
      </div>
      <div className="mt-3 text-[12px] text-[#6F675C]"><Link href={`/studio/reel?id=${d.id}`} className="underline">לפתוח את הטיוטה</Link></div>
    </Panel>
  );
}

function VariantCard({ v, urls, chosen, onChoose, onReact, onComment }: { v: Variant; urls: Record<string, string>; chosen: boolean; onChoose: () => void; onReact: (r: "like" | "dislike") => void; onComment: (t: string) => void }) {
  const [text, setText] = useState(v.comment ?? "");
  const [writing, setWriting] = useState(false);
  const [cover, setCover] = useState<string | null>(null);
  const n = v.carousel?.slides.length ?? 0;
  const key = Object.keys(urls).length;
  useEffect(() => {
    if (!v.carousel) return;
    // בקרוסלה מציגים רק את השער: השאר זהה בין הגרסאות
    const first = v.carousel.slides[0];
    const img = first?.image?.kind === "storage" ? urls[first.image.path] : undefined;
    if (first?.image?.kind === "storage" && !img) return;
    renderSlide(v.carousel, 0, img ? { 0: img } : {}).then((c) => setCover(c.toDataURL("image/jpeg", 0.85))).catch(() => setCover(null));
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={cn("overflow-hidden rounded-xl border bg-[#FBF8F2]", chosen ? "border-2 border-[#3E6B4F] shadow-[0_0_0_3px_rgba(62,107,79,0.15)]" : "border-[#E2DACD]")}>
      <div role="button" tabIndex={0} onClick={onChoose} onKeyDown={(e) => e.key === "Enter" && onChoose()} className="relative cursor-pointer">
        {v.video ? (
          urls[v.video.path]
            ? <video src={urls[v.video.path]} controls playsInline preload="metadata" poster={v.video.cover ? urls[v.video.cover] : undefined} onClick={(e) => e.stopPropagation()} className="aspect-[9/16] w-full bg-black" />
            : <div className="aspect-[9/16] w-full animate-pulse bg-[#ECE7DE]" />
        ) : v.carousel ? (
          // eslint-disable-next-line @next/next/no-img-element
          cover ? <img src={cover} alt="שער" className="aspect-[4/5] w-full object-cover" /> : <div className="aspect-[4/5] w-full animate-pulse bg-[#ECE7DE]" />
        ) : null}
        {chosen && <span className="absolute right-2 top-2 rounded-md bg-[#3E6B4F] px-2 py-0.5 text-[11px] font-bold text-white">נבחר</span>}
        {v.carousel && <span className="absolute bottom-2 left-2 rounded-md bg-white/90 px-2 py-0.5 text-[11px] font-bold">{n} שקופיות</span>}
      </div>
      <div className="p-2.5">
        <button type="button" onClick={onChoose} className="block w-full text-right text-[13px] font-bold"><span className="s-serif me-1 text-base">{v.id}</span>{v.label}</button>
        <div className="mt-2 flex items-center gap-1.5">
          <button type="button" aria-label="אהבתי" onClick={() => onReact("like")} className={cn("rounded-lg border p-1.5", v.reaction === "like" ? "border-[#3E6B4F] bg-[#E2ECDF]" : "border-[#E2DACD]")}><ThumbsUp className="size-4" /></button>
          <button type="button" aria-label="לא אהבתי" onClick={() => onReact("dislike")} className={cn("rounded-lg border p-1.5", v.reaction === "dislike" ? "border-[#A3402F] bg-[#F4E1D2]" : "border-[#E2DACD]")}><ThumbsDown className="size-4" /></button>
          <button type="button" onClick={() => setWriting(!writing)} className="ms-auto text-[12px] underline underline-offset-4">{v.comment ? "ההערה שלך" : "הערה"}</button>
        </div>
        {writing && (
          <div className="mt-2">
            <textarea rows={2} className={inputCls} value={text} onChange={(e) => setText(e.target.value)} placeholder="מה אהבת, מה לשנות" />
            {text !== (v.comment ?? "") && <Btn variant="ghost" className="mt-1 px-0" onClick={() => { onComment(text); setWriting(false); }}>לשמור</Btn>}
          </div>
        )}
      </div>
    </div>
  );
}
