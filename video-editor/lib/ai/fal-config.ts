/** מה זמין בענן. נקרא רק בשרת; לדפדפן נחשפים שמות המודלים, לא המפתח */
export interface CloudConfig {
  /** מודל video-to-video ליצירת וריאציות, או null אם לא הוגדר */
  video: string | null;
  /** שדות קבועים שנוספים לקלט של מודל הווידאו (JSON ב-FAL_VIDEO_EXTRA_INPUT) */
  videoExtraInput: Record<string, unknown>;
  /** מודל תמלול, או null אם אין מפתח */
  transcribe: string | null;
  transcribeLanguage: string | null;
  /** עריכה חכמה: יש מוח מחובר בשרת (GEMINI_API_KEY או ANTHROPIC_API_KEY) */
  smartEdit: boolean;
  /** שם המוח להצגה (Gemini / Claude) */
  brain: string | null;
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
    smartEdit: !!(process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY),
    brain: process.env.GEMINI_API_KEY ? "Gemini" : process.env.ANTHROPIC_API_KEY ? "Claude" : null,
  };
}
