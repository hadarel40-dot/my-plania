"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { ACCOUNTS, NICHES, labelOf, type Account, type Niche } from "@/lib/studio/config";
import { db, formatDate } from "@/lib/studio/client";
import { Btn, Loading, Note, PageHead, Panel, Select, Tag, inputCls, toast } from "@/components/studio/ui";

interface Item { id: string; title: string; account: Account; niche: Niche | null; notes: string; created_at: string; planned_date: string | null; format: string; auto: boolean }

export default function IdeasPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[] | null>(null);
  const [title, setTitle] = useState("");
  const [account, setAccount] = useState<Account>("hadarelifergan");
  const [niche, setNiche] = useState<Niche>("travel");
  const load = () => db().from("studio_items").select("id, title, account, niche, notes, created_at, planned_date, format, auto").eq("stage", "idea").order("created_at", { ascending: false }).then(({ data }) => setItems((data as Item[]) ?? []));
  useEffect(() => { load(); }, []);
  useEffect(() => { const n = NICHES.filter((x) => x.account === account); if (!n.some((x) => x.value === niche)) setNiche(n[0].value); }, [account]); // eslint-disable-line react-hooks/exhaustive-deps

  const add = async () => {
    if (title.trim().length < 3) return toast("כתבי את הרעיון", true);
    const { error } = await db().from("studio_items").insert({ title: title.trim(), account, niche, stage: "idea", format: "reel" });
    if (error) return toast(error.message, true);
    setTitle("");
    load();
  };
  const remove = async (i: Item) => {
    if (!window.confirm(`למחוק את "${i.title}"?`)) return;
    await db().from("studio_items").delete().eq("id", i.id);
    load();
  };

  return (
    <>
      <PageHead label="תכנון" title="מאגר" accent="הרעיונות" sub="כל רעיון שעוד לא נכתב. מכאן שולחים לסטודיו לכתיבת ריל, או גוררים ליום בעמוד הבית." />
      <Panel className="mb-5">
        <div className="flex flex-wrap items-end gap-2">
          <input className={`${inputCls} min-w-[220px] flex-1`} value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="רעיון חדש, במשפט" />
          <Select value={account} onChange={setAccount} options={ACCOUNTS} className="w-auto" />
          <Select value={niche} onChange={setNiche} options={NICHES.filter((n) => n.account === account)} className="w-auto" />
          <Btn onClick={add}>להוסיף</Btn>
        </div>
      </Panel>
      {!items ? <Loading /> : items.length === 0 ? <Note>אין עדיין רעיונות. אפשר להוסיף כאן, או ללחוץ "לתכנן את השבוע" בעמוד הבית.</Note> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((i) => (
            <Panel key={i.id} className="flex flex-col">
              <div className="mb-1.5 flex flex-wrap gap-1.5"><Tag tone={i.account === "plania.il" ? "green" : "butter"}>{labelOf(ACCOUNTS, i.account)}</Tag>{i.niche && <Tag>{labelOf(NICHES, i.niche)}</Tag>}{i.planned_date && <Tag>{formatDate(i.planned_date)}</Tag>}{i.format === "carousel" && <Tag>קרוסלה</Tag>}{i.auto && <Tag>אוטומטי</Tag>}</div>
              <h3 className="s-serif mb-1 text-lg leading-snug">{i.title}</h3>
              {i.notes && <p className="mb-3 whitespace-pre-line text-sm leading-relaxed text-[#4E473E]">{i.notes}</p>}
              <div className="mt-auto flex items-center gap-2">
                <Btn onClick={() => router.push(`/studio/reel?${new URLSearchParams({ idea: i.notes ? i.notes.split("\n\nלמה:")[0] : i.title, account: i.account, niche: i.niche ?? "", ...(i.format === "carousel" ? { mode: "carousel" } : {}) })}`)}>{i.format === "carousel" ? "לכתוב קרוסלה" : "לכתוב תסריט"}</Btn>
                <Link href="/studio/board" className="text-[13px] font-bold underline underline-offset-4">ללוח</Link>
                <button type="button" aria-label="מחיקה" onClick={() => remove(i)} className="mr-auto text-[#9A9184] hover:text-[#1F1B16]"><Trash2 className="size-4" /></button>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
