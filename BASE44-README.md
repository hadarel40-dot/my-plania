# הדשבורד של Plania's: הקוד, ואיך להעביר אותו ל-Base44

בקובץ הזה נמצא כל מה שהדשבורד ("סטודיו התוכן") צריך כדי לעבוד:
- המסכים
- מנוע הרילים
- הלוגיקה של ה-AI
- מבנה הנתונים
- התהליך השבועי

את עורך הווידאו הישן לא כללתי, חוץ מהקבצים שמנוע הרילים משתמש בהם.

היום הדשבורד בנוי ב-Next.js (React), עם Supabase לנתונים ולקבצים, ו-Remotion לנגן ולייצוא של הרילים.

## מה יש בפנים

| תיקייה | מה זה |
|---|---|
| `video-editor/app/studio/` | כל המסכים: השבוע (`page.tsx`), הריל (`reel/`), לוח, לתכנן מחדש, רעיונות, תוצאות, המותג, ריל מהסרטונים שלי (`own-video/`) ועוד |
| `video-editor/components/studio/` | הרכיבים. החשובים: `reel-player.tsx` (הריל, הגרסאות, העיצוב, כל כרטיס בנפרד, הקריינות), `today.tsx` (לוח השבוע ו"מה עולה היום"), `nav.tsx` (ארבע הלשוניות), `designer-chat.tsx` (המעצב), `learn-panel.tsx` (מה למדנו) |
| `video-editor/lib/studio/` | הלוגיקה. `reel-timeline.ts` הוא לב מנוע הרילים: הגרסאות (A עד K), הכתוביות, הגרפיקה, ערכות העיצוב והמעברים. `engine.ts` ו-`insights.ts` הם הכתיבה עם AI. `reel-edit.ts` מבצע את ההערות למעצב. `learn.ts` לומד מהביצועים |
| `video-editor/app/api/studio/[op]/route.ts` | כל הפעולות בצד השרת (רשימה למטה) |
| `video-editor/remotion/` | הקומפוזיציה שמציירת את הריל: וידאו, כתוביות, גרפיקה, צילומי מסך |
| `video-editor/lib/editor/` | הטיפוסים והכלים שהמנוע משתמש בהם (`types.ts`, `fonts.ts`, `timeline-utils.ts`) |
| `video-editor/supabase/migrations/` | מבנה הטבלאות (בעיקר `0006` עד `0011`) |
| `video-editor/scripts/weekly/` ו-`.claude/weekly/plania.md` | התהליך השבועי (מוצאי שבת) וההוראות שלו |

## מבנה הנתונים (הטבלאות שצריך ב-Base44 כ-Entities)

- **studio_items:** הפוסטים בלוח. הנתונים העיקריים: כותרת, חשבון, פורמט, שלב, יום, סוג תוכן, כיתוב, קישור לטיוטה וקישור לפוסט באינסטגרם.
- **studio_drafts:** הטיוטה של כל פוסט. העמודה `data` היא JSON ובה הכול:
  - `edit`: הקטעים והכרטיסים של הריל
  - `chosen_variant`: הגרסה
  - `reel_design`: העיצוב, צילומי המסך וההגדרות של כל כרטיס
  - `voiceover`: הקריינות
  - `carousel`: הקרוסלה
  - `variants`: הגרסאות
  - `chat`: הצ'אט עם המעצב
  - `published`: הנתונים מאינסטגרם

  הטיפוס המלא נמצא ב-`lib/studio/config.ts` (`DraftData`).
- **studio_voice:** הקול והמותג של כל חשבון, כולל `learnings`.
- **שאר הטבלאות:** studio_feedback, studio_trends, studio_daily, studio_snapshots, studio_suggestions, studio_reviews.

הקבצים (סרטונים, תמונות, קריינות) נשמרים היום ב-Supabase Storage, בדלי `media`.

## הפעולות בצד השרת (מה שהופך ל-Backend Functions ב-Base44)

`hooks`, `script`, `carousel`, `carousel-ideas`, `designer` (הערות למעצב), `designer-undo`, `upload-reel` (ריל מהסרטונים שלי), `drive-match`, `drive-files`, `advisor`, `suggest`, `inspire`, `week-options` (לתכנן מחדש), `plan-week`, `trends`, `today`, `review`, `voice-build`, `voice-suggest`, `instagram`, `learn`, `unlink`.

כולן ב-`app/api/studio/[op]/route.ts`. כל אחת היא `case` נפרד, ואפשר להעתיק כל אחת לפונקציה משלה.

## איך מעבירים ל-Base44: מה עובר כמו שהוא ומה צריך להחליף

1. **מסכים ורכיבים (React ו-Tailwind):** עוברים כמעט כמו שהם. צריך להחליף:
   - `next/link` ב-`Link` של react-router
   - `useRouter` ו-`usePathname` מ-`next/navigation` ב-`useNavigate` ו-`useLocation`
   - למחוק את השורות `"use client"`
2. **נתונים:** כל קריאה ל-`db().from("studio_items")...` הופכת ל-`base44.entities.StudioItem...`. הקריאות האלה מרוכזות בעיקר ב-`lib/studio/client.ts` ובמסכים.
3. **AI:**
   - `askBrain` ב-`lib/ai/brain.ts` עובד עם Gemini או Claude.
   - ב-Base44 אפשר להחליף אותו ב-InvokeLLM, או להשאיר את הקריאה ל-Gemini בתוך Backend Function, עם המפתח כסוד.
   - הפרומפטים עצמם (ב-`engine.ts`, `insights.ts`, `learn.ts`) עוברים כמו שהם.
4. **קבצים:** `db().storage...upload` הופך ל-UploadFile של Base44, והכתובת שחוזרת נשמרת בטיוטה.
5. **מנוע הרילים:**
   - `reel-timeline.ts`, `remotion/` ו-`reel-player.tsx` עוברים כמו שהם.
   - צריך להתקין `remotion`, `@remotion/player`, `@remotion/web-renderer`, `@remotion/media` ו-`mediabunny`, באותן גרסאות שב-`package.json`.
   - הייצוא לקובץ קורה בדפדפן (`lib/export/render-video.ts`), אז לא צריך שרת בשביל זה.
6. **תמלול מדיבור:** `lib/ai/gemini-transcriber.ts` רץ בדפדפן ושולח קטעי סאונד ל-`/api/transcribe`. ב-Base44 הנתיב הזה הופך ל-Backend Function.
7. **מפתחות שצריך להגדיר כסודות:**
   - `GEMINI_API_KEY`
   - `INSTAGRAM_ACCESS_TOKENS`
   - `GOOGLE_SERVICE_ACCOUNT_JSON` ו-`GOOGLE_DRIVE_FOLDER`, בשביל הדרייב
   - `ANTHROPIC_API_KEY`, אם רוצים Claude

## חשוב לדעת

- **רישוי Remotion:** Remotion חינמי ליחידה ולעסק של עד 3 עובדים. אם תמכרי מוצר שכולל את הנגן או את הייצוא, צריך לבדוק מולם את הרישיון.
- **הקובץ החשוב ביותר:** `reel-timeline.ts`. מומלץ להתחיל ממנו ומ-`reel-player.tsx`, כי הם רוב מה שהופך את הריל ל"ריל".
- **מה הוצאתי מהחבילה:** קובצי `.env` (הגדרות) וקובצי מדיה כבדים.
