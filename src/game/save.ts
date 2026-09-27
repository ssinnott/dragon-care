// The save format (docs/BASE_DESIGN.md 7): the whole care simulation as plain JSON, every reference stored as an id,
// so a world saved and loaded (CareSim.fromSave) steps on exactly as the one it came from would have. No RNG state is
// kept -- after construction every draw is rngAt(seed, ...) (rand.ts) -- so the seed is the only randomness saved.
// The digest two runs compare (CareSim.digest) is this same JSON, minus the seed; the page's hook shows its hash.
// This file never touches storage: src/game/storage.ts does, and only from BaseView.attach().
import type { CareSim, Dragon, Keeper, Job, SimStats, LiftState, Egg } from './sim.ts';
import type { RoomPlace } from './layout.ts';
import { releasedState } from './control.ts';
import { copyMissions } from './missions.ts';
import type { MissionsState } from './missions.ts';

/**
 * The format's version: every change to what a save holds bumps it, and a save of another version is not loaded (the
 * page keeps it aside and starts a new barn: storage.ts) -- but for the one before, which is brought up to this one
 * as it loads (MIGRATES_FROM). Version 9 (the earlier ones were never shipped) holds the whole world: the rooms and
 * their uses (stats.used by kind, stats.usedRoom by room id); every dragon -- its slot by room id and index, its goal
 * and that goal's job by id, its route, its walk and the speed it last played at (`gaitS`), its turn, its `hold`, its
 * act, its stage and the step it began, its place (barn, garden or away), its plot (`home`) and a resident's rhythm
 * (`garden`); every keeper -- their station and job by id, route, phase (a mission's phases too), what they carry, and
 * the hand-held state, always saved released (control.ts releasedState); the open jobs; the lift (its car, its rider
 * by id, its calls); the eggs in the Hatchery's nests; the garden's plots; the missions (the board and its day, the
 * map, the coin, the trip out and each pair's deck spot); and the stats. Version 10 is 9 with every road's fights
 * (BASE_DESIGN 5.3): each mission's boss, its might and the road's foes, fights and packs; a trip's road with its
 * fights among its stops; no baddie exit.
 */
export const SAVE_VERSION = 10;
/**
 * The version a save may be of and still load, brought up to SAVE_VERSION (CareSim.fromSave: missions.ts
 * upgradeMissions and upgradeTrip give its board and its trip out their fights, the trip's rolled outcome kept).
 */
export const MIGRATES_FROM = 9;

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
  /** The id the next egg gets. */
  nextEggId: number;
  /** The rooms as they were placed (CareSim.fromSave places them again, so a room's id is its index here). */
  rooms: RoomPlace[];
  dragons: DragonSave[];
  keepers: KeeperSave[];
  jobs: JobSave[];
  /** The lift as it was (its rider and callers are dragon ids already). */
  lift: LiftState;
  /** The eggs in the nests (plain data: no references). */
  eggs: Egg[];
  /** The elder garden: its plots (its residents are dragons, above). */
  garden: { plots: number };
  /** The missions (missions.ts): the board, the map, the coin, the trip out (its pairs by id). */
  missions: MissionsState;
  stats: SimStats;
}

/** A save this build can't read: another version (not MIGRATES_FROM), or not a save at all. The storage layer (storage.ts) starts a new barn on it. */
export class SaveVersionError extends Error {
  readonly found: unknown;
  constructor(found: unknown) {
    super(`save version ${JSON.stringify(found) ?? 'none'} is not ${SAVE_VERSION} (nor ${MIGRATES_FROM}, which loads brought up to it)`);
    this.name = 'SaveVersionError';
    this.found = found;
  }
}

/**
 * The world as JSON-safe data, in the simulation's own order (dragons, keepers and jobs as they sit in its arrays).
 * A keeper held by the player's hand is saved released (BASE_DESIGN 7, Saves: control.ts releasedState -- going home, or finishing
 * the job at hand first), exactly the world a release that step would make, so a save never holds a keeper by hand;
 * `exact` keeps them as they are (worldKey: the digest two runs compare sees the hand too).
 * Every field of every dragon, keeper and job is kept -- the top level of each is copied whole, so a field added later
 * is saved with it -- and the plain objects they hold (needs, the act, the routes' legs, a garden resident's
 * rhythm, the lift's calls, the eggs, the garden, the rooms' uses by kind and by room) are copied, so the save never changes as the world
 * steps on.
 */
export function serialize(sim: CareSim, exact = false): SaveV {
  const held = (k: Keeper): Keeper => (!exact && (k.manual || k.pendingTake) ? { ...k, ...releasedState(sim, k) } : k);
  return {
    v: SAVE_VERSION, seed: sim.seed, dayLen: sim.dayLen, clock0: sim.clock0, tick: sim.tick, nextDragonId: sim.nextDragonId, nextJob: sim.nextJob, nextEggId: sim.nextEggId,
    rooms: sim.roomPlaces.map((p) => ({ ...p })),
    dragons: sim.dragons.map((d): DragonSave => ({ ...d, slot: d.slot ? { room: d.slot.room, i: d.slot.i } : null, needs: { ...d.needs }, act: d.act ? { ...d.act } : null,
      legs: d.legs.map((l) => ({ ...l })), garden: d.garden ? { ...d.garden } : null })),
    keepers: sim.keepers.map(held).map((k): KeeperSave => ({ ...k, held: { ...k.held }, station: k.station.id, job: k.job ? k.job.id : null, legs: k.legs.map((l) => ({ ...l })) })),
    jobs: sim.jobs.map((j): JobSave => ({ ...j, dragon: j.dragon.id, keeper: j.keeper ? j.keeper.id : null })),
    lift: { ...sim.lift, calls: sim.lift.calls.map((c) => ({ ...c })) },
    eggs: sim.eggs.map((e) => ({ ...e })),
    garden: { plots: sim.garden.plots },
    missions: copyMissions(sim.missions),
    stats: { ...sim.stats, used: { ...sim.stats.used }, usedRoom: [...sim.stats.usedRoom], doneBy: { ...sim.stats.doneBy } },
  };
}

/**
 * The world as one string, the seed left out (so "seeds 7 and 8 start different worlds" is a real check): two runs agree
 * on it step for step. A keeper held by hand is in it as they are (not released, as a save has them).
 */
export function worldKey(sim: CareSim): string {
  const { seed: _seed, ...rest } = serialize(sim, true);
  return JSON.stringify(rest);
}

/**
 * The barn's own state -- its dragons, keepers, jobs, lift and eggs -- with every field that holds an absolute clock left
 * out (a dragon's stageSince, an egg's laid; the lift's blockedSince and its calls' ticks are world ticks, the same in
 * both), so two worlds started at different hours but stepped alike agree on it (the view's no-tint check: BASE_DESIGN 7). A garden
 * resident's rhythm (`garden`) is left out too: its naps are the one thing that reads the day's phase (garden.ts), so a
 * world with residents is the same barn by day and night only until a resident's rhythm moves one (the check's worlds
 * have none).
 */
export function barnKey(sim: CareSim): string {
  const s = serialize(sim, true);
  return JSON.stringify({ dragons: s.dragons.map(({ stageSince: _s, garden: _g, ...d }) => d), keepers: s.keepers, jobs: s.jobs, lift: s.lift, eggs: s.eggs.map(({ laid: _l, ...e }) => e) });
}

/** A string's 32-bit FNV-1a hash (over its UTF-16 code units) as 8 hex digits: the digest the page's hook shows. */
export function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
}
