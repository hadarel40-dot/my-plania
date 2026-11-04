"use client";
import { useRef } from "react";
import { beginGesture, useEditor } from "@/stores/editor-store";
import { usePlayback } from "@/stores/playback-store";
import { cn } from "@/lib/utils";
import { layoutClips } from "@/lib/editor/timeline-utils";

/**
 * שכבת "ידיות" מעל הנגן: לכל טקסט/אימוג'י שמופיע כרגע יש אזור שאפשר לתפוס
 * ולגרור כדי להזיז אותו על המסך. מחוץ לידיות, לחיצה עוברת לנגן כרגיל.
 */
export function OverlayHandles() {
  const overlays = useEditor((s) => s.timeline.overlays);
  const selectedId = useEditor((s) => (s.selection?.kind === "overlay" ? s.selection.id : null));
  const t = usePlayback((s) => s.currentTime);
  const layerRef = useRef<HTMLDivElement>(null);
  const visible = overlays.filter((o) => t >= o.start && t < o.end);

  function onDown(e: React.PointerEvent, id: string) {
    e.stopPropagation();
    const layer = layerRef.current!.getBoundingClientRect();
    const o = useEditor.getState().timeline.overlays.find((x) => x.id === id)!;
    useEditor.getState().select({ kind: "overlay", id });
    const finish = beginGesture();
    const x0 = o.x, y0 = o.y, cx = e.clientX, cy = e.clientY;
    const move = (ev: PointerEvent) => {
      const clamp = (v: number) => Math.max(0.03, Math.min(0.97, v));
      useEditor.getState().updateOverlay(id, {
        x: +clamp(x0 + (ev.clientX - cx) / layer.width).toFixed(3),
        y: +clamp(y0 + (ev.clientY - cy) / layer.height).toFixed(3),
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      finish();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }

  return (
    <div ref={layerRef} className="pointer-events-none absolute inset-0">
      <CutoutHandle layerRef={layerRef} />
      <LayerHandles layerRef={layerRef} />
      <CaptionHandle layerRef={layerRef} />
      {visible.map((o) => {
        // גודל משוער של הפריט על המסך (unit = רוחב התצוגה / 1080)
        const unit = (layerRef.current?.clientWidth ?? 300) / 1080;
        const chars = Math.min(18, [...o.text].length);
        const w = o.kind === "emoji" ? o.size * unit * 1.2 : Math.max(40, o.size * unit * chars * 0.6);
        const h = o.size * unit * (o.kind === "emoji" ? 1.2 : 1.4);
        return (
          <div key={o.id} onPointerDown={(e) => onDown(e, o.id)} title="גרירה להזזה"
            className={cn("pointer-events-auto absolute touch-none -translate-x-1/2 -translate-y-1/2 cursor-move rounded-md border-2 transition-colors",
              o.id === selectedId ? "border-dashed border-amber-400" : "border-transparent hover:border-white/50")}
            style={{ left: `${o.x * 100}%`, top: `${o.y * 100}%`, width: w, height: h }} />
        );
      })}
    </div>
  );
}

/**
 * הכתוביות על הנגן: כשהסרטון עוצר, מסגרת מקווקווה סביב הכתובית שמוצגת. גוררים אותה
 * למעלה או למטה כדי להזיז את כל הכתוביות; לחיצה בלי גרירה פותחת את העריכה שלה.
 */
function CaptionHandle({ layerRef }: { layerRef: React.RefObject<HTMLDivElement | null> }) {
  const t = usePlayback((s) => s.currentTime);
  const playing = usePlayback((s) => s.playing);
  const caption = useEditor((s) => s.timeline.captions.find((c) => t >= c.start && t < c.end) ?? null);
  const y = useEditor((s) => s.timeline.captionStyle?.y ?? s.timeline.captions[0]?.y ?? 0.78);
  const size = useEditor((s) => s.timeline.captionStyle?.size ?? s.timeline.captions[0]?.size ?? 1);
  if (!caption || playing) return null;

  function resize(d: number) {
    const end = beginGesture();
    useEditor.getState().styleAllCaptions({ size: +Math.min(2.2, Math.max(0.5, size + d)).toFixed(2) });
    end();
  }

  function onDown(e: React.PointerEvent) {
    e.stopPropagation();
    const rect = layerRef.current!.getBoundingClientRect();
    const finish = beginGesture();
    const y0 = y, cy = e.clientY;
    let moved = false;
    const move = (ev: PointerEvent) => {
      if (Math.abs(ev.clientY - cy) > 4) moved = true;
      const ny = Math.max(0.1, Math.min(0.9, y0 + (ev.clientY - cy) / rect.height));
      useEditor.getState().styleAllCaptions({ y: +ny.toFixed(3) });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      finish();
      if (!moved && caption) useEditor.getState().select({ kind: "caption", id: caption.id });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }

  return (
    <div onPointerDown={onDown} title="גרירה למעלה או למטה מזיזה את הכתוביות"
      className="pointer-events-auto absolute inset-x-[6%] flex -translate-y-1/2 touch-none cursor-ns-resize items-center justify-end rounded-lg border-2 border-dashed border-sky-300/70"
      style={{ top: `${y * 100}%`, height: "13%" }}>
      {/* קטן / גדול ישר על הסרטון */}
      <div className={cn("absolute start-0 flex gap-1", y < 0.25 ? "-bottom-8" : "-top-8")} onPointerDown={(e) => e.stopPropagation()}>
        {([["A−", -0.1], ["A+", 0.1]] as const).map(([l, d]) => (
          <button key={l} onClick={(e) => { e.stopPropagation(); resize(d); }} aria-label={d > 0 ? "כתוביות גדולות יותר" : "כתוביות קטנות יותר"}
            className="grid h-6 min-w-8 place-items-center rounded-full bg-sky-400 px-1.5 text-[11px] font-bold text-zinc-950 shadow">{l}</button>
        ))}
      </div>
      <span className="-me-3 grid size-6 place-items-center rounded-full bg-sky-400 text-[11px] font-bold text-zinc-950 shadow">↕</span>
    </div>
  );
}

/**
 * חלונות וידאו (אוברליי) על הנגן: גרירה מזיזה את החלון, לחיצה בוחרת אותו (נפתחות ההגדרות).
 * בתאומים ומסך מפוצל אין מה להזיז: לחיצה על החצי בוחרת את השכבה.
 */
function LayerHandles({ layerRef }: { layerRef: React.RefObject<HTMLDivElement | null> }) {
  const t = usePlayback((s) => s.currentTime);
  // מערך קבוע כשאין שכבות (מערך חדש בכל קריאה גורם לרינדור אינסופי)
  const layers = useEditor((s) => s.timeline.layers ?? NO_LAYERS);
  const assets = useEditor((s) => s.assets);
  const selectedId = useEditor((s) => (s.selection?.kind === "layer" ? s.selection.id : null));
  const aspect = useEditor((s) => s.timeline.aspect);
  const visible = layers.filter((l) => t >= l.start && t < l.start + (l.out - l.in));
  if (!visible.length) return null;
  const [aw, ah] = aspect === "16:9" ? [16, 9] : aspect === "1:1" ? [1, 1] : [9, 16];

  function onDown(e: React.PointerEvent, id: string) {
    e.stopPropagation();
    const rect = layerRef.current!.getBoundingClientRect();
    const l = useEditor.getState().timeline.layers!.find((x) => x.id === id)!;
    useEditor.getState().select({ kind: "layer", id });
    if (l.layout !== "pip") return;
    const finish = beginGesture();
    const x0 = l.x, y0 = l.y, cx = e.clientX, cy = e.clientY;
    const move = (ev: PointerEvent) => {
      const clamp = (v: number) => Math.max(0.05, Math.min(0.95, v));
      useEditor.getState().updateLayer(id, { x: +clamp(x0 + (ev.clientX - cx) / rect.width).toFixed(3), y: +clamp(y0 + (ev.clientY - cy) / rect.height).toFixed(3) });
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); finish(); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }

  return (
    <>
      {visible.map((l) => {
        const asset = assets[l.assetId];
        let style: React.CSSProperties;
        if (asset?.alphaPacked) {
          // אדם בלי רקע: הקופסה היא חלק מהמסך עצמו (scale מהמסך), באותו יחס
          style = { left: `${(l.x - l.scale / 2) * 100}%`, top: `${(l.y - l.scale / 2) * 100}%`, width: `${l.scale * 100}%`, height: `${l.scale * 100}%` };
        } else if (l.layout === "pip") {
          const ratio = l.shape === "circle" ? 1 : asset?.width && asset.height ? asset.height / asset.width : 16 / 9;
          // רוחב החלון ביחס לרוחב המסך, והגובה ביחס לגובה (לפי יחס המסך)
          const wPct = l.scale * 100, hPct = l.scale * ratio * (aw / ah) * 100;
          style = { left: `${l.x * 100 - wPct / 2}%`, top: `${l.y * 100 - hPct / 2}%`, width: `${wPct}%`, height: `${hPct}%` };
        } else if (l.layout === "clone-left") style = { left: 0, top: 0, width: "50%", height: "100%" };
        else if (l.layout === "clone-right" || l.layout === "split-right") style = { left: "50%", top: 0, width: "50%", height: "100%" };
        else style = { left: 0, top: "50%", width: "100%", height: "50%" };
        return (
          <div key={l.id} onPointerDown={(e) => onDown(e, l.id)} title={l.layout === "pip" ? "גרירה להזזה" : "לחיצה לעריכה"}
            // תאומים / מפוצל תופסים חצי מסך: רק מסמנים אותם כשהם נבחרים, בלי לחסום לחיצות על הנגן
            className={cn("absolute touch-none rounded-md border-2 transition-colors", l.layout === "pip" ? "pointer-events-auto cursor-move" : "pointer-events-none",
              l.id === selectedId ? "border-dashed border-emerald-400" : "border-transparent hover:border-white/40")}
            style={style} />
        );
      })}
    </>
  );
}

const NO_LAYERS: import("@/lib/editor/types").VideoLayer[] = [];

/**
 * אדם בלי רקע (בקליפ הראשי): ידית עגולה במרכז שלו לגרירה, וקו מקווקו סביבו.
 * הידית קטנה בכוונה, כדי שלחיצה על שאר הנגן תמשיך לעבוד.
 */
function CutoutHandle({ layerRef }: { layerRef: React.RefObject<HTMLDivElement | null> }) {
  const t = usePlayback((s) => s.currentTime);
  const clips = useEditor((s) => s.timeline.clips);
  const assets = useEditor((s) => s.assets);
  const hit = layoutClips(clips).find((l) => t >= l.start && t < l.end);
  const clip = hit?.clip;
  if (!clip || !assets[clip.assetId]?.alphaPacked) return null;
  const cut = clip.cutout ?? { x: 0.5, y: 0.5, scale: 1 };

  function onDown(e: React.PointerEvent) {
    e.stopPropagation();
    const rect = layerRef.current!.getBoundingClientRect();
    const finish = beginGesture();
    const x0 = cut.x, y0 = cut.y, cx = e.clientX, cy = e.clientY, src = clip!.sourceAssetId;
    const move = (ev: PointerEvent) => {
      const clamp = (v: number) => Math.max(-0.2, Math.min(1.2, v));
      const next = { x: +clamp(x0 + (ev.clientX - cx) / rect.width).toFixed(3), y: +clamp(y0 + (ev.clientY - cy) / rect.height).toFixed(3), scale: cut.scale };
      useEditor.setState((s) => ({ timeline: { ...s.timeline, clips: s.timeline.clips.map((c) => (c.sourceAssetId === src ? { ...c, cutout: next } : c)) } }));
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); finish(); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }

  return (
    <>
      <div className="pointer-events-none absolute rounded-md border border-dashed border-white/40"
        style={{ left: `${(cut.x - cut.scale / 2) * 100}%`, top: `${(cut.y - cut.scale / 2) * 100}%`, width: `${cut.scale * 100}%`, height: `${cut.scale * 100}%` }} />
      <div onPointerDown={onDown} title="גרירה להזזת האדם"
        className="pointer-events-auto absolute grid size-10 -translate-x-1/2 -translate-y-1/2 cursor-move touch-none place-items-center rounded-full border-2 border-white bg-violet-600/80 text-lg text-white shadow-lg"
        style={{ left: `${Math.min(92, Math.max(8, cut.x * 100))}%`, top: `${Math.min(92, Math.max(8, cut.y * 100))}%` }}>✥</div>
    </>
  );
}
