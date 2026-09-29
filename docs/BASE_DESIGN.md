# Dragon Care: The Base (design v1)

**What this covers.** The layer the pet game grows into: a **barn** where the dragons live, **towers** where their
human teammates live, **managed care** (dragons have needs, keepers meet them), and **missions** the teams go out on
and that you can watch. It sits on top of the art in `docs/ART_BIBLE.md`, and every rule there still holds: where
this document leans on one, it names the section.

**Where it came from.** A design conversation with the user, with greybox mockups at the game's true scale (the
dragons in them are the real rigs, the people the engine's humanoid rig; everything else is placeholder blocks,
`docs/base/`). The references were Fallout Shelter (the cutaway, rooms that merge), Two Point Museum (expeditions,
rooms that earn their keep) and World of Warcraft's mission table (pick a team, counter the challenges, see the forecast).

**Status.** Built, as the game's default page (`view=base`), in the building of sections 2 and 3: the need rooms,
repeated on the barn's floors, the Dragon Lift, the Aerie and the elder garden; dragons walking to their needs and
keepers meeting them (4), the clock, day and night, the speed and the barn kept in the browser (7), growing up, eggs and
hatching and the barn's cap (7, 4.7), taking a keeper by hand (4.10), missions -- the Map Room's table, the team, the
trip from the Aerie, the watchable scene the game follows the team through (5, 6), the encounters on the road -- each
stop an obstacle the dragons' abilities overcome or a big baddie worn out of puff in a bout like the Arena's, the
player picking or the trail coach (11) -- and training bouts in the Arena on the roof, where two dragons spar, gain
XP, level up and learn skills (10). Section 8 says what each part is and how it is checked; section 9 what is still
open.

**Issues #5 to #11: what implements each.**
- **#5 Missions:** the Map Room's table (5.1: the world map -- a little island of places to visit, each mission met at
  one, the regions under cloud revealed by success -- the chooser with its climate picture), the team and its riders
  (5.2), challenges met by elements and rider skills, shown up front and played on the road (5.3, 11), the trail
  coach's forecast and the outcome decided at the road's end (5.4, 5.5), coin and eggs brought home to the Hatchery
  (5.6), big baddies worn out of puff and calmed, outwitted or driven off (5.3, 11.4; a baddie's road is on the board
  every fourth day from day 3: 5.1), sent from the Aerie (the muster, the sky bridge, the landing), and the watchable
  scene (6) -- `missions.ts`, `trip.ts`, `encounter.ts`, `regions.ts`, `worldmap.ts`, `maptable.ts`, `missionview.ts`,
  `encounterui.ts` and the mission art kit;
  `npm run sim` sections 17 to 24, 26 and 28.
- **#6 Take a keeper:** a tap, a badge or Tab takes one; WASD or the arrows walk and climb; E or Space picks up,
  serves and puts back; Esc, LET GO or a tap on empty space lets go; a touch pad (4.10) -- `control.ts`; section 25.
- **#7 Dragons move by needs:** every dragon walks to a room meeting its open need, on its own floor first, riding the
  Dragon Lift between floors, and a keeper meets it there (2, 3, 4) -- `travel.ts`, `sim.ts`; sections 2, 4, 9, 10.
- **#8 Growing up, day and night, speed:** a stage is 30 game days (growing up and hatching: 7), the sky, lights and
  walls turn with the clock (never a dragon), the speed button and pause, and the barn saved in the browser (7) --
  `clock.ts`, `life.ts`, `sky.ts`, `storage.ts`; sections 11 to 14.
- **#9 Young adults:** a new game starts with seven dragons, one per element, each on the first day of the adult stage
  (the Decisions) -- `start.ts`; section 5.
- **#10 The elder garden:** elders retire 30 days into the stage through the Garden Gate to a garden that grows a plot
  for each, where they nap, sit and stroll with few needs -- all but the barn's last flier, which stays until another
  dragon can fly a mission (3, The Garden) -- `garden.ts`, `gardenArt.ts`, `life.ts`; sections 15 and 16.
- **#11 Rooms with a purpose:** every named, furnished room has one, each copy of a need's room included, and every one
  is proven used; the rest of the building is bare (3) -- `layout.ts` `ROOM_INFO`; section 8.
- **Training in the Arena** (asked after the issues: "Similar to Pokémon we should be able to train dragons with one
  another a they will gain skills and level up. These fights should happen in an arena"): the Arena, a deck on the roof
  east of the Dragon Lift's head, where two of the barn's dragons spar turn by turn -- the player picks its dragon's
  moves, the partner's coach picks its own -- by a ring of the seven elements, each strong against one and weak against
  one; both come home with XP, levels (LV 1 to 10) and, at some levels, a new skill, every skill one of the dragon's own
  anims; a spar, never a fight: a move costs the other puff, and whoever is out of puff naps (10, B8, B9) --
  `training.ts`, `arena.ts`, `arenaui.ts`; section 27.
- **Following the team** (asked after the Arena: "When we go on adventures I want to shift the game to require you to
  follow the group. This is currently optional but I want the game mode to switch to a follow mode"): watching a
  mission is no longer optional. From SEND until the team is home the game follows it -- the barn with the camera held
  on the Aerie as the team gathers and sets out over the sky bridge, then its road, with no way back to the barn until
  its result card (the world waiting on it) is tapped away -- and the barn runs itself meanwhile: nobody held by hand,
  no Rush, no Arena; the map still opens (6, B5) -- `base.ts` (`followStage`, `keepFollowing`), `maptable.ts` (the
  follow line); `npm run smoke`'s follow cases.

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
| B2 | **Care is managerial by default; you may take any one keeper by hand** (4.10). Dragons have needs that drain over time; keepers (the humans) walk over and meet them. The player's one per-dragon action is **Rush**; a keeper taken by hand is walked by the player and does the chores the player picks (#6). (Not while the game follows a team on a mission: the barn runs itself then, 6.) | Tapping every dragon every few minutes is a chore, not a game (the user's words: "that doesn't sound very fun"). The hands-on care of the art bible (spike's chin, dusk's tuck-in) becomes what keepers *do*, animated. |
| B3 | **Needs show as thought bubbles** over the dragons and as a **prioritised job queue** along the bottom of the screen. | The bubble says *which* dragon wants *what* at a glance; the queue says *what's next*. |
| B4 | **Missions are picked at a table and played on the road.** A mission table in the style of World of Warcraft: pick a team, the dragons' elements and the riders' skills counter the mission's challenges, a forecast, a reward. The challenges are shown up front, with who at home meets each (the chooser: 5). (Amended: "when you encounter a challenge you need to use special abilities from your dragons to overcome them ... when we encounter enemies we need to fight them" -- the road is played, stop by stop (11): at each obstacle you pick each dragon's ability, and a hard road's big baddie is worn out of puff in a bout like the Arena's; the trail coach picks for a team you leave to it (AUTO, or a pick that waits too long), so a team is still set and forget if you want it so. The forecast is the coach's own dry run of the road (5.4), not a roll.) | Set and forget was simple at the first stage, by the user's choice; a road with nothing to do on it was "lackluster ... not interactive" (the user's words), so the stops became the play. What lost: a mission's success chance as a number you buy with counters -- the counters now win the stops. |
| B5 | **Missions are watchable:** an animated side-scrolling scene of the team completing it. **The scene is the trip.** (Built and confirmed, 6: the scene is a pure function of the trip's state and the world's clock; the trip walks its road in the world's own steps and halts at each stop for its encounter, so the scene shows the road exactly as far as it is walked and the stop exactly as it is played, and its result card shows when the team lands.) (Amended: "On a mission you never turn back; the pass fail happens at the end" -- every team walks its whole road, and only the result card, at the road's end, tells a success from a failure: 5.5, 6.) (Amended for 11: the scene is also where the road is played -- the team's plates, the stop's plate and the ability menu sit in the sky over the road, and the world waits for your pick while the scene is open, as the Arena's bout does.) (Amended: "When we go on adventures I want to shift the game to require you to follow the group. This is currently optional but I want the game mode to switch to a follow mode" -- from SEND until the team is home the game follows it, and the barn runs itself: 6, Following the team.) | The user wants to see the team at work; the side-view walk the rig already has makes it cheap. A timer the scene merely ran to would have had nothing to do at a stop; the trip's own steps let a stop take as long as its turns take. |
| B6 | **Everything runs only while the game is open.** One clock drives care, missions and hatching; closing the game pauses the world. | No coming back to a barn of red bubbles; no offline catch-up to build. Missions therefore last minutes of play, not hours. |
| B7 | **Humans are assigned automatically:** keepers to jobs, riders to the dragons you send (each pair's rider is filled in for you, and you may swap it: 5.2) -- unless you take one (4.10): the keeper you hold is left out of every automatic pick, riders included, until you let go. | Fewer clicks; the player's choices are *which dragons* and *what to build*. |
| B8 | **Cozy:** no combat, and nobody is hurt. Missions have hazards, and some end in a big baddie that is outwitted, calmed or driven off, never hurt or killed. Old age is never decline (D21); retiring to the garden is the elder's reward, a place and never a farewell (3, The Garden). The Arena's bouts are sparring, never fighting (B9), and a big baddie is met the same way (11.4). | The game's face set has no angry face (D18) and the elder is a reward. (Amended for #5: "Some of the missions might end with a big baddie" -- a baddie, but a cozy one. Amended for the Arena: "These fights should happen in an arena" -- a bout is a spar: a move costs the other puff, its breath, never its health, and whoever is out of puff lies down for a nap; no hurt pose, no knockback, nothing flung, the one a move lands on only looks surprised, and both come home with XP: 10. Amended for the road: "we need to fight them" -- the baddie is worn out of puff by the Arena's own rules, turn by turn, and out of puff it takes its cozy exit: the Mole King dozes off, the Storm Roc wanders off outwitted, the Frost Giant shuffles off; a team out of puff sits down for a breather and the baddie leaves anyway; an obstacle's bite costs puff too, never health; the harm-word check of sim-check 27 reads every line of the road as well: 11.) |
| B9 | **Training is sparring in the Arena** (10): two of the barn's dragons spar turn by turn on the roof, each move one of the dragon's own anims, the seven elements round a ring (each strong against one, weak against one); both gain XP, a level brings stats and some levels a new skill (LV 1 to 10). One bout at a time. The player picks its own dragon's moves (the world waits for the pick) or lets its coach pick (AUTO); the partner's coach always picks. | The user's request ("Similar to Pokémon ... train dragons with one another ... gain skills and level up"): a Pokémon battle's turns, types and levels, kept cozy (B8). The skills are anims the rig already has (ART_BIBLE 4.2, section 3), so nothing new is drawn but the Arena itself. What lost: a level weighs only in the Arena for now (9). |

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
  mid-light and low in saturation (they separate from the ink, and from the dark bodies by value); gate (w) in
  `tools/palette-check.ts` holds every wall, and everything else a dragon is seen against, to that (7): lighter than
  every dark body, never darker.
- **Darkness hides the dark dragons.** Dusk's body sits at luminance 0.08 and slinkwing's at 0.05: a night sky or a
  mine swallows them whole. Dark places show the team **only inside a pool of light** (the mission tunnel, lit by
  dusk's lamp), and night outdoors stays mid-value (the blue hour of the mission mockup). The dragons are never tinted
  to fake night: every palette gate is measured on their own colours. The walls may shift with the hour (7: the
  moonlit night colours, each gated like a day wall), the dragons and the floors never.
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
  under the gambrel roof. A barn room is 1 to 3 modules wide; rooms merge like Fallout Shelter's. The barn as built has
  one-module rooms only: a need's rooms repeat on the floors, so the herd's needs are met on its own floors (3, 4.7).
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
  are human-sized, on the ground and upper floors: dragons don't fit, which is the reason for the split -- except the
  **Garden Gate's arch**: the right tower's ground floor is the Garden Gate (3), an 84 px arch in both its walls (the
  towers' other doors are 70) with a straw floor straight through, the dragons' way out to the garden.
- **Windows.** The ladder bay has a window each side of its ladder on every floor, and each bare hayloft module has
  one: panes cut out of the back wall, so the sky shows through them (7: by day the day's, at night the night's; the
  ground floor's look out on the far hills). The towers have a window slit a floor in their outer walls, lit at dusk
  and night. A named room has none: its wall and its props are its identity (#11). Every wall, sky colour and big prop
  a dragon is seen against is a `src/game/surfaces.ts` backdrop, held by gate (w) (7).
- **The Aerie** is walkable **floor 5** (feet at y 136): one straw deck from x 8 to 648, over the left tower's top,
  then a gantry over the barn roof (x 168 to 488: a railing along its back, two trestles down to the roof and a knee
  brace to the tower), then the lift's head. The left tower's ladder climbs on to it. Teams will leave and land here (5).
  **The Arena** goes on east from the lift's head on the same floor, x 648 to 1184 over the roof's east slope: a straw
  deck on two trestles and a knee brace to the right tower, railing posts, a flag pole at each end with its corner's
  pennant (blue the west, red the east) and bunting between them; two dragons spar here (10). Dragons alone go there,
  by the lift.
- **Every floor is pale.** Every surface a dragon or a keeper stands on (a room's band, the landings, the ladder bay,
  the towers' boards, the lift car's deck, the Aerie deck, the Garden Gate's floor, the garden's path) is a `FLOORS`
  colour in `src/game/surfaces.ts`, and `tools/palette-check.ts` gates every entry before anything stands on it: gate
  (i) against every dragon colour at every stage, gate (Ki) against the keepers' shoes and trousers, and HSV saturation
  under 0.20. There are two: straw `#e0d6b8` (L 0.674, S 0.18), and the elder garden's path, a pale gravel `#dcd6c0`
  (L 0.671, S 0.13: no green underfoot).

| Measure (px, at scale 1) | Value | Why |
|---|---|---|
| Barn module | 160 wide | one adult, or two babies, with room to turn (2.4) |
| Floor pitch | 112: 88 of wall, a 14 px straw band, a 10 px slab | 96 px of headroom over the feet; the tallest adult is 70, and a spread wing reaches about 20 over the shoulders (5.4) |
| Dragon Lift | module 2 (160 wide), a 152 px car deck | the longest elder is 137 px |
| Ladder bay | 64 wide | a keeper's ladder, and straw across it |
| Tower | 112 wide, 96 inside | a human is 72 to 76 tall and about 30 wide |
| Aerie | floor 5: x 8 to 648, feet at y 136 | one deck over the left tower, the roof and the lift's head |
| Arena | floor 5: x 648 to 1184; the corners' snouts 40 px apart about x 916 | two dragons facing each other with room for every move they make (10.1) |
| World | the building 1360 x 760, ground at y 712; the walkable ground runs on east through the garden, 1688 wide with its first two plots and 176 more a plot (2568 with seven) | about 2 x 2 screens, then the garden; the player pans |

**Moving around.** Keepers walk a floor and climb the three ladders: up each tower (the left one on to the Aerie) and
the centre ladder bay's through the barn; the towers and the barn meet on the ground and upper floors only. Dragons
have ways of their own, a net per stage: the barn's floors kept half a body's length from the walls (30, 56, 72 and 76
px, baby to elder: the measured extents), the hayloft between modules 1 and 5 only (clear of the low roof slopes), the
Aerie deck, and the lift between them; never a tower, but the ground floor goes on through the Garden Gate's arches to
the garden's end (3): an elder retiring walks out that way, and the residents stroll there. Keepers walk out to the
garden's end on the ground floor too. The nets are rebuilt as the garden grows (only ever east, so a route under way
stays a route).

**A dragon with an open need walks to that need's room** (#7), riding the Dragon Lift between floors, and a keeper
meets it there (section 3's slots, 4.4). It walks by its walk anim's own root motion, frame by frame (`src/game/gait.ts`:
the body moves exactly as far each step as the anim's planted paws slide, so nothing skates; spike's creep and
slinkwing's pointer pause stand still for whole frames), and a reversal is a paper turn in place (6 steps, the facing
flipped halfway: the yard's). Among its jobs in the same tier it takes one met on its own floor before one a ride away.
A need's rooms repeat on the floors (3), so it goes to one on its own floor whenever its floor has one -- the ground and
upper floors have all five, the hayloft food, love and sleep -- and rides the lift only for the hayloft's missing play
and bath, a Rush (which may take it to any floor's room), a full floor that has none of its size, a need fallen to its
yellow bubble with no room of its floor to be had (it then takes a slot free a floor away: `STAY_TIER`, 4.9 -- a baby
with a job is never moved on, so babies each resting in the room another needs would otherwise wait for ever), or the
garden.

**The lively step** (the barn capacity work, 4.7). Stepping on to the lift's car and off it until clear of the bay, and wherever its body
is in the lift bay or steps into it (a dragon crossing the bay on its own floor: need rooms lie on both sides of it), a
dragon walks at twice its pace: its walk played at 2x and its body moved by exactly the same factor, each step twice the
frame's own `move` (`src/game/travel.ts` `LIVELY`, `pace`; the view plays the walk at the dragon's `gaitS`), so the
planted paws stay planted. The walk visibly quickens as its snout crosses the bay's edge and eases as its tail clears
it: stepping lively onto the lift. It is the one exception to a dragon's never hurrying (4.9); keepers never walk
lively, and Rush does not change a dragon's pace. It pays for the bay's crossings: without it, twelve dragons ran a need
empty on 2 of 8 seeds (4.7).

**Waiting for the car.** A dragon going up or down waits at its side's landing, facing the bay, its snout just short
of the bay's edge. The ones waiting there, and the ones held at the bay's edge (the bay rule, below), stand in a
**line**: each at the place nearest the bay where its body covers no dragon's eye (ART_BIBLE 1.4) -- not the eye of a
dragon in a slot beside the landing (or of one coming to that slot), of one standing there, or of one ahead of it in
the line, whose rump its head is over (nose to tail: the mean of their half-bodies and 16 px apart, 88 px for two
adults). Each one waiting is drawn over the ones ahead of it and over the dragons in the slots; where no such place is
left (the room beside the landing full), it may stand drawn *behind* the dragons about it instead, where none of their
bodies covers its eye. A dragon on its way to the line may have to walk back to its place (an evictee leaving the slot
beside the landing that its evicter is coming to), but never back through another on its way there: two walking up at
one spot are placed in the order they stand (each placed in turn from the bay, the nearest may get the best place clear
of every eye behind the other's, and the two would pass each other, swap and turn back every few steps); one already
waiting only ever steps up, and keeps its place (and its turn for the car) if it changes where it is going but still
rides from there. A slot beside a landing is not taken
while a dragon waits over it, and a dragon lingering in one (3) while others wait at that landing, or are on their way
to it, moves over to a free slot of its own room clear of the landing. Walking up to the bay (within 250 px of its
edge, to cross it or to call the car there), a dragon keeps a step behind one walking up ahead of it the same way, so
two never arrive on one spot -- one whose walk ends at a slot short of the bay is not held so, nor holds another; and a
crosser held at the bay's edge stops short of the places of anyone waiting ahead of it there, its snout clear of their
eyes.

What is left, and why. A dragon walking past one waiting (an alighter walking off toward the landing it came to, or a
crosser through a line) covers it for the moment it takes to pass. And a landing, or a bay's edge, has room for only
so many dragons with every eye clear: when more wait there than it has room for, one stands over another's eye, and
the car takes that one first (below). With the need rooms repeated (3) few dragons wait for the car at all -- the
start's seven ride it 1 to 4 times in 30 minutes -- so what is left is mostly two dragons held at the bay's edge on one
floor, one standing over the other while they wait to cross. The model the check counts with is the worst case (the
longest body and the widest eye of every element, and any body over the eye's x, tail tip included): 3.7 s over three
30-minute runs of the start (seeds 1 to 3, 1.5 s at most; it was 4.2 s and 2.5 s with one room per need), and
with twelve dragons, the barn's cap (4.7), 31.6 s in 30 minutes on average over seeds 1 to 8, 15.3 s at most (it was
273.6 s and 117.5 s in the one-room-per-need barn) (4.7, 8.1). Drawn, most of it is a tail or a flank over the other's
head, and it ends when the bay opens.

**The car.** It takes the waiting dragons one at a time, in this order: a rushed dragon's call first; then one caught
standing over another's eye, or under another's body (a landing crowded past its room), so that ends; then an elder
on its way to the garden (3, The Garden) that has waited a minute or more; then the one going for the most pressing
need (a retiree's, its lower garden need's); then any call waiting a minute or more; then, while its last rider walks off, a
caller who can walk in behind it; then a caller on the floor the car is at; then the front of a landing's line; then
the oldest call. It comes for its rider, who walks in to the car's middle once no other dragon is in the bay, turns
to face the side it will walk off, rides, and walks off -- stepping lively on and off (above); the car is its rider's
until it has walked clear of the bay (`src/game/travel.ts`). A caller on the far side may follow the last rider in
while it walks off, nose to tail, its body 8 px behind that one's; a rider turns in the car only once the one walking
off is clear of its turn. With the need rooms repeated the car is nearly idle: the start's seven ride it 1 to 4 times in
30 minutes (it was about 110, the car 95 % busy), twelve dragons about 42 times (the car 29 % busy); its riders are
the hayloft's play and bath, Rushes, a full floor's overflow, elders leaving for the garden, and the missions' teams.

**The bay rule.** The lift bay (x 488 to 648) is also the way across each barn floor, so one rule keeps a moving car
clear of everyone and the shaft never showing one dragon over another (the code cites its parts as R1 to R5):
- (R1) nobody (a keeper, or a dragon other than the car's rider) steps into the bay while the car moves past their floor,
  but waits at its edge (a keeper at x 478 or 658, a dragon in that side's line); nor, once a rider is walking in,
  on a floor its ride will pass, so the car finds the way clear when it goes;
- (R2) the car sets off only when nobody stands in the bay on any floor from where it is to where it goes; (R3) a
  departure blocked for 4 s closes the bay to newcomers until the car goes; (R4) anyone already in the bay walks on
  out, never stopping there (a keeper held by hand and let stand in it walks on the way they face);
- (R5, the shaft holds one dragon) while the car stands at a floor for its rider there (about to board, walking in,
  aboard, walking off), no other dragon steps into the bay there -- but a dragon held at the bay's edge 40 s in all
  goes before the next rider boards;
- (R5, the lane) a dragon steps into the bay only if everyone in it walks its way (it follows them, nose to tail, its body 8 px
  behind the one ahead -- and behind one ahead stepping in with it, so two let go from the bay's edge at once go in one
  after the other), never into one coming the other way or standing there; a crosser that has stepped through a line
  toward the bay has the right of way, paused behind one ahead of it too: the car does not set off past its floor, no
  rider boards there (a rider still waiting to board waits for it, rather than holding it at the edge), and nobody
  steps in from the other side until it has crossed; it waits at the bay's edge only while the car moves past its
  floor, a rider is at work in the bay there, or one comes the other way;
- a dragon held at the bay's edge 40 s in all crosses next on its floor: nobody steps in the other way before it (the
  one waiting longer goes first), and it may step into a bay that is only closing (the car still standing, held by
  someone else), the car waiting for it too;
- a dragon near the bay does not start a turn that would swing its body into a bay the car is using, or over one in
  it; it waits at the edge;
- (the barn capacity work, 4.7: every one needed for no two bodies ever in the shaft at once with twelve dragons crossing) a dragon about
  to step into the bay waits behind one of its own way held at the bay's edge ahead of it, held too, and follows it in;
  within 250 px of the bay, walking toward it, a dragon does not start a walk under one of its own way walking over it
  (that one passes first); **the shaft guard**: no dragon but the car's rider steps to where its body, in the bay,
  would lie over another's there (one standing in the bay, or the rider standing in the car at its floor), unless the
  two already lie over each other -- it stands that step instead; and a dragon walking up to the bay walks on through
  one of its own way standing under it out of the bay, that one's walk ended (the shaft guard then keeps that one out
  of the bay until the other's body is clear of it; without this a baby standing under an adult held behind a slow
  crosser deadlocked with it).

---

## 3. Rooms

**Every named room has a purpose** (#11: "Rooms should only be named and have special furniture if the room has a
real purpose"): a dragon need, met there by a keeper, or a human or other action. **Each room meets one need, and a
need's rooms repeat** (#7: "Each room should be where a need is fulfilled - which need to be done by a trainer"): a
dragon with an open need walks to a room that meets it -- one on its own floor, if its floor has one -- and a keeper
meets it there; nothing else raises a need. (The Decisions' "each need is met in its own room" is read as one room
*kind* per need: the barn capacity work repeated the rooms so the barn serves the herd eggs and missions grow it to,
4.7.) A place with no purpose is not a room: it is left bare (an empty wall, no props, no name). The code holds each
purpose (`src/game/layout.ts` `ROOM_INFO`, `STRUCTURES`), and `tools/sim-check.ts` proves every named room is used:
every mechanic that uses one counts it (`sim.stats.used`, by kind, and `stats.usedRoom`, room by room), and over the
whole check each kind and **each room itself** must show a use: every named, furnished room -- each copy of a need's
room, the Tack Room, the Bunks and the Map Room too -- is proven used.

**The barn's rooms** (`src/game/start.ts`, one module each; a room's id is its place in this order: the ground floor's
0-4, the Hatchery 5, the upper floor's 6-10, the hayloft's 11-13):

| Floor | Module 0 | Module 1 | Module 2 | Modules 3 to 5 (past the ladder bay) |
|---|---|---|---|---|
| Hayloft (2) | Hatchery (5), under the roof's west slope | Hearth Kitchen (11) | Dragon Lift | Grooming Parlour (12), Lamp Dorm (13), bare (under the east slope) |
| Upper floor (1) | Hearth Kitchen (6) | Romp Room (7) | Dragon Lift | Grooming Parlour (8), Bathhouse (9), Lamp Dorm (10) |
| Ground floor (0) | Hearth Kitchen (0) | Grooming Parlour (1) | Dragon Lift | Bathhouse (2), Romp Room (3), Lamp Dorm (4) |

Three kitchens, three parlours, three dorms, two bathhouses and two romp rooms: 13 grown dragons' module slots (one room
per need had 11), and the Hatchery's two baby sub-slots. The ground and upper floors have all five needs' rooms, the hayloft
food, love and sleep (under its low slopes there is room only for babies, and the west one is the Hatchery's).

| Room | Purpose | Where | Proof of use (counted over `npm run sim`: section 8) |
|---|---|---|---|
| Hearth Kitchen | meets **food**: a keeper feeds the dragon here, with the bowl taken at the hearth | module 0 of the ground and upper floors, module 1 of the hayloft | food met there, bowls picked up |
| Grooming Parlour | meets **love**, the busiest need (the own need of spike, rock and slinkwing): a keeper grooms and pets the dragon here | one a floor | love met there |
| Bathhouse | meets **bath**: a keeper washes the dragon here, with the bucket filled at the tub | the ground and upper floors | baths met there, buckets filled |
| Romp Room | meets **play**: a keeper plays with the dragon here, with a ball from the box by the wheel | the ground and upper floors | play met there, balls taken |
| Lamp Dorm | meets **sleep**: a keeper tucks the dragon in here | one a floor | sleep met there |
| Hatchery | eggs lie in its three nests and hatch into babies | the hayloft's west corner, under the roof's slope | eggs laid and hatched there (7), a mission's egg carried up to it by its rider (5) |
| Dragon Lift | carries dragons between the barn's floors and up to the Aerie | module 2, floor to roof | dragons ride it (a ride completed) |
| Tack Room | riders take their saddles here before a mission and hang them back after | left tower, ground floor | each rider takes a saddle down at the muster and hangs it back after landing (each counted) |
| Bunks | riders rest here after a mission | left tower, floor 2 | each rider rests here after landing (a rest counted; a job may call them from it) |
| Map Room | the mission table: the world map and the mission chooser | left tower, floor 4 | missions are chosen and sent from its table (a send counted) |
| Aerie | teams gather here, leave and land | the roof (floor 5) | the team musters on the deck, walks off west over the sky bridge, and lands on it (each counted) |
| Arena | two dragons spar here in a training bout, and both gain XP and level up (10) | the roof (floor 5), east of the lift's head | a bout's two stand facing each other in their corners (counted) |
| Garden Gate | the dragons' way out to the garden: an arch in both walls, the one tower door a dragon fits | right tower, ground floor | elders walk out through it, keepers out to the residents and back (a pass counted each way) |
| Garden | the retired elders' home: they move here 30 days into the elder stage, and it grows a plot for each | outside, east | residents arrive, and their needs are met there |

**Bare:** the hayloft's module 5 (under the east slope); the left tower's floors 1 and 3; the right tower's floors 1 to
4. **Dropped:** the Nursery, the Feed Store, the Hay Store and the Attic (nothing used them); the Sun Loft and the Song
Roost (love is met in the Grooming Parlours); the Mess Hall, the Library, the Workshop, the Infirmary and the Lookout (no
mechanic); and two of the three Bunks.

**Each copy earns its name.** Over the check every room is used (`npm run sim` section 8 prints them room by room: 8.1).
The hayloft's rooms are the overflow the herd grows into: in 30 minutes (seeds 1 to 3) the start's seven have 0 to 3
needs met in each of the hayloft's Grooming Parlour and Lamp Dorm and use its kitchen 2 to 4 times (a meal met there, or
a bowl taken), twelve dragons 9 to 14 in each and 25 to 30 at the kitchen; each room of the ground and upper floors is
used 8 to 60 times.

**Slots.** A dragon room's dragons stand in fixed slots. A room is one module (160 px): one slot at its middle for a
grown dragon, facing the room's post (the hearth, the tub, the ball box; in a Grooming Parlour or a Lamp Dorm, its
keepers' side), and two baby sub-slots 40 px in from its sides (facing +1 and -1). A module holds either one grown
dragon or up to two babies. The Hatchery has two baby sub-slots only, 60 and 120 px in from the barn's west wall, both
facing into the barn, tails to the slope (no grown dragon fits there). A keeper meets a dragon at its slot's **stand
spot**: in front of its snout (58 px for an adult), kept inside the room. A dragon going for a need **reserves** a
free slot of its size in a room that meets it -- among that need's rooms on its own floor if the floor has one (every
floor's for a Rush, and a slot free a floor away once the need has fallen to its yellow bubble with none of its floor's
to be had: `STAY_TIER`), the cheapest by its walk there (a ride counted 600 px more, a room with no slot free for it
200 px more: `travel.ts` `roomsFor`) -- and walks there; after its job it **lingers** in that slot (there is no home
room) until it leaves for another need. If the room is full, it moves on a lingerer (one with nowhere to be, no act and
no keeper coming, never a baby with a job open: the lowest id), who goes to a free slot on its own floor in a room
meeting its own lowest need (most likely its next job, then met where it stands), else to the nearest such slot on any
floor, else to the nearest free slot -- never the Hatchery's; a Rush may also move on a holder whose keeper has not
started work (the lowest in the queue). A slot beside a lift landing is not free while a dragon waiting there stands
over it, and a lingerer in one moves over to a free slot of its own room while dragons wait at that landing (2). A
dragon standing in a room that meets another of its jobs in the same tier as its most pressing one takes that job
first, and saves the walk. The new game starts with one dragon in each of seven rooms' module slots: EMBER in the
ground floor's Hearth Kitchen (facing its hearth), BRAMBLE in its Grooming Parlour, RIPPLE in its Bathhouse and WICK in
its Lamp Dorm; ZAP in the upper floor's Romp Room and COBBLE in its Grooming Parlour; ECHO in the hayloft's Grooming
Parlour. **The keepers have fixed stations** (4.7): Bea the ground floor's Hearth Kitchen, Tomas the upper floor's
Grooming Parlour, Pip its Romp Room, Iris the hayloft's Lamp Dorm. Between jobs each waits at a spot clear of the body
of any grown dragon in any slot on their floor (past the module slot's snout, or in a kitchen 16 px in from its west
wall); a baby resting in a sub-slot there may reach 13 px into a waiting keeper with its tail, never its head (a
one-module room has no spot clear of both its sub-slots, and keepers are drawn behind dragons). A keeper fetches a
supply from whichever hearth, ball box or tub makes the job's trip -- to it, then on to the dragon -- shortest. The room
names hang on the walls, drawn behind the dragons and keepers, so a name never covers a face.

**The Garden** (#10; `src/game/garden.ts`, `gardenArt.ts`). Outside, east of the right tower, through the Garden Gate:
the retired elders' home -- the elder's reward, **a place, not a stage** (B8, ART_BIBLE D21). Nothing in it reads as
decline: no graves, no wilting or autumn plants, no farewell or sunset, no sleepy lid on an awake resident; the trees
are in leaf with apples on them, and the elders are the same elders, drawn as before.
- **Where, and how big.** A row of plots, 176 px each, from the tower's outer wall (x 1304) east: one for each resident
  (or elder on its way there), never fewer than two, so the garden is there from day 1 with two empty plots waiting.
  The walkable world ends at the garden's end, 1304 + 176 a plot + 32 (1688 at the start, 2568 with seven residents);
  the ground floor's nets run out to it, and a picket fence stands 40 px in from it, moving out as the garden grows.
  Its floor is a pale gravel path (2); its green is the hedge and the lawn behind the path and the grass strip below
  it, never underfoot. Each plot has a straw nest mound, a lantern (lit at dusk and night: two stepped rings on the
  hedge, following its scalloped top, never on the path) and flowers on stalks in the lawn (a round 4 x 4 blossom on
  a 2 px stalk: no mark under 2 px); every other plot an apple tree; plot 0 a bench and the GARDEN sign.
- **Retiring.** 30 game days into its elder stage (counted from the step it grew into an elder, however late that
  stage-up was: 7), an elder retires as soon as it
  may be sent somewhere new -- not being met, not in the lift's hands or its bay -- wherever it is (it keeps its size,
  so unlike a stage-up it need not stand settled): its jobs are dropped (a keeper coming for one goes home), its slot
  is let go, and it walks, riding the lift down if it must, through the Garden Gate to the middle of the lowest free
  plot. There it is a resident, and a toast says so: "ASH MOVED TO THE GARDEN". **The last flier stays:** an elder
  retires only while another dragon that could go on a mission (any but a baby: the young go on the easy roads) is
  left outside the garden -- eggs come only from missions, so a barn with nobody left to fly one would stay empty for
  good. The last one stays on in the barn past its time ("WICK STAYS IN THE BARN: NOBODY ELSE CAN FLY A MISSION", once;
  its card reads `ELDER - THE LAST FLIER`) and retires as soon as another dragon can fly (`life.ts` `lastFlier`; the
  seven starters all fall due together, so six walk out and one stays). A retiree asks for nothing on its
  way, so no need of its can raise its call for the lift as a barn dragon's does: once its call has waited a minute
  it goes before the barn's (4.9 `OVERDUE`), so it waits at a landing no longer than a barn dragon may (at most 124 s;
  measured 73.7 s in the busy barn and 72.7 s in a crowded one of ten, where it waited 161.9 s before that rule) and
  its walk out takes 218 s at most (the longest in a run: 139 to 218 s; `npm run sim` section 15).
- **What residents do.** They **nap** (1800 to 3600 steps: 30 to 60 s of play at 1x, 4 to 8 game hours of the real
  day), **sit** (600 to 1200 steps: 10 to 20 s, about 1.3 to 2.7 game hours: the elder's idle and its variants), and
  from a sit **stroll** (six times in ten) to a resting place among their own plot and the two beside it, walked by
  their own walk like any dragon, or nap again. At night they only nap: a sit ends at nightfall, a nap that ends at
  night starts another, and no stroll starts that would not end before 20:00 -- the one thing in the simulation that
  reads the day's phase (7). Every resident's resting place, and every plot's middle waiting for a newcomer, are kept
  apart: clear of each other's eyes (ART_BIBLE 1.4), and roomy, no two bodies overlapping more than 20 px
  (`REST_OVERLAP`: a tail's tip behind another's, never one lying across another -- eye-clear alone let two lie back to
  back, up to 95 px of their bodies one over the other, in 43 % of a full garden's steps); a stroll goes only to such a
  place, else it naps; passing another on the way is a moment's overlap, as in the barn. Measured over 30 minutes
  (`npm run sim` section 16): asleep 73 to 74 % of their steps, every night step, each strolled 9 to 12 times, and two
  at rest overlapped 10.7 px at most; in a full seven-plot garden (the `retire` preset, seeds 1 and 2, 35 minutes of
  the real day) they still stroll 3 to 25 times each, 31 to 100 px at the median, and overlap 12.7 px at most.
- **Few needs** (4.1): food and love only, at a quarter of an elder's drain; sleep, play and bath are held full. A
  resident asks for a keeper about four times an hour of play, where a barn dragon asks about 36.
- **Keepers come to them: the one exception to "each need is met in its own room".** The garden is the residents'
  room. When a job opens, the resident wakes (or stops sitting; one strolling walks on to its resting place first) and
  waits where it is; a keeper fetches the bowl from the hearth as usual (4.4), walks out through the gate, and meets it
  at its snout, inside the garden. After the job it sits (or naps, at night).

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
- **A garden resident** (3, The Garden) has only **food and love**, draining at a quarter of an elder's rate (0.25 x
  0.8 of the base, its own need still twice the rest); sleep, play and bath are held full, and it asks for nothing
  else. An elder's food then falls from full to 0.5 in about 37 minutes of play (fire's, its own, in about 19), and so
  does its love (spike's, rock's and slinkwing's own: 19). An elder on its way to the garden already drains as one,
  and asks for nothing until it is there.

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
- **When.** A keeper goes to a job once its dragon is going for it, to a slot in the need's own room, and is there,
  or past its lift ride and nearly there (300 px of route left, so they meet about when it arrives) -- or, for a
  rushed job, anywhere past its lift ride (the keeper runs, so still meets it). No keeper stands at the stand spot
  while the dragon queues for the car: however near the room, a dragon still to ride may wait minutes for it when the
  barn is crowded (4.7), and the keeper takes another job meanwhile.
- **Doing it.** The keeper fetches the **supply** from a room's post (a bowl at a hearth, a ball from the box by a
  Romp Room's wheel, a bucket filled at a Bathhouse's tub: whichever makes the trip -- to it, then on to the dragon --
  shortest, since a need's rooms repeat, 3), walks to the slot's stand spot and, if the dragon is not there yet,
  **waits** for it (watching it come). The job starts the moment the dragon stands in its slot,
  facing its way; the keeper does it while the dragon plays the anim for it:
  - food: `eat`, with the bowl the keeper set down;
  - love: `pet`;
  - play and bath: `happy`;
  - sleep: `sleep`, or dusk's `tuckin`. The keeper leaves once the dragon is down, and it sleeps on.
- **After.** The need refills while the job runs. The keeper takes the next job, or goes back to their station (a
  fixed room: 3).

**4.5 Rush.** Tap a bubble (or its chip in the queue) and that job jumps to the top. Its dragon sets off for it at
once (taking a slot in the room from its lowest holder if the room is full, section 3) and its call for the lift goes
first. As soon as the dragon is near (4.4's "When"), the nearest keeper runs to it, at 1.6 times their pace:
- a free keeper, if there is one;
- otherwise the keeper on the lowest job, which goes back into the queue.

It costs nothing but the job it bumps. Rushed again and again (one every 30 s for 30 minutes), no need empties and a
rushed job is done within 43 s (8.1); with one room per need, where the one car's queue was what a Rush reordered, a
dragon not rushed could wait long enough for a need to touch empty.

**4.6 Rooms don't heal; keepers do.** A need rises only through a keeper's act, in that need's room (#7): the dragon
walks there, and the keeper meets it. A room does not restore the need it meets (the pet game's
regeneration is gone), and a job no longer closes by itself: every job opened is either done by a keeper or still open. A keeper
waiting at a stand spot gives the job back after 2 minutes if the dragon never comes (it never happens in the checked
run).

**4.7 Capacity.** A queue that keeps growing means too few keepers or the wrong rooms: hire, or build. Riders away on
a mission are not keeping, which is the price of sending a team (5.6).

**The barn serves the herd the game grows.** Eggs (7) and missions (5) grow the barn past the start's seven.
With one room per need the Dragon Lift was its limit: one car, one rider, one dragon at a time in its
shaft, each ride holding it about 15 s while its rider walked on and off at its own pace, never idle and still behind
-- seven grown dragons were served (75.6 s on average, the car 95 % busy), nine or more ran needs empty on most seeds,
and twelve on every one (345.1 s). Now each room meets one need and **a need's rooms repeat on the floors** (3), so a
dragon's needs are met on the floor it stands on and the car carries few; and dragons **step lively** on and off the car
and across its bay (2), which pays for the crossings that are left (every floor has need rooms on both sides of the
lift). Measured by `npm run capacity` (`tools/capacity.ts`: 30 minutes of the real day on seeds 1 to 8, every run
checked as `npm run sim` section 2 checks its own; a herd is **served** when no need empties on 7 of the 8 seeds or
more, jobs wait 90 s or less on average from opening to their keeper starting, and nothing stalls):

| Cast | Dragons | Seeds with a need empty | Wait avg s | Wait max s | Jobs done | Rides | Car busy | Landing max s | Bay edge max s | Keepers busy | Eye covered s (longest) | Stalls, invariant breaks |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| the start (7a) | 7 | 0/8 | 23.4 | 112.3 | 152.9 | 1.5 | 1 % | 16.6 | 17.5 | 26 % | 1.1 (2.8) | 0, 0 |
| eight (8a) | 8 | 0/8 | 24.2 | 113.3 | 171.4 | 2.0 | 1 % | 16.6 | 17.5 | 30 % | 2.5 (3.9) | 0, 0 |
| ten (7a3b) | 10 | 0/8 | 37.3 | 240.3 | 220.6 | 11.3 | 8 % | 36.4 | 29.4 | 46 % | 8.7 (14.7) | 0, 0 |
| 11a | 11 | 0/8 | 27.2 | 155.6 | 235.9 | 24.6 | 15 % | 39.6 | 30.4 | 41 % | 4.2 (5.1) | 0, 0 |
| 12a | 12 | 0/8 | 32.1 | 215.6 | 254.6 | 41.5 | 26 % | 35.9 | 34.1 | 46 % | 14.3 (18.8) | 0, 0 |
| 7a5b | 12 | 0/8 | 47.6 | 253.7 | 264.9 | 38.3 | 32 % | 93.9 | 45.9 | 59 % | 23.7 (11.7) | 1 (seed 6: a convoy stand behind a baby), 0 |
| **twelve (7a3y2b)** | **12** | **0/8** | **41.7** | 285.4 | 262.0 | 45.1 | 33 % | 78.2 | 44.9 | 53 % | 31.6 (15.3) | 0, 0 |
| 4a8b | 12 | 0/8 | 51.4 | 291.6 | 268.8 | 28.0 | 26 % | 97.0 | 48.4 | 67 % | 20.7 (12.1) | 1 (seed 8: a baby behind a baby), 0 |
| 2a10b | 12 | 0/8 | 47.5 | 251.6 | 282.8 | 16.5 | 16 % | 68.6 | 59.0 | 72 % | 16.0 (10.3) | 0, 0 |
| 0a12b | 12 | 1/8 (690 need-steps) | 49.3 | 234.3 | 293.0 | 8.6 | 10 % | 66.1 | 46.4 | 77 % | 17.7 (21.2) | 0, 0 |
| thirteen (7a3y3b) | 13 | 0/8 | 44.8 | 272.4 | 284.5 | 58.4 | 42 % | 101.6 | 44.4 | 59 % | 23.6 (9.8) | 0, 0 |
| 13a | 13 | 0/8 | 33.7 | 198.1 | 273.6 | 62.1 | 39 % | 73.0 | 41.6 | 50 % | 18.2 (23.3) | 0, 0 |
| 7a4y2b | 13 | 0/8 | 44.7 | 323.9 | 281.4 | 66.3 | 46 % | 61.7 | 42.2 | 57 % | 28.2 (16.3) | 0, 0 |
| 8a3y2b | 13 | 0/8 | 42.6 | 350.5 | 281.0 | 60.5 | 41 % | 61.6 | 40.6 | 57 % | 27.5 (10.8) | 0, 0 |
| 7a2y4b | 13 | 0/8 | 48.2 | 278.2 | 284.9 | 60.0 | 47 % | 95.8 | 44.0 | 63 % | 24.7 (24.0) | 0, 0 |
| fifteen (7a4y4b) | 15 | 8/8 (15.5 M) | 63.7 | 1398.4 | 195.1 | 20.5 | 11 % | 33.8 | 35.0 | 33 % | 7.0 (8.3) | 0, 0 |

(`a` adults, the start's seven among them -- fewer than seven are the first of them: a late game's barn, its
hatchlings in place of the retired; `y` young; `b` babies. *Wait* is a job's open-to-start wait, the mean of the seeds'
averages and the longest on any seed; *Eye covered* the check's worst-case model, seconds of an eye under a standing
body in 30 minutes, the mean, and the longest one moment; *Stalls* a keeper standing still 10 s on the way somewhere,
a dragon mid-walk getting no more than 4 px on in 10 s -- stood still, or turned about on one spot -- the car standing
with work a minute, a keeper giving up; the rest as `npm run capacity` prints it. Over seeds 1 to 32 the twelve wait
39.9 s and are served on every seed, with no stall; 7a5b over seeds 1 to 32 has a need touch empty on 2 (a lightning
adult's play 25 s on seed 12 while crawling babies crossed the bay the other way; a baby's under a second on seed 32)
and 3 convoy stands behind a crawling baby.)

Re-measured on the whole game (with the missions, taking a keeper and the watchable scene: nothing sent, nobody
held, so the barn's own care runs as it did alone), `npm run capacity -- --casts=start7,twelve --seeds=1-8`:

| Cast | Dragons | Seeds with a need empty | Empty need-steps | Wait avg s | Wait max s | Jobs done | Rides | Car busy | Landing max s | Bay edge max s | Keepers busy | Eye covered s (longest) | Stalls | Open at end (oldest s) | ms/step |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| start7 (7a) | 7 | 0/8 | 0 | 23.4 | 112.3 | 152.9 | 1.5 | 1 % | 16.6 | 17.5 | 26 % | 1.1 (2.8) | 0 | 1.5 (30.6) | 0.011 |
| twelve (7a3y2b) | 12 | 0/8 | 0 | 41.7 | 285.4 | 262.0 | 45.1 | 33 % | 78.2 | 44.9 | 53 % | 31.6 (15.3) | 0 | 5.9 (91.8) | 0.035 |

Both SERVED (no need empty on 8 of 8 seeds, 23.4 s and 41.7 s against the 90 s bound, no stall), every run the same as
the barn built alone, to the tenth (the ms per step aside); the wall time 19.2 s in three worker threads.

- **The start** waits 23.4 s where it waited 75.6 s, and rides the car 1.5 times in 30 minutes where it rode 107; the
  car is nearly idle until the herd passes ten, and a third busy at twelve.
- **The cap: `BARN_CAP` 12** (`src/game/life.ts`, with `barnCount` and `barnFull`). Every 11- and 12-dragon mix measured
  is served -- the start's seven with young and babies, twelve adults, and the late game's barns of babies (0a12b, its
  babies packed near the Hatchery, and a barn of twelve babies packed from the ground floor up, served in `npm run sim`
  section 10) -- twelve on every seed of 32. Thirteen is served for the mixes measured, and fourteen fails (the study:
  7a5y2b and 13a1b on every seed): the barn's 13 grown modules are the cliff -- a baby needs a whole module free of
  grown dragons -- so fifteen, which now fits the barn, starves. 12 is the largest herd every mix measured is served
  at, one dragon short of that cliff. The barn counts every dragon not living in the garden: those away on a mission
  (their places are kept -- measured in the study, a team's riders away, 10 dragons at home with two keepers are
  served and 12 sit at the edge, and a returning team would push the barn to the cliff) and an elder still walking out
  to the garden. **An egg never hatches while the barn holds 12** (7): it waits in its nest, and hatches the first step
  an elder's arrival in the garden frees a place. A mission still brings its egg home to a full barn: the Map Room's
  chooser says so (`BARN FULL: THE EGG WILL WAIT`, read through `life.ts` `barnRoom`, the cap less the count), the rider
  carries the egg up to its nest, and there it waits (`npm run sim` section 26 sends THE LOST NEST from the twelve at
  the cap: the team away still counted, the egg laid in its reserved nest, due and waiting, hatching the step after a
  retiree reaches the garden). The top bar shows the count against the cap (4.8).
- **A barn of babies.** A baby with a job open is never moved on, and a job waits for its own floor's
  room: as built, babies each resting in the room another wanted stood still for good -- twelve babies packed from the
  ground floor up starved (11.7 M need-steps at 0 over 4 seeds, 83 to 104 jobs done), and four babies on the upper floor
  resting crosswise froze it from the first second. A job's wait for its own floor now ends when its need falls to its
  yellow bubble (`STAY_TIER`, 4.9) with none of its floor's rooms to be had: it takes a slot free a floor away. The
  ground-floor twelve then have no need empty on 7 of 8 seeds (285 jobs done), and the four are met within 90 s.
- **Over the cap** only a preset puts more: `preset=full`, 21 dragons (the start's seven and a baby in every free
  sub-slot), is starved but keeps moving -- 39 jobs done in 10 minutes, the car never standing with work for more than
  a moment, no keeper giving up (`npm run sim` section 10) -- and its due egg waits.
- **What the check holds** (`npm run sim` section 10, seed 1, frozen with about 20 % headroom): the twelve with no need
  empty, waits of at most 48 s on average and 185 s at the longest (40.2 and 154.3 measured), 213 jobs done or more
  (266), at most 53 rides (44: the car stays mostly free), a landing and the bay's edge at most 47 s (42.1 and 39.5),
  an eye covered at most 56 s in all and 17 s at once (46.5 and 14.1), no stall and no two in the shaft; the crowds the one
  car was measured against keep service gates instead of ride counts (eight adults: 171 done, 27.7 s; ten: 78 done,
  24.7 s; the `ages` preset's twelve of every stage: 55 done, 49.3 s; none with a need empty); and a barn of babies:
  twelve packed from the ground floor up, no need empty, no stall, at least 231 jobs done (289), waits of at most 68 s
  and 385 s (56.6 and 320.9); the four resting crosswise each met, no need empty; and two walking up to one landing at
  one spot placed in the order they stand, neither turned back and forth. (The design's gates for the twelve -- 42 s
  and 171 s, 217 done, 46 rides, a landing 42 s and the bay's edge 37 s, an eye 44 s and 17 s -- were frozen on the
  capacity study's build, which rested a baby moved on in the Hatchery; babies moved on are kept out of it (7), so no
  resting baby hides an egg. This build meets the design's waits, jobs, rides and longest eye cover; its landing, bay
  edge and eye cover in all are 0.1, 2.5 and 2.5 s over the design's, so those gates are frozen on the build.)

**4.8 On screen.**
- **The top bar** (y 0 to 15, `src/game/hud.ts`), left to right:
  - the time of day, as the sky shows it (7): a sun by day, a low orange sun at dawn and dusk, the moon at night, and
    the clock, `DAY 3 14:00` (the minutes in tens; from day 100 `D100 14:00`, so the clock never runs into JOBS);
  - `JOBS n`, the open jobs (at x 90, or a space after a longer clock);
  - a badge per keeper (46 x 13, at x 138, 186, 234 and 282): a chip in the keeper's own top colour, the name, and a
    dot while at a job, a small blue arrow while away on a mission (from the muster to the landing), a small z while
    resting in the Bunks after one -- or, held by hand (4.10), the badge lit and a small mark pointing down. A tap on a
    badge takes that keeper (the camera eases to them), or lets go of the one held; a keeper on a mission's trip can't
    be taken (a toast says why: "BEA IS AWAY ON A MISSION");
  - `COIN n` (x 334), the coin the missions have brought home (5.6);
  - `BARN 9/12` (x 392, or a space after `COIN n` from 1 000 coin): the barn's dragons -- every one not living in the
    garden, those away on a mission and an elder still walking out to the garden among them -- against its cap (4.7),
    amber when full; a preset forced over the cap shows its true count (`preset=full`: `BARN 21/12`);
  - five buttons: **ARENA** (x 486: the Arena's chooser, or the bout on: 10.5), **NEW** (x 528: tap it twice within 2 s
    for a new barn), **II** (x 558: pause), **>1X** (x 578: the speed, cycling 1x, 2x, 4x and 8x) and **MAP** (x 610:
    the Map Room's table, 5.1). A button is lit (`#6b4a34`) while it is in force: NEW asked, paused, faster than 1x,
    the table or the Arena open. A tap on the bar goes to its buttons, never to the world under it.
- **The Map Room's table** (5.1): the world map and a mission's chooser, over the world (8, 18, 624 x 318) and under
  the top bar; the world waits while it is open. **The TEAM OUT chip** (394, 19, 114 x 15; first drawn at x 520, where it
  covered a plate at the start camera: at 394 it sits over the lift shaft's and the ladder bay's tops), while a team is out: MUSTER, TEAM OUT - 14H (game hours to go), then LANDING while a team dragon is still coming onto the deck, EGG TO THE NEST while its rider carries the egg down, and HOME until the saddles are hung up -- lit while the game follows the team (6), and the team's status only: a tap on it goes nowhere.
  **The follow line** (on an ink strip with the team's flag, right-aligned at x 632 on the bottom row, y 338, 16 tall),
  while the game follows a team (6): `FOLLOWING THE TEAM: THEY GATHER ON THE AERIE`, `...: THEY SET OUT OVER THE SKY
  BRIDGE`, then on its road `FOLLOWING THE TEAM - HOME IN 14H`, and landed `- HOME!`; over the barn it takes the job
  strip's and the hint's place. Over the watch overlay (6)
  a TRIP LOG button (8, 338, 64 x 16) opens the trip's log (8, 34, 300 x 120: each stop met,
  unmet or still ahead -- each stop told only once the scene has shown how it went, at its banner's
  moment (missionview.ts `stopShownAt`: the scene is the timer), so the log never tells a stop early, and never the
  outcome at all -- the log's latest lines, the time left), drawn over the result card, and a tap on it (or TRIP LOG again) closes it.
  A toast shown while the table is open goes low in its panel, and one too long to clear the chip goes under it.
- **The Arena** (10.5): its chooser over the world and under the top bar (the world waits while it is open, as under
  the table), and a bout watched over the world with the camera on the Arena (the world steps on, but waits while the
  player's pick does). **The bout's chip** (274, 19, 114 x 15, left of the TEAM OUT chip), while a bout is on and the
  barn is on screen: BOUT: ON THE WAY, BOUT: YOUR PICK! (lit), BOUT: TURN n, then EMBER WINS or BOUT: A DRAW until the
  pair is home; a tap opens the bout.
- **Bubbles** over the dragons.
- **The job strip** along the bottom: the top five jobs in order, numbered, each chip in its tier's colour with a
  check or an hourglass. Tapping a chip pans to that dragon and rushes the job. (Not while the game follows a team out:
  the follow line takes its place, 6.)
- **A dragon's card** (160 x 76, on the far side of the screen from the dragon tapped: at 8, 20 for one in the right
  half; at 472, 38 for one in the left half, under the TEAM OUT chip -- so the card never opens over its own dragon,
  nor, for a dragon tapped in the Hatchery at the start camera, over the nests and their eggs -- unless another dragon's
  head is under that place and none under the other, where it opens instead: `hud.ts` `cardAt`): tap a dragon and its
  card opens (one with a job waiting is Rushed too, as
  ever: a dragon has a job waiting most of the time, 60 to 79 % of it in the start barn, so the card comes with the Rush
  rather than only without one): its name and element with its level (`FIRE LV 2`: 10), its stage and `DAY d OF 30` (d is the day of its stage, 7), the
  stage's 30 days as a bar, and its needs, each an icon over a bar. A tap on a bubble or a chip Rushes only. A tap on
  the card, or anywhere else in the world, closes it (the top bar's buttons leave it open, so the game can be paused
  to read it).
- **The hint** on an ink strip at the bottom right, beside the job strip, five in turn, 4 s each: `TAP A BUBBLE: RUSH
  TAP A KEEPER: TAKE`; `TAP MAP: SEND A TEAM TO THE LOST NEST` (until the first mission is sent; then `... ON A
  MISSION`, and none while a team is out); `TAP ARENA: TWO DRAGONS SPAR AND LEVEL UP` (none while a bout is on); `DRAG
  TO LOOK AROUND THE BARN`; `TAKE A KEEPER: WASD TO WALK, E TO ACT`. It
  gives way when the strip reaches it, while a keeper is held (the pad is there then: 4.10), and while the game follows
  a team out (the follow line is there then: 6).
- **Toasts**, centred under the top bar for 3 s: "SURE? TAP AGAIN", "A NEW BARN", "NEW BARN: THE OLD SAVE DIDN'T FIT",
  "THE BARN IS FULL" (an egg fell due with the barn at its cap: 7), a grow-up ("EMBER IS AN ELDER NOW!"), a mission
  sent ("THE LOST NEST: THE TEAM MUSTERS ON THE AERIE") or landed ("THE LOST NEST: HOME SAFE WITH 40 COIN AND AN EGG",
  or "... BACK HOME WITH 20 COIN. NOBODY IS HURT.") and the dawn's tip at 05:00 ("3 DRAGONS GROW UP TOMORROW": the
  soonest of the dragons whose stage-up falls due within two game days, by the day it falls on: TODAY, TOMORROW or IN 2
  DAYS), an elder staying on as the barn's last flier (3, The Garden), the Arena's (10.5: a bout's pair heading up
  or why not, who won and the XP, a level and its new skill), and while the game follows a team out, its answer to a tap
  in the barn, a badge, Tab, b or ARENA, or Esc on the road: "FOLLOWING THE TEAM: THE KEEPERS MIND THE BARN TILL THEY
  LAND" (6). Life's news (the grow-ups, the tip, the full barn, a
  bout's end and its levels) waits its turn behind the toast
  showing, never cutting it short, and grow-ups into one stage still waiting to be shown share one toast ("EMBER AND
  ZAP ARE ELDERS NOW!", "EMBER, BRAMBLE AND 2 MORE ARE ELDERS NOW!": the new game's seven all fall due at once).
- **Panning:** drag the barn (while a keeper is held, the camera follows them again 3 s after a drag; while the game
  follows a team out, no drag moves it: 6). **Keys:** 1 to
  4 pick 1x, 2x, 4x and 8x; p pauses and plays; m opens (and closes) the Map Room's table; b the Arena (10.5); with a keeper held (4.10),
  WASD or the arrows walk them (W and S climb at a ladder), E or Space does the chore in reach, Esc lets go, and Tab
  takes the next keeper (passing over any on a mission's trip). Over an overlay -- the Map
  Room's table (5.1) or the Arena's (10.5) alike -- the speed keys, m and b work as ever, Esc goes back to the barn, Tab goes back to the barn
  and takes the next keeper, and the rest do nothing (a keeper held stays held but stands still under it). While the
  game follows a team out (6) nobody is held: the speed keys and p work as ever, m opens the map at once over the team's
  view and shuts it again, Esc shuts the map, else the trip's log, else the result card (back to the barn), and b, Tab
  and Esc on the team's own view say the game is following the team.
- **Taps, in order:** a top-bar button or badge; the pad (a keeper held); the TEAM OUT chip (a team out: its status,
  which takes the tap and goes nowhere) and the bout's chip (a bout on: opens the bout, 10.5); the card (closes it); a job chip; a bubble; a
  keeper (takes them; a rider on a trip, a toast); a dragon (its card, and Rush if a job waits); the Map Room's table
  (opens the map); the Arena's deck (opens the Arena); empty space (lets go of the keeper held, closes the card). An
  open overlay -- the watch overlay, the Map Room's table or the Arena's -- takes every tap under the top bar
  before the pad or the world (the watch overlay's TRIP LOG and its result card; the table's own; anything
  else swallowed), and no drag moves the camera under it; the top bar's buttons still work, and a badge goes back to the
  barn and takes (or lets go of) that keeper. While the game follows a team out (6) a badge takes nobody, and a tap in
  the barn as the team gathers only says so -- but for the Map Room's table, which opens the map.
- **The canvas** is as big as the window allows: whole pixels from 1x up, and under 1x in a smaller window (a phone
  held upright). In an upright window, while a keeper is held, a line left of the pad says TURN SIDEWAYS FOR BIGGER
  BUTTONS.

**4.9 First numbers** (tuning, not law):

| | |
|---|---|
| Base drain | full to 0.5 in 7.5 minutes of play; a dragon's own need in 3.75 (`HALF_LIFE_S` 450; the first numbers were 6 and 3, see below) |
| Keeper pace | 1 px a frame walking, 0.8 climbing, 1.6 times either when rushed |
| Dragon pace | its walk anim's own: each frame's `move` at the anim's speed 1, 0.28 to 0.54 px a frame for adults (spike 0.28 and slinkwing 0.32 with their pauses, rock 0.30, dusk 0.40, fire and water 0.45, lightning 0.54); no hurrying, even under Rush -- but for the lively step |
| The lively step (`LIVELY`) | 2: on and off the car and wherever its body is in the lift bay or steps into it, a dragon's walk plays at 2x and its body moves by the same factor (2, the capacity study, 4.7: at 1.5 twelve dragons ran a need empty on 1 seed of 8, lively on the car alone on 3, not lively at all on 2) |
| Fetching a supply | 40 frames |
| A job at the dragon | food 200 frames, love 160, play 200, bath 200; sleep: 90 of tuck-in, then 15 s asleep while it refills |
| A keeper sets off (`LEAD_PX`) | when the dragon is there, or past its lift ride with 300 px of route left; for a rushed job, as soon as it is past its lift ride |
| A keeper waits at the stand spot (`WAIT_MAX`) | at most 7200 frames (2 min), then gives the job back |
| The lift (`LIFT_SPEED`) | 2 px a frame, a floor in 0.93 s (first 1, then 1.5, then its cap of 2) |
| The bay closes (`BAY_CLOSE`) | after a departure is blocked 240 frames (4 s) |
| A call is overdue (`OVERDUE`) | after 3600 frames (1 min): it is served before the follow-in, the car's own floor and the front of a line; an elder's on its way to the garden, before every tier too (it asks for nothing on the way, so nothing else raises its call) |
| Waiting at a landing (`LANDING_CLEAR`, `DRAGON_EYE`) | the snout 2 px short of the bay; nose to tail behind the one ahead (the mean of their half-bodies and 16 px: 88 px for adults); no body over an eye (an eye 21 to 38 px ahead of an adult's root) |
| Walking in behind the last rider (`FOLLOW_GAP`) | 8 px, body to body |
| Walking up to the bay (`APPROACH`) | within 250 px of the bay's edge, a dragon keeps `FOLLOW_GAP` behind one walking up ahead of it the same way |
| A dragon moved on picks a slot (`RIDE_PX`) | a ride counted 600 px more than its route: one on its own floor first; the same when a dragon picks among a need's rooms (`roomsFor`) |
| A need's room with no slot free (`EVICT_PX`) | counted 200 px more when a dragon picks among the need's rooms (a lingerer must be moved on first) |
| A job's wait for its own floor's room ends (`STAY_TIER`) | at tier 1 (the yellow bubble, SOON), with none of its floor's rooms to be had: it takes a slot free a floor away (so babies each resting in the room another needs never wait for ever, 4.7) |
| The barn's cap (`BARN_CAP`, `src/game/life.ts`) | 12 dragons (every one not living in the garden): no egg hatches while the barn holds that many (4.7, 7) |
| A dragon held at the bay's edge (`CROSS_MAX`) | 2400 frames (40 s) in all, and it goes before the next rider on its floor boards |

The changes from the first numbers were measured (`npm run sim`, 30 minutes on the starting base, section 8.1).
With the dragons walking and one car between the floors, the car was the bottleneck of the first barn, one room per need
(4.7: the repeated rooms took that away, below). Served strictly
oldest call first, it made empty trips: jobs waited 131 s on average, and needs ran empty on five of six seeds.
Serving a caller on the car's own floor first (with a one-minute overdue rule, so nobody waits on for ever), then a
faster car and slower drains (a longer lead, `LEAD_PX` 450, and an earlier queue, `QUEUE` 0.55, did not
help), brought that to 55 to 74 s as first built. That car let the next rider walk in through the last one walking
off, and anyone cross the bay through a rider; the shaft now shows one dragon at a time (the bay rule, 2), which costs
the car that overlap. Some of it came back: the next rider on the far side follows the last one in, nose to tail; a
landing's front is the snout's length from the bay, not half a body's; a rider's ride closes the floors it will pass
while it walks in; a dragon picks a job on its own floor first in the same tier, and one moved on takes a slot on its
own floor first. The car goes at 2 px a frame. With `HALF_LIFE_S` 420 a need still
touched empty on some seeds (one of 18 in 30 minutes; within two hours on seed 2); at 450 none did, so it is 450 -- a
step further, for the one-dragon shaft: waits of 62 to 98 s on average over
seeds 1 to 18, the longest 185 to 307 s, and no need ever empty. The rules that keep eyes clear at a crowded landing
(2: walking up behind one ahead, a held crosser stopping short, a lingerer moving over, the car taking one caught over
an eye first, a waiting dragon keeping its place), the long-held crosser going next, and keepers setting off only once
the dragon is past its ride left the average where it was and shortened the worst waits (over seeds 1 to 48: a mean
of 76.4 s against 77.2 before them, the longest 335 s against 406, a landing 119 s against 157, the bay's edge 60 s
against 102, and no need empty on any seed against one), and cut the eye covered from 26 s to about 5 s in 30
minutes. Any such change moves one seed's own numbers by a fifth either way (seed 1's average went from 66.6 s to
87.6 s, seed 4's from 85.7 s to 65.6 s), so `npm run sim` gates the waits on seeds 1 to 3 together: their mean
average wait at most 100 s (83.5 measured), the longest 360 s (301.2), a landing wait 124 s (103.4), a rider held in
the car 25 s (20.5). The first targets of 60 s, 180 s and 60 s were not reached on any of 48 seeds at this car (4.7);
the gates from the first design stay: no need empty, done >= 120, a keeper's wait at the
stand spot <= 20 s, the bay's edge <= 60 s.

**Barn capacity.** None of that moved the one car's ceiling (4.7): it served seven grown dragons, and eggs
and missions will grow the barn to 10 to 15. A capacity study measured three designs with `tools/capacity.ts` (a second
lift; a smarter single car with pairs and top-ups; the need rooms repeated on the floors) and the last was chosen,
with the lively step (2): repeating the rooms moves the barn's limit from the car to its floors -- the start's seven ride
the car 1.6 times in 30 minutes, not 107 -- and the lively step pays for the bay's crossings that are left, since every
floor has need rooms on both sides of it. Measured (`npm run capacity`, 30 minutes, seeds 1 to 8): the start's seven
wait 23.6 s on average (75.6 s in the one-room-per-need barn), and the benchmark's twelve are served with no need
empty on any seed (8 of 8 had one before, at 345.1 s). Its ablations: the lively step off, twelve NOT served
(2 of 8 seeds with a need empty, 69.3 s); at 1.5x 1 of 8 (45.6 s); lively on the car alone 3 of 8; a keeper walking
home to the nearest room of their station's kind, noise (fixed stations were kept); a keeper fetching a supply by the
whole trip, not merely the nearest post (kept: without it 41.1 s and a stall); a baby moved on resting in the
Hatchery, noise (dropped: babies moved on are kept out of the Hatchery, so no resting baby hides an egg -- measured
here it costs twelve about 3 s of average wait, 42.1 s against 39.3 s, still served on every seed); a baby with a job
open never moved on, noise (kept); a dragon moved on going to its lowest need's room on any floor before merely the
nearest slot (kept: without it 7 adults and 5 babies are NOT served, 2 of 8). `npm run sim` gates the start's three
seeds' waits at a mean of 31 s (25.3 measured) and 135 s at most (112.3), and section 10's twelve on seed 1 (4.7).
Three more rules were added, each measured over the table in 4.7: a job's wait for its own floor's room ends at
its yellow bubble (`STAY_TIER`: babies each resting in the room another needs had waited for ever); the rules for
walking up to the bay hold only a dragon walking up to it -- to cross it or to call the car there -- not one whose walk
ends at a slot short of it (an adult had stood 12 s over a baby crawling up to the bay: without the change thirteen, and
eight adults with three young and two babies, are not served, and seven adults with five babies stand five times over
seeds 9 to 32 against two); and a landing's line places two walking
up at one spot in the order they stand (they had passed each other and turned back every few steps, for minutes, or
for good in a barn of babies).

**4.10 Taking a keeper** (#6: "You should be able to choose a person - then you will control them and be able to do
this chores ... Uses standard WASD controls - and a button to feed/collect stuff"; `src/game/control.ts`). Care stays
managerial (B2): the other keepers go on taking jobs by themselves. But any one keeper can be taken by hand:
- **Take:** tap the keeper (their body), their badge in the top bar, or press Tab (the next keeper by id). Taking
  another lets go of the one held first. A keeper taken while at work (mid-meal, mid-tuck-in) finishes that job first,
  then is yours where they stand (and at once if the job goes from under them: its dragon sent on a mission, or moved
  to the garden); otherwise any job they had goes back to the queue, a climb under way is finished,
  and whatever they carry stays in their hand. (Not while the game follows a team out, 6: then nobody is taken, and a
  keeper held when a team is sent is let go.) A mark in their own colour hangs over their head, their badge is lit,
  and the camera follows them (it keeps them inside the middle of the screen across, and frames their floor: their
  feet 196 px down the screen, or as near as the world's edge lets it -- so their mark shows under the top bar and the
  floors below them stand clear of the pad; a drag stops it for 3 s).
- **Walk:** A and D (or the arrows) walk them along the floor at a keeper's pace (on the Aerie, the deck alone: the
  sky bridge west of it, off the screen, is the riders' way off the world, never the hand's); W and S at a ladder (within 8 px)
  climb it one floor. The lift bay's rule holds for them as for anyone (2): they wait at its edge while the car moves
  past their floor, and one let stand in the bay walks on the way they face until they are clear of it (at the Aerie
  deck's end, which lies in the bay, they turn back), so the car is never held by them. Keepers never ride the lift.
- **E** (or Space, or the pad's E), in this order: **pick up** a supply at its post (within 24 px: the bowl at the
  hearth, the ball at the box by the wheel, the bucket at the tub; 40 frames; carrying another swaps it); **serve** a
  dragon: only one that has **arrived at its slot in its need's room** (#7, 3: a dragon still walking there cannot be
  met, and the line says "WICK IS ON THE WAY"), or a garden resident waiting where it rests; from its stand spot (within
  24 px; the keeper steps onto the same eye-safe spot a keeper sent there uses), with the supply in hand for food,
  play and a bath; the most pressing such job first. A keeper already sent for it hands it over and goes home. The job
  is done as any keeper does it, and counts to the keeper's name; **put back** the supply carried at its own post;
  else a "?" over their head says there is nothing to do there.
- **The line under the pad** (in the hint's place, bottom right, level with the job strip; just the action when the
  strip reaches it) says who is held, what they carry and what E does: `BEA - BOWL - E: FEED WICK`, `E: TAKE
  BOWL`, `E: GROOM COBBLE`, `E: TUCK IN ECHO`, `E: BATHE RIPPLE`, `E: PLAY WITH ZAP`, `E: PUT BOWL BACK`, `WICK IS ON
  THE WAY`, `ZAP WANTS THE BALL`; and with nothing for E, at the foot or head of a ladder, `↑: CLIMB UP`, `↓: CLIMB
  DOWN` or `↑ ↓: CLIMB`. Taken or let go while paused, the badge and the line answer at once; the world takes it when
  it plays on.
- **Let go:** Esc, a tap on empty space, a tap on their badge, or the pad's LET GO. They walk home (or, at work,
  finish the job first) and are a keeper like the others again.
- **Left out of the automatic picks:** the keeper held is never given a job, never sent for a Rush and never taken off
  one for it, and is never rushed.
- **The touch pad** (only while a keeper is held): one row at the bottom right, y 305-335 -- LET GO (48 x 30), E
  (44 x 30) and the arrows ← ↑ ↓ → (30 x 30) -- in the band under the lowest floor on screen, over the job strip's row.
  A pad arrow held down walks until it is let up; E and LET GO act on a tap; a touch in the pad's gaps or just past its
  edge (6 px) goes to the nearest button, never through to the world (where it would let go). Each finger is its own:
  one can hold an arrow while another taps E, and the camera is dragged by a finger that isn't on the pad.
- **Saves:** a save never holds a keeper by hand: the one held is saved as if let go that moment (walking home, or
  finishing the job at hand), so a reload has every keeper on their own.
- The pad and the line never cover a dragon's head while the camera frames the keeper held: the lowest floor on
  screen stands with its feet at y 296-308 and its heads (12-52 px over the feet, every stage) above the pad's row,
  and the floor under that is off the screen (smoke checks every head against the pad and the line). A drag can still
  pan a floor under them, as under the job strip.

---

## 5. Missions

![The world map: the island, its places, and the day's missions pinned at them](base/world_map.png)

![The mission table as built: THE LOST NEST's chooser with BEST TEAM picked -- the climate picture, the challenges and who meets them, RIPPLE and ECHO with their riders, and the trail coach's forecast (2 of 2 stops in 2 turns, 100 % puff left)](base/mission_table.png)

- **5.1 The board** (`src/game/missions.ts`, `regions.ts`, `worldmap.ts`, `maptable.ts`). The Map Room's table (the left
  tower's floor 4: tap it, or MAP on the top bar, or M) opens the **world map**: a little painted island -- the sea round
  its coast and its islets, a lake in the middle, the brook down from the Highfold snows through the lake to the sea --
  of six regions, each its own land (Millbrook's fields, hedges and trees, Bramblewood's close wood, the Highfold peaks,
  the Old Mine Road's mesas, Frostmere's snow, pines and frozen mere, Emberfell's smoking cones and cinders), three
  explored from the start (MILLBROOK, OLD MINE ROAD, BRAMBLEWOOD) and three under cloud (HIGHFOLD, FROSTMERE,
  EMBERFELL) until a success in a neighbour clears it at the next dawn (a tap on a cloud names the neighbours whose
  success would; cleared and waiting for the dawn, it says CLEARS AT DAWN). Each region has its **places**
  (`regions.ts` Place): little landmarks where its missions are met -- Millbrook's THE MILL RACE (the mill by the
  brook), WILLOW POND and THE BROOK BRIDGE; the Old Mine Road's THE DEEP SEAM, LANTERN RUN, THE OLD CART TRACK and
  THE MOLE KING'S HALL; Bramblewood's THE THICKET, MOSSY HOLLOW and THE OWL WOOD; Highfold's THE HIGH PASS, THUNDER
  RIDGE, THE GOAT PATH and THE STORM ROC'S CRAG; Frostmere's THE ICE ROAD, THE FROZEN FALLS, SNOWBOUND and THE FROST
  GIANT'S PASS; Emberfell's THE CINDER FIELDS, THE HOT SPRINGS and ASHFALL. A mission's title is its place's name (a
  hard road ending in a big baddie leads to its lair; day 1's LOST NEST is met at WILLOW POND), and roads join the
  places: from HOME to the start regions, and between the regions' neighbours. Each mission on the board is pinned at
  its place with a plate -- its number, its title, the road's challenge icons (a baddie's crown last) and its days --
  and a tap on the plate or the landmark opens its chooser; a tap on a place with no mission today says what it is.
  While a team is out, its road from HOME is dotted in red, a flag planted at its place, and the team's own flag walks
  the road at the watchable scene's pace (`missionview.ts` roadFraction: standing through a stop, and at the place by
  the road's end whatever the outcome, which the flag, like the scene, never tells). The board is rolled at 05:00 each
  day (and at a new game's start): one mission for
  each explored region, up to three, each easy (2 challenges, 1 game day, 40 coin), normal (3, 2 days, 80 coin) or
  hard (3 and the region's big baddie from day 3, else 4; 3 days; 150 coin) -- 3, 6 or 9 minutes of play at 1x. On
  day 3 and every fourth day after (7, 11, ...), the first region on the board that has a baddie shows its hard road,
  so a big baddie is there to meet early (`missions.ts` `baddieDay`). Day 1
  always has THE LOST NEST (Millbrook, easy: a spring flood and lost things, a sure egg), which two of the seven
  starters meet (RIPPLE and ECHO). A pin opens the **mission chooser**: the region's **climate picture** (a meadow,
  caves, a forest, peaks, a frozen lake or ash hills: the mission art's, drawn without dragons) with the place's
  landmark standing in it (twice its size on the map; the place named under the title when it isn't the title), the
  rewards, each challenge with what meets it and, under GOOD, the dragons at home and the free keepers who could (a tap adds them),
  a tick once the team does; the big baddie's portrait and its two counters; the team; the trail coach's forecast
  (5.4); BEST TEAM; SEND FROM THE AERIE. The world waits while the table is open.
- **5.2 The team.** 1 or 2 **pairs**, each a dragon and its rider -- the riders are the four keepers (KEEPERS.md 2),
  and **two keepers always stay home**; one team is out at a time. You pick the dragons; each takes a rider
  automatically (B7), and a tap on the rider's badge swaps it for the next free keeper:
  - its **partner** (the keeper whose specialty is the dragon's element's own need: Bea for fire, Tomas for spike, rock
    and slinkwing, Pip for lightning, Iris for dusk; water has none), if free -- a pair of partners has 5 % more POWER
    on the road (11.5: the chooser says PARTNERS: POWER +5 %);
  - else a free rider whose skill meets a challenge nobody on the team meets yet, lowest first;
  - else any free rider.

  A keeper the player has taken by hand is never picked. Babies stay home; the young go only on the easy missions;
  elders go (steadier, never weaker: D21); garden residents stay in the garden. SEND starts the **muster**: the team's
  dragons leave what they were doing (a keeper at work finishes the job, and a sleeper wakes first; each keeps its slot
  until it sets off, so no other dragon walks into it; a rider at work leaves the job where it got to, and one tucking a
  dragon in leaves it asleep, the job done) and ride the Dragon Lift up to the Aerie, first in the
  car's calls, each to the westmost free spot on the deck (the car still carries one dragon at a time, so the muster
  takes 2186 steps in a fresh barn -- 36 s at 1x -- and longer when the car is under way or a team dragon is being met:
  sends in the middle of play measured median 2460, 90th percentile 3094 and at most 4032 steps over 360 sends -- BEST
  TEAM on the board's missions, seeds 1 to 20, sent at 18 moments of the first day -- and after landing both dragons are
  off the deck in median 2674, at most 3748 steps: a faster car is a follow-up); the riders fetch their saddles from the **Tack Room** and
  climb the left tower's ladder to stand beside them. All there, the team walks west off the deck over the **sky
  bridge** and is away: the bridge stands in for `fly`, which is not built (and rock and the young can't fly anyway).
  Away, the team is not drawn, its dragons' needs wait (and their stage-ups and retirement with them), and its riders
  are nobody's to call (nor the player's to take by hand: a toast says so); the TEAM OUT chip under the top bar says
  MUSTER, TEAM OUT and the game hours of walking to go, or LANDING. From SEND the game follows the team (6): the barn
  with the camera held on the Aerie as it gathers and sets out, then the watchable scene of its road -- where the road
  is played, stop by stop (11), and TRIP LOG opens the trip's log (each stop cleared, waited out or still ahead, each
  dragon's puff, the encounter's lines, the walk left) -- until its result card is tapped away. SEND is a command the world takes at
  its next step (control.ts, like the keys and taps a keeper held by hand obeys), so a team that can no longer go by
  then -- a rider just taken by hand -- is refused with the reason, as the chooser would have said it. It lands
  on the bridge and walks back onto the deck; each dragon then walks down to the nearest free slot of its size and its
  needs take over; the rider carrying an egg takes it down the left tower, along the upper floor and up the centre
  ladder to the Hatchery in the hayloft's west corner and lays it in its nest, and every rider hangs the saddle back in the Tack Room
  and rests in the **Bunks** (a job may still call them from there) before going back to their station.
- **5.3 Challenges and counters.** Terrain is met by a dragon's element, people by a rider's skill:

  | Challenge | Met by | | Challenge | Met by |
  |---|---|---|---|---|
  | PITCH DARK | dusk | | LOST THINGS | slinkwing |
  | HEAVY LOAD | rock | | GRUMPY MILLER | CHARM (Bea) |
  | THE COLD | fire | | HURT ANIMAL | MEDIC (Tomas) |
  | STORM | lightning | | THICK FOG | NAVIGATOR (Iris) |
  | SPRING FLOOD | water | | NARROW GAP | NIMBLE (Pip) |
  | THORNS | spike | | | |

  A **big baddie** has two counters: THE MOLE KING (Old Mine Road) dusk and CHARM, calmed; THE STORM ROC (Highfold)
  lightning and NAVIGATOR, outwitted; THE FROST GIANT (Frostmere) fire and NIMBLE, driven off. None is ever hurt (B8).
  A counter is what wins its stop when the road is played (11): at an obstacle the counter element's breath is STRONG
  (double work) and the counter skill's rider clears it outright with their special; in a fight the counter element is
  STRONG on the baddie (the Arena's x1.5) and the counter skill's special costs it a quarter of its puff and a POWER
  stage. A team without a stop's counters can still clear it -- any breath helps a land stop, a show-off charms the
  miller and the hurt animal, and two dragons' plain work wears a baddie down -- only slower, bitten meanwhile, and a
  lone dragon with neither counter can't wear a baddie out in time.
- **5.4 The forecast** (`missions.ts` `forecastOf`, `encounter.ts` `forecastRoad`). No roll: the trail coach walks
  the road for you first, in a dry run by the very rules the road is played by (11), every roll even (a move lands, its
  work and cost their middle values, the baddie grumbles its first turns and never rests), the coach picking every
  move. The chooser shows what it found -- `FORECAST: 2 OF 2 STOPS IN 2 TURNS, 100 % PUFF LEFT` and a ten-segment bar
  of the share of stops cleared -- live while you pick, and BEST TEAM ranks every team that may go by it: the most
  stops cleared, then the fewest turns, then the most puff left, then the most counters on the team, then fewer pairs,
  then the lower dragon ids. THE LOST NEST with RIPPLE and ECHO: 2 of 2 in 2 turns with all its puff; RIPPLE alone on
  the Old Mine Road's hard mission: 3 of 4, the Mole King out of reach. The forecast is a forecast: the road's own rolls
  differ (a breath goes wide, the baddie rests), so a 100 % team can take a turn longer, and a team the coach cleared 3
  of 4 with is one you might clear 4 with.
- **5.5 The outcome** is decided at the road's end, once every stop has been played (11): a success when every stop
  was cleared, a failure when any was waited out. The road is laid when the team is sent: each challenge sits at (i + 1)
  / (n + 1) of 85 % of the walk, the baddie at 90 %; the egg the trip may bring (its element: 5.6) is drawn at the send
  too (`rngAt(seed, MISSION, id)`) and comes home only on a success. **On a mission you never turn back; the pass or
  fail happens at the end.** Whatever happens at a stop, the team walks on -- each stop cleared, or waited out; the
  baddie worn out, or left to take its exit in its own time -- and every stop's line says how that stop went
  (`SPRING FLOOD - RIPPLE SWIMS THEM ACROSS`, `THE MOLE KING - THE TEAM SITS DOWN FOR A BREATHER, BUT IT CURLS UP AND
  DOZES`), never how the trip will end. The outcome is told at the road's end, on the result card (6), and nowhere
  before it: the trip's own `success` is null until the team lands.
  - success: the full coin, and the egg;
  - failure: half the coin, no egg.
  - **Day 1's LOST NEST** is the first mission: RIPPLE and ECHO, its two counters, clear both of its stops on every
    seed (sim-check 22 and 28 play it on 18), so the tutorial always brings its sure egg home.

  Nobody is hurt: the team lands tired and hungry (food and sleep at most 45 % on a success, 30 % on a failure), so a
  mission always ends in a burst of bubbles in the barn; the road's XP (11.5) it keeps either way.
- **5.6 Rewards.** Coin (on the top bar), and **eggs**, which come from the regions, so exploring is how new elements
  arrive: an egg of one of the region's elements, sure on a region's first success and otherwise 35 % (60 % on a hard
  road). The egg's element is drawn and the nest reserved when the team is sent -- the chooser says HATCHERY FULL: NO EGG when all three hold eggs
  -- and the rider carrying it down lays it there; it hatches 2 game days later, and the baby grows up (7). When the
  barn is at its cap (4.7, read through `life.ts` `barnRoom`: the cap less every dragon not living in the garden, a team
  away among them) the chooser says BARN FULL: THE EGG WILL WAIT: the egg still comes home and waits in its nest, due,
  until a dragon leaves the barn for the garden. Curios,
  blueprints, feed, materials and recruits are not built.

---

## 6. Watching a mission

![The mission scene as built, at the Mole King's fight (view=base&preset=trip&trip=oldmine:0.9&t=200): EMBER's and WICK's plates with their puff, the Mole King's with its 96, the banner, and EMBER's menu -- FIRE BREATH even on the Mole King, PREEN, YAWN, REST and BEA's CHARM, the rider's special -- with TRIP LOG and AUTO at the bottom left and the follow line at the right: the game follows the team](base/mission_scene.png)

*As built (`src/game/missionview.ts`, `encounterui.ts`) the scene reads as follows: the team walks its road, halts at each stop to play its encounter (11) -- the ability menu in the sky over the road -- meets a big baddie at a hard road's end, and comes home to the result card and the barn.*

- **The scene is the trip (B5, confirmed).** The scene is a pure function of the trip's state and the world's clock
  (`sceneAt(sim, trip)`): the road is drawn as far as the team has walked it (`walked` of `travel`: the trip's own
  counters, stepped by the simulation -- the walk is the mission's 1, 2 or 3 game days, and each stop's encounter
  takes its own steps on top), and the stop as its encounter stands. Nothing in the scene is stepped or saved, and the
  simulation never reads it, so a frozen view (`t=`) and a view opened half way along show the same road; the same
  trip state and clock give the same frame, always.
- **The trip is a road with the challenges as stops** (trip.ts: challenge i of n at (i+1)/(n+1) x 0.85 of the walk,
  the baddie at 0.9). Reaching a stop, the team halts and its **encounter** begins (11): an obstacle's meet (60
  steps: the banner names it, `SPRING FLOOD AHEAD: BEAT 22 TO GET ACROSS`), or the baddie walking in from the right
  (160 steps, grumpy); then turn by turn -- the picks (yours, or the trail coach's), then each move played through
  where the team stands, its dragon's own anim landing at its impact (dusk, fire, lightning, water and spike breathe,
  rock heaves, slinkwing calls, the show-offs, a PREEN, a YAWN; a REST sits the dragon down for a breather, `beg`), a
  rider's special its rider's own moment (a wave for CHARM, a kneel to pet for MEDIC, a hush for NAVIGATOR, a cheer
  for NIMBLE), the baddie's move its own -- and a popup rising over the head it landed on (`-9` and STRONG!, `+8`,
  DODGED!, POWER DOWN, GUARD UP; the one it landed on looks surprised, or grins at a dodge) or over the set piece
  (PASSED! or NOT QUITE, with the try's score against the mark: 11.3). Cleared, the set
  piece shows the challenge met (the water down, the miller talked round) for a beat (90 steps) and the team walks
  on; a baddie out of puff takes its exit (360 steps) and the team walks past. Waited out, the team walks on all the
  same: **the team never turns back**, and walks every stop to the road's end -- and past a land stop, through its
  **passage** (below): the cave beyond the dark's mouth, lit or not as the stop went.
- **The pace** (no skating paw, as in the barn: 2). The team walks at the slowest dragon's mean pace V. Each dragon's walk plays at
  speed s = V / its own mean (1 or less), and its body moves by D(s n), the distance its walk carries it by anim time
  s n (the frames' moves summed, the last one's in part): each step exactly s times the move of the frame it is in.
  Pair 1's dragon walks 170 px behind pair 0's; each rider 56 px ahead of their dragon's root, a step behind it in
  depth, walking at V. The camera keeps the team's middle 260 px from the left edge. The road's feet are at y 300.
- **The big baddie** (a hard mission in Old Mine Road, Highfold or Frostmere): it walks in from the right to 200 px
  ahead of the lead, grumpy, and the fight is on (11.4): its puff on its plate, its moves (the Mole King's DIRT FLING,
  GRUMBLE and SNUFFLE; the Roc's GALE FLAP, SCREECH and PREEN; the Giant's SNOW STAMP, COLD SIGH and SHAKE OFF) each a
  face and a popup, never a blow; the team's moves cost it puff. Out of puff -- or, the team out of puff or the turns
  run out, in its own time -- it takes its exit: the Mole King **calmed** (sits and dozes off, "z"s stepping up), the
  Storm Roc **outwitted** (turns and wanders off the wrong way) or the Frost Giant **driven off** (shuffles off to
  colder hills, grumbling, dust at its feet). Each exit is the art kit's own (`exitLook`): the two that leave go up the
  road ahead of the team, on until they are off the screen's right edge, never back through the team. It takes it on
  every trip, a failure's too ("THE MOLE KING - THE TEAM SITS DOWN FOR A BREATHER, BUT IT CURLS UP AND DOZES"), and
  the team walks on to the road's end. No knockback, no hurt pose, nothing flung (B8).
- **What you see** (`encounterui.ts`). A banner at the top names the stop as it is reached, then the encounter's
  latest line through it (`RIPPLE'S BUBBLE JET: 14 + 20 = 34 BEATS 22!`, `THE MOLE KING FLINGS DIRT: ECHO -9 PUFF`), then how
  the stop went (with a check mark when it was cleared), and stays up until the next stop. Through an encounter, each
  pair's **plate** at the left (the dragon's name and level, its puff bar, its rider) and the **stop's plate** at the
  right (an obstacle's mark to beat and the try it is on, its tries left as a bar; a baddie's name, its puff bar and its stages) sit in the sky over the road, and
  between them, while a pick is yours, the **ability menu**: `WHAT WILL RIPPLE DO?  (TRY 2 OF 3)` (a fight's `TURN 2`) and a row per ability
  it has here -- its Arena skills (each with its bonus to the roll and how it works this stop: `ROLL + 20` and `95 %:
  STRONG ON THE FLOOD!`, `55 %: HELPS`, `5 %: HELPS A LITTLE`, `70 %: CHARMS THE MILLER`; a fight's
  STRONG ON THE MOLE KING or EVEN), REST (+8 PUFF), and its rider's SPECIAL where the rider has the stop's counter --
  with an AUTO button beside TRIP LOG under the road: on, the menu's place says THE TRAIL COACH PICKS: TAP AUTO TO PICK
  YOURSELF. When the team lands, at the road's end, a **result card**: the pass or the fail, told here and nowhere
  before -- HOME SAFE! or NOT THIS TIME -- `3 OF 4 STOPS CLEARED`, the coin (half on a failure), the egg if one came
  home, the XP the road brought each dragon, "NOBODY IS HURT." and "TAP TO GO BACK TO THE BARN": the world waits on
  it, and a tap (or Esc) puts it away, and with it the game's following the team (below). Until then a team that will
  fail is drawn exactly as one that will succeed (`sceneAt` never reads the outcome; the trip's `success` is null till
  the landing: sim-check 24 reads six trips at every step).
- **The world waits for your pick** while a pair's pick is yours to make (the trail coach off) -- the road is on screen
  whenever the team is out (following the team, below), so a pick waits for you as the Arena's move menu does (10.5):
  the road's one choice. It steps on otherwise, the moves at the game's speed; AUTO hands the picks to the trail coach,
  and the Map Room's table opened over the road makes the world wait too. Only a world nobody watches (the checks'
  headless runs) has the coach take a pick that has waited 450 steps (7.5 s at 1x), so a road always plays out (11.6).
- **Following the team** (B5, amended: "When we go on adventures I want to shift the game to require you to follow the
  group. This is currently optional but I want the game mode to switch to a follow mode"). Watching is not optional:
  from SEND until the team is home the game follows it, and the barn runs itself -- the keepers at their jobs, the
  dragons at their needs. It is read off the world's trip (`base.ts` `followStage`), so a page loaded with a team out
  follows it too.
  - **Gathering** (the muster, and the walk off the Aerie): the barn on screen, the camera eased to the Aerie deck and
    held there (no drag moves it), the TEAM OUT chip lit, and the follow line in the job strip's and the hint's place:
    `FOLLOWING THE TEAM: THEY GATHER ON THE AERIE`, then `...: THEY SET OUT OVER THE SKY BRIDGE`.
  - **The road:** as the last of the team walks off the bridge, the scene comes on by itself -- an overlay over the barn
    (under the top bar, which stays), TRIP LOG at its bottom left (and AUTO beside it while the team stands at a stop)
    and the follow line at its right (`FOLLOWING THE TEAM - HOME IN 14H`: the game hours of walking to go) -- with no
    way back to the barn. The world keeps stepping under it at the chosen speed (the speed and pause buttons work; at a
    stop it waits for your pick, above), and its toasts (life's news, a landing, a stop's end, the dawn's tip) show over
    the scene too, low on the verge under the road. Every tap under the top bar is the overlay's.
  - **Home:** at the road's end the result card, the world waiting on it; tapped away (or put away by Esc), the game
    stops following: the barn again, the camera easing to the Aerie as the team lands on the bridge and walks back onto
    the deck, and the barn is the player's (the TEAM OUT chip, unlit, says LANDING, EGG TO THE NEST and HOME until the
    riders are done).
  - **Meanwhile** nobody is held by hand: a keeper held when the team is sent is let go, and a badge, Tab or `take=`
    takes nobody. The job strip and a dragon's card are put away, and a tap in the barn, a badge, Tab, b or ARENA, or
    Esc on the road says "FOLLOWING THE TEAM: THE KEEPERS MIND THE BARN TILL THEY LAND". MAP (or m) still opens the map,
    at once and over the team's view (the world waits under it; the team's flag stands on its road there), and BACK shuts
    it onto the team again; Esc shuts the map, else the trip's log, else the result card. The Arena waits: its chooser
    won't open and the bout's chip is hidden, and a bout already on goes on, its coach picking for the player (10).
- **Built from data, not animated per mission.** A region is its climate's backdrop in parallax layers, and a set
  piece per challenge (a cave mouth, a boulder cart, a snowdrift, a storm cloud, a ford, a bramble arch, a signpost,
  the mill, a bandaged bird, a fog bank behind the team, two rocks); the moves are the rig's own anims (the Arena's
  skills: 10.4).
- **The passages** (`passages.ts`; ART_BIBLE 5.10). Every land stop opens onto a stretch of road the team walks
  through after it, 600 px long from just past its set piece (cut short where the next stop stands closer, so the
  team never halts inside one), drawn as the stop went: the dark's **cave** (a tunnel of rock the whole way, the way
  out an arch of daylight at its end; the lanterns lit along its wall and their pools on the road when the way was lit,
  only glints in the dark when it wasn't), the gap's **canyon** (a rock wall behind the road, flagged along its rim
  once the rope is over), the thorns' **bramble tunnel** (arches over the road, in flower once pushed through, the
  tangle still along the verge if not), the fog's **fog bank** (the bands drifting the whole way, thinned with waymarks
  once the way was found), the cold's **snow lane** (drifts and falling snow; melted to heaps and puddles), the storm's
  **rain** (a cloud band overhead and the rain; a white band, the sun and a stepped rainbow once ridden out), the
  flood's **water meadow** (water along the verge; down to puddles and the stones), the heavy load's **rockfall**
  (boulders along the verge; stacked into cairns), the lost things' **waymarks** (signposts hanging with a "?"; straight
  with a check). The people's stops (the miller, the hurt animal) open onto none: they are met at a place, not in the
  land. The scene knows which passage the lead is in (`SceneFrame.passage`, the hook's `scene.passage`), and sim-check
  24 walks a long road's three whole, each after its stop and in order.
- **The dark** follows section 1: in the tunnel only the lamp's pool of light is open, stepped in flat rings (no
  gradients).
- **Back to the barn.** At the road's end the team lands on the sky bridge and walks back onto the Aerie deck (the
  scene shows its result card, the world waiting on it; its dragons are drawn in the barn again from the landing, and
  with the card tapped away the camera is on the Aerie as they walk back onto the deck): the dragons ride the
  lift down to the nearest free slots and their needs take over, the egg's rider carries it up to the Hatchery, and the
  riders hang their saddles in the Tack Room and rest in the Bunks (5.2); the toast says how it went ("THE LOST NEST: HOME
  SAFE WITH 40 COIN AND AN EGG").
- **Status (built).** The scene shows the trip that is out: the one the Map Room sent (`sim.missions.trip`: 5), from
  its leaving the Aerie (the team at the road's start) to its landing (the result card) -- the game following it there,
  and as it gathers in the barn (`base.ts` `followStage`, `keepFollowing`). Its dragons are away (place `away`) from
  the Aerie to the landing and are not drawn in the barn; the scene draws them. The trip's log (its stops, each dragon's
  puff, the encounter's lines and the walk left) opens over the scene (TRIP LOG). `view=base&preset=trip&trip=<region>:<progress>[:fail][:auto]`
  puts a team of two pairs away on the region's hard mission that far along its walk at the frozen step, the stops
  before that point resolved as their counters would have (`missions.ts` `placeAlong`; `:fail` waits the last of them
  out) -- the world's own trip, as a sent team is once it has left the Aerie, built from the Map Room's own tables and
  rules (`src/game/tripdemo.ts`: `regions.ts`, and `missions.ts` autoRider, forecastOf and roadOf; missions.ts awayNow) --
  the game following it, its road on screen from the first frame (`panel=watch` asks for it too); a stop at that very
  point begins its encounter on the first step (`trip=oldmine:0.9&t=200`: the Mole King walked in and the menu up; with
  `:auto` the trail coach plays it, so a frozen step shows a move or the exit), and `:1` lands the team (the result
  card, the world waiting on it). The climates (in parallax: the far ridge at 0.2 of the camera, the near forms at 0.5,
  each climate at its own phase of the day), the set pieces, the three baddies and the grumpy miller (at the `miller`
  stop, grumpy until he is talked round) are the mission art kit's (ART_BIBLE 5.10: `backdrops.ts`,
  `setpieces.ts`, `baddies.ts`, `npcs.ts`, `missionicons.ts`); the riders carry
  the kit's saddle; the dragons and riders are the real rigs. The scene's ground under its road (`ROAD_SCENE`: the slab,
  the grass strip, the earth) sits between the baddies' dark and mid fills (L 0.19 to 0.27), so palette gate (x) holds
  every baddie's edge fill 25 % from it as well as from the road and its region's climate bands.

---

## 7. Time

- **One clock.** One simulation clock, fixed 60 Hz steps, running only while the game is open (B6). Care, missions,
  hatching, growing up and retiring all read it (they count game days on it; none reads the day's phase). It counts game time, in steps since day 1's midnight (`src/game/clock.ts`; the
  simulation keeps `clock0 + tick`).
- **The day.** A game day is **10 800 steps: 3 minutes at 1x** (23 s at 8x). A new game starts at 07:00 on day 1
  (`hour=` starts one at another hour). The phases: **dawn** 05:00 to 07:00, **day** 07:00 to 18:00, **dusk** 18:00 to
  20:00, **night** 20:00 to 05:00. The sky turns into a phase over its first hour, in three stepped thirds (each a flat
  mix of the two phases' colours: no gradient, no alpha).
- **Night lives in the sky, the lights and the walls; the dragons and the floors never change.** (Before the
  moonlit walls, night changed about 2 % of the opening frame -- the windows, the dorm lamp and the hearth's glow -- and a player
  looking at the barn could not tell night from day.)
  - The sky is drawn behind the building, in screen space: three flat bands, far hills and clouds at half the camera's
    pace, and at night the moon and 24 stars at a fifth of it (the stars come out a third at a time as the night comes
    on, and go the same way at dawn). The barn's windows (2) show it.
  - The lights follow the sky, not the clock's phase (the sky turns into a phase over its first hour, so at 20:00 it
    is still the dusk's and at 05:00 still the night's; `src/game/sky.ts` `lightsOf`): as the dusk's sky turns (from
    18:20) and until the dawn's has (06:00), the towers' window slits are lit and each Lamp Dorm lamp throws stepped
    rings on its wall, the inner one and then both (they go out the same way), never on the floor's band; while the
    stars are out the hearth throws one on the kitchen wall and the hayloft's skylight shows the sky and a star. The
    top bar's sun or moon is the one the sky mostly shows.
  - **The walls are moonlit.** With the lamps, in the same three steps (`lightsOf` `walls`: a third of the way from
    18:20, two thirds from 18:40, all the way from 19:00 through the night, and back the same way from 05:00 to 06:00),
    the building's shell -- every room's wall, the bare and lift-shaft walls, the towers' stone inside and out, the
    barn's boards, posts, slabs, trusses and roof, the lift and ladder bays, the Aerie's gantry and headframe, the lift
    car's rails, the ground -- and the garden's hedge, lawn, trees, bench, lanterns' posts, kerb and fence take their
    **night colours**: each its day colour mixed half way to a mid blue (`src/game/surfaces.ts` `MOONLIGHT` `#5c6a9c`),
    cooler and darker, never black (the walls L 0.20 to 0.31 at night against 0.26 to 0.54 by day). One table maps a
    day colour to its night colour (`surfaces.ts` `NIGHT`, 43 entries: 40 moonlit -- the sky bridge's rope rail among them -- 3 the same on purpose); the building (`building.ts`) and the garden
    (`gardenArt.ts`) are drawn through it, every fill and the cel tones made from it, onto one canvas per step, built
    the first time the step is needed (about 6 ms) and kept: never a frame's work. The props behind the slots (the
    hearth, the tub, the pallets, the gate's leaf, the Map Room's map) are moonlit too; the lights, the flames, the
    flags, the bunting, the crocks, the flowers and the apples keep their colours, and so do the straw of the nests,
    the garden's mounds and the dorm's mattresses (straw, like the floor) and the firebox's and the doorways' dark. The
    watchable scene's ground under and below its road (6: `ROAD_SCENE`, its edge line, slab, grass strip and earth) is
    not in the table: it is not the barn -- the watch overlay draws it as it is at every hour, never through the table
    nor into the building's canvases -- and its night is its region's climate picture's (the mission art kit's: ART_BIBLE 5.10).
    The room names on their plates keep theirs. Measured at the opening frame (`view=base&t=600`, noon against 22:00),
    66.1 % of the pixels change, darker (mean L 0.569 to 0.489 over them) and cooler (blue less red -37.5 to +9.6),
    and none of the 23 003 floor pixels does (`npm run smoke`, which asks for 35 % or more; 69.1 % of a different frame
    before the need rooms repeated on the floors, 4.7).
  - **Nothing tints a dragon or a floor**: no `tint`, `tintAlpha` or `flash` by time of day, and every `FLOORS` colour
    (the straw of every band, landing, car deck and the Aerie deck, the garden's path, the mission road) and the seams drawn on them are
    the same by night (gate w checks the table has no entry that changes one). The night is a mid-value blue hour (its
    sky bands L 0.19 to 0.28, its walls as above), never black, so a dark dragon on the Aerie or in a room still shows
    against it. Gate (w) in `tools/palette-check.ts` holds every sky colour at every phase and every stepped mix
    between two, every wall -- by day, by night and at both stepped mixes between -- and the lamps' light >= 25 %
    *lighter* than every dark body (lightning, dusk and slinkwing, at every stage: so L >= 0.159, and a black night
    fails; the thinnest at night is the moonlit wood `#807277`, 33 % from lightning's elder), the big props right behind
    a slot (the hearth and its dark firebox, the tub, the dorm's pallets) >= 25 % from them either way, day and night,
    and all 6 Oklab L from the ink: 4332 gates, all passing (ART_BIBLE 5.8; 1771 of them the barn's and the garden's,
    52 the watchable scene's ground, gated as it is drawn at every hour, and 2392 the mission art kit's climates at
    their own four phases, the cave mouth and the fog bank (ART_BIBLE 5.10): each climate has its own night, so none is in the night
    table). It also fails any wall, backdrop or prop
    colour (`WALLS`, each colour of `BACKDROPS`, `PROPS`) the night table has no entry for, so a structure added
    later is drawn at night only once its colours are in the table and gated.
  - The barn's care never reads the day's phase: a barn started at noon and one started at ten at night, stepped alike,
    are the same barn (`npm run sim` section 12), and `view=base&layers=cast` (the cast alone -- the dragons, the
    keepers and the bubbles -- on a flat colour) is the same picture at noon and at ten at night (`npm run smoke`).
    (`layers=world`, the world without the sky, the lights and the HUD, now shows the moonlit walls.) A garden
    resident's naps read it (they only nap at night: `src/game/garden.ts`; its state, the residents' rhythm, is left out
    of the barn's key), and so does the Map Room's board, rolled at dawn (`src/game/missions.ts`, 5.1): the two
    simulation modules that do.
- **Growing up.** A stage lasts **30 game days** (a month: #8), baby, then young, then adult, then elder; the new game's
  seven start on the adult stage's first day. A dragon's stage-up falls due 30 days after its stage began, and is
  applied as soon as the dragon is **settled**: no act (a sleeper has one), no keeper on any of its jobs (coming, waiting
  at the stand spot or at work), no route left, standing still in its slot (not turning, waiting for the car or held at
  the bay's edge) -- and has **room to grow**: no keeper stands where its new body will be (a keeper held by hand
  (4.10) does not count: the player may park them anywhere as long as they like, so the dragon grows beside them). A dragon settled but for a
  keeper in that room (most often the one who has just served it, turning for home, or one at a post pickup) holds
  where it is, taking no errand, until the keeper has walked out of it (at most 184 steps, 3 s, over 91 grow-ups
  measured); without that hold it would set off on its next errand the step after being served and seldom be settled
  with room. So a keeper never stands at the old stage's reach, or anywhere in the new body, while it is swapped in. It stays
  **exact**: the next stage counts from the day this one fell due, never from the day it was applied (`src/game/life.ts`;
  `npm run sim` section 13: each stage exactly 18 000 steps on a 600-step day) -- all but the elder stage, which has no
  stage after it to keep in step with: it counts from the step the dragon grew, so its 30 days to the garden are all
  its own, however late the stage-up. A baby in a baby sub-slot first takes a
  free module slot, which its next stage fits (3), and walks there; with none free it waits. Everything that goes by
  stage follows from that step on: the drains (a baby's 1.25 times, an elder's 0.8), the reach, the walk, the body's
  room. How long a stage-up waits is how long the dragon takes to finish what it was doing: alone, at most a minute
  (seeds 1 to 8 on a short day: 4 s to 49 s); in the busy barn, one errand (the walk to a need's room, the wait for the
  one car, the job: 68 s to 144 s at most over seeds 1 to 8, checked against 3 minutes, a thirtieth of a stage: 4.7)
  -- measured with one room per need; in the repeated-room barn (4.7), where the needs are met on each dragon's own floor, seed 1
  measures 4 s alone and 34 s at most in the busy barn (`npm run sim` section 13).
  A baby on its way to its module slot that a need calls (or a Rush) to the room it is going to is met there in a
  baby's sub-slot, like any baby, and goes on growing up after. An elder's next is the garden (3, The Garden): 30 days
  after the step it grew into an elder it retires -- as soon as it may be sent somewhere new, not settled (it keeps its
  size, so no net or line minds). In the busy barn (seven adults falling due to grow elder mid-errand, seeds 1 to 8)
  they grow up to 5788 steps late and are elders 30.00 to 33.33 days, each retiring at most 130 to 1998 steps past its
  due (seed 1: 2339 late, 30.00 to 31.80 days, 1081, with one room per need; in the repeated-room barn, seed 1: up to 2062 steps late, 30.00
  days each an elder, none retiring late); none is late with the `retire` preset (`npm run sim` section 15).
  **The cheer:** just grown up, a dragon holds where it stands for exactly its new stage's `happy` (61 to 139 steps,
  read from the anim tables: `src/game/gait.ts` `happyLen`; the hold is the dragon's own `hold` and is saved): it takes
  no errand, no keeper comes for it and no one moves it on, so nothing cuts the cheer short (`npm run sim` section 13
  checks every grow-up). **On screen:** the new stage's body appears at once, drawn flat in its glow's highlight inside
  its own ink for 12 frames (the grow-up's flash, the one flash the base draws: never for the time of day; frames
  shown, so it lasts as long at 8x, and holds while paused), then it plays `happy` through and a toast says so
  ("EMBER IS AN ELDER NOW!"); ART_BIBLE 4.2's 240-frame grow-up is not built yet. At 05:00 a toast names how many
  dragons grow up soonest within two days, and when (today, tomorrow or in 2 days), and a dragon's card (4.8) shows the day of its stage.
- **Eggs.** An egg (`CareSim.addEgg`: only a mission brings one, 5.6) lies in the lowest free of the Hatchery's three
  nests, in the hayloft's west corner under the roof's low slope (3: x 228, 268 and 308, 40 px apart, the heat lamp
  over the middle one). It hatches **2 game days** after it was laid, as soon as **the barn has room** and a baby
  sub-slot is free for the baby. The barn has a cap, `BARN_CAP` 12 (4.7: every dragon not living in the garden counts,
  those away on a mission and an elder still walking out among them): an egg never hatches while the barn holds 12. It
  waits in its nest, nothing lost, and hatches the first step there is room (an elder arriving in the garden frees one;
  growing up never changes the count: `npm run sim` section 26 -- the egg due at step 120 with twelve in the barn waits
  2829 steps and hatches the step after the retiring EMBER arrives in the garden; and a mission's egg brought home to a
  full barn, laid in its reserved nest, waits past its due the same way). On the step it falls due with the
  barn full a toast says "THE BARN IS FULL" (once, however many fall due together), and while a due egg waits (for room,
  or a sub-slot) three 2 x 2 ink dots stand 6 px over it, drawn with the eggs under the cast (a baby resting in front of
  it may hide them in part, never an eye). The baby's sub-slot: the Hatchery's two first -- one in front of no other egg,
  then the one nearest its nest (the first sub-slot stands in front of the first nest, the second in front of the other
  two) -- and, when each free one would hide another's egg, the nearest free sub-slot out of the Hatchery (the hayloft's
  kitchen next door, most often: the baby is hungry anyway), so a hatchling never hides an egg while a sub-slot is free
  anywhere; else the nearest. It hatches into a baby of the egg's element, with a new id, the first of its element's six
  names no dragon has (then CINDER2, ASH2, ...; never over 8 characters), and a seed drawn from the world's seed and the
  egg's id. It stands up in the nest, hungry (it asks for the kitchen at once), and walks to its sub-slot; the egg is
  gone. With every baby sub-slot taken the egg waits in its nest too (under the cap that takes a barn smaller than the
  start's: its 13 grown modules always leave one). The Hatchery's sub-slots are the hatchlings' first places only: no
  baby moved on (an eviction, a Rush's bump) is sent to them, so no resting baby hides an egg. The egg is drawn as its
  baby's colour, nestled in its nest's straw heap, cracks at half way and at 85 %, wobbles over its last 15 %, and
  throws its shell's bits when it hatches (ART_BIBLE 5.9).
- **Speed.** The top bar's speed button and the keys 1 to 4 run 1, 2, 4 or 8 whole world steps a frame; pause (II, or
  p) runs none, and only the camera and the HUD move. A faster speed is more of the same fixed steps, never longer
  ones, so the world is the same at every speed, only sooner. Speed is the view's: never saved, and 1x after a load.
  (At 4x and 8x an effect's 3 to 6 frame keys can change every frame drawn: ART_BIBLE 5.1, accepted as the
  fast-forward look.)
- **Saves.** The browser keeps the barn (`localStorage`, key `dragon-care/base`; `src/game/storage.ts` is the only code
  that touches it). It is loaded when the game's page opens, and saved every 10 s of play (600 frames) and when the
  page is hidden or left; closing pauses the world (B6). A save is the whole world as JSON, loaded back exactly
  (`src/game/save.ts`): version 10, which added each dragon's XP and the Arena (the bout on, its fighters by id, and the
  bouts begun: 10). A version 9 save (the first shipped, before the Arena) is brought up to date as it loads
  (`save.ts` `migrateSave`): every dragon at 0 XP (LV 1), no bout begun, the rest as it was. **NEW** (tap twice) starts a new barn on a fresh seed, and it replaces the old one. A save this
  build can't read (another version, not a save at all, or one whose insides it can't build, step once and draw: an
  element, a stage or a keeper it doesn't know; or whose eggs it couldn't hatch or draw days later: an unknown element,
  a nest that isn't one, two in one nest; or a garden it couldn't keep: a dragon in a place this build hasn't got, a
  resident that isn't an elder or has a slot, two on one plot, fewer plots than residents; or a bout it couldn't run: `arena.ts` `checkArena`) starts a new barn, with a toast ("NEW BARN: THE OLD SAVE DIDN'T
  FIT"), and the old save is kept aside at `dragon-care/base.bak`; nothing of it is swapped in until the whole trial
  has passed, so a broken save never freezes the page or is written back. **The tests and `t=` are exempt:** a frozen
  page (`t=`), a preset page, a page given `hour=`, `save=0` and every headless check never read or write it, so `t=`
  always shows the new game (or the preset) stepped t times at 1x, whatever the browser holds.
- **Seeded.** Every random choice (a mission's roll, a starting need, a keeper's tie-break) goes through the engine's
  seeded RNG (`src/lib/engine/rng.ts`); after the world is built every draw is stateless (`rngAt`), so a save keeps
  only the seed. That keeps a run reproducible and keeps the gallery's frozen-time screenshot contract (`t=`) true for
  the base too. The one seed drawn from the browser's randomness is NEW's.

---

## 8. Build order

**What is built** (`npm run check` green on the whole):

| Part | Status | Where it is described |
|---|---|---|
| The foundation: seven young adults (#9), stable ids, the save format, the gallery's keys kept out of the game | built | Decisions, 7 (saves) |
| The building rebuilt: rooms with purposes (#11), the Dragon Lift, the Aerie floor, floors a dragon reads against | built | 2, 3 |
| Dragons walk to their needs (#7): rooms, slots, the lift and its bay rule | built | 2, 3, 4 |
| Time (#8): the clock, day and night, the speed, the barn kept in the browser | built | 7 |
| Growing up, eggs and hatching (#8, #5) | built | 7 |
| The elder garden (#10) | built | 3 (The Garden) |
| Barn capacity: the need rooms repeated, the lively step, the cap of 12 | built | 2, 3, 4.7 |
| Night you can see (#8): moonlit walls and shell, never a dragon or a floor | built | 7 |
| Take a keeper (#6): tap, WASD, E, Esc, the touch pad | built | 4.10 |
| Missions I (#5, #11): the Map Room's table, the world map, the team, the trip from the Aerie, rewards | built | 5 |
| Missions II (#5): the watchable scene, challenges on the road, big baddies | built | 6 |
| Missions III: encounters on the road -- obstacles overcome by the dragons' abilities, big baddies worn out in a bout, the trail coach and its forecast | built | 11 |
| Missions IV: the obstacles as skill checks (a mark, a d20 and a bonus, three tries), and the passages after the land stops (the cave after the dark...) | built | 11.3, 6 |
| The mission art kit: climates, set pieces, baddies, the grumpy miller, icons | built | ART_BIBLE 5.10 |
| Training in the Arena: sparring bouts on the roof, XP, levels and skills | built | 10 |

1. **Needs and jobs.** Built. Run `npm run dev` and open `index.html` (this is the game's default page; `?view=base`
   still names it, for the gallery's other debug views): drag to look around, and tap a bubble, a job chip or a
   dragon to Rush it. Each dragon walks to its need's room, riding the Dragon Lift between floors, and a keeper meets
   it there (#7). The four keepers are the named cast of `docs/KEEPERS.md`, each in the anim closest to its job
   while the base's own simulation walks it and picks what it's doing (KEEPERS.md's status has the join). The page
   takes `seed=`, `cam=x,y` (where the camera starts, world px), `preset=ages` (a code-built start with every stage:
   the base's first twelve-dragon cast) and `save=0` (a live page that never loads or saves; a preset page never
   does either); `t=` freezes it as in every gallery view. The gallery's own keys (the arrows, Space, E, the digits)
   do nothing here, and its arrows step over the base, so a debug view reached with them can still be left.
   **Time is built too** (7): the day and night (a day is 3 minutes at 1x: watch one whole, or in 23 s at 8x), the
   speed (the top bar's button, the keys 1 to 4, and p to pause), and the barn kept in the browser (a reload resumes
   it; NEW, tapped twice, starts another). The page also takes `hour=0..23` (the hour day 1 starts at; like a preset
   page, a page given an hour never loads or saves, so it always starts at that hour), `layers=world` (the world
   drawn without the sky, the lights and the HUD) and `layers=cast` (the cast and the bubbles alone on a flat colour,
   for the no-tint check). **Night you can see** (7): at night the walls, the building's shell and the
   garden are moonlit (one day-to-night colour table, one building canvas per step of the dusk and the dawn), never a
   dragon or a floor.
   **Growing up and eggs are built too** (7): a dragon grows into its next stage 30 game days into its stage, once it
   is settled with room to grow (the flash, `happy` held through, a toast), eggs in the Hatchery's nests hatch 2 days
   after they were laid into babies that grow up, the dawn's tip names who grows up soon, and a tap on a dragon opens
   its card (4.8).
   Only a mission brings an egg (5), so the presets show them: `preset=growup` (EMBER grows up a half second in),
   `preset=eggs` (three eggs in the nests, one just laid, one cracked, one about to hatch), `preset=hatch` (an egg
   hatching at step 60) and `preset=full` (every baby sub-slot taken, 21 dragons forced over the barn's cap: a due egg
   waits, its dots over it and `BARN 21/12` in the top bar).
   **Barn capacity is built too** (3, 4.7): a need's rooms repeat on the floors, dragons step lively on and
   off the car and across the lift bay, and the barn is capped at 12 dragons (`BARN n/12` in the top bar; an egg waits
   in its nest while it is full). `preset=twelve` shows the barn at its cap (the capacity benchmark's twelve: the
   start's seven, three young and two babies), `preset=capped` the same twelve with its babies out of the Hatchery and
   an egg falling due on the first step -- it waits in plain view in the first nest, its three dots over it, with the
   toast THE BARN IS FULL and `BARN 12/12` in amber -- and `npm run capacity` measures any herd (4.7).
   **The elder garden is built too** (3, The Garden; #10): the Garden Gate in the right tower's ground floor, the garden
   past it (a plot a resident, two from day 1: pan right from the start to see it), elders retiring to it 30 days into
   their stage, and its residents napping, sitting and strolling, needing only food and love, met where they rest by a
   keeper come out of the barn. A new game's elders are 60 game days off (the start's adults grow into elders in 30), so
   two presets show it: `preset=garden` (three residents on their plots -- BRAMBLE, COBBLE and ECHO -- and four adults in
   the barn) and `preset=retire` (the seven starters, elders a tenth of a day from retiring: they walk out one by one,
   and the garden widens to seven plots).
   **Taking a keeper is built too** (4.10; #6): tap a keeper or their badge, walk them with WASD or the arrows (or the
   touch pad), and E fetches, feeds, bathes, plays, grooms and tucks in; the page also takes `take=bea` (that keeper
   held from the first step: `view=base&t=120&take=bea` is the frozen picture of it).
   **Missions are built too** (5; #5, #11): MAP (or M, or a tap on the Map Room's table) opens the world map (the
   island, its places, the day's missions pinned at them); a pin opens
   its mission's chooser (the climate picture, the challenges and who at home meets them, the team, the trail coach's forecast); BEST
   TEAM and SEND FROM THE AERIE send it -- the team musters on the Aerie (the dragons by the lift, the riders with their
   saddles from the Tack Room), walks off west over the sky bridge, comes back its game days later with coin and
   perhaps an egg for the Hatchery, and the riders rest in the Bunks. The page also takes `panel=map` or
   `panel=mission&mission=0..2` (the table open at the first frame; such a page never loads or saves) and
   `preset=muster` (THE LOST NEST sent at once: the team is all on the deck at step 2186).
   **Following a mission is built too** (6), and the road is played there (11): from SEND the game follows the team --
   the camera on the Aerie as it gathers and sets out, then the scene of its road: the stops and their encounters (the
   plates, the ability menu, the moves and their popups, AUTO; the world waits for your pick while the menu is up), the
   banners, the big baddie's fight and its cozy exit, the trip's log (TRIP LOG), and the result card, tapped away the
   way back to the barn. `preset=trip&trip=<region>:<progress>[:fail][:auto]` puts a team away on a hard mission that
   far along its walk, the stops before that point resolved (`trip=oldmine:0.9&t=200`: the Mole King walked in and the
   fight's menu up; `:auto` after the progress puts the trail coach on, so a frozen step shows the fight played;
   `oldmine:0.905` the team walking on past it, calmed; `highfold:0.9`, `frostmere:0.9` the Storm Roc and the Frost
   Giant; `bramblewood:0.7:fail` a team that will fail, on its road just where the one that succeeds is; `oldmine:1` the
   result card, `bramblewood:1:fail` a failure's).
   **The Arena is built too** (10): ARENA (or B, or a tap on the Arena's deck) opens its chooser; tap your dragon, then
   its sparring partner, and START BOUT -- the two ride up to the roof and face each other, you pick your dragon's
   moves (or AUTO), and both come home with XP, levels and new skills. The page also takes `panel=arena` or `panel=bout`
   (the chooser, or the bout on, open at the first frame with the camera on the Arena) and `preset=bout` (EMBER at LV 3,
   the player's, and BRAMBLE at LV 2 in their corners from the first step: `view=base&preset=bout&panel=bout&t=90` is
   the move menu frozen); the gallery's `view=arenaaudit` plays every sparring move against every look in the other
   corner and measures each eye (10.6).

   ![The built game, 30 s in (11:00), at the start camera: BRAMBLE rests in the ground floor's Grooming Parlour and ECHO in the hayloft's, while Bea walks east past them for the ball RIPPLE wants (RIPPLE's tail in the Bathhouse, on its way to the ground floor's Romp Room); off to the east EMBER sleeps in the ground floor's Lamp Dorm, IRIS goes to tuck ZAP in upstairs and WICK, moved on, heads for a kitchen -- no dragon has needed the lift yet, every need met on its own floor; the top bar with the badges, COIN, BARN 7/12 and MAP](base/base_live.png)

   | File | What it is |
   |---|---|
   | `src/game/pet.ts` | the pet code, moved out of `src/gallery.ts` unchanged (the gallery renders pixel for pixel as before), and the paper turn the base's dragons turn with |
   | `src/game/needs.ts` | the five needs, the drains, the tiers, mood and lightning's charge |
   | `src/game/layout.ts` | the grid; the rooms, each with its purpose (#11), one module each where a need's rooms repeat (their posts and the keepers' waiting spots in a one-module room; the Hatchery under the hayloft's west slope), and their dragon slots and stand spots; the Dragon Lift and the Aerie; the garden's plots and the world's width for a garden of so many; the keepers' net (the ladders) and a dragon net per stage (the lift), built for the garden's end; routes between any two spots on a net; the name plates' places |
   | `src/game/surfaces.ts` | every floor anyone stands on (`FLOORS`: straw, the garden's path, the mission road), and everything a dragon is seen against (the walls, the sky's colours at every phase, the big props behind a slot, the lamps' and lanterns' light, the garden's hedge, lawn, wood and fence, the mission scene's ground under its road: `ROAD_SCENE`), each gated by `tools/palette-check.ts` (i, Ki, w); the one night table (`NIGHT`: a day colour to its moonlit night colour, gated by w too, never a floor's; never the mission scene's ground, drawn as it is at every hour: it is not the barn) |
   | `src/game/clock.ts` | the day's length and phases, the speeds, reading the clock (the day, the time, the phase and the sky's stepped turn) |
   | `src/game/sky.ts` | the sky behind the building, in screen space: the bands, the far hills and clouds, the moon and the stars |
   | `src/game/hud.ts` | the top bar (the clock, the jobs, the keepers' badges -- tappable: 4.10 -- the coin, the barn's dragons against its cap, ARENA, NEW, pause, the speed, MAP), the toasts, the hint, the dragon card (its level too), and while a keeper is held the touch pad, the line over it and the portrait line |
   | `src/game/storage.ts` | the only code that touches the browser's storage: load the barn (or set aside one that doesn't fit), save it, forget it |
   | `src/game/start.ts` | the starting base: the rooms of section 3 (a need's rooms repeated on the floors), seven newly adult dragons (one per element, 0 days into adulthood), each in a slot of its own need's room, and the four named keepers at their fixed stations |
   | `src/game/presets.ts` | code-built starts for views that need what a new game hasn't got (`ages`: every stage; `twelve`: the capacity benchmark, the barn at its cap; `capped`: it with an egg waiting in plain view; `growup`, `eggs`, `hatch`, `full` (forced over the cap); `garden`: three residents; `retire`: seven elders about to retire; `muster`: THE LOST NEST sent; `trip`: a team away on a hard mission, that far along its road, `:fail` its last stop waited out, `:auto` the trail coach on: 6, 11; `explored`: every region out from under its cloud: 5.1; `bout`: a bout in the Arena from the first step: 10) |
   | `src/game/regions.ts` | the missions' world: the six regions (climate, challenge pool, eggs, baddie, neighbours, titles, their places -- the landmarks a mission is met at, `placeOf` -- and where their land grows from on the map), the eleven challenges and what meets each, the baddies' two counters and cozy exits, the keepers' rider skills |
   | `src/game/missions.ts` | the missions, DOM-free: the board rolled at dawn, who may go, auto riders, the trail coach's forecast, BEST TEAM, sending (the road laid, the egg drawn, the nest reserved), the trip (the muster, the departure over the sky bridge, the road walked step by step with each stop's encounter begun and stepped -- `encounter.ts` -- the landing and the outcome decided there, the egg, the saddles, the rest), a trip placed along its road (the preset's `placeAlong`), the save's checks, and a version 10 trip brought up to the played road |
   | `src/game/trip.ts` | a mission and a trip as plain data (5, 11): the road's stops (each with its result, its turns and the clock it was resolved at), the walk (`travel`, `walked`), the team's stats, puff and XP, the trail coach's switch (AUTO), the encounter at the stop the team stands at, the baddie's exit |
   | `src/game/encounter.ts` | the encounters on the road (11), DOM-free and seeded: an obstacle's check (its mark, each try's bonus and chance, the d20, the bite and the mark's easing), a fight's baddie and its coach, the abilities offered each pair at a stop (with their weights and chances) and the trail coach's pick, a turn's moves (the quicker first, each its anim's length, landing at its impact), the stop's outcome, line and XP; the forecast's dry run (`forecastRoad`); what the scene shows for each move (`pairLook`, `foeShow`, `popupOf`); the save's checks |
   | `src/game/worldmap.ts` | the world map's picture (5.1): the island generated from seeded noise (the coast, the regions' land, the lake, the brook, the roads), what grows on it, every place's landmark and HOME, cloud over the regions not explored yet, and its living parts (glints, the mill's sails, smoke); the team's route; the layout's self-check (`mapProblems`) |
   | `src/game/maptable.ts` | the Map Room's table, drawn: the world map (worldmap.ts's picture, the regions' names, each mission's pin and plate at its place, the team's road and flag), the mission chooser, the TEAM OUT chip, the follow line and the trip's log (over the watch overlay); their tap targets |
   | `src/game/sim.ts` | the care simulation: the queue, the keepers' trips and jobs (fetch, go, wait at the stand spot, work), and Rush; no drawing, seeded, deterministic; dragons with stable ids, a clock, and its options (seed, day length, start time) |
   | `src/game/travel.ts` | the dragons on the move: each chooses a room meeting its need (on its own floor first) and takes a slot there (moving a lingerer on to its own lowest need's room, or bumping a holder for a Rush), walks and turns (lively on and off the car and across the bay: the one hurry), waits in a landing's line where it covers no eye, and rides the Dragon Lift; the lift's car and its calls; the bay rule (the shaft guard among it), and one dragon at a time in the shaft; how deep each dragon is drawn |
   | `src/game/gait.ts` | each element's walk at each stage as a table of per-frame root motion, the pace the simulation walks a dragon at |
   | `src/game/save.ts` | the save format: the whole world as JSON, every reference an id, loaded back exactly (`CareSim.fromSave`); the digest two runs compare |
   | `src/game/rand.ts` | stateless draws (`rngAt(seed, tag, ...keys)`): no RNG state is ever kept or saved |
   | `src/game/building.ts`, `people.ts`, `icons.ts` | the greybox building (its rooms, the lift's shaft, car and headframe, the ladder bay, the windows, the Aerie's deck and gantry, the Garden Gate's arches), drawn at each step of the night (its colours through `surfaces.ts` `NIGHT`), and its lights by night, the keepers on the named cast's rig (`docs/KEEPERS.md`), their walks played at their pace, the bubbles and chips |
   | `src/game/life.ts` | growing up (a stage-up 30 days into a stage, applied once the dragon is settled, exact; a baby first moving to a module slot) and hatching (an egg 2 days after it was laid, into a free baby sub-slot, never hiding another's egg); the barn's cap (`BARN_CAP` 12, `barnCount`, `barnFull`: no egg hatches in a full barn) |
   | `src/game/names.ts` | the hatchlings' names, six per element, the first free one taken |
   | `src/game/eggs.ts` | the eggs, drawn: the shell, its cracks and wobble, the hatch's shell bits, and the dots over a due egg still waiting |
   | `src/game/garden.ts` | the elder garden: retiring (30 days into the elder stage), the plots it grows, the residents' nap, sit and stroll (napping only at night: the one simulation module that reads the day's phase), their resting places kept apart (clear of each other's eyes, no two bodies overlapping more than 20 px), their jobs met where they rest |
   | `src/game/gardenArt.ts` | the garden, drawn: a plot's tile (the hedge, the lawn, an apple tree on every other, a nest mound, a lantern, flowers on stalks; the path, the kerb, the ground), drawn only where it is on screen; the fence at the world's end; the lanterns' rings at night, clipped to the hedge's own shape; the GARDEN sign |
   | `src/game/control.ts` | taking a keeper by hand (4.10): the player's commands (take, steer, act, let go; the Map Room's send, a pair's ability at a stop and the trail coach's switch: 11; and the Arena's bout, skill and coach: 10), applied at the start of a step; walking and climbing by hand under the bay rule; what E does (pick up, serve, put back) and the line that says so; a keeper held saved as let go; a rider on a mission's trip never taken |
   | `src/game/missionview.ts` | the watchable scene: the scene as a pure function of the trip's state and the clock (`sceneAt`: the road as far as it is walked, the stop the team stands at and its encounter's move, the pace from each walk's own root motion, the baddie's walk-in and exit -- never the outcome), the team's characters played to it (the riders with their saddles; each move its dragon's own anim, a rider's special the rider's moment), and its drawing (the climate, the road, the set pieces, the miller, the baddie, the banner, the result card) |
   | `src/game/encounterui.ts` | the encounter's furniture over the scene, drawn (11.6): each pair's plate (its puff), the stop's plate (the mark to beat and the try, or the baddie's puff), the ability menu and its rows (each with how it works this stop), THE TRAIL COACH PICKS, AUTO, the popups over the heads, and the TEAM OUT chip's words; their tap targets |
   | `src/game/passages.ts` | the passages (6): the stretch of road each land stop opens onto, drawn behind the team as the stop went -- the cave, the canyon, the bramble tunnel, the fog bank, the snow lane, the rain, the water meadow, the rockfall, the waymarks -- and which challenge has which |
   | The mission art kit (`src/game/backdrops.ts`, `setpieces.ts`, `baddies.ts`, `npcs.ts`, `missionicons.ts`, `cel.ts`, `missionart.ts`) | the missions' pictures (ART_BIBLE 5.10): each region's climate at every phase of the day in parallax layers, the eleven set pieces, the three big baddies (their faces, poses and cozy exits) and their portraits, the grumpy miller on the keepers' rig, the challenge and skill icons and the saddle; the gallery's `view=missionart` lays them out; the scene and the Map Room draw them from these modules |
   | `src/game/tripdemo.ts` | the `trip` preset's mission and team: a region's mission at a difficulty from `regions.ts`, the best two pairs for its road (the baddie's counters first, then the forecast) with the missions' own auto riders and road (`missions.ts`); `placeAlong` then puts it that far along, the stops before resolved as asked |
   | `src/game/training.ts` | the Arena's rules (10.4), pure: levels and XP, each element's stats by stage and level, the spirits, the ring of the seven elements, the skills and the levels they are learned at, a move's outcome from its rolls, who moves first, the coach's pick, the XP a bout brings |
   | `src/game/arena.ts` | a bout in the simulation (10.3), DOM-free and seeded: who may spar, the muster up to the corners, the turns and their moves (each its anim's length, landing at its impact), the end (the XP, levels and skills; tired and hungry; the nap and the preen), the walk home, what each fighter shows (its move's anim, a face), and the save's checks |
   | `src/game/arenaui.ts` | the Arena's screens, drawn (10.5): the chooser (the corners' cards, the matchup, the dragons, SWAP, START BOUT), the bout's plates, line, move menu, result card and popups, and the bout's chip; their tap targets |
   | `src/game/base.ts` | the live view: the simulation driving the dragons (where they stand, their walks -- at the lively step's speed too -- turns and rides; a resident's nap and wake) and their anims, the lift's car, the eggs, the grow-up's flash, the garden, the sky and the lights, the speed, the camera (out to the garden's end), the HUD (the dragon card too), the input and the overlays over the barn (one screen, one set of input rules: the Map Room's table, 5; following a team out, 6: the camera held on the Aerie as it gathers, then the watch overlay of its road, with no way back to the barn until its result card is tapped away; the Arena's chooser and its bout, 10: the world waiting for the player's pick, the fighters' moves, faces and popups); a live page loads and saves the barn; and the road played from the scene -- the encounter's rows and AUTO, the world waiting for the pick (11) |
   | `tools/sim-check.ts` | `npm run sim`, in `npm run check`: the care simulation, headless, in 28 numbered sections -- routes, 30 minutes of play on three seeds checked every step (the bay rule, one dragon in the shaft, no eye under a standing body but for a moment), determinism, Rush, the start cast, saves (exact, through JSON, taken at every kind of moment), `rngAt`, the rooms (a purpose each, and every room used over the check, room by room), the gait, barn capacity and the cap, the clock and night, growing up, eggs, retirement and the garden, the missions (the board, the forecast, who may go, a full trip with its stops played, sends mid-act, a failure, the outcome, care with a team away), the watchable scene, taking a keeper, the Arena (its rules and balance, a whole bout in the world, who may spar, its saves) and the encounters on the road (the offers, the rules, the balance, a road by commands, its saves, a version 10 trip brought up, no word of harm). The file's header lists what each section checks, and each prints what it measured. Five worker threads run the longest sections beside the rest, so the whole check keeps to about 25 s on four CPUs (the budget is 30 s on four CPUs or more, scaled up on fewer; the suite fails over it unless other work beside it kept the machine busy -- half a CPU or more on average, read from /proc/stat) |
   | `tools/capacity.ts` | `npm run capacity` (not in `npm run check`): the capacity benchmark -- named casts (`start7`, `eight`, `ten`, `twelve`, `thirteen`, `fifteen`) or any `7a3y2b` mix placed on the start barn (fewer than seven adults too: `0a12b`, a late game's barn of babies), 30 minutes on seeds 1 to 8, every run checked as section 2 is (a dragon mid-walk getting no more than 4 px on in 10 s, stood still or turned about on one spot, a stall) -- printed as a table with a SERVED / NOT SERVED verdict each (4.7) |

   Measured by `npm run sim` on the starting base (its seven dragons and four keepers, the need rooms repeated on the
   floors, 4.7): over 30 minutes of play (seed 1), 154 jobs opened and 152 were done, every
   one by a keeper (none closed on its own). A keeper started on a job 28.4 s after it opened on average (112.3 s at
   most); no need ever emptied. Keepers who reached the stand spot first waited 3.1 s on average for the dragon, and
   none gave up. The dragons walked 100 869 px and rode the lift 3 times (a wait at a landing of 6.0 s at most, a rider
   held in the car at most 8.0 s while the bay cleared): with a need's rooms on their own floor they seldom need it;
   dragons were held at the bay's edge at most 17.2 s (keepers never); 89 lingerers were moved on. The shaft never
   showed two dragons one over the other; an eye was under the body of a dragon standing over it 1.6 s in all (5
   moments, the longest 0.4 s: section 2's "What is left"). Every dragon had its needs met in four kinds of room or more (EMBER, which has no
   bath need, in four; the rest in five), and the rooms were used 54 (the Hearth Kitchens), 54 (the Bathhouses), 64
   (the Romp Rooms), 37 (the Grooming Parlours), 29 (the Lamp Dorms) and 3 (the lift) times. Seeds 1 to 3 together
   (the check's service gates): average waits of 28.4, 21.6 and 26.0 s (mean 25.3), 112.3 s at most, no need empty, a
   landing 13.0 s and the bay's edge 17.2 s at most, an eye covered 3.7 s in all (1.5 s at most), 3, 1 and 3 rides. A
   Rush every 30 s for 30 minutes (seed 1): no need empty, every rushed job done within 42.7 s, keepers standing for
   rushed dragons 6.1 % of their time. The herd the game grows (section 10, seed 1): the capacity benchmark's twelve
   -- the barn at its cap (4.7) -- no need empty, waits of 40.2 s on average (154.3 s at most), 266 jobs done, 44 rides
   (the car 28 % busy), no stall and no two in the shaft; eight adults 27.7 s, ten 24.7 s, the `ages` preset's twelve
   of every stage 49.3 s, none with a need empty; the `full` preset, forced 9 over the cap, still does 39 jobs in 10
   minutes, its due egg waiting; a barn of babies -- twelve packed from the ground floor up -- no need empty, 56.6 s
   (320.9 s at most), 289 jobs done, no stall; four babies each resting in the room another wants all met, none empty;
   and two walking up to one landing at one spot placed in the order they stand. The cap (section 26): with twelve in the barn an egg falling due waits in its nest --
   one "THE BARN IS FULL" -- and hatches the step after an elder retiring from the barn arrives in the garden. Over
   the whole check every room is used, each copy of a need's room too (section 8). (One room per need gave
   136 opened, 128 done, 87.6 s and 301.2 s, 112 rides with the car 95 % busy; the first barn, the dragons pinned in
   their slots and the rooms restoring their needs, 149 opened, 146 done, 14.5 s and 41.0 s. The check wants a mean of 31 s
   and 135 s over the three seeds: 4.9 says why.) The elder garden (`npm run sim` sections 15 and 16): with the
   `retire` preset on a 600-step day, the seven retire the step they fall due and arrive over 3710 to 8412 steps (the
   lift carries the three from the upper floor and the hayloft down one at a time), a retiree waiting at a landing
   15.3 s at most, the gate passed 7 times, the garden grown to 7 plots and the world 2568 wide; in the busy barn
   (seven adults grown elder mid-errand, up to 2062 steps late), each retires 30.00 days after it grew, none late,
   waits at a landing 14.8 s at most (2.1 s for one retiring from a crowded barn of ten) and walks out within 101 s.
   The `garden` preset, 30 minutes of the real day: its three residents asleep 76 to 78 % of their steps (every night
   step), each strolling 6 or 7 times, two at rest overlapping 12.0 px at most, and visited by a keeper twice (4 an
   hour), their food and love draining at exactly a quarter of an elder's rate; the barn's four adults beside them
   waited 16.7 s on average (92.5 s at most), no need empty. Not built (section 9 has the open questions):
   - the seven span more than one screen, so the start camera shows some of them and a drag shows the rest; they
     no longer stay put;
   - the grow-up is a stand-in (the flash and `happy`), not ART_BIBLE 4.2's 240-frame grow-up with its "look at me";
     a hatch has no toast; at 8x the `happy` plays at 8x, like everything else (its flash counts frames);
   - the barn is capped at 12 dragons (4.7): past that an egg waits in its nest, a mission's egg too (the chooser
     says so), until an elder leaves for the garden; nothing but a retirement frees a place;
   - a dragon walking past one waiting at a landing (an alighter walking off toward it, a crosser through a line)
     covers it for the moment it takes to pass, and a landing crowded past its room leaves one over another's eye
     until the car takes it (section 2);
   - dragons walking pass through each other in the garden as in the barn: two elders walking out together can walk
     nose over tail for a while, and a resident strolling past another covers it for a moment (only resting places
     are kept clear);
   - a new game has no elder for 30 game days and none retires for 60, so the garden stays empty in play until then
     (the presets show it);
   - the base is the fixed starting one (or a preset); it is kept in the browser (7), but there is one barn, with no
     save slots;
   - a keeper held by hand climbs a ladder in their `idle` pose (the cast has no climb anim: a stand-in, as for every
     keeper's climb);
   - no building of rooms (the rooms are section 3's fixed set).

   Missions, measured by `npm run sim` (sections 17 to 24, 26 and 28, on the whole game: the need rooms repeated, a
   keeper takeable): 100 boards (seeds 1-5, days 1-10) roll the same twice, day 1's always THE LOST NEST first, no
   baddie before day 3; the forecast (5.4) on five hand-picked teams reads as the rules say (RIPPLE and ECHO on THE LOST
   NEST 2 of 2 in 2 turns with all their puff; a best team on a hard road 4 of 4 in 7 turns with 92 % of its puff; a
   lone unmatched pair 3 of 4, out of puff), and BEST TEAM on THE LOST NEST is RIPPLE and ECHO; with Bea taken by hand
   (a stub, and the take command: 420 asks each), no auto rider nor BEST TEAM chose her, and a send command with her
   riding was refused ("NOT ENOUGH KEEPERS HOME"). THE LOST NEST with RIPPLE and ECHO (seed 2, a 600-step day, forecast
   100 %): all on the deck 2534 steps after SEND (the muster preset's team, on the real day, seed 1: 2186), away at
   3774, the spring flood and the lost things each cleared in a turn (nobody picking: the trail coach did, after the
   player's 450-step wait; +15 XP each), landed at 6501 (food and sleep down to at most 45 %), the spike egg laid in
   its nest 2164 steps later (its rider down the left tower and up the centre ladder to the hayloft's Hatchery) and
   hatched two days on; the Map Room used once, the Tack Room 4 times, the Aerie twice, the Bunks twice; 40 coin;
   FROSTMERE revealed at the next dawn. RIPPLE alone on the Old Mine Road's hard mission (seed 1) clears its three
   obstacles and sits the Mole King out: it walks on to the road's end, never a step back, where the result card says
   NOT THIS TIME, home with 75 coin and no egg; on 8 seeds the trail coach's roads come out the same twice, THE LOST
   NEST cleared and its egg laid on every one, and BEST TEAM's second mission won on all 8. Musters sent in the middle
   of play (BEST TEAM, seeds 1-6, 600 and 1500 steps in) take median 2412 and at most 2845 steps (the check's bound
   9000). With the two pairs away 30 minutes of the real day (and their two stops), the five dragons and two keepers
   home did 113 jobs, a job waited 23.2 s on average (89.5 s at most), and no need ever emptied. The watchable scene
   (section 24): six trips -- an easy, a normal and each baddie's hard road by their best teams, and the Mole King's by
   RIPPLE alone -- read at every one of 24 596 steps, 8994 of them walk steps without a skating paw, the baddie in view
   on 9081; the view's walks on the road's frame at 490 synced steps; the best teams wore each baddie out in 6 turns,
   and RIPPLE alone sat the Mole King out after 9; on a long road (a 15 000-step walk) the lead walked the cave, the
   bramble tunnel and the fog bank whole, each after its stop and in order. The encounters (section 28,
   under a second): the offers at ten stop-and-pair cases as 11.2 says, with their chances (RIPPLE's STRONG try 95 %,
   EMBER's little one 5 %); by the rules alone RIPPLE passes an easy flood's check on its first try (11 + 20 = 31
   against 22) and the cold's on its second (bitten 3, the mark eased to 18), EMBER alone waits a hard miller out after
   3 tries and BEA's CHARM clears it in 1 with no roll, BEA's CHARM costs the Mole King 24 of its 96 puff and a POWER stage, and the best team wears it out in 6 turns;
   over 9 fights the best two pairs wore their baddie out every time (6.4 turns on average) and a lone pair with
   neither counter sat it out every time, and THE LOST NEST's two counters cleared both stops in a turn or two each on
   10 of 10 seeds; a road by commands (11.6's refusals, a pick by hand, AUTO) came out the same twice, its saves
   stepping on to the same world, and brought RIPPLE and ECHO each LV 2 and the YAWN; 13 encounters a build can't run
   threw, and no encounter line nor the road's text has a word of harm. Taking a keeper (section 25): BEA feeds
   EMBER by hand (149 steps at work), climbs the centre ladder up and down in 141 steps each, is held 10 251 steps
   while 20 Rushes go on open jobs and is never given a job, and walks home in 515 steps once let go. The cap (section
   26): the twelve at the cap send THE LOST NEST (the chooser's BARN FULL: THE EGG WILL WAIT, the team away and still
   counted on all 1189 of its steps away), its egg laid in nest 0 at the hayloft's x 228 falls due at the cap -- one
   "THE BARN IS FULL" -- and hatches the step after EMBER, retiring, reaches the garden (step 13 914). Over the whole
   check every room is used, room by room (section 8: the three kitchens 482, 420 and 159 times, the Hatchery 65, the
   Tack Room 43, the Bunks 23, the Map Room 10, the Garden Gate 70, and every other copy at least 36), and the suite
   takes about 22 s on four CPUs (22.0 s in the last run, its slowest worker the `full` preset's 21.4 s, other work
   beside it 0.02 CPUs; the budget is 30 s on four CPUs or more, scaled up on fewer -- 60 s on two -- and the suite
   fails over it unless other work kept the machine busy, half a CPU or more).

   The Arena, measured by `npm run sim` (section 27, about 1.3 s in the `saves` worker): every pairing of the start's
   seven each way round on four seeds (168 bouts at LV 1, AUTO) -- each element won 21 to 28 of its 48, a bout lasted
   6.2 turns on average (3 to 12; 2 ran out of turns), no draw; a level up beat its own element in 28 of 28 bouts, and
   three levels up beat the element strong on it in 56 of 56. A whole bout in the world (seed 1): begun at step 1997
   with ZAP being tucked in by IRIS and EMBER asleep -- EMBER woke 664 steps into the muster and ZAP 967, and both
   stood in their corners 3453 steps after START (EMBER, up first, in the east one); the first pick waited its 300 steps
   for the coach, a PREEN and a breath were picked by hand, then AUTO; EMBER won in 6 turns (+30 XP: LV 2 and YAWN;
   ZAP +15), the pair stayed 245 steps in the ring for the nap and the preen, and were home 1013 steps later, ZAP (the
   west corner) first. The same bout twice is the same world, and saves taken at every state of it step on the same.
   The smoke's sparring audit (`view=arenaaudit`): all 84 sparring skills of the 21 looks that spar, against every look
   in the other corner -- no eye covered either way; the longest reach past the ring's middle 46 px (the elder rock's
   GRAVEL ROAR), and the two drawn at 18 px apart at the least (the elder dusk's lamp ahead of its snout).
2. **Rooms you build:** place, merge and upgrade rooms; move dragons between them; ~~save and load~~ (built: 7). Not
   built: the one way the barn could grow past its cap (4.7).
3. **Missions:** ~~the table~~ (built: 5), then ~~the scene~~ (built: 6), then ~~the road played~~ (built: 11). Built all three.
4. **The rest of the world:** people's own lives (the bunks: built as the riders' rest, 5.2), ~~eggs and hatching~~
   (built: 7), ~~day and night~~ (built: 7), the neighbour effects, the blueprint zoom-out.

## 9. Open questions

**Settled by the issues (#5 to #11).**
- ~~Should a dragon ever take itself to a room (a tired dragon to the Lamp Dorm), or only ever be moved by the
  player?~~ Resolved (#7): every dragon takes itself to its needs' rooms, and a keeper meets it there (2, 3, 4.4).
- ~~Is care only managerial?~~ Resolved (#6): the player may take any one keeper by hand and do the chores (4.10, B2);
  the others go on by themselves.
- ~~How long is a stage, and does time stop?~~ Resolved (#8): a stage is 30 game days (a day 3 minutes at 1x), with a
  speed button, pause, day and night, and the barn kept in the browser (7).
- ~~What happens to the old?~~ Resolved (#10): 30 days into the elder stage an elder retires to the garden past the
  right tower, which grows a plot for each (3, The Garden).
- ~~Which rooms are rooms?~~ Resolved (#11): a room is named and furnished only for a real purpose, and `npm run sim`
  proves every one used, room by room (3).
- ~~Are missions a menu or a place?~~ Resolved (#5): the Map Room's table in the left tower sends them, the Aerie on the
  roof sees them off and home, eggs come back to the Hatchery, and the scene is the timer (5, 6, B5).
- ~~The wall gate's exact rule, once the room palette exists.~~ Answered: gate (w) (7) holds every wall, sky
  colour and lamp's light >= 25 % lighter than every dark body, every big prop behind a slot >= 25 % from them either
  way, and all 6 Oklab L from the ink. A prop's cel shadow band and its 1 px lines are marks, not backdrops, and are not
  gated.
- ~~Night in the start frame is quiet~~ (about 2 % of the frame changed at 23:20 against noon). Answered:
  without new furniture (#11), the walls and the building's shell are moonlit at night, stepped with the lamps (7):
  69.2 % of the opening frame changes, and no dragon or floor pixel does.
- ~~The dragon card covers the Hatchery at the start camera.~~ Answered: the card opens on
  the far side of the screen from the dragon tapped (4.8), so a dragon tapped in the Hatchery sees its card at the right.
- ~~Levels outside the Arena.~~ Resolved (11): a dragon's level and stats count on the road -- its Arena stats (its
  spirits on its POWER) are its stats at every stop, the forecast reads them, and the road brings XP (15 for a stop
  cleared, 5 for one waited out; 40 for a baddie worn out, 15 for one sat out), so a mission can bring a level and a
  new skill home.
- ~~Is a mission set and forget?~~ Resolved (B4 amended, 11): the road is played, stop by stop, and the trail coach
  plays it for a team you leave to it.

**Still open** (each a follow-up, none begun):
- **Anims the rig has not got.** `fly`, `hopGlide` and rock's boulder hop: a team walks off the Aerie over the sky
  bridge instead (5.2; rock and the young could not fly anyway). The grow-up is a stand-in (the new silhouette's 12-frame
  flash, then `happy`), not ART_BIBLE 4.2's 240-frame grow-up with its "look at me" -- and whether that moment should be
  the player's to trigger is still asked. The keepers have no climb anim: a climb, by hand or not, shows `idle`.
- **The night shift.** Deferred: the barn keeps no keeper day and night rhythm (the care never reads the phase:
  7), and a resting keeper stays assignable; dusk as the early sleeper and slinkwing as the night owl (3.7, 3.8) wait
  with it.
- **Recruits and the rest of the rewards.** Coin and eggs are built (5.6); coin buys nothing yet, and curios,
  blueprints, feed, materials and recruits (more keepers) are not built -- nor building rooms (8, item 2), the one way a
  barn could grow past its cap of 12 (4.7).
- **A mission's walk-on parts.** The riders walk through their own dragons at the muster and overtake them on the
  bridge (they walk at a keeper's pace, twice a dragon's); the grumpy miller has no walk (he stands at his stop); a
  big baddie's moves are a face, a stomp in place and a popup, never a blow (B8). A faster lift car would shorten the
  muster (a median 2460 steps, 41 s at 1x, over 360 sends: 5.2).
- **The bodies of a move.** The skills are anims the rig had already: a move's cost shows as a face and a popup, never
  a reaction of the body (B8 wants no hurt pose; a dodge or a flinch that reads as neither would need new anims), in
  the Arena and on the road alike. One bout at a time, two of the barn's own; no garden resident or baby spars.
- **The road's balance is the start's.** The encounters' numbers (11.3, 11.4) are tuned for the start's seven at LV 1
  to 3 -- a best team wears a baddie out in about six turns, a lone unmatched dragon can't -- and a herd of LV 10
  elders would walk every road; harder roads (a baddie with more puff on later days, a second baddie) are not built.
  Whether the player should be able to choose the baddie's target, or a pair's move order, is open too: the quicker
  moves first, as in the Arena.
- **Three Hearth Kitchens.** The barn capacity work read "each need is met in its own room" (the Decisions) as one
  room *kind* per need, and repeated the rooms on the floors so the barn serves twelve (4.7): does a barn of three
  Hearth Kitchens read as filler to the player, though each copy is used (3)? And with the start's seven the Dragon Lift
  is nearly idle (1 to 4 rides in 30 minutes) and the hayloft's rooms nearly empty until the herd passes about ten:
  its regular riders are the hayloft's overflow, Rushes, elders leaving and the mission teams.

## 10. The Arena

Asked after the issues: "Similar to Pokémon we should be able to train dragons with one another a they will gain
skills and level up. These fights should happen in an arena." Two of the barn's dragons spar on the roof, turn by turn,
a Pokémon battle kept cozy (B8, B9): every move is one of the dragon's own anims, the seven elements beat one another
round a ring, and both come home with XP -- levels, and at some levels a new skill. Built: `src/game/training.ts` (the
rules), `arena.ts` (a bout in the simulation), `arenaui.ts` (its screens), the Arena drawn by `building.ts`; checked by
`npm run sim` section 27 and the smoke's Arena cases (10.6).

![The Arena on the roof, the bout preset at its move menu (view=base&preset=bout&panel=bout&t=90): EMBER, the player's, at LV 3 in the blue west corner and BRAMBLE at LV 2 in the red east one, the bunting between the flag poles, each fighter's plate, the bout's line, and EMBER's three skills -- FIRE BREATH strong on BRAMBLE, PREEN and YAWN -- with AUTO and BACK TO BARN](base/arena_bout.png)

**10.1 The place.** The Arena is the roof deck east of the Dragon Lift's head: floor 5 (feet at y 136), x 648 to 1184,
the Aerie deck's other side -- the Aerie's teams walk off the car west, a bout's two east. A straw deck on two trestles
down to the roof's east slope and a knee brace to the right tower, railing posts, a flag pole at each end with a
pennant in its corner's colour (blue `#5aa0c8` the west, red `#e0664a` the east) and bunting between their tops; its
plate, ARENA, at the east end. It is a structure (3's table): named for a real purpose and proven used (#11: a bout's
two facing each other in their corners count a use). The dragons' net on floor 5 runs from the sky bridge to the
Arena's east end; no keeper goes up there. **The corners:** each fighter stands with its snout 20 px short of the
ring's middle (x 916), the two snouts 40 px apart (`ARENA_GAP`), the west corner facing east and the east facing west
(`layout.ts` `arenaSpot`: an adult's root at x 845 and 987). 40 px keeps every drawn move clear of the other's eye (the
sparring audit: 10.6).

**10.2 Who may spar.** Any two of the barn's dragons but a baby, a garden resident (or an elder walking out to the
garden) and one with a mission's team (mustering, away or landing); and not one with a need at its yellow bubble or
lower (under 0.25: it goes to its keeper first) -- the chooser greys it with the need's word: HUNGRY, SLEEPY, BORED,
GRUBBY or LONELY. One bout at a time: START is refused while one is on (A BOUT IS ON) and while its two walk home (THE
LAST PAIR IS WALKING HOME). A dragon being met, asleep or holding still for its grow-up's cheer may be picked: the bout
waits for it, as a muster does (5.2), and a mission can't take a dragon in a bout (the chooser says SPARRING).

**10.3 A bout** (`arena.ts`; its state is in the save and the hook):
- **Muster.** START BOUT (a `bout` command: `control.ts`) drops the two dragons' jobs -- a keeper at work finishes, a
  sleeper sleeps on, and each keeps its slot until it sets off -- and their goal is the bout: they ask for nothing, and
  their needs wait, as a team's do away (a job or a nap under way runs on to its end). Each rides the Dragon Lift up at
  the car's first priority, as a mission's team does, and walks off it east; the first up takes the east corner, so the
  second never walks through it, and each turns to face the other.
- **Face** (1 s). Both in their corners: the Arena is used, and the bout's line says `EMBER (LV 1) AND BRAMBLE (LV 1)
  FACE EACH OTHER`.
- **Pick.** The player picks its dragon's move from the move menu -- or its coach does: with AUTO on, or once the pick
  has waited 5 s (`PICK_WAIT`; the view makes the world wait while the menu is up, so it runs out only with the bout
  left on from the barn). The partner's coach picks its own every turn.
- **Play.** The quicker moves first (the higher SPEED, with its stage; the player's dragon on a tie). Each move is its
  dragon's own anim played through while the simulation holds both still, and lands at its impact, a share of the
  anim (the breath's stream at its full reach, 0.45; the preen's flourish, 0.3; the yawn's peak and the show-off's
  middle, 0.5): the other's puff goes down, or a stat's stage moves, and the line says so -- `EMBER'S FIRE BREATH:
  BRAMBLE -12 PUFF, A STRONG ONE!`, `... BRAMBLE DODGES!`, `EMBER PREENS: GUARD UP`, `EMBER YAWNS AND BRAMBLE CATCHES
  IT: POWER DOWN`. The one a move lands on shows a face for 0.6 s -- surprised at a cost, happy at a dodge, sleepy
  catching a yawn -- and never a hurt pose (B8). A breath of 0.4 s between moves (`MOVE_GAP`).
- **Over.** A dragon out of puff has had its bout; after 12 turns (`MAX_TURNS`) it goes to the one with more of its puff
  left, as a share of its whole, or is a draw. Both get XP (10.4) and a level's new skills; both are tired and hungry
  (food and sleep at most 0.6: a burst of bubbles back in the barn); the one out of puff lies down, naps 2.5 s and
  wakes, and the winner preens (a draw: both).
- **Home.** The west corner sets off first for the nearest free slot of its size, the east one 2.5 s later (so the two
  never walk nose into head), their lift calls still at the car's first priority; the bout is over once both are off
  the Arena's deck, and their needs take over again.

**10.4 The rules** (`training.ts`, plain data and pure functions: a bout's rolls are the Arena's own stateless draws,
`rngAt(seed, BOUT, bout, turn, move)`, so a bout is the same every time from the same world).
- **Stats:** PUFF (how long it keeps going), POWER, GUARD and SPEED (who moves first), each element's at LV 1 as an
  adult from its character (ART_BIBLE section 3). Each is worth about the same in a bout (10.6's balance).

  | Element | PUFF | POWER | GUARD | SPEED | |
  |---|---|---|---|---|---|
  | fire | 40 | 14 | 10 | 11 | the show-off hits hardest |
  | spike | 42 | 11 | 12 | 9 | prickly to wear down |
  | rock | 46 | 10 | 13 | 5 | a slow boulder |
  | lightning | 40 | 13 | 10 | 15 | the quickest |
  | water | 42 | 12 | 11 | 10 | steady |
  | slinkwing | 42 | 13 | 10 | 13 | quick |
  | dusk | 44 | 11 | 12 | 8 | calm |

  Each level adds 5 PUFF, 1.5 POWER, 1.5 GUARD and 1 SPEED (rounded: a LV 10 adult fire has 85, 28, 24 and 20). The
  young spar at 0.85 (a teen's SPEED at 1.05); the elder is never weaker (D21) but steadier: GUARD x 1.15, SPEED x 0.9.
  A dragon in good spirits (mood 0.5 or more: no need asking yet) hits 10 % harder, a low one (a need at its yellow
  bubble) 10 % softer: care is how a dragon trains well.
- **The ring:** each element's element moves are strong (x 1.5) on the next and weak (x 2/3) on the one before it --
  water douses fire, fire singes brambles, roots crack rock, rock grounds lightning, a flash dazzles night eyes
  (slinkwing), echoes find their way in the dusk, and the moon-lamp pulls the tide -- one strong, one weak and five
  even for every element.
- **Skills**, each one of the dragon's own anims (ART_BIBLE 4.2 and section 3), learned by level, four at most, in the
  move menu's order:

  | Skill | Its anim | What it does | Learned |
  |---|---|---|---|
  | its breath: FIRE BREATH, QUILL VOLLEY, GRAVEL ROAR, SPARK BOLT, BUBBLE JET, SHRIEK, NIGHTFALL | `breath` | an element move: power 10, 95 % sure | LV 1 |
  | PREEN | `happy` | its own GUARD up a stage | LV 1 |
  | YAWN | `yawn` | the other's POWER down a stage (a yawn is catching) | LV 2 |
  | its show-off: TAIL CHASE, QUILL GROOM, SUNBATHE, ZOOMIES, BIG SHAKE, ECHO PING, LAMP BAT | its idle trick, `fidget` | a plain move, never weak: power 8, always lands | LV 4 |
  | its big breath: BLAZE, QUILL STORM, BOULDER ROAR, THUNDERBOLT, TIDAL JET, ECHO SHRIEK, DEEP NIGHTFALL | `breath` | in the breath's place: power 15, 85 % sure | LV 7 |

  A stat's stage runs -2 to +2: +1 x 5/4, +2 x 3/2, -1 x 4/5, -2 x 2/3.
- **A move's cost:** an attack costs the other its power x (my POWER / its GUARD, each with its stage) x the ring's
  weight (an element move only) x 0.75 x 85 to 100 % (a roll), at least 1 when it lands; a roll over its sureness is a
  dodge. A status skill always lands, moving its stage unless the stage is already at its limit.
- **The coach** (the partner's picks, and the player's with AUTO): a yawn early on while the other's POWER can still go
  down (about one turn in seven, the first three turns), a preen while it is fresh and its GUARD can still go up (about
  one in seven), and otherwise the attack that costs the other most on average.
- **XP and levels:** LV 1 to 10, LV L at 10 L (L - 1) XP in all (20 for LV 2, 60 for LV 3 ... 900 for LV 10). A bout
  brings the winner 10 x the other's level + 20 and the other 5 x the winner's level + 10; a draw brings each 5 x the
  other's level + 15. Sparring a higher level is how the young catch up: a LV 1 sparring a LV 10 is LV 3 after one
  bout, however it goes. A dragon's XP (`Dragon.xp`) is all the save keeps: its level, stats and skills follow from it.

**10.5 On screen** (`arenaui.ts`, `base.ts`).
- **ARENA** in the top bar (x 486), **B**, or a tap on the Arena's deck eases the camera to the Arena (the ring's middle
  at the screen's, the roof at the top) and opens **the chooser** -- or, a bout on, the bout. The world waits while the
  chooser is open, as under the Map Room's table. On it: the two corners' cards (YOUR DRAGON - YOU PICK ITS MOVES;
  SPARRING PARTNER - ITS COACH PICKS: the dragon's name, element, stage and level, its XP to the next level, its stats
  with its spirits on its power, the skills it knows and the next it learns, what it is strong and weak against; a
  tap empties it), the matchup (how each one's breath lands on the other, and why) and the XP a win or a loss would
  bring each; the dragons (a tap puts one in the first empty corner, or takes it out; one that can't spar greyed with
  why), SWAP, START BOUT (greyed with why not) and BACK.
- **The bout**, watched over the world: a plate under each fighter in its corner's colour (its name and level -- once
  decided its new one, lit if it went up -- YOU on the player's, its puff as a bar, its stages), the bout's latest
  line, and by its state the move menu (`WHAT WILL EMBER DO?  (TURN 2)` and a button for each skill it knows: its
  name, what it is, and how it lands on this partner -- STRONG ON BRAMBLE!, WEAK ON BRAMBLE, EVEN ON BRAMBLE; a status
  skill says what it does), THE COACH PICKS YOUR MOVES with AUTO on, or the result card (who won, each one's XP and
  what it brought, `NOBODY IS HURT: BRAMBLE NAPS IT OFF.`; a tap closes it); AUTO and BACK TO BARN. As a move lands a
  popup rises over the head it landed on (-12 with STRONG! or WEAK under it, DODGED!, POWER DOWN; GUARD UP over the
  one preening), never over an eye. **The world waits for the player's pick** while its menu is up (the one choice a
  bout asks for) and steps on otherwise, the moves at the game's speed. BACK TO BARN leaves the bout on: the coach
  picks once a pick has waited 5 s. A fighter plays no idle variant while its bout is on (a yawn between two moves
  would read as the YAWN skill).
- **The bout's chip** (274, 19, 114 x 15, left of the TEAM OUT chip) while a bout is on and the barn is on screen:
  BOUT: ON THE WAY, BOUT: YOUR PICK! (lit), BOUT: TURN n, then EMBER WINS or BOUT: A DRAW; a tap opens the bout.
- **Toasts:** the two heading up (`EMBER AND BRAMBLE HEAD UP TO THE ARENA`) or why not (`BRAMBLE IS SLEEPY`); then, as
  life's news, `EMBER WINS THE BOUT! +30 XP` (or `A DRAW: ...`) and `EMBER IS LEVEL 2! NEW SKILL: YAWN`. The dragon card
  shows its level beside its element, and the hint says TAP ARENA: TWO DRAGONS SPAR AND LEVEL UP while no bout is on.
- `panel=arena` and `panel=bout` open them at the first frame (the camera already on the Arena); `preset=bout` begins a
  bout at once, EMBER (LV 3, the player's) and BRAMBLE (LV 2) in their corners (`view=base&preset=bout&panel=bout&t=90`
  is the move menu frozen).

**10.6 Saves and checks.** The save keeps each dragon's XP and the Arena (the bout on, its fighters by dragon id, and
the bouts begun): version 10, a version 9 save brought up to it as it loads (7). `npm run sim` section 27 checks the
rules (the ring, the levels, the XP, the skills and their anims, the stats, the corners), the balance (10.4's numbers
over every pairing of the start's seven: each element wins 35 to 65 % of its bouts, 4.5 to 8 turns on average; a
level up beats its own element, three up the element strong on it), a whole bout in the world under section 2's
invariants (begun while a keeper is at work with one of the two and the other sleeps), who may spar, the bout preset,
saves taken at every state, the version 9 migration and 15 bouts a build can't run, and that no bout's line nor the
Arena's text has a word of harm but NOBODY IS HURT (8 has the numbers). The smoke's sparring audit (`view=arenaaudit`)
plays every sparring skill of the 21 looks that spar (seven elements, young to elder) in the west corner against every
look in the east, frame by frame with its effects, and fails any frame where one covers the other's eye, or the other
its own (ART_BIBLE 1.4); the preen, a winner's, against the loser's nap too. And the smoke drives the chooser, the
move menu and a whole bout live (10.5), and loads a version 9 save in the browser.

---

## 11. Encounters on the road

Asked after the Arena: "The adventure mode is a little lackluster right now. The things you encounter appear pretty
underwhelming and it's not interactive. I think we should change it so when you encounter a challenge you need to use
special abilities from your dragons to overcome them. Also when we encounter enemies we need to 'fight them' -- the
mechanics should be kinda similar to the battle arena ... It would be fine if we swapped into another mode to 'deal'
with an encounter. I do want some of the challenges to be environmental which they are right now." So the road is
played: a trip walks its road in the world's own steps and halts at each stop for its **encounter** -- an obstacle
(the challenges of 5.3, the land's and the people's, kept) that the dragons' abilities overcome, or, at a hard road's
end, a fight with the region's big baddie by the Arena's own rules (10.4), kept cozy (B8). The encounter's screen is the
watchable scene itself (6), with the team's plates and the ability menu in the sky over the road; the world waits for
your pick there, as it does in the Arena, and the trail coach plays for a team you leave to it. Asked again after that
("the encounters ... should be more exciting ... the dark cave should have you go through a cave after it ... the
encounters for them should be a little more like skill checks and less like combat encounters"): an obstacle is now a
**skill check** -- a mark to beat, each dragon's move a try at it, a roll of a d20 plus its bonus, passed or fallen
short, with the chance on the menu (11.3) -- not a bar of work worn down like a baddie's puff; and every land stop
opens onto a **passage** the team walks through after it (the cave after the dark, the canyon after the gap, the
bramble tunnel after the thorns...: 6). Built:
`src/game/encounter.ts` (the rules, and the encounter stepped in the simulation), `trip.ts` (the trip's shape),
`missions.ts` (the road walked, the forecast, the landing), `encounterui.ts` (the plates, the menu, the popups),
`missionview.ts` (the scene), `passages.ts` (the passages); checked by `npm run sim` sections 18, 20 to 24, 26 and 28
and the smoke's trip cases.

**11.1 The shape.** A trip's walk is its mission's days (1, 2 or 3 game days: `travel` steps), counted in `walked`;
reaching stop j's step (`stopStart`: its `at` of the travel, 5.5) the team halts, the walk waits, and the stop's
encounter runs meet, pick, play and done: the **meet** (an obstacle: 60 steps, the banner names it -- `SPRING FLOOD
AHEAD: BEAT 22 TO GET ACROSS`; a baddie: 160 steps, it walks in from the right, grumpy -- `THE MOLE KING! 96 PUFF TO
WEAR IT OUT`), then **turns** (an obstacle's are its **tries**, three at most): the picks (one a pair) wait, the turn's
moves play one after another, each its dragon's own anim landing at its impact (10.4) with 24 steps between, and the
turn ends with the stop cleared, waited out, or
another turn; **done**, an obstacle's beat is 90 steps (the set piece shows the challenge met) and a baddie's exit
360, then the trip walks on. A stop takes the same steps whether or not anyone watches: the encounter is stepped by the
simulation (`missions.ts` stepAway, `encounter.ts` stepEncounter), saved with the trip (`Trip.encounter`, plain data,
every reference an index), and every roll is a stateless `rngAt(seed, TRIP, mission, stop, turn, k)`, so a save loaded
mid-move steps on to the very world it was taken from (sim-check 28). The outcome is the road's: every stop cleared
is HOME SAFE!, any stop waited out NOT THIS TIME (5.5), told only at the landing.

**11.2 The abilities.** Each turn every pair picks one of:
- its dragon's **Arena skills** known at its level (10.4): its breath, its big breath, its show-off, PREEN and YAWN
  (the two status skills in a fight only: at an obstacle there is nobody to catch a yawn);
- **REST**, a breather: +8 puff, the dragon sits (`beg`);
- once a stop, its **rider's special** (SPECIAL), where the rider's skill is the stop's counter (5.3): BEA's CHARM at
  the grumpy miller, TOMAS's MEDIC at the hurt animal, IRIS's NAVIGATOR in the fog, PIP's NIMBLE at the gap; and in a
  fight, the baddie's counter skill.

The menu says what each is (at an obstacle `ROLL + 20`, the try's bonus; in a fight `POWER 10 - 95 %`; `A BREATHER`,
`ONCE A STOP`) and how it lands here -- at an obstacle its chance and why (`95 %: STRONG ON THE FLOOD!`, `55 %:
HELPS`, `5 %: HELPS A LITTLE`, `70 %: CHARMS THE MILLER`), in a fight its weight on the cost -- which is its **weight**
on the try's bonus or on the cost:

| At an obstacle | Weight (on the bonus) | In a fight | Weight (on the cost) |
|---|---|---|---|
| the counter element's breath (water at the flood) | STRONG ×2 | the counter element's breath (dusk on the Mole King) | STRONG ×1.5 (the ring's, 10.4) |
| another element's breath on a land stop | HELPS ×1 | any other breath | EVEN ×1 |
| a breath at the miller or the hurt animal | HELPS A LITTLE ×0.4 | a show-off | NEVER WEAK ×1 |
| a show-off on a land stop | HELPS A LITTLE ×0.4 | PREEN | its GUARD up a stage |
| a show-off at the miller or the hurt animal | CHARMS ×1.5 | YAWN | the baddie's POWER down a stage |
| the rider's special | clears it outright, no roll | the rider's special | a quarter of the baddie's whole puff, and its POWER down a stage |

A dragon out of puff sits the rest of the stop out (its pick is `sit`, it does nothing); a pair's pick is refused for a
pair there isn't, an ability the pair hasn't got here, or once its pick is made (`control.ts`: the `ability` command).

**11.3 An obstacle is a skill check.** It has a **mark** to beat, by the road's difficulty: 22 easy, 25 normal, 28
hard (the stop's plate shows `BEAT 22` and `TRY 1/3`, its tries left as a bar; the menu's corner says `BEAT 22 TO GET
ACROSS`). A dragon's move is a **try**: it rolls a d20 (1 to 20) and adds its **bonus** = round(the skill's power ×
(the dragon's POWER at its stage / 12) × the weight), at least 1; a score at the mark or over **passes** and clears the
stop then and there (the moves after it are dropped), a lower one **falls short**; a 20 always passes and a 1 never
does, so no try is surer than 95 % or worse than 5 %. The menu tells each try's chance before you pick, and the line
tells the sum (`RIPPLE'S BUBBLE JET: 14 + 20 = 34 BEATS 22!`, `EMBER'S FIRE BREATH: 6 + 13 = 19 FALLS SHORT OF 22`, `A
TWENTY! WICK'S NIGHTFALL CLEARS IT: 20 + 11 = 31`, `A ONE... ECHO'S SHRIEK FALLS SHORT: 1 + 11 = 12`), the popup over
the set piece PASSED! or NOT QUITE with the score against the mark. A young adult's breath STRONG on its stop (a bonus
of about 20) passes an easy check 95 times in 100 and a hard one 75; one that merely helps (about 12) passes an easy
one 55 times in 100 and a hard one 25 on its first try; a breath at the miller or the bird (about 5) is a long shot,
which is what the rider's special is for. The rider's special clears the stop outright, no roll (`BEA TALKS HIM
ROUND!`). Every turn the obstacle still stands, it **bites**: 3 puff off every dragon with puff left, and, with a try
still to come, the **mark eases** by 4 -- the team gets its measure (`THE FLOOD SOAKS THE TEAM: -3 PUFF EACH. THE
MARK EASES TO 18`, `THE COLD BITES`, `THE MILLER GRUMBLES ON`): a helper's 25 % at a hard mark is 45 % on its second
try and 65 % on its third. Cleared, its line is the counter's move's (`SPRING FLOOD - RIPPLE SWIMS THEM ACROSS`), the
rider's (`GRUMPY MILLER - BEA TALKS HIM ROUND`) or the plain one (`SPRING FLOOD - THE WATER GOES DOWN`, `THE COLD -
THE COLD IS SEEN OFF`); **waited out** (`... - THE TEAM WAITS IT OUT`) when every dragon is out of puff, or after 3
tries. The check is the road's own roll: a team the forecast (11.7) clears every stop for can still fall short on the
day, and come home NOT THIS TIME -- that is the skill check's tension, and the counters are how you shorten the odds.

**11.4 A fight** is a bout against the baddie: its stats (THE MOLE KING 96 puff, POWER 12, GUARD 12, SPEED 6; THE
STORM ROC 88, 13, 10, 16 -- quick and light; THE FROST GIANT 104, 14, 13, 4 -- slow and stout), its puff on its plate
with its stages. The team's moves cost it puff by the Arena's own cost (10.4: the skill's power × the mover's POWER
over its GUARD, each at its stage, × the weight × 0.75 × 0.85 to 1); its coach picks one move a turn -- an **attack**
(power 12, lands 90 %: DIRT FLING, GALE FLAP, SNOW STAMP; it stomps in place, and the dragon it lands on loses puff or
DODGES!, grinning), a **grumble** in the first three turns (one roll in four: GRUMBLE, SCREECH, COLD SIGH -- that
dragon's POWER down a stage) or a **rest** when it is under 35 % of its puff (three rolls in ten: SNUFFLE, PREEN,
SHAKE OFF: +10) -- at a dragon with puff left, the quicker moving first (SPEED: the Roc before every dragon, the Giant
after; a pair before the baddie on a tie). Won when the baddie is out of puff (`THE MOLE KING - WORN OUT: IT CURLS UP
AND DOZES`); otherwise -- every dragon out of puff, or 12 turns -- the team sits down for a breather and it leaves all
the same (`THE MOLE KING - THE TEAM SITS DOWN FOR A BREATHER, BUT IT CURLS UP AND DOZES`): either way it takes its
cozy exit (6) and the team walks on. Nobody is hurt: the cost is puff, the reaction a face and a popup (B8).

**11.5 Puff, stats and XP.** Each pair's dragon goes with its Arena stats at its stage and level (10.4) and its spirits
on its POWER (a happy dragon works harder: `tripStats`) and 5 % more of it beside its partner (5.2), fixed at the send
and kept in the trip; its **puff** is carried
along the whole road (a hard fight at the end of a tiring road), with a rest of 30 % of its whole puff on the walk to
each stop; PREEN's and YAWN's stages last the stop. Every stop brings **XP** to each pair's dragon: 15 for an obstacle
cleared and 5 for one waited out, 40 for a baddie worn out and 15 for one sat out; a level and the skill it teaches
come on the road as in the Arena (the toast `RIPPLE IS LEVEL 2! NEW SKILL: YAWN`, the `level` and `learn` events),
and the result card totals the road's XP.

**11.6 Playing it.** The game follows the team (6), so at a stop its road is already on screen: the pairs' plates and
the stop's, the menu for the pair whose pick waits (`WHAT WILL RIPPLE DO?  (TRY 2 OF 3)`; a fight's `(TURN 2)`; a row an
ability, a tap picks it; then the next pair's), the moves played where the team stands, the popups over the heads, and the AUTO button
beside TRIP LOG; at the stop's end a toast says `SPRING FLOOD CLEARED! +15 XP EACH` (`THE MOLE KING IS WORN OUT!`).
**The world waits for your pick** while a pick is yours to make (the road's one choice, as the Arena's bout waits for
its pick; `base.ts` worldWaits), and steps on otherwise; the Map Room's table opened over the road makes it wait too.
AUTO (the `trail` command) hands every pick to the **trail coach** at once, and the menu's place says THE TRAIL COACH
PICKS: TAP AUTO TO PICK YOURSELF. The simulation never knows whether it is watched, so in a world nobody watches (the
checks' headless runs) a pick waits PICK_WAIT_TRAIL (450 steps, 7.5 s at 1x) and then the coach takes every pick still
missing: a road always plays out. The coach picks (`encounter.ts` coachPick) the rider's special whenever it is to be
had; a REST when low (under a fifth of its puff at an obstacle, under three tenths in a fight, two rolls in five); in a
fight a YAWN in the first three turns while the baddie's POWER can still go down and a PREEN while over 60 % puff
(about one roll in seven each); else, in a fight, the move that does most on average (its power × its chance × its
weight), and at an obstacle the try with the best chance.

**11.7 The forecast** is the coach's dry run of the road (5.4: every roll even, `evenRoll` -- every try rolls an 11 --
the coach picking every move, the baddie's coach at the dragon with the most puff): the chooser's FORECAST line and
bar, and BEST TEAM's ranking. It is the median road, not a promise: a 100 % team can still take a try longer, or fall
short of a check, on the road's own rolls (11.3).

**11.8 Saves and checks.** The save keeps the trip's shape (trip.ts: the walk, the stats, the puff, the XP, AUTO, the
encounter with its turn, picks, moves and lines; an obstacle's mark as the stop began and as it stands): version 12; a
version 11 save's encounter at an obstacle (work ground down of a toughness) gets its mark in the work's place as it
loads (`encounter.ts` upgradeEncounterV11: the difficulty's mark, eased by the turns played, the check rolled afresh
from there), a version 10 save's trip (a timer, its odds and its outcome rolled at the send) is brought up
(`missions.ts` upgradeMissions: its walk from its clocks, the stops it had passed resolved as their coverage said,
full of puff, no XP, the coach off, a landed one with its outcome), and a version 9 save comes up through 10 and 11.
`checkMissions` and `checkEncounter` throw on a trip or an encounter this build can't run (a stop off the road, a
pick short, a mark over its start, a roll past the d20, a baddie over its whole puff, a move by a pair there isn't, a
stage past +2...). `npm run sim` checks the forecast (18), a full trip with its stops played (20), a failure that
walks on (21), the road the seed's (22), care with a team away (23), the scene at every step of six roads and the
passages walked whole on a long one (24), the cap beside a played road (26) and the encounters themselves (28: the
offers with their chances, the d20's rules, the checks by the rules alone, the balance, a road by commands, its
saves, no word of harm); the smoke reads the fight's menu frozen, the failing road beside the succeeding one, both
result cards, plays a fight live on the road the game follows (the pick waited for, the row tapped, AUTO, the exit,
the road still on screen), draws every passage on the mission art kit's sheet, and loads a version 9 save in the
browser. 8's paragraph has the numbers.
