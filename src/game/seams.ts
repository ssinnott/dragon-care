// Seams between parts of the game built in parallel: each function here began as a stand-in with its final signature,
// and each now has its real body (every caller stays as it was written).
//   currentTrip                   the trip that is out: S8 (missions.ts) owns it (built): the world's own,
//                                 sim.missions.trip (the `trip` preset makes one too, away: presets.ts tripStart,
//                                 missions.ts awayNow).
//   isTaken                       whether the player has taken this keeper by hand: S7 (control.ts) owns it; wired
//                                 (CareSim.controlled: held by hand, or taken at work and finishing it).
//   barnRoom                      how many more dragons the barn can take: S6b (life.ts BARN_CAP, barnCount) owns it;
//                                 wired (the cap less every dragon not living in the garden, those away on a mission too).
import type { CareSim } from './sim.ts';
import type { Trip } from './trip.ts';
import { BARN_CAP, barnCount } from './life.ts';

/** The trip that is out (missions.ts: the world's own, sim.missions.trip), else null. */
export function currentTrip(sim: CareSim): Trip | null { return sim.missions.trip ?? null; }
/**
 * Whether the player has taken this keeper by hand (then no automatic pick may choose them): S7's (control.ts), the
 * keeper held by hand (`manual`) or taken at work and finishing that job first (`pendingTake`) -- `CareSim.controlled`,
 * the same keepers the simulation's own `free()` leaves out of every automatic pick.
 */
export function isTaken(sim: CareSim, keeperId: number): boolean { return sim.controlled === keeperId; }
/**
 * How many more dragons the barn can take before it is full (BASE_DESIGN 4.7): S6b's cap less its count -- every dragon
 * not living in the garden, a team away on a mission and an elder still walking out to the garden among them (life.ts
 * barnCount); 0 at the cap, or over it (a preset may force more). An egg that falls due with no room waits in its nest.
 */
export function barnRoom(sim: CareSim): number { return Math.max(0, BARN_CAP - barnCount(sim)); }
