# HANDOFF S9a — Mission art kit (drop this file on merge)

Branch claude/outstanding-issues-s9a: base b17210c, plus a --no-ff merge of the mission contract af25650 (its missiondata.ts collided with ours; artseams.ts now re-exports the kit). The sections below are copied from the shared handoff log.

## S9a — orchestrator note (read before building the grumpy miller)

The miller mockup was NOT yet on the notes branch when S9a started. Right before you build the miller in
`src/game/npcs.ts`, run `git fetch origin claude/outstanding-issues-notes` (fetch only; never check it out, never
push to it) and `git ls-tree --name-only origin/claude/outstanding-issues-notes notes/`. If `notes/miller_mock.png`
and/or `notes/miller_mock.patch` exist, extract them with
`git show origin/claude/outstanding-issues-notes:notes/miller_mock.png > /tmp/claude-0/-home-user-dragon-care/d689427d-6a83-5447-ac66-e08465e66106/scratchpad/miller_mock.png` (same for the .patch),
LOOK at the png with the Read tool, read the patch, and start from them (adapt the patch to this slice's files; do not
apply it blindly). Record in your S9a section whether the mockup was found and used. If they are absent, build the
miller from the plan's description: the bar is that he reads GRUMPY at a glance at 1x (the user said the old
placeholder "doesn't look grumpy").

## S9a — Mission art kit

**Built** (base b17210c, commit aa03a0e; `npm run check` green on the committed tree: typecheck, palette RESULT 2492/2492 (+118: the
road floor's (i) block), KEEPERS 231/231 (+8 road (Ki) on the four keepers, +59 the miller), BACKDROPS 3458/3458
(+2353: six climates x four phases, the caves' lamp pool, the cave mouth), NEW BADDIES 387/387 (gate x), EGGS 8/8; sim
sections unchanged (no sim code touched); smoke 96 views (90 + 6 missionart) + 1 pair + 2 TINT pairs, world bb6e59e9
and barn b4c21913 unchanged). No game state, no simulation change, `SAVE_VERSION` unchanged. Advances #5 (5.1 the
climate picture, 5.3 set pieces / icons / the miller, 5.5 the baddies); nothing in the game draws the kit yet.

New files (all drawing-only, frozen-safe: pure functions of their args and a step `t`):
- `src/game/missiondata.ts` (data only): `Climate`, `CLIMATES`; `ChallengeId`, `CHALLENGE_IDS` (S8's 11, S8's order);
  `Skill`, `SKILLS`; `BaddieId`, `BADDIE_IDS`; `BaddieExit`, `BADDIE_EXITS`; `BaddieFace`, `BADDIE_FACES`; `BaddiePose`,
  `BADDIE_POSES`; NEW `MillerState = 'grumpy' | 'talkedRound'`; NEW `SetPieceState = 'ahead' | 'met' | 'unmet'`.
  **S8's regions.ts must import these** (the spelling is exactly plan S8/S9's).
- `src/game/backdrops.ts`: `drawClimate(ctx, climate, phase: DayPhase, rect: PicRect, scroll = 0)`; `interface PicRect
  {x,y,w,h}`; `CLIMATE_PIC {w:300,h:112}`; `PARALLAX {sky 0, ridge 0.2, near 0.5, weather 0.35}`; `lampPool(near)`.
  Landforms scale with k = rect.h/112 (1 in the chooser, ~2.6 at a 290 px scene); marks keep px sizes. It clips to the
  rect and inks a 1 px frame round it (also in the scene; S9 draws its road band etc. over the bottom).
- `src/game/setpieces.ts`: `drawSetPiece(ctx, id: ChallengeId, x, feetY, state: SetPieceState, t)`; `SETPIECE_COLOURS`.
  Each piece's foot sits 4 px behind `feetY` (the road's back half); widths ~40-130 px, the storm cloud floats ~86 px
  over the road, the mill ~130 px tall with sails. `unmet` draws as `ahead`. Draw set pieces BEFORE the team.
- `src/game/baddies.ts`: `interface Baddie`, `_NoHurt`, `_Exits` (exported types, so tsc checks them and they are not
  "unused"), `BADDIE_ART`, `drawBaddie(ctx, id, x, feetY, facing: 1|-1, face, pose, t)`, `drawBaddiePortrait(ctx, id, x, y)`
  (24 x 24, top-left). Re-exports `BaddieId/Exit/Face/Pose`. NEW: `BADDIE_HOME` (moleking caves, stormroc peaks,
  frostgiant ice), `BADDIE_EDGE`, `BADDIE_PAIRS`, `BADDIE_WHITE` (gate x data), `BADDIE_EXIT_LOOK` (the sheet's end
  look per exit) and **`exitLook(exit, u) -> {pose, face, facing, dx}`** (u 0..1 of the exit part of the beat: calmed
  sits sleepy at dx 0; outwitted turns surprised for u < 0.35 then walks right, neutral, dx up to ~227; drivenOff
  leaves right, grumpy, dx up to 260). facing -1 = facing the team coming from the left. `turn` draws the baddie
  mirrored (looking back) with a "!" over it; `leave` adds heel dust and a grumble cloud; `sit`+`sleepy` adds the z's.
- `src/game/npcs.ts`: `drawMiller(ctx, x, feetY, facing, state: MillerState, t, silhouette: string|null = null)`
  (`facing` = the side the team is on: grumpy he is drawn facing AWAY from it, talked round facing it); `MILLER_PALETTE`
  (KeeperPalette slots; `tool` = his flour sack, `trim` = flour), `MILLER_SKIN_SHADOW`, `MILLER_SPEC` (id 'miller', NOT a
  KeeperId; cast to KeeperSpec internally for the keeper parts). Built on `buildRig` + `keeperParts('short')` with his own
  face / hair / moustache (beard hook) / flat cap (hat hook) / torso / hips; one cached rig. His sack stands behind his
  heels. **The miller mockup was NOT on the notes branch** (`git ls-tree origin/claude/outstanding-issues-notes notes/`:
  README, handoff, implement-slices.js, plan only): built from the plan's description.
- `src/game/missionicons.ts`: `CHALLENGE_ICONS: Record<ChallengeId, Sprite>` (9x9), `SKILL_ICONS: Record<Skill, Sprite>`
  (9x9), `SADDLE` (11x7), `carriedEgg(el): Sprite`, `drawCarriedEgg(ctx, el, cx, cy)`. (DIFFERS from plan S8's file
  table, which put these in icons.ts: S9a's own list names missionicons.ts.) Draw with `icons.ts drawSprite(ctx, sp, cx, cy)`.
- `src/game/cel.ts`: `celTarget(facing = 1, flat = null): Cel` -- a ShadeTarget so the engine's cel helpers paint
  without a rig (light stays top-left on screen when mirrored).
- `src/game/missionart.ts`: the gallery sheets (`missionArtScene(search)`, `SHEETS`, `roadBand(ctx, x0, x1, feetY)`).

Changed: `surfaces.ts` (`FLOORS.road '#dcd6c4'`; NEW `interface ClimatePhase {sky:[3], ridge, near, detail, mark}`,
`CLIMATE_BACKDROPS`, `BACKDROPS.climate` (= it; `Backdrops.climate` field), `CAVE {mouth '#3a2e36', lamp '#ffd98a'}`);
`eggs.ts` (`eggSprite` exported); `gallery.ts` (`'missionart'` in VIEWS -- so it is also in the arrow-key RING; the
case reads `location.search`); `types/globals.d.ts` (`__dragonCare.missionart?: {sheet, drawn[]}`); `tools/palette-check.ts`
(climates in (w), the miller in KEEPERS, gate (x) with its own `BADDIES:` RESULT line); `tools/smoke.ts` (`Case.art`, 6
cases); `tools/shots.ts` (7 `missionart_*` shots); docs ART_BIBLE (top Status line, NEW 5.10 Mission art, 5.8 re-pasted
with the road, the climates and (x); its counts 2492 / 3458), KEEPERS.md (231, the road, the miller).

**Measured**
```
RESULT: PASS  2492 of 2492 gates passed
KEEPERS: PASS  231 of 231 gates passed
BACKDROPS: PASS  3458 of 3458 gates passed
BADDIES: PASS  387 of 387 gates passed
EGGS: PASS  8 of 8 gates passed
gate (x) thinnest: stormroc beak/leg #e8a848 27 % (peaks dusk sky top); moleking crown #d8a838 30 % (caves dusk ridge);
  frostgiant face #d8a4a0 32 %, nose #b83040 32 % (ice night sky top)
smoke: missionart climates 6387 colours, road scene (peaks night) 1097, setpieces 4560, baddies 4722, people 3994, icons 518
```
Climate zoning (so gate x can pass): caves/peaks/ice bands are L >= 0.6 by day, dusk, dawn and L 0.17-0.26 at night;
a baddie's edge fills sit dark (L <= 0.13) or mid (0.35-0.45). **S9: any new colour behind a baddie (a scene band)
must keep this, or re-run gate x.** The road scene's own layers (road band, slab, grass, earth) are S9's.

**Deviations**
1. Gate (x) checks the fills on each baddie's silhouette EDGE (`BADDIE_EDGE`) against road + climate bands; inner
   colours (belly, jewel, spectacle rim, eye white) are checked by the house ladder against what they touch
   (`BADDIE_PAIRS`) instead -- an eye white can't be 25 % from a pale day sky and never touches it. Every fill is
   checked against the ink.
2. Climate (w) lines are one per climate x phase (least over its colours), to keep 5.8 readable; every colour is still
   a counted gate.
3. The frost giant's wool is blue-grey (L 0.39), not white: white wool fails the road (0.673) and the pale ice bands.
4. Miller shirt is ochre `#a8804a` (a wheat shirt failed the ladder against his skin and grey hair); talked round he
   lifts the cap with his FAR hand (drawn behind his head, plus a fist drawn over the cap): with the near arm the arm
   crossed his face in profile whatever the pose.
5. `setpieces` `unmet` = `ahead`'s look; the storm/snow/rain are placed, not falling (weather moves only with `scroll`).
6. No sim-check section (no simulation code); the `_NoHurt`/`_Exits` assertions are checked by typecheck.
7. `view=missionart` gets `&id=<baddie>` (one row) and `&climate=&phase=` (a 640x360 road scene) beyond the plan's list.

**Gaps / stand-ins**: nothing in the game draws the kit (S8/S9 wire it). The miller has no walk and no anim player
(a stepped breath and a periodic "hmph"). The hurt bird is small (~20 px) by design. Icons at 1x are sprites; the
miller icon is a windmill.

**See it**: `node tools/shot.ts out.png="view=missionart&sheet=climates&t=0"` (also `sheet=setpieces&t=60`,
`sheet=baddies&t=30` (`&id=moleking`), `sheet=people&t=50`, `sheet=icons&t=0`,
`sheet=climates&climate=caves&phase=day&t=120`). Shots looked at: `scratchpad/shots/s9a/` and `s9a/final/`.

### S9a review

**Fixed** (`npm run check` green after: RESULT 2492/2492, KEEPERS 231/231, **BACKDROPS 3497/3497** (+39: the fog bands),
BADDIES 387/387, EGGS 8/8; smoke 96 views, missionart climates now 6564 colours, people 3990):
- `backdrops.ts`: the peaks' storm clouds counted rect.x twice (lost at x >= ~150; none at night/dawn on the sheet).
  Fixed, and **every layer is now rect-relative**: ridge / near / storm offsets carry `- rect.x`, so a picture depends
  only on (climate, phase, rect size, scroll), never on where it sits. At x = 0 (S9's scene) nothing changed; the
  chooser at (16, 26) shifts its landforms by 16 px. Peaks show clouds + bolts in all four phases.
- `missionart.ts`: new private `drew(ctx, x, y, w, h, fn)` compares pixels before/after; every sheet now publishes an
  item only if its draw changed pixels in its cell (the smoke "not drawn" check can now fail). Silhouette caption split
  onto two lines ("SILHOUETTES:" / "MILLER BEA TOMAS IRIS PIP"), no longer cut off.
- `palette-check.ts`: gate (w) now gates `SETPIECE_COLOURS.fog` (3 bands x dark bodies + ink; thinnest 81 % lighter).
  The fog colours stay in setpieces.ts (not moved to surfaces.ts).
- `npcs.ts`: talked round draws the far forearm (far-shade skin, elbowF -> handF) up the back of his head to the fist,
  and the cap lifts 4 px (was 3); the "hmph" is now three small stepped puffs trailing from the nose (not one blank oval).
- `baddies.ts`: the dozing z's are 5 x 5 (inked 7 x 7) with a 3-step diagonal, spaced 8/9 px (plan said 3 x 3; read as I/=).
- ART_BIBLE: status count 3497, 5.8 report (BACKDROPS line + fog band lines), 5.10 z size, hmph, cap-lift note.

**Rejected**: none (the two storm-cloud findings were the same bug).

**Deferred**:
- The ford's water (`#6cb8d8`) is a prop, not a gated floor, and in `ahead` its ellipse reaches feetY + 4. Rule for
  S9: the team stops before a set piece and never stands on the ford water in `ahead` (in `met` the water shrinks to a
  thin band under the stepping stones); if S9 walks the team across it, add a gated FLOORS entry for it.
- The talked-round smile/blush are mostly hidden under the moustache at 1x (documented in 5.10); arms + facing carry it.

### S9a follow-up: contract alignment and the mockup miller

**The merge.** `git merge --no-ff af25650` (the mission contract) is a merge commit on this branch. The add/add on
`src/game/missiondata.ts` resolved to the union: every contract export under the contract's names and meanings
(`RegionId`, `Climate`, `ChallengeId`, `Skill`, `Difficulty`, `BaddieId`, `BaddieExit`, `BaddieFace`, `BaddiePose`,
`MillerMood`, `StopState`) plus S9a's lists (`CLIMATES`, `CHALLENGE_IDS`, `SKILLS`, `BADDIE_IDS`, `BADDIE_EXITS`,
`BADDIE_FACES`, `BADDIE_POSES`). The merge commit kept `MillerState` / `SetPieceState` as deprecated aliases only so
it typechecks; the follow-up commit removes them. `seams.ts` and `trip.ts` came in untouched.

**Renames.** `MillerState` -> `MillerMood`, `SetPieceState` -> `StopState` everywhere (no aliases left).
`backdrops.ts`'s own `PicRect` is gone: `drawClimate` takes `icons.ts` `Rect`.

**The signatures S8/S9 call** -- import from `src/game/artseams.ts` only (now plain re-exports of the kit):
- `drawClimate(ctx, climate: Climate, phase: DayPhase, rect: Rect, scroll = 0)` (backdrops.ts)
- `drawSetPiece(ctx, id: ChallengeId, x, feetY, state: StopState, t)` (setpieces.ts)
- `drawBaddie(ctx, id: BaddieId, x, feetY, facing: 1 | -1, face: BaddieFace, pose: BaddiePose, t)` (baddies.ts)
- `drawBaddiePortrait(ctx, id: BaddieId, x, y)` (baddies.ts, 24 x 24)
- `drawMiller(ctx, mood: MillerMood, x, feetY, facing: 1 | -1, t, silhouette: string | null = null)` (npcs.ts; the
  trailing `silhouette` is optional, for the gallery). `facing` = the side the team talks to him from: grumpy he stands
  turned away from it; talked round he faces it. His sack stands 24-26 px in front of his feet along the way he faces.
- `CHALLENGE_ICONS: Record<ChallengeId, Sprite>`, `SKILL_ICONS: Record<Skill, Sprite>`, `SADDLE: Sprite` (missionicons.ts)

**The miller is now the mockup's ("Hob")**, drawn through the real keeper rig: `npcs.ts` builds `buildKeeper('miller')`
and a `KeeperPlayer(millerAnims(...))` once (blinks off), plays `grumpy` / `talked` and seeks to `t mod 180`, so every
pixel is a pure function of (mood, x, feetY, facing, t). The hand-rolled parts, `MILLER_PALETTE`, `MILLER_SPEC` and
`MILLER_SKIN_SHADOW` are deleted (palette-check's separate miller block with them). Grumpy: turned away, arms folded
(both fists tucked: `KeeperRig.fold`), heels, chin tucked (`KPose.headY`), flat bushy brows pressed onto half-lidded
eyes that side-eye back, a pout under a drooping moustache, the hmph puffs. Talked round: facing them, brows up,
smiling eyes, blush, small smile, a nod, the near fist at the cap's peak tipping it -- the arm is `armN: [89, 66]`
(the mockup's `[89, 76]` put the fist over the front of his face; 66 keeps the fist at the peak and clear of the eyes,
moustache and smile). One change from the patch besides that: its `(Ki)` sack gate named an undefined `FLOOR_REF`;
it now checks the sack on every `FLOORS` entry (straw, path, road).

**Keeper files changed (S7 may conflict here)**, all from `notes/miller_mock.patch`, applied as-is minus the MOCKUP
wording (no `src/mock/`, no gallery `view=millermock`):
- `src/art/keeper/cast.ts`: `NPC_IDS = ['miller']`, `NpcId`, `CastId = KeeperId | NpcId`, `NPCS`, `CAST`; `KeeperSpec.id`
  widened to `CastId`, `job` to `CareJob | null`; new optional spec fields `moustache`, `bushyBrows`, `apronOver`;
  `HairStyle` + 'rim', `HatStyle` + 'flatcap', `ToolKind` + 'sack', `sleeves` + 'rolled'. `KEEPER_IDS` unchanged.
- `src/art/keeper/palettes.ts`: `KEEPER_PALETTES` / `KEEPER_SKIN_SHADOW` keyed by `CastId` (a `miller` entry each);
  `KeeperPalette.flour?`.
- `src/art/keeper/parts.ts`: `KFACE.grumpy` (8) / `glad` (9) and their face branches, bushy brows, the moustache (via
  the beard hook), the 'rim' hair, the flat cap and `capTip`, the rolled forearm, the trousers-apron hips, the hugged
  sack and exported `drawSack` / `SACK`, `drawKeeperHand` returns early on `fold`; `keeperParts` takes 'rolled'.
- `src/art/keeper/rig.ts`: `KeeperRig.sack` / `fold`; `buildKeeper(id: CastId)` reads `CAST`.
- `src/art/keeper/anims.ts`: `KPose.headY`; `millerAnims` (`carrySack`, `grumpy`, `talked`).
- `tools/palette-check.ts`: the keeper loops run over `K_CAST = [...KEEPER_IDS, ...NPC_IDS]`; miller-only pairs.
Nothing iterates `CAST` / `NPCS` / the palette records' keys; the sim, saves, HUD and keeper loops still use `KEEPER_IDS`.
The four keepers render byte-identically before/after (keepers idle/walk/wave/cheer/pet/kneel, care, yard t900,
base t600 day and night, compared as PNG bytes).

**Gates:** `KEEPERS: PASS 233 of 233` (was 231: the separate miller block replaced by the miller in the shared keeper
loop, with the patch's pairs); dragons 2492/2492, BACKDROPS 3497/3497, BADDIES
387/387, EGGS 8/8 unchanged. Docs: ART_BIBLE 5.10 miller paragraph; KEEPERS.md counts (231 -> 233; the stale "156"
in section 8 too) and a status note on the NPC.
