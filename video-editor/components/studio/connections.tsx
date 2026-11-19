"use client";
import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { studioCall } from "@/lib/studio/client";
import { Label, Loading, Panel } from "./ui";

interface Status { ai: "claude" | "gemini" | null; gemini: boolean; instagram: boolean; drive: boolean; driveEmail: string | null; driveFolder: boolean; cron: boolean }

/** מה מחובר ומה חסר, עם ההוראות לכל מה שחסר */
export function Connections() {
  const [s, setS] = useState<Status | null>(null);
  useEffect(() => { studioCall<Status>("status").then(setS).catch(() => setS(null)); }, []);
  if (!s) return <Panel title="חיבורים"><Loading /></Panel>;
  const row = (ok: boolean, title: string, detail: React.ReactNode) => (
    <li className="flex gap-3 py-2.5">
      {ok ? <Check className="mt-0.5 size-5 shrink-0 text-[#3E6B4F]" /> : <X className="mt-0.5 size-5 shrink-0 text-[#A3402F]" />}
      <div className="text-sm leading-relaxed"><p className="font-bold">{title}</p><div className="text-[#4E473E]">{detail}</div></div>
    </li>
  );
  return (
    <Panel label="הגדרות" title="מה" accent="מחובר">
      <ul className="divide-y divide-[#ECE7DE]">
        {row(s.ai === "claude", s.ai === "claude" ? "כתיבה: Claude" : s.ai === "gemini" ? "כתיבה: Gemini (חינמי, מוגבל)" : "כתיבה: לא מחובר",
          s.ai === "claude" ? "התסריטים, הקרוסלות, היועצת והטרנדים נכתבים ב-Claude, ו-Gemini נשאר כגיבוי." : (
            <>המכסה החינמית של Gemini נגמרת מהר, במיוחד בחיפוש טרנדים. לאיכות גבוהה וללא הגבלה: נכנסים ל-console.anthropic.com, יוצרים API key, ומוסיפים ב-Vercel משתנה בשם <b>ANTHROPIC_API_KEY</b>. התשלום לפי שימוש.</>
          ))}
        {row(s.instagram, "אינסטגרם", s.instagram ? "מחובר. התוצאות, היועצת וההמלצות משתמשות במספרים האמיתיים." : "חסר INSTAGRAM_ACCESS_TOKENS ב-Vercel.")}
        {row(s.cron, "הכנה אוטומטית כל בוקר", s.cron ? "פועלת: טרנדים, רעיונות ושלוש טיוטות משובצות." : "חסר CRON_SECRET ב-Vercel.")}
        {row(s.drive, "דרייב", s.drive ? (
          <>מחובר דרך {s.driveEmail}. {s.driveFolder ? "יש תיקיית ברירת מחדל." : <>כדאי להוסיף ב-Vercel משתנה <b>GOOGLE_DRIVE_FOLDER</b> עם הקישור לתיקיית הסרטונים.</>}</>
        ) : (
          <ol className="mt-1 list-decimal space-y-1 pr-5">
            <li>נכנסים ל-console.cloud.google.com ויוצרים פרויקט (שם חופשי).</li>
            <li>בחיפוש למעלה: <b>Google Drive API</b>, ולוחצים <b>Enable</b>.</li>
            <li>בתפריט: IAM &amp; Admin, ואז <b>Service Accounts</b>, ואז <b>Create service account</b>. שם חופשי, בלי הרשאות. Done.</li>
            <li>נכנסים לחשבון שנוצר, לשונית <b>Keys</b>, ואז Add key, ואז Create new key, ואז <b>JSON</b>. יורד קובץ.</li>
            <li>ב-Vercel מוסיפים משתנה <b>GOOGLE_SERVICE_ACCOUNT_JSON</b>, ומדביקים בו את כל התוכן של הקובץ.</li>
            <li>בדרייב: לוחצים ימני על תיקיית הסרטונים, <b>שיתוף</b>, ומוסיפים את המייל של חשבון השירות (נגמר ב-iam.gserviceaccount.com), צפייה בלבד.</li>
            <li>ב-Vercel מוסיפים גם <b>GOOGLE_DRIVE_FOLDER</b> עם הקישור לתיקייה, ואז Redeploy.</li>
          </ol>
        ))}
      </ul>
      <Label className="mt-2">אחרי כל שינוי ב-Vercel צריך Redeploy כדי שייכנס לתוקף.</Label>
    </Panel>
  );
}
