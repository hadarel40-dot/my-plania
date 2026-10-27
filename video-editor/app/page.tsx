"use client";
import dynamic from "next/dynamic";

// העורך כולו רץ בדפדפן (נגן, מדיה מקומית, מזהים אקראיים), ולכן אין לו SSR
const Editor = dynamic(() => import("@/components/editor/editor").then((m) => m.Editor), {
  ssr: false,
  loading: () => <div className="grid h-screen place-items-center text-sm text-zinc-500">טוען עורך…</div>,
});

export default function Home() {
  return <Editor />;
}
