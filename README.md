# dragon-care

A game about raising dragons: a Fallout-Shelter-style cutaway base, a barn of dragons and a pair of towers for the
keepers who look after them (`docs/BASE_DESIGN.md`, `docs/KEEPERS.md`, `docs/ART_BIBLE.md`). Vanilla canvas and
TypeScript, no runtime dependencies.

Open `index.html` (via `npm run dev`, or the deployed page) and you're straight into the base: drag to look around, tap
a need bubble, a job chip or a dragon to Rush it. A day and a night pass in 3 minutes: the top bar's speed button (or
the keys 1-4) runs it at 2x, 4x or 8x, II (or p) pauses, and MAP (or m) opens the Map Room's world map: a little island
of places -- the mill by the brook, the mine mouths, the owl's oak, the Storm Roc's crag, the hot springs... -- with the
day's missions pinned at them and the lands you haven't reached yet under cloud. Tap a pin, BEST TEAM and SEND a team
off from the Aerie, and the game follows it on its adventure: the camera stays on the Aerie as the team gathers and
sets out over the sky bridge, then goes with it down its road -- the keepers mind the barn meanwhile, and there's no
going back to it (MAP still shows the team's flag on the map) until the team is home and you tap its result card away.
On the road you play it: at each stop the team meets a challenge (a spring flood, a grumpy miller, thick fog...), a
pack of the region's little enemies (mud goblins, mole miners, thorn sprites, storm imps, frost imps, cinder imps) or,
at the road's end, the region's boss (the Bridge Troll, the Mole King, the Briar Boar, the Storm Roc, the Frost Giant,
the Cinder Golem), and you pick what each dragon does turn by turn as in the Arena (its breath -- thrown at the enemy in
a fight -- a show-off, a rest, its rider's special), or leave it to the trail coach (AUTO); a worn-out pack goes up in
puffs of smoke and a worn-out boss sits down seeing stars and runs off, nobody is hurt, the outcome is told at the
road's end, and every stop brings XP. Tap
a keeper (or their badge, or Tab) to take them by hand: WASD or the arrows walk and climb, E or Space fetches and does
the chore in reach, Esc lets go -- and on a touch screen a pad of arrows, E and LET GO does the same. ARENA (or b) opens
the Arena on the roof: tap your dragon, then its sparring partner, and START BOUT -- the two ride up and spar turn by
turn, you picking your dragon's moves (or AUTO), each element strong against one other and weak against another; nobody
is hurt (whoever runs out of puff takes a nap), and both come home with XP, levels and new skills. A dragon grows a
stage every 30 game days (90 minutes at 1x): you start with a young adult of each kind, missions bring eggs home to the
Hatchery, and elders retire to the garden past the right tower (the last one able to fly a mission stays until another
can). The barn is kept in the browser and resumes on a reload; NEW, tapped twice, starts another.
`docs/base/base_live.png` shows it running.

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
