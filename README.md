# my-plania – סוכן AI אישי בוואטסאפ

סוכן אישי שעונה לך בוואטסאפ, מבוסס Claude. הוא עונה **רק למספר שלך**.

מה הוא יודע לעשות:
- לשוחח ולענות על שאלות (זוכר את 30 ההודעות האחרונות)
- לחפש מידע עדכני באינטרנט
- לזכור דברים לטווח ארוך ("תזכור שאני אלרגי לבוטנים")
- לשלוח לך תזכורות בוואטסאפ ("תזכיר לי מחר ב-9 להתקשר לרופא")
- `/reset` – מתחיל שיחה חדשה (פתקים ותזכורות נשמרים)

## לחבר את הפרויקט שלך מ-Claude

- **הוראות הפרויקט** → הדבק ב-`prompt.md`
- **קבצי הידע של הפרויקט** → שים בתיקייה `knowledge/` כקבצי `.md` או `.txt`

הכול נטען אוטומטית בהפעלה.

## הקמה

### 1. מפתח Claude
צור מפתח API ב-https://console.anthropic.com (נדרש אמצעי תשלום; מחויב לפי שימוש).

### 2. WhatsApp Cloud API (של Meta)
1. היכנס ל-https://developers.facebook.com → **My Apps → Create App** → סוג **Business**.
2. הוסף למוצר את **WhatsApp** → **API Setup**.
3. העתק משם את **Phone number ID** ואת ה-**Access token**.
   הטוקן הזמני תקף 24 שעות; לשימוש קבוע צור **System User token** קבוע ב-Business Settings.
4. ברשימת **To** הוסף ואמת את המספר האישי שלך.
5. ב-**App settings → Basic** העתק את **App Secret**.

### 3. הרצה
```bash
pip install -r requirements.txt
cp .env.example .env      # ומלא את הערכים
uvicorn app:app --host 0.0.0.0 --port 8000 --env-file .env
```

השרת צריך כתובת HTTPS ציבורית. אפשרויות:
- **לבדיקה מהמחשב:** `ngrok http 8000`
- **קבוע:** Render / Railway / Fly.io (הגדר את המשתנים מ-`.env` כ-Environment Variables, ודיסק קבוע לקובץ `agent.db`)

### 4. חיבור ה-Webhook
ב-Meta: **WhatsApp → Configuration → Webhook → Edit**
- Callback URL: `https://<הכתובת-שלך>/webhook`
- Verify token: אותו ערך כמו `WHATSAPP_VERIFY_TOKEN`
- תחת **Webhook fields** סמן **messages**.

זהו – שלח הודעה למספר של הבוט.

## הערות
- **תזכורות:** וואטסאפ מאפשר לבוט לשלוח הודעה חופשית רק תוך 24 שעות מההודעה האחרונה שלך אליו. תזכורת רחוקה יותר דורשת Message Template מאושר.
- **מודל:** `claude-opus-5-5` ב-effort `medium`. אם תרצה זול/מהיר יותר, שנה את `MODEL` ב-`agent.py`.
- **Fallback:** מופעל `fallbacks: "default"` – אם המודל מסרב לבקשה, היא מנותבת אוטומטית למודל חלופי.
- כרגע רק הודעות טקסט (לא קוליות/תמונות).

## מבנה
| קובץ | תפקיד |
|---|---|
| `app.py` | שרת ה-Webhook של וואטסאפ + שליחת תזכורות |
| `agent.py` | Claude: הוראות, כלים, לולאת הסוכן |
| `store.py` | SQLite: היסטוריה, פתקים, תזכורות |
| `prompt.md` | ההוראות (האישיות) של הסוכן |
| `knowledge/` | קבצי ידע |
