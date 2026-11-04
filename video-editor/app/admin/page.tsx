import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

export const dynamic = "force-dynamic";

/** דאשבורד ניהול: רק למנהלת. קישורי הצטרפות, בקשות ממתינות ומשתמשות */
export default async function AdminPage() {
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) redirect("/");
  const [{ data: links }, { data: requests }] = await Promise.all([
    supabase.from("invites").select("token, created_at, revoked_at").is("revoked_at", null).order("created_at", { ascending: false }),
    supabase.from("join_requests").select("id, email, status, created_at, decided_at").order("created_at", { ascending: false }),
  ]);
  return <AdminDashboard email={user.email ?? ""} links={links ?? []} requests={requests ?? []} />;
}
