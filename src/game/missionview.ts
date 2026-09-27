// The watchable scene (docs/BASE_DESIGN.md 6): a team out on a mission, walking the road of its region, meeting each
// challenge where it comes (the counter's moment, a banner) or waiting it out, fighting the packs of little enemies
// between them and the region's boss at the road's end (BASE_DESIGN B8: fought -- the dragons' breath thrown as bolts,
// the enemies' missiles thrown back, a spark and a flash where a hit lands, a beaten foe gone in a puff of smoke, a
// beaten boss knocked down seeing stars and running off, one too strong for the team stomping off unbeaten), and the
// result card once the trip's time is up. The team never turns back: every trip walks its whole road, and the scene is
// the same whatever the outcome (how each stop and fight goes is the team's, known at SEND) until the result card
// tells it, at the end. "The scene is the timer" (B5): nothing here is stepped or saved; every quantity is a pure
// function of the Trip and the world's clock (`sceneAt`), so a frozen view (t=) and a view opened half way along show
// the same road. The simulation never reads any of it.
//
// The pace (as the barn's: BASE_DESIGN 2, the lively step): each team dragon walks by its own walk anim's root motion (gait.ts), all at the
// slowest dragon's mean pace V: dragon i's walk plays at speed s_i = V / avg_i (1 or less) and its body moves D_i(s_i n)
// -- the distance its walk carries it by anim time s_i n (the frames' moves summed, the last frame's in part) -- where n
// is the trip's travel time so far (the time since it left, less the time spent standing at the stops' beats). So a
// planted paw stands still on the road, frame by frame (sim-check 24's no-skate check). The riders walk beside their
// dragons (56 px ahead of the root, a step behind in depth) at V; in a fight they step back behind their dragons at
// their own walk's pace (out of the line of fire), and come forward again as it ends.
import type { CareSim, Dragon, Keeper } from './sim.ts';
import type { Trip, Stop } from './trip.ts';
import type { BaddieFace, BaddiePose, BaddieId, FoeId, FoePose, StopState } from './missiondata.ts';
import type { Rect } from './icons.ts';
import { gaitOf } from './gait.ts';
import type { Gait } from './gait.ts';
import { readClock } from './clock.ts';
import { skyPhase } from './sky.ts';
import { FLOORS, INK, ROAD_SCENE } from './surfaces.ts';
import { drawClimate } from './backdrops.ts';
import { drawSetPiece } from './setpieces.ts';
import { drawBaddie, BADDIE_ART } from './baddies.ts';
import { drawFoe, FOE_ART } from './foes.ts';
import { drawBolt, drawMissile, drawSpark, drawPoof, drawPop, drawBossBar, REGION_MISSILE, SPARK_LEN, POOF_LEN, POP_LEN } from './fightfx.ts';
import type { MissileKind } from './fightfx.ts';
import { drawMiller } from './npcs.ts';
import { SADDLE } from './missionicons.ts';
import { regionOf, BADDIES } from './regions.ts';
import { powerOf } from './missions.ts';
import { drawSprite, ICONS } from './icons.ts';
import { drawEgg } from './eggs.ts';
import { makePet, petOpts, stepPet } from './pet.ts';
import type { Pet } from './pet.ts';
import { makeKeeperAgent } from './people.ts';
import { stepKeeperAgent, drawKeeperAgent } from '../care/keeper.ts';
import { keeperJoint } from '../art/keeper/rig.ts';
import type { KeeperAgent } from '../care/keeper.ts';
import { KEEPERS } from '../art/keeper/cast.ts';
import type { KeeperId } from '../art/keeper/cast.ts';
import type { DragonElement } from '../art/dragon/palettes.ts';
import type { Stage } from '../art/dragon/stages.ts';
import { drawDragon, rootToScreen } from '../art/dragon/rig.ts';
import { TopPass, AmbientBudget } from '../art/dragon/fx.ts';
import { ELEMENT_ANIM_FALLBACK } from '../art/dragon/anims.ts';
import { drawText, drawTextOutlined, measureText } from '../lib/engine/text.ts';

// ---------- the scene's shape ----------

/** The overlay: under the top bar to the bottom of the screen (640 x 360). */
export const SCENE_RECT: Readonly<Rect> = Object.freeze({ x: 0, y: 16, w: 640, h: 344 });
/** The team's feet on the road (screen y), and the road's straw-pale band (FLOORS.road). */
export const ROAD_Y = 300, ROAD_TOP = 292, ROAD_BOTTOM = 306;
/** Set pieces, the miller and the enemies stand a few px deeper than the team (drawn behind it). */
export const BACK_Y = 296;
/**
 * Pair 1's dragon walks this far behind pair 0's; each rider this far ahead of their dragon's root, and in a fight this
 * far from it (behind: RIDER_FIGHT < 0); a stop's set piece this far ahead of the lead as the stop begins; a pack of
 * foes from FOE_AHEAD on, FOE_GAP apart; the boss BADDIE_AHEAD.
 */
export const PAIR_BACK = 170, RIDER_AHEAD = 56, RIDER_FIGHT = -22, PIECE_AHEAD = 150, FOE_AHEAD = 118, FOE_GAP = 30, BADDIE_AHEAD = 200;
/** The camera keeps the team's middle this far from the screen's left edge. */
export const CAM_BACK = 260;
/** The overlay's way back to the barn, and the result card. */
export const BACK_BUTTON: Readonly<Rect> = Object.freeze({ x: 8, y: 338, w: 110, h: 16 });
export const RESULT_CARD: Readonly<Rect> = Object.freeze({ x: 170, y: 110, w: 300, h: 120 });

/** A challenge's beat (the team stands while its counter meets it), a fight with a pack of foes, the boss's fight, and the road's last stretch after it -- for a trip `L` steps long. */
export const beatLen = (L: number) => Math.min(600, Math.round(0.08 * L));
export const fightLen = (L: number) => Math.min(720, Math.round(0.07 * L));
export const bossLen = (L: number) => Math.min(1500, Math.round(0.13 * L));
export const tailLen = (L: number) => Math.min(240, Math.round(0.02 * L));
/** When the boss's fight begins: late enough that it ends a short stretch (tailLen) before the trip's time is up. */
export const bossStart = (L: number) => L - bossLen(L) - tailLen(L);
/** A stop's beat, and when it begins (Stop.at is its fraction of the way to the boss's fight). */
export const stopLen = (s: Stop, L: number) => (s.kind === 'baddie' ? bossLen(L) : s.kind === 'foes' ? fightLen(L) : beatLen(L));
export const stopStart = (s: Stop, L: number) => Math.round(s.at * bossStart(L));
/** A challenge's counter plays its moment this far into the beat; the set piece shows it met half way. */
const MOMENT_AT = 0.15, RESOLVED_AT = 0.5;
/** A moment gives way to idle when its anim ends, or after this many steps at most (a looping one: Tomas's petLow). */
export const MOMENT_MAX = 240;
/** The most clock steps the view's team steps on by in one draw; a bigger jump replays a walk from the road's phase. */
export const SYNC_GAP = 16;
/** Steps a hit flashes its target (a dragon, a foe, the boss): its fills pale inside its ink. */
export const FLASH = 6;
/** The breath's snap (its cue 0, on every stage: anims.ts breathAnim): the bolt leaves the mouth this many steps into it. */
export const SNAP = 22;
/** A beaten boss runs off at this pace (px a step); one the team couldn't beat stomps off at STOMP_PACE. */
export const FLEE_PACE = 1.6, STOMP_PACE = 1;

// ---------- the walk's distance ----------

const CUM = new WeakMap<Gait, Float64Array>();
/** A gait's distance by whole anim time t, for t in 0..len. */
function cumOf(g: Gait): Float64Array {
  let c = CUM.get(g);
  if (!c) { c = new Float64Array(g.len + 1); for (let t = 0; t < g.len; t++) c[t + 1] = c[t] + g.steps[t]; CUM.set(g, c); }
  return c;
}
/** Distance within the first pass at anim time tau in [0, len]: the whole steps, and the step tau is in, in part. */
function part(g: Gait, c: Float64Array, tau: number): number {
  const k = Math.floor(tau);
  return k >= g.len ? c[g.len] : c[k] + (tau - k) * g.steps[k];
}
/**
 * The distance a walk carries its dragon by anim time `tau` (tau >= 0, fractional: its walk at speed s for n steps is
 * anim time s n): every step's move summed, the one tau is in only in part, the loop going round from its loop start.
 * Its slope at any tau is the move of the frame tau is in, so over a step at speed s that stays in one frame the body
 * moves exactly s times that frame's move: what the anim player shows the paws doing.
 */
export function walkDist(g: Gait, tau: number): number {
  const c = cumOf(g);
  if (tau <= 0) return 0;
  if (tau < g.len) return part(g, c, tau);
  const ls = g.loopStart, loop = g.len - ls, lap = c[g.len] - c[ls], over = tau - g.len;
  const laps = Math.floor(over / loop), r = over - laps * loop;
  return c[g.len] + laps * lap + part(g, c, ls + r) - c[ls];
}
/**
 * Anim time `tau` of a walk as the anim player's start phase (DragonAnimPlayer.play's `phase`: 0..1 through its loop
 * part): the frame the walk plays at tau. (Every walk loops whole, loop start 0: sim-check 9; one with an intro would
 * start its loop at the intro's end.)
 */
export function loopPhase(g: Gait, tau: number): number {
  const loop = g.len - g.loopStart;
  if (loop <= 0) return 0;
  const t = tau < g.len ? tau : g.loopStart + ((tau - g.len) % loop);
  return t < g.loopStart ? 0 : (t - g.loopStart) / loop;
}
/** The index of the anim frame anim time `tau` falls in (the loop wrapping back to its loop start). */
export function frameAt(g: Gait, tau: number): number {
  let t = tau < g.len ? tau : g.loopStart + ((tau - g.len) % (g.len - g.loopStart));
  for (let i = 0; i < g.frames.length; i++) { if (t < g.frames[i].dur) return i; t -= g.frames[i].dur; }
  return g.frames.length - 1;
}

// ---------- where a dragon breathes from, and where a hit lands on it ----------

const MOUTH = new Map<string, readonly [number, number]>();
/**
 * A dragon's mouth at its breath's snap (the breath anim's frame SNAP, where its bolt leaves), px from the root under
 * its body (facing +x): the rig's own mouth joint, played to that frame once and kept (a pure function of the look).
 */
export function mouthOf(el: DragonElement, stage: Stage, seed: number): readonly [number, number] {
  const key = `${el}:${stage}:${seed}`;
  let m = MOUTH.get(key);
  if (!m) {
    const p = makePet(el, stage, seed, 'breath', 0, 0, { desync: false }), o = { x: 0, y: 0 };
    for (let f = 0; f < SNAP; f++) stepPet(p);
    rootToScreen(p.rig, p.rig.j.mouth.x, p.rig.j.mouth.y, o);
    m = Object.freeze([Math.round(o.x * 10) / 10, Math.round(o.y * 10) / 10] as const);
    MOUTH.set(key, m);
  }
  return m;
}
/** Where an enemy's missile lands on a dragon standing at x (its back, over the shoulders), from its mouth's place. */
const bodyAt = (x: number, mouth: readonly [number, number]): [number, number] => [x + mouth[0] * 0.15, ROAD_Y + mouth[1] * 0.7];

// ---------- the scene as a pure function ----------

/** What one of the team does at a moment of the scene: its anim, since when (trip time E), and how fast; a walk's start phase. */
export interface Act { key: string; anim: string; start: number; speed: number; phase: number }
/** A stop's set piece on the road, where it stands and how it looks now. */
export interface Piece { stop: number; x: number; state: StopState }
/** The boss on the road: where, which way it faces, its face and pose, whether a hit is flashing on it, and its step (the kit's bob, stars and dust). */
export interface BaddieAt { id: BaddieId; x: number; face: BaddieFace; pose: BaddiePose; facing: 1 | -1; flash: boolean; t: number }
/** One of a pack of foes on the road, likewise. */
export interface FoeAt { id: FoeId; x: number; face: BaddieFace; pose: FoePose; facing: 1 | -1; flash: boolean; t: number }
/** Something in flight: a dragon's breath bolt (its element) or an enemy's missile (its kind, a boss's big), where it is and which way it moves. */
export interface ShotAt { el: DragonElement | null; missile: MissileKind | null; big: boolean; x: number; y: number; dx: number; dy: number }
/** A mark where a hit landed or a foe was beaten: a spark, a puff of smoke, or a word popping up ("WEAK SPOT!"), and its age. */
export interface MarkAt { kind: 'spark' | 'poof' | 'pop'; x: number; y: number; age: number; text: string | null }
/** Each rider's place from its dragon's root (px along the road), and which way they face. */
export interface RiderAt { dx: number; facing: 1 | -1 }

/**
 * The scene at one clock value (`SceneFrame`: BASE_DESIGN 6's scene, plus what the view needs to draw it). E is the time since the
 * team left (0..L), n the travel time in it; `stop` the stop whose beat is playing (else null), `beatT` how far into it;
 * `last` the last stop reached (its banner stays up until the next); xs each pair's dragon's road x (the team walks
 * up the road, east, all the way: it never turns back), `speeds` each one's walk speed; `camX` the road x at the
 * screen's left edge. A fight's: the pack of foes, the boss, what is in flight, the marks, which dragons a hit is
 * flashing on, and the boss's health (0..1, while its fight is on). Nothing in it tells the trip's outcome: that is the
 * result card's, once `done`.
 */
export interface SceneFrame {
  E: number; L: number; n: number;
  stop: number | null; beatT: number; last: number | null;
  xs: number[]; speeds: number[];
  riders: RiderAt[];
  camX: number;
  banner: string | null; bannerOk: boolean;
  baddie: BaddieAt | null;
  foes: FoeAt[];
  shots: ShotAt[];
  marks: MarkAt[];
  flash: boolean[];
  bar: number | null;
  pieces: Piece[];
  acts: { dragon: Act; rider: Act | null }[];
  done: boolean;
}

/** Each element's moment when it meets a challenge (BASE_DESIGN 6): the breath, rock's happy heave, slinkwing's call. */
export const DRAGON_MOMENT: Readonly<Record<DragonElement, string>> = Object.freeze({
  dusk: 'breath', rock: 'happy', fire: 'breath', lightning: 'breath', water: 'breath', spike: 'breath', slinkwing: 'call',
});
/** Each rider's moment: CHARM waves, MEDIC kneels to pet, NAVIGATOR hushes, NIMBLE cheers. */
export const RIDER_MOMENT: Readonly<Record<KeeperId, string>> = Object.freeze({ bea: 'wave', tomas: 'petLow', iris: 'shh', pip: 'cheer' });

/** The team as the scene sees it: each pair's dragon and rider (by id in the world), gait and walk speed, and the pace V. */
interface Team { ds: Dragon[]; ks: (Keeper | null)[]; gaits: Gait[]; speeds: number[]; V: number }
function teamOf(sim: CareSim, trip: Trip): Team {
  const ds: Dragon[] = [], ks: (Keeper | null)[] = [];
  for (const p of trip.pairs) {
    const d = sim.dragons.find((q) => q.id === p.dragon);
    if (!d) continue;
    ds.push(d); ks.push(sim.keepers.find((k) => k.id === p.keeper) ?? null);
  }
  const gaits = ds.map((d) => gaitOf(d.element, d.stage));
  const V = gaits.length ? Math.min(...gaits.map((g) => g.avg)) : 0;
  return { ds, ks, gaits, speeds: gaits.map((g) => (g.avg > 0 ? V / g.avg : 0)), V };
}

/** The trip's length in steps: its return less its departure, or its days before it has left. */
export function tripLen(sim: CareSim, trip: Trip): number {
  return trip.departAt != null && trip.returnAt != null ? trip.returnAt - trip.departAt : trip.mission.days * sim.dayLen;
}

// ---------- a fight, scripted (a pure function of the trip, its team and its length) ----------

/**
 * An enemy on a fight's stage: where it stands, where it walks in from and when, when it throws, when hits land on it,
 * when it is beaten, and when a boss leaves the road (runs off once beaten; stomps off, unbeaten, when never beaten).
 */
interface Enemy { spot: number; from: number; in0: number; in1: number; attacks: number[]; hurts: number[]; beaten: number | null; flee: number | null }
/** Something thrown in a fight: by a dragon (its bolt) or an enemy (its missile), from where to where, launched and landing when (beat time). */
interface Throw {
  dragon: boolean; who: number; target: number; launch: number; land: number;
  x0: number; y0: number; x1: number; y1: number; arc: number;
  el: DragonElement | null; big: boolean; weak: boolean; dmg: number;
}
/**
 * A fight at a stop: its enemies and throws; each dragon's breaths (when each starts: its snap SNAP later throws the
 * bolt); when the outcome shows (the banner, the TRIP LOG); whether the team wins; when the team cheers; how long the
 * riders take to step back (and, at the beat's end, forward again).
 */
interface Fight { enemies: Enemy[]; throws: Throw[]; breaths: { d: number; at: number }[]; shown: number; won: boolean; cheer: number | null; back: number }

/** A thrown thing's flight time for a distance (a bolt quicker than an enemy's missile), and its arc's height. */
const boltFlight = (dist: number) => Math.round(14 + dist / 10), missileFlight = (dist: number) => Math.round(18 + dist / 9);
const boltArc = (dist: number) => 12 + dist * 0.12, missileArc = (dist: number) => 24 + dist * 0.16;

/**
 * The fight at stop `j` (a pack of foes or the boss): who throws what at whom and when, in beat time, scaled from its
 * full length (720 steps a pack, 1500 the boss) to the beat it has; the riders step back first (each at their own walk's
 * pace, the slowest setting the time, 0.15 of a pack's beat or 0.12 of the boss's at most). A pack's foes walk in and each hops at the lead
 * dragon, throwing, then goes down to one bolt (the dragons in turn), in a puff of smoke; the team always wins. The
 * boss walks in and trades blows: five breaths, its big move thrown back after each but the last. A team whose power
 * reaches the boss's might (the stop covered: missions.ts coverage) beats it -- its health down by each hit's power --
 * and it is down seeing stars for 4 s, then runs off; a team too weak for it takes its health down only by its power's
 * share of the might, the boss's last move is its finish, thrown at every dragon, and it stomps off unbeaten. Either
 * way it leaves the road: the fight is the team's (known at SEND), never the trip's outcome.
 */
function fightOf(team: Team, trip: Trip, j: number, B: number, xs: readonly number[]): Fight {
  const s = trip.stops[j], m = trip.mission, D = team.ds.length, lead = xs[0];
  const fighters = team.ds.map((d, i) => ({ d, x: xs[i], mouth: mouthOf(d.element, d.stage, d.seed) }));
  const missile = REGION_MISSILE[m.region], rider = (i: number) => KEEPERS[team.ks[i]?.look ?? 'bea'].speed;
  const backSteps = Math.max(...team.ds.map((_, i) => Math.round((RIDER_AHEAD - RIDER_FIGHT) / rider(i))));
  const throws: Throw[] = [], breaths: { d: number; at: number }[] = [];
  const bolt = (i: number, at: number, tx: number, ty: number, weak: boolean, dmg: number, target: number) => {
    const f = fighters[i], x0 = f.x + f.mouth[0], y0 = ROAD_Y + f.mouth[1], dist = Math.abs(tx - x0), launch = at + SNAP;
    breaths.push({ d: i, at });
    throws.push({ dragon: true, who: i, target, launch, land: launch + boltFlight(dist), x0, y0, x1: tx, y1: ty, arc: boltArc(dist), el: f.d.element, big: false, weak, dmg });
  };
  const fling = (who: number, launch: number, x0: number, y0: number, i: number, big: boolean) => {
    const [x1, y1] = bodyAt(fighters[i].x, fighters[i].mouth), dist = Math.abs(x1 - x0);
    throws.push({ dragon: false, who, target: i, launch, land: launch + missileFlight(dist), x0, y0, x1, y1, arc: missileArc(dist), el: null, big, weak: false, dmg: 0 });
  };
  if (!D) return { enemies: [], throws, breaths, shown: 0, won: true, cheer: null, back: 0 };
  if (s.kind === 'foes') {
    const k = B / 720, T = (v: number) => Math.round(v * k), F = FOE_ART[m.foe], enemies: Enemy[] = [];
    for (let e = 0; e < m.pack; e++) {
      const spot = lead + FOE_AHEAD + e * FOE_GAP, t0 = T(124 + e * 145);
      const [hx, hy] = [spot - F.hitAt[0], BACK_Y + F.hitAt[1]];
      // (it hops at the lead dragon and throws; then a dragon's bolt, in turn, puts it down)
      fling(e, t0 + T(8), spot - F.throwAt[0], BACK_Y + F.throwAt[1], 0, false);
      bolt(e % D, t0 + T(46), hx, hy, false, 0, e);
      const land = throws[throws.length - 1].land;
      enemies.push({ spot, from: spot + 300, in0: T(8 + e * 14), in1: T(96 + e * 14), attacks: [t0], hurts: [land], beaten: land + T(10), flee: null });
    }
    const shown = enemies[enemies.length - 1].beaten!;
    return { enemies, throws, breaths, shown, won: true, cheer: shown + T(6), back: Math.min(backSteps, Math.round(0.15 * B)) };
  }
  // the boss
  const k = B / 1500, T = (v: number) => Math.round(v * k), A = BADDIE_ART[m.baddie], x0 = lead + BADDIE_AHEAD;
  const win = s.covered, H = 5, gap = 190;
  const weight = (i: number) => powerOf(team.ds[i], m.baddie), total = Array.from({ length: H }, (_, h) => weight(h % D)).reduce((a, v) => a + v, 0);
  const power = team.ds.reduce((a, d) => a + powerOf(d, m.baddie), 0), dealt = win ? 1 : Math.min(0.9, power / m.might);
  const boss: Enemy = { spot: x0, from: x0 + 330, in0: 0, in1: T(190), attacks: [], hurts: [], beaten: null, flee: null };
  const [hx, hy] = [x0 - A.hitAt[0], BACK_Y + A.hitAt[1]], [tx, ty] = [x0 - A.throwAt[0], BACK_Y + A.throwAt[1]];
  let shown = 0;
  for (let h = 0; h < H; h++) {
    const t0 = T(250 + h * gap), a = h % D, weak = BADDIES[m.baddie].weak === team.ds[a].element;
    bolt(a, t0, hx, hy, weak, (weight(a) / total) * dealt, 0);
    boss.hurts.push(throws[throws.length - 1].land);
    // (its big move between the team's breaths; against a team too weak for it, its last is its finish, at every dragon)
    if (win && h === H - 1) continue;
    const at = t0 + T(120);
    boss.attacks.push(at);
    const targets = !win && h === H - 1 ? team.ds.map((_, i) => i) : [D > 1 ? h % 2 : 0];
    for (const i of targets) fling(0, at + T(18), tx, ty, i, true);
  }
  if (win) { const ko = boss.hurts[H - 1]; boss.beaten = ko + T(12); boss.flee = ko + T(252); shown = boss.beaten; }
  else { shown = Math.max(...throws.filter((q) => !q.dragon).map((q) => q.land)) + T(10); boss.flee = shown + T(40); }
  return { enemies: [boss], throws, breaths, shown, won: win, cheer: win ? shown + T(18) : null, back: Math.min(backSteps, Math.round(0.12 * B)) };
}

/** A thrown thing's place at beat time bt (in flight), and its step's way (for the sprite's facing and its trail). */
function flight(q: Throw, bt: number): { x: number; y: number; dx: number; dy: number } {
  const span = Math.max(1, q.land - q.launch), at = (u: number) => ({ x: q.x0 + (q.x1 - q.x0) * u, y: q.y0 + (q.y1 - q.y0) * u - q.arc * 4 * u * (1 - u) });
  const u = (bt - q.launch) / span, p = at(u), p2 = at(Math.min(1, u + 1 / span));
  return { x: Math.round(p.x), y: Math.round(p.y), dx: p2.x - p.x, dy: p2.y - p.y };
}

/** The fights of a trip, stop by stop (null for a challenge), for a length and a team: kept per trip, rebuilt when either changes. */
const FIGHTS = new WeakMap<Trip, { key: string; fights: (Fight | null)[] }>();
function fightsOf(team: Team, trip: Trip, L: number, beatXs: (j: number) => number[]): (Fight | null)[] {
  const key = `${L}|${team.ds.map((d) => `${d.id}:${d.element}:${d.stage}:${d.seed}`).join(',')}|${team.ks.map((k) => k?.look ?? '-').join(',')}`;
  const got = FIGHTS.get(trip);
  if (got && got.key === key) return got.fights;
  const fights = trip.stops.map((s, j) => (s.kind === 'challenge' ? null : fightOf(team, trip, j, stopLen(s, L), beatXs(j))));
  FIGHTS.set(trip, { key, fights });
  return fights;
}

/**
 * The trip time (E) from which how each stop went shows in the scene -- its banner turning from the stop's name to how
 * it went: a challenge's at its counter's moment (MOMENT_AT of its beat), a fight's once it is over (the last foe gone,
 * the boss knocked down, or a boss too strong for the team's finish landed). The TRIP LOG reads the stops by it
 * (maptable.ts stopStates), so the log never tells what the scene has not shown yet: the scene is the timer.
 */
export function stopShownAt(sim: CareSim, trip: Trip): number[] {
  const L = tripLen(sim, trip), f = sceneFights(sim, trip, L);
  return trip.stops.map((s, j) => stopStart(s, L) + (f[j] ? f[j]!.shown : Math.ceil(MOMENT_AT * beatLen(L))));
}

/** The road as the scene lays it out for a trip (the whole of it: the team reaches every stop): each stop's start and beat, and where the team stands when a stop begins. */
function roadLayout(sim: CareSim, trip: Trip, L: number) {
  const team = teamOf(sim, trip), stops = trip.stops;
  const starts = stops.map((s) => stopStart(s, L)), lens = stops.map((s) => stopLen(s, L));
  const nAt = (e: number) => { let n = e; for (let j = 0; j < stops.length; j++) if (starts[j] <= e) n -= Math.min(e - starts[j], lens[j]); return n; };
  const xAt = (i: number, nn: number) => -PAIR_BACK * i + walkDist(team.gaits[i], team.speeds[i] * nn);
  const beatXs = (j: number) => team.ds.map((_, i) => xAt(i, nAt(starts[j])));
  return { team, stops, starts, lens, nAt, xAt, beatXs };
}
/** The fights of a trip at length L (the scene's own, as sceneAt plays them). */
function sceneFights(sim: CareSim, trip: Trip, L: number): (Fight | null)[] {
  const r = roadLayout(sim, trip, L);
  return fightsOf(r.team, trip, L, r.beatXs);
}

/**
 * The scene at the world's clock (or at `clock`): pure -- the same trip and clock give the same frame, always. It never
 * reads the trip's outcome (success, egg): a team that will fail walks the same road, meets the same stops and fights
 * the same fights as one that will succeed, frame for frame, until the result card (drawResultCard) tells which.
 */
export function sceneAt(sim: CareSim, trip: Trip, clock: number = sim.clock): SceneFrame {
  const L = tripLen(sim, trip), { team, stops, starts, lens, nAt, xAt, beatXs } = roadLayout(sim, trip, L);
  const E = trip.departAt == null ? 0 : Math.max(0, Math.min(L, clock - trip.departAt));
  const n = nAt(E);
  let stop: number | null = null, last: number | null = null;
  for (let j = 0; j < stops.length; j++) if (starts[j] <= E) { last = j; if (E < starts[j] + lens[j]) stop = j; }
  const beatT = stop == null ? 0 : E - starts[stop];
  const xs = team.ds.map((_, i) => xAt(i, n));
  const mean = xs.length ? xs.reduce((a, v) => a + v, 0) / xs.length : 0;
  const camX = mean - CAM_BACK;
  const leadAt = (j: number) => (team.ds.length ? xAt(0, nAt(starts[j])) : 0);
  const fights = fightsOf(team, trip, L, beatXs);

  // the set pieces: every challenge's (the team reaches them all), where it stands and how it looks
  const pieces: Piece[] = [];
  for (let j = 0; j < stops.length; j++) {
    if (stops[j].kind !== 'challenge') continue;
    const resolved = E >= starts[j] + RESOLVED_AT * lens[j];
    pieces.push({ stop: j, x: leadAt(j) + PIECE_AHEAD, state: !resolved ? 'ahead' : stops[j].covered ? 'met' : 'unmet' });
  }

  // the banner: the last stop's (its name alone until its outcome shows -- a challenge's counter's moment, a fight's end
  // -- so the ending is never told before it plays; then its line), up until the next stop
  let banner: string | null = null, bannerOk = false;
  if (last != null) {
    const s = stops[last], head = s.log.split(' - ')[0], bt = E - starts[last], fl = fights[last];
    const shown = fl ? bt >= fl.shown : bt >= MOMENT_AT * lens[last];
    if (!shown) banner = s.kind === 'challenge' ? head : `${head}!`;
    else { banner = s.log; bannerOk = s.covered; }
  }

  // a fight's cast and marks: the stop being fought (and a boss that runs off, or stomps off, after its beat)
  let baddie: BaddieAt | null = null, bar: number | null = null;
  const foes: FoeAt[] = [], shots: ShotAt[] = [], marks: MarkAt[] = [], flash = team.ds.map(() => false);
  const within = (t: number, a: number, len: number) => t >= a && t < a + len;
  const kb = stops.findIndex((s) => s.kind === 'baddie');
  for (let j = 0; j < stops.length; j++) {
    const fl = fights[j], s = stops[j];
    if (!fl || E < starts[j]) continue;
    const bt = E - starts[j], inBeat = bt < lens[j];
    if (s.kind === 'foes') {
      if (!inBeat) continue;
      fl.enemies.forEach((e, i) => {
        if (e.beaten != null && bt >= e.beaten) { if (bt < e.beaten + POOF_LEN) marks.push({ kind: 'poof', x: Math.round(e.spot - FOE_ART[s.foe!].hitAt[0]), y: BACK_Y + FOE_ART[s.foe!].hitAt[1], age: bt - e.beaten, text: null }); return; }
        const walking = bt < e.in1, x = walking ? e.from + (e.spot - e.from) * Math.max(0, (bt - e.in0) / Math.max(1, e.in1 - e.in0)) : e.spot;
        const hurt = e.hurts.some((h) => within(bt, h, 10)), attacking = e.attacks.some((a) => within(bt, a, Math.max(1, Math.round(24 * lens[j] / 720))));
        foes.push({ id: s.foe!, x: Math.round(x), face: hurt ? 'hurt' : 'fierce', pose: walking ? 'walk' : hurt ? 'hit' : attacking ? 'attack' : 'stand', facing: -1, flash: e.hurts.some((h) => within(bt, h, FLASH)), t: bt + i * 7 });
      });
    } else if (j === kb) {
      const e = fl.enemies[0], id = s.baddie!, k = lens[j] / 1500;
      if (inBeat) {
        // the health bar: full as it walks in, down by each hit's share as the hits land
        bar = 1 - fl.throws.filter((q) => q.dragon && bt >= q.land).reduce((a, q) => a + q.dmg, 0);
        bar = Math.max(0, Math.min(1, Math.round(bar * 1e6) / 1e6));
      }
      const hurt = e.hurts.some((h) => within(bt, h, Math.round(16 * k) + 1)), attacking = e.attacks.some((a) => within(bt, a, Math.round(40 * k) + 1));
      const walkT = Math.round(0.7 * e.in1);
      let at: BaddieAt;
      if (bt < walkT) at = { id, x: e.from + (e.spot - e.from) * (bt / Math.max(1, walkT)), face: 'fierce', pose: 'walk', facing: -1, flash: false, t: bt };
      // (it leaves up the road, ahead of the team: beaten, it runs off; unbeaten, it stomps off, as fierce as it came)
      else if (e.flee != null && bt >= e.flee) at = e.beaten != null
        ? { id, x: e.spot + (bt - e.flee) * FLEE_PACE, face: 'hurt', pose: 'flee', facing: 1, flash: false, t: bt }
        : { id, x: e.spot + (bt - e.flee) * STOMP_PACE, face: 'fierce', pose: 'walk', facing: 1, flash: false, t: bt };
      else if (e.beaten != null && bt >= e.beaten) at = { id, x: e.spot, face: 'dazed', pose: 'down', facing: -1, flash: false, t: bt };
      else at = { id, x: e.spot, face: hurt ? 'hurt' : 'fierce', pose: hurt ? 'hit' : attacking ? 'attack' : 'stand', facing: -1, flash: e.hurts.some((h) => within(bt, h, FLASH)), t: bt };
      // (gone once it is well off the screen, up the road)
      baddie = Math.abs(at.x - (camX + 320)) > 520 ? null : { ...at, x: Math.round(at.x * 100) / 100 };
    }
    if (!inBeat) continue;
    for (const q of fl.throws) {
      if (bt >= q.launch && bt < q.land) {
        const p = flight(q, bt);
        shots.push({ el: q.dragon ? q.el : null, missile: q.dragon ? null : REGION_MISSILE[trip.mission.region], big: q.big, x: p.x, y: p.y, dx: p.dx, dy: p.dy });
      } else if (within(bt, q.land, SPARK_LEN)) marks.push({ kind: 'spark', x: Math.round(q.x1), y: Math.round(q.y1), age: bt - q.land, text: null });
      if (q.weak && within(bt, q.land, POP_LEN)) marks.push({ kind: 'pop', x: Math.round(q.x1), y: Math.round(q.y1) - 26, age: bt - q.land, text: 'WEAK SPOT!' });
      if (!q.dragon && within(bt, q.land, FLASH)) flash[q.target] = true;
    }
  }

  // each rider's place: beside its dragon's head, stepping back behind it for a fight and forward again as it ends
  const riders: RiderAt[] = team.ds.map((_, i) => {
    const fl = stop != null ? fights[stop] : null;
    if (!fl || !fl.back) return { dx: RIDER_AHEAD, facing: 1 };
    const B = lens[stop!], u = beatT < fl.back ? beatT / fl.back : beatT >= B - fl.back ? (B - beatT) / fl.back : 1;
    const moving = beatT < fl.back ? -1 : beatT >= B - fl.back ? 1 : 0;
    return { dx: Math.round((RIDER_AHEAD + (RIDER_FIGHT - RIDER_AHEAD) * Math.min(1, u)) * 100) / 100, facing: moving < 0 ? -1 : 1 };
  });

  // what each of the team does: walk between stops; at a beat stand, the counter playing its moment, or in a fight each
  // dragon breathing its bolts and the riders stepping back and cheering the win; home, stand
  const acts = team.ds.map((d, i) => {
    const k = team.ks[i];
    const walkAct = (who: 'd' | 'k'): Act => {
      const seg = last == null ? -1 : last, tau = team.speeds[i] * n;
      const g = team.gaits[i];
      const segStart = seg < 0 ? 0 : starts[seg] + lens[seg];
      return who === 'd'
        ? { key: `w${seg}`, anim: 'walk', start: segStart, speed: team.speeds[i], phase: loopPhase(g, tau) }
        : { key: `w${seg}`, anim: 'walk', start: segStart, speed: team.V / KEEPERS[k!.look].speed, phase: 0 };
    };
    const beatAct = (who: 'd' | 'k', name: string, moment: string): Act => {
      const j = stop!, s = stops[j], by = s.by;
      const at = by.includes(name) ? starts[j] + Math.round(MOMENT_AT * lens[j]) : -1;
      return at >= 0 && E >= at ? { key: `m${j}`, anim: moment, start: at, speed: 1, phase: 0 } : { key: `b${j}`, anim: 'idle', start: starts[j], speed: 1, phase: 0 };
    };
    const fightAct = (who: 'd' | 'k', fl: Fight): Act => {
      const j = stop!, S = starts[j], B = lens[j];
      if (fl.cheer != null && beatT >= fl.cheer) return who === 'd' ? { key: `h${j}`, anim: 'happy', start: S + fl.cheer, speed: 1, phase: 0 } : riderFight(j, S, B, fl, { key: `c${j}`, anim: 'cheer', start: S + fl.cheer, speed: 1, phase: 0 });
      if (who === 'k') return riderFight(j, S, B, fl, { key: `b${j}`, anim: 'idle', start: S, speed: 1, phase: 0 });
      const mine = fl.breaths.filter((q) => q.d === i && beatT >= q.at);
      if (mine.length) { const q = mine[mine.length - 1]; return { key: `a${j}.${fl.breaths.indexOf(q)}`, anim: 'breath', start: S + q.at, speed: 1, phase: 0 }; }
      return { key: `b${j}`, anim: 'idle', start: S, speed: 1, phase: 0 };
    };
    // (a rider stepping back or forward walks at the pace they move: their walk's own, or brisker in a short beat)
    const riderFight = (j: number, S: number, B: number, fl: Fight, still: Act): Act => {
      const pace = (RIDER_AHEAD - RIDER_FIGHT) / fl.back / KEEPERS[k!.look].speed;
      if (beatT < fl.back) return { key: `r${j}`, anim: 'walk', start: S, speed: pace, phase: 0 };
      if (beatT >= B - fl.back) return { key: `f${j}`, anim: 'walk', start: S + B - fl.back, speed: pace, phase: 0 };
      return still;
    };
    if (E >= L) return { dragon: { key: 'end', anim: 'idle', start: L, speed: 1, phase: 0 }, rider: k ? { key: 'end', anim: 'idle', start: L, speed: 1, phase: 0 } : null };
    if (stop != null) {
      const fl = fights[stop];
      if (fl) return { dragon: fightAct('d', fl), rider: k ? fightAct('k', fl) : null };
      return { dragon: beatAct('d', d.name, DRAGON_MOMENT[d.element]), rider: k ? beatAct('k', k.name, RIDER_MOMENT[k.look]) : null };
    }
    return { dragon: walkAct('d'), rider: k ? walkAct('k') : null };
  });

  return { E, L, n, stop, beatT, last, xs, speeds: team.speeds, riders, camX, banner, bannerOk, baddie, foes, shots, marks, flash, bar, pieces, acts, done: E >= L };
}

// ---------- the view: the team's pets and riders, and drawing ----------

/** One of the team on screen: its pet or rider character, the act it is playing, and the clock it was last stepped at. */
const HAND = { x: 0, y: 0 };
interface Actor { pet: Pet | null; agent: KeeperAgent | null; key: string | null; clock: number; momentDone: boolean; age: number }

/**
 * The team's characters for one trip (base.ts builds them when the scene opens, and again for another trip): each pair's
 * dragon on the real rig and its rider on the paper doll, played to the scene's acts. `sync` catches them up to the
 * frame: an act they were not playing starts fresh -- a walk at its speed and the phase the road says (exact), anything
 * else replayed from its start (a beat's worth at most: a frozen view shows the same moment a live one did) -- and one
 * they were playing steps on by the clock's advance (SYNC_GAP steps at most; a bigger jump, or a rewind, restarts a
 * walk at the road's phase, and steps anything else on by 120 at most).
 */
export class ScenePets {
  readonly trip: Trip;
  private readonly actors: { d: Actor; k: Actor | null; dragon: Dragon; keeper: Keeper | null }[] = [];
  private readonly top = new TopPass(96);
  private readonly budget = new AmbientBudget();
  private frame = 0;
  private flash: boolean[] = [];

  constructor(sim: CareSim, trip: Trip) {
    this.trip = trip;
    for (const p of trip.pairs) {
      const d = sim.dragons.find((q) => q.id === p.dragon);
      if (!d) continue;
      const k = sim.keepers.find((q) => q.id === p.keeper) ?? null;
      const pet = makePet(d.element, d.stage, d.seed, 'idle', 0, ROAD_Y, { desync: false, mood: d.mood });
      this.actors.push({ dragon: d, keeper: k, d: { pet, agent: null, key: null, clock: 0, momentDone: false, age: 0 },
        k: k ? { pet: null, agent: makeKeeperAgent(k.look), key: null, clock: 0, momentDone: false, age: 0 } : null });
    }
  }

  /** Catch the team up to the frame at `clock`. */
  sync(f: SceneFrame, clock: number): void {
    this.flash = f.flash;
    this.actors.forEach((a, i) => {
      const act = f.acts[i];
      if (!act) return;
      // (the dragons face up the road, as the team always does; a rider turns to step back in a fight)
      const x = f.xs[i], r = f.riders[i] ?? { dx: RIDER_AHEAD, facing: 1 };
      this.play(a.d, act.dragon, f, clock, x, ROAD_Y, 1);
      if (a.k && act.rider) this.play(a.k, act.rider, f, clock, x + r.dx, ROAD_Y - 3, r.facing);
    });
  }

  private play(a: Actor, act: Act, f: SceneFrame, clock: number, x: number, y: number, facing: 1 | -1): void {
    let ticks: number;
    // (a clock that jumped -- a view closed and reopened, a fast speed's draws, a rewind -- plays the act afresh: a
    // walk at the phase the road says, so its paws never fall out of step with its body; see sim-check 24)
    const gap = clock - a.clock;
    if (a.key === act.key && (gap < 0 || gap > SYNC_GAP) && (act.anim === 'walk' || gap < 0)) a.key = null;
    if (a.key !== act.key) {
      a.key = act.key; a.momentDone = false; a.age = 0;
      if (a.pet) {
        const p = a.pet;
        p.player.play(act.anim, { restart: true, speed: act.speed, phase: act.anim === 'walk' ? act.phase : 0, blend: act.anim === 'walk' ? 0 : 6, fallback: ELEMENT_ANIM_FALLBACK[act.anim] });
        p.anim = act.anim; p.hold = 0;
      } else a.agent!.player.play(act.anim, { restart: true, speed: act.speed, blend: 6 });
      // (a walk starts where the road says: no replay for a dragon's; a rider's, and anything else, from its start)
      ticks = a.pet && act.anim === 'walk' ? 0 : Math.max(0, Math.min(act.anim === 'walk' ? 120 : 960, Math.round(f.E - act.start)));
    } else ticks = Math.max(0, Math.min(gap > SYNC_GAP ? 120 : SYNC_GAP, gap));
    a.clock = clock;
    for (let t = 0; t < ticks; t++) this.tick(a, act, x, y, facing);
    // (placed where the frame says even when nothing ticked)
    if (a.pet) { a.pet.x = x; a.pet.y = y; a.pet.facing = facing; }
    else if (a.agent) { a.agent.x = x; a.agent.y = y; a.agent.facing = facing; }
  }

  private tick(a: Actor, act: Act, x: number, y: number, facing: 1 | -1): void {
    a.age++;
    const moment = act.anim !== 'walk' && act.anim !== 'idle';
    if (a.pet) {
      const p = a.pet;
      if (moment && !a.momentDone && (p.player.done || a.age >= MOMENT_MAX)) { p.player.play('idle', { blend: 8 }); p.anim = 'idle'; a.momentDone = true; }
      p.x = x; p.y = y; p.facing = facing;
      stepPet(p);
    } else {
      const k = a.agent!;
      if (moment && !a.momentDone && (k.player.done || a.age >= MOMENT_MAX)) { k.player.play('idle', { blend: 8 }); a.momentDone = true; }
      k.x = x; k.y = y; k.facing = facing; k.pinX = true;
      stepKeeperAgent(k);
    }
  }

  /** The walk frame each dragon is playing now (sim-check 24: the view's paws keep to the road). */
  dragonFrames(): number[] { return this.actors.map((a) => a.d.pet!.player.frameIndex); }

  /**
   * Draw the team (already synced): the riders a step behind their dragons, each with its saddle in the near hand (the
   * art kit's SADDLE, as a rider carries it in the barn's muster), then the dragons -- one a hit has just landed on drawn
   * flat in its glow's highlight inside its own ink, the grow-up's flash (ART_BIBLE 4.2) -- then the top pass.
   */
  draw(ctx: CanvasRenderingContext2D): void {
    const cast: { y: number; pet?: Pet; agent?: KeeperAgent; flat?: boolean }[] = [];
    this.actors.forEach((a, i) => {
      if (a.k?.agent) cast.push({ y: a.k.agent.y, agent: a.k.agent });
      if (a.d.pet) cast.push({ y: a.d.pet.y, pet: a.d.pet, flat: !!this.flash[i] });
    });
    cast.sort((p, q) => p.y - q.y);
    this.budget.begin(cast.filter((c) => c.pet).length, this.frame++);
    let slot = 0;
    for (const c of cast) {
      if (c.pet) drawDragon(ctx, c.pet.rig, c.pet.player.pose, petOpts(c.pet, { still: true, top: this.top, budget: this.budget, slot: slot++, flat: c.flat }));
      else if (c.agent) {
        drawKeeperAgent(ctx, c.agent);
        keeperJoint(c.agent.rig, 'handN', HAND);
        drawSprite(ctx, SADDLE, HAND.x + c.agent.facing * 3, HAND.y - 2);
      }
    }
    this.top.flush(ctx);
  }
}


/**
 * The road (screen space, from the road's band down): the road's pale band (FLOORS.road, a seam along its top), its
 * slab, a strip of grass BELOW it in the green climates (never underfoot: gate i), then the earth.
 */
function drawRoad(ctx: CanvasRenderingContext2D, green: boolean): void {
  const R = SCENE_RECT, bottom = R.y + R.h;
  ctx.fillStyle = ROAD_SCENE.edge; ctx.fillRect(0, ROAD_TOP - 1, R.w, 1);
  ctx.fillStyle = FLOORS.road; ctx.fillRect(0, ROAD_TOP, R.w, ROAD_BOTTOM - ROAD_TOP);
  ctx.fillStyle = INK; ctx.fillRect(0, ROAD_BOTTOM, R.w, 1);
  ctx.fillStyle = ROAD_SCENE.slab; ctx.fillRect(0, ROAD_BOTTOM + 1, R.w, 6);
  let y = ROAD_BOTTOM + 7;
  if (green) { ctx.fillStyle = ROAD_SCENE.grass; ctx.fillRect(0, y, R.w, 5); y += 5; }
  ctx.fillStyle = ROAD_SCENE.earth; ctx.fillRect(0, y, R.w, bottom - y);
}

/**
 * The scene (BASE_DESIGN 6), inside SCENE_RECT: the region's climate (parallax: backdrops.ts drawClimate), the road, the set
 * pieces the road has reached (each behind the team: the fog bank too), the miller at his mill, the boss and the foes
 * (behind the team too), the team, what is in flight and the marks of the hits over it all, then the banner and the
 * boss's health bar under it. Syncs `cast` to the frame first.
 */
export function drawMissionScene(ctx: CanvasRenderingContext2D, sim: CareSim, trip: Trip, cast: ScenePets, f: SceneFrame = sceneAt(sim, trip)): void {
  const R = SCENE_RECT, cam = Math.round(f.camX), climate = regionOf(trip.mission.region).climate;
  cast.sync(f, sim.clock);
  ctx.save();
  ctx.beginPath(); ctx.rect(R.x, R.y, R.w, R.h); ctx.clip();
  drawClimate(ctx, climate, skyPhase(readClock(sim.clock, sim.dayLen)), R, f.camX);
  drawRoad(ctx, climate === 'meadow' || climate === 'forest');
  ctx.translate(-cam, 0);
  const seen = (x: number, half: number) => x + half >= cam && x - half <= cam + R.w;
  for (const p of f.pieces) {
    if (!seen(p.x, 90)) continue;
    const s = trip.stops[p.stop];
    drawSetPiece(ctx, s.challenge!, p.x, BACK_Y, p.state, sim.clock);
    if (s.challenge === 'miller') drawMiller(ctx, p.state === 'met' ? 'talkedRound' : 'grumpy', p.x + 34, BACK_Y, -1, sim.clock);
  }
  const bd = f.baddie;
  if (bd) drawBaddie(ctx, bd.id, bd.x, BACK_Y, bd.facing, bd.face, bd.pose, bd.t, bd.flash);
  // (the pack drawn back to front, the nearest last)
  for (let i = f.foes.length - 1; i >= 0; i--) { const q = f.foes[i]; if (seen(q.x, 20)) drawFoe(ctx, q.id, q.x, BACK_Y, q.facing, q.face, q.pose, q.t, q.flash); }
  cast.draw(ctx);
  for (const m of f.marks) if (m.kind === 'poof') drawPoof(ctx, m.x, m.y, m.age);
  for (const s of f.shots) {
    if (s.el) drawBolt(ctx, s.el, s.x, s.y, s.dx, s.dy);
    else if (s.missile) drawMissile(ctx, s.missile, s.big, s.x, s.y, s.dx, s.dy);
  }
  for (const m of f.marks) if (m.kind === 'spark') drawSpark(ctx, m.x, m.y, m.age); else if (m.kind === 'pop') drawPop(ctx, m.text!, m.x, m.y, m.age);
  ctx.restore();
  if (f.banner) {
    // (on an ink strip, as the barn's hint and action line are: the weather's marks never show between its letters)
    const w = measureText(f.banner) + (f.bannerOk ? 10 : 0), x = Math.round(R.w / 2 - w / 2);
    ctx.fillStyle = INK; ctx.fillRect(x - 5, 17, w + 10, 17);
    drawTextOutlined(ctx, f.banner, x, 22, { size: 1, color: '#f3e6c8', outline: INK, thickness: 1, shadow: false });
    if (f.bannerOk) drawSprite(ctx, ICONS.check, x + w - 3, 25);
  }
  if (f.bar != null) drawBossBar(ctx, R.w / 2, 37, f.bar);
}

/** The ← BACK TO BARN button (bottom left of the overlay). */
export function drawBackButton(ctx: CanvasRenderingContext2D): void {
  const r = BACK_BUTTON;
  ctx.fillStyle = INK; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = '#3a2e34'; ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  drawText(ctx, '← BACK TO BARN', r.x + r.w / 2, r.y + 5, { color: '#f3e6c8', shadow: false, align: 'center' });
}

/** What the trip brought home: its coin (half on a failure) and its egg (on a success). */
export function rewardsOf(trip: Trip): { coin: number; egg: DragonElement | null } {
  return { coin: trip.success ? trip.mission.coin : Math.floor(trip.mission.coin / 2), egg: trip.success ? trip.egg : null };
}

/** The result card's title: the trip's pass or fail, told here at the road's end and nowhere on the road before it. */
export function resultTitle(trip: Trip): string { return trip.success ? 'HOME SAFE!' : 'NOT THIS TIME'; }

/** The result card (once the trip's time is up, until the team lands): HOME SAFE! or NOT THIS TIME, the rewards, and that nobody is hurt (the fights never wound: BASE_DESIGN B8). */
export function drawResultCard(ctx: CanvasRenderingContext2D, trip: Trip, tick: number): void {
  const r = RESULT_CARD, { coin, egg } = rewardsOf(trip);
  ctx.fillStyle = INK; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = '#8a6a4a'; ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  ctx.fillStyle = '#e8d8a8'; ctx.fillRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6);
  const cx = r.x + r.w / 2;
  drawTextOutlined(ctx, resultTitle(trip), cx, r.y + 14, { size: 2, color: '#f3e6c8', outline: INK, thickness: 1, align: 'center', shadow: false });
  const line = egg ? `+${coin} COIN   AND AN EGG` : `+${coin} COIN`;
  drawText(ctx, line, cx - (egg ? 8 : 0), r.y + 50, { color: INK, shadow: false, align: 'center' });
  if (egg) drawEgg(ctx, egg, cx + measureText(line) / 2 + 4, r.y + 58, 0, tick);
  drawText(ctx, 'NOBODY IS HURT.', cx, r.y + 72, { color: INK, shadow: false, align: 'center' });
  drawText(ctx, 'TAP TO CLOSE', cx, r.y + 98, { color: '#6b5a44', shadow: false, align: 'center' });
}
