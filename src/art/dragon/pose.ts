// DragonPose: the quadruped's pose channels (docs/ART_BIBLE.md 4.1), the sibling of the engine's humanoid `Pose`.
//
// The engine's makePose / copyPose / lerpPose walk the humanoid's key list, so the dragon gets its own ops with the
// same semantics: a DEFAULT pose every partial is resolved against, allocation-free copy and lerp into a caller's
// object, and STEPPED keys (face, blink, pupil, gulp, sleep, tuck, eyeClip, act, cue) that are held, never
// interpolated -- a face halfway between happy and sad is not a face.
//
// CONVENTIONS (degrees; see bible 1.1):
// - Every rotation channel here is an OFFSET added to the stage's rest shape, so DEFAULT is all zeros and one anim
//   can drive all three stages. Rest angles live in stages.ts.
// - Rotations are screen-clockwise positive when facing right: + pitches FORWARD / DOWN (the engine's "torso positive =
//   lean forward"). The bible's eat ("neck a0 +35, head +25" = head down to the bowl) and breath ("head back -8") read
//   this way. The stage tables' neck and wing ELEVATIONS are counter-clockwise (+ up); the rig converts.
// - Legs: `upper` is added to the thigh / upper-arm angle (0 = hanging down, + swings forward), `lower` to the
//   RELATIVE shin / forearm angle, exactly as the engine's computeJoints adds them. `paw` tilts the paw (+ toe down).
//   `plant` (default 1) pins the paw to the ground: the rig solves the two bones by IK so the ankle holds its rest
//   spot however the body bobs, dips or pitches, and upper / lower then only slide the paw along the ground (a
//   stance stroke). 0 = plain FK, the paw carried by the body: swing and airborne frames only (rig.ts).
//   `slide` and `lift` move a PLANTED paw's target in px: along the ground (+ forward) and up off it. A gait is
//   authored in them (anims.ts walk): the stance stroke is a linear slide at exactly the walk speed, so a paw on
//   the floor never skates, and a swing is the same IK leg with its target lifted, so it never pops between FK and
//   IK. A stance stroke keyed through upper / lower is a sine of the angle and cannot match a constant speed.
// - Tail: `lift` is added to the first segment and `curl` to every segment's bend (tail angles: + droops, - lifts);
//   `sway` swings the whole tail about its root (+ droops) on top of the secondary-motion chain; `stiff` fades the
//   chain out (1 = the tail keeps exactly its keyed shape).

/** Named dragon faces (bible 2.5, D18). Stepped, never interpolated; `face` holds the index. Never angry. */
export const DFACE = Object.freeze({
  neutral: 0, happy: 1, closed: 2, hungry: 3, sleepy: 4, sad: 5, surprised: 6, grumpy: 7, sheepish: 8, scared: 9, dazed: 10,
});
export type DFaceName = keyof typeof DFACE;
/** A face as an index or a DFACE name. */
export type DFaceRef = DFaceName | number;
/**
 * Which shared animation is playing (stepped `act`), so an element renderer can add its flourish to the shared
 * motion without owning the anim (bible 4.3): fire's strut flame in walk, the happy flourish, the hungry tell in
 * beg, water's nostril bubble asleep, the breath stream. `cue` is that act's clock (DragonPose.cue). The acts past
 * `variant` are element anims the shared table has no builder for (fire's bath, rock's upset tuck, slinkwing's
 * lonely call): one id each here, so no two elements' local numbers collide and no shared act triggers another's
 * flourish.
 */
export const ACT = Object.freeze({ none: 0, walk: 1, happy: 2, eat: 3, sleep: 4, wake: 5, breath: 6, pet: 7, beg: 8, fidget: 9, variant: 10, bath: 11, upset: 12, call: 13 });
export type ActName = keyof typeof ACT;

/** Resolve a face name or index to an index (unknown names = neutral). */
export function dfaceIndex(v: DFaceRef | null | undefined): number {
  return typeof v === 'number' ? v : v != null && DFACE[v] != null ? DFACE[v] : 0;
}

export type DXform = { x: number; y: number; rot: number };
export type DBody = { rot: number; y: number };
export type DNeck = { a0: number; a1: number };
export type DHead = { rot: number };
/**
 * `shift` slides the whole leg along the body (px, + forward: its root and its planted spot together, so the leg
 * keeps its rest shape): the hip or shoulder swinging with the stride. The walk moves the far pair outward with it
 * (anims.ts): at the rest splay each far leg crossed exactly behind its near partner twice a cycle.
 */
export type DLeg = { upper: number; lower: number; paw: number; plant: number; lift: number; slide: number; shift: number };
/**
 * `stiff` (0..1) scales the tail chain's secondary motion down: 1 = the tail holds its keyed shape and ignores the
 * body's motion (the breath's stiff tail, a tail lying on the floor asleep).
 */
export type DTail = { lift: number; curl: number; sway: number; stiff: number };
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
  /**
   * Head pitch on top of the neck (+ = snout down). Pitched past vertical (the whole head angle, neck and body
   * included, under -90: snout up and back) the head LOOKS BACK: the rig draws it mirrored, upright and facing the
   * tail, with the snout exactly where the pitch aims it (rig.ts J.headFlip). A pitch cannot draw a look over the
   * shoulder, which in a side view is a yaw: tipped over, the skull's top faced down, the horns lay on the throat
   * and a round baby head read face-on.
   */
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
  /**
   * ADDED to the pet's resting mood (drawDragon opts.mood) and clamped to -1..1: drives the cue as the mood gauge
   * (D7). An anim keys -2..2 to pin the cue at an extreme whatever the resting mood (happy: +2, "mood jumps to +1").
   */
  mood: number;
  /** 0..1 spike's alarm one-shot (3.3), separate from mood. */
  bristle: number;
  /** -1..1 slinkwing's fan flare on top of its mood (3.7): -1 laid back, +1 upright; > 1 is the shriek dish. */
  flare: number;
  /** Neck-bulge position for the eat gulp: 0 = none, 1..3 = head -> chest (stepped). */
  gulp: number;
  /** DFACE index (stepped). The runtime blink overrides open-eyed faces. */
  face: number;
  /**
   * 0..1 envelope of the element's signature effect (the breath stream, bolt, arcs), read by
   * ElementSpec.render.breath: 0 in the wind-up, 1 through the sustain, back to 0 in the recover.
   */
  fx: number;
  /** ACT index (stepped): which shared animation is playing (ACT; 0 = none: idle, rest, a static pose). */
  act: number;
  /**
   * The act's clock in frames (stepped, keyed as a linear ramp), counted from the act's KEY MOMENT and negative
   * before it, so an element renderer can age its particles deterministically from the pose alone:
   *   walk   frames into the gait cycle (0 = near hind lift-off; hind contacts at 0.4 and 0.9 of the cycle)
   *   happy  frames since the flourish moment (adult f 14; the young hop's take-off; the baby's first hop)
   *   eat    frames since the (first) chomp
   *   sleep  frames into the current breath (0 = inhale; the exhale starts halfway); the lie-down counts up to 0
   *   wake   frames since the wake began
   *   breath frames since the SNAP (the wind-up / tell is negative; the stream starts at 0)
   *   pet    frames into the loop
   *   beg    frames into the loop (the stomach growl sits at a fixed frame of it)
   *   fidget frames into the element's idle fidget (ElementAnimHooks.fidget: its flourish keys on it)
   *   variant frames into a shared idle variant (look-around, yawn, scratch, topple, plop-sit)
   *   bath   frames since the bath began (fire's hiss and shake; the element's own one-shot)
   *   upset  frames into rock's upset tuck (its intro counts up from 0 as the hood swings down)
   *   call   frames since the note starts (slinkwing's lonely call; the wind-up is negative)
   */
  cue: number;
  /** 1 = asleep (stepped): fire banks its flame, lightning drops to the sad cock, eyes are drawn closed. */
  sleep: number;
  /**
   * The tuck branch of bible 1.4 (stepped): 0 = the head group is drawn last (always, except:), 1 = before step 8
   * (rock's sleep and upset tucks: the dome and rim lie over the head), 2 = before step 11 (the baby sleep bun: the
   * wing nubs lie over the head).
   */
  tuck: number;
  /**
   * 1 (always, by default) = the rig clips the near head features off the eye's largest box + 1 px (1.4 step 12.6:
   * nothing covers the eye). 0 = no clip: ledger E8, baby slinkwing's fans flopping over its eyes after its squeak,
   * the one sanctioned exception, and only for the frames that gag lasts (stepped).
   */
  eyeClip: number;
  /**
   * The runtime blink (stepped): 0 = open, 1 = the half-lid (the sleepy LID), 2 = closed. It changes the EYE only:
   * the face keeps its own brow, blush and mouth, so a neutral blink never flashes the sleepy brow bar. Set by
   * DragonAnimPlayer's blink schedule, never keyed (2.5).
   */
  blink: number;
  /**
   * 1 = the pupil CONTRACTED (stepped; 0 = the stage's own): lightning's Spark Bolt wind-up (3.5, tuning.breath.pupil).
   * Only the open stage eye changes (faces.ts drawEye): baby a 3 x 2 pupil at the top of its dark block's place,
   * young a 2 x 3 in the oval's place, adult the slit with iris over its top row (already at the 2 px floor).
   */
  pupil: number;
};

/** Keys whose values are held, never lerped. */
const STEPPED: Readonly<Record<string, true | undefined>> = Object.freeze({
  face: true, blink: true, pupil: true, gulp: true, sleep: true, tuck: true, eyeClip: true, act: true, cue: true,
});
/** True for a channel that is held, never lerped (face, blink, pupil, gulp, sleep, tuck, eyeClip, act, cue). */
export function isSteppedKey(k: string): boolean { return STEPPED[k] === true; }

type Frozen<T> = Readonly<{ [K in keyof T]: T[K] extends number ? number : Readonly<T[K]> }>;

/** The rest pose every partial resolves against: every offset zero, scale 1, awake, neutral. */
export const DEFAULT_DRAGON_POSE: Frozen<DragonPose> = Object.freeze({
  root: Object.freeze({ x: 0, y: 0, rot: 0 }),
  squash: 1, stretch: 1,
  body: Object.freeze({ rot: 0, y: 0 }),
  neck: Object.freeze({ a0: 0, a1: 0 }),
  head: Object.freeze({ rot: 0 }),
  jaw: 0,
  legNH: Object.freeze({ upper: 0, lower: 0, paw: 0, plant: 1, lift: 0, slide: 0, shift: 0 }),
  legNF: Object.freeze({ upper: 0, lower: 0, paw: 0, plant: 1, lift: 0, slide: 0, shift: 0 }),
  legFH: Object.freeze({ upper: 0, lower: 0, paw: 0, plant: 1, lift: 0, slide: 0, shift: 0 }),
  legFF: Object.freeze({ upper: 0, lower: 0, paw: 0, plant: 1, lift: 0, slide: 0, shift: 0 }),
  tail: Object.freeze({ lift: 0, curl: 0, sway: 0, stiff: 0 }),
  wing: Object.freeze({ fold: 0, flap: 0 }),
  mood: 0, bristle: 0, flare: 0, gulp: 0, face: 0, fx: 0, act: 0, cue: 0, sleep: 0, tuck: 0, eyeClip: 1, blink: 0, pupil: 0,
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

/**
 * Cross-fade in place: `to` = from + (to - from) * t on every lerped channel; stepped channels keep `to`'s value
 * (the new anim's face, act and clock start at once). DragonAnimPlayer's play({ blend }) runs this.
 */
export function blendDragonPose(from: DragonPose, to: DragonPose, t: number): DragonPose {
  const A = from as unknown as Table, B = to as unknown as Table;
  for (const k of KEYS) {
    const d = DEFAULT_DRAGON_POSE[k] as number | Group;
    if (typeof d === 'number') {
      if (!STEPPED[k]) B[k] = (A[k] as number) + ((B[k] as number) - (A[k] as number)) * t;
      continue;
    }
    const ag = A[k] as Group, bg = B[k] as Group;
    for (const sk of SUB[k]) bg[sk] = ag[sk] + (bg[sk] - ag[sk]) * t;
  }
  return to;
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
  /** [upper, lower, paw, plant, lift, slide, shift] */
  legNH?: number[] | Partial<DLeg>;
  legNF?: number[] | Partial<DLeg>;
  legFH?: number[] | Partial<DLeg>;
  legFF?: number[] | Partial<DLeg>;
  /** [lift, curl, sway, stiff] */
  tail?: number[] | Partial<DTail>;
  /** fold, or [fold, flap] */
  wing?: number | number[] | Partial<DWing>;
  mood?: number;
  bristle?: number;
  flare?: number;
  gulp?: number;
  face?: DFaceRef;
  fx?: number;
  act?: number;
  cue?: number;
  sleep?: number;
  tuck?: number;
  eyeClip?: number;
  blink?: number;
  pupil?: number;
};

const arr3 = <T>(v: number[], ...names: string[]): T => {
  const o: Group = {};
  for (let i = 0; i < names.length; i++) if (v[i] != null) o[names[i]] = v[i];
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
      case 'legNH': case 'legNF': case 'legFH': case 'legFF': o[k] = Array.isArray(v) ? arr3(v, 'upper', 'lower', 'paw', 'plant', 'lift', 'slide', 'shift') : v; break;
      case 'tail': o[k] = Array.isArray(v) ? arr3(v, 'lift', 'curl', 'sway', 'stiff') : v; break;
      case 'wing': o[k] = typeof v === 'number' ? { fold: v } : Array.isArray(v) ? arr3(v, 'fold', 'flap') : v; break;
      case 'face': o[k] = dfaceIndex(v as DFaceRef); break;
      default: o[k] = v;
    }
  }
  return o as PartialDragonPose;
}
