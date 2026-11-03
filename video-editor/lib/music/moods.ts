/** מצבי הרוח של ספריית המוזיקה (מה מחפשים בפועל) */
export const MUSIC_MOODS = {
  happy: "happy upbeat",
  chill: "chill lofi",
  energetic: "energetic electronic",
  inspiring: "inspiring",
  pop: "pop",
  hiphop: "hip hop beat",
  romantic: "romantic piano",
  cinematic: "cinematic epic",
  acoustic: "acoustic guitar",
} as const;

export type MusicMood = keyof typeof MUSIC_MOODS;
