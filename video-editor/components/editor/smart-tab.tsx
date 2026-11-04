"use client";
import { useState } from "react";
import { create } from "zustand";
import { Captions, Crop, Loader2, Music2, Scissors, Send, Sparkles, TrendingUp } from "lucide-react";
import type { Trends, TrendsRequest } from "@/lib/ai/smart-plan";
import { logEvent } from "@/lib/telemetry";
import { useEditor } from "@/stores/editor-store";
import type { Timeline, TransitionStyle } from "@/lib/editor/types";
import { applyTransitionStyle, autoEditAll, autoReframe, currentStyle, removeSilences, syncToBeat, type AutoEditReport, type EditOption } from "@/lib/editor/auto-edit";
import { GENRES, genreInfo, type VideoGenre } from "@/lib/editor/genres";
import { forgetMyStyle, loadMyStyle, rememberPick, rememberStyle } from "@/lib/editor/my-style";
import { canRestoreCaptions, currentHook, makeShorter, moreEnergy, otherMusic, setHookText, toggleCaptions } from "@/lib/editor/quick-fixes";
import { FONTS } from "@/lib/editor/fonts";
import { usePlayback } from "@/stores/playback-store";
import { TEMPLATES } from "@/lib/editor/templates";
import { Section } from "./ui";
import { cn } from "@/lib/utils";

/**
 * כלים חכמים: פעולות אוטומטיות על כל הסרטון (או על הקליפ הנבחר).
 * הכל רץ בתוך הדפדפן, בלי עלות.
 */
export function SmartTab() {
  const hasClips = useEditor((s) => s.timeline.clips.length > 0);
  const clipSelected = useEditor((s) => s.selection?.kind === "clip");
  const scope = clipSelected ? "הקליפ הנבחר" : "כל הסרטונים";

  return (
    <div className="space-y-5 p-4">
      {!hasClips && <p className="rounded-lg bg-zinc-900 p-3 text-sm text-zinc-400">קודם מעלים סרטון, ואז הכלים כאן עובדים עליו.</p>}
      <AutoEditButton disabled={!hasClips} />
      <Section title="טרנדים עכשיו">
        <TrendsPanel />
      </Section>
      <Section title="תבניות לרילס">
        <TemplatePicker disabled={!hasClips} />
      </Section>
      <Section title="עריכה אוטומטית">
        <Tool
          icon={<Scissors className="size-5" />}
          title="הסרת שתיקות"
          description={`חותך את ההפסקות והשתיקות בדיבור (ג'אמפ קאטים). על ${scope}.`}
          disabled={!hasClips}
          run={async (status) => {
            const removed = await removeSilences(status);
            return removed > 0.05 ? `הוסרו ${removed.toFixed(1)} שניות של שתיקה` : "לא נמצאו שתיקות להסרה";
          }}
        />
        <Tool
          icon={<Crop className="size-5" />}
          title="התאמה למסך עומד (רילס)"
          description="סרטון שצולם לרוחב נחתך לעומד, והפנים נשארות במרכז התמונה."
          disabled={!hasClips}
          run={async (status) => {
            const { faces, reframed } = await autoReframe(status);
            if (!reframed) return "הסרטונים כבר עומדים ומתאימים לרילס";
            return faces
              ? `הותאמו ${reframed} קליפים; ב-${faces} מהם הפנים במרכז`
              : `המסך עבר לעומד. לא נמצאו פנים, ולכן התמונה ממורכזת`;
          }}
        />
        <Tool
          icon={<Music2 className="size-5" />}
          title="סנכרון לקצב המוזיקה"
          description="מזיז כל מעבר בין קליפים אל הביט במוזיקה. קודם מוסיפים מוזיקה בלשונית סאונד."
          disabled={!hasClips}
          run={async (status) => `המעברים סונכרנו לקצב (${await syncToBeat(status)} ביטים לדקה)`}
        />
        <Tool
          icon={<Captions className="size-5" />}
          title="כתוביות אוטומטיות"
          description="מתמלל את הדיבור לכתוביות בעברית, מילה אחרי מילה. בפעם הראשונה יורד מודל (פעם אחת בלבד)."
          disabled={!hasClips}
          run={async (status) => {
            // הסטטוס של התמלול (הורדת מודל / תמלול) מגיע מה-store
            const unsubscribe = useEditor.subscribe((s) => { if (s.transcribeStatus) status(s.transcribeStatus); });
            try {
              const count = await useEditor.getState().autoTranscribe();
              useEditor.getState().setError(null);
              return `נוספו ${count} כתוביות. לחיצה על כתובית בציר הזמן משנה סגנון וצבע.`;
            } finally {
              unsubscribe();
            }
          }}
        />
      </Section>
    </div>
  );
}

/** הכפתור הראשי: כל העריכה האוטומטית בלחיצה אחת, ודוח של מה נעשה */
/**
 * מצב הריצה של העריכה האוטומטית. נשמר מחוץ לקומפוננטה, כי בזמן הריצה המסך יכול
 * להתחלף (למשל בטלפון עוברים ללשונית אחרת) והדוח לא צריך ללכת לאיבוד.
 */
export const useAutoEditRun = create<{
  busy: string | null;
  report: AutoEditReport | null;
  error: string | null;
  /** ציר הזמן לפני העריכה האוטומטית, כדי שאפשר יהיה לחזור אליו בלחיצה אחת */
  before: Timeline | null;
  /** סוג הסרטון (התשובה ל"מה הסרטון?") */
  genre: VideoGenre;
  /** הגרסאות לבחירה, ואיזו מוצגת עכשיו */
  options: EditOption[];
  chosen: string | null;
  /** הצעות למשפט פתיחה מהמוח (null: עוד לא ביקשנו) */
  hooks: string[] | null;
  hooksBusy: boolean;
}>(() => ({ busy: null, report: null, error: null, before: null, genre: "auto", options: [], chosen: null, hooks: null, hooksBusy: false }));

/** פותח את לשונית "חכם" (בטלפון: המגירה), למשל מהכפתור שעל הנגן */
export const OPEN_SMART_EVENT = "editor:open-smart";

export async function runAutoEdit(genre?: VideoGenre) {
  const set = useAutoEditRun.setState;
  if (genre) { set({ genre }); rememberStyle({ genre }); }
  set({ report: null, error: null, options: [], chosen: null, hooks: null, before: useEditor.getState().timeline, busy: "מתחיל…" });
  try {
    const { report, options } = await autoEditAll((busy) => set({ busy }), useAutoEditRun.getState().genre);
    set({ report, options, chosen: options[0]?.id ?? null });
    // הגרסה הראשונה מתנגנת מיד
    usePlayback.getState().seek(0);
    usePlayback.getState().player?.play();
    void loadHooks(report);
  } catch (e) {
    set({ error: e instanceof Error ? e.message : "משהו השתבש" });
  } finally {
    set({ busy: null });
  }
}

/** משפטי פתיחה: המוח כותב שלוש הצעות לפי התוכן, ברקע, אחרי שהגרסאות מוכנות */
async function loadHooks(report?: AutoEditReport | null) {
  const { cloud, timeline, notes, title } = useEditor.getState();
  if (!cloud?.smartEdit) return;
  const set = useAutoEditRun.setState;
  set({ hooksBusy: true });
  try {
    const genre = genreInfo(useAutoEditRun.getState().genre);
    const transcript = timeline.captions.map((c) => c.text).join(" ").slice(0, 1500);
    const context = [
      genre && `סוג: ${genre.label}`,
      title && title !== "פרויקט חדש" && `שם: ${title}`,
      notes && `הוראות: ${notes}`,
      transcript && `תמלול: ${transcript}`,
      report?.done.length && `מה נעשה בעריכה: ${report.done.join(" · ")}`,
    ].filter(Boolean).join("\n");
    const res = await fetch("/api/hooks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ context, current: currentHook() }) });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.hooks) {
      logEvent("brain_failed", { route: "hooks", status: res.status, error: data?.error, detail: data?.detail });
      set({ hooks: [] });
      return;
    }
    set({ hooks: data.hooks as string[] });
  } catch {
    set({ hooks: [] });
  } finally {
    set({ hooksBusy: false });
  }
}

/** שומר את השינוי בגרסה שמוצגת, כדי שמעבר לגרסה אחרת וחזרה לא יבטל אותו */
function saveIntoChosen() {
  const { options, chosen } = useAutoEditRun.getState();
  const timeline = useEditor.getState().timeline;
  useAutoEditRun.setState({ options: options.map((o) => (o.id === chosen ? { ...o, timeline } : o)) });
}

/** תיקונים בלחיצה: כל כפתור משנה דבר אחד בגרסה שמוצגת */
function QuickFixes() {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const hasCaptions = useEditor((s) => s.timeline.captions.length > 0);
  const run = async (id: string, fix: () => Promise<string> | string) => {
    setBusy(id); setMessage(null);
    try {
      setMessage(await fix());
      saveIntoChosen();
      logEvent("quick_fix", { fix: id });
      usePlayback.getState().seek(0);
      usePlayback.getState().player?.play();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "לא הצליח");
    } finally {
      setBusy(null);
    }
  };
  const fixes: { id: string; label: string; fix: () => Promise<string> | string; show: boolean }[] = [
    { id: "shorter", label: "✂️ יותר קצר", fix: makeShorter, show: true },
    { id: "energy", label: "⚡ יותר אנרגטי", fix: moreEnergy, show: true },
    { id: "music", label: "🎵 מוזיקה אחרת", fix: otherMusic, show: true },
    { id: "captions", label: hasCaptions ? "💬 בלי כתוביות" : "💬 להחזיר כתוביות", fix: toggleCaptions, show: hasCaptions || canRestoreCaptions() },
  ];
  return (
    <div className="mt-3">
      <p className="text-sm font-medium">תיקונים בלחיצה</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {fixes.filter((f) => f.show).map((f) => (
          <button key={f.id} onClick={() => run(f.id, f.fix)} disabled={!!busy}
            className="flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs hover:border-violet-500 disabled:opacity-50">
            {busy === f.id && <Loader2 className="size-3 animate-spin" />}{f.label}
          </button>
        ))}
      </div>
      {message && <p className="mt-1 text-[11px] text-emerald-300">✓ {message}</p>}
    </div>
  );
}

/** משפט הפתיחה: ההוק הנוכחי ושלוש הצעות של המוח. לחיצה מחליפה את הטקסט בכל הגרסאות */
function HookPicker() {
  const { hooks, hooksBusy } = useAutoEditRun();
  const current = useEditor((s) => s.timeline.overlays.find((o) => o.hook)?.text ?? null);
  const smart = useEditor((s) => !!s.cloud?.smartEdit);
  if (!smart) return null;
  const pick = (text: string) => {
    setHookText(text);
    // אותו משפט פתיחה בכל הגרסאות
    const { options, chosen } = useAutoEditRun.getState();
    const now = useEditor.getState().timeline;
    useAutoEditRun.setState({
      options: options.map((o) => {
        if (o.id === chosen) return { ...o, timeline: now };
        const i = o.timeline.overlays.findIndex((x) => x.hook);
        if (i < 0) return o;
        const overlays = [...o.timeline.overlays];
        overlays[i] = { ...overlays[i], text };
        return { ...o, timeline: { ...o.timeline, overlays } };
      }),
    });
    logEvent("hook_pick", {});
    usePlayback.getState().seek(0);
    usePlayback.getState().player?.play();
  };
  return (
    <div className="mt-3">
      <p className="text-sm font-medium">משפט פתיחה <span className="text-xs font-normal text-zinc-500">· מה שרואים בשנייה הראשונה</span></p>
      {hooksBusy && <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-400"><Loader2 className="size-3 animate-spin" /> כותב הצעות…</p>}
      <div className="mt-1.5 grid gap-1.5">
        {(hooks ?? []).map((h) => (
          <button key={h} onClick={() => pick(h)} dir="auto"
            className={cn("rounded-lg border px-3 py-2 text-start text-sm",
              current === h ? "border-violet-500 bg-violet-500/10" : "border-zinc-800 bg-zinc-950 hover:border-zinc-600")}>
            {h}
          </button>
        ))}
      </div>
      {!hooksBusy && (
        <button onClick={() => loadHooks(useAutoEditRun.getState().report)} className="mt-1 text-[11px] text-zinc-500 underline hover:text-white">
          {hooks?.length ? "עוד הצעות" : "להציע משפטי פתיחה"}
        </button>
      )}
    </div>
  );
}

/** מה העורך זוכר מהבחירות הקודמות. העריכה האוטומטית מתחילה משם */
function MyStyleLine() {
  const [style, setStyle] = useState(() => (typeof window === "undefined" ? {} : loadMyStyle()));
  const parts = [
    style.captionFont && `גופן ${FONTS.find((f) => f.id === style.captionFont)?.label ?? style.captionFont}`,
    style.transitionStyle && `מעברים ${({ none: "בלי", clean: "נקיים", dynamic: "דינמיים", extreme: "מוגזמים" } as const)[style.transitionStyle]}`,
  ].filter(Boolean);
  if (!parts.length) return null;
  return (
    <p className="mb-2 text-[11px] text-zinc-500">
      ⭐ הסגנון שלי: {parts.join(" · ")}{" "}
      <button onClick={() => { forgetMyStyle(); setStyle({}); }} className="underline hover:text-white">איפוס</button>
    </p>
  );
}

/** כמה מעברים ותנועה: בלי / נקיים / דינמיים / מוגזמים. העריכה האוטומטית משתמשת בבחירה */
function TransitionStylePicker() {
  const style = useEditor((s) => s.timeline.transitionStyle ?? null) ?? currentStyle();
  const hasClips = useEditor((s) => s.timeline.clips.length > 1);
  const options: { id: TransitionStyle; label: string }[] = [
    { id: "none", label: "בלי" },
    { id: "clean", label: "נקיים" },
    { id: "dynamic", label: "דינמיים" },
    { id: "extreme", label: "מוגזמים 🔥" },
  ];
  return (
    <div className="mb-3">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-zinc-500">מעברים:</span>
        {options.map((o) => (
          <button key={o.id} onClick={() => { useEditor.getState().setTransitionStyle(o.id); rememberStyle({ transitionStyle: o.id }); }}
            className={cn("rounded-full border px-2.5 py-1",
              style === o.id ? "border-violet-500 bg-violet-500/15 text-white" : "border-zinc-700 text-zinc-400 hover:border-zinc-500")}>
            {o.label}
          </button>
        ))}
      </div>
      {hasClips && (
        <button onClick={() => applyTransitionStyle(style)} className="mt-1 text-[11px] text-zinc-500 underline hover:text-white">
          להחיל עכשיו על כל הקליפים
        </button>
      )}
    </div>
  );
}

/** הוראות והערות לעורך. נשמרות בפרויקט, ועם מוח מחובר (Gemini / Claude) הן נשלחות אליו בכל עריכה אוטומטית */
function EditorNotes() {
  const notes = useEditor((s) => s.notes);
  const smart = useEditor((s) => !!s.cloud?.smartEdit);
  const brain = useEditor((s) => s.cloud?.brain ?? "הבינה המלאכותית");
  const hasClips = useEditor((s) => s.timeline.clips.length > 0);
  const busy = useAutoEditRun((s) => !!s.busy);
  // שליחה: העורך עורך מחדש לפי ההוראות, בלי ללחוץ שוב על "עריכה אוטומטית"
  const send = () => {
    if (!hasClips || busy || !notes.trim()) return;
    logEvent("notes_sent", { length: notes.length });
    void runAutoEdit();
  };
  return (
    <div className="mb-3">
      <label className="block">
        <span className="text-xs font-medium text-zinc-300">הוראות לעורך</span>
        <textarea value={notes} onChange={(e) => useEditor.getState().setNotes(e.target.value)} rows={3} dir="auto"
          placeholder={"למשל: לפתוח עם הכלב, מוזיקה רגועה, סרטון קצר של 10 שניות, הוק על המחיר, בלי אימוג'ים"}
          className="mt-1 w-full resize-y rounded-lg border border-zinc-700 bg-zinc-950 p-2.5 text-sm placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none" />
      </label>
      <div className="flex items-start gap-2">
        <span className="block flex-1 text-[11px] text-zinc-500">
          {smart
            ? `${brain} קורא את ההוראות ועורך לפיהן. ההוראות נשמרות בפרויקט.`
            : "ההוראות נשמרות בפרויקט. כרגע העורך מבין רק דברים פשוטים (סוג מוזיקה, בלי מוזיקה, בלי כתוביות); עם Gemini מחובר הוא פועל לפי הכל."}
        </span>
        <button onClick={send} disabled={!hasClips || busy || !notes.trim()}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-l from-violet-600 to-fuchsia-600 px-4 py-1.5 text-sm font-semibold shadow disabled:opacity-40">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4 -scale-x-100" />} שליחה
        </button>
      </div>
      {!hasClips && notes.trim() && <p className="mt-1 text-[11px] text-zinc-500">קודם מעלים סרטון, ואז שולחים.</p>}
    </div>
  );
}

function AutoEditButton({ disabled }: { disabled: boolean }) {
  const { busy, report, error, before, genre, options, chosen } = useAutoEditRun();
  const choose = (o: EditOption) => {
    useEditor.setState({ timeline: o.timeline, selection: null });
    // הסגנון שלי: איזו גרסה נבחרה, ובאיזה סגנון כתוביות
    rememberPick(o.id.replace(/-\d+$/, (m) => (o.id.startsWith("vibe") ? m : "")));
    const cs = o.timeline.captionStyle;
    if (o.timeline.captions.length && cs?.font) rememberStyle({ captionPreset: cs.preset, captionFont: cs.font, accent: cs.accent });
    usePlayback.getState().seek(0);
    useAutoEditRun.setState({ chosen: o.id });
    // מנגנים מיד מההתחלה, כדי לראות את הגרסה בלי עוד לחיצה
    usePlayback.getState().player?.play();
  };
  const setGenre = (g: VideoGenre) => useAutoEditRun.setState({ genre: g });
  const run = () => runAutoEdit();
  const setReport = (r: AutoEditReport | null) => useAutoEditRun.setState({ report: r });
  const setBefore = (b: Timeline | null) => useAutoEditRun.setState({ before: b });

  const genres: { id: VideoGenre; label: string }[] = [
    { id: "auto", label: "לזהות לבד" },
    ...GENRES.map((g) => ({ id: g.id, label: `${g.emoji} ${g.label}` })),
  ];
  const mode = genreInfo(genre)?.mode ?? "auto";

  return (
    <div>
      <EditorNotes />
      <MyStyleLine />
      <TransitionStylePicker />
      <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-zinc-500">מה הסרטון?</span>
        {genres.map((m) => (
          <button key={m.id} onClick={() => setGenre(m.id)} disabled={!!busy}
            className={cn("rounded-full border px-2.5 py-1",
              genre === m.id ? "border-violet-500 bg-violet-500/15 text-white" : "border-zinc-700 text-zinc-400 hover:border-zinc-500")}>
            {m.label}
          </button>
        ))}
      </div>
      <button onClick={run} disabled={disabled || !!busy}
        className="flex w-full items-center gap-3 rounded-xl bg-gradient-to-l from-violet-600 to-fuchsia-600 p-4 text-start shadow-lg transition hover:brightness-110 disabled:opacity-50">
        {busy ? <Loader2 className="size-7 shrink-0 animate-spin" /> : <Sparkles className="size-7 shrink-0" />}
        <span>
          <span className="block font-semibold">עריכה אוטומטית</span>
          <span className="block text-xs text-violet-100">
            {busy ?? (mode === "vibe"
              ? "לחיצה אחת: בחירת הקטעים הכי יפים, מוזיקה מתאימה, חיתוכים על הקצב וצבע. אחר כך אפשר לשנות הכל."
              : mode === "talking"
                ? "לחיצה אחת: חיתוך שתיקות, כתוביות, הוק, אימוג'ים, אפקטים וצבע. אחר כך אפשר לשנות הכל."
                : "מזהה לבד אם מדברים בסרטון או שזה סרטון אווירה, ועורך בהתאם. אחר כך אפשר לשנות הכל.")}
          </span>
        </span>
      </button>
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
      {options.length > 1 && (
        <div className="mt-3">
          <p className="text-sm font-medium">בחרו גרסה <span className="text-xs font-normal text-zinc-500">· לחיצה מציגה אותה בנגן</span></p>
          <div className="mt-2 grid gap-2">
            {options.map((o, i) => (
              <button key={o.id} onClick={() => choose(o)}
                className={cn("flex items-start gap-3 rounded-lg border p-3 text-start transition",
                  chosen === o.id ? "border-violet-500 bg-violet-500/10" : "border-zinc-800 bg-zinc-950 hover:border-zinc-600")}>
                <span className={cn("grid size-7 shrink-0 place-items-center rounded-full text-sm font-semibold",
                  chosen === o.id ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-300")}>{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{o.title}</span>
                  <span className="block text-xs text-zinc-500">{o.description}</span>
                </span>
                {chosen === o.id && <span className="text-xs text-violet-300">בנגן עכשיו</span>}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-zinc-500">הגרסה שמוצגת היא זו שנשמרת. אפשר לעבור ביניהן כמה שרוצים, ולערוך כל אחת אחר כך.</p>
          <QuickFixes />
          <HookPicker />
        </div>
      )}
      {report && (
        <div className="mt-2 space-y-1 rounded-lg bg-zinc-950 p-3 text-xs">
          {report.done.map((d) => <p key={d} className="text-emerald-300">✓ {d}</p>)}
          {report.skipped.map((d) => <p key={d} className="text-amber-300">– {d}</p>)}
          <p className="pt-1 text-zinc-400">מכאן אפשר לשנות כל דבר: לחיצה על טקסט, כתובית או קליפ פותחת את העריכה שלו.</p>
          {before && (
            <button onClick={() => { useEditor.setState({ timeline: before }); setReport(null); setBefore(null); useAutoEditRun.setState({ options: [], chosen: null }); }}
              className="mt-1 text-zinc-400 underline hover:text-white">
              לא אהבתי, חזרה לסרטון כמו שהיה
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function TemplatePicker({ disabled }: { disabled: boolean }) {
  const [applied, setApplied] = useState<string | null>(null);
  return (
    <>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {TEMPLATES.map((t) => (
          <button key={t.id} disabled={disabled}
            onClick={() => { useEditor.getState().applyTemplate(t.id); setApplied(t.label); }}
            className={cn("rounded-lg border bg-zinc-950 p-2.5 text-start transition hover:border-violet-500 disabled:opacity-50",
              applied === t.label ? "border-violet-500" : "border-zinc-800")}>
            <span className="text-xl">{t.emoji}</span>
            <span className="mt-1 block text-sm font-medium">{t.label}</span>
            <span className="block text-[11px] leading-snug text-zinc-500">{t.description}</span>
          </button>
        ))}
      </div>
      {applied && (
        <p className="mt-1.5 text-xs text-emerald-300">
          התבנית &quot;{applied}&quot; הוחלה. לחיצה על טקסט בסרטון או בציר הזמן משנה אותו.
        </p>
      )}
    </>
  );
}

/**
 * טרנדים: המוח (Gemini / Claude) מחפש ברשת מה עובד עכשיו ברילס, ומתאים לסרטון. כל רעיון אפשר
 * להוסיף להוראות לעורך בלחיצה, וההוקים, התיאור וההאשטגים מוכנים להעתקה.
 */
function TrendsPanel() {
  const smart = useEditor((s) => !!s.cloud?.smartEdit);
  const brain = useEditor((s) => s.cloud?.brain ?? "הבינה המלאכותית");
  const [busy, setBusy] = useState(false);
  const [trends, setTrends] = useState<Trends | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function load() {
    setBusy(true); setError(null);
    const { notes, title, timeline } = useEditor.getState();
    const transcript = timeline.captions.map((c) => c.text).join(" ").slice(0, 800);
    const body: TrendsRequest = {
      topic: [title !== "פרויקט חדש" ? `שם: ${title}` : "", notes && `הוראות: ${notes}`, transcript && `תמלול: ${transcript}`].filter(Boolean).join("\n"),
      kind: timeline.captions.length ? "talking" : "vibe",
    };
    try {
      const res = await fetch("/api/trends", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        logEvent("brain_failed", { route: "trends", status: res.status, error: data?.error, detail: data?.detail });
        throw new Error(data?.error ?? "החיפוש נכשל");
      }
      setTrends(data as Trends);
    } catch (e) {
      setError(e instanceof Error ? e.message : "החיפוש נכשל");
    } finally {
      setBusy(false);
    }
  }

  const addToNotes = (line: string) => {
    const { notes, setNotes } = useEditor.getState();
    setNotes(notes.trim() ? `${notes.trim()}\n${line}` : line);
  };
  const copy = (key: string, text: string) => navigator.clipboard?.writeText(text).then(() => setCopied(key));

  if (!smart) {
    return <p className="mt-2 rounded-lg bg-zinc-950 p-3 text-xs text-zinc-400">כדי לחפש טרנדים עדכניים צריך לחבר את Gemini (מפתח חינמי מגוגל). הוא מחפש ברשת מה עובד עכשיו ברילס, ומתאים לסרטון שלך.</p>;
  }
  return (
    <div className="mt-2 space-y-3">
      <button onClick={load} disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 py-2.5 text-sm hover:border-violet-500 disabled:opacity-60">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <TrendingUp className="size-4 text-violet-300" />}
        {busy ? `${brain} מחפש מה טרנדי עכשיו… (עד דקה)` : trends ? "לחפש שוב" : "מה טרנדי עכשיו?"}
      </button>
      {error && <p className="text-xs text-red-300">{error}</p>}
      {trends && (
        <>
          {trends.trends.map((t) => (
            <div key={t.name} className="rounded-lg bg-zinc-950 p-3 text-sm">
              <p className="font-medium">{t.name}</p>
              <p className="text-xs text-zinc-400">{t.why}</p>
              <button onClick={() => addToNotes(t.how)} className="mt-1.5 text-xs text-violet-300 underline hover:text-white">
                להוסיף להוראות: &quot;{t.how}&quot;
              </button>
            </div>
          ))}
          <div className="rounded-lg bg-zinc-950 p-3 text-sm">
            <p className="font-medium">הוקים בסגנון של עכשיו</p>
            {trends.hooks.map((h) => (
              <button key={h} onClick={() => addToNotes(`הוק: ${h}`)} className="mt-1 block text-start text-xs text-zinc-300 hover:text-white">
                ➕ {h}
              </button>
            ))}
          </div>
          <div className="rounded-lg bg-zinc-950 p-3 text-sm">
            <p className="font-medium">תיאור לפוסט</p>
            <p className="mt-1 whitespace-pre-line text-xs text-zinc-300">{trends.caption}</p>
            <p className="mt-1 text-xs text-sky-300" dir="ltr">{trends.hashtags.join(" ")}</p>
            <button onClick={() => copy("caption", `${trends.caption}\n\n${trends.hashtags.join(" ")}`)} className="mt-1 text-xs underline">
              {copied === "caption" ? "הועתק ✓" : "העתקה"}
            </button>
          </div>
          {trends.audio.length > 0 && (
            <div className="rounded-lg bg-zinc-950 p-3 text-sm">
              <p className="font-medium">צלילים טרנדיים (להוסיף באינסטגרם)</p>
              {trends.audio.map((a) => (
                <p key={a.title} className="mt-1 text-xs text-zinc-300">🎵 <span dir="auto">{a.title}</span>{a.artist ? <span dir="auto"> · {a.artist}</span> : null} <span className="text-zinc-500">· {a.note}</span></p>
              ))}
              <p className="mt-1 text-[11px] text-zinc-500">מייצאים בלי מוזיקה (או עם מוזיקה שקטה), ומוסיפים את הצליל באינסטגרם כשמעלים.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** כפתור של כלי: מראה התקדמות בזמן הריצה ותוצאה או שגיאה בסוף */
export function Tool({ icon, title, description, disabled, run }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  disabled?: boolean;
  run: (status: (s: string) => void) => Promise<string>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function start() {
    setResult(null);
    setBusy("מתחיל…");
    try {
      setResult({ ok: true, text: await run(setBusy) });
    } catch (e) {
      setResult({ ok: false, text: e instanceof Error ? e.message : "משהו השתבש" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-2">
      <button onClick={start} disabled={disabled || !!busy}
        className="flex w-full items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-start transition hover:border-violet-500 disabled:opacity-50">
        <span className="mt-0.5 text-violet-300">{busy ? <Loader2 className="size-5 animate-spin" /> : icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{title}</span>
          <span className="block text-xs text-zinc-500">{busy ?? description}</span>
        </span>
      </button>
      {result && <p className={cn("mt-1.5 text-xs", result.ok ? "text-emerald-300" : "text-red-300")}>{result.text}</p>}
    </div>
  );
}
