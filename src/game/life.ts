// Growing up and hatching (docs/BASE_DESIGN.md 7; plan S5): the first thing in every step (sim.ts step). A dragon's
// stage lasts STAGE_DAYS game days (30: baby -> young -> adult -> elder), counted on the world's clock from the step it
// began (`stageSince`); the stage-up falls due then, and is applied once the dragon is SETTLED -- no act, no keeper on
// any of its jobs, no route left, standing (not turning, not waiting at a landing or the bay's edge, not in the lift's
// hands) -- so its keeper never stands at the old reach while the rig swaps. Then `stageSince` moves on by exactly the
// stage's length (a late stage-up never shortens the next stage), the stage advances, and every per-stage thing (the
// drains, the reach, the gait, the pad, the stand spot) follows from that step on. A baby in a baby sub-slot first
// takes a module slot, which its next stage fits (a module holds one grown dragon or two babies: 3.3), and walks there
// (goal `settle`); it grows once settled there, and waits in its sub-slot while none is free. An elder's next is
// retirement (S6). An egg (sim.ts addEgg) hatches HATCH_DAYS game days after it was laid, as soon as a baby sub-slot is
// free (the Hatchery's two first; else the nearest): a baby of its element, a new id, the next free name of its
// element's (names.ts), the egg's seed, hungry (it asks for the kitchen at once), standing up in its nest and walking
// to its sub-slot. With no sub-slot free it waits in its nest, and nothing is lost. DOM-free, deterministic, by id.
import { STAGES } from '../art/dragon/stages.ts';
import type { Stage } from '../art/dragon/stages.ts';
import { STAGE_DAYS, HATCH_DAYS } from './clock.ts';
import { fitsSlot, nestX } from './layout.ts';
import { fullNeeds, moodOf } from './needs.ts';
import { freeSlot, nearestFree, sendTo } from './travel.ts';
import { hatchName } from './names.ts';
import type { CareSim, Dragon, Egg } from './sim.ts';

/** A new baby's food (plan S5: under QUEUE, so its first job, and its first walk after its sub-slot, is to the kitchen). */
export const HATCH_FOOD = 0.45;

/** The stage after `st` (null: the elder's, which retires instead: S6). */
export function nextStage(st: Stage): Stage | null { return STAGES[STAGES.indexOf(st) + 1] ?? null; }

/** The clock a dragon's stage-up falls due at: its stage's start plus STAGE_DAYS game days. */
export function stageDue(sim: CareSim, d: Dragon): number { return d.stageSince + STAGE_DAYS * sim.dayLen; }

/**
 * Whether a dragon is settled (plan 3.5): no act (a sleeper has one), no keeper on any of its jobs (on the way, waiting
 * at the stand spot or at work), no route left, standing still (not turning, not waiting at a landing or held at the
 * bay's edge), and not the lift's rider. (Every dragon is in the barn until S6's garden and S8's trips.)
 */
export function settled(sim: CareSim, d: Dragon): boolean {
  return !d.act && d.asleep === 0 && !d.legs.length && d.move === 'still' && d.turn < 0 && sim.lift.rider !== d.id
    && !sim.jobs.some((j) => j.dragon === d && j.keeper);
}

/**
 * A dragon's stage-up, if it is due and the dragon settled: in a slot its next stage fits, it grows now; in a baby
 * sub-slot, it first takes the nearest free module slot (in any dragon room: the Hatchery has none) and walks there,
 * to grow once settled in it -- or, none free, waits where it is.
 */
function growUp(sim: CareSim, d: Dragon): void {
  const next = nextStage(d.stage), due = stageDue(sim, d);
  if (!next || sim.clock < due || !settled(sim, d)) return;
  if (d.slot && !fitsSlot(d.slot, next)) {
    const to = nearestFree(sim, d, next, ['hatchery']);
    if (to) { d.goal = 'settle'; d.goalJob = null; sendTo(sim, d, to); }
    return;
  }
  sim.stats.growDelayMax = Math.max(sim.stats.growDelayMax, sim.clock - due);
  d.stageSince = due;
  d.stage = next;
  if (d.goal === 'settle') d.goal = null;
  sim.events.push({ kind: 'grow', dragon: d.id, stage: next });
}

/**
 * An egg due to hatch hatches if a baby sub-slot is free for its baby (the Hatchery's first, else the nearest by its
 * route from the nest): the baby stands up in the nest, facing west, and walks to it; the egg is gone. False: it waits.
 */
function hatch(sim: CareSim, e: Egg): boolean {
  const room = sim.rooms.find((r) => r.kind === 'hatchery');
  if (!room || sim.clock - e.laid < HATCH_DAYS * sim.dayLen) return false;
  const needs = fullNeeds();
  needs.food = HATCH_FOOD;
  const baby: Dragon = { id: sim.nextDragonId, name: hatchName(sim, e.element), element: e.element, stage: 'baby', seed: e.seed, slot: null, goal: null, goalJob: null,
    f: room.floor, x: nestX(room, e.nest), facing: -1, legs: [], move: 'still', gaitT: 0, walkSeq: 0, turn: -1, waited: 0,
    needs, mood: moodOf(e.element, needs), act: null, asleep: 0, stageSince: sim.clock };
  const slot = freeSlot(sim, baby, room) ?? nearestFree(sim, baby);
  if (!slot) return false;
  sim.nextDragonId++;
  sim.dragons.push(baby);
  sendTo(sim, baby, slot);
  sim.eggs.splice(sim.eggs.indexOf(e), 1);
  sim.events.push({ kind: 'hatch', dragon: baby.id, egg: e.id });
  sim.use('hatchery');
  return true;
}

/** Life's half of a step: every dragon due and settled grows up (by id), then every egg due hatches (by id) while a sub-slot is free. */
export function stepLife(sim: CareSim): void {
  for (const d of sim.dragons) growUp(sim, d);
  for (const e of sim.eggs.slice()) hatch(sim, e);
}
