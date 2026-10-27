"use client";
import { NEUTRAL_LOOK } from "@/lib/editor/types";
import { probeVideo } from "@/lib/media/import";
import { useEditor } from "@/stores/editor-store";
import type { CloudConfig } from "./fal-config";
import { ensureRemoteUrl, extractVideoUrl, fal } from "./fal-client";
import { buildVideoInput } from "./fal-output";
import type { VariantProvider } from "./provider";
import { styleById } from "./styles";

/**
 * ספק ענן: מעלה את המקור ל-fal storage, שולח לתור של מודל video-to-video,
 * עוקב אחרי הסטטוס ומחזיר את הסרטון החדש כנכס בספרייה.
 */
export function createFalProvider(cloud: CloudConfig): VariantProvider {
  const model = cloud.video!;
  return {
    id: "fal",
    label: `fal · ${model}`,
    async generate({ source, params }, onProgress, signal) {
      const videoUrl = await ensureRemoteUrl(source, (url) =>
        useEditor.getState().setAssetRemoteUrl(source.id, url));

      const style = styleById(params.style);
      const startedAt = Date.now();

      const { data } = await fal.subscribe(model, {
        input: buildVideoInput(videoUrl, params, style.promptHint, cloud.videoExtraInput),
        pollInterval: 2000,
        abortSignal: signal,
        onQueueUpdate: (status) => {
          if (status.status === "IN_QUEUE") return;
          // fal לא מדווח אחוזים; מעריכים לפי זמן ומתקרבים ל-95% עד שמסתיים
          const elapsed = (Date.now() - startedAt) / 1000;
          onProgress(Math.min(95, Math.round(95 * (1 - Math.exp(-elapsed / 60)))));
        },
      });

      const url = extractVideoUrl(data);
      if (!url) throw new Error("המודל לא החזיר וידאו");
      const asset = await probeVideo(url, {
        name: `${source.name} · ${style.label}`,
        origin: "ai_variant",
        remoteUrl: url,
      });
      return { assetId: asset.id, look: NEUTRAL_LOOK, asset };
    },
  };
}
