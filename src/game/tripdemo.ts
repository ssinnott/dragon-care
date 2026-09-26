// The `trip` preset's missions (plan S9: view=base&preset=trip&trip=<region>:<progress>[:fail]): a region's mission
// built from the Map Room's own tables (regions.ts REGIONS, CHALLENGES, BADDIES, KEEPER_SKILL), a team of two pairs of
// the new game's dragons with their riders picked by the missions' own auto-pick (missions.ts autoRider), the odds
// and the road -- its stops, who meets each, the trip log's lines and the turn-back -- as missions.ts send would make
// them (oddsOf, roadOf): so the scene (missionview.ts) watched on a preset and on a team the Map Room sent reads the
// same trip. The only preset-made parts: which mission (a region's at a difficulty, not the day's board), which team
// (the best two pairs that can meet its baddie, so its beat is watched whole), and the outcome (asked, not rolled).
// DOM-free.
import type { CareSim, Dragon } from './sim.ts';
import type { Trip, Mission, Pair } from './trip.ts';
import type { RegionId, ChallengeId, Difficulty } from './missiondata.ts';
import { rngAt, TAG } from './rand.ts';
import { REGIONS, BADDIES, REGION_IDS, regionOf } from './regions.ts';
import { DIFFICULTY, autoRider, oddsOf, roadOf, freeNest } from './missions.ts';

/**
 * The mission a region's board could show at a difficulty (plan S8's table: missions.ts DIFFICULTY): its challenges
 * drawn from the region's pool without replacement (seeded by rngAt(seed, BOARD, 900, region, n): the preset's own
 * draw, not a day's board), its baddie on a hard one (else a fourth challenge), and a title from the region's.
 */
function demoMission(sim: CareSim, region: RegionId, difficulty: Difficulty): Mission {
  const R = regionOf(region), D = DIFFICULTY[difficulty], ri = REGION_IDS.indexOf(region);
  const baddie = difficulty === 'hard' ? R.baddie : null, n = difficulty === 'hard' && !baddie ? D.challenges + 1 : D.challenges;
  const pool = [...R.pool], rng = rngAt(sim.seed, TAG.BOARD, 900, ri, D.challenges), out: ChallengeId[] = [];
  while (out.length < n && pool.length) out.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
  const title = baddie && R.baddieTitle ? R.baddieTitle : R.titles[0];
  return { id: 900 + ri, region, title, difficulty, challenges: out, baddie, days: D.days, coin: D.coin, eggChance: D.egg, guaranteedEgg: true };
}

/**
 * A trip on a region's mission at a difficulty, as the Map Room would send it: the best team of two pairs of the world's
 * grown barn dragons, each with its auto rider beside the other (missions.ts autoRider: the partner, else a skill the
 * team lacks, else anyone free; never a keeper taken by hand), the highest odds (missions.ts oddsOf) among the teams
 * that meet the mission's baddie, when any can (the preview is for watching the beat, both counters' moments and its
 * cozy exit), ties to lower ids; its road (missions.ts roadOf: the stops, the log lines, the turn-back); and the
 * outcome as asked (not rolled: a preview shows the road it is told to). On a success it brings the region's egg home
 * (its first success there is sure) to the lowest free nest, and the baddie takes its exit. Not departed: the caller
 * sends it away (missions.ts awayNow) or sets `departAt` / `returnAt` itself.
 */
export function demoTrip(sim: CareSim, region: RegionId, difficulty: Difficulty, success: boolean): Trip {
  const m = demoMission(sim, region, difficulty);
  const able: Dragon[] = sim.dragons.filter((d) => d.place === 'barn' && (d.stage === 'adult' || d.stage === 'elder'));
  let best: { pairs: Pair[]; odds: number; meets: boolean } | null = null;
  for (let a = 0; a < able.length; a++) for (let b = a + 1; b < able.length; b++) {
    const pairs: Pair[] = [];
    for (const d of [able[a], able[b]]) { const k = autoRider(sim, d, m, pairs); if (k != null) pairs.push({ dragon: d.id, keeper: k }); }
    if (pairs.length < 2) continue;
    const odds = oddsOf(sim, m, pairs), meets = !!m.baddie && roadOf(sim, m, pairs, true).stops.some((s) => s.kind === 'baddie' && s.covered);
    if (!best || (meets && !best.meets) || (meets === best.meets && odds > best.odds)) best = { pairs, odds, meets };
  }
  if (!best) throw new Error('trip: no two dragons can go');
  const { pairs, odds } = best;
  const { stops, turnBack } = roadOf(sim, m, pairs, success);
  const R = regionOf(region), nest = freeNest(sim);
  const egg = success && nest != null ? R.eggs[rngAt(sim.seed, TAG.EGG, m.id, 1).int(0, R.eggs.length - 1)] : null;
  return {
    mission: m, pairs, odds, success, egg, nest: egg ? nest : null, stops, turnBack,
    state: 'away', departAt: null, returnAt: null,
    exit: success && m.baddie ? BADDIES[m.baddie].exit : null,
  };
}

/** A parsed `trip=<region>:<progress>[:fail]` (progress 0..1 of the trip's length at the frozen frame), or null. */
export interface TripParam { region: RegionId; progress: number; fail: boolean }
export function parseTripParam(v: string | null | undefined): TripParam | null {
  const [r, p, f] = (v || '').split(':');
  const progress = p == null || p.trim() === '' ? NaN : Number(p);
  if (!REGIONS.some((q) => q.id === r) || !Number.isFinite(progress)) return null;
  return { region: r as RegionId, progress: Math.max(0, Math.min(1, progress)), fail: f === 'fail' };
}
