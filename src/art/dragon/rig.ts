// The dragon rig: one parameterised quadruped that draws all 28 looks (docs/ART_BIBLE.md sections 1-2).
//
// LOCAL SPACE: authored facing right, origin on the ground under the body centre, y negative = up. The body centre
// sits `bodyY` above the ground, solved at build time from the hind leg so the paws plant on y = 0 (2.1 note).
// Angles: legs in the engine convention (0 = hanging down, + swings forward, lower RELATIVE to upper); neck and wing
// bones as elevations (+ up) in the stage tables; every pose channel as an offset, + = clockwise (pose.ts).
//
// PLANTED PAWS: legs are solved by 2-bone IK (solveTwoBone) toward each paw's rest spot, so the body can bob, dip,
// pitch and crouch while the paws stay on y = 0; pose.legXX.plant = 0 hands a leg back to plain FK (swing, air).
// The spots are GROUND spots: a root.rot (a waddle) is counter-rotated out of them; root.x / root.y carry the paws.
//
// What it reuses from the engine, and why it is not the humanoid rig:
//   - shading.ts's cel helpers, through the structural contracts ShadeTarget and PartRig: a DragonRig IS one (its
//     `palette` is the adapter of bible 1.1: skin = primary = secondary = scale, hair = marking, accent = metal =
//     horn, plus belly / membrane / eye, so farPalette darkens those too). Legs use parts.ts drawLeg, drawLimbSegs'
//     construction with the paw appended to the same path (engine candidate: an extra-subpath option);
//   - secondary.ts's getChain / stepChain / resetChain for the tail (ChainRig), with its own small stepper, since
//     the engine's stepChains is private to rig.ts and anchors on humanoid joints;
//   - the humanoid rig's patterns, not its code: device-grid snapping (round(v * sc) / sc), allocation-free drawing
//     (every joint, the info object and the transform are rewritten in place), enter / leave light rotation and the
//     offscreen flash / tint pass.
//
// AGE (v2). Every stage draws through its greyed palette (build.palette = palettes.ts agedPalette), and the tone cache
// is seeded from dragonTones for every slot, so the cel tones on screen, the silvered highlight band included, are
// the ones tools/palette-check.ts measured (3.9). The elder's own parts are shared, drawn here and in parts.ts /
// faces.ts: the settled chest and the paunch, the grey muzzle and brow tuft, the inked beard (which the head's floor
// guard counts), the worn fangs, and the wing wear's whole-pixel hole and the far wing cut under the near wing's tears
// (2.9: holeFrame, stampHoleRing, clipOffTears).
import { rad, clamp } from '../../lib/engine/math.ts';
import { farPalette } from '../../lib/art/palettes.ts';
import type { Palette } from '../../lib/art/palettes.ts';
import { LIGHT_X, LIGHT_Y, RAMP, tones } from '../../lib/art/shading.ts';
import type { LightDir, Ramp, Tones } from '../../lib/art/shading.ts';
import type { PartRig, Point } from '../../lib/art/rigParts.ts';
import { pathTaperedCapsule } from '../../lib/art/shapes.ts';
import { getChain, stepChain, resetChain } from '../../lib/art/secondary.ts';
import type { Chain, ChainRig } from '../../lib/art/secondary.ts';
import { DRAGON_FAR, DRAGON_SHARED, DRAGON_SLOTS, dragonTones, moodTones, muzzleOf, tuftOf, beardOf, fanFrostOf } from './palettes.ts';
import type { DragonElement, DragonPalette } from './palettes.ts';
import { TAIL_CHAIN, grown } from './stages.ts';
import type { LegDims, Stage } from './stages.ts';
import { makeDragonPose, copyDragonPose, DFACE, ACT } from './pose.ts';
import type { DragonPose, PartialDragonPose } from './pose.ts';
import type { DragonBuild, DragonDims } from './build.ts';
import type { AnchorName, DragonInfo, ElementSpec, ElementStageParams, MarkingSpec } from './element.ts';
import {
  drawBody, pathBody, pathBelly, drawLeg, drawBatWing, drawNub, drawGroundShadow, drawTube, drawNeck,
  drawSkull, pathSkull, drawJaw, drawMouthInterior, mouthCorner, legRadii, jawTopAt, drawBeard, beardLow, fitBeard, wingHoleAt,
  armPanelHas, armBoneGap, pathWingTears, HOLE_PX, HOLE_RING, HOLE_RING_OPEN,
} from './parts.ts';
import { drawEye, drawBrow, drawBlush, faceBlushes, drawNostril, drawMouthMark, drawEggTooth, drawFangs, drawMuzzle } from './faces.ts';
import { drawHorn, hornOverlap, hornRise, hornRefClamped, drawDorsalRow, drawTailRing, drawMarkingPixels, markingPixel, backLineY } from './features.ts';
import { AmbientBudget, SOLO_BUDGET, drawZGlyph, drawStarGlyph, crumbAt, stepAlpha, Z_W, Z_H } from './fx.ts';
import type { TopPass } from './fx.ts';
import { animTuning } from './tuning.ts';
import type { AnimTuning } from './tuning.ts';

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
  /**
   * 1, or -1 while the head LOOKS BACK: pitched past vertical (pose.ts DragonPose.head), the head group is drawn
   * mirrored about the snout's own axis. Cranium space is then rotated by headAng as ever (the snout points where
   * the pitch aims it) and flipped in y, so the skull's top stays up. Every cranium -> root mapping multiplies
   * cranium y by it (cranToRootPt, enterCranium, enterFaceFromCranium), and face space runs mirrored in x.
   */
  headFlip: number;
  /**
   * The neck line as the head sees it: degrees BELOW straight back in cranium space of the last neck segment,
   * unsnapped (snapped nodes would jitter it by several degrees). Horns are authored relative to it (3.0). Babies,
   * whose neck hides under the head: 0 (straight back).
   */
  neckRef: number;
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
  /** Mouth-space origin (in the snout tip; with the jaw open, the middle of the opening) and rotation. */
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
  /**
   * Near palette (the stage's, greyed for its age: build.palette), far-leg palette (DRAGON_FAR.legs) and far wing /
   * far head palette (DRAGON_FAR.wingAndHead), both derived from it.
   */
  pal: Readonly<DragonPalette>;
  palLegFar: Readonly<DragonPalette>;
  palWingFar: Readonly<DragonPalette>;
  /** The engine-palette adapter (1.1) and its far version. */
  palette: Palette;
  paletteFar: Palette;
  hairStyle: string;
  scale: number;
  pxScale: number;
  /** Body-space constants: ball centres (the chest dims.chestLift px higher) and the belly line. */
  hipB: Point;
  chestB: Point;
  bellyY: number;
  /**
   * The belly-sag ellipse's y radius THIS frame (parts.ts pathBody): the baby's pot belly as authored; the elder's
   * paunch flattened where it meets the floor, and to its flat radius asleep (2.1: paunchRy).
   */
  sagRy: number;
  /** The stage's mood tones (palettes.ts moodTones of `pal`): the banked glow, water's dim spot. */
  moodT: Readonly<{ banked: string; dimSpot: string }>;
  /**
   * The elder face greys (2.5, palettes.ts muzzleOf / tuftOf / beardOf, of `pal`): the muzzle, the brow tuft (the
   * muzzle's grey but on the pale-muzzled water and rock), the beard; and slinkwing's frosted fan tips (fanFrostOf).
   * Derived for every stage, drawn on the elder.
   */
  greys: Readonly<{ muzzle: string; tuft: string; beard: string; fanFrost: string }>;
  /**
   * How much deeper the elder's beard hangs below its BEARD_UV shape on this head, px (parts.ts fitBeard, at build): so
   * a skull that hangs lower than the jaw (rock's boxy snout, dusk's short one) leaves 3 x 3 px of tuft in view. 0
   * before the elder.
   */
  beardDv: number;
  /**
   * The IK plant (pose leg `plant`), per leg in LEG_KEYS order, solved once at build: the rest ankle in ROOT space
   * (x, y pairs: where each paw stands), the rest FK reach of the two bones from the joint (x only: a pose's
   * upper / lower slide a planted paw by the change in it) and the side the middle joint bends to (+1 = forward:
   * the hind knee; -1 = back: the front elbow), so IK keeps the digitigrade Z the rest angles draw.
   */
  legRest: Float32Array;
  legReachX: Float32Array;
  legBend: Int8Array;
  /**
   * Markings' fitted anchors, per sp.markings entry, solved once on the first draw by fitMarkings: body markings'
   * body-space anchors (markBX / markBY; NaN = a tail marking), tail markings' fraction along the tail and nudge
   * across it (markT / markDY; NaN = a body marking) and how much of each shows at rest (0..1). A first marking hidden under the folded wing, a leg
   * root, the hip or a baby's head would break 2.7 and the mark floor.
   */
  markBX: Float32Array;
  markBY: Float32Array;
  markT: Float32Array;
  markDY: Float32Array;
  markVis: Float32Array;
  markFitted: boolean;
  /** The mouth corner in cranium space (parts.ts mouthCorner), where the mouth marks sit. */
  mouthC: Point;
  j: DragonJoints;
  tf: DragonTransform;
  facing: number;
  /** Steps taken (stepDragon calls): the clock for every procedural effect. */
  tick: number;
  /** Steps since the pet fell asleep (pose.sleep >= 0.5; 0 awake): the clock of the "z" glyphs. */
  sleepT: number;
  /** The shared anims' tuning for this element and stage (tuning.ts): the rig reads the sleep "z" schedule. */
  tune: AnimTuning;
  /** Resolved mood of the last draw (-1..1). */
  mood: number;
  /** True while drawing a flat silhouette (bible 5.1 #1). */
  silhouette: boolean;
  /** False while drawing without the far legs (DrawDragonOpts.farLegs: the leg-root audit). */
  farLegs: boolean;
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
  /** While `override` is set: keep the ink (`outline`) as it is and flatten only the rest (the element flash). */
  keepInk: boolean;
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
    hipB: { x: -d.gap / 2, y: 0 }, chestB: { x: d.gap / 2, y: -d.chestLift },
    // the belly line on a whole pixel (the body centre is snapped), so at rest the pigment edge is one crisp step
    // instead of a row of anti-aliased in-between tone
    bellyY: Math.round((-d.chestLift + d.chestR) - d.bellyFrac * d.chestR * 2),
    sagRy: d.sag ? d.sag.ry : 0,
    moodT: moodTones(pal),
    greys: { muzzle: muzzleOf(pal, build.element), tuft: tuftOf(pal, build.element), beard: beardOf(pal, build.element), fanFrost: fanFrostOf(pal, build.element) },
    beardDv: 0,
    legRest: f32(8), legReachX: f32(4), legBend: new Int8Array(4),
    markBX: f32(build.sp.markings.length).fill(NaN), markBY: f32(build.sp.markings.length).fill(NaN),
    markT: f32(build.sp.markings.length).fill(NaN), markDY: f32(build.sp.markings.length).fill(NaN), markVis: f32(build.sp.markings.length), markFitted: false, mouthC: pt(),
    j: {
      body: pt(), bodyAng: 0, hip: pt(), chest: pt(), legs: [legJ(), legJ(), legJ(), legJ()],
      neckN: nn, neckX: f32(nn + 1), neckY: f32(nn + 1), neckR: f32(nn + 1), neckVX: f32(nn + 1), neckVY: f32(nn + 1),
      cran: pt(), headAng: 0, headFlip: 1, neckRef: 0, jaw: 0, eye: pt(),
      tailN: tn, tailX: f32(tn + 1), tailY: f32(tn + 1), tailR: f32(tn + 1), tailBX: f32(tn + 1), tailBY: f32(tn + 1),
      tailVX: f32(tn + 1), tailVY: f32(tn + 1), tailA: f32(tn), tipAng: 0, rump: pt(),
      wingN: pt(), wingF: pt(), wingAngN: 0, wingAngF: 0, mouth: pt(), mouthAng: 0, top: 0,
    },
    tf: { x: 0, y: 0, fs: 1, ss: 1, rx: 0, ry: 0, c: 1, s: 0, rot: 0 },
    facing: 1, tick: 0, sleepT: 0, tune: animTuning(build.stage, build.spec), mood: 0, silhouette: false, farLegs: true,
    info: {
      anchor: 'ambient', element: build.element, stage: build.stage, far: false, pal, near: pal, mood: 0, asleep: false,
      tick: 0, seed: build.seed, sp: build.sp, r: 0, len: 0, ang: 0,
      eye: { x: d.head.eye.x, y: d.head.eye.y, w: d.head.eye.w + 2, h: d.head.eye.h + 2 },
      bond: 1, wary: 0, charge: 0,
    },
    top: null, budget: SOLO_BUDGET, slot: 0,
    tones: new Map(), ramp: { ...RAMP }, override: null, keepInk: false, shading: true,
    col(hex: string): string { return rig.override && !(rig.keepInk && hex === rig.outline) ? rig.override : hex; },
    light: { x: LIGHT_X, y: LIGHT_Y }, outline: DRAGON_SHARED.outline, ow: 1, contactAlpha: 0, tonesN: 3,
    thinR: null, hiMin: null, flatR: null,
    chains: {}, tailChain: null as unknown as Chain, tailHeld: f32(tn), scratch: makeDragonPose(),
  };
  // the paws' rest spots: FK of the rest angles from each joint at the rest body height (near paws land on
  // y = -pawH, i.e. their soles on the ground; far paws 2 px higher: 1.5)
  for (let i = 0; i < 4; i++) {
    const front = i === 1 || i === 3, far = i >= 2, L = front ? d.front : d.hind;
    const jx = legJointX(d, front, far), jy = L.y + (far ? -2 : 0);
    const up = rad(L.restUpper), lo = rad(L.restUpper + L.restLower + (front ? d.frontFix : 0));
    const rx = Math.sin(up) * L.upper + Math.sin(lo) * L.lower, ry = Math.cos(up) * L.upper + Math.cos(lo) * L.lower;
    rig.legRest[i * 2] = jx + rx; rig.legRest[i * 2 + 1] = -d.bodyY + jy + ry;
    rig.legReachX[i] = rx;
    // which side of the joint -> ankle line the rest thigh lies on; a straight leg bends like its pair's rest
    const side = L.restUpper - Math.atan2(rx, ry) * 180 / Math.PI;
    rig.legBend[i] = Math.abs(side) > 0.5 ? (side > 0 ? 1 : -1) : front ? -1 : 1;
  }
  // every slot's cel tones seed the tone cache from dragonTones at the rig's stage (3.9): the aged colours' ramp, the
  // scale's highlight silvered (the silver back and crown of an adult and an elder) and an element's hand-set shadow
  // tones (palettes.ts DRAGON_SHADOW: rock's warm sand and cream) greyed with their slot, so every shaded part
  // (celPath, the belly band, the head) takes them through tones() and the check's colours are the ones on screen
  for (const s of DRAGON_SLOTS) rig.tones.set(pal[s], dragonTones(build.element, s, rig.ramp, build.stage));
  mouthCorner(rig, rig.mouthC);
  // the elder's beard hangs deep enough to show 3 x 3 px of tuft under this head's skull (2.5, 5.2)
  if (build.stage === 'elder') rig.beardDv = fitBeard(rig);
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

/** Body-space x of a leg joint: out at gap/2 + X (2.1 note); far legs splay 4 px (front ahead, hind behind: 1.5). */
function legJointX(d: DragonDims, front: boolean, far: boolean): number {
  const L = front ? d.front : d.hind;
  return (front ? 1 : -1) * (d.gap / 2 + L.X) + (far ? (front ? 4 : -4) : 0);
}

/**
 * Two-bone IK in the leg convention (angles from straight down, + forward): bones `a` then `b` from (rx, ry) toward
 * (tx, ty), the middle joint on side `bend` (+1 forward, -1 back). A target just out of reach stretches both bones
 * by up to `stretch` px in total (a pixel of stretch is invisible; a paw hovering a pixel over its shadow is not);
 * beyond that the leg points straight at it and the paw lifts short. A too-near target folds to the limit. Writes
 * absolute degrees into lg.upper / lg.lower and unsnapped knee / ankle. Engine candidate: a generic 2-bone solver
 * for the humanoid computeJoints too.
 */
export function solveTwoBone(lg: DLegJoints, rx: number, ry: number, tx: number, ty: number, a0: number, b0: number, bend: number, stretch = 1): void {
  const dx = tx - rx, dy = ty - ry, D = Math.hypot(dx, dy);
  const k = D > a0 + b0 ? Math.min(D, a0 + b0 + stretch) / (a0 + b0) : 1, a = a0 * k, b = b0 * k;
  const Dc = clamp(D, Math.abs(a - b) + 1e-3, a + b - 1e-4);
  const base = Math.atan2(dx, dy);
  const A = Math.acos(clamp((a * a + Dc * Dc - b * b) / (2 * a * Dc), -1, 1));
  const up = base + bend * A;
  const kx = rx + Math.sin(up) * a, ky = ry + Math.cos(up) * a;
  const lo = Math.atan2(tx - kx, ty - ky);
  lg.upper = up * 180 / Math.PI; lg.lower = lo * 180 / Math.PI;
  lg.knee.x = kx; lg.knee.y = ky;
  lg.ankle.x = kx + Math.sin(lo) * b; lg.ankle.y = ky + Math.cos(lo) * b;
}

// ---------- the floor (1.1 planted paws, 5.1 #14) ----------

/**
 * How far the head's lowest point (the cranium, the snout's two ends, the jaw's hinge and its tip at the solved
 * opening) is under the floor, px (<= 0: clear). Reads J.cran and J.jaw; (hc, hs) = the head angle's cos / sin.
 */
function headSink(rig: DragonRig, hc: number, hs: number): number {
  const J = rig.j, H = rig.dims.head, s = H.snout, jw = H.jaw, cx = J.cran.x, cy = J.cran.y, f = J.headFlip;
  const ja = rad(J.jaw), tx = jw.tx - jw.hx, ty = jw.ty - jw.hy, hy = jw.hy + (J.jaw ? jw.drop : 0);
  const sink = Math.max(cy + clr(H.cranR) - floorY(cx), sinkAt(cx, cy, hc, hs, s.x0, f * s.y0, s.r0), sinkAt(cx, cy, hc, hs, s.x1, f * s.y1, s.r1),
    sinkAt(cx, cy, hc, hs, jw.hx, f * hy, jw.r0),
    sinkAt(cx, cy, hc, hs, jw.hx + tx * Math.cos(ja) - ty * Math.sin(ja), f * (hy + tx * Math.sin(ja) + ty * Math.cos(ja)), jw.r1));
  // the elder's beard hangs under the chin (1.2): the head lifts by its lowest point too, and a sleeping elder rests
  // its chin on its beard (without it EL's prototype sank 2 to 4 px in the sleep, the wake and the eat)
  if (rig.stage !== 'elder') return sink;
  beardLow(rig, J.jaw, BL);
  return Math.max(sink, sinkAt(cx, cy, hc, hs, BL.x, f * BL.y, 0.5));
}
const BL: Point = { x: 0, y: 0 };
/** How far a circle (x, y, r) of cranium space (centre cx, cy; head angle cos / sin hc, hs) is under the floor. */
function sinkAt(cx: number, cy: number, hc: number, hs: number, x: number, y: number, r: number): number {
  const X = cx + x * hc - y * hs, Y = cy + x * hs + y * hc;
  return Y + clr(r) - floorY(X);
}

/**
 * The real floor in ROOT space for the pose being solved. root.y lifts the whole sprite and root.rot turns it about
 * the ground point, so the floor (screen y = 0) is the line ry + x sin(rot) + y cos(rot) = 0 in root space: level at
 * y = -root.y for an upright sprite, tilted under a waddle or a topple.
 */
const FLOOR = { ry: 0, s: 0, c: 1, off: false };
function setFloor(pose: DragonPose): void {
  const a = rad(pose.root.rot);
  FLOOR.ry = pose.root.y; FLOOR.s = Math.sin(a); FLOOR.c = Math.cos(a) || 1e-6;
  // tumbling (root.rot past 60 deg) or flipped upside down (stretch < 0: rock's roll onto its back), "down" in
  // root space is not toward the floor: the guards stand aside and the anim places the sprite (the floor audit
  // still checks it)
  FLOOR.off = pose.stretch < 0 || Math.abs(pose.root.rot) > 60;
}
/** Root-space y of the floor at root x (+Infinity while the guards stand aside). */
function floorY(x: number): number { return FLOOR.off ? Infinity : -(FLOOR.ry + x * FLOOR.s) / FLOOR.c; }
/**
 * The root-space height a circle of radius r needs above the floor line to clear it: r on a level floor, r / cos
 * under a root rotation (the floor line is tilted in root space, and measured straight down a circle clears it by
 * less than its radius: 0.8 px short at 23 deg on an adult hip).
 */
function clr(r: number): number { return r / Math.abs(FLOOR.c); }
/** Snap y to the device grid, stepping up a pixel if rounding put it below `lim` (a floor-resting limit). */
function snapAbove(y: number, lim: number): number {
  const v = S(y);
  return v > lim + 0.05 ? v - 1 / G : v;
}

const LRS = new Float32Array(3);
/** Unsnapped root-space tail nodes (computeDragonJoints' scratch; 16 >= any tail's n + 1). */
const TX = new Float32Array(16), TY = new Float32Array(16);
/**
 * Keep a solved leg (unsnapped, root space) out of the floor. The paw stands ON it: an ankle below it (an FK swing,
 * a tilted toe) is re-solved to it. The middle joint's tube stays above it: when the body sinks low enough to push
 * an elbow or a knee through the floor (the sleeping crouch, a chest pitched down), the joint lies ON the floor on
 * the side it bends to, and the lower bone folds flat along the floor toward where the paw was going -- the sphinx
 * forearm, elbow back and paw forward under the chin; a hind shin folds back under the thigh. `tilt` is the paw's
 * screen tilt (deg, + toe down); `turned` = a root rotation is on (drawLeg then hangs the paw box from a heel point).
 */
function floorLeg(lg: DLegJoints, L: Readonly<LegDims>, rx: number, ry: number, tx: number, bend: number, tilt: number, turned: boolean): void {
  // the sole's lowest corner under the ankle, in screen px: the toe's corner dips w sin(tilt); under a root rotation
  // the box hangs from a heel point rC back along the paw (parts.ts drawLeg), which a toe-up tilt lowers rC sin
  legRadii(L.r1, L.r2, L.bulge, LRS);
  const a = rad(tilt), dip = L.pawH * Math.cos(a) + Math.max(0, L.pawW * Math.sin(a)) - (turned ? LRS[2] * Math.sin(a) : 0);
  const need = clr(dip);
  const ay = floorY(lg.ankle.x) - need;
  if (lg.ankle.y > ay + 0.01) solveTwoBone(lg, rx, ry, lg.ankle.x, ay, L.upper, L.lower, bend);
  const ky0 = floorY(lg.knee.x) - clr(LRS[1]);
  if (lg.knee.y <= ky0 + 0.01) return;
  const side = lg.knee.x < rx - 0.01 ? -1 : lg.knee.x > rx + 0.01 ? 1 : bend;
  const dy = clamp(ky0 - ry, -L.upper, L.upper);
  const kx = rx + side * Math.sqrt(Math.max(0, L.upper * L.upper - dy * dy)), ky = ry + dy;
  const dir = tx >= kx ? 1 : -1, ey = floorY(kx) - need, ddy = clamp(ey - ky, -L.lower, L.lower);
  const ex = kx + dir * Math.sqrt(Math.max(0, L.lower * L.lower - ddy * ddy));
  lg.knee.x = kx; lg.knee.y = ky; lg.ankle.x = ex; lg.ankle.y = ky + ddy;
  lg.upper = Math.atan2(kx - rx, ky - ry) * 180 / Math.PI;
  lg.lower = Math.atan2(ex - kx, ddy) * 180 / Math.PI;
}

/**
 * The four legs for body y `byU` (unsnapped root space) and body pitch cos / sin (bc, bs) into rig.j.legs (the leg
 * block of computeDragonJoints, below). Returns how far the lowest thigh ball is under the floor (<= 0: clear).
 */
function solveLegs(rig: DragonRig, pose: DragonPose, byU: number, bc: number, bs: number): number {
  const d = rig.dims, J = rig.j, rr = rad(pose.root.rot), rc = Math.cos(rr), rsn = Math.sin(rr);
  let sink = -1e9;
  for (let i = 0; i < 4; i++) {
    const front = i === 1 || i === 3, far = i >= 2;
    const L = front ? d.front : d.hind, lg = J.legs[i], p = pose[LEG_KEYS[i]];
    const jx = legJointX(d, front, far) + p.shift, jy = L.y + (far ? -2 : 0);
    toRoot(rig, jx, jy, lg.root);
    const rx = jx * bc - jy * bs, ry = byU + jx * bs + jy * bc;
    const up = L.restUpper + p.upper, lo = up + L.restLower + (front ? d.frontFix : 0) + p.lower;
    const su = Math.sin(rad(up)) * L.upper, sl = Math.sin(rad(lo)) * L.lower;
    const w = clamp(p.plant, 0, 1);
    lg.paw = p.paw - pose.root.rot * w;
    let tx: number;
    if (w > 0) {
      const fx = rx + su + sl, fy = ry + Math.cos(rad(up)) * L.upper + Math.cos(rad(lo)) * L.lower;
      const gx = rig.legRest[i * 2] + (su + sl - rig.legReachX[i]) + p.slide + p.shift, gy = rig.legRest[i * 2 + 1] - p.lift;
      const px = gx * rc + gy * rsn, py = -gx * rsn + gy * rc;
      tx = fx + (px - fx) * w;
      solveTwoBone(lg, rx, ry, tx, fy + (py - fy) * w, L.upper, L.lower, rig.legBend[i]);
    } else {
      lg.upper = up; lg.lower = lo;
      lg.knee.x = rx + su; lg.knee.y = ry + Math.cos(rad(up)) * L.upper;
      lg.ankle.x = lg.knee.x + sl; lg.ankle.y = lg.knee.y + Math.cos(rad(lo)) * L.lower;
      tx = lg.ankle.x;
    }
    floorLeg(lg, L, rx, ry, tx, rig.legBend[i], lg.paw + pose.root.rot, pose.root.rot !== 0);
    // the thigh ball: drawLeg's sunk root, r1 * 0.35 down the upper bone, radius LR[0]
    const kx = lg.knee.x - rx, ky = lg.knee.y - ry, kl = Math.hypot(kx, ky) || 1, sk = L.r1 * 0.35;
    legRadii(L.r1, L.r2, L.bulge, LRS);
    sink = Math.max(sink, ry + ky / kl * sk + clr(LRS[0]) - floorY(rx + kx / kl * sk));
    // snapped to the device grid (never down through the floor), except under a root rotation: the whole sprite is
    // turned off the grid then, and a snapped ankle would land up to half a pixel off the floor once rotated
    // (the ankle's limit is the sole's lowest corner, the tilted toe's too: floorLeg's `dip`. Held to the flat paw's
    // height, a swing's hanging toe on the elder's low 2 px lift rounded half a pixel into the floor)
    if (!pose.root.rot) {
      const ta = rad(lg.paw), dip = L.pawH * Math.cos(ta) + Math.max(0, L.pawW * Math.sin(ta));
      lg.knee.x = S(lg.knee.x); lg.knee.y = snapAbove(lg.knee.y, floorY(lg.knee.x) - clr(LRS[1]));
      lg.ankle.x = S(lg.ankle.x); lg.ankle.y = snapAbove(lg.ankle.y, floorY(lg.ankle.x) - dip);
    }
  }
  return sink;
}

/**
 * The belly-sag ellipse's y radius this frame, into rig.sagRy. The baby's pot belly keeps its authored radius (its bun
 * rests ON it). The elder's PAUNCH (2.1) is soft: where it would meet the floor it flattens against it, down to
 * `flatRy`, before the floor guard lifts the body, and asleep it lies flat (`flatRy`, 1.5): an old dragon's belly
 * settles on the straw, it does not stand the body up on a ball. Reads J.body.y (unlifted), the pitch's cos / sin.
 */
function paunchRy(rig: DragonRig, pose: DragonPose, bc: number, bs: number): void {
  const sag = rig.dims.sag;
  if (!sag) return;
  if (sag.flatRy == null) { rig.sagRy = sag.ry; return; }
  // room between the paunch's centre and the floor, less the 1 px a resting belly keeps off it (sleep's settle)
  const room = floorY(-sag.cy * bs) - (rig.j.body.y + sag.cy * bc) - 1;
  rig.sagRy = Math.max(sag.flatRy, Math.min(pose.sleep >= 0.5 ? sag.flatRy : sag.ry, room));
}

/** Solve every joint for a fully populated pose into rig.j (root space, device-grid snapped). */
export function computeDragonJoints(rig: DragonRig, pose: DragonPose): DragonJoints {
  const d = rig.dims, J = rig.j, sp = rig.sp;
  G = rig.pxScale || 1;
  J.bodyAng = pose.body.rot;
  J.body.x = 0; J.body.y = S(-d.bodyY + pose.body.y);
  const bc = Math.cos(rad(J.bodyAng)), bs = Math.sin(rad(J.bodyAng));
  setFloor(pose);
  paunchRy(rig, pose, bc, bs);
  // the floor: a settled body (a sleeper's belly, the baby's pot belly in its bun) rests ON it -- the lowest of the
  // hip ball, the chest ball and the belly sag, pitched; rounding the body onto the grid must not sink it either
  const hb = J.body.y + rig.hipB.x * bs + rig.hipB.y * bc + clr(d.hipR) - floorY(rig.hipB.x * bc);
  const cb = J.body.y + rig.chestB.x * bs + rig.chestB.y * bc + clr(d.chestR) - floorY(rig.chestB.x * bc);
  // (the sag is an ellipse: pitched, and on a tilted floor, its extent along the floor's normal grows toward rx)
  const sa = rad(J.bodyAng + pose.root.rot), sag = d.sag;
  const sb = sag ? J.body.y + sag.cy * bc + clr(Math.hypot(sag.rx * Math.sin(sa), rig.sagRy * Math.cos(sa))) - floorY(-sag.cy * bs) : -1e9;
  const bodySink = Math.max(hb, cb, sb), bodyLift = bodySink > 0.01 ? Math.ceil(bodySink * G - 0.01) / G : 0;
  J.body.y -= bodyLift;
  toRoot(rig, rig.hipB.x, rig.hipB.y, J.hip); toRoot(rig, rig.chestB.x, rig.chestB.y, J.chest);

  // ---- legs: joints ride the body; a PLANTED paw stays where it stands (2.1: paws exactly on y = 0) ----
  // FK first (absolute angles: a body pitch never swings the legs). With plant > 0 the ankle's target is its rest
  // spot, slid along the ground by what the pose's upper / lower do to the FK reach, and the two bones are solved
  // to it by IK -- so a bob, a dip, a crouch or a pitch bends the knees instead of lifting the paws off the floor.
  // The bones are solved from the UNSNAPPED joint and only the results snapped: a nearly straight leg (a baby's
  // 4 + 4 px) shortened by half a pixel of rounding folds its knee out by 1-2 px.
  // A plant spot is a GROUND spot: pose.root.rot turns the whole sprite about the ground point, so the targets are
  // counter-rotated into root space (and the paw box levelled), or a waddle keyed as root rot (4.2: baby +-4 deg)
  // would drive one paw through the floor and lift the other. root.x / root.y still move the whole sprite, paws
  // included: bob with body.y, and key root.y only for airborne frames (with plant 0 or a lift that tucks the legs).
  // `slide` / `lift` move the planted target itself, in px (a gait's stance stroke and its swing: pose.ts).
  const byU = -d.bodyY + pose.body.y - bodyLift, thigh = solveLegs(rig, pose, byU, bc, bs);
  if (thigh > 0.01) {
    // a thigh ball through the floor (a heavy-legged look tipped back onto its rump): lift the body clear, solve again
    const lift = Math.ceil(thigh * G - 0.01) / G;
    J.body.y -= lift;
    toRoot(rig, rig.hipB.x, rig.hipB.y, J.hip); toRoot(rig, rig.chestB.x, rig.chestB.y, J.chest);
    solveLegs(rig, pose, byU - lift, bc, bs);
  }

  // ---- neck: FK from the chest, elevations relative to the body ----
  const N = d.neck, nn = N.n;
  let off = 0;
  const r0 = N.r0, r1 = N.r1;
  const rootX = N.root[0], rootY = N.root[1];
  let x = J.body.x + rootX * bc - rootY * bs, y = J.body.y + rootX * bs + rootY * bc;
  let lastElev = 0;
  for (let k = 0; k < nn; k++) {
    off += k === 0 ? pose.neck.a0 : pose.neck.a1;
    lastElev = N.rest[k] - off - J.bodyAng;
    const e = rad(lastElev), ux = Math.cos(e), uy = -Math.sin(e);
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
  // the neck line seen from the cranium: back along the last segment (elevation e) is e below straight back in
  // root space, and the head's own pitch (+ = snout down) adds to that in cranium space
  J.neckRef = N.hidden ? 0 : lastElev + J.headAng;
  // LOOKING BACK: a head pitched past vertical (snout up and back: fire's flame chase, spike's grooming) is a head
  // turned round over the shoulder, a yaw a pitch cannot draw -- tipped over, its skull's top faced down, the horns
  // lay down the throat and a round baby head read face-on. It is drawn mirrored about the snout's own axis instead:
  // cranium space turned by the same angle and flipped in y (the snout exactly where the pitch aims it, so nothing
  // jumps as it passes vertical), the skull's top up, the horns keeping their rest lie on the skull (along the neck
  // line they would hang down the throat of a head turned round)
  const hf = J.headAng < -90 && J.headAng > -270 ? -1 : 1, fy = hf;
  J.headFlip = hf;
  if (hf < 0) J.neckRef = N.hidden ? 0 : N.rest[nn - 1] + N.headPitch;
  const hc = Math.cos(rad(J.headAng)), hs = Math.sin(rad(J.headAng));
  const ex = J.neckX[nn], ey = J.neckY[nn];
  J.cran.x = S(ex + H.fromNeck[0] * hc - fy * H.fromNeck[1] * hs); J.cran.y = S(ey + H.fromNeck[0] * hs + fy * H.fromNeck[1] * hc);
  // An open jaw is 0 or >= the stage minimum (1.2): below that the wedge shows neither mouth nor tongue. A look with
  // a parted opening (jawPart: dusk's blow) holds it from half of it up to it, and draws it without tongue or fangs
  const jw = pose.jaw, jp = H.jawPart ?? 0;
  J.jaw = jp && jw >= jp * 0.5 && jw <= jp ? jp : jw < H.jawMin * 0.5 ? 0 : clamp(jw, H.jawMin, H.jawMax);
  // the floor: a head lowered to it (the sleeping chin, a bow, a nod) RESTS on it. neckFit aims the jaw's hinge at
  // the floor, but a head pitched snout-down puts the jaw tip lower, and a lie-down passes through it on the way:
  // the head and the neck's end lift by whole device pixels until no part of the skull or jaw is under the floor
  const sink = headSink(rig, hc, hs);
  if (sink > 0.01) {
    const up = Math.ceil(sink * G - 0.01) / G;
    J.cran.y -= up;
    for (let k = 1; k <= nn; k++) J.neckY[k] = S(J.neckY[k] - up * (k / nn));
  }
  J.eye.x = J.cran.x + H.eye.x * hc - fy * H.eye.y * hs; J.eye.y = J.cran.y + H.eye.x * hs + fy * H.eye.y * hc;
  J.top = J.cran.y - H.cranR - H.brow;
  // the mouth anchor: in the snout tip closed; OPEN, the middle of the opening -- halfway between the upper jaw line
  // at the tip and the jaw's tip (its top edge) -- so a stream leaves the mouth, not the snout top 2-3 px above it
  let mx = H.snout.x1, my = H.snout.y1 + H.snout.r1 * 0.5;
  if (J.jaw > 0) {
    jawTopAt(rig, J.jaw, 1, MO);
    mx = (H.snout.x1 + MO.x) / 2; my = (H.snout.y1 + H.snout.r1 * 0.9 + MO.y) / 2;
  }
  J.mouth.x = J.cran.x + mx * hc - fy * my * hs; J.mouth.y = J.cran.y + mx * hs + fy * my * hc;
  // the breath leaves along the SNOUT line, never more than 10 deg below level (5.4: it points away from its own
  // body; 5.1 #14): along the jaw's bisector a head keyed forward sent every stream 35-40 deg into the floor
  // (looking back, the snout points back: -180 is straight back, -190 10 deg below it)
  J.mouthAng = hf > 0 ? Math.min(J.headAng, 10) : Math.max(J.headAng, -190);

  // ---- tail: rest shape + pose + chain, from the hip (root: hip centre + (-hipR + sink, -1)) ----
  const T = d.tail, tn = T.n, rest = d.tailRest, ch = rig.tailChain;
  const held = rig.spec.tailHold ? rig.tailHeld : ch.ang;
  let bx = rig.hipB.x - d.hipR + T.sink, by = rig.hipB.y - 1;
  J.tailBX[0] = bx; J.tailBY[0] = by;
  toRoot(rig, bx, by, J.rump);
  let acc = 0, tau = 0;
  const loose = 1 - clamp(Math.max(pose.tail.stiff, sp.tailStiff || 0), 0, 1);
  // (a look that keeps its tail low takes only `tailRise` of any swing that would lift it ABOVE its rest line, on the
  // body or in the world -- the pose's lift and sway, and the chest-down pitch that raises a tail riding it -- and all
  // of the droop, whichever is lower: water's fluke, 3.0, which the happy's lift, the wags' upswing, the bite's bow and
  // the wake's play-bow carried to head height, fire's "U" at / 3: cast review v2. At rise 1 both are the pose's swing)
  const rise = sp.tailRise ?? 1, pitch = J.bodyAng + pose.root.rot, sw = pose.tail.lift + pose.tail.sway, sww = sw - pitch;
  const up = Math.max(sw < 0 ? sw * rise : sw, (sww < 0 ? sww * rise : sww) + pitch);
  const curl = pose.tail.curl < 0 ? pose.tail.curl * rise : pose.tail.curl;
  for (let k = 0; k < tn; k++) {
    acc += held[k] * loose;
    // (the chain's follow-through too: its lift over the rest line at `rise`, its droop whole)
    tau = rest.first + up + k * (rest.bend + curl) - (acc > 0 ? acc * rise : acc);
    J.tailA[k] = tau - J.bodyAng;
    const a = rad(tau);
    bx += -Math.cos(a) * T.len; by += Math.sin(a) * T.len;
    J.tailBX[k + 1] = bx; J.tailBY[k + 1] = by;
  }
  // root space, unsnapped: TX / TY. Then the floor (1.1, 5.1 #14). A segment whose end would sink LIES ON the floor:
  // the node lands on the floor at the same segment length, further along the direction it was going, and every
  // node after it follows -- so a tail that reaches the floor runs on along it (a sleeper's tail wrapping forward, a
  // drooped tail trailing back), never through it. Then a tail-tip feature that hangs below the tip (a fluke's lower
  // lobe: sp.tipBox) lifts the tail's END clear of the floor, the lift spread along the tail as (k / n)^2 so the end
  // curls up instead of kinking.
  for (let k = 0; k <= tn; k++) {
    J.tailR[k] = d.tailR0 + (d.tailR1 - d.tailR0) * (k / tn);
    TX[k] = J.body.x + J.tailBX[k] * bc - J.tailBY[k] * bs; TY[k] = J.body.y + J.tailBX[k] * bs + J.tailBY[k] * bc;
  }
  // (a segment that meets the floor nearly head-on, steeper than ~70 deg, keeps the way the tail was already
  // running along the floor: laid the way its own last 1-2 px of x pointed, a curl's tip folded back into a hairpin)
  let moved = false, ox = TX[0], oy = TY[0], run = -1;
  for (let k = 1; k <= tn; k++) {
    const sx = TX[k] - ox, sy = TY[k] - oy;
    ox = TX[k]; oy = TY[k];
    let x = TX[k - 1] + sx, y = TY[k - 1] + sy;
    const lim = floorY(x) - clr(J.tailR[k]);
    if (y > lim) {
      const dy = lim - TY[k - 1], dir = Math.abs(sx) >= 0.35 * T.len ? (sx < 0 ? -1 : 1) : run;
      if (Math.abs(dy) < T.len) x = TX[k - 1] + dir * Math.sqrt(T.len * T.len - dy * dy);
      y = floorY(x) - clr(J.tailR[k]);
      moved = true;
    }
    if (x !== TX[k - 1]) run = x < TX[k - 1] ? -1 : 1;
    TX[k] = x; TY[k] = y;
  }
  const box = sp.tipBox;
  if (box) {
    const ta = Math.atan2(TY[tn] - TY[tn - 1], -(TX[tn] - TX[tn - 1])), tc = Math.cos(-ta), ts = Math.sin(-ta);
    let lift = 0;
    for (let c = 0; c < 4; c++) {
      const bx = box[c & 1 ? 2 : 0], byy = box[c & 2 ? 3 : 1];
      lift = Math.max(lift, TY[tn] + bx * ts + byy * tc - floorY(TX[tn] + bx * tc - byy * ts));
    }
    if (lift > 0) { for (let k = 1; k <= tn; k++) TY[k] -= lift * (k / tn) * (k / tn); moved = true; }
  }
  if (moved) {
    // the drawn tail is the clamped one: its segment angles (the tip space, the underside normals, ring markings)
    // and its body-space copy (spike's tail quills, the dorsal line) follow it
    for (let k = 0; k < tn; k++) J.tailA[k] = Math.atan2(TY[k + 1] - TY[k], -(TX[k + 1] - TX[k])) * 180 / Math.PI;
    for (let k = 1; k <= tn; k++) {
      const X = TX[k] - J.body.x, Y = TY[k] - J.body.y;
      J.tailBX[k] = X * bc + Y * bs; J.tailBY[k] = -X * bs + Y * bc;
    }
  }
  J.tailX[0] = J.rump.x; J.tailY[0] = J.rump.y;
  for (let k = 0; k <= tn; k++) {
    // snapped, but never DOWN through the floor: Math.round(-1.5) is -1, which sank a 1.5 px tip half a pixel
    if (k > 0) { J.tailX[k] = S(TX[k]); J.tailY[k] = snapAbove(TY[k], floorY(J.tailX[k]) - clr(J.tailR[k])); }
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
export function leave(ctx: CanvasRenderingContext2D, rig: DragonRig): void { ctx.restore(); setLight(rig, 0); }
/**
 * Push CRANIUM space (the head anchors): at the cranium centre, turned by the head angle, and flipped in y while the
 * head looks back (J.headFlip), the light flipped with it. Pair with leave().
 */
export function enterCranium(ctx: CanvasRenderingContext2D, rig: DragonRig): void {
  const J = rig.j;
  enter(ctx, rig, J.cran.x, J.cran.y, J.headAng);
  if (J.headFlip < 0) { ctx.scale(1, -1); rig.light.y = -rig.light.y; }
}
/**
 * Point rig.light at the light in a local space turned `angDeg` from root space. A sprite flipped upside down
 * (pose.stretch < 0: rock's roll onto its back) keeps its light top-left on screen: the light's y flips with it.
 */
export function setLight(rig: DragonRig, angDeg: number): void {
  const c = Math.cos(rad(angDeg)), s = Math.sin(rad(angDeg)), ly = rig.tf.ss < 0 ? -LIGHT_Y : LIGHT_Y;
  rig.light.x = LIGHT_X * c + ly * s; rig.light.y = -LIGHT_X * s + ly * c;
}

/**
 * Enter FACE space from root space: origin at root point (X, Y) snapped to a whole device pixel, one unit = one
 * sprite pixel, mirrored by facing, but never rotated by the root or squashed -- the eye is a pixel construction
 * (faces.ts). Pair with ctx.restore().
 */
export function enterFace(ctx: CanvasRenderingContext2D, rig: DragonRig, X: number, Y: number): void {
  ctx.save();
  faceTransform(ctx, rig, X, Y);
}
/**
 * The face's x mirror while the head group is drawn: J.headFlip (-1 while the head looks back, so its face marks
 * mirror with it), else 1. drawHeadGroup, drawHeadFeatures and clipOffEye set it round their face-space work.
 */
let FACE_FLIP = 1;
/** enterFace's transform, without the save: root space -> face space at root point (X, Y). */
function faceTransform(ctx: CanvasRenderingContext2D, rig: DragonRig, X: number, Y: number): void {
  const t = rig.tf;
  const dx = t.fs * (t.rx + X * t.c - Y * t.s), dy = t.ss * (t.ry + X * t.s + Y * t.c);
  ctx.rotate(-rad(t.rot)); ctx.translate(-t.rx, -t.ry); ctx.scale(1 / t.fs, 1 / t.ss);
  ctx.translate(Math.round(dx), Math.round(dy));
  // (flipped upside down, the face flips with the head it sits on; mirrored -- facing -1, or a squash < 0 in a turn
  // in place -- it mirrors with the sprite, so a nostril ahead of the eye stays on the snout; and with a head that
  // looks back)
  ctx.scale(Math.sign(t.fs) * FACE_FLIP * rig.pxScale, t.ss < 0 ? -rig.pxScale : rig.pxScale);
}

/**
 * enterFace for a renderer running in CRANIUM space (the head anchors: farHead, nearHead, headMarkings): walks the
 * transform back out of cranium space first, then enters face space at root point (X, Y). Face space is where a
 * pixel construction on the head (a mask, a rib) stays device-aligned whatever the head's pitch. Pair with ONE
 * ctx.restore(). The clip in force (the skull, the eye exclusion) is kept.
 */
export function enterFaceFromCranium(ctx: CanvasRenderingContext2D, rig: DragonRig, X: number, Y: number): void {
  const J = rig.j;
  ctx.save();
  if (J.headFlip < 0) ctx.scale(1, -1);
  ctx.rotate(-rad(J.headAng)); ctx.translate(-J.cran.x, -J.cran.y);
  faceTransform(ctx, rig, X, Y);
}

/**
 * enterFace from ANY anchor space entered at root point (ox, oy) rotated `angDeg` (a renderer's info.ang: the tail
 * tip's J.tipAng, the body's J.bodyAng...): walks the transform back to root space, then enters face space at root
 * point (X, Y). Undo any rotation of your own first. Pair with ONE ctx.restore(); the clip in force is kept, so a
 * 2 px ray clipped to a fluke stays device-aligned whatever the tail's angle (features.ts pixelStroke).
 */
export function enterFaceFromLocal(ctx: CanvasRenderingContext2D, rig: DragonRig, ox: number, oy: number, angDeg: number, X: number, Y: number): void {
  ctx.save();
  ctx.rotate(-rad(angDeg)); ctx.translate(-ox, -oy);
  faceTransform(ctx, rig, X, Y);
}

/** A point of an anchor space entered at root (ox, oy) rotated `angDeg` -> root space, into `out`. */
export function localToRootPt(ox: number, oy: number, angDeg: number, x: number, y: number, out: Point): Point {
  const c = Math.cos(rad(angDeg)), s = Math.sin(rad(angDeg));
  out.x = ox + x * c - y * s; out.y = oy + x * s + y * c;
  return out;
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
  /** The pet's bond 0..1 (DragonInfo.bond: rock's crystal count grows with it, 3.4). Omitted = 1. */
  bond?: number;
  /**
   * 0..1, eased: how wary the pet is of the nearest OTHER dragon (DragonInfo.wary: spike's wary lean, 4.3). The owner
   * measures the gap to the nearest other pet, latches it with hysteresis (on under 30 px, off over 36) and eases it
   * over about 8 f (gallery.ts stepWary). Omitted = 0.
   */
  wary?: number;
  /** 0..1: lightning's boredom charge (DragonInfo.charge, 3.5). Omitted = 0. */
  charge?: number;
  /**
   * false = leave the far legs out: the leg-root audit (gallery view=roots) measures what their sunk roots must lie
   * in -- the rest of the silhouette drawn over them (1.2 hard rule: roots sunk into the body). Omitted = true.
   */
  farLegs?: boolean;
}

/** Resolve a partial or full pose into the rig's scratch (full poses from a player are used as they are). */
function resolve(rig: DragonRig, pose: DragonPose | PartialDragonPose | null | undefined): DragonPose {
  return copyDragonPose(pose as PartialDragonPose, rig.scratch, true);
}

function setTransform(rig: DragonRig, P: DragonPose, o: DrawDragonOpts): void {
  const facing = o.facing || 1, sc = (o.scale || 1) * rig.scale;
  rig.pxScale = sc;
  rig.ow = 1 / sc;
  // (volume-preserving: a stretch left at 1 is 1 / |squash| -- a mirrored sprite, squash < 0 in a turn in place, is
  // not flipped upside down by it)
  const squash = P.squash, stretch = P.stretch === 1 && squash !== 1 ? 1 / Math.abs(squash) : P.stretch;
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
    // (root space's x runs along the transform's sign: a sprite mirrored by a turn in place steps its chain as one)
    const dx = (SCR.x - ch.lastX) * (Math.sign(rig.tf.fs) || 1) * inv, dy = (SCR.y - ch.lastY) * inv;
    if (Math.abs(dx) > ch.teleport || Math.abs(dy) > ch.teleport) resetChain(ch);
    else stepChain(ch, dx, dy, ang - ch.lastAng);
  }
  ch.init = true; ch.lastX = SCR.x; ch.lastY = SCR.y; ch.lastAng = ang;
  const hold = rig.spec.tailHold || 0;
  if (hold && rig.tick % hold === 0) rig.tailHeld.set(ch.ang);
  rig.sleepT = P.sleep >= 0.5 ? rig.sleepT + 1 : 0;
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
  if (!rig.markFitted) fitMarkings(rig);
  if (!o.still) stepDragon(rig, pose, o);
  const P = resolve(rig, pose);
  setTransform(rig, P, o);
  computeDragonJoints(rig, P);
  rig.top = o.silhouette ? null : o.top || null;
  rig.budget = o.budget || SOLO_BUDGET; rig.slot = o.slot || 0;
  rig.silhouette = !!o.silhouette;
  rig.farLegs = o.farLegs !== false;
  rig.info.asleep = P.sleep >= 0.5;
  rig.info.bond = o.bond == null ? 1 : o.bond; rig.info.wary = o.wary || 0; rig.info.charge = o.charge || 0;
  setLight(rig, 0);
  const t = rig.tf;
  // the element's own tint this frame (lightning's bolt flash) takes the offscreen pass like an owner's tint; at 1 it
  // is the opaque FLASH instead, drawn straight: every fill flat in `glow.hi` (the grow-up's flash, 4.2) inside its
  // own ink, so the shape and the bolt still read on a pale floor. At any partial alpha a yellow over lightning's
  // blue body came out grey, a dropout rather than a flash; all flat, ink too, it was a pale ghost on the straw
  const et = rig.spec.tint && !o.silhouette ? rig.spec.tint(P, fillInfo(rig, 'ambient', false, rig.pal, 0, 0, 0)) : 0;
  const eFlash = et >= 1 ? tones(rig, rig.pal.glow).hi : null;
  const tint = eFlash ? o.tint : et > 0 ? rig.pal.glow : o.tint, tintA = !eFlash && et > 0 ? et : o.tintAlpha;
  ctx.save();
  if (o.alpha != null && o.alpha < 1) ctx.globalAlpha *= o.alpha;
  if (o.shadow !== false && !o.silhouette) {
    ctx.save(); ctx.translate(t.x, t.y); ctx.scale(t.fs, t.ss); ctx.translate(t.rx, 0);
    drawGroundShadow(ctx, rig, -t.ry);
    ctx.restore();
  }
  if (o.flash || tint) {
    const g = getOffscreen();
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, OFF_W, OFF_H);
    g.translate(OFF_OX, OFF_OY); g.scale(t.fs, t.ss); g.translate(t.rx, t.ry); g.rotate(rad(t.rot));
    rig.override = o.flash ? '#ffffff' : eFlash;
    rig.keepInk = !o.flash && !!eFlash;
    drawParts(g, rig, P);
    rig.override = null; rig.keepInk = false;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = o.flash ? 1 : (tintA != null ? tintA : 0.5);
    g.fillStyle = o.flash ? '#ffffff' : tint as string;
    g.fillRect(0, 0, OFF_W, OFF_H);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    ctx.drawImage(offCanvas!, t.x - OFF_OX, t.y - OFF_OY);
  } else {
    ctx.translate(t.x, t.y); ctx.scale(t.fs, t.ss); ctx.translate(t.rx, t.ry); ctx.rotate(rad(t.rot));
    rig.override = o.silhouette ? (typeof o.silhouette === 'string' ? o.silhouette : DRAGON_SHARED.outline) : eFlash;
    rig.keepInk = !!eFlash;
    drawParts(ctx, rig, P);
    rig.override = null; rig.keepInk = false;
  }
  ctx.restore();
}

/** Every part in the order of bible 1.4, root space. */
function drawParts(ctx: CanvasRenderingContext2D, rig: DragonRig, P: DragonPose): void {
  const J = rig.j, d = rig.dims, sp = rig.sp, R = rig.spec.render, pal = rig.pal;
  const fold = P.wing.fold, custom = sp.wing.style === 'custom';
  const tuck = P.tuck | 0;
  // the elder's hole this frame (2.9): where its window lands, or none -- it is cut through BOTH wings
  holeFrame(rig, P);
  // 2. far wing: only when spread >= 0.25 (a folded far wing is a sliver: D19); a custom (cocked) wing always
  if (custom || fold >= 0.25) drawWing(ctx, rig, P, true);
  // 3. far head features
  drawHeadFeatures(ctx, rig, P, true);
  // 4. far hind leg, far front leg
  if (rig.farLegs) { drawLegN(ctx, rig, 2, rig.palLegFar, false); drawLegN(ctx, rig, 3, rig.palLegFar, false); }
  // 5. tail, then the tail-tip feature
  drawTailGroup(ctx, rig, P);
  // 6. back row (before the body: the body contour hides the roots). The elder's hole window is cut out of it as out
  //    of the far wing (2.9): the window sits above the back line + 1 px (holeFrame), so only a back row can stand
  //    behind it, and spike's taller mid-back quills, behind the arm panel at the airing's hold and at full spread,
  //    showed their bone and an ink column through the window instead of the room
  if (HOLE.on) { ctx.save(); clipOffHole(ctx, rig); }
  enter(ctx, rig, J.body.x, J.body.y, J.bodyAng);
  if (sp.dorsal) drawDorsalRow(ctx, rig, sp.dorsal, pal);
  if (R.backRow) R.backRow(ctx, rig, P, fillInfo(rig, 'backRow', false, pal, d.hipR, d.bodyLen, J.bodyAng));
  leave(ctx, rig);
  if (HOLE.on) ctx.restore();
  // 7. body, belly band, body markings
  enter(ctx, rig, J.body.x, J.body.y, J.bodyAng);
  drawBody(ctx, rig, pal);
  leave(ctx, rig);
  drawBodyMarkings(ctx, rig, pal, P);
  // 8. (tuck 1: the head group -- with its neck, so the neck never lies over the head -- goes under the dome) ;
  //    rock: near wing, then bodyOver
  if (tuck === 1) { drawNeck(ctx, rig, pal, P.gulp | 0); drawHeadGroup(ctx, rig, P); }
  const under = !!rig.spec.wingUnderBodyOver;
  if (under) drawWing(ctx, rig, P, false);
  if (R.bodyOver) {
    enter(ctx, rig, J.body.x, J.body.y, J.bodyAng);
    R.bodyOver(ctx, rig, P, fillInfo(rig, 'bodyOver', false, pal, d.hipR, d.bodyLen, J.bodyAng));
    leave(ctx, rig);
  }
  // 9. neck
  if (tuck !== 1) drawNeck(ctx, rig, pal, P.gulp | 0);
  // 10. near hind, near front
  drawLegN(ctx, rig, 0, pal, true);
  drawLegN(ctx, rig, 1, pal, true);
  // 11. (tuck 2: the baby bun, nubs over the head) ; near wing
  if (tuck === 2) drawHeadGroup(ctx, rig, P);
  if (!under) drawWing(ctx, rig, P, false);
  // 12. the head group, last among body parts, so nothing covers the eye
  if (tuck !== 1 && tuck !== 2) drawHeadGroup(ctx, rig, P);
  // 13. the dragon's own effects, clipped off the eye's largest box + 1 px like the near head features: a tell puff,
  //     a crumb, a popped bubble's droplets never land on the eye (hard rule). The element flash (keepInk) lights
  //     the body only: these are separate objects, and lightning's bolt keeps its colours over its own flash
  const ov = rig.keepInk ? rig.override : null;
  if (ov) { rig.override = null; rig.keepInk = false; }
  if (R.breath) {
    ctx.save(); clipOffEye(ctx, rig);
    enter(ctx, rig, J.mouth.x, J.mouth.y, J.mouthAng);
    R.breath(ctx, rig, P, fillInfo(rig, 'breath', false, pal, d.head.jaw.tx - d.head.jaw.hx, 0, J.mouthAng));
    leave(ctx, rig);
    ctx.restore();
  }
  if (R.ambient && !rig.silhouette) R.ambient(ctx, rig, P, fillInfo(rig, 'ambient', false, pal, 0, 0, 0));
  if (!rig.silhouette) drawActEffects(ctx, rig, P);
  if (ov) { rig.override = ov; rig.keepInk = true; }
}

/** Step 5: the tail tube, its markings, then the tail-tip feature in tail-tip space. */
function drawTailGroup(ctx: CanvasRenderingContext2D, rig: DragonRig, P: DragonPose): void {
  const J = rig.j, R = rig.spec.render, pal = rig.pal;
  drawTail(ctx, rig, pal, P);
  if (R.tailTip) {
    const tn = J.tailN;
    enter(ctx, rig, J.tailX[tn], J.tailY[tn], J.tipAng);
    R.tailTip(ctx, rig, P, fillInfo(rig, 'tailTip', false, pal, J.tailR[tn], rig.dims.tail.len * tn, J.tipAng));
    leave(ctx, rig);
  }
}

/**
 * Step 13 / 14, the SHARED act effects (every element has them, so they live in the rig, not in an ElementSpec):
 * the eat anim's crumbs (drawn with the dragon), the sleeping "z" glyphs and the dazed stars (both rising, so both
 * go to the top pass: 1.4 step 14). All scheduled from the pose and the rig's clocks, never a random draw.
 */
function drawActEffects(ctx: CanvasRenderingContext2D, rig: DragonRig, P: DragonPose): void {
  const J = rig.j, top = rig.top, ink = rig.outline;
  if (P.act === ACT.eat && P.cue >= 0) {
    // crumbs: 3 (a baby's messier bite: 5) 2 x 2 bits spraying out of the bowl at the chomp and lying on the floor.
    // Whole pixels in face space; a dark food brown, far below the straw floor (5.4)
    const n = rig.stage === 'baby' ? 5 : 3, mx = J.mouth.x, my = J.mouth.y, t = rig.tf;
    // the floor measured from the face origin the crumbs are drawn from (faceTransform's rounded screen point, under
    // the squash): from the unrounded mouth, a half-pixel mouth rounded the other way laid them 1 px under the floor
    const oy = Math.round(t.ss * (t.ry + mx * t.s + my * t.c)) / rig.pxScale;
    ctx.save(); clipOffEye(ctx, rig);
    for (let k = 0; k < n; k++) {
      crumbAt(rig.build.seed, k, P.cue, -2 - oy, CR);
      if (!CR.z) continue;
      enterFace(ctx, rig, mx, my);
      ctx.fillStyle = FOOD; ctx.fillRect(CR.x - (CR.z >> 1), CR.y - CR.z + 2, CR.z, CR.z);
      ctx.restore();
    }
    ctx.restore();
  }
  if (!top) return;
  // "z": one every tune.sleep.z frames of sleep (the first 20 f after falling asleep), a light 7 x 8 "z" with an ink
  // edge (fx.ts), drifting up 12 px (and 3 px on along facing) over 60 f in 3 alpha steps, from above the SNOUT'S
  // tip: from above the cranium it spawned on slinkwing's fan tips and between horns, and from over the snout's
  // middle its first frames lay on the baby slinkwing's ear in the sleep bun
  const zt = rig.sleepT - 20, every = rig.tune.sleep.z;
  if (zt >= 0) {
    const age = zt % every;
    if (age < 60) {
      const f = age / 60, zx = Math.round(J.mouth.x + 4);
      rootToScreen(rig, zx + Math.round(f * 3), J.top - 8 - Math.round(f * 12), SCR);
      const it = top.push(drawZGlyph, SCR.x - (Z_W >> 1) * rig.pxScale, SCR.y - Z_H * rig.pxScale, rig.pxScale, rig.facing);
      if (it) { it.c0 = DRAGON_SHARED.catchlight; it.c1 = ink; it.alpha = stepAlpha(f); }
    }
  }
  // dazed: two 5 x 5 inked stars opposite each other on a small ellipse over the head, stepping 120 deg every 6 f
  if ((P.face | 0) === DFACE.dazed && P.sleep < 0.5) {
    const s = Math.floor(rig.tick / 6) % 3, rx = Math.max(5, Math.round(rig.dims.head.cranR * 0.8));
    for (let i = 0; i < 2; i++) {
      const a = (s * 120 + i * 180) * Math.PI / 180;
      rootToScreen(rig, J.cran.x + Math.round(Math.cos(a) * rx), J.top - 5 + Math.round(Math.sin(a) * 2), SCR);
      const it = top.push(drawStarGlyph, SCR.x - 2 * rig.pxScale, SCR.y - 2 * rig.pxScale, rig.pxScale, rig.facing);
      if (it) { it.c0 = DRAGON_SHARED.catchlight; it.c1 = ink; }
    }
  }
}
const CR = { x: 0, y: 0, z: 0 };
/** Crumb brown: a dark food colour, far below the straw floor's luminance (gate i's spirit: >= 25 % from it). */
const FOOD = '#6e4424';

function drawLegN(ctx: CanvasRenderingContext2D, rig: DragonRig, i: number, pal: Readonly<DragonPalette>, near: boolean): void {
  const lg = rig.j.legs[i], front = i === 1 || i === 3, L = front ? rig.dims.front : rig.dims.hind;
  drawLeg(ctx, rig, lg.root, lg.knee, lg.ankle, L.r1, L.r2, L.bulge, L.pawW, L.pawH, lg.paw, pal.scale, near && !!rig.dims.claws);
}

/**
 * Step 5: the tail tube (the belly stripe on its first half, to the next whole segment), then its markings clipped
 * inside it. Root space. (Run on to 60 %, 4 of the adult's 6 segments, the stripe dragged a long band of `belly.sh`
 * down a drooping tail's shaded underside: rock's read as a limp flap with a cool underside.)
 */
function drawTail(ctx: CanvasRenderingContext2D, rig: DragonRig, pal: Readonly<DragonPalette>, P: DragonPose): void {
  const J = rig.j, n = J.tailN + 1;
  drawTube(ctx, rig, J.tailX, J.tailY, J.tailR, n, pal.scale, pal.belly, J.tailVX, J.tailVY, 1 + Math.ceil(J.tailN / 2), 0.32);
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
    if (m.optional && rig.markVis[i] < 0.99) continue;
    // position along the node polyline at the fitted fraction t, oriented across the tail
    const fit = rig.markT[i] === rig.markT[i];
    const k = tailAt(J, fit ? rig.markT[i] : m.t ?? 0.2, TP), x = TP.x, y = TP.y, dy = fit ? rig.markDY[i] : m.dy || 0;
    if (m.kind === 'ring') {
      enter(ctx, rig, x, y, -J.tailA[k]);
      ctx.translate(-(m.dx || 0), dy);
      drawTailRing(ctx, m, markingTone(rig, pal, P));
      leave(ctx, rig);
    } else {
      enterFace(ctx, rig, x - (m.dx || 0), y + dy);
      drawMarkingPixels(ctx, m, markingTone(rig, pal, P));
      ctx.restore();
    }
  }
  ctx.restore();
}
const TP: Point = { x: 0, y: 0 };
/** Root-space point at fraction t along the tail's node polyline, into `out`; returns its segment index. */
function tailAt(J: DragonJoints, t: number, out: Point): number {
  const f = Math.max(0, Math.min(0.999, t)) * J.tailN, k = Math.floor(f), u = f - k;
  out.x = J.tailX[k] + (J.tailX[k + 1] - J.tailX[k]) * u; out.y = J.tailY[k] + (J.tailY[k + 1] - J.tailY[k]) * u;
  return k;
}
function pathTaperedTail(ctx: CanvasRenderingContext2D, J: DragonJoints, i: number): void {
  pathTaperedCapsule(ctx, J.tailX[i], J.tailY[i], J.tailX[i + 1], J.tailY[i + 1], J.tailR[i], J.tailR[i + 1], true);
}

/**
 * A body marking's PREFERRED anchor (body space, into `out`): centred between the back line and the leg roots.
 * 'shoulder' / 'haunch' sit over the front / hind leg; 'flank' on the LATERAL LINE (halfway down from the back to
 * the belly line) at `t` from the hip centre (0) to the chest centre (1): one row further up sat it under the folded
 * wing. fitMarkings then moves it to the nearest spot where the whole mark shows.
 */
function markingAnchor(rig: DragonRig, m: Readonly<MarkingSpec>, out: Point): Point {
  const d = rig.dims, backY = -d.chestR * 0.5 - 1, h = m.h ?? m.size;
  let x = 0, y = 0;
  if (m.at === 'shoulder') { x = rig.chestB.x - d.chestR * 0.62; y = backY + d.chestR * 0.15; }
  else if (m.at === 'haunch') { x = rig.hipB.x + d.hipR * 0.15; y = backY + d.hipR * 0.1 + 1; }
  else { const t = m.t ?? 0.5; x = rig.hipB.x + (rig.chestB.x - rig.hipB.x) * t; y = (-d.hipR + rig.bellyY) / 2; }
  out.x = x + (m.dx || 0); out.y = Math.min(y, rig.bellyY - 3 - h / 2) + (m.dy || 0);
  return out;
}

/**
 * Step 7: body markings, clipped to the body OUTSIDE the belly region (its line and the chest bib). Pigment never
 * crosses onto the belly; it may touch it, since belly / marking passes gate (a) on every palette (5.1 #4), and
 * fitMarkings still prefers >= 3 px above the belly line. Called in ROOT space: the clip is set in body space, then
 * each marking is a pixel bitmap in a device-aligned space at its anchor (features.ts).
 */
function drawBodyMarkings(ctx: CanvasRenderingContext2D, rig: DragonRig, pal: Readonly<DragonPalette>, P: DragonPose): void {
  const mk = rig.sp.markings;
  if (rig.override || !mk.length) return;
  const J = rig.j;
  ctx.save();
  ctx.translate(J.body.x, J.body.y); ctx.rotate(rad(J.bodyAng));
  pathBody(ctx, rig); ctx.clip();
  ctx.beginPath(); ctx.rect(-300, -300, 600, 600); pathBelly(ctx, rig, true); ctx.clip('evenodd');
  ctx.rotate(-rad(J.bodyAng)); ctx.translate(-J.body.x, -J.body.y);
  const tone = markingTone(rig, pal, P);
  for (let i = 0; i < mk.length; i++) {
    const m = mk[i];
    if (m.at === 'tail') continue;
    if (m.optional && rig.markVis[i] < 0.99) continue;
    if (rig.markBX[i] === rig.markBX[i]) { MP.x = rig.markBX[i]; MP.y = rig.markBY[i]; } else markingAnchor(rig, m, MP);
    toRoot(rig, MP.x, MP.y, MP);
    enterFace(ctx, rig, MP.x, MP.y);
    drawMarkingPixels(ctx, m, tone);
    ctx.restore();
  }
  ctx.restore();
}

// ---------- fitting the body markings (once per rig) ----------

// The coverage mask: root space at scale 1, origin at (MOX, MOY) of a small offscreen canvas, reused by every rig.
const MW = 240, MH = 160, MOX = 120, MOY = 136;
let maskCanvas: HTMLCanvasElement | null = null, maskCtx: CanvasRenderingContext2D | null = null;
const MASK_POSE = makeDragonPose();

/**
 * Solve where each marking can be SEEN (2.7: the first marking is an invariant; 5.2: no specks), once per rig at the
 * rest pose, by painting a coverage mask: the region a marking may use in pure red, then everything the real draw
 * puts over it in one flat blue through rig.override, and reading back which pixels stay red. Anti-aliased edges
 * read as covered: a 1 px margin for free. Runs on the first draw (it needs a canvas); tools that only solve joints
 * keep the preferred anchors.
 *   BODY markings: the flank outside the belly region, under the dome and tucked wing, neck, near legs, near wing
 *   and the head group. Each moves from its preferred anchor to the nearest spot (whole pixels, within a third of
 *   the body length) where all of its bitmap shows, >= 2 px clear of the markings placed before it and, as far as
 *   visibility allows, a third of the body length from them: the visible flank is one band under the folded wing,
 *   and two marks side by side at one height read as text ("AA", a pair of spots), not a pattern.
 *   TAIL markings: the tail is drawn under the body (1.4 step 5), so the hip, a leg or a back-row root can hide its
 *   base. The tail is painted red, everything drawn after it blue, and each marking slides out along the tail from
 *   its preferred t to the first spot where all of it shows (a ring: the whole tube section it crosses) and its box
 *   is >= 3 px clear of the tail marking before it.
 */
function fitMarkings(rig: DragonRig): void {
  rig.markFitted = true;
  const mk = rig.sp.markings;
  let body = false, tail = false;
  for (let i = 0; i < mk.length; i++) { if (mk[i].at === 'tail') tail = true; else body = true; }
  if (!mk.length || typeof document === 'undefined') return;
  if (!maskCanvas) { maskCanvas = document.createElement('canvas'); maskCanvas.width = MW; maskCanvas.height = MH; maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true }); }
  const g = maskCtx!, P = MASK_POSE;
  const keepMood = rig.mood, keepTop = rig.top, keepPx = rig.pxScale, keepOw = rig.ow;
  copyDragonPose(null, P, true);
  setTransform(rig, P, { x: MOX, y: MOY, scale: 1 / (rig.scale || 1) });
  rig.mood = 0; rig.top = null;
  computeDragonJoints(rig, P);
  HOLE.on = false;
  if (tail) fitTailMarkings(rig, g, P);
  if (body) fitBodyMarkings(rig, g, P);
  rig.mood = keepMood; rig.top = keepTop; rig.pxScale = keepPx; rig.ow = keepOw;
}

/** Mask pixel (X, Y) in root space: pure red in `img`? */
function maskRed(img: Uint8ClampedArray, X: number, Y: number): boolean {
  const x = X + MOX, y = Y + MOY;
  if (x < 0 || y < 0 || x >= MW || y >= MH) return false;
  const o = (y * MW + x) * 4;
  return img[o] > 250 && img[o + 1] < 5 && img[o + 2] < 5 && img[o + 3] > 250;
}

function fitBodyMarkings(rig: DragonRig, g: CanvasRenderingContext2D, P: DragonPose): void {
  const mk = rig.sp.markings, J = rig.j;
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, MW, MH);
  g.translate(MOX, MOY);
  // A: the flank a marking may use: the body outside the belly region (drawBodyMarkings' clip)
  g.save(); g.translate(J.body.x, J.body.y);
  pathBody(g, rig); g.clip();
  g.fillStyle = '#ff0000'; g.fillRect(-100, -100, 200, 200);
  pathBelly(g, rig); g.fillStyle = '#ffffff'; g.fill();
  g.restore();
  // B: everything drawn over the markings, flat blue
  rig.override = '#0000ff';
  drawOverMarkings(g, rig, P);
  rig.override = null;
  const img = g.getImageData(0, 0, MW, MH).data;
  const d = rig.dims, R = Math.max(5, Math.round(d.bodyLen / 3)), minD = d.bodyLen / 3;
  // two passes: the first places each marking against those before it (the first marking, an invariant, gets its
  // pick); the second re-fits each against ALL the others, so a haunch mark can step back from a shoulder mark that
  // the chest front pushed toward it
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < mk.length; i++) {
    const m = mk[i];
    if (m.at === 'tail' || (pass === 1 && i === 0)) continue;
    const w = m.size, h = m.h ?? m.size, x0 = -Math.floor(w / 2), y0 = -Math.floor(h / 2);
    const kEnd = pass === 0 ? i : mk.length;
    markingAnchor(rig, m, MP);
    const ax = Math.round(MP.x + J.body.x), ay = Math.round(MP.y + J.body.y);
    let best = -1e9, bx = ax, by = ay, bestVis = 0;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const X = ax + dx, Y = ay + dy;
      let on = 0, low = 0, raw = 0, clash = false, near = 1e9;
      for (let k = 0; k < kEnd; k++) {
        if (k === i || rig.markBX[k] !== rig.markBX[k]) continue;
        near = Math.min(near, Math.hypot(X - rig.markBX[k] - J.body.x, Y - rig.markBY[k] - J.body.y));
      }
      for (let yy = 0; yy < h && !clash; yy++) for (let xx = 0; xx < w; xx++) {
        if (!markingPixel(m.kind, w, h, xx, yy, m.solid)) continue;
        on++;
        const px = X + x0 + xx, py = Y + y0 + yy;
        if (maskRed(img, px, py)) raw++;
        // within 3 px of the belly line: allowed, but a spot higher on the flank wins
        if (py + 0.5 - J.body.y > rig.bellyY - 3) low++;
        // >= 2 px clear of the other markings placed
        for (let k = 0; k < kEnd && !clash; k++) {
          if (k === i || rig.markBX[k] !== rig.markBX[k]) continue;
          const mk2 = mk[k], w2 = mk2.size, h2 = mk2.h ?? mk2.size;
          const kx = Math.round(rig.markBX[k] + J.body.x) - Math.floor(w2 / 2), ky = Math.round(rig.markBY[k] + J.body.y) - Math.floor(h2 / 2);
          if (px >= kx - 2 && px < kx + w2 + 2 && py >= ky - 2 && py < ky + h2 + 2) clash = true;
        }
      }
      if (clash || !on) continue;
      // strictly in this order: all of it showing (1e5 per share: one hidden pixel outweighs everything below),
      // a third of the body length from the others (400 per px short), clear of the belly line (1000 per share
      // within 3 px of it), then the nearest to the preferred anchor (vertical moves cost a little more: the
      // anchor's height is its row on the flank)
      const score = (raw / on) * 1e5 - Math.max(0, minD - near) * 400 - (low / on) * 1000 - (dx * dx + dy * dy * 1.5);
      if (score > best) { best = score; bx = X; by = Y; bestVis = raw / on; }
    }
    rig.markBX[i] = bx - J.body.x; rig.markBY[i] = by - J.body.y; rig.markVis[i] = bestVis;
  }
}

function fitTailMarkings(rig: DragonRig, g: CanvasRenderingContext2D, P: DragonPose): void {
  const mk = rig.sp.markings, J = rig.j, n = J.tailN + 1;
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, MW, MH);
  g.translate(MOX, MOY);
  // A: the tail alone, red (the region its markings are clipped to)
  g.beginPath();
  for (let i = 0; i < n - 1; i++) pathTaperedTail(g, J, i);
  g.fillStyle = '#ff0000'; g.fill();
  const tailImg = g.getImageData(0, 0, MW, MH).data;
  // B: everything the real draw puts over the tail (1.4 steps 5-12), flat blue: first without the back row (what a
  // RING must clear: a quill standing on the tail's top crosses a ring and the ring still reads), then with it
  // (what a bitmap must clear)
  rig.override = '#0000ff';
  drawOverTail(g, rig, P);
  const ringImg = g.getImageData(0, 0, MW, MH).data;
  drawBackRow(g, rig, P);
  rig.override = null;
  const img = g.getImageData(0, 0, MW, MH).data;
  let prevT = -1, prevBox = 0, prevDx = 0;
  for (let i = 0; i < mk.length; i++) {
    const m = mk[i];
    if (m.at !== 'tail') continue;
    const t0 = m.t ?? 0.2, len = rig.dims.tail.len * J.tailN, box = m.kind === 'ring' ? m.size : Math.max(m.size, m.h ?? m.size);
    // >= 3 px of tail between this box and the previous tail marking's (a pair 1 px apart read as one dash), counting
    // each one's nudge along the tail (`dx`, + further out: the pet seed's +-2 px of 2.8), which is applied after
    // the fit -- spaced by t alone, two spots shifted toward each other landed 1-2 px apart (water, seed 3)
    const dx = m.dx || 0;
    const tMin = prevT < 0 ? t0 : Math.max(t0, prevT + (prevBox / 2 + 3 + box / 2 + prevDx - dx) / len);
    // a bitmap must show whole; a ring reads as a ring with 3/4 of its section showing past the hip and legs (a
    // back-row quill standing on the tail's top may cross it: ringImg leaves the back row out)
    // a bitmap may also step 1 px across the tail to centre on a tube whose axis falls on a half pixel
    const need = m.kind === 'ring' ? 0.75 : 0.999, dy0 = m.dy || 0;
    let bestT = Math.min(tMin, 0.9), bestV = tMin > 0.9 ? 0 : -1, bestDY = dy0;
    for (let t = tMin; t <= 0.9 + 1e-6 && bestV < need; t += 0.01) {
      for (let s = 0; s < (m.kind === 'ring' ? 1 : 3); s++) {
        const dy = dy0 + (s === 0 ? 0 : s === 1 ? -1 : 1), v = tailMarkVis(rig, m, t, dy, tailImg, m.kind === 'ring' ? ringImg : img);
        if (v > bestV + 1e-6) { bestV = v; bestT = t; bestDY = dy; }
        if (v >= need) break;
      }
    }
    if (bestV >= need) bestV = 1;
    rig.markT[i] = Math.round(bestT * 100) / 100; rig.markDY[i] = bestDY; rig.markVis[i] = Math.min(1, Math.max(0, bestV));
    prevT = rig.markT[i]; prevBox = box; prevDx = dx;
  }
}

/**
 * The share (0..1) of a tail marking at fraction t that shows in the mask. A bitmap (chevron, Z, spot): its pixels
 * that are red (on the tail, uncovered); off the tail counts as hidden too, since the clip would cut it into a
 * half-mark. A ring: the tail pixels (red in `tailImg`) under its band that stay red in `img`.
 */
function tailMarkVis(rig: DragonRig, m: Readonly<MarkingSpec>, t: number, dy: number, tailImg: Uint8ClampedArray, img: Uint8ClampedArray): number {
  const J = rig.j, k = tailAt(J, t, TP);
  if (m.kind !== 'ring') {
    const w = m.size, h = m.h ?? m.size, X = Math.round(TP.x - (m.dx || 0)) - Math.floor(w / 2), Y = Math.round(TP.y + dy) - Math.floor(h / 2);
    let on = 0, seen = 0;
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      if (!markingPixel(m.kind, w, h, xx, yy, m.solid)) continue;
      on++;
      if (maskRed(img, X + xx, Y + yy)) seen++;
    }
    return on ? seen / on : 0;
  }
  // the band's axis runs along the tail (drawTail enters at -tailA)
  const a = rad(-J.tailA[k]), ux = Math.cos(a), uy = Math.sin(a);
  const cx = TP.x - (m.dx || 0) * ux - dy * uy, cy = TP.y - (m.dx || 0) * uy + dy * ux, hw = m.size / 2;
  let tailPx = 0, seen = 0;
  for (let Y = Math.floor(cy) - 10; Y <= Math.ceil(cy) + 10; Y++) for (let X = Math.floor(cx) - 10; X <= Math.ceil(cx) + 10; X++) {
    const along = (X + 0.5 - cx) * ux + (Y + 0.5 - cy) * uy;
    if (Math.abs(along) > hw || !maskRed(tailImg, X, Y)) continue;
    tailPx++;
    if (maskRed(img, X, Y)) seen++;
  }
  return tailPx ? seen / tailPx : 0;
}

/** The last coverage mask fitMarkings drew (red = flank a marking can use): for tools that audit the fit. */
export function markingMask(): HTMLCanvasElement | null { return maskCanvas; }

/** Everything the real draw paints over the body markings (1.4 steps 8-12, no tuck): for fitMarkings' mask. */
function drawOverMarkings(ctx: CanvasRenderingContext2D, rig: DragonRig, P: DragonPose): void {
  const J = rig.j, R = rig.spec.render;
  const under = !!rig.spec.wingUnderBodyOver;
  if (under) drawWing(ctx, rig, P, false);
  if (R.bodyOver) {
    enter(ctx, rig, J.body.x, J.body.y, J.bodyAng);
    R.bodyOver(ctx, rig, P, fillInfo(rig, 'bodyOver', false, rig.pal, rig.dims.hipR, rig.dims.bodyLen, J.bodyAng));
    leave(ctx, rig);
  }
  drawNeck(ctx, rig, rig.pal, 0);
  drawLegN(ctx, rig, 0, rig.pal, true);
  drawLegN(ctx, rig, 1, rig.pal, true);
  if (!under) drawWing(ctx, rig, P, false);
  drawHeadGroup(ctx, rig, P);
}
/**
 * Everything the real draw paints over the tail (1.4 steps 5-12, no tuck) except the back row: for fitMarkings'
 * tail mask. drawBackRow adds the back row (the same flat colour, so the order does not matter).
 */
function drawOverTail(ctx: CanvasRenderingContext2D, rig: DragonRig, P: DragonPose): void {
  const J = rig.j, R = rig.spec.render, d = rig.dims;
  if (R.tailTip) {
    const tn = J.tailN;
    enter(ctx, rig, J.tailX[tn], J.tailY[tn], J.tipAng);
    R.tailTip(ctx, rig, P, fillInfo(rig, 'tailTip', false, rig.pal, J.tailR[tn], d.tail.len * tn, J.tipAng));
    leave(ctx, rig);
  }
  enter(ctx, rig, J.body.x, J.body.y, J.bodyAng);
  drawBody(ctx, rig, rig.pal);
  leave(ctx, rig);
  drawOverMarkings(ctx, rig, P);
}
function drawBackRow(ctx: CanvasRenderingContext2D, rig: DragonRig, P: DragonPose): void {
  const J = rig.j, R = rig.spec.render, d = rig.dims;
  enter(ctx, rig, J.body.x, J.body.y, J.bodyAng);
  if (rig.sp.dorsal) drawDorsalRow(ctx, rig, rig.sp.dorsal, rig.pal);
  if (R.backRow) R.backRow(ctx, rig, P, fillInfo(rig, 'backRow', false, rig.pal, d.hipR, d.bodyLen, J.bodyAng));
  leave(ctx, rig);
}
const MP: Point = { x: 0, y: 0 };

/** The marking colour this frame: the element's mood-driven tone (water's spots) or the palette's marking. */
function markingTone(rig: DragonRig, pal: Readonly<DragonPalette>, P: DragonPose): string {
  const f = rig.spec.markingTone;
  return f ? f(fillInfo(rig, 'bodyOver', false, pal, rig.dims.hipR, rig.dims.bodyLen, rig.j.bodyAng), P, rig) : pal.marking;
}

// ---------- the elder's wing hole (2.9) ----------

/**
 * This frame's hole: drawn or not, the root-space point its window's centre pixel rounds from, and which of its ring's
 * pixels are inked (bit k: HOLE_RING's k-th pixel).
 */
const HOLE = { on: false, x: 0, y: 0, ring: 0 };
const HP: Point = { x: 0, y: 0 }, HQ: Point = { x: 0, y: 0 };
/** How far (whole face pixels, each way) holeFrame may move the window from its spot to seat it against the bone. */
const HOLE_SEAT = 3;
/** HOLE_RING's sides: the face-space step from the window to each ring pixel (top, front, bottom, back). */
const RING_STEP: readonly number[] = [0, -1, 0, -1, 0, -1, 1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 1, -1, 0, -1, 0];

/**
 * Decide this frame's elder wing hole (2.9): the near wing's window at its full-spread wing-space spot (WingParams.hole,
 * from `wing` >= its `from`), mapped to root space, where its centre pixel rounds to a whole device pixel, then SEATED
 * against the leading-edge bone: of the whole-pixel placements within HOLE_SEAT px of the spot, the one whose window
 * comes nearest the bone without covering it (the bone is the window's border on that side, 2.9), the spot's own
 * nearest on a tie. A placement counts only where the WHOLE window has its ring and 2 px of membrane round it inside the
 * arm panel (the bone excepted) and lies above the back line + 1 px; with none, the hole is skipped this frame, never
 * shrunk (a partial hole is a speck). Then the ring: inked only on the sides facing away from the bone, and never on
 * the notched back (HOLE_RING_OPEN), so the pale window meets the bone and the membrane directly on two sides, a torn
 * gap, not a dot in a closed ring. (Set in the middle of the arm panel, 2 px of membrane and its ring between it and
 * the bone, the window read as an eye on fire's wing, an eyespot on dusk's and one more of water's pale spots: the
 * elder core review, round 2.) Face space runs along root space here (no head flip), so a window pixel's centre is its
 * offset in root px.
 */
function holeFrame(rig: DragonRig, P: DragonPose): void {
  HOLE.on = false;
  const wp = rig.sp.wing, J = rig.j;
  if (rig.dims.nub || !wingHoleAt(rig, wp, P.wing.fold, HP)) return;
  localToRootPt(J.wingN.x, J.wingN.y, J.wingAngN, HP.x, HP.y, HQ);
  const t = rig.tf, sc = rig.pxScale || 1, kx = sc / Math.abs(t.fs || 1), ky = sc / Math.abs(t.ss || 1);
  // the root point of the rounded pixel's centre (faceTransform rounds the screen point; a face pixel is kx / ky root
  // px, 1 but for a squash)
  const ox = Math.round(t.fs * (t.rx + HQ.x)) / t.fs - t.rx, oy = Math.round(t.ss * (t.ry + HQ.y)) / t.ss - t.ry;
  let bi = 0, bj = 0, bestGap = 1e9, bestD = 1e9;
  for (let j = -HOLE_SEAT; j <= HOLE_SEAT; j++) for (let i = -HOLE_SEAT; i <= HOLE_SEAT; i++) {
    const g = holeFits(rig, ox + (i + 0.5) * kx, oy + (j + 0.5) * ky, kx, ky), d = i * i + j * j;
    if (g < 0) continue;
    if (g < bestGap - 0.05 || (g < bestGap + 0.05 && d < bestD)) { bi = i; bj = j; bestGap = g; bestD = d; }
  }
  if (bestGap > 1e8) return;
  const cx = ox + (bi + 0.5) * kx, cy = oy + (bj + 0.5) * ky;
  // which way the bone lies from the window: the membrane gap's gradient over one face pixel
  const g0 = gapAt(rig, cx, cy), gx = gapAt(rig, cx + kx, cy) - g0, gy = gapAt(rig, cx, cy + ky) - g0;
  let ring = 0;
  for (let k = 0, i = 0; i < HOLE_RING_OPEN; i += 2, k++) {
    // (a side facing the bone -- stepping out of the window toward it -- is the bone's: no ink there)
    if (RING_STEP[i] * gx + RING_STEP[i + 1] * gy < -0.3) continue;
    if (gapAt(rig, cx + HOLE_RING[i] * kx, cy + HOLE_RING[i + 1] * ky) < 0.5) continue;
    ring |= 1 << k;
  }
  HOLE.on = true; HOLE.x = HQ.x + bi * kx; HOLE.y = HQ.y + bj * ky; HOLE.ring = ring;
}
/**
 * The window centred on root point (cx, cy) (a pixel centre): -1 where it does not fit (off the arm panel's membrane
 * with its ring and 2 px round it, the bone excepted; on the bone; not above the back line + 1 px), else the smallest
 * membrane gap between a window pixel's centre and the bone (armBoneGap). Reads the wing wingHoleAt solved.
 */
function holeFits(rig: DragonRig, cx: number, cy: number, kx: number, ky: number): number {
  const J = rig.j;
  const bc = Math.cos(rad(-J.bodyAng)), bs = Math.sin(rad(-J.bodyAng));
  let gmin = 1e9;
  for (let i = 0; i < HOLE_PX.length; i += 2) {
    const X = cx + HOLE_PX[i] * kx, Y = cy + HOLE_PX[i + 1] * ky;
    // on the membrane: the ring (1 px) and 2 px of membrane beyond the window pixel's own half pixel
    if (!armPanelHas(wingX(rig, X, Y), wingY(rig, X, Y), 3)) return -1;
    // off the bone: the pixel's centre half a pixel clear of its paint
    const g = armBoneGap(wingX(rig, X, Y), wingY(rig, X, Y));
    if (g < 0.5) return -1;
    gmin = Math.min(gmin, g);
    // above the back line + 1 px (body space)
    const ex = X - J.body.x, ey = Y - J.body.y, bx = ex * bc - ey * bs, by = ex * bs + ey * bc;
    if (by + 0.5 > backLineY(rig, bx) - 1) return -1;
  }
  return gmin;
}
/** armBoneGap at root point (X, Y). */
function gapAt(rig: DragonRig, X: number, Y: number): number { return armBoneGap(wingX(rig, X, Y), wingY(rig, X, Y)); }
/** Root point (X, Y) in the near wing's space (the space the rig enters for it). */
function wingX(rig: DragonRig, X: number, Y: number): number {
  const J = rig.j, a = rad(-J.wingAngN), dx = X - J.wingN.x, dy = Y - J.wingN.y;
  return dx * Math.cos(a) - dy * Math.sin(a);
}
function wingY(rig: DragonRig, X: number, Y: number): number {
  const J = rig.j, a = rad(-J.wingAngN), dx = X - J.wingN.x, dy = Y - J.wingN.y;
  return dx * Math.sin(a) + dy * Math.cos(a);
}

/**
 * Clip (root space in, root space out) to everything but this frame's hole window, so a wing drawn under it leaves the
 * window empty: the far wing too, so the window shows the background, not the far wing's darker membrane (a rivet).
 * Built in face space at the rounded pixel, walked back by hand. Wrap in save / restore.
 */
function clipOffHole(ctx: CanvasRenderingContext2D, rig: DragonRig): void {
  faceTransform(ctx, rig, HOLE.x, HOLE.y);
  ctx.beginPath(); ctx.rect(-400, -400, 800, 800);
  for (let i = 0; i < HOLE_PX.length; i += 2) ctx.rect(HOLE_PX[i], HOLE_PX[i + 1], 1, 1);
  ctx.clip('evenodd');
  leaveFaceKeepClip(ctx, rig, HOLE.x, HOLE.y);
}

/** The window's ink ring (the pixels holeFrame kept: away from the bone, not the notched back), whole pixels in face space, over the near wing (2.9). */
function stampHoleRing(ctx: CanvasRenderingContext2D, rig: DragonRig): void {
  enterFace(ctx, rig, HOLE.x, HOLE.y);
  ctx.fillStyle = rig.col(rig.outline);
  for (let k = 0, i = 0; i < HOLE_RING_OPEN; i += 2, k++) if (HOLE.ring & (1 << k)) ctx.fillRect(HOLE_RING[i], HOLE_RING[i + 1], 1, 1);
  ctx.restore();
}

/**
 * Clip (root space in, root space out) to everything but the NEAR wing's tear cuts this frame (parts.ts pathWingTears),
 * for the far wing drawn under it: a near tear then shows the room or the body behind the wings, never the far wing's
 * darker membrane (2.9). Built in the near wing's space and walked back by hand. False (and no clip) when no tear
 * shows. Wrap in save / restore.
 */
function clipOffTears(ctx: CanvasRenderingContext2D, rig: DragonRig, P: DragonPose): boolean {
  const J = rig.j, a = rad(J.wingAngN);
  ctx.translate(J.wingN.x, J.wingN.y); ctx.rotate(a);
  ctx.beginPath(); ctx.rect(-400, -400, 800, 800);
  const on = pathWingTears(ctx, rig, rig.sp.wing, P.wing.fold);
  if (on) ctx.clip('evenodd');
  ctx.rotate(-a); ctx.translate(-J.wingN.x, -J.wingN.y);
  return on;
}

/**
 * Steps 2 / 11: one wing (near or far) in wing space; an elder's hole cut through it where holeFrame put one, and the
 * far wing cut under the near wing's tears.
 */
function drawWing(ctx: CanvasRenderingContext2D, rig: DragonRig, P: DragonPose, far: boolean): void {
  const cut = far && rig.stage === 'elder' && !rig.dims.nub && rig.sp.wing.style !== 'custom';
  ctx.save();
  if (cut) clipOffTears(ctx, rig, P);
  if (HOLE.on) clipOffHole(ctx, rig);
  drawWingIn(ctx, rig, P, far);
  ctx.restore();
  if (HOLE.on && !far) stampHoleRing(ctx, rig);
}
function drawWingIn(ctx: CanvasRenderingContext2D, rig: DragonRig, P: DragonPose, far: boolean): void {
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
    // a nub has no bones to spread: the channel lerps it from rest to its flutter angle (1), and on past it up to 4
    // (the sleep bun's nubs rise over the crown: tuning.sleep.nubFold)
    const nb = rig.dims.nub, rest = wp.nubRest ?? nb.rest;
    drawNub(ctx, rig, rest + (nb.lift - rest) * Math.max(0, Math.min(4, P.wing.fold)) + (far ? 8 : 0), pal);
  } else drawBatWing(ctx, rig, wp, P.wing.fold, pal);
  leave(ctx, rig);
}

/** Steps 3 / 12.6: shared horns plus the element's head renderer, cranium space. */
function drawHeadFeatures(ctx: CanvasRenderingContext2D, rig: DragonRig, P: DragonPose, far: boolean): void {
  const J = rig.j, H = rig.dims.head, R = rig.spec.render, hp = rig.sp.horns;
  const pal = far ? rig.palWingFar : rig.pal;
  const fn = far ? R.farHead : R.nearHead;
  if (!hp && !fn) return;
  enterCranium(ctx, rig);
  FACE_FLIP = J.headFlip;
  // (the world's up, for the horns' quiet-zone height: in a looked-back head's flipped cranium space it lies where
  // an unflipped head's would at 180 - its angle)
  const up = J.headFlip < 0 ? 180 - J.headAng : J.headAng;
  // far (1.5): the root 2 px ABOVE the near one across the horn's own line (a root "3 px behind" slides it along a
  // horn that lies back on the neck line) and forked further up, adults 28 deg so background shows between the
  // tips (at 8, and even at 19, the bent near tip curled up against the far horn); a far horn the near one covers
  // by more than 70 % (dilated 2 px, so one lying parallel within 2 px counts as covered: every young pair) is
  // not drawn: a pair that close fused into one dark two-tone wedge
  // both horns keep the quiet-zone height (3.0: <= 3 px over the skull top): the reference lowers back along the
  // head when the neck line points up-back in the world, and a far horn whose fork still rises above it is culled
  const ref = hp ? hornRefClamped(hp, H.cranR, J.neckRef, up) : 0;
  if (hp && !far) drawHorn(ctx, rig, hp, H.cranR, pal, ref);
  else if (hp && rig.stage !== 'baby') {
    const tilt = hp.farTilt ?? (grown(rig.stage) ? 28 : 8);
    const b = rad(ref - hp.sweep), fx = -Math.sin(b) * 2, fy = -Math.cos(b) * 2;
    if (hornOverlap(hp, H.cranR, ref, tilt, fx, fy) <= 0.7 && hornRise(hp, H.cranR, ref, up, tilt, fx, fy) <= 3) {
      drawHorn(ctx, rig, hp, H.cranR, pal, ref, tilt, fx, fy);
    }
  }
  if (fn) fn(ctx, rig, P, fillInfo(rig, far ? 'farHead' : 'nearHead', far, pal, H.cranR, rig.dims.headLen, J.headAng));
  leave(ctx, rig);
  FACE_FLIP = 1;
}

const FP: Point = { x: 0, y: 0 }, TG: Point = { x: 0, y: 0 }, MO: Point = { x: 0, y: 0 };
/** Cranium-space point -> root space (into FP). */
function cranToRoot(rig: DragonRig, x: number, y: number): Point { return cranToRootPt(rig, x, y, FP); }
/**
 * Cranium-space point -> root space, into `out`: for element renderers that draw a pixel construction in face
 * space (enterFace) at a head feature (a rib, a mask edge), so it stays device-aligned whatever the head's pitch.
 */
export function cranToRootPt(rig: DragonRig, x: number, y: number, out: Point): Point {
  return localToRootPt(rig.j.cran.x, rig.j.cran.y, rig.j.headAng, x, y * rig.j.headFlip, out);
}

/** Step 12: mouth interior, jaw, skull, face markings, eye / brow / nostril / fangs, near head features. */
function drawHeadGroup(ctx: CanvasRenderingContext2D, rig: DragonRig, P: DragonPose): void {
  const J = rig.j, H = rig.dims.head, pal = rig.pal, R = rig.spec.render, hf = J.headFlip;
  enterCranium(ctx, rig);
  if (J.jaw > 0) drawMouthInterior(ctx, rig, J.jaw, DRAGON_SHARED.mouth);
  drawJaw(ctx, rig, J.jaw, pal);
  // 12.2: the elder's beard, its own inked tuft in jaw space, right after the jaw (1.2)
  const elder = rig.stage === 'elder';
  if (elder) drawBeard(ctx, rig, J.jaw, rig.greys.beard);
  drawSkull(ctx, rig, pal);
  if (R.headMarkings && !rig.override) {
    ctx.save();
    pathSkull(ctx, rig); ctx.clip();
    R.headMarkings(ctx, rig, P, fillInfo(rig, 'headMarkings', false, pal, H.cranR, rig.dims.headLen, J.headAng));
    ctx.restore();
  }
  // 12.4, after the element's face markings: the elder's grey muzzle (pigment), clipped to the skull path and drawn in
  // face space, so the eye, nostril and mouth marks sit on it and it meets the skull's ink with no rim of scale
  if (elder && !rig.override) {
    ctx.save();
    pathSkull(ctx, rig); ctx.clip();
    FACE_FLIP = hf;
    enterFaceFromCranium(ctx, rig, J.eye.x, J.eye.y);
    drawMuzzle(ctx, rig, rig.greys.muzzle);
    ctx.restore();
    ctx.restore();
  }
  leave(ctx, rig);
  // the face, device-aligned (faces.ts). The runtime blink (pose.blink) swaps the EYE only: the face keeps its
  // brow, blush and mouth, so a neutral blink shows no brow bar
  let face = P.face | 0;
  if (P.sleep >= 0.5) face = DFACE.closed;
  // (edge-on, a turn in place's narrow frames: a pixel-construction eye cannot be squashed, so none shows)
  if (Math.abs(P.squash) < 0.75) face = DFACE.closed;
  // (no blink over eyes already shut: on the happy "^" it flashed an open, lidded eye for a few frames, and upside
  // down in rock's roll that lid hung from the eye's bottom)
  const blink = P.sleep >= 0.5 || face === DFACE.happy || face === DFACE.closed || face === DFACE.dazed ? 0 : P.blink | 0;
  // (face-space x runs mirrored while the head looks back: every mark's root offset from the eye times hf)
  const ex = J.eye.x, ey = J.eye.y;
  FACE_FLIP = hf;
  enterFace(ctx, rig, ex, ey);
  if (faceBlushes(face)) drawBlush(ctx, rig);
  drawEye(ctx, rig, blink === 2 ? DFACE.closed : blink === 1 ? DFACE.sleepy : face, P.pupil >= 0.5);
  // (the elder's brow is its grey tuft, at every face: faces.ts drawBrow)
  drawBrow(ctx, rig, face, elder ? rig.greys.tuft : tones(rig, pal.scale).deep);
  // nostril near the snout tip, top side, and >= 2 px clear of the eye's ring ALONG THE SNOUT (cranium space),
  // whatever the head's pitch: the baby's button snout leaves ~5 px between ring and tip, and at 1 px the nostril
  // read as a smudge on the eye; clamped in face-space x instead, a head pitched down into the bowl pushed it off
  // the snout into the air. It never shares its top row with the closed eye's line either: the two read as one
  // long dash across a baby's or water's face, so it sits a pixel lower there
  const sn = H.snout, ringR = H.eye.w - 1 - (H.eye.w >> 1);
  let p = cranToRoot(rig, Math.max(sn.x1 + sn.r1 * 0.1 - 1, H.eye.x + ringR + 4), sn.y1 - sn.r1 * 0.55);
  // (the closed line's top row is the eye box's middle row: face row 0)
  const ny = Math.round(p.y - ey) - 1;
  drawNostril(ctx, rig, Math.round((p.x - ex) * hf) - 1, ny === 0 ? 1 : ny);
  if (H.teeth === 'egg') {
    // the egg tooth: 2 x 2 on the very tip of the snout, at the mouth line. Not with the jaw shut on the hungry
    // face: beside its two catchlights it lined up as a third white dot
    if (face !== DFACE.hungry || J.jaw > 0) {
      p = cranToRoot(rig, sn.x1 + sn.r1 * 0.72, sn.y1 + sn.r1 * 0.2);
      drawEggTooth(ctx, rig, Math.round((p.x - ex) * hf) - 1, Math.round(p.y - ey) - 1);
    }
  } else if (J.jaw >= H.jawMin) {
    p = cranToRoot(rig, sn.x1 - 2, sn.y1 + sn.r1 * 0.9);
    drawFangs(ctx, rig, Math.round((p.x - ex) * hf) - 1, Math.round(p.y - ey));
  }
  // (a parted jaw, under the minimum, shows neither: ElementStageParams.jawPart)
  if (J.jaw >= H.jawMin) {
    // the 2 x 2 tongue lies on the open jaw's top edge where the mouth is widest (its bottom row on the jaw's ink,
    // the mouth colour above it), whole pixels in face space: drawn under the jaw, the jaw covered it
    jawTopAt(rig, J.jaw, 0.85, TG);
    p = cranToRoot(rig, TG.x, TG.y);
    ctx.fillStyle = rig.col(DRAGON_SHARED.tongue); ctx.fillRect(Math.round((p.x - ex) * hf) - 1, Math.round(p.y - ey) - 1, 2, 2);
  }
  if (J.jaw === 0) {
    // the mouth corner: the back end of the mouth line, on the skull's lower contour (rig.mouthC)
    p = cranToRoot(rig, rig.mouthC.x, rig.mouthC.y);
    drawMouthMark(ctx, rig, face, Math.round((p.x - ex) * hf), Math.round(p.y - ey));
  }
  // 12.6, near head features, clipped to exclude the eye's largest box + 1 px (the hard rule "nothing covers the
  // eye" holds for every element renderer). The clip is built in face space and the transform walked back to root
  // space by hand, since a restore would drop the clip with it.
  // (pose.eyeClip 0 lifts it for ledger E8's fan flop, the one sanctioned exception)
  const b = rig.info.eye, gw = b.w + 2, gh = b.h + 2;
  ctx.beginPath(); ctx.rect(-400, -400, 800, 800); ctx.rect(-Math.floor(gw / 2), -Math.floor(gh / 2), gw, gh);
  if (P.eyeClip >= 0.5) ctx.clip('evenodd');
  leaveFaceKeepClip(ctx, rig, ex, ey);
  FACE_FLIP = 1;
  drawHeadFeatures(ctx, rig, P, false);
  ctx.restore();
}

/**
 * Clip (root space in, root space out) to everything but the eye's largest box + 1 px (DragonInfo.eye): the hard
 * rule "nothing covers the eye" for anything the rig draws after the head. Built in face space, where the eye is a
 * pixel construction, and walked back by hand, since a restore would drop the clip. Wrap in save / restore.
 */
function clipOffEye(ctx: CanvasRenderingContext2D, rig: DragonRig): void {
  const J = rig.j, b = rig.info.eye, gw = b.w + 2, gh = b.h + 2;
  FACE_FLIP = J.headFlip;
  faceTransform(ctx, rig, J.eye.x, J.eye.y);
  ctx.beginPath(); ctx.rect(-400, -400, 800, 800); ctx.rect(-Math.floor(gw / 2), -Math.floor(gh / 2), gw, gh);
  ctx.clip('evenodd');
  leaveFaceKeepClip(ctx, rig, J.eye.x, J.eye.y);
  FACE_FLIP = 1;
}

/** Walk the transform from face space (enterFace at root (X, Y)) back to root space WITHOUT a restore. */
function leaveFaceKeepClip(ctx: CanvasRenderingContext2D, rig: DragonRig, X: number, Y: number): void {
  const t = rig.tf;
  const dx = t.fs * (t.rx + X * t.c - Y * t.s), dy = t.ss * (t.ry + X * t.s + Y * t.c);
  ctx.scale(1 / (Math.sign(t.fs) * FACE_FLIP * rig.pxScale), 1 / (t.ss < 0 ? -rig.pxScale : rig.pxScale));
  ctx.translate(-Math.round(dx), -Math.round(dy));
  ctx.scale(t.fs, t.ss); ctx.translate(t.rx, t.ry); ctx.rotate(rad(t.rot));
}

/** Convenience: a rig at a pose's joints without drawing (tools, hit tests). */
export function solveDragon(rig: DragonRig, pose: DragonPose | PartialDragonPose, o: DrawDragonOpts): DragonJoints {
  const P = resolve(rig, pose);
  setTransform(rig, P, o);
  return computeDragonJoints(rig, P);
}
