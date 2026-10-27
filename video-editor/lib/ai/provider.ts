import type { Clip, Look, MediaAsset, VariantParams } from "@/lib/editor/types";
import { styleById } from "./styles";

export interface GenerateRequest {
  variantId: string;
  source: MediaAsset;
  clip: Clip;
  params: VariantParams;
  /** נקרא כשהשרת יצר עבודה, כדי לשמור את המזהה שלה על הוריאציה */
  onJob?: (jobId: string) => void;
}

export interface GenerateResult {
  assetId: string;
  look: Look;
  /** נכס חדש שהספק יצר (וידאו מהענן). העורך מוסיף אותו לספרייה */
  asset?: MediaAsset;
}

/**
 * ממשק אחיד לכל ספק עיבוד. העורך מדבר רק עם הממשק הזה, כך שמעבר מדמו לענן
 * (fal / Replicate / Runway דרך ה-API שלנו) הוא החלפת מימוש אחת.
 */
export interface VariantProvider {
  id: string;
  label: string;
  generate(
    req: GenerateRequest,
    onProgress: (progress: number) => void,
    signal?: AbortSignal,
  ): Promise<GenerateResult>;
  /** ממשיך לעקוב אחרי עבודה שכבר רצה בשרת (למשל אחרי רענון הדף) */
  resume?(jobId: string, variantName: string, onProgress: (progress: number) => void): Promise<GenerateResult>;
}

/** ספק דמו: מדמה תור, התקדמות וזמן עיבוד, ומחזיר look על אותו קובץ */
export const mockProvider: VariantProvider = {
  id: "mock",
  label: "דמו (מקומי)",
  generate({ source, params }, onProgress, signal) {
    const queueMs = 400 + Math.random() * 900;
    const totalMs = 2500 + Math.random() * 3500;

    return new Promise((resolve, reject) => {
      const startedAt = Date.now() + queueMs;
      const timer = setInterval(() => {
        if (signal?.aborted) {
          clearInterval(timer);
          reject(new DOMException("aborted", "AbortError"));
          return;
        }
        const elapsed = Date.now() - startedAt;
        if (elapsed < 0) return;
        const p = Math.min(1, elapsed / totalMs);
        onProgress(Math.round(p * 100));
        if (p >= 1) {
          clearInterval(timer);
          resolve({
            assetId: source.id,
            look: styleById(params.style).mockLook(params.strength, params.seed),
          });
        }
      }, 150);
    });
  },
};
