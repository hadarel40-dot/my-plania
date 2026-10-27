"use client";
import * as tus from "tus-js-client";
import type { SavedProject } from "@/lib/editor/types";
import { toStorable } from "@/lib/persistence";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { MEDIA_BUCKET, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import type { ProjectBackend } from "./types";

/** כתובות צפייה חתומות. נוצרות מחדש בכל טעינה של הפרויקט */
const SIGNED_URL_TTL = 6 * 60 * 60;

/**
 * שמירה ב-Supabase: הפרויקט בטבלת projects, הקבצים ב-Storage תחת media/<user>/<project>/.
 * ההעלאה היא resumable (tus), כך שקובץ גדול ממשיך מאותה נקודה אחרי ניתוק.
 */
export function createCloudBackend(projectId: string, userId: string): ProjectBackend {
  const supabase = getSupabaseBrowser();
  const media = () => supabase.storage.from(MEDIA_BUCKET);

  return {
    kind: "cloud",
    projectId,

    async load() {
      const { data, error } = await supabase.from("projects").select("title, doc").eq("id", projectId).single();
      if (error || !data) throw new Error(error?.message ?? "הפרויקט לא נמצא");
      const project = { ...(data.doc as Omit<SavedProject, "title">), title: data.title } as SavedProject;

      const paths = Object.values(project.assets).flatMap((a) => (a.storagePath ? [a.storagePath] : []));
      if (paths.length) {
        const { data: signed } = await media().createSignedUrls(paths, SIGNED_URL_TTL);
        const byPath = new Map(signed?.map((s) => [s.path, s.signedUrl]) ?? []);
        for (const a of Object.values(project.assets)) {
          if (a.storagePath) a.url = byPath.get(a.storagePath) ?? "";
        }
      }
      for (const a of Object.values(project.assets)) {
        if (!a.url && a.remoteUrl) a.url = a.remoteUrl;
      }
      project.assets = Object.fromEntries(Object.entries(project.assets).filter(([, a]) => a.url));
      return project;
    },

    async save(project) {
      const { title, ...doc } = toStorable(project);
      const { error } = await supabase.from("projects").update({ title, doc }).eq("id", projectId);
      return !error;
    },

    async storeFile(assetId, file, onProgress) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("פג תוקף ההתחברות. התחבר מחדש");
      const safeName = file.name.replace(/[^\w.-]+/g, "_").slice(-80);
      const objectName = `${userId}/${projectId}/${assetId}-${safeName}`;

      await new Promise<void>((resolve, reject) => {
        const upload = new tus.Upload(file, {
          endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
          retryDelays: [0, 3000, 5000, 10000, 20000],
          headers: {
            authorization: `Bearer ${session.access_token}`,
            apikey: SUPABASE_ANON_KEY,
            "x-upsert": "true",
          },
          uploadDataDuringCreation: true,
          removeFingerprintOnSuccess: true,
          metadata: {
            bucketName: MEDIA_BUCKET,
            objectName,
            contentType: file.type || "video/mp4",
            cacheControl: "3600",
          },
          chunkSize: 6 * 1024 * 1024, // Supabase דורש בדיוק 6MB לחלק
          onError: reject,
          onProgress: (sent, total) => onProgress?.(Math.round((sent / total) * 100)),
          onSuccess: () => resolve(),
        });
        // אם אותו קובץ התחיל לעלות קודם ונקטע, ממשיכים מאיפה שנעצר
        upload.findPreviousUploads().then((previous) => {
          if (previous.length) upload.resumeFromPreviousUpload(previous[0]);
          upload.start();
        });
      });
      return { storagePath: objectName };
    },

    async remoteUrlFor(asset) {
      if (!asset.storagePath) return null;
      const { data } = await media().createSignedUrl(asset.storagePath, 60 * 60);
      return data?.signedUrl ?? null;
    },
  };
}
