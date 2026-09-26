# Dragon Care: The Base (design v1)

**What this covers.** The layer the pet game grows into: a **barn** where the dragons live, **towers** where their
human teammates live, **managed care** (dragons have needs, keepers meet them), and **missions** the teams go out on
and that you can watch. It sits on top of the art in `docs/ART_BIBLE.md`, and every rule there still holds: where
this document leans on one, it names the section.

**Where it came from.** A design conversation with the user, with greybox mockups at the game's true scale (the
dragons in them are the real rigs, the people the engine's humanoid rig; everything else is placeholder blocks,
`docs/base/`). The references were Fallout Shelter (the cutaway, rooms that merge), Two Point Museum (expeditions,
rooms that earn their keep) and World of Warcraft's mission table (pick a team, counter the challenges, see the odds).

**Status.** Designed, and being built in slices. The first, needs and jobs, runs as `view=base` in the gallery, in the
building of sections 2 and 3: one room per need, the Dragon Lift and the Aerie (section 8).

![The whole base, one screen of it outlined: the first greybox mockup, from before the room set was settled](base/barn_cutaway.png)

*The first greybox mockup (this image and section 2's), drawn before the rooms were settled (#11): its Sun Loft, Hay
Store, Song Roost, Attic, Hoist, Feed Store, Mess Hall, Lookout, Workshop, Library and Infirmary are gone, and module 2
is now the Dragon Lift. Sections 2 and 3 describe the building as built; section 8's picture (`base/base_live.png`)
shows it.*

---

## Decisions

| # | Decision | Why (and what lost) |
|---|---|---|
| B1 | **The base is a side-view cutaway:** a barn for the dragons with a tower at each end for the people, scrolled at 1x like Fallout Shelter's vault. | The rig is side view, facing right, authored at scale 1 (1.1). A cutaway shows every room at once in that view. |
| B2 | **Care is managerial.** Dragons have needs that drain over time; keepers (the humans) walk over and meet them. The player's one per-dragon action is **Rush**. | Tapping every dragon every few minutes is a chore, not a game (the user's words: "that doesn't sound very fun"). The hands-on care of the art bible (spike's chin, dusk's tuck-in) becomes what keepers *do*, animated. |
| B3 | **Needs show as thought bubbles** over the dragons and as a **prioritised job queue** along the bottom of the screen. | The bubble says *which* dragon wants *what* at a glance; the queue says *what's next*. |
| B4 | **Missions are set and forget,** a mission table in the style of World of Warcraft: pick a team, the dragons' elements and the riders' skills counter the mission's challenges, a success chance, a reward. | Simple at this stage, by the user's choice; no choices mid-mission. |
| B5 | **Missions are watchable:** an animated side-scrolling scene of the team completing it. **The scene is the timer.** | The user wants to see the team at work; the side-view walk the rig already has makes it cheap. |
| B6 | **Everything runs only while the game is open.** One clock drives care, missions and hatching; closing the game pauses the world. | No coming back to a barn of red bubbles; no offline catch-up to build. Missions therefore last minutes of play, not hours. |
| B7 | **Humans are assigned automatically:** keepers to jobs, riders to the dragons you send. | Fewer clicks; the player's choices are *which dragons* and *what to build*. |
| B8 | **Cozy:** no combat. Missions have hazards, not enemies; nobody is hurt; old age is never decline (D21). | The game's face set has no angry face (D18) and the elder is a reward. |

*Young adult* in the user's request (#9: "start with a young adult dragon of each kind") means a dragon at the very
start of the adult stage; the stage before adult is called *young* (the art bible's stage names: baby, young, adult,
elder). A new game therefore starts with seven dragons, one per element, each 0 days into adulthood.

---

## 1. What the art already decides

- **Scale.** The screen is 640 x 360, upscaled with nearest neighbour. An adult dragon is 93 to 128 px long (an elder
  to 137) and 48 to 70 px tall (2.4); a human on the engine rig stands 72 to 76 px. The house style cannot shrink:
  a 1 px outline and nothing under about 2 px (5.2). So the base is drawn at 1x and **scrolled**; the whole of it is
  about 2 x 2 screens. A zoomed-out view has to be a different drawing (a blueprint of room blocks with a status dot
  per dragon), never the sprites made small.
- **Floors stay pale.** Gate (i) (5.4): every floor a dragon stands on sits >= 25 % in luminance from every body and
  belly colour, with saturation under 0.20; straw `#e0d6b8` is the reference. A grass floor would swallow spike. **A
  room's identity comes from its walls, props and light, never its floor.** Walls behind the dragons are kept
  mid-light and low in saturation (they separate from the ink, and from the dark bodies by value); a wall gate joins
  `tools/palette-check.ts` once the room palette settles.
- **Darkness hides the dark dragons.** Dusk's body sits at luminance 0.08 and slinkwing's at 0.05: a night sky or a
  mine swallows them whole. Dark places show the team **only inside a pool of light** (the mission tunnel, lit by
  dusk's lamp), and night outdoors stays mid-value (the blue hour of the mission mockup). The dragons are never tinted
  to fake night: every palette gate is measured on their own colours.
- **Each element already has exactly one need of its own** (3.8): fire's is food, spike's touch, rock's bond,
  lightning's play, water's baths, slinkwing's company, dusk's sleep. The barn's core rooms are that list.
- **Loose ends the base picks up.** Nothing consumes the anims' `shriek`, `call` and `hush` events yet (5.4); `bond`,
  `charge` and `wary` are fed only by the gallery; and several anims have no scene to play in: play, the baths of six
  elements, water floating belly-up ("the habitat has no water"), the grow-up, the fly and the hop-glide. The base
  gives each a home.

---

## 2. The building

![One screen of the base in the first greybox mockup (before the rooms were settled, #11): need bubbles, a keeper carrying a bowl, the job queue](base/barn_screen.png)

*The mockup's screen, for the bubbles, the queue and the scale; its rooms are the old set (the Sun Loft, the Hay
Store, the Mess Hall, the Hoist, the Hatchery on module 2). The building as built is below, and in section 8's
picture.*

- **The barn** (the dragons): six modules wide on three floors, the ground floor, the upper floor and the **hayloft**
  under the gambrel roof. A barn room is 1 to 3 modules wide; rooms merge like Fallout Shelter's.
- **The Dragon Lift** is barn module 2 (x 488 to 648) on every floor: a shaft from the ground floor up through the
  roof to the Aerie. One car carries one dragon on a 152 px straw deck (an elder, at most 137 px, fits), between two
  40 px side rails, on two cables from a headframe that stands over the Aerie a room's height above the deck. It stops
  at the ground floor, the upper floor, the hayloft and the Aerie (floors 0, 1, 2 and 5; floors 3 and 4 are passed
  through), and a straw landing runs across the shaft on each barn floor. Keepers never ride it. Dragons ride it to
  their needs' rooms (below, "Moving around").
- **The ladder bay** is where the hay hoist was, between modules 2 and 3 (64 px): the keepers' centre ladder through
  the barn's three floors, a hatch in each slab, with straw floors running straight across it. The hoist went because
  dragons are to walk across the middle of the barn: its dark shaft (`#5a4436`, L 0.07) failed the floor gate (1),
  and a car passing through floors that dragons stand on would clash with them.
- **The towers** (the people): one at each end of the barn, five floors, a ladder up each. Their doors into the barn
  are human-sized, on the ground and upper floors: dragons don't fit, which is the reason for the split.
- **The Aerie** is walkable **floor 5** (feet at y 136): one straw deck from x 8 to 648, over the left tower's top,
  then a gantry over the barn roof (x 168 to 488: a railing along its back, two trestles down to the roof and a knee
  brace to the tower), then the lift's head. The left tower's ladder climbs on to it. Teams will leave and land here (5).
- **Every floor is straw.** Every surface a dragon or a keeper stands on (a room's band, the landings, the ladder bay,
  the towers' boards, the lift car's deck, the Aerie deck) is a `FLOORS` colour in `src/game/surfaces.ts`, and
  `tools/palette-check.ts` gates every entry before anything stands on it: gate (i) against every dragon colour at every
  stage, gate (Ki) against the keepers' shoes and trousers, and HSV saturation under 0.20. There is one entry so far,
  straw `#e0d6b8` (L 0.674, S 0.18).

| Measure (px, at scale 1) | Value | Why |
|---|---|---|
| Barn module | 160 wide | one adult, or two babies, with room to turn (2.4) |
| Floor pitch | 112: 88 of wall, a 14 px straw band, a 10 px slab | 96 px of headroom over the feet; the tallest adult is 70, and a spread wing reaches about 20 over the shoulders (5.4) |
| Dragon Lift | module 2 (160 wide), a 152 px car deck | the longest elder is 137 px |
| Ladder bay | 64 wide | a keeper's ladder, and straw across it |
| Tower | 112 wide, 96 inside | a human is 72 to 76 tall and about 30 wide |
| Aerie | floor 5: x 8 to 648, feet at y 136 | one deck over the left tower, the roof and the lift's head |
| World | 1360 x 760, ground at y 712 | about 2 x 2 screens; the player pans |

**Moving around.** Keepers walk a floor and climb the three ladders: up each tower (the left one on to the Aerie) and
the centre ladder bay's through the barn; the towers and the barn meet on the ground and upper floors only. Dragons
have ways of their own, a net per stage: the barn's floors kept half a body's length from the walls (30, 56, 72 and 76
px, baby to elder: the measured extents), the hayloft between modules 1 and 5 only (clear of the low roof slopes), the
Aerie deck, and the lift between them; never a tower.

**A dragon with an open need walks to that need's room** (#7), riding the Dragon Lift between floors, and a keeper
meets it there (section 3's slots, 4.4). It walks by its walk anim's own root motion, frame by frame (`src/game/gait.ts`:
the body moves exactly as far each step as the anim's planted paws slide, so nothing skates; spike's creep and
slinkwing's pointer pause stand still for whole frames), and a reversal is a paper turn in place (6 steps, the facing
flipped halfway: the yard's). At the lift it waits on the landing just outside the bay, facing it; callers line up nose
to tail (the one behind drawn over the rump of the one ahead, never over an eye) and step up as the car takes the one
ahead. The car comes for it, it walks in to the car's middle, turns to face the side it will walk off, rides, and walks
off. The car takes a rushed dragon's call first, then any call waiting a minute or more, then a caller on the floor the
car is at, then the oldest call (`src/game/travel.ts`).

**The bay rule.** The lift bay (x 488 to 648) is also the way across each barn floor, so one rule keeps a moving car
clear of everyone: nobody (a keeper, or a dragon other than the car's rider) steps into the bay while the car moves past
their floor, but waits at its edge (a keeper at x 478 or 658, a dragon a half-body out); the car sets off only when
nobody stands in the bay on any floor from where it is to where it goes; a departure blocked for 4 s closes the bay to
newcomers until the car goes; and anyone already in the bay walks on out, never stopping there.

---

## 3. Rooms

**Every named room has a purpose** (#11: "Rooms should only be named and have special furniture if the room has a
real purpose"): a dragon need, met there by a keeper, or a human or other action. **Each need is met in exactly one
kind of room, with a keeper** (#7: "Each room should be where a need is fulfilled - which need to be done by a
trainer"): a dragon with an open need walks to that room, and a keeper meets it there; nothing else raises a need. A place with no purpose is not a room: it is left bare (an empty wall, no props, no name). The code
holds each purpose (`src/game/layout.ts` `ROOM_INFO`, `STRUCTURES`), and `tools/sim-check.ts` proves every named room
is used: every mechanic that uses one counts it (`sim.stats.used`), and over the whole check each must show a use, or
be listed as planned for a later slice (and a planned one that shows a use fails, so the list is kept honest).

| Where | Room | Purpose | Built (the slice that uses it) |
|---|---|---|---|
| Ground floor, modules 0-1 | Hearth Kitchen | meets **food**: a keeper feeds the dragon here, with the bowl taken at the hearth | S2: food met there, bowls picked up |
| Module 2, floor to roof | Dragon Lift | carries dragons between the barn's floors and up to the Aerie | S3: dragons ride it (a ride completed) |
| Ground floor, modules 3-4 | Bathhouse | meets **bath**: a keeper washes the dragon here, with the bucket filled at the tub | S2: baths met there, buckets filled |
| Ground floor, module 5 | Hatchery | eggs lie in its three nests and hatch into babies | S5: an egg laid or hatched |
| Upper floor, modules 0-1 | Romp Room | meets **play**: a keeper plays with the dragon here, with a ball from the box by the wheel | S2: play met there, balls taken |
| Upper floor, modules 3-5 | Grooming Parlour | meets **love**, the busiest need (the own need of spike, rock and slinkwing): a keeper grooms and pets the dragon here | S2: love met there |
| Hayloft, modules 3-4 | Lamp Dorm | meets **sleep**: a keeper tucks the dragon in here | S2: sleep met there |
| Left tower, ground floor | Tack Room | riders take their saddles here before a mission and hang them back after | S8 |
| Left tower, floor 2 | Bunks | riders rest here after a mission | S8 |
| Left tower, floor 4 | Map Room | the mission table: the world map and the mission chooser | S8 |
| The roof (floor 5) | Aerie | teams gather here, leave and land | S8 |
| Right tower, ground floor | Garden Gate | the dragons' way out to the garden | S6 |
| Outside, east | Garden | the retired elders' home | S6 |

**Bare:** the hayloft's modules 0, 1 and 5; the left tower's floors 1 and 3; the right tower's five floors (its ground
floor becomes the Garden Gate in S6). **Dropped:** the Nursery, the Feed Store, the Hay Store and the Attic (nothing
used them); the Sun Loft and the Song Roost (love is met in one room, the Grooming Parlour); the Mess Hall, the
Library, the Workshop, the Infirmary and the Lookout (no mechanic); and two of the three Bunks.

**Slots.** A dragon room's dragons stand in fixed slots. Each module has one at its middle, facing the room's keepers
(a one-module room faces its post; in a two-module room the two dragons face each other, so their keepers work between
them; a three-module room faces +1, +1, -1), and two baby sub-slots 40 px in from its sides. A module holds either one
grown dragon or up to two babies; the Hatchery has baby sub-slots only. A keeper meets a dragon at its slot's **stand
spot**: in front of its snout (58 px for an adult), kept inside the room. A dragon going for a need **reserves** the
room's lowest free slot of its size and walks there; after its job it **lingers** in that slot (there is no home room)
until it leaves for another need. If the room is full, it moves on a lingerer (one with nowhere to be, no act and no
keeper coming: the lowest id), who walks to the nearest free slot elsewhere; a Rush may also move on a holder whose
keeper has not started work (the lowest in the queue). A dragon standing in a room that meets another of its jobs in
the same tier as its most pressing one takes that job first, and saves the walk. The new game starts with one dragon
per need room's first slot, the three love dragons filling the Grooming Parlour. Between jobs a keeper waits in their own
room at a spot clear of every slot's body, whatever the stage in it (the middle of the Hearth Kitchen, the Romp Room
and the Lamp Dorm; the Grooming Parlour's between its second and third slots), so a keeper at rest is never hidden
behind a dragon; the supplies are still taken at the hearth, the ball box and the tub. The room names hang on the
walls, drawn behind the dragons and keepers, so a name never covers a face.

**Neighbours** (later; all from traits the rig already has): slinkwing's shriek and lonely call carry one room over,
and dusk's `hush` calms the rooms around it; the hearth warms its neighbours; spike's wary latch (5.4) already
measures crowding, so spike wants a roomy room.

---

## 4. Needs and jobs

**4.1 Needs.** Every dragon has five: **food, sleep, play, bath, love**, each 0 to 1, draining over play time.
- Its element's own need (section 1) drains **twice as fast**: fire food, lightning play, water bath, dusk sleep, and
  love for spike, rock and slinkwing.
- **Fire has no bath need**: it hates baths.
- Stage scales every drain: baby 1.25, young 1.1, adult 1, elder 0.8.

**4.2 Bubbles and moods.** Below **0.5** a need opens a job and the dragon shows a white bubble; below **0.25** the
bubble turns yellow; below **0.1** red, with a "!". A dragon shows one bubble, its most pressing job's, with a green
check once a keeper has taken it. The worst need sets the dragon's **mood** (0.8 when every need is at 0.6 or more,
down to -1 when one is empty), and the rig draws it: the cue is the mood gauge (D7). An unmet play need charges
lightning's static (its crackle, then the zap: 3.5); a hungry dragon begs.

**4.3 The queue.** Every open job is in one queue, in this order:
1. rushed jobs;
2. then by tier (red, yellow, white);
3. then the dragon's own need first;
4. then the lower need;
5. then the longer wait;
6. then the older job (so the order never flickers, and the simulation stays deterministic).

**4.4 Keepers.** The humans on care duty; they are assigned automatically.
- **Taking a job.** A free keeper takes the highest job in the queue. Among jobs that are close in priority, a keeper
  prefers their **specialty** (the cook feeds, the groomer grooms, the handler plays and bathes) and the nearer dragon.
- **When.** A keeper goes to a job once its dragon is going for it, to a slot in the need's own room, and is there or
  nearly there (300 px of route left, so they meet about when it arrives), or the job is rushed.
- **Doing it.** The keeper fetches the **supply** from the room's post (a bowl at the hearth, a ball from the box by
  the Romp Room's wheel, a bucket filled at the Bathhouse's tub), walks to the slot's stand spot and, if the dragon
  is not there yet, **waits** for it (watching it come). The job starts the moment the dragon stands in its slot,
  facing its way; the keeper does it while the dragon plays the anim for it:
  - food: `eat`, with the bowl the keeper set down;
  - love: `pet`;
  - play and bath: `happy`;
  - sleep: `sleep`, or dusk's `tuckin`. The keeper leaves once the dragon is down, and it sleeps on.
- **After.** The need refills while the job runs. The keeper takes the next job, or goes back to their station.

**4.5 Rush.** Tap a bubble (or its chip in the queue) and that job jumps to the top. The nearest keeper runs to it, at
1.6 times their pace:
- a free keeper, if there is one;
- otherwise the keeper on the lowest job, which goes back into the queue.

It costs nothing but the job it bumps.

**4.6 Rooms don't heal; keepers do.** A need rises only through a keeper's act, in that need's room (#7): the dragon
walks there, and the keeper meets it. A room no longer restores the need it meets (the regeneration of the first slices
is gone), and a job no longer closes by itself: every job opened is either done by a keeper or still open. A keeper
waiting at a stand spot gives the job back after 2 minutes if the dragon never comes (it never happens in the checked
run).

**4.7 Capacity.** A queue that keeps growing means too few keepers or the wrong rooms: hire, or build. Riders away on
a mission are not keeping, which is the price of sending a team (5.6).

**4.8 On screen.**
- **Bubbles** over the dragons.
- **The job strip** along the bottom: the top five jobs in order, numbered, each chip in its tier's colour with a
  check or an hourglass. Tapping a chip pans to that dragon and rushes the job.
- **Panning:** drag the barn.

**4.9 First numbers** (tuning, not law):

| | |
|---|---|
| Base drain | full to 0.5 in 7 minutes of play; a dragon's own need in 3.5 (`HALF_LIFE_S` 420; it was 6 and 3 until S3, see below) |
| Keeper pace | 1 px a frame walking, 0.8 climbing, 1.6 times either when rushed |
| Dragon pace | its walk anim's own: each frame's `move` at the anim's speed 1, 0.28 to 0.54 px a frame for adults (spike 0.28 and slinkwing 0.32 with their pauses, rock 0.30, dusk 0.40, fire and water 0.45, lightning 0.54); no hurrying, even under Rush |
| Fetching a supply | 40 frames |
| A job at the dragon | food 200 frames, love 160, play 200, bath 200; sleep: 90 of tuck-in, then 15 s asleep while it refills |
| A keeper sets off (`LEAD_PX`) | when the dragon has 300 px of route left, or is there, or the job is rushed |
| A keeper waits at the stand spot (`WAIT_MAX`) | at most 7200 frames (2 min), then gives the job back |
| The lift (`LIFT_SPEED`) | 1.5 px a frame (the plan's third lever; it started at 1) |
| The bay closes (`BAY_CLOSE`) | after a departure is blocked 240 frames (4 s) |
| A call is overdue (`OVERDUE`) | after 3600 frames (1 min): it is served before the car's own floor's |

The two changes from the first numbers were measured (`npm run sim`, 30 minutes on the starting base, section 8.1).
With the dragons walking and one car between the floors, the car is the barn's bottleneck: about 0.9 rides per job,
each keeping the car about 13 s (half of it the rider's 152 px walk in, then the ride, then waiting for the bay to
clear), so the car is busy 95 % of the time. Served strictly oldest call first, the car made empty trips: jobs waited
131 s on average, and needs ran empty on five of six seeds. Serving a caller on the car's own floor first (with a
one-minute overdue rule, so nobody waits on for ever) brought that to 81 to 97 s with no need empty; then the plan's
third and fourth levers, a faster car (1.5) and slower drains (`HALF_LIFE_S` 420), to 55 to 74 s (seeds 1 to 6). Its
first two levers were tried and did not help: `LEAD_PX` 450 only kept keepers standing longer, and `QUEUE` 0.55 opened
more jobs and let needs empty.

---

## 5. Missions

![The mission table: pick the pairs, counter the challenges, see the odds](base/mission_table.png)

- **5.1 The board.** The Map Room's table keeps 3 or 4 missions. Each has a region, a length (2 to 10
  minutes of play), 2 to 4 challenges and its rewards.
- **5.2 The team.** 1 to 3 **pairs**, each a rider and a dragon. You pick the dragons; each takes a rider
  automatically (B7):
  - its partner, if free;
  - else a free rider whose skill counters a challenge nobody covers yet;
  - else any free rider.

  Babies stay home; the young go only on the easy missions; elders go as guides (steadier, never weaker: D21).
- **5.3 Challenges and counters.**
  - **Dragons** counter terrain by element: the dark by dusk, heavy loads and rockfalls by rock, the cold by fire,
    storms by lightning, floods and deep water by water, thorns by spike, caves and lost things by slinkwing.
  - **Riders** counter people problems by skill: a grumpy miller by Charm, a hurt animal by Medic, fog by Navigator,
    and more as missions need them.
- **5.4 The odds.** 20 %, plus 15 % for each countered challenge, plus 5 % for each pair in a good mood and 5 % for
  each pair that are partners (tuning). Shown live while you pick; the empty slot hints at what's missing.
- **5.5 The outcome** is rolled when the team is sent (seeded, like everything in the simulation):
  - success: the full reward;
  - failure: half the reward and a tired team.

  Nobody is hurt.
- **5.6 Rewards.** Coin, feed and materials; **eggs**, which come from the regions, so exploring is how new elements
  arrive; curios that decorate rooms and give them a bonus; blueprints; recruits. The team comes home hungry and
  tired (its needs drain on the road: 6), so a mission always ends in a burst of bubbles in the barn.

---

## 6. Watching a mission

![The mission scene: dusk's lamp lights the tunnel, the team waits out the flood, the result](base/mission_scene.png)

- **The scene is the timer.** From the table, the team walks out into a side-scrolling scene that lasts exactly as
  long as the mission.
- **The trip is a road with the challenges as stops.**
  - **Covered:** at a covered stop, whoever counters it has their moment. Dusk's lamp flares and lights the tunnel,
    the rock hauls the cart, the rider talks the miller round.
  - **Uncovered:** an uncovered stop is where the tension sits, and the team struggles (they wait out the flood). On a
    successful mission they get through, late; on a failed one, this is where they turn back.
- **What you see.** The team's food and sleep drain on screen. A banner names each challenge and who met it. The end
  is a result card.
- **Leaving.** "Back to barn" leaves the scene without stopping it, and a "team out" chip in the barn's HUD returns to
  it.
- **Built from data, not animated per mission.** A region is:
  - a backdrop in parallax layers;
  - a few set pieces (a tunnel, a ford, a mill);
  - one reusable *beat* per challenge type.

  The dragons walk their own walk, each played at the speed that keeps the team together without a skating paw (a
  walk's `move` is its world speed: 4.1). New work: a human walk cycle (the engine rig has none authored here) and the
  beat library.
- **The dark** follows section 1: in the tunnel only the lamp's pool of light is open, stepped in flat rings (no
  gradients).

---

## 7. Time

- **One clock.** One simulation clock, fixed 60 Hz steps, running only while the game is open (B6). Care, missions,
  hatching and growing up all read it.
- **Saves.** The world saves as it goes and when it closes; closing pauses it.
- **Seeded.** Every random choice (a mission's roll, a starting need, a keeper's tie-break) goes through the engine's
  seeded RNG (`src/lib/engine/rng.ts`). That keeps a run reproducible and keeps the gallery's frozen-time screenshot
  contract (`t=`) true for the base too.

---

## 8. Build order

1. **Needs and jobs.** Built. Run `npm run dev` and open `index.html` (this is the game's default page; `?view=base`
   still names it, for the gallery's other debug views): drag to look around, and tap a bubble, a job chip or a
   dragon to Rush it. Each dragon walks to its need's room, riding the Dragon Lift between floors, and a keeper meets
   it there (#7). The four keepers are the named cast of `docs/KEEPERS.md`, each in the anim closest to its job
   while this slice's own simulation walks it and picks what it's doing (KEEPERS.md's status has the join). The page
   takes `seed=`, `cam=x,y` (where the camera starts, world px), `preset=ages` (a code-built start with every stage:
   the base's first twelve-dragon cast) and `save=0` (a live page that never loads or saves; a preset page never
   does either); `t=` freezes it as in every gallery view. The gallery's own keys (the arrows, Space, E, the digits)
   do nothing here, and its arrows step over the base, so a debug view reached with them can still be left.

   ![The built slice, 49 s in, in the start frame: RIPPLE rides the Dragon Lift up to the Romp Room, where Pip waits at its slot's stand spot with a ball; ZAP waits at the ground floor's east landing for the car up to the Lamp Dorm, and WICK at the hayloft's for the car down to the Romp Room; COBBLE walks into the Bathhouse to its slot (Tomas fills the bucket at the tub, out of frame); ECHO walks past BRAMBLE in the Grooming Parlour on its way down to the Bathhouse; Bea waits in the Hearth Kitchen; the job strip](base/base_live.png)

   | File | What it is |
   |---|---|
   | `src/game/pet.ts` | the pet code, moved out of `src/gallery.ts` unchanged (the gallery renders pixel for pixel as before), and the paper turn the base's dragons turn with |
   | `src/game/needs.ts` | the five needs, the drains, the tiers, mood and lightning's charge |
   | `src/game/layout.ts` | the grid; the rooms, each with its purpose (#11), and their dragon slots and stand spots; the Dragon Lift and the Aerie; the keepers' net (the ladders) and a dragon net per stage (the lift); routes between any two spots on a net; the name plates' places |
   | `src/game/surfaces.ts` | every floor anyone stands on (`FLOORS`: straw), each gated by `tools/palette-check.ts`, and the bare and lift-shaft walls |
   | `src/game/start.ts` | the starting base: the rooms of section 3, seven newly adult dragons (one per element, 0 days into adulthood), each in a slot of its own need's room, and the four named keepers |
   | `src/game/presets.ts` | code-built starts for views that need what a new game hasn't got (`ages`: every stage) |
   | `src/game/sim.ts` | the care simulation: the queue, the keepers' trips and jobs (fetch, go, wait at the stand spot, work), and Rush; no drawing, seeded, deterministic; dragons with stable ids, a clock, and its options (seed, day length, start time) |
   | `src/game/travel.ts` | the dragons on the move: each chooses its need's room and takes a slot there (moving a lingerer on, or bumping a holder for a Rush), walks and turns, queues at a landing, and rides the Dragon Lift; the lift's car and its calls; the bay rule |
   | `src/game/gait.ts` | each element's walk at each stage as a table of per-frame root motion, the pace the simulation walks a dragon at |
   | `src/game/save.ts` | the save format: the whole world as JSON, every reference an id, loaded back exactly (`CareSim.fromSave`); the digest two runs compare |
   | `src/game/rand.ts` | stateless draws (`rngAt(seed, tag, ...keys)`): no RNG state is ever kept or saved |
   | `src/game/building.ts`, `people.ts`, `icons.ts` | the greybox building (its rooms, the lift's shaft, car and headframe, the ladder bay, the Aerie's deck and gantry), the keepers on the named cast's rig (`docs/KEEPERS.md`), their walks played at their pace, the bubbles and chips |
   | `src/game/base.ts` | the live view: the simulation driving the dragons (where they stand, their walks, turns and rides) and their anims, the lift's car, the camera, the HUD and the input |
   | `tools/sim-check.ts` | `npm run sim`, in `npm run check`: every route on the keepers' and the dragons' nets, 30 minutes of play with its invariants (the bay rule among them), determinism, Rush (and a slot bump), the start cast, saves (a loaded world steps on exactly as its original, mid-ride too), `rngAt`, the rooms (a purpose each, one room per need, every named room used over the check unless planned), and the gait (the walks' tables, a scripted walk as far as the anim carries it) |

   Measured by `npm run sim` on the starting base (its seven dragons and four keepers): over 30 minutes of play, 149
   jobs opened and 143 were done, every one by a keeper (none closed on its own). A keeper started on a job 73.5 s after
   it opened on average (330.3 s at most), most of it the dragon's own walk and its wait for the lift; no need ever
   emptied. Keepers who reached the stand spot first waited 7.1 s on average for the dragon, and none gave up. The
   dragons walked 95 304 px and rode the lift 129 times (a wait at a landing of 76.4 s at most, and a rider held in the
   car at most 19.5 s while the bay cleared); dragons were held at the bay's edge at most 11.8 s and keepers 12.9 s;
   44 lingerers were moved on. Every dragon had its needs met in four rooms or more (EMBER, which has no bath need, in
   four; the rest in five), and the rooms were used 54 (Hearth Kitchen), 50 (Bathhouse), 60 (Romp Room), 33 (Grooming
   Parlour), 28 (Lamp Dorm) and 129 (the lift) times. (With the dragons in their slots and the rooms restoring their
   needs, S2's building gave 149 opened, 146 done, 14.5 s and 41.0 s; its checks wanted 30 s and 120 s, and this
   slice's are 90 s and 400 s: 4.9 says why.) Not in this slice:
   - the seven span more than one screen, so the start camera shows some of them and a drag shows the rest; they
     no longer stay put;
   - nothing uses the Hatchery, the riders' rooms or the Aerie yet (section 3's table says which slice does), so no
     dragon rides the lift to the Aerie yet;
   - the base is the fixed starting one (or a preset), and nothing is stored yet: the save format exists and is
     checked, but nothing writes it to the browser;
   - no building of rooms (the rooms are section 3's fixed set), and no missions.
2. **Rooms you build:** place, merge and upgrade rooms; move dragons between them; save and load.
3. **Missions:** the table, then the scene.
4. **The rest of the world:** people's own lives (the bunks), eggs and hatching, day and night, the neighbour
   effects, the blueprint zoom-out.

## 9. Open questions

- ~~Should a dragon ever take itself to a room (a tired dragon to the Lamp Dorm), or only ever be moved by the
  player?~~ Resolved (S3, #7): every dragon takes itself to its needs' rooms, and a keeper meets it there (2, 3, 4.4).
- Day and night: dusk is the early sleeper and slinkwing the night owl (3.7, 3.8). A night shift of keepers?
- Is any care kept as a player action, the grow-up (240 f, "look at me") above all?
- The wall gate's exact rule, once the room palette exists.
