/** מה זמין בענן. נקרא רק בשרת; לדפדפן נחשפים שמות המודלים, לא המפתח */
export interface CloudConfig {
  /** מודל video-to-video ליצירת וריאציות, או null אם לא הוגדר */
  video: string | null;
  /** שדות קבועים שנוספים לקלט של מודל הווידאו (JSON ב-FAL_VIDEO_EXTRA_INPUT) */
  videoExtraInput: Record<string, unknown>;
  /** מודל תמלול, או null אם אין מפתח */
  transcribe: string | null;
  transcribeLanguage: string | null;
}

export function getCloudConfig(): CloudConfig {
  const hasKey = !!process.env.FAL_KEY;
  let videoExtraInput: Record<string, unknown> = {};
  try {
    videoExtraInput = JSON.parse(process.env.FAL_VIDEO_EXTRA_INPUT || "{}");
  } catch {
    console.warn("FAL_VIDEO_EXTRA_INPUT אינו JSON תקין, מתעלם");
  }
  return {
    video: hasKey ? process.env.FAL_VIDEO_MODEL || null : null,
    videoExtraInput,
    transcribe: hasKey ? process.env.FAL_TRANSCRIBE_MODEL || "fal-ai/whisper" : null,
    transcribeLanguage: process.env.FAL_TRANSCRIBE_LANGUAGE || "he",
  };
}
