// Life stages: the proportion sets of docs/ART_BIBLE.md 2.1 / 2.2, the element modifiers of 2.3, the tail rest
// shapes, the 4.1 tail-chain parameters and the stage timing rules.
//
// Stages are authored at scale 1 as SEPARATE proportion sets, never as a scaled-down adult (bible "Decisions"): a
// baby is a different body plan (pot belly, head on the chest, nub wings), not a small adult. Every number below
// is the fire reference; build.ts multiplies in the element's modifiers (half strength on babies) and solves the
// body height from the hind leg so the paws plant on y = 0.
import type { DragonElement } from './palettes.ts';

export const STAGES = ['baby', 'young', 'adult'] as const;
export type Stage = typeof STAGES[number];

/** One leg pair's dimensions (bible 2.1). Angles in the engine convention: 0 = down, + forward, lower RELATIVE. */
export interface LegDims {
  /**
   * Joint x offset beyond +-gap/2 (does not scale with the body-length modifier: 2.1 note). 6 / 4.25 / 3.25: at the
   * rest-pose values (4 / 2.25 / 1.75) the near hind paw landing forward met the near front paw still lingering at
   * the back of its stroke, and every walk fused the near pair into one Lambda for a key or two (5.1 #5); these
   * keep >= 3 px of background between them near the floor at every frame of all 18 walks.
   */
  X: number;
  /** Joint y in body space (+ = below the body centre). */
  y: number;
  /** Upper / lower bone lengths. */
  upper: number;
  lower: number;
  /** Rest angles, degrees. */
  restUpper: number;
  restLower: number;
  /** Root and ankle radius and the bulge profile (parts.ts legRadii: r1 = r2 is the engine's limbRadii). */
  r1: number;
  r2: number;
  bulge: number;
  /** Paw box. */
  pawW: number;
  pawH: number;
}

/** The skull and jaw in cranium space (origin at the cranium centre, +x toward the snout, y down). */
export interface HeadDims {
  cranR: number;
  /** Cranium centre from the neck end, in head space. */
  fromNeck: readonly [number, number];
  /** Snout taper: from (x0, y0) r0 to (x1, y1) r1. */
  snout: { x0: number; y0: number; x1: number; y1: number; r0: number; r1: number };
  /** Brow-ridge bump in the skull contour, px (0 = none). */
  brow: number;
  /**
   * Jaw taper from the hinge (hx, hy) r0 to the tip (tx, ty) r1, drawn under the skull. An OPEN jaw also drops
   * `drop` px before it turns about its hinge: closed, the jaw's top edge lies ~2 px inside the skull (a 1 px sliver
   * shows) and the mouth loses 2 px to the skull's and the jaw's own ink, so a jaw that only turned showed no mouth
   * colour at all at its minimum (baby 20 deg: none; young 14, adult 10: none either). The dropped hinge hides under
   * the cranium's round bottom (a 1-2 px jowl at most).
   */
  jaw: { hx: number; hy: number; tx: number; ty: number; r0: number; r1: number; drop: number };
  /** Jaw opening range, degrees: max, and the minimum any open frame lifts to (1.2). */
  jawMax: number;
  jawMin: number;
  /** Eye: outer size including the ink ring, centre in cranium space. */
  eye: { w: number; h: number; x: number; y: number };
  /** Brow bar length (2 px thick, 1 px above the ring); 0 = only in expressions. */
  browLen: number;
  teeth: 'egg' | 'fang1' | 'fang2';
}

/** Bat-wing bones (2.1 / 2.2). Babies have none: a nub (NubDims). */
export interface WingDims {
  /** Root in body space. */
  root: readonly [number, number];
  humerus: number;
  forearm: number;
  /** Arm and spar radius (the arm is drawn 2r wide, un-inked, in scale). */
  armR: number;
  sparR: number;
  /** Spar lengths leading -> trailing, for the stage's standard and "+1 spar" (water, shriekscale) wing. */
  spars: readonly number[];
  sparsPlus: readonly number[];
  /** Membrane attach point on the body, from the root. */
  attach: readonly [number, number];
}

/** Bone angles (elevation from +x, + up) folded and spread, lerped by the `wing.fold` channel (2.2). */
export interface WingAngles {
  humerus: readonly [number, number];
  forearm: readonly [number, number];
  /** [folded, spread] per spar, for the standard spar count. */
  spars: readonly (readonly [number, number])[];
  sparsPlus: readonly (readonly [number, number])[];
}

/** The baby nub: one 7 x 5 polygon, no bones (2.1, 1.3). */
export interface NubDims {
  root: readonly [number, number];
  w: number;
  h: number;
  /** Rest angle and the flutter / happy angle (elevation, degrees). */
  rest: number;
  lift: number;
}

export interface StageDims {
  stage: Stage;
  // ---- body (body space: origin at the body centre, y down) ----
  hipR: number;
  chestR: number;
  /** Ball gap, centre to centre: hip at -gap/2, chest at +gap/2 and 1 px higher (a proud chest). */
  gap: number;
  /** The baby belly-sag ellipse, part of the same body path. */
  sag: { rx: number; ry: number; cy: number } | null;
  /** Belly band: the lower fraction of the chest depth (38 %, babies 45 %). */
  bellyFrac: number;
  // ---- neck ----
  neck: {
    n: number;
    len: number;
    r0: number;
    r1: number;
    /** Root in body space, and how far the tube is sunk into the chest along its axis. */
    root: readonly [number, number];
    sink: number;
    /** Rest elevation per segment (degrees from +x, + up; absolute). */
    rest: readonly number[];
    /** Head pitch at rest, degrees (+ = snout down). */
    headPitch: number;
    /** True when the neck is hidden under the head (baby): only its contour contributes. */
    hidden: boolean;
  };
  head: HeadDims;
  hind: LegDims;
  front: LegDims;
  claws: { w: number; h: number } | null;
  tail: { n: number; len: number; r0: number; r1: number; sink: number };
  wing: WingDims | null;
  nub: NubDims | null;
  /** Ground shadow: (body length + extra) x h. */
  shadow: { extra: number; h: number };
}

const B: StageDims = {
  stage: 'baby',
  hipR: 6.5, chestR: 7.5, gap: 5, sag: { rx: 10, ry: 4, cy: 3.5 }, bellyFrac: 0.45,
  neck: { n: 1, len: 3, r0: 5.5, r1: 5, root: [5, -5], sink: 2, rest: [70], headPitch: 0, hidden: true },
  head: {
    cranR: 8.5, fromNeck: [1, -3],
    snout: { x0: 1.5, y0: 1.5, x1: 6.5, y1: 2, r0: 5, r1: 4 }, brow: 0,
    jaw: { hx: 0.5, hy: 4.5, tx: 7, ty: 5.2, r0: 2.5, r1: 1.5, drop: 4 }, jawMax: 40, jawMin: 20,
    eye: { w: 7, h: 8, x: 2, y: 0 }, browLen: 0, teeth: 'egg',
  },
  hind: { X: 6, y: 3, upper: 4, lower: 4, restUpper: 20, restLower: -30, r1: 2.6, r2: 2.6, bulge: 0.6, pawW: 5, pawH: 3 },
  front: { X: 6, y: 3, upper: 4, lower: 4, restUpper: -5, restLower: 10, r1: 2.4, r2: 2.4, bulge: 0.5, pawW: 5, pawH: 3 },
  claws: null,
  tail: { n: 3, len: 5.5, r0: 4, r1: 2, sink: 1.5 },
  wing: null,
  nub: { root: [1, -6], w: 7, h: 5, rest: 170, lift: 140 },
  shadow: { extra: 6, h: 2 },
};

const Y: StageDims = {
  stage: 'young',
  hipR: 7, chestR: 8.5, gap: 14, sag: null, bellyFrac: 0.38,
  neck: { n: 2, len: 6, r0: 5, r1: 4, root: [10, -5], sink: 2, rest: [70, 45], headPitch: 4, hidden: false },
  head: {
    cranR: 9, fromNeck: [1.5, -2],
    snout: { x0: 2.5, y0: 1, x1: 11.5, y1: 1.5, r0: 5.5, r1: 4 }, brow: 1,
    jaw: { hx: -1, hy: 4.5, tx: 10, ty: 5, r0: 3, r1: 2, drop: 3 }, jawMax: 34, jawMin: 20,
    eye: { w: 7, h: 7, x: 2.5, y: -1 }, browLen: 5, teeth: 'fang1',
  },
  hind: { X: 4.25, y: 2, upper: 8, lower: 7.5, restUpper: 35, restLower: -70, r1: 4.2, r2: 3, bulge: 0.8, pawW: 7, pawH: 3 },
  front: { X: 4.25, y: 2, upper: 7, lower: 7.5, restUpper: -10, restLower: 20, r1: 3.7, r2: 3.2, bulge: 0.5, pawW: 6, pawH: 3 },
  claws: { w: 2, h: 2 },
  tail: { n: 5, len: 6.5, r0: 4.5, r1: 1.5, sink: 2 },
  wing: { root: [4, -8], humerus: 6, forearm: 8, armR: 1, sparR: 1, spars: [14, 11], sparsPlus: [14, 11, 9], attach: [-10, 1] },
  nub: null,
  shadow: { extra: 8, h: 3 },
};

const A: StageDims = {
  stage: 'adult',
  hipR: 9, chestR: 11, gap: 19, sag: null, bellyFrac: 0.38,
  neck: { n: 2, len: 9, r0: 6.5, r1: 4.5, root: [13, -7], sink: 3, rest: [65, 35], headPitch: 10, hidden: false },
  head: {
    cranR: 9.5, fromNeck: [2, -2],
    snout: { x0: 3, y0: 1, x1: 15, y1: 2, r0: 6, r1: 3.5 }, brow: 2,
    jaw: { hx: -1, hy: 5, tx: 13, ty: 5.5, r0: 3.5, r1: 2, drop: 3 }, jawMax: 30, jawMin: 16,
    eye: { w: 8, h: 6, x: 3, y: -2 }, browLen: 6, teeth: 'fang2',
  },
  hind: { X: 3.25, y: 3, upper: 10, lower: 9, restUpper: 35, restLower: -70, r1: 5.8, r2: 4.1, bulge: 0.8, pawW: 9, pawH: 4 },
  front: { X: 3.25, y: 3, upper: 9, lower: 8.5, restUpper: -10, restLower: 20, r1: 4.7, r2: 4, bulge: 0.5, pawW: 8, pawH: 4 },
  claws: { w: 2, h: 3 },
  tail: { n: 6, len: 7, r0: 5.5, r1: 1.5, sink: 2 },
  wing: { root: [5, -9], humerus: 9, forearm: 12, armR: 1.5, sparR: 1.5, spars: [20, 17, 13], sparsPlus: [20, 17, 14, 11], attach: [-16, 1] },
  nub: null,
  shadow: { extra: 10, h: 4 },
};

/** The 2.1 proportion tables (fire reference). */
export const STAGE_DIMS: Readonly<Record<Stage, Readonly<StageDims>>> = Object.freeze({ baby: B, young: Y, adult: A });

/** 2.2 bone angles, [folded, spread]. */
export const WING_ANGLES: Readonly<Record<'young' | 'adult', Readonly<WingAngles>>> = Object.freeze({
  // spread, the fan opens over ~100 deg, the trail spar reaching level back: over 70 deg (lead 95 -> trail 165) the
  // spread wing was a narrow upright sail, 16 x 40 px, and with its spars poking out, a rake
  young: {
    humerus: [165, 110], forearm: [18, 80],
    spars: [[198, 88], [212, 178]],
    sparsPlus: [[198, 88], [208, 133], [218, 180]],
  },
  adult: {
    humerus: [165, 110], forearm: [18, 80],
    spars: [[198, 85], [212, 133], [226, 182]],
    sparsPlus: [[198, 85], [208, 118], [218, 150], [228, 184]],
  },
});

/**
 * Element proportion modifiers (2.3): multipliers on 2.1, each within 0.7..1.3, applied at HALF strength on babies
 * (`1 + (m - 1) / 2`). `neckAngle` is degrees added to the neck elevations (rock's head-low -25), also halved on
 * babies. The optional fields are the table's special cases.
 */
export interface ElementModifiers {
  bodyLength: number;
  bodyDepth: number;
  legLength: number;
  legR: number;
  neckLength: number;
  neckAngle: number;
  tailLength: number;
  tailR: number;
  snout: number;
  /** Snout tip radius as a fraction of its root radius (rock's boxy 0.9); omitted = the stage table's taper. */
  snoutTaper?: number;
  /** Jaw radius multiplier (shriekscale 1.3). */
  jawDepth?: number;
  /** Adult jaw maximum override (shriekscale 40). */
  jawMax?: number;
  /** Cap on the tail tip radius (rock 2: water's zone rule, <= 4 px wide). */
  tailTipRMax?: number;
  /**
   * px the neck root sits LOWER on the chest front (rock's head-low turtle carriage: 3.4 "head carried below the
   * dome top"); halved on babies like neckAngle. A short neck (rock's x 0.7) barely lowers the head by angle alone.
   */
  neckDrop?: number;
}

export const NO_MODIFIERS: Readonly<ElementModifiers> = Object.freeze({
  bodyLength: 1, bodyDepth: 1, legLength: 1, legR: 1, neckLength: 1, neckAngle: 0, tailLength: 1, tailR: 1, snout: 1,
});

/** A modifier as a stage sees it: full strength, or half on a baby. */
export function stageMod(m: number, stage: Stage): number { return stage === 'baby' ? 1 + (m - 1) / 2 : m; }

/** Tail rest shape: first-segment angle and bend added per segment (degrees; + droops, - lifts; 1.1). */
export interface TailRest {
  first: number;
  bend: number;
}

/**
 * The tail rest shapes of 2.3 (adult column and the young note) and the baby rest shapes below the table. Young
 * adults other than fire's and rock's are not listed in the bible and take the adult shape (rock's young curls a
 * little sooner, so its adult stays >= 1.29x as long: 5.1 #3). Element files read these, and an element artist may
 * override their own row there.
 */
export const TAIL_REST: Readonly<Record<DragonElement, Readonly<Record<Stage, Readonly<TailRest>>>>> = Object.freeze({
  fire: { baby: { first: -10, bend: -25 }, young: { first: 0, bend: -10 }, adult: { first: 0, bend: -9 } },
  spike: { baby: { first: -5, bend: -15 }, young: { first: 5, bend: 0 }, adult: { first: 5, bend: 0 } },
  rock: { baby: { first: 30, bend: 12 }, young: { first: 14, bend: 9 }, adult: { first: 10, bend: 7 } },
  lightning: { baby: { first: -12, bend: 0 }, young: { first: -5, bend: 0 }, adult: { first: -5, bend: 0 } },
  water: { baby: { first: 0, bend: 0 }, young: { first: 0, bend: 0 }, adult: { first: 0, bend: 0 } },
  shriekscale: { baby: { first: -5, bend: -15 }, young: { first: 15, bend: -4 }, adult: { first: 15, bend: -4 } },
});

/** 4.1 tail chain (secondary.ts getChain options) per stage. `maxAng` 30 keeps a tail from folding through the body. */
export interface TailChainParams {
  stiffness: number;
  damping: number;
  gain: number;
  follow: number;
  maxAng: number;
}
export const TAIL_CHAIN: Readonly<Record<Stage, Readonly<TailChainParams>>> = Object.freeze({
  baby: { stiffness: 0.20, damping: 0.65, gain: 2.6, follow: 0.15, maxAng: 30 },
  young: { stiffness: 0.14, damping: 0.70, gain: 2.2, follow: 0.35, maxAng: 30 },
  adult: { stiffness: 0.10, damping: 0.78, gain: 1.6, follow: 0.5, maxAng: 30 },
});

/** 4.1 stage timing rules, for anims.ts to author every stage from one adult table. */
export interface StageTiming {
  /** Duration multiplier against the adult. */
  dur: number;
  /** Allowed squash range. */
  squash: readonly [number, number];
  /** Head lag behind the body: frames, and amplitude multiplier. */
  headLag: number;
  headAmp: number;
  /** Default easing: babies bounce out, adults move with weight, young adults overshoot. */
  ease: 'out' | 'inout' | 'overshoot';
}
export const STAGE_TIMING: Readonly<Record<Stage, Readonly<StageTiming>>> = Object.freeze({
  baby: { dur: 0.6, squash: [0.85, 1.15], headLag: 6, headAmp: 2, ease: 'out' },
  young: { dur: 0.85, squash: [0.94, 1.06], headLag: 7, headAmp: 1.5, ease: 'overshoot' },
  adult: { dur: 1, squash: [0.96, 1.04], headLag: 8, headAmp: 1, ease: 'inout' },
});
