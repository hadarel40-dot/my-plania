import { notFound, redirect } from "next/navigation";
import { CloudEditor } from "@/components/editor/cloud-editor";
import { supabaseEnabled } from "@/lib/supabase/env";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  if (!supabaseEnabled) redirect("/");
  const { id } = await params;
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");

  // RLS מחזירה רק פרויקטים של המשתמש, כך שפרויקט של מישהו אחר נראה כלא קיים
  const { data } = await supabase.from("projects").select("id").eq("id", id).maybeSingle();
  if (!data) notFound();

  return <CloudEditor projectId={id} userId={user.id} email={user.email ?? ""} />;
}
