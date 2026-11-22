/** גופנים לטקסט על המסך. כולם תומכים בעברית ונטענים מ-Google Fonts (app/layout.tsx) */
export interface FontOption { id: string; label: string; family: string; sample: string; extra?: boolean }

export const FONTS: FontOption[] = [
  { id: "heebo", label: "רגיל", family: "'Heebo'", sample: "אבג" },
  { id: "rubik", label: "עגול", family: "'Rubik'", sample: "אבג" },
  { id: "secular", label: "כותרת", family: "'Secular One'", sample: "אבג" },
  { id: "suez", label: "קלאסי", family: "'Suez One'", sample: "אבג" },
  { id: "frank", label: "ספרותי", family: "'Frank Ruhl Libre'", sample: "אבג" },
  { id: "varela", label: "רך", family: "'Varela Round'", sample: "אבג" },
  { id: "amatic", label: "כתב יד", family: "'Amatic SC'", sample: "אבג" },
  { id: "karantina", label: "צר וגבוה", family: "'Karantina'", sample: "אבג" },
  { id: "assistant", label: "נקי", family: "'Assistant'", sample: "אבג" },
  { id: "ibmplex", label: "מודרני", family: "'IBM Plex Sans Hebrew'", sample: "אבג" },
  { id: "fredoka", label: "שובב", family: "'Fredoka'", sample: "אבג" },
  { id: "playpen", label: "כתב חמוד", family: "'Playpen Sans Hebrew'", sample: "אבג" },
  { id: "alef", label: "פשוט", family: "'Alef'", sample: "אבג" },
  { id: "bellefair", label: "אלגנטי", family: "'Bellefair'", sample: "אבג" },
  { id: "david", label: "דוד", family: "'David Libre'", sample: "אבג" },
  { id: "miriam", label: "מרים", family: "'Miriam Libre'", sample: "אבג" },
  { id: "bonanova", label: "יוקרתי", family: "'Bona Nova'", sample: "אבג" },
  { id: "rashi", label: "רש\"י", family: "'Noto Rashi Hebrew'", sample: "אבג" },
  // גופנים מיוחדים: נטענים רק כשצריך (רשימת הגופנים נפתחה, או שטקסט משתמש באחד מהם)
  { id: "notosans", label: "נוטו", family: "'Noto Sans Hebrew'", sample: "אבג", extra: true },
  { id: "notoserif", label: "נוטו סריף", family: "'Noto Serif Hebrew'", sample: "אבג", extra: true },
  { id: "tinos", label: "טיימס", family: "'Tinos'", sample: "אבג", extra: true },
  { id: "gveret", label: "כתב יד גברת", family: "'Gveret Levin'", sample: "אבג", extra: true },
  { id: "solitreo", label: "כתב עתיק", family: "'Solitreo'", sample: "אבג", extra: true },
  { id: "bubbles", label: "בועות", family: "'Rubik Bubbles'", sample: "אבג", extra: true },
  { id: "glitch", label: "גליץ'", family: "'Rubik Glitch'", sample: "אבג", extra: true },
  { id: "glitchpop", label: "גליץ' פופ", family: "'Rubik Glitch Pop'", sample: "אבג", extra: true },
  { id: "wetpaint", label: "צבע נוטף", family: "'Rubik Wet Paint'", sample: "אבג", extra: true },
  { id: "spray", label: "גרפיטי", family: "'Rubik Spray Paint'", sample: "אבג", extra: true },
  { id: "marker", label: "טוש", family: "'Rubik Marker Hatch'", sample: "אבג", extra: true },
  { id: "doodle", label: "שרבוט", family: "'Rubik Doodle Shadow'", sample: "אבג", extra: true },
  { id: "scribble", label: "קשקוש", family: "'Rubik Scribble'", sample: "אבג", extra: true },
  { id: "puddles", label: "שלוליות", family: "'Rubik Puddles'", sample: "אבג", extra: true },
  { id: "moonrocks", label: "סלעי ירח", family: "'Rubik Moonrocks'", sample: "אבג", extra: true },
  { id: "beastly", label: "מפלצתי", family: "'Rubik Beastly'", sample: "אבג", extra: true },
  { id: "fade80", label: "שנות ה-80", family: "'Rubik 80s Fade'", sample: "אבג", extra: true },
  { id: "gemstones", label: "יהלומים", family: "'Rubik Gemstones'", sample: "אבג", extra: true },
  { id: "vinyl", label: "תקליט", family: "'Rubik Vinyl'", sample: "אבג", extra: true },
  { id: "burned", label: "שרוף", family: "'Rubik Burned'", sample: "אבג", extra: true },
  { id: "pixels", label: "פיקסלים", family: "'Rubik Pixels'", sample: "אבג", extra: true },
  { id: "maze", label: "מבוך", family: "'Rubik Maze'", sample: "אבג", extra: true },
];

const FALLBACK = "'Heebo', 'Rubik', system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";

export const fontFamily = (id?: string) => {
  const f = FONTS.find((x) => x.id === id);
  if (f?.extra) void ensureExtraFonts();
  return f ? `${f.family}, ${FALLBACK}` : FALLBACK;
};

/** הגופנים המיוחדים בקובץ CSS נפרד, שנטען פעם אחת כשצריך (כדי שפתיחת העורך תישאר מהירה) */
const EXTRA_FONTS_CSS = "https://fonts.googleapis.com/css2?" +
  FONTS.filter((f) => f.extra).map((f) => `family=${f.family.replace(/'/g, "").replace(/ /g, "+")}`).join("&") + "&display=swap";

let extraReady: Promise<void> | null = null;
/** טוען את הגופנים המיוחדים (פעם אחת). מחזיר הבטחה שמתקיימת כשקובץ ה-CSS נטען */
export function ensureExtraFonts(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  extraReady ??= new Promise<void>((resolve) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = EXTRA_FONTS_CSS;
    link.onload = () => resolve();
    link.onerror = () => resolve();
    document.head.appendChild(link);
  });
  return extraReady;
}

export const isExtraFont = (id?: string) => !!FONTS.find((f) => f.id === id)?.extra;

/** כתובת Google Fonts לכל הגופנים */
export const FONTS_CSS = "https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;900&family=Rubik:wght@400;700;900&family=Secular+One&family=Suez+One&family=Frank+Ruhl+Libre:wght@400;700;900&family=Varela+Round&family=Amatic+SC:wght@400;700&family=Karantina:wght@400;700&family=Assistant:wght@400;700;800&family=IBM+Plex+Sans+Hebrew:wght@400;700&family=Fredoka:wght@500;700&family=Playpen+Sans+Hebrew:wght@400;700&family=Alef:wght@400;700&family=Bellefair&family=David+Libre:wght@400;700&family=Miriam+Libre:wght@400;700&family=Bona+Nova:wght@400;700&family=Noto+Rashi+Hebrew:wght@400;700&display=swap";
