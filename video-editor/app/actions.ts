"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { initialProject } from "@/lib/editor/initial-project";
import { MEDIA_BUCKET } from "@/lib/supabase/env";
import { getUser } from "@/lib/supabase/server";

export async function createProject() {
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");
  const { title, ...doc } = initialProject();
  const { data, error } = await supabase.from("projects").insert({ title, doc }).select("id").single();
  if (error) throw new Error(error.message);
  redirect(`/p/${data.id}`);
}

export async function deleteProject(formData: FormData) {
  const id = String(formData.get("id"));
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");

  // מוחקים גם את הקבצים של הפרויקט מ-Storage: העלאות, ותוצאות AI בתיקיית variants/
  const storage = supabase.storage.from(MEDIA_BUCKET);
  const paths: string[] = [];
  for (const folder of [`${user.id}/${id}`, `${user.id}/${id}/variants`]) {
    const { data: files } = await storage.list(folder, { limit: 1000 });
    // ב-list, תיקייה מופיעה כרשומה בלי id
    for (const f of files ?? []) if (f.id) paths.push(`${folder}/${f.name}`);
  }
  if (paths.length) await storage.remove(paths);
  await supabase.from("projects").delete().eq("id", id);
  revalidatePath("/");
}
