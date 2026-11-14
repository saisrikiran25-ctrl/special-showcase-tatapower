/* In-page layout and content checks. Paste into the browser console (or inject with a
   browser tool) on the running site, at any viewport size. Returns a report object:
   { width, height, failures: [...], passed: n }.

   Checks
   - no text element sticks out of the viewport horizontally (marquees, ribbon, helix excluded)
   - no clipped text (overflow hidden boxes whose content is wider than the box)
   - hero headline words fit the column
   - stage canvases match the viewport shape and are not resized by the address bar
   - content integrity: 9 projects, 4 highlight cards, no <sup>, no stale numbers, key links present
*/
(() => {
  const failures = [];
  let passed = 0;
  const ok = (cond, msg) => { if (cond) passed++; else failures.push(msg); };
  const vw = document.documentElement.clientWidth, vh = innerHeight;
  const skip = el => el.closest('[data-marquee],.ribbon,.edge,.loader,.menu,.ss3d.has-3d,#orbit,#bloom,.mq-track,dialog,.counter');
  const visible = el => { const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
  const label = el => el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '') + ' "' + (el.textContent || '').trim().slice(0, 28) + '"';

  // 1. horizontal overflow of text-bearing elements
  const textEls = [...document.querySelectorAll('h1,h2,h3,p,a,button,small,strong,em,li,label,input,textarea,span,video,img')]
    .filter(el => !skip(el) && visible(el) && !el.closest('.float'));
  textEls.forEach(el => {
    const r = el.getBoundingClientRect();
    ok(r.right <= vw + 1.5 && r.left >= -1.5, `overflow-x: ${label(el)} spans ${Math.round(r.left)}..${Math.round(r.right)} of ${vw}`);
  });
  ok(document.documentElement.scrollWidth <= vw + 1, `page scrollWidth ${document.documentElement.scrollWidth} > ${vw}`);

  // 2. clipped text (only boxes that actually hide overflow)
  [...document.querySelectorAll('.w,.wm-line,.pill,.filter button,.count,.stat,.nav-pill a')].filter(el => !skip(el) && visible(el)).forEach(el => {
    const cs = getComputedStyle(el);
    if (cs.overflow === 'visible' || el.classList.contains('wm-line')) return;
    ok(el.scrollWidth <= el.clientWidth + 1, `clipped: ${label(el)} scrollWidth ${el.scrollWidth} > ${el.clientWidth}`);
  });

  // 3. hero headline fits its column
  const h1 = document.querySelector('.hero-copy h1');
  if (h1) {
    const max = h1.clientWidth;
    [...h1.querySelectorAll('.wi')].forEach(w => ok(w.getBoundingClientRect().width <= max + 1, `hero word "${w.textContent}" ${Math.round(w.getBoundingClientRect().width)} > column ${max}`));
    const hc = document.querySelector('.hero-copy').getBoundingClientRect();
    ok(hc.right <= vw + 1 && hc.left >= -1, 'hero copy inside viewport');
  }

  // 4. stage canvas
  const c = document.getElementById('orbit');
  if (c) {
    const r = c.getBoundingClientRect();
    ok(Math.abs(r.width - vw) <= 1, `canvas css width ${r.width} vs viewport ${vw}`);
    ok(r.height >= vh - 1, `canvas css height ${r.height} < viewport ${vh}`);
    ok(Math.abs(c.width / c.height - r.width / r.height) < 0.03, `canvas pixel aspect ${(c.width / c.height).toFixed(3)} != css aspect ${(r.width / r.height).toFixed(3)}`);
    ok(c.width >= 160 && c.height >= 160, 'canvas has a real size');
  }

  // 5. content integrity
  ok(document.querySelectorAll('.project').length === 9, 'nine projects present');
  ok(document.querySelectorAll('.stat').length === 4, 'four highlight cards present');
  ok(document.querySelectorAll('sup').length === 0, 'no <sup> elements remain');
  const text = document.body.textContent;
  ok(/top 200 global creators on PromptBase/.test(text), 'PromptBase top 200 text present');
  ok(!/\b250\b/.test(text), 'stale 250 removed');
  ['https://3tierarchitecture.vercel.app/', 'https://csrproject-one.vercel.app/', 'https://github.com/saisrikiran25-ctrl/client-intelligence', 'mailto:jandhyala.saisrikiran25@iimb.ac.in', 'tel:+919987403394']
    .forEach(h => ok(!!document.querySelector(`a[href="${h}"]`), 'link present ' + h));
  ok(document.querySelectorAll('img:not([alt])').length === 0, 'all images have alt');

  return { width: vw, height: vh, passed, failures };
})();
