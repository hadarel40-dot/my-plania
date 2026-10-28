"use client";
import { Music, Trash2, X } from "lucide-react";
import { useEditor } from "@/stores/editor-store";
import { formatTime } from "@/lib/editor/timeline-utils";
import { IconButton, Section } from "./ui";
import { NumField } from "./overlay-inspector";

export function AudioInspector({ id, onClose }: { id: string; onClose: () => void }) {
  const a = useEditor((s) => s.timeline.audio.find((x) => x.id === id) ?? null);
  const asset = useEditor((s) => (a ? s.assets[a.assetId] : null));
  const { updateAudioClip, removeSelected } = useEditor.getState();
  if (!a) return null;
  const length = a.out - a.in;

  return (
    <>
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          <Music className="size-4 shrink-0 text-emerald-400" />
          <span className="truncate">{asset?.name ?? "סאונד"}</span>
        </h2>
        <div className="flex gap-1">
          <IconButton label="מחק" onClick={removeSelected}><Trash2 className="size-4" /></IconButton>
          <IconButton label="סגור" onClick={onClose}><X className="size-4" /></IconButton>
        </div>
      </header>

      <div className="space-y-5 p-4">
        <Slider label="עוצמה" value={a.volume} min={0} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => updateAudioClip(a.id, { volume: v })} />
        <Slider label="דהייה פנימה" value={a.fadeIn} min={0} max={Math.min(5, length / 2)} step={0.1} format={(v) => `${v.toFixed(1)} שנ׳`}
          onChange={(v) => updateAudioClip(a.id, { fadeIn: v })} />
        <Slider label="דהייה החוצה" value={a.fadeOut} min={0} max={Math.min(5, length / 2)} step={0.1} format={(v) => `${v.toFixed(1)} שנ׳`}
          onChange={(v) => updateAudioClip(a.id, { fadeOut: v })} />

        <Section title="זמן" hint={`אורך ${formatTime(length).slice(0, 5)}`}>
          <div className="grid grid-cols-2 gap-3">
            <NumField label="מתחיל בסרטון (שנ׳)" value={a.start} onChange={(v) => updateAudioClip(a.id, { start: v })} />
            <NumField label="מתחיל בקובץ (שנ׳)" value={a.in} onChange={(v) => updateAudioClip(a.id, { in: v })} />
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
            גוררים את הקטע בציר הזמן כדי להזיז אותו, ואת הקצוות שלו כדי לקצר.
          </p>
        </Section>
      </div>
    </>
  );
}

function Slider({ label, value, min, max, step, format, onChange }: {
  label: string; value: number; min: number; max: number; step: number;
  format: (v: number) => string; onChange: (v: number) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="flex justify-between text-xs text-zinc-400"><span>{label}</span><span className="tabular-nums">{format(value)}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)}
        className="mt-1 w-full accent-emerald-500" />
    </label>
  );
}
