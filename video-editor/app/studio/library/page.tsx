"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ACCOUNTS, FORMATS, STAGES, labelOf, type Draft } from "@/lib/studio/config";
import { db, formatDate, studioCall, versionLabels } from "@/lib/studio/client";
import { Label, Loading, Note, PageHead, Panel, Tag } from "@/components/studio/ui";
import { cn } from "@/lib/utils";

interface Item { id: string; title: string; account: string; format: string; stage: string; planned_date: string | null; draft_id: string | null; auto: boolean; updated_at: string }
interface Project { id: string; title: string; updated_at: string; meta: { thumbnail?: string | null; duration?: number; clipCount?: number } | null }
interface DriveFile { id: string; name: string; mimeType: string; modifiedTime?: string; videoMediaMetadata?: { durationMillis?: string } }

const TABS = [
  { key: "all", label: "הכל" },
  { key: "ideas", label: "רעיונות" },
  { key: "reels", label: "רילס" },
  { key: "carousels", label: "קרוסלות" },
  { key: "editor", label: "בעורך" },
  { key: "drive", label: "בדרייב" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export default function LibraryPage() {
  const [tab, setTab] = useState<Tab>("all");
  const [items, setItems] = useState<Item[] | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [drive, setDrive] = useState<{ configured: boolean; email?: string; files: DriveFile[] } | null>(null);
  const [q, setQ] = useState("");
  const [showEmpty, setShowEmpty] = useState(false);

  useEffect(() => {
    db().from("studio_items").select("id, title, account, format, stage, planned_date, draft_id, auto, updated_at").order("updated_at", { ascending: false }).limit(400).then(({ data }) => setItems((data as Item[]) ?? []));
    db().from("studio_drafts").select("*").order("updated_at", { ascending: false }).limit(200).then(({ data }) => setDrafts((data as Draft[]) ?? []));
    db().from("projects").select("id, title, updated_at, meta").order("updated_at", { ascending: false }).limit(100).then(({ data }) => setProjects((data as Project[]) ?? []));
  }, []);
  useEffect(() => {
    if ((tab === "drive" || tab === "all") && !drive) studioCall<{ configured: boolean; email?: string; files: DriveFile[] }>("drive-files").then(setDrive).catch(() => setDrive({ configured: false, files: [] }));
  }, [tab, drive]);

  const match = (s: string) => !q.trim() || s.toLowerCase().includes(q.trim().toLowerCase());
  const versions = useMemo(() => versionLabels(drafts), [drafts]);
  const reels = useMemo(() => drafts.filter((d) => d.mode !== "carousel" && match(d.idea)), [drafts, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const carousels = useMemo(() => drafts.filter((d) => d.mode === "carousel" && match(d.idea)), [drafts, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const ideas = (items ?? []).filter((i) => i.stage === "idea" && match(i.title));
  const board = (items ?? []).filter((i) => i.stage !== "idea" && match(i.title));
  // פרויקט בלי קליפים הוא כנראה "פרויקט חדש" שנפתח ונשכח. מסתירים אותו, לא מוחקים
  const emptyProjects = projects.filter((p) => !(p.meta?.clipCount ?? 0)).length;
  const projs = projects.filter((p) => match(p.title) && (showEmpty || (p.meta?.clipCount ?? 0) > 0));
  const files = (drive?.files ?? []).filter((f) => match(f.name));

  const section = (key: Tab) => tab === "all" || tab === key;
  return (
    <>
      <PageHead label="ריכוז" title="כל" accent="התוכן" sub="מקום אחד לכל מה שיש: רעיונות, תסריטים, קרוסלות, פרויקטים בעורך וקבצים בדרייב." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)} className={cn("rounded-full border px-3 py-1.5 text-sm font-semibold", tab === t.key ? "border-[#5E1D1D] bg-[#5E1D1D] text-[#FAF6F1]" : "border-[#E3D9CC] bg-[#FAF6F1] hover:border-[#5E1D1D]")}>{t.label}</button>
        ))}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש" className="mr-auto w-48 rounded-lg border border-[#DDD4C6] bg-white/70 px-3 py-1.5 text-sm focus:border-[#5E1D1D] focus:outline-none" />
      </div>
      {!items ? <Loading /> : (
        <div className="space-y-6">
          {(section("ideas") || tab === "all") && tab !== "reels" && tab !== "carousels" && tab !== "editor" && tab !== "drive" && (
            <Group title="בלוח ובתור" count={ideas.length + board.length}>
              {[...board, ...ideas].slice(0, tab === "all" ? 12 : 300).map((i) => (
                <Row key={i.id} href={i.draft_id ? `/studio/reel?id=${i.draft_id}` : "/studio/ideas"} title={i.title}
                  meta={`${labelOf(FORMATS, i.format)} · ${labelOf(ACCOUNTS, i.account)}${i.planned_date ? ` · ${formatDate(i.planned_date)}` : ""}`}
                  tags={[labelOf(STAGES, i.stage), ...(i.auto ? ["אוטומטי"] : [])]} />
              ))}
            </Group>
          )}
          {section("reels") && (
            <Group title="תסריטים לרילס" count={reels.length}>
              {reels.slice(0, tab === "all" ? 9 : 200).map((d) => (
                <Row key={d.id} href={`/studio/reel?id=${d.id}`} title={`${d.idea}${versions[d.id] ?? ""}`} meta={`${labelOf(ACCOUNTS, d.account)} · ${d.data.script?.total_seconds ? `${d.data.script.total_seconds} שניות · ` : d.data.video?.seconds ? `${d.data.video.seconds} שניות · ` : ""}${formatDate(d.updated_at)}`}
                  tags={[...(d.data.hooks?.[d.data.chosen ?? 0] ? [`הוק ${d.data.hooks[d.data.chosen ?? 0].score}`] : []), ...(d.data.materials ? ["יש חומרים"] : []), ...(d.project_id ? ["בעורך"] : [])]} />
              ))}
            </Group>
          )}
          {section("carousels") && (
            <Group title="קרוסלות" count={carousels.length}>
              {carousels.slice(0, tab === "all" ? 9 : 200).map((d) => (
                <Row key={d.id} href={`/studio/reel?id=${d.id}`} title={`${d.idea}${versions[d.id] ?? ""}`} meta={`${labelOf(ACCOUNTS, d.account)} · ${d.data.carousel?.slides.length ?? 0} שקופיות · ${formatDate(d.updated_at)}${d.data.carousel?.slides[0]?.headline && d.data.carousel.slides[0].headline !== d.idea ? ` · שער: ${d.data.carousel.slides[0].headline}` : ""}`} tags={[]} />
              ))}
            </Group>
          )}
          {section("editor") && (
            <Group title="פרויקטים בעורך" count={projs.length}>
              {emptyProjects > 0 && (
                <button type="button" onClick={() => setShowEmpty(!showEmpty)} className="col-span-full text-right text-[12px] text-[#6A6158] underline underline-offset-4">
                  {showEmpty ? "להסתיר פרויקטים ריקים" : `${emptyProjects} פרויקטים ריקים מוסתרים. להציג`}
                </button>
              )}
              {projs.slice(0, tab === "all" ? 9 : 100).map((p) => (
                <Row key={p.id} href={`/p/${p.id}`} title={p.title} meta={`${p.meta?.clipCount ?? 0} קליפים · ${p.meta?.duration ?? 0} ש׳ · ${formatDate(p.updated_at)}`} tags={[]} thumb={p.meta?.thumbnail ?? undefined} />
              ))}
            </Group>
          )}
          {section("drive") && (
            <Group title="בדרייב" count={files.length}>
              {!drive ? <Loading /> : !drive.configured ? (
                <Note>דרייב עוד לא מחובר. ההוראות לחיבור מופיעות בעמוד "הקול שלי", בחלק של דרייב.</Note>
              ) : files.length === 0 ? <Note>לא נמצאו סרטונים או תמונות. בדקי שהתיקייה משותפת עם {drive.email}.</Note> : (
                files.slice(0, tab === "all" ? 12 : 150).map((f) => (
                  <Row key={f.id} href={`https://drive.google.com/file/d/${f.id}/view`} external title={f.name} thumb={`/api/studio/drive-thumb?id=${f.id}`}
                    meta={`${f.mimeType.startsWith("video/") ? "וידאו" : "תמונה"}${f.videoMediaMetadata?.durationMillis ? ` · ${Math.round(Number(f.videoMediaMetadata.durationMillis) / 1000)} ש׳` : ""} · ${formatDate(f.modifiedTime)}`} tags={[]} />
                ))
              )}
            </Group>
          )}
        </div>
      )}
    </>
  );
}

function Group({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section>
      <Label className="mb-2">{title} · {count}</Label>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

function Row({ href, title, meta, tags, thumb, external }: { href: string; title: string; meta: string; tags: string[]; thumb?: string; external?: boolean }) {
  const body = (
    <Panel className="flex h-full items-center gap-3 px-3 py-2.5 transition-shadow hover:shadow-md">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {thumb && <img src={thumb} alt="" className="h-14 w-10 shrink-0 rounded-md bg-[#F0E8DF] object-cover" />}
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-semibold leading-snug">{title}</p>
        <p className="mt-0.5 text-[11px] text-[#6A6158]">{meta}</p>
        {tags.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{tags.map((t) => <Tag key={t}>{t}</Tag>)}</div>}
      </div>
    </Panel>
  );
  return external ? <a href={href} target="_blank" rel="noopener noreferrer">{body}</a> : <Link href={href}>{body}</Link>;
}
