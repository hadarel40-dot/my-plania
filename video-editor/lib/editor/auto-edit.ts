"use client";
import { useEditor } from "@/stores/editor-store";
import { decodeAssetAudio } from "@/lib/audio/decode";
import { findSpeech } from "@/lib/audio/silence";
import { detectBeats } from "@/lib/audio/beats";
import { emojiOverlays } from "./emoji-keywords";
import { presetById } from "./overlay-presets";
import { CLIP_STYLES } from "./clip-styles";
import { layoutClips, uid } from "./timeline-utils";
import type { CaptionPreset, Overlay, Timeline } from "./types";
import { MUSIC_MOODS, type MusicMood } from "@/lib/music/moods";
import type { SmartPlan, SmartPlanRequest, VibePlan, VibePlanRequest } from "@/lib/ai/smart-plan";
import { pickShots, rankShots, sampleClip, type FrameSample, type Shot } from "@/lib/video/analyze";
import { addBuiltinTrack, addLibraryTrack, searchLibrary } from "@/lib/music/add";
import { builtinForMood } from "@/lib/music/builtin";
import { errorText, logEvent } from "@/lib/telemetry";
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
  const musicAsset = assets[music.assetId];
  // למוזיקה מובנית הקצב ידוע והיא מתחילה על ביט; אחרת מזהים מהסאונד
  const { bpm, beats } = musicAsset.bpm
    ? { bpm: musicAsset.bpm, beats: Array.from({ length: Math.ceil(musicAsset.duration * musicAsset.bpm / 60) }, (_, i) => +(i * 60 / musicAsset.bpm!).toFixed(3)) }
    : detectBeats(await decodeAssetAudio(musicAsset));
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

/** גרסה של העריכה האוטומטית, לבחירה */
export interface EditOption {
  id: string;
  title: string;
  description: string;
  timeline: Timeline;
}

export interface AutoEditResult {
  report: AutoEditReport;
  options: EditOption[];
}

/**
 * עריכה אוטומטית שמחזירה כמה גרסאות לבחירה. העבודה הכבדה (ניתוח, כתוביות, Claude)
 * נעשית פעם אחת, ומהתוצאה נבנות גרסאות שונות בקצב, במוזיקה ובעיצוב. הראשונה מוחלת.
 */
export async function autoEditAll(onStatus: (s: string) => void, mode: AutoEditMode = "auto"): Promise<AutoEditResult> {
  if (!useEditor.getState().timeline.clips.length) throw new Error("קודם מעלים סרטון");
  const auto = mode === "auto";
  if (auto) {
    onStatus("בודק אם מדברים בסרטון…");
    mode = (await looksLikeTalking()) ? "talking" : "vibe";
  }
  const started = Date.now();
  try {
    const result = mode === "vibe" ? await autoEditVibe(onStatus) : await autoEditTalking(onStatus);
    if (auto && mode === "talking") result.report.done.unshift("זוהה סרטון דיבור (אם זה סרטון אווירה, בחרו \"אווירה\" ונסו שוב)");
    if (result.options[0]) useEditor.setState({ timeline: result.options[0].timeline, selection: null });
    logEvent("auto_edit_done", { mode, auto, ms: Date.now() - started, options: result.options.length, skipped: result.report.skipped });
    return result;
  } catch (e) {
    logEvent("auto_edit_failed", { mode, auto, ms: Date.now() - started, error: errorText(e) });
    throw e;
  }
}

/**
 * האם זה סרטון דיבור. כמה צילומים קצרים הם כמעט תמיד סרטון אווירה (גם אם שומעים
 * ברקע אנשים מדברים), ולכן שם צריך דיבור ברור ורציף. סרטון ארוך אחד הוא דיבור אם
 * יש קטעי דיבור עם הפסקות על לפחות שליש מהזמן. סאונד רציף או בלי קול = אווירה.
 */
async function looksLikeTalking(): Promise<boolean> {
  const clips = useEditor.getState().timeline.clips;
  const avg = clips.reduce((s, c) => s + c.out - c.in, 0) / Math.max(1, clips.length);
  const manyShortClips = clips.length >= 3 && avg <= 20;
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
  const ratio = total > 0 ? speech / total : 0;
  const talking = manyShortClips ? ratio > 0.75 && segments >= clips.length * 2 : ratio > 0.3 && segments >= 2;
  logEvent("auto_edit_detect", { clips: clips.length, avg: +avg.toFixed(1), ratio: +ratio.toFixed(2), segments, talking });
  return talking;
}

/** עיצוב של גרסה בסרטון דיבור */
interface TalkingLook { template: string; preset: CaptionPreset; accent: string; color: string; title: string; description: string }

const TALKING_LOOKS: TalkingLook[] = [
  { template: "talking", preset: "word-pop", accent: "#facc15", color: "vivid", title: "קלאסי", description: "מילה קופצת בצהוב, צבעים חיים" },
  { template: "tips", preset: "highlight-box", accent: "#22d3ee", color: "warm", title: "נקי ומסודר", description: "מילה במסגרת תכלת, גוון חם" },
  { template: "energy", preset: "one-word", accent: "#f472b6", color: "cinematic", title: "אנרגטי", description: "מילה אחת גדולה בכל פעם, הרבה אפקטים" },
  { template: "before-after", preset: "karaoke", accent: "#a3e635", color: "cold", title: "רגוע", description: "קריוקי בירוק, גוון קר" },
];

async function autoEditTalking(onStatus: (s: string) => void): Promise<AutoEditResult> {
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

  // Claude: חיתוך טייקים ותוכן (הוק, אימוג'ים, קריאה לפעולה), פעם אחת לכל הגרסאות
  let smart: SmartCuts | null = null;
  if (useEditor.getState().cloud?.smartEdit && useEditor.getState().timeline.captions.length > 0) {
    await step("עריכה חכמה", async () => {
      onStatus("4/5 · Claude עורך את הסרטון…");
      smart = await smartCuts();
      return smart.summary;
    });
  }
  const s0 = smart as SmartCuts | null;
  const captions = useEditor.getState().timeline.captions;
  const hook = s0?.hook ?? (captions.length ? captions.map((c) => c.text).join(" ").split(/\s+/).slice(0, 6).join(" ") : undefined);
  const extras = s0?.extras ?? (/בלי אימוג|ללא אימוג/.test(notes) ? [] : emojiOverlays(captions));

  // הגרסאות: הראשונה לפי Claude (אם יש), והשאר בסגנונות אחרים
  const looks: TalkingLook[] = [];
  if (s0) looks.push({ template: s0.plan.template, preset: s0.plan.caption_style, accent: s0.plan.accent, color: s0.plan.color_style, title: "הבחירה של Claude", description: "הסגנון ש-Claude בחר לתוכן" });
  for (const l of TALKING_LOOKS) if (looks.length < 3 && !looks.some((x) => x.template === l.template)) looks.push(l);

  onStatus("5/5 · בונה גרסאות…");
  const base = useEditor.getState().timeline;
  const options: EditOption[] = [];
  for (const [i, look] of looks.entries()) {
    useEditor.setState({ timeline: base });
    const { applyTemplate, styleAllCaptions, setClipLook } = useEditor.getState();
    applyTemplate(look.template, { hook, extraOverlays: extras.map((o) => ({ ...o, id: uid("ovl") })), hookOnly: !!s0 });
    styleAllCaptions({ preset: look.preset, accent: look.accent });
    const style = CLIP_STYLES.find((st) => st.id === look.color);
    if (style) for (const clip of useEditor.getState().timeline.clips) setClipLook(clip.id, { ...clip.look, filter: style.look(0.7).filter });
    if (musicClip()) await syncToBeat(() => undefined).catch(() => undefined);
    options.push({ id: `talk-${i}`, title: look.title, description: look.description, timeline: useEditor.getState().timeline });
  }
  report.done.push(`נבנו ${options.length} גרסאות לבחירה`);
  return { report, options };
}

/**
 * עריכה חכמה: שולח את התמלול ל-Claude (דרך השרת) ומחיל את התוכנית שחזרה:
 * מוחק טייקים כפולים ומילוי, מוסיף הוק, אימוג'ים, קריאה לפעולה, סגנון וצבע.
 * הכל נשאר עריכה רגילה שאפשר לשנות.
 */
interface SmartCuts { plan: SmartPlan; hook: string; extras: Overlay[]; summary: string }

/**
 * עריכה חכמה: שולח את התמלול ל-Claude (דרך השרת), חותך את הטייקים החוזרים והמילוי
 * שהוא סימן, ומכין את התוכן שלו (הוק, אימוג'ים, קריאה לפעולה) לגרסאות.
 */
async function smartCuts(): Promise<SmartCuts> {
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
  const extras: Overlay[] = emojiIds.flatMap(({ id, emoji }, i) => {
    const cap = after.captions.find((c) => c.id === id);
    return cap ? [{ ...base, ...positions[i % 2], id: uid("ovl"), text: emoji, start: cap.start, end: Math.max(cap.end, cap.start + 1.5), fromTemplate: true }] : [];
  });
  // 3. קריאה לפעולה בשלוש השניות האחרונות
  const end = timelineDuration(after);
  if (plan.cta.trim()) {
    const cta = presetById("typewriter");
    extras.push({ ...cta.fields, id: uid("ovl"), text: plan.cta.trim(), start: Math.max(0, end - 3), end, fromTemplate: true });
  }
  if (!title || title === "פרויקט חדש") setTitle(plan.title);

  const parts = [cut > 0.05 ? `נחתכו ${cut.toFixed(1)} שניות (טייקים חוזרים ומילוי)` : null, `הוק: "${plan.hook}"`];
  return { plan, hook: plan.hook, extras, summary: [plan.summary, ...parts.filter(Boolean)].join(" · ") };
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

/** גרסה של סרטון אווירה: קצב החיתוכים, מוזיקה וצבע */
interface VibeLook {
  title: string;
  description: string;
  /** טווח אורך קטע בשניות */
  pace: [number, number];
  mood: MusicMood;
  color: string;
  /** להשתמש בסדר ש-Claude בחר (רק בגרסה הראשונה) */
  useClaudeOrder: boolean;
}

/**
 * סרטון אווירה (בלי דיבור): בוחר את הרגעים היפים מכל הצילומים, מסדר אותם,
 * מוסיף מוזיקה שמתאימה ומסנכרן את החיתוכים לקצב. עם Claude, הוא רואה את
 * הקטעים ובוחר כמו עורך; בלעדיו, הבחירה לפי חדות, תאורה, צבע ותנועה.
 * הניתוח נעשה פעם אחת, ומבנים ממנו שלוש גרסאות בקצב ובאווירה שונים.
 */
async function autoEditVibe(onStatus: (s: string) => void): Promise<AutoEditResult> {
  const report: AutoEditReport = { done: ["סרטון אווירה: נבחרים הקטעים הכי יפים מכל הצילומים"], skipped: [] };
  useEditor.getState().select(null);
  try {
    const { reframed } = await autoReframe((st) => onStatus(`1/4 · ${st}`));
    if (reframed) report.done.push("הותאם למסך עומד");
  } catch (e) {
    report.skipped.push(`התאמה למסך עומד: ${e instanceof Error ? e.message : "נכשל"}`);
  }

  // 1. ניתוח כל הצילומים (פעם אחת לכל הגרסאות)
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
      onStatus(`2/4 · מנתח את הצילומים ${Math.min(99, Math.round((done / expected) * 100))}%`);
    }));
  }
  if (!samples.length) throw new Error("לא הצלחתי לקרוא את הסרטונים");
  const clipOrder = clips.map((c) => c.id);
  const notes = useEditor.getState().notes;
  const userMusic = musicClip();
  const noMusic = !userMusic && /בלי מוזיקה|ללא מוזיקה|לא לשים מוזיקה|בלי שיר/.test(notes);

  // 2. Claude רואה את המועמדים הטובים ובוחר (פעם אחת)
  let plan: VibePlan | null = null;
  let claudeShots: Shot[] = [];
  if (useEditor.getState().cloud?.smartEdit) {
    onStatus("3/4 · Claude בוחר את הקטעים הכי יפים…");
    try {
      const shots = rankShots(samples, clips, Math.min(2, footage), step);
      const target = vibeTarget(footage, clips.length, 2);
      const candidates = pickShots(shots, target * 2.2, clipOrder).slice(0, 24);
      const body: VibePlanRequest = {
        shots: candidates.map((c) => ({ id: c.id, start: c.start, end: c.end, clip: clipOrder.indexOf(c.clipId), image: c.thumb })),
        target,
        hasMusic: !!userMusic,
        notes,
      };
      const res = await fetch("/api/smart-vibe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) throw new Error(data?.error ?? "השרת לא החזיר תוכנית");
      plan = data as VibePlan;
      const byId = new Map(candidates.map((c) => [c.id, c]));
      claudeShots = plan.order.map((id) => byId.get(id)).filter((c): c is Shot => !!c);
      if (plan.summary) report.done.push(plan.summary);
    } catch (e) {
      report.skipped.push(`בחירה עם Claude: ${e instanceof Error ? e.message : "נכשל"} (נבחר לפי איכות התמונה)`);
    }
  }

  // 3. הגרסאות: מומלצת, קצבית, ורגועה-קולנועית. מצבי רוח שונים זה מזה
  const mainMood: MusicMood = plan?.music ?? moodFromNotes(notes) ?? "chill";
  const looks: VibeLook[] = [
    { title: plan ? "הבחירה של Claude" : "מומלץ", description: "קטע של כשתי שניות מכל צילום", pace: [1.3, 2.6], mood: mainMood, color: plan?.color_style ?? "cinematic", useClaudeOrder: true },
    { title: "קצבי ואנרגטי", description: "חיתוכים מהירים של כשנייה, מוזיקה אנרגטית", pace: [0.7, 1.3], mood: mainMood === "energetic" ? "pop" : "energetic", color: "vivid", useClaudeOrder: false },
    { title: "רגוע וקולנועי", description: "קטעים ארוכים יותר, מוזיקה קולנועית", pace: [2.2, 3.4], mood: mainMood === "cinematic" ? "romantic" : "cinematic", color: "warm", useClaudeOrder: false },
  ];

  onStatus("4/4 · בונה גרסאות…");
  const base = useEditor.getState().timeline;
  const options: EditOption[] = [];
  for (const [i, look] of looks.entries()) {
    useEditor.setState({ timeline: base });
    // מוזיקה: של המשתמשת אם יש; אחרת, בגרסה הראשונה מהספרייה הגדולה ובשאר מובנית
    let bpm = 0;
    if (userMusic) {
      const a = useEditor.getState().assets[userMusic.assetId];
      bpm = a.bpm ?? detectBeats(await decodeAssetAudio(a)).bpm;
    } else if (!noMusic) {
      bpm = await addVibeMusic(look.mood, i === 0, report);
    }
    const shotLen = bpm ? beatsShot(bpm, look.pace) : (look.pace[0] + look.pace[1]) / 2;
    const chosen = look.useClaudeOrder && claudeShots.length >= 2
      ? claudeShots
      : pickShots(rankShots(samples, clips, Math.min(shotLen, footage), step), vibeTarget(footage, clips.length, shotLen), clipOrder);
    useEditor.getState().arrangeShots(chosen);
    if (musicClip()) {
      const { setClipVolume } = useEditor.getState();
      for (const clip of useEditor.getState().timeline.clips) setClipVolume(clip.id, 0);
      await syncToBeat(() => undefined).catch(() => undefined);
    }
    const style = CLIP_STYLES.find((st) => st.id === look.color);
    const { setClipLook } = useEditor.getState();
    if (style) for (const clip of useEditor.getState().timeline.clips) setClipLook(clip.id, { ...clip.look, filter: style.look(0.6).filter });
    if (plan?.text.trim()) {
      const preset = presetById("typewriter");
      useEditor.setState((st) => ({
        timeline: { ...st.timeline, overlays: [...st.timeline.overlays, { ...preset.fields, y: 0.16, id: uid("ovl"), text: plan!.text.trim(), start: 0.3, end: 3, fromTemplate: true }] },
      }));
    }
    const length = useEditor.getState().timeline.clips.reduce((sum, c) => sum + c.out - c.in, 0);
    options.push({
      id: `vibe-${i}`, title: look.title,
      description: `${look.description} · ${useEditor.getState().timeline.clips.length} קטעים, ${Math.round(length)} שנ׳`,
      timeline: useEditor.getState().timeline,
    });
  }
  const { setTitle, title } = useEditor.getState();
  if (plan?.title && (!title || title === "פרויקט חדש")) setTitle(plan.title);
  report.done.push(`נבנו ${options.length} גרסאות לבחירה`);
  return { report, options };
}

/** אורך הסרטון: בערך קטע אחד-שניים מכל צילום, בין 6 ל-15 שניות */
function vibeTarget(footage: number, clipCount: number, shotLen: number) {
  return footage < 8 ? footage * 0.85 : Math.min(15, Math.max(6, clipCount * shotLen * 1.5, footage * 0.3));
}

/**
 * מוסיף מוזיקה לגרסה ומחזיר את הקצב. בגרסה הראשונה מנסים קודם את הספרייה הגדולה
 * (עד 10 שניות); אחרת, ובכל כישלון, שיר מובנה שתמיד עובד.
 */
async function addVibeMusic(mood: MusicMood, tryLibrary: boolean, report: AutoEditReport): Promise<number> {
  if (tryLibrary) {
    try {
      const tracks = await Promise.race([
        searchLibrary(MUSIC_MOODS[mood]),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 10_000)),
      ]);
      const track = tracks[0];
      if (!track) throw new Error("לא נמצא שיר");
      const assetId = await addLibraryTrack(track, { select: false });
      if (track.needsCredit) report.done.push(`השיר "${track.title}" דורש קרדיט בתיאור (ראו בלשונית סאונד)`);
      return detectBeats(await decodeAssetAudio(useEditor.getState().assets[assetId])).bpm;
    } catch (e) {
      logEvent("auto_edit_music_fallback", { mood, error: errorText(e) });
    }
  }
  const builtin = builtinForMood(mood);
  addBuiltinTrack(builtin, { select: false });
  return builtin.bpm;
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

/** אורך קטע בסרטון אווירה: מספר שלם של ביטים, בתוך טווח הקצב של הגרסה */
function beatsShot(bpm: number, [min, max]: [number, number] = [1.3, 2.6]) {
  const beat = 60 / bpm;
  const n = [4, 2, 8, 3, 6, 1].find((k) => k * beat >= min && k * beat <= max) ?? Math.max(1, Math.round((min + max) / 2 / beat));
  return n * beat;
}

/** קטע המוזיקה (הסאונד הארוך ביותר בציר הזמן), אם יש */
function musicClip() {
  const { timeline, assets } = useEditor.getState();
  return [...timeline.audio]
    .filter((a) => a.out - a.in > 5 && assets[a.assetId])
    .sort((a, b) => b.out - b.in - (a.out - a.in))[0];
}
