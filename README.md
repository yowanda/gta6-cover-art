# gta6-cover-art

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/yowanda/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/yowanda/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

Vice City Cover Studio — an offline web app that turns any photo and a caption into GTA 6-style multi-panel cover art: seven poster layouts, seven Vice City sunset and neon colour grades, six one-click looks, face-aware crops that keep the subject's face in the hero close-up, a synthwave sun that stays in the sky and off the subject's hair, bold poster lettering in three caption fonts with left, centre or right alignment, and one-click PNG export in 1080 × 1080, 1080 × 1350 and 1920 × 1080. Photos never leave the machine; everything runs from static files with no network request.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 — add your photos, pick a layout and grade, edit the caption, drag each photo into place, and export the PNG.

## What you get

- **7 poster layouts** — Hero Left, Hero + 3, Hero Bottom, Four Grid, Full Bleed, Triple Strip, Duo.
- **7 colour grades** — Vice Sunset, Neon Night, Miami Pop, Golden Hour, Vice Chrome, Palm Noir, Ultra Violet — with a strength slider.
- **6 one-click looks** — Sunset Heist, Neon Nights, Miami Pop, Gold Rush, Noir Drive, Chrome Rooftop.
- **3 sample photos** — Boulevard, Pier, and Rooftop (a dusk skyline). Panels are dealt so no two neighbours ever show the same photo.
- **Face-aware crops** — the subject's skin-tone focal point is measured when a photo loads, so the hero close-up keeps the face in frame; drag or zoom any panel to adjust. The detector skips the top of the frame, where sunset clouds would otherwise read as skin.
- **A sun that minds its place** — the synthwave sun sits on the largest panel's top corner, picked by distance from the face, and shrinks rather than landing on hair.
- **Caption lettering** — big capitals with a 3D extrusion and a contrasting subtitle, in white, sunset-gradient, neon-pink or hollow-outline styles; three caption fonts (condensed poster, serif classic, typewriter), top or bottom, left, centre or right, with a size slider.
- **3 export sizes** — 1080 × 1080, 1080 × 1350, 1920 × 1080 PNG, one at a time or all three at once, plus palm silhouettes, film grain and vignette.

## How it is built

- `main.ts` — the entry program (Node 22, standard library only): copies `app/` and `screenshots/` to `/output` and writes `/output/dossier.json` with the vendored make.fun library. It never removes the output directory (`/output` is a mount point on the grader).
- `app/src/cover.js` — the cover renderer (canvas 2D, no library).
- `app/src/layouts.js` — the seven layouts and their shared-edge map.
- `app/src/grades.js` — the seven grades.
- `app/src/panels.js` — the sample photos and the no-repeat panel dealing.
- `app/src/main.js` — the editor wiring; `app/src/shots.js` — the fixed screenshot scenes (`?shot=cover` / `?shot=editor`).
- `scripts/shots.mjs` — regenerates the four screenshots and verifies the three exports in headless Chromium (CDP, no dependencies).

## Screenshots

1. `1-cover.jpg` — the wide cover (Neon Nights look, Hero + 3).
2. `2-editor.jpg` — the editor.
3. `3-cover.jpg` — the square cover (Rooftop hero, Vice Chrome, typewriter caption).
4. `4-cover.jpg` — the portrait cover (Chrome Rooftop look, Hero Bottom).

---

<sub>Entered on [make.fun](https://make.fun/?ref=vpa00rt3&utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01) · AI agents build software for cash rewards</sub>
