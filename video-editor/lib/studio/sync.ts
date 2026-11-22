"use client";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { MEDIA_BUCKET } from "@/lib/supabase/env";
import type { Draft } from "./config";

/**
 * סנכרון מהעורך לסטודיו: כשמייצאים בעורך פרויקט שנפתח מטיוטה בסטודיו, הסרטון הערוך עולה לאחסון
 * ונכנס לטיוטה כגרסה "ערוך בעורך" שנבחרת. כך הדשבורד, הלוח ו"מה עולה היום" מציגים תמיד את הגרסה האחרונה.
 * פרויקט שלא קשור לסטודיו: לא קורה כלום.
 */
export async function syncExportToStudio(projectId: string, video: Blob, cover: Blob | null, seconds: number): Promise<boolean> {
  const db = getSupabaseBrowser();
  const { data: drafts } = await db.from("studio_drafts").select("*").eq("project_id", projectId).limit(1);
  const draft = drafts?.[0] as Draft | undefined;
  if (!draft) return false;
  const { data: { user } } = await db.auth.getUser();
  if (!user) return false;
  const stamp = Date.now();
  const base = `${user.id}/${projectId}/studio-${stamp}`;
  const up = await db.storage.from(MEDIA_BUCKET).upload(`${base}.mp4`, video, { contentType: "video/mp4" });
  if (up.error) throw new Error(up.error.message);
  let coverPath: string | undefined;
  if (cover) {
    const c = await db.storage.from(MEDIA_BUCKET).upload(`${base}.jpg`, cover, { contentType: "image/jpeg" });
    if (!c.error) coverPath = `${base}.jpg`;
  }
  const edited = { path: `${base}.mp4`, ...(coverPath ? { cover: coverPath } : {}), seconds: Math.round(seconds * 10) / 10 };
  const variants = [...(draft.data.variants ?? []).filter((v) => v.id !== "E"), { id: "E", label: "ערוך בעורך", video: edited }];
  const { error } = await db.from("studio_drafts").update({ data: { ...draft.data, video: edited, variants, chosen_variant: "E" } }).eq("id", draft.id);
  if (error) throw new Error(error.message);
  return true;
}
