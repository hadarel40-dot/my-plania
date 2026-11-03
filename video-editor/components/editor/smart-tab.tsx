"use client";
import { useState } from "react";
import { Captions, Crop, Loader2, Music2, Scissors, Sparkles } from "lucide-react";
import { useEditor } from "@/stores/editor-store";
import type { Timeline } from "@/lib/editor/types";
import { autoEditAll, autoReframe, removeSilences, syncToBeat, type AutoEditReport } from "@/lib/editor/auto-edit";
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
function AutoEditButton({ disabled }: { disabled: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [report, setReport] = useState<AutoEditReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  // ציר הזמן לפני העריכה האוטומטית, כדי שאפשר יהיה לחזור אליו בלחיצה אחת
  const [before, setBefore] = useState<Timeline | null>(null);

  async function run() {
    setReport(null);
    setError(null);
    setBefore(useEditor.getState().timeline);
    setBusy("מתחיל…");
    try {
      setReport(await autoEditAll(setBusy));
    } catch (e) {
      setError(e instanceof Error ? e.message : "משהו השתבש");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <button onClick={run} disabled={disabled || !!busy}
        className="flex w-full items-center gap-3 rounded-xl bg-gradient-to-l from-violet-600 to-fuchsia-600 p-4 text-start shadow-lg transition hover:brightness-110 disabled:opacity-50">
        {busy ? <Loader2 className="size-7 shrink-0 animate-spin" /> : <Sparkles className="size-7 shrink-0" />}
        <span>
          <span className="block font-semibold">עריכה אוטומטית</span>
          <span className="block text-xs text-violet-100">
            {busy ?? "לחיצה אחת: חיתוך שתיקות, כתוביות, הוק, אימוג'ים, אפקטים וצבע. אחר כך אפשר לשנות הכל."}
          </span>
        </span>
      </button>
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
      {report && (
        <div className="mt-2 space-y-1 rounded-lg bg-zinc-950 p-3 text-xs">
          {report.done.map((d) => <p key={d} className="text-emerald-300">✓ {d}</p>)}
          {report.skipped.map((d) => <p key={d} className="text-amber-300">– {d}</p>)}
          <p className="pt-1 text-zinc-400">מכאן אפשר לשנות כל דבר: לחיצה על טקסט, כתובית או קליפ פותחת את העריכה שלו.</p>
          {before && (
            <button onClick={() => { useEditor.setState({ timeline: before }); setReport(null); setBefore(null); }}
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
