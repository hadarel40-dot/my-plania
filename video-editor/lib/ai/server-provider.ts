"use client";
import { NEUTRAL_LOOK } from "@/lib/editor/types";
import { probeVideo } from "@/lib/media/import";
import type { VariantJobDTO } from "@/app/api/variants/route";
import type { GenerateResult, VariantProvider } from "./provider";
import { styleById } from "./styles";

const POLL_MS = 3000;

/**
 * וריאציות כעבודות שרת: הדפדפן רק מבקש ובודק סטטוס. העבודה עצמה נשמרת ב-variant_jobs
 * ורצה ב-fal, כך שסגירת הדף לא עוצרת אותה. בפתיחה הבאה ממשיכים מאותה נקודה (resume).
 */
export function createServerJobsProvider(projectId: string): VariantProvider {
  async function poll(jobId: string, name: string, onProgress: (p: number) => void, signal?: AbortSignal): Promise<GenerateResult> {
    for (;;) {
      if (signal?.aborted) throw new DOMException("aborted", "AbortError");
      const res = await fetch(`/api/variants?ids=${jobId}`, { cache: "no-store" });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `HTTP ${res.status}`);
      const [job] = (await res.json()) as VariantJobDTO[];
      if (!job) throw new Error("העבודה לא נמצאה");

      if (job.status === "failed") throw new Error(job.error ?? "העיבוד נכשל");
      if (job.status === "succeeded" && job.resultUrl) {
        const asset = await probeVideo(job.resultUrl, {
          name,
          origin: "ai_variant",
          storagePath: job.resultPath ?? undefined,
        });
        return { assetId: asset.id, look: NEUTRAL_LOOK, asset };
      }
      if (job.status === "running" && job.startedAt) {
        // fal לא מדווח אחוזים; מעריכים לפי זמן ומתקרבים ל-95% עד שמסתיים
        const elapsed = (Date.now() - new Date(job.startedAt).getTime()) / 1000;
        onProgress(Math.min(95, Math.max(1, Math.round(95 * (1 - Math.exp(-elapsed / 60))))));
      }
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
  }

  return {
    id: "server",
    label: "עבודות שרת (fal)",
    async generate({ variantId, source, params, onJob }, onProgress, signal) {
      const body = {
        projectId,
        variantId,
        params,
        source: source.storagePath ? { storagePath: source.storagePath } : { url: source.remoteUrl ?? source.url },
      };
      if (!source.storagePath && (source.url.startsWith("blob:") || source.url.startsWith("data:"))) {
        throw new Error("הקובץ עדיין לא הועלה לענן");
      }
      const res = await fetch("/api/variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });
      const job = (await res.json().catch(() => null)) as (VariantJobDTO & { error?: string }) | null;
      if (!res.ok || !job?.jobId) throw new Error(job?.error ?? `HTTP ${res.status}`);
      onJob?.(job.jobId);
      if (job.status === "failed") throw new Error(job.error ?? "שליחת העבודה נכשלה");
      return poll(job.jobId, `${source.name} · ${styleById(params.style).label}`, onProgress, signal);
    },
    resume: (jobId, name, onProgress) => poll(jobId, name, onProgress),
  };
}
