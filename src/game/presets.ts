// Starts built in code (view=base&preset=<name>): a world other than the new game's, for views and checks that need
// what a new game has not got yet -- every stage at once, a dragon about to grow up, eggs in the nests (one about to
// hatch), every baby sub-slot taken, and later (each slice adds its own) a team away. A preset is always code, never a
// save and never hundreds of thousands of steps, so a frozen view of it (t=) is as quick and as deterministic as the
// new game's.
import { CareSim } from './sim.ts';
import type { SimOptions } from './sim.ts';
import { STAGE_DAYS, HATCH_DAYS } from './clock.ts';
import { NEEDS, hasNeed, moodOf } from './needs.ts';
import { NAMES } from './names.ts';
import type { DragonElement } from '../art/dragon/palettes.ts';
import { START_ROOMS, START_DRAGONS, START_KEEPERS } from './start.ts';
import type { DragonPlace, KeeperPlace } from './start.ts';
import type { RoomPlace } from './layout.ts';

/** What a world is built from: its rooms, dragons and keepers, its options, and a last touch once it's built. */
export interface StartSpec {
  rooms: readonly RoomPlace[];
  dragons: readonly DragonPlace[];
  keepers: readonly KeeperPlace[];
  /** The world's options (the view's seed wins over any seed given here). */
  opts?: SimOptions;
  /** Run on the built world before its first step (a preset that sets needs, jobs or clocks by hand). */
  after?: (sim: CareSim) => void;
}

/**
 * The base's first cast: twelve dragons, every element and every stage among them (the greybox mockups', docs/base/),
 * each in a slot: the grown ones in their need rooms' module slots, the babies in sub-slots (a module holds one grown
 * dragon or two babies), PEBBLE in the hatchery. The new game starts with seven newly adult dragons instead (start.ts, #9).
 */
export const AGES_DRAGONS: readonly DragonPlace[] = [
  { name: 'EMBER', element: 'fire', stage: 'adult', seed: 11, slot: { room: 'kitchen', i: 0 } },
  { name: 'CINDER', element: 'fire', stage: 'baby', seed: 28, slot: { room: 'kitchen', i: 5 } },
  { name: 'PEBBLE', element: 'rock', stage: 'baby', seed: 62, slot: { room: 'hatchery', i: 1 } },
  { name: 'RIPPLE', element: 'water', stage: 'adult', seed: 79, slot: { room: 'bath', i: 0 } },
  { name: 'ZAP', element: 'lightning', stage: 'young', seed: 113, slot: { room: 'romp', i: 0 } },
  { name: 'BURR', element: 'spike', stage: 'baby', seed: 45, slot: { room: 'romp', i: 5 } },
  { name: 'SPLASH', element: 'water', stage: 'young', seed: 147, slot: { room: 'bath', i: 1 } },
  { name: 'BRAMBLE', element: 'spike', stage: 'adult', seed: 164, slot: { room: 'groom', i: 0 } },
  { name: 'WICK', element: 'dusk', stage: 'adult', seed: 181, slot: { room: 'dorm', i: 0 } },
  { name: 'ASH', element: 'fire', stage: 'elder', seed: 198, slot: { room: 'dorm', i: 1 } },
  { name: 'COBBLE', element: 'rock', stage: 'elder', seed: 215, slot: { room: 'groom', i: 1 } },
  { name: 'ECHO', element: 'slinkwing', stage: 'adult', seed: 266, slot: { room: 'groom', i: 2 } },
];

/** The new game: the start's rooms, its seven young adults and the four keepers. */
function newGame(): StartSpec { return { rooms: START_ROOMS, dragons: START_DRAGONS, keepers: START_KEEPERS }; }

/** Steps from the world's first step until `growup`'s EMBER is due to grow up, and until `hatch`'s egg is due. */
export const GROWUP_IN = 30, HATCH_IN = 60;
/** The `eggs` preset's three eggs, nest by nest: each element and how far on it is (0..1 of its HATCH_DAYS). */
export const EGGS_PRESET: readonly { element: DragonElement; progress: number }[] = [
  { element: 'rock', progress: 0 }, { element: 'dusk', progress: 0.55 }, { element: 'water', progress: 0.9 },
];
/** An egg's steps in the nest before it hatches. */
const hatchLen = (sim: CareSim) => HATCH_DAYS * sim.dayLen;

/**
 * Every baby sub-slot the start leaves free, taken by a baby (a module holds one grown dragon or two babies: the start's
 * seven adults hold seven modules, and the other five -- the kitchen's and the romp room's second, the bathhouse's and
 * the lamp dorm's second, the hatchery -- two babies each), each of an element in turn with its element's first names.
 */
const FULL_BABIES: readonly DragonPlace[] = (() => {
  const where: [DragonPlace['slot']['room'], number][] = [['kitchen', 4], ['kitchen', 5], ['bath', 4], ['bath', 5], ['hatchery', 0], ['hatchery', 1], ['romp', 4], ['romp', 5], ['dorm', 4], ['dorm', 5]];
  const els: readonly DragonElement[] = ['fire', 'spike', 'rock', 'lightning', 'water', 'slinkwing', 'dusk'];
  return where.map(([room, i], n) => { const el = els[n % els.length]; return { name: NAMES[el][Math.floor(n / els.length)], element: el, stage: 'baby', seed: 600 + n, slot: { room, i } }; });
})();

/** The presets by name (view=base&preset=<name>). */
export const PRESETS: Readonly<Record<string, () => StartSpec>> = Object.freeze({
  /** Every stage at once: the base's first twelve-dragon cast. */
  ages: () => ({ rooms: START_ROOMS, dragons: AGES_DRAGONS, keepers: START_KEEPERS }),
  /**
   * The new game with EMBER due to grow up (adult to elder) GROWUP_IN steps in, every need of its full, so it is settled
   * then (no job, no keeper coming): the grow-up (the flash, `happy`, the toast) at step 30.
   */
  growup: () => ({ ...newGame(), after: (sim) => {
    const d = sim.dragons.find((q) => q.name === 'EMBER')!;
    d.stageSince = sim.clock + GROWUP_IN - STAGE_DAYS * sim.dayLen;
    for (const k of NEEDS) if (hasNeed(d.element, k)) d.needs[k] = 1;
    d.mood = moodOf(d.element, d.needs);
  } }),
  /** The new game with three eggs in the nests, a rock egg just laid, a dusk one past half way (a crack), a water one nearly due (two cracks, a wobble). */
  eggs: () => ({ ...newGame(), after: (sim) => { for (const e of EGGS_PRESET) sim.addEgg(e.element, sim.clock - Math.round(e.progress * hatchLen(sim))); } }),
  /** The new game with a fire egg HATCH_IN steps from hatching: CINDER stands up in the first nest at step 60. */
  hatch: () => ({ ...newGame(), after: (sim) => { sim.addEgg('fire', sim.clock + HATCH_IN - hatchLen(sim)); } }),
  /** The new game with every baby sub-slot taken (ten babies) and a fire egg due: it waits in its nest until a sub-slot frees. */
  full: () => ({ ...newGame(), dragons: [...START_DRAGONS, ...FULL_BABIES], after: (sim) => { sim.addEgg('fire', sim.clock - hatchLen(sim)); } }),
});

/** A preset's start by name; no name, or one no preset has, is the new game. */
export function startSpec(name: string | null | undefined): StartSpec {
  const make = name && Object.prototype.hasOwnProperty.call(PRESETS, name) ? PRESETS[name] : null;
  return make ? make() : newGame();
}

/**
 * A world built from a start: the spec's options with `seed` over them, and `hour` (view=base&hour=: the hour of day 1
 * it starts at, in place of any clock the spec sets), then its last touch.
 */
export function buildSim(spec: StartSpec, seed?: number, hour?: number | null): CareSim {
  const opts: SimOptions = { ...spec.opts };
  if (seed != null) opts.seed = seed;
  if (hour != null) { delete opts.clock0; opts.hour = hour; }
  const sim = new CareSim(spec.rooms, spec.dragons, spec.keepers, opts);
  spec.after?.(sim);
  return sim;
}
