import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StudioNav } from "@/components/studio/nav";
import { supabaseEnabled } from "@/lib/supabase/env";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "סטודיו תוכן", description: "הדשבורד האישי לתוכן ושיווק" };

/** סטודיו התוכן: אזור נפרד בעיצוב משלו, רק למנהלת */
export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  if (!supabaseEnabled) {
    return <div className="p-8 text-sm">הסטודיו צריך את Supabase (התחברות ושמירה). ראו README.</div>;
  }
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) redirect("/");
  return (
    <div className="studio fixed inset-0 overflow-y-auto bg-[#F4EEE4] text-[#2A2622] [color-scheme:light]">
      {/* React מעלה את הקישור ל-head */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700&family=Frank+Ruhl+Libre:wght@500;700&display=swap" precedence="default" />
      <div className="min-h-full lg:grid lg:grid-cols-[200px_1fr]">
        <aside className="border-b border-[#2A2622]/15 lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-l">
          <div className="flex items-center justify-between px-4 pb-2 pt-4 lg:block lg:px-5 lg:pt-6">
            <p className="s-serif text-xl leading-none text-[#5E1D1D]">סטודיו תוכן</p>
            <p className="hidden text-[11px] text-[#6A6158] lg:mt-1 lg:block">מרעיון עד סרטון מוכן</p>
          </div>
          <StudioNav />
        </aside>
        <main className="mx-auto w-full max-w-[1280px] px-4 py-5 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
