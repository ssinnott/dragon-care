// The keepers' animation set (docs/KEEPERS.md 5), authored for the engine's humanoid rig and baked into its own frame
// format (src/lib/art/animation.ts Frame: dur, pose, face, move, event) at 60 Hz.
//
// HOW AN ANIM IS WRITTEN. Each anim is a function of the frame, t, returning a KPose: the torso, head and arm angles
// as the engine keys them, and -- where a limb must land somewhere -- a TARGET instead of angles:
//   - footN / footF: where each foot is on the floor (x from its hip's rest spot, a lift off the floor, a tilt), solved
//     into leg angles by ik.ts at bake time. A planted foot stays where it is while the body moves over it: the walk's
//     stance foot slides back at exactly the walk speed, the kneel's feet hold their spots as the hips drop. This is
//     the dragons' planted-paw rule (bible 1.1) on two legs, and it is what makes a keeper's feet never skate.
//   - reachN / reachF: where a hand goes, in GROUND space (the keeper's floor point, facing +x, y up negative), solved
//     into arm angles with the elbow hanging back and down. The bowl a set-down places on the floor meets the floor
//     spot exactly; a pet's hand is re-solved every tick toward the dragon's crown (src/care/acts.ts), on top of this.
// `bake` samples the function every frame (a walk) or every 2 frames with the engine's lerp between (the rest), and
// writes `move` (px per frame along facing) for the owner to move the keeper by.
//
// TIMING (the dragons' 4.1 stage rules, on people): every duration is x the keeper's tempo (Pip 0.8, Tomas 1, Iris 1.1,
// Bea 1.2). The elder keeps the elder dragons' rule (bible D21): unhurried, never frail -- no stoop, no shuffle, no
// hand to the back; she kneels as the others do, a little more slowly.
import { clamp } from '../../lib/engine/math.ts';
import { ease } from '../../lib/art/poses.ts';
import type { EaseName, PartialPose } from '../../lib/art/poses.ts';
import type { Anim, AnimSet, Frame } from '../../lib/art/animation.ts';
import { DEFAULT_PROPORTIONS } from '../../lib/art/rig.ts';
import type { Proportions } from '../../lib/art/rig.ts';
import { solveLeg, solveArm, shoulderOf, ankleYOf, hipYOf, armReach } from './ik.ts';
import type { LimbAngles } from './ik.ts';
import { KFACE, BOWL_AHEAD, BOWL_UNDER } from './parts.ts';
import type { KeeperSpec } from './cast.ts';

/** A foot on the floor, ground space: x from its hip's rest spot (+ forward), px lifted off the floor, tilt (+ toe up). */
export interface FootT { x: number; lift: number; tilt: number }
/** A hand target in ground space: from the keeper's floor point, facing +x, y up negative. */
export interface HandT { x: number; y: number }

/** One authored instant of a keeper anim. Angles in degrees; every field optional (the rest pose fills it). */
export interface KPose {
  /** Root offset: `rootY` + lowers the whole body over its planted feet (a crouch, a kneel, the walk's dip). */
  rootX?: number;
  rootY?: number;
  /** Torso lean (+ forward) and offset; head turn (+ chin down). */
  torso?: number;
  torsoX?: number;
  torsoY?: number;
  head?: number;
  /** Arms by angle: [upper, lower], upper relative to the torso's lean, lower relative to the upper (engine keys). */
  armN?: readonly [number, number];
  armF?: readonly [number, number];
  handN?: number;
  handF?: number;
  /** Arms by target (ground space), overriding armN / armF. */
  reachN?: HandT;
  reachF?: HandT;
  /** Feet by target (the rest spot when absent: every keeper foot is planted unless an anim lifts it). */
  footN?: FootT;
  footF?: FootT;
  weapon?: number;
  grip?: number;
  squash?: number;
  face?: number;
}

/** Proportions resolved the engine's way (DEFAULT_PROPORTIONS with the keeper's overrides). */
export function propsOf(sp: Readonly<KeeperSpec>): Proportions { return { ...DEFAULT_PROPORTIONS, ...sp.proportions }; }

// ---------- resolving a KPose into the engine's pose ----------

const REST: FootT = Object.freeze({ x: 0, lift: 0, tilt: 0 });
const LA: LimbAngles = { upper: 0, lower: 0 };
const D = Math.PI / 180;

/**
 * How far a foot tilted by `tilt` (+ toe up) pushes its sole's lowest corner under the ankle's rest line, px: the ankle
 * is lifted by this much, so a rolling heel-strike or a toe-off pivots on the floor instead of through it. The sole's
 * corners are parts.ts drawKeeperShoe's (heel 0.4 L back, toe 0.6 L forward, the sole footH - 2 under the ankle).
 */
function soleDip(p: Proportions, tilt: number): number {
  if (!tilt) return 0;
  const th = -tilt * D, sole = p.footH - 2, heel = Math.round(p.footL * 0.4), toe = Math.round(p.footL * 0.6);
  const s = Math.sin(th), c = Math.cos(th);
  return Math.max(0, Math.max(-heel * s, toe * s) + sole * c - sole);
}

/** Resolve an authored instant into the engine's partial pose (legs and reaching arms solved by IK). */
export function resolveKPose(p: Proportions, kp: KPose): PartialPose {
  const rx = kp.rootX ?? 0, ry = kp.rootY ?? 0, torso = kp.torso ?? 0, tx = kp.torsoX ?? 0, ty = kp.torsoY ?? 0;
  const leg = (near: boolean) => {
    const f = (near ? kp.footN : kp.footF) ?? REST;
    const ax = (near ? p.hipX : -p.hipX) + f.x - rx, ay = ankleYOf(p) - ry - f.lift - soleDip(p, f.tilt);
    solveLeg(p, near, ax, ay, LA);
    return { leg: { upper: LA.upper, lower: LA.lower }, foot: { rot: f.tilt - (LA.upper + LA.lower) * 0.35 } };
  };
  const arm = (near: boolean): { upper: number; lower: number } => {
    const r = near ? kp.reachN : kp.reachF;
    if (r) { solveArm(p, near, torso, tx, ty, r.x - rx, r.y - ry, LA); return { upper: LA.upper, lower: LA.lower }; }
    const a = (near ? kp.armN : kp.armF) ?? (near ? ARM_REST_N : ARM_REST_F);
    return { upper: a[0], lower: a[1] };
  };
  const n = leg(true), f = leg(false);
  return {
    root: { x: rx, y: ry, rot: 0 }, torso: { rot: torso, x: tx, y: ty }, head: { rot: kp.head ?? 0, x: 0, y: 0 },
    armR: arm(true), armL: arm(false), handR: { rot: kp.handN ?? 0 }, handL: { rot: kp.handF ?? 0 },
    legR: n.leg, legL: f.leg, footR: n.foot, footL: f.foot,
    weapon: { rot: kp.weapon ?? 0 }, grip: kp.grip ?? 0, squash: kp.squash ?? 1, face: kp.face ?? KFACE.smile,
  };
}

/**
 * The arms at rest: the near arm hanging a little forward, the far arm back (the engine's DEFAULT_POSE convention, +20
 * / -20), so the far hand shows behind the seat instead of hanging against the thighs, where its darker far skin read
 * as a stain on the trousers.
 */
const ARM_REST_N = [10, 12] as const, ARM_REST_F = [-18, 10] as const;

// ---------- keys and baking ----------

/** An eased key list over time: [t, value, ease into the NEXT key]; before the first and after the last, held. */
export type Keys = readonly (readonly [number, number, EaseName?])[];
export function key(ks: Keys, t: number): number {
  if (t <= ks[0][0]) return ks[0][1];
  for (let i = 0; i < ks.length - 1; i++) {
    const [t0, v0, e] = ks[i], [t1, v1] = ks[i + 1];
    if (t <= t1) return v0 + (v1 - v0) * ease(e ?? 'inout', (t - t0) / Math.max(1e-6, t1 - t0));
  }
  return ks[ks.length - 1][1];
}
/** Keys authored at tempo 1, stretched by k (every duration x the keeper's tempo). */
export function stretch(ks: Keys, k: number): Keys { return ks.map(([t, v, e]) => [t * k, v, e] as const); }

/** What `bake` needs besides the pose function. */
interface BakeOpts {
  len: number;
  loop: boolean;
  /** Sample every `step` frames (1 for a walk, whose planted feet must be exact on every frame). */
  step?: number;
  /** Root motion, px per frame along facing, over the whole anim (a walk's speed), or per frame. */
  move?: number | ((t: number) => number);
  /** One-shot events on the frame they happen (`release` the bowl, `grab` it). */
  events?: readonly (readonly [number, string])[];
}

/** Bake a pose function into the engine's frames. One-shots end on a held frame. */
export function bake(p: Proportions, fn: (t: number) => KPose, o: BakeOpts): Anim {
  const step = o.step ?? 2, L = Math.max(1, Math.round(o.len)), frames: Frame[] = [];
  const evs = [...(o.events ?? [])].map(([t, e]) => [Math.round(t), e] as const);
  // sample points: every `step` frames, and every event's frame, so an event lands exactly
  const at = new Set<number>();
  for (let t = 0; t < L; t += step) at.add(t);
  for (const [t] of evs) if (t < L) at.add(t);
  const ts = [...at].sort((a, b) => a - b);
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i], dur = (i + 1 < ts.length ? ts[i + 1] : L) - t, kp = fn(t);
    const fr: Frame = { dur, pose: resolveKPose(p, kp), face: kp.face ?? KFACE.smile };
    const mv = typeof o.move === 'function' ? o.move(t) : o.move;
    if (mv) fr.move = mv;
    const ev = evs.find(([te]) => te === t);
    if (ev) fr.event = ev[1];
    frames.push(fr);
  }
  if (!o.loop) {
    const kp = fn(L);
    frames.push({ dur: 1, pose: resolveKPose(p, kp), face: kp.face ?? KFACE.smile, interp: false });
  }
  return { loop: o.loop, frames };
}

// ---------- the poses the anims share ----------

/** Where a keeper carries a bowl (ground space): in front at the waist, the elbows bent. */
export function carrySpot(p: Proportions): HandT { return { x: Math.round(p.torsoW / 2 + 3), y: Math.round(hipYOf(p) - p.torsoH * 0.28) }; }

/** Where a keeper's own mouth is in root space at rest (the shh finger's target): the head's centre + (0.45 r, 0.55 r). */
function mouthSpot(p: Proportions): HandT {
  const headY = hipYOf(p) - p.torsoH + 2 - p.neck - p.headR;
  return { x: Math.round(p.headR * 0.95 + 2), y: Math.round(headY + p.headR * 0.5) };
}

/** The mouth spot with the torso leaned `lean` deg forward about the hips and the body lowered `rootY` (ground space). */
function mouthAt(p: Proportions, lean: number, rootY: number): HandT {
  const m = mouthSpot(p), hy = hipYOf(p), h = hy - m.y, a = lean * D;
  return { x: m.x * Math.cos(a) + h * Math.sin(a), y: hy - h * Math.cos(a) + m.x * Math.sin(a) + rootY };
}

/**
 * The KNEEL at depth e (0 standing .. 1 kneeling), the care pose (docs/KEEPERS.md K7): the near knee on the floor
 * with its shin laid back along it and the toes tucked, the far foot a step forward with its knee up, the body over
 * them. `lift` raises the near foot on the way down and up (it leaves its spot); the far foot slides to its step with
 * a lift too. Returns the hips' drop and both feet; the caller adds the torso and the arms.
 */
export function kneelKP(p: Proportions, e: number, lift = true, both = false): KPose {
  // the hips come down until the near knee rests on the floor (the thigh near upright, its radius under the knee)
  const drop = Math.max(0, -hipYOf(p) - (p.upperLeg + p.legR - 0.5));
  const back = -p.lowerLeg * 0.8 - p.hipX + 2, step = p.upperLeg * 0.75;
  const arc = lift ? Math.sin(Math.PI * clamp(e, 0, 1)) : 0;
  return {
    rootY: drop * e,
    // (the near foot turns toes-down behind the knee, tilt -100: its sole-dip lifts the ankle so the toes rest on the
    // floor and the shin lies along it)
    footN: { x: back * e, lift: arc * 4, tilt: -100 * e },
    // `both`: the far knee goes down too, a beat behind (its foot mirrored behind its own hip), so no knee stands up in
    // front: beside a baby dragon the raised far knee came up to its eye (K7)
    footF: both ? { x: (back + 2 * p.hipX) * e, lift: lift ? Math.sin(Math.PI * clamp(e * 1.15 - 0.15, 0, 1)) * 4 : 0, tilt: -100 * clamp(e * 1.15 - 0.15, 0, 1) }
      : { x: step * e, lift: arc * 3, tilt: 0 },
    torso: 6 * e,
  };
}

/**
 * The least torso lean (0..maxLean) that puts a ground-space hand target within the arm's reach (1 px short of
 * straight) from a body posed as `base` (its root drop and torso offset): a keeper bends as far as the reach needs.
 */
export function leanFor(p: Proportions, base: KPose, target: HandT, near = true, maxLean = 55): number {
  const reach = armReach(p) - 1, sh = { x: 0, y: 0 };
  const rx = base.rootX ?? 0, ry = base.rootY ?? 0;
  for (let a = base.torso ?? 0; a <= maxLean; a += 1) {
    shoulderOf(p, near, a, base.torsoX ?? 0, base.torsoY ?? 0, sh);
    if (Math.hypot(target.x - rx - sh.x, target.y - ry - sh.y) <= reach) return a;
  }
  return maxLean;
}

// ---------- the anims ----------

/** A keeper's walk cycle length, frames: the stride at its speed (2 steps). */
export function walkLen(sp: Readonly<KeeperSpec>): number { return Math.round(sp.stride / sp.speed); }

interface WalkOpts {
  /** Hold the bowl in front instead of swinging the arms. */
  carry?: boolean;
  /** On the toes (a tiptoe away from a sleeping dragon): heels up, higher, slower. */
  tiptoe?: boolean;
}

/**
 * The WALK (loop): a heel-toe gait, stance 60 % / swing 40 %, the feet half a cycle apart. A stance foot slides back
 * under the body at exactly the walk speed (planted: it holds still on the floor), rolls from heel to flat to toe; a
 * swing foot leaves with its toe down, arcs forward 3 px up (the child 2.5, the tiptoe 4) and meets the floor toe-up.
 * The body dips where the stance leg must reach (the double support) and rides highest over the planted foot, 1 px
 * of that the knees' own give; the arms swing against the legs (or hold the bowl, or, on tiptoe, a finger stays at
 * the lips); the head counters the bob.
 */
function walkKP(sp: Readonly<KeeperSpec>, p: Proportions, t: number, o: WalkOpts): KPose {
  const L = walkLen(sp) * (o.tiptoe ? 1.4 : 1), S = sp.stride * (o.tiptoe ? 0.6 : 1), st = 0.6, A = (st * S) / 2;
  const lift = o.tiptoe ? 4 : sp.age === 'child' ? 2.5 : 3;
  const foot = (ph: number): FootT => {
    if (ph < st) {
      const s = ph / st;
      const tilt = o.tiptoe ? -28 : s < 0.14 ? 10 * (1 - s / 0.14) : s > 0.72 ? -16 * ((s - 0.72) / 0.28) : 0;
      return { x: A - 2 * A * s, lift: 0, tilt };
    }
    const s = (ph - st) / (1 - st), sm = s * s * (3 - 2 * s);
    return { x: -A + 2 * A * sm, lift: lift * Math.sin(Math.PI * s), tilt: o.tiptoe ? -28 : -16 + 26 * sm };
  };
  const u = (t / L) % 1, fN = foot(u), fF = foot((u + 0.5) % 1);
  // the body's dip: the least drop that lets the planted leg reach its foot, plus the knees' own 0.8 px of give
  const Lg = p.upperLeg + p.lowerLeg;
  const need = (f: FootT) => (f.lift > 0.01 ? 0 : Lg - Math.sqrt(Math.max(0, Lg * Lg - f.x * f.x)));
  const rootY = 0.8 + Math.max(need(fN), need(fF)) - (o.tiptoe ? 2 : 0);
  const swing = sp.age === 'elder' ? 14 : sp.age === 'child' ? 24 : 18;
  const kp: KPose = {
    rootY, footN: fN, footF: fF, torso: sp.age === 'child' ? 4 : 3, head: -rootY * 0.8,
    armN: [-swing * (fN.x / A), 14 + 6 * Math.max(0, -fN.x / A)],
    armF: [-swing * (fF.x / A), 14 + 6 * Math.max(0, -fF.x / A)],
    face: o.tiptoe ? KFACE.shh : KFACE.smile,
  };
  if (o.carry) {
    const c = carrySpot(p);
    kp.reachN = { x: c.x, y: c.y + rootY * 0.5 }; kp.grip = 1;
  }
  // the tiptoe: a finger still to the lips (the shh it follows), the far arm out behind for balance (both arms held
  // out in front, it read as a sleepwalker)
  if (o.tiptoe) { kp.torso = 6; kp.reachN = mouthAt(p, 6, rootY); kp.armF = [-24, 30]; }
  return kp;
}

/**
 * The IDLE (loop, 150 f x tempo): a breath (the chest rises a pixel over 70 f, back over 80), the head easing a couple
 * of degrees, the weight shifting a little from foot to foot on a slower beat, each keeper's own hands: Bea's clasped
 * on her apron, Tomas's hanging with the brush, Iris's loose at her sides, Pip's at his sides with a bounce. (Iris's
 * clasped behind her back read as a rucksack at the ÷ 3 size.)
 */
function idleKP(sp: Readonly<KeeperSpec>, p: Proportions, t: number, L: number): KPose {
  const u = t / L, breath = key([[0, 0], [0.47, -1], [1, 0]], u), sway = Math.sin(u * Math.PI * 2);
  const kp: KPose = {
    torsoY: breath, head: 2 * Math.sin(u * Math.PI * 2 + 1), rootX: 0.6 * sway,
    footN: { x: 1, lift: 0, tilt: 0 }, footF: { x: -1, lift: 0, tilt: 0 }, face: KFACE.smile,
  };
  const hy = hipYOf(p);
  if (sp.id === 'bea') { kp.reachN = { x: p.torsoW / 2 + 1, y: hy - 1 + breath }; kp.reachF = { x: p.torsoW / 2, y: hy - 2 + breath }; }
  else if (sp.id === 'pip') { kp.rootY = 0.6 + 0.6 * Math.sin(u * Math.PI * 4); kp.armN = [8, 12]; kp.armF = [-18, 10]; }
  else { kp.armN = [8 - breath, 14]; kp.armF = [-18, 10]; }
  return kp;
}

/** Hold the bowl, standing (the idle's legs and breath, the hands at the carry spot, the far hand on the bowl). */
function holdKP(sp: Readonly<KeeperSpec>, p: Proportions, t: number, L: number): KPose {
  const kp = idleKP(sp, p, t, L), c = carrySpot(p);
  kp.reachN = { x: c.x, y: c.y + (kp.torsoY ?? 0) }; kp.reachF = undefined; kp.grip = 1;
  return kp;
}

/**
 * WATCH (loop, 150 f x tempo): standing with the hands together in front, the head tipped 6 deg down to the dragon,
 * the tender `aww` face; what a keeper does while a dragon eats, is groomed by someone else, or falls asleep.
 */
function watchKP(sp: Readonly<KeeperSpec>, p: Proportions, t: number, L: number): KPose {
  const kp = idleKP(sp, p, t, L), hy = hipYOf(p);
  kp.reachN = { x: p.torsoW / 2 + 2, y: hy - 3 + (kp.torsoY ?? 0) }; kp.reachF = { x: p.torsoW / 2 + 1, y: hy - 4 + (kp.torsoY ?? 0) };
  kp.head = 6 + (kp.head ?? 0); kp.face = KFACE.aww;
  return kp;
}

/** The kneel held (loop, both knees down), a breath, the hands resting on the lap. */
function kneelIdleKP(sp: Readonly<KeeperSpec>, p: Proportions, t: number, L: number): KPose {
  const u = t / L, kp = kneelKP(p, 1, false, true);
  kp.torsoY = key([[0, 0], [0.47, -1], [1, 0]], u);
  kp.armF = [14, 44];
  kp.armN = [12, 40];
  kp.face = sp.age === 'child' ? KFACE.happy : KFACE.smile;
  return kp;
}

/**
 * PET (loop, 48 f x tempo), standing or kneeling on both knees (`low`): the body leaned toward the dragon, the far
 * hand at rest; the near arm, keyed at rest, is eased by the care act (acts.ts) onto its mark on the dragon (its head,
 * its neck or its back) and solved there every tick, the act adding the stroke (petStroke). The `aww` face throughout.
 */
function petKP(sp: Readonly<KeeperSpec>, p: Proportions, t: number, L: number, low: boolean, lean: number): KPose {
  const u = t / L, kp = low ? kneelKP(p, 1, false, true) : idleKP(sp, p, t, L);
  kp.torso = lean + 1.5 * Math.sin(u * Math.PI * 2);
  // (the near arm at rest, the hand on the lap or hanging: the care act eases it from here onto its mark. Keyed
  // reaching forward, [60, 20], the settle into the pose swept the fist level across a lying dragon's head)
  kp.armN = low ? [12, 40] : [8, 14]; kp.reachN = undefined; kp.reachF = undefined;
  // (kneeling, the far hand rests on the far thigh just under the hip: keyed by angle, the lap pose's [14, 44] swung
  // forward with the lean and came out in front of the chest, onto a lying dragon's face)
  if (low) kp.reachF = { x: 3, y: hipYOf(p) + (kp.rootY ?? 0) + 3 };
  else kp.armF = [-4, 20];
  kp.face = KFACE.aww;
  return kp;
}

/**
 * The stroke a petting hand adds to its target (ground space, facing +x toward the dragon): back along the crown and
 * forward again over `period` frames, lifting a pixel on the way forward, so the hand strokes rather than rubs.
 */
export function petStroke(t: number, period: number, amp: number): HandT {
  const u = (t % period) / period, back = u < 0.6 ? u / 0.6 : 1 - (u - 0.6) / 0.4;
  const e = back * back * (3 - 2 * back);
  return { x: amp * e, y: u >= 0.6 ? -1 : 0 };
}

/** The SHH (one-shot, 56 f x tempo): the near hand up to the lips, held, eyes shut and a pursed mouth, and down again. */
function shhKP(sp: Readonly<KeeperSpec>, p: Proportions, t: number, k: number): KPose {
  const kp = idleKP(sp, p, t, 150 * k), m = mouthSpot(p), rest = { x: 4, y: hipYOf(p) + 4 };
  const e = key(stretch([[0, 0], [12, 1, 'out'], [44, 1], [56, 0]], k), t);
  kp.reachN = { x: rest.x + (m.x - rest.x) * e, y: rest.y + (m.y - rest.y) * e };
  kp.torso = 3 * e; kp.head = 4 * e;
  kp.face = e > 0.6 ? KFACE.shh : KFACE.smile;
  return kp;
}

/**
 * CHEER (one-shot, 48 f x tempo): the arms up and a little hop (the child's bigger, two of them); the elder claps
 * instead, three claps in front of her chest, never a jump (bible D21). `happy` throughout.
 */
function cheerKP(sp: Readonly<KeeperSpec>, p: Proportions, t: number, k: number): KPose {
  const kp = idleKP(sp, p, t, 150 * k), hy = hipYOf(p);
  kp.face = KFACE.happy;
  if (sp.age === 'elder') {
    const clap = key(stretch([[0, 0], [8, 1], [14, 0.2], [20, 1], [26, 0.2], [32, 1], [40, 0]], k), t);
    kp.reachN = { x: p.torsoW / 2 + 5, y: hy - p.torsoH * 0.55 }; kp.reachF = { x: p.torsoW / 2 + 5 + 4 * (1 - clap), y: hy - p.torsoH * 0.55 + 1 };
    kp.head = -3;
    return kp;
  }
  const hops = sp.age === 'child' ? [[0, 0], [6, 2.5], [12, -5], [18, 0], [22, 2], [28, -4], [34, 0], [48, 0]] as const : [[0, 0], [8, 2], [16, -3], [24, 0], [48, 0]] as const;
  const up = key(stretch([[0, 0], [8, 1, 'out'], [36, 1], [48, 0]], k), t), hop = key(stretch(hops, k), t);
  // a crouch is the root dropping over planted feet (hop > 0); a hop the root rising with the feet lifted as far
  // (hop < 0), so the legs keep their shape in the air
  kp.rootY = hop; kp.footN = { x: 1, lift: Math.max(0, -hop), tilt: 0 }; kp.footF = { x: -1, lift: Math.max(0, -hop), tilt: 0 };
  kp.armN = [30 + 130 * up, 20 - 10 * up]; kp.armF = [20 + 130 * up, 20 - 10 * up];
  kp.head = -6 * up;
  return kp;
}

/** WAVE (one-shot, 60 f x tempo): the near arm up, the hand waving three times from the wrist, `smile`. */
function waveKP(sp: Readonly<KeeperSpec>, p: Proportions, t: number, k: number): KPose {
  const kp = idleKP(sp, p, t, 150 * k);
  const up = key(stretch([[0, 0], [10, 1, 'out'], [50, 1], [60, 0]], k), t);
  kp.reachN = undefined;
  kp.armN = [40 + 110 * up, 20 + 10 * up];
  kp.handN = up * 25 * Math.sin((t / k) * Math.PI * 2 / 14);
  kp.face = KFACE.happy;
  return kp;
}

/** The kneel's transition (one-shot) from `e0` to `e1`, over 20 f x tempo, the arms easing from `a0` to `a1`. */
function kneelMove(sp: Readonly<KeeperSpec>, p: Proportions, t: number, k: number, down: boolean): KPose {
  const L = 20 * k, e = ease('inout', clamp(t / L, 0, 1)), d = down ? e : 1 - e;
  const kp = kneelKP(p, d, true, true);
  kp.armN = [8 + 10 * d, 12 + 18 * d]; kp.armF = [-6 + 12 * d, 12 + 12 * d];
  kp.face = KFACE.smile;
  return kp;
}

/**
 * SET DOWN (one-shot, built per bowl by the care act): from holding the bowl, kneel (20 f), lower it onto its spot
 * `bx` px ahead on the floor (the bowl's foot row on the floor row: the held bowl and the placed bowl are one bowl at
 * `release`), let go, sit back (the hands back to the knee), rise. The torso bends as far as the reach needs (leanFor).
 * `h` is the bowl's height (props.ts BowlSpot). `pick` plays it the other way: kneel with empty hands, `grab`, rise holding.
 */
export function setDownAnim(sp: Readonly<KeeperSpec>, bx: number, h: number, pick = false): Anim {
  const p = propsOf(sp), k = sp.tempo, c = carrySpot(p);
  const T = { down: 22 * k, reach: 40 * k, let: 50 * k, back: 64 * k, rise: 86 * k, end: 96 * k };
  // the hand where the held bowl's foot row lands on the floor row, centred `bx` ahead (parts.ts HELD_BOWL)
  const floorHand: HandT = { x: bx - BOWL_AHEAD, y: -(h + BOWL_UNDER + 1) };
  const lean = leanFor(p, kneelKP(p, 1, false), floorHand);
  const fn = (t: number): KPose => {
    const e = ease('inout', clamp(t / T.down, 0, 1)) - ease('inout', clamp((t - T.rise + 20 * k) / (20 * k), 0, 1));
    const kp = kneelKP(p, clamp(e, 0, 1));
    // the hands: carry spot -> (as the kneel lands) the floor spot -> held there -> back
    const r = key([[0, 0], [T.down * 0.6, 0.15], [T.reach, 1, 'inout'], [T.let, 1], [T.back, 0, 'inout']], t);
    const from = pick ? { x: p.upperLeg * 0.75 + 2, y: -Math.round(p.upperLeg * 0.9 + p.footH) } : c;
    const to = pick ? c : { x: p.upperLeg * 0.75 + 2, y: -Math.round(p.upperLeg * 0.9 + p.footH) };
    const holding = pick ? t >= T.let : t < T.let;
    const rest = t < T.let ? from : to;
    kp.reachN = { x: rest.x + (floorHand.x - rest.x) * r, y: rest.y + (floorHand.y - rest.y) * r };
    kp.torso = 6 * clamp(e, 0, 1) + (lean - 6) * key([[0, 0], [T.down * 0.6, 0.2], [T.reach, 1], [T.let, 1], [T.back, 0]], t);
    kp.grip = holding ? 1 : 0;
    if (!holding) kp.armF = [4, 30];
    kp.head = 8 * r;
    kp.face = r > 0.5 ? KFACE.aww : KFACE.smile;
    return kp;
  };
  return bake(p, fn, { len: T.end, loop: false, events: [[T.let, pick ? 'grab' : 'release']] });
}

/** Every keeper anim that does not depend on a scene (the care acts build the per-bowl set-down and pick-up). */
export function keeperAnims(sp: Readonly<KeeperSpec>): AnimSet {
  const p = propsOf(sp), k = sp.tempo, W = walkLen(sp), IL = Math.round(150 * k);
  const speed = sp.stride / W;
  return {
    idle: bake(p, (t) => idleKP(sp, p, t, IL), { len: IL, loop: true }),
    walk: bake(p, (t) => walkKP(sp, p, t, {}), { len: W, loop: true, step: 1, move: speed }),
    carry: bake(p, (t) => walkKP(sp, p, t, { carry: true }), { len: W, loop: true, step: 1, move: speed }),
    tiptoe: bake(p, (t) => walkKP(sp, p, t, { tiptoe: true }), { len: Math.round(W * 1.4), loop: true, step: 1, move: (sp.stride * 0.6) / Math.round(W * 1.4) }),
    hold: bake(p, (t) => holdKP(sp, p, t, IL), { len: IL, loop: true }),
    watch: bake(p, (t) => watchKP(sp, p, t, IL), { len: IL, loop: true }),
    kneel: bake(p, (t) => kneelMove(sp, p, t, k, true), { len: 20 * k, loop: false }),
    rise: bake(p, (t) => kneelMove(sp, p, t, k, false), { len: 20 * k, loop: false }),
    kneelIdle: bake(p, (t) => kneelIdleKP(sp, p, t, IL), { len: IL, loop: true }),
    pet: bake(p, (t) => petKP(sp, p, t, Math.round(48 * k), false, 10), { len: Math.round(48 * k), loop: true }),
    petLow: bake(p, (t) => petKP(sp, p, t, Math.round(48 * k), true, 14), { len: Math.round(48 * k), loop: true }),
    shh: bake(p, (t) => shhKP(sp, p, t, k), { len: 56 * k, loop: false }),
    cheer: bake(p, (t) => cheerKP(sp, p, t, k), { len: 48 * k, loop: false }),
    wave: bake(p, (t) => waveKP(sp, p, t, k), { len: 60 * k, loop: false }),
  };
}

/** The anims every keeper has, in the order the gallery's keeper sheets show them. */
export const KEEPER_ANIM_NAMES: readonly string[] = ['idle', 'walk', 'carry', 'hold', 'watch', 'kneel', 'kneelIdle', 'rise', 'pet', 'petLow', 'shh', 'tiptoe', 'cheer', 'wave'];
/** The one-shots among them (the gallery replays a one-shot after a pause). */
export const KEEPER_ONE_SHOTS: readonly string[] = ['kneel', 'rise', 'shh', 'cheer', 'wave', 'setDown', 'pickUp'];
