// The elder garden (docs/BASE_DESIGN.md 3 "The Garden"; plan S6, D3): the retired elders' home, outside, east of the
// right tower through the Garden Gate. Retiring is the elder's reward (B8, ART_BIBLE D21): a place, not a stage, and
// nothing in it reads as decline. DOM-free and deterministic: every loop by id, every draw a stateless rngAt(seed,
// TAG.GARDEN, dragon, tick).
//
// Retirement (life.ts calls retire): 30 game days into the elder stage, as soon as it is not being met and not in the
// lift's hands, an elder leaves the barn -- its jobs are dropped, its slot is let go, sleep, play and bath are held full
// from then on -- and walks (riding the lift down if it must) through the Garden Gate to the middle of its plot: the lowest plot no one has, the garden growing a
// plot if it has none spare (plots = max(2, residents + retiring): CareSim.setPlots). There it is a resident.
//
// A resident (stepGarden, run after the keepers in every step) has only food and love, draining at a quarter of an
// elder's rate (needs.ts GARDEN_RATE), and lives by a small rhythm: it NAPS (1800 to 3600 steps: 30 to 60 s of play at
// 1x, 4 to 8 game hours of the real day), SITS (600 to 1200 steps: 10 to 20 s, about 1.3 to 2.7 game hours), and from a
// sit either STROLLS -- walked by its own walk's root motion (gait.ts), to a resting place among the
// plots beside its own -- or naps again. At night (the one thing in the simulation that reads the day's phase, plan G8:
// clock.ts readClock) it only naps: a sit ends at nightfall, a nap that ends at night starts another, and a stroll is
// never begun that would not end before 20:00. When a job opens it WAITS where it rests (one strolling walks on to its
// resting place first); its keeper comes out to it -- the one exception to "a need is met in its own room" (#7): the
// garden is the residents' room, and the keepers come to them -- stands in front of its snout, and meets the need there;
// then it sits (or naps, at night).
//
// Where a resident rests is kept apart from the others (ART_BIBLE 1.4): every resident's resting place (where it
// stands, or where its stroll ends) and every plot waiting for a newcomer (a retiree's own, and an empty one's middle)
// are pairwise apart -- no body over another's eye, whichever is drawn in front, and no two bodies overlapping more than
// REST_OVERLAP px (a tail's tip behind another's; never one lying across another) -- so a newcomer always finds its
// plot's middle free, and a stroll is only ever to such a place (else it naps). Passing another on the way is a
// moment's overlap, as in the barn.
import { readClock, hourSteps, PHASE_HOURS, RETIRE_DAYS } from './clock.ts';
import { GARDEN_MIN_PLOTS, GARDEN_PLOT, REACH, plotX, plotMid, gardenSpan, DRAGON_PAD } from './layout.ts';
import type { Spot } from './layout.ts';
import { NEEDS, GARDEN_NEEDS, moodOf } from './needs.ts';
import { bodySpan, eyeSpan, routeTo, TURN_STEPS } from './travel.ts';
import { gaitOf, moveAt } from './gait.ts';
import { rngAt, TAG } from './rand.ts';
import type { RngInstance } from '../lib/engine/rng.ts';
import type { CareSim, Dragon, GardenMode, Job } from './sim.ts';

export { plotX, plotMid };

/**
 * A nap's and a sit's length, steps (30-60 s and 10-20 s of play at 1x: 4-8 and about 1.3-2.7 game hours of the real
 * day's 450-step hour), and a sit's odds of ending in a stroll (else a nap).
 */
export const NAP: readonly [number, number] = [1800, 3600], SIT: readonly [number, number] = [600, 1200];
export const STROLL_P = 0.6;
/** Draws a stroll gets to find a clear resting place, the least it walks (px), and how long before 20:00 it must end (steps). */
const STROLL_TRIES = 8, STROLL_MIN = 24, NIGHT_MARGIN = 60;

/** Whether it is night by the clock (20:00-05:00): a resident's time to nap (the simulation's one reader of the phase, plan G8). */
export function isNight(sim: CareSim): boolean { return readClock(sim.clock, sim.dayLen).phase === 'night'; }

/** The clock an elder's retirement falls due at: its elder stage's start (the step it grew into an elder: life.ts) plus RETIRE_DAYS game days. */
export function retireDue(sim: CareSim, d: Dragon): number { return d.stageSince + RETIRE_DAYS * sim.dayLen; }

/** The garden's residents, by id. */
export function residents(sim: CareSim): Dragon[] { return sim.dragons.filter((d) => d.place === 'garden'); }
/** The elders on their way to the garden (retired, not yet arrived), by id. */
export function retiring(sim: CareSim): Dragon[] { return sim.dragons.filter((d) => d.goal === 'retire'); }
/** The plots the garden needs: one a resident or a retiree, and never fewer than GARDEN_MIN_PLOTS. */
export function plotsNeeded(sim: CareSim): number { return Math.max(GARDEN_MIN_PLOTS, residents(sim).length + retiring(sim).length); }

/** The garden's walkable stretch for an elder (a resident's body kept clear of the tower's wall and the world's end). */
export function residentSpan(sim: CareSim): readonly [number, number] { return gardenSpan(sim.worldW, DRAGON_PAD.elder); }

/** Where a keeper stands to meet a resident: in front of its snout (an elder's reach), inside the garden. */
export function standAtResident(sim: CareSim, d: Dragon): Spot {
  const [a, b] = gardenSpan(sim.worldW, null);
  return { f: 0, x: Math.max(a, Math.min(b, d.x + d.facing * REACH.elder)) };
}

/** A resting place: an elder at x facing one way (a resident at rest, where a stroll ends, or a plot kept for a newcomer). */
export interface Rest { x: number; facing: 1 | -1; who: Dragon | null; plot: number | null }
/** Whether two elders resting at a and b are clear: neither's body over the other's eye, whichever is drawn in front. */
export function restsClear(a: Rest, b: Rest): boolean {
  const meet = (p: readonly [number, number], q: readonly [number, number]) => p[0] <= q[1] && p[1] >= q[0];
  return !meet(bodySpan('elder', a.facing, a.x), eyeSpan('elder', b.facing, b.x)) && !meet(bodySpan('elder', b.facing, b.x), eyeSpan('elder', a.facing, a.x));
}
/**
 * The most two resting elders' bodies may overlap, px: a tail's tip behind another's, never one lying across another.
 * (Eye-clear alone still lets two lie back to back with their tails and haunches one over the other, up to 97 px of an
 * elder's 127: the garden gives each its own plot, and a full one looked like a heap.)
 */
export const REST_OVERLAP = 20;
/** How far two elders resting at a and b overlap, px (0 or less: apart). */
export function restOverlap(a: Rest, b: Rest): number {
  const p = bodySpan('elder', a.facing, a.x), q = bodySpan('elder', b.facing, b.x);
  return Math.min(p[1], q[1]) - Math.max(p[0], q[0]);
}
/** Whether two elders resting at a and b are clear of each other's eyes and roomy (bodies overlapping REST_OVERLAP px at most). */
export function restsApart(a: Rest, b: Rest): boolean { return restsClear(a, b) && restOverlap(a, b) <= REST_OVERLAP; }
/**
 * Every resting place the garden keeps: each resident's (where it stands, or where its stroll will end, facing the way
 * it walks), each retiree's (its plot's middle, facing east, the way it walks in), and each plot no one has (its
 * middle, for the next newcomer).
 */
export function rests(sim: CareSim): Rest[] {
  const out: Rest[] = [], held = new Set<number>();
  for (const d of sim.dragons) {
    if (d.place === 'garden' && d.garden) {
      const g = d.garden, walks = g.mode === 'stroll';
      out.push({ x: walks ? g.tx : d.x, facing: walks ? ((Math.sign(g.tx - d.x) || d.facing) as 1 | -1) : d.facing, who: d, plot: null });
      if (d.home != null) held.add(d.home);
    } else if (d.goal === 'retire' && d.home != null) { out.push({ x: plotMid(d.home), facing: 1, who: d, plot: d.home }); held.add(d.home); }
  }
  for (let i = 0; i < sim.garden.plots; i++) if (!held.has(i)) out.push({ x: plotMid(i), facing: 1, who: null, plot: i });
  return out;
}

/** The draws for one dragon at this step. */
const draws = (sim: CareSim, d: Dragon): RngInstance => rngAt(sim.seed, TAG.GARDEN, d.id, sim.tick);

/** Steps a stroll from x to tx takes (a paper turn first if it faces away, then its walk by its gait: gait.ts). */
export function strollSteps(d: Dragon, tx: number): number {
  const dir = Math.sign(tx - d.x), g = gaitOf(d.element, 'elder'), dist = Math.abs(tx - d.x);
  let t = 0, went = 0;
  while (went < dist) went += moveAt(g, ++t);
  return t + (dir !== 0 && dir !== d.facing ? TURN_STEPS : 0);
}

/** The clock at the coming nightfall (20:00 today; the simulation is past 05:00 by day). */
function nightfall(sim: CareSim): number {
  const day = Math.floor(sim.clock / sim.dayLen) * sim.dayLen;
  return day + PHASE_HOURS.night * hourSteps(sim.dayLen);
}

/**
 * Where a resident strolls to: a resting place drawn among its own plot and the two beside it, inside the garden,
 * at least STROLL_MIN px away, apart from every other resting place the garden keeps (restsApart: clear of their eyes,
 * and roomy), and reached before nightfall (a margin kept); up to STROLL_TRIES draws, else null (it naps instead).
 */
function strollTo(sim: CareSim, d: Dragon, r: RngInstance): number | null {
  const [s0, s1] = residentSpan(sim), [p0, p1] = plotX(d.home ?? 0);
  const lo = Math.max(s0, p0 - GARDEN_PLOT), hi = Math.min(s1, p1 + GARDEN_PLOT);
  const others = rests(sim).filter((o) => o.who !== d), dark = nightfall(sim);
  for (let i = 0; i < STROLL_TRIES; i++) {
    const tx = Math.round(lo + r.next() * (hi - lo));
    if (Math.abs(tx - d.x) < STROLL_MIN) continue;
    const me: Rest = { x: tx, facing: tx > d.x ? 1 : -1, who: d, plot: null };
    if (!others.every((o) => restsApart(me, o))) continue;
    if (sim.clock + strollSteps(d, tx) + NIGHT_MARGIN > dark) continue;
    return tx;
  }
  return null;
}

/** A resident takes up a mode: a nap or a sit for its drawn length, a wait, or a stroll to tx (routed now). */
function enter(sim: CareSim, d: Dragon, mode: GardenMode, r: RngInstance | null = null, tx = d.x): void {
  const g = d.garden!;
  g.mode = mode; g.tx = mode === 'stroll' ? tx : d.x; g.until = -1;
  if (mode === 'nap' || mode === 'sit') { const [a, b] = mode === 'nap' ? NAP : SIT; g.until = sim.tick + (r ?? draws(sim, d)).int(a, b); }
  if (mode === 'stroll') d.legs = [{ f: 0, x: tx }];
}

/**
 * Make a dragon a resident on plot `plot` where it stands (an arrival), or put it there (a preset: `place` true, at
 * the plot's middle facing east): out of the barn, its needs as a resident's, sitting -- or napping, at night -- and
 * the garden grown to hold it.
 */
export function settleInGarden(sim: CareSim, d: Dragon, plot: number, place = false): void {
  for (const k of sim.keepers) if (k.job && k.job.dragon === d) sim.drop(k);
  sim.jobs = sim.jobs.filter((j) => j.dragon !== d);
  d.place = 'garden'; d.home = plot; d.slot = null; d.goal = null; d.goalJob = null;
  if (place) { d.f = 0; d.x = plotMid(plot); d.facing = 1; d.legs = []; d.move = 'still'; d.gaitT = 0; d.turn = -1; d.waited = 0; d.act = null; d.asleep = 0; d.hold = 0; }
  for (const k of NEEDS) if (!GARDEN_NEEDS.includes(k)) d.needs[k] = 1;
  d.mood = moodOf(d.element, d.needs);
  d.garden = { mode: 'sit', until: -1, tx: d.x };
  enter(sim, d, isNight(sim) ? 'nap' : 'sit');
  sim.setPlots(Math.max(sim.garden.plots, plotsNeeded(sim), plot + 1));
}

/**
 * An elder retires (life.ts, once due, from wherever it may be sent anew: travel.ts redirectable -- not being met, not
 * in the lift's hands or the bay): its jobs are dropped (a keeper coming for one gives it back and goes home: not a
 * pre-emption), its slot let go (and a call it waited on, unless it rides from that landing still), its sleep, play and
 * bath held full; it takes the lowest plot no one has (the garden growing to hold it) and sets off for that plot's
 * middle, riding the lift down if it must.
 */
export function retire(sim: CareSim, d: Dragon): void {
  sim.stats.retireDelayMax = Math.max(sim.stats.retireDelayMax, sim.clock - retireDue(sim, d));
  for (const k of sim.keepers) if (k.job && k.job.dragon === d) sim.drop(k);
  sim.jobs = sim.jobs.filter((j) => j.dragon !== d);
  const held = new Set([...residents(sim), ...retiring(sim)].map((o) => o.home));
  let plot = 0;
  while (held.has(plot)) plot++;
  d.slot = null; d.goal = 'retire'; d.goalJob = null; d.home = plot;
  for (const k of NEEDS) if (!GARDEN_NEEDS.includes(k)) d.needs[k] = 1;
  d.mood = moodOf(d.element, d.needs);
  sim.setPlots(Math.max(sim.garden.plots, plotsNeeded(sim)));
  routeTo(sim, d, { f: 0, x: plotMid(plot) });
  sim.events.push({ kind: 'retire', dragon: d.id });
}

/**
 * The garden's half of a step (after the keepers): a retiree standing at its plot's middle becomes a resident (#11: the
 * garden is used; the view says "ASH MOVED TO THE GARDEN"); then every resident, by id, keeps its rhythm -- waits while
 * it has a job open, and is met; naps, sits and strolls; naps only, at night.
 */
export function stepGarden(sim: CareSim): void {
  for (const d of sim.dragons) {
    if (d.goal !== 'retire' || d.home == null || d.legs.length || d.move !== 'still' || d.turn >= 0 || d.f !== 0 || d.x !== plotMid(d.home)) continue;
    settleInGarden(sim, d, d.home);
    sim.use('garden');
    sim.events.push({ kind: 'garden', dragon: d.id, plot: d.home! });
  }
  let night: boolean | null = null;
  const dark = () => (night ??= isNight(sim));
  for (const d of sim.dragons) {
    const g = d.garden;
    if (d.place !== 'garden' || !g) continue;
    // (being met: it waits on, where it is)
    if (d.act) { g.mode = 'wait'; continue; }
    // (the job it waits for: the one a keeper is on, else its most pressing)
    let job: Job | null = null;
    for (const j of sim.jobs) if (j.dragon === d && (!job || (job.keeper ? false : !!j.keeper || sim.compare(j, job) < 0))) job = j;
    if (g.mode === 'stroll') {
      // (strolling on to its resting place, whatever opens meanwhile: it is kept clear of the others' eyes)
      if (d.legs.length || d.move !== 'still' || d.turn >= 0) continue;
      if (job) { enter(sim, d, 'wait'); d.goalJob = job.id; } else enter(sim, d, dark() ? 'nap' : 'sit');
      continue;
    }
    if (job) {
      // a job open: it wakes, or stops sitting, and waits for its keeper (the one on it, else its most pressing)
      if (g.mode !== 'wait') enter(sim, d, 'wait');
      d.goalJob = job.id;
      continue;
    }
    // (its last job done: it sits -- or naps, at night)
    if (g.mode === 'wait') { d.goalJob = null; enter(sim, d, dark() ? 'nap' : 'sit'); continue; }
    if (g.mode === 'sit' && dark()) { enter(sim, d, 'nap'); continue; }
    if (sim.tick < g.until) continue;
    if (g.mode === 'nap') { enter(sim, d, dark() ? 'nap' : 'sit'); continue; }
    // a sit ends, by day: a stroll (STROLL_P) to a clear resting place it reaches before nightfall, else a nap
    const r = draws(sim, d);
    const tx = r.next() < STROLL_P ? strollTo(sim, d, r) : null;
    if (tx != null) enter(sim, d, 'stroll', r, tx); else enter(sim, d, 'nap', r);
  }
}
