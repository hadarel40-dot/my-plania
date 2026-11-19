import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { StudioNav, type NavCounts } from "@/components/studio/nav";
import { supabaseEnabled } from "@/lib/supabase/env";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "סטודיו תוכן", description: "הדשבורד האישי לתוכן ושיווק" };

const todayIL = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());

/** סטודיו התוכן: אזור נפרד בעיצוב משלו, רק למנהלת */
export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  if (!supabaseEnabled) return <div className="p-8 text-sm">הסטודיו צריך את Supabase (התחברות ושמירה). ראו README.</div>;
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) redirect("/");

  // המספרים על האריחים: מהנתונים האמיתיים בלבד
  const today = todayIL();
  const [ideas, drafts, trend, board] = await Promise.all([
    supabase.from("studio_items").select("id", { count: "exact", head: true }).eq("stage", "idea"),
    supabase.from("studio_drafts").select("data, project_id").order("updated_at", { ascending: false }).limit(200),
    supabase.from("studio_trends").select("items").eq("date", today).maybeSingle(),
    supabase.from("studio_items").select("id", { count: "exact", head: true }).gte("planned_date", today).neq("stage", "published"),
  ]);
  const rows = (drafts.data ?? []) as { data: { hooks?: unknown[]; shots?: unknown[] }; project_id: string | null }[];
  const counts: NavCounts = {
    ideas: ideas.count ?? 0,
    hooks: rows.reduce((n, d) => n + (d.data?.hooks?.length ?? 0), 0),
    trends: Array.isArray(trend.data?.items) ? trend.data.items.length : 0,
    board: board.count ?? 0,
    film: rows.filter((d) => d.data?.shots?.length && !d.project_id).length,
    scripts: rows.length,
  };

  return (
    <div className="studio fixed inset-0 overflow-y-auto bg-[#D6CFC3] text-[#1F1B16] [color-scheme:light]">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700;800&family=Bellefair&family=Frank+Ruhl+Libre:wght@500;700;900&display=swap" precedence="default" />
      <div className="mx-auto max-w-[1220px] px-2 py-3 md:px-6 md:py-8">
        <div className="rounded-[26px] border border-[#CFC7B9] bg-[#ECE7DE] px-3 pb-8 pt-5 shadow-[0_12px_40px_-12px_rgba(31,27,22,0.35)] md:px-8">
          <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex rounded-full border border-[#1F1B16] p-0.5 text-[11px] font-bold">
                <span className="rounded-full bg-[#1F1B16] px-3 py-1 text-[#FBF8F2]">סטודיו</span>
                <Link href="/" className="rounded-full px-3 py-1 hover:bg-[#FBF8F2]">עורך</Link>
              </div>
              <Link href="/studio"><h1 className="s-serif text-3xl leading-none md:text-[42px]">סטודיו <span className="s-accent">תוכן</span></h1></Link>
            </div>
          </header>
          <StudioNav counts={counts} />
          <main className="mt-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
