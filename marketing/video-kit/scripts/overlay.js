// Renders on-screen text layers as transparent 1080x1920 PNGs.
// Usage: node scripts/overlay.js spec.json outdir
// spec: [{id, kind: "text"|"endlogo", title, sub, pos: "top"|"low", pink: bool, num}]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
// Inline as data URIs: file:// URLs are blocked inside setContent pages.
const data = (f, mime) => `data:${mime};base64,` + fs.readFileSync(path.join(root, f)).toString('base64');
const font = f => data('assets/fonts/' + f, 'font/woff2');
const logo = data('assets/logo_t.png', 'image/png');

const css = `
@font-face{font-family:Suez;src:url(${font('suez-one-hebrew-400-normal.woff2')});unicode-range:U+0590-05FF,U+FB1D-FB4F;}
@font-face{font-family:Suez;src:url(${font('suez-one-latin-400-normal.woff2')});}
@font-face{font-family:Gveret;src:url(${font('gveret-levin-hebrew-400-normal.woff2')});}
html,body{margin:0;width:1080px;height:1920px;background:transparent;}
.box{position:absolute;left:90px;right:90px;direction:rtl;text-align:center;display:flex;flex-direction:column;align-items:center;gap:14px;}
.top{top:250px}.low{top:1050px}
.t{font-family:Suez;font-size:92px;line-height:1.12;color:#fff;text-wrap:balance;
   text-shadow:0 4px 18px rgba(0,0,0,.55),0 1px 4px rgba(0,0,0,.45);}
.pink .t{color:#f5afb9}
.s{font-family:Gveret;font-size:80px;line-height:1.1;color:#f5afb9;text-wrap:balance;
   text-shadow:0 0 6px rgba(0,0,0,.9),0 3px 14px rgba(0,0,0,.8),0 0 2px #000;}
.num{width:96px;height:96px;border-radius:50%;background:#f5afb9;color:#405a51;font-family:Suez;font-size:62px;
   display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,.35)}
.logo{position:absolute;left:50%;top:1180px;transform:translateX(-50%);width:640px;
   filter:drop-shadow(0 4px 16px rgba(0,0,0,.45));}
`;

(async () => {
  const [specPath, outDir] = process.argv.slice(2);
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  for (const s of spec) {
    let body;
    if (s.kind === 'endlogo') {
      body = `<img class="logo" src="${logo}">`;
    } else {
      body = `<div class="box ${s.pos || 'top'} ${s.pink ? 'pink' : ''}">
        ${s.num ? `<div class="num">${s.num}</div>` : ''}
        ${s.title ? `<div class="t">${s.title}</div>` : ''}
        ${s.sub ? `<div class="s">${s.sub}</div>` : ''}</div>`;
    }
    await page.setContent(`<html><head><style>${css}</style></head><body>${body}</body></html>`);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(outDir, s.id + '.png'), omitBackground: true });
  }
  await browser.close();
})();
