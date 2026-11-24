# my-plania

## שפה

כל ההודעות למשתמשת נכתבות בעברית: סיכומים, הסברים, שאלות ומה שהיא צריכה לעשות.

## Instagram skills (ig-*)

The voice profile lives in the repo at `.claude/instagram/voice.md`. The ig-* skills look for
`~/.claude/instagram/voice.md`, but in cloud sessions that file does not persist. At the start
of any ig-* task, copy `.claude/instagram/voice.md` to `~/.claude/instagram/voice.md` (or read
the repo copy directly). Write any voice updates back to the repo copy, and do the same for
`swipe.md` and other files the skills keep under `~/.claude/instagram/`.

All Instagram output is in Hebrew.

## הכפר: צוות הסוכנים

לעסק יש צוות של 7 סוכנים ב-`.claude/agents/`, וספריית ידע משותפת ב-`knowledge/` (להתחיל מ-`knowledge/README.md`).
הסשן הראשי הוא "הסוכנת הראשית": מפרקת את הבקשה של הדראל, שולחת לסוכנים המתאימים (Agent tool עם `subagent_type`), ומחברת את התשובות.

| סוכן | תפקיד |
|---|---|
| `researcher` | טרנדים, מתחרים, מה ויראלי בתחום |
| `planner` | מה עולה, מתי ובאיזה פורמט |
| `writer` | כותבת בקול של הדראל: ריל, קרוסלה, כיתוב, דפים |
| `editor` | בודקת כל טיוטה מול הכללים לפני שהדראל רואה |
| `community` | טיוטות לתגובות ול-DM |
| `sales` | הצעות מחיר לאתרים, לידים, דפי נחיתה |
| `librarian` | היחידה שמעדכנת את `knowledge/`: משוב, תשובות, למידה, יומן |

הזרימה הרגילה: חוקרת > מתכננת > כותבת > עורכת > הדראל מאשרת > ספרנית רושמת.
- סוכנים שלא תלויים זה בזה רצים במקביל (למשל חוקרת וספרנית).
- כל טקסט עובר דרך `editor` לפני שהוא מוצג להדראל.
- כשהדראל עונה על שאלה או נותנת משוב, לשלוח ל-`librarian` כדי שזה יישמר.
- בסוף משימה, להוסיף את שורות היומן שהסוכנים החזירו ל-`knowledge/log.md`.
- לא מפרסמים ולא שולחים כלום בלי אישור מפורש שלה (`knowledge/rules.md`).
