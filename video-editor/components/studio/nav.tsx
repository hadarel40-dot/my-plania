"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type NavCounts = Partial<Record<"ideas" | "hooks" | "trends" | "board" | "film" | "scripts" | "carousels" | "pick", number>>;

interface Sub { href: string; label: string; count?: keyof NavCounts }
interface Group { key: string; label: string; href: string; subs: Sub[] }

/** חמש לשוניות. בתוך כל לשונית השורה השנייה מראה את הדפים שלה, בשמות שאומרים מה יש שם */
const GROUPS: Group[] = [
  { key: "today", label: "היום", href: "/studio", subs: [] },
  { key: "plan", label: "תכנון", href: "/studio/board", subs: [
    { href: "/studio/board", label: "לוח התוכן", count: "board" },
    { href: "/studio/replan", label: "לתכנן את השבוע מחדש" },
    { href: "/studio/ideas", label: "רעיונות", count: "ideas" },
    { href: "/studio/trends", label: "טרנדים", count: "trends" },
  ] },
  { key: "create", label: "יצירה", href: "/studio/new", subs: [
    { href: "/studio/new", label: "+ ריל חדש" },
    { href: "/studio/own-video", label: "+ סרטון שצילמתי" },
    { href: "/studio/carousel", label: "קרוסלות", count: "carousels" },
    { href: "/studio/reel", label: "רילס", count: "scripts" },
    { href: "/studio/templates", label: "תבניות" },
    { href: "/studio/film", label: "רשימת צילום", count: "film" },
  ] },
  { key: "results", label: "תוצאות", href: "/studio/performance", subs: [
    { href: "/studio/performance", label: "ביצועים" },
    { href: "/studio/review", label: "סקירה שבועית" },
  ] },
  { key: "more", label: "עוד", href: "/studio/library", subs: [
    { href: "/studio/library", label: "ספרייה" },
    { href: "/studio/voice", label: "הקול והמותג" },
    { href: "/studio/hooks", label: "משפטי פתיחה" },
    { href: "/studio/pick", label: "כל הגרסאות" },
  ] },
];

function activeGroup(path: string) {
  if (path === "/studio") return GROUPS[0];
  return GROUPS.slice(1).find((g) => g.subs.some((s) => s.href !== "/" && path.startsWith(s.href))) ?? GROUPS[0];
}

export function StudioNav({ counts }: { counts: NavCounts }) {
  const path = usePathname();
  const group = activeGroup(path);
  return (
    <nav aria-label="ניווט בסטודיו" className="space-y-2">
      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-[#E3D9CC] bg-[#FAF6F1] p-1 shadow-[0_1px_2px_rgba(31,27,22,0.06)]">
        {GROUPS.map((g) => {
          const pending = 0;
          return (
            <Link key={g.key} href={g.href}
              className={cn("relative flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-center text-sm font-bold transition-colors", g === group ? "bg-[#5E1D1D] text-[#FAF6F1]" : "text-[#2A2622] hover:bg-[#F2ECE4]")}>
              {g.label}
              {!!pending && <span className="absolute left-1.5 top-1 min-w-[18px] rounded-full bg-[#EFD9DD] px-1 text-[10px] leading-[18px] text-[#2A2622]">{pending}</span>}
            </Link>
          );
        })}
      </div>
      {group.subs.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {group.subs.map((s) => {
            const on = s.href !== "/" && path.startsWith(s.href);
            const n = s.count ? counts[s.count] : 0;
            return (
              <Link key={s.href} href={s.href}
                className={cn("flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold", on ? "border-[#5E1D1D] bg-[#EFD9DD]" : "border-[#E3D9CC] bg-[#FAF6F1] hover:bg-[#F2ECE4]")}>
                {s.label}
                {!!n && <span className="rounded-full bg-[#4E4540] px-1.5 text-[10px] font-bold leading-[16px] text-white">{n}</span>}
              </Link>
            );
          })}
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
