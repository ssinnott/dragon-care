// The `trip` preset's missions (plan S9: view=base&preset=trip&trip=<region>:<progress>[:fail]): a real mission from
// plan S8's regions table, a team of two pairs of the new game's dragons with their riders picked as S8's auto-pick
// does, and the trip with its stops placed as trip.ts documents -- built by hand, so the watchable scene (missionview.ts)
// can be looked at, frozen, anywhere along the road before the Map Room's missions (S8: regions.ts, missions.ts) exist
// on this branch. At the merge, the tables here give way to S8's `REGIONS`, `CHALLENGES`, `BADDIES` and
// `KEEPER_SKILL`, and `demoTrip` to a trip S8's `send` would make; the scene reads only the Trip (and the region's
// climate, `climateOf`). DOM-free, and nothing here is saved: a preview trip lives beside a world (seams.ts
// setPreviewTrip), never in it.
import type { CareSim, Dragon, Keeper } from './sim.ts';
import type { Trip, Mission, Pair, Stop } from './trip.ts';
import type { RegionId, Climate, ChallengeId, Skill, Difficulty, BaddieId, BaddieExit } from './missiondata.ts';
import type { DragonElement } from '../art/dragon/palettes.ts';
import type { KeeperId } from '../art/keeper/cast.ts';
import { OWN_NEED } from './needs.ts';
import { rngAt, TAG } from './rand.ts';

/** What meets a challenge: a dragon of an element, or a rider with a skill (plan S8's counters). */
export interface Counter { element?: DragonElement; skill?: Skill }

/** The challenges (plan S8's counters table): the banner's name, who meets it, and what they do ("WICK LIGHTS THE WAY"). */
export const CHALLENGE_DATA: Readonly<Record<ChallengeId, { name: string; counter: Counter; met: string }>> = Object.freeze({
  dark: { name: 'PITCH DARK', counter: { element: 'dusk' }, met: 'LIGHTS THE WAY' },
  heavy: { name: 'HEAVY LOAD', counter: { element: 'rock' }, met: 'HAULS IT CLEAR' },
  cold: { name: 'THE COLD', counter: { element: 'fire' }, met: 'KEEPS THEM WARM' },
  storm: { name: 'STORM', counter: { element: 'lightning' }, met: 'TURNS THE BOLTS AWAY' },
  flood: { name: 'SPRING FLOOD', counter: { element: 'water' }, met: 'SWIMS THEM ACROSS' },
  thorns: { name: 'THORNS', counter: { element: 'spike' }, met: 'PARTS THE BRAMBLES' },
  lost: { name: 'LOST THINGS', counter: { element: 'slinkwing' }, met: 'SNIFFS THEM OUT' },
  miller: { name: 'GRUMPY MILLER', counter: { skill: 'charm' }, met: 'TALKS HIM ROUND' },
  hurt: { name: 'HURT ANIMAL', counter: { skill: 'medic' }, met: 'BANDAGES ITS WING' },
  fog: { name: 'THICK FOG', counter: { skill: 'navigator' }, met: 'FINDS THE WAY' },
  gap: { name: 'NARROW GAP', counter: { skill: 'nimble' }, met: 'SQUEEZES THEM THROUGH' },
});

/** The big baddies (plan S8): the name, the two counters that must both be met, the cozy exit, and what the counters do. */
export const BADDIE_DATA: Readonly<Record<BaddieId, { name: string; counters: readonly [Counter, Counter]; exit: BaddieExit; met: string }>> = Object.freeze({
  moleking: { name: 'THE MOLE KING', counters: [{ element: 'dusk' }, { skill: 'charm' }] as const, exit: 'calmed', met: 'CALM HIM: HE DOZES OFF' },
  stormroc: { name: 'THE STORM ROC', counters: [{ element: 'lightning' }, { skill: 'navigator' }] as const, exit: 'outwitted', met: 'SEND HIM TO A BETTER CRAG' },
  frostgiant: { name: 'THE FROST GIANT', counters: [{ element: 'fire' }, { skill: 'nimble' }] as const, exit: 'drivenOff', met: 'SEE HIM OFF TO COLDER HILLS' },
});

/** The regions (plan S8's table): the climate, the challenge pool, the eggs, the baddie, and a hard mission's title. */
export const REGION_DATA: Readonly<Record<RegionId, { name: string; climate: Climate; pool: readonly ChallengeId[]; eggs: readonly DragonElement[]; baddie: BaddieId | null; hardTitle: string }>> = Object.freeze({
  millbrook: { name: 'MILLBROOK', climate: 'meadow', pool: ['flood', 'miller', 'hurt', 'lost'], eggs: ['water', 'spike'], baddie: null, hardTitle: 'THE LONG MILL ROAD' },
  oldmine: { name: 'OLD MINE ROAD', climate: 'caves', pool: ['dark', 'heavy', 'lost', 'gap'], eggs: ['rock', 'dusk'], baddie: 'moleking', hardTitle: 'THE MOLE KING\'S TUNNELS' },
  bramblewood: { name: 'BRAMBLEWOOD', climate: 'forest', pool: ['thorns', 'lost', 'fog', 'hurt'], eggs: ['spike', 'slinkwing'], baddie: null, hardTitle: 'THE BRAMBLE MAZE' },
  highfold: { name: 'HIGHFOLD', climate: 'peaks', pool: ['storm', 'cold', 'fog', 'gap'], eggs: ['lightning', 'slinkwing'], baddie: 'stormroc', hardTitle: 'THE STORM ROC\'S CRAG' },
  frostmere: { name: 'FROSTMERE', climate: 'ice', pool: ['cold', 'flood', 'gap', 'hurt'], eggs: ['fire', 'water'], baddie: 'frostgiant', hardTitle: 'THE FROST GIANT\'S PASS' },
  emberfell: { name: 'EMBERFELL', climate: 'ash', pool: ['heavy', 'dark', 'storm', 'miller'], eggs: ['fire', 'lightning', 'dusk'], baddie: null, hardTitle: 'THE WARM ASH HILLS' },
});
export const REGION_IDS: readonly RegionId[] = Object.freeze(Object.keys(REGION_DATA) as RegionId[]);

/** A region's climate (the scene's backdrop: artseams.ts drawClimate). */
export function climateOf(region: RegionId): Climate { return REGION_DATA[region].climate; }

/** The riders' skills (plan P13: Bea CHARM, Tomas MEDIC, Iris NAVIGATOR, Pip NIMBLE). */
export const KEEPER_SKILL: Readonly<Record<KeeperId, Skill>> = Object.freeze({ bea: 'charm', tomas: 'medic', iris: 'navigator', pip: 'nimble' });

/** The difficulties (plan S8's board table): challenges (a hard one: 3 and the baddie, or 4), days, coin, egg chance. */
const DIFF: Readonly<Record<Difficulty, { n: number; days: number; coin: number; egg: number }>> = Object.freeze({
  easy: { n: 2, days: 1, coin: 40, egg: 0.35 }, normal: { n: 3, days: 2, coin: 80, egg: 0.35 }, hard: { n: 3, days: 3, coin: 150, egg: 0.6 },
});

const meets = (c: Counter, d: Dragon | null, k: Keeper | null) => (c.element != null && d?.element === c.element) || (c.skill != null && !!k && KEEPER_SKILL[k.look] === c.skill);

/** The mission a region's board would show at a difficulty: its challenges drawn from the pool without replacement (seeded), its baddie on a hard one. */
export function demoMission(sim: CareSim, region: RegionId, difficulty: Difficulty): Mission {
  const R = REGION_DATA[region], D = DIFF[difficulty], ri = REGION_IDS.indexOf(region);
  const pool = [...R.pool], rng = rngAt(sim.seed, TAG.BOARD, 900, ri, D.n), out: ChallengeId[] = [];
  const n = difficulty === 'hard' && !R.baddie ? 4 : D.n;
  while (out.length < n && pool.length) out.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
  const title = difficulty === 'hard' ? R.hardTitle : difficulty === 'normal' ? `${R.name} BY THE LONG WAY` : `A WALK TO ${R.name}`;
  return { id: 900 + ri, region, title, difficulty, challenges: out, baddie: difficulty === 'hard' ? R.baddie : null, days: D.days, coin: D.coin, eggChance: D.egg, guaranteedEgg: true };
}

/** Riders picked as S8's auto-pick does: each dragon's partner (the keeper whose specialty is its own need) if free, else one who counters a challenge still uncovered, else anyone free (lowest id first); at most keepers - 2. */
function autoRiders(sim: CareSim, m: Mission, dragons: readonly Dragon[]): (Keeper | null)[] {
  const taken = new Set<Keeper>(), out: (Keeper | null)[] = [];
  const max = Math.max(0, sim.keepers.length - 2);
  for (const d of dragons) {
    if (taken.size >= max) { out.push(null); continue; }
    const free = sim.keepers.filter((k) => !taken.has(k));
    const team = dragons, riders = [...taken];
    const uncovered = m.challenges.filter((c) => !team.some((q) => meets(CHALLENGE_DATA[c].counter, q, null)) && !riders.some((k) => meets(CHALLENGE_DATA[c].counter, null, k)));
    const pick = free.find((k) => k.specialty === OWN_NEED[d.element])
      ?? free.find((k) => uncovered.some((c) => meets(CHALLENGE_DATA[c].counter, null, k)))
      ?? free[0] ?? null;
    if (pick) taken.add(pick);
    out.push(pick);
  }
  return out;
}

/** The stops of a mission for a team (trip.ts: challenge i of n at (i+1)/(n+1)*0.85, the baddie at 0.9), with who meets each and its log line. */
export function demoStops(sim: CareSim, m: Mission, pairs: readonly Pair[]): Stop[] {
  const ds = pairs.map((p) => sim.dragons.find((d) => d.id === p.dragon)!), ks = pairs.map((p) => sim.keepers.find((k) => k.id === p.keeper) ?? null);
  const who = (c: Counter) => [...ds.filter((d) => meets(c, d, null)).map((d) => d.name), ...ks.filter((k): k is Keeper => !!k && meets(c, null, k)).map((k) => k.name)];
  const n = m.challenges.length;
  const stops: Stop[] = m.challenges.map((c, i) => {
    const C = CHALLENGE_DATA[c], by = who(C.counter);
    return { kind: 'challenge', challenge: c, baddie: null, at: (i + 1) / (n + 1) * 0.85, covered: by.length > 0, by,
      log: by.length ? `${C.name} - ${by[0]} ${C.met}` : `${C.name} - NOBODY COULD HELP: THEY WAIT IT OUT` };
  });
  if (m.baddie) {
    const B = BADDIE_DATA[m.baddie], a = who(B.counters[0]), b = who(B.counters[1]);
    const covered = a.length > 0 && b.length > 0, by = [...a.slice(0, 1), ...b.slice(0, 1)];
    stops.push({ kind: 'baddie', challenge: null, baddie: m.baddie, at: 0.9, covered, by,
      log: covered ? `${B.name} - ${by[0]} AND ${by[1]} ${B.met}` : `${B.name} - NOBODY COULD MEET HIM` });
  }
  return stops;
}

/** Plan S8's odds: 0.20 + 0.15 a challenge covered + 0.15 the baddie covered + 0.05 a pair in a good mood + 0.05 a partner pair, within 0.05..0.95. */
export function demoOdds(sim: CareSim, stops: readonly Stop[], pairs: readonly Pair[]): number {
  let o = 0.2;
  // (each challenge covered, and the baddie covered: 0.15 each)
  for (const s of stops) if (s.covered) o += 0.15;
  for (const p of pairs) {
    const d = sim.dragons.find((q) => q.id === p.dragon)!, k = sim.keepers.find((q) => q.id === p.keeper);
    if (d.mood >= 0.5) o += 0.05;
    if (k && k.specialty === OWN_NEED[d.element]) o += 0.05;
  }
  return Math.max(0.05, Math.min(0.95, Math.round(o * 100) / 100));
}

/**
 * A trip out on a mission: the region's mission at the difficulty, the best team of two pairs of the world's grown barn
 * dragons with auto riders (S8's BEST TEAM over pairs -- the highest odds, ties to lower ids -- among the teams that
 * meet the mission's baddie, when any can), its stops, and the outcome
 * as asked (not rolled: a preview shows the road it is told to). On a failure the team turns back at the first
 * uncovered stop (else the last); on a success it brings the region's egg home (its first success there is sure) and
 * the baddie takes its exit. Not departed: the caller sets `departAt` / `returnAt` and `state`.
 */
export function demoTrip(sim: CareSim, region: RegionId, difficulty: Difficulty, success: boolean): Trip {
  const m = demoMission(sim, region, difficulty);
  const able = sim.dragons.filter((d) => d.place === 'barn' && (d.stage === 'adult' || d.stage === 'elder'));
  // (the best team that meets the baddie, if any can: the preview is for watching the beat, both counters' moments
  // and its cozy exit; then the highest odds, ties to lower ids)
  let best: { pairs: Pair[]; stops: Stop[]; odds: number; meets: boolean } | null = null;
  for (let a = 0; a < able.length; a++) for (let b = a + 1; b < able.length; b++) {
    const ds = [able[a], able[b]], rs = autoRiders(sim, m, ds);
    const pairs = ds.map((d, i) => ({ dragon: d.id, keeper: rs[i]?.id ?? -1 })).filter((p) => p.keeper >= 0);
    if (pairs.length < 2) continue;
    const stops = demoStops(sim, m, pairs), odds = demoOdds(sim, stops, pairs), meets = stops.some((s) => s.kind === 'baddie' && s.covered);
    if (!best || (meets && !best.meets) || (meets === best.meets && odds > best.odds)) best = { pairs, stops, odds, meets };
  }
  if (!best) throw new Error('trip: no two dragons can go');
  const { pairs, stops, odds } = best;
  const first = stops.findIndex((s) => !s.covered);
  const R = REGION_DATA[region];
  const egg = success ? R.eggs[rngAt(sim.seed, TAG.EGG, m.id, 1).int(0, R.eggs.length - 1)] : null;
  return {
    mission: m, pairs, odds, success, egg, nest: egg ? 0 : null, stops,
    turnBack: success ? null : first >= 0 ? first : stops.length - 1,
    state: 'away', departAt: null, returnAt: null,
    exit: success && m.baddie ? BADDIE_DATA[m.baddie].exit : null,
  };
}

/** A parsed `trip=<region>:<progress>[:fail]` (progress 0..1 of the trip's length at the frozen frame), or null. */
export interface TripParam { region: RegionId; progress: number; fail: boolean }
export function parseTripParam(v: string | null | undefined): TripParam | null {
  const [r, p, f] = (v || '').split(':');
  const progress = p == null || p.trim() === '' ? NaN : Number(p);
  if (!(REGION_IDS as readonly string[]).includes(r) || !Number.isFinite(progress)) return null;
  return { region: r as RegionId, progress: Math.max(0, Math.min(1, progress)), fail: f === 'fail' };
}
