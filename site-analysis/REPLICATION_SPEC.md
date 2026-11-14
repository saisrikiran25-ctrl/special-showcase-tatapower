# Replication spec: madetodisrupt.com and organimo.com

Source: live inspection (computed styles, fetched CSS/JS, inline scripts, screenshots), 2026-11-14.
Confidence tags: [V] verified in code/DOM, [O] observed visually only, [?] not verified / inferred.

---------------------------------------------------------------------
# PART A. ORGANIMO (3D scroll-driven e-commerce)
---------------------------------------------------------------------

## A1. Stack [V]
- WordPress + WooCommerce, custom theme `organimo` (Vite-style hashed build: `js-25cd474e.js` 1.3 MB, `style-70bb85ec.css`).
- Three.js (r1xx, bundled, WebGL2) rendering into ONE fixed full-screen canvas (z-negative, `.fixed.fill`).
- GSAP + ScrollTrigger + SplitText (SplitText is a paid Club plugin), Lenis smooth scroll (`lenis-smooth`, `lenis-stopped` until loader finishes).
- Howler.js audio (`audio.mp3` / `audio.webm`, hover sounds via `data-audio-enter="audio.hover"`), audio toggle button `.js-audio-button`.
- Asset pipeline: GLTFLoader + DRACOLoader (compressed models), KTX2Loader (GPU-compressed textures, all `.ktx2`), HDR env map `skyBackground.hdr` / `space-v11.hdr`, cube env map `px/nx/...png`.
- A custom component framework: classes bound by selector (`class X extends Component { static selector = ".js-..." }`), a shared RAF collection (`RAFCollection.add(fn)`), `AssetLoader` singleton, `WebGL.scenes.{space,sky,underwater}`.
- Commerce: Stripe, Affirm page, Klaviyo, multi-currency plugin (USD/CAD/GBP/EUR/AUD via `?wmc-currency=`), YITH social login, TikTok/Meta/X/Google Ads pixels, GTM.

## A2. Design tokens [V]
```
--black:#171717  --white:#fff  --magnolia:#E7E6F0 (page bg)  --magnolia-dark:#E7E8F1
--dark-gray:#2D2F36 (headings)  --mid-gray:#565A69 (body)  --light-gray:#8C92A6
--light-blue:#CBD3E7  --input-fill:#EDEDF4  --input-border:#C7C7CE  --border-color:#2D2F36
--accent-purple:#5E5AFF  --accent-gold:#CEA154  --red:#DC3434  --header-btn-hover:#E8EEFF
Breakpoints: xsm 375, sm 768, md 1024, smallDesk 1200, lg 1366, xlg 1536, 1840, xxlg 1921, retina 2560
Pointer queries: touch=(hover:none),(pointer:coarse)  nottouch=(hover:hover) and (pointer:fine)
```
Fonts (self-hosted woff2): Mauren Light + Light Italic (serif display, accent words), Fracktif SemiBold (UI/labels, buttons), Manrope 400/500 (body).
- Body: Manrope 14px / 21px, color #565A69 on #E7E6F0.
- H1 (product page): Manrope 400, 68.25px, line-height 54.6px (0.8), letter-spacing -3.41px (-0.05em), color #2D2F36.
- Hero headline pattern: sans word(s) + italic Mauren emphasis word (e.g. "Li*m*itless", "ever*need*", "*marine*", "*in*gredients"). Implemented as `<span class="word" style="transition-delay:Xs">` per word with `<em>` for the italic letter(s).
- Eyebrow/subheading: small caps-ish `t-ls-2` (letter-spacing 2) with a dot + text + bordered pill ("FROM BODY [TO MIND]").

## A3. Page architecture [V]
Home = `.home.js-home` height ~60,273 px, containing three scroll zones:
1. `.js-section-space.home-scrolling-area` = 5,000 px, scene "space" (jar on a rock in a nebula sky). UI `space-0`.
2. `.js-section-sky.home-scrolling-area` = 21,000 px, scene "sky" (floating rocks, column, conch shell, goldfish, bubbles, water + stepping stones). UIs `sky-0`, `sky-1`.
3. `.js-section-underwater.home-scrolling-area` = 34,000 px, scene "underwater" (coral, seaweed, fish shoal, big fish, clam/pearl). UIs `underwater-0/1/2`.
Each `*-landing-ui` is a fixed 100vh overlay toggled with `.show`/`.hide`; text swaps as scroll progress crosses thresholds. Progress counter bottom-right (`%`), "Scroll to begin" hint, audio toggle bottom-center-left.

Copy per overlay:
- space-0: "From body [to mind]" / "Limitless begins here." / "Journey into the *wonderful world* of Organimo®" / SCROLL TO BEGIN
- sky-0: "Sea Moss & Bladderwrack" / "The only natural multivitamin you will *ever need*." / [Shop now] / "Superfood goodness" + blurb
- sky-1: "100% ethical & renewable" / "All naturally sourced *marine ingredients* from Canada." / "Highest quality ingredients" + blurb
- underwater-0: "The real limitless pill." / "Discover the benefits" + blurb
- underwater-1: "The miracle of the sea" / "100% wildcrafted and raw herbs." + infinite badge marquee (Vegan, Harvested in Canada, Non GMO, Gluten free, No preservatives, Made in USA)
- underwater-2: "A better you starts here" / "The ocean's best kept secret…" / [Shop now]
Then a black footer bar (Contact, Wholesale, Returns policy, News, Disclaimer, Privacy, Terms + FDA disclaimer).

Header [V]: pill "Shop" (swaps to "Home" label on inner pages via `js-header:shopLink/homeLink`), Affirm, News; centered wordmark "ORGANIMO" (letter-spaced); right: Login, currency pill, cart bubble with count badge (purple). Header is `pointer-events-none` with interactive children.

## A4. Loader [V/O]
- Full-screen dark (#171717-ish) overlay: wordmark top, gold wireframe triangle that fills as progress counts 0→100, then "COMPLETE" gold outlined pill, footer "Click anywhere to enable audio".
- Lenis is stopped until dismissed. Click enters the site and unlocks audio (browsers require a gesture).
- Measured: ~6% at 10 s, 100% at ~20 s (205 requests, ~23 MB). For your build: aim < 5 s, load hero scene first, stream the rest.

## A5. WebGL details [V from bundle strings]
- Renderer: `antialias` on, stencil off, `setPixelRatio(dpr>=2 ? 2 : dpr)` (DPR capped at 2). `renderer.info.autoReset=false` when debug GUI present.
- Camera: `PerspectiveCamera(fov≈50 default, near .1, far 2000)` driven by scroll progress along a path [?] exact keyframes not extracted.
- Scenes are classes registered on `WebGL.scenes` with `components` (e.g. `underwater.components.fog` with global uniforms/defines, `water` with `uProgress` uniform tweened over 2s).
- Textures: matcaps (`gold_matcap`, `Jar_matcap`, `matcap`, `matcapRough`, `matcapBubbles3`, `pearl-matcap`) = cheap fake-PBR look; normals for water (`waternormals.ktx2`), rocks, shell, columns; `smoke.ktx2` + `shadow.ktx2` (fake contact shadow), `noise.ktx2`, baked diffuse maps (`Seashell_diffuseBake`, `coralTubes_diffuseBake`), alpha seaweed.
- Models: `fish-shoal.glb`, `fishbig.glb`, jar, shells, coral, rocks, columns. Fish shoal uses instancing (`InstancedMesh`, bounds 40×20×40).
- Bubbles: instanced spheres with matcap + noise.
- Water: plane with scrolling normal map, fog, reflection feel from HDR env.
- Easing used in GSAP: `expo`, `expo.inOut`, `power2/3/4.*`, `sine.inOut`, a registered `customOut`; typical durations .35–.65 s for UI, 1.4–3 s for scene transitions.
- Parallax on content: `X.to(el,{yPercent:-15,scrollTrigger:{trigger:el,scrub:true}})`; paired elements `fromTo y:"8%"→"-8%"`, `scrub:1`, `start:"top 70%" end:"bottom 10%"`.

## A6. Product page `/seamoss/` [V/O]
- Announcement bar: truck icon + "FREE DELIVERY ACROSS THE US", light blue-lavender gradient.
- Two-column hero: left = rounded-corner image carousel (5 dots + 5 thumbnails, purple-lit product shots), right = star rating "Rated 4.8/5 by Organimo Community!", H1 (sans + italic), tagline with italic "optimal health", three emoji bullets.
- Purchase card: radio "SUBSCRIBE AND SAVE" $69.99 (struck $79.99), interval select "Every month (recommended)", "Skip or cancel any time / 30 day risk-free guarantee", secondary "BUY ONE TIME $79.99", dark pill "ADD TO CART" with circular arrow chevron.
- Sticky bottom add-to-cart bar (logo, product name, price, button) appears after scroll (`js-bar-sticky`).
- Sections in order: Ultimate Superfood copy + badge marquee, ingredient cards (Irish Sea Moss, Bladderwrack), "Packed with nutrition", accordion tabs (Benefits ×8: skin, cognitive, sexual, immune/energy, heart, respiratory, joint, digestive; Additional Info; FAQs ×12), Affirm text block, "The only multi-vitamin you'll ever need" marquee, Refill pouch section, full-bleed 100vh image/canvas section, testimonials grid (~15 reviews with name – country), news strip, footer.
- 3 canvases on this page (WebGL used for hero/section visuals too) [V count, ?purpose].
- JSON-LD schema present (2 blocks).

## A7. Mobile findings [V/O on /seamoss/]
- No horizontal overflow (375 = 375).
- Hamburger left, wordmark center, currency + cart right.
- Sticky bar BUG: "ADD TO CART" text wraps into 3 lines and the WooCommerce screen-reader price string leaks visibly ("Original price was: $79.99.$69.99Current price is…"). Do not copy; hide `.screen-reader-text` and nowrap the button.
- Home mobile not captured (loader never rendered in time). [?]

## A8. Problems to avoid when replicating
1. Loader ~20 s and gate-click. Use progressive load and a skip.
2. Home has zero headings and 16/18 images without alt (52/55 on product page). Add semantic h1/h2 in a visually-hidden or real DOM layer for each scene.
3. `html/body overflow:hidden` + scroll container div breaks native anchors, find-in-page, browser scroll restoration.
4. Heavy third-party tags before consent; no consent UI seen.
5. Duplicate nav text in DOM (each link text twice for the hover-swap effect) is read twice by screen readers; set `aria-hidden` on the clone.

---------------------------------------------------------------------
# PART B. DISRUPT (dark editorial agency, custom vanilla-JS motion)
---------------------------------------------------------------------

## B1. Stack [V]
- WordPress 7.x, Astra theme, Elementor Pro (Motion Effects, sticky, nav-menu popup), Ninja Forms + reCAPTCHA, WP Rocket (lazyload, delay JS), Cloudflare, Hotjar, CookieYes.
- ALL signature animation is hand-written vanilla JS/CSS pasted into Elementor HTML widgets (no GSAP/Lenis/Three). Easy to port to any framework.
- Page height 18,493 px desktop / 11,348 px mobile.

## B2. Design tokens [V]
- Page: bg #0D0D0D, text #FFF, secondary gray #6B6B6B (`--lr2-gray`, `--ltr-gray` used for unrevealed text), accent yellow for taglines (~#F5D547 [O]), neon lime/orange/pink inside portfolio mockups [O].
- Fonts: Clash Display 600/700/850 (headlines, uppercase), Syne 400–800 (body/UI).
- H1: Clash Display 850, 71.68px/65.9px, uppercase, white.
- H2: Syne 600 30px/39px. H3: Syne 600 24px/31.2px, uppercase, letter-spacing .72px.
- Nav links (menu popup): Syne 600 24px, padding 13px 20px, transition .4s.
- Marquee heading "OUR EDGE /": `font-size:clamp(208px,6vw,72px)` (note: clamp min>max so it is effectively 208px, a bug that works), weight 700, letter-spacing -8px, line-height 1, nowrap; mobile (≤678px) 60px / -6px. Animation `edge-scroll 50s linear infinite` translateX(0→-50%).
- Rounded cards ~24–28px radius, 1px subtle borders, dark glass surfaces.
- `mix-blend-mode:difference` used on one custom block.

## B3. Section map (home) [V/O]
1. Fixed header: logo (VS/Disrupt monogram) that alternates with the line "Brand Therapy, Without the couch." (see B4a), "/ Menu" button top-right.
2. Hero `#pocTiltSection`: H1 "BRANDS IN SESSION", sub "Strategic brand therapy for identities, experiences, and activations that stay with people.", CTA pill "START A SESSION" (#contact). Floating image cards + starfield canvas.
3. WORK: giant gradient-metal "WORK" title, then a bento grid of portfolio mockups (currently placeholder template text).
4. Logo marquee (client logos, `logoMarqueeScroll var(--duration) linear infinite`, translateX(0→-50%), pauses disabled, `prefers-reduced-motion` disables).
5. Tilted ribbon marquee "Where Ideas Become Experiences" (`mxqTrack`, two tracks, rotated ~-3°).
6. THE STORY: big paragraph with scroll-driven letter reveal (gray→white).
7. Mission / Vision switcher (`.mv-switch`).
8. Services: 3D helix carousel (`#ss3d`) of 4 service cards.
9. "OUR EDGE /": sticky stacked cards (5) with image left, text right.
10. CTA "READY TO DISRUPT THE ORDINARY?" + Ninja form (Name, Email, Number, Project Description, reCAPTCHA, Submit pill).
11. Footer: logo, Home/Work/Services/Contact, Instagram ↗, LinkedIn ↗, copyright "Powered by AzZ.media", Privacy/Cookies.
Service pages: `/services-brand-strategy/`, `-brand-identity/`, `-event-experiences/`, `-creative-activations/`: pill tab bar (active = teal tint pill), left H1 + tagline, right icon+title+description list (7 items for strategy), long-form "How we work", "View project" cards ×8, then the same contact form.

## B4. Interaction code (re-implementable, extracted logic)

### B4a. Logo ⇄ tagline wipe loop (`#tlLogo`, `#tlText`)
CSS-class driven clip wipe. Timings: reveal 700 ms (left→right), hide 700 ms (right→left); holds: logo 1600 ms, text 1500 ms; gaps 120 ms; loop gap 200 ms. Sequence: logo visible → hide logo → reveal text → hold → hide text → reveal logo. Classes `.is-revealing` / `.is-hiding`, CSS vars `--revealDur`, `--hideDur` (clip-path or mask-position wipe [?] CSS not extracted).

### B4b. Hero tilt cards (`#pocTiltSection`, `#pocTiltLayer`)
- 9 images; each is `.poc-edge-img` absolutely positioned with per-breakpoint spec `{top|bottom, left|right (%), z, drift, w, h, rx, ry, rz, tx, ty}`.
- LG (≥1281) positions, e.g. #1 `top15% left10% z55 w200 h150 ry18 rz8`; #4 `top15% right10% z68 w240 h150 ry-18 rz-8`; #6 `bottom-4% right10% z62 w250 h210`; 9 cards total. SL ≤1280 smaller/outward; MD ≤1024 hides cards 2,3; SM ≤720 own set. Rebuild layer on breakpoint change.
- Parent layer transform: `rotateX(currentRX) rotateY(currentRY) translate3d(currentTX,currentTY,0)` with lerp ease 0.10 per frame.
- Mouse: nx,ny ∈[-1,1] relative to section; `targetRY = nx*maxTilt`, `targetRX = -ny*maxTilt`, `targetTX = nx*maxShift`, `targetTY = ny*maxShift`. CSS vars `--poc-max-tilt` default 14°, `--poc-max-shift` default 18px.
- Each card: `translate3d(-targetTX*.35*drift + tx, -targetTY*.35*drift + ty, z) rotateX(rx) rotateY(ry) rotateZ(rz)` (counter-parallax by depth). Touch events mapped to same handler; mouseleave resets to 0. Parent needs `perspective` + `transform-style:preserve-3d` [?].
- Canvas `#pocOrbitCanvas` (~1003×520, class `poc-orbit-canvas`) = particles/star field "orbit" behind headline [V exists, ?exact particle math: script continues after "PARTICLES" marker].
- A tiny script dispatches a synthetic centered `mousemove` on load so tilt initialises.

### B4c. Letter-by-letter scroll reveal (`.ltrreveal`, `.lr2-text`)
- Split text into word wrappers `.w` containing letter spans `.ch`; only letters counted.
- CSS vars: `--ltr-start .7`, `--ltr-range .45`, `--ltr-white #fff`, `--ltr-gray #6b6b6b` (same for `lr2-*`).
- Progress from element rect vs viewport: starts when element top reaches 70% of viewport height, completes over 45% of viewport; letter i turns white when progress*N > i (color interpolation gray→white) [logic summarized, final update() body truncated in extraction].

### B4d. Mission/Vision switch (`.mv-switch`)
`p = clamp01((vh - rect.top)/vh)`; `classList.toggle('is-vision', p >= 0.85)`. IntersectionObserver thresholds [0,.25,.5,.75,1] + passive scroll/resize via rAF throttle. CSS cross-fades the two states.

### B4e. Helix service carousel (`#ss3d`)
- Section is `position:sticky` inner stage inside a tall `.ss3d-scrollspace`; progress p = clamp(-rect.top, 0, spacerHeight)/spacerHeight.
- `active = p * (n-1)`; for each card `rel = i - active`, `a = rel*95°`:
  `x = sin(a)*RADIUS + rel*STEP_X`, `y = rel*HELIX_Y + rel*STEP_Y`, `z = cos(a)*RADIUS*(DEPTH/(2*RADIUS))`, `rotateY = a°`, opacity = lerp(.20, 1, (z+DEPTH/2)/DEPTH), pointer-events off if opacity<.28.
- Defaults (CSS vars): `--radius 380`, `--depth 520`, `--step-x 70`, `--step-y 56`, `--helix-y 120`, `--yaw 34`, `--pitch 10` (pitch unused, set 0).
- Smoothing: `currentP = lerp(currentP, targetP, 0.10)` on rAF until |Δ|<0.0005. Card transform: `translate(-50%,-50%) translate3d(...) rotateY(...)`.

### B4f. Sticky stacking cards (`.sticky-cards > .sticky-card`)
- Cards `position:sticky; top:100px`. For every card except the last: t = (cardCenterY - (vh/2+40)) / ((100 - vh) - (vh/2+40)), clamped 0–1; `tEased = easeOutCubic(t)^(1/2.2)`; scale = lerp(1, 0.58, tEased); opacity fades 1→0.1 starting at tEased .4; extra `1 - idx*0.01` stack scale. Last card untouched.
- Also Elementor sticky on a 528px block (offset 400).

### B4g. Marquees
- `.mxq` track: clone seed content until width ≥ 2.2×viewport, duplicate as group B (aria-hidden) → `@keyframes mxq-scroll translateX(0 → -var(--mxq-shift))` linear infinite at `--mxq-speed`; rebuilt on resize; tilted band, reduced-motion respected; mobile stage height 140px, band 50px.
- Logo marquee: cards `--card-w` (230px mobile) / `--card-h`, `--gap`, `--duration`.

### B4h. Elementor Motion FX on home images [V]
Scroll-linked scale (e.g. out-in, speed ±6–9, range 6–29%/18–52%) and translateY (negative, speed 5, range 52–72%) on viewport range; `fadeInUp` entrance on a couple of elements. Equivalent: IntersectionObserver + scroll-progress transforms.

### B4i. Other
- Two autoplay muted looping `<video>` (1920 & 1080 wide) inside Work/Story areas; no posters.
- Menu = Elementor popup (full-screen overlay), 4 links Home/Work/Services/Contact (hash anchors), social links.

## B5. Known defects (do not copy)
- ~40 MB / 98 requests; DOM ready 3.3 s, load 8.7 s. PNG 2560px hero images unoptimised (use AVIF/WebP, srcset, preload hero).
- 21/28 images no alt; "OUR EDGE /" repeated ×10 as h2 (use one heading, decorative duplicates `aria-hidden`).
- Staging URL in cookie policy link (`disrupt.techlab-staging.solutions`).
- Mobile: 2px horizontal overflow (377>375); hero subtitle overlaps cards; consent FAB overlaps content.
- Work grid uses template placeholder text; "View project" cards lack real projects.
- Form requires phone + reCAPTCHA; heavy for a first touch.
- Unprotected rAF loops keep running after tilt settles (tilt loop never cancels); throttle/pause offscreen.

---------------------------------------------------------------------
# PART C. WHAT I DID NOT VERIFY (be explicit before building)
---------------------------------------------------------------------
- Organimo: exact camera path, scroll thresholds for each overlay, shader GLSL, model poly counts, home page on mobile (likely a reduced/poster fallback), cart/checkout flow, account pages, the audio design.
- Disrupt: starfield particle code (after "PARTICLES"), Work grid markup and real project pages, popup menu visuals, exact clip-path CSS for the logo wipe, form validation states, Brand Identity / Event / Activations pages, and the "Mission/Vision" copy.
- Both: perf numbers are single runs from one machine/network.

# PART D. SUGGESTED BUILD PLAN
Organimo-style: Next.js/Vite + three + @react-three/fiber (or raw three), GSAP ScrollTrigger + Lenis, KTX2/Draco pipeline (gltf-transform, toktx), one persistent canvas, scene classes with `progress` setter, DOM overlays keyed to progress ranges, visually-hidden semantic layer, DPR cap 2, loader that resolves on first-scene readiness, audio opt-in.
Disrupt-style: plain components (no heavy libs): tilt layer (B4b), letter reveal (B4c), helix (B4e), sticky stack (B4f), marquee (B4g), all rAF-throttled, `prefers-reduced-motion` honoured, AVIF images, real alt text.
