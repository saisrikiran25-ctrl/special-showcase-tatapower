/* Authored procedural lensing illustration: one GPU surface, continuous intro-to-hero transition. */
(()=>{
 const canvas=document.getElementById('orbit'),hero=document.querySelector('.hero');
 const motion=matchMedia('(prefers-reduced-motion: reduce)');
 const intro=document.createElement('div');intro.className='singularity-intro';intro.innerHTML='<div class="intro-name">SAI SRIKIRAN J<span>AI APPLICATIONS & AGENTS</span></div><div class="intro-caption">A WORLD OF POSSIBILITIES<span class="intro-line"></span></div><button class="skip-intro">Skip intro ↗</button>';hero.append(intro);
 let skip=motion.matches,visible=true,frame=0,last=0,start=performance.now(),finished=false;

 const button=intro.querySelector('button');window.scrollTo({top:0,left:0,behavior:'instant'});
 function finish(){if(finished)return;finished=true;clearTimeout(window.introBootTimeout);window.scrollTo({top:0,left:0,behavior:'instant'});document.querySelectorAll('[data-intro-inert]').forEach(el=>{el.inert=false;el.removeAttribute('data-intro-inert')});document.documentElement.classList.remove('singularity-opening');intro.classList.add('is-gone');if(document.activeElement===button)document.querySelector('.hero-copy a').focus({preventScroll:true});setTimeout(()=>intro.remove(),1200)}
 button.onclick=()=>{skip=true;finish()};
 const escape=e=>{if(e.key==='Escape'){skip=true;finish()}};document.addEventListener('keydown',escape);
 if(skip){finish()}else{document.documentElement.classList.add('singularity-opening');document.querySelectorAll('header,.hero-copy,.floating').forEach(el=>{el.inert=true;el.setAttribute('data-intro-inert','')})}
 const failSafe=setTimeout(()=>{skip=true;finish()},7200);
 const gl=canvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'low-power',depth:false,stencil:false});
 if(!gl){canvas.classList.add('blackhole-fallback');finish();clearTimeout(failSafe);return}
 const vs='attribute vec2 position;void main(){gl_Position=vec4(position,0.,1.);}';
 const fs=`precision mediump float;
 uniform vec2 resolution;uniform float time;uniform float arrival;uniform vec2 pointer;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
 float fbm(vec2 p){return noise(p)*.55+noise(p*2.03)*.28+noise(p*4.07)*.12+noise(p*8.1)*.05;}
 vec3 plasma(float e){vec3 warm=vec3(.95,.68,.32),sage=vec3(.67,.80,.45);return mix(mix(warm,sage,arrival*.65),vec3(1.,.97,.82),clamp(e*.75,0.,1.));}
 float disk(vec2 p,float front){
  vec2 q=vec2(p.x,p.y/.16);float r=length(q),a=atan(q.y,q.x);
  float bands=fbm(vec2(r*24.-time*.11,a*4.+time*.06));
  float streak=.45+.55*sin(r*116.+bands*6.+time*.1);
  float envelope=smoothstep(.88,1.12,r)*(1.-smoothstep(1.3,3.45,r));
  float doppler=.65+.35*smoothstep(-2.,2.,p.x);
  return envelope*(.20+.85*bands+.25*streak)*doppler;
 }
 void main(){
  vec2 uv=(gl_FragCoord.xy-.5*resolution)/resolution.y;
  float scale=mix(.20,.255,arrival);vec2 p=(uv-pointer*.006)/scale;
  float tilt=mix(-.075,-.13,arrival);p=mat2(cos(tilt),-sin(tilt),sin(tilt),cos(tilt))*p;
  float r=length(p);float a=atan(p.y,p.x);
  vec3 col=vec3(.009,.013,.014);
  float haze=exp(-r*.8)*.025;col+=vec3(.45,.57,.30)*haze;
  // Sparse, stationary star field with a mild radial lens displacement.
  vec2 warped=uv*(1.+.018/(dot(uv,uv)+.025));vec2 cell=warped*330.;float rnd=hash(floor(cell));
  float star=smoothstep(.995,1.,rnd)*pow(max(0.,1.-length(fract(cell)-.5)*2.),7.);
  col+=vec3(.62,.69,.56)*star*.38*smoothstep(1.1,2.5,r);
  // Far side of the thin disk, seen around the dark event horizon.
  float rear=disk(p,0.);col+=plasma(rear)*rear*.85;
  float halo=exp(-abs(r-1.025)*5.)*.12;
  float ring=exp(-abs(r-1.025)*85.);
  float turbulent=fbm(vec2(a*7.+time*.025,r*38.-time*.06));
  float arc=exp(-abs(r-1.13)*17.)*(.4+.6*turbulent)*smoothstep(-.2,.45,p.y);
  float lower=exp(-abs(r-1.07)*36.)*(.18+.25*turbulent)*(1.-smoothstep(-.7,.1,p.y));
  col+=plasma(ring+arc)*(halo+ring*.85+arc*.85+lower);
  // Absorbing center, crisp against the photon ring.
  col*=smoothstep(.955,1.015,r);
  // Near-side disk crosses in front of the shadow, as in a strongly lensed edge-on view.
  vec2 frontP=p;frontP.y+=.025;
  float nearDisk=disk(frontP,1.)*(1.-smoothstep(-.10,.06,p.y));
  float equator=exp(-abs(p.y+.028)*105.)*exp(-abs(p.x)*.72)*(.75+.25*noise(vec2(p.x*38.-time*.15,1.)));
  col+=plasma(nearDisk+equator)*(nearDisk*.85+equator*.9);
  float horizontalGlow=exp(-abs(p.y)*13.)*exp(-abs(p.x)*.65)*.16;col+=plasma(.4)*horizontalGlow;
  col=vec3(1.)-exp(-col*mix(1.65,.65,arrival));
  // Preserve contrast behind the hero's typography.
  col*=mix(1.,.50,arrival);col*=1.-smoothstep(.25,1.,length(uv))*.55;
  gl_FragColor=vec4(col,1.);
 }`;
 function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}
 let program;
 try{program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vs));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Shader link failed');gl.useProgram(program)}catch(e){console.warn('Black hole fallback:',e.message);canvas.classList.add('blackhole-fallback');finish();clearTimeout(failSafe);return}
 const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const pos=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
 const uniforms=Object.fromEntries(['resolution','time','arrival','pointer'].map(k=>[k,gl.getUniformLocation(program,k)]));
 let px=0,py=0,tx=0,ty=0;
 hero.addEventListener('pointermove',e=>{if(e.pointerType!=='touch'&&!motion.matches){tx=e.clientX/innerWidth-.5;ty=.5-e.clientY/innerHeight}});hero.addEventListener('pointerleave',()=>{tx=ty=0});
 function resize(){const ratio=Math.min(1,1200/hero.clientWidth);canvas.width=Math.round(hero.clientWidth*ratio);canvas.height=Math.round(hero.clientHeight*ratio);gl.viewport(0,0,canvas.width,canvas.height)}resize();new ResizeObserver(()=>{resize();if(motion.matches)draw(performance.now())}).observe(hero);addEventListener('resize',()=>{resize();if(motion.matches)draw(performance.now())});
 function draw(now){frame=0;if(!visible||document.hidden)return;if(now-last<32&&!motion.matches){frame=requestAnimationFrame(draw);return}last=now;
  const elapsed=(now-start)/1000;let t=skip||motion.matches?1:Math.max(0,Math.min(1,(elapsed-2.7)/2.2));const eased=t*t*(3.-2.*t);
  px+=(tx-px)*.04;py+=(ty-py)*.04;
  gl.uniform2f(uniforms.resolution,canvas.width,canvas.height);gl.uniform1f(uniforms.time,motion.matches?0:elapsed);gl.uniform1f(uniforms.arrival,eased);gl.uniform2f(uniforms.pointer,px,py);gl.drawArrays(gl.TRIANGLES,0,6);
  hero.style.setProperty('--arrival',eased);if(t>=.98){finish();clearTimeout(failSafe)}
  if(!motion.matches)frame=requestAnimationFrame(draw);
 }
 function resume(){cancelAnimationFrame(frame);frame=requestAnimationFrame(draw)}
 new IntersectionObserver(es=>{visible=es[0].isIntersecting;if(visible)resume();else cancelAnimationFrame(frame)}).observe(hero);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelAnimationFrame(frame);else resume()});
 motion.addEventListener('change',()=>{if(motion.matches){skip=true;finish()}resume()});canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();cancelAnimationFrame(frame);finish();canvas.classList.add('blackhole-fallback')});
 resume();
})();
