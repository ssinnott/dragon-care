# Dragon Care: Art Bible

**What this covers.** This is how all 18 dragon looks are drawn:

- **6 elements:** fire, spike, rock, lightning, water, shriekscale.
- **3 life stages:** baby, young adult, adult.

**The house style.** Everything is drawn in the house style of the vendored engine (`src/lib/art/`):

- a 1 px outline in `#1a1018`;
- flat cel bands lit from the top-left, with no gradients;
- the engine's shading gates `THIN_R` 6.5, `HI_MIN` 10 and `FLAT_R` 5;
- the mark floor: no mark thinner than about 2 px.

**Screen and scale.** The game renders at 640 × 360 and is upscaled with nearest neighbour. Humanoid rigs in the sibling games stand about 72 to 76 px tall at scale 1. A dragon is a pet in a habitat scene, and several share the screen.

**Where this came from.** Three art directors proposed designs independently, from three lenses: readability (R), charm (C) and growth (G). This bible takes the strongest idea for each decision rather than averaging, and says where each one came from. Readability constraints are **hard rules**. No decision below trades one away.

**Status.** This is the design, and the rig now draws it: the quadruped rig, the shared features and a first pass of all six elements live in `src/art/dragon/` (file list in 1.1), with the idle loop per stage; the rest of the core animation set (4.2) comes next. The palette is code too: `src/art/dragon/palettes.ts` holds the values, and `tools/palette-check.ts` validates them (report in section 5.8). `npm run shots` renders the standard sheets of 5.5 and `npm run smoke` checks every gallery view. Every hex below comes from that module and passed that check. The bible has been through one review round (a readability critique and a care-game critique); what changed, and what was turned down, is in the **Review log** at the end.

---

## Decisions

All three proposals **agreed** on the following, so they are not listed as decisions:

- side view, facing right;
- one parameterised quadruped rig (ART_GENERATOR lesson 49);
- stages authored at scale 1 as separate proportion sets, never as a scaled-down adult;
- one palette per element, shared by all three stages;
- the element cue present from hatching;
- a small-size silhouette test (24 px, the humanoids' own; defined for the dragons in 5.1 #1 as a ÷ 3 area-coverage sheet).

The contested choices:

| # | Decision | Taken from | Why (and what lost) |
|---|---|---|---|
| D1 | **One element per silhouette zone:** fire above the tail tip, spike the back line, rock the body mass, lightning the space above the back (behind the head), water the tail end, shriekscale the head. Adopted with C's **quiet-zone rule** and G's **zone budgets** (3.0). | R + C + G | C paired elements in a zone, sharp against soft; at 24 px, "sharp vs soft" in the same place collapses into the same blob. G put three elements on the head (bolt horn, ears, cheek fins); an adult head is about 6 px long at 24 px and holds one feature, not three. |
| D2 | **Lightning's cue is its wings, held cocked upright and leaning back:** a yellow membrane with a zigzag edge forms a bolt over the back, behind the head. | R | The head belongs to shriekscale. A single tall spire is the simplest shape at 24 px. Every dragon already has wings, so the cue is a parameter of an existing part (lesson 49), not a new part. C's zigzag horns and G's nose horn would both sit in the head zone. |
| D3 | **Water's cue is a vertical crescent fluke** at the end of the longest, flattest, level body. It gets small back-pointing fin-ears within the head budget. | R | C's whale fluke lies flat, so in side view it is seen edge-on as a line. G's axolotl cheek fins sit in the head zone. |
| D4 | **Rock is one faceted dome carapace plus a heavy, low stance.** It has **no tail club**. Crystals grow on the dome with its bond, and their glow shows its mood. | R (dome), C + G (no club), R + G (crystals) | C's humps share spike's back line. A club puts a second shape at the tail end, which is water's zone. |
| D5 | **Spike has leaf wings, and its tail tip is a plain taper.** The quills continue along the top of the tail instead. | C | An upright quill fan on the tail tip reads as fire's flame (C measured this in silhouette). Leaf wings fit a bramble dragon and differ from every bat wing. |
| D6 | **Shriekscale is a sound dragon.** It has ribbed ear-fans that flare into a dish (R), rib "shriek-scales" (G), a throat sac that swells (C + G), a pale lilac eye mask, and it sings a rising 3-note scale when happy (C). There is no tail barb. | R + G + C | Sound is the only invisible element, so it needs a body part that shows it (the fans) and an effect (arcs). The tail end is water's zone. See 3.7. |
| D7 | **The cue is the mood gauge**, driven by one `mood` channel from −1 to +1. At its lowest the cue keeps **at least 60 %** of its silhouette. | R (60 % floor) + G (channel) | Identity must never depend on the dragon being happy. |
| D8 | **Far-side shading is split.** Far legs use `farPalette(0.55, 0.30)`. The far wing and far head features keep the engine default of `(0.62, 0.25)`. Shriekscale's legs are thin (radius × 0.75) so they stay flat and never get a shadow band. | C (legs) + G (wing reasoning) + review | Measured, gate c2: at the default, the far leg lands 19 to 24 % from the near leg's shadow band on fire, rock and shriekscale (24, 19 and 21 %). R kept the default everywhere and only measured against the base tone. A darker far wing would sink the dark membranes toward the ink (G). Shriekscale's shadow tone sits only about 12 Oklab L above the ink, so no far shade can clear both by the 6-point dark-pair floor; flat legs remove the shadow band instead (E4). |
| D9 | **The six body colours are value-stacked:** luminance runs 0.49 rock > 0.31 water > 0.23 fire > 0.17 spike > 0.12 lightning > 0.05 shriekscale. A search nudged the stack until all 15 pairs also separate under simulated deuteranopia and protanopia, **by the same rule as gate (b)**: a hue only counts when both simulated colours have S ≥ 0.30. | New, built on R's measurements and G's value ladder | R's palette had five body pairs that separated on hue alone, and four of those merge under simulated deuteranopia or protanopia. Now every pair separates in greyscale **and** for dichromats (gates b and f). No body hex moved more than 0.04 Oklab ΔE from the art-directed value (water, the largest, moved `#2fa5b5` → `#20a3ce` so fire / water survives deuteranopia on a hue that is saturated enough to count). |
| D10 | **Lightning has a blue body with a yellow signal colour; rock is a light sandstone.** | R + G | A yellow lightning body would sit within 20° of fire and rock (G), and a grey rock would break the neutral ceiling (R). |
| D11 | **Dark membranes sit below the body's own shadow tone, except where the wing or fan *is* the cue.** Fire, rock and water run 0.19 to 0.33× the body's luminance, under the shadow tone's 0.41 to 0.54×. Spike's leaf membrane sits *between* shadow and base (0.70×) and clears both by ≥ 30 %. Lightning's is yellow and shriekscale's is pink. | G + R + review | G measured that a mid-value membrane is the body's own shadow tone and fuses with it. The first draft's "0.2 to 0.5×" band still contained the shadow tone (fire 19 %, rock 10 % from it), so gate (a) now measures scale.sh / membrane directly. R made the membrane the cue on the two elements whose cue is a membrane. |
| D12 | **The eye's aspect ratio is a stage signal:** 7 × 8 for babies, 7 × 7 for young, 8 × 6 for adults, at nearly constant absolute size. There is a catchlight at every stage. A new gate keeps every iris at least 25 % from the catchlight. | C (aspect, layout), C + G (catchlights) | R dropped the catchlight on adults, but a care game's face must draw the eye. The iris gate was new, and it caught three of R's irises (fire 17 %, lightning 5 %, shriekscale 13 %) that would have swallowed their catchlight. The adult eye is 8 wide so its slit has iris on both sides (2.5). |
| D13 | **Pigment is not inked; separate objects are.** The belly stripe, markings, eye mask and spots are clipped colour changes with no line. Horns, quills, dome, fans, flame and crystals each carry their own outline. **Claws are the exception:** they are drawn un-inked, because two inked claws with a 2 px gap between them fill the gap with ink. | R + G, and the engine (`drawLimbSegs` draws sleeve to skin with no line; `band()` inks only a change of material) | C inked the belly seam. The belly is countershading on the same hide, not a new material. Gate (a) guarantees every pigment step is at least 25 %, including where it crosses the shadow and highlight bands. |
| D14 | **Base proportions come from R,** the smallest adult, so more pets fit across 640 px. Element modifiers stay **within ±30 %** (G) and apply at half strength on babies (new). Babies also get C's pot belly. | R + G + C | Unbounded modifiers (R had rock's neck at 0.6) blur the stages. A baby should look like a baby first and an element second. |
| D15 | **Growth follows Seed → Sprout → Signature.** Each stage-up adds one sub-part to the cue, and each element has one adult-only extra. Babies carry the adult's *first* marking. | G | This gives "same species" continuity (R and G) and makes each stage-up visibly a reward. C gave babies no markings at all. |
| D16 | **Two claws per near paw, with 2 px gaps, drawn un-inked.** | G + review | Three claws on an 8 px paw (R, C) need 1 px gaps, and a 1 px gap closes, turning the claws into one pale band. For the same reason the claws carry no outline of their own (D13): each claw's ink would eat 1 px of the 2 px gap. |
| D17 | **Animation uses R's frame tables as the base:** a 48 f lateral-sequence walk (R + G), the adult preens instead of hopping (R), plus C's beg loop and G's grow-up. Every baby breath fails, adorably (C + G). | R + C + G | A slow pet ambles in a four-beat lateral sequence, with a different leg moving on each of the 8 keys. C's 36 f diagonal gait is a two-beat trot that reads as hurrying. |
| D18 | **The dragons get their own face set, DFACE:** neutral, happy, closed, hungry, sleepy, sad, surprised, grumpy, sheepish, scared, dazed. Never angry. | C + review | The engine's `FACE` is a combat set (angry, shout, grit), and this is a cozy game. Sheepish and scared were added because the care loop calls for them (lightning's zap, shriekscale's fright); dazed was redrawn because the engine's X-eyes are 1 px marks. |
| D19 | **A folded far wing is not drawn.** A far part either shows at least 3 px or is hidden (the "sliver rule"). | C + G | R's knuckle-only far wing is a 1 to 2 px sliver, which reads as a defect. |
| D20 | **Emitters are flat, never cel-banded.** This covers flame, crystals, bolts, sparks, bubbles, glow dots and sound arcs. | G | A flame with a shadow band reads as an orange stone. |

**Hard rules (the readability constraints, never traded):**

- the 1 px `#1a1018` outline;
- light from the top-left;
- no gradients;
- the engine shading gates, never overridden per rig;
- the mark floor of about 2 px;
- one outlined silhouette per limb, with roots sunk into the body;
- the ≥ 25 % luminance / ≥ 40° hue ladder between adjacent parts;
- one saturated signal colour family per dragon;
- ≤ 40 % neutral area;
- one silhouette region per element;
- the cue present from hatching and ≥ 60 % at lowest mood, **asleep included**;
- the head drawn last so nothing covers the eye (the only exceptions are the tuck poses, where the eyes are closed or peek out uncovered: E9);
- far parts show ≥ 3 px or are hidden;
- every scale, belly and floor-level effect ≥ 25 % from the habitat floor.

Section 5 lists each rule with the failure it prevents.

---

## 1. VIEW & ANATOMY

### 1.1 Space and conventions
- **Space.**
  - Side view, authored facing right. `facing: -1` mirrors the sprite *including* its light, the same as the humanoids.
  - **Root space** has its origin on the ground under the body centre, with +x forward and y negative going up. The tables in this bible give heights as positive "px above ground", so y = −value in code.
  - **Body space** has its origin at the body centre, which sits `bodyY` px above the ground.
  - **Cranium space** has its origin at the centre of the cranium circle.
- **Angles, in degrees.**
  - Legs follow the engine convention: 0 means hanging straight down, positive swings forward, and **the lower bone's angle is relative to the upper bone**, exactly as `computeJoints` adds them (`lower = upper + leg.lower`). So a shin that hangs 20° back from vertical under a thigh at +25° is written +25 / −45.
  - The neck and wing bones are measured from +x (forward), with positive rotating upward.
  - Tail segments are measured from straight back, with **+ drooping toward the ground** and **− lifting**.
- **Scale.**
  - Every stage renders at `scale: 1`.
  - `build.scale` is used only for enlarged views, such as a 2× portrait in the care panel.
  - Joints snap to the device grid (`round(v * sc) / sc`), as in `computeJoints`.
- **Shading.**
  - The default profile everywhere: `thinR` 6.5, `hiMin` 10, `flatR` 5, with the ramp `{ hi 1.22, sh 0.66, rim 1.55 }`.
  - Do **not** lower the gates for babies. Their flat single-tone legs and two-tone bodies and heads come out of the gates on their own, and that softness is part of what reads as a baby.
- **Engine reuse.**
  - `drawLimbSegs` and the `cel*` helpers only need a `PartRig` / `ShadeTarget`.
  - The dragon rig satisfies `PartRig` through a palette adapter:
    - `skin`, `primary` and `secondary` map to `scale`;
    - `hair` maps to `marking`;
    - `accent` and `metal` map to `horn`;
    - `dark` and `glow` map across unchanged;
    - `belly`, `membrane` and `eye` are extra keys, which `farPalette` darkens too;
    - `hairStyle` is `'bald'`.
  - `enter`, `leave` and `setLight` are typed on the humanoid `Rig`. `stepChains` is private to rig.ts.
  - The dragon rig therefore gets its own small `enter` / `leave` (3 lines) and a chain stepper (about 12 lines) built on the exported `getChain` / `stepChain` / `resetChain`.
  - **The vendored engine is never edited.**
- **Files** (all under `src/art/dragon/`):
  - `palettes.ts`: the 6 x 8 palette, shared colours, `blushOf`, `moodTones`, `DRAGON_FAR`.
  - `pose.ts`: `DragonPose` (the 4.1 channels, plus the stepped `sleep` and `tuck` of the tuck branch), `DFACE`, make / copy / lerp / add and the `DP()` shorthand.
  - `anim.ts`: `DragonAnimPlayer`, the engine `AnimPlayer`'s semantics over `DragonPose`, with runtime blinks and desync.
  - `anims.ts`: the animation table per stage (the idle loops today).
  - `stages.ts`: the 2.1 / 2.2 tables, the 2.3 modifiers, the tail rest shapes, the 4.1 chain parameters and timing rules.
  - `build.ts`: `dragonBuild({ element, stage, seed })` resolves a complete build (modifiers, the seeded variant of 2.8, the solved body height); `buildDragonFor(element, stage)`.
  - `rig.ts`: `buildDragon`, `computeDragonJoints`, `stepDragon` and `drawDragon` in the draw order of 1.4.
  - `parts.ts`: body, neck, skull, jaw, legs and paws, the n-node tube, bat / leaf / fin wings, nubs, the ground shadow.
  - `faces.ts`: the stage eye, lids in rows, brow, blush, nostril, mouth marks and teeth (2.5).
  - `features.ts`: the shared, parameterised features: paired horns, markings, the dorsal row, emitter helpers.
  - `fx.ts`: deterministic particle schedules, the top pass (1.4 step 14) and the ambient caps (5.4).
  - `element.ts`: **the seam**, `ElementSpec`. `elements/<id>.ts`: one file per element; `elements/index.ts`: the registry.
  - Shared features are **part kinds with parameters** (horns, markings, wing style, tail rest shape, dorsal row), drawn by one renderer for all 18 looks. What only one element has (a flame, a quill comb, a dome, bolt wings, a fluke, ear-fans) is a renderer at a **fixed anchor** of the draw order, declared in that element's `ElementSpec`; each element artist owns exactly one `elements/<id>.ts`.
  - The gallery is `src/gallery.ts` (views: lineup, silhouette, stages, grey, cvd, strip, habitat, plus zoom, cast, mood and faces for close review).

### 1.2 Parts and the primitive each one uses
Every part is **one outlined path**, stroked once and filled once (the `drawLimbSegs` lesson). Any colour change inside a part is a clipped fill.

| Part | Primitive | Construction |
|---|---|---|
| **Body** | `pathTaperedCapsule` + `celPath` | A hip ball joined to a chest ball in one path. The chest ball sits 1 px higher than the hip ball (a proud chest). Babies add a belly-sag ellipse to the same path. `ext` = half the body length. **Belly band:** the lower 38 % of the depth (babies 45 %), clipped inside, in `belly`. It carries one shadow band that switches to `belly.sh` inside the belly, and the belly line is **not inked** (D13). |
| **Neck** | subpaths of `pathTaperedCapsule`, appended | 1 to 2 segments, one stroke and one fill. The root is sunk into the chest top-front. A throat stripe in `belly`, clipped to the lower 40 %, runs on continuously from the belly. **Bulges live in this contour:** the eat gulp and shriekscale's throat sac are extra nodes appended to the same path, so they change the silhouette instead of hiding inside the stripe. |
| **Skull** | one `celPath` union | Made of a cranium circle, a snout taper, a brow-ridge bump (young and adult) and optional bumps (rock's nose horn root, shriekscale's nose-leaf). This is the `drawSkull` approach: bumps in the contour, not new outlined objects. `ext` = half the head length. |
| **Jaw** | `celTaper`, drawn **under** the skull | Hinged. The upper half is `scale` and the lower half `belly`, so the chin continues the throat stripe. **An open jaw is either 0° or at least the stage minimum**, `atan(2.5 / jaw length)`: baby 20°, young 14°, adult 10°. Below that the wedge is 1 to 1.5 px and shows neither mouth nor tongue. Open, the wedge behind it is filled with mouth `#5a2030`, plus a 2 × 2 tongue `#f07890` and fangs `#f8f4ec`. |
| **Eye** | flat rects in a 1 px ink ellipse | Only the near eye is drawn, since the far eye is hidden in profile. It has a coloured iris and **no whites**. See 2.5. |
| **Brow** | `brow()` bar, 2 px, in `scale.deep` | Sits 1 px clear of the eye's ink ring. The engine rule: a 3 px brow reads as a lid. |
| **Nostril** | 2 × 2 rect in `dark` | |
| **Legs × 4** | `drawLimbSegs(ctx, rig, a, b, c, r1, r2, scale, scale, true, bulge)` | One silhouette per leg with the root sunk 0.35 r. The hind leg has its knee forward and hock back, the digitigrade "Z" (G). The front leg is nearly straight. |
| **Paws** | `celRect` r 2 | `ext` < 5, so they are one flat tone. Claws on **near** paws only: 2 claws in `horn`, drawn **un-inked** (`flat(…, false)`) inside the toe with their tips on the paw's ink line, with a 2 px gap between them (D16). |
| **Tail** | an n-node tube, as `drawLimbSegs` generalised to n nodes (`drawTube`) | One stroke, one fill and one clipped shadow band, gated by the root radius. A belly stripe runs along the underside for the first 60 %. The tip feature is drawn in the last segment's space. |
| **Wing** | arm capsules + membrane `celPoly`, unioned, stroked once | The membrane fills with `hi 0`: membranes are matte, and a highlight would add a boundary. Arm and spars are 3 px (adult) or 2 px (young) fills in `scale` with **no ink of their own**. Between spar tips the trailing edge is cut with concave arcs, with the scallop depth set per element **and multiplied by the `wing` channel** (0 when folded): folded spar tips land only 3 to 4 px apart, less than a 3 to 5 px scallop. |
| **Back row** (spike quills, water dorsal fin) | `celPoly` | Drawn **before** the body, so the body contour hides the roots (the `sunk` idea). |
| **Rock dome** | `celPoly` | Drawn **after** the body, with its rim inked. Facets are tone steps with no line: form within one material. |
| **Emitters** (flame, crystals, sparks, glow dots) | `flat()` | Outlined when they are part of the silhouette. **Never banded** (D20). An emitter that can land on the floor carries a 1 px ring in a dark slot of its own palette (5.4, gate i). |
| **Ground shadow** | flat ellipse | `#1a1018` at α 0.28: (body length + 6) × 2 px for babies, (+ 8) × 3 for young, (+ 10) × 4 for adults. Shrinks during hops. |

### 1.3 Wings: folded, spread, cocked
- **The `wing` channel** runs from 0 (folded) to 1 (spread) and lerps the bone angles in table 2.2. The `flap` channel rotates the whole wing ±40° about its root.
- **Folded.**
  - The wing lies along the upper back.
  - The **wrist knuckle rises 3 px above the back line**. That bump is the "has wings" read.
  - Spike (0) and rock (0, tucked under the dome) change this with `foldRise`.
  - The folded wing's lower edge stays **≥ 5 px above the belly line**, so the flank colour always shows.
  - The spar tips lie *on* the rump contour, never above it, so nothing folded rises toward fire's zone above the tail tip.
  - **Baby nubs** have no bones and cannot fold flat. They rest at 170° (10° above the back, pointing back), so a knuckle about 4 × 3 px shows behind the head, and rise to 140° only in flutter and happy. Spike's rest at 200° along the flank instead, below its quills (3.3).
- **Spread.**
  - Spread wings appear **only** in happy, the wake stretch, breath, hop-glide and flight. They never appear at idle.
  - They are the tallest thing in the habitat, so they are an event, not a resting state.
- **Cocked (lightning only).** At rest, lightning holds its bolt wings upright at 115° (25° back from vertical) with the spars closed. They **never fold flat**: asleep, they drop to the sad cock of 140° (3.5).

### 1.4 Draw order (back to front)
1. Ground shadow.
2. Far wing, only when `wing` ≥ 0.25. Lightning's cocked far wing is always drawn.
3. Far head features: far horn, far ear-fan, far fin-ear.
4. Far hind leg, then far front leg.
5. Tail, then the tail-tip feature (flame, fluke). The tail is on the midline, so it goes over the far legs and under the body.
6. Back row: spike quills and water's dorsal fin.
7. Body, belly band, then body markings (clipped inside the body).
8. *Rock only:* near wing, then the dome and crystals. The wing tucks under the dome rim.
9. Neck, with the throat stripe.
10. Near hind leg, then near front leg. Their roots are sunk, and each leg's ink contour draws the haunch and shoulder.
11. Near wing (every element except rock).
12. **Head group, always last among body parts:**
    1. mouth interior (jaw open, which always means ≥ the stage minimum: 1.2);
    2. jaw;
    3. skull;
    4. face markings (clipped);
    5. eye, brow, nostril, fangs;
    6. near horn, near fan and near fin-ear.
13. The dragon's own effects: breath, sound arcs, sparks.
14. **Top pass, after every dragon:** rising particles (embers, "z", bubbles, notes, dazed stars), so a neighbour never hides them.

The head is drawn last so that no pose can cover the eye.

**The tuck branch.** Three poses need something drawn *over* the head, so they move the whole head group (step 12) earlier:
- **Rock's sleep tuck and upset tuck:** the head group is drawn before step 8, so the dome and its rim lie over it.
- **The baby sleep bun:** the head group is drawn before step 11, so the wing nubs lie over the head.

In the sleep poses the eyes are closed. In rock's upset tuck one eye peeks out *below* the raised rim, where nothing is drawn over it. This is ledger entry E9.

### 1.5 Near vs far
| Part | Far treatment |
|---|---|
| Legs | `farPalette(p, 0.55, 0.30)` (D8). Far paws sit **2 px higher**. At rest the far front paw is 4 px ahead of the near one and the far hind paw 4 px behind, so both legs of each pair show. |
| Wing | `farPalette(p, 0.62, 0.25)`. Spread: rotated 8° further back (+8° in the 1.1 convention), root 2 px higher, with **≥ 5 px of far membrane edge visible**. Folded: not drawn. |
| Horns, ear-fans, fin-ears | `farPalette(p, 0.62, 0.25)`. The root is 3 px behind and 1 px above the near one, angled −8°, so the tips separate by ≥ 3 px. If a far feature would overlap its near partner by more than 70 %, it is not drawn. A far horn keeps ≥ 6 Oklab L from the ink (gate e). |
| Claws, markings, glow dots, eye, fan ribs, fin rays | **Not drawn on the far side.** A 2 px detail at far shading falls under the mark floor. |
| Body, neck, head, tail, back row, dome | Near palette. These are midline parts. |

### 1.6 What is inked, and what is not
- **Inked:** any separate object, which is a change of material (`band()` rule 0.4d). This means the body, legs, neck, head, jaw, tail, the wing (one silhouette), horns, quills, the dome, the fluke, fans, fin-ears, the flame's outer shape, crystals, pebbles and bolts.
- **Not inked:** pigment on the same hide. This means the belly band and throat stripe, markings, the eye mask, spots, cel bands, the flame's core and dome facets. Each is guaranteed ≥ 25 % luminance or ≥ 40° hue from what it sits on by gate (a), including the shadow and highlight tones it crosses.
- **Not inked, by exception:** claws (D13, D16).

---

## 2. LIFE STAGES

### 2.1 PROPORTIONS TABLE (fire is the reference; the element modifiers in 2.3 multiply these)
All values are px at scale 1. Positions are given as (x, y) in body space unless marked otherwise.

| Part | Parameter | **Baby** | **Young adult** | **Adult** |
|---|---|---|---|---|
| **Body** | hip ball r / chest ball r | 6.5 / 7.5 | 7 / 8.5 | 9 / 11 |
| | ball gap, centre to centre (hip at −gap/2, chest at +gap/2, 1 px higher) | 5 | 14 | 19 |
| | **body length**, hip back to chest front | **19** | **29.5** | **39** |
| | depth at the chest | 15 | 17 | 22 |
| | belly-sag ellipse (same path) | rx 10, ry 4, centre (0, +3.5) | none | none |
| | `bodyY`, body centre above ground (solved from the hind leg) | 13.5 | 19.5 | 24.5 |
| | belly clearance under the chest | 5 | 10 | 12.5 |
| **Neck** | segments × length | 1 × 3 (hidden; the head sits on the chest) | 2 × 6 | 2 × 9 |
| | radius, root → head | 5.5 → 5 | 5 → 4 | 6.5 → 4.5 |
| | root / sink | (+5, −5) / 2 | (+10, −5) / 2 | (+13, −7) / 3 |
| | rest elevation per segment | 70° | 70°, 45° | 65°, 35° (an S), head pitched 10° down |
| **Head** | **cranium radius** | **8.5** | **9** | **9.5** |
| | cranium centre from the neck end | (+1, −3) | (+1.5, −2) | (+2, −2) |
| | snout taper, cranium space: from → to, r0 → r1 | (1.5, 1.5) → (6.5, 2), 5 → 4 | (2.5, 1) → (11.5, 1.5), 5.5 → 4 | (3, 1) → (15, 2), 6 → 3.5 |
| | **snout length** beyond the cranium | **2** (a button) | **6.5** | **9** (a wedge) |
| | head length / `celPath` ext / tones | 19 / 9.5 / 2 | 24.5 / 12.25 / 3 | 28 / 14 / 3 |
| | brow ridge bump in the skull path | none | 1 px | 2 px |
| | jaw: hinge → tip (cranium space), r | (−1, 4) → (6, 4.5), 3 → 2 | (−1, 4.5) → (10, 5), 3 → 2 | (−1, 5) → (13, 5.5), 3.5 → 2 |
| | jaw maximum opening | 40° | 34° | 30° (shriekscale 40°) |
| | **jaw minimum opening** (any open frame; 1.2) | **20°** | **14°** | **10°** |
| **Eye** | **outer size including the ink ring / interior** | **7 × 8 / 5 × 6** | **7 × 7 / 5 × 5** | **8 × 6 / 6 × 4** |
| | centre, cranium space | (+2, 0) | (+2.5, −1) | (+3, −2) |
| | brow bar (2 px, 1 px above the ring) | expressions only | 5 px long | 6 px long |
| **Teeth** | | egg tooth 2 × 2 on the snout tip | 1 fang 2 × 2, jaw open only | 2 fangs 2 × 3, jaw open only |
| **Hind leg** | hip joint: x = −(gap/2 + X) | (−5.75, +3), X 3.25 | (−8.5, +2), X 1.5 | (−10.5, +3), X 1 |
| | **thigh / shin length** | **4 / 4** | **8 / 7.5** | **10 / 9** |
| | rest angles, thigh / shin (engine convention: shin relative to thigh; 1.1) | +20 / −30 | +25 / −45 | +25 / −45 |
| | `drawLimbSegs(r1, r2, bulge)` → root / knee / ankle radius | (2.6, 2.6, 0.6) → 2.9 / 2.4 / 2.3, flat | (4.2, 4.2, 0.8) → 4.7 / 3.9 / 3.5, flat | (5.8, 5.8, 0.8) → 6.5 / 5.3 / 4.9, 2 tones |
| | **paw (foot)**, w × h | **5 × 3** mitten | **7 × 3** | **9 × 4** |
| **Front leg** | shoulder joint: x = +(gap/2 + X) | (+5.75, +3) | (+8.5, +2) | (+10.5, +3) |
| | **upper / lower length** | **4 / 4** | **7 / 7.5** | **9 / 8.5** |
| | rest angles, upper / lower (lower relative to upper) | −5 / +10 | −5 / +10 | −5 / +10 |
| | `drawLimbSegs(r1, r2, bulge)` → root / elbow / wrist radius | (2.4, 2.4, 0.5) → 2.6 / 2.3 / 2.2, flat | (3.7, 3.7, 0.5) → 4.0 / 3.5 / 3.3, flat | (4.7, 4.7, 0.5) → 5.1 / 4.5 / 4.2, 2 tones |
| | **paw (foot)**, w × h | **5 × 3** mitten | **6 × 3** | **8 × 4** |
| **Claws** | near paws only, `horn`, 2 px gap | none | 2 × (2 × 2) | 2 × (2 × 3) |
| **Tail** | **segments × length** | **3 × 5.5 = 16.5** | **5 × 6.5 = 32.5** | **6 × 7 = 42** |
| | **radius, root → tip** (linear per node) | **4 → 2** | **4.5 → 1.5** | **5.5 → 1.5** |
| | root: hip centre + (−hipR + sink, −1), sink | 1.5 | 2 | 2 |
| **Wing** | root (lightning's bolt sits further back: 3.5) | (+1, −6) | (+4, −8) | (+5, −9) |
| | **humerus / forearm (arm radius)** | nub, no bones: one 7 × 5 `celPoly` (membrane with a scale top edge) | **6 / 8** (r 1, 2 px) | **9 / 12** (r 1.5, 3 px) |
| | **finger spars, leading → trailing** (radius) | none | **14 / 11** (r 1); 3-spar wings (water, shriekscale) **14 / 11 / 9** | **20 / 17 / 13** (r 1.5 → 1); 4-spar wings (water, shriekscale) **20 / 17 / 14 / 11** |
| | folded silhouette / spread tip height above the root | 7 × 5, cannot fold flat: rests at 170° with a ≈ 4 × 3 knuckle showing behind the head, 140° in flutter and happy / flutters ±35° | ≈ 16 × 5 / ≈ 27 | ≈ 24 × 7 / ≈ 40 |
| | what the wings can do | flutter only | hop-glide | fly (rock: the boulder hop) |
| **Shadow** | ground ellipse | (body L + 6) × 2 | (body L + 8) × 3 | (body L + 10) × 4 |

- **Solving the body height.** `bodyY` is solved at build time from the hind leg (drop + paw height + hip-joint offset), so the hind paws sit exactly on y = 0. The front lengths above land the front paws within ±1 px. The rig then nudges the front `lower` rest angle to plant them exactly. When a modifier changes leg length, both pairs scale together and `bodyY` is solved again.
- **Why the leg joints sit out at gap/2 + X.** With the joints at ±gap/2, the near hind and near front legs overlapped by 3.6 to 4.3 px on all six babies, and young fire, spike, lightning and shriekscale kept 0.6 px or less of background between them, so the walk could not show four legs (5.1 #5). With X = 3.25 / 1.5 / 1 (and the thinner baby legs above), at least 3.0 px of background shows between the near legs at rest on all 18 looks. X does not scale with the body-length modifier.
- **Checking the tone gates.** The engine's gates decide tones from these radii. Nothing sets tones by hand.
  - An adult leg root (≥ 5) gets one shadow band; `drawLimbSegs` never draws a highlight.
  - Baby and young legs (< 5) are flat, and so are shriekscale's at every stage (leg r × 0.75: adult hind root 4.9).
  - Adult and young body and head get 3 tones.
  - The baby body and head (ext 9.5 < 10) get 2 tones, so **a baby has no highlights at all**. That is part of its softness.

### 2.2 Wing bone angles
Measured from +x, with positive going up, and lerped by `wing`.

| Keyframe | humerus | forearm | spars, adult 3-spar (lead / mid / trail) | adult 4-spar (water, shriekscale) | spars, young 2-spar | young 3-spar (water, shriekscale) |
|---|---|---|---|---|---|---|
| folded (`wing` 0) | 165° | 18° | 204° / 208° / 212° | 204° / 207° / 210° / 213° | 204° / 210° | 204° / 207° / 211° |
| spread (`wing` 1) | 110° | 80° | 95° / 130° / 165° | 95° / 120° / 145° / 170° | 100° / 150° | 100° / 133° / 165° |

- **Membrane polygon:** root → along the arm → lead tip → scallop → mid tip → scallop → trail tip → scallop → body attach point at (−16, +1) from the root (young: −10, +1). Scallop depth × `wing` (1.2).
- **Lightning** does not use this table: its bolt keeps the spars closed and rotates as one polygon (3.5).
- **Adult spread:** the lead tip lands about (−3, 40) above the root.
- **Adult folded:** the wrist sits 3 px above the back line and the lead tip lies on the rump contour.

### 2.3 Element proportion modifiers
Multipliers on 2.1. Every modifier stays within **0.7 to 1.3** (G), and on **babies** each applies at half strength: `1 + (m − 1) / 2`.

| Element | body length (gap) | body depth (hip r, chest r) | leg length | leg r | neck length | tail length | tail r | snout | tail rest, adult: first-segment angle, bend per segment |
|---|---|---|---|---|---|---|---|---|---|
| Fire | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 0°, −9° (it curls up; the flame rises above the tail tip). Young 0°, −10°. |
| Spike | 0.95 | 1.1 | 0.9 | 1.05 | 0.8 | 0.9 | 1.0 | 1.0 | +5°, 0° (level) |
| Rock | 1.1 | 1.2 | 0.75 | 1.2 | 0.7, neck angles −25° (head low) | 0.7 | 1.2 at the root; the tip radius is capped at 2 (≤ 4 px wide), blunt by its round cap | 0.9, boxy (r1 = 0.9 r0) | +30°, +6° (the tip rests on the ground; y clamped to 0) |
| Lightning | 1.0 | 0.85 | 1.2 | 0.9 | 1.0 | 1.0 | 0.85 | 1.2 | 0°, 0° (straight and stiff, at every stage) |
| Water | 1.1 | 0.9 | 0.8 | 1.0 | 1.3 | 1.15 | 1.0 (baby: 3.5 → 1.5 absolute, see below) | 1.0 | 0°, 0° (level) |
| Shriekscale | 1.0 | 1.0 | 1.0 | **0.75** (thin, bat-like legs: flat at every stage, D8) | 1.1 | 1.1 | 0.7 (a whip) | 1.0, jaw depth 1.3 | +15°, −4° |

**Baby tail rest shapes** (tail angles: + droops, − lifts; 1.1):
- **only fire** curls up like a comma: first segment −10°, then −25° per segment, so its flame rises above the tail tip;
- spike and shriekscale lift a little: −5°, then −15° per segment. The tail top ends about 2 px above the top of the hip, under the 3 px limit for fire's zone (3.0). They keep the springy baby wag;
- lightning is straight and stiff (0°, 0°), as at every stage;
- rock droops (+25°, +5°);
- water stays level (0°, 0°) on a thinner tail (radius 3.5 → 1.5 instead of 4 → 2), so its 10 × 6 tadpole paddle is clearly wider than the tail that carries it.

### 2.4 Resulting sizes
Length is nose → tail tip and height is ground → top, both including the cue at rest mood and excluding effects. The figures are from a rest-pose solve and hold to ±4 px.

| | Fire | Spike | Rock | Lightning | Water | Shriekscale |
|---|---|---|---|---|---|---|
| **Adult** | 105 × 56 | 97 × 52 | 86 × 46 | 105 × 65 | 123 × 57 | 109 × 66 |
| **Young** | 79 × 45 | 74 × 42 | 67 × 37 | 79 × 48 | 92 × 45 | 82 × 53 |
| **Baby** | 41 × 33 | 40 × 32 | 39 × 31 | 42 × 34 | 46 × 33 | 41 × 39 |

- **Height.** An adult stands about 45 to 65 px, a pony-sized pet beside a 72 to 76 px hero.
- **Screen budget.** Two adults, two young and three babies fit across the 640 px habitat, with room between them.
- **Stage steps.** Within an element, every stage step is at least 1.28× in length and 1.19× in height (rock is the tightest in both), so a stage is never mistaken for its neighbour. The head ratio, eye and neck carry the rest.

### 2.5 The eye, and the face set
The eye's **aspect ratio is itself a stage signal**: taller than wide for babies, square for young, wider than tall for adults (C). Its absolute size barely changes, so relative to the head it is largest on the baby (47 % of head height, against 32 % on the adult).

**Eye construction by stage:**
- **Baby, 7 × 8** (interior 5 × 6):
  - the top 4 rows are pupil `#1a1418`, so it reads as a dark, glossy baby eye;
  - the bottom 2 rows are iris, a coloured crescent;
  - a 2 × 2 catchlight `#f8f4ec` sits at the top-left of the interior, toward the light, on the pupil.
- **Young, 7 × 7** (interior 5 × 5):
  - an iris field with a 3 × 4 oval pupil in columns 2 to 4;
  - a 2 × 2 catchlight on the pupil's top-left.
- **Adult, 8 × 6** (interior 6 × 4):
  - a 2 × 2 catchlight on the iris in columns 0 and 1, rows 0 and 1;
  - iris in columns 0 and 1 (rows 2 and 3) and in columns 4 and 5 (all rows);
  - a **2 × 4 slit** in columns 2 and 3, with iris on **both** sides. The pupil is only 1 Oklab L from the ink ring, so a slit that touches the ring's front edge fuses into a 3 px black wall and the slit never shows;
  - the slit is the pupil of neutral, alert and breath, and it shows below the lid in sleepy, sad and grumpy. The hungry, surprised, scared and sheepish faces use a **round** pupil (below), so an adult's pupil is a mood read too, and the adult face never settles into a fixed "villain" slit;
  - the brow ridge sits above as a contour bump, never as a lid.
- **Every iris is ≥ 31 % luminance from the catchlight** (gate a, eye/catchlight), so the catchlight never vanishes into a pale iris.

**DFACE (stepped, never interpolated, like `FACE`).** The blink runs at runtime: 2 frames half-lid (the sleepy lid), 4 closed, 2 half-lid (babies 3 / 4 / 3). It is not keyed.

| Face | Eye | Brow (2 px) | Mouth and extras |
|---|---|---|---|
| neutral | stage eye | flat; babies show none | jaw closed |
| happy | "^" arc, 2 px ink, eye width × 3 | up 1 px | 2 px up-notch at the mouth corner; blush (babies 4 × 2, others 3 × 2, opaque `blushOf(element)`, under and behind the eye); babies open the jaw 20° (their minimum) to show the tongue |
| closed | flat 2 px ink line | relaxed | used for blinks and asleep |
| hungry | stage eye + 1 px each way, a **round** pupil (adult 4 × 4, in place of the slit), **two** 2 × 2 catchlights (sparkly) | front end up 2 px (pleading) | mouth corner down |
| sleepy | lid (rows below) | low | slow blink |
| sad | wedge lid, lower at the back (rows below); pupil down 1 px | front end up | the element cue at `mood` −1 |
| surprised | outline + 1 px each side; round pupil 2 × 2 | up 1 px | jaw at the stage minimum (1.2) |
| grumpy (needs care) | flat lid (rows below) | front end down 1 px, pressed onto the ring | cheek +1 px (a pout). **Never angry.** |
| sheepish | flat lid (rows below); pupil looking down and back, in the bottom-back corner (adult: a round 2 × 2) | front end up 1 px | blush; head turned 10° away. After lightning's zap and a failed baby breath. |
| scared | the surprised ring (+ 1 px each side), round pupil 2 × 2 | front end up 2 px | jaw closed; a 1 px tremble every 4 f. With shriekscale's fans at −1. |
| dazed | a 2 px ink ">" chevron in place of the eye (squeezed shut) | none | wobble mouth; two 3 × 3 inked `#f8f4ec` stars circle above the head in 3 stepped positions, one step every 6 f (top pass). It replaces the engine's X-eyes, whose 1 px strokes fall under the mark floor and read as "knocked out". |

**Lids, in rows of the interior.** A lid is a `scale` fill whose lowest row is its own 1 px ink edge: no separate ink band, and never less than 2 rows (a 1-row lid is just a thicker ring). Percentages are not used, because 30 % of a 4-row interior is 1.2 px.

| Lid | Baby (interior 5 × 6) | Young (5 × 5) | Adult (6 × 4) |
|---|---|---|---|
| sleepy (and the blink's half-lid) | 4 rows | 3 rows | 3 rows (one row of iris and slit still shows, unlike `closed`) |
| sad: a wedge, back columns / front columns | back 2 cols × 3 rows, front 3 cols × 2 rows | back 2 × 3, front 3 × 2 | back 3 × 3, front 3 × 2; the slit shows only below it |
| grumpy: flat | 2 rows | 2 rows | 2 rows |
| sheepish: flat | 3 rows | 2 rows | 2 rows |

### 2.6 What reads as which stage: Seed → Sprout → Signature
**Baby, at about 40 px.** Four cues read as "baby" before any detail does (the baby schema):
1. The head is as big as the body: head height is about 52 % of total height, and the head sits directly on the chest.
2. The eye is 7 × 8 with a catchlight, set at the head's mid-line, under a big smooth forehead.
3. The body is a pot-bellied ball on 4 px legs.
4. The wings are nubs.

Everything else is also soft:
- the snout is a 2 px button;
- there is no brow, and no claws or fangs (just an egg tooth);
- the tail is short and stiff (fire's curls up into a comma to lift its flame);
- the engine gates make every limb one flat tone and the body and head two tones.

The cue is a **seed**: small, soft and already in its adult zone. Where the baby's big head covers part of that zone, the seed moves to the part that shows: baby spike's nubs sit on the loin, rump and tail root, and baby lightning's bolt nubs stand over the hips (3.3, 3.5).

**Young adult.** The leggy in-between (leggy against the baby: its legs grow × 1.9 while the head grows × 1.06; against the adult it is close to a × 0.8 adult, see the Review log, R21):
- the legs nearly double while the head barely grows;
- the neck appears and lifts the head clear of the chest;
- the wings are big for the body;
- the cue is a **sprout** at about 55 to 65 % of adult size.

**Adult.** Horizontal and heavy:
- the chest (r 11) is wider than the head (r 9.5);
- an S-neck carries the head above the shoulders;
- the snout is a 9 px wedge;
- slit pupils sit under a brow ridge;
- claws, a digitigrade hind leg, a trailing tail and wings that can fly;
- the cue is its full **signature**.

**What every stage-up unlocks, for all six elements (G):**
- **Baby → young:**
  - the neck appears;
  - claws appear and the egg tooth drops;
  - the pupil becomes an oval;
  - the wings get bones and can hop-glide;
  - the **first real breath** (a baby breath always fizzles);
  - a second marking;
  - the cue sprouts, gaining one sub-part;
  - highlights appear on the body and head.
- **Young → adult:**
  - a long S-neck and a wedge snout;
  - a slit pupil and brow ridge;
  - **flight** (rock cannot fly: its reward is the **boulder hop**, 4.2);
  - the full breath;
  - the full marking set;
  - the cue's signature form, including **one adult-only extra** per element (section 3).

### 2.7 Species invariants (never change with stage)
- the palette hexes;
- the iris colour;
- the belly stripe from chin to throat to belly to tail underside;
- the head construction (cranium + snout + hinged jaw, with the eye in the same slot);
- **the element cue present from hatching, in the same zone and pointing the same way**;
- the first marking, at the same anchor;
- the tail-tip kind.

A baby next to its adult shares all of these. Only proportion and detail count differ.

### 2.8 Individual variation (a seeded per-pet variant)
Two pets of the same element and stage would otherwise be pixel-identical, and 5.4 expects several on screen. Each pet gets a seed at hatching, and the seed picks, **inside the invariants of 2.7**:
- every marking after the first shifts ±2 px along its anchor line (the first marking stays put: it is an invariant);
- one optional extra marking of the element's own kind, placed only where the marking rules already allow one (for example ≥ 3 px above the belly line);
- horn, quill and fan lengths ±1 px (never past a quiet-zone budget in 3.0);
- the tail rest bend ±2° per segment (never past the 3 px limit above the back line).

The palette, the iris colour and the cue never vary. The seed survives stage-ups, so a pet keeps its own pattern as it grows. Players will still tell pets apart mostly by name and place; the variant only makes sure two of them never look like copies.

---

## 3. ELEMENTS

### 3.0 Silhouette zones, cues and budgets
| Element | Zone it owns | Cue | Flat-black shape of the adult at ÷ 3 | Mood gauge (≥ 60 % at `mood` −1) |
|---|---|---|---|---|
| **Fire** | above the tail tip (the high back end, behind the hips) | torch tail: a flame on an up-curling tail | a "U": head high in front, a flame blob high at the back | flame scale 0.6 → 1.0 → 1.2 |
| **Spike** | the back line, nape → tail | comb of pale bone quills | a saw-tooth top edge | quill lean 50° back (droop; 64 % of the upright height) → 35° → 20° (perky). The alarm bristle is a separate one-shot (3.3) |
| **Rock** | the body mass | boulder dome carapace + a low, heavy stance | a dome/turtle, head below the dome top | the dome is always 100 %; its crystals (≥ 1 from hatching) glow `glow.sh` (dim) → `glow` → `glow` + glint |
| **Lightning** | the space above the back, behind the head | bolt wings, held cocked upright and leaning back | one tall zigzag spire over the back | cock 140° (79 % of the rest height) → 115° → 95° (1.1 convention) |
| **Water** | the tail end, low and level | a crescent fluke on the longest, flattest body | a long flat bar (about 3 : 1) ending in a crescent | spot glow, fin-ears and fluke droop or flare |
| **Shriekscale** | the head | ribbed ear-fans | a head doubled in size by two broad fans | fans flat back → up-back → upright → dish |

**Quiet-zone rule (C), with numbers (G).** A feature on one element that sits in another element's zone stays at or under **half** that zone's cue at the same stage, and keeps the shape language quiet:
- **Head (shriekscale's):**
  - Every other head feature is ≤ half the fan height (adult ≤ 8 px, young ≤ 6, baby ≤ 5).
  - Paired horns (fire, spike, lightning) are ≤ 3 px thick, swept back within 20° of the neck line, and ≤ 3 px above the skull top.
  - Rock's single blunt nose horn sits on the snout, well forward of where the fans would be.
  - Water's fin-ears point back, never up: even flared they rise ≤ 10° above the neck line.
- **Back line (spike's):**
  - Other elements' back features are ≤ 3 px tall with smooth, round shapes: water's dorsal fin, the folded wing knuckle, the resting baby wing nub.
  - Rock's dome is one convex arc, never teeth.
- **Above the back (lightning's):** every other element folds its wings flat at rest; a baby's resting nub shows only a knuckle about 4 × 3 px.
- **Above the tail tip (fire's):** at rest, no other tail rises > 3 px above the back line. Other tails rest level, drooped, or (baby spike and shriekscale) lifted about 2 px. Spike's tail quills belong to its back row, which runs along the top of the tail; they are not a tail-tip shape.
- **Tail end (water's):** no other element has a tail-tip shape wider than 4 px. That is why there is no rock club (and rock's tip radius is capped at 2), no lightning arrowhead and no shriekscale barb.
- **Body mass (rock's):** other elements' backs are smooth arcs with no carapace.

### 3.1 PALETTE TABLE
All values from `src/art/dragon/palettes.ts`; every one passed `tools/palette-check.ts` (5.8).

| Slot | Fire | Spike | Rock | Lightning | Water | Shriekscale |
|---|---|---|---|---|---|---|
| **scale** | `#f04422` | `#2f8232` | `#cfb788` | `#2d58cc` | `#20a3ce` | `#5a2f6e` |
| **belly** | `#e08a2c` | `#a3ad55` | `#fff7e2` | `#9fb4f2` | `#85c6ae` | `#fff5f8` |
| **membrane** | `#7f1e3a` | `#2e6b58` | `#4c5670` | `#ffcf33` | `#1e5f8c` | `#ff6fae` |
| **horn** | `#463039` | `#f2e8c6` | `#5e4e46` | `#2a306c` | `#eaf6f0` | `#f0dce6` |
| **marking** | `#ffe29a` | `#173a19` | `#7e5f44` | `#ffcf33` | `#dcfff6` | `#9a6aa8` |
| **dark** | `#2b1418` | `#4a2618` | `#3b2c24` | `#141a3c` | `#0e2a36` | `#2e1638` |
| **glow** | `#ffa21f` | `#7dff8c` | `#b48cff` | `#fff6a0` | `#40d8f0` | `#ff9ed2` |
| **eye** | `#ffc02e` | `#ff9a3c` | `#ffb84a` | `#ffc41f` | `#ffc64a` | `#3fe0a0` |

**Where each slot is painted:**
- **scale:** body, neck, head, legs, paws, tail, wing arm and spars; the 1 px ring or edge on floor-level effects (fire puffs, spike sap, lightning sparks, the outer edge of shriekscale's sound arcs).
- **belly:** the underside stripe and jaw underside. It is the bottom edge of the silhouette, so it is gated against the floor: every belly sits ≤ 0.49 or ≥ 0.93 in luminance (gate i).
- **membrane:** the wing membrane, plus the element's skin features (water's fluke, fins and fin-ears; shriekscale's fans and throat sac), shriekscale's sound arcs, and the 1 px ring on water's bubbles and drips.
- **horn:** horns, claws (un-inked), quills, fan ribs and fin rays.
- **marking:** element markings, rock's dome and shriekscale's eye mask.
- **dark:** nostrils (2 × 2). The claw and quill tips it once coloured were dropped: at 2 px they were under the mark floor.
- **glow:** the one signal colour, drawn flat.
- **eye:** the iris.

**Derived tones.** These come from the engine (`makeTones`, `farPalette`) and from `moodTones()` in the palette module; none is stored. They are exact.

| Tone | Fire | Spike | Rock | Lightning | Water | Shriekscale |
|---|---|---|---|---|---|---|
| scale.hi / .sh / .deep | `#ff5927` `#9e2f23` `#7c251e` | `#47a539` `#1f5a2f` `#184728` | `#ffe59b` `#897e72` `#6b645e` | `#4571e9` `#1e3da7` `#173089` | `#35cdeb` `#1570a9` `#10598b` | `#7c3f7d` `#3b205e` `#2e1a4e` |
| belly.sh | `#945f2a` | `#6c774a` | `#a8aab8` | `#697cc5` | `#588990` | `#a8a9c9` |
| membrane.sh (hi unused) | `#541535` | `#1e4a4d` | `#323b5f` | `#a88f30` | `#144275` | `#a84d90` |
| marking.hi / .sh | `#ffffb0` `#a89c80` | `#2a4d1c` `#0f281c` | `#a87a4e` `#53423d` | `#ffff3a` `#a88f30` | `#ffffff` `#91b0c8` | `#ca87c0` `#66498b` |
| glow.hi (hot core) / .sh (banked: fire asleep, rock's dim crystals) | `#ffcc23` `#a87020` | `#a7ffa0` `#53b075` | `#eab1ff` `#7761cf` | `#ffffb6` `#a8aa85` | `#5cffff` `#2a95c3` | `#ffc7ef` `#a86dac` |
| dim spot, `mix(marking, scale, 0.5)` (water only) | | | | | `#7ed1e2` | |
| far leg scale (0.55 / 0.30) | `#702d26` | `#224229` | `#6e6559` | `#203063` | `#22546b` | `#2e1d3b` |
| far wing membrane (0.62 / 0.25) | `#45182b` | `#233f3c` | `#313547` | `#96803d` | `#1a3954` | `#904d70` |

**Shared by the whole family:**

| Use | Colour |
|---|---|
| outline | `#1a1018` |
| pupil | `#1a1418` |
| catchlight, egg tooth, fangs, dazed stars | `#f8f4ec` |
| mouth interior | `#5a2030` |
| tongue | `#f07890` |
| blush (happy, chew, pet, sheepish faces), `blushOf(element)` | `#ff9ab0`; overrides in `DRAGON_BLUSH`: rock `#d8607a`, water `#feaebe` (the shared pink fails on those two under deuteranopia or protanopia) |
| ground shadow | `rgba(26,16,24,0.28)` |

**Colour rules:**
- **The value ladder is the same in every palette:** belly lighter than scale, membrane darker than scale (and darker than the scale's shadow tone, except spike's: D11), except where the membrane *is* the signal colour (lightning, shriekscale).
- **The six bodies are value-stacked** (D9): L 0.49 / 0.31 / 0.23 / 0.17 / 0.12 / 0.05. They separate in greyscale and under both common colour-blindnesses. The silhouette zones still carry identity first. Colour is the second, independent channel.
- **One saturated signal family per dragon.** Glow is the signal. Lightning uses its yellow for membrane, stripes and eye as well, one hue family. Shriekscale's pink is membrane and glow. Glow is drawn flat and never banded.
- **The iris is exempt from the signal rule** (ledger E1). It is at most 6 × 4 px, inside an ink ring, and a care game's attention belongs on the face.
- **Neutral area stays ≤ 40 %.** The neutral slots are small: spike's bone quills, rock's cream belly, water's pearl horn and spots, shriekscale's belly and ribs. No body colour is neutral (rock is the lowest, at S 0.34).
- **Pigment edges clear every cel tone they cross.** A marking runs through the body's shadow and highlight bands, and the belly line through the shadow band, so gate (a) measures those tones too, not just the base.

### 3.2 FIRE: "Ember", the hearth dragon
**Identity and care.**
- A warm, affectionate show-off with the fastest metabolism, so it needs food most often.
- It hates baths: a bath shrinks its flame for a while (`bath`, 4.2).
- It sleeps curled around its own tail flame and follows you around like a pet heater.
- The flame is its mood meter.

**The cue: the torch tail.** A flame on the tip of an up-curling tail, in the zone above the tail tip.
- **Construction.** The outer shape is `flat()` in `glow` with an ink outline, since it is part of the silhouette. The core is `glow.hi` `#ffcc23` at 55 % size with no ink (27 % above the outer).
- **Always upright.** The flame is counter-rotated by the tail's total angle, so it points up whatever the tail does ("fire rises").
- **Flicker.** 3 authored tongue shapes swap on stepped keys every 6 frames, never tweened.
- **Width.** Every tongue is ≥ 3 px wide at its base.

| Feature | Baby (seed) | Young (sprout) | Adult (signature) |
|---|---|---|---|
| Flame, w × h, tongues | 5 × 7, 1 | 7 × 10, 2 | 10 × 14, 3; flame base about 4 px above the back line |
| Horns: 2, swept back along the neck line, `celTaper` in `horn` | 3 px buds, r 1.5 | 5 px, r 1.5 → 1 | 8 px, r 1.5 → 1, bent +20° at the midpoint |
| Back row | none: a smooth back leaves the flame and head as the only high points | none | none |
| Wings | nub | bat, 2 spars, 2 px scallops | bat, 3 spars, 3 px scallops |
| Head | round, no ridge | 1 px brow bump | 2 px brow bump |
| Markings: flame-lick chevrons in `marking`, pointing up | 1 on the shoulder, 4 × 4 | + haunch, 5 × 5 | + tail base, 6 × 6 |

- **Mood.**
  - `mood` −1: flame 0.6×, no core, tongues swap every 8 f. The minimum is 3 × 4.
  - `mood` +1: flame 1.2×, swapping every 4 f.
  - **Asleep:** banked to 0.6× in `glow.sh` `#a87020` with no core. This marks sleep at a glance.
- **Adult-only extra:** the third tongue and the bent horns.
- **Signature: Fire Breath.**
  - **Tell:** 2 nostril smoke puffs in `horn`, α 0.5, r 2.
  - **Stream:** one puff every 3 f for 30 f along the jaw direction. Each puff is **3 concentric flat discs**: `scale` outer, `glow` middle, `glow.hi` core. The red outer ring keeps the puff readable on any floor.
    - Radii 3, 4, 5, 6, 6, 5 at 5 px spacing.
    - No ink.
    - Lifetime 18 f, drifting up 0.15 px/f.
    - The last two puffs turn to smoke (`horn`, α 0.45).
  - **Young:** 3 puffs, maximum r 4.
  - **Baby:** a **hiccup**. One puff (r 3), 2 embers, then `dazed`.
- **Ambient:**
  - An ember (2 × 2 `glow.hi`) rises 10 px from the flame over 40 f in alpha steps 1 / 0.7 / 0.4, every 90 ± 30 f.
  - Idle fidget: it chases its own tail flame (60 f).

### 3.3 SPIKE: "Bramble", the bramble dragon
**Identity and care.**
- Shy and prickly with strangers, a cuddle-bug once it trusts you.
- **The quills are its mood meter, and bristling is its alarm.**
- It is slow to bond, and *where* you pet it matters: stroking its back makes it bristle, the head and chin build trust. (Lightning's zap comes from boredom instead, so the two never punish the same mistake: 3.5.)
- Adults shed quills, which are a collectible.

**The cue: the comb back.** A row of pale bone quills from the nape to the tail: `celPoly` triangles in `horn`, drawn before the body so their roots are hidden.
- **Along the tail.** The quills carry on along the *top* of the tail, shrinking toward the tip. The tail tip itself is a plain taper (D5).
- **Lean, driven by `mood` like every other cue (D7).** `mood` −1: 50° back, a sad droop that still shows 64 % of the upright height, so the saw survives at its lowest. `mood` 0: 35°. `mood` +1: 20°, perky, with the ripple. Hungry and sad read as a droop, happy as a lift, the same direction as the other five cues.
- **Bristle (a separate alarm one-shot, the `bristle` channel).** Triggered by a stroke on the back, a loud noise or a shriek nearby: the quills snap upright (0°) and grow × 1.15, with a 1 px tremble every 4 f, for 30 f, then ease back to the mood lean. It is the only state where the quills stand fully upright, so alarm never looks like happiness.

| Feature | Baby | Young | Adult |
|---|---|---|---|
| Quills (count × height, base) | 3 soft nubs, 4 × 4, base 4, blunt tips, on the **loin, rump and tail root** (x ≈ −4, −8, −12): the baby's head covers the front 60 % of its back, so nubs at the neck base and shoulders would be hidden. Lean at half the adult range (30° → 20° → 10°) | 4 on the back [5, 7, 7, 5], base 5, + 1 on the tail (4) | 5 on the back [7, 11, 12, 10, 7], base 6 (neck base, shoulders, mid-back, loin, rump), + 3 on the tail [6, 5, 4]. All in plain `horn`: no dark tips (a 3 px tip on a tapering quill is under 2 px wide and merges with the ink) |
| Brow thorns: 2, pointing back | none | 3 px, r 1.5 → 1 | 6 px, r 1.5 → 1 |
| Wings: leaf-shaped, smooth convex trailing edge, the spar is the leaf's vein | nub | 2 spars | 3 spars. Each spar pokes 3 px past the membrane as a thorn, plus a 4 px wrist thorn. |
| `foldRise` | 0: the nub rests at 200°, along the flank below the quills, so it never hides one | 0: a folded wing never hides a quill | 0 |
| Markings: dark tail rings, 3 px wide | 1 (tail base) | 2 | 3 |

- **Adult-only extra:** the wing thorns.
- **Signature: Quill Volley.**
  - **Wind-up:** the quills snap upright over 4 f, and the body puffs (stretch 1.06).
  - **Volley:** 5 real quills (young: 3) fly out in a forward-up fan. Each is `horn`, 3 × 6, ink-outlined, trailing a 6 px sap streak (`glow`, flat, with a 1 px `scale` edge so it reads on the pale floor; at α 0.5 it was 5 % from the floor).
  - **After 20 f:** each quill pops into 2 sap sparkles (2 × 2 `glow.hi` with a 1 px `scale` ring). The fired quills regrow from 0 to full over 30 f.
  - **Baby:** bristles into a puffball (squash 1.15 wide). One nub pops off, bounces, and it sneezes.
- **Ambient:**
  - Quill ripple: each quill leans 15° toward upright in turn, from rump to neck, 4 f apart, every 240 ± 60 f (only at `mood` ≥ 0).
  - Idle fidget: it grooms its quills with its head turned back (40 f).

### 3.4 ROCK: "Cobble", the boulder dragon
**Identity and care.**
- Calm, sleepy, stubborn and patient: **the easiest baby to raise.**
- It eats pebbles, sunbathes, naps longest and tucks under its dome like a turtle when upset.
- **Crystals grow on the dome as its bond grows** (count), and their glow shows its mood (brightness). Every rock hatches with one seed crystal, so even a new baby has a mood read.

**The cue: the boulder dome.** A faceted carapace over the back, plus a heavy, low stance (the lowest clearance in the cast).
- **Construction.** One `celPoly` drawn after the body.
- **Rim.** It overhangs the flank by 2 px and is inked, so it reads as a shell.
- **Facets** are tone steps with no lines: `marking.hi` `#a87a4e` on the lit left facet, the base colour on top, `marking.sh` `#53423d` on the right.
- **Head.** Carried below the dome top.

| Feature | Baby | Young | Adult |
|---|---|---|---|
| Dome, width × rise above the back, facets | 12 × 5, 1 facet: a pebble backpack | 22 × 7, 3 facets | 34 × 11, 5 facets |
| Crystals: `flat()` `glow` polygons with ink, on the rear third; the count grows with bond | 1 seed crystal, 2 × 3, from hatching | 1 to 2 (the seed grown to 3 × 5, + one 3 × 5) | 1 to 3 (3 × 5, 4 × 7, 3 × 5); one `glow.hi` facet on the 4 × 7 crystal only (on a 3 px crystal a facet would be under 2 px) |
| Nose horn: one, blunt, on the snout, pointing up and forward, near palette | 2 × 3 nub | 4 px, r 2 → 1.5 | 5 px, r 3 → 1.5 |
| Brow ridge | none | 2 px | 3 px, a contour bump in the skull path only. No lid over the eye at neutral: a permanent hood made the neutral face read as `sleepy` |
| Tail | short and thick (root r × 1.2); the tip rests on the ground; tip radius capped at 2 (≤ 4 px, water's zone rule), blunt by its round cap, no club | same | same |
| Wings: slate | a nub under the dome rim | stubby, 0.7× span, 2 spars, 1 px scallops | stubby, 0.7×, 3 spars; flaps hard and hops 3 px. It cannot fly: its adult reward is the **boulder hop** (4.2) |
| Markings | the dome is the marking | same | same |

- **Mood.** The dome never changes, so the cue is always at 100 %.
  - `mood` ≤ −0.3: crystals drawn in `glow.sh` `#7761cf` (`moodTones().banked`), 52 % below the lit colour. They are dim, but still outlined, so the count still reads (136° of hue from the dome). The first draft's `mix(glow, scale, 0.5)` came out *lighter* than the lit crystal.
  - `mood` 0: `glow`.
  - `mood` +1: `glow`, plus a 2 × 2 `#f8f4ec` glint travelling across the crystals.
  - **Two tucks that must never be confused**, because they ask for opposite responses (leave it alone, or comfort it):
    - **Sleep tuck:** the head rests on the ground *outside* the rim, snout forward, eyes `closed`; the tail wraps forward; the crystals go to `glow.sh`; "z" glyphs rise. Breath slows to 240 f.
    - **Upset tuck:** head and legs pulled under the dome, but the front rim is raised 6° to open a 4 px slit where one `sad` eye peeks out; a 1 px tremble every 8 f; the crystals flicker between `glow.sh` and `glow` every 12 f. No "z".
- **Adult-only extra:** the 3-crystal cluster.
- **Signature: Gravel Roar.**
  - **Tell:** the crystals flash `glow.hi` for 4 f, twice, and the head lowers.
  - **Blast:** jaw at 25°.
    - A cone of 5 dust puffs: `scale`, **opaque**, r 3 → 7 as they travel, 5 px apart, no ink, sinking 0.1 px/f, then shrinking away in 3 steps. Never alpha: at α 0.85 the dust sat 23 % from the floor.
    - 4 pebbles: 3 × 3 in `marking`, ink-outlined, ballistic (gravity 0.15 px/f²), bouncing once.
    - The root jitters ±1 px for 12 f.
  - **Young:** 3 puffs and 2 pebbles.
  - **Baby:** "ptoo", a single pebble drops out, then `happy` with the chin raised 6° (proud).
- **Ambient:**
  - A crystal glint every 200 ± 60 f.
  - A 2 × 2 dust puff (opaque `scale`) at a paw on each weight shift.
  - A pebble crumb rolls off the dome every 300 ± 60 f.
  - Idle fidget: it sunbathes flat with its eyes closed (120 f).

### 3.5 LIGHTNING: "Zap", the storm dragon
**Identity and care.**
- Hyper, zippy and curious. It needs play and exercise.
- **Static builds from boredom:** with no play for a while, its crackles come faster (ambient, below), and the next touch discharges it: it zaps you (`zap`, 4.2), then looks `sheepish`. Play drains the charge. (Spike reacts to *where* you pet it, so the two never punish the same mistake.)
- It naps in short bursts, like a lamp being switched off.

**Why the body is blue and not yellow.** Yellow scales would sit within 20° of fire and rock. A cobalt body with a yellow signal colour reads "electric" instantly, because yellow on blue is the storm pairing (R and G agreed).

**The cue: bolt wings, held cocked.**
- **Pose.** At rest the wings stand cocked at **115°** (in the 1.1 convention: measured from +x forward, positive up, so 115° leans 25° *back* from vertical) with the spars closed. The yellow membrane, with a zigzag trailing edge on a blue body, reads as a lightning bolt.
- **Root.** 3 px behind the generic wing root of 2.1: young (+1, −8), adult (+2, −9). The baby's nubs root at (−3, −6), over the hips, because its head covers everything from x −1.5 forward (the generic root at (+1, −6) is *inside* the baby cranium).
- **Adult polygon.** In wing space (root at (0, 0), +x forward, up negative), as drawn at the rest cock:
  - leading edge: (0, 0) → (−3, −13) → (−8, −28);
  - zigzag trailing edge: (−8, −28) → (−14, −17) → (−10, −17) → (−15, −8) → (−11, −8) → (−8, 0);
  - one 3 px leading spar in `scale`.
  - It is a simple polygon, 15 × 28. Each zigzag shelf ends 5.7 and 9.2 px behind the leading edge, so the 3 px spar plus at least 2 px of yellow survive at both steps.
- **Cock.** The polygon rotates about its root by (cock − 115°): sad 140° keeps 79 % of the rest height, excited 95° reaches 104 %.
- **Young polygon.** The adult's, scaled to 16 × 7 (× 7/15 across, × 16/28 up).
- **Far wing.** Offset (−4, −2) and turned **+8°** (further back), so a double bolt shows.
- **Clearance** (rest solve, horns rooted at the top-back of the cranium): the tip stays ≥ 10 px from the horn tips at rest and when sad (adult 21 px, young 11). Excited, it comes to 14 px (adult) and 6 px (young), which is when sparks jump between them. The polygon never comes within 6 px of the cranium in any mood.
- **Folding.** The wings **never fold flat**. Asleep they drop to the sad cock (140°) with the spars closed, and the horns keep their colour, so the sleeping silhouette still names the element (5.1 #1).

| Feature | Baby | Young | Adult |
|---|---|---|---|
| Bolt wings, h × w, notches, rest cock | 2 bolt nubs, 12 × 5, one zigzag step 2 px deep at 55 % of the height, a pointed tip, at 105° from (−3, −6): the only upright shape behind a baby's head (about 37 px² of it clears head and body) | 16 × 7, 2 notches, 115° | 28 × 15, 2 notches, 115° |
| Horns: 2, swept back, with one kink at 60 % of their length | 3 px buds | 5 px, r 1.5 → 1 | 8 px, r 1.5 → 1 |
| Back row | none | none | none |
| Tail | thin, straight and stiff; a plain sharp taper; motion is stepped (4 f holds) | same | same |
| Markings: yellow Z-stripes, 3 px thick, below the wing root, ≥ 3 px above the belly line | 1 (shoulder), 6 px tall | + haunch, 7 px | + tail base, 9 px |
| Build | lean (depth 0.85), long legs (1.2), head high | same | same |

- **Mood:** cock 140° (sad; the spire keeps 79 % of its rest height) → 115° → 95° (excited). The baby nubs run 125° → 105° → 95°.
- **Adult-only extra:** **charge**. When `mood` > 0.5, sparks crawl between the horn tips and the wing tips.
- **Signature: Spark Bolt.**
  - **Wind-up:** the wings flare to 95°. 2 × 2 spark crawlers in `glow` hop between the horn tips and wing tips every 3 f for 18 f, and the pupil contracts.
  - **Bolt:** a 4-segment polyline from the mouth, with segment lengths 8 / 6 / 8 / 6 and kinks of ±30°, seeded and re-rolled every 4 f. It is drawn as a 3 px filled zig polygon in `glow` with a 1 px ink outline, plus a 1-segment fork and a 5 × 5 impact diamond at the tip. Lifetime 20 f.
  - **Tint:** the dragon gets the engine's offscreen tint, `glow` at α 0.35, for 2 f.
  - **Young:** 2 segments.
  - **Baby:** a 4 f "static pop". One 2-segment spark from the nose, every feature raised +1 px (hair on end), then `dazed`.
- **Sparks that reach the floor** (the spark shower, the zap, the dream-twitch spark) carry a 1 px `scale` ring: bare `glow` sits 25 % from the floor, on the line.
- **Ambient:**
  - Crackle: a 2 × 2 spark on a horn or wing tip for 4 f, which hops 3 px for 4 more, every 120 ± 40 f (every 30 f when excited, and faster as boredom charge builds, down to 40 f).
  - Idle fidget: **zoomies**, dashing 40 px and back (50 f).

### 3.6 WATER: "Ripple", the tide dragon
**Identity and care.**
- Gentle, curious and playful.
- It loves baths: a bath is instant happiness.
- Its spots dim when it dries out or is sad.
- It sings in bubbles, follows toys and floats belly-up in the pond.

**The cue: the fluke tail.** A vertical crescent fluke at the end of the longest, flattest, level body in the cast (the body and tail form a bar about 3.5 : 1).
- **Construction.** The fluke is `membrane` with 2 tones (no highlight) and 2 px rays in `horn`.
- **Notch.** A central notch ≥ 3 px deep keeps both lobes readable.

| Feature | Baby | Young | Adult |
|---|---|---|---|
| Fluke, h × depth | round paddle 10 × 6, no rays, on a thinner tail (r 3.5 → 1.5, 2.3): a tadpole paddle clearly wider than the tail that carries it | crescent 11 × 6, 2 rays | crescent 16 × 8, 3 rays, notch ≥ 3 px, and a 2 × 2 `glow` dot set 2 px in from each lobe tip (the tips themselves are under 3 px wide) |
| Fin-ears: behind the cheek, pointing back along the neck, never up | 3 × 3 lobe | 5 × 4, no rays (a smooth lobe: two 2 px rays would fill it) | 7 × 6, 1 ray, with 2 px of membrane either side (≤ half the shriekscale fan) |
| Horns | none: a smooth, domed forehead | none | none |
| Dorsal fin: low, continuous, round scallops, `membrane` | none | 2 px, 2 scallops | 3 px, 3 scallops (inside spike's zone budget) |
| Wings: fin-wings with a rounded, smooth trailing edge and no scallops | nub | 3 rays | 4 rays |
| Markings: pearl spots, 3 × 3, on the lateral line, ≥ 3 px apart | 2 | 3 | 5 |
| Build | long (1.1), low legs (0.8), long neck (1.3), long level tail (1.15) | same | same |

- **Mood.** Three spot states, each ≥ 40 % from the next (gate h):
  - `mood` ≥ +0.5: spots swap to `glow` `#40d8f0` (40 % from the resting spot; the first draft's `#7ff4ff` was only 18 % from it, and the marking is too grey for hue to count), and the fin-ears **flare**: the ray fans 2 px longer backward, rising no more than 10° above the neck line.
  - rest: spots in `marking` `#dcfff6`.
  - `mood` ≤ −0.3 (dry or sad): spots dim to `moodTones().dimSpot` `#7ed1e2` (41 % from the resting spot, 44 % from the scale), the fin-ears droop 30° and the fluke droops 15°. The fluke keeps its full size.
- **Adult-only extra:** the lobe glow dots and the dorsal fin.
- **Signature: Bubble Jet.**
  - **Wind-up:** cheeks puff (head squash-x 1.1) and the fins flare.
  - **Stream:** 8 bubbles, r 2 to 5, along the jaw direction.
    - Each rises 0.2 px/f with a ±1 px wobble, stepped every 4 f.
    - A bubble is a `glow` fill at α 0.45, a 1 px ring in `membrane` (so it reads on a pale floor) and a 2 × 2 `#f8f4ec` highlight at the top-left.
    - A pop is 2 f of a 4-dot star.
  - **Droplets:** 4, each 2 × 3 in `glow` with a 1 px `membrane` ring, in an arc.
  - **Young:** 4 bubbles.
  - **Baby:** one big bubble grows on its own snout, r 2 → 6 over 30 f, then pops in its face (blink, happy).
- **Ambient:**
  - A drip (2 × 3 `glow` with a 1 px `membrane` ring; bare `glow` sat 12 % from the floor) falls 8 px from the chin or a fin-ear tip and splashes into 2 ringed dots, every 180 ± 60 f.
  - The spots "breathe", swapping `marking` → `glow` for 30 f every 240 f, stepped, **only at `mood` ≥ 0**, so a sad water dragon never flashes happy.
  - Idle fidget: a dog-style shake that throws droplets (36 f).

### 3.7 SHRIEKSCALE: "Echo", the night-singer

> **This element is an interpretation.** The user gave only the name "shriekscale". The reading here:
>
> - "Shriek" means the voice is the element, so shriekscale is a **sound dragon**. It is a nocturnal, echolocating cave dragon, a mix of bat, fennec fox and frilled lizard.
> - Its big **ribbed ear-fans** catch sound, and flare into a dish when it shrieks.
> - Its sound is drawn as **expanding arcs**.
> - "Scale" is also read as a **musical scale**. When happy it sings a rising 3-note scale, and its adult ear ribs are the "shriek-scales" that rattle when it screams.
>
> **Why this reading:**
> 1. Sound is the only one of the six elements that is naturally invisible. It needs a body part that makes it visible (the fans) and an effect (the arcs).
> 2. The **head** is the one silhouette region no other element uses. Head-doubling fans make it as instantly readable at 24 px as the other five.
> 3. Big ears are the strongest baby-animal cue there is (fennec kits, bat pups), so the baby shriekscale doubles as the mascot.
> 4. Sound gives it a voice in the care loop: it chirps when content, shrieks when lonely and sings when happy.
>
> If the user meant something else, two things change: the palette column and the head-zone cue. Everything else is parameters.

**Identity and care.**
- Dramatic, clingy and nocturnal.
- It shrieks for attention when lonely, chirps when content and sings when happy.
- Loud noises make it flatten its fans.
- It is the hardest to settle, and it bonds the deepest.

**The cue: ear-fans.**
- **Construction.** Membrane on 2 px `horn` ribs. The fans are rooted at the back of the skull (−0.6 r), behind the eye, so they never cover it. The baby's are rooted **on top of the cranium** instead, so they read as ears on the head and stay well clear of baby lightning's bolt nubs over the hips.
- **Ribs** start 4 px out from the root (where the fan is too narrow for them) and keep ≥ 2 px of membrane between them, 3 px at the free edge: adult 3 ribs × 2 px + 2 gaps × 3 px = 12 px. The far fan has no ribs (1.5).
- **`flare`, driven by mood:**
  - −1 (scared, sad, asleep): laid back along the neck, still ≥ 60 % of the silhouette above the neck line;
  - 0 (rest): up and back at 40°;
  - +1 (curious, happy): upright;
  - shriek: a full dish, 1.3× the area.

| Feature | Baby | Young | Adult |
|---|---|---|---|
| Ear-fans, h × w, ribs, edge | 10 × 8, 1 rib, round (fennec ears), on top of the cranium | 12 × 9, 2 ribs, 1 back-edge scallop | 16 × 12, 3 ribs, 2 scallops 2 px deep |
| Horns | none: the fans replace them | none | none |
| Eye mask in `marking` (lilac `#9a6aa8`), from the snout base to behind the eye (the mint iris sits inside it): a pale "spectacles" patch on the dark head. The ink face marks read on it (97 %) as they do on every other dragon, and it clears the head's shadow (86 %) and highlight (53 %) tones | 6 px tall, present from hatching | 6 px | 7 px |
| Throat sac: a `membrane` bulge in the neck's lower contour, just behind the jaw (1.2), inked with the neck; shown only while shrieking | swells 3 px | 5 px | 7 px |
| Legs | thin, bat-like (leg r × 0.75): flat at every stage, so the far leg never has to clear a shadow band (D8) | same | same |
| Jaw | depth 1.3, opens to 40° | same | same |
| Tail | a whip (r × 0.7), plain taper, no barb | same | same |
| Wings | nub | bat, 3 spars, 3 px scallops | bat, 4 spars, **5 px scallops**, 3 px thumb claw |
| Markings | eye mask | eye mask + 1 "volume-bar" chevron on the tail, 3 px | eye mask + 2 chevrons |

- **Adult-only extra:** the ribs rattle during a shriek (±1 px, every 2 f), plus a 4 × 4 nose-leaf bump in the skull path.
- **Signature: Shriek.**
  - **Wind-up:** the fans fold flat over 10 f, the head pulls back, and the throat sac swells.
  - **Release:** the fans snap to a full dish in 4 f with an overshoot, and the jaw opens to 40°.
  - **Arcs:** 3 sound arcs expand from the mouth, radius 6 → 34 px over 24 f, one spawned every 8 f.
    - Each arc is `membrane` `#ff6fae`, 2 px thick, flat, with a 1 px `scale` outer edge (47 % and 92 % from the floor). In `glow` at the old alpha steps it sat 23 %, 16 % and 9 % from the floor.
    - An arc fades by **narrowing**, never by alpha: its span steps ±35° → ±25° → ±15° around the facing direction.
  - **Neighbours:** `event: 'shriek'` lets up to 2 nearby dragons flinch (spike bristles).
  - **Young:** 2 arcs, out to 24 px.
  - **Baby:** a squeak. One arc (r 4 → 14), then its fans flop over its eyes for 24 f, a gag (ledger E8), and pop back up.
  - **The lonely call is a different animation** from this trick: fans at −1, jaw 25°, one long arc, the `sad` face, no overshoot and no flinch; neighbours turn their heads toward it instead. The trick keeps the dish, the 3 arcs and the flinch.
- **Ambient:**
  - Echolocation chirp: a small arc in the same style (r 3 → 9, span ±15°) from the snout, every 150 ± 50 f.
  - Fan twitch: one fan flicks +0.3 flare for 6 f, alternating near and far, every 120 ± 40 f.
  - Happy: it **sings**. 2 to 3 note glyphs (a 3 × 3 ball with a 2 px stem, in `glow` with ink) float up in the top pass, rising in pitch.

---

## 4. ANIMATIONS

### 4.1 Pose channels and secondary motion
**`DragonPose`.** Authored as partial frames in the engine's `Frame` shape (`dur`, `pose`, `ease`, `interp`, `face`, `fx`, `event`) at 60 Hz. `AnimPlayer` / `lerpPose` are typed to the humanoid `Pose`, so the dragon gets a sibling player (or a pose-ops interface) that reuses the frame format unchanged.

Channels:
- `root {x, y, rot}`, `squash`, `body {rot, y}`
- `neck {a0, a1}` (degrees added per segment), `head {rot}`, `jaw` (degrees)
- `legNH`, `legNF`, `legFH`, `legFF` `{upper, lower, paw}` (near and far, hind and front)
- `tail {lift, curl, sway}` (added on top of the rest shape and the chain)
- `wing {fold, flap}`, `mood` (−1 to +1, drives the cue), `bristle` (spike's alarm one-shot, 0 to 1, separate from mood: 3.3), `flare` (shriekscale)
- `face` (DFACE, stepped)

**Tail chain.** `getChain(rig, 'tail', n, { joint: 'rump', rest, stiffness, damping, gain, follow, maxAng: 30 })`, where `rest` is the direction of the tail's rest shape. `maxAng` 30 keeps a tail from folding through the body.

| Stage | stiffness | damping | gain | follow | Result |
|---|---|---|---|---|---|
| Baby | 0.20 | 0.65 | 2.6 | 0.15 | a stiff, springy wag from the root |
| Young | 0.14 | 0.70 | 2.2 | 0.35 | |
| Adult | 0.10 | 0.78 | 1.6 | 0.5 | a slow, heavy wave that travels down the tail |

Lightning's tail is **stepped**: it snaps between poses on 4 f holds instead of swaying.

**Stage timing rules:**
- **Durations:** baby about 0.6× the adult, young about 0.85×.
- **Squash range:** baby 0.85 to 1.15, young 0.94 to 1.06, adult 0.96 to 1.04.
- **Head lag:** the baby's head follows the body 6 f late at 2× amplitude (a heavy head on a small body). The adult's follows 8 f late at 1×.
- **Easing:** babies use `out` (bouncy, quick to settle). Adults use `inout` (weight). Young adults overshoot.

**Desync.** Every loop starts at a random phase, with duration ±10 % per dragon, so the habitat never breathes in lockstep.

### 4.2 The core set
Adult key beats are in frames at 60 Hz. The young and baby columns give only what differs.

| Anim | Adult | Young | Baby |
|---|---|---|---|
| **idle** (loop) | 120 f. **Inhale** 0 to 56 (`inout`): body y −1, squash 1.03, wing knuckle +1 px, neck a0 −2°. **Exhale** 56 to 120. The head follows 8 f late. The tail sways ±5° over 150 f, out of sync with the breath. Blinks run at runtime every 180 to 300 f. **Variants** every 6 to 10 s: look-around (head ±12°, 40 f), yawn (jaw 30°, 40 f), hind-leg scratch (36 f), and the element fidget (section 3). | 100 f; tail ±8° over 100 f; a curious head tilt of ±5° | 72 f; bob 2 px with squash 0.97 ↔ 1.03; head wobble ±4°, 15 f behind; the tail **wags** ±12° over 48 f; 30 % of blinks are double blinks. Its scratch variant topples (root rot 20°, 48 f, then recovers). One loop in four is a **plop-sit**: hind legs fold over 10 f, it sits for 60 f, then pops up over 6 f with stretch 1.1. |
| **walk** (loop) | 48 f = 8 keys × 6. **Lateral-sequence gait:** NH → NF → FH → FF, legs 25 % apart in phase, stance 60 % / swing 40 %. Contact: upper +20°. Passing: upper −15°, lower +35°, paw lifted 3 px. The body dips 1 px at each hind contact. The head counter-bobs 1 px, 4 f late. Neck ±3°. The tail sways ±5° against the hips. Folded wings jiggle 1 px. Speed 0.45 px/f. | 40 f (8 × 5), paw lift 2 px, 0.5 px/f (teens are quick) | **24 f (8 × 3)**, so the stubby legs churn. Waddle: root rot ±4°, bounce 2 px at every contact, 0.3 px/f. One cycle in 6 stumbles (a face-plant squash of 0.85 for 12 f, then a head shake for 12 f). |
| **happy** (one-shot: pet, feed, play) | 72 f, **no hop: it preens.** Chest puff 0 to 14 (body rot −6°, neck a0 −10°). Wings to 0.8, held 14 to 30. The tail sweeps ±20° twice at 12 f each, 30 to 54. Settle 54 to 72. Face `happy` from 10 to 60, jaw 10° (the adult minimum). Element flourish at f 14 (rock's runs longer: 4.3). `mood` jumps to +1. | 64 f: one hop (−5 px) with half-spread wings (0.6), 3 wags at 10 f each | 60 f: **two hops.** Crouch 0 to 6 (squash 0.88). Hop −6 px, 6 to 16 (stretch 1.12, wings flutter 2 × 5 f). Land 16 to 22 (0.90). Hop −4, 22 to 28. Land 28 to 34. Wag ±25° at 8 f per swing, 34 to 60. Jaw 20° (the baby minimum) with the tongue out. |
| **eat** (one bite; the bowl is drawn after the dragon) | 84 f. Neck down to the bowl 0 to 20 (`out`, a0 +35°, head +25°). Jaw 20°, 20 to 26. **Chomp** 26 to 29 (jaw to 0, stepped) with 3 crumbs (2 × 2). Lift 4 px, 29 to 35. Chew: jaw 0 ↔ 10° on 6 f beats × 3 with a 1 px head bob, 35 to 71. **Gulp** 71 to 78: a bulge in the neck contour (one neck node grows 2 px) travels from the head to the chest in 3 stepped positions, and the eyes close. A ball inside the throat stripe would change nothing on screen. Tail swish 78 to 84. | 72 f | 56 f: **the snout plunges** 3 px behind the bowl rim, 2 chomps, 5 crumbs spray, a 2 px chew bob, `happy` on the swallow, a 6 f tongue lick |
| **sleep** (lie-down → loop → wake) | **Lie-down**, 40 f: hind legs tuck (upper +70°, lower −140°), front paws fold under the chest, the belly settles to the ground, the head rests on the paws, the tail wraps forward (curl +18° per segment), wings fold (lightning's drop to the 140° sad cock instead: 3.5), `closed` from f 20. **Loop**, 180 f: breath 90 / 90 (squash 1.00 ↔ 1.03, y 1 px). Every 120 f a "z" glyph drifts up 12 px over 60 f in the top pass: 6 × 6 in `belly` with a 1 px ink outline, rows 0–1 full, row 2 at columns 3–4, row 3 at columns 1–2, rows 4–5 full (at 5 × 5 the diagonal had one row and read as "≡"). **Wake**, 30 f: stretch (front legs forward, rump up, body rot +10°), **full wing spread for 12 f**, yawn (jaw 30°, 16 f), shake (root ±3°, 3 × 4 f). | lie-down 34 f, loop 150 f | lie-down 24 f; loop **120 f** (60 / 60) with a dream-kick paw twitch (6 f) at f 90 and a "z" every 90 f; it curls into a tighter bun with the wing nubs over its head (the tuck branch, 1.4); the wake has a flutter instead of a spread |
| **breath** (signature, one-shot) | 70 f. **Wind-up** 0 to 18: head back −8°, neck a1 −10°, chest squash 1.05, the element's tell. **Snap** 18 to 24: head forward +12° (`out`), jaw 30°, root recoils x −1. **Sustain** 24 to 54: the effect stream; the head jitters ±1 px every 4 f; the tail is stiff. **Recover** 54 to 70: the jaw closes, `happy` for 10 f (proud). | 56 f (14 / 5 / 22 / 15), jaw 22°, half-strength effect, a 3 px recoil (still learning) | 36 f (10 / 4 / 8 / 14), jaw 20°: **it always fails, adorably** (the per-element fizzle in section 3), then `dazed` for 12 f and a 2 px sneeze-back ("did I do that?") |
| **pet** (loop while held) | 48 f: the head leans 15° toward the hand, `happy`, blush, the tail wags, a 1 px purr vibration every 4 f, `mood` +0.2 per loop | 44 f | 36 f; the whole body leans in and the root rotates 6° |
| **beg** (hungry idle, loop) | 120 f: sits with the head tilted up, `hungry` face, cue at `mood` −0.5. A stomach growl every 120 f (3 shakes of 1 px, 2 f each). | same | same, with a bigger head tilt |
| **grow-up** (stage transition, the biggest reward in the game) | n/a | 240 f, the same for baby → young and young → adult. Curls into the sleep bun. 3 tint pulses in `glow` (the engine tint, α 0.3 → 0.8), speeding up: 40, 30, then 20 f apart. Squash 0.8, then the **new proportion set is swapped in** with stretch 1.2, and the **new silhouette flashes flat `glow.hi` at α 1.0 for 12 f** before its colours return, so the new shape is seen before any detail. 6 to 10 old-skin flakes (2 × 2 and 3 × 2 in `scale`) fall. Then a "look at me" pose, **held until the player taps**: the new cue flashes once, the wings spread if newly allowed, `happy`. | the same 240 f |
| **hopGlide** (young; the baby → young reward) | n/a | 56 f: crouch 0 to 8 (squash 0.9); leap −10 px with 2 wing flaps of 6 f; glide 24 px forward on spread wings (`wing` 1); land 46 to 56 (squash 0.92, wings fold). Rock: a 3 px hop with the stubby flaps. | n/a |
| **fly** (adult; the young → adult reward) | take-off 30 f (crouch, spring, 2 hard flaps); flap loop 24 f at `flap` ±40°, the legs trailing, the tail as a rudder; land 24 f. **Lightning** flaps its cocked bolts ±20° about 115° with the spars closed, so the spire never turns into a bat wing. **Rock** cannot fly: its reward is the **boulder hop**, 50 f: crouch 10 f (squash 0.88), a heavy hop of −6 px with 3 hard flaps of 4 f, a landing of 8 f with a ring of 3 dust puffs and a 1 px root jitter. | n/a | n/a |
| **bath** (one-shot, per element) | **water:** flops belly-up and splashes (90 f, `happy`, `mood` +). **fire:** hisses (jaw 10°, `grumpy`), the flame shrinks to 0.6× and gives off 3 steam puffs (flat `#f8f4ec` discs with a 1 px `scale` ring), then a dog-style shake (60 f). **The others:** a shake that throws 4 droplets (36 f). | same | same, with the baby squash range |
| **play** (one-shot, with a toy) | 60 f: crouch 12 f, a butt-wiggle of 3 × 4 f, pounce −6 px forward, bat the toy with the near front paw, `happy`. Lightning's play drains its static charge (3.5). | 54 f | 48 f; the pounce often overshoots and plops (1 in 3) |
| **refuse** (one-shot: disliked food, a bath for fire) | 48 f: the head turns away −20°, `grumpy`, a tail flick, then back to idle. | same | same, plus a 2 px stamp of the near front paw |
| **zap** (lightning only) | 40 f: a spark crackles at the touched point, the bolt wings snap to 95°, a recoil of −3 px, then `sheepish` with the wings back at 115°. | same | same |

### 4.3 Element overrides on the shared set
| | Walk | Happy flourish (f 14) | Hungry tell (beg) | Sleep pose (must read as asleep across the room) |
|---|---|---|---|---|
| **Fire** | a show-off **strut**: paw lift 5 px, head up 4°, the flame's tongues swap every 4 f while it walks | 3 embers; flame 1.4× for 30 f | flame 0.6×, sighs smoke puffs | curled round the tail; flame banked to an ember in `glow.sh` |
| **Spike** | a shy **creep**: 0.35 px/f, head down 8°, a 24 f stop-and-look every second cycle; when another dragon is within 30 px the quills lean 15° toward upright (wary, no bristle size-up) | quill ripple, then the quills settle at the perky 20° | the quills droop (`mood` −0.5: 43°) | curls into a quill ball (body rot +30°, quills upright but with no size-up or tremble, so it reads as a ball, not an alarm) |
| **Rock** | 60 f cycle; a 2 × 2 dust puff on every other hind contact | a slow roll onto its back, belly up (90 f), no preen; its `happy` runs 110 f so the roll fits | stares at pebbles and licks a rock | the **sleep tuck** (3.4): head resting on the ground outside the rim, eyes `closed`, tail wrapped forward, crystals `glow.sh`, "z" glyphs; breath slows to 240 f. Never the upset tuck. |
| **Lightning** | 20 % faster; the tail is stepped | 3 crackles and a spark shower | sparks come out irregular and jittery | the bolt wings drop to the 140° sad cock with the spars closed (they never fold flat); the horns keep their colour; eyes `closed`; a dream-twitch every 6 loops (leg kick + 1 spark) |
| **Water** | slinky: body rot ±2°, the neck and tail carry an S-wave 8 f behind the legs | 3 bubbles; the fin-ears flare | spots dim, it licks its lips | spots pulse with each breath; a nostril bubble (r 2 → 4) on each exhale; floats belly-up if in water |
| **Shriekscale** | the fans bob 1 f behind the head | sings a 3-note rising scale (note glyphs) | one short chirp arc every 60 f, fans pinned forward | the fans lie back flat along the neck (flare −1) with their tips curled 20° down, so the `closed` eye stays in view; a small snore arc (r 3, span ±15°) on each exhale |

---

## 5. READABILITY CHECKS

### 5.1 Failure modes, what prevents them, and how each is checked
| # | Risk | Prevention (hard rules) | Check |
|---|---|---|---|
| 1 | **Two elements read as the same dragon** by shape | One zone per element. Quiet-zone budgets (3.0). Tail-end, head and back budgets. The cue is ≥ 60 % at `mood` −1. | **Silhouette sheet:** all 18 as flat `#1a1018` at idle, walk keys, lowest mood and the sleep pose, reduced ÷ 3 (the humanoids' own 72 → 24 px ratio) by **area coverage** (box filter, a pixel is ink when ≥ 50 % covered), at **3 sub-pixel phase offsets**. A viewer must name every element at all three phases. Expected shapes: U / saw / dome / spire / bar-and-crescent / big head. (Nearest-neighbour to 24 px wide was ÷ 4.4 to ÷ 5.1 on adults, and whether a 3 to 10 px feature survived depended on sub-pixel phase.) |
| 2 | **Two elements read as the same dragon** by colour | Value-stacked bodies (D9). | Gate (b), plus the colour-blind gate (f), which applies the same RULE_B: **all 15 pairs pass in normal vision, deuteranopia and protanopia; none passes on hue alone in normal vision.** |
| 3 | **Stages confused** | Head : height ratio 52 / 40 / 34 %. Eye aspect 7 × 8 / 7 × 7 / 8 × 6. Visible neck. Snout 2 / 6.5 / 9. Seed → sprout → signature. Each step ≥ 1.28× length. | Stage contact sheet: every element's three stages side by side. |
| 4 | **Adjacent parts fuse** (the "gold blob") | The ladder between every touching pair. The folded wing stays ≥ 5 px above the belly line. Markings stop ≥ 3 px above the belly line unless belly / marking passes. | Gate (a), 11 core pairs (including the shadow and highlight tones a pigment edge crosses) + element extras + face pairs. Thinnest by value: lightning glow / membrane 26 %, rock membrane / marking 28 %, water scale.sh / membrane 29 %; rock membrane / horn passes on hue alone (157°). |
| 5 | **Far side fuses** (a two-legged or one-winged read) | Far legs at 0.55 / 0.30 (D8); shriekscale's legs thin and flat. Leg joints at gap/2 + X, so the near legs leave ≥ 3 px of background at rest (2.1). Far paws 2 px up and splayed ±4 px. Far horn and fan offsets. The ≥ 3 px sliver rule. No far eye, claws, markings, ribs or rays. | Gates (c1 to c3) and (e), with a 6-point Oklab L floor on the dark pairs (the luminance ratio alone is lenient in the darks). Walk contact sheet: all four legs countable at all 8 keys. |
| 6 | **Membrane vanishes into the body shadow** | Dark membranes below the scale's own shadow tone (D11), or signal membranes. No highlight on a membrane. | Gate (a) scale / membrane and scale.sh / membrane; gate (c) far membrane. |
| 7 | **Markings read as shading** | A marking is ≥ 25 % (or ≥ 40° of hue) from the base, the shadow and the highlight tones it crosses, and from the belly. | Gate (a) scale / marking, scale.sh / marking, scale.hi / marking, belly / marking. |
| 8 | **Emitters look like objects** | Flame, crystals, bolts, sparks, bubbles, dots and arcs are `flat()`, never banded. The only light marks on them are the listed cores and facets. | Recorder check (to build): no `celPath` call on an emitter part. |
| 9 | **Marks eaten by the mark floor** | The table in 5.2. | Recorder check (to build): no rect or stroke under 2 px except the ink and `rimTop`. |
| 10 | **Tone noise on small parts** | The engine gates decide. Never override `thinR` / `hiMin` / `flatR` per rig. | Recorder: band count per part. |
| 11 | **The eye gets covered or loses its catchlight** | The head is drawn last (tuck poses: E9). Every iris is ≥ 31 % from the catchlight. The adult slit has iris on both sides, so it never merges into the ink ring. | Gate (a) eye / catchlight. Frame-by-frame review of eat and sleep. |
| 12 | **Shimmer under nearest-neighbour upscaling** | Flames, sparks and bolts switch keys every 3 to 6 f, never tweened. Alpha changes in 3 steps. Effect positions are rounded to whole pixels. Joints snap to the device grid. | Visual review of the `tools/shot.ts` sequences. |
| 13 | **A crowded habitat turns to mush** | See 5.4. | A habitat shot with 8 dragons. |
| 14 | **The dragon's underside or its effects vanish into the floor** | Every scale, every belly and the outer colour of every floor-level effect sits ≥ 25 % from the floor (5.4). Effects fade by shrinking or narrowing, never by alpha. | Gate (i). |
| 15 | **A mood change cannot be seen** | Every colour a mood swaps between passes the ladder (fire's banked flame, rock's dim crystals, water's three spot states). | Gate (h). |

### 5.2 The mark floor (no mark under about 2 px)
| Mark | Minimum size | Stages |
|---|---|---|
| Pupil | 3 × 4 (baby and young); 2 × 4 slit with iris on both sides (adult) | all |
| Catchlight | 2 × 2, never 1 px | all |
| Brow, brow ridge | 2 px bar | young and adult; babies only in expressions |
| Nostril, egg tooth, fangs | 2 × 2 (adult fangs 2 × 3) | all / baby / young and adult |
| Claws | 2 × 2 (young), 2 × 3 (adult), 2 px gaps, **un-inked**; **none on far paws or babies** | young, adult |
| Wing arm and spars | 3 px (adult), 2 px (young); none on baby nubs | young, adult |
| Fan ribs, fin rays | 2 px, with ≥ 2 px of membrane between them and the edge (fans: 3 px at the free edge); ribs start 4 px out from the root; none on far fans | all that have them |
| Quills | base ≥ 4, plain `horn`, no dark tips | all |
| Eye lids | ≥ 2 rows including their own 1 px ink edge, counted in rows per stage (2.5), never as a percentage | all |
| Open jaw | ≥ the stage minimum (baby 20°, young 14°, adult 10°), so the mouth wedge is ≥ 2.5 px | all |
| Stripes, rings, bolts, flame-licks, chevrons | ≥ 3 px thick | per marking count |
| Spots, glow dots, sparks, embers, crumbs | ≥ 2 × 2 (spots 3 × 3). A glow dot sits ≥ 2 px in from the tip it decorates. A crystal facet only on a crystal ≥ 4 px wide. No "+" sparkles with 1 px arms. | all |
| Sound arcs, sap streaks | 2 px, plus a 1 px dark edge | all |
| "z" glyph, dazed stars | 6 × 6 "z"; 3 × 3 stars; both inked | all |
| Water dorsal fin | ≥ 2 px tall; omitted on babies | young, adult |

**Banned outright:**
- scale texture of any kind (scales are implied by the cel bands, never drawn);
- belly-plate seams;
- whiskers;
- 1 px highlights, except the engine's `rimTop` on shapes whose extent is ≥ 10.

### 5.3 Shape budget (principle 22: about 45 cel shapes per rig)
The adult base comes to about 30 cel shapes: body, neck, 4 legs, 4 paws, tail, 2 wings (one silhouette each), jaw, skull, 2 horns and the eye group. With the element features:

| Element | Fire | Spike | Rock | Lightning | Water | Shriekscale |
|---|---|---|---|---|---|---|
| Adult (≤ 45) | 32 | 41 (8 quills, thorns) | 35 (dome + 3 crystals) | 33 | 36 (fluke, fins, dorsal, spots; 1 fin-ear ray) | 35 (2 fans + 3 ribs on the near fan) |

Babies come in at about 18 to 22 and young adults at about 26 to 32.

### 5.4 Several dragons on screen
- **Sorting.** Y-sort by feet. Every dragon has a ground-shadow ellipse and the full 1 px outline, so even two same-element dragons (a parent and its baby) separate when they overlap.
- **Effect ownership.**
  - Breath is drawn with its owner and always points away from its own body.
  - Rising particles go in the top pass.
  - Ambient particles are capped at 6 per dragon **and 12 across the whole habitat**, handed out by a round-robin scheduler so no dragon starves. With more than 4 dragons on screen, every ambient interval stretches 1.5×.
  - `event: 'shriek'` flinches are capped at 2 neighbours. The lonely call makes neighbours look, not flinch (3.7).
- **Telling pets apart.** Two same-element, same-stage pets differ by their seeded variant (2.8).
- **Motion.** Loops are desynchronised (random phase, ±10 % duration). Spread wings are events, never idle, so a crowd never becomes a wall of membranes.
- **Habitat floor constraint** (gate i).
  - The floor under the dragons must sit ≥ 25 % in luminance from every body colour **and every belly colour**: the belly is the bottom edge of the silhouette, and about 10 px of bare floor shows between it and the ground shadow. The floor's saturation is under 0.20, so hue can never rescue a pair.
  - Because the bodies span L 0.05 to 0.49, that means a **pale floor**. The reference is straw `#e0d6b8` (L 0.67), which clears all six bodies (rock is the closest, at 27 %) and all six bellies (28 to 49 %).
  - That forces every belly to sit ≤ 0.49 or ≥ 0.93 in luminance: fire, spike, lightning and water have mid-value bellies, rock and shriekscale near-white ones. The first draft's pale bellies sat 2 to 21 % from this floor on five of the six.
  - A mid-value or green floor fails: a grass floor would swallow spike.
- **Effect colours were chosen to survive that floor** (gate i measures each one). Every effect that can land on the floor carries a ring or edge in a dark slot, and fades by shrinking or narrowing, never by alpha:
  - fire puffs have a `scale` outer ring (66 %);
  - bolts, quills and pebbles are ink-outlined;
  - water's bubbles, drips and droplets have a `membrane` ring (85 %);
  - spike's sap streaks and sparkles have a `scale` edge (75 %);
  - lightning's sparks that reach the floor have a `scale` ring (82 %);
  - rock's dust is opaque `scale` (27 %);
  - shriekscale's sound arcs are `membrane` (47 %) with a `scale` outer edge (92 %).

### 5.5 Automated checks: what exists and what to build
- **Exists: `node tools/palette-check.ts`** (also `npm run palette`; `npm run check` runs it after the typecheck). It reads only the palette data and the engine's own colour maths, with no canvas, so it is the cheapest check and runs first. It exits with code 1 on any failed gate.
  - **Gate (a):** adjacency within each dragon, including the cel tones a pigment edge crosses (scale.sh / belly.sh, scale.sh / membrane, scale.sh and scale.hi / marking) and, on shriekscale, the brow and the ink face marks on the eye mask.
  - **Gate (b):** body colours across elements. The rule:
    - **B1:** both S ≥ 0.30 and ≥ 40° apart;
    - **or B2:** ≥ 25 % in luminance;
    - **or B3:** when a body is under S 0.30, ΔS ≥ 0.30 *and* ≥ 12 % luminance. Hue is unreliable on a dusty body, but chroma plus some value separates.
  - **Gate (c):** the far side, c1 to c3; c2 also needs ≥ 6 Oklab L (the dark-pair floor).
  - **Gate (d):** cel ramps, with no collapsed tones.
  - **Gate (e):** far legs, far membranes and far paired horns against the ink, ≥ 25 % and ≥ 6 Oklab L.
  - **Gate (f):** colour-blind safety, by RULE_B (the same rule as gate b), plus each dragon's blush on its cheek.
  - **Gate (h):** mood states: every pair of colours a mood swaps between.
  - **Gate (i):** the habitat floor: every scale, belly and floor-level effect.
  - **Report (g):** hue-only pairs and glow collisions.
- **To build with the rig:**
  1. `tools/dragon-sheet`, through `tools/shot.ts`, rendering:
     - the ÷ 3 area-coverage silhouette sheet at 3 phase offsets (5.1 #1);
     - the stage sheet;
     - the walk-leg sheet;
     - a greyscale sheet and a deuteranopia sheet of all 18 dragons;
     - a habitat shot with 8 dragons.
  2. A recorder pass (the Aether & Brass `art-invariants` pattern) for:
     - the mark floor;
     - emitters never banded;
     - the shape budget;
     - neutral area ≤ 40 %;
     - quiet-zone heights measured from joint positions.

### 5.6 Exemption ledger
| # | Exemption | Why it is allowed | Measured |
|---|---|---|---|
| E1 | The iris is saturated and outside the signal family on spike (orange), rock (honey), water (gold) and shriekscale (mint). | It is at most 6 × 4 px inside an ink ring, and in a care game the face is where attention belongs. | Every iris is ≥ 31 % from the catchlight and ≥ 98 % from the pupil. |
| E2 | The adult pupil is a 2 × 4 slit, against the engine's "3 px pupils". | The engine's pupil is 3 × 2, so its smallest dimension is also 2. The slit keeps the 2 px floor and more area (8 px against 6), and it has iris on both sides (2.5). | Pupil vs ink ring: 1.0 Oklab L, which is why the slit may never touch the ring's side. |
| E3 | No eye whites, where `drawFace` draws whites. | A profile animal eye. The ink ring does the separating. | n/a |
| E4 | Far legs use `farPalette(0.55, 0.30)`, not the engine's 0.62 / 0.25. | The engine exposes `farShade` / `farDesat` as per-build readability knobs. The quadruped far leg sits next to the near leg's shadow. | Gate c2 against the near leg's shadow band: 38 to 48 % and 7.1 to 10.2 Oklab L at 0.55 / 0.30, against 19 to 33 % at the default (2 of the 5 banded elements fail). Shriekscale's legs are flat (× 0.75 radius), because its shadow tone is too near the ink for any far shade to clear both by 6 Oklab L; against the near base its far leg measures 67 % and 12.2. |
| E5 | Pigment boundaries are not inked (belly, markings, eye mask, spots). | The same hide, following `drawLimbSegs`' sleeve → skin precedent. `band()` is for changes of material. | Gate (a): every pigment pair is ≥ 25 %, including against the shadow and highlight tones it crosses (lowest: lightning belly / marking, 30 %). |
| E6 | The signal colour covers a large area on lightning (the wings) and shriekscale (fans and wings), not only small emitters. | That area *is* the silhouette cue. It is one hue family, and the neutral ceiling is unaffected. | n/a |
| E7 | Water's pearl spots have a weak highlight step (7 %). | Spots are 3 × 3, below `FLAT_R`, and drawn flat, so the ramp is never used. | Gate (d) reports it. No other banded slot is below it. |
| E8 | Baby shriekscale's fans flop over its eyes for 24 f after its squeak. | A gag, and the only frame range where a head feature covers the eye. It ends on a pop back up and a blink. Asleep, the fans lie back and the eye stays in view (4.3). | n/a |
| E9 | The tuck poses draw the head group before the dome (rock) or before the wing nubs (baby sleep bun), against "the head drawn last". | The eyes are `closed` in the sleep tucks; in rock's upset tuck the one peeking eye sits below the raised rim with nothing drawn over it (1.4). | Frame review of the sleep and upset loops. |

### 5.7 Rejected ideas
- **Readability:** fire's markings in the belly colour (it fails belly / marking by definition); the rock tail club; the lightning tail arrowhead; the shriekscale tail barb; 3 claws per paw; far wing as a knuckle only.
- **Charm:** shared sharp/soft zones; zigzag head horns for lightning; the flat whale fluke; spike's blossom (a second signal colour on the head); an inked belly seam; outlining emitters in `marking` instead of ink.
- **Growth:** three head-zone cues; a single nose horn for lightning; axolotl cheek fins as water's cue; `farPalette(0.5, 0.3)` for legs (charm's 0.55 / 0.30 passes with more margin to the ink); rock's two tail plates (the tail end is water's zone); a 3-thorn caltrop on spike's tail tip.
- **Review round** (details in the Review log): a dark bat mask with pale face marks on shriekscale; pale sage tail rings on spike; making the young adult lankier than the adult; a reference wall colour.

### 5.8 Palette check report
Output of `node tools/palette-check.ts` for the palette in 3.1. Re-paste it whenever a hex changes.

```
DRAGON PALETTE CHECK  (tools/palette-check.ts)
ladder: >= 25% rel. luminance OR >= 40deg hue (hue counts only when S >= 0.2 and V >= 0.25)

(a) ADJACENT COLOURS WITHIN EACH DRAGON
 fire
  ok   scale/belly         #f04422 #e08a2c  lum  33%  hue 21deg  lum
  ok   scale.sh/belly.sh   #9e2f23 #945f2a  lum  36%  hue 24deg  lum
  ok   scale/membrane      #f04422 #7f1e3a  lum  75%  hue 27deg  lum
  ok   scale.sh/membrane   #9e2f23 #7f1e3a  lum  39%  hue 23deg  lum
  ok   scale/horn          #f04422 #463039  lum  84%  hue 34deg  lum
  ok   scale/marking       #f04422 #ffe29a  lum  71%  hue 33deg  lum
  ok   scale.sh/marking    #9e2f23 #ffe29a  lum  88%  hue 37deg  lum
  ok   scale.hi/marking    #ff5927 #ffe29a  lum  63%  hue 29deg  lum
  ok   belly/marking       #e08a2c #ffe29a  lum  56%  hue 11deg  lum
  ok   membrane/horn       #7f1e3a #463039  lum  35%  hue  7deg  lum
  ok   scale/dark          #f04422 #2b1418  lum  95%  hue   n/a  lum
  ok   glow/scale          #ffa21f #f04422  lum  52%  hue 25deg  lum
  ok   eye/catchlight      #ffc02e #f8f4ec  lum  35%  hue   n/a  lum
  ok   eye/pupil           #ffc02e #1a1418  lum  99%  hue   n/a  lum
  ok   blush/scale         #ff9ab0 #f04422  lum  52%  hue 23deg  lum
 spike
  ok   scale/belly         #2f8232 #a3ad55  lum  56%  hue 55deg  lum+hue
  ok   scale.sh/belly.sh   #1f5a2f #6c774a  lum  54%  hue 62deg  lum+hue
  ok   scale/membrane      #2f8232 #2e6b58  lum  30%  hue 39deg  lum
  ok   scale.sh/membrane   #1f5a2f #2e6b58  lum  34%  hue 25deg  lum
  ok   scale/horn          #2f8232 #f2e8c6  lum  79%  hue   n/a  lum
  ok   scale/marking       #2f8232 #173a19  lum  80%  hue   n/a  lum
  ok   scale.sh/marking    #1f5a2f #173a19  lum  58%  hue   n/a  lum
  ok   scale.hi/marking    #47a539 #173a19  lum  89%  hue   n/a  lum
  ok   belly/marking       #a3ad55 #173a19  lum  91%  hue   n/a  lum
  ok   membrane/horn       #2e6b58 #f2e8c6  lum  85%  hue   n/a  lum
  ok   scale/dark          #2f8232 #4a2618  lum  83%  hue 105deg  lum+hue
  ok   glow/scale          #7dff8c #2f8232  lum  78%  hue  5deg  lum
  ok   eye/catchlight      #ff9a3c #f8f4ec  lum  51%  hue   n/a  lum
  ok   eye/pupil           #ff9a3c #1a1418  lum  98%  hue   n/a  lum
  ok   blush/scale         #ff9ab0 #2f8232  lum  65%  hue 135deg  lum+hue
 rock
  ok   scale/belly         #cfb788 #fff7e2  lum  48%  hue   n/a  lum
  ok   scale.sh/belly.sh   #897e72 #a8aab8  lum  47%  hue   n/a  lum
  ok   scale/membrane      #cfb788 #4c5670  lum  81%  hue 176deg  lum+hue
  ok   scale.sh/membrane   #897e72 #4c5670  lum  56%  hue   n/a  lum
  ok   scale/horn          #cfb788 #5e4e46  lum  83%  hue 20deg  lum
  ok   scale/marking       #cfb788 #7e5f44  lum  73%  hue 12deg  lum
  ok   scale.sh/marking    #897e72 #7e5f44  lum  39%  hue   n/a  lum
  ok   scale.hi/marking    #ffe59b #7e5f44  lum  84%  hue 16deg  lum
  ok   belly/marking       #fff7e2 #7e5f44  lum  86%  hue   n/a  lum
  ok   membrane/horn       #4c5670 #5e4e46  lum  12%  hue 157deg  HUE ONLY
  ok   scale/dark          #cfb788 #3b2c24  lum  94%  hue   n/a  lum
  ok   membrane/marking    #4c5670 #7e5f44  lum  28%  hue 165deg  lum+hue
  ok   glow/marking        #b48cff #7e5f44  lum  63%  hue 127deg  lum+hue
  ok   horn/dark           #5e4e46 #3b2c24  lum  65%  hue   n/a  lum
  ok   eye/catchlight      #ffb84a #f8f4ec  lum  38%  hue   n/a  lum
  ok   eye/pupil           #ffb84a #1a1418  lum  99%  hue   n/a  lum
  ok   blush/scale         #d8607a #cfb788  lum  50%  hue 53deg  lum+hue
 lightning
  ok   scale/belly         #2d58cc #9fb4f2  lum  74%  hue  1deg  lum
  ok   scale.sh/belly.sh   #1e3da7 #697cc5  lum  70%  hue  1deg  lum
  ok   scale/membrane      #2d58cc #ffcf33  lum  82%  hue 178deg  lum+hue
  ok   scale.sh/membrane   #1e3da7 #ffcf33  lum  90%  hue 179deg  lum+hue
  ok   scale/horn          #2d58cc #2a306c  lum  69%  hue 11deg  lum
  ok   scale/marking       #2d58cc #ffcf33  lum  82%  hue 178deg  lum+hue
  ok   scale.sh/marking    #1e3da7 #ffcf33  lum  90%  hue 179deg  lum+hue
  ok   scale.hi/marking    #4571e9 #ffcf33  lum  71%  hue 178deg  lum+hue
  ok   belly/marking       #9fb4f2 #ffcf33  lum  30%  hue 179deg  lum+hue
  ok   membrane/horn       #ffcf33 #2a306c  lum  94%  hue 171deg  lum+hue
  ok   scale/dark          #2d58cc #141a3c  lum  90%  hue   n/a  lum
  ok   glow/horn           #fff6a0 #2a306c  lum  96%  hue 180deg  lum+hue
  ok   glow/membrane       #fff6a0 #ffcf33  lum  26%  hue  8deg  lum
  ok   eye/catchlight      #ffc41f #f8f4ec  lum  33%  hue   n/a  lum
  ok   eye/pupil           #ffc41f #1a1418  lum  99%  hue   n/a  lum
  ok   blush/scale         #ff9ab0 #2d58cc  lum  75%  hue 123deg  lum+hue
 water
  ok   scale/belly         #20a3ce #85c6ae  lum  36%  hue 37deg  lum
  ok   scale.sh/belly.sh   #1570a9 #588990  lum  34%  hue 16deg  lum
  ok   scale/membrane      #20a3ce #1e5f8c  lum  67%  hue 10deg  lum
  ok   scale.sh/membrane   #1570a9 #1e5f8c  lum  29%  hue  1deg  lum
  ok   scale/horn          #20a3ce #eaf6f0  lum  65%  hue   n/a  lum
  ok   scale/marking       #20a3ce #dcfff6  lum  67%  hue   n/a  lum
  ok   scale.sh/marking    #1570a9 #dcfff6  lum  84%  hue   n/a  lum
  ok   scale.hi/marking    #35cdeb #dcfff6  lum  46%  hue   n/a  lum
  ok   belly/marking       #85c6ae #dcfff6  lum  48%  hue   n/a  lum
  ok   membrane/horn       #1e5f8c #eaf6f0  lum  88%  hue   n/a  lum
  ok   scale/dark          #20a3ce #0e2a36  lum  93%  hue   n/a  lum
  ok   glow/scale          #40d8f0 #20a3ce  lum  45%  hue  7deg  lum
  ok   glow/membrane       #40d8f0 #1e5f8c  lum  82%  hue 16deg  lum
  ok   eye/catchlight      #ffc64a #f8f4ec  lum  31%  hue   n/a  lum
  ok   eye/pupil           #ffc64a #1a1418  lum  99%  hue   n/a  lum
  ok   blush/scale         #feaebe #20a3ce  lum  44%  hue 153deg  lum+hue
 shriekscale
  ok   scale/belly         #5a2f6e #fff5f8  lum  94%  hue   n/a  lum
  ok   scale.sh/belly.sh   #3b205e #a8a9c9  lum  93%  hue   n/a  lum
  ok   scale/membrane      #5a2f6e #ff6fae  lum  85%  hue 53deg  lum+hue
  ok   scale.sh/membrane   #3b205e #ff6fae  lum  92%  hue 68deg  lum+hue
  ok   scale/horn          #5a2f6e #f0dce6  lum  93%  hue   n/a  lum
  ok   scale/marking       #5a2f6e #9a6aa8  lum  73%  hue  5deg  lum
  ok   scale.sh/marking    #3b205e #9a6aa8  lum  86%  hue 20deg  lum
  ok   scale.hi/marking    #7c3f7d #9a6aa8  lum  53%  hue 13deg  lum
  ok   belly/marking       #fff5f8 #9a6aa8  lum  79%  hue   n/a  lum
  ok   membrane/horn       #ff6fae #f0dce6  lum  53%  hue   n/a  lum
  ok   scale/dark          #5a2f6e #2e1638  lum  73%  hue   n/a  lum
  ok   membrane/belly      #ff6fae #fff5f8  lum  62%  hue   n/a  lum
  ok   marking/belly       #9a6aa8 #fff5f8  lum  79%  hue   n/a  lum
  ok   scale.deep/marking  #2e1a4e #9a6aa8  lum  91%  hue 23deg  lum
  ok   ink/marking         #1a1018 #9a6aa8  lum  97%  hue   n/a  lum
  ok   eye/catchlight      #3fe0a0 #f8f4ec  lum  37%  hue   n/a  lum
  ok   eye/pupil           #3fe0a0 #1a1418  lum  99%  hue   n/a  lum
  ok   blush/scale         #ff9ab0 #5a2f6e  lum  89%  hue 66deg  lum+hue
 shared
  ok   mouth/tongue        #5a2030 #f07890  lum  90%  hue  5deg  lum
  ok   mouth/fang          #5a2030 #f8f4ec  lum  96%  hue   n/a  lum

(b) SCALE COLOURS ACROSS ELEMENTS  (B1 hue: both S>=0.30 and >=40deg | B2 value: >=25% | B3 chroma: dS>=0.30 and >=12%)
  ok   fire/spike             #f04422 #2f8232  lum  26%  hue 112deg  dS 0.22  B1+B2
  ok   fire/rock              #f04422 #cfb788  lum  53%  hue 30deg  dS 0.52  B2
  ok   fire/lightning         #f04422 #2d58cc  lum  48%  hue 146deg  dS 0.08  B1+B2
  ok   fire/water             #f04422 #20a3ce  lum  26%  hue 175deg  dS 0.01  B1+B2
  ok   fire/shriekscale       #f04422 #5a2f6e  lum  77%  hue 89deg  dS 0.29  B1+B2
  ok   spike/rock             #2f8232 #cfb788  lum  66%  hue 82deg  dS 0.30  B1+B2
  ok   spike/lightning        #2f8232 #2d58cc  lum  29%  hue 102deg  dS 0.14  B1+B2
  ok   spike/water            #2f8232 #20a3ce  lum  46%  hue 73deg  dS 0.21  B1+B2
  ok   spike/shriekscale      #2f8232 #5a2f6e  lum  68%  hue 159deg  dS 0.07  B1+B2
  ok   rock/lightning         #cfb788 #2d58cc  lum  76%  hue 176deg  dS 0.44  B1+B2
  ok   rock/water             #cfb788 #20a3ce  lum  37%  hue 155deg  dS 0.50  B1+B2
  ok   rock/shriekscale       #cfb788 #5a2f6e  lum  89%  hue 119deg  dS 0.23  B1+B2
  ok   lightning/water        #2d58cc #20a3ce  lum  62%  hue 29deg  dS 0.07  B2
  ok   lightning/shriekscale  #2d58cc #5a2f6e  lum  55%  hue 57deg  dS 0.21  B1+B2
  ok   water/shriekscale      #20a3ce #5a2f6e  lum  83%  hue 86deg  dS 0.27  B1+B2
 scale S/V: fire 0.86/0.94  spike 0.64/0.51  rock 0.34/0.81  lightning 0.78/0.80  water 0.84/0.81  shriekscale 0.57/0.43

(c) FAR SIDE vs NEAR SCALE  (>= 25% luminance; hue does not count, far parts share the near hue)
 c1  engine default farPalette(p, 0.62, 0.25): far scale and far membrane vs near scale
        fire         scale #823228  68%   membrane #45182b  91%
        spike        scale #254b2c  67%   membrane #233f3c  75%
        rock         scale #7d7262  65%   membrane #313547  93%
        lightning    scale #233772  64%   membrane #96803d  47%
        water        scale #23607a  67%   membrane #1a3954  88%
        shriekscale  scale #342044  59%   membrane #904d70  57%
 c2  rig far LEGS farPalette(p, 0.55, 0.3): far leg vs near leg base, and vs near leg SHADOW band (scale.sh); >= 25% and >= okL 6
        fire         scale #702d26  76% okL 24.5   scale #702d26 vs #9e2f23  42%  okL 8.2   (engine default:  24%, would fail)
        spike        scale #224229  74% okL 19.1   scale #224229 vs #1f5a2f  44%  okL 7.1   (engine default:  28%)
        rock         scale #6e6559  73% okL 27.7   scale #6e6559 vs #897e72  38%  okL 8.8   (engine default:  19%, would fail)
        lightning    scale #203063  72% okL 17.6   scale #203063 vs #1e3da7  48%  okL 8.6   (engine default:  33%)
        water        scale #22546b  75% okL 24.6   scale #22546b vs #1570a9  47% okL 10.2   (engine default:  31%)
        shriekscale  scale #2e1d3b  67% okL 12.2   (legs flat at every stage: no shadow band to cross)
 c3  rig far WING + HEAD features farPalette(p, 0.62, 0.25): far membrane (wing, ear-fan, fin-ear) and far paired horn vs near scale
        fire         membrane #45182b  91%   horn #291f29  93%
        spike        membrane #233f3c  75%   horn #949086  40%
        rock         membrane #313547  93%   (no paired horns)
        lightning    membrane #96803d  47%   horn #1c1f40  87%
        water        membrane #1a3954  88%   (no paired horns)
        shriekscale  membrane #904d70  57%   (no paired horns)

(d) CEL RAMPS  (engine makeTones, default RAMP: hi 1.22 / sh 0.66 / deep 0.51)
  ok   fire         8 ramps distinct
  ok   spike        8 ramps distinct
  ok   rock         8 ramps distinct
  ok   lightning    8 ramps distinct
  ok   water        8 ramps distinct
  ok   shriekscale  8 ramps distinct
        weakest highlight step on a banded slot:   7% (water.marking #dcfff6 -> hi #ffffff)

(e) INK FLOOR  (far leg scale, far wing membrane and far paired horn vs outline #1a1018: >= 25% and >= okL 6)
  ok   fire         far leg scale #702d26  88% okL 20.1   far membrane #45182b  69%  okL 9.5   far horn #291f29  59%  okL 6.5
  ok   spike        far leg scale #224229  85% okL 15.7   far membrane #233f3c  85% okL 15.4   far horn #949086  98% okL 46.4
  ok   rock         far leg scale #6e6559  95% okL 32.2   far membrane #313547  82% okL 14.3
  ok   lightning    far leg scale #203063  80% okL 13.6   far membrane #96803d  97% okL 41.6   far horn #1c1f40  59%  okL 6.6
  ok   water        far leg scale #22546b  92% okL 23.2   far membrane #1a3954  83% okL 14.5
  ok   shriekscale  far leg scale #2e1d3b  63%  okL 7.7   far membrane #904d70  95% okL 32.2

(f) COLOUR-BLIND SAFETY  (simulated deuteranopia / protanopia, Vienot 1999: 15 scale pairs by RULE_B, blush/scale by the ladder)
 deutan
  ok   fire/spike             #949400 #717136  lum  43%  hue  0deg  S 1.00/0.52  B2
  ok   fire/rock              #949400 #bebe87  lum  45%  hue  0deg  S 1.00/0.29  B2+B3
  ok   fire/lightning         #949400 #4e4ecc  lum  58%  hue 180deg  S 1.00/0.62  B1+B2
  ok   fire/water             #949400 #8c8ccf  lum   5%  hue 180deg  S 1.00/0.32  B1
  ok   fire/shriekscale       #949400 #3f3f6d  lum  79%  hue 180deg  S 1.00/0.42  B1+B2
  ok   spike/rock             #717136 #bebe87  lum  69%  hue  0deg  S 0.52/0.29  B2
  ok   spike/lightning        #717136 #4e4ecc  lum  27%  hue 180deg  S 0.52/0.62  B1+B2
  ok   spike/water            #717136 #8c8ccf  lum  46%  hue 180deg  S 0.52/0.32  B1+B2
  ok   spike/shriekscale      #717136 #3f3f6d  lum  63%  hue 180deg  S 0.52/0.42  B1+B2
  ok   rock/lightning         #bebe87 #4e4ecc  lum  77%  hue 180deg  S 0.29/0.62  B2+B3
  ok   rock/water             #bebe87 #8c8ccf  lum  42%  hue 180deg  S 0.29/0.32  B2
  ok   rock/shriekscale       #bebe87 #3f3f6d  lum  88%  hue 180deg  S 0.29/0.42  B2
  ok   lightning/water        #4e4ecc #8c8ccf  lum  60%  hue  0deg  S 0.62/0.32  B2
  ok   lightning/shriekscale  #4e4ecc #3f3f6d  lum  50%  hue  0deg  S 0.62/0.42  B2
  ok   water/shriekscale      #8c8ccf #3f3f6d  lum  80%  hue  0deg  S 0.32/0.42  B2
  ok   fire blush/scale       #bfbfad #949400  lum  46%  hue   n/a  lum
  ok   spike blush/scale      #bfbfad #717136  lum  70%  hue   n/a  lum
  ok   rock blush/scale       #919176 #bebe87  lum  44%  hue   n/a  lum
  ok   lightning blush/scale  #bfbfad #4e4ecc  lum  78%  hue   n/a  lum
  ok   water blush/scale      #cacabc #8c8ccf  lum  51%  hue   n/a  lum
  ok   shriekscale blush/scale #bfbfad #3f3f6d  lum  89%  hue   n/a  lum
 protan
  ok   fire/spike             #6c6c26 #7c7c31  lum  26%  hue  0deg  S 0.65/0.60  B2
  ok   fire/rock              #6c6c26 #baba88  lum  70%  hue  0deg  S 0.65/0.27  B2+B3
  ok   fire/lightning         #6c6c26 #5454cc  lum  10%  hue 180deg  S 0.65/0.59  B1
  ok   fire/water             #6c6c26 #9b9bce  lum  60%  hue 180deg  S 0.65/0.25  B2+B3
  ok   fire/shriekscale       #6c6c26 #36366e  lum  68%  hue 180deg  S 0.65/0.51  B1+B2
  ok   spike/rock             #7c7c31 #baba88  lum  60%  hue  0deg  S 0.60/0.27  B2+B3
  ok   spike/lightning        #7c7c31 #5454cc  lum  33%  hue 180deg  S 0.60/0.59  B1+B2
  ok   spike/water            #7c7c31 #9b9bce  lum  46%  hue 180deg  S 0.60/0.25  B2+B3
  ok   spike/shriekscale      #7c7c31 #36366e  lum  76%  hue 180deg  S 0.60/0.51  B1+B2
  ok   rock/lightning         #baba88 #5454cc  lum  73%  hue 180deg  S 0.27/0.59  B2+B3
  ok   rock/water             #baba88 #9b9bce  lum  26%  hue 180deg  S 0.27/0.25  B2
  ok   rock/shriekscale       #baba88 #36366e  lum  90%  hue 180deg  S 0.27/0.51  B2
  ok   lightning/water        #5454cc #9b9bce  lum  64%  hue  0deg  S 0.59/0.25  B2+B3
  ok   lightning/shriekscale  #5454cc #36366e  lum  64%  hue  0deg  S 0.59/0.51  B2
  ok   water/shriekscale      #9b9bce #36366e  lum  87%  hue  0deg  S 0.25/0.51  B2
  ok   fire blush/scale       #a9a9b0 #6c6c26  lum  65%  hue   n/a  lum
  ok   spike blush/scale      #a9a9b0 #7c7c31  lum  53%  hue   n/a  lum
  ok   rock blush/scale       #76767b #baba88  lum  61%  hue   n/a  lum
  ok   lightning blush/scale  #a9a9b0 #5454cc  lum  68%  hue   n/a  lum
  ok   water blush/scale      #b9b9be #9b9bce  lum  28%  hue   n/a  lum
  ok   shriekscale blush/scale #a9a9b0 #36366e  lum  89%  hue   n/a  lum

(h) MOOD STATES  (colours a mood swaps between; the ladder, so the change is visible)
 fire
  ok   glow/banked         #ffa21f #a87020  lum  58%  hue  0deg  lum  (asleep, the flame banks to glow.sh)
 rock
  ok   glow/banked         #b48cff #7761cf  lum  52%  hue  9deg  lum  (lit crystals vs dim crystals (mood <= -0.3))
  ok   banked/marking      #7761cf #7e5f44  lum  23%  hue 136deg  HUE ONLY  (a dim crystal still reads on the dome)
 water
  ok   marking/dimSpot     #dcfff6 #7ed1e2  lum  41%  hue   n/a  lum  (spots dim when dry or sad)
  ok   marking/glow        #dcfff6 #40d8f0  lum  40%  hue   n/a  lum  (spots light up when happy)
  ok   dimSpot/scale       #7ed1e2 #20a3ce  lum  44%  hue  5deg  lum  (dim spots still read on the flank)

(i) HABITAT FLOOR #e0d6b8  (L 0.67, S 0.18: hue never counts, >= 25% luminance)
  ok   fire         scale  66%  belly  49%  breath puff outer ring  66%
  ok   spike        scale  75%  belly  43%  sap streak / sparkle edge  75%
  ok   rock         scale  27%  belly  28%  dust puff (opaque)  27%  pebble  81%
  ok   lightning    scale  82%  belly  31%  spark ring  82%
  ok   water        scale  54%  belly  28%  bubble / drip ring  85%
  ok   shriekscale  scale  92%  belly  28%  sound arc  47%  sound arc edge  92%

(g) REPORTED, NOT GATED
 scale pairs passing (b) on hue only, so they would merge in greyscale: none
 glow pairs across elements within 40deg hue AND 25% luminance (must differ by effect SHAPE):
   none

RESULT: PASS  277 of 277 gates passed
```

---

## Review log
Two critiques reviewed the first draft: **R**, readability (2 blockers, 9 major, 10 minor), and **C**, the care game (11 major, 11 minor). Every item was checked against the files before it was acted on. The geometry claims were re-run from the bible's own numbers; the colour claims were re-measured with the engine's colour maths. Every measured claim reproduced. **Applied** means the change is in this bible, and in `palettes.ts` or `palette-check.ts` where it touches colour. **In part** says which part was turned down.

### Readability critique (R)
| # | Item | Verdict | Why, in one line |
|---|---|---|---|
| R1 | **Blocker:** baby lightning's bolt nubs are hidden behind the head | Applied | 0 of 27 px² showed. Now 12 × 5 at 105° from (−3, −6), over the hips: about 37 px² clears head and body (3.5). |
| R2 | **Blocker:** the bolt-wing angles lean forward and the polygon self-intersects | Applied | Cock 140° / 115° / 95°, far wing +8°, the critic's simple polygon. The root also moved 3 px back so the *young* tip clears the horns at rest (11 px), which the critique did not check (3.5). |
| R3 | Near legs fuse on babies and most young | Applied | Joints at ±(gap/2 + X), X = 3.25 / 1.5 / 1, baby leg r 2.6 / 2.4: ≥ 3.0 px of background at rest on all 18 (2.1). |
| R4 | Bellies merge into the floor | Applied | Five bellies moved to ≤ 0.49 or ≥ 0.93 luminance; belly vs floor is now gate (i), 28 to 49 %. |
| R5 | Markings vanish in the shadow band; the shriekscale face washes out | Applied, in part | Gate (a) now tests marking vs shadow and highlight, brow vs mask and ink vs mask. Spike rings `#173a19` as proposed. Shriekscale takes C6's pale mask instead of horn-coloured face marks, so it keeps the shared face renderer. |
| R6 | The baby spike comb is mostly hidden | Applied | Nubs on the loin, rump and tail root (3.3). |
| R7 | The baby water paddle is weak; rock's tail tip breaks the 4 px rule | Applied | Baby water tail r 3.5 → 1.5 with a 10 × 6 paddle. Rock's tip is capped at r 2 instead of × 1.5. |
| R8 | The adult slit pupil fuses into the ring | Applied | Adult eye 8 × 6 / 6 × 4 with iris on both sides of the slit (2.5). |
| R9 | Shriekscale's far legs fuse; the ratio test is lenient in the darks | Applied | Shriekscale leg r × 0.75 (flat legs). A 6-point Oklab L floor on c2 and (e); far horns added to (e). Fire and lightning horns lightened (`#463039`, `#2a306c`) to pass it. |
| R10 | Lightning has no cue asleep | Applied | Asleep at the 140° cock, spars closed, horns lit (3.5, 4.3). |
| R11 | The draw order contradicts rock's tuck and the baby bun | Applied | Tuck branch in 1.4, ledger E9. |
| R12 | Ribs and rays leave gaps under 2 px | Applied | Fin-ear rays 1 / 0; fan ribs 3 / 2 / 1 starting 4 px out; no ribs on the far fan. |
| R13 | Marks under 2 px: quill tips, small facets, lobe dots, inked claws | Applied | All four fixed as proposed (3.3, 3.4, 3.6, D16). |
| R14 | Zones overlap above the rump; lightning's baby comma tail | Applied | Fire owns "above the tail tip". The baby lightning tail is straight. Baby spike and shriekscale tails use C2's −5° / −15°, not +5° / +5°, to keep a perky tail under the 3 px limit. |
| R15 | The 24 px silhouette test depends on pixel phase | Applied | ÷ 3 area-coverage sheet at 3 phase offsets (5.1 #1). |
| R16 | Membranes sit on the scale's shadow tone | Applied | scale.sh / membrane gated. Fire `#7f1e3a`. Rock `#4c5670`, darker than the proposed `#56627c`, so the tucked wing clears the dome by value too. Spike kept: it clears base and shadow by ≥ 30 %. D11 rewritten. |
| R17 | Floor-level effects fall under 25 % | Applied | Dark rings and edges on floor-level emitters, arcs in `membrane`, opaque dust; gate (i) measures each. |
| R18 | Adult lids of 1.2 px; sleepy looks like closed | Applied | Lids counted in rows per stage, ≥ 2 rows, with the lid's own ink edge (2.5). |
| R19 | Small jaw openings show no mouth | Applied | Stage minimum 20° / 14° / 10°; every small opening in 2.5 and 4.2 raised to it. |
| R20 | Spec gaps: shin convention, 4-spar angles, throat sac, folded scallops | Applied | Relative shin angles (1.1, 2.1), 3- and 4-spar angles and lengths (2.1, 2.2), the sac as a neck-contour bulge, scallops × `wing`. |
| R21 | The young adult is not lanky | Rejected | It is leggy against the baby, which is the bible's claim. Making it lankier than the adult is a taste call that re-derives every young number, so it waits for the stage contact sheet; 2.6's wording is clarified. |

### Care-game critique (C)
| # | Item | Verdict | Why, in one line |
|---|---|---|---|
| C1 | Baby lightning's cue collides with shriekscale and the ordinary nub | Applied | Merged with R1. Bolt nubs lean back at 105°: at C's 80°, 43 % of the nub stayed under the head (24 of 42 px² showed; at 105°, 39). Ordinary nubs rest at 170°; baby fans 10 × 8 on top of the cranium; "antennae" deleted. |
| C2 | Baby comma tails rise into fire's zone | Applied | Only fire keeps the comma (2.3). |
| C3 | Spike's mood gauge runs backwards | Applied | `mood` drives the lean (50° / 35° / 20°); `bristle` is a separate alarm one-shot (3.3). |
| C4 | Rock has no gauge as a baby; sleep looks like upset; the dim crystal is lighter than the lit one | Applied | Seed crystal from hatching, dim = `glow.sh`, distinct sleep and upset tucks, a 110 f happy; gate (h). |
| C5 | Water's happy swap is too weak; "dim" is undefined | Applied | Glow `#40d8f0`, dim spot `mix(marking, scale, 0.5)`, breathing only at `mood` ≥ 0, flare defined; gate (h). |
| C6 | Markings fuse with the shadow; the shriekscale face is near-invisible | Applied, in part | Shriekscale mask → lilac `#9a6aa8` as proposed. Spike rings stay dark (R5's `#173a19`): the pale sage `#8fb87a` would sit on the new olive belly. |
| C7 | Sound arcs vanish on the floor | Applied, in part | Arcs in `membrane` with a `scale` edge that fade by narrowing; drips and sap get rings or edges. No wall colour yet: the habitat art does not exist, and every effect now carries its own dark edge. |
| C8 | Fan ribs and fin rays are packed too tightly | Applied | Merged with R12. C's 4 px start and 3 px edge gaps; fin-ears keep R's 7 × 6 with 1 ray (C's 8 × 7 with two 2 px rays leaves 1 px gaps across its 7 px height). The shriekscale budget drops from 40 to 35. |
| C9 | The care loop is missing animations | Applied | hopGlide, fly (lightning flaps its cocked bolts), rock's boulder hop, bath, play, refuse and zap (4.2). |
| C10 | The adult face set does not fit the adult eye; three faces are missing | Applied | Lids in rows, `sheepish` and `scared` added, `dazed` redrawn as a chevron with stars. "Proud" is `happy` with the chin up. |
| C11 | Shriekscale's sleep hood covers the eye | Applied | Fans lie back asleep and the `closed` eye stays visible. The baby flop stays as a 24 f gag (E8). |
| C12 | The adult face reads cold | Applied | The slit is for neutral, alert and breath only; the other faces use a round pupil. Rock's brow ridge is a contour bump, not a lid. |
| C13 | D9 overstates colour-blind separation | Applied | Gate (f) uses RULE_B. Water → `#20a3ce` (0.040 ΔE), not `#15a5c9`, which left protan rock / water at exactly 25.0 %. |
| C14 | The blush vanishes on rock for colour-blind players | Applied | `DRAGON_BLUSH` rock `#d8607a`. The new blush-under-CVD gate then caught water (13 % under protanopia), so water gets `#feaebe`. |
| C15 | The gulp is invisible | Applied | Now a bulge in the neck contour (1.2, 4.2). |
| C16 | The 5 × 5 "z" reads as "≡" | Applied | 6 × 6 glyph. |
| C17 | Fire and spike walk like everyone else | Applied | Fire struts, spike creeps. Spike's wary lean is restated for the new mood gauge (4.3). |
| C18 | Spike and lightning punish the same mistake | Applied | Lightning's static builds from boredom; spike reacts to *where* it is petted. |
| C19 | The lonely shriek looks like the trick | Applied | A separate lonely call: sad face, one arc, neighbours look instead of flinching (3.7). |
| C20 | The grow-up payoff is too short | Applied | 240 f, faster pulses, a 12 f silhouette flash, the pose held until the player taps. |
| C21 | Same-element pets are pixel-identical | Applied, in part | Seeded variant for markings, lengths and tail bend (2.8). No iris variation: the iris colour is a species invariant (2.7). |
| C22 | A full habitat gets busy | Applied | 12 ambient particles habitat-wide, round-robin; intervals × 1.5 beyond 4 dragons (5.4). |

### Found while applying
- Gate (a) gained scale.sh / belly.sh (the shadow band crosses the belly line) and scale.hi / marking, beyond the pairs the critiques named. Both pass.
- The horn / dark pair moved from the core pairs to rock only: the dark claw and quill tips it measured no longer exist, and rock's nose horn is the one horn beside a nostril.
- Lightning's bolt root sits 3 px behind the generic wing root: with R2's angles alone, the young's excited tip came within 2.7 px of its horns.
