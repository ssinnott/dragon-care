// Seams between slices built in parallel (plan: the orchestrator's contract). Each function here is a stand-in
// with the final signature; the merge replaces its body with the real thing, and every caller stays as it is.
//   currentTrip / setPreviewTrip  the trip that is out: S8 (missions.ts) owns the real one; S9's `trip` preset and
//                                 its tests may set a preview trip on a sim.
//   isTaken                       whether the player has taken this keeper by hand: S7 (control.ts) owns it.
//   barnRoom                      how many more dragons the barn can take: S6b (BARN_CAP) owns it.
import type { CareSim } from './sim.ts';
import type { Trip } from './trip.ts';

const previewTrips = new WeakMap<CareSim, Trip>();

/** The trip that is out, or null. (Stand-in: only a preview trip; S8 returns its own.) */
export function currentTrip(sim: CareSim): Trip | null { return previewTrips.get(sim) ?? null; }
/** Set (or clear) a preview trip on a sim: presets and tests only, never saved. */
export function setPreviewTrip(sim: CareSim, trip: Trip | null): void {
  if (trip) previewTrips.set(sim, trip); else previewTrips.delete(sim);
}
/** Whether the player has taken this keeper by hand (then no automatic pick may choose them). Stand-in: never. */
export function isTaken(_sim: CareSim, _keeperId: number): boolean { return false; }
/** How many more dragons the barn can take before it is full. Stand-in: no cap yet. */
export function barnRoom(_sim: CareSim): number { return Infinity; }
