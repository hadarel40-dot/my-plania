"use client";
import { db, studioCall } from "./client";
import { MEDIA_BUCKET } from "@/lib/supabase/env";
import type { ContentType, WeekGoal } from "./config";
import { errorText, logEvent } from "@/lib/telemetry";

/** מוריד קובץ מהדרייב דרך השרת, בחתיכות של 4MB */
async function downloadDrive(id: string, mimeType: string) {
  const parts: ArrayBuffer[] = [];
  let start = 0;
  for (let guard = 0; guard < 60; guard++) {
    const res = await fetch(`/api/studio/drive-file?id=${encodeURIComponent(id)}&start=${start}`, { cache: "no-store" });
    if (res.status === 416) break;
    if (!res.ok) throw new Error(`לא הצלחתי להוריד סרטון מהדרייב (${res.status})`);
    const buf = await res.arrayBuffer();
    parts.push(buf);
    start += buf.byteLength;
    const total = Number(res.headers.get("x-total-size")) || 0;
    if (!buf.byteLength || (total && start >= total)) break;
  }
  return new Blob(parts, { type: mimeType || "video/mp4" });
}

const meta = (blob: Blob) => new Promise<{ w: number; h: number; seconds: number }>((res, rej) => {
  const url = URL.createObjectURL(blob);
  const v = document.createElement("video");
  v.preload = "metadata"; v.muted = true;
  const t = setTimeout(() => { rej(new Error("הסרטון לא נקרא בזמן")); URL.revokeObjectURL(url); }, 20000);
  v.onloadedmetadata = () => { clearTimeout(t); res({ w: v.videoWidth, h: v.videoHeight, seconds: v.duration }); URL.revokeObjectURL(url); };
  v.onerror = () => { clearTimeout(t); rej(new Error("סרטון מהדרייב לא נקרא")); URL.revokeObjectURL(url); };
  v.src = url;
});

/**
 * ריל מהדרייב, בלי לצלם: בוחרים סרטונים שמתאימים לרעיון, מעבירים אותם לספרייה,
 * והריל נבנה כמו "ריל מהסרטונים שלי" (כרטיסים לפי הרעיון, הגרסה הרגועה).
 * itemId: פריט שכבר בלוח, שהריל מתחבר אליו.
 */
export async function buildDriveReel(input: {
  account: string; idea: string; hook: string; title: string; content_type: ContentType; date: string;
  itemId?: string; exclude?: string[]; onStep?: (s: string) => void; goal?: WeekGoal;
}) {
  const step = input.onStep ?? (() => {});
  step("בוחרת סרטונים מהדרייב...");
  const { files } = await studioCall<{ files: { id: string; name: string; mimeType: string; w: number; h: number; seconds: number }[] }>("drive-pick", { idea: input.idea, hook: input.hook, count: 4, exclude: input.exclude ?? [] });
  const { data: u } = await db().auth.getUser();
  if (!u.user) throw new Error("צריך להתחבר מחדש");
  const clips = [];
  let firstError = "";
  for (const [i, f] of files.entries()) {
    step(`מעבירה סרטון ${i + 1} מתוך ${files.length} מהדרייב...`);
    let stage = "download";
    try {
      const blob = await downloadDrive(f.id, f.mimeType);
      stage = "metadata";
      // הנתונים מהדרייב (רוחב, גובה, אורך) הם גיבוי, אם הדפדפן לא קורא את הסרטון
      const m = await meta(blob).catch((e) => {
        if (f.w && f.h && f.seconds > 0) return { w: f.w, h: f.h, seconds: f.seconds };
        throw e;
      });
      stage = "upload";
      const ext = (f.name.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "") || "mp4";
      const path = `${u.user.id}/studio/drive/${f.id}-${Date.now()}.${ext}`;
      const { error } = await db().storage.from(MEDIA_BUCKET).upload(path, blob, { contentType: f.mimeType || "video/mp4" });
      if (error) throw new Error(error.message);
      clips.push({ path, w: m.w, h: m.h, seconds: +m.seconds.toFixed(2) });
    } catch (e) {
      // סרטון שלא עבר מדלגים עליו וממשיכים עם השאר. נרשם ביומן כדי שאפשר יהיה לדעת למה
      firstError ||= (e as Error).message;
      logEvent("drive_reel_clip_failed", { stage, file: f.name, mimeType: f.mimeType, error: errorText(e) });
    }
  }
  if (!clips.length) throw new Error(`לא הצלחתי להעביר סרטונים מהדרייב${firstError ? `: ${firstError}` : ""}`);
  step("כותבת את הכרטיסים והכיתוב...");
  const { draftId } = await studioCall<{ draftId: string }>("upload-reel", {
    account: input.account, idea: input.idea, hook: input.hook, title: input.title, content_type: input.content_type,
    date: input.date, clips, transcript: [], itemId: input.itemId, goal: input.goal,
  });
  return { draftId, used: files.map((f) => f.id) };
}
