// The watchable scene (docs/BASE_DESIGN.md 6): a team out on a mission, walking the road of its region, meeting
// each challenge where it comes (the counter's moment, a banner) or waiting it out, a hard mission's big baddie at the
// end of the road (walks in grumpy, is met by its two counters, and leaves calmed, outwitted or driven off -- nobody
// hurt, ever: BASE_DESIGN B8), and the result card once the trip's time is up. The team never turns back: every trip
// walks its whole road, and the scene is the same whatever the outcome until the result card tells it, at the end.
// "The scene is the timer" (B5): nothing here is stepped or saved;
// every quantity is a pure function of the Trip and the world's clock (`sceneAt`), so a frozen view (t=) and a view
// opened half way along show the same road. The simulation never reads any of it.
//
// The pace (as the barn's: BASE_DESIGN 2, the lively step): each team dragon walks by its own walk anim's root motion (gait.ts), all at the
// slowest dragon's mean pace V: dragon i's walk plays at speed s_i = V / avg_i (1 or less) and its body moves D_i(s_i n)
// -- the distance its walk carries it by anim time s_i n (the frames' moves summed, the last frame's in part) -- where n
// is the trip's travel time so far (the time since it left, less the time spent standing at the stops' beats). So a
// planted paw stands still on the road, frame by frame (sim-check 24's no-skate check). The riders walk beside their
// dragons (56 px ahead of the root, a step behind in depth) at V.
import type { CareSim, Dragon, Keeper } from './sim.ts';
import type { Trip } from './trip.ts';
import type { BaddieFace, BaddiePose, BaddieExit, BaddieId, StopState } from './missiondata.ts';
import type { Rect } from './icons.ts';
import { gaitOf } from './gait.ts';
import type { Gait } from './gait.ts';
import { readClock } from './clock.ts';
import { skyPhase } from './sky.ts';
import { FLOORS, INK, ROAD_SCENE } from './surfaces.ts';
import { drawClimate } from './backdrops.ts';
import { drawSetPiece } from './setpieces.ts';
import { drawBaddie, exitLook } from './baddies.ts';
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
import { drawDragon } from '../art/dragon/rig.ts';
import { TopPass, AmbientBudget } from '../art/dragon/fx.ts';
import { ELEMENT_ANIM_FALLBACK } from '../art/dragon/anims.ts';
import { drawText, drawTextOutlined, measureText } from '../lib/engine/text.ts';

// ---------- the scene's shape ----------

/** The overlay: under the top bar to the bottom of the screen (640 x 360). */
export const SCENE_RECT: Readonly<Rect> = Object.freeze({ x: 0, y: 16, w: 640, h: 344 });
/** The team's feet on the road (screen y), and the road's straw-pale band (FLOORS.road). */
export const ROAD_Y = 300, ROAD_TOP = 292, ROAD_BOTTOM = 306;
/** Set pieces, the miller and the baddie stand a few px deeper than the team (drawn behind it). */
export const BACK_Y = 296;
/** Pair 1's dragon walks this far behind pair 0's; each rider this far ahead of their dragon's root; a stop's set piece this far ahead of the lead as the stop begins, a baddie further. */
export const PAIR_BACK = 170, RIDER_AHEAD = 56, PIECE_AHEAD = 150, BADDIE_AHEAD = 200;
/** The camera keeps the team's middle this far from the screen's left edge. */
export const CAM_BACK = 260;
/**
 * The result card: tapped away, it is the way back to the barn (the scene is the game following the team, BASE_DESIGN
 * 6: it has no other).
 */
export const RESULT_CARD: Readonly<Rect> = Object.freeze({ x: 170, y: 110, w: 300, h: 120 });

/** A challenge's beat (the team stands while its counter meets it) and the baddie's, for a trip `L` steps long. */
export const beatLen = (L: number) => Math.min(600, Math.round(0.08 * L));
export const baddieBeatLen = (L: number) => Math.min(900, Math.round(0.12 * L));
/** The baddie's beat in three parts: it walks in (25 %), the two counters' moments (35 %), its exit (40 %). */
export function baddieParts(L: number): { enter: number; moments: number; exit: number } {
  const B = baddieBeatLen(L), enter = Math.round(0.25 * B), moments = Math.round(0.35 * B);
  return { enter, moments, exit: B - enter - moments };
}
/** A challenge's counter plays its moment this far into the beat; the set piece shows it met half way. */
const MOMENT_AT = 0.15, RESOLVED_AT = 0.5;
/** A moment gives way to idle when its anim ends, or after this many steps at most (a looping one: Tomas's petLow). */
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

// ---------- the scene as a pure function ----------

/** What one of the team does at a moment of the scene: its anim, since when (trip time E), and how fast; a walk's start phase. */
export interface Act { key: string; anim: string; start: number; speed: number; phase: number }
/** A stop's set piece on the road, where it stands and how it looks now. */
export interface Piece { stop: number; x: number; state: StopState }
/**
 * The baddie on the road: where, which way it faces, its face and pose, its marks (the calmed one's "z"s, the driven-off
 * one's dust: the art kit's drawBaddie draws them for a sleepy sit and a leave, baddies.ts), and its beat's time. The
 * outwitted one wanders off at a walk (the kit's exitLook: a plain walk, neutral; 'leave' is the driven-off shuffle,
 * with its dust and grumble cloud).
 */
export interface BaddieAt { id: BaddieId; x: number; face: BaddieFace; pose: BaddiePose; facing: 1 | -1; fx: 'z' | 'dust' | null; t: number }

/**
 * The scene at one clock value (`SceneFrame`: BASE_DESIGN 6's scene, plus what the view needs to draw it). E is the time since the
 * team left (0..L), n the travel time in it; `stop` the stop whose beat is playing (else null), `beatT` how far into it;
 * `last` the last stop reached (its banner stays up until the next); xs each pair's dragon's road x (the team walks
 * up the road, east, all the way: it never turns back), `speeds` each one's walk speed; `camX` the road x at the
 * screen's left edge. Nothing in it tells the trip's outcome: that is the result card's, once `done`.
 */
export interface SceneFrame {
  E: number; L: number; n: number;
  stop: number | null; beatT: number; last: number | null;
  xs: number[]; speeds: number[];
  camX: number;
  banner: string | null; bannerOk: boolean;
  baddie: BaddieAt | null;
  pieces: Piece[];
  acts: { dragon: Act; rider: Act | null }[];
  done: boolean;
}

// (the scene's type guards, BASE_DESIGN B8: a baddie on the road has no hurt, health or defeat, and its face is one of
// the four; the art kit's own guards over its Baddie record -- no hurt, health or defeat field, and the three cozy
// exits alone -- are baddies.ts's _NoHurt and _Exits)
type Assert<T extends true> = T;
export type _NoHurt = Assert<Extract<keyof BaddieAt | keyof SceneFrame, 'hurt' | 'hp' | 'health' | 'defeated' | 'damage'> extends never ? true : false>;
export type _Faces = Assert<[BaddieFace] extends ['neutral' | 'grumpy' | 'surprised' | 'sleepy'] ? true : false>;

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

/**
 * The trip time (E) from which how each stop went shows in the scene -- its banner turning from the stop's name to how
 * it went: a challenge's at its counter's moment (MOMENT_AT of its beat), the baddie's once its counters' moments are
 * over (its exit begins). The TRIP LOG reads the stops by it (maptable.ts stopStates), so the log never tells what the
 * scene has not shown yet: the scene is the timer.
 */
export function stopShownAt(sim: CareSim, trip: Trip): number[] {
  const L = tripLen(sim, trip), P = baddieParts(L);
  return trip.stops.map((s) => Math.round(s.at * L) + (s.kind === 'baddie' ? P.enter + P.moments : Math.ceil(MOMENT_AT * beatLen(L))));
}

/**
 * How far along its road the team out is at the world's clock (or `clock`), 0..1 -- the Map Room map's flag on the road
 * (maptable.ts): 0 until it has left the Aerie and again once it lands, 1 at the road's end. By the scene's own walking
 * time (the share of the road's walking the scene has done, every stop's beat stood), so the flag stands still while the
 * team stands at a stop's beat and never goes back: the team walks the whole road, whatever the outcome, and the flag,
 * like the scene, never reads the outcome.
 */
export function roadFraction(sim: CareSim, trip: Trip, clock: number = sim.clock): number {
  if (trip.state !== 'away' || trip.departAt == null) return 0;
  const L = tripLen(sim, trip), E = Math.max(0, Math.min(L, clock - trip.departAt)), stops = trip.stops;
  const starts = stops.map((s) => Math.round(s.at * L)), lens = stops.map((s) => (s.kind === 'baddie' ? baddieBeatLen(L) : beatLen(L)));
  const nAt = (e: number) => { let n = e; for (let j = 0; j < stops.length; j++) if (starts[j] <= e) n -= Math.min(e - starts[j], lens[j]); return n; };
  const full = nAt(L);
  return full > 0 ? Math.max(0, Math.min(1, nAt(E) / full)) : 0;
}

/**
 * The scene at the world's clock (or at `clock`): pure -- the same trip and clock give the same frame, always. It never
 * reads the trip's outcome (success, egg): a team that will fail walks the same road, meets the same stops and watches
 * the same baddie leave as one that will succeed, frame for frame, until the result card (drawResultCard) tells which.
 */
export function sceneAt(sim: CareSim, trip: Trip, clock: number = sim.clock): SceneFrame {
  const team = teamOf(sim, trip), L = tripLen(sim, trip);
  const E = trip.departAt == null ? 0 : Math.max(0, Math.min(L, clock - trip.departAt));
  const stops = trip.stops;
  const starts = stops.map((s) => Math.round(s.at * L)), lens = stops.map((s) => (s.kind === 'baddie' ? baddieBeatLen(L) : beatLen(L)));
  const nAt = (e: number) => { let n = e; for (let j = 0; j < stops.length; j++) if (starts[j] <= e) n -= Math.min(e - starts[j], lens[j]); return n; };
  const n = nAt(E);
  let stop: number | null = null, last: number | null = null;
  for (let j = 0; j < stops.length; j++) if (starts[j] <= E) { last = j; if (E < starts[j] + lens[j]) stop = j; }
  const beatT = stop == null ? 0 : E - starts[stop];
  const X0 = (i: number) => -PAIR_BACK * i;
  const xAt = (i: number, nn: number) => X0(i) + walkDist(team.gaits[i], team.speeds[i] * nn);
  const xs = team.ds.map((_, i) => xAt(i, n));
  const mean = xs.length ? xs.reduce((a, v) => a + v, 0) / xs.length : 0;
  const camX = mean - CAM_BACK;
  const leadAt = (j: number) => (team.ds.length ? xAt(0, nAt(starts[j])) : 0);

  // the set pieces: every stop's (the team reaches them all), where it stands and how it looks
  const pieces: Piece[] = [];
  for (let j = 0; j < stops.length; j++) {
    if (stops[j].kind !== 'challenge') continue;
    const resolved = E >= starts[j] + RESOLVED_AT * lens[j];
    pieces.push({ stop: j, x: leadAt(j) + PIECE_AHEAD, state: !resolved ? 'ahead' : stops[j].covered ? 'met' : 'unmet' });
  }

  // the banner: the last stop's (its name alone until its counter's moment -- a baddie's until its exit begins, so its
  // exit is never told before it plays -- then how it went), up until the next stop
  let banner: string | null = null, bannerOk = false;
  if (last != null) {
    const s = stops[last], head = s.log.split(' - ')[0], bt = E - starts[last];
    const P = baddieParts(L), shown = s.kind === 'baddie' ? bt >= P.enter + P.moments : bt >= MOMENT_AT * lens[last];
    if (!shown) banner = s.kind === 'baddie' ? `${head}!` : head;
    else { banner = s.log; bannerOk = s.covered; }
  }

  // the baddie: in from the right, the two moments, its exit (met or waited out, it always leaves: the team walks on)
  let baddie: BaddieAt | null = null;
  const kb = stops.findIndex((s) => s.kind === 'baddie');
  if (kb >= 0 && E >= starts[kb]) {
    const P = baddieParts(L), bt = E - starts[kb], x0 = leadAt(kb) + BADDIE_AHEAD, id = stops[kb].baddie!;
    const walkIn = Math.round(0.7 * P.enter), from = x0 + 190;
    if (bt < P.enter) baddie = { id, x: bt < walkIn ? from + (x0 - from) * (bt / walkIn) : x0, face: 'grumpy', pose: bt < walkIn ? 'walk' : 'stand', facing: -1, fx: null, t: bt };
    else if (bt < P.enter + P.moments) baddie = { id, x: x0, face: 'surprised', pose: 'stand', facing: -1, fx: null, t: bt };
    else {
      // (its exit is the art kit's own, played through its part of the beat -- exitLook: the pose, face and facing, and
      // how far it has gone; calmed sits and dozes where it stood, outwitted turns and then walks off up the road, ahead
      // of the team, driven off shuffles off up it -- and one that leaves goes on at its exit's last pace once the beat
      // is over, until it is off the screen: never back through the team)
      const et = bt - P.enter - P.moments, exit = trip.exit!;
      const look = exitLook(exit, et / P.exit), end = exitLook(exit, 1), half = exitLook(exit, 0.5);
      const pace = (end.dx - half.dx) / (0.5 * P.exit), on = Math.max(0, et - P.exit) * pace;
      const fx = look.pose === 'leave' ? 'dust' : look.pose === 'sit' && look.face === 'sleepy' ? 'z' : null;
      baddie = { id, x: x0 + look.dx + on, face: look.face, pose: look.pose, facing: look.facing, fx, t: bt };
    }
    // (gone once it is well off the screen: walked off, or left behind)
    if (baddie && Math.abs(baddie.x - (camX + 320)) > 520) baddie = null;
  }

  // what each of the team does: walk between stops; at a beat stand, the counter playing its moment; home, stand
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
      let at = -1;
      if (by.includes(name)) {
        if (s.kind === 'baddie') { const P = baddieParts(L); at = starts[j] + P.enter + (who === 'd' ? 0 : Math.round(P.moments / 2)); }
        else at = starts[j] + Math.round(MOMENT_AT * lens[j]);
      }
      return at >= 0 && E >= at ? { key: `m${j}`, anim: moment, start: at, speed: 1, phase: 0 } : { key: `b${j}`, anim: 'idle', start: starts[j], speed: 1, phase: 0 };
    };
    if (E >= L) return { dragon: { key: 'end', anim: 'idle', start: L, speed: 1, phase: 0 }, rider: k ? { key: 'end', anim: 'idle', start: L, speed: 1, phase: 0 } : null };
    if (stop != null) return { dragon: beatAct('d', d.name, DRAGON_MOMENT[d.element]), rider: k ? beatAct('k', k.name, RIDER_MOMENT[k.look]) : null };
    return { dragon: walkAct('d'), rider: k ? walkAct('k') : null };
  });

  return { E, L, n, stop, beatT, last, xs, speeds: team.speeds, camX, banner, bannerOk, baddie, pieces, acts, done: E >= L };
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
    this.actors.forEach((a, i) => {
      const act = f.acts[i];
      if (!act) return;
      const x = f.xs[i];
      this.play(a.d, act.dragon, f, clock, x, ROAD_Y);
      if (a.k && act.rider) this.play(a.k, act.rider, f, clock, x + RIDER_AHEAD, ROAD_Y - 3);
    });
  }

  private play(a: Actor, act: Act, f: SceneFrame, clock: number, x: number, y: number): void {
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
    for (let t = 0; t < ticks; t++) this.tick(a, act, x, y);
    // (placed where the frame says even when nothing ticked; facing up the road, as the team always does)
    if (a.pet) { a.pet.x = x; a.pet.y = y; a.pet.facing = 1; }
    else if (a.agent) { a.agent.x = x; a.agent.y = y; a.agent.facing = 1; }
  }

  private tick(a: Actor, act: Act, x: number, y: number): void {
    a.age++;
    const moment = act.anim !== 'walk' && act.anim !== 'idle';
    if (a.pet) {
      const p = a.pet;
      if (moment && !a.momentDone && (p.player.done || a.age >= MOMENT_MAX)) { p.player.play('idle', { blend: 8 }); p.anim = 'idle'; a.momentDone = true; }
      p.x = x; p.y = y; p.facing = 1;
      stepPet(p);
    } else {
      const k = a.agent!;
      if (moment && !a.momentDone && (k.player.done || a.age >= MOMENT_MAX)) { k.player.play('idle', { blend: 8 }); a.momentDone = true; }
      k.x = x; k.y = y; k.facing = 1; k.pinX = true;
      stepKeeperAgent(k);
    }
  }

  /** The walk frame each dragon is playing now (sim-check 24: the view's paws keep to the road). */
  dragonFrames(): number[] { return this.actors.map((a) => a.d.pet!.player.frameIndex); }

  /** Draw the team (already synced): the riders a step behind their dragons, each with its saddle in the near hand (the art kit's SADDLE, as a rider carries it in the barn's muster), then the dragons, then the top pass. */
  draw(ctx: CanvasRenderingContext2D): void {
    const cast: { y: number; pet?: Pet; agent?: KeeperAgent }[] = [];
    for (const a of this.actors) {
      if (a.k?.agent) cast.push({ y: a.k.agent.y, agent: a.k.agent });
      if (a.d.pet) cast.push({ y: a.d.pet.y, pet: a.d.pet });
    }
    cast.sort((p, q) => p.y - q.y);
    this.budget.begin(cast.filter((c) => c.pet).length, this.frame++);
    let slot = 0;
    for (const c of cast) {
      if (c.pet) drawDragon(ctx, c.pet.rig, c.pet.player.pose, petOpts(c.pet, { still: true, top: this.top, budget: this.budget, slot: slot++ }));
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
 * pieces the road has reached (each behind the team: the fog bank too), the miller at his mill, the baddie, the team,
 * then the banner. Syncs `cast` to the frame first.
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
  if (bd) {
    // (its marks -- the calmed one's "z"s stepping up over its head, the driven-off one's dust at its heels and its
    // grumble cloud, the outwitted one's "!" as it turns -- are the art kit's, drawn by drawBaddie from the pose and
    // face: bd.fx says which the frame shows)
    drawBaddie(ctx, bd.id, bd.x, BACK_Y, bd.facing, bd.face, bd.pose, bd.t);
  }
  cast.draw(ctx);
  ctx.restore();
  if (f.banner) {
    // (on an ink strip, as the barn's hint and action line are: the weather's marks never show between its letters)
    const w = measureText(f.banner) + (f.bannerOk ? 10 : 0), x = Math.round(R.w / 2 - w / 2);
    ctx.fillStyle = INK; ctx.fillRect(x - 5, 17, w + 10, 17);
    drawTextOutlined(ctx, f.banner, x, 22, { size: 1, color: '#f3e6c8', outline: INK, thickness: 1, shadow: false });
    if (f.bannerOk) drawSprite(ctx, ICONS.check, x + w - 3, 25);
  }
}

/** What the trip brought home: its coin (half on a failure) and its egg (on a success). */
export function rewardsOf(trip: Trip): { coin: number; egg: DragonElement | null } {
  return { coin: trip.success ? trip.mission.coin : Math.floor(trip.mission.coin / 2), egg: trip.success ? trip.egg : null };
}

/** The result card's title: the trip's pass or fail, told here at the road's end and nowhere on the road before it. */
export function resultTitle(trip: Trip): string { return trip.success ? 'HOME SAFE!' : 'NOT THIS TIME'; }

/**
 * The result card (once the trip's time is up, until it is tapped away): HOME SAFE! or NOT THIS TIME, the rewards, that
 * nobody is hurt, and that a tap goes back to the barn.
 */
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
  drawText(ctx, 'TAP TO GO BACK TO THE BARN', cx, r.y + 98, { color: '#6b5a44', shadow: false, align: 'center' });
}

