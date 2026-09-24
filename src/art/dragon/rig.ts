// The dragon rig: one parameterised quadruped that draws all 18 looks (docs/ART_BIBLE.md sections 1-2).
//
// LOCAL SPACE: authored facing right, origin on the ground under the body centre, y negative = up. The body centre
// sits `bodyY` above the ground, solved at build time from the hind leg so the paws plant on y = 0 (2.1 note).
// Angles: legs in the engine convention (0 = hanging down, + swings forward, lower RELATIVE to upper); neck and wing
// bones as elevations (+ up) in the stage tables; every pose channel as an offset, + = clockwise (pose.ts).
//
// What it reuses from the engine, and why it is not the humanoid rig:
//   - shading.ts's cel helpers and rigParts.ts's drawLimbSegs, through the structural contracts ShadeTarget and
//     PartRig: a DragonRig IS one (its `palette` is the adapter of bible 1.1: skin = primary = secondary = scale,
//     hair = marking, accent = metal = horn, plus belly / membrane / eye, so farPalette darkens those too);
//   - secondary.ts's getChain / stepChain / resetChain for the tail (ChainRig), with its own small stepper, since
//     the engine's stepChains is private to rig.ts and anchors on humanoid joints;
//   - the humanoid rig's patterns, not its code: device-grid snapping (round(v * sc) / sc), allocation-free drawing
//     (every joint, the info object and the transform are rewritten in place), enter / leave light rotation and the
//     offscreen flash / tint pass.
import { rad, clamp } from '../../lib/engine/math.ts';
import { farPalette } from '../../lib/art/palettes.ts';
import type { Palette } from '../../lib/art/palettes.ts';
import { LIGHT_X, LIGHT_Y, RAMP, tones } from '../../lib/art/shading.ts';
import type { LightDir, Ramp, Tones } from '../../lib/art/shading.ts';
import type { PartRig, Point } from '../../lib/art/rigParts.ts';
import { pathTaperedCapsule } from '../../lib/art/shapes.ts';
import { getChain, stepChain, resetChain } from '../../lib/art/secondary.ts';
import type { Chain, ChainRig } from '../../lib/art/secondary.ts';
import { DRAGON_FAR, DRAGON_SHARED } from './palettes.ts';
import type { DragonElement, DragonPalette } from './palettes.ts';
import { TAIL_CHAIN } from './stages.ts';
import type { Stage } from './stages.ts';
import { makeDragonPose, copyDragonPose } from './pose.ts';
import type { DragonPose, PartialDragonPose } from './pose.ts';
import type { DragonBuild, DragonDims } from './build.ts';
import type { AnchorName, DragonInfo, ElementSpec, ElementStageParams } from './element.ts';
import {
  drawBody, pathBody, drawLeg, drawBatWing, drawNub, drawGroundShadow, drawTube, drawNeck,
  drawSkull, pathSkull, drawJaw, drawMouthInterior,
} from './parts.ts';
import { drawEye, drawBrow, drawBlush, faceBlushes, drawNostril, drawMouthMark, drawEggTooth, drawFangs } from './faces.ts';
import { drawHorn, drawDorsalRow, drawTailRing, drawMarkingPixels } from './features.ts';
import { AmbientBudget, SOLO_BUDGET } from './fx.ts';
import type { TopPass } from './fx.ts';

// ---------- the joints ----------

/** One leg's solved joints, root space. */
export interface DLegJoints {
  root: Point;
  knee: Point;
  ankle: Point;
  /** Absolute thigh / shin angles (engine convention) and the paw tilt, degrees. */
  upper: number;
  lower: number;
  paw: number;
}

/**
 * Everything computeDragonJoints solves, in ROOT space unless named B (body space). Rewritten in place every
 * frame: read, never retain.
 */
export interface DragonJoints {
  /** Body centre and body pitch (degrees, + = chest down). */
  body: Point;
  bodyAng: number;
  /** Hip and chest ball centres. */
  hip: Point;
  chest: Point;
  /** Legs in draw order of the pairs: near hind, near front, far hind, far front. */
  legs: [DLegJoints, DLegJoints, DLegJoints, DLegJoints];
  /** Neck: segment count and n + 1 nodes (x, y, radius), underside normals (throat stripe). */
  neckN: number;
  neckX: Float32Array;
  neckY: Float32Array;
  neckR: Float32Array;
  neckVX: Float32Array;
  neckVY: Float32Array;
  /** Cranium centre and head angle (degrees, + = snout down). */
  cran: Point;
  headAng: number;
  /** Resolved jaw opening: 0 or within [stage minimum, max]. */
  jaw: number;
  /** Eye centre (root space). */
  eye: Point;
  /** Tail: segment count, n + 1 nodes (root space), their body-space copies, underside normals, per-segment angles. */
  tailN: number;
  tailX: Float32Array;
  tailY: Float32Array;
  tailR: Float32Array;
  tailBX: Float32Array;
  tailBY: Float32Array;
  tailVX: Float32Array;
  tailVY: Float32Array;
  /** Per-segment tail angle in root space (+ droops, - lifts). */
  tailA: Float32Array;
  /** Tail-tip space rotation (degrees clockwise from root space). */
  tipAng: number;
  /** The tail chain's anchor (the tail root). */
  rump: Point;
  /** Wing roots (near, far) and wing-space rotations. */
  wingN: Point;
  wingF: Point;
  wingAngN: number;
  wingAngF: number;
  /** Mouth-space origin (snout tip underside) and rotation. */
  mouth: Point;
  mouthAng: number;
  /** Highest point of the head (root y), for effects above it. */
  top: number;
}

/** The root transform of the last draw / step (as the engine's RigTransform), for mapping root space to screen. */
export interface DragonTransform { x: number; y: number; fs: number; ss: number; rx: number; ry: number; c: number; s: number; rot: number }

/**
 * A built dragon. It is a PartRig (so a ShadeTarget) and a ChainRig by declaration, not by luck: drawLimbSegs, the
 * cel helpers and getChain accept it as-is.
 */
export interface DragonRig extends PartRig, ChainRig {
  build: DragonBuild;
  dims: DragonDims;
  spec: ElementSpec;
  /** This stage's feature params (after the pet's seeded variant). */
  sp: ElementStageParams;
  element: DragonElement;
  stage: Stage;
  /** Near palette, far-leg palette (DRAGON_FAR.legs) and far wing / far head palette (DRAGON_FAR.wingAndHead). */
  pal: Readonly<DragonPalette>;
  palLegFar: Readonly<DragonPalette>;
  palWingFar: Readonly<DragonPalette>;
  /** The engine-palette adapter (1.1) and its far version. */
  palette: Palette;
  paletteFar: Palette;
  hairStyle: string;
  scale: number;
  pxScale: number;
  /** Body-space constants: ball centres and the belly line. */
  hipB: Point;
  chestB: Point;
  bellyY: number;
  j: DragonJoints;
  tf: DragonTransform;
  facing: number;
  /** Steps taken (stepDragon calls): the clock for every procedural effect. */
  tick: number;
  /** Resolved mood of the last draw (-1..1). */
  mood: number;
  /** True while drawing a flat silhouette (bible 5.1 #1). */
  silhouette: boolean;
  /** The reusable element-renderer info object. */
  info: DragonInfo;
  /** Where rising particles go this draw (null = not drawn) and the ambient budget / slot. */
  top: TopPass | null;
  budget: AmbientBudget;
  slot: number;
  // ---- ShadeTarget / PartRig ----
  tones: Map<string, Tones>;
  ramp: Readonly<Ramp>;
  col(hex: string): string;
  override: string | null;
  shading: boolean;
  light: LightDir;
  outline: string;
  ow: number;
  contactAlpha: number;
  tonesN: number;
  thinR: number | null;
  hiMin: number | null;
  flatR: number | null;
  // ---- ChainRig ----
  chains: Record<string, Chain>;
  /** The tail chain, and the held copy lightning's stepped tail reads. */
  tailChain: Chain;
  tailHeld: Float32Array;
  /** Resolution target for partial poses. */
  scratch: DragonPose;
}

/** The engine-palette adapter of bible 1.1. */
function adapt(p: Readonly<DragonPalette>): Palette {
  return {
    skin: p.scale, primary: p.scale, secondary: p.scale, hair: p.marking, accent: p.horn, metal: p.horn,
    dark: p.dark, glow: p.glow, belly: p.belly, membrane: p.membrane, eye: p.eye,
    scale: p.scale, marking: p.marking, horn: p.horn,
  };
}

const pt = (): Point => ({ x: 0, y: 0 });
const legJ = (): DLegJoints => ({ root: pt(), knee: pt(), ankle: pt(), upper: 0, lower: 0, paw: 0 });

/** Build a rig from a resolved build (build.ts dragonBuild). Allocates: once per pet and stage. */
export function buildDragon(build: DragonBuild): DragonRig {
  const d = build.dims, pal = build.palette;
  const legFar = farPalette(pal, DRAGON_FAR.legs.shade, DRAGON_FAR.legs.desat);
  const wingFar = farPalette(pal, DRAGON_FAR.wingAndHead.shade, DRAGON_FAR.wingAndHead.desat);
  const tn = d.tail.n, nn = d.neck.n;
  const f32 = (k: number) => new Float32Array(k);
  const rig: DragonRig = {
    build, dims: d, spec: build.spec, sp: build.sp, element: build.element, stage: build.stage,
    pal, palLegFar: legFar, palWingFar: wingFar,
    palette: adapt(pal), paletteFar: adapt(wingFar), hairStyle: 'bald',
    scale: build.scale, pxScale: build.scale,
    hipB: { x: -d.gap / 2, y: 0 }, chestB: { x: d.gap / 2, y: -1 },
    bellyY: (-1 + d.chestR) - d.bellyFrac * d.chestR * 2,
    j: {
      body: pt(), bodyAng: 0, hip: pt(), chest: pt(), legs: [legJ(), legJ(), legJ(), legJ()],
      neckN: nn, neckX: f32(nn + 1), neckY: f32(nn + 1), neckR: f32(nn + 1), neckVX: f32(nn + 1), neckVY: f32(nn + 1),
      cran: pt(), headAng: 0, jaw: 0, eye: pt(),
      tailN: tn, tailX: f32(tn + 1), tailY: f32(tn + 1), tailR: f32(tn + 1), tailBX: f32(tn + 1), tailBY: f32(tn + 1),
      tailVX: f32(tn + 1), tailVY: f32(tn + 1), tailA: f32(tn), tipAng: 0, rump: pt(),
      wingN: pt(), wingF: pt(), wingAngN: 0, wingAngF: 0, mouth: pt(), mouthAng: 0, top: 0,
    },
    tf: { x: 0, y: 0, fs: 1, ss: 1, rx: 0, ry: 0, c: 1, s: 0, rot: 0 },
    facing: 1, tick: 0, mood: 0, silhouette: false,
    info: {
      anchor: 'ambient', element: build.element, stage: build.stage, far: false, pal, near: pal, mood: 0, asleep: false,
      tick: 0, seed: build.seed, sp: build.sp, r: 0, len: 0, ang: 0,
    },
    top: null, budget: SOLO_BUDGET, slot: 0,
    tones: new Map(), ramp: { ...RAMP }, override: null, shading: true,
    col(hex: string): string { return rig.override || hex; },
    light: { x: LIGHT_X, y: LIGHT_Y }, outline: DRAGON_SHARED.outline, ow: 1, contactAlpha: 0, tonesN: 3,
    thinR: null, hiMin: null, flatR: null,
    chains: {}, tailChain: null as unknown as Chain, tailHeld: f32(tn), scratch: makeDragonPose(),
  };
  const tc = TAIL_CHAIN[build.stage];
  rig.tailChain = getChain(rig, 'tail', tn, { joint: 'rump', rest: [-1, 0], stiffness: tc.stiffness, damping: tc.damping, gain: tc.gain, follow: tc.follow, maxAng: tc.maxAng });
  return rig;
}

// ---------- solving ----------

let G = 1;
const S = (v: number): number => Math.round(v * G) / G;

/** body space -> root space, rounded to the device grid. */
function toRoot(rig: DragonRig, bx: number, by: number, out: Point): Point {
  const J = rig.j, c = Math.cos(rad(J.bodyAng)), s = Math.sin(rad(J.bodyAng));
  out.x = S(J.body.x + bx * c - by * s); out.y = S(J.body.y + bx * s + by * c);
  return out;
}

const LEG_KEYS = ['legNH', 'legNF', 'legFH', 'legFF'] as const;

/** Solve every joint for a fully populated pose into rig.j (root space, device-grid snapped). */
export function computeDragonJoints(rig: DragonRig, pose: DragonPose): DragonJoints {
  const d = rig.dims, J = rig.j, sp = rig.sp;
  G = rig.pxScale || 1;
  J.bodyAng = pose.body.rot;
  J.body.x = 0; J.body.y = S(-d.bodyY + pose.body.y);
  const bc = Math.cos(rad(J.bodyAng)), bs = Math.sin(rad(J.bodyAng));
  toRoot(rig, rig.hipB.x, rig.hipB.y, J.hip); toRoot(rig, rig.chestB.x, rig.chestB.y, J.chest);

  // ---- legs: joints ride the body, angles are absolute (a body pitch never swings the legs) ----
  for (let i = 0; i < 4; i++) {
    const front = i === 1 || i === 3, far = i >= 2;
    const L = front ? d.front : d.hind, lg = J.legs[i], p = pose[LEG_KEYS[i]];
    const jx = (front ? 1 : -1) * (d.gap / 2 + L.X) + (far ? (front ? 4 : -4) : 0), jy = L.y + (far ? -2 : 0);
    toRoot(rig, jx, jy, lg.root);
    lg.upper = L.restUpper + p.upper;
    lg.lower = lg.upper + L.restLower + (front ? d.frontFix : 0) + p.lower;
    lg.paw = p.paw;
    lg.knee.x = S(lg.root.x + Math.sin(rad(lg.upper)) * L.upper); lg.knee.y = S(lg.root.y + Math.cos(rad(lg.upper)) * L.upper);
    lg.ankle.x = S(lg.knee.x + Math.sin(rad(lg.lower)) * L.lower); lg.ankle.y = S(lg.knee.y + Math.cos(rad(lg.lower)) * L.lower);
  }

  // ---- neck: FK from the chest, elevations relative to the body ----
  const N = d.neck, nn = N.n;
  let off = 0;
  const r0 = N.r0, r1 = N.r1;
  const rootX = N.root[0], rootY = N.root[1];
  let x = J.body.x + rootX * bc - rootY * bs, y = J.body.y + rootX * bs + rootY * bc;
  for (let k = 0; k < nn; k++) {
    off += k === 0 ? pose.neck.a0 : pose.neck.a1;
    const e = rad(N.rest[k] - off - J.bodyAng), ux = Math.cos(e), uy = -Math.sin(e);
    if (k === 0) {
      J.neckX[0] = S(x - ux * N.sink); J.neckY[0] = S(y - uy * N.sink);
      J.neckVX[0] = -uy; J.neckVY[0] = ux;
    }
    x += ux * N.len; y += uy * N.len;
    J.neckX[k + 1] = S(x); J.neckY[k + 1] = S(y);
    J.neckVX[k + 1] = -uy; J.neckVY[k + 1] = ux;
    if (k > 0) { J.neckVX[k] = (J.neckVX[k] - uy) / 2; J.neckVY[k] = (J.neckVY[k] + ux) / 2; }
  }
  for (let k = 0; k <= nn; k++) J.neckR[k] = r0 + (r1 - r0) * (k / nn);
  // underside normals point down-forward; flip any that point up (a neck bent past vertical)
  for (let k = 0; k <= nn; k++) { if (J.neckVY[k] < 0) { J.neckVX[k] = -J.neckVX[k]; J.neckVY[k] = -J.neckVY[k]; } }

  // ---- head ----
  const H = d.head;
  J.headAng = N.headPitch + pose.neck.a0 + (nn > 1 ? pose.neck.a1 : 0) + pose.head.rot + J.bodyAng;
  const hc = Math.cos(rad(J.headAng)), hs = Math.sin(rad(J.headAng));
  const ex = J.neckX[nn], ey = J.neckY[nn];
  J.cran.x = S(ex + H.fromNeck[0] * hc - H.fromNeck[1] * hs); J.cran.y = S(ey + H.fromNeck[0] * hs + H.fromNeck[1] * hc);
  J.eye.x = J.cran.x + H.eye.x * hc - H.eye.y * hs; J.eye.y = J.cran.y + H.eye.x * hs + H.eye.y * hc;
  J.top = J.cran.y - H.cranR - H.brow;
  // An open jaw is 0 or >= the stage minimum (1.2): below that the wedge shows neither mouth nor tongue.
  const jw = pose.jaw;
  J.jaw = jw < H.jawMin * 0.5 ? 0 : clamp(jw, H.jawMin, H.jawMax);
  const mx = H.snout.x1, my = H.snout.y1 + H.snout.r1 * 0.5;
  J.mouth.x = J.cran.x + mx * hc - my * hs; J.mouth.y = J.cran.y + mx * hs + my * hc;
  J.mouthAng = J.headAng + J.jaw * 0.5;

  // ---- tail: rest shape + pose + chain, from the hip (root: hip centre + (-hipR + sink, -1)) ----
  const T = d.tail, tn = T.n, rest = d.tailRest, ch = rig.tailChain;
  const held = rig.spec.tailHold ? rig.tailHeld : ch.ang;
  let bx = rig.hipB.x - d.hipR + T.sink, by = rig.hipB.y - 1;
  J.tailBX[0] = bx; J.tailBY[0] = by;
  toRoot(rig, bx, by, J.rump);
  J.tailX[0] = J.rump.x; J.tailY[0] = J.rump.y;
  let acc = 0, tau = 0;
  for (let k = 0; k < tn; k++) {
    acc += held[k];
    tau = rest.first + pose.tail.lift + pose.tail.sway + k * (rest.bend + pose.tail.curl) - acc;
    J.tailA[k] = tau - J.bodyAng;
    const a = rad(tau);
    bx += -Math.cos(a) * T.len; by += Math.sin(a) * T.len;
    J.tailBX[k + 1] = bx; J.tailBY[k + 1] = by;
  }
  for (let k = 0; k <= tn; k++) {
    const r = d.tailR0 + (d.tailR1 - d.tailR0) * (k / tn);
    J.tailR[k] = r;
    if (k > 0) {
      const X = J.body.x + J.tailBX[k] * bc - J.tailBY[k] * bs, Y = J.body.y + J.tailBX[k] * bs + J.tailBY[k] * bc;
      // a tail never sinks through the floor (rock's rests its tip on the ground: y clamped, 2.3)
      J.tailX[k] = S(X); J.tailY[k] = S(Math.min(Y, -r));
    }
    // underside normal: the tail's ventral side is (sin tau, cos tau) for a tail pointing back
    const a = rad(J.tailA[Math.min(k, tn - 1)]);
    J.tailVX[k] = Math.sin(a); J.tailVY[k] = Math.cos(a);
  }
  J.tipAng = -J.tailA[tn - 1];

  // ---- wings ----
  const wr = d.wing ? d.wing.root : d.nub ? d.nub.root : null;
  if (wr) {
    const wp = sp.wing;
    toRoot(rig, wr[0] + (wp.rootDx || 0), wr[1] + (wp.rootDy || 0), J.wingN);
    toRoot(rig, wr[0] + (wp.rootDx || 0), wr[1] + (wp.rootDy || 0) - 2, J.wingF);
    J.wingAngN = J.bodyAng - pose.wing.flap;
    J.wingAngF = J.wingAngN - 8;
  }
  return J;
}

// ---------- local spaces ----------

/** Push a local space and point rig.light at the light in it (angDeg = total rotation from root space). */
export function enter(ctx: CanvasRenderingContext2D, rig: DragonRig, x: number, y: number, angDeg: number): void {
  ctx.save(); ctx.translate(x, y);
  if (angDeg) ctx.rotate(rad(angDeg));
  setLight(rig, angDeg);
}
/** Pop a local space and restore the root-space light. */
export function leave(ctx: CanvasRenderingContext2D, rig: DragonRig): void { ctx.restore(); rig.light.x = LIGHT_X; rig.light.y = LIGHT_Y; }
export function setLight(rig: DragonRig, angDeg: number): void {
  const c = Math.cos(rad(angDeg)), s = Math.sin(rad(angDeg));
  rig.light.x = LIGHT_X * c + LIGHT_Y * s; rig.light.y = -LIGHT_X * s + LIGHT_Y * c;
}

/**
 * Enter FACE space from root space: origin at root point (X, Y) snapped to a whole device pixel, one unit = one
 * sprite pixel, mirrored by facing, but never rotated by the root or squashed -- the eye is a pixel construction
 * (faces.ts). Pair with ctx.restore().
 */
export function enterFace(ctx: CanvasRenderingContext2D, rig: DragonRig, X: number, Y: number): void {
  const t = rig.tf;
  const dx = t.fs * (t.rx + X * t.c - Y * t.s), dy = t.ss * (t.ry + X * t.s + Y * t.c);
  ctx.save();
  ctx.rotate(-rad(t.rot)); ctx.translate(-t.rx, -t.ry); ctx.scale(1 / t.fs, 1 / t.ss);
  ctx.translate(Math.round(dx), Math.round(dy));
  ctx.scale(rig.facing * rig.pxScale, rig.pxScale);
}

/** Map a root-space point to screen (after the last draw / step). */
export function rootToScreen(rig: DragonRig, X: number, Y: number, out: Point): Point {
  const t = rig.tf;
  out.x = t.x + t.fs * (t.rx + X * t.c - Y * t.s); out.y = t.y + t.ss * (t.ry + X * t.s + Y * t.c);
  return out;
}

function fillInfo(rig: DragonRig, anchor: AnchorName, far: boolean, pal: Readonly<DragonPalette>, r: number, len: number, ang: number): DragonInfo {
  const o = rig.info;
  o.anchor = anchor; o.far = far; o.pal = pal; o.r = r; o.len = len; o.ang = ang;
  o.mood = rig.mood; o.tick = rig.tick;
  return o;
}

// ---------- drawing ----------

/** drawDragon / stepDragon options. */
export interface DrawDragonOpts {
  /** Screen position of the ground point under the body centre. */
  x: number;
  y: number;
  /** 1 = facing right (default), -1 = left (mirrors the light too). */
  facing?: number;
  /** Draw scale, multiplied by build.scale. */
  scale?: number;
  /** The pet's resting mood (-1..1); pose.mood is added to it. */
  mood?: number;
  /** Whole-dragon white flash, or a tint composited over the silhouette (offscreen pass). */
  flash?: boolean;
  tint?: string | null;
  tintAlpha?: number;
  /** Multiplied into globalAlpha. */
  alpha?: number;
  /** Everything one flat colour (true = the outline #1a1018), no ground shadow, no particles (5.1 #1). */
  silhouette?: boolean | string;
  /** Skip the step (secondary motion, tick): the caller already stepped this frame with stepDragon. */
  still?: boolean;
  /** Where rising particles go (1.4 step 14); omitted = not drawn. */
  top?: TopPass | null;
  /** Ambient budget and this dragon's slot in it (5.4). */
  budget?: AmbientBudget;
  slot?: number;
  /** false = no ground shadow. */
  shadow?: boolean;
}

/** Resolve a partial or full pose into the rig's scratch (full poses from a player are used as they are). */
function resolve(rig: DragonRig, pose: DragonPose | PartialDragonPose | null | undefined): DragonPose {
  return copyDragonPose(pose as PartialDragonPose, rig.scratch, true);
}

function setTransform(rig: DragonRig, P: DragonPose, o: DrawDragonOpts): void {
  const facing = o.facing || 1, sc = (o.scale || 1) * rig.scale;
  rig.pxScale = sc;
  rig.ow = 1 / sc;
  const squash = P.squash, stretch = P.stretch === 1 && squash !== 1 ? 1 / squash : P.stretch;
  const t = rig.tf;
  t.x = Math.round(o.x); t.y = Math.round(o.y); t.fs = facing * sc * squash; t.ss = sc * stretch;
  t.rx = Math.round(P.root.x * sc) / sc; t.ry = Math.round(P.root.y * sc) / sc;
  t.rot = P.root.rot; t.c = Math.cos(rad(P.root.rot)); t.s = Math.sin(rad(P.root.rot));
  rig.facing = facing;
  rig.mood = clamp((o.mood || 0) + P.mood, -1, 1);
}

const SCR: Point = { x: 0, y: 0 };

/**
 * Advance one 60 Hz step: solve the joints, step the tail chain from the rump's screen motion (bible 1.1: a small
 * stepper on the engine's getChain / stepChain / resetChain) and count the tick. drawDragon calls it unless
 * `still`; a frozen-time view calls it t times and then draws with `still`.
 */
export function stepDragon(rig: DragonRig, pose: DragonPose | PartialDragonPose, o: DrawDragonOpts): void {
  const P = resolve(rig, pose);
  setTransform(rig, P, o);
  computeDragonJoints(rig, P);
  const ch = rig.tailChain;
  rootToScreen(rig, rig.j.rump.x, rig.j.rump.y, SCR);
  const inv = 1 / (Math.abs(rig.tf.fs) || 1), ang = rig.j.bodyAng + P.root.rot;
  if (ch.init) {
    const dx = (SCR.x - ch.lastX) * rig.facing * inv, dy = (SCR.y - ch.lastY) * inv;
    if (Math.abs(dx) > ch.teleport || Math.abs(dy) > ch.teleport) resetChain(ch);
    else stepChain(ch, dx, dy, ang - ch.lastAng);
  }
  ch.init = true; ch.lastX = SCR.x; ch.lastY = SCR.y; ch.lastAng = ang;
  const hold = rig.spec.tailHold || 0;
  if (hold && rig.tick % hold === 0) rig.tailHeld.set(ch.ang);
  rig.tick++;
}

// Flash / tint offscreen: large enough for an adult with spread wings at the 3x stage view.
const OFF_W = 800, OFF_H = 520, OFF_OX = 440, OFF_OY = 400;
let offCanvas: HTMLCanvasElement | null = null, offCtx: CanvasRenderingContext2D | null = null;
function getOffscreen(): CanvasRenderingContext2D {
  if (!offCanvas) { offCanvas = document.createElement('canvas'); offCanvas.width = OFF_W; offCanvas.height = OFF_H; offCtx = offCanvas.getContext('2d'); }
  return offCtx!;
}

/**
 * Draw a dragon at screen (x, y) = the ground point under its body centre. The pose may be partial (resolved
 * against DEFAULT) or a player's full pose.
 */
export function drawDragon(ctx: CanvasRenderingContext2D, rig: DragonRig, pose: DragonPose | PartialDragonPose, o: DrawDragonOpts): void {
  if (!o.still) stepDragon(rig, pose, o);
  const P = resolve(rig, pose);
  setTransform(rig, P, o);
  computeDragonJoints(rig, P);
  rig.top = o.silhouette ? null : o.top || null;
  rig.budget = o.budget || SOLO_BUDGET; rig.slot = o.slot || 0;
  rig.silhouette = !!o.silhouette;
  rig.info.asleep = P.sleep >= 0.5;
  rig.light.x = LIGHT_X; rig.light.y = LIGHT_Y;
  const t = rig.tf;
  ctx.save();
  if (o.alpha != null && o.alpha < 1) ctx.globalAlpha *= o.alpha;
  if (o.shadow !== false && !o.silhouette) {
    ctx.save(); ctx.translate(t.x, t.y); ctx.scale(t.fs, t.ss); ctx.translate(t.rx, 0);
    drawGroundShadow(ctx, rig, -t.ry);
    ctx.restore();
  }
  if (o.flash || o.tint) {
    const g = getOffscreen();
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, OFF_W, OFF_H);
    g.translate(OFF_OX, OFF_OY); g.scale(t.fs, t.ss); g.translate(t.rx, t.ry); g.rotate(rad(t.rot));
    rig.override = o.flash ? '#ffffff' : null;
    drawParts(g, rig, P);
    rig.override = null;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = o.flash ? 1 : (o.tintAlpha != null ? o.tintAlpha : 0.5);
    g.fillStyle = o.flash ? '#ffffff' : o.tint as string;
    g.fillRect(0, 0, OFF_W, OFF_H);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    ctx.drawImage(offCanvas!, t.x - OFF_OX, t.y - OFF_OY);
  } else {
    ctx.translate(t.x, t.y); ctx.scale(t.fs, t.ss); ctx.translate(t.rx, t.ry); ctx.rotate(rad(t.rot));
    rig.override = o.silhouette ? (typeof o.silhouette === 'string' ? o.silhouette : DRAGON_SHARED.outline) : null;
    drawParts(ctx, rig, P);
    rig.override = null;
  }
  ctx.restore();
}

/** Every part in the order of bible 1.4, root space. */
function drawParts(ctx: CanvasRenderingContext2D, rig: DragonRig, P: DragonPose): void {
  const J = rig.j, d = rig.dims, sp = rig.sp, R = rig.spec.render, pal = rig.pal;
  const fold = P.wing.fold, custom = sp.wing.style === 'custom';
  const tuck = P.tuck | 0;
  // 2. far wing: only when spread >= 0.25 (a folded far wing is a sliver: D19); a custom (cocked) wing always
  if (custom || fold >= 0.25) drawWing(ctx, rig, P, true);
  // 3. far head features
  drawHeadFeatures(ctx, rig, P, true);
  // 4. far hind leg, far front leg
  drawLegN(ctx, rig, 2, rig.palLegFar, false);
  drawLegN(ctx, rig, 3, rig.palLegFar, false);
  // 5. tail, then the tail-tip feature
  drawTail(ctx, rig, pal);
  if (R.tailTip) {
    const tn = J.tailN;
    enter(ctx, rig, J.tailX[tn], J.tailY[tn], J.tipAng);
    R.tailTip(ctx, rig, P, fillInfo(rig, 'tailTip', false, pal, J.tailR[tn], d.tail.len * tn, J.tipAng));
    leave(ctx, rig);
  }
  // 6. back row (before the body: the body contour hides the roots)
  enter(ctx, rig, J.body.x, J.body.y, J.bodyAng);
  if (sp.dorsal) drawDorsalRow(ctx, rig, sp.dorsal, pal);
  if (R.backRow) R.backRow(ctx, rig, P, fillInfo(rig, 'backRow', false, pal, d.hipR, d.bodyLen, J.bodyAng));
  // 7. body, belly band, body markings
  drawBody(ctx, rig, pal);
  leave(ctx, rig);
  drawBodyMarkings(ctx, rig, pal);
  // 8. (tuck 1: the head group -- with its neck, so the neck never lies over the head -- goes under the dome) ;
  //    rock: near wing, then bodyOver
  if (tuck === 1) { drawNeck(ctx, rig, pal, P.gulp | 0, sacOf(rig, P)); drawHeadGroup(ctx, rig, P); }
  const under = !!rig.spec.wingUnderBodyOver;
  if (under) drawWing(ctx, rig, P, false);
  if (R.bodyOver) {
    enter(ctx, rig, J.body.x, J.body.y, J.bodyAng);
    R.bodyOver(ctx, rig, P, fillInfo(rig, 'bodyOver', false, pal, d.hipR, d.bodyLen, J.bodyAng));
    leave(ctx, rig);
  }
  // 9. neck
  if (tuck !== 1) drawNeck(ctx, rig, pal, P.gulp | 0, sacOf(rig, P));
  // 10. near hind, near front
  drawLegN(ctx, rig, 0, pal, true);
  drawLegN(ctx, rig, 1, pal, true);
  // 11. (tuck 2: the baby bun, nubs over the head) ; near wing
  if (tuck === 2) drawHeadGroup(ctx, rig, P);
  if (!under) drawWing(ctx, rig, P, false);
  // 12. the head group, last among body parts, so nothing covers the eye
  if (tuck !== 1 && tuck !== 2) drawHeadGroup(ctx, rig, P);
  // 13. the dragon's own effects
  if (R.breath) {
    enter(ctx, rig, J.mouth.x, J.mouth.y, J.mouthAng);
    R.breath(ctx, rig, P, fillInfo(rig, 'breath', false, pal, d.head.jaw.tx - d.head.jaw.hx, 0, J.mouthAng));
    leave(ctx, rig);
  }
  if (R.ambient && !rig.silhouette) R.ambient(ctx, rig, P, fillInfo(rig, 'ambient', false, pal, 0, 0, 0));
}

/** The element's throat-sac swell this frame (0 = none). */
function sacOf(rig: DragonRig, P: DragonPose): number {
  const f = rig.spec.neckSac;
  return f ? f(P, fillInfo(rig, 'breath', false, rig.pal, rig.dims.neck.r1, rig.dims.neck.len, 0)) : 0;
}

function drawLegN(ctx: CanvasRenderingContext2D, rig: DragonRig, i: number, pal: Readonly<DragonPalette>, near: boolean): void {
  const lg = rig.j.legs[i], front = i === 1 || i === 3, L = front ? rig.dims.front : rig.dims.hind;
  drawLeg(ctx, rig, lg.root, lg.knee, lg.ankle, L.r1, L.r2, L.bulge, L.pawW, L.pawH, lg.paw, pal.scale, near && !!rig.dims.claws);
}

/** Step 5: the tail tube (belly stripe on its first 60 %), then its markings clipped inside it. Root space. */
function drawTail(ctx: CanvasRenderingContext2D, rig: DragonRig, pal: Readonly<DragonPalette>): void {
  const J = rig.j, n = J.tailN + 1;
  drawTube(ctx, rig, J.tailX, J.tailY, J.tailR, n, pal.scale, pal.belly, J.tailVX, J.tailVY, Math.ceil(n * 0.6), 0.32);
  const mk = rig.sp.markings;
  let any = false;
  for (let i = 0; i < mk.length; i++) if (mk[i].at === 'tail') { any = true; break; }
  if (!any || rig.override) return;
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < n - 1; i++) pathTaperedTail(ctx, J, i);
  ctx.clip();
  for (let i = 0; i < mk.length; i++) {
    const m = mk[i];
    if (m.at !== 'tail') continue;
    // position along the node polyline at fraction t, oriented across the tail
    const f = Math.max(0, Math.min(0.999, m.t ?? 0.2)) * J.tailN, k = Math.floor(f), u = f - k;
    const x = J.tailX[k] + (J.tailX[k + 1] - J.tailX[k]) * u, y = J.tailY[k] + (J.tailY[k + 1] - J.tailY[k]) * u;
    if (m.kind === 'ring') {
      enter(ctx, rig, x, y, -J.tailA[k]);
      ctx.translate(-(m.dx || 0), m.dy || 0);
      drawTailRing(ctx, m, markingTone(rig, pal));
      leave(ctx, rig);
    } else {
      enterFace(ctx, rig, x - (m.dx || 0), y + (m.dy || 0));
      drawMarkingPixels(ctx, m, markingTone(rig, pal));
      ctx.restore();
    }
  }
  ctx.restore();
}
function pathTaperedTail(ctx: CanvasRenderingContext2D, J: DragonJoints, i: number): void {
  pathTaperedCapsule(ctx, J.tailX[i], J.tailY[i], J.tailX[i + 1], J.tailY[i + 1], J.tailR[i], J.tailR[i + 1], true);
}

/**
 * Step 7: body markings, clipped to the body and kept >= 3 px above the belly line. Called in ROOT space: the clip
 * is set in body space, then each marking is a pixel bitmap in a device-aligned space at its anchor (features.ts).
 */
function drawBodyMarkings(ctx: CanvasRenderingContext2D, rig: DragonRig, pal: Readonly<DragonPalette>): void {
  const mk = rig.sp.markings;
  if (rig.override || !mk.length) return;
  const d = rig.dims, J = rig.j;
  ctx.save();
  ctx.translate(J.body.x, J.body.y); ctx.rotate(rad(J.bodyAng));
  pathBody(ctx, rig); ctx.clip();
  ctx.beginPath(); ctx.rect(-200, -200, 400, 200 + rig.bellyY - 3); ctx.clip();
  ctx.rotate(-rad(J.bodyAng)); ctx.translate(-J.body.x, -J.body.y);
  const backY = -d.chestR * 0.5 - 1;
  const tone = markingTone(rig, pal);
  for (let i = 0; i < mk.length; i++) {
    const m = mk[i];
    if (m.at === 'tail') continue;
    const h = m.h ?? m.size;
    let x = 0, y = 0;
    // centred between the back line and the leg roots, clear of the neck root and the tail root
    if (m.at === 'shoulder') { x = rig.chestB.x - d.chestR * 0.62; y = backY + d.chestR * 0.15; }
    else if (m.at === 'haunch') { x = rig.hipB.x + d.hipR * 0.15; y = backY + d.hipR * 0.1 + 1; }
    else { const t = m.t ?? 0.5; x = rig.hipB.x + (rig.chestB.x - rig.hipB.x) * t; y = backY + 1; }
    y = Math.min(y, rig.bellyY - 3 - h / 2);
    toRoot(rig, x + (m.dx || 0), y + (m.dy || 0), MP);
    enterFace(ctx, rig, MP.x, MP.y);
    drawMarkingPixels(ctx, m, tone);
    ctx.restore();
  }
  ctx.restore();
}
const MP: Point = { x: 0, y: 0 };

/** The marking colour this frame: the element's mood-driven tone (water's spots) or the palette's marking. */
function markingTone(rig: DragonRig, pal: Readonly<DragonPalette>): string {
  const f = rig.spec.markingTone;
  return f ? f(fillInfo(rig, 'bodyOver', false, pal, rig.dims.hipR, rig.dims.bodyLen, rig.j.bodyAng)) : pal.marking;
}

/** Steps 2 / 11: one wing (near or far) in wing space. */
function drawWing(ctx: CanvasRenderingContext2D, rig: DragonRig, P: DragonPose, far: boolean): void {
  const J = rig.j, wp = rig.sp.wing, pal = far ? rig.palWingFar : rig.pal;
  const root = far ? J.wingF : J.wingN, ang = far ? J.wingAngF : J.wingAngN;
  if (wp.style === 'custom') {
    const R = rig.spec.render;
    if (!R.wing) return;
    enter(ctx, rig, root.x, root.y, ang);
    R.wing(ctx, rig, P, fillInfo(rig, 'wing', far, pal, wp.span, 0, ang));
    leave(ctx, rig);
    return;
  }
  enter(ctx, rig, root.x, root.y, ang);
  if (rig.dims.nub) {
    const nb = rig.dims.nub, rest = wp.nubRest ?? nb.rest;
    drawNub(ctx, rig, rest + (nb.lift - rest) * Math.max(0, Math.min(1, P.wing.fold)) + (far ? 8 : 0), pal);
  } else drawBatWing(ctx, rig, wp, P.wing.fold, pal);
  leave(ctx, rig);
}

/** Steps 3 / 12.6: shared horns plus the element's head renderer, cranium space. */
function drawHeadFeatures(ctx: CanvasRenderingContext2D, rig: DragonRig, P: DragonPose, far: boolean): void {
  const J = rig.j, H = rig.dims.head, R = rig.spec.render, hp = rig.sp.horns;
  const pal = far ? rig.palWingFar : rig.pal;
  const fn = far ? R.farHead : R.nearHead;
  if (!hp && !fn) return;
  enter(ctx, rig, J.cran.x, J.cran.y, J.headAng);
  // far: root 3 px behind and 1 px above the near one, angled -8 deg so the tips separate (1.5)
  if (hp && !(far && rig.stage === 'baby')) drawHorn(ctx, rig, hp, H.cranR, pal, far ? 8 : 0, far ? -3 : 0, far ? -1 : 0);
  if (fn) fn(ctx, rig, P, fillInfo(rig, far ? 'farHead' : 'nearHead', far, pal, H.cranR, rig.dims.headLen, J.headAng));
  leave(ctx, rig);
}

const FP: Point = { x: 0, y: 0 };
/** Cranium-space point -> root space (into FP). */
function cranToRoot(rig: DragonRig, x: number, y: number): Point {
  const J = rig.j, c = Math.cos(rad(J.headAng)), s = Math.sin(rad(J.headAng));
  FP.x = J.cran.x + x * c - y * s; FP.y = J.cran.y + x * s + y * c;
  return FP;
}

/** Step 12: mouth interior, jaw, skull, face markings, eye / brow / nostril / fangs, near head features. */
function drawHeadGroup(ctx: CanvasRenderingContext2D, rig: DragonRig, P: DragonPose): void {
  const J = rig.j, H = rig.dims.head, pal = rig.pal, R = rig.spec.render;
  enter(ctx, rig, J.cran.x, J.cran.y, J.headAng);
  if (J.jaw > 0) drawMouthInterior(ctx, rig, J.jaw, DRAGON_SHARED.mouth, DRAGON_SHARED.tongue);
  drawJaw(ctx, rig, J.jaw, pal);
  drawSkull(ctx, rig, pal);
  if (R.headMarkings && !rig.override) {
    ctx.save();
    pathSkull(ctx, rig); ctx.clip();
    R.headMarkings(ctx, rig, P, fillInfo(rig, 'headMarkings', false, pal, H.cranR, rig.dims.headLen, J.headAng));
    ctx.restore();
  }
  leave(ctx, rig);
  // the face, device-aligned (faces.ts)
  let face = P.face | 0;
  if (P.sleep >= 0.5) face = 2; // DFACE.closed
  const ex = J.eye.x, ey = J.eye.y;
  enterFace(ctx, rig, ex, ey);
  if (faceBlushes(face)) drawBlush(ctx, rig);
  drawEye(ctx, rig, face);
  drawBrow(ctx, rig, face, tones(rig, pal.scale).deep);
  // nostril near the snout tip, top side; never touching the eye's ring (the baby's button snout is 5 px long)
  const sn = H.snout, eyeFront = H.eye.x + H.eye.w / 2 + 2;
  let p = cranToRoot(rig, Math.max(eyeFront + 1, sn.x1 + sn.r1 * 0.1 - 1), sn.y1 - sn.r1 * 0.55);
  drawNostril(ctx, rig, Math.round(p.x - ex) - 1, Math.round(p.y - ey) - 1);
  if (H.teeth === 'egg') {
    // the egg tooth: 2 x 2 on the very tip of the snout, at the mouth line
    p = cranToRoot(rig, sn.x1 + sn.r1 * 0.72, sn.y1 + sn.r1 * 0.2);
    drawEggTooth(ctx, rig, Math.round(p.x - ex) - 1, Math.round(p.y - ey) - 1);
  } else if (J.jaw > 0) {
    p = cranToRoot(rig, sn.x1 - 2, sn.y1 + sn.r1 * 0.9);
    drawFangs(ctx, rig, Math.round(p.x - ex) - 1, Math.round(p.y - ey));
  }
  if (J.jaw === 0) {
    // the mouth corner: the back end of the mouth line, where the snout's underside meets the jaw
    p = cranToRoot(rig, H.jaw.hx + 4, sn.y0 + sn.r0 - 0.5);
    drawMouthMark(ctx, rig, face, Math.round(p.x - ex), Math.round(p.y - ey));
  }
  ctx.restore();
  drawHeadFeatures(ctx, rig, P, false);
}

/** Convenience: a rig at a pose's joints without drawing (tools, hit tests). */
export function solveDragon(rig: DragonRig, pose: DragonPose | PartialDragonPose, o: DrawDragonOpts): DragonJoints {
  const P = resolve(rig, pose);
  setTransform(rig, P, o);
  return computeDragonJoints(rig, P);
}
