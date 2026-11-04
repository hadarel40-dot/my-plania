"use client";
import { useState } from "react";
import { create } from "zustand";
import { Captions, Crop, Loader2, Music2, Scissors, Sparkles, TrendingUp } from "lucide-react";
import type { Trends, TrendsRequest } from "@/lib/ai/smart-plan";
import { logEvent } from "@/lib/telemetry";
import { useEditor } from "@/stores/editor-store";
import type { Timeline, TransitionStyle } from "@/lib/editor/types";
import { applyTransitionStyle, autoEditAll, autoReframe, removeSilences, syncToBeat, type AutoEditMode, type AutoEditReport, type EditOption } from "@/lib/editor/auto-edit";
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
  mode: AutoEditMode;
  /** הגרסאות לבחירה, ואיזו מוצגת עכשיו */
  options: EditOption[];
  chosen: string | null;
}>(() => ({ busy: null, report: null, error: null, before: null, mode: "auto", options: [], chosen: null }));

/** פותח את לשונית "חכם" (בטלפון: המגירה), למשל מהכפתור שעל הנגן */
export const OPEN_SMART_EVENT = "editor:open-smart";

export async function runAutoEdit() {
  const set = useAutoEditRun.setState;
  set({ report: null, error: null, options: [], chosen: null, before: useEditor.getState().timeline, busy: "מתחיל…" });
  try {
    const { report, options } = await autoEditAll((busy) => set({ busy }), useAutoEditRun.getState().mode);
    set({ report, options, chosen: options[0]?.id ?? null });
  } catch (e) {
    set({ error: e instanceof Error ? e.message : "משהו השתבש" });
  } finally {
    set({ busy: null });
  }
}

/** כמה מעברים ותנועה: בלי / נקיים / דינמיים / מוגזמים. העריכה האוטומטית משתמשת בבחירה */
function TransitionStylePicker() {
  const style = useEditor((s) => s.timeline.transitionStyle ?? "clean");
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
          <button key={o.id} onClick={() => useEditor.getState().setTransitionStyle(o.id)}
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
  return (
    <label className="mb-3 block">
      <span className="text-xs font-medium text-zinc-300">הוראות לעורך</span>
      <textarea value={notes} onChange={(e) => useEditor.getState().setNotes(e.target.value)} rows={3} dir="auto"
        placeholder={"למשל: לפתוח עם הכלב, מוזיקה רגועה, סרטון קצר של 10 שניות, הוק על המחיר, בלי אימוג'ים"}
        className="mt-1 w-full resize-y rounded-lg border border-zinc-700 bg-zinc-950 p-2.5 text-sm placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none" />
      <span className="block text-[11px] text-zinc-500">
        {smart
          ? `${brain} קורא את ההוראות בכל עריכה אוטומטית ופועל לפיהן. ההוראות נשמרות בפרויקט.`
          : "ההוראות נשמרות בפרויקט. כרגע העורך מבין רק דברים פשוטים (סוג מוזיקה, בלי מוזיקה, בלי כתוביות); עם Gemini מחובר הוא פועל לפי הכל."}
      </span>
    </label>
  );
}

function AutoEditButton({ disabled }: { disabled: boolean }) {
  const { busy, report, error, before, mode, options, chosen } = useAutoEditRun();
  const choose = (o: EditOption) => {
    useEditor.setState({ timeline: o.timeline, selection: null });
    usePlayback.getState().seek(0);
    useAutoEditRun.setState({ chosen: o.id });
    // מנגנים מיד מההתחלה, כדי לראות את הגרסה בלי עוד לחיצה
    usePlayback.getState().player?.play();
  };
  const setMode = (m: AutoEditMode) => useAutoEditRun.setState({ mode: m });
  const run = runAutoEdit;
  const setReport = (r: AutoEditReport | null) => useAutoEditRun.setState({ report: r });
  const setBefore = (b: Timeline | null) => useAutoEditRun.setState({ before: b });

  const modes: { id: AutoEditMode; label: string }[] = [
    { id: "auto", label: "לזהות לבד" },
    { id: "talking", label: "🎤 דיבור" },
    { id: "vibe", label: "🌅 אווירה" },
  ];

  return (
    <div>
      <EditorNotes />
      <TransitionStylePicker />
      <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-zinc-500">סוג הסרטון:</span>
        {modes.map((m) => (
          <button key={m.id} onClick={() => setMode(m.id)} disabled={!!busy}
            className={cn("rounded-full border px-2.5 py-1",
              mode === m.id ? "border-violet-500 bg-violet-500/15 text-white" : "border-zinc-700 text-zinc-400 hover:border-zinc-500")}>
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
