import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCloudConfig } from "@/lib/ai/fal-config";
import { buildVideoInput } from "@/lib/ai/fal-output";
import { submitJob } from "@/lib/ai/fal-server";
import { styleById } from "@/lib/ai/styles";
import { JOB_COLUMNS, reconcileJob, type JobRow } from "@/lib/ai/variant-jobs";
import { MEDIA_BUCKET, supabaseEnabled } from "@/lib/supabase/env";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const CreateBody = z.object({
  projectId: z.string().uuid(),
  variantId: z.string().min(1).max(64),
  params: z.object({
    prompt: z.string().max(500),
    style: z.string().max(40),
    strength: z.number().min(0).max(1),
    seed: z.number().int(),
  }),
  source: z.union([z.object({ storagePath: z.string().min(1) }), z.object({ url: z.string().min(1) })]),
});

/** יוצר עבודת וריאציה: שומר שורה ב-variant_jobs ושולח לתור של fal */
export async function POST(request: NextRequest) {
  const cloud = getCloudConfig();
  if (!supabaseEnabled || !cloud.video) {
    return NextResponse.json({ error: "עבודות בענן דורשות Supabase ו-FAL_VIDEO_MODEL" }, { status: 501 });
  }
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const parsed = CreateBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });
  const { projectId, variantId, params, source } = parsed.data;

  // כתובת שהמודל יכול לקרוא. קבצים ב-Storage נחתמים כאן, בשרת, ורק מהתיקייה של המשתמש
  let videoUrl: string;
  if ("storagePath" in source) {
    if (!source.storagePath.startsWith(`${user.id}/`)) {
      return NextResponse.json({ error: "אין גישה לקובץ" }, { status: 403 });
    }
    const { data, error } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(source.storagePath, 24 * 60 * 60);
    if (error || !data) return NextResponse.json({ error: "הקובץ לא נמצא" }, { status: 404 });
    videoUrl = data.signedUrl;
  } else {
    const base = process.env.APP_URL || request.nextUrl.origin;
    const url = new URL(source.url, base);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return NextResponse.json({ error: "כתובת מקור לא תקינה" }, { status: 400 });
    }
    videoUrl = url.toString();
  }

  const input = buildVideoInput(videoUrl, params, styleById(params.style).promptHint, cloud.videoExtraInput);
  const { data: job, error } = await supabase
    .from("variant_jobs")
    .insert({ project_id: projectId, variant_id: variantId, model: cloud.video, input })
    .select(JOB_COLUMNS)
    .single();
  if (error || !job) return NextResponse.json({ error: error?.message ?? "יצירת העבודה נכשלה" }, { status: 400 });

  try {
    const submitted = await submitJob(cloud.video, input);
    const { data } = await supabase
      .from("variant_jobs")
      .update({ request_id: submitted.request_id, status_url: submitted.status_url, response_url: submitted.response_url })
      .eq("id", job.id)
      .select(JOB_COLUMNS)
      .single();
    return NextResponse.json(await toClient(supabase, (data ?? job) as JobRow));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await supabase.from("variant_jobs").update({ status: "failed", error: message }).eq("id", job.id);
    return NextResponse.json({ ...(await toClient(supabase, job as JobRow)), status: "failed", error: message });
  }
}

/** סטטוס של עבודות. עבודות שעדיין רצות מתעדכנות מול fal כחלק מהבקשה */
export async function GET(request: NextRequest) {
  if (!supabaseEnabled) return NextResponse.json({ error: "Supabase לא מוגדר" }, { status: 501 });
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const ids = (request.nextUrl.searchParams.get("ids") ?? "").split(",").filter(Boolean).slice(0, 50);
  if (ids.length === 0) return NextResponse.json([]);
  const { data, error } = await supabase.from("variant_jobs").select(JOB_COLUMNS).in("id", ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const jobs = await Promise.all((data as JobRow[]).map((j) => reconcileJob(supabase, j)));
  return NextResponse.json(await Promise.all(jobs.map((j) => toClient(supabase, j))));
}

type Supabase = Awaited<ReturnType<typeof getUser>>["supabase"];

async function toClient(supabase: Supabase, job: JobRow) {
  let resultUrl: string | null = null;
  if (job.result_path) {
    const { data } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(job.result_path, 6 * 60 * 60);
    resultUrl = data?.signedUrl ?? null;
  }
  return {
    jobId: job.id,
    variantId: job.variant_id,
    status: job.status,
    error: job.error,
    startedAt: job.started_at,
    resultPath: job.result_path,
    resultUrl,
  };
}

export type VariantJobDTO = Awaited<ReturnType<typeof toClient>>;
