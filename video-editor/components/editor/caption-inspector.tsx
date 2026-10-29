"use client";
import { Type } from "lucide-react";
import { useEditor } from "@/stores/editor-store";
import type { Caption, CaptionPreset } from "@/lib/editor/types";
import { cn } from "@/lib/utils";

const PRESETS: { id: CaptionPreset; label: string }[] = [
  { id: "bold-pop", label: "בולט" },
  { id: "karaoke", label: "קריוקי" },
  { id: "minimal", label: "מינימלי" },
];

export function CaptionInspector({ caption }: { caption: Caption }) {
  const { updateCaption } = useEditor.getState();
  const set = (patch: Partial<Caption>) => updateCaption(caption.id, patch);

  return (
    <aside className="flex min-h-0 w-full shrink-0 flex-col border-zinc-800 bg-zinc-900/40 md:w-[22rem] md:border-s">
      <header className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3 text-sm font-semibold">
        <Type className="size-4 text-sky-400" /> כתובית
      </header>
      <div className="space-y-4 p-4 text-sm">
        <label className="block">
          <span className="text-xs text-zinc-400">טקסט</span>
          <textarea value={caption.text} rows={3} onChange={(e) => set({ text: e.target.value })}
            className="mt-1 w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 p-2 focus:border-blue-500 focus:outline-none" />
        </label>
        <div>
          <span className="text-xs text-zinc-400">סגנון</span>
          <div className="mt-1 grid grid-cols-3 gap-1.5">
            {PRESETS.map((p) => (
              <button key={p.id} onClick={() => set({ preset: p.id })}
                className={cn("rounded-md border py-1.5 text-xs",
                  caption.preset === p.id ? "border-blue-500 bg-blue-500/15" : "border-zinc-700 hover:border-zinc-500")}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumField label="התחלה (שנ׳)" value={caption.start}
            onChange={(v) => set({ start: Math.max(0, Math.min(v, caption.end - 0.1)) })} />
          <NumField label="סיום (שנ׳)" value={caption.end}
            onChange={(v) => set({ end: Math.max(v, caption.start + 0.1) })} />
        </div>
      </div>
    </aside>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="text-xs text-zinc-400">{label}</span>
      <input type="number" step={0.1} value={value} dir="ltr"
        onChange={(e) => onChange(+e.target.value)}
        className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 tabular-nums focus:border-blue-500 focus:outline-none" />
    </label>
  );
}
