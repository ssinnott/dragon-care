# HANDOFF S9 (drop this file on merge)

S9 ("Missions II: the watchable scene, challenges on the road, big baddies") is built on `claude/outstanding-issues-s9` from the contract commit `af25650`:
- `3374eea`: the implementation
- `833b235`: the review fixes

`npm run check` is green on `833b235`. That covers the typecheck, the palette gates, sim-check (with the new §24) and 96 smoke views.

## Merge wiring

These are every stand-in or seam the merge must connect.

1. **TEAM OUT chip.** Tapping S8's chip must call `BaseView.openWatch()` (src/game/base.ts). Then keep only one chip: S9 draws its own stand-in chip, `drawTeamChip`, at S8's rect `TEAM_CHIP {520,19,114,15}` whenever `currentTrip(sim)` is non-null. Drop one of the two chips.
2. **The `ui.screen` union.** Add `'watch'` to S8's `ui.screen` union, in base.ts and in `types/globals.d.ts`. S9's hook publishes `ui { screen: 'none'|'watch'; chip; back }` and `scene {...}`, so merge the two hook shapes.
3. **`currentTrip`.** S8 replaces the body of `currentTrip` in `seams.ts`. S9 only reads it, and falls back to the preview trip set by `setPreviewTrip`, which the `trip=` preset uses.
4. **`tripdemo.ts`.** Replace its tables (`REGION_DATA`, `CHALLENGE_DATA`, `BADDIE_DATA`, `KEEPER_SKILL`, `climateOf`) with S8's `REGIONS`, `CHALLENGES`, `BADDIES` and `KEEPER_SKILL`. `missionview.ts` imports only `climateOf` from it. `demoTrip` and `parseTripParam` stay as the preset's builder, and can use S8's auto-pick if you prefer.
5. **Stop log format.** S8's stop logs must keep the form `NAME - WHO WHAT`, because the banner shows the part before ` - `.
6. **artseams.ts (the new S9 exports).**
   - `BADDIE_FILLS` should become S9a's `BADDIE_ART[id].palette` values.
   - `climateBands(climate, phase)` should return S9a's `BACKDROPS.climate[climate][phase]` bands. Once it does, the region-band half of palette gate (x) starts running.
   - The stand-in bodies of `drawClimate`, `drawSetPiece`, `drawBaddie`, `drawBaddiePortrait` and `drawMiller` are swapped for S9a's real art with the same signatures. The miller is drawn at the `miller` stop, `grumpy` until the CHARM rider's moment, then `talkedRound`.
   - `drawClimate` currently ignores `scroll`, so there is no parallax until S9a's art lands.
7. **`FLOORS.road`.** S9 added `FLOORS.road '#dcd6c4'` and `ROAD_SCENE` in surfaces.ts. S9a defines the same road value, so keep one.
8. **Guards.** S9's type guards `_NoHurt`, `_Exits` and `_Faces` live in missionview.ts and cover the scene's own types. S9a's `_NoHurt` over `Baddie` should sit beside them.
9. **Away place.** On this base the team of a preview trip is still drawn in the barn. Once S8's `place: 'away'` exists, the team should leave the barn while a trip is out. Riders carry no saddle in the scene; they should get S9a's `SADDLE`.
10. **Live check.** A real hard Old Mine Road mission that ends with the Mole King dozing still has to be checked live, through S8's send flow. For now it is covered by `preset=trip&trip=oldmine:0.921` (frozen) and by `preset=trip` live.
11. **Docs.** The "Final integration" docs list was skipped, as the contract says. So was re-rendering `docs/base/base_live.png`.

## Workflow handoff log (as appended to notes/handoff.md)

## S9 — Missions II: the watchable scene, challenges on the road, big baddies

**Built** (base af25650, the parallel contract commit; built beside S8, so S8, S7, S6b, S6c and S9a are NOT on this
base). `npm run check` green on the committed tree: typecheck; palette RESULT 2492/2492 (+118: the road floor's (i)),
KEEPERS 172/172 (+8: (Ki) on the road), BACKDROPS 1157/1157 (+52: the road scene's ground), EGGS 8/8, NEW BADDIES
15/15 (gate x); sim sections 1-16 + NEW 24 (about 26 s wall, was 24.6); smoke 96 views (90 + 6 new) + 1 pair + 2 TINT
pairs (unchanged). No simulation state was added: `SAVE_VERSION` stays 6, the barn is byte-identical (every earlier
sim-check number unchanged).

- New `src/game/missionview.ts`: the scene as a pure function (`sceneAt`), `ScenePets` (the team's pets and riders
  played to it), drawing (`drawMissionScene`, `drawBackButton`, `drawResultCard`, `drawTeamChip`), the type guards.
- New `src/game/tripdemo.ts`: a copy of plan S8's regions / challenges / baddies / KEEPER_SKILL tables and
  `demoTrip` (a Trip literal on a region's mission with the best two pairs and S8-style auto riders).
- Changed: `presets.ts` (`tripStart`, `TRIP_DEFAULT`, `PRESETS.trip`), `base.ts` (the watch overlay, the TEAM OUT
  chip, taps, hook), `gallery.ts` (`panel=`, `trip=`, passes `at: P.t ?? 0`), `surfaces.ts` (`FLOORS.road '#dcd6c4'`,
  `ROAD_SCENE`), `artseams.ts` (two NEW seam exports, stand-in bodies untouched), `types/globals.d.ts`,
  `tools/palette-check.ts` (road ground in (w), NEW gate (x)), `tools/sim-check.ts` (§24), `tools/smoke.ts`,
  `tools/shots.ts`; docs BASE_DESIGN (B5, §6 rewritten as built, §8 paragraph/file rows/sim row/not-in-slice),
  ART_BIBLE (status counts, 5.8 re-pasted, NEW 5.10 "The watchable scene"), KEEPERS (counts, (Ki) road).

**Exported names and signatures** (DIFFERS / NEW against plan S9's type block)

- `missionview.ts`
  - constants: `SCENE_RECT {0,16,640,344}`, `ROAD_Y 300`, `ROAD_TOP 292`, `ROAD_BOTTOM 306`, `BACK_Y 296` (set
    pieces, miller, baddie: 4 px deeper, drawn behind the team), `PAIR_BACK 170`, `RIDER_AHEAD 56`, `PIECE_AHEAD 150`,
    `BADDIE_AHEAD 200`, `CAM_BACK 260`, `BACK_BUTTON {8,338,110,16}`, `RESULT_CARD {170,110,300,120}`, `TEAM_CHIP
    {520,19,114,15}`, `MOMENT_MAX 240`; `beatLen(L)`, `baddieBeatLen(L)`, `baddieParts(L) {enter, moments, exit}`.
  - walk maths: `walkDist(g, tau)` (D_i: prefix sums, fractional, looped), `frameAt(g, tau)`, `loopPhase(g, tau)`.
  - `interface SceneFrame { E; L; n; stop; beatT; last; facing; xs; speeds; camX; banner; bannerOk; baddie: BaddieAt |
    null; pieces: Piece[]; acts: {dragon: Act; rider: Act | null}[]; done }` -- DIFFERS: plan's fields plus `L, last
    (the last stop reached), speeds, camX, bannerOk, pieces, acts`; `baddie` is `BaddieAt {id, x, face, pose, facing,
    fx: 'z'|'dust'|null, t}`.
  - `sceneAt(sim, trip, clock = sim.clock): SceneFrame` (DIFFERS: optional clock, for sim-check), `tripLen(sim, trip)`.
  - `class ScenePets { constructor(sim, trip); readonly trip; sync(f, clock); draw(ctx) }`;
    `drawMissionScene(ctx, sim, trip, cast: ScenePets, f = sceneAt(...))`.
  - `DRAGON_MOMENT` (element -> anim), `RIDER_MOMENT` (look -> anim), `rewardsOf(trip)`, `teamChipText(sim, trip)`.
  - type guards `_NoHurt`, `_Exits`, `_Faces` (over the scene's own types; the plan's `Baddie`/`BADDIE_ART` is S9a's).
- `tripdemo.ts`: `CHALLENGE_DATA`, `BADDIE_DATA`, `REGION_DATA`, `REGION_IDS`, `climateOf(region)`, `KEEPER_SKILL`,
  `demoMission(sim, region, diff)`, `demoStops`, `demoOdds`, `demoTrip(sim, region, diff, success): Trip` (state
  'away', departAt/returnAt null: the caller sets them), `parseTripParam(s)`, `interface TripParam`.
- `presets.ts`: `TRIP_DEFAULT` (oldmine:0.5), `tripStart(param, at = 0): StartSpec` (the new game + a hard mission's
  preview trip via `setPreviewTrip`, `departAt = clock + at - round(p L)`), `PRESETS.trip`.
- `base.ts`: `BaseViewOpts` += `panel?, trip?, at?`; private `screen: 'none'|'watch'`, `watching: ScenePets|null`,
  `resultClosed`, `scene` (all reset in `use()`); `openWatch()`, `drawWatch()`, `publish()` (the hook moved into it),
  `sceneHook()`. A tap under the bar while watching: BACK closes, the result card is tapped away, anything else is
  swallowed; in the barn, the TEAM OUT chip opens the scene.
- `surfaces.ts`: `FLOORS.road`, NEW `ROAD_SCENE { edge, slab, grass, earth }`.
- `artseams.ts` (NEW seam exports): `BADDIE_FILLS: Record<BaddieId, string[]>` (stand-in: the box fill `#8a7060`),
  `climateBands(climate, phase): string[] | null` (stand-in: null).
- Hook: `ui { screen: 'none'|'watch'; chip: Rect|null; back: Rect|null }`, `scene { stop ('baddie' | challenge id |
  null: the LAST stop reached), covered, beat, banner, baddie, face, pose, exit, facing, progress, done, result } | null`.

**Measured**

```
24 scene: millbrook easy home safe; millbrook easy home early (turned at stop 1, E 6720); bramblewood normal home safe; bramblewood normal home early (turned at stop 2, E 14370); oldmine hard home safe, moleking calmed; oldmine hard home early (turned at stop 0, E 7485), moleking keeps the road; highfold hard home safe, stormroc outwitted; frostmere hard home safe, frostgiant drivenOff; 194456 steps read, 179669 travel steps without a skate, the baddie in view 7480 of them; the scene's types have no hurt state, and exits only calmed, outwitted or driven off
RESULT: PASS 2492 of 2492 / KEEPERS: PASS 172 of 172 / BACKDROPS: PASS 1157 of 1157 / EGGS: PASS 8 of 8 / BADDIES: PASS 15 of 15
smoke: trip=oldmine:0.95 (3288 colours), oldmine:0.91 (3066), millbrook:0.3 (3299), bramblewood:0.7:fail (3138), oldmine:1 (2741), live chip -> watch -> BACK
```

Mutation-checked: moving the team at a constant V (skating) fails §24 at E 1 ("pair 0 skated"); a baddie fill of
`#c8b8a0` fails gate (x) against the road slab and grass.

**Deviations and why**

1. **Built against seams, not S8/S9a** (the parallel contract): the trip comes from `currentTrip(sim)`; the preset's
   region data is a local copy (`tripdemo.ts`); all mission art is `artseams.ts`'s greybox stand-ins. S9a's
   `baddies.ts`/`BADDIE_ART` (and its `_NoHurt` over `Baddie`) is not created here; the guards are on the scene's types.
2. **Progress values for the baddie shots.** The plan's `trip=oldmine:0.95` cannot land in the baddie beat: the baddie
   sits at 0.9 (trip.ts) and its beat is `min(900, 0.12 L)` = 900 steps of a 32 400-step trip, i.e. 0.900-0.928. So
   the hook's `scene.stop` is **the last stop reached** (not only a beat in progress; `scene.beat` says which) and the
   banner stays up until the next stop -- with that, all three plan smoke cases hold as written (0.95: stop 'baddie',
   the Mole King dozing in view; millbrook:0.3: the first stop, met, banner up; bramblewood:0.7:fail: facing -1). The
   baddie SHOTS use 0.906 (walked in, grumpy) and extra exit shots 0.921; a smoke case at 0.91 checks the beat
   (surprised). Likewise the plan's `base_watch` at millbrook:0.3 is between stops (the banner of stop 0 shows).
3. **The preset's team meets the baddie** when any team can (best odds among those), so the beat shows both counters:
   plain best-odds picks COBBLE+ECHO for Old Mine Road, which leaves the Mole King unmet.
4. **Baddie exits after the beat** carry on: the calmed one stays dozing where it sat (the team walks past it), the
   outwitted one wanders left behind the team at 0.6 px/step, the driven-off one shuffles right at 0.45; it leaves the
   frame when more than 520 px from the screen's middle.
5. **The TEAM OUT chip is S9's own stand-in** (S8 owns the real one at the same rect): shown whenever a trip is current.
6. **Gate (x)** gates the stand-in's one fill against the road and ROAD_SCENE; the region-band half runs only when
   `climateBands` returns bands (null on the stand-in, whose night box would fail at 17 %).
7. Moments are one per counter: 15 % into a challenge's beat; for the baddie the dragon's at the moments phase's
   start, the rider's half way; a moment gives way to idle when its anim ends or after 240 steps. The set piece shows
   met/unmet half way through its beat; the miller is talked round then.
8. Result card: a tap closes the card only (the overlay stays); BACK closes the overlay.
9. Final-integration docs list skipped (contract); `docs/base/base_live.png` not re-rendered (the barn is unchanged).

**Gaps and stand-ins (for the merge)**

- **Merge must wire:** S8's chip tap -> `openWatch()` (drop S9's chip or S8's); S8's `ui.screen` union + 'watch' in
  globals.d.ts; `tripdemo.ts` tables -> S8's `REGIONS/CHALLENGES/BADDIES/KEEPER_SKILL` (missionview imports only
  `climateOf`); `artseams.ts BADDIE_FILLS` -> S9a's `BADDIE_ART[id].palette` values and `climateBands` -> S9a's
  `BACKDROPS.climate[climate][phase]` bands (gate x's second half then runs); S9a's `FLOORS.road` is the same value.
  S8's stops' `log` must keep the form `NAME - WHO WHAT` (the banner takes the head before ` - `).
- A preview trip's team is still in the barn (no `place: 'away'` on this base). Riders carry no saddle in the scene.
- The drawClimate stand-in ignores `scroll`, so parallax shows only once S9a lands.
- The result card's bottom edge covers the riders' heads once home (the plan's fixed rect); dragons' eyes stay clear.
- The z marks are 3x3 per the plan (tiny at 1x).

**See it**

`node tools/shot.ts out.png="view=base&preset=trip&trip=oldmine:0.906&panel=watch&t=60" --scale 2` (also
`highfold`/`frostmere` at 0.906; `:0.912` the moments; `:0.921` the exits; `millbrook:0.3`; `bramblewood:0.7:fail`;
`oldmine:1` the result card; `view=base&preset=trip&trip=oldmine:0.2&t=60` the chip). Live:
`index.html?preset=trip&trip=oldmine:0.2&save=0`, tap TEAM OUT. Shots looked at: `scratchpad/shots/s9/`.

### S9 review

Fixed:
- **Walk desync after reopen / big render gaps (major, G13).** `ScenePets.play` (missionview.ts) now treats a clock jump
  bigger than the new export `SYNC_GAP` (16) -- or any rewind -- as a fresh act for a walk: it restarts at the road's
  phase (`act.phase`), so the played frame is `frameAt(g, s*n)` again. Non-walk acts on a big jump step on by up to 120
  steps (a rewind replays them fresh). Probes (reopen after 1000 steps, jumps 1/8/16/40): 0 frames off (were 1000/1000
  and 103/150).
- **Sim-check 24 now checks the view (minor).** New `ScenePets.dragonFrames()` (the walk frame each dragon is playing).
  §24 syncs a ScenePets for bramblewood normal (failure: covers the turn back) with steps of 1 x8 then a 1000 gap, 8,
  and 40, and highfold hard (success) with 40, over two stretches (E < 4000, and T-500..T+3500 around the turn back /
  first stop end) and asserts the frame on every travel step: "the view's walks on the road's frame at 2748 synced
  travel steps". It catches the old code (reverted gap rule -> fails at E 1008). sim wall: about 27.5 s (was 26.2 s).
- **Rider jump at the turn back (minor).** Riders are now at `x + RIDER_AHEAD` whatever the facing (ahead on the way out,
  behind on the way home): no 112 px jump. Shots s9fix/tb1.png, tb2.png.
- **Drag over the watch overlay panned the hidden barn (minor).** base.ts onDown/onMove ignore camera changes while
  `screen === 'watch'`. Live probe: camX 204 -> 204 after a drag.
- **"z" marks (minor, G6).** ZED is now 5 x 6 with 2 px strokes (drawSprite already rings every sprite in ink -- the
  "no outline" half of the finding was not true), spaced 9 px across / 11 px up. Shot s9fix/mk.png.
- Docs: ART_BIBLE 5.10 (the view's resync, rider side, z size), BASE_DESIGN (sim-check line, about 27.5 s).

Deferred:
- The dragons still flip facing at the turn back with no paper turn (the scene has no turn beat; adding one changes
  sceneAt's timing, which §24 pins). A view-only narrowing could come with the S9a art pass.
