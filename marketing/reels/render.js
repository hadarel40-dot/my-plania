// Usage: node render.js <reel.html> <out.mp4> [--stills t1,t2,...]
// Renders the page frame by frame at 30fps through window.seek(), then encodes with ffmpeg.
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const [, , page, out, flag, list] = process.argv;
const FPS = 30;
const WORKERS = 4;

(async () => {
  const browser = await chromium.launch();
  const url = 'file://' + path.resolve(page);
  const open = async () => {
    const p = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
    await p.goto(url);
    await p.evaluate(() => document.fonts.ready);
    return p;
  };

  if (flag === '--stills') {
    const p = await open();
    for (const t of list.split(',').map(Number)) {
      await p.evaluate((t) => seek(t), t);
      await p.screenshot({ path: `${out}-${t}.png` });
    }
    await browser.close();
    return;
  }

  const first = await open();
  const dur = await first.evaluate(() => REEL_DURATION());
  const cues = await first.evaluate(() => SFX_CUES);
  const total = Math.round(dur * FPS);
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'frames-'));
  const pages = await Promise.all(Array.from({ length: WORKERS }, open));
  await Promise.all(pages.map(async (p, w) => {
    for (let f = w; f < total; f += WORKERS) {
      await p.evaluate((t) => seek(t), f / FPS);
      await p.screenshot({ path: path.join(dir, `f${String(f).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 95 });
    }
  }));
  await browser.close();
  fs.writeFileSync(path.join(dir, 'cues.json'), JSON.stringify(cues));
  execFileSync('python3', [path.join(__dirname, 'sfx.py'), path.join(dir, 'cues.json'), String(dur), path.join(dir, 'sfx.wav')]);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(dir, 'f%05d.jpg'),
    '-i', path.join(dir, 'sfx.wav'), '-shortest',
    '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'slow', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', out]);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`${out}: ${total} frames, ${dur}s, ${cues.length} sound cues`);
})();
