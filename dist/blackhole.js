/* ==========================================================================
   Gargantua — an Interstellar-style black hole, ray-traced in a fragment shader.

   What is simulated (per pixel, per frame):
   - A camera ray is bent step by step around a Schwarzschild black hole using the
     photon equation of motion  a = -1.5 * h^2 * p / |p|^5   (rs = 1, photon sphere 1.5,
     shadow radius ~2.6). Rays that fall inside r < 1 are absorbed -> the black shadow.
   - A thin accretion disk in the y = 0 plane is sampled every time a bent ray crosses
     it, so the far side of the disk is lensed up over and under the hole (the iconic
     halo) and a thin near-side band crosses in front. Higher-order images appear as a
     thin bright ring hugging the shadow.
   - Differential (Keplerian) rotation, relativistic Doppler beaming (one side brighter),
     gravitational redshift, temperature falloff, turbulent noise texture, a faint
     volumetric haze above and below the disk.
   - Stars are looked up with the *bent* exit direction, so they stream and smear.
   One fixed canvas serves the whole page: a camera "director" flies the hole as you
   scroll (far reveal -> dive -> dim backdrop -> contact close-up), plus a small blurred
   2D copy for bloom, adaptive resolution, loader orchestration and reduced-motion mode.
   ========================================================================== */
(() => {
  'use strict';
  const html = document.documentElement;
  const canvas = document.getElementById('orbit');
  const bloom = document.getElementById('bloom');
  const loader = document.querySelector('.loader');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = matchMedia('(hover: none) and (pointer: coarse)').matches;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoother = t => t * t * t * (t * (t * 6 - 15) + 10);

  function markReady() {
    clearTimeout(window.bootTimeout);
    html.classList.remove('loading');
    html.classList.add('ready');
  }
  function hideLoader() {
    if (!loader) return;
    loader.classList.add('is-gone');
    setTimeout(() => loader.remove(), 1400);
  }

  const gl = canvas.getContext('webgl', {
    alpha: false, antialias: false, depth: false, stencil: false,
    powerPreference: 'high-performance', preserveDrawingBuffer: false
  });
  if (!gl) {
    html.classList.add('stage-fallback');
    hideLoader(); markReady();
    return;
  }

  /* ----------------------------------------------------------------------
     Shader
     ---------------------------------------------------------------------- */
  const VERT = 'attribute vec2 position;void main(){gl_Position=vec4(position,0.,1.);}';
  const FRAG = `
precision highp float;
uniform vec2  uRes;
uniform vec2  uShift;
uniform float uTime, uDist, uElev, uFocal, uDim, uSteps, uExp, uMotion;
uniform vec4  uTune; // x disk opacity, y haze, z intensity, w temperature exponent
#define RIN  3.0
#define ROUT 15.5
#define STEPS 132

float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float h31(vec3 p){p=fract(p*vec3(.1031,.1030,.0973));p+=dot(p,p.yxz+33.33);return fract((p.x+p.y)*p.z);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1.,0.)),f.x),mix(h21(i+vec2(0.,1.)),h21(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*vn(p);p=p*2.02+vec2(17.3,9.1);a*=.5;}return s;}

vec3 sky(vec3 d){
  vec3 c=vec3(0.);
  for(int k=0;k<3;k++){
    float sc=70.+float(k)*55.;
    vec3 q=d*sc; vec3 id=floor(q); vec3 f=fract(q)-.5;
    float h=h31(id+float(k)*13.7);
    vec3 off=(vec3(h31(id+1.3),h31(id+2.7),h31(id+4.1))-.5)*.6;
    float dd=length(f-off);
    float on=step(.962+.012*float(k),h);
    float tw=.94+.06*sin(uTime*1.3+h*90.)*uMotion;
    float s=on*smoothstep(.17,.0,dd)*(.35+1.5*fract(h*91.7))*tw;
    vec3 tint=mix(vec3(1.,.78,.58),vec3(.78,.88,1.),fract(h*37.));
    c+=s*tint*(1.-.22*float(k));
  }
  float bd=dot(d,normalize(vec3(.35,.78,.52)));
  float band=exp(-bd*bd*13.);
  float n=fbm(d.xz*4.2+d.y*3.1);
  c+=vec3(.55,.30,.15)*band*pow(n,2.3)*.2;
  return c;
}

void main(){
  vec2 uv=(gl_FragCoord.xy-.5*uRes)/uRes.y;
  float aspect=uRes.x/uRes.y;
  uv*=max(1.,.95/aspect);
  uv-=uShift;

  vec3 ro=uDist*vec3(0.,sin(uElev),cos(uElev));
  vec3 fw=normalize(-ro);
  vec3 rt=normalize(cross(fw,vec3(0.,1.,0.)));
  vec3 up=cross(rt,fw);
  vec3 rd=normalize(fw*uFocal+rt*uv.x+up*uv.y);

  // Bounding sphere: rays that never come near the disk skip the march entirely
  // (weak-field deflection 2/b), the rest start on the sphere instead of at the camera.
  const float RB=24.;
  vec3 hv=cross(ro,rd); float h2=dot(hv,hv);
  float b=sqrt(h2);
  float tca=-dot(ro,rd);
  vec3 p=ro, v=rd;
  bool far=false;
  if(dot(ro,ro)>RB*RB){
    if(tca<0.||b>RB){
      far=true;
      if(tca>0.){vec3 perp=ro+rd*tca; v=normalize(rd-normalize(perp)*(2./max(b,1.)));}
    } else {
      p=ro+rd*(tca-sqrt(RB*RB-b*b));
    }
  }
  vec3 col=vec3(0.); float trans=1.; float minr=1e9;
  bool esc=far, cap=false;
  float rEsc=RB*1.04;

  for(int i=0;i<STEPS;i++){
    if(far||float(i)>uSteps) break;
    if(trans<.025) break;
    float r2=dot(p,p); float r=sqrt(r2);
    minr=min(minr,r);
    if(r<1.02){cap=true;break;}
    if(r>rEsc && dot(p,v)>0.){esc=true;break;}
    float dt=clamp(.055*(r-.95),.035,1.1);
    vec3 acc=-1.5*h2*p/(r2*r2*r);
    vec3 vnx=normalize(v+acc*dt);
    vec3 pn=p+vnx*dt;

    if(p.y*pn.y<0.){
      float t=p.y/(p.y-pn.y);
      vec3 hp=mix(p,pn,t);
      float rho=length(hp.xz);
      if(rho>RIN*.97 && rho<ROUT){
        float T=pow(RIN/rho,.75);
        float ang=atan(hp.z,hp.x);
        float ph=ang+4.2*pow(rho,-1.5)*uTime*uMotion;
        vec2 dom=vec2(cos(ph),sin(ph))*rho;
        float n1=fbm(dom*.9+rho*.35);
        float n2=fbm(dom*2.1-vec2(5.,3.));
        float rings=.5+.5*sin(rho*16.+n1*7.);
        float tex=clamp(.2+1.0*(.5*n1+.5*n2)*(.72+.28*rings),0.,1.5);
        float vk=sqrt(.5/rho);
        vec3 vel=vec3(hp.z,0.,-hp.x)/rho*vk;
        float gam=inversesqrt(1.-vk*vk);
        float D=1./(gam*(1.+dot(vel,vnx)));
        float g=sqrt(max(1.-1./rho,.02));
        float sh=D*g;
        float env=smoothstep(RIN*.97,RIN*1.16,rho)*(1.-smoothstep(ROUT*.6,ROUT,rho));
        float I=pow(T,uTune.w)*pow(sh,3.1)*tex*uTune.z*env;
        float temp=T*sh;
        vec3 hot=mix(vec3(.95,.36,.07),vec3(1.,.84,.58),smoothstep(.22,.82,temp));
        hot=mix(hot,vec3(1.,.97,.9),smoothstep(.85,1.3,temp));
        col+=trans*hot*I;
        trans*=1.-clamp(env*(.2+.6*tex)*uTune.x,0.,.82);
      }
    }
    float rr=length(pn.xz);
    float hz=exp(-abs(pn.y)*(2.3+.35*rr))*smoothstep(RIN*.85,RIN*1.3,rr)*(1.-smoothstep(ROUT*.55,ROUT,rr));
    col+=trans*vec3(1.,.5,.2)*hz*pow(RIN/max(rr,.5),2.2)*dt*uTune.y;

    p=pn; v=vnx;
  }

  if(!esc&&!cap&&trans>.025) cap=true; // ran out of steps deep in the well: absorbed
  if(esc) col+=trans*sky(v);
  if(esc&&!far) col+=vec3(1.,.66,.36)*exp(-pow((minr-1.53)*5.2,2.))*.2*trans;

  col*=uExp;
  col=1.-exp(-col*1.12);
  col=pow(col,vec3(.93));
  col*=uDim;
  col+=(h21(gl_FragCoord.xy)-.5)*.004*uDim; // static 1-LSB dither against banding, no animated grain
  gl_FragColor=vec4(col,1.);
}`;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  let program;
  try {
    program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('link failed');
    gl.useProgram(program);
  } catch (e) {
    console.warn('Black hole shader unavailable:', e.message);
    html.classList.add('stage-fallback');
    hideLoader(); markReady();
    return;
  }
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = {};
  ['uRes', 'uShift', 'uTime', 'uDist', 'uElev', 'uFocal', 'uDim', 'uSteps', 'uExp', 'uMotion', 'uTune']
    .forEach(k => U[k] = gl.getUniformLocation(program, k));

  /* ----------------------------------------------------------------------
     Resolution: adaptive, so weaker GPUs stay smooth
     ---------------------------------------------------------------------- */
  const maxScale = coarse ? .7 : 1;
  const minScale = coarse ? .45 : .62;
  let scale = coarse ? .55 : .8;
  const forced = parseFloat(new URLSearchParams(location.search).get('scale')); // ?scale=0.9 pins render resolution
  if (forced > 0) scale = clamp(forced, .1, 1.5);
  const bctx = bloom.getContext('2d');
  // The stage is sized with 100lvh in CSS, so the phone's collapsing address bar never changes it.
  const VW = () => canvas.clientWidth || innerWidth;
  const VH = () => canvas.clientHeight || innerHeight;
  let lastW = 0, lastH = 0, bloomW = 0, bloomH = 0;
  function resize() {
    lastW = VW(); lastH = VH();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.max(2, Math.round(VW() * dpr * scale));
    canvas.height = Math.max(2, Math.round(VH() * dpr * scale));
    gl.viewport(0, 0, canvas.width, canvas.height);
    // The glow canvas only changes size with the viewport, never with render-quality changes:
    // resizing a canvas clears it, which showed up as a blink.
    if (bloomW !== VW() || bloomH !== VH()) {
      bloomW = VW(); bloomH = VH();
      bloom.width = Math.max(2, Math.ceil(bloomW / 9));
      bloom.height = Math.max(2, Math.ceil(bloomH / 9));
    }
    measure();
    requestRedraw();
  }

  /* ----------------------------------------------------------------------
     Camera director: keyframes tied to page sections, interpolated by scroll
     (dist: camera distance in Schwarzschild radii, elev: radians above the disk plane,
      sx/sy: screen offset of the hole, dim: brightness, focal: field of view)
     ---------------------------------------------------------------------- */
  const KF = [
    { sel: '#home',    at: 0,   vh: 0,  v: { dist: 38, elev: .05, sx: 0,   sy: .07, dim: 1,   focal: 2.2 } },
    { sel: '#home',    at: .5,  vh: 0,  v: { dist: 23, elev: .085,sx: 0,   sy: .06, dim: 1,   focal: 2.2 } },
    { sel: '#home',    at: 1,   vh: -1, v: { dist: 12, elev: .16, sx: 0,   sy: .03, dim: .95, focal: 2.2 } },
    { sel: '#work',    at: .01, vh: 0,  v: { dist: 50, elev: .06, sx: .48, sy: .08, dim: .44, focal: 2.2 } },
    { sel: '#about',   at: 0,   vh: 0,  v: { dist: 62, elev: .07, sx: -.5, sy: .04, dim: .38, focal: 2.2 } },
    { sel: '#stats',   at: .5,  vh: 0,  v: { dist: 34, elev: .11, sx: 0,   sy: .02, dim: .75, focal: 2.2 } },
    { sel: '.source',  at: 0,   vh: 0,  v: { dist: 46, elev: .08, sx: .45, sy: .05, dim: .42, focal: 2.2 } },
    { sel: '#contact', at: 0,   vh: 0,  v: { dist: 22, elev: .09, sx: 0,   sy: .09, dim: .7, focal: 2.2 } },
    { sel: '#contact', at: 1,   vh: -1, v: { dist: 12, elev: .12, sx: 0,   sy: .09, dim: .92, focal: 2.2 } }
  ];
  let keys = [];
  function measure() {
    keys = KF.map(k => {
      const el = document.querySelector(k.sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { y: r.top + scrollY + r.height * k.at + k.vh * innerHeight, v: k.v };
    }).filter(Boolean).sort((a, b) => a.y - b.y);
  }
  function sample(y) {
    if (!keys.length) return KF[0].v;
    if (y <= keys[0].y) return keys[0].v;
    const last = keys[keys.length - 1];
    if (y >= last.y) return last.v;
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i], b = keys[i + 1];
      if (y >= a.y && y <= b.y) {
        const t = smoother(clamp((y - a.y) / Math.max(1, b.y - a.y), 0, 1));
        const o = {};
        for (const k in a.v) o[k] = k === 'dist' ? Math.exp(lerp(Math.log(a.v[k]), Math.log(b.v[k]), t)) : lerp(a.v[k], b.v[k], t);
        return o;
      }
    }
    return last.v;
  }

  /* ----------------------------------------------------------------------
     Loader + arrival
     ---------------------------------------------------------------------- */
  const ringFg = loader && loader.querySelector('.ring-fg');
  const countEl = loader && loader.querySelector('.loader-count');
  const startT = performance.now();
  let loaded = !!reduced.matches || !loader;
  let shown = 0, dismissed = false, arriveT0 = 0, arriveDur = 4400;
  let real = 0;
  const tasks = { fonts: 0, imgs: 0, frames: 0 };
  const imgs = Array.from(document.querySelectorAll('.float img'));
  function updateReal() { real = (tasks.fonts + tasks.imgs + Math.min(tasks.frames, 3) / 3) / 3; }
  if (!loaded) {
    (document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 2500))]) : Promise.resolve())
      .then(() => { tasks.fonts = 1; updateReal(); });
    let n = 0;
    const one = () => { n++; tasks.imgs = n / Math.max(1, imgs.length); updateReal(); };
    if (!imgs.length) tasks.imgs = 1;
    imgs.forEach(im => (im.complete ? Promise.resolve() : new Promise(r => { im.addEventListener('load', r, { once: true }); im.addEventListener('error', r, { once: true }); setTimeout(r, 4000); })).then(one));
  }
  function dismiss(fast) {
    if (dismissed) return;
    dismissed = true;
    arriveDur = fast ? 1500 : 4400;
    arriveT0 = performance.now();
    hideLoader();
    html.classList.remove('loading');
    setTimeout(markReady, fast ? 200 : 650);
  }
  if (loader) {
    loader.querySelector('.skip-intro').addEventListener('click', () => dismiss(true));
    addEventListener('keydown', e => { if (e.key === 'Escape') dismiss(true); });
  }
  if (reduced.matches) { dismissed = true; arriveT0 = -1e9; hideLoader(); markReady(); }

  /* ----------------------------------------------------------------------
     Render loop
     ---------------------------------------------------------------------- */
  const TUNE = [.5, .012, 3.8, 1.9];
  const cur = { dist: 38, elev: .05, sx: 0, sy: .07, dim: 0, focal: 2.2 };
  let mx = 0, my = 0, smx = 0, smy = 0;
  let last = 0, time = 0, raf = 0, frames = 0, acc = 0, accN = 0, firstCamera = true, lastAdapt = 0, ceiling = 9;
  addEventListener('pointermove', e => {
    if (e.pointerType === 'touch' || reduced.matches) return;
    mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5;
  }, { passive: true });

  function draw(now, dt) {
    const arrive = dismissed ? clamp((now - arriveT0) / arriveDur, 0, 1) : 0;
    const ea = smoother(arrive);
    const target = sample(scrollY);
    const k = firstCamera ? 1 : 1 - Math.exp(-dt * 3.4);
    firstCamera = false;
    for (const key in target) cur[key] = lerp(cur[key], target[key], key === 'dim' ? Math.min(1, k * 1.4) : k);
    smx += (mx - smx) * (1 - Math.exp(-dt * 4)); smy += (my - smy) * (1 - Math.exp(-dt * 4));

    const aspect = canvas.width / canvas.height;
    const sxScale = clamp(aspect / 1.6, .25, 1);
    const dist = cur.dist * (.24 + .76 * ea);
    const elev = cur.elev + smy * -.05 + Math.sin(time * .11) * .008;
    const fadeIn = dismissed ? clamp((now - arriveT0) / 1300, 0, 1) : 0;
    const dim = cur.dim * (.25 + .75 * ea) * fadeIn;

    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniform2f(U.uShift, (cur.sx * sxScale) + smx * .018, cur.sy - smy * .018);
    gl.uniform1f(U.uTime, time);
    gl.uniform1f(U.uDist, dist);
    gl.uniform1f(U.uElev, elev);
    gl.uniform1f(U.uFocal, cur.focal);
    gl.uniform1f(U.uDim, dim);
    gl.uniform1f(U.uSteps, coarse ? 104 : 118);
    gl.uniform1f(U.uExp, .55 + .45 * ea);
    gl.uniform1f(U.uMotion, reduced.matches ? 0 : 1);
    const tu = window.__bhTune || TUNE; gl.uniform4f(U.uTune, tu[0], tu[1], tu[2], tu[3]);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    if (frames % 3 === 0) { try { bctx.drawImage(canvas, 0, 0, bloom.width, bloom.height); } catch (e) {} }
    frames++;
    tasks.frames = frames; updateReal();
  }

  function loaderTick(now) {
    if (dismissed || !loaded && !loader) return;
    const elapsed = (now - startT) / 1000;
    const target = Math.min(real, elapsed / 1.7);
    shown += (target - shown) * .12;
    if (ringFg) loader.style.setProperty('--load', shown.toFixed(3));
    if (countEl) countEl.textContent = Math.round(shown * 100);
    if (shown > .985 && real >= .999 && elapsed > 1.7) dismiss(false);
    if (elapsed > 7.5) dismiss(true);
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = last ? Math.min((now - last) / 1000, .1) : .016;
    last = now;
    // A hitch (tab switch, GC, shader warm-up) must not make the disk rotation jump.
    if (!reduced.matches) time += Math.min(dt, .034);
    loaderTick(now);

    // Adaptive resolution. Rules that keep it invisible:
    //  - never during the loader or the arrival move (those frames are not representative)
    //  - decided BEFORE drawing, so a resized (cleared) canvas is redrawn in the same frame
    //  - slow cooldown and small steps; once it has had to drop, it never climbs back above that level
    const settled = dismissed && (now - arriveT0) > arriveDur + 800;
    if (settled && !(forced > 0) && dt < .25) {
      acc += dt; accN++;
      if (accN >= 45 && now - lastAdapt > 4000) {
        const ms = (acc / accN) * 1000; acc = 0; accN = 0;
        if (ms > 30 && scale > minScale) { scale = Math.max(minScale, scale * .88); ceiling = Math.min(ceiling, scale * 1.05); lastAdapt = now; resize(); }
        else if (ms < 17.5 && scale < Math.min(maxScale, ceiling)) { scale = Math.min(maxScale, ceiling, scale * 1.05); lastAdapt = now; resize(); }
        else lastAdapt = now - 2000;
      } else if (accN >= 45) { acc = 0; accN = 0; }
    }
    draw(now, dt);
  }

  let redrawQueued = false;
  function requestRedraw() {
    if (!reduced.matches || redrawQueued) return;
    redrawQueued = true;
    requestAnimationFrame(t => { redrawQueued = false; draw(t, .016); });
  }

  addEventListener('resize', () => { if (VW() === lastW && VH() === lastH) measure(); else resize(); });
  addEventListener('scroll', requestRedraw, { passive: true });
  new ResizeObserver(() => measure()).observe(document.body);
  window.addEventListener('load', measure);
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); cancelAnimationFrame(raf); html.classList.add('stage-fallback'); });
  document.addEventListener('visibilitychange', () => { last = 0; });
  reduced.addEventListener('change', () => location.reload());

  resize();
  if (reduced.matches) draw(performance.now(), .016);
  else raf = requestAnimationFrame(loop);
})();
