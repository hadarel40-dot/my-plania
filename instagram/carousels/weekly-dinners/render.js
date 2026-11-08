// node render.js  -> slide-N.png from slides.html (run `NO_RENDER=1 python3 build.py` first)
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1080, height: 1350 } });
  await pg.goto('file://' + path.join(__dirname, 'slides.html'), { waitUntil: 'networkidle' });
  await pg.evaluate(() => document.fonts.ready);
  const els = await pg.$$('section.slide');
  for (let i = 0; i < els.length; i++) {
    await els[i].screenshot({ path: path.join(__dirname, `slide-${i + 1}.png`) });
  }
  await b.close();
})();
