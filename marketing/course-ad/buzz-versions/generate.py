import os
D='/home/user/my-plania/marketing/course-ad/buzz-versions'
BASE='''
:root{--cream:#E5D9CF;--wine:#5D1519;--soft:rgba(229,217,207,.3)}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Assistant',sans-serif}
#flyer{width:1080px;height:1512px;background:var(--wine);color:var(--cream);position:relative;overflow:hidden;display:flex;flex-direction:column;text-align:center}
b{font-weight:800}
.ltr{direction:ltr;unicode-bidi:isolate;display:inline-block}
.head{display:flex;justify-content:space-between;align-items:center;padding:40px 80px 0;position:relative;z-index:2}
.bsd{font-size:24px;font-weight:700}
.logo{width:190px;display:block}
.tags{display:flex;gap:12px;justify-content:center;margin-top:18px;position:relative;z-index:2}
.tag{border:3px solid var(--cream);padding:6px 22px;font-weight:800;font-size:27px;border-radius:6px}
.tag.fill{background:var(--cream);color:var(--wine)}
.words{position:relative;height:330px;margin-top:14px;z-index:2}
.chip{position:absolute;font-family:'Suez One',serif;font-size:74px;line-height:1;background:var(--cream);color:var(--wine);padding:18px 40px 26px;border-radius:14px;box-shadow:8px 10px 0 rgba(0,0,0,.2)}
.c1{right:110px;top:20px;transform:rotate(-4deg)}
.c2{left:130px;top:50px;transform:rotate(3deg)}
.c3{right:210px;top:180px;transform:rotate(-2deg)}
.seal{position:absolute;left:110px;top:165px;width:170px;height:170px;border-radius:50%;border:3px dashed var(--cream);background:var(--wine);display:flex;align-items:center;justify-content:center;transform:rotate(-10deg);font-weight:800;font-size:28px;line-height:1.15}
.seal span{display:block;font-family:'Suez One',serif;font-size:50px;font-weight:400}
.lead{font-size:27px;font-weight:500;line-height:1.38}
.big{font-family:'Suez One',serif;font-size:42px;line-height:1.15;margin-top:12px}
.swoosh{display:block;width:400px;height:34px;margin:8px auto 0}
.points{display:flex;justify-content:center;padding:30px 70px 0}
.points div{flex:1;font-size:28px;font-weight:700;line-height:1.3;padding:4px 18px}
.points div+div{border-right:2px solid var(--soft)}
.value{position:relative;z-index:2;margin:22px 70px 0;border:2px solid var(--soft);border-radius:20px;padding:18px 30px 20px}
.value h3{font-family:'Suez One',serif;font-weight:400;font-size:36px}
.value ul{list-style:none;display:grid;grid-template-columns:1fr 1fr;gap:6px 30px;margin-top:10px;text-align:right}
.value li{font-size:27px;line-height:1.3;padding-right:22px;position:relative}
.value li:before{content:'';position:absolute;right:0;top:12px;width:12px;height:3px;background:var(--cream)}
.why{font-family:'Suez One',serif;font-size:30px;margin-top:12px}

.pre{font-size:24px;line-height:1.35;margin-top:4px}
.why2{font-size:24px;line-height:1.4;margin-top:4px;opacity:.95}
.box{margin:auto 70px 36px;background:var(--cream);color:var(--wine);border-radius:22px;padding:16px 36px 16px;position:relative;z-index:2}
.box .meta{font-size:28px;font-weight:700}
.box .when{font-size:32px;font-weight:800;margin-top:4px}
.box .sep{opacity:.45;margin:0 12px}
.box hr{border:none;border-top:2px solid rgba(93,21,25,.25);width:70%;margin:10px auto}
.box .reg{font-family:'Suez One',serif;font-size:38px}
.pay{display:inline-block;margin-top:12px;background:var(--wine);color:var(--cream);font-weight:800;font-size:28px;padding:8px 26px;border-radius:8px}
'''
HEAD='''<div class="head"><span class="bsd">בס"ד</span><img class="logo" src="../logo-cream.png" alt="Plania's"></div>
<div class="tags"><span class="tag">קורס AI לבעלות עסקים</span><span class="tag fill">מחזור 1</span></div>'''
WORDS='''<div class="words"><span class="chip c1">פרומפט?</span><span class="chip c2">סקיל?</span><span class="chip c3">קלוד קוד?</span>
<div class="seal"><div>אפשרות ל-<span>4</span>תשלומים<br>קלילים</div></div></div>'''
SW='<svg class="swoosh" viewBox="0 0 560 46"><path d="M6 34 C140 18 320 10 552 14 M60 40 C210 28 380 24 520 26" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg>'
TEXT='''<p class="lead">אם את לא מפסיקה לשמוע את זה סביבך,<br>ומרגישה שכולן כבר יודעות<br>על מה מדברים <b>חוץ ממך</b>...</p>
<p class="big">הגיע הזמן להבין מה זה,<br>ולהשתמש בזה בעסק שלך.</p>'''+SW
POINTS='''<div class="value"><h3>עם מה את יוצאת?</h3>
<p class="pre">לפני הקורס כל אחת בוחרת מה היא רוצה לבנות לעסק שלה, ואת זה <b>בונות יחד</b>.</p><ul>
<li><b>Claude מוכן לעבודה</b> ומותאם לעסק</li>
<li><b>אתר או מוצר דיגיטלי</b> לעסק שלך</li>
<li><b>עריכת פוסטים וסרטונים</b> לבד</li>
<li><b>ליווי צמוד</b> במשך חודש</li></ul>
<p class="why">ידע ששווה הרבה כסף, וחוסך לך הרבה כסף בעסק.</p></div>'''
BOX='''<div class="box"><div class="meta">2 ערבים מעשיים בקבוצה של 6<span class="sep">·</span>כולל ארוחת ערב</div>
<div class="when">ימי שלישי 15.12 ו-22.12<span class="sep">|</span>18:00 עד 21:00</div>
<div class="meta">מרכז קליקה, איתמר</div><span class="pay">אפשרות ל-4 תשלומים קלילים</span><hr>
<div class="reg">לפרטים: <span class="ltr">053-9306048</span></div><div class="meta">ההרשמה בקישור המצורף</div></div>'''
PHOTO="url(../laptop-photo.jpg)"
V={}
# A: full-bleed photo top, gradient into wine
V['a-full-bleed']=('''
.bg{position:absolute;inset:0 0 auto 0;height:930px;background:%s 50%% 62%%/cover no-repeat}
.bg:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(93,21,25,.55) 0%%,rgba(93,21,25,.35) 35%%,rgba(93,21,25,.75) 70%%,#5D1519 100%%)}
.txt{position:relative;z-index:2;margin-top:70px;padding:0 90px}
.txt .lead{text-shadow:0 2px 12px rgba(0,0,0,.35)}
'''%PHOTO, '<div class="bg"></div>'+HEAD+WORDS+'<div class="txt">'+TEXT+'</div>'+POINTS+BOX)
# B: polaroid
V['b-polaroid']=('''
.mid{display:flex;gap:60px;align-items:center;padding:20px 90px 0}
.col{flex:1}
.pol{flex:none;width:250px;background:var(--cream);padding:14px 14px 56px;transform:rotate(-5deg);box-shadow:10px 14px 0 rgba(0,0,0,.25);position:relative}
.pol .ph{height:250px;background:%s 50%% 75%%/cover no-repeat}
.pol .cap{position:absolute;bottom:12px;left:0;right:0;color:var(--wine);font-family:'Suez One',serif;font-size:26px}
.pol:before{content:"";position:absolute;top:-18px;left:110px;width:90px;height:34px;background:rgba(229,217,207,.75);transform:rotate(4deg)}
.lead{font-size:28px}.big{font-size:44px}
'''%PHOTO, HEAD+WORDS+'<div class="mid"><div class="col">'+TEXT+'</div><div class="pol"><div class="ph"></div><div class="cap">ככה זה מתחיל</div></div></div>'+POINTS+BOX)
# C: side strip
V['c-side-strip']=('''
.strip{position:absolute;left:0;top:0;bottom:0;width:360px;background:%s 42%% 70%%/cover no-repeat}
.strip:after{content:"";position:absolute;inset:0;background:linear-gradient(270deg,#5D1519 0%%,rgba(93,21,25,0) 45%%)}
.main{margin-right:0;margin-left:330px;display:flex;flex-direction:column;flex:1;position:relative;z-index:2}
.head{padding:40px 60px 0}
.words{height:430px}
.chip{font-size:68px;padding:14px 32px 22px}
.c1{right:50px;top:20px}.c2{left:70px;top:185px}.c3{right:80px;top:300px}
.seal{left:30px;top:-10px;width:170px;height:170px;font-size:25px}.seal span{font-size:44px}
.txt{padding:0 50px}.lead{font-size:28px}.big{font-size:42px}
.value{margin:20px 40px 0 0;padding:14px 20px}.value ul{grid-template-columns:1fr}.value li{font-size:24px}.why{font-size:28px}.why2{font-size:21px}
.words{height:410px}
.box{margin:auto 40px 44px 0;padding:20px 26px}
.box .when{font-size:28px}.box .meta{font-size:25px}.box .reg{font-size:34px}.pay{font-size:24px}
'''%PHOTO, '<div class="strip"></div><div class="main">'+HEAD+WORDS+'<div class="txt">'+TEXT+'</div>'+POINTS+BOX+'</div>')
# D: circle with rings
V['d-circle']=('''
.mid{display:flex;gap:60px;align-items:center;padding:24px 100px 0}
.col{flex:1}
.circ{flex:none;width:260px;height:260px;position:relative}
.circ .ph{position:absolute;inset:0;border-radius:50%%;background:%s 50%% 72%%/cover no-repeat;border:8px solid var(--cream)}
.circ:before{content:"";position:absolute;inset:-22px;border-radius:50%%;border:3px dashed var(--cream);opacity:.7}
.lead{font-size:28px}.big{font-size:44px}
'''%PHOTO, HEAD+WORDS+'<div class="mid"><div class="col">'+TEXT+'</div><div class="circ"><div class="ph"></div></div></div>'+POINTS+BOX)
for k,(css,body) in V.items():
    html='<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Suez+One&family=Assistant:wght@400;500;600;700;800&display=swap" rel="stylesheet"><style>'+BASE+css+'</style></head><body><section id="flyer">'+body+'</section></body></html>'
    open(f'{D}/{k}.html','w').write(html)
