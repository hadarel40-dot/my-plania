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

export async function searchMusic(query: string, page = 1): Promise<MusicTrack[]> {
  const url = new URL(API);
  url.searchParams.set("q", query);
  url.searchParams.set("category", "music");
  url.searchParams.set("license_type", "commercial");
  // MP3 בלבד: אייפון לא מנגן OGG
  url.searchParams.set("extension", "mp3");
  url.searchParams.set("page_size", "20");
  url.searchParams.set("page", String(page));
  const res = await fetch(url, { headers: { accept: "application/json" }, next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`openverse ${res.status}`);
  const data = (await res.json()) as { results: OpenverseAudio[] };
  // קטעים קצרים מ-10 שניות הם בדרך כלל אפקטים ולא שירים
  return data.results.filter((a) => (a.duration ?? 0) >= 10_000 && a.url?.startsWith("https://")).map(toTrack);
}

/** כתובת קובץ השמע של יצירה. נשלף מחדש מ-Openverse לפי מזהה, כדי שהשרת לא יהיה proxy פתוח */
export async function trackFileUrl(id: string): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const res = await fetch(`${API}${id}/`, { headers: { accept: "application/json" }, next: { revalidate: 3600 } });
  if (!res.ok) return null;
  const a = (await res.json()) as OpenverseAudio;
  return a.url?.startsWith("https://") ? a.url : null;
}
