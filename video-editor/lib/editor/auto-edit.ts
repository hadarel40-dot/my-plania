"use client";
import { useEditor } from "@/stores/editor-store";
import { decodeAssetAudio } from "@/lib/audio/decode";
import { findSpeech } from "@/lib/audio/silence";
import { detectBeats } from "@/lib/audio/beats";
import { emojiOverlays } from "./emoji-keywords";
import { presetById } from "./overlay-presets";
import { CLIP_STYLES } from "./clip-styles";
import { layoutClips, uid } from "./timeline-utils";
import type { Overlay } from "./types";
import { MUSIC_MOODS, type MusicMood } from "@/lib/music/moods";
import type { SmartPlan, SmartPlanRequest, VibePlan, VibePlanRequest } from "@/lib/ai/smart-plan";
import { pickShots, rankShots, sampleClip, type FrameSample, type Shot } from "@/lib/video/analyze";
import { addLibraryTrack, searchLibrary } from "@/lib/music/add";
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
export type AutoEditMode = "auto" | "talking" | "vibe";

export async function autoEditAll(onStatus: (s: string) => void, mode: AutoEditMode = "auto"): Promise<AutoEditReport> {
  if (!useEditor.getState().timeline.clips.length) throw new Error("קודם מעלים סרטון");
  if (mode === "auto") {
    onStatus("בודק אם מדברים בסרטון…");
    mode = (await looksLikeTalking()) ? "talking" : "vibe";
  }
  if (mode === "vibe") return autoEditVibe(onStatus);
  return autoEditTalking(onStatus);
}

/**
 * האם זה סרטון דיבור: יש קטעי דיבור עם הפסקות ביניהם, על לפחות שליש מהזמן.
 * סאונד רציף (מוזיקה, רוח, רחוב) או בלי פס קול בכלל = סרטון אווירה.
 */
async function looksLikeTalking(): Promise<boolean> {
  const { timeline, assets } = useEditor.getState();
  let total = 0, speech = 0, segments = 0;
  for (const clip of timeline.clips) {
    const len = clip.out - clip.in;
    total += len;
    const asset = assets[clip.assetId];
    if (!asset) continue;
    try {
      const ranges = findSpeech(await decodeAssetAudio(asset), { from: clip.in, to: clip.out });
      const covered = ranges.reduce((sum, r) => sum + r.end - r.start, 0);
      if (ranges.length === 1 && covered >= len * 0.95) continue;
      speech += covered;
      segments += ranges.length;
    } catch { /* אין פס קול */ }
  }
  return total > 0 && speech / total > 0.3 && segments >= 2;
}

async function autoEditTalking(onStatus: (s: string) => void): Promise<AutoEditReport> {
  const report: AutoEditReport = { done: [], skipped: [] };
  const step = async (label: string, run: () => Promise<string | null>) => {
    try {
      const result = await run();
      if (result) report.done.push(result);
    } catch (e) {
      report.skipped.push(`${label}: ${e instanceof Error ? e.message : "נכשל"}`);
    }
  };
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
  const notes = useEditor.getState().notes;
  const noCaptions = /בלי כתוביות|ללא כתוביות/.test(notes);
  if (noCaptions) report.done.push("בלי כתוביות, לפי ההוראות");
  if (!noCaptions) await step("כתוביות", async () => {
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
  const smart = !!useEditor.getState().cloud?.smartEdit && useEditor.getState().timeline.captions.length > 0;
  let designed = false;
  if (smart) {
    await step("עריכה חכמה", async () => {
      onStatus("4/5 · Claude עורך את הסרטון…");
      const result = await applySmartPlan();
      designed = true;
      return result;
    });
  }
  if (!designed) {
    await step("עיצוב", async () => {
      onStatus("4/5 · מעצב…");
      const captions = useEditor.getState().timeline.captions;
      // ההוק: תחילת המשפט הראשון (עד 6 מילים), כדי שבשנייה הראשונה יהיה ברור על מה הסרטון
      const hook = captions.length
        ? captions.map((c) => c.text).join(" ").split(/\s+/).slice(0, 6).join(" ")
        : undefined;
      const emojis = /בלי אימוג|ללא אימוג/.test(notes) ? [] : emojiOverlays(captions);
      useEditor.getState().applyTemplate("talking", { hook, extraOverlays: emojis });
      return `נוספו הוק בפתיחה, ${emojis.length ? `${emojis.length} אימוג'ים, ` : ""}אפקטי סאונד וצבע`;
    });
  }
  const hasMusic = useEditor.getState().timeline.audio.some((a) => a.out - a.in > 5);
  if (hasMusic) {
    await step("סנכרון לקצב", async () => {
      const bpm = await syncToBeat((s) => onStatus(`5/5 · ${s}`));
      return `המעברים סונכרנו למוזיקה (${bpm} BPM)`;
    });
  }
  return report;
}

/**
 * עריכה חכמה: שולח את התמלול ל-Claude (דרך השרת) ומחיל את התוכנית שחזרה:
 * מוחק טייקים כפולים ומילוי, מוסיף הוק, אימוג'ים, קריאה לפעולה, סגנון וצבע.
 * הכל נשאר עריכה רגילה שאפשר לשנות.
 */
async function applySmartPlan(): Promise<string> {
  const { timeline, setTitle, title } = useEditor.getState();
  const captions = [...timeline.captions].sort((a, b) => a.start - b.start);
  const body: SmartPlanRequest = {
    segments: captions.map((c) => ({ start: c.start, end: c.end, text: c.text })),
    duration: timelineDuration(timeline),
    hasMusic: timeline.audio.some((a) => a.out - a.in > 5),
    notes: useEditor.getState().notes,
  };
  const response = await fetch("/api/smart-edit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new Error(data?.error ?? "השרת לא החזיר תוכנית");
  const plan = data as SmartPlan;

  // 1. חיתוך המקטעים שנבחרו (לפי זמני ציר הזמן), והכתוביות זזות איתם
  const removeIds = new Set(plan.remove_segments.map((i) => captions[i]?.id).filter(Boolean));
  const emojiIds = plan.emojis.map((e) => ({ id: captions[e.segment]?.id, emoji: e.emoji })).filter((e) => e.id);
  const ranges = captions.filter((c) => removeIds.has(c.id)).map((c) => ({ start: c.start, end: c.end }));
  const before = timelineDuration(useEditor.getState().timeline);
  if (ranges.length) useEditor.getState().applyCuts(timelineRangesToPlan(ranges));
  const cut = Math.max(0, before - timelineDuration(useEditor.getState().timeline));

  // 2. אימוג'ים לפי הכתוביות ששרדו (המזהים נשמרים בחיתוך)
  const after = useEditor.getState().timeline;
  const base = presetById("emoji-fire").fields;
  const positions = [{ x: 0.78, y: 0.3 }, { x: 0.22, y: 0.32 }];
  const emojis: Overlay[] = emojiIds.flatMap(({ id, emoji }, i) => {
    const cap = after.captions.find((c) => c.id === id);
    return cap ? [{ ...base, ...positions[i % 2], id: uid("ovl"), text: emoji, start: cap.start, end: Math.max(cap.end, cap.start + 1.5), fromTemplate: true }] : [];
  });
  // 3. קריאה לפעולה בשלוש השניות האחרונות
  const end = timelineDuration(after);
  if (plan.cta.trim()) {
    const cta = presetById("typewriter");
    emojis.push({ ...cta.fields, id: uid("ovl"), text: plan.cta.trim(), start: Math.max(0, end - 3), end, fromTemplate: true });
  }

  // 4. תבנית, הוק, סגנון כתוביות וצבע
  const { applyTemplate, styleAllCaptions, setClipLook } = useEditor.getState();
  applyTemplate(plan.template, { hook: plan.hook, extraOverlays: emojis, hookOnly: true });
  styleAllCaptions({ preset: plan.caption_style, accent: plan.accent });
  const style = CLIP_STYLES.find((st) => st.id === plan.color_style);
  if (style) for (const clip of useEditor.getState().timeline.clips) setClipLook(clip.id, { ...clip.look, filter: style.look(0.7).filter });
  if (!title || title === "פרויקט חדש") setTitle(plan.title);

  const parts = [cut > 0.05 ? `נחתכו ${cut.toFixed(1)} שניות (טייקים חוזרים ומילוי)` : null, `הוק: "${plan.hook}"`];
  return [plan.summary, ...parts.filter(Boolean)].join(" · ");
}

/** טווחי זמן בציר הזמן שצריך להסיר, מתורגמים לקטעים שנשארים בכל קליפ (בזמן המקור) */
function timelineRangesToPlan(remove: SourceRange[]) {
  const plan = new Map<string, SourceRange[]>();
  for (const { clip, start, end } of layoutClips(useEditor.getState().timeline.clips)) {
    const hits = remove
      .map((r) => ({ start: Math.max(r.start, start), end: Math.min(r.end, end) }))
      .filter((r) => r.end - r.start > 0.05)
      .sort((a, b) => a.start - b.start);
    if (!hits.length) continue;
    const keep: SourceRange[] = [];
    let t = start;
    for (const h of hits) {
      if (h.start > t) keep.push({ start: clip.in + (t - start), end: clip.in + (h.start - start) });
      t = Math.max(t, h.end);
    }
    if (t < end) keep.push({ start: clip.in + (t - start), end: clip.in + (end - start) });
    plan.set(clip.id, keep);
  }
  return plan;
}

/**
 * סרטון אווירה (בלי דיבור): בוחר את הרגעים היפים מכל הצילומים, מסדר אותם,
 * מוסיף מוזיקה שמתאימה ומסנכרן את החיתוכים לקצב. עם Claude, הוא רואה את
 * הקטעים ובוחר כמו עורך; בלעדיו, הבחירה לפי חדות, תאורה, צבע ותנועה.
 */
async function autoEditVibe(onStatus: (s: string) => void): Promise<AutoEditReport> {
  const report: AutoEditReport = { done: ["זוהה סרטון אווירה: בוחר את הקטעים הכי יפים"], skipped: [] };
  useEditor.getState().select(null);
  try {
    const { reframed } = await autoReframe((st) => onStatus(`1/5 · ${st}`));
    if (reframed) report.done.push("הותאם למסך עומד");
  } catch (e) {
    report.skipped.push(`התאמה למסך עומד: ${e instanceof Error ? e.message : "נכשל"}`);
  }

  // 1. ניתוח כל הצילומים
  const { timeline, assets } = useEditor.getState();
  const clips = timeline.clips;
  const footage = clips.reduce((sum, c) => sum + c.out - c.in, 0);
  const step = Math.min(1, Math.max(0.25, footage / 200));
  const expected = Math.max(1, Math.round(footage / step));
  let done = 0;
  const samples: FrameSample[] = [];
  for (const clip of clips) {
    const asset = assets[clip.assetId];
    if (!asset) continue;
    samples.push(...await sampleClip(asset, clip.id, clip.in, clip.out, step, () => {
      done++;
      onStatus(`2/5 · מנתח את הצילומים ${Math.min(99, Math.round((done / expected) * 100))}%`);
    }));
  }
  if (!samples.length) throw new Error("לא הצלחתי לקרוא את הסרטונים");

  // 2. אורך כל קטע: 4 ביטים אם כבר יש מוזיקה, אחרת כשתי שניות
  const music = musicClip();
  let shotLen = 1.8;
  if (music) {
    const { bpm } = detectBeats(await decodeAssetAudio(useEditor.getState().assets[music.assetId]));
    if (bpm) shotLen = Math.min(2.8, Math.max(1.2, (60 / bpm) * 4));
  }
  const target = footage < 8 ? footage * 0.85 : Math.min(15, Math.max(6, footage * 0.5));
  const shots = rankShots(samples, clips, Math.min(shotLen, footage), step);
  if (!shots.length) throw new Error("הצילומים קצרים מדי לבחירת קטעים");
  const clipOrder = clips.map((c) => c.id);

  // 3. בחירה: Claude רואה את המועמדים הטובים ובוחר; בלעדיו, לפי הציון
  let chosen = pickShots(shots, target, clipOrder);
  let plan: VibePlan | null = null;
  if (useEditor.getState().cloud?.smartEdit) {
    onStatus("3/5 · Claude בוחר את הקטעים הכי יפים…");
    try {
      const candidates = pickShots(shots, target * 2.2, clipOrder).slice(0, 24);
      const body: VibePlanRequest = {
        shots: candidates.map((c) => ({ id: c.id, start: c.start, end: c.end, clip: clipOrder.indexOf(c.clipId), image: c.thumb })),
        target,
        hasMusic: !!music,
        notes: useEditor.getState().notes,
      };
      const res = await fetch("/api/smart-vibe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) throw new Error(data?.error ?? "השרת לא החזיר תוכנית");
      plan = data as VibePlan;
      const byId = new Map(candidates.map((c) => [c.id, c]));
      const ordered = plan.order.map((id) => byId.get(id)).filter((c): c is Shot => !!c);
      if (ordered.length >= 2) chosen = ordered;
      if (plan.summary) report.done.push(plan.summary);
    } catch (e) {
      report.skipped.push(`בחירה עם Claude: ${e instanceof Error ? e.message : "נכשל"} (נבחר לפי איכות התמונה)`);
    }
  }
  useEditor.getState().arrangeShots(chosen);
  const length = chosen.reduce((sum, c) => sum + c.end - c.start, 0);
  report.done.push(`נבחרו ${chosen.length} קטעים (${length.toFixed(1)} שניות) מתוך ${footage.toFixed(0)} שניות צילום`);

  // 4. מוזיקה: אם אין, מוסיפים מהספרייה לפי האווירה; הסאונד המקורי מושתק
  const notes = useEditor.getState().notes;
  if (!music && /בלי מוזיקה|ללא מוזיקה|לא לשים מוזיקה|בלי שיר/.test(notes)) {
    report.done.push("לא נוספה מוזיקה, לפי ההוראות");
  } else if (!music) {
    onStatus("4/5 · מחפש מוזיקה מתאימה…");
    try {
      const mood = plan?.music ?? moodFromNotes(notes) ?? "chill";
      const tracks = await searchLibrary(MUSIC_MOODS[mood]);
      const track = tracks.find((t) => t.duration >= length) ?? tracks[0];
      if (!track) throw new Error("לא נמצא שיר");
      await addLibraryTrack(track, { select: false });
      report.done.push(`נוספה מוזיקה: ${track.title}${track.needsCredit ? " (צריך קרדיט בתיאור, ראו בלשונית סאונד)" : ""}`);
    } catch (e) {
      report.skipped.push(`מוזיקה: ${e instanceof Error ? e.message : "נכשל"}. אפשר להוסיף בלשונית סאונד`);
    }
  }
  if (musicClip()) {
    const { setClipVolume } = useEditor.getState();
    for (const clip of useEditor.getState().timeline.clips) setClipVolume(clip.id, 0);
    try {
      const bpm = await syncToBeat((st) => onStatus(`5/5 · ${st}`));
      report.done.push(`החיתוכים סונכרנו לקצב (${bpm} BPM)`);
    } catch (e) {
      report.skipped.push(`סנכרון לקצב: ${e instanceof Error ? e.message : "נכשל"}`);
    }
  }

  // 5. צבע, טקסט עדין בפתיחה ושם
  const style = CLIP_STYLES.find((st) => st.id === (plan?.color_style ?? "cinematic"));
  const { setClipLook, setTitle, title } = useEditor.getState();
  if (style) for (const clip of useEditor.getState().timeline.clips) setClipLook(clip.id, { ...clip.look, filter: style.look(0.6).filter });
  if (plan?.text.trim()) {
    const preset = presetById("typewriter");
    useEditor.setState((st) => ({
      timeline: { ...st.timeline, overlays: [...st.timeline.overlays, { ...preset.fields, y: 0.16, id: uid("ovl"), text: plan!.text.trim(), start: 0.3, end: 3, fromTemplate: true }] },
    }));
  }
  if (plan?.title && (!title || title === "פרויקט חדש")) setTitle(plan.title);
  report.done.push(`צבע: ${style?.label ?? "מקורי"}`);
  return report;
}

/** בלי Claude: מצב הרוח של המוזיקה לפי מילים בהוראות */
function moodFromNotes(notes: string): MusicMood | null {
  const words: [RegExp, MusicMood][] = [
    [/רגוע|שקט|לואו.?פיי|chill/i, "chill"],
    [/שמח|קליל|עליז/, "happy"],
    [/אנרגטי|קצבי|מקפיץ|אנרגיה/, "energetic"],
    [/רומנטי|אהבה|פסנתר/, "romantic"],
    [/דרמטי|אפי|קולנועי/, "cinematic"],
    [/השראה|מעורר/, "inspiring"],
    [/היפ.?הופ|ראפ/, "hiphop"],
    [/פופ/, "pop"],
    [/אקוסטי|גיטרה/, "acoustic"],
  ];
  return words.find(([re]) => re.test(notes))?.[1] ?? null;
}

/** קטע המוזיקה (הסאונד הארוך ביותר בציר הזמן), אם יש */
function musicClip() {
  const { timeline, assets } = useEditor.getState();
  return [...timeline.audio]
    .filter((a) => a.out - a.in > 5 && assets[a.assetId])
    .sort((a, b) => b.out - b.in - (a.out - a.in))[0];
}
