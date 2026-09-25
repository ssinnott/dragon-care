// A dragon in a care scene (docs/KEEPERS.md 6): the rig, its player and where it stands, stepped once per 60 Hz tick,
// the way the gallery's pets are (src/gallery.ts makePet / stepPet) but owned by the game: a one-shot plays on into
// its `next` anim (idle, with the idle-variant schedule of bible 4.2), a walker moves by its frames' `move`, and the
// bowl a keeper set down stands in front of it (drawn after it: bible 4.2).
import { dragonBuild } from '../art/dragon/build.ts';
import { buildDragon, drawDragon, stepDragon, solveDragon, rootToScreen, cranToRootPt } from '../art/dragon/rig.ts';
import type { DragonRig, DrawDragonOpts } from '../art/dragon/rig.ts';
import { DragonAnimPlayer, blinkFor } from '../art/dragon/anim.ts';
import type { DragonPlayOpts } from '../art/dragon/anim.ts';
import { dragonAnims, ELEMENT_ANIM_FALLBACK, idleVariants, variantEvery, SPREAD_VARIANTS } from '../art/dragon/anims.ts';
import type { Stage } from '../art/dragon/stages.ts';
import type { DragonElement } from '../art/dragon/palettes.ts';
import { bowlFor, drawBowl } from '../art/props.ts';
import type { BowlSpot } from '../art/props.ts';
import type { TopPass, AmbientBudget } from '../art/dragon/fx.ts';
import { resetChain } from '../lib/art/secondary.ts';
import type { Obstacle } from './path.ts';

export interface DragonAgent {
  el: DragonElement;
  stage: Stage;
  /** The look's seed (its build: the same element, stage and seed is the same dragon, down to its proportions). */
  seed: number;
  rig: DragonRig;
  player: DragonAnimPlayer;
  /** Screen position of the ground point under the body centre, facing and draw scale. */
  x: number;
  y: number;
  facing: number;
  scale: number;
  /** The pet's resting mood (-1..1); its anims add their own on top. */
  mood: number;
  /** Where its bowl goes (props.ts bowlFor: under the snout at the chomp) and the bowl standing there, if any. */
  spot: BowlSpot;
  /**
   * The bowl a keeper set down, if any: full or eaten, and its screen x. A keeper sets it a little way out from a
   * begging dragon (acts.ts), which then walks up to it, so `x` stays where it was put while the dragon moves.
   */
  bowl: { full: boolean; x: number } | null;
  /** The desync of its loops (bible 4.1): the build's seeded phase and speed. */
  phase: number;
  speed: number;
  /** Frames into a paper turn (turnDragon), or -1. */
  turning: number;
  /**
   * The dragon may turn round and walk off before long (the scene's owner says: the yard's fed dragon, or one walking
   * home): a keeper's walk keeps off the eye of both its facings (eyeSweep) and its body both ways (obstacleOf).
   */
  restless: boolean;
  /**
   * The anims the dragon may play before long besides its current one (the scene's owner says: the yard, by what the
   * dragon is doing): a keeper's walk keeps off the eye through all of them (eyeSweep). A fed dragon's head drops into
   * its bowl; an idle one's variants tip and turn it.
   */
  soon: readonly string[];
}

/**
 * A paper turn (bible 4.1's turn in place: in profile a turn is a mirror flip): TURN_HALF stepped frames narrowed to
 * TURN_W, the flip, TURN_HALF more the other way. Only the 80 % frames of fire's flame chase: the face marks are never
 * squashed (rig.ts faceTransform), and at 60 % a nostril ahead of the eye landed off the narrowed snout.
 */
export const TURN_HALF = 3, TURN_W = 0.8;

/** Make a dragon at (x, y) playing `anim` (idle gets its variant schedule, as in the habitat). */
export function makeDragon(el: DragonElement, stage: Stage, seed: number, anim: string, x: number, y: number, o: { facing?: number; mood?: number; scale?: number } = {}): DragonAgent {
  const build = dragonBuild({ element: el, stage, seed });
  const rig = buildDragon(build), anims = dragonAnims(stage, build.spec, build.dims);
  const player = new DragonAnimPlayer(anims, seed, blinkFor(stage));
  const [a, b] = variantEvery(stage);
  player.setVariants('idle', idleVariants(stage, build.sp.wing), a, b, SPREAD_VARIANTS);
  const d: DragonAgent = {
    el, stage, seed, rig, player, x, y, facing: o.facing ?? 1, scale: o.scale ?? 1, mood: o.mood ?? 0,
    spot: bowlFor(rig, anims.eat ? anims.eat.frames : []), bowl: null, phase: build.phase, speed: build.speed, turning: -1, restless: false, soon: [],
  };
  playDragon(d, anim);
  stepDragon(rig, player.pose, drawOpts(d));
  return d;
}

/**
 * Play an anim on a dragon: loops start at the pet's seeded phase and speed (so two dragons never breathe in
 * lockstep), an element anim a look has not got plays its fallback (dusk's tuck-in is every other look's sleep).
 */
export function playDragon(d: DragonAgent, anim: string, o: DragonPlayOpts = {}): void {
  const loop = d.player.anims[anim]?.loop ?? false;
  d.player.play(anim, { restart: true, phase: loop ? d.phase : 0, speed: loop ? d.speed : 1, fallback: ELEMENT_ANIM_FALLBACK[anim] ?? 'idle', ...o });
}

function drawOpts(d: DragonAgent, extra: Partial<DrawDragonOpts> = {}): DrawDragonOpts {
  return { x: d.x, y: d.y, facing: d.facing, scale: d.scale, mood: d.mood, ...extra };
}

/**
 * Hold a dragon to its plain idle while a keeper works with it, or give it back its idle variants (the look-around,
 * the yawn, the scratch, its element's fidget: bible 4.2). A variant turns or tips the head, and the care acts plan
 * where a keeper stands from the dragon's idle and pet poses (acts.ts planSide): a look-around put its eye under a
 * keeper's arm. A variant already playing is cut back to idle.
 */
export function quiet(d: DragonAgent, on: boolean): void {
  if (on) {
    const cut = d.player.inVariant;
    d.player.setVariants('idle', []);
    if (cut) playDragon(d, 'idle', { blend: 10 });
    return;
  }
  const [a, b] = variantEvery(d.stage);
  d.player.setVariants('idle', idleVariants(d.stage, d.rig.sp.wing), a, b, SPREAD_VARIANTS);
}

/** Start a paper turn (the dragon faces the other way TURN_HALF frames from now). */
export function turnDragon(d: DragonAgent): void { d.turning = 0; }

/** Advance one 60 Hz step: a finished one-shot plays on into its `next` (idle), a walk carries the dragon. */
export function stepDragonAgent(d: DragonAgent, roam: boolean): void {
  const p = d.player;
  // (an idle variant returns to idle on its own, reseeding its schedule: DragonAnimPlayer.tick)
  if (p.done && p.def && !p.def.loop && !p.inVariant) playDragon(d, p.def.next ?? 'idle', { blend: 10 });
  p.tick();
  if (d.turning >= 0) {
    // narrowed, stepped: a stretch set off 1 keeps the rig's volume-preserving 1 / |squash| from growing it taller
    if (d.turning === TURN_HALF) { d.facing = -d.facing; resetChain(d.rig.tailChain); }
    p.pose.squash = TURN_W; p.pose.stretch = 1.01;
    if (++d.turning >= 2 * TURN_HALF) d.turning = -1;
  }
  if (roam && p.move) d.x += d.facing * p.move * d.scale;
  stepDragon(d.rig, p.pose, drawOpts(d));
}

/** Draw a dragon (already stepped this tick), then its bowl in front of it. */
export function drawDragonAgent(ctx: CanvasRenderingContext2D, d: DragonAgent, o: { top?: TopPass | null; budget?: AmbientBudget; slot?: number; silhouette?: boolean | string; shadow?: boolean } = {}): void {
  drawDragon(ctx, d.rig, d.player.pose, drawOpts(d, { still: true, ...o }));
  if (d.bowl && !o.silhouette) drawBowlOf(ctx, d);
}

/** A dragon's bowl where it was set down (full, or eaten). */
export function drawBowlOf(ctx: CanvasRenderingContext2D, d: DragonAgent): void {
  if (!d.bowl) return;
  const sc = d.scale * d.rig.scale, s = d.spot;
  drawBowl(ctx, Math.round(d.bowl.x), Math.round(d.y), s.w, s.h, sc, d.bowl.full);
}

/** The screen x of a dragon's bowl centre. */
export function bowlScreenX(d: DragonAgent): number { return Math.round(d.x + d.facing * d.spot.x * d.scale * d.rig.scale); }

const PT = { x: 0, y: 0 }, PT2 = { x: 0, y: 0 };
/**
 * A point on the dragon's cranium circle on screen, after its last step: `ang` degrees in cranium space (0 = toward
 * the snout, -90 = the crown), `out` px outside the circle's edge (a hand's centre rests a hand's radius out). The
 * head's pitch, a head that looks back (headFlip) and the facing are all in cranToRootPt / rootToScreen.
 */
export function craniumPoint(d: DragonAgent, ang: number, outside: number, out: { x: number; y: number }): { x: number; y: number } {
  const r = d.rig.dims.head.cranR + outside, a = (ang * Math.PI) / 180;
  cranToRootPt(d.rig, Math.cos(a) * r, Math.sin(a) * r, PT);
  return rootToScreen(d.rig, PT.x, PT.y, out);
}

/**
 * Where a point of the dragon would be on screen if it stood in a given pose (frame `frame` of `anim`): the joints are
 * solved for that pose, `fn` reads the point (craniumPoint, neckTop), and the joints are solved back for the pose on
 * screen, so the dragon is left as it was. The care acts use it to find where a head WILL be (a crown under a stroking
 * hand once the pet anim leans it, a head laid on the floor once a sleep has lain the dragon down) before the keeper
 * walks over.
 */
export function pointIn<T>(d: DragonAgent, anim: string, frame: number, fn: () => T): T {
  const a = d.player.anims[anim] ?? d.player.anims[ELEMENT_ANIM_FALLBACK[anim] ?? 'idle'];
  const fr = a?.frames[Math.min(Math.max(0, frame), (a?.frames.length ?? 1) - 1)];
  solveDragon(d.rig, fr?.pose ?? {}, drawOpts(d));
  const out = fn();
  solveDragon(d.rig, d.player.pose, drawOpts(d));
  return out;
}

/**
 * A point over the top of the neck on screen after the last step: `u` runs from the head's end of the neck (0) to its
 * root in the chest (1), `outside` px out from the neck's top contour (the underside normals of rig.j, turned over).
 */
export function neckTop(d: DragonAgent, u: number, outside: number, out: { x: number; y: number }): { x: number; y: number } {
  const J = d.rig.j, n = J.neckN, f = (1 - Math.min(1, Math.max(0, u))) * n, i = Math.min(n - 1, Math.floor(f)), t = f - i;
  const lerp = (a: Float32Array) => a[i] + (a[i + 1] - a[i]) * t;
  const r = lerp(J.neckR) + outside, vx = lerp(J.neckVX), vy = lerp(J.neckVY), vl = Math.hypot(vx, vy) || 1;
  return rootToScreen(d.rig, lerp(J.neckX) - (vx / vl) * r, lerp(J.neckY) - (vy / vl) * r, out);
}

/**
 * A point over the dragon's back on screen after the last step: `u` runs from the withers (0: the top of the chest
 * ball) to the top of the hips (1: the top of the hip ball) along the line between them, and on over the rump (1 .. 2:
 * round the hip ball from its top to 60 deg behind it), `outside` px out (the body is two balls: stages.ts hipR /
 * chestR; a ball's top is its top whatever the body's pitch). A baby's short back hides under its head: its rump is
 * where a hand goes.
 */
export function backTop(d: DragonAgent, u: number, outside: number, out: { x: number; y: number }): { x: number; y: number } {
  const J = d.rig.j, dm = d.rig.dims, t = Math.min(2, Math.max(0, u));
  if (t > 1) {
    // (root space: + x toward the head, so "behind" is - x)
    const a = ((-90 - 60 * (t - 1)) * Math.PI) / 180, r = dm.hipR + outside;
    return rootToScreen(d.rig, J.hip.x + Math.cos(a) * r, J.hip.y + Math.sin(a) * r, out);
  }
  const x = J.chest.x + (J.hip.x - J.chest.x) * t, y = J.chest.y - dm.chestR + (J.hip.y - dm.hipR - J.chest.y + dm.chestR) * t;
  return rootToScreen(d.rig, x, y - outside, out);
}

/**
 * The floor a dragon takes up, on screen: from the middle of its tail to its snout along the floor (whichever way it
 * faces; from the build's dims at rest) and a band round its floor line. A keeper whose walk would cross it goes round
 * behind (acts.ts).
 */
export function bodySpan(d: DragonAgent): { x0: number; x1: number; y0: number; y1: number } {
  const m = d.rig.dims, s = d.scale * d.rig.scale;
  const back = (m.hipR + m.gap / 2 + (m.tail.n * m.tail.len) / 2) * s, front = (m.gap / 2 + m.chestR + m.headLen) * s;
  const [x0, x1] = d.facing < 0 ? [d.x - front, d.x + back] : [d.x - back, d.x + front];
  return { x0, x1, y0: d.y - 12 * s, y1: d.y + 8 * s };
}

/** Where the eye goes over a whole anim, per look, anim, facing and scale: its boxes' union, from (round x, round y). */
const SWEEPS = new Map<string, { x0: number; y0: number; x1: number; y1: number }>();
/**
 * The box a dragon's eye sweeps through over its current anim, on screen (the union of its eye box at every 4th frame,
 * and as it is now): what a keeper's walk keeps off (path.ts). A snapshot is not enough: dusk's beg (its search by
 * lamplight) swings its head 15 px down and back up, and a walk planned round the head as it was crossed it as it came.
 * The anims the owner says it may play soon (DragonAgent.soon) are swept too; a dragon turning, walking or restless
 * gets both facings' sweeps, and a walking one its walk's reach over the next plan.
 */
export function eyeSweep(d: DragonAgent, ahead: number): { x0: number; y0: number; x1: number; y1: number } {
  const name = d.player.name ?? 'idle', rx = Math.round(d.x), ry = Math.round(d.y);
  const one = (facing: number, name: string) => {
    const key = `${d.el}:${d.stage}:${d.seed}:${name}:${facing}:${d.scale}`;
    let u = SWEEPS.get(key);
    if (!u) {
      const f0 = d.facing, frames = d.player.anims[name]?.frames ?? [];
      d.facing = facing;
      u = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
      for (let i = 0; i < Math.max(1, frames.length); i += 4) {
        const e = pointIn(d, name, i, () => eyeBox(d));
        u.x0 = Math.min(u.x0, e.x0 - rx); u.y0 = Math.min(u.y0, e.y0 - ry); u.x1 = Math.max(u.x1, e.x1 - rx); u.y1 = Math.max(u.y1, e.y1 - ry);
      }
      d.facing = f0;
      solveDragon(d.rig, d.player.pose, drawOpts(d));
      SWEEPS.set(key, u);
    }
    return u;
  };
  const moving = d.turning >= 0 || name === 'walk' || d.restless, u = { ...one(d.facing, name) };
  const add = (v: { x0: number; y0: number; x1: number; y1: number }) => { u.x0 = Math.min(u.x0, v.x0); u.y0 = Math.min(u.y0, v.y0); u.x1 = Math.max(u.x1, v.x1); u.y1 = Math.max(u.y1, v.y1); };
  for (const a of d.soon) if (d.player.has(a)) add(one(d.facing, a));
  if (moving) { add(one(-d.facing, name)); for (const a of d.soon) if (d.player.has(a)) add(one(-d.facing, a)); }
  const e = eyeBox(d);
  const box = { x0: Math.min(u.x0 + rx, e.x0), y0: Math.min(u.y0 + ry, e.y0), x1: Math.max(u.x1 + rx, e.x1), y1: Math.max(u.y1 + ry, e.y1) };
  if (name === 'walk') { const m = Math.abs(d.player.move) * d.scale * ahead; if (d.facing > 0) box.x1 += m; else box.x0 -= m; }
  return box;
}

/**
 * A dragon as a keeper's walk sees it (path.ts): its floor line, its length along the floor, and the box its eye sweeps
 * over its current anim (eyeSweep, `ahead` frames of a walk on), grown `pad`.
 */
export function obstacleOf(d: DragonAgent, pad: number, ahead = 0): Obstacle {
  const b = bodySpan(d), e = eyeSweep(d, ahead);
  // (a restless dragon's body both ways: it turns in place)
  const x0 = d.restless ? Math.min(b.x0, 2 * d.x - b.x1) : b.x0, x1 = d.restless ? Math.max(b.x1, 2 * d.x - b.x0) : b.x1;
  // the top of its back, as it stands (its withers or its rump, whichever is higher)
  const top = Math.min(backTop(d, 0, 0, PT2).y, backTop(d, 1, 0, PT2).y);
  return { y: d.y, top, x0, x1, eye: { x0: e.x0 - pad, y0: e.y0 - pad, x1: e.x1 + pad, y1: e.y1 + pad } };
}

/** How far each look's drawing reaches behind its body centre, px at scale 1 (tailReach), measured once per look. */
const TAIL_REACH = new Map<string, number>();
let reachCanvas: HTMLCanvasElement | null = null;
/**
 * How far behind its body centre a dragon's drawing reaches along the floor, on screen px: measured from the look
 * drawn at rest (its idle's first frame, facing right, off screen: the leftmost covered pixel), since a tail's shape
 * (water's fluke, fire's flame, dusk's smoke tip) runs on past the tail chain the dims describe.
 */
export function tailReach(d: DragonAgent): number {
  const key = `${d.el}:${d.stage}:${d.seed}`;
  let r = TAIL_REACH.get(key);
  if (r == null) {
    if (!reachCanvas) { reachCanvas = document.createElement('canvas'); reachCanvas.width = 320; reachCanvas.height = 160; }
    const g = reachCanvas.getContext('2d', { willReadFrequently: true })!, X = 220, Y = 130;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 320, 160);
    const a = d.player.anims.idle, pose = a?.frames[0]?.pose ?? {};
    // (solved and drawn `still`, so the dragon's tail chain and clocks are not stepped; then the rig put back)
    const o = { x: X, y: Y, facing: 1, scale: 1, mood: 0, still: true, shadow: false };
    solveDragon(d.rig, pose, o);
    drawDragon(g, d.rig, pose, o);
    solveDragon(d.rig, d.player.pose, drawOpts(d));
    const px = g.getImageData(0, 0, 320, 160).data;
    let x0 = X;
    for (let y = 0; y < 160; y++) for (let x = 0; x < X; x++) if (px[(y * 320 + x) * 4 + 3] >= 128 && x < x0) x0 = x;
    r = X - x0;
    TAIL_REACH.set(key, r);
  }
  return r * d.scale;
}

/** The snout's tip on screen after the last step (cranium space: the snout taper's end), for keeping clear of it. */
export function snoutTip(d: DragonAgent, out: { x: number; y: number }): { x: number; y: number } {
  const s = d.rig.dims.head.snout;
  cranToRootPt(d.rig, s.x1 + s.r1, s.y1, PT);
  return rootToScreen(d.rig, PT.x, PT.y, out);
}

/**
 * The dragon's eye box on screen after its last step: the eye's largest box (rig.info.eye: the eye in any state and a
 * 1 px ring), placed as the rig places it, in face space (rig.ts faceTransform: centred on the eye joint's rounded
 * screen pixel, device-aligned whatever the head's pitch, mirrored with the sprite and a head that looks back). The
 * rig clips its own head features off this box grown 1 px (bible 1.4 step 12.6); a keeper keeps off it (K7).
 */
export function eyeBox(d: DragonAgent): { x0: number; y0: number; x1: number; y1: number } {
  const J = d.rig.j, b = d.rig.info.eye, sc = d.scale * d.rig.scale, t = d.rig.tf;
  rootToScreen(d.rig, J.eye.x, J.eye.y, PT);
  const ex = Math.round(PT.x), ey = Math.round(PT.y), hx = Math.floor(b.w / 2), hy = Math.floor(b.h / 2);
  const fx = Math.sign(t.fs) * J.headFlip < 0, fy = t.ss < 0;
  const x0 = fx ? ex + (hx - b.w) * sc : ex - hx * sc, y0 = fy ? ey + (hy - b.h) * sc : ey - hy * sc;
  return { x0: Math.floor(x0), y0: Math.floor(y0), x1: Math.ceil(x0 + b.w * sc), y1: Math.ceil(y0 + b.h * sc) };
}
