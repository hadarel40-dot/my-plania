"use client";
import { useEffect, useRef, useState } from "react";
import { Music, Palette, Play, Plus, Sparkles, Square, Type, Upload, Volume2, VolumeX } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useEditor } from "@/stores/editor-store";
import { usePlayback } from "@/stores/playback-store";
import { OVERLAY_PRESETS } from "@/lib/editor/overlay-presets";
import { SFX_LIBRARY } from "@/lib/editor/sfx";
import { CLIP_STYLES, detectStyle } from "@/lib/editor/clip-styles";
import { importFile } from "@/lib/media/import";
import { cn } from "@/lib/utils";
import { IconButton, Section } from "./ui";
import { CaptionInspector } from "./caption-inspector";
import { OverlayInspector } from "./overlay-inspector";
import { AudioInspector } from "./audio-inspector";
import { VariantsPanel } from "./variants-panel";

export type Tab = "text" | "sound" | "style" | "ai";

/**
 * הפאנל הצדדי. כשנבחר פריט בציר הזמן (טקסט, כתובית, סאונד) מוצג העורך שלו;
 * אחרת מוצגות הלשוניות להוספת תוכן.
 */
export function SidePanel({ tab: fixedTab, inspect = true }: {
  /** בטלפון: הלשונית נבחרת בסרגל התחתון, ושורת הלשוניות כאן מוסתרת */
  tab?: Tab;
  /** בטלפון עורך הפריט הנבחר מוצג רק במגירת "עריכה" */
  inspect?: boolean;
} = {}) {
  const selection = useEditor((s) => s.selection);
  const select = useEditor((s) => s.select);
  const aiAvailable = useEditor((s) => !!s.cloud?.video);
  const [ownTab, setTab] = useState<Tab>("text");
  const tab = fixedTab ?? ownTab;

  // בחירת קליפ חדש פותחת את לשונית הסגנון (אבל לא נועלת אותה)
  const selectedClipId = selection?.kind === "clip" ? selection.id : null;
  useEffect(() => { if (selectedClipId) setTab((t) => (t === "ai" ? t : "style")); }, [selectedClipId]);

  if (inspect && selection?.kind === "overlay") return <Shell><OverlayInspector id={selection.id} onClose={() => select(null)} /></Shell>;
  if (inspect && selection?.kind === "audio") return <Shell><AudioInspector id={selection.id} onClose={() => select(null)} /></Shell>;
  if (inspect && selection?.kind === "caption") return <CaptionPanel id={selection.id} />;

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "text", label: "טקסט", icon: <Type className="size-4" /> },
    { id: "sound", label: "סאונד", icon: <Music className="size-4" /> },
    { id: "style", label: "סגנון", icon: <Palette className="size-4" /> },
    ...(aiAvailable ? [{ id: "ai" as Tab, label: "AI", icon: <Sparkles className="size-4" /> }] : []),
  ];

  if (tab === "ai" && aiAvailable) {
    return (
      <div className="flex min-h-0 flex-1 flex-col md:flex-none md:shrink-0">
        {!fixedTab && <TabBar tabs={tabs} tab={tab} onTab={setTab} />}
        <VariantsPanel />
      </div>
    );
  }

  return (
    <Shell>
      {!fixedTab && <TabBar tabs={tabs} tab={tab} onTab={setTab} />}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "text" && <TextTab />}
        {tab === "sound" && <SoundTab />}
        {tab === "style" && <StyleTab />}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <aside className="flex min-h-0 w-full flex-1 flex-col border-zinc-800 bg-zinc-900/40 md:w-[22rem] md:flex-none md:shrink-0 md:border-s">{children}</aside>;
}

function TabBar({ tabs, tab, onTab }: { tabs: { id: Tab; label: string; icon: React.ReactNode }[]; tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <div className="flex w-full border-b border-zinc-800 bg-zinc-900/40 md:w-[22rem] md:border-s">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onTab(t.id)}
          className={cn("flex flex-1 items-center justify-center gap-1.5 border-b-2 py-3 text-sm transition",
            t.id === tab ? "border-violet-500 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300")}>
          {t.icon}{t.label}
        </button>
      ))}
    </div>
  );
}

function CaptionPanel({ id }: { id: string }) {
  const caption = useEditor((s) => s.timeline.captions.find((c) => c.id === id) ?? null);
  return caption ? <CaptionInspector caption={caption} /> : null;
}

/** תבניות טקסט ואימוג'י. לחיצה מוסיפה בנקודת הניגון */
function TextTab() {
  const addOverlay = useEditor((s) => s.addOverlay);
  const addCaption = useEditor((s) => s.addCaption);
  const at = () => usePlayback.getState().currentTime;
  const texts = OVERLAY_PRESETS.filter((p) => p.fields.kind === "text");
  const emojis = OVERLAY_PRESETS.filter((p) => p.fields.kind === "emoji");

  return (
    <div className="space-y-5 p-4">
      <Section title="טקסט מונפש" hint="נוסף בנקודת הניגון">
        <div className="grid grid-cols-2 gap-2">
          {texts.map((p) => (
            <button key={p.id} onClick={() => addOverlay(p.id, at())}
              className="group flex h-20 flex-col items-center justify-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950 px-2 transition hover:border-violet-500">
              <span className="max-w-full truncate text-base leading-tight"
                style={{
                  color: p.fields.color, fontWeight: p.fields.weight,
                  background: p.fields.background ?? undefined,
                  padding: p.fields.background ? "1px 8px" : undefined, borderRadius: 6,
                  WebkitTextStroke: p.fields.stroke ? "0.6px black" : undefined,
                }}>
                {p.fields.text}
              </span>
              <span className="text-[11px] text-zinc-500 group-hover:text-zinc-300">{p.label}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="אימוג'י קופצים">
        <div className="grid grid-cols-3 gap-2">
          {emojis.map((p) => (
            <button key={p.id} onClick={() => addOverlay(p.id, at())} title={p.label}
              className="flex h-16 flex-col items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 transition hover:border-violet-500">
              <span className="text-2xl">{p.fields.text}</span>
              <span className="text-[10px] text-zinc-500">{p.label.replace(/\s*\S+$/u, "")}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="כתוביות">
        <button onClick={() => addCaption(at())}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-700 py-2.5 text-sm text-zinc-300 hover:border-violet-500">
          <Plus className="size-4" /> הוספת כתובית
        </button>
      </Section>
    </div>
  );
}

/** ספריית אפקטים + העלאת מוזיקה */
function SoundTab() {
  const addSfx = useEditor((s) => s.addSfx);
  const addAsset = useEditor((s) => s.addAsset);
  const addAudioClip = useEditor((s) => s.addAudioClip);
  const music = useEditor(useShallow((s) => Object.values(s.assets).filter((a) => a.kind === "audio" && a.origin !== "library")));
  const [playing, setPlaying] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const at = () => usePlayback.getState().currentTime;

  function preview(id: string, url: string) {
    audioRef.current?.pause();
    if (playing === id) { setPlaying(null); return; }
    const el = new Audio(url);
    audioRef.current = el;
    el.onended = () => setPlaying(null);
    el.play().catch(() => setPlaying(null));
    setPlaying(id);
  }
  useEffect(() => () => audioRef.current?.pause(), []);

  async function upload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploading(true); setError(null);
    try {
      const asset = await importFile(file);
      addAsset(asset);
      if (asset.kind === "audio") addAudioClip(asset.id, 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ההעלאה נכשלה");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-5 p-4">
      <Section title="מוזיקה">
        <button onClick={() => inputRef.current?.click()} disabled={uploading}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-700 py-2.5 text-sm text-zinc-300 hover:border-violet-500 disabled:opacity-50">
          <Upload className="size-4" /> {uploading ? "מעלה…" : "העלאת מוזיקה (MP3)"}
        </button>
        <input ref={inputRef} type="file" accept="audio/*" hidden onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
        {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
        {music.map((a) => (
          <div key={a.id} className="mt-2 flex items-center gap-2 rounded-lg bg-zinc-950 p-2 text-sm">
            <IconButton label={playing === a.id ? "עצור" : "השמע"} onClick={() => preview(a.id, a.url)}>
              {playing === a.id ? <Square className="size-3.5" /> : <Play className="size-3.5" />}
            </IconButton>
            <span className="flex-1 truncate">{a.name}</span>
            <IconButton label="הוסף בנקודת הניגון" onClick={() => addAudioClip(a.id, at())}><Plus className="size-4" /></IconButton>
          </div>
        ))}
      </Section>

      <Section title="אפקטים" hint="▶ להאזנה, + להוספה">
        <div className="grid grid-cols-2 gap-2">
          {SFX_LIBRARY.map((sfx) => (
            <div key={sfx.id} className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950 p-1.5">
              <IconButton label={playing === sfx.id ? "עצור" : `השמע ${sfx.label}`} onClick={() => preview(sfx.id, `/sfx/${sfx.id}.mp3`)}>
                {playing === sfx.id ? <Square className="size-3.5" /> : <Play className="size-3.5" />}
              </IconButton>
              <span className="flex-1 truncate text-sm">{sfx.emoji} {sfx.label}</span>
              <IconButton label={`הוסף ${sfx.label}`} onClick={() => addSfx(sfx.id, at())}><Plus className="size-4" /></IconButton>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

/** סגנון צבע ועוצמת סאונד לקליפ הנבחר */
function StyleTab() {
  const clip = useEditor((s) =>
    s.selection?.kind === "clip" ? s.timeline.clips.find((c) => c.id === s.selection!.id) ?? null : null);
  const asset = useEditor((s) => (clip ? s.assets[clip.assetId] : null));
  const { setClipLook, setClipVolume } = useEditor.getState();

  if (!clip) {
    return <p className="p-8 text-center text-sm leading-relaxed text-zinc-500">בחרו קליפ בציר הזמן כדי לשנות את הסגנון והסאונד שלו</p>;
  }
  const current = detectStyle(clip.look);
  const strength = current.id === "none" ? 0.7 : current.strength;
  const volume = clip.volume ?? 1;

  return (
    <div className="space-y-5 p-4">
      <Section title="סגנון צבע">
        <div className="grid grid-cols-3 gap-2">
          {CLIP_STYLES.map((style) => (
            <button key={style.id} onClick={() => setClipLook(clip.id, style.look(strength))}
              className={cn("overflow-hidden rounded-lg border text-xs transition",
                current.id === style.id ? "border-violet-500 ring-1 ring-violet-500" : "border-zinc-800 hover:border-zinc-600")}>
              <div className="h-14 bg-zinc-800 bg-cover bg-center"
                style={{ backgroundImage: asset?.thumbnailUrl ? `url(${asset.thumbnailUrl})` : undefined, filter: style.look(0.8).filter }} />
              <div className="py-1">{style.label}</div>
            </button>
          ))}
        </div>
        {current.id !== "none" && current.id !== "custom" && (
          <label className="mt-3 block text-xs text-zinc-400">
            עוצמה: {Math.round(strength * 100)}%
            <input type="range" min={0.05} max={1} step={0.05} value={strength}
              onChange={(e) => setClipLook(clip.id, CLIP_STYLES.find((s) => s.id === current.id)!.look(+e.target.value))}
              className="mt-1 w-full accent-violet-500" />
          </label>
        )}
      </Section>

      <Section title="סאונד מקורי של הקליפ">
        <div className="flex items-center gap-2">
          <IconButton label={volume === 0 ? "בטל השתקה" : "השתק"} onClick={() => setClipVolume(clip.id, volume === 0 ? 1 : 0)}>
            {volume === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </IconButton>
          <input type="range" min={0} max={1} step={0.05} value={volume} aria-label="עוצמת סאונד"
            onChange={(e) => setClipVolume(clip.id, +e.target.value)} className="flex-1 accent-violet-500" />
          <span className="w-10 text-xs tabular-nums text-zinc-400">{Math.round(volume * 100)}%</span>
        </div>
      </Section>
    </div>
  );
}
