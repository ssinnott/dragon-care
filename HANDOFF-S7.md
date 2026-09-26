# HANDOFF S7 (drop this file on merge)

S7 "Take a keeper" (issue #6) is built on claude/outstanding-issues-s7 from b17210c: commits 92ec39c and b868cb5, with `npm run check` green.

**SAVE_VERSION bumped from 6 to 7** (src/game/save.ts). The merge renumbers it.

Below are the S7 sections appended to notes/handoff.md, verbatim.

## S7 — Take a keeper

**Built** (base b17210c; `npm run check` green on the committed tree: typecheck, palette 2374/2374 + keepers 164/164 +
backdrops 1105/1105 + eggs 8/8 (unchanged: no new colour is gated), sim sections 1-17 in about 24.5 s wall (was 22.5),
smoke **92 views** (90 + the frozen `take=bea` case + the live `baseControl` case) + 1 moved pair + 2 TINT pairs, about
6 min 40 s). Closes #6's criteria ("choose a person - then you will control them and be able to do this chores", "Uses
standard WASD controls - and a button to feed/collect stuff").

- New: `src/game/control.ts` (commands, walking and climbing by hand, `actionFor` / act, `releasedState`).
- Changed: `sim.ts` (Keeper fields, the command queue, the `manual` phase, exclusions, stats), `save.ts` (v7; a keeper
  held saved released), `people.ts` (anims by hand, the mark, the "?"), `hud.ts` (badge states + `badgeAt`, the pad, the
  action line, the portrait line, the new hint), `base.ts` (tap order, per-pointer input, keys, follow camera, `fit`,
  hook), `gallery.ts` (`take=`), `types/globals.d.ts`, `tools/sim-check.ts` (NEW section 17), `tools/smoke.ts`
  (`baseControl` + a frozen case), `tools/shots.ts` (`base_control`), docs BASE_DESIGN (B2, B7, 4.8, NEW 4.10, 8.1 built
  paragraph / file table / sim-check row / not-in-slice), KEEPERS (K11, status), `docs/base/base_live.png` re-rendered at
  t=2940 (only the hint's text changed; the sim is untouched, so the caption still matches).

**Exported names and signatures** (NEW / DIFFERS against plan S7's type block)

- `control.ts`: `type Command` exactly as plan; `interface ActionPreview { kind: 'pickup'|'serve'|'putback'|'wait'|'none';
  label; job? }` as plan; `applyCommands(sim)` (start of `step()`, right after `tick++`, in push order, then cleared);
  `stepManual(sim, k)` (any phase but `work`); `actionFor(sim, k)`. NEW: `REACH_PX 24`, `LADDER_PX 8`, `CUE_STEPS 30`,
  `SUPPLY_NAME {food BOWL, play BALL, bath BUCKET}`, `controlledKeeper(sim): Keeper|null` (manual or pendingTake),
  `becomeManual(k)`, `releasedState(sim, k)` (the fields a release sets: at work -> stays `work` with its job, finishing
  it; else `home` with a route to the station (a climb under way first), or `idle` if there), `ladderAt(sim, k, dy)`.
  `act` is private (a Command). The label text is the action only (`E: FEED WICK`); the view prefixes name and supply.
- `sim.ts`: `Phase` += `'manual'`; `Keeper` += `manual`, `held {dx, dy}`, `cue`, `pendingTake` (plan). `SimStats` +=
  `taken` (every take), `handovers` (an auto keeper who had claimed the served job; they `drop` and go home), `doneBy`
  (jobs finished while held, by name). `CareSim.commands: Command[]` (public field; in sim-check's UNSAVED: input, not
  the world), `command(c)`, **`controlled` is a getter** (id of the manual or pendingTake keeper; not a stored field).
  DIFFERS: `startWork(k)` is now public (control.ts serves through it). NEW private `free(k)` (= no job, not manual, not
  pendingTake) used by `assign` and `sendRushed`; `sendRushed`'s pre-emption skips manual/pendingTake; `rush` never sets
  `rushing` on a manual keeper; `drop(k)` on a manual keeper returns the job and leaves them `manual` where they stand;
  `finish()`: manual -> `doneBy++`, back to `manual`; pendingTake -> `becomeManual`.
  **S8's rider auto-pick must skip `k.manual || k.pendingTake` too** (use the same test as `free`).
- `save.ts`: `SAVE_VERSION = 7`. DIFFERS: `serialize(sim, exact = false)`: a save stores every held keeper as
  `releasedState` (so a save == the world a `release` command that step makes, checked exactly); `worldKey` and
  `barnKey` use `exact = true` (the digest sees the hand). `stats.doneBy` copied both ways; `fromSave` throws on a keeper
  saved held (`manual`/`pendingTake` true, phase `manual`, a bad `held` or `cue`).
- `hud.ts`: `BADGE_Y 1, BADGE_H 13`, `type BadgeState = 'free'|'busy'|'held'`, `TopBar.keepers[].state` (was `busy`),
  `badgeAt(sx, sy, n)`, `type PadButton = 'up'|'left'|'right'|'down'|'act'|'letgo'`, `PAD` (plan 3.11's rects), `PAD_DIR`,
  `padAt`, `drawPad(ctx, pressed)`, `drawActionLine(ctx, s)` (right-aligned at (632, 258)), `drawPortraitHint(ctx)`
  (y 34). The held badge is lit (`#6b4a34`) with a 3 x 2 cream down-mark at x+43. The hint is now `TAP A BUBBLE: RUSH
  TAP A KEEPER: TAKE`, hidden while a keeper is held. **S8's MAP button and COIN are unaffected (badges still end at 328).**
- `people.ts`: `stepKeeperVisual(agent, k, y, moved = false)` (base.ts passes `walked` changed this step); the mark is a
  7 x 5 down-arrow in `KEEPER_PALETTES[look].primary` at head - 17 (the rush slot), the "?" 7 x 9 at head - 30.
- `base.ts`: `BaseViewOpts.take?: string|null` (by name, any case; queued in the constructor, re-queued in `attach()`
  if a load swapped the world). Private: `walkedWas`, `keysHeld`, `padHeld` (by pointerId), `sent`, `followPause`,
  `portrait`, `take(id)`, `takeByName`, `steer()`, `follow()`, `focusKeeper`, `keeperBox`, `actionLine`, `badgeState`.
  Tap order as plan (buttons/badges, pad, card, chips, bubbles, keepers, dragons, empty = release). Follow: feet kept in
  screen x 160-480, y 90-270, 1/8 a frame, not while `camTo` eases; a drag pauses it 180 frames.
- Hook (`window.__dragonCare.base`, globals.d.ts updated): `keepers: {name, f, x, phase, carrying, box}[]` (box canvas
  px; + `phase`, `carrying` beyond plan), `controlled` (name|null), `badges` (by name), `pad` (by PadButton, always
  published), `action` (the line or null), NEW `doneBy`.
- `gallery.ts`: `GalleryParams.take: string|null`; `persist` rule unchanged.
- sim-check: section **17 control** (plan's §16 was taken by S6). smoke: `baseControl(page)`.

**Measured**

```
17 control: BEA taken, fetched the bowl and fed EMBER by hand (149 steps at work, doneBy {"BEA":1}, 1 handed over), climbed the centre ladder up in 141 steps and down in 141; 10000 steps held with 20 Rushes and no job she didn't take; let go, home in 371 steps; the same script twice, the same world; every chore by hand: feed ember, bathe ripple, play with zap, groom bramble, tuck in wick, groom bramble in the garden; saved held, loaded released and stepping on as a release makes it: walking (BEA manual: loaded home), climbing (BEA manual, climbing: loaded home), picking up (BEA pickup: loaded home), at work (BEA work: loaded work), taken at work (BEA work: loaded work); R4: the ground floor out in 98 steps, the Aerie deck's end out in 160 steps
6 saves: 6628 bytes at step 5000 (was 6328: the new keeper and stats fields)
smoke control: BEA taken by her badge, walked by d (x 362 -> 398), let go by Esc, taken by a tap on her, walked by the pad (x 388 -> 418), let go by LET GO
smoke TINT: world bb6e59e9 = bb6e59e9 (unchanged), barn d553762f = d553762f (was b4c21913: keepers carry the new fields), full frames 1fa58f72 / b862d05e (the hint's new text)
```

Sections 1-16 print exactly S6's numbers (auto care is byte-identical with nobody held). Mutation-checked: `free()`
without `!k.manual` fails section 17 at once ("BEA, held by hand, is fetch with a job"). Touch checked with a scratch
Playwright run (CDP touch events) at 390 x 844 (canvas 390 x 219, the portrait line shown) and 844 x 390: badge tap
takes PIP, a held pad arrow walks her, E picks up the ball, LET GO releases; no page errors.

**Deviations and why**

1. **Section 17**, not 16 (taken by S6).
2. **A keeper held at work is saved (and released) still at work, finishing the job**, not "phase home, no job" as
   plan 3.6 says literally. Why: the plan's take rule already refuses to stop a tuck-in halfway (pendingTake); a save
   that dropped the job would stop a sleep act mid-way and differ from what a release does. Now a save is exactly the
   world a `release` that step makes (section 17 steps five such saves 5000 on against a released twin: equal digests).
   Everyone else is saved `home` with the route rebuilt in `serialize` (or `idle` if already at the station).
3. **`worldKey`/`barnKey` are the exact state** (`serialize(sim, true)`), the save is the released one: the digest two
   runs compare must see who is held.
4. **`controlled` is a getter** and `commands` is listed in UNSAVED (input for the next step).
5. **Release mid-work** lets the keeper finish that job as an auto keeper (then home); `doneBy` counts only jobs
   finished while held.
6. **Extra line texts** beyond the plan's list: `ZAP WANTS THE BALL` (dragon ready, wrong/no supply), `TAKING THE
   BOWL` (pickup), `FEEDING WICK` (at work), `FINISHING A JOB` (pendingTake). Kind stays `none` for these.
7. **R4 at the Aerie deck**: the keepers' f5 span ends at 638, inside the bay; a held keeper there turns and walks out
   (otherwise they could hold the car forever). Checked in section 17.
8. **smoke clicks BEA's box at 3/4 of its height**, not the centre: a waiting dragon's bubble (tapped before keepers)
   can stand over the top of her box.
9. sim-check 17 goes beyond the plan's list: every chore by hand (feed, bathe, play, groom, tuck in, a garden
   resident), putting a supply back, five save moments, R4 on two floors, and "let go" checked twice (in the busy
   script: a keeper like the others at once; in a calm barn: home and idle at the station).
10. `docs/base/base_live.png` re-rendered (not in the plan's docs list) because the hint text in it changed.
11. S5's note on `inTheWayOfGrowing`: kept as is -- a held keeper standing where a due dragon's new body will be holds
    it a step at a time; walking away ends the hold (option 1 of S5's two).

**Gaps and stand-ins**

- **The pad and the action line can cover a ground-floor dragon's head** at the screen's right: with the camera following
  a ground-floor keeper it sits at the world's bottom (camY 400), where adult heads are at screen y ~245-285 and the pad
  starts at y 272 (plan 3.11's fixed rects). In `base_control` the line and the up arrow are over RIPPLE's head in the
  bathhouse. The pad is UI like the job strip and the card; recorded in BASE_DESIGN 4.10 and 8.1. The world-drawn mark
  and "?" never cover an eye (keepers sort behind dragons; the mark is drawn with the keeper).
- No climb anim: a climb shows `idle` (KEEPERS status).
- The "whole loop by hand in `npm run dev`" was driven headless (smoke + the scratch touch run), not by a person.
- A player can hold a keeper walking back and forth inside the lift bay and so keep the car waiting (R2) while they do.

**See it**

- `node tools/shot.ts out.png="view=base&t=120&take=bea" --scale 2` (`base_control`: BEA's lit badge, her mark, the
  line "BEA", the pad; the camera eased to (168, 400)). `"view=base&t=160&take=bea&cam=100,400" --scale 3` (the mark
  close up).
- Live: `npm run dev`, `index.html?save=0`: tap Bea (or her badge, or Tab), A/D to the hearth, E (bowl), to EMBER's
  stand spot when it waits in the kitchen, E; W/S at the centre ladder (x 680); Esc. Touch: a 390 x 844 or 844 x 390
  window with touch emulation.
- Shots looked at: `scratchpad/shots/s7/` (control.png, control_act.png at 3x, touch_portrait.png, base_control.png)
  and `docs/base/base_live.png`.

### S7 review

**Fixed**

1. **(major) A held keeper parked in a due dragon's new body froze it for good.** Reproduced (reviewer's grow2 probe: EMBER
   held on 59 993 of 60 000 steps, needs at 0). `life.ts inTheWayOfGrowing` now skips `k.manual` keepers (S5's option 2:
   the dragon grows beside them). A `pendingTake` keeper still counts: they are at work, like an auto keeper. Probe
   after: EMBER grew, emptySteps 0. sim-check 17 NEW case: BEA parked at EMBER's stand spot (growup preset) → "grew 0
   steps past due, no need ever at 0" over 20 000 steps. Mutation (the old test): fails with "adult 2994 steps past due".
   BASE_DESIGN 7 ("room to grow") says a keeper held by hand does not count.
2. **(blocker) The pad and the line covered ground-floor heads.** Head offsets were measured through the hook (every
   stage, presets ages/full/growup/retire/new, 120 frames): cranium 12-52 px over the feet. NEW layout (`hud.ts`):
   - `PAD` is now ONE ROW at y 305-335, right-aligned at 634: `letgo (404,305,48,30)`, `act (458,305,44,30)`,
     `left (508,…,30,30)`, `up (540)`, `down (572)`, `right (604)`. This DIFFERS from plan 3.11's cross.
   - The action line moved into the hint's slot: right-aligned at x 634, an ink strip at y 339-356 level with the job
     strip. `drawActionLine(ctx, full, short, stripEnd): Rect | null` falls back to the action alone if the strip
     reaches it. The line is now UNDER the pad.
   - The follow camera frames the keeper's floor: the feet go to screen y `FRAME_FEET = 196` (clamped to the world, so
     the ground floor's feet sit at 296 and the upper floor's at 196). The x box 160-480 is kept, and the y box 90-270
     is gone. So the lowest floor on screen always has its feet at y 296-308, its heads above y 300, and the floor
     below it off the screen.
   - The hook adds `line: Rect | null` (globals.d.ts updated). smoke has a NEW `hudClear` (no head ±6 inside a pad
     rect or the line) on the frozen `take=bea` case, a NEW frozen `view=base&t=200&hour=22&take=iris` case, and 6
     samples during the live d-walk plus one after the pad walk.
3. **(major) The mark was under the top bar on f2.** Fixed by the framing above: the head is 196-78 px down the
   screen. smoke's `markShown(name)` checks `box.y − 35 ≥ 16` on both frozen take cases. Seen in shots/s7r/iris.png
   (IRIS on f2 at night, mark shown).
4. **(major) A near miss on the pad let go.** `PAD_ZONE (398,299,242,42)`: `padAt` returns the NEAREST button anywhere
   in the zone, so a tap there never reaches the world. Touch-tested at 390x844, 844x390 and 640x360: gaps and edges
   keep the keeper held. A miss just left of LET GO snaps to LET GO, which is intended. smoke taps two gaps.
5. **(minor) Paused take/release.** `BaseView.held()` is the sim's controlled keeper with the queued take and release
   commands applied. It drives the badge toggle, the lit badge, Tab, the pad hit-test, the line and the follow camera.
   The hook's `controlled` stays the simulation's. smoke step 7: paused, TOMAS's badge lights his line, a second tap
   clears it, and playing on nobody is held. `actionLine` shows just the name for a take not yet applied.
6. **(minor) Wording.** The line now reads `TURN SIDEWAYS FOR BIGGER BUTTONS`, drawn left of the pad on its row at
   (6, 317) instead of y 34, where it could cover the hayloft. The buttons are 30 px tall at 1x (18 CSS px portrait,
   30 landscape).
7. **(minor) No climb hint.** `actionFor` adds `↑: CLIMB UP` / `↓: CLIMB DOWN` / `↑ ↓: CLIMB` (kind 'none') within
   LADDER_PX of a ladder, when nothing else applies. sim-check 17 checks `↑: CLIMB UP` at the centre ladder's foot.

**Rejected:** none. All seven were reproduced or confirmed in the code.

**Deferred:** none from the review. The implementer's gaps stand: there is still no climb anim, and a player can
still walk a keeper back and forth in the lift bay (R2).

**Numbers:** sim 17's line adds "parked at EMBER's stand spot as it fell due, it grew 0 steps past due, no need ever
at 0". Sections 1-16 are unchanged. smoke has one view more (the take=iris case).
Docs: BASE_DESIGN 4.8 (portrait line), 4.10 (camera framing, the line under the pad, the ladder texts, paused, the
pad's new row and the snapping zone, and the no-head-covered claim replacing the old gap), 7 (room to grow), and 8.1
(the pad gap line removed).

**For S8:** the MAP button and COIN are unaffected. The TEAM OUT chip at (520, 19) is clear of the pad. Anything S8
adds at the bottom right must stay clear of `PAD_ZONE` and the line's strip (y 339-356, from x ~400).
