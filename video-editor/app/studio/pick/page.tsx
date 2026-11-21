"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CONTENT_TYPES, labelOf, type Draft, type Variant } from "@/lib/studio/config";
import { db, formatDate } from "@/lib/studio/client";
import { renderAll } from "@/lib/studio/carousel-render";
import { MEDIA_BUCKET } from "@/lib/supabase/env";
import { Btn, Label, Loading, Note, PageHead, Panel, Tag, inputCls, toast } from "@/components/studio/ui";
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

  const open = rows?.filter((r) => !r.draft.data.chosen_variant).length ?? 0;
  return (
    <>
      <PageHead label="תכנון" title="לבחירה" accent="השבוע"
        sub="כל פוסט עם כל הגרסאות שלו. בוחרים גרסה, ומשאירים הערה על מה שאהבת או לא. ההערות נכנסות לתוכן של השבוע הבא. הבחירה לא מפרסמת כלום." />
      {!rows ? <Loading>טוענת את הגרסאות...</Loading> : rows.length === 0 ? (
        <Note>עוד אין גרסאות לבחירה. התוכן השבועי נכנס לכאן בכל מוצאי שבת.</Note>
      ) : (
        <>
          <p className="mb-4 text-sm text-[#4E473E]">{open ? `${open} פוסטים מחכים לבחירה שלך` : "בחרת בכל הפוסטים. אפשר לשנות בחירה בכל רגע."}</p>
          <div className="space-y-6">{rows.map((r) => <PostCard key={r.id} row={r} onSaved={(draft) => setRows((rs) => rs!.map((x) => (x.id === r.id ? { ...x, draft } : x)))} />)}</div>
        </>
      )}
    </>
  );
}

function PostCard({ row, onSaved }: { row: Row; onSaved: (d: Draft) => void }) {
  const d = row.draft;
  const variants = d.data.variants ?? [];
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    const paths = variants.flatMap((v) => [v.video?.path, ...(v.carousel?.slides ?? []).map((s) => (s.image?.kind === "storage" ? s.image.path : undefined))]).filter(Boolean) as string[];
    signAll([...new Set(paths)]).then(setUrls);
  }, [d.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (data: Draft["data"], msg?: string) => {
    const { data: saved, error } = await db().from("studio_drafts").update({ data }).eq("id", d.id).select("*").single();
    if (error) return toast(error.message, true);
    onSaved(saved as Draft);
    if (msg) toast(msg);
  };
  const choose = (v: Variant) => save({ ...d.data, chosen_variant: v.id, ...(v.video ? { video: v.video } : {}), ...(v.carousel ? { carousel: v.carousel } : {}) }, `נבחרה גרסה ${v.id}`);
  const comment = (v: Variant, text: string) => save({ ...d.data, variants: variants.map((x) => (x.id === v.id ? { ...x, comment: text } : x)) }, "ההערה נשמרה");

  return (
    <Panel label={`${row.planned_date ? formatDate(row.planned_date) : "בלי תאריך"} · ${row.format === "carousel" ? "קרוסלה" : "ריל"}`} title={row.title}
      aside={<span className="flex flex-wrap gap-1">{(row.content_type || d.data.content_type) && <Tag tone="butter">{labelOf(CONTENT_TYPES, (row.content_type || d.data.content_type)!)}</Tag>}{d.data.chosen_variant ? <Tag tone="green">נבחר: {d.data.chosen_variant}</Tag> : <Tag tone="wine">מחכה לבחירה</Tag>}</span>}>
      <div className={cn("grid gap-4", row.format === "carousel" ? "lg:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3")}>
        {variants.map((v) => <VariantCard key={v.id} v={v} urls={urls} chosen={d.data.chosen_variant === v.id} onChoose={() => choose(v)} onComment={(t) => comment(v, t)} />)}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-[#6F675C]">
        <Link href={`/studio/reel?id=${d.id}`} className="underline">לפתוח את הטיוטה</Link>
        <span>· הגרסה שנבחרה היא זו שתופיע בטיוטה ובלוח</span>
      </div>
    </Panel>
  );
}

function VariantCard({ v, urls, chosen, onChoose, onComment }: { v: Variant; urls: Record<string, string>; chosen: boolean; onChoose: () => void; onComment: (t: string) => void }) {
  const [text, setText] = useState(v.comment ?? "");
  const [slides, setSlides] = useState<string[] | null>(null);
  const key = JSON.stringify(Object.keys(urls).length);
  useEffect(() => {
    if (!v.carousel) return;
    const imgs: Record<number, string> = {};
    v.carousel.slides.forEach((s, i) => { if (s.image?.kind === "storage" && urls[s.image.path]) imgs[i] = urls[s.image.path]; });
    if (v.carousel.slides.some((s) => s.image?.kind === "storage") && !Object.keys(imgs).length) return;
    renderAll(v.carousel, imgs).then(setSlides).catch(() => setSlides([]));
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={cn("rounded-xl border bg-[#FBF8F2] p-3", chosen ? "border-2 border-[#3E6B4F]" : "border-[#E2DACD]")}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-bold"><span className="s-serif me-1 text-lg">{v.id}</span>{v.label}</span>
        {chosen && <Tag tone="green">נבחר</Tag>}
      </div>
      {v.video ? (
        urls[v.video.path]
          ? <video src={urls[v.video.path]} controls playsInline preload="metadata" poster={v.video.cover ? urls[v.video.cover] : undefined} className="aspect-[9/16] w-full rounded-lg bg-black" />
          : <div className="aspect-[9/16] w-full animate-pulse rounded-lg bg-[#ECE7DE]" />
      ) : v.carousel ? (
        slides ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {slides.map((src, i) => <img key={i} src={src} alt={`שקופית ${i + 1}`} className="h-[220px] w-[176px] shrink-0 rounded-lg border border-[#E2DACD] object-cover" />)}
          </div>
        ) : <Loading>מכינה את השקופיות...</Loading>
      ) : null}
      <Btn className="mt-3 w-full" variant={chosen ? "line" : "solid"} onClick={onChoose}>{chosen ? "הגרסה שנבחרה" : "לבחור בגרסה הזאת"}</Btn>
      <Label className="mb-1 mt-3">הערה על הגרסה</Label>
      <textarea rows={2} className={inputCls} value={text} onChange={(e) => setText(e.target.value)} placeholder="מה אהבת, מה לשנות" />
      {text !== (v.comment ?? "") && <Btn variant="ghost" className="mt-1 px-0" onClick={() => onComment(text)}>לשמור הערה</Btn>}
    </div>
  );
}
