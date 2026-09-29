// The watchable scene (docs/BASE_DESIGN.md 6, 11): a team out on a mission, walking the road of its region and halting
// at each stop for its encounter -- an obstacle worked at turn by turn (each pair's dragon's move its own anim, its
// rider's special the rider's moment), or a fight: with a pack of the region's little enemies between the challenges,
// or with its boss at the road's end. The enemies run in fierce; the riders step back behind their dragons, out of
// the way; each dragon's breath is thrown, a bolt of its element from its mouth, and each enemy's attack is its
// region's missile (fightfx.ts); a hit is a spark and a flash, never a wound (BASE_DESIGN B8). A pack worn out goes up
// in puffs of smoke, one of it for each share of its puff, and one not worn out scampers off; a boss worn out sits
// down seeing stars and runs off up the road, and one not worn out stomps off up it unbeaten. Then the result card, once
// the team has walked the whole road. The team never turns back: every trip walks its whole road, and only the result
// card, at the end, tells the outcome.
// The scene is the trip's state (B5, amended): nothing here is stepped or saved; every quantity is a pure function of
// the Trip (its walk, its stops' results, the encounter on) and the world's clock (`sceneAt`), so a frozen view (t=)
// and a view opened half way along show the same road. The simulation never reads any of it.
//
// The pace (as the barn's: BASE_DESIGN 2, the lively step): each team dragon walks by its own walk anim's root motion
// (gait.ts), all at the slowest dragon's mean pace V: dragon i's walk plays at speed s_i = V / avg_i (1 or less) and its
// body moves D_i(s_i n) -- the distance its walk carries it by anim time s_i n (the frames' moves summed, the last
// frame's in part) -- where n is the trip's walk so far (trip.walked: the steps the team has walked, none while it
// stands at a stop). So a planted paw stands still on the road, frame by frame (sim-check 24's no-skate check). The
// riders walk beside their dragons (56 px ahead of the root, a step behind in depth) at V.
import type { CareSim, Dragon, Keeper } from './sim.ts';
import type { Trip } from './trip.ts';
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
import { drawBolt, drawMissile, drawSpark, drawPoof, REGION_MISSILE, SPARK_LEN, POOF_LEN } from './fightfx.ts';
import type { MissileKind } from './fightfx.ts';
import { drawMiller } from './npcs.ts';
import { SADDLE } from './missionicons.ts';
import { regionOf } from './regions.ts';
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
import { drawDragon, rootToScreen as dragonRootToScreen } from '../art/dragon/rig.ts';
import { TopPass, AmbientBudget } from '../art/dragon/fx.ts';
import { ELEMENT_ANIM_FALLBACK } from '../art/dragon/anims.ts';
import { dfaceIndex } from '../art/dragon/pose.ts';
import { drawText, drawTextOutlined, measureText } from '../lib/engine/text.ts';
import { stopStart, stopName, pairLook, pickAnim, foeShow, packLeft, FOE, FOE_ENTER, FOE_THROW, EXIT_STEPS, BREATH_SNAP, FLASH_FRAMES } from './encounter.ts';
import type { Encounter, EMove, Foe } from './encounter.ts';

// ---------- the scene's shape ----------

/** The overlay: under the top bar to the bottom of the screen (640 x 360). */
export const SCENE_RECT: Readonly<Rect> = Object.freeze({ x: 0, y: 16, w: 640, h: 344 });
/** The team's feet on the road (screen y), and the road's straw-pale band (FLOORS.road). */
export const ROAD_Y = 300, ROAD_TOP = 292, ROAD_BOTTOM = 306;
/** Set pieces, the miller and the enemies stand a few px deeper than the team (drawn behind it). */
export const BACK_Y = 296;
/**
 * Pair 1's dragon walks this far behind pair 0's; each rider this far ahead of their dragon's root (RIDER_FIGHT in a
 * fight: stepped back behind it, out of the way); a stop's set piece this far ahead of the lead as the stop begins, a
 * pack's front one FOE_AHEAD (the rest FOE_GAP apart behind it), a boss further.
 */
export const PAIR_BACK = 170, RIDER_AHEAD = 56, RIDER_FIGHT = -22, PIECE_AHEAD = 150, FOE_AHEAD = 118, FOE_GAP = 30, BADDIE_AHEAD = 200;
/** A rider steps back (or forward again) in this many steps at most: their own walk's pace, or brisker. */
export const RIDER_STEP_MAX = 100;
/**
 * A boss worn out sits down seeing stars for this share of its exit beat, then runs off up the road FLEE_PACE px a
 * step; one not worn out stomps off up it STOMP_PACE px a step, and a pack not worn out scampers off SCAMPER_PACE (each
 * quicker than the team walks: never back through it).
 */
export const DOWN_SHARE = 0.55, FLEE_PACE = 1.6, STOMP_PACE = 1, SCAMPER_PACE = 3;
/** A bolt that goes wide, or a missile dodged, flies on past its mark this many steps. */
export const PAST_STEPS = 12;
/** A pack runs in over this many steps, each one ENTER_STAGGER after the one in front of it. */
export const PACK_RUN = 96, ENTER_STAGGER = 14;
/** The camera keeps the team's middle this far from the screen's left edge. */
export const CAM_BACK = 260;
/**
 * The result card: tapped away, it is the way back to the barn (the scene is the game following the team, BASE_DESIGN
 * 6: it has no other).
 */
export const RESULT_CARD: Readonly<Rect> = Object.freeze({ x: 170, y: 100, w: 300, h: 140 });
/** A moment (a rider's special, a dragon's move) gives way to idle when its anim ends, or after this many steps at most (a looping one: Tomas's petLow, the REST's sit). */
export const MOMENT_MAX = 240;
/** The most clock steps the view's team steps on by in one draw; a bigger jump replays a walk from the road's phase. */
export const SYNC_GAP = 16;

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

// ---------- a fight's places: where a dragon breathes from, where a hit lands ----------

const MOUTH = new Map<string, readonly [number, number]>();
/**
 * A dragon's mouth at its breath's snap (the breath anim's step BREATH_SNAP, where its bolt leaves: encounter.ts), px
 * from its root (facing up the road): the rig's own mouth joint, played to that step once and kept (a pure function of
 * the look).
 */
export function mouthOf(el: DragonElement, stage: Stage, seed: number): readonly [number, number] {
  const key = `${el}:${stage}:${seed}`;
  let m = MOUTH.get(key);
  if (!m) {
    const p = makePet(el, stage, seed, 'breath', 0, 0, { desync: false }), o = { x: 0, y: 0 };
    for (let f = 0; f < BREATH_SNAP; f++) stepPet(p);
    dragonRootToScreen(p.rig, p.rig.j.mouth.x, p.rig.j.mouth.y, o);
    m = Object.freeze([Math.round(o.x * 10) / 10, Math.round(o.y * 10) / 10] as const);
    MOUTH.set(key, m);
  }
  return m;
}
/** Where an enemy's missile lands on a dragon standing at x: over its shoulders, from its mouth's place. */
const bodyAt = (x: number, mouth: readonly [number, number]): [number, number] => [x + mouth[0] * 0.15, ROAD_Y + mouth[1] * 0.7];
/** A thrown thing's arc, by the distance it flies: a bolt's flatter than a missile's. */
const boltArc = (dist: number) => 12 + dist * 0.12, missileArc = (dist: number) => 24 + dist * 0.16;
/**
 * A thrown thing at step t of its move: launched at t0 from (x0, y0), landing at t1 on (x1, y1) over an arc `arc` px
 * high (past t1 it flies on the same way: one that goes wide, or is dodged); where it is, and its step's way (the
 * sprite's facing and its trail).
 */
function flight(x0: number, y0: number, x1: number, y1: number, arc: number, t0: number, t1: number, t: number): { x: number; y: number; dx: number; dy: number } {
  const span = Math.max(1, t1 - t0), at = (u: number) => ({ x: x0 + (x1 - x0) * u, y: y0 + (y1 - y0) * u - arc * 4 * u * (1 - u) });
  const u = (t - t0) / span, p = at(u), p2 = at(u + 1 / span);
  return { x: Math.round(p.x), y: Math.round(p.y), dx: p2.x - p.x, dy: p2.y - p.y };
}
/** An enemy's point, facing the team (its art's own, measured facing up the road): where a hit lands on it, or where it throws from. */
function enemyPoint(id: BaddieId | FoeId, pack: boolean, x: number, which: 'hitAt' | 'throwAt'): [number, number] {
  const a = pack ? FOE_ART[id as FoeId][which] : BADDIE_ART[id as BaddieId][which];
  return [x - a[0], BACK_Y + a[1]];
}
/** A rider's step back behind their dragon for a fight (and forward again after it), in steps: at their walk's own pace, RIDER_STEP_MAX at most. */
const riderStep = (k: Keeper | null) => Math.min(RIDER_STEP_MAX, Math.round((RIDER_AHEAD - RIDER_FIGHT) / (k ? KEEPERS[k.look].speed : 1)));

// ---------- the scene as a pure function ----------

/** What one of the team does at a moment of the scene: its anim, since which clock, and how fast; a walk's start phase. */
export interface Act { key: string; anim: string; start: number; speed: number; phase: number }
/** A stop's set piece on the road, where it stands and how it looks now. */
export interface Piece { stop: number; x: number; state: StopState }
/**
 * The boss on the road: where, which way it faces, its face and pose (the art kit draws a sit-down's stars and a run's
 * dust from them: baddies.ts drawBaddie), whether a hit is flashing on it, and its step (its bob and stride).
 */
export interface BaddieAt { id: BaddieId; x: number; face: BaddieFace; pose: BaddiePose; facing: 1 | -1; flash: boolean; t: number }
/** One of a pack of little enemies on the road, likewise (foes.ts drawFoe). */
export interface FoeAt { id: FoeId; x: number; face: BaddieFace; pose: FoePose; facing: 1 | -1; flash: boolean; t: number }
/** Something in flight: a dragon's breath bolt (its element) or an enemy's missile (its region's kind, a boss's big), where it is and which way it moves. */
export interface ShotAt { el: DragonElement | null; missile: MissileKind | null; big: boolean; x: number; y: number; dx: number; dy: number }
/** A mark where a hit landed (a spark) or one of a pack was worn out (a puff of smoke), and its age. */
export interface MarkAt { kind: 'spark' | 'poof'; x: number; y: number; age: number }
/** Each rider's place from its dragon's root (px along the road), and which way they face. */
export interface RiderAt { dx: number; facing: 1 | -1 }

/**
 * The scene at a moment (`SceneFrame`: BASE_DESIGN 6's scene, plus what the view needs to draw it): the walk so far
 * (`n`, of `travel`), the stop the team stands at (`stop`: its encounter on, else null), the last stop reached (its
 * banner stays up until the next); xs each pair's dragon's road x (the team walks up the road, east, all the way: it
 * never turns back), `speeds` each one's walk speed, `riders` each rider's place by it; `camX` the road x at the
 * screen's left edge. A fight's: the boss, the pack (front one first), what is in flight, the marks of the hits, and
 * which dragons a hit is flashing on. Nothing in it tells the trip's outcome before the road's end: that is the result
 * card's, once `done`.
 */
export interface SceneFrame {
  n: number; travel: number;
  stop: number | null; last: number | null;
  xs: number[]; speeds: number[];
  riders: RiderAt[];
  camX: number;
  banner: string | null; bannerOk: boolean;
  baddie: BaddieAt | null;
  foes: FoeAt[];
  shots: ShotAt[];
  marks: MarkAt[];
  flash: boolean[];
  pieces: Piece[];
  acts: { dragon: Act; rider: Act | null; face: 'surprised' | 'happy' | null }[];
  done: boolean;
}

// (the scene's type guard, BASE_DESIGN B8: an enemy on the road has no health, wound or defeat -- only puff to wear down,
// on the encounter's own plate; the art kit's own guard over its Baddie record is baddies.ts's)
type Assert<T extends true> = T;
export type _NoHurt = Assert<Extract<keyof BaddieAt | keyof FoeAt | keyof SceneFrame, 'hurt' | 'hp' | 'health' | 'defeated' | 'damage'> extends never ? true : false>;

/** Each rider's special on the road (BASE_DESIGN 6, 11): CHARM waves, MEDIC kneels to pet, NAVIGATOR hushes, NIMBLE cheers. */
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

/**
 * How far along its road the team out is, 0..1 -- the Map Room map's flag on the road (maptable.ts): 0 until it has left
 * the Aerie and again once it lands, its walk's share between (trip.walked of its travel), so the flag stands still while
 * the team stands at a stop and never goes back: the team walks the whole road, whatever happens on it, and the flag,
 * like the scene, never tells the outcome.
 */
export function roadFraction(_sim: CareSim, trip: Trip): number {
  if (trip.state === 'return' || trip.state === 'home') return 1;
  if (trip.state !== 'away') return 0;
  return trip.travel > 0 ? Math.max(0, Math.min(1, trip.walked / trip.travel)) : 0;
}

/** Whether the trip's road is walked whole and its last stop resolved -- the team landed, its outcome decided: the result card's moment. */
export function roadDone(trip: Trip): boolean {
  return trip.state === 'return' || trip.state === 'home';
}

/**
 * The scene at the world's clock: pure -- the same trip state and clock give the same frame, always. It never reads the
 * trip's outcome (success, egg): the road is drawn as it was walked and as its stops went, until the result card
 * (drawResultCard) tells how the trip ended, at the road's end.
 */
export function sceneAt(sim: CareSim, trip: Trip, clock: number = sim.clock): SceneFrame {
  const team = teamOf(sim, trip), travel = trip.travel, n = Math.max(0, Math.min(travel, trip.walked)), stops = trip.stops, enc = trip.encounter;
  const starts = stops.map((_, j) => stopStart(trip, j));
  const reached = (j: number) => stops[j].result !== 'ahead' || (!!enc && enc.stop === j);
  let last: number | null = null;
  for (let j = 0; j < stops.length; j++) if (reached(j)) last = j;
  const stop = enc ? enc.stop : null;
  const X0 = (i: number) => -PAIR_BACK * i;
  const xAt = (i: number, nn: number) => X0(i) + walkDist(team.gaits[i], team.speeds[i] * nn);
  const xs = team.ds.map((_, i) => xAt(i, n));
  const mean = xs.length ? xs.reduce((a, v) => a + v, 0) / xs.length : 0;
  const camX = mean - CAM_BACK;
  // (where the lead stands as stop j begins: the walk's own distance at the stop's step -- the stops ahead stand up the
  // road where the team will reach them, never bunched at the lead)
  const leadAt = (j: number) => (team.ds.length ? xAt(0, starts[j]) : 0);

  // the set pieces: every stop's (the team reaches them all), where it stands and how it went
  const pieces: Piece[] = [];
  for (let j = 0; j < stops.length; j++) {
    if (stops[j].kind !== 'challenge') continue;
    pieces.push({ stop: j, x: leadAt(j) + PIECE_AHEAD, state: stops[j].result === 'met' ? 'met' : stops[j].result === 'unmet' ? 'unmet' : 'ahead' });
  }

  // the banner: the stop the team stands at -- its name as it is met (a fight's with a "!"), then the encounter's latest
  // line -- or the last stop's line (how it went, with a check when it was cleared), up until the next stop
  let banner: string | null = null, bannerOk = false;
  if (enc) {
    const s = stops[enc.stop];
    if (enc.state === 'meet') banner = enc.kind === 'fight' ? `${stopName(s)}!` : stopName(s);
    else { banner = enc.log[enc.log.length - 1] ?? stopName(s); bannerOk = enc.state === 'done' && s.result === 'met'; }
  } else if (last != null) { banner = stops[last].log || stopName(stops[last]); bannerOk = stops[last].result === 'met'; }

  // the boss: in from the right as its fight begins, fierce through its turns (its lunge as it throws, rocked back and
  // flashing as a hit lands: encounter.ts foeShow), then its exit, timed from the stop's resolution -- worn out, it sits
  // down seeing stars and then runs off up the road; not worn out, it stomps off up it unbeaten -- ahead of the team
  // (never back through it) until it is well off the screen
  let baddie: BaddieAt | null = null;
  const kb = stops.findIndex((s) => s.kind === 'baddie'), bossX = kb >= 0 ? leadAt(kb) + BADDIE_AHEAD : 0;
  if (kb >= 0 && reached(kb)) {
    const id = stops[kb].baddie!, x0 = bossX, e = enc && enc.stop === kb ? enc : null;
    if (e && e.state === 'meet') {
      const walkIn = Math.round(0.7 * FOE_ENTER), from = x0 + 190, bt = e.t;
      baddie = { id, x: bt < walkIn ? from + (x0 - from) * (bt / walkIn) : x0, face: 'fierce', pose: bt < walkIn ? 'walk' : 'stand', facing: -1, flash: false, t: bt };
    } else if (e && e.state !== 'done') {
      const show = foeShow(e);
      baddie = { id, x: x0, face: show.face, pose: show.pose, facing: -1, flash: show.flash, t: e.t };
    } else {
      const et = Math.max(0, clock - (stops[kb].resolvedAt ?? clock)), down = Math.round(DOWN_SHARE * EXIT_STEPS);
      if (stops[kb].result !== 'met') baddie = { id, x: x0 + et * STOMP_PACE, face: 'fierce', pose: 'walk', facing: 1, flash: false, t: et };
      else if (et < down) baddie = { id, x: x0, face: 'dazed', pose: 'down', facing: -1, flash: false, t: et };
      else baddie = { id, x: x0 + (et - down) * FLEE_PACE, face: 'hurt', pose: 'flee', facing: 1, flash: false, t: et };
    }
    if (baddie && Math.abs(baddie.x - (camX + 320)) > 520) baddie = null;
  }

  // the pack at the stop the team stands at: in from the right as its fight begins (the front one first), fierce through
  // its turns -- lunging together as they throw, the front one rocked back and flashing as a hit lands on it (the
  // dragons aim at the nearest) -- one of it gone in a puff of smoke for every share of its puff worn down (encounter.ts
  // packLeft), and the rest, if the team sits down for a breather first, scampering off up the road
  const foes: FoeAt[] = [], shots: ShotAt[] = [], marks: MarkAt[] = [], flash = team.ds.map(() => false);
  const fight = enc && enc.kind === 'fight' && enc.foe ? enc : null, f0 = fight?.foe ?? null;
  const pack = !!fight && stops[fight.stop].kind === 'foes', packX = (e: number) => leadAt(fight!.stop) + FOE_AHEAD + e * FOE_GAP;
  const mv: EMove | null = fight && fight.state === 'play' ? fight.moves[fight.cur] ?? null : null;
  // (how many of the pack stood before the move playing landed: more than now, if it sent some up in smoke)
  const left = f0 ? packLeft(f0) : 0, before = f0 && mv && mv.by !== FOE && mv.landed && mv.loss > 0 ? packLeft({ ...f0, puff: f0.puff + mv.loss } as Foe) : left;
  if (fight && pack && f0) {
    const id = stops[fight.stop].foe!, show = foeShow(fight), n = f0.pack;
    for (let e = n - left; e < n; e++) {
      const spot = packX(e), t = fight.t + e * 7;
      if (fight.state === 'meet') {
        const run = fight.t - e * ENTER_STAGGER, x = run < PACK_RUN ? spot + 300 * (1 - Math.max(0, run) / PACK_RUN) : spot;
        foes.push({ id, x: Math.round(x * 100) / 100, face: 'fierce', pose: run < PACK_RUN ? 'walk' : 'stand', facing: -1, flash: false, t });
      } else if (fight.state === 'done') foes.push({ id, x: spot + fight.t * SCAMPER_PACE, face: 'fierce', pose: 'walk', facing: 1, flash: false, t });
      else {
        // (a hit is the front one's -- none's if it went up in smoke; a lunge, a stomp, a daze the whole pack's)
        const mine = show.pose !== 'hit' || (e === n - left && before === left);
        foes.push({ id, x: spot, face: mine ? show.face : 'fierce', pose: mine ? show.pose : 'stand', facing: -1, flash: mine && show.flash, t });
      }
    }
    // the puffs of smoke: the ones the move playing wore out -- or, the pack worn out, the last move's, into the stop's beat
    const last = fight.state === 'done' && fight.outcome === 'cleared' ? fight.moves[fight.moves.length - 1] ?? null : null;
    const poof = last ?? mv, was = last ? packLeft({ ...f0, puff: last.loss } as Foe) : before, now = last ? 0 : left;
    if (poof && poof.landed) {
      const age = poof.t - poof.at + (last ? fight.t : 0);
      if (age < POOF_LEN) for (let e = n - was; e < n - now; e++) { const [x, y] = enemyPoint(id, true, packX(e), 'hitAt'); marks.push({ kind: 'poof', x: Math.round(x), y: Math.round(y), age }); }
    }
  }

  // what is in flight in a fight's move: a breath's bolt, from its dragon's mouth at its snap to the enemy (a pack's
  // front one), landing at the move's impact; an enemy's attack, its region's missile from each thrower's hand (a boss's
  // big one; a pack's one each, a few steps apart), landing on the dragon it is at -- a spark where either hits (and a
  // flash on a dragon), and one that goes wide or is dodged flying on past
  if (fight && f0 && mv) {
    const id = pack ? stops[fight.stop].foe! : stops[fight.stop].baddie!, at = (e: number, which: 'hitAt' | 'throwAt') => enemyPoint(id, pack, pack ? packX(e) : bossX, which);
    const past = mv.landed && !mv.hit && mv.t < mv.at + PAST_STEPS, age = mv.t - mv.at;
    if (mv.by !== FOE && (mv.ability === 'breath' || mv.ability === 'big') && team.ds[mv.by]) {
      const d = team.ds[mv.by], mouth = mouthOf(d.element, d.stage, d.seed), [x0, y0] = [xs[mv.by] + mouth[0], ROAD_Y + mouth[1]];
      const [x1, y1] = at(pack ? f0.pack - before : 0, 'hitAt');
      if (mv.t >= BREATH_SNAP && (mv.t < mv.at || past)) shots.push({ el: d.element, missile: null, big: mv.ability === 'big', ...flight(x0, y0, x1, y1, boltArc(Math.abs(x1 - x0)), BREATH_SNAP, mv.at, mv.t) });
      else if (mv.landed && mv.hit && age < SPARK_LEN) marks.push({ kind: 'spark', x: Math.round(x1), y: Math.round(y1), age });
    }
    if (mv.by === FOE && mv.foeMove === 'attack' && team.ds[mv.target]) {
      const i = mv.target, d = team.ds[i], [x1, y1] = bodyAt(xs[i], mouthOf(d.element, d.stage, d.seed)), kind = REGION_MISSILE[trip.mission.region];
      const throwers = pack ? Array.from({ length: left }, (_, k) => f0.pack - left + k) : [0];
      throwers.forEach((e, k) => {
        const [x0, y0] = at(e, 'throwAt'), t0 = FOE_THROW + 3 * k;
        if (mv.t >= t0 && (mv.t < mv.at || past)) shots.push({ el: null, missile: kind, big: !pack, ...flight(x0, y0, x1, y1, missileArc(Math.abs(x1 - x0)), t0, mv.at, mv.t) });
      });
      if (mv.landed && mv.hit) {
        if (age < SPARK_LEN) marks.push({ kind: 'spark', x: Math.round(x1), y: Math.round(y1), age });
        if (age < FLASH_FRAMES) flash[i] = true;
      }
    }
  }

  // each rider's place: beside its dragon's head, stepping back behind it as a fight begins and forward again as it ends
  const riders: RiderAt[] = team.ds.map((_, i) => {
    if (!fight || (fight.state !== 'meet' && fight.state !== 'done')) return { dx: fight ? RIDER_FIGHT : RIDER_AHEAD, facing: 1 };
    const u = Math.min(1, fight.t / riderStep(team.ks[i]));
    return fight.state === 'meet'
      ? { dx: Math.round((RIDER_AHEAD + (RIDER_FIGHT - RIDER_AHEAD) * u) * 100) / 100, facing: u < 1 ? -1 : 1 }
      : { dx: Math.round((RIDER_FIGHT + (RIDER_AHEAD - RIDER_FIGHT) * u) * 100) / 100, facing: 1 };
  });

  // what each of the team does: walk between stops; at a stop stand, each pair playing its move as it comes (the
  // dragon's skill, the REST's sit, or the rider's special), and in a fight each rider walking back behind their dragon
  // and forward again; home, stand
  const done = roadDone(trip);
  const m = enc && enc.state === 'play' ? enc.moves[enc.cur] ?? null : null;
  const acts = team.ds.map((d, i) => {
    const k = team.ks[i];
    const walkAct = (who: 'd' | 'k'): Act => {
      const seg = last == null ? -1 : last, tau = team.speeds[i] * n, g = team.gaits[i];
      const segStart = seg < 0 ? 0 : starts[seg], since = Math.max(0, n - segStart);
      return who === 'd'
        ? { key: `w${seg}`, anim: 'walk', start: clock - since, speed: team.speeds[i], phase: loopPhase(g, tau) }
        : { key: `w${seg}`, anim: 'walk', start: clock - since, speed: team.V / KEEPERS[k!.look].speed, phase: 0 };
    };
    const stand = (tag: string): Act => ({ key: tag, anim: 'idle', start: clock, speed: 1, phase: 0 });
    if (done) return { dragon: stand('end'), rider: k ? stand('end') : null, face: null };
    if (enc) {
      const at = `s${enc.stop}`;
      let dragon: Act = stand(at), rider: Act | null = k ? stand(at) : null, face: 'surprised' | 'happy' | null = null;
      if (k && fight && (fight.state === 'meet' || fight.state === 'done')) {
        const step = riderStep(k), pace = (RIDER_AHEAD - RIDER_FIGHT) / step / KEEPERS[k.look].speed;
        if (fight.t < step) rider = { key: `${fight.state === 'meet' ? 'r' : 'f'}${enc.stop}`, anim: 'walk', start: clock - fight.t, speed: pace, phase: 0 };
      }
      if (m && m.by === i && m.t < m.len && m.ability !== 'sit') {
        const key = `m${enc.stop}-${enc.turn}-${m.n}`;
        if (m.ability === 'rider') { if (k) rider = { key, anim: RIDER_MOMENT[k.look], start: clock - m.t, speed: 1, phase: 0 }; }
        else { const anim = pickAnim(d.element, m.ability); if (anim) dragon = { key, anim, start: clock - m.t, speed: 1, phase: 0 }; }
      }
      const look = pairLook(enc, i);
      if (look?.face === 'surprised' || look?.face === 'happy') face = look.face;
      return { dragon, rider, face };
    }
    return { dragon: walkAct('d'), rider: k ? walkAct('k') : null, face: null };
  });

  return { n, travel, stop, last, xs, speeds: team.speeds, riders, camX, banner, bannerOk, baddie, foes, shots, marks, flash, pieces, acts, done };
}

/** Whether the enemy's own move is playing now (its throw, its stomp): the view's popup timing reads the encounter itself. */
export function foeMoving(enc: Encounter | null): boolean {
  if (!enc || enc.state !== 'play') return false;
  const m = enc.moves[enc.cur];
  return !!m && m.by === FOE && m.t < m.len;
}

// ---------- the view: the team's pets and riders, and drawing ----------

/** One of the team on screen: its pet or rider character, the act it is playing, and the clock it was last stepped at. */
const HAND = { x: 0, y: 0 };
interface Actor { pet: Pet | null; agent: KeeperAgent | null; key: string | null; clock: number; momentDone: boolean; age: number }

/**
 * The team's characters for one trip (base.ts builds them when the scene opens, and again for another trip): each pair's
 * dragon on the real rig and its rider on the paper doll, played to the scene's acts. `sync` catches them up to the
 * frame: an act they were not playing starts fresh -- a walk at its speed and the phase the road says (exact), anything
 * else replayed from its start (a move's worth at most: a frozen view shows the same moment a live one did) -- and one
 * they were playing steps on by the clock's advance (SYNC_GAP steps at most; a bigger jump, or a rewind, restarts a
 * walk at the road's phase, and steps anything else on by 120 at most). A face a move left on a dragon (surprised at
 * the enemy's cost, a grin at a dodge) goes over its pose, and a hit landing on it flashes it (its fills flat and pale
 * inside its ink: the grow-up's flash, ART_BIBLE 4.2). The riders stand where the frame puts them (stepped back behind
 * their dragons in a fight), facing the way it says.
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
      const x = f.xs[i], r = f.riders[i] ?? { dx: RIDER_AHEAD, facing: 1 };
      this.play(a.d, act.dragon, clock, x, ROAD_Y, 1);
      if (a.k && act.rider) this.play(a.k, act.rider, clock, x + r.dx, ROAD_Y - 3, r.facing);
      if (act.face && a.d.pet) a.d.pet.player.pose.face = dfaceIndex(act.face);
    });
  }

  private play(a: Actor, act: Act, clock: number, x: number, y: number, facing: 1 | -1): void {
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
      ticks = a.pet && act.anim === 'walk' ? 0 : Math.max(0, Math.min(act.anim === 'walk' ? 120 : 960, Math.round(clock - act.start)));
    } else ticks = Math.max(0, Math.min(gap > SYNC_GAP ? 120 : SYNC_GAP, gap));
    a.clock = clock;
    for (let t = 0; t < ticks; t++) this.tick(a, act, x, y, facing);
    // (placed where the frame says even when nothing ticked; the dragons facing up the road, as the team always does)
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

  /** Each pair's dragon's head (the top of its cranium, road px as last drawn: `x` along the road, `y` on the screen), for the encounter's popups (encounterui.ts). */
  heads(): { x: number; y: number }[] {
    const pt = { x: 0, y: 0 };
    return this.actors.map((a) => { const p = a.d.pet!; dragonRootToScreen(p.rig, p.rig.j.cran.x, p.rig.j.top, pt); return { x: pt.x, y: pt.y }; });
  }

  /**
   * Draw the team (already synced): the riders a step behind their dragons, each with its saddle in the near hand (the
   * art kit's SADDLE, as a rider carries it in the barn's muster), then the dragons -- one a hit has just landed on
   * drawn flat in its glow's highlight inside its own ink -- then the top pass.
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

/** Where the enemy's head is on screen (its drawing's top, over its feet at BACK_Y: the boss's, or a pack's front one's), for the encounter's popups; null when none is in view. */
export function baddieHead(f: SceneFrame): { x: number; y: number } | null {
  if (f.baddie) return { x: Math.round(f.baddie.x - f.camX), y: BACK_Y - BADDIE_ART[f.baddie.id].h };
  const q = f.foes[0];
  return q ? { x: Math.round(q.x - f.camX), y: BACK_Y - FOE_ART[q.id].h } : null;
}
/** Where a stop's set piece stands on screen (its middle at the road), for the encounter's work popups; null when it is not in view. */
export function pieceAt(f: SceneFrame, stop: number): { x: number; y: number } | null {
  const p = f.pieces.find((q) => q.stop === stop);
  if (!p) return null;
  const x = Math.round(p.x - f.camX);
  return x < -90 || x > SCENE_RECT.w + 90 ? null : { x, y: BACK_Y - 70 };
}

/**
 * The scene (BASE_DESIGN 6), inside SCENE_RECT: the region's climate (parallax: backdrops.ts drawClimate), the road, the set
 * pieces the road has reached (each behind the team: the fog bank too), the miller at his mill, the boss and the pack
 * (behind the team too), the team, the puffs of smoke, what is in flight and the sparks of the hits over it all, then
 * the banner. Syncs `cast` to the frame first.
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
  // (its marks -- a sit-down's stars circling its head, a run's dust at its heels -- are the art kit's, drawn by
  // drawBaddie from the pose)
  if (bd) drawBaddie(ctx, bd.id, bd.x, BACK_Y, bd.facing, bd.face, bd.pose, bd.t, bd.flash);
  // (the pack drawn back to front, the front one last)
  for (let i = f.foes.length - 1; i >= 0; i--) { const q = f.foes[i]; if (seen(q.x, 20)) drawFoe(ctx, q.id, q.x, BACK_Y, q.facing, q.face, q.pose, q.t, q.flash); }
  cast.draw(ctx);
  for (const m of f.marks) if (m.kind === 'poof') drawPoof(ctx, m.x, m.y, m.age);
  for (const s of f.shots) {
    if (s.el) drawBolt(ctx, s.el, s.x, s.y, s.dx, s.dy);
    else if (s.missile) drawMissile(ctx, s.missile, s.big, s.x, s.y, s.dx, s.dy);
  }
  for (const m of f.marks) if (m.kind === 'spark') drawSpark(ctx, m.x, m.y, m.age);
  ctx.restore();
  if (f.banner) {
    // (on an ink strip, as the barn's hint and action line are: the weather's marks never show between its letters)
    const w = Math.min(R.w - 16, measureText(f.banner)) + (f.bannerOk ? 10 : 0), x = Math.round(R.w / 2 - w / 2);
    ctx.fillStyle = INK; ctx.fillRect(x - 5, 17, w + 10, 17);
    drawTextOutlined(ctx, f.banner, x, 22, { size: 1, color: '#f3e6c8', outline: INK, thickness: 1, shadow: false });
    if (f.bannerOk) drawSprite(ctx, ICONS.check, x + w - 3, 25);
  }
}

/** What the trip brought home: its coin (half on a failure) and its egg (on a success). Read once the road is done (trip.success decided). */
export function rewardsOf(trip: Trip): { coin: number; egg: DragonElement | null } {
  return { coin: trip.success ? trip.mission.coin : Math.floor(trip.mission.coin / 2), egg: trip.success ? trip.egg : null };
}

/** The result card's title: the trip's pass or fail, told here at the road's end and nowhere on the road before it. */
export function resultTitle(trip: Trip): string { return trip.success ? 'HOME SAFE!' : 'NOT THIS TIME'; }

/**
 * The result card (once the road is done, until it is tapped away -- the way back to the barn, BASE_DESIGN 6): HOME
 * SAFE! (every stop cleared) or NOT THIS TIME, the stops cleared, the rewards, the XP each pair's dragon brought home,
 * that nobody is hurt, and that a tap goes back to the barn.
 */
export function drawResultCard(ctx: CanvasRenderingContext2D, sim: CareSim, trip: Trip, tick: number): void {
  const r = RESULT_CARD, { coin, egg } = rewardsOf(trip);
  ctx.fillStyle = INK; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = '#8a6a4a'; ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  ctx.fillStyle = '#e8d8a8'; ctx.fillRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6);
  const cx = r.x + r.w / 2, cleared = trip.stops.filter((s) => s.result === 'met').length;
  drawTextOutlined(ctx, resultTitle(trip), cx, r.y + 12, { size: 2, color: '#f3e6c8', outline: INK, thickness: 1, align: 'center', shadow: false });
  drawText(ctx, `${cleared} OF ${trip.stops.length} STOPS CLEARED`, cx, r.y + 40, { color: '#6b5a44', shadow: false, align: 'center' });
  const line = egg ? `+${coin} COIN   AND AN EGG` : `+${coin} COIN`;
  drawText(ctx, line, cx - (egg ? 8 : 0), r.y + 56, { color: INK, shadow: false, align: 'center' });
  if (egg) drawEgg(ctx, egg, cx + measureText(line) / 2 + 4, r.y + 64, 0, tick);
  const xp = trip.pairs.map((p, i) => `${sim.dragons.find((d) => d.id === p.dragon)?.name ?? '?'} +${trip.xp[i]} XP`).join('   ');
  drawText(ctx, xp, cx, r.y + 74, { color: '#3a6a2e', shadow: false, align: 'center' });
  drawText(ctx, 'NOBODY IS HURT.', cx, r.y + 92, { color: INK, shadow: false, align: 'center' });
  drawText(ctx, 'TAP TO GO BACK TO THE BARN', cx, r.y + 118, { color: '#6b5a44', shadow: false, align: 'center' });
}
