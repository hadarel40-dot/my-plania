"use client";
import type { MediaAsset } from "@/lib/editor/types";
import { loadFile, saveFile } from "@/lib/persistence";
import { logEvent } from "@/lib/telemetry";

/**
 * המקורות באיכות מלאה של סרטונים ארוכים. לענן עולה עותק מכווץ (מגבלה של 50MB לקובץ),
 * והמקור נשמר בזיכרון של הדפדפן בטלפון (IndexedDB), כדי שהייצוא יהיה באיכות של הצילום.
 */
const key = (assetId: string) => `orig:${assetId}`;

export async function saveOriginal(assetId: string, file: Blob): Promise<boolean> {
  try {
    // אם אין מספיק מקום בטלפון: ממשיכים עם העותק מהענן
    const est = await navigator.storage?.estimate?.().catch(() => null);
    if (est?.quota && est.usage !== undefined && est.quota - est.usage < file.size * 1.2) {
      logEvent("original_no_space", { size: file.size, free: est.quota - est.usage });
      return false;
    }
    await navigator.storage?.persist?.().catch(() => false);
    await saveFile(key(assetId), file);
    const ok = !!(await loadFile(key(assetId)));
    logEvent("original_saved", { size: file.size, ok });
    return ok;
  } catch {
    return false;
  }
}

/** הנכסים עם כתובות של המקורות (כשהם שמורים במכשיר הזה). release משחרר את הכתובות */
export async function withOriginals(assets: Record<string, MediaAsset>) {
  const urls: string[] = [];
  const out: Record<string, MediaAsset> = { ...assets };
  for (const a of Object.values(assets)) {
    if (!a.hasOriginal) continue;
    const blob = await loadFile(key(a.id)).catch(() => undefined);
    if (!blob) continue;
    const url = URL.createObjectURL(blob);
    urls.push(url);
    out[a.id] = { ...a, url };
  }
  if (urls.length) logEvent("export_from_originals", { count: urls.length });
  return { assets: out, release: () => urls.forEach((u) => URL.revokeObjectURL(u)) };
}
