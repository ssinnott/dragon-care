// The `trip` preset's missions (BASE_DESIGN 6: view=base&preset=trip&trip=<region>:<progress>[:fail]): a region's mission
// built from the Map Room's own tables (regions.ts REGIONS, CHALLENGES, BADDIES, KEEPER_SKILL), a team of two pairs of
// the new game's dragons with their riders picked by the missions' own auto-pick (missions.ts autoRider), and the trip
// as missions.ts send would make it (tripOf: the road -- its stops and who has each one's counter -- the egg, the
// team's stats and puff, the forecast): so the scene (missionview.ts) watched on a preset and on a team the Map Room
// sent reads the same trip. The only preset-made parts: which mission (a region's at a difficulty, not the day's
// board), which team (the best two pairs that have its boss's counters, so its fight is watched with both), and how far
// along it is put (missions.ts placeAlong: the stops before that point resolved, the last of them waited out for a
// `:fail`). DOM-free.
import type { CareSim, Dragon } from './sim.ts';
import type { Trip, Mission, Pair } from './trip.ts';
import type { RegionId, ChallengeId, Difficulty } from './missiondata.ts';
import { rngAt, TAG } from './rand.ts';
import { REGIONS, REGION_IDS, regionOf } from './regions.ts';
import { DIFFICULTY, autoRider, forecastOf, roadOf, roadFor, tripOf, dragonReason } from './missions.ts';

/**
 * The mission a region's board could show at a difficulty (BASE_DESIGN 5.1: missions.ts DIFFICULTY, roadFor): its
 * challenges drawn from the region's pool without replacement (seeded by rngAt(seed, BOARD, 900, region, n): the
 * preset's own draw, not a day's board), its packs of the region's little enemies and its boss at the end, and a
 * title from the region's (a hard road's is the boss's ground).
 */
function demoMission(sim: CareSim, region: RegionId, difficulty: Difficulty): Mission {
  const R = regionOf(region), D = DIFFICULTY[difficulty], ri = REGION_IDS.indexOf(region);
  const pool = [...R.pool], rng = rngAt(sim.seed, TAG.BOARD, 900, ri, D.challenges), out: ChallengeId[] = [];
  while (out.length < D.challenges && pool.length) out.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
  const title = difficulty === 'hard' ? R.baddieTitle : R.titles[0];
  return { id: 900 + ri, ...roadFor(region, difficulty), title, challenges: out, days: D.days, coin: D.coin, eggChance: D.egg, guaranteedEgg: true };
}

/**
 * A trip on a region's mission at a difficulty, as the Map Room would send it (missions.ts tripOf): the best team of
 * two pairs of the world's grown barn dragons, each with its auto rider beside the other (missions.ts autoRider: the
 * partner, else a skill the team lacks, else anyone free; never a keeper taken by hand), the best forecast
 * (missions.ts forecastOf) among the teams that have the mission's boss's counters, when any can (its fight is
 * watched with both), ties to lower ids; its road, its egg (the region's first success is sure: the lowest free nest),
 * its stats and puff. Not sent: the caller sends it away (missions.ts awayNow) and puts it along its road (placeAlong).
 */
export function demoTrip(sim: CareSim, region: RegionId, difficulty: Difficulty): Trip {
  const m = demoMission(sim, region, difficulty);
  // (who may go, by the Map Room's own rule: missions.ts dragonReason)
  const able: Dragon[] = sim.dragons.filter((d) => !dragonReason(sim, d, m));
  let best: { pairs: Pair[]; score: number; meets: boolean } | null = null;
  for (let a = 0; a < able.length; a++) for (let b = a + 1; b < able.length; b++) {
    const pairs: Pair[] = [];
    for (const d of [able[a], able[b]]) { const k = autoRider(sim, d, m, pairs); if (k != null) pairs.push({ dragon: d.id, keeper: k }); }
    if (pairs.length < 2) continue;
    const f = forecastOf(sim, m, pairs), score = f.cleared + f.puff, meets = roadOf(sim, m, pairs).some((s) => s.kind === 'baddie' && s.covered);
    if (!best || (meets && !best.meets) || (meets === best.meets && score > best.score + 1e-9)) best = { pairs, score, meets };
  }
  if (!best) throw new Error('trip: no two dragons can go');
  return tripOf(sim, m, best.pairs);
}

/** A parsed `trip=<region>:<progress>[:fail]` (progress 0..1 of the trip's walk at the frozen frame), or null. */
export interface TripParam { region: RegionId; progress: number; fail: boolean; auto: boolean }
/** `<region>:<progress>[:fail][:auto]`: the flags in any order -- `fail` waits the last resolved stop out, `auto` puts the trail coach on. */
export function parseTripParam(v: string | null | undefined): TripParam | null {
  const [r, p, ...flags] = (v || '').split(':');
  const progress = p == null || p.trim() === '' ? NaN : Number(p);
  if (!REGIONS.some((q) => q.id === r) || !Number.isFinite(progress)) return null;
  return { region: r as RegionId, progress: Math.max(0, Math.min(1, progress)), fail: flags.includes('fail'), auto: flags.includes('auto') };
}
