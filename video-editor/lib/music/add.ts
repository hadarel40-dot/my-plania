"use client";
import { useEditor } from "@/stores/editor-store";
import { importFile } from "@/lib/media/import";
import type { MusicTrack } from "./openverse";
import { builtinAsset, type BuiltinTrack } from "./builtin";

export const musicFileUrl = (id: string) => `/api/music/file?id=${encodeURIComponent(id)}`;

/** אחרי כישלון, הספרייה לא נוסתה שוב 10 דקות: כדי שעריכה אוטומטית לא תחכה לה כל פעם */
let libraryDownUntil = 0;

export async function searchLibrary(query: string, { timeoutMs = 6000, force = false } = {}): Promise<MusicTrack[]> {
  if (!force && Date.now() < libraryDownUntil) throw new Error("ספריית המוזיקה לא זמינה כרגע");
  try {
    const res = await fetch(`/api/music/search?q=${encodeURIComponent(query)}`, { signal: AbortSignal.timeout(timeoutMs) });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) throw new Error(data?.error ?? "החיפוש נכשל");
    if (!(data.tracks as MusicTrack[]).length) throw new Error("לא נמצאו שירים");
    return data.tracks as MusicTrack[];
  } catch (e) {
    libraryDownUntil = Date.now() + 10 * 60_000;
    throw e;
  }
}

/**
 * מוריד שיר מהספרייה, שומר אותו בפרויקט (כמו קובץ שהועלה) ומוסיף אותו למסלול
 * הסאונד מתחילת הסרטון. מחזיר את מזהה הקובץ בפרויקט.
 * select: false משאיר את המסך הנוכחי (בעריכה אוטומטית לא קופצים לעורך הסאונד).
 */
export async function addLibraryTrack(t: MusicTrack, { select = true }: { select?: boolean } = {}): Promise<string> {
  // קודם ישירות מהמקור; אם הוא חוסם הורדה מאתר אחר (CORS), דרך השרת שלנו
  const res = await fetch(t.audio).then((r) => (r.ok ? r : Promise.reject(r))).catch(() => fetch(musicFileUrl(t.id)));
  if (!res.ok) throw new Error("השיר לא זמין כרגע");
  const name = `${t.title}${t.artist ? ` - ${t.artist}` : ""}.mp3`.replace(/[\\/:*?"<>|]+/g, " ");
  const asset = await importFile(new File([await res.blob()], name, { type: "audio/mpeg" }));
  const { addAsset, addAudioClip } = useEditor.getState();
  addAsset({ ...asset, name, credit: t.needsCredit ? t.credit : undefined });
  addAudioClip(asset.id, 0, { select });
  return asset.id;
}

/** מוסיף שיר מובנה (מהאתר עצמו, בלי הורדה והעלאה) למסלול הסאונד מתחילת הסרטון */
/** מסמן את השיר האחרון שנוסף כבחירה של העריכה האוטומטית (כדי שעריכה חוזרת תחליף אותו) */
export function markLastAudioAuto() {
  useEditor.setState((s) => {
    const audio = [...s.timeline.audio];
    const last = audio.at(-1);
    if (last) audio[audio.length - 1] = { ...last, auto: true };
    return { timeline: { ...s.timeline, audio } };
  });
}

export function addBuiltinTrack(t: BuiltinTrack, { select = true }: { select?: boolean } = {}): string {
  const asset = builtinAsset(t);
  const { addAsset, addAudioClip } = useEditor.getState();
  addAsset(asset);
  addAudioClip(asset.id, 0, { select });
  return asset.id;
}
