# Final implementation plan: issues #5 to #11 (dragon-care)

Repo: `/home/user/dragon-care`. One branch, nine slices, worked in order by one implementation agent each.

**How to hand this out.** Every agent gets §1 (global rules), §2 (fixed decisions), §3 (shared reference) and
its own slice section (§6.x). A slice section is written to be complete on its own. Where it says "see §3" the
numbers are in the shared reference, which is part of every hand-off.

**Base.** The judges' two winners were *sim-first* and *delivery-first*. This plan uses sim-first's model and slice
shape (stable ids, exact saves, `stats.used` room proofs, deferred stage-ups, big baddies, a watchable scene). From
delivery-first it takes the central Dragon Lift at module 2, fixed slots, `SimOptions.dayLen`, a `PLANNED` set, the
LOST NEST egg mission, the planted-save smoke case and the early key isolation. From player-first it takes the HUD
keeper badges, the action-key label, the no-tint diff, the age card and dawn tips, BEST TEAM, the carried egg, the
HATCHERY FULL warning and the portrait hint. Every mustFix item from both judges is handled; §7 maps each one to
the slice that fixes it.

**Verified against the code while writing this plan** (so agents need not re-derive it):
- `DragonAnimPlayer.play()` sets `speed` to whatever it is passed, 1 by default. `tick()` advances `time` by
  `speed`, but `move` is the current frame's `move`, and speed does not scale it (`src/art/dragon/anim.ts:185, 214–272`).
  A pet whose walk plays at speed s must therefore move its body by s × `move` per step, or its paws skate.
  `makePet` plays its first anim at the seeded `build.speed` (±10 %) when desync is on (`src/game/pet.ts:69`).
- Walk root motion is **not constant**. Measured headless over one cycle:
  - baby walks (a 1-in-6 stumble), spike's creep and slinkwing's pointer pause all have frames with `move = 0`;
  - so do spike's and slinkwing's young, adult and elder walks (for example, the adult spike walk: 24 of its 120
    steps at 0, average 0.28 px/f against the tuning's 0.35);
  - the other five elements' young, adult and elder walks are constant.

  So a dragon cannot be moved at a constant pace without skating. The walk frames (`dur`, `move`) are
  **seed-independent** (all 28 element × stage walks were checked on seeds 11, 215 and 999), and they build under
  plain Node in about 20 ms each.
- Dragon body extents (`extentX`: behind and ahead of the root x), as the maximum over elements and seeds:

  | Stage | Back (px) | Front (px) |
  |---|---|---|
  | baby | 26.5 | 29.8 |
  | young | 54.4 | 41.8 |
  | adult | 70.7 | 50.8 |
  | elder | 74.7 | 52.0 |

  Hence the per-stage pad in §3.
- Body scale luminance (L) at every stage:

  | Element | L |
  |---|---|
  | slinkwing | 0.053 |
  | dusk | 0.083 |
  | lightning | 0.119 |
  | spike | 0.17 |
  | fire | 0.21–0.23 |
  | water | 0.34 |
  | rock | 0.485 |
- Candidate surface colours:

  | Colour | Use | L | S | Gate (i) |
  |---|---|---|---|---|
  | `#e0d6b8` | straw | 0.674 | 0.18 | passes |
  | `#dcd6c0` | garden path | 0.671 | 0.13 | passes |
  | `#dcd6c4` | mission road | 0.673 | 0.11 | passes |
  | `#8a6242` | current Aerie deck | 0.145 | | **fails** |
  | `#a47a52` | current hoist car | 0.224 | | **fails** |
  | `#5a4436` | current hoist shaft | 0.066 | | **fails** |
  | `#d8c890` | current dorm beds | 0.579 | | **fails** |

  The gate (i) window is L 0.649 to 0.682 with S < 0.20.
- The gallery's `keydown` handler (`src/gallery.ts:1350–1358`) runs in `view=base` today: E and the digits rebuild the
  world, and the arrows and Space leave the view. `KeeperPlayer`'s inner engine `AnimPlayer` has a public `speed` field
  (`src/lib/art/animation.ts:169`). `src/art/keeper/player.ts` is game code and may be edited.
- `makeRng` instances can be reseeded but not read (`src/lib/engine/rng.ts:65`). `shots/` is gitignored;
  `docs/base/*.png` is tracked.

---

## 1. Global rules (every slice)

- **G1 Determinism.**
  - Fixed 60 Hz steps. Every loop runs in id order, and every tie is broken by id.
  - The only randomness after construction is `rngAt(seed, TAG, ...keys)` (§3.7). The constructor's starting-needs
    draw stays `makeRng(seed)`.
  - No `Math.random`, `Date` or `performance` in `src/game/**`. The one exception is `freshSeed()` for the NEW GAME button.
- **G2 Vendored engine and dependencies.** `src/lib/**` is vendored: never edit it. No runtime dependencies. Tools run under Node 22 (`node tools/x.ts`).
- **G3 Green checks.** Each slice ends with `npm run check` green (typecheck, palette, sim, smoke) and with the slice's
  listed shots rendered by `node tools/shot.ts …` and looked at. Add new standard shots to `tools/shots.ts`.
- **G4 Frozen time.** `view=base&t=N` means N calls of `BaseView.step()` on a fresh `new BaseView(opts)`, at speed 1,
  with no input, no wall clock and **no localStorage read or write**. The constructor never touches storage. Loading
  happens only in `attach()`, and only when `opts.persist` is set, which the gallery sets only when `t` is absent and
  `save=0` is not given. Every month-scale view (growing up, the garden, eggs, trips) is built from a code preset,
  never by stepping for hundreds of thousands of steps.
- **G5 Smoke opts out of saving.** Every live `view=base` smoke case passes `save=0`. The one exception is the
  persistence case (S4), which runs in its own page.
- **G6 House style and tone.**
  - Style: a 1 px `#1a1018` outline, flat cel bands lit from the top left, and no gradients (light is stepped
    rings or bands).
  - Size and fades: marks at least 2 px, and alpha changes in 3 steps at most. Floor-level effects fade by shrinking.
  - Draw order: nothing is drawn over a dragon's eye. Keepers sort at `y − 3`, behind dragons on the same floor.
  - Tone: no angry faces, nobody hurt, and an elder is never drawn as declining.
- **G7 Floors and backdrops.** Every surface a dragon or keeper stands on is a `FLOORS` entry in
  `src/game/surfaces.ts`. It must pass gates (i) and (Ki) and HSV S < 0.20 in `tools/palette-check.ts` **before**
  any dragon stands on it. From S4, every sky band, wall and backdrop a dragon is seen against is a `BACKDROPS` or
  `WALLS` entry and passes gate (w) (§3.8).
- **G8 Night is not a tint.** Night never tints a dragon: no `tint`, `tintAlpha` or `flash` by time of day, and
  `flash` is used only for the grow-up. Night lives only in the sky layer and the lights layer. **The barn's care
  simulation never reads the day phase.** Only garden residents' naps (S6) and the dawn mission board (S8) do.
- **G9 Hook and input safety.**
  - Every change to `window.__dragonCare.base` updates `types/globals.d.ts` in the same slice.
  - No HUD control may sit under canvas (350, 200), where the smoke drag starts.
  - Keepers are selected only on a non-drag `pointerup`.
  - A chip tap still adds exactly 1 Rush.
- **G10 Saves.** Every new piece of simulation state is serialized, with references stored as ids, in the same slice
  that adds it, and `SAVE_VERSION` goes up by one. The save-continuation test (§3.6) must cover it.
- **G11 Docs.** Each slice updates the docs it lists, in the same change. Measured numbers are pasted, not guessed.
- **G12 Room purposes (#11).** Any mechanic that uses a room adds to `sim.stats.used[key]`. sim-check keeps the
  `PLANNED` set (§3.9). A named, furnished room with no use fails the check unless it is in `PLANNED`. A room in
  `PLANNED` that shows a use also fails, so the entry must be removed.
- **G13 Walking pets.**
  - A dragon's position comes from the sim.
  - The sim moves it by the walk anim's own per-frame `move` (§3.4, `gait.ts`).
  - The view plays `walk` with `restart: true, speed: 1` at the start of every walk bout, identified by
    `d.walkSeq`.
  - Never change a dragon walk's `speed` without scaling its body motion by the same factor.
- **G14 Budgets.**
  - `BaseView.step()` costs at most 0.5 ms per simulation step with the start cast. 8x costs at most 4 ms per frame.
  - sim-check runs in 30 s or less. Long-horizon checks use `dayLen: 600`.
  - A frozen base page must load inside smoke's 30 s `goto`.
- **G15 Stay in scope.** Build what the slice says. Record a follow-up in the doc's status lines rather than building it.

---

## 2. Fixed decisions

### 2.1 The orchestrator's decisions (quoted in short)

- **D1 (#9).** "Young adult" means the **adult** stage 0 days in. One adult per element: fire, spike, rock,
  lightning, water, slinkwing and dusk. The twelve-dragon set goes; views that need every stage build their own casts.
- **D2 (#8).**
  - Stages go baby → young → adult → elder, 30 game days each.
  - A day is a fixed number of steps at 1x.
  - A HUD speed control cycles 1x/2x/4x/8x, plus pause.
  - Night is shown by the sky, windows, lamps and building; it never tints a dragon and stays mid-value.
  - Save and load to localStorage are in scope. The `t=` contract and headless tests never read or write saves.
- **D3 (#10).**
  - An elder retires 30 days after becoming an elder.
  - The garden is outside, next to the barn, and its size grows with its residents.
  - Residents sleep a lot, wander, and have few needs that drain slowly.
  - Its floor passes gate (i), so there is no green underfoot.
- **D4 (#5).**
  - Baddies are cozy: outwitted, calmed or driven off, never killed, and nobody is hurt. B8 is amended to say so.
  - Missions are launched from the Map Room table. Teams leave from, and return to, the Aerie on the left tower's roof.
  - Eggs go to the Hatchery and hatch into babies that age.
- **D5 (#6).**
  - Tap or click a keeper to take them.
  - WASD or the arrows walk them and climb at links.
  - E or Space collects a supply or does the chore for the dragon in reach.
  - Esc, tapping empty space, or a release button hands them back.
  - The keeper you control is excluded from auto-assignment. There are touch buttons.
- **D6 (#7 + #11).**
  - Each need is met in its own room by a keeper: the dragon walks there, including between floors, and a keeper meets it.
  - Every named, furnished room has a real purpose; the rest are removed or left unnamed and unfurnished.

### 2.2 Plan decisions (binding on every slice)

- **P1 The Dragon Lift.**
  - Barn module 2 (x 488–648) becomes the Dragon Lift, from the ground floor up through the roof to the Aerie.
  - Stops: f0, f1, f2 and f5 (the Aerie). Floors 3 and 4 are passed through.
  - One car, one dragon rider, a 152 px deck (the longest elder is 137 px).
  - Calls are served by priority (§3.4).
  - Dragons and keepers crossing the lift bay on a floor obey the **bay rule** (§3.4), so a moving car never overlaps
    anyone. Keepers never ride the lift.
- **P2 The ladder bay.**
  - The hay hoist becomes the **centre ladder bay** (x 648–712): a keeper ladder at x 680 on floors 0–2, with straw
    floors running straight across it on every floor. The hoist car, its pulley and the HOIST plate go.
  - Why: dragons now walk across the middle of the barn, and the shaft's `#5a4436` fails gate (i). A car passing
    through floors that dragons stand on would clash with them.
- **P3 The Aerie.**
  - The Aerie is walkable **floor 5**: feet at `feetY(5) = 136`, straw band y 128–142, slab to 152.
  - It is one deck from x 8 to 648: over the left tower's top (56–168), a trussed gantry over the barn roof (168–488),
    and the lift head (488–648).
  - `ladderL` is extended to f5.
- **P4 One room per need.**
  - The rooms: KITCHEN for food, BATHHOUSE for bath, ROMP ROOM for play, GROOMING PARLOUR for love and LAMP DORM for sleep.
  - Each has fixed dragon **slots** (§3.3).
  - A dragon **reserves** a slot in its need's room and walks there. A keeper meets it at the slot's fixed stand spot.
  - Rooms no longer regenerate needs: `ROOM_REGEN` is removed in S3.
- **P5 Final named rooms and plates.** See the table in §3.2. Everything else is bare and unnamed.
- **P6 Gait tables.**
  - The sim moves a walking dragon by the walk anim's own per-frame root motion, read headless from the same anim
    tables (`gait.ts`), at speed 1.
  - Dragons do not hurry, even under Rush. Rush gives queue and lift priority, and the keeper runs.
- **P7 Randomness.** All randomness after construction comes from stateless `rngAt`. No RNG state is ever saved.
- **P8 Saves.**
  - Saves are exact: everything is serialized by id.
  - `digest()` is the serialized world minus the seed.
  - Live storage is used only from `attach()`, through `src/game/storage.ts`, the only file that touches localStorage.
- **P9 Time.**
  - `DAY_STEPS = 10 800`: 3 minutes at 1x. `HOUR_STEPS = dayLen / 24` (450).
  - The game starts at 07:00 on day 1.
  - Phases: DAWN 5–7, DAY 7–18, DUSK 18–20, NIGHT 20–5.
  - `STAGE_DAYS = 30`, `RETIRE_DAYS = 30`, `HATCH_DAYS = 2`.
  - Tests may pass `SimOptions.dayLen = 600`.
- **P10 Speed.** Speed is view-only: `BaseView.step()` runs `speed` whole world steps (0, 1, 2, 4 or 8). Frozen views are always at speed 1.
- **P11 The garden.**
  - The garden lies right of the right tower, through the **Garden Gate** (right tower, f0: a dragon-sized arch in both walls).
  - Plots are 176 px, and the world grows to the right.
  - From S4 the sky is drawn in screen space, so no canvas grows with the world.
- **P12 Keeper control.**
  - Player control is given as commands, applied at the start of the next step.
  - A manual serve is only possible at the dragon's **reserved slot in its need's room**, or at a garden resident's
    spot, which keeps D6.
- **P13 Missions.**
  - Six regions. Terrain challenges are countered by element and people challenges by rider skill.
  - The riders are the four keepers, with skills Bea CHARM, Tomas MEDIC, Iris NAVIGATOR and Pip NIMBLE.
  - Partner = the keeper whose specialty is the dragon's own need.
  - A team is 1 or 2 pairs, one team out at a time, and **at least 2 keepers always stay home**.
  - Lengths are 1, 2 or 3 game days. Away dragons' needs are frozen.
  - The team leaves by walking west off the Aerie over a **sky bridge**. This stands in for `fly`, which is not
    built, and rock cannot fly anyway.
- **P14 Baddies.**
  - Three baddies, 96–140 px, with their own palette gate.
  - Faces: neutral, grumpy (a flat brow, never a V), surprised or sleepy.
  - Exits: `calmed`, `outwitted` or `drivenOff`. The type has no hurt or defeat state.
- **P15 No keeper night shift in v1.** Keepers who are resting stay assignable. The barn keeps no keeper day/night
  rhythm in v1, which settles the §9 night-shift question as "deferred".

---

## 3. Shared reference

### 3.1 Geometry (world px; the existing constants in `layout.ts` are kept)

**Grid constants and floor heights**

- Grid: `MOD 160`, `PITCH 112`, `WALL_H 88`, `BAND 14`, `SLAB 10`, `GROUND 712`, `WORLD_H 760`.
- `WORLD_W 1360` stays as the building canvas's width. From S6 the world's walkable width is `sim.worldW`.

| Floor | `floorTop(f)` | `feetY(f)` | Band top |
|---|---|---|---|
| f0 | 600 | 696 | 688 |
| f1 | 488 | 584 | |
| f2 | 376 | 472 | |
| f3 | 264 | | |
| f4 | 152 | | |
| f5 (Aerie) | 40 | 136 | 128 |

**Barn modules, towers and ladders**

- Barn modules `modX(i)`: m0 168, m1 328, **m2 488 (Lift)**, then the ladder bay 648–712, then m3 712, m4 872,
  m5 1032. The barn's right end is 1192.
- Towers:

  | Tower | Shell | Room interior | Keeper span | Ladder |
  |---|---|---|---|---|
  | Left | 56–168 | 64–160 | TL = [74, 150] | `ladderL` x 140 |
  | Right | 1192–1304 | 1200–1296 | TR = [1210, 1286] | `ladderR` x 1220 |

**The lift**

- Constants: `LIFT_X0 488`, `LIFT_X1 648`, `LIFT_CX 568`, car deck 492–644, `LIFT_STOPS [0,1,2,5]`, `LIFT_SPEED 1.0` px/step.
- Route cost per floor: 112 × 1.25.

**The Aerie**

- `AERIE_F 5`, `DECK_X0 8`, `DECK_X1 648`.
- From S8 a sky bridge runs west from x 8 to x −200, off-world, for teams leaving and landing.

**Links**

| Link | x | Stops | Who uses it |
|---|---|---|---|
| `ladderL` | 140 | 0–5 | keepers |
| `ladderR` | 1220 | 0–4 | keepers |
| `ladderM` | 680 | 0–2 | keepers (replaces `hoist`) |
| `lift` | 568 | 0, 1, 2, 5 | dragons only |

**Keeper spans**

| Floor | Spans |
|---|---|
| f0, f1 | [74, 1286] |
| f2 | TL, [184, 1176], TR |
| f3, f4 | TL, TR |
| f5 | [18, 638] |

- From S6, f0 runs to the garden's end, `sim.worldW − 42`.
- From S8, f5 extends west to −200.

**Dragon pad** (half-body, from the measured extents): `DRAGON_PAD = { baby: 30, young: 56, adult: 72, elder: 76 }`.

**Dragon spans for pad P**

| Floor | Span | Notes |
|---|---|---|
| f0 | [168+P, 1192−P] | extends through the Garden Gate to `worldW − 32 − P` from S6 |
| f1 | [168+P, 1192−P] | |
| f2 | [328+P, 1032−P] | keeps dragons out from under the low roof slopes of m0 and m5; the elder span is [404, 956] |
| f5 | [8+P, 648−P] | extends to −200 from S8 |
| f3, f4 | none | |

### 3.2 Rooms after S2

| Where | Kind | Plate | Purpose (`RoomInfo.purpose`) | Mechanic (the `stats.used` key) | Slots / post / station |
|---|---|---|---|---|---|
| f0 m0–1 | `kitchen` | HEARTH KITCHEN | meets food; keepers take the bowl at the hearth | job met, bowl pickup (`kitchen`) | 2 slots; post x 232; BEA |
| f0 m2 … f5 | (lift) | LIFT | carries dragons between floors and up to the Aerie | ride completed (`lift`) | – |
| f0 m3–4 | `bath` | BATHHOUSE | meets bath; the bucket is filled at the tub | job met, bucket (`bath`) | 2 slots; post x 938 |
| f0 m5 | `hatchery` | HATCHERY | eggs lie in 3 nests and hatch into babies | egg laid or hatched (`hatchery`) | 2 baby sub-slots only; nests x 1062, 1112, 1162 |
| f1 m0–1 | `romp` | ROMP ROOM | meets play; the ball box by the wheel | job met, ball (`romp`) | 2 slots; post x 275; PIP |
| f1 m3–5 | `groom` | GROOMING PARLOUR | meets love (the busiest need: it is the own need of spike, rock and slinkwing) | job met (`groom`) | 3 slots; post x 832; TOMAS |
| f2 m3–4 | `dorm` | LAMP DORM | meets sleep; a keeper tucks the dragon in | job met (`dorm`) | 2 slots; post x 872; IRIS |
| L f0 | `tack` | TACK ROOM | riders take saddles before a mission and hang them back after | saddle taken or returned (`tack`) | post x 112 |
| L f2 | `bunks` | BUNKS | riders rest after a mission | a rider arrives to rest (`bunks`) | post x 112 |
| L f4 | `maproom` | MAP ROOM | the mission table: the world map and the chooser | a mission sent (`maproom`) | table rect x 70–130, y 172–208 |
| roof | (deck) | AERIE | teams gather, leave and land | a team leaves or lands (`aerie`) | muster spots x 120, 280 |
| R f0 (S6) | `gate` | GARDEN GATE | the dragons' way out to the garden | a dragon or keeper passes (`gate`) | straw floor band |
| outside (S6) | (garden) | GARDEN | the retired elders' home | a resident arrives, or has a job met (`garden`) | plots of 176 px |

**Unnamed and bare** (no plate, no props, `EMPTY_WALL` or the plain stone wall plus the ladder):

- the barn's f2 m0, m1 and m5;
- the left tower's f1 and f3;
- the right tower's f1–f4 (the right tower's f0 until S6).

**Removed kinds:** `store`, `haystore`, `attic`, `sunloft`, `roost`, `mess`, `library`, `workshop`, `infirmary`,
`lookout`, and two of the three `bunks`. The Nursery is dropped from the docs.

### 3.3 Slots

`Slot { room: number; i: number; f: number; x: number; facing: 1 | -1; baby: boolean; mod: number }`.

**Module slots and facing**

- A module slot sits at the module's centre, `modX(m) + 80`. Facing:

  | Room width | Facings |
  |---|---|
  | 1 module | toward the post |
  | 2 modules | +1, −1 (the two dragons face each other, so their keepers work between them) |
  | 3 modules | +1, +1, −1 |
- Each module also has two **baby sub-slots**, at `modX(m) + 40` (facing +1) and `modX(m) + 120` (facing −1).

**Occupancy:** a module holds **either** one non-baby **or** up to two babies. The hatchery holds babies only.

**Stand spot**

- The stand spot is `standSpot(slot, stage, room) = { f, x: clamp(slot.x + slot.facing·REACH[stage], room.x0+10, room.x1−10) }`,
  with `REACH` baby 30, young 46, adult 58, elder 60. It is always inside the room and never across a wall.
- Adult stand spots:

  | Room | Stand spots (x) |
  |---|---|
  | kitchen and romp | 306 / 350 |
  | bath and dorm | 850 / 894 |
  | groom | 850 / 1010 / 1054 |

**Start slots (S2 onward)**

| Dragon | Slot |
|---|---|
| EMBER | kitchen 0 |
| RIPPLE | bath 0 |
| ZAP | romp 0 |
| BRAMBLE | groom 0 |
| COBBLE | groom 1 |
| ECHO | groom 2 |
| WICK | dorm 0 |

### 3.4 Movement (S3 onward)

**Gait**

- `gaitOf(el, stage)` holds the walk anim's `frames[] {dur, move}`, its `len` (the sum of the durs) and `avg`.
- `moveAt(g, t)` returns the `move` of the frame containing anim time `t` (frame i covers [cumᵢ, cumᵢ₊₁), wrapping at `len`).
- The walk bout's first step is t = 1. The step then:
  1. does `gaitT += 1`;
  2. moves `x += facing · moveAt(gaitT)`.

  This exactly mirrors `DragonAnimPlayer.tick` at speed 1 after `play('walk', {restart: true})`, which the view
  calls in the same `BaseView.step` whenever `d.walkSeq` changes.
- The last step of a leg clamps to the target.

**Turning.** A reversal is a paper turn of `TURN_STEPS = 6` steps with no motion. The facing flips at step 3,
which matches `care/dragon.ts` `TURN_HALF 3, TURN_W 0.8`.

**Lift calls**

A dragon whose next leg is a lift leg does the following:

1. It waits at the landing **outside** the bay: at x = `LIFT_X0 − P` from the left, or `LIFT_X1 + P` from the right (`move: 'call'`).
   No slot's body reaches into the bay (the kitchen and romp slot 1 end at x 483 or less, and every m3 slot starts at
   721 or more), so a waiting caller may overlap a lingerer, but never blocks the car.
2. It pushes a call `{dragon, f, to, tick, prio}`.

The car serves calls in this order:

1. `prio` (2 = a mission muster or return, 1 = a rushed job, 0 = anything else);
2. then the call's tick;
3. then the dragon's id.

A call is served in four stages:

1. the car goes to `f`;
2. the rider walks in to `LIFT_CX` (`board`) and turns to face its exit side;
3. the car carries it (`ride`, `y` follows the car);
4. the rider walks off (`alight`).

`stats.used.lift++` on arrival. One rider at a time.

**The bay rule** (for the lift bay x 488–648 on the served floors f0, f1, f2 and f5)

- **R1.** A walker (a keeper, or a dragon that is not the car's rider) does not **enter** the bay while
  `lift.moving || lift.closing`. It waits at the edge: a keeper at 478 or 658, a dragon at `488−P` or `648+P`.
- **R2.** The car starts a move only when no walker's extent overlaps the bay on any floor from its current floor to
  its target, inclusive. A dragon's extent is x ± P; a keeper's is x ± 10.
- **R3.** If a waiting departure has been blocked for `BAY_CLOSE = 240` steps, `lift.closing = true`: R1 also blocks
  entry until the car moves.
- **R4.** A walker already inside the bay never stops there. A player-controlled keeper whose input stops while inside
  keeps walking the way they face until they are clear.
- **Invariant:** while `lift.moving`, no walker overlaps the bay on any floor within the car's travel range.

### 3.5 Clock (S4) and stages (S5)

**The clock**

- `clock = clock0 + tick`, with `clock0 = hour·HOUR_STEPS` (default 7 × 450 = 3150).
- `readClock(clock, dayLen)` returns `{day (1-based), hour, minute, phase, blend}`. `blend` runs 0..3 in three
  stepped thirds of the first hour of a phase.

**Stages**

- A stage-up is due at `clock − stageSince ≥ 30·dayLen`, and applies only when the dragon is **settled**:
  - no act;
  - no job with a keeper on it;
  - no legs;
  - not riding;
  - not waiting at the bay or a call;
  - place `barn`.

  It then sets `stageSince += 30·dayLen` (exact) and advances the stage.
- Retirement follows the same rule at 30 days into the elder stage (S6).

### 3.6 Saves

**Format and storage**

- `serialize(sim): SaveV` is JSON-safe, with every reference stored as an id. `CareSim.fromSave(s)` rebuilds the
  simulation exactly. `SAVE_VERSION` starts at 1 in S1, and every slice that adds state bumps it.
- `digest() = JSON.stringify(serialize(sim))` without the `seed` field (the seed is kept out so that "seeds 7 and 8
  differ" is a real check).
- `barnKey(sim)` is the JSON of the dragons, keepers, jobs and lift, with absolute clock fields left out. It is used
  by the no-tint check.
- The hook publishes `digest` as an 8-hex FNV-1a hash.
- Storage key: `dragon-care/base`. `storage.ts` is the only file that touches localStorage.
- An unknown version or a corrupt blob starts a new game without throwing. The old blob is copied to
  `dragon-care/base.bak`, and a toast reads "NEW BARN: THE OLD SAVE DIDN'T FIT".
- A controlled keeper is always serialized as released: `phase: 'home'`, no job, with a route home rebuilt on load.

**The continuation test** (sim-check, every slice from S1)

1. Run a simulation 5000 steps.
2. Make `b = CareSim.fromSave(JSON.parse(JSON.stringify(serialize(a))))`.
3. Step both 5000 more.
4. Their digests must be equal.

Each slice adds its own round-trip scenario:

| Slice | Scenario |
|---|---|
| S3 | mid-ride |
| S5 | an egg incubating |
| S6 | garden residents |
| S7 | control released on load |
| S8 | mid-muster and mid-away |

### 3.7 `rngAt`

`src/game/rand.ts` (S1):

- `mix32(...keys: number[]): number` is a murmur3-fmix chain over 32-bit ints.
- `rngAt(seed, tag, ...keys) = makeRng(mix32(seed, tag, ...keys) || 1)`.
- `TAG = { BOARD: 1, MISSION: 2, EGG: 3, NAME: 4, GARDEN: 5, REGION: 6, SKY: 7 }`.

Only `seed` is ever saved.

### 3.8 Palette gates (`tools/palette-check.ts`)

- **(i)/(Ki), from S2.** These are looped over every `FLOORS` entry in `src/game/surfaces.ts`, not only
  `FLOOR_REF`. An assert of `hsv.s < 0.20` is added for every floor.
  - `FLOORS` starts as `{ straw: '#e0d6b8' }`.
  - Later entries: `path` `#dcd6c0` (S6) and `road` `#dcd6c4` (S8/S9).
  - Everything a dragon stands on uses one of these: the lift car deck, the landings, the ladder-bay floors, the
    Aerie deck and gantry, the sky bridge and the Garden Gate floor.
- **(w), from S4: backdrops.** Every `BACKDROPS` and `WALLS` colour must be:
  - at least 25 % in luminance from every body scale with L < 0.15 at every stage (lightning 0.119, dusk 0.083,
    slinkwing 0.053), and
  - at least 6 okL from ink.

  A backdrop therefore needs L ≥ about 0.16. This closes BASE §9's "wall gate" question.
- **Eggs (S5).** Each element's baby scale colour must be at least 25 % in luminance from the nest colour.
- **(x), baddies (S9).**
  - Every baddie fill must be at least 25 % from `FLOORS.road` and from its region's backdrop bands, and at least
    6 okL from ink.
  - Faces come from the allowed set, which the type enforces.

### 3.9 Room-use bookkeeping (#11)

- `sim.stats.used: Record<string, number>` is written by the mechanics listed in §3.2.
- sim-check keeps a suite-wide `USED` map, and every section calls `noteUse(sim)`.
- At the end of the suite, every named kind in `START_ROOMS`, plus `lift` and `aerie` (and `gate` and `garden` from
  S6), must have `USED > 0`, **unless** it is in `PLANNED`.
- Every kind in `PLANNED` must have `USED === 0`, so a mechanic that lands forces its removal.
- The timeline:

  | Slice | `PLANNED` |
  |---|---|
  | S2 | {lift, hatchery, tack, bunks, maproom, aerie} |
  | S3 | lift removed |
  | S5 | hatchery removed |
  | S8 | tack, bunks, maproom, aerie removed; `PLANNED` is empty and S8 asserts `PLANNED.size === 0` |
- Also checked:
  - every `RoomKind` has a non-empty `purpose`;
  - each `NeedKind` is `meets` of exactly one kind.

### 3.10 Query parameters (`view=base`), final

| Param | Meaning | Slice |
|---|---|---|
| `seed=` | world seed (default 1) | existing |
| `t=` | frozen: t steps, then draw | existing |
| `cam=x,y` | camera start (world px) | S1 |
| `preset=` | a code-built start (see each slice) | S1+ |
| `save=0` | no load and no autosave (live) | S1 parsed, S4 effective |
| `hour=` | start hour 0–23 (sets `clock0`) | S4 |
| `layers=world` | draw only the building, cars, cast, bubbles and plates: no sky, lights, HUD, toasts or card | S4 |
| `panel=map\|mission\|watch` | open that overlay | S8/S9 |
| `mission=<i>` | board index for `panel=mission` | S8 |
| `trip=<region>:<progress>[:fail]` | with `preset=trip`: a team away at that progress | S9 |

### 3.11 HUD layout at 640×360 (final)

**Top bar** (y 0–15, INK `#1a1018`)

| x | Contents | Slice |
|---|---|---|
| 3 | 9×9 sun or moon sprite | |
| 16 | `DAY 3 14:00` | |
| 90 | `JOBS n` | |
| 138, 186, 234, 282 | four **keeper badges**, 46×13 each at y 1: an ink box, a 5×7 chip in the keeper's primary colour, the name, and a state glyph (● busy, ▼ controlled, ↗ away, z resting) | S4 display, S7 tappable |
| 334 | `COIN n` | S8 |
| 528–554 | `NEW` | |
| 558–574 | `II` (pause) | |
| 578–606 | `>1X` (cycle) | |
| 610–636 | `MAP` | S8 |

Buttons are 1 px ink boxes on `#3a2e34` with `#f3e6c8` text, and `#6b4a34` when active.

**Glyphs.** The vendored 5×7 font (`src/lib/engine/text.ts`) has:

- A–Z and 0–9;
- `. , : ; ! ? ' " - + / ( ) % > < & = * [ ] # @ $`;
- ▶ ♥ ← → ↑ ↓ ★.

It has **no** ◀ ▲ ▼ ● ✓ ✕ ↗ · —. Where this plan's on-screen text shows `·` or `—`, draw ` - `. Where it shows
✓, ✕, ●, ▼, ▲, ◀ or ↗, draw a small inked letter sprite with `drawSprite` (`ICONS.check` is the ✓). The pad's
direction buttons use the font's ← → ↑ ↓.

**Other screen furniture**

| Item | Where | Slice |
|---|---|---|
| Toasts | centred at x 320, y 20, outlined text, 180 frames | |
| TEAM OUT chip | x 520, y 19, 114×15 | S8 |
| Dragon card | x 8, y 20, 160×76 | S5 |
| Job strip | unchanged: y 339, chips from x 6 (5 chips end near x 345) | |
| Hint | right-aligned at (634, 343) in `#b8ac8e`; hidden while a keeper is controlled | |

**Touch pad** (S7, only while controlling)

| Button | Rect (x, y, w, h) |
|---|---|
| ▲ | (562, 272, 26, 26) |
| ◀ | (534, 300, 26, 26) |
| ▶ | (590, 300, 26, 26) |
| ▼ | (562, 328, 26, 26) |
| ACT | (476, 318, 48, 36), labelled `E` |
| LET GO | (476, 298, 48, 16) |

The context label is right-aligned at (632, 258).

`START_CAM` is (168, 376) from S2. The smoke drag needs `camX` to grow by more than 100, and from 168 the maximum
is 720 or more.

---

## 4. Slice order and dependencies

| # | Slice | Depends on | Issues (main) |
|---|---|---|---|
| S1 | Foundation: seven young adults, stable ids, options, the save format, key isolation | – | #9 (closes); enablers for #8 and #6 |
| S2 | The building rebuilt: rooms with purposes, the Dragon Lift, the Aerie floor, floor-safe surfaces | S1 | #11 (layout) |
| S3 | Dragons walk to their needs | S2 | #7 (closes); #11 need rooms |
| S4 | Time: the clock, day and night, speed, live saves | S3 | #8 (day/night, speed, saves) |
| S5 | Growing up, eggs and hatching | S4 | #8 (ageing; closes); #5.4 hatchery side; #11 hatchery |
| S6 | The elder garden | S5 | #10 (closes); #11 gate and garden |
| S6b | Barn capacity (addendum) | S6 | #7/#8/#5.4 enabler: the herd eggs grow |
| S6c | Night you can see (addendum) | S6b | #8 day and night |
| S7 | Take a keeper | S3 (and S4 for the HUD) | #6 (closes) |
| S8 | Missions I: the Map Room table, world map, climate, team, the Aerie trip, rewards | S5, S7 | #5.1, 5.2, 5.3 (up front), 5.4, 5.6; #11 (closes) |
| S9 | Missions II: the watchable scene, challenges on the road, big baddies, and the final integration | S8 | #5.3 (on the road), #5.5; #5 closes |

The order is strictly sequential, on one branch. S7 could run straight after S3, but it stays at 7 so that S4's HUD
and saves exist for it to extend. Nine slices is one over the 6–8 target. The reason is that missions are split
model+UI / scene as asked, and eggs are kept apart from the (already large) time slice. If eight are wanted, fold S5
into S4 and accept a large S4.

---

## 5. Traceability

| Issue | Criterion (the user's words) | Slice | How it is proven |
|---|---|---|---|
| #9 | "You should start with a young adult dragon of each kind." | S1 | sim-check: 7 dragons, 7 distinct elements, all `adult`, `clock − stageSince = 0`; the hook's dragons in smoke |
| #8 | "take a 'month' of game time to have a dragon grow from one age class to another" | S5 (clock S4) | sim-check: stage-ups exactly 30·dayLen apart (plus the settle delay); one real-length check |
| #8 | "Include day night cycles" | S4 | smoke: `hour=22` is night; the no-tint diff (`layers=world`); the backdrop gate (w) |
| #8 | "and a speed toggle" | S4 | smoke live: the speed button reads 2x; the 8x tick delta is 4x or more the 1x delta; pause freezes the tick |
| #8 | (D2) saves | S1 format, S4 live | the continuation test; the planted-save frozen case; the live reload case |
| #7 | "Dragons are presently stationary and pinned … They should move around the rooms by needs." | S3 | sim-check: every dragon meets its needs in 4 or more rooms, and x changes; smoke: the hook's x differs between t=600 and t=3600 |
| #7 | "Each room should be where a need is fulfilled" | S2, S3 | one `meets` kind per need; every act happens at a slot of `NEED_ROOM[need]` |
| #7 | "which need to be done by a trainer" | S3 | `ROOM_REGEN` removed; a need rises only through a keeper's act |
| #11 | "Rooms should only be named and have special furniture if the room has a real purpose" | S2 (then S3, S5, S6, S8) | the purpose table plus `stats.used` over the whole suite; `PLANNED` is empty at S8 |
| #11 | "1) A dragon need." | S2, S3 | kitchen, bath, romp, groom and dorm used by jobs met |
| #11 | "2) A human or other action." | S3, S5, S6, S8 | lift rides; eggs in the hatchery; gate and garden passages; tack, bunks, map room and aerie use in missions |
| #10 | "a special garden next to the barn" | S6 | the Garden Gate plus the garden right of the right tower; `garden` used |
| #10 | "grow with size as the dragons get more numerous" | S6 | `plots = max(2, residents)`, and the `worldW` formula, asserted |
| #10 | "too old (30 days pass elder) will move to this area" | S6 | retirement exactly 30·dayLen after becoming an elder, plus the settle delay |
| #10 | "sleep a lot and move around" | S6 | residents nap in 50 % or more of steps and always at night, and stroll |
| #10 | "not have a lot of needs. So the humans don't need to take care of them as much" | S6 | only food and love, at ×0.25; the measured keeper-visit rate |
| #6 | "choose a person - then you will control them and be able to do this chores" | S7 | smoke: tapping a badge or body sets `controlled`; sim-check: a scripted feed done by BEA |
| #6 | "Uses standard WASD controls" | S7 | smoke: holding `d` moves the keeper; W and S climb at a ladder (sim-check) |
| #6 | "a button to feel [feed]/collect stuff" | S7 | E, Space or ACT: pick up a supply, serve, put back |
| #5.1 | "a picture of the kind of climate and a mission chooser" | S8 | the mission screen: a climate picture plus the chooser; smoke `panel=mission` |
| #5.2 | "a world map with different places to explore" | S8 | the map screen with fogged regions; reveals on success, asserted |
| #5.3 | "challenges that occur on the mission - and dragon and people that are good solutions" | S8 (up front plus the log), S9 (the scene) | the chooser's GOOD lines; stops in the scene; a failure turns back at the first uncovered stop |
| #5.4 | "We can get eggs on a mission." | S5, S8 | a rider carries the egg to a nest; it hatches into a baby that ages |
| #5.5 | "Some of the missions might end with a big baddie." | S8 (board, B8), S9 (the beat) | baddie missions on the board; a 96–140 px baddie beat with a cozy exit |
| #5.6 | "Missions should be launched from the aerie using the map room." | S8 | the Map Room table → SEND → muster on the Aerie → away → land on the Aerie |

---

## 6. Slices

### S1 — Foundation: seven young adults, stable ids, options, the save format, key isolation

**Closes #9.** Criterion: *"You should start with a young adult dragon of each kind."* Under D1, a new game has
seven dragons, one per element, all `adult`, each 0 days into adulthood.

This slice also lays foundations that later slices need:

- stable dragon ids and an id-keyed cast in the view, needed for hatching, departures and growing up;
- `SimOptions` (`seed`, `dayLen`, `clock0`);
- the exact save format and a digest built from it;
- stateless randomness;
- code presets for casts that need every stage;
- the gallery's key handler kept out of `view=base`.

**Depends on:** nothing. **Must not:** move dragons, change rooms, or touch localStorage.

**Files**

| Action | File | What |
|---|---|---|
| change | `src/game/start.ts` | new `START_DRAGONS` (below); `DragonPlace.days?: number`; new header comment |
| change | `src/game/sim.ts` | `SimOptions`; stable ids (`nextDragonId`); `Dragon.stageSince`; `clock`; `events`; `fromSave`; `digest()` delegates to `save.ts` |
| new | `src/game/save.ts` | `SAVE_VERSION = 1`, `serialize`, `worldKey`, `barnKey`, `fnv1a` |
| new | `src/game/rand.ts` | `mix32`, `rngAt`, `TAG` (§3.7) |
| new | `src/game/presets.ts` | `StartSpec`, `PRESETS`, `startSpec(name)` |
| change | `src/game/base.ts` | `BaseView(opts: BaseViewOpts)`; the cast in a `Map` keyed by dragon id; the hook |
| change | `src/gallery.ts` | parse `cam`, `preset`, `save`; build `BaseView` with opts; the `keydown` handler returns first thing when `P.view === 'base'` |
| change | `types/globals.d.ts` | the base hook's new fields |
| change | `tools/sim-check.ts` | re-baselined, plus new sections |
| change | `tools/smoke.ts` | the base cases |

**The start cast** (names and seeds kept; in S1 they stay in today's rooms):

| Dragon | Element | Seed | Room | at | facing |
|---|---|---|---|---|---|
| EMBER | fire | 11 | kitchen | 0.62 | +1 |
| BRAMBLE | spike | 164 | groom | 0.38 | +1 |
| COBBLE | rock | 215 | sunloft | 0.55 | +1 |
| ZAP | lightning | 113 | romp | 0.4 | +1 |
| RIPPLE | water | 79 | bath | 0.3 | +1 |
| ECHO | slinkwing | 266 | roost | 0.35 | +1 |
| WICK | dusk | 181 | dorm | 0.28 | +1 |

All are `stage: 'adult'`, `days: 0`. The old twelve move, unchanged, into `PRESETS.ages` ("every element and every
stage among them"). `START_KEEPERS` is unchanged.

**Types**

```ts
// sim.ts
export interface SimOptions { seed?: number; dayLen?: number; clock0?: number }   // defaults 1, 10800, 7*450
export type SimEvent = { kind: 'none' };   // a union that later slices extend ('grow' | 'hatch' | 'retire' | 'depart' | 'land' | 'board')
export interface Dragon { /* existing */ stageSince: number /* clock at the stage's start */ }
export class CareSim {
  constructor(rooms: readonly RoomPlace[], dragons: readonly DragonPlace[], keepers: readonly KeeperPlace[], opts?: SimOptions);
  readonly seed: number; readonly dayLen: number; readonly clock0: number;
  tick: number; get clock(): number;              // clock0 + tick
  events: SimEvent[];                             // cleared at the start of every step
  nextDragonId: number; nextJob: number;          // public, so they can be saved
  static fromSave(s: SaveV): CareSim;
  digest(): string;                               // = worldKey(this)
}
// start.ts
export interface DragonPlace { name: string; element: DragonElement; stage: Stage; seed: number; room: RoomKind; at: number; facing: 1 | -1; days?: number }
// save.ts
export const SAVE_VERSION = 1;
export interface SaveV { v: number; seed: number; dayLen: number; clock0: number; tick: number; nextDragonId: number; nextJob: number;
  rooms: RoomPlace[]; dragons: DragonSave[]; keepers: KeeperSave[]; jobs: JobSave[]; stats: SimStats }
export function serialize(sim: CareSim): SaveV;       // every reference as an id; arrays in sim order
export function worldKey(sim: CareSim): string;       // JSON.stringify(serialize(sim)) without `seed`
export function barnKey(sim: CareSim): string;        // dragons + keepers + jobs (+ lift from S3), absolute clock fields left out
export function fnv1a(s: string): string;             // 8 hex digits, for the hook
// presets.ts
export interface StartSpec { rooms: readonly RoomPlace[]; dragons: readonly DragonPlace[]; keepers: readonly KeeperPlace[]; opts?: SimOptions; after?: (sim: CareSim) => void }
export const PRESETS: Readonly<Record<string, () => StartSpec>>;   // S1: { ages }
export function startSpec(name: string | null | undefined): StartSpec;   // unknown or null -> the START set
// base.ts
export interface BaseViewOpts { seed: number; cam?: { x: number; y: number } | null; preset?: string | null; persist?: boolean }
```

- `stageSince = clock0 − round(days · dayLen)`.
- Dragon ids come from `nextDragonId++` in construction order, so the starters are 0–6.
- `DragonSave` holds every `Dragon` field. A `Room` is stored by its id; an `Act` as a plain object.
- `KeeperSave` holds every field, with `station` stored as a room id and `job` as a job id.
- `JobSave` stores `dragon` and `keeper` as ids.
- `fromSave` rebuilds the rooms with `placeRooms(s.rooms)`, then relinks every reference.

**The view** (`base.ts`)

- Replace `pets[]`, `waking[]` and `bowls[]` with `cast: Map<number, PetView>`, where
  `PetView { pet: Pet; waking: boolean; bowl: …|null; stage: Stage }`.
- `syncCast()` runs once per step:
  - it creates a `PetView` for any dragon id it has not seen;
  - it deletes views whose dragon is gone;
  - it rebuilds a view (`makePet(el, stage, seed, 'idle', …)`) when `d.stage !== view.stage`.
- `tap()` and the bubbles look pets up by `d.id`. The depth jitter stays at `(d.id % 3) − 1`.
- The constructor calls `startSpec(opts.preset)`, builds `new CareSim(spec.rooms, spec.dragons, spec.keepers,
  { ...spec.opts, seed: opts.seed })`, then runs `spec.after?.(sim)`.
- `opts.cam` sets the starting camera, which is clamped.
- `persist` is stored and **unused** until S4.

**The gallery**

- `cam=x,y` is parsed to numbers; `preset=` is a string.
- `save` is parsed so that `save=0` gives `false`.
- `persist = P.t == null && P.save !== false`.
- The `keydown` listener's first line is `if (P.view === 'base') return;`.

**The hook** (`__dragonCare.base`, which `types/globals.d.ts` must match): add

- `digest: string` (the `fnv1a` of `worldKey`);
- `dragons: { id: number; name: string; element: string; stage: string; f: number; x: number }[]`.

**sim-check** (all sections numbered and printed)

1. **Routes**: unchanged logic, 7 dragons.
2. **Thirty minutes**: unchanged invariants and gates (`done ≥ 60`, `emptySteps 0`, wait average ≤ 30 s, maximum ≤ 120 s). Print the new numbers.
3. **Determinism**: two seed-7 runs agree every 1000 steps up to 20 000, and seed 7 and seed 8 differ at step 0.
4. **Rush**: unchanged. It still holds, because 7 dragons against 4 keepers leaves some jobs waiting.
5. **The start cast**: 7 dragons with 7 distinct elements, every one `adult`, `clock − stageSince === 0`, and ids 0–6 unique.
6. **Save continuation** (§3.6), seed 1. Also check that `serialize` survives a `JSON` round trip unchanged
   (`deepEqual`), and that `fromSave` of a blob with `v: 999` throws a typed `SaveVersionError`. S4's storage
   layer catches that error.
7. **rngAt**:
   - the same keys give the same sequence;
   - different tags give different first draws;
   - the mean of 10 000 draws is within 0.49–0.51.

**smoke**

- Every live base case gets `save=0`: `view=base&save=0` becomes the `baseInput` case.
- Add `check?: (hook) => string[]` to `Case`.
- **New, frozen:** `view=base&t=600`. Check that the hook has 7 dragons, all `adult`, with 7 elements.
- **New, frozen:** `view=base&preset=ages&t=60`, `minColours: 150`. The hook's stages include baby, young, adult and elder.
- **New, live, `baseKeys`** on `view=base&save=0`:
  1. Wait until `tick > 30` and read it as a.
  2. Press `e`, `E`, `ArrowRight`, `ArrowLeft`, Space and `5`, 50 ms apart, then wait 300 ms.
  3. Assert: the canvas is still 640×360, the hook exists, and `tick ≥ a + 10`. Before the fix, E rebuilt the world
     (tick reset) and ArrowRight left the view.

**Shots** (add to `tools/shots.ts`): `base_t600`, `base_t3600` and `base_ages` (`view=base&preset=ages&t=60`). Inspect them:
seven adults on screen in the base shots; every stage in `base_ages`.

**Docs**

- **BASE_DESIGN §8.1:**
  - `start.ts` row: "the starting base: the mockups' rooms, seven newly adult dragons (one per element, 0 days into
    adulthood) and the four named keepers".
  - Re-measure and paste the sim numbers.
- **BASE_DESIGN, a new line under Decisions or in §1:** "*Young adult* in the user's request (#9) means a dragon at
  the very start of the adult stage; the stage before adult is called *young*."
- **ART_BIBLE:** rename the `young` stage's label "young adult" to "young" at l.6, the 2.1 table header (l.265), 2.6
  (l.467 "**Young.**"), l.1185 and l.1314. Nothing else changes.

**Done when**

- `npm run check` is green.
- The three shots are rendered and look right.
- In `npm run dev`, pressing E or the arrows no longer resets or leaves the base.

---

### S2 — The building rebuilt: rooms with purposes, the Dragon Lift, the Aerie floor, floor-safe surfaces

**Advances #11.** Criterion: *"Rooms should only be named and have special furniture if the room has a real
purpose… 1) A dragon need. 2) A human or other action."*

This slice lays down the final room set of §3.2:

- one room per need;
- the purposeless rooms removed;
- the rooms whose mechanic lands later tracked in `PLANNED`.

It also builds the geometry for #7 (the lift and the per-stage dragon spans), #5 (the Aerie as floor 5) and D3/G7
(every floor gated).

**Dragons stay stationary in this slice.** Each stands in its start slot, room regeneration is kept, and keepers
serve them where they stand.

**Depends on:** S1. **Must not:** make dragons walk, or remove `ROOM_REGEN`. Both happen in S3.

**Files**

| Action | File | What |
|---|---|---|
| change | `src/game/layout.ts` | kinds, `RoomInfo`, slots, nets, links, the lift and the Aerie, per-stage spans, `route(from, to, net)` |
| new | `src/game/surfaces.ts` | `FLOORS = { straw: '#e0d6b8' }`, `INK`, `EMPTY_WALL`; S4 adds `WALLS` and `BACKDROPS` |
| change | `src/game/start.ts` | the §3.2 rooms; `DragonPlace` uses `slot` instead of `at` |
| change | `src/game/presets.ts` | `ages` placed in slots |
| change | `src/game/sim.ts` | regeneration by the `meets` of the dragon's room; `stats.used`; `standAt` via `standSpot` |
| change | `src/game/building.ts` | the redraw (below) |
| change | `src/game/base.ts` | `START_CAM (168, 376)`; draw the lift car parked at f0; the hoist car removed |
| change | `src/gallery.ts` | `STRAW` (l.68) → `FLOORS.straw` |
| change | `tools/palette-check.ts` | gates (i) and (Ki) over every `FLOORS` entry, plus the S < 0.20 assert |
| change | `tools/sim-check.ts` | routes on both nets, the purpose table, `USED`/`PLANNED` |
| change | `tools/smoke.ts` | re-baseline only |

**Types** (`layout.ts`)

```ts
export type RoomKind = 'kitchen' | 'bath' | 'hatchery' | 'romp' | 'groom' | 'dorm' | 'tack' | 'bunks' | 'maproom';   // S6 adds 'gate'
export interface RoomInfo {
  name: string;
  /** Why the room exists (#11): a dragon need or a human / other action. Never empty. */
  purpose: string;
  /** The need a keeper meets here (one kind per need). */
  meets?: NeedKind;
  /** The supply keepers pick up at the post: the bowl, the ball, the bucket. */
  supplies?: NeedKind;
  post?: number;
  people?: boolean;
  /** 'module' slots, 'baby' sub-slots only (the hatchery), or none (people rooms). */
  slots?: 'module' | 'baby';
}
export interface Slot { room: number; i: number; f: number; x: number; facing: 1 | -1; baby: boolean; mod: number }
export interface Room { id: number; kind: RoomKind; part: Part; floor: number; x0: number; x1: number; slots: Slot[] }
export interface Link { name: 'ladderL' | 'ladderR' | 'ladderM' | 'lift'; x: number; stops: readonly number[] }
export interface Net { spans: readonly (readonly (readonly [number, number])[])[]; links: readonly Link[] }
export const LIFT_X0 = 488, LIFT_X1 = 648, LIFT_CX = 568, LIFT_STOPS = [0, 1, 2, 5] as const, AERIE_F = 5, DECK_X0 = 8, DECK_X1 = 648;
export const DRAGON_PAD: Readonly<Record<Stage, number>> = { baby: 30, young: 56, adult: 72, elder: 76 };
export const KEEPER_NET: Net;
export function dragonNet(stage: Stage): Net;         // cached per stage (S6: rebuilt when the garden grows)
export function route(from: Spot, to: Spot, net?: Net): { legs: Leg[]; cost: number } | null;   // net defaults to KEEPER_NET
export function spanOf(f: number, x: number, net?: Net): number;
export function clampToSpan(f: number, x: number, net: Net, near: number): number;   // inside the span that holds `near`
export function standSpot(slot: Slot, stage: Stage, room: Room): Spot;               // §3.3
export function bayFloors(): readonly number[];      // LIFT_STOPS
```

**Rooms, slots and routes**

- `placeRooms` throws for any barn room that covers module 2, the lift.
- Slots are built per §3.3.
- `ROOM_INFO` holds exactly the rows of §3.2, each with its `purpose` string, and the posts of §3.2.
- `route()` becomes a Dijkstra over `net.links`, with one node per (link, stop):
  - consecutive stops are joined by an edge costing `|Δy| · 1.25` (so the lift's 2→5 edge is one edge);
  - edges along a floor exist only between nodes in the same span of that net;
  - ties go to the lower node index, as today.
- Keeper spans and dragon spans are exactly as in §3.1. `LINKS` in `KEEPER_NET` are `ladderL` (0–5), `ladderR`
  (0–4) and `ladderM` (x 680, 0–2); in the dragon nets, only `lift`.
- **Start slots:** as in §3.3. The keepers' stations are unchanged by kind (BEA kitchen, TOMAS groom, IRIS dorm, PIP
  romp), and their station x is the post of §3.2.

**Simulation**

- `standAt(d)` becomes `standSpot(slotOf(d), d.stage, room)`. Each starter records its slot in `d.slot`. The slot
  type is defined here; its reservation semantics come in S3.
- Regeneration uses the `meets` of the dragon's slot's room.
- `stats.used[kind]++` fires when a job starts work in a room with `meets`, and when a supply is picked up. That
  gives kitchen, bath, romp, groom and dorm.

**The building** (`building.ts`; every hex that a dragon or keeper stands on comes from `FLOORS`)

- **Gone:** the props, walls and plates for the removed kinds; the hoist car (`drawHoistCar`); the ridge pulley; the
  `HOIST` plate; the hatchery's baked eggs; the Sun Loft beam; the sky-coloured Lookout window.
- **The lift bay** (x 488–648, every barn floor):
  - The back wall is `#a8987e` (L 0.32). Draw it as vertical rails, a 2 px timber frame and cross-braces.
  - On f0, f1 and f2 a straw landing (the band plus a slab, like a room's floor) runs across the bay.
  - Above f2 the shaft runs up **outside** the `ROOF_IN` clip: a timber housing from the roof line up to y 120,
    topped by a headframe with a pulley disc at y ~112.
  - Export `drawLiftCar(g, y)`, drawn in the world layer after the building and before the cast:
    - an ink-outlined car deck spanning x 492–644, whose straw band's top is at `y − 8`, with a `#6b4a34` underframe;
    - side rails 2 px wide, 40 px tall;
    - two 1 px cables up to the headframe.

  In S2 the car sits parked at `feetY(0)`.
- **The ladder bay** (x 648–712):
  - The back wall is `EMPTY_WALL` `#9a8a76` (L 0.26).
  - Straw bands and slabs run across on f0, f1 and f2, so the floor is continuous.
  - The centre ladder (x 680) runs through floors 0–2, with a hatch drawn in each slab.
- **The Aerie deck:**
  - A straw band (y 128–142) and a slab (142–152) run from x 8 to x 648.
  - Over x 168–488 it is a gantry: 2 px railings, and a truss of 3 px diagonal members down to the roof and the
    tower. The old deck at y 144 goes.
  - The flag stays at the deck's west end.
  - `ladderL` is drawn up through f4's ceiling to the deck.
- **Rooms:**
  - The romp room is f1 m0–1: the wheel at x+50, the ball box at x+96, bunting from x+110.
  - The grooming parlour is f1 m3–5: the brush rack at x+100.
  - The lamp dorm is f2 m3–4. Its beds become low pallets **behind** the band (top y ≤ `t + WALL_H − 2`, never on the
    band). Its lamps hang at x+40 and x+280. The hayloft skylight moves to the right slope above the dorm, at about
    x 880–930.
  - The hatchery (f0 m5) gets 3 empty nests at x 1062, 1112 and 1162: straw mounds `#e6dcc4` with an ink outline and a
    `#b8a47a` rim, sitting on the back edge of the band with their tops above the band.
  - The tack room, bunks and map room keep their props. The bunks is at L f2 only.
- **Plates:** `LIFT` at (495, `floorTop(0)+3`); `AERIE` at (12, 112); one per named room, as today. No plate goes on an
  unnamed slot.

**Palette check**

- Import `FLOORS` from `src/game/surfaces.ts`.
- Loop gates (i) and (Ki) over every entry, and add `(i) <floor> saturation < 0.20` as a counted gate.
- `FLOOR_REF` becomes `FLOORS.straw`. The report prints one block per floor.

**sim-check**

- **§1 Routes:**
  - `KEEPER_NET`: from every keeper's station to every slot's stand spot (for every stage that fits the slot), every
    supply post, the tack, bunks and map-room posts, and the deck at (5, 300). Both ways.
  - `dragonNet(stage)` for every stage: from every slot that fits the stage to every other such slot and to the deck
    spots (5, 120) and (5, 280), both ways.
  - Every leg of a dragon route has x in [168, 1192] on f0–f2, and f5 legs stay in [8, 648]. That is, no tower span.
  - Every `standSpot` lies in its room's [x0+10, x1−10], on the room's floor.
- **§8 Rooms (#11):**
  - every `RoomKind` has a non-empty `purpose`;
  - each `NeedKind` is the `meets` of exactly one kind;
  - there is no plate for a kind missing from `ROOM_INFO`;
  - the `USED`/`PLANNED` rule of §3.9, with `PLANNED = {lift, hatchery, tack, bunks, maproom, aerie}`.
- **§2 (thirty minutes):** passes unchanged with stationary dragons in slots. Re-measure and print.

**smoke:** the existing base cases pass. The t=600 page still shows 150 or more colours.

**Shots:** `base_t600`, `base_t3600`, and `base_aerie` (`view=base&t=60&cam=0,0`). Inspect for:

- the lift bay with its car parked at f0;
- straw floors across both bays;
- the deck, gantry and headframe above the roof;
- no plate on any bare slot;
- the dorm beds behind the band.

**Docs**

- **BASE_DESIGN §2:**
  - The Dragon Lift: module 2, a 152 px car ("an elder, at most 137 px, fits"), stops at f0, f1, f2 and the Aerie.
  - The hoist becomes the keepers' centre ladder bay, and why: the floor gate, and no car passing through floors
    that dragons stand on.
  - The Aerie is walkable floor 5, with its gantry.
  - Update the measures table.
- **BASE_DESIGN §3:** rewrite the room table with a **Purpose** column and a **Built** column (the slice that makes
  it used). Drop the Nursery, the stores and the attic, and the duplicate love rooms: one room per need, with
  Grooming meeting all love. Drop the Library, Workshop, Infirmary, Lookout and Mess.
- **BASE_DESIGN §4.6:** note that regeneration goes in S3.

**Done when**

- `npm run check` is green, including the new floor gates.
- The rooms table matches §3.2.
- The shots show the new building.

---

### S3 — Dragons walk to their needs

**Closes #7.** Criteria:

- *"Dragons are presently stationary and pinned in the rooms. They should move around the rooms by needs."*
- *"Each room should be where a need is fulfilled - which need to be done by a trainer."*

Under D6, a dragon with an open need walks, riding the lift between floors, to that need's room. A keeper meets it
there, and nothing else raises a need.

**Advances #11:** the need rooms and the lift are proven used.

**Depends on:** S2.

**Files**

| Action | File | What |
|---|---|---|
| new | `src/game/gait.ts` | walk root-motion tables (§3.4) |
| new | `src/game/travel.ts` | slots, goals, eviction, dragon walking and turning, the lift, the bay rule |
| change | `src/game/sim.ts` | step order; `servable`; the keeper `wait` phase; Rush retargeting; `ROOM_REGEN` and job closing removed; stats |
| change | `src/game/needs.ts` | delete `ROOM_REGEN` |
| change | `src/game/pet.ts` | the paper turn: `p.turn` |
| change | `src/game/base.ts` | sync position, facing, walk, turn and the riding y; the car at `lift.y` |
| change | `src/game/people.ts` | `wait` → `watch`; walk and carry played at `speed = pace / KEEPERS[look].speed` |
| change | `src/art/keeper/player.ts` | add `setSpeed(s)` (sets `inner.speed`) |
| change | `src/game/save.ts` | serialize the new state; `SAVE_VERSION` 2 |
| change | `types/globals.d.ts`, `tools/sim-check.ts`, `tools/smoke.ts` | |

**Types**

```ts
// gait.ts (DOM-free; imports dragonBuild, dragonAnims, the element specs)
export interface Gait { frames: readonly { dur: number; move: number }[]; len: number; avg: number }
export function gaitOf(el: DragonElement, stage: Stage): Gait;       // built once per (el, stage) from dragonAnims(stage, spec, dims).walk, seed 1
export function moveAt(g: Gait, t: number): number;                  // the frame containing anim time t, wrapping at len

// sim.ts
export type DragonMove = 'still' | 'walk' | 'turn' | 'call' | 'board' | 'ride' | 'alight' | 'bay';
export type DragonGoal = 'need' | 'evict';   // extended later: 'settle' (S5), 'retire' (S6), 'muster' | 'return' (S8)
export interface Dragon {
  /* S1 fields; `room` (home) removed */
  slot: Slot | null;            // reserved (heading there) or held (standing there)
  goal: DragonGoal | null;      // why it is moving (null: lingering in its slot)
  goalJob: number | null;       // the job it is going to, or being served for
  legs: Leg[]; move: DragonMove; gaitT: number; walkSeq: number; turn: number; waited: number;
}
export type Phase = 'idle' | 'fetch' | 'pickup' | 'go' | 'wait' | 'work' | 'home';
export interface LiftState { y: number; f: number | null; target: number | null; rider: number | null; moving: boolean; closing: boolean;
  blockedSince: number; calls: { dragon: number; f: number; to: number; tick: number; prio: 0 | 1 | 2 }[] }
export class CareSim { lift: LiftState; /* … */ }
export interface SimStats { /* S1 fields */ dragonWalked: number; liftRides: number; liftWaitMax: number; keeperWaitSum: number; keeperWaits: number;
  waitTimeouts: number; evictions: number; slotBumps: number; used: Record<string, number> }

// travel.ts
export const NEED_ROOM: Readonly<Record<NeedKind, RoomKind>>;   // food kitchen, bath bath, play romp, love groom, sleep dorm
export const TURN_STEPS = 6, LEAD_PX = 300, WAIT_MAX = 7200, BAY_CLOSE = 240, LIFT_SPEED = 1;
export function stepTravel(sim: CareSim): void;   // goals and reservations, then walking, then the lift
export function arrived(sim: CareSim, d: Dragon): boolean;   // at d.slot.x, facing slot.facing, not turning
export function remainingCost(sim: CareSim, d: Dragon): number;
```

**Step order** (`CareSim.step`)

1. `tick++`; clear `events`.
2. Needs drain; acts progress.
3. Jobs open. There is **no** closing without an act; `stats.closed` stays 0.
4. `stepTravel`:
   1. dragons choose goals, in queue order of their top job, then by id;
   2. dragons walk or turn, obeying R1;
   3. the lift steps, obeying R2 and R3.
5. `assign()`, then keepers step, obeying R1.

**Choosing a goal** (a *free* dragon has no act, is awake, and is not riding, boarding, alighting or in a bay wait):

- Its target is the top open job by `compare`. The exception: if one of its open jobs is met in the room it stands in,
  and that job is in the same tier as the top job, it takes that job instead and saves the walk.
- If it already holds a slot in `NEED_ROOM[j.need]`, then `goalJob = j.id` and no move is needed.
- Otherwise it reserves the lowest-index free slot of its size in that room:
  - a module slot, or for a baby a sub-slot;
  - a module counts as free if no non-baby holds or reserves it, and, for a non-baby, no baby either.

  It releases its old slot and routes there on `dragonNet(stage)`.
- If the room is full, it **evicts** a lingerer: a holder with no `goalJob` for that room, no act, not walking, and no
  keeper coming. It picks the lowest id among those. The lingerer gets the nearest free slot of its size in any
  dragon room (by route cost, ties by room id then slot index) and walks there (`stats.evictions++`). If nothing is
  free anywhere, there is no eviction: the requester stays put and its bubble keeps showing.
- Re-targeting mid-walk happens only at a leg boundary, and never while riding or boarding.

**Lingering.** After its act a dragon keeps its slot, with no goal, until it leaves for another need or is evicted.
There is no home room.

**Keepers**

- A job is `servable` when all of these hold:
  - `d.goalJob === j.id`;
  - `d.slot` is in `NEED_ROOM[j.need]`;
  - the dragon is `arrived`, **or** `remainingCost ≤ LEAD_PX`, **or** `j.rushed`;
  - the dragon is awake;
  - no other keeper is on this dragon.
- `claim`: fetch the supply at the room's post, then walk to `standSpot(d.slot, d.stage, room)`.
- If the keeper arrives first, it enters `wait` (`watch` anim). Work starts on the first step the dragon is `arrived`.
- If a wait passes `WAIT_MAX`, the keeper releases the job (`waitTimeouts++`, which sim-check requires to stay 0).
- `standAt` is always the slot's fixed spot. This removes the latent through-the-tower-wall bug.

**Rush**

- The job goes to the top of the queue, as today.
- If its dragon is not going for it and has no act, the job becomes its goal at once. The dragon reserves a slot in
  that room; if the room is full, it may **bump** the lowest-ranked holder whose keeper has not started work
  (`slotBumps++`). The bumped dragon re-plans.
- Any lift call gets `prio 1`.
- Keeper selection and pre-emption are as today. Pre-emption only picks jobs that are servable.

**Walking**

- Walking follows §3.4:
  - `gaitT += 1; x += facing · moveAt(gait, gaitT)`, with a fresh bout (`walkSeq++`, `gaitT = 0`) whenever the dragon
    starts walking after any other `move`, a turn included;
  - the last step clamps to the target;
  - `stats.dragonWalked += |dx|`.
- A reversal is a 6-step paper turn (`move: 'turn'`), with the facing flipped at step 3.
- On arrival at the slot it turns to `slot.facing`.
- The lift and the bay follow §3.4 exactly. The car starts parked at f0.

**The view**

- **Pets:** `sync` sets these fields every step:

  | Field | Value |
  |---|---|
  | `p.x` | `d.x` |
  | `p.y` | the car's y while riding, else `feetY(d.f, (d.id % 3) − 1)` |
  | `p.facing` | `d.facing` |
- **Anim by move:**

  | `d.move` | Anim |
  |---|---|
  | `walk` (also `board` and `alight`) | `walk`, with `play('walk', {restart: true, speed: 1, blend: 8})` whenever `d.walkSeq` changes |
  | `still`, `call`, `bay`, `ride` | `idle`, or the waiting tells (`beg`, `call`) as today |
  | `turn` | `idle` (blend 4), with `p.turn` set. The walk never plays in place: the next walk starts a new bout |
- **The paper turn:** port `care/dragon.ts`'s turn into `pet.ts`. `p.turn` is −1 or 0..5; after `player.tick()` it
  sets `pose.squash = 0.8; pose.stretch = 1.01`. The facing comes from the sim.
- **The car:** draw the lift car at `lift.y`.
- **Keepers:** `people.ts` maps `wait` → `watch`. Walk and carry play at `pace / KEEPERS[look].speed`, where pace is
  1, or 1.6 while rushing. This is set with the new `setSpeed`, and it removes today's keeper foot-skate.
- **Where the wary latch and the crowd rule stand:** `stepWary` already runs every step, which now matters because
  dragons walk past each other.

**Tuning to hold** (measure, then freeze with 20 % headroom in sim-check)

- The keepers' `WALK 1`, `CLIMB 0.8` and `RUSH 1.6` are unchanged.
- There is no dragon speed-up.
- If the service gates below fail, try these levers in order:
  1. `LEAD_PX` 300 → 450;
  2. `QUEUE` 0.5 → 0.55;
  3. `LIFT_SPEED` 1 → 1.5;
  4. as a last resort, `HALF_LIFE_S` 360 → 420 (slower drains), with a note in BASE §4.9.

  A second room for any need is **not** a lever: D6 is one room per need.

**sim-check**

- **§2 (thirty minutes, seed 1): invariants, checked every 30 steps:**
  - every dragon not riding is on its stage's dragon span;
  - a rider is at `LIFT_CX` and is `lift.rider`;
  - the car holds at most one rider, and `lift.y` is in [136, 696];
  - **the bay invariant** of §3.4;
  - slot occupancy follows §3.3 (one non-baby, or at most two babies, per module);
  - an acting dragon stands at its slot (`|x − slot.x| < 0.5`) in `NEED_ROOM[act.need]`;
  - a working keeper is within 1 px of the stand spot;
  - a walking dragon's (f, x, y) changes within 10 s, unless it is turning or in `call` or `bay`;
  - `call` and `bay` waits last 60 s or less;
  - the keeper stall rule exempts `wait` and bay waits of 30 s or less;
  - `waitTimeouts === 0`.
- **§2 service gates** (starting values; tighten after measuring):
  - `done ≥ 120`;
  - `emptySteps === 0`;
  - the open-to-start wait averages 60 s or less, with a maximum of 180 s or less;
  - the keeper-side wait (arrival to work) averages 20 s or less;
  - `liftWaitMax ≤ 60 s`;
  - every dragon has its needs met in 4 or more distinct rooms, and every dragon's x changed.
- **§4 Rush:**
  - Force the precondition: give every dragon a job it has already `arrived` for, enough to occupy all 4 keepers.
  - Rush the last waiting job whose room has a free slot.
  - Assert it is first in the queue, has a keeper, `preempted + 1`, and is done within 90 s.
- **§6 Continuation:** also save mid-ride. Find the first step with `lift.rider != null`, save there, and continue
  both runs 5000 steps.
- **§9 Gait:**
  - `gaitOf` is identical for seeds 11 and 215;
  - the sum of `moveAt` over one cycle equals `avg · len` within 1e-9;
  - a scripted adult spike walking 600 steps moves exactly the tabled distance.
- **§8 Rooms:** remove `lift` from `PLANNED`.

**smoke**

- The hook gains:
  - on each dragon: `move`, `room` (the kind at its x and f, or null) and `slot` (`kind:index`, or null);
  - `lift: { y, rider }`;
  - `walked`.
- **Frozen:** `view=base&t=3600` still has `done ≥ 1`, and `walked > 100`.
- A pair check: the dragons' x values in `t=600` and `t=3600` differ for at least 3 dragons. A small helper runs both
  pages.
- The live `baseInput` case (with `save=0`) is unchanged.

**Shots:** `base_t600` and `base_t3600`, plus `base_lift` (`view=base&t=<a step with a rider, found from
sim-check>&cam=328,300`). Inspect:

- no foot skate: compare 3 consecutive `t=` frames of a walking spike;
- a dragon on the car;
- keepers waiting at the stand spots;
- nothing drawn over a dragon's eye.

**Docs**

- **BASE_DESIGN §2 "Moving around":** a dragon with an open need walks to that need's room, riding the Dragon Lift
  between floors, and a keeper meets it there. Add the bay rule in one paragraph.
- **§3 intro:** a room meets its need, with a keeper.
- **§4.4:** fetch and meet in the room; the `wait` phase.
- **§4.6:** rewritten. Rooms don't heal; keepers do. Regeneration is removed.
- **§4.9:** add `LEAD_PX`, `WAIT_MAX`, `LIFT_SPEED`, `BAY_CLOSE`, and the dragons' pace (the walk anim's own).
- **§8.1:** the re-measured numbers.
- **§9 Q1:** resolved.
- **ART_BIBLE status (l.31):** the game's pet renderer now walks dragons by their anims' root motion, and runs the
  wary latch and the crowd rule.
- **KEEPERS status:** base keepers' walks now match their pace.

**Done when**

- `npm run check` is green.
- The shots show dragons walking, riding and turning with planted paws.
- The service numbers are recorded in §8.1.

---

### S4 — Time: the clock, day and night, speed, live saves

**Advances #8**, closing two of its criteria:

- *"Include day night cycles"*
- *"and a speed toggle"*

It also closes D2's save and load. (The month-long stage is S5.)

**Depends on:** S3.

**Files**

| Action | File | What |
|---|---|---|
| new | `src/game/clock.ts` | time constants and `readClock` (§3.5) |
| new | `src/game/sky.ts` | `drawSky` in **screen space**, drawn before the building |
| new | `src/game/hud.ts` | the top bar, the buttons with hit rects, the keeper badges (display only), toasts |
| new | `src/game/storage.ts` | the only file that touches localStorage |
| change | `src/game/surfaces.ts` | adds `WALLS` (moved from `building.ts`), `BACKDROPS` and `skyBands()` |
| change | `src/game/building.ts` | no sky, clouds or hills (transparent above the ground and around the building); add tower window slits (6×10, day glass `#cfe3ea`); export `drawLights` |
| change | `src/game/base.ts` | speed; draw order; `layers=world`; attach: keys, load, autosave, NEW; toasts |
| change | `src/game/sim.ts` | `clock0` from the hour; **nothing reads the phase** |
| change | `src/gallery.ts` | `hour=`, `layers=` |
| change | `tools/palette-check.ts` | gate (w) |
| change | `types/globals.d.ts`, `tools/sim-check.ts`, `tools/smoke.ts`, `tools/shots.ts` | |

**Types**

```ts
// clock.ts
export const DAY_STEPS = 10800, START_HOUR = 7, STAGE_DAYS = 30, RETIRE_DAYS = 30, HATCH_DAYS = 2;
export const SPEEDS = [0, 1, 2, 4, 8] as const; export type Speed = typeof SPEEDS[number];
export type DayPhase = 'dawn' | 'day' | 'dusk' | 'night';
export const PHASE_HOURS: Readonly<Record<DayPhase, number>> = { dawn: 5, day: 7, dusk: 18, night: 20 };   // start hours
export interface ClockRead { day: number; hour: number; minute: number; phase: DayPhase; prev: DayPhase; blend: 0 | 1 | 2 | 3 }
export const hourSteps = (dayLen: number) => dayLen / 24;
export function readClock(clock: number, dayLen?: number): ClockRead;   // blend = min(3, floor(3·(clock − phaseStart) / hourSteps))
export function clockLabel(c: ClockRead): string;                        // 'DAY 3 14:00' (minutes floored to 10)
// surfaces.ts
export const BACKDROPS: { sky: Record<DayPhase, readonly [string, string, string]>; hills: Record<DayPhase, string>; clouds: Record<DayPhase, string>;
  liftWall: string; emptyWall: string; stone: string };
export function skyBands(c: ClockRead): readonly [string, string, string];   // stepped mix(prev, phase, blend/3) via src/lib/art/palettes.ts mix
// storage.ts
export const SAVE_KEY = 'dragon-care/base';
export function loadSave(): { save: SaveV | null; note: 'none' | 'ok' | 'old' | 'bad' };   // never throws
export function writeSave(s: SaveV): boolean; export function clearSave(): void;
// base.ts
export interface BaseViewOpts { seed: number; cam?; preset?; persist?: boolean; hour?: number | null; layers?: 'all' | 'world' }
```

**Palettes** (starting values; gate (w) must pass, so adjust within reason if it fails):

| Phase | Sky top / mid / low | Hills | Clouds |
|---|---|---|---|
| day | `#bcd8e4` / `#cfe3ea` / `#e0eef0` | `#b3cfae` | `#eef6f7` |
| dawn | `#b8b0d0` / `#d8d0e0` / `#ecd6c8` | `#a8b8a4` | `#f0e0e0` |
| dusk | `#b89ab0` / `#e0b8a0` / `#e8c8a8` | `#9aa890` | `#f0d0c0` |
| night | `#6a78a8` / `#6f7fa8` / `#7f8fb8` (L 0.19–0.28: mid-value blue hour) | `#6a7aa0` (0.195) | `#8090b0` |

Other backdrops: `liftWall` `#a8987e`, `emptyWall` `#9a8a76`, `stone` `#c2bbb0`, and the room `WALLS` as today.

**The sky** (`drawSky(ctx, read, camX, camY, worldW)`, screen space, every frame)

- Three flat horizontal bands fixed to world y: 0–200, 200–420 and 420–`GROUND`.
- Clouds are flat discs at 0.5 parallax in x. A hill polygon at 0.5 parallax meets the ground.
- At night:
  - 24 stars, each a flat 2×2 `#e8ecf8`, at fixed seeded world positions (use `rngAt(1, TAG.SKY, i)`, never
    `Math.random`), at 0.2 parallax;
  - a moon: an inked disc of radius 5 in `#f0ecd8`, at 0.2 parallax.
- Phase changes use `skyBands(read)`: 3 stepped mixes over the first hour. No gradient and no alpha.

**The lights** (`drawLights(ctx, rooms, read)`, world space: after the building, before the car and the cast)

| When | What |
|---|---|
| dusk and night (and dawn's blend steps) | tower slits drawn lit `#ffd98a` |
| dusk and night | each dorm lamp gets two stepped rings (r 10 and r 16, the lamp colour mixed with the wall at 0.5 and 0.25, flat), clipped to the wall above the band: **never on the band** |
| night | the hearth gets one extra flat ring on the kitchen wall |
| night | the dorm skylight shows the night top band and one 2×2 star |

**Nothing changes on any floor, wall or dragon.**

**The view**

- **Draw order:** clear to `#16141c`; `drawSky` (skipped for `layers=world`); the building; `drawLights` (skipped for
  `layers=world`); the lift car; the cast; the top pass; the bubbles; the plates; the HUD, toasts and card (all three
  skipped for `layers=world`).
- **Speed:** `speed: Speed = 1` by default.
  - `step()` runs `speed` × (`sim.step()`, `syncCast`, `stepWary`, `stepPet` for each pet, the keeper visuals), then
    eases the camera once.
  - At speed 0 only the camera and UI move.
  - The frozen path never calls `attach()`, so its speed is always 1.
- **Keys** (added in `attach` and removed in `detach`): `1`, `2`, `3` and `4` select 1x, 2x, 4x and 8x; `p` toggles pause.
- **HUD** (§3.11): the clock with a sun or moon sprite, `JOBS`, the four keeper badges (display only), `NEW`, `II`
  and `>NX`. The old hint moves to the bottom right.
- **Taps:** HUD buttons are tested first in `tap()`, then everything else as today.

**Saves (live only)**

- `attach()` does this only when `opts.persist`:
  1. `loadSave()`. On `ok`, swap in `CareSim.fromSave(save)` and rebuild the cast, building and plates. On `old` or
     `bad`, toast "NEW BARN: THE OLD SAVE DIDN'T FIT", and the old blob is kept under `.bak`.
  2. Autosave every 600 rendered frames, and on `visibilitychange` (hidden) and `pagehide`.
  3. Install `window.__dragonCare.baseSaveNow = () => { save; return tick }`.
- **NEW:** two taps within 120 frames. The first toasts "SURE? TAP AGAIN". The second clears the save and rebuilds
  with `freshSeed()` (the one allowed `Math.random` use).
- Speed is not saved: it is always 1x after a load.
- The constructor never touches storage.

**The simulation:** `clock0 = (opts.hour ?? 7) · hourSteps(dayLen)`. The day phase is read only by the view.
Garden (S6) and board (S8) code must be kept out of `barnKey`.

**Palette gate (w)** (§3.8) covers:

- every `BACKDROPS` entry, including the 2 stepped mixes between each pair of consecutive phases;
- every `WALLS` colour;
- the lift and empty walls, and the stone.

**sim-check**

- **§10 Clock** (for `dayLen` 10 800 and 600):

  | Clock | Expected |
  |---|---|
  | 0 | day 1, 00:00, night |
  | `5·hs` | dawn, blend 0 |
  | `5·hs + hs/3` | blend 1 |
  | `7·hs` | day |
  | `18·hs` | dusk |
  | `20·hs` | night |
  | `24·hs` | day 2 |

  (`hs` is `hourSteps(dayLen)`.)
- **§11 Phase independence:** a sim with `clock0 = 7h` and one with `clock0 = 19h`, seed 1, run for 20 000 steps.
  `barnKey` must be equal every 1000 steps. This is what makes the no-tint smoke diff meaningful.
- **§6 Continuation:** re-run it. Bump `SAVE_VERSION` only if the state changed.

**smoke**

- **Frozen:** `view=base&t=600&hour=22` has `clock.phase === 'night'` and 150 or more colours.
- **No tint.** Pages A = `view=base&t=600&hour=12&layers=world` and B = the same with `hour=22`:
  - an in-page FNV hash of `getImageData` is **equal**;
  - `barnDigest` is equal.

  Pages C = `view=base&t=600&hour=12` and D = the same with `hour=22` have **different** hashes. So night is drawn,
  and it is not drawn on the world layer.
- **Live speed** (`view=base&save=0`):
  - click the speed button's rect (`hook.buttons.speed`), then `hook.speed === 2`;
  - press `4`: the tick delta over 1 s is at least 4x the 1x delta;
  - press `p`: the tick is unchanged over 500 ms;
  - press `1`.
- **Planted save, frozen:**
  1. In Node, build a real save: `serialize(new CareSim(...START))` after 5000 steps.
  2. `page.addInitScript` puts it at `dragon-care/base`.
  3. Load `view=base&t=600`.
  4. `hook.tick === 600` and `hook.digest` equals a clean `view=base&t=600` page's digest.
- **Live persistence** (the only live case without `save=0`, in its own page):
  1. Load `view=base` and wait for `tick ≥ 300`.
  2. `T = await evaluate(baseSaveNow)`, then `page.reload()`.
  3. After it is ready: `hook.tick ≥ T` and `hook.persist === true`.

**The hook adds:** `clock {day, hour, minute, phase}`, `speed`, `barnDigest`, `persist`,
`buttons: Record<string, Rect>`, and `window.__dragonCare.baseSaveNow?: () => number`. `types/globals.d.ts` is
updated to match.

**Shots:** `base_night` (`t=600&hour=22`), `base_dusk` (`hour=19`) and `base_dawn` (`hour=6`), next to `base_t600`.
Inspect:

- the dragons' pixels look the same at day and night;
- night is a mid-value blue, not black;
- the lamp rings are stepped and stay off the band;
- the HUD fits (the badges end at x 328, the buttons start at x 528).

**Docs**

- **BASE_DESIGN §7:** rewritten, covering:
  - the day length (10 800 steps: 3 min at 1x);
  - the phases;
  - "night lives in the sky and the lights; the dragons, floors and walls never change";
  - speed 0/1/2/4/8 as more fixed steps per frame;
  - saves (when they happen, NEW, the version fallback), and that `t=` and the tests are exempt.
- **§4.8:** the new top bar.
- **§8:** mark "day and night" and "save and load" as built.
- **§9:** the night shift is deferred (P15); the wall gate is answered by (w).
- **ART_BIBLE 5.1:** a note that at 4x and 8x an effect's 3–6 f keys can change every rendered frame, which is
  accepted as the fast-forward look.

**Done when**

- `npm run check` is green.
- A whole day and night can be watched in 3 minutes at 1x (or 23 s at 8x) in `npm run dev`.
- A reload resumes the world.
- The no-tint diff passes.

---

### S5 — Growing up, eggs and hatching

**Closes #8.** Criterion: *"It should take a 'month' of game time to have a dragon grow from one age class to
another."* Under D2 that is 30 game days per stage, baby → young → adult → elder.

**Advances #5.4** (the hatchery side: *"We can get eggs on a mission"*). Eggs go to the Hatchery, hatch into babies,
and those babies age. Missions (S8) call `addEgg`.

**Advances #11:** the Hatchery is proven used.

**Depends on:** S4.

**Files**

| Action | File | What |
|---|---|---|
| new | `src/game/life.ts` | stage-ups, hatching |
| new | `src/game/names.ts` | hatchling names |
| new | `src/game/eggs.ts` | egg sprites, cracks, wobble, the hatch FX: drawing only |
| change | `src/game/sim.ts` | `eggs`, `nextEggId`, `addEgg`, events `grow` and `hatch`, `stats.growDelayMax` |
| change | `src/game/base.ts` | the grow-up stand-in, eggs, the hatch FX, the dragon card, dawn tips |
| change | `src/game/presets.ts` | `growup`, `eggs`, `hatch` |
| change | `src/game/save.ts` | eggs; `SAVE_VERSION` bump |
| change | `tools/palette-check.ts`, `types/globals.d.ts`, `tools/sim-check.ts`, `tools/smoke.ts`, `tools/shots.ts` | |

**Types**

```ts
// sim.ts
export interface Egg { id: number; element: DragonElement; seed: number; laid: number /* clock */; nest: 0 | 1 | 2 }
export type SimEvent = … | { kind: 'grow'; dragon: number; stage: Stage } | { kind: 'hatch'; dragon: number; egg: number };
class CareSim { eggs: Egg[]; nextEggId: number;
  addEgg(element: DragonElement, laidAt?: number): Egg | null;   // the lowest free nest; null if all 3 are full; stats.used.hatchery++
}
// life.ts
export function stepLife(sim: CareSim): void;       // called in step() before needs; S6 adds retirement
// names.ts
export const NAMES: Readonly<Record<DragonElement, readonly string[]>>;
export function hatchName(sim: CareSim, el: DragonElement): string;   // the first name in NAMES[el] not in use; else NAME + 2, 3, …
// eggs.ts
export function drawEgg(ctx: CanvasRenderingContext2D, el: DragonElement, x: number, y: number, progress: number, tick: number): void;
export function drawShellBits(ctx: CanvasRenderingContext2D, el: DragonElement, x: number, y: number, age: number): void;   // age 0..19
```

**Growing up** (the rule in §3.5)

- A stage-up waits until the dragon is **settled**. Then `stageSince += 30·dayLen`, the stage advances, and a
  `grow` event is pushed. Drains, `REACH`, the gait, the pad and the stand spot all follow the new stage from that
  step on.
- **Size rule:** if the new stage is not a baby and the dragon holds a baby sub-slot, it first reserves a free
  module slot (goal `settle`, in any dragon room except the hatchery). It walks there, and the stage-up applies when
  it is settled there. If no module slot is free, it waits.
- `stats.growDelayMax` records the largest delay between a stage-up falling due and being applied.
- A keeper never stands at an old reach while the rig swaps, because growth needs the dragon to be settled (with no
  keeper on it). This covers the judges' K7 concern.

**The grow-up stand-in** (the view, on a `grow` event)

- `syncCast` rebuilds the pet (`makePet(el, newStage, sameSeed, 'idle', …)`), which re-arms the idle variants and
  clears the bowl cache.
- It draws `flash: true` (the grow-up's sanctioned flat flash) for 12 frames.
- It plays `happy` once.
- It toasts "EMBER IS AN ELDER NOW!", or YOUNG or ADULT to match.

The full 240 f grow-up stays a follow-up.

**Eggs and hatching**

- **Nests:** 3 nests (0, 1, 2) at x 1062, 1112 and 1162 on f0.
- **When it hatches:** at `clock − laid ≥ HATCH_DAYS·dayLen`, and only when a free baby sub-slot exists. The hatchery's
  two slots are preferred; otherwise the nearest by route cost.
- **The baby:**

  | Field | Value |
  |---|---|
  | `id` | `nextDragonId++` |
  | name | `hatchName` |
  | `seed` | `(mix32(sim.seed, TAG.EGG, egg.id) & 0x7fffffff) \|\| 1` |
  | stage | `baby` |
  | `stageSince` | the current clock |
  | needs | all 1, except food 0.45 |
  | x | the nest's x, on f0, facing −1 |

  It then walks to its reserved sub-slot. Food 0.45 means it asks for the kitchen at once. The egg is removed, a
  `hatch` event is pushed, and `stats.used.hatchery++`.
- **Names** (at most 8 characters, unique across the barn, the garden and away):

  | Element | Names |
  |---|---|
  | fire | CINDER, ASH, FLINT, SPARK, BLAZE, SOOT |
  | spike | BURR, THISTLE, QUILL, BRIAR, NETTLE, TEASEL |
  | rock | PEBBLE, SHALE, GRAVEL, SLATE, GARNET, CAIRN |
  | lightning | BOLT, VOLT, FIZZ, STATIC, FLICKER, JOLT |
  | water | SPLASH, BROOK, DRIZZLE, EDDY, TIDE, MISTY |
  | slinkwing | FLIT, WHISPER, HUSH, DART, SWOOP, MOTH |
  | dusk | GLOAM, NOX, LANTERN, DIM, VESPER, TWILIT |

**Egg art** (`eggs.ts`, house style)

- A 9×12 letter sprite drawn by `drawSprite`, so every pixel is ringed in ink. The shell is the element's baby
  `scale` colour, with a 3×3 belly-colour spot (the mark floor for spots).
- Cracks are 2 px ink zig-zags: one at progress 0.5 or more, two at 0.85 or more.
- In the last 15 % the egg wobbles ±1 px, stepping through [0, +1, 0, −1] every 30 ticks (from `sim.tick`, so it is
  deterministic).
- Eggs sit in their nest mounds (S2), behind the feet band's front edge.
- **Hatch FX:** 6 shell bits, each 2×2 in the shell colour, jump outward over 3 stepped positions across 20 frames,
  then vanish. No alpha.

**The age readout** (the dragon card)

- Tapping a dragon that has no waiting job opens a 160×76 card at (8, 20):
  - the name, outlined;
  - the element's word;
  - the stage word, plus `DAY d OF 30`, where d = ⌊(clock − stageSince)/dayLen⌋ + 1;
  - a 30-segment bar (5×5 segments with 1 px gaps);
  - five 20×4 need bars with their icons.
- Tapping a dragon that has a waiting job still Rushes it.
- A tap anywhere else closes the card.

**Dawn tips** (view only, at 05:00): if any barn dragon's stage-up falls due within 2 days, toast "N DRAGONS GROW
UP IN 2 DAYS".

**Presets**

| Preset | What it sets up |
|---|---|
| `growup` | the start cast, with EMBER due for its stage-up 30 steps after construction; EMBER's needs are set to 1 so that it is settled when the stage-up falls due |
| `eggs` | the start cast plus three eggs: rock at progress 0, dusk at 0.55, water at 0.9 |
| `hatch` | the start cast plus one egg 60 steps from hatching |

**Palette:** new egg gate. For every element, the baby `scale` must be at least 25 % in luminance from the nest
`#e6dcc4` (L 0.72). Rock at 0.485 is 33 % away.

**sim-check** (`dayLen: 600` unless stated)

- **§12 Growing up:**
  - a baby with `days: 0` becomes young, then adult, then elder: each exactly one `grow` event, with `stageSince`
    advanced by exactly 18 000 each time;
  - `growDelayMax ≤ 3600`;
  - a hatchery baby that grows into a young first moves to a module slot;
  - the drain rate after each stage-up equals `drainRate(el, newStage, k)`.
- **§12b, real length** (`dayLen` 10 800): one adult with `days: 30 − 1/60` is an elder within 180 + 3600 steps.
- **§13 Eggs:**
  - three `addEgg` calls fill the nests, and a fourth returns null;
  - an egg hatches at `laid + 2·dayLen`, into a baby with a new id, a unique name and stage `baby`;
  - that baby's food job opens within 60 steps, and it is fed within 3 minutes;
  - with every baby sub-slot filled (a test preset), hatching waits and nothing is lost;
  - two runs give the same names and seeds.
- **§6 Continuation:** save while an egg is incubating.
- **§8 Rooms:** remove `hatchery` from `PLANNED`.

**smoke**

| Page | Check |
|---|---|
| `view=base&preset=growup&t=60` | EMBER's hook stage is `elder` |
| `view=base&preset=eggs&t=600&cam=872,376` | `hook.eggs.length === 3`; 150 or more colours |
| `view=base&preset=hatch&t=120&cam=872,376` | the hook has a baby dragon |
| live, `view=base&save=0` | clicking the head of a hook dragon with `waiting: false` sets `hook.card` to its name |

**The hook adds:** `eggs: {element, nest, progress}[]`, `card: string | null`, and `waiting` on each dragon.

**Shots:**

| Shot | Query | Look for |
|---|---|---|
| `base_growup` | `preset=growup&t=36` | the flat flash |
| `base_hatchery` | `preset=eggs&t=600&cam=872,376` | eggs readable, dark eggs clear of the nest, cracks at least 2 px |
| `base_hatch` | `preset=hatch&t=70&cam=872,376` | shell bits |

**Docs**

- **BASE_DESIGN §7:** stages last 30 days each; a stage-up waits until the dragon is settled, and stays exact.
- **§3:** the Hatchery row is built.
- **§5.6** (draft): eggs of the region's elements go to the Hatchery and hatch 2 days later into babies that grow up.
- **ART_BIBLE 4.2 (grow-up):** the "look at me" hold auto-releases after 120 f, or on a tap. Status: the game uses
  the 12 f flash plus `happy` until the 240 f grow-up is built.
- **ART_BIBLE, a new short "Eggs" subsection in 5.x:** the sprite size, the crack stages, the egg gate.

**Done when**

- `npm run check` is green.
- The three shots look right.
- In `npm run dev` with `preset=growup`, EMBER flashes and becomes an elder with no keeper beside it.

---

### S6 — The elder garden

**Closes #10.** Criteria:

- *"a special garden next to the barn"*
- *"This garden will grow with size as the dragons get more numerous"*
- *"dragons who are too old (30 days pass elder) will move to this area"*
- *"Here they will sleep a lot and move around - and not have a lot of needs. So the humans don't need to take care of
  them as much."*

This is D3.

**Advances #11:** the Garden Gate and the garden are proven used.

**Framing (binding):** the garden is the elder's **reward**, a place and not a stage. Nothing in it reads as decline:

- no graves;
- no wilting or autumn-dying plants;
- no farewell or sunset beat;
- no sleepy lid on an awake resident.

The copy celebrates: "ASH MOVED TO THE GARDEN".

**Depends on:** S5.

**Files**

| Action | File | What |
|---|---|---|
| new | `src/game/garden.ts` | DOM-free: plots, residents' behaviour, reduced needs |
| new | `src/game/gardenArt.ts` | the plot tile (cached), the fence, lanterns, the plate |
| change | `src/game/layout.ts` | `RoomKind` gains `'gate'`; `GARDEN_X0 = 1304`, `GARDEN_PLOT = 176`; `worldWOf(plots)`; nets rebuilt from the garden's end |
| change | `src/game/start.ts` | adds `{ kind: 'gate', part: 'towerR', floor: 0 }` |
| change | `src/game/building.ts` | the right tower's f0 becomes the Garden Gate |
| change | `src/game/life.ts` | retirement |
| change | `src/game/sim.ts` | `Dragon.place`; `garden` state; `worldW`; resident jobs; keepers serving residents |
| change | `src/game/needs.ts` | `GARDEN_NEEDS = ['food', 'love']`, `GARDEN_RATE = 0.25` |
| change | `src/game/base.ts` | the camera clamps to `sim.worldW`; the garden layer; residents' anims |
| change | `src/game/surfaces.ts` | `FLOORS.path = '#dcd6c0'`; `BACKDROPS.hedge '#7f9e6c'`, `lawn`, `trunk` |
| change | `src/game/presets.ts` | `garden`, `retire` |
| change | `src/game/save.ts` | bump |
| change | `tools/palette-check.ts`, `types/globals.d.ts`, `tools/sim-check.ts`, `tools/smoke.ts`, `tools/shots.ts` | |

**Types**

```ts
// sim.ts
export type Place = 'barn' | 'garden';                      // S8 adds 'away'
export interface Dragon { /* … */ place: Place; home: number | null /* garden plot */;
  garden: { mode: 'nap' | 'sit' | 'stroll' | 'wait'; until: number; tx: number } | null }
export type SimEvent = … | { kind: 'retire'; dragon: number };
class CareSim { garden: { plots: number }; get worldW(): number; /* GARDEN_X0 + plots·176 + 32 */ }
// layout.ts
export function worldWOf(plots: number): number;
export function makeNets(gardenEnd: number): { keeper: Net; dragon: Readonly<Record<Stage, Net>> };   // replaces the fixed KEEPER_NET and dragonNet
// garden.ts
export function stepGarden(sim: CareSim): void;       // run after keepers in step()
export function plotX(i: number): readonly [number, number];
```

**Geometry**

- `plots = max(2, residents + retiring)`, so the garden shows from day 1 with two empty plots.
- `worldW = 1304 + plots·176 + 32`: 1688 at the start, 2568 with 7 residents.
- The f0 spans extend to the garden's end: keepers to `worldW − 42`, dragons to `worldW − 32 − P`.
- Every net is rebuilt, and every stored route re-derived, when `plots` changes. A route under way is re-routed from
  its current spot.

**Retirement** (the §3.5 rule, at 30 days into the elder stage)

1. The dragon's jobs are purged and their keepers released (not counted as pre-empted). Its slot is released.
2. `plots` grows if it has to, and the nets are rebuilt.
3. It gets `goal: 'retire'`, is routed on the dragon net to its plot's centre on f0 (riding the lift down if it
   needs to), and a `retire` event is pushed.
4. When it arrives: `place = 'garden'`, `home = plot`, and `stats.used.garden++`.

**Gate use:** any dragon or keeper whose x enters [1200, 1296] on f0 moving outward or inward counts one
`stats.used.gate` for that pass.

**Residents**

- **Needs:** only food and love drain, at `GARDEN_RATE · drainRate(el, 'elder', k)`. Sleep, play and bath are held
  at 1. Only food and love jobs open. An elder's food then takes about 30 minutes of play to reach `QUEUE`, 15 for
  fire.
- **Modes**, with the next mode drawn from `rngAt(seed, TAG.GARDEN, d.id, tick)`:

  | Mode | Lasts | Then |
  |---|---|---|
  | `nap` | `int(1800, 3600)` steps | `sit` |
  | `sit` | `int(600, 1200)` steps | `stroll` (0.6) or `nap` (0.4) |
  | `stroll` | until it arrives at a target x in [its plot − 1, its plot + 1], inside the garden span, walked by the gait (G13) | `sit` |

- **At night:** any mode that ends goes to `nap`.
- **A job opens:** the resident stops, or wakes, and goes to `wait`. Its job is servable while it is in `wait`.
  - The keeper's stand spot is `clamp(d.x + d.facing·REACH.elder, garden span)`.
  - Supplies come from the kitchen post as usual, so Bea walks the bowl out through the gate.
  - After the act, the resident goes to `sit`.
- **The one stated exception to "the need's own room":** the garden is the residents' room, and keepers come to
  them. The doc says so.
- **The view:**

  | Mode | Anim |
  |---|---|
  | `nap` | `sleep`, then `wake` on leaving |
  | `sit` | `idle` with the elder variants (the crowd rule still stops airing within 24 px) |
  | `stroll` | `walk`, restarted per bout |
  | `wait` | `idle`, or the tells |

**The building:** the Garden Gate (right tower, f0)

- 84 px arches in both walls. The inner doorway grows from 70 to 84, and a new outer arch is cut at x 1296–1304.
- A **straw** floor band (`FLOORS.straw`) instead of tower planks, since dragons walk it.
- An open wooden gate leaf against the back wall, a lantern, and the `GARDEN GATE` plate.

**The garden art** (`gardenArt.ts`)

- One plot tile, 176 px wide, cached.
- **Behind the feet band** (y < 688):
  - a lawn band `#8fae76` at y 640–688;
  - rounded hedge blobs `BACKDROPS.hedge` at y 600–650;
  - an apple tree on every other plot (a `#8a6242` trunk, a hedge-green crown, 2×2 `#e0664a` apples);
  - a bench on plot 0;
  - one straw nest mound per plot (`#e6dcc4`, inked, behind the band);
  - a 2 px lantern post with a 6×6 `#f2d36a` lamp;
  - 3×3 flower marks in the lawn.
- **The feet band** (y 688–702) is `FLOORS.path` `#dcd6c0` (L 0.671, S 0.13), with a 1 px darker top edge.
- A stone slab `#a49c90` at 702–712.
- Below `GROUND`: earth, and the 5 px `#86a860` grass strip. That is the only green below the feet.
- A picket fence (3 px pickets) at `worldW − 40`, which moves out as the garden grows.
- The `GARDEN` plate over plot 0.
- **Draw order:** after the building (it covers the building canvas's own ground from x 1304 to 1360) and before the lights.
- **Lights at night:** each lantern gets two stepped rings on the hedge (y < 688).
- Only visible plots are drawn, so no canvas grows with the garden.

**Presets**

| Preset | What it sets up |
|---|---|
| `garden` | 4 barn adults (EMBER, ZAP, RIPPLE, WICK) plus 3 garden elders (BRAMBLE, COBBLE, ECHO as residents on plots 0–2, `place: 'garden'`), made directly by `after(sim)` |
| `retire` | all 7 starters as elders at elder day 29.9 |

`DragonPlace` gains `place?: Place`.

**sim-check**

- **§14 Retirement** (`dayLen: 600`, preset `retire`):
  - all 7 retire, each at or after `stageSince + 30·dayLen`, with `retireDelayMax ≤ 3600`;
  - `stats.used.gate ≥ 7`;
  - at the end, `plots === residents === 7` and `worldW === 1304 + 7·176 + 32`;
  - residents stay inside the garden span and hold no barn slot.
- **§15 Residents** (`dayLen` 10 800, preset `garden`, 30 min, seed 1):
  - residents open only food and love jobs;
  - their measured drain over 5000 steps is within 1 % of `GARDEN_RATE ×` the elder drain;
  - their nap share is 50 % or more of their steps, and 100 % of night steps outside `wait` and acts;
  - every resident job is met at a stand spot in the garden span (`used.garden > 0`);
  - `emptySteps === 0`, and the barn's S3 service gates still hold.
  - Print the number of keeper visits per resident.
- **§6 Continuation** with residents.
- **§11 Phase independence** still passes: its cast has no residents.

**smoke**

- `view=base&preset=garden&cam=1304,376&t=600`: `hook.garden.residents === 3`, `plots === 3`, 150 or more colours.
- The same with `&hour=22`: 150 or more colours.
- The hook adds `garden: {residents, plots, worldW}`, and `place` on each dragon.

**Shots**

| Shot | Query |
|---|---|
| `base_garden` | `preset=garden&cam=1304,376&t=600` |
| `base_garden_night` | the same plus `&hour=22` |
| `base_gate` | `preset=retire&cam=1060,376&t=…`, with t chosen from sim-check as the step when a retiree is under the arch |

Inspect: a pale path under the feet, green only behind and below, no decline motifs, lantern rings off the path.

**Docs**

- **BASE_DESIGN §3:** a "The Garden" entry: where it is, how it grows, what residents do, their reduced needs, and
  the exception that keepers come to them. The Garden Gate row is built.
- **§2:** "dragons don't fit the towers' doors, except the Garden Gate's arch".
- **§4.1:** the residents' needs.
- **B8:** add "retiring to the garden is the elder's reward (D21)".
- **ART_BIBLE D21:** a note that the garden is a place, not a stage.
- **§8:** the garden is built.

**Done when**

- `npm run check` is green.
- `preset=retire` in `npm run dev` shows elders walking out and the garden widening.
- The shots look right.

---

### S6b — Barn capacity: the barn serves the herd the game actually grows (orchestrator addendum)

**Why this slice exists.** S3's fixers measured that the one Dragon Lift car caps the barn at 7-8 grown dragons
(handoff "### S3 review": about 150 rides per 30 min at most, because each ride holds the car while its rider walks on
and off at its authored pace; 9+ dragons empty needs on most seeds; S5's `full` preset deadlocks). Eggs (S5) and
missions (S8) will grow the barn to 10-15 dragons, so without this slice the mid-game barn starves. The orchestrator
ran a capacity study (three prototypes measured with `tools/capacity.ts`, then a judge); **the chosen design is in
"S6b design" below, and it is binding for this slice.**

**Acceptance (all required):**
- **C1 Served herd.** The benchmark cast `twelve` (7 grown adults + 3 young + 2 babies, built by `tools/capacity.ts`)
  runs 30 min on seeds 1-8 with **0 steps at an empty need on at least 7 of 8 seeds**, open-to-start wait average
  <= 90 s, and no keeper or dragon stall (S3's invariants). The start cast keeps S3's service (or better).
- **C2 A hard, honest cap.** `BARN_CAP` = the largest barn population the design serves to C1's standard (at least 12
  unless the study proved that impossible; the judge's number is binding). An egg never hatches while the barn holds
  `BARN_CAP` dragons: it waits in its nest (the nest shows it is waiting, and the dragon card / a toast says
  "THE BARN IS FULL"); retirement to the garden or a team leaving frees room. The HUD shows the barn count against the
  cap (e.g. `BARN 9/12` in the top bar). S8's mission chooser must refuse an egg reward (as it already does for full
  nests) when nests are full, and S8 must read `BARN_CAP` from where this slice exports it.
- **C3 Rules still hold.** G1-G14; G13 exactly (a walk may play faster only if its body moves by the same factor, and
  only where the design says); nothing covers an eye at landings beyond what S3 measured (lower is better); floors pass
  gate (i); #11 still holds (every named, furnished room has a real purpose; if the design adds a room, it names its
  purpose and its `stats.used` proof); saves stay exact (bump `SAVE_VERSION` if state changes); S5's `full` preset no
  longer deadlocks (it may exceed `BARN_CAP` only because a preset forced it; it must at least keep moving).
- **C4 Proof.** sim-check's capacity section is rewritten around C1 (seed 1 in the suite, ~20 % headroom on the frozen
  numbers; the 8-seed sweep lives in `npm run capacity` / `tools/capacity.ts`, documented), a C2 test (hatching waits
  at the cap and resumes when a dragon retires), and the suite stays under its 30 s budget (split sections into
  `tools/simcheck/*.ts` if needed, without dropping checks). BASE_DESIGN 4.7 and 4.9 rewritten with the measured table.

**S6b design (filled in by the capacity judge; binding):**
(pending)

### S6c — Night you can see (orchestrator addendum)

**Why.** #8 asks to *"Include day night cycles"*. After S4, night changes about 2 % of the opening frame: only the
windows, the dorm lamp and the hearth glow change, so a player looking at the barn cannot tell night from day. The roof
and the garden read as night already.

**Acceptance (all required):**
- **N1 Unmistakable.** At `START_CAM`, `view=base&t=600&hour=22` differs from `hour=12` in at least 35 % of the frame's
  pixels, and the difference reads as night at a glance (cooler, darker-but-mid-value walls and building shell, lit
  lamps and windows), with dusk and dawn stepping between them in the existing 3 stepped blends. No gradients, no alpha
  fades beyond 3 steps (G6).
- **N2 Dragons are never tinted (G8, ART_BIBLE darkness rule).** Every dragon pixel is identical by day and by night,
  and every floor a dragon or keeper stands on (`FLOORS`) is unchanged. Replace S4's `layers=world` equality check with
  one that still proves this: e.g. a `layers=cast` render (the cast and bubbles only, on a fixed flat background) whose
  hash is equal at hour 12 and hour 22, plus the existing `barnDigest` equality, plus N1's >= 35 % frame difference.
- **N3 Night stays mid-value (the art bible's darkness rule: dark dragons vanish against dark backgrounds).** Every
  night wall/backdrop colour and every blend step is a `WALLS`/`BACKDROPS` entry that passes gate (w) (>= 25 % in
  luminance from every body scale with L < 0.15 at every stage, >= 6 okL from ink). Keepers stay readable too.
- **N4 Scope.** Walls, the building shell (tower stone, barn boards, roof, lift and ladder bays, the Aerie gantry), the
  garden's lawn, hedges, trees and fence get night variants; the sky and lights stay as S4 built them. The cached
  building canvas is rebuilt per blend step (never per frame; G14's 8x budget holds). No new furniture in rooms (#11):
  light comes from the lamps and windows that already exist, and from night variants of walls.
- **N5 Docs and shots.** BASE_DESIGN §7 (what night changes and what it never changes), ART_BIBLE (a line under the
  darkness rule: walls may shift with the hour, dragons never), shots `base_night`, `base_dusk`, `base_dawn`,
  `base_garden_night` re-rendered and inspected next to `base_t600`.

---

### S9a — Mission art kit (orchestrator addendum; built in parallel with S6b, S6c and S7)

**Why.** To shorten the critical path, every drawing that missions need is built up front as standalone,
data-free modules, in parallel with the other slices. S8 (the chooser's climate picture, icons) and S9 (the road
scene, set pieces, baddies, the miller) then only wire these in. This slice changes NO game state and NO simulation
code: it adds drawing modules, palette gates, a debug gallery view, smoke cases and shots.

**Serves:** #5.1 *"a picture of the kind of climate"*; #5.3 *"You should be presented with challenges that occur on
the mission - and dragon and people that are good solutions"* (the set pieces, the challenge and skill icons, the
miller); #5.5 *"Some of the missions might end with a big baddie"* (the three baddies). Tone per D4/P14: cozy; a
baddie is calmed, outwitted or driven off, never hurt; no angry faces (a grumpy face is a flat brow and a pout).

**Build (new files; the names and signatures below are binding so S8/S9 can import them):**
- `src/game/missiondata.ts` (tiny, data only): `Climate = 'meadow' | 'caves' | 'forest' | 'peaks' | 'ice' | 'ash'`,
  `ChallengeId` (the 11 of S8's counters table), `Skill`, `BaddieId`, `BaddieExit`, `BaddieFace`, `BaddiePose` exactly
  as plan S8/S9 spell them. S8's `regions.ts` must import these types from here instead of redefining them.
- `src/game/backdrops.ts`: `drawClimate(ctx, climate, phase: DayPhase, rect: {x,y,w,h}, scroll = 0): void` -- the
  region's picture in stepped flat layers (3 sky bands, a far ridge at 0.2 parallax, near forms at 0.5, weather marks
  >= 2 px: ice snow 2x2, meadow/forest rain 2x4 streaks, peaks 3 px bolts, ash heat bands, caves a cave mouth with one
  stepped lamp pool). It draws at the chooser's 300x112 AND fills a 640x~300 road scene when `rect` is the scene and
  `scroll` advances (S9's parallax). Phases: day, dusk, night, dawn (night mid-value, per the darkness rule). No
  dragons in it. Every colour a `BACKDROPS.climate[climate][phase]` entry that passes gate (w).
- `src/game/setpieces.ts`: `drawSetPiece(ctx, id: ChallengeId, x, feetY, state: 'ahead' | 'met' | 'unmet', t): void`
  for all 11 (plan S9's table: cave mouth + lamp pool when met, boulder cart, snowdrift, storm cloud with 3 px bolts,
  ford, bramble arch, signpost fork, the mill, a small bird with a bandaged wing, a fog bank in stepped bands drawn
  BEHIND the team, two rocks), with a `met` look that visibly resolves the problem.
- `src/game/baddies.ts`: `BADDIE_ART` and `drawBaddie(ctx, id, x, feetY, facing, face, pose, t)` for THE MOLE KING
  (~112x88), THE STORM ROC (~140x100), THE FROST GIANT (~96x140) exactly as plan S9 describes them (looks, faces only
  from `BaddieFace`, poses walk/stand/sit/turn/leave, the exits' poses: calmed = sits and dozes with 3x3 stepped "z"s,
  outwitted = turns and wanders the wrong way, drivenOff = shuffles off grumbling with 2 px dust), with S9's
  compile-time `_NoHurt` / `_Exits` assertions and palette gate (x). Also `drawBaddiePortrait(ctx, id, x, y)` 24x24.
- `src/game/npcs.ts`: THE GRUMPY MILLER, a non-player person drawn on the keeper rig (do NOT add him to `KEEPER_IDS`,
  which drives the four keepers everywhere): a flat miller's cap and a flour sack or scoop (distinct at the /3
  silhouette from Bea, Tomas, Iris and Pip), stocky, older but never frail, bushy grey brows, a moustache, a
  flour-dusted apron, rolled sleeves. States: `grumpy` (it must READ grumpy at a glance at 1x, within the no-V-brow
  rule: heavy flat brows pulled low onto narrowed eyes, a clear pout, arms folded high, chin tucked, turned a little
  away, optionally a small flat "hmph" puff) and `talkedRound` (brows up, a small smile, tipping his cap). The user
  asked specifically about the grumpy miller, and said the old placeholder "doesn't look grumpy": this is the bar.
  A mockup and its patch may be on the notes branch (`notes/miller_mock.png`, `notes/miller_mock.patch`) by the time
  you reach him: use them as a starting point if present.
- `src/game/missionicons.ts`: 9x9 challenge icons (11), 9x9 skill icons (4), a saddle sprite, a carried-egg sprite
  hook (reuse S5's egg art), in the `icons.ts` sprite format.
- `FLOORS.road = '#dcd6c4'` in `src/game/surfaces.ts` through gates (i)/(Ki).
- A gallery view `view=missionart` (with `sheet=climates|setpieces|baddies|people|icons`) laying everything out on the
  road floor, frozen-time safe (`t=`), plus smoke cases (each sheet draws, no page errors, enough colours) and shots in
  `tools/shots.ts` (`missionart_*`). Palette-check: climates in gate (w), baddies in gate (x), the miller in the keeper
  gates, the road in (i)/(Ki).
- ART_BIBLE: a short **Mission art** section (the climates, the set pieces, the baddies with sizes/faces/exits and the
  gate (x) report, the miller) and the status line.

**Done when:** `npm run check` is green; every sheet rendered and LOOKED at (the baddies read at 1x, grumpy not angry,
eyes clear; the miller reads grumpy vs talked round even as a thumbnail; the climates read as six different places
by day and at night; the fog is behind the team; nobody looks hurt).

---

### S7 — Take a keeper

**Closes #6.** Criteria:

- *"You should be able to choose a person - then you will control them and be able to do this chores."*
- *"Uses standard WASD controls - and a button to feel/collect stuff."* ("feel" is read as "feed".)

This is D5.

**Depends on:** S3 (slots and meeting in the room), S4 (the HUD, the attach keys, saves). S5 and S6 are in place, and
residents count as serveable.

**Files**

| Action | File | What |
|---|---|---|
| new | `src/game/control.ts` | commands, manual movement, `actionFor` and `act` |
| change | `src/game/sim.ts` | the command queue; `controlled`; the `manual` phase; exclusions; stats |
| change | `src/game/base.ts` | held keys, per-pointer input, the tap order, the pad, the follow camera, `fit`, the marker, the label |
| change | `src/game/hud.ts` | tappable badges, the pad, the action label, the portrait hint |
| change | `src/game/people.ts` | the controlled marker; anims for manual walk and idle |
| change | `src/game/save.ts` | the controlled keeper is saved as released |
| change | `src/gallery.ts` | a `take=<name>` param (frozen-friendly: the constructor queues a take command) |
| change | `types/globals.d.ts`, `tools/sim-check.ts`, `tools/smoke.ts`, `tools/shots.ts` | |

**Types**

```ts
// control.ts
export type Command = { kind: 'take'; keeper: number } | { kind: 'release' } | { kind: 'steer'; dx: -1 | 0 | 1; dy: -1 | 0 | 1 } | { kind: 'act' };
export interface ActionPreview { kind: 'pickup' | 'serve' | 'putback' | 'wait' | 'none'; label: string; job?: number }
export function actionFor(sim: CareSim, k: Keeper): ActionPreview;
export function applyCommands(sim: CareSim): void;       // start of step(): in push order, then cleared
export function stepManual(sim: CareSim, k: Keeper): void;
// sim.ts
export type Phase = … | 'manual';
export interface Keeper { /* … */ manual: boolean; held: { dx: -1 | 0 | 1; dy: -1 | 0 | 1 }; cue: number; pendingTake: boolean }
class CareSim { controlled: number | null; command(c: Command): void; }
export interface SimStats { /* … */ taken: number; handovers: number; doneBy: Record<string, number> }
```

**Behaviour (simulation)**

- **take(k):**
  1. If another keeper is controlled, release that one first.
  2. If k is in `work`, the take waits until the work ends (`pendingTake`). This avoids stopping a tuck-in halfway.
  3. Otherwise any job k holds goes back to the queue (`stats.taken++`; not counted as pre-empted).
  4. Only a climb in progress survives in `legs`. `phase = 'manual'`. Anything k carries stays carried.
- **steer:** held until it changes. Each step, for a manual keeper not in `pickup` or `work`:
  - a climb in progress continues;
  - if `dy ≠ 0` and x is within 8 px of a keeper link on this floor that has the next stop in that direction (up
    means f + 1), it snaps to the link's x and climbs one stop at `CLIMB`;
  - otherwise, if `dx ≠ 0`, it walks at `WALK = 1` inside its span, turning to face `dx`.

  The bay rule R1 and R4 apply (§3.4): a manual keeper never stops inside the lift bay.
- **act** (E, Space or ACT), resolved in this order:
  1. **Pick up:** within 24 px of a supply post on this floor (the bowl, ball or bucket) and not already carrying
     that supply → `pickup` for 40 steps, then carrying it. A different supply being carried is swapped.
  2. **Serve:** the candidates are open jobs where all of these hold:
     - the dragon is `arrived` at its reserved slot in `NEED_ROOM[need]`, or is a garden resident in `wait`;
     - no one is working the job yet;
     - the dragon is on this floor, and `|k.x − standSpot.x| ≤ 24`;
     - for food, play and bath, the keeper carries that supply.

     Pick by `compare`, then id. If an auto keeper had claimed it, release them (`stats.handovers++`). Snap to the
     stand spot (K7: the same eye-safe spot the automatic path uses). Then `work`, with `workLen` including the
     specialist bonus. When it finishes: back to `manual` where they stand, and `doneBy[name]++`.

     **A dragon still walking can never be served (D6).** The label says "WICK IS ON THE WAY".
  3. **Put back:** carrying X within 24 px of X's post → `carrying = null`.
  4. **None:** `cue = 30`, and the view shows a 7×9 inked "?" over the head.
- **release:** `manual = false`, `phase = 'home'`.
- **Exclusions:**
  - `assign()` skips `manual`;
  - `rush()`'s search for a free keeper skips `manual`;
  - `rush()`'s pre-emption skips `manual`;
  - S8's rider auto-pick will skip `manual` too, and is tested there.
- **The idle invariant** in sim-check becomes: `(phase === 'idle') === (!job && !legs.length)`, for keepers that
  are not manual.

**Behaviour (view)**

- **Keys** (added in `attach`, removed in `detach`):

  | Key | Action |
  |---|---|
  | W / ↑ | up |
  | S / ↓ | down |
  | A / ← | left |
  | D / → | right |
  | E or Space (keydown only, not repeats) | act |
  | Esc | release |
  | Tab | take the next keeper by id, wrapping (`preventDefault`) |

  - The speed keys from S4 stay.
  - `preventDefault` is called on the arrows and Space.
  - `blur` or `visibilitychange` clears the held set and sends `steer(0, 0)`.
  - A command is sent only when the held direction changes.
- **Pointers** are tracked per `pointerId` in a `Map`.
  - Pressing a pad direction holds that direction until up or cancel.
  - ACT and LET GO fire on a non-drag up.
  - The camera drag belongs to the first pointer that is not on a pad button.
  - A tap is a non-drag up.
- **Tap order:**
  1. HUD buttons and keeper badges;
  2. the pad (while controlling);
  3. job chips;
  4. bubbles;
  5. keepers (a box of x ± 10, from `y − 78` to `y + 2`; Pip's from `y − 58`);
  6. dragons (Rush if a job is waiting, otherwise the card);
  7. empty space, which releases control and closes the card.

  Tapping a badge takes that keeper, or releases them if they are the one controlled, and eases the camera to them.
- **The pad and label** (§3.11), shown only while controlling. The label line is right-aligned at (632, 258), for
  example `BEA · BOWL · E: FEED WICK`. Other labels: `E: TAKE BOWL`, `E: GROOM COBBLE`, `E: TUCK IN ECHO`,
  `E: BATHE RIPPLE`, `E: PLAY WITH ZAP`, `E: PUT BOWL BACK`, `WICK IS ON THE WAY`.
- **The marker:** a 7×5 inked ▼ in the keeper's primary colour at head − 17, the rush mark's slot. A controlled
  keeper is never rushed, so the slot is free.
- **Follow camera:** keep the keeper inside screen x 160–480 and y 90–270, easing 1/8 per frame. A manual drag
  pauses the follow for 180 frames.
- **fit():** `s = min(innerWidth/640, innerHeight/360); s = s >= 1 ? floor(s) : s`. In portrait while controlling,
  a line reads `TURN SIDEWAYS FOR BIG BUTTONS` at y 34.
- **The hint** becomes `TAP A BUBBLE: RUSH   TAP A KEEPER: TAKE`, hidden while controlling.
- **Anims:** walk and carry play at `WALK / cast.speed` while moving, `idle` when standing, `hold` during a pickup.
  A climb still shows `idle`, since no climb anim exists (a stand-in).

**sim-check §16 Control** (seed 1, default `dayLen`)

1. Take BEA. After one step she is `manual`.
2. Set EMBER's food to 0.3. EMBER is already `arrived` at kitchen slot 0.
3. Steer to the post (x 232), act, and wait 40 steps: she carries food.
4. Steer to x 306, act, and run: the job is done with `doneBy.BEA === 1`, EMBER's food is 1, and BEA is `manual` again.
5. Steer to x 680 (crossing the lift bay under R1), then `dy = −1`: she reaches f1 within 200 steps.
6. Over 10 000 steps with jobs pending, including 20 `rush()` calls on waiting jobs chosen with `rngAt`, BEA's `job`
   is only ever set by `act`.
7. Release: she goes `home` and then `idle` at her station.
8. Save while controlled, then `fromSave`: BEA is not manual.
9. The same command script run twice gives equal digests.
10. R4: stopping input inside the lift bay leaves her walking until she is clear.

The §2 invariants hold throughout.

**smoke** (live, `view=base&save=0`)

1. Click BEA's badge (`hook.badges.BEA`): `controlled === 'BEA'`.
2. Hold `d` for 600 ms: her x increases.
3. Press Esc: `controlled === null`.
4. Click the centre of BEA's body box (`hook.keepers[].box`): `controlled === 'BEA'`.
5. Mouse down on the ▶ pad rect for 500 ms, then up: x increases.
6. Click `LET GO`: `null`.

The `baseInput` drag and chip case still passes.

**The hook adds:** `keepers: {name, f, x, box}[]`, `controlled`, `badges`, `pad`, `action`.

**Shots:** `base_control` (`view=base&t=120&take=bea`). Check the pad, the marker and the label, and that nothing
covers a dragon's eye.

**Docs**

- **B2:** "Care is managerial by default; you may take any one keeper by hand".
- **B7:** "…unless you take one".
- **§4.8:** the controls.
- **A new §4.10 "Taking a keeper":** the take and release rules; the action's order; "only at the dragon's slot in
  its need's room"; the exclusions; the touch pad.
- **KEEPERS K11:** "nothing in it the player *must* run".
- **KEEPERS status:** the base now has a player loop; the missing `climb` anim uses `idle` as a stand-in.

**Done when**

- `npm run check` is green.
- In `npm run dev` the whole loop works by hand, on both keyboard and touch: fetch, feed, bathe, play, groom and tuck
  in. (Check the touch pad in a 390×844 viewport.)

---

### S8 — Missions I: the Map Room table, the world map, climate, the team, the Aerie trip, rewards

**Closes** (#5 items; all under D4):

| Item | Criterion |
|---|---|
| #5.1 | *"I want a picture of the kind of climate and a mission chooser."* |
| #5.2 | *"There should be a world map with different places to explore."* |
| #5.3 (up front) | *"You should be presented with challenges that occur on the mission - and dragon and people that are good solutions to those challenges."* The chooser shows them, and a trip log records them. S9 shows them on the road. |
| #5.4 | *"We can get eggs on a mission."* With S5. |
| #5.6 | *"Missions should be launched from the aerie using the map room."* |

**Advances #5.5:** baddie missions appear on the board, and B8 is amended here. S9 draws the beat.

**Closes #11:** the tack, bunks, map room and aerie are proven used, so `PLANNED` is empty.

**Depends on:** S5 (`addEgg`), S7 (the controlled keeper must be excluded from riders).

**Also (orchestrator addendum, art kit):** S9a already built `missiondata.ts` (the shared types), `backdrops.ts` (`drawClimate`), `missionicons.ts` (challenge and skill icons, the saddle), `baddies.ts` (`drawBaddiePortrait` for the chooser) and `FLOORS.road`: import them; do not redraw them. Read the handoff's S9a section for the exact exports.

**Also (orchestrator addendum):** honour S6b's barn capacity: read `BARN_CAP` and the barn count from where S6b exports them (see the handoff's S6b section). The chooser shows the egg reward only when a nest is free, and says `BARN FULL: THE EGG WILL WAIT` when the barn is at the cap (the egg still comes home and waits in its nest). A team away frees its dragons' barn places for the count only if S6b's design says so. The whole S6b/S6c work must still pass after this slice (capacity section, night checks).

**Build order inside the slice:**

1. the model and its sim-check;
2. the map screen;
3. the mission screen;
4. the chip and the progress card.

**Files**

| Action | File | What |
|---|---|---|
| new | `src/game/regions.ts` | data: regions, challenges, skills, baddies' counters, map geometry, climate palettes, titles |
| new | `src/game/missions.ts` | DOM-free: the board, eligibility, odds, riders, BEST TEAM, sending, the trip machine, rewards, reveals |
| new | `src/game/maptable.ts` | the overlay: the map screen and the mission screen, drawing and hit rects |
| new | `src/game/backdrops.ts` | `drawClimate(ctx, climate, phase, rect, scroll = 0)`: the region's picture in stepped flat layers. The chooser uses it now; S9 uses it as parallax. |
| change | `src/game/icons.ts` | 9×9 challenge icons (11), skill icons (4), 24×24 baddie portraits (3, their own small drawings), a saddle sprite, and the egg's carried icon (from `eggs.ts`) |
| change | `src/game/sim.ts` | `place: 'away'`; keeper phases `muster`, `depart`, `away`, `deliver`, `rest`; `carrying` gains `'saddle' \| 'egg'`; `missions` state; the `send` command |
| change | `src/game/start.ts` | `KeeperPlace.skill` |
| change | `src/game/layout.ts` | f5 spans extend west to −200 on both nets (the sky bridge) |
| change | `src/game/building.ts` | the sky bridge (rope posts and straw planks from x 8 to the world's left edge); the Map Room table stays the tap target |
| change | `src/game/base.ts` | the MAP button and M key; the table tap; overlays (the world pauses while open); SEND pans to the Aerie; the TEAM OUT chip and progress card; COIN; away actors hidden |
| change | `src/game/people.ts` | anims for the new phases; carried saddle and egg |
| change | `src/game/control.ts` | `Command` gains `{ kind: 'send'; mission: number; pairs: Pair[] }`; `take` refuses keepers on a trip |
| change | `src/game/save.ts` | missions state and coin; bump |
| change | `src/game/presets.ts` | `muster` |
| change | `src/gallery.ts` | `panel=`, `mission=` |
| change | `tools/palette-check.ts` | climate backdrops join gate (w) |
| change | `types/globals.d.ts`, `tools/sim-check.ts`, `tools/smoke.ts`, `tools/shots.ts` | |

**Data** (`regions.ts`)

```ts
export type RegionId = 'millbrook' | 'oldmine' | 'bramblewood' | 'highfold' | 'frostmere' | 'emberfell';
export type ChallengeId = 'dark' | 'heavy' | 'cold' | 'storm' | 'flood' | 'thorns' | 'lost' | 'miller' | 'hurt' | 'fog' | 'gap';
export type Skill = 'charm' | 'medic' | 'navigator' | 'nimble';
export type BaddieId = 'moleking' | 'stormroc' | 'frostgiant';
export type BaddieExit = 'calmed' | 'outwitted' | 'drivenOff';
export type Climate = 'meadow' | 'caves' | 'forest' | 'peaks' | 'ice' | 'ash';
export interface Counter { element?: DragonElement; skill?: Skill }
export const CHALLENGES: Readonly<Record<ChallengeId, { name: string; counter: Counter; met: string /* "LIGHTS THE WAY" */ }>>;
export const BADDIES: Readonly<Record<BaddieId, { name: string; counters: readonly [Counter, Counter]; exit: BaddieExit }>>;
export interface Region { id: RegionId; name: string; climate: Climate; word: string; pool: readonly ChallengeId[]; eggs: readonly DragonElement[];
  baddie: BaddieId | null; neighbours: readonly RegionId[]; start: boolean; titles: readonly string[]; baddieTitle?: string;
  map: { poly: readonly number[]; pin: readonly [number, number] } }
export const REGIONS: readonly Region[];
export const KEEPER_SKILL: Readonly<Record<KeeperId, Skill>> = { bea: 'charm', tomas: 'medic', iris: 'navigator', pip: 'nimble' };
```

**Counters**

| Challenge | Name | Countered by |
|---|---|---|
| `dark` | PITCH DARK | dusk |
| `heavy` | HEAVY LOAD | rock |
| `cold` | THE COLD | fire |
| `storm` | STORM | lightning |
| `flood` | SPRING FLOOD | water |
| `thorns` | THORNS | spike |
| `lost` | LOST THINGS | slinkwing |
| `miller` | GRUMPY MILLER | CHARM |
| `hurt` | HURT ANIMAL | MEDIC |
| `fog` | THICK FOG | NAVIGATOR |
| `gap` | NARROW GAP | NIMBLE |

**Regions**

| Region | Climate (word) | Pool | Eggs | Baddie (counters → exit) | Revealed | Neighbours |
|---|---|---|---|---|---|---|
| MILLBROOK | meadow (MILD MEADOWS) | flood, miller, hurt, lost | water, spike | – | at start | frostmere, bramblewood |
| OLD MINE ROAD | caves (DRY HILLS AND CAVES) | dark, heavy, lost, gap | rock, dusk | THE MOLE KING (dusk + CHARM → calmed) | at start | highfold, emberfell |
| BRAMBLEWOOD | forest (DEEP FOREST) | thorns, lost, fog, hurt | spike, slinkwing | – | at start | highfold, millbrook |
| HIGHFOLD | peaks (STORMY PEAKS) | storm, cold, fog, gap | lightning, slinkwing | THE STORM ROC (lightning + NAVIGATOR → outwitted) | by a success in a neighbour | oldmine, bramblewood, emberfell |
| FROSTMERE | ice (FROZEN LAKE) | cold, flood, gap, hurt | fire, water | THE FROST GIANT (fire + NIMBLE → drivenOff) | by a success in a neighbour | millbrook, emberfell |
| EMBERFELL | ash (WARM ASH HILLS) | heavy, dark, storm, miller | fire, lightning, dusk | – | by a success in a neighbour | highfold, frostmere, oldmine |

**The board** (`rollBoard(sim, day)`)

- **When:** at construction (day 1), and at every 05:00.
- **Reveals first:** at each dawn, any `pendingReveal` regions join `explored`.
- **Missions:** one per explored region, in the order `rngAt(seed, TAG.BOARD, day)` shuffles them, up to 3, never
  counting the mission that is out.
- **Difficulty** (drawn with `rngAt(seed, TAG.BOARD, day, regionIndex)`):

  | Difficulty | Chance | Challenges | Days | Coin | Egg chance |
  |---|---|---|---|---|---|
  | easy | 0.4 | 2 | 1 | 40 | 0.35 |
  | normal | 0.4 | 3 | 2 | 80 | 0.35 |
  | hard | 0.2 | 3 + the region's baddie (from day 3, if it has one), else 4 | 3 | 150 | 0.6 |

  Challenges are drawn from the pool without replacement.
- **Day 1** always includes **THE LOST NEST**: MILLBROOK, easy, [flood, lost], coin 40, egg guaranteed. The starters
  RIPPLE and ECHO can cover it. It exists because the seven starters age in lockstep.
- **Guaranteed eggs:** `guaranteedEgg = !firstSuccess.includes(region)`, so the first success in any region always
  gives an egg.

**Eligibility, riders and odds** (`missions.ts`)

- **Pairs:** 1 or 2. Only one trip at a time.
- **Dragons:**
  - `place === 'barn'` and not in a `settle` or `retire` goal;
  - `adult` or `elder`, or `young` on easy missions only;
  - never a baby.
- **Free riders:** not `manual`, not on the trip. At most `keepers − 2` riders go, so **2 keepers always stay home**.
- **Auto rider for each dragon:**
  1. its partner (the keeper whose specialty is the dragon's element's `OWN_NEED`), if free and not already taken;
  2. otherwise a free keeper whose skill counters a challenge the team leaves uncovered, lowest id first;
  3. otherwise any free keeper, lowest id first.

  **Never the controlled keeper.** The player can cycle a pair's rider through the free keepers.
- **Covered:** a challenge is covered when a team dragon's element or a rider's skill matches its counter. A baddie
  is covered when both of its counters are met.
- **Odds:** `clamp(0.20 + 0.15·covered + (baddie covered ? 0.15 : 0) + 0.05·pairsWithMood≥0.5 + 0.05·partnerPairs, 0.05, 0.95)`.
  - *Example:* THE LOST NEST with RIPPLE (auto rider IRIS) and ECHO (partner TOMAS), both with mood ≥ 0.5:
    0.2 + 0.30 + 0.10 + 0.05 = **0.65**.
  - *Example:* the same with RIPPLE alone: 0.2 + 0.15 + 0.05 = **0.40**.
- **`bestTeam`:** tries every eligible dragon, and every pair of them in id order, with auto riders. It keeps the
  highest odds; ties go to fewer pairs, then lower dragon ids.
- **`canSend`** gives a reason when it refuses: `A TEAM IS ALREADY OUT`, `PICK A DRAGON`, `TOO YOUNG FOR THIS ONE`,
  `NOT ENOUGH KEEPERS HOME`.

**Sending and the trip** (`missions.ts`; every step deterministic; `stats.used` as marked)

- **The send command:**
  - `stats.used.maproom++`.
  - The outcome: `success = rngAt(seed, TAG.MISSION, id).next() < odds`.
  - If a nest is free (no egg and not reserved), reserve it. Otherwise the reward is `HATCHERY FULL` and no egg is rolled.
  - The egg, on success with a reserved nest: `guaranteed || rngAt(seed, TAG.EGG, id).next() < eggChance`. Its
    element is `region.eggs[rngAt(seed, TAG.EGG, id, 1).int(0, n−1)]`.
  - Coin: success gives `coin`, failure `floor(coin/2)`.
  - Stops:
    - challenge i sits at `(i+1)/(n+1)·0.85` of the length, and the baddie at 0.9;
    - `covered` and `by` (the names) are filled in;
    - on a failure, `turnBack` is the first uncovered stop, or the last stop if everything was covered;
    - a log line is prepared for each stop.
- **`muster`:**
  - The team dragons' jobs are purged, their keepers released (not counted as pre-empted), and their slots released.
  - Dragons take `goal: 'muster'`, routing to deck spots (5, 120) and (5, 280) through the lift with call `prio 2`.
  - Riders' jobs are released, and they go `muster`:
    1. walk to the tack post (L f0, x 112);
    2. `pickup` for 40 steps, then `carrying: 'saddle'`, and `used.tack++`;
    3. walk to (5, 184) or (5, 344) by `ladderL`.
  - Muster is done when everyone stands at their spot facing −1. sim-check asserts this takes 3600 steps or fewer.
- **`depart`:**
  - `used.aerie++`.
  - Everyone walks west to x −200 over the sky bridge (dragons by the gait, riders at `WALK`).
  - When the last one's x is below −120: `departAt = tick`, `returnAt = departAt + days·dayLen`. Dragons become
    `place = 'away'`: not drawn, no jobs, needs frozen, stage-ups and retirement deferred. Riders go to phase `away`.
- **`return`**, at `returnAt`:
  - The team appears at x −200 on f5 and walks east to the deck spots. `used.aerie++`.
  - Coin is added.
  - Needs: food and sleep become `min(v, 0.45)` on a success or `min(v, 0.30)` on a failure. That is the burst of
    bubbles. Nobody is hurt.
  - Each dragon, reaching its deck spot, becomes `place = 'barn'` with `goal: 'settle'` (the nearest free slot of its
    size), and its normal needs take over.
  - Riders:
    1. The rider with the egg goes `deliver` with `carrying: 'egg'`, walks to the reserved nest on f0, and calls
       `addEgg(el)` into that nest.
    2. Every rider then walks to the tack post and puts the saddle back (`used.tack++`).
    3. Then to the bunks post (L f2): `rest` for `REST_STEPS = 900` (`used.bunks++` on arrival).
    4. Then `home`.

    **Keepers in `rest` are assignable**: a claim ends the rest.
- **`home`:** the trip is over when every pair has finished its landing. Then:
  - `trip = null`;
  - on a success, `firstSuccess += region` and `pendingReveal += neighbours not yet explored`.
- **Taking a keeper who is on a trip** (in `muster`, `depart`, `away` or `deliver`) is refused. Their badge shows ↗.

**The UI** (`maptable.ts`; overlays at 640×360, drawn after the HUD bar; the world pauses while one is open)

- **Opening:** the `MAP` button or the `M` key eases the camera to the Map Room (x 0, y 40), then opens after 30
  frames. Tapping the table prop (world rect x 70–130, y 172–208) opens it at once.
- **Map screen** (`ui.screen = 'map'`)
  - A parchment panel at (8, 18, 624, 318), `#e8d8a8` with an inked 2 px `#8a6a4a` border. The title `MAP ROOM` is
    outlined.
  - **Regions** (polygons from `regions.ts`) are flat 2-band cel fills in their climate colour, inked.
  - **Roads** are dotted: 2×2 dots every 6 px, in `#8a6a4a`, between neighbours, plus HOME (a 13×11 barn sprite in
    the lower left) to each start region.
  - **Unexplored regions** are drawn in `#d8c898` with 2 px diagonal hatch lines every 6 px in `#c0ae80`, and a "?".
    No alpha.
  - **Pins:** each board mission has a numbered 9×11 inked pin, and the trip's region gets a small flag.
  - `TAP A PIN`, and a `BACK` button at (560, 316, 64, 16).
- **Mission screen** (`ui.screen = 'mission'`; left column x 16–316, right column x 324–624)
  - **Left column:**
    - The **climate picture**, 300×112 at (16, 26): `drawClimate` at `day`. It is made of stepped sky bands, a far
      ridge, near forms and weather marks, all at least 2 px:

      | Climate | Weather marks |
      |---|---|
      | ice | snow, 2×2 |
      | meadow and forest | rain, 2×4 streaks |
      | peaks | bolts, 3 px thick |
      | ash | heat bands |
      | caves | a cave mouth with one stepped lamp pool |

      It is inked and framed, and shows **no dragons**.
    - Below it:
      - the title (outlined);
      - `REGION · WORD`;
      - `2 DAYS · 80 COIN · EGG 35 %`, or `EGG: SURE (FIRST VISIT)`, or, in grey, `HATCHERY FULL: NO EGG`.
    - **Challenge rows**, from y 184, 22 px each:
      - the icon, the name and `NEEDS: DUSK` (or `NEEDS: CHARM`);
      - `GOOD: WICK · IRIS`, listing the eligible home dragons and free keepers who counter it. The names are tappable
        and add that dragon or rider to the team;
      - a ✓ once the team covers it.
    - **The baddie row:** a 24×24 portrait, `BIG BADDIE: THE MOLE KING`, and `NEEDS DUSK + CHARM`.
  - **Right column:**
    - `TEAM`, and two pair slots (324, 40 and 324, 88; 300×44 each). Each shows:
      - the dragon's name, an element swatch, its stage word and its mood icon;
      - the rider's badge (tap to cycle);
      - `PARTNERS +5 %` when they are partners;
      - an ✕ to remove the pair.
    - **Eligible dragons:** a grid of 96×18 buttons, three to a row, from (324, 142).
      - A button carries a ★ and the counter word when the dragon counters an uncovered challenge.
      - A dragon that cannot go is greyed, with the reason: `BABY`, `TOO YOUNG`, `AWAY` or `IN THE GARDEN`.
    - The odds: a 10-segment bar at (324, 270, 150, 10) and `ODDS 65 %`.
    - Buttons: `BEST TEAM` (324, 290, 90, 18), `SEND FROM THE AERIE` (420, 290, 204, 18, greyed with the reason when
      it cannot send) and `BACK`.
  - SEND pushes the `send` command, closes the overlay and eases the camera to the Aerie (0, 40). The camera is not
    locked: the player may drag.
- **The TEAM OUT chip** (520, 19, 114×15) reads `MUSTER`, `TEAM OUT · 14H` (game hours to go), or `LANDING`. In S8 a
  tap opens a **progress card** (8, 20, 300×120): each stop with ✓, ✗ or a pending mark; the log lines passed so far;
  the time left. S9 replaces this card with the scene.
- **HUD:** `COIN n` at x 334; `MAP` at 610–636.
- **Keepers on a trip are not drawn while away.** Riders carry a saddle sprite, and the rider with the egg carries the egg.

**Palette:** the climate layers go into `BACKDROPS.climate[climate][phase]` and pass gate (w). The sky bridge's planks
are `FLOORS.straw`.

**sim-check** (`dayLen: 600` unless stated)

- **§17 Board:**
  - deterministic for seeds 1–5 and days 1–10, computed twice;
  - day 1 has THE LOST NEST;
  - 3 missions or fewer, at most one per explored region;
  - no baddie before day 3;
  - the challenge counts match the difficulty.
- **§18 Odds:** a table of at least 6 hand-computed cases, including both examples above and the clamps.
- **§19 Team rules:**
  - a baby is refused, a young is refused on normal and hard missions, garden residents are refused;
  - **after `take(BEA)`, `autoRider` never returns BEA, for any mission and any dragon**;
  - 2 riders at most, with 2 or more keepers home;
  - a second `send` is refused.
- **§20 Full trip:** THE LOST NEST with RIPPLE and ECHO.
  - Muster takes 3600 steps or fewer, and the dragons reach f5 by the lift (`liftRides +2` or more).
  - `used.maproom`, `used.tack` and `used.aerie` are all above 0.
  - While away: no job for an away dragon, and an away keeper is never assigned.
  - The team is back at `returnAt` exactly, with the needs set as specified.
  - An egg is in the reserved nest; `used.bunks > 0`; every rider is back on duty.
  - `trip === null`; the coin has been added; the neighbours are revealed at the next dawn.
- **§21 Failure:** find a failing seed among 1–200 on a low-odds send. It turns back at the first uncovered stop, gets
  half the coin, and no egg.
- **§22 Determinism:** 20 seeds with the same send give the same success and egg, twice.
- **§23 Care while away** (`dayLen` 10 800): a 2-pair team, with a test override making the trip last 30 minutes.
  Over 30 min: `emptySteps === 0`, and the barn's service gates hold, with the average wait allowed to be 25 % over
  the S3 gate. This proves that 2 keepers home is enough.
- **§6 Continuation:** save mid-muster and mid-away.
- **§8 Rooms:** `PLANNED` is empty: assert `PLANNED.size === 0`. Every named kind, plus lift, aerie, gate and garden,
  has been used.

**smoke**

- **Frozen:** `view=base&t=60&panel=map` has `hook.ui.screen === 'map'`, `hook.board.length === 3` and 100 or more colours.
- **Frozen:** `view=base&t=60&panel=mission&mission=0` has `hook.ui.screen === 'mission'`.
- **Live** (`view=base&save=0`):
  1. Click `hook.buttons.map`.
  2. Wait up to 2 s for `ui.screen === 'map'`.
  3. Click `hook.ui.pins[0]`, then `BEST TEAM`, then `SEND`.
  4. `hook.trip.state === 'muster'`, and within 2 s `camY ≤ 200`.
- **The hook adds:** `coin`, `board[]`, `trip`, `ui {screen, pins, buttons}`.

**Shots:** `base_map` (`panel=map&t=60`), `base_mission` (`panel=mission&mission=0&t=60`) and `base_muster`
(`preset=muster&t=<the step when everyone is on the deck, from sim-check>&cam=0,40`). Inspect:

- the climate picture reads without any dragon in it;
- the fog is hatched, not faded;
- the team on the deck, with the riders beside their dragons;
- nothing covers an eye.

**Docs**

- **BASE_DESIGN B4:** a note that challenges are shown up front and met in the scene.
- **B7:** riders are auto-filled, and you may swap them.
- **B8, amended now per D4:** "Cozy: no combat, and nobody is hurt. Missions have hazards, and some end in a big baddie
  that is outwitted, calmed or driven off, never fought or killed. Old age is never decline (D21); retiring to the
  garden is the elder's reward."
- **§5.1:** the Map Room table: the world map, regions and climate pictures; the board refreshed at dawn; lengths of
  1, 2 or 3 game days (3, 6 or 9 min at 1x).
- **§5.2:**
  - 1–2 pairs, whose riders are the keepers, with partners;
  - 2 keepers always stay home; one team out at a time;
  - the muster by the Tack Room and the Lift;
  - the sky bridge stands in for `fly`, and rock and the young take it too.
- **§5.3:** the counters table, the skills per keeper, baddies needing two counters.
- **§5.4:** the odds formula.
- **§5.5:** the outcome and the turn-back.
- **§5.6:** eggs of the region's elements go to the Hatchery. The nest is reserved at SEND, or the chooser shows
  HATCHERY FULL. They hatch after 2 days, and the babies grow up.
- **§3:** the Tack, Bunks, Map Room and Aerie rows are built.
- **§8:** update.
- **KEEPERS §2:** a rider-skill column and the partner rule. Note that the mockups' riders, Rosa and Tam, are
  superseded by the four keepers.
- **ART_BIBLE status:** `fly`, `hopGlide` and the boulder hop are still follow-ups; the walk over the sky bridge
  stands in.

**Done when**

- `npm run check` is green.
- In `npm run dev`: MAP → a pin → BEST TEAM → SEND; watch the muster on the Aerie; after the return, an egg in the
  Hatchery hatches two days later.
- The shots look right.

---

### S9 — Missions II: the watchable scene, challenges on the road, big baddies, and the final integration

**Closes #5.** The remaining criteria:

- #5.3: *"You should be presented with challenges that occur on the mission - and dragon and people that are good
  solutions to those challenges"*, now also on the road.
- #5.5: *"Some of the missions might end with a big baddie."*

Under D4 the baddie is outwitted, calmed or driven off, never killed, and nobody is hurt. B5, "the scene is the
timer", is honoured.

**This slice also does the final integration pass.**

**Depends on:** S8.

**Art kit (orchestrator addendum):** S9a already built `backdrops.ts` (parallax climates), `setpieces.ts`, `baddies.ts`, `npcs.ts` (the grumpy miller: draw him at the `miller` stop, `grumpy` until CHARM's moment, then `talkedRound`) and `FLOORS.road`. Wire them in; do not redraw them. The art items in this slice's build order are therefore done.

**Build order inside the slice:**

1. the scene's maths and its sim-check;
2. walking, stops and banners;
3. the result card;
4. the Mole King;
5. the Storm Roc and the Frost Giant.

All three baddies must ship. The order only sets priority if time runs short.

**Files**

| Action | File | What |
|---|---|---|
| new | `src/game/missionview.ts` | the scene as a **pure function** of (trip, clock), plus its drawing |
| new | `src/game/baddies.ts` | the three baddie designs and `drawBaddie` |
| change | `src/game/backdrops.ts` | parallax layers per climate × phase; set pieces per challenge |
| change | `src/game/surfaces.ts` | `FLOORS.road = '#dcd6c4'` (L 0.673, S 0.11); scene backdrops |
| change | `src/game/base.ts` | the TEAM OUT chip opens the watch overlay (replacing S8's card); `panel=watch`; `◀ BACK TO BARN` |
| change | `src/game/presets.ts` | `trip`, driven by the `trip=` param |
| change | `src/gallery.ts` | `trip=` |
| change | `tools/palette-check.ts` | gate (x) for baddies; the road in (i)/(Ki); scene backdrops in (w) |
| change | `types/globals.d.ts`, `tools/sim-check.ts`, `tools/smoke.ts`, `tools/shots.ts` | |
| change | docs | including `docs/base/base_live.png` |

**Types**

```ts
// baddies.ts
export type BaddieFace = 'neutral' | 'grumpy' | 'surprised' | 'sleepy';   // no angry face exists
export type BaddiePose = 'walk' | 'stand' | 'sit' | 'turn' | 'leave';
export interface Baddie { id: BaddieId; name: string; w: number; h: number; palette: Readonly<Record<string, string>>; exit: BaddieExit }
type Assert<T extends true> = T;
type _NoHurt = Assert<Extract<keyof Baddie, 'hurt' | 'hp' | 'health' | 'defeated' | 'damage'> extends never ? true : false>;
type _Exits = Assert<[BaddieExit] extends ['calmed' | 'outwitted' | 'drivenOff'] ? (['calmed' | 'outwitted' | 'drivenOff'] extends [BaddieExit] ? true : false) : false>;
export const BADDIE_ART: Readonly<Record<BaddieId, Baddie>>;
export function drawBaddie(ctx: CanvasRenderingContext2D, id: BaddieId, x: number, feetY: number, facing: 1 | -1, face: BaddieFace, pose: BaddiePose, t: number): void;
// missionview.ts
export interface SceneFrame { E: number; n: number; stop: number | null; beatT: number; facing: 1 | -1; xs: number[] /* per pair: the dragon's road x */;
  banner: string | null; baddie: { x: number; face: BaddieFace; pose: BaddiePose } | null; done: boolean }
export function sceneAt(sim: CareSim, trip: Trip): SceneFrame;     // pure: depends only on the trip and sim.clock
export function drawMissionScene(ctx: CanvasRenderingContext2D, sim: CareSim, trip: Trip, cast: ScenePets): void;
```

**The scene** (every quantity comes from `E = clamp(clock − departAt, 0, L)`, where `L = returnAt − departAt`, so a
frozen view reproduces it exactly)

- **Beats:** `BEAT = min(600, round(0.08·L))`, `BADDIE_BEAT = min(900, round(0.12·L))`. A stop starts at `stop.at·L`.
- **Travel time:** `n = E − Σ` over started stops of `min(E − start, beatLen)`, so the walk pauses during a beat.
- **Pace:**
  - `V = min` over the team dragons of `gaitOf(el, stage).avg`.
  - Each dragon's anim speed is `sᵢ = V / avgᵢ` (1 or less), and its road position is `xᵢ = X0ᵢ + Dᵢ(sᵢ·n)`.
  - `Dᵢ(τ)` is the distance walked by anim time τ: prefix sums of each frame's `dur·move`, looped.
  - This matches the paws at speed sᵢ (G13).
  - The view plays `walk` with `{restart: true, speed: sᵢ, phase: frac(sᵢ·n/lenᵢ)}` on entering a travel segment,
    which is exact and frozen-safe.
- **Formation:** `X0` is 0 for pair 0's dragon and −170 for pair 1's. Each rider walks at `x + 56`, sorted 3 px
  behind (`y − 3`), with its walk at `speed = V / cast.speed`.
- **Turning back:** after the turn-back stop b (a failure), the facing is −1 and `xᵢ = xᵢ(n_b) − Dᵢ(sᵢ·(n − n_b))`.
- **Camera and layout:**
  - `camX = mean(xᵢ) − 260`. The road's feet sit at y 300.
  - The layers: 3 sky bands at 0 parallax, the far ridge at 0.2, near forms at 0.5, set pieces at 1.0.
  - The road is a `FLOORS.road` band at y 292–306, then a slab, then a 5 px green strip **below** it (meadow and
    forest only), then earth.
- **Stops:** stop j's set piece sits at road x = the lead's x at the stop's start + 150.

  | Challenge | Set piece |
  |---|---|
  | dark | a cave mouth with one stepped lamp pool when it is met |
  | heavy | a boulder cart |
  | cold | a snowdrift |
  | storm | a cloud with 3 px bolts |
  | flood | a ford |
  | thorns | a bramble arch |
  | lost | a signpost fork |
  | miller | a mill |
  | hurt | a small bird with a bandaged wing (cozy) |
  | fog | a fog bank in stepped flat bands, **behind** the team |
  | gap | two rocks |
- **During a beat:** the counter plays its **moment** (the others idle).

  | Challenge | Who | Moment |
  |---|---|---|
  | dark | dusk | `breath` |
  | heavy | rock | `happy` |
  | cold | fire | `breath` |
  | storm | lightning | `breath` |
  | flood | water | `breath` |
  | thorns | spike | `breath` |
  | lost | slinkwing | `call` |
  | miller | CHARM | `wave` |
  | hurt | MEDIC | `petLow` |
  | fog | NAVIGATOR | `shh` |
  | gap | NIMBLE | `cheer` |

  A frozen view replays at most one beat's worth of ticks from the beat's start.
- **Banners** (y 22, outlined), for example:
  - `PITCH DARK — WICK LIGHTS THE WAY ✓`
  - `SPRING FLOOD — NOBODY COULD HELP: THEY WAIT IT OUT`
  - `… THEY TURN BACK FOR HOME`
- **The baddie stop** (`BADDIE_BEAT`, split 25 / 35 / 40 %):
  1. **Enter:** the baddie walks in from the right to the lead + 200, looking `grumpy`.
  2. **The two counters' moments,** in turn. The baddie turns `surprised`.
  3. **Exit, on a success:**

     | Exit | What it does | Face |
     |---|---|---|
     | `calmed` | sits and dozes, with three 3×3 "z" marks stepping up | `sleepy` |
     | `outwitted` | turns and wanders off the wrong way | `surprised`, then `neutral` |
     | `drivenOff` | shuffles off to the right, grumbling, with 2 px dust puffs | `grumpy` |

     On a failure it stays, `grumpy`, and the banner reads `THE MOLE KING KEEPS THE ROAD. HOME FOR TEA. NOBODY IS HURT.`
     The team turns back.

  No knockback, no hurt pose, nothing flung.
- **The result card** (from E ≥ L until the team lands): 300×120 at (170, 110).
  - The title `HOME SAFE!` or `HOME EARLY`, outlined.
  - The rewards line, and the egg sprite if one was won.
  - `NOBODY IS HURT.`
  - Tap to close.
- **The overlay** covers y 16–360, with a `◀ BACK TO BARN` button at (8, 338, 110, 16). The top bar stays. The world
  keeps stepping underneath at the chosen speed.

**The baddies** (house style, 96–140 px, drawn from cel shapes with `src/lib/art/shading.ts`; eyes never covered;
faces only from `BaddieFace`, where `grumpy` is a flat brow line and a pout, never a V brow)

| Baddie | Size | Look | Exit |
|---|---|---|---|
| THE MOLE KING (oldmine) | ~112×88 | a round velvet-brown body, a tiny gold crown, big pink digging paws, spectacles | `calmed`: dusk's lamp and Bea's pie, then it curls up and dozes |
| THE STORM ROC (highfold) | ~140×100 | a fluffy slate-blue bird with folded wings and a tufted crest | `outwitted`: Iris shows it a better crag, and lightning's flashes turn it the wrong way |
| THE FROST GIANT (frostmere) | ~96×140 | a woolly snow giant with a knitted scarf and a big red nose | `drivenOff`: fire warms the pass while Pip dodges its snowballs, and it grumbles off to colder hills |

**Palette gate (x):** every baddie fill is at least 25 % in luminance from `FLOORS.road` and from its region's
backdrop bands at every phase, and at least 6 okL from ink. Report it in ART_BIBLE 5.8.

**The `trip` preset** (`trip=<region>:<progress>[:fail]`): the start cast, then `after(sim)` builds:

- a hard mission in that region, with its baddie if the region has one;
- a team of 2 pairs of starters, with auto riders;
- the trip in `away`, with `departAt` set so that the progress is exact at the frozen t;
- the outcome forced to success, unless `:fail`.

**sim-check §24 Scene**

- For an easy, a normal and a hard-with-baddie mission, each with both outcomes:
  - `sceneAt` at E = 0 has the team at X0, and `done` at E = L;
  - `n` never decreases;
  - xs never decrease before a turn-back and never increase after it;
  - x is constant through every beat window;
  - on a failure the turn-back stop is the first uncovered stop;
  - on a success, the baddie's exit is in {calmed, outwitted, drivenOff}.
- **No skate:** for every travel step, `Δxᵢ = Dᵢ(sᵢ(n+1)) − Dᵢ(sᵢn)`, and that equals sᵢ times the frame's `move`
  within 1e-9 when no frame boundary is crossed.
- The type assertions compile (typecheck).

**smoke**

| Page (frozen) | Check |
|---|---|
| `view=base&preset=trip&trip=oldmine:0.95&panel=watch&t=60` | `hook.scene.stop === 'baddie'`, `hook.scene.baddie === 'moleking'`; 150 or more colours |
| `…&trip=millbrook:0.3&panel=watch&t=60` | a challenge stop with `covered === true` and a non-empty banner |
| `…&trip=bramblewood:0.7:fail&panel=watch&t=60` | `hook.scene.facing === −1` |

**Live:** in the S8 flow, after SEND, the chip opens `watch` and BACK returns to `none`.

**The hook adds:** `scene {stop, banner, baddie, exit, facing, progress}`.

**Shots:**

| Shot | Query |
|---|---|
| `base_watch` | `trip=millbrook:0.3` |
| `base_baddie_moleking` | `trip=oldmine:0.95` |
| `base_baddie_stormroc` | `trip=highfold:0.95` |
| `base_baddie_frostgiant` | `trip=frostmere:0.95` |
| `base_result` | `trip=oldmine:1` |
| `base_final` | `view=base&t=1800` |

Inspect: the baddies read at 1x and look grumpy, not angry; the eyes are clear; the road is pale; the fog is behind
the team; nobody looks hurt.

**Final integration** (part of this slice's done-definition)

- Include the S6b (barn capacity) and S6c (night) addenda in every doc update below, and re-run `npm run capacity` for BASE_DESIGN 4.7.

- Re-run `npm run sim` and paste every §8.1 number.
- Replace `docs/base/base_live.png` with `base_final` (`node tools/shot.ts docs/base/base_live.png="view=base&t=1800" --scale 2`).
- **BASE_DESIGN:**
  - §6 rewritten as built: the pace formula, stops and beats, the baddie beat, the result card, back to the barn;
  - B5 "the scene is the timer" confirmed;
  - §8 statuses;
  - §9: close what the issues settled, and list what is left.
- **ART_BIBLE:**
  - a **Baddies** section: the designs, sizes, faces, exits and the gate (x) report;
  - the 5.8 gate report re-pasted;
  - status lines naming every stand-in (the 12 f flash grow-up, the walk over the sky bridge, the keepers' `idle`
    climb) and every follow-up (`fly`, `hopGlide`, the boulder hop, the 240 f grow-up, the keeper climb, `play`, the
    baths).
- **KEEPERS status.**
- If sim-check takes more than 30 s, move its sections into `tools/simcheck/*.ts` without changing what they check.

**Done when**

- `npm run check` is green.
- Every shot above is inspected.
- Every row of the §5 traceability table has its proof passing.
- In `npm run dev`, a hard Old Mine Road mission ends with the Mole King dozing off, and nobody hurt.

---

## 7. Where each judge's mustFix is handled

| mustFix | Where it is handled |
|---|---|
| A lift must never show two dragons overlapping in one shaft; single rider, deterministic call order, an invariant | P1, §3.4 (one rider, the call priority, R1–R4), and S3's sim-check (≤ 1 rider and the bay invariant) |
| Walking pets must not skate from the ±10 % desync | G13, §3.4, `gait.ts`, and S3: `walk` is played with `restart: true, speed: 1` on every bout. Measured: gaits with zero-move frames make any constant pace skate, hence the gait tables |
| The #11 assertion must be neither vacuous nor red between slices | §3.9: `PLANNED`, with the reverse check (a used room still in `PLANNED` fails). It is emptied by S8, which asserts `size === 0` |
| The controlled keeper is excluded from assignment, both Rush choices and rider picks, all tested | S7 (`assign`, the Rush search, the Rush pre-emption, with 20 rushes in §16) and S8 §19 (`autoRider` never returns the controlled keeper) |
| A manual serve only in the need's room, at the reserved slot | P12; S7's `act` requires the dragon to be `arrived` at its slot in `NEED_ROOM[need]` (or a garden resident in `wait`). A walking dragon shows "ON THE WAY" |
| Month-scale frozen views use presets, not `day=` plus stepping | G4; the presets `growup`, `eggs`, `hatch` (S5), `garden`, `retire` (S6), `muster` (S8), `trip` (S9) |
| Care holds while a team is out: 2 or more keepers home, away needs frozen or floored, `emptySteps = 0` | P13; S8: at most `keepers − 2` riders, needs frozen while away, §23 (a 30-minute run with the largest team away) |
| Resting keepers stay assignable, and the long runs stay green | P15; S8 (`rest` counts as free for `assign`); S3, S6 and S8 each run 30 minutes |
| Night never touches floors, walls or dragons, proven by a pixel diff; the backdrop gate | G8; S4 (the `layers=world` diff at hour 12 vs 22 with the same `barnDigest`, sim-check §11 phase independence, gate (w)) |
| The big baddie is a big, readable beat with a cozy exit and no hurt state | P14; S9 (96–140 px, faces limited by type, compile-time `_NoHurt` and `_Exits`, the beat shown in the scene and the frozen smoke); B8 amended in S8 |
| Challenges shown up front and as they happen | S8 (the chooser's GOOD lines and ✓, the progress log) and S9 (stops, banners, moments) |
| Every new floor through `FLOORS` and gates (i)/(Ki), S < 0.20, before a dragon stands on it | G7; S2 (straw for the car deck, landings, ladder bay, deck and gantry; the dorm beds moved behind the band), S6 (path), S8 (sky bridge in straw), S9 (road) |
| Growth and retirement never mid-act or mid-walk | §3.5 ("settled"), S5 (plus the size rule), S6 |
| The dragon pad covers the longest body | §3.1 `DRAGON_PAD` per stage, from the measured extents (elder 76 against a measured 74.7) |
| The lift and gantry surfaces are gated; the shaft is drawn outside `ROOF_IN`; a landing never hides the car | S2: the car is drawn after the building and before the cast; the landings are straw; the headframe housing is drawn outside the clip |
| No lift stop at module 0 on f2 | P1: the lift is at module 2, and f2's dragon span excludes m0 and m5 |
| The live smoke cases opt out of saving; a planted-save frozen case; loading only in `attach()` | G4, G5, S1 (the `save=0` param), S4 (the planted-save case and the live persistence case) |
| The gallery `keydown` returns early in the first slice | S1 |
| Hook types; the HUD clear of (350, 200); taps on a non-drag `pointerup`; a chip gives +1 Rush | G9; every slice's hook list; S7's tap order |
| Save coverage (trips, eggs, residents), control released, unknown versions | §3.6; the continuation scenarios in S3, S5, S6, S7 and S8; `SaveVersionError` in S1, caught in S4 |

---

## 8. Risks and fallbacks

1. **Care slows once dragons walk (S3).** Adults walk at 0.28–0.54 px per step, and a cross-floor trip is about
   500–800 px plus the lift.
   - Mitigations: the central lift; `LEAD_PX` pipelining (the keeper sets out while the dragon walks); fixed slots;
     the busiest room is three modules wide.
   - The gates are measured before any later slice depends on them. The levers are listed in S3, in order.
   - The dragons are never sped up, which would break G13.
2. **The lift and bay stall or starve.** R3 (`closing`) and R4 (never stopping inside the bay) prevent that.
   - S3's invariants catch a stuck walker within 60 s.
   - If bay waits still blow the bounds: raise `LIFT_SPEED` to 1.5, then shorten `BAY_CLOSE`.
3. **Too much art for a slice** (S2's building, S8's UI, S9's baddies). Each slice lists a build order, and greybox
   fidelity is the bar. The stand-ins are named:

   | Stand-in | In place of |
   |---|---|
   | the 12 f flash | the grow-up |
   | the walk over the sky bridge | `fly` |
   | `idle` | the keeper climb |

   No stand-in breaks a hard rule.
4. **The frozen contract leaks.** Storage lives in `storage.ts`, which only `attach()` calls. Speed defaults to 1. The
   presets are code. The planted-save smoke case guards all of this.
5. **The seven starters age in lockstep** (a consequence of D1, D2 and D3): all become elders at the end of day 30
   (tick 324 000) and retire together at the end of day 60.
   - Mitigations: THE LOST NEST on day 1, a sure egg on every first success in a region, 2-day hatching, the dawn tips.
   - Staggered starting ages would change D1, so that is the orchestrator's call (§9).
6. **Performance at 8x.** About 0.19 ms per step today, so 8x costs about 1.5 ms per frame, and a 5-step catch-up
   about 7.6 ms.
   - The gait tables are built once per (element, stage), about 20 ms each.
   - `stepWary` is O(n²); that is fine below 40 pets. If a big herd is slow, bucket it by floor.
7. **Save shapes drift.** Saves are versioned, and a mismatch starts a new barn with a notice. Every slice extends the
   continuation test.
8. **sim-check gets slow.** Long horizons use `dayLen: 600`. The real-length checks are one 30-minute run per
   feature. Split the file in S9 if it passes 30 s.
9. **Input collisions.** The gallery keys are disabled for base in S1. Selection happens on a non-drag up. The
   buttons' positions are fixed in §3.11, clear of the smoke drag start and of the chips.
10. **Phones.** Portrait gets a fractional scale and a hint. The pad buttons are 26 px at 1x in landscape.

---

## 9. Judgement calls for the orchestrator to double-check

1. **Nine slices**, one over the target: missions are split model+UI / scene, and eggs are kept apart from the time
   slice. Folding S5 into S4 makes eight, with a larger S4.
2. **The hay hoist is removed.** It becomes a keeper ladder bay with a straw floor. Its dark shaft fails gate (i)
   where dragons now walk, and a car passing through floors that dragons stand on would clash. Neither issue asks
   for this; it follows from #7.
3. **The central lift crossing rule.** A lift at module 2 lies in the path of all floor-level traffic. The bay rule
   (§3.4) is extra machinery neither judge accounted for. The alternative is an end-of-barn lift (no crossings, but
   about 40 % longer trips, and no f2 stop).
4. **Dragons walk at their authored gait**, with no 1.5x pace, because the art bible says a walk's `move` is its
   world speed. So S3's first service gates are looser than today's: an average wait of 60 s or less against 30 s,
   and a maximum of 180 s or less against 120 s. They are tightened after measuring.
5. **Room decisions.**
   - Removed: Mess Hall, Lookout (the Map Room refreshes the board), Library, Workshop, Infirmary, the stores and
     attic, the Sun Loft and the Song Roost, and two of the three Bunks.
   - Kept: the Tack Room (saddles) and one Bunks (riders rest).
   - Moved: the Lamp Dorm to the hayloft (f2 m3–4); the Romp Room to f1 m0–1; Grooming widened to f1 m3–5.
6. **Garden residents are served where they stand.** This is the one stated exception to "a need is met in its own
   room" (D3 wants keepers to visit rarely, not to walk elders back into the barn).
7. **Night is visual only for the barn.** There is no keeper night shift and no change to sleep drain at night. That
   keeps the no-tint diff meaningful and settles §9's night-shift question as "deferred".
8. **Leaving by the sky bridge.** Teams walk west off the Aerie deck because `fly` is not built (and rock can't fly).
   It is recorded as a follow-up.
9. **Mission numbers.**
   - Lengths of 1, 2 or 3 game days (3, 6 or 9 minutes at 1x).
   - Needs frozen while away.
   - At most 2 riders; one team at a time.
   - A sure egg on the first success in a region, and THE LOST NEST on day 1.
   - Partners kept, static.
   - The baddie roster and its counters (§S8).
10. **The ART_BIBLE's "young adult" label is renamed "young".** This avoids confusion with #9's wording under D1.
11. **Small UX choices.**
    - Speed is not saved; a load always starts at 1x.
    - NEW GAME uses `freshSeed()`.
    - Taking a keeper who is mid-work waits until the work ends.
    - Taking a keeper who is on a trip is refused.
    - The world pauses while the Map Room overlay is open.
12. **Staggered starting ages.** D1 is fixed, so this plan does not stagger them. The orchestrator may want to ask the
    user whether all seven retiring on the same day is acceptable.
