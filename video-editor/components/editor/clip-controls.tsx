"use client";
import { useEditor, beginGesture } from "@/stores/editor-store";
import type { Adjust, Clip, ClipEffect, TransitionType } from "@/lib/editor/types";
import { Section } from "./ui";
import { cn } from "@/lib/utils";

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3];

export const TRANSITIONS: { id: TransitionType | "none"; label: string }[] = [
  { id: "none", label: "בלי" },
  { id: "fade", label: "המסה" },
  { id: "slide", label: "החלקה" },
  { id: "zoom", label: "זום" },
  { id: "blur", label: "טשטוש" },
  { id: "flash", label: "הבזק" },
  { id: "punch", label: "פאנץ'" },
  { id: "whip", label: "ווש" },
  { id: "glitch", label: "גליץ'" },
];

const EFFECTS: { id: ClipEffect; label: string }[] = [
  { id: "none", label: "בלי" },
  { id: "zoom-in", label: "זום פנימה" },
  { id: "zoom-out", label: "זום החוצה" },
  { id: "pan-left", label: "תנועה שמאלה" },
  { id: "pan-right", label: "תנועה ימינה" },
  { id: "shake", label: "רעידה" },
  { id: "pulse", label: "פעימה" },
];

const ADJUSTS: { key: keyof Adjust; label: string }[] = [
  { key: "brightness", label: "בהירות" },
  { key: "contrast", label: "ניגודיות" },
  { key: "saturation", label: "רוויה" },
  { key: "warmth", label: "חום" },
];

const NO_ADJUST: Adjust = { brightness: 0, contrast: 0, saturation: 0, warmth: 0 };

/** כמו ב-CapCut: מהירות, מעבר, תנועה, התאמות ומילוי לקליפ הנבחר */
export function ClipControls({ clip, isFirst }: { clip: Clip; isFirst: boolean }) {
  const { updateClip } = useEditor.getState();
  const set = (patch: Parameters<typeof updateClip>[1]) => updateClip(clip.id, patch);
  const speed = clip.speed ?? 1;
  const adjust = clip.adjust ?? NO_ADJUST;
  const transition = clip.transitionIn;

  return (
    <>
      <Section title="מהירות" hint={speed < 1 ? "הילוך איטי" : speed > 1 ? "הילוך מהיר" : undefined}>
        <div className="flex flex-wrap gap-1.5">
          {SPEEDS.map((v) => (
            <Chip key={v} on={Math.abs(speed - v) < 0.01} onClick={() => set({ speed: v })}><span dir="ltr">{v}x</span></Chip>
          ))}
        </div>
      </Section>

      <Section title="מעבר לקליפ הזה" hint={isFirst ? "לקליפ הראשון אין מעבר" : undefined}>
        <div className={cn("flex flex-wrap gap-1.5", isFirst && "pointer-events-none opacity-40")}>
          {TRANSITIONS.map((t) => (
            <Chip key={t.id} on={(transition?.type ?? "none") === t.id}
              onClick={() => set({ transitionIn: t.id === "none" ? undefined : { type: t.id, duration: transition?.duration ?? defaultDuration(t.id) } })}>
              {t.label}
            </Chip>
          ))}
        </div>
        {transition && !isFirst && (
          <label className="mt-2 block text-xs text-zinc-400">
            משך: {transition.duration.toFixed(1)} שנ׳
            <input type="range" min={0.1} max={1.2} step={0.1} value={transition.duration}
              onChange={(e) => set({ transitionIn: { ...transition, duration: +e.target.value } })} className="mt-1 w-full accent-violet-500" />
          </label>
        )}
      </Section>

      <Section title="תנועת מצלמה">
        <div className="flex flex-wrap gap-1.5">
          {EFFECTS.map((f) => (
            <Chip key={f.id} on={(clip.effect ?? "none") === f.id} onClick={() => set({ effect: f.id })}>{f.label}</Chip>
          ))}
        </div>
      </Section>

      <Section title="התאמות">
        {ADJUSTS.map(({ key, label }) => (
          <label key={key} className="mt-1 flex items-center gap-2 text-xs text-zinc-400">
            <span className="w-16 shrink-0">{label}</span>
            <input type="range" min={-1} max={1} step={0.05} value={adjust[key]}
              onPointerDown={() => { const end = beginGesture(); window.addEventListener("pointerup", end, { once: true }); }}
              onChange={(e) => set({ adjust: { ...adjust, [key]: +e.target.value } })} className="flex-1 accent-violet-500" />
            <span className="w-8 text-end tabular-nums" dir="ltr">{Math.round(adjust[key] * 100)}</span>
          </label>
        ))}
        {clip.adjust && (
          <button onClick={() => set({ adjust: undefined })} className="mt-1 text-xs text-zinc-500 underline hover:text-white">איפוס</button>
        )}
      </Section>

      <Section title="כשהסרטון לא ממלא את המסך">
        <div className="flex gap-1.5">
          <Chip on={(clip.fill ?? "crop") === "crop"} onClick={() => set({ fill: "crop" })}>חיתוך למסך מלא</Chip>
          <Chip on={clip.fill === "blur"} onClick={() => set({ fill: "blur" })}>רקע מטושטש</Chip>
        </div>
      </Section>
    </>
  );
}

const defaultDuration = (t: TransitionType | "none") => (t === "flash" || t === "punch" || t === "glitch" ? 0.3 : t === "whip" ? 0.25 : 0.4);

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={cn("rounded-full border px-3 py-1 text-xs", on ? "border-violet-500 bg-violet-500/15 text-white" : "border-zinc-700 text-zinc-300 hover:border-zinc-500")}>
      {children}
    </button>
  );
}
