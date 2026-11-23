"use client";
import { studioCall } from "./client";
import type { ContentType, WeekGoal } from "./config";
import { errorText, logEvent } from "@/lib/telemetry";

/** אם בדרייב אין רוחב, גובה ואורך: קוראים אותם מהסרטון עצמו (הדפדפן מבקש רק את ההתחלה) */
const probe = (id: string) => new Promise<{ w: number; h: number; seconds: number }>((res, rej) => {
  const v = document.createElement("video");
  v.preload = "metadata"; v.muted = true;
  const t = setTimeout(() => { v.removeAttribute("src"); rej(new Error("הסרטון לא נקרא בזמן")); }, 25000);
  v.onloadedmetadata = () => { clearTimeout(t); res({ w: v.videoWidth, h: v.videoHeight, seconds: v.duration }); v.removeAttribute("src"); };
  v.onerror = () => { clearTimeout(t); rej(new Error("הסרטון לא נקרא")); };
  v.src = `/api/studio/drive-stream?id=${encodeURIComponent(id)}`;
});

/**
 * ריל מהדרייב, בלי לצלם: בוחרים סרטונים שמתאימים לרעיון (הם מתנגנים ישר מהדרייב),
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
  // הסרטונים לא מועתקים: הריל מתנגן ישר מהדרייב (drive:<id>), כך שגם סרטון אייפון גדול עובד
  step("מכינה את הסרטונים...");
  const clips = [];
  let firstError = "";
  for (const f of files) {
    try {
      // קודם מהסרטון עצמו (הדפדפן מסובב נכון סרטון אייפון לאורך), ואם לא מצליח, מהנתונים של הדרייב
      const m = await probe(f.id).catch((e) => {
        if (f.w && f.h && f.seconds > 0) return { w: Math.min(f.w, f.h), h: Math.max(f.w, f.h), seconds: f.seconds };
        throw e;
      });
      clips.push({ path: `drive:${f.id}`, w: m.w, h: m.h, seconds: +m.seconds.toFixed(2) });
    } catch (e) {
      firstError ||= (e as Error).message;
      logEvent("drive_reel_clip_failed", { stage: "metadata", file: f.name, mimeType: f.mimeType, error: errorText(e) });
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
