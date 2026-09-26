// Headless check of the base's care simulation (src/game/sim.ts; docs/BASE_DESIGN.md 4). No browser: the simulation
// is plain data and functions, so Node runs it directly.
//
//   node tools/sim-check.ts        (npm run sim; part of npm run check)
//
// 1. Routes on both nets: every keeper, from their station, reaches every slot's stand spot (for every stage that fits
//    the slot), every supply post, the riders' rooms, the Aerie deck and a resident on every plot of a seven-plot
//    garden, and back (the ladders, the doors, the Garden Gate); every stage's dragon net joins every slot that fits it
//    to every other and to the deck, both ways, by the Dragon Lift (each ride one leg) and never through a tower but
//    the Garden Gate's arches (every dragon span inside the barn, the garden or on the deck), and an elder reaches every
//    plot from every slot; every stand spot is inside its room.
// 2. Thirty minutes of play on the starting base (seeds 1, 2 and 3), with the invariants checked as it runs: needs
//    stay in 0..1, one job per dragon and need, a claimed job and its keeper point at each other, one keeper per
//    dragon at a time, nobody stands off a floor, nobody stalls (a keeper at a stand spot or the bay's edge, a dragon at a landing or
//    the bay's edge, only so long); the dragons on their nets, a rider at the car's middle, one rider, the car in its
//    shaft, nobody in the bay on a floor the moving car passes (the bay rule), a module holding one grown dragon or
//    two babies, a dragon met only in its slot of the need's own room, a keeper at work on the stand spot; then the
//    service it gave: no need ever empties, the waits (a job's, a keeper's at the stand spot, a dragon's at the lift)
//    stay short (the average over the three runs), no eye is left under a standing body but for a moment, and every
//    dragon walked and was met in four rooms or more (#7).
// 3. Two runs from one seed agree step for step (on the digest: the whole save, less the seed); two seeds differ.
// 4. Rush with every keeper busy (every dragon waiting in its own need's room): the job goes to the top, its dragon
//    goes for it at once, a keeper comes off the lowest job for it, and it's done; and a Rush into a full room bumps
//    the lowest holder whose keeper hasn't started.
// 5. The start cast (#9): seven dragons, one of each element, every one adult and 0 days into the stage, ids 0-6.
// 6. Saves: a world saved at step 5000 and loaded (through JSON) steps on to the same world as the one it came from,
//    from that save and from more taken mid-fetch, mid-climb, mid-job, mid-Rush, mid-walk, mid-turn, at a landing,
//    boarding, mid-ride and alighting (and one at the first call for the car of all, one at the first ride); a save's
//    walk speeds and each room's own uses are kept, and one it can't keep throws; and on a short day, with eggs incubating (plan
//    S5), a baby walking to the module slot it will grow up in, an egg just hatched and a dragon just grown up; and with
//    the garden (plan S6): residents napping, sitting, strolling, waiting and being met, elders setting off, riding down,
//    passing the gate and arriving; and with a mission's team out (plan S8): mid-muster, departing, away, landing (the
//    egg carried down, the saddles hung back) and resting; a save survives JSON unchanged, every field is in it; another
//    version throws, and so does one whose missions this build can't run.
// 7. rngAt: the same keys give the same draws, different tags different ones, and the draws are even.
// 8. Rooms (#11): every room kind and structure has a purpose, each need is met in exactly one kind of room (its rooms
//    repeated on the floors: the barn room by room as BASE_DESIGN 3's table says -- floor, module, post, the keepers'
//    waiting spot, an adult's stand spot), the plates name only rooms and structures there are (none on a bare slot),
//    placing rooms and dragons keeps the building's rules (no room on the lift; a slot per dragon, fitting its stage),
//    the start stands in its rooms and the keepers wait at their fixed stations, clear of every grown dragon's slot (a
//    resting baby's tail a little in, never its head); and (checked at the end, over the whole suite) every named room,
//    the lift, the Aerie, the gate and the garden were used (sim.stats.used), and every room itself (stats.usedRoom:
//    each copy of a need's room), unless their mechanic is still PLANNED -- and a PLANNED one that shows a use fails, so
//    its entry must go; since the missions nothing is PLANNED (#11: every named, furnished room has a real purpose,
//    proven used).
// 9. Gait (#7: dragons walk by their anims' own root motion): every walk's table is the same whatever the seed, it
//    moves as its anim table's frames and an anim player playing it say (a walk with an intro too, wrapping and caught
//    up as the view does), played faster by the lively step (BASE_DESIGN 2: on and off the car and across the bay) it moves
//    its body by exactly the same factor as the player at that speed (G13), and a dragon walked by the simulation across
//    the lift bay moves exactly as far as the anim player playing its walk at the lively step's speeds would carry it;
//    the paper turn is the yard's.
// 10. Barn capacity (BASE_DESIGN 4.7): the benchmark cast `twelve` (tools/capacity.ts) for 30 minutes, checked every
//    step as section 2 -- no need empty, short waits, the car mostly free, no stall, no two in the shaft; eight adults,
//    ten, and the ages preset's twelve keep their service; the `full` preset, forced 9 over the cap, keeps moving with
//    its egg waiting; and (the S6b review) a barn of babies -- any mix under the cap -- is served: four babies each
//    resting in the room another wants are met (a job's wait for its own floor's room ends at SOON), twelve babies
//    packed from the ground floor up served for 30 minutes, and two walking up to a landing at one spot placed in the
//    order they stand, never turned back and forth. (It runs in three worker threads beside the other sections, and is
//    printed at the end: the suite keeps to 30 s.)
// 11. The clock (docs/BASE_DESIGN.md 7) on a real day and a 600-step test day: the day, the hour and the phase at each
//    phase's start, the sky's three stepped thirds over a phase's first hour, day 2 at midnight, a whole day read step
//    by step (the phases in order, the turn never going back; the lights, the HUD's sun or moon and the walls' night
//    step (plan S6c: 0 under the day's sky, 3 under the night's, with the lamps' rings, every step 0-3 over a day) in
//    step with the sky, never switching on a phase's first step), the label (and the top bar's room for it to day 99 999), and a
//    world's start hour.
// 12. Night is not the barn's (plan G8): a world started at 07:00 and one started at 19:00, the same seed, are the same
//    barn (save.ts barnKey: every absolute clock left out) every 1000 steps for 20000 -- so view=base's no-tint check,
//    day against night, compares one world -- and no simulation module of the barn reads the day's phase (the garden's,
//    garden.ts, does: its residents nap at night, G8's one exception so far; sim.ts and life.ts call into it, and its
//    state, the residents' rhythm, is left out of barnKey).
// 13. Growing up (#8: "a 'month' of game time to have a dragon grow from one age class to another"; plan S5): on a
//    600-step day, a baby grows young, adult and elder, one grow event each, its stage's start moved on exactly 30 days
//    each time (the elder stage's, which has no next, the step it grew: its time to the garden is all its own), after
//    walking from the Hatchery to a module slot, and its drains follow the new stage; a stage-up only
//    ever applies to a dragon settled in a slot it fits (no act, no keeper on it) with no keeper where its new body
//    will be, and it then holds still for exactly its `happy` (no walk, no turn, no act, no keeper coming); the delay
//    from falling due is short alone and bounded by an errand in the busy barn; at the real day's length, 30 days less
//    a minute in, an adult is an elder within a minute of play; and a baby on its way to grow up, Rushed to a need in
//    the room it is going to, is served in a baby's sub-slot there, never in the module slot.
// 14. Eggs (#5.4's Hatchery side, under the hayloft's west slope): three eggs fill the three nests and a fourth is not
//    taken; an egg hatches exactly two days after it was laid into a baby with a new id, its element's first free name
//    and the egg's seed, the Hatchery's sub-slots first (one in front of no other egg, then the one nearest its nest);
//    the baby asks for food at once and is fed within three minutes; with every baby sub-slot taken (a small barn) an
//    egg waits in its nest, nothing lost, and hatches as soon as one frees -- but not in a barn over its cap; a baby
//    moved on never comes to rest in the Hatchery; names never repeat and stay within 8 characters; two runs give the
//    same names and seeds.
// 15. Retirement (#10: "dragons who are too old (30 days pass elder) will move to this area"; plan S6): on a 600-step
//    day, the retire preset's seven elders and the busy barn's (seven adults growing elder mid-errand, late, then
//    falling due to retire mid-errand) each retire once, never before 30 days into the elder stage -- 30 days after the
//    step it grew into an elder, however late that stage-up was -- and soon after, wait at a landing no longer than
//    a barn dragon may (in a crowded barn too: ten adults, one elder retiring from a floor up), walk out through the
//    Garden Gate (counted: #11) to a plot of their own soon enough, and the garden grows to
//    hold them (plots = max(2, residents + retiring), the world 1304 + 176 a plot + 32 wide); all along, a retiree asks
//    for nothing and holds no slot, a resident stays in the garden with no barn slot, everyone keeps to their nets and
//    the bay rule, and the garden's resting places keep clear of each other's eyes and roomy (no two bodies overlapping
//    more than REST_OVERLAP).
// 16. The garden's residents (#10: "Here they will sleep a lot and move around - and not have a lot of needs"): the
//    garden preset for 30 minutes of the real day -- each resident asks only for food and love, drains them at a
//    quarter of an elder's rate, naps half its steps or more and every night step it is not being met, strolls, and is
//    met where it rests by a keeper come out of the barn at its snout (the garden used); no resident at rest with its eye
//    under another's body, nor two at rest lying one over the other (bodies overlapping REST_OVERLAP px at most); the
//    barn beside them keeps its service; the keeper visits per resident are printed.
// 17. The Map Room's board (#5.1, #5.2): the same twice for seeds 1-5 and days 1-10; day 1 starts with THE LOST NEST;
//    three missions at most, one an explored region; no baddie before day 3; each difficulty's road its length, from
//    its region's pool; a world rolls it at its start and at every 05:00.
// 18. The odds (#5.3): a table of hand-computed teams (the plan's two examples, the top clamp, the least a pair has).
// 19. Who may go: no baby, no young dragon on a normal or hard road, no garden resident; a keeper taken by hand is
//    never an auto rider nor on BEST TEAM, is never given a job, can't be sent (canSend, and a send command refused
//    with its reason), and a rider on a trip can't be taken by hand (control.ts take: a `refused` event) -- all through
//    S7's own commands (seams.ts isTaken: the merge); a keeper taken at work whose dragon is then sent is the
//    player's where they stand, and steerable (CareSim.drop); two riders at most, two keepers always home; one team out.
// 20. A full trip (#5.4, #5.6, #11): THE LOST NEST with RIPPLE and ECHO -- the Map Room, the Tack Room, the lift up
//    and the Aerie; the muster in 3600 steps or fewer; away, the team asks for nothing and its needs wait; back at
//    returnAt exactly, food and sleep down; the egg laid in its reserved nest (and hatched two days on), the saddles
//    back, the Bunks, the riders on duty again, the coin paid, the neighbour revealed at the next dawn. And the step the
//    muster preset's team stands on the deck (the base_muster shot). And musters sent in the middle of play (BEST TEAM
//    on a board mission, seeds 1-6, 600 and 1500 steps in): each done within MUSTER_MID_MAX (the lift serves one dragon
//    at a time, so a car already under way, or a team dragon at work, makes it longer than a fresh world's).
// 21. A failure: a low-odds send that fails turns back at its first unmet stop, with half the coin and no egg; a failure
//    that met every stop turns back at the last and says why (the weather).
// 22. A trip's outcome is its seed's: the same sends on 20 seeds, twice, the same outcome, egg and road; day 1's LOST
//    NEST met in full always succeeds (the tutorial: seed 1's roll alone would fail it), BEST TEAM on it included.
// 23. Care while a team is away (P13: two keepers home are enough): a two-pair team away 30 minutes of the real day;
//    no need at home ever empties, and the barn's service holds (the average wait within 25 % of section 2's gate).
// 24. The watchable scene (#5.3 on the road, #5.5 the big baddie; plan S9): an easy, a normal and a hard mission (Old
//    Mine Road's, Highfold's and Frostmere's, each with its baddie), each way it can end, read from the scene's pure
//    function at every step of the trip: the team at its places as it leaves and done when its time is up, its travel
//    time never falling, its dragons never walking back before they turn back nor on after, standing still through
//    every stop's beat, turning back at the end of the first uncovered stop's beat on a failure (never on a success),
//    each travel step moving each dragon by exactly its walk's distance over that step at its speed (no skate: s times
//    the frame's move, within 1e-9), a baddie's face only one of the four, and its exit (calmed, outwitted, driven off)
//    shown on a success, the baddie only ever moving the way it faces, and one that walks off (outwitted, driven off:
//    the art kit's exitLook) ahead of every rider until it is off the screen's right edge; the TRIP LOG telling each
//    stop (met, unmet, never past a turn-back) at exactly the step the scene's banner has shown it; the view's team (ScenePets), synced by clock jumps of 1, 8 and 40 and across a 1000-step gap,
//    playing the walk frame the road says on every travel step; the trip preset puts a team exactly that far along at
//    the frozen step, the world's own trip, away (its dragons off the map, its riders away), its world saved exactly
//    though its team left before the world's clock 0 (a departAt below 0); the preset's road is the
//    missions' own (missions.ts roadOf: every stop's log `NAME - WHO WHAT`) and its rider pick too (autoRider), which
//    passes over a keeper taken by hand (seams.ts isTaken).
// 25. Taking a keeper (#6: "choose a person - then you will control them and be able to do this chores", "WASD
//    controls - and a button to feed/collect stuff"; plan S7): BEA taken by a command is held by hand after one step,
//    walks to the nearest hearth, takes the bowl (E, 40 steps), feeds EMBER in its kitchen slot from its stand spot
//    (doneBy), crosses the lift bay under the bay rule, climbs the centre ladder up (W) and down (S) within 200 steps;
//    held 10 000 steps or more with jobs pending, until 20 Rushes have gone on open jobs, she is never given a job she
//    didn't take; let go, she is a keeper
//    like the others (in a calm barn, home and idle at her station); the same commands give the same world; every
//    chore by hand (feed, bathe, play with, groom, tuck in; a resident met in the garden), supplies taken and put back;
//    a world saved with a keeper held (walking, climbing, picking up, at work, taken at work) loads with no one held and
//    steps on exactly as the world given a release that step; R4: let stand in the lift bay she walks on out of it (at
//    the Aerie deck's end, which lies in the bay, turning back); walked west along the deck she stops at its west end,
//    never out along the sky bridge (the riders' way off the world, off the screen). The section 2 invariants hold every step (the idle one
//    for every keeper not held by hand). The missions' seam (seams.ts isTaken, which S8's rider pick asks) says taken
//    of the keeper held, or taken at work, and of nobody else; let go, of nobody.
// 26. The barn's cap (BASE_DESIGN 4.7; life.ts BARN_CAP): the twelve preset -- the cap's twelve -- with an egg falling
//    due: it waits in its nest while the barn is full (one `full` event, on its due step), the count never over the cap,
//    and it hatches within 2 steps of an elder arriving in the garden; a save taken while it waits steps on the same.
//    And the cap beside the missions: a team sent from a full barn on a road that brings an egg (the chooser says
//    BARN FULL: THE EGG WILL WAIT -- seams.ts barnRoom 0 -- and sends it all the same), away dragons still counted; the
//    team lands, its rider carries the egg up to the Hatchery by the keepers' ladders and lays it in the reserved nest,
//    where it waits past its due while the barn is full, and hatches within 2 steps of a retiree arriving in the garden.
import { isDeepStrictEqual } from 'node:util';
import fs from 'node:fs';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { CareSim, REACH, DAY_STEPS, START_HOUR, PICKUP } from '../src/game/sim.ts';
import { actionFor } from '../src/game/control.ts';
import type { Command } from '../src/game/control.ts';
import { nextStage, stageDue, inTheWayOfGrowing, HATCH_FOOD, BARN_CAP, barnCount, barnFull } from '../src/game/life.ts';
import { CASTS, parseCast, placeCast, runOne } from './capacity.ts';
import { NAMES, NAME_MAX, hatchName } from '../src/game/names.ts';
import { GROWUP_IN, HATCH_IN, EGGS_PRESET, RETIRE_AT, sendLostNest } from '../src/game/presets.ts';
import {
  boardFor, oddsOf, autoRider, bestTeam, dragonReason, canSend, send, onTrip, roadOf, tutorial, DIFFICULTY, BADDIE_FROM_DAY, BOARD_MAX, LOST_NEST, HOME_KEEPERS,
} from '../src/game/missions.ts';
import type { Taken } from '../src/game/missions.ts';
import { REGIONS, CHALLENGES, BADDIES, regionOf } from '../src/game/regions.ts';
import type { RegionId, ChallengeId, BaddieId } from '../src/game/missiondata.ts';
import type { Mission, Trip } from '../src/game/trip.ts';
import type { DragonPlace } from '../src/game/start.ts';
import type { Keeper, Dragon } from '../src/game/sim.ts';
import {
  NEED_ROOM, TURN_STEPS, TURN_HALF, WAIT_MAX, LEAD_PX, arrived, inTheBay, liftRange, needRoom, dragonSpan, dragonInBay, depthOf, eyeSpan, walking,
  landingEdge, ridesLeft, remainingCost, nearestFree, inBay, KEEPER_HALF, bodySpan, landingLine, LIVELY, DRAGON_EYE,
} from '../src/game/travel.ts';
import { gaitOf, gaitFrom, moveAt, wrapT, happyLen } from '../src/game/gait.ts';
import { TURN_HALF as YARD_TURN_HALF } from '../src/care/dragon.ts';
import { dragonBuild } from '../src/art/dragon/build.ts';
import { dragonAnims, baseAnims } from '../src/art/dragon/anims.ts';
import { animTuning } from '../src/art/dragon/tuning.ts';
import { DragonAnimPlayer } from '../src/art/dragon/anim.ts';
import { START_ROOMS, START_DRAGONS, START_KEEPERS } from '../src/game/start.ts';
import { startSpec, buildSim, PRESETS } from '../src/game/presets.ts';
import { serialize, barnKey, SaveVersionError, SAVE_VERSION } from '../src/game/save.ts';
import { readClock, clockLabel, hourSteps, PHASE_ORDER, STAGE_DAYS, HATCH_DAYS, RETIRE_DAYS } from '../src/game/clock.ts';
import type { ClockRead } from '../src/game/clock.ts';
import { skyBands, BACKDROPS } from '../src/game/surfaces.ts';
import { lightsOf, nightness } from '../src/game/sky.ts';
import { jobsAt, CLOCK_X, BADGE_X0 } from '../src/game/hud.ts';
import { measureText } from '../src/lib/engine/text.ts';
import { rngAt, mix32, TAG } from '../src/game/rand.ts';
import {
  route, spanOf, postX, waitX, placeRooms, platesOf, standSpot, fitsSlot, slotBody, feetY, floorTop, nestX, ROOM_INFO, ROOM_KINDS, STRUCTURES,
  makeNets, worldWOf, gardenSpan, plotMid, plotX, GARDEN_X0, GARDEN_PLOT, GARDEN_END, GATE_MID, GATE_X0, GATE_X1,
  AERIE_F, BARN_X, TOWER_R, TOWER_L, TOWER_W, DECK_X0, DECK_X1, BRIDGE_X0, HAND_DECK_X0, LADDER_M_X, LIFT_X0, LIFT_X1, LIFT_CX, LIFT_STOPS, CLIMB_COST, WALL_H, DRAGON_PAD, PITCH,
} from '../src/game/layout.ts';
import type { Spot, RoomKind, RoomPlace } from '../src/game/layout.ts';
import { NEEDS, FPS, OWN_NEED, GARDEN_NEEDS, GARDEN_RATE, hasNeed, drainRate, moodOf } from '../src/game/needs.ts';
import { retireDue, rests, restsClear, restsApart, restOverlap, REST_OVERLAP, residentSpan, isNight } from '../src/game/garden.ts';
import type { Needs, NeedKind } from '../src/game/needs.ts';
import { DRAGON_ELEMENTS } from '../src/art/dragon/palettes.ts';
import type { DragonElement } from '../src/art/dragon/palettes.ts';
import type { Stage } from '../src/art/dragon/stages.ts';
import { STAGES } from '../src/art/dragon/stages.ts';
import { sceneAt, beatLen, baddieBeatLen, walkDist, frameAt, PAIR_BACK, RIDER_AHEAD, ScenePets } from '../src/game/missionview.ts';
import type { SceneFrame } from '../src/game/missionview.ts';
import { demoTrip } from '../src/game/tripdemo.ts';
import { stopStates } from '../src/game/maptable.ts';
import { tripStart } from '../src/game/presets.ts';
import { currentTrip, isTaken, barnRoom } from '../src/game/seams.ts';
import type { Difficulty } from '../src/game/missiondata.ts';

/**
 * The suite in 30 s or less (docs/BASE_DESIGN.md 8.1): the longest independent sections run in five worker threads of
 * this same script (node:worker_threads) while the main thread runs every other section -- `capacity`: section 10's
 * benchmark and crowds (the twelve 30 minutes, eight adults 30, ten 10, the `ages` preset 6); `full`: section 10's
 * over-full `full` preset (21 dragons, 10 minutes); `babies`: section 10's barns of babies with 23 (care while a team
 * is away, 30 minutes of the real day); `service`: section 2 (thirty minutes of play on three seeds, checked every
 * step) with 24 (the watchable scene, read at every step of eight trips); `saves`: section 6 (the saves: every fork
 * stepped 5000 on) with 25 (taking a keeper) -- each worker runs its sections alone, exactly as the main thread would,
 * and sends back its lines, its failures and its rooms' uses (by kind and room by room), which the main thread prints
 * and counts before the suite's end (then the wall times). Nothing is checked less: a section's code is the same
 * wherever it runs, and no section reads another's results.
 */
type Role = 'main' | 'capacity' | 'full' | 'babies' | 'service' | 'saves';
const ROLE: Role = isMainThread ? 'main' : (workerData as { role: Role }).role;
const MAIN = ROLE === 'main';
type WorkerResult = { fails: string[]; used: Record<string, number>; usedRoom: number[]; lines: string[]; ms: number };
/** When this thread started (the report's wall times). */
const T0 = performance.now();
const spawn = (role: Role) => new Promise<WorkerResult>((ok, no) => {
  const w = new Worker(new URL(import.meta.url), { workerData: { role } });
  w.once('message', ok); w.once('error', no);
  w.once('exit', (code) => no(new Error(`sim-check: the ${role} worker left (code ${code}) without a result`)));
});
const WORKERS: readonly (readonly [Role, Promise<WorkerResult>])[] = MAIN ? (['capacity', 'full', 'babies', 'service', 'saves'] as const).map((r) => [r, spawn(r)] as const) : [];
/** A worker's lines, kept for the main thread to print in its turn (a worker's own console is not the suite's report). */
const LOG: string[] = [];
if (!MAIN) console.log = (...a: unknown[]) => { LOG.push(a.map(String).join(' ')); };
const fails: string[] = [];
const fail = (m: string) => { if (fails.length < 40) fails.push(m); };
const newSim = (seed = 1) => new CareSim(START_ROOMS, START_DRAGONS, START_KEEPERS, { seed });
/**
 * Every use of a room or structure (stats.used) over the whole suite, and every room's own (stats.usedRoom, by room id:
 * BASE_DESIGN 3: a need's rooms repeat and each copy must be used): each section notes the worlds it ran (8 checks it). A
 * world loaded from a save is noted with the uses it was loaded with (`since`), so only its own are counted.
 */
const USED: Record<string, number> = {};
const USED_ROOM: number[] = START_ROOMS.map(() => 0);
type Uses = { readonly used: Readonly<Record<string, number>>; readonly usedRoom: readonly number[] };
const uses = (w: CareSim): Uses => ({ used: { ...w.stats.used }, usedRoom: [...w.stats.usedRoom] });
const noteUse = (w: CareSim, since: Uses | null = null) => {
  for (const [k, v] of Object.entries(w.stats.used)) { const n = v - (since?.used[k] ?? 0); if (n) USED[k] = (USED[k] ?? 0) + n; }
  // (every world here is built on the start's rooms: START_ROOMS, so a room's id is the same in all of them)
  if (w.roomPlaces.length === START_ROOMS.length) w.stats.usedRoom.forEach((v, i) => { USED_ROOM[i] += v - (since?.usedRoom[i] ?? 0); });
};
/**
 * The service 30 minutes of play must give (section 2, seeds 1-3, and section 4's Rush after Rush, seed 1), measured
 * and frozen with about 20 % headroom (docs/BASE_DESIGN.md 4.7, 4.9, 8.1). The gates a dragon feels most keep the
 * plan's values on every seed: no need ever empties, done >= 120, a keeper's wait at the stand spot <= 20 s, bay waits
 * <= 60 s, a walking dragon never stands still, nor turns about on one spot, 10 s. The waits: with one car between the
 * floors and one dragon at a time in its shaft (plan 7's mustFix), S3's barn -- one room per need -- kept the car busy
 * about 95 % of the run, and a job's wait was mostly its dragon's wait for it (83.5 s on average over seeds 1-3, gated
 * at 100 s; 360 s at most). The barn repeats the need rooms on the floors, so a dragon's needs are met on its own
 * floor and the car is nearly idle (1 to 4 rides in 30 minutes): seeds 1-3 wait 28.4 / 21.6 / 26.0 s on average (mean
 * 25.3; 29.1 on seed 1 before the S6b review), 112.3 s at most -- gated at 31 s (the mean over the three) and 135 s. A landing wait, a rider held in the car and Rush after
 * Rush keep S3's gates (they measure far under them now: 13.0 s, 8.0 s). One seed's numbers move by a fifth either way
 * with any change to who goes when, so the average is gated over the three. An eye under the body of a dragon standing
 * over it (the sim's model: DRAGON_BODY and DRAGON_EYE, the worst of every element) is left only at a crowded landing
 * or bay edge: 3.7 s in all over the three runs, 1.5 s at most; the gates stay S3's (the old behaviour, 40.6 s over
 * three runs, fails them). Rush after Rush (one every 30 s): no need empty on seed 1, a rushed job done within
 * GATE.rushedS, keepers standing for rushed dragons under GATE.rushWaitShare of their time.
 */
const SERVICE_SEEDS = [1, 2, 3] as const;
const GATE = { done: 120, waitAvgS: 31, waitMaxS: 135, keeperWaitAvgS: 20, liftWaitS: 124, rideHeldS: 25, bayS: 60, keeperBayS: 30, walkStallS: 10,
  coverS: 10, coverTotalS: 30, rushedS: 150, rushWaitShare: 0.15, rushEmptySteps: 600 } as const;
/**
 * Section 10 (BASE_DESIGN 4.7): the benchmark cast `twelve` (tools/capacity.ts: the start's seven adults, three young and
 * two babies), seed 1, 30 minutes, checked every step with section 2's invariants and eye model (capacity.ts runOne).
 * Measured (after the S6b review): no need empty; wait avg 40.2 s, max 154.3 s; 266 done; 44 rides (the car 28 % busy);
 * a landing wait 42.1 s, the bay's edge 39.5 s; an eye covered 46.5 s in all, 14.1 s at most; no stall (one held
 * mid-walk, or turned about on one spot), no shaft overlap. Frozen with about 20 % headroom (none looser than the S6b
 * build's: the landing's 47 s kept); `rides` is a ceiling (the property that the car stays mostly free: the need rooms
 * repeat on the floors). (The design's gates -- 42 / 171 s, 217 done, 46 rides, 42 / 37 s, 44 / 17 s -- were frozen on
 * the capacity study's build, whose `babyHome` rule rested a baby moved on in the Hatchery; S5 forbids that -- a resting
 * baby would hide an egg -- and the build drops it. This build meets the design's waits, jobs, rides and longest eye
 * cover; its landing (42.1 s), bay edge (39.5 s) and eye cover in all (46.5 s) are over the design's by 0.1, 2.5 and
 * 2.5 s.)
 */
const TWELVE = { waitAvgS: 48, waitMaxS: 185, done: 213, rides: 53, landingS: 47, bayS: 47, coverTotalS: 56, coverS: 17 } as const;
/**
 * Section 10's other runs (BASE_DESIGN 4.7): S3's ride-throughput guards are gone (the car no longer carries the barn); each
 * keeps service gates, measured on seed 1 and frozen with about 20 % headroom -- 8 adults for 30 minutes (170 done,
 * 29.1 s average, 112.3 s at most, 3 rides), 10 adults for 10 (78 done, 24.7 s) and the ages preset for 6 (55 done,
 * 49.3 s) -- with no need empty in any, no keeper giving up and the car never standing with work for a minute.
 */
const CROWD_GATES = [{ done: 136, waitAvgS: 35, waitMaxS: 135 }, { done: 62, waitAvgS: 30, waitMaxS: Infinity }, { done: 44, waitAvgS: 59, waitMaxS: Infinity }] as const;
/**
 * Section 10 (BASE_DESIGN 4.7): the `full` preset -- the start's seven and fourteen babies, 21 dragons forced 9 over the
 * cap (life.ts BARN_CAP), and a due egg -- keeps moving for 10 minutes on seed 1: 39 jobs done measured (gated >= 31),
 * no keeper gives up, the car never stands with work for a minute (it stood 17 s at most), and the egg still waits.
 */
const FULL_DONE = 31;
/**
 * Section 10 (the S6b review): twelve babies packed from the Hatchery and the ground floor up, seed 1, 30 minutes --
 * measured 289 jobs done, waits 56.6 s on average and 320.9 s at most (no need at 0, no stall); frozen with about 20 %
 * headroom.
 */
const BABIES_GATE = { done: 231, waitAvgS: 68, waitMaxS: 385 } as const;
/**
 * The rooms and structures whose mechanic a later slice builds (plan 3.9): they must show no use yet, and each entry
 * goes when its mechanic lands. The lift's landed in S3 (dragons ride it), the hatchery's in S5 (eggs are laid and hatch
 * in it), and the tack room's, the bunks', the map room's and the Aerie's in S8 (missions: sent from the Map Room's
 * table, saddles from the Tack Room, the team off and back over the Aerie, the riders' rest in the Bunks). None is left:
 * every named, furnished room has a real purpose, proven used (#11).
 */
const PLANNED: ReadonlySet<string> = new Set([]);
/** Section 10's adults past the start's seven (the eighth, ninth and tenth), also section 15's crowded barn. */
const CROWD: readonly DragonPlace[] = [
  // (BASE_DESIGN 3: the need rooms are one module each, repeated on the floors; these are the free module slots in
  // tools/capacity.ts placeCast's order -- the upper floor's kitchen, the hayloft's, the ground floor's romp room)
  { name: 'EIGHTH', element: 'fire', stage: 'adult', seed: 501, slot: { room: 'kitchen', i: 0, n: 1 } },
  { name: 'NINTH', element: 'water', stage: 'adult', seed: 502, slot: { room: 'kitchen', i: 0, n: 2 } },
  { name: 'TENTH', element: 'rock', stage: 'adult', seed: 503, slot: { room: 'romp', i: 0 } },
];
/**
 * Section 13 (plan S5): a stage-up waits until its dragon is settled, so its delay is the rest of whatever the dragon
 * was doing when it fell due (and, settled, a moment more while a keeper walks out of where its new body will be: it
 * holds for that, life.ts). Alone, a baby grows within GROW_ALONE of falling due (the plan's minute; measured 233 to
 * 2920 steps over seeds 1-8). In the busy barn a dragon is on an errand nearly all the time -- walking to a need's
 * room, waiting for the one car, being met (S3's saturated lift, docs/BASE_DESIGN.md 4.7) -- so the plan's minute is
 * out of reach there: a stage-up waits out one errand, measured 4061 to 8665 steps at most (68 to 144 s) over seeds
 * 1-8 in section 13's busy run (seed 1: 8665), gated at GROW_BUSY (a real game day, 3 minutes: a thirtieth of a
 * stage). At the real day's length, 30 days less a minute in, an adult (EMBER, seed 1: 2939 steps) is an elder within
 * 180 + GROW_REAL steps (the plan's).
 */
const GROW_ALONE = 3600, GROW_BUSY = 10800, GROW_REAL = 3600;
/**
 * Section 15 (plan S6): how long past its due (30 days after it grew into an elder) an elder may wait to retire -- the
 * plan's minute. It retires as soon as it may be sent somewhere new (not being met, not in the lift's hands or its bay:
 * travel.ts redirectable), so it waits at most the end of a keeper's job at it, or a ride: measured 0-928 steps with
 * the retire preset and 130-1998 in section 15's busy barn (adults grown elder mid-errand, up to 5788 steps late) over
 * seeds 1-8 (seed 1: 0 and 1081).
 */
const RETIRE_LATE = 3600;
/**
 * Section 15: how long a retiree may wait at a landing for the car (its one ride, down to the ground floor) -- S3's
 * landing gate (GATE.liftWaitS) -- and take from setting off to arriving at its plot: the longest a barn dragon's job
 * could wait in S3's barn (360 s: the repeated-room barn gates a job's wait tighter, but a retiree's walk out is the barn's
 * whole width and the garden's, at an elder's pace, so it keeps S3's bound). A retiree asks for nothing on its way, so no need of its grows more pressing to raise its
 * call as a barn caller's does; its call goes before the tiers once it has waited travel.ts OVERDUE (3600 steps), after
 * the ride in hand and the eye clashes at a crowded landing. Measured at most at a landing: 66-73 s in 15 (c)'s
 * crowded barn (seeds 1-3), 31-117 s in 15 (b)'s busy barn (seeds 1-8: seven retiring within minutes of each other, for
 * one car), up to 79 s in the new game (seeds 1-4, a 600-step day) -- where it was 162 s in the crowded barn (seed 1:
 * 15 (c) fails it), 114 s in the new game and 744 s in the over-full `full` preset before that rule; the longest walk
 * out in a run 139 to 218 s.
 */
const RETIREE_LIFT_S = GATE.liftWaitS, RETIREE_WALK_S = 360;

// ---------- 1. routes on both nets ----------
if (MAIN) {
  const sim = newSim();
  const at = (s: Spot) => `f${s.f} x ${Math.round(s.x)}`;
  // the keepers: every stand spot (every stage that fits its slot), every supply and riders' post, and the deck
  const targets: { what: string; at: Spot }[] = [];
  for (const r of sim.rooms) {
    for (const sl of r.slots) for (const st of STAGES) {
      if (!fitsSlot(sl, st)) continue;
      const sp = standSpot(sl, st, r);
      if (sp.f !== r.floor || sp.x < r.x0 + 10 || sp.x > r.x1 - 10) fail(`the ${r.kind}'s slot ${sl.i} stand spot for a ${st} is ${at(sp)}, outside the room's ${r.x0 + 10}..${r.x1 - 10}`);
      targets.push({ what: `the ${r.kind}'s slot ${sl.i} (${st})`, at: sp });
    }
    if (ROOM_INFO[r.kind].supplies || ROOM_INFO[r.kind].people) targets.push({ what: `the ${r.kind}'s post`, at: { f: r.floor, x: postX(r) } });
  }
  targets.push({ what: 'the Aerie deck', at: { f: AERIE_F, x: 300 } });
  // (and out through the Garden Gate to a resident on every plot of a seven-plot garden, either way it faces: plan S6)
  const big = makeNets(worldWOf(7)), [g0, g1] = gardenSpan(worldWOf(7), null);
  for (let i = 0; i < 7; i++) for (const dir of [-1, 1]) {
    const x = Math.max(g0, Math.min(g1, plotMid(i) + dir * REACH.elder));
    targets.push({ what: `a resident on plot ${i} facing ${dir}`, at: { f: 0, x } });
  }
  for (const k of sim.keepers) for (const t of targets) {
    const net = t.at.f === 0 && t.at.x > TOWER_R ? big.keeper : sim.nets.keeper;
    if (!route({ f: k.f, x: k.x }, t.at, net)) fail(`no route from ${k.name}'s station to ${t.what} (${at(t.at)})`);
    if (!route(t.at, { f: k.f, x: k.x }, net)) fail(`no route from ${t.what} (${at(t.at)}) back to ${k.name}'s station`);
  }
  // the dragons: per stage, every slot that fits to every other and to two deck spots, both ways, on its own net; every
  // leg in the barn (x 168..1192 on floors 0-2) or on the deck (x 8..648 on floor 5), a floor changed only by the lift,
  // and each ride one leg (boarding stop to alighting stop: never two floor changes in a row)
  let dragonRoutes = 0, liftRides = 0;
  for (const st of STAGES) {
    const net = sim.nets.dragon[st];
    const spots = [...sim.rooms.flatMap((r) => r.slots.filter((sl) => fitsSlot(sl, st)).map((sl) => ({ what: `the ${r.kind}'s slot ${sl.i}`, at: { f: sl.f, x: sl.x } }))),
      { what: 'the deck at 120', at: { f: AERIE_F, x: 120 } }, { what: 'the deck at 280', at: { f: AERIE_F, x: 280 } }];
    for (const a of spots) for (const b of spots) {
      if (a === b) continue;
      const rt = route(a.at, b.at, net);
      if (!rt) { fail(`${st}: no dragon route from ${a.what} (${at(a.at)}) to ${b.what} (${at(b.at)})`); continue; }
      dragonRoutes++;
      let f = a.at.f, rode = false;
      for (const l of rt.legs) {
        if (l.f <= 2 ? l.x < BARN_X || l.x > TOWER_R : l.f !== AERIE_F || l.x < DECK_X0 || l.x > DECK_X1) fail(`${st}: the route from ${a.what} to ${b.what} has a leg at ${at(l)}, off the barn and the deck`);
        const rides = l.f !== f;
        if (rides) { liftRides++; if (l.x !== LIFT_CX) fail(`${st}: the route from ${a.what} to ${b.what} changes floor at x ${l.x}, not the lift's ${LIFT_CX}`); }
        if (rides && rode) fail(`${st}: the route from ${a.what} to ${b.what} rides the lift in two legs in a row (${rt.legs.map(at).join(' / ')}), not one ride`);
        f = l.f; rode = rides;
      }
    }
  }
  // the lift's hayloft-to-Aerie run is one edge and one leg (floors 3 and 4 passed through), costed at its rise
  const up = route({ f: 2, x: 792 }, { f: AERIE_F, x: 280 }, sim.nets.dragon.adult);
  const upCost = (792 - LIFT_CX) + (feetY(2) - feetY(AERIE_F)) * CLIMB_COST + (LIFT_CX - 280);
  if (!up || up.legs.map(at).join(' / ') !== `f2 x ${LIFT_CX} / f5 x ${LIFT_CX} / f5 x 280` || Math.abs(up.cost - upCost) > 1e-9) fail(`the lift from the hayloft to the Aerie: ${up ? `${up.legs.map(at).join(' / ')} costing ${up.cost}` : 'no route'}, not one ride costing ${upCost}`);
  // a ride from the ground floor to the Aerie is one leg too (floors 1, 2, 3 and 4 passed through)
  const trip = route({ f: 0, x: 792 }, { f: AERIE_F, x: 280 }, sim.nets.dragon.adult);
  if (!trip || trip.legs.map(at).join(' / ') !== `f0 x ${LIFT_CX} / f5 x ${LIFT_CX} / f5 x 280`) fail(`the lift from the ground floor to the Aerie: ${trip ? trip.legs.map(at).join(' / ') : 'no route'}, not one ride`);
  // no dragon net reaches a tower but through the Garden Gate: every span of every stage's net lies inside the barn
  // (floors 1-2), the barn and on through the gate to the garden's end (floor 0), or on the deck and its sky bridge off the
  // world's west edge (floor 5: plan S8, the missions' way out), floors 3 and
  // 4 have none, and no route reaches another tower room on the floors where the towers open into the barn -- the
  // gate's arches are the one tower door a dragon fits (every stage walks through it); and no keeper rides the lift
  for (const st of STAGES) {
    const net = sim.nets.dragon[st];
    net.spans.forEach((sp, f) => {
      const [lo, hi] = f === 0 ? [BARN_X, sim.worldW - GARDEN_END] : f <= 2 ? [BARN_X, TOWER_R] : f === AERIE_F ? [BRIDGE_X0, DECK_X1] : [Infinity, -Infinity];
      for (const [a, b] of sp) if (a < lo || b > hi) fail(`${st}: the dragon net's floor ${f} runs ${a}..${b}, outside ${f === 0 ? 'the barn and the garden' : f <= 2 ? 'the barn' : f === AERIE_F ? 'the deck and the sky bridge' : 'any floor a dragon has'}`);
    });
    for (const t of [{ f: 0, x: TOWER_L + TOWER_W / 2 }, { f: 1, x: TOWER_L + TOWER_W / 2 }, { f: 1, x: TOWER_R + TOWER_W / 2 }, { f: 3, x: TOWER_L + TOWER_W / 2 }]) {
      if (spanOf(t.f, t.x, net) >= 0 || route({ f: 0, x: 792 }, t, net)) fail(`${st}: a dragon can reach the tower room at ${at(t)}`);
    }
    if (!route({ f: 1, x: 792 }, { f: 0, x: GATE_MID }, net)) fail(`${st}: a dragon can't walk through the Garden Gate`);
  }
  // an elder retiring: from every slot it may stand in, to every plot of a seven-plot garden (the lift down, then out
  // through the gate), on its own net
  let toGarden = 0;
  for (const r of sim.rooms) for (const sl of r.slots) if (fitsSlot(sl, 'elder')) for (let i = 0; i < 7; i++) {
    const rt = route({ f: sl.f, x: sl.x }, { f: 0, x: plotMid(i) }, big.dragon.elder);
    if (!rt) fail(`no elder's route from the ${r.kind}'s slot ${sl.i} to plot ${i}`); else toGarden++;
  }
  if (sim.nets.keeper.links.some((l) => l.name === 'lift')) fail('the keepers\' net has the lift in it');
  for (const d of sim.dragons) if (spanOf(d.f, d.x, sim.nets.dragon[d.stage]) < 0) fail(`${d.name} stands off its stage's dragon floor (${at(d)})`);
  noteUse(sim);
  console.log(`  1 routes: keepers ${sim.keepers.length} x ${targets.length} places (every stand spot, post and the deck, and a resident on every plot of a seven-plot garden), both ways; dragons ${dragonRoutes} routes on ${STAGES.length} stages' nets, ${liftRides} lift rides among them (one leg each), none through a tower but the Garden Gate's arches; ${toGarden} elders' routes from a slot to a plot; hayloft to Aerie ${up ? up.cost : '-'} px in one ride`);
}

// ---------- 2. thirty minutes of play ----------
if (ROLE === 'service') {
  /** One 30-minute run on the starting base, checked as it goes; what it measured. */
  const play = (seed: number) => {
    const sim = newSim(seed), MIN = 30, steps = MIN * 60 * FPS, at = seed === 1 ? '' : `seed ${seed}, `;
    const still = new Map<Keeper, { key: string; since: number }>(), stood = new Map<Dragon, { key: string; since: number }>();
    const going = new Map<Dragon, { f: number; x: number; since: number; told: boolean }>();
    const f0 = new Map(sim.dragons.map((d) => [d, d.f])), f0Of = (d: Dragon) => f0.get(d)!;
    const metIn = new Map<Dragon, Set<string>>(), x0 = new Map(sim.dragons.map((d) => [d, d.x])), moved = new Set<Dragon>();
    let callMax = 0, bayMax = 0, keeperBayMax = 0, heldMax = 0, shaft = 0;
    const covers = new Map<string, number>(), cover = { longest: 0, total: 0, runs: 0, worst: '' };
    const coverEnd = (k: string, n: number) => { cover.total += n; cover.runs++; if (n > cover.longest) { cover.longest = n; cover.worst = `${k} from step ${sim.tick - n}`; } };
    for (let s = 0; s < steps; s++) {
      sim.step();
      // (every step: the shaft never shows two dragons one over the other -- no two bodies overlap in the bay on a floor,
      // the car's rider's included where the car stands -- and no dragon standing has its eye under the body of one
      // standing drawn over it (ART_BIBLE 1.4; travel.ts depthOf), but for a moment)
      const L0 = sim.lift, inShaft = sim.dragons.filter((d) => (d.move === 'ride' ? !L0.moving : dragonInBay(d)));
      for (let i = 0; i < inShaft.length; i++) for (let k = i + 1; k < inShaft.length; k++) {
        const a = inShaft[i], b = inShaft[k], fa = a.move === 'ride' ? L0.f : a.f, fb = b.move === 'ride' ? L0.f : b.f;
        const [a0, a1] = dragonSpan(a.move === 'ride' ? { ...a, x: LIFT_CX } : a), [b0, b1] = dragonSpan(b.move === 'ride' ? { ...b, x: LIFT_CX } : b);
        if (fa === fb && Math.min(a1, b1) - Math.max(a0, b0) > 0.5) { shaft++; if (shaft < 4) fail(`${at}step ${sim.tick}: ${a.name} (${a.move}) and ${b.name} (${b.move}) overlap in the lift shaft on floor ${fa}`); }
      }
      const standing = sim.dragons.filter((d) => d.move !== 'ride' && !(walking(d) && d.gaitT > 0)), seenCover = new Set<string>();
      const depth = new Map(standing.map((d) => [d, depthOf(sim, d)]));
      for (const a of standing) for (const b of standing) {
        if (a === b || a.f !== b.f) continue;
        const da = depth.get(a)!, db = depth.get(b)!;
        if (!(db > da || (db === da && b.id > a.id))) continue;
        const e = eyeSpan(a.stage, a.facing, a.x), [b0, b1] = dragonSpan(b);
        if (b0 > e[1] || b1 < e[0]) continue;
        const k = `${b.name} (${b.move}) over ${a.name}'s eye (${a.move})`;
        seenCover.add(k); covers.set(k, (covers.get(k) ?? 0) + 1);
      }
      for (const [k, n] of covers) if (!seenCover.has(k)) { coverEnd(k, n); covers.delete(k); }
      // (every step: a need met -- an act starting -- in its own room's slot, and where)
      for (const d of sim.dragons) if (d.act && d.act.t === 0) {
        const room = d.slot ? sim.rooms[d.slot.room] : null;
        if (!room || room.kind !== NEED_ROOM[d.act.need] || Math.abs(d.x - d.slot!.x) >= 0.5 || d.f !== d.slot!.f) fail(`${at}step ${sim.tick}: ${d.name}'s ${d.act.need} was met at f${d.f} x ${d.x.toFixed(1)}, not in its slot of the ${NEED_ROOM[d.act.need]}`);
        else (metIn.get(d) ?? metIn.set(d, new Set()).get(d)!).add(room.kind);
      }
      if (s % 30) continue;
      for (const d of sim.dragons) for (const k of NEEDS) {
        const v = d.needs[k];
        if (!(v >= 0 && v <= 1)) fail(`${at}step ${sim.tick}: ${d.name}'s ${k} is ${v}`);
        if (!hasNeed(d.element, k) && v !== 1) fail(`${at}step ${sim.tick}: ${d.name} has a ${k} need it shouldn't`);
      }
      const seen = new Set<string>();
      for (const j of sim.jobs) {
        const key = `${j.dragon.id}/${j.need}`;
        if (seen.has(key)) fail(`${at}step ${sim.tick}: two ${j.need} jobs for ${j.dragon.name}`);
        seen.add(key);
        if (j.keeper && j.keeper.job !== j) fail(`${at}step ${sim.tick}: job ${j.id}'s keeper ${j.keeper.name} is on another job`);
      }
      for (const d of sim.dragons) if (sim.jobs.filter((j) => j.dragon === d && j.keeper).length > 1) fail(`${at}step ${sim.tick}: two keepers on ${d.name}`);
      for (const k of sim.keepers) {
        if (k.job && !sim.jobs.includes(k.job)) fail(`${at}step ${sim.tick}: ${k.name} is on a job that is gone`);
        if ((k.phase === 'idle') !== (!k.job && !k.legs.length)) fail(`${at}step ${sim.tick}: ${k.name} is ${k.phase} with ${k.job ? 'a job' : 'no job'}`);
        if (!k.climbing && spanOf(k.f, k.x, sim.nets.keeper) < 0) fail(`${at}step ${sim.tick}: ${k.name} stands off floor ${k.f} at x ${k.x.toFixed(1)}`);
        // a keeper who isn't idle, picking up, working or waiting for the dragon must be getting somewhere (held at the
        // lift bay's edge only a while)
        const key = `${k.phase}@${k.x.toFixed(1)},${k.y.toFixed(1)}`, was = still.get(k);
        if (!was || was.key !== key) still.set(k, { key, since: sim.tick });
        else if (!['idle', 'pickup', 'work', 'wait'].includes(k.phase) && k.bayWait === 0 && sim.tick - was.since > 10 * FPS) fail(`${at}step ${sim.tick}: ${k.name} has stood still ${k.phase} for 10 s`);
        keeperBayMax = Math.max(keeperBayMax, k.bayWait);
        if (k.phase === 'work' && k.job) { const sp = sim.standAt(k.job.dragon); if (k.f !== sp.f || Math.abs(k.x - sp.x) > 1) fail(`${at}step ${sim.tick}: ${k.name} works with ${k.job.dragon.name} at f${k.f} x ${k.x.toFixed(1)}, not its stand spot f${sp.f} x ${sp.x}`); }
      }
      // the dragons: on their nets (a rider at the car's middle, the car's one rider), met only in their slots, never
      // standing still mid-walk; the car in its shaft, and nobody in the bay on a floor it is moving past (the bay rule)
      const L = sim.lift, riders = sim.dragons.filter((d) => d.move === 'ride');
      if (riders.length > 1) fail(`${at}step ${sim.tick}: ${riders.length} dragons ride the one car`);
      if (!(L.y >= feetY(AERIE_F) && L.y <= feetY(0))) fail(`${at}step ${sim.tick}: the car is at y ${L.y}, out of its shaft`);
      if (L.moving) { const r = liftRange(sim)!, who = inTheBay(sim, r[0], r[1]); if (who) fail(`${at}step ${sim.tick}: ${who} is in the lift bay while the car moves floors ${r[0]}-${r[1]}`); }
      const mods = new Map<string, { grown: number; babies: number }>(), slots = new Set<unknown>();
      for (const d of sim.dragons) {
        if (d.move === 'ride') { if (d.x !== LIFT_CX || L.rider !== d.id) fail(`${at}step ${sim.tick}: ${d.name} rides at x ${d.x}, ${L.rider === d.id ? '' : 'not the car\'s rider, '}not the car's middle`); }
        else if (spanOf(d.f, d.x, sim.nets.dragon[d.stage]) < 0) fail(`${at}step ${sim.tick}: ${d.name} stands off its floor (f${d.f} x ${d.x.toFixed(1)})`);
        if (d.slot) {
          if (slots.has(d.slot)) fail(`${at}step ${sim.tick}: two dragons hold the ${sim.rooms[d.slot.room].kind}'s slot ${d.slot.i}`);
          slots.add(d.slot);
          if (!fitsSlot(d.slot, d.stage)) fail(`${at}step ${sim.tick}: ${d.name} holds a slot it doesn't fit`);
          const key = `${d.slot.room}/${d.slot.mod}`, m = mods.get(key) ?? { grown: 0, babies: 0 };
          if (d.slot.baby) m.babies++; else m.grown++;
          mods.set(key, m);
          if (m.grown > 1 || m.babies > 2 || (m.grown && m.babies)) fail(`${at}step ${sim.tick}: module ${d.slot.mod} of the ${sim.rooms[d.slot.room].kind} holds ${m.grown} grown and ${m.babies} babies`);
        }
        if (d.act && (!d.slot || Math.abs(d.x - d.slot.x) >= 0.5 || sim.rooms[d.slot.room].kind !== NEED_ROOM[d.act.need])) fail(`${at}step ${sim.tick}: ${d.name} is met for ${d.act.need} away from its slot of the ${NEED_ROOM[d.act.need]}`);
        // a walking dragon gets somewhere (spike's creep and slinkwing's pause stand still a moment): mid-walk --
        // walking, turning, boarding or walking off, a route left -- it gets more than 4 px on in GATE.walkStallS, not
        // stood still nor turned about on one spot (capacity.ts runOne's stall rule); a rider is held in the car only
        // while someone clears the bay; a wait at a landing or the bay's edge lasts a while at most
        const y = d.move === 'ride' ? L.y : feetY(d.f), key = `${d.move}@${d.f},${d.x},${y}`, was = stood.get(d);
        if (!was || was.key !== key) stood.set(d, { key, since: sim.tick });
        else if (d.move === 'ride') heldMax = Math.max(heldMax, sim.tick - was.since);
        const on = d.legs.length > 0 && ['walk', 'turn', 'board', 'alight'].includes(d.move), g = going.get(d);
        if (!on) going.delete(d);
        else if (!g || g.f !== d.f || Math.abs(d.x - g.x) > 4) going.set(d, { f: d.f, x: d.x, since: sim.tick, told: false });
        else if (!g.told && sim.tick - g.since > GATE.walkStallS * FPS) { g.told = true; fail(`${at}step ${sim.tick}: ${d.name} has got no more than 4 px on from x ${g.x.toFixed(1)} mid-walk (${d.move}) for ${GATE.walkStallS} s`); }
        if (d.move === 'call') callMax = Math.max(callMax, d.waited);
        if (d.move === 'bay') bayMax = Math.max(bayMax, d.waited);
        if (d.x !== x0.get(d) || d.f !== f0Of(d)) moved.add(d);
      }
    }
    for (const [k, n] of covers) coverEnd(k, n);
    const st = sim.stats, avg = st.waitSum / Math.max(1, st.started) / FPS, max = st.waitMax / FPS, kAvg = st.keeperWaitSum / Math.max(1, st.keeperWaits) / FPS;
    const liftWait = Math.max(st.liftWaitMax, callMax) / FPS;
    // (each run: the gates a dragon feels most, as the plan set them -- no need empties, done >= 120, a keeper's wait at
    // the stand spot short, waits at the bay's edge short -- and #7: every dragon met in four rooms or more, and moved)
    const busy = sim.keepers.map((k) => k.name).join(' ');
    if (st.done < GATE.done) fail(`${at}only ${st.done} jobs done in ${MIN} minutes (keepers: ${busy})`);
    if (st.closed) fail(`${at}${st.closed} jobs closed without a keeper (#7: only a keeper meets a need)`);
    if (st.emptySteps > 0) fail(`${at}a need sat at 0 for ${st.emptySteps} dragon-steps: too few keepers for this barn`);
    if (kAvg > GATE.keeperWaitAvgS) fail(`${at}keepers waited ${kAvg.toFixed(1)} s on average at the stand spot for their dragons (want <= ${GATE.keeperWaitAvgS})`);
    if (st.waitTimeouts) fail(`${at}${st.waitTimeouts} keepers gave up waiting for a dragon (WAIT_MAX ${WAIT_MAX} steps)`);
    if (bayMax / FPS > GATE.bayS) fail(`${at}a dragon was held at the lift bay's edge ${(bayMax / FPS).toFixed(1)} s (want <= ${GATE.bayS})`);
    if (keeperBayMax / FPS > GATE.keeperBayS) fail(`${at}a keeper was held at the lift bay's edge ${(keeperBayMax / FPS).toFixed(1)} s (want <= ${GATE.keeperBayS})`);
    if (!st.liftRides || st.used.lift !== st.liftRides) fail(`${at}the lift carried ${st.liftRides} riders, counted ${st.used.lift ?? 0} uses`);
    for (const d of sim.dragons) {
      if ((metIn.get(d)?.size ?? 0) < 4) fail(`${at}${d.name}'s needs were met in ${[...(metIn.get(d) ?? [])].join(', ') || 'no room'}: fewer than 4 rooms (#7: it moves around the rooms by its needs)`);
      if (!moved.has(d)) fail(`${at}${d.name} never left its first spot (#7: dragons are no longer pinned in their rooms)`);
    }
    if (sim.jobs.length > sim.dragons.length * 2) fail(`${at}the queue ended ${sim.jobs.length} long`);
    noteUse(sim);
    return { sim, avg, max, kAvg, liftWait, held: heldMax / FPS, bay: bayMax / FPS, keeperBay: keeperBayMax / FPS, shaft, cover, metIn };
  };
  const runs = SERVICE_SEEDS.map(play), r1 = runs[0], st = r1.sim.stats;
  console.log(`  2 30 min: ${st.opened} jobs opened, ${st.done} done, ${st.closed} closed without a keeper; wait avg ${r1.avg.toFixed(1)} s, max ${r1.max.toFixed(1)} s; queue at most ${st.queueMax}; ${st.emptySteps} steps with a need at 0; keepers waited at the stand spot ${r1.kAvg.toFixed(1)} s on average; dragons walked ${Math.round(st.dragonWalked)} px, rode the lift ${st.liftRides} times (a landing wait at most ${r1.liftWait.toFixed(1)} s, held in the car at most ${r1.held.toFixed(1)} s), were held at the bay's edge at most ${r1.bay.toFixed(1)} s (keepers ${r1.keeperBay.toFixed(1)} s); ${r1.shaft} steps with two in the shaft; an eye under a standing body ${(r1.cover.total / FPS).toFixed(1)} s in all (${r1.cover.runs} times, at most ${(r1.cover.longest / FPS).toFixed(1)} s); ${st.evictions} moved on, ${st.waitTimeouts} keepers gave up; met in ${r1.sim.dragons.map((d) => `${d.name} ${r1.metIn.get(d)?.size ?? 0}`).join(', ')} rooms; rooms used ${Object.entries(st.used).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  // (the service, over the three seeds: one run is one draw of a busy barn -- a small change moves a seed's own numbers
  // by a fifth either way -- so the waits are gated on the three together)
  const mean = runs.reduce((a, r) => a + r.avg, 0) / runs.length, most = (f: (r: typeof r1) => number) => Math.max(...runs.map(f));
  const coverTotal = runs.reduce((a, r) => a + r.cover.total, 0) / FPS, coverLong = most((r) => r.cover.longest) / FPS;
  console.log(`  2 service, seeds ${SERVICE_SEEDS.join(', ')}: wait avg ${runs.map((r) => r.avg.toFixed(1)).join(' / ')} s (mean ${mean.toFixed(1)}), max ${most((r) => r.max).toFixed(1)} s; done ${runs.map((r) => r.sim.stats.done).join(' / ')}; a need at 0 ${runs.map((r) => r.sim.stats.emptySteps).join(' / ')} steps; a landing wait at most ${most((r) => r.liftWait).toFixed(1)} s, the bay's edge ${most((r) => r.bay).toFixed(1)} s, held in the car ${most((r) => r.held).toFixed(1)} s; an eye under a standing body ${coverTotal.toFixed(1)} s in all, at most ${coverLong.toFixed(1)} s; ${runs.map((r) => r.sim.stats.liftRides).join(' / ')} rides`);
  if (mean > GATE.waitAvgS) fail(`jobs waited ${mean.toFixed(1)} s on average over seeds ${SERVICE_SEEDS.join(', ')} for a keeper to start (want <= ${GATE.waitAvgS})`);
  if (most((r) => r.max) > GATE.waitMaxS) fail(`a job waited ${most((r) => r.max).toFixed(1)} s for a keeper to start (want <= ${GATE.waitMaxS})`);
  if (most((r) => r.liftWait) > GATE.liftWaitS) fail(`a dragon waited ${most((r) => r.liftWait).toFixed(1)} s at a landing for the car (want <= ${GATE.liftWaitS})`);
  if (most((r) => r.held) > GATE.rideHeldS) fail(`a rider was held in the car ${most((r) => r.held).toFixed(1)} s (want <= ${GATE.rideHeldS})`);
  const worst = runs.reduce((a, r) => (r.cover.longest > a.cover.longest ? r : a), r1).cover.worst;
  if (coverLong > GATE.coverS || coverTotal > GATE.coverTotalS) fail(`an eye was under a standing body ${coverTotal.toFixed(1)} s in all over seeds ${SERVICE_SEEDS.join(', ')}, at most ${coverLong.toFixed(1)} s (${worst}; want <= ${GATE.coverS} s, ${GATE.coverTotalS} s in all)`);
}

// ---------- 3. the same seed, the same world ----------
if (MAIN) {
  const a = newSim(7), b = newSim(7);
  for (let s = 1; s <= 20000; s++) {
    a.step(); b.step();
    if (s % 1000 === 0 && a.digest() !== b.digest()) { fail(`two runs from seed 7 differ by step ${s}`); break; }
  }
  if (newSim(7).digest() === newSim(8).digest()) fail('seeds 7 and 8 start the same world');
  noteUse(a);
  console.log('  3 determinism: two runs from one seed agree over 20000 steps; seeds 7 and 8 differ at step 0');
}

// ---------- 4. Rush with every keeper busy ----------
if (MAIN) {
  const sim = newSim(3);
  // every dragon's own need low -- each stands in its own need's room (the start slots), so every job is one it has
  // arrived for -- more jobs than keepers; and hungry too (fire's food is its own), a job in another room
  for (const d of sim.dragons) { d.needs[OWN_NEED[d.element]] = 0.3; if (OWN_NEED[d.element] !== 'food') d.needs.food = 0.4; }
  sim.step();
  if (sim.keepers.some((k) => !k.job)) fail('rush: a keeper was free with the queue full');
  const own = sim.jobs.filter((j) => j.need === OWN_NEED[j.dragon.element]);
  if (own.length !== sim.dragons.length || own.some((j) => !arrived(sim, j.dragon) || j.dragon.goalJob !== j.id)) fail('rush: not every dragon stands in its own need\'s room waiting for its job');
  // the last waiting job (no keeper on its dragon) whose room has a slot the dragon may take
  const room = (need: typeof NEEDS[number]) => needRoom(sim, need)!;
  const canTake = (j: typeof sim.jobs[number]) => { const r = room(j.need), d = j.dragon; return (d.slot && d.slot.room === r.id) || r.slots.some((sl) => fitsSlot(sl, d.stage) && !sim.dragons.some((o) => o !== d && o.slot && o.slot.room === r.id && o.slot.mod === sl.mod)); };
  const waiting = sim.queue().filter((j) => !j.keeper && !sim.jobs.some((o) => o.dragon === j.dragon && o.keeper) && canTake(j));
  const j = waiting[waiting.length - 1];
  if (!j) fail('rush: nothing waiting to rush');
  else {
    const before = sim.stats.preempted, d = j.dragon, dragon = d.name, need = j.need, from = sim.rooms[d.slot!.room].kind;
    sim.rush(j);
    if (sim.queue()[0] !== j) fail(`rush: ${dragon}'s ${need} is not first in the queue`);
    if (d.goalJob !== j.id || !d.slot || sim.rooms[d.slot.room].kind !== NEED_ROOM[need]) fail(`rush: ${dragon} did not set off for the ${NEED_ROOM[need]} at once`);
    // (its keeper runs to it as soon as it is near -- past its lift ride, or LEAD_PX of route away -- rather than stand
    // at the stand spot while it queues for the car; one comes off the lowest job for it then, every keeper being busy)
    const near = () => arrived(sim, d) || remainingCost(sim, d) <= LEAD_PX || !ridesLeft(sim, d);
    if (j.keeper && !near()) fail(`rush: a keeper set off for ${dragon} with its ride still to take`);
    let s = 0, sent = j.keeper ? 0 : -1, sentNear = true, who = j.keeper, pre = sim.stats.preempted, freeThen = false;
    while (sim.jobs.includes(j) && s++ < 90 * FPS) {
      const free = sim.keepers.some((k) => !k.job);
      sim.step();
      if (sent < 0 && j.keeper) { sent = s; sentNear = near(); who = j.keeper; pre = sim.stats.preempted; freeThen = free; }
    }
    if (sent < 0) fail('rush: no keeper took the rushed job');
    else if (!sentNear) fail(`rush: a keeper set off for ${dragon} ${(sent / FPS).toFixed(1)} s in, while it was still far off`);
    if (pre !== before + (freeThen ? 0 : 1)) fail(`rush: ${pre - before} keepers came off other jobs for it, with ${freeThen ? 'one free' : 'none free'} then`);
    if (sim.jobs.includes(j)) fail(`rush: ${dragon}'s ${need} was not done within 90 s`);
    else console.log(`  4 rush: ${dragon}'s ${need} (last of ${waiting.length} waiting) done by ${who?.name} in ${(s / FPS).toFixed(1)} s, ${dragon} walking from the ${from} to the ${NEED_ROOM[need]}${sim.stats.liftRides ? ' by the lift' : ''}; ${who?.name} ${freeThen ? 'was free' : 'came off another job'} when it came near, ${(sent / FPS).toFixed(1)} s in`);
  }
  noteUse(sim);
}
if (MAIN) {
  // a Rush of a job whose dragon is already in its room, waiting for it, with every keeper busy: the job goes to the
  // top, and a keeper comes off the lowest job for it at once and runs
  const sim = newSim(3);
  for (const d of sim.dragons) { d.needs[OWN_NEED[d.element]] = 0.3; if (OWN_NEED[d.element] !== 'food') d.needs.food = 0.4; }
  sim.step();
  const ready = sim.queue().filter((q) => !q.keeper && q.dragon.goalJob === q.id && arrived(sim, q.dragon) && !sim.jobs.some((o) => o.dragon === q.dragon && o.keeper));
  const j = ready[ready.length - 1];
  if (!j || sim.keepers.some((k) => !k.job)) fail('rush: no dragon waiting in its room with every keeper busy');
  else {
    const before = sim.stats.preempted;
    sim.rush(j);
    if (sim.queue()[0] !== j || !j.keeper || !j.keeper.rushing) fail(`rush: ${j.dragon.name}'s ${j.need}, in its room, got no running keeper at once`);
    if (sim.stats.preempted !== before + 1) fail(`rush: ${sim.stats.preempted - before} keepers came off other jobs for ${j.dragon.name}, not 1`);
    const who = j.keeper;
    let s = 0;
    while (sim.jobs.includes(j) && s++ < 90 * FPS) sim.step();
    if (sim.jobs.includes(j)) fail(`rush: ${j.dragon.name}'s ${j.need} was not done within 90 s`);
    else console.log(`  4 rush: ${j.dragon.name}'s ${j.need} (in the ${NEED_ROOM[j.need]}, last of ${ready.length} waiting there, every keeper busy) done by ${who?.name}, taken off another job at once, in ${(s / FPS).toFixed(1)} s`);
  }
  noteUse(sim);
}
if (MAIN) {
  // a Rush into a full room: every kitchen held by a dragon waiting for its feed (their keepers on the way) -- one a
  // floor, one module each (BASE_DESIGN 3): EMBER's, RIPPLE's on ZAP's floor and WICK's -- and a third rushed there bumps the
  // holder of its own floor's, whose keeper gives the job back
  const sim = newSim(5);
  for (const d of sim.dragons) for (const k of NEEDS) if (hasNeed(d.element, k)) d.needs[k] = 0.95;
  const [ember, ripple, zap, wick] = ['EMBER', 'RIPPLE', 'ZAP', 'WICK'].map((n) => sim.dragons.find((d) => d.name === n)!);
  const kitchens = sim.rooms.filter((r) => r.kind === 'kitchen'), kitchen = kitchens.find((r) => r.floor === zap.f)!;
  for (const [d, r] of [[ripple, kitchen], [wick, kitchens.find((q) => q !== kitchen && !sim.dragons.some((o) => o.slot?.room === q.id))!]] as const) {
    d.slot = r.slots[0]; d.x = d.slot.x; d.f = d.slot.f; d.facing = d.slot.facing;
  }
  ember.needs.food = 0.3; ripple.needs.food = 0.35; wick.needs.food = 0.36; zap.needs.food = 0.4;
  sim.step();
  if (kitchens.some((r) => !sim.dragons.some((d) => d.slot?.room === r.id && (d === ember || d === ripple || d === wick))) || !sim.jobs.every((q) => q.need === 'food')) fail('bump: the kitchens are not held by EMBER, RIPPLE and WICK waiting for their feeds');
  const zj = sim.jobs.find((q) => q.dragon === zap && q.need === 'food');
  const bumps = sim.stats.slotBumps;
  if (!zj) fail('bump: ZAP has no food job');
  else {
    sim.rush(zj);
    if (sim.stats.slotBumps !== bumps + 1) fail(`bump: a Rush into the full kitchen bumped ${sim.stats.slotBumps - bumps} holders, not 1`);
    const bumped = [ember, ripple, wick].find((d) => d.slot && sim.rooms[d.slot.room].kind !== 'kitchen');
    if (zap.slot?.room !== kitchen.id || zap.goalJob !== zj.id) fail('bump: ZAP did not take a kitchen slot for its rushed feed');
    if (!bumped) fail('bump: nobody left the kitchen');
    else {
      if (sim.jobs.some((q) => q.dragon === bumped && q.keeper && q.keeper.phase !== 'work' && bumped.goalJob !== q.id)) fail(`bump: ${bumped.name}'s keeper kept a job its dragon stopped going for`);
      let s = 0;
      while (sim.jobs.includes(zj) && s++ < 120 * FPS) sim.step();
      if (sim.jobs.includes(zj)) fail('bump: ZAP\'s rushed feed was not done within 120 s');
      else console.log(`  4 bump: ZAP rushed into the full kitchens took ${bumped.name}'s slot (its own floor's), fed in ${(s / FPS).toFixed(1)} s`);
    }
  }
  noteUse(sim);
}
if (MAIN) {
  // Rush after Rush (a player tapping chips): one every 30 s for 30 minutes on seed 1 -- no need empties, no keeper
  // gives up, every rushed job is done within GATE.rushedS, and keepers spend little of their time standing at a stand
  // spot for a rushed dragon (a keeper sets off when the dragon is near, not while it queues for the car)
  const sim = newSim(1), steps = 30 * 60 * FPS, rushedAt = new Map<number, number>();
  let longest = 0, waitRushed = 0, keeperSteps = 0, n = 0;
  for (let s = 1; s <= steps; s++) {
    if (s % (30 * FPS) === 0) {
      const open = sim.jobs.filter((q) => !q.rushed);
      if (open.length) { const q = open[(s * 7919) % open.length]; sim.rush(q); rushedAt.set(q.id, sim.tick); n++; }
    }
    sim.step();
    for (const [id, t0] of rushedAt) if (!sim.jobs.some((q) => q.id === id)) { longest = Math.max(longest, sim.tick - t0); rushedAt.delete(id); }
    for (const k of sim.keepers) { keeperSteps++; if (k.phase === 'wait' && k.job?.rushed) waitRushed++; }
  }
  for (const [, t0] of rushedAt) longest = Math.max(longest, sim.tick - t0);
  const st = sim.stats, share = waitRushed / keeperSteps;
  if (st.emptySteps > GATE.rushEmptySteps) fail(`rushes: a need sat at 0 for ${st.emptySteps} dragon-steps with a Rush every 30 s (want <= ${GATE.rushEmptySteps})`);
  if (st.waitTimeouts) fail(`rushes: ${st.waitTimeouts} keepers gave up waiting`);
  if (longest / FPS > GATE.rushedS) fail(`rushes: a rushed job took ${(longest / FPS).toFixed(1)} s (want <= ${GATE.rushedS})`);
  if (share > GATE.rushWaitShare) fail(`rushes: keepers stood waiting for rushed dragons ${(share * 100).toFixed(1)} % of their time (want <= ${GATE.rushWaitShare * 100} %)`);
  console.log(`  4 rushes: ${n} Rushes in 30 min, ${st.done} jobs done, ${st.emptySteps} steps with a need at 0; a rushed job done in ${(longest / FPS).toFixed(1)} s at most; keepers stood waiting for rushed dragons ${(share * 100).toFixed(1)} % of their time`);
  noteUse(sim);
}

// ---------- 5. the start cast: a young adult of each kind (#9) ----------
if (MAIN) {
  const sim = newSim(1);
  const ds = sim.dragons, els = new Set(ds.map((d) => d.element)), ids = ds.map((d) => d.id);
  if (ds.length !== 7) fail(`start: ${ds.length} dragons, not 7`);
  if (els.size !== 7 || DRAGON_ELEMENTS.some((el) => !els.has(el))) fail(`start: the elements are ${[...els].join(' ')}, not one of each`);
  for (const d of ds) {
    if (d.stage !== 'adult') fail(`start: ${d.name} is ${d.stage}, not adult`);
    if (sim.clock - d.stageSince !== 0) fail(`start: ${d.name} is ${sim.clock - d.stageSince} steps into adulthood, not 0`);
  }
  if (new Set(ids).size !== ids.length || ids.some((id, i) => id !== i)) fail(`start: the ids are ${ids.join(',')}, not 0-6`);
  if (sim.nextDragonId !== 7) fail(`start: the next dragon id is ${sim.nextDragonId}, not 7`);
  if (sim.dayLen !== DAY_STEPS || sim.clock !== START_HOUR * DAY_STEPS / 24) fail(`start: the clock starts at ${sim.clock} of a ${sim.dayLen}-step day, not 07:00`);
  // a start some days into its stage, on a short test day
  const later = new CareSim(START_ROOMS, [{ ...START_DRAGONS[0], days: 2.5 }], START_KEEPERS, { dayLen: 600 });
  if (later.clock0 !== 175 || later.clock - later.dragons[0].stageSince !== 1500) fail(`start: 2.5 days into a stage on a 600-step day is ${later.clock - later.dragons[0].stageSince} steps, not 1500`);
  // the presets: every stage among the ages cast; no name, or an unknown one, is the new game
  const ages = new CareSim(startSpec('ages').rooms, startSpec('ages').dragons, startSpec('ages').keepers);
  const stages = new Set(ages.dragons.map((d) => d.stage));
  if (STAGES.some((st) => !stages.has(st))) fail(`preset ages: stages ${[...stages].join(' ')}, not all four`);
  if (startSpec(null).dragons !== START_DRAGONS || startSpec('nope').dragons !== START_DRAGONS) fail('startSpec: no preset should be the new game');
  // growup: EMBER, settled, grows up (an elder) at step GROWUP_IN; eggs: three at their progress; hatch: its egg hatches
  // at step HATCH_IN; full: seventeen dragons, every baby sub-slot taken, and a due egg
  const gu = buildSim(startSpec('growup'), 1), guE = gu.dragons.find((d) => d.name === 'EMBER')!;
  let guAt = -1;
  for (let s = 1; s <= GROWUP_IN + 10 && guAt < 0; s++) { gu.step(); if (gu.events.some((e) => e.kind === 'grow' && e.dragon === guE.id)) guAt = s; }
  if (guAt !== GROWUP_IN || guE.stage !== 'elder') fail(`preset growup: EMBER grew ${guE.stage} at step ${guAt}, not an elder at step ${GROWUP_IN}`);
  const eg = buildSim(startSpec('eggs'), 1), egP = eg.eggs.map((e) => (eg.clock - e.laid) / (HATCH_DAYS * eg.dayLen));
  if (eg.eggs.length !== EGGS_PRESET.length || eg.eggs.some((e, i) => e.element !== EGGS_PRESET[i].element || e.nest !== i || Math.abs(egP[i] - EGGS_PRESET[i].progress) > 1e-4)) fail(`preset eggs: ${eg.eggs.map((e, i) => `${e.element} in nest ${e.nest} at ${egP[i].toFixed(4)}`).join(', ')}`);
  const ht = buildSim(startSpec('hatch'), 1);
  let htAt = -1;
  for (let s = 1; s <= HATCH_IN + 10 && htAt < 0; s++) { ht.step(); if (ht.events.some((e) => e.kind === 'hatch')) htAt = s; }
  if (htAt !== HATCH_IN || ht.dragons.length !== 8 || ht.dragons[7].stage !== 'baby') fail(`preset hatch: the egg hatched at step ${htAt}, not ${HATCH_IN}`);
  const fl = buildSim(startSpec('full'), 1);
  if (fl.dragons.length !== 21 || fl.eggs.length !== 1 || fl.clock + 1 - fl.eggs[0].laid !== HATCH_DAYS * fl.dayLen) fail(`preset full: ${fl.dragons.length} dragons and ${fl.eggs.length} eggs, not 21 and one falling due on the first step`);
  noteUse(gu); noteUse(eg); noteUse(ht); noteUse(fl);
  console.log(`  5 start: ${ds.map((d) => `${d.id} ${d.name} (${d.element})`).join(', ')}; all adult, 0 days in, at clock ${sim.clock}; presets ${Object.keys(PRESETS).join(' ')} (ages: ${ages.dragons.length} dragons, ${stages.size} stages; growup: EMBER an elder at step ${guAt}; eggs: ${eg.eggs.map((e, i) => `${e.element} ${egP[i].toFixed(2)}`).join(', ')}; hatch: ${ht.dragons[7]?.name} at step ${htAt}; full: ${fl.dragons.length} dragons, 9 over the cap, and an egg falling due on the first step)`);
}

// ---------- 6. saves: exact, by id, through JSON ----------
let firstRide = '';
if (ROLE === 'saves') {
  const through = <T>(v: T): T => JSON.parse(JSON.stringify(v));
  const a = newSim(1);
  for (let s = 0; s < 5000; s++) a.step();
  const blob = serialize(a);
  if (!isDeepStrictEqual(blob, through(blob))) fail('save: the save changes through JSON');
  if (blob.v !== SAVE_VERSION || blob.seed !== 1) fail(`save: version ${blob.v}, seed ${blob.seed}`);
  // every field of every dragon, keeper and job is in the save
  const missing = (live: object, saved: object, what: string) => { for (const k of Object.keys(live)) if (!(k in saved)) fail(`save: ${what} has no ${k}`); };
  a.dragons.forEach((d, i) => missing(d, blob.dragons[i], `dragon ${d.name}`));
  a.keepers.forEach((k, i) => missing(k, blob.keepers[i], `keeper ${k.name}`));
  a.jobs.forEach((j, i) => missing(j, blob.jobs[i], `job ${j.id}`));
  missing(a.stats, blob.stats, 'stats');
  // and every field of the world itself: a field a later slice adds to CareSim (a lift, a garden, a board) fails here
  // until it is saved, or listed below with the reason it needn't be (the digest is the save, so it can't see one left out)
  const UNSAVED: Readonly<Record<string, string>> = { rooms: 'placed again from roomPlaces', roomPlaces: 'saved as rooms', events: 'one step\'s output, cleared by the next', nets: 'built again from the garden\'s plots (layout.ts makeNets)',
    commands: 'the player\'s input for the next step, not the world (control.ts; a save is the world as released)' };
  for (const k of Object.keys(a)) if (!(k in blob) && !(k in UNSAVED)) fail(`save: the world's ${k} is not in its save (save it, or say in sim-check why not)`);
  const b = CareSim.fromSave(through(serialize(a)));
  if (b.digest() !== a.digest()) fail('save: a loaded world differs from its save at once');
  // a slot comes back as its room's own slot (by room id and index), and the rooms' uses as a copy of their own
  for (const d of b.dragons) if (d.slot && d.slot !== b.rooms[d.slot.room]?.slots[d.slot.i]) fail(`save: ${d.name}'s slot is not its room's own after loading`);
  if (b.lift === a.lift || !isDeepStrictEqual(b.lift, a.lift) || (a.lift.calls.length && b.lift.calls === a.lift.calls)) fail('save: the lift was not saved and loaded as its own copy');
  if (!Object.keys(a.stats.used).length || !isDeepStrictEqual(b.stats.used, a.stats.used) || b.stats.used === blob.stats.used) fail('save: the rooms\' uses (stats.used) were not saved and loaded as their own copy');
  if (a.stats.usedRoom.length !== a.rooms.length || !isDeepStrictEqual(b.stats.usedRoom, a.stats.usedRoom) || b.stats.usedRoom === blob.stats.usedRoom || b.stats.usedRoom === a.stats.usedRoom) fail('save: each room\'s own uses (stats.usedRoom) were not saved and loaded as their own copy');
  // (a save whose rooms' uses or walk speed this build can't keep throws: the view starts a new barn on it)
  for (const [what, f] of [['a room\'s uses missing', (x: any) => { x.stats.usedRoom = x.stats.usedRoom.slice(1); }], ['a walk at speed 3', (x: any) => { x.dragons[0].gaitS = 3; }]] as const) {
    const x = through(blob); f(x);
    let threw = false;
    try { CareSim.fromSave(x); } catch { threw = true; }
    if (!threw) fail(`save: one with ${what} loaded`);
  }
  if (b.seed !== a.seed || b.clock !== a.clock) fail('save: the seed or the clock was not kept');
  for (let s = 0; s < 5000; s++) { a.step(); b.step(); }
  if (a.digest() !== b.digest()) fail('save: a world saved at step 5000 and loaded has drifted from its original by step 10000');
  // the first ride of all: saved while its rider waits at the landing for the car (the first step a dragon calls it:
  // the repeated-room barn meets the start's needs on each dragon's own floor, so after ECHO's ride down from the hayloft the
  // car is nearly idle, and a save taken later seldom meets a caller), and saved mid-ride (the first step a rider is in
  // the moving car) -- each stepped 5000 on beside the run it came from
  let firstCall = '';
  for (const what of ['call', 'ride'] as const) {
    const run = newSim(1), at0 = () => (what === 'call' ? run.dragons.some((d) => d.move === 'call') : run.lift.moving && run.dragons.some((d) => d.id === run.lift.rider && d.move === 'ride'));
    while (!at0() && run.tick < 20000) run.step();
    const at = run.tick, who = what === 'call' ? run.dragons.find((d) => d.move === 'call') : run.dragons.find((d) => d.id === run.lift.rider);
    const said = who ? (what === 'call' ? `${who.name} calling the car at floor ${who.f}, step ${at}` : `${who.name} riding floor ${who.f} to ${run.lift.target}, the car at y ${run.lift.y}, step ${at}`) : 'none';
    if (what === 'call') firstCall = said; else firstRide = said;
    const copy = CareSim.fromSave(through(serialize(run))), since = uses(copy);
    for (let s = 0; s < 5000; s++) { run.step(); copy.step(); }
    if (!who || copy.digest() !== run.digest()) fail(`save: a world saved at its first ${what} (${said}) and loaded has drifted by step ${at + 5000}`);
    noteUse(run); noteUse(copy, since);
  }
  // more saves, taken from one run whenever something is under way that no save so far has caught (a keeper fetching,
  // picking up, on the way, waiting at the stand spot, at work, going home, halfway up a ladder or held at the bay's
  // edge; a dragon mid-act or asleep, walking, turning, at a landing, boarding, riding, walking off the car or held at
  // the bay's edge; a rushed job), each stepped 5000 on in lockstep with the run it came from (the Rush reaching every
  // world alive then) and compared
  const ref = newSim(1), forks: { sim: CareSim; at: number; used: Uses }[] = [], live: typeof forks = [], caught = new Set<string>();
  const WANT = ['fetch', 'pickup', 'go', 'wait', 'work', 'home', 'climbing', 'keeperBay', 'act', 'asleep', 'rushed', 'walk', 'turn', 'call', 'board', 'ride', 'alight', 'bay'];
  const under = (w: CareSim) => new Set([...w.keepers.map((k) => (k.climbing ? 'climbing' : k.bayWait ? 'keeperBay' : k.phase)), ...w.dragons.filter((d) => d.act).map((d) => (d.asleep ? 'asleep' : 'act')),
    ...w.dragons.map((d) => d.move), ...(w.jobs.some((j) => j.rushed) ? ['rushed'] : [])]);
  let rushed = false;
  for (let s = 1; s <= 65000 && (s <= 60000 || live.length); s++) {
    // (a Rush on the last job in the queue, the first time one is open from step 6000, so a save catches one)
    if (s >= 6000 && !rushed && ref.jobs.length) {
      const id = ref.queue()[ref.jobs.length - 1].id;
      for (const w of [ref, ...live.map((f) => f.sim)]) { const j = w.jobs.find((q) => q.id === id); if (j) w.rush(j); else fail(`save: job ${id} is missing from a loaded world at step ${s}`); }
      rushed = true;
    }
    ref.step();
    for (const f of live) f.sim.step();
    for (let i = live.length - 1; i >= 0; i--) {
      const f = live[i];
      if (s < f.at + 5000) continue;
      if (f.sim.digest() !== ref.digest()) fail(`save: a world saved at step ${f.at} and loaded drifted by step ${s}`);
      live.splice(i, 1);
    }
    if (s >= 5000 && s <= 60000 && forks.length < 24) {
      const now = [...under(ref)].filter((p) => WANT.includes(p) && !caught.has(p));
      if (now.length) { const sim = CareSim.fromSave(through(serialize(ref))), f = { sim, at: s, used: uses(sim) }; forks.push(f); live.push(f); for (const p of now) caught.add(p); }
    }
  }
  if (live.length) fail(`save: ${live.length} loaded worlds were never compared`);
  // (a loaded world counts only its own uses, not the ones it was loaded with)
  noteUse(a); noteUse(b, blob.stats); noteUse(ref);
  for (const f of forks) noteUse(f.sim, f.used);
  if (firstCall) caught.add('call');
  for (const p of WANT) if (!caught.has(p)) fail(`save: no save caught a world with something ${p}`);
  let threw: unknown = null;
  try { CareSim.fromSave({ ...serialize(a), v: 999 }); } catch (e) { threw = e; }
  if (!(threw instanceof SaveVersionError)) fail(`save: a version-999 save ${threw ? `threw ${threw}` : 'loaded'}, not a SaveVersionError`);
  console.log(`  6 saves: ${JSON.stringify(blob).length} bytes at step 5000; loaded, it, one at the first call for the car (${firstCall}), one at the first ride (${firstRide}) and ${forks.length} more saves (steps ${forks.map((f) => f.at).join(' ')}: ${[...caught].join(', ')}) step on 5000 to the same world; saves with a room's uses missing or a walk at a speed not the game's throw; v 999 throws ${threw instanceof Error ? threw.name : threw}`);
}
if (ROLE === 'saves') {
  // life (plan S5): on a short day, the new game with a baby about to grow up and three eggs in the nests (one hatching
  // at step 300, one at 900, one at 1200); saved while the eggs incubate, while the baby walks to the module slot it
  // will grow up in, the step an egg hatches and the step a dragon grows up -- each loaded (through JSON) and stepped
  // 5000 on in lockstep with the run it came from, to the same world
  const through = <T>(v: T): T => JSON.parse(JSON.stringify(v));
  const mk = () => {
    const w = new CareSim(START_ROOMS, [...START_DRAGONS, { name: 'BURR', element: 'spike', stage: 'baby', seed: 45, slot: { room: 'hatchery', i: 0 }, days: STAGE_DAYS - 0.1 }], START_KEEPERS, { seed: 1, dayLen: 600 });
    w.addEgg('rock', w.clock - 900); w.addEgg('dusk', w.clock - 300); w.addEgg('water');
    return w;
  };
  const ref = mk(), forks: { sim: CareSim; at: number; what: string; used: Uses }[] = [], seen = new Set<string>();
  const WANT = ['egg', 'settle', 'hatch', 'grow'];
  for (let s = 1; s <= 12000 && (seen.size < WANT.length || forks.some((f) => s <= f.at + 5000)); s++) {
    ref.step();
    for (const f of forks) if (s <= f.at + 5000) f.sim.step();
    for (const f of forks) if (s === f.at + 5000 && f.sim.digest() !== ref.digest()) fail(`save: a world saved at step ${f.at} (${f.what}) and loaded drifted by step ${s}`);
    const now = [...(s === 100 && ref.eggs.length ? ['egg'] : []), ...(ref.dragons.some((d) => d.goal === 'settle' && d.legs.length) ? ['settle'] : []),
      ...ref.events.map((e) => e.kind)].filter((k) => WANT.includes(k) && !seen.has(k));
    if (now.length) {
      const blob = serialize(ref), sim = CareSim.fromSave(through(blob));
      if (blob.eggs.length !== ref.eggs.length || sim.eggs === ref.eggs || JSON.stringify(sim.eggs) !== JSON.stringify(ref.eggs) || sim.nextEggId !== ref.nextEggId) fail(`save: the eggs were not saved and loaded as their own copy (step ${s})`);
      forks.push({ sim, at: s, what: now.join('+'), used: uses(sim) });
      for (const k of now) seen.add(k);
    }
  }
  for (const k of WANT) if (!seen.has(k)) fail(`save: no save caught a world with ${k === 'egg' ? 'an egg incubating' : k === 'settle' ? 'a baby walking to grow up' : `a ${k}`}`);
  noteUse(ref);
  for (const f of forks) noteUse(f.sim, f.used);
  const said: Readonly<Record<string, string>> = { egg: 'eggs incubating', settle: 'BURR walking to grow up', hatch: 'an egg just hatched', grow: 'a dragon just grown up' };
  console.log(`  6 saves (life, a 600-step day): ${forks.map((f) => `step ${f.at} (${f.what.split('+').map((k) => said[k]).join(', ')})`).join(', ')} step on 5000 to the same world`);
}
if (ROLE === 'saves') {
  // the garden (plan S6): the garden preset (residents napping, sitting, strolling, waiting for their keeper and being
  // met by one come out of the barn) and the retire preset on a short day (elders set off, riding down, passing the
  // Garden Gate, arriving at their plots): each saved the first step it is seen, loaded through JSON and stepped 5000 on
  // in lockstep with the run it came from, to the same world; a resident's rhythm saved as its own copy
  const through = <T>(v: T): T => JSON.parse(JSON.stringify(v));
  const runs: { what: string; mk: () => CareSim; steps: number; seen: (w: CareSim) => string[] }[] = [
    { what: 'garden', mk: () => buildSim(startSpec('garden'), 1), steps: 40000,
      seen: (w) => w.dragons.flatMap((d) => (d.place !== 'garden' ? [] : d.act ? ['met'] : [d.garden!.mode])) },
    { what: 'retire', mk: () => { const sp = startSpec('retire'); return new CareSim(sp.rooms, sp.dragons, sp.keepers, { seed: 1, dayLen: 600 }); }, steps: 20000,
      seen: (w) => [...w.dragons.flatMap((d) => (d.goal !== 'retire' ? [] : d.move === 'ride' ? ['ride'] : d.f === 0 && d.x > GATE_X0 && d.x < GATE_X1 ? ['gate'] : d.legs.length ? ['retire'] : [])),
        ...w.events.filter((e) => e.kind === 'garden').map(() => 'arrive')] },
  ];
  const said: string[] = [];
  for (const run of runs) {
    const ref = run.mk(), forks: { sim: CareSim; at: number; what: string; used: Uses }[] = [], seen = new Set<string>();
    const want = run.what === 'garden' ? ['nap', 'sit', 'stroll', 'wait', 'met'] : ['retire', 'ride', 'gate', 'arrive'];
    for (let s = 1; s <= run.steps && (seen.size < want.length || forks.some((f) => s <= f.at + 5000)); s++) {
      ref.step();
      for (const f of forks) if (s <= f.at + 5000) f.sim.step();
      for (const f of forks) if (s === f.at + 5000 && f.sim.digest() !== ref.digest()) fail(`save (${run.what}): a world saved at step ${f.at} (${f.what}) and loaded drifted by step ${s}`);
      const now = [...new Set(run.seen(ref))].filter((k) => want.includes(k) && !seen.has(k));
      if (!now.length) continue;
      const sim = CareSim.fromSave(through(serialize(ref)));
      const rd = ref.dragons.find((d) => d.garden), ld = rd && sim.dragons.find((d) => d.id === rd.id);
      if (sim.garden.plots !== ref.garden.plots || sim.worldW !== ref.worldW || (rd && (!ld || ld.garden === rd.garden || !isDeepStrictEqual(ld.garden, rd.garden)))) fail(`save (${run.what}): the garden was not saved and loaded as its own copy (step ${s})`);
      forks.push({ sim, at: s, what: now.join('+'), used: uses(sim) });
      for (const k of now) seen.add(k);
    }
    for (const k of want) if (!seen.has(k)) fail(`save (${run.what}): no save caught a world with ${k}`);
    noteUse(ref);
    for (const f of forks) noteUse(f.sim, f.used);
    said.push(`${run.what} ${forks.map((f) => `step ${f.at} (${f.what})`).join(', ')}`);
  }
  // a save whose garden this build can't keep throws (the view then starts a new barn: base.ts load): too few plots, a
  // dragon in a place there isn't, a resident with a slot or none of its rhythm, two residents on one plot
  const good = serialize(buildSim(startSpec('garden'), 1)), bad: [string, (s: any) => void][] = [
    ['one plot', (b) => { b.garden.plots = 1; }],
    ['a dragon on the moon', (b) => { b.dragons[0].place = 'moon'; }],
    ['a resident holding a slot', (b) => { b.dragons.find((d: any) => d.place === 'garden').slot = { room: 3, i: 0 }; }],
    ['a resident with no rhythm', (b) => { b.dragons.find((d: any) => d.place === 'garden').garden = null; }],
    ['two residents on one plot', (b) => { const r = b.dragons.filter((d: any) => d.place === 'garden'); r[1].home = r[0].home; }],
    ['a resident past the last plot', (b) => { b.dragons.find((d: any) => d.place === 'garden').home = b.garden.plots; }],
  ];
  for (const [what, f] of bad) {
    const b = through(good); f(b);
    let threw = false;
    try { CareSim.fromSave(b); } catch { threw = true; }
    if (!threw) fail(`save: one with ${what} loaded`);
  }
  console.log(`  6 saves (the garden): ${said.join('; ')} step on 5000 to the same world; ${bad.length} saves whose garden can't be kept (${bad.map(([w]) => w).join(', ')}) throw`);
}

if (ROLE === 'saves') {
  // missions (plan S8): THE LOST NEST sent on a short day (seed 2: a success, an egg), saved the first step it is seen
  // mustering (a rider on the way up with a saddle), departing over the bridge, away, landing with the egg carried down,
  // a saddle being hung back, and a rider resting in the Bunks -- each loaded through JSON and stepped 5000 on in
  // lockstep with the run it came from, to the same world; and a save whose missions this build can't run throws
  const through = <T>(v: T): T => JSON.parse(JSON.stringify(v));
  const mk = () => { const w = new CareSim(START_ROOMS, START_DRAGONS, START_KEEPERS, { seed: 2, dayLen: 600 }); sendLostNest(w); return w; };
  const ref = mk(), forks: { sim: CareSim; at: number; what: string; used: Uses }[] = [], seen = new Set<string>();
  const want = ['muster', 'depart', 'away', 'egg', 'tack', 'rest'];
  const kinds = (w: CareSim): string[] => {
    const t = w.missions.trip, out: string[] = [];
    if (t?.state === 'muster' && w.keepers.some((k) => k.phase === 'muster' && k.carrying === 'saddle' && k.legs.length)) out.push('muster');
    if (t?.state === 'depart') out.push('depart');
    if (t?.state === 'away') out.push('away');
    for (const k of w.keepers) {
      if (k.phase === 'deliver' && k.carrying === 'egg') out.push('egg');
      if (k.phase === 'deliver' && k.carrying === 'saddle' && k.t > 0) out.push('tack');
      if (k.phase === 'rest') out.push('rest');
    }
    return out;
  };
  for (let s = 1; s <= 20000 && (seen.size < want.length || forks.some((f) => s <= f.at + 5000)); s++) {
    ref.step();
    for (const f of forks) if (s <= f.at + 5000) f.sim.step();
    for (const f of forks) if (s === f.at + 5000 && f.sim.digest() !== ref.digest()) fail(`save (missions): a world saved at step ${f.at} (${f.what}) and loaded drifted by step ${s}`);
    const now = [...new Set(kinds(ref))].filter((k) => want.includes(k) && !seen.has(k));
    if (!now.length) continue;
    const sim = CareSim.fromSave(through(serialize(ref)));
    if (sim.missions === ref.missions || !isDeepStrictEqual(sim.missions, ref.missions) || (ref.missions.trip && sim.missions.trip === ref.missions.trip)) fail(`save (missions): the missions were not saved and loaded as their own copy (step ${s})`);
    forks.push({ sim, at: s, what: now.join('+'), used: uses(sim) });
    for (const k of now) seen.add(k);
  }
  for (const k of want) if (!seen.has(k)) fail(`save (missions): no save caught a world with ${k}`);
  noteUse(ref);
  for (const f of forks) noteUse(f.sim, f.used);
  // (saves whose missions can't be run: a mission in a region there isn't, a team of a dragon there isn't, a keeper away with no team, none at all)
  const good = serialize(mk()), bad: [string, (b: any) => void][] = [
    ['a mission in Atlantis', (b) => { b.missions.board[0].region = 'atlantis'; }],
    ['a team of a dragon there isn\'t', (b) => { b.missions.trip.pairs[0].dragon = 99; }],
    ['a keeper away with no team', (b) => { b.missions.trip = null; b.missions.deck = []; }],
    ['a dragon mustering with no team', (b) => { b.missions.trip.pairs.pop(); b.missions.deck.pop(); for (const k of b.keepers) if (k.phase === 'muster' && !b.missions.trip.pairs.some((p: any) => p.keeper === k.id)) k.phase = 'idle'; }],
    ['no missions', (b) => { delete b.missions; }],
  ];
  for (const [what, f] of bad) {
    const b = through(good); f(b);
    let threw = false;
    try { CareSim.fromSave(b); } catch { threw = true; }
    if (!threw) fail(`save: one with ${what} loaded`);
  }
  console.log(`  6 saves (missions, a 600-step day): ${forks.map((f) => `step ${f.at} (${f.what})`).join(', ')} step on 5000 to the same world; ${bad.length} saves whose missions can't be run (${bad.map(([w]) => w).join(', ')}) throw`);
}
if (ROLE === 'saves') {
  // missions and a keeper held by hand together (the S7 + S8 merge, plan 3.6: "mid-muster and mid-away", "control
  // released on load"): THE LOST NEST sent (seed 2, a 600-step day) and a keeper who stays home taken by hand at once,
  // walked back and forth by commands; saved mid-muster (a rider on the way up with a saddle) and mid-away, the save
  // holds nobody by hand, keeps the trip whole, and -- loaded through JSON -- steps 5000 on (through the landing) to the
  // same world as the run given a release that step
  const through = <T>(v: T): T => JSON.parse(JSON.stringify(v));
  const mk = (until: number) => {
    const w = new CareSim(START_ROOMS, START_DRAGONS, START_KEEPERS, { seed: 2, dayLen: 600 });
    sendLostNest(w);
    const riders = new Set(w.missions.trip!.pairs.map((p) => p.keeper)), hand = w.keepers.find((k) => !riders.has(k.id))!;
    w.command({ kind: 'take', keeper: hand.id });
    for (let s = 1; s <= until; s++) { if (s % 300 === 1) w.command({ kind: 'steer', dx: Math.floor(s / 300) % 2 ? -1 : 1, dy: 0 }); w.step(); }
    return { w, hand };
  };
  // (the steps the held run is first seen mustering, a rider carrying a saddle up, and away)
  const ref = mk(0).w, at: Record<string, number> = {};
  for (let s = 1; s <= 8000 && !(at.muster && at.away); s++) {
    if (s % 300 === 1) ref.command({ kind: 'steer', dx: Math.floor(s / 300) % 2 ? -1 : 1, dy: 0 });
    ref.step();
    const t = ref.missions.trip;
    if (!at.muster && t?.state === 'muster' && ref.keepers.some((k) => k.phase === 'muster' && k.carrying === 'saddle' && k.legs.length)) at.muster = s;
    if (!at.away && t?.state === 'away') at.away = s;
  }
  const lines: string[] = [];
  for (const what of ['muster', 'away'] as const) {
    if (!at[what]) { fail(`save (missions, held): the held run never reached ${what}`); continue; }
    const { w, hand } = mk(at[what]);
    if (!hand.manual || w.missions.trip?.state !== (what === 'muster' ? 'muster' : 'away')) { fail(`save (missions, held): at step ${at[what]} ${hand.name} manual ${hand.manual}, the trip ${w.missions.trip?.state}`); continue; }
    const blob = serialize(w), loaded = CareSim.fromSave(through(blob)), lk = loaded.keepers[hand.id];
    if (loaded.controlled != null || lk.manual || lk.pendingTake || lk.phase === 'manual') fail(`save (missions, held): loaded ${what} with ${hand.name} ${lk.phase}, manual ${lk.manual}`);
    if (!isDeepStrictEqual(loaded.missions, w.missions)) fail(`save (missions, held): the trip changed through the save (${what})`);
    const twin = mk(at[what]).w, since = uses(loaded);
    twin.command({ kind: 'release' });
    let landed = false;
    for (let s = 0; s < 5000; s++) { twin.step(); loaded.step(); if (twin.missions.trip?.state === 'return') landed = true; }
    if (loaded.digest() !== twin.digest()) fail(`save (missions, held): a world saved ${what} with ${hand.name} held and loaded drifted from one given a release that step`);
    noteUse(loaded, since); noteUse(twin);
    lines.push(`step ${at[what]} (${what}, ${hand.name} held: loaded ${lk.phase}${landed ? ', stepped on through the landing' : ''})`);
  }
  console.log(`  6 saves (missions and a keeper held by hand): ${lines.join(', ')} step on 5000 to the same world as a release that step`);
}

// ---------- 7. rngAt: stateless draws ----------
if (MAIN) {
  const seq = (r: { next(): number }) => Array.from({ length: 100 }, () => r.next());
  if (!isDeepStrictEqual(seq(rngAt(1, TAG.EGG, 3, 4)), seq(rngAt(1, TAG.EGG, 3, 4)))) fail('rngAt: the same keys gave different draws');
  const tags = Object.values(TAG), firsts = tags.map((t) => rngAt(1, t, 0).next());
  if (new Set(firsts).size !== tags.length) fail(`rngAt: two tags share a first draw (${firsts.map((v) => v.toFixed(4)).join(' ')})`);
  if (mix32(1, 2) === mix32(2, 1) || mix32(1) === mix32(1, 0)) fail('mix32: the keys\' order or count is lost');
  if (rngAt(1, TAG.EGG, 3).next() === rngAt(2, TAG.EGG, 3).next()) fail('rngAt: two seeds gave the same draw');
  let keyed = 0, run = 0;
  for (let i = 0; i < 10000; i++) keyed += rngAt(1, TAG.BOARD, i).next();
  const one = rngAt(1, TAG.MISSION, 5);
  for (let i = 0; i < 10000; i++) run += one.next();
  keyed /= 10000; run /= 10000;
  if (!(keyed >= 0.49 && keyed <= 0.51)) fail(`rngAt: the first draws of 10000 keys average ${keyed.toFixed(4)}`);
  if (!(run >= 0.49 && run <= 0.51)) fail(`rngAt: 10000 draws from one key average ${run.toFixed(4)}`);
  console.log(`  7 rngAt: the same keys, the same draws; ${tags.length} tags, ${tags.length} first draws; the mean of 10000 draws is ${keyed.toFixed(4)} over keys, ${run.toFixed(4)} from one`);
}

// ---------- 8. rooms: a purpose each, and every named one used (#11) ----------
if (MAIN) {
  // every room kind and structure says what it is for; each need is met in exactly one kind of room
  for (const k of ROOM_KINDS) if (!ROOM_INFO[k].purpose?.trim()) fail(`rooms: the ${k} has no purpose`);
  for (const [k, v] of Object.entries(STRUCTURES)) if (!v.purpose.trim()) fail(`rooms: the ${k} has no purpose`);
  for (const n of NEEDS) {
    const by = ROOM_KINDS.filter((k) => ROOM_INFO[k].meets === n);
    if (by.length !== 1) fail(`rooms: ${n} is met in ${by.length ? by.join(', ') : 'no room'}, not exactly one kind`);
  }
  // the plates: one per room, the lift's and the Aerie's; each names a room placed or a structure, and sits on it (so
  // never on a bare slot): a room's inside its wall, the lift's in its ground-floor bay, the Aerie's over the deck
  const sim = newSim(), plates = platesOf(sim.rooms), nStructures = Object.keys(STRUCTURES).length;
  if (plates.length !== sim.rooms.length + nStructures) fail(`plates: ${plates.length} for ${sim.rooms.length} rooms and the ${nStructures} structures`);
  const inside = (p: { x: number; y: number; w: number; h: number }, x0: number, x1: number, y0: number, y1: number) => p.x >= x0 && p.x + p.w <= x1 && p.y >= y0 && p.y + p.h <= y1;
  for (const p of plates) {
    if (!(p.names in ROOM_INFO) && !(p.names in STRUCTURES)) { fail(`plates: "${p.text}" names ${p.names}, which is no room or structure`); continue; }
    const r = p.room == null ? null : sim.rooms[p.room];
    const ok = r ? r.kind === p.names && p.text === ROOM_INFO[r.kind].name && inside(p, r.x0, r.x1, floorTop(r.floor), floorTop(r.floor) + WALL_H)
      : p.names === 'lift' ? inside(p, LIFT_X0, LIFT_X1, floorTop(0), floorTop(0) + WALL_H)
      : p.names === 'garden' ? inside(p, GARDEN_X0, GARDEN_X0 + GARDEN_PLOT, floorTop(0) - PITCH, floorTop(0))
      : p.names === 'aerie' && inside(p, DECK_X0, DECK_X1, 0, feetY(AERIE_F) - 8);
    if (!ok) fail(`plates: "${p.text}" at (${p.x}, ${p.y}) is not on the ${p.names} it names`);
  }
  // placing keeps the rules: no room on the lift's module; a dragon in a slot of its size, alone in it, and a module
  // holding one grown dragon or up to two babies (each of these must throw)
  const throws = (what: string, f: () => unknown) => { try { f(); fail(`rooms: ${what} was allowed`); } catch { /* as it should */ } };
  throws('a barn room on the lift', () => placeRooms([{ kind: 'bath', part: 'barn', floor: 1, mod: 1, width: 2 }]));
  throws('a dragon room in a tower', () => placeRooms([{ kind: 'kitchen', part: 'towerR', floor: 0 }]));
  const one = (p: Partial<DragonPlace> & { slot: { room: RoomKind; i: number } }): DragonPlace => ({ name: 'T', element: 'fire', stage: 'adult', seed: 1, ...p });
  throws('two dragons in one slot', () => new CareSim(START_ROOMS, [one({ slot: { room: 'kitchen', i: 0 } }), one({ name: 'U', slot: { room: 'kitchen', i: 0 } })], START_KEEPERS));
  throws('a grown dragon in a baby\'s sub-slot', () => new CareSim(START_ROOMS, [one({ slot: { room: 'kitchen', i: 2 } })], START_KEEPERS));
  throws('a baby in a module slot', () => new CareSim(START_ROOMS, [one({ stage: 'baby', slot: { room: 'kitchen', i: 0 } })], START_KEEPERS));
  throws('a baby beside a grown dragon in one module', () => new CareSim(START_ROOMS, [one({ slot: { room: 'kitchen', i: 0 } }), one({ name: 'U', stage: 'baby', slot: { room: 'kitchen', i: 2 } })], START_KEEPERS));
  throws('a grown dragon in the hatchery', () => new CareSim(START_ROOMS, [one({ slot: { room: 'hatchery', i: 0 } })], START_KEEPERS));
  // a keeper waits between jobs clear of the body of a young, adult or elder dragon in any slot on their floor (their
  // extent is x +- 10), so a keeper at rest is never hidden behind a grown dragon; a resting baby's tail may reach a
  // little into it (BASE_DESIGN 3: a one-module room has no spot clear of both its baby sub-slots and of its grown dragon's
  // slot, and keepers are drawn behind dragons, G6) -- at most KEEPER_BABY_TAIL px, and never with its head (the eye to
  // the snout); the waiting spot is in the keeper's own room
  const KEEPER_BABY_TAIL = 13;
  let babyTail = 0;
  for (const k of sim.keepers) {
    if (k.stationX < k.station.x0 + 10 || k.stationX > k.station.x1 - 10) fail(`keepers: ${k.name} waits at x ${k.stationX}, outside the ${k.station.kind}`);
    const k0 = k.stationX - 10, k1 = k.stationX + 10;
    for (const r of sim.rooms) if (r.floor === k.station.floor) for (const sl of r.slots) for (const st of STAGES) {
      if (!fitsSlot(sl, st)) continue;
      const [x0, x1] = slotBody(sl, st), over = Math.min(k1, x1) - Math.max(k0, x0);
      if (over <= 0) continue;
      const [e0] = DRAGON_EYE[st], head: [number, number] = sl.facing > 0 ? [sl.x + e0, x1] : [x0, sl.x - e0];
      if (st !== 'baby' || over > KEEPER_BABY_TAIL || (k1 > head[0] && k0 < head[1])) fail(`keepers: ${k.name} waits at x ${k.stationX}, behind ${/^[aeiou]/.test(st) ? 'an' : 'a'} ${st} in the ${r.kind}'s slot ${sl.i} (its body x ${x0.toFixed(1)}..${x1.toFixed(1)}${st === 'baby' ? `, ${over.toFixed(1)} px in` : ''})`);
      else babyTail = Math.max(babyTail, over);
    }
  }
  // the barn of BASE_DESIGN 3 (its room table): each barn room one module, a need's rooms repeated -- the ground and
  // upper floors all five, the hayloft food, love and sleep, and the Hatchery under its west slope -- with its post, the
  // keepers' waiting spot and an adult's stand spot where the table says (room id: floor, module, kind, post, wait,
  // stand; the Hatchery its two sub-slots and three nests)
  const TABLE: readonly (readonly [number, number, RoomKind, number, number, number])[] = [
    [0, 0, 'kitchen', 232, 184, 190], [0, 1, 'groom', 448, 474, 466], [0, 3, 'bath', 792, 858, 850], [0, 4, 'romp', 979, 1018, 1010], [0, 5, 'dorm', 1112, 1178, 1170],
    [2, 0, 'hatchery', -1, -1, -1], [1, 0, 'kitchen', 232, 184, 190], [1, 1, 'romp', 435, 474, 466], [1, 3, 'groom', 832, 858, 850], [1, 4, 'bath', 952, 1018, 1010],
    [1, 5, 'dorm', 1112, 1178, 1170], [2, 1, 'kitchen', 392, 344, 350], [2, 3, 'groom', 832, 858, 850], [2, 4, 'dorm', 952, 1018, 1010],
  ];
  TABLE.forEach(([f, m, kind, post, wait, stand], id) => {
    const r = sim.rooms[id], M = r?.slots.find((q) => !q.baby);
    const got = r ? `f${r.floor} m${sim.roomPlaces[id].mod} ${r.kind}${r.kind === 'hatchery' ? ` sub-slots ${r.slots.map((q) => `${q.x}${q.facing > 0 ? '+' : '-'}`).join(' ')} nests ${[0, 1, 2].map((i) => nestX(r, i)).join(' ')}` : ` post ${postX(r)} wait ${waitX(r)} stand ${M ? standSpot(M, 'adult', r).x : '-'}`}` : 'none';
    const want = `f${f} m${m} ${kind}${kind === 'hatchery' ? ' sub-slots 228+ 288+ nests 228 268 308' : ` post ${post} wait ${wait} stand ${stand}`}`;
    if (got !== want || (r && r.part !== 'barn') || (r && r.x1 - r.x0 !== 160)) fail(`rooms: room ${id} is ${got}, not the design's ${want}`);
  });
  if (sim.rooms.filter((r) => r.part === 'barn').length !== TABLE.length) fail(`rooms: ${sim.rooms.filter((r) => r.part === 'barn').length} barn rooms, not the design's ${TABLE.length}`);
  // the start stands in the start slots of BASE_DESIGN 3 (a room by id, its module slot), facing its slot's way; the keepers
  // wait at their fixed stations (a room by id; they never move station)
  const want: Readonly<Record<string, number>> = { EMBER: 0, BRAMBLE: 1, COBBLE: 8, ZAP: 7, RIPPLE: 2, ECHO: 12, WICK: 4 };
  for (const d of sim.dragons) {
    const got = d.slot ? `room ${d.slot.room} (${sim.rooms[d.slot.room].kind}) slot ${d.slot.i}` : 'no slot';
    if (got !== `room ${want[d.name]} (${sim.rooms[want[d.name]].kind}) slot 0` || d.x !== d.slot?.x || d.f !== d.slot.f || d.facing !== d.slot.facing) fail(`start: ${d.name} stands in ${got} at f${d.f} x ${d.x} facing ${d.facing}, not room ${want[d.name]}'s module slot`);
  }
  const stations: Readonly<Record<string, readonly [number, number]>> = { BEA: [0, 184], TOMAS: [8, 858], PIP: [7, 474], IRIS: [13, 1018] };
  for (const k of sim.keepers) if (k.station.id !== stations[k.name][0] || k.stationX !== stations[k.name][1] || k.f !== k.station.floor) fail(`keepers: ${k.name}'s station is room ${k.station.id} (${k.station.kind}) at x ${k.stationX}, not room ${stations[k.name][0]} at ${stations[k.name][1]}`);
  // each need's room (travel.ts NEED_ROOM) is the one kind that meets it, and the base has it
  const needRooms: Readonly<Record<string, string>> = { food: 'kitchen', bath: 'bath', play: 'romp', love: 'groom', sleep: 'dorm' };
  for (const n of NEEDS) if (NEED_ROOM[n] !== needRooms[n] || ROOM_INFO[NEED_ROOM[n]].meets !== n || !needRoom(sim, n)) fail(`rooms: ${n} is met in the ${NEED_ROOM[n]}, not the ${needRooms[n]}`);
  console.log(`  8 rooms: ${ROOM_KINDS.length} kinds and ${Object.keys(STRUCTURES).length} structures, each with a purpose; ${NEEDS.length} needs, one kind of room each (${sim.rooms.filter((r) => ROOM_INFO[r.kind].meets).length} need rooms: ${NEEDS.map((n) => `${NEED_ROOM[n]} x${sim.rooms.filter((r) => r.kind === NEED_ROOM[n]).length}`).join(', ')}), the design's ${TABLE.length} barn rooms; ${plates.length} plates, none on a bare slot; keepers wait at their stations ${sim.keepers.map((k) => `${k.name} ${k.stationX} (room ${k.station.id})`).join(', ')}, clear of every grown dragon's slot (a resting baby's tail ${babyTail.toFixed(1)} px in at most, never its head; gate ${KEEPER_BABY_TAIL}); the start in its rooms (the rooms' uses are checked at the end, over the whole suite, room by room)`);
}

// ---------- 9. gait: dragons walk by their walks' own root motion ----------
if (MAIN) {
  // the walk's frames (duration, move) of an element at a stage, built from scratch for a seed (the anim table the pets
  // share is built once per look, whoever's dims come first: this rebuilds it past that cache, as dragonAnims does)
  const walkOf = (el: DragonElement, st: Stage, seed: number) => {
    const b = dragonBuild({ element: el, stage: st, seed });
    const ov = b.spec.anims?.overrides?.(st, b.dims)?.walk;
    return ov ?? baseAnims(st, animTuning(st, b.spec), b.dims, b.spec.stages[st].wing).walk;
  };
  const table = (f: readonly { dur?: number; move?: number }[]) => f.map((q) => `${q.dur || 1}:${q.move || 0}`).join(' ');
  let looks = 0, still = 0;
  const loopsFrom: string[] = [];
  for (const el of DRAGON_ELEMENTS) for (const st of STAGES) {
    const g = gaitOf(el, st);
    looks++;
    for (const seed of [11, 215]) if (table(walkOf(el, st, seed).frames) !== table(g.frames)) fail(`gait: the ${el} ${st} walk's frames differ for seed ${seed}`);
    if (table(dragonAnims(st, dragonBuild({ element: el, stage: st, seed: 1 }).spec).walk.frames) !== table(g.frames)) fail(`gait: the ${el} ${st} gait is not the walk the pets play`);
    // (checked against what the gait is read from, not itself: the anim table's own frames summed, and a player playing
    // that walk from its start at speed 1 -- its `move` after every tick for three cycles is moveAt's, wrap and all)
    const b1 = dragonBuild({ element: el, stage: st, seed: 1 }), walk = dragonAnims(st, b1.spec, b1.dims).walk;
    const raw = walk.frames.reduce((a, q) => a + (q.dur || 1) * (q.move || 0), 0);
    if (Math.abs(raw - g.avg * g.len) > 1e-9) fail(`gait: ${el} ${st}: the walk's frames move ${raw} a cycle, the gait ${g.avg * g.len}`);
    const pl = new DragonAnimPlayer(dragonAnims(st, b1.spec, b1.dims), 1);
    pl.play('walk', { restart: true, speed: 1 });
    for (let t = 1; t <= 3 * g.len; t++) { pl.tick(); if (pl.move !== moveAt(g, t)) { fail(`gait: ${el} ${st}: at anim time ${t} the player moves ${pl.move}, the gait ${moveAt(g, t)}`); break; } }
    if (g.loopStart !== 0) loopsFrom.push(`${el} ${st}`);
    if (g.steps.some((m) => m === 0)) still++;
  }
  // the grow-up's cheer (life.ts holds a dragon just grown up for happyLen): every look's happy is the same length for
  // seeds 11 and 215 (rebuilt past the pets' cache, as the walks are), and a player playing it from its start at speed 1
  // -- as the view does on the grow step -- is done after exactly happyLen ticks
  const happies: number[] = [];
  for (const el of DRAGON_ELEMENTS) for (const st of STAGES) {
    const n = happyLen(el, st), sum = (f: readonly { dur?: number }[]) => f.reduce((a, q) => a + (q.dur || 1), 0);
    happies.push(n);
    for (const seed of [11, 215]) {
      const b = dragonBuild({ element: el, stage: st, seed }), h = b.spec.anims?.overrides?.(st, b.dims)?.happy ?? baseAnims(st, animTuning(st, b.spec), b.dims, b.spec.stages[st].wing).happy;
      if (!h || sum(h.frames) !== n) fail(`happy: the ${el} ${st} happy lasts ${h ? sum(h.frames) : 'nothing'} steps for seed ${seed}, not ${n}`);
    }
    const b1 = dragonBuild({ element: el, stage: st, seed: 1 }), pl = new DragonAnimPlayer(dragonAnims(st, b1.spec, b1.dims), 1);
    pl.play('happy', { restart: true, speed: 1 });
    let t = 0;
    while (!pl.done && t < 1000) { pl.tick(); t++; }
    if (t !== n || pl.name !== 'happy') fail(`happy: a player playing the ${el} ${st} happy was done after ${t} ticks, not ${n}`);
  }
  // a walk with an intro (the spike adult walk, its creep standing still some frames, looping from its third frame):
  // the gait, the player and the view's catch-up (a pet met mid-bout is ticked wrapT(gaitT - 1) times from its start:
  // base.ts sync) agree past the wrap
  {
    const bf = dragonBuild({ element: 'spike', stage: 'adult', seed: 1 }), table = dragonAnims('adult', bf.spec, bf.dims);
    const intro = { ...table, walk: { ...table.walk, loopFrom: 2 } }, gi = gaitFrom(table.walk.frames, 2);
    const ref = new DragonAnimPlayer(intro, 1);
    ref.play('walk', { restart: true, speed: 1 });
    const moves: number[] = [];
    for (let t = 1; t <= 3 * gi.len; t++) { ref.tick(); moves.push(ref.move); if (ref.move !== moveAt(gi, t)) { fail(`gait: with an intro, at anim time ${t} the player moves ${ref.move}, the gait ${moveAt(gi, t)}`); break; } }
    if (gi.loopStart <= 0 || gi.loopStart >= gi.len) fail(`gait: a walk looping from frame 2 starts its loop at ${gi.loopStart}`);
    for (const t of [gi.len - 1, gi.len + 3, 2 * gi.len + 5]) {
      const late = new DragonAnimPlayer(intro, 1);
      late.play('walk', { restart: true, speed: 1 });
      for (let i = 0; i < wrapT(gi, t - 1); i++) late.tick();
      const seen: number[] = [];
      for (let i = 0; i < 20; i++) { late.tick(); seen.push(late.move); }
      if (seen.join() !== moves.slice(t - 1, t + 19).join()) { fail(`gait: a pet caught up to anim time ${t} of a walk with an intro plays on out of step`); break; }
    }
  }
  // the lively step (BASE_DESIGN 2; travel.ts LIVELY): a walk played faster moves the body by exactly the same factor (G13) --
  // every element and stage, a bout at speed 1, then at LIVELY for a cycle (stepping on to the car, across the bay),
  // then at 1 again, as a crosser's does: the gait's s x moveAt(T) each step, T advancing s, is what an anim player
  // playing that walk at those speeds carries a pet by (speed x its move), step for step
  let livelySteps = 0;
  for (const el of DRAGON_ELEMENTS) for (const st of STAGES) {
    const g = gaitOf(el, st), b = dragonBuild({ element: el, stage: st, seed: 11 });
    const pl = new DragonAnimPlayer(dragonAnims(st, b.spec, b.dims), 11);
    pl.play('walk', { restart: true, speed: 1 });
    let T = 0, simX = 0, viewX = 0;
    for (let i = 0; i < 3 * g.len; i++) {
      const sp = i >= g.len && i < 2 * g.len ? LIVELY : 1;
      T += sp; simX += sp * moveAt(g, T);
      pl.speed = sp; pl.tick(); viewX += pl.speed * pl.move;
      livelySteps++;
      if (Math.abs(simX - viewX) > 1e-9) { fail(`gait: ${el} ${st} walking at ${sp}: the body moved ${simX} px, the anim at that speed ${viewX}`); break; }
    }
  }
  // a scripted adult spike (BRAMBLE), walking 600 steps along the ground floor from the Grooming Parlour east across the
  // lift bay with nothing else to do: exactly the gait's distance at the pace the lively step gives each step -- LIVELY
  // while its body is in the bay or steps into it, 1 elsewhere -- and exactly what the anim player carries a pet playing
  // that walk from its start at those speeds (the view plays it at Dragon.gaitS: base.ts sync)
  const sim = newSim(1), d = sim.dragons.find((q) => q.element === 'spike' && q.stage === 'adult')!;
  for (const q of sim.dragons) for (const k of NEEDS) if (hasNeed(q.element, k)) q.needs[k] = 1;
  const x0 = d.x, to = x0 + 400;
  d.legs = [{ f: d.f, x: to }];
  const g = gaitOf('spike', 'adult'), b = dragonBuild({ element: 'spike', stage: 'adult', seed: d.seed });
  const player = new DragonAnimPlayer(dragonAnims('adult', b.spec, b.dims), d.seed);
  player.play('walk', { restart: true, speed: 1 });
  let table600 = 0, played = 0, T = 0, fast = 0, bad = '';
  for (let t = 1; t <= 600; t++) {
    const [a0, a1] = bodySpan('adult', 1, d.x), [n0, n1] = bodySpan('adult', 1, d.x + 1);
    const s = (a1 > LIFT_X0 && a0 < LIFT_X1) || (n1 > LIFT_X0 && n0 < LIFT_X1) ? LIVELY : 1;
    sim.step();
    T += s; table600 += s * moveAt(g, T); player.speed = s; player.tick(); played += s * player.move;
    if (s > 1) fast++;
    if (!bad && (d.gaitS !== s || d.gaitT !== T)) bad = `step ${t}: its gait's speed ${d.gaitS} at ${d.gaitT}, not ${s} at ${T}`;
  }
  const went = d.x - x0;
  if (bad) fail(`gait: the scripted spike crossing the bay walked out of step with the lively step (${bad})`);
  if (d.move !== 'walk' || d.gaitT !== T || d.walkSeq !== 1 || !fast || fast === 600) fail(`gait: the scripted spike is ${d.move} ${d.gaitT} into bout ${d.walkSeq} (${fast} lively steps), not walking bout 1 across the bay`);
  if (Math.abs(went - table600) > 1e-9 || Math.abs(went - played) > 1e-9) fail(`gait: the scripted spike walked ${went} px in 600 steps; its gait says ${table600}, its anim ${played}`);
  if (Math.abs(sim.stats.dragonWalked - went) > 1e-9) fail(`gait: dragonWalked is ${sim.stats.dragonWalked}, the walk ${went}`);
  // the paper turn is the yard's: TURN_STEPS in all, the facing flipped at TURN_HALF
  if (TURN_HALF !== YARD_TURN_HALF || TURN_STEPS !== 2 * TURN_HALF) fail(`gait: the paper turn is ${TURN_STEPS} steps flipping at ${TURN_HALF}, not the yard's ${2 * YARD_TURN_HALF} at ${YARD_TURN_HALF}`);
  const t = newSim(1), e = t.dragons.find((q) => q.element === 'spike' && q.stage === 'adult')!;
  for (const q of t.dragons) for (const k of NEEDS) if (hasNeed(q.element, k)) q.needs[k] = 1;
  e.legs = [{ f: e.f, x: e.x - 100 }];
  const faced: number[] = [];
  for (let i = 0; i < TURN_STEPS + 1; i++) { t.step(); faced.push(e.move === 'turn' ? e.facing : 0); }
  const want = [e.facing * -1, e.facing * -1, e.facing * -1, e.facing, e.facing, e.facing, 0].join(',');
  if (faced.join(',') !== want) fail(`gait: a reversal turned ${faced.join(',')}, not ${want} (6 steps, the facing flipped at step 3)`);
  // the lift's landings: every stage's call spots lie on its floors (both sides on the barn's floors, the west one on the deck)
  for (const st of STAGES) for (const f of LIFT_STOPS) {
    const net = t.nets.dragon[st], L = spanOf(f, landingEdge(st, -1), net) >= 0, R = spanOf(f, landingEdge(st, 1), net) >= 0;
    if (!L || (f !== AERIE_F && !R)) fail(`gait: a ${st}'s landing on floor ${f} is off its floor (${L ? '' : 'west '}${R ? '' : 'east'})`);
  }
  console.log(`  9 gait: ${looks} walks, each the same for seeds 11 and 215, each moving as its frames and its anim player say for three cycles (${still} with steps standing still; ${loopsFrom.length ? `looping from past their start: ${loopsFrom.join(', ')}` : 'all looping whole'}; a walk with an intro wraps and catches up in step); every walk played at ${LIVELY} for a cycle mid-bout moved its body as its anim player did at that speed (${livelySteps} steps); a scripted spike walked ${went.toFixed(3)} px in 600 steps across the lift bay (${fast} of them lively), as its gait and its anim player say; the paper turn flips at step ${TURN_HALF} of ${TURN_STEPS}; ${happies.length} happies (a grow-up's cheer), ${Math.min(...happies)}-${Math.max(...happies)} steps, each the same for seeds 11 and 215 and played through in exactly that`);
  noteUse(sim); noteUse(t);
}

/** Section 10: a world stepped `min` minutes, watching the car -- the longest it stood still with work to do, and its busy share. */
const watch = (sim: CareSim, min: number) => {
  const steps = min * 60 * FPS;
  let key = '', since = 0, stuck = 0, busy = 0;
  for (let s = 0; s < steps; s++) {
    sim.step();
    const L = sim.lift, k = `${L.y},${L.rider},${L.target},${sim.dragons.map((d) => d.x).join()}`;
    if (L.rider != null || L.target != null) busy++;
    if (k !== key) { key = k; since = sim.tick; } else if (L.calls.length || L.rider != null) stuck = Math.max(stuck, sim.tick - since);
  }
  return { stuck, busy: busy / steps };
};

// ---------- 10. barn capacity: the herd the game grows (BASE_DESIGN 4.7) ----------
if (ROLE === 'capacity') {
  // The barn serves the herd eggs and missions grow it to (docs/BASE_DESIGN.md 4.7): each room meets one need, and a
  // need's rooms repeat on the floors, so a dragon's needs are met on its own floor and the one car -- one rider, one
  // dragon at a time in its shaft -- carries few; dragons step on and off the car, and across the lift bay, lively (at
  // travel.ts LIVELY, their bodies moved by the same factor: G13). C1: the benchmark cast `twelve` (tools/capacity.ts
  // parseCast / placeCast: the start's seven adults, three young and two babies) runs 30 minutes on seed 1, checked every
  // step by capacity.ts runOne with section 2's invariants and eye model -- no need empty, the waits short, the car mostly
  // free, no stall, no two in the shaft (the 8-seed sweep is `npm run capacity`). Then the crowds S3 measured the one car
  // against -- eight adults, ten, the ages preset's twelve of every stage -- keep service gates, and (C3) the `full`
  // preset, 21 dragons forced 9 over the cap, keeps moving, its due egg waiting.
  const out: string[] = [];
  const twelve = placeCast(parseCast('twelve'));
  if (twelve.missing || twelve.places.length !== BARN_CAP) fail(`capacity: the twelve cast does not fit the start barn (${twelve.missing ?? `${twelve.places.length} dragons`})`);
  const run = runOne({ cast: 'twelve', pattern: CASTS.twelve, places: twelve.places, seed: 1, min: 30 }, (w) => noteUse(w));
  const T = TWELVE;
  if (run.emptySteps) fail(`capacity (twelve): a need sat at 0 for ${run.emptySteps} dragon-steps (${run.mostEmpty})`);
  if (run.waitAvgS > T.waitAvgS || run.waitMaxS > T.waitMaxS) fail(`capacity (twelve): jobs waited ${run.waitAvgS.toFixed(1)} s on average, ${run.waitMaxS.toFixed(1)} s at most (want <= ${T.waitAvgS}, ${T.waitMaxS})`);
  if (run.done < T.done) fail(`capacity (twelve): ${run.done} jobs done in 30 minutes (want >= ${T.done})`);
  if (run.rides > T.rides) fail(`capacity (twelve): the car gave ${run.rides} rides (want <= ${T.rides}: the need rooms repeat on the floors, so the car stays mostly free)`);
  if (run.landingMaxS > T.landingS || run.bayMaxS > T.bayS) fail(`capacity (twelve): a landing wait ${run.landingMaxS.toFixed(1)} s, the bay's edge ${run.bayMaxS.toFixed(1)} s (want <= ${T.landingS}, ${T.bayS})`);
  if (run.coverS > T.coverTotalS || run.coverLongestS > T.coverS) fail(`capacity (twelve): an eye under a standing body ${run.coverS.toFixed(1)} s in all, ${run.coverLongestS.toFixed(1)} s at most (${run.coverWorst}; want <= ${T.coverTotalS}, ${T.coverS})`);
  if (run.stalls || run.breaks) fail(`capacity (twelve): ${run.stalls} stalls and ${run.breaks} invariant breaks (${[...run.stallNotes, ...run.breakNotes].join('; ')})`);
  out.push(`twelve (${CASTS.twelve}, ${run.dragons}), 30 min: ${run.emptySteps} steps with a need at 0; wait avg ${run.waitAvgS.toFixed(1)} s, max ${run.waitMaxS.toFixed(1)} s; ${run.done} jobs done; ${run.rides} rides, the car busy ${(run.carBusy * 100).toFixed(0)} %; a landing wait at most ${run.landingMaxS.toFixed(1)} s, the bay's edge ${run.bayMaxS.toFixed(1)} s; keepers busy ${(run.keeperBusy * 100).toFixed(0)} %; an eye under a standing body ${run.coverS.toFixed(1)} s in all, at most ${run.coverLongestS.toFixed(1)} s; ${run.stalls} stalls, ${run.breaks} invariant breaks (the shaft's among them); ${run.evictions} moved on; ${run.msPerStep.toFixed(3)} ms a step`);
  const runs = [
    { what: '8 adults', cast: [...START_DRAGONS, CROWD[0]], min: 30, gate: CROWD_GATES[0] },
    { what: '10 adults', cast: [...START_DRAGONS, ...CROWD], min: 10, gate: CROWD_GATES[1] },
    { what: 'the ages preset', cast: PRESETS.ages().dragons, min: 6, gate: CROWD_GATES[2] },
  ];
  for (const r of runs) {
    const sim = new CareSim(START_ROOMS, r.cast, START_KEEPERS, { seed: 1 }), { stuck, busy } = watch(sim, r.min);
    const st = sim.stats, n = r.cast.length, avg = st.waitSum / Math.max(1, st.started) / FPS, max = st.waitMax / FPS;
    if (st.waitTimeouts) fail(`capacity: with ${n} dragons, ${st.waitTimeouts} keepers gave up waiting`);
    if (stuck > 60 * FPS) fail(`capacity: with ${n} dragons, the car stood still with work to do for ${(stuck / FPS).toFixed(1)} s`);
    if (st.emptySteps) fail(`capacity: with ${n} dragons (${r.what}) a need sat at 0 for ${st.emptySteps} dragon-steps`);
    if (st.done < r.gate.done || avg > r.gate.waitAvgS || max > r.gate.waitMaxS) fail(`capacity: ${r.what}, ${r.min} min: ${st.done} jobs done, waits ${avg.toFixed(1)} s on average, ${max.toFixed(1)} s at most (want >= ${r.gate.done}, <= ${r.gate.waitAvgS} s${r.gate.waitMaxS < Infinity ? `, <= ${r.gate.waitMaxS} s` : ''})`);
    out.push(`${r.what} (${n}), ${r.min} min: ${st.done} jobs done, wait avg ${avg.toFixed(1)} s, max ${max.toFixed(1)} s; ${st.emptySteps} steps with a need at 0; the car busy ${(busy * 100).toFixed(0)} %, ${st.liftRides} rides, a landing wait at most ${(st.liftWaitMax / FPS).toFixed(1)} s`);
    noteUse(sim);
  }
  // (this part runs in a worker thread of its own, beside the rest: its line, its failures and its rooms' uses go back to
  // the main thread, which prints and counts them at the end)
  console.log(`  10 capacity: ${out.join('; ')}`);
}
if (ROLE === 'full') {
  // (C3) the full preset: forced 9 over the cap, starved, but moving -- jobs done, no keeper giving up, the car never
  // standing with work for a minute -- and its due egg waiting in its nest (the barn full: life.ts); in a worker of its
  // own (its 36 000 steps of 21 dragons crowding the landings take about 14 s)
  const out: string[] = [];
  {
    const sim = buildSim(startSpec('full'), 1), egg = sim.eggs[0], n = sim.dragons.length, { stuck } = watch(sim, 10), st = sim.stats;
    if (n !== 21 || !egg) fail(`capacity (full): ${n} dragons and ${egg ? 'an egg' : 'no egg'}, not 21 and a due egg`);
    if (st.done < FULL_DONE || st.waitTimeouts || stuck >= 60 * FPS) fail(`capacity (full): 10 minutes gave ${st.done} jobs done (want >= ${FULL_DONE}), ${st.waitTimeouts} keepers gave up, the car stood with work ${(stuck / FPS).toFixed(1)} s (want < 60)`);
    if (sim.eggs[0] !== egg || sim.dragons.length !== n || barnCount(sim) !== n) fail(`capacity (full): the barn 9 over its cap hatched its egg (${sim.dragons.length} dragons, ${sim.eggs.length} eggs)`);
    out.push(`the full preset (${n}, 9 over the cap), 10 min: ${st.done} jobs done, ${st.liftRides} rides, the car standing with work ${(stuck / FPS).toFixed(1)} s at most, ${st.waitTimeouts} keepers gave up, ${st.emptySteps} steps with a need at 0 (starved, as it must be), its due egg still waiting`);
    noteUse(sim);
  }
  console.log(`  10 over the cap: ${out.join('; ')}`);
}

if (ROLE === 'babies') {
  // (the S6b review) a barn of babies -- the late game's: the start's seven retired to the garden, hatchlings in their
  // places, any mix of BARN_CAP counts -- served, and two on their way to a landing kept in the order they stand; in a
  // worker of its own
  const out: string[] = [];
  // two walking up to the ground floor's west landing at one spot (a baby resting in the Grooming Parlour's sub-slot
  // beside it, so the line's best place clear of every eye lies behind them, and the nearest one drawn behind the baby
  // ahead of them): the one nearer the bay is placed nearer it, so neither walks back through the other -- placed the
  // other way round, the two passed each other, swapped and turned back every few steps, for minutes (4 grown and 8
  // babies, seed 3), or for ever (2 and 10, seed 2)
  {
    const by = (n: string) => START_DRAGONS.find((p) => p.name === n)!;
    const cast: DragonPlace[] = [by('EMBER'), { ...by('BRAMBLE'), slot: { room: 'romp', i: 0 } }, { name: 'BURR', element: 'spike', stage: 'baby', seed: 45, slot: { room: 'groom', i: 1 } }];
    const sim = new CareSim(START_ROOMS, cast, START_KEEPERS, { seed: 1 }), [e, b] = ['EMBER', 'BRAMBLE'].map((n) => sim.dragons.find((d) => d.name === n)!);
    for (const [d, x] of [[e, 344.3], [b, 343.95]] as const) { d.x = x; d.facing = 1; d.move = 'walk'; d.gaitT = 0; d.legs = [{ f: 0, x: LIFT_CX }, { f: 2, x: LIFT_CX }, { f: 2, x: 792 }]; }
    const line = landingLine(sim, 0, -1), places = line.map((w) => `${w.d.name} ${w.x.toFixed(1)}${w.back ? ' (drawn behind)' : ''}`).join(', ');
    if (line.length !== 2 || line[0].d !== e) fail(`landing line: EMBER at x 344.3 and BRAMBLE at 343.95 walking up to the west landing are placed ${places}: the nearer the bay not the nearer it`);
    const turns = new Map<Dragon, number>([[e, 0], [b, 0]]);
    for (let s = 0; s < 600; s++) {
      const was = [e.move, b.move];
      sim.step();
      [e, b].forEach((d, i) => { if (d.move === 'turn' && was[i] !== 'turn') turns.set(d, turns.get(d)! + 1); });
    }
    if (turns.get(e)! > 6 || turns.get(b)! > 6) fail(`landing line: EMBER turned ${turns.get(e)} times and BRAMBLE ${turns.get(b)} in 10 s walking up to one landing (want <= 6: not turned back and forth)`);
    out.push(`two walking up to a landing at one spot placed ${places}; in 10 s EMBER turned ${turns.get(e)} times, BRAMBLE ${turns.get(b)}`);
    noteUse(sim);
  }
  // four babies on the upper floor each resting in the room another wants (the start's seven but ZAP, whose Romp Room
  // they take): two in its Hearth Kitchen wanting play, two in its Romp Room wanting food. A baby with a job is never
  // moved on, and a job waits for its own floor's room -- until its need falls to SOON (travel.ts STAY_TIER): then a
  // room a floor away. Without that the four stood still for good from the first second, 45 264 need-steps at 0 in 20
  // minutes. 10 minutes: no need at 0, each of the four met for the need it wanted
  {
    const B = (name: string, element: DragonElement, room: RoomKind, i: number): DragonPlace => ({ name, element, stage: 'baby', seed: name.length * 7 + i, slot: { room, i, n: 1 }, days: 0 });
    const cast = [...START_DRAGONS.filter((p) => p.name !== 'ZAP'), B('KA', 'fire', 'kitchen', 1), B('KB', 'water', 'kitchen', 2), B('RA', 'rock', 'romp', 1), B('RB', 'spike', 'romp', 2)];
    const sim = new CareSim(START_ROOMS, cast, START_KEEPERS, { seed: 1 }), want: Record<string, NeedKind> = { KA: 'play', KB: 'play', RA: 'food', RB: 'food' };
    for (const d of sim.dragons) for (const k of NEEDS) if (hasNeed(d.element, k)) d.needs[k] = 1;
    for (const d of sim.dragons) if (d.name in want) d.needs[want[d.name]] = 0.3;
    const met = new Map<string, number>();
    for (let s = 0; s < 10 * 60 * FPS; s++) {
      sim.step();
      for (const d of sim.dragons) if (d.act && d.act.t === 0 && want[d.name] === d.act.need && !met.has(d.name)) met.set(d.name, sim.tick);
    }
    const st = sim.stats, missed = Object.keys(want).filter((n) => !met.has(n));
    if (st.emptySteps || missed.length) fail(`babies: four on the upper floor each resting in the room another wants -- ${st.emptySteps} need-steps at 0 in 10 minutes, ${missed.length ? `${missed.join(', ')} never met for ${missed.map((n) => want[n]).join(', ')}` : 'each met'} (want none at 0, each met)`);
    out.push(`four babies each resting in the room another wants: met at steps ${Object.keys(want).map((n) => `${n} ${met.get(n) ?? '-'}`).join(', ')}; ${st.emptySteps} need-steps at 0 in 10 min, ${st.done} jobs done`);
    noteUse(sim);
  }
  // the late game's barn: twelve babies (every grown dragon retired), packed as hatchlings leave the Hatchery -- its two
  // sub-slots, then the free ones room by room from the ground floor up, so every room of the ground floor holds two
  // babies. 30 minutes on seed 1, checked every step as the twelve (capacity.ts runOne): no need at 0, no stall -- one
  // held mid-walk, or turned about on one spot -- no invariant broken; the waits and the jobs done frozen with about
  // 20 % headroom (measured: BABIES_GATE). Before the S6b review the ground floor's babies, each wanting a room another
  // rested in, stood still: 3.1 M need-steps at 0, 83 jobs done
  {
    const rooms = placeRooms(START_ROOMS), nth = (r: (typeof rooms)[number]) => rooms.filter((q) => q.kind === r.kind).indexOf(r), places: DragonPlace[] = [];
    for (const r of [...rooms.filter((q) => q.kind === 'hatchery'), ...rooms.filter((q) => q.kind !== 'hatchery')]) for (const sl of r.slots) {
      if (!sl.baby || places.length >= BARN_CAP) continue;
      const element = DRAGON_ELEMENTS[places.length % DRAGON_ELEMENTS.length];
      places.push({ name: hatchName(new CareSim(START_ROOMS, places, []), element), element, stage: 'baby', seed: 700 + places.length, slot: { room: r.kind, i: sl.i, ...(nth(r) ? { n: nth(r) } : {}) }, days: 0 });
    }
    const run = runOne({ cast: 'babies', pattern: '12b', places, seed: 1, min: 30 }, (w) => noteUse(w)), G = BABIES_GATE;
    if (run.emptySteps || run.stalls || run.breaks) fail(`babies (twelve, packed from the ground floor): ${run.emptySteps} need-steps at 0 (${run.mostEmpty}), ${run.stalls} stalls, ${run.breaks} invariant breaks (${[...run.stallNotes, ...run.breakNotes].join('; ')})`);
    if (run.done < G.done || run.waitAvgS > G.waitAvgS || run.waitMaxS > G.waitMaxS) fail(`babies (twelve): ${run.done} jobs done in 30 minutes, waits ${run.waitAvgS.toFixed(1)} s on average, ${run.waitMaxS.toFixed(1)} s at most (want >= ${G.done}, <= ${G.waitAvgS} s, <= ${G.waitMaxS} s)`);
    out.push(`twelve babies packed from the ground floor, 30 min: ${run.emptySteps} steps with a need at 0; wait avg ${run.waitAvgS.toFixed(1)} s, max ${run.waitMaxS.toFixed(1)} s; ${run.done} jobs done; ${run.rides} rides; ${run.stalls} stalls, ${run.breaks} invariant breaks; ${run.evictions} moved on`);
  }
  console.log(`  10 babies: ${out.join('; ')}`);
}

// ---------- 23. care while a team is away (two keepers home are enough: BASE_DESIGN 5.3) ----------
if (ROLE === 'babies') {
  // (in this worker too: 30 minutes of the real day beside the rest.) THE LOST NEST's two pairs (RIPPLE and ECHO, with
  // their riders) sent at once, away 30 minutes (a test's own length: missions.ts send's awaySteps); from the send until
  // it lands, the five dragons home and the two keepers home: no need empties, no keeper gives up, a rider is never
  // given a job, and the waits keep section 2's gates -- the average within 25 % over its gate (BASE_DESIGN 5.2)
  const away = newSim(1), AWAY_STEPS = 30 * 60 * FPS;
  sendLostNest(away, { awaySteps: AWAY_STEPS });
  const trip = away.missions.trip!, riderIds = new Set(trip.pairs.map((p) => p.keeper));
  let awaySteps = 0, riderJobs = 0;
  for (let s = 0; s < AWAY_STEPS + 20000 && away.missions.trip?.state !== 'return'; s++) {
    away.step();
    if (away.missions.trip?.state === 'away') awaySteps++;
    for (const k of away.keepers) if (riderIds.has(k.id) && k.job) riderJobs++;
  }
  const ast = away.stats, aAvg = ast.waitSum / Math.max(1, ast.started) / FPS, aMax = ast.waitMax / FPS, aK = ast.keeperWaitSum / Math.max(1, ast.keeperWaits) / FPS;
  if (awaySteps !== AWAY_STEPS) fail(`away: the team was away ${awaySteps} steps, not ${AWAY_STEPS}`);
  if (riderJobs) fail(`away: a rider on the trip had a job for ${riderJobs} steps`);
  if (ast.emptySteps) fail(`away: a need at home sat at 0 for ${ast.emptySteps} dragon-steps with two keepers home`);
  if (ast.waitTimeouts) fail(`away: ${ast.waitTimeouts} keepers gave up waiting`);
  if (aAvg > GATE.waitAvgS * 1.25 || aMax > GATE.waitMaxS || aK > GATE.keeperWaitAvgS || ast.liftWaitMax / FPS > GATE.liftWaitS) fail(`away: jobs waited ${aAvg.toFixed(1)} s on average, ${aMax.toFixed(1)} s at most, keepers ${aK.toFixed(1)} s at the stand spot, a landing ${(ast.liftWaitMax / FPS).toFixed(1)} s (want <= ${GATE.waitAvgS * 1.25}, ${GATE.waitMaxS}, ${GATE.keeperWaitAvgS}, ${GATE.liftWaitS})`);
  noteUse(away);
  const awayLine = `  23 away: THE LOST NEST's two pairs away ${(awaySteps / FPS / 60).toFixed(0)} min of the real day (${away.tick} steps from the send to the landing), five dragons and two keepers home: ${ast.done} jobs done, wait avg ${aAvg.toFixed(1)} s (gate ${GATE.waitAvgS * 1.25}), max ${aMax.toFixed(1)} s, keepers at the stand spot ${aK.toFixed(1)} s, a landing ${(ast.liftWaitMax / FPS).toFixed(1)} s; ${ast.emptySteps} steps with a need at 0; no rider given a job`;
  console.log(awayLine);
}

// ---------- 11. the clock ----------
if (MAIN) {
  const lines: string[] = [];
  for (const dayLen of [DAY_STEPS, 600]) {
    const hs = hourSteps(dayLen), third = Math.ceil(hs / 3);
    const want = (clock: number, w: Partial<ClockRead>, what: string) => {
      const r = readClock(clock, dayLen);
      for (const [k, v] of Object.entries(w)) if (r[k as keyof ClockRead] !== v) fail(`clock (${dayLen}-step day): ${what} (clock ${clock}) reads ${k} ${r[k as keyof ClockRead]}, not ${v}`);
    };
    want(0, { day: 1, hour: 0, minute: 0, phase: 'night', blend: 3 }, 'midnight of day 1');
    want(5 * hs, { day: 1, hour: 5, phase: 'dawn', prev: 'night', blend: 0 }, 'dawn');
    want(5 * hs + third - 1, { phase: 'dawn', blend: 0 }, 'dawn, a third of an hour less a step');
    want(5 * hs + third, { phase: 'dawn', blend: 1 }, 'dawn, a third of an hour in');
    want(5 * hs + 2 * third, { phase: 'dawn', blend: 2 }, 'dawn, two thirds of an hour in');
    want(6 * hs, { phase: 'dawn', blend: 3 }, 'dawn, an hour in');
    want(7 * hs, { hour: 7, minute: 0, phase: 'day', prev: 'dawn', blend: 0 }, 'day');
    want(18 * hs, { hour: 18, phase: 'dusk', prev: 'day', blend: 0 }, 'dusk');
    want(20 * hs, { hour: 20, phase: 'night', prev: 'dusk', blend: 0 }, 'night');
    want(24 * hs, { day: 2, hour: 0, minute: 0, phase: 'night', blend: 3 }, 'midnight of day 2');
    want(24 * hs - 1, { day: 1, hour: 23, minute: Math.floor((hs - 1) * 60 / hs), phase: 'night' }, 'the last step of day 1');
    // a whole day, step by step: the phases in the day's order, each turning in once (blend 0, 1, 2, 3, never back),
    // the hour and the minute never going back within the day
    let last = readClock(0, dayLen), turns = 0;
    const walls = new Set<number>();
    for (let c = 1; c < dayLen; c++) {
      const r = readClock(c, dayLen);
      if (r.phase !== last.phase) {
        turns++;
        if (PHASE_ORDER[(PHASE_ORDER.indexOf(last.phase) + 1) % 4] !== r.phase || r.prev !== last.phase || r.blend !== 0) fail(`clock (${dayLen}): at ${c} the phase turned ${last.phase} -> ${r.phase} (prev ${r.prev}, blend ${r.blend})`);
      } else if (r.blend < last.blend) fail(`clock (${dayLen}): at ${c} the ${r.phase}'s sky turned back (blend ${last.blend} -> ${r.blend})`);
      if (r.hour * 60 + r.minute < last.hour * 60 + last.minute) fail(`clock (${dayLen}): at ${c} the time went back`);
      // (the sky at blend 0 is the phase before's, at 3 its own)
      const bands = skyBands(r);
      if (r.blend === 0 && bands.join() !== BACKDROPS.sky[r.prev].join()) fail(`clock: the sky at the start of the ${r.phase} is not the ${r.prev}'s`);
      if (r.blend === 3 && bands.join() !== BACKDROPS.sky[r.phase].join()) fail(`clock: the sky an hour into the ${r.phase} is not its own`);
      // the lights and the icon follow the sky (sky.ts lightsOf): as the step before at a phase's first step (the sky
      // is still the phase before's), all on while any star is out, all off (and the sun) under the day's own sky, the
      // moon exactly while the sky is mostly night's
      const lit = lightsOf(r), was = lightsOf(last), what = `${clockLabel(r)} (${r.phase} ${r.blend}/3)`;
      if (r.phase !== last.phase && !isDeepStrictEqual(lit, was)) fail(`clock (${dayLen}): at ${what} the lights or the icon switched with the phase, not the sky: ${JSON.stringify(was)} -> ${JSON.stringify(lit)}`);
      if (nightness(r) > 0 && !(lit.slits && lit.rings > 0 && lit.hearth && lit.skylight)) fail(`clock: at ${what} the stars are out but the lights are ${JSON.stringify(lit)}`);
      if (bands.join() === BACKDROPS.sky.day.join() && (lit.slits || lit.rings || lit.hearth || lit.skylight || lit.icon !== 'sun')) fail(`clock: at ${what} the sky is the day's but the lights are ${JSON.stringify(lit)}`);
      if ((lit.icon === 'moon') !== (nightness(r) >= 2)) fail(`clock: at ${what} the icon is the ${lit.icon} with the night ${nightness(r)}/3 in the sky`);
      // (plan S6c: the walls' night step turns with the lamps -- the dorm's rings -- in the same thirds: none under the
      // day's own sky, all the way under the night's own, never behind the stars)
      if (lit.walls < lit.rings || (lit.rings < 2 && lit.walls !== lit.rings)) fail(`clock: at ${what} the walls are at night step ${lit.walls} with the lamps' rings at ${lit.rings}`);
      if (bands.join() === BACKDROPS.sky.day.join() && lit.walls !== 0) fail(`clock: at ${what} the sky is the day's but the walls are at night step ${lit.walls}`);
      if (bands.join() === BACKDROPS.sky.night.join() && lit.walls !== 3) fail(`clock: at ${what} the sky is the night's but the walls are at night step ${lit.walls}`);
      if (lit.walls < nightness(r)) fail(`clock: at ${what} the stars are out ${nightness(r)}/3 but the walls only ${lit.walls}/3`);
      walls.add(lit.walls);
      last = r;
    }
    if (turns !== 4) fail(`clock (${dayLen}): the phase turned ${turns} times from midnight to midnight, not 4 (night to dawn, day, dusk, and night again at 20:00)`);
    if ([...walls].sort().join() !== '0,1,2,3') fail(`clock (${dayLen}): the walls were drawn at night steps ${[...walls].sort().join(', ')} over a day, not 0 to 3`);
    lines.push(`${dayLen}-step day (an hour ${hs} steps): ${[0, 5 * hs, 5 * hs + third, 7 * hs, 18 * hs, 20 * hs, 24 * hs].map((c) => { const r = readClock(c, dayLen); return `${c} ${clockLabel(r)} ${r.phase}${r.blend < 3 ? ` ${r.blend}/3` : ''}`; }).join(', ')}`);
  }
  if (clockLabel(readClock(2 * DAY_STEPS + 14 * 450 + 278, DAY_STEPS)) !== 'DAY 3 14:30') fail(`clock: 14:37 on day 3 reads ${clockLabel(readClock(2 * DAY_STEPS + 14 * 450 + 278))}, not DAY 3 14:30`);
  // the top bar: the clock, a space, then JOBS (two digits), all before the keepers' badges, from day 1 to day 99 999
  const bar: string[] = [];
  for (const day of [1, 9, 10, 99, 100, 999, 1000, 9999, 10000, 99999]) {
    const label = clockLabel(readClock((day - 1) * DAY_STEPS + 23 * 450 + 449)), x = jobsAt(label), end = x + measureText('JOBS 99');
    if (x < CLOCK_X + measureText(label) + 7 || end > BADGE_X0 - 3) fail(`clock: the top bar's '${label}' puts JOBS at x ${x}, ending at ${end} (want a space after the clock, and the end by ${BADGE_X0 - 3})`);
    if (day === 99 || day === 100 || day === 99999) bar.push(`'${label}' JOBS at ${x}`);
  }
  // a world's start: 07:00 by default, any whole hour by SimOptions.hour, and nothing else
  const at = (hour?: number, dayLen?: number) => new CareSim(START_ROOMS, START_DRAGONS, START_KEEPERS, { hour, dayLen });
  if (at().clock !== 7 * 450 || at(22).clock !== 22 * 450 || at(22, 600).clock !== 22 * 25 || readClock(at(22).clock).phase !== 'night') fail(`clock: worlds start at ${at().clock}, ${at(22).clock}, ${at(22, 600).clock}, not 07:00 and 22:00`);
  for (const bad of [-1, 24, 7.5]) { try { at(bad); fail(`clock: a world started at hour ${bad}`); } catch { /* as it should */ } }
  console.log(`  11 clock: ${lines.join('; ')}; a whole day read step by step turns night, dawn, day, dusk, night, each sky in three stepped thirds, the lights, the icon and the walls' night steps (0 to 3) with it; the top bar ${bar.join(', ')}; hour= starts a world at 22:00`);
}

// ---------- 12. night is not the barn's ----------
if (MAIN) {
  const day = new CareSim(START_ROOMS, START_DRAGONS, START_KEEPERS, { seed: 1, hour: 7 });
  const eve = new CareSim(START_ROOMS, START_DRAGONS, START_KEEPERS, { seed: 1, hour: 19 });
  let checked = 0;
  for (let s = 1; s <= 20000; s++) {
    day.step(); eve.step();
    if (s % 1000 === 0) {
      checked++;
      if (barnKey(day) !== barnKey(eve)) { fail(`night: the barn started at 07:00 and the one started at 19:00 differ at step ${s}`); break; }
    }
  }
  if (day.clock === eve.clock || day.digest() === eve.digest()) fail('night: the two worlds should differ in their clocks (and so their saves)');
  const phases = new Set<string>();
  for (let s = 0; s <= 20000; s += 450) phases.add(readClock(eve.clock0 + s).phase);
  // (the simulation's own modules: none reads the phase, the hour or the sky; only the view does -- and garden.ts and
  // missions.ts, which are not in this list on purpose: plan G8's two exceptions, the residents' naps and the Map Room's
  // board rolled at dawn (05:00); each keeps its state out of barnKey (a world's missions are not the barn's care, and
  // without a trip sent nothing they do touches it), and these modules only call into them)
  // (control.ts runs inside CareSim.step -- the hand's commands -- and tripdemo.ts builds the trip preset's team: S7, S9)
  const SIM_FILES = ['sim.ts', 'travel.ts', 'needs.ts', 'layout.ts', 'gait.ts', 'save.ts', 'start.ts', 'presets.ts', 'rand.ts', 'life.ts', 'names.ts', 'control.ts', 'tripdemo.ts'];
  const reads = SIM_FILES.filter((f) => /\b(readClock|phaseOf|PHASE_HOURS|PHASE_ORDER|DayPhase|skyBands|nightness|dimness|skyPhase|lightsOf)\b/.test(fs.readFileSync(new URL(`../src/game/${f}`, import.meta.url), 'utf8')));
  if (reads.length) fail(`night: ${reads.join(', ')} read the day's phase (only the view may: plan G8)`);
  console.log(`  12 night: a barn started at 07:00 and one at 19:00 (seed 1) agree on barnKey at all ${checked} checks over 20000 steps, through ${[...phases].join(', ')}; ${SIM_FILES.length} simulation modules, none reading the day's phase`);
  noteUse(day); noteUse(eve);
}

// ---------- 13. growing up: a month a stage (#8) ----------
if (MAIN) {
  const SHORT = 600, LEN = STAGE_DAYS * SHORT;
  const BURR: DragonPlace = { name: 'BURR', element: 'spike', stage: 'baby', seed: 45, slot: { room: 'hatchery', i: 0 } };
  const where = (w: CareSim, d: Dragon) => (d.slot ? `${w.rooms[d.slot.room].kind}:${d.slot.i}` : 'no slot');
  const LEN_OF = (w: CareSim) => STAGE_DAYS * w.dayLen;
  /**
   * Step a world, checking every grow event as it comes: the stage it grew into is the next, its stage's start moved on
   * exactly one stage's length, and the dragon was settled as the step began (no keeper on any of its jobs, no route
   * left, standing still in a slot its new stage fits, and no act but one ending that step: life runs after the acts)
   * with room to grow (no keeper where its new body is: life.ts inTheWayOfGrowing); the step after, each need not being
   * met drains at the new stage's rate; and it cheers: it holds exactly its new stage's `happy` (gait.ts happyLen), and
   * all that while it stands where it grew -- no route, no walk or turn, no act, no keeper coming for it -- so the view's
   * `happy` plays through. And as it goes: every slot held fits its dragon's stage -- or, a baby on its way to grow up
   * (goal `settle`), its next stage's -- and a module holds one grown dragon (such a baby counted as one) or two babies.
   * (`each` runs before every step: a scenario's own doings.)
   */
  const run = (w: CareSim, steps: number, what: string, done: () => boolean, each: () => void = () => {}) => {
    const was = new Map(w.dragons.map((d) => [d.id, { stage: d.stage, since: d.stageSince }]));
    const grew: { t: number; d: Dragon; stage: string; at: string; delay: number }[] = [], walked = new Set<Dragon>();
    const cheering = new Map<Dragon, { until: number; x: number }>();
    let after: { d: Dragon; needs: Needs }[] = [], drains = 0, cheers = 0;
    // (a run ends when it is done and every cheer under way has played out)
    for (let s = 1; s <= steps && !(done() && !cheering.size); s++) {
      each();
      // (each dragon due by this step, as the step begins: whether it is settled -- life runs after the acts)
      const pre = new Map<Dragon, string>();
      for (const d of w.dragons) {
        const next = nextStage(d.stage);
        if (!next || stageDue(w, d) > w.clock + 1) continue;
        const why = [d.act && d.act.t + 1 < d.act.len ? `act ${d.act.need}` : '', d.legs.length ? `${d.legs.length} legs` : '', d.move !== 'still' ? d.move : '', d.turn >= 0 ? 'turning' : '',
          w.lift.rider === d.id ? 'the lift\'s rider' : '', w.jobs.some((j) => j.dragon === d && j.keeper) ? `${w.jobs.find((j) => j.dragon === d && j.keeper)!.keeper!.name} on it` : '',
          !d.slot || !fitsSlot(d.slot, next) || d.x !== d.slot.x || d.f !== d.slot.f ? `in the ${where(w, d)}` : '', inTheWayOfGrowing(w, d, next) ? `${inTheWayOfGrowing(w, d, next)} where it grows` : ''].filter(Boolean);
        pre.set(d, why.join(', '));
      }
      w.step();
      for (const { d, needs } of after) for (const k of NEEDS) {
        if (!hasNeed(d.element, k) || (d.act && d.act.need === k) || needs[k] < 0.01) continue;
        drains++;
        const got = needs[k] - d.needs[k], want = drainRate(d.element, d.stage, k);
        if (Math.abs(got - want) > 1e-12) fail(`grow (${what}): ${d.name}'s ${k} drained ${got} the step after it grew ${d.stage}, not ${want}`);
      }
      after = [];
      for (const [d, c] of cheering) {
        if (w.tick >= c.until) { cheering.delete(d); cheers++; continue; }
        const j = w.jobs.find((q) => q.dragon === d && q.keeper);
        if (d.legs.length || d.move !== 'still' || d.act || d.x !== c.x || j || d.hold !== c.until - w.tick) { fail(`grow (${what}), step ${w.tick}: ${d.name}, ${c.until - w.tick} steps of its cheer left (hold ${d.hold}), is ${d.move}${d.legs.length ? ` with ${d.legs.length} legs` : ''}${d.act ? `, ${d.act.need} under way` : ''}${j ? `, ${j.keeper!.name} coming` : ''}`); cheering.delete(d); }
      }
      for (const d of w.dragons) {
        if (d.goal === 'settle' && d.legs.length) walked.add(d);
        const sl = d.slot, next = nextStage(d.stage);
        if (sl && !fitsSlot(sl, d.stage) && !(d.goal === 'settle' && next && fitsSlot(sl, next))) fail(`grow (${what}), step ${w.tick}: ${d.name} (${d.stage}, goal ${d.goal}) holds the ${where(w, d)}, which it doesn't fit`);
      }
      if (s % 30 === 0) {
        const mods = new Map<string, { grown: number; babies: number }>();
        for (const d of w.dragons) if (d.slot) {
          const key = `${d.slot.room}/${d.slot.mod}`, m = mods.get(key) ?? { grown: 0, babies: 0 };
          if (d.slot.baby) m.babies++; else m.grown++;
          mods.set(key, m);
          if (m.grown > 1 || m.babies > 2 || (m.grown && m.babies)) fail(`grow (${what}), step ${w.tick}: module ${d.slot.mod} of the ${w.rooms[d.slot.room].kind} holds ${m.grown} grown and ${m.babies} babies`);
        }
        for (const d of w.dragons) if (d.move !== 'ride' && spanOf(d.f, d.x, w.nets.dragon[d.stage]) < 0) fail(`grow (${what}), step ${w.tick}: ${d.name} (${d.stage}) stands off its floor at f${d.f} x ${d.x.toFixed(1)}`);
      }
      for (const e of w.events) {
        if (e.kind !== 'grow') continue;
        const d = w.dragons.find((q) => q.id === e.dragon)!, was0 = was.get(d.id)!;
        if (e.stage !== nextStage(was0.stage) || d.stage !== e.stage) fail(`grow (${what}): ${d.name} grew from ${was0.stage} into ${e.stage} (now ${d.stage})`);
        // (a stage begins exactly one stage's length after the last -- but the elder stage, which has no next to keep in
        // step with, begins the step it grows: its 30 days to the garden are its own, however late the stage-up)
        const began = e.stage === 'elder' ? w.clock : was0.since + LEN_OF(w);
        if (d.stageSince !== began) fail(`grow (${what}): ${d.name}'s ${e.stage} stage began at clock ${d.stageSince}, not ${began} (${e.stage === 'elder' ? 'the step it grew' : `exactly ${STAGE_DAYS} days after the last began`})`);
        if (pre.get(d) !== '') fail(`grow (${what}): ${d.name} grew ${e.stage} unsettled (${pre.get(d) ?? 'not due'})`);
        grew.push({ t: w.tick, d, stage: e.stage, at: where(w, d), delay: w.clock - (was0.since + LEN_OF(w)) });
        was.set(d.id, { stage: d.stage, since: d.stageSince });
        after.push({ d, needs: { ...d.needs } });
        if (d.hold !== happyLen(d.element, d.stage)) fail(`grow (${what}): ${d.name} grew ${d.stage} holding ${d.hold}, not its happy's ${happyLen(d.element, d.stage)} steps`);
        cheering.set(d, { until: w.tick + d.hold, x: d.x });
      }
    }
    return { grew, walked, drains, cheers };
  };
  // (a) alone: a baby in the Hatchery grows young, adult and elder, each 30 short days after the last
  const alone = new CareSim(START_ROOMS, [BURR], START_KEEPERS, { seed: 1, dayLen: SHORT }), burr = alone.dragons[0];
  const a = run(alone, 3 * LEN + GROW_ALONE + 60, 'alone', () => burr.stage === 'elder');
  if (a.grew.map((g) => g.stage).join() !== 'young,adult,elder') fail(`grow (alone): BURR grew ${a.grew.map((g) => g.stage).join(', ') || 'never'}, not young, adult, elder once each`);
  const eld = a.grew[2];
  if (!eld || burr.stageSince !== alone.clock0 + 3 * LEN + eld.delay) fail(`grow (alone): BURR's elder stage began at clock ${burr.stageSince}, not ${alone.clock0 + 3 * LEN + (eld?.delay ?? 0)} (two stages of exactly ${LEN} steps, then the step it grew elder)`);
  if (alone.stats.growDelayMax > GROW_ALONE) fail(`grow (alone): a stage-up waited ${alone.stats.growDelayMax} steps to be applied (want <= ${GROW_ALONE})`);
  const young = a.grew[0];
  if (!young || !a.walked.has(burr) || young.at.startsWith('hatchery') || young.at.endsWith(':') || !young.d.slot || young.d.slot.baby) fail(`grow (alone): BURR grew young in the ${young?.at ?? '-'}${a.walked.has(burr) ? '' : ', never walking to a module slot first'}`);
  noteUse(alone);
  // (b) the busy barn: the start's seven adults (and BURR) fall due a few seconds apart, every one mid-errand in a barn
  // whose one car is nearly always busy (4.7); each grows once, settled, within an errand
  const cast: DragonPlace[] = [...START_DRAGONS.map((p, i) => ({ ...p, days: STAGE_DAYS - (600 + 300 * i) / SHORT })), { ...BURR, days: STAGE_DAYS - 3000 / SHORT }];
  const busy = new CareSim(START_ROOMS, cast, START_KEEPERS, { seed: 1, dayLen: SHORT });
  const b = run(busy, 3000 + GROW_BUSY + 600, 'busy', () => busy.dragons.every((d) => d.stage === (d.name === 'BURR' ? 'young' : 'elder')));
  for (const d of busy.dragons) if (b.grew.filter((g) => g.d === d).length !== 1) fail(`grow (busy): ${d.name} grew ${b.grew.filter((g) => g.d === d).length} times, not once (${d.stage} after ${busy.tick} steps)`);
  if (busy.stats.growDelayMax > GROW_BUSY) fail(`grow (busy): a stage-up waited ${busy.stats.growDelayMax} steps to be applied (want <= ${GROW_BUSY}: one errand)`);
  noteUse(busy);
  // (c) the real day: EMBER 30 days less a minute into adulthood is an elder a minute (and at most one more) on
  const real = new CareSim(START_ROOMS, START_DRAGONS.map((p) => (p.name === 'EMBER' ? { ...p, days: STAGE_DAYS - 1 / 60 } : p)), START_KEEPERS, { seed: 1 });
  const ember = real.dragons[0], since0 = ember.stageSince, dueIn = stageDue(real, ember) - real.clock;
  let at = -1;
  for (let s = 1; s <= 180 + GROW_REAL && at < 0; s++) {
    real.step();
    for (const e of real.events) if (e.kind === 'grow') { if (e.dragon === ember.id) at = s; else fail(`grow (real): ${real.dragons.find((q) => q.id === e.dragon)?.name} grew too`); }
  }
  if (dueIn !== 180 || at < 180 || ember.stage !== 'elder' || since0 + STAGE_DAYS * DAY_STEPS !== real.clock0 + 180 || ember.stageSince !== real.clock0 + at) fail(`grow (real): EMBER, due in ${dueIn} steps, is ${ember.stage}${at > 0 ? ` from step ${at}` : ''} (want an elder from step 180 to ${180 + GROW_REAL}, its adult stage ${STAGE_DAYS} days of ${DAY_STEPS} steps, its elder stage begun the step it grew)`);
  noteUse(real);
  // (d) a baby walking to grow up, asked for by a need in the room it is going to (its module slot's room) and Rushed
  // there -- or choosing it at a landing while the car serves another: either way travel.ts goFor gives it a slot in
  // that room -- is served there in a baby's sub-slot, never in the module slot, which a baby doesn't fit (run's check,
  // every step), then grows up, settled in a module slot. Every module slot on the Hatchery's floor (the hayloft's, in the
  // repeated-room barn) is taken, so BURR's is downstairs, a ride away.
  const up = ([['EMBER', 'kitchen', 2], ['ZAP', 'groom', 2], ['RIPPLE', 'dorm', 2]] as const)
    .map(([n, room, k]): DragonPlace => ({ ...START_DRAGONS.find((p) => p.name === n)!, slot: { room, i: 0, n: k } }));
  const call = new CareSim(START_ROOMS, [...up, { ...BURR, days: STAGE_DAYS }], START_KEEPERS, { seed: 1, dayLen: SHORT }), cb = call.dragons[up.length];
  for (const d of call.dragons) for (const k of NEEDS) if (hasNeed(d.element, k)) d.needs[k] = 1;
  let called = '', served = '', rushed = false, asked: NeedKind | null = null;
  const c = run(call, 12000, 'called', () => cb.stage === 'young', () => {
    if (!asked && cb.goal === 'settle' && cb.move === 'walk' && cb.slot) {
      asked = NEEDS.find((k) => NEED_ROOM[k] === call.rooms[cb.slot!.room].kind && hasNeed(cb.element, k)) ?? null;
      if (asked) { cb.needs[asked] = 0.3; called = `${asked}, for the ${where(call, cb)} it was going to`; }
    }
    const j = asked && !rushed ? call.jobs.find((q) => q.dragon === cb && q.need === asked) : null;
    if (j) { call.rush(j); rushed = true; }
    if (called && !served && cb.act && cb.slot) served = `${cb.act.need} in the ${where(call, cb)} (${cb.slot.baby ? 'a sub-slot' : 'a module slot'})`;
  });
  const cy = c.grew.find((g) => g.d === cb);
  if (!called || !rushed || !served.endsWith('(a sub-slot)') || !cy || cy.d.slot?.baby) fail(`grow (called): BURR ${called ? `was called (${called}), ${rushed ? 'Rushed' : 'not Rushed'}, served ${served || 'never'}, grew ${cy ? `young in the ${cy.at}` : 'never'}` : 'never walked to grow up'}`);
  noteUse(call);
  const fmt = (r: typeof b) => r.grew.map((g) => `${g.d.name} ${g.stage} ${g.delay}`).join(', ');
  console.log(`  13 growing up: alone (a ${SHORT}-step day), BURR grew ${a.grew.map((g) => `${g.stage} at step ${g.t} (${g.at}, ${g.delay} late)`).join(', ')}, each stage exactly ${LEN} steps after the last, walking out of the Hatchery to a module slot first; ${a.drains + b.drains} needs drained at the new stage's rate the step after; ${a.cheers + b.cheers + c.cheers} grow-ups held for their happy, none moved on or met meanwhile, none with a keeper where it grew; the busy barn (seven adults and BURR falling due 5 s apart), steps late: ${fmt(b)} (at most ${busy.stats.growDelayMax}, gate ${GROW_BUSY}); the real day (${DAY_STEPS} steps), EMBER ${STAGE_DAYS} days less a minute in grew an elder at step ${at} (due at 180); Rushed on its way to grow up (${called}), BURR was served ${served} and grew young in the ${cy?.at ?? '-'}, ${cy?.delay ?? '-'} late`);
}

// ---------- 14. eggs and hatching (#5.4, the Hatchery) ----------
if (MAIN) {
  const SHORT = 600, H = HATCH_DAYS * SHORT;
  const seedOf = (w: CareSim, id: number) => (mix32(w.seed, TAG.EGG, id) & 0x7fffffff) || 1;
  /** The new game on a short day with three eggs laid at once (rock, dusk, water), stepped until all three have hatched; each hatch as it came. */
  const hatchRun = () => {
    const w = new CareSim(START_ROOMS, START_DRAGONS, START_KEEPERS, { seed: 1, dayLen: SHORT }), laid = w.clock;
    const eggs = (['rock', 'dusk', 'water'] as const).map((el) => w.addEgg(el));
    const hatched: { t: number; d: Dragon; egg: number; at: string; job: number | null }[] = [];
    for (let s = 1; s <= H + 60 && w.eggs.length; s++) {
      w.step();
      for (const e of w.events) if (e.kind === 'hatch') {
        const d = w.dragons.find((q) => q.id === e.dragon)!, job = w.jobs.find((j) => j.dragon === d && j.need === 'food');
        hatched.push({ t: w.clock - laid, d, egg: e.egg, at: d.slot ? `${w.rooms[d.slot.room].kind}:${d.slot.i}` : 'no slot', job: job ? job.id : null });
        if (d.stage !== 'baby' || d.stageSince !== w.clock || d.seed !== seedOf(w, e.egg) || d.needs.food !== HATCH_FOOD || !d.slot?.baby) fail(`eggs: egg ${e.egg} hatched into ${d.name}, ${d.stage}, its stage from ${d.stageSince} (now ${w.clock}), seed ${d.seed} (the egg's ${seedOf(w, e.egg)}), food ${d.needs.food.toFixed(3)}, in the ${hatched[hatched.length - 1].at}`);
      }
    }
    return { w, eggs, laid, hatched };
  };
  const r = hatchRun(), w = r.w;
  // the nests: three eggs fill them, in order; a fourth is not taken (and not counted)
  if (r.eggs.some((e, i) => !e || e.nest !== i || e.id !== i)) fail(`eggs: three eggs went to nests ${r.eggs.map((e) => e?.nest).join(', ')}, not 0, 1, 2`);
  {
    const x = new CareSim(START_ROOMS, START_DRAGONS, START_KEEPERS, { seed: 1, dayLen: SHORT });
    for (const el of ['rock', 'dusk', 'water'] as const) x.addEgg(el);
    const used = x.stats.used.hatchery;
    if (x.addEgg('fire') !== null || x.eggs.length !== 3 || x.nextEggId !== 3 || used !== 3 || x.stats.used.hatchery !== 3) fail(`eggs: a fourth egg in three full nests was taken (${x.eggs.length} eggs, next id ${x.nextEggId}, the hatchery used ${x.stats.used.hatchery} times)`);
  }
  // each hatched exactly two days after it was laid, into a new dragon: ids after the start's, its element's first free
  // name, the egg's seed, a baby sub-slot (the Hatchery's two first); its food job open at once, and fed within 3 minutes
  const want = ['PEBBLE', 'GLOAM', 'SPLASH'];
  if (r.hatched.length !== 3) fail(`eggs: ${r.hatched.length} of 3 eggs hatched by ${H + 60} steps`);
  r.hatched.forEach((h, i) => {
    if (h.t !== H || h.d.id !== START_DRAGONS.length + i || h.d.name !== want[i] || h.egg !== i) fail(`eggs: egg ${h.egg} hatched ${h.t} steps after it was laid (want ${H}) into ${h.d.name} (id ${h.d.id}; want ${want[i]}, id ${START_DRAGONS.length + i})`);
    if (h.job == null) fail(`eggs: ${h.d.name} hatched with no food job open`);
  });
  // (the three hatch the same step, in id order: two take the Hatchery's two sub-slots, the other one elsewhere -- the
  // middle nest's, since the hatchery:1 would stand in front of the last nest's egg, still there: the hayloft's slope, BASE_DESIGN 3)
  if (r.hatched.filter((h) => h.at.startsWith('hatchery:')).length !== 2 || new Set(r.hatched.map((h) => h.at)).size !== 3) fail(`eggs: the babies went to ${r.hatched.map((h) => h.at).join(', ')}, not the Hatchery's two sub-slots and one elsewhere`);
  if (new Set(w.dragons.map((d) => d.name)).size !== w.dragons.length) fail('eggs: two dragons share a name');
  const fedIn = new Map<Dragon, number>();
  for (let s = 1; s <= 3 * 60 * FPS && fedIn.size < r.hatched.length; s++) {
    w.step();
    for (const h of r.hatched) if (!fedIn.has(h.d) && !w.jobs.some((j) => j.id === h.job)) fedIn.set(h.d, s);
  }
  for (const h of r.hatched) if (!fedIn.has(h.d)) fail(`eggs: ${h.d.name} was not fed within 3 minutes of hatching (a baby's first job is its food)`);
  noteUse(w);
  // two runs: the same names and seeds
  const again = hatchRun();
  if (again.hatched.map((h) => `${h.d.name}/${h.d.seed}`).join() !== r.hatched.map((h) => `${h.d.name}/${h.d.seed}`).join()) fail('eggs: two runs hatched different names or seeds');
  // every baby sub-slot taken, the barn under its cap (BASE_DESIGN 4.7: in the start barn a sub-slot is always free under the
  // cap -- 13 grown modules -- so a small barn: one kitchen, EMBER in its module slot, and the Hatchery, a baby in each
  // sub-slot; everyone's needs full so nobody moves): the due egg waits in its nest, nothing lost; one baby goes out (as
  // one will to the garden or on a trip: S6, S8), and the egg hatches into its sub-slot the step it frees
  const TINY: readonly RoomPlace[] = [{ kind: 'kitchen', part: 'barn', floor: 0, mod: 0 }, { kind: 'hatchery', part: 'barn', floor: 2, mod: 0 }];
  const tinyCast: DragonPlace[] = [START_DRAGONS[0], ...[0, 1].map((i): DragonPlace => ({ name: ['BURR', 'PEBBLE'][i], element: (['spike', 'rock'] as const)[i], stage: 'baby', seed: 45 + i, slot: { room: 'hatchery', i } }))];
  const full = new CareSim(TINY, tinyCast, [START_KEEPERS[0]], { seed: 1, dayLen: SHORT });
  full.addEgg('fire', full.clock - H);
  for (const d of full.dragons) for (const k of NEEDS) if (hasNeed(d.element, k)) d.needs[k] = 1;
  const n0 = full.dragons.length, egg = full.eggs[0], probe = { ...full.dragons.find((d) => d.stage === 'baby')!, id: -1, slot: null };
  if (!egg || full.clock - egg.laid < H || nearestFree(full, probe) !== null || barnFull(full)) fail('eggs: the small barn has no due egg, a baby sub-slot free, or no room under the cap');
  let early = 0;
  for (let s = 1; s <= H; s++) { full.step(); if (full.events.some((e) => e.kind === 'hatch')) early++; }
  if (early || full.eggs.length !== 1 || full.eggs[0] !== egg || full.dragons.length !== n0 || full.dragons.some((d) => !d.slot)) fail(`eggs: with every sub-slot taken the egg ${early ? 'hatched' : full.eggs.length ? 'was kept' : 'was lost'} (${full.eggs.length} eggs, ${full.dragons.length} dragons of ${n0})`);
  const out = full.dragons.findIndex((d) => d.slot && full.rooms[d.slot.room].kind === 'hatchery' && !d.legs.length && !full.jobs.some((j) => j.dragon === d));
  const freed = full.dragons[out]?.slot;
  full.dragons.splice(out, 1);
  full.step();
  const baby = full.dragons.find((d) => full.events.some((e) => e.kind === 'hatch' && e.dragon === d.id));
  if (!baby || baby.slot !== freed || full.eggs.length || full.dragons.length !== n0) fail(`eggs: a sub-slot freed, the waiting egg ${baby ? `hatched into the ${baby.slot ? full.rooms[baby.slot.room].kind : '-'}:${baby.slot?.i}, not the freed one` : 'did not hatch'} (${full.eggs.length} eggs, ${full.dragons.length} dragons)`);
  noteUse(full);
  // and the `full` preset (21 dragons, 9 over the cap: life.ts BARN_CAP): a sub-slot freed there is not room enough --
  // its due egg waits while the barn is full (the cap itself: section 26)
  {
    const sp = startSpec('full'), over = new CareSim(sp.rooms, sp.dragons, sp.keepers, { seed: 1, dayLen: SHORT });
    sp.after!(over);
    for (const d of over.dragons) for (const k of NEEDS) if (hasNeed(d.element, k)) d.needs[k] = 1;
    const i = over.dragons.findIndex((d) => d.slot && over.rooms[d.slot.room].kind === 'hatchery');
    over.dragons.splice(i, 1);
    for (let s = 0; s < 60; s++) over.step();
    if (over.eggs.length !== 1 || over.dragons.length !== 20 || !barnFull(over)) fail(`eggs: the full preset, 20 dragons and a sub-slot freed, hatched its egg (${over.eggs.length} eggs, ${over.dragons.length} dragons) though the barn is over its cap`);
    noteUse(over);
  }
  // a hatchling takes the Hatchery's sub-slot nearest its own nest, one in front of no other egg first -- under the
  // hayloft's slope (BASE_DESIGN 3) the hatchery:0 (x 228) stands in front of nest 0, the hatchery:1 (x 288) in front of
  // nests 1 and 2 -- and never stands in front of another's egg while a sub-slot is free elsewhere: the middle nest's
  // egg, a newer one in nest 0, hatches into the hatchery:1 (its own nest and the empty last one); the first nest's,
  // eggs in the other two, into the hatchery:0; the last nest's, eggs in the other two (either sub-slot would hide one),
  // into a sub-slot out of the Hatchery (the hayloft's kitchen next door: it is hungry anyway)
  const nearRun = (eggs: readonly [DragonElement, boolean][]) => {
    const w = new CareSim(START_ROOMS, START_DRAGONS, START_KEEPERS, { seed: 1, dayLen: SHORT });
    for (const [el, due] of eggs) w.addEgg(el, due ? w.clock - H : w.clock);
    w.step();
    const d = w.dragons.find((q) => w.events.some((e) => e.kind === 'hatch' && e.dragon === q.id)), room = w.rooms.find((r) => r.kind === 'hatchery')!;
    const [b0, b1] = d?.slot ? slotBody(d.slot, 'baby') : [0, 0], hides = !!d?.slot && d.slot.f === room.floor && w.eggs.some((e) => nestX(room, e.nest) >= b0 && nestX(room, e.nest) <= b1);
    noteUse(w);
    return { d, at: d?.slot ? `${w.rooms[d.slot.room].kind}:${d.slot.i}` : '-', left: w.eggs.length, hides };
  };
  const { d: hn, at: hnAt, left: hnLeft, hides: hnHides } = nearRun([['fire', false], ['dusk', false], ['spike', true]]);
  if (!hn || hnAt.startsWith('hatchery') || hnHides || hnLeft !== 2) fail(`eggs: the egg in nest 2, eggs in nests 0 and 1, hatched into ${hn ? `${hn.name} in the ${hnAt}${hnHides ? ', in front of another\'s egg' : ''}` : 'nothing'}, not a baby in a sub-slot out of the Hatchery`);
  const mid = nearRun([['fire', false], ['dusk', true]]);
  if (!mid.d || mid.at !== 'hatchery:1' || mid.hides || mid.left !== 1) fail(`eggs: the egg in nest 1, a newer one in nest 0, hatched into ${mid.d ? `${mid.d.name} in the ${mid.at}` : 'nothing'}, not a baby in the hatchery:1, in front of no egg`);
  const first = nearRun([['fire', true], ['dusk', false], ['spike', false]]);
  if (!first.d || first.at !== 'hatchery:0' || first.hides || first.left !== 2) fail(`eggs: the egg in nest 0, eggs in nests 1 and 2, hatched into ${first.d ? `${first.d.name} in the ${first.at}` : 'nothing'}, not a baby in the hatchery:0, in front of its own nest alone`);
  // a baby moved on (a lingerer evicted, or a Rush's bump) never comes to rest in the Hatchery's sub-slots -- they are
  // the hatchlings' first places, so the nests stay in view: BURR, lingering in a sub-slot of the hayloft's kitchen, is
  // moved on for ZAP's food, the Hatchery's sub-slots next door the nearest free, and goes elsewhere (BASE_DESIGN 3: to a free
  // slot on its own floor in a room meeting its lowest need; never the Hatchery)
  const P = (n: string, room: RoomKind, i: number, k = 0): DragonPlace => ({ ...START_DRAGONS.find((p) => p.name === n)!, slot: { room, i, n: k } });
  const ev = new CareSim(START_ROOMS, [{ name: 'BURR', element: 'spike', stage: 'baby', seed: 45, slot: { room: 'kitchen', i: 1, n: 2 } }, P('RIPPLE', 'bath', 0, 1), P('ZAP', 'groom', 0, 2)], START_KEEPERS, { seed: 1, dayLen: SHORT });
  for (const d of ev.dragons) for (const k of NEEDS) if (hasNeed(d.element, k)) d.needs[k] = 1;
  const eb = ev.dragons[0], ez = ev.dragons[2];
  ez.needs.food = 0.3;
  for (let s = 0; s < 600 && eb.goal !== 'evict'; s++) ev.step();
  const evAt = eb.slot ? `${ev.rooms[eb.slot.room].kind}:${eb.slot.i}` : '-', nearest = nearestFree(ev, { ...eb, slot: null, id: -1 });
  if (eb.goal !== 'evict' || !ez.slot || ev.rooms[ez.slot.room].kind !== 'kitchen' || evAt.startsWith('hatchery') || eb.slot?.room === ez.slot.room || !nearest || ev.rooms[nearest.room].kind !== 'hatchery') fail(`eggs: BURR, in ZAP's way to its food, was ${eb.goal === 'evict' ? `moved on to the ${evAt}` : 'not moved on'} (ZAP going to the ${ez.slot ? `${ev.rooms[ez.slot.room].kind}:${ez.slot.i}` : '-'}; the nearest free sub-slot the ${nearest ? ev.rooms[nearest.room].kind : 'none'})`);
  noteUse(ev);
  // names: every element's own six, none over NAME_MAX and none shared; past them a number, still unique and short
  const fake = (names: readonly string[]) => ({ dragons: names.map((name) => ({ name })) }) as unknown as CareSim;
  const all = Object.values(NAMES).flat();
  if (new Set(all).size !== all.length || all.some((n) => n.length > NAME_MAX)) fail('names: two elements share a name, or one is over 8 characters');
  if (hatchName(fake(NAMES.fire), 'fire') !== 'CINDER2' || hatchName(fake([...NAMES.fire, 'CINDER2']), 'fire') !== 'ASH2') fail(`names: past fire's six, ${hatchName(fake(NAMES.fire), 'fire')} then ${hatchName(fake([...NAMES.fire, 'CINDER2']), 'fire')}, not CINDER2 then ASH2`);
  const got: string[] = [];
  for (let i = 0; i < 80; i++) got.push(hatchName(fake(got), 'lightning'));
  if (new Set(got).size !== got.length || got.some((n) => n.length > NAME_MAX)) fail(`names: 80 lightning hatchlings gave ${new Set(got).size} names, the longest ${Math.max(...got.map((n) => n.length))} characters`);
  console.log(`  14 eggs: three eggs in nests 0-2, a fourth not taken; each hatched exactly ${H} steps (2 days of ${SHORT}) after it was laid: ${r.hatched.map((h) => `${h.d.name} (id ${h.d.id}, seed ${h.d.seed}) into the ${h.at}, fed ${((fedIn.get(h.d) ?? NaN) / FPS).toFixed(1)} s later`).join('; ')}; two runs alike; every sub-slot taken, the egg waited ${H} steps, nothing lost, and hatched into the ${freed ? `${full.rooms[freed.room].kind}:${freed.i}` : '-'} the step it freed (a small barn under the cap; the full preset, over it, waits); 80 lightning names, the last ${got[got.length - 1]}; a hatchling in front of its own nest (${first.d?.name} from nest 0, eggs in the other two, into the ${first.at}; ${mid.d?.name} from nest 1, an egg in nest 0, into the ${mid.at}) and never of another's egg (${hn?.name} from nest 2, eggs in the other two, into the ${hnAt}); a baby moved on never to the Hatchery (BURR, in ZAP's way in the hayloft, the Hatchery's sub-slots the nearest free, to the ${evAt})`);
}

// ---------- 15. retirement to the garden (#10) ----------
if (MAIN) {
  const SHORT = 600;
  /**
   * Step a world until every elder in it has retired and arrived (and 600 steps more), checking as it goes: a retire
   * event only ever at or after the elder's due (30 days into its stage), once each -- and, for one seen growing into an
   * elder, 30 days or more after that step (however late the stage-up); a retiree asks for nothing, holds no slot, heads
   * for its own plot and waits at a landing at most RETIREE_LIFT_S; a resident lives in the garden (on the ground floor,
   * inside the garden's walk, no barn slot) with jobs for food and love only; every dragon on its net; nobody in the bay
   * while the car moves; the garden's resting places apart (clear of each other's eyes, and roomy); and plots = max(2,
   * residents + retiring) all along.
   */
  const retireRun = (w: CareSim, steps: number, what: string, leavers = w.dragons.length) => {
    const retired = new Map<number, { t: number; late: number; span: number | null }>(), arrived = new Map<number, number>(), grew = new Map<number, { clock: number; late: number }>();
    let last = -1, plotsSeen = w.garden.plots, callMax = 0, walkMax = 0, restMax = -Infinity;
    const due0 = new Map(w.dragons.map((d) => [d.id, d.stageSince + STAGE_DAYS * w.dayLen]));
    for (let s = 1; s <= steps && !(arrived.size === leavers && s > last + 600); s++) {
      w.step();
      for (const e of w.events) {
        // (the player's commands' events, a send or a refused take, are no dragon's: none in this run; nor an egg due
        // in a full barn)
        if (e.kind === 'send' || e.kind === 'refused' || e.kind === 'full') continue;
        const d = w.dragons.find((q) => q.id === e.dragon)!;
        if (e.kind === 'grow' && e.stage === 'elder') grew.set(d.id, { clock: w.clock, late: w.clock - due0.get(d.id)! });
        if (e.kind === 'retire') {
          if (retired.has(d.id)) fail(`retire (${what}): ${d.name} retired twice`);
          const late = w.clock - retireDue(w, d), g = grew.get(d.id), span = g ? w.clock - g.clock : null;
          if (late < 0 || d.stage !== 'elder') fail(`retire (${what}): ${d.name} (${d.stage}) retired ${-late} steps before its 30 days as an elder were up`);
          if (span != null && span < RETIRE_DAYS * w.dayLen) fail(`retire (${what}): ${d.name} retired ${span} steps after it grew into an elder (${g!.late} steps late), not ${RETIRE_DAYS} days (${RETIRE_DAYS * w.dayLen})`);
          retired.set(d.id, { t: s, late, span });
        }
        if (e.kind === 'garden') {
          arrived.set(d.id, s); last = s;
          if (!retired.has(d.id)) fail(`retire (${what}): ${d.name} arrived in the garden without retiring`);
          else walkMax = Math.max(walkMax, s - retired.get(d.id)!.t);
        }
      }
      for (const d of w.dragons) if (d.goal === 'retire' && d.move === 'call') callMax = Math.max(callMax, d.waited);
      const need = Math.max(2, w.dragons.filter((d) => d.place === 'garden' || d.goal === 'retire').length);
      if (w.garden.plots !== need || w.worldW !== worldWOf(need) || w.garden.plots < plotsSeen) fail(`retire (${what}), step ${w.tick}: ${w.garden.plots} plots (world ${w.worldW} wide) for ${need}`);
      plotsSeen = w.garden.plots;
      for (const d of w.dragons) {
        if (d.goal === 'retire' && (d.slot || w.jobs.some((j) => j.dragon === d) || d.home == null || (d.legs.length ? d.legs[d.legs.length - 1].x !== plotMid(d.home) : d.x !== plotMid(d.home)))) fail(`retire (${what}), step ${w.tick}: ${d.name}, retiring, holds a slot, asks for something, or is not going to its plot`);
        if (d.place === 'garden') {
          const [a, b] = residentSpan(w);
          if (d.slot || d.f !== 0 || d.x < a - 1e-9 || d.x > b + 1e-9) fail(`retire (${what}), step ${w.tick}: ${d.name}, a resident, is at f${d.f} x ${d.x.toFixed(1)}${d.slot ? ' holding a slot' : ''} (the garden is ${a}..${b})`);
          for (const j of w.jobs) if (j.dragon === d && !GARDEN_NEEDS.includes(j.need)) fail(`retire (${what}), step ${w.tick}: ${d.name}, a resident, asks for ${j.need}`);
        }
      }
      if (s % 30) continue;
      for (const d of w.dragons) if (d.move !== 'ride' && spanOf(d.f, d.x, w.nets.dragon[d.stage]) < 0) fail(`retire (${what}), step ${w.tick}: ${d.name} stands off its floor (f${d.f} x ${d.x.toFixed(1)})`);
      for (const k of w.keepers) if (!k.climbing && spanOf(k.f, k.x, w.nets.keeper) < 0) fail(`retire (${what}), step ${w.tick}: ${k.name} stands off floor ${k.f} at x ${k.x.toFixed(1)}`);
      if (w.lift.moving) { const r = liftRange(w)!, who = inTheBay(w, r[0], r[1]); if (who) fail(`retire (${what}), step ${w.tick}: ${who} is in the lift bay while the car moves floors ${r[0]}-${r[1]}`); }
      const rs = rests(w);
      for (let i = 0; i < rs.length; i++) for (let k = i + 1; k < rs.length; k++) {
        if (rs[i].who?.place === 'garden' && rs[k].who?.place === 'garden') restMax = Math.max(restMax, restOverlap(rs[i], rs[k]));
        if (!restsApart(rs[i], rs[k])) fail(`retire (${what}), step ${w.tick}: the garden keeps two resting places ${restsClear(rs[i], rs[k]) ? `${restOverlap(rs[i], rs[k]).toFixed(1)} px one over the other` : 'over an eye'} (${rs[i].who?.name ?? `plot ${rs[i].plot}`} at ${rs[i].x}, ${rs[k].who?.name ?? `plot ${rs[k].plot}`} at ${rs[k].x})`);
      }
    }
    if (callMax / FPS > RETIREE_LIFT_S) fail(`retire (${what}): a retiree waited ${(callMax / FPS).toFixed(1)} s at a landing for the car (want <= ${RETIREE_LIFT_S})`);
    if (walkMax / FPS > RETIREE_WALK_S) fail(`retire (${what}): a retiree took ${(walkMax / FPS).toFixed(1)} s from setting off to arriving at its plot (want <= ${RETIREE_WALK_S})`);
    return { retired, arrived, grew, callMax, walkMax, restMax };
  };
  // (a) the retire preset: all seven starters elders 29.9 days in, on a short day: each retires at its due or after, soon
  const spec = startSpec('retire'), pre = new CareSim(spec.rooms, spec.dragons, spec.keepers, { seed: 1, dayLen: SHORT });
  const a = retireRun(pre, 40000, 'preset');
  const n = pre.dragons.length, res = pre.dragons.filter((d) => d.place === 'garden').length;
  if (a.retired.size !== n || a.arrived.size !== n) fail(`retire (preset): ${a.retired.size} of ${n} retired, ${a.arrived.size} arrived`);
  if (pre.stats.retireDelayMax > RETIRE_LATE) fail(`retire (preset): a retirement waited ${pre.stats.retireDelayMax} steps past its due (want <= ${RETIRE_LATE})`);
  if ((pre.stats.used.gate ?? 0) < n) fail(`retire (preset): the Garden Gate was passed ${pre.stats.used.gate ?? 0} times, fewer than the ${n} who walked out`);
  if (pre.garden.plots !== n || res !== n || pre.worldW !== GARDEN_X0 + n * GARDEN_PLOT + GARDEN_END || pre.worldW !== 2568) fail(`retire (preset): ${pre.garden.plots} plots, ${res} residents, the world ${pre.worldW} wide (want 7, 7, 2568)`);
  noteUse(pre);
  // (b) the busy barn: the seven adults falling due to grow elder 5 s apart from 10 s in, every one mid-errand (so most
  // grow late: section 13's busy barn), then, 30 days on, due to retire mid-errand; each retires 30 days after the step it
  // grew, never 30 days after it fell due to (the elder stage has no next to keep in step with: life.ts)
  const busy = new CareSim(START_ROOMS, START_DRAGONS.map((p, i) => ({ ...p, days: STAGE_DAYS - (600 + 300 * i) / SHORT })), START_KEEPERS, { seed: 1, dayLen: SHORT });
  const b = retireRun(busy, 60000, 'busy');
  if (b.grew.size !== n || b.retired.size !== n || b.arrived.size !== n) fail(`retire (busy): ${b.grew.size} of ${n} grew into elders, ${b.retired.size} retired, ${b.arrived.size} arrived`);
  if (![...b.grew.values()].some((g) => g.late > 0)) fail('retire (busy): no elder grew late, so the busy run shows nothing of a late stage-up');
  if (busy.stats.retireDelayMax > RETIRE_LATE) fail(`retire (busy): a retirement waited ${busy.stats.retireDelayMax} steps past its due (want <= ${RETIRE_LATE})`);
  noteUse(busy);
  // (c) the crowded barn: section 10's ten adults (the car busy all the time, the barn's calls all pressing), ECHO among
  // them an elder due to retire 600 steps in, in the Grooming Parlour a floor up: it waits for the car at most the barn's
  // landing gate -- with no OVERDUE rule of its own, its call ranking under every pressing one, it waited 161.9 s here
  const crowd = new CareSim(START_ROOMS, [...START_DRAGONS, ...CROWD].map((p) => (p.name === 'ECHO' ? { ...p, stage: 'elder' as const, days: RETIRE_DAYS - 600 / DAY_STEPS } : p)), START_KEEPERS, { seed: 1 });
  const cr = retireRun(crowd, 30000, 'crowded', 1);
  if (cr.arrived.size !== 1) fail(`retire (crowded): ECHO ${cr.retired.size ? 'retired but never arrived' : 'never retired'}`);
  noteUse(crowd);
  // (d) the real day: the retire preset's first elder under the Garden Gate's arch, its root at the arches' middle (the
  // base_gate shot's step: tools/shots.ts)
  const real = buildSim(startSpec('retire'), 1);
  let under = '';
  for (let s = 1; s <= 10000 && !under; s++) { real.step(); const d = real.dragons.find((q) => q.goal === 'retire' && q.f === 0 && q.x >= GATE_MID); if (d) under = `${d.name} at step ${s}`; }
  if (!under) fail('retire (real day): no elder passed under the Garden Gate\'s arch in 10000 steps');
  noteUse(real);
  const fmt = (w: CareSim, r: typeof a) => w.dragons.map((d) => `${d.name} ${r.retired.get(d.id)?.late ?? '-'}/${r.arrived.get(d.id) ?? '-'}`).join(', ');
  const over = (v: number) => (v > 0 ? `overlapping at most ${v.toFixed(1)} px` : `${(-v).toFixed(1)} px apart at least`);
  const spans = [...b.retired.entries()].map(([id, r]) => `${busy.dragons.find((d) => d.id === id)!.name} ${b.grew.get(id)!.late}/${((r.span ?? 0) / SHORT).toFixed(2)}`).join(', ');
  console.log(`  15 retirement (a ${SHORT}-step day): the retire preset, steps late / arrived: ${fmt(pre, a)} (at most ${pre.stats.retireDelayMax}, gate ${RETIRE_LATE}); a retiree at a landing at most ${(a.callMax / FPS).toFixed(1)} s, walking out at most ${(a.walkMax / FPS).toFixed(1)} s; the Garden Gate passed ${pre.stats.used.gate} times; ${pre.garden.plots} plots, ${res} residents, the world ${pre.worldW} wide, resting bodies ${over(a.restMax)} (gate ${REST_OVERLAP}); the busy barn (seven adults growing elder 5 s apart, mid-errand), steps it grew late / days an elder: ${spans} (each ${RETIRE_DAYS} or more), steps it retired late / arrived: ${fmt(busy, b)} (at most ${busy.stats.retireDelayMax}), a retiree at a landing at most ${(b.callMax / FPS).toFixed(1)} s, walking out at most ${(b.walkMax / FPS).toFixed(1)} s; the crowded barn (ten adults, ECHO retiring): ECHO at a landing ${(cr.callMax / FPS).toFixed(1)} s (gate ${RETIREE_LIFT_S}), walking out ${(cr.walkMax / FPS).toFixed(1)} s (gate ${RETIREE_WALK_S}); the real day, the first under the gate's arch: ${under}`);
}

// ---------- 16. the garden's residents (#10) ----------
if (MAIN) {
  // the garden preset (three residents, four adults in the barn), 30 minutes of the real day, seed 1
  const w = buildSim(startSpec('garden'), 1), MIN = 30, steps = MIN * 60 * FPS;
  const R = w.dragons.filter((d) => d.place === 'garden');
  const per = new Map(R.map((d) => [d, { nap: 0, night: 0, nightNap: 0, strolls: 0, visits: [] as string[], xs: new Set<number>(), was: d.garden!.mode as string }]));
  /** Each resident's food and love over each 5000-step window with no act on it: [start value, act seen]. */
  const win = new Map(R.map((d) => [d, new Map(GARDEN_NEEDS.map((k) => [k, { v: d.needs[k], act: false }]))]));
  const drains: string[] = [];
  let worstDrain = 0, cover = 0, gardenMet = 0, restMax = -Infinity;
  const [k0, k1] = gardenSpan(w.worldW, null);
  for (let s = 1; s <= steps; s++) {
    w.step();
    const night = isNight(w);
    for (const d of R) {
      const p = per.get(d)!, g = d.garden!;
      if (g.mode === 'nap') p.nap++;
      if (night && !d.act && g.mode !== 'wait') { p.night++; if (g.mode === 'nap') p.nightNap++; }
      if (g.mode === 'stroll' && p.was !== 'stroll') p.strolls++;
      p.was = g.mode;
      if (!walking(d) && d.move !== 'turn') p.xs.add(Math.round(d.x));
      for (const j of w.jobs) if (j.dragon === d && !GARDEN_NEEDS.includes(j.need)) fail(`residents: ${d.name} asks for ${j.need} (a resident has food and love only)`);
      for (const k of NEEDS) if (!GARDEN_NEEDS.includes(k) && d.needs[k] !== 1) { fail(`residents, step ${w.tick}: ${d.name}'s ${k} is ${d.needs[k].toFixed(4)}, not held full`); break; }
      if (d.act && d.act.t === 0) {
        // (met where it rests, by a keeper at its snout inside the garden)
        const k = w.keepers.find((q) => q.job && q.job.dragon === d), sp = w.standAt(d);
        if (!k || k.f !== 0 || Math.abs(k.x - sp.x) > 1 || k.x < k0 || k.x > k1) fail(`residents, step ${w.tick}: ${d.name}'s ${d.act.need} was met by ${k ? `${k.name} at f${k.f} x ${k.x.toFixed(1)}` : 'no keeper'}, not at its stand spot in the garden (${k0}..${k1})`);
        else { p.visits.push(`${k.name} ${d.act.need}`); gardenMet++; }
      }
      for (const k of GARDEN_NEEDS) { const c = win.get(d)!.get(k)!; if (d.act && d.act.need === k) c.act = true; }
    }
    if (s % 5000 === 0) for (const d of R) for (const k of GARDEN_NEEDS) {
      const c = win.get(d)!.get(k)!, want = 5000 * GARDEN_RATE * drainRate(d.element, 'elder', k), got = c.v - d.needs[k];
      if (!c.act && d.needs[k] > 0) { const off = Math.abs(got / want - 1); worstDrain = Math.max(worstDrain, off); if (off > 0.01) fail(`residents: ${d.name}'s ${k} drained ${got.toFixed(5)} over 5000 steps, not ${want.toFixed(5)} (GARDEN_RATE x an elder's)`); if (drains.length < R.length * 2 && !drains.some((q) => q.startsWith(`${d.name} ${k}`))) drains.push(`${d.name} ${k} ${(got / 5000 * 1e6).toFixed(3)}`); }
      c.v = d.needs[k]; c.act = false;
    }
    // (no resident at rest with its eye under another's body: the garden keeps their resting places apart)
    const still = R.filter((d) => !(walking(d) && d.gaitT > 0) && d.move !== 'turn');
    for (const a of still) for (const b of still) if (a !== b && eyeSpan(a.stage, a.facing, a.x)[1] >= dragonSpan(b)[0] && eyeSpan(a.stage, a.facing, a.x)[0] <= dragonSpan(b)[1]) cover++;
    // (nor two at rest lying one over the other: their bodies overlap REST_OVERLAP px at most)
    const resting = still.filter((d) => d.garden!.mode !== 'stroll');
    for (let i = 0; i < resting.length; i++) for (let k = i + 1; k < resting.length; k++) {
      const [p, q] = [resting[i], resting[k]].map((d) => ({ x: d.x, facing: d.facing, who: d, plot: null }));
      restMax = Math.max(restMax, restOverlap(p, q));
    }
  }
  const st = w.stats, avg = st.waitSum / Math.max(1, st.started) / FPS, max = st.waitMax / FPS, kAvg = st.keeperWaitSum / Math.max(1, st.keeperWaits) / FPS;
  for (const d of R) {
    const p = per.get(d)!;
    if (p.nap / steps < 0.5) fail(`residents: ${d.name} napped ${(p.nap / steps * 100).toFixed(1)} % of its steps (want >= 50 %: "they will sleep a lot")`);
    if (p.nightNap !== p.night) fail(`residents: ${d.name} napped ${p.nightNap} of its ${p.night} night steps outside its keeper's visits (want all)`);
    if (p.strolls < 1 || p.xs.size < 2) fail(`residents: ${d.name} never strolled ("and move around")`);
    if (d.home == null || w.dragons.filter((o) => o.home === d.home).length !== 1) fail(`residents: ${d.name}'s plot is ${d.home}`);
  }
  if (!gardenMet || (st.used.garden ?? 0) !== gardenMet) fail(`residents: ${gardenMet} resident jobs met, the garden used ${st.used.garden ?? 0} times`);
  if (worstDrain === 0 || drains.length < R.length * 2) fail(`residents: the drain was measured on ${drains.length} needs, not every resident's food and love`);
  if (cover) fail(`residents: a resident at rest had its eye under another's body for ${cover} steps`);
  if (restMax > REST_OVERLAP) fail(`residents: two residents at rest lay ${restMax.toFixed(1)} px one over the other (want <= ${REST_OVERLAP})`);
  // (the barn's service beside them: the S3 gates a dragon feels, per run)
  if (st.emptySteps) fail(`residents: a need sat at 0 for ${st.emptySteps} dragon-steps`);
  if (st.waitTimeouts) fail(`residents: ${st.waitTimeouts} keepers gave up waiting`);
  if (avg > GATE.waitAvgS || max > GATE.waitMaxS || kAvg > GATE.keeperWaitAvgS || st.liftWaitMax / FPS > GATE.liftWaitS) fail(`residents: jobs waited ${avg.toFixed(1)} s on average, ${max.toFixed(1)} s at most, keepers ${kAvg.toFixed(1)} s at the stand spot, a landing ${(st.liftWaitMax / FPS).toFixed(1)} s (want <= ${GATE.waitAvgS}, ${GATE.waitMaxS}, ${GATE.keeperWaitAvgS}, ${GATE.liftWaitS})`);
  noteUse(w);
  const perHour = (n: number) => (n * 60 / MIN).toFixed(0);
  console.log(`  16 residents (the garden preset, ${MIN} min of the real day): ${R.map((d) => { const p = per.get(d)!; return `${d.name} napped ${(p.nap / steps * 100).toFixed(0)} % (every one of ${p.night} night steps), strolled ${p.strolls} times, ${p.visits.length} keeper visits (${p.visits.join(', ') || 'none'}; ${perHour(p.visits.length)} an hour)`; }).join('; ')}; jobs for food and love only, draining at a quarter of an elder's (per step x 1e6: ${drains.join(', ')}; within ${(worstDrain * 100).toFixed(3)} %); two at rest overlapping at most ${restMax.toFixed(1)} px (gate ${REST_OVERLAP}); the barn beside them: ${st.done} jobs done, wait avg ${avg.toFixed(1)} s, max ${max.toFixed(1)} s, ${st.emptySteps} steps with a need at 0, the Garden Gate passed ${st.used.gate ?? 0} times`);
}

// ---------- 17. the Map Room's board (#5.1, #5.2) ----------
if (MAIN) {
  // the board is a pure function of the seed, the day and the map: the same twice; day 1 has THE LOST NEST first; three
  // missions at most, one a region, each an explored region's; no baddie before day 3; each difficulty's road as long
  // as it should be, from its region's pool, no challenge twice
  const all = REGIONS.map((r) => r.id), start = REGIONS.filter((r) => r.start).map((r) => r.id);
  let boards = 0, baddies = 0;
  const kinds = new Map<string, number>();
  for (let seed = 1; seed <= 5; seed++) for (let day = 1; day <= 10; day++) for (const map of [start, all]) {
    const a = boardFor(seed, day, map, []), b = boardFor(seed, day, map, []);
    boards++;
    if (!isDeepStrictEqual(a, b)) fail(`board: seed ${seed} day ${day} rolled twice differs`);
    if (day === 1 && (a[0]?.title !== LOST_NEST || a[0].region !== 'millbrook' || a[0].difficulty !== 'easy' || a[0].challenges.join() !== 'flood,lost' || !a[0].guaranteedEgg || a[0].coin !== 40)) fail(`board: seed ${seed} day 1 does not start with THE LOST NEST (${a[0]?.title})`);
    if (a.length > BOARD_MAX || a.length !== Math.min(BOARD_MAX, map.length)) fail(`board: seed ${seed} day ${day} has ${a.length} missions for ${map.length} regions`);
    if (new Set(a.map((m) => m.region)).size !== a.length || a.some((m) => !map.includes(m.region))) fail(`board: seed ${seed} day ${day} has two missions in a region, or one in an unexplored one`);
    if (new Set(a.map((m) => m.id)).size !== a.length) fail(`board: seed ${seed} day ${day}'s missions share an id`);
    for (const m of a) {
      const D = DIFFICULTY[m.difficulty], pool = regionOf(m.region).pool;
      kinds.set(m.difficulty, (kinds.get(m.difficulty) ?? 0) + 1);
      if (m.baddie) baddies++;
      if (m.baddie && day < BADDIE_FROM_DAY) fail(`board: seed ${seed} day ${day}: ${m.title} ends in a baddie before day ${BADDIE_FROM_DAY}`);
      if (m.baddie && (m.difficulty !== 'hard' || m.baddie !== regionOf(m.region).baddie)) fail(`board: ${m.title}'s baddie ${m.baddie} is not its hard road's`);
      const want = m.difficulty === 'hard' && !m.baddie ? D.challenges + 1 : D.challenges;
      if (m.challenges.length !== want || new Set(m.challenges).size !== want || m.challenges.some((c) => !pool.includes(c))) fail(`board: seed ${seed} day ${day}: ${m.title} (${m.difficulty}) has ${m.challenges.join(', ')}`);
      if (m.days !== D.days || m.coin !== D.coin || (m.title !== LOST_NEST && m.eggChance !== D.egg)) fail(`board: ${m.title}'s days, coin or egg chance are not its difficulty's`);
    }
  }
  // (in a world: rolled at its start, and again at every 05:00 -- and only then)
  const w = new CareSim(START_ROOMS, START_DRAGONS, START_KEEPERS, { seed: 1, dayLen: 600 }), rolls: number[] = [];
  let last = JSON.stringify(w.missions.board);
  if (w.missions.day !== 1 || w.missions.board[0]?.title !== LOST_NEST) fail(`board: a new world's board is day ${w.missions.day}'s, first ${w.missions.board[0]?.title}`);
  for (let s = 1; s <= 1800; s++) {
    w.step();
    const now = JSON.stringify(w.missions.board);
    if (now !== last) { rolls.push(w.clock); last = now; }
  }
  if (rolls.join() !== '725,1325,1925' || w.missions.day !== 4) fail(`board: rolled at clocks ${rolls.join(', ')} (day ${w.missions.day}), not at each 05:00 (725, 1325, 1925 on a 600-step day from 07:00)`);
  noteUse(w);
  console.log(`  17 board: ${boards} boards (seeds 1-5, days 1-10, the start's map and the whole) the same rolled twice, day 1's always THE LOST NEST first; ${[...kinds].map(([k, n]) => `${n} ${k}`).join(', ')}, ${baddies} ending in a baddie (none before day ${BADDIE_FROM_DAY}); a world's board rolled at clocks ${rolls.join(' and ')} (each 05:00)`);
}

// ---------- 18. the odds (#5.3: the team meets the road's challenges) ----------
if (MAIN) {
  // hand-computed cases (plan S8's formula: 0.20 + 0.15 a challenge met + 0.15 the baddie met + 0.05 a pair in good
  // spirits + 0.05 a pair of partners, clamped to 0.05-0.95): moods set by hand (every need full: 0.8; one at 0.2: low)
  const w = newSim(1), by = (n: string) => w.dragons.find((d) => d.name === n)!, keeper = (n: string) => w.keepers.find((k) => k.name === n)!.id;
  const mood = (n: string, good: boolean) => { const d = by(n); for (const k of NEEDS) if (hasNeed(d.element, k)) d.needs[k] = 1; if (!good) d.needs.food = 0.2; d.mood = moodOf(d.element, d.needs); };
  const nest = w.missions.board.find((m) => m.title === LOST_NEST)!;
  const mission = (region: RegionId, challenges: ChallengeId[], baddie: BaddieId | null): Mission => ({ id: 999, region, title: 'TEST', difficulty: 'hard', challenges, baddie, days: 3, coin: 150, eggChance: 0.6, guaranteedEgg: false });
  const cases: [string, Mission, [string, string][], Record<string, boolean>, number][] = [
    ['THE LOST NEST, RIPPLE (a rider) and ECHO (TOMAS, partners), both in good spirits', nest, [['RIPPLE', 'IRIS'], ['ECHO', 'TOMAS']], { RIPPLE: true, ECHO: true }, 0.65],
    ['THE LOST NEST, RIPPLE alone, in good spirits', nest, [['RIPPLE', 'IRIS']], { RIPPLE: true }, 0.40],
    ['THE LOST NEST, RIPPLE alone, low', nest, [['RIPPLE', 'IRIS']], { RIPPLE: false }, 0.35],
    ['THE LOST NEST, WICK (IRIS, partners) meeting nothing, low: the least a pair can have is the base and its partner', nest, [['WICK', 'IRIS']], { WICK: false }, 0.25],
    ['THE LOST NEST, EMBER and a stranger, low, nothing met: the base alone', nest, [['EMBER', 'PIP']], { EMBER: false }, 0.20],
    ['a hard road, all met, the Storm Roc too, both partnered and happy: 1.00, clamped', mission('highfold', ['storm', 'dark', 'gap'], 'stormroc'), [['ZAP', 'PIP'], ['WICK', 'IRIS']], { ZAP: true, WICK: true }, 0.95],
    ['the Mole King needing CHARM too: WICK (IRIS) meets the dark, not the baddie', mission('oldmine', ['dark', 'heavy', 'lost'], 'moleking'), [['WICK', 'IRIS']], { WICK: true }, 0.45],
    ['the Mole King met: WICK with BEA (charm), COBBLE with TOMAS', mission('oldmine', ['dark', 'heavy', 'lost'], 'moleking'), [['WICK', 'BEA'], ['COBBLE', 'TOMAS']], { WICK: true, COBBLE: false }, 0.2 + 0.30 + 0.15 + 0.05 + 0.05],
  ];
  const rows: string[] = [];
  for (const [what, m, team, moods, want] of cases) {
    for (const [n, good] of Object.entries(moods)) mood(n, good);
    const pairs = team.map(([d, k]) => ({ dragon: by(d).id, keeper: keeper(k) })), got = oddsOf(w, m, pairs);
    if (Math.abs(got - want) > 1e-9) fail(`odds: ${what}: ${got}, not ${want}`);
    rows.push(`${(got * 100).toFixed(0)} %`);
  }
  if (oddsOf(w, nest, []) !== 0) fail('odds: an empty team has odds');
  console.log(`  18 odds: ${cases.length} hand-computed teams, ${rows.join(', ')} (the plan's two examples 65 % and 40 %; 95 % the top clamp; 20 % the least a pair can have, above the bottom clamp's 5 %)`);
}

// ---------- 19. who may go (#5.3: dragons and people as solutions; P13: 2 keepers home) ----------
if (MAIN) {
  // a baby, a young dragon on a normal or hard road and a garden resident may not go; a keeper the player has taken is
  // never an auto rider (seams.ts isTaken: BEA taken, first as a stub -- a Taken the pick is given -- then by S7's own
  // take command, below), for any mission and any dragon; two riders at most, two keepers always home; one team out at
  // a time
  const ages = buildSim(startSpec('ages'), 1), gar = buildSim(startSpec('garden'), 1), easy = ages.missions.board.find((m) => m.difficulty === 'easy')!;
  const hardOf = (m: Mission): Mission => ({ ...m, difficulty: 'hard' }), normalOf = (m: Mission): Mission => ({ ...m, difficulty: 'normal' });
  for (const d of ages.dragons) {
    const why = dragonReason(ages, d, easy);
    if (d.stage === 'baby' ? why !== 'BABY' : why !== null) fail(`team: ${d.name} (${d.stage}) on an easy road: ${why}`);
    for (const m of [normalOf(easy), hardOf(easy)]) { const w2 = dragonReason(ages, d, m); if (d.stage === 'young' ? w2 !== 'TOO YOUNG' : d.stage === 'baby' ? w2 !== 'BABY' : w2 !== null) fail(`team: ${d.name} (${d.stage}) on a ${m.difficulty} road: ${w2}`); }
  }
  const young = ages.dragons.find((d) => d.stage === 'young')!;
  if (canSend(ages, normalOf(easy), [{ dragon: young.id, keeper: 0 }]) == null) fail('team: a young dragon could be sent on a normal road');
  for (const d of gar.dragons.filter((q) => q.place === 'garden')) if (dragonReason(gar, d, easy) !== 'IN THE GARDEN') fail(`team: ${d.name}, in the garden, may go`);
  const w = newSim(1), BEA = w.keepers.find((k) => k.name === 'BEA')!.id, taken: Taken = (_s, id) => id === BEA;
  let asked = 0;
  const IRIS = w.keepers.find((k) => k.name === 'IRIS')!.id;
  for (let day = 1; day <= 10; day++) for (const m of boardFor(1, day, REGIONS.map((r) => r.id), [])) for (const d of w.dragons) for (const others of [[], [{ dragon: w.dragons.find((o) => o !== d)!.id, keeper: IRIS }]]) {
    asked++;
    const k = autoRider(w, d, m, others, taken);
    if (k === BEA) fail(`team: ${d.name}'s auto rider for ${m.title} is BEA, whom the player has taken`);
    if (k == null) fail(`team: ${d.name} has no auto rider for ${m.title} with BEA taken`);
  }
  for (const m of w.missions.board) for (const p of bestTeam(w, m, taken)) if (p.keeper === BEA) fail(`team: BEST TEAM for ${m.title} gave BEA a pair while taken`);
  // (two riders at most: a third pair is refused, and autoRider has nobody for it -- two keepers stay home)
  const nest = w.missions.board.find((m) => m.title === LOST_NEST)!, ids = (n: string) => w.dragons.find((d) => d.name === n)!.id;
  const three = [{ dragon: ids('RIPPLE'), keeper: 0 }, { dragon: ids('ECHO'), keeper: 1 }, { dragon: ids('WICK'), keeper: 2 }];
  if (canSend(w, nest, three) !== 'NOT ENOUGH KEEPERS HOME') fail(`team: three pairs: ${canSend(w, nest, three)}`);
  if (autoRider(w, w.dragons[6], nest, three.slice(0, 2)) != null) fail('team: a third rider was found (two keepers must stay home)');
  if (canSend(w, nest, []) !== 'PICK A DRAGON') fail('team: an empty team could be sent');
  const t = send(w, nest.id, three.slice(0, 2));
  if (typeof t === 'string') fail(`team: THE LOST NEST refused: ${t}`);
  const other = w.missions.board[0], again = other ? send(w, other.id, [{ dragon: ids('WICK'), keeper: 2 }]) : 'none';
  if (again !== 'A TEAM IS ALREADY OUT') fail(`team: a second team was sent (${typeof again === 'string' ? again : 'sent'})`);
  if (w.missions.board.some((m) => m.id === nest.id)) fail('team: the mission sent is still on the board');
  const home = w.keepers.filter((k) => !onTrip(k)).length;
  if (home < HOME_KEEPERS) fail(`team: ${home} keepers home with a team out`);
  if (dragonReason(w, w.dragons.find((d) => d.name === 'RIPPLE')!, other ?? null) !== 'AWAY') fail('team: a dragon on the team out could go again');
  noteUse(w);
  // S7's take, for real (the merge): BEA taken by hand through the command queue -- isTaken and CareSim.free leave her
  // out; no auto rider (the same 420 asks, the pick asking the seam itself) nor BEST TEAM chooses her; a team with her
  // riding can't be sent (canSend), and a send command with her is refused with that reason (the `send` event); BEST
  // TEAM sent by command goes (its event with no reason) and musters; a rider on that trip can't be taken by hand (a
  // `refused` event; BEA stays held); held for the muster and 3000 steps more, BEA is never given a job
  const tw = newSim(1), tBea = tw.keepers.find((k) => k.name === 'BEA')!;
  tw.command({ kind: 'take', keeper: tBea.id }); tw.step();
  if (!tBea.manual || !isTaken(tw, tBea.id) || tw.free(tBea) || tw.keepers.some((k) => k !== tBea && isTaken(tw, k.id))) fail(`team: BEA taken by hand: manual ${tBea.manual}, isTaken ${isTaken(tw, tBea.id)}, free ${tw.free(tBea)}`);
  let askedHand = 0;
  for (let day = 1; day <= 10; day++) for (const m of boardFor(1, day, REGIONS.map((r) => r.id), [])) for (const d of tw.dragons) for (const others of [[], [{ dragon: tw.dragons.find((o) => o !== d)!.id, keeper: IRIS }]]) {
    askedHand++;
    const k = autoRider(tw, d, m, others);
    if (k === tBea.id || k == null) fail(`team: with BEA taken by hand, ${d.name}'s auto rider for ${m.title} is ${k == null ? 'nobody' : 'BEA'}`);
  }
  for (const m of tw.missions.board) for (const p of bestTeam(tw, m)) if (p.keeper === tBea.id) fail(`team: BEST TEAM for ${m.title} gave BEA, taken by hand, a pair`);
  const tn = tw.missions.board.find((m) => m.title === LOST_NEST)!, withBea = [{ dragon: tw.dragons.find((d) => d.name === 'RIPPLE')!.id, keeper: tBea.id }];
  if (canSend(tw, tn, withBea) !== 'NOT ENOUGH KEEPERS HOME') fail(`team: a team with BEA, taken by hand, riding: ${canSend(tw, tn, withBea)}`);
  tw.command({ kind: 'send', mission: tn.id, pairs: withBea }); tw.step();
  const refusedSend = tw.events.find((e) => e.kind === 'send');
  if (!refusedSend || refusedSend.kind !== 'send' || refusedSend.reason !== 'NOT ENOUGH KEEPERS HOME' || tw.missions.trip) fail(`team: a send command with BEA riding: ${JSON.stringify(refusedSend)}, trip ${tw.missions.trip?.state}`);
  const team = bestTeam(tw, tn);
  tw.command({ kind: 'send', mission: tn.id, pairs: team }); tw.step();
  const sentEv = tw.events.find((e) => e.kind === 'send');
  if (!sentEv || sentEv.kind !== 'send' || sentEv.reason !== null || tw.missions.trip?.state !== 'muster') fail(`team: BEST TEAM sent by command: ${JSON.stringify(sentEv)}, trip ${tw.missions.trip?.state}`);
  const tRider = tw.keepers.find((k) => k.id === team[0]?.keeper)!;
  tw.command({ kind: 'take', keeper: tRider.id }); tw.step();
  const refusedTake = tw.events.find((e) => e.kind === 'refused');
  if (!refusedTake || refusedTake.kind !== 'refused' || refusedTake.keeper !== tRider.id || tRider.manual || tRider.pendingTake || !onTrip(tRider) || tw.controlled !== tBea.id) fail(`team: taking ${tRider.name}, a rider mustering: ${JSON.stringify(refusedTake)}, manual ${tRider.manual}, controlled ${tw.controlled}`);
  let handJobs = 0;
  for (let s = 0; s < 6000; s++) { tw.step(); if (tBea.job) handJobs++; }
  if (handJobs || !tBea.manual) fail(`team: BEA, held by hand beside a muster, had a job ${handJobs} steps (manual ${tBea.manual})`);
  noteUse(tw);
  // (a keeper taken at work -- finishing the job first -- whose dragon is then sent: the job gone from under them
  // (missions.ts leaveBarn), they are the player's where they stand, steerable, as a finished job leaves them
  // (CareSim.drop); never left finishing a job that no longer is, held but not steerable)
  const pw = newSim(2);
  let pk: Keeper | null = null;
  for (let s = 0; s < 20000 && !pk; s++) { pw.step(); pk = pw.keepers.find((k) => k.phase === 'work' && !!k.job && k.job.need !== 'sleep' && k.job.dragon.stage !== 'baby') ?? null; }
  let pendingLine = 'none found';
  if (!pk) fail('team: seed 2 had no keeper at work to take within 20000 steps');
  else {
    const pd = pk.job!.dragon, need = pk.job!.need, at = pw.tick, pm = pw.missions.board.find((m) => m.title === LOST_NEST)!;
    pw.command({ kind: 'take', keeper: pk.id }); pw.step();
    if (!pk.pendingTake || pk.manual || pk.phase !== 'work') fail(`team: ${pk.name}, taken at work: pendingTake ${pk.pendingTake}, manual ${pk.manual}, ${pk.phase}`);
    const pr = autoRider(pw, pd, pm, []);
    if (pr == null || pr === pk.id) fail(`team: ${pd.name}'s auto rider with ${pk.name} taken at work: ${pr}`);
    pw.command({ kind: 'send', mission: pm.id, pairs: [{ dragon: pd.id, keeper: pr ?? 0 }] }); pw.step();
    const ev = pw.events.find((e) => e.kind === 'send');
    if (!ev || ev.kind !== 'send' || ev.reason !== null || pw.missions.trip?.state !== 'muster') fail(`team: ${pd.name} sent from under ${pk.name}'s hands: ${JSON.stringify(ev)}`);
    if (!pk.manual || pk.pendingTake || pk.phase !== 'manual' || pk.job || pw.controlled !== pk.id || pw.free(pk)) fail(`team: ${pk.name}, taken at work on ${pd.name} and it sent: manual ${pk.manual}, pendingTake ${pk.pendingTake}, ${pk.phase}, job ${pk.job?.id ?? null}, controlled ${pw.controlled}`);
    const x0 = pk.x;
    pw.command({ kind: 'steer', dx: 1, dy: 0 });
    for (let s = 0; s < 120; s++) pw.step();
    const x1 = pk.x;
    pw.command({ kind: 'steer', dx: -1, dy: 0 });
    for (let s = 0; s < 120; s++) pw.step();
    if (x1 === x0 && pk.x === x1) fail(`team: ${pk.name}, the player's after ${pd.name} was sent, did not walk when steered (x ${x0})`);
    pendingLine = `${pk.name} taken at work (${need}, ${pd.name}; seed 2, step ${at}) and ${pd.name} sent: the player's where they stood, steered ${x0} -> ${x1} -> ${pk.x}`;
    noteUse(pw);
  }
  console.log(`  19 team: babies, the young on normal and hard roads and garden residents may not go; with BEA taken (the pick given a stub), ${asked} auto riders (10 days of boards x 7 dragons, alone and beside a pair) and BEST TEAM never chose her; a third pair refused (two keepers stay home: ${home} home with the team out); a second send refused while one is out; BEA taken by hand by S7's command: not free, ${askedHand} auto riders and BEST TEAM never chose her, a send command with her riding refused ("${refusedSend && refusedSend.kind === 'send' ? refusedSend.reason : '?'}"), BEST TEAM sent by command and mustering, ${tRider.name} (riding) refused to the hand ("${refusedTake && refusedTake.kind === 'refused' ? refusedTake.reason : '?'}"), BEA given no job in 6000 steps beside the trip; ${pendingLine}`);
}

// ---------- 20. a full trip: THE LOST NEST (#5.4, #5.6, #11) ----------
let musterAt = 0;
/** The longest a muster sent in the middle of play may take (2.5 min at 1x; a fresh world's is 2186 steps). */
const MUSTER_MID_MAX = 9000;
if (MAIN) {
  // (a) the muster preset's world (the real day, seed 1): the step everyone stands on the deck (the base_muster shot)
  {
    const w = buildSim(startSpec('muster'), 1);
    while (w.missions.trip?.state === 'muster' && w.tick < 20000) w.step();
    musterAt = w.tick;
    if (w.missions.trip?.state !== 'depart') fail(`trip: the muster preset's team never left (${w.missions.trip?.state} at step ${w.tick})`);
    noteUse(w);
  }
  // (b) THE LOST NEST with RIPPLE and ECHO on a short day (seed 2: a success with an egg), stepped through: the muster
  // (the Map Room, the Tack Room and the Aerie used; both up by the lift; 3600 steps or fewer), away (no job for the team,
  // no job for its riders, the needs frozen), back at returnAt exactly with food and sleep down, the egg in its reserved
  // nest, the saddles hung back, the riders rested in the Bunks and back on duty, the coin paid, the trip over, and the
  // region's neighbour revealed at the next dawn
  const w = new CareSim(START_ROOMS, START_DRAGONS, START_KEEPERS, { seed: 2, dayLen: 600 });
  const rides0 = w.stats.liftRides, used0 = { ...w.stats.used }, uses0 = uses(w);
  sendLostNest(w);
  const t = w.missions.trip!, team = t.pairs.map((p) => w.dragons.find((d) => d.id === p.dragon)!), riders = t.pairs.map((p) => w.keepers.find((k) => k.id === p.keeper)!);
  if (!t.success || !t.egg || t.nest == null) fail(`trip: seed 2's LOST NEST should succeed with an egg (${t.success}, ${t.egg}, nest ${t.nest})`);
  let departed = -1, awayAt = -1, landedAt = -1, overAt = -1, laid = -1, frozen: string | null = null, landNeeds = '', revealed = '';
  const upBy = new Set<number>();
  for (let s = 1; s <= 30000 && (overAt < 0 || riders.some((k) => k.phase === 'rest') || s < overAt + 10); s++) {
    const before = t.state, eggs = w.eggs.length;
    const pre = team.map((d) => ({ food: d.needs.food, sleep: d.needs.sleep }));
    w.step();
    for (const d of team) if (d.move === 'ride' && w.lift.target === 5) upBy.add(d.id);
    if (t.state === 'depart' && before === 'muster') departed = w.tick;
    if (t.state === 'away' && before === 'depart') { awayAt = w.tick; frozen = JSON.stringify(team.map((d) => d.needs)); }
    if (t.state === 'away') {
      if (w.jobs.some((j) => team.includes(j.dragon))) fail(`trip, step ${w.tick}: a job for a dragon away`);
      if (JSON.stringify(team.map((d) => d.needs)) !== frozen) fail(`trip, step ${w.tick}: an away dragon's needs moved`);
      if (team.some((d) => d.place !== 'away')) fail(`trip, step ${w.tick}: the team is away but a dragon is ${team.map((d) => d.place)}`);
    }
    if (riders.some((k) => onTrip(k) && k.job)) fail(`trip, step ${w.tick}: a rider on the trip has a job`);
    if (t.state === 'return' && before === 'away') {
      landedAt = w.tick;
      if (w.clock !== t.returnAt) fail(`trip: landed at clock ${w.clock}, not returnAt ${t.returnAt}`);
      team.forEach((d, i) => { for (const k of ['food', 'sleep'] as const) if (Math.abs(d.needs[k] - Math.min(pre[i][k], 0.45)) > 1e-9) fail(`trip: ${d.name}'s ${k} landed at ${d.needs[k]}, not min(${pre[i][k]}, 0.45)`); });
      landNeeds = team.map((d) => `${d.name} food ${d.needs.food.toFixed(2)} sleep ${d.needs.sleep.toFixed(2)}`).join(', ');
    }
    if (w.eggs.length > eggs) laid = w.tick;
    if (!w.missions.trip && overAt < 0) {
      overAt = w.tick;
      // (the success: the region's first, and its unexplored neighbour to be revealed at the next dawn -- not before)
      revealed = JSON.stringify({ first: w.missions.firstSuccess, pending: w.missions.pendingReveal, frost: w.missions.explored.includes('frostmere') });
      if (revealed !== JSON.stringify({ first: ['millbrook'], pending: ['frostmere'], frost: false })) fail(`trip: as it ended, ${revealed}`);
    }
    if (overAt > 0 && w.clock % w.dayLen === 125 && !w.missions.explored.includes('frostmere')) fail('trip: FROSTMERE was not revealed at the dawn after the success');
  }
  const used = (k: string) => (w.stats.used[k] ?? 0) - (used0[k] ?? 0);
  if (departed < 0 || departed > 3600) fail(`trip: the muster took ${departed} steps (want <= 3600)`);
  if (w.stats.liftRides - rides0 < 2 || upBy.size !== 2) fail(`trip: the team rode up to the Aerie ${upBy.size} of 2 (rides ${w.stats.liftRides - rides0})`);
  for (const k of ['maproom', 'tack', 'aerie', 'bunks']) if (!used(k)) fail(`trip: the ${k} was not used`);
  if (used('aerie') !== 2 || used('tack') !== 4 || used('maproom') !== 1) fail(`trip: used the Aerie ${used('aerie')}, the Tack Room ${used('tack')}, the Map Room ${used('maproom')} times (want 2, 4, 1)`);
  if (awayAt < 0 || landedAt < 0 || landedAt - awayAt !== w.dayLen) fail(`trip: away at ${awayAt}, landed at ${landedAt} (want a day, ${w.dayLen} steps, apart)`);
  const egg = w.eggs.find((e) => e.nest === t.nest) ?? null;
  if (laid < 0 || (egg && egg.element !== t.egg)) fail(`trip: the ${t.egg} egg was not laid in nest ${t.nest} (${JSON.stringify(w.eggs)})`);
  if (w.missions.trip || overAt < 0) fail('trip: the trip never ended');
  if (w.missions.coin !== 40) fail(`trip: the coin is ${w.missions.coin}, not 40`);
  if (riders.some((k) => onTrip(k) || k.phase === 'rest' || k.carrying === 'saddle' || k.carrying === 'egg')) fail(`trip: the riders are ${riders.map((k) => `${k.name} ${k.phase} ${k.carrying}`).join(', ')}, not back on duty`);
  if (team.some((d) => d.place !== 'barn' || d.goal === 'muster')) fail(`trip: the team is ${team.map((d) => `${d.name} ${d.place} ${d.goal}`).join(', ')}, not home`);
  const dawn = () => w.clock % w.dayLen === 125;
  while (!dawn()) w.step();
  if (!w.missions.explored.includes('frostmere') || w.missions.pendingReveal.length) fail(`trip: FROSTMERE was not revealed at the next dawn (explored ${w.missions.explored})`);
  // (and the egg hatches, two days after it was laid, into a baby of its element)
  const baby = () => w.dragons.find((d) => d.stage === 'baby' && d.element === t.egg);
  while (!baby() && w.tick < laid + 2 * w.dayLen + 3000) w.step();
  if (!baby()) fail(`trip: the ${t.egg} egg never hatched`);
  noteUse(w, uses0);
  // (c) musters in the middle of play: BEST TEAM on a board mission, seeds 1-6, 600 and 1500 steps into a 600-step day
  const mids: number[] = [];
  for (let seed = 1; seed <= 6; seed++) for (const off of [600, 1500]) {
    const v = new CareSim(START_ROOMS, START_DRAGONS, START_KEEPERS, { seed, dayLen: 600 });
    for (let s = 0; s < off; s++) v.step();
    const m = v.missions.board[seed % v.missions.board.length], r = send(v, m.id, bestTeam(v, m), { awaySteps: 300 });
    if (typeof r === 'string') { fail(`trip: seed ${seed}, ${off} steps in: BEST TEAM on ${m.title} refused: ${r}`); continue; }
    let s = 0;
    while (r.state === 'muster' && s < MUSTER_MID_MAX + 1) { v.step(); s++; }
    if (r.state === 'muster') fail(`trip: seed ${seed}, ${off} steps in: ${m.title}'s muster took over ${MUSTER_MID_MAX} steps`);
    mids.push(s);
  }
  mids.sort((a, b) => a - b);
  console.log(`  20 trip: mid-play musters (BEST TEAM, seeds 1-6, 600 and 1500 steps in): median ${mids[mids.length >> 1]}, max ${mids[mids.length - 1]} steps (bound ${MUSTER_MID_MAX})`);
  console.log(`  20 trip: the muster preset (the real day, seed 1) all on the deck at step ${musterAt}; THE LOST NEST (seed 2, a 600-step day) with ${t.pairs.map((p, i) => `${team[i].name} and ${riders[i].name}`).join(', ')}: odds ${(t.odds * 100).toFixed(0)} %, ${t.success ? 'a success' : 'a failure'}, a ${t.egg} egg for nest ${t.nest}; mustered in ${departed} steps (both up by the lift), away at ${awayAt}, landed at ${landedAt} (returnAt, exactly: ${landNeeds}), the egg laid at ${laid}, over at ${overAt}; the Map Room used ${used('maproom')}, the Tack Room ${used('tack')}, the Aerie ${used('aerie')}, the Bunks ${used('bunks')}; coin ${w.missions.coin}; FROSTMERE revealed at the next dawn; ${baby()?.name} hatched`);
}

// ---------- 21. a failure: turning back (#5.3) ----------
if (MAIN) {
  // a low-odds send (RIPPLE alone on THE LOST NEST: nobody meets the lost things) that fails, from seeds 1-200: it turns
  // back at the first unmet stop, brings half the coin and no egg, and reveals nothing
  let seed = 0, t: Trip | null = null, w: CareSim | null = null, tried = 0;
  for (let s = 1; s <= 200 && !t; s++) {
    tried++;
    const sim = new CareSim(START_ROOMS, START_DRAGONS, START_KEEPERS, { seed: s, dayLen: 600 }), m = sim.missions.board[0], d = sim.dragons.find((q) => q.name === 'RIPPLE')!;
    const r = send(sim, m.id, [{ dragon: d.id, keeper: autoRider(sim, d, m, [])! }]);
    if (typeof r !== 'string' && !r.success) { seed = s; t = r; w = sim; }
  }
  if (!t || !w) fail('failure: no seed in 1-200 fails RIPPLE alone on THE LOST NEST');
  else {
    const first = t.stops.findIndex((s) => !s.covered);
    if (t.turnBack !== first || first !== 1 || !/TURN BACK/.test(t.stops[first].log) || t.egg || t.nest != null || t.exit) fail(`failure: turns back at ${t.turnBack} (${t.stops[first]?.log}), egg ${t.egg}`);
    const eggs = w.eggs.length;
    for (let s = 0; s < 20000 && w.missions.trip; s++) w.step();
    if (w.missions.trip || w.missions.coin !== 20 || w.eggs.length !== eggs || w.missions.pendingReveal.length || w.missions.firstSuccess.length) fail(`failure: the trip ended with ${w.missions.coin} coin, ${w.eggs.length} eggs, reveals ${w.missions.pendingReveal}`);
    noteUse(w);
    // (a failure that met every stop turns back at the last, and its log says why)
    const v = new CareSim(START_ROOMS, START_DRAGONS, START_KEEPERS, { seed: 1, dayLen: 600 }), m = v.missions.board[0];
    const road = roadOf(v, m, bestTeam(v, m), false), last = road.stops[road.stops.length - 1];
    if (!road.stops.every((s) => s.covered) || road.turnBack !== road.stops.length - 1 || !/WEATHER TURNS/.test(last.log)) fail(`failure: met in full, it turns back at ${road.turnBack} ("${last.log}")`);
    console.log(`  21 failure: met in full and still failing, the last stop says why: "${last.log}"`);
    console.log(`  21 failure: seed ${seed} (of ${tried} tried) fails RIPPLE alone on THE LOST NEST at ${(t.odds * 100).toFixed(0)} %: it turns back at stop ${t.turnBack} ("${t.stops[t.turnBack!].log}"), home with ${w.missions.coin} coin (half) and no egg, nothing revealed`);
  }
}

// ---------- 22. a trip's outcome is the seed's ----------
if (MAIN) {
  // the same send on 20 seeds, twice: the same outcome, egg and road each time (rolled once, at SEND, from rngAt)
  // (the LOST NEST by the muster team; the LOST NEST by BEST TEAM; and the day's second mission by BEST TEAM: a real roll)
  const trip = (w: CareSim) => { const t = w.missions.trip!; return { s: t.success, e: t.egg, n: t.nest, r: t.stops.map((s) => s.log), b: t.turnBack }; };
  const world = (seed: number) => new CareSim(START_ROOMS, START_DRAGONS, START_KEEPERS, { seed, dayLen: 600 });
  const run = (seed: number) => {
    const a = world(seed); sendLostNest(a);
    const b = world(seed), bm = b.missions.board[0]; send(b, bm.id, bestTeam(b, bm));
    const c = world(seed), cm = c.missions.board[1]; send(c, cm.id, bestTeam(c, cm));
    return JSON.stringify([trip(a), trip(b), c.missions.trip ? trip(c) : null]);
  };
  let wins = 0, eggs = 0, rolled = 0, rolledWins = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const a = run(seed), b = run(seed), p = JSON.parse(a);
    if (a !== b) fail(`outcome: seed ${seed}'s sends differ run to run`);
    if (!p[0].s || !p[1].s) fail(`outcome: seed ${seed}'s LOST NEST met in full failed (the muster team ${p[0].s}, BEST TEAM ${p[1].s})`);
    for (const q of p) {
      if (!q) continue;
      if (q.s) wins++;
      if (q.e) eggs++;
      if (!!q.e !== q.s) fail(`outcome: seed ${seed}'s ${q.s ? 'success' : 'failure'} ${q.e ? 'brought' : 'did not bring'} an egg (a first success always does, a failure never)`);
    }
    if (p[2]) { rolled++; if (p[2].s) rolledWins++; }
  }
  const nest1 = world(1), m1 = nest1.missions.board[0];
  if (!tutorial(m1) || tutorial(nest1.missions.board[1])) fail('outcome: only day 1\'s LOST NEST is the tutorial');
  console.log(`  22 outcome: 20 seeds, three sends each, the same twice: ${wins} successes, ${eggs} eggs (a first success in a region always brings one); the LOST NEST met in full succeeded on all 20 (seed 1's BEST TEAM at ${Math.round(oddsOf(nest1, m1, bestTeam(nest1, m1)) * 100)} %), the day's second mission by BEST TEAM ${rolledWins} of ${rolled}`);
}

// ---------- 24. the watchable scene (plan S9: #5.3 on the road, #5.5 the big baddie) ----------
if (ROLE === 'service') {
  // an easy, a normal and a hard mission with its baddie (each of the three), each with both outcomes where it matters:
  // every step of the trip's time read from the scene's pure function, and checked against the last step's
  const runs: [RegionId, Difficulty, boolean][] = [['millbrook', 'easy', true], ['millbrook', 'easy', false], ['bramblewood', 'normal', true], ['bramblewood', 'normal', false],
    ['oldmine', 'hard', true], ['oldmine', 'hard', false], ['highfold', 'hard', true], ['frostmere', 'hard', true]];
  const EXITS: readonly string[] = ['calmed', 'outwitted', 'drivenOff'];
  // (the outwitted one wanders off at a plain walk: the art kit's exitLook, S9a; 'leave' is the driven-off shuffle)
  const EXIT_LOOK: Readonly<Record<string, { pose: string; face: string }>> = { calmed: { pose: 'sit', face: 'sleepy' }, outwitted: { pose: 'walk', face: 'neutral' }, drivenOff: { pose: 'leave', face: 'grumpy' } };
  let travelSteps = 0, inFrame = 0, frames = 0;
  const lines: string[] = [];
  for (const [region, diff, success] of runs) {
    const sim = newSim(1), trip = demoTrip(sim, region, diff, success), L = trip.mission.days * sim.dayLen, what = `scene: ${region} ${diff} (${success ? 'success' : 'failure'})`;
    trip.departAt = sim.clock; trip.returnAt = sim.clock + L;
    // (the trip's road is the missions' own -- missions.ts roadOf -- and every stop's log is `NAME - WHO WHAT`: the
    // banner shows the name alone as the stop is reached)
    for (const q of trip.stops) { const name = q.kind === 'baddie' ? BADDIES[q.baddie!].name : CHALLENGES[q.challenge!].name; if (!q.log.startsWith(`${name} - `) || q.log.length <= name.length + 3) fail(`${what}: the stop's log "${q.log}" is not NAME - WHO WHAT`); }
    const team = trip.pairs.map((p) => sim.dragons.find((d) => d.id === p.dragon)!), gaits = team.map((d) => gaitOf(d.element, d.stage));
    const first = trip.stops.findIndex((q) => !q.covered), b = success ? null : first >= 0 ? first : trip.stops.length - 1;
    if (trip.turnBack !== b) fail(`${what}: turns back at stop ${trip.turnBack}, not the first uncovered (${b})`);
    const starts = trip.stops.map((q) => Math.round(q.at * L)), lens = trip.stops.map((q) => (q.kind === 'baddie' ? baddieBeatLen(L) : beatLen(L)));
    let prev: SceneFrame | null = null, nb: number | null = null, turnAt: number | null = null, exitSeen: string | null = null, lastOff: number | null = null;
    const lastStop = b ?? trip.stops.length - 1;
    let logAhead = 0;
    const z = sceneAt(sim, trip, trip.departAt);
    if (z.xs.some((x, i) => x !== -PAIR_BACK * i) || z.n !== 0 || z.done) fail(`${what}: at E = 0 the team is at ${z.xs.join(', ')} (n ${z.n}, done ${z.done}), not at its places`);
    if (!isDeepStrictEqual(sceneAt(sim, trip, trip.departAt + 12345), sceneAt(sim, trip, trip.departAt + 12345))) fail(`${what}: two reads of one clock differ`);
    for (let c = trip.departAt - 3; c <= trip.returnAt + 3; c++) {
      const f = sceneAt(sim, trip, c), E = c - trip.departAt;
      frames++;
      if (f.done !== (E >= L)) fail(`${what}: done is ${f.done} at E ${E} of ${L}`);
      if (f.facing === -1 && turnAt == null) { turnAt = E; nb = f.n; }
      if (f.baddie) inFrame++;
      // (the TRIP LOG tells a stop -- met or unmet, and the stops past a turn-back never -- exactly when the scene has
      // shown how it went, its banner past the stop's name: maptable.ts stopStates by missionview.ts stopShownAt)
      const st = stopStates(sim, trip, c), seen = (i: number) => {
        const head = trip.stops[i].log.split(' - ')[0];
        return i <= lastStop && f.last != null && (i < f.last || (i === f.last && f.banner !== head && f.banner !== `${head}!`));
      };
      for (let i = 0; i < trip.stops.length; i++) {
        const want = i > lastStop ? (seen(b!) ? 'never' : 'ahead') : seen(i) ? (trip.stops[i].covered ? 'met' : 'unmet') : 'ahead';
        if (st[i] !== want && logAhead++ < 3) fail(`${what}: the TRIP LOG says stop ${i} is ${st[i]} at E ${E}, the scene ${want} (banner "${f.banner}")`);
      }
      if (f.baddie && trip.exit && f.baddie.pose === EXIT_LOOK[trip.exit].pose && f.baddie.face === EXIT_LOOK[trip.exit].face) exitSeen = trip.exit;
      if (f.baddie && ((f.baddie.face as string) === 'angry' || !['neutral', 'grumpy', 'surprised', 'sleepy'].includes(f.baddie.face))) fail(`${what}: the baddie's face is ${f.baddie.face}`);
      // (it moves only the way it faces -- in from the right facing the team, then its exit's way, the art kit's exitLook
      // -- and one that walks off (outwitted, driven off) stays ahead of every rider until it is off the screen's right
      // edge: never back through the team)
      if (f.baddie && prev?.baddie && (f.baddie.x - prev.baddie.x) * f.baddie.facing < -1e-9) fail(`${what}: the baddie moved ${f.baddie.x - prev.baddie.x} facing ${f.baddie.facing} (${f.baddie.pose}) at E ${E}`);
      if (f.baddie && (trip.exit === 'outwitted' || trip.exit === 'drivenOff')) {
        if (f.xs.some((x) => x + RIDER_AHEAD >= f.baddie!.x)) fail(`${what}: the baddie (${trip.exit}, ${f.baddie.pose} at x ${f.baddie.x}) is not ahead of the team (${f.xs.map((x) => x + RIDER_AHEAD).join(', ')}) at E ${E}`);
        lastOff = f.baddie.x - f.camX;
      }
      if (prev) {
        if (f.n < prev.n) fail(`${what}: n fell from ${prev.n} to ${f.n} at E ${E}`);
        for (let i = 0; i < f.xs.length; i++) {
          const dx = f.xs[i] - prev.xs[i];
          if (f.facing === 1 && dx < -1e-9) fail(`${what}: pair ${i} went back ${dx} before turning back, at E ${E}`);
          if (f.facing === -1 && prev.facing === -1 && dx > 1e-9) fail(`${what}: pair ${i} went on ${dx} after turning back, at E ${E}`);
          if (f.stop != null && prev.stop === f.stop && dx !== 0) fail(`${what}: pair ${i} moved ${dx} in stop ${f.stop}'s beat, at E ${E}`);
        }
        // (no skate: a travel step moves each dragon by its walk's distance over that step at its speed -- s times the
        // move of the frame it is in, when the step stays in one frame)
        if (f.stop == null && prev.stop == null && !f.done && f.facing === prev.facing && f.n === prev.n + 1) {
          travelSteps++;
          for (let i = 0; i < f.xs.length; i++) {
            const g = gaits[i], s = f.speeds[i], t0 = s * (prev.n - (f.facing < 0 ? nb! : 0)), t1 = s * (f.n - (f.facing < 0 ? nb! : 0));
            const want = f.facing * (walkDist(g, t1) - walkDist(g, t0)), dx = f.xs[i] - prev.xs[i];
            if (Math.abs(dx - want) > 1e-9) fail(`${what}: pair ${i} moved ${dx} at E ${E}, its walk says ${want}`);
            const fr = frameAt(g, t0);
            if (fr === frameAt(g, t1 - 1e-9) && Math.abs(Math.abs(dx) - s * g.frames[fr].move) > 1e-9) fail(`${what}: pair ${i} skated at E ${E}: moved ${dx}, its frame's move x speed is ${s * g.frames[fr].move}`);
          }
        }
      }
      prev = f;
    }
    if (b != null) {
      const want = starts[b] + lens[b];
      if (turnAt !== want) fail(`${what}: turned back at E ${turnAt}, not at the end of stop ${b}'s beat (${want})`);
    } else if (turnAt != null) fail(`${what}: turned back at E ${turnAt} on a success`);
    if (success && trip.mission.baddie) {
      if (!trip.exit || !EXITS.includes(trip.exit)) fail(`${what}: the baddie's exit is ${trip.exit}`);
      if (exitSeen !== trip.exit) fail(`${what}: the baddie's exit (${trip.exit}) was never shown`);
      if (trip.exit !== 'calmed' && (lastOff == null || lastOff <= 640)) fail(`${what}: the baddie (${trip.exit}) was last seen at screen x ${lastOff}, not off the right edge`);
    }
    if (!success && trip.exit != null) fail(`${what}: a failure has an exit (${trip.exit})`);
    lines.push(`${region} ${diff} ${success ? 'home safe' : `home early (turned at stop ${b}, E ${turnAt})`}${trip.mission.baddie ? `, ${trip.mission.baddie} ${trip.exit ?? 'keeps the road'}${lastOff != null ? ` (off ahead of the team, last seen at screen x ${lastOff.toFixed(0)})` : ''}` : ''}`);
  }
  // (the view keeps to the road: the team's pets, synced by clock jumps of 1, 8 and 40 steps and across a 1000-step gap
  // -- a watch closed and reopened -- play on every travel step the very walk frame the road's walk distance is in)
  let petChecks = 0;
  for (const [region, diff, success, plans] of [['bramblewood', 'normal', false, [[1, 1, 1, 1, 1, 1, 1, 1, 1000], [8], [40]]], ['highfold', 'hard', true, [[40]]]] as [RegionId, Difficulty, boolean, number[][]][]) {
    for (const plan of plans) {
      const sim = newSim(1), trip = demoTrip(sim, region, diff, success), L = trip.mission.days * sim.dayLen;
      trip.departAt = sim.clock; trip.returnAt = sim.clock + L;
      const team = trip.pairs.map((p) => sim.dragons.find((d) => d.id === p.dragon)!), gaits = team.map((d) => gaitOf(d.element, d.stage));
      const cast = new ScenePets(sim, trip), what = `scene view: ${region} ${diff} (${success ? 'success' : 'failure'}), steps of ${plan.join(', ')}`;
      // (two stretches of the road, to keep to the suite's 30 s: the start, and from the turn back -- or the first stop -- on)
      const j = success ? 0 : trip.turnBack!, T = Math.round(trip.stops[j].at * L) + (trip.stops[j].kind === 'baddie' ? baddieBeatLen(L) : beatLen(L));
      const inside = (E: number) => E < 4000 || (E >= T - 500 && E < T + 3500);
      let nb: number | null = null, k = 0, bad = 0;
      for (let c = trip.departAt; c <= trip.returnAt; c += inside(c - trip.departAt) ? plan[k++ % plan.length] : 1) {
        if (!inside(c - trip.departAt)) continue;
        const f = sceneAt(sim, trip, c);
        if (f.facing === -1 && nb == null) { for (let q = c; ; q--) { const g = sceneAt(sim, trip, q); if (g.facing === 1) { nb = g.n; break; } } }
        cast.sync(f, c);
        if (f.stop != null || f.done) continue;
        cast.dragonFrames().forEach((fi, i) => {
          petChecks++;
          const want = frameAt(gaits[i], f.speeds[i] * (f.n - (f.facing < 0 ? nb! : 0)));
          if (fi !== want && bad++ < 3) fail(`${what}: pair ${i} plays walk frame ${fi} at E ${f.E}, the road says ${want}`);
        });
      }
    }
  }
  lines.push(`the view's walks on the road's frame at ${petChecks} synced travel steps (jumps of 1, 8, 40 and a 1000-step gap)`);
  // (the preset puts the trip exactly that far along at the frozen step -- the world's own trip, as a sent one is once
  // away: its dragons off the map, its riders away, nobody else's)
  const presetSaves: string[] = [];
  for (const [q, p] of [['oldmine:0.95', 0.95], ['millbrook:0.3', 0.3]] as const) {
    const w = buildSim(tripStart(q, 60), 1);
    for (let i = 0; i < 60; i++) w.step();
    const t = currentTrip(w), f = t && sceneAt(w, t);
    if (!f || f.E !== Math.round(p * f.L)) fail(`scene: trip=${q} at t=60 is at E ${f?.E} of ${f?.L}, not ${p}`);
    if (!t || t !== w.missions.trip || t.state !== 'away' || !t.pairs.every((pr) => w.dragons.find((d) => d.id === pr.dragon)?.place === 'away' && w.keepers.find((k) => k.id === pr.keeper)?.phase === 'away')
      || w.dragons.some((d) => d.place === 'away' && !t.pairs.some((pr) => pr.dragon === d.id))) fail(`scene: trip=${q}'s team is not the world's own, away (${JSON.stringify(t?.state)})`);
    // (and its world is saved exactly, as any: its team left before the world's clock 0 -- departAt below 0 -- and it
    // loads, steps on (landing) and matches the world it was saved from)
    let back: CareSim | null = null;
    try { back = CareSim.fromSave(JSON.parse(JSON.stringify(serialize(w)))); } catch (e) { fail(`scene: trip=${q}'s world (departAt ${t?.departAt}) can't load its own save: ${(e as Error).message}`); }
    if (back) {
      for (let i = 0; i < 2000; i++) { w.step(); back.step(); }
      if (back.digest() !== w.digest()) fail(`scene: trip=${q}'s world, saved and loaded, drifted from the one it was saved from within 2000 steps`);
    }
    presetSaves.push(`${q} (departAt ${t?.departAt})`);
  }
  // (the preview's rider pick asks the missions' seam, as S8's must: BEA, a rider of the Old Mine Road's best team,
  // taken by hand first, rides no more)
  {
    const w = newSim(1), bea = w.keepers.find((k) => k.name === 'BEA')!, rides = () => demoTrip(w, 'oldmine', 'hard', true).pairs.some((p) => p.keeper === bea.id);
    const before = rides();
    w.command({ kind: 'take', keeper: bea.id }); w.step();
    if (!before || !isTaken(w, bea.id) || rides()) fail(`scene: the rider pick with BEA taken: she rode ${before} before, taken ${isTaken(w, bea.id)}, rides ${rides()}`);
  }
  console.log(`  24 scene: ${lines.join('; ')}; ${frames} steps read, ${travelSteps} travel steps without a skate, the baddie in view ${inFrame} of them; the scene's types have no hurt state, and exits only calmed, outwitted or driven off; the trip preset's worlds saved exactly (${presetSaves.join(', ')}); a keeper taken by hand is never picked to ride (seams.ts isTaken)`);
}

// ---------- 25. taking a keeper (#6) ----------
if (ROLE === 'saves') {
  // plan S7 (D5): a keeper taken by the player's hand -- walked, climbing the ladders, picking up, serving and putting
  // back by commands (control.ts) -- on seed 1 at the real day, with the section 2 invariants checked every step
  const through = <T>(v: T): T => JSON.parse(JSON.stringify(v));
  const inv = (w: CareSim, at: string) => {
    for (const d of w.dragons) for (const k of NEEDS) if (!(d.needs[k] >= 0 && d.needs[k] <= 1)) fail(`${at}, step ${w.tick}: ${d.name}'s ${k} is ${d.needs[k]}`);
    for (const j of w.jobs) if (j.keeper && j.keeper.job !== j) fail(`${at}, step ${w.tick}: job ${j.id}'s keeper ${j.keeper.name} is on another job`);
    for (const d of w.dragons) if (w.jobs.filter((j) => j.dragon === d && j.keeper).length > 1) fail(`${at}, step ${w.tick}: two keepers on ${d.name}`);
    if (w.keepers.filter((k) => k.manual || k.pendingTake).length > 1) fail(`${at}, step ${w.tick}: two keepers held by hand`);
    for (const k of w.keepers) {
      if (k.job && !w.jobs.includes(k.job)) fail(`${at}, step ${w.tick}: ${k.name} is on a job that is gone`);
      // (the idle invariant holds for every keeper not held by hand; one held by hand holds a job only at work)
      if (!k.manual && (k.phase === 'idle') !== (!k.job && !k.legs.length)) fail(`${at}, step ${w.tick}: ${k.name} is ${k.phase} with ${k.job ? 'a job' : 'no job'}`);
      if (k.manual && (!!k.job !== (k.phase === 'work') || !['manual', 'pickup', 'work'].includes(k.phase))) fail(`${at}, step ${w.tick}: ${k.name}, held by hand, is ${k.phase} with ${k.job ? 'a job' : 'no job'}`);
      if (k.phase === 'manual' && !k.manual) fail(`${at}, step ${w.tick}: ${k.name} is 'manual' but not held`);
      if (k.manual && k.rushing) fail(`${at}, step ${w.tick}: ${k.name}, held by hand, was rushed`);
      if (!k.climbing && spanOf(k.f, k.x, w.nets.keeper) < 0) fail(`${at}, step ${w.tick}: ${k.name} stands off floor ${k.f} at x ${k.x.toFixed(1)}`);
      if (k.phase === 'work' && k.job) { const sp = w.standAt(k.job.dragon); if (k.f !== sp.f || Math.abs(k.x - sp.x) > 1) fail(`${at}, step ${w.tick}: ${k.name} works with ${k.job.dragon.name} at f${k.f} x ${k.x.toFixed(1)}, not its stand spot`); }
    }
    if (w.lift.moving) { const r = liftRange(w)!, who = inTheBay(w, r[0], r[1]); if (who) fail(`${at}, step ${w.tick}: ${who} is in the lift bay while the car moves floors ${r[0]}-${r[1]}`); }
    for (const d of w.dragons) {
      if (d.move !== 'ride' && spanOf(d.f, d.x, w.nets.dragon[d.stage]) < 0) fail(`${at}, step ${w.tick}: ${d.name} stands off its floor`);
      if (d.act && d.place === 'barn' && (!d.slot || Math.abs(d.x - d.slot.x) >= 0.5 || w.rooms[d.slot.room].kind !== NEED_ROOM[d.act.need])) fail(`${at}, step ${w.tick}: ${d.name} is met for ${d.act.need} away from its slot of the ${NEED_ROOM[d.act.need]}`);
    }
  };
  const step = (w: CareSim, at: string, n = 1) => { for (let i = 0; i < n; i++) { w.step(); inv(w, at); } };
  const send = (w: CareSim, c: Command) => w.command(c);
  /** Walk the keeper held along the floor to x (steering, then letting go of the key); false if not there in `max` steps. */
  const walkTo = (w: CareSim, k: Keeper, x: number, at: string, max = 3000): boolean => {
    let n = 0;
    while (Math.abs(k.x - x) > 0.5 && n++ < max) { const dx = k.x < x ? 1 : -1; if (k.held.dx !== dx || k.held.dy) send(w, { kind: 'steer', dx, dy: 0 }); step(w, at); }
    send(w, { kind: 'steer', dx: 0, dy: 0 }); step(w, at);
    return Math.abs(k.x - x) <= 1.5;
  };
  /** Climb one floor at the ladder here (dy -1 up, 1 down): the steps it took, or -1. */
  const climb = (w: CareSim, k: Keeper, dy: -1 | 1, at: string, max = 400): number => {
    const f = k.f;
    send(w, { kind: 'steer', dx: 0, dy });
    let n = 0;
    while ((k.f === f || k.climbing) && n++ < max) step(w, at);
    send(w, { kind: 'steer', dx: 0, dy: 0 }); step(w, at);
    return k.f === f - dy && !k.climbing ? n : -1;
  };
  /** Take the keeper held to a spot the way a keeper walks (the keepers' net: floors and ladders). */
  const goTo = (w: CareSim, k: Keeper, to: Spot, at: string): boolean => {
    const r = route({ f: k.f, x: k.x }, to, w.nets.keeper);
    if (!r) return false;
    for (const l of r.legs) {
      if (l.f === k.f) { if (!walkTo(w, k, l.x, at)) return false; }
      else { if (!walkTo(w, k, l.x, at)) return false; while (k.f !== l.f) if (climb(w, k, l.f > k.f ? -1 : 1, at) < 0) return false; }
    }
    return k.f === to.f && Math.abs(k.x - to.x) <= 1.5;
  };
  const press = (w: CareSim, at: string) => { send(w, { kind: 'act' }); step(w, at); };
  /**
   * The room a keeper takes a need's supply from on the way to `stand` (a need's rooms repeat: BASE_DESIGN 3), the way
   * the simulation sends its keepers (sim.ts supplyRoom): the hearth, tub or ball box making the whole walk shortest.
   */
  const supplyFor = (w: CareSim, k: Keeper, need: NeedKind, stand: Spot) => {
    let best: (typeof w.rooms)[number] | null = null, cost = Infinity;
    for (const r of w.rooms) {
      if (ROOM_INFO[r.kind].supplies !== need) continue;
      const at = { f: r.floor, x: postX(r) }, a = route({ f: k.f, x: k.x }, at, w.nets.keeper), b = a && route(at, stand, w.nets.keeper);
      if (a && b && a.cost + b.cost < cost) { cost = a.cost + b.cost; best = r; }
    }
    return best;
  };
  /**
   * The whole loop by hand, the plan's script: take BEA, feed EMBER (fetching the bowl), climb to f1 and back down,
   * then up again; 10 000 steps with jobs pending and 20 Rushes; let go. Returns the world and what it saw.
   */
  const script = () => {
    const w = newSim(1), bea = w.keepers.find((k) => k.name === 'BEA')!, ember = w.dragons.find((d) => d.name === 'EMBER')!, at = 'control';
    const out = { w, fed: -1, up: -1, down: -1, jobBy: 0, rushed: 0, held: 0, home: -1, handovers: 0 };
    // 1. take BEA: after one step she is held by hand, free
    for (const k of NEEDS) ember.needs[k] = 1;
    ember.needs.food = 0.3;
    send(w, { kind: 'take', keeper: bea.id }); step(w, at);
    if (!bea.manual || bea.phase !== 'manual' || w.controlled !== bea.id) fail(`control: BEA taken is ${bea.phase}, manual ${bea.manual}, controlled ${w.controlled}`);
    // (the missions' seam says so too -- seams.ts isTaken, which S8's rider pick asks: BEA taken, nobody else)
    if (!isTaken(w, bea.id) || w.keepers.some((k) => k !== bea && isTaken(w, k.id))) fail(`control: BEA taken, isTaken says ${w.keepers.map((k) => `${k.name} ${isTaken(w, k.id)}`).join(', ')}`);
    // 2.-4. EMBER's food at 0.3 (it stands in the ground floor's kitchen); the bowl from the hearth there (the nearest,
    // x 232), then to its stand spot
    if (!walkTo(w, bea, postX(supplyFor(w, bea, 'food', w.standAt(ember))!), at)) fail('control: BEA never reached the hearth');
    const pick = actionFor(w, bea);
    if (pick.kind !== 'pickup' || pick.label !== 'E: TAKE BOWL') fail(`control: at the hearth E would ${JSON.stringify(pick)}, not take the bowl`);
    press(w, at); step(w, at, PICKUP);
    if (bea.carrying !== 'food' || bea.phase !== 'manual') fail(`control: after E and ${PICKUP} steps BEA carries ${bea.carrying} (${bea.phase})`);
    const job = w.jobs.find((j) => j.dragon === ember && j.need === 'food');
    if (!job || !arrived(w, ember)) fail(`control: EMBER's food job is ${job ? `open, EMBER ${ember.move} at x ${ember.x}` : 'not open'}`);
    if (!walkTo(w, bea, w.standAt(ember).x, at)) fail('control: BEA never reached EMBER\'s stand spot');
    const serve = actionFor(w, bea);
    if (serve.kind !== 'serve' || serve.label !== 'E: FEED EMBER') fail(`control: at EMBER's stand spot E would ${JSON.stringify(serve)}, not feed it`);
    press(w, at);
    let n = 0;
    while (bea.phase === 'work' && n++ < 400) step(w, at);
    out.fed = n;
    if (w.stats.doneBy.BEA !== 1 || ember.needs.food !== 1 || bea.phase !== 'manual' || w.jobs.includes(job!)) fail(`control: after the feed doneBy ${JSON.stringify(w.stats.doneBy)}, EMBER's food ${ember.needs.food}, BEA ${bea.phase}`);
    // 5. across the lift bay (the bay rule, R1) to the centre ladder (x 680), up to the upper floor, down, up again
    if (!walkTo(w, bea, LADDER_M_X, at)) fail('control: BEA never reached the centre ladder');
    // (nothing for E at the foot of a ladder: the line says it climbs -- S7 review)
    const lad = actionFor(w, bea);
    if (lad.kind !== 'none' || lad.label !== '↑: CLIMB UP') fail(`control: at the centre ladder's foot the line is ${JSON.stringify(lad)}, not a climb up`);
    out.up = climb(w, bea, -1, at);
    if (out.up < 0 || out.up > 200) fail(`control: W at the centre ladder took BEA to floor ${bea.f} (${out.up} steps; want floor 1 within 200)`);
    out.down = climb(w, bea, 1, at);
    if (out.down < 0 || out.down > 200) fail(`control: S at the centre ladder took BEA to floor ${bea.f} (${out.down} steps; want floor 0 within 200)`);
    climb(w, bea, -1, at);
    // 6. 10 000 steps with jobs pending, 20 Rushes on waiting jobs chosen by rngAt: BEA's job only ever set by E. A Rush
    // falls due every 500 steps and goes on the first open job with no keeper from then on, and she stays held past the
    // 10 000th step until the 20th is made (the repeated need rooms meet a job so soon that an open job with no keeper
    // is rare: on the fixed steps 250, 750, ... only 16 of the 20 found one; waiting for one, 19 by step 10 000)
    let rushDue = false, s = 0;
    for (; s < 10000 || (out.rushed < 20 && s < 30000); s++) {
      if (s % 500 === 250) rushDue = true;
      if (rushDue) {
        const open = w.queue().filter((j) => !j.keeper);
        if (open.length) { w.rush(open[Math.floor(rngAt(1, TAG.BOARD, 17, s).next() * open.length)]); out.rushed++; rushDue = false; }
      }
      step(w, at);
      if (bea.job) out.jobBy++;
    }
    out.held = s;
    if (out.jobBy || !bea.manual) fail(`control: BEA, held by hand and never pressing E, had a job ${out.jobBy} steps (Rushes ${out.rushed})`);
    if (out.rushed < 20) fail(`control: only ${out.rushed} Rushes (no open job to Rush)`);
    // 7. let go: a keeper like the others again at once -- walking home, or (jobs waiting) given one the same step
    send(w, { kind: 'release' }); step(w, at);
    if (bea.manual || w.controlled != null || !(bea.phase === 'home' || bea.job)) fail(`control: let go, BEA is ${bea.phase} (manual ${bea.manual}, a job ${!!bea.job})`);
    if (w.keepers.some((k) => isTaken(w, k.id))) fail(`control: let go, isTaken still says ${w.keepers.filter((k) => isTaken(w, k.id)).map((k) => k.name).join(', ')}`);
    // (and in a calm barn, home to her station and idle there)
    {
      const c = newSim(1), k = c.keepers.find((q) => q.name === 'BEA')!;
      for (const d of c.dragons) for (const q of NEEDS) d.needs[q] = 1;
      send(c, { kind: 'take', keeper: k.id }); step(c, at);
      walkTo(c, k, LADDER_M_X + 20, at);
      send(c, { kind: 'release' }); step(c, at);
      const was = k.phase;
      n = 0;
      while (k.phase !== 'idle' && n++ < 3000) step(c, at);
      out.home = n;
      if (was !== 'home' || k.phase !== 'idle' || k.f !== k.station.floor || Math.abs(k.x - k.stationX) > 0.5) fail(`control: let go in a calm barn, BEA went ${was} and is ${k.phase} at f${k.f} x ${k.x.toFixed(1)}, not idle at her station (x ${k.stationX})`);
      noteUse(c);
    }
    out.handovers = w.stats.handovers;
    return out;
  };
  const a = script(), b = script();
  // 9. the same commands at the same steps, the same world
  if (a.w.digest() !== b.w.digest()) fail('control: the same command script run twice made two worlds');
  noteUse(a.w);
  // every chore by hand (D5: fetch, feed, bathe, play, groom and tuck in; a garden resident too): the barn calm (every
  // need full), BEA fetches the supply if the need takes one and waits at the dragon's stand spot, its need falls to
  // 0.3, and E meets it -- before any keeper sent for it arrives (handing it over if one was)
  const chores: string[] = [];
  {
    const w = newSim(1), bea = w.keepers.find((k) => k.name === 'BEA')!, at = 'control chores';
    const calm = () => { for (const d of w.dragons) for (const k of NEEDS) d.needs[k] = 1; };
    calm();
    send(w, { kind: 'take', keeper: bea.id }); step(w, at);
    for (const [name, need] of [['EMBER', 'food'], ['RIPPLE', 'bath'], ['ZAP', 'play'], ['BRAMBLE', 'love'], ['WICK', 'sleep']] as [string, NeedKind][]) {
      calm();
      const d = w.dragons.find((q) => q.name === name)!, sup = supplyFor(w, bea, need, w.standAt(d));
      if (sup) {
        if (!goTo(w, bea, { f: sup.floor, x: postX(sup) }, at)) { fail(`control: BEA never reached the ${sup.kind}'s post`); continue; }
        press(w, at); step(w, at, PICKUP);
        if (bea.carrying !== need) fail(`control: BEA at the ${sup.kind}'s post carries ${bea.carrying}, not ${need}'s supply`);
      } else if (bea.carrying) {
        // (a supply she has no use for goes back to its post first)
        const back = w.rooms.find((r) => ROOM_INFO[r.kind].supplies === bea.carrying)!;
        goTo(w, bea, { f: back.floor, x: postX(back) }, at);
        const p = actionFor(w, bea);
        if (p.kind !== 'putback') fail(`control: at the ${back.kind}'s post with its supply E would ${JSON.stringify(p)}, not put it back`);
        press(w, at);
        if (bea.carrying) fail(`control: E at the ${back.kind}'s post left BEA carrying ${bea.carrying}`);
      }
      if (!goTo(w, bea, w.standAt(d), at)) { fail(`control: BEA never reached ${name}'s stand spot`); continue; }
      calm(); d.needs[need] = 0.3;
      let n = 0, p = actionFor(w, bea);
      while (p.kind !== 'serve' && n++ < 600) { step(w, at); p = actionFor(w, bea); }
      const done = w.stats.doneBy.BEA ?? 0;
      press(w, at);
      n = 0;
      while (bea.phase === 'work' && n++ < 400) step(w, at);
      if ((w.stats.doneBy.BEA ?? 0) !== done + 1 || (need !== 'sleep' && d.needs[need] !== 1)) fail(`control: E at ${name}'s stand spot (${p.label}) did not meet its ${need} (${d.needs[need].toFixed(2)})`);
      else chores.push(p.label.replace('E: ', '').toLowerCase());
    }
    noteUse(w);
    // a garden resident: met by hand where it rests (the garden preset, TOMAS out to BRAMBLE)
    const g = buildSim(startSpec('garden'), 1), tom = g.keepers.find((k) => k.name === 'TOMAS')!, r = g.dragons.find((d) => d.place === 'garden')!;
    send(g, { kind: 'take', keeper: tom.id }); step(g, at);
    for (const d of g.dragons) for (const k of NEEDS) d.needs[k] = 1;
    r.needs.love = 0.3;
    let n = 0;
    while (!(r.goalJob != null && arrived(g, r)) && n++ < 6000) step(g, at);
    if (!goTo(g, tom, g.standAt(r), at)) fail(`control: TOMAS never reached ${r.name} in the garden`);
    const p = actionFor(g, tom);
    const used = g.stats.used.garden ?? 0;
    press(g, at);
    n = 0;
    while (tom.phase === 'work' && n++ < 400) step(g, at);
    if (p.kind !== 'serve' || r.needs.love !== 1 || g.stats.doneBy.TOMAS !== 1 || (g.stats.used.garden ?? 0) !== used + 1) fail(`control: TOMAS at ${r.name}'s stand spot in the garden: E would ${JSON.stringify(p)}; its love ${r.needs.love.toFixed(2)}`);
    else chores.push(`${p.label.replace('E: ', '').toLowerCase()} in the garden`);
    noteUse(g);
  }
  // saves: a keeper held by hand is saved released -- the world a release that step makes (walking home, or at the job
  // at hand, finishing it first) -- and loads never held; each such save, loaded through JSON, steps 5000 on beside the
  // same world given a release that step, to the same world
  const saves: string[] = [];
  {
    const at = 'control saves', kp = (w: CareSim, name: string) => w.keepers.find((k) => k.name === name)!;
    const takeBea = (w: CareSim) => { const k = kp(w, 'BEA'); send(w, { kind: 'take', keeper: k.id }); step(w, at); return k; };
    const moments: [string, () => CareSim][] = [
      ['walking', () => { const w = newSim(1); takeBea(w); send(w, { kind: 'steer', dx: 1, dy: 0 }); step(w, at, 30); return w; }],
      ['climbing', () => { const w = newSim(1), k = takeBea(w); walkTo(w, k, LADDER_M_X, at); send(w, { kind: 'steer', dx: 0, dy: -1 }); step(w, at, 40); return w; }],
      ['picking up', () => { const w = newSim(1), k = takeBea(w); walkTo(w, k, postX(supplyFor(w, k, 'food', w.standAt(w.dragons[0]))!), at); press(w, at); step(w, at, 10); return w; }],
      ['at work', () => {
        const w = newSim(1), e = w.dragons[0];
        for (const k of NEEDS) e.needs[k] = 1;
        e.needs.food = 0.3;
        const k = takeBea(w);
        walkTo(w, k, postX(supplyFor(w, k, 'food', w.standAt(e))!), at); press(w, at); step(w, at, PICKUP); walkTo(w, k, w.standAt(e).x, at); press(w, at); step(w, at, 50);
        return w;
      }],
      ['taken at work', () => {
        const w = newSim(1);
        while (!w.keepers.some((k) => k.phase === 'work') && w.tick < 20000) step(w, at);
        send(w, { kind: 'take', keeper: w.keepers.find((k) => k.phase === 'work')!.id }); step(w, at);
        return w;
      }],
    ];
    for (const [what, mk] of moments) {
      const w = mk(), held = w.keepers.find((k) => k.manual || k.pendingTake);
      if (!held) { fail(`control: no keeper held (${what})`); continue; }
      // (held by hand or taken at work, the missions' seam says taken -- and of nobody else)
      if (w.keepers.some((k) => isTaken(w, k.id) !== (k === held))) fail(`control: ${held.name} held (${what}), isTaken says ${w.keepers.map((k) => `${k.name} ${isTaken(w, k.id)}`).join(', ')}`);
      const blob = serialize(w), loaded = CareSim.fromSave(through(blob)), lk = loaded.keepers[held.id], was = { phase: held.phase, climbing: held.climbing, loaded: lk.phase };
      if (lk.manual || lk.pendingTake || loaded.controlled != null || lk.phase === 'manual') fail(`control: a world saved with ${held.name} held (${what}) loaded with ${held.name} ${lk.phase}, manual ${lk.manual}`);
      if (!isDeepStrictEqual(blob, through(blob))) fail(`control: the save (${what}) changes through JSON`);
      const twin = mk(), since = uses(loaded);
      twin.command({ kind: 'release' });
      for (let s = 0; s < 5000; s++) { twin.step(); loaded.step(); inv(loaded, at); }
      if (loaded.digest() !== twin.digest()) fail(`control: a world saved with ${held.name} held (${what}) and loaded drifted from one given a release that step`);
      noteUse(loaded, since); noteUse(twin);
      saves.push(`${what} (${held.name} ${was.phase}${was.climbing ? ', climbing' : ''}: loaded ${was.loaded})`);
    }
  }
  // 10. R4: let stand in the lift bay, a keeper held by hand walks on the way they face until clear of it -- and at the
  // Aerie deck's end, which lies in the bay, turns and walks out the other way
  const r4: string[] = [];
  {
    const at = 'control R4';
    for (const [what, f, x, facing] of [['the ground floor', 0, LIFT_CX - 8, 1], ['the Aerie deck\'s end', AERIE_F, DECK_X1 - 10, 1]] as [string, number, number, 1 | -1][]) {
      const w = newSim(1), k = w.keepers.find((q) => q.name === 'BEA')!;
      send(w, { kind: 'take', keeper: k.id }); step(w, at);
      // (put there: a test's shortcut to the spot)
      k.f = f; k.x = x; k.y = feetY(f); k.facing = facing;
      let n = 0, stood = 0;
      while (inBay(k.x, KEEPER_HALF) && n++ < 400) { const x0 = k.x; step(w, at); if (k.x === x0) stood++; }
      if (inBay(k.x, KEEPER_HALF) || stood) fail(`control: BEA let stand in the lift bay on ${what} (x ${x}) is at x ${k.x} after ${n} steps, ${stood} of them standing`);
      else r4.push(`${what} out in ${n} steps`);
    }
    // (and walked west along the Aerie deck she stops at its end: the sky bridge on past it, off the screen, is the
    // riders' way off the world, never the hand's -- S8's bridge merged into the keepers' net)
    const w = newSim(1), k = w.keepers.find((q) => q.name === 'BEA')!;
    send(w, { kind: 'take', keeper: k.id }); step(w, at);
    k.f = AERIE_F; k.x = 60; k.y = feetY(AERIE_F); k.legs = []; k.climbing = false;
    send(w, { kind: 'steer', dx: -1, dy: 0 }); step(w, at, 400);
    if (k.f !== AERIE_F || k.x !== HAND_DECK_X0) fail(`control: BEA walked west along the Aerie deck for 400 steps is at floor ${k.f} x ${k.x}, not the deck's end (x ${HAND_DECK_X0})`);
    else r4.push(`walked west on the Aerie, stopped at the deck's end (x ${k.x}), off the bridge`);
  }
  // 11. a keeper held by hand never holds up a grow-up (S7 review): BEA parked at EMBER's stand spot -- inside its new
  // elder body -- as it falls due (the growup preset) and left there; EMBER grows beside her at once and goes on about
  // its needs, none of them ever at 0
  let grewIn = -1;
  {
    const at = 'control grow', w = buildSim(startSpec('growup'), 1), k = w.keepers.find((q) => q.name === 'BEA')!, e = w.dragons.find((d) => d.name === 'EMBER')!;
    send(w, { kind: 'take', keeper: k.id }); step(w, at);
    if (!walkTo(w, k, w.standAt(e).x, at)) fail('control: BEA never reached EMBER\'s stand spot (growup)');
    const due = stageDue(w, e);
    let n = 0;
    while (e.stage !== 'elder' && n++ < 3000) step(w, at);
    grewIn = Math.max(0, w.clock - due);
    if (e.stage !== 'elder' || grewIn > 5) fail(`control: EMBER due with BEA held at its stand spot is ${e.stage} ${grewIn} steps past due`);
    step(w, at, 20000);
    if (w.stats.emptySteps) fail(`control: with BEA parked at EMBER's stand spot a need sat at 0 for ${w.stats.emptySteps} dragon-steps`);
    noteUse(w);
  }
  console.log(`  25 control: BEA taken, fetched the bowl and fed EMBER by hand (${a.fed} steps at work, doneBy ${JSON.stringify(a.w.stats.doneBy)}, ${a.handovers} handed over), climbed the centre ladder up in ${a.up} steps and down in ${a.down}; ${a.held} steps held with ${a.rushed} Rushes and no job she didn't take; let go, home in ${a.home} steps; the same script twice, the same world; every chore by hand: ${chores.join(', ')}; saved held, loaded released and stepping on as a release makes it: ${saves.join(', ')}; R4: ${r4.join(', ')}; parked at EMBER's stand spot as it fell due, it grew ${grewIn} steps past due, no need ever at 0; the missions' seam (seams.ts isTaken) says taken of the keeper held, or taken at work, and of nobody else`);
}

// ---------- 26. the barn's cap (BASE_DESIGN 4.7) ----------
if (MAIN) {
  // the twelve preset (the capacity benchmark's twelve: BARN_CAP dragons) on a 600-step day, EMBER made an elder a tenth
  // of a day from retiring, and a water egg falling due at step DUE: the barn full, the egg waits in its nest (one `full`
  // event, on its due step: the view's "THE BARN IS FULL"), the count never over the cap; EMBER retires, walks out and
  // arrives in the garden -- the barn has room -- and the egg hatches within 2 steps; a save taken while it waits steps
  // on, loaded, to the same world
  const SHORT = 600, H = HATCH_DAYS * SHORT, DUE = 120, through = <T>(v: T): T => JSON.parse(JSON.stringify(v));
  const sp = startSpec('twelve'), cast = sp.dragons.map((p): DragonPlace => (p.name === 'EMBER' ? { ...p, stage: 'elder', days: RETIRE_AT } : p));
  const w = new CareSim(sp.rooms, cast, sp.keepers, { seed: 1, dayLen: SHORT });
  const egg = w.addEgg('water', w.clock + DUE - H);
  if (!egg || barnCount(w) !== BARN_CAP || !barnFull(w)) fail(`cap: the twelve preset holds ${barnCount(w)} dragons (the cap ${BARN_CAP}) and ${egg ? 'an egg' : 'no egg'}`);
  const fulls: number[] = [];
  let most = 0, arrived = -1, hatched = -1, early = 0, saved: CareSim | null = null, savedAt = -1, since: Uses | null = null;
  for (let s = 1; s <= 20000 && !(hatched > 0 && s > hatched + 600); s++) {
    w.step(); saved?.step();
    most = Math.max(most, barnCount(w));
    for (const e of w.events) {
      if (e.kind === 'full') fulls.push(s);
      if (e.kind === 'garden') arrived = s;
      if (e.kind === 'hatch') { hatched = s; if (arrived < 0) early++; }
    }
    // (saved while the egg waits, the barn full, and stepped on beside it)
    if (s === DUE + 300 && w.eggs.length) { saved = CareSim.fromSave(through(serialize(w))); savedAt = s; since = uses(saved); }
  }
  if (fulls.length !== 1 || fulls[0] !== DUE) fail(`cap: the full barn told of its due egg at steps ${fulls.join(', ') || 'none'}, not once at its due step ${DUE}`);
  if (early || most > BARN_CAP) fail(`cap: the egg hatched ${early ? 'while the barn was full' : ''}; the barn held ${most} dragons at most (the cap ${BARN_CAP})`);
  if (arrived < 0 || hatched < 0 || hatched - arrived > 2 || hatched < arrived) fail(`cap: EMBER arrived in the garden at step ${arrived}, the egg hatched at step ${hatched} (want within 2 steps after)`);
  if (!saved || saved.digest() !== w.digest()) fail(`cap: a save taken at step ${savedAt}, the egg waiting, stepped on to ${saved ? 'another' : 'no'} world`);
  noteUse(w); if (saved) noteUse(saved, since);
  console.log(`  26 the barn's cap (${BARN_CAP}): the twelve preset on a ${SHORT}-step day, its egg due at step ${DUE} with the barn full -- one 'full' event, at step ${fulls[0] ?? '-'}; it waited ${hatched - DUE} steps in its nest, the barn never over ${most}; EMBER, retiring, arrived in the garden at step ${arrived} and the egg hatched at step ${hatched}; a save taken at step ${savedAt}, the egg waiting, stepped on to the same world`);
  // and the cap beside the missions: the twelve preset on a 600-step day, EMBER an elder due to retire at step 9000, sends
  // THE LOST NEST (RIPPLE and ECHO, met in full: a success, and its sure egg) from a full barn -- the chooser's BARN FULL:
  // THE EGG WILL WAIT (seams.ts barnRoom 0) and no refusal for it; away, its dragons still count (the barn full every
  // step); landed, the egg's rider carries it from the Aerie down the left tower, along the upper floor, up the centre
  // ladder and west along the hayloft to the Hatchery, and lays it in the nest the mission reserved; it falls due with
  // the barn full (one `full` event, on its due step) and waits; EMBER retires and walks out, and the step after it
  // arrives in the garden the egg hatches
  {
    const RETIRE_STEP = 9000, sp2 = startSpec('twelve');
    const cast2 = sp2.dragons.map((p): DragonPlace => (p.name === 'EMBER' ? { ...p, stage: 'elder', days: RETIRE_DAYS - RETIRE_STEP / SHORT } : p));
    const v = new CareSim(sp2.rooms, cast2, sp2.keepers, { seed: 1, dayLen: SHORT });
    const room0 = barnRoom(v), lost = v.missions.board.find((q) => q.title === LOST_NEST)!;
    const team = ['RIPPLE', 'ECHO'].map((n) => v.dragons.find((d) => d.name === n)!), pairs: { dragon: number; keeper: number }[] = [];
    for (const d of team) pairs.push({ dragon: d.id, keeper: autoRider(v, d, lost, pairs)! });
    const refusal = canSend(v, lost, pairs);
    const sent = send(v, lost.id, pairs);
    if (room0 !== 0 || !barnFull(v) || refusal != null || typeof sent === 'string') fail(`cap (missions): a full barn (room ${room0}) sending THE LOST NEST: ${refusal ?? (typeof sent === 'string' ? sent : 'sent')}`);
    const trip = typeof sent === 'string' ? null : sent, hatchery = v.rooms.find((r) => r.kind === 'hatchery')!;
    if (!trip || !trip.success || !trip.egg || trip.nest == null) fail(`cap (missions): THE LOST NEST met in full brings ${trip ? `${trip.success ? 'a success' : 'a failure'} and egg ${trip.egg} for nest ${trip.nest}` : 'nothing'}, not its sure egg`);
    const dueEvent: number[] = [];
    let awayOver = 0, awaySteps = 0, laidAt = -1, layWhere = '', ladderM = false, arrivedAt = -1, hatchedAt = -1, early = 0, most = 0, carrier: Keeper | null = null;
    for (let s = 1; s <= 16000 && !(hatchedAt > 0 && s > hatchedAt + 60); s++) {
      const had = v.eggs.length;
      v.step();
      most = Math.max(most, barnCount(v));
      if (v.missions.trip?.state === 'away') { awaySteps++; if (barnCount(v) !== BARN_CAP || barnRoom(v) !== 0) awayOver++; }
      for (const k of v.keepers) if (k.carrying === 'egg') { carrier = k; if (k.climbing && Math.abs(k.x - LADDER_M_X) < 0.5) ladderM = true; }
      if (!had && v.eggs.length) { laidAt = v.clock; layWhere = carrier ? `${carrier.name} at f${carrier.f} x ${carrier.x.toFixed(0)}` : 'nobody'; if (!carrier || carrier.f !== hatchery.floor || Math.abs(carrier.x - nestX(hatchery, trip?.nest ?? 0)) > 1 || v.eggs[0].nest !== trip?.nest) fail(`cap (missions): the egg laid in nest ${v.eggs[0].nest} by ${layWhere}, not in the reserved nest ${trip?.nest} (x ${nestX(hatchery, trip?.nest ?? 0)} on floor ${hatchery.floor}) by its rider`); }
      for (const e of v.events) {
        if (e.kind === 'full') dueEvent.push(v.clock);
        if (e.kind === 'garden') arrivedAt = s;
        if (e.kind === 'hatch') { hatchedAt = s; if (arrivedAt < 0) early++; }
      }
    }
    if (!awaySteps || awayOver) fail(`cap (missions): with the team away the barn was not full on ${awayOver} of ${awaySteps} steps (away dragons count)`);
    if (!ladderM) fail('cap (missions): the egg\'s rider never climbed the centre ladder to the hayloft\'s Hatchery');
    if (laidAt < 0 || dueEvent.length !== 1 || dueEvent[0] !== laidAt + HATCH_DAYS * SHORT) fail(`cap (missions): the egg laid at clock ${laidAt} told of its due at clocks ${dueEvent.join(', ') || 'none'} (want once, at ${laidAt + HATCH_DAYS * SHORT})`);
    if (early || most > BARN_CAP || arrivedAt < 0 || hatchedAt < arrivedAt || hatchedAt - arrivedAt > 2) fail(`cap (missions): the egg hatched at step ${hatchedAt}, the retiree arrived at ${arrivedAt}${early ? ' (it hatched first)' : ''}, the barn held ${most} at most (want within 2 steps after, never over ${BARN_CAP})`);
    noteUse(v);
    console.log(`  26 the cap beside the missions: the twelve preset (the barn full: room ${room0}) sent THE LOST NEST with ${trip?.pairs.map((q) => `${v.dragons.find((d) => d.id === q.dragon)!.name} and ${v.keepers.find((k) => k.id === q.keeper)!.name}`).join(', ')}, a ${trip?.egg} egg for nest ${trip?.nest}, unrefused; away ${awaySteps} steps, the barn full on every one; its rider carried the egg down the left tower and up the centre ladder to the Hatchery, laid by ${layWhere} at clock ${laidAt}; one 'full' event, at its due (clock ${dueEvent[0] ?? '-'}); EMBER arrived in the garden at step ${arrivedAt} and the egg hatched at step ${hatchedAt}, the barn never over ${most}`);
  }
}

// ---------- 10 with 23, 2 with 24, 6 with 25 (the workers' results) ----------
if (MAIN) {
  const mainMs = performance.now() - T0, took: string[] = [];
  for (const [role, done] of WORKERS) {
    const r = await done;
    for (const l of r.lines) console.log(l);
    for (const f of r.fails) fail(f);
    for (const [k, v] of Object.entries(r.used)) USED[k] = (USED[k] ?? 0) + v;
    r.usedRoom.forEach((v, i) => { USED_ROOM[i] += v; });
    took.push(`${role} ${(r.ms / 1000).toFixed(1)} s`);
  }
  console.log(`  wall: the main thread's sections ${(mainMs / 1000).toFixed(1)} s, the workers' ${took.join(', ')}; the suite ${((performance.now() - T0) / 1000).toFixed(1)} s (the budget: 30 s)`);
}

// ---------- 8 (the whole suite). every named room used (#11) ----------
if (MAIN) {
  // every named room in the start, the lift and the Aerie: used somewhere in this suite, unless PLANNED; a PLANNED one unused
  const named = [...new Set([...START_ROOMS.map((r) => r.kind as string), ...Object.keys(STRUCTURES)])];
  for (const k of named) {
    const n = USED[k] ?? 0;
    if (PLANNED.has(k) ? n > 0 : n === 0) fail(PLANNED.has(k) ? `rooms: the ${k} is PLANNED but was used ${n} times: its mechanic has landed, take it off PLANNED` : `rooms: the ${k} is named and furnished but nothing used it (#11)`);
  }
  for (const k of PLANNED) if (!named.includes(k)) fail(`rooms: PLANNED names ${k}, which the building hasn't got`);
  // (every mechanic has landed, so nothing is planned any more -- #11 is closed)
  if (PLANNED.size !== 0) fail(`rooms: PLANNED still names ${[...PLANNED].join(', ')} (the missions land the last of them)`);
  // and every room itself (a need's rooms repeat, and each copy must earn its name): every room of the start whose kind
  // is not PLANNED used at least once (stats.usedRoom: a need met in its slot, a supply taken at its post, an egg laid
  // or hatched in it, a pass through it)
  const rooms = placeRooms(START_ROOMS), unused = rooms.filter((r) => !PLANNED.has(r.kind) && !USED_ROOM[r.id]);
  if (unused.length) fail(`rooms: ${unused.map((r) => `room ${r.id} (the ${r.kind} on floor ${r.floor})`).join(', ')} named and furnished but never used (#11)`);
  console.log(`  8 rooms used over the suite: ${named.filter((k) => !PLANNED.has(k)).map((k) => `${k} ${USED[k] ?? 0}`).join(', ')}; planned: ${[...PLANNED].join(', ') || 'none'}; room by room: ${rooms.filter((r) => !PLANNED.has(r.kind)).map((r) => `${r.id} ${r.kind}${r.part === 'barn' ? ` f${r.floor}` : ''} ${USED_ROOM[r.id]}`).join(', ')}`);
}

if (MAIN) {
  if (fails.length) { console.log('SIM: FAIL\n' + fails.map((f) => '  ' + f).join('\n')); process.exit(1); }
  console.log('SIM: the barn runs: every check passed');
}

// (a worker: its sections done, what they found goes back to the main thread)
if (!MAIN) parentPort!.postMessage({ fails, used: USED, usedRoom: USED_ROOM, lines: LOG, ms: performance.now() - T0 } satisfies WorkerResult);
