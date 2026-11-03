"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Play, Plus, Search, Square } from "lucide-react";
import { useEditor } from "@/stores/editor-store";
import { importFile } from "@/lib/media/import";
import type { MusicTrack } from "@/lib/music/openverse";
import { IconButton } from "./ui";
import { cn } from "@/lib/utils";

/** מצבי רוח בעברית, ומה מחפשים בפועל במאגר (שעובד באנגלית) */
const MOODS: { label: string; query: string }[] = [
  { label: "שמח", query: "happy upbeat" },
  { label: "רגוע", query: "chill lofi" },
  { label: "אנרגטי", query: "energetic electronic" },
  { label: "השראה", query: "inspiring" },
  { label: "פופ", query: "pop" },
  { label: "היפ הופ", query: "hip hop beat" },
  { label: "רומנטי", query: "romantic piano" },
  { label: "דרמטי", query: "cinematic epic" },
  { label: "אקוסטי", query: "acoustic guitar" },
];

const fileUrl = (id: string) => `/api/music/file?id=${encodeURIComponent(id)}`;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * ספריית מוזיקה חינמית: חיפוש לפי מצב רוח, האזנה, והוספה לסרטון. השיר נשמר
 * בפרויקט (כמו קובץ שהועלה), כך שהוא נשאר גם אם הקישור המקורי ייעלם.
 */
export function MusicLibrary() {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const [tracks, setTracks] = useState<MusicTrack[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => audioRef.current?.pause(), []);

  async function search(q: string, label: string) {
    if (!q.trim()) return;
    setActive(label);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/music/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTracks(data.tracks);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "החיפוש נכשל");
      setTracks(null);
    } finally {
      setLoading(false);
    }
  }

  function preview(t: MusicTrack) {
    audioRef.current?.pause();
    if (playing === t.id) { setPlaying(null); return; }
    // השמעה ישר מהמקור: מהיר, ולא עובר דרך השרת שלנו
    const el = new Audio(t.audio);
    audioRef.current = el;
    el.onended = () => setPlaying(null);
    el.onerror = () => {
      // אם המקור לא מנגן, מנסים דרך השרת שלנו
      if (el.src !== new URL(fileUrl(t.id), location.href).href) { el.src = fileUrl(t.id); el.play().catch(() => setPlaying(null)); return; }
      setPlaying(null);
      setError("לא הצלחתי להשמיע את השיר הזה");
    };
    el.play().catch(() => setPlaying(null));
    setPlaying(t.id);
  }

  async function add(t: MusicTrack) {
    setAdding(t.id);
    setError(null);
    try {
      // קודם ישירות מהמקור; אם הוא חוסם הורדה מאתר אחר (CORS), דרך השרת שלנו
      const res = await fetch(t.audio).then((r) => (r.ok ? r : Promise.reject(r))).catch(() => fetch(fileUrl(t.id)));
      if (!res.ok) throw new Error("השיר לא זמין כרגע");
      const name = `${t.title}${t.artist ? ` - ${t.artist}` : ""}.mp3`.replace(/[\\/:*?"<>|]+/g, " ");
      const asset = await importFile(new File([await res.blob()], name, { type: "audio/mpeg" }));
      const { addAsset, addAudioClip } = useEditor.getState();
      addAsset({ ...asset, name, credit: t.needsCredit ? t.credit : undefined });
      // מוזיקת רקע מתחילה מתחילת הסרטון (בעוצמה נמוכה ודהייה, כמו כל שיר ארוך)
      addAudioClip(asset.id, 0);
      setAdded((s) => new Set(s).add(t.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "ההוספה נכשלה");
    } finally {
      setAdding(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {MOODS.map((m) => (
          <button key={m.label} onClick={() => search(m.query, m.label)}
            className={cn("rounded-full border px-3 py-1 text-xs",
              active === m.label ? "border-violet-500 bg-violet-500/15 text-white" : "border-zinc-700 text-zinc-300 hover:border-zinc-500")}>
            {m.label}
          </button>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); search(query, query); }} className="flex gap-1.5">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="חיפוש חופשי (באנגלית, למשל summer)"
          className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-sm focus:border-violet-500 focus:outline-none" />
        <IconButton label="חיפוש" onClick={() => search(query, query)}><Search className="size-4" /></IconButton>
      </form>

      {loading && <p className="flex items-center gap-2 text-xs text-zinc-400"><Loader2 className="size-3.5 animate-spin" /> מחפש…</p>}
      {error && <p className="text-xs text-red-300">{error}</p>}
      {tracks?.length === 0 && !loading && <p className="text-xs text-zinc-500">לא נמצאו שירים. אפשר לנסות מילה אחרת.</p>}

      <div className="space-y-1.5">
        {tracks?.map((t) => (
          <div key={t.id} className="flex items-center gap-2 rounded-lg bg-zinc-950 p-2 text-sm">
            <IconButton label={playing === t.id ? "עצור" : "השמע"} onClick={() => preview(t)}>
              {playing === t.id ? <Square className="size-3.5" /> : <Play className="size-3.5" />}
            </IconButton>
            <div className="min-w-0 flex-1">
              <p className="truncate" dir="auto">{t.title}</p>
              <p className="truncate text-[11px] text-zinc-500" dir="auto">{t.artist} · {mmss(t.duration)}</p>
            </div>
            {added.has(t.id) ? (
              <span className="p-1.5 text-emerald-400"><Check className="size-4" /></span>
            ) : (
              <IconButton label="הוסף לסרטון" onClick={() => add(t)}>
                {adding === t.id ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              </IconButton>
            )}
          </div>
        ))}
      </div>
      {tracks && tracks.length > 0 && (
        <p className="text-[11px] leading-relaxed text-zinc-500">
          כל השירים כאן מותרים לשימוש בסרטונים, גם לעסק. בחלק מהם צריך לתת קרדיט ליוצר בתיאור הפוסט; העורך יראה לכם מה לכתוב.
        </p>
      )}
    </div>
  );
}
