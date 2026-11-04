"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { beginGesture, useEditor } from "@/stores/editor-store";
import { importFile } from "@/lib/media/import";
import type { NewBackground } from "@/lib/video/remove-bg";
import { cn } from "@/lib/utils";

const CHECKER = "repeating-conic-gradient(#9ca3af 0% 25%, #e5e7eb 0% 50%) 50% / 10px 10px";
const CHOICES: { id: string; label: string; bg: NewBackground; swatch: string }[] = [
  { id: "none", label: "בלי רקע", bg: { kind: "none" }, swatch: CHECKER },
  { id: "blur", label: "טשטוש", bg: { kind: "blur" }, swatch: "linear-gradient(135deg,#6b7280,#d1d5db)" },
  { id: "black", label: "שחור", bg: { kind: "color", color: "#0a0a0a" }, swatch: "#0a0a0a" },
  { id: "white", label: "לבן", bg: { kind: "color", color: "#ffffff" }, swatch: "#ffffff" },
  { id: "pink", label: "ורוד", bg: { kind: "color", color: "#f9a8d4" }, swatch: "#f9a8d4" },
  { id: "green", label: "ירוק מסך", bg: { kind: "color", color: "#00b140" }, swatch: "#00b140" },
  { id: "sunset", label: "שקיעה", bg: { kind: "gradient", from: "#f97316", to: "#db2777" }, swatch: "linear-gradient(135deg,#f97316,#db2777)" },
  { id: "ocean", label: "אוקיינוס", bg: { kind: "gradient", from: "#0ea5e9", to: "#6366f1" }, swatch: "linear-gradient(135deg,#0ea5e9,#6366f1)" },
  { id: "lilac", label: "לילך", bg: { kind: "gradient", from: "#c4b5fd", to: "#f0abfc" }, swatch: "linear-gradient(135deg,#c4b5fd,#f0abfc)" },
  { id: "beige", label: "בז׳", bg: { kind: "color", color: "#e7d8c9" }, swatch: "#e7d8c9" },
  { id: "navy", label: "כחול לילה", bg: { kind: "gradient", from: "#0f172a", to: "#1e3a8a" }, swatch: "linear-gradient(135deg,#0f172a,#1e3a8a)" },
];

/**
 * הסרת רקע לסרטון (קליפ או שכבה): בוחרים רקע חדש, העורך מזהה את האדם בכל פריים ומחליף
 * את הרקע. נוצר סרטון חדש שמחליף את המקור בציר הזמן (המקור נשמר, ואפשר לחזור אליו).
 */
export function RemoveBgPanel({ sourceId, currentId, onApply, onRestore }: {
  sourceId: string; currentId: string; onApply: (assetId: string, transparent: boolean, focus: { x: number; y: number } | null) => void; onRestore: () => void;
}) {
  const asset = useEditor((s) => s.assets[sourceId]);
  const [choice, setChoice] = useState("none");
  const [image, setImage] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState("");
  const [best, setBest] = useState(false);
  const changed = currentId !== sourceId;

  async function run() {
    if (!asset) return;
    setError(null); setProgress(0);
    try {
      const { removeBackground } = await import("@/lib/video/remove-bg");
      const bg = choice === "image" && image ? { kind: "image" as const, url: image } : CHOICES.find((c) => c.id === choice)!.bg;
      const res = await removeBackground(asset, bg, (p) => setProgress(Math.round(p * 90)), setStage, best ? "best" : "auto");
      setProgress(92);
      const done = await importFile(res.file, (p) => setProgress(90 + Math.round(p / 10)));
      const final = res.alphaPacked
        // הקובץ כפול ברוחבו (צבע + מסכה): המידות האמיתיות הן של החצי
        ? { ...done, name: res.file.name, alphaPacked: true, width: Math.round(done.width / 2) || res.width, height: done.height || res.height, thumbnailUrl: res.thumbnail ?? done.thumbnailUrl }
        : { ...done, name: res.file.name };
      useEditor.getState().addAsset(final);
      const end = beginGesture();
      onApply(final.id, res.alphaPacked, res.focus);
      end();
    } catch (e) {
      setError(e instanceof Error ? e.message : "הסרת הרקע נכשלה");
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
      <p className="text-xs font-medium text-zinc-200">✂️ הסרת רקע: בוחרים מה יהיה במקום הרקע</p>
      {choice === "none" && <p className="text-[11px] leading-relaxed text-violet-200">בלי רקע: האדם לבד, שקוף. אחר כך בוחרים מה יופיע מאחוריו (סרטון או תמונה מהגלריה), ואפשר להזיז ולהגדיל אותו.</p>}
      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
        {CHOICES.map((c) => (
          <button key={c.id} onClick={() => setChoice(c.id)} disabled={progress !== null}
            className={cn("flex flex-col items-center gap-1 rounded-lg border p-1 text-[10px]", choice === c.id ? "border-violet-400 text-white" : "border-zinc-700 text-zinc-400")}>
            <span className="size-7 rounded-md border border-white/10" style={{ background: c.swatch }} />{c.label}
          </button>
        ))}
        <label className={cn("flex cursor-pointer flex-col items-center gap-1 rounded-lg border p-1 text-[10px]", choice === "image" ? "border-violet-400 text-white" : "border-zinc-700 text-zinc-400")}>
          <span className="grid size-7 place-items-center rounded-md border border-dashed border-zinc-500 bg-cover bg-center" style={image ? { backgroundImage: `url(${image})` } : undefined}>{image ? "" : "🖼️"}</span>
          תמונה
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) { setImage(URL.createObjectURL(f)); setChoice("image"); }
          }} />
        </label>
      </div>
      <label className="flex items-start gap-2 text-xs text-zinc-300">
        <input type="checkbox" checked={best} onChange={(e) => setBest(e.target.checked)} disabled={progress !== null} className="mt-0.5 accent-violet-500" />
        <span>הכי מדויק (שיער וקצוות עדינים). לוקח יותר זמן בטלפונים ישנים
          <span className="block text-[11px] text-zinc-500">בלי הסימון העורך בוחר לבד לפי מהירות הטלפון</span></span>
      </label>
      {progress !== null ? (
        <div className="space-y-1">
          <p className="flex items-center gap-1.5 text-xs text-zinc-300"><Loader2 className="size-3.5 animate-spin" /> {stage || "מסיר את הרקע…"} {progress}%</p>
          <div className="h-1.5 overflow-hidden rounded bg-zinc-800"><div className="h-full bg-gradient-to-l from-violet-500 to-fuchsia-500 transition-[width]" style={{ width: `${progress}%` }} /></div>
          <p className="text-[11px] text-zinc-500">כל פריים עובר זיהוי וחידוד קצוות, זה לוקח בערך פעם-פעמיים את אורך הסרטון. כדאי להשאיר את המסך פתוח. בפעם הראשונה יורד גם מודל הזיהוי (כ-16MB, פעם אחת).</p>
        </div>
      ) : (
        <div className="flex gap-2">
          <button onClick={run} disabled={choice === "image" && !image}
            className="flex-1 rounded-lg bg-gradient-to-l from-violet-600 to-fuchsia-600 py-2.5 text-sm font-semibold disabled:opacity-50">
            {changed ? "החלפת הרקע שוב" : "הסרת רקע"}
          </button>
          {changed && (
            <button onClick={() => { const end = beginGesture(); onRestore(); end(); }} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300">
              חזרה לרקע המקורי
            </button>
          )}
        </div>
      )}
      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  );
}
