// Seams between slices built in parallel (plan: the orchestrator's contract). Each function here is a stand-in
// with the final signature; the merge replaces its body with the real thing, and every caller stays as it is.
//   currentTrip / setPreviewTrip  the trip that is out: S8 (missions.ts) owns the real one (built); a test may set a
//                                 preview trip on a sim (the `trip` preset now makes the world's own trip, away:
//                                 presets.ts tripStart, missions.ts awayNow).
//   isTaken                       whether the player has taken this keeper by hand: S7 (control.ts) owns it; wired
//                                 (CareSim.controlled: held by hand, or taken at work and finishing it).
//   barnRoom                      how many more dragons the barn can take: S6b (BARN_CAP) owns it.
import type { CareSim } from './sim.ts';
import type { Trip } from './trip.ts';

const previewTrips = new WeakMap<CareSim, Trip>();

/** The trip that is out (missions.ts: the world's own, sim.missions.trip), else a preview trip set on this sim, else null. */
export function currentTrip(sim: CareSim): Trip | null { return sim.missions.trip ?? previewTrips.get(sim) ?? null; }
/** Set (or clear) a preview trip on a sim: presets and tests only, never saved. */
export function setPreviewTrip(sim: CareSim, trip: Trip | null): void {
  if (trip) previewTrips.set(sim, trip); else previewTrips.delete(sim);
}
/**
 * Whether the player has taken this keeper by hand (then no automatic pick may choose them): S7's (control.ts), the
 * keeper held by hand (`manual`) or taken at work and finishing that job first (`pendingTake`) -- `CareSim.controlled`,
 * the same keepers the simulation's own `free()` leaves out of every automatic pick.
 */
export function isTaken(sim: CareSim, keeperId: number): boolean { return sim.controlled === keeperId; }
/** How many more dragons the barn can take before it is full. Stand-in: no cap yet. */
export function barnRoom(_sim: CareSim): number { return Infinity; }
