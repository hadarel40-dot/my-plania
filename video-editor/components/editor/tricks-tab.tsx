"use client";
import { useState } from "react";
import { useEditor } from "@/stores/editor-store";
import { usePlayback } from "@/stores/playback-store";
import { layoutClips } from "@/lib/editor/timeline-utils";
import type { Clip, LayerLayout } from "@/lib/editor/types";
import { cn } from "@/lib/utils";
import { RemoveBgPanel } from "./remove-bg-panel";

/** הקליפ שעליו עובדים: הקליפ הנבחר, ואם אין, הקליפ שבנקודת הניגון */
function useTargetClip(): { clip: Clip | null; selected: boolean; index: number } {
  const selectedId = useEditor((s) => (s.selection?.kind === "clip" ? s.selection.id : null));
  const atPlayhead = usePlayback((s) => {
    const laid = layoutClips(useEditor.getState().timeline.clips);
    return (laid.find((l) => s.currentTime >= l.start && s.currentTime < l.end) ?? laid.at(-1))?.clip.id ?? null;
  });
  const clips = useEditor((s) => s.timeline.clips);
  const id = selectedId ?? atPlayhead;
  const index = clips.findIndex((c) => c.id === id);
  return { clip: index >= 0 ? clips[index] : null, selected: !!selectedId, index };
}

function Target({ clip, selected, index }: { clip: Clip; selected: boolean; index: number }) {
  const name = useEditor((s) => s.assets[clip.sourceAssetId]?.name ?? "קליפ");
  const thumb = useEditor((s) => s.assets[clip.sourceAssetId]?.thumbnailUrl);
  return (
    <div className="flex items-center gap-2 rounded-lg bg-zinc-800/60 p-2 text-xs">
      {thumb ? <img src={thumb} alt="" className="size-9 rounded object-cover" /> : <span className="size-9 rounded bg-zinc-700" />}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-zinc-100">קליפ {index + 1} · {name}</span>
        <span className="block text-zinc-400">{selected ? "הקליפ שנבחר בציר הזמן" : "הקליפ שבנקודת הניגון. לבחירת קליפ אחר: הזיזו את הנגן או לחצו עליו בציר הזמן"}</span>
      </span>
    </div>
  );
}

function Empty() {
  return <p className="p-6 text-center text-sm text-zinc-500">מעלים סרטון בלשונית &quot;מדיה&quot;, ואז אפשר להשתמש בזה.</p>;
}

/** לשונית "הסרת רקע" */
export function BgTab() {
  const { clip, selected, index } = useTargetClip();
  if (!clip) return <Empty />;
  return (
    <div className="space-y-3 p-4">
      <div>
        <h3 className="text-base font-semibold">✂️ הסרת רקע</h3>
        <p className="text-xs text-zinc-400">האדם נשאר, והרקע מתחלף לרקע שבוחרים. עובד הכי טוב כשרואים את האדם ברור ומואר.</p>
      </div>
      <Target clip={clip} selected={selected} index={index} />
      <BgFor clip={clip} />
    </div>
  );
}

function BgFor({ clip }: { clip: Clip }) {
  return (
    <RemoveBgPanel sourceId={clip.sourceAssetId} currentId={clip.assetId}
      // הרקע מתחלף בכל הקליפים מאותו סרטון (למשל אחרי חיתוך שתיקות)
      onApply={(newId) => useEditor.setState((s) => ({ timeline: { ...s.timeline, clips: s.timeline.clips.map((c) => (c.sourceAssetId === clip.sourceAssetId ? { ...c, assetId: newId, activeVariantId: null } : c)) } }))}
      onRestore={() => useEditor.setState((s) => ({ timeline: { ...s.timeline, clips: s.timeline.clips.map((c) => (c.sourceAssetId === clip.sourceAssetId ? { ...c, assetId: c.sourceAssetId } : c)) } }))} />
  );
}

/** לשונית "טריקים" */
export function TricksTab() {
  const { clip, selected, index } = useTargetClip();
  if (!clip) return <Empty />;
  return (
    <div className="space-y-3 p-4">
      <h3 className="text-base font-semibold">✨ טריקים</h3>
      <Target clip={clip} selected={selected} index={index} />
      <TricksPanel clip={clip} withBg={false} />
    </div>
  );
}

const WITH_OTHER: { layout: LayerLayout; icon: string; title: string; text: string }[] = [
  { layout: "clone-right", icon: "👯", title: "תאומים", text: "האדם מופיע פעמיים באותו מקום" },
  { layout: "split-right", icon: "◧", title: "מסך מפוצל", text: "שני סרטונים זה לצד זה" },
  { layout: "split-bottom", icon: "⬒", title: "מפוצל למעלה ולמטה", text: "אחד מעל השני" },
  { layout: "pip", icon: "🪟", title: "חלון בתוך חלון", text: "סרטון קטן בפינה" },
];

/** כל הטריקים לקליפ: כרטיסים גדולים וברורים */
export function TricksPanel({ clip, withBg = true }: { clip: Clip; withBg?: boolean }) {
  const assets = useEditor((s) => s.assets);
  const others = Object.values(assets).filter((a) => a.kind !== "audio" && a.origin !== "ai_variant" && a.id !== clip.assetId && a.id !== clip.sourceAssetId);
  const [other, setOther] = useState<string>("");
  const [done, setDone] = useState<string | null>(null);
  const otherId = others.some((a) => a.id === other) ? other : others[0]?.id ?? "";
  const flash = (msg: string) => { setDone(msg); setTimeout(() => setDone(null), 2500); };
  const clipRange = () => layoutClips(useEditor.getState().timeline.clips).find((l) => l.clip.id === clip.id);
  const addWith = (layout: LayerLayout) => {
    const hit = clipRange();
    if (!hit || !otherId) return;
    useEditor.getState().addLayer(otherId, hit.start, layout, hit.end - hit.start);
    flash("נוסף! אפשר לגרור ולשנות בנגן");
  };
  const freeze = () => {
    const hit = clipRange();
    const t = usePlayback.getState().currentTime;
    // אם הנגן לא על הקליפ הזה: מקפיאים באמצע שלו
    const at = hit && (t < hit.start || t >= hit.end) ? (hit.start + hit.end) / 2 : t;
    useEditor.getState().freezeFrame(at);
    flash("התמונה תיעצר לשנייה וחצי בנקודה הזו");
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Card icon="⧉" title="שכפול הקליפ" text="עותק נוסף מיד אחריו" onClick={() => { useEditor.getState().duplicateClip(clip.id); flash("הקליפ שוכפל"); }} />
        <Card icon="❄️" title="הקפאת תמונה" text="עצירה של 1.5 שנ׳ בנקודת הניגון" onClick={freeze} />
      </div>
      {done && <p className="rounded-md bg-emerald-500/15 px-2 py-1.5 text-xs text-emerald-300">✓ {done}</p>}

      <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
        <p className="text-sm font-medium">עם סרטון נוסף, מעל הקליפ הזה</p>
        {others.length ? (
          <>
            <select value={otherId} onChange={(e) => setOther(e.target.value)} className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm">
              {others.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              {WITH_OTHER.map((w) => <Card key={w.layout} icon={w.icon} title={w.title} text={w.text} onClick={() => addWith(w.layout)} />)}
            </div>
            <p className="text-[11px] leading-relaxed text-zinc-500">תאומים: מצלמים פעמיים מאותה נקודה (על חצובה), פעם בצד אחד ופעם בצד השני, והאדם מופיע פעמיים.</p>
          </>
        ) : (
          <p className="text-xs text-zinc-400">צריך להעלות עוד סרטון (בלשונית &quot;מדיה&quot;) בשביל תאומים, מסך מפוצל או חלון.</p>
        )}
      </div>
      {withBg && <BgFor clip={clip} />}
    </div>
  );
}

function Card({ icon, title, text, onClick }: { icon: string; title: string; text: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={cn("flex flex-col items-start gap-0.5 rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-start transition active:scale-[0.97] hover:border-violet-400")}>
      <span className="text-2xl leading-none">{icon}</span>
      <span className="text-sm font-semibold text-zinc-100">{title}</span>
      <span className="text-[11px] leading-snug text-zinc-400">{text}</span>
    </button>
  );
}
