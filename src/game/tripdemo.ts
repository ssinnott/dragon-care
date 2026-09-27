// The `trip` preset's missions (BASE_DESIGN 6: view=base&preset=trip&trip=<region>:<progress>[:fail]): a region's mission
// built from the Map Room's own tables (regions.ts REGIONS, CHALLENGES, BADDIES, KEEPER_SKILL), a team of two pairs of
// the new game's dragons with their riders picked by the missions' own auto-pick (missions.ts autoRider), the odds
// and the road -- its stops, who meets each and the trip log's lines -- as missions.ts send would make them (oddsOf,
// roadOf): so the scene (missionview.ts) watched on a preset and on a team the Map Room sent reads the
// same trip. The only preset-made parts: which mission (a region's at a difficulty, not the day's board), which team
// (the best two pairs that can beat its boss, so its fight is watched won -- or a lone pair too weak for it), and the
// outcome (asked, not rolled).
// DOM-free.
import type { CareSim, Dragon } from './sim.ts';
import type { Trip, Mission, Pair } from './trip.ts';
import type { RegionId, ChallengeId, Difficulty } from './missiondata.ts';
import { rngAt, TAG } from './rand.ts';
import { REGIONS, REGION_IDS, regionOf } from './regions.ts';
import { DIFFICULTY, autoRider, oddsOf, roadOf, roadFor, coverage, freeNest, dragonReason } from './missions.ts';

/**
 * The mission a region's board could show at a difficulty (BASE_DESIGN 5.1: missions.ts DIFFICULTY, roadFor): its
 * challenges drawn from the region's pool without replacement (seeded by rngAt(seed, BOARD, 900, region, n): the
 * preset's own draw, not a day's board), its fights with the region's little enemies and its boss at the end, and a
 * title from the region's (a hard road's the boss's ground).
 */
function demoMission(sim: CareSim, region: RegionId, difficulty: Difficulty): Mission {
  const R = regionOf(region), D = DIFFICULTY[difficulty], ri = REGION_IDS.indexOf(region);
  const pool = [...R.pool], rng = rngAt(sim.seed, TAG.BOARD, 900, ri, D.challenges), out: ChallengeId[] = [];
  while (out.length < D.challenges && pool.length) out.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
  const title = difficulty === 'hard' ? R.baddieTitle : R.titles[0];
  return { id: 900 + ri, ...roadFor(region, difficulty), title, challenges: out, days: D.days, coin: D.coin, eggChance: D.egg, guaranteedEgg: true };
}

/**
 * A trip on a region's mission at a difficulty, as the Map Room would send it: the best team of two pairs of the world's
 * grown barn dragons, each with its auto rider beside the other (missions.ts autoRider: the partner, else a skill the
 * team lacks, else anyone free; never a keeper taken by hand), the highest odds (missions.ts oddsOf) among the teams
 * that beat the mission's boss, when any can (the preview is for watching the fight won whole), ties to lower ids --
 * or, `weak`, the lone pair with the highest odds among those too weak for the boss (the fight it isn't beaten in: on a
 * hard road no lone dragon is strong enough); its road (missions.ts roadOf: the stops and the log lines, the same
 * whatever the outcome); and the outcome as asked (not rolled: a preview ends the way it is told to). On a success it
 * brings the region's egg home (its first success there is sure) to the lowest free nest. Not departed: the caller
 * sends it away (missions.ts awayNow) or sets `departAt` / `returnAt` itself.
 */
export function demoTrip(sim: CareSim, region: RegionId, difficulty: Difficulty, success: boolean, weak = false): Trip {
  const m = demoMission(sim, region, difficulty);
  // (who may go, by the Map Room's own rule: missions.ts dragonReason)
  const able: Dragon[] = sim.dragons.filter((d) => !dragonReason(sim, d, m));
  let best: { pairs: Pair[]; odds: number; meets: boolean } | null = null;
  const teams: Dragon[][] = [];
  if (weak) for (const d of able) teams.push([d]);
  else for (let a = 0; a < able.length; a++) for (let b = a + 1; b < able.length; b++) teams.push([able[a], able[b]]);
  for (const team of teams) {
    const pairs: Pair[] = [];
    for (const d of team) { const k = autoRider(sim, d, m, pairs); if (k != null) pairs.push({ dragon: d.id, keeper: k }); }
    if (pairs.length < team.length) continue;
    const odds = oddsOf(sim, m, pairs), meets = coverage(sim, m, pairs).beaten;
    if (weak && meets) continue;
    if (!best || (meets && !best.meets) || (meets === best.meets && odds > best.odds)) best = { pairs, odds, meets };
  }
  if (!best) throw new Error(weak ? 'trip: no dragon too weak for the boss can go' : 'trip: no two dragons can go');
  const { pairs, odds } = best;
  const R = regionOf(region), nest = freeNest(sim);
  const egg = success && nest != null ? R.eggs[rngAt(sim.seed, TAG.EGG, m.id, 1).int(0, R.eggs.length - 1)] : null;
  return {
    mission: m, pairs, odds, success, egg, nest: egg ? nest : null, stops: roadOf(sim, m, pairs),
    state: 'away', departAt: null, returnAt: null,
  };
}

/**
 * A parsed `trip=<region>:<progress>[:fail][:weak]` (progress 0..1 of the trip's length at the frozen frame; `fail` the
 * outcome the road's end tells; `weak` a lone pair too weak for the boss, demoTrip), or null.
 */
export interface TripParam { region: RegionId; progress: number; fail: boolean; weak: boolean }
export function parseTripParam(v: string | null | undefined): TripParam | null {
  const [r, p, ...flags] = (v || '').split(':');
  const progress = p == null || p.trim() === '' ? NaN : Number(p);
  if (!REGIONS.some((q) => q.id === r) || !Number.isFinite(progress)) return null;
  return { region: r as RegionId, progress: Math.max(0, Math.min(1, progress)), fail: flags.includes('fail'), weak: flags.includes('weak') };
}
