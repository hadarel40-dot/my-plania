"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Anchor, BarChart3, CheckSquare, Brain, CalendarDays, Clapperboard, GalleryHorizontal, Home, LayoutTemplate, Library, MessageCircle, Lightbulb, Newspaper, Scissors, ScrollText, TrendingUp, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type NavCounts = Partial<Record<"ideas" | "hooks" | "trends" | "board" | "film" | "scripts" | "carousels" | "pick", number>>;

interface Tile { href: string; label: string; icon: LucideIcon; tint: string; count?: keyof NavCounts }
const GROUPS: { label: string; tiles: Tile[] }[] = [
  { label: "תכנון", tiles: [
    { href: "/studio/ideas", label: "רעיונות", icon: Lightbulb, tint: "#FBEFC4", count: "ideas" },
    { href: "/studio/hooks", label: "הוקים", icon: Anchor, tint: "#F4E1D2", count: "hooks" },
    { href: "/studio/trends", label: "טרנדים", icon: TrendingUp, tint: "#DDE7F0", count: "trends" },
    { href: "/studio/board", label: "לוח", icon: CalendarDays, tint: "#E2ECDF", count: "board" },
    { href: "/studio/pick", label: "לבחירה", icon: CheckSquare, tint: "#F6E7A6", count: "pick" },
  ] },
  { label: "יצירה", tiles: [
    { href: "/studio/templates", label: "תבניות", icon: LayoutTemplate, tint: "#F3DDE3" },
    { href: "/studio/film", label: "צילום", icon: Clapperboard, tint: "#ECE3F3", count: "film" },
    { href: "/studio/reel", label: "תסריטים", icon: ScrollText, tint: "#FBEFC4", count: "scripts" },
    { href: "/studio/carousel", label: "קרוסלות", icon: GalleryHorizontal, tint: "#DDE7F0", count: "carousels" },
    { href: "/", label: "עריכה", icon: Scissors, tint: "#F4E1D2" },
  ] },
  { label: "למידה", tiles: [
    { href: "/studio/performance", label: "תוצאות", icon: BarChart3, tint: "#DDE7F0" },
    { href: "/studio/review", label: "סקירה", icon: Newspaper, tint: "#E2ECDF" },
    { href: "/studio/voice", label: "הקול", icon: Brain, tint: "#F3DDE3" },
  ] },
];

function TileLink({ tile, active, count }: { tile: Tile; active: boolean; count?: number }) {
  const Icon = tile.icon;
  return (
    <Link href={tile.href} className={cn("group flex w-[66px] shrink-0 flex-col items-center gap-1 rounded-xl px-1 py-1.5 transition-colors", active ? "bg-[#F6E7A6]" : "hover:bg-[#F4EFE6]")}>
      <span className="relative grid size-10 place-items-center rounded-xl border border-[#E2DACD] shadow-[0_1px_1px_rgba(31,27,22,0.08)]" style={{ background: tile.tint }}>
        <Icon className="size-5 text-[#1F1B16]" strokeWidth={1.6} />
        {!!count && <span className="absolute -left-1.5 -top-1.5 min-w-[18px] rounded-full bg-[#4E473E] px-1 text-center text-[10px] font-bold leading-[18px] text-white">{count}</span>}
      </span>
      <span className="text-[11px] font-bold tracking-wide text-[#1F1B16]">{tile.label}</span>
    </Link>
  );
}

export function StudioNav({ counts }: { counts: NavCounts }) {
  const path = usePathname();
  const homeActive = path === "/studio";
  return (
    <nav aria-label="ניווט בסטודיו" className="flex items-end gap-3 overflow-x-auto rounded-2xl border border-[#E2DACD] bg-[#FBF8F2] px-3 py-2 shadow-[0_1px_2px_rgba(31,27,22,0.06)]">
      <TileLink tile={{ href: "/studio", label: "בית", icon: Home, tint: "#ECE7DE" }} active={homeActive} />
      <TileLink tile={{ href: "/studio/advisor", label: "יועצת", icon: MessageCircle, tint: "#F6E7A6" }} active={path.startsWith("/studio/advisor")} />
      <TileLink tile={{ href: "/studio/library", label: "ספרייה", icon: Library, tint: "#E2ECDF" }} active={path.startsWith("/studio/library")} />
      {GROUPS.map((g) => (
        <div key={g.label} className="flex shrink-0 flex-col items-center border-r border-[#E2DACD] pr-3">
          <span className="mb-0.5 text-[10px] font-bold tracking-[0.18em] text-[#6F675C]">{g.label}</span>
          <div className="flex gap-1">
            {g.tiles.map((t) => <TileLink key={t.href} tile={t} active={t.href !== "/" && path.startsWith(t.href)} count={t.count ? counts[t.count] : undefined} />)}
          </div>
        </div>
      ))}
    </nav>
  );
}
