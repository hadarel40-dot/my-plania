import "server-only";

/**
 * קריאות ל-fal מהשרת, דרך ה-Queue REST API. בניגוד ל-proxy, כאן השרת עצמו
 * שולח את העבודה ושומר את מזהה הבקשה, כך שהיא לא תלויה בדף פתוח.
 * FAL_QUEUE_URL קיים רק כדי לכוון לשרת בדיקה.
 */
const QUEUE_URL = process.env.FAL_QUEUE_URL || "https://queue.fal.run";

const headers = () => ({
  Authorization: `Key ${process.env.FAL_KEY}`,
  "Content-Type": "application/json",
});

export interface Submitted {
  request_id: string;
  status_url: string;
  response_url: string;
}

export type FalStatus = "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED";

async function errorText(res: Response) {
  const body = await res.text().catch(() => "");
  try {
    const j = JSON.parse(body);
    const detail = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail ?? j);
    return `fal ${res.status}: ${detail}`.slice(0, 500);
  } catch {
    return `fal ${res.status}: ${body}`.slice(0, 500);
  }
}

export async function submitJob(model: string, input: Record<string, unknown>): Promise<Submitted> {
  const res = await fetch(`${QUEUE_URL}/${model}`, { method: "POST", headers: headers(), body: JSON.stringify(input) });
  if (!res.ok) throw new Error(await errorText(res));
  return res.json();
}

export async function getStatus(statusUrl: string): Promise<FalStatus> {
  const res = await fetch(statusUrl, { headers: headers(), cache: "no-store" });
  if (!res.ok) throw new Error(await errorText(res));
  return (await res.json()).status;
}

/** תוצאת עבודה שהסתיימה. אם המודל נכשל, fal מחזיר כאן קוד שגיאה */
export async function getResult(responseUrl: string): Promise<unknown> {
  const res = await fetch(responseUrl, { headers: headers(), cache: "no-store" });
  if (!res.ok) throw new Error(await errorText(res));
  return res.json();
}
