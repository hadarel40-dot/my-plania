/** שולף כתובת וידאו מתשובה של מודל. כל מודל מחזיר מבנה קצת אחר */
export function extractVideoUrl(data: unknown): string | null {
  const d = data as Record<string, any>;
  return d?.video?.url ?? d?.video_url ?? d?.output?.url ?? d?.videos?.[0]?.url ?? null;
}

/** בונה את הקלט למודל הווידאו. משותף לדפדפן (מצב מקומי) ולשרת */
export function buildVideoInput(
  videoUrl: string,
  params: { prompt: string; strength: number; seed: number },
  styleHint: string,
  extra: Record<string, unknown>,
) {
  const prompt = [params.prompt, styleHint].filter(Boolean).join(", ");
  return { video_url: videoUrl, prompt, strength: params.strength, seed: params.seed, ...extra };
}
