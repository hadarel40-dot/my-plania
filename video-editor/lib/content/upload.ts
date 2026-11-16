"use client";
import * as tus from "tus-js-client";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { CONTENT_BUCKET, type MediaFile } from "./types";

/** מעלה קובץ ל-bucket התוכן (content/<user>/<item>/...), עם המשך אחרי ניתוק */
export async function uploadContentFile(itemId: string, file: File, onProgress?: (pct: number) => void): Promise<MediaFile> {
  const supabase = getSupabaseBrowser();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("פג תוקף ההתחברות. התחברי מחדש");
  if (file.size > 50 * 1024 * 1024) throw new Error("הקובץ גדול מ-50MB. כדאי לייצא מהעורך ב-1080p או לקצר");
  const type: MediaFile["type"] = file.type.startsWith("video/") ? "video" : "image";
  const safeName = file.name.replace(/[^\w.-]+/g, "_").slice(-60);
  const path = `${session.user.id}/${itemId}/${crypto.randomUUID().slice(0, 8)}-${safeName}`;

  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: { authorization: `Bearer ${session.access_token}`, apikey: SUPABASE_ANON_KEY, "x-upsert": "true" },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: { bucketName: CONTENT_BUCKET, objectName: path, contentType: file.type || "video/mp4", cacheControl: "3600" },
      chunkSize: 6 * 1024 * 1024,
      onError: (err) => {
        const status = (err as { originalResponse?: { getStatus(): number } | null }).originalResponse?.getStatus();
        reject(new Error(status === 413 ? "הקובץ גדול מדי (המקסימום 50MB)"
          : status === 415 || status === 400 ? "סוג הקובץ לא נתמך. אפשר MP4, MOV, JPG, PNG או WEBP"
          : "ההעלאה נכשלה. כדאי לבדוק את החיבור ולנסות שוב"));
      },
      onProgress: (sent, total) => onProgress?.(Math.round((sent / total) * 100)),
      onSuccess: () => resolve(),
    });
    upload.findPreviousUploads().then((prev) => {
      if (prev.length) upload.resumeFromPreviousUpload(prev[0]);
      upload.start();
    });
  });
  return { path, type };
}

export async function removeContentFiles(paths: string[]) {
  if (!paths.length) return;
  await getSupabaseBrowser().storage.from(CONTENT_BUCKET).remove(paths);
}
