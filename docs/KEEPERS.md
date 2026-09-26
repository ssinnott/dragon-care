# Dragon Care: The Keepers

**What this covers.** The people who look after the dragons: who they are and how they are drawn, how they move, the
care acts they perform with a dragon, and the yard where they do it on their own. The dragons are the art bible's
(`docs/ART_BIBLE.md`, "the bible" below); this document adds the keepers to them and changes nothing about the dragons
except what the keepers need from them (four small read-only helpers in `src/care/dragon.ts`).

| Request | Where it lives |
|---|---|
| "extend the game to include some human characters which help to take care of the dragons" | Four keepers with one job each (section 2), drawn on the engine's humanoid rig in the dragons' house style (1, 3, 4) with their own animation set (5). Three care acts, **feed**, **pet** (a **groom** when the groomer does it) and **tuck-in**, choreographed with the dragons' own anims (6). **The yard** (7), where the dragons' hunger, loneliness and sleepiness rise and show, and a director sends the keeper whose job it is. Checked like the dragons are (8). |

**Choices to confirm.** These were decided without asking, and are the ones most worth a second look:

1. **The cast** (2): Bea the cook (an elder), Tomas the groomer, Iris the night keeper and Pip the apprentice (a
   child). Their names, jobs, ages and looks.
2. **No shared uniform** (K10): the first draft gave every keeper a neckerchief in one colour so they read as a team;
   no single colour cleared all four skin tones by value, so it was dropped.
3. **Where a hand goes** (K8): grown dragons are stroked on the back of the head, the neck or the back; babies are
   patted on the back or the rump and sleepy dragons stroked on the back, never the head. At this size a dragon's eye
   is most of the side of its head and a keeper's hand is 8 to 10 px: there is no room for a head pat that keeps off
   the eye.
4. **The pace** (7): needs fill in 36 to 88 s, a feed takes 20 to 40 s from the kitchen and back, and the yard is
   never idle for long. The numbers are one table (`FILL_S`) if it should be calmer or busier.

**Status. Built:** the four keepers (`src/art/keeper/`), the care acts and the agents they drive
(`src/care/acts.ts`, `keeper.ts`, `dragon.ts`), the planned walks (`src/care/path.ts`), the yard
(`src/care/yard.ts`), and the gallery views `keepers`, `care`, `careaudit`, `yard` and `yardaudit`. `npm run check`
runs the keeper palette gates (172 of 172 pass since the mission road, S9: counted apart from the dragons' 2492) and eight new smoke cases, the
care audits among them (every act on all 28 looks: 112 runs; the same mirrored on two elements: 32; and every act
the yard plays in two and a half minutes, walks included). `npm run shots` renders the keeper sheets. The
yard also brings the game side of one care hook: **dusk's `tuckin` is played on a tuck-in** (the bible's status noted
that nothing did). **Also built:** **the base** (`view=base`, and the game's default page: `docs/BASE_DESIGN.md`)
draws its keepers as this cast too (`src/game/people.ts`), each in the anim closest to its job (walking, carrying,
`watch`, `kneelIdle`, `pet`) while sim.ts's own care simulation walks it along the barn's routes and decides what job
it is doing; the anim plays with its root motion pinned (`KeeperAgent.pinX`), since the base already moves the keeper
itself, and a walk or carry plays at the keeper's pace over the look's own walk speed (`KeeperPlayer.setSpeed`: Bea's
0.55 px a frame walk at 1.82x for the base's 1 px, 1.6x that on a Rush), so the feet no longer skate. A keeper who
reaches the stand spot before the dragon stands in `watch` until it walks in, and one held at the Dragon Lift's bay
stands in `idle`. This is a plainer join than the yard's: it skips the plan (6.3), so a base keeper's stand and stroke are not
proven eye-clear or on the mark the way the yard's and the two audits' are. **Not built:** a player-facing game loop
for the yard itself (it still runs on its own: nothing lets a player send one of these keepers to a dragon from it),
props for the keepers' stations, keepers in the habitat view, and night: Iris tucks in whoever is sleepy.
A plan (6.3) is made the first time a keeper does a job for a look, in the tick the job starts (tens of ms; a game
would make them while it loads).

---

## Decisions

| # | Decision | Why |
|---|---|---|
| K1 | The keepers are the **engine's humanoid rig** (`src/lib/art/rig.ts`, the sibling games' people), never a new rig, and the vendored engine is **not edited** (bible 1.1). What a keeper needs beyond it lives in `src/art/keeper/`: part hooks, a two-bone IK, a stepper that steps the chains without drawing, a player with blends and blinks. | One house style for people across the games, and the engine's shading gates for free. |
| K2 | **Four keepers, one job each**, told apart by one shape in one place, as the dragons are (bible D1): the head's silhouette and what is in the hands. A bun and a bowl (Bea), a wide brim and a brush (Tomas), a floppy cap with a ball on its tip (Iris), a small body under spiky tufts (Pip). | At the ÷ 3 size a keeper must read without its colours. |
| K3 | **People in the dragons' house style**: the 1 px `#1a1018` ink, cel bands lit from the top-left, the mark floor (bible 5.2). Faces are never angry (the dragons' D18): the keepers' face set is neutral, smile, happy, closed, oh, aww, shh and hush (the shh's face without the finger, for the tiptoe after it). The elder keeper follows the elder dragons' rule (D21): unhurried, never frail; no stoop, no cane. | A cozy game; the elder is drawn as a reward, not decline, for people too. |
| K4 | **Scale**: the engine's default adult, about 78 px tall at scale 1 (Bea shorter and rounder, Tomas broad, Iris slight); Pip a child of about 58 px whose head is as big as an adult's (a child reads by the head's share of the height, as a baby dragon does: bible 2.6). | Keepers as tall as a grown dragon is long: the dragons stay the stars. |
| K5 | **The dragons answer with their own anims** (beg, walk, eat, happy, pet, sleep and dusk's tuck-in, wake); the care acts add none. The acts hold a dragon to its plain idle while a keeper works with it (no idle variants: a look-around turned the head under a keeper's arm). | Bible 4.2's set is the dragons' vocabulary; the keepers fit round it. |
| K6 | **IK for feet and hands** (`ik.ts`). Feet are authored as floor targets and solved at bake time, so a keeper's planted foot never skates (the dragons' planted-paw rule, bible 1.1, on two legs); a reaching hand is solved every tick toward a moving mark (a dragon's head leans into the hand in its pet loop). | FK alone skated the walk and missed the head. |
| K7 | **A keeper at work never covers the dragon's eye, and its hand lands on its mark** (within 2.5 px). The bible's hard rule, "nothing covers the eye" (1.4, 5.1 #11), holds for a keeper too. Where a keeper stands, whether it kneels and where its hand goes are planned before it walks over, from dry runs of its own poses against the dragon's eye as the dragon will be posed at every point of the act (6.3); two audits check it frame by frame (8). | A keeper's arm over a dragon's face was the first thing the first staging did. |
| K8 | **The mark adapts** to the look, in order: the back of the crown, the same arc slid back, the top of the neck, lower down it, the back. A baby is patted on its **back or rump**; a tuck-in strokes the **back** of a dragon lying down. | The eye box is most of the side of a baby's head, and of a head laid on the floor: no arc of a baby's head kept a hand off its eye on any look. |
| K9 | **Staging**: a feed is **front on** (the bowl goes in front of the dragon; the dragon walks up to it, eats, turns and trots off before the keeper takes the bowl away); a pet, a groom and a tuck-in are **from the side**, the way a person pets a pony: at the dragon's shoulder, a step nearer the camera (9 px in front of its floor line, just outside its footprint), facing the way it faces, kneeling on both knees for a small or a lying dragon. | Front on, a keeper kneeling at a bowl under a dragon's nose covered its face; from the side the keeper's body is over the dragon's body, away from its face. |
| K10 | **No shared uniform.** A neckerchief in one colour on all four was measured against their skins (Bea's warm mid-brown, Tomas's light, Iris's deep, Pip's light) and no colour cleared all four by the ladder. | The palette check decides, not taste. |
| K11 | **The yard**: needs rise and show (7.1); a director sends the keeper whose job it is to the neediest dragon (7.2); keepers wait at stations along the back of the yard, and every walk is **planned** round the dragons' bodies and off their eyes (6.2), along the floor and across it on the diagonal. | A living scene, with nothing in it the player has to run. A keeper walking straight across it passed over other dragons' faces. |
| K12 | **Deterministic**: everything is seeded and stepped at 60 Hz, so the gallery's frozen `t` is always the same frame (the tools/shot.ts contract). A plan is computed once per keeper, act and look and cached. | The pipeline's screenshots and audits depend on it. |

---

## 1. Scale and style

The keepers share the dragons' 640 × 360 screen and floor (`#e0d6b8` straw), their ink, light and cel banding, and
their ground shadow (the ink at alpha 0.28, `KEEPER_SHARED.groundShadow`). A keeper is drawn y-sorted with the dragons
by the feet; on the same floor line a dragon (and its bowl) goes first. The engine draws the far arm and leg darkened
(`farPalette`), at the engine's 0.62 but with half its desaturation (`KEEPER_FAR`: 0.12), because at 0.25 a far hand
in light skin went grey-brown and read as a stain on the trousers.

## 2. The cast

`src/art/keeper/cast.ts`. Tempo multiplies every anim's durations (the dragons' 4.1 stage timing, on people); speed is
the walk's px per frame.

| Keeper | Job | Build | Tells | Tempo, speed |
|---|---|---|---|---|
| **Bea**, the cook | feeds (she brings the bowl from her kitchen) | an elder: shorter and rounder | silver bun, terracotta blouse, cream apron, plum skirt | 1.2, 0.55 |
| **Tomas**, the groomer | grooms the young and grown dragons (a pet, with his brush) | broad | straw hat with an oxblood band, dark beard, denim shirt, braces | 1, 0.7 |
| **Iris**, the night keeper | tucks in the sleepy | slight | periwinkle nightcap with a cream pom-pom, a bob, a mauve cardigan, rose slippers | 1.1, 0.6 |
| **Pip**, the apprentice | pets the babies, and cheers the others on | a child, about 58 px | ginger tufts, leaf-green tee, denim overalls, red sneakers | 0.8, 0.75 |

## 3. Colour

`src/art/keeper/palettes.ts`: one palette per keeper in the engine's slot names (`skin`, `hair`, `primary` for the
top, `secondary` for the trousers or skirt, `accent`, `dark` for the shoes, `glow` for the blush) plus the keeper-only
`apron`, `hat`, `trim` and `tool`. Every hex is measured by `tools/palette-check.ts` (its KEEPERS section) with the
dragons' maths:

- **(Ka) adjacency**: every pair that touches on a keeper passes the house ladder (>= 25 % relative luminance or >= 40
  deg hue): the face on the hair and the eye whites, the top on the skin and the trousers, the trousers on the shoes,
  the apron, the hat, its band, the nightcap's pom-pom, Iris's nightshirt under her cardigan, Pip's straps, the brush
  in Tomas's hand, and the clay bowl in Bea's hands and over her blouse and apron.
- **(Kd) ramps**: every slot's shadow, base and highlight stay distinct; each keeper's **hand-set warm skin shadow**
  (`KEEPER_SKIN_SHADOW`) sits >= 25 % under its skin. The engine's `toneOf` shadow is cooler, which on skin is a
  mauve-grey that read as stubble or a smudge across the lower face; a warmer, redder step reads as a face's underside.
- **(Kc, Ke) the far side**: the far arm and leg keep >= 25 % from the near side, and >= 25 % and 6 Oklab L from the ink.
- **(Ki) the floor**: shoes and trousers keep >= 25 % from every floor they walk (the straw, the elder garden's path, and the mission road the riders walk in the watchable scene: Iris's rose slippers are the one light shoe, 40 % on all three).
- **(Kf) told apart**: the four tops pass the dragons' RULE_B pairwise, as seen and under simulated deuteranopia and
  protanopia (a player tells the keepers apart across the yard by the top first).
- **(Kg) at work**: the night keeper's trousers and cardigan pass the ladder against dusk's scale at every stage:
  kneeling at its side for its own tuck-in, her legs lie over its body.

Three colours moved to pass: **Bea's blush** (a coral one sat 8 % and 25 deg from her skin and vanished; now a
raspberry rose, `#e8508a`, 48 deg away), **Tomas's denim** (at the value of Iris's mauve cardigan the two tops
merged under deuteranopia, then protanopia; now `#3d5f94`) and **Iris's trousers** (slate, they merged into Wick's
Prussian blue as she knelt at its side; now a wine `#603444`, 36 % from it). In short (`npm run palette` prints every
pair with its numbers, after the dragons' report):

```
per keeper: 8 to 13 adjacency pairs, every slot's ramp and the skin shadow, 4 far-side colours, shoes and trousers on the floor
the four tops: 6 pairs, each as seen, under deuteranopia and under protanopia
the night keeper on dusk: trousers and cardigan, 4 stages each
KEEPERS: PASS  172 of 172 gates passed
```

## 4. The rig

`src/art/keeper/rig.ts` builds a keeper on the engine's `buildRig` (the cast's proportions, the palette, the part hooks
of `parts.ts`, the tool in the weapon slot) and adds three things: `stepKeeper`, one 60 Hz step that solves the joints
and steps the chains without drawing (the engine steps chains only inside `drawRig`; the dragons' rig does the same,
bible 1.1), so a frozen `t` can replay a scene; `drawKeeper`, the ground shadow then `drawRig` with `still`; and the
nightcap's swinging cone, a light damped chain on the head.

`parts.ts` replaces the engine's defaults where a keeper is not a soldier: the **face** (the engine's eye construction
with the keepers' warmer set, K3), the **hair** grown from the engine's cap into a style per keeper, the **hats**, the
**beard**, the **torso, hips and shoes** (a blouse and apron, a work shirt and braces, a cardigan, overalls; soft shoes
for buckled boots), the **hands**, and the **tools**: the clay bowl (the one bowl the dragons eat from,
`src/art/props.ts`, carried as a front accessory so the hands hold it rather than cover it) and Tomas's brush, held
by its back with the bristles down whatever the arm does (out of the fist along the forearm, a handle and a block
read as a knife, and a T-head as a toilet brush poking the dragon). A hand is the engine's fist but for two moments:
**stroking**, the near hand opens flat (`KeeperRig.open`; a fist folded at the keeper's own chin read as a hug, not
a stroke), a block 5 px across laid along the mark with the wrist bent (6.3), or flat on the back of Tomas's brush;
and on the **shh** one finger stays raised to the lips from a fist under the chin (the whole fist at the lips hid the
face).

## 5. Animation

`src/art/keeper/anims.ts` authors each anim as a function of the frame returning angles, or, where a limb must land
somewhere, a **target** (K6): a foot on the floor, a hand in ground space. `bake` samples it into the engine's frames
(every frame for a walk, every 2 with the engine's lerp between for the rest) and writes the root motion.
`player.ts` adds what a person needs that the engine's player lacks: a **cross-fade** on play (walk to kneel to pet
never pops) and **seeded blinks** kept on the rig, so an expression's brows and mouth stay.

| Anim | What it is |
|---|---|
| idle (150 f) | a breath, the weight shifting foot to foot, each keeper's own hands: Bea's clasped on her apron; the far hand hangs hidden behind the hips (against the thighs it read as a stain, held back as a bag on a belt) |
| walk, carry, tiptoe | a heel-toe walk, stance 60 % / swing 40 %, the stance foot planted; carry holds the bowl at the waist; tiptoe (away from a sleeping dragon) goes on the toes with the arms low for balance, eyes shut (`hush`) |
| hold, watch | standing with the bowl; standing with the hands together, the head tipped to the dragon, `aww` |
| kneel, kneelIdle, rise | down on both knees (20 f), held, and up again (a raised far knee came up to a baby's eye) |
| pet, petLow | standing or kneeling, leaning in, the near arm at rest: the care act eases it onto its mark and solves it there each tick, adding the stroke |
| setDown, pickUp | built per bowl by a feed: kneel, lower the bowl so its foot meets the floor exactly, `release`, sit back, rise (and the reverse, `grab`) |
| shh, cheer, wave | a fist up under the chin, one finger raised to the lips; a fist pumped up and forward, clear of the face, and a hop (the elder claps three times instead: D21); the near hand raised forward of the face, waving from the wrist |

## 6. The care acts

`src/care/acts.ts`. Each act is a small phase machine stepped once a tick; it reads what finished on the last tick
(the keeper's `release` and `grab` events), starts what comes next, then steps the keeper and, until the keeper walks
off, the dragon.

### 6.1 The three acts

- **Feed** (Bea). She carries a bowl the size of the dragon's (its eat spot, `bowlFor`) to a begging dragon, kneels
  and sets it down a little way out in front of it (the gap is solved, every frame of the set-down against the eye
  over the whole beg, so nothing of her covers it), steps back, and the dragon walks up to it, eats two bites and is
  happy; she cheers, the dragon turns and trots off (far enough that its whole tail clears the bowl by 10 px), and she
  comes back for the empty bowl.
- **Pet** (Pip with a baby, Bea or anyone in the gallery) and **groom** (Tomas, his brush bristles-down on the mark).
  The keeper settles into its pose, eases its hand on (open and flat, or a fist: the plan's choice), strokes four
  times while the dragon plays its pet loop, lets go, and watches (kneeling or standing) the happy that thanks it;
  then rises and goes.
- **Tuck-in** (Iris). She kneels by a sleepy dragon while it lies down (dusk plays its own `tuckin`: petted, it purrs,
  then its lamp steps down to its nightlight), strokes its back once it lies still, on until it is asleep and two slow
  strokes more; rises, puts a finger to her lips and tiptoes away, then walks.

### 6.2 Staging and walking

K9. A keeper at work stands 9 px in front of the dragon's floor line (`STAND_DEPTH`), just outside its footprint, so
a little floor shows between its knees and the dragon. Every walk to it and away is **planned** (`src/care/path.ts`),
since a keeper walking a straight line passed over dragons' heads (their eyes covered for up to 1.4 s) and through
their bodies. A* runs over the floor on a 4 px grid, where a cell is closed to the keeper's feet if

- they would stand on a dragon's **footprint**: along its length, its floor line give or take 7 px, and behind it up
  to the top of its back, where its body would hide the keeper's feet and the keeper would read as standing in it; or
- the keeper standing there, level with the dragon or in front of it (drawn over it), would be drawn over its **eye**:
  the box the eye sweeps over the dragon's current anim and the ones it may play before long (`eyeSweep`: its beg,
  its eat, a turn; both facings for a dragon turning, walking or restless), grown 4 px. Behind a dragon a keeper is
  drawn under it and covers nothing.

The keeper's size in this is measured, once, from its own walk cycles drawn off screen (the arms' swing, the
nightcap's cone, a bowl or the brush in hand). Walking into the scene costs 2.2 times walking along it (a side-on walk
cycle carries a walk along the floor; sliding up the screen reads as gliding), so a path runs along the floor and
crosses between the rows on the diagonal; it is pulled taut into straight legs no steeper than 1:1 and planned again
every 24 frames, since the dragons move. A keeper whose start or goal is closed (a dragon's head came to it; its work
spot beside a dragon) goes by the nearest open cell. Along the floor a keeper is carried by its anim's own root motion
(its planted feet hold still); into the scene it moves at the pace that arrives with it. The act gives the dragon back
as the keeper walks off, so the yard can send it home while the keeper leaves.

### 6.3 The plan (K7, K8)

Before a keeper sets off, `planSide` decides where it stands, whether it kneels and which mark it strokes:

1. **Marks** in order (K8). A mark is an arc of the cranium circle, a stretch of the neck's top contour or of the back
   (`craniumPoint`, `neckTop`, `backTop` in `src/care/dragon.ts`); the hand's joint rests a hand's radius less 2 px
   out (the hand lying on it), a brush's hand 8 px over it, so the bristles lie on it. A quick test first drops a mark
   whose fist could never keep off the eye.
2. **Postures**: kneeling for a mark under the standing shoulder by more than a third of the reach (always for a tuck-in),
   standing otherwise, then the other one.
3. **Hands**: open and flat first, then a fist (`KeeperAgent.palm`). The open hand lays its palm along the mark toward
   the snout, as a hand lies on a pony's neck, the wrist bent as far as 60 deg from the forearm (along the forearm it
   read as a longer arm); Tomas's lies flat on the brush. On a baby's rump his flat hand's fingers came over the eye,
   and there a fist does the grooming.
4. **Spots** 1 px apart outward from where the mark sits at 0.85 of the reach (at 0.7 the forearm folded back against
   the keeper's chest and a stroke read as a hug). A spot must **reach**: every end of the
   stroke, on every sampled pose of the dragon, 1.5 px inside the straight arm, and the hand's joint within 1.5 px as a
   tick places it (the engine snaps joints to whole pixels; a small search nudges the solve against that). Then it
   must keep the **eye clear**: dry runs of the keeper's poses, drawn off screen clipped to the dragon's eye box
   (grown 2 px), covering none of it — the kneel, the hand easing on and off, the stroke, resting through the happy,
   the rise and the shh, each against the dragon as it will be then (idle, its pet loop, its happy, its lie-down frame
   by frame, asleep). The hand is modelled exactly (the engine's fist, a rounded block -0.6 r to +1.6 r along the
   forearm with the thumb's ball, or the open hand's block, `palmBlock`) as a cheap first test before any drawing.
5. The first spot that passes wins; with none (no look in the audit needs it), the eye-clear spot that overreaches
   least.

The **eye box** is the bible's: the eye's largest box (`rig.info.eye`: the eye in any state and a 1 px ring), placed
in face space as the rig places it (`eyeBox`). A plan takes about 40 ms on average (at most about 135) and is cached
per keeper, act and look, so the yard makes each at most once.

## 7. The yard

`src/care/yard.ts`, gallery `view=yard`: six dragons (Bramble the spike adult, Wick the dusk adult, Ripple the water
young, Ember the fire baby, Echo the slinkwing baby and Cobble the rock elder) in two rows with room round each, and
the four keepers at stations along the back of the yard, in the band behind the dragons (a keeper behind a dragon is
drawn under it and covers nothing): Bea's kitchen, Tomas's grooming shed, Iris's lamp and Pip's bench, each over the
dragons it mostly works with. A caption along the top says what each keeper is doing.

### 7.1 Needs

Hunger, loneliness and sleepiness rise from 0 to 1 over a stage's `FILL_S` seconds (a baby soonest), each dragon's own
rate within 15 % (seeded). A need **shows** at 0.7: a hungry dragon begs (its beg loop), a sleepy one yawns once, a
lonely slinkwing calls once, and the resting mood sinks with loneliness and hunger (the rig's mood cue and face show
it). A fed dragon walks home from where it trotted to; a tucked-in one sleeps for 24 s (hunger rising slowly), then
wakes.

### 7.2 The director

Every tick each free keeper takes the neediest free dragon its job covers whose need has shown, asking Bea first,
then Iris, Tomas and Pip (a dragon hungry and sleepy both is fed, then tucked in). The act ends back at the keeper's
station. Pip, waiting at his bench, cheers each happy that thanks a keeper.

## 8. Checks

| Check | What fails |
|---|---|
| `npm run palette`, KEEPERS | any of the 156 keeper gates (3) |
| `view=careaudit` (smoke) | every care act on all 28 looks, 112 runs (Bea feeds, Tomas grooms, Pip pets, Iris tucks in), and mirrored (`facing=-1`) on fire and dusk, 32 more: a keeper covering the dragon's eye box by one pixel at any frame, walking in and out too, a stroking hand more than 2.5 px off its mark, an act that never ends |
| `view=yardaudit` (smoke) | the same for every act the yard plays in 9000 frames, each keeper checked against every dragon it stands level with or in front of |
| `view=keepers`, `view=yard` (smoke) | a keeper not drawn (its top colour missing) or a page error |
| `npm run shots` | the keeper sheets: the cast in every anim, care strips on babies and grown dragons, the yard at three moments, both audits |

At the last run: all 112 care runs eye-clear, and the 112 mirrored, and the yard's 25 to 27 acts a run (seeds 1 to 4),
walks between acts included; the worst hand miss 1.8 px (the yard's 1.7).

## Found while building

- **The eye rule drove the staging.** A fixed stand-off put a kneeling keeper's head, arm or bowl over a baby's face
  (a kneeling grown-up is as big as a baby dragon), so the staging became a plan (6.3), and the plan found the head is
  out on babies and on a head laid on the floor (K8).
- **A tuck-in skipped the lie-down**: a loop played at the pet's seeded phase starts inside its loop part (a pet
  already asleep is asleep), so the dragon flopped asleep and dusk skipped its whole tuck-in. It plays from frame 0.
- **The far hand of a kneeling pet**, keyed by angle, swung forward with the lean onto a lying dragon's face; it rests
  on the far thigh by target now. And the pet's arm, keyed reaching forward, swept level across a lying head as the
  keeper settled into the pose; it starts at rest.
- **The eye box** was first a padded square (the eye's larger side both ways); it is the bible's rectangle now.
- **The hand missed by up to 2.4 px** in the audit with the arm well inside its reach: the engine snaps each joint to
  whole pixels. The solve now searches a few sub-pixel nudges and keeps the nearest (worst 2.0 px).
- **The tiptoe and the cheer covered the keeper's own face** (the near shoulder sits forward, so a raised near arm
  crosses the face; both arms out in front read as a sleepwalker; a finger kept at the lips hid the face for the
  whole walk): the tiptoe's arms go low for balance (the shh before it says it), and the cheer's fist and the wave's
  hand are raised forward, clear of the face.
- **Walking**: a keeper whose x arrived before its depth drifted back and forth; one walking from the kitchen to feed
  a baby walked over it; walking straight across the yard, keepers covered other dragons' eyes for up to 1.4 s. Walks
  are planned now (6.2), and a planned walk still met a head that moved (dusk's beg swings it down 15 px; a fed
  dragon eats; one turns round), so the eye a walk keeps off is the dragon's sweep over what it may play soon.
- **The fed dragon's tail**: turned in place after a short trot, a long tail lay over the bowl and the keeper knelt
  into it to take the bowl away. The trot is as long as the tail needs.
- **The open hand**, laid along the forearm, read as a longer arm, and at 4 px across its ink and shadow left one
  row of skin: a dark stick on the dragon's head. It is 5 px across and lies along the mark.
- **The bowl gap** was solved against the begging dragon's eye as it was in the beg's first frame, every third frame
  of the set-down; dusk's beg swings its head, and a kneeling keeper's chin came 2 px into its eye in between. It is
  solved against the eye over the whole beg, every frame.
- **Bea's bun** was wound the other way from her hair's cap, so where they overlapped the two cancelled and her skin
  showed through a notch; wound the same way it merged into one silver lump, so a shadow arc sets it on the cap.
