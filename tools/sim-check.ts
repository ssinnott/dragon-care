// Headless check of the base's care simulation (src/game/sim.ts; docs/BASE_DESIGN.md 4). No browser: the simulation
// is plain data and functions, so Node runs it directly.
//
//   node tools/sim-check.ts        (npm run sim; part of npm run check)
//
// 1. Routes on both nets: every keeper, from their station, reaches every slot's stand spot (for every stage that fits
//    the slot), every supply post, the riders' rooms and the Aerie deck, and back (the ladders, the doors); every stage's
//    dragon net joins every slot that fits it to every other and to the deck, both ways, by the Dragon Lift (each ride
//    one leg) and never through a tower (every dragon span inside the barn or on the deck); every stand spot is inside
//    its room.
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
//    boarding, mid-ride and alighting (and one at the first ride of all); and on a short day, with eggs incubating (plan
//    S5), a baby walking to the module slot it will grow up in, an egg just hatched and a dragon just grown up; a save
//    survives JSON unchanged, every field is in it; another version throws.
// 7. rngAt: the same keys give the same draws, different tags different ones, and the draws are even.
// 8. Rooms (#11): every room kind and structure has a purpose, each need is met in exactly one kind of room, the plates
//    name only rooms and structures there are (none on a bare slot), placing rooms and dragons keeps the building's
//    rules (no room on the lift; a slot per dragon, fitting its stage), a keeper waits clear of every slot's body; and
//    (checked at the end, over the whole suite) every named room, the lift and the Aerie were used (sim.stats.used),
//    unless their mechanic is still PLANNED -- and a PLANNED one that shows a use fails, so its entry must go.
// 9. Gait (#7: dragons walk by their anims' own root motion): every walk's table is the same whatever the seed, it
//    moves as its anim table's frames and an anim player playing it say (a walk with an intro too, wrapping and caught
//    up as the view does), and a dragon walked by the simulation moves exactly as far as the anim player playing its
//    walk would carry it; the paper turn is the yard's.
// 10. Capacity (measured, for the slices that grow the barn): eight adults, ten, and the ages preset's twelve, printed
//    with the ceiling they show; no keeper gives up, the car never stalls, and its throughput holds.
// 11. The clock (docs/BASE_DESIGN.md 7) on a real day and a 600-step test day: the day, the hour and the phase at each
//    phase's start, the sky's three stepped thirds over a phase's first hour, day 2 at midnight, a whole day read step
//    by step (the phases in order, the turn never going back; the lights and the HUD's sun or moon in step with the
//    sky, never switching on a phase's first step), the label (and the top bar's room for it to day 99 999), and a
//    world's start hour.
// 12. Night is not the barn's (plan G8): a world started at 07:00 and one started at 19:00, the same seed, are the same
//    barn (save.ts barnKey: every absolute clock left out) every 1000 steps for 20000 -- so view=base's no-tint check,
//    day against night, compares one world -- and no simulation module reads the day's phase.
// 13. Growing up (#8: "a 'month' of game time to have a dragon grow from one age class to another"; plan S5): on a
//    600-step day, a baby grows young, adult and elder, one grow event each, its stage's start moved on exactly 30 days
//    each time, after walking from the Hatchery to a module slot, and its drains follow the new stage; a stage-up only
//    ever applies to a dragon settled in a slot it fits (no act, no keeper on it); the delay from falling due is short
//    alone and bounded by an errand in the busy barn; and at the real day's length, 30 days less a minute in, an adult
//    is an elder within a minute of play.
// 14. Eggs (#5.4's Hatchery side): three eggs fill the three nests and a fourth is not taken; an egg hatches exactly two
//    days after it was laid into a baby with a new id, its element's first free name and the egg's seed, the Hatchery's
//    sub-slots first; the baby asks for food at once and is fed within three minutes; with every baby sub-slot taken an
//    egg waits in its nest, nothing lost, and hatches as soon as one frees; names never repeat and stay within 8
//    characters; two runs give the same names and seeds.
import { isDeepStrictEqual } from 'node:util';
import fs from 'node:fs';
import { CareSim, REACH, DAY_STEPS, START_HOUR } from '../src/game/sim.ts';
import { nextStage, stageDue, HATCH_FOOD } from '../src/game/life.ts';
import { NAMES, NAME_MAX, hatchName } from '../src/game/names.ts';
import { GROWUP_IN, HATCH_IN, EGGS_PRESET } from '../src/game/presets.ts';
import type { DragonPlace } from '../src/game/start.ts';
import type { Keeper, Dragon } from '../src/game/sim.ts';
import {
  NEED_ROOM, TURN_STEPS, TURN_HALF, WAIT_MAX, LEAD_PX, arrived, inTheBay, liftRange, needRoom, dragonSpan, dragonInBay, depthOf, eyeSpan, walking,
  landingEdge, ridesLeft, remainingCost, nearestFree,
} from '../src/game/travel.ts';
import { gaitOf, gaitFrom, moveAt, wrapT } from '../src/game/gait.ts';
import { TURN_HALF as YARD_TURN_HALF } from '../src/care/dragon.ts';
import { dragonBuild } from '../src/art/dragon/build.ts';
import { dragonAnims, baseAnims } from '../src/art/dragon/anims.ts';
import { animTuning } from '../src/art/dragon/tuning.ts';
import { DragonAnimPlayer } from '../src/art/dragon/anim.ts';
import { START_ROOMS, START_DRAGONS, START_KEEPERS } from '../src/game/start.ts';
import { startSpec, buildSim, PRESETS } from '../src/game/presets.ts';
import { serialize, barnKey, SaveVersionError, SAVE_VERSION } from '../src/game/save.ts';
import { readClock, clockLabel, hourSteps, PHASE_ORDER, STAGE_DAYS, HATCH_DAYS } from '../src/game/clock.ts';
import type { ClockRead } from '../src/game/clock.ts';
import { skyBands, BACKDROPS } from '../src/game/surfaces.ts';
import { lightsOf, nightness } from '../src/game/sky.ts';
import { jobsAt, CLOCK_X, BADGE_X0 } from '../src/game/hud.ts';
import { measureText } from '../src/lib/engine/text.ts';
import { rngAt, mix32, TAG } from '../src/game/rand.ts';
import {
  route, spanOf, postX, placeRooms, platesOf, standSpot, fitsSlot, slotBody, dragonNet, feetY, floorTop, nestX, KEEPER_NET, ROOM_INFO, ROOM_KINDS, STRUCTURES,
  AERIE_F, BARN_X, TOWER_R, TOWER_L, TOWER_W, DECK_X0, DECK_X1, LIFT_X0, LIFT_X1, LIFT_CX, LIFT_STOPS, CLIMB_COST, WALL_H, DRAGON_PAD,
} from '../src/game/layout.ts';
import type { Spot, RoomKind } from '../src/game/layout.ts';
import { NEEDS, FPS, OWN_NEED, hasNeed, drainRate } from '../src/game/needs.ts';
import type { Needs } from '../src/game/needs.ts';
import { DRAGON_ELEMENTS } from '../src/art/dragon/palettes.ts';
import type { DragonElement } from '../src/art/dragon/palettes.ts';
import type { Stage } from '../src/art/dragon/stages.ts';
import { STAGES } from '../src/art/dragon/stages.ts';

const fails: string[] = [];
const fail = (m: string) => { if (fails.length < 40) fails.push(m); };
const newSim = (seed = 1) => new CareSim(START_ROOMS, START_DRAGONS, START_KEEPERS, { seed });
/**
 * Every use of a room or structure (stats.used) over the whole suite: each section notes the worlds it ran (8 checks
 * it). A world loaded from a save is noted with the uses it was loaded with (`since`), so only its own are counted.
 */
const USED: Record<string, number> = {};
const noteUse = (w: CareSim, since: Readonly<Record<string, number>> = {}) => {
  for (const [k, v] of Object.entries(w.stats.used)) if (v - (since[k] ?? 0)) USED[k] = (USED[k] ?? 0) + v - (since[k] ?? 0);
};
/**
 * The service 30 minutes of play must give (section 2, seeds 1-3, and section 4's Rush after Rush, seed 1), measured
 * and frozen with about 20 % headroom (docs/BASE_DESIGN.md 4.7, 4.9, 8.1). The gates a dragon feels most keep the
 * plan's values on every seed: no need ever empties, done >= 120, a keeper's wait at the stand spot <= 20 s, bay waits
 * <= 60 s, a walking dragon never stands still 10 s. The waits for the car do not: plan S3 started from a 60 s average
 * wait, a 180 s longest and 60 s at a landing, but with the dragons walking at their anims' own pace, one car between
 * the floors and one dragon at a time in its shaft (plan 7's mustFix), the car is busy about 95 % of the run and a
 * job's wait is mostly its dragon's wait for it (4.7). Seeds 1-3 measure 87.6 / 74.6 / 88.3 s on average (mean 83.5;
 * 61-106 s over seeds 1-48, mean 76.4), 301.2 s at most, 103.4 s at a landing and a rider held in the car 20.5 s while
 * the bay clears; one seed's numbers move by a fifth either way with any change to who goes when, so the average is
 * gated over the three. An eye under the body of a dragon standing over it (the sim's model: DRAGON_BODY and
 * DRAGON_EYE, the worst of every element) is left only at a landing crowded past its room -- the ground and upper
 * floors' west landing, back to back with the second slot of the kitchen and the romp room: 4.2 s in all over the
 * three runs, 2.5 s at most; over seeds 1-24 about 4.6 s a run, 14.2 s at most (it was 26.4 s and 80.1 s), so the
 * gate allows for that spread, and the old behaviour (40.6 s over these three runs) fails it. Rush after Rush (one
 * every 30 s): no need empty on seed 1, a rushed job done within 124.6 s, keepers standing for rushed dragons 9.3 % of
 * their time -- and a need may touch empty for a moment on other seeds, hence a small bound.
 */
const SERVICE_SEEDS = [1, 2, 3] as const;
const GATE = { done: 120, waitAvgS: 100, waitMaxS: 360, keeperWaitAvgS: 20, liftWaitS: 124, rideHeldS: 25, bayS: 60, keeperBayS: 30, walkStallS: 10,
  coverS: 10, coverTotalS: 30, rushedS: 150, rushWaitShare: 0.15, rushEmptySteps: 600 } as const;
/**
 * Section 10, measured on seed 1 (4.7): the car's rides with 8 adults in 30 minutes, 10 in 10, the ages preset in 6;
 * and the service 8 adults get (113.4 s average, 281.7 s at most, no need empty; over seeds 1-8 a need touches empty
 * on one), frozen with about 20 % headroom -- the barn's ceiling as built.
 */
const CAPACITY_RIDES = [123, 30, 20] as const, CAPACITY8 = { waitAvgS: 136, waitMaxS: 338 } as const;
/**
 * The rooms and structures whose mechanic a later slice builds (plan 3.9): they must show no use yet, and each entry
 * goes when its mechanic lands (S8 the tack room, the bunks, the map room, the Aerie). The lift's landed in S3 (dragons
 * ride it), the hatchery's in S5 (eggs are laid and hatch in it).
 */
const PLANNED: ReadonlySet<string> = new Set(['tack', 'bunks', 'maproom', 'aerie']);
/**
 * Section 13 (plan S5): a stage-up waits until its dragon is settled, so its delay is the rest of whatever the dragon
 * was doing when it fell due. Alone, a baby grows within GROW_ALONE of falling due (the plan's minute; measured 233 to
 * 2920 steps over seeds 1-8). In the busy barn a dragon is on an errand nearly all the time -- walking to a need's
 * room, waiting for the one car, being met (S3's saturated lift, docs/BASE_DESIGN.md 4.7) -- so the plan's minute is
 * out of reach there: a stage-up waits out one errand, measured 4062 to 8874 steps at most (68 to 148 s) over seeds
 * 1-8 in section 13's busy run (seed 1: 7438), gated at GROW_BUSY (a real game day, 3 minutes: a thirtieth of a
 * stage). At the real day's length, 30 days less a minute in, an adult (EMBER, seed 1: 2939 steps) is an elder within
 * 180 + GROW_REAL steps (the plan's).
 */
const GROW_ALONE = 3600, GROW_BUSY = 10800, GROW_REAL = 3600;

// ---------- 1. routes on both nets ----------
{
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
  for (const k of sim.keepers) for (const t of targets) {
    if (!route({ f: k.f, x: k.x }, t.at, KEEPER_NET)) fail(`no route from ${k.name}'s station to ${t.what} (${at(t.at)})`);
    if (!route(t.at, { f: k.f, x: k.x }, KEEPER_NET)) fail(`no route from ${t.what} (${at(t.at)}) back to ${k.name}'s station`);
  }
  // the dragons: per stage, every slot that fits to every other and to two deck spots, both ways, on its own net; every
  // leg in the barn (x 168..1192 on floors 0-2) or on the deck (x 8..648 on floor 5), a floor changed only by the lift,
  // and each ride one leg (boarding stop to alighting stop: never two floor changes in a row)
  let dragonRoutes = 0, liftRides = 0;
  for (const st of STAGES) {
    const net = dragonNet(st);
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
  const up = route({ f: 2, x: 792 }, { f: AERIE_F, x: 280 }, dragonNet('adult'));
  const upCost = (792 - LIFT_CX) + (feetY(2) - feetY(AERIE_F)) * CLIMB_COST + (LIFT_CX - 280);
  if (!up || up.legs.map(at).join(' / ') !== `f2 x ${LIFT_CX} / f5 x ${LIFT_CX} / f5 x 280` || Math.abs(up.cost - upCost) > 1e-9) fail(`the lift from the hayloft to the Aerie: ${up ? `${up.legs.map(at).join(' / ')} costing ${up.cost}` : 'no route'}, not one ride costing ${upCost}`);
  // a ride from the ground floor to the Aerie is one leg too (floors 1, 2, 3 and 4 passed through)
  const trip = route({ f: 0, x: 792 }, { f: AERIE_F, x: 280 }, dragonNet('adult'));
  if (!trip || trip.legs.map(at).join(' / ') !== `f0 x ${LIFT_CX} / f5 x ${LIFT_CX} / f5 x 280`) fail(`the lift from the ground floor to the Aerie: ${trip ? trip.legs.map(at).join(' / ') : 'no route'}, not one ride`);
  // no dragon net reaches a tower: every span of every stage's net lies inside the barn (floors 0-2) or on the deck
  // (floor 5), floors 3 and 4 have none, and no route reaches a tower room on the floors where the towers open into
  // the barn; and no keeper rides the lift
  for (const st of STAGES) {
    const net = dragonNet(st);
    net.spans.forEach((sp, f) => {
      const [lo, hi] = f <= 2 ? [BARN_X, TOWER_R] : f === AERIE_F ? [DECK_X0, DECK_X1] : [Infinity, -Infinity];
      for (const [a, b] of sp) if (a < lo || b > hi) fail(`${st}: the dragon net's floor ${f} runs ${a}..${b}, outside ${f <= 2 ? 'the barn' : f === AERIE_F ? 'the deck' : 'any floor a dragon has'}`);
    });
    for (const t of [{ f: 0, x: TOWER_L + TOWER_W / 2 }, { f: 1, x: TOWER_L + TOWER_W / 2 }, { f: 0, x: TOWER_R + TOWER_W / 2 }, { f: 1, x: TOWER_R + TOWER_W / 2 }, { f: 3, x: TOWER_L + TOWER_W / 2 }]) {
      if (spanOf(t.f, t.x, net) >= 0 || route({ f: 0, x: 792 }, t, net)) fail(`${st}: a dragon can reach the tower room at ${at(t)}`);
    }
  }
  if (KEEPER_NET.links.some((l) => l.name === 'lift')) fail('the keepers\' net has the lift in it');
  for (const d of sim.dragons) if (spanOf(d.f, d.x, dragonNet(d.stage)) < 0) fail(`${d.name} stands off its stage's dragon floor (${at(d)})`);
  noteUse(sim);
  console.log(`  1 routes: keepers ${sim.keepers.length} x ${targets.length} places (every stand spot, post and the deck), both ways; dragons ${dragonRoutes} routes on ${STAGES.length} stages' nets, ${liftRides} lift rides among them (one leg each), none through a tower; hayloft to Aerie ${up ? up.cost : '-'} px in one ride`);
}

// ---------- 2. thirty minutes of play ----------
{
  /** One 30-minute run on the starting base, checked as it goes; what it measured. */
  const play = (seed: number) => {
    const sim = newSim(seed), MIN = 30, steps = MIN * 60 * FPS, at = seed === 1 ? '' : `seed ${seed}, `;
    const still = new Map<Keeper, { key: string; since: number }>(), stood = new Map<Dragon, { key: string; since: number }>();
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
        if (!k.climbing && spanOf(k.f, k.x) < 0) fail(`${at}step ${sim.tick}: ${k.name} stands off floor ${k.f} at x ${k.x.toFixed(1)}`);
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
        else if (spanOf(d.f, d.x, dragonNet(d.stage)) < 0) fail(`${at}step ${sim.tick}: ${d.name} stands off its floor (f${d.f} x ${d.x.toFixed(1)})`);
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
        // a walking dragon gets somewhere (spike's creep and slinkwing's pause stand still a moment); a rider is held in
        // the car only while someone clears the bay; a wait at a landing or the bay's edge lasts a while at most
        const y = d.move === 'ride' ? L.y : feetY(d.f), key = `${d.move}@${d.f},${d.x},${y}`, was = stood.get(d);
        if (!was || was.key !== key) stood.set(d, { key, since: sim.tick });
        else if (['walk', 'board', 'alight'].includes(d.move) && sim.tick - was.since > GATE.walkStallS * FPS) fail(`${at}step ${sim.tick}: ${d.name} has stood still mid-${d.move} for ${GATE.walkStallS} s`);
        else if (d.move === 'ride') heldMax = Math.max(heldMax, sim.tick - was.since);
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
{
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
{
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
{
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
{
  // a Rush into a full room: the kitchen's two slots held by dragons waiting for their feeds (their keepers on the way),
  // a third rushed there bumps the holder lowest in the queue, whose keeper gives the job back
  const sim = newSim(5);
  for (const d of sim.dragons) for (const k of NEEDS) if (hasNeed(d.element, k)) d.needs[k] = 0.95;
  const [ember, ripple, zap] = ['EMBER', 'RIPPLE', 'ZAP'].map((n) => sim.dragons.find((d) => d.name === n)!);
  const kitchen = needRoom(sim, 'food')!;
  ripple.slot = kitchen.slots[1]; ripple.x = ripple.slot.x; ripple.f = ripple.slot.f; ripple.facing = ripple.slot.facing;
  ember.needs.food = 0.3; ripple.needs.food = 0.35; zap.needs.food = 0.4;
  sim.step();
  if (sim.dragons.some((d) => d.slot?.room === kitchen.id && d !== ember && d !== ripple) || !sim.jobs.every((q) => q.need === 'food')) fail('bump: the kitchen is not held by EMBER and RIPPLE waiting for their feeds');
  const zj = sim.jobs.find((q) => q.dragon === zap && q.need === 'food');
  const bumps = sim.stats.slotBumps;
  if (!zj) fail('bump: ZAP has no food job');
  else {
    sim.rush(zj);
    if (sim.stats.slotBumps !== bumps + 1) fail(`bump: a Rush into the full kitchen bumped ${sim.stats.slotBumps - bumps} holders, not 1`);
    const bumped = [ember, ripple].find((d) => d.slot?.room !== kitchen.id);
    if (zap.slot?.room !== kitchen.id || zap.goalJob !== zj.id) fail('bump: ZAP did not take a kitchen slot for its rushed feed');
    if (!bumped) fail('bump: nobody left the kitchen');
    else {
      if (sim.jobs.some((q) => q.dragon === bumped && q.keeper && q.keeper.phase !== 'work' && bumped.goalJob !== q.id)) fail(`bump: ${bumped.name}'s keeper kept a job its dragon stopped going for`);
      let s = 0;
      while (sim.jobs.includes(zj) && s++ < 120 * FPS) sim.step();
      if (sim.jobs.includes(zj)) fail('bump: ZAP\'s rushed feed was not done within 120 s');
      else console.log(`  4 bump: ZAP rushed into the full kitchen took ${bumped.name}'s slot (the lower in the queue), fed in ${(s / FPS).toFixed(1)} s`);
    }
  }
  noteUse(sim);
}
{
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
{
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
  if (fl.dragons.length !== 17 || fl.eggs.length !== 1 || fl.clock - fl.eggs[0].laid < HATCH_DAYS * fl.dayLen) fail(`preset full: ${fl.dragons.length} dragons and ${fl.eggs.length} eggs`);
  noteUse(gu); noteUse(eg); noteUse(ht); noteUse(fl);
  console.log(`  5 start: ${ds.map((d) => `${d.id} ${d.name} (${d.element})`).join(', ')}; all adult, 0 days in, at clock ${sim.clock}; presets ${Object.keys(PRESETS).join(' ')} (ages: ${ages.dragons.length} dragons, ${stages.size} stages; growup: EMBER an elder at step ${guAt}; eggs: ${eg.eggs.map((e, i) => `${e.element} ${egP[i].toFixed(2)}`).join(', ')}; hatch: ${ht.dragons[7]?.name} at step ${htAt}; full: ${fl.dragons.length} dragons and a due egg)`);
}

// ---------- 6. saves: exact, by id, through JSON ----------
let firstRide = '';
{
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
  const UNSAVED: Readonly<Record<string, string>> = { rooms: 'placed again from roomPlaces', roomPlaces: 'saved as rooms', events: 'one step\'s output, cleared by the next' };
  for (const k of Object.keys(a)) if (!(k in blob) && !(k in UNSAVED)) fail(`save: the world's ${k} is not in its save (save it, or say in sim-check why not)`);
  const b = CareSim.fromSave(through(serialize(a)));
  if (b.digest() !== a.digest()) fail('save: a loaded world differs from its save at once');
  // a slot comes back as its room's own slot (by room id and index), and the rooms' uses as a copy of their own
  for (const d of b.dragons) if (d.slot && d.slot !== b.rooms[d.slot.room]?.slots[d.slot.i]) fail(`save: ${d.name}'s slot is not its room's own after loading`);
  if (b.lift === a.lift || !isDeepStrictEqual(b.lift, a.lift) || (a.lift.calls.length && b.lift.calls === a.lift.calls)) fail('save: the lift was not saved and loaded as its own copy');
  if (!Object.keys(a.stats.used).length || !isDeepStrictEqual(b.stats.used, a.stats.used) || b.stats.used === blob.stats.used) fail('save: the rooms\' uses (stats.used) were not saved and loaded as their own copy');
  if (b.seed !== a.seed || b.clock !== a.clock) fail('save: the seed or the clock was not kept');
  for (let s = 0; s < 5000; s++) { a.step(); b.step(); }
  if (a.digest() !== b.digest()) fail('save: a world saved at step 5000 and loaded has drifted from its original by step 10000');
  // the first ride of all: saved mid-ride (the first step a rider is in the moving car), and stepped 5000 on beside
  // the run it came from
  {
    const run = newSim(1), riding = () => run.lift.moving && run.dragons.some((d) => d.id === run.lift.rider && d.move === 'ride');
    while (!riding() && run.tick < 20000) run.step();
    const at = run.tick, rider = run.dragons.find((d) => d.id === run.lift.rider);
    firstRide = rider ? `${rider.name} riding floor ${rider.f} to ${run.lift.target}, the car at y ${run.lift.y}, step ${at}` : 'none';
    const copy = CareSim.fromSave(through(serialize(run))), since = { ...copy.stats.used };
    for (let s = 0; s < 5000; s++) { run.step(); copy.step(); }
    if (!rider || copy.digest() !== run.digest()) fail(`save: a world saved at its first ride (${firstRide}) and loaded has drifted by step ${at + 5000}`);
    noteUse(run); noteUse(copy, since);
  }
  // more saves, taken from one run whenever something is under way that no save so far has caught (a keeper fetching,
  // picking up, on the way, waiting at the stand spot, at work, going home, halfway up a ladder or held at the bay's
  // edge; a dragon mid-act or asleep, walking, turning, at a landing, boarding, riding, walking off the car or held at
  // the bay's edge; a rushed job), each stepped 5000 on in lockstep with the run it came from (the Rush reaching every
  // world alive then) and compared
  const ref = newSim(1), forks: { sim: CareSim; at: number; used: Record<string, number> }[] = [], live: typeof forks = [], caught = new Set<string>();
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
      if (now.length) { const sim = CareSim.fromSave(through(serialize(ref))), f = { sim, at: s, used: { ...sim.stats.used } }; forks.push(f); live.push(f); for (const p of now) caught.add(p); }
    }
  }
  if (live.length) fail(`save: ${live.length} loaded worlds were never compared`);
  // (a loaded world counts only its own uses, not the ones it was loaded with)
  noteUse(a); noteUse(b, blob.stats.used); noteUse(ref);
  for (const f of forks) noteUse(f.sim, f.used);
  for (const p of WANT) if (!caught.has(p)) fail(`save: no save caught a world with something ${p}`);
  let threw: unknown = null;
  try { CareSim.fromSave({ ...serialize(a), v: 999 }); } catch (e) { threw = e; }
  if (!(threw instanceof SaveVersionError)) fail(`save: a version-999 save ${threw ? `threw ${threw}` : 'loaded'}, not a SaveVersionError`);
  console.log(`  6 saves: ${JSON.stringify(blob).length} bytes at step 5000; loaded, it, one at the first ride (${firstRide}) and ${forks.length} more saves (steps ${forks.map((f) => f.at).join(' ')}: ${[...caught].join(', ')}) step on 5000 to the same world; v 999 throws ${threw instanceof Error ? threw.name : threw}`);
}
{
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
  const ref = mk(), forks: { sim: CareSim; at: number; what: string; used: Record<string, number> }[] = [], seen = new Set<string>();
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
      forks.push({ sim, at: s, what: now.join('+'), used: { ...sim.stats.used } });
      for (const k of now) seen.add(k);
    }
  }
  for (const k of WANT) if (!seen.has(k)) fail(`save: no save caught a world with ${k === 'egg' ? 'an egg incubating' : k === 'settle' ? 'a baby walking to grow up' : `a ${k}`}`);
  noteUse(ref);
  for (const f of forks) noteUse(f.sim, f.used);
  const said: Readonly<Record<string, string>> = { egg: 'eggs incubating', settle: 'BURR walking to grow up', hatch: 'an egg just hatched', grow: 'a dragon just grown up' };
  console.log(`  6 saves (life, a 600-step day): ${forks.map((f) => `step ${f.at} (${f.what.split('+').map((k) => said[k]).join(', ')})`).join(', ')} step on 5000 to the same world`);
}

// ---------- 7. rngAt: stateless draws ----------
{
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
{
  // every room kind and structure says what it is for; each need is met in exactly one kind of room
  for (const k of ROOM_KINDS) if (!ROOM_INFO[k].purpose?.trim()) fail(`rooms: the ${k} has no purpose`);
  for (const [k, v] of Object.entries(STRUCTURES)) if (!v.purpose.trim()) fail(`rooms: the ${k} has no purpose`);
  for (const n of NEEDS) {
    const by = ROOM_KINDS.filter((k) => ROOM_INFO[k].meets === n);
    if (by.length !== 1) fail(`rooms: ${n} is met in ${by.length ? by.join(', ') : 'no room'}, not exactly one kind`);
  }
  // the plates: one per room, the lift's and the Aerie's; each names a room placed or a structure, and sits on it (so
  // never on a bare slot): a room's inside its wall, the lift's in its ground-floor bay, the Aerie's over the deck
  const sim = newSim(), plates = platesOf(sim.rooms);
  if (plates.length !== sim.rooms.length + 2) fail(`plates: ${plates.length} for ${sim.rooms.length} rooms and the 2 structures`);
  const inside = (p: { x: number; y: number; w: number; h: number }, x0: number, x1: number, y0: number, y1: number) => p.x >= x0 && p.x + p.w <= x1 && p.y >= y0 && p.y + p.h <= y1;
  for (const p of plates) {
    if (!(p.names in ROOM_INFO) && !(p.names in STRUCTURES)) { fail(`plates: "${p.text}" names ${p.names}, which is no room or structure`); continue; }
    const r = p.room == null ? null : sim.rooms[p.room];
    const ok = r ? r.kind === p.names && p.text === ROOM_INFO[r.kind].name && inside(p, r.x0, r.x1, floorTop(r.floor), floorTop(r.floor) + WALL_H)
      : p.names === 'lift' ? inside(p, LIFT_X0, LIFT_X1, floorTop(0), floorTop(0) + WALL_H)
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
  // a keeper waits between jobs clear of the body of a dragon of any stage in any slot on their floor (their extent is
  // x +- 10), so a keeper at rest is never hidden behind a dragon; the waiting spot is in the keeper's own room
  for (const k of sim.keepers) {
    if (k.stationX < k.station.x0 + 10 || k.stationX > k.station.x1 - 10) fail(`keepers: ${k.name} waits at x ${k.stationX}, outside the ${k.station.kind}`);
    for (const r of sim.rooms) if (r.floor === k.station.floor) for (const sl of r.slots) for (const st of STAGES) {
      if (!fitsSlot(sl, st)) continue;
      const [x0, x1] = slotBody(sl, st);
      if (k.stationX + 10 > x0 && k.stationX - 10 < x1) fail(`keepers: ${k.name} waits at x ${k.stationX}, behind ${/^[aeiou]/.test(st) ? 'an' : 'a'} ${st} in the ${r.kind}'s slot ${sl.i} (its body x ${x0.toFixed(1)}..${x1.toFixed(1)})`);
    }
  }
  // the start stands in the start slots of plan 3.3, facing its slot's way
  const want: Readonly<Record<string, string>> = { EMBER: 'kitchen 0', RIPPLE: 'bath 0', ZAP: 'romp 0', BRAMBLE: 'groom 0', COBBLE: 'groom 1', ECHO: 'groom 2', WICK: 'dorm 0' };
  for (const d of sim.dragons) {
    const got = d.slot ? `${sim.rooms[d.slot.room].kind} ${d.slot.i}` : 'no slot';
    if (got !== want[d.name] || d.x !== d.slot?.x || d.f !== d.slot.f || d.facing !== d.slot.facing) fail(`start: ${d.name} stands in the ${got} at f${d.f} x ${d.x} facing ${d.facing}, not the ${want[d.name]} slot`);
  }
  // each need's room (travel.ts NEED_ROOM) is the one kind that meets it, and the base has it
  const needRooms: Readonly<Record<string, string>> = { food: 'kitchen', bath: 'bath', play: 'romp', love: 'groom', sleep: 'dorm' };
  for (const n of NEEDS) if (NEED_ROOM[n] !== needRooms[n] || ROOM_INFO[NEED_ROOM[n]].meets !== n || !needRoom(sim, n)) fail(`rooms: ${n} is met in the ${NEED_ROOM[n]}, not the ${needRooms[n]}`);
  console.log(`  8 rooms: ${ROOM_KINDS.length} kinds and ${Object.keys(STRUCTURES).length} structures, each with a purpose; ${NEEDS.length} needs, one room each; ${plates.length} plates, none on a bare slot; keepers wait at ${sim.keepers.map((k) => `${k.name} ${k.stationX}`).join(', ')}, clear of every slot (the rooms' uses are checked at the end, over the whole suite)`);
}

// ---------- 9. gait: dragons walk by their walks' own root motion ----------
{
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
  // a scripted adult spike, walking 600 steps along the upper floor with nothing else to do: exactly the gait's
  // distance, and exactly what the anim player carries a pet playing that walk from its start at speed 1
  const sim = newSim(1), d = sim.dragons.find((q) => q.element === 'spike' && q.stage === 'adult')!;
  for (const q of sim.dragons) for (const k of NEEDS) if (hasNeed(q.element, k)) q.needs[k] = 1;
  const x0 = d.x, to = x0 + 300;
  d.legs = [{ f: d.f, x: to }];
  const g = gaitOf('spike', 'adult'), b = dragonBuild({ element: 'spike', stage: 'adult', seed: d.seed });
  const player = new DragonAnimPlayer(dragonAnims('adult', b.spec, b.dims), d.seed);
  player.play('walk', { restart: true, speed: 1 });
  let table600 = 0, played = 0;
  for (let t = 1; t <= 600; t++) { sim.step(); table600 += moveAt(g, t); player.tick(); played += player.move; }
  const went = d.x - x0;
  if (d.move !== 'walk' || d.gaitT !== 600 || d.walkSeq !== 1) fail(`gait: the scripted spike is ${d.move} ${d.gaitT} steps into bout ${d.walkSeq}, not walking bout 1 for 600 steps`);
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
    const net = dragonNet(st), L = spanOf(f, landingEdge(st, -1), net) >= 0, R = spanOf(f, landingEdge(st, 1), net) >= 0;
    if (!L || (f !== AERIE_F && !R)) fail(`gait: a ${st}'s landing on floor ${f} is off its floor (${L ? '' : 'west '}${R ? '' : 'east'})`);
  }
  console.log(`  9 gait: ${looks} walks, each the same for seeds 11 and 215, each moving as its frames and its anim player say for three cycles (${still} with steps standing still; ${loopsFrom.length ? `looping from past their start: ${loopsFrom.join(', ')}` : 'all looping whole'}; a walk with an intro wraps and catches up in step); a scripted spike walked ${went.toFixed(3)} px in 600 steps, as its gait and its anim player say; the paper turn flips at step ${TURN_HALF} of ${TURN_STEPS}`);
  noteUse(sim); noteUse(t);
}

// ---------- 10. one car's capacity: more dragons than the start's seven ----------
{
  // The Dragon Lift is the barn's bottleneck (docs/BASE_DESIGN.md 4.7): one car, one rider, one dragon at a time in
  // its shaft, and each ride about 15 s of the car's time, most of it the rider walking in and off at its anim's own
  // pace. The start's seven adults keep it busy nearly all the time (section 2). This measures more, for the slices
  // that grow the barn (S5's hatchlings, S8's Aerie trips): an eighth adult for 30 minutes, ten for 10, and the twelve
  // of the ages preset (four babies among them, every stage) for 6 -- printed, with the ceiling they show: eight is
  // served (frozen: no need empty, its waits), nine or more are not. Frozen whatever the load: no keeper gives up on a
  // dragon, the car never stands still with work to do for a minute, and the car's throughput (rides, the lift's
  // capacity) stays within 20 % of what it measures.
  const extra: DragonPlace[] = [
    { name: 'EIGHTH', element: 'fire', stage: 'adult', seed: 501, slot: { room: 'kitchen', i: 1 } },
    { name: 'NINTH', element: 'water', stage: 'adult', seed: 502, slot: { room: 'romp', i: 1 } },
    { name: 'TENTH', element: 'rock', stage: 'adult', seed: 503, slot: { room: 'bath', i: 1 } },
  ];
  const runs = [
    { what: '8 adults', cast: [...START_DRAGONS, extra[0]], min: 30, rides: CAPACITY_RIDES[0] },
    { what: '10 adults', cast: [...START_DRAGONS, ...extra], min: 10, rides: CAPACITY_RIDES[1] },
    { what: 'the ages preset', cast: PRESETS.ages().dragons, min: 6, rides: CAPACITY_RIDES[2] },
  ];
  const out: string[] = [];
  for (const run of runs) {
    const sim = new CareSim(START_ROOMS, run.cast, START_KEEPERS, { seed: 1 }), steps = run.min * 60 * FPS;
    let key = '', since = 0, stuck = 0, busy = 0;
    for (let s = 0; s < steps; s++) {
      sim.step();
      const L = sim.lift, k = `${L.y},${L.rider},${L.target},${sim.dragons.map((d) => d.x).join()}`;
      if (L.rider != null || L.target != null) busy++;
      if (k !== key) { key = k; since = sim.tick; } else if (L.calls.length || L.rider != null) stuck = Math.max(stuck, sim.tick - since);
    }
    const st = sim.stats, n = run.cast.length;
    if (st.waitTimeouts) fail(`capacity: with ${n} dragons, ${st.waitTimeouts} keepers gave up waiting`);
    if (stuck > 60 * FPS) fail(`capacity: with ${n} dragons, the car stood still with work to do for ${(stuck / FPS).toFixed(1)} s`);
    if (st.liftRides < run.rides * 0.8) fail(`capacity: with ${n} dragons the car gave ${st.liftRides} rides in ${run.min} min (measured ${run.rides}; want >= 80 % of it)`);
    if (n === 8) {
      // (eight is the ceiling as built: frozen, so a change that costs the car capacity shows here first)
      const avg = st.waitSum / Math.max(1, st.started) / FPS, max = st.waitMax / FPS;
      if (st.emptySteps) fail(`capacity: with 8 dragons a need sat at 0 for ${st.emptySteps} dragon-steps`);
      if (avg > CAPACITY8.waitAvgS || max > CAPACITY8.waitMaxS) fail(`capacity: with 8 dragons jobs waited ${avg.toFixed(1)} s on average, ${max.toFixed(1)} s at most (want <= ${CAPACITY8.waitAvgS}, ${CAPACITY8.waitMaxS})`);
    }
    out.push(`${run.what} (${n}), ${run.min} min: ${st.done} jobs done, wait avg ${(st.waitSum / Math.max(1, st.started) / FPS).toFixed(1)} s, max ${(st.waitMax / FPS).toFixed(1)} s; ${st.emptySteps} steps with a need at 0; the car busy ${(busy / steps * 100).toFixed(0)} %, ${st.liftRides} rides, a landing wait at most ${(st.liftWaitMax / FPS).toFixed(1)} s`);
    noteUse(sim);
  }
  console.log(`  10 capacity: ${out.join('; ')}`);
}

// ---------- 11. the clock ----------
{
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
      last = r;
    }
    if (turns !== 4) fail(`clock (${dayLen}): the phase turned ${turns} times from midnight to midnight, not 4 (night to dawn, day, dusk, and night again at 20:00)`);
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
  console.log(`  11 clock: ${lines.join('; ')}; a whole day read step by step turns night, dawn, day, dusk, night, each sky in three stepped thirds, the lights and the icon with it; the top bar ${bar.join(', ')}; hour= starts a world at 22:00`);
}

// ---------- 12. night is not the barn's ----------
{
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
  // (the simulation's own modules: none reads the phase, the hour or the sky; only the view does)
  const SIM_FILES = ['sim.ts', 'travel.ts', 'needs.ts', 'layout.ts', 'gait.ts', 'save.ts', 'start.ts', 'presets.ts', 'rand.ts', 'life.ts', 'names.ts'];
  const reads = SIM_FILES.filter((f) => /\b(readClock|phaseOf|PHASE_HOURS|PHASE_ORDER|DayPhase|skyBands|nightness|dimness|skyPhase|lightsOf)\b/.test(fs.readFileSync(new URL(`../src/game/${f}`, import.meta.url), 'utf8')));
  if (reads.length) fail(`night: ${reads.join(', ')} read the day's phase (only the view may: plan G8)`);
  console.log(`  12 night: a barn started at 07:00 and one at 19:00 (seed 1) agree on barnKey at all ${checked} checks over 20000 steps, through ${[...phases].join(', ')}; ${SIM_FILES.length} simulation modules, none reading the day's phase`);
  noteUse(day); noteUse(eve);
}

// ---------- 13. growing up: a month a stage (#8) ----------
{
  const SHORT = 600, LEN = STAGE_DAYS * SHORT;
  const BURR: DragonPlace = { name: 'BURR', element: 'spike', stage: 'baby', seed: 45, slot: { room: 'hatchery', i: 0 } };
  const where = (w: CareSim, d: Dragon) => (d.slot ? `${w.rooms[d.slot.room].kind}:${d.slot.i}` : 'no slot');
  const LEN_OF = (w: CareSim) => STAGE_DAYS * w.dayLen;
  /**
   * Step a world, checking every grow event as it comes: the stage it grew into is the next, its stage's start moved on
   * exactly one stage's length, and the dragon was settled as the step began (no keeper on any of its jobs, no route
   * left, standing still in a slot its new stage fits, and no act but one ending that step: life runs after the acts,
   * and the dragon may set off for a job later in the same step); the step after, each need not being met drains at
   * the new stage's rate. And as it goes: every slot held fits its dragon's stage -- or, a baby on its way to grow up (goal `settle`),
   * its next stage's -- and a module holds one grown dragon (such a baby counted as one) or two babies.
   */
  const run = (w: CareSim, steps: number, what: string, done: () => boolean) => {
    const was = new Map(w.dragons.map((d) => [d.id, { stage: d.stage, since: d.stageSince }]));
    const grew: { t: number; d: Dragon; stage: string; at: string; delay: number }[] = [], walked = new Set<Dragon>();
    let after: { d: Dragon; needs: Needs }[] = [], drains = 0;
    for (let s = 1; s <= steps && !done(); s++) {
      // (each dragon due by this step, as the step begins: whether it is settled -- life runs after the acts)
      const pre = new Map<Dragon, string>();
      for (const d of w.dragons) {
        const next = nextStage(d.stage);
        if (!next || stageDue(w, d) > w.clock + 1) continue;
        const why = [d.act && d.act.t + 1 < d.act.len ? `act ${d.act.need}` : '', d.legs.length ? `${d.legs.length} legs` : '', d.move !== 'still' ? d.move : '', d.turn >= 0 ? 'turning' : '',
          w.lift.rider === d.id ? 'the lift\'s rider' : '', w.jobs.some((j) => j.dragon === d && j.keeper) ? `${w.jobs.find((j) => j.dragon === d && j.keeper)!.keeper!.name} on it` : '',
          !d.slot || !fitsSlot(d.slot, next) || d.x !== d.slot.x || d.f !== d.slot.f ? `in the ${where(w, d)}` : ''].filter(Boolean);
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
        for (const d of w.dragons) if (d.move !== 'ride' && spanOf(d.f, d.x, dragonNet(d.stage)) < 0) fail(`grow (${what}), step ${w.tick}: ${d.name} (${d.stage}) stands off its floor at f${d.f} x ${d.x.toFixed(1)}`);
      }
      for (const e of w.events) {
        if (e.kind !== 'grow') continue;
        const d = w.dragons.find((q) => q.id === e.dragon)!, was0 = was.get(d.id)!;
        if (e.stage !== nextStage(was0.stage) || d.stage !== e.stage) fail(`grow (${what}): ${d.name} grew from ${was0.stage} into ${e.stage} (now ${d.stage})`);
        if (d.stageSince - was0.since !== LEN_OF(w)) fail(`grow (${what}): ${d.name}'s stage began ${d.stageSince - was0.since} steps after the last, not ${LEN_OF(w)} (exactly ${STAGE_DAYS} days)`);
        if (pre.get(d) !== '') fail(`grow (${what}): ${d.name} grew ${e.stage} unsettled (${pre.get(d) ?? 'not due'})`);
        grew.push({ t: w.tick, d, stage: e.stage, at: where(w, d), delay: w.clock - d.stageSince });
        was.set(d.id, { stage: d.stage, since: d.stageSince });
        after.push({ d, needs: { ...d.needs } });
      }
    }
    return { grew, walked, drains };
  };
  // (a) alone: a baby in the Hatchery grows young, adult and elder, each 30 short days after the last
  const alone = new CareSim(START_ROOMS, [BURR], START_KEEPERS, { seed: 1, dayLen: SHORT }), burr = alone.dragons[0];
  const a = run(alone, 3 * LEN + GROW_ALONE + 60, 'alone', () => burr.stage === 'elder');
  if (a.grew.map((g) => g.stage).join() !== 'young,adult,elder') fail(`grow (alone): BURR grew ${a.grew.map((g) => g.stage).join(', ') || 'never'}, not young, adult, elder once each`);
  if (burr.stageSince !== alone.clock0 + 3 * LEN) fail(`grow (alone): BURR's elder stage began at clock ${burr.stageSince}, not ${alone.clock0 + 3 * LEN} (three stages of exactly ${LEN} steps)`);
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
  if (dueIn !== 180 || at < 180 || ember.stage !== 'elder' || ember.stageSince - since0 !== STAGE_DAYS * DAY_STEPS) fail(`grow (real): EMBER, due in ${dueIn} steps, is ${ember.stage}${at > 0 ? ` from step ${at}` : ''} (want an elder from step 180 to ${180 + GROW_REAL}, its stage begun exactly ${STAGE_DAYS} days of ${DAY_STEPS} steps on)`);
  noteUse(real);
  const fmt = (r: typeof b) => r.grew.map((g) => `${g.d.name} ${g.stage} ${g.delay}`).join(', ');
  console.log(`  13 growing up: alone (a ${SHORT}-step day), BURR grew ${a.grew.map((g) => `${g.stage} at step ${g.t} (${g.at}, ${g.delay} late)`).join(', ')}, each stage exactly ${LEN} steps after the last, walking out of the Hatchery to a module slot first; ${a.drains + b.drains} needs drained at the new stage's rate the step after; the busy barn (seven adults and BURR falling due 5 s apart), steps late: ${fmt(b)} (at most ${busy.stats.growDelayMax}, gate ${GROW_BUSY}); the real day (${DAY_STEPS} steps), EMBER ${STAGE_DAYS} days less a minute in grew an elder at step ${at} (due at 180)`);
}

// ---------- 14. eggs and hatching (#5.4, the Hatchery) ----------
{
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
  if (r.hatched.slice(0, 2).some((h) => !h.at.startsWith('hatchery:')) || r.hatched[2]?.at.startsWith('hatchery:')) fail(`eggs: the babies went to ${r.hatched.map((h) => h.at).join(', ')}, not the Hatchery's two sub-slots first`);
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
  // every baby sub-slot taken (the `full` preset, everyone's needs full so nobody moves): the due egg waits in its nest,
  // nothing lost; one baby goes out (as one will to the garden or on a trip: S6, S8), and the egg hatches into its sub-slot
  const spec = startSpec('full'), full = new CareSim(spec.rooms, spec.dragons, spec.keepers, { seed: 1, dayLen: SHORT });
  spec.after!(full);
  for (const d of full.dragons) for (const k of NEEDS) if (hasNeed(d.element, k)) d.needs[k] = 1;
  const n0 = full.dragons.length, egg = full.eggs[0], probe = { ...full.dragons.find((d) => d.stage === 'baby')!, id: -1, slot: null };
  if (!egg || full.clock - egg.laid < H || nearestFree(full, probe) !== null) fail('eggs: the full preset has no due egg, or a baby sub-slot free');
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
  // names: every element's own six, none over NAME_MAX and none shared; past them a number, still unique and short
  const fake = (names: readonly string[]) => ({ dragons: names.map((name) => ({ name })) }) as unknown as CareSim;
  const all = Object.values(NAMES).flat();
  if (new Set(all).size !== all.length || all.some((n) => n.length > NAME_MAX)) fail('names: two elements share a name, or one is over 8 characters');
  if (hatchName(fake(NAMES.fire), 'fire') !== 'CINDER2' || hatchName(fake([...NAMES.fire, 'CINDER2']), 'fire') !== 'ASH2') fail(`names: past fire's six, ${hatchName(fake(NAMES.fire), 'fire')} then ${hatchName(fake([...NAMES.fire, 'CINDER2']), 'fire')}, not CINDER2 then ASH2`);
  const got: string[] = [];
  for (let i = 0; i < 80; i++) got.push(hatchName(fake(got), 'lightning'));
  if (new Set(got).size !== got.length || got.some((n) => n.length > NAME_MAX)) fail(`names: 80 lightning hatchlings gave ${new Set(got).size} names, the longest ${Math.max(...got.map((n) => n.length))} characters`);
  console.log(`  14 eggs: three eggs in nests 0-2, a fourth not taken; each hatched exactly ${H} steps (2 days of ${SHORT}) after it was laid: ${r.hatched.map((h) => `${h.d.name} (id ${h.d.id}, seed ${h.d.seed}) into the ${h.at}, fed ${((fedIn.get(h.d) ?? NaN) / FPS).toFixed(1)} s later`).join('; ')}; two runs alike; every sub-slot taken, the egg waited ${H} steps, nothing lost, and hatched into the ${freed ? `${full.rooms[freed.room].kind}:${freed.i}` : '-'} the step it freed; 80 lightning names, the last ${got[got.length - 1]}`);
}

// ---------- 8 (the whole suite). every named room used (#11) ----------
{
  // every named room in the start, the lift and the Aerie: used somewhere in this suite, unless PLANNED; a PLANNED one unused
  const named = [...new Set([...START_ROOMS.map((r) => r.kind as string), ...Object.keys(STRUCTURES)])];
  for (const k of named) {
    const n = USED[k] ?? 0;
    if (PLANNED.has(k) ? n > 0 : n === 0) fail(PLANNED.has(k) ? `rooms: the ${k} is PLANNED but was used ${n} times: its mechanic has landed, take it off PLANNED` : `rooms: the ${k} is named and furnished but nothing used it (#11)`);
  }
  for (const k of PLANNED) if (!named.includes(k)) fail(`rooms: PLANNED names ${k}, which the building hasn't got`);
  console.log(`  8 rooms used over the suite: ${named.filter((k) => !PLANNED.has(k)).map((k) => `${k} ${USED[k] ?? 0}`).join(', ')}; planned: ${[...PLANNED].join(', ')}`);
}

if (fails.length) { console.log('SIM: FAIL\n' + fails.map((f) => '  ' + f).join('\n')); process.exit(1); }
console.log('SIM: the barn runs: every check passed');
