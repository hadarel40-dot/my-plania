// Builds the 9 slides. Photos: put photos/1.jpg, 4.jpg, 7.jpg, 9.jpg (any of jpg/png/jpeg) and re-run: node src/build.js
const fs=require('fs'),path=require('path');const {chromium}=require('playwright');
const ROOT=path.join(__dirname,'..');const N=9;
const C={cream:'#E4D8CD',bur:'#5C151A',ink:'#5C151A',light:'#F3EAE2'};
function photo(n){for(const e of['jpg','jpeg','png','JPG','JPEG','PNG']){const p=path.join(ROOT,'photos',`${n}.${e}`);if(fs.existsSync(p))return 'data:image/'+(e.toLowerCase()==='png'?'png':'jpeg')+';base64,'+fs.readFileSync(p).toString('base64');}return null;}
const ic={
 heart:'<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
 globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
 grid:'<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
 phone:'<rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M11 18h2"/>',
 chat:'<path d="M5 5h14v10H9l-4 4z"/>',file:'<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 16h5"/>',
 bell:'<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
};
const svg=(k,s=40,c=C.bur)=>`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ic[k]}</svg>`;
const css=`@import url('https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;700;800;900&family=Amatic+SC:wght@400;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{width:1080px;height:1350px;direction:rtl;font-family:Rubik,sans-serif;overflow:hidden;position:relative}
.cream{background:${C.cream};color:${C.ink}} .bur{background:${C.bur};color:${C.light}}
.num{position:absolute;top:62px;left:76px;font-weight:800;font-size:34px;opacity:.6;direction:ltr}
.handle{position:absolute;bottom:58px;left:76px;font-weight:800;font-size:32px;opacity:.6;direction:ltr}
.pad{position:absolute;right:120px;left:120px}
h1{font-weight:900;font-size:92px;line-height:1.08;letter-spacing:-1px}
.hand{font-family:'Amatic SC',cursive;font-weight:400;font-size:84px;line-height:1.1}
.body{font-size:42px;line-height:1.45;font-weight:400}
.photo{position:absolute;inset:0;background-size:cover;background-position:center}
.ph{position:absolute;inset:0;background:repeating-linear-gradient(45deg,#8d7b70 0 30px,#94827a 30px 60px);display:flex;align-items:center;justify-content:center}
.ph span{font-size:40px;color:#fff;background:#0004;padding:14px 30px;border-radius:40px;font-weight:700}
.onphoto{color:${C.light}}
.pill{display:inline-block;background:${C.light};color:${C.bur};font-weight:800;font-size:38px;padding:12px 34px;border-radius:50px}
.card{background:#fdf8f4;border-radius:36px;box-shadow:0 30px 60px #5c151a26;color:#2b1214}
.bcard{background:#ffffff12;border:1.5px solid #ffffff22;border-radius:30px;padding:34px;}
.ibox{width:80px;height:80px;border-radius:20px;background:${C.light};display:flex;align-items:center;justify-content:center}
.chip{display:inline-flex;align-items:center;gap:14px;background:#fdf8f4;border-radius:60px;padding:20px 34px;font-size:38px;font-weight:700;color:#2b1214;box-shadow:0 18px 40px #5c151a22;position:absolute}
.notif{display:flex;align-items:center;gap:22px;background:#fdf8f4;border-radius:30px;padding:24px 28px;color:#2b1214;box-shadow:0 20px 40px #0003}
.notif b{font-size:32px;display:block}.notif small{font-size:27px;color:#8a6d6a}
`;
const page=(cls,inner,i,opt={})=>`<!doctype html><html lang="he"><head><meta charset="utf-8"><style>${css}</style></head><body class="${cls}">${inner}
${opt.noNum?'':`<div class="num">${i}/${N}</div>`}${opt.handle?`<div class="handle">@plania.il</div>`:''}</body></html>`;
const bg=(n,overlay)=>{const p=photo(n);return (p?`<div class="photo" style="background-image:url(${p})"></div>`:`<div class="ph"><span>תמונה ${n}</span></div>`)+`<div class="photo" style="background:${overlay}"></div>`;};
const S=[];
// 1 COVER
S.push(page('',bg(1,`linear-gradient(180deg,transparent 35%,${C.bur}cc 62%,${C.bur} 88%)`)+`
<div class="pad onphoto" style="bottom:150px">
 <div class="pill" style="margin-bottom:40px">יש לך עסק קטן?</div>
 <h1 style="font-size:104px">אחרי שנים שאני עובדת עם עסקים,</h1>
 <div class="hand" style="margin-top:24px;font-size:92px">הבנתי משהו על מה שבאמת חסר להם.</div>
</div><div style="position:absolute;bottom:60px;right:120px;color:${C.light};font-weight:800;font-size:34px">להחליק ←</div>`,1,{}));
// 2 cream + chips
S.push(page('cream',`<div class="pad" style="top:200px">
 <h1>מאחורי כל עסק יש הרבה יותר ממה שהלקוחות רואים.</h1>
 <div class="body" style="margin-top:34px;opacity:.85">פניות, לקוחות, הצעות מחיר, תהליכי עבודה והמון דברים שצריך לנהל במקביל.</div></div>
 <div style="position:absolute;inset:760px 0 0 0">
 <div class="chip" style="top:40px;right:130px;transform:rotate(-4deg)">${svg('chat',36)} פניות</div>
 <div class="chip" style="top:70px;left:150px;transform:rotate(5deg)">${svg('heart',36)} לקוחות</div>
 <div class="chip" style="top:220px;right:300px;transform:rotate(3deg)">${svg('file',36)} הצעות מחיר</div>
 <div class="chip" style="top:370px;right:110px;transform:rotate(-3deg)">${svg('grid',36)} תהליכי עבודה</div>
 <div class="chip" style="top:360px;left:120px;transform:rotate(-6deg)">ועוד…</div></div>`,2,{handle:true}));
// 3 burgundy + notifications
const nt=(k,t,s,rot,mr)=>`<div class="notif" style="transform:rotate(${rot}deg);margin-right:${mr}px;width:720px"><div class="ibox" style="width:70px;height:70px;background:${C.bur}">${svg(k,34,C.light)}</div><div><b>${t}</b><small>${s}</small></div></div>`;
S.push(page('bur',`<div class="pad" style="top:190px">
 <h1>וכשכל דבר נמצא במקום אחר, מישהו צריך לחבר בין הכול.</h1>
 <div class="body" style="margin-top:30px;opacity:.85">עוד הודעה בוואטסאפ, עוד קובץ, עוד משהו שצריך לזכור.</div></div>
 <div class="pad" style="top:720px;display:flex;flex-direction:column;gap:22px">
 ${nt('chat','הודעה חדשה בוואטסאפ','"היי, רציתי לשאול על…"',-2,0)}
 ${nt('file','קובץ חדש','הצעת_מחיר_סופי_2.pdf',1.5,90)}
 ${nt('bell','תזכורת','לחזור ללקוחה מאתמול',-1,30)}</div>
 <div class="pad hand" style="bottom:110px;font-size:80px">ובדרך, גם דברים חשובים הולכים לאיבוד.</div>`,3,{}));
// 4 photo, text top
S.push(page('',bg(4,`linear-gradient(0deg,transparent 40%,${C.bur}bb 62%,${C.bur}ee 100%)`)+`
<div class="pad onphoto" style="top:160px">
 <h1 style="font-size:84px">ואז הבנתי שאתר לעסק יכול להיות הרבה יותר מכרטיס ביקור דיגיטלי.</h1>
 <div class="hand" style="margin-top:26px">הוא יכול להיות כלי עבודה של ממש, שנבנה סביב הצרכים של העסק.</div></div>`,4,{}));
// 5 burgundy cards
const bc=(k,t,s)=>`<div class="bcard" style="display:flex;gap:30px;align-items:center"><div class="ibox">${svg(k,40)}</div><div><div style="font-weight:800;font-size:44px">${t}</div><div style="font-size:32px;opacity:.75;margin-top:6px">${s}</div></div></div>`;
S.push(page('bur',`<div class="pad" style="top:200px">
 <h1>לכל עסק יש צרכים אחרים.</h1>
 <div class="hand" style="margin-top:16px">אז למה שהפתרון יהיה זהה?</div></div>
 <div class="pad" style="top:600px;display:flex;flex-direction:column;gap:30px">
 ${bc('globe','אתר','יש עסקים שצריכים אתר.')}
 ${bc('grid','מערכת ניהול','יש כאלה שצריכים מערכת ניהול.')}
 ${bc('phone','אפליקציה','ויש כאלה שדווקא אפליקציה תשנה להם את כל ההתנהלות.')}</div>`,5,{handle:true}));
// 6 cream + phone mockup
const row=(l,v,w)=>`<div style="margin-top:22px"><div style="display:flex;justify-content:space-between;font-size:24px;font-weight:600"><span>${l}</span><span style="color:#8a6d6a">${v}</span></div><div style="height:14px;border-radius:7px;background:#efe3da;margin-top:10px"><div style="width:${w}%;height:100%;border-radius:7px;background:${C.bur}"></div></div></div>`;
const bars=[62,70,58,76,82,74,90].map(h=>`<div style="flex:1;height:${h}%;background:${C.bur};border-radius:8px 8px 0 0;opacity:${.35+h/150}"></div>`).join('');
S.push(page('cream',`<div class="pad" style="top:200px;left:500px">
 <h1 style="font-size:70px">למשל, בניתי אפליקציה למאמנת הרזיה.</h1>
 <div class="body" style="margin-top:30px;font-size:38px;opacity:.85">לכל לקוחה יש אזור אישי עם הנתונים שלה וההתקדמות שלה בתהליך.</div></div>
 <div class="card" style="position:absolute;left:80px;top:250px;width:370px;height:800px;border-radius:56px;border:12px solid #2b1214;padding:40px 30px;transform:rotate(-3deg)">
 <div style="width:110px;height:10px;border-radius:5px;background:#2b1214;margin:-20px auto 30px"></div>
 <div style="font-size:24px;color:#8a6d6a">האזור האישי שלי</div><div style="font-size:38px;font-weight:800;margin-top:4px">היי, נועה 👋</div>
 <div style="background:${C.bur};color:${C.light};border-radius:24px;padding:24px;margin-top:26px"><div style="font-size:22px;opacity:.8">ההתקדמות שלי</div><div style="font-size:44px;font-weight:800;margin-top:6px">שבוע 6 מתוך 12</div><div style="height:12px;border-radius:6px;background:#ffffff33;margin-top:14px"><div style="width:50%;height:100%;border-radius:6px;background:${C.light}"></div></div></div>
 <div style="display:flex;align-items:flex-end;gap:10px;height:120px;margin-top:24px">${bars}</div>
 ${row('מים היום','6/8 כוסות',75)}${row('צעדים','7,200',72)}${row('תפריט שבועי','4/7 ימים',57)}</div>`,6,{handle:true}));
// 7 photo, text bottom
S.push(page('',bg(7,`linear-gradient(180deg,transparent 25%,${C.bur}cc 52%,${C.bur} 80%)`)+`
<div class="pad onphoto" style="bottom:130px">
 <h1>ומה זה שינה בעסק?</h1>
 <div class="body" style="margin-top:28px;font-size:40px">במקום לנהל את כל תהליכי הליווי דרך אינסוף הודעות בוואטסאפ, המידע וההתקדמות מרוכזים במקום אחד.</div>
 <div class="hand" style="margin-top:28px">פחות התעסקות מסביב, יותר מקום לליווי עצמו.</div></div>`,7,{}));
// 8 burgundy
const tile=(k,t)=>`<div class="bcard" style="flex:1;display:flex;flex-direction:column;align-items:flex-start;gap:24px"><div class="ibox">${svg(k,40)}</div><div style="font-weight:800;font-size:40px">${t}</div></div>`;
S.push(page('bur',`<div class="pad" style="top:200px">
 <h1>זה מה שאני אוהבת ליצור.</h1>
 <div class="body" style="margin-top:30px;opacity:.85">פתרונות דיגיטליים שלא רק נראים טוב, אלא מתאימים לאופן שבו העסק באמת עובד.</div></div>
 <div class="pad" style="top:640px;display:flex;gap:26px">${tile('globe','אתרים')}${tile('phone','אפליקציות')}${tile('grid','מערכות ניהול')}</div>
 <div class="pad hand" style="top:960px">מאתרים ועד אפליקציות ומערכות ניהול בהתאמה אישית.</div>`,8,{handle:true}));
// 9 CTA photo
S.push(page('',bg(9,`linear-gradient(180deg,${C.bur}f2 0%,${C.bur}cc 45%,${C.bur}55 75%,transparent 100%)`)+`
<div style="position:absolute;top:60px;right:76px;color:${C.light};font-weight:900;font-size:46px;direction:ltr;letter-spacing:1px">PLANIA'S<div style="height:3px;background:${C.light};border-radius:2px;margin-top:4px;opacity:.8"></div></div>
<div class="pad onphoto" style="top:200px">
 <h1>מה אם גם העסק שלך יכול לעבוד אחרת?</h1>
 <div class="body" style="margin-top:28px;font-size:38px">ספרו לי מה אתם עושים, מה מסורבל לכם היום ומה הייתם רוצים לשנות. נחשוב יחד על פתרון שמתאים בדיוק לעסק שלכם.</div>
 <div class="hand" style="margin-top:22px">הפרטים בקישור בביו.</div>
 <div class="pill" style="margin-top:34px;font-size:42px;padding:22px 46px">לקישור בביו ↑</div></div>
<div style="position:absolute;bottom:58px;right:76px;color:${C.light};font-weight:800;font-size:34px;opacity:.7">9/9</div>`,9,{noNum:true}));
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1350}});
for(let i=0;i<N;i++){await p.setContent(S[i],{waitUntil:'networkidle'});await p.evaluate(()=>document.fonts.ready);
await p.screenshot({path:path.join(ROOT,`slide-${i+1}.png`)});}
await b.close();console.log('done');})();
