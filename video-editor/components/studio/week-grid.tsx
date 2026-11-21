"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, GalleryHorizontal, Image as ImageIcon, PlaySquare, Smartphone } from "lucide-react";
import { CONTENT_TYPES, labelOf, type Draft } from "@/lib/studio/config";
import { db, todayIL } from "@/lib/studio/client";
import { MEDIA_BUCKET } from "@/lib/supabase/env";
import { Label, Title } from "./ui";
import { cn } from "@/lib/utils";

interface Item { id: string; title: string; account: string; format: string; stage: string; planned_date: string | null; hook: string; content_type?: string | null; draft_id: string | null }

const ROWS = [
  { format: "reel", label: "ריל", icon: PlaySquare },
  { format: "carousel", label: "קרוסלה", icon: GalleryHorizontal },
  { format: "story", label: "סטורי", icon: Smartphone },
  { format: "image", label: "תמונה", icon: ImageIcon },
] as const;
const DAY = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const STAGE_TONE: Record<string, string> = { idea: "#ECE7DE", draft: "#F6E7A6", review: "#F4E1D2", approved: "#E2ECDF", published: "#DDE7F0" };
const STAGE_LABEL: Record<string, string> = { idea: "רעיון", draft: "טיוטה", review: "ממתין לאישור", approved: "מאושר", published: "פורסם" };

/** יום ראשון של השבוע של תאריך (YYYY-MM-DD), בשעון ישראל */
function sundayOf(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
}
const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const dayNum = (iso: string) => Number(iso.slice(8, 10));
const longDate = (iso: string) => new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long" }).format(new Date(`${iso}T12:00:00`));

/** התמונה הממוזערת של פוסט: שער הסרטון, או התמונה של השקופית הראשונה, מהגרסה שנבחרה (או הראשונה) */
function thumbPath(d?: Draft): string | null {
  if (!d) return null;
  const data = d.data;
  const v = data.variants?.find((x) => x.id === data.chosen_variant) ?? data.variants?.[0];
  const video = v?.video ?? data.video;
  if (video?.cover) return video.cover;
  const car = v?.carousel ?? data.carousel;
  const img = car?.slides.find((s) => s.image?.kind === "storage")?.image;
  return img?.kind === "storage" ? img.path : null;
}

/** השבוע בלוח: עמודה לכל יום, שורה לכל פורמט, תמונה ממוזערת לכל פוסט */
export function WeekGrid({ account = "all" }: { account?: string }) {
  const [start, setStart] = useState(() => sundayOf(todayIL()));
  const [items, setItems] = useState<Item[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(start, i)), [start]);
  const end = days[6];

  const load = useCallback(async () => {
    setItems(null);
    const { data } = await db().from("studio_items").select("*").gte("planned_date", start).lte("planned_date", end).order("planned_date");
    const list = ((data ?? []) as Item[]).filter((i) => account === "all" || i.account === account);
    setItems(list);
    const ids = list.flatMap((i) => (i.draft_id ? [i.draft_id] : []));
    if (!ids.length) return;
    const { data: ds } = await db().from("studio_drafts").select("*").in("id", ids);
    const byId: Record<string, Draft> = Object.fromEntries((ds ?? []).map((d) => [d.id, d as Draft]));
    setDrafts(byId);
    const paths = [...new Set(Object.values(byId).map(thumbPath).filter(Boolean) as string[])];
    if (paths.length) {
      const { data: signed } = await db().storage.from(MEDIA_BUCKET).createSignedUrls(paths, 6 * 60 * 60);
      setThumbs(Object.fromEntries((signed ?? []).flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl]] : []))));
    }
  }, [start, end, account]);
  useEffect(() => { load(); }, [load]);

  const today = todayIL();
  const rows = ROWS.filter((r) => r.format === "reel" || r.format === "carousel" || items?.some((i) => i.format === r.format));
  const withMedia = items?.filter((i) => i.draft_id && thumbPath(drafts[i.draft_id])).length ?? 0;

  return (
    <section className="rounded-2xl border border-[#E2DACD] bg-[#FBF8F2] p-4 shadow-[0_1px_2px_rgba(31,27,22,0.06)]">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <Label>לוח השבוע</Label>
          <Title size="lg" accent={longDate(start)}>השבוע של</Title>
        </div>
        <div className="flex items-center gap-2">
          {items && <span className="rounded-full border border-[#E2DACD] bg-white/70 px-3 py-1 text-[12px] font-bold">{items.length} פוסטים משובצים{items.length ? ` · ${withMedia} עם קבצים` : ""}</span>}
          <button type="button" aria-label="השבוע הקודם" onClick={() => setStart(addDays(start, -7))} className="rounded-lg border border-[#E2DACD] bg-white/70 p-1.5"><ChevronRight className="size-4" /></button>
          <button type="button" onClick={() => setStart(sundayOf(today))} className="rounded-lg border border-[#E2DACD] bg-white/70 px-2.5 py-1 text-[12px] font-bold">השבוע</button>
          <button type="button" aria-label="השבוע הבא" onClick={() => setStart(addDays(start, 7))} className="rounded-lg border border-[#E2DACD] bg-white/70 p-1.5"><ChevronLeft className="size-4" /></button>
        </div>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="grid min-w-[760px] grid-cols-[72px_repeat(7,minmax(0,1fr))] gap-2">
          <div />
          {days.map((d, i) => (
            <div key={d} className={cn("rounded-lg px-2 py-1 text-center text-[12px] font-bold", d === today ? "bg-[#1F1B16] text-[#FBF8F2]" : "text-[#4E473E]")}>
              {DAY[i]} {dayNum(d)}
            </div>
          ))}
          {rows.map((r) => (
            <Row key={r.format} label={r.label} Icon={r.icon}>
              {days.map((d) => {
                const cell = (items ?? []).filter((i) => i.planned_date === d && i.format === r.format);
                return (
                  <div key={d} className={cn("min-h-[150px] space-y-2 rounded-xl p-1", d === today && "bg-[#F6E7A6]/30")}>
                    {cell.map((i) => <Cell key={i.id} item={i} draft={i.draft_id ? drafts[i.draft_id] : undefined} thumb={thumbs[thumbPath(i.draft_id ? drafts[i.draft_id] : undefined) ?? ""]} />)}
                    {!cell.length && <div className="h-full min-h-[140px] rounded-xl border border-dashed border-[#E2DACD]" />}
                  </div>
                );
              })}
            </Row>
          ))}
        </div>
      </div>
      {!items && <p className="mt-2 text-[12px] text-[#6F675C]">טוענת...</p>}
    </section>
  );
}

function Row({ label, Icon, children }: { label: string; Icon: typeof PlaySquare; children: React.ReactNode }) {
  return (
    <>
      <div className="flex flex-col items-center justify-center gap-1 text-[11px] font-bold text-[#6F675C]"><Icon className="size-4" />{label}</div>
      {children}
    </>
  );
}

function Cell({ item, draft, thumb }: { item: Item; draft?: Draft; thumb?: string }) {
  const variants = draft?.data.variants?.length ?? 0;
  const waiting = variants > 1 && !draft?.data.chosen_variant;
  const href = waiting ? "/studio/pick" : draft ? `/studio/reel?id=${draft.id}` : "/studio/board";
  const type = item.content_type || draft?.data.content_type;
  return (
    <Link href={href} className="group relative block overflow-hidden rounded-xl border border-[#E2DACD] bg-[#2A2622] shadow-[0_1px_2px_rgba(31,27,22,0.12)]">
      <div className={cn("relative w-full", item.format === "carousel" ? "aspect-[4/5]" : "aspect-[9/16] max-h-[190px]")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {thumb ? <img src={thumb} alt="" className="absolute inset-0 size-full object-cover" /> : (
          <div className="absolute inset-0 flex items-center bg-[#F4EFE6] p-2 text-[11px] font-bold leading-snug text-[#1F1B16]">{item.hook || item.title}</div>
        )}
        <span className="absolute right-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-[#1F1B16]" style={{ background: STAGE_TONE[item.stage] ?? "#ECE7DE" }}>{STAGE_LABEL[item.stage] ?? item.stage}</span>
        {waiting && <span className="absolute left-1.5 top-1.5 rounded-md bg-[#1F1B16] px-1.5 py-0.5 text-[10px] font-bold text-[#FBF8F2]">{variants} גרסאות</span>}
        <span className="absolute bottom-1.5 right-1.5 rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-bold text-[#1F1B16]">
          {item.format === "carousel" ? "קרוסלה" : item.format === "reel" ? "ריל" : item.format === "story" ? "סטורי" : "תמונה"}{type ? ` · ${labelOf(CONTENT_TYPES, type)}` : ""}
        </span>
      </div>
      <p className="truncate bg-[#FBF8F2] px-2 py-1 text-[11px] font-semibold text-[#1F1B16]" title={item.title}>{item.title}</p>
    </Link>
  );
}
