"use client";
import dynamic from "next/dynamic";
import { localBackend } from "@/lib/backend/local";

// העורך כולו רץ בדפדפן (נגן, מדיה מקומית, מזהים אקראיים), ולכן אין לו SSR
const Editor = dynamic(() => import("./editor").then((m) => m.Editor), {
  ssr: false,
  loading: () => <div className="grid h-screen place-items-center text-sm text-zinc-500">טוען עורך…</div>,
});

/** מצב מקומי (בלי Supabase): פרויקט אחד שנשמר בדפדפן */
export function LocalEditor() {
  return <Editor backend={localBackend} />;
}
