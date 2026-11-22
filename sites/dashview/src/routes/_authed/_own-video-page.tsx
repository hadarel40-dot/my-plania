import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Film, Mic, UploadCloud, X } from "lucide-react";
import { CONTENT_TYPES, type ContentType } from "@/lib/studio/config";
import { db, formatDate, studioCall, todayIL } from "@/lib/studio/client";
import { MEDIA_BUCKET } from "@/lib/supabase/env";
import { Btn, Field, PageHead, Panel, Select, inputCls, toast } from "@/components/reel/ui";
import { cn } from "@/lib/utils";

const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

interface Picked { file: File; url: string; w: number; h: number; seconds: number }

const meta = (file: File) => new Promise<Picked>((res, rej) => {
  const url = URL.createObjectURL(file);
  const v = document.createElement("video");
  v.preload = "metadata"; v.muted = true;
  v.onloadedmetadata = () => res({ file, url, w: v.videoWidth, h: v.videoHeight, seconds: v.duration });
  v.onerror = () => rej(new Error(`${file.name}: הסרטון לא נקרא`));
  v.src = url;
});

/**
 * ריל מהסרטונים שלי, בלי עורך: מעלים סרטון אחד או כמה.
 * יש דיבור: הכתוביות נכתבות מהדיבור עצמו (Gemini מקשיב), והקול נשאר.
 * אין דיבור: מכל סרטון נלקח רגע קצר, והטקסט נכתב לפי הרעיון.
 * הריל נכנס ללוח ביום שבחרתי, ונפתח לעיצוב בדשבורד (גרסאות, גופנים, גרפיקה).
 */
export default function UploadReelPage() {
  const navigate = useNavigate();
  const [files, setFiles] = useState<Picked[]>([]);
  const [idea, setIdea] = useState("");
  const [account, setAccount] = useState("");
  // החשבון: מהפרופיל של המשתמשת (שם העסק), ואם אין, השם שלה
  useEffect(() => { db().auth.getUser().then(({ data }) => setAccount((a) => a || (data.user as { full_name?: string; email?: string } | null)?.full_name || (data.user as { email?: string } | null)?.email || "החשבון שלי")); }, []);
  const [type, setType] = useState<ContentType>("story");
  const [day, setDay] = useState(addDays(todayIL(), 1));
  const [step, setStep] = useState("");
  // היום הפנוי הקרוב כברירת מחדל
  useEffect(() => {
    const days = Array.from({ length: 10 }, (_, i) => addDays(todayIL(), i + 1));
    db().from("studio_items").select("planned_date").eq("account", account).in("planned_date", days).then(({ data }) => {
      const used = new Set((data ?? []).map((x) => x.planned_date as string));
      const free = days.find((d) => !used.has(d) && new Date(`${d}T12:00:00`).getDay() !== 6);
      if (free) setDay(free);
    });
  }, [account]);

  const pick = async (list: FileList | null) => {
    if (!list) return;
    try {
      const add = await Promise.all([...list].filter((f) => f.type.startsWith("video/")).map(meta));
      setFiles((x) => [...x, ...add].slice(0, 20));
    } catch (e) { toast((e as Error).message, true); }
  };

  const build = async () => {
    if (!files.length) return toast("בוחרים לפחות סרטון אחד", true);
    try {
      // 1. מקשיבים לדיבור (אם יש), על כל הסרטונים ברצף
      setStep("מקשיבה אם מדברים בסרטון...");
      let transcript: { start: number; end: number; text: string }[] = [];
      try {
        const { transcribeFiles } = await import("@/lib/ai/transcribe-lite");
        const r = await transcribeFiles(files, (s) => setStep(s));
        if (r.missingKey) toast("התמלול עוד לא מחובר (חסר מפתח Gemini). הריל ייבנה בלי כתוביות מהדיבור.");
        transcript = r.segments.filter((c) => c.text.trim());
      } catch (e) {
        const msg = (e as Error).message;
        if (/מכסה/.test(msg)) toast(msg, true);
      }
      // 2. מעלים את הסרטונים
      const { data: u } = await db().auth.getUser();
      if (!u.user) throw new Error("צריך להתחבר מחדש");
      const uploaded = [];
      for (const [i, f] of files.entries()) {
        setStep(`מעלה סרטון ${i + 1} מתוך ${files.length}...`);
        const ext = (f.file.name.split(".").pop() || "mp4").toLowerCase();
        const path = `${u.user.id}/studio/uploads/${Date.now()}-${i}.${ext}`;
        const { error } = await db().storage.from(MEDIA_BUCKET).upload(path, f.file, { contentType: f.file.type || "video/mp4" });
        if (error) throw new Error(error.message);
        uploaded.push({ path, w: f.w, h: f.h, seconds: +f.seconds.toFixed(2) });
      }
      // 3. בונים את הריל (כתוביות, כיתוב), ומשבצים ביום
      setStep(transcript.length ? "כותבת כתוביות מהדיבור וכיתוב לפוסט..." : "בונה את הריל וכותבת טקסט...");
      const { draftId } = await studioCall<{ draftId: string; talking: boolean }>("upload-reel", { account, idea, content_type: type, date: day, clips: uploaded, transcript });
      navigate({ to: "/reel", search: { id: draftId } });
    } catch (e) { toast((e as Error).message, true); setStep(""); }
  };

  const total = files.reduce((n, f) => n + f.seconds, 0);
  return (
    <>
      <PageHead label="יצירה" title="ריל" accent="מהסרטונים שלי" sub="מעלים סרטון אחד או כמה. סרטון דיבור מקבל כתוביות מהדיבור. סרטונים בלי דיבור נחתכים לרגעים קצרים, והטקסט נכתב לפי הרעיון." />
      <Panel>
        <div className="space-y-4">
          <label className={cn("flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-5 text-center transition", files.length ? "border-[#E3D9CC]" : "border-[#B5848E] bg-[#FAF6F1] hover:bg-[#F2ECE4]")}>
            <UploadCloud className="size-8 text-[#5E1D1D]" />
            <span className="text-[15px] font-bold text-[#5E1D1D]">{files.length ? "+ להוסיף עוד סרטונים" : "לבחור סרטונים מהטלפון"}</span>
            <span className="text-[12px] text-[#6A6158]">אפשר כמה ביחד. הסדר כאן הוא הסדר בריל.</span>
            <input type="file" accept="video/*" multiple className="sr-only" onChange={(e) => { void pick(e.target.files); e.target.value = ""; }} />
          </label>

          {files.length > 0 && (
            <div>
              <p className="mb-2 text-[13px] font-bold text-[#5E1D1D]">{files.length} סרטונים · {Math.round(total)} שניות</p>
              <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
                {files.map((f, i) => (
                  <div key={f.url} className="relative w-[84px] shrink-0 overflow-hidden rounded-xl border border-[#E3D9CC] bg-black">
                    <video src={f.url} muted playsInline className="aspect-[9/16] w-full object-cover" />
                    <span className="absolute bottom-1 right-1 rounded-full bg-black/60 px-1.5 text-[10px] font-bold text-white">{i + 1} · {Math.round(f.seconds)}ש׳</span>
                    <button type="button" aria-label="להסיר" onClick={() => setFiles((x) => x.filter((_, j) => j !== i))} className="absolute left-1 top-1 grid size-6 place-items-center rounded-full bg-black/60 text-white"><X className="size-3.5" /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Field label="על מה הריל (לא חובה בסרטון דיבור)">
            <input className={inputCls} value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="למשל: איך אני מתכננת ארוחות לשבוע בעשר דקות" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="חשבון באינסטגרם"><input className={inputCls} value={account} onChange={(e) => setAccount(e.target.value)} dir="auto" /></Field>
            <Field label="סוג תוכן"><Select value={type} onChange={setType} options={CONTENT_TYPES} /></Field>
            <Field label={`יום (${formatDate(day)})`}><input type="date" className={inputCls} value={day} min={todayIL()} onChange={(e) => setDay(e.target.value)} /></Field>
          </div>

          <div className="grid gap-2 rounded-2xl bg-[#FAF6F1] p-3 text-[12px] leading-relaxed text-[#4E4540] sm:grid-cols-2">
            <p className="flex gap-2"><Mic className="mt-0.5 size-4 shrink-0 text-[#5E1D1D]" />מדברים בסרטון? הכתוביות נכתבות מהדיבור, בדיוק במה שנאמר, והקול נשאר.</p>
            <p className="flex gap-2"><Film className="mt-0.5 size-4 shrink-0 text-[#5E1D1D]" />בלי דיבור? מכל סרטון נלקח רגע קצר, והטקסט נכתב לפי הרעיון.</p>
          </div>

          <Btn busy={!!step} disabled={!files.length} onClick={build} className="min-h-[50px] w-full text-[15px]">{step || "לבנות את הריל"}</Btn>
          <p className="text-[11px] text-[#9A8C85]">אחרי הבנייה הריל נפתח בדשבורד: גרסאות, גופנים, גרפיקה, קריינות וצילומי מסך. שום דבר לא מתפרסם.</p>
        </div>
      </Panel>
    </>
  );
}
