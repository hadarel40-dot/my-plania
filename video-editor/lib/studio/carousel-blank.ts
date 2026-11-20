import { ACCOUNTS, type Account, type Carousel, type Slide } from "./config";
import type { Template } from "./templates";

const DEFAULT_STRUCTURE = ["שער", "למה זה חשוב", "רעיון 1", "רעיון 2", "רעיון 3", "סיכום לשמירה", "קריאה לפעולה"];

/** סוג השקופית לפי השורה במבנה של התבנית */
function kindOf(line: string, i: number, n: number): Slide["kind"] {
  if (i === 0) return "cover";
  if (i === n - 1) return "cta";
  if (/סיכום|כל הרשימה|כל התיקונים/.test(line)) return "recap";
  if (i === 1 && /למה|עולות|קושי|לפני/.test(line)) return "stake";
  return "point";
}

/**
 * קרוסלה ריקה לפי מבנה של תבנית, בלי AI ובלי עלות.
 * הכותרות הן שלד שהיא מחליפה, והשער מקבל את הרעיון שלה.
 */
export function blankCarousel(idea: string, account: Account, tpl?: Template | null): Carousel {
  const lines = tpl?.kind === "carousel" ? tpl.structure : DEFAULT_STRUCTURE;
  const slides: Slide[] = lines.map((line, i) => {
    const kind = kindOf(line, i, lines.length);
    const headline = kind === "cover" ? idea.trim().slice(0, 60) : line.replace(/^(שער|קריאה לפעולה):\s*/, "").replace(/['"]/g, "");
    return { kind, headline, body: "" };
  });
  return {
    slides,
    caption: "",
    alt: idea.trim().slice(0, 120),
    handle: ACCOUNTS.find((a) => a.value === account)?.label ?? "",
    style: tpl?.style ?? "cream",
  };
}

export const NEW_SLIDE: Slide = { kind: "point", headline: "כותרת חדשה", body: "" };
