// Two-bone IK for the engine's humanoid rig (src/lib/art/rig.ts computeJoints), solved in the rig's ROOT space.
//
// The engine rig is pure FK: a leg is `upper` (the thigh's angle from straight down, + forward) and `lower` (the shin's
// angle RELATIVE to the thigh), an arm the same relative to the torso's lean. The keepers need two things FK cannot
// give on its own (docs/KEEPERS.md K6):
//   - PLANTED FEET. A walk whose stance foot slides back at exactly the walk speed, and a kneel whose feet stay put
//     while the hips drop, are authored as ankle targets and solved here into angles at bake time, the dragons'
//     planted-paw rule (bible 1.1) on two legs: a foot on the floor never skates.
//   - A HAND THAT FINDS ITS MARK. A pet strokes a dragon's crown wherever the dragon's own pet anim has put its head,
//     and a set-down meets the bowl's spot on the floor, so the reaching arm is solved at run time toward a point.
// The engine's own two-bone solve lives inside computeJoints (the two-handed weapon grip) and is not exported; this is
// the same maths, for either limb, written once. Nothing here touches a rig: it reads proportions and writes angles.
import { clamp } from '../../lib/engine/math.ts';
import type { Proportions } from '../../lib/art/rig.ts';

const D = 180 / Math.PI;
const sinD = (a: number): number => Math.sin(a / D);
const cosD = (a: number): number => Math.cos(a / D);

/** The hip line in root space, exactly as buildRig solves it: the legs hang straight to leave the sole on y = 0. */
export function hipYOf(p: Readonly<Proportions>): number { return -(p.upperLeg + p.lowerLeg + p.footH - 2); }

/** Where a planted ankle sits in root space (the sole's ink on the ground row: parts.ts drawShoe). */
export function ankleYOf(p: Readonly<Proportions>): number { return hipYOf(p) + p.upperLeg + p.lowerLeg; }

/** An engine limb's two angles: `upper` absolute from straight down (+ forward), `lower` relative to it. */
export interface LimbAngles { upper: number; lower: number }

/**
 * Solve a two-bone chain from a joint at (jx, jy) to a target at (tx, ty) (root space, y down): bone lengths l1, l2,
 * the middle joint bent to `bend` (+1 = forward of the joint-to-target line: a knee; -1 = back and down: an elbow). A
 * target out of reach is met by the straight limb pointing at it (the foot or hand stops short rather than the limb
 * stretching). Writes the absolute first angle and the second RELATIVE to it, the engine convention.
 */
export function solveTwoBone(jx: number, jy: number, tx: number, ty: number, l1: number, l2: number, bend: number, out: LimbAngles): LimbAngles {
  const dx = tx - jx, dy = ty - jy;
  const d = clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + 0.001, l1 + l2 - 0.001);
  const line = Math.atan2(dx, dy) * D;
  const a = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1)) * D;
  const upper = line + bend * a;
  const kx = jx + sinD(upper) * l1, ky = jy + cosD(upper) * l1;
  // the second bone aims at the target itself, clamped onto the reachable circle (a target past the reach makes both
  // bones point at it, and one inside the minimum folds the limb)
  const ex = jx + (dx / (Math.hypot(dx, dy) || 1)) * d, ey = jy + (dy / (Math.hypot(dx, dy) || 1)) * d;
  const second = Math.atan2(ex - kx, ey - ky) * D;
  out.upper = upper;
  out.lower = wrap(second - upper);
  return out;
}

/** An angle into (-180, 180]. */
function wrap(a: number): number { a %= 360; return a > 180 ? a - 360 : a <= -180 ? a + 360 : a; }

/**
 * Put a leg's ankle on (ax, ay), root space, with the knee forward (engine `legR` is the near leg at +hipX, `legL`
 * the far one at -hipX). `rootY` is the pose's root.y: it moves the whole sprite, feet included, so a crouch keyed as
 * root.y + d asks for the ankle d px higher in root space to keep it on the same spot of floor.
 */
export function solveLeg(p: Readonly<Proportions>, near: boolean, ax: number, ay: number, out: LimbAngles): LimbAngles {
  return solveTwoBone(near ? p.hipX : -p.hipX, hipYOf(p), ax, ay, p.upperLeg, p.lowerLeg, 1, out);
}

/**
 * The shoulder joint in root space for a torso lean `rot` (degrees, + forward) and offset (tx, ty), exactly as
 * computeJoints places it (near: +shoulderX; far: -shoulderX - 2 and 1 px lower).
 */
export function shoulderOf(p: Readonly<Proportions>, near: boolean, rot: number, tx: number, ty: number, out: { x: number; y: number }): { x: number; y: number } {
  const c = cosD(rot), s = sinD(rot), shY = -(p.torsoH - 5) + (near ? 0 : 1), sx = near ? p.shoulderX : -p.shoulderX - 2;
  const px = tx, py = hipYOf(p) + ty;
  out.x = px + sx * c - shY * s; out.y = py + sx * s + shY * c;
  return out;
}

const SH = { x: 0, y: 0 };
/**
 * Put a hand on (hx, hy), root space: the arm is solved from its shoulder with the elbow hanging back and down (the
 * natural bend), the forearm's length taken to the hand's centre (computeJoints puts the fist 0.6 of its radius past
 * the wrist, along the forearm). Writes the pose's arm angles: `upper` RELATIVE to the torso's lean, as the engine
 * reads it (ang.upper = torso.rot + arm.upper).
 */
export function solveArm(p: Readonly<Proportions>, near: boolean, torsoRot: number, torsoX: number, torsoY: number, hx: number, hy: number, out: LimbAngles): LimbAngles {
  shoulderOf(p, near, torsoRot, torsoX, torsoY, SH);
  solveTwoBone(SH.x, SH.y, hx, hy, p.upperArm, p.lowerArm + p.handR * 0.6, -1, out);
  out.upper -= torsoRot;
  return out;
}

/** How far a hand can reach from its shoulder (the arm straight, to the fist's centre). */
export function armReach(p: Readonly<Proportions>): number { return p.upperArm + p.lowerArm + p.handR * 0.6; }
