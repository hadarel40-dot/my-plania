"use client";
import { useEditor } from "@/stores/editor-store";
import { decodeAssetAudio } from "@/lib/audio/decode";
import { findSpeech } from "@/lib/audio/silence";
import { detectBeats } from "@/lib/audio/beats";
import { emojiOverlays } from "./emoji-keywords";
import type { SourceRange } from "./timeline-utils";
import { timelineDuration } from "./timeline-utils";

/** הקליפים לעבודה: הקליפ הנבחר, או כל הקליפים אם לא נבחר קליפ */
function targetClips() {
  const { timeline, selection } = useEditor.getState();
  const selected = selection?.kind === "clip" ? timeline.clips.filter((c) => c.id === selection.id) : [];
  return selected.length ? selected : timeline.clips;
}

/**
 * הסרת שתיקות: מנתח את הסאונד של כל קליפ ומשאיר רק את קטעי הדיבור.
 * מחזיר כמה שניות נחתכו.
 */
export async function removeSilences(onStatus: (s: string) => void): Promise<number> {
  const clips = targetClips();
  if (!clips.length) throw new Error("אין סרטונים בציר הזמן");
  const before = timelineDuration(useEditor.getState().timeline);
  const plan = new Map<string, SourceRange[]>();
  for (const [i, clip] of clips.entries()) {
    onStatus(`מנתח סאונד ${i + 1}/${clips.length}…`);
    const asset = useEditor.getState().assets[clip.assetId];
    if (!asset) continue;
    const samples = await decodeAssetAudio(asset);
    const speech = findSpeech(samples, { from: clip.in, to: clip.out });
    // בלי דיבור בכלל (למשל צילום בלי קול): לא מוחקים את הקליפ
    if (speech.length) plan.set(clip.id, speech);
  }
  useEditor.getState().applyCuts(plan);
  return Math.max(0, before - timelineDuration(useEditor.getState().timeline));
}

/**
 * סנכרון לקצב: כל חיתוך בין קליפים זז אל הביט הקרוב שלפניו במוזיקה, כך שהמעברים
 * נופלים בדיוק על הקצב. מחזיר את הטמפו שנמצא.
 */
export async function syncToBeat(onStatus: (s: string) => void): Promise<number> {
  const { timeline, assets } = useEditor.getState();
  // המוזיקה: קטע הסאונד הארוך ביותר בציר הזמן (אפקטים קצרים לא נחשבים)
  const music = [...timeline.audio]
    .filter((a) => a.out - a.in > 5 && assets[a.assetId])
    .sort((a, b) => b.out - b.in - (a.out - a.in))[0];
  if (!music) throw new Error("קודם מוסיפים מוזיקה בלשונית סאונד, ואז מסנכרנים אליה");
  if (timeline.clips.length < 2) throw new Error("צריך לפחות שני קליפים כדי שיהיו חיתוכים לסנכרן");

  onStatus("מנתח את המוזיקה…");
  const { bpm, beats } = detectBeats(await decodeAssetAudio(assets[music.assetId]));
  if (!beats.length) throw new Error("לא הצלחתי למצוא קצב במוזיקה הזאת");
  // זמני הביטים על ציר הזמן של הסרטון
  const onTimeline = beats.map((b) => music.start + b - music.in).filter((t) => t > 0 && t <= music.start + music.out - music.in);

  const plan = new Map<string, SourceRange[]>();
  let t = 0;
  for (const clip of timeline.clips) {
    const length = clip.out - clip.in;
    // הביט האחרון שלפני סוף הקליפ, אבל לא קצר מ-0.4 שניות
    const beat = [...onTimeline].reverse().find((b) => b <= t + length + 0.001 && b - t >= 0.4);
    const newLength = beat !== undefined ? beat - t : length;
    plan.set(clip.id, [{ start: clip.in, end: clip.in + newLength }]);
    t += newLength;
  }
  useEditor.getState().applyCuts(plan);
  return bpm;
}

/**
 * התאמה למסך עומד (רילס): מעביר את הסרטון ל-9:16, ובכל קליפ שצולם ביחס אחר
 * (למשל לרוחב) מוצא את הפנים ומשאיר אותן במרכז המסגרת. מחזיר בכמה קליפים נמצאו פנים.
 */
export async function autoReframe(onStatus: (s: string) => void): Promise<{ faces: number; reframed: number }> {
  const { setAspect } = useEditor.getState();
  setAspect("9:16");
  const { assets } = useEditor.getState();
  const target = 9 / 16;
  const clips = targetClips().filter((c) => {
    const a = assets[c.assetId];
    return a && a.width > 0 && a.height > 0 && Math.abs(a.width / a.height - target) > 0.05;
  });
  if (!clips.length) return { faces: 0, reframed: 0 };

  onStatus("טוען זיהוי פנים (פעם אחת)…");
  const { findFaceFocus } = await import("@/lib/ai/face-focus");
  const focus = new Map<string, { x: number; y: number }>();
  for (const [i, clip] of clips.entries()) {
    onStatus(`מחפש פנים ${i + 1}/${clips.length}…`);
    const f = await findFaceFocus(assets[clip.assetId], clip.in, clip.out).catch(() => null);
    if (f) focus.set(clip.id, f);
  }
  useEditor.getState().setClipFocus(focus);
  return { faces: focus.size, reframed: clips.length };
}

export interface AutoEditReport { done: string[]; skipped: string[] }

/**
 * עריכה אוטומטית מלאה, בלחיצה אחת: התאמה למסך עומד, הסרת שתיקות, כתוביות,
 * הוק מהמשפט הראשון, אימוג'ים לפי המילים, אפקטים, צבע וסנכרון לקצב (אם יש מוזיקה).
 * כל שלב שנכשל מדולג, והשאר ממשיך. התוצאה נשארת עריכה רגילה שאפשר לשנות.
 */
export async function autoEditAll(onStatus: (s: string) => void): Promise<AutoEditReport> {
  const report: AutoEditReport = { done: [], skipped: [] };
  const step = async (label: string, run: () => Promise<string | null>) => {
    try {
      const result = await run();
      if (result) report.done.push(result);
    } catch (e) {
      report.skipped.push(`${label}: ${e instanceof Error ? e.message : "נכשל"}`);
    }
  };
  if (!useEditor.getState().timeline.clips.length) throw new Error("קודם מעלים סרטון");
  // עובדים על כל הסרטון, גם אם נבחר קליפ
  useEditor.getState().select(null);

  await step("התאמה למסך עומד", async () => {
    const { reframed, faces } = await autoReframe((s) => onStatus(`1/5 · ${s}`));
    return reframed ? `הותאם למסך עומד${faces ? " עם הפנים במרכז" : ""}` : null;
  });
  await step("הסרת שתיקות", async () => {
    const removed = await removeSilences((s) => onStatus(`2/5 · ${s}`));
    return removed > 0.05 ? `הוסרו ${removed.toFixed(1)} שניות של שתיקה` : null;
  });
  await step("כתוביות", async () => {
    const unsubscribe = useEditor.subscribe((st) => { if (st.transcribeStatus) onStatus(`3/5 · ${st.transcribeStatus}`); });
    try {
      onStatus("3/5 · כתוביות…");
      const count = await useEditor.getState().autoTranscribe();
      return `נוספו ${count} כתוביות`;
    } finally {
      unsubscribe();
      // שגיאה כאן מופיעה בדוח של העריכה האוטומטית, לא צריך גם פס שגיאה
      useEditor.getState().setError(null);
    }
  });
  await step("עיצוב", async () => {
    onStatus("4/5 · מעצב…");
    const captions = useEditor.getState().timeline.captions;
    // ההוק: תחילת המשפט הראשון (עד 6 מילים), כדי שבשנייה הראשונה יהיה ברור על מה הסרטון
    const hook = captions.length
      ? captions.map((c) => c.text).join(" ").split(/\s+/).slice(0, 6).join(" ")
      : undefined;
    const emojis = emojiOverlays(captions);
    useEditor.getState().applyTemplate("talking", { hook, extraOverlays: emojis });
    return `נוספו הוק בפתיחה, ${emojis.length ? `${emojis.length} אימוג'ים, ` : ""}אפקטי סאונד וצבע`;
  });
  const hasMusic = useEditor.getState().timeline.audio.some((a) => a.out - a.in > 5);
  if (hasMusic) {
    await step("סנכרון לקצב", async () => {
      const bpm = await syncToBeat((s) => onStatus(`5/5 · ${s}`));
      return `המעברים סונכרנו למוזיקה (${bpm} BPM)`;
    });
  }
  return report;
}
