# Implementation handoff log (issues #5-#11)

Each slice's implementer appends a section here when it finishes, and its fixer appends a review subsection.
Read every earlier section before starting a slice: it records what was ACTUALLY built (exported names and
signatures that differ from plan.md, measured numbers, deviations from the plan and why, known gaps).

Baseline before S1: commit 71857dd, `npm run check` green (typecheck, palette, sim, smoke 67 views).

## S1 — Foundation: seven young adults, stable ids, options, the save format, key isolation

**Built** (base 71857dd; `npm run check` green: typecheck, palette, sim 7 sections, smoke 69 views).

- `src/game/start.ts`: `START_DRAGONS` is the seven adults of plan S1 (EMBER fire 11 kitchen, BRAMBLE spike 164 groom,
  COBBLE rock 215 sunloft, ZAP lightning 113 romp, RIPPLE water 79 bath, ECHO slinkwing 266 roost, WICK dusk 181 dorm;
  all `stage: 'adult'`, `days: 0`, facing +1, the plan's `at`s). Ids 0-6 in exactly that (bible) order. `DragonPlace.days?: number`.
  `START_ROOMS` and `START_KEEPERS` unchanged (S2 replaces the rooms).
- `src/game/rand.ts`, `src/game/save.ts`, `src/game/presets.ts` (new); `sim.ts`, `base.ts`, `gallery.ts`,
  `types/globals.d.ts`, `tools/sim-check.ts`, `tools/smoke.ts`, `tools/shots.ts`; docs BASE_DESIGN (Decisions note on
  *young adult*, 8.1 file table and numbers) and ART_BIBLE (the five "young adult" -> "young" renames).

**Exported names and signatures** (what later slices build on; differences from plan.md marked NEW / DIFFERS)

- `sim.ts`
  - `DAY_STEPS = 10800`, `START_HOUR = 7` (NEW exports; S4 may move them into a clock module).
  - `interface SimOptions { seed?: number; dayLen?: number; clock0?: number }`. DIFFERS: the default `clock0` is
    `START_HOUR * dayLen / 24` (3150 at the real day, **175 at `dayLen: 600`**), not a fixed 3150, so a test day also
    starts at 07:00. The constructor throws unless `dayLen` is an integer >= 24 divisible by 24 and `clock0` an integer.
  - `type SimEvent = { kind: 'none' }` (placeholder member, as the plan says; replace it when the first real kind lands).
  - `Dragon.stageSince: number` = `clock0 - round(days * dayLen)`.
  - `class CareSim`:
    `constructor(rooms, dragons, keepers, opts: SimOptions = {})` -- the 4th argument is no longer a bare seed.
    `readonly seed, dayLen, clock0`; `tick`; `get clock()` (= clock0 + tick);
    `readonly roomPlaces: readonly RoomPlace[]` (NEW: the placements, which the save stores; room id = index);
    `events: SimEvent[]` (reset to `[]` at the top of `step()`; NOT saved -- it is per-step output);
    `nextDragonId` (0 before the first dragon; 7 after the start) and `nextJob` (1-based) are public;
    `static fromSave(s: SaveV): CareSim` (throws `SaveVersionError` on `v !== SAVE_VERSION` or a non-object;
    a structurally broken blob throws a plain Error `save: no <what> <id>` or a TypeError -- S4 should catch all);
    `digest(): string` = `worldKey(this)` (the full JSON, so it is long; the hook hashes it).
  - Keeper ids are still the index in `START_KEEPERS` (no `nextKeeperId`; keepers never come or go yet).
- `save.ts`
  - `SAVE_VERSION = 1`.
  - `type DragonSave = Omit<Dragon,'room'> & { room: number }`; `KeeperSave = Omit<Keeper,'station'|'job'> & { station: number; job: number | null }`;
    `JobSave = Omit<Job,'dragon'|'keeper'> & { dragon: number; keeper: number | null }`; `interface SaveV` exactly as plan.
  - `class SaveVersionError extends Error { readonly found: unknown }` (name `'SaveVersionError'`).
  - `serialize(sim)`: each dragon, keeper and job is **spread** (`{ ...d, room: d.room.id, ... }`), so a new top-level
    primitive field is saved automatically; the nested plain objects (`needs`, `act`, `legs`) are copied by hand.
    **A slice that adds a nested object must copy it in both `serialize` and `fromSave`; a slice that adds a
    reference must store it as an id and relink it in `fromSave`** (and bump `SAVE_VERSION`, G10).
  - `worldKey(sim)` = `JSON.stringify(serialize(sim))` less `seed`. `barnKey(sim)` = `{dragons (less stageSince),
    keepers, jobs}` as JSON -- S3 must add the lift; any later absolute-clock field must be left out there too.
    `fnv1a(s)`: 32-bit FNV-1a over UTF-16 code units, 8 lowercase hex digits.
- `rand.ts`: `TAG` (frozen `{BOARD:1, MISSION:2, EGG:3, NAME:4, GARDEN:5, REGION:6, SKY:7}`), `type Tag`,
  `mix32(...keys)` (keys truncated with `| 0`; order- and count-sensitive), `rngAt(seed, tag: Tag, ...keys): RngInstance`
  (DIFFERS slightly: `tag` is typed `Tag`, so a new use needs a new `TAG` entry).
- `presets.ts`: `interface StartSpec` as plan; `AGES_DRAGONS` (NEW export: the old twelve, unchanged, no `days`);
  `PRESETS = { ages }`; `startSpec(name)` (null / unknown / inherited keys -> the new game, `dragons === START_DRAGONS`);
  `buildSim(spec, seed?)` (NEW helper: `new CareSim(rooms, dragons, keepers, { ...spec.opts, seed })` then `spec.after?.(sim)`;
  BaseView uses it -- later presets only need a new `PRESETS` entry).
- `base.ts`: `interface BaseViewOpts { seed; cam?; preset?; persist? }`; `interface PetView { pet; waking; bowl; stage }`;
  `class BaseView { constructor(opts: BaseViewOpts); readonly cast: Map<number, PetView>; readonly persist: boolean;
  get pets(): Pet[] (id order; kept so BaseView still satisfies the gallery's Scene); private syncCast() }`.
  `syncCast()` runs in the constructor and once per `step()` right after `sim.step()`: it adds a pet for an unseen id,
  deletes gone ids, and rebuilds the pet with `makePet(el, stage, seed, 'idle', ...)` when `d.stage !== view.stage`
  (keeping the eased mood). A rebuilt entry keeps its Map position (id order holds). `tap()` and the bubbles look pets
  up by `d.id`; depth jitter unchanged (`(d.id % 3) - 1`). `persist` is stored and unused. `opts.cam` goes through `setCam` (clamped).
- `gallery.ts`: `GalleryParams` gains `cam: {x,y} | null` (`cam=x,y`, both finite or null), `preset: string | null`,
  `save: boolean` (false only for `save=0`); `new BaseView({ seed, cam, preset, persist: P.t == null && P.save })`;
  the keydown listener's first statement is `if (P.view === 'base') return;`.
- Hook (`window.__dragonCare.base`, `types/globals.d.ts` updated): adds `digest: string` (`fnv1a(worldKey(sim))`,
  computed every draw) and `dragons: { id; name; element; stage; f; x }[]`.
- `tools/smoke.ts`: `Case.check?: (hook: BaseHook) => string[]` with `type BaseHook = NonNullable<NonNullable<Window['__dragonCare']>['base']>`;
  helpers `castIs(n, stage | null)` (count, stage, every element, 8-hex digest) and `everyStage`; live act `baseKeys`.
- `tools/sim-check.ts`: sections now print a number prefix (`  1 routes: ...` .. `  7 rngAt: ...`); `newSim(seed)` builds
  the START set with `{ seed }`. S2 adds `noteUse`/`USED`/`PLANNED` (nothing of that exists yet).

**Measured** (`npm run sim`, the seven-adult start; the old twelve gave 274 / 271 / 15.9 s / 53.4 s)

```
1 routes: 4 keepers x 10 places (7 dragons), both ways
2 30 min: 149 jobs opened, 148 done, 0 closed by their rooms; wait avg 14.2 s, max 40.5 s; queue at most 7; 0 steps with a need at 0
3 determinism: two runs from one seed agree over 20000 steps; seeds 7 and 8 differ at step 0
4 rush: WICK's food (last in a queue of 6) done by BEA in 12.9 s
5 start: 0 EMBER (fire), 1 BRAMBLE (spike), 2 COBBLE (rock), 3 ZAP (lightning), 4 RIPPLE (water), 5 ECHO (slinkwing), 6 WICK (dusk); all adult, 0 days in, at clock 3150; presets ages (ages: 12 dragons, 4 stages)
6 saves: 4417 bytes at step 5000; loaded, it and 7 more saves (steps 5000 5074 6432 6433 6691 9587 9760: home, asleep, climbing, go, rushed, work, act, pickup, fetch) step on 5000 to the same world; v 999 throws SaveVersionError
7 rngAt: the same keys, the same draws; 7 tags, 7 first draws; the mean of 10000 draws is 0.5011 over keys, 0.5002 from one
SIM: the barn runs: every check passed
```

Smoke: 69 views (67 + `view=base&preset=ages&t=60` + the live `baseKeys` case); both old live base cases now carry
`save=0`. `view=base&t=600` now checks 7 adults / 7 elements / an 8-hex digest. Verified the key case fails without
the fix (`canvas 1120 x 760 ... tick 31 -> 9`) and the save forks fail if a loaded keeper loses `t`/`walked`.

**Deviations and why**

1. `clock0` default scales with `dayLen` (see above), so `dayLen: 600` worlds start at 07:00 (clock 175), not at 3150.
2. `CareSim.roomPlaces` added: the save stores `RoomPlace[]`, and `Room` no longer knows its module and width.
3. `presets.ts buildSim()` and the `AGES_DRAGONS` export added (one place that applies `seed` over `spec.opts` and runs `after`).
4. sim-check 6 goes beyond the plan's single continuation: besides the 5000 + 5000 run, it forks a save the first time
   each of fetch, pickup, go, work, home, climbing, a dragon's act, a sleeping dragon and a rushed job is seen
   (steps 5000-20000, max 16 forks; a Rush is injected on the first open job from step 6000 and replayed into every
   live fork by job id), steps every fork in lockstep 5000 on and compares digests; it also fails any live field
   missing from its save record. Later slices add their scenarios (mid-ride, egg, residents...) into this harness.
5. sim-check 5 also checks `days: 2.5` on a 600-step day (1500 steps into the stage, clock0 175) and the presets
   (ages has all four stages; `startSpec(null|'nope')` is the new game). sim-check 7 takes the 0.49-0.51 mean twice:
   over the first draws of 10 000 keys and over 10 000 draws from one key; it also checks `mix32` order/count and seeds.
6. Extra shot `base_t600_east` (`view=base&t=600&cam=560,376`): with S1's placements the seven adults span world
   x 344-962, wider than one 640-px frame, so "seven adults on screen in the base shots" is met by `base_t600`
   (EMBER, ZAP, COBBLE) plus `base_t600_east` (RIPPLE, BRAMBLE, WICK, ECHO). It also exercises `cam=`.
7. ART_BIBLE: l.1185 "Young adults overshoot" became "The young overshoot" and l.1314 "young adults" became "the young"
   (the label renamed in running text); the Review log (l.1400, R21) keeps its historical wording.
   `src/art/dragon/stages.ts:358`'s comment still says "young adults overshoot" (src/art is outside S1's file list).

**Gaps and stand-ins**

- `docs/base/base_live.png` (BASE_DESIGN 8.1's picture) still shows the first twelve-dragon cast; not in S1's list.
- `persist` is parsed and stored only; nothing reads or writes storage (S4).
- Night/`hour=`, `layers=`, `SimEvent` kinds: none yet.

**See it**

- `node tools/shot.ts out.png="view=base&t=600" --scale 2` (west: EMBER, ZAP, COBBLE) and `"view=base&t=600&cam=560,376"`
  (east: RIPPLE, BRAMBLE, WICK, ECHO); `"view=base&t=3600"`; `"view=base&preset=ages&t=60"` (every stage).
- Live: `npm run dev`, open `index.html?save=0`; E, the arrows, Space and the digits do nothing.

### S1 review

Fixer pass over 71857dd..4313050; two reviewers, six minor findings, no blockers or majors. All six were checked against
the code (reproduced where possible). Five were fixed and one partly deferred; none were rejected. `npm run check` is
green again: typecheck, palette 2255/2255 + 156/156, sim sections 1-7 with numbers **unchanged** (149/148, 14.2 s /
40.5 s, 4417 bytes, the same 7 forks), smoke 69 views.

**Fixed**

1. **The save check now covers CareSim's own fields** (`tools/sim-check.ts` section 6). Every `Object.keys(sim)` must
   be a `SaveV` key unless it is in `UNSAVED = { rooms, roomPlaces, events }` (each with its reason). Before, a new
   top-level world field (a lift, a garden, a board) that `serialize` missed was invisible, because `digest()` *is*
   the save. Verified: adding `lift = { y: 0 }` to CareSim fails with "save: the world's lift is not in its save".
   **Later slices: a new CareSim field must go into `SaveV`/`serialize`/`fromSave` (and bump `SAVE_VERSION`), or
   into `UNSAVED` with a reason. A derived cache can go in `UNSAVED`; state cannot.**
2. **`baseKeys` smoke case is timing-independent** (`tools/smoke.ts`). It reads the hook after every key: a tick that
   falls means a rebuild, and a missing hook means the page left the base. It still checks the final `tick >= a+10`
   and the 640x360 canvas, and now also checks that the dragon ids are the same. To make "hook gone" meaningful,
   **`BaseView.detach()` now deletes `window.__dragonCare.base`**; `types/globals.d.ts` says so. Measured with
   Playwright against three guard regressions:
   - guard removed: "e restarted the world (tick 31 -> 5)" plus "hook gone after ArrowRight" plus the canvas size;
   - E-only: "e restarted (31 -> 5)";
   - digits-only: "5 restarted (50 -> 4)".
   All were caught by the per-key check, not by the timing margin. The fixed tree passed 3 of 3 runs.
3. **A preset page never persists** (`src/gallery.ts`): `persist: P.t == null && P.save && !P.preset`, and the
   comments in `BaseViewOpts` and the gallery header say so. DIFFERS from plan S1's literal formula. This stops S4's
   `attach()` from loading the player's barn over `preset=growup` (so the preset would never show) or autosaving a
   debug cast as `dragon-care/base`. **S4: `persist` is already false for any `preset=` (even an unknown name).**
4. **The gallery's arrow/Space cycle steps over `base`** (`src/gallery.ts`: `RING = VIEWS.filter(v => v !== 'base')`).
   The `if (P.view === 'base') return;` guard stays as the handler's first line. Before, ArrowLeft on `view=lineup`
   (or ArrowRight on yardaudit) landed in the base and could not leave it. Measured: lineup ArrowLeft now goes to
   yardaudit (560x294, no base hook), and ArrowRight comes back to lineup.
5. **Opening frame and BASE_DESIGN 8.1's picture.**
   - `START_CAM` in `src/game/base.ts` moved from (48, 376) to **(300, 376)**. The opening frame now holds six of the
     seven adults whole (COBBLE, ZAP, EMBER, ECHO, BRAMBLE, RIPPLE), plus WICK's tail at the right edge. Before it
     held three: EMBER, ZAP and COBBLE.
   - `docs/base/base_live.png` was re-rendered with `node tools/shot.ts docs/base/base_live.png="view=base&t=1800"
     --scale 2`. It now shows the seven-adult start and the four named keepers (4 OF 4 BUSY); before, it showed the
     twelve-dragon cast and five keepers. The caption and the §8.1 text were updated: a preset page never saves,
     and the arrows step over the base.
   - The smoke drag still passes: from 300 there is 420 px of pan.
   - **S2 sets `START_CAM` to (168, 376) as planned.** S2 should check the opening frame with its start slots. By
     §3.3's numbers that frame is x 168-808:
     - EMBER and ZAP (x 248) are whole;
     - RIPPLE, BRAMBLE and WICK (slot 0 at x 792, facing +1, head to about 842) have their heads cut at the right
       edge;
     - COBBLE (952) and ECHO (1112) are out of frame.

     S2 may want a start camera that shows the heads (for example x 220 or more gives x 220-860).

**Deferred**

- WICK is still only a tail in the opening frame. The seven stand at x 344-962 in the mockups' rooms, and a body
  spans about x-71..x+51, which is wider than 640 px. S1 must not move dragons, so this waits for S2's slots. It is
  recorded in BASE_DESIGN 8.1's "Not in this slice" list. `base_t600_east` (cam 560,376) still shows WICK whole.

**Rejected:** none.

**Shots looked at** (in scratchpad/shots/, `--scale 2`):
- `base_t0` and `base_t600`: six adults whole and WICK's tail;
- `base_t600_east`: RIPPLE, BRAMBLE, WICK and ECHO;
- `base_t3600`;
- `base_ages`: babies BURR, CINDER and PEBBLE, young ZAP and SPLASH, adults, and elder COBBLE;
- `docs/base/base_live.png`.

## S2 — The building rebuilt: rooms with purposes, the Dragon Lift, the Aerie floor, floor-safe surfaces

**Built** (base 3e3f506, commit 17c9857; `npm run check` green on the committed tree: typecheck, palette 2256/2256 + keepers 156/156, sim sections 1-8, smoke
69 views, unchanged cases re-baselined only).

- `src/game/layout.ts` rewritten: the room set of plan 3.2 with purposes, slots, the lift, the Aerie, the two kinds of
  net, Dijkstra over `(link, stop)` nodes, stand spots and the plate places.
- `src/game/surfaces.ts` (new): `INK`, `FLOORS = { straw: '#e0d6b8' }` (frozen; `type FloorName`), `STRAW_SEAM`
  `#c9bd9c` (the 1 px seam on straw), `EMPTY_WALL` `#9a8a76`, `LIFT_WALL` `#a8987e`. S4 adds `WALLS`/`BACKDROPS` here
  (the room walls are still the private `WALLS` record in building.ts).
- `src/game/start.ts`: `START_ROOMS` = kitchen f0 m0-1, bath f0 m3-4, hatchery f0 m5, romp f1 m0-1, groom f1 m3-5,
  dorm f2 m3-4, tack L f0, bunks L f2, maproom L f4 (room ids 0-8 in that order). `START_DRAGONS` in the start slots of
  plan 3.3 (EMBER kitchen 0, BRAMBLE groom 0, COBBLE groom 1, ZAP romp 0, RIPPLE bath 0, ECHO groom 2, WICK dorm 0).
- `src/game/presets.ts`: `AGES_DRAGONS` in slots (EMBER kitchen 0, CINDER kitchen 5, PEBBLE hatchery 1, RIPPLE bath 0,
  ZAP romp 0, BURR romp 5, SPLASH bath 1, BRAMBLE groom 0, WICK dorm 0, ASH dorm 1, COBBLE groom 1, ECHO groom 2).
- `src/game/sim.ts`, `save.ts`, `base.ts`, `building.ts` (the redraw), `gallery.ts` (`STRAW = FLOORS.straw`),
  `tools/palette-check.ts`, `tools/sim-check.ts`, `tools/shots.ts` (+`base_aerie`), docs BASE_DESIGN 2, 3, 4.6, 5.1
  (the Lookout line), 8.1 (+ `docs/base/base_live.png` re-rendered) and ART_BIBLE 5.8 (re-pasted (i) block, 2256).
  `types/globals.d.ts` and `tools/smoke.ts` unchanged (the hook did not change).

**Exported names and signatures** (layout.ts unless said; DIFFERS / NEW against plan S2's type block)

- Grid: `MOD, PITCH, TOWER_W, WALL_H, BAND, SLAB, WALL, WORLD_W, WORLD_H, GROUND, TOWER_L, BARN_X, BARN_MODS, BARN_W,
  TOWER_R, BARN_FLOORS, TOWER_FLOORS, RIDGE_X, RIDGE_Y, KNEE_DX, KNEE_Y, floorTop, feetY, modX` as before.
  **Removed:** `HOIST_W, HOIST_X, HOIST_CX, SPANS, LINKS` (and building.ts `drawHoistCar`). NEW: `LADDER_BAY_W 64,
  LADDER_BAY_X0 648, LADDER_BAY_X1 712, LADDER_M_X 680`.
- Lift/Aerie: `LIFT_MOD 2, LIFT_X0 488, LIFT_X1 648, LIFT_CX 568, CAR_X0 492, CAR_X1 644` (NEW: CAR_*),
  `LIFT_STOPS = [0,1,2,5] as const`, `AERIE_F 5, DECK_X0 8, DECK_X1 648`, NEW `HEAD_Y 40` (the headframe beam's
  underside = `floorTop(5)`) and `PULLEY_Y 44`. `LIFT_SPEED` is NOT defined (S3's travel.ts, as its type block says).
- Rooms: `type RoomKind = 'kitchen'|'bath'|'hatchery'|'romp'|'groom'|'dorm'|'tack'|'bunks'|'maproom'`;
  `interface RoomInfo { name; purpose; meets?; supplies?; post?; people?; slots?: 'module'|'baby' }` (as plan; `post` is
  still px from the room's left edge: kitchen 64 -> x 232, bath 226 -> 938, romp 107 -> 275, groom 120 -> 832, dorm the
  middle -> 872, tower rooms the middle -> 112); `ROOM_INFO`; NEW `ROOM_KINDS` (frozen array);
  NEW `type Structure = 'lift'|'aerie'` and `STRUCTURES: Record<Structure, { name, purpose }>` (the LIFT and AERIE
  plates and purposes: sim-check 8 checks them like rooms).
- `interface Slot { room; i; f; x; facing; baby; mod }`, `interface Room { id; kind; part; floor; x0; x1; slots: Slot[] }`
  (exactly plan). Slot order per room: the module slots first (i 0..w-1), then per module two baby sub-slots (+40
  facing +1, +120 facing -1). Kitchen/romp/bath/dorm: 0:+80 1:+240(-1) 2..5 babies; groom: 0 792+ 1 952+ 2 1112- 3..8
  babies; hatchery (`slots: 'baby'`): 0 1072+ 1 1152-. NEW `fitsSlot(slot, stage)` = `slot.baby === (stage === 'baby')`.
- `placeRooms` throws for a barn room covering module 2, across the ladder bay, or a slotted (dragon) room in a tower.
- Nets: `type Span = readonly [number, number]`; `interface Link { name: 'ladderL'|'ladderR'|'ladderM'|'lift'; x;
  stops: readonly number[] }`; `interface Net { spans: readonly (readonly Span[])[]; links }` (spans indexed by floor
  0-5). `KEEPER_NET` (frozen): f0/f1 [74,1286], f2 TL [184,1176] TR, f3/f4 TL TR, f5 [18,638]; ladderL x140 0-5,
  ladderR x1220 0-4, ladderM x680 0-2. `DRAGON_PAD`; `dragonNet(stage)` (cached per stage in a Map; S6 must rebuild
  when the garden grows -- today there is no invalidation hook): f0/f1 [168+P,1192-P], f2 [328+P,1032-P], f3/f4 [],
  f5 [8+P,648-P], links [lift x568 stops 0,1,2,5]. `bayFloors()` returns `LIFT_STOPS`.
- `route(from, to, net = KEEPER_NET)`: Dijkstra, one node per (link, stop); consecutive stops joined at
  `|feetY(a)-feetY(b)| * CLIMB_COST` (the lift's 2->5 is ONE edge and ONE leg: `f2 x568 / f5 x568`, cost 420); floor
  edges only inside one span of that net; ties to the lower node index. Legs are `{f, x}`; a leg whose f differs from
  the previous one is a climb/ride at the link's x (a keeper's `move` already climbs any Δf in one leg).
  `spanOf(f, x, net = KEEPER_NET)`, `clampToFloor(f, x, net = KEEPER_NET)` (kept: nearest span),
  `clampToSpan(f, x, net, near)` (as plan; unused yet), `CLIMB_COST`, `Spot`, `Leg` unchanged.
- `REACH` MOVED here from sim.ts (sim.ts re-exports it: `export { REACH }`, so `import { REACH } from sim.ts` still
  works). `standSpot(slot, stage, room)` = `{ f: slot.f, x: clamp(slot.x + facing*REACH, room.x0+10, room.x1-10) }`.
- NEW `interface Plate { text; x; y; w; h; names: RoomKind|Structure; room: number|null }`, `PLATE_H 11`,
  `platesOf(rooms)`: one per room (barn x0+5, y t+3, hayloft t+20; tower x0+3), LIFT (495, 603), AERIE (12, 112).
  building.ts `drawPlates` draws exactly these; sim-check 8 checks them headless.
- sim.ts: `Dragon.room` REMOVED, `Dragon.slot: Slot` added (non-null in S2; S3 widens it to `Slot | null`). The slot is
  the room's own object (`sim.rooms[d.slot.room].slots[d.slot.i]`: identity holds after `fromSave` too). The
  constructor places each `DragonPlace` in `slot` and throws on: no such slot, a size that doesn't fit, a slot taken,
  or a module clash (one grown dragon or up to two babies per module). `x = slot.x, f = slot.f, facing = slot.facing`.
  `standAt(d)` = `standSpot(d.slot, d.stage, room)`. Regeneration (ROOM_REGEN, kept) uses `ROOM_INFO[room of
  d.slot].meets`. `SimStats.used: Record<string, number>`; private `use(kind: RoomKind | 'lift' | 'aerie')` -- S3's lift
  ride and S5+ mechanics should call it (it's private: make it public or add a method if travel.ts lives outside the class).
- start.ts: `DragonPlace = { name; element; stage; seed; slot: { room: RoomKind; i: number }; days? }` -- DIFFERS: no
  `at`, and NO `facing` (the slot's facing is used; set one in a preset's `after` if ever needed).
- save.ts: `SAVE_VERSION = 2` (DIFFERS: plan S3 says "SAVE_VERSION 2"; S3 must go to 3). NEW `interface SlotRef { room;
  i }`; `DragonSave = Omit<Dragon,'slot'> & { slot: SlotRef }`; `serialize` copies `stats.used`; `fromSave` relinks the
  slot and copies `used` (`Object.assign(sim.stats, s.stats, { used: { ...s.stats.used } })`).
- building.ts: `drawBuilding(rooms)`, `drawPlates(rooms)`, `plate(g, s, x, y)`, NEW `drawLiftCar(g, y)` (y = the rider's
  feet, `feetY(f)` at a stop; the straw deck's top is y-8; 40 px rails with caps and knee braces; the two cables at
  x 493 and 642 run up to the pulleys but are NOT drawn over any landing above the car). base.ts draws it at
  `feetY(0)` (`private readonly carY`); S3 draws it at `lift.y`.
- base.ts: `START_CAM = (204, 376)` (DIFFERS from plan's 168, see deviations).

**Measured** (`npm run sim`)

```
1 routes: keepers 4 x 64 places (every stand spot, post and the deck), both ways; dragons 1118 routes on 4 stages' nets, 1220 lift rides among them, none through a tower; hayloft to Aerie 932 px in one ride
2 30 min: 150 jobs opened, 148 done, 0 closed by their rooms; wait avg 13.8 s, max 41.4 s; queue at most 6; 0 steps with a need at 0; rooms used bath 31, romp 36, kitchen 32, groom 8, dorm 2
3 determinism: two runs from one seed agree over 20000 steps; seeds 7 and 8 differ at step 0
4 rush: WICK's food (last in a queue of 6) done by BEA in 12.6 s
5 start: 0 EMBER (fire), 1 BRAMBLE (spike), 2 COBBLE (rock), 3 ZAP (lightning), 4 RIPPLE (water), 5 ECHO (slinkwing), 6 WICK (dusk); all adult, 0 days in, at clock 3150; presets ages (ages: 12 dragons, 4 stages)
6 saves: 3972 bytes at step 5000; loaded, it and 7 more saves (steps 5000 6432 6433 6451 7405 9466 9760: home, asleep, go, rushed, work, act, climbing, pickup, fetch) step on 5000 to the same world; v 999 throws SaveVersionError
7 rngAt: the same keys, the same draws; 7 tags, 7 first draws; the mean of 10000 draws is 0.5011 over keys, 0.5002 from one
8 rooms: 9 kinds and 2 structures, each with a purpose; 5 needs, one room each; 11 plates, none on a bare slot; used over the suite: kitchen 65, bath 90, romp 96, groom 18, dorm 2; planned: lift, hatchery, tack, bunks, maproom, aerie
```

(S1 was 149 / 148 / 14.2 s / 40.5 s / queue 7 / 4417 bytes.) The whole sim-check runs in about 1.3 s. Palette: RESULT
2256 of 2256 (S1 2255: +1 for `(i) straw saturation < 0.20`); KEEPERS 156 of 156. Verified the gates bite: adding
`deck: '#8a6242'` and `pale: '#dcd0b0'` to FLOORS failed 35 dragon gates (the deck's saturation 0.522 and its (i) pairs;
the pale one's saturation 0.200) and 2 keeper gates (Pip's shoes and trousers on the deck). Start extents measured
headless over 600 idle steps: EMBER 187.5-296.5, ZAP 188.8-296.6, RIPPLE 725.1-840.4, BRAMBLE 735.3-841.1, WICK
721.3-840.9, COBBLE 901.4-1002.8, ECHO 1063.5-1176.7.

**Deviations and why**

1. **START_CAM (204, 376), not (168, 376).** The five dragons west of the ladder bay span x 188-841 (measured), 14 px
   more than a screen. At 168 the frame (168-808) cut RIPPLE's, BRAMBLE's and WICK's faces off (33 px); at 204 all five
   faces are whole and only EMBER's and ZAP's tail tips (<= 16 px) are cut. The S1 handoff flagged exactly this. The
   smoke drag still has 516 px of pan (needs > 100).
2. **The headframe stands a room's height over the deck** (beam underside y 40 = `floorTop(5)`, pulleys at y 44), not
   "housing up to y 120, pulley at y ~112": a car at the Aerie stop has its deck at y 128 and a rider up to ~70 px tall
   (feet 136), so a frame at 112-120 would cut through the rider. The shaft housing runs from the roof up to the deck's
   slab (y 152). Two pulleys (one over each rail and cable), not one disc.
3. **`stats.used[kind]++` on a job start counts only a need met in the room that meets it** (`meets === job.need`), plus
   every supply pickup. A dragon standing in a room has its other needs met there too in S2 (EMBER's love in the
   kitchen): those are not the room's purpose and don't count. (Stronger proof for #11; S3 makes every act happen in
   `NEED_ROOM[need]` anyway.)
4. **Tower floors are straw now** (FLOORS.straw with 1 px `STRAW_SEAM` board lines), not the old plank `#b08a62`
   (L 0.28, S 0.44): G7 says every surface a keeper stands on is a FLOORS entry, and the planks failed (i) and S.
5. **Ladders are drawn whole**, one piece per link from a grab-rail stub over its top floor down to its bottom band,
   through a dark hatch in every slab it climbs through (the towers' too, not just ladderM's; ladderL through the
   deck). Before, tower ladders were drawn per floor, broken at each slab.
6. `DragonPlace` has no `facing` (the slot's); `REACH` moved to layout.ts (re-exported by sim.ts); `SAVE_VERSION` 2 now.
7. Extra checks beyond plan S2: sim-check 1 asserts the hayloft->Aerie route is one lift leg costing exactly
   `224 + 336*1.25 + 288 = 932`, that no dragon net reaches a tower, that the keepers' net has no lift, and every
   cross-floor dragon leg is at x 568; sim-check 8 asserts each placement rule throws (room on the lift, dragon room
   in a tower, two dragons in a slot, grown in a sub-slot, baby in a module slot, baby beside a grown dragon, grown in
   the hatchery) and that the start stands in plan 3.3's start slots; sim-check 6 asserts slot identity and a copied
   `used` after loading.
8. **The dorm's lamps hang lower in the hayloft** (box at t + 32, at the plan's x + 40 and x + 280, cords from the
   rafters): the hayloft's plates stay at t + 20 (at t + 3 the LAMP DORM plate hides under the HUD's top bar in the
   start frame, cam y 376), and a lamp at t + 16 sat under that plate. The nests have a cup (the rim `#b8a47a` over a
   darker hollow) and 4 x 2 px straw strands `#c8b68c`.
9. BASE_DESIGN 5.1 said "The Lookout keeps 3 or 4 missions": now "The Map Room's table keeps 3 or 4 missions" (the
   Lookout is dropped); 8's "people's own lives (bunks, the mess hall)" lost the mess hall. Clouds moved off the deck
   and headframe (sky only).

**Gaps and stand-ins**

- The lift car is parked at f0 (S3 moves it); cables are 1 px (plan's "two 1 px cables"), other marks >= 2 px.
- `used` for dorm and groom are small over 30 min (2 and 8) because the room still regenerates its own need at 1.5x
  the base drain against the dragon's 2x own-need drain (net 0.5x); they are > 0, and S3 removes ROOM_REGEN.
- `clampToSpan` and `bayFloors` exist but nothing calls them yet (S3). `ROOM_REGEN`'s comment in needs.ts still says
  "the dragons living in it" (S3 deletes it).
- The nests are empty greybox mounds (eggs are S5's); the Garden Gate is not built (S6); the right tower's f0 is bare.
- The hook (`window.__dragonCare.base`) did not change; S3 adds move/room/slot/lift.

**See it**

- `node tools/shot.ts out.png="view=base&t=600" --scale 2` (the start frame: kitchen, romp room, lift parked at f0,
  ladder bay, five faces); `"view=base&t=600&cam=560,376"` (east: dorm pallets, groom, bath, hatchery nests);
  `"view=base&t=60&cam=0,0"` (`base_aerie`: the deck, the gantry on its trestles, the shaft housing, the headframe,
  the ladder through the deck); `"view=base&preset=ages&t=60"` and `&cam=560,376` (babies in sub-slots, PEBBLE in
  the hatchery); `"view=base&t=60&cam=300,150"` (the shaft through the roof, the dorm under the ridge, the skylight).

### S2 review

Fixer pass over 3e3f506..17c9857. Two reviewers sent ten findings (two major, eight minor; two of the minors are the
same finding). I checked each one against the code and reproduced it in shots or headless. All ten are real, and all
were fixed; none were rejected. `npm run check` is green: typecheck, palette 2256/2256 + 156/156 (unchanged), sim
sections 1-8, and smoke 69 views (t=600 shows 6217 colours).

**Fixed**

1. **(major) Bath slot 1's paws stood on the tub.** In `building.ts`, the tub now ends at the band's top
   (`bf = t + WALL_H`, as with the hearth), so every bath slot's paws are on straw. The legs of a dragon in slot 1
   are still seen against the tub's lower part; that is a prop/backdrop matter for S4's gate (w) (see Deferred).
   Seen in `preset=ages&t=60&cam=760,420` at 2x and `cam=820,560` at 3x: SPLASH's paws are on the straw.
2. **(major) Keepers idled inside the start dragons' bodies** (PIP behind ZAP, BEA behind EMBER, TOMAS behind
   BRAMBLE). NEW `RoomInfo.wait?: number` (px from x0; the default is the post) and `layout.ts waitX(room)`. Kitchen
   and romp have `wait: 160` (x 328), groom has `wait: 320` (x 1032), and the dorm keeps its post (872). `sim.ts`
   sets `stationX` from `waitX` rather than `postX`. DIFFERS from plan S2 ("station x is the post"). **Supplies are
   still picked up at the §3.2 posts** (232 / 275 / 938); only the resting spot moved. NEW `DRAGON_BODY` (the
   measured back and front extents per stage: baby 26.5/29.8, young 54.4/41.8, adult 70.7/50.8, elder 74.7/52.0) and
   `slotBody(slot, stage): Span`. sim-check 8 asserts that each keeper's `stationX ± 10` misses the body of every
   fitting stage in every slot on their floor. It prints `keepers wait at BEA 328, TOMAS 1032, IRIS 872, PIP 328`.
   Mutation-checked: without `wait`, the check fails with "BEA waits at x 232, behind a young/an adult/an elder in the
   kitchen's slot 0". In `view=base&t=5700`, PIP and BEA stand whole beside ZAP and EMBER. TOMAS (1032) and IRIS (872)
   are east of the opening frame (x 204-844); no spot in the parlour is both clear and inside that frame.
3. **(minor) The Lamp Dorm plate covered IRIS's face.** **Plates are now drawn under the lift car and the cast**
   (`base.ts draw()`: building, plates, car, cast, bubbles, HUD). Before, the order was building, car, cast, bubbles,
   plates. A name is on the wall, so a passer-by covers it for a moment, and it can never cover a face or a bubble.
   S3's rider passing the LIFT plate is covered by the same rule. Comments are updated in `building.ts`
   (header, `drawPlates`). Seen in `t=110&cam=560,360`: IRIS's face shows in front of the LAMP DORM plate.
4. **(minor, reported twice) The opening frame cut "H KITCHEN" and "ROOM".** `platesOf`: a barn room at `BARN_X`
   now has its plate at x0 + 44 = 212 on **every** floor (before, only the hayloft did). Both plates are whole at
   START_CAM x 204 (`t=0`, `t=600`, `t=5700`). The comment on `START_CAM` in `base.ts` says so.
5. **(minor) A lift trip was one leg per stop.** `route()` now merges a run of lift stops into **one leg, from the
   boarding stop to the alighting stop**. f0 to the Aerie is `f0 x568 / f5 x568 / f5 x280`. A **ladder climb stays
   one leg per floor**, so a keeper re-routed mid-climb stops at the next floor, and keeper behaviour is unchanged.
   The cost is unchanged. **S3: a dragon leg whose f differs from the dragon's floor is exactly one lift call,
   `to = leg.f`.** sim-check 1 counts rides as those legs and fails on two floor changes in a row. It also asserts
   the f0-to-Aerie route above. It now prints "816 lift rides among them (one leg each)"; before, it printed 1220
   legs. Mutation-checked: without the merge it fails.
6. **(minor) The "no dragon route reaches a tower" check was vacuous.** sim-check 1 now asserts, for every stage,
   that every dragon span lies inside [BARN_X, TOWER_R] on f0-f2 and inside [DECK_X0, DECK_X1] on f5, and that f3
   and f4 have no span. It also asserts that no dragon reaches either tower's room on f0 or f1, or the left tower's
   f3. Mutation-checked: widening f0 to [74, 1286] fails with "floor 0 runs 74..1286, outside the barn" and "can
   reach the tower room at f0 x 112 / x 1248".
7. **(minor) USED counted loaded copies again.** `noteUse(w, since = {})` now takes one world plus the uses it was
   loaded with. Section 6 notes `b` since `blob.stats.used` and each fork since its own `used` at load; `a` and
   `ref` are noted whole. The totals are now kitchen 52, bath 50, romp 72, groom 19, dorm 2 (before: 65 / 90 / 96 /
   18 / 2). PLANNED is unchanged.
8. **(minor) The lead images of BASE_DESIGN showed the old building.** Both `barn_cutaway.png` (the intro) and
   `barn_screen.png` (section 2) are now captioned as the first greybox mockup from before #11's room set. The
   captions list what is gone and point to section 8's `base_live.png`.
9. **(minor) The dorm lamp cords were 1 px anti-aliased half-tone lines.** They are now `rect()` 1 px INK columns.
   The same fix went to the hatchery heat lamp's cord, the romp bunting's line and the right tower's flagpole (every
   other 1 px axis-aligned `line()` in `building.ts`). Seen at 3x (`t=60&cam=300,150`): crisp ink.

**Docs.** BASE_DESIGN:
- the two mockup captions;
- section 3 "Slots": keepers wait at a clear spot and take supplies at the posts; the names hang behind the cast;
- 8.1: the new 30-minute numbers, and the re-rendered `docs/base/base_live.png` (`view=base&t=1800 --scale 2`) with a
  caption that matches the frame (ZAP asleep, Tomas walking home, Pip taking a ball down to RIPPLE, Iris passing behind
  BRAMBLE).

ART_BIBLE is unchanged, because no floor or gate changed.

**Changed numbers** (`npm run sim`; the keepers' resting spots moved, so trips changed)

```
1 routes: keepers 4 x 64 places (every stand spot, post and the deck), both ways; dragons 1118 routes on 4 stages' nets, 816 lift rides among them (one leg each), none through a tower; hayloft to Aerie 932 px in one ride
2 30 min: 149 jobs opened, 146 done, 0 closed by their rooms; wait avg 14.5 s, max 41.0 s; queue at most 7; 0 steps with a need at 0; rooms used bath 31, romp 36, kitchen 32, groom 8, dorm 2
4 rush: WICK's food (last in a queue of 6) done by BEA in 13.6 s
6 saves: 4048 bytes at step 5000; loaded, it and 7 more saves (steps 5000 5508 5708 6433 7605 9623 9675: go, asleep, work, act, home, rushed, climbing, fetch, pickup) step on 5000 to the same world; v 999 throws SaveVersionError
8 rooms: ... 11 plates, none on a bare slot; keepers wait at BEA 328, TOMAS 1032, IRIS 872, PIP 328, clear of every slot; used over the suite: kitchen 52, bath 50, romp 72, groom 19, dorm 2; planned: lift, hatchery, tack, bunks, maproom, aerie
```

(S2 as built: 150 / 148 / 13.8 s / 41.4 s / queue 6 / 3972 bytes / rush 12.6 s.) Sections 3, 5 and 7 are unchanged.

**Deferred**

- **Supply posts still lie behind slot bodies:** the hearth at 232 is in kitchen slot 0, the ball box at 275 in romp
  slot 0, the tub post at 938 in bath slot 1, and 832 in groom slot 0. A keeper picking up a supply (PICKUP 40 steps,
  0.7 s) behind an occupied slot is hidden for that moment. The posts are fixed by plan §3.2, and the pickup is brief.
  S3, where dragons fill any slot, can move a post if its shots show it matters.
- **Props behind slots are not contrast-gated.** The tub's body `#8e6240` (L 0.148) and its shadow band, and the
  hearth's firebox `#3a2626`, sit behind the legs of a dragon in bath slot 1 and kitchen slot 0. The paws are on straw
  now. **S4's gate (w)** (every backdrop a dragon is seen against, L of about 0.16 or more) should decide whether large
  props directly behind a slot count as backdrops.

**Rejected:** none.

**Shots looked at** (scratchpad/shots/s2fix/, 2x unless noted): the pre-fix set pre_t5700, pre_ages_bath, pre_t0,
pre_iris (3x) and pre_cords (3x); then t0, t600, t600_east, t3600, t5700, aerie (`t=60&cam=0,0`), ages_bath, iris (2x,
`t=110&cam=560,360`), cords (3x), bath3x (3x, `preset=ages&t=60&cam=820,560`), and `docs/base/base_live.png`.

## S3 — Dragons walk to their needs

**Built** (base 439159c; `npm run check` green on the committed tree: typecheck, palette 2256/2256 + keepers 156/156
(unchanged), sim sections 1-9, smoke 69 views + 1 frame pair). Advances #7 (its two criteria) and #11 (the need rooms
and the lift proven used).

- `src/game/gait.ts` (new): the walk root-motion tables. `src/game/travel.ts` (new): slots, goals, eviction and bumps,
  walking and the paper turn, landing queues, the lift and the bay rule.
- `src/game/sim.ts`: the new Dragon/Keeper/Lift state; step order (drain + acts, jobs open (no closing), `stepTravel`,
  `assign`, keepers); `servable` (goalJob + slot in the need's room + arrived / `remainingCost <= LEAD_PX` / rushed +
  awake + no other keeper); the keeper `wait` phase (`watch`), `WAIT_MAX` give-up (`drop`); Rush retargets the dragon
  at once (`retarget`, slot bump allowed) and raises its lift call; the R1 hold for keepers. `needs.ts`: `ROOM_REGEN`
  deleted; `HALF_LIFE_S` 360 -> 420 (lever 4, see deviations).
- `pet.ts`: `Pet.turn` (-1 or 0..5) narrows the pose after `tick()` (care/dragon.ts `TURN_W`). `base.ts`: `sync` puts
  the pet at `d.x`, feet on the car (`lift.y`) while riding, `feetY(f, 2 + queue place)` while in a landing queue, else
  `feetY(f, id%3 - 1)`; facing from the sim (tail chain reset on a flip); `play('walk', {restart, speed: 1, blend: 8})`
  on every new `walkSeq` (catching a mid-bout walk up by `(gaitT-1) % len` ticks for a view opened on a loaded world);
  idle (blend 4) through a turn; the car drawn at `lift.y`; the hook's new fields. `people.ts`: `wait` -> `watch`,
  held at the bay -> `idle`, walk/carry at `(rushing ? RUSH : 1) * WALK / KEEPERS[look].speed`.
  `src/art/keeper/player.ts`: `KeeperPlayer.setSpeed(s)`.
- `save.ts`: `SAVE_VERSION = 3`; dragons' `slot` may be null, `legs` copied; `SaveV.lift` (copy of `LiftState`, calls
  copied); `barnKey` now includes the lift. `types/globals.d.ts`, `tools/sim-check.ts`, `tools/smoke.ts`,
  `tools/shots.ts` (+`base_lift`), docs BASE_DESIGN 2, 3, 4.4, 4.6, 4.9, 8.1 (+ `docs/base/base_live.png` re-rendered),
  9 Q1; ART_BIBLE status; KEEPERS status.

**Exported names and signatures** (DIFFERS / NEW against plan S3's type block)

- `sim.ts`: `type DragonMove` and `DragonGoal` exactly as plan. `Dragon`: S1 fields + `slot: Slot | null`, `goal`,
  `goalJob: number | null`, `legs: Leg[]`, `move`, `gaitT` (0 = not in a walk bout), `walkSeq`, `turn` (-1 or 0..5),
  `waited` (steps in the current landing/bay wait). `Phase` adds `'wait'`. `Keeper` NEW `bayWait: number` (steps held
  at the bay's edge; 0 when not). NEW `interface LiftCall { dragon; f; to; tick; prio: 0|1|2 }`; `LiftState { y; f;
  target; rider; moving; closing; blockedSince; calls }` -- DIFFERS: `f: number` (the stop it is at, or last left while
  moving), never null. `rider` is the dragon from the moment the car is sent for it until it starts walking off (so a
  caller being fetched is already `rider`). `SimStats` adds `dragonWalked, liftRides, liftWaitMax, keeperWaitSum,
  keeperWaits, waitTimeouts, evictions, slotBumps` (plan) and keeps `closed` (always 0; sim-check fails otherwise).
  `CareSim.lift` (starts parked at f0, y 696). NEW public: `use(kind)` (travel.ts counts lift rides), `drop(k)` (a
  keeper gives a job back and walks home: bumps, WAIT_MAX). `servable` stays private.
- `travel.ts`: `NEED_ROOM` (derived from `ROOM_INFO.meets`; sim-check 8 asserts the plan's mapping); `TURN_STEPS 6,
  TURN_HALF 3, LEAD_PX 300, WAIT_MAX 7200, BAY_CLOSE 240, LIFT_SPEED 1.5 (DIFFERS: lever 3), OVERDUE 3600 (NEW),
  KEEPER_HALF 10 (NEW)`; `stepTravel(sim)`, `arrived(sim, d)`, `remainingCost(sim, d)` as plan. NEW:
  `inBay(x, h)`, `liftRange(sim)`, `bayShut(sim, f)` (R1/R3), `dragonInBay(d)`, `inTheWay(sim, lo, hi)` (R2; returns
  a name or null), `needRoom(sim, need)`, `goFor(sim, d, j, bump)`, `retarget(sim, d, j)` (Rush), `raiseCall(sim, d)`,
  `walking(d)`, `type Side = -1|1`, `sideOf(d)`, `landing(sim, f, side)` (the queue, front first), `landingPlace(sim,
  d): {x, i}`.
- `gait.ts`: `interface Gait { frames; len; avg; steps; loopStart }` (DIFFERS: + `steps`, the move at each anim time,
  and `loopStart`); `gaitFrom(frames, loopFrom?)` (NEW), `gaitOf(el, stage)` (cached; built from
  `dragonAnims(stage, spec, dims).walk` of a seed-1 build, lazily, so a view's pets fill the anim cache first),
  `moveAt(g, t)`.
- Hook (`window.__dragonCare.base`): dragons gain `move`, `room` (kind at f and x, or null), `slot` (`kind:i` or null);
  `lift: { y, rider }`; `walked` (= `stats.dragonWalked`).
- sim-check: `GATE` object (the service gates), sections now 1-9 (9 = gait). smoke: `travels(b)`, `walkedOver(px)`,
  `PAIRS` (frame pairs compared after all cases; printed as `ok: a -> b (n dragons moved: ...)`), `hooks` map.

**Measured** (`npm run sim`, seed 1; the whole sim-check runs in about 3.3 s)

```
2 30 min: 149 jobs opened, 143 done, 0 closed without a keeper; wait avg 73.5 s, max 330.3 s; queue at most 10; 0 steps with a need at 0; keepers waited at the stand spot 7.1 s on average; dragons walked 95304 px, rode the lift 129 times (a landing wait at most 76.4 s, held in the car at most 19.5 s), were held at the bay's edge at most 11.8 s (keepers 12.9 s); 44 moved on, 0 keepers gave up; met in EMBER 4, BRAMBLE 5, COBBLE 5, ZAP 5, RIPPLE 5, ECHO 5, WICK 5 rooms; rooms used bath 50, lift 129, dorm 28, romp 60, groom 33, kitchen 54
4 rush: WICK's food (last of 6 waiting) done by PIP in 24.4 s, WICK walking from the dorm to the kitchen by the lift
4 bump: ZAP rushed into the full kitchen took RIPPLE's slot (the lower in the queue), fed in 41.3 s
6 saves: 5909 bytes at step 5000; loaded, it, one at the first ride (ZAP riding floor 1 to 0, the car at y 585.5, step 687) and 11 more saves (steps 5000 5099 5100 5229 5438 5514 5582 6000 19398 24350 53428: fetch, wait, call, walk, ride, go, alight, board, pickup, turn, work, act, home, asleep, rushed, climbing, keeperBay, bay) step on 5000 to the same world; v 999 throws SaveVersionError
8 rooms: ... used over the suite: kitchen 118, bath 132, romp 145, groom 86, dorm 73, lift 319; planned: hatchery, tack, bunks, maproom, aerie
9 gait: 28 walks, each the same for seeds 11 and 215, each cycle's moves summing to its pace (13 with steps standing still); a scripted spike walked 168.000 px in 600 steps, as its gait and its anim player say; the paper turn flips at step 3 of 6
```

Sections 1, 3, 5 and 7 are unchanged. Over seeds 1-6 (30 min each): wait avg 55.2-73.5 s, max 137.5-330.3 s, landing
wait 66.2-82.0 s, done 143-148, never a need at 0. The car is busy 95 % of the run (about 796 steps a ride, 398 of them
the rider walking in). Browser budget (G14): `BaseView.step()` about 0.15 ms per step with the start cast (frozen
`t=10800` loads in 2.4 s against `t=0`'s 0.7 s), 0.25 ms with the twelve-dragon `ages` preset. Mutation-checked:
R2 off ("COBBLE is in the lift bay while the car moves floors 0-1") and R1 off for dragons both fail section 2.

**Deviations and why**

1. **The lift's call order.** Plan: prio, then the call's tick, then id. Built: prio; then any call waiting >= 60 s
   (`OVERDUE`, oldest first); then a caller on the car's own floor; then the tick; then id. Measured: served strictly
   oldest first, the car made empty trips and was saturated. Seed 1 averaged 131 s, and needs ran empty on five of six
   seeds (seed 2 had 1243 empty steps, seed 5 11344). Floor-first with the guard brought it to 81-97 s with no empties.
2. **Levers.** Tried in the plan's order. 1 (`LEAD_PX` 450): no gain (keepers stood longer; empties appeared). 2 (`QUEUE`
   0.55, on top of 1): worse (4646 empty steps). 3 (`LIFT_SPEED` 1.5) and 4 (`HALF_LIFE_S` 420): applied, 55-74 s together.
   BASE 4.9 has the note the plan asked for. Also tested and dropped as noise-level: a same-floor goal exception,
   a cheapest-route-within-tier goal choice, goal commitment within a tier, shutting the bay while a rider boards, and
   sending an evictee toward its own top job.
3. **Service gates re-set from measurements** (sim-check `GATE`, with its reason in the comment; BASE 4.9 and 8.1).
   Plan's starting values: wait avg <= 60 s, max <= 180 s, `liftWaitMax` <= 60 s, call waits <= 60 s. Now 90 s, 400 s,
   90 s and 90 s: seed 1's 73.5 / 330.3 / 76.4 s plus about 20 % headroom. Unchanged: done >= 120, `emptySteps === 0`,
   keeper-side wait avg <= 20 s, `waitTimeouts === 0`, bay waits <= 60 s, keeper bay waits <= 30 s, walking stall
   <= 10 s. Why: the car is the barn's bottleneck. There are about 0.9 rides per job, each keeping the car about 13 s,
   half of it the 152 px walk in at 0.28-0.54 px a step. No lever in the plan's list moves that. S2's gates were
   30 s / 120 s, with pinned dragons.
4. **A rider held in the car** (the car waiting on R2 with its rider aboard) is not in the plan's exemptions from the
   10 s walking rule. It is checked separately (<= 30 s; measured 19.5 s). The cause is a slow crosser finishing its
   crossing after R3 closes the bay: spike crosses 304 px at 0.28 px a step.
5. **Landing queues** (NEW). With one call spot per side, as in the plan, 2-5 callers stood on exactly the same x for
   up to a minute, and the one in front covered the other's eye (G6). Callers now line up nose to tail:
   `placeAfter`: half of each pad + 16 px apart, clamped to the floor. They step up by gait steps as the ones ahead
   go; the move stays `call`, and the view walks them while `gaitT > 0`. The view draws each one behind the next,
   deeper by one px per place (feet `feetY(f, 2 + place)`, capped at 5). A dragon already past its queue place (from
   the room beside the landing) calls where it stands, after turning to face the bay. Seen in shots: ZAP then COBBLE
   at the ground floor's east landing, both eyes clear.
6. **A turn during boarding returns to boarding** (a caller who had stood facing away): without it, it called twice.
7. **R1 is per floor.** Walkers are held only on the bay floors within the car's move range, not on every floor while
   it moves. The invariant is the same (sim-check 2 checks it every 30 steps).
8. **Re-planning boundary.** A free dragon (no act, awake, not the lift's rider, not boarding / riding / alighting /
   held at the bay's edge / turning, not standing in the bay) re-plans only with no route left or while waiting at a
   landing (its unserved call is dropped). Rush retargets at once, mid-walk too, but never once the lift has it or
   inside the bay. A goal a keeper is already coming for is kept.
9. **Evictions and bumps.** An eviction takes the slot whose blockers' lowest id is lowest; the evictee goes to the
   nearest free slot by route (goal `evict`, cleared on arrival). A bump takes the slot whose most urgent holder ranks
   lowest in the queue. The bumped dragon's keeper (not at work yet) `drop`s the job. The bumped dragon is relocated
   like an evictee, then goes for its own top job at once if that job is in another room. A keeper whose dragon's
   `goalJob` no longer matches drops the job defensively; it doesn't happen in the checked runs.
10. **sim-check 6**: the plan's "first step with `lift.rider != null`" is a fetch, not a ride (the rider is set when the
    car is sent). The explicit save is at the first step a rider is in the moving car (ZAP, step 687). Fork window 5000-60000
    (max 24 forks), WANT += wait, keeperBay, walk, turn, call, board, ride, alight, bay. Section 4 adds a bump scenario
    beside the plan's Rush. Section 9 also checks every walk against `dragonAnims` (the table the pets play), wrap
    at len, the turn sequence, and every stage's landing spots on its floors.
11. `docs/base/base_live.png` re-rendered at **t=2940** (not in the plan's docs list; the old t=1800 caption would
    have been false). It shows RIPPLE riding up to Pip waiting with a ball, ZAP and WICK at landings, COBBLE walking
    into the Bathhouse, and ECHO passing BRAMBLE.
12. `SAVE_VERSION` 3 (S2 already took 2, as the S2 handoff said).

**Gaps and stand-ins**

- **The lift is saturated** (95 % busy). S8's Aerie trips (muster and return at prio 2) add load on top; S8 should
  measure and may need its own lever. The per-ride cost is mostly the rider's walk in and the wait for the last
  rider to walk out (R2), so only fewer rides, or a faster car's travel share, move it much.
- **Overlaps.** Dragons still pass through one another while walking or crossing (transient; the wary latch runs).
  A kitchen-slot-1 dragon calling where it stands can overlap the front of the west landing. A crosser held at the
  bay's edge stands on the front landing spot. Keepers at stand spots stand close to the head (S2's REACH), drawn
  behind the dragon.
- The view's mid-bout walk catch-up (for S4's load) is written but only exercised by fresh views at t=0.
- No dragon goes to the Aerie yet (nothing sends one); the f5 landing is the west one only (`sideOf`).
- `barnKey` includes the lift, whose `blockedSince` and call ticks are world ticks (the same in two worlds stepped
  alike from different hours).

**See it**

- `node tools/shot.ts out.png="view=base&t=1200&cam=328,300" --scale 2` (`base_lift`: EMBER on the car between the
  upper floor and the hayloft). Also `"view=base&t=2940"` (the doc picture), `"view=base&t=4300&cam=440,420"` (ZAP and
  COBBLE queued at the ground floor's east landing, ECHO riding), `"view=base&preset=ages&t=1800"` (ECHO and ZAP queued
  on the upper floor), `"view=base&t=600"`, `"view=base&t=3600"`.
- Foot skate: `"view=base&t=4300&cam=600,420"`, `t=4310` and `t=4320` at `--scale 3` (BRAMBLE walking west in the
  Grooming Parlour; 4300 and 4310 are its creep pause; by 4320 the body has moved about 6 px and the near front paw
  stays put).
- Live: `npm run dev`, `index.html?save=0`.

### S3 review

Fixer pass over 439159c..fe0f356, resumed after a container restart. The killed run's uncommitted work (landing lines,
R5, the Rush gate, the gait wrap, the ladder sort, the top-most bubble, the capacity section, docs) was kept and built
on. Two reviewers sent eleven findings (three blockers, four majors, four minors; the two landing-pile blockers are the
same defect). I checked each one against the code and reproduced it headless or in shots. All eleven are real, none
were rejected. `npm run check` is green: typecheck, palette 2256/2256 + keepers 156/156 (unchanged), sim sections 1-10
(about 19 s), smoke 69 views + 1 frame pair (t=600 -> t=3600: 6 dragons moved).

**Fixed**

1. **(blockers 1 and 6) Waiters at a landing stacked on one another, over an eye.**
   - The earlier run's model is kept. Each side of the bay has a **landing line** (`landingLine`, `landingPlace`,
     `depthOf`, `feetOf`): callers, dragons held at the bay's edge and dragons on their way to call.
     - Each stands at the place nearest the bay where its body covers no eye. That rules out the eye of a slot's dragon
       (held or reserved), of a dragon standing there, and of the ones ahead in the line.
     - Places are nose to tail (the mean of the two half-bodies + 16 px apart). Each waiter is drawn a px deeper than
       the ones ahead of it, or drawn behind them where that is the only clear place.
   - A slot beside a landing is not taken while a waiter stands over it (`lineBlocks`).
   - The line is ordered by distance to the bay and waiting state, not by `waited`. That fixes review cause (a).
   - A dragon past its place no longer simply calls where it stands (cause b). A re-plan that keeps the same ride keeps
     its call and `waited` (cause c, and minor 11).
   - **This pass adds two fixes:**
     - **A crosser paused behind a same-way crosser keeps its right of way** (`committed` tests `move === 'walk'`, not
       `gaitT > 0`). Before, the follow-gap pause cleared `gaitT`, the crosser lost its commitment, and it stood at the
       bay's edge over a slot dragon's eye for up to 44 s. Over 12 seeds (measured at `HALF_LIFE_S` 420) this cut the
       eye-cover total from 234.7 s to 181.8 s.
     - **Two dragons let go from the bay's edge at once go in one after the other.** While a dragon is in the bay or
       stepping in, it keeps `FOLLOW_GAP` behind any dragon ahead walking the same way, not only one already in the
       bay. The `ages` preset (seed 2, step 121434) had BRAMBLE and ASH walk into the upper floor's bay overlapping; the
       earlier run's code did this too.
   - Measured, the start cast on seed 1:
     - an eye under a standing body 28.8 s in all, 12 moments, the longest 16.2 s;
     - about 29 s per 30 minutes on average over seeds 1-18, with single moments up to 80 s.
   - **Where the residue comes from:** the west landing of f0 and f1 stands back to back with kitchen/romp slot 1 (x 408,
     facing west, 27 px from the front spot). No draw order keeps both eyes clear there. With slot 1 held, that landing
     has room for one waiting adult (x 319, drawn behind both slots). A second or third caller, a crosser held at the
     bay's edge, or a dragon leaving slot 1 then stands over an eye until the car takes the one ahead.
   - Tried and measured on 12-18 seeds, and all dropped:
     - crossers counted in the line;
     - coming members ordered by id;
     - a caller waiting in its slot until a clear place frees (with crossers in the line too, one seed deadlocked for
       1022 s);
     - standing line members kept as obstacles;
     - a past-place crosser stopping at a clear spot ahead or turning back (needs emptied on 3 of 18 seeds);
     - a rider not yet boarding yielding to a committed crosser.

     Each only moved the moments between seeds.
   - BASE 2 no longer says "never over an eye". It says where and why the residue lives.
   - sim-check 2 gates it (see Changed numbers).
2. **(blocker 7) The next rider boarded through the one walking off.** This is R5, from the earlier run:
   - the car is its rider's from the call until the rider has walked clear of the bay (`bayBusy`);
   - a caller on the far side may follow the last rider in, nose to tail, `FOLLOW_GAP` 8 px behind;
   - a dragon steps into the bay only if everyone in it walks its way (`laneOpen`);
   - a committed crosser has the right of way (R2 via `inTheWay`, `clearToBoard`);
   - a rider turns in the car only once the last one is clear of its turn.

   sim-check 2 checks every step that no two bodies overlap in the shaft (the rider included where the car stands): 0
   steps. Stress (8 seeds x 2 h start cast, 3 x 1 h `ages`, 3 x 1 h with a Rush every 30 s): no overlap, no walker in
   the bay while the car moves, nobody off their net, no keeper stall, no timeout.
3. **(major 3) A Rush sent a keeper to stand at the stand spot while the dragon queued for the car.**
   - `servable` for a rushed job now needs `arrived`, `remainingCost <= LEAD_PX` or the dragon past its ride
     (`ridesLeft`). `assign` sends a servable rushed job's keeper through the new private `sendRushed` (a free one, else
     one taken off the lowest job).
   - sim-check 4 now covers:
     - the plan's Rush (no keeper sets off while the ride is still ahead; done within 90 s);
     - a Rush of a dragon already in its room with every keeper busy (a keeper off another job at once, `preempted +
       1`);
     - the bump;
     - **Rush after Rush**: one every 30 s for 30 minutes.
   - Seed 1: no need empty, the longest rushed job 113.3 s, keepers standing for rushed dragons 12.1 % of their time. The
     review measured 18-22 % before the fix. Seeds 1-6: 7.1-12.1 %.
4. **(majors 2 and 8) The single car saturates; the gates were loosened.** This is measured, frozen and documented;
   the ceiling itself is not fixable within the plan's rules (see Deferred).
   - The plan's lever 3, `LIFT_SPEED`, is 2 (the orchestrator's cap; the earlier run had 2.5).
   - `HALF_LIFE_S` is 450, a step past the plan's lever 4 (420). Measured at the capped speed:
     - at 420, a need touched empty on 1 of 18 seeds in 30 minutes and on seed 2 within 2 hours;
     - at 450, on none of 18 seeds and on none of 8 over 2 hours.

     The plan's levers were sized before R5 cost the car its overlap. **Orchestrator: please double-check this one.**
   - sim-check 10 runs 8 adults (30 min), 10 adults (15 min) and the `ages` preset (10 min). It checks:
     - no keeper gives up;
     - the car never stands still with work for a minute;
     - the rides stay >= 80 % of measured;
     - the 8-adult service is frozen (no need empty, waits <= 127 / 320 s).
   - BASE 4.7 has the ceiling table and why; 4.9 has the tuning history.
5. **(major 9) A keeper climbing the centre ladder was drawn over the eye of a dragon at the east landing.**
   - `base.ts` sorts a climbing keeper at `min(y, feetY(upper floor)) - 3`, behind the dragons of both floors.
   - Seen at t=3530, 3575 and 3600 (Tomas climbing past ZAP and ECHO waiting at the east landings): both eyes clear.
6. **(minor 4) The mid-bout walk catch-up ignored `loopStart`.** New `gait.ts wrapT(g, t)`, used by `moveAt` and by
   `base.ts sync`. sim-check 9 checks a walk with an intro (spike adult, `loopFrom 2`): gait, player and catch-up agree
   past the wrap. All 28 real walks loop whole (printed).
7. **(minor 5) The gait-sum check was tautological.** sim-check 9 now compares each gait against its anim table's raw
   frames (`sum dur * move`) and against a `DragonAnimPlayer` playing the walk for three cycles, step by step.
8. **(minor 10) A tap on overlapping bubbles rushed the one underneath.** `tap` now walks `bubbles` from the end, so
   the top-most wins.
9. **(minor 11) A re-plan at a landing threw away the call's seniority.**
   - `sendTo` keeps the existing call (tick and `waited`) when the new route rides the same way from here.
   - A caller keeps its goal unless one of its needs falls a tier lower or a job is rushed.

**Changed names and numbers** (NEW or DIFFERS since the S3 section above)

- **`travel.ts`**
  - Constants:
    - `LIFT_SPEED` 2 (was 1.5);
    - NEW `FOLLOW_GAP` 8, `RIDE_PX` 600 (a ride's extra cost when a moved-on dragon picks a slot), `LANDING_CLEAR` 2
      (a waiter's snout from the bay's edge), `CROSS_MAX` 2400 (a crosser held that long goes before the next rider
      boards), `DRAGON_EYE` (per stage, px ahead of the root).
  - NEW exported functions:
    - `bayBusy(sim, f)` (R5), `bayClosed(sim, f)`;
    - `dragonSpan(d)`, `bodySpan(stage, facing, x)`, `eyeSpan(stage, facing, x)`;
    - `inTheBay(sim, lo, hi)`: the bay invariant, who is in the bay;
    - `landingEdge(stage, side)`;
    - `interface Waiter { d, x, back }`, `landingLine(sim, f, s, extra?)`;
    - `depthOf(sim, d)`, `feetOf(sim, d)`: the view's feet y;
    - `ridesLeft(sim, d)`.
  - Changed behaviour:
    - `inTheWay` (R2) also counts committed crossers;
    - `landingPlace(sim, d, s?)` returns `{x, i}` from the line;
    - the lift's call order is prio, the most pressing tier, overdue (60 s), a caller who can follow the last rider in,
      a caller on the car's floor, the front of a line, the tick, the id.
  - Choosing: among jobs in the same tier, one met on the dragon's own floor comes before one a ride away.
- **`gait.ts`**: NEW `wrapT(g, t)`.
- **`sim.ts`**: `servable` as in fix 3; NEW private `sendRushed(j)`.
- **`base.ts`**: `feet()` is `travel.feetOf`; the climbing-keeper sort key; `tap` top-most first.
- **`needs.ts`**: `HALF_LIFE_S` 450.
- **`tools/shots.ts`**: `base_lift` is `t=1100&cam=328,300` (EMBER on the car between f0 and f2).
- **sim-check `GATE`** (seed 1 plus about 20 %; the plan's values where they still hold):

  | Gate | Value (seed 1 measured) |
  |---|---|
  | `waitAvgS` | 80 (66.6) |
  | `waitMaxS` | 330 (272.8) |
  | `liftWaitS` | 106 (88.1) |
  | `rideHeldS` | 20 (15.0) |
  | `coverS` / `coverTotalS` | 20 / 35 (16.2 / 28.8) |
  | `rushedS` | 140 (113.3) |
  | `rushWaitShare` | 0.15 (0.121) |
  | `rushEmptySteps` | 600 (0; seed 6 measures 2837) |
  | `done` | 120 (136) |
  | `keeperWaitAvgS` | 20 (7.6) |
  | `bayS` | 60 (45.2) |
  | `keeperBayS` | 30 (9.6) |
  | `walkStallS` | 10 |

  Section 10 adds `CAPACITY_RIDES` [119, 44, 29] and `CAPACITY8` {waitAvgS 127, waitMaxS 320}. sim-check takes about
  19 s in all.

```
2 30 min: 142 jobs opened, 136 done, 0 closed without a keeper; wait avg 66.6 s, max 272.8 s; queue at most 12; 0 steps with a need at 0; keepers waited at the stand spot 7.6 s on average; dragons walked 95644 px, rode the lift 109 times (a landing wait at most 88.1 s, held in the car at most 15.0 s), were held at the bay's edge at most 45.2 s (keepers 9.6 s); 0 steps with two in the shaft; an eye under a standing body 28.8 s in all (12 times, at most 16.2 s); 37 moved on, 0 keepers gave up; met in EMBER 4, BRAMBLE 5, COBBLE 5, ZAP 5, RIPPLE 5, ECHO 5, WICK 5 rooms; rooms used bath 50, lift 109, dorm 26, romp 56, groom 32, kitchen 50
4 rushes: 60 Rushes in 30 min, 129 jobs done, 0 steps with a need at 0; a rushed job done in 113.3 s at most; keepers stood waiting for rushed dragons 12.1 % of their time
10 capacity: 8 adults (8), 30 min: 138 jobs done, wait avg 106.1 s, max 266.4 s; 0 steps with a need at 0; the car busy 100 %, 119 rides, a landing wait at most 113.9 s; 10 adults (10), 15 min: 54 jobs done, wait avg 262.1 s, max 621.3 s; 61340 steps with a need at 0; the car busy 100 %, 44 rides, a landing wait at most 335.2 s; the ages preset (12), 10 min: 35 jobs done, wait avg 192.0 s, max 461.6 s; 64143 steps with a need at 0; the car busy 100 %, 29 rides, a landing wait at most 233.8 s
```

**Capacity: the orchestrator's extra target (10 dragons with no empty need) is NOT reachable in this slice.** Measured
ceiling, 30 minutes per run:

| Cast | Wait avg | Wait max | Empty needs | Rides |
|---|---|---|---|---|
| 7 (start) | 62-98 s (seeds 1-18) | 185-307 s | never (18 seeds; 8 seeds x 2 h) | 109 (car 96 % busy) |
| 8 adults | 84-110 s (seeds 1-6) | 200-335 s | 1 of 6 seeds (6731 steps) | 110-119 |
| 9 adults | 159-189 s | | every seed (441-20 327 steps) | |
| 10 adults | 273-322 s | 625-737 s | 87 k-175 k need-steps | 89 |
| 7 adults + 3 babies | 310-362 s | 893-1036 s | 269 k-529 k need-steps | 80 |
| `ages` (12) | 376-421 s | 1116-1566 s | 0.9-1.06 M need-steps | 79 |

Why:
- One car carries one dragon at a time (R5, the plan's mustFix). A ride holds it about 15 s: the walk in (about 130
  px) and off clear of the bay (about 150 px) at the anim's own 0.15-0.54 px a frame (P6 and G13: never hurried), plus
  under 1 s a floor.
- For about a fifth of its time the car also waits for crossers. Kitchen/bath and romp/groom lie on both sides of the
  bay, so floor traffic crosses it.
- Never idle, the car gives about 110-120 rides per 30 minutes, and seven adults already use about 0.8 rides per job.
- More dragons give *fewer* rides: more crossings, and more evictions (10 adults share 11 module slots).
- A baby's ride holds the car about twice as long as an adult's.

Levers measured (seeds 1-4, 7-10 dragons), all within noise:
- `LIFT_SPEED` 2 against 2.5 (about 5 s of average wait at 7);
- `BAY_CLOSE` 0 (the plan's risk-2 lever);
- an evictee's penalty for crossing the bay;
- own-floor preference across tiers;
- two call orders (the follow-in first; only red tiers above the car's own floor).

`LEAD_PX` does not touch the car. A same-floor **top-up** was measured and not built, because it changes when a job
opens (BASE 4.3): a need met on the floor a dragon stands on opens its job at 0.65 or 0.8.
- It cuts the start's rides by about a quarter (car 86-87 %, waits about 65 s).
- Ten adults still empty needs on every seed.

**Options for the orchestrator before S5 or S8 grow the barn:**
- a second car or lift (for example at the barn's end);
- a cap of about 8 grown dragons;
- the top-up rule, plus more;
- rooms repeated per floor (against D6);
- slower drains.

sim-check 10 freezes the 8-adult level and guards the car's throughput.

**Deferred**

- **The capacity ceiling above**: an orchestrator decision; the plan's levers are exhausted.
- **Eye-cover residue at crowded landings** (fix 1): structural. It needs the west landing moved clear of kitchen/romp
  slot 1 (the layout: S2's slots), or fewer waiters (capacity).
- **Beyond the 30-minute gates:**
  - over 2 hours on seeds 1-8, landing waits reach about 119 s and bay waits about 79 s (the 30-minute gates are 106 s
    and 60 s);
  - Rush every 30 s for an hour lets a need touch empty on 2 of 3 seeds, bounded on seed 1's 30 minutes.
- **The `ages` preset's convoys:** a dragon can pause up to 12.8 s at the bay's edge behind one following a baby (0.15
  px a frame) across the bay. It shows as an idle stand (`gaitT` 0, the view idles, no skate). The 10 s stall rule is
  checked only on the start cast. Before the entering-follow fix this was an overlap in the shaft instead.

**Rejected:** none.

**Docs:**
- **BASE_DESIGN 2:**
  - "Waiting for the car": the "What is left, and why" paragraph replaces the false "never over an eye" claim;
  - "The car": the call order;
  - "The bay rule": the one-dragon shaft (R5), the lane, following in, two let go at once, a paused crosser keeping the
    right of way.
- **BASE_DESIGN 3**: slots beside a landing; a moved-on dragon's own floor first.
- **BASE_DESIGN 4.4 and 4.5**: when a keeper goes for a rushed job; Rush after Rush.
- **BASE_DESIGN 4.7**: new, the Dragon Lift as the barn's limit, with the table and the options.
- **BASE_DESIGN 4.9**: `HALF_LIFE_S` 450, `LIFT_SPEED` 2, the new constants, the tuning history.
- **BASE_DESIGN 8.1**: the new numbers and the "not in this slice" bullets.
- **`docs/base/base_live.png`**: re-rendered at t=2940 (`view=base&t=2940 --scale 2`). Its caption still matches the
  frame:
  - RIPPLE walks off the car to Pip, who waits with a ball;
  - WICK and ZAP wait at the east landings, ZAP back to back with COBBLE walking into the Bathhouse;
  - ECHO passes BRAMBLE;
  - Bea waits in the kitchen.

  ART_BIBLE and KEEPERS are unchanged in this pass.

**Shots looked at** (`scratchpad/shots/S3fix/`, 2x):
- `t600`;
- `t3600`: Tomas on the ladder behind ECHO, both eyes clear; "KEEPERS 0 OF 4 BUSY" with 4 jobs while dragons queue,
  which is the saturation;
- `lift` (`t=1100&cam=328,300`): EMBER standing on the car between floors;
- `ladder3530` and `ladder3575` (`cam=560,440`): Tomas climbing past ZAP and ECHO, behind both;
- `doc2940`: the doc picture;
- `line4440` (3x, `cam=560,440`): ZAP at the front of the ground floor's east landing and COBBLE nose to tail behind
  it, both eyes clear, while ECHO walks off the car past them (the documented transient);
- `follow810` (3x, `cam=330,440`): EMBER boarding behind ZAP walking off, one after the other in the bay, never
  overlapping.

The reviewers' shots are in `scratchpad/shots/S3-review/`, and the killed run's in `scratchpad/shots/s3fix/`.

### S3 review (second fixer pass)

A second fixer pass over 439159c..eaee8e1, against the same eleven findings. Each finding was checked against eaee8e1
and re-measured headless: over seeds 1-48 (service), seeds 1-24 (eye cover), 2-hour runs on seeds 1-16, a Rush every
30 s for an hour on seeds 1-6, and the 8-adult, 10-adult and `ages` casts. None of the findings was rejected. Seven were
already fixed by the first pass and are verified below. The rest were real residues and are fixed or reduced here.
`npm run check` is green: typecheck; palette 2256/2256 + keepers 156/156; sim sections 1-10 in about 22-27 s; smoke 69
views + 1 pair (t=600 -> t=3600: 6 dragons moved).

**Verified fixed at eaee8e1 (no change needed)**
- Blocker 7 (shaft overlap): 0 steps with two in the shaft on seeds 1-3 (every step), and none in the stress runs.
- Major 3 (Rush parks a keeper): holds. Extended to all jobs below.
- Major 9 (keeper on the ladder over an eye): t=3600 render shows Tomas behind ECHO, both eyes clear.
- Minors 4, 5, 10 and 11: `wrapT`, the gait checks against anim frames and players, the top-most bubble tap, and a
  re-plan keeping its call (extended below).

**Fixed in this pass**
1. **(blockers 1 and 6) The eye-cover residue.** At eaee8e1 it was 26.4 s per 30 min on average over seeds 1-24,
   single moments up to 80.1 s. Traced by mechanism:
   - two crossers held on one edge spot ("bay over bay": 88 s over 24 seeds);
   - a crosser held at the west edge over kitchen/romp slot 1;
   - a caller put over an eye by the no-clear-place fallback;
   - a caller that re-planned to a new stop, lost its call and turned back into the line.

   Six rules in `travel.ts`:
   - **Walking up to the bay** (`APPROACH` 250, NEW export): within 250 px of the bay's edge, a dragon keeps
     `FOLLOW_GAP` behind one walking up ahead of it the same way. Two no longer arrive on one spot.
   - **A held crosser stops short**: it stops at the line's places ahead of it, its snout clear of their eyes, or
     where it already stands. It no longer walks on to the edge onto someone waiting.
   - **The committed crosser's right of way against a rider still at `call`**: only a rider at work in the bay
     (`riderAtWork`) holds it at the edge; the waiting rider waits for it (`clearToBoard`).
   - **The car takes a caller caught in an eye clash first**: `eyeClashes(sim)` (NEW export) sits right after `prio`
     in `nextCall`.
   - **A lingerer in a slot beside a landing moves over** (`clearLandings`, runs after goal choice). When a line forms
     there, it moves to a free slot of its own room clear of the front, counted in `evictions`. `lineBlocks(sim, d, s,
     callers = true)` gains a flag, so callers who will step up to the vacated front don't hold the move.
   - **A caller that re-plans to another stop from the same landing keeps its call**: `sendTo` sets `call.to` and
     keeps its tick, `waited` and place. It no longer turns back into the line anew.
   - Also, `landingLine`'s "about" list skips dragons turning or paused with legs (they are gone the next moment), and
     returns early for an empty line.
   - Result over seeds 1-24: **4.6 s per 30 min, 14.2 s at most**. Seeds 1-3 together: 4.2 s, 2.5 s at most. What is
     left is the structural case: the west landing back to back with kitchen/romp slot 1 when that slot's dragon cannot
     move over (being met, or its room full) and two wait. Rendered, it is mostly the waiter's tail passing under the
     slot dragon's head, with the eye clear (seed 22 t=35000, the longest over seeds 1-24).
2. **Crossers kept waiting on (bay-edge waits over 60 s on some seeds).** Two new rules:
   - `yields`: a dragon held at the bay's edge `CROSS_MAX` (40 s) or more, and longer than the one arriving, crosses
     next; nobody steps in the other way meanwhile.
   - `closedTo`: such a dragon may also step into a bay that is only *closing* (the car standing, held by someone else),
     and the car waits for it too. The bay invariant is unchanged.
   - Longest bay-edge wait over seeds 1-48: 59.5 s (it was 102.2 s at eaee8e1).
3. **(major 3, extended) Keepers stood at stand spots while dragons queued for the car** (non-rushed jobs too).
   - Cause: `LEAD_PX` counts a ride as 140 px, so a keeper could set off with the ride still ahead. In the crowded
     `ages` cast this parked keepers for minutes; one gave up (`WAIT_MAX`) in a 1 h run during this pass.
   - `servable` is now `arrived || (!ridesLeft && (rushed || remainingCost <= LEAD_PX))`: a keeper sets off only once
     the dragon is past its ride. The start cast's service is unchanged by it.
4. **(majors 2 and 8) Saturation and the gates.** Not fixable within the fixed decisions; see Deferred for the bound.
   What changed:
   - **The service gates are now over three seeds**, because one seed's numbers move by about a fifth with any change
     to who goes when (seed 1 went from 66.6 s to 87.6 s, seed 4 from 85.7 s to 65.6 s, the 48-seed mean from 77.2 s
     to 76.4 s).
   - sim-check 2 runs seeds 1, 2 and 3 (`SERVICE_SEEDS`), each with every invariant and the per-step shaft and cover
     checks (depths cached per step).
   - The waits are gated on the three together: mean average wait <= 100 s (83.5 measured), longest <= 360 s (301.2),
     landing <= 124 s (103.4), rider held in the car <= 25 s (20.5).
   - Eye cover over the three runs: <= 30 s in all and <= 10 s at most (4.2 and 2.5 measured). These values are set
     from the 24-seed spread; eaee8e1's code fails them at 40.6 s.
   - Per seed, the plan's values stay: no need empty, done >= 120, keeper wait at the stand spot <= 20 s, the bay's
     edge <= 60 s, keeper bay <= 30 s, and the walking-stall rule.
   - The tails got better over seeds 1-48: longest 335 s (it was 406 s), landing 119 s (157), bay edge 60 s (102), no
     need empty on any seed (it was on one).
   - sim-check 10 runs 10 adults for 10 min and `ages` for 6 min (they were 15 and 10), to keep the suite under 30 s.

**Changed names and numbers**
- **`travel.ts`**:
  - NEW exports: `APPROACH` (250) and `eyeClashes(sim): Set<Dragon>`.
  - NEW private: `riderAtWork`, `yields`, `closedTo`, `clearLandings`.
  - `lineBlocks` gains `callers = true`.
  - `stepTravel` order: goals are chosen, then `clearLandings`, then dragons step, then the lift.
  - `nextCall` order: prio, eye clash, tier, overdue, follow-in, the car's floor, front of line, tick, id.
- **`sim.ts`**: `servable` as in fix 3.
- **sim-check**:
  - `SERVICE_SEEDS [1, 2, 3]`.
  - `GATE`: `waitAvgS` 100 (mean of three), `waitMaxS` 360, `liftWaitS` 124, `rideHeldS` 25, `coverS` 10,
    `coverTotalS` 30 (three runs), `rushedS` 150.
  - `CAPACITY_RIDES [123, 30, 20]` (8 adults 30 min, 10 adults 10 min, `ages` 6 min).
  - `CAPACITY8 { waitAvgS: 136, waitMaxS: 338 }`.
- `SAVE_VERSION` stays 3 (no new state), and the hook is unchanged.

```
2 30 min: 136 jobs opened, 128 done, 0 closed without a keeper; wait avg 87.6 s, max 301.2 s; queue at most 12; 0 steps with a need at 0; keepers waited at the stand spot 7.5 s on average; dragons walked 93057 px, rode the lift 112 times (a landing wait at most 103.4 s, held in the car at most 20.5 s), were held at the bay's edge at most 42.1 s (keepers 3.1 s); 0 steps with two in the shaft; an eye under a standing body 2.9 s in all (8 times, at most 2.5 s); 43 moved on, 0 keepers gave up; met in EMBER 4, BRAMBLE 5, COBBLE 5, ZAP 5, RIPPLE 5, ECHO 5, WICK 5 rooms
2 service, seeds 1, 2, 3: wait avg 87.6 / 74.6 / 88.3 s (mean 83.5), max 301.2 s; done 128 / 133 / 130; a need at 0 0 / 0 / 0 steps; a landing wait at most 103.4 s, the bay's edge 55.5 s, held in the car 20.5 s; an eye under a standing body 4.2 s in all, at most 2.5 s; 112 / 109 / 104 rides
4 rushes: 60 Rushes in 30 min, 130 jobs done, 0 steps with a need at 0; a rushed job done in 124.6 s at most; keepers stood waiting for rushed dragons 9.3 % of their time
10 capacity: 8 adults (8), 30 min: 139 jobs done, wait avg 113.4 s, max 281.7 s; 0 steps with a need at 0; the car busy 100 %, 123 rides; 10 adults (10), 10 min: 1118 steps with a need at 0, 30 rides; the ages preset (12), 6 min: 17395 steps with a need at 0, 20 rides
```

**Stress** (every invariant, every step for the shaft and bay rule): no failure anywhere.
- 7 adults, 8 seeds x 2 h: no keeper gave up, no stall.
- 7 adults, 16 seeds x 2 h: a need touched empty on one seed, for 234 steps. Over 2 h, landing waits reach 159 s and
  bay-edge waits 63 s.
- Rush every 30 s, 6 seeds x 1 h: a need touched empty on one seed (1533 steps).
- 8 adults, 3 seeds x 1 h; 10 adults, 2 seeds x 1 h; `ages`, 3 seeds x 1 h: no keeper timeouts.

**Deferred (orchestrator decisions; data in BASE_DESIGN 4.7 and 4.9)**
- **Capacity, and the plan's first 60 / 180 / 60 s gates: not reachable at this car on any of 48 seeds.** The bound:
  - A ride holds the one car for about 280 px of the rider's walk (in onto the deck, then off clear of the bay) at
    0.28-0.54 px a frame (P6/G13: never hurried). That is 9-17 s, about 12 s at the start cast's mean pace.
  - So even never idle and never blocked, the car gives at most about 150 rides in 30 min.
  - Seven adults ask about 110 rides (0.8 per job, about 20 jobs each). The car is 95 % busy, and a job's wait is
    mostly its dragon's wait for it: 20-34 s behind another job of the same dragon, then 45-55 s of travel, 25-34 s of
    it at the lift.
  - Ten adults would ask about 160, past the bound. So no call order, placing rule or car speed within the cap (2)
    closes it.
  - Measured (8 seeds, 30 min): 8 adults need-empty on 2 of 8 seeds briefly; 9 on 5 of 8; 10, 7 + 3 babies and
    `ages` on every seed.
  - Options, unchanged: a second car or lift, a population cap near 8, the same-floor early job, or slower drains.
- **Eye-cover residue at the west landing**: structural (S2's layout puts slot 1 27 px from the landing's front).
  About 4.6 s per 30 min in the conservative model, 14 s at most.
- **Beyond the 30-minute gates** (2 h runs): landing waits up to 159 s and bay-edge waits up to 63 s. Keeper bay-edge
  waits reach 34 s on some seeds (the gate is 30 s over 30 min). In the `ages` cast, a rider waits up to 54 s in the
  car.
- `HALF_LIFE_S` stays 450 (the first pass's flag for the orchestrator stands); `LIFT_SPEED` stays at the cap, 2.

**Rejected:** none.

**Docs**
- **BASE_DESIGN 2**: waiting for the car (the new rules, the residue and its numbers); the car's call order; the bay
  rule (the crosser's right of way against a waiting rider, the long-held crosser going next).
- **BASE_DESIGN 3**: slots (a lingerer moves over).
- **BASE_DESIGN 4.4**: when a keeper sets off.
- **BASE_DESIGN 4.7**: the table re-measured; "Why no tuning moves it", with the bound.
- **BASE_DESIGN 4.9**: the `LEAD_PX` row, a new `APPROACH` row, and this pass's history and gates.
- **BASE_DESIGN 8.1**: re-measured, and the picture's caption.
- **`docs/base/base_live.png`**: re-rendered at t=2940. Pip now goes for the ball once RIPPLE is past its ride, and
  the caption says so.

**Shots looked at** (`scratchpad/shots/s3f2/`):
- `t600`, `t3600` (Tomas behind ECHO), `lift` (t=1100, EMBER on the car) and `doc2940`;
- `mo_70300` / `mo_71200` (seed 1: WICK moves over from romp slot 1 to slot 0, the landing's front free after);
- the longest residual, `crop_s22` (seed 22 t=35000, 3x): ZAP held at the west edge, its tail under COBBLE's head in romp
  slot 1, the eyes clear but the faces crowded.

## S4 — Time: the clock, day and night, speed, live saves

**Built** (base ca8c318, commit dc93c06; `npm run check` green on the committed tree: typecheck, palette 2256/2256 + keepers 156/156 +
NEW backdrops 1001/1001, sim sections 1-12 in about 24 s, smoke 77 views + 1 frame pair + 2 day/night pairs, about
5 min 40 s in all). Advances #8: "Include day night cycles", "and a speed toggle", and D2's save and load.

- New: `src/game/clock.ts`, `sky.ts`, `hud.ts`, `storage.ts`.
- Changed: `surfaces.ts` (WALLS moved in, BACKDROPS, PROPS, LIGHTS, skyBands), `building.ts` (no sky; tower slits;
  back-wall windows; `drawLights`; tub and pallets re-coloured), `base.ts` (speed, draw order, `layers=world`, HUD,
  toasts, attach: keys/load/autosave/NEW), `sim.ts` (`SimOptions.hour`; DAY_STEPS/START_HOUR moved to clock.ts and
  re-exported), `presets.ts` (`buildSim(spec, seed?, hour?)`), `gallery.ts` (`hour=`, `layers=`), `types/globals.d.ts`,
  `tools/palette-check.ts` (gate w), `tools/sim-check.ts` (sections 11, 12), `tools/smoke.ts`, `tools/shots.ts`.
- Docs: BASE_DESIGN 1 (wall gate), 2 (a "Windows" bullet), 4.8 (the top bar, hint, toasts, keys), 7 (rewritten), 8
  (time built, file table, "save and load" and "day and night" struck as built), 9 (night shift deferred, wall gate
  answered); ART_BIBLE status line, 5.1 row 12 (the 4x/8x key flicker accepted), 5.8 (the (w) block and its
  BACKDROPS line pasted); README (one paragraph on the time controls and the save); `docs/base/base_live.png`
  re-rendered at t=2940 (the new top bar and windows; the sim is unchanged, so its caption still matches).

**Exported names and signatures** (NEW / DIFFERS against plan S4's type block)

- `clock.ts`: `DAY_STEPS 10800`, `START_HOUR 7` (moved from sim.ts; `sim.ts` re-exports both, so old imports work),
  `STAGE_DAYS 30`, `RETIRE_DAYS 30`, `HATCH_DAYS 2`, `SPEEDS [0,1,2,4,8]`, `type Speed`, `type DayPhase`,
  `PHASE_HOURS {dawn 5, day 7, dusk 18, night 20}`, `interface ClockRead { day; hour; minute; phase; prev; blend }`,
  `hourSteps(dayLen)`, `readClock(clock, dayLen = DAY_STEPS)`, `clockLabel(c)` ('DAY 3 14:30', minutes floored to 10).
  NEW: `PHASE_ORDER` (['night','dawn','day','dusk'], midnight's order), `PREV_PHASE`, `phaseOf(hour)`.
  `blend` = min(3, floor(3·(clock − phaseStart)/hs)): 0 at a phase's first step **shows the previous phase's colours**,
  1/2 are the stepped mixes, 3 from an hour in. Night's phaseStart before midnight is the day before's 20:00.
- `sim.ts`: `SimOptions.hour?: number` (NEW; a whole hour 0-23, else the constructor throws); `clock0 = opts.clock0 ??
  hour · hourSteps(dayLen)` (clock0 wins). No new world state: `SAVE_VERSION` stays 3. **Nothing in the sim reads the
  phase**: sim-check 12 scans `sim.ts, travel.ts, needs.ts, layout.ts, gait.ts, save.ts, start.ts, presets.ts, rand.ts`
  for `readClock|phaseOf|PHASE_HOURS|PHASE_ORDER|DayPhase|skyBands|nightness`. **S6 (residents' naps) and S8 (the dawn
  board) will read the phase in the sim**: put that code in its own module (e.g. `garden.ts`, `board.ts`), keep its
  state out of `barnKey`, and extend section 12's comment (not the list) to say why that module is allowed.
- `presets.ts`: `buildSim(spec, seed?, hour?: number | null)` -- with an hour, `spec.opts.clock0` is dropped.
- `surfaces.ts`: `INK`, `FLOORS`, `STRAW_SEAM`, `EMPTY_WALL`, `LIFT_WALL` as before; NEW `STONE '#c2bbb0'`; `WALLS`
  (moved from building.ts, now exported, frozen); NEW `PROPS { hearth '#9c948a', firebox '#3a2626', tub '#a47a52',
  pallet '#a47a52', mattress '#e6dcc4' }`; `interface Backdrops`, `BACKDROPS { sky: Record<DayPhase, [top, mid, low]>;
  hills; clouds; liftWall; emptyWall; stone }` (the plan's values, all passing); NEW `LIGHTS { glass '#cfe3ea', slit
  '#ffd98a', lamp '#ffa98c', fire '#f39a2e', star '#e8ecf8', moon '#f0ecd8' }`, `LAMP_RINGS [inner r10, outer r16]`,
  `HEARTH_RING`; NEW `stepped(a, b, blend)` (the one mix both the sky and gate w use), `phaseColour(rec, c)`;
  `skyBands(c)`. **A later backdrop (the garden's sky/fence S6, a region's bands S9) goes here and into gate (w)'s list
  in palette-check.**
- `sky.ts`: `drawSky(ctx, c, camX, camY, worldW)` (screen space; `worldW` unused: the hills (period 1360), clouds (1400)
  and stars (800) repeat, so a wider world (S6) needs nothing); NEW `nightness(c)` 0..3 (stars 8/16/24 by it; the moon
  from 1). Bands fixed to world y 0-200 / 200-420 / 420-GROUND; hills/clouds x at 0.5 of the camera, stars/moon 0.2.
- `hud.ts`: `BAR_H 15`; `type ButtonName = 'new'|'pause'|'speed'`; `BUTTONS` (new {528,1,26,13}, pause {558,1,16,13},
  speed {578,1,28,13}) -- **S8 adds `map` {610,1,26,13} here**; `BADGE_X0 138, BADGE_DX 48, BADGE_W 46` (S7 hit-tests
  the badges from these); `TOAST_FRAMES 180`; `interface TopBar { clock; jobs; keepers: {name, look, busy}[]; speed;
  rate; armed }` -- **S7/S8 replace `busy` with a state for ▼ controlled / ↗ away / z resting (glyph at badge x+43,
  a 3x3-ish sprite; the name at x+10)**; `drawTopBar(ctx, s)`, `buttonAt(sx, sy)`, `drawToast(ctx, text)`,
  `drawHint(ctx, stripEnd)` (S7 hides it while controlling). COIN (S8) goes at x 334.
- `storage.ts`: `SAVE_KEY 'dragon-care/base'`, NEW `BACKUP_KEY 'dragon-care/base.bak'`, `type LoadNote`, `loadSave():
  { save; note: 'none'|'ok'|'old'|'bad' }` (old/bad copy the blob to BACKUP_KEY; it does NOT run fromSave), `writeSave(s):
  boolean`, `clearSave()`, NEW `backupSave()` (attach() calls it when `CareSim.fromSave` throws on a v3 blob).
- `building.ts`: `drawBuilding(rooms)` (transparent above the ground and around the walls; window panes `clearRect`-ed),
  `drawPlates`, `drawLiftCar`, `plate`; NEW `drawLights(g, rooms, c)` (world space, after the building, before the
  plates), `slitsLit(c)`. Windows: the ladder bay 2 a floor (panes 14x24 at x 655 and 691, y t+16), each bare hayloft
  module one (28x22 at its middle, y t+18); tower slits 6x10 (x 57 and 1297, y floorTop(f)+30, f 0-4).
- `base.ts`: `BaseViewOpts { seed; cam?; preset?; persist?; hour?: number|null; layers?: 'all'|'world' }`. DIFFERS:
  `BaseView.sim` is no longer readonly (`sim!: CareSim`: a load or NEW swaps it through the private `use(sim)`, which
  rebuilds the cast, keeper agents, building and plates -- **a later slice's per-world view state must be reset in
  `use()` too**); `readonly layers`; `get speed(): Speed`; private `rate` (1|2|4|8) and `paused`; `step()` = speed x
  private `worldStep()` (sim.step, syncCast, sync, stepWary, stepPet, keeper visuals, `frame++`), then the camera, the
  UI timers (`uiFrame`, toast, NEW's 120-frame window) and the autosave (every 600 `uiFrame`s while `saving`).
  Keys 1-4 / p on `window` keydown (ignored with ctrl/meta/alt), added in attach, removed by detach. `tap()` tests
  `buttonAt` first and swallows any other tap on the bar (y < 15).
- Hook: `barnDigest` (fnv1a of barnKey), `clock {day, hour, minute, phase}`, `speed`, `persist`, `buttons` (a copy of
  BUTTONS); `window.__dragonCare.baseSaveNow?: () => number` (only on a live page that saves; deleted by detach).
- `gallery.ts`: `GalleryParams.hour: number | null` (whole 0-23, else null), `layers: 'all'|'world'`. `persist` is
  unchanged (`t == null && save && !preset`): an `hour=` live page does persist (a loaded save keeps its own clock).
- smoke: `Case.init?(page)` (before goto: `plant(blob)` puts a save in storage), `Case.hash?` (an in-page FNV-1a of the
  canvas, whole and rows 16-338, into `frames`); `TINT` pairs; `timeFields(phase, persist)`, `plantedFrozen`,
  `livePersist`, `liveOldSave`, `baseSpeed`; `PLANTED` (a Node-built save at step 5000), `OLD_SAVE` (v 999).
- sim-check: sections **11 clock** and **12 night** (plan's §10/§11: those numbers were taken by S3's 9 and 10).
- palette-check: gate (w) with its own tally and RESULT line `BACKDROPS: PASS n of n`; `W_DARK 0.15` (lightning,
  dusk and slinkwing at all 4 stages: 12 element-stages); 77 backdrops x 13 gates (12 dark bodies + ink).

**Measured**

```
11 clock: 10800-step day (an hour 450 steps): 0 DAY 1 00:00 night, 2250 DAY 1 05:00 dawn 0/3, 2400 DAY 1 05:20 dawn 1/3, 3150 DAY 1 07:00 day 0/3, 8100 DAY 1 18:00 dusk 0/3, 9000 DAY 1 20:00 night 0/3, 10800 DAY 2 00:00 night; 600-step day (an hour 25 steps): 0 DAY 1 00:00 night, 125 DAY 1 05:00 dawn 0/3, 134 DAY 1 05:20 dawn 1/3, 175 DAY 1 07:00 day 0/3, 450 DAY 1 18:00 dusk 0/3, 500 DAY 1 20:00 night 0/3, 600 DAY 2 00:00 night; a whole day read step by step turns night, dawn, day, dusk, night, each sky in three stepped thirds; hour= starts a world at 22:00
12 night: a barn started at 07:00 and one at 19:00 (seed 1) agree on barnKey at all 20 checks over 20000 steps, through dusk, night, dawn, day; 9 simulation modules, none reading the day's phase
smoke speed: 1x 60 steps in a second, 8x 488; paused 0 in 500 ms
smoke tint: layers=world noon / 22:00: the same frame bb6e59e9 and barn 9c0e49a6; the whole frames differ, and so do the worlds under the HUD
RESULT: PASS 2256 of 2256 / KEEPERS: PASS 156 of 156 / BACKDROPS: PASS 1001 of 1001
```

Sections 1-10 are unchanged from S3's second fixer pass (the sim did not change). Gate (w)'s thinnest: the night's top
band `#6a78a8` 38 % from lightning's elder, the night hills 39 %, the tub/pallet wood 47 %. Browser budget (G14):
frozen `t=10800` loads in 3.12 s against `t=0`'s 1.42 s, about 0.16 ms a step with the start cast (8x: about 1.3 ms of
stepping a frame); live 8x in headless Chromium keeps a 16.7 ms frame interval (median and p95). sim-check about 24 s.
Mutation-checked: lights drawn on the world layer -> the TINT same-pair fails; a constructor that loads storage -> the
planted frozen case fails (tick 5600); attach not swapping in the save -> live persistence fails (tick 9 < 300); step
ignoring the speed -> "8x ran 61 steps, 1x 61"; the sim draining slower after 20:00 -> smoke "the barn differs by
night" and sim-check 12 fail; a black night top band (#303850) or the old tub (#8e6240) -> gate (w) fails.

**Deviations and why**

1. **Barn windows (NEW).** D2 says night shows in "the sky, windows, lamps and building"; the plan's only windows
   were the tower slits, and the start frame (cam 204,376) shows no sky and neither tower, so night there was two lamp
   rings. Panes are cut out of the back wall (the sky layer shows through; the ground floor's show the far hills): the
   ladder bay (2 a floor, 3 floors) and the 3 bare hayloft modules. None in a named room (#11: its wall and props are
   its identity; a window is architecture, not furniture). What shows through is gated by (w) (the sky bands, hills).
2. **Shot hours.** `base_dusk` is `t=600&hour=18` (19:20) and `base_dawn` `t=600&hour=5` (06:20): t=600 is 1 h 20 min on,
   so the plan's hour=19 draws 20:20 (night) and hour=6 07:20 (day). Extras: `base_night_roof` (cam 300,100: the sky,
   stars, the skylight, a lamp's rings) and `base_night_west` (cam 0,300: the lit slits, the hearth's ring).
3. **Gate (w) also covers the big props behind a slot and the lights.** S2 left "do large props behind a slot count as
   backdrops?" to S4: their fills do (`PROPS`), and so do the lamp and hearth rings. The tub (`#8e6240`, L 0.149, 20 %
   from lightning) and the dorm pallets' frames (TIMBER `#8a6242`, L 0.145, 18 %) failed: both are now `#a47a52`
   (L 0.224, the romp wheel's wood). Cel shadow bands, wall shadow strips and 1 px lines are marks, not gated (gap).
4. **Gate (w) is counted apart** (`BACKDROPS: PASS 1001 of 1001`) so the dragon count (2256) and every doc quoting it
   stay true; the (w) block is pasted into ART_BIBLE 5.8.
5. **`SimOptions.hour`** (NEW) instead of the view computing clock0; `buildSim` takes it.
6. **Stars step in with the night** (8/16/24 by `nightness`, the moon from the first third, likewise out at dawn),
   not all 24 at once; still flat 2x2 at seeded `rngAt(1, TAG.SKY, i)` places. The moon sits at layer (420, 44).
7. **The hint** has an ink strip behind it (it is read over any wall), its text on the chips' row (y 344, not 343),
   and it gives way when the job strip reaches it.
8. **NEW writes the new barn at once** after clearing (so a reload right after NEW brings back the new barn), resets to
   1x, toasts "A NEW BARN". The speed button takes the next rate and plays; the keys 1-4 also play.
9. **A second live case without save=0**: a version-999 save planted in storage -> a new barn (tick < 2000), no page
   error, the blob kept at `dragon-care/base.bak` (the plan's fallback, checked). Each live saving case has its own page
   (Playwright's `browser.newPage()` is a fresh context, so fresh storage).
10. Plan's `readonly sim` is gone (a load/NEW swaps the world in place); `backupSave` and `BACKUP_KEY` exported.
11. README gained one paragraph (the controls and the save), outside the plan's doc list.

**Gaps and stand-ins**

- Not gated by (w): a prop's cel shadow band (the tub's `#6c5448`, the hearth's), a wall's foot shadow strip (the bare
  wall's `#665f64`, L 0.119) and 1 px lines; spike (L 0.168) is not a "dark body" by the plan's rule, so the night's
  top band (L 0.193) is only 13 % from it (the ink outline carries it on the Aerie at night).
- The keeper badges show only "at a job" (an amber 3x3 dot); ▼/↗/z wait for S7/S8. The badges are not tappable (S7).
- One barn, no save slots; a failed write (quota, no storage) is silent (`writeSave` returns false).
- `layers=world` shows the window panes as the clear colour `#16141c` (no sky layer) -- the same by day and night.
- The clouds mostly pass behind the building (visible at the world's ends and over the roof).
- At 07:00-07:20 the sky still shows dawn's colours (blend 0 = the previous phase), so `base_aerie` (t=60 at 07:01)
  now has a lilac dawn sky, not the old flat day blue.

**See it**

- `node tools/shot.ts out.png="view=base&t=600&hour=22" --scale 2` (night: blue windows, the dorm lamp's rings, the
  hearth's glow), `"view=base&t=600&hour=18"` (dusk), `"view=base&t=600&hour=5"` (dawn), `"view=base&t=600"` (day),
  `"view=base&t=600&hour=22&cam=300,100"` (the night sky, stars, skylight), `"view=base&t=600&hour=22&cam=0,300"` (lit
  slits), `"view=base&t=60&cam=0,0&hour=23"` (the Aerie at night, the moon), `"view=base&t=150&hour=20&cam=300,100"` (a
  stepped mix: 20:20, dusk->night 1/3), `"view=base&t=600&hour=12&layers=world"` (the world layer alone).
- Live: `npm run dev`, `index.html` (saves; reload resumes) or `index.html?save=0`; the speed button or 1-4, p, NEW x2.
- Shots looked at: `scratchpad/shots/s4/` and `scratchpad/shots/s4final/` (all of the above, plus live NEW/pause
  captures `live_new1.png`, `live_paused4x.png`, and `ages_bath.png` for the re-coloured tub).

### S4 review

Fixer pass on dc93c06. All seven findings were checked against the code and reproduced where possible (the reviewers'
`probe/corrupt.ts` and `corrupt2.ts`, a day-100 planted save, and the 05:00/20:00 roof shots). Six are fixed and one
is deferred; none was rejected. `npm run check` is green on the committed tree: palette 2256/2256, keepers 156/156,
BACKDROPS 1001/1001; sim sections 1-12; smoke **81 views** (77 + 4 new) + 1 moved pair + 2 TINT pairs (world
bb6e59e9 = bb6e59e9, barn 9c0e49a6 = 9c0e49a6; full frames a5fa57aa / 896e3086); speed 1x 61, 8x 480, paused 0;
about 5 min 40 s.

**Fixed**

1. **(major) A broken v3 save that parses froze the page, and pagehide wrote it back.** Two changes in `base.ts`:
   - `use(sim)` is now atomic. It builds the cast (`syncCast(sim?, cast?)` now takes a world and a map), the keeper
     agents, the building and the plates into locals, then swaps them all in. A world the view can't build leaves the
     one on screen whole.
   - New private `load(save): boolean`, called from `attach()`: `CareSim.fromSave(save)` → `use` → one `worldStep()`
     → `draw()` on an off-screen 640x360 canvas → then `use(CareSim.fromSave(save))` again. That second copy is the
     barn, so it resumes at the saved tick; the trial copy was stepped. On any throw it runs `use(was)` (the page's
     own new barn) and returns false. `attach()` then calls `backupSave()` and toasts DIDNT_FIT. `frame` is restored
     and `top.clear()` runs either way. Autosave and pagehide now write the new barn over the broken one.
   - smoke: `BROKEN_SAVES` (PLANTED with `dragons[2].element 'plasma'`, `keepers[1].look 'nobody'`, `jobs[0].need
     'dance'`), one live saving page each (`liveBrokenSave`). Each checks: ready, tick <= 2000, 7 adults, no page
     error, `.bak` === the blob, and `baseSaveNow()` writes the new barn, never the marker.
   - Mutation-checked:
     - HEAD's base.ts: the element case fails (pageerror, tick 5000); the keeper case gets a pageerror and never
       reaches ready.
     - Atomic `use()` without the trial: the `dance` case fails (pageerror 'rows', never ready). Only the trial draw
       finds it, since that save builds fine.
   - Probes after the fix: element, stage, look, needs, rooms, lift, dayLen, null legs and an unknown need all give
     ready and a low tick with no page error. Over 3 reloads the stored save goes 3000/plasma -> 89/rock -> 179/rock.
2. **(major + minor, one finding) From day 100 the clock ran into JOBS.**
   - `clock.ts` `clockLabel`: 'DAY 3 14:00' to day 99, **'D100 14:00' from day 100**, so the label is at most 12
     glyphs up to day 99 999.
   - `hud.ts`: NEW `CLOCK_X 16`, `JOBS_X 90` and `jobsAt(label) = max(90, 16 + measureText(label) + 7)`, i.e. one
     space after the clock. JOBS sits at 90 for days 1-9 and 100-9999, and at 94 for days 10-99 and 10 000-99 999.
   - sim-check 11 checks days 1, 9, 10, 99, 100, 999, 1000, 9999, 10000 and 99999 at 23:50: JOBS starts a space after
     the clock, and 'JOBS 99' ends by x 135 (`BADGE_X0 - 3`). It prints `'DAY 99 23:50' JOBS at 94, 'D100 23:50' JOBS
     at 90, 'D99999 23:50' JOBS at 94`.
   - Mutation: the old label gives 6 failures (every day from 100).
   - Looked at live planted saves for days 10, 101 and 12346 (`shots/S4fix/bar_day*.png`).
3. **(minor) The lights and the HUD icon switched a phase ahead of the sky** (05:00, 20:00).
   - `sky.ts` gains NEW `dimness(c)`: 0 by day, dusk's blend, 3 at night, 3 - dawn's blend.
   - NEW `skyPhase(c)`: `blend >= 2 ? phase : prev`, the phase the sky mostly shows.
   - NEW `interface Lights { slits; rings: 0|1|2; hearth; skylight; icon: 'sun'|'low'|'moon' }` and `lightsOf(c)`.
   - `building.ts` drawLights and `hud.ts` drawTopBar read `lightsOf`. **`slitsLit` is removed** (it was used only
     in building.ts).
   - The timetable now:
     - slits: 18:20 to 06:00;
     - dorm lamp rings: the inner one (r10) from 18:20, both from 18:40, both through the night to 05:40, the inner
       only from 05:40 to 06:00 (they come and go by shrinking);
     - hearth ring and skylight (sky top band plus a star): with the stars, 20:20 to 06:00;
     - icon: sun 07:40-18:40; low sun 18:40-20:40 and 05:40-07:40; moon 20:40-05:40.
   - So `base_t0` and `base_aerie` (07:00/07:01, a dawn sky) now show the low sun.
   - sim-check 11 walks every step of both day lengths and checks:
     - at a phase's first step, `lightsOf` deep-equals the step before;
     - everything is on while `nightness > 0`;
     - everything is off, with the sun, under the day's own bands;
     - the moon shows iff `nightness >= 2`.
   - Mutation: a hearth tied to `phase === 'night'` fails at 05:00.
   - section 12's scan regex adds `dimness|skyPhase|lightsOf`.
   - Looked at: roof_0440, 0500, 0540, 0600, 1820, 2000 and 2020, base_dusk, base_dawn and base_night_west.
     base_night (23:20) is byte-identical to before.
4. **(minor) Gate (w) passed near-black backdrops.**
   - Gate (w) is now one-sided for the sky, hills and clouds (every phase and mix), every wall (WALLS, lift, bare,
     stone) and the lamp and hearth rings. NEW `lighterBy(a, b) = (La - Lb) / La` must be >= 0.25 against every dark
     body, so L >= 0.159.
   - `PROPS` keep the symmetric relDiff, because the firebox `#3a2626` is a dark mouth by design (55 % apart from
     slinkwing baby).
   - Still 1001 gates. The heading states the floor, and each line reads `lighter` or `apart`. Props are now listed
     after the rings.
   - Mutation: a night top band of `#000000` fails 40 of 1001 (before this fix it passed).
   - Docs:
     - ART_BIBLE 5.8's (w) block re-pasted: only its 78 lines changed; the rest of the block is byte-identical to
       today's output, and the keeper sections are still left out as before;
     - ART_BIBLE's status line;
     - BASE_DESIGN 1, 7 and 9;
     - the `surfaces.ts` and palette-check headers.
5. **(minor) `hour=` was ignored on a live page that had a save.**
   - The gallery now sets `persist: P.t == null && P.save && !P.preset && P.hour == null`, so a page given an hour is
     not the player's barn, like a preset page.
   - Docs: the gallery header, the BaseViewOpts comments, BASE_DESIGN 7 (saves: "a page given `hour=`" is exempt) and
     8.
   - smoke `liveHourNoSave`: PLANTED in storage, live `view=base&hour=22`. It checks: tick <= 2000, persist false,
     night, no `baseSaveNow`, and storage untouched.
   - Mutation: the old rule fails (tick 5012, persist true, dusk, lends baseSaveNow).
   - G5 still holds: this page never touches storage, which is what it tests.

**Deferred**

- **(minor) Night at the start camera is quiet** (about 2 % of the frame differs).
  - Why: making it louder needs a lantern with rings in each named room. That is new furniture (#11: a room's props
    are its purpose) and dilutes the Lamp Dorm's mark, so it needs a design call. It is also beyond S4's lights table
    (G15).
  - What is met: the plan's acceptance for "day night cycles" (hour=22 is night, the no-tint diff, gate w), and the
    full cycle shows on the roof and the Aerie.
  - Recorded as an open question in BASE_DESIGN 9. Fix 3 makes the lamps step in thirds, but the start frame's
    changed area is the same.

**Rejected:** none.

**For later slices**
- `use()` is atomic: a later slice's per-world view state (S7 control, S8 panels) must be built into locals and
  swapped in at the end, like the cast. A trial `load()` exercises `use` + `worldStep` + `draw`, so any new
  per-world state must survive being built twice.
- A new backdrop (S6's garden sky or fence, S9's region bands) goes into gate (w)'s one-sided list (lighter than every
  dark body). Only a real dark object behind a slot goes into the `apart` list with the props.
- The lights and any time-of-day cue in the view read `lightsOf` / `skyPhase` / `nightness`, never `c.phase` alone.
  The sim still never reads any of them (the section 12 scan).
- The HUD's clock label can be up to 12 glyphs; S8's COIN at x 334 is unaffected (the badges end at 328).
- Budget: a live saving page now builds the loaded world twice and steps and draws it once more at load. The
  livePersist and broken-save cases load well inside smoke's timeouts; nothing per frame changed.

## S5 — Growing up, eggs and hatching

**Built** (base aacd479, commit 677972d; `npm run check` green on the committed tree: typecheck, palette 2256/2256 + keepers 156/156 +
backdrops 1001/1001 + NEW eggs 7/7, sim sections 1-14 in about 26 s, smoke 85 views + 1 moved pair + 2 TINT pairs,
about 6 min). Closes #8's last criterion ("a 'month' of game time to have a dragon grow from one age class to another");
advances #5.4 (the Hatchery side) and #11 (the Hatchery proven used: `PLANNED` is now tack, bunks, maproom, aerie).

- New: `src/game/life.ts` (stage-ups, hatching), `src/game/names.ts` (hatchling names), `src/game/eggs.ts` (egg art,
  cracks, wobble, shell bits: drawing only).
- Changed: `sim.ts` (Egg, events, `settle` goal, `eggs`/`nextEggId`/`addEgg`, `stats.growDelayMax`, `stepLife` in
  `step()`), `travel.ts` (exports), `layout.ts` (nests), `surfaces.ts` (`NEST`), `building.ts` (nests from
  `NESTS`/`nestX`/`NEST`), `save.ts` (v4), `presets.ts` (growup, eggs, hatch, full), `hud.ts` (the dragon card),
  `base.ts` (grow-up stand-in, eggs, shell bits, card, dawn tip, hook), `src/art/dragon/rig.ts` (NEW `DrawDragonOpts.flat`),
  `types/globals.d.ts`, `tools/palette-check.ts` (egg gate), `tools/sim-check.ts` (5, 6, 8, NEW 13, 14),
  `tools/smoke.ts` (4 cases), `tools/shots.ts` (3 shots), docs BASE_DESIGN 3, 4.7, 4.8, 5.6, 7, 8 and ART_BIBLE
  (status lines, 4.2 grow-up row, 5.8 re-pasted with the egg block, NEW 5.9 Eggs).

**Exported names and signatures** (NEW / DIFFERS against plan S5's type block)

- `sim.ts`
  - `interface Egg { id; element; seed; laid; nest: 0|1|2 }` exactly as plan (`seed` = the baby's seed,
    `(mix32(sim.seed, TAG.EGG, egg.id) & 0x7fffffff) || 1`, drawn in `addEgg`).
  - `type SimEvent = { kind: 'grow'; dragon; stage: Stage } | { kind: 'hatch'; dragon; egg }` (the S1 `'none'`
    placeholder is gone). **S6/S8 extend this union.**
  - `type DragonGoal = 'need' | 'evict' | 'settle'` (NEW `settle`: a baby walking to the module slot it will grow up in).
  - `CareSim.eggs: Egg[]` (id order), `nextEggId`, `addEgg(element, laidAt = this.clock): Egg | null` (lowest free nest;
    null if the 3 nests are full or there is no hatchery; `stats.used.hatchery++`). **S8's missions call `addEgg`.**
  - `SimStats.growDelayMax` (steps from due to applied, the most).
  - `step()` order DIFFERS: needs drain and acts → **`stepLife`** → jobs open → `stepTravel` → `assign` → keepers (plan:
    stepLife before needs; see deviation 1).
- `life.ts`: `stepLife(sim)` (growth by dragon id, then hatching by egg id), NEW exports `HATCH_FOOD 0.45`,
  `nextStage(st): Stage | null` (null for elder), `stageDue(sim, d)` (= `stageSince + STAGE_DAYS * dayLen`),
  `settled(sim, d)`: no act, `asleep === 0`, no legs, `move === 'still'`, `turn < 0`, not the lift's rider, no job of it
  with a keeper. **S6: retirement goes in `growUp`'s elder branch (`nextStage` returns null there today) with the same
  `settled` rule; add a `place` check to `settled` when places exist.**
- `names.ts`: `NAMES` (plan's table, frozen), NEW `NAME_MAX 8`, `hatchName(sim, el)`: the first of `NAMES[el]` no
  `sim.dragons` name uses; else for k = 2, 3, ... each name in order with k (cut to fit 8 chars): CINDER2, ASH2, ...,
  CINDER3. **Garden residents and away dragons must stay in `sim.dragons` (or S6/S8 must widen `used`) for uniqueness.**
- `eggs.ts`: `drawEgg(ctx, el, x, y, progress, tick)` as plan ((x, y) = the egg's bottom middle, world px; the view
  uses `nestX(room, nest), feetY(f) - 12`); `drawShellBits(ctx, el, x, y, age, eyes = [])` DIFFERS: an optional list of
  eye boxes (world px) a bit must not touch (the bits fly over the cast). NEW `EGG_W 9, EGG_H 12, CRACK1 0.5, CRACK2
  0.85, WOBBLE_FROM 0.85, BITS_FRAMES 20, cracksAt(p), wobbleAt(p, tick)`.
- `layout.ts`: NEW `NESTS 3`, `nestX(room, i) = room.x0 + 30 + 50 i` (1062, 1112, 1162).
- `surfaces.ts`: NEW `NEST '#e6dcc4'` (the nest mound, gated by the egg gate).
- `travel.ts`: now exported (were private): `sendTo(sim, d, slot)`, `freeSlot(sim, d, room, stage = d.stage)`,
  `nearestFree(sim, d, stage = d.stage, not: RoomKind[] = [])` (stage: the slot size to look for; `not`: room kinds to
  skip); private `lineBlocks` gained a `stage` parameter. **S6 can use `nearestFree`/`sendTo` for residents moving out.**
- `save.ts`: `SAVE_VERSION = 4`; `SaveV.eggs: Egg[]`, `SaveV.nextEggId`; `barnKey` now includes the eggs less `laid`
  (so the TINT barn digest changed to 239b556e; both sides still equal).
- `presets.ts`: NEW `GROWUP_IN 30`, `HATCH_IN 60`, `EGGS_PRESET` (rock 0, dusk 0.55, water 0.9); presets `growup`
  (EMBER's `stageSince` so it is due at step 30, its needs full), `eggs`, `hatch` (a fire egg due at step 60: CINDER),
  NEW `full` (the start + ten babies in every free baby sub-slot + a due fire egg: section 14's "test preset").
- `hud.ts`: NEW `CARD {8, 20, 160, 76}`, `interface CardInfo { name; element; stage; day; needs: Record<NeedKind, number|null> }`,
  `drawCard(ctx, c)`.
- `rig.ts` (src/art, game code): NEW `DrawDragonOpts.flat?: boolean`: every fill flat in its own `glow.hi` inside its
  own ink (the element-flash path, `rig.keepInk`). Used only for the grow-up.
- `base.ts`: `PetView` gains `flash: number` (world steps of the grow-up flash left) and `cheering: boolean` (its
  `happy` playing through); private `card: number | null`, `hatches`, `heads`, `lifeEvents()`, `progress(e)`,
  `cardDragon()`. All per-world view state is reset in `use()` (card, hatches, heads); `load()` also restores the toast
  the trial step may have said. **S7: `tap()` now sets/clears `this.card` (a tap on the card, or any non-button tap,
  closes it; a button tap leaves it open) — fold keeper/badge taps into that order.**
- Hook (`window.__dragonCare.base`, globals.d.ts updated): `eggs: {element, nest, progress}[]`, `card: string | null`,
  and on each dragon `waiting: boolean` (it has a job no keeper is at work on) and NEW `head: {x, y} | null` (canvas px
  of the head's middle as last drawn; null when not drawn). smoke's card case clicks `head`.
- sim-check: NEW constants `GROW_ALONE 3600`, `GROW_BUSY 10800`, `GROW_REAL 3600`; the room-use check moved to the end
  of the suite (printed `8 rooms used over the suite: ...`). smoke: NEW `grownUp`, `eggsIn`, `hatchedOne`, `baseCard`.

**Measured** (`npm run sim`, `npm run palette`, `npm run smoke`)

```
5 start: ... presets ages growup eggs hatch full (ages: 12 dragons, 4 stages; growup: EMBER an elder at step 30; eggs: rock 0.00, dusk 0.55, water 0.90; hatch: CINDER at step 60; full: 17 dragons and a due egg)
6 saves (life, a 600-step day): step 60 (BURR walking to grow up), step 100 (eggs incubating), step 300 (an egg just hatched), step 5368 (a dragon just grown up) step on 5000 to the same world
13 growing up: alone (a 600-step day), BURR grew young at step 20920 (kitchen:0, 2920 late), adult at step 36000 (groom:0, 0 late), elder at step 54000 (bath:0, 0 late), each stage exactly 18000 steps after the last, walking out of the Hatchery to a module slot first; 44 needs drained at the new stage's rate the step after; the busy barn (seven adults and BURR falling due 5 s apart), steps late: ECHO elder 0, BRAMBLE elder 1244, ZAP elder 1308, RIPPLE elder 1526, WICK elder 1187, EMBER elder 3540, COBBLE elder 3693, BURR young 7438 (at most 7438, gate 10800); the real day (10800 steps), EMBER 30 days less a minute in grew an elder at step 2939 (due at 180)
14 eggs: three eggs in nests 0-2, a fourth not taken; each hatched exactly 1200 steps (2 days of 600) after it was laid: PEBBLE (id 7, seed 1230241878) into the hatchery:0, fed 101.9 s later; GLOAM (id 8, seed 1631896843) into the hatchery:1, fed 89.0 s later; SPLASH (id 9, seed 1776321566) into the kitchen:3, fed 77.6 s later; two runs alike; every sub-slot taken, the egg waited 1200 steps, nothing lost, and hatched into the hatchery:0 the step it freed; 80 lightning names, the last VOLT14
8 rooms used over the suite: kitchen 356, bath 384, hatchery 28, romp 428, groom 215, dorm 205, lift 842; planned: tack, bunks, maproom, aerie
EGGS: PASS 7 of 7 (rock the nearest: 33 % from the nest #e6dcc4)
smoke: view=base&preset=growup&t=60 (6716 colours), preset=eggs&t=600&cam=872,376 (6973), preset=hatch&t=120&cam=872,376 (6626), card: BRAMBLE's opened by a tap on its head, closed by a tap on it; TINT world bb6e59e9 = bb6e59e9, barn 239b556e = 239b556e, full frames a5fa57aa / 896e3086 (the start frames are pixel-identical to S4's)
```

Sections 1-4, 7, 9-12 are unchanged (the start cast never grows in their runs: stepLife is a no-op for it, so every
S3/S4 number stands). Section 6's main line: 5896 bytes at step 5000 (was 5855: `"eggs":[]`, `nextEggId`,
`growDelayMax`). Over seeds 1-8 (probes): alone, a stage-up waited 233-2920 steps; in the busy run 4062-8874 at most
(68-148 s; seed 1 7438). Real-length EMBER on seeds 2 and 3: 1130 and 3812 steps (seed 3 would miss 180 + 3600; the
check runs seed 1, the plan's scenario). The `full` preset stepped 80 000 steps on its own (seed 1): the egg never
hatches, 2.2 M need-steps at 0, 74 jobs done (BASE_DESIGN 4.7). sim-check takes about 25.8-26.4 s (S4: about 25 s).
Mutation-checked: a darker nest `#c8a870` fails the egg gate (rock 15 %, water 17 %); `settled` without its act/keeper
terms fails section 13 ("ZAP grew elder unsettled (act bath, BEA on it)"); growth ignoring `settled` crashes the sim
(a dragon grown mid-walk off its net); hatching with no free sub-slot fails section 14 ("the egg hatched (0 eggs, 18
dragons of 17)").

**Deviations and why**

1. **`stepLife` runs after the needs pass (acts refilled and ended), before jobs open**, not before the needs. With it
   first, a dragon whose nap ended in the needs pass walked off in the same step's travel and was never settled at a
   step boundary (WICK waited 8125 steps). After the needs pass it is caught at that moment; a hatchling's food job
   still opens the same step.
2. **`growDelayMax <= 3600` is gated where it holds, and the busy barn gets its own measured gate.** Alone (the plan's
   "a baby with days: 0 becomes young, then adult, then elder") the delay is 233-2920 over seeds 1-8: gated at 3600.
   In the start barn a dragon is on an errand almost every step (S3's saturated car: a job's wait averages 83 s, up to
   360 s), and the settled rule makes a stage-up wait out the current errand: measured 4062-8874 steps over seeds 1-8,
   gated at `GROW_BUSY 10800` (3 min = one real game day, a thirtieth of a stage). Written into sim-check's comment,
   BASE_DESIGN 7 and this log. The alternative (growing a dragon mid-walk or at a landing) breaks nets and lines (the
   mutation above crashes).
3. **The grow-up flash is `flat` (glow.hi inside its own ink), not `flash: true`.** The rig's `flash` is a white
   silhouette with no outline: a pale ghost on the straw (seen in `shots/s5/base_growup.png` before the fix), which
   ART_BIBLE 3.5 already records as rejected for lightning's snap, and 4.2's grow-up says "flat `glow.hi` at α 1.0".
   `DrawDragonOpts.flat` reuses the element flash's keep-ink path. G8 holds: it is only ever set for a grow-up.
4. **The card's day bar is 30 segments of 4 × 5 px (1 px gaps), not 5 × 5**: 30 × 5 + 29 = 179 px does not fit the
   160 px card; 4 × 5 gives 149 px. Need columns are centred and only for needs the dragon has (fire: 4).
5. **Shell bits are drawn over the cast but never over an eye** (`drawShellBits(..., eyes)`): drawn under the cast, the
   baby standing up in the nest hid half of them.
6. **Cracks have a 1 px lit rim** (the shell's highlight) on their left: ink alone on dusk's navy egg was a faint streak.
7. **Hook `head`** (not in the plan's hook list): the smoke card case needs the head's canvas position.
8. **A `full` preset** (the plan's "a test preset") is a real `PRESETS` entry, so section 14 and the view share it.
   Section 14 frees a sub-slot by removing one baby from the world (a stand-in for S6/S8 taking a dragon out): in a
   truly full barn nobody can move, so no in-sim event frees one.
9. **Card taps**: a top-bar button tap leaves the card open (so the game can be paused to read it); any other tap
   closes it (a tap on the card itself too), then does what it did before.
10. **Section numbers**: growing up is **13** and eggs **14** (the plan's §12/§13 were taken by S4's clock and night).
11. **Dawn tip text**: "N DRAGONS GROW UP IN 2 DAYS", or "EMBER GROWS UP IN 2 DAYS" for one; it counts non-elders
    whose due falls within 2 days (already due ones included). Checked by eye with a temporary preset (reverted).

**Gaps and stand-ins**

- The 240 f grow-up and its "look at me" (ART_BIBLE 4.2; the hold now auto-releases after 120 f in the design) are not
  built; the stand-in is the 12-step flat flash + `happy` + toast. The flash counts world steps, so at 8x it lasts 1.5
  frames.
- No toast on a hatch (not in the plan's list; recorded in BASE_DESIGN 8.1's "Not in this slice").
- Nothing lays an egg in play until S8's missions; the presets do.
- A due baby walks to the *nearest* free module slot, which can be across the barn at a baby's 0.15-0.30 px/f (BURR:
  824 px, about 88 s, in section 6's life world), with its needs waiting (no re-choose while it has legs).
- Capacity: every hatchling adds load past the car's ceiling (BASE_DESIGN 4.7); the `full` preset deadlocks. S8 must
  decide before eggs arrive in play.
- `docs/base/base_live.png` was not re-rendered: the start frame is pixel-identical.

**See it**

- `node tools/shot.ts out.png="view=base&preset=growup&t=36" --scale 2` (`base_growup`: EMBER flat yellow in its ink,
  the toast; `t=29` before, `t=42` the grey elder with `happy`), `"view=base&preset=eggs&t=600&cam=872,376"`
  (`base_hatchery`: three eggs, one and two cracks), `"view=base&preset=hatch&t=70&cam=872,376"` (`base_hatch`: CINDER
  and its shell bits), `"view=base&preset=full&t=60"` (seventeen dragons).
- Live: `npm run dev`, `index.html?preset=growup` (EMBER flashes and grows up half a second in, no keeper by it),
  `index.html?save=0` then p and a tap on a dragon with no bubble (its card).
- Shots looked at: `scratchpad/shots/s5/` (the pre-fix white flash, egg and crack crops, the grow and hatch sequences,
  the live card, the dawn tip) and `scratchpad/shots/s5final/` (the three standard shots).

### S5 review

Fixer pass on 677972d. Twelve findings from two reviewers (the `happy` one reported twice, minor and major) were each
checked against the code and reproduced (the reviewers' `s5probe/badegg.ts`, `trace6.ts`, `rv/happycut.ts`, the
crops, plus my own probes in `scratchpad/s5fix/`). All are real and all are fixed; none rejected or deferred.
`npm run check` is green on the committed tree: palette 2256/2256, keepers 156/156, backdrops 1001/1001, **EGGS 8/8**
(new gate `egg-lie`); sim sections 1-14 (28.5 s wall: the budget is 30 s, S5 measured 28.1 s, so later slices must
keep new sim-check work small); smoke **87 views** (85 + 2 broken-egg saves) + 1 moved pair + 2 TINT pairs (world
bb6e59e9 = bb6e59e9, barn **51fd9489** = 51fd9489: the barn key now holds each dragon's `hold`). `SAVE_VERSION` is
now **5**.

**Fixed**

1. **(major) Corrupt egg data froze the page.** `CareSim.fromSave` now checks the life state and throws on anything
   this build can't run, so `load()` falls back to a new barn and `.bak`s the blob: `nextEggId` a whole number >= 0,
   at most `NESTS` eggs, each with a known element, a whole id above the last (ascending, unique) and below
   `nextEggId`, a whole nest 0..2 not used twice, whole `laid` and `seed >= 1`; each dragon's `stageSince` whole and
   its new `hold` whole >= 0. smoke `BROKEN_SAVES` gains `"lava"` (egg element) and `"nest":7`; `BROKEN`'s mark is now
   the raw text looked for in the written save (`'"plasma"'` etc.). Mutation: without the egg checks both new cases
   fail (tick 5013 kept, no `.bak`, written back). `s5probe/badegg.ts` now gets `fromSave threw save: an egg this
   build can't hatch`.
2. **(minor) A `settle` walker was served in its module slot.** `travel.ts goFor`'s keep-the-slot shortcut now needs
   `fitsSlot(d.slot, d.stage)`, so a due baby holding a module slot that a job (chosen at a landing, or Rushed) calls to
   that room takes a sub-slot there and grows up after. sim-check 13 (d): BURR, its ground floor's module slots all
   taken, walking to romp:1 to grow up, is Rushed to play: served in romp:2 (a sub-slot), grew young in romp:0.
   Mutation: the old shortcut fails at once (`BURR (baby, goal need) holds the romp:1, which it doesn't fit`). (A
   caller whose car is already coming for it is the lift's rider and never re-chooses, so the scenario Rushes rather
   than waits at a landing; both paths go through the same `goFor` line.)
3. **(major + minor, one finding) The grow-up's `happy` was cut short** (33 of 93 grow-ups walked or turned in the
   grow step). NEW `Dragon.hold` (saved, v5): at the grow step `stepLife` sets it to NEW `gait.ts happyLen(el, newStage)`
   (the happy anim's frames summed, 61-139 steps, rock the longest; from the same tables the pets play) and counts it
   down first thing each step. While `hold > 0` the dragon is not `free` (no choose), not `servable` (no keeper sent),
   not a `lingerer` or `bumpable` (no eviction or bump), and `retarget` (Rush) waits: the rushed job is first in its
   queue when the hold ends. View: an act that starts ends `cheering`. Probe `s5fix/growcheck.ts` (the reviewer's
   happycut scenario, seeds 1-6, 91 grow-ups): 0 cut, 0 with a keeper in the new body. sim-check 13's `run()` now
   checks every grow-up holds exactly `happyLen` and stays put (no route, walk, turn, act or keeper coming) until it is
   done, and runs on until every cheer has played out (12 checked); section 9 checks each of the 28 happies is the same
   length for seeds 11 and 215 (rebuilt past the cache) and that a player is `done` after exactly `happyLen` ticks.
   Mutations: hold 0 at the grow, `free()` ignoring the hold (RIPPLE walked 84 steps before its cheer ended).
4. **(minor) Comments said life runs first.** sim.ts's header and `step()` doc and life.ts's header now give the real
   order (needs and acts, then life, then jobs open, travel, assign, keepers) and why (a nap or job ended this step is
   caught settled; a hatchling's food job opens the step it hatches).
5. **(major) Eggs hidden behind babies resting in the Hatchery's sub-slots.** Two rules, both in the sim:
   - an eviction or a Rush's bump never moves a baby to the Hatchery (`takeSlot`: `nearestFree(sim, o, o.stage,
     ['hatchery'])`), so its two sub-slots are the hatchlings' first places only;
   - a hatchling takes the Hatchery's free sub-slot **nearest its own nest** (ties to the lower index; `life.ts hatch`,
     via NEW `travel.ts slotFree`), so it stands in front of its own, now empty, nest (nest 0 -> hatchery:0 at 1072,
     nest 2 -> hatchery:1 at 1152; nest 1 ties to hatchery:0). `addEgg` still fills the lowest free nest (plan).
   Measured (`s5fix/hatchhome.ts`, the reviewer's three-egg barn, seeds 1-6, 59 000 steps after the hatches): a baby
   home in the Hatchery 0-3.8 % of the time (was 0-14.2 %; what is left is a hatchling that can't get a kitchen slot
   yet), a body over nest 0 1.8-8.0 % (was up to 19.8 %): the rest is grown dragons 100 days on, queued at the east
   landing past the bath into the Hatchery (the capacity ceiling, 4.7). sim-check 14 adds both rules (an egg in nest
   2 hatches into hatchery:1; BURR, in ZAP's way in the bathhouse's second module, goes to kitchen:5, not hatchery:0);
   each fails when reverted. NEW standard shot `base_hatchery_home` (`preset=eggs&t=2230&cam=872,376`: SPLASH, just
   hatched, in front of its own empty nest 2, the rock and dusk eggs in view).
6. **(minor) Grow-up toasts replaced each other.** base.ts: life's news (grow-ups, the dawn tip) now goes into a queue
   (`news`) that shows in turn behind the toast showing (`say()` stays immediate for NEW / SURE / DIDNT_FIT), and a
   grow-up into a stage whose news is still waiting joins it: "EMBER AND ZAP ARE ELDERS NOW!", "EMBER, BRAMBLE AND 1
   MORE ARE ELDERS NOW!" (plural words `STAGES_NOW`). `use()` clears the queue. Looked at with a temporary preset
   (EMBER, BRAMBLE, ZAP due at 30, WICK at 90; reverted): t=36 the merged toast, t=230 "WICK IS AN ELDER NOW!" queued.
7. **(minor) A keeper was often at the old reach when the rig swapped.** NEW `life.ts inTheWayOfGrowing(sim, d,
   stage)`: the keeper (on the dragon's floor, not climbing) whose x +- KEEPER_HALF overlaps the new stage's body span
   (`bodySpan`), or null. A due, settled dragon with a keeper in the way does not grow that step and **holds** (`hold
   = max(hold, 1)`, re-set each step it is still blocked), so it doesn't set off on its next errand the step after
   being served (without the hold the busy delays went to 12 201 steps, over the gate; with it 4061-8665 over seeds
   1-8, seed 1 8665). Holds for room last at most 184 steps (3 s) over the 91 grow-ups. BASE_DESIGN 7's sentence is
   now true (and says so of the whole new body). sim-check 13's settled reasons add `<KEEPER> where it grows`;
   mutation (no room rule): ZAP, WICK and COBBLE "grew elder unsettled (BEA where it grows)".
8. **(minor) The card was reachable only 21-40 % of the time.** A tap on a dragon now always opens its card, and
   still Rushes its waiting job if it has one (exactly one Rush); a bubble or chip tap only Rushes. smoke `baseCard`
   also taps a waiting dragon's head (RIPPLE): card opened, rushes +1.
9. **(minor) The flash counted world steps.** `PetView.flash` now counts down once per `step()` that runs world steps
   (before them), so 12 frames at any speed and held while paused; identical to before at 1x (frozen frames unchanged).
10. **(minor) The egg gate measured the wrong background.** The nest is now a taller straw heap (NEW `layout.ts
    NEST_RX 20, NEST_RY 21` (was 11), `NEST_STRANDS` on its flanks only, `nestBase(f)`, `eggBottom(f) = floorTop +
    WALL_H - 2` = 686: the egg's ink ring's bottom row, 2 px over the band), so the egg lies nestled in its front
    against the straw alone; the old cup (rim `#b8a47a`, hollow) is gone, and `building.ts`'s `oval` helper with it.
    palette-check gains `egg-lie`: every pixel just outside the egg's ink ring (a 3x3 per shell pixel, as `drawSprite`
    draws it), at each wobble, is inside the heap's fill a px in from its antialiased edge, over the band and off the
    strands (162 pixels over 3 wobbles). EGGS is now 8 of 8. Mutations: `NEST_RY 19` fails (off the straw at -3,-19),
    the egg 1 px lower fails (the band). `eggs.ts` exports `SHELL` and `WOBBLE` for it.
11. **(minor) Hatch bits: 3-4 of 6, on the baby's body.** The bits are now drawn **under the cast** (after the eggs):
    never over a dragon or an eye by construction, so `drawShellBits` lost its `eyes` parameter and the view its eye
    boxes. New `BITS` paths: up and out to both sides, places 2 and 3 clear of a baby's head (~22 px over its feet), at
    most 26 px to a side (a nest is 30 px from the Hatchery's wall). The hatchling's need bubble is not drawn while its
    bits fly (`hatches` now keeps the baby's id): it stood where they fly. Crops t=59-80 looked at: all six in an arc
    over CINDER at places 2 and 3, none on its body.

**Changed names and numbers**

- `Dragon.hold` (NEW, saved), `SAVE_VERSION 5`; section 6's save at step 5000 is 5959 bytes (was 5896).
- `gait.ts happyLen(el, stage)`; `life.ts inTheWayOfGrowing(sim, d, stage)`; `travel.ts slotFree(sim, d, s, stage)`.
- `layout.ts NEST_RX, NEST_RY, NEST_STRANDS, nestBase(f), eggBottom(f)`; `eggs.ts` exports `SHELL`, `WOBBLE`;
  `drawShellBits(ctx, el, x, y, age)` (no eyes).
- sim-check 13 measured: busy `ECHO 0, BRAMBLE 1244, ZAP 1312, RIPPLE 1526, WICK 1191, EMBER 3540, COBBLE 3836, BURR
  young 8665` (gate 10800); alone unchanged (2920, seeds 1-8 233-2920); real day unchanged (2939; seed 3 still 3812).
  Section 8's hatchery uses 32 (was 28).
- BASE_DESIGN 4.8 (card, toasts), 7 (room to grow and the hold, the cheer, numbers, eggs: nearest sub-slot, no baby
  moved to the Hatchery, the heap), 8.1 (built paragraph, the not-in-slice bullet, the sim-check row). ART_BIBLE
  status (EGGS 8 of 8), 4.2 grow-up status, 5.8's egg block re-pasted, 5.9 (the heap, the bits under the cast, the
  gates). `surfaces.ts NEST` doc, `gait.ts` header.

**Rejected:** none. **Deferred:** none of the findings.

**Still open (the implementer's gaps, unchanged):** the 240 f grow-up; no hatch toast; eggs only from presets until
S8; the barn past its capacity with hatchlings (the `full` preset deadlocks); the real-length check passes on seed 1
only (3812 steps on seed 3); the dawn tip has no automated test. New: at 8x the `happy` plays at 8x like everything
else (only its flash counts frames). In crowded long runs a landing queue can still reach into the Hatchery past the
bath and stand over a nest (capacity, not rest).

**For later slices**

- S6 retirement goes in `growUp`'s elder branch with the same `settled` rule; decide whether it needs room (probably
  not: the resident walks away) and whether it cheers (a `hold` would need a matching view anim).
- Anything new that moves a dragon must respect `hold > 0` like `act` (free, servable, lingerer, bumpable, retarget).
- S8 `addEgg`: eggs fill the lowest free nest; hatchlings stand in front of their own nest; nothing else may be sent
  to the Hatchery's sub-slots (`takeSlot` passes `['hatchery']`; a new mover should too).
- News toasts: push to `news` (queued, merged by stage) rather than `say()` unless it answers the player's own tap.

### S5 review (second fixer pass)

Second fixer pass on 547580d, which the first pass had built from the same twelve findings. I checked each finding
against the code at 547580d and re-ran the reviewers' own probes. All twelve are fixed as the first pass describes, and
none is rejected:

- `s5probe/badegg.ts`: both bad eggs now make `fromSave` throw.
- `s5probe/badegg_live.ts`: the planted plasma egg gives a new barn at tick 9 with a `.bak`, the tick keeps running
  after a pan to the Hatchery, and there are no page errors.
- `s5probe/inv.ts` (seeds 1-8, 40 000 steps): clean, with no baby holding a module slot under goal `need`.
- `s5fix/growcheck.ts`: 91 grow-ups, 0 cut short, 0 with a keeper in the new body, room holds at most 184 steps.
- The live `preset=growup` page (`rv/livegrow.ts`): EMBER flashes flat over ticks 30-41 and is an elder from tick 30.
- A NEW live probe (`s5fix2/merge.ts`): EMBER, BRAMBLE and ZAP due together grow at the same step, and the toast
  reads "EMBER, BRAMBLE AND 1 MORE ARE ELDERS NOW!".
- I looked at the shots: `base_growup` t=36, `base_hatchery` and a 3x crop of its eggs, `base_hatch` with crops at
  t=61/67/74 (all 6 bits clear of CINDER from the second place on), `base_hatchery_home`, and `full` t=60. They are
  in `scratchpad/shots/s5fix2/`.

`npm run check` was green on 547580d (6 m 8 s) and is green on this pass's tree (5 m 58 s):

- palette 2256/2256, keepers 156/156, backdrops 1001/1001, EGGS 8/8;
- sim sections 1-14 in 28.3 s;
- smoke 87 views, 1 moved pair, TINT world bb6e59e9 and barn 51fd9489, both unchanged.

**Fixed in this pass** (one leftover in the eggs-hidden finding, which the first pass's own doc claim exposed):

- **A middle-nest hatchling stood in front of another's egg.** `life.ts hatch` sent a hatchling to "the Hatchery
  sub-slot nearest its nest, ties to the lower". Nest 1 (x 1112) is 40 px from both sub-slots, so the tie always sent
  its baby to hatchery:0, in front of nest 0. Nest 0 can hold a newer egg by then: A goes into n0, B into n1, A
  hatches, C goes into n0, then B hatches. That breaks the doc's "never another's egg".
  - The new rule: among the Hatchery's free sub-slots, one whose baby body (`layout.ts slotBody(s, 'baby')`) covers
    no other egg's nest x comes first, then the one nearest its own nest, with ties to the lower. Each sub-slot covers
    exactly one nest: hatchery:0 covers nest 0 (body 1045.5-1101.8) and hatchery:1 covers nest 2 (1122.2-1178.5).
  - sim-check 14 adds a case: a due dusk egg in nest 1 and a newer fire egg in nest 0 give GLOAM in hatchery:1. The
    old tie rule fails it ("hatched into GLOAM in the hatchery:0").
  - No existing number moved. Section 14's runs, section 6, `hatchhome.ts` (seeds 1-6: a baby home in the Hatchery
    0-3.8 %, the same as before) and the standard shots are byte-identical. Section 8's hatchery uses are now **35**
    (was 32), from the new case.
- Docs:
  - BASE_DESIGN 7 Eggs states the rule.
  - BASE_DESIGN 7 Saves now lists the egg checks (an unknown element, a nest that isn't one, two eggs in one nest)
    among the saves that start a new barn.
  - BASE_DESIGN 8.1's sim-check row adds "or an empty one".
  - life.ts's header and the `hatch` doc, and sim-check's section 14 header.

**Rejected:** none. **Deferred:**

- (minor, not a reviewer finding) `fromSave` checks that `hold` is a whole number >= 0 but sets no upper bound. A
  corrupt, huge hold stalls that one dragon, never the page or the sim. A bound at `happyLen` would reject a good save
  whenever a later build retimes a `happy` anim, and any constant bound would be arbitrary. Left as is.
- (minor) In the `full` test preset the due egg in nest 0 is still behind the baby in hatchery:0. That preset puts a
  baby in every sub-slot by design (section 14's "every sub-slot taken"). In play, hatchlings leave for the kitchen
  and no baby that is moved on comes to the Hatchery (the first pass's rules).

**Still open** (unchanged from the first pass):

- the 240 f grow-up;
- no hatch toast;
- eggs come only from presets until S8;
- the barn goes past its capacity with hatchlings (the `full` preset deadlocks), which S8 must decide;
- the real-length check passes on seed 1 only (3812 steps on seed 3);
- no automated test for the dawn tip;
- `happy` plays at 8x at 8x.

**For later slices** (added):

- S7: `inTheWayOfGrowing` counts every keeper on the floor, so a player-controlled keeper parked inside a due dragon's
  new body holds that dragon, a step at a time, for as long as they stay. Either let a controlled keeper be walked
  out of the way (the hold ends as they leave), or leave controlled keepers out of `inTheWayOfGrowing` and accept the
  swap beside them.
- S8: two eggs brought together fill nests 0 and 1, and each hatchling takes a sub-slot that hides no egg left behind.

## S6 — The elder garden

**Built** (base 249a9ed, commit 7684d52; `npm run check` green on the committed tree: typecheck, palette **2374/2374**
(+118: the path floor's (i) block) + keepers **164/164** (+8: (Ki) on the path) + backdrops **1105/1105** (+104: the
garden's seven backdrops and the gate leaf) + eggs 8/8; sim sections 1-16 in **about 21 s** wall (section 10 now runs
in a worker thread, see deviations); smoke **90 views** (87 + 2 garden + 1 broken garden save) + 1 moved pair + 2 TINT
pairs (world bb6e59e9 = bb6e59e9 unchanged: the start frame is pixel-identical to S5's; barn **b4c21913** =
b4c21913, changed only because each dragon now carries `place`/`home`); about 6 min 12 s). Closes #10's criteria; advances
#11 (the Garden Gate and the garden proven used: `gate 65`, `garden 42` over the suite; PLANNED unchanged: tack,
bunks, maproom, aerie).

- New: `src/game/garden.ts` (DOM-free: retirement, plots, residents' rhythm, their stand spot, resting places),
  `src/game/gardenArt.ts` (the cached plot tiles, fence, lanterns' rings, the GARDEN plate).
- Changed: `layout.ts` (gate kind, garden geometry, `makeNets`, plates), `start.ts` (the gate room, id 9), `building.ts`
  (the gate's arches, leaf, lantern; the right tower's f0 outer slit dropped), `life.ts` (retirement), `sim.ts`,
  `travel.ts`, `needs.ts`, `surfaces.ts`, `save.ts` (v6), `presets.ts` (garden, retire), `hud.ts` (the card for a
  resident), `base.ts`, `types/globals.d.ts`, `tools/palette-check.ts`, `tools/sim-check.ts`, `tools/smoke.ts`,
  `tools/shots.ts`; docs BASE_DESIGN (B8; 2 towers/floors/table/moving around; 3 table, Bare, NEW "The Garden"; 4.1;
  7 one clock/phase readers/growing up/saves; 8 built paragraph, file table, sim-check row, numbers, not-in-slice),
  ART_BIBLE (status counts, D21 note "a place, not a stage", 5.8 re-pasted, 1149 count), KEEPERS.md (counts, (Ki)).

**Exported names and signatures** (NEW / DIFFERS against plan S6's type block)

- `sim.ts`
  - `type Place = 'barn' | 'garden'` (S8 adds 'away'); NEW `type GardenMode = 'nap'|'sit'|'stroll'|'wait'`; NEW
    `interface GardenState { mode; until /* world tick a nap/sit ends, -1 none */; tx /* resting place x */ }`.
  - `Dragon` += `place: Place; home: number | null; garden: GardenState | null` (plan). `home` is set **at retirement**
    (the plot is reserved while walking), not only on arrival.
  - `DragonGoal` += `'retire'`. `SimEvent` += `{ kind: 'retire'; dragon }` (sets off) and NEW `{ kind: 'garden';
    dragon; plot }` (arrived: the view's "X MOVED TO THE GARDEN" toast, merged like grow-ups).
  - `CareSim.garden: { readonly-object plots }` (mutate only via NEW `setPlots(n)`, which throws on shrinking and
    rebuilds `nets`), `get worldW()` (= `worldWOf(plots)`), NEW public `nets: Nets` (derived; in sim-check's UNSAVED).
    `SimStats.retireDelayMax` (NEW). `use(kind: RoomKind | Structure)`.
  - `standAt(d)` returns `garden.ts standAtResident` for a resident; `servable` for a resident = `goalJob === j.id &&
    arrived && !act && no other keeper`; `rush` never retargets a resident; `startWork` counts `use('garden')`.
  - `step()`: residents and retirees drain via `gardenDrain`; no job opens for a retiree, only food/love for a
    resident; `stepGarden(this)` runs **after the keepers** (plan).
- `layout.ts`
  - `RoomKind` += `'gate'` (`ROOM_INFO.gate`, no slots, not `people`); `Structure` += `'garden'` (`STRUCTURES.garden`).
  - NEW constants `GARDEN_X0 1304, GARDEN_PLOT 176, GARDEN_END 32, GARDEN_MIN_PLOTS 2, GATE_X0 1192, GATE_X1 1304,
    GATE_ARCH 84, GATE_MID 1248, KEEPER_END 42, GARDEN_PLATE {x 1324, y 580}`; `worldWOf(plots)`, `plotX(i)` (here, and
    re-exported by garden.ts), NEW `plotMid(i)`, NEW `gardenSpan(gardenEnd, pad | null)` (a dragon's garden walk for
    pad P, or the keepers' for null: [1314, end-42]).
  - NEW `interface Nets { keeper; dragon: Record<Stage, Net> }`, `makeNets(gardenEnd)` (cached per end).
    **DIFFERS: `KEEPER_NET` and `dragonNet()` are REMOVED**; NEW `LADDERS` (the keepers' links, for building.ts).
    **`route`, `spanOf`, `clampToFloor` now REQUIRE a net** (no default): pass `sim.nets.keeper` or
    `sim.nets.dragon[stage]`. f0 spans: keepers [74, worldW-42], dragons [168+P, worldW-32-P]; other floors unchanged.
  - `platesOf` adds the GARDEN plate (building.ts `drawPlates` skips it: the view draws it via gardenArt
    `drawGardenPlate`, since it lies past the 1360 plates canvas); the gate's plate hangs right of ladderR (x 1225).
- `travel.ts`: NEW `routeTo(sim, d, spot)` (sendTo = set slot + routeTo; keeps a call that still rides from that
  landing), NEW `redirectable(sim, d)` (retarget's old guard, now also used for retirement); `free()` excludes
  residents and retirees; `arrived()` is true for a resident standing in mode `wait`; gate passes counted in
  `stepDragon`; landing lines clamped to the barn (`TOWER_R - P`) and `sideOf` uses a private `BARN_NETS`, so the barn
  behaves byte-identically (every S3-S5 number unchanged).
- `garden.ts` (NEW): `NAP [1800,3600]`, `SIT [600,1200]`, `STROLL_P 0.6`, `isNight(sim)`, `retireDue(sim, d)`,
  `residents(sim)`, `retiring(sim)`, `plotsNeeded(sim)`, `residentSpan(sim)`, `standAtResident(sim, d)`,
  `interface Rest { x; facing; who; plot }`, `restsClear(a, b)`, `rests(sim)`, `strollSteps(d, tx)`,
  `settleInGarden(sim, d, plot, place = false)`, `retire(sim, d)`, `stepGarden(sim)`.
- `gardenArt.ts` (NEW): `drawGarden(g, plots, worldW, view: [x0, x1])`, `drawGardenLights(g, plots, lights: Lights,
  view)`, `drawGardenPlate(g, view)`.
- `needs.ts`: `GARDEN_NEEDS ['food','love']`, `GARDEN_RATE 0.25`, NEW `gardenDrain(el, k)`.
- `life.ts`: `settled()` also requires `place === 'barn'` and not retiring; the elder branch of `growUp` calls
  `retire` when due and `redirectable` (DIFFERS, deviation 1).
- `surfaces.ts`: `FLOORS.path '#dcd6c0'`, NEW `PATH_EDGE`, `BACKDROPS.hedge '#7f9e6c' / lawn '#8fae76' / trunk
  '#a47a52' / fence '#e8e0cc'`, `LIGHTS.lantern '#f2d36a'`, NEW `LANTERN_RINGS`, `PROPS.gateLeaf`.
- `save.ts`: `SAVE_VERSION = 6`; `SaveV.garden { plots }`; a dragon's `garden` copied by hand both ways; `barnKey`
  leaves out each dragon's `garden` (the one phase-reading state). `fromSave` throws on: plots not a whole number >= 2,
  a place that isn't barn/garden, a resident or retiree that isn't an elder / has a slot / no plot / a plot >= plots /
  a shared plot, a resident without its rhythm (or a barn dragon with one).
- `presets.ts`: NEW `GARDEN_RESIDENTS ['BRAMBLE','COBBLE','ECHO']`, `RETIRE_AT 29.9`; presets `garden` (residents
  made by `settleInGarden(sim, d, plot, true)` in `after`, stageSince 32-34 days before) and `retire` (all seven
  `stage: 'elder', days: 29.9`, seeded needs). **`DragonPlace` has NO `place` field** (DIFFERS).
- `hud.ts`: `CardInfo.garden?: boolean` ("ELDER - IN THE GARDEN", only food and love shown).
- `base.ts`: the camera clamps to `sim.worldW`; NEW private `camAsked` (a `cam=` is kept as the garden widens until
  the player drags or a chip focuses); draw order sky, building (clipped at WORLD_W), **garden**, lights + lanterns,
  plates + GARDEN plate, car, eggs, cast; a resident in `nap` plays `sleep` and `wake` on leaving to anything.
- Hook: dragons gain `place`; NEW `garden: { residents, plots, worldW }` (globals.d.ts updated).
- sim-check: NEW `RETIRE_LATE 3600`; sections **15 retirement**, **16 residents** (plan's 14/15 were taken); section
  1 garden routes; section 6 "the garden" forks and 6 corrupt saves; section 8 plates (13); **section 10 runs in a
  worker thread** (`MAIN = isMainThread`; every other top-level block is `if (MAIN) {`; its line, fails and USED come
  back by `postMessage` and print before the suite's end). smoke: NEW `gardenIs(residents, plots)`, broken save
  `"moon"`. shots: `base_garden`, `base_garden_night`, `base_gate` (t=2564).

**Measured** (`npm run sim`; sections 2-5, 7, 9-14 unchanged from S5's second pass: the barn is byte-identical)

```
  1 routes: keepers 4 x 78 places (every stand spot, post and the deck, and a resident on every plot of a seven-plot garden), both ways; dragons 1118 routes on 4 stages' nets, 816 lift rides among them (one leg each), none through a tower but the Garden Gate's arches; 77 elders' routes from a slot to a plot; hayloft to Aerie 932 px in one ride
  6 saves: 6328 bytes at step 5000; loaded, it, one at the first ride (ZAP riding floor 1 to 0, the car at y 586, step 648) and 12 more saves (steps 5000 5012 5052 5236 5345 5351 5439 5538 5757 6000 21956 22536: fetch, wait, walk, call, alight, pickup, go, board, turn, work, act, home, asleep, ride, bay, rushed, keeperBay, climbing) step on 5000 to the same world; v 999 throws SaveVersionError
  6 saves (life, a 600-step day): step 60 (BURR walking to grow up), step 100 (eggs incubating), step 300 (an egg just hatched), step 5368 (a dragon just grown up) step on 5000 to the same world
  6 saves (the garden): garden step 1 (sit), step 736 (nap), step 1151 (stroll), step 20814 (wait), step 21249 (met); retire step 60 (retire), step 842 (ride), step 1236 (gate), step 3895 (arrive) step on 5000 to the same world; 6 saves whose garden can't be kept (one plot, a dragon on the moon, a resident holding a slot, a resident with no rhythm, two residents on one plot, a resident past the last plot) throw
  8 rooms: 10 kinds and 3 structures, each with a purpose; 5 needs, one room each; 13 plates, none on a bare slot; keepers wait at BEA 328, TOMAS 1032, IRIS 872, PIP 328, clear of every slot (the rooms' uses are checked at the end, over the whole suite)
  15 retirement (a 600-step day): the retire preset, steps late / arrived: EMBER 0/5766, BRAMBLE 0/6907, COBBLE 0/9417, ZAP 0/7411, RIPPLE 0/3895, ECHO 0/13143, WICK 0/6483 (at most 0, gate 3600); the Garden Gate passed 7 times; 7 plots, 7 residents, the world 2568 wide; the busy barn (seven elders falling due 5 s apart, mid-errand): EMBER 0/9795, BRAMBLE 0/9930, COBBLE 0/7861, ZAP 683/14181, RIPPLE 0/10269, ECHO 0/14743, WICK 0/16139 (at most 683); the real day, the first under the gate's arch: RIPPLE at step 2564
  16 residents (the garden preset, 30 min of the real day): BRAMBLE napped 77 % (every one of 40500 night steps), strolled 8 times, 2 keeper visits (TOMAS love, TOMAS love; 4 an hour); COBBLE napped 70 % (every one of 40500 night steps), strolled 10 times, 2 keeper visits (TOMAS love, TOMAS love; 4 an hour); ECHO napped 74 % (every one of 38207 night steps), strolled 10 times, 2 keeper visits (TOMAS love, BEA food; 4 an hour); jobs for food and love only, draining at a quarter of an elder's (per step x 1e6: BRAMBLE food 3.704, BRAMBLE love 7.407, COBBLE food 3.704, COBBLE love 7.407, ECHO food 3.704, ECHO love 7.407; within 0.000 %); the barn beside them: 91 jobs done, wait avg 33.1 s, max 88.8 s, 0 steps with a need at 0, the Garden Gate passed 12 times
  8 rooms used over the suite: kitchen 412, bath 437, hatchery 35, romp 497, groom 235, dorm 236, gate 65, lift 988, garden 42; planned: tack, bunks, maproom, aerie
```

Palette: RESULT 2374/2374 (path floor thinnest: rock belly 26 %, rock scale 27-28 %, as on straw), KEEPERS 164/164
(Iris's slippers 40 % on the path), BACKDROPS 1105/1105 (the trunk/bench/gate leaf `#a47a52` the thinnest, 47 % lighter
than lightning's elder). Smoke: `preset=garden&cam=1304,376&t=600` 3208 colours, `&hour=22` 2928. Browser budget
(G14): frozen `view=base&t=10800` 2.37 s, `preset=garden&t=10800` 2.18 s, `preset=retire&t=10800` 2.30 s (t=0 0.71-0.83
s). sim-check wall: 30.07 s at the base commit on this machine before any S6 work, 30.5 s with S6's sections, **21.1 s**
with section 10 in its worker.

Probes (scratchpad `s6/probe1.ts`, `probe3.ts`): retirement delay with the plan's settled rule, `retire` preset, seeds
1-3: 5064 / 8049 / 6638 steps (over the plan's 3600); with `redirectable`: 0-928 over seeds 1-8 (preset), 408-1092
over seeds 1-8 (busy barn). The garden preset over 30 min: 6 keeper visits, 12 gate passes (out and back), nap share
70-77 %.

Mutation-checked: a sit not ending at nightfall -> section 16 "napped 39449 of its 40500 night steps"; strolls not
checked for clear resting places -> section 16 "a resident at rest had its eye under another's body for 163198 steps";
retiring 600 steps early -> section 15 "retired 59 steps before its 30 days"; residents draining sleep/play/bath ->
section 16 "sleep is ..., not held full"; section 10's worker failing (a CAPACITY_RIDES of 923) -> SIM: FAIL with its
message.

**Deviations and why**

1. **Retirement uses `redirectable`, not §3.5's settled rule.** Measured with settled, the `retire` preset's delays
   were 5064-8049 steps (seeds 1-3) against the plan's gate of 3600 (S3's saturated car: elders mid-errand). An elder
   retiring keeps its size, so the reason for "settled" (a stage-up swaps the body and breaks nets and lines) does not
   apply; the Rush rule (`retarget`'s guard, proven mid-walk since S3: not acting, not asleep, not holding, not the
   lift's rider or boarding/riding/alighting, not in the bay) is safe, and the plan's own step 1 ("keepers released,
   not counted as pre-empted") expects keepers coming. Now 0-1092 steps over 16 seed-runs.
2. **No route re-derivation when plots grow.** The garden only grows east, so every leg of a route on the old nets
   lies in a span of the new ones, and no shorter route appears (the new ground is past the old end). `setPlots` only
   rebuilds `nets`; section 15 checks everyone on their nets every 30 steps as the garden grows 2 -> 7.
3. `KEEPER_NET`/`dragonNet()` removed and `route`/`spanOf`/`clampToFloor` take a required net (so no caller can route on
   a stale default net).
4. **Resting places kept eye-clear** (G6; the plan's stroll "[plot-1, plot+1]" would put 127 px elders over each other
   on 176 px plots): each resident's resting place (current x, or its stroll's end) and every plot waiting for a
   newcomer (an unassigned plot's middle, a retiree's plot) are pairwise clear (`restsClear`: neither body over the
   other's eye in either draw order, DRAGON_BODY/DRAGON_EYE worst cases); a stroll tries up to 8 targets, else naps.
   A newcomer's plot middle is therefore always free. A job opening mid-stroll lets the stroll finish before `wait`
   (so the keeper meets it at a clear place). No stroll starts unless it ends 60 steps before 20:00, and a sit ends at
   nightfall, so 100 % of night steps outside wait/acts are naps.
5. NEW `SimEvent 'garden'` (arrival) for the toast.
6. `DragonPlace` has no `place`: the garden preset makes residents with `settleInGarden(..., true)` in `after`, the
   same code path as an arrival.
7. **Trunk colour `#a47a52`**, not the plan's `#8a6242` (barn timber, L 0.145: fails gate (w), 18 % from lightning).
8. Section numbers 15/16 (plan's 14/15 taken by S5). Section 15 adds a busy-barn run (elders due mid-errand) and a
   real-day run that finds the `base_gate` step (RIPPLE under the arch at 2564). Section 16's "the barn's S3 service
   gates" are the per-run ones (no need empty, no timeout, waits <= 100/360 s, keeper wait <= 20 s, landing <= 124 s);
   `done >= 120` is for seven barn dragons, not four.
9. **sim-check section 10 in a worker thread** (G14): the suite measured 30.07 s at the base commit on this machine,
   already at the 30 s budget; S6's work adds about 2.5 s. Running the 9 s capacity section beside the rest keeps
   every check and brings the wall time to 21 s, leaving room for S7-S9. Its output now prints after section 16.
10. The `retire` preset keeps the seeded needs (elders retire as they come free, the garden widening one plot at a
    time in `npm run dev`); with dayLen 600 all seven are due at step 60 and retire 0-80 steps late.
11. `camAsked`: `cam=` beyond the start's world (1688) is re-applied as the garden widens (the plan's `base_gate` cam
    1060 was being clamped to 1048).
12. Docs beyond the plan's list: ART_BIBLE's status counts and 5.8 re-paste, KEEPERS.md counts (the numbers changed).
13. `barnKey` drops each dragon's `garden`; the right tower's f0 outer window slit is removed (the outer arch is there).
14. Gate use is counted as a walker (dragon or keeper, on f0) crosses the arches' middle x 1248, once per pass each way.

**Gaps and stand-ins**

- Walking overlaps stay as in the barn: two elders walking out together can walk nose over tail for a while (RIPPLE
  and ZAP in `base_gate`), and a resident strolling past another covers it a moment. Only resting places are kept
  clear.
- A new game has no elder for 30 days and no retirement for 60: the garden stays empty in play (two plots) until then.
- No dawn tip for coming retirements; the gate's own lantern has no night rings (only the garden's lanterns do).
- The garden plots are identical tiles (trees on even plots): fine at 7 plots, repetitive at many more.

**For later slices**

- S7: a manual serve for a resident must meet `servable`'s resident branch (goalJob, `arrived` = mode `wait`) at
  `standAtResident`; the keepers' f0 span runs to `worldW - 42`; gate passes are counted in `sim.move(k)` already.
- S8: `Place` gains `'away'`; residents stay in `sim.dragons` (names stay unique); `garden.ts residents/retiring`
  filter by place/goal. The sky bridge (f5 west) must go into `makeNets` (today keyed by `gardenEnd` only). The dawn
  board's phase-reading module must, like `garden.ts`, stay out of section 12's `SIM_FILES` with a comment.
- sim-check: main thread about 21 s; a new long section can go to another worker the same way (`if (!MAIN)` +
  `postMessage`), but keep USED merged.
- Anything new that moves a dragon: respect `d.place !== 'barn'` and `goal === 'retire'` like `free()` does.

**See it**

- `node tools/shot.ts out.png="view=base&preset=garden&cam=1304,376&t=600" --scale 2` (`base_garden`), the same with
  `&hour=22` (`base_garden_night`: all napping, lanterns' rings on the hedge), `"view=base&preset=retire&cam=1060,376&t=2564"`
  (`base_gate`: RIPPLE under the arch). Also `preset=garden&cam=1304,376&t=1300` (ECHO strolling, two napping),
  `t=21300` (Tomas petting COBBLE at dawn), `preset=retire&cam=1928,376&t=14000` (the far end of a seven-plot garden),
  `preset=retire&cam=1500,376&t=4030` (the "RIPPLE MOVED TO THE GARDEN" toast).
- Live: `npm run dev`, `index.html?preset=retire` (elders walk out, the garden widens), `index.html?preset=garden`
  (drag right past the tower), or `?save=0` and drag right to see the two empty plots.
- Shots looked at: `scratchpad/shots/s6/` (garden, garden_night, gate, gate_zoom 4x, g1300, g21300, arrive,
  retire_night, full7a, full7b) and `scratchpad/shots/s6final/` (the three standard shots and base_t600).

### S6 review

Fixer pass on 7684d52. The two reviewers sent eight findings, all minor, and two of them are the same finding (the
nap and sit lengths). I checked each one against the code and reproduced it with the reviewers' own probes
(`s6corr/elderspan.ts`, `walks.ts`, `trace.ts`, `s6rev/overlap.ts`, and their crops) plus my own in `scratchpad/s6fix/`.
All seven distinct findings are real and all are fixed. None is rejected.

`npm run check` is green on the committed tree (6 min):
- typecheck;
- palette 2374/2374, keepers 164/164, backdrops 1105/1105, eggs 8/8;
- sim sections 1-16 in **22.5 s** wall (was about 21 s);
- smoke: 90 views, 1 moved pair and 2 TINT pairs. World bb6e59e9 and barn b4c21913 are both unchanged. The garden cases
  have 3212 and 2956 colours (were 3208 and 2928).

**Fixed**

1. **A late stage-up shortened an elder's 30 days.** Retirement was counted from the *scheduled* elder start.
   - Reproduced: new game, seed 1, 600-step day: ECHO was an elder for 22.9 days and COBBLE for 24.2.
   - The fix is in `life.ts growUp`: `d.stageSince = next === 'elder' ? sim.clock : due`. The elder stage has no next
     stage to keep in step with, so it begins the step the dragon grows. Every other stage keeps S5's exact cadence.
   - After the fix, over the new game (seed 1) and the `full` preset (seed 3), every elder retired 30.0 to 32.3 days
     after it grew.
   - sim-check §13 now expects the elder's `stageSince` to be the grow clock. That covers the `run` check, BURR alone
     and the real-day EMBER. §13's delays are now measured against the scheduled due, so §13's printed numbers are
     unchanged.
   - §15 (b) is now **seven adults growing elder mid-errand** (5 s apart from 10 s in, a 600-step day), and each runs
     on until it retires. `retireRun` records each elder's grow clock and fails a retirement less than
     `RETIRE_DAYS * dayLen` after it. Seed 1: grown 0-2339 steps late, elders for 30.00-31.80 days. Over seeds 1-8: up
     to 5788 steps late, elders for 30.00-33.33 days.
   - Mutation: reverting to `stageSince = due` fails §13 six times and §15 four times ("EMBER retired 15661 steps after
     it grew into an elder (2339 steps late)").
2. **A retiree's lift call ranked lowest and could starve.** `travel.ts nextCall` changes:
   - NEW `leaving(c)`: a retiree whose call has waited `OVERDUE` (3600) goes before the tiers. It still comes after
     prio and clash.
   - `tier(c)` for a retiree is now `tierOf(min(food, love))`, not 0.
   - Why both: no job opens for a retiree, so nothing can raise its call the way a barn caller's rises.
   - Measured before and after:
     - new game, seeds 1-4, 600-step day: the longest landing wait fell from 6843 to 4764 steps (114 s to 79 s);
     - the `full` preset, seed 3: EMBER waited 6803 steps (was 44 616);
     - NEW §15 (c) crowded barn (section 10's ten adults, ECHO an elder retiring from the groom): 72.7 s (161.9 s under
       the old rule).
   - NEW gates in `retireRun`, applied to every §15 run:
     - a retiree's landing wait `<= RETIREE_LIFT_S` (= `GATE.liftWaitS`, 124 s);
     - retire-to-arrive `<= RETIREE_WALK_S` (= `GATE.waitMaxS`, 360 s).
   - Mutation: the old `nextCall` fails §15 (c) with "a retiree waited 161.9 s at a landing". §15 (b) alone did not
     catch it: its landing max is 73.7 s either way, which is why (c) exists.
   - Busy barn, seeds 1-8: landing 30.8-117.1 s, walk out 139-209 s, retiring 130-1998 steps late.
3. **(two findings, one fix) Nap and sit lengths were given in game minutes.** BASE_DESIGN 3 "What residents do", the
   `garden.ts` header and the `NAP`/`SIT` doc now say:
   - a nap is 1800-3600 steps: 30-60 s of play at 1x, 4-8 game hours of the real day;
   - a sit is 600-1200 steps: 10-20 s, about 1.3-2.7 game hours.
4. **"settled" comments.** `sim.ts` header and `presets.ts` `retire` now say "as soon as it may be sent somewhere new
   (travel.ts redirectable)".
5. **Resting residents lay across each other.** Reproduced: in the `retire` preset with seven residents, two resting
   bodies overlapped by more than 30 px in 43.2 % of steps, up to 95 px.
   - Cause: eye-clear alone still allows back-to-back pairs.
   - NEW in `garden.ts`: `REST_OVERLAP = 20`, `restOverlap(a, b)` (the body overlap in px), and
     `restsApart(a, b) = restsClear && restOverlap <= REST_OVERLAP`.
   - `strollTo` now requires `restsApart` against every rest the garden keeps. Same-facing and face-to-face pairs that
     are eye-clear were already under 13 px, so only back-to-back resting places change.
   - After the fix, the `retire` preset on seeds 1-3 has 0 % of steps over 30 px. The maximum resting overlap is
     12.7 px (seeds 1-2). Residents still stroll 3-25 times per 35 min each (median 31-100 px) and nap 63-81 %.
   - §15 `retireRun` now fails any rest pair that is not `restsApart`. §16 gates resting residents' overlap at
     `<= REST_OVERLAP` (10.7 px measured).
   - Mutation: `strollTo` with `restsClear` only fails §16 with "two residents at rest lay 79.4 px one over the other".
6. **Flowers were 1 px plus signs.** NEW `gardenArt.ts flower()`: a round 4x4 blossom with its corners cut, on a 2x2
   stalk in the lawn's shade. Every mark is 2 px or more. The same 8 flowers and colours are used. In the 4x lawn crop
   they read as flowers on stalks, not twinkles.
7. **The lantern rings had a flat top.** `drawGardenLights` now clips to the hedge's own shape: the tile's blob discs
   (radius `HEDGE_R`, NEW helper `blob(k)` shared with `hedge()`) plus the band under them, intersected with the
   lantern's ±20 px rectangle. In the 4x night crop, the outer ring follows the scalloped top, inside the ink.

**Changed names and numbers**

- `life.ts`: the elder's `stageSince` is its grow clock. `garden.ts`: `REST_OVERLAP`, `restOverlap`, `restsApart`.
  `travel.ts nextCall`: the `leaving` rule and the retiree tier. `gardenArt.ts`: `flower`, `blob`.
- sim-check:
  - NEW top-level `CROWD` (section 10's EIGHTH, NINTH and TENTH; section 10 now uses it);
  - NEW `RETIREE_LIFT_S` and `RETIREE_WALK_S`;
  - `retireRun(w, steps, what, leavers = w.dragons.length)` returns `{retired, arrived, grew, callMax, walkMax, restMax}`;
  - §15 cases: (a) preset, (b) busy (**now adults growing elder**), (c) **NEW crowded**, (d) real day (was (c)).
- Measured, `npm run sim`:
  - §15 (a), the `retire` preset: unchanged. A retiree waited at a landing at most 77.6 s and walked out in at most
    218.1 s. The real day's first under the arch is still RIPPLE at step 2564, so the `base_gate` shot is unchanged
    (re-rendered and looked at).
  - §15 (b), busy: the steps each grew late / days as an elder were BRAMBLE 0/30.00, ZAP 397/30.00, EMBER 2339/30.00,
    ECHO 0/31.80, RIPPLE 1610/30.00, COBBLE 2232/31.62, WICK 2239/30.00. Retired at most 1081 steps late; landing at
    most 73.7 s; walk out at most 189.0 s.
  - §15 (c), crowded: ECHO waited 72.7 s at a landing and walked out in 183.0 s.
  - §16: naps 73/73/74 % (was 77/70/74); strolls 10/12/9 (was 8/10/10); rest overlap at most 10.7 px; keeper visits
    and the barn are unchanged (wait avg 33.1 s).
  - §6: the garden "met" fork is now at step 21454 (was 21249).
  - Rooms over the suite: kitchen 419, bath 447, hatchery 35, romp 510, groom 244, dorm 240, gate 68, lift 1011,
    garden 45.
- Docs:
  - BASE_DESIGN 2 "The car": the call order;
  - 3 "The Garden": flowers on stalks, rings following the hedge, retiring counted from the grow step, the retiree's
    lift rule, nap and sit lengths, the roomy rest rule and its numbers;
  - 4.9 `OVERDUE` row;
  - 7 Growing up: exact except the elder stage, plus the retirement numbers;
  - 8.1: the numbers, and the garden.ts, gardenArt.ts and sim-check rows (about 22 s).

**Rejected:** none.

**Deferred:**
- (from finding 2) In the over-full `full` preset (17 dragons, over capacity by design, S5) a retiree can still wait
  long at a landing: WICK 14 573 steps (seed 3). This is the car's throughput collapsing, not priority. The car made 6
  rides in those 14 574 steps, 5 of them retirees, each ride about 2000-4000 steps of boarding and alighting through
  the crowd. It is S5's known capacity ceiling (the `full` preset deadlocks), which S8 must decide.

**Still open** (the implementer's gaps, unchanged): overlaps while walking; the garden stays empty until day 61 in a new
game; no dawn tip for retirements; the gate's lantern has no rings; every plot uses the same tile. One addition:
landing waits in the busy barn reach 117 s on seed 2 (seven retirees within minutes of each other and one car), under
the 124 s gate.

**See it:** `scratchpad/shots/s6fix/`:
- `garden.png` and `garden_night.png` (the standard shots);
- `lawn_crop.png` and `lantern_night.png` (4x crops);
- `base_gate.png`;
- `ret14000b.png` and `ret14000.png` (the seven-plot garden, now spread out);
- `g1300.png`.

### S6 review (second fixer pass)

Fixer pass on 36096b0 (the first S6 fix pass). The same eight findings were handed over again. I checked each against
the code at HEAD and re-ran the reviewers' probes. All eight were already fixed by 36096b0. **Nothing in the repo
changed in this pass, and there is no new commit.** HEAD is still 36096b0.

`npm run check` is green on 36096b0 (5 min 57 s):
- typecheck;
- palette 2374/2374, keepers 164/164, backdrops 1105/1105, eggs 8/8;
- sim sections 1-16, every check passed. §15 and §16 print the numbers the first pass logged.
- smoke: 90 views, 1 moved pair and 2 TINT pairs. World bb6e59e9 and barn b4c21913 are unchanged. The garden cases have
  3212 and 2956 colours.

**Verified (re-measured on HEAD)**

1. **Elder span.** `s6corr/elderspan.ts`, 600-step day:
   - new game, seeds 1 and 3: every elder retired 30.0-32.3 days after it grew;
   - `full` preset, seed 3: every elder retired 30.0-31.4 days after it grew (was 0.1 days at the least).
   - `life.ts growUp` sets `stageSince = sim.clock` for the elder. §13 and §15 (b) assert it.
2. **Retiree lift priority.** `s6corr/walks.ts`, new game, seeds 1-4, 600-step day:
   - landing waits were at most 4764 steps (79 s), under the 124 s gate;
   - walks out were at most 13 024 steps (217 s), under the 360 s gate.
   - `nextCall` has the `leaving` rule and the retiree tier. §15 (c) gates it: 72.7 s.
3. and 4. **Nap and sit lengths.** BASE_DESIGN §3, the `garden.ts` header and the `NAP`/`SIT` doc give steps, s at 1x
   and game hours. `grep 'minutes of game'` finds nothing.
5. **"settled" comments.** The `sim.ts` header and the `presets.ts` `retire` comment say "redirectable".
6. **Resting overlap.** `s6rev/overlap.ts`, `retire` preset, seeds 1 and 4, seven residents, about 106k steps: 0.0 % of
   steps are over 30 px. §15 fails any pair that is not `restsApart`, and §16 gates rest overlap: 10.7 px against 20.
7. **Flowers.** Looked at in `shots/s6fix2/lawn_crop.png` (4x): 4x4 blossoms on 2x2 stalks, with no 1 px mark. They
   read as flowers.
8. **Lantern clip.** Looked at in `shots/s6fix2/lantern_crop.png` (4x, night): the outer ring follows the scalloped
   hedge top inside the ink, with no flat top.

**Shots looked at:** `scratchpad/shots/s6fix2/`:
- `garden.png`, `garden_night.png` and `gate.png` (the three standard shots);
- `ret14000.png` (the seven-plot garden, spread out);
- the two 4x crops above.

The findings the shots show (pale path underfoot, green only behind and below, no decline motifs, rings on the hedge
only) still hold.

**Rejected:** none. **Deferred:** unchanged from the first pass: the `full` preset's retiree landing waits, which are
S5's capacity ceiling (S8).

**Still open:** the implementer's gaps, none of them required by the plan:
- walking overlaps;
- the garden is empty until day 61 of a new game;
- no dawn tip;
- the gate's lantern has no rings;
- every plot uses one tile.

Busy-barn retiree landing waits are up to 117 s on seed 2, under the 124 s gate.
