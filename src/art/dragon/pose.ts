// DragonPose: the quadruped's pose channels (docs/ART_BIBLE.md 4.1), the sibling of the engine's humanoid `Pose`.
//
// The engine's makePose / copyPose / lerpPose walk the humanoid's key list, so the dragon gets its own ops with the
// same semantics: a DEFAULT pose every partial is resolved against, allocation-free copy and lerp into a caller's
// object, and STEPPED keys (face, gulp, sleep, tuck) that are held, never interpolated -- a face halfway between
// happy and sad is not a face.
//
// CONVENTIONS (degrees; see bible 1.1):
// - Every rotation channel here is an OFFSET added to the stage's rest shape, so DEFAULT is all zeros and one anim
//   can drive all three stages. Rest angles live in stages.ts.
// - Rotations are screen-clockwise positive when facing right: + pitches FORWARD / DOWN (the engine's "torso positive =
//   lean forward"). The bible's eat ("neck a0 +35, head +25" = head down to the bowl) and breath ("head back -8") read
//   this way. The stage tables' neck and wing ELEVATIONS are counter-clockwise (+ up); the rig converts.
// - Legs: `upper` is added to the thigh / upper-arm angle (0 = hanging down, + swings forward), `lower` to the
//   RELATIVE shin / forearm angle, exactly as the engine's computeJoints adds them. `paw` tilts the paw (+ toe down).
// - Tail: `lift` is added to the first segment and `curl` to every segment's bend (tail angles: + droops, - lifts);
//   `sway` swings the whole tail about its root (+ droops) on top of the secondary-motion chain.

/** Named dragon faces (bible 2.5, D18). Stepped, never interpolated; `face` holds the index. Never angry. */
export const DFACE = Object.freeze({
  neutral: 0, happy: 1, closed: 2, hungry: 3, sleepy: 4, sad: 5, surprised: 6, grumpy: 7, sheepish: 8, scared: 9, dazed: 10,
});
export type DFaceName = keyof typeof DFACE;
/** A face as an index or a DFACE name. */
export type DFaceRef = DFaceName | number;
/** Resolve a face name or index to an index (unknown names = neutral). */
export function dfaceIndex(v: DFaceRef | null | undefined): number {
  return typeof v === 'number' ? v : v != null && DFACE[v] != null ? DFACE[v] : 0;
}

export type DXform = { x: number; y: number; rot: number };
export type DBody = { rot: number; y: number };
export type DNeck = { a0: number; a1: number };
export type DHead = { rot: number };
export type DLeg = { upper: number; lower: number; paw: number };
export type DTail = { lift: number; curl: number; sway: number };
/**
 * `fold` is the bible's `wing` channel: 0 = folded (rest), 1 = fully spread; it lerps the bone angles of 2.2.
 * (Named `fold` for the channel group; read it as "how far unfolded".) `flap` rotates the whole wing about its
 * root, + = up and back, the bible's +-40 deg flight stroke.
 */
export type DWing = { fold: number; flap: number };

/** A fully populated dragon pose: what makeDragonPose allocates and copy / lerp write into. */
export type DragonPose = {
  /** Whole-sprite offset (px, y negative = up) and rotation (+ clockwise = nose down) about the ground point. */
  root: DXform;
  /** x scale about the ground point (volume-preserving: stretch defaults to 1 / squash when left at 1). */
  squash: number;
  stretch: number;
  /** Body pitch about its centre (+ = chest down) and a vertical offset (px, - = up) of the body over the legs. */
  body: DBody;
  /** Per-segment neck pitch, chained: a0 turns the whole neck (and head) from the root, a1 the second segment. */
  neck: DNeck;
  /** Head pitch on top of the neck (+ = snout down). */
  head: DHead;
  /** Jaw opening, degrees. 0, or at least the stage minimum (bible 1.2); the rig lifts anything between to it. */
  jaw: number;
  /** Near hind, near front, far hind, far front (bible names: N/F = near/far, H/F = hind/front). */
  legNH: DLeg;
  legNF: DLeg;
  legFH: DLeg;
  legFF: DLeg;
  tail: DTail;
  wing: DWing;
  /** -1..1, ADDED to the pet's resting mood (drawDragon opts.mood) and clamped: drives the cue as the mood gauge (D7). */
  mood: number;
  /** 0..1 spike's alarm one-shot (3.3), separate from mood. */
  bristle: number;
  /** -1..1 shriekscale's fan flare on top of its mood (3.7): -1 laid back, +1 upright; > 1 is the shriek dish. */
  flare: number;
  /** Neck-bulge position for the eat gulp: 0 = none, 1..3 = head -> chest (stepped). */
  gulp: number;
  /** DFACE index (stepped). The runtime blink overrides open-eyed faces. */
  face: number;
  /** 0..1 intensity of the element's signature effect (breath stream, bolt, arcs), read by ElementSpec.render.breath. */
  fx: number;
  /** 1 = asleep (stepped): fire banks its flame, lightning drops to the sad cock, eyes are drawn closed. */
  sleep: number;
  /**
   * The tuck branch of bible 1.4 (stepped): 0 = the head group is drawn last (always, except:), 1 = before step 8
   * (rock's sleep and upset tucks: the dome and rim lie over the head), 2 = before step 11 (the baby sleep bun: the
   * wing nubs lie over the head).
   */
  tuck: number;
};

/** Keys whose values are held, never lerped. */
const STEPPED: Readonly<Record<string, true | undefined>> = Object.freeze({ face: true, gulp: true, sleep: true, tuck: true });

type Frozen<T> = Readonly<{ [K in keyof T]: T[K] extends number ? number : Readonly<T[K]> }>;

/** The rest pose every partial resolves against: every offset zero, scale 1, awake, neutral. */
export const DEFAULT_DRAGON_POSE: Frozen<DragonPose> = Object.freeze({
  root: Object.freeze({ x: 0, y: 0, rot: 0 }),
  squash: 1, stretch: 1,
  body: Object.freeze({ rot: 0, y: 0 }),
  neck: Object.freeze({ a0: 0, a1: 0 }),
  head: Object.freeze({ rot: 0 }),
  jaw: 0,
  legNH: Object.freeze({ upper: 0, lower: 0, paw: 0 }),
  legNF: Object.freeze({ upper: 0, lower: 0, paw: 0 }),
  legFH: Object.freeze({ upper: 0, lower: 0, paw: 0 }),
  legFF: Object.freeze({ upper: 0, lower: 0, paw: 0 }),
  tail: Object.freeze({ lift: 0, curl: 0, sway: 0 }),
  wing: Object.freeze({ fold: 0, flap: 0 }),
  mood: 0, bristle: 0, flare: 0, gulp: 0, face: 0, fx: 0, sleep: 0, tuck: 0,
});

/** A partial pose: every group and every number optional. Anims are authored in these. */
export type PartialDragonPose = {
  [K in keyof DragonPose]?: DragonPose[K] extends number ? (K extends 'face' ? DFaceRef : number) : Partial<DragonPose[K]>;
};

type Group = Record<string, number>;
type Table = Record<string, number | Group>;
const KEYS = Object.keys(DEFAULT_DRAGON_POSE) as (keyof DragonPose)[];
/** Sub-keys per group, precomputed so the per-frame walks allocate nothing. */
const SUB: Readonly<Record<string, readonly string[]>> = (() => {
  const o: Record<string, string[]> = {};
  for (const k of KEYS) { const d = DEFAULT_DRAGON_POSE[k]; if (typeof d !== 'number') o[k] = Object.keys(d); }
  return o;
})();

/** Allocate a fresh, fully populated pose (only at setup: players and rigs own one each). */
export function makeDragonPose(partial: PartialDragonPose | null = null): DragonPose {
  const out: Table = {};
  for (const k of KEYS) {
    const d = DEFAULT_DRAGON_POSE[k] as number | Group;
    if (typeof d === 'number') out[k] = d;
    else { const g: Group = {}; for (const s of SUB[k]) g[s] = d[s]; out[k] = g; }
  }
  const pose = out as unknown as DragonPose;
  if (partial) copyDragonPose(partial, pose);
  return pose;
}

/** Overlay a partial pose onto `out`. With `reset`, anything `src` leaves out becomes the default. */
export function copyDragonPose(src: PartialDragonPose | null | undefined, out: DragonPose, reset = false): DragonPose {
  const dst = out as unknown as Table, s = src as unknown as Table | null | undefined;
  for (const k of KEYS) {
    const d = DEFAULT_DRAGON_POSE[k] as number | Group;
    const v = s ? s[k] : undefined;
    if (typeof d === 'number') {
      if (v != null) dst[k] = k === 'face' ? dfaceIndex(v as unknown as DFaceRef) : v as number;
      else if (reset) dst[k] = d;
      continue;
    }
    const o = dst[k] as Group, vg = v as Group | undefined;
    for (const sk of SUB[k]) {
      const sv = vg ? vg[sk] : undefined;
      if (sv != null) o[sk] = sv; else if (reset) o[sk] = d[sk];
    }
  }
  return out;
}

/**
 * Interpolate two partial poses into `out` (allocation-free). Missing values are the defaults; stepped keys take
 * `a`'s value (the frame being held), exactly as the engine's lerpPose treats `face`.
 */
export function lerpDragonPose(a: PartialDragonPose | null | undefined, b: PartialDragonPose | null | undefined, t: number, out: DragonPose): DragonPose {
  const dst = out as unknown as Table, A = a as unknown as Table | null | undefined, B = b as unknown as Table | null | undefined;
  for (const k of KEYS) {
    const d = DEFAULT_DRAGON_POSE[k] as number | Group;
    const av = A ? A[k] : undefined, bv = B ? B[k] : undefined;
    if (typeof d === 'number') {
      const x = av != null ? (k === 'face' ? dfaceIndex(av as unknown as DFaceRef) : av as number) : d;
      if (STEPPED[k]) { dst[k] = x; continue; }
      const y = bv != null ? bv as number : d;
      dst[k] = x + (y - x) * t;
      continue;
    }
    const o = dst[k] as Group, ag = av as Group | undefined, bg = bv as Group | undefined;
    for (const sk of SUB[k]) {
      const x = ag && ag[sk] != null ? ag[sk] : d[sk];
      const y = bg && bg[sk] != null ? bg[sk] : d[sk];
      o[sk] = x + (y - x) * t;
    }
  }
  return out;
}

/** Add a partial pose's numbers onto `pose` in place (procedural bob / lean on top of an anim). Stepped keys are set. */
export function addDragonPose(pose: DragonPose, delta: PartialDragonPose): DragonPose {
  const dst = pose as unknown as Table, src = delta as unknown as Table;
  for (const k of KEYS) {
    const v = src[k];
    if (v == null) continue;
    if (typeof v === 'number' || typeof v === 'string') {
      if (STEPPED[k]) dst[k] = k === 'face' ? dfaceIndex(v as unknown as DFaceRef) : v as number;
      else (dst[k] as number) += v as number;
      continue;
    }
    const o = dst[k] as Group;
    for (const sk of SUB[k]) if (v[sk] != null) o[sk] += v[sk];
  }
  return pose;
}

/** The shorthand `DP()` accepts: arrays for the multi-number groups, bare numbers for the one-number ones. */
export type DragonPoseSpec = {
  /** [x, y, rot] */
  root?: number[] | Partial<DXform>;
  squash?: number;
  stretch?: number;
  /** rot, or [rot, y] */
  body?: number | number[] | Partial<DBody>;
  /** a0, or [a0, a1] */
  neck?: number | number[] | Partial<DNeck>;
  head?: number | Partial<DHead>;
  jaw?: number;
  /** [upper, lower, paw] */
  legNH?: number[] | Partial<DLeg>;
  legNF?: number[] | Partial<DLeg>;
  legFH?: number[] | Partial<DLeg>;
  legFF?: number[] | Partial<DLeg>;
  /** [lift, curl, sway] */
  tail?: number[] | Partial<DTail>;
  /** fold, or [fold, flap] */
  wing?: number | number[] | Partial<DWing>;
  mood?: number;
  bristle?: number;
  flare?: number;
  gulp?: number;
  face?: DFaceRef;
  fx?: number;
  sleep?: number;
  tuck?: number;
};

const arr3 = <T>(v: number[], a: string, b: string, c?: string): T => {
  const o: Group = {};
  if (v[0] != null) o[a] = v[0];
  if (v[1] != null) o[b] = v[1];
  if (c && v[2] != null) o[c] = v[2];
  return o as unknown as T;
};

/**
 * Authoring shorthand, the sibling of the engine's P():
 *   DP({ body: -6, neck: [-10, 0], legNH: [20, -10], tail: [0, 0, 5], wing: 0.8, face: 'happy' })
 * Only authoring-time: it allocates, so call it when a table is built, never per frame.
 */
export function DP(spec: DragonPoseSpec = {}): PartialDragonPose {
  const o: Record<string, unknown> = {};
  for (const k of Object.keys(spec) as (keyof DragonPoseSpec)[]) {
    const v = spec[k] as unknown;
    if (v == null) continue;
    switch (k) {
      case 'root': o[k] = Array.isArray(v) ? arr3(v, 'x', 'y', 'rot') : v; break;
      case 'body': o[k] = typeof v === 'number' ? { rot: v } : Array.isArray(v) ? arr3(v, 'rot', 'y') : v; break;
      case 'neck': o[k] = typeof v === 'number' ? { a0: v } : Array.isArray(v) ? arr3(v, 'a0', 'a1') : v; break;
      case 'head': o[k] = typeof v === 'number' ? { rot: v } : v; break;
      case 'legNH': case 'legNF': case 'legFH': case 'legFF': o[k] = Array.isArray(v) ? arr3(v, 'upper', 'lower', 'paw') : v; break;
      case 'tail': o[k] = Array.isArray(v) ? arr3(v, 'lift', 'curl', 'sway') : v; break;
      case 'wing': o[k] = typeof v === 'number' ? { fold: v } : Array.isArray(v) ? arr3(v, 'fold', 'flap') : v; break;
      case 'face': o[k] = dfaceIndex(v as DFaceRef); break;
      default: o[k] = v;
    }
  }
  return o as PartialDragonPose;
}
