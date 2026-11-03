import type { MediaAsset } from "@/lib/editor/types";
import { uid } from "@/lib/editor/timeline-utils";
import type { MusicMood } from "./moods";

/**
 * מוזיקה מובנית: קטעים מקוריים שנוצרו בקוד (scripts/make-music.py) ומוגשים מהאתר
 * עצמו. אין עליהם זכויות יוצרים, הם תמיד זמינים, והקצב שלהם ידוע במדויק.
 */
export interface BuiltinTrack { id: string; title: string; mood: MusicMood; bpm: number; duration: number }

export const BUILTIN_TRACKS: BuiltinTrack[] = [
  { id: "chill-lofi", title: "לואו-פיי רגוע", mood: "chill", bpm: 80, duration: 42 },
  { id: "happy-upbeat", title: "קליל ושמח", mood: "happy", bpm: 118, duration: 37 },
  { id: "energetic-dance", title: "אנרגטי לריקוד", mood: "energetic", bpm: 128, duration: 37 },
  { id: "pop-groove", title: "גרוב פופ", mood: "pop", bpm: 105, duration: 41 },
  { id: "cinematic-epic", title: "קולנועי ודרמטי", mood: "cinematic", bpm: 90, duration: 37 },
  { id: "romantic-piano", title: "פסנתר רומנטי", mood: "romantic", bpm: 72, duration: 40 },
];

/** לכל מצב רוח, השיר המובנה הקרוב ביותר */
const FALLBACK: Record<MusicMood, string> = {
  chill: "chill-lofi", happy: "happy-upbeat", energetic: "energetic-dance", pop: "pop-groove",
  hiphop: "chill-lofi", inspiring: "cinematic-epic", cinematic: "cinematic-epic", romantic: "romantic-piano", acoustic: "romantic-piano",
};

export const builtinForMood = (mood: MusicMood) => BUILTIN_TRACKS.find((t) => t.id === FALLBACK[mood])!;

/** קובץ במאגר הפרויקט שמפנה לשיר המובנה (בלי העלאה: הקובץ כבר באתר) */
export function builtinAsset(t: BuiltinTrack): MediaAsset {
  const url = `/music/${t.id}.mp3`;
  return {
    id: uid("asset"), name: `${t.title} (מובנה)`, url, remoteUrl: url, thumbnailUrl: null,
    duration: t.duration, width: 0, height: 0, origin: "upload", kind: "audio", bpm: t.bpm,
  };
}
