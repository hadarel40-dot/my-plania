"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/studio", label: "היום" },
  { href: "/studio/trends", label: "טרנדים" },
  { href: "/studio/reel", label: "סטודיו" },
  { href: "/studio/board", label: "לוח תוכן" },
  { href: "/studio/performance", label: "ביצועים" },
  { href: "/studio/review", label: "סקירה שבועית" },
  { href: "/studio/voice", label: "הקול שלי" },
];

export function StudioNav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:mt-6 lg:flex-col lg:gap-0 lg:px-0">
      {NAV.map((item) => {
        const active = item.href === "/studio" ? path === "/studio" : path.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href}
            className={cn("shrink-0 whitespace-nowrap border px-3 py-1.5 text-sm lg:border-0 lg:border-r-2 lg:px-5 lg:py-2.5",
              active ? "border-[#5E1D1D] bg-[#FBF8F3] font-semibold text-[#5E1D1D] lg:border-r-[#5E1D1D]" : "border-transparent hover:border-[#D9CFC2] lg:border-r-transparent")}>
            {item.label}
          </Link>
        );
      })}
      <Link href="/" className="shrink-0 whitespace-nowrap border border-transparent px-3 py-1.5 text-sm text-[#2F4A3A] hover:border-[#D9CFC2] lg:mt-4 lg:border-0 lg:border-t lg:border-t-[#D9CFC2] lg:px-5 lg:py-2.5">
        עריכה בעורך
      </Link>
    </nav>
  );
}
