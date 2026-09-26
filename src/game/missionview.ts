// The watchable scene (docs/BASE_DESIGN.md 6; plan S9): a team out on a mission, walking the road of its region, meeting
// each challenge where it comes (the counter's moment, a banner), a hard mission's big baddie at the end of the road
// (walks in grumpy, is met by its two counters, and leaves calmed, outwitted or driven off -- nobody hurt, ever: D4),
// and the result card once the trip's time is up. "The scene is the timer" (B5): nothing here is stepped or saved;
// every quantity is a pure function of the Trip and the world's clock (`sceneAt`), so a frozen view (t=) and a view
// opened half way along show the same road. The simulation never reads any of it.
//
// The pace (G13, as the barn's): each team dragon walks by its own walk anim's root motion (gait.ts), all at the
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
import { readClock, hourSteps } from './clock.ts';
import { skyPhase } from './sky.ts';
import { FLOORS, INK, ROAD_SCENE } from './surfaces.ts';
import { drawClimate, drawSetPiece, drawBaddie, drawMiller } from './artseams.ts';
import { climateOf } from './tripdemo.ts';
import { drawSprite, ICONS } from './icons.ts';
import type { Sprite } from './icons.ts';
import { drawEgg } from './eggs.ts';
import { makePet, petOpts, stepPet } from './pet.ts';
import type { Pet } from './pet.ts';
import { makeKeeperAgent } from './people.ts';
import { stepKeeperAgent, drawKeeperAgent } from '../care/keeper.ts';
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
/** The overlay's way back to the barn, and the result card. */
export const BACK_BUTTON: Readonly<Rect> = Object.freeze({ x: 8, y: 338, w: 110, h: 16 });
export const RESULT_CARD: Readonly<Rect> = Object.freeze({ x: 170, y: 110, w: 300, h: 120 });
/** The TEAM OUT chip under the top bar (plan 3.11), which opens the scene. */
export const TEAM_CHIP: Readonly<Rect> = Object.freeze({ x: 520, y: 19, w: 114, h: 15 });

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
/** How fast a baddie leaves: the Roc wanders off, the Giant shuffles off (px a step). */
const WANDER = 0.6, SHUFFLE = 0.45;

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
/** The baddie on the road: where, which way it faces, its face and pose, its marks (the calmed one's "z"s, the driven-off one's dust), and its beat's time. */
export interface BaddieAt { id: BaddieId; x: number; face: BaddieFace; pose: BaddiePose; facing: 1 | -1; fx: 'z' | 'dust' | null; t: number }

/**
 * The scene at one clock value (plan S9's `SceneFrame`, plus what the view needs to draw it). E is the time since the
 * team left (0..L), n the travel time in it; `stop` the stop whose beat is playing (else null), `beatT` how far into it;
 * `last` the last stop reached (its banner stays up until the next); xs each pair's dragon's road x, `speeds` each
 * one's walk speed; `camX` the road x at the screen's left edge.
 */
export interface SceneFrame {
  E: number; L: number; n: number;
  stop: number | null; beatT: number; last: number | null;
  facing: 1 | -1;
  xs: number[]; speeds: number[];
  camX: number;
  banner: string | null; bannerOk: boolean;
  baddie: BaddieAt | null;
  pieces: Piece[];
  acts: { dragon: Act; rider: Act | null }[];
  done: boolean;
}

// (the type guards of plan S9 and D4: a baddie on the road has no hurt, health or defeat, and a baddie leaves the road
// only calmed, outwitted or driven off)
type Assert<T extends true> = T;
export type _NoHurt = Assert<Extract<keyof BaddieAt | keyof SceneFrame, 'hurt' | 'hp' | 'health' | 'defeated' | 'damage'> extends never ? true : false>;
export type _Exits = Assert<[BaddieExit] extends ['calmed' | 'outwitted' | 'drivenOff'] ? (['calmed' | 'outwitted' | 'drivenOff'] extends [BaddieExit] ? true : false) : false>;
export type _Faces = Assert<[BaddieFace] extends ['neutral' | 'grumpy' | 'surprised' | 'sleepy'] ? true : false>;

/** Each element's moment when it meets a challenge (plan S9's table): the breath, rock's happy heave, slinkwing's call. */
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
 * The scene at the world's clock (or at `clock`): pure -- the same trip and clock give the same frame, always.
 */
export function sceneAt(sim: CareSim, trip: Trip, clock: number = sim.clock): SceneFrame {
  const team = teamOf(sim, trip), L = tripLen(sim, trip);
  const E = trip.departAt == null ? 0 : Math.max(0, Math.min(L, clock - trip.departAt));
  const stops = trip.stops, lastStop = trip.success ? stops.length - 1 : Math.min(stops.length - 1, trip.turnBack ?? stops.length - 1);
  const starts = stops.map((s) => Math.round(s.at * L)), lens = stops.map((s) => (s.kind === 'baddie' ? baddieBeatLen(L) : beatLen(L)));
  const nAt = (e: number) => { let n = e; for (let j = 0; j <= lastStop; j++) if (starts[j] <= e) n -= Math.min(e - starts[j], lens[j]); return n; };
  const n = nAt(E);
  let stop: number | null = null, last: number | null = null;
  for (let j = 0; j <= lastStop; j++) if (starts[j] <= E) { last = j; if (E < starts[j] + lens[j]) stop = j; }
  const beatT = stop == null ? 0 : E - starts[stop];
  const b = trip.success ? null : lastStop, nb = b == null ? 0 : nAt(starts[b]);
  const turned = b != null && E >= starts[b] + lens[b];
  const facing: 1 | -1 = turned ? -1 : 1;
  const X0 = (i: number) => -PAIR_BACK * i;
  const xAt = (i: number, nn: number) => X0(i) + walkDist(team.gaits[i], team.speeds[i] * nn);
  const xs = team.ds.map((_, i) => (turned ? xAt(i, nb) - walkDist(team.gaits[i], team.speeds[i] * (n - nb)) : xAt(i, n)));
  const mean = xs.length ? xs.reduce((a, v) => a + v, 0) / xs.length : 0;
  const camX = mean - CAM_BACK;
  const leadAt = (j: number) => (team.ds.length ? xAt(0, nAt(starts[j])) : 0);

  // the set pieces: every stop the road reaches (on a failure, none past the turn-back), where it stands and how it looks
  const pieces: Piece[] = [];
  for (let j = 0; j <= lastStop; j++) {
    if (stops[j].kind !== 'challenge') continue;
    const resolved = E >= starts[j] + RESOLVED_AT * lens[j];
    pieces.push({ stop: j, x: leadAt(j) + PIECE_AHEAD, state: !resolved ? 'ahead' : stops[j].covered ? 'met' : 'unmet' });
  }

  // the banner: the last stop's (its name alone until its counter's moment, then how it went), up until the next stop
  let banner: string | null = null, bannerOk = false;
  if (last != null) {
    const s = stops[last], head = s.log.split(' - ')[0], bt = E - starts[last];
    const shown = s.kind === 'baddie' ? bt >= baddieParts(L).enter : bt >= MOMENT_AT * lens[last];
    if (!shown) banner = s.kind === 'baddie' ? `${head}!` : head;
    else if (b === last) banner = s.kind === 'baddie' ? `${head} KEEPS THE ROAD. HOME FOR TEA. NOBODY IS HURT.` : `${head} - ${s.covered ? '' : 'NOBODY COULD HELP: '}THEY TURN BACK FOR HOME`;
    else { banner = s.log; bannerOk = s.covered; }
  }

  // the baddie: in from the right, the two moments, its exit (or it keeps the road)
  let baddie: BaddieAt | null = null;
  const kb = stops.findIndex((s) => s.kind === 'baddie');
  if (kb >= 0 && kb <= lastStop && E >= starts[kb]) {
    const P = baddieParts(L), bt = E - starts[kb], x0 = leadAt(kb) + BADDIE_AHEAD, id = stops[kb].baddie!;
    const walkIn = Math.round(0.7 * P.enter), from = x0 + 190;
    if (bt < P.enter) baddie = { id, x: bt < walkIn ? from + (x0 - from) * (bt / walkIn) : x0, face: 'grumpy', pose: bt < walkIn ? 'walk' : 'stand', facing: -1, fx: null, t: bt };
    else if (bt < P.enter + P.moments) baddie = { id, x: x0, face: 'surprised', pose: 'stand', facing: -1, fx: null, t: bt };
    else {
      const et = bt - P.enter - P.moments, turn = Math.round(0.2 * P.exit);
      if (!trip.success || !trip.exit) baddie = { id, x: x0, face: 'grumpy', pose: 'stand', facing: -1, fx: null, t: bt };
      else if (trip.exit === 'calmed') baddie = { id, x: x0, face: et < turn ? 'surprised' : 'sleepy', pose: 'sit', facing: -1, fx: et < turn ? null : 'z', t: bt };
      else if (trip.exit === 'outwitted') baddie = et < turn ? { id, x: x0, face: 'surprised', pose: 'turn', facing: -1, fx: null, t: bt }
        : { id, x: x0 - WANDER * (et - turn), face: 'neutral', pose: 'leave', facing: -1, fx: null, t: bt };
      else baddie = et < turn ? { id, x: x0, face: 'grumpy', pose: 'turn', facing: 1, fx: null, t: bt }
        : { id, x: x0 + SHUFFLE * (et - turn), face: 'grumpy', pose: 'leave', facing: 1, fx: 'dust', t: bt };
    }
    // (gone once it is well off the screen: walked off, or left behind)
    if (baddie && Math.abs(baddie.x - (camX + 320)) > 520) baddie = null;
  }

  // what each of the team does: walk between stops; at a beat stand, the counter playing its moment; home, stand
  const acts = team.ds.map((d, i) => {
    const k = team.ks[i];
    const walkAct = (who: 'd' | 'k'): Act => {
      const seg = last == null ? -1 : last, tau = team.speeds[i] * (turned ? n - nb : n);
      const g = team.gaits[i];
      const segStart = turned ? starts[b!] + lens[b!] : seg < 0 ? 0 : starts[seg] + lens[seg];
      return who === 'd'
        ? { key: `w${seg}${turned ? 't' : ''}`, anim: 'walk', start: segStart, speed: team.speeds[i], phase: loopPhase(g, tau) }
        : { key: `w${seg}${turned ? 't' : ''}`, anim: 'walk', start: segStart, speed: team.V / KEEPERS[k!.look].speed, phase: 0 };
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

  return { E, L, n, stop, beatT, last, facing, xs, speeds: team.speeds, camX, banner, bannerOk, baddie, pieces, acts, done: E >= L };
}

// ---------- the view: the team's pets and riders, and drawing ----------

/** One of the team on screen: its pet or rider character, the act it is playing, and the clock it was last stepped at. */
interface Actor { pet: Pet | null; agent: KeeperAgent | null; key: string | null; clock: number; momentDone: boolean; age: number }

/**
 * The team's characters for one trip (base.ts builds them when the scene opens, and again for another trip): each pair's
 * dragon on the real rig and its rider on the paper doll, played to the scene's acts. `sync` catches them up to the
 * frame: an act they were not playing starts fresh -- a walk at its speed and the phase the road says (exact), anything
 * else replayed from its start (a beat's worth at most: a frozen view shows the same moment a live one did) -- and one
 * they were playing steps on by the clock's advance.
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
      if (a.k && act.rider) this.play(a.k, act.rider, f, clock, x + RIDER_AHEAD * f.facing, ROAD_Y - 3);
    });
  }

  private play(a: Actor, act: Act, f: SceneFrame, clock: number, x: number, y: number): void {
    let ticks: number;
    if (a.key !== act.key) {
      a.key = act.key; a.momentDone = false; a.age = 0;
      if (a.pet) {
        const p = a.pet;
        p.player.play(act.anim, { restart: true, speed: act.speed, phase: act.anim === 'walk' ? act.phase : 0, blend: act.anim === 'walk' ? 0 : 6, fallback: ELEMENT_ANIM_FALLBACK[act.anim] });
        p.anim = act.anim; p.hold = 0;
      } else a.agent!.player.play(act.anim, { restart: true, speed: act.speed, blend: 6 });
      // (a walk starts where the road says: no replay for a dragon's; a rider's, and anything else, from its start)
      ticks = a.pet && act.anim === 'walk' ? 0 : Math.max(0, Math.min(act.anim === 'walk' ? 120 : 960, Math.round(f.E - act.start)));
    } else ticks = Math.max(0, Math.min(16, clock - a.clock));
    a.clock = clock;
    for (let t = 0; t < ticks; t++) this.tick(a, act, x, y, f.facing);
    // (placed where the frame says even when nothing ticked)
    if (a.pet) { a.pet.x = x; a.pet.y = y; a.pet.facing = f.facing; }
    else if (a.agent) { a.agent.x = x; a.agent.y = y; a.agent.facing = f.facing; }
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

  /** Draw the team (already synced): the riders a step behind their dragons, then the dragons, then the top pass. */
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
      else if (c.agent) drawKeeperAgent(ctx, c.agent);
    }
    this.top.flush(ctx);
  }
}

/** A "z" over the dozing baddie, and a puff of the driven-off one's dust (2 px and up: floor dust fades by shrinking). */
const ZED: Sprite = { rows: ['zzz', '.z.', 'zzz'], colors: { z: '#f3e6c8' } };
const DUST = '#e8e0cc';
/** How tall each baddie stands (its "z"s start over its head). */
const BADDIE_H: Readonly<Record<BaddieId, number>> = Object.freeze({ moleking: 88, stormroc: 100, frostgiant: 140 });

/**
 * The road (screen space, from the road's band down): the road's pale band (FLOORS.road, a seam along its top), its
 * slab, a strip of grass BELOW it in the green climates (never underfoot, D3's rule), then the earth.
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
 * The scene (plan S9), inside SCENE_RECT: the region's climate (parallax: artseams.ts drawClimate), the road, the set
 * pieces the road has reached (each behind the team: the fog bank too), the miller at his mill, the baddie, the team,
 * then the banner. Syncs `cast` to the frame first.
 */
export function drawMissionScene(ctx: CanvasRenderingContext2D, sim: CareSim, trip: Trip, cast: ScenePets, f: SceneFrame = sceneAt(sim, trip)): void {
  const R = SCENE_RECT, cam = Math.round(f.camX), climate = climateOf(trip.mission.region);
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
    drawBaddie(ctx, bd.id, bd.x, BACK_Y, bd.facing, bd.face, bd.pose, bd.t);
    if (bd.fx === 'z') {
      // three "z"s stepping up over its head, one more every half second, then again
      const n = 1 + (Math.floor(bd.t / 30) % 3), top = BACK_Y - BADDIE_H[bd.id];
      for (let k = 0; k < n; k++) drawSprite(ctx, ZED, bd.x + 20 + 6 * k, top - 4 - 9 * k);
    } else if (bd.fx === 'dust') {
      // puffs kicked up behind its feet, each shrinking as it goes
      for (let k = 0; k < 3; k++) {
        const age = (bd.t + k * 10) % 30, s = 4 - Math.floor(age / 10), px = Math.round(bd.x - bd.facing * (30 + age)), py = BACK_Y - 2 - Math.floor(age / 6);
        ctx.fillStyle = INK; ctx.fillRect(px - 1, py - 1, s + 2, s + 2);
        ctx.fillStyle = DUST; ctx.fillRect(px, py, s, s);
      }
    }
  }
  cast.draw(ctx);
  ctx.restore();
  if (f.banner) {
    const w = measureText(f.banner) + (f.bannerOk ? 10 : 0), x = Math.round(R.w / 2 - w / 2);
    drawTextOutlined(ctx, f.banner, x, 22, { size: 1, color: '#f3e6c8', outline: INK, thickness: 1, shadow: false });
    if (f.bannerOk) drawSprite(ctx, ICONS.check, x + w - 3, 25);
  }
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

/** The result card (once the trip's time is up, until the team lands): HOME SAFE! or HOME EARLY, the rewards, and that nobody is hurt. */
export function drawResultCard(ctx: CanvasRenderingContext2D, trip: Trip, tick: number): void {
  const r = RESULT_CARD, { coin, egg } = rewardsOf(trip);
  ctx.fillStyle = INK; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = '#8a6a4a'; ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  ctx.fillStyle = '#e8d8a8'; ctx.fillRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6);
  const cx = r.x + r.w / 2;
  drawTextOutlined(ctx, trip.success ? 'HOME SAFE!' : 'HOME EARLY', cx, r.y + 14, { size: 2, color: '#f3e6c8', outline: INK, thickness: 1, align: 'center', shadow: false });
  const line = egg ? `+${coin} COIN   AND AN EGG` : `+${coin} COIN`;
  drawText(ctx, line, cx - (egg ? 8 : 0), r.y + 50, { color: INK, shadow: false, align: 'center' });
  if (egg) drawEgg(ctx, egg, cx + measureText(line) / 2 + 4, r.y + 58, 0, tick);
  drawText(ctx, 'NOBODY IS HURT.', cx, r.y + 72, { color: INK, shadow: false, align: 'center' });
  drawText(ctx, 'TAP TO CLOSE', cx, r.y + 98, { color: '#6b5a44', shadow: false, align: 'center' });
}

/** The TEAM OUT chip (a trip is out; a tap watches it): MUSTER, TEAM OUT - 14H (game hours to go), or LANDING. */
export function teamChipText(sim: CareSim, trip: Trip): string {
  if (trip.state === 'muster' || trip.state === 'depart' || trip.departAt == null) return 'MUSTER';
  if (trip.state === 'return' || trip.state === 'home' || trip.returnAt == null) return 'LANDING';
  const left = Math.max(0, Math.ceil((trip.returnAt - sim.clock) / hourSteps(sim.dayLen)));
  return left > 0 ? `TEAM OUT - ${left}H` : 'LANDING';
}
export function drawTeamChip(ctx: CanvasRenderingContext2D, sim: CareSim, trip: Trip): void {
  const r = TEAM_CHIP;
  ctx.fillStyle = INK; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = '#6b4a34'; ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  drawText(ctx, teamChipText(sim, trip), r.x + r.w / 2, r.y + 4, { color: '#f3e6c8', shadow: false, align: 'center' });
}
