# dragon-care

A game about raising dragons: a Fallout-Shelter-style cutaway base, a barn of dragons and a pair of towers for the
keepers who look after them (`docs/BASE_DESIGN.md`, `docs/KEEPERS.md`, `docs/ART_BIBLE.md`). Vanilla canvas and
TypeScript, no runtime dependencies.

Open `index.html` (via `npm run dev`, or the deployed page) and you're straight into the base: drag to look around,
tap a need bubble, a job chip or a dragon to Rush it. A day and a night pass in 3 minutes: the top bar's speed button
(or the keys 1-4) runs it at 2x, 4x or 8x, II (or p) pauses, and MAP (or m) opens the Map Room's table, where you pick
a mission, BEST TEAM and SEND a team off from the Aerie, then tap the TEAM OUT chip to watch it on the road. Tap a
keeper (or their badge, or Tab) to take them by hand: WASD or the arrows walk and climb, E or Space fetches and does
the chore in reach, Esc lets go -- and on a touch screen a pad of arrows, E and LET GO does the same. The barn is kept
in the browser and resumes on a reload; NEW, tapped twice, starts another. `docs/base/base_live.png` shows it running.

## Run it

```
npm install
npm run dev     # a dev server at http://localhost:<port>/index.html
```

## Build for deployment

```
npm run build    # bundles src/main.ts into a self-contained dist/index.html
```

`dist/index.html` has no external references and can be opened from disk or served from anywhere, GitHub Pages
included. Pushing to `main` runs `.github/workflows/deploy.yml`, which builds and publishes `dist/` to GitHub Pages
automatically (enable it once under the repo's Settings -> Pages -> Source -> GitHub Actions).

## Checks

```
npm run check    # typecheck, the palette gates, the care simulation, and the headless smoke suite
```

The game's own debug views (every look, every anim, the keepers' care acts and audits) live behind `?view=`; see the
comment at the top of `src/gallery.ts` for the full list.
