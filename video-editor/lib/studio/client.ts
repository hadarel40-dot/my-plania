"use client";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

/** פעולה בצד השרת (AI, אינסטגרם, דרייב). זורק עם ההודעה בעברית שהשרת החזיר */
export async function studioCall<T = Record<string, unknown>>(op: string, body: unknown = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/studio/${op}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new Error("אין חיבור לשרת. בדקי את האינטרנט ונסי שוב");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) throw new Error(data?.error || (res.status === 504 ? "לקח יותר מדי זמן, נסי שוב" : `שגיאה (${res.status})`));
  return data as T;
}

export const db = () => getSupabaseBrowser();

export function todayIL() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
}

export function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return new Intl.DateTimeFormat("he-IL", { timeZone: "Asia/Jerusalem", day: "numeric", month: "long" }).format(date);
}

export const num = (v: unknown) => (v === null || v === undefined || Number.isNaN(Number(v)) ? "אין נתון" : Number(v).toLocaleString("he-IL"));

/** כתובת הפרויקט בעורך, עם התבנית של הטיוטה (אם יש) כדי שהעורך ימליץ עליה */
export function editorHref(projectId: string, template?: string | null) {
  return template && !template.startsWith("car-") ? `/p/${projectId}?template=st-${template}` : `/p/${projectId}`;
}

/**
 * כפילויות: כמה טיוטות עם אותו רעיון מקבלות מספר גרסה לפי סדר היצירה (v1, v2...).
 * מחזיר מיפוי מזהה -> " · v2" (ריק אם אין כפילות).
 */
export function versionLabels(drafts: { id: string; idea: string; mode?: string; created_at?: string }[]) {
  const groups = new Map<string, typeof drafts>();
  for (const d of drafts) {
    const k = `${d.mode === "carousel" ? "c" : "r"}|${d.idea.trim().toLowerCase()}`;
    groups.set(k, [...(groups.get(k) ?? []), d]);
  }
  const out: Record<string, string> = {};
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    [...list].sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? "")).forEach((d, i) => { out[d.id] = ` · v${i + 1}`; });
  }
  return out;
}
