/* ==========================================================================
   Portfolio interactions. Vanilla JS, one rAF loop, every effect early-outs when
   off-screen. Motion modules (ported from the studied references):
   - hero tilt layer with depth-based counter-parallax (mouse / touch)
   - scroll-driven hero journey (copy, cards, caption keyed to progress)
   - letter-by-letter scroll reveal
   - stacking sticky project cards
   - 3D helix carousel for the highlight stats
   - infinite marquees, wordmark wipe loop, word-mask headline reveal
   ========================================================================== */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const html = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  /* ---------------- Project details dialog, filters, video ---------------- */
  const dialog = $('dialog');
  let data;
  const contentReady = fetch('assets/content.json').then(r => r.json()).then(d => (data = d));
  $$('[data-detail]').forEach(b => b.addEventListener('click', async () => {
    await contentReady;
    const p = data.projects[+b.dataset.detail];
    const box = $('.dialog-content', dialog);
    box.replaceChildren();
    const h = document.createElement('h2'); h.textContent = p.short;
    const text = document.createElement('pre'); text.textContent = p.body;
    box.append(h, text);
    dialog.showModal();
  }));
  $('.close', dialog).onclick = () => dialog.close();
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });

  $$('[data-filter]').forEach(b => b.onclick = () => {
    $$('[data-filter]').forEach(x => x.setAttribute('aria-pressed', x === b));
    $$('.project').forEach((p, i) => p.hidden = b.dataset.filter === 'apps' ? i >= 5 : b.dataset.filter === 'agents' ? i < 5 : false);
    requestAnimationFrame(() => { stack.measure(); window.dispatchEvent(new Event('resize')); });
  });
  $$('.media video').forEach(v => v.addEventListener('play', () => $$('.media video').forEach(x => { if (x !== v) x.pause(); })));

  /* ---------------- Headline: word-mask reveal ---------------- */
  (function headline() {
    const h1 = $('.hero-copy h1');
    if (!h1) return;
    h1.setAttribute('aria-label', h1.textContent.replace(/\s+/g, ' ').trim());
    let i = 0;
    const wrap = node => {
      Array.from(node.childNodes).forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(tok => {
            if (!tok) return;
            if (/^\s+$/.test(tok)) { frag.append(document.createTextNode(' ')); return; }
            const w = document.createElement('span'); w.className = 'w'; w.setAttribute('aria-hidden', 'true');
            const wi = document.createElement('span'); wi.className = 'wi'; wi.textContent = tok;
            wi.style.setProperty('--d', (0.25 + i++ * 0.1).toFixed(2) + 's');
            w.append(wi); frag.append(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') wrap(n);
      });
    };
    wrap(h1);

    // Make sure the widest word always fits the column, whatever the font or phone width.
    function fit() {
      h1.style.fontSize = '';
      let size = parseFloat(getComputedStyle(h1).fontSize);
      const max = h1.clientWidth;
      for (let i = 0; i < 14 && size > 22; i++) {
        const widest = Math.max(...$$('.wi', h1).map(w => w.getBoundingClientRect().width));
        if (widest <= max - 2) break;
        size *= Math.max(.8, (max - 2) / widest);
        h1.style.fontSize = size.toFixed(2) + 'px';
      }
    }
    fit();
    addEventListener('resize', fit);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
    addEventListener('load', fit);
  })();

  /* ---------------- Wordmark wipe loop (reveal left->right, erase right->left) ---------------- */
  (function wipe() {
    const lines = $$('.wm-line');
    if (lines.length < 2 || reduced) return;
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    (async () => {
      let i = 0;
      while (true) {
        await sleep(i % 2 ? 2000 : 3200);
        lines[i % 2].classList.remove('is-on');
        await sleep(760);
        i++;
        lines[i % 2].classList.add('is-on');
        await sleep(760);
      }
    })();
  })();

  /* ---------------- Mobile menu ---------------- */
  (function menu() {
    const btn = $('.menu-btn'), m = $('#menu');
    if (!btn || !m) return;
    const set = open => {
      m.hidden = !open; btn.setAttribute('aria-expanded', open);
      btn.lastChild.textContent = open ? ' Close' : ' Menu';
      html.style.overflow = open ? 'hidden' : '';
    };
    btn.onclick = () => set(m.hidden);
    $$('a', m).forEach(a => a.addEventListener('click', () => set(false)));
    addEventListener('keydown', e => { if (e.key === 'Escape' && !m.hidden) set(false); });
  })();

  /* ---------------- Infinite marquees (clone to cover viewport, translate -50%) ---------------- */
  const marquees = $$('[data-marquee]').map(el => ({ el, seed: $('.seed', el).cloneNode(true), speed: +el.dataset.marquee || 1 }));
  function buildMarquees() {
    marquees.forEach(m => {
      const track = document.createElement('div'); track.className = 'mq-track';
      const a = document.createElement('div'); a.className = 'mq-group';
      m.el.replaceChildren(track); track.append(a);
      let g = 0;
      do { a.append(m.seed.cloneNode(true)); g++; } while (a.getBoundingClientRect().width < innerWidth * 1.15 && g < 40);
      const b = a.cloneNode(true); b.setAttribute('aria-hidden', 'true'); track.append(b);
      track.style.setProperty('--dur', (a.getBoundingClientRect().width / (45 * m.speed)).toFixed(1) + 's');
    });
  }
  let mqT;
  buildMarquees();
  addEventListener('resize', () => { clearTimeout(mqT); mqT = setTimeout(buildMarquees, 250); });

  /* ---------------- Letter-by-letter scroll reveal ---------------- */
  const reveals = [];
  if (!reduced) {
    $$('.section-head > p, .bio p:not(:last-child)').forEach(el => {
      const text = el.textContent.trim();
      el.setAttribute('aria-label', text);
      el.classList.add('lr');
      el.textContent = '';
      const letters = [];
      text.split(/(\s+)/).forEach(tok => {
        if (!tok) return;
        if (/^\s+$/.test(tok)) { el.append(document.createTextNode(' ')); return; }
        const w = document.createElement('span'); w.className = 'lr-w'; w.setAttribute('aria-hidden', 'true');
        [...tok].forEach(c => { const s = document.createElement('span'); s.className = 'lr-ch'; s.textContent = c; letters.push(s); w.append(s); });
        el.append(w);
      });
      reveals.push({ el, letters, n: 0 });
    });
  }
  function updateReveals(vh) {
    reveals.forEach(r => {
      const rect = r.el.getBoundingClientRect();
      if (rect.bottom < -50 || rect.top > vh + 50) { if (rect.top > vh) setCount(r, 0); else setCount(r, r.letters.length); return; }
      const t = clamp((vh * 0.88 - rect.top) / (rect.height + vh * 0.28), 0, 1);
      setCount(r, Math.round(t * r.letters.length));
    });
  }
  function setCount(r, n) {
    if (n === r.n) return;
    const [a, b] = n > r.n ? [r.n, n] : [n, r.n];
    for (let i = a; i < b; i++) r.letters[i].classList.toggle('on', n > r.n);
    r.n = n;
  }

  /* ---------------- Hero: tilt layer + scroll journey ---------------- */
  const hero = $('#home'), sticky = $('.hero-sticky'), layer = $('.tilt-layer');
  const copy = $('.hero-copy'), caption = $('.hero-caption'), heroBottom = $('.hero-bottom');
  const cards = $$('.float').map(el => ({ el, z: 0, rx: 0, ry: 0, rz: 0, drift: 1, cx: 0, cy: 0 }));
  function readCards() {
    const w = sticky.clientWidth, h = sticky.clientHeight;
    cards.forEach(c => {
      const cs = getComputedStyle(c.el);
      c.z = parseFloat(cs.getPropertyValue('--z')) || 0;
      c.rx = parseFloat(cs.getPropertyValue('--rx')) || 0;
      c.ry = parseFloat(cs.getPropertyValue('--ry')) || 0;
      c.rz = parseFloat(cs.getPropertyValue('--rz')) || 0;
      c.drift = parseFloat(cs.getPropertyValue('--drift')) || 1;
      const x = c.el.offsetLeft + c.el.offsetWidth / 2, y = c.el.offsetTop + c.el.offsetHeight / 2;
      c.cx = (x - w / 2) / (w / 2); c.cy = (y - h / 2) / (h / 2);
    });
  }
  const tilt = { tx: 0, ty: 0, trx: 0, try_: 0, x: 0, y: 0, rx: 0, ry: 0 };
  const maxTilt = 9, maxShift = 18;
  function onMove(cx, cy) {
    const r = sticky.getBoundingClientRect();
    const nx = clamp(((cx - r.left) / r.width) * 2 - 1, -1, 1), ny = clamp(((cy - r.top) / r.height) * 2 - 1, -1, 1);
    tilt.try_ = nx * maxTilt; tilt.trx = -ny * maxTilt; tilt.tx = nx * maxShift; tilt.ty = ny * maxShift;
  }
  const leave = () => { tilt.try_ = tilt.trx = tilt.tx = tilt.ty = 0; };
  if (!reduced) {
    sticky.addEventListener('pointermove', e => { if (e.pointerType !== 'touch') onMove(e.clientX, e.clientY); }, { passive: true });
    sticky.addEventListener('pointerleave', leave, { passive: true });
    sticky.addEventListener('touchmove', e => { if (e.touches[0]) onMove(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
    sticky.addEventListener('touchend', leave, { passive: true });
  }
  function updateHero(sy, vh) {
    const heroH = hero.offsetHeight;
    const hp = clamp(sy / Math.max(1, heroH - vh), 0, 1);
    if (sy > heroH + 100) return hp;
    tilt.x += (tilt.tx - tilt.x) * .1; tilt.y += (tilt.ty - tilt.y) * .1;
    tilt.rx += (tilt.trx - tilt.rx) * .1; tilt.ry += (tilt.try_ - tilt.ry) * .1;
    layer.style.transform = `rotateX(${tilt.rx.toFixed(3)}deg) rotateY(${tilt.ry.toFixed(3)}deg) translate3d(${tilt.x.toFixed(2)}px,${tilt.y.toFixed(2)}px,0)`;
    const push = sstep(0, .5, hp);
    const fade = 1 - sstep(.04, .34, hp);
    cards.forEach(c => {
      const ix = -tilt.x * .35 * c.drift + c.cx * push * 620;
      const iy = -tilt.y * .35 * c.drift + c.cy * push * 420 - push * 60;
      const z = c.z + push * 520;
      c.el.style.transform = `translate3d(${ix.toFixed(1)}px,${iy.toFixed(1)}px,${z.toFixed(1)}px) rotateX(${c.rx}deg) rotateY(${c.ry}deg) rotateZ(${c.rz}deg)`;
      c.el.style.setProperty('--fade', fade.toFixed(3));
      c.el.style.pointerEvents = fade < .2 ? 'none' : '';
    });
    const co = 1 - sstep(.1, .38, hp);
    copy.style.opacity = co.toFixed(3);
    copy.style.transform = `translate3d(0,${(-hp * 160).toFixed(1)}px,0)`;
    copy.style.pointerEvents = co < .2 ? 'none' : '';
    const cap = sstep(.4, .56, hp) * (1 - sstep(.82, .97, hp));
    caption.style.opacity = cap.toFixed(3);
    caption.style.transform = `translate3d(0,${((1 - cap) * 30).toFixed(1)}px,0) scale(${(.94 + .06 * cap).toFixed(3)})`;
    heroBottom.style.opacity = '';
    if (html.classList.contains('live')) heroBottom.style.opacity = (1 - sstep(.05, .25, hp)).toFixed(3);
    return hp;
  }

  /* ---------------- Sticky stacking project cards ---------------- */
  const stack = (() => {
    let items = [];
    const TOP = 96;
    function measure() {
      const sticky = innerWidth > 900 && !reduced;
      items = sticky ? $$('.stack-card').filter(el => !el.hidden) : [];
      if (!sticky) $$('.stack-card').forEach(el => { el.style.transform = ''; el.style.setProperty('--dark', '0'); });
    }
    function update(vh) {
      if (!items.length) return;
      const tops = items.map(el => el.getBoundingClientRect().top);
      const span = Math.max(1, vh - TOP);
      items.forEach((el, i) => {
        let c = 0;
        for (let j = i + 1; j < items.length; j++) c += clamp((vh - tops[j]) / span, 0, 1);
        c = Math.min(c, 3.2);
        const s = 1 - c * .038, d = c * .2;
        el.style.transform = c > 0.001 ? `scale(${s.toFixed(4)})` : '';
        el.style.setProperty('--dark', c > 0.001 ? d.toFixed(3) : '0');
      });
    }
    return { measure, update };
  })();

  /* ---------------- Helix carousel (highlight stats) ---------------- */
  const helix = (() => {
    const section = $('.ss3d');
    const space = $('.ss3d-scrollspace');
    const cardsEl = $$('.ss3d-card');
    let on = false, cur = 0, tgt = 0, sc = 1;
    // phones get a plain, readable stack instead of the 3D helix
    const narrow = matchMedia('(max-width:700px)');
    function setMode() {
      on = !reduced && !narrow.matches && !!section && cardsEl.length > 0;
      section.classList.toggle('has-3d', on);
      if (!on) cardsEl.forEach(c => { c.style.transform = ''; c.style.opacity = ''; c.style.pointerEvents = ''; });
      else render(cur);
    }
    narrow.addEventListener('change', () => setMode());
    addEventListener('resize', () => { if (on === narrow.matches) setMode(); });
    function metrics() { sc = clamp(innerWidth / 1440, .5, 1.1); }
    metrics(); addEventListener('resize', metrics);
    function progress() {
      const r = space.getBoundingClientRect();
      const total = Math.max(1, space.offsetHeight - innerHeight);
      return clamp(-r.top, 0, total) / total;
    }
    function render(p) {
      const n = cardsEl.length, active = p * (n - 1);
      const R = 380 * sc, DEPTH = 520 * sc, SX = 70 * sc, SY = 56 * sc, HY = 120 * sc;
      cardsEl.forEach((card, i) => {
        const rel = i - active, aDeg = rel * 95, a = aDeg * Math.PI / 180;
        const x = Math.sin(a) * R + rel * SX;
        const z = Math.cos(a) * R * (DEPTH / (2 * R));
        const y = rel * HY + rel * SY;
        const d01 = clamp((z + DEPTH / 2) / DEPTH, 0, 1);
        const op = lerp(.18, 1, d01);
        card.style.transform = `translate(-50%,-50%) translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,${z.toFixed(1)}px) rotateY(${aDeg.toFixed(2)}deg)`;
        card.style.opacity = op.toFixed(3);
        card.style.pointerEvents = op < .28 ? 'none' : 'auto';
      });
    }
    function update(vh) {
      if (!on) return;
      const r = section.getBoundingClientRect();
      if (r.bottom < -vh * .2 || r.top > vh * 1.2) return;
      tgt = progress();
      if (Math.abs(tgt - cur) < .0004) return;   // settled: no DOM writes
      cur = lerp(cur, tgt, .1);
      render(cur);
    }
    setMode();
    return { update };
  })();

  /* ---------------- Progress + counter ---------------- */
  const pct = $('#pct');
  const siteHeader = $('.site-header');
  function updateProgress(sy, vh) {
    siteHeader.classList.toggle('scrolled', sy > 70);
    const max = Math.max(1, html.scrollHeight - vh);
    const p = clamp(sy / max, 0, 1);
    html.style.setProperty('--progress', (p * 100).toFixed(2) + '%');
    if (pct) pct.textContent = String(Math.round(p * 100)).padStart(2, '0');
  }

  /* ---------------- Main loop ---------------- */
  readCards();
  stack.measure();
  addEventListener('resize', () => { readCards(); stack.measure(); });
  addEventListener('load', () => { readCards(); stack.measure(); });
  let lastSY = -1, dirty = true;
  addEventListener('resize', () => { dirty = true; });
  function tick() {
    requestAnimationFrame(tick);
    const sy = scrollY, vh = innerHeight;
    // Only touch the DOM when something actually changed (scroll, pointer tilt still settling, resize).
    const scrolled = sy !== lastSY || dirty;
    dirty = false;
    if (!reduced) {
      const tiltMoving = Math.abs(tilt.tx - tilt.x) > .02 || Math.abs(tilt.ty - tilt.y) > .02 || Math.abs(tilt.trx - tilt.rx) > .01 || Math.abs(tilt.try_ - tilt.ry) > .01;
      if (scrolled || tiltMoving) updateHero(sy, vh);
      helix.update(vh);
    }
    if (scrolled) { stack.update(vh); updateReveals(vh); updateProgress(sy, vh); }
    lastSY = sy;
  }
  if (reduced) {
    $$('.lr-ch').forEach(c => c.classList.add('on'));
    updateProgress(scrollY, innerHeight);
    addEventListener('scroll', () => updateProgress(scrollY, innerHeight), { passive: true });
  } else tick();

  // once the intro reveal has played, scroll-driven opacity must not be eased by CSS transitions
  const markLive = () => setTimeout(() => html.classList.add('live'), 3400);
  if (html.classList.contains('ready')) markLive();
  else new MutationObserver((_, o) => { if (html.classList.contains('ready')) { o.disconnect(); markLive(); } }).observe(html, { attributes: true, attributeFilter: ['class'] });
})();
