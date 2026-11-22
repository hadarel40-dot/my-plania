"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { MessageCircle, MoreHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type NavCounts = Partial<Record<"ideas" | "hooks" | "trends" | "board" | "film" | "scripts" | "carousels" | "pick", number>>;

/**
 * ארבע לשוניות גדולות, כל אחת עושה דבר אחד (כמו בדשבורד שהיא אהבה): השבוע, המותג, רעיונות, תוצאות.
 * כל השאר נמצא ב"עוד", כדי שהמסך יישאר נקי.
 */
const TABS: { href: string; label: string; match: string[] }[] = [
  { href: "/studio", label: "השבוע", match: ["/studio/board", "/studio/replan", "/studio/reel", "/studio/carousel", "/studio/pick", "/studio/new", "/studio/own-video"] },
  { href: "/studio/voice", label: "המותג", match: ["/studio/voice", "/studio/templates"] },
  { href: "/studio/ideas", label: "רעיונות", match: ["/studio/ideas", "/studio/trends", "/studio/hooks", "/studio/film"] },
  { href: "/studio/performance", label: "תוצאות", match: ["/studio/performance", "/studio/review"] },
];

const MORE: { title: string; links: { href: string; label: string; count?: keyof NavCounts }[] }[] = [
  { title: "ליצור", links: [
    { href: "/studio/own-video", label: "+ ריל מהסרטונים שלי" },
    { href: "/studio/new", label: "+ ריל חדש מתסריט" },
    { href: "/studio/carousel", label: "קרוסלות", count: "carousels" },
    { href: "/studio/reel", label: "רילס", count: "scripts" },
  ] },
  { title: "לתכנן", links: [
    { href: "/studio/board", label: "לוח התוכן", count: "board" },
    { href: "/studio/replan", label: "לתכנן את השבוע מחדש" },
    { href: "/studio/pick", label: "כל הגרסאות", count: "pick" },
    { href: "/studio/film", label: "רשימת צילום", count: "film" },
  ] },
  { title: "השראה", links: [
    { href: "/studio/trends", label: "טרנדים", count: "trends" },
    { href: "/studio/hooks", label: "משפטי פתיחה" },
    { href: "/studio/templates", label: "תבניות" },
  ] },
  { title: "עוד", links: [
    { href: "/studio/library", label: "ספרייה" },
    { href: "/studio/review", label: "סקירה שבועית" },
  ] },
];

const activeTab = (path: string) => {
  if (path === "/studio") return 0;
  const i = TABS.findIndex((t) => t.match.some((m) => path.startsWith(m)));
  return i;
};

export function StudioNav({ counts }: { counts: NavCounts }) {
  const path = usePathname();
  const on = activeTab(path);
  const [more, setMore] = useState(false);
  useEffect(() => setMore(false), [path]);
  return (
    <nav aria-label="ניווט בסטודיו" className="relative flex items-center gap-2">
      <div className="flex flex-1 gap-1 rounded-full bg-[#EFE6DC] p-1 md:flex-none">
        {TABS.map((t, i) => (
          <Link key={t.href} href={t.href} aria-current={on === i ? "page" : undefined}
            className={cn("relative flex-1 whitespace-nowrap rounded-full px-3 py-2 text-center text-[14px] font-bold transition md:flex-none md:px-6", on === i ? "text-[#FAF6F1]" : "text-[#5E1D1D] hover:bg-white/60")}>
            {on === i && <span className="absolute inset-0 -z-0 rounded-full bg-[#5E1D1D] shadow-[0_6px_14px_-8px_rgba(94,29,29,0.9)]" />}
            <span className="relative">{t.label}</span>
          </Link>
        ))}
      </div>
      <button type="button" onClick={() => setMore((v) => !v)} aria-expanded={more} aria-label="עוד דפים"
        className={cn("grid size-11 shrink-0 place-items-center rounded-full border transition", more ? "border-[#5E1D1D] bg-[#5E1D1D] text-[#FAF6F1]" : "border-[#E3D9CC] bg-white/70 text-[#5E1D1D]")}>
        {more ? <X className="size-5" /> : <MoreHorizontal className="size-5" />}
      </button>
      {more && (
        <div className="absolute inset-x-0 top-[calc(100%+8px)] z-50 grid grid-cols-2 gap-4 rounded-3xl border border-[#E3D9CC] bg-[#FFFDFB] p-5 shadow-[0_24px_50px_-24px_rgba(94,29,29,0.5)] md:right-auto md:left-0 md:w-[560px] md:grid-cols-4">
          {MORE.map((g) => (
            <div key={g.title}>
              <p className="mb-2 text-[11px] font-bold tracking-wide text-[#9A8C85]">{g.title}</p>
              <ul className="space-y-1">
                {g.links.map((l) => {
                  const n = l.count ? counts[l.count] : 0;
                  return (
                    <li key={l.href}>
                      <Link href={l.href} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[14px] font-semibold text-[#2A2622] hover:bg-[#F2ECE4]">
                        {l.label}
                        {!!n && <span className="rounded-full bg-[#EFD9DD] px-1.5 text-[11px] font-bold text-[#5E1D1D]">{n}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </nav>
  );
}

/** היועצת: כפתור צף בכל דף בסטודיו */
export function AdvisorButton() {
  const path = usePathname();
  if (path.startsWith("/studio/advisor")) return null;
  return (
    <Link href="/studio/advisor" aria-label="לשאול את היועצת"
      className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-full bg-[#5E1D1D] p-3 text-sm sm:bottom-5 sm:left-5 sm:px-4 font-bold text-[#FAF6F1] shadow-[0_8px_24px_-6px_rgba(31,27,22,0.5)] hover:bg-[#4A1517]">
      <MessageCircle className="size-5 sm:size-4" /><span className="hidden sm:inline">יועצת</span>
    </Link>
  );
}
