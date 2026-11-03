"use client";
import { useEditor } from "@/stores/editor-store";
import { importFile } from "@/lib/media/import";
import type { MusicTrack } from "./openverse";

export const musicFileUrl = (id: string) => `/api/music/file?id=${encodeURIComponent(id)}`;

export async function searchLibrary(query: string): Promise<MusicTrack[]> {
  const res = await fetch(`/api/music/search?q=${encodeURIComponent(query)}`);
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) throw new Error(data?.error ?? "החיפוש נכשל");
  return data.tracks as MusicTrack[];
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
