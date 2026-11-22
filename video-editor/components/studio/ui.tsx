"use client";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * העיצוב של הסטודיו: גיליון בהיר על רקע בז' חם, כרטיסי שמנת עם פינות רכות, כותרות סריף עם מילה
 * מודגשת בגופן אחר, תוויות קטנות ומרווחות, כפתורים שחורים והדגשה בצהוב חמאה.
 */
export const C = { page: "#E4D8CC", sheet: "#F0E8DF", card: "#FAF6F1", ink: "#5E1D1D", muted: "#6A6158", line: "#E3D9CC", butter: "#EFD9DD", green: "#3E6B4F", bad: "#A3402F" };

/** כותרת סריף, ומילה אחת בגופן התצוגה (כמו המילה הנטויה בעיצוב המקורי) */
export function Title({ children, accent, size = "lg", as: Tag = "h2", className }: { children?: ReactNode; accent?: ReactNode; size?: "sm" | "lg" | "xl"; as?: "h1" | "h2" | "h3"; className?: string }) {
  return (
    <Tag className={cn("s-serif leading-[1.05] text-[#2A2622]", size === "xl" ? "text-4xl md:text-5xl" : size === "lg" ? "text-2xl md:text-[28px]" : "text-lg", className)}>
      {children}{children && accent ? " " : ""}{accent && <span className="s-accent">{accent}</span>}
    </Tag>
  );
}

/** תווית קטנה ומרווחת מעל מספר או כותרת */
export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-[11px] font-bold tracking-[0.14em] text-[#6A6158]", className)}>{children}</p>;
}

export function Panel({ title, accent, label, aside, children, className, tone }: { title?: ReactNode; accent?: ReactNode; label?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string; tone?: "butter" | "wine" | "green" }) {
  return (
    <section className={cn("rounded-2xl border border-[#E3D9CC] bg-[#FAF6F1] px-5 py-4 shadow-[0_1px_2px_rgba(31,27,22,0.06)]", tone === "butter" && "border-[#E3C3CA] ring-2 ring-[#EFD9DD]", className)}>
      {(title || label || aside) && (
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            {label && <Label className="mb-1">{label}</Label>}
            {title && <Title size="sm" accent={accent}>{title}</Title>}
          </div>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHead({ title, accent, label, sub, children }: { title: string; accent?: string; label?: string; sub?: string; children?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        {label && <Label className="mb-1">{label}</Label>}
        <Title as="h1" size="lg" accent={accent}>{title}</Title>
        {sub && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[#4E4540]">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </header>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "solid" | "green" | "line" | "ghost" | "butter"; busy?: boolean };
export function Btn({ variant = "solid", busy, children, className, disabled, ...props }: BtnProps) {
  return (
    <button
      type="button"
      {...props}
      disabled={busy || disabled}
      className={cn(
        "inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border px-4 py-2 text-[14px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variant === "solid" && "border-[#5E1D1D] bg-[#5E1D1D] text-[#FAF6F1] shadow-[0_6px_16px_-10px_rgba(94,29,29,0.9)] hover:bg-[#4A1517]",
        variant === "green" && "border-[#3E6B4F] bg-[#3E6B4F] text-[#FAF6F1] hover:bg-[#335A42]",
        variant === "butter" && "border-[#E3C3CA] bg-[#EFD9DD] text-[#5E1D1D] hover:bg-[#E8C9CF]",
        variant === "line" && "border-[#5E1D1D]/50 bg-white/60 text-[#5E1D1D] hover:border-[#5E1D1D] hover:bg-[#5E1D1D] hover:text-[#FAF6F1]",
        variant === "ghost" && "border-transparent px-2 text-[#5E1D1D] underline-offset-4 hover:underline",
        className,
      )}
    >
      {busy && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Tag({ children, tone }: { children: ReactNode; tone?: "wine" | "green" | "bad" | "butter" }) {
  return (
    <span className={cn("inline-block rounded-[4px] px-1.5 py-0.5 text-[11px] font-bold leading-none",
      tone === "butter" || tone === "wine" ? "bg-[#EFD9DD] text-[#2A2622]" : tone === "green" ? "bg-[#DCE8DF] text-[#2C4F39]" : tone === "bad" ? "bg-[#F3DCD5] text-[#8A3324]" : "bg-[#F0E8DF] text-[#4E4540]")}>
      {children}
    </span>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold tracking-[0.12em] text-[#6A6158]">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-[#6A6158]">{hint}</span>}
    </label>
  );
}

export const inputCls = "w-full rounded-lg border border-[#DDD4C6] bg-white/70 px-3 py-2 text-sm text-[#2A2622] placeholder:text-[#6A6158]/70 focus:border-[#5E1D1D] focus:outline-none";

export function Select<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: readonly { value: T; label: string }[]; className?: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as T)} className={cn(inputCls, "py-1.5", className)}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function Note({ children, tone }: { children: ReactNode; tone?: "bad" }) {
  return <p className={cn("rounded-xl px-3 py-2 text-sm leading-relaxed", tone === "bad" ? "bg-[#F3DCD5] text-[#8A3324]" : "bg-[#F2ECE4] text-[#4E4540]")}>{children}</p>;
}

export function Loading({ children = "טוענת..." }: { children?: ReactNode }) {
  return <p className="flex items-center gap-2 text-sm text-[#6A6158]"><Loader2 className="size-4 animate-spin" />{children}</p>;
}

export function Meter({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-[#F0E8DF]">
      <span className={cn("block h-full rounded-full", v < 50 ? "bg-[#A3402F]" : v < 70 ? "bg-[#B9A16A]" : "bg-[#3E6B4F]")} style={{ width: `${v}%` }} />
    </span>
  );
}

/** אריח מספר: תווית קטנה, מספר גדול בסריף, ושבב צהוב אופציונלי */
export function StatTile({ label, value, chip, hint }: { label: string; value: ReactNode; chip?: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#E3D9CC] bg-[#FAF6F1] px-4 py-3 shadow-[0_1px_2px_rgba(31,27,22,0.06)]">
      <Label>{label}</Label>
      <p className="s-serif mt-1 text-3xl leading-none">{value}</p>
      {chip && <span className="mt-2 inline-block rounded-[4px] bg-[#EFD9DD] px-1.5 py-0.5 text-[11px] font-bold">{chip}</span>}
      {hint && <p className="mt-1 text-[11px] text-[#6A6158]">{hint}</p>}
    </div>
  );
}

/** הודעה קצרה בתחתית המסך */
export function toast(message: string, bad = false) {
  if (typeof document === "undefined") return;
  const el = document.createElement("div");
  el.textContent = message;
  el.setAttribute("role", "status");
  el.className = `fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-2 text-sm shadow-md ${bad ? "bg-[#F3DCD5] text-[#8A3324]" : "bg-[#5E1D1D] text-[#FAF6F1]"}`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), bad ? 6000 : 3000);
}
