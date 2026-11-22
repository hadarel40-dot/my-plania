"use client";

/**
 * "לשלוח לאינסטגרם": פותח בטלפון את חלון השיתוף עם הקבצים (סרטון, או כל התמונות של קרוסלה),
 * ומשם בוחרים אינסטגרם. באינסטגרם מוסיפים מוזיקה טרנדית, ומפרסמים או שומרים כטיוטה.
 * הכיתוב לא עובר בשיתוף, אז הוא מועתק קודם ללוח, ומדביקים אותו באינסטגרם.
 * אינסטגרם לא מאפשרת לאפליקציות חיצוניות לשמור ישר בטיוטות, וזו הדרך הכי קצרה.
 */
export type ShareResult = "shared" | "cancelled" | "unsupported";

export function canShareFiles(sample?: File) {
  if (typeof navigator === "undefined" || !navigator.canShare) return false;
  const probe = sample ?? new File([new Blob(["x"], { type: "image/jpeg" })], "x.jpg", { type: "image/jpeg" });
  try { return navigator.canShare({ files: [probe] }); } catch { return false; }
}

export async function shareToInstagram(files: File[], caption: string): Promise<ShareResult> {
  if (caption) await navigator.clipboard?.writeText(caption).catch(() => {});
  if (!canShareFiles(files[0]) || !navigator.canShare({ files })) return "unsupported";
  try {
    await navigator.share({ files });
    return "shared";
  } catch (e) {
    return (e as Error).name === "AbortError" ? "cancelled" : "unsupported";
  }
}

export const canvasToJpeg = (c: HTMLCanvasElement, name: string) =>
  new Promise<File>((resolve) => c.toBlob((b) => resolve(new File([b!], name, { type: "image/jpeg" })), "image/jpeg", 0.92));
