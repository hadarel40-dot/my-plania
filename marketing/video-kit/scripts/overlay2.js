// node overlay2.js specs.json outdir ; spec {name, kind: 'text'|'word'|'card', title, sub, top}
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const F = process.env.FONTS, LOGO = process.env.LOGO;
const d64 = f => 'data:font/woff2;base64,' + fs.readFileSync(F + '/' + f).toString('base64');
const logo = 'data:image/png;base64,' + fs.readFileSync(LOGO).toString('base64');
const logoT = 'data:image/png;base64,' + fs.readFileSync(LOGO.replace('logo.png','logo_t.png')).toString('base64');
const P = x => (x||'').replace(/plania/g, '<bdi dir="ltr">plania</bdi>');
const GREEN = '#405a51', PINK = '#f5afb9';
const specs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); const out = process.argv[3];
const css = `@font-face{font-family:T;src:url(${d64('suez-one-hebrew-400-normal.woff2')});unicode-range:U+0590-05FF,U+200C-2010,U+20AA,U+25CC,U+FB1D-FB4F}
@font-face{font-family:T;src:url(${d64('suez-one-latin-400-normal.woff2')});unicode-range:U+0000-00FF,U+2000-206F}
@font-face{font-family:H;src:url(${d64('gveret-levin-hebrew-400-normal.woff2')})}
html,body{margin:0;width:1080px;height:1920px;background:transparent}
.c{position:absolute;left:60px;right:60px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px}
.t{font-family:T;color:#fff;text-wrap:balance;line-height:1.08;text-shadow:0 0 10px rgba(0,0,0,.6),0 4px 18px rgba(0,0,0,.55),0 2px 4px rgba(0,0,0,.6)}
.s{font-family:H;color:${PINK};text-wrap:balance;line-height:1.15;text-shadow:0 0 6px rgba(0,0,0,.9),0 0 18px rgba(0,0,0,.75),0 2px 3px rgba(0,0,0,.9)}`;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  for (const s0 of specs) {
    const s = {...s0, title: P(s0.title), sub: P(s0.sub)};
    let body;
    if (s.kind === 'card') body = `<div style="position:absolute;inset:0;background:${GREEN}"></div>
      <img src="${logo}" style="position:absolute;left:90px;top:560px;width:900px">
      <div class="c" style="top:1180px"><div class="s" style="font-size:78px;color:#fff;text-shadow:none">${s.sub||''}</div>
      <div class="t" style="font-size:76px;color:${PINK};text-shadow:none;margin-top:30px">${s.title||''}</div></div>`;
    else if (s.kind === 'endlogo') body = `<div class="c" style="top:1240px"><img src="${logoT}" style="width:560px;filter:drop-shadow(0 4px 16px rgba(0,0,0,.45))">
      <div class="s" style="font-size:86px;color:#fff;margin-top:18px">${s.sub||''}</div></div>`;
    else if (s.kind === 'mid') body = `<div style="position:absolute;inset:0;background:${GREEN}"></div>
      <div class="c" style="top:860px"><div class="t" style="font-size:150px;white-space:nowrap;color:${PINK};text-shadow:none">${s.title}</div></div>`;
    else if (s.kind === 'wipe') body = `<div style="position:absolute;inset:0;background:${GREEN}"></div>`;
    else body = `<div class="c" style="top:${s.top||330}px">${s.num?`<div style="width:118px;height:118px;border-radius:50%;background:${PINK};color:${GREEN};font-family:T;font-size:84px;line-height:122px;box-shadow:0 4px 18px rgba(0,0,0,.35);margin-bottom:6px">${s.num}</div>`:''}${s.title?`<div class="t" style="font-size:${s.ts||118}px;color:${s.color||"#fff"}">${s.title}</div>`:''}${s.sub?`<div class="s" style="font-size:${s.ss||92}px">${s.sub}</div>`:''}${s.line?`<div class="t" style="font-size:${s.ls||80}px;margin-top:8px">${P(s.line)}</div>`:''}</div>`;
    await p.setContent(`<html dir="rtl"><head><style>${css}</style></head><body>${body}</body></html>`);
    await p.evaluate(async () => { for (const f of document.fonts) await f.load(); await document.fonts.ready; });
    await p.screenshot({ path: path.join(out, s.name + '.png'), omitBackground: true });
  }
  await b.close();
})();
