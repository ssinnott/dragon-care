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
//    walk speeds and each room's own uses are kept, and one it can't keep throws; and on a short day, with eggs incubating
//    (BASE_DESIGN 7), a baby walking to the module slot it will grow up in, an egg just hatched and a dragon just grown up;
//    and with the garden (BASE_DESIGN 3, The Garden): residents napping, sitting, strolling, waiting and being met, elders
//    setting off, riding down, passing the gate and arriving; and with a mission's team out (BASE_DESIGN 5): mid-muster,
//    departing, away, landing (the egg carried down, the saddles hung back) and resting; a save survives JSON unchanged,
//    every field is in it; another version throws, and so does one whose missions this build can't run; and a failing
//    trip saved the way a build from before teams walked every road whole saved it (its turn-back, lines telling the
//    failure, no exit) loads told as this build tells it, and steps on the same.
// 7. rngAt: the same keys give the same draws, different tags different ones, and the draws are even.
// 8. Rooms (#11): every room kind and structure has a purpose, each need is met in exactly one kind of room (its rooms
//    repeated on the floors: the barn room by room as BASE_DESIGN 3's table says -- floor, module, post, the keepers'
//    waiting spot, an adult's stand spot), the plates name only rooms and structures there are (none on a bare slot),
//    placing rooms and dragons keeps the building's rules (no room on the lift; a slot per dragon, fitting its stage),
//    the start stands in its rooms and the keepers wait at their fixed stations, clear of every grown dragon's slot (a
//    resting baby's tail a little in, never its head); and (checked at the end, over the whole suite) every named room,
//    the lift, the Aerie, the gate and the garden were used (sim.stats.used), and every room itself (stats.usedRoom:
//    each copy of a need's room) -- #11: every named, furnished room has a real purpose, proven used.
// 9. Gait (#7: dragons walk by their anims' own root motion): every walk's table is the same whatever the seed, it
//    moves as its anim table's frames and an anim player playing it say (a walk with an intro too, wrapping and caught
//    up as the view does), played faster by the lively step (BASE_DESIGN 2: on and off the car and across the bay) it moves
//    its body by exactly the same factor as the player at that speed, and a dragon walked by the simulation across
//    the lift bay moves exactly as far as the anim player playing its walk at the lively step's speeds would carry it;
//    the paper turn is the yard's.
// 10. Barn capacity (BASE_DESIGN 4.7): the benchmark cast `twelve` (tools/capacity.ts) for 30 minutes, checked every
//    step as section 2 -- no need empty, short waits, the car mostly free, no stall, no two in the shaft; eight adults,
//    ten, and the ages preset's twelve keep their service; the `full` preset, forced 9 over the cap, keeps moving with
//    its egg waiting; and a barn of babies -- any mix under the cap -- is served: four babies each
//    resting in the room another wants are met (a job's wait for its own floor's room ends at SOON), twelve babies
//    packed from the ground floor up served for 30 minutes, and two walking up to a landing at one spot placed in the
//    order they stand, never turned back and forth. (It runs in three worker threads beside the other sections, and is
//    printed at the end: the suite keeps to 30 s.)
// 11. The clock (docs/BASE_DESIGN.md 7) on a real day and a 600-step test day: the day, the hour and the phase at each
//    phase's start, the sky's three stepped thirds over a phase's first hour, day 2 at midnight, a whole day read step
//    by step (the phases in order, the turn never going back; the lights, the HUD's sun or moon and the walls' night
//    step (BASE_DESIGN 7: 0 under the day's sky, 3 under the night's, with the lamps' rings, every step 0-3 over a day) in
//    step with the sky, never switching on a phase's first step), the label (and the top bar's room for it to day 99 999), and a
//    world's start hour.
// 12. Night is not the barn's (BASE_DESIGN 7): a world started at 07:00 and one started at 19:00, the same seed, are the same
//    barn (save.ts barnKey: every absolute clock left out) every 1000 steps for 20000 -- so view=base's no-tint check,
//    day against night, compares one world -- and no simulation module of the barn reads the day's phase but the two
//    that may: garden.ts (its residents nap at night; sim.ts and life.ts call into it, and its state, the residents'
//    rhythm, is left out of barnKey) and missions.ts (the Map Room's board is rolled at dawn).
// 13. Growing up (#8: "a 'month' of game time to have a dragon grow from one age class to another"; BASE_DESIGN 7): on a
//    600-step day, a baby grows young, adult and elder, one grow event each, its stage's start moved on exactly 30 days
//    each time (the elder stage's, which has no next, the step it grew: its time to the garden is all its own), after
//    walking from the Hatchery to a module slot, and its drains follow the new stage; a stage-up only
//    ever applies to a dragon settled in a slot it fits (no act, no keeper on it) with no keeper where its new body
//    will be, and it then holds still for exactly its `happy` (no walk, no turn, no act, no keeper coming); the delay
//    from falling due is short alone and bounded by an errand in the busy barn; at the real day's length, 30 days less
//    a minute in, an adult is an elder within a minute of play; and a baby on its way to grow up, Rushed to a need in
//    the room it is going to, is served in a baby's sub-slot there, never in the module slot.
// 14. Eggs (#5: "We can get eggs on a mission" -- the Hatchery's side, under the hayloft's west slope): three eggs fill the three nests and a fourth is not
//    taken; an egg hatches exactly two days after it was laid into a baby with a new id, its element's first free name
//    and the egg's seed, the Hatchery's sub-slots first (one in front of no other egg, then the one nearest its nest);
//    the baby asks for food at once and is fed within three minutes; with every baby sub-slot taken (a small barn) an
//    egg waits in its nest, nothing lost, and hatches as soon as one frees -- but not in a barn over its cap; a baby
//    moved on never comes to rest in the Hatchery; names never repeat and stay within 8 characters; two runs give the
//    same names and seeds.
// 15. Retirement (#10: "dragons who are too old (30 days pass elder) will move to this area"; BASE_DESIGN 3, The
//    Garden): on a 600-step day, the retire preset's seven elders and the busy barn's (seven adults growing elder
//    mid-errand, late, then falling due to retire mid-errand) each retire once -- all but the barn's last flier, which
//    stays on until another dragon can fly a mission (a hatchling grown young, then it retires) -- never before 30 days
//    into the elder stage -- 30 days after the
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
// 17. The Map Room's board (#5: "a world map with different places to explore", "a mission chooser"): the same twice
//    for seeds 1-5 and days 1-10; day 1 starts with THE LOST NEST; three missions at most, one an explored region; no
//    baddie before day 3, and a road ending in one on every baddie's day (3, 7, ...); each difficulty's road its length, from
//    its region's pool; a world rolls it at its start and at every 05:00. The world map's places: every region's titles
//    and its baddie's are its places (a landmark each), every board mission is met at one of its own region's places
//    (THE LOST NEST at WILLOW POND), the map's layout is sound (worldmap.ts mapProblems: each landmark on its own
//    region's dry land, clear of the brook and of every other, each region's name on its land, every big shape placed,
//    no road over the water, every place reached by road from HOME), and under the new game's clouds no pixel of a
//    place shows.
// 18. The forecast (BASE_DESIGN 5.4: the trail coach's dry run of the road, no roll): five hand-picked teams read as the
//    rules say (the stops cleared, the turns, the puff left), an empty team 0, and BEST TEAM on THE LOST NEST is its two
//    counters.
// 19. Who may go: no baby, no young dragon on a normal or hard road, no garden resident; a keeper taken by hand is
//    never an auto rider nor on BEST TEAM, is never given a job, can't be sent (canSend, and a send command refused
//    with its reason), and a rider on a trip can't be taken by hand (control.ts take: a `refused` event) -- all through
//    the take command itself (missions.ts isTaken); a keeper taken at work whose dragon is then sent finishes the job
//    (the dragon keeps its slot till then) and is then the player's where they stand, and steerable; two riders at
//    most, two keepers always home; one team out.
// 20. A full trip (#5: eggs, launched from the Aerie using the Map Room; #11; BASE_DESIGN 11): THE LOST NEST with RIPPLE and
//    ECHO -- the Map Room, the Tack Room, the lift up and the Aerie; the muster in 3600 steps or fewer; away, the team asks
//    for nothing and its needs wait; each stop met as the walk reaches it (a `meet` event) and played by the trail coach
//    once nobody has picked for PICK_WAIT_TRAIL (a `stopEnd` event, its XP); landed once the road is walked whole (the
//    outcome decided there), food and sleep down; the egg laid in its reserved nest (and hatched two days on), the saddles
//    back, the Bunks, the riders on duty again, the coin paid, the neighbour revealed at the next dawn. And the step the
//    muster preset's team stands on the deck (the base_muster shot). And musters sent in the middle of play (BEST TEAM
//    on a board mission, seeds 1-6, 600 and 1500 steps in): each done within MUSTER_MID_MAX (the lift serves one dragon
//    at a time, so a car already under way, or a team dragon at work, makes it longer than a fresh world's). And sends
//    mid-act (seeds 1-6): a keeper at work with a team dragon finishes the job, the dragon asleep sleeps on, and each
//    keeps its slot, nobody else in it, until it sets off; a rider taken mid-tuck-in leaves the dragon asleep, its
//    sleep job done, never tucked in twice.
// 21. A failure (the user's rule: "on a mission you never turn back; the pass fail happens at the end"): a lone pair on
//    a hard road it can't finish (RIPPLE alone against the Mole King, the trail coach playing) walks the whole road --
//    its stops' lines say how each went, the one it sat out waited out, and the scene's team never takes a step back,
//    reaching every stop and the road's end -- the TRIP LOG telling each stop and never the outcome, which the result
//    card tells there (NOT THIS TIME); it lands with half the coin and no egg, and reveals nothing. Met in full, a road's
//    lines tell no outcome either.
// 22. A trip's road is the seed's: the same sends on 8 seeds, twice, played through by the trail coach, the same stops'
//    results and lines, the same outcome, egg and coin (every roll a stateless rngAt); THE LOST NEST with both counters
//    clears both stops on every seed (the tutorial: a sure egg, laid), and BEST TEAM on the day's second mission wins.
// 23. Care while a team is away (BASE_DESIGN 5.2: two keepers home are enough): a two-pair team away a 30-minute walk of
//    the real day and its two stops; no need at home ever empties, and the barn's service holds (the average wait within
//    25 % of section 2's gate).
// 24. The watchable scene (#5: the challenges on the road, "end with a big baddie"; BASE_DESIGN 6, 11): an easy, a normal
//    and each baddie's hard road (Old Mine Road's, Highfold's and Frostmere's) by their best two pairs, and the Mole
//    King's road by a lone pair that can't wear it out, the trail coach playing, read from the scene's pure function at
//    every step of the trip: the team at its places as it leaves and done when it lands (the result card's title the
//    outcome's), its walk never falling, its dragons never walking back (a team never turns back: every stop reached, a
//    failure's too), standing still through every stop's encounter (met at exactly its step, ended at exactly the
//    `stopEnd` event's, its line `NAME - HOW`), each walk step moving each dragon by exactly its walk's distance over
//    that step at its speed (no skate: s times the frame's move, within 1e-9), a baddie's face only one of the four,
//    and its exit (calmed, outwitted, driven off) shown on every trip, the baddie only ever moving the way it faces, and
//    one that walks off (outwitted, driven off: the art kit's exitLook) ahead of every rider until it is off the
//    screen's right edge; the banner never telling the outcome; the set pieces and the TRIP LOG telling each stop
//    (ahead, met, unmet) as its result stands; the view's team (ScenePets), synced by clock jumps of 1, 8 and 40 and
//    across a 1000-step gap, playing the walk frame the road says on every walk step; the trip preset puts a team
//    exactly that far along at the frozen step, the stops before resolved (`:fail` the last of them waited out) and a
//    stop at that very point met on the first step, the world's own trip, away (its dragons off the map, its riders
//    away), its world saved exactly though its team left before the world's clock 0 (a departAt below 0); the preset's
//    road is the missions' own (missions.ts roadOf) and its rider pick too (autoRider), which passes over a keeper
//    taken by hand (missions.ts isTaken). The Map Room map's flag on the team's road (missionview.ts roadFraction) at
//    every step: 0 until it leaves, climbing while the team walks on, still through every stop, never going back, never
//    outside 0..1, and at the road's end (1) when it lands.
// 25. Taking a keeper (#6: "choose a person - then you will control them and be able to do this chores", "WASD
//    controls - and a button to feed/collect stuff"; BASE_DESIGN 4.10): BEA taken by a command is held by hand after one step,
//    walks to the nearest hearth, takes the bowl (E, 40 steps), feeds EMBER in its kitchen slot from its stand spot
//    (doneBy), crosses the lift bay under the bay rule, climbs the centre ladder up (W) and down (S) within 200 steps;
//    held 10 000 steps or more with jobs pending, until 20 Rushes have gone on open jobs, she is never given a job she
//    didn't take; let go, she is a keeper
//    like the others (in a calm barn, home and idle at her station); the same commands give the same world; every
//    chore by hand (feed, bathe, play with, groom, tuck in; a resident met in the garden), supplies taken and put back;
//    a world saved with a keeper held (walking, climbing, picking up, at work, taken at work) loads with no one held and
//    steps on exactly as the world given a release that step; the bay rule's R4 (BASE_DESIGN 2): let stand in the lift
//    bay she walks on out of it (at the Aerie deck's end, which lies in the bay, turning back); walked west along the
//    deck she stops at its west end, never out along the sky bridge (the riders' way off the world, off the screen),
//    and walked east, short of the lift bay (the car's way up, never the hand's). The section 2 invariants hold every
//    step (the idle one for every keeper not held by hand). missions.ts isTaken, which the rider pick asks, says taken
//    of the keeper held, or taken at work, and of nobody else; let go, of nobody.
// 26. The barn's cap (BASE_DESIGN 4.7; life.ts BARN_CAP): the twelve preset -- the cap's twelve -- with an egg falling
//    due: it waits in its nest while the barn is full (one `full` event, on its due step), the count never over the cap,
//    and it hatches within 2 steps of an elder arriving in the garden; a save taken while it waits steps on the same.
//    And the cap beside the missions: a team sent from a full barn on a road that brings an egg (the chooser says
//    BARN FULL: THE EGG WILL WAIT -- life.ts barnRoom 0 -- and sends it all the same), away dragons still counted; the
//    team lands, its rider carries the egg up to the Hatchery by the keepers' ladders and lays it in the reserved nest,
//    where it waits past its due while the barn is full, and hatches within 2 steps of a retiree arriving in the garden.
// 27. The Arena ("train dragons with one another ... they will gain skills and level up. These fights should happen in an
//    arena"; BASE_DESIGN 10): the rules (training.ts) -- the ring of the seven elements one cycle, each strong against
//    one and weak against one; level L at exactly xpFor(L) XP, 1 to 10; a win brings more XP than a draw and a draw more
//    than a loss, more against a higher level, and a LV 1 sparring a LV 10 is LV 3 or more after one bout; the skills
//    learned at their levels in the move menu's order, four at most, each one of the dragon's own one-shot anims at
//    every stage that spars, landing inside it; the stats never less with a level, the young under the adult, the elder
//    never weaker; the corners on the deck's net, snouts ARENA_GAP apart, neither's eye under the other's body. The
//    balance: every pairing of the start's seven, each way round on four seeds (each element wins 35-65 % of its bouts,
//    4.5-8 turns on average, few running out of turns), and the levels matter (a level up beats its own element, three
//    up the element strong on it). A whole bout in the world by commands, the section 2 invariants checked every step:
//    begun while a keeper is at work with one fighter and the other sleeps -- the keeper finishes, the sleeper sleeps on
//    (the needs wait through a bout, a job or a nap under way doesn't), each keeps its slot until it sets off -- up the
//    lift to the corners (the first up the east one), the Arena used once, the first pick the coach's after PICK_WAIT,
//    skills not yet known refused and a pick mid-move ignored, picks by hand, then AUTO; each move its dragon's own anim,
//    landing at its impact for exactly its cost; the XP, the level and the skill it brings, tired and hungry, the nap
//    and the preen for exactly overLen; home, the west corner first, settled and asking again; no job opens for the two
//    and nobody else sets foot on the Arena deck; the same twice, the same world, and saves taken at every state step on
//    the same. Who may spar (each refusal in its own words, by the command itself); the bout preset; a version 9 save
//    migrated to the same world; 15 bouts this build can't run refused; and no word of harm in any bout's lines or the
//    Arena's text (nobody is hurt: the Decisions' B8, amended for the Arena).
// 28. Encounters on the road ("when you encounter a challenge you need to use special abilities from your dragons to
//    overcome them ... when we encounter enemies we need to fight them ... similar to the battle arena"; BASE_DESIGN 11):
//    the offers (encounter.ts offersFor) at ten stop-and-pair cases -- STRONG for the counter element, HELPS for another,
//    a little at the miller and the hurt animal where a show-off CHARMS, the rider's special where the rider has the
//    stop's counter, PREEN and YAWN in a fight only, the ring's STRONG on the baddie -- each try's chance by its bonus
//    and the mark, and each difficulty's mark; the rules alone (every roll even: an 11): a STRONG dragon passes an
//    easy flood's check on its first try with no bite, one that helps takes another try and is bitten each turn the
//    stop stands (the mark easing), a lone breath that does little at a hard miller is waited out after
//    MAX_OBSTACLE_TURNS tries, the CHARM clears it in one, a dragon out of puff sits, the special costs the Mole King a
//    quarter of its puff and a POWER stage, and the best team wears it out; the balance: each baddie's road by its best
//    two pairs on three seeds won every time in ten turns or fewer, a lone pair with neither counter sat every one out,
//    and THE LOST NEST's two counters cleared both stops in a turn or two on ten seeds; a whole road in the world by
//    commands (seed 2's LOST NEST): met at its step, the picks waited PICK_WAIT_TRAIL for the player then the coach's
//    turn played, each move its dragon's own anim landing at its impact for its roll against the mark; a pick for a pair there
//    isn't, an ability the pair hasn't and a special nobody has refused, a pick by hand taken, AUTO filling the rest at
//    once (the quicker first); the XP, the level and the skill it brings; the same twice, and saves at the meet, the
//    pick, mid-move and the resolution stepping on to the same world; 13 encounters this build can't run thrown out;
//    and no word of harm in any encounter's line or the road's text (the Decisions' B8).
import { isDeepStrictEqual } from 'node:util';
import fs from 'node:fs';
import os from 'node:os';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { CareSim, REACH, DAY_STEPS, START_HOUR, PICKUP } from '../src/game/sim.ts';
import { actionFor } from '../src/game/control.ts';
import type { Command } from '../src/game/control.ts';
import { nextStage, stageDue, inTheWayOfGrowing, staysOn, HATCH_FOOD, BARN_CAP, barnCount, barnFull, barnRoom } from '../src/game/life.ts';
import { CASTS, parseCast, placeCast, runOne } from './capacity.ts';
import { NAMES, NAME_MAX, hatchName } from '../src/game/names.ts';
import { GROWUP_IN, HATCH_IN, EGGS_PRESET, RETIRE_AT, BOUT_PAIR, sendLostNest } from '../src/game/presets.ts';
import {
  boardFor, forecastOf, forecastShare, autoRider, bestTeam, dragonReason, canSend, send, onTrip, roadOf, tripOf, awayNow, placeAlong, upgradeMissions, baddieDay, isTaken, standsAt, DIFFICULTY, BADDIE_FROM_DAY, BOARD_MAX, LOST_NEST, HOME_KEEPERS,
} from '../src/game/missions.ts';
import {
  newEncounter, offersFor, coachPick, foePick, beginTurn, landMove, endTurn, stopLine, partyOf, pendingPair, stopStart, stopName, forecastRoad, walkRest, evenRoll, checkEncounter, pairLook, foeShow,
  MARK, SIDES, MARK_EASE, BITE, REST_GAIN, CHECK_STRONG, CHECK_HELP, CHECK_LITTLE, CHECK_CHARM, FOE_SPECIAL, passes, chanceOf, MEET_STEPS, FOE_ENTER, DONE_STEPS, EXIT_STEPS, PICK_WAIT_TRAIL, MAX_OBSTACLE_TURNS, MAX_FIGHT_TURNS,
  WALK_REST, XP_ROAD, FOE_STATS, FOE_MOVES, FOE, ABILITIES, FACE_FRAMES as ROAD_FACE_FRAMES,
} from '../src/game/encounter.ts';
import type { Ability, Encounter, Party } from '../src/game/encounter.ts';
import { boutNow, stepArena, canSpar, fighterReason, fighterIndex, boutLook, overLen, FACE_STEPS, PICK_WAIT, MAX_TURNS, NAP_STEPS, TIRED, FACE_FRAMES, LOW_NEED } from '../src/game/arena.ts';
import type { BoutState } from '../src/game/arena.ts';
import {
  MAX_LEVEL, xpFor, levelOf, xpInto, boutXp, drawXp, BEATS, BEATS_WHY, STRONG, WEAK, typeMult, statsOf, STAT_NAMES, skillsOf, skillOf, learnedBetween, SKILL_KINDS, LEARN_AT,
  STAGE_MIN, STAGE_MAX, spirits, stageMult,
} from '../src/game/training.ts';
import type { SkillKind } from '../src/game/training.ts';
import type { Taken } from '../src/game/missions.ts';
import { REGIONS, CHALLENGES, BADDIES, regionOf, placeOf } from '../src/game/regions.ts';
import { mapProblems, worldRaster, footprint, PLACES, MAP_COLOURS } from '../src/game/worldmap.ts';
import type { RegionId, ChallengeId, BaddieId } from '../src/game/missiondata.ts';
import type { Mission, Trip } from '../src/game/trip.ts';
import type { DragonPlace } from '../src/game/start.ts';
import type { Keeper, Dragon } from '../src/game/sim.ts';
import {
  NEED_ROOM, TURN_STEPS, TURN_HALF, WAIT_MAX, LEAD_PX, arrived, inTheBay, liftRange, needRoom, dragonSpan, dragonInBay, depthOf, eyeSpan, walking,
  landingEdge, ridesLeft, remainingCost, nearestFree, inBay, KEEPER_HALF, bodySpan, landingLine, LIVELY, DRAGON_EYE,
} from '../src/game/travel.ts';
import { gaitOf, gaitFrom, moveAt, wrapT, happyLen, animLen } from '../src/game/gait.ts';
import { TURN_HALF as YARD_TURN_HALF } from '../src/care/dragon.ts';
import { dragonBuild } from '../src/art/dragon/build.ts';
import { dragonAnims, baseAnims } from '../src/art/dragon/anims.ts';
import { animTuning } from '../src/art/dragon/tuning.ts';
import { DragonAnimPlayer } from '../src/art/dragon/anim.ts';
import { START_ROOMS, START_DRAGONS, START_KEEPERS } from '../src/game/start.ts';
import { startSpec, buildSim, PRESETS } from '../src/game/presets.ts';
import { serialize, barnKey, SaveVersionError, SAVE_VERSION, migrateSave } from '../src/game/save.ts';
import type { SaveV } from '../src/game/save.ts';
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
  ARENA_X0, ARENA_X1, ARENA_GAP, arenaSpot, DRAGON_BODY,
} from '../src/game/layout.ts';
import type { Spot, RoomKind, RoomPlace } from '../src/game/layout.ts';
import { NEEDS, FPS, OWN_NEED, GARDEN_NEEDS, GARDEN_RATE, SOON, hasNeed, drainRate, moodOf } from '../src/game/needs.ts';
import { retireDue, rests, restsClear, restsApart, restOverlap, REST_OVERLAP, residentSpan, isNight } from '../src/game/garden.ts';
import type { Needs, NeedKind } from '../src/game/needs.ts';
import { DRAGON_ELEMENTS } from '../src/art/dragon/palettes.ts';
import type { DragonElement } from '../src/art/dragon/palettes.ts';
import type { Stage } from '../src/art/dragon/stages.ts';
import { STAGES } from '../src/art/dragon/stages.ts';
import { sceneAt, walkDist, frameAt, resultTitle, roadFraction, roadDone, PAIR_BACK, RIDER_AHEAD, BADDIE_AHEAD, PIECE_AHEAD, PASSAGE_CLEAR, ScenePets } from '../src/game/missionview.ts';
import type { SceneFrame } from '../src/game/missionview.ts';
import { hasPassage, PASSAGES, PASSAGE_FROM, PASSAGE_LEN } from '../src/game/passages.ts';
import { demoTrip } from '../src/game/tripdemo.ts';
import { stopStates } from '../src/game/maptable.ts';
import { tripStart } from '../src/game/presets.ts';
import type { Difficulty } from '../src/game/missiondata.ts';

/**
 * The suite in 30 s or less (docs/BASE_DESIGN.md 8.1): the longest independent sections run in five worker threads of
 * this same script (node:worker_threads) while the main thread runs every other section -- `capacity`: section 10's
 * benchmark and crowds (the twelve 30 minutes, eight adults 30, ten 10, the `ages` preset 6); `full`: section 10's
 * over-full `full` preset (21 dragons, 10 minutes); `babies`: section 10's barns of babies with 23 (care while a team
 * is away, 30 minutes of the real day); `service`: section 2 (thirty minutes of play on three seeds, checked every
 * step) with 24 (the watchable scene, read at every step of eight trips); `saves`: section 6 (the saves: every fork
 * stepped 5000 on) with 25 (taking a keeper) and 27 (the Arena) -- each worker runs its sections alone, exactly as the main thread would,
 * and sends back its lines, its failures and its rooms' uses (by kind and room by room), which the main thread prints
 * and counts before the suite's end (then the wall times). Nothing is checked less: a section's code is the same
 * wherever it runs, and no section reads another's results.
 */
type Role = 'main' | 'capacity' | 'full' | 'babies' | 'service' | 'saves';
const ROLE: Role = isMainThread ? 'main' : (workerData as { role: Role }).role;
const MAIN = ROLE === 'main';
type WorkerResult = { fails: string[]; used: Record<string, number>; usedRoom: number[]; lines: string[]; ms: number };
/**
 * The machine's CPU seconds busy so far, every CPU's and every process's (Linux /proc/stat's first line: user, nice,
 * system, irq, softirq and steal, in USER_HZ, 100ths of a second), or null where there is no /proc/stat.
 */
const machineBusyS = (): number | null => {
  try { const f = fs.readFileSync('/proc/stat', 'utf8').split('\n')[0].trim().split(/\s+/).map(Number); return (f[1] + f[2] + f[3] + f[6] + f[7] + f[8]) / 100; } catch { return null; }
};
/** When this thread started (the report's wall times), and the machine's busy CPU time and this process's then (the budget's allowance, at the end). */
const T0 = performance.now(), BUSY0 = machineBusyS(), CPU0 = process.cpuUsage();
/**
 * The suite's budget, wall seconds (BASE_DESIGN 8.1): 30 on four CPUs or more, scaled up on fewer (the six threads
 * share what there is: os.availableParallelism, which heeds the process's CPU affinity) -- and the other work beside it
 * (CPUs, on average) that excuses going over it.
 */
const CPUS = Math.max(1, Math.min(4, os.availableParallelism())), BUDGET_S = Math.round(30 * 4 / CPUS), BUSY_CPUS = 0.5;
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
/** A copy of v through JSON, as a save goes to storage and back. */
const through = <T>(v: T): T => JSON.parse(JSON.stringify(v));
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
 * and frozen with about 20 % headroom (docs/BASE_DESIGN.md 4.7, 4.9, 8.1). The gates a dragon feels most: no need ever
 * empties, done >= 120, a keeper's wait at the stand spot <= 20 s, bay waits <= 60 s, a walking dragon never stands
 * still, nor turns about on one spot, 10 s. The waits: the barn repeats the need rooms on the floors, so a dragon's
 * needs are met on its own floor and the one car is nearly idle (1 to 4 rides in 30 minutes): seeds 1-3 wait 28.4 /
 * 21.6 / 26.0 s on average (mean 25.3), 112.3 s at most -- gated at 31 s (the mean over the three) and 135 s. A
 * landing wait, a rider held in the car and Rush after Rush measure far under their gates (13.0 s, 8.0 s). One seed's
 * numbers move by a fifth either way with any change to who goes when, so the average is gated over the three. An eye
 * under the body of a dragon standing over it (the sim's model: DRAGON_BODY and DRAGON_EYE, the worst of every
 * element) is left only at a crowded landing or bay edge: 3.7 s in all over the three runs, 1.5 s at most. Rush after
 * Rush (one every 30 s): no need empty on seed 1, a rushed job done within GATE.rushedS, keepers standing for rushed
 * dragons under GATE.rushWaitShare of their time.
 */
const SERVICE_SEEDS = [1, 2, 3] as const;
const GATE = { done: 120, waitAvgS: 31, waitMaxS: 135, keeperWaitAvgS: 20, liftWaitS: 124, rideHeldS: 25, bayS: 60, keeperBayS: 30, walkStallS: 10,
  coverS: 10, coverTotalS: 30, rushedS: 150, rushWaitShare: 0.15, rushEmptySteps: 600 } as const;
/**
 * Section 10 (BASE_DESIGN 4.7): the benchmark cast `twelve` (tools/capacity.ts: the start's seven adults, three young and
 * two babies), seed 1, 30 minutes, checked every step with section 2's invariants and eye model (capacity.ts runOne).
 * Measured: no need empty; wait avg 40.2 s, max 154.3 s; 266 done; 44 rides (the car 28 % busy); a landing wait 42.1
 * s, the bay's edge 39.5 s; an eye covered 46.5 s in all, 14.1 s at most; no stall (one held mid-walk, or turned about
 * on one spot), no shaft overlap. Frozen with about 20 % headroom (the landing's 47 s kept); `rides` is a ceiling (the
 * property that the car stays mostly free: the need rooms repeat on the floors). (BASE_DESIGN 4.7's design gates --
 * 42 / 171 s, 217 done, 46 rides, 42 / 37 s, 44 / 17 s -- were measured with a rule that rested a baby moved on in the
 * Hatchery, where a resting baby would hide an egg; without it the landing (42.1 s), bay edge (39.5 s) and eye cover in
 * all (46.5 s) are over the design's by 0.1, 2.5 and 2.5 s, and the rest within.)
 */
const TWELVE = { waitAvgS: 48, waitMaxS: 185, done: 213, rides: 53, landingS: 47, bayS: 47, coverTotalS: 56, coverS: 17 } as const;
/**
 * Section 10's other runs (BASE_DESIGN 4.7; the car no longer carries the barn, so there is no ride-throughput gate): each
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
 * Section 10: twelve babies packed from the Hatchery and the ground floor up, seed 1, 30 minutes --
 * measured 289 jobs done, waits 56.6 s on average and 320.9 s at most (no need at 0, no stall); frozen with about 20 %
 * headroom.
 */
const BABIES_GATE = { done: 231, waitAvgS: 68, waitMaxS: 385 } as const;
/** Section 10's adults past the start's seven (the eighth, ninth and tenth), also section 15's crowded barn. */
const CROWD: readonly DragonPlace[] = [
  // (BASE_DESIGN 3: the need rooms are one module each, repeated on the floors; these are the free module slots in
  // tools/capacity.ts placeCast's order -- the upper floor's kitchen, the hayloft's, the ground floor's romp room)
  { name: 'EIGHTH', element: 'fire', stage: 'adult', seed: 501, slot: { room: 'kitchen', i: 0, n: 1 } },
  { name: 'NINTH', element: 'water', stage: 'adult', seed: 502, slot: { room: 'kitchen', i: 0, n: 2 } },
  { name: 'TENTH', element: 'rock', stage: 'adult', seed: 503, slot: { room: 'romp', i: 0 } },
];
/**
 * Section 13 (BASE_DESIGN 7, Growing up): a stage-up waits until its dragon is settled, so its delay is the rest of
 * whatever the dragon was doing when it fell due (and, settled, a moment more while a keeper walks out of where its new
 * body will be: it holds for that, life.ts). Alone, a baby grows within GROW_ALONE of falling due (a minute of play;
 * measured 233 to 2920 steps over seeds 1-8). In the busy barn a dragon is on an errand nearly all the time -- walking
 * to a need's room, waiting for the one car, being met (docs/BASE_DESIGN.md 4.7) -- so a minute is out of reach there:
 * a stage-up waits out one errand, measured 4061 to 8665 steps at most (68 to 144 s) over seeds 1-8 in section 13's
 * busy run (seed 1: 8665), gated at GROW_BUSY (a real game day, 3 minutes: a thirtieth of a stage). At the real day's
 * length, 30 days less a minute in, an adult (EMBER, seed 1: 2939 steps) is an elder within 180 + GROW_REAL steps.
 */
const GROW_ALONE = 3600, GROW_BUSY = 10800, GROW_REAL = 3600;
/**
 * Section 15 (BASE_DESIGN 3, The Garden): how long past its due (30 days after it grew into an elder) an elder may wait
 * to retire -- a minute of play. It retires as soon as it may be sent somewhere new (not being met, not in the lift's
 * hands or its bay: travel.ts redirectable), so it waits at most the end of a keeper's job at it, or a ride: measured
 * 0-928 steps with the retire preset and 130-1998 in section 15's busy barn (adults grown elder mid-errand, up to 5788
 * steps late) over seeds 1-8 (seed 1: 0 and 1081). (The barn's last flier, which stays on by design, is left out.)
 */
const RETIRE_LATE = 3600;
/**
 * Section 15: how long a retiree may wait at a landing for the car (its one ride, down to the ground floor) -- the
 * barn's landing gate (GATE.liftWaitS) -- and take from setting off to arriving at its plot: 360 s (a retiree's walk
 * out is the barn's whole width and the garden's, at an elder's pace, so it is gated looser than a barn job's wait). A
 * retiree asks for nothing on its way, so no need of its grows more pressing to raise its
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
  // (and out through the Garden Gate to a resident on every plot of a seven-plot garden, either way it faces: BASE_DESIGN 3, The Garden)
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
  // (floors 1-2), the barn and on through the gate to the garden's end (floor 0), or on the roof floor -- the deck and its
  // sky bridge off the world's west edge (floor 5: BASE_DESIGN 5, the missions' way out), and the Arena east of the lift's
  // head, short of the right tower (BASE_DESIGN 10) -- floors 3 and
  // 4 have none, and no route reaches another tower room on the floors where the towers open into the barn -- the
  // gate's arches are the one tower door a dragon fits (every stage walks through it); and no keeper rides the lift
  for (const st of STAGES) {
    const net = sim.nets.dragon[st];
    net.spans.forEach((sp, f) => {
      const [lo, hi] = f === 0 ? [BARN_X, sim.worldW - GARDEN_END] : f <= 2 ? [BARN_X, TOWER_R] : f === AERIE_F ? [BRIDGE_X0, ARENA_X1] : [Infinity, -Infinity];
      for (const [a, b] of sp) if (a < lo || b > hi) fail(`${st}: the dragon net's floor ${f} runs ${a}..${b}, outside ${f === 0 ? 'the barn and the garden' : f <= 2 ? 'the barn' : f === AERIE_F ? 'the deck, its sky bridge and the Arena' : 'any floor a dragon has'}`);
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
    // (each run: the gates a dragon feels most -- no need empties, done >= 120, a keeper's wait at
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
  // and every field of the world itself: a field added to CareSim (as the lift, the garden and the board were) fails here
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
  // life (BASE_DESIGN 7): on a short day, the new game with a baby about to grow up and three eggs in the nests (one hatching
  // at step 300, one at 900, one at 1200); saved while the eggs incubate, while the baby walks to the module slot it
  // will grow up in, the step an egg hatches and the step a dragon grows up -- each loaded (through JSON) and stepped
  // 5000 on in lockstep with the run it came from, to the same world
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
  // the garden (BASE_DESIGN 3, The Garden): the garden preset (residents napping, sitting, strolling, waiting for their keeper and being
  // met by one come out of the barn) and the retire preset on a short day (elders set off, riding down, passing the
  // Garden Gate, arriving at their plots): each saved the first step it is seen, loaded through JSON and stepped 5000 on
  // in lockstep with the run it came from, to the same world; a resident's rhythm saved as its own copy
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
  // missions (BASE_DESIGN 5): THE LOST NEST sent on a short day (seed 2: a success, an egg), saved the first step it is seen
  // mustering (a rider on the way up with a saddle), departing over the bridge, away, landing with the egg carried down,
  // a saddle being hung back, and a rider resting in the Bunks -- each loaded through JSON and stepped 5000 on in
  // lockstep with the run it came from, to the same world; and a save whose missions this build can't run throws
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
    ['a stop on the road there isn\'t', (b) => { b.missions.trip.stops[0].challenge = 'volcano'; }],
    ['no missions', (b) => { delete b.missions; }],
  ];
  for (const [what, f] of bad) {
    const b = through(good); f(b);
    let threw = false;
    try { CareSim.fromSave(b); } catch { threw = true; }
    if (!threw) fail(`save: one with ${what} loaded`);
  }
  // (a save from before the road was played -- version 10 kept a trip as a timer: its return clock, its odds, its
  // outcome rolled at the send, its stops with no results -- brought up to this build (save.ts migrateSave, missions.ts
  // upgradeMissions): a team half way along the Old Mine Road's hard mission, past its first stop's beat, is put that
  // far along its walk with that stop resolved as its counter would have (and the rest ahead), full of puff, no
  // encounter, its odds its forecast and no outcome yet; a version 10 save of a team not yet away is left whole; and the
  // upgraded world loads, steps on and lands by the road)
  {
    const was = buildSim(tripStart('oldmine:0.5'), 1), t = was.missions.trip!, L = t.travel, departAt = t.departAt!;
    const v10 = through(serialize(was)) as any;
    v10.v = 10;
    const ot = v10.missions.trip;
    ot.returnAt = departAt + L; ot.odds = 0.65; ot.success = false;
    for (const k of ['travel', 'walked', 'stats', 'puff', 'xp', 'auto', 'encounter', 'forecast']) delete ot[k];
    ot.stops = ot.stops.map((s: any) => ({ kind: s.kind, challenge: s.challenge, baddie: s.baddie, at: s.at, covered: s.covered, by: s.by, log: s.covered ? `${s.log.split(' - ')[0]} - MET` : `${s.log.split(' - ')[0]} - NOBODY COULD HELP: THEY WAIT IT OUT` }));
    const up = migrateSave(v10) as SaveV;
    if (up.v !== SAVE_VERSION) fail(`save (v10): migrated to version ${up.v}`);
    const ut = up.missions.trip!;
    const reached = ot.stops.filter((s: any) => Math.round(s.at * L) <= 0.5 * L).length;
    if (ut.travel !== L || !(ut.walked >= 0.5 * L - 1 && ut.walked <= L) || ut.encounter !== null || ut.success !== null || Math.abs(ut.forecast - 0.65) > 1e-9 || ut.auto !== false
      || ut.stats.length !== 2 || ut.puff.some((p, i) => p !== ut.stats[i].puff) || ut.xp.some((x) => x !== 0)
      || ut.stops.filter((s) => s.result !== 'ahead').length !== reached || ut.stops.slice(0, reached).some((s) => s.result !== (s.covered ? 'met' : 'unmet') || !s.log || s.resolvedAt == null)
      || ut.stops.slice(reached).some((s) => s.result !== 'ahead' || s.resolvedAt !== null)) fail(`save (v10): the trip came up as ${JSON.stringify({ travel: ut.travel, walked: ut.walked, stops: ut.stops.map((s) => s.result), forecast: ut.forecast, success: ut.success, puff: ut.puff })}`);
    const loaded = CareSim.fromSave(up);
    let landed = false;
    for (let i = 0; i < 60000 && loaded.missions.trip; i++) { loaded.step(); if (loaded.missions.trip?.state === 'return') landed = true; }
    if (!landed || loaded.missions.trip) fail(`save (v10): the upgraded trip never landed (${loaded.missions.trip?.state})`);
    // (a team not yet away: nothing to place; its trip comes up with its walk at 0 and every stop ahead)
    const mw = buildSim(startSpec('muster'), 1), m10 = through(serialize(mw)) as any;
    m10.v = 10; m10.missions.trip.returnAt = null; m10.missions.trip.odds = 0.55; m10.missions.trip.success = true;
    for (const k of ['travel', 'walked', 'stats', 'puff', 'xp', 'auto', 'encounter', 'forecast']) delete m10.missions.trip[k];
    const mu = (migrateSave(m10) as SaveV).missions.trip!;
    if (mu.walked !== 0 || mu.stops.some((s) => s.result !== 'ahead') || mu.success !== null || mu.travel !== mw.missions.trip!.travel) fail(`save (v10): a mustering team came up as ${JSON.stringify({ walked: mu.walked, stops: mu.stops.map((s) => s.result), success: mu.success })}`);
    CareSim.fromSave(migrateSave(m10) as SaveV);
    noteUse(loaded);
    console.log(`  6 saves (missions, a 600-step day): ${forks.map((f) => `step ${f.at} (${f.what})`).join(', ')} step on 5000 to the same world; ${bad.length} saves whose missions can't be run (${bad.map(([w]) => w).join(', ')}) throw; a version 10 save's team half way along the Old Mine Road came up walked ${ut.walked} of ${ut.travel} with ${reached} stop(s) resolved, full of puff, and landed by the road; a mustering team's came up whole`);
  }
}
if (ROLE === 'saves') {
  // missions and a keeper held by hand together (BASE_DESIGN 7, Saves: mid-muster and mid-away, the hand let go on
  // load): THE LOST NEST sent (seed 2, a 600-step day) and a keeper who stays home taken by hand at once,
  // walked back and forth by commands; saved mid-muster (a rider on the way up with a saddle) and mid-away, the save
  // holds nobody by hand, keeps the trip whole, and -- loaded through JSON -- steps 5000 on (through the landing) to the
  // same world as the run given a release that step
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
  // the plates: one per room, the lift's, the Aerie's, the garden's and the Arena's; each names a room placed or a
  // structure, and sits on it (so never on a bare slot): a room's inside its wall, the lift's in its ground-floor bay,
  // the Aerie's over the deck, the Arena's over its own deck, east of the lift's head
  const sim = newSim(), plates = platesOf(sim.rooms), nStructures = Object.keys(STRUCTURES).length;
  if (plates.length !== sim.rooms.length + nStructures) fail(`plates: ${plates.length} for ${sim.rooms.length} rooms and the ${nStructures} structures`);
  const inside = (p: { x: number; y: number; w: number; h: number }, x0: number, x1: number, y0: number, y1: number) => p.x >= x0 && p.x + p.w <= x1 && p.y >= y0 && p.y + p.h <= y1;
  for (const p of plates) {
    if (!(p.names in ROOM_INFO) && !(p.names in STRUCTURES)) { fail(`plates: "${p.text}" names ${p.names}, which is no room or structure`); continue; }
    const r = p.room == null ? null : sim.rooms[p.room];
    const ok = r ? r.kind === p.names && p.text === ROOM_INFO[r.kind].name && inside(p, r.x0, r.x1, floorTop(r.floor), floorTop(r.floor) + WALL_H)
      : p.names === 'lift' ? inside(p, LIFT_X0, LIFT_X1, floorTop(0), floorTop(0) + WALL_H)
      : p.names === 'garden' ? inside(p, GARDEN_X0, GARDEN_X0 + GARDEN_PLOT, floorTop(0) - PITCH, floorTop(0))
      : p.names === 'arena' ? inside(p, ARENA_X0, ARENA_X1, 0, feetY(AERIE_F) - 8)
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
  // slot, and keepers are drawn behind dragons: ART_BIBLE 1.4) -- at most KEEPER_BABY_TAIL px, and never with its head (the eye to
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
  // the lively step (BASE_DESIGN 2; travel.ts LIVELY): a walk played faster moves the body by exactly the same factor --
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
  // travel.ts LIVELY, their bodies moved by the same factor: BASE_DESIGN 2, the lively step). The benchmark (4.7): the
  // cast `twelve` (tools/capacity.ts parseCast / placeCast: the start's seven adults, three young and two babies) runs 30 minutes on seed 1, checked every
  // step by capacity.ts runOne with section 2's invariants and eye model -- no need empty, the waits short, the car mostly
  // free, no stall, no two in the shaft (the 8-seed sweep is `npm run capacity`). Then the crowds the one car was
  // measured against -- eight adults, ten, the ages preset's twelve of every stage -- keep service gates, and the `full` preset,
  // 21 dragons forced 9 over the cap (4.7: every rule holds over it too), keeps moving, its due egg waiting.
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
  // the full preset (BASE_DESIGN 4.7: every rule holds over the cap too): forced 9 over the cap, starved, but moving --
  // jobs done, no keeper giving up, the car never standing with work for a minute -- and its due egg waiting in its nest (the barn full: life.ts); in a worker of its
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
  // a barn of babies -- the late game's: the start's seven retired to the garden, hatchlings in their
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
  // 20 % headroom (measured: BABIES_GATE). Without a job's wait for its own floor's room ending at SOON (travel.ts), the
  // ground floor's babies, each wanting a room another rested in, stood still: 3.1 M need-steps at 0, 83 jobs done
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
  // their riders) sent at once, a 30-minute walk (a test's own length: missions.ts send's awaySteps) and its two stops'
  // encounters (the trail coach's, after each pick's wait); from the send until
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
  // (the walk is the 30 minutes; the two stops' encounters take their own time on top)
  if (awaySteps < AWAY_STEPS || awaySteps > AWAY_STEPS + 6000) fail(`away: the team was away ${awaySteps} steps, not the ${AWAY_STEPS} of its walk and its two stops`);
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
      // (BASE_DESIGN 7: the walls' night step turns with the lamps -- the dorm's rings -- in the same thirds: none under the
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
  // missions.ts, which are not in this list on purpose: the two exceptions (BASE_DESIGN 7), the residents' naps and the Map Room's
  // board rolled at dawn (05:00); each keeps its state out of barnKey (a world's missions are not the barn's care, and
  // without a trip sent nothing they do touches it), and these modules only call into them)
  // (control.ts runs inside CareSim.step -- the hand's commands -- and tripdemo.ts builds the trip preset's team: BASE_DESIGN 4.10, 6)
  const SIM_FILES = ['sim.ts', 'travel.ts', 'needs.ts', 'layout.ts', 'gait.ts', 'save.ts', 'start.ts', 'presets.ts', 'rand.ts', 'life.ts', 'names.ts', 'control.ts', 'tripdemo.ts', 'encounter.ts', 'arena.ts', 'training.ts'];
  const reads = SIM_FILES.filter((f) => /\b(readClock|phaseOf|PHASE_HOURS|PHASE_ORDER|DayPhase|skyBands|nightness|dimness|skyPhase|lightsOf)\b/.test(fs.readFileSync(new URL(`../src/game/${f}`, import.meta.url), 'utf8')));
  if (reads.length) fail(`night: ${reads.join(', ')} read the day's phase (only the view may: BASE_DESIGN 7)`);
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

// ---------- 14. eggs and hatching (#5: eggs; the Hatchery) ----------
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
  // one will to the garden or on a trip), and the egg hatches into its sub-slot the step it frees
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
        // in a full barn; nor the Arena's, none in this run either)
        if (e.kind === 'send' || e.kind === 'refused' || e.kind === 'full' || e.kind === 'bout' || e.kind === 'boutEnd' || e.kind === 'level' || e.kind === 'learn' || e.kind === 'meet' || e.kind === 'stopEnd') continue;
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
  // -- all but the last to be free to go, which stays on as the barn's last flier (life.ts lastFlier: a barn with nobody
  // left to fly a mission would never have an egg again)
  const spec = startSpec('retire'), pre = new CareSim(spec.rooms, spec.dragons, spec.keepers, { seed: 1, dayLen: SHORT });
  const n = pre.dragons.length, a = retireRun(pre, 40000, 'preset', n - 1), res = pre.dragons.filter((d) => d.place === 'garden').length;
  const stays = pre.dragons.filter((d) => d.place === 'barn');
  if (a.retired.size !== n - 1 || a.arrived.size !== n - 1) fail(`retire (preset): ${a.retired.size} of ${n} retired, ${a.arrived.size} arrived (want all but the last flier)`);
  if (stays.length !== 1 || !staysOn(pre, stays[0]) || !stays[0].slot || pre.dragons.some((d) => d !== stays[0] && staysOn(pre, d))) fail(`retire (preset): the barn keeps ${stays.map((d) => `${d.name} (stays on ${staysOn(pre, d)}, slot ${!!d.slot})`).join(', ') || 'nobody'}, not one last flier`);
  if (pre.stats.retireDelayMax > RETIRE_LATE) fail(`retire (preset): a retirement waited ${pre.stats.retireDelayMax} steps past its due (want <= ${RETIRE_LATE})`);
  if ((pre.stats.used.gate ?? 0) < n - 1) fail(`retire (preset): the Garden Gate was passed ${pre.stats.used.gate ?? 0} times, fewer than the ${n - 1} who walked out`);
  if (pre.garden.plots !== n - 1 || res !== n - 1 || pre.worldW !== GARDEN_X0 + (n - 1) * GARDEN_PLOT + GARDEN_END || pre.worldW !== 2392) fail(`retire (preset): ${pre.garden.plots} plots, ${res} residents, the world ${pre.worldW} wide (want 6, 6, 2392)`);
  // ...and it stays on until another dragon can fly one: an egg laid, hatched and grown young, it retires too (a baby
  // is no flier; a young dragon goes on the easy roads)
  const flier = stays[0], at6 = `at most ${pre.stats.retireDelayMax}, gate ${RETIRE_LATE}); a retiree at a landing at most ${(a.callMax / FPS).toFixed(1)} s, walking out at most ${(a.walkMax / FPS).toFixed(1)} s; the Garden Gate passed ${pre.stats.used.gate} times; ${pre.garden.plots} plots, ${res} residents, the world ${pre.worldW} wide`;
  pre.addEgg('fire');
  let youngAt = -1, leftAt = -1;
  for (let s = 0; s < (HATCH_DAYS + STAGE_DAYS + 2) * SHORT && leftAt < 0; s++) {
    pre.step();
    if (youngAt < 0 && pre.dragons.some((d) => d !== flier && d.stage === 'young')) youngAt = pre.tick;
    if (flier && flier.goal === 'retire') leftAt = pre.tick;
    if (flier && youngAt < 0 && flier.goal === 'retire') { fail(`retire (preset): ${flier.name}, the last flier, retired at step ${pre.tick} with only a baby left in the barn`); break; }
  }
  if (!flier || youngAt < 0 || leftAt < 0 || leftAt - youngAt > RETIRE_LATE) fail(`retire (preset): the last flier ${flier?.name ?? '-'} ${leftAt < 0 ? 'never retired' : `retired at step ${leftAt}`}, the hatchling grew young at ${youngAt} (want within ${RETIRE_LATE} steps after)`);
  noteUse(pre);
  // (b) the busy barn: the seven adults falling due to grow elder 5 s apart from 10 s in, every one mid-errand (so most
  // grow late: section 13's busy barn), then, 30 days on, due to retire mid-errand; each retires 30 days after the step it
  // grew, never 30 days after it fell due to (the elder stage has no next to keep in step with: life.ts)
  const busy = new CareSim(START_ROOMS, START_DRAGONS.map((p, i) => ({ ...p, days: STAGE_DAYS - (600 + 300 * i) / SHORT })), START_KEEPERS, { seed: 1, dayLen: SHORT });
  const b = retireRun(busy, 60000, 'busy', n - 1);
  if (b.grew.size !== n || b.retired.size !== n - 1 || b.arrived.size !== n - 1 || busy.dragons.filter((d) => staysOn(busy, d)).length !== 1) fail(`retire (busy): ${b.grew.size} of ${n} grew into elders, ${b.retired.size} retired, ${b.arrived.size} arrived (want ${n}, all but the last flier)`);
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
  console.log(`  15 retirement (a ${SHORT}-step day): the retire preset, steps late / arrived: ${fmt(pre, a)} (${at6}, resting bodies ${over(a.restMax)} (gate ${REST_OVERLAP}); ${flier?.name} stayed on as the last flier until a hatchling grew young at step ${youngAt}, and retired at ${leftAt}; the busy barn (seven adults growing elder 5 s apart, mid-errand), steps it grew late / days an elder: ${spans} (each ${RETIRE_DAYS} or more), steps it retired late / arrived: ${fmt(busy, b)} (at most ${busy.stats.retireDelayMax}), a retiree at a landing at most ${(b.callMax / FPS).toFixed(1)} s, walking out at most ${(b.walkMax / FPS).toFixed(1)} s; the crowded barn (ten adults, ECHO retiring): ECHO at a landing ${(cr.callMax / FPS).toFixed(1)} s (gate ${RETIREE_LIFT_S}), walking out ${(cr.walkMax / FPS).toFixed(1)} s (gate ${RETIREE_WALK_S}); the real day, the first under the gate's arch: ${under}`);
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
  // (the barn's service beside them: section 2's gates a dragon feels, per run)
  if (st.emptySteps) fail(`residents: a need sat at 0 for ${st.emptySteps} dragon-steps`);
  if (st.waitTimeouts) fail(`residents: ${st.waitTimeouts} keepers gave up waiting`);
  if (avg > GATE.waitAvgS || max > GATE.waitMaxS || kAvg > GATE.keeperWaitAvgS || st.liftWaitMax / FPS > GATE.liftWaitS) fail(`residents: jobs waited ${avg.toFixed(1)} s on average, ${max.toFixed(1)} s at most, keepers ${kAvg.toFixed(1)} s at the stand spot, a landing ${(st.liftWaitMax / FPS).toFixed(1)} s (want <= ${GATE.waitAvgS}, ${GATE.waitMaxS}, ${GATE.keeperWaitAvgS}, ${GATE.liftWaitS})`);
  noteUse(w);
  const perHour = (n: number) => (n * 60 / MIN).toFixed(0);
  console.log(`  16 residents (the garden preset, ${MIN} min of the real day): ${R.map((d) => { const p = per.get(d)!; return `${d.name} napped ${(p.nap / steps * 100).toFixed(0)} % (every one of ${p.night} night steps), strolled ${p.strolls} times, ${p.visits.length} keeper visits (${p.visits.join(', ') || 'none'}; ${perHour(p.visits.length)} an hour)`; }).join('; ')}; jobs for food and love only, draining at a quarter of an elder's (per step x 1e6: ${drains.join(', ')}; within ${(worstDrain * 100).toFixed(3)} %); two at rest overlapping at most ${restMax.toFixed(1)} px (gate ${REST_OVERLAP}); the barn beside them: ${st.done} jobs done, wait avg ${avg.toFixed(1)} s, max ${max.toFixed(1)} s, ${st.emptySteps} steps with a need at 0, the Garden Gate passed ${st.used.gate ?? 0} times`);
}

// ---------- 17. the Map Room's board (#5: the mission chooser, the world map) ----------
if (MAIN) {
  // the board is a pure function of the seed, the day and the map: the same twice; day 1 has THE LOST NEST first; three
  // missions at most, one a region, each an explored region's; no baddie before day 3, and one on every baddie's day
  // (3, 7, ...) whose board has a baddie's region; each difficulty's road as long as it should be, from its region's
  // pool, no challenge twice
  const all = REGIONS.map((r) => r.id), start = REGIONS.filter((r) => r.start).map((r) => r.id);
  let boards = 0, baddies = 0, baddieDays = 0;
  const kinds = new Map<string, number>();
  for (let seed = 1; seed <= 5; seed++) for (let day = 1; day <= 10; day++) for (const map of [start, all]) {
    const a = boardFor(seed, day, map, []), b = boardFor(seed, day, map, []);
    boards++;
    if (!isDeepStrictEqual(a, b)) fail(`board: seed ${seed} day ${day} rolled twice differs`);
    if (day === 1 && (a[0]?.title !== LOST_NEST || a[0].region !== 'millbrook' || a[0].difficulty !== 'easy' || a[0].challenges.join() !== 'flood,lost' || !a[0].guaranteedEgg || a[0].coin !== 40)) fail(`board: seed ${seed} day 1 does not start with THE LOST NEST (${a[0]?.title})`);
    if (a.length > BOARD_MAX || a.length !== Math.min(BOARD_MAX, map.length)) fail(`board: seed ${seed} day ${day} has ${a.length} missions for ${map.length} regions`);
    if (new Set(a.map((m) => m.region)).size !== a.length || a.some((m) => !map.includes(m.region))) fail(`board: seed ${seed} day ${day} has two missions in a region, or one in an unexplored one`);
    if (new Set(a.map((m) => m.id)).size !== a.length) fail(`board: seed ${seed} day ${day}'s missions share an id`);
    // (a baddie's day: a region with a baddie on the board shows its hard road -- a big baddie to meet from day 3)
    if (baddieDay(day) && a.some((m) => regionOf(m.region).baddie) && !a.some((m) => m.baddie)) fail(`board: seed ${seed} day ${day}, a baddie's day, has no road ending in a baddie (${a.map((m) => `${m.title} ${m.difficulty}`).join(', ')})`);
    for (const m of a) {
      const D = DIFFICULTY[m.difficulty], pool = regionOf(m.region).pool;
      kinds.set(m.difficulty, (kinds.get(m.difficulty) ?? 0) + 1);
      if (m.baddie) baddies++;
      if (m.baddie && day < BADDIE_FROM_DAY) fail(`board: seed ${seed} day ${day}: ${m.title} ends in a baddie before day ${BADDIE_FROM_DAY}`);
      if (m.baddie && baddieDay(day)) baddieDays++;
      if (m.baddie && (m.difficulty !== 'hard' || m.baddie !== regionOf(m.region).baddie)) fail(`board: ${m.title}'s baddie ${m.baddie} is not its hard road's`);
      const want = m.difficulty === 'hard' && !m.baddie ? D.challenges + 1 : D.challenges;
      if (m.challenges.length !== want || new Set(m.challenges).size !== want || m.challenges.some((c) => !pool.includes(c))) fail(`board: seed ${seed} day ${day}: ${m.title} (${m.difficulty}) has ${m.challenges.join(', ')}`);
      if (m.days !== D.days || m.coin !== D.coin || (m.title !== LOST_NEST && m.eggChance !== D.egg)) fail(`board: ${m.title}'s days, coin or egg chance are not its difficulty's`);
    }
  }
  // the world map's places (BASE_DESIGN 5.1): every region's titles and its baddie's are its places, in order; THE LOST
  // NEST is met at WILLOW POND; every board mission above is at one of its own region's places
  for (const r of REGIONS) {
    const names = r.places.map((p) => p.name), want = [...r.titles, ...(r.baddieTitle ? [r.baddieTitle] : [])];
    if (names.join('|') !== want.join('|')) fail(`map: ${r.name}'s places (${names.join(', ')}) are not its titles (${want.join(', ')})`);
  }
  if (placeOf({ region: 'millbrook', title: LOST_NEST }).name !== 'WILLOW POND') fail(`map: THE LOST NEST is met at ${placeOf({ region: 'millbrook', title: LOST_NEST }).name}, not WILLOW POND`);
  for (let seed = 1; seed <= 5; seed++) for (let day = 1; day <= 10; day++) for (const m of boardFor(seed, day, all, [])) {
    if (!regionOf(m.region).places.includes(placeOf(m)) || (m.title !== LOST_NEST && placeOf(m).name !== m.title)) fail(`map: ${m.title} (${m.region}) is met at ${placeOf(m).name}`);
  }
  // the map's layout (worldmap.ts mapProblems): every landmark on its own region's dry land, clear of the brook and of
  // every other, every region's name on its land, every big shape placed, no road over the water, every place reached
  // by road from HOME -- and under a region's cloud, nothing of its places shows: the new game's three clouded regions'
  // landmarks are cloud, every pixel
  for (const p of mapProblems()) fail(`map: ${p}`);
  const clouded = REGIONS.filter((r) => !r.start).map((r) => r.id), R = worldRaster(clouded);
  const cloudPx = new Set([MAP_COLOURS.cloud, MAP_COLOURS.cloudLit, MAP_COLOURS.cloudShade, '#1a1018'].map((h) => parseInt(h.slice(1), 16)));
  for (const p of PLACES.filter((q) => clouded.includes(q.region))) {
    const f = footprint(p.art, p.at);
    let shows = 0;
    for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) if (!cloudPx.has(R.get(x, y))) shows++;
    if (shows) fail(`map: ${shows} px of ${p.name} show through ${regionOf(p.region).name}'s cloud`);
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
  console.log(`  17 board: ${boards} boards (seeds 1-5, days 1-10, the start's map and the whole) the same rolled twice, day 1's always THE LOST NEST first; ${[...kinds].map(([k, n]) => `${n} ${k}`).join(', ')}, ${baddies} ending in a baddie (none before day ${BADDIE_FROM_DAY}; ${baddieDays} on a baddie's day, one on every such board with a baddie's region); a world's board rolled at clocks ${rolls.join(' and ')} (each 05:00); the world map's ${PLACES.length} places each a title of its region, every board mission at its place (THE LOST NEST at WILLOW POND), its layout sound and every place under the new game's clouds hidden`);
}

// ---------- 18. the forecast (#5: the team meets the road's challenges; BASE_DESIGN 11) ----------
if (MAIN) {
  // the trail coach's dry run of a road (encounter.ts forecastRoad, through missions.ts forecastOf), read for hand-picked
  // teams (moods set by hand: every need full, or food at 0.2 for a low one): THE LOST NEST with both counters (RIPPLE the
  // flood, ECHO the lost things) is cleared in one try a stop with no puff lost; RIPPLE alone clears both (the flood
  // STRONG, the lost things by a helping try that just makes the easy mark in good spirits, and falls short once when
  // low); a hard road with both of the Storm Roc's counters is cleared whole; EMBER alone on the Mole King's road clears
  // its three obstacles (a second try each) and loses the fight (three of four); an empty team clears nothing; the
  // share is the stops'; and BEST TEAM on THE LOST NEST is the two counters
  const w = newSim(1), by = (n: string) => w.dragons.find((d) => d.name === n)!, keeper = (n: string) => w.keepers.find((k) => k.name === n)!.id;
  const mood = (n: string, good: boolean) => { const d = by(n); for (const k of NEEDS) if (hasNeed(d.element, k)) d.needs[k] = 1; if (!good) d.needs.food = 0.2; d.mood = moodOf(d.element, d.needs); };
  const nest = w.missions.board.find((m) => m.title === LOST_NEST)!;
  const mission = (region: RegionId, challenges: ChallengeId[], baddie: BaddieId | null): Mission => ({ id: 999, region, title: 'TEST', difficulty: 'hard', challenges, baddie, days: 3, coin: 150, eggChance: 0.6, guaranteedEgg: false });
  const cases: [string, Mission, [string, string][], Record<string, boolean>, { cleared: number; turns?: number; puff?: (p: number) => boolean }][] = [
    ['THE LOST NEST, RIPPLE (IRIS) and ECHO (TOMAS), both in good spirits', nest, [['RIPPLE', 'IRIS'], ['ECHO', 'TOMAS']], { RIPPLE: true, ECHO: true }, { cleared: 2, turns: 2, puff: (p) => p === 1 }],
    ['THE LOST NEST, RIPPLE alone, in good spirits', nest, [['RIPPLE', 'IRIS']], { RIPPLE: true }, { cleared: 2, turns: 2, puff: (p) => p === 1 }],
    ['THE LOST NEST, RIPPLE alone, low', nest, [['RIPPLE', 'IRIS']], { RIPPLE: false }, { cleared: 2, turns: 3, puff: (p) => p > 0.75 && p < 1 }],
    ['a hard road, both of the Storm Roc\'s counters: ZAP (PIP) and WICK (IRIS)', mission('highfold', ['storm', 'dark', 'gap'], 'stormroc'), [['ZAP', 'PIP'], ['WICK', 'IRIS']], { ZAP: true, WICK: true }, { cleared: 4 }],
    ['the Mole King\'s road with neither counter: EMBER (PIP) alone', mission('oldmine', ['dark', 'heavy', 'lost'], 'moleking'), [['EMBER', 'PIP']], { EMBER: true }, { cleared: 3 }],
  ];
  const rows: string[] = [];
  for (const [what, m, team, moods, want] of cases) {
    for (const [n, good] of Object.entries(moods)) mood(n, good);
    const pairs = team.map(([d, k]) => ({ dragon: by(d).id, keeper: keeper(k) })), got = forecastOf(w, m, pairs);
    if (got.cleared !== want.cleared || got.stops !== m.challenges.length + (m.baddie ? 1 : 0) || (want.turns != null && got.turns !== want.turns) || (want.puff && !want.puff(got.puff))) fail(`forecast: ${what}: ${JSON.stringify(got)}, not ${JSON.stringify(want)}`);
    if (Math.abs(forecastShare(got) - got.cleared / got.stops) > 1e-6) fail(`forecast: ${what}: the share is ${forecastShare(got)}`);
    rows.push(`${got.cleared}/${got.stops} in ${got.turns} turns, ${Math.round(got.puff * 100)} % puff`);
  }
  if (forecastOf(w, nest, []).cleared !== 0 || forecastShare(forecastOf(w, nest, [])) !== 0) fail('forecast: an empty team clears a stop');
  const best = bestTeam(w, nest).map((p) => by(w.dragons[p.dragon].name).name).sort();
  if (!isDeepStrictEqual(best, ['ECHO', 'RIPPLE'])) fail(`forecast: BEST TEAM on THE LOST NEST is ${best.join(' and ')}, not RIPPLE and ECHO`);
  console.log(`  18 forecast: ${cases.length} hand-picked teams: ${rows.join('; ')}; an empty team 0; BEST TEAM on THE LOST NEST ${best.join(' and ')}`);
}

// ---------- 19. who may go (#5: dragons and people as solutions; BASE_DESIGN 5.2: 2 keepers home) ----------
if (MAIN) {
  // a baby, a young dragon on a normal or hard road and a garden resident may not go; a keeper the player has taken is
  // never an auto rider (missions.ts isTaken: BEA taken, first as a stub -- a Taken the pick is given -- then by the
  // take command itself, below), for any mission and any dragon; two riders at most, two keepers always home; one team out at
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
  // the take, for real: BEA taken by hand through the command queue -- isTaken and CareSim.free leave her out; no auto
  // rider (the same 420 asks, the pick asking isTaken itself) nor BEST TEAM chooses her; a team with her
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
  // (a keeper taken at work -- finishing the job first -- whose dragon is then sent: they finish it (missions.ts
  // leaveBarn: a keeper at work finishes, the job done then), and the dragon keeps its slot until it sets off; then they
  // are the player's where they stand, steerable, as a finished job leaves them; never left finishing a job that no
  // longer is, held but not steerable)
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
    const job = pk.job, slot = pd.slot, done0 = pw.stats.done;
    if (!job || !pk.pendingTake || pk.phase !== 'work' || !pd.act || !slot || pd.goal !== 'muster') fail(`team: ${pk.name}, at work on ${pd.name} when it was sent, stopped: pendingTake ${pk.pendingTake}, ${pk.phase}, job ${job?.id ?? null}, act ${pd.act?.need ?? null}, slot ${!!slot}, goal ${pd.goal}`);
    let finished = 0;
    for (let s = 0; s < 400 && pk.pendingTake; s++) { pw.step(); finished++; if (pk.pendingTake && pd.slot !== slot) fail(`team: ${pd.name} let its slot go while ${pk.name} was still at work with it`); }
    if (pw.stats.done !== done0 + 1 || pw.jobs.some((j) => j === job) || pd.needs[need] !== 1) fail(`team: ${pk.name}'s job on ${pd.name} (${need}) was not done: done ${pw.stats.done - done0}, need ${pd.needs[need].toFixed(3)}`);
    if (!pk.manual || pk.pendingTake || pk.phase !== 'manual' || pk.job || pw.controlled !== pk.id || pw.free(pk)) fail(`team: ${pk.name}, taken at work on ${pd.name} and it sent: manual ${pk.manual}, pendingTake ${pk.pendingTake}, ${pk.phase}, job ${pk.job?.id ?? null}, controlled ${pw.controlled}`);
    const x0 = pk.x;
    pw.command({ kind: 'steer', dx: 1, dy: 0 });
    for (let s = 0; s < 120; s++) pw.step();
    const x1 = pk.x;
    pw.command({ kind: 'steer', dx: -1, dy: 0 });
    for (let s = 0; s < 120; s++) pw.step();
    if (x1 === x0 && pk.x === x1) fail(`team: ${pk.name}, the player's after ${pd.name} was sent, did not walk when steered (x ${x0})`);
    pendingLine = `${pk.name} taken at work (${need}, ${pd.name}; seed 2, step ${at}) and ${pd.name} sent: finished the job ${finished} steps on (${pd.name} in its slot till then), then the player's where they stood, steered ${x0} -> ${x1} -> ${pk.x}`;
    noteUse(pw);
  }
  console.log(`  19 team: babies, the young on normal and hard roads and garden residents may not go; with BEA taken (the pick given a stub), ${asked} auto riders (10 days of boards x 7 dragons, alone and beside a pair) and BEST TEAM never chose her; a third pair refused (two keepers stay home: ${home} home with the team out); a second send refused while one is out; BEA taken by hand by the take command: not free, ${askedHand} auto riders and BEST TEAM never chose her, a send command with her riding refused ("${refusedSend && refusedSend.kind === 'send' ? refusedSend.reason : '?'}"), BEST TEAM sent by command and mustering, ${tRider.name} (riding) refused to the hand ("${refusedTake && refusedTake.kind === 'refused' ? refusedTake.reason : '?'}"), BEA given no job in 6000 steps beside the trip; ${pendingLine}`);
}

// ---------- 20. a full trip: THE LOST NEST (#5: eggs, launched from the Aerie using the Map Room; #11) ----------
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
  // (b) THE LOST NEST with RIPPLE and ECHO on a short day (seed 2: both counters, a sure egg), stepped through: the muster
  // (the Map Room, the Tack Room and the Aerie used; both up by the lift; 3600 steps or fewer), away (no job for the team,
  // no job for its riders, the needs frozen), its two stops met and cleared by the trail coach (nobody watching: each
  // pick waits PICK_WAIT_TRAIL for the player first), XP for both, back once the road is walked whole -- a day's walk and
  // the stops' turns -- with food and sleep down, the egg in its reserved nest, the saddles hung back, the riders rested
  // in the Bunks and back on duty, the coin paid, the trip over, and the region's neighbour revealed at the next dawn
  const w = new CareSim(START_ROOMS, START_DRAGONS, START_KEEPERS, { seed: 2, dayLen: 600 });
  const rides0 = w.stats.liftRides, used0 = { ...w.stats.used }, uses0 = uses(w);
  sendLostNest(w);
  const t = w.missions.trip!, team = t.pairs.map((p) => w.dragons.find((d) => d.id === p.dragon)!), riders = t.pairs.map((p) => w.keepers.find((k) => k.id === p.keeper)!);
  if (t.success !== null || !t.egg || t.nest == null || t.forecast !== 1 || t.travel !== w.dayLen || t.walked !== 0 || t.puff.some((p, i) => p !== t.stats[i].puff)) fail(`trip: seed 2's LOST NEST was sent as ${JSON.stringify({ success: t.success, egg: t.egg, nest: t.nest, forecast: t.forecast, travel: t.travel, puff: t.puff })}`);
  let departed = -1, awayAt = -1, landedAt = -1, overAt = -1, laid = -1, frozen: string | null = null, landNeeds = '', revealed = '';
  const upBy = new Set<number>(), met: string[] = [], ends: string[] = [], xp0 = team.map((d) => d.xp);
  let picksWaited = 0, pickFrom = -1;
  for (let s = 1; s <= 30000 && (overAt < 0 || riders.some((k) => k.phase === 'rest') || s < overAt + 10); s++) {
    const before = t.state, eggs = w.eggs.length, encBefore = t.encounter;
    const pre = team.map((d) => ({ food: d.needs.food, sleep: d.needs.sleep }));
    w.step();
    for (const e of w.events) {
      if (e.kind === 'meet') { met.push(e.name); if (t.walked !== stopStart(t, e.stop) || t.encounter?.stop !== e.stop || t.encounter.state !== 'meet') fail(`trip, step ${w.tick}: ${e.name} met at walked ${t.walked} (its start ${stopStart(t, e.stop)}), the encounter ${JSON.stringify(t.encounter && { stop: t.encounter.stop, state: t.encounter.state })}`); }
      if (e.kind === 'stopEnd') { ends.push(`${e.name} ${e.cleared ? 'cleared' : 'waited out'} +${e.xp}`); if (!e.cleared || e.xp !== XP_ROAD.cleared) fail(`trip, step ${w.tick}: ${e.name} ended ${JSON.stringify(e)}`); }
    }
    // (the walk stands still at a stop, and the picks wait PICK_WAIT_TRAIL for the player each turn before the coach's)
    if (encBefore && t.encounter === encBefore && t.walked !== (encBefore ? t.walked : -1)) fail(`trip, step ${w.tick}: the team walked on at a stop`);
    const enc = t.encounter;
    if (enc?.state === 'pick' && pickFrom < 0) pickFrom = w.tick;
    if (enc && enc.state !== 'pick' && pickFrom >= 0) { if (w.tick - pickFrom !== PICK_WAIT_TRAIL) fail(`trip, step ${w.tick}: the coach picked ${w.tick - pickFrom} steps into the wait (want PICK_WAIT_TRAIL, ${PICK_WAIT_TRAIL})`); picksWaited++; pickFrom = -1; }
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
      if (t.walked !== t.travel || t.encounter || t.stops.some((q) => q.result !== 'met') || t.success !== true) fail(`trip: landed with the road ${JSON.stringify({ walked: t.walked, travel: t.travel, stops: t.stops.map((q) => q.result), success: t.success })}`);
      if (team.some((d, i) => d.xp !== xp0[i] + 2 * XP_ROAD.cleared)) fail(`trip: the team came home with XP ${team.map((d) => d.xp).join(', ')} (want +${2 * XP_ROAD.cleared} each)`);
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
  if (awayAt < 0 || landedAt < 0 || landedAt - awayAt < w.dayLen + 2 * MEET_STEPS) fail(`trip: away at ${awayAt}, landed at ${landedAt} (want a day's walk, ${w.dayLen} steps, and its two stops' turns)`);
  if (met.length !== 2 || ends.length !== 2 || picksWaited < 2) fail(`trip: the road met ${met.join(', ')} and ended ${ends.join(', ')}; the coach picked after the player's wait ${picksWaited} times`);
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
  // (d) sent mid-act (BASE_DESIGN 5: "a keeper at work finishes"), seeds 1-6 on the real day: a dragon a keeper is at
  // work with (not its rider) -- the keeper finishes, the job done and the need full -- and a dragon asleep: each keeps
  // its slot, nobody else holding it, until it sets off; and a rider taken mid-tuck-in: the dragon sleeps on, its sleep
  // job closed (done), and is not tucked in again
  const midLines: string[] = [];
  for (const kind of ['work', 'nap', 'tuck'] as const) {
    let seen = 0, longest = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const v = newSim(seed);
      let d: Dragon | null = null, k: Keeper | null = null, pair: { dragon: number; keeper: number } | null = null, m: Mission | null = null;
      for (let s = 0; s < 40000 && !pair; s++) {
        v.step();
        m = v.missions.board[0] ?? null;
        if (!m || v.missions.trip) continue;
        const riderBut = (x: Dragon, not: Keeper | null) => { const r = autoRider(v, x, m!, []); return r != null && r !== not?.id ? r : v.keepers.find((q) => q !== not && !onTrip(q) && !q.job)?.id ?? null; };
        if (kind === 'work') {
          k = v.keepers.find((q) => q.phase === 'work' && !!q.job && q.job.need !== 'sleep' && q.t < 20 && !dragonReason(v, q.job.dragon, m!)) ?? null;
          d = k?.job?.dragon ?? null;
          const r = d ? riderBut(d, k) : null;
          if (d && r != null) pair = { dragon: d.id, keeper: r };
        } else if (kind === 'nap') {
          d = v.dragons.find((q) => q.asleep > 60 && !v.jobs.some((j) => j.dragon === q && j.keeper) && !dragonReason(v, q, m!)) ?? null;
          const r = d ? riderBut(d, null) : null;
          if (d && r != null) pair = { dragon: d.id, keeper: r };
        } else {
          k = v.keepers.find((q) => q.phase === 'work' && q.job?.need === 'sleep' && q.t < 30) ?? null;
          d = k ? k.job!.dragon : null;
          const go = k ? v.dragons.find((q) => q !== d && !q.act && !dragonReason(v, q, m!)) : null;
          if (k && go) pair = { dragon: go.id, keeper: k.id };
        }
      }
      if (!pair || !d || !m) { fail(`trip (sent mid-act): seed ${seed} found no ${kind} to send from`); continue; }
      const slot = d.slot, need = kind === 'work' ? k!.job!.need : 'sleep', done0 = v.stats.done, job = kind === 'work' ? k!.job : null;
      const r = send(v, m.id, [pair]);
      if (typeof r === 'string') { fail(`trip (sent mid-act): seed ${seed}'s ${kind} send refused: ${r}`); continue; }
      v.step();
      seen++;
      const what = `seed ${seed}, ${d.name} (${kind})`;
      if (kind === 'tuck') {
        if (v.jobs.some((j) => j.dragon === d && j.need === 'sleep') || d.asleep <= 0 || v.stats.done !== done0 + 1) fail(`trip (sent mid-act): ${what}: its rider taken mid-tuck-in left its sleep job open (asleep ${d.asleep}, done ${v.stats.done - done0})`);
        for (let s = 0; s < 3000; s++) {
          v.step();
          if (v.keepers.some((q) => q.job?.dragon === d && q.job.need === 'sleep' && q.phase === 'work' && d!.needs.sleep > 0.9)) { fail(`trip (sent mid-act): ${what} was tucked in again at sleep ${d.needs.sleep.toFixed(3)}`); break; }
        }
        continue;
      }
      let s = 0;
      for (; s < 1500 && (d.act || d.asleep > 0 || d.slot); s++) {
        if ((d.act || d.asleep > 0) && d.slot !== slot) { fail(`trip (sent mid-act): ${what} let its slot go while ${d.act ? `still met for ${d.act.need}` : 'asleep'}`); break; }
        const o = v.dragons.find((q) => q !== d && q.slot === slot);
        if (o) { fail(`trip (sent mid-act): ${what}: ${o.name} took its slot while it was still there`); break; }
        if (kind === 'work' && d.act && d.act.need === need && !v.keepers.some((q) => q.job?.dragon === d && q.phase === 'work')) { fail(`trip (sent mid-act): ${what}'s ${need} rose with nobody at work`); break; }
        v.step();
      }
      longest = Math.max(longest, s);
      if (d.act || d.asleep > 0 || d.slot || d.goal !== 'muster') fail(`trip (sent mid-act): ${what} never set off (${s} steps: act ${d.act?.need ?? null}, asleep ${d.asleep}, slot ${!!d.slot}, goal ${d.goal})`);
      if (kind === 'work' && (v.jobs.includes(job!) || v.stats.done < done0 + 1)) fail(`trip (sent mid-act): ${what}: ${k!.name}'s ${need} job was not done (done ${v.stats.done - done0})`);
    }
    midLines.push(`${kind} ${seen}/6${kind === 'tuck' ? '' : ` (set off at most ${longest} steps after the send)`}`);
  }
  console.log(`  20 trip: sent mid-act (seeds 1-6): a keeper at work finishes, a sleeper keeps its slot, a rider's tuck-in is done: ${midLines.join(', ')}`);
  console.log(`  20 trip: the muster preset (the real day, seed 1) all on the deck at step ${musterAt}; THE LOST NEST (seed 2, a 600-step day) with ${t.pairs.map((p, i) => `${team[i].name} and ${riders[i].name}`).join(', ')}: forecast ${(t.forecast * 100).toFixed(0)} %, a ${t.egg} egg for nest ${t.nest}; mustered in ${departed} steps (both up by the lift), away at ${awayAt}, met ${met.join(' and ')} (${ends.join('; ')}; the coach picked ${picksWaited} times after the player's ${PICK_WAIT_TRAIL}-step wait), landed at ${landedAt} (the road walked whole: ${landNeeds}), the egg laid at ${laid}, over at ${overAt}; the Map Room used ${used('maproom')}, the Tack Room ${used('tack')}, the Aerie ${used('aerie')}, the Bunks ${used('bunks')}; coin ${w.missions.coin}; FROSTMERE revealed at the next dawn; ${baby()?.name} hatched`);
}

// ---------- 21. a failure: the whole road, and the outcome at its end (#5: challenges on the road) ----------
if (MAIN) {
  // a lone pair on a hard road it can't finish (RIPPLE, with its auto rider, on the Old Mine Road's hard mission: the Mole
  // King needs dusk and CHARM, and a lone dragon can't wear it out) from seeds 1-20, the trail coach playing: it never
  // turns back -- it walks every stop to the road's end, the scene's team never taking a step back, each stop's line
  // how the stop went and the TRIP LOG telling each stop and never the outcome -- and only at the end is the failure told
  // (the result card's NOT THIS TIME); it lands with half the coin and no egg, and reveals nothing
  let seed = 0, w: CareSim | null = null, tried = 0;
  const told = /TURNS? BACK|HEAD HOME|KEEPS THE ROAD|HOME FOR TEA|NOT THIS TIME|HOME SAFE/;
  for (let s = 1; s <= 20 && !w; s++) {
    tried++;
    const sim = new CareSim(START_ROOMS, START_DRAGONS, START_KEEPERS, { seed: s, dayLen: 600 }), dm = demoTrip(sim, 'oldmine', 'hard'), rip = sim.dragons.find((q) => q.name === 'RIPPLE')!;
    const tr = tripOf(sim, dm.mission, [{ dragon: rip.id, keeper: autoRider(sim, rip, dm.mission, [])! }], 1800);
    tr.auto = true;
    awayNow(sim, tr, sim.clock);
    let reached = -1, back = 0, prev: SceneFrame | null = null, title: string | null = null, logged = '';
    for (let n = 0; n < 40000 && sim.missions.trip; n++) {
      sim.step();
      const t2 = sim.missions.trip;
      if (!t2 || (t2.state !== 'away' && t2.state !== 'return')) continue;
      const f = sceneAt(sim, t2);
      if (prev && f.xs.some((x, i) => x < prev!.xs[i] - 1e-9)) back++;
      reached = Math.max(reached, f.last ?? -1);
      if (f.done && title == null) { title = resultTitle(t2); logged = stopStates(sim, t2).join(', '); }
      prev = f;
    }
    if (back || reached !== tr.stops.length - 1 || !prev?.done) fail(`failure: seed ${s}: the team stepped back on ${back} steps, reached stop ${reached} of ${tr.stops.length}, done ${prev?.done}`);
    if (tr.success === false) {
      seed = s; w = sim;
      const unmet = tr.stops.findIndex((q) => q.result === 'unmet');
      if (unmet < 0 || tr.stops.some((q) => q.result === 'ahead' || !q.log || told.test(q.log)) || tr.stops[unmet].log.indexOf(' - ') < 0) fail(`failure: its road is ${JSON.stringify(tr.stops.map((q) => q.log))}`);
      if (title !== 'NOT THIS TIME' || logged !== tr.stops.map((q) => q.result).join(', ')) fail(`failure: at the road's end the result card says ${title}, the TRIP LOG ${logged}`);
      if (sim.missions.trip || sim.missions.coin !== Math.floor(tr.mission.coin / 2) || sim.eggs.length || sim.missions.pendingReveal.length || sim.missions.firstSuccess.length) fail(`failure: the trip ended with ${sim.missions.coin} coin, ${sim.eggs.length} eggs, reveals ${sim.missions.pendingReveal}`);
      noteUse(sim);
      console.log(`  21 failure: seed ${seed} (of ${tried} tried): RIPPLE alone on ${tr.mission.title}'s road fails at stop ${unmet} ("${tr.stops[unmet].log}") and walks on, never a step back, through all ${tr.stops.length} stops to the road's end, where the result card says ${title} (the TRIP LOG: ${logged}); home with ${sim.missions.coin} coin (half) and no egg, nothing revealed`);
    }
  }
  if (!w) fail('failure: no seed in 1-20 fails RIPPLE alone on the Old Mine Road\'s hard mission');
  // (met in full, a road's lines say only how each stop went: never the outcome)
  const v = new CareSim(START_ROOMS, START_DRAGONS, START_KEEPERS, { seed: 1, dayLen: 600 }), m = v.missions.board[0];
  const tv = tripOf(v, m, bestTeam(v, m), 300);
  tv.auto = true;
  awayNow(v, tv, v.clock);
  for (let n = 0; n < 20000 && v.missions.trip; n++) v.step();
  if (!tv.stops.every((s) => s.result === 'met' && !told.test(s.log)) || tv.success !== true) fail(`failure: met in full, its road is ${JSON.stringify(tv.stops.map((s) => s.log))}, success ${tv.success}`);
  noteUse(v);
}

// ---------- 22. a trip's road is the seed's ----------
if (ROLE === 'babies') {
  // the same sends on 8 seeds, twice, played through by the trail coach: the same stops' results and lines, the same
  // outcome, egg and coin each time (every roll a stateless rngAt); and THE LOST NEST with both counters clears both stops
  // on every seed (the tutorial: a sure egg)
  const run = (seed: number, which: 0 | 1) => {
    const w = new CareSim(START_ROOMS, START_DRAGONS, START_KEEPERS, { seed, dayLen: 600 }), m = w.missions.board[which];
    if (!m) return null;
    const pairs = which === 0 ? [] : bestTeam(w, m);
    if (which === 0) { const d = w.dragons.find((q) => q.name === 'RIPPLE')!, e = w.dragons.find((q) => q.name === 'ECHO')!; for (const x of [d, e]) pairs.push({ dragon: x.id, keeper: autoRider(w, x, m, pairs)! }); }
    const t = tripOf(w, m, pairs, 120);
    t.auto = true;
    awayNow(w, t, w.clock);
    // (the eggs as they are laid: on a 600-step day one hatches before the landing's last rider has rested)
    const laid: string[] = [], seenEggs = new Set<number>();
    for (let n = 0; n < 40000 && w.missions.trip; n++) { w.step(); for (const q of w.eggs) if (!seenEggs.has(q.id)) { seenEggs.add(q.id); laid.push(q.element); } }
    return { s: t.success, e: laid, c: w.missions.coin, r: t.stops.map((q) => `${q.result}:${q.log}:${q.turns}`), x: [...t.xp], p: [...t.puff] };
  };
  let wins = 0, eggs = 0, rolled = 0, rolledWins = 0;
  for (let seed = 1; seed <= 8; seed++) {
    const a = [run(seed, 0), run(seed, 1)], b = [run(seed, 0), run(seed, 1)];
    if (JSON.stringify(a) !== JSON.stringify(b)) fail(`outcome: seed ${seed}'s roads differ run to run`);
    if (!a[0]?.s || !a[0].e.length) fail(`outcome: seed ${seed}'s LOST NEST with both counters ${a[0]?.s ? 'brought no egg' : 'failed'}: ${JSON.stringify(a[0])}`);
    for (const q of a) { if (!q) continue; if (q.s) wins++; if (q.e.length) eggs++; if (!!q.e.length !== !!q.s) fail(`outcome: seed ${seed}: ${q.s ? 'a success' : 'a failure'} ${q.e.length ? 'brought' : 'did not bring'} an egg (a first success in a region always does, a failure never)`); }
    if (a[1]) { rolled++; if (a[1].s) rolledWins++; }
  }
  console.log(`  22 outcome: 8 seeds, two roads each played by the trail coach, the same twice: ${wins} successes, ${eggs} eggs (a first success in a region always brings one); THE LOST NEST with both counters cleared on all 8, the day's second mission by BEST TEAM ${rolledWins} of ${rolled}`);
}

// ---------- 24. the watchable scene (BASE_DESIGN 6, 11; #5: challenges on the road, the big baddie) ----------
if (ROLE === 'service') {
  // an easy, a normal and a hard road with each of the three baddies (the best two pairs), and the Mole King's road with a
  // lone pair that can't wear it out, on a 600-step day, the trail coach playing (AUTO): every step of the trip read
  // from the scene's pure function and checked against the last step's
  const runs: [RegionId, Difficulty, boolean][] = [['millbrook', 'easy', false], ['bramblewood', 'normal', false], ['oldmine', 'hard', false], ['highfold', 'hard', false], ['frostmere', 'hard', false], ['oldmine', 'hard', true]];
  const EXITS: readonly string[] = ['calmed', 'outwitted', 'drivenOff'];
  // (the outwitted one wanders off at a plain walk: the art kit's exitLook, baddies.ts; 'leave' is the driven-off shuffle)
  const EXIT_LOOK: Readonly<Record<string, { pose: string; face: string }>> = { calmed: { pose: 'sit', face: 'sleepy' }, outwitted: { pose: 'walk', face: 'neutral' }, drivenOff: { pose: 'leave', face: 'grumpy' } };
  let travelSteps = 0, inFrame = 0, frames = 0, petChecks = 0;
  const lines: string[] = [];
  for (const [region, diff, lone] of runs) {
    const sim = new CareSim(START_ROOMS, START_DRAGONS, START_KEEPERS, { seed: 1, dayLen: 600 });
    let trip = demoTrip(sim, region, diff);
    if (lone) { const rip = sim.dragons.find((d) => d.name === 'RIPPLE')!, iris = sim.keepers.find((k) => k.name === 'IRIS')!; trip = tripOf(sim, trip.mission, [{ dragon: rip.id, keeper: iris.id }]); }
    trip.auto = true;
    awayNow(sim, trip, sim.clock);
    const L = trip.travel, stops = trip.stops, what = `scene: ${region} ${diff}${lone ? ' (a lone pair)' : ''}`;
    // (the trip's road is the missions' own -- missions.ts roadOf -- its stops all ahead, no line yet)
    if (stops.some((q) => q.result !== 'ahead' || q.log || q.resolvedAt != null) || trip.walked !== 0 || trip.success !== null) fail(`${what}: the road is not fresh: ${JSON.stringify(stops.map((q) => [q.result, q.log]))}`);
    const team = trip.pairs.map((p) => sim.dragons.find((d) => d.id === p.dragon)!), gaits = team.map((d) => gaitOf(d.element, d.stage));
    // (the view's team on the road: casts synced by clock jumps of 1, 8 and 40 steps and across a 1000-step gap -- a
    // watch closed and reopened -- each playing on every walk step the very walk frame the road's walk distance is in)
    const plans = region === 'bramblewood' ? [[1, 1, 1, 1, 1, 1, 1, 1, 1000], [8], [40]] : region === 'highfold' ? [[40]] : [];
    const casts = plans.map((plan) => ({ plan, k: 0, due: sim.clock, cast: new ScenePets(sim, trip) }));
    const z = sceneAt(sim, trip);
    if (z.xs.some((x, i) => x !== -PAIR_BACK * i) || z.n !== 0 || z.done || z.stop != null || z.last != null) fail(`${what}: at the start the team is at ${z.xs.join(', ')} (n ${z.n}, done ${z.done}, stop ${z.stop}), not at its places`);
    if (!isDeepStrictEqual(sceneAt(sim, trip), sceneAt(sim, trip))) fail(`${what}: two reads of one state differ`);
    let prev: SceneFrame | null = null, prevU: number | null = null, exitSeen: string | null = null, lastOff: number | null = null, reached = -1, bad = 0;
    const met: number[] = [], ended: number[] = [], walkedThrough: number[] = [];
    let inPassage = 0;
    let title: string | null = null, endWalked = -1;
    for (let s = 0; s < 60000 && sim.missions.trip && (sim.missions.trip.state === 'away'); s++) {
      sim.step();
      frames++;
      const f = sceneAt(sim, trip), E = s + 1, enc = trip.encounter;
      for (const e of sim.events) {
        if (e.kind === 'meet') { met.push(e.stop); if (trip.walked !== stopStart(trip, e.stop) || !enc || enc.stop !== e.stop || enc.state !== 'meet' || f.stop !== e.stop) fail(`${what}: stop ${e.stop} met at walked ${trip.walked} (start ${stopStart(trip, e.stop)}), the frame's stop ${f.stop}`); }
        if (e.kind === 'stopEnd') { ended.push(e.stop); if (stops[e.stop].result === 'ahead' || stops[e.stop].resolvedAt !== sim.clock || !stops[e.stop].log.startsWith(`${stopName(stops[e.stop])} - `)) fail(`${what}: stop ${e.stop} ended as ${JSON.stringify({ result: stops[e.stop].result, log: stops[e.stop].log })}`); }
      }
      if (f.done !== roadDone(trip) || (f.done && (trip.walked !== L || enc || stops.some((q) => q.result === 'ahead')))) fail(`${what}: done is ${f.done} at E ${E} (walked ${trip.walked} of ${L}, encounter ${!!enc})`);
      if (f.done && title == null) { title = resultTitle(trip); endWalked = f.n; }
      if (f.baddie) inFrame++;
      if (f.last != null) { if (f.last > reached + 1) fail(`${what}: the team skipped from stop ${reached} to ${f.last} at E ${E}`); reached = Math.max(reached, f.last); }
      // (the stops as the set pieces and the TRIP LOG tell them: ahead until the encounter resolves the stop, then how it went)
      for (const p of f.pieces) { const want = stops[p.stop].result === 'ahead' ? 'ahead' : stops[p.stop].result; if (p.state !== want && bad++ < 3) fail(`${what}: stop ${p.stop}'s set piece is ${p.state} at E ${E}, its result ${stops[p.stop].result}`); }
      if (!isDeepStrictEqual(stopStates(sim, trip), stops.map((q) => q.result)) && bad++ < 3) fail(`${what}: the TRIP LOG says ${stopStates(sim, trip).join(', ')} at E ${E}, the road ${stops.map((q) => q.result).join(', ')}`);
      // (the passages, missionview.ts and passages.ts: every land stop's, just past its set piece and PASSAGE_LEN long, drawn as
      // the stop went; the lead walks through each after its stop is resolved -- never while the team stands at a stop,
      // never one whose stop is still ahead -- each once, in road order)
      if (!isDeepStrictEqual(f.passages.map((p) => p.stop), stops.map((q, j) => (q.kind === 'challenge' && hasPassage(q.challenge!) ? j : -1)).filter((j) => j >= 0))) fail(`${what}: the passages are stops ${f.passages.map((p) => p.stop).join(', ')} at E ${E}`);
      for (const p of f.passages) { const piece = f.pieces.find((q) => q.stop === p.stop)!; if (p.x0 !== piece.x + PASSAGE_FROM || p.x1 > p.x0 + PASSAGE_LEN || p.x1 <= p.x0 || p.state !== piece.state || (p.stop + 1 < stops.length && f.pieces.some((q) => q.stop === p.stop + 1 && p.x1 > Math.max(p.x0 + 1, q.x - PIECE_AHEAD - PASSAGE_CLEAR) + 1e-9))) { if (bad++ < 3) fail(`${what}: stop ${p.stop}'s passage is ${JSON.stringify(p)} beside its piece ${JSON.stringify(piece)} at E ${E}`); } }
      if (f.passage != null) {
        inPassage++;
        if (f.stop != null || stops[f.passage].result === 'ahead') fail(`${what}: the lead walks stop ${f.passage}'s passage (${stops[f.passage].result}) while ${f.stop != null ? `standing at stop ${f.stop}` : 'the stop is ahead'} at E ${E}`);
        if (walkedThrough[walkedThrough.length - 1] !== f.passage) walkedThrough.push(f.passage);
      }
      // (the banner: the stop's name as it is met, the encounter's lines through it, how it went after -- never the outcome)
      if (f.banner && /HOME SAFE|NOT THIS TIME/.test(f.banner)) fail(`${what}: the banner tells the outcome at E ${E}: ${f.banner}`);
      if (f.stop != null && (!enc || enc.stop !== f.stop || !f.banner)) fail(`${what}: the team stands at stop ${f.stop} with ${enc ? `the encounter at ${enc.stop}` : 'no encounter'}, banner ${JSON.stringify(f.banner)} at E ${E}`);
      // (the baddie: a face of the four; it moves only the way it faces -- in from the right facing the team, then its
      // exit's way, the art kit's exitLook -- and one that walks off (outwitted, driven off) stays ahead of every rider
      // until it is off the screen's right edge: never back through the team)
      if (f.baddie && trip.exit && f.baddie.pose === EXIT_LOOK[trip.exit].pose && f.baddie.face === EXIT_LOOK[trip.exit].face) exitSeen = trip.exit;
      if (f.baddie && !['neutral', 'grumpy', 'surprised', 'sleepy'].includes(f.baddie.face)) fail(`${what}: the baddie's face is ${f.baddie.face}`);
      if (f.baddie && prev?.baddie && (f.baddie.x - prev.baddie.x) * f.baddie.facing < -1e-9) fail(`${what}: the baddie moved ${f.baddie.x - prev.baddie.x} facing ${f.baddie.facing} (${f.baddie.pose}) at E ${E}`);
      if (f.baddie && (trip.exit === 'outwitted' || trip.exit === 'drivenOff') && stops.some((q) => q.kind === 'baddie' && q.result !== 'ahead')) {
        if (f.xs.some((x) => x + RIDER_AHEAD >= f.baddie!.x)) fail(`${what}: the baddie (${trip.exit}, ${f.baddie.pose} at x ${f.baddie.x}) is not ahead of the team (${f.xs.map((x) => x + RIDER_AHEAD).join(', ')}) at E ${E}`);
        lastOff = f.baddie.x - f.camX;
      }
      // (the Map Room map's flag on the road, missionview.ts roadFraction: climbing while the team walks on, standing still
      // through a stop, never going back, never outside 0..1, 1 at the road's end)
      const u = roadFraction(sim, trip);
      if ((u < 0 || u > 1) && bad++ < 3) fail(`${what}: the map's flag is ${u} of the way at E ${E}`);
      if (prevU != null && u < prevU - 1e-12 && bad++ < 3) fail(`${what}: the map's flag went back at E ${E}`);
      if (prev && f.stop != null && prev.stop === f.stop && prevU != null && u !== prevU && bad++ < 3) fail(`${what}: the map's flag moved in stop ${f.stop}'s encounter, at E ${E}`);
      if (f.n === L && Math.abs(u - 1) > 1e-9 && bad++ < 3) fail(`${what}: at the road's end the map's flag is ${u} of the way`);
      prevU = u;
      if (prev) {
        if (f.n < prev.n || f.n > prev.n + 1) fail(`${what}: n went from ${prev.n} to ${f.n} at E ${E}`);
        if (f.stop != null && prev.stop === f.stop && f.n !== prev.n) fail(`${what}: the team walked on in stop ${f.stop}'s encounter, at E ${E}`);
        for (let i = 0; i < f.xs.length; i++) {
          const dx = f.xs[i] - prev.xs[i];
          if (dx < -1e-9) fail(`${what}: pair ${i} went back ${dx} at E ${E} (a team never turns back)`);
          if (f.n === prev.n && dx !== 0) fail(`${what}: pair ${i} moved ${dx} standing at E ${E}`);
        }
        // (no skate: a walk step moves each dragon by its walk's distance over that step at its speed -- s times the move
        // of the frame it is in, when the step stays in one frame)
        if (f.n === prev.n + 1) {
          travelSteps++;
          for (let i = 0; i < f.xs.length; i++) {
            const g = gaits[i], sp = f.speeds[i], t0 = sp * prev.n, t1 = sp * f.n;
            const want = walkDist(g, t1) - walkDist(g, t0), dx = f.xs[i] - prev.xs[i];
            if (Math.abs(dx - want) > 1e-9) fail(`${what}: pair ${i} moved ${dx} at E ${E}, its walk says ${want}`);
            const fr = frameAt(g, t0);
            if (fr === frameAt(g, t1 - 1e-9) && Math.abs(Math.abs(dx) - sp * g.frames[fr].move) > 1e-9) fail(`${what}: pair ${i} skated at E ${E}: moved ${dx}, its frame's move x speed is ${sp * g.frames[fr].move}`);
          }
        }
      }
      // (the view's casts, each synced on its plan's steps)
      for (const c of casts) {
        if (sim.clock < c.due) continue;
        c.cast.sync(f, sim.clock);
        c.due = sim.clock + c.plan[c.k++ % c.plan.length];
        if (f.stop != null || f.done || f.n === 0) continue;
        c.cast.dragonFrames().forEach((fi, i) => { petChecks++; const want = frameAt(gaits[i], f.speeds[i] * f.n); if (fi !== want && bad++ < 3) fail(`${what} (view, steps of ${c.plan.join(', ')}): pair ${i} plays walk frame ${fi} at E ${E}, the road says ${want}`); });
      }
      prev = f;
    }
    // (every stop reached and resolved in road order, the road walked to its end; the result card's title there the
    // outcome's, and the outcome every stop cleared)
    if (!isDeepStrictEqual(met, stops.map((_, j) => j)) || !isDeepStrictEqual(ended, met) || reached !== stops.length - 1 || !prev?.done || endWalked !== L) fail(`${what}: met stops ${met.join(',')}, ended ${ended.join(',')}, reached ${reached} of ${stops.length}, done ${prev?.done} at walked ${endWalked} of ${L}`);
    // (the land stops' passages walked through in road order, each once at most: on these short days the stops stand
    // so close that a passage is cut to a step or two, and the road's end cuts the last one short -- the long road below
    // walks them whole)
    const landStops = stops.map((q, j) => (q.kind === 'challenge' && hasPassage(q.challenge!) ? j : -1)).filter((j) => j >= 0);
    if (walkedThrough.some((j, k) => !landStops.includes(j) || (k > 0 && j <= walkedThrough[k - 1]))) fail(`${what}: the lead walked passages ${walkedThrough.join(',')} (${inPassage} frames), the land stops are ${landStops.join(',')}`);
    const cleared = stops.filter((q) => q.result === 'met').length;
    if (trip.success !== (cleared === stops.length) || title !== (trip.success ? 'HOME SAFE!' : 'NOT THIS TIME')) fail(`${what}: ${cleared} of ${stops.length} cleared, success ${trip.success}, the result card ${title}`);
    // (the fight: the best team, with both counters, wears the baddie out; a lone pair with neither sits it out -- the
    // obstacles are checks the road's own rolls decide, so a best team can still come home NOT THIS TIME)
    const kb = stops.findIndex((q) => q.kind === 'baddie');
    if (lone && (trip.success || (kb >= 0 && stops[kb].result === 'met'))) fail(`${what}: a lone pair wore the Mole King out (${stops.map((q) => q.result).join(', ')})`);
    if (!lone && kb >= 0 && stops[kb].result !== 'met') fail(`${what}: the best team sat the fight out (${stops.map((q) => `${q.result} in ${q.turns}`).join(', ')})`);
    // (a baddie always leaves the road, worn out or waited out, by its own exit: the team walks on past where it stood)
    if (trip.exit !== (trip.mission.baddie ? BADDIES[trip.mission.baddie].exit : null)) fail(`${what}: the baddie's exit is ${trip.exit}`);
    if (trip.mission.baddie) {
      if (!trip.exit || !EXITS.includes(trip.exit)) fail(`${what}: the baddie's exit is ${trip.exit}`);
      if (exitSeen !== trip.exit) fail(`${what}: the baddie's exit (${trip.exit}) was never shown`);
      if (trip.exit !== 'calmed' && (lastOff == null || lastOff <= 640)) fail(`${what}: the baddie (${trip.exit}) was last seen at screen x ${lastOff}, not off the right edge`);
    }
    noteUse(sim);
    lines.push(`${region} ${diff}${lone ? ' (RIPPLE alone)' : ''}: all ${stops.length} stops met (${stops.map((q) => `${q.result} in ${q.turns}`).join(', ')}), ${walkedThrough.length} passages walked through (${walkedThrough.map((j) => PASSAGES[stops[j].challenge!]).join(', ')}, ${inPassage} frames), ${title} at the end${trip.mission.baddie ? `, ${trip.mission.baddie} ${trip.exit}${lastOff != null ? ` (off ahead of the team, last seen at screen x ${lastOff.toFixed(0)})` : ''}` : ''}`);
  }
  // (a long road -- the dark, thorns and fog on a 15000-step walk, the stops far apart -- read every fourth step: each
  // land stop's passage is PASSAGE_LEN long from PASSAGE_FROM past its set piece, drawn as the stop went (the cave lit
  // once the way was lit, else dark; the arches in flower once pushed through); the lead walks each whole -- into it
  // only after its stop is resolved, on for hundreds of frames, out the far end -- in road order, and never stands at
  // a stop inside one)
  {
    const sim = new CareSim(START_ROOMS, START_DRAGONS, START_KEEPERS, { seed: 3, dayLen: 600 });
    const m: Mission = { id: 997, region: 'oldmine', title: 'THE LONG ROAD', difficulty: 'normal', challenges: ['dark', 'thorns', 'fog'], baddie: null, days: 2, coin: 80, eggChance: 0, guaranteedEgg: false };
    const wick = sim.dragons.find((d) => d.name === 'WICK')!, ember = sim.dragons.find((d) => d.name === 'EMBER')!, iris = sim.keepers.find((k) => k.name === 'IRIS')!, bea = sim.keepers.find((k) => k.name === 'BEA')!;
    const trip = tripOf(sim, m, [{ dragon: wick.id, keeper: iris.id }, { dragon: ember.id, keeper: bea.id }], 15000);
    trip.auto = true;
    awayNow(sim, trip, sim.clock);
    const runs: { stop: number; frames: number; from: number; state: string; resolved: boolean }[] = [];
    let lastIn: number | null = null;
    for (let s = 0; s < 60000 && sim.missions.trip && sim.missions.trip.state === 'away'; s++) {
      sim.step();
      if (s % 4) continue;
      const f = sceneAt(sim, trip);
      if (f.passages.length !== 3 || f.passages.some((p, j) => p.stop !== j || p.x1 - p.x0 !== PASSAGE_LEN || p.x0 !== f.pieces[j].x + PASSAGE_FROM || p.state !== f.pieces[j].state)) fail(`scene (long road): the passages are ${JSON.stringify(f.passages)} beside the pieces ${JSON.stringify(f.pieces)} at step ${s}`);
      if (f.passage == null) { lastIn = null; continue; }
      if (f.stop != null) fail(`scene (long road): the lead stands at stop ${f.stop} inside stop ${f.passage}'s passage at step ${s}`);
      if (lastIn !== f.passage) { runs.push({ stop: f.passage, frames: 0, from: s, state: f.passages[f.passage].state, resolved: trip.stops[f.passage].result !== 'ahead' }); lastIn = f.passage; }
      runs[runs.length - 1].frames++;
    }
    const V = Math.min(...trip.pairs.map((p) => { const d = sim.dragons.find((q) => q.id === p.dragon)!; return gaitOf(d.element, d.stage).avg; }));
    const want = Math.floor(PASSAGE_LEN / V / 4);
    if (runs.length !== 3 || runs.some((r, j) => r.stop !== j || !r.resolved || r.state === 'ahead' || Math.abs(r.frames - want) > 3)) fail(`scene (long road): the lead walked the passages as ${JSON.stringify(runs)} (want three, stops 0-2 in order, each resolved, about ${want} reads of ${PASSAGE_LEN} px at V ${V.toFixed(3)})`);
    if (trip.stops.some((q) => q.result === 'ahead')) fail(`scene (long road): the road ended with stops ${trip.stops.map((q) => q.result).join(', ')}`);
    noteUse(sim);
    lines.push(`the long road (${m.challenges.join(', ')}, a 15000-step walk): the lead walked ${runs.length} passages whole, in order (${runs.map((r) => `${PASSAGES[trip.stops[r.stop].challenge!]} ${r.state}, ${r.frames} reads`).join('; ')}), each after its stop, none while standing at one`);
  }
  // (the preset puts the trip that far along its walk, the stops before that point resolved -- the world's own trip, as a
  // sent one is once away: its dragons off the map, its riders away, nobody else's -- and a stop at that very point
  // begins its encounter on the first step; `:fail` waits the last resolved stop out; and its world is saved exactly,
  // as any: its team left before the world's clock 0 -- departAt below 0 -- and it loads, steps on and matches the world
  // it was saved from)
  const presetSaves: string[] = [];
  for (const [q, p, fail_] of [['oldmine:0.9', 0.9, false], ['oldmine:0.5:fail', 0.5, true], ['millbrook:0.3', 0.3, false]] as const) {
    const w = buildSim(tripStart(q, 0), 1), t = w.missions.trip!;
    const passed = t.stops.filter((_, j) => stopStart(t, j) < t.walked).length;
    if (t.walked !== Math.round(p * t.travel) || t.encounter || t.success !== null || t.stops.slice(0, passed).some((s, j) => s.result !== (fail_ && j === passed - 1 ? 'unmet' : 'met') || !s.log || s.resolvedAt == null) || t.stops.slice(passed).some((s) => s.result !== 'ahead')) fail(`scene: trip=${q} is at walked ${t.walked} of ${t.travel} with stops ${JSON.stringify(t.stops.map((s) => s.result))}`);
    if (t.state !== 'away' || !t.pairs.every((pr) => w.dragons.find((d) => d.id === pr.dragon)?.place === 'away' && w.keepers.find((k) => k.id === pr.keeper)?.phase === 'away')
      || w.dragons.some((d) => d.place === 'away' && !t.pairs.some((pr) => pr.dragon === d.id))) fail(`scene: trip=${q}'s team is not the world's own, away (${JSON.stringify(t?.state)})`);
    w.step();
    const atStop = t.stops.findIndex((_, j) => stopStart(t, j) === t.walked && j === passed);
    // (the step that reaches a stop begins its encounter, at the meet's start)
    if ((atStop >= 0) !== (t.encounter?.stop === atStop && t.encounter.state === 'meet' && t.encounter.t === 0)) fail(`scene: trip=${q} after a step: the encounter ${JSON.stringify(t.encounter && { stop: t.encounter.stop, state: t.encounter.state, t: t.encounter.t })}, the stop at that point ${atStop}`);
    let back: CareSim | null = null;
    try { back = CareSim.fromSave(JSON.parse(JSON.stringify(serialize(w)))); } catch (e) { fail(`scene: trip=${q}'s world (departAt ${t?.departAt}) can't load its own save: ${(e as Error).message}`); }
    if (back) {
      t.auto = true; back.missions.trip!.auto = true;
      for (let i = 0; i < 2000; i++) { w.step(); back.step(); }
      if (back.digest() !== w.digest()) fail(`scene: trip=${q}'s world, saved and loaded, drifted from the one it was saved from within 2000 steps`);
    }
    presetSaves.push(`${q} (departAt ${t?.departAt}, ${passed} stop(s) resolved${atStop >= 0 ? `, stop ${atStop} met on the first step` : ''})`);
  }
  // (the preview's rider pick asks missions.ts isTaken, as the Map Room's does: BEA, a rider of the Old Mine Road's best team,
  // taken by hand first, rides no more)
  {
    const w = newSim(1), bea = w.keepers.find((k) => k.name === 'BEA')!, rides = () => demoTrip(w, 'oldmine', 'hard').pairs.some((p) => p.keeper === bea.id);
    const before = rides();
    w.command({ kind: 'take', keeper: bea.id }); w.step();
    if (!before || !isTaken(w, bea.id) || rides()) fail(`scene: the rider pick with BEA taken: she rode ${before} before, taken ${isTaken(w, bea.id)}, rides ${rides()}`);
  }
  console.log(`  24 scene: ${lines.join('; ')}; ${frames} steps read, ${travelSteps} walk steps without a skate, the baddie in view ${inFrame} of them; the view's walks on the road's frame at ${petChecks} synced walk steps (jumps of 1, 8, 40 and a 1000-step gap); the scene's types have no hurt state, and exits only calmed, outwitted or driven off; the trip preset's worlds placed and saved exactly (${presetSaves.join('; ')}); a keeper taken by hand is never picked to ride (missions.ts isTaken)`);
}

// ---------- 25. taking a keeper (#6) ----------
if (ROLE === 'saves') {
  // BASE_DESIGN 4.10 (#6): a keeper taken by the player's hand -- walked, climbing the ladders, picking up, serving and putting
  // back by commands (control.ts) -- on seed 1 at the real day, with the section 2 invariants checked every step
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
   * The whole loop by hand: take BEA, feed EMBER (fetching the bowl), climb to f1 and back down,
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
    // (missions.ts isTaken, which the rider pick asks, says so too: BEA taken, nobody else)
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
    // (nothing for E at the foot of a ladder: the line says it climbs)
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
  // every chore by hand (BASE_DESIGN 4.10: fetch, feed, bathe, play, groom and tuck in; a garden resident too): the barn calm (every
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
      // (held by hand or taken at work, missions.ts isTaken says taken -- and of nobody else)
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
    // riders' way off the world, never the hand's, though it is on the keepers' net)
    const w = newSim(1), k = w.keepers.find((q) => q.name === 'BEA')!;
    send(w, { kind: 'take', keeper: k.id }); step(w, at);
    k.f = AERIE_F; k.x = 60; k.y = feetY(AERIE_F); k.legs = []; k.climbing = false;
    send(w, { kind: 'steer', dx: -1, dy: 0 }); step(w, at, 400);
    if (k.f !== AERIE_F || k.x !== HAND_DECK_X0) fail(`control: BEA walked west along the Aerie deck for 400 steps is at floor ${k.f} x ${k.x}, not the deck's end (x ${HAND_DECK_X0})`);
    else r4.push(`walked west on the Aerie, stopped at the deck's end (x ${k.x}), off the bridge`);
    // (walked east, she stops short of the lift bay the deck ends in, the car's way up: held there, she would hold it)
    send(w, { kind: 'steer', dx: 1, dy: 0 });
    let inIt = 0;
    for (let s = 0; s < 600; s++) { step(w, at); if (inBay(k.x, KEEPER_HALF)) inIt++; }
    if (k.f !== AERIE_F || k.x !== LIFT_X0 - KEEPER_HALF || inIt) fail(`control: BEA walked east along the Aerie deck for 600 steps is at floor ${k.f} x ${k.x} (${inIt} steps in the bay), not short of the lift bay (x ${LIFT_X0 - KEEPER_HALF})`);
    else r4.push(`walked east on the Aerie, stopped short of the lift bay (x ${k.x})`);
  }
  // 11. a keeper held by hand never holds up a grow-up: BEA parked at EMBER's stand spot -- inside its new
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
  console.log(`  25 control: BEA taken, fetched the bowl and fed EMBER by hand (${a.fed} steps at work, doneBy ${JSON.stringify(a.w.stats.doneBy)}, ${a.handovers} handed over), climbed the centre ladder up in ${a.up} steps and down in ${a.down}; ${a.held} steps held with ${a.rushed} Rushes and no job she didn't take; let go, home in ${a.home} steps; the same script twice, the same world; every chore by hand: ${chores.join(', ')}; saved held, loaded released and stepping on as a release makes it: ${saves.join(', ')}; R4: ${r4.join(', ')}; parked at EMBER's stand spot as it fell due, it grew ${grewIn} steps past due, no need ever at 0; missions.ts isTaken says taken of the keeper held, or taken at work, and of nobody else`);
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
  // THE LOST NEST (RIPPLE and ECHO, both counters, the trail coach playing: a success, and its sure egg) from a full barn -- the chooser's BARN FULL:
  // THE EGG WILL WAIT (life.ts barnRoom 0) and no refusal for it; away, its dragons still count (the barn full every
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
    if (!trip || trip.success !== null || !trip.egg || trip.nest == null) fail(`cap (missions): THE LOST NEST sent ${trip ? `with success ${trip.success} and egg ${trip.egg} for nest ${trip.nest}` : 'nothing'}, not its sure egg drawn and the outcome open`);
    if (trip) trip.auto = true;
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

// ---------- 27. the Arena: training bouts (BASE_DESIGN 10) ----------
if (ROLE === 'saves') {
  const t27 = performance.now(), ELS = DRAGON_ELEMENTS, SPARS = ['young', 'adult', 'elder'] as const;
  const named = (w: CareSim, name: string) => w.dragons.find((d) => d.name === name)!;
  // (a) the rules (training.ts). The ring: one cycle through the seven elements, each strong against exactly one (the
  // next), weak against exactly one (the one before) and even with the other five, itself among them
  {
    let e: DragonElement = ELS[0];
    const seen: DragonElement[] = [];
    for (let i = 0; i < ELS.length; i++) { seen.push(e); e = BEATS[e]; }
    if (e !== ELS[0] || new Set(seen).size !== ELS.length) fail(`arena: the ring (training.ts BEATS) is not one cycle through the seven elements: ${seen.join(' > ')}`);
    for (const a of ELS) {
      const strong = ELS.filter((b) => typeMult(a, b) === STRONG), weak = ELS.filter((b) => typeMult(a, b) === WEAK), even = ELS.filter((b) => typeMult(a, b) === 1);
      if (strong.length !== 1 || weak.length !== 1 || even.length !== ELS.length - 2 || !even.includes(a) || !BEATS_WHY[a]) fail(`arena: ${a}'s moves are strong on ${strong.join(', ') || 'nothing'} and weak on ${weak.join(', ') || 'nothing'} (want one each, and even with the rest)`);
    }
  }
  // the levels: 1 to MAX_LEVEL, level L at exactly xpFor(L) XP (and not a point before), the XP a level takes growing
  for (let l = 1; l <= MAX_LEVEL; l++) {
    const x = xpInto(xpFor(l)), need = l < MAX_LEVEL ? xpFor(l + 1) - xpFor(l) : 0;
    if (levelOf(xpFor(l)) !== l || (l > 1 && levelOf(xpFor(l) - 1) !== l - 1) || x.level !== l || x.into !== 0 || x.need !== need || (l > 1 && l < MAX_LEVEL && need <= xpFor(l) - xpFor(l - 1))) fail(`arena: LV ${l} is not reached at exactly ${xpFor(l)} XP, or the next level takes no more XP than this one (${need})`);
  }
  if (levelOf(0) !== 1 || levelOf(xpFor(MAX_LEVEL) * 100) !== MAX_LEVEL) fail(`arena: ${levelOf(0)} is not LV 1 at 0 XP, or a dragon past LV ${MAX_LEVEL} levels on`);
  // the XP: a win brings more than a draw, and a draw more than a loss, against a partner of any level; more against a
  // higher level; and a LV 1 sparring a LV 10 is LV 3 or more after one bout, however it goes (the young catch up)
  for (let o = 1; o <= MAX_LEVEL; o++) for (let m = 1; m <= MAX_LEVEL; m++) {
    const win = boutXp(m, o).winner, loss = boutXp(o, m).loser, draw = drawXp(o);
    if (!(win > draw && draw > loss && loss > 0) || (o > 1 && (win <= boutXp(m, o - 1).winner || loss <= boutXp(o - 1, m).loser))) fail(`arena: LV ${m} against LV ${o} earns ${win} XP for a win, ${draw} for a draw and ${loss} for a loss`);
  }
  if (Math.min(levelOf(boutXp(10, 1).loser), levelOf(boutXp(1, 10).winner), levelOf(drawXp(10))) < 3) fail(`arena: a LV 1 sparring a LV 10 is only LV ${levelOf(boutXp(10, 1).loser)} after losing (want 3 or more)`);
  // the skills: a breath and a preen at LV 1, the yawn from LEARN_AT.yawn, the show-off from LEARN_AT.show, the big
  // breath in the breath's place from LEARN_AT.big, four at most, in the move menu's order; each element's names its own;
  // each skill one of the dragon's own anims at every stage that spars, a one-shot, landing inside it; and the nap's
  // sleep (a loop with its lie-down for an intro) and wake
  const menuOf = (l: number): SkillKind[] => [l >= LEARN_AT.big ? 'big' : 'breath', ...(l >= LEARN_AT.show ? ['show' as const] : []), 'preen', ...(l >= LEARN_AT.yawn ? ['yawn' as const] : [])];
  for (const el of ELS) {
    for (let l = 1; l <= MAX_LEVEL; l++) {
      const got = skillsOf(el, l).map((s) => s.kind);
      if (!isDeepStrictEqual(got, menuOf(l)) || got.length > 4) fail(`arena: a LV ${l} ${el} knows ${got.join(' ')}, not ${menuOf(l).join(' ')}`);
    }
    const names = SKILL_KINDS.map((k) => skillOf(el, k).name), learned = learnedBetween(el, 1, MAX_LEVEL).map((s) => s.kind);
    if (new Set(names).size !== names.length || !isDeepStrictEqual(learned, ['yawn', 'show', 'big'])) fail(`arena: ${el}'s skills ${names.join(', ')}, learned ${learned.join(' ')}`);
    for (const st of SPARS) {
      const b = dragonBuild({ element: el, stage: st, seed: 1 }), anims = dragonAnims(st, b.spec, b.dims);
      for (const k of SKILL_KINDS) {
        const s = skillOf(el, k), a = anims[s.anim], len = a ? animLen(el, st, s.anim) : 0;
        if (!a || a.loop || len < 2 || Math.max(1, Math.round(len * s.impact)) >= len) fail(`arena: the ${st} ${el}'s ${s.name} plays ${a ? `${a.loop ? 'a loop' : 'a one-shot'} of ${len} steps` : `no ${s.anim}`} (want a one-shot it lands inside)`);
      }
      if (!anims.sleep?.loop || !(anims.sleep.loopFrom! > 0) || !anims.wake || anims.wake.loop) fail(`arena: the ${st} ${el} has no lie-down and wake for its nap`);
    }
  }
  // the stats: never less with a level (and more PUFF every level), the young under the adult but for its speed, the
  // elder never weaker (its puff and power the adult's, its guard more); the spirits, and a stage's weight
  for (const el of ELS) for (let l = 1; l <= MAX_LEVEL; l++) {
    for (const st of SPARS) {
      const s = statsOf(el, st, l), p = l > 1 ? statsOf(el, st, l - 1) : null;
      if (p && (STAT_NAMES.some((k) => s[k] < p[k]) || s.puff <= p.puff)) fail(`arena: a ${st} ${el} at LV ${l} (${JSON.stringify(s)}) is weaker than at LV ${l - 1} (${JSON.stringify(p)})`);
    }
    const y = statsOf(el, 'young', l), a = statsOf(el, 'adult', l), e = statsOf(el, 'elder', l);
    if (y.puff > a.puff || y.power > a.power || y.guard > a.guard || e.puff < a.puff || e.power < a.power || e.guard <= a.guard) fail(`arena: at LV ${l} a young ${el} ${JSON.stringify(y)}, an adult ${JSON.stringify(a)}, an elder ${JSON.stringify(e)} (the young under the adult, the elder never weaker)`);
  }
  if (spirits(1) !== 1.1 || spirits(0.2) !== 1 || spirits(-0.5) !== 0.9 || !isDeepStrictEqual([-2, -1, 0, 1, 2].map(stageMult), [2 / 3, 4 / 5, 1, 5 / 4, 3 / 2]) || STAGE_MIN !== -2 || STAGE_MAX !== 2) fail('arena: the spirits or a stage\'s weight are not the table\'s');
  // the corners: each stage's spot on the Arena deck, on its net, its body inside the deck; the two facing each other
  // ARENA_GAP apart snout to snout, neither's eye under the other's body (the sim's model: travel.ts bodySpan, eyeSpan;
  // the drawn moves, reach and all: the smoke's view=arenaaudit)
  {
    const nets = newSim(1).nets;
    for (const s0 of SPARS) for (const s1 of SPARS) {
      const x0 = arenaSpot(s0, 0), x1 = arenaSpot(s1, 1), b0 = bodySpan(s0, 1, x0), b1 = bodySpan(s1, -1, x1), e0 = eyeSpan(s0, 1, x0), e1 = eyeSpan(s1, -1, x1);
      const gap = (x1 - DRAGON_BODY[s1].front) - (x0 + DRAGON_BODY[s0].front);
      if (spanOf(AERIE_F, x0, nets.dragon[s0]) < 0 || spanOf(AERIE_F, x1, nets.dragon[s1]) < 0 || b0[0] < ARENA_X0 || b1[1] > ARENA_X1 || Math.abs(gap - ARENA_GAP) > 1
        || (e0[1] > b1[0] && e0[0] < b1[1]) || (e1[1] > b0[0] && e1[0] < b0[1])) fail(`arena: a ${s0} in the west corner (x ${x0}) and a ${s1} in the east (x ${x1}): snouts ${gap} px apart, bodies ${b0.join('-')} and ${b1.join('-')} on the deck ${ARENA_X0}-${ARENA_X1}`);
    }
  }

  // (b) the balance: every pairing of the start's seven (LV 1 adults, in good spirits), each way round, on SPAR_SEEDS
  // seeds, AUTO -- each element wins BALANCE_WINS of its bouts, a bout lasts about BALANCE_TURNS turns and seldom runs out
  // of them; and the levels matter: a dragon a level up wins against its own element a level down, and three levels up
  // even against the element strong on it. Each bout is decided by the Arena's half of a step alone (arena.ts
  // stepArena: nothing else in a world touches a bout from its face-off to its end -- its rolls are stateless and its
  // fighters' numbers fixed at its start); the whole world's bouts are (c)'s
  const SPAR_SEEDS = 4, BALANCE_WINS = [0.35, 0.65], BALANCE_TURNS = [4.5, 8], FULL_TURNS = 0.05, LEVEL_WINS = 0.9;
  const lines27: string[] = [], logs: string[] = [];
  const spar = (cast: readonly DragonPlace[], a: number, b: number, seed: number) => {
    const w = new CareSim(START_ROOMS, cast, START_KEEPERS, { seed });
    for (const d of w.dragons) { for (const k of NEEDS) d.needs[k] = 1; d.mood = moodOf(d.element, d.needs); }
    const bt = boutNow(w, a, b);
    bt.auto = true;
    let ends = 0, winner: number | null = null;
    for (let n = 0; bt.state !== 'over' && n < 40000; n++) {
      w.events = [];
      const had = bt.log.at(-1);
      stepArena(w);
      if (bt.log.at(-1) !== had) logs.push(bt.log.at(-1)!);
      for (const e of w.events) if (e.kind === 'boutEnd') { ends++; winner = e.winner; }
    }
    if (bt.state !== 'over' || ends !== 1) fail(`arena (balance): ${w.dragons[a].name} and ${w.dragons[b].name} on seed ${seed}: the bout is at ${bt.state} with ${ends} ends`);
    return { winner, turns: bt.turn };
  };
  {
    const wins = new Map<DragonElement, number>(), hist: number[] = Array(MAX_TURNS + 1).fill(0);
    let n = 0, turns = 0, draws = 0;
    for (let seed = 1; seed <= SPAR_SEEDS; seed++) for (let i = 0; i < START_DRAGONS.length; i++) for (let j = 0; j < START_DRAGONS.length; j++) {
      if (i === j) continue;
      const r = spar(START_DRAGONS, i, j, seed * 100 + i * 7 + j);
      n++; turns += r.turns; hist[r.turns]++;
      if (r.winner == null) draws++;
      else wins.set(START_DRAGONS[r.winner].element, (wins.get(START_DRAGONS[r.winner].element) ?? 0) + 1);
    }
    const each = 2 * (START_DRAGONS.length - 1) * SPAR_SEEDS, mean = turns / n;
    for (const el of ELS) { const s = (wins.get(el) ?? 0) / each; if (s < BALANCE_WINS[0] || s > BALANCE_WINS[1]) fail(`arena (balance): ${el} won ${wins.get(el) ?? 0} of its ${each} bouts (want ${BALANCE_WINS[0] * 100}-${BALANCE_WINS[1] * 100} %)`); }
    if (mean < BALANCE_TURNS[0] || mean > BALANCE_TURNS[1] || hist[MAX_TURNS] > FULL_TURNS * n) fail(`arena (balance): bouts last ${mean.toFixed(2)} turns on average (want ${BALANCE_TURNS.join('-')}), ${hist[MAX_TURNS]} of ${n} ran out of turns`);
    // levels: a twin of each element's (a second adult) a level up against it, and each element three levels up against
    // the element strong on it, each way round
    let up1 = 0, up3 = 0, m1 = 0, m3 = 0;
    for (let seed = 1; seed <= SPAR_SEEDS; seed++) for (let i = 0; i < START_DRAGONS.length; i++) {
      const p = START_DRAGONS[i], twin: DragonPlace = { ...p, name: 'TWIN', seed: 900 + i, slot: { room: 'kitchen', i: 0, n: 1 }, xp: xpFor(2) };
      const r = spar([...START_DRAGONS, twin], START_DRAGONS.length, i, seed * 100 + i); m1++; if (r.winner === START_DRAGONS.length) up1++;
      const j = START_DRAGONS.findIndex((q) => BEATS[q.element] === p.element), cast = START_DRAGONS.map((q, k) => (k === i ? { ...q, xp: xpFor(4) } : q));
      for (const [x, y, s] of [[i, j, seed * 100 + i], [j, i, seed * 100 + 50 + i]] as const) { const q = spar(cast, x, y, s); m3++; if (q.winner === i) up3++; }
    }
    if (up1 < LEVEL_WINS * m1 || up3 < LEVEL_WINS * m3) fail(`arena (levels): a level up won ${up1} of ${m1} against its own element; three levels up, ${up3} of ${m3} against the element strong on it (want ${LEVEL_WINS * 100} % or more)`);
    lines27.push(`balance (${n} bouts: the start's seven, each pairing each way on ${SPAR_SEEDS} seeds, AUTO): wins of ${each} ${ELS.map((el) => `${el} ${wins.get(el) ?? 0}`).join(', ')}; ${mean.toFixed(2)} turns on average (${hist.map((c, t) => (c ? `${t}: ${c}` : '')).filter(Boolean).join(', ')}), ${draws} draws; a level up won ${up1}/${m1} against its own element, three up ${up3}/${m3} against the element strong on it`);
  }

  // (c) a whole bout in the world (seed 1, the real day), by commands, the section 2 invariants checked every step:
  // begun at the first moment a keeper has just set to work with one dragon (the player's) while another sleeps (its
  // partner), both free to spar -- the keeper finishes, the sleeper sleeps on (its nap running: the needs wait, the acts
  // don't), each keeps its slot until it sets off; both ride up to their corners (the first up the east one), face each
  // other (the Arena used, once) and spar: the first pick left to the coach after PICK_WAIT, the skills the player's
  // doesn't know yet refused, a pick in the middle of a move ignored, a PREEN and a breath picked by hand, then AUTO. Each
  // move its dragon's own anim, landing at its impact; the XP, the level and the skill it brings; tired and hungry; the
  // nap and the preen; home, the west corner first, the bout over once both are off the deck, and both settle in slots
  // with their needs draining again. The same script twice, the same world; saves taken mid-muster, riding up, at the
  // face-off, at the first pick, mid-move, decided and walking home step on (loaded, through JSON) exactly as the world.
  const MUSTER_MAX = 6000, HOME_MAX = 4000, FORK_STEPS = 600;
  const NEXT: Readonly<Record<BoutState, readonly (BoutState | null)[]>> = { muster: ['face'], face: ['pick'], pick: ['play'], play: ['pick', 'over'], over: ['home'], home: [null] };
  const inv = (w: CareSim, at: string) => {
    for (const d of w.dragons) for (const k of NEEDS) if (!(d.needs[k] >= 0 && d.needs[k] <= 1)) fail(`${at}, step ${w.tick}: ${d.name}'s ${k} is ${d.needs[k]}`);
    for (const j of w.jobs) if (j.keeper && j.keeper.job !== j) fail(`${at}, step ${w.tick}: job ${j.id}'s keeper ${j.keeper.name} is on another job`);
    for (const k of w.keepers) {
      if ((k.phase === 'idle') !== (!k.job && !k.legs.length)) fail(`${at}, step ${w.tick}: ${k.name} is ${k.phase} with ${k.job ? 'a job' : 'no job'}`);
      if (!k.climbing && spanOf(k.f, k.x, w.nets.keeper) < 0) fail(`${at}, step ${w.tick}: ${k.name} stands off floor ${k.f} at x ${k.x.toFixed(1)}`);
    }
    if (w.lift.moving) { const r = liftRange(w)!, who = inTheBay(w, r[0], r[1]); if (who) fail(`${at}, step ${w.tick}: ${who} is in the lift bay while the car moves floors ${r[0]}-${r[1]}`); }
    for (const d of w.dragons) {
      if (d.move !== 'ride' && spanOf(d.f, d.x, w.nets.dragon[d.stage]) < 0) fail(`${at}, step ${w.tick}: ${d.name} stands off its floor`);
      if (d.act && d.place === 'barn' && (!d.slot || Math.abs(d.x - d.slot.x) >= 0.5 || w.rooms[d.slot.room].kind !== NEED_ROOM[d.act.need])) fail(`${at}, step ${w.tick}: ${d.name} is met for ${d.act.need} away from its slot of the ${NEED_ROOM[d.act.need]}`);
      // (nobody but the bout's two ever on the Arena deck)
      if (d.f === AERIE_F && d.move !== 'ride' && d.x > ARENA_X0 && fighterIndex(w, d) < 0) fail(`${at}, step ${w.tick}: ${d.name}, not sparring, is on the Arena deck at x ${d.x.toFixed(1)}`);
    }
  };
  const boutRun = (forks: boolean) => {
    const w = newSim(1), at = 'arena (a bout)', fighters: Dragon[] = [];
    const live: { sim: CareSim; left: number; what: string; since: Uses }[] = [], saved: string[] = [], seenStates = new Set<string>();
    const out = { w, begun: '', musterSteps: -1, corners: [] as string[], pickWait: -1, picks: [] as string[], moves: 0, lookKeys: new Set<number>(), winner: '', xp: [0, 0], events: [] as string[], overSteps: -1, homeOrder: '', clearAt: -1, settledAt: -1, saved, met: -1, woke: -1, playTurns: 0 };
    const cmd = (c: Command) => { w.command(c); for (const f of live) f.sim.command(c); };
    const fork = (what: string) => {
      if (!forks || seenStates.has(what)) return;
      seenStates.add(what);
      const sim = CareSim.fromSave(through(serialize(w)));
      if (!isDeepStrictEqual(sim.arena, w.arena)) fail(`arena (saves): a save taken ${what} loaded another arena`);
      live.push({ sim, left: FORK_STEPS, what, since: uses(sim) }); saved.push(`${what} (step ${w.tick})`);
    };
    const prevNeeds = new Map<number, Needs>();
    let prevState: BoutState | null = null;
    const step = () => {
      const b0 = w.arena.bout, puff0 = b0 ? b0.fighters.map((f) => f.puff) : null, landed0 = b0?.state === 'play' ? b0.moves.map((m) => m.landed) : null;
      w.step(); inv(w, at);
      for (let i = live.length - 1; i >= 0; i--) {
        const f = live[i];
        f.sim.step();
        if (--f.left > 0) continue;
        if (f.sim.digest() !== w.digest()) fail(`arena (saves): a save taken ${f.what} stepped on to another world by step ${w.tick}`);
        noteUse(f.sim, f.since); live.splice(i, 1);
      }
      const b = w.arena.bout;
      // the state machine: only its own next states, the bout's two held to it
      const st = b?.state ?? null;
      if (st !== prevState) {
        if (prevState && !NEXT[prevState].includes(st)) fail(`${at}, step ${w.tick}: the bout went from ${prevState} to ${st}`);
        prevState = st;
      }
      if (!b) return;
      for (const [i, f] of b.fighters.entries()) {
        const d = fighters[i], prev = prevNeeds.get(d.id);
        if (f.puff < 0 || f.puff > f.stats.puff || [f.power, f.guard, f.speed].some((v) => v < STAGE_MIN || v > STAGE_MAX) || b.turn > MAX_TURNS) fail(`${at}, step ${w.tick}: ${d.name}'s puff ${f.puff} of ${f.stats.puff}, stages ${f.power} ${f.guard} ${f.speed}, turn ${b.turn}`);
        if (d.goal === 'bout') {
          // (its needs wait -- a job under way runs on -- and fall once, to TIRED, the step the bout is decided; no job
          // opens for it, and a keeper still on one is at work, finishing)
          const decided = b.state === 'over' && b.t === 0;
          if (prev && NEEDS.some((k) => d.needs[k] < prev[k] - 1e-12 && !(decided && (k === 'food' || k === 'sleep') && d.needs[k] <= TIRED))) fail(`${at}, step ${w.tick}: ${d.name}'s needs fell in its bout: ${JSON.stringify(prev)} to ${JSON.stringify(d.needs)}`);
          if (w.jobs.some((j) => j.dragon === d && j.keeper?.phase !== 'work')) fail(`${at}, step ${w.tick}: ${d.name} has a job open in its bout`);
        }
        prevNeeds.set(d.id, { ...d.needs });
        // (from the face-off to its end, both in their corners, facing each other, still)
        if (['face', 'pick', 'play', 'over'].includes(b.state) && (f.corner == null || !standsAt(d, AERIE_F, arenaSpot(d.stage, f.corner)) || d.facing !== (f.corner === 0 ? 1 : -1))) fail(`${at}, step ${w.tick}: ${d.name} is not in its corner at ${b.state} (f${d.f} x ${d.x.toFixed(1)}, facing ${d.facing}, corner ${f.corner})`);
        if (f.corner != null && !out.corners.includes(d.name)) out.corners.push(d.name);
      }
      if (b.state === 'play') {
        const m = b.moves[b.cur], me = fighters[m.by], other = fighters[1 - m.by], sk = skillOf(me.element, m.skill);
        if (m.len !== animLen(me.element, me.stage, sk.anim) || m.at !== Math.max(1, Math.round(m.len * sk.impact))) fail(`${at}, step ${w.tick}: ${me.name}'s ${sk.name} lasts ${m.len} and lands at ${m.at}`);
        // (a move lands at its impact, costing the other exactly its loss)
        if (landed0 && b.moves.length === landed0.length && m.landed && !landed0[b.cur]) {
          out.moves++;
          if (m.t !== m.at || b.fighters[1 - m.by].puff !== Math.max(0, puff0![1 - m.by] - m.loss) || (sk.type === 'status') !== (m.loss === 0 && m.hit)) fail(`${at}, step ${w.tick}: ${me.name}'s ${sk.name} landed at ${m.t} (its impact ${m.at}), ${other.name}'s puff ${puff0![1 - m.by]} to ${b.fighters[1 - m.by].puff} for a loss of ${m.loss}`);
          logs.push(b.log.at(-1)!);
        }
        // (the view: the mover plays the skill's anim through, a new key each move; the other shows a face once it lands)
        const look = boutLook(w, me), seen = boutLook(w, other);
        if (m.t < m.len ? look?.anim !== sk.anim : look != null) fail(`${at}, step ${w.tick}: ${me.name} shows ${JSON.stringify(look)} at ${m.t} of its ${sk.name}'s ${m.len}`);
        if (look) out.lookKeys.add(look.key);
        if ((seen != null) !== (m.landed && m.t - m.at < FACE_FRAMES && m.skill !== 'preen' && (m.skill !== 'yawn' || !!m.moved))) fail(`${at}, step ${w.tick}: ${other.name} shows ${JSON.stringify(seen)} ${m.t - m.at} steps after ${me.name}'s ${sk.name} landed`);
      }
    };
    // 1. the first moment a keeper has just set to work with one dragon while another sleeps, both free to spar
    let keeper: Keeper | null = null;
    for (let s = 0; s < 8000 && !fighters.length; s++) {
      step();
      const k = w.keepers.find((q) => q.phase === 'work' && q.job && q.t < 30 && !fighterReason(w, q.job.dragon));
      const y = k && w.dragons.find((d) => d !== k.job!.dragon && d.act?.need === 'sleep' && d.asleep > 300 && !w.jobs.some((j) => j.dragon === d && j.keeper) && !fighterReason(w, d));
      if (k && y) { keeper = k; fighters.push(k.job!.dragon, y); }
    }
    if (!keeper) { fail(`${at}: no keeper set to work with one dragon while another slept in 8000 steps`); return out; }
    const [pl, pa] = fighters, need = keeper.job!.need, slots = fighters.map((d) => d.slot), done0 = w.stats.done;
    out.begun = `${pl.name} being met for ${need} by ${keeper.name} and ${pa.name} asleep, at step ${w.tick}`;
    cmd({ kind: 'bout', dragons: [pl.id, pa.id] });
    step();
    const ev = w.events.find((e) => e.kind === 'bout');
    if (!ev || ev.kind !== 'bout' || ev.reason !== null || pl.goal !== 'bout' || pa.goal !== 'bout' || w.arena.bout?.state !== 'muster') fail(`${at}: the bout command gave ${JSON.stringify(ev)}, goals ${pl.goal} ${pa.goal}`);
    fork('mid-muster');
    // 2. the muster: the keeper finishes, the sleeper sleeps on, each keeps its slot until it sets off; then to the corners
    const m0 = w.tick, nap0 = pa.act!.len - pa.act!.t, whoFirst: number[] = [];
    for (let s = 0; s < MUSTER_MAX && w.arena.bout?.state === 'muster'; s++) {
      const was = { met: pl.act ? pl.needs[pl.act.need] : -1, nap: pa.act?.need === 'sleep' ? pa.act.t : -1 };
      step();
      fighters.forEach((d, i) => {
        if ((d.act || d.asleep > 0) && d.slot !== slots[i]) fail(`${at}, step ${w.tick}: ${d.name} let its slot go while ${d.act ? `met for ${d.act.need}` : 'asleep'}`);
        const o = (d.act || d.asleep > 0) && w.dragons.find((q) => q !== d && q.slot === slots[i]);
        if (o) fail(`${at}, step ${w.tick}: ${o.name} took ${d.name}'s slot while it was still in it`);
      });
      if (was.met >= 0 && pl.act && pl.needs[pl.act.need] <= was.met && pl.needs[pl.act.need] < 1) fail(`${at}, step ${w.tick}: ${pl.name}'s ${pl.act.need} stood at ${pl.needs[pl.act.need]} while it was met`);
      if (was.nap >= 0 && pa.act?.need === 'sleep' && pa.act.t !== was.nap + 1) fail(`${at}, step ${w.tick}: ${pa.name}'s nap stood still in the muster (${was.nap} to ${pa.act.t})`);
      if (out.met < 0 && !pl.act) out.met = w.tick - m0;
      if (out.woke < 0 && !pa.act) out.woke = w.tick - m0;
      for (const [i, f] of w.arena.bout!.fighters.entries()) if (f.corner != null && !whoFirst.includes(i)) whoFirst.push(i);
      if (fighters.some((d) => d.move === 'ride')) fork('riding up');
    }
    out.musterSteps = w.tick - m0;
    const b = w.arena.bout;
    if (!b || b.state !== 'face') { fail(`${at}: the muster took more than ${MUSTER_MAX} steps (the bout at ${b?.state})`); return out; }
    if (w.jobs.some((j) => fighters.includes(j.dragon)) || w.stats.done < done0 + 1 || pl.needs[need] !== 1 || keeper.job?.dragon === pl) fail(`${at}: ${keeper.name} did not finish with ${pl.name} (done ${w.stats.done - done0}, ${need} ${pl.needs[need]})`);
    if (out.woke < 0 || out.woke < nap0 - 1) fail(`${at}: ${pa.name} woke ${out.woke} steps into the muster, its nap ${nap0} steps from its end`);
    if (b.fighters[whoFirst[0]].corner !== 1 || b.fighters[whoFirst[1]].corner !== 0) fail(`${at}: the first up took the ${b.fighters[whoFirst[0]]?.corner === 0 ? 'west' : 'east'} corner (want the east)`);
    if ((w.stats.used.arena ?? 0) !== 1) fail(`${at}: the Arena counted used ${w.stats.used.arena ?? 0} times at the face-off (want once)`);
    const board = w.missions.board[0], others = w.dragons.filter((d) => !fighters.includes(d));
    if (board && fighters.some((d) => dragonReason(w, d, board) !== 'SPARRING')) fail(`${at}: the Map Room's chooser says ${fighters.map((d) => dragonReason(w, d, board)).join(', ')} of the two sparring`);
    if (canSpar(w, others[0].id, others[1].id) !== 'A BOUT IS ON') fail(`${at}: a second bout was not refused while one is on`);
    fork('at the face-off');
    // 3. the turns: the first pick waits PICK_WAIT for the player, then the coach picks
    while (w.arena.bout?.state === 'face') step();
    fork('at the first pick');
    const p0 = w.tick;
    while (w.arena.bout?.state === 'pick') step();
    out.pickWait = w.tick - p0;
    if (out.pickWait !== PICK_WAIT) fail(`${at}: the first pick waited ${out.pickWait} steps for the player (want PICK_WAIT, ${PICK_WAIT})`);
    // (the bout's state now: read afresh, as a step moves it on)
    const stateNow = (): BoutState | null => w.arena.bout?.state ?? null;
    while (stateNow() === 'play' && !w.arena.bout!.moves[0].landed) step();
    fork('mid-move');
    // (the second turn: a pick in the middle of a move ignored, the skills the player's doesn't know yet refused; a PREEN
    // by hand, then a breath, then AUTO)
    if (stateNow() === 'play') { cmd({ kind: 'skill', skill: 'breath' }); step(); if (w.arena.bout?.pick) fail(`${at}: a pick in the middle of a move was taken`); }
    const pickBy = (k: SkillKind): boolean => {
      while (stateNow() && stateNow() !== 'pick' && stateNow() !== 'over') step();
      const bt = w.arena.bout;
      if (!bt || bt.state !== 'pick') return false;
      for (const no of ['yawn', 'show', 'big'] as const) if (!skillsOf(pl.element, bt.fighters[0].level).some((s) => s.kind === no)) { cmd({ kind: 'skill', skill: no }); step(); if (stateNow() !== 'pick' || bt.pick) fail(`${at}: ${pl.name} at LV ${bt.fighters[0].level} was given ${no}, a skill it doesn't know`); }
      cmd({ kind: 'skill', skill: k }); step();
      const m = bt.moves.find((q) => q.by === 0);
      if (stateNow() !== 'play' || m?.skill !== k) fail(`${at}: ${pl.name}'s pick of ${k} began a turn with ${m?.skill} (${stateNow()})`);
      out.picks.push(k);
      return true;
    };
    if (pickBy('preen')) pickBy('breath');
    if (stateNow() && stateNow() !== 'over') {
      cmd({ kind: 'coach', on: true });
      // (AUTO: every pick that follows the coach's, at once)
      while (stateNow() && stateNow() !== 'over') {
        const was = stateNow();
        step();
        if (was === 'pick' && stateNow() === 'pick') fail(`${at}: with AUTO on, a pick waited for the player`);
      }
    }
    // 4. decided: the winner, the XP, the level and skill it brings, tired and hungry; the nap and the preen
    const bo = w.arena.bout;
    if (!bo || bo.state !== 'over') { fail(`${at}: the bout never ended (${bo?.state})`); return out; }
    out.playTurns = bo.turn;
    const endE = w.events.find((e) => e.kind === 'boutEnd');
    out.events = w.events.filter((e) => e.kind !== 'bout').map((e) => JSON.stringify(e));
    const [p, q] = bo.fighters, lv = [p.level, q.level], wi = bo.winner;
    const want: [number, number] = wi == null ? [drawXp(lv[1]), drawXp(lv[0])] : wi === 0 ? [boutXp(lv[0], lv[1]).winner, boutXp(lv[0], lv[1]).loser] : [boutXp(lv[1], lv[0]).loser, boutXp(lv[1], lv[0]).winner];
    const decidedRight = wi === (p.puff <= 0 ? 1 : q.puff <= 0 ? 0 : wi);
    if (!endE || endE.kind !== 'boutEnd' || !isDeepStrictEqual([...bo.xp], want) || !isDeepStrictEqual([...endE.xp], want) || endE.winner !== (wi == null ? null : fighters[wi].id) || !decidedRight
      || pl.xp !== want[0] || pa.xp !== want[1]) fail(`${at}: the bout ended ${JSON.stringify(endE)} with XP ${JSON.stringify(bo.xp)} (want ${JSON.stringify(want)}; puff ${p.puff} and ${q.puff})`);
    for (const [i, d] of fighters.entries()) {
      const lvNow = levelOf(d.xp), lvE = w.events.filter((e) => e.kind === 'level' && e.dragon === d.id), learnE = w.events.filter((e) => e.kind === 'learn' && e.dragon === d.id).map((e) => (e.kind === 'learn' ? e.skill : ''));
      if ((lvNow > lv[i]) !== (lvE.length === 1) || !isDeepStrictEqual(learnE, learnedBetween(d.element, lv[i], lvNow).map((s) => s.kind))) fail(`${at}: ${d.name} went from LV ${lv[i]} to ${lvNow} with ${lvE.length} level and ${learnE.join(' ') || 'no'} learn events`);
      if (d.needs.food > TIRED || d.needs.sleep > TIRED) fail(`${at}: ${d.name} came out of its bout with food ${d.needs.food.toFixed(2)} and sleep ${d.needs.sleep.toFixed(2)} (want TIRED, ${TIRED}, or less)`);
    }
    out.winner = wi == null ? 'a draw' : fighters[wi].name; out.xp = [...bo.xp];
    fork('decided');
    const o0 = w.tick, loser = wi == null ? null : fighters[1 - wi], len = overLen(w, bo);
    while (w.arena.bout?.state === 'over') {
      step();
      if (loser && w.arena.bout?.state === 'over') { const l = boutLook(w, loser); if (w.arena.bout.t < animLen(loser.element, loser.stage, 'sleep', true) + NAP_STEPS ? l?.anim !== 'sleep' : l != null) fail(`${at}, step ${w.tick}: ${loser.name}, out of puff, shows ${JSON.stringify(l)} at ${w.arena.bout.t} of its nap`); }
    }
    out.overSteps = w.tick - o0;
    if (out.overSteps !== len) fail(`${at}: the two stayed in the ring ${out.overSteps} steps after the bout was decided (want overLen, ${len})`);
    // 5. home: the west corner first, the east HOME_GAP later; the bout over once both are off the deck
    fork('walking home');
    if (canSpar(w, others[0].id, others[1].id) !== 'THE LAST PAIR IS WALKING HOME') fail(`${at}: a bout was not refused while the last pair walks home`);
    const h0 = w.tick, west = fighters[p.corner === 0 ? 0 : 1], east = fighters[p.corner === 0 ? 1 : 0], off: number[] = [];
    for (let s = 0; s < HOME_MAX && w.arena.bout; s++) {
      step();
      for (const d of [west, east]) if (d.goal !== 'bout' && !off.includes(d.id)) off.push(d.id);
    }
    out.clearAt = w.tick - h0;
    out.homeOrder = off.map((id) => w.dragons.find((d) => d.id === id)!.name).join(' then ');
    if (w.arena.bout || off[0] !== west.id || off.length !== 2) fail(`${at}: walking home, ${out.homeOrder || 'nobody'} set off (want the west corner's ${west.name} first), the bout ${w.arena.bout ? 'still on' : 'over'} after ${out.clearAt} steps`);
    // (settled in slots, asking again: their needs drain)
    const cleared = new Map(fighters.map((d) => [d.id, { ...d.needs }] as const));
    let s2 = 0;
    for (; s2 < HOME_MAX && !fighters.every((d) => d.slot && !d.legs.length && d.move === 'still' && d.goal !== 'settle'); s2++) step();
    out.settledAt = s2;
    if (fighters.some((d) => !d.slot) || fighters.some((d) => NEEDS.every((k) => !hasNeed(d.element, k) || d.needs[k] >= cleared.get(d.id)![k]))) fail(`${at}: back from the Arena, ${fighters.map((d) => `${d.name} ${d.slot ? `in the ${w.rooms[d.slot.room].kind}` : 'with no slot'}`).join(', ')}, its needs not draining`);
    for (let s = 0; s < FORK_STEPS && live.length; s++) step();
    if (live.length) fail(`arena (saves): ${live.length} saves were never compared`);
    if (out.lookKeys.size < out.moves) fail(`${at}: ${out.moves} moves played with ${out.lookKeys.size} look keys (want a new one each)`);
    noteUse(w);
    return out;
  };
  const r1 = boutRun(true), r2 = boutRun(false);
  if (r1.w.tick !== r2.w.tick || r1.w.digest() !== r2.w.digest()) fail(`arena: the same bout twice gave two worlds (steps ${r1.w.tick} and ${r2.w.tick})`);
  lines27.push(`a bout (seed 1): begun with ${r1.begun} -- met ${r1.met} and woke ${r1.woke} steps into the muster, in their corners (${r1.corners.join(' first, then ')}) in ${r1.musterSteps} steps; the first pick waited ${r1.pickWait} steps, then ${r1.picks.join(' and ')} by hand and AUTO; ${r1.moves} moves in ${r1.playTurns} turns; ${r1.winner} won (+${r1.xp[0]} and +${r1.xp[1]} XP: ${r1.events.join(' ')}); ${r1.overSteps} steps in the ring after; home ${r1.homeOrder}, the bout over ${r1.clearAt} steps on, settled ${r1.settledAt} later; the same twice; saves ${r1.saved.join(', ')} stepped on ${FORK_STEPS} to the same world`);

  // (d) who may spar (arena.ts canSpar, fighterReason): a bout of one dragon, of an unknown one, a baby, a garden
  // resident, one away with a mission's team, and one with a need at its yellow bubble -- each word its own -- refused
  // by the command itself (a `bout` event with the reason, nothing changed)
  {
    const refusals: string[] = [];
    const refuse = (w: CareSim, a: number, b: number, want: string, what: string) => {
      w.command({ kind: 'bout', dragons: [a, b] });
      w.step();
      const e = w.events.find((q) => q.kind === 'bout');
      if (!e || e.kind !== 'bout' || e.reason !== want || w.arena.bout || w.arena.bouts !== 0 || w.dragons.some((d) => d.goal === 'bout')) fail(`arena (who may spar): ${what}: ${JSON.stringify(e)} (want refused: ${want})`);
      else refusals.push(`${what} "${want}"`);
    };
    const w = newSim(1), [ember, bramble] = [named(w, 'EMBER'), named(w, 'BRAMBLE')];
    refuse(w, ember.id, ember.id, 'PICK TWO DRAGONS', 'one dragon');
    refuse(w, ember.id, 99, 'PICK TWO DRAGONS', 'an unknown one');
    for (const [who, k] of [[ember, 'food'], [ember, 'sleep'], [ember, 'play'], [named(w, 'RIPPLE'), 'bath'], [bramble, 'love']] as const) {
      const was = who.needs[k];
      who.needs[k] = SOON - 0.02;
      refuse(w, who.id, (who === bramble ? ember : bramble).id, `${who.name} IS ${LOW_NEED[k]}`, `${k} low`);
      who.needs[k] = was;
    }
    const tw = buildSim(startSpec('twelve'), 1), baby = tw.dragons.find((d) => d.stage === 'baby')!;
    refuse(tw, named(tw, 'EMBER').id, baby.id, `${baby.name} IS A BABY`, 'a baby');
    const gw = buildSim(startSpec('garden'), 1), res = gw.dragons.find((d) => d.place === 'garden')!, home = gw.dragons.find((d) => d.place === 'barn')!;
    refuse(gw, home.id, res.id, `${res.name} IS IN THE GARDEN`, 'a resident');
    const mw = newSim(1);
    sendLostNest(mw);
    const away = mw.dragons.find((d) => d.goal === 'muster')!, other = mw.dragons.find((d) => d.goal !== 'muster')!;
    refuse(mw, other.id, away.id, `${away.name} IS AWAY`, 'a mission\'s');
    if (fighterReason(w, ember) !== null || canSpar(w, ember.id, bramble.id) !== null) fail(`arena (who may spar): EMBER and BRAMBLE, rested, were refused: ${canSpar(w, ember.id, bramble.id)}`);
    lines27.push(`who may spar: refused ${refusals.join(', ')}; a second bout while one is on, and while its pair walks home (c)`);
  }

  // (e) saves: the bout preset (arena.ts boutNow) -- its pair in their corners at the face-off, nobody counted in the
  // Arena, the move menu up at step 90 (the frozen shot) -- through JSON and back; a version-9 save (before the Arena)
  // migrated (save.ts migrateSave) loads with every dragon at 0 XP and no bout, the same world; any other version is
  // left alone and refused; and a save whose bout this build can't run throws
  {
    const pw = buildSim(startSpec('bout'), 1), pb = pw.arena.bout!;
    const [pe, pbr] = BOUT_PAIR.map((q) => named(pw, q.name));
    const posed = pb && pb.state === 'face' && pb.fighters.every((f, i) => f.corner === i) && [pe, pbr].every((d, i) => d.goal === 'bout' && standsAt(d, AERIE_F, arenaSpot(d.stage, i as 0 | 1)) && d.facing === (i === 0 ? 1 : -1) && levelOf(d.xp) === BOUT_PAIR[i].level);
    if (!posed || (pw.stats.used.arena ?? 0) !== 0) fail(`arena (the bout preset): ${JSON.stringify({ state: pb?.state, corners: pb?.fighters.map((f) => f.corner), at: [pe, pbr].map((d) => [d.f, d.x, d.facing, levelOf(d.xp)]) })}, used ${pw.stats.used.arena ?? 0}`);
    for (let s = 0; s < 90; s++) pw.step();
    if (pw.arena.bout?.state !== 'pick' || pw.arena.bout.t !== 90 - FACE_STEPS) fail(`arena (the bout preset): at step 90 the bout is at ${pw.arena.bout?.state} ${pw.arena.bout?.t}, not the move menu`);
    const back = CareSim.fromSave(through(serialize(pw)));
    if (back.digest() !== pw.digest()) fail('arena (the bout preset): its save loaded another world');
    // (the version 9 save: the world before the Arena, 300 steps in)
    const w9 = newSim(2);
    for (let s = 0; s < 300; s++) w9.step();
    const s9 = through(serialize(w9)) as unknown as Record<string, unknown> & { dragons: Record<string, unknown>[] };
    s9.v = 9; delete s9.arena; for (const d of s9.dragons) delete d.xp;
    let threw9: unknown = null, threw8: unknown = null;
    try { CareSim.fromSave(s9 as unknown as SaveV); } catch (e) { threw9 = e; }
    const m9 = CareSim.fromSave(migrateSave(s9) as SaveV), s8 = { ...s9, v: 8 };
    try { CareSim.fromSave(migrateSave(s8) as SaveV); } catch (e) { threw8 = e; }
    if (!(threw9 instanceof SaveVersionError) || m9.digest() !== w9.digest() || m9.dragons.some((d) => d.xp !== 0) || m9.arena.bout || migrateSave(s8) !== s8 || !(threw8 instanceof SaveVersionError)) fail(`arena (saves): a version 9 save ${threw9 instanceof SaveVersionError ? 'refused as it is' : 'loaded as it is'}, migrated ${m9.digest() === w9.digest() ? 'the same world' : 'another world'}; version 8 ${threw8 instanceof SaveVersionError ? 'refused' : 'loaded'}`);
    // (a bout this build can't run: each of these, made from a save taken mid-move, throws)
    const mid = buildSim(startSpec('bout'), 1);
    mid.arena.bout!.auto = true;
    for (let s = 0; s < 200 && mid.arena.bout?.state !== 'play'; s++) mid.step();
    const base = serialize(mid);
    type RawBout = { id: number; state: string; turn: number; cur: number; xp: number[]; fighters: { dragon: number; corner: number | null; puff: number; guard: number; stats: { puff: number } }[]; moves: { skill: string }[] };
    type RawSave = { arena?: { bouts: number; bout: RawBout | null }; dragons: { xp?: unknown }[] };
    const bt = (s: RawSave) => s.arena!.bout!;
    const broken: [string, (s: RawSave) => void][] = [
      ['one dragon twice', (s) => { const b = bt(s); b.fighters[1].dragon = b.fighters[0].dragon; }],
      ['a dragon it hasn\'t', (s) => { bt(s).fighters[0].dragon = 99; }],
      ['more puff than its whole', (s) => { const f = bt(s).fighters[0]; f.puff = f.stats.puff + 1; }],
      ['a stage past +2', (s) => { bt(s).fighters[1].guard = STAGE_MAX + 1; }],
      ['a state it doesn\'t know', (s) => { bt(s).state = 'brawl'; }],
      ['a turn past the last', (s) => { bt(s).turn = MAX_TURNS + 1; }],
      ['three moves in a turn', (s) => { const m = bt(s).moves; m.push(m[0], m[0]); }],
      ['a move of a skill it doesn\'t know', (s) => { bt(s).moves[0].skill = 'fireball'; }],
      ['a move playing that isn\'t there', (s) => { bt(s).cur = 2; }],
      ['an id not yet begun', (s) => { bt(s).id = s.arena!.bouts; }],
      ['both in one corner', (s) => { for (const f of bt(s).fighters) f.corner = 1; }],
      ['XP below 0', (s) => { bt(s).xp = [-1, 0]; }],
      ['no arena', (s) => { delete s.arena; }],
      ['a dragon in a bout there isn\'t', (s) => { s.arena!.bout = null; }],
      ['a dragon\'s XP not whole', (s) => { s.dragons[0].xp = 1.5; }],
    ];
    const kept: string[] = [];
    try { CareSim.fromSave(through(base)); } catch (e) { fail(`arena (saves): a save mid-move threw ${e}`); }
    for (const [what, make] of broken) {
      const s = through(base) as unknown as RawSave;
      make(s);
      try { CareSim.fromSave(s as unknown as SaveV); kept.push(what); } catch { /* refused, as it must be */ }
    }
    if (kept.length) fail(`arena (saves): a bout with ${kept.join(', ')} loaded`);
    lines27.push(`saves: the bout preset (EMBER LV ${BOUT_PAIR[0].level} and BRAMBLE LV ${BOUT_PAIR[1].level} in their corners, the move menu at step 90) loaded the same; a version 9 save migrated to the same world, every dragon at 0 XP; ${broken.length} bouts this build can't run (${broken.map(([w]) => w).join(', ')}) threw`);
  }

  // (f) nobody is hurt (the Decisions' B8, amended for the Arena): no word of harm in any bout's lines (every line of (b)'s
  // and (c)'s bouts) nor anywhere in the Arena's text (arena.ts, arenaui.ts, training.ts, comments aside) -- but "NOBODY
  // IS HURT"
  {
    const HARM = /\b(HURTS?|HURTING|INJUR\w*|WOUND\w*|FAINT\w*|KNOCK\w*|KILL\w*|DEAD|DIES?|DEATH|BLOOD\w*|DAMAGE\w*|HEALTH|HP|PAIN\w*|DEFEAT\w*|BEATEN|BRUIS\w*|HARM\w*)\b/;
    const bad = logs.filter((l) => HARM.test(l.replace(/NOBODY IS HURT/g, '')));
    for (const f of ['arena.ts', 'arenaui.ts', 'training.ts']) {
      const src = fs.readFileSync(new URL(`../src/game/${f}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
      for (const [n, line] of src.split('\n').entries()) if (HARM.test(line.replace(/NOBODY IS HURT/g, ''))) bad.push(`${f}:${n + 1}: ${line.trim()}`);
    }
    if (bad.length || logs.length < 100) fail(`arena (nobody is hurt): ${bad.slice(0, 4).join(' | ') || `only ${logs.length} lines read`}`);
    lines27.push(`nobody is hurt: ${logs.length} bout lines and the Arena's text read, no word of harm`);
  }
  console.log(`  27 the Arena (${((performance.now() - t27) / 1000).toFixed(1)} s): ${lines27.join('; ')}`);
}

// ---------- 28. encounters on the road (BASE_DESIGN 11: "use special abilities from your dragons to overcome them", "fight them ... similar to the battle arena") ----------
if (ROLE === 'babies') {
  const t28 = performance.now(), lines28: string[] = [], logs28: string[] = [];
  const dayW = (seed = 1) => new CareSim(START_ROOMS, START_DRAGONS, START_KEEPERS, { seed, dayLen: 600 });
  const named = (w: CareSim, n: string) => w.dragons.find((d) => d.name === n)!;
  const kid = (w: CareSim, n: string) => w.keepers.find((k) => k.name === n)!.id;
  const test = (challenges: ChallengeId[], baddie: BaddieId | null, difficulty: Difficulty = 'hard'): Mission => ({ id: 998, region: 'oldmine', title: 'TEST', difficulty, challenges, baddie, days: 3, coin: 150, eggChance: 0, guaranteedEgg: false });
  // (a) what each ability does at each kind of stop (encounter.ts offersFor): a LV 4 water dragon (its show-off and YAWN
  // known) riding with BEA (CHARM) and a LV 1 fire with TOMAS (MEDIC), on a road of a flood (water's), the grumpy miller
  // (CHARM's), thick fog (NAVIGATOR's), a hurt animal (MEDIC's), the cold (fire's) and the Mole King (dusk and CHARM)
  {
    const w = dayW();
    named(w, 'RIPPLE').xp = xpFor(4);
    const m = test(['flood', 'miller', 'fog', 'hurt', 'cold'], 'moleking');
    const pairs = [{ dragon: named(w, 'RIPPLE').id, keeper: kid(w, 'BEA') }, { dragon: named(w, 'EMBER').id, keeper: kid(w, 'TOMAS') }];
    const t = tripOf(w, m, pairs, 1000), party = partyOf(w, t);
    const at = (j: number, i: number) => Object.fromEntries(offersFor(newEncounter(t, j), party, t.stops[j], i).map((o) => [o.ability, o.weight]));
    const want: [number, number, Record<string, number>, string][] = [
      [0, 0, { breath: CHECK_STRONG, show: CHECK_LITTLE, rest: 0 }, 'RIPPLE at the flood: STRONG, its show-off a little, REST; no PREEN, YAWN or special'],
      [0, 1, { breath: CHECK_HELP, rest: 0 }, 'EMBER at the flood: helps'],
      [1, 0, { breath: CHECK_LITTLE, show: CHECK_CHARM, rest: 0, rider: 0 }, 'RIPPLE at the miller: a breath does little, its show-off charms, BEA\'s CHARM'],
      [1, 1, { breath: CHECK_LITTLE, rest: 0 }, 'EMBER at the miller: TOMAS has no CHARM'],
      [2, 1, { breath: CHECK_HELP, rest: 0 }, 'EMBER in the fog: helps, nobody\'s NAVIGATOR'],
      [3, 1, { breath: CHECK_LITTLE, rest: 0, rider: 0 }, 'EMBER at the hurt animal: TOMAS\'s MEDIC'],
      [3, 0, { breath: CHECK_LITTLE, show: CHECK_CHARM, rest: 0 }, 'RIPPLE there: BEA can\'t bandage'],
      [4, 1, { breath: CHECK_STRONG, rest: 0 }, 'EMBER in the cold: STRONG'],
      [5, 0, { breath: 1, show: 1, preen: 0, yawn: 0, rest: 0, rider: 0 }, 'RIPPLE at the Mole King: even, PREEN and YAWN, BEA\'s CHARM'],
      [5, 1, { breath: 1, preen: 0, rest: 0 }, 'EMBER at the Mole King: even, PREEN, no special'],
    ];
    for (const [j, i, exp, what] of want) { const got = at(j, i); if (!isDeepStrictEqual(got, exp)) fail(`encounter (offers): ${what}: offered ${JSON.stringify(got)}, not ${JSON.stringify(exp)}`); }
    const t2 = tripOf(w, m, [{ dragon: named(w, 'WICK').id, keeper: kid(w, 'IRIS') }], 1000), o2 = offersFor(newEncounter(t2, 5), partyOf(w, t2), t2.stops[5], 0);
    if (o2.find((o) => o.ability === 'breath')?.weight !== STRONG || o2.some((o) => o.ability === 'rider')) fail(`encounter (offers): WICK at the Mole King is offered ${JSON.stringify(o2.map((o) => [o.ability, o.weight]))} (want its NIGHTFALL STRONG, no special for IRIS)`);
    for (const d of ['easy', 'normal', 'hard'] as const) { const e = newEncounter(tripOf(w, test(['flood'], null, d), pairs, 100), 0); if (e.mark0 !== MARK[d] || e.mark !== MARK[d] || e.kind !== 'obstacle' || e.foe) fail(`encounter: a ${d} road's obstacle has a mark of ${e.mark} from ${e.mark0}`); }
    const ef = newEncounter(t, 5);
    if (ef.kind !== 'fight' || !ef.foe || ef.foe.puff !== FOE_STATS.moleking.puff || ef.mark0 !== 0) fail(`encounter: the fight begins as ${JSON.stringify({ kind: ef.kind, foe: ef.foe })}`);
    // (each try's chance: the rolls of the die that pass its bonus against the mark -- STRONG at the flood 95 %, a
    // little at the miller 5 %; a 20 always passes, a 1 never, and the note says the chance)
    const o0 = offersFor(newEncounter(t, 0), party, t.stops[0], 0), strong = o0.find((o) => o.ability === 'breath')!, little = offersFor(newEncounter(t, 1), party, t.stops[1], 1).find((o) => o.ability === 'breath')!;
    if (strong.chance !== 0.95 || strong.chance !== chanceOf(strong.bonus, MARK.hard) || !strong.note.startsWith('95 %') || strong.what !== `ROLL + ${strong.bonus}`) fail(`encounter (offers): RIPPLE's STRONG try at the hard flood is ${JSON.stringify(strong)}`);
    if (little.chance !== 0.05 || little.bonus + SIDES - 1 >= MARK.hard || !little.note.startsWith('5 %')) fail(`encounter (offers): EMBER's little try at the hard miller is ${JSON.stringify(little)}`);
    if (!passes(SIDES, 0, 99) || passes(1, 99, 2) || !passes(11, 13, 24) || passes(11, 12, 24) || chanceOf(13, 24) !== 0.5 || chanceOf(22, 24) !== 0.95) fail('encounter (offers): the die\'s rules');
    lines28.push(`the offers at ${want.length} stop-and-pair cases as the rules say (STRONG x${CHECK_STRONG}, HELPS x${CHECK_HELP}, a little x${CHECK_LITTLE}, CHARMS x${CHECK_CHARM}; the fight's ring x${STRONG}); the mark ${MARK.easy}/${MARK.normal}/${MARK.hard}, a d${SIDES} plus the bonus against it (RIPPLE's STRONG try ${strong.note}, EMBER's little one ${little.note})`);
  }
  // (b) a stop by the rules alone (encounter.ts beginTurn, landMove, endTurn, stopLine), every roll even (an 11): a
  // STRONG dragon passes an easy flood's check on its first try with no bite; a dragon that only helps (RIPPLE in the
  // cold) falls short and is bitten, the mark easing, then passes; a lone breath that does little at a hard miller is
  // waited out after MAX_OBSTACLE_TURNS tries, bitten every turn; the rider's special clears its stop outright, once, no
  // roll; a pair out of puff sits; the bite never takes puff below 0; a fight: the special costs the baddie FOE_SPECIAL
  // of its whole and a POWER stage, its rest gives back at most FOE_REST_GAIN, and the best team wears the Mole King out
  // within MAX_FIGHT_TURNS
  {
    const w = dayW();
    const play = (t: Trip, j: number, picks?: (party: Party) => (Ability | 'sit')[]) => {
      const party = partyOf(w, t), stop = t.stops[j], enc = newEncounter(t, j);
      let out: 'cleared' | 'waited' | null = null;
      while (!out) {
        enc.picks = picks ? picks(party) : party.members.map((_, i) => coachPick(enc, party, stop, i, 0.49));
        beginTurn(enc, party, evenRoll, true);
        for (const mv of enc.moves) { if (mv.by !== FOE && party.puff[mv.by] <= 0) continue; landMove(enc, party, stop, mv, evenRoll); }
        out = endTurn(enc, party, stop);
      }
      logs28.push(...enc.log);
      return { enc, party, out, line: stopLine(enc, party, stop, out) };
    };
    const one = (name: string, rider: string, challenges: ChallengeId[], baddie: BaddieId | null, difficulty: Difficulty) => tripOf(w, test(challenges, baddie, difficulty), [{ dragon: named(w, name).id, keeper: kid(w, rider) }], 100);
    const a = play(one('RIPPLE', 'IRIS', ['flood'], null, 'easy'), 0);
    const a1 = a.enc.moves[0];
    if (a.out !== 'cleared' || a.enc.turn !== 1 || a.party.puff[0] !== a.party.members[0].stats.puff || a.line !== 'SPRING FLOOD - RIPPLE SWIMS THEM ACROSS' || a1.roll !== 11 || !a1.hit || a1.score < MARK.easy || a.enc.mark !== 0 || !a.enc.log.some((l) => l.endsWith(`= ${a1.score} BEATS ${MARK.easy}!`))) fail(`encounter (rules): RIPPLE at an easy flood: ${a.out} in ${a.enc.turn} turns, puff ${a.party.puff[0]}, "${a.line}", ${JSON.stringify(a1)}: ${a.enc.log.join(' | ')}`);
    const b = play(one('RIPPLE', 'IRIS', ['cold'], null, 'easy'), 0), b1 = b.enc.moves[0];
    if (b.out !== 'cleared' || b.enc.turn < 2 || b.party.puff[0] !== b.party.members[0].stats.puff - (b.enc.turn - 1) * BITE || b.line !== 'THE COLD - THE COLD IS SEEN OFF' || !b1.hit || b1.score < MARK.easy - (b.enc.turn - 1) * MARK_EASE || b1.score >= MARK.easy - (b.enc.turn - 2) * MARK_EASE || !b.enc.log.some((l) => l.includes(`FALLS SHORT OF ${MARK.easy}`)) || !b.enc.log.some((l) => l.endsWith(`THE MARK EASES TO ${MARK.easy - MARK_EASE}`))) fail(`encounter (rules): RIPPLE in an easy cold: ${b.out} in ${b.enc.turn} turns, puff ${b.party.puff[0]} of ${b.party.members[0].stats.puff}, "${b.line}": ${b.enc.log.join(' | ')}`);
    const c = play(one('EMBER', 'IRIS', ['miller'], null, 'hard'), 0);
    if (c.out !== 'waited' || c.enc.turn !== MAX_OBSTACLE_TURNS || c.party.puff[0] !== c.party.members[0].stats.puff - MAX_OBSTACLE_TURNS * BITE || c.line !== 'GRUMPY MILLER - THE TEAM WAITS IT OUT' || c.enc.mark !== MARK.hard - (MAX_OBSTACLE_TURNS - 1) * MARK_EASE) fail(`encounter (rules): EMBER alone at a hard miller: ${c.out} in ${c.enc.turn} turns, puff ${c.party.puff[0]}, mark ${c.enc.mark}, "${c.line}"`);
    const d = play(one('EMBER', 'BEA', ['miller'], null, 'hard'), 0);
    if (d.out !== 'cleared' || d.enc.turn !== 1 || d.enc.special[0] || d.line !== 'GRUMPY MILLER - BEA TALKS HIM ROUND' || d.enc.moves[0].roll !== 0 || d.enc.mark !== 0) fail(`encounter (rules): EMBER with BEA at a hard miller: ${d.out} in ${d.enc.turn} turns, special left ${d.enc.special[0]}, "${d.line}"`);
    // (out of puff: the pick is to sit, the move does nothing; the bite stops at 0)
    const e = one('EMBER', 'IRIS', ['flood'], null, 'hard'), ep = partyOf(w, e), ee = newEncounter(e, 0);
    ep.puff[0] = 2;
    ee.picks = [coachPick(ee, ep, e.stops[0], 0, 0.49)];
    beginTurn(ee, ep, evenRoll, true); landMove(ee, ep, e.stops[0], ee.moves[0], evenRoll);
    const bitten = endTurn(ee, ep, e.stops[0]);
    if (ep.puff[0] !== 0 || bitten !== 'waited' || coachPick(ee, ep, e.stops[0], 0, 0.49) !== 'sit') fail(`encounter (rules): at 2 puff the bite left ${ep.puff[0]}, the stop ${bitten}, the pick ${coachPick(ee, ep, e.stops[0], 0, 0.49)}`);
    ee.picks = ['sit']; beginTurn(ee, ep, evenRoll, true); landMove(ee, ep, e.stops[0], ee.moves[0], evenRoll);
    if (ee.moves[0].ability !== 'sit' || ee.moves[0].score !== 0 || ee.moves[0].roll !== 0 || ee.moves[0].hit) fail(`encounter (rules): a sit did ${JSON.stringify(ee.moves[0])}`);
    // (the fight: WICK with IRIS and RIPPLE with BEA against the Mole King)
    const f = tripOf(w, test(['dark'], 'moleking'), [{ dragon: named(w, 'RIPPLE').id, keeper: kid(w, 'BEA') }, { dragon: named(w, 'WICK').id, keeper: kid(w, 'IRIS') }], 100);
    const fp = partyOf(w, f), fe = newEncounter(f, 1), whole = fe.foe!.stats.puff;
    fe.picks = ['rider', 'breath']; beginTurn(fe, fp, evenRoll, true);
    const special = fe.moves.find((mv) => mv.ability === 'rider')!;
    for (const mv of fe.moves) landMove(fe, fp, f.stops[1], mv, evenRoll);
    if (special.loss !== Math.round(FOE_SPECIAL * whole) || fe.foe!.power !== -1 || fe.special[0] || !fe.log.some((l) => l.startsWith('BEA CHARMS THE MOLE KING'))) fail(`encounter (rules): BEA's CHARM on the Mole King cost ${special.loss} of ${whole}, its power ${fe.foe!.power}: ${fe.log.join(' | ')}`);
    let out: 'cleared' | 'waited' | null = endTurn(fe, fp, f.stops[1]), rests = 0;
    while (!out) {
      fe.picks = fp.members.map((_, i) => coachPick(fe, fp, f.stops[1], i, 0.49));
      beginTurn(fe, fp, evenRoll, true);
      for (const mv of fe.moves) { if (mv.by !== FOE && fp.puff[mv.by] <= 0) continue; landMove(fe, fp, f.stops[1], mv, evenRoll); if (mv.by === FOE && mv.foeMove === 'rest') { rests++; if (mv.gain > 10) fail(`encounter (rules): the Mole King's rest gave back ${mv.gain}`); } }
      out = endTurn(fe, fp, f.stops[1]);
    }
    logs28.push(...fe.log);
    if (out !== 'cleared' || fe.turn > MAX_FIGHT_TURNS || fe.foe!.puff !== 0 || stopLine(fe, fp, f.stops[1], out) !== 'THE MOLE KING - WORN OUT: IT CURLS UP AND DOZES') fail(`encounter (rules): the best team's fight: ${out} in ${fe.turn} turns, the Mole King at ${fe.foe!.puff}: "${stopLine(fe, fp, f.stops[1], out)}"`);
    lines28.push(`by the rules: RIPPLE passes an easy flood's check on try ${a.enc.turn} (${a1.roll} + ${a1.score - a1.roll} = ${a1.score} against ${MARK.easy}), and the cold's on try ${b.enc.turn} (bitten ${(b.enc.turn - 1) * BITE}, the mark eased to ${MARK.easy - (b.enc.turn - 1) * MARK_EASE}), EMBER alone waits a hard miller out after ${c.enc.turn} tries, BEA's CHARM clears it in ${d.enc.turn} with no roll; a dragon at 2 puff is bitten to 0 and sits; BEA's CHARM costs the Mole King ${special.loss} of ${whole} and a POWER stage, and the best team wears it out in ${fe.turn} turns (${rests} rests)`);
  }
  // (c) the balance in the world, the trail coach playing (AUTO): each baddie's best two pairs (the trip preset's,
  // both counters) put at its stop on seeds 1-3 wear it out every time within 10 turns; a lone pair with neither
  // counter sits its fight out every time; and THE LOST NEST's two counters clear both stops on seeds 1-10
  {
    let wins = 0, fights = 0, turns = 0, lost = 0, lone = 0, nests = 0;
    const foeOf = (region: RegionId) => REGIONS.find((r) => r.id === region)!.baddie!;
    const lonePairs: Record<string, [string, string]> = { oldmine: ['RIPPLE', 'IRIS'], highfold: ['COBBLE', 'BEA'], frostmere: ['RIPPLE', 'TOMAS'] };
    for (const region of ['oldmine', 'highfold', 'frostmere'] as RegionId[]) {
      for (let seed = 1; seed <= 3; seed++) {
        const w = buildSim(tripStart(`${region}:0.9`), seed), t = w.missions.trip!;
        t.auto = true;
        for (let s = 0; s < 20000 && t.stops[3].result === 'ahead'; s++) w.step();
        fights++; turns += t.stops[3].turns;
        if (t.stops[3].result === 'met') wins++; else fail(`encounter (balance): ${region}'s best team (${t.pairs.map((p) => w.dragons[p.dragon].name).join(', ')}) sat the ${foeOf(region)} out on seed ${seed} after ${t.stops[3].turns} turns`);
        if (t.stops[3].turns > 10) fail(`encounter (balance): ${region}'s best team took ${t.stops[3].turns} turns on seed ${seed}`);
        logs28.push(...t.stops.map((s) => s.log));
        noteUse(w);
        const v = dayW(seed), dm = demoTrip(v, region, 'hard'), [dn, kn] = lonePairs[region];
        const lt = tripOf(v, dm.mission, [{ dragon: named(v, dn).id, keeper: kid(v, kn) }], 1000);
        lt.auto = true;
        awayNow(v, lt, v.clock);
        placeAlong(v, lt, 0.9);
        for (let s = 0; s < 20000 && lt.stops[3].result === 'ahead'; s++) v.step();
        lone++;
        if (lt.stops[3].result === 'unmet') lost++; else fail(`encounter (balance): ${dn} alone wore the ${foeOf(region)} out on seed ${seed} in ${lt.stops[3].turns} turns`);
        noteUse(v);
      }
    }
    for (let seed = 1; seed <= 10; seed++) {
      const w = dayW(seed), m = w.missions.board[0], rip = named(w, 'RIPPLE'), echo = named(w, 'ECHO');
      const pairs = [{ dragon: rip.id, keeper: autoRider(w, rip, m, [])! }]; pairs.push({ dragon: echo.id, keeper: autoRider(w, echo, m, pairs)! });
      const t = tripOf(w, m, pairs, 60);
      t.auto = true;
      awayNow(w, t, w.clock);
      for (let s = 0; s < 20000 && w.missions.trip && w.missions.trip.state === 'away'; s++) w.step();
      if (t.success !== true || t.stops.some((s) => s.result !== 'met' || s.turns > 2)) fail(`encounter (balance): THE LOST NEST with RIPPLE and ECHO on seed ${seed}: ${JSON.stringify(t.stops.map((s) => [s.result, s.turns]))}`);
      else nests++;
      noteUse(w);
    }
    lines28.push(`balance: the best two pairs wore their baddie out ${wins} of ${fights} times (${(turns / fights).toFixed(1)} turns on average), a lone pair with neither counter sat it out ${lost} of ${lone}; THE LOST NEST's two counters cleared both stops in a turn or two each on ${nests} of 10 seeds`);
  }
  // (d) a whole road in the world by commands (seed 2's LOST NEST, RIPPLE and ECHO, away at once with a 600-step walk):
  // the team halts at the first stop as it reaches it; nobody picks, so the picks wait PICK_WAIT_TRAIL and the coach's
  // turn plays -- each move its dragon's own anim, landing at its impact with its roll of the die against the mark (a
  // pass takes the mark to 0 and ends the turn; a short one leaves it); at the second stop a pick
  // for a pair there isn't, an ability the pair hasn't and the special nobody has are refused, RIPPLE's breath is taken
  // by command, and AUTO fills ECHO's pick at once (the quicker moving first); the stop cleared, XP for both (a level
  // and its skill), the walk on and the landing; the same script twice gives the same world; saves taken at the meet, at
  // the pick, mid-move and at the resolution step on to the same world
  const roadRun = (forks: boolean) => {
    const w = dayW(2), m = w.missions.board[0], rip = named(w, 'RIPPLE'), echo = named(w, 'ECHO');
    const pairs = [{ dragon: rip.id, keeper: autoRider(w, rip, m, [])! }]; pairs.push({ dragon: echo.id, keeper: autoRider(w, echo, m, pairs)! });
    const t = tripOf(w, m, pairs, 600);
    awayNow(w, t, w.clock);
    const live: { sim: CareSim; left: number; what: string; since: Uses }[] = [], saved: string[] = [], seen = new Set<string>();
    const cmd = (c: Command) => { w.command(c); for (const f of live) f.sim.command(c); };
    const fork = (what: string) => {
      if (!forks || seen.has(what)) return;
      seen.add(what);
      const sim = CareSim.fromSave(through(serialize(w)));
      if (!isDeepStrictEqual(sim.missions.trip, w.missions.trip)) fail(`encounter (saves): a save taken ${what} loaded another trip`);
      live.push({ sim, left: 600, what, since: uses(sim) }); saved.push(`${what} (step ${w.tick})`);
    };
    const out = { w, waited: -1, moves: 0, events: [] as string[], saved, order: '' };
    const step = () => {
      w.step();
      for (let i = live.length - 1; i >= 0; i--) {
        const f = live[i];
        f.sim.step();
        if (--f.left > 0) continue;
        if (f.sim.digest() !== w.digest()) fail(`encounter (saves): a save taken ${f.what} stepped on to another world by step ${w.tick}`);
        noteUse(f.sim, f.since); live.splice(i, 1);
      }
      for (const e of w.events) if (e.kind === 'meet' || e.kind === 'stopEnd' || e.kind === 'level' || e.kind === 'learn') out.events.push(JSON.stringify(e));
    };
    // 1. the first stop: met at its start, the picks waited out, the coach's turn
    for (let s = 0; s < 5000 && !t.encounter; s++) step();
    if (!t.encounter || t.encounter.stop !== 0 || t.encounter.state !== 'meet' || t.walked !== stopStart(t, 0)) { fail(`encounter (road): the first stop was met as ${JSON.stringify(t.encounter && { stop: t.encounter.stop, state: t.encounter.state })} at walked ${t.walked}`); return out; }
    fork('at the meet');
    while (t.encounter?.state === 'meet') step();
    if (t.encounter?.state !== 'pick' || t.encounter.t !== 0) fail(`encounter (road): after the meet the encounter is ${t.encounter?.state} ${t.encounter?.t}`);
    fork('at the pick');
    const p0 = w.tick;
    while (t.encounter?.state === 'pick') step();
    out.waited = w.tick - p0;
    if (out.waited !== PICK_WAIT_TRAIL) fail(`encounter (road): the first stop's picks waited ${out.waited} steps (want PICK_WAIT_TRAIL, ${PICK_WAIT_TRAIL})`);
    // (the turn's moves: each its dragon's anim, landing at its impact for exactly its work)
    const party = partyOf(w, t);
    while (t.encounter?.state === 'play') {
      const enc: Encounter = t.encounter, mv = enc.moves[enc.cur], me = party.members[mv.by], sk = skillOf(me.el, mv.ability as SkillKind), mark0 = enc.mark;
      if (mv.len !== animLen(me.el, me.stage, sk.anim) || mv.at !== Math.max(1, Math.round(mv.len * sk.impact))) fail(`encounter (road): ${me.name}'s ${sk.name} lasts ${mv.len} and lands at ${mv.at}`);
      step();
      if (t.encounter === enc && mv.landed && mv.t === mv.at) { out.moves++; if (mv.roll < 1 || mv.roll > SIDES || mv.score <= mv.roll || mv.hit !== passes(mv.roll, mv.score - mv.roll, mark0) || enc.mark !== (mv.hit ? 0 : mark0) || (mv.hit && enc.moves.length !== mv.n + 1)) fail(`encounter (road): ${me.name}'s ${sk.name} landed as ${JSON.stringify(mv)} against ${mark0}, the mark now ${enc.mark}`); if (!seen.has('mid-move')) fork('mid-move'); }
    }
    if (t.encounter?.state !== 'done' || t.stops[0].result !== 'met') fail(`encounter (road): the first stop ended ${t.encounter?.state}, ${t.stops[0].result}`);
    logs28.push(...(t.encounter?.log ?? []));
    fork('at the resolution');
    // 2. the second stop: refusals, a pick by command, AUTO
    for (let s = 0; s < 5000 && !(t.encounter && (t.encounter.stop as number) === 1 && t.encounter.state === 'pick'); s++) step();
    // (the encounter read afresh after each step: the world moves it on)
    const cur = (): Encounter => t.encounter!;
    if (!t.encounter || cur().stop !== 1 || cur().state !== 'pick') { fail(`encounter (road): the second stop is ${JSON.stringify(t.encounter && { stop: cur().stop, state: cur().state })}`); return out; }
    for (const [c, what] of [[{ kind: 'ability', pair: 5, ability: 'breath' }, 'a pair there isn\'t'], [{ kind: 'ability', pair: 0, ability: 'yawn' }, 'an ability the pair hasn\'t here'], [{ kind: 'ability', pair: 0, ability: 'rider' }, 'a special nobody has here']] as [Command, string][]) {
      cmd(c); step();
      if (cur().picks.some((p) => p != null) || cur().state !== 'pick') fail(`encounter (road): ${what} was taken: ${JSON.stringify(cur().picks)}`);
    }
    cmd({ kind: 'ability', pair: 0, ability: 'breath' }); step();
    // (a pick taken restarts the wait for the next: t back to 0, then the step)
    if (cur().picks[0] !== 'breath' || cur().picks[1] !== null || cur().state !== 'pick' || cur().t !== 1) fail(`encounter (road): RIPPLE's breath by command left the picks ${JSON.stringify(cur().picks)} at ${cur().state} ${cur().t}`);
    cmd({ kind: 'trail', on: true }); step();
    const turn = cur();
    if (!t.auto || turn.state !== 'play' || turn.moves.length !== 2 || turn.moves[0].by !== 1 || turn.moves[1].by !== 0 || turn.moves.some((mv) => mv.ability !== 'breath')) fail(`encounter (road): AUTO left the turn ${JSON.stringify({ auto: t.auto, state: turn.state, moves: turn.moves.map((mv) => [mv.by, mv.ability]) })} (want ECHO's breath first, the quicker, then RIPPLE's)`);
    out.order = turn.moves.map((mv) => party.members[mv.by].name).join(' then ');
    cmd({ kind: 'trail', on: false }); step();
    if (t.auto) fail('encounter (road): AUTO off was not taken');
    const xp0 = [rip.xp, echo.xp];
    for (let s = 0; s < 5000 && t.encounter?.state !== 'done'; s++) step();
    if (t.stops[1].result !== 'met' || rip.xp !== xp0[0] + XP_ROAD.cleared || echo.xp !== xp0[1] + XP_ROAD.cleared) fail(`encounter (road): the second stop ended ${t.stops[1].result}, XP ${rip.xp} and ${echo.xp} (from ${xp0.join(', ')})`);
    logs28.push(...(t.encounter?.log ?? []));
    // 3. the walk on, the landing, the forks run out
    for (let s = 0; s < 20000 && w.missions.trip; s++) step();
    for (let s = 0; s < 700 && live.length; s++) step();
    if (w.missions.trip || t.success !== true || live.length) fail(`encounter (road): the trip ended ${t.state} success ${t.success}, ${live.length} saves never compared`);
    noteUse(w);
    return out;
  };
  const r1 = roadRun(true), r2 = roadRun(false);
  if (r1.w.tick !== r2.w.tick || r1.w.digest() !== r2.w.digest()) fail(`encounter (road): the same road twice gave two worlds (steps ${r1.w.tick} and ${r2.w.tick})`);
  const levels = r1.events.filter((e) => e.includes('"level"')).length, learns = r1.events.filter((e) => e.includes('"learn"')).length;
  if (levels !== 2 || learns !== 2) fail(`encounter (road): the road brought ${levels} levels and ${learns} skills (want RIPPLE and ECHO each LV 2 with YAWN): ${r1.events.join(' ')}`);
  lines28.push(`a road by commands (seed 2, THE LOST NEST): the first stop's picks waited ${r1.waited} steps for the player, ${r1.moves} moves landed at their impacts; the second stop's refusals, RIPPLE's breath by command and AUTO (${r1.order}); ${levels} levels and ${learns} skills (${r1.events.filter((e) => e.includes('stopEnd')).length} stops ended); the same twice; saves ${r1.saved.join(', ')} stepped on 600 to the same world`);
  // (e) encounters this build can't run (encounter.ts checkEncounter, through the save): each throws
  {
    const w = buildSim(tripStart('oldmine:0.9'), 1);
    w.missions.trip!.auto = true;
    for (let s = 0; s < 2000 && w.missions.trip?.encounter?.state !== 'play'; s++) w.step();
    const base = serialize(w);
    type Raw = { missions: { trip: { encounter: Record<string, any>; stops: Record<string, any>[]; puff: number[]; stats: { puff: number }[] } } };
    const enc = (s: Raw) => s.missions.trip.encounter;
    const broken: [string, (s: Raw) => void][] = [
      ['a state it doesn\'t know', (s) => { enc(s).state = 'brawl'; }],
      ['a stop off the road', (s) => { enc(s).stop = 9; }],
      ['a pick short', (s) => { enc(s).picks = [null]; }],
      ['a mark over its start', (s) => { enc(s).mark = enc(s).mark0 + 1; }],
      ['a roll past the die', (s) => { enc(s).moves[0].roll = SIDES + 1; }],
      ['a baddie over its whole puff', (s) => { enc(s).foe.puff = enc(s).foe.stats.puff + 1; }],
      ['no baddie at a fight', (s) => { enc(s).foe = null; }],
      ['a move by a pair there isn\'t', (s) => { enc(s).moves[0].by = 5; }],
      ['a move of an ability it doesn\'t know', (s) => { enc(s).moves[0].ability = 'fireball'; enc(s).moves[0].foeMove = null; }],
      ['an outcome it doesn\'t know', (s) => { enc(s).outcome = 'won'; }],
      ['a stop resolved while it plays', (s) => { s.missions.trip.stops[3].result = 'met'; s.missions.trip.stops[3].resolvedAt = 0; }],
      ['a stage past +2', (s) => { enc(s).guard = [3, 0]; }],
      ['more puff than its whole', (s) => { s.missions.trip.puff[0] = s.missions.trip.stats[0].puff + 1; }],
    ];
    let threw = 0;
    for (const [what, f] of broken) {
      const b = through(base) as unknown as Raw; f(b);
      try { CareSim.fromSave(b as unknown as SaveV); fail(`encounter (saves): one with ${what} loaded`); } catch { threw++; }
    }
    lines28.push(`${threw} encounters this build can't run (${broken.map(([q]) => q).join(', ')}) threw`);
  }
  // (f) nobody is hurt (the Decisions' B8): no word of harm in any encounter's lines (every line of (b), (c) and (d)) nor in
  // encounter.ts's and encounterui.ts's own text (the strings in the code, its comments aside)
  {
    const HARM = /\b(HURTS?|HURTING|INJUR\w*|WOUND\w*|FAINT\w*|KNOCK\w*|KILL\w*|DEAD|DIES?|DEATH|BLOOD\w*|DAMAGE\w*|HEALTH|HP|PAIN\w*|DEFEAT\w*|BEATEN|BRUIS\w*|HARM\w*)\b/;
    // ("NOBODY IS HURT" is the rule's own words; the HURT ANIMAL is a stop's name, an animal in need of the MEDIC's bandage)
    const bad = logs28.filter((l) => HARM.test(l.replace(/NOBODY IS HURT|HURT ANIMAL/g, '')));
    for (const f of ['encounter.ts', 'encounterui.ts']) {
      const src = fs.readFileSync(new URL(`../src/game/${f}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
      for (const [n, line] of src.split('\n').entries()) if (HARM.test(line.replace(/NOBODY IS HURT|HURT ANIMAL/g, ''))) bad.push(`${f}:${n + 1}: ${line.trim()}`);
    }
    if (bad.length) fail(`encounter: a word of harm: ${bad.slice(0, 5).join(' | ')}`);
    lines28.push(`nobody is hurt: ${logs28.length} encounter lines and the road's text read, no word of harm`);
  }
  console.log(`  28 encounters (${((performance.now() - t28) / 1000).toFixed(1)} s): ${lines28.join('; ')}`);
}

// ---------- 10 with 23, 2 with 24, 6 with 25 and 27 (the workers' results) ----------
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
  const wallS = (performance.now() - T0) / 1000;
  console.log(`  wall: the main thread's sections ${(mainMs / 1000).toFixed(1)} s, the workers' ${took.join(', ')}; the suite ${wallS.toFixed(1)} s (the budget: ${BUDGET_S} s on ${CPUS} CPUs)`);
  // The budget fails the suite -- unless the machine was busy with other work, which slows every thread here alike: the
  // CPU time the whole machine spent over the suite's wall time (/proc/stat) less this process's own (every thread's:
  // process.cpuUsage), per second of wall time, is the other work's CPUs; half a CPU or more of it excuses the suite.
  const busy1 = machineBusyS(), ownU = process.cpuUsage(CPU0), ownS = (ownU.user + ownU.system) / 1e6;
  const others = BUSY0 == null || busy1 == null ? null : Math.max(0, busy1 - BUSY0 - ownS) / wallS;
  const beside = others == null ? 'no /proc/stat to read' : `the other work beside it ${others.toFixed(2)} CPUs on average, the suite's own ${(ownS / wallS).toFixed(2)}`;
  if (wallS > BUDGET_S && (others == null || others < BUSY_CPUS)) fail(`wall: the suite took ${wallS.toFixed(1)} s, over its ${BUDGET_S} s budget (${beside})`);
  else if (wallS > BUDGET_S) console.log(`  wall: over the ${BUDGET_S} s budget, not failed: the machine was busy with other work (${beside})`);
  else console.log(`  wall: within the budget (${beside})`);
}

// ---------- 8 (the whole suite). every named room used (#11) ----------
if (MAIN) {
  // every named room in the start, the lift and the Aerie: used somewhere in this suite (#11: a room is named and
  // furnished only for a real purpose)
  const named = [...new Set([...START_ROOMS.map((r) => r.kind as string), ...Object.keys(STRUCTURES)])];
  for (const k of named) if (!(USED[k] ?? 0)) fail(`rooms: the ${k} is named and furnished but nothing used it (#11)`);
  // and every room itself (a need's rooms repeat, and each copy must earn its name): every room of the start used at
  // least once (stats.usedRoom: a need met in its slot, a supply taken at its post, an egg laid or hatched in it, a
  // pass through it)
  const rooms = placeRooms(START_ROOMS), unused = rooms.filter((r) => !USED_ROOM[r.id]);
  if (unused.length) fail(`rooms: ${unused.map((r) => `room ${r.id} (the ${r.kind} on floor ${r.floor})`).join(', ')} named and furnished but never used (#11)`);
  console.log(`  8 rooms used over the suite: ${named.map((k) => `${k} ${USED[k] ?? 0}`).join(', ')}; room by room: ${rooms.map((r) => `${r.id} ${r.kind}${r.part === 'barn' ? ` f${r.floor}` : ''} ${USED_ROOM[r.id]}`).join(', ')}`);
}

if (MAIN) {
  if (fails.length) { console.log('SIM: FAIL\n' + fails.map((f) => '  ' + f).join('\n')); process.exit(1); }
  console.log('SIM: the barn runs: every check passed');
}

// (a worker: its sections done, what they found goes back to the main thread)
if (!MAIN) parentPort!.postMessage({ fails, used: USED, usedRoom: USED_ROOM, lines: LOG, ms: performance.now() - T0 } satisfies WorkerResult);
