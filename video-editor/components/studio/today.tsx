"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CONTENT_TYPES, labelOf, type Draft } from "@/lib/studio/config";
import { db, formatDate } from "@/lib/studio/client";
import { MEDIA_BUCKET } from "@/lib/supabase/env";
import { Btn, Label, Loading, Note, Panel, Tag, toast } from "./ui";
import { cn } from "@/lib/utils";
import { variantLabel } from "@/lib/studio/reel-timeline";

interface Item { id: string; title: string; account: string; format: string; stage: string; planned_date: string | null; hook: string; caption: string; content_type?: string | null; draft_id: string | null }

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
  const img = (v?.carousel ?? d.data.carousel)?.slides.find((s) => s.image?.kind === "storage")?.image;
  return img?.kind === "storage" ? img.path : null;
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
  return <Btn busy={busy} onClick={go}>{busy ? "מכינה את הסרטון..." : file ? "לשלוח עכשיו" : "לשלוח לאינסטגרם"}</Btn>;
}

async function loadRange(from: string, to: string) {
  const { data } = await db().from("studio_items").select("*").gte("planned_date", from).lte("planned_date", to).order("planned_date");
  const items = (data ?? []) as Item[];
  const ids = items.flatMap((i) => (i.draft_id ? [i.draft_id] : []));
  const { data: ds } = ids.length ? await db().from("studio_drafts").select("*").in("id", ids) : { data: [] };
  const drafts: Record<string, Draft> = Object.fromEntries((ds ?? []).map((d) => [d.id, d as Draft]));
  const paths = [...new Set(Object.values(drafts).map(thumbPath).filter(Boolean) as string[])];
  const { data: signed } = paths.length ? await db().storage.from(MEDIA_BUCKET).createSignedUrls(paths, 6 * 60 * 60) : { data: [] };
  const thumbs: Record<string, string> = Object.fromEntries((signed ?? []).flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl]] : [])));
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
    <Panel label={isToday ? "מה עולה היום" : `הבא בתור · ${formatDate(next.planned_date)}`} title={next.title}
      aside={<span className="flex flex-wrap gap-1"><Tag>{FORMAT[next.format] ?? next.format}</Tag>{type && <Tag tone="butter">{labelOf(CONTENT_TYPES, type)}</Tag>}</span>}>
      <div className="flex gap-4">
        <div className={cn("w-[120px] shrink-0 overflow-hidden rounded-xl border border-[#E3D9CC] bg-[#F2ECE4]", next.format === "carousel" ? "aspect-[4/5]" : "aspect-[9/16]")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {thumb ? <img src={thumb} alt="" className="size-full object-cover" /> : <p className="p-2 text-[11px] font-bold">{next.hook}</p>}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          {d ? (
            <>
              <p className="text-sm">{d.data.edit ? `גרסה ${variantLabel(d.data.chosen_variant)}. ` : variants > 1 ? `גרסה ${chosenId}${d.data.chosen_variant ? "" : " (ברירת מחדל)"}. ` : ""}{isReady(d) ? "שולחים לאינסטגרם מהטלפון, מוסיפים מוזיקה טרנדית ומפרסמים או שומרים כטיוטה." : "יש תסריט ורשימת שוטים. מצלמים, ואז עורכים בעורך הווידאו."}</p>
              {variants > 1 && <Link href="/studio/pick" className="inline-flex min-h-[36px] items-center text-[13px] underline underline-offset-4">להחליף גרסה</Link>}
              <div className="flex flex-wrap gap-2">
                {readyVideo(d) && <SendNow path={readyVideo(d)!.path} caption={caption} name={next.title} />}
                <Link href={`/studio/reel?id=${d.id}`} className={cn("inline-flex min-h-[40px] items-center rounded-[5px] px-3.5 py-2 text-[13px] font-bold", readyVideo(d) ? "border border-[#5E1D1D]" : "bg-[#5E1D1D] text-[#FAF6F1]")}>
                  {readyVideo(d) ? "לפתוח" : d.data.edit || d.data.carousel || d.project_id ? "לפתוח ולשלוח לאינסטגרם" : "לפתוח את התסריט ולצלם"}
                </Link>
              </div>
            </>
          ) : <p className="text-sm">עוד אין טיוטה לפוסט הזה.</p>}
          {caption && <Btn variant="line" onClick={() => navigator.clipboard.writeText(caption).then(() => toast("הכיתוב הועתק"))}>להעתיק כיתוב</Btn>}
          <p className="text-[11px] text-[#6A6158]">הסטודיו לא מפרסם בעצמו.</p>
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
