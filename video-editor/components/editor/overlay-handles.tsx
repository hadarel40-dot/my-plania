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
