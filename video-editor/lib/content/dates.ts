/** תאריכים לדאשבורד התוכן. הכול בשעון המקומי של הדפדפן (ישראל) */

export const DEFAULT_TIME = "20:30";

const pad = (n: number) => n.toString().padStart(2, "0");

/** ISO → ערך לשדה datetime-local */
export function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** ערך של datetime-local → ISO (או null) */
export const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** תחילת השבוע (יום ראשון) */
export function startOfWeek(d: Date) {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  s.setDate(s.getDate() - s.getDay());
  return s;
}

export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

/** אותו יום, בשעה של ה-ISO הקיים (או 20:30) */
export function atDay(day: Date, keepFrom: string | null) {
  const [h, m] = keepFrom ? [new Date(keepFrom).getHours(), new Date(keepFrom).getMinutes()] : DEFAULT_TIME.split(":").map(Number);
  const x = new Date(day);
  x.setHours(h, m, 0, 0);
  return x.toISOString();
}

export const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
export const dayName = (d: Date) => d.toLocaleDateString("he-IL", { weekday: "long" });
export const shortDate = (d: Date) => d.toLocaleDateString("he-IL", { day: "numeric", month: "numeric" });
export const fullDateTime = (iso: string) =>
  new Date(iso).toLocaleString("he-IL", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
export const rangeLabel = (start: Date) => {
  const end = addDays(start, 6);
  const f = (d: Date) => d.toLocaleDateString("he-IL", { day: "numeric", month: "long" });
  return `${f(start)} – ${f(end)}`;
};
