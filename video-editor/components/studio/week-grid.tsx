"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, GalleryHorizontal, Image as ImageIcon, PlaySquare, Smartphone } from "lucide-react";
import { CONTENT_TYPES, labelOf, type Draft } from "@/lib/studio/config";
import { db, todayIL } from "@/lib/studio/client";
import { Label, Title } from "./ui";
import { cn } from "@/lib/utils";
import { isReady, signThumbs, thumbPath } from "./today";
import { ItemActions } from "./item-actions";
import { CalendarConnect } from "./calendar-connect";

interface Item { id: string; title: string; account: string; format: string; stage: string; planned_date: string | null; post_time?: string | null; hook: string; notes?: string | null; content_type?: string | null; draft_id: string | null }

const ROWS = [
  { format: "reel", label: "ריל", icon: PlaySquare },
  { format: "carousel", label: "קרוסלה", icon: GalleryHorizontal },
  { format: "story", label: "סטורי", icon: Smartphone },
  { format: "image", label: "תמונה", icon: ImageIcon },
] as const;
const DAY = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
/** צבע לכל פורמט, כמו בלוח שנה: ריל צהוב, קרוסלה סגול, סטורי ורוד, תמונה כחול */
const FORMAT_TONE: Record<string, string> = { reel: "#F6E7A6", carousel: "#E4DCF5", story: "#F7D3DC", image: "#D8E6F3" };

/** יום ראשון של השבוע של תאריך (YYYY-MM-DD), בשעון ישראל */
function sundayOf(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
}
const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const dayNum = (iso: string) => Number(iso.slice(8, 10));
const longDate = (iso: string) => new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long" }).format(new Date(`${iso}T12:00:00`));

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
    if (paths.length) setThumbs(await signThumbs(paths));
  }, [start, end, account]);
  useEffect(() => { load(); }, [load]);

  const today = todayIL();
  const rows = ROWS.filter((r) => r.format === "reel" || r.format === "carousel" || items?.some((i) => i.format === r.format));
  const withMedia = items?.filter((i) => i.draft_id && isReady(drafts[i.draft_id])).length ?? 0;

  return (
    <section className="rounded-2xl border border-[#E3D9CC] bg-[#FAF6F1] p-4 shadow-[0_1px_2px_rgba(31,27,22,0.06)]">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <Label>לוח השבוע</Label>
          <Title size="lg" accent={longDate(start)}>השבוע של</Title>
        </div>
        <div className="flex items-center gap-2">
          {items && <span className="rounded-full border border-[#E3D9CC] bg-white/70 px-3 py-1 text-[12px] font-bold">{items.length} פוסטים משובצים{items.length ? ` · ${withMedia} מוכנים` : ""}</span>}
          <button type="button" aria-label="השבוע הקודם" onClick={() => setStart(addDays(start, -7))} className="rounded-lg border border-[#E3D9CC] bg-white/70 p-1.5"><ChevronRight className="size-4" /></button>
          <CalendarConnect />
          <Link href="/studio/replan" className="rounded-lg bg-[#5E1D1D] px-2.5 py-1 text-[12px] font-bold text-[#FAF6F1]">ליצור את השבוע</Link>
          <button type="button" onClick={() => setStart(sundayOf(today))} className="rounded-lg border border-[#E3D9CC] bg-white/70 px-2.5 py-1 text-[12px] font-bold">השבוע</button>
          <button type="button" aria-label="השבוע הבא" onClick={() => setStart(addDays(start, 7))} className="rounded-lg border border-[#E3D9CC] bg-white/70 p-1.5"><ChevronLeft className="size-4" /></button>
        </div>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="grid min-w-[760px] grid-cols-[84px_repeat(7,minmax(0,1fr))] gap-2">
          <div />
          {days.map((d, i) => (
            <div key={d} className={cn("rounded-lg px-2 py-1 text-center text-[12px] font-bold", d === today ? "bg-[#5E1D1D] text-[#FAF6F1]" : "text-[#4E4540]")}>
              {DAY[i]} {dayNum(d)}
            </div>
          ))}
          {rows.map((r) => (
            <Row key={r.format} label={r.label} Icon={r.icon}>
              {days.map((d) => {
                const cell = (items ?? []).filter((i) => i.planned_date === d && i.format === r.format).sort((a, b) => (a.post_time ?? "99").localeCompare(b.post_time ?? "99"));
                return (
                  <div key={d} className={cn("min-h-[150px] space-y-2 rounded-xl p-1", d === today && "bg-[#EFD9DD]/50 ring-1 ring-[#E3C3CA]")}>
                    {cell.map((i) => <Cell key={i.id} item={i} draft={i.draft_id ? drafts[i.draft_id] : undefined} thumb={thumbs[thumbPath(i.draft_id ? drafts[i.draft_id] : undefined) ?? ""]} onChange={(x) => (x ? (x.draft_id !== i.draft_id ? load() : setItems((all) => (all ?? []).map((y) => (y.id === x.id ? x : y)))) : setItems((all) => (all ?? []).filter((y) => y.id !== i.id)))} />)}
                    {!cell.length && <div className="h-full min-h-[140px] rounded-xl border border-dashed border-[#E3D9CC]" />}
                  </div>
                );
              })}
            </Row>
          ))}
        </div>
      </div>
      {!items && <p className="mt-2 text-[12px] text-[#6A6158]">טוענת...</p>}
    </section>
  );
}

function Row({ label, Icon, children }: { label: string; Icon: typeof PlaySquare; children: React.ReactNode }) {
  return (
    <>
      <div className="flex flex-col items-center justify-center gap-1 rounded-xl bg-[#F2ECE4] px-1 py-2 text-[13px] font-bold text-[#2A2622]"><Icon className="size-5" />{label}</div>
      {children}
    </>
  );
}

function Cell({ item, draft, thumb, onChange }: { item: Item; draft?: Draft; thumb?: string; onChange: (x: Item | null) => void }) {
  const variants = draft?.data.variants?.length ?? 0;
  const href = draft ? `/studio/reel?id=${draft.id}` : "/studio/board";
  const type = item.content_type || draft?.data.content_type;
  return (
    <div className={cn("overflow-hidden rounded-xl border bg-[#FAF6F1] shadow-[0_1px_2px_rgba(31,27,22,0.12)]", item.stage === "published" ? "border-[#3E6B4F]" : "border-[#E3D9CC]")}>
    <Link href={href} className="group relative block bg-[#2A2622]">
      {/* כמו לוח שנה: תמונה מלאה בגודל אחיד, תג פורמט צבעוני למטה, ומצב למעלה */}
      <div className="relative aspect-[3/4] w-full overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {thumb ? <img src={thumb} alt="" className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-[1.04]" /> : (
          <div className="absolute inset-0 flex items-center justify-center p-2 text-center text-[11px] font-bold leading-snug text-[#5E1D1D]" style={{ background: "linear-gradient(160deg,#F7E4E7,#EFD9DD)" }}>{item.hook || item.title}</div>
        )}
        <span className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/45 to-transparent" />
        {item.stage === "published" ? <span className="absolute right-1.5 top-1.5 rounded-md bg-[#3E6B4F] px-1.5 py-0.5 text-[10px] font-bold text-white">פורסם</span>
          : draft && isReady(draft) ? <span className="absolute right-1.5 top-1.5 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur">מוכן</span>
          : <span className="absolute right-1.5 top-1.5 rounded-md bg-white/85 px-1.5 py-0.5 text-[10px] font-bold text-[#6A6158]">רעיון</span>}
        {item.post_time ? <span dir="ltr" className="absolute left-1.5 top-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-black text-white backdrop-blur">{item.post_time}</span>
          : variants > 1 && <span className="absolute left-1.5 top-1.5 rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-bold text-[#2A2622]">{variants} גרסאות</span>}
        <span className="absolute bottom-1.5 right-1.5 rounded-full px-2 py-0.5 text-[11px] font-black text-[#2A2622] shadow-sm" style={{ background: FORMAT_TONE[item.format] ?? "#ECE7DE" }}>
          {item.format === "carousel" ? "קרוסלה" : item.format === "reel" ? "ריל" : item.format === "story" ? "סטורי" : "תמונה"}
        </span>
      </div>
      <div className="bg-[#FAF6F1] px-2 py-1">
        <p className="truncate text-[11px] font-semibold text-[#2A2622]" title={item.title}>{item.title}</p>
        {type && <p className="truncate text-[10px] font-bold text-[#B5848E]">{labelOf(CONTENT_TYPES, type)}</p>}
      </div>
    </Link>
    <ItemActions item={item} onChange={(x) => onChange(x as Item | null)} compact />
    </div>
  );
}
