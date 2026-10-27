import { Clapperboard, LogOut, Plus } from "lucide-react";
import Link from "next/link";
import { createProject, deleteProject } from "@/app/actions";
import { DeleteButton } from "./delete-button";

interface Row { id: string; title: string; updated_at: string }

const dateFmt = new Intl.DateTimeFormat("he-IL", { dateStyle: "medium", timeStyle: "short" });

export function ProjectList({ email, projects, error }: { email: string; projects: Row[]; error: string | null }) {
  return (
    <div className="h-screen overflow-y-auto bg-zinc-950 text-zinc-100">
      <header className="flex h-14 items-center gap-3 border-b border-zinc-800 px-6">
        <Clapperboard className="size-5 text-violet-400" />
        <h1 className="text-sm font-semibold">הפרויקטים שלי</h1>
        <form action="/auth/signout" method="post" className="ms-auto flex items-center gap-2 text-xs text-zinc-500">
          <span dir="ltr">{email}</span>
          <button title="התנתקות" aria-label="התנתקות" className="rounded-md p-1.5 hover:bg-zinc-800 hover:text-white">
            <LogOut className="size-4" />
          </button>
        </form>
      </header>

      <main className="mx-auto max-w-4xl p-6">
        {error && <p className="mb-4 rounded-md bg-red-500/10 p-3 text-sm text-red-300">שגיאה בטעינת הפרויקטים: {error}</p>}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <form action={createProject}>
            <button className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 text-sm text-zinc-400 hover:border-violet-500 hover:text-white">
              <Plus className="size-6" /> פרויקט חדש
            </button>
          </form>

          {projects.map((p) => (
            <div key={p.id} className="group relative flex h-32 flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 hover:border-zinc-600">
              <Link href={`/p/${p.id}`} className="absolute inset-0 rounded-xl" aria-label={`פתח ${p.title}`} />
              <h2 className="truncate font-medium">{p.title}</h2>
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>עודכן {dateFmt.format(new Date(p.updated_at))}</span>
                <form action={deleteProject} className="relative">
                  <input type="hidden" name="id" value={p.id} />
                  <DeleteButton title={p.title} />
                </form>
              </div>
            </div>
          ))}
        </div>

        {projects.length === 0 && !error && (
          <p className="mt-8 text-center text-sm text-zinc-500">עדיין אין פרויקטים. צור את הראשון.</p>
        )}
      </main>
    </div>
  );
}
