"use client";
import { Copy, Layers, Trash2, X } from "lucide-react";
import { beginGesture, useEditor } from "@/stores/editor-store";
import type { LayerLayout, VideoLayer } from "@/lib/editor/types";
import { uid } from "@/lib/editor/timeline-utils";
import { cn } from "@/lib/utils";
import { IconButton, Section } from "./ui";

const LAYOUTS: { id: LayerLayout; label: string; hint: string }[] = [
  { id: "pip", label: "🪟 חלון קטן", hint: "סרטון בחלון מעל הסרטון הראשי. גוררים אותו על הנגן" },
  { id: "clone-right", label: "👯 תאומים (ימין)", hint: "חצי ימני מהצילום הזה מעל הראשי: אותו אדם פעמיים. מצלמים פעמיים מאותה נקודה, בלי להזיז את הטלפון" },
  { id: "clone-left", label: "👯 תאומים (שמאל)", hint: "כמו תאומים, עם החצי השמאלי" },
  { id: "split-right", label: "◧ מסך מפוצל לצד", hint: "שני סרטונים זה ליד זה" },
  { id: "split-bottom", label: "⬒ מסך מפוצל למטה", hint: "שני סרטונים אחד מעל השני" },
];

/** עריכת שכבת וידאו (אוברליי, תאומים, מסך מפוצל) */
export function LayerInspector({ id, onClose }: { id: string; onClose: () => void }) {
  const layer = useEditor((s) => s.timeline.layers?.find((l) => l.id === id) ?? null);
  const asset = useEditor((s) => (layer ? s.assets[layer.assetId] : null));
  if (!layer) return null;
  const set = (patch: Partial<VideoLayer>) => { const end = beginGesture(); useEditor.getState().updateLayer(id, patch); end(); };
  const live = (patch: Partial<VideoLayer>) => useEditor.getState().updateLayer(id, patch);
  const layout = LAYOUTS.find((l) => l.id === layer.layout)!;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3 text-sm font-semibold">
        <Layers className="size-4 text-emerald-400" /> שכבת וידאו
        <span className="truncate text-xs font-normal text-zinc-500">{asset?.name}</span>
        <div className="ms-auto flex gap-1">
          <IconButton label="שכפול השכבה" onClick={() => {
            const end = beginGesture();
            useEditor.setState((s) => ({ timeline: { ...s.timeline, layers: [...(s.timeline.layers ?? []), { ...layer, id: uid("layer"), x: Math.min(0.85, layer.x + 0.08), y: Math.min(0.85, layer.y + 0.08) }] } }));
            end();
          }}><Copy className="size-4" /></IconButton>
          <IconButton label="מחיקה" onClick={() => useEditor.getState().removeSelected()}><Trash2 className="size-4" /></IconButton>
          <IconButton label="סגירה" onClick={onClose}><X className="size-4" /></IconButton>
        </div>
      </header>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 text-sm">
        <Section title="סוג השכבה">
          <div className="grid grid-cols-2 gap-1.5">
            {LAYOUTS.map((l) => (
              <Chip key={l.id} on={layer.layout === l.id} onClick={() => set({ layout: l.id, volume: l.id === "pip" ? 0 : layer.volume || 1 })}>{l.label}</Chip>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-400">{layout.hint}</p>
        </Section>

        {layer.layout === "pip" && (
          <>
            <Section title="צורה">
              <div className="grid grid-cols-3 gap-1.5">
                {([["rect", "▭ מלבן"], ["rounded", "▢ מעוגל"], ["circle", "◯ עיגול"]] as const).map(([v, l]) => (
                  <Chip key={v} on={layer.shape === v} onClick={() => set({ shape: v })}>{l}</Chip>
                ))}
              </div>
              <label className="mt-2 flex items-center gap-2 text-xs text-zinc-300">
                <input type="checkbox" checked={layer.border} onChange={(e) => set({ border: e.target.checked })} className="accent-violet-500" /> מסגרת לבנה
              </label>
            </Section>
            <Section title={`גודל · ${Math.round(layer.scale * 100)}%`}>
              <input type="range" min={0.15} max={1} step={0.01} value={layer.scale} dir="ltr"
                onPointerDown={() => { gesture = beginGesture(); }} onPointerUp={() => { gesture?.(); gesture = null; }}
                onChange={(e) => live({ scale: +e.target.value })} className="w-full accent-violet-500" />
              <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                {([["↖", 0.28, 0.2], ["↗", 0.72, 0.2], ["↙", 0.28, 0.78], ["↘", 0.72, 0.78]] as const).map(([l, x, y]) => (
                  <Chip key={l} on={Math.abs(layer.x - x) < 0.02 && Math.abs(layer.y - y) < 0.02} onClick={() => set({ x, y })}>{l}</Chip>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-zinc-500">אפשר גם לגרור את החלון על הנגן</p>
            </Section>
          </>
        )}

        <Section title={`שקיפות · ${Math.round(layer.opacity * 100)}%`}>
          <input type="range" min={0.1} max={1} step={0.05} value={layer.opacity} dir="ltr"
            onPointerDown={() => { gesture = beginGesture(); }} onPointerUp={() => { gesture?.(); gesture = null; }}
            onChange={(e) => live({ opacity: +e.target.value })} className="w-full accent-violet-500" />
        </Section>
        <Section title={`סאונד של השכבה · ${Math.round(layer.volume * 100)}%`}>
          <input type="range" min={0} max={1} step={0.05} value={layer.volume} dir="ltr"
            onPointerDown={() => { gesture = beginGesture(); }} onPointerUp={() => { gesture?.(); gesture = null; }}
            onChange={(e) => live({ volume: +e.target.value })} className="w-full accent-violet-500" />
        </Section>
        <label className="flex items-center gap-2 text-xs text-zinc-300">
          <input type="checkbox" checked={!!layer.flip} onChange={(e) => set({ flip: e.target.checked })} className="accent-violet-500" /> היפוך מראה
        </label>
        <p className="text-[11px] text-zinc-500">בציר הזמן (בפס הירוק ⧉): גרירה מזיזה את השכבה, והקצוות קובעים מתי היא מתחילה ונגמרת.</p>
      </div>
    </div>
  );
}

let gesture: (() => void) | null = null;

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={cn("rounded-md border px-2 py-2 text-xs", on ? "border-emerald-400 bg-emerald-500/15 text-white" : "border-zinc-700 text-zinc-300 hover:border-zinc-500")}>
      {children}
    </button>
  );
}
