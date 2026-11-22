"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Player } from "@remotion/player";
import { TimelineComposition, type CompositionProps } from "@/remotion/timeline-composition";
import { timelineDuration } from "@/lib/editor/timeline-utils";
import type { MediaAsset } from "@/lib/editor/types";
import { CONTENT_TYPES, labelOf, type Draft } from "@/lib/studio/config";
import { db } from "@/lib/studio/client";
import { REEL_COLORS, REEL_FONTS, REEL_STYLES, buildReelTimeline, styleForVariant, type CaptionStyleId, type ReelDesign } from "@/lib/studio/reel-timeline";
import { canShareFiles, shareToInstagram } from "@/lib/studio/share";
import { MEDIA_BUCKET } from "@/lib/supabase/env";
import { Btn, Panel, Tag, inputCls, toast } from "./ui";
import { ShareHint } from "./share-hint";
import { cn } from "@/lib/utils";

async function warm(url: string) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, { headers: { Range: "bytes=0-0" } });
      if (r.ok || r.status === 206 || r.status < 500) return;
    } catch { /* רשת: ננסה שוב */ }
    await new Promise((res) => setTimeout(res, 600 * (i + 1)));
  }
}

/** כתובות צפייה לכל הקבצים של הפרויקט (מהאחסון) */
async function signAssets(assets: Record<string, MediaAsset>) {
  const paths = Object.values(assets).flatMap((a) => (a.storagePath ? [a.storagePath] : []));
  if (!paths.length) return assets;
  const { data } = await db().storage.from(MEDIA_BUCKET).createSignedUrls(paths, 6 * 60 * 60);
  const byPath = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  // האחסון מחזיר לפעמים 503 רגעי: מחממים כל קובץ (בית ראשון) עם ניסיון חוזר, לפני שהנגן עולה
  await Promise.all([...byPath.values()].flatMap((u) => (u ? [warm(u)] : [])));
  return Object.fromEntries(Object.entries(assets).map(([id, a]) => [id, a.storagePath && byPath.get(a.storagePath) ? { ...a, url: byPath.get(a.storagePath)! } : a]));
}

/**
 * הריל בדשבורד, בלי עורך: רואים אותו, בוחרים גרסה, ומשנים עיצוב בכפתורים (גופן, צבעים, גודל, מיקום).
 * כל שינוי נשמר בטיוטה ונראה בנגן מיד. "לשלוח לאינסטגרם" ו"להוריד" מייצאים בדיוק את מה שרואים.
 */
export function ReelPlayer({ draft, onChange }: { draft: Draft; onChange: (d: Draft) => void }) {
  const kit = draft.data.edit!;
  const [assets, setAssets] = useState<Record<string, MediaAsset> | null>(null);
  const [design, setDesign] = useState<ReelDesign>(draft.data.reel_design ?? {});
  const [busy, setBusy] = useState("");
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState<"shared" | "saved" | null>(null);
  const [showDesign, setShowDesign] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const variant = draft.data.chosen_variant;
  const style = styleForVariant(variant);
  const caption = draft.data.caption ?? "";

  // הקבצים נחתמים פעם אחת; גרסה ועיצוב רק בונים מחדש את הכתוביות
  useEffect(() => {
    let live = true;
    signAssets(buildReelTimeline(kit).assets).then((a) => live && setAssets(a)).catch(() => live && setAssets({}));
    return () => { live = false; };
  }, [kit]);
  const timeline = useMemo(() => buildReelTimeline(kit, style, design).timeline, [kit, style, design]);
  const inputProps = useMemo<CompositionProps | null>(() => (assets ? { timeline, assets, override: null } : null), [timeline, assets]);
  const frames = Math.max(1, Math.ceil(timelineDuration(timeline) * timeline.fps));

  const chooseStyle = async (variantId: string) => {
    if (variantId === variant) return;
    const { data, error } = await db().from("studio_drafts").update({ data: { ...draft.data, chosen_variant: variantId } }).eq("id", draft.id).select("*").single();
    if (error) return toast(error.message, true);
    onChange(data as Draft);
  };
  // עיצוב: מתעדכן בנגן מיד, ונשמר רגע אחרי
  const setD = (patch: Partial<ReelDesign> | null) => {
    const next = patch === null ? {} : { ...design, ...patch };
    setDesign(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const { data } = await db().from("studio_drafts").update({ data: { ...draft.data, reel_design: next } }).eq("id", draft.id).select("*").single();
      if (data) onChange(data as Draft);
    }, 600);
  };

  const exportMp4 = async () => {
    if (!assets) throw new Error("הריל עוד נטען");
    const { renderToMp4 } = await import("@/lib/export/render-video");
    abort.current = new AbortController();
    const phone = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
    return renderToMp4(timeline, assets, { quality: phone ? "720p" : "1080p", signal: abort.current.signal, onProgress: setProgress });
  };
  const save = (blob: Blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${draft.idea.slice(0, 40) || "reel"}.mp4`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
  };
  const send = async () => {
    setBusy("send"); setProgress(0);
    try {
      const blob = await exportMp4();
      const res = await shareToInstagram([new File([blob], "reel.mp4", { type: "video/mp4" })], caption);
      if (res === "unsupported") { save(blob); setReady("saved"); }
      else if (res === "shared") setReady("shared");
    } catch (e) { if (!abort.current?.signal.aborted) toast((e as Error).message, true); }
    finally { setBusy(""); }
  };
  const download = async () => {
    setBusy("download"); setProgress(0);
    try { save(await exportMp4()); if (caption) await navigator.clipboard?.writeText(caption).catch(() => {}); setReady("saved"); }
    catch (e) { if (!abort.current?.signal.aborted) toast((e as Error).message, true); }
    finally { setBusy(""); }
  };

  const changed = Object.keys(design).length > 0;
  return (
    <Panel title="הריל" accent="שלך" aside={draft.data.content_type ? <Tag tone="butter">{labelOf(CONTENT_TYPES, draft.data.content_type)}</Tag> : undefined}>
      <div className="grid gap-5 md:grid-cols-[280px_1fr]">
        {/* הנגן מחושב משמאל לימין: בדף בעברית הוא זז מחוץ למסגרת בלי זה */}
        <div dir="ltr" className="mx-auto aspect-[9/16] w-full max-w-[280px] overflow-hidden rounded-2xl bg-black shadow-[0_20px_40px_-24px_rgba(94,29,29,0.8)]">
          {inputProps ? (
            <Player component={TimelineComposition} inputProps={inputProps} durationInFrames={frames} fps={timeline.fps}
              compositionWidth={1080} compositionHeight={1920} style={{ width: "100%", height: "100%" }} controls clickToPlay loop />
          ) : <div className="flex size-full items-center justify-center text-[13px] text-white/80" dir="rtl">טוענת את הסרטונים...</div>}
        </div>

        <div className="min-w-0 space-y-5">
          <div>
            <p className="mb-2 text-[13px] font-bold text-[#5E1D1D]">בוחרים גרסה</p>
            <div className="grid grid-cols-4 gap-1.5 md:gap-2">
              {REEL_STYLES.map((st) => {
                const on = style === st.id;
                return (
                  <button key={st.id} type="button" onClick={() => chooseStyle(st.variant)} aria-pressed={on}
                    className={cn("overflow-hidden rounded-2xl border-2 text-right transition", on ? "border-[#5E1D1D] shadow-[0_10px_20px_-14px_rgba(94,29,29,0.9)]" : "border-[#E3D9CC] hover:border-[#B5848E]")}>
                    <StylePreview id={st.id} design={design} />
                    <span className={cn("block px-1.5 py-1.5 text-[10px] font-bold leading-tight md:text-[11px]", on ? "bg-[#5E1D1D] text-[#FAF6F1]" : "bg-white text-[#2A2622]")}>{st.variant} · {st.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-[#E3D9CC] bg-white/70">
            <button type="button" onClick={() => setShowDesign((v) => !v)} aria-expanded={showDesign}
              className="flex w-full items-center justify-between px-4 py-3 text-[14px] font-bold text-[#5E1D1D]">
              לשנות עיצוב: גופן, צבעים, גודל
              <span className="text-xl leading-none">{showDesign ? "−" : "+"}</span>
            </button>
            {showDesign && (
              <div className="space-y-5 border-t border-[#E3D9CC] px-4 py-4">
                <Group title="כותרת ראשית">
                  <Row label="גופן">{REEL_FONTS.map((f) => <FontChip key={f.id} f={f} on={(design.headFont ?? design.font ?? (style === "editorial" ? "frank" : "assistant")) === f.id} onClick={() => setD({ headFont: f.id })} />)}</Row>
                  <Row label="צבע"><Swatches value={design.main ?? "#FFFFFF"} onPick={(c) => setD({ main: c })} /></Row>
                </Group>
                <Group title="כותרת משנית">
                  <Row label="גופן">{REEL_FONTS.map((f) => <FontChip key={f.id} f={f} on={(design.bodyFont ?? design.font ?? "assistant") === f.id} onClick={() => setD({ bodyFont: f.id })} />)}</Row>
                  <Row label="צבע"><Swatches value={design.body ?? design.accent ?? "#F7C9D6"} onPick={(c) => setD({ body: c })} /></Row>
                </Group>
                <Group title="משחקי אותיות">
                  <Row label="מילה מודגשת">
                    <Chip on={design.emphasis ?? style === "editorial"} onClick={() => setD({ emphasis: true })}>עם</Chip>
                    <Chip on={!(design.emphasis ?? style === "editorial")} onClick={() => setD({ emphasis: false })}>בלי</Chip>
                  </Row>
                  {(design.emphasis ?? style === "editorial") && (
                    <Row label="הגופן של המילה המודגשת">{REEL_FONTS.map((f) => <FontChip key={f.id} f={f} on={(design.emFont ?? (style === "editorial" ? "gveret" : design.headFont ?? design.font ?? "assistant")) === f.id} onClick={() => setD({ emFont: f.id })} />)}</Row>
                  )}
                  <Row label="צבע ההדגשה"><Swatches value={design.accent ?? "#F7C9D6"} onPick={(c) => setD({ accent: c })} /></Row>
                  <Row label="ירידות שורה">
                    {([["few", "מעט"], [undefined, "רגיל"], ["many", "הרבה"]] as const).map(([v, l]) => <Chip key={l} on={design.breaks === v} onClick={() => setD({ breaks: v })}>{l}</Chip>)}
                  </Row>
                  <Row label="איך האותיות נכנסות">
                    {([[undefined, "כמו בגרסה"], ["calm", "רגוע"], ["bounce", "קופץ"], ["type", "מכונת כתיבה"], ["zoom", "זום"]] as const).map(([v, l]) => <Chip key={l} on={design.play === v} onClick={() => setD({ play: v })}>{l}</Chip>)}
                  </Row>
                  <p className="text-[11px] text-[#9A8C85]">כדי לבחור בעצמך איזו מילה מודגשת, שמים אותה בין כוכביות בטקסט, למשל: ככה *באמת* עורכים.</p>
                </Group>
                <Group title="גודל ומיקום">
                  <Row label="גודל">
                    {([["s", "קטן"], ["m", "רגיל"], ["l", "גדול"]] as const).map(([v, l]) => <Chip key={v} on={(design.size ?? "m") === v} onClick={() => setD({ size: v })}>{l}</Chip>)}
                  </Row>
                  <Row label="מיקום">
                    {([["top", "למעלה"], ["middle", "באמצע"], ["bottom", "למטה"]] as const).map(([v, l]) => <Chip key={v} on={(design.place ?? "middle") === v} onClick={() => setD({ place: v })}>{l}</Chip>)}
                  </Row>
                </Group>
                {changed && <button type="button" onClick={() => setD(null)} className="text-[13px] font-bold text-[#5E1D1D] underline underline-offset-4">לחזור לעיצוב המקורי</button>}
              </div>
            )}
          </div>

          <TextsEditor draft={draft} onChange={onChange} />

          <div className="space-y-2">
            <Btn busy={busy === "send"} onClick={send} className="min-h-[48px] w-full text-[15px]">{busy === "send" ? `מכינה את הקובץ ${progress}%` : canShareFiles() ? "לשלוח לאינסטגרם" : "להוריד ולשלוח"}</Btn>
            <div className="flex gap-2 [&>*]:flex-1">
              <Btn variant="line" busy={busy === "download"} onClick={download}>{busy === "download" ? `${progress}%` : "להוריד"}</Btn>
              {caption && <Btn variant="line" onClick={() => navigator.clipboard.writeText(caption).then(() => toast("הכיתוב הועתק"))}>להעתיק כיתוב</Btn>}
              {busy && (busy === "send" || busy === "download") && <Btn variant="ghost" onClick={() => abort.current?.abort()}>לעצור</Btn>}
            </div>
            <ShareHint />
          </div>

          {ready && (
            <div className="rounded-2xl border border-[#3E6B4F] bg-[#E2ECDF] p-4 text-sm">
              <p className="mb-1.5 font-bold">מוכן לאינסטגרם</p>
              <ol className="list-decimal space-y-1 pr-5 text-[13px]">
                <li>{ready === "shared" ? "באינסטגרם: בוחרים ריל, הסרטון כבר שם." : "הסרטון ירד. באינסטגרם: + ואז ריל, ובוחרים אותו."}</li>
                <li>מוסיפים שיר טרנדי, ומכוונים את העוצמה.</li>
                <li>מדביקים את הכיתוב: הוא כבר הועתק.</li>
                <li>מפרסמים, או שומרים כטיוטה.</li>
              </ol>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[40px] items-center rounded-xl bg-[#5E1D1D] px-4 text-[13px] font-bold text-[#FAF6F1]">לפתוח את אינסטגרם</a>
                <Btn variant="ghost" onClick={() => setReady(null)}>לסגור</Btn>
              </div>
            </div>
          )}
          {caption && <details className="rounded-2xl border border-[#E3D9CC] bg-white/70 px-4 py-3 text-sm"><summary className="cursor-pointer font-bold text-[#5E1D1D]">הכיתוב</summary><p className="mt-2 whitespace-pre-line leading-relaxed">{caption}</p></details>}
        </div>
      </div>
    </Panel>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl bg-[#FAF6F1] p-3">
      <p className="text-[13px] font-black text-[#5E1D1D]">{title}</p>
      {children}
    </section>
  );
}

function FontChip({ f, on, onClick }: { f: { id: string; label: string; family: string }; on: boolean; onClick: () => void }) {
  return <Chip on={on} onClick={onClick}><span style={{ fontFamily: `"${f.family}"` }} className="text-[15px]">{f.label}</span></Chip>;
}

/** לשנות את הטקסטים: כותרת ראשית ומשנית לכל כרטיס. נשמר בריל, ואפשר לבטל מהצ'אט עם המעצב */
function TextsEditor({ draft, onChange }: { draft: Draft; onChange: (d: Draft) => void }) {
  const kit = draft.data.edit!;
  const [open, setOpen] = useState(false);
  const [cards, setCards] = useState(kit.cards.map((c) => ({ head: c.headline ?? c.text, body: c.headline ? c.body ?? "" : "" })));
  const [busy, setBusy] = useState(false);
  useEffect(() => setCards(kit.cards.map((c) => ({ head: c.headline ?? c.text, body: c.headline ? c.body ?? "" : "" }))), [kit]);
  const dirty = cards.some((c, i) => c.head !== (kit.cards[i].headline ?? kit.cards[i].text) || c.body !== (kit.cards[i].headline ? kit.cards[i].body ?? "" : ""));
  const save = async () => {
    setBusy(true);
    const edit = { ...kit, cards: kit.cards.map((c, i) => ({ ...c, text: cards[i].head, headline: cards[i].head, body: cards[i].body })) };
    const history = [kit, ...(draft.data.edit_history ?? [])].slice(0, 6);
    const { data, error } = await db().from("studio_drafts").update({ data: { ...draft.data, edit, edit_history: history } }).eq("id", draft.id).select("*").single();
    setBusy(false);
    if (error) return toast(error.message, true);
    onChange(data as Draft);
    toast("הטקסטים עודכנו");
  };
  return (
    <div className="rounded-2xl border border-[#E3D9CC] bg-white/70">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between px-4 py-3 text-[14px] font-bold text-[#5E1D1D]">
        לשנות טקסט: כותרת ראשית ומשנית
        <span className="text-xl leading-none">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-[#E3D9CC] px-4 py-4">
          {cards.map((c, i) => (
            <div key={i} className="space-y-1.5 rounded-xl bg-[#FAF6F1] p-3">
              <p className="text-[11px] font-bold text-[#9A8C85]">כרטיס {i + 1}</p>
              <input className={inputCls} value={c.head} placeholder="כותרת ראשית" onChange={(e) => setCards((x) => x.map((y, j) => (j === i ? { ...y, head: e.target.value } : y)))} />
              <input className={cn(inputCls, "text-[14px]")} value={c.body} placeholder="כותרת משנית (לא חובה)" onChange={(e) => setCards((x) => x.map((y, j) => (j === i ? { ...y, body: e.target.value } : y)))} />
            </div>
          ))}
          <Btn busy={busy} disabled={!dirty} onClick={save} className="w-full">לשמור את הטקסטים</Btn>
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[12px] font-bold text-[#6A6158]">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={cn("min-h-[38px] rounded-xl border px-3 text-[13px] font-bold transition", on ? "border-[#5E1D1D] bg-[#5E1D1D] text-[#FAF6F1]" : "border-[#E3D9CC] bg-white text-[#2A2622] hover:border-[#B5848E]")}>
      {children}
    </button>
  );
}

function Swatches({ value, onPick }: { value: string; onPick: (c: string) => void }) {
  return (
    <>
      {REEL_COLORS.map((c) => (
        <button key={c} type="button" onClick={() => onPick(c)} aria-label={`צבע ${c}`} aria-pressed={value.toLowerCase() === c.toLowerCase()}
          className={cn("size-9 rounded-full border-2 transition", value.toLowerCase() === c.toLowerCase() ? "border-[#5E1D1D] ring-2 ring-[#EFD9DD]" : "border-[#E3D9CC]")}
          style={{ background: c }} />
      ))}
    </>
  );
}

/** תצוגה קטנה של כל גרסה, בצבעים ובגופן שנבחרו */
function StylePreview({ id, design }: { id: CaptionStyleId; design: ReelDesign }) {
  const main = design.main ?? "#FFFFFF";
  const acc = design.accent ?? "#F7C9D6";
  const font = `"${REEL_FONTS.find((f) => f.id === (design.font ?? "assistant"))?.family ?? "Assistant"}"`;
  const dark = acc === "#5E1D1D" || acc === "#2A2622";
  return (
    <span className="relative block aspect-[4/5] w-full" style={{ background: "linear-gradient(170deg,#b98a7c,#6f3a36 60%,#2a1212)", fontFamily: font }}>
      {id === "pop" && <span className="absolute inset-0 flex items-center justify-center text-[26px] font-black" style={{ color: main, WebkitTextStroke: `1px ${acc}`, textShadow: "0 2px 6px rgba(0,0,0,.5)" }}>ככה</span>}
      {id === "chips" && (
        <span className="absolute inset-x-1 top-[38%] text-center">
          <span className="inline-block rounded px-1.5 py-0.5 text-[11px] font-black" style={{ background: acc, color: dark ? "#FFFFFF" : "#2A2622" }}>ככה עורכים</span>
          <span className="mt-1 block text-[10px] font-bold" style={{ color: main }}>בלי לשבת בלילה</span>
        </span>
      )}
      {id === "editorial" && (
        <span className="absolute inset-x-1 top-[30%] text-center leading-none">
          <span className="block text-[12px] font-black" style={{ color: main, fontFamily: `"${REEL_FONTS.find((f) => f.id === (design.headFont ?? design.font ?? "frank"))?.family ?? "Frank Ruhl Libre"}"` }}>ככה</span>
          <span className="block -rotate-6 text-[22px]" style={{ color: acc, fontFamily: `"${REEL_FONTS.find((f) => f.id === (design.emFont ?? "gveret"))?.family ?? "Gveret Levin"}"` }}>עורכים</span>
          <span className="mt-1 block text-[9px] font-bold" style={{ color: design.body ?? acc }}>בלי לשבת בלילה</span>
        </span>
      )}
      {id === "lines" && (
        <span className="absolute inset-x-1 top-[38%] text-center leading-tight">
          <span className="block text-[13px] font-black" style={{ color: main, textShadow: "0 2px 6px rgba(0,0,0,.5)" }}>ככה עורכים</span>
          <span className="block text-[10px] font-bold" style={{ color: acc }}>בלי לשבת בלילה</span>
        </span>
      )}
    </span>
  );
}
