import { redirect } from "next/navigation";
import { ContentDashboard } from "@/components/content/content-dashboard";
import type { ContentItem } from "@/lib/content/types";
import { supabaseEnabled } from "@/lib/supabase/env";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "מאגר תוכן" };

/** מאגר התוכן לאינסטגרם: תכנון, טיוטות, אישור ותזמון לפרסום. רק למנהלת */
export default async function ContentPage() {
  if (!supabaseEnabled) redirect("/");
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) redirect("/");

  const [items, projects, automation] = await Promise.all([
    supabase.from("content_items").select("*").order("scheduled_at", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false }),
    supabase.from("projects").select("id, title").order("updated_at", { ascending: false }).limit(100),
    supabase.from("content_automation").select("created_at, last_seen_at").maybeSingle(),
  ]);

  return (
    <ContentDashboard
      initialItems={(items.data ?? []) as ContentItem[]}
      loadError={items.error?.message ?? null}
      projects={projects.data ?? []}
      automation={automation.data ?? null}
    />
  );
}
