# AI Video Editor (MVP)

עורך וידאו בדפדפן עם וריאציות AI. העורך לא משנה קבצי וידאו. הוא עורך "מתכון" (JSON של קליפים,
חיתוכים, כתוביות ו-looks), והתצוגה מורכבת בזמן אמת עם Remotion.

## הרצה

```bash
cd video-editor
npm install
npm run dev        # http://localhost:3000
```

אין צורך במפתחות API. כרגע הכול רץ במצב דמו מקומי.

## מה עובד

| אזור | יכולות |
|------|--------|
| **ספריית מדיה** (ימין) | 3 קליפים לדוגמה, העלאת קבצים (כפתור או גרירה), לחיצה כפולה מוסיפה לציר הזמן |
| **נגן** (מרכז) | תצוגה חיה של כל הפרויקט, ניגון, צעד פריים, החלפת יחס 9:16 / 16:9 / 1:1 |
| **ציר זמן** (תחתית) | גרירה לסידור מחדש, trim בקצוות, פיצול (`S`), מחיקה (`Delete`), undo/redo (`Ctrl+Z` / `Ctrl+Shift+Z`), זום, גלילה בסרגל |
| **וריאציות AI** (שמאל) | prompt + סגנון + עוצמה + כמות, כרטיסים עם סטטוס והתקדמות, hover מנגן, לחיצה מציגה בנגן לפני החלה, ✓ מחיל, "שנה את זה", "עוד כמו זה", דירוג, מיון, חזרה למקור |
| **כתוביות** | תמלול אוטומטי (מדומה), עריכת טקסט, 3 סגנונות, הזזה על ציר הזמן |
| **ייצוא** | הורדת הפרויקט כ-JSON |

## מה מדומה במצב דמו

- **וריאציות:** `lib/ai/provider.ts` (`mockProvider`) מדמה תור ועיבוד, ומחזיר "look" (פילטר צבע / זום / היפוך) על אותו קובץ במקום וידאו חדש.
- **העלאה:** `lib/media/local-upload.ts` שומר את הקובץ בדפדפן (blob). רענון הדף מוחק את הפרויקט.
- **תמלול:** `lib/ai/mock-transcribe.ts` מחזיר טקסט לדוגמה.

## מבנה

```
app/                     עמוד אחד, העורך נטען בצד הלקוח בלבד
components/editor/       editor · preview · timeline · variants-panel · media-bin · caption-inspector
remotion/                TimelineComposition: אותה קומפוזיציה לתצוגה ולרינדור הסופי
stores/editor-store.ts   מצב העורך (Zustand + Immer + zundo ל-undo)
stores/playback-store.ts מצב הניגון (מופרד כדי לא להיכנס להיסטוריה)
lib/ai/                  ממשק ספק, ספק דמו, סגנונות, תמלול מדומה
lib/editor/              טיפוסים ופונקציות ציר זמן
supabase/migrations/     סכמה לשלב הענן
```

## השלבים הבאים

1. **Supabase:** Auth, שמירת `edit_projects.timeline` (autosave), טבלת `variants` עם Realtime.
2. **העלאה לענן:** Mux Direct Upload או S3 multipart במקום `importLocalFile`, ו-proxy 720p + thumbnails.
3. **ספק אמיתי:** מימוש `VariantProvider` שקורא ל-`POST /api/variants` (fal / Replicate / Runway דרך Inngest), ומאזין לעדכוני הטבלה במקום ל-`onProgress`.
4. **תמלול אמיתי:** Whisper (Groq / fal) עם חותמות זמן למילה.
5. **רינדור:** Remotion Lambda על `TimelineComposition` עם קבצי המקור.

> **רישיון Remotion:** חינמי לאנשים פרטיים ולחברות קטנות. חברות מעל גודל מסוים צריכות רישיון. ראו https://remotion.dev/license
