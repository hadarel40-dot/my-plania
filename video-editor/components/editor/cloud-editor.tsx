"use client";
import { useMemo } from "react";
import dynamic from "next/dynamic";
import { createCloudBackend } from "@/lib/backend/cloud";

const Editor = dynamic(() => import("./editor").then((m) => m.Editor), {
  ssr: false,
  loading: () => <div className="grid h-screen place-items-center text-sm text-zinc-500">טוען עורך…</div>,
});

/** מצב ענן: הפרויקט והקבצים נשמרים ב-Supabase */
export function CloudEditor({ projectId, userId, email }: { projectId: string; userId: string; email: string }) {
  const backend = useMemo(() => createCloudBackend(projectId, userId), [projectId, userId]);
  const account = useMemo(() => ({ email }), [email]);
  return <Editor key={projectId} backend={backend} account={account} />;
}
