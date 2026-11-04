"use client";
import { useRef } from "react";
import { beginGesture, useEditor } from "@/stores/editor-store";
import { usePlayback } from "@/stores/playback-store";
import { cn } from "@/lib/utils";

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
  if (!caption || playing) return null;

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
      <span className="-me-3 grid size-6 place-items-center rounded-full bg-sky-400 text-[11px] font-bold text-zinc-950 shadow">↕</span>
    </div>
  );
}
