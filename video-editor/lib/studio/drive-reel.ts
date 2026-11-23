"use client";
import { studioCall } from "./client";
import { driveClipToLibrary } from "./drive-clip";
import type { ContentType, WeekGoal } from "./config";
import { errorText, logEvent } from "@/lib/telemetry";

/**
 * ריל מהדרייב, בלי לצלם: בוחרים סרטונים שמתאימים לרעיון, ולוקחים מכל אחד את הקטע שצריך,
 * והריל נבנה כמו "ריל מהסרטונים שלי" (כרטיסים לפי הרעיון, הגרסה הרגועה).
 * itemId: פריט שכבר בלוח, שהריל מתחבר אליו.
 */
export async function buildDriveReel(input: {
  account: string; idea: string; hook: string; title: string; content_type: ContentType; date: string;
  itemId?: string; exclude?: string[]; onStep?: (s: string) => void; goal?: WeekGoal;
}) {
  const step = input.onStep ?? (() => {});
  step("בוחרת סרטונים מהדרייב...");
  const { files } = await studioCall<{ files: { id: string; name: string; mimeType: string; w: number; h: number; seconds: number }[] }>("drive-pick", { idea: input.idea, hook: input.hook, count: 5, exclude: input.exclude ?? [] });
  // קצב: אורכים שונים לכל רגע, פתיחה קצרה שתופסת, וסוף קצת יותר ארוך שנושם
  const RHYTHM = [2.2, 2.6, 2.0, 2.4, 2.9];
  // מכל סרטון נלקח הרגע הכי טוב (חד, מואר, עם תנועה בלי רעידות), מומר לקובץ קל ונשמר בספרייה.
  // סרטוני אייפון הם 4K ו-HDR: בלי ההמרה הם כבדים לנגינה ונראים דהויים
  const clips = [];
  let firstError = "";
  for (const [i, f] of files.entries()) {
    try {
      clips.push(await driveClipToLibrary(f.id, { seconds: RHYTHM[i % RHYTHM.length], onProgress: (p) => step(`בוחרת את הרגע הכי טוב ומכינה סרטון ${i + 1} מתוך ${files.length} (${Math.round(p * 100)}%)`) }));
    } catch (e) {
      firstError ||= (e as Error).message;
      logEvent("drive_reel_clip_failed", { stage: "convert", file: f.name, mimeType: f.mimeType, error: errorText(e) });
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
