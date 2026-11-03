/**
 * ספריית מוזיקה חינמית דרך Openverse (מאגר פתוח של יצירות ברישיונות Creative Commons,
 * בעיקר מ-Jamendo ו-ccMixter). מחפשים רק יצירות שמותר להשתמש בהן גם בתוכן מסחרי.
 * נקרא רק מהשרת.
 */
const API = "https://api.openverse.org/v1/audio/";

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  /** שניות */
  duration: number;
  license: string;
  /** טקסט קרדיט כפי שהרישיון דורש (CC BY): כדאי להוסיף לתיאור הפוסט */
  credit: string;
  needsCredit: boolean;
  page: string;
  /** קובץ השמע במקור (להשמעה מהירה בדפדפן) */
  audio: string;
}

interface OpenverseAudio {
  id: string;
  title?: string;
  creator?: string;
  duration?: number | null;
  license: string;
  license_version?: string;
  foreign_landing_url?: string;
  attribution?: string;
  url: string;
  filetype?: string | null;
}

const toTrack = (a: OpenverseAudio): MusicTrack => ({
  id: a.id,
  title: a.title || "ללא שם",
  artist: a.creator || "",
  duration: Math.round((a.duration ?? 0) / 1000),
  license: `${a.license.toUpperCase()} ${a.license_version ?? ""}`.trim(),
  credit: a.attribution ?? `"${a.title}" by ${a.creator} (${a.license.toUpperCase()})`,
  needsCredit: a.license !== "cc0" && a.license !== "pdm",
  page: a.foreign_landing_url ?? "",
  audio: a.url,
});

async function query(params: Record<string, string>): Promise<OpenverseAudio[]> {
  const url = new URL(API);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { accept: "application/json" }, next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`openverse ${res.status}`);
  return ((await res.json()) as { results: OpenverseAudio[] }).results ?? [];
}

export async function searchMusic(q: string, page = 1): Promise<MusicTrack[]> {
  const base = { q, license_type: "commercial", page_size: "40", page: String(page) };
  // קודם רק מוזיקה, ואם אין תוצאות, חיפוש רחב יותר (חלק מהשירים לא מסווגים)
  let results = await query({ ...base, category: "music" });
  if (!results.length) results = await query(base);
  return results
    // אייפון לא מנגן OGG/FLAC; קטעים קצרים מ-10 שניות הם בדרך כלל אפקטים ולא שירים
    .filter((a) => (!a.filetype || a.filetype === "mp3") && (a.duration ?? 0) >= 10_000 && a.url?.startsWith("https://"))
    .slice(0, 20)
    .map(toTrack);
}

/** כתובת קובץ השמע של יצירה. נשלף מחדש מ-Openverse לפי מזהה, כדי שהשרת לא יהיה proxy פתוח */
export async function trackFileUrl(id: string): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const res = await fetch(`${API}${id}/`, { headers: { accept: "application/json" }, next: { revalidate: 3600 } });
  if (!res.ok) return null;
  const a = (await res.json()) as OpenverseAudio;
  return a.url?.startsWith("https://") ? a.url : null;
}
