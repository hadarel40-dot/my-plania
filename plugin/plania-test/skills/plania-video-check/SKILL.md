---
name: plania-video-check
description: Use when the user asks to "בדיקת וידאו", "לבדוק אם אפשר לייצר סרטון", or runs the Plania test plugin. Checks whether this Claude environment can render a short vertical Hebrew reel (1080x1920 MP4) with animated captions, and reports what is available.
---

# בדיקת וידאו של Plania

המטרה: לבדוק אם בסביבה הזאת אפשר לייצר סרטון ריל, ולהחזיר למשתמשת את הקובץ ודוח קצר בעברית.

## צעדים

1. הריצי את `scripts/check.py` מתיקיית הסקיל, עם תיקיית פלט שהמשתמשת יכולה להוריד ממנה (למשל `/mnt/user-data/outputs` אם קיימת, אחרת תיקייה זמנית):
   `python3 scripts/check.py --font assets/Assistant-ExtraBold.ttf --out <תיקיית פלט>`
2. הסקריפט מדפיס שורת JSON אחרונה עם התוצאות. אם הוא נכשל, אל תנסי לעקוף בדרכים אחרות. דווחי בדיוק מה נכשל.
3. החזירי למשתמשת:
   - את הסרטון `plania-test.mp4` כקובץ להורדה, אם נוצר.
   - דוח קצר בעברית: האם יש ffmpeg (ואיך הושג), האם יש דפדפן Chromium/Playwright, כמה זמן לקח הרינדור, וגרסת פייתון.
   - שורה אחת: "הבדיקה עברה" או "הבדיקה נכשלה", ולמה.
4. אל תפרסמי שום דבר ואל תשלחי לשום מקום. זו בדיקה בלבד.
