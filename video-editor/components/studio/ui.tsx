"use client";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** צבעי הסטודיו: קרם, בורדו, ירוק עמוק, דיו. פינות חדות */
export const C = { cream: "#F4EEE4", paper: "#FBF8F3", wine: "#5E1D1D", green: "#2F4A3A", ink: "#2A2622", line: "#D9CFC2", muted: "#6A6158" };

export function Panel({ title, aside, children, className, tone }: { title?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string; tone?: "wine" | "green" }) {
  return (
    <section className={cn("border border-[#D9CFC2] bg-[#FBF8F3] px-4 py-4", tone === "wine" && "border-r-4 border-r-[#5E1D1D]", tone === "green" && "border-r-4 border-r-[#2F4A3A]", className)}>
      {(title || aside) && (
        <div className="mb-3 flex items-baseline justify-between gap-3">
          {title && <h2 className="s-serif text-lg leading-tight">{title}</h2>}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-[#2A2622]/20 pb-4">
      <div>
        <h1 className="s-serif text-3xl leading-tight">{title}</h1>
        {sub && <p className="mt-1 max-w-2xl text-sm text-[#6A6158]">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </header>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "solid" | "green" | "line" | "ghost"; busy?: boolean };
export function Btn({ variant = "solid", busy, children, className, disabled, ...props }: BtnProps) {
  return (
    <button
      type="button"
      {...props}
      disabled={busy || disabled}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 border px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variant === "solid" && "border-[#5E1D1D] bg-[#5E1D1D] text-[#FBF8F3] hover:bg-[#4A1616]",
        variant === "green" && "border-[#2F4A3A] bg-[#2F4A3A] text-[#FBF8F3] hover:bg-[#263D30]",
        variant === "line" && "border-[#5E1D1D] text-[#5E1D1D] hover:bg-[#5E1D1D] hover:text-[#FBF8F3]",
        variant === "ghost" && "border-transparent text-[#5E1D1D] hover:border-[#D9CFC2]",
        className,
      )}
    >
      {busy && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Tag({ children, tone }: { children: ReactNode; tone?: "wine" | "green" | "bad" }) {
  return (
    <span className={cn("inline-block border px-1.5 py-0.5 text-[11px] font-semibold leading-none",
      tone === "wine" ? "border-[#5E1D1D]/50 text-[#5E1D1D]" : tone === "green" ? "border-[#2F4A3A]/50 text-[#2F4A3A]" : tone === "bad" ? "border-[#A33A2B]/60 text-[#A33A2B]" : "border-[#D9CFC2] text-[#6A6158]")}>
      {children}
    </span>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-[#6A6158]">{hint}</span>}
    </label>
  );
}

export const inputCls = "w-full border border-[#CFC4B5] bg-[#FFFDF9] px-3 py-2 text-sm text-[#2A2622] placeholder:text-[#6A6158]/70 focus:border-[#5E1D1D] focus:outline-none";

export function Select<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: readonly { value: T; label: string }[]; className?: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as T)} className={cn(inputCls, "py-1.5", className)}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function Note({ children, tone }: { children: ReactNode; tone?: "bad" }) {
  return <p className={cn("border-r-2 py-1 pr-3 text-sm leading-relaxed", tone === "bad" ? "border-[#A33A2B] text-[#A33A2B]" : "border-[#2F4A3A] text-[#6A6158]")}>{children}</p>;
}

export function Loading({ children = "טוענת..." }: { children?: ReactNode }) {
  return <p className="flex items-center gap-2 text-sm text-[#6A6158]"><Loader2 className="size-4 animate-spin" />{children}</p>;
}

export function Meter({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <span className="block h-1.5 w-full bg-[#E6DCCD]">
      <span className={cn("block h-full", v < 50 ? "bg-[#A33A2B]" : v < 70 ? "bg-[#6A6158]" : "bg-[#2F4A3A]")} style={{ width: `${v}%` }} />
    </span>
  );
}

/** הודעה קצרה בתחתית המסך (בלי ספריית התראות) */
export function toast(message: string, bad = false) {
  if (typeof document === "undefined") return;
  const el = document.createElement("div");
  el.textContent = message;
  el.setAttribute("role", "status");
  el.className = `fixed bottom-4 left-1/2 z-50 -translate-x-1/2 border px-4 py-2 text-sm shadow-sm ${bad ? "border-[#A33A2B] bg-[#FBF8F3] text-[#A33A2B]" : "border-[#2F4A3A] bg-[#2F4A3A] text-[#FBF8F3]"}`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), bad ? 6000 : 3000);
}
