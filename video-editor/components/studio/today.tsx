"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CONTENT_TYPES, labelOf, type Draft } from "@/lib/studio/config";
import { db, formatDate } from "@/lib/studio/client";
import { MEDIA_BUCKET } from "@/lib/supabase/env";
import { Btn, Label, Loading, Note, Panel, Tag, toast } from "./ui";
import { cn } from "@/lib/utils";
import { variantLabel } from "@/lib/studio/reel-timeline";
import { ItemActions } from "./item-actions";

interface Item { id: string; title: string; account: string; format: string; stage: string; planned_date: string | null; hook: string; caption: string; notes?: string | null; content_type?: string | null; draft_id: string | null }

const DAY = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const sundayOf = (iso: string) => addDays(iso, -new Date(`${iso}T12:00:00`).getDay());
const FORMAT: Record<string, string> = { reel: "ריל", carousel: "קרוסלה", story: "סטורי", image: "תמונה" };

/** שער הסרטון או התמונה של השקופית הראשונה, מהגרסה שנבחרה (או הראשונה) */
export function thumbPath(d?: Draft): string | null {
  if (!d) return null;
  const v = d.data.variants?.find((x) => x.id === d.data.chosen_variant) ?? d.data.variants?.[0];
  const video = v?.video ?? d.data.video;
  if (video?.cover) return video.cover;
  const slides = (v?.carousel ?? d.data.carousel)?.slides ?? [];
  const img = slides.find((s) => s.image?.kind === "storage")?.image;
  if (img?.kind === "storage") return img.path;
  // קרוסלה עם תמונות מהדרייב: התמונה של השקופית הראשונה שיש לה תמונה
  const drive = slides.find((s) => s.image?.kind === "drive")?.image;
  if (drive?.kind === "drive") return `drive:${drive.id}`;
  const m = d.data.materials;
  const first = [...(m?.matches ?? [])].sort((a, b) => (Number(a.target.match(/\d+/)?.[0]) || 99) - (Number(b.target.match(/\d+/)?.[0]) || 99))
    .map((x) => m?.files.find((f) => f.id === x.file_id)).find((f) => f?.mimeType.startsWith("image/"));
  return first ? `drive:${first.id}` : null;
}

/** כתובות לתמונות הממוזערות: קבצים בספרייה נחתמים, תמונות מהדרייב עוברות דרך השרת */
export async function signThumbs(paths: string[]) {
  const drive = paths.filter((p) => p.startsWith("drive:"));
  const store = paths.filter((p) => !p.startsWith("drive:"));
  const { data: signed } = store.length ? await db().storage.from(MEDIA_BUCKET).createSignedUrls(store, 6 * 60 * 60) : { data: [] };
  return {
    ...Object.fromEntries((signed ?? []).flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl]] : []))),
    ...Object.fromEntries(drive.map((p) => [p, `/api/studio/drive-thumb?id=${encodeURIComponent(p.slice(6))}&size=600`])),
  } as Record<string, string>;
}

/** פוסט מוכן: יש לו סרטון, קרוסלה, ריל מהסטודיו או פרויקט בעורך */
export const isReady = (d?: Draft) => !!d && !!(thumbPath(d) || d.data.edit || d.project_id || d.data.video || d.data.carousel);

/** הסרטון המוכן של הגרסה שנבחרה (אם יש קובץ) */
const readyVideo = (d?: Draft) => {
  const v = d?.data.variants?.find((x) => x.id === d.data.chosen_variant) ?? d?.data.variants?.[0];
  return v?.video ?? d?.data.video ?? null;
};

/**
 * "לשלוח לאינסטגרם" ישר מהכרטיס, כשיש קובץ מוכן. הקובץ נטען בלחיצה ואז נפתח חלון השיתוף.
 * אם הטלפון חוסם שיתוף אחרי ההמתנה, הקובץ כבר מוכן ולחיצה שנייה שולחת מיד.
 */
function SendNow({ path, caption, name }: { path: string; caption: string; name: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const share = async (f: File) => {
    if (caption) await navigator.clipboard?.writeText(caption).catch(() => {});
    if (!navigator.canShare?.({ files: [f] })) {
      const a = document.createElement("a"); a.href = URL.createObjectURL(f); a.download = f.name; a.click();
      return toast("הסרטון ירד והכיתוב הועתק. שליחה ישירה עובדת מהטלפון");
    }
    try { await navigator.share({ files: [f] }); toast("הכיתוב הועתק. באינסטגרם: מוסיפים מוזיקה ומדביקים את הכיתוב"); }
    catch (e) { if ((e as Error).name === "NotAllowedError") toast("הקובץ מוכן. לוחצים שוב לשליחה"); }
  };
  const go = async () => {
    if (file) return share(file);
    setBusy(true);
    try {
      const { data } = await db().storage.from(MEDIA_BUCKET).createSignedUrl(path, 60 * 60);
      if (!data?.signedUrl) throw new Error("הקובץ לא נמצא");
      const f = new File([await (await fetch(data.signedUrl)).blob()], `${name.slice(0, 40) || "reel"}.mp4`, { type: "video/mp4" });
      setFile(f);
      await share(f);
    } catch (e) { toast((e as Error).message, true); }
    finally { setBusy(false); }
  };
  return <Btn busy={busy} onClick={go} className="min-h-[46px] w-full text-[15px]">{busy ? "מכינה את הסרטון..." : file ? "לשלוח עכשיו" : "לשלוח לאינסטגרם"}</Btn>;
}

async function loadRange(from: string, to: string) {
  const { data } = await db().from("studio_items").select("*").gte("planned_date", from).lte("planned_date", to).order("planned_date");
  const items = (data ?? []) as Item[];
  const ids = items.flatMap((i) => (i.draft_id ? [i.draft_id] : []));
  const { data: ds } = ids.length ? await db().from("studio_drafts").select("*").in("id", ids) : { data: [] };
  const drafts: Record<string, Draft> = Object.fromEntries((ds ?? []).map((d) => [d.id, d as Draft]));
  const paths = [...new Set(Object.values(drafts).map(thumbPath).filter(Boolean) as string[])];
  const thumbs = await signThumbs(paths);
  return { items, drafts, thumbs };
}

/** הפוסט של היום (ואם אין, הבא בתור): מה עולה, באיזו גרסה, ומה עושים עכשיו */
export function TodayPost({ today }: { today: string }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof loadRange>> | null>(null);
  useEffect(() => { loadRange(today, addDays(today, 6)).then(setData); }, [today]);
  if (!data) return <Panel label="מה עולה היום"><Loading /></Panel>;
  const todays = data.items.filter((i) => i.planned_date === today && i.stage !== "published");
  const next = todays[0] ?? data.items.find((i) => i.stage !== "published");
  if (!next) return <Panel label="מה עולה היום"><Note>אין פוסט משובץ השבוע. התוכן השבועי נכנס כל מוצאי שבת.</Note></Panel>;
  const d = next.draft_id ? data.drafts[next.draft_id] : undefined;
  const thumb = data.thumbs[thumbPath(d) ?? ""];
  const variants = d?.data.variants?.length ?? 0;
  const chosenId = d?.data.chosen_variant ?? d?.data.variants?.[0]?.id;
  const type = next.content_type || d?.data.content_type;
  const isToday = next.planned_date === today;
  // הטיוטה היא המקור: הכיתוב מהקרוסלה או מהריל, ורק אם אין, מהלוח
  const caption = d?.data.carousel?.caption || d?.data.caption || next.caption || "";
  return (
    <Panel label={isToday ? "מה עולה היום" : `הבא בתור · ${formatDate(next.planned_date)}`} title={next.title}>
      <div className="-mt-1 mb-3 flex flex-wrap gap-1.5">
        <Tag>{FORMAT[next.format] ?? next.format}</Tag>
        {type && <Tag tone="butter">{labelOf(CONTENT_TYPES, type)}</Tag>}
        {d && (d.data.edit || variants > 1) && <Tag>גרסה {d.data.edit ? variantLabel(d.data.chosen_variant) : chosenId}</Tag>}
      </div>
      <div className="flex gap-4">
        <Link href={d ? `/studio/reel?id=${d.id}` : "/studio/board"} className={cn("w-[96px] shrink-0 overflow-hidden rounded-2xl border border-[#E3D9CC] bg-[#F2ECE4] shadow-[0_10px_24px_-16px_rgba(94,29,29,0.6)]", next.format === "carousel" ? "aspect-[4/5]" : "aspect-[9/16]")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {thumb ? <img src={thumb} alt="" className="size-full object-cover" /> : <p className="p-2 text-[11px] font-bold">{next.hook}</p>}
        </Link>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
          <p className="text-[14px] leading-relaxed text-[#4E4540]">
            {!d ? "עוד אין טיוטה לפוסט הזה." : isReady(d) ? "שולחים מהטלפון, מוסיפים מוזיקה טרנדית, ומפרסמים או שומרים כטיוטה." : "יש תסריט ורשימת שוטים. מצלמים ומעלים לדרייב, והריל נבנה מהם."}
          </p>
          <p className="text-[11px] text-[#9A8C85]">הסטודיו לא מפרסם בעצמו.</p>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {d && (
          readyVideo(d)
            ? <SendNow path={readyVideo(d)!.path} caption={caption} name={next.title} />
            : <Link href={`/studio/reel?id=${d.id}`} className="flex min-h-[46px] w-full items-center justify-center rounded-xl bg-[#5E1D1D] px-4 text-[15px] font-bold text-[#FAF6F1] shadow-[0_6px_16px_-10px_rgba(94,29,29,0.9)]">
                {d.data.edit || d.data.carousel || d.project_id ? "לשלוח לאינסטגרם" : "לפתוח את התסריט"}
              </Link>
        )}
        <div className="flex gap-2 [&>*]:flex-1 [&>*]:whitespace-nowrap">
          {d && readyVideo(d) && <Link href={`/studio/reel?id=${d.id}`} className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-[#5E1D1D]/50 bg-white/60 px-3 text-[13px] font-bold text-[#5E1D1D]">לפתוח</Link>}
          {caption && <Btn variant="line" className="px-3 text-[13px]" onClick={() => navigator.clipboard.writeText(caption).then(() => toast("הכיתוב הועתק"))}>להעתיק כיתוב</Btn>}
          {variants > 1 && <Link href="/studio/pick" className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-[#E3D9CC] bg-white/60 px-3 text-[13px] font-bold text-[#5E1D1D]">להחליף גרסה</Link>}
        </div>
      </div>
    </Panel>
  );
}

/** השבוע בקטן, פעם אחת: יום ותמונה לכל פוסט. הלוח המלא בלשונית תכנון */
export function WeekStrip({ today }: { today: string }) {
  const start = sundayOf(today);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(start, i)), [start]);
  const [data, setData] = useState<Awaited<ReturnType<typeof loadRange>> | null>(null);
  useEffect(() => { loadRange(days[0], days[6]).then(setData); }, [days]);
  return (
    <section className="rounded-2xl border border-[#E3D9CC] bg-[#FAF6F1] p-3">
      <div className="mb-2 flex items-center justify-between">
        <Label>השבוע</Label>
        <Link href="/studio/board" className="text-[12px] font-bold underline underline-offset-4">ללוח המלא</Link>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d, i) => {
          const list = data?.items.filter((x) => x.planned_date === d) ?? [];
          return (
            <div key={d} className={cn("min-w-0 rounded-xl p-1", d === today && "bg-[#EFD9DD]/50")}>
              <p className={cn("mb-1 text-center text-[11px] font-bold", d === today ? "text-[#2A2622]" : "text-[#6A6158]")}>{DAY[i]} {Number(d.slice(8))}</p>
              {list.map((x) => {
                const dr = x.draft_id ? data!.drafts[x.draft_id] : undefined;
                const t = data!.thumbs[thumbPath(dr) ?? ""];
                return (
                  <Link key={x.id} href={dr ? `/studio/reel?id=${dr.id}` : "/studio/board"} title={x.title} className="mb-1 block overflow-hidden rounded-lg border border-[#E3D9CC] bg-[#F2ECE4]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {t ? <img src={t} alt="" className="aspect-square w-full object-cover" /> : <p className="line-clamp-3 p-1 text-[10px] font-semibold leading-tight">{x.title}</p>}
                    <p className="truncate px-1 py-0.5 text-[10px] font-bold">{FORMAT[x.format] ?? x.format}</p>
                  </Link>
                );
              })}
              {!list.length && <div className="aspect-square rounded-lg border border-dashed border-[#E3D9CC]" />}
            </div>
          );
        })}
      </div>
    </section>
  );
}

const DAY_NAME = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const longDate = (iso: string) => new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long" }).format(new Date(`${iso}T12:00:00`));

/**
 * השבוע, בגדול ובנקי: כותרת, שורה בכתב יד, ושבעה ימים עם התמונות של הפוסטים.
 * בטלפון מחליקים בין הימים. לוחצים על פוסט כדי לפתוח אותו, ועל יום ריק כדי לשבץ בו משהו.
 */
export function WeekBoard({ today }: { today: string }) {
  const start = sundayOf(today);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(start, i)), [start]);
  const [data, setData] = useState<Awaited<ReturnType<typeof loadRange>> | null>(null);
  useEffect(() => { loadRange(days[0], days[6]).then(setData); }, [days]);
  const items = data?.items ?? [];
  const types = new Set(items.map((x) => x.content_type || (x.draft_id ? data?.drafts[x.draft_id]?.data.content_type : null)).filter(Boolean));
  return (
    <section className="rounded-[28px] border border-[#E3D9CC] bg-[#FFFDFB] p-4 shadow-[0_24px_50px_-40px_rgba(94,29,29,0.6)] md:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="s-accent text-[34px] leading-none md:text-5xl">השבוע של {longDate(start)}</h1>
          <p className="mt-1.5 text-[22px] leading-none text-[#B5848E] md:text-[26px]" style={{ fontFamily: '"Gveret Levin", "Assistant", sans-serif' }}>
            {data ? (items.length ? `${items.length} פוסטים, ${types.size} מתוך 4 סוגי תוכן` : "עוד אין פוסטים השבוע") : "\u00a0"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/studio/replan" className="inline-flex min-h-[40px] items-center rounded-xl border border-[#5E1D1D]/40 bg-white px-4 text-[13px] font-bold text-[#5E1D1D] hover:border-[#5E1D1D]">לתכנן מחדש</Link>
          <Link href="/studio/own-video" className="inline-flex min-h-[40px] items-center rounded-xl bg-[#5E1D1D] px-4 text-[13px] font-bold text-[#FAF6F1] shadow-[0_6px_16px_-10px_rgba(94,29,29,0.9)]">+ ריל מהסרטונים שלי</Link>
        </div>
      </div>

      <div className="-mx-4 mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-7 md:overflow-visible md:px-0">
        {days.map((d) => {
          const list = items.filter((x) => x.planned_date === d);
          const isToday = d === today;
          return (
            <div key={d} className="w-[44%] shrink-0 snap-start sm:w-[30%] md:w-auto">
              <p className={cn("mb-2 flex items-center gap-1.5 text-[13px] font-bold", isToday ? "text-[#5E1D1D]" : "text-[#9A8C85]")}>
                {DAY_NAME[new Date(`${d}T12:00:00`).getDay()]} {Number(d.slice(8))}
                {isToday && <span className="rounded-full bg-[#5E1D1D] px-2 py-0.5 text-[10px] text-[#FAF6F1]">היום</span>}
              </p>
              {!data && <div className="aspect-[4/5] animate-pulse rounded-2xl bg-[#F2ECE4]" />}
              {list.map((x) => {
                const dr = x.draft_id ? data!.drafts[x.draft_id] : undefined;
                const t = data!.thumbs[thumbPath(dr) ?? ""];
                const type = x.content_type || dr?.data.content_type;
                return (
                  <div key={x.id} className={cn("mb-2.5 overflow-hidden rounded-2xl border bg-white transition hover:shadow-[0_16px_30px_-20px_rgba(94,29,29,0.7)]", x.stage === "published" ? "border-[#3E6B4F]" : isToday ? "border-[#5E1D1D] ring-2 ring-[#EFD9DD]" : "border-[#E3D9CC]")}>
                  <Link href={dr ? `/studio/reel?id=${dr.id}` : "/studio/board"} className="group block">
                    <div className="relative aspect-[4/5] overflow-hidden bg-[#F2ECE4]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {t ? <img src={t} alt="" className="size-full object-cover transition duration-500 group-hover:scale-[1.04]" />
                        : <p className="flex size-full items-center justify-center p-3 text-center text-[13px] font-bold leading-snug text-[#5E1D1D]" style={{ background: "linear-gradient(160deg,#F7E4E7,#EFD9DD)" }}>{x.hook || x.title}</p>}
                      <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-[#5E1D1D] backdrop-blur">{FORMAT[x.format] ?? x.format}</span>
                      {x.stage === "published" && <span className="absolute left-2 top-2 rounded-full bg-[#3E6B4F] px-2 py-0.5 text-[10px] font-bold text-white">פורסם</span>}
                    </div>
                    <div className="p-2.5">
                      <p className="line-clamp-2 text-[13px] font-bold leading-snug text-[#2A2622]">{x.title}</p>
                      {type && <p className="mt-1 text-[11px] font-semibold text-[#B5848E]">{labelOf(CONTENT_TYPES, type)}</p>}
                    </div>
                  </Link>
                  <div className="px-2 pb-2"><ItemActions item={x} onChange={() => loadRange(days[0], days[6]).then(setData)} /></div>
                  </div>
                );
              })}
              {data && !list.length && (
                <Link href="/studio/replan" className="flex aspect-[4/5] items-center justify-center rounded-2xl border-2 border-dashed border-[#E3D9CC] text-[13px] font-bold text-[#B5A79E] transition hover:border-[#B5848E] hover:text-[#5E1D1D]">
                  + לשבץ
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
