import { redirect } from "next/navigation";
import { LocalEditor } from "@/components/editor/local-editor";
import { ProjectList } from "@/components/projects/project-list";
import { supabaseEnabled } from "@/lib/supabase/env";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ password?: string }> }) {
  // בלי Supabase: עורך יחיד שנשמר בדפדפן
  if (!supabaseEnabled) return <LocalEditor />;

  const { supabase, user } = await getUser();
  if (!user) redirect("/login");

  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, title, updated_at, meta")
    .order("updated_at", { ascending: false });

  // מי שעוד לא בחר סיסמה רואה את בחירת הסיסמה, כדי שבפעם הבאה לא יצטרך קישור מהמייל
  const hasPassword = user.user_metadata?.has_password === true;
  // המנהלת רואה כפתור ניהול, עם מספר הבקשות שממתינות לאישור
  const { data: isAdmin } = await supabase.rpc("is_admin");
  const pending = isAdmin
    ? (await supabase.from("join_requests").select("id", { count: "exact", head: true }).eq("status", "pending")).count ?? 0
    : 0;
  const showPassword = !hasPassword || (await searchParams).password === "1";
  return (
    <ProjectList email={user.email ?? ""} projects={projects ?? []} error={error?.message ?? null}
      showPassword={showPassword} hasPassword={hasPassword} admin={isAdmin ? { pending } : null} />
  );
}
