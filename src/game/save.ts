// The save format (docs/BASE_DESIGN.md 7): the whole care simulation as plain JSON, every reference stored as an id,
// so a world saved and loaded (CareSim.fromSave) steps on exactly as the one it came from would have. No RNG state is
// kept -- after construction every draw is rngAt(seed, ...) (rand.ts) -- so the seed is the only randomness saved.
// The digest two runs compare (CareSim.digest) is this same JSON, minus the seed; the page's hook shows its hash.
// This file never touches storage: src/game/storage.ts will (S4), and only from BaseView.attach().
import type { CareSim, Dragon, Keeper, Job, SimStats, LiftState } from './sim.ts';
import type { RoomPlace } from './layout.ts';

/**
 * The format's version: every change to what a save holds bumps it, and a save of another version is not loaded.
 * 2 (S2): a dragon's slot (by room id and index) in place of its home room; the rooms' uses (stats.used).
 * 3 (S3): dragons on the move (a slot that may be none, a goal and its job by id, the route, the walk and the turn),
 * a keeper waiting at the bay's edge, the lift (its car, its rider by id, its calls), the travel stats.
 */
export const SAVE_VERSION = 3;

/** A slot as saved: its room's id and its index in that room's slots (CareSim.fromSave takes the room's own slot again). */
export interface SlotRef { room: number; i: number }
/** A dragon as saved: every field, its slot by room id and index (null: none), its goal's job by id (it is one already). */
export type DragonSave = Omit<Dragon, 'slot'> & { slot: SlotRef | null };
/** A keeper as saved: every field, their station by room id and their job by job id. */
export type KeeperSave = Omit<Keeper, 'station' | 'job'> & { station: number; job: number | null };
/** A job as saved: its dragon and keeper by id. */
export type JobSave = Omit<Job, 'dragon' | 'keeper'> & { dragon: number; keeper: number | null };

export interface SaveV {
  v: number;
  seed: number;
  dayLen: number;
  clock0: number;
  tick: number;
  nextDragonId: number;
  nextJob: number;
  /** The rooms as they were placed (CareSim.fromSave places them again, so a room's id is its index here). */
  rooms: RoomPlace[];
  dragons: DragonSave[];
  keepers: KeeperSave[];
  jobs: JobSave[];
  /** The lift as it was (its rider and callers are dragon ids already). */
  lift: LiftState;
  stats: SimStats;
}

/** A save this build can't read: another version, or not a save at all. The storage layer (S4) starts a new barn on it. */
export class SaveVersionError extends Error {
  readonly found: unknown;
  constructor(found: unknown) {
    super(`save version ${JSON.stringify(found) ?? 'none'} is not ${SAVE_VERSION}`);
    this.name = 'SaveVersionError';
    this.found = found;
  }
}

/**
 * The world as JSON-safe data, in the simulation's own order (dragons, keepers and jobs as they sit in its arrays).
 * Every field of every dragon, keeper and job is kept -- the top level of each is copied whole, so a field a later
 * slice adds is saved with it -- and the plain objects they hold (needs, the act, the routes' legs, the lift's calls,
 * the rooms' uses) are copied, so the save never changes as the world steps on.
 */
export function serialize(sim: CareSim): SaveV {
  return {
    v: SAVE_VERSION, seed: sim.seed, dayLen: sim.dayLen, clock0: sim.clock0, tick: sim.tick, nextDragonId: sim.nextDragonId, nextJob: sim.nextJob,
    rooms: sim.roomPlaces.map((p) => ({ ...p })),
    dragons: sim.dragons.map((d): DragonSave => ({ ...d, slot: d.slot ? { room: d.slot.room, i: d.slot.i } : null, needs: { ...d.needs }, act: d.act ? { ...d.act } : null,
      legs: d.legs.map((l) => ({ ...l })) })),
    keepers: sim.keepers.map((k): KeeperSave => ({ ...k, station: k.station.id, job: k.job ? k.job.id : null, legs: k.legs.map((l) => ({ ...l })) })),
    jobs: sim.jobs.map((j): JobSave => ({ ...j, dragon: j.dragon.id, keeper: j.keeper ? j.keeper.id : null })),
    lift: { ...sim.lift, calls: sim.lift.calls.map((c) => ({ ...c })) },
    stats: { ...sim.stats, used: { ...sim.stats.used } },
  };
}

/** The world as one string, the seed left out (so "seeds 7 and 8 start different worlds" is a real check): two runs agree on it step for step. */
export function worldKey(sim: CareSim): string {
  const { seed: _seed, ...rest } = serialize(sim);
  return JSON.stringify(rest);
}

/**
 * The barn's own state -- its dragons, keepers, jobs and lift -- with every field that holds an absolute clock left out
 * (a dragon's stageSince; the lift's blockedSince and its calls' ticks are world ticks, the same in both), so two worlds
 * started at different hours but stepped alike agree on it (S4's no-tint check).
 */
export function barnKey(sim: CareSim): string {
  const s = serialize(sim);
  return JSON.stringify({ dragons: s.dragons.map(({ stageSince: _s, ...d }) => d), keepers: s.keepers, jobs: s.jobs, lift: s.lift });
}

/** A string's 32-bit FNV-1a hash (over its UTF-16 code units) as 8 hex digits: the digest the page's hook shows. */
export function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
}
