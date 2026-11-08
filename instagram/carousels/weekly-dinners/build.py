"""Build the "weekly dinners" carousel for @plania.il.

Run: python3 build.py   -> slides.html + slide-1.png ... slide-9.png (1080x1350)
To use real photos, drop photos/1.jpg ... photos/9.jpg next to this file and run again.
"""
import os
from pathlib import Path

HERE = Path(__file__).parent
TOTAL = 9
DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי"]
LETTERS = dict(zip(DAYS, "אבגדה"))

WEEK = [
    # day, dish, sides, defrost (None = nothing to defrost), when
    ("ראשון", "פסטה ברוטב רוזה", "עם סלט ירוק ולחם שום", None, "ערב פתיחה קל. אין מה להפשיר."),
    ("שני", "שניצל עוף ביתי", "עם פירה וסלט ירקות קצוץ", "חזה עוף", "להוציא ביום ראשון בערב"),
    ("שלישי", "שקשוקה קלאסית", "עם סלט ירקות קצוץ ופיתה", None, "ערב בלי בשר. אין מה להפשיר."),
    ("רביעי", "קציצות בשר ברוטב עגבניות", "עם אורז לבן", "בשר טחון", "להוציא ביום שלישי בערב"),
    ("חמישי", "פרגיות בסויה, סילאן ושום", "ותפוחי אדמה זהובים בתנור", "פרגיות", "להוציא ביום רביעי בערב"),
]


def bg(n):
    p = HERE / "photos" / f"{n}.jpg"
    if p.exists():
        return (f"background:linear-gradient(rgba(20,26,24,.62),rgba(20,26,24,.78)),"
                f"url('photos/{n}.jpg') center/cover;")
    return ""


def frame(n, inner, cls=""):
    return f"""
<section class="slide {cls}" style="{bg(n)}">
  <div class="count">{n}/{TOTAL}</div>
  {inner}
  <div class="handle">@plania.il</div>
</section>"""


def week_strip(active):
    cells = "".join(
        f'<span class="d{" on" if d == active else ""}">{LETTERS[d]}׳</span>' for d in DAYS
    )
    return f'<div class="strip">{cells}</div>'


slides = []

slides.append(frame(1, """
  <div class="center">
    <div class="kicker">תכנון ארוחות</div>
    <h1 class="mega">שבוע שלם</h1>
    <h1 class="big">של ארוחות ערב</h1>
    <p class="sub">כבר מתוכנן.<br>כולל מה להפשיר ומתי.</p>
    """ + week_strip(None) + """
  </div>""", "cover"))

slides.append(frame(2, """
  <div class="center">
    <h1 class="clock"><bdi dir="ltr">18:00</bdi></h1>
    <h1 class="big">מה מכינים?</h1>
    <p class="body">אני אוהבת לבשל.<br>מה שקשה לי זה להחליט כל ערב מחדש,<br>ולזכור להפשיר בזמן.</p>
  </div>"""))

for i, (day, dish, sides, defrost, when) in enumerate(WEEK):
    n = 3 + i
    if defrost:
        box = f'<div class="box"><span class="tag">להפשיר</span><b>{defrost}</b><span>{when}</span></div>'
    else:
        box = f'<div class="box calm"><span>{when}</span></div>'
    slides.append(frame(n, f"""
  <div class="center">
    {week_strip(day)}
    <div class="day">יום {day}</div>
    <h1 class="dish">{dish}</h1>
    <p class="sides">{sides}</p>
    {box}
  </div>"""))

rows = "".join(
    f'<tr><td class="rd">{d}</td><td class="rm">{dish}</td>'
    f'<td class="rf">{"❄ " + defrost if defrost else "—"}</td></tr>'
    for d, dish, _s, defrost, _w in WEEK
)
slides.append(frame(8, f"""
  <div class="center">
    <h1 class="big">השבוע על דף אחד</h1>
    <table>
      <tr class="th"><td>יום</td><td>ארוחת ערב</td><td>להפשיר ערב לפני</td></tr>
      {rows}
    </table>
    <p class="save">שמרו את השקופית הזאת</p>
  </div>"""))

slides.append(frame(9, """
  <div class="center">
    <h1 class="big">רוצה עוד</h1>
    <h1 class="mega"><bdi dir="ltr">+80</bdi> רעיונות?</h1>
    <p class="body">בוקר, צהריים וערב.<br>הכול באינדקס אחד.</p>
    <div class="cta">תגיבו <b>"אינדקס"</b></div>
    <p class="body small">ואשלח לך אותו בפרטי</p>
  </div>""", "last"))

CSS = """
@import url('https://fonts.googleapis.com/css2?family=Rubik:wght@700;900&family=Heebo:wght@400;500;700&display=swap');
:root{--pink:#F2B5C0;--pink2:#F7CFD6;--green:#2F4A43;--deep:#1E302B;--white:#FBF7F2}
*{margin:0;padding:0;box-sizing:border-box}
body{background:#111}
.slide{width:1080px;height:1350px;position:relative;overflow:hidden;direction:rtl;
  font-family:'Heebo',sans-serif;color:var(--white);
  background:radial-gradient(1200px 900px at 80% 10%,#3B5A52 0%,transparent 60%),
             radial-gradient(900px 900px at 10% 100%,#15231F 0%,transparent 60%),var(--green);
  margin-bottom:20px}
.slide::after{content:"";position:absolute;inset:0;pointer-events:none;opacity:.08;
  background-image:radial-gradient(#fff 1px,transparent 1.2px);background-size:6px 6px}
.center{position:absolute;inset:150px 120px;display:flex;flex-direction:column;
  align-items:center;justify-content:center;text-align:center;gap:22px;z-index:1}
.count{position:absolute;top:56px;left:60px;font:500 30px 'Heebo';background:rgba(0,0,0,.35);
  padding:6px 20px;border-radius:30px;z-index:2}
.handle{position:absolute;bottom:52px;left:0;right:0;text-align:center;font:500 30px 'Heebo';
  letter-spacing:1px;opacity:.75;z-index:2;direction:ltr}
h1{font-family:'Rubik';font-weight:900;color:var(--pink);line-height:1.02;
  text-shadow:0 6px 0 rgba(0,0,0,.25)}
.mega{font-size:150px}
.big{font-size:96px}
.clock{font-size:220px;letter-spacing:-4px}
.kicker{font:700 34px 'Heebo';letter-spacing:2px;color:var(--pink2);border:3px solid var(--pink2);
  padding:6px 28px;border-radius:40px}
.sub{font:500 48px/1.35 'Heebo';margin-top:16px}
.body{font:400 46px/1.45 'Heebo';margin-top:20px}
.body.small{font-size:40px;margin-top:0;opacity:.9}
.strip{display:flex;gap:18px;direction:rtl;margin:20px 0}
.strip .d{width:92px;height:92px;border-radius:50%;border:3px solid rgba(251,247,242,.45);
  display:flex;align-items:center;justify-content:center;font:700 40px 'Rubik';color:rgba(251,247,242,.7)}
.strip .d.on{background:var(--pink);border-color:var(--pink);color:var(--deep)}
.cover .strip .d{border-color:var(--pink);color:var(--pink)}
.day{font:700 52px 'Heebo';color:var(--pink2);margin-top:30px}
.dish{font-size:112px}
.sides{font:500 50px/1.3 'Heebo'}
.box{margin-top:50px;background:rgba(251,247,242,.1);border:3px solid rgba(242,181,192,.6);
  border-radius:36px;padding:34px 50px;display:flex;flex-direction:column;gap:8px;min-width:640px}
.box .tag{align-self:center;background:var(--pink);color:var(--deep);font:700 32px 'Heebo';
  padding:4px 24px;border-radius:24px}
.box b{font:900 64px 'Rubik';color:var(--white)}
.box span{font:500 40px 'Heebo'}
.box.calm{border-style:dashed;border-color:rgba(251,247,242,.4)}
table{border-collapse:collapse;width:100%;margin-top:30px;font-family:'Heebo'}
td{padding:26px 14px;border-bottom:2px solid rgba(251,247,242,.2);text-align:right;vertical-align:middle}
.th td{font:700 30px 'Heebo';color:var(--pink2);border-bottom:3px solid var(--pink)}
.rd{font:900 40px 'Rubik';color:var(--pink);width:150px}
.rm{font:500 38px/1.2 'Heebo'}
.rf{font:500 32px 'Heebo';opacity:.9;width:270px}
.th td{white-space:nowrap}
.save{font:700 36px 'Heebo';color:var(--pink2);margin-top:30px}
.cta{margin-top:40px;background:var(--pink);color:var(--deep);font:700 64px 'Heebo';
  padding:28px 64px;border-radius:70px;box-shadow:0 10px 0 rgba(0,0,0,.25)}
.cta b{font-family:'Rubik';font-weight:900}
"""

html = f"""<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<title>שבוע שלם של ארוחות ערב</title><style>{CSS}</style></head>
<body>{''.join(slides)}</body></html>"""
(HERE / "slides.html").write_text(html, encoding="utf-8")

if __name__ == "__main__" and not os.environ.get("NO_RENDER"):
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 1080, "height": 1350})
        pg.goto((HERE / "slides.html").resolve().as_uri())
        pg.wait_for_load_state("networkidle")
        pg.evaluate("document.fonts.ready")
        for i, el in enumerate(pg.query_selector_all("section.slide"), 1):
            el.screenshot(path=str(HERE / f"slide-{i}.png"))
        b.close()
    print("done")
