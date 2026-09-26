// Missions (docs/BASE_DESIGN.md 5): the Map Room table's board, who may go, the odds, sending a team, and
// the trip itself -- the muster on the Aerie, the walk west over the sky bridge, the days away, the landing, the egg
// carried down to the Hatchery, the saddles hung back in the Tack Room and the riders' rest in the Bunks. DOM-free and
// deterministic: every draw is a stateless rngAt (the board by its day, a mission's outcome and egg by its id), every
// loop is in id order, and the whole state is plain data the save keeps (CareSim.missions).
//
// The board (rollBoard) is rolled at the world's first step and at every 05:00 (the dawn: the one other place the
// simulation reads the day's hour, BASE_DESIGN 7 -- the board, never the barn's care): the regions a success revealed join
// the explored ones first, then one mission per explored region, in a shuffled order, up to three. Day 1 always has
// THE LOST NEST (Millbrook, easy: a spring flood and lost things, a sure egg): two of the seven starters can meet it.
// A region's first success always brings an egg home (if a nest is free).
//
// A team is one or two pairs, a dragon and its rider (one of the four keepers, each with a rider's skill:
// regions.ts KEEPER_SKILL). One team is out at a time, and two keepers always stay home. A dragon's partner is the
// keeper whose specialty is its element's own need (Bea for fire, Tomas for spike, rock and slinkwing, Pip for
// lightning, Iris for dusk; water has none): a pair of partners goes 5 % better. A challenge is met by a team dragon of
// its element or a rider of its skill (the chooser shows who, up front); a big baddie needs both of its counters.
//
// Sending (send) rolls the whole road at once (the outcome, the egg, the stops and the turn-back), counts the Map Room
// used, and starts the muster: the team's dragons leave whatever they were doing once they may (a keeper at work
// finishes; a ride in hand is ridden) and ride the Dragon Lift up to the Aerie at the car's first priority, each to
// the westmost free spot on the deck as it gets there; the riders walk to the Tack Room, take their saddles (the Tack
// Room used) and climb the left tower's ladder to the deck, beside their dragons. All there, the team walks west off
// the deck over the sky bridge (the Aerie used: it stands in for `fly`, which rock can't anyway) and is away: not
// drawn, its dragons' needs frozen, their jobs and stage-ups waiting, its riders nobody's to call. `days` game days
// later it lands on the bridge and walks back onto the deck (the Aerie used again): the coin is paid, food and sleep
// are down a little (a burst of bubbles; nobody is hurt), each dragon walks back down into the barn to the nearest free
// slot and its needs take over; the rider carrying the egg lays it in the reserved nest (sim.addEgg: the Hatchery), and
// every rider hangs the saddle back in the Tack Room and rests a while in the Bunks (the Bunks used) -- a rider resting
// may be called to a job -- then goes back to their station. The trip is over when every pair has landed; a success
// reveals the region's unexplored neighbours at the next dawn.
import type { DragonElement } from '../art/dragon/palettes.ts';
import { OWN_NEED } from './needs.ts';
import { readClock, hourSteps, PHASE_HOURS } from './clock.ts';
import { rngAt, TAG } from './rand.ts';
import { AERIE_F, NESTS, BRIDGE_X0, nestX, postX, feetY } from './layout.ts';
import type { Room, RoomKind } from './layout.ts';
import { routeTo, nearestFree, sendTo, dragonInBay, faceWay, raiseCall } from './travel.ts';
import { CHALLENGES, BADDIES, REGIONS, KEEPER_SKILL, regionOf } from './regions.ts';
import type { Counter } from './regions.ts';
import type { RegionId, ChallengeId, Difficulty } from './missiondata.ts';
import type { Mission, Pair, Stop, Trip } from './trip.ts';
import type { CareSim, Dragon, Keeper } from './sim.ts';
// (a value read only while stepping, never as this module loads: sim.ts imports this one)
import { PICKUP } from './sim.ts';

/** What the save keeps of the missions: the board and the day it was rolled for, the map's regions, the coin, and the trip out (with each pair's deck spot). */
export interface MissionsState {
  /** The day the board was last rolled for (1-based). */
  day: number;
  board: Mission[];
  /** Regions on the map (explored), revealed at the next dawn (pending), and those a team has come home from successfully. */
  explored: RegionId[];
  pendingReveal: RegionId[];
  firstSuccess: RegionId[];
  coin: number;
  trip: Trip | null;
  /** Each pair's spot on the Aerie deck (an index into DECK_SPOTS), taken as its dragon reaches the deck; null until then. */
  deck: (number | null)[];
  /** Missions sent in all. */
  sent: number;
}

/**
 * Whether the player has taken a keeper by hand (then no automatic pick may choose them to ride): the keeper held
 * (`manual`) or taken at work and finishing that job first (`pendingTake`) -- CareSim.controlled, the same keepers
 * CareSim.free leaves out of every automatic job pick (control.ts). The picks below take it as a parameter, so a test
 * may hand them its own.
 */
export type Taken = (sim: CareSim, keeperId: number) => boolean;
export const isTaken: Taken = (sim, keeperId) => sim.controlled === keeperId;

// ---------- numbers (BASE_DESIGN 5) ----------

/** The most missions on the board, and each difficulty's chance, challenges, days, coin and egg chance. */
export const BOARD_MAX = 3;
export const DIFFICULTY: Readonly<Record<Difficulty, { p: number; challenges: number; days: number; coin: number; egg: number }>> = Object.freeze({
  easy: { p: 0.4, challenges: 2, days: 1, coin: 40, egg: 0.35 },
  normal: { p: 0.4, challenges: 3, days: 2, coin: 80, egg: 0.35 },
  hard: { p: 0.2, challenges: 3, days: 3, coin: 150, egg: 0.6 },
});
/** A hard road ends in its region's baddie from this day on (before it, a hard road has a fourth challenge). */
export const BADDIE_FROM_DAY = 3;
/**
 * A baddie's day: BADDIE_FROM_DAY and every BADDIE_EVERY days after it, the first region on the board that has a baddie
 * shows its hard road, so a big baddie is always to be met early (on the other days a hard road is the roll's chance).
 */
export const BADDIE_EVERY = 4;
/** Whether day `day` is a baddie's day (BADDIE_EVERY). */
export function baddieDay(day: number): boolean { return day >= BADDIE_FROM_DAY && (day - BADDIE_FROM_DAY) % BADDIE_EVERY === 0; }
/** Day 1's sure mission. */
export const LOST_NEST = 'THE LOST NEST';
/** At most this many pairs; and this many keepers always stay home. */
export const MAX_PAIRS = 2, HOME_KEEPERS = 2;
/** The odds (BASE_DESIGN 5): a base, per challenge met, the baddie met, per pair in good spirits (mood >= GOOD_MOOD), per pair of partners; clamped. */
export const ODDS = Object.freeze({ base: 0.2, challenge: 0.15, baddie: 0.15, mood: 0.05, partners: 0.05, min: 0.05, max: 0.95, goodMood: 0.5 });
/** Where the team gathers on the Aerie deck: the dragons (world x, facing west) and each rider beside, just behind its dragon. */
export const DECK_SPOTS: readonly number[] = Object.freeze([120, 280]);
export const RIDER_SPOTS: readonly number[] = Object.freeze([211, 371]);
/** The sky bridge's far end (world x on the Aerie's floor): the team walks off it, and lands on it. A walker past DEPART_X is gone. */
export const BRIDGE_X = BRIDGE_X0, DEPART_X = -120;
/** On landing, the lead dragon (the one going furthest along the deck) starts this far along the bridge (still off screen), the other at its end. */
export const LAND_LEAD_X = -60;
/** On landing, the lead pair's rider starts this far behind its dragon (the other rider at the bridge's end, 110 px behind). */
export const RIDER_LAND_GAP = 30;
/** Steps a rider rests in the Bunks after a trip (15 s). A saddle is taken down or hung back in sim.ts PICKUP's steps, as a supply is. */
export const REST_STEPS = 900;
/** Needs on landing: food and sleep at most this (a success, a failure): the trip was long. */
export const LAND_NEEDS = Object.freeze({ success: 0.45, failure: 0.3 });
/** Where a stop sits on the road: challenge i of n at (i + 1) / (n + 1) of ROAD_SPAN, the baddie at BADDIE_AT. */
export const ROAD_SPAN = 0.85, BADDIE_AT = 0.9;

// ---------- the board ----------

/** The missions' state for a new world: the start regions explored, nothing else yet (the board is rolled by rollBoard). */
export function newMissions(): MissionsState {
  return { day: 0, board: [], explored: REGIONS.filter((r) => r.start).map((r) => r.id), pendingReveal: [], firstSuccess: [], coin: 0, trip: null, deck: [], sent: 0 };
}

/**
 * One region's mission for a day (its difficulty, road and title drawn from rngAt(seed, BOARD, day, region index)); `hard`:
 * a hard road whatever the roll (a baddie's day: boardFor).
 */
function missionFor(seed: number, day: number, slot: number, ri: number, firstSuccess: readonly RegionId[], hard = false): Mission {
  const region = REGIONS[ri], r = rngAt(seed, TAG.BOARD, day, ri), roll = r.next();
  const difficulty: Difficulty = hard ? 'hard' : roll < DIFFICULTY.easy.p ? 'easy' : roll < DIFFICULTY.easy.p + DIFFICULTY.normal.p ? 'normal' : 'hard';
  const D = DIFFICULTY[difficulty];
  const baddie = difficulty === 'hard' && day >= BADDIE_FROM_DAY ? region.baddie : null;
  const n = difficulty === 'hard' && !baddie ? D.challenges + 1 : D.challenges;
  const pool = region.pool.slice(), challenges: ChallengeId[] = [];
  for (let i = 0; i < n && pool.length; i++) challenges.push(pool.splice(r.int(0, pool.length - 1), 1)[0]);
  const title = baddie && region.baddieTitle ? region.baddieTitle : region.titles[r.int(0, region.titles.length - 1)];
  return { id: day * 4 + slot, region: region.id, title, difficulty, challenges, baddie, days: D.days, coin: D.coin, eggChance: D.egg, guaranteedEgg: !firstSuccess.includes(region.id) };
}

/**
 * The board for a day (a pure function of the seed, the day and the map): one mission per explored region, in the
 * order rngAt(seed, BOARD, day) shuffles them, up to BOARD_MAX; on day 1 THE LOST NEST first (Millbrook, easy, the
 * flood and lost things, a sure egg); on a baddie's day (baddieDay) the first region on it with a baddie shows its hard
 * road, ending in the baddie. A mission's id is its day x 4 + its place on the board.
 */
export function boardFor(seed: number, day: number, explored: readonly RegionId[], firstSuccess: readonly RegionId[]): Mission[] {
  const idx = REGIONS.map((r, i) => (explored.includes(r.id) ? i : -1)).filter((i) => i >= 0), r = rngAt(seed, TAG.BOARD, day);
  for (let i = idx.length - 1; i > 0; i--) { const j = r.int(0, i); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  const mill = REGIONS.findIndex((q) => q.id === 'millbrook');
  if (day === 1 && idx.includes(mill)) { idx.splice(idx.indexOf(mill), 1); idx.unshift(mill); }
  const on = idx.slice(0, BOARD_MAX), hard = baddieDay(day) ? on.find((ri) => REGIONS[ri].baddie) : undefined;
  return on.map((ri, slot) => {
    if (day === 1 && ri === mill) {
      return { id: day * 4 + slot, region: 'millbrook', title: LOST_NEST, difficulty: 'easy', challenges: ['flood', 'lost'], baddie: null, days: 1, coin: DIFFICULTY.easy.coin, eggChance: DIFFICULTY.easy.egg, guaranteedEgg: true };
    }
    return missionFor(seed, day, slot, ri, firstSuccess, ri === hard);
  });
}

/** A new world's first board: for the day it starts on (its clock0's). */
export function firstBoard(sim: CareSim): void { rollBoard(sim, readClock(sim.clock0, sim.dayLen).day); }

/** Roll the board for `day` (the regions revealed since first joining the map). */
export function rollBoard(sim: CareSim, day: number): void {
  const m = sim.missions;
  for (const id of m.pendingReveal) if (!m.explored.includes(id)) m.explored.push(id);
  m.explored.sort((a, b) => REGIONS.findIndex((r) => r.id === a) - REGIONS.findIndex((r) => r.id === b));
  m.pendingReveal = [];
  m.day = day;
  m.board = boardFor(sim.seed, day, m.explored, m.firstSuccess);
}

// ---------- who may go ----------

/** A keeper's phases on a trip (not free for jobs, nor to be taken by hand): mustering, leaving, away, landing and delivering. */
export const TRIP_PHASES: ReadonlySet<string> = new Set(['muster', 'depart', 'away', 'deliver']);
/** Whether a keeper is on a trip (the badge's arrow; control.ts take refuses them). */
export function onTrip(k: Keeper): boolean { return TRIP_PHASES.has(k.phase); }

/** A dragon's partner: the keeper whose specialty is its element's own need (lowest id), or null (water: nobody specialises in baths). */
export function partnerOf(sim: CareSim, d: Dragon): Keeper | null { return sim.keepers.find((k) => k.specialty === OWN_NEED[d.element]) ?? null; }

/** Why a dragon may not go on mission m (the chooser's greyed reason), or null: it may. */
export function dragonReason(sim: CareSim, d: Dragon, m: Mission | null): string | null {
  if (d.place === 'garden' || d.goal === 'retire') return 'IN THE GARDEN';
  if (d.place === 'away' || d.goal === 'muster' || sim.missions.trip?.pairs.some((p) => p.dragon === d.id)) return 'AWAY';
  if (d.stage === 'baby') return 'BABY';
  if (d.stage === 'young' && m && m.difficulty !== 'easy') return 'TOO YOUNG';
  return null;
}

/** Whether a keeper can ride: not on a trip, not taken by hand (isTaken: BASE_DESIGN 4.10). */
export function freeRider(sim: CareSim, k: Keeper, taken: Taken = isTaken): boolean {
  return !onTrip(k) && !taken(sim, k.id) && !sim.missions.trip?.pairs.some((p) => p.keeper === k.id);
}

/** Whether a dragon or a rider meets a counter. */
function meets(c: Counter, d: Dragon | null, k: Keeper | null): boolean {
  return (!!c.element && !!d && d.element === c.element) || (!!c.skill && !!k && KEEPER_SKILL[k.look] === c.skill);
}

const dragonOf = (sim: CareSim, id: number): Dragon => { const d = sim.dragons.find((q) => q.id === id); if (!d) throw new Error(`missions: no dragon ${id}`); return d; };
const keeperOf = (sim: CareSim, id: number): Keeper => { const k = sim.keepers.find((q) => q.id === id); if (!k) throw new Error(`missions: no keeper ${id}`); return k; };

/** Who on the team meets a counter: the names (a dragon's for an element, a rider's for a skill), in pair order. */
function whoMeets(sim: CareSim, c: Counter, pairs: readonly Pair[]): string[] {
  const out: string[] = [];
  for (const p of pairs) {
    const d = dragonOf(sim, p.dragon), k = keeperOf(sim, p.keeper);
    if (meets(c, d, null)) out.push(d.name);
    if (meets(c, null, k)) out.push(k.name);
  }
  return out;
}

/** What a team meets on a mission: each challenge (who meets it: empty if nobody), and the baddie (both of its counters' first meeters, or null if it isn't met), plus the count met. */
export function coverage(sim: CareSim, m: Mission, pairs: readonly Pair[]): { challenges: string[][]; baddie: string[] | null; covered: number } {
  const challenges = m.challenges.map((c) => whoMeets(sim, CHALLENGES[c].counter, pairs));
  let baddie: string[] | null = null;
  if (m.baddie) {
    const [a, b] = BADDIES[m.baddie].counters.map((c) => whoMeets(sim, c, pairs));
    baddie = a.length && b.length ? [a[0], b[0]] : null;
  }
  return { challenges, baddie, covered: challenges.filter((w) => w.length).length };
}

/** The team's odds of a success (BASE_DESIGN 5), clamped to 5-95 %. */
export function oddsOf(sim: CareSim, m: Mission, pairs: readonly Pair[]): number {
  if (!pairs.length) return 0;
  const cov = coverage(sim, m, pairs);
  let o = ODDS.base + ODDS.challenge * cov.covered + (m.baddie && cov.baddie ? ODDS.baddie : 0);
  for (const p of pairs) {
    const d = dragonOf(sim, p.dragon);
    if (d.mood >= ODDS.goodMood) o += ODDS.mood;
    if (partnerOf(sim, d)?.id === p.keeper) o += ODDS.partners;
  }
  return Math.round(Math.max(ODDS.min, Math.min(ODDS.max, o)) * 1e6) / 1e6;
}

/**
 * The rider a dragon gets on mission m, beside the pairs already chosen (`others`): its partner, if free and not
 * riding already; else a free keeper whose skill meets a challenge (or the baddie) the team, this dragon in it, leaves
 * unmet, lowest id first; else any free keeper, lowest id first. Never a keeper taken by hand (`taken`: isTaken,
 * BASE_DESIGN 4.10), nor one on a trip; null if nobody is free, or the team would leave fewer than two keepers home.
 */
export function autoRider(sim: CareSim, d: Dragon, m: Mission, others: readonly Pair[], taken: Taken = isTaken): number | null {
  if (others.length + 1 > sim.keepers.length - HOME_KEEPERS) return null;
  const free = sim.keepers.filter((k) => freeRider(sim, k, taken) && !others.some((p) => p.keeper === k.id));
  if (!free.length) return null;
  const partner = partnerOf(sim, d);
  if (partner && free.includes(partner)) return partner.id;
  const team = [...others.map((p) => dragonOf(sim, p.dragon)), d], riders = others.map((p) => keeperOf(sim, p.keeper));
  const unmet = (c: Counter) => !team.some((q) => meets(c, q, null)) && !riders.some((k) => meets(c, null, k));
  const wanted: Counter[] = [...m.challenges.map((c) => CHALLENGES[c].counter), ...(m.baddie ? BADDIES[m.baddie].counters : [])].filter(unmet);
  const skilled = free.find((k) => wanted.some((c) => meets(c, null, k)));
  return (skilled ?? free[0]).id;
}

/**
 * The best team for mission m: every eligible dragon alone, and every two of them (in id order), each with its auto
 * rider; the highest odds win, then fewer pairs, then the lower dragon ids. Empty if nobody can go.
 */
export function bestTeam(sim: CareSim, m: Mission, taken: Taken = isTaken): Pair[] {
  const can = sim.dragons.filter((d) => !dragonReason(sim, d, m));
  const teams: Pair[][] = [];
  const build = (ds: Dragon[]): Pair[] | null => {
    const out: Pair[] = [];
    for (const d of ds) { const k = autoRider(sim, d, m, out, taken); if (k == null) return null; out.push({ dragon: d.id, keeper: k }); }
    return out;
  };
  for (const a of can) { const t = build([a]); if (t) teams.push(t); }
  for (let i = 0; i < can.length; i++) for (let j = i + 1; j < can.length; j++) { const t = build([can[i], can[j]]); if (t) teams.push(t); }
  let best: Pair[] = [], bestOdds = -1;
  for (const t of teams) {
    const o = oddsOf(sim, m, t);
    if (o > bestOdds || (o === bestOdds && t.length < best.length)) { best = t; bestOdds = o; }
  }
  return best;
}

/** The lowest nest with no egg in it, or null (or no Hatchery). */
export function freeNest(sim: CareSim): number | null {
  if (!sim.rooms.some((r) => r.kind === 'hatchery')) return null;
  for (let i = 0; i < NESTS; i++) if (!sim.eggs.some((e) => e.nest === i)) return i;
  return null;
}

/** Why a team can't be sent on mission m now (the chooser's greyed SEND), or null: it can. */
export function canSend(sim: CareSim, m: Mission | null, pairs: readonly Pair[], taken: Taken = isTaken): string | null {
  if (sim.missions.trip) return 'A TEAM IS ALREADY OUT';
  if (!m || !sim.missions.board.some((q) => q.id === m.id)) return 'PICK A MISSION';
  if (!pairs.length) return 'PICK A DRAGON';
  if (pairs.length > MAX_PAIRS || pairs.length > sim.keepers.length - HOME_KEEPERS) return 'NOT ENOUGH KEEPERS HOME';
  const ds = new Set<number>(), ks = new Set<number>();
  for (const p of pairs) {
    const d = sim.dragons.find((q) => q.id === p.dragon), k = sim.keepers.find((q) => q.id === p.keeper);
    if (!d || ds.has(p.dragon)) return 'PICK A DRAGON';
    const why = dragonReason(sim, d, m);
    if (why) return why === 'TOO YOUNG' ? 'TOO YOUNG FOR THIS ONE' : `${d.name} IS ${why === 'BABY' ? 'A BABY' : why}`;
    if (!k || ks.has(p.keeper) || !freeRider(sim, k, taken)) return 'NOT ENOUGH KEEPERS HOME';
    ds.add(p.dragon); ks.add(p.keeper);
  }
  return null;
}

// ---------- sending ----------

/** Whether a mission is day 1's LOST NEST (the tutorial: met in full, it always succeeds). */
export function tutorial(m: Mission): boolean { return m.title === LOST_NEST && m.region === 'millbrook' && m.id < 8; }

/**
 * The trip log's line for a stop (a failure met at every stop turns back at the last one, and says why: the weather),
 * always `NAME - WHO WHAT`: the watchable scene's banner shows the part before ` - ` as the stop is reached
 * (missionview.ts), and the whole line once it is met.
 */
function logLine(stop: Stop, turn: boolean, success: boolean): string {
  if (stop.kind === 'baddie') {
    const b = BADDIES[stop.baddie!];
    if (!success) return `${b.name} - IT KEEPS THE ROAD. HOME FOR TEA. NOBODY IS HURT.`;
    return stop.covered ? `${b.name} - ${stop.by.join(' AND ')}: IT ${b.how}` : `${b.name} - NOBODY COULD HELP, BUT IT ${b.how}`;
  }
  const c = CHALLENGES[stop.challenge!];
  if (turn && stop.covered) return `${c.name} - ${stop.by[0]} ${c.met}. THEN THE WEATHER TURNS: THEY HEAD HOME`;
  return stop.covered ? `${c.name} - ${stop.by[0]} ${c.met}` : `${c.name} - NOBODY COULD HELP: ${turn ? 'THEY TURN BACK FOR HOME' : 'THEY WAIT IT OUT'}`;
}

/**
 * The road a team would meet on mission m (BASE_DESIGN 5): each challenge at (i + 1) / (n + 1) of ROAD_SPAN of the way, the
 * baddie at BADDIE_AT, each with whether the team meets it and who; on a failure, the stop it turns back at (the first
 * one unmet, else the last); and each stop's log line.
 */
export function roadOf(sim: CareSim, m: Mission, pairs: readonly Pair[], success: boolean): { stops: Stop[]; turnBack: number | null } {
  const cov = coverage(sim, m, pairs), n = m.challenges.length;
  const stops: Stop[] = m.challenges.map((c, i) => ({ kind: 'challenge', challenge: c, baddie: null, at: ((i + 1) / (n + 1)) * ROAD_SPAN, covered: cov.challenges[i].length > 0, by: cov.challenges[i].slice(0, 1), log: '' }));
  if (m.baddie) stops.push({ kind: 'baddie', challenge: null, baddie: m.baddie, at: BADDIE_AT, covered: !!cov.baddie, by: cov.baddie ?? [], log: '' });
  let turnBack: number | null = null;
  if (!success) { const u = stops.findIndex((s) => !s.covered); turnBack = u >= 0 ? u : stops.length - 1; }
  for (let i = 0; i < stops.length; i++) (stops[i] as { log: string }).log = logLine(stops[i], i === turnBack, success);
  return { stops, turnBack };
}

/**
 * Send a team on board mission `missionId` (the Map Room table's SEND): refused with canSend's reason, else
 * the whole trip rolled now -- the outcome (rngAt(seed, MISSION, id) under the odds), the nest reserved and the egg
 * (sure on a region's first success, else rngAt(seed, EGG, id) under its chance; its element one of the region's), the
 * road and its turn-back -- the mission taken off the board, the Map Room counted, and the muster begun (musterStart).
 * `awaySteps`: a test's own trip length (else the mission's days).
 */
export function send(sim: CareSim, missionId: number, pairs: readonly Pair[], opts: { taken?: Taken; awaySteps?: number } = {}): Trip | string {
  const m = sim.missions.board.find((q) => q.id === missionId) ?? null;
  const why = canSend(sim, m, pairs, opts.taken);
  if (why) return why;
  const mission = m!, odds = oddsOf(sim, mission, pairs);
  // (day 1's LOST NEST is the first mission: a team meeting both of its challenges always brings its sure egg home)
  const success = (tutorial(mission) && coverage(sim, mission, pairs).covered === mission.challenges.length) || rngAt(sim.seed, TAG.MISSION, mission.id).next() < odds;
  const region = regionOf(mission.region), nest = freeNest(sim);
  let egg: DragonElement | null = null;
  if (success && nest != null && (mission.guaranteedEgg || rngAt(sim.seed, TAG.EGG, mission.id).next() < mission.eggChance)) egg = region.eggs[rngAt(sim.seed, TAG.EGG, mission.id, 1).int(0, region.eggs.length - 1)];
  const { stops, turnBack } = roadOf(sim, mission, pairs, success);
  const exit = success && mission.baddie ? BADDIES[mission.baddie].exit : null;
  const trip: Trip & { awaySteps?: number } = { mission, pairs: pairs.map((p) => ({ ...p })), odds, success, egg, nest: egg ? nest : null, stops, turnBack, state: 'muster', departAt: null, returnAt: null, exit };
  if (opts.awaySteps != null) trip.awaySteps = opts.awaySteps;
  const ms = sim.missions;
  ms.board = ms.board.filter((q) => q.id !== mission.id);
  ms.trip = trip; ms.deck = pairs.map(() => null); ms.sent++;
  sim.use('maproom', roomOf(sim, 'maproom'));
  musterStart(sim, trip);
  return trip;
}

// ---------- the trip ----------

/** The team's dragons and riders. */
const teamDragons = (sim: CareSim, t: Trip): Dragon[] => t.pairs.map((p) => dragonOf(sim, p.dragon));
const teamRiders = (sim: CareSim, t: Trip): Keeper[] => t.pairs.map((p) => keeperOf(sim, p.keeper));

/**
 * A dragon's jobs are dropped -- a keeper coming for one gives it back and goes home (not a pre-emption) -- but a keeper
 * already at work with it finishes (the job is done then, as any is: CareSim.finish, its goalJob cleared here); the
 * dragon keeps its slot until it sets off (stepMuster), so no other dragon walks into the place it is still met or
 * sleeping in. `atOnce` (a team sent away at once: awayNow): every keeper gives its job back, and the dragon's act and
 * nap end where they got to, its slot let go.
 */
function leaveBarn(sim: CareSim, d: Dragon, atOnce = false): void {
  const finishes = (k: Keeper | null) => !atOnce && !!k && k.phase === 'work';
  for (const k of sim.keepers) if (k.job && k.job.dragon === d && !finishes(k)) sim.drop(k);
  sim.jobs = sim.jobs.filter((j) => j.dragon !== d || finishes(j.keeper));
  d.goalJob = null;
  if (atOnce) { d.act = null; d.asleep = 0; d.slot = null; }
}

/**
 * The muster begins: each rider leaves their job for the Tack Room (one under way stops where it got to, a tuck-in
 * excepted: CareSim.unjob), then each dragon's goal is the muster (it asks for nothing now: leaveBarn).
 */
function musterStart(sim: CareSim, t: Trip): void {
  for (const k of teamRiders(sim, t)) {
    sim.unjob(k);
    k.phase = 'muster'; k.t = 0; k.carrying = null;
    sim.walkTo(k, tackSpot(sim));
  }
  for (const d of teamDragons(sim, t)) { leaveBarn(sim, d); d.goal = 'muster'; }
}

/** The riders' room of a kind (the Tack Room, the Bunks, the Map Room: the left tower's, one each), or null if the base has none. */
function roomOf(sim: CareSim, kind: RoomKind): Room | null { return sim.rooms.find((q) => q.kind === kind) ?? null; }
/** Where a rider takes a saddle down and hangs it back: the Tack Room's post (the left tower's ground floor). */
function tackSpot(sim: CareSim): { f: number; x: number } { const r = roomOf(sim, 'tack')!; return { f: r.floor, x: postX(r) }; }
/** Where a rider rests after a trip: the Bunks' post. */
function bunksSpot(sim: CareSim): { f: number; x: number } { const r = roomOf(sim, 'bunks')!; return { f: r.floor, x: postX(r) }; }

/** Whether a dragon may be sent somewhere new now (as travel.ts redirectable, whatever its goal): not being met, awake, not holding, not in the lift's hands or its bay. */
function mayGo(sim: CareSim, d: Dragon): boolean {
  return !d.act && d.asleep === 0 && d.hold === 0 && sim.lift.rider !== d.id && !['board', 'ride', 'alight'].includes(d.move) && !dragonInBay(d);
}

/** Whether a dragon's route ends at (f, x) (it is already going there), or it stands there. */
const headed = (d: { f: number; x: number; legs: readonly { f: number; x: number }[] }, f: number, x: number) => {
  const last = d.legs[d.legs.length - 1];
  return last ? last.f === f && last.x === x : d.f === f && d.x === x;
};

/** A dragon standing at (f, x), done walking and turning. */
const standsAt = (d: Dragon, f: number, x: number) => !d.legs.length && d.move === 'still' && d.turn < 0 && d.f === f && d.x === x;
/** A keeper standing at (f, x). */
const keeperAt = (k: Keeper, f: number, x: number) => !k.legs.length && !k.climbing && k.f === f && k.x === x;

/** Route a dragon (once it may go) to (f, x), its lift calls at the car's first priority. */
function dragonTo(sim: CareSim, d: Dragon, f: number, x: number): void {
  if (headed(d, f, x) || !mayGo(sim, d)) return;
  routeTo(sim, d, { f, x });
  raiseCall(sim, d);
}

/** A rider's target on the deck: beside their pair's dragon's spot (the pair's own index until its dragon has one). */
function riderSpot(sim: CareSim, i: number): number { return RIDER_SPOTS[sim.missions.deck[i] ?? i]; }

/** The muster (BASE_DESIGN 5): dragons up to the deck, riders via the Tack Room; all there, facing west, the team departs. */
function stepMuster(sim: CareSim, t: Trip): void {
  const ms = sim.missions;
  t.pairs.forEach((p, i) => {
    const d = dragonOf(sim, p.dragon);
    // (on reaching the deck, a dragon takes the westmost spot free: the first up never has the second walk through it)
    if (d.f === AERIE_F && ms.deck[i] == null && d.move !== 'ride') {
      const used = new Set(ms.deck.filter((s): s is number => s != null));
      ms.deck[i] = DECK_SPOTS.findIndex((_, s) => !used.has(s));
    }
    // (leftover jobs: none opens for a mustering dragon, but one open at the send may have been re-queued by a Rush)
    if (sim.jobs.some((j) => j.dragon === d && j.keeper?.phase !== 'work')) leaveBarn(sim, d);
    // (its slot is let go as it sets off: met to the end of a job under way, or asleep, it keeps its place till then)
    if (d.slot && mayGo(sim, d)) d.slot = null;
    dragonTo(sim, d, AERIE_F, DECK_SPOTS[ms.deck[i] ?? i]);
    if (standsAt(d, AERIE_F, DECK_SPOTS[ms.deck[i] ?? i]) && d.facing !== -1) faceWay(d, -1);
  });
  t.pairs.forEach((p, i) => {
    const k = keeperOf(sim, p.keeper);
    if (k.carrying !== 'saddle') {
      // to the Tack Room, and the saddle taken down there
      if (k.legs.length) { sim.move(k); return; }
      if (++k.t >= PICKUP) { k.carrying = 'saddle'; k.t = 0; sim.use('tack', roomOf(sim, 'tack')); sim.walkTo(k, { f: AERIE_F, x: riderSpot(sim, i) }); }
      return;
    }
    const x = riderSpot(sim, i);
    if (!headed(k, AERIE_F, x) && !k.climbing) sim.walkTo(k, { f: AERIE_F, x });
    if (k.legs.length) sim.move(k);
    else k.facing = -1;
  });
  const ready = t.pairs.every((p, i) => {
    const d = dragonOf(sim, p.dragon), k = keeperOf(sim, p.keeper), s = ms.deck[i];
    return s != null && standsAt(d, AERIE_F, DECK_SPOTS[s]) && d.facing === -1 && k.carrying === 'saddle' && keeperAt(k, AERIE_F, RIDER_SPOTS[s]);
  });
  if (!ready) return;
  // all on the deck: they walk west off it, over the sky bridge (#11: the Aerie used)
  t.state = 'depart';
  sim.use('aerie');
  for (const d of teamDragons(sim, t)) routeTo(sim, d, { f: AERIE_F, x: BRIDGE_X });
  for (const k of teamRiders(sim, t)) { k.phase = 'depart'; sim.walkTo(k, { f: AERIE_F, x: BRIDGE_X }); }
}

/** The team leaves over the bridge: once the last of them is past DEPART_X, it is away for its days. */
function stepDepart(sim: CareSim, t: Trip): void {
  for (const k of teamRiders(sim, t)) if (k.legs.length) sim.move(k);
  const gone = teamDragons(sim, t).every((d) => d.f === AERIE_F && d.x < DEPART_X) && teamRiders(sim, t).every((k) => k.f === AERIE_F && k.x < DEPART_X);
  if (!gone) return;
  goAway(sim, t, sim.clock);
}

/** The team is away from `departAt` for its days (or a test's awaySteps): its dragons off the map, its riders away, at the bridge's end. */
function goAway(sim: CareSim, t: Trip, departAt: number): void {
  t.state = 'away';
  t.departAt = departAt;
  t.returnAt = t.departAt + ((t as { awaySteps?: number }).awaySteps ?? t.mission.days * sim.dayLen);
  for (const d of teamDragons(sim, t)) {
    d.place = 'away'; d.slot = null; d.legs = []; d.move = 'still'; d.gaitT = 0; d.turn = -1; d.waited = 0; d.f = AERIE_F; d.x = BRIDGE_X; d.facing = -1;
  }
  for (const k of teamRiders(sim, t)) { k.phase = 'away'; k.legs = []; k.f = AERIE_F; k.x = BRIDGE_X; k.y = feetY(AERIE_F); k.facing = -1; }
}

/**
 * A trip made away at once, as if it had been sent, mustered and had left the Aerie at `departAt` (the `trip` preset,
 * presets.ts tripStart: a team that far along its road at the frozen step): the world's trip, each pair on its own deck
 * spot for the landing, its dragons' jobs and slots let go (their goal the team's), its riders' jobs let go, each with
 * the saddle -- then away exactly as a team that walked off over the sky bridge (goAway). No room is counted used: no
 * one sent it from the Map Room, fetched a saddle or left the Aerie. Only for a world with no trip out.
 */
export function awayNow(sim: CareSim, t: Trip, departAt: number): void {
  if (sim.missions.trip) throw new Error('missions: a team is already out');
  const ms = sim.missions;
  ms.trip = t; ms.deck = t.pairs.map((_, i) => i);
  for (const k of teamRiders(sim, t)) { sim.unjob(k); k.t = 0; k.carrying = 'saddle'; k.climbing = false; }
  for (const d of teamDragons(sim, t)) { leaveBarn(sim, d, true); d.goal = 'muster'; }
  goAway(sim, t, departAt);
}

/**
 * The team lands (at returnAt, exactly): on the bridge, walking east onto the deck (#11: the Aerie used); the coin paid;
 * food and sleep down to LAND_NEEDS at most; the riders set off down -- the one with the egg to its nest, the others to
 * the Tack Room with their saddles.
 */
function land(sim: CareSim, t: Trip): void {
  t.state = 'return';
  sim.use('aerie');
  sim.missions.coin += t.success ? t.mission.coin : Math.floor(t.mission.coin / 2);
  const cap = t.success ? LAND_NEEDS.success : LAND_NEEDS.failure;
  // (the pair going furthest along the deck leads, a little way along the bridge, so the two never land one on the other)
  const order = t.pairs.map((_, i) => i).sort((a, b) => (sim.missions.deck[b] ?? b) - (sim.missions.deck[a] ?? a));
  order.forEach((i, n) => {
    const d = dragonOf(sim, t.pairs[i].dragon);
    d.place = 'barn'; d.f = AERIE_F; d.x = n === 0 && order.length > 1 ? LAND_LEAD_X : BRIDGE_X; d.facing = 1; d.legs = []; d.move = 'still';
    for (const k of ['food', 'sleep'] as const) d.needs[k] = Math.min(d.needs[k], cap);
    routeTo(sim, d, { f: AERIE_F, x: DECK_SPOTS[sim.missions.deck[i] ?? i] });
  });
  t.pairs.forEach((p, i) => {
    const k = keeperOf(sim, p.keeper);
    // (the lead pair's rider lands a little behind its dragon, the other at the bridge's end: never one on the other)
    k.phase = 'deliver'; k.f = AERIE_F; k.x = i === order[0] && order.length > 1 ? LAND_LEAD_X - RIDER_LAND_GAP : BRIDGE_X; k.y = feetY(AERIE_F); k.facing = 1; k.t = 0;
    k.carrying = t.egg && i === 0 ? 'egg' : 'saddle';
    sim.walkTo(k, k.carrying === 'egg' ? nestSpot(sim, t) : tackSpot(sim));
  });
}

/** Where the egg is laid: its reserved nest, in the Hatchery. */
function nestSpot(sim: CareSim, t: Trip): { f: number; x: number } {
  const r = sim.rooms.find((q) => q.kind === 'hatchery')!;
  return { f: r.floor, x: nestX(r, t.nest ?? 0) };
}

/** The landing: dragons back down into the barn; riders deliver the egg, hang the saddles, rest. Over when every pair has landed. */
function stepReturn(sim: CareSim, t: Trip): void {
  t.pairs.forEach((p, i) => {
    const d = dragonOf(sim, p.dragon);
    if (d.goal !== 'muster') return;
    const x = DECK_SPOTS[sim.missions.deck[i] ?? i];
    if (!standsAt(d, AERIE_F, x)) return;
    // on the deck: home again -- to the nearest free slot of its size, and its needs take over
    d.goal = null;
    const slot = nearestFree(sim, d, d.stage, ['hatchery']);
    if (slot) { d.goal = 'settle'; sendTo(sim, d, slot); raiseCall(sim, d); }
  });
  for (const k of teamRiders(sim, t)) if (k.phase === 'deliver') stepDeliver(sim, t, k);
  const home = teamDragons(sim, t).every((d) => d.goal !== 'muster') && teamRiders(sim, t).every((k) => !onTrip(k));
  if (!home) return;
  // the trip is over: a success reveals the region's neighbours at the next dawn
  t.state = 'home';
  const ms = sim.missions;
  if (t.success) {
    if (!ms.firstSuccess.includes(t.mission.region)) ms.firstSuccess.push(t.mission.region);
    for (const n of regionOf(t.mission.region).neighbours) if (!ms.explored.includes(n) && !ms.pendingReveal.includes(n)) ms.pendingReveal.push(n);
  }
  ms.trip = null; ms.deck = [];
}

/** A landed rider: the egg to its nest (laid there: the Hatchery), the saddle back in the Tack Room, then the Bunks to rest. */
function stepDeliver(sim: CareSim, t: Trip, k: Keeper): void {
  if (k.legs.length) { sim.move(k); return; }
  if (k.carrying === 'egg') {
    if (t.egg) sim.addEgg(t.egg, sim.clock, t.nest ?? undefined);
    k.carrying = 'saddle'; sim.walkTo(k, tackSpot(sim));
    return;
  }
  if (k.carrying === 'saddle') {
    if (++k.t < PICKUP) return;
    k.carrying = null; k.t = 0; sim.use('tack', roomOf(sim, 'tack')); sim.walkTo(k, bunksSpot(sim));
    return;
  }
  // at the Bunks: a rest (#11: the Bunks used); a keeper resting may be called to a job
  sim.use('bunks', roomOf(sim, 'bunks'));
  k.phase = 'rest'; k.t = 0;
}

/** A keeper resting in the Bunks after a trip: REST_STEPS, then back to their station (a job may call them first: sim.ts assign). */
function stepRest(sim: CareSim, k: Keeper): void {
  if (++k.t < REST_STEPS) return;
  k.t = 0; k.phase = 'home';
  sim.walkTo(k, { f: k.station.floor, x: k.stationX });
}

/**
 * The missions' half of a step (after the garden): at 05:00 the regions revealed join the map and the board is rolled
 * for the day; the trip steps on (the muster, the departure, the days away, the landing); keepers resting finish their
 * rest.
 */
export function stepMissions(sim: CareSim): void {
  const ms = sim.missions;
  if (sim.clock % sim.dayLen === PHASE_HOURS.dawn * hourSteps(sim.dayLen)) rollBoard(sim, readClock(sim.clock, sim.dayLen).day);
  const t = ms.trip;
  if (t) {
    if (t.state === 'muster') stepMuster(sim, t);
    else if (t.state === 'depart') stepDepart(sim, t);
    else if (t.state === 'away' && t.returnAt != null && sim.clock >= t.returnAt) land(sim, t);
    if (t.state === 'return') stepReturn(sim, t);
  }
  for (const k of sim.keepers) if (k.phase === 'rest') stepRest(sim, k);
}

/** Whether a dragon's lift call is the mission's (the muster up, or the way down after landing): the car's first priority. */
export function missionCall(sim: CareSim, d: Dragon): boolean {
  const t = sim.missions.trip;
  return d.goal === 'muster' || (!!t && t.state === 'return' && d.goal === 'settle' && t.pairs.some((p) => p.dragon === d.id));
}

/** Game hours left until the team lands (the TEAM OUT chip), rounded up; 0 when not away. */
export function hoursLeft(sim: CareSim, t: Trip): number {
  return t.state === 'away' && t.returnAt != null ? Math.max(0, Math.ceil((t.returnAt - sim.clock) / hourSteps(sim.dayLen))) : 0;
}

// ---------- saves ----------

/** The missions' state as the save keeps it: a deep copy (plain JSON: every reference an id already). */
export function copyMissions(m: MissionsState): MissionsState { return JSON.parse(JSON.stringify(m)) as MissionsState; }

/**
 * A save's missions, checked and copied (CareSim.fromSave): a board of real missions (known regions, challenges and
 * baddies), a map of known regions, whole coin, and a trip whose pairs are dragons and keepers the save has -- else it
 * throws, and the view starts a new barn (base.ts load).
 */
export function checkMissions(raw: unknown, dragons: readonly { id: number }[], keepers: readonly { id: number; phase: string }[]): MissionsState {
  const bad = (why: string): never => { throw new Error(`save: the missions ${why}`); };
  if (!raw || typeof raw !== 'object') bad('are missing');
  const m = raw as MissionsState, ids = new Set<string>(REGIONS.map((r) => r.id));
  const whole = (v: unknown, min = 0) => Number.isInteger(v) && (v as number) >= min;
  const regions = (v: unknown) => Array.isArray(v) && v.every((r) => ids.has(r)) && new Set(v).size === v.length;
  if (!whole(m.day) || !whole(m.coin) || !whole(m.sent) || !regions(m.explored) || !regions(m.pendingReveal) || !regions(m.firstSuccess)) bad(`map (${JSON.stringify({ day: m.day, coin: m.coin, explored: m.explored })}) is not one this build knows`);
  const mission = (q: Mission) => q && typeof q === 'object' && whole(q.id) && ids.has(q.region) && typeof q.title === 'string' && q.difficulty in DIFFICULTY
    && Array.isArray(q.challenges) && q.challenges.every((c) => c in CHALLENGES) && (q.baddie === null || q.baddie in BADDIES) && whole(q.days, 1) && whole(q.coin) && typeof q.eggChance === 'number';
  if (!Array.isArray(m.board) || m.board.length > BOARD_MAX || !m.board.every(mission)) bad('board is not one this build can show');
  const t = m.trip;
  if (t !== null) {
    if (!t || typeof t !== 'object' || !mission(t.mission) || !['muster', 'depart', 'away', 'return'].includes(t.state) || !Array.isArray(t.pairs) || !t.pairs.length || t.pairs.length > MAX_PAIRS
      || !t.pairs.every((p) => dragons.some((d) => d.id === p.dragon) && keepers.some((k) => k.id === p.keeper)) || !Array.isArray(t.stops)
      || !Array.isArray(m.deck) || m.deck.length !== t.pairs.length || !m.deck.every((s) => s === null || (whole(s) && s < DECK_SPOTS.length))
      // (away: whole clocks, the return after the leaving -- which may be before the world's clock 0: the trip preset's
      // team left before its world began, missions.ts awayNow)
      || (t.state === 'away' && (!Number.isInteger(t.departAt) || !Number.isInteger(t.returnAt) || t.returnAt! <= t.departAt!))) bad(`trip (${JSON.stringify({ state: t?.state, pairs: t?.pairs })}) is not one this build can run`);
  }
  // (a keeper on a trip is the trip's rider)
  for (const k of keepers) if (TRIP_PHASES.has(k.phase) && !t?.pairs.some((p) => p.keeper === k.id)) bad(`have keeper ${k.id} ${k.phase} with no team`);
  return copyMissions(m);
}
