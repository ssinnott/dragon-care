// Capacity benchmark (plan S6b; docs/BASE_DESIGN.md 4.7): how well the barn serves herds bigger than the start's seven.
// Headless, like tools/sim-check.ts: each cast is built on the real start base (START_ROOMS, the four keepers) and runs
// `--min` minutes of play at the real day's length on every seed; what it got is printed as a markdown table, one row a
// cast, then a SERVED / NOT SERVED verdict each (C1's standard: no need ever empty on 7 of 8 seeds or more, and jobs
// waiting 90 s or less on average from opening to their keeper starting), then every run's own row.
//
//   node tools/capacity.ts                                  (npm run capacity: every cast, seeds 1-8, 30 min)
//   node tools/capacity.ts --casts=twelve --seeds=1-3 --min=10
//   node tools/capacity.ts --casts=start7,7a2y6b --seeds=1,4 --json=out.json --workers=2
//
// Flags: --casts=a,b (names below, or any `<n>a<n>y<n>b<n>e` cast: adults, counting the start's seven, then young,
// babies and elders), --seeds=1-8 (a range, a list, or both: 1-4,9), --min=30 (minutes of play; a fraction is fine),
// --json=path (every run's numbers as JSON), --workers=3 (runs at once, in worker threads, 1-3).
//
// Casts: start7, the new game's seven adults; eight, one more adult (sim-check section 10's EIGHTH: a fire adult in the
// kitchen's second module); ten, the seven and three babies; twelve, the seven, three young and two babies; fifteen,
// the seven, four young and four babies. A cast's dragons past the start's seven are placed as any preset places its
// dragons (presets.ts: a DragonPlace in a free slot, which CareSim's constructor checks: the slot fits the stage, nobody
// holds it, and its module holds one grown dragon or two babies) -- grown ones in the free module slots (the kitchen,
// the romp room, the bathhouse, the lamp dorm, the grooming parlour, in that order: section 10's), babies in the
// Hatchery's sub-slots first (as a hatchling takes them: life.ts hatch), then the free sub-slots nearest the Hatchery
// (by a baby's route, a ride counted RIDE_PX more: travel.ts nearestFree) -- each of the next element in turn (fire,
// water, rock, lightning, spike, dusk, slinkwing; the grown first, then the babies), named as a hatchling is (names.ts
// hatchName), 0 days into its stage (none grows up within 90 minutes of play at the real day). A cast the barn has no
// free slot for is reported as not fitting, and not run (the start barn has 11 module slots and the Hatchery's 2
// sub-slots: 7 adults and 4 young fill every module, leaving 2 sub-slots, so `fifteen` does not fit it).
//
// Measured each run: steps with a need at 0 (dragon-need-steps, sim.stats.emptySteps); the open-to-start wait (its
// average over the jobs started, and the most); jobs done; lift rides and the car's busy share (a rider, or a stop to
// go to); the longest a dragon waited at a landing for the car and at the bay's edge; the keepers' busy share (steps
// with a job); an eye under a standing body (sim-check section 2's measure, the sim's own model -- travel.ts depthOf,
// eyeSpan, dragonSpan: seconds summed over every pair, and the longest); stalls (S3's rules: a keeper standing still 10 s
// on the way somewhere, not held at the bay's edge; a dragon standing still 10 s mid-walk, boarding or walking off; the
// car standing still with work to do for a minute; a keeper giving up on a dragon, WAIT_MAX); breaks of section 2's
// invariants (checked every 30 steps as it does, the shaft every step); the jobs still open at the end and the oldest
// (the average wait counts only jobs started: a starving barn's never-started jobs show here); and ms per sim step (the
// step alone, measured in the worker; three workers share a 4-core machine).
//
// Each run is a whole world stepped alone, so a run's numbers are the same on every machine and in every worker (the
// ms per step aside). A prototype with more than one car changes `carsOf` (every other measure reads the dragons, the
// keepers and the stats).
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { CareSim, DAY_STEPS } from '../src/game/sim.ts';
import type { Dragon, Keeper, LiftState } from '../src/game/sim.ts';
import { START_ROOMS, START_DRAGONS, START_KEEPERS } from '../src/game/start.ts';
import type { DragonPlace } from '../src/game/start.ts';
import { hatchName } from '../src/game/names.ts';
import { NEEDS, FPS, hasNeed } from '../src/game/needs.ts';
import { NEED_ROOM, WAIT_MAX, RIDE_PX, inTheBay, liftRange, dragonSpan, dragonInBay, depthOf, eyeSpan, eyeClashes } from '../src/game/travel.ts';
import { placeRooms, route, spanOf, fitsSlot, feetY, nestX, AERIE_F, LIFT_CX } from '../src/game/layout.ts';
import type { Room, RoomKind, Slot } from '../src/game/layout.ts';
import type { DragonElement } from '../src/art/dragon/palettes.ts';
import type { Stage } from '../src/art/dragon/stages.ts';

// ---------- casts ----------

/** The named casts, as `<n>a<n>y<n>b` (adults counting the start's seven, young, babies). */
export const CASTS: Readonly<Record<string, string>> = Object.freeze({ start7: '7a', eight: '8a', ten: '7a3b', twelve: '7a3y2b', fifteen: '7a4y4b' });
/** A cast: how many of each stage (adults count the start's seven). */
export interface CastSpec { adult: number; young: number; baby: number; elder: number }
/** The elements the dragons past the start's seven take, in turn (the first three section 10's EIGHTH, NINTH and TENTH's). */
export const EXTRA_ELEMENTS: readonly DragonElement[] = ['fire', 'water', 'rock', 'lightning', 'spike', 'dusk', 'slinkwing'];
/** The order grown dragons past the start's take the free module slots in (section 10's: the kitchen's, the romp room's, the bathhouse's), then any other room by id. */
const GROWN_ROOMS: readonly RoomKind[] = ['kitchen', 'romp', 'bath', 'dorm', 'groom'];

/** A cast by name (CASTS) or pattern (`8a`, `7a3y2b`, `7a1e`); throws on anything else. */
export function parseCast(name: string): CastSpec {
  const pat = CASTS[name] ?? name, spec: CastSpec = { adult: 0, young: 0, baby: 0, elder: 0 };
  const key: Record<string, keyof CastSpec> = { a: 'adult', y: 'young', b: 'baby', e: 'elder' };
  if (!/^(\d+[aybe])+$/.test(pat)) throw new Error(`capacity: no cast "${name}" (the casts: ${Object.keys(CASTS).join(', ')}, or a pattern like 7a3y2b)`);
  for (const m of pat.matchAll(/(\d+)([aybe])/g)) spec[key[m[2]]] += Number(m[1]);
  const start = START_DRAGONS.length;
  if (spec.adult < start) throw new Error(`capacity: cast "${name}" has ${spec.adult} adults; every cast starts from the new game's ${start}`);
  return spec;
}

/** How many dragons a cast has. */
export const castSize = (s: CastSpec): number => s.adult + s.young + s.baby + s.elder;

/**
 * A cast's dragons on the start base: the new game's seven, then the rest (grown ones first -- adults, young, elders --
 * then babies), each in the first free slot of its kind (see the header), checked by CareSim's own constructor. `missing`
 * says what did not fit (the dragons placed before it are in `places`).
 */
export function placeCast(spec: CastSpec): { places: DragonPlace[]; missing: string | null } {
  const places: DragonPlace[] = [...START_DRAGONS];
  const rooms = placeRooms(START_ROOMS), hatchery = rooms.find((r) => r.kind === 'hatchery') ?? null;
  const rank = (r: Room) => { const i = GROWN_ROOMS.indexOf(r.kind); return i < 0 ? GROWN_ROOMS.length + r.id : i; };
  // (a DragonPlace names its room by kind: the first room of that kind)
  const all = rooms.filter((r) => rooms.find((q) => q.kind === r.kind) === r).flatMap((r) => r.slots.map((s) => ({ r, s })));
  const grown = all.filter(({ s }) => !s.baby).sort((p, q) => rank(p.r) - rank(q.r) || p.s.i - q.s.i);
  // (babies: the Hatchery's sub-slots, then the rest nearest the Hatchery's first nest by a baby's route there, a ride
  // counted RIDE_PX more -- as a hatchling takes the nearest free one: travel.ts nearestFree)
  const nest = hatchery ? { f: hatchery.floor, x: nestX(hatchery, 0) } : null, net = new CareSim(START_ROOMS, [], []).nets.dragon.baby;
  const near = (r: Room, s: Slot) => {
    if (r === hatchery) return -1;
    const rt = nest && route(nest, { f: s.f, x: s.x }, net);
    return rt ? rt.cost + (s.f !== nest!.f ? RIDE_PX : 0) : Infinity;
  };
  const babies = all.filter(({ s }) => s.baby).sort((p, q) => near(p.r, p.s) - near(q.r, q.s) || p.r.id - q.r.id || p.s.i - q.s.i);
  const extra: Stage[] = [
    ...Array<Stage>(spec.adult - START_DRAGONS.length).fill('adult'), ...Array<Stage>(spec.young).fill('young'),
    ...Array<Stage>(spec.elder).fill('elder'), ...Array<Stage>(spec.baby).fill('baby'),
  ];
  for (const [n, stage] of extra.entries()) {
    const element = EXTRA_ELEMENTS[n % EXTRA_ELEMENTS.length];
    const name = hatchName(new CareSim(START_ROOMS, places, []), element);
    let placed = false;
    for (const { r, s } of stage === 'baby' ? babies : grown) {
      if (!fitsSlot(s, stage) || places.some((p) => p.slot.room === r.kind && p.slot.i === s.i)) continue;
      const p: DragonPlace = { name, element, stage, seed: 501 + n, slot: { room: r.kind, i: s.i }, days: 0 };
      try { new CareSim(START_ROOMS, [...places, p], START_KEEPERS); } catch { continue; }
      places.push(p); placed = true; break;
    }
    if (!placed) {
      const left = extra.length - n;
      return { places, missing: `${places.length} of ${castSize(spec)} fit: no free ${stage === 'baby' ? 'baby sub-slot' : 'module slot'} for the ${ordinal(places.length + 1)} dragon, a ${stage} (${left} left over)` };
    }
  }
  return { places, missing: null };
}
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;

// ---------- one run ----------

/** The cars (one: the Dragon Lift). A prototype with more returns them all here. */
export function carsOf(sim: CareSim): LiftState[] { return [sim.lift]; }

/** One cast on one seed: what the tool measures (see the header). Times in seconds, shares 0..1. */
export interface Run {
  cast: string; pattern: string; seed: number; dragons: number; min: number; steps: number;
  emptySteps: number; opened: number; started: number; done: number; waitAvgS: number; waitMaxS: number; openAtEnd: number; oldestOpenS: number;
  /** Empty need-steps by the dragon's stage; the dragon with the most (name, stage, steps); the oldest job not started (dragon and need). */
  emptyByStage: Record<Stage, number>; mostEmpty: string; oldestOpen: string;
  rides: number; carBusy: number; landingMaxS: number; bayMaxS: number; keeperBayMaxS: number; riderHeldMaxS: number;
  keeperBusy: number; coverS: number; coverLongestS: number; coverWorst: string;
  stalls: number; stallNotes: string[]; breaks: number; breakNotes: string[];
  waitTimeouts: number; evictions: number; slotBumps: number; msPerStep: number;
}

/** A task for a worker: a cast's places and the run's seed and length. */
interface Task { cast: string; pattern: string; places: DragonPlace[]; seed: number; min: number }

/** Run one cast on one seed for `min` minutes of play, measuring as it goes. */
export function runOne(t: Task): Run {
  const sim = new CareSim(START_ROOMS, t.places, START_KEEPERS, { seed: t.seed }), steps = Math.round(t.min * 60 * FPS);
  const STALL = 10 * FPS, CAR_STALL = 60 * FPS;
  const stallNotes: string[] = [], breakNotes: string[] = [];
  let stalls = 0, breaks = 0;
  const stall = (m: string) => { stalls++; if (stallNotes.length < 4) stallNotes.push(`step ${sim.tick}: ${m}`); };
  const broke = (m: string) => { breaks++; if (breakNotes.length < 4) breakNotes.push(`step ${sim.tick}: ${m}`); };
  const still = new Map<Keeper, { key: string; since: number; told: boolean }>(), stood = new Map<Dragon, { key: string; since: number; told: boolean }>();
  let carKey = '', carSince = 0, carTold = false, carBusy = 0, keeperBusy = 0;
  let callMax = 0, bayMax = 0, keeperBayMax = 0, heldMax = 0, ms = 0;
  const covers = new Map<string, number>(), cover = { total: 0, longest: 0, worst: '' };
  const emptyByStage: Record<Stage, number> = { baby: 0, young: 0, adult: 0, elder: 0 }, emptyOf = new Map<Dragon, number>();
  const coverEnd = (k: string, n: number) => { cover.total += n; if (n > cover.longest) { cover.longest = n; cover.worst = `${k} from step ${sim.tick - n}`; } };
  for (let s = 0; s < steps; s++) {
    const t0 = performance.now();
    sim.step();
    ms += performance.now() - t0;
    // (every step: the cars' busy share and stand-stills, the keepers' jobs, the waits at landings and the bay's edge)
    const cars = carsOf(sim);
    if (cars.some((L) => L.rider != null || L.target != null)) carBusy++;
    const ck = `${cars.map((L) => `${L.y},${L.rider},${L.target}`).join('|')}|${sim.dragons.map((d) => d.x).join()}`;
    if (ck !== carKey) { carKey = ck; carSince = sim.tick; carTold = false; }
    else if (!carTold && cars.some((L) => L.calls.length || L.rider != null) && sim.tick - carSince > CAR_STALL) { carTold = true; stall(`the car stood still with work to do for ${CAR_STALL / FPS} s`); }
    for (const k of sim.keepers) { if (k.job) keeperBusy++; keeperBayMax = Math.max(keeperBayMax, k.bayWait); }
    for (const d of sim.dragons) {
      if (d.move === 'call') callMax = Math.max(callMax, d.waited); else if (d.move === 'bay') bayMax = Math.max(bayMax, d.waited);
      // (sim.stats.emptySteps, whose they are: a need at 0 after the step -- the sim counts it after the drain, and
      // nothing later in a step moves a need)
      for (const k of NEEDS) if (d.needs[k] <= 0) { emptyByStage[d.stage]++; emptyOf.set(d, (emptyOf.get(d) ?? 0) + 1); }
    }
    // (every step, as section 2: no two bodies overlap in the shaft on a floor, a standing rider's included; and an eye
    // under the body of a dragon standing drawn over it -- travel.ts eyeClashes finds whether any is, depthOf which)
    const L0 = sim.lift, inShaft = sim.dragons.filter((d) => (d.move === 'ride' ? !L0.moving : dragonInBay(d)));
    for (let i = 0; i < inShaft.length; i++) for (let k = i + 1; k < inShaft.length; k++) {
      const a = inShaft[i], b = inShaft[k], fa = a.move === 'ride' ? L0.f : a.f, fb = b.move === 'ride' ? L0.f : b.f;
      const [a0, a1] = dragonSpan(a.move === 'ride' ? { ...a, x: LIFT_CX } : a), [b0, b1] = dragonSpan(b.move === 'ride' ? { ...b, x: LIFT_CX } : b);
      if (fa === fb && Math.min(a1, b1) - Math.max(a0, b0) > 0.5) broke(`${a.name} (${a.move}) and ${b.name} (${b.move}) overlap in the lift shaft on floor ${fa}`);
    }
    const clash = eyeClashes(sim), seenCover = new Set<string>();
    if (clash.size) {
      const standing = sim.dragons.filter((d) => clash.has(d)), depth = new Map(standing.map((d) => [d, depthOf(sim, d)]));
      for (const a of standing) for (const b of standing) {
        if (a === b || a.f !== b.f) continue;
        const da = depth.get(a)!, db = depth.get(b)!;
        if (!(db > da || (db === da && b.id > a.id))) continue;
        const e = eyeSpan(a.stage, a.facing, a.x), [b0, b1] = dragonSpan(b);
        if (b0 > e[1] || b1 < e[0]) continue;
        const key = `${b.name} (${b.move}) over ${a.name}'s eye (${a.move})`;
        seenCover.add(key); covers.set(key, (covers.get(key) ?? 0) + 1);
      }
    }
    for (const [k, n] of covers) if (!seenCover.has(k)) { coverEnd(k, n); covers.delete(k); }
    if (s % 30) continue;
    // (every 30 steps, as section 2: the invariants, and whoever stands still where they should be getting somewhere)
    for (const d of sim.dragons) for (const k of NEEDS) {
      const v = d.needs[k];
      if (!(v >= 0 && v <= 1)) broke(`${d.name}'s ${k} is ${v}`);
      if (!hasNeed(d.element, k) && v !== 1) broke(`${d.name} has a ${k} need it shouldn't`);
    }
    const seen = new Set<string>();
    for (const j of sim.jobs) {
      const key = `${j.dragon.id}/${j.need}`;
      if (seen.has(key)) broke(`two ${j.need} jobs for ${j.dragon.name}`);
      seen.add(key);
      if (j.keeper && j.keeper.job !== j) broke(`job ${j.id}'s keeper ${j.keeper.name} is on another job`);
    }
    const onDragon = new Map<Dragon, number>();
    for (const j of sim.jobs) if (j.keeper) onDragon.set(j.dragon, (onDragon.get(j.dragon) ?? 0) + 1);
    for (const [d, n] of onDragon) if (n > 1) broke(`${n} keepers on ${d.name}`);
    for (const k of sim.keepers) {
      if (k.job && !sim.jobs.includes(k.job)) broke(`${k.name} is on a job that is gone`);
      if ((k.phase === 'idle') !== (!k.job && !k.legs.length)) broke(`${k.name} is ${k.phase} with ${k.job ? 'a job' : 'no job'}`);
      if (!k.climbing && spanOf(k.f, k.x, sim.nets.keeper) < 0) broke(`${k.name} stands off floor ${k.f} at x ${k.x.toFixed(1)}`);
      if (k.phase === 'work' && k.job) { const sp = sim.standAt(k.job.dragon); if (k.f !== sp.f || Math.abs(k.x - sp.x) > 1) broke(`${k.name} works with ${k.job.dragon.name} away from its stand spot`); }
      const key = `${k.phase}@${k.x.toFixed(1)},${k.y.toFixed(1)}`, was = still.get(k);
      if (!was || was.key !== key) still.set(k, { key, since: sim.tick, told: false });
      else if (!was.told && !['idle', 'pickup', 'work', 'wait'].includes(k.phase) && k.bayWait === 0 && sim.tick - was.since > STALL) { was.told = true; stall(`${k.name} stood still ${k.phase} for ${STALL / FPS} s`); }
    }
    const L = sim.lift, riders = sim.dragons.filter((d) => d.move === 'ride');
    if (riders.length > carsOf(sim).length) broke(`${riders.length} dragons ride`);
    if (!(L.y >= feetY(AERIE_F) && L.y <= feetY(0))) broke(`the car is at y ${L.y}, out of its shaft`);
    if (L.moving) { const r = liftRange(sim)!, who = inTheBay(sim, r[0], r[1]); if (who) broke(`${who} is in the lift bay while the car moves floors ${r[0]}-${r[1]}`); }
    const mods = new Map<string, { grown: number; babies: number }>(), slots = new Set<Slot>();
    for (const d of sim.dragons) {
      if (d.move === 'ride') { if (d.x !== LIFT_CX || L.rider !== d.id) broke(`${d.name} rides off the car's middle, or not as its rider`); }
      else if (spanOf(d.f, d.x, sim.nets.dragon[d.stage]) < 0) broke(`${d.name} stands off its floor (f${d.f} x ${d.x.toFixed(1)})`);
      if (d.slot) {
        if (slots.has(d.slot)) broke(`two dragons hold the ${sim.rooms[d.slot.room].kind}'s slot ${d.slot.i}`);
        slots.add(d.slot);
        if (!fitsSlot(d.slot, d.stage)) broke(`${d.name} holds a slot it doesn't fit`);
        const key = `${d.slot.room}/${d.slot.mod}`, m = mods.get(key) ?? { grown: 0, babies: 0 };
        if (d.slot.baby) m.babies++; else m.grown++;
        mods.set(key, m);
        if (m.grown > 1 || m.babies > 2 || (m.grown && m.babies)) broke(`module ${d.slot.mod} of the ${sim.rooms[d.slot.room].kind} holds ${m.grown} grown and ${m.babies} babies`);
      }
      if (d.place === 'barn' && d.act && (!d.slot || Math.abs(d.x - d.slot.x) >= 0.5 || sim.rooms[d.slot.room].kind !== NEED_ROOM[d.act.need])) broke(`${d.name} is met for ${d.act.need} away from its slot of the ${NEED_ROOM[d.act.need]}`);
      const y = d.move === 'ride' ? L.y : feetY(d.f), key = `${d.move}@${d.f},${d.x},${y}`, was = stood.get(d);
      if (!was || was.key !== key) stood.set(d, { key, since: sim.tick, told: false });
      else if (!was.told && ['walk', 'board', 'alight'].includes(d.move) && sim.tick - was.since > STALL) { was.told = true; stall(`${d.name} stood still mid-${d.move} for ${STALL / FPS} s`); }
      else if (d.move === 'ride') heldMax = Math.max(heldMax, sim.tick - was.since);
    }
  }
  for (const [k, n] of covers) coverEnd(k, n);
  const st = sim.stats;
  if (st.waitTimeouts) { stalls += st.waitTimeouts; if (stallNotes.length < 4) stallNotes.push(`${st.waitTimeouts} keepers gave up waiting for a dragon (WAIT_MAX ${WAIT_MAX} steps)`); }
  // (the jobs not started yet: no keeper at work on them)
  const open = sim.jobs.filter((j) => !j.keeper || j.keeper.phase !== 'work');
  const oldest = open.reduce<(typeof open)[number] | null>((a, j) => (!a || j.opened < a.opened ? j : a), null);
  const [starved, starvedN] = [...emptyOf].reduce<[Dragon | null, number]>((a, [d, n]) => (n > a[1] ? [d, n] : a), [null, 0]);
  const counted = Object.values(emptyByStage).reduce((a, n) => a + n, 0);
  if (counted !== st.emptySteps) broke(`the need-steps at 0 counted by stage (${counted}) are not the sim's (${st.emptySteps})`);
  return {
    cast: t.cast, pattern: t.pattern, seed: t.seed, dragons: t.places.length, min: t.min, steps,
    emptySteps: st.emptySteps, opened: st.opened, started: st.started, done: st.done,
    waitAvgS: st.waitSum / Math.max(1, st.started) / FPS, waitMaxS: st.waitMax / FPS,
    openAtEnd: open.length, oldestOpenS: oldest ? (sim.tick - oldest.opened) / FPS : 0,
    emptyByStage, mostEmpty: starved ? `${starved.name} (${starved.stage}) ${fmtInt(starvedN)}` : '', oldestOpen: oldest ? `${oldest.dragon.name} ${oldest.need}` : '',
    rides: st.liftRides, carBusy: carBusy / steps, landingMaxS: Math.max(st.liftWaitMax, callMax) / FPS, bayMaxS: bayMax / FPS,
    keeperBayMaxS: keeperBayMax / FPS, riderHeldMaxS: heldMax / FPS, keeperBusy: keeperBusy / (steps * Math.max(1, sim.keepers.length)),
    coverS: cover.total / FPS, coverLongestS: cover.longest / FPS, coverWorst: cover.worst,
    stalls, stallNotes, breaks, breakNotes, waitTimeouts: st.waitTimeouts, evictions: st.evictions, slotBumps: st.slotBumps, msPerStep: ms / steps,
  };
}

// ---------- the report ----------

/** A cast's verdict (C1): SERVED when no need empties on 7 of every 8 seeds or more and jobs wait 90 s or less on average. */
export const SERVED = { cleanShare: 7 / 8, waitAvgS: 90 } as const;

/** A cast's runs, summed up over its seeds. */
export interface CastSummary {
  cast: string; pattern: string; dragons: number; seeds: number[]; fits: boolean; missing: string | null;
  seedsEmpty: number; emptySteps: number; waitAvgS: number; waitMaxS: number; done: number; rides: number; carBusy: number;
  landingMaxS: number; bayMaxS: number; keeperBusy: number; coverS: number; coverLongestS: number; stalls: number; breaks: number;
  openAtEnd: number; oldestOpenS: number; msPerStep: number; served: boolean | null; verdict: string;
}

const mean = (xs: number[]) => xs.reduce((a, x) => a + x, 0) / Math.max(1, xs.length);
const most = (xs: number[]) => xs.reduce((a, x) => Math.max(a, x), 0);

export function summarize(cast: string, pattern: string, dragons: number, seeds: number[], runs: Run[], missing: string | null): CastSummary {
  const base = { cast, pattern, dragons, seeds, fits: !missing, missing };
  if (missing) {
    return { ...base, seedsEmpty: 0, emptySteps: 0, waitAvgS: 0, waitMaxS: 0, done: 0, rides: 0, carBusy: 0, landingMaxS: 0, bayMaxS: 0, keeperBusy: 0,
      coverS: 0, coverLongestS: 0, stalls: 0, breaks: 0, openAtEnd: 0, oldestOpenS: 0, msPerStep: 0, served: null,
      verdict: `NOT RUN: the start barn has no room for it (${missing})` };
  }
  const n = runs.length, seedsEmpty = runs.filter((r) => r.emptySteps > 0).length, clean = n - seedsEmpty, need = Math.ceil(n * SERVED.cleanShare - 1e-9);
  const s = {
    ...base, seedsEmpty, emptySteps: runs.reduce((a, r) => a + r.emptySteps, 0), waitAvgS: mean(runs.map((r) => r.waitAvgS)), waitMaxS: most(runs.map((r) => r.waitMaxS)),
    done: mean(runs.map((r) => r.done)), rides: mean(runs.map((r) => r.rides)), carBusy: mean(runs.map((r) => r.carBusy)),
    landingMaxS: most(runs.map((r) => r.landingMaxS)), bayMaxS: most(runs.map((r) => r.bayMaxS)), keeperBusy: mean(runs.map((r) => r.keeperBusy)),
    coverS: mean(runs.map((r) => r.coverS)), coverLongestS: most(runs.map((r) => r.coverLongestS)),
    stalls: runs.reduce((a, r) => a + r.stalls, 0), breaks: runs.reduce((a, r) => a + r.breaks, 0),
    openAtEnd: mean(runs.map((r) => r.openAtEnd)), oldestOpenS: most(runs.map((r) => r.oldestOpenS)), msPerStep: mean(runs.map((r) => r.msPerStep)),
  };
  const served = clean >= need && s.waitAvgS <= SERVED.waitAvgS;
  const why = [
    `no need empty on ${clean} of ${n} seeds (want >= ${need})${seedsEmpty ? `, ${fmtInt(s.emptySteps)} empty need-steps in all (${byStage(runs)})` : ''}`,
    `wait avg ${s.waitAvgS.toFixed(1)} s (want <= ${SERVED.waitAvgS})`,
    `${s.stalls} stalls${s.breaks ? `, ${s.breaks} invariant breaks` : ''}`,
  ];
  return { ...s, served, verdict: `${served ? 'SERVED' : 'NOT SERVED'}: ${why.join('; ')}` };
}

const fmtInt = (v: number) => Math.round(v).toLocaleString('en-US');
/** Whose the runs' empty need-steps were, by stage: `adults 60 %, babies 40 %`. */
const byStage = (runs: Run[]) => {
  const tot: Record<Stage, number> = { baby: 0, young: 0, adult: 0, elder: 0 };
  for (const r of runs) for (const k of Object.keys(tot) as Stage[]) tot[k] += r.emptyByStage[k];
  const all = Object.values(tot).reduce((a, n) => a + n, 0), word: Record<Stage, string> = { adult: 'adults', young: 'young', baby: 'babies', elder: 'elders' };
  return (['adult', 'young', 'baby', 'elder'] as Stage[]).filter((k) => tot[k]).map((k) => `${word[k]} ${(tot[k] / all * 100).toFixed(0)} %`).join(', ');
};
const pct = (v: number) => `${(v * 100).toFixed(0)} %`;
const f1 = (v: number) => v.toFixed(1);
const seedList = (seeds: number[]) => {
  const out: string[] = [];
  for (let i = 0; i < seeds.length; i++) {
    let j = i;
    while (j + 1 < seeds.length && seeds[j + 1] === seeds[j] + 1) j++;
    out.push(j > i ? `${seeds[i]}-${seeds[j]}` : `${seeds[i]}`);
    i = j;
  }
  return out.join(',');
};

/** The report as markdown: the summary table, the verdicts, every run's row, and what each column is. */
export function report(sums: CastSummary[], runs: Run[], head: { rev: string; min: number; seeds: number[]; wallS: number; workers: number }): string {
  const L: string[] = [];
  L.push(`## Capacity: ${head.min} min of play, seed${head.seeds.length > 1 ? 's' : ''} ${seedList(head.seeds)}, a ${DAY_STEPS}-step day (${head.rev})`, '');
  L.push('| Cast | Dragons | Seeds with a need empty | Empty need-steps | Wait avg s | Wait max s | Jobs done | Rides | Car busy | Landing max s | Bay edge max s | Keepers busy | Eye covered s (longest) | Stalls | Open at end (oldest s) | ms/step |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const s of sums) {
    const who = `${s.cast}${s.cast === s.pattern ? '' : ` (${s.pattern})`}`;
    if (!s.fits) { L.push(`| ${who} | ${s.dragons} | does not fit | | | | | | | | | | | | | |`); continue; }
    L.push(`| ${who} | ${s.dragons} | ${s.seedsEmpty}/${s.seeds.length} | ${fmtInt(s.emptySteps)} | ${f1(s.waitAvgS)} | ${f1(s.waitMaxS)} | ${f1(s.done)} | ${f1(s.rides)} | ${pct(s.carBusy)} | ${f1(s.landingMaxS)} | ${f1(s.bayMaxS)} | ${pct(s.keeperBusy)} | ${f1(s.coverS)} (${f1(s.coverLongestS)}) | ${s.stalls}${s.breaks ? ` +${s.breaks} inv` : ''} | ${f1(s.openAtEnd)} (${f1(s.oldestOpenS)}) | ${s.msPerStep.toFixed(3)} |`);
  }
  L.push('', `Verdicts (SERVED: no need empty on >= ${SERVED.cleanShare * 8} of 8 seeds, and jobs waiting <= ${SERVED.waitAvgS} s on average from opening to their keeper starting; C1 also wants no stall):`, '');
  for (const s of sums) L.push(`- **${s.cast}** (${s.dragons}): ${s.verdict}`);
  const notes = runs.filter((r) => r.stallNotes.length || r.breakNotes.length);
  if (notes.length) {
    L.push('', 'Stalls and invariant breaks (the first few a run):', '');
    for (const r of notes) L.push(`- ${r.cast} seed ${r.seed}: ${[...r.stallNotes, ...r.breakNotes.map((b) => `INVARIANT ${b}`)].join('; ')}`);
  }
  L.push('', 'Every run:', '');
  L.push('| Cast | Seed | Empty need-steps | Wait avg s | Wait max s | Opened | Done | Rides | Car busy | Landing max s | Bay edge max s | Keeper bay s | Rider held s | Keepers busy | Eye covered s (longest) | Stalls | Moved on | Most empty | Open at end (oldest) | ms/step |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of runs) {
    L.push(`| ${r.cast} | ${r.seed} | ${fmtInt(r.emptySteps)} | ${f1(r.waitAvgS)} | ${f1(r.waitMaxS)} | ${r.opened} | ${r.done} | ${r.rides} | ${pct(r.carBusy)} | ${f1(r.landingMaxS)} | ${f1(r.bayMaxS)} | ${f1(r.keeperBayMaxS)} | ${f1(r.riderHeldMaxS)} | ${pct(r.keeperBusy)} | ${f1(r.coverS)} (${f1(r.coverLongestS)}) | ${r.stalls}${r.breaks ? ` +${r.breaks} inv` : ''} | ${r.evictions} | ${r.mostEmpty || '-'} | ${r.openAtEnd}${r.oldestOpen ? ` (${f1(r.oldestOpenS)} s, ${r.oldestOpen})` : ''} | ${r.msPerStep.toFixed(3)} |`);
  }
  L.push('', [
    'Columns: *Seeds with a need empty*, runs with any dragon-need-step at 0 (sim.stats.emptySteps; *Empty need-steps* sums them over the seeds).',
    '*Wait*: a job\'s open-to-start wait, over the jobs started (the mean of each seed\'s average; the most on any seed); jobs not started show in *Open at end* instead (the mean count, and the oldest; a run\'s row names its dragon and need).',
    '*Most empty*: the dragon with the most need-steps at 0 in a run (the verdicts split them by stage).',
    '*Jobs done*, *Rides* and the busy shares: the mean over the seeds (*Car busy*: a rider, or a stop to go to; *Keepers busy*: keeper-steps with a job).',
    '*Landing* and *Bay edge*: the longest a dragon waited at a landing for the car, and held at the bay\'s edge (the most on any seed).',
    '*Eye covered*: sim-check section 2\'s measure, seconds of an eye under a standing body summed over every pair, the mean a run (the longest one moment on any seed).',
    '*Stalls*: S3\'s rules broken, summed over the seeds (a keeper or a dragon mid-walk standing still 10 s, the car still with work a minute, a keeper giving up); *inv*: section 2\'s invariants broken.',
    `*ms/step*: CareSim.step() alone, the mean (${head.workers > 1 ? `${head.workers} worker threads at once` : 'one worker thread'}). Wall time ${f1(head.wallS)} s.`,
  ].join(' '));
  return L.join('\n');
}

// ---------- the command line ----------

/** Seeds from `1-8`, `1,3,5` or `1-4,9`, in order, each once. */
export function parseSeeds(s: string): number[] {
  const out = new Set<number>();
  for (const part of s.split(',').map((p) => p.trim()).filter(Boolean)) {
    const m = /^(\d+)(?:-(\d+))?$/.exec(part);
    if (!m) throw new Error(`capacity: seeds "${s}": want a range, a list or both (1-8, 1,3,5, 1-4,9)`);
    const a = Number(m[1]), b = m[2] ? Number(m[2]) : a;
    if (a < 1 || b < a) throw new Error(`capacity: seeds "${part}": want 1 or more, low to high`);
    for (let k = a; k <= b; k++) out.add(k);
  }
  return [...out].sort((a, b) => a - b);
}

function parseArgs(argv: string[]) {
  const o = { casts: Object.keys(CASTS), seeds: parseSeeds('1-8'), min: 30, json: null as string | null, workers: 3 };
  for (const a of argv) {
    const m = /^--([a-z]+)=(.*)$/.exec(a);
    if (!m) throw new Error(`capacity: "${a}": the flags are --casts=a,b --seeds=1-8 --min=30 --json=path --workers=3`);
    const [, k, v] = m;
    if (k === 'casts') o.casts = v.split(',').map((c) => c.trim()).filter(Boolean);
    else if (k === 'seeds') o.seeds = parseSeeds(v);
    else if (k === 'min') { o.min = Number(v); if (!(o.min > 0)) throw new Error(`capacity: --min=${v}: want minutes of play, more than 0`); }
    else if (k === 'json') o.json = v;
    else if (k === 'workers') { o.workers = Number(v); if (!Number.isInteger(o.workers) || o.workers < 1 || o.workers > 3) throw new Error(`capacity: --workers=${v}: want 1, 2 or 3`); }
    else throw new Error(`capacity: no flag --${k} (the flags are --casts --seeds --min --json --workers)`);
  }
  if (!o.casts.length || !o.seeds.length) throw new Error('capacity: nothing to run');
  return o;
}

function revision(): string {
  const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  try {
    const rev = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim();
    return `HEAD ${rev}${dirty ? ' with uncommitted changes' : ''}`;
  } catch { return 'no git'; }
}

/** Run every task on `n` worker threads (each takes the next as it finishes one), the longest casts first. */
function pool(tasks: Task[], n: number, done: (r: Run, k: number) => void): Promise<Run[]> {
  const out: Run[] = [];
  let next = 0, finished = 0;
  return new Promise((ok, no) => {
    const workers: Worker[] = [];
    const quit = (e: Error | null) => { for (const w of workers) void w.terminate(); if (e) no(e); else ok(out); };
    for (let i = 0; i < n; i++) {
      const w = new Worker(new URL(import.meta.url), { workerData: { capacity: true } });
      workers.push(w);
      const give = () => { if (next < tasks.length) w.postMessage(tasks[next++]); };
      w.on('message', (m: { run?: Run; error?: string }) => {
        if (m.error || !m.run) { quit(new Error(m.error ?? 'capacity: a worker sent nothing')); return; }
        out.push(m.run); done(m.run, ++finished);
        if (finished === tasks.length) quit(null); else give();
      });
      w.on('error', (e) => quit(e));
      give();
    }
  });
}

async function main(): Promise<void> {
  const o = parseArgs(process.argv.slice(2));
  const t0 = performance.now();
  const casts = o.casts.map((name) => { const spec = parseCast(name); return { name, pattern: CASTS[name] ?? name, spec, ...placeCast(spec) }; });
  const tasks: Task[] = [];
  for (const c of casts) if (!c.missing) for (const seed of o.seeds) tasks.push({ cast: c.name, pattern: c.pattern, places: c.places, seed, min: o.min });
  tasks.sort((a, b) => b.places.length - a.places.length || a.seed - b.seed);
  const workers = Math.min(o.workers, Math.max(1, tasks.length));
  for (const c of casts) if (c.missing) process.stderr.write(`capacity: ${c.name} does not fit the start barn: ${c.missing}\n`);
  const runs = tasks.length ? await pool(tasks, workers, (r, k) => {
    process.stderr.write(`capacity: [${k}/${tasks.length}] ${r.cast} seed ${r.seed}: ${fmtInt(r.emptySteps)} empty need-steps, wait avg ${f1(r.waitAvgS)} s, ${r.rides} rides, ${r.msPerStep.toFixed(3)} ms/step\n`);
  }) : [];
  const order = new Map(casts.map((c, i) => [c.name, i]));
  runs.sort((a, b) => order.get(a.cast)! - order.get(b.cast)! || a.seed - b.seed);
  const sums = casts.map((c) => summarize(c.name, c.pattern, castSize(c.spec), o.seeds, runs.filter((r) => r.cast === c.name), c.missing));
  const head = { rev: revision(), min: o.min, seeds: o.seeds, wallS: (performance.now() - t0) / 1000, workers };
  process.stdout.write(`${report(sums, runs, head)}\n`);
  if (o.json) {
    fs.mkdirSync(path.dirname(path.resolve(o.json)), { recursive: true });
    fs.writeFileSync(o.json, `${JSON.stringify({ ...head, dayLen: DAY_STEPS, served: SERVED, casts: sums, runs }, null, 1)}\n`);
    process.stderr.write(`capacity: wrote ${o.json}\n`);
  }
}

// (a worker runs the tasks it is sent, one at a time; the command line runs main -- importing this file does neither)
if (!isMainThread && (workerData as { capacity?: boolean } | null)?.capacity) {
  parentPort!.on('message', (t: Task) => {
    try { parentPort!.postMessage({ run: runOne(t) }); } catch (e) { parentPort!.postMessage({ error: `capacity: ${t.cast} seed ${t.seed}: ${(e as Error).stack ?? e}` }); }
  });
} else if (isMainThread && process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { process.stderr.write(`${(e as Error).message}\n`); process.exitCode = 1; });
}
