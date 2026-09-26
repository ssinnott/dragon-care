# HANDOFF — S8 (drop this file on merge)

Branch `claude/outstanding-issues-s8`, built from the mission contract `af25650`. Commits: `1cdec16` (slice) and `032607a` (review fixes). `npm run check` is green on `032607a`.

## Merge wiring

These are the stand-ins and seams that the merge has to connect:

1. **S7 (`control.ts`)**: route `{ kind: 'send'; mission: number; pairs: Pair[] }` into `missions.send(...)`, which returns a `Trip`, or a reason string when it refuses. `take` must refuse any keeper for whom `onTrip(k)` is true. Auto riders already skip keepers through `CareSim.free(k)` and the `seams.ts isTaken` seam, so S7's controlled keeper must also be excluded there. The `seams.ts isTaken` stand-in must then be replaced by the real one.
2. **S6b (barn cap)**: `seams.ts barnRoom` is read only by the chooser's `BARN FULL: THE EGG WILL WAIT` line. Making a hatch wait at `BARN_CAP` is S6b's work. A team that is away does not free barn places in any count.
3. **S9a (mission art)**: the climate picture, the challenge and skill icons, the baddie portrait and the carried saddle are all drawn through `artseams.ts` greybox stand-ins. Swap in S9a's kit, re-render `base_mission`, and run gate (w) on the climate bands.
4. **S9 (mission scene)**: `seams.ts currentTrip(sim)` now returns the real trip (`sim.missions.trip ?? preview ?? null`), and that is the only seam body S8 changed. The progress card (`drawTripCard` in `maptable.ts`, opened from the TEAM OUT chip) is a stand-in for S9's watch overlay; replace it. S9's `trip=` preset can build its mission from `regions.ts`.
5. **SAVE_VERSION**: bumped to **7**, with `SaveV.missions` added. Renumber at the merge if another slice also bumps it.
6. **TopBar**: `TopBar.coin?` and `TopBar.map?` are added and `busy` is kept. S7 adds its ▼ beside them.
7. **Docs**: `docs/base/base_live.png` still shows the old top bar, without COIN or MAP. Re-render it at the final integration.

## Handoff log (as appended to notes/handoff.md)

## S8 — Missions I: the Map Room table, the world map, climate, the team, the Aerie trip, rewards

**Built** (base af25650, the parallel contract commit; commit 1cdec16; `npm run check` green on the committed tree: typecheck,
palette 2374/2374 + keepers 164/164 + backdrops 1105/1105 + eggs 8/8 (all unchanged), sim sections 1-23 in about
23 s wall, smoke **94 views** (90 + 4) + 1 moved pair + 2 TINT pairs (world bb6e59e9 and barn b4c21913, both
unchanged), about 7 min). Advances #5 (5.1, 5.2, 5.3 up front, 5.4, 5.6; 5.5's baddie missions on the board, B8
amended) and closes #11's proof (PLANNED is empty: tack, bunks, maproom and aerie all used).

- New: `src/game/regions.ts` (data), `src/game/missions.ts` (DOM-free model), `src/game/maptable.ts` (the overlays).
- Changed: `sim.ts`, `travel.ts`, `life.ts`, `layout.ts`, `save.ts` (v7), `presets.ts` (`muster`), `people.ts`, `hud.ts`,
  `base.ts`, `building.ts` (sky bridge), `seams.ts` (`currentTrip`'s body only), `src/gallery.ts` (`panel=`,
  `mission=`), `types/globals.d.ts`, `tools/sim-check.ts` (6, 8, 12's comment, NEW 17-23), `tools/smoke.ts` (4 cases),
  `tools/shots.ts` (3 shots); docs BASE_DESIGN (B4, B7, B8 amended, 3 intro + table rows, 4.8 top bar / table / chip /
  toasts / keys, 5.1-5.6 rewritten as built, 8 built paragraph + file table + sim-check row + numbers + not-in-slice +
  build-order item 3), KEEPERS (2: the rider-skill column, partners, Rosa/Tam superseded; status: riders' anims),
  ART_BIBLE (status: fly/hopGlide/boulder hop still follow-ups, the sky-bridge walk stands in).
- NOT built here (per the contract): `backdrops.ts`/`drawClimate`, icons, portraits, the saddle (all through
  `artseams.ts` stand-ins: S9a), `control.ts` (S7), `BARN_CAP` (S6b: read through `seams.ts barnRoom`).

**Exported names and signatures** (NEW / DIFFERS against plan S8)

- `regions.ts`: re-exports the missiondata unions; `interface Counter { element?; skill? }`; `CHALLENGES:
  Record<ChallengeId, { name; word; counter; met }>` (NEW `word`: a short button word, e.g. `DARK`); `CHALLENGE_IDS`;
  `BADDIES: Record<BaddieId, { name; counters: [Counter, Counter]; exit; how }>` (NEW `how`: the log's words, e.g. `CURLS
  UP AND DOZES`); `KEEPER_SKILL` (bea charm, tomas medic, iris navigator, pip nimble); NEW `SKILL_NAME`; `interface
  Region` exactly as plan (map `{ poly, pin }` in screen px of the map panel); `REGIONS` (index order millbrook, oldmine,
  bramblewood, highfold, frostmere, emberfell: the board's difficulty draw keys on it), `REGION_IDS`, NEW
  `regionOf(id)`, `MAP_HOME [52, 300]`, `MAP_FILL` (per climate). **S9: build the `trip=` preset's mission from
  `REGIONS`/`CHALLENGES`/`BADDIES` here, or better call `missions.ts roadOf(sim, mission, pairs, success)` for the
  stops (it places them as trip.ts documents and writes the log lines).**
- `missions.ts`:
  - `interface MissionsState { day; board: Mission[]; explored; pendingReveal; firstSuccess: RegionId[]; coin; trip:
    Trip | null; deck: (number | null)[] /* per pair: DECK_SPOTS index, claimed on reaching f5 */; sent }` = `sim.missions`.
  - constants: `BOARD_MAX 3`, `DIFFICULTY` (easy/normal/hard: p, challenges, days, coin, egg), `BADDIE_FROM_DAY 3`,
    `LOST_NEST 'THE LOST NEST'`, `MAX_PAIRS 2`, `HOME_KEEPERS 2`, `ODDS`, `DECK_SPOTS [120, 280]`, `RIDER_SPOTS
    [211, 371]` (DIFFERS: plan 184/344, see deviations), `BRIDGE_X -200` (= layout `BRIDGE_X0`), `DEPART_X -120`,
    `LAND_LEAD_X -60`, `SADDLE_STEPS 40`, `REST_STEPS 900`, `LAND_NEEDS {success 0.45, failure 0.3}`, `ROAD_SPAN 0.85`,
    `BADDIE_AT 0.9`, `TRIP_PHASES` (muster, depart, away, deliver: not free for jobs; `rest` is free).
  - board: `newMissions()`, `boardFor(seed, day, explored, firstSuccess): Mission[]` (pure; mission id = day*4 +
    board place), `rollBoard(sim, day)` (reveals pending first), NEW `firstBoard(sim)`.
  - who: `type Taken = (sim, keeperId) => boolean`; `onTrip(k)`, `partnerOf(sim, d)`, `dragonReason(sim, d, m | null):
    'IN THE GARDEN' | 'AWAY' | 'BABY' | 'TOO YOUNG' | null`, `freeRider(sim, k, taken = isTaken)`, `coverage(sim, m,
    pairs): { challenges: string[][] (who meets each); baddie: string[] | null; covered }`, `oddsOf(sim, m, pairs)`
    (0 for an empty team), `autoRider(sim, d, m, others, taken = isTaken): number | null`, `bestTeam(sim, m, taken =
    isTaken): Pair[]`, `freeNest(sim)`, `canSend(sim, m | null, pairs, taken = isTaken): string | null` (reasons `A TEAM IS
    ALREADY OUT`, `PICK A MISSION`, `PICK A DRAGON`, `NOT ENOUGH KEEPERS HOME`, `TOO YOUNG FOR THIS ONE`, `<NAME> IS A
    BABY | AWAY | IN THE GARDEN`).
  - sending: `roadOf(sim, m, pairs, success): { stops: Stop[]; turnBack }` (NEW export), `send(sim, missionId, pairs,
    opts?: { taken?; awaySteps? }): Trip | string` (a reason string when refused). **This is the command S7's
    `control.ts` must route `{ kind: 'send'; mission; pairs }` into.**
  - the trip: `stepMissions(sim)` (last in `CareSim.step`: dawn roll, the trip machine, rests), `missionCall(sim, d)`
    (travel.ts callPrio's prio 2), `hoursLeft(sim, t)`; saves: `copyMissions(m)`, `checkMissions(raw, dragons, keepers)`.
- `trip.ts` extended **only by an optional field on the Trip object at runtime**: `awaySteps?: number` (a test's own
  length; set by `send(..., { awaySteps })`; typed locally as `Trip & { awaySteps?: number }`). Mission/Pair/Stop
  unchanged. `trip.state` goes muster -> depart -> away -> return -> home (then `sim.missions.trip = null`).
- `seams.ts currentTrip(sim)` now returns `sim.missions.trip ?? preview ?? null` (the only stand-in body changed).
- `sim.ts`: `DragonGoal += 'muster'` (with a team: up to the deck, off over the bridge, and back onto the deck);
  `Place += 'away'`; `Phase += 'muster' | 'depart' | 'away' | 'deliver' | 'rest'`; NEW `type Carried = NeedKind |
  'saddle' | 'egg'` (`Keeper.carrying: Carried | null`); `CareSim.missions: MissionsState`; NEW public `free(k)` (no
  job and not TRIP_PHASES: `assign` and `sendRushed` use it), `unjob(k)` (a rider lets a job go: release without
  pre-emption), `move(k)` and `walkTo(k, to)` now public; `addEgg(el, laidAt = clock, into?: number)` (DIFFERS: the
  reserved nest). `step()`: away dragons don't drain; no job opens for `muster`/`away`; `stepMissions` last;
  `stepKeeper` returns early for trip phases and `rest` (missions.ts steps them).
- `travel.ts`: NEW `faceWay(d, facing)`; `free`/`redirectable` exclude goal `muster`; `callPrio` 2 for
  `missionCall`; `settle()` clears a non-baby's `settle` goal on arrival (a dragon back from a mission). `life.ts
  settled` excludes `muster`.
- `layout.ts`: NEW `BRIDGE_X0 = -200`; f5 spans are `[-200, 638]` (keepers) and `[-200, 648 - P]` (dragons).
- `save.ts`: `SAVE_VERSION = 7`; `SaveV.missions`. `fromSave` validates the missions and that every `away`/`muster`
  dragon and every trip-phase keeper belongs to the trip.
- `presets.ts`: NEW `MUSTER_TEAM ['RIPPLE', 'ECHO']`, `sendLostNest(sim, opts?)`, preset `muster`.
- `maptable.ts`: `type Screen`, `interface MapUi { screen; mission; pairs; opening; card }`, `newUi()`, `type UiAct`,
  `interface Hit`, rect consts `PANEL BACK CLIMATE_RECT BEST SEND ODDS_BAR CHIP TRIP_CARD`, `drawMapScreen(ctx, sim)`,
  `drawMissionScreen(ctx, sim, ui)`, `chosen(sim, ui)`, `editTeam(sim, ui, act)`, `chipText`, `drawTeamChip`,
  `tripProgress(sim, t)`, `stopStates(sim, t)`, `drawTripCard(ctx, sim, t)` (**S9 replaces this card with the watch
  overlay: the chip's tap is in `base.ts tap`, `this.ui.card`**), `hitAt`.
- `hud.ts`: `ButtonName += 'map'`, `BUTTONS.map {610,1,26,13}`, NEW `COIN_X 334`; `TopBar.keepers[i].trip?: 'away' |
  'rest' | null` (the ↗ and z sprites), `TopBar.coin?`, `TopBar.map?` (DIFFERS: `busy` kept; S7 adds its ▼ beside it).
- `people.ts`: `drawKeeperVisual(ctx, agent, k, egg: DragonElement | null = null)`; mission phases' anims.
- `base.ts`: `BaseViewOpts.panel?: 'map' | 'mission' | null`, `mission?: number | null`; private `ui`, `uiHits`,
  `chipRect`, `pendingPanel`, `tripWas`, `toggleMap`, `closeTable`, `openPanel`, `tableTap`, `tripHook`; `MAP_CAM` and
  `AERIE_CAM` (0, 20); the table prop `TABLE` world rect (70, 172, 60, 36). The world waits while an overlay is open.
- `gallery.ts`: `GalleryParams.panel`, `mission` (0-2); a `panel=` page never persists.
- Hook: `coin`, `board[]`, `trip` (`{state, mission (title), region, success, egg, pairs, departAt, returnAt, progress}`
  or null), `ui {screen, mission, pairs, pins: Rect[], buttons: Record<'back'|'best'|'send'|'chip', Rect>}`; a dragon's
  `place` may be `away`.

**Measured** (`npm run sim`; sections 1-5, 7, 9-16 unchanged in their numbers but 6's size and 8's totals)

```
  6 saves: 7022 bytes at step 5000 (was 6328: the missions' board is in the save) ...
  6 saves (missions, a 600-step day): step 256 (muster), step 2860 (depart), step 4100 (away), step 4700 (egg), step 5770 (tack), step 6148 (rest) step on 5000 to the same world; 5 saves whose missions can't be run (a mission in Atlantis, a team of a dragon there isn't, a keeper away with no team, a dragon mustering with no team, no missions) throw
  17 board: 100 boards (seeds 1-5, days 1-10, the start's map and the whole) the same rolled twice, day 1's always THE LOST NEST first; 127 easy, 49 hard, 124 normal, 15 ending in a baddie (none before day 3); a world's board rolled at clocks 725 and 1325 and 1925 (each 05:00)
  18 odds: 8 hand-computed teams, 65 %, 40 %, 35 %, 25 %, 20 %, 95 %, 45 %, 75 % (the plan's two examples 65 % and 40 %; 95 % the top clamp; 20 % the least a pair can have, above the bottom clamp's 5 %)
  19 team: babies, the young on normal and hard roads and garden residents may not go; with BEA taken by hand, 420 auto riders (10 days of boards x 7 dragons, alone and beside a pair) and BEST TEAM never chose her; a third pair refused (two keepers stay home: 2 home with the team out); a second send refused while one is out
  20 trip: the muster preset (the real day, seed 1) all on the deck at step 2860; THE LOST NEST (seed 2, a 600-step day) with RIPPLE and BEA, ECHO and TOMAS: odds 55 %, a success, a spike egg for nest 0; mustered in 2860 steps (both up by the lift), away at 4100, landed at 4700 (returnAt, exactly: RIPPLE food 0.37 sleep 0.45, ECHO food 0.35 sleep 0.45), the egg laid at 6664, over at 7993; the Map Room used 1, the Tack Room 4, the Aerie 2, the Bunks 2; coin 40; FROSTMERE revealed at the next dawn; BURR hatched
  21 failure: seed 1 (of 1 tried) fails RIPPLE alone on THE LOST NEST at 35 %: it turns back at stop 1 ("LOST THINGS - NOBODY COULD HELP: THEY TURN BACK FOR HOME"), home with 20 coin (half) and no egg, nothing revealed
  22 outcome: 20 seeds' LOST NEST, each the same twice: 12 successes, 12 eggs (the first success in a region: always one)
  23 away: THE LOST NEST's two pairs away 30 min of the real day (112100 steps from the send to the landing), five dragons and two keepers home: 104 jobs done, wait avg 50.1 s (gate 125), max 158.5 s, keepers at the stand spot 4.8 s, a landing 48.0 s; 0 steps with a need at 0; no rider given a job
  8 rooms used over the suite: kitchen 497, bath 496, hatchery 48, romp 572, groom 269, dorm 268, tack 24, bunks 13, maproom 6, gate 68, lift 1150, aerie 13, garden 45; planned: none
```

Smoke: `view=base&t=60&panel=map` (1735 colours), `panel=mission&mission=0` (273), `preset=muster&t=2860&cam=0,20`
(4075), live `baseMission` ("MAP, pin 1 (THE LOST NEST), BEST TEAM (2 pairs), SEND: mustering, camera at y 20"; it
also checks the world stands still under the map and the TEAM OUT chip appears). sim-check wall about 23 s (was about
21 s): section 23 (the 30-minute run away) runs in section 10's worker. A live 8x run (scratchpad `s8/live_s8.ts`,
seed 2): MAP -> pin -> BEST TEAM -> SEND -> away -> the chip's card -> landing -> a spike egg in nest 0, 40 coin.

**Deviations and why**

1. **Riders stand at x 211 and 371** (`RIDER_SPOTS`), not 184 and 344: at 184 a rider stood inside its dragon's body
   (an adult facing west at 120 reaches back to 191) and was drawn behind it; 211 is between the first dragon's tail
   and the second's snout, 371 just behind the second's tail, so each rider stands beside its dragon, whole.
2. **Deck spots are claimed on arrival**: each dragon takes the westmost free spot when it reaches the deck (plan: by
   pair index), so the first up never has the second walk through it; the rider follows its dragon's spot.
3. **The camera goes to (0, 20)**, not (0, 40), for the Map Room and the Aerie: at 40 a rider's hat on the deck is under
   the top bar. The smoke's `camY <= 200` holds.
4. **Place `barn` from the landing**, not from reaching the deck spot: the team walking back along the bridge and deck
   must be drawn (only `away` is hidden). Until it reaches its spot the dragon keeps goal `muster` (no jobs, not
   free), so the plan's behaviour is unchanged.
5. **A mustering dragon being met finishes first** (its keeper is sent home, the act runs out; a sleeper sleeps its
   nap out) and one in the lift's hands finishes its ride; then it is routed up. The riders' own jobs are let go at
   once (`unjob`: a job under way stops where it got to, a tuck-in excepted; not counted as pre-empted).
6. **The example's rider**: plan S8 says RIPPLE gets IRIS beside ECHO; by the plan's own rules (no partner for water,
   nothing left uncovered, then the lowest id) RIPPLE gets BEA. The odds are the same (65 % with both happy);
   section 18 computes them with IRIS as the plan wrote it, section 20 runs the auto riders (BEA and TOMAS).
7. **The bottom clamp (5 %) can't be reached** by a real team: a pair alone has at least the 20 % base. Section 18
   shows the 20 % floor instead and that an empty team has 0.
8. **No new `backdrops.ts`, icons, portraits or saddle; no gate (w) for climates**: the contract makes these S9a's
   (`artseams.ts` stand-ins drawn now). The map's own colours (parchment, lands, fog) are not a backdrop any dragon is
   seen against, so they are not gated.
9. **A landing toast** (`THE LOST NEST: HOME SAFE WITH 40 COIN AND AN EGG` / `HOME EARLY WITH 20 COIN. NOBODY IS
   HURT.`) and a send toast (`...: THE TEAM MUSTERS ON THE AERIE`), a refusal toast (canSend's reason), and the
   chooser's `N OF 2 PAIRS - 2 KEEPERS STAY HOME` line: small feedback not in the plan's list (S9's result card will
   carry the landing).
10. **The chip reads `TEAM OUT - 24H`** while departing (the whole trip's hours) and the hours left while away.
11. A `panel=` page never persists (gallery), so a live debug page can't load the player's barn over its overlay.
12. sim-check 17 also checks the board in a world (rolled at 05:00 only); 19 checks 420 auto riders (every day-1..10
    board mission x 7 dragons, alone and beside a pair); 20 also checks the away needs frozen, the lift rides up, the
    egg hatching; 6's missions forks add `depart`, `egg`, `tack` and `rest` beside mid-muster and mid-away.

**Gaps and stand-ins**

- The mission art is the contract's greybox (`artseams.ts`): the climate picture is a labelled box, the icons are
  coloured squares, the portrait a box, the carried saddle a box. S9a's kit replaces them at the merge.
- The progress card is S8's stand-in for S9's watch overlay.
- A new game's LOST NEST is a coin toss: seed 1 (the default page's) fails it with the best team (55-60 %, the start's
  moods are low); seed 2 succeeds. The first success in a region always brings an egg.
- `docs/base/base_live.png` still shows the old top bar (no COIN, no MAP): S9's final integration re-renders it.
- The Tack Room's saddle rack is still S2's greybox prop; the Bunks' bed too.
- Walking overlaps as elsewhere: a rider walking west over the bridge passes behind the dragons (keepers sort behind).

**For the merge / later slices**

- S7: route `{ kind: 'send'; mission: number; pairs: Pair[] }` to `missions.send`; `take` must refuse `onTrip(k)`;
  `isTaken` feeds `autoRider`/`bestTeam`/`canSend`'s `taken`; the badge's ▼ goes beside S8's `trip` glyph; `assign`
  already skips trip keepers via `CareSim.free(k)` -- S7's controlled keeper must be excluded there too. A rider in
  `rest` is free (a job ends the rest); `inTheWayOfGrowing` counts every keeper on the floor, riders included.
- S6b: `seams.ts barnRoom` is read only by the chooser's `BARN FULL: THE EGG WILL WAIT` line; a team away does not
  free barn places for the count (nothing in S8 counts them). Hatching at the cap is S6b's.
- S9: `currentTrip(sim)` returns the real trip; `trip.departAt/returnAt` are set at departure (clock), `awaySteps`
  may override the length; the team's dragons are `place === 'away'` at `(5, -200)` and its keepers `phase === 'away'`
  there while away; `maptable.drawTripCard` and `base.ts`'s `ui.card` are the card to replace.

**See it**

- `node tools/shot.ts out.png="view=base&panel=map&t=60" --scale 2` (`base_map`), `"view=base&panel=mission&mission=0&t=60"`
  (`base_mission`), `"view=base&preset=muster&t=2860&cam=0,20"` (`base_muster`), `"view=base&preset=muster&t=3200&cam=0,20"`
  (walking off over the bridge), `"view=base&seed=11&t=22000&panel=mission&mission=2"` (a hard road with THE MOLE KING).
- Live: `npm run dev`, `index.html?save=0&seed=2`: MAP, pin 1, BEST TEAM, SEND, then 4 (8x): the muster on the Aerie,
  the chip, its card; the landing toast, the egg in the Hatchery, hatching two days later.
- Shots looked at: `scratchpad/shots/s8/` (map, mission, muster, depart, aerie, baddie, live_best, live_card,
  live_land) and `scratchpad/shots/s8final/` (the three standard shots and base_t600).

### S8 review

Fixer pass on 1cdec16. I checked all ten findings against the code and reproduced them with the reviewer's probes
(`s8rev/probe3.ts`, `live2.ts`, `colors.ts`) and my own (`scratchpad/s8fix/`). Eight are fixed. Two minors are deferred.
None is rejected. `npm run check` is green on the committed tree: typecheck; palette unchanged; sim sections 1-23 in
about 22 s wall; smoke 94 views, with the map case now 277 colours (was 1735).

**Fixed**

1. **(blocker) The map's regions were anti-aliased.** In `maptable.ts`, `polyPath`, the canvas `fill`/`clip`/`stroke` and
   `ctx.lineWidth` are gone. The new `rasterise(pts): Mask` gives the pixels whose centre lies inside the polygon
   (even-odd, integer spans). The new `paintMask(ctx, mask, fill)` paints them in runs, and an edge pixel (one with a
   4-neighbour outside) is 1 px `#1a1018`. `landFill` (2-band cel) and `fogFill` (hatch at `(x + y) mod 6 < 2`) use
   both. The parchment interior of `base_map` at 2x now has **19 colours (was 1483)**. Smoke has a new `Case.maxPanelColours`
   (it counts the panel's interior, screen 12-628 x 22-332), set to 40 on `panel=map`.
2. **(major) Seed 1's LOST NEST could never succeed.** NEW `missions.ts tutorial(m)`: day 1's LOST NEST (title, millbrook,
   id < 8). `send` now reads `success = (tutorial(m) && coverage(...).covered === m.challenges.length) || roll < odds`.
   Met in full, it always succeeds and brings its sure egg. RIPPLE alone still fails (section 21 is unchanged). In
   section 22, three sends run per seed (the muster team, BEST TEAM on the LOST NEST, BEST TEAM on the day's second
   mission), each twice. It asserts the LOST NEST met in full succeeds on all 20 seeds (seed 1's BEST TEAM is at
   60 %). Overall: 53 successes and 53 eggs; the second mission, by a real roll, succeeded 13 of 20.
3. **(major) The progress card showed a failure from the muster on.** `stopStates` shows a stop as `never` only once
   `tripProgress >= stops[turnBack].at`. Live on seed 1 with EMBER alone, both stops are pending while the team
   musters (`shots/s8fix/live_card_spoiler_1x.png`).
4. **(major) The muster's 3600 held only for a fresh world.** The lift serves one dragon at a time, and a busy car
   (or a team dragon being met) waits its turn. Changing the lift's rules (S2/S3's R1-R5) is out of this slice's scope,
   so this finding is fixed by measuring and bounding, not by speeding the car.
   - Section 20 (c) is NEW: BEST TEAM on a board mission, seeds 1-6, 600 and 1500 steps into a 600-step day. Each
     muster must finish within `MUSTER_MID_MAX = 9000` (2.5 min at 1x). Measured: median 4243, max 5885.
   - The fresh-world case (section 20 (b), plan's 3600) stays.
   - BASE_DESIGN 5.2 and 8 now give the real distribution: probe3, 360 sends on the real day, median 3946, p90 5211,
     max 7308. After landing, both dragons are off the deck in median 4489 and at most 8435 steps. A faster car is
     recorded as a follow-up.
5. **(minor) Riders were superimposed after landing.** NEW `RIDER_LAND_GAP = 30`: the lead pair's rider lands at
   `LAND_LEAD_X - 30` (-90), the other at the bridge's end (-200). They walk 110 px apart (`shots/s8fix/land.png`).
   Section 6's mission save forks moved: tack 5770 -> 5660, rest 6148 -> 6038.
6. **(minor) Toasts ran over the card and the overlays.**
   - `hud.ts drawToast(ctx, s, y = 20)`.
   - `base.ts` draws the toast at `PANEL.y + PANEL.h - 14` (322) while an overlay is open, at `TRIP_CARD` bottom + 6
     (146) while the card is open, and at 20 otherwise.
7. **(minor) A failure met at every stop read as a contradiction.** Its last stop's log is now `<CHALLENGE> - <WHO> <MET>.
   THEN THE WEATHER TURNS: THEY HEAD HOME`, asserted in section 21. The landing toast is now `...: BACK HOME WITH n COIN.
   NOBODY IS HURT.` (it was HOME EARLY; a failed trip runs its full length). BASE_DESIGN 4.8 and 5.5 are updated.
8. **(minor) `base_muster` showed TEAM OUT.** The shot is now `t=2859`: everyone is on the deck and the chip reads
   MUSTER (`shots/s8fix/muster.png`). Smoke's `preset=muster&t=2860` still asserts `depart`.

**Deferred**

- **Riders walk through their dragons at the muster and overtake them on the bridge.** The formation is D1 R1 D2 R2 in
  a line, and riders walk at WALK (1 px a step), about twice a dragon's gait. A rider can only keep clear by matching
  its dragon's pace. That needs a pace-matched keeper walk (people.ts plays walk at WALK) or a new formation. It is
  cosmetic and draw-order safe: keepers sort behind dragons, and no eye is covered. It sits with the handoff's known
  "walking overlaps as elsewhere".
- **The climate picture is still the art seam's stand-in.** This is correct per the parallel contract. After the S9a
  merge, the orchestrator must re-render `base_mission` and run gate (w) on the climate bands.

**Changed names and numbers:**
- New in `missions.ts`: `tutorial`, `RIDER_LAND_GAP`.
- `hud.ts drawToast` takes a `y`; `base.ts` imports `PANEL`.
- Removed from `maptable.ts`: `polyPath`. New there: `rasterise`, `paintMask`, `Mask`.
- sim-check: `MUSTER_MID_MAX`. smoke: `Case.maxPanelColours`.
- `base_muster` is shot at t=2859.

**S8 review, second fixer pass (re-verification):** no code changes. HEAD stays 032607a. I re-checked the fixes above in the code (tutorial(), rasterise/paintMask, maxPanelColours, RIDER_LAND_GAP) and re-rendered the map at 2x: pixel-art edges, flat fills. `npm run check` is green again (smoke: 94 views, panel=map 277 colours). The two deferrals are unchanged: rider pacing is cosmetic, and the climate picture waits for S9a.
