"use client";
import { Copy, Trash2, X } from "lucide-react";
import { useEditor } from "@/stores/editor-store";
import { ANIM_IN_LABELS, ANIM_OUT_LABELS, LOOP_LABELS } from "@/lib/editor/overlay-presets";
import type { Overlay } from "@/lib/editor/types";
import { uid } from "@/lib/editor/timeline-utils";
import { cn } from "@/lib/utils";
import { IconButton, Section } from "./ui";

const COLORS = ["#ffffff", "#111111", "#facc15", "#f43f5e", "#ef4444", "#22c55e", "#38bdf8", "#7c3aed", "#f97316"];
const BACKGROUNDS = [null, "#111111", "#ffffffee", "#7c3aed", "#f43f5e", "#facc15", "#22c55e"];
const EMOJIS = ["🔥", "❤️", "😂", "🤯", "👇", "👉", "✨", "💯", "🎉", "😍", "👀", "✅", "❌", "⭐", "💪", "🙌"];
/** 9 נקודות מיקום מהירות: x,y */
const POSITIONS: [number, number][] = [
  [0.2, 0.15], [0.5, 0.15], [0.8, 0.15],
  [0.2, 0.5], [0.5, 0.5], [0.8, 0.5],
  [0.2, 0.82], [0.5, 0.82], [0.8, 0.82],
];

export function OverlayInspector({ id, onClose }: { id: string; onClose: () => void }) {
  const o = useEditor((s) => s.timeline.overlays.find((x) => x.id === id) ?? null);
  const { updateOverlay, removeSelected } = useEditor.getState();
  if (!o) return null;
  const set = (patch: Partial<Overlay>) => updateOverlay(o.id, patch);

  function duplicate() {
    useEditor.setState((s) => {
      const copy = { ...o!, id: uid("ovl"), start: o!.end, end: o!.end + (o!.end - o!.start) };
      s.timeline.overlays.push(copy);
      s.selection = { kind: "overlay", id: copy.id };
    });
  }

  return (
    <>
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <h2 className="text-sm font-semibold">{o.kind === "emoji" ? "אימוג'י" : "טקסט"}</h2>
        <div className="flex gap-1">
          <IconButton label="שכפל" onClick={duplicate}><Copy className="size-4" /></IconButton>
          <IconButton label="מחק" onClick={removeSelected}><Trash2 className="size-4" /></IconButton>
          <IconButton label="סגור" onClick={onClose}><X className="size-4" /></IconButton>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        {o.kind === "text" ? (
          <textarea value={o.text} rows={2} onChange={(e) => set({ text: e.target.value })} aria-label="טקסט"
            className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 p-2 text-base focus:border-violet-500 focus:outline-none" />
        ) : (
          <div className="grid grid-cols-8 gap-1">
            {EMOJIS.map((e) => (
              <button key={e} onClick={() => set({ text: e })}
                className={cn("rounded-md py-1 text-xl", o.text === e ? "bg-violet-600" : "hover:bg-zinc-800")}>{e}</button>
            ))}
          </div>
        )}

        <Section title="אנימציית כניסה">
          <Chips value={o.animIn} options={ANIM_IN_LABELS} onChange={(v) => set({ animIn: v })} />
        </Section>
        <Section title="תנועה בזמן ההופעה">
          <Chips value={o.loop} options={LOOP_LABELS} onChange={(v) => set({ loop: v })} />
        </Section>
        <Section title="יציאה">
          <Chips value={o.animOut} options={ANIM_OUT_LABELS} onChange={(v) => set({ animOut: v })} />
        </Section>

        <Section title="גודל">
          <input type="range" min={30} max={300} step={2} value={o.size} aria-label="גודל"
            onChange={(e) => set({ size: +e.target.value })} className="w-full accent-violet-500" />
        </Section>

        {o.kind === "text" && (
          <>
            <Section title="צבע">
              <Swatches value={o.color} options={COLORS} onChange={(c) => set({ color: c! })} />
            </Section>
            <Section title="רקע">
              <Swatches value={o.background} options={BACKGROUNDS} onChange={(c) => set({ background: c })} />
            </Section>
            <div className="flex gap-2">
              <Toggle on={o.stroke} onClick={() => set({ stroke: !o.stroke })}>קו מתאר</Toggle>
              {([400, 700, 900] as const).map((w) => (
                <Toggle key={w} on={o.weight === w} onClick={() => set({ weight: w })}>
                  <span style={{ fontWeight: w }}>{w === 400 ? "רגיל" : w === 700 ? "מודגש" : "עבה"}</span>
                </Toggle>
              ))}
            </div>
          </>
        )}

        <Section title="מיקום" hint="אפשר גם לגרור בנגן">
          <div className="grid w-28 grid-cols-3 gap-1">
            {POSITIONS.map(([x, y]) => (
              <button key={`${x}${y}`} onClick={() => set({ x, y })} aria-label="מיקום"
                className={cn("h-6 rounded border", Math.abs(o.x - x) < 0.05 && Math.abs(o.y - y) < 0.05
                  ? "border-violet-500 bg-violet-600" : "border-zinc-700 hover:bg-zinc-800")} />
            ))}
          </div>
          <label className="mt-2 block text-xs text-zinc-400">
            סיבוב: {o.rotate}°
            <input type="range" min={-30} max={30} value={o.rotate} onChange={(e) => set({ rotate: +e.target.value })}
              className="mt-1 w-full accent-violet-500" />
          </label>
        </Section>

        <Section title="זמן">
          <div className="grid grid-cols-2 gap-3">
            <NumField label="מתחיל (שנ׳)" value={o.start} onChange={(v) => set({ start: Math.max(0, Math.min(v, o.end - 0.2)) })} />
            <NumField label="נגמר (שנ׳)" value={o.end} onChange={(v) => set({ end: Math.max(v, o.start + 0.2) })} />
          </div>
        </Section>
      </div>
    </>
  );
}

function Chips<T extends string>({ value, options, onChange }: { value: T; options: Record<T, string>; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(Object.keys(options) as T[]).map((k) => (
        <button key={k} onClick={() => onChange(k)}
          className={cn("rounded-full border px-2.5 py-1 text-xs transition",
            k === value ? "border-violet-500 bg-violet-500/15 text-violet-100" : "border-zinc-700 text-zinc-400 hover:border-zinc-500")}>
          {options[k]}
        </button>
      ))}
    </div>
  );
}

function Swatches({ value, options, onChange }: { value: string | null; options: (string | null)[]; onChange: (c: string | null) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((c) => (
        <button key={c ?? "none"} onClick={() => onChange(c)} aria-label={c ?? "בלי"}
          className={cn("size-7 rounded-full border-2", value === c ? "border-violet-400" : "border-zinc-700")}
          style={{ background: c ?? "repeating-linear-gradient(45deg,#27272a 0 4px,#3f3f46 4px 8px)" }} />
      ))}
    </div>
  );
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={cn("flex-1 rounded-md border py-1.5 text-xs", on ? "border-violet-500 bg-violet-500/15" : "border-zinc-700 text-zinc-400")}>
      {children}
    </button>
  );
}

export function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="text-xs text-zinc-400">{label}</span>
      <input type="number" step={0.1} value={+value.toFixed(2)} dir="ltr" onChange={(e) => onChange(+e.target.value)}
        className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm tabular-nums focus:border-violet-500 focus:outline-none" />
    </label>
  );
}
