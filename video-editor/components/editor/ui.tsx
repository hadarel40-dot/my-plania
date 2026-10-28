"use client";
import { cn } from "@/lib/utils";

export function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {hint && <span className="text-[11px] text-zinc-500">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

export function IconButton({ children, label, onClick, active }: { children: React.ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label}
      className={cn("grid size-7 shrink-0 place-items-center rounded-md transition",
        active ? "bg-violet-600 text-white" : "text-zinc-400 hover:bg-zinc-800 hover:text-white")}>
      {children}
    </button>
  );
}
