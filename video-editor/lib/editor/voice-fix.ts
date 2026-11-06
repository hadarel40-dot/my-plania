"use client";
import { useEditor } from "@/stores/editor-store";
import { importFile } from "@/lib/media/import";
import { errorText, logEvent } from "@/lib/telemetry";

/**
 * ניקוי רעשים וקול פודקאסט לכל הסרטונים שבציר הזמן. כל סרטון מעובד פעם אחת (הקול הנקי
 * נשמר איתו), ואז הקליפים מתנגנים עם הקול הנקי, באותם זמנים בדיוק. אפשר לחזור לקול
 * המקורי בלחיצה (setVoice(false)) בלי לעבד שוב.
 */
export async function cleanVoices(onStatus: (s: string) => void = () => {}): Promise<{ count: number; noiseCutDb: number }> {
  const { timeline, assets } = useEditor.getState();
  const sources = [...new Set(timeline.clips.map((c) => c.sourceAssetId))].map((id) => assets[id]).filter((a) => a && !a.still && a.kind !== "audio");
  if (!sources.length) throw new Error("אין סרטונים לשפר בהם את הקול");
  const { enhanceVoice } = await import("@/lib/audio/voice");
  let count = 0, cut = 0;
  for (const [i, asset] of sources.entries()) {
    if (asset.cleanAudio && useEditor.getState().assets[asset.cleanAudio]) { count++; continue; }
    const label = sources.length > 1 ? ` ${i + 1}/${sources.length}` : "";
    try {
      const { file, stats } = await enhanceVoice(asset, { denoise: true, podcast: true }, (p) => onStatus(`מנקה רעשים ומשפר את הקול${label}… ${Math.round(p * 100)}%`));
      onStatus(`שומר את הקול הנקי${label}…`);
      const done = await importFile(file);
      useEditor.getState().addAsset({ ...done, name: file.name, kind: "audio", internal: true });
      const cur = useEditor.getState().assets[asset.id];
      if (cur) useEditor.getState().addAsset({ ...cur, cleanAudio: done.id });
      logEvent("voice_clean_done", { ...stats, size: file.size });
      cut = Math.max(cut, stats.noiseCutDb);
      count++;
    } catch (e) {
      // סרטון בלי פס קול: פשוט ממשיכים
      logEvent("voice_clean_failed", { error: errorText(e) });
    }
  }
  if (!count) throw new Error("לא היה קול לשפר");
  setVoice(true);
  return { count, noiseCutDb: cut };
}

export function setVoice(clean: boolean) {
  useEditor.setState((s) => ({ timeline: { ...s.timeline, voice: clean ? "clean" : undefined } }));
}

export const hasCleanVoice = () => {
  const { timeline, assets } = useEditor.getState();
  return timeline.clips.some((c) => assets[c.sourceAssetId]?.cleanAudio);
};
