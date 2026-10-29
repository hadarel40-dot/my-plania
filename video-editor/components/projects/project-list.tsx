import { Captions, Clapperboard, Film, LogOut, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { createProject, deleteProject } from "@/app/actions";
import type { ProjectMeta } from "@/lib/editor/project-meta";
import { DeleteButton } from "./delete-button";

interface Row { id: string; title: string; updated_at: string; meta: Partial<ProjectMeta> | null }

const relative = new Intl.RelativeTimeFormat("he", { numeric: "auto" });
const dateFmt = new Intl.DateTimeFormat("he-IL", { dateStyle: "medium" });

/** "לפני 5 דקות" עד שבוע אחורה, ואחר כך תאריך */
function updatedLabel(iso: string) {
  const sec = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const abs = Math.abs(sec);
  if (abs < 60) return "עכשיו";
  if (abs < 3600) return relative.format(Math.round(sec / 60), "minute");
  if (abs < 86400) return relative.format(Math.round(sec / 3600), "hour");
  if (abs < 7 * 86400) return relative.format(Math.round(sec / 86400), "day");
  return dateFmt.format(new Date(iso));
}

const formatDuration = (sec: number) =>
  `${Math.floor(sec / 60)}:${Math.floor(sec % 60).toString().padStart(2, "0")}`;

export function ProjectList({ email, projects, error }: { email: string; projects: Row[]; error: string | null }) {
  return (
    <div className="h-screen overflow-y-auto bg-zinc-950 text-zinc-100">
      <header className="flex h-14 items-center gap-3 border-b border-zinc-800 px-4 sm:px-6">
        <Clapperboard className="size-5 text-violet-400" />
        <h1 className="text-sm font-semibold">הפרויקטים שלי</h1>
        {projects.length > 0 && <span className="text-xs text-zinc-500">{projects.length}</span>}
        <form action="/auth/signout" method="post" className="ms-auto flex items-center gap-2 text-xs text-zinc-500">
          <span dir="ltr" className="hidden sm:inline">{email}</span>
          <button title="התנתקות" aria-label="התנתקות" className="rounded-md p-1.5 hover:bg-zinc-800 hover:text-white">
            <LogOut className="size-4" />
          </button>
        </form>
      </header>

      <main className="mx-auto max-w-5xl p-6">
        {error && <p className="mb-4 rounded-md bg-red-500/10 p-3 text-sm text-red-300">שגיאה בטעינת הפרויקטים: {error}</p>}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <form action={createProject}>
            <button className="flex h-full min-h-60 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 text-sm text-zinc-400 transition hover:border-violet-500 hover:bg-violet-500/5 hover:text-white">
              <Plus className="size-7" /> פרויקט חדש
            </button>
          </form>

          {projects.map((p) => <ProjectCard key={p.id} project={p} />)}
        </div>

        {projects.length === 0 && !error && (
          <p className="mt-8 text-center text-sm text-zinc-500">עדיין אין פרויקטים. צור את הראשון.</p>
        )}
      </main>
    </div>
  );
}

function ProjectCard({ project: p }: { project: Row }) {
  const meta = p.meta ?? {};
  const clipCount = meta.clipCount ?? 0;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50 transition hover:border-zinc-600">
      <Link href={`/p/${p.id}`} className="absolute inset-0 z-10 rounded-xl" aria-label={`פתח ${p.title}`} />

      <div className="relative h-40 overflow-hidden bg-zinc-900">
        {meta.thumbnail ? (
          <>
            {/* הרקע: אותה תמונה מטושטשת, כדי שתמונה אנכית לא תשאיר פסים ריקים */}
            <img src={meta.thumbnail} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-xl" />
            <img src={meta.thumbnail} alt="" className="relative mx-auto h-full object-contain transition duration-300 group-hover:scale-105" />
          </>
        ) : (
          <div className="grid h-full place-items-center text-zinc-700"><Film className="size-10" /></div>
        )}
        {meta.aspect && (
          <span className="absolute start-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] tabular-nums text-zinc-200" dir="ltr">
            {meta.aspect}
          </span>
        )}
        {!!meta.duration && (
          <span className="absolute bottom-2 end-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-medium tabular-nums" dir="ltr">
            {formatDuration(meta.duration)}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <h2 className="truncate font-medium">{p.title}</h2>
        <div className="flex items-center gap-3 text-xs text-zinc-400">
          <span className="flex items-center gap-1"><Film className="size-3.5" />{clipCount} קליפים</span>
          {!!meta.captionCount && <span className="flex items-center gap-1"><Captions className="size-3.5" />כתוביות</span>}
          {!!meta.variantCount && (
            <span className="flex items-center gap-1 text-violet-300"><Sparkles className="size-3.5" />{meta.variantCount} וריאציות</span>
          )}
        </div>
        <div className="mt-auto flex items-center justify-between text-xs text-zinc-500">
          <span>עודכן {updatedLabel(p.updated_at)}</span>
          <form action={deleteProject} className="relative z-20">
            <input type="hidden" name="id" value={p.id} />
            <DeleteButton title={p.title} />
          </form>
        </div>
      </div>
    </div>
  );
}
