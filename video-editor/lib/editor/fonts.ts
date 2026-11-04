/** גופנים לטקסט על המסך. כולם תומכים בעברית ונטענים מ-Google Fonts (app/layout.tsx) */
export interface FontOption { id: string; label: string; family: string; sample: string }

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
];

const FALLBACK = "'Heebo', 'Rubik', system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";

export const fontFamily = (id?: string) => {
  const f = FONTS.find((x) => x.id === id);
  return f ? `${f.family}, ${FALLBACK}` : FALLBACK;
};

/** כתובת Google Fonts לכל הגופנים */
export const FONTS_CSS = "https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;900&family=Rubik:wght@400;700;900&family=Secular+One&family=Suez+One&family=Frank+Ruhl+Libre:wght@400;700;900&family=Varela+Round&family=Amatic+SC:wght@400;700&family=Karantina:wght@400;700&family=Assistant:wght@400;700;800&family=IBM+Plex+Sans+Hebrew:wght@400;700&family=Fredoka:wght@500;700&family=Playpen+Sans+Hebrew:wght@400;700&family=Alef:wght@400;700&family=Bellefair&family=David+Libre:wght@400;700&family=Miriam+Libre:wght@400;700&family=Bona+Nova:wght@400;700&family=Noto+Rashi+Hebrew:wght@400;700&display=swap";
