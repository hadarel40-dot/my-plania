// Builds the 9 slides. Photos: photos/1.jpg, 4.jpg, 7.jpg, 9.jpg (jpg/jpeg/png), then: node src/build.js
const fs=require('fs'),path=require('path');const {chromium}=require('playwright');
const ROOT=path.join(__dirname,'..');const N=9;
const CR='#E4D8CD',BU='#5C151A',LI='#F3EAE2',INK='#5C151A';
function photo(n){for(const e of['jpg','jpeg','png','JPG','JPEG','PNG']){const p=path.join(ROOT,'photos',`${n}.${e}`);if(fs.existsSync(p))return `data:image/${e.toLowerCase()==='png'?'png':'jpeg'};base64,`+fs.readFileSync(p).toString('base64');}return null;}
const img=(n)=>{const p=photo(n);return p?`<div style="position:absolute;inset:0;background:url(${p}) center/cover"></div>`:`<div style="position:absolute;inset:0;background:repeating-linear-gradient(45deg,#9b8a80 0 26px,#a39288 26px 52px);display:flex;align-items:center;justify-content:center"><span style="font:700 34px Rubik;color:#fff;background:#0004;padding:10px 26px;border-radius:30px">תמונה ${n}</span></div>`;};
// continuous dashed thread: enters right edge at Y[i-1], leaves left edge at Y[i]
const Y=[1318,1318,1318,1318,1318,1318,1318,1318,null];
const thread=(i,color,mid)=>{const yin=i===0?null:Y[i-1],yout=Y[i];const pts=mid||[];
 let d='';if(yin!=null)d=`M1080 ${yin} `;else d=`M${pts[0][0]} ${pts[0][1]} `;
 const all=[...(yin!=null?pts:pts.slice(1))];if(yout!=null)all.push([0,yout]);
 let prev=yin!=null?[1080,yin]:pts[0];for(const p of all){const n=4;for(let k=1;k<=n;k++){const x=prev[0]+(p[0]-prev[0])*k/n,y=prev[1]+(p[1]-prev[1])*k/n+(k%2?-14:14)*(k<n?1:0);const qx=prev[0]+(p[0]-prev[0])*(k-.5)/n;d+=`Q${qx} ${y+(k%2?-14:14)} ${x} ${y} `;}prev=p;}
 const end=yout==null?`<circle cx="${prev[0]}" cy="${prev[1]}" r="12" fill="${color}"/>`:'';
 return `<svg width="1080" height="1350" style="position:absolute;inset:0;z-index:0"><path d="${d}" fill="none" stroke="${color}" stroke-width="5" stroke-dasharray="4 16" stroke-linecap="round" opacity=".55"/>${end}</svg>`;};
const ic={chat:'<path d="M5 5h14v10H9l-4 4z"/>',file:'<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/>',mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',cal:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',note:'<path d="M5 4h14v11l-5 5H5z"/><path d="M14 20v-5h5"/>',phone:'<rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M11 18h2"/>'};
const svg=(k,s,c)=>`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ic[k]}</svg>`;
const css=`@import url('https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;700;800;900&family=Amatic+SC:wght@400;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{width:1080px;height:1350px;direction:rtl;font-family:Rubik,sans-serif;overflow:hidden;position:relative}
.c{background:${CR};color:${INK}} .b{background:${BU};color:${LI}}
.z{position:absolute;z-index:2}
.num{position:absolute;z-index:3;bottom:58px;right:76px;font-weight:800;font-size:30px;opacity:.55;direction:ltr}
.handle{position:absolute;z-index:3;bottom:58px;left:76px;font-weight:800;font-size:30px;opacity:.55;direction:ltr}
.ghost{position:absolute;z-index:1;font-weight:900;font-size:420px;line-height:.8;opacity:.07;direction:ltr}
h1{font-weight:900;font-size:88px;line-height:1.08;letter-spacing:-1px}
.hand{font-family:'Amatic SC',cursive;font-size:82px;line-height:1.1}
.body{font-size:40px;line-height:1.45}
mark{background:none;color:inherit;box-shadow:inset 0 -.32em 0 var(--hl)}
.c mark{--hl:#c99a8f88}.b mark{--hl:#ffffff30}
.frame{position:absolute;overflow:hidden;z-index:2;box-shadow:0 30px 60px #0000003a}
.arch{border-radius:400px 400px 28px 28px}
.tape{position:absolute;z-index:3;width:150px;height:44px;background:#f3eae2cc;transform:rotate(-6deg)}
`;
const page=(cls,i,inner,o={})=>`<!doctype html><html lang="he"><head><meta charset="utf-8"><style>${css}</style></head><body class="${cls}">${inner}
${o.noNum?'':`<div class="num">${String(i+1).padStart(2,'0')} / 0${N}</div>`}${o.noHandle?'':`<div class="handle">@plania.il</div>`}</body></html>`;
const S=[];
// 1 COVER — burgundy, arch photo left, title right
S.push(page('b',0,thread(0,LI,[[760,1318]])+`
<div class="frame arch" style="left:76px;top:150px;width:430px;height:640px;border:10px solid ${LI}">${img(1)}</div>
<div class="z" style="right:90px;top:170px;width:460px"><h1 style="font-size:118px;margin-top:10px">יש לך <mark>עסק</mark> קטן?</h1></div>
<div class="z" style="right:90px;left:90px;top:860px"><div class="body" style="font-size:46px;font-weight:500">אחרי שנים שאני עובדת עם עסקים,</div>
<div class="hand" style="font-size:92px;margin-top:6px">הבנתי משהו על מה שבאמת חסר להם.</div></div>
<div class="z" style="left:76px;top:1180px;font-weight:800;font-size:36px">להחליק ←</div>`,{noHandle:true}));
// 2 cream — what clients see vs what's below the line
const item=(t,k)=>`<div style="display:flex;align-items:center;gap:22px;font-size:40px;font-weight:700;padding:20px 0;border-bottom:2px solid #5c151a22">${svg(k,40,BU)}${t}</div>`;
S.push(page('c',1,thread(1,BU)+`
<div class="z" style="right:110px;left:110px;top:150px"><h1>מאחורי כל עסק יש הרבה יותר ממה ש<mark>הלקוחות רואים</mark>.</h1></div>
<div class="z" style="right:110px;left:110px;top:520px">
 <div style="display:flex;justify-content:space-between;align-items:center;background:${BU};color:${LI};border-radius:24px;padding:26px 34px;font-size:36px;font-weight:700"><span>מה שהלקוחות רואים</span><span style="opacity:.7;font-weight:500">האתר, הדף, המוצר</span></div>
 <div style="display:flex;align-items:center;gap:16px;margin:30px 0 6px;font-size:28px;font-weight:700;opacity:.6"><span>מה שקורה מתחת</span><div style="flex:1;border-top:3px dashed ${BU}66"></div></div>
 ${item('פניות','chat')}${item('לקוחות','mail')}${item('הצעות מחיר','file')}${item('תהליכי עבודה','cal')}
 <div class="body" style="margin-top:26px;font-size:36px;opacity:.85">פניות, לקוחות, הצעות מחיר, תהליכי עבודה והמון דברים שצריך לנהל במקביל.</div></div>`));
// 3 burgundy — scattered nodes all wired to "את"
const nodes=[[200,700,'chat','וואטסאפ'],[820,640,'mail','מייל'],[160,1000,'file','קבצים'],[870,960,'note','פתקים'],[520,1060,'cal','יומן']];
const cx=520,cy=870;
const wires=nodes.map(([x,y])=>`<path d="M${cx} ${cy} Q ${(x+cx)/2+60} ${(y+cy)/2-80} ${x} ${y}" stroke="${LI}" stroke-width="3" fill="none" stroke-dasharray="2 12" stroke-linecap="round" opacity=".7"/>`).join('');
S.push(page('b',2,thread(2,LI)+`<svg width="1080" height="1350" style="position:absolute;inset:0;z-index:1">${wires}</svg>
<div class="z" style="right:100px;left:100px;top:140px"><h1 style="font-size:80px">וכשכל דבר נמצא במקום אחר, <mark>מישהו צריך לחבר</mark> בין הכול.</h1>
<div class="body" style="margin-top:24px;opacity:.85">עוד הודעה בוואטסאפ, עוד קובץ, עוד משהו שצריך לזכור.</div></div>
${nodes.map(([x,y,k,t])=>`<div class="z" style="left:${x-80}px;top:${y-38}px;width:160px;display:flex;flex-direction:column;align-items:center;gap:8px"><div style="width:76px;height:76px;border-radius:50%;background:${LI};display:flex;align-items:center;justify-content:center">${svg(k,36,BU)}</div><div style="font-size:26px;font-weight:700">${t}</div></div>`).join('')}
<div class="z" style="left:${cx-70}px;top:${cy-70}px;width:140px;height:140px;border-radius:50%;background:${CR};color:${BU};display:flex;align-items:center;justify-content:center;font-weight:900;font-size:44px;box-shadow:0 0 0 14px #f3eae233">את</div>
<div class="z hand" style="right:100px;left:100px;top:1160px;font-size:66px;text-align:center">ובדרך, גם דברים חשובים הולכים לאיבוד.</div>`,{noHandle:true}));
// 4 cream — taped photo + business card crossed out
S.push(page('c',3,thread(3,BU)+`
<div class="z" style="right:110px;left:110px;top:140px"><div class="hand" style="font-size:72px">ואז הבנתי</div>
<h1 style="font-size:80px">שאתר לעסק יכול להיות הרבה יותר מ<mark>כרטיס ביקור דיגיטלי</mark>.</h1></div>
<div class="frame" style="right:100px;top:640px;width:460px;height:520px;transform:rotate(3deg);border:16px solid #fdf8f4;border-bottom-width:70px">${img(4)}</div>
<div class="tape" style="right:260px;top:622px"></div>
<div class="z" style="left:70px;top:680px;width:360px;background:#fdf8f4;border-radius:16px;padding:30px;transform:rotate(-7deg);box-shadow:0 20px 40px #5c151a30">
 <div style="font-weight:900;font-size:34px">העסק שלי</div><div style="font-size:24px;opacity:.6;margin-top:6px">050-0000000 · אתר</div>
 <svg style="position:absolute;inset:0" width="360" height="130"><path d="M20 20 L340 110 M340 20 L20 110" stroke="${BU}" stroke-width="6" stroke-linecap="round" opacity=".8"/></svg></div>
<div class="z hand" style="left:70px;top:880px;width:390px;font-size:62px;transform:rotate(-3deg)">הוא יכול להיות כלי עבודה של ממש, שנבנה סביב הצרכים של העסק.</div>`));
// 5 cream→burgundy split: numbered editorial list
const opt=(n,t,s)=>`<div style="display:flex;gap:34px;align-items:baseline;padding:34px 0;border-top:2px solid #f3eae233"><div style="font-weight:900;font-size:72px;opacity:.35;width:110px;direction:ltr;text-align:right">${n}</div><div><div style="font-weight:900;font-size:56px">${t}</div><div style="font-size:34px;opacity:.75;margin-top:6px">${s}</div></div></div>`;
S.push(page('b',4,thread(4,LI)+`
<div class="z" style="right:110px;left:110px;top:150px"><h1>לכל עסק יש צרכים אחרים.</h1><div class="hand" style="margin-top:8px">אז למה שהפתרון יהיה זהה?</div></div>
<div class="z" style="right:110px;left:110px;top:560px">${opt('01','אתר','יש עסקים שצריכים אתר.')}${opt('02','מערכת ניהול','יש כאלה שצריכים מערכת ניהול.')}${opt('03','אפליקציה','ויש כאלה שדווקא אפליקציה תשנה להם את כל ההתנהלות.')}</div>`));
// 6 cream — big phone rising from bottom, text top
const row=(l,v,w)=>`<div style="margin-top:20px"><div style="display:flex;justify-content:space-between;font-size:26px;font-weight:600"><span>${l}</span><span style="color:#8a6d6a">${v}</span></div><div style="height:14px;border-radius:7px;background:#efe3da;margin-top:10px;display:flex;justify-content:flex-start"><div style="width:${w}%;border-radius:7px;background:${BU}"></div></div></div>`;
S.push(page('c',5,thread(5,BU)+`
<div class="z" style="right:110px;left:110px;top:140px;text-align:center"><div class="hand" style="font-size:70px">למשל,</div><h1 style="font-size:82px">בניתי אפליקציה ל<mark>מאמנת הרזיה</mark>.</h1>
<div class="body" style="margin-top:20px;font-size:38px;opacity:.85">לכל לקוחה יש אזור אישי עם הנתונים שלה וההתקדמות שלה בתהליך.</div></div>
<div class="z" style="left:300px;top:660px;width:480px;height:800px;background:#fdf8f4;border:14px solid #2b1214;border-radius:64px;padding:46px 36px;color:#2b1214;box-shadow:0 -10px 60px #5c151a33">
 <div style="width:130px;height:12px;border-radius:6px;background:#2b1214;margin:-24px auto 30px"></div>
 <div style="display:flex;justify-content:space-between;align-items:center"><div><div style="font-size:24px;color:#8a6d6a">האזור האישי שלי</div><div style="font-size:40px;font-weight:800">היי, נועה</div></div><div style="width:64px;height:64px;border-radius:50%;background:${CR};display:flex;align-items:center;justify-content:center;font-weight:900;color:${BU};font-size:30px">נ</div></div>
 <div style="background:${BU};color:${LI};border-radius:26px;padding:24px 26px;margin-top:24px;display:flex;align-items:center;gap:24px">
  <svg width="96" height="96" viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" stroke="#ffffff33" stroke-width="4" fill="none"/><circle cx="18" cy="18" r="15" stroke="${LI}" stroke-width="4" fill="none" stroke-dasharray="47 95" stroke-linecap="round" transform="rotate(-90 18 18)"/></svg>
  <div><div style="font-size:22px;opacity:.8">ההתקדמות שלי</div><div style="font-size:36px;font-weight:800">שבוע 6 מתוך 12</div></div></div>
 ${row('מים היום','6/8 כוסות',75)}${row('תפריט שבועי','4/7 ימים',57)}</div>`,{noHandle:false}));
// 7 burgundy — photo + before/after strip
S.push(page('b',6,thread(6,LI)+`
<div class="frame" style="left:76px;top:120px;width:440px;height:560px;border-radius:28px;transform:rotate(-3deg)">${img(7)}</div>
<div class="z" style="right:90px;top:170px;width:440px"><h1 style="font-size:86px">ומה זה <mark>שינה</mark> בעסק?</h1></div>
<div class="z" style="right:90px;left:90px;top:760px">
 <div class="body" style="font-size:40px">במקום לנהל את כל תהליכי הליווי דרך אינסוף הודעות בוואטסאפ, המידע וההתקדמות מרוכזים במקום אחד.</div>
 <div class="hand" style="margin-top:34px;font-size:88px;color:${CR}">פחות התעסקות מסביב, יותר מקום לליווי עצמו.</div></div>`,{noHandle:true}));
// 8 cream — typographic stack
S.push(page('c',7,thread(7,BU)+`
<div class="z" style="right:110px;left:110px;top:150px"><h1>זה מה שאני <mark>אוהבת</mark> ליצור.</h1>
<div class="body" style="margin-top:24px;opacity:.85">פתרונות דיגיטליים שלא רק נראים טוב, אלא מתאימים לאופן שבו העסק באמת עובד.</div></div>
<div class="z" style="right:110px;left:110px;top:620px;font-weight:900;font-size:110px;line-height:1.05">
 <div>אתרים</div><div style="color:transparent;-webkit-text-stroke:3px ${BU}">אפליקציות</div><div>מערכות ניהול</div></div>
<div class="z hand" style="right:110px;left:110px;top:1030px;font-size:74px">מאתרים ועד אפליקציות ומערכות ניהול בהתאמה אישית.</div>`));
// 9 CTA — burgundy, arch photo bottom, thread ends
S.push(page('b',8,thread(8,LI,[[300,1318]])+`
<div class="z" style="right:76px;top:60px;font-weight:900;font-size:42px;direction:ltr">PLANIA'S</div>
<div class="z" style="right:100px;left:100px;top:180px"><h1 style="font-size:84px">מה אם גם העסק שלך יכול <mark>לעבוד אחרת</mark>?</h1>
<div class="body" style="margin-top:22px;font-size:36px;opacity:.9">ספרו לי מה אתם עושים, מה מסורבל לכם היום ומה הייתם רוצים לשנות.</div>
<div class="body" style="margin-top:10px;font-size:36px;opacity:.9">נחשוב יחד על פתרון שמתאים בדיוק לעסק שלכם.</div></div>
<div class="frame arch" style="left:76px;top:740px;width:400px;height:520px;border:10px solid ${LI}">${img(9)}</div>
<div class="z" style="right:100px;top:830px;width:480px"><div class="hand" style="font-size:84px">הפרטים בקישור בביו.</div>
<div style="display:inline-block;margin-top:30px;background:${LI};color:${BU};font-weight:900;font-size:40px;padding:22px 46px;border-radius:60px">לקישור בביו ↑</div></div>`,{noHandle:true}));
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1350}});
for(let i=0;i<N;i++){await p.setContent(S[i],{waitUntil:'networkidle'});await p.evaluate(()=>document.fonts.ready);await p.screenshot({path:path.join(ROOT,`slide-${i+1}.png`)});}
await b.close();console.log('done');})();
