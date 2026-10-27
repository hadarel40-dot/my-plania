import { redirect } from "next/navigation";
import { LocalEditor } from "@/components/editor/local-editor";
import { ProjectList } from "@/components/projects/project-list";
import { supabaseEnabled } from "@/lib/supabase/env";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  // בלי Supabase: עורך יחיד שנשמר בדפדפן
  if (!supabaseEnabled) return <LocalEditor />;

  const { supabase, user } = await getUser();
  if (!user) redirect("/login");

  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, title, updated_at, meta")
    .order("updated_at", { ascending: false });

  return <ProjectList email={user.email ?? ""} projects={projects ?? []} error={error?.message ?? null} />;
}
