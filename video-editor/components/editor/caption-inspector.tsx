"use client";
import { useEffect, useState } from "react";
import { ListChecks, Type } from "lucide-react";
import { rememberStyle } from "@/lib/editor/my-style";
import { beginGesture, useEditor } from "@/stores/editor-store";
import type { Caption, CaptionPreset, CaptionStyle } from "@/lib/editor/types";
import { afterPaint, cn } from "@/lib/utils";
import { FONTS, ensureExtraFonts, fontFamily } from "@/lib/editor/fonts";
import { CAPTION_COLORS, CAPTION_TEMPLATES, TEMPLATE_GROUPS, type CaptionTemplate } from "@/lib/editor/caption-templates";
import { rechunk, replaceEverywhere, singleWordChange } from "@/lib/editor/caption-edit";
import { openCaptionsSheet } from "./captions-sheet";

const PRESETS: { id: CaptionPreset; label: string }[] = [
  { id: "word-pop", label: "מילה קופצת" },
  { id: "highlight-box", label: "מילה במסגרת" },
  { id: "one-word", label: "מילה אחת" },
  { id: "karaoke", label: "קריוקי" },
  { id: "bold-pop", label: "בולט" },
  { id: "minimal", label: "מינימלי" },
  { id: "neon", label: "ניאון" },
  { id: "underline", label: "קו תחתון" },
  { id: "bubble", label: "בועות" },
  { id: "typewriter", label: "הקלדה" },
  { id: "slide", label: "החלקה" },
  { id: "outline", label: "חלול" },
  { id: "shadow3d", label: "תלת-ממד" },
  { id: "gradient", label: "גרדיאנט" },
];

/** כל שינוי סגנון חל על כל הכתוביות יחד, ונזכר ב"הסגנון שלי" */
export function styleAllCaptions(patch: Partial<CaptionStyle>) {
  afterPaint(() => styleAllNow(patch));
}

function styleAllNow(patch: Partial<CaptionStyle>) {
  const end = beginGesture();
  useEditor.getState().styleAllCaptions(patch);
  end();
  const now = useEditor.getState().timeline.captionStyle;
  if (now) rememberStyle({ captionPreset: now.preset, captionFont: now.font, accent: now.accent });
}

export function CaptionInspector({ caption }: { caption: Caption }) {
  const { updateCaption } = useEditor.getState();
  const set = (patch: Partial<Caption>) => updateCaption(caption.id, patch);
  const [before, setBefore] = useState(caption.text);
  const [fix, setFix] = useState<{ from: string; to: string } | null>(null);
  const [done, setDone] = useState<string | null>(null);

  return (
    <aside className="flex min-h-0 w-full flex-1 flex-col border-zinc-800 bg-zinc-900/40 md:w-[22rem] md:flex-none md:shrink-0 md:border-s">
      <header className="flex items-center justify-between gap-2 border-b border-zinc-800 px-4 py-3 text-sm font-semibold">
        <span className="flex items-center gap-2"><Type className="size-4 text-sky-400" /> כתובית</span>
        <button onClick={openCaptionsSheet} className="flex items-center gap-1 rounded-full bg-violet-600 px-3 py-1 text-xs font-medium">
          <ListChecks className="size-3.5" /> כל הכתוביות
        </button>
      </header>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 text-sm">
        <label className="block">
          <span className="text-xs text-zinc-400">הטקסט (לתיקון מילה שלא נקלטה נכון)</span>
          <textarea value={caption.text} rows={2} dir="auto"
            onFocus={() => { setBefore(caption.text); setDone(null); }}
            onChange={(e) => set({ text: e.target.value })}
            onBlur={(e) => setFix(singleWordChange(before, e.target.value))}
            className="mt-1 w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 p-2 text-base focus:border-blue-500 focus:outline-none" />
        </label>
        {fix && fix.from && fix.to && (
          <div className="flex items-center gap-2 rounded-md bg-violet-500/15 p-2 text-xs">
            <span className="flex-1">להחליף &quot;{fix.from}&quot; ב&quot;{fix.to}&quot; בכל הכתוביות ולזכור לפעם הבאה?</span>
            <button onClick={() => { const n = replaceEverywhere(fix.from, fix.to, true); setFix(null); setDone(`תוקן ב-${n} כתוביות`); }}
              className="rounded bg-violet-600 px-2 py-1 font-medium">כן</button>
            <button onClick={() => setFix(null)} className="text-zinc-400">לא</button>
          </div>
        )}
        {done && <p className="text-xs text-emerald-300">✓ {done}</p>}

        <p className="text-[11px] text-zinc-500">מכאן והלאה: השינויים חלים על כל הכתוביות יחד.</p>
        <CaptionTemplates current={caption} />
        <CaptionColors color={caption.color} accent={caption.accent} />

        <Group title="אנימציה">
          <div className="grid grid-cols-3 gap-1.5">
            {PRESETS.map((p) => (
              <Chip key={p.id} on={caption.preset === p.id} onClick={() => styleAllCaptions({ preset: p.id })}>{p.label}</Chip>
            ))}
          </div>
        </Group>

        <FontGrid current={caption.font ?? "heebo"} sample={caption.text.split(" ").slice(0, 2).join(" ")} />

        <Group title={`גודל · ${Math.round((caption.size ?? 1) * 100)}%`}>
          <input type="range" min={0.6} max={1.6} step={0.05} value={caption.size ?? 1} dir="ltr"
            onChange={(e) => useEditor.getState().styleAllCaptions({ size: +e.target.value })}
            onPointerUp={() => styleAllCaptions({})} className="w-full accent-violet-500" />
        </Group>


        <div className="grid grid-cols-2 gap-3">
          <Group title="קו מתאר">
            <div className="grid grid-cols-2 gap-1">
              {([["none", "בלי"], ["thin", "דק"], [undefined, "רגיל"], ["bold", "עבה"]] as const).map(([v, l]) => (
                <Chip key={l} on={caption.outline === v} onClick={() => styleAllCaptions({ outline: v })}>{l}</Chip>
              ))}
            </div>
          </Group>
          <Group title="רקע">
            <div className="grid grid-cols-1 gap-1">
              {([["none", "בלי"], ["dark", "בועה כהה"], ["light", "בועה לבנה"]] as const).map(([v, l]) => (
                <Chip key={v} on={(caption.box ?? "none") === v} onClick={() => styleAllCaptions({ box: v })}>{l}</Chip>
              ))}
            </div>
          </Group>
        </div>

        <CaptionPosition y={caption.y} />
        <Group title="מיקום מדויק">
          <input type="range" min={0.12} max={0.9} step={0.01} value={caption.y ?? 0.78} dir="ltr"
            onChange={(e) => useEditor.getState().styleAllCaptions({ y: +e.target.value })}
            onPointerUp={() => styleAllCaptions({})} className="w-full accent-violet-500" />
          <div className="mt-1 flex justify-between text-[10px] text-zinc-500"><span>למעלה</span><span>למטה</span></div>
        </Group>

        <Group title="מילים בכל כתובית">
          <div className="grid grid-cols-4 gap-1.5">
            {[1, 2, 3, 4].map((n) => (
              <Chip key={n} on={false} onClick={() => { const end = beginGesture(); rechunk(n); end(); }}>{n}</Chip>
            ))}
          </div>
        </Group>

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

/** גופנים: רגילים, ומתחתם המיוחדים (בועות, גליץ', גרפיטי...) */
function FontGrid({ current, sample }: { current: string; sample: string }) {
  useEffect(() => { void ensureExtraFonts(); }, []);
  const groups = [
    { title: "גופן", list: FONTS.filter((f) => !f.extra) },
    { title: "✨ גופנים מיוחדים", list: FONTS.filter((f) => f.extra) },
  ];
  return (
    <>
      {groups.map((g) => (
        <Group key={g.title} title={g.title}>
          <div className="grid grid-cols-3 gap-1.5">
            {g.list.map((f) => (
              <button key={f.id} onClick={() => styleAllCaptions({ font: f.id })}
                className={cn("rounded-md border px-1 py-1.5 text-center",
                  current === f.id ? "border-blue-500 bg-blue-500/15" : "border-zinc-700 hover:border-zinc-500")}>
                <span className="block truncate text-lg leading-tight" style={{ fontFamily: fontFamily(f.id) }}>{sample || f.sample}</span>
                <span className="block text-[10px] text-zinc-500">{f.label}</span>
              </button>
            ))}
          </div>
        </Group>
      ))}
    </>
  );
}

/** מיקום הכתוביות בלחיצה (אפשר גם לגרור אותן על הנגן כשהסרטון עוצר) */
export function CaptionPosition({ y }: { y?: number }) {
  const spots = [{ y: 0.2, label: "⬆️ למעלה" }, { y: 0.5, label: "⏺ באמצע" }, { y: 0.72, label: "⬇️ למטה" }];
  return (
    <Group title="מיקום (אפשר גם לגרור על הסרטון)">
      <div className="grid grid-cols-3 gap-1.5">
        {spots.map((p) => (
          <Chip key={p.y} on={Math.abs((y ?? 0.78) - p.y) < 0.07} onClick={() => styleAllCaptions({ y: p.y })}>{p.label}</Chip>
        ))}
      </div>
    </Group>
  );
}

/** צבע הטקסט וצבע ההדגשה (המילה שנאמרת), לכל הכתוביות */
export function CaptionColors({ color, accent }: { color?: string; accent?: string }) {
  return (
    <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
      <Group title="🎨 צבע הטקסט">
        <Swatches value={color ?? "#ffffff"} onPick={(c) => styleAllCaptions({ color: c })} />
      </Group>
      <Group title="✨ צבע ההדגשה (המילה שנאמרת)">
        <Swatches value={accent ?? "#facc15"} onPick={(c) => styleAllCaptions({ accent: c })} />
      </Group>
    </div>
  );
}

/** סגנונות מוכנים עם תצוגה מקדימה קטנה של כל אחד */
export function CaptionTemplates({ current }: { current?: Pick<Caption, "preset" | "font" | "accent" | "box" | "color" | "outline"> | null }) {
  const [group, setGroup] = useState<CaptionTemplate["group"]>("popular");
  // הגופנים המיוחדים נטענים כשפותחים את הסגנונות (בשביל התצוגה המקדימה)
  useEffect(() => { void ensureExtraFonts(); }, []);
  const isOn = (t: CaptionTemplate) => !!current && current.preset === t.style.preset && current.font === t.style.font && current.accent === t.style.accent && (current.box ?? "none") === (t.style.box ?? "none");
  return (
    <Group title="סגנון מוכן">
      <div className="mb-2 flex gap-1 overflow-x-auto pb-1">
        {TEMPLATE_GROUPS.map((g) => (
          <button key={g.id} onClick={() => setGroup(g.id)}
            className={cn("shrink-0 rounded-full border px-3 py-1 text-xs", group === g.id ? "border-violet-500 bg-violet-500/15 text-white" : "border-zinc-700 text-zinc-400")}>
            {g.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {CAPTION_TEMPLATES.filter((t) => t.group === group).map((t) => (
          <button key={t.id} onClick={() => styleAllCaptions({ ...t.style })}
            className={cn("flex h-16 flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border bg-gradient-to-b from-zinc-700 to-zinc-900 px-1",
              isOn(t) ? "border-violet-500 ring-1 ring-violet-500" : "border-zinc-700 hover:border-zinc-500")}>
            <TemplateSample t={t} />
            <span className="text-[10px] text-zinc-300">{t.label}</span>
          </button>
        ))}
      </div>
    </Group>
  );
}

/** תצוגה מקדימה קטנה של סגנון: שתי מילים, השנייה "נאמרת" (מודגשת) */
function TemplateSample({ t }: { t: CaptionTemplate }) {
  const s = t.style;
  const a = s.accent;
  const plain = s.color ?? (s.box === "light" ? "#111" : "#fff");
  const stroke = s.outline === "none" || s.preset === "minimal" ? undefined : s.outline === "bold" ? "1.4px black" : s.outline === "thin" ? "0.5px black" : "0.9px black";
  const word = (text: string, hi: boolean): React.CSSProperties => {
    switch (s.preset) {
      case "highlight-box": return hi ? { color: "#111", background: a, borderRadius: 4, padding: "0 3px" } : { color: plain };
      case "bubble": return { color: hi ? "#111" : "#fff", background: hi ? a : "rgba(15,12,28,.8)", borderRadius: 999, padding: "0 5px" };
      case "neon": return { color: "#fff", textShadow: hi ? `0 0 4px ${a}, 0 0 9px ${a}` : "0 0 4px rgba(255,255,255,.5)" };
      case "underline": return { color: plain, borderBottom: hi ? `3px solid ${a}` : undefined };
      case "outline": return { color: hi ? a : "transparent", WebkitTextStroke: `1px ${hi ? a : "#fff"}` };
      case "shadow3d": return { color: plain, textShadow: `1px 1px 0 ${a}, 2px 2px 0 ${a}, 3px 3px 0 ${a}` };
      case "gradient": return { backgroundImage: `linear-gradient(90deg, ${a}, #fff)`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" };
      default: return { color: hi ? a : plain };
    }
  };
  const box: React.CSSProperties = s.box === "dark" ? { background: "rgba(0,0,0,.65)", padding: "1px 6px", borderRadius: 8 } : s.box === "light" ? { background: "rgba(255,255,255,.93)", padding: "1px 6px", borderRadius: 8 } : {};
  const outlineStroke = ["outline", "neon", "bubble", "gradient", "shadow3d"].includes(s.preset) ? undefined : stroke;
  return (
    <span dir="rtl" className="max-w-full truncate text-[15px] font-black leading-tight"
      style={{ fontFamily: fontFamily(s.font), WebkitTextStroke: outlineStroke, paintOrder: "stroke fill", ...box }}>
      {s.preset === "one-word" || s.preset === "typewriter"
        ? <span style={word("וואו", true)}>{s.preset === "typewriter" ? "ככה עו|" : "וואו"}</span>
        : <><span style={word("ככה", false)}>ככה</span> <span style={word("עושים", true)}>עושים</span></>}
    </span>
  );
}

function Swatches({ value, onPick }: { value: string; onPick: (c: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {CAPTION_COLORS.map((c) => (
        <button key={c} onClick={() => onPick(c)} aria-label={`צבע ${c}`}
          className={cn("size-8 rounded-full border-2", value.toLowerCase() === c ? "border-violet-400 ring-2 ring-violet-400/40" : "border-zinc-600")}
          style={{ background: c }} />
      ))}
      <label className="relative grid size-8 cursor-pointer place-items-center rounded-full border-2 border-dashed border-zinc-500 text-xs text-zinc-400" title="צבע אחר">
        +
        <input type="color" value={value} onChange={(e) => onPick(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
      </label>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><span className="mb-1.5 block text-xs text-zinc-400">{title}</span>{children}</div>;
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={cn("rounded-md border py-2 text-xs", on ? "border-blue-500 bg-blue-500/15" : "border-zinc-700 hover:border-zinc-500")}>
      {children}
    </button>
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
