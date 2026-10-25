// Tiny frame-accurate timeline for rendering reels with Playwright.
// Each reel page calls E.scene(...) and the renderer calls window.seek(seconds) per frame.
(function () {
  const stage = document.getElementById('stage');
  const scenes = [];
  const cues = []; // sound effects: {t, name, gain}
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);
  const easeBack = (x) => { const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  const prog = (lt, start, dur) => clamp((lt - start) / dur);

  function el(parent, tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    parent.appendChild(n);
    return n;
  }

  // anims: {node, start, dur, type}
  function applyAnim(a, lt) {
    const p = prog(lt, a.start, a.dur);
    const n = a.node;
    if (a.type === 'pop') {
      const s = p === 0 ? 0.6 : 0.6 + 0.4 * easeBack(p);
      n.style.opacity = clamp(p * 3);
      n.style.transform = `scale(${s})`;
    } else if (a.type === 'up') {
      n.style.opacity = clamp(p * 2);
      n.style.transform = `translateY(${(1 - easeOut(p)) * 60}px)`;
    } else if (a.type === 'left') {
      n.style.opacity = clamp(p * 2);
      n.style.transform = `translateX(${(1 - easeOut(p)) * -80}px)`;
    } else if (a.type === 'fade') {
      n.style.opacity = easeOut(p);
    } else if (a.type === 'strike') {
      n.style.transform = `scaleX(${easeOut(p)})`;
    } else if (a.type === 'mark') {
      n.style.backgroundSize = `${easeOut(p) * 100}% 38%`;
    }
  }

  function scene(t0, t1, opts, build) {
    const root = el(stage, 'div', 'scene ' + (opts.bg || 'cream'));
    const inner = el(root, 'div', 'inner');
    const anims = [];
    if (t0 > 0) cues.push({ t: Math.max(0, t0 - 0.12), name: 'whoosh', gain: 0.8 });
    const api = {
      sfx: (name, at = 0, gain = 1) => cues.push({ t: t0 + at, name, gain }),
      el: (parent, tag, cls, html) => el(parent || inner, tag, cls, html),
      anim: (node, start, type = 'up', dur = 0.4) => { anims.push({ node, start, dur, type }); return node; },
      // Word-by-word line. Wrap emphasis in *stars* for the serif accent.
      words: (parent, text, cls, start, step = 0.16, type = 'pop') => {
        const line = el(parent || inner, 'div', 'line ' + (cls || ''));
        text.split(' ').forEach((w, i) => {
          const em = /^\*.*\*[.,!?]?$/.test(w);
          const span = el(line, 'span', 'w' + (em ? ' em' : ''), w.replace(/\*/g, ''));
          anims.push({ node: span, start: start + i * step, dur: 0.32, type });
        });
        return line;
      },
    };
    const update = build(inner, api) || (() => {});
    scenes.push({ t0, t1, root, inner, anims, update, drift: opts.drift ?? 0.035 });
  }

  // Returns a promise when a scene swaps images, so the renderer waits for the frame to decode.
  window.seek = (T) => {
    const pending = [];
    for (const s of scenes) {
      const on = T >= s.t0 && T < s.t1;
      s.root.style.display = on ? 'flex' : 'none';
      if (!on) continue;
      const lt = T - s.t0;
      const d = s.t1 - s.t0;
      // Constant slow push-in so no frame is ever static.
      s.inner.style.transform = `scale(${1 + s.drift * (lt / d)})`;
      for (const a of s.anims) applyAnim(a, lt);
      pending.push(s.update(lt, d));
    }
    return Promise.all(pending);
  };

  window.E = { scene, el, prog, clamp, easeOut, easeBack };
  window.REEL_DURATION = () => Math.max(...scenes.map((s) => s.t1));
  window.SFX_CUES = cues;
})();

// ---------- shared building blocks ----------

// Phone frame around real app footage (status bar cropped out of the source, redrawn here at 4:30).
function phone(api, parent) {
  const wrap = api.el(parent, 'div', 'phone');
  const screen = api.el(wrap, 'div', 'screen');
  api.el(screen, 'div', 'statusbar', '<span>4:30</span><span class="dots">&#9679;&#9679;&#9679;</span>');
  const view = api.el(screen, 'div', 'view');
  return { wrap, screen, view };
}

// A still screenshot, optionally scrolled by `scroll` px over the scene.
function shot(api, parent, src, scroll = 0) {
  const p = phone(api, parent);
  p.scroller = api.el(p.view, 'div', 'scroller');
  api.el(p.scroller, 'img', 'shot').src = 'assets/' + src;
  p.update = (lt, d) => { p.scroller.style.transform = `translateY(${-scroll * E.easeOut(lt / d)}px)`; };
  return p;
}

// A frame sequence from the screen recording, played at 30fps from `start`, holding the last frame.
function clip(api, parent, dir, frames, start = 0) {
  const p = phone(api, parent);
  const img = api.el(p.view, 'img', 'shot');
  let cur = '';
  p.update = (lt) => {
    const n = Math.max(1, Math.min(frames, Math.floor((lt - start) * 30) + 1));
    const src = `assets/${dir}/${String(n).padStart(4, '0')}.jpg`;
    if (src === cur) return null;
    cur = src;
    img.src = src;
    return img.decode().catch(() => {});
  };
  return p;
}

// Outline over part of a screenshot, moving with its scroll. Box is in on-screen image pixels: [x, y, w, h].
function highlight(api, p, box, start) {
  const h = api.el(p.scroller, 'div', 'hl-box');
  Object.assign(h.style, { left: box[0] + 'px', top: box[1] + 'px', width: box[2] + 'px', height: box[3] + 'px' });
  api.anim(h, start, 'pop', 0.35);
  api.sfx('pop', start);
  return h;
}

// Caption above a phone, swapping lines at the given times: [[text, at], ...]
function captions(api, root, lines, cls = 'md') {
  const cap = api.el(root, 'div', 'caption-top');
  const nodes = lines.map(([text, at]) => api.words(cap, text, cls, at, 0.13));
  return (lt) => nodes.forEach((n, i) => {
    const next = lines[i + 1] ? lines[i + 1][1] : Infinity;
    n.style.display = lt >= lines[i][1] && lt < next ? 'flex' : 'none';
  });
}

// Closing card shared by every reel.
function endCard(t0, t1) {
  E.scene(t0, t1, { bg: 'cream', drift: 0.02 }, (root, api) => {
    const box = api.el(root, 'div', 'center');
    api.words(box, 'Opening soon.', 'xl', 0.0, 0.14);
    api.anim(api.el(box, 'div', 'pill', 'Follow for launch day'), 0.45, 'pop', 0.4);
    api.sfx('ding', 0.45);
  });
}
