"use client";
import { useEffect, useState } from "react";
import { Check, Loader2, Plus, X } from "lucide-react";
import { beginGesture, useEditor } from "@/stores/editor-store";
import { CLIP_STYLES } from "@/lib/editor/clip-styles";
import { fontFamily, ensureExtraFonts } from "@/lib/editor/fonts";
import { activeStyle, allStyles, applyStyleNow, deleteMyStyle, saveCurrentAsStyle, setActiveStyle, type EditStyle } from "@/lib/editor/style-library";
import { cn } from "@/lib/utils";

/**
 * ספריית הסגנונות: בוחרים סגנון (לעריכה האוטומטית הבאה, ואפשר גם להחיל על הסרטון
 * עכשיו), ושומרים את הסגנון של הסרטון הנוכחי כסגנון משלי.
 */
export function StylePicker({ applyButton = false }: { applyButton?: boolean }) {
  const [styles, setStyles] = useState<EditStyle[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [naming, setNaming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const hasEdit = useEditor((s) => s.timeline.clips.length > 0);
  const refresh = () => { setStyles(allStyles()); setActive(activeStyle()?.id ?? null); };
  useEffect(() => { refresh(); void ensureExtraFonts().catch(() => undefined); }, []);

  const pick = (id: string) => {
    const next = active === id ? null : id;
    setActiveStyle(next); setActive(next); setMsg(null);
  };
  async function applyNow() {
    const st = styles.find((x) => x.id === active);
    if (!st) return;
    setBusy(true);
    const end = beginGesture();
    try { setMsg(await applyStyleNow(st)); } finally { end(); setBusy(false); }
  }
  const save = () => {
    const st = saveCurrentAsStyle(naming ?? "");
    setNaming(null); refresh(); setMsg(`נשמר בספרייה שלך: "${st.name}"`);
  };

  return (
    <div className="space-y-2">
      <div data-hscroll className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 md:flex-wrap md:overflow-visible">
        {styles.map((st) => <StyleCard key={st.id} style={st} on={active === st.id} onPick={() => pick(st.id)}
          onDelete={st.builtin ? undefined : () => { deleteMyStyle(st.id); refresh(); }} />)}
        {hasEdit && naming === null && (
          <button onClick={() => setNaming("")} className="flex w-[5.5rem] flex-none flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-zinc-600 p-2 text-center text-[11px] text-zinc-400 hover:border-violet-400">
            <Plus className="size-5" />לשמור את הסגנון של הסרטון הזה
          </button>
        )}
      </div>
      {naming !== null && (
        <div className="flex gap-2">
          <input autoFocus value={naming} onChange={(e) => setNaming(e.target.value)} placeholder="שם לסגנון (למשל: המותג שלי)" dir="auto"
            onKeyDown={(e) => { if (e.key === "Enter") save(); }}
            className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-base focus:border-violet-400 focus:outline-none md:text-sm" />
          <button onClick={save} className="rounded-lg bg-violet-600 px-3 text-sm font-medium">שמירה</button>
          <button onClick={() => setNaming(null)} aria-label="ביטול" className="px-1 text-zinc-400"><X className="size-4" /></button>
        </div>
      )}
      <p className="text-[11px] text-zinc-500">
        {active ? "הגרסה הראשונה בעריכה האוטומטית תהיה בסגנון הזה. לחיצה נוספת מבטלת." : "בלי בחירה: העורך בוחר סגנון לפי התוכן."}
      </p>
      {applyButton && active && hasEdit && (
        <button onClick={applyNow} disabled={busy} className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-l from-violet-600 to-fuchsia-600 py-2 text-sm font-semibold disabled:opacity-50">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} להחיל על הסרטון עכשיו
        </button>
      )}
      {msg && <p className="text-xs text-emerald-300">✓ {msg}</p>}
    </div>
  );
}

/** כרטיס עם תצוגה מקדימה קטנה: הגוון, הגופן וצבע ההדגשה של הסגנון */
function StyleCard({ style, on, onPick, onDelete }: { style: EditStyle; on: boolean; onPick: () => void; onDelete?: () => void }) {
  const filter = CLIP_STYLES.find((c) => c.id === style.color)?.look(0.8).filter;
  return (
    <div className={cn("relative w-[5.5rem] flex-none rounded-xl border p-1 transition", on ? "border-violet-400 bg-violet-500/15 ring-2 ring-violet-400" : "border-zinc-700 hover:border-zinc-500")}>
      <button onClick={onPick} className="block w-full text-center">
        <span className="relative block aspect-[3/4] overflow-hidden rounded-lg"
          style={{ background: "linear-gradient(160deg,#f59e0b 0%,#ec4899 45%,#3b82f6 100%)", filter: filter && filter !== "none" ? filter : undefined }}>
          <span className="absolute inset-x-1 bottom-2 rounded px-0.5 text-[15px] font-black leading-tight"
            style={{ fontFamily: fontFamily(style.font), color: style.textColor ?? "#fff", textShadow: "0 1px 3px rgba(0,0,0,.8)" }}>
            ככה <span style={{ color: style.accent === "#ffffff" ? undefined : style.accent }}>עורכים</span>
          </span>
          {style.punchZoom && <span className="absolute top-1 start-1 rounded bg-black/50 px-1 text-[9px] text-white">זום</span>}
        </span>
        <span className="mt-1 block truncate text-[11px] font-medium">{style.emoji} {style.name}</span>
      </button>
      {on && <span className="absolute -top-1.5 -end-1.5 grid size-5 place-items-center rounded-full bg-violet-500 text-[11px]">✓</span>}
      {onDelete && (
        <button onClick={onDelete} aria-label={`מחיקת הסגנון ${style.name}`} className="absolute -top-1.5 -start-1.5 grid size-5 place-items-center rounded-full bg-zinc-800 text-zinc-300 hover:bg-red-600">
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}
