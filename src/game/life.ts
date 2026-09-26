// Growing up and hatching (docs/BASE_DESIGN.md 7): life's half of every step (sim.ts step), after the needs
// have drained and the acts under way have run -- so a dragon whose nap or job ended this step is caught settled
// before it can set off -- and before any job opens or anyone moves. A dragon's stage lasts STAGE_DAYS game days (30:
// baby -> young -> adult -> elder), counted on the world's clock from the step it began (`stageSince`); the stage-up
// falls due then, and is applied once the dragon is SETTLED -- no act, no keeper on any of its jobs, no route left,
// standing (not turning, not waiting at a landing or the bay's edge, not in the lift's hands) -- and has ROOM TO GROW:
// no keeper stands where its new body will be, so no keeper is ever at the old stage's reach (or anywhere in the new
// body) while the rig swaps. A dragon due and settled whose room a keeper is still in -- most often the one who has
// just served it, turning for home -- HOLDS where it is (`hold`, a step at a time: it takes no goal, no keeper comes for
// it and no one moves it on) until the keeper has walked out of it; else it would set off on its next errand the step
// after being served, and seldom be settled with room. Then `stageSince` moves on by exactly the stage's length (a late
// stage-up never pushes the next one later: the stages keep in step) -- but for the elder stage, which has no stage after
// it, `stageSince` is the step it grew, so its 30 days to the garden are counted from when it really became an elder --
// the stage advances, and every per-stage thing (the drains, the reach, the
// gait, the pad, the stand spot) follows from that step on; and the dragon CHEERS where it stands, holding for its new
// stage's `happy` (gait.ts happyLen), so the view's `happy` plays through. A baby in a baby sub-slot first takes a module slot, which its next stage fits (a
// module holds one grown dragon or two babies: BASE_DESIGN 3, Slots), and walks there (goal `settle`); it grows once settled there, and
// waits in its sub-slot while none is free. An elder's next is retirement (BASE_DESIGN 3, The Garden): RETIRE_DAYS (30) game days into
// the elder stage, as soon as it may be sent somewhere new (not being met, not holding still, not in the lift's hands
// or its bay: travel.ts redirectable -- a Rush's rule; it keeps its size, so unlike a stage-up it need not stand still),
// it retires to the garden (garden.ts retire: the elder's reward, never a decline) -- counted from the step it grew into
// an elder, so a late stage-up never shortens its time as one -- unless it is the barn's last flier (lastFlier: no other
// dragon but babies left outside the garden), which stays on until another can fly a mission. An egg (sim.ts addEgg) hatches
// HATCH_DAYS game days after it was laid, as soon as a baby sub-slot is free (the Hatchery's two first -- one in front
// of no other egg, then the one nearest its nest; one elsewhere before one that would hide another's egg; else the
// nearest): a baby of its element, a new id, the next free
// name of its element's (names.ts), the egg's seed, hungry (it asks for the kitchen at once), standing up in its nest
// and walking to its sub-slot. With no sub-slot free it waits in its nest, and nothing is lost. The barn has a cap
// (BARN_CAP: the largest herd the barn was measured to serve, docs/BASE_DESIGN.md 4.7): an egg never hatches
// while the barn holds BARN_CAP dragons -- it waits in its nest, and hatches the first step there is room (an elder
// arriving in the garden frees one; growing up never changes the count) -- and on the step it falls due with the barn
// full the view is told (SimEvent `full`: "THE BARN IS FULL"). DOM-free, deterministic, by id.
import { STAGES } from '../art/dragon/stages.ts';
import type { Stage } from '../art/dragon/stages.ts';
import { STAGE_DAYS, HATCH_DAYS } from './clock.ts';
import { fitsSlot, nestX, slotBody, WORLD_W } from './layout.ts';
import { fullNeeds, moodOf } from './needs.ts';
import { nearestFree, sendTo, slotFree, bodySpan, redirectable, KEEPER_HALF } from './travel.ts';
import { happyLen } from './gait.ts';
import { hatchName } from './names.ts';
import { retire, retireDue } from './garden.ts';
import type { CareSim, Dragon, Egg } from './sim.ts';
import type { Slot } from './layout.ts';

/** A new baby's food (BASE_DESIGN 7: under QUEUE, so its first job, and its first walk after its sub-slot, is to the kitchen). */
export const HATCH_FOOD = 0.45;

/**
 * The most dragons the barn holds (BASE_DESIGN 4.7): the largest herd the repeated-room barn was measured to serve to the benchmark's
 * standard on every mix tried (every 11- and 12-dragon mix; 13 serves most but not all, 14 none: the barn's 13 grown
 * modules are the cliff, and babies need a module free of grown dragons), a hard cap one dragon short of that cliff.
 * An egg never hatches while the barn holds this many: it waits in its nest until a dragon leaves for the garden. A
 * mission still brings its egg home to a full barn (BASE_DESIGN 4.7, 5.6): the chooser reads the room left (barnRoom)
 * and says BARN FULL: THE EGG WILL WAIT, and the egg waits in its nest.
 */
export const BARN_CAP = 12;
/**
 * The dragons the barn counts against its cap: every one not living in the garden -- the barn's, one away on a mission
 * (its place is kept for it: BASE_DESIGN 4.7), and an elder still walking out to the garden.
 */
export function barnCount(sim: CareSim): number { let n = 0; for (const d of sim.dragons) if (d.place !== 'garden') n++; return n; }
/** Whether the barn is full: it holds BARN_CAP dragons (or more, only ever because a preset put them there). */
export function barnFull(sim: CareSim): boolean { return barnCount(sim) >= BARN_CAP; }
/**
 * How many more dragons the barn can take before it is full: the cap less barnCount (a team away on a mission and an
 * elder still walking out to the garden among them); 0 at the cap, or over it (a preset may force more). The Map Room's
 * chooser reads it (maptable.ts eggNotice).
 */
export function barnRoom(sim: CareSim): number { return Math.max(0, BARN_CAP - barnCount(sim)); }

/**
 * Whether dragon d is the barn's last flier: no other dragon that could go on a mission -- any but a baby (missions.ts
 * dragonReason: the young go on the easy roads) -- is left outside the garden, nor on its way there. An elder that is
 * stays on in the barn past its 30 days as an elder, until another can fly: eggs come only from missions, so a barn
 * with nobody left to fly one would stay empty for good.
 */
export function lastFlier(sim: CareSim, d: Dragon): boolean {
  return !sim.dragons.some((o) => o !== d && o.stage !== 'baby' && o.place !== 'garden' && o.goal !== 'retire');
}
/** Whether an elder is past its time to retire and staying on as the barn's last flier (the view says so once, and its card). */
export function staysOn(sim: CareSim, d: Dragon): boolean {
  return d.stage === 'elder' && d.place === 'barn' && d.goal !== 'retire' && sim.clock >= retireDue(sim, d) && lastFlier(sim, d);
}

/** The stage after `st` (null: the elder's, which retires to the garden instead: garden.ts). */
export function nextStage(st: Stage): Stage | null { return STAGES[STAGES.indexOf(st) + 1] ?? null; }

/** The clock a dragon's stage-up falls due at: its stage's start plus STAGE_DAYS game days. */
export function stageDue(sim: CareSim, d: Dragon): number { return d.stageSince + STAGE_DAYS * sim.dayLen; }

/**
 * Whether a dragon is settled (BASE_DESIGN 7): in the barn (not a garden resident, nor an elder on its way there, nor with a
 * mission's team: missions.ts), no act
 * (a sleeper has one), no keeper on any of its jobs (on the way, waiting at the stand spot or at work), no route left,
 * standing still (not turning, not waiting at a landing or held at the bay's edge), and not the lift's rider.
 */
export function settled(sim: CareSim, d: Dragon): boolean {
  return d.place === 'barn' && d.goal !== 'retire' && d.goal !== 'muster' && !d.act && d.asleep === 0 && !d.legs.length && d.move === 'still' && d.turn < 0 && sim.lift.rider !== d.id
    && !sim.jobs.some((j) => j.dragon === d && j.keeper);
}

/**
 * The keeper standing where a dragon's body will be at `stage` -- its new body, the way it faces, on its floor, a
 * keeper's half-width either side -- or null: room to grow. (The keeper who has just served it is still at the old
 * stage's stand spot for a moment as they turn for home; the new body may reach over it.) A keeper held by hand never
 * counts: they may stand there as long as the player likes.
 */
export function inTheWayOfGrowing(sim: CareSim, d: Dragon, stage: Stage): string | null {
  const [a, b] = bodySpan(stage, d.facing, d.x);
  // (a keeper held by hand is left out: the player may park them anywhere, for as long as they like, and a dragon due
  // to grow must not wait on that -- it grows beside them, drawn in front as always: BASE_DESIGN 4.10)
  const k = sim.keepers.find((q) => !q.manual && !q.climbing && q.f === d.f && q.x + KEEPER_HALF > a && q.x - KEEPER_HALF < b);
  return k ? k.name : null;
}

/**
 * A dragon's stage-up, if it is due and settled: in a slot its next stage fits, it grows now if it has room -- and
 * holds for its cheer -- or holds a step for a keeper to walk out of its room; in a baby sub-slot, it first takes the
 * nearest free module slot (in any dragon room: the Hatchery has none) and walks there, to grow once settled in it --
 * or, none free, waits where it is.
 */
function growUp(sim: CareSim, d: Dragon): void {
  const next = nextStage(d.stage), due = stageDue(sim, d);
  // (an elder's next is the garden: 30 days into its stage, as soon as it may be sent anew -- not being met, not holding
  // still, not in the lift's hands or the bay -- wherever it is: it does not change size, so no net or line minds
  // -- unless it is the barn's last flier: it stays on until another dragon can fly a mission)
  if (!next) { if (sim.clock >= retireDue(sim, d) && redirectable(sim, d) && !lastFlier(sim, d)) retire(sim, d); return; }
  if (sim.clock < due || !settled(sim, d)) return;
  if (d.slot && !fitsSlot(d.slot, next)) {
    const to = nearestFree(sim, d, next, ['hatchery']);
    if (to) { d.goal = 'settle'; d.goalJob = null; sendTo(sim, d, to); }
    return;
  }
  if (inTheWayOfGrowing(sim, d, next)) { d.hold = Math.max(d.hold, 1); return; }
  sim.stats.growDelayMax = Math.max(sim.stats.growDelayMax, sim.clock - due);
  // (the next stage counts from the day this one fell due, so the stages keep in step -- but the elder stage, with no
  // stage after it to keep in step with, begins the step the dragon grows: its 30 days to the garden are all its own)
  d.stageSince = next === 'elder' ? sim.clock : due;
  d.stage = next;
  d.hold = happyLen(d.element, next);
  if (d.goal === 'settle') d.goal = null;
  sim.events.push({ kind: 'grow', dragon: d.id, stage: next });
}

/**
 * An egg due to hatch hatches if the barn has room (under BARN_CAP) and a baby sub-slot is free for its baby -- the
 * Hatchery's first: one in front of no other egg, then the one nearest its nest (so a hatchling stands in front of its
 * own nest, now empty, or of an empty one; ties to the lower); if each free one would hide another's egg, the nearest
 * free sub-slot out of the Hatchery (by its route: a hatchling never hides an egg while one is free anywhere) -- else
 * the nearest by its route from the nest: the baby stands up in the nest, facing west, and walks to
 * it; the egg is gone. False: it waits (on the very step it falls due with the barn full, the view is told: `full`).
 */
function hatch(sim: CareSim, e: Egg): boolean {
  const room = sim.rooms.find((r) => r.kind === 'hatchery');
  if (!room || sim.clock - e.laid < HATCH_DAYS * sim.dayLen) return false;
  if (barnFull(sim)) {
    if (sim.clock - e.laid === HATCH_DAYS * sim.dayLen) sim.events.push({ kind: 'full', egg: e.id });
    return false;
  }
  const needs = fullNeeds();
  needs.food = HATCH_FOOD;
  const baby: Dragon = { id: sim.nextDragonId, name: hatchName(sim, e.element), element: e.element, stage: 'baby', seed: e.seed, slot: null, goal: null, goalJob: null,
    f: room.floor, x: nestX(room, e.nest), facing: -1, legs: [], move: 'still', gaitT: 0, gaitS: 1, walkSeq: 0, turn: -1, waited: 0,
    needs, mood: moodOf(e.element, needs), act: null, asleep: 0, stageSince: sim.clock, hold: 0, place: 'barn', home: null, garden: null };
  // (each of the Hatchery's sub-slots stands in front of a nest: a baby there hides that nest's egg, so one in front of
  // no other egg comes first -- the nest-1 egg's hatchling does not stand before a newer egg in nest 0 -- then the one
  // nearest its own nest)
  const hides = (s: Slot): boolean => {
    const [a, b] = slotBody(s, 'baby');
    return sim.eggs.some((o) => o !== e && nestX(room, o.nest) >= a && nestX(room, o.nest) <= b);
  };
  let slot: Slot | null = null, best = Infinity;
  for (const s of room.slots) {
    if (!slotFree(sim, baby, s)) continue;
    const cost = (hides(s) ? WORLD_W : 0) + Math.abs(s.x - baby.x);
    if (cost < best) { best = cost; slot = s; }
  }
  // (every free Hatchery sub-slot hiding another egg -- under the hayloft's slope the second stands in front of two
  // nests, BASE_DESIGN 3 -- the nearest free sub-slot elsewhere comes first, if there is one: no hatchling hides an egg)
  if (slot && hides(slot)) slot = nearestFree(sim, baby, 'baby', ['hatchery']) ?? slot;
  slot ??= nearestFree(sim, baby);
  if (!slot) return false;
  sim.nextDragonId++;
  sim.dragons.push(baby);
  sendTo(sim, baby, slot);
  sim.eggs.splice(sim.eggs.indexOf(e), 1);
  sim.events.push({ kind: 'hatch', dragon: baby.id, egg: e.id });
  sim.use('hatchery', room);
  return true;
}

/**
 * Life's half of a step: every hold counts down, every dragon due and settled grows up (by id) -- or holds for room --
 * or, an elder due, retires to the garden; then every egg due hatches (by id) while the barn has room and a sub-slot is
 * free.
 */
export function stepLife(sim: CareSim): void {
  for (const d of sim.dragons) if (d.hold > 0) d.hold--;
  for (const d of sim.dragons) growUp(sim, d);
  for (const e of sim.eggs.slice()) hatch(sim, e);
}
