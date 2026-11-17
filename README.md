# Sai Srikiran J — AI Applications & Agents Portfolio

Complete source and media for the portfolio: an Interstellar-style ray-traced black hole that the page flies through as you scroll, a scroll-driven hero, stacking project cards, a 3D helix for the highlights, project details, and five video demonstrations. All text and links are unchanged from the previous version.

## Local preview

No build step or package installation is required. With Python installed, run from this directory:

```sh
python -m http.server 8000 --directory dist
```

Open http://localhost:8000. Serve over HTTP rather than opening the HTML file directly.

Debug helpers: `?scale=0.8` pins the black hole's render resolution (otherwise it adapts to the GPU between 0.62 and 1.1 of native resolution on desktop). In the console, `window.__bhTune = [diskOpacity, haze, intensity, temperatureExponent]` live-tunes the accretion disk (defaults `[.5, .012, 3.8, 1.9]`).

## Files

- `dist/index.html`: portfolio content and page structure (content is verbatim).
- `dist/style.css`: design system, layout, responsive rules, reduced-motion rules.
- `dist/app.js`: hero tilt and scroll journey, letter-by-letter reveal, stacking cards, helix carousel, marquees, project dialog, filters, menu.
- `dist/blackhole.js`: the WebGL black hole (geodesic ray tracing in a fragment shader), the scroll-driven camera director, bloom, adaptive resolution and the loader.
- `dist/assets/`: original demonstration videos, landing-page thumbnails, and project data.
- `tests/layout-check.js`: in-page layout and content checks (overflow, clipped text, headline fit, canvas shape, nine projects, four highlight cards, key links). Paste it into the browser console on the running site at any viewport size; it returns `{ passed, failures }`. Last run: 0 failures at 320, 390, 430, 805 and 1231px wide.
- `site-analysis/REPLICATION_SPEC.md`: analysis of the two reference sites this design draws from.
- `.openai/hosting.json`: existing Sites project and static hosting configuration.
- `.claude/launch.json`: preview-server entry for local development.

## How the black hole works

Each pixel fires a camera ray that is bent around a Schwarzschild black hole using the photon equation of motion. Rays that fall in leave the black shadow; rays that cross the thin accretion disk pick up its light, which produces the lensed halo over and under the hole, the thin near-side band, and the photon ring. The disk has Keplerian rotation, Doppler beaming (one side brighter), gravitational redshift, and a turbulent texture. Stars are looked up with the bent exit direction, so they stream near the hole. A camera director interpolates keyframes tied to page sections (far reveal, dive, dim backdrop, contact close-up).

## Accessibility and fallbacks

- `prefers-reduced-motion`: no loader, no scroll effects, a single static black hole frame, stats shown as a plain grid.
- Headline, paragraphs and marquees keep accessible text (`aria-label`, decorative copies are `aria-hidden`).
- No WebGL or shader failure: a CSS-drawn black hole replaces the canvas and the page still works.
- Under 900px the project cards are a normal stack and the menu becomes a full-screen overlay.

## Hosting

Deploy the contents of `dist` to a static web host. Keep the asset paths and filenames intact. The videos are included directly in this repository. Fonts load from Google Fonts and Fontshare (Clash Display), with system fallbacks.

The opening plays on each visit or refresh. It can be skipped with the button or Escape.
