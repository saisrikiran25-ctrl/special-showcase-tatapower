# Sai Srikiran J — AI Applications & Agents Portfolio

Complete source and media for the portfolio, including the circulating black-hole opening, subtle animated hero, project details, and five video demonstrations.

## Local preview

No build step or package installation is required. With Python installed, run from this directory:

```sh
python -m http.server 8000 --directory dist
```

Open http://localhost:8000. Serve over HTTP rather than opening the HTML file directly.

## Files

- `dist/index.html`: portfolio content and page structure.
- `dist/style.css`: responsive layout, styling, and transitions.
- `dist/app.js`: project interactions and video playback.
- `dist/blackhole.js`: WebGL black-hole animation and opening transition.
- `dist/assets/`: original demonstration videos, landing-page thumbnails, and project data.
- `.openai/hosting.json`: existing Sites project and static hosting configuration.

## Hosting

Deploy the contents of `dist` to a static web host. Keep the asset paths and filenames intact. The videos are included directly in this repository.

The opening plays on each visit or refresh. Reduced-motion preferences are respected; the opening can also be skipped.
