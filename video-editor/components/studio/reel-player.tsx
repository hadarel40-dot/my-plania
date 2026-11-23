"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { HookLab, RewriteChips } from "./hook-lab";
import { Player, type PlayerRef } from "@remotion/player";
import { MediaTagsContext, TimelineComposition, type CompositionProps, type MediaTags } from "@/remotion/timeline-composition";
import { Html5Audio, Html5Video } from "remotion";

/**
 * בדשבורד הקטעים כבר בזיכרון, אז הנגן לא מחכה ל"טעינה" של הווידאו (באייפון זה תקע את השעון על 0:00
 * בזמן שהסרטון עצמו רץ). קטע בלי קול מושתק, כדי שהטלפון ינגן אותו בלי לעצור.
 */
const V5 = Html5Video as unknown as React.ComponentType<Record<string, unknown>>;
function SmoothVideo(props: Record<string, unknown>) {
  return <V5 {...props} pauseWhenBuffering={false} muted={props.muted === true || props.volume === 0} playsInline />;
}
const SMOOTH_TAGS: MediaTags = { mode: "html5", Video: SmoothVideo, Audio: Html5Audio as unknown as MediaTags["Audio"] };
import { timelineDuration } from "@/lib/editor/timeline-utils";
import type { MediaAsset } from "@/lib/editor/types";
import { CONTENT_TYPES, labelOf, type Draft } from "@/lib/studio/config";
import { db } from "@/lib/studio/client";
import { DESIGN_PRESETS, MOTIONS, PLAYS, REEL_COLORS, REEL_FONTS, REEL_STYLES, TRANSITIONS, buildReelTimeline, styleForVariant, surpriseDesign, type CaptionStyleId, type MotionId, type ReelDesign, type Shot } from "@/lib/studio/reel-timeline";
import { Mic, Sparkles } from "lucide-react";
import { ensureExtraFonts } from "@/lib/editor/fonts";
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

/**
 * הקטעים נטענים במלואם לזיכרון לפני שהנגן מתחיל, ואז הריל מתנגן חלק גם בטלפון ב-4G
 * (בלי זה כל קטע נטען תוך כדי ניגון, והתצוגה נתקעת וקופצת).
 */
const blobCache = new Map<string, string>();
async function loadClips(assets: Record<string, MediaAsset>, onProgress: (p: number) => void) {
  const cached: Record<string, MediaAsset> = {};
  const rest: Record<string, MediaAsset> = {};
  for (const [id, a] of Object.entries(assets)) {
    const hit = a.storagePath && blobCache.get(a.storagePath);
    if (hit) cached[id] = { ...a, url: hit }; else rest[id] = a;
  }
  const signed = { ...cached, ...(await signAssets(rest)) };
  const list = Object.entries(signed).filter(([id, a]) => a.url && !cached[id]);
  const done: Record<string, number> = {};
  const totals: Record<string, number> = {};
  const report = () => {
    const t = list.reduce((n, [id]) => n + (totals[id] || 1), 0);
    const d = list.reduce((n, [id]) => n + Math.min(done[id] || 0, totals[id] || 1), 0);
    onProgress(Math.round((d / Math.max(1, t)) * 100));
  };
  const out = { ...signed };
  await Promise.all(list.map(async ([id, a]) => {
    try {
      const res = await fetch(a.url);
      if (!res.ok || !res.body) throw new Error(String(res.status));
      totals[id] = Number(res.headers.get("content-length")) || 0;
      const reader = res.body.getReader();
      const parts: BlobPart[] = [];
      for (;;) {
        const { done: end, value } = await reader.read();
        if (end) break;
        parts.push(value);
        done[id] = (done[id] || 0) + value.length;
        if (!totals[id]) totals[id] = done[id] * 2;
        report();
      }
      totals[id] = done[id];
      const url = URL.createObjectURL(new Blob(parts, { type: res.headers.get("content-type") || "video/mp4" }));
      if (a.storagePath) blobCache.set(a.storagePath, url);
      out[id] = { ...a, url };
    } catch { /* נשארים עם הכתובת מהאחסון */ }
    report();
  }));
  return out;
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
  const [loadPct, setLoadPct] = useState(0);
  const abort = useRef<AbortController | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const variant = draft.data.chosen_variant;
  const style = styleForVariant(variant);
  const caption = draft.data.caption ?? "";

  // הקבצים נטענים פעם אחת; גרסה, עיצוב וטקסט רק בונים מחדש את הכתוביות.
  // נטען מחדש רק אם רשימת הקטעים עצמה השתנתה (למשל המעצב החליף סרטון)
  const clipsKey = kit.segments.map((s) => s.path).join("|");
  useEffect(() => {
    let live = true;
    setLoadPct(0);
    loadClips(buildReelTimeline(kit).assets, (p) => live && setLoadPct(p)).then((a) => live && setAssets(a)).catch(() => live && setAssets({}));
    return () => { live = false; };
  }, [clipsKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const [shotUrls, setShotUrls] = useState<Record<string, string>>({});
  const shotKey = (design.shots ?? []).map((s) => s.path).join("|");
  useEffect(() => {
    const paths = (design.shots ?? []).map((s) => s.path).filter((p) => !shotUrls[p]);
    if (!paths.length) return;
    db().storage.from(MEDIA_BUCKET).createSignedUrls(paths, 6 * 60 * 60).then(({ data }) =>
      setShotUrls((u) => ({ ...u, ...Object.fromEntries((data ?? []).flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl]] : []))) })));
  }, [shotKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (showDesign) void ensureExtraFonts(); }, [showDesign]);
  const built = useMemo(() => buildReelTimeline(kit, style, design, shotUrls), [kit, style, design, shotUrls]);
  const timeline = built.timeline;
  // קריינות: נכנסת כמסלול שמע מתחילת הריל
  const vo = draft.data.voiceover;
  const [voUrl, setVoUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!vo) { setVoUrl(null); return; }
    db().storage.from(MEDIA_BUCKET).createSignedUrl(vo.path, 6 * 60 * 60).then(({ data }) => setVoUrl(data?.signedUrl ?? null));
  }, [vo?.path]); // eslint-disable-line react-hooks/exhaustive-deps
  const full = useMemo(() => {
    // הקלטות המסך באות מהעיצוב, והקטעים מהטעינה המלאה
    const shotAssets = Object.fromEntries(Object.entries(built.assets).filter(([id]) => id.startsWith("shot-")));
    if (!vo || !voUrl || !assets) return { timeline, assets: assets ? { ...assets, ...shotAssets } : null };
    return {
      timeline: { ...timeline, audio: [{ id: "voiceover", assetId: "voiceover", start: 0, in: 0, out: vo.seconds, volume: vo.volume ?? 1, fadeIn: 0, fadeOut: 0.2 }] },
      assets: { ...assets, ...shotAssets, voiceover: { id: "voiceover", name: "קריינות", url: voUrl, thumbnailUrl: null, duration: vo.seconds, width: 0, height: 0, origin: "upload" as const, kind: "audio" as const } },
    };
  }, [timeline, built, assets, vo, voUrl]);
  const playerRef = useRef<PlayerRef>(null);
  const inputProps = useMemo<CompositionProps | null>(() => (full.assets ? { timeline: full.timeline, assets: full.assets, override: null } : null), [full]);
  const frames = Math.max(1, Math.ceil(timelineDuration(timeline) * timeline.fps));

  // ערכה מוכנה: גרסה ועיצוב שלם, בלי לגעת בטקסטים, בצילומי המסך ובהגדרות של כל כרטיס
  const applyPreset = async (variantId: string, preset: ReelDesign) => {
    const next: ReelDesign = { ...preset, shots: design.shots, perCard: design.perCard, cardMotion: design.cardMotion };
    setDesign(next);
    const { data, error } = await db().from("studio_drafts").update({ data: { ...draft.data, chosen_variant: variantId, reel_design: next } }).eq("id", draft.id).select("*").single();
    if (error) return toast(error.message, true);
    onChange(data as Draft);
  };
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
    return renderToMp4(full.timeline, full.assets!, { quality: phone ? "720p" : "1080p", signal: abort.current.signal, onProgress: setProgress });
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
      <div className="grid gap-5 md:grid-cols-[260px_1fr] lg:grid-cols-[300px_1fr]">
        {/* הנגן מחושב משמאל לימין: בדף בעברית הוא זז מחוץ למסגרת בלי זה */}
        <div dir="ltr" className="mx-auto aspect-[9/16] w-full max-w-[300px] self-start overflow-hidden rounded-2xl bg-black shadow-[0_20px_40px_-24px_rgba(94,29,29,0.8)] md:sticky md:top-4">
          {inputProps ? (
            <MediaTagsContext.Provider value={SMOOTH_TAGS}>
            <Player ref={playerRef} component={TimelineComposition} inputProps={inputProps} durationInFrames={frames} fps={timeline.fps}
              compositionWidth={1080} compositionHeight={1920} style={{ width: "100%", height: "100%" }} controls clickToPlay loop />
            </MediaTagsContext.Provider>
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-3 px-8 text-center text-[13px] text-white/85" dir="rtl">
              טוענת את הסרטונים, כדי שהתצוגה תהיה חלקה
              <span className="h-1.5 w-full overflow-hidden rounded-full bg-white/20"><span className="block h-full rounded-full bg-[#F7C9D6] transition-[width]" style={{ width: `${loadPct}%` }} /></span>
              <span className="text-[11px] text-white/60">{loadPct}%</span>
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-5">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[13px] font-bold text-[#5E1D1D]">ערכות עיצוב מוכנות</p>
              <button type="button" onClick={() => { const s = surpriseDesign(); void applyPreset(s.variant, s.design); }} className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full bg-[#5E1D1D] px-3 text-[12px] font-bold text-[#FAF6F1]">
                <Sparkles className="size-3.5" />הפתיעי אותי
              </button>
            </div>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
              {DESIGN_PRESETS.map((pr) => (
                <button key={pr.id} type="button" onClick={() => applyPreset(pr.variant, pr.design)}
                  className="w-[104px] shrink-0 overflow-hidden rounded-2xl border-2 border-[#E3D9CC] text-right transition hover:border-[#B5848E]">
                  <StylePreview id={styleForVariant(pr.variant)} design={pr.design} />
                  <span className="block bg-white px-2 py-1.5 text-[11px] font-bold leading-tight text-[#2A2622]">{pr.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[13px] font-bold text-[#5E1D1D]">או בוחרים סגנון טקסט</p>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-2">
              {REEL_STYLES.map((st) => {
                const on = style === st.id;
                return (
                  <button key={st.id} type="button" onClick={() => chooseStyle(st.variant)} aria-pressed={on}
                    className={cn("overflow-hidden rounded-2xl border-2 text-right transition", on ? "border-[#5E1D1D] shadow-[0_10px_20px_-14px_rgba(94,29,29,0.9)]" : "border-[#E3D9CC] hover:border-[#B5848E]")}>
                    <StylePreview id={st.id} design={design} />
                    <span className={cn("line-clamp-2 block min-h-[34px] px-2 py-1.5 text-[11px] font-bold leading-tight", on ? "bg-[#5E1D1D] text-[#FAF6F1]" : "bg-white text-[#2A2622]")}>{st.variant} · {st.label}</span>
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
                  <Row label="גופן" scroll>{REEL_FONTS.map((f) => <FontChip key={f.id} f={f} on={(design.headFont ?? design.font ?? (style === "editorial" ? "frank" : "assistant")) === f.id} onClick={() => setD({ headFont: f.id })} />)}</Row>
                  <Row label="צבע"><Swatches value={design.main ?? "#FFFFFF"} onPick={(c) => setD({ main: c })} /></Row>
                </Group>
                <Group title="כותרת משנית">
                  <Row label="גופן" scroll>{REEL_FONTS.map((f) => <FontChip key={f.id} f={f} on={(design.bodyFont ?? design.font ?? "assistant") === f.id} onClick={() => setD({ bodyFont: f.id })} />)}</Row>
                  <Row label="צבע"><Swatches value={design.body ?? design.accent ?? "#F7C9D6"} onPick={(c) => setD({ body: c })} /></Row>
                </Group>
                <Group title="משחקי אותיות">
                  <Row label="מילה מודגשת">
                    <Chip on={design.emphasis ?? style === "editorial"} onClick={() => setD({ emphasis: true })}>עם</Chip>
                    <Chip on={!(design.emphasis ?? style === "editorial")} onClick={() => setD({ emphasis: false })}>בלי</Chip>
                  </Row>
                  {(design.emphasis ?? style === "editorial") && (
                    <Row label="הגופן של המילה המודגשת" scroll>{REEL_FONTS.map((f) => <FontChip key={f.id} f={f} on={(design.emFont ?? (style === "editorial" ? "gveret" : design.headFont ?? design.font ?? "assistant")) === f.id} onClick={() => setD({ emFont: f.id })} />)}</Row>
                  )}
                  <Row label="צבע ההדגשה"><Swatches value={design.accent ?? "#F7C9D6"} onPick={(c) => setD({ accent: c })} /></Row>
                  <Row label="ירידות שורה">
                    {([["few", "מעט"], [undefined, "רגיל"], ["many", "הרבה"]] as const).map(([v, l]) => <Chip key={l} on={design.breaks === v} onClick={() => setD({ breaks: v })}>{l}</Chip>)}
                  </Row>
                  <Row label="איך האותיות נכנסות" scroll>
                    <Chip on={!design.play} onClick={() => setD({ play: undefined })}>כמו בגרסה</Chip>
                    {PLAYS.map((pl) => <Chip key={pl.id} on={design.play === pl.id} onClick={() => setD({ play: pl.id })}>{pl.label}</Chip>)}
                  </Row>
                  <p className="text-[11px] text-[#9A8C85]">כדי לבחור בעצמך איזו מילה מודגשת, שמים אותה בין כוכביות בטקסט, למשל: ככה *באמת* עורכים.</p>
                </Group>
                <Group title="מעברים בין הקטעים">
                  <Row label="סוג המעבר">
                    {TRANSITIONS.map((t) => <Chip key={t.id} on={(design.transition ?? "fade") === t.id} onClick={() => setD({ transition: t.id })}>{t.label}</Chip>)}
                  </Row>
                </Group>
                <Group title="גרפיקה מונפשת">
                  <Row label="נכתבת על המסך ליד המילה החשובה" scroll>
                    <Chip on={!design.motion || design.motion === "off"} onClick={() => setD({ motion: "off" })}>בלי</Chip>
                    <Chip on={design.motion === "auto"} onClick={() => setD({ motion: "auto" })}>אוטומטי</Chip>
                    {MOTIONS.map((m) => <Chip key={m.id} on={design.motion === m.id} onClick={() => setD({ motion: m.id })}>{m.label}</Chip>)}
                  </Row>
                  <p className="text-[11px] text-[#9A8C85]">"אוטומטי" בוחר לכל כרטיס: חץ לשאלה, עיגול למספר, ומתחלף בין השאר כדי שלא יחזור על עצמו. אפשר לבחור אחרת לכל כרטיס ב"כל כרטיס בנפרד".</p>
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

          <HookLab draftId={draft.id} current={draft.data.edit!.cards[0]?.headline ?? draft.data.edit!.cards[0]?.text ?? ""} onPick={async (h) => {
            // הכרטיס הראשון מתחלף, והגרסה הקודמת נשמרת להחזרה ("לבטל" אצל המעצב)
            const kit = draft.data.edit!;
            const edit = { ...kit, cards: kit.cards.map((c, i) => (i === 0 ? { ...c, text: h.headline, headline: h.headline, body: h.body || c.body || "" } : c)) };
            const { data, error } = await db().from("studio_drafts").update({ data: { ...draft.data, edit, edit_history: [kit, ...(draft.data.edit_history ?? [])].slice(0, 6) } }).eq("id", draft.id).select("*").single();
            if (error) throw new Error(error.message);
            await db().from("studio_items").update({ hook: h.headline }).eq("draft_id", draft.id);
            onChange(data as Draft);
          }} />

          <TextsEditor draft={draft} onChange={onChange} design={design} setD={setD} globalStyle={style} />

          <VoiceOver draft={draft} onChange={onChange} reelSeconds={timelineDuration(timeline)} voUrl={voUrl}
            onStart={() => { playerRef.current?.seekTo(0); playerRef.current?.mute(); playerRef.current?.play(); }}
            onStop={() => { playerRef.current?.pause(); playerRef.current?.unmute(); }} />

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

/**
 * קריינות: מקליטים כאן, תוך כדי שהריל מתנגן (בלי קול), כדי לדבר בקצב של הכרטיסים.
 * הטקסט של הכרטיסים מופיע כמו פרומפטר. אפשר גם להעלות קובץ. נשמר לריל ונכנס לקובץ שנשלח.
 */
function VoiceOver({ draft, onChange, reelSeconds, voUrl, onStart, onStop }: { draft: Draft; onChange: (d: Draft) => void; reelSeconds: number; voUrl: string | null; onStart: () => void; onStop: () => void }) {
  const kit = draft.data.edit!;
  const vo = draft.data.voiceover;
  const [open, setOpen] = useState(false);
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [secs, setSecs] = useState(0);
  const [take, setTake] = useState<{ blob: Blob; url: string; seconds: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const chunks = useRef<Blob[]>([]);
  const t0 = useRef(0);
  useEffect(() => {
    if (!rec) return;
    const id = setInterval(() => setSecs((Date.now() - t0.current) / 1000), 200);
    return () => clearInterval(id);
  }, [rec]);
  // הכרטיס שעכשיו צריך להגיד, לפי הזמן
  const now = kit.cards.findIndex((c) => secs >= c.start && secs < c.end);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const r = new MediaRecorder(stream);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: r.mimeType || "audio/webm" });
        setTake({ blob, url: URL.createObjectURL(blob), seconds: (Date.now() - t0.current) / 1000 });
      };
      setTake(null);
      t0.current = Date.now(); setSecs(0);
      r.start(250);
      setRec(r);
      onStart();
    } catch { toast("אין גישה למיקרופון. צריך לאשר מיקרופון בדפדפן", true); }
  };
  const stop = () => { rec?.stop(); setRec(null); onStop(); };
  // עצירה לבד בסוף הריל
  useEffect(() => { if (rec && secs >= reelSeconds + 0.3) stop(); }, [secs]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (blob: Blob, seconds: number) => {
    setBusy(true);
    try {
      const { data: u } = await db().auth.getUser();
      if (!u.user) throw new Error("צריך להתחבר מחדש");
      const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("mpeg") ? "mp3" : blob.type.includes("wav") ? "wav" : "webm";
      const path = `${u.user.id}/studio/${draft.id}/voice-${Date.now()}.${ext}`;
      const { error } = await db().storage.from(MEDIA_BUCKET).upload(path, blob, { contentType: blob.type || "audio/webm" });
      if (error) throw new Error(error.message);
      const { data, error: e2 } = await db().from("studio_drafts").update({ data: { ...draft.data, voiceover: { path, seconds: +seconds.toFixed(2), volume: 1 } } }).eq("id", draft.id).select("*").single();
      if (e2) throw new Error(e2.message);
      onChange(data as Draft);
      setTake(null);
      toast("הקריינות נשמרה");
    } catch (e) { toast((e as Error).message, true); }
    finally { setBusy(false); }
  };
  const upload = async (f: File) => {
    const seconds = await new Promise<number>((res) => { const a = new Audio(URL.createObjectURL(f)); a.onloadedmetadata = () => res(a.duration || 0); a.onerror = () => res(0); });
    await save(f, seconds);
  };
  const remove = async () => {
    const { voiceover: _v, ...rest } = draft.data; // eslint-disable-line @typescript-eslint/no-unused-vars
    const { data } = await db().from("studio_drafts").update({ data: rest }).eq("id", draft.id).select("*").single();
    if (data) onChange(data as Draft);
  };
  const setVolume = async (v: number) => {
    if (!vo) return;
    const { data } = await db().from("studio_drafts").update({ data: { ...draft.data, voiceover: { ...vo, volume: v } } }).eq("id", draft.id).select("*").single();
    if (data) onChange(data as Draft);
  };

  return (
    <div className="rounded-2xl border border-[#E3D9CC] bg-white/70">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between px-4 py-3 text-right text-[14px] font-bold text-[#5E1D1D]">
        <span className="flex items-center gap-2"><Mic className="size-4" />קריינות{vo ? " · יש קריינות" : ""}</span>
        <span className="text-xl leading-none">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-[#E3D9CC] px-4 py-4">
          <p className="text-[12px] leading-relaxed text-[#6A6158]">לוחצים "להקליט", והריל מתחיל להתנגן בלי קול. מדברים בקצב של הכרטיסים, והטקסט של כל כרטיס מודגש כשמגיע הזמן שלו. ההקלטה נעצרת לבד בסוף הריל ({Math.round(reelSeconds)} שניות).</p>
          <ol className="space-y-1.5 rounded-xl bg-[#FAF6F1] p-3">
            {kit.cards.map((c, i) => (
              <li key={i} className={cn("rounded-lg px-2 py-1.5 text-[14px] leading-snug transition", rec && now === i ? "bg-[#5E1D1D] font-bold text-[#FAF6F1]" : "text-[#2A2622]")}>
                {(c.headline ?? c.text).replace(/\*/g, "")}{c.headline && c.body ? `. ${c.body}` : ""}
              </li>
            ))}
          </ol>
          {rec ? (
            <button type="button" onClick={stop} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#A3402F] text-[15px] font-bold text-white">
              <span className="size-2.5 animate-pulse rounded-full bg-white" />לעצור · {secs.toFixed(1)} / {Math.round(reelSeconds)} שניות
            </button>
          ) : (
            <div className="flex gap-2 [&>*]:flex-1">
              <Btn onClick={start} className="min-h-[46px]"><Mic className="size-4" />{vo || take ? "להקליט מחדש" : "להקליט"}</Btn>
              <label className="inline-flex min-h-[46px] cursor-pointer items-center justify-center rounded-xl border border-[#5E1D1D]/50 bg-white/60 px-3 text-[13px] font-bold text-[#5E1D1D]">
                להעלות קובץ
                <input type="file" accept="audio/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }} />
              </label>
            </div>
          )}
          {take && !rec && (
            <div className="space-y-2 rounded-xl border border-[#B5848E] bg-[#FAF6F1] p-3">
              <p className="text-[13px] font-bold text-[#5E1D1D]">ההקלטה החדשה ({take.seconds.toFixed(1)} שניות)</p>
              <audio src={take.url} controls className="w-full" />
              <div className="flex gap-2 [&>*]:flex-1">
                <Btn busy={busy} onClick={() => save(take.blob, take.seconds)}>לשמור בריל</Btn>
                <Btn variant="line" onClick={() => setTake(null)}>לוותר</Btn>
              </div>
            </div>
          )}
          {vo && !take && !rec && (
            <div className="space-y-2 rounded-xl bg-[#FAF6F1] p-3">
              <p className="text-[13px] font-bold text-[#5E1D1D]">הקריינות של הריל ({vo.seconds.toFixed(1)} שניות)</p>
              {voUrl && <audio src={voUrl} controls className="w-full" />}
              <Row label="עוצמה">
                {([[0.5, "שקט"], [0.8, "רגיל"], [1, "מלא"]] as const).map(([v, l]) => <Chip key={l} on={(vo.volume ?? 1) === v} onClick={() => setVolume(v)}>{l}</Chip>)}
              </Row>
              {vo.seconds > reelSeconds + 0.5 && <p className="text-[12px] text-[#A3402F]">הקריינות ארוכה מהריל, אז הסוף שלה ייחתך. אפשר להקליט קצר יותר, או לבקש מהמעצב להאט.</p>}
              <button type="button" onClick={remove} className="text-[12px] font-bold text-[#A3402F] underline underline-offset-4">להסיר את הקריינות</button>
            </div>
          )}
          <p className="text-[11px] text-[#9A8C85]">באינסטגרם אפשר עדיין להוסיף מוזיקה טרנדית מתחת לקריינות, ולהנמיך אותה.</p>
        </div>
      )}
    </div>
  );
}

const POS: Shot["pos"][] = ["tr", "tc", "tl", "mr", "mc", "ml", "br", "bc", "bl"];

/** צילום או הקלטת מסך: לבחור איפה על המסך (תשעה מקומות), כמה גדול, ומעל או מתחת לטקסט */
function ShotControls({ shot, onChange, onRemove }: { shot: Shot; onChange: (p: Partial<Shot>) => void; onRemove: () => void }) {
  const pos = shot.pos ?? (shot.place === "top" ? "tc" : shot.place === "bottom" ? "bc" : "mc");
  const video = shot.kind === "video";
  return (
    <div className="w-full space-y-2 rounded-xl border border-[#E3D9CC] bg-white p-3">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-bold text-[#5E1D1D]">{video ? "הקלטת מסך" : "צילום מסך"}</span>
        <button type="button" onClick={onRemove} className="text-[12px] font-bold text-[#A3402F] underline underline-offset-4">להסיר</button>
      </div>
      <div className="flex gap-4">
        <div className="shrink-0">
          <p className="mb-1 text-[11px] font-bold text-[#6A6158]">איפה על המסך</p>
          <div className="grid w-[92px] shrink-0 grid-cols-3 gap-1 rounded-xl bg-[#2A2622] p-1.5">
            {POS.map((p) => (
              <button key={p} type="button" onClick={() => onChange({ pos: p })} aria-label={`מיקום ${p}`}
                className={cn("h-9 rounded-md transition", pos === p ? "bg-[#F7C9D6]" : "bg-white/15 hover:bg-white/30")} />
            ))}
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <Row label="גודל">
            {([["s", "קטן"], ["m", "בינוני"], ["l", "גדול"]] as const).map(([v, l]) => <Chip key={v} on={(shot.scale ?? "m") === v} onClick={() => onChange({ scale: v })}>{l}</Chip>)}
          </Row>
          {!video && (
            <Row label="שכבה">
              <Chip on={shot.layer !== "front"} onClick={() => onChange({ layer: "back" })}>מתחת לטקסט</Chip>
              <Chip on={shot.layer === "front"} onClick={() => onChange({ layer: "front" })}>מעל הטקסט</Chip>
            </Row>
          )}
          {!video && (
            <Row label="נטייה">
              <Chip on={shot.tilt !== false} onClick={() => onChange({ tilt: true })}>קצת עקום</Chip>
              <Chip on={shot.tilt === false} onClick={() => onChange({ tilt: false })}>ישר</Chip>
            </Row>
          )}
        </div>
      </div>
      {video && (
        <>
          <Row label="פריסה">
            <Chip on={!shot.split} onClick={() => onChange({ split: undefined })}>חלון</Chip>
            <Chip on={shot.split === "bottom"} onClick={() => onChange({ split: "bottom" })}>חצי מסך למטה</Chip>
            <Chip on={shot.split === "top"} onClick={() => onChange({ split: "top" })}>חצי מסך למעלה</Chip>
          </Row>
          <Row label="מתי">
            <Chip on={!shot.whole} onClick={() => onChange({ whole: false })}>בכרטיס הזה</Chip>
            <Chip on={!!shot.whole} onClick={() => onChange({ whole: true })}>לאורך כל הריל</Chip>
          </Row>
          <p className="text-[11px] text-[#9A8C85]">"חצי מסך" ו"לאורך כל הריל" יחד: את למעלה, והמסך שמראה מה קורה למטה, כמו בסרטונים שאהבת. הקלטת מסך תמיד מתחת לטקסט.</p>
        </>
      )}
    </div>
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

/**
 * כל כרטיס בנפרד: הטקסט (כותרת ראשית ומשנית), הסגנון והמיקום שלו, אנימציה קופצת וצילום מסך.
 * משחק מלא בלי לערוך מאפס. הטקסטים נשמרים בריל, והשאר בעיצוב.
 */
function TextsEditor({ draft, onChange, design, setD, globalStyle }: { draft: Draft; onChange: (d: Draft) => void; design: ReelDesign; setD: (p: Partial<ReelDesign> | null) => void; globalStyle: CaptionStyleId }) {
  const kit = draft.data.edit!;
  const [open, setOpen] = useState(false);
  const [cards, setCards] = useState(kit.cards.map((c) => ({ head: c.headline ?? c.text, body: c.headline ? c.body ?? "" : "" })));
  const [busy, setBusy] = useState("");
  useEffect(() => setCards(kit.cards.map((c) => ({ head: c.headline ?? c.text, body: c.headline ? c.body ?? "" : "" }))), [kit]);
  const dirty = cards.some((c, i) => c.head !== (kit.cards[i].headline ?? kit.cards[i].text) || c.body !== (kit.cards[i].headline ? kit.cards[i].body ?? "" : ""));
  const save = async () => {
    setBusy("save");
    const edit = { ...kit, cards: kit.cards.map((c, i) => ({ ...c, text: cards[i].head, headline: cards[i].head, body: cards[i].body })) };
    const history = [kit, ...(draft.data.edit_history ?? [])].slice(0, 6);
    const { data, error } = await db().from("studio_drafts").update({ data: { ...draft.data, edit, edit_history: history } }).eq("id", draft.id).select("*").single();
    setBusy("");
    if (error) return toast(error.message, true);
    onChange(data as Draft);
    toast("הטקסטים עודכנו");
  };
  const setCard = (n: number, patch: { style?: CaptionStyleId; place?: "top" | "middle" | "bottom" }) => {
    const cur = design.perCard?.[String(n)] ?? {};
    const next = { ...cur, ...patch };
    setD({ perCard: { ...(design.perCard ?? {}), [String(n)]: next } });
  };
  const setMotion = (n: number, m: MotionId | "off" | null) => {
    const map = { ...(design.cardMotion ?? {}) };
    if (m === null) delete map[String(n)]; else map[String(n)] = m;
    setD({ cardMotion: map });
  };
  const addShot = async (n: number, file: File) => {
    setBusy(`shot${n}`);
    try {
      const isVideo = file.type.startsWith("video/");
      const meta = isVideo
        ? await new Promise<{ width: number; height: number; seconds: number }>((res, rej) => { const v = document.createElement("video"); v.preload = "metadata"; v.onloadedmetadata = () => res({ width: v.videoWidth, height: v.videoHeight, seconds: v.duration }); v.onerror = () => rej(new Error("הסרטון לא נקרא")); v.src = URL.createObjectURL(file); })
        : await createImageBitmap(file).then((b) => ({ width: b.width, height: b.height, seconds: 0 }));
      const { data: u } = await db().auth.getUser();
      if (!u.user) throw new Error("צריך להתחבר מחדש");
      const ext = (file.name.split(".").pop() || (isVideo ? "mp4" : "png")).toLowerCase();
      const path = `${u.user.id}/studio/${draft.id}/shot-${Date.now()}.${ext}`;
      const { error } = await db().storage.from(MEDIA_BUCKET).upload(path, file, { contentType: file.type || "image/png" });
      if (error) throw new Error(error.message);
      setD({ shots: [...(design.shots ?? []), { card: n, path, w: meta.width, h: meta.height, place: "middle", kind: isVideo ? "video" : "image", ...(isVideo ? { seconds: +meta.seconds.toFixed(2) } : {}) }] });
      toast(isVideo ? "הקלטת המסך נוספה" : "צילום המסך נוסף");
    } catch (e) { toast((e as Error).message, true); }
    finally { setBusy(""); }
  };
  const removeShot = (path: string) => setD({ shots: (design.shots ?? []).filter((s) => s.path !== path) });
  const updateShot = (path: string, patch: Partial<Shot>) => setD({ shots: (design.shots ?? []).map((s) => (s.path === path ? { ...s, ...patch } : s)) });

  return (
    <div className="rounded-2xl border border-[#E3D9CC] bg-white/70">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between px-4 py-3 text-right text-[14px] font-bold text-[#5E1D1D]">
        כל כרטיס בנפרד: טקסט, סגנון, גרפיקה, צילום מסך
        <span className="text-xl leading-none">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-[#E3D9CC] px-4 py-4">
          {cards.map((c, i) => {
            const n = i + 1;
            const pc = design.perCard?.[String(n)] ?? {};
            const shots = (design.shots ?? []).filter((s) => s.card === n);
            return (
              <div key={i} className="space-y-2 rounded-xl bg-[#FAF6F1] p-3">
                <p className="text-[12px] font-black text-[#5E1D1D]">כרטיס {n}</p>
                <input className={inputCls} value={c.head} placeholder="כותרת ראשית" onChange={(e) => setCards((x) => x.map((y, j) => (j === i ? { ...y, head: e.target.value } : y)))} />
                <input className={cn(inputCls, "text-[14px]")} value={c.body} placeholder="כותרת משנית (לא חובה)" onChange={(e) => setCards((x) => x.map((y, j) => (j === i ? { ...y, body: e.target.value } : y)))} />
                <RewriteChips account={draft.account} headline={c.head} body={c.body} onDone={(head, body) => setCards((x) => x.map((y, j) => (j === i ? { head, body } : y)))} />
                <Row label="סגנון לכרטיס הזה" scroll>
                  <Chip on={!pc.style} onClick={() => setCard(n, { style: undefined })}>כמו בגרסה</Chip>
                  {REEL_STYLES.map((st) => <Chip key={st.id} on={pc.style === st.id} onClick={() => setCard(n, { style: st.id })}>{st.variant} · {st.label.split(":")[0]}</Chip>)}
                </Row>
                <Row label="מיקום">
                  <Chip on={!pc.place} onClick={() => setCard(n, { place: undefined })}>כמו בכולם</Chip>
                  {([["top", "למעלה"], ["middle", "באמצע"], ["bottom", "למטה"]] as const).map(([v, l]) => <Chip key={v} on={pc.place === v} onClick={() => setCard(n, { place: v })}>{l}</Chip>)}
                </Row>
                <Row label="גרפיקה לכרטיס הזה" scroll>
                  <Chip on={!design.cardMotion?.[String(n)]} onClick={() => setMotion(n, null)}>כמו בכולם</Chip>
                  <Chip on={design.cardMotion?.[String(n)] === "off"} onClick={() => setMotion(n, "off")}>בלי</Chip>
                  {MOTIONS.map((m) => <Chip key={m.id} on={design.cardMotion?.[String(n)] === m.id} onClick={() => setMotion(n, m.id)}>{m.label}</Chip>)}
                </Row>
                <div>
                  <p className="mb-1.5 text-[12px] font-bold text-[#6A6158]">צילום מסך או הקלטת מסך שקופצים</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {shots.map((s) => <ShotControls key={s.path} shot={s} onChange={(patch) => updateShot(s.path, patch)} onRemove={() => removeShot(s.path)} />)}
                    <label className={cn("inline-flex min-h-[38px] cursor-pointer items-center rounded-xl border border-dashed border-[#B5848E] px-3 text-[13px] font-bold text-[#5E1D1D]", busy === `shot${n}` && "opacity-50")}>
                      {busy === `shot${n}` ? "מעלה..." : "+ צילום מסך או הקלטת מסך"}
                      <input type="file" accept="image/*,video/*" className="sr-only" disabled={!!busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void addShot(n, f); }} />
                    </label>
                  </div>
                </div>
              </div>
            );
          })}
          <Btn busy={busy === "save"} disabled={!dirty} onClick={save} className="w-full">לשמור את הטקסטים</Btn>
          <p className="text-[11px] text-[#9A8C85]">סגנון, מיקום, גרפיקה וצילומי מסך נשמרים לבד.</p>
        </div>
      )}
    </div>
  );
}

function Row({ label, children, scroll }: { label: string; children: React.ReactNode; scroll?: boolean }) {
  return (
    <div>
      <p className="mb-1.5 text-[12px] font-bold text-[#6A6158]">{label}</p>
      <div className={cn("flex gap-1.5", scroll ? "-mx-3 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&>*]:shrink-0" : "flex-wrap")}>{children}</div>
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
    <span className="relative block aspect-[4/5] w-full overflow-hidden" style={{ background: "linear-gradient(170deg,#b98a7c,#6f3a36 60%,#2a1212)", fontFamily: font }}>
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
      {id === "list" && (
        <span className="absolute inset-x-1 top-[8%] text-center leading-tight">
          <span className="block text-[13px] font-black" style={{ color: acc }}>7 <span style={{ color: main }}>דברים</span></span>
          <span className="mt-1 grid grid-cols-2 gap-x-1 text-right text-[6px] font-bold text-white/80">
            <span>01 תכנון</span><span>04 קניות</span><span style={{ color: acc }}>02 ארוחות</span><span>05 זמן</span><span>03 רשימה</span><span>06 סדר</span>
          </span>
        </span>
      )}
      {id === "hook" && (
        <span className="absolute inset-x-1 top-[12%] text-center leading-tight" style={{ color: main }}>
          <span className="block text-[11px]" style={{ fontFamily: '"Frank Ruhl Libre"' }}>הפסקתי לתכנן תוכן.</span>
          <span className="block text-[12px]" style={{ fontFamily: '"Bellefair"' }}>Claude עושה את זה.</span>
        </span>
      )}
      {id === "box" && (
        <span className="absolute inset-x-1.5 top-[52%] text-center">
          <span className="inline-block rounded-md bg-white px-1.5 py-1 text-[10px] font-bold leading-tight text-[#111]">ככה נראה שבוע של תוכן, בלי לשבת בלילה</span>
        </span>
      )}
      {id === "marker" && (
        <span className="absolute inset-x-1 top-[34%] text-center leading-tight">
          <span className="inline-block -rotate-2 px-1 text-[12px] font-black text-[#2A2622]" style={{ background: acc }}>ככה עורכים</span>
          <span className="mt-1 block text-[9px] font-bold" style={{ color: design.body ?? acc }}>בלי לשבת בלילה</span>
        </span>
      )}
      {id === "neon" && <span className="absolute inset-0 flex items-center justify-center text-[18px] font-black" style={{ color: main, textShadow: `0 0 6px ${acc}, 0 0 14px ${acc}` }}>ככה</span>}
      {id === "outline" && <span className="absolute inset-0 flex items-center justify-center text-[24px] font-black" style={{ color: "transparent", WebkitTextStroke: `1.2px ${main}` }}>ככה</span>}
      {id === "stairs" && (
        <span className="absolute inset-x-1 top-[26%] text-center font-black leading-none">
          <span className="block -translate-x-2 text-[15px]" style={{ color: main }}>ככה</span>
          <span className="block translate-x-2 text-[11px]" style={{ color: acc }}>עורכים</span>
          <span className="block -translate-x-2 text-[15px]" style={{ color: main }}>תוכן</span>
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
