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
];

const FALLBACK = "'Heebo', 'Rubik', system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";

export const fontFamily = (id?: string) => {
  const f = FONTS.find((x) => x.id === id);
  return f ? `${f.family}, ${FALLBACK}` : FALLBACK;
};

/** כתובת Google Fonts לכל הגופנים */
export const FONTS_CSS = "https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;900&family=Rubik:wght@400;700;900&family=Secular+One&family=Suez+One&family=Frank+Ruhl+Libre:wght@400;700;900&family=Varela+Round&family=Amatic+SC:wght@400;700&family=Karantina:wght@400;700&display=swap";
