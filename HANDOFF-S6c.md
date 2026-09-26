# Handoff: S6c — Night you can see

Branch `claude/outstanding-issues-s6c`, built from b17210c. `npm run check` passed after the review fixes (9727fd3). Drop this file when merging.

## S6c — Night you can see

**Built** (base b17210c; `npm run check` green on the committed tree: typecheck, palette 2374/2374 + keepers 164/164 +
**BACKDROPS 1771/1771** (was 1105: +663 night variants of every gated wall/backdrop/prop at steps 1-3, +3 table checks)
+ eggs 8/8; sim sections 1-16 (section 11 extended); smoke **92 views** (90 - 2 `layers=world` + 2 `layers=cast` + 2 new
turn cases) + 1 moved pair + 2 TINT pairs). Advances #8 ("Include day night cycles": night now reads at a glance).
No simulation or save change (`SAVE_VERSION` stays 6; `barnDigest` b4c21913 unchanged; the day frame a5fa57aa is
pixel-identical to S6's).

- `src/game/surfaces.ts`: NEW `MOONLIGHT '#5c6a9c'`, `moonlit(day)` (= `mix(day, MOONLIGHT, 0.5)`), private
  `NIGHT_MOONLIT` (the day colours moonlit: WALLS, EMPTY/LIFT walls, STONE, hedge/lawn/fence, timber and wood, the
  towers' shell, roof, cone, ground, hearth, tile lines, map, saddles) and `NIGHT_KEEPS` (same at night on purpose: NEST
  = mattress straw, firebox, doorway dark `#3a2a26`); **`NIGHT: Record<dayHex, nightHex>`** (the ONE table, 40 entries,
  37 moonlit); **`nightColour(day, step)`** (step 0 day, 3 NIGHT[day], 1-2 `stepped` mixes; identity for a colour not in
  the table).
- `src/game/sky.ts`: `Lights.walls: 0|1|2|3` (= `dimness(c)`: the dorm lamps' rings step with it) from `lightsOf`.
- `src/game/building.ts`: a module-level pen step; every pen (`rect`, `box`, `disc`, `poly`, `line`, `member`, and the
  cel tones via private `tones(c)` = `makeTones(nc(c))`) maps its colour through `nightColour`.
  **`drawBuilding(rooms, step = 0)`** and **`drawLiftCar(g, y, step = 0)`** (DIFFERS: new optional `step`). `drawPlates`
  and `drawLights` draw at step 0 (plates and lights keep their colours).
- `src/game/gardenArt.ts`: the same pen mapping; tiles cached per `kind step`; **`drawGarden(g, plots, worldW, view,
  step = 0)`**; `drawGardenLights` draws the lanterns' posts at `lit.walls`.
- `src/game/base.ts`: NEW `export type Layers = 'all'|'world'|'cast'`; `BaseViewOpts.layers?: Layers`; private
  `buildings: (HTMLCanvasElement|null)[]` (step 0 built in `use()`, others on first need, kept per world: about 6 ms
  each, measured in Chromium) and `building(step)`; `draw()` reads `lightsOf(read).walls` and passes it to the building,
  the garden and the car; `layers=cast` draws only the cast (dragons, keepers) and bubbles on CLEAR. Hook: NEW
  `night: number` (the step drawn; `types/globals.d.ts` updated).
- `src/gallery.ts`: `layers=cast` parsed (`GalleryParams.layers: 'all'|'world'|'cast'`).
- `tools/palette-check.ts`: gate (w) adds `<what> night k/3` for every non-phased gated colour (walls, stone, garden,
  props; one-sided lighter for walls/backdrops, either way for props) and a `(w) NIGHT` block: every WALLS / string
  BACKDROPS field / PROPS colour (and everything gated) has a NIGHT entry; no FLOORS / STRAW_SEAM / PATH_EDGE entry
  changes; keys are `#rrggbb` lower case.
- `tools/sim-check.ts` 11: `lit.walls` is 0 under the day's sky, 3 under the night's, >= nightness, equal to the rings
  below 2, and takes every step 0-3 over a day (both day lengths).
- `tools/smoke.ts`: `Case.pixels`; `timeFields(phase, persist, night?)` checks `b.night`; TINT: `layers=cast` noon/22:00
  same frame + same barn (replaces S4's `layers=world` equality); noon/22:00 whole frames with `differ: 0.35` →
  `nightDiff()`: share of changed pixels >= 35 %, the changed pixels darker (mean L) and cooler (blue - red) by night,
  every FLOORS pixel (rows 16-338) unchanged. NEW cases `t=600&hour=17` (18:20, step 1) and `t=600&hour=4` (05:20,
  step 2); the garden night case checks step 3.
- `tools/shots.ts`: NEW `base_dusk_turn` (hour=17), `base_dawn_turn` (hour=4), `base_night_cast` (layers=cast).
- Docs: BASE_DESIGN 1 (a line under the darkness rule), 7 (the night bullet rewritten: what night changes and never
  changes, numbers), 8 (built paragraph, file table rows), 9 (the "quiet night" question answered); ART_BIBLE status
  line (1771; "the walls may shift with the hour, the dragons and the floors never") and 5.8 (intro + the (w) block
  re-pasted: only lines appended).

**How a merging slice (S6b, S7, S9a, ...) adds its colours to the night** (binding for merges):
1. Draw the new structure in `building.ts` (or `gardenArt.ts`) with the existing pens (`rect`/`box`/`disc`/`poly`/
   `line`/`member`, cel tones via `tones(c)` not `makeTones(c)`; a raw `g.fillStyle = X` must be `nc(X)`), so it is
   drawn into the per-step building canvas automatically.
2. Add each of its day colours to `NIGHT_MOONLIT` in `src/game/surfaces.ts` (or to `NIGHT_KEEPS` with the reason it
   stays; never a FLOORS colour). A new WALLS / BACKDROPS (string field) / PROPS entry with no NIGHT entry fails
   `npm run palette` ("(w) every wall, backdrop and prop colour has a night colour"), and its night mixes are gated by
   (w) automatically once it is in the gate-(w) list. A mark colour (a line, a post) only needs step 2.
3. Nested per-phase backdrop records (S9a's `BACKDROPS.climate[climate][phase]`) are NOT in the table (they have their
   own phases); the check only looks at string-valued BACKDROPS fields. A colour a new structure shares with a light
   or a floor (e.g. `#f2d36a` is the lantern AND a flower) must not be put in the table: use a distinct hex.
4. Anything drawn per frame in world space that is part of the shell (like the lift car) takes the `step` (`lightsOf(read).walls`).

**Measured**

```
smoke TINT: view=base&t=600&hour=12&layers=cast / hour=22&layers=cast: the same frame e2d142c4 and barn b4c21913
smoke TINT: view=base&t=600&hour=12 / hour=22: frames a5fa57aa / 8949d103; 69.2 % of the pixels changed, darker (L 0.560 -> 0.481) and cooler (blue less red -28.8 -> 16.0); all 22193 floor pixels the same
palette: (w) NIGHT 40 entries, 37 moonlit, 3 the same on purpose; thinnest night colour: the moonlit wood #807277 L 0.180, 33 % lighter than lightning elder (tub/pallet/trunk/gate leaf); walls at night L 0.199 (bare) to 0.308 (bath)
BACKDROPS: PASS 1771 of 1771
sim 11: ... the lights, the icon and the walls' night steps (0 to 3) with it ...
drawBuilding per step: 5.6-6.9 ms (Chromium headless, once per step per world)
```

Mutation-checked: dropping the hedge from the table fails palette ("none for garden hedge #7f9e6c, BACKDROPS.hedge");
adding FLOORS.straw fails ("FLOORS.straw #e0d6b8 -> #9ea0aa change at night"); a black MOONLIGHT fails 168 (w) gates.

**Deviations and why**

1. **Night steps follow `dimness`** (the lamps), not a separate dusk/dawn schedule: walls step 1/2/3 at 18:20/18:40/
   19:00 and back 05:00-06:00. So `base_dusk` (19:20) shows full night walls and `base_dawn` (06:20) full day walls;
   the stepped turns are in the NEW shots `base_dusk_turn` (18:20) and `base_dawn_turn` (05:20) and smoke cases.
2. **The table is computed**, not hand-written literals: every moonlit entry is `moonlit(day)` (one recipe, one blue),
   so the table and the gate stay in step when a day colour changes. Overrides would go in `NIGHT` directly.
3. **Props are moonlit too** (hearth, tub, pallets, gate leaf, map, saddles, hood, tile lines), beyond N4's list: left
   at day colours they glowed against night walls. Lights, flames, flags, bunting, crocks, flowers, apples, plates
   and the pale straw of nests/mattresses keep their colours (lamps and names must read; straw is floor-like).
4. `layers=world` is kept (plan 3.10) but now shows the moonlit building; the no-tint equality moved to `layers=cast`.
   The hook gained `night` (not in the plan) for smoke to check each step.

**Gaps and stand-ins**

- The plates (room names) stay day-coloured at night (readable); the window panes show the sky (as S4).
- Only 4 building canvases per world are cached (about 4 MB each); a NEW or load rebuilds them lazily.
- No keeper gate against night walls (keepers were never gated against walls by day either); looked at in shots
  (Pip, Bea, Tomas, Iris all read against night walls).

**See it**

- `node tools/shot.ts out.png="view=base&t=600&hour=22" --scale 2` (base_night), `hour=18` (base_dusk, 19:20),
  `hour=5` (base_dawn, 06:20), `hour=17` (base_dusk_turn, 18:20, step 1), `hour=4` (base_dawn_turn, 05:20, step 2),
  `hour=22&layers=cast` (base_night_cast), `view=base&preset=garden&cam=1304,376&t=600&hour=22` (base_garden_night),
  `hour=22&cam=300,100` (roof), `hour=22&cam=0,300` (west), `hour=22&cam=560,376` (east).
- Shots looked at: `scratchpad/shots/s6c/` (pre_day/pre_night before; night, day, dusk, base_* after).

### S6c review

Fixed:
- building.ts roof courses: the raw `g.strokeStyle = '#6e2a24'` now goes through `nc(...)`, so the roof's course lines are moonlit with the roof (checked in shots fx_roof.png). The rest of building.ts and gardenArt.ts has no raw fill or stroke outside the pen except INK.
- Bathhouse tub water `#bfe3e0` and bubbles `#dff3f1` added to `NIGHT_MOONLIT`. NIGHT now has 42 entries (39 moonlit, 3 kept). Docs updated (BASE_DESIGN 7, ART_BIBLE (w) line).
- smoke `nightDiff`: the floor set now includes STRAW_SEAM and PATH_EDGE. The measured floor pixels at the opening frame are now 23 809 (was 22 193), all unchanged; 69.2 % frame change is unchanged. BASE_DESIGN 7 updated.

Deferred:
- Walls step with dimness (18:20-19:00, 05:00-06:00), while the hearth ring, skylight and sky follow nightness (20:00-21:00). So walls reach full night about an hour before the sky/hearth. This was the implementer's documented design choice (walls turn with the lamps and slits). Changing it means changing sky.ts lightsOf, sim-check 11, the two smoke step cases and BASE_DESIGN 7. Left for a later polish pass.

Rejected: none.
