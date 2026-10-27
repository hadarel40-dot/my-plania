import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MEDIA_BUCKET } from "@/lib/supabase/env";
import { extractVideoUrl } from "./fal-output";
import { getResult, getStatus } from "./fal-server";

export interface JobRow {
  id: string;
  owner_id: string;
  project_id: string;
  variant_id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  status_url: string | null;
  response_url: string | null;
  result_path: string | null;
  error: string | null;
  started_at: string | null;
  created_at: string;
}

export const JOB_COLUMNS =
  "id, owner_id, project_id, variant_id, status, status_url, response_url, result_path, error, started_at, created_at";

/** אחרי זמן כזה בלי תוצאה, העבודה מסומנת כנכשלה כדי שלא תיתקע לנצח */
const MAX_JOB_AGE_MS = 2 * 60 * 60 * 1000;

/**
 * מעדכן עבודה אחת מול fal: סטטוס, ובסיום מעתיק את הסרטון ל-Storage של המשתמש
 * (הקישורים של fal לא נועדו לאחסון קבוע).
 */
export async function reconcileJob(supabase: SupabaseClient, job: JobRow): Promise<JobRow> {
  if (job.status === "succeeded" || job.status === "failed" || !job.status_url || !job.response_url) return job;

  const update = async (patch: Partial<JobRow>) => {
    const { data } = await supabase.from("variant_jobs").update(patch).eq("id", job.id).select(JOB_COLUMNS).single();
    return (data as JobRow | null) ?? { ...job, ...patch };
  };

  try {
    if (Date.now() - new Date(job.created_at).getTime() > MAX_JOB_AGE_MS) {
      return await update({ status: "failed", error: "העבודה לא הסתיימה בזמן" });
    }
    const status = await getStatus(job.status_url);
    if (status === "IN_QUEUE") return job;
    if (status === "IN_PROGRESS") {
      return job.status === "running" ? job : await update({ status: "running", started_at: new Date().toISOString() });
    }

    const videoUrl = extractVideoUrl(await getResult(job.response_url));
    if (!videoUrl) return await update({ status: "failed", error: "המודל לא החזיר וידאו" });

    const video = await fetch(videoUrl);
    if (!video.ok) throw new Error(`הורדת התוצאה נכשלה (${video.status})`);
    const path = `${job.owner_id}/${job.project_id}/variants/${job.variant_id}.mp4`;
    const { error } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(path, await video.blob(), { contentType: "video/mp4", upsert: true });
    if (error) throw new Error(`שמירת התוצאה נכשלה: ${error.message}`);

    return await update({ status: "succeeded", result_path: path, error: null });
  } catch (e) {
    return await update({ status: "failed", error: e instanceof Error ? e.message : String(e) });
  }
}
