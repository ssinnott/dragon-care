// Starts built in code (view=base&preset=<name>): a world other than the new game's, for views and checks that need
// what a new game has not got yet -- every stage at once, and later (each slice adds its own) a dragon about to grow
// up, eggs in the nests, a team away. A preset is always code, never a save and never hundreds of thousands of steps,
// so a frozen view of it (t=) is as quick and as deterministic as the new game's.
import { CareSim } from './sim.ts';
import type { SimOptions } from './sim.ts';
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
 * The base's first cast, unchanged: twelve dragons, every element and every stage among them, where the greybox
 * mockups had them (docs/base/). The new game starts with seven newly adult dragons instead (start.ts, #9).
 */
export const AGES_DRAGONS: readonly DragonPlace[] = [
  { name: 'EMBER', element: 'fire', stage: 'adult', seed: 11, room: 'kitchen', at: 0.62, facing: 1 },
  { name: 'CINDER', element: 'fire', stage: 'baby', seed: 28, room: 'kitchen', at: 0.9, facing: -1 },
  { name: 'PEBBLE', element: 'rock', stage: 'baby', seed: 62, room: 'hatchery', at: 0.78, facing: -1 },
  { name: 'RIPPLE', element: 'water', stage: 'adult', seed: 79, room: 'bath', at: 0.3, facing: 1 },
  { name: 'ZAP', element: 'lightning', stage: 'young', seed: 113, room: 'romp', at: 0.4, facing: 1 },
  { name: 'BURR', element: 'spike', stage: 'baby', seed: 45, room: 'romp', at: 0.64, facing: -1 },
  { name: 'SPLASH', element: 'water', stage: 'young', seed: 147, room: 'romp', at: 0.87, facing: -1 },
  { name: 'BRAMBLE', element: 'spike', stage: 'adult', seed: 164, room: 'groom', at: 0.38, facing: 1 },
  { name: 'WICK', element: 'dusk', stage: 'adult', seed: 181, room: 'dorm', at: 0.28, facing: 1 },
  { name: 'ASH', element: 'fire', stage: 'elder', seed: 198, room: 'dorm', at: 0.8, facing: -1 },
  { name: 'COBBLE', element: 'rock', stage: 'elder', seed: 215, room: 'sunloft', at: 0.55, facing: 1 },
  { name: 'ECHO', element: 'slinkwing', stage: 'adult', seed: 266, room: 'roost', at: 0.35, facing: 1 },
];

/** The new game: the start's rooms, its seven young adults and the four keepers. */
function newGame(): StartSpec { return { rooms: START_ROOMS, dragons: START_DRAGONS, keepers: START_KEEPERS }; }

/** The presets by name (view=base&preset=<name>). */
export const PRESETS: Readonly<Record<string, () => StartSpec>> = Object.freeze({
  /** Every stage at once: the base's first twelve-dragon cast. */
  ages: () => ({ rooms: START_ROOMS, dragons: AGES_DRAGONS, keepers: START_KEEPERS }),
});

/** A preset's start by name; no name, or one no preset has, is the new game. */
export function startSpec(name: string | null | undefined): StartSpec {
  const make = name && Object.prototype.hasOwnProperty.call(PRESETS, name) ? PRESETS[name] : null;
  return make ? make() : newGame();
}

/** A world built from a start: the spec's options with `seed` over them, then its last touch. */
export function buildSim(spec: StartSpec, seed?: number): CareSim {
  const sim = new CareSim(spec.rooms, spec.dragons, spec.keepers, seed == null ? spec.opts : { ...spec.opts, seed });
  spec.after?.(sim);
  return sim;
}
