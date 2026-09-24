// The dragon animation table per stage (docs/ART_BIBLE.md 4.2), authored once from the adult key beats with the
// 4.1 stage timing rules, tuned by the element's generic knobs (tuning.ts) and then merged with the element's own
// overrides (ElementSpec.anims).
//
// AUTHORING IN TRACKS. The frame format (one pose per frame, lerped to the next with one ease) is what the player
// plays, but it is a poor thing to author in: the head follows the body 8 f late (4.1), the tail sweeps on its own
// beat, a gait has four legs a quarter cycle apart. So every anim here is written as TRACKS -- one list of
// [frame, value, ease] keys, or a function of time, per channel -- and `bake` samples them into frames:
//   - every `res` (2) frames and at every key, each channel evaluated on its own curve, so channels with different
//     beats and eases coexist in one frame list (a 2 f linear step of a smooth curve is invisible at 60 Hz);
//   - stepped channels (face, act, gulp, sleep, tuck) are held between keys; `cue` is keyed as a linear ramp and
//     held per frame (it is the act's clock: pose.ts);
//   - 'stage' easing resolves to the stage's rule (babies `out`, young `overshoot`, adults `inout`), and squash is
//     clamped to the stage's range (4.1);
//   - one-shots end on a held final frame, loops wrap their keys, and a loop with an intro (sleep) returns to
//     `loopFrom`.
// Element overrides use the same tools (bake, lag, the builders below), so an element artist authors an anim of
// their own in exactly this form.
//
// Blinks are NOT keyed: DragonAnimPlayer runs them at runtime (2.5). Desync is the player's (seeded phase / speed).
import { ease } from '../../lib/art/poses.ts';
import type { EaseName } from '../../lib/art/poses.ts';
import { DP, DFACE, ACT, isSteppedKey } from './pose.ts';
import type { DragonPose, PartialDragonPose } from './pose.ts';
import type { DragonAnim, DragonAnimSet, DragonFrame } from './anim.ts';
import { STAGE_TIMING } from './stages.ts';
import type { Stage } from './stages.ts';
import type { ElementSpec } from './element.ts';
import { animTuning } from './tuning.ts';
import type { AnimTuning, WalkTuning } from './tuning.ts';
import type { DragonDims } from './build.ts';

// ---------- tracks ----------

/** Every channel a track can drive: 'jaw', 'body.y', 'legNH.slide'... plus 'move' (the frame's root motion). */
export type Channel = { [K in keyof DragonPose]: DragonPose[K] extends number ? K : `${K & string}.${keyof DragonPose[K] & string}` }[keyof DragonPose] | 'move';
/** A key's ease toward the next key: an engine EASE name, or 'stage' for the stage's rule (4.1). */
export type KeyEase = EaseName | 'stage';
/** [frame, value, ease toward the next key]. */
export type Key = readonly [t: number, v: number, e?: KeyEase];
/** Keys, or a function of the frame for curves no key list says well (a gait). */
export type Track = readonly Key[] | ((t: number) => number);
export type Tracks = Partial<Record<Channel, Track>>;

export interface BakeOpts {
  stage: Stage;
  /** Length in frames. A loop wraps at it; a one-shot adds one held final frame at it. */
  len: number;
  loop?: boolean;
  /** Loop with an intro: frames before this play once, the loop returns here (keys are not wrapped). */
  loopFrom?: number;
  /** Sample spacing, frames (2). */
  res?: number;
  /** Ease of keys that name none (default 'stage'; a gait passes 'linear'). */
  ease?: KeyEase;
  /** Named events raised on frame entry: [frame, name]. */
  events?: readonly (readonly [number, string])[];
  tailSway?: { period: number; amp: number };
  next?: string;
}

/** Shift a key list `lag` frames later and scale it `amp` times: the head that follows the body (4.1). */
export function lag(keys: readonly Key[], frames: number, amp = 1): Key[] {
  return keys.map((k) => [k[0] + frames, k[1] * amp, k[2]] as const);
}
/** Scale a key list's times by `k` (a stage's duration rule). */
export function stretchKeys(keys: readonly Key[], k: number): Key[] {
  return keys.map((x) => [x[0] * k, x[1], x[2]] as const);
}

function evalKeys(keys: readonly Key[], t: number, wrap: number, held: boolean, def: EaseName, stageEase: EaseName): number {
  const n = keys.length;
  if (n === 1) return keys[0][1];
  let i = -1;
  for (let k = 0; k < n; k++) { if (keys[k][0] <= t) i = k; else break; }
  if (held) return i >= 0 ? keys[i][1] : wrap ? keys[n - 1][1] : keys[0][1];
  let a: Key, b: Key, ta: number, tb: number;
  if (i < 0) {
    if (!wrap) return keys[0][1];
    a = keys[n - 1]; b = keys[0]; ta = a[0] - wrap; tb = b[0];
  } else if (i === n - 1) {
    if (!wrap) return keys[n - 1][1];
    a = keys[n - 1]; b = keys[0]; ta = a[0]; tb = b[0] + wrap;
  } else { a = keys[i]; b = keys[i + 1]; ta = a[0]; tb = b[0]; }
  const u = tb > ta ? Math.min(1, Math.max(0, (t - ta) / (tb - ta))) : 1;
  const e = a[2] == null ? def : a[2] === 'stage' ? stageEase : a[2];
  return a[1] + (b[1] - a[1]) * ease(e, u);
}

/**
 * Sample tracks into a DragonAnim (see the header). Allocates: call it when a table is built, never per frame.
 */
export function bake(tracks: Tracks, o: BakeOpts): DragonAnim {
  const T = STAGE_TIMING[o.stage], res = o.res ?? 2, len = Math.max(1, Math.round(o.len));
  const loop = !!o.loop, wrap = loop && o.loopFrom == null ? len : 0;
  const stageEase: EaseName = T.ease;
  const defEase: EaseName = o.ease == null || o.ease === 'stage' ? stageEase : o.ease;
  // keys rounded to whole frames and, for a wrapping loop, folded into [0, len) and sorted
  const chans = Object.keys(tracks) as Channel[];
  const keyed: Partial<Record<Channel, Key[]>> = {};
  const times = new Set<number>();
  for (let t = 0; t < len; t += res) times.add(t);
  times.add(loop ? 0 : len);
  if (o.loopFrom != null) times.add(Math.round(o.loopFrom));
  for (const c of chans) {
    const tr = tracks[c];
    if (!tr || typeof tr === 'function') continue;
    const ks = tr.map((k) => {
      let t = Math.round(k[0]);
      if (wrap) t = ((t % len) + len) % len;
      return [t, k[1], k[2]] as const;
    }).sort((p, q) => p[0] - q[0]);
    keyed[c] = ks;
    for (const k of ks) if (k[0] >= 0 && (loop ? k[0] < len : k[0] <= len)) times.add(k[0]);
  }
  for (const e of o.events || []) times.add(Math.round(e[0]));
  const ts = [...times].filter((t) => t >= 0 && (loop ? t < len : t <= len)).sort((p, q) => p - q);
  const [sqLo, sqHi] = T.squash;
  const frames: DragonFrame[] = [];
  let loopIndex = 0;
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i];
    const pose: Record<string, number | Record<string, number>> = {};
    let move = 0;
    for (const c of chans) {
      const tr = tracks[c]!;
      const dot = c.indexOf('.'), head = dot < 0 ? c : c.slice(0, dot);
      const held = isSteppedKey(head) && head !== 'cue';
      let v = typeof tr === 'function' ? tr(t) : evalKeys(keyed[c]!, t, wrap, held, head === 'cue' || head === 'move' ? 'linear' : defEase, stageEase);
      // (a NEGATIVE stretch is a flip upside down, not a squash: rock's roll onto its back keeps it)
      if (c === 'squash' || (c === 'stretch' && v > 0)) v = Math.min(sqHi, Math.max(sqLo, v));
      if (c === 'move') { move = v; continue; }
      if (dot < 0) pose[c] = v;
      else { const g = (pose[head] as Record<string, number>) || (pose[head] = {}); g[c.slice(dot + 1)] = v; }
    }
    const dur = i + 1 < ts.length ? ts[i + 1] - t : loop ? len - t : 1;
    const f: DragonFrame = { dur, pose: pose as PartialDragonPose };
    if (move) f.move = move;
    for (const e of o.events || []) if (Math.round(e[0]) === t) f.event = e[1];
    if (o.loopFrom != null && t === Math.round(o.loopFrom)) loopIndex = i;
    frames.push(f);
  }
  const anim: DragonAnim = { loop, frames };
  if (o.loopFrom != null) anim.loopFrom = loopIndex;
  if (o.tailSway) anim.tailSway = o.tailSway;
  if (o.next) anim.next = o.next;
  return anim;
}

const F = (dur: number, pose: ReturnType<typeof DP> | null, extra: Partial<DragonFrame> = {}): DragonFrame => ({ dur, pose, ...extra });

/** A constant track. */
const K = (v: number): Key[] => [[0, v]];

// ---------- idle (authored directly in frames, before the track tools existed) ----------

/**
 * ADULT idle, 120 f: inhale 0-56 (inout) -- body up 1 px, squash 1.03, the folded wing's knuckle up 1 px, neck
 * a0 -2 -- then exhale 56-120. The head follows the body 8 f late (its keys sit 8 f behind the body's). The tail
 * sways +-5 deg over 150 f, out of sync with the breath (tailSway, on the player's clock).
 */
function idleAdult(): DragonAnim {
  return {
    loop: true,
    tailSway: { period: 150, amp: 5 },
    frames: [
      F(8, DP({ body: [0, 0], squash: 1, neck: [0.25], head: 0, wing: 0 }), { ease: 'inout' }),
      F(48, DP({ body: [0, -0.15], squash: 1.004, neck: [-0.1], head: 0, wing: 0.005 }), { ease: 'inout' }),
      F(8, DP({ body: [0, -1], squash: 1.03, neck: [-1.6], head: 0.4, wing: 0.04 }), { ease: 'inout' }),
      F(56, DP({ body: [0, -0.95], squash: 1.028, neck: [-2], head: 0.5, wing: 0.04 }), { ease: 'inout' }),
    ],
  };
}

/** YOUNG idle, 100 f: the adult breath at 0.85x, the tail +-8 over 100 f, a curious head tilt of +-5. */
function idleYoung(): DragonAnim {
  return {
    loop: true,
    tailSway: { period: 100, amp: 8 },
    frames: [
      F(7, DP({ body: [0, 0], squash: 1, neck: [0.3], head: -1 }), { ease: 'inout' }),
      F(40, DP({ body: [0, -0.15], squash: 1.004, neck: [0], head: 1 }), { ease: 'inout' }),
      F(7, DP({ body: [0, -1], squash: 1.03, neck: [-1.8], head: 4 }), { ease: 'inout' }),
      F(46, DP({ body: [0, -0.95], squash: 1.028, neck: [-2], head: 5 }), { ease: 'inout' }),
    ],
  };
}

/**
 * BABY idle, 72 f: a 2 px bob with squash 0.97 <-> 1.03, the head wobbling +-4 deg 15 f behind the body, the tail
 * WAGGING +-12 over 48 f. The bob dips DOWN from the rest height (the planted legs bend under it): a baby's 4 px
 * legs stand nearly straight at rest, so a bob upward would lift its paws off the floor. The body dips 1 px and the
 * squash (about the ground point) carries the head the other ~1 px: a 2 px dip folds 4 px legs into a frog crouch.
 * (30 % of its blinks are doubles: BABY_BLINK. The plop-sit variant comes with the variants.)
 */
function idleBaby(): DragonAnim {
  return {
    loop: true,
    tailSway: { period: 48, amp: 12 },
    frames: [
      F(15, DP({ body: [0, 1], squash: 1.03, head: 2 }), { ease: 'inout' }),
      F(21, DP({ body: [0, 0.4], squash: 1.0, head: -4 }), { ease: 'inout' }),
      F(15, DP({ body: [0, 0], squash: 0.97, head: -2 }), { ease: 'inout' }),
      F(21, DP({ body: [0, 0.6], squash: 1.0, head: 4 }), { ease: 'inout' }),
    ],
  };
}

/** A held rest pose (contact sheets, the silhouette test). */
const REST: DragonAnim = { loop: true, frames: [F(60, DP({}))] };

// ---------- walk ----------

const LEGS = ['legNH', 'legNF', 'legFH', 'legFF'] as const;
/** Lateral sequence (4.2): NH -> NF -> FH -> FF, a quarter cycle apart. Phase 0 = that leg's lift-off. */
const GAIT_OFF: Readonly<Record<typeof LEGS[number], number>> = { legNH: 0, legNF: 0.25, legFH: 0.5, legFF: 0.75 };
/** Stance share of the cycle (4.2: stance 60 % / swing 40 %). */
const STANCE = 0.6;
const frac = (x: number) => x - Math.floor(x);

/**
 * One leg's target at its own phase u (0 = lift-off), px: slide along the ground from the rest spot, lift off it,
 * paw tilt. STANCE (u 0.4..1): the paw is planted and slides back LINEARLY by the whole stride, at exactly the
 * walk speed, so while the owner moves the pet by `move` it stands still on the floor. SWING (u 0..0.4): a cubic
 * whose end tangents match the stance speed (the paw leaves the floor and touches down with no world velocity: no
 * skid, no stab), lifted on a sine to `lift` at passing, the toe hanging a little on the way up.
 */
function gaitLeg(u: number, S: number, c: number, lift: number, out: { slide: number; lift: number; paw: number }): void {
  if (u < 1 - STANCE) {
    const v = u / (1 - STANCE), m = -(1 - STANCE) / STANCE;
    // Hermite h(0) = 0, h(1) = 1, h'(0) = h'(1) = m (the stance's own speed in swing-normalised units)
    const h = (v * v * v - 2 * v * v + v) * m + (-2 * v * v * v + 3 * v * v) + (v * v * v - v * v) * m;
    out.slide = c - S / 2 + S * h; out.lift = lift * Math.sin(Math.PI * v); out.paw = 16 * Math.sin(Math.PI * v) * (1 - v);
  } else {
    const v = (u - (1 - STANCE)) / STANCE;
    out.slide = c + S / 2 - S * v; out.lift = 0; out.paw = 0;
  }
}
const GL = { slide: 0, lift: 0, paw: 0 };

/**
 * WALK (4.2, loop): a lateral-sequence gait, 8 keys per cycle (adult 48 f = 8 x 6, young 40 = 8 x 5, baby 24 =
 * 8 x 3), each leg a quarter cycle behind the last. The stride is solved from the speed (stride = speed x stance
 * frames), so a planted paw never skates; the hind stroke sits 0.15 of a stride back of its rest spot and the
 * front stroke 0.05 back of its own (a front paw reached further forward runs out of forearm), so the near pair
 * never meet where the hind paw lands and the front one lifts (with the legs at gap/2 + X, 2.1: >= 3 px of
 * background between them near the floor at every frame; 5.1 #5).
 * Adult / young: the body dips 1 px at each hind contact, the head counter-bobs 4 f late, the tail sways +-5
 * against the hips, the folded wings jiggle 1 px. Baby: a waddle (root rot +-4 about the ground point, the planted
 * paws counter-rotated so the soles stay down), a squash bounce at every contact, the heavy head 6 f late at 2x;
 * one cycle in 6 it stumbles: a face-plant (squash 1.15 for 12 f) and a head shake (12 f), standing still.
 * Tuning (4.3): cycle, speed, lift, head, sway, wave.
 */
export function walkAnim(stage: Stage, w: Readonly<WalkTuning>): DragonAnim {
  const C = Math.round(w.cycle), S = w.speed * STANCE * C, baby = stage === 'baby';
  const TM = STAGE_TIMING[stage], lagF = baby ? TM.headLag : 4;
  const cycles = baby ? 6 : 1, len = C * cycles, stumble0 = baby ? 5 * C : Infinity;
  // the stumble cycle freezes the gait at phase 0 (its end state is the next cycle's start) and plays over it
  const phase = (t: number) => (t >= stumble0 ? 0 : frac(t / C));
  const st = (t: number) => (t >= stumble0 ? t - stumble0 : -1);
  const tracks: Tracks = {};
  for (const leg of LEGS) {
    // the hind stroke sits 0.15 of a stride back and the front one 0.05 back of its rest spot, so the near pair
    // separates where the hind paw lands and the front one lifts, and the front paw still reaches its touch-down
    // The FAR pair (5.1 #5): each far leg runs half a cycle from its near partner, so over a stride longer than
    // the rest splay it crossed exactly behind it twice a cycle and only two legs read at those keys. Through the
    // walk the far hip and shoulder slide outward by half a stride (`shift`: root and planted spot together, so the
    // leg keeps its rest shape and its reach), and the far hind's stroke sits another 0.15 stride back (the hind leg
    // has reach to spare behind; the front has none ahead): measured, >= 4 px of every far leg shows at all 8 keys
    // on all 18 looks, and planted far soles still hold their world x within 1 px.
    const far = leg === 'legFH' || leg === 'legFF', front = leg === 'legNF' || leg === 'legFF';
    const off = GAIT_OFF[leg], c = (front ? -0.05 * S : -0.15 * S) - (far && !front ? 0.15 * S : 0);
    tracks[`${leg}.slide`] = (t) => { gaitLeg(frac(phase(t) - off), S, c, w.lift, GL); return GL.slide; };
    tracks[`${leg}.lift`] = (t) => {
      gaitLeg(frac(phase(t) - off), S, c, w.lift, GL);
      const s = st(t);
      // the stumble: the leg that was in the air comes down early (the trip), and lifts again for the restart
      if (s >= 0) return GL.lift * (s < 4 ? 1 - s / 4 : s > C - 4 ? (s - (C - 4)) / 4 : 0);
      return GL.lift;
    };
    tracks[`${leg}.paw`] = (t) => { gaitLeg(frac(phase(t) - off), S, c, w.lift, GL); return st(t) >= 0 ? 0 : GL.paw; };
    if (far) { const sh = (front ? 1 : -1) * Math.round(0.5 * S); tracks[`${leg}.shift`] = () => sh; }
  }
  // body dip at each hind contact (u 0.4 and 0.9): 1 at the contact, 0 halfway between
  const dip = (u: number) => 0.5 + 0.5 * Math.cos(4 * Math.PI * (u - 0.4));
  // the stumble's shape over its C frames: a face-plant in the first half, a head shake in the second
  const plant = (s: number) => (s < 0 ? 0 : s < 4 ? s / 4 : s < C / 2 ? 1 : s < C / 2 + 4 ? 1 - (s - C / 2) / 4 : 0);
  const shake = (s: number) => (s < C / 2 ? 0 : (Math.floor((s - C / 2) / 3) % 2 ? -1 : 1) * Math.max(0, 1 - (s - C / 2) / (C / 2)));
  tracks['body.y'] = (t) => dip(phase(t)) + plant(st(t)) * 1;
  tracks['body.rot'] = (t) => w.sway * Math.sin(2 * Math.PI * (phase(t) - 0.15));
  // the head counter-bobs the dip `lagF` frames late (4 f; the baby's heavy head 6 f at 2x)
  tracks['neck.a0'] = (t) => -2.5 * TM.headAmp * dip(phase(t - lagF));
  tracks['head.rot'] = (t) => w.head + (baby ? 4 * (dip(phase(t - lagF)) - 0.5) : 0) + plant(st(t)) * 26 + shake(st(t)) * 12;
  tracks['tail.sway'] = (t) => 5 * Math.cos(2 * Math.PI * (phase(t) - 0.4));
  tracks['wing.fold'] = (t) => 0.04 * dip(phase(t - 2));
  if (w.wave > 0) {
    // water's slink: an S-wave through neck and tail, trailing the legs
    tracks['neck.a1'] = (t) => 4 * Math.sin(2 * Math.PI * (phase(t) - w.wave / C));
    tracks['tail.curl'] = (t) => 3 * Math.sin(2 * Math.PI * (phase(t) - (w.wave + 4) / C));
  }
  if (baby) {
    tracks['root.rot'] = (t) => 4 * Math.sin(2 * Math.PI * (phase(t) - 0.15)) + plant(st(t)) * 12;
    tracks['squash'] = (t) => 1.02 + 0.04 * Math.cos(8 * Math.PI * (phase(t) - 0.15)) + plant(st(t)) * 0.12;
    tracks.face = (t) => (st(t) >= 0 && st(t) < C / 2 + 2 ? DFACE.closed : DFACE.neutral);
  }
  tracks.act = K(ACT.walk);
  tracks.cue = (t) => Math.round(phase(t) * C);
  tracks.move = (t) => (st(t) >= 0 ? 0 : w.speed);
  return bake(tracks, { stage, len, loop: true, res: baby ? 1 : 2, ease: 'linear' });
}

// ---------- happy ----------

/**
 * HAPPY (4.2, one-shot: pet, feed, play). `mood` keys +2 so the cue shows +1 whatever the resting mood.
 * Adult 72 f: no hop, it PREENS -- chest puff 0-14, wings to 0.8 held 14-30, the tail sweeping +-20 twice 30-54,
 * settle; `happy` 10-60 with the jaw at the adult minimum; the element flourish at f 14 (cue 0).
 * Young 64 f: one 5 px hop on half-spread wings, then 3 wags of 10 f. Baby 60 f: two hops (6 px, 4 px) on
 * fluttering nubs, tongue out, then a +-25 wag at 8 f a swing.
 */
export function happyAnim(stage: Stage): DragonAnim {
  const H = DFACE.happy, N = DFACE.neutral;
  if (stage === 'adult') {
    const L = 72;
    return bake({
      'body.rot': [[0, 0], [14, -6], [30, -6], [54, -3], [72, 0]],
      squash: [[0, 1], [14, 1.03], [30, 1.03], [54, 1.01], [72, 1]],
      'neck.a0': [[0, 0], [14, -10], [30, -10], [54, -5], [72, 0]],
      'head.rot': lag([[0, 0], [14, -6], [30, -6], [54, -2], [64, 0]], STAGE_TIMING.adult.headLag).filter((k) => k[0] <= L),
      'wing.fold': [[0, 0], [8, 0], [16, 0.8], [30, 0.8], [42, 0]],
      'tail.lift': [[0, 0], [14, -8], [54, -8], [72, 0]],
      'tail.sway': [[0, 0], [30, 0], [36, 20], [48, -20], [54, 0]],
      jaw: [[0, 0], [10, 10], [58, 10], [60, 0]],
      face: [[0, N], [10, H], [60, N]],
      mood: [[0, 0], [10, 2], [60, 2], [72, 0]],
      act: K(ACT.happy), cue: [[0, -14], [L, L - 14]],
    }, { stage, len: L, next: 'idle' });
  }
  if (stage === 'young') {
    const L = 64;
    return bake({
      'body.y': [[0, 0], [8, 1.5, 'out'], [11, -0.5], [17, 0, 'out'], [20, 1.5, 'out'], [26, 0]],
      squash: [[0, 1], [8, 1.06, 'out'], [11, 0.94], [17, 1], [20, 1.06, 'out'], [26, 1]],
      'root.y': [[0, 0], [8, 0, 'out'], [14, -5, 'in'], [20, 0]],
      'legNH.lift': [[0, 0], [9, 0], [13, 2], [19, 0]], 'legNF.lift': [[0, 0], [9, 0], [13, 2], [19, 0]],
      'legFH.lift': [[0, 0], [9, 0], [13, 2], [19, 0]], 'legFF.lift': [[0, 0], [9, 0], [13, 2], [19, 0]],
      'neck.a0': [[0, 0], [8, -6], [26, -6], [56, -3], [64, 0]],
      'head.rot': [[0, 0], [8, 4], [15, -6], [26, -4], [56, -2], [64, 0]],
      'wing.fold': [[0, 0], [6, 0], [10, 0.6], [24, 0.6], [32, 0]],
      'tail.lift': [[0, 0], [8, -6], [56, -6], [64, 0]],
      // half the chain's whip through the hop: a 5 px hop at the young's gain folded the tail under the body
      'tail.stiff': [[0, 0], [6, 0.5], [24, 0.5], [34, 0]],
      'tail.sway': [[0, 0], [26, 0], [28.5, 15], [33.5, -15], [38.5, 15], [43.5, -15], [48.5, 15], [53.5, -15], [56, 0]],
      jaw: [[0, 0], [6, 14], [54, 14], [56, 0]],
      face: [[0, N], [6, H], [56, N]],
      mood: [[0, 0], [6, 2], [56, 2], [64, 0]],
      act: K(ACT.happy), cue: [[0, -8], [L, L - 8]],
    }, { stage, len: L, next: 'idle' });
  }
  const L = 60;
  const lift = (a: number, b: number, h: number): Key[] => [[a, 0], [a + 2, h], [b - 1, 0]];
  return bake({
    squash: [[0, 1], [6, 1.13, 'out'], [9, 0.89], [14, 0.95], [16, 1.12, 'out'], [22, 1.02, 'out'], [23, 0.92], [27, 0.96], [28, 1.1, 'out'], [34, 1]],
    'body.y': [[0, 0], [6, 1, 'out'], [9, 0], [16, 1, 'out'], [22, 0.5], [28, 1, 'out'], [34, 0]],
    'root.y': [[0, 0], [6, 0, 'out'], [11, -6, 'in'], [16, 0], [22, 0, 'out'], [25, -4, 'in'], [28, 0]],
    'legNH.lift': [...lift(6, 16, 1.5), ...lift(22, 28, 1)], 'legNF.lift': [...lift(6, 16, 1.5), ...lift(22, 28, 1)],
    'legFH.lift': [...lift(6, 16, 1.5), ...lift(22, 28, 1)], 'legFF.lift': [...lift(6, 16, 1.5), ...lift(22, 28, 1)],
    // the heavy head flops 6 f behind the body at 2x (4.1)
    'head.rot': lag([[0, 0], [6, 3], [11, -4], [16, 3], [22, 0], [25, -3], [28, 2], [34, 0]], STAGE_TIMING.baby.headLag, STAGE_TIMING.baby.headAmp),
    'wing.fold': [[0, 0], [6, 0], [8.5, 1], [11, 0.2], [13.5, 1], [16, 0], [22, 0], [24, 1], [27, 0]],
    'tail.lift': [[0, 0], [6, -6], [34, -4], [60, 0]],
    'tail.stiff': [[0, 0], [4, 0.5], [30, 0.5], [38, 0]],
    'tail.sway': [[0, 0], [34, 0], [38, 25], [46, -25], [54, 25], [60, 0]],
    jaw: [[0, 0], [4, 20], [56, 20], [57, 0]],
    face: [[0, N], [4, H], [56, N]],
    mood: [[0, 0], [4, 2], [56, 2], [60, 0]],
    act: K(ACT.happy), cue: [[0, -6], [L, L - 6]],
  }, { stage, len: L, next: 'idle' });
}

// ---------- head placement ----------

/** Neck and head offsets (pose.neck.a0 / a1, pose.head.rot) that put the head somewhere. */
export interface HeadFit { a0: number; a1: number; head: number }

/**
 * Where to carry the neck so the CHIN (the jaw's underside) or the MOUTH (the snout tip) lands at root-space height
 * `y`, with the head at `headAng` degrees (+ = snout down) and the body settled `settle` px and pitched `bodyRot`:
 * a small forward model of rig.ts computeDragonJoints' neck (unsnapped), with the neck held straight -- the sleeping
 * head resting on the floor, the eating snout in the bowl. It works from the build's dims, so it fits every element
 * (rock's short dropped neck, water's long one) without a table per look. A baby's neck hides under its head (1 x
 * 3 px) and cannot carry it anywhere: its callers pitch the head instead.
 */
export function neckFit(d: DragonDims, settle: number, bodyRot: number, headAng: number, y: number, part: 'chin' | 'mouth'): HeadFit {
  const N = d.neck, H = d.head, R = bodyRot * Math.PI / 180, A = headAng * Math.PI / 180;
  const ry = -d.bodyY + settle + N.root[0] * Math.sin(R) + N.root[1] * Math.cos(R);
  const px = part === 'chin' ? H.jaw.hx + 2 : H.snout.x1, py = part === 'chin' ? H.jaw.hy + H.jaw.r0 : H.snout.y1 + H.snout.r1 * 0.5;
  const ox = H.fromNeck[0] + px, oy = H.fromNeck[1] + py, dy = ox * Math.sin(A) + oy * Math.cos(A);
  // a straight neck at root-space elevation e (+ up): its end sits at ry - sin(e) * (n * len - sink)
  const reach = Math.max(1, N.n * N.len - N.sink);
  const e = Math.asin(Math.max(-1, Math.min(1, (ry + dy - y) / reach))) * 180 / Math.PI;
  const el = Math.max(-70, Math.min(40, e));
  const a0 = N.rest[0] - bodyRot - el, a1 = N.n > 1 ? N.rest[1] - N.rest[0] : 0;
  return { a0, a1, head: headAng - N.headPitch - a0 - a1 - bodyRot };
}

// ---------- eat ----------

/**
 * EAT (4.2, one bite; the owner draws the bowl AFTER the dragon, so it covers the snout tip in the bowl).
 * Adult 84 f (young 72, the same beats x 0.86): the neck down to the bowl 0-20 (`out`; the snout pitched ~30 deg,
 * the neck fitted so the snout tip reaches the bowl for every element), jaw open 20-26 at the stage minimum (so it
 * never hangs past ~45 deg below level: a third front leg), the CHOMP 26-29 (jaw to 0;
 * the rig sprays 3 crumbs from cue 0), lift 4 px 29-35, chew 3 x (jaw 0 <-> 10 on 6 f beats) with a 1 px head bob
 * 35-71, the neck back up and the GULP 71-78 -- a bulge in the neck contour travelling head -> chest in 3 stepped
 * positions, eyes closed -- then a tail swish. Baby 56 f: the snout plunges into the bowl, 2 chomps (5 crumbs), a
 * 2 px chew bob, `happy` on the swallow (its neck hides under the head: the swallow is a squash pulse), a 6 f
 * tongue lick.
 */
export function eatAnim(stage: Stage, dims: DragonDims | null = null): DragonAnim {
  const C = DFACE.closed, N = DFACE.neutral, H = DFACE.happy;
  if (stage !== 'baby') {
    const k = stage === 'young' ? 72 / 84 : 1, L = Math.round(84 * k), s = (keys: Key[]) => stretchKeys(keys, k);
    // the snout pitched 30 deg into the bowl, the jaw opening at its stage minimum: pitched 50 with the jaw at 20,
    // the open jaw hung ~70 deg below level under the chin and read as a third front leg (its world angle now stays
    // under ~46 deg)
    const bite = dims ? neckFit(dims, 1.5, 6, 30, stage === 'adult' ? -6 : -5, 'mouth') : { a0: 38, a1: 12, head: -10 };
    const bj = dims ? dims.head.jawMin : 16;
    // the lift after the chomp: 4 px up, the neck ~10 deg back up with the head levelling a little
    const up = { a0: bite.a0 - 10, a1: bite.a1, head: bite.head + 4 }, g0 = Math.round(71 * k);
    return bake({
      'neck.a0': s([[0, 0, 'out'], [20, bite.a0], [29, bite.a0], [35, up.a0], [64, up.a0], [71, 4], [78, 0]]),
      'neck.a1': s([[0, 0, 'out'], [20, bite.a1], [29, bite.a1], [35, up.a1], [64, up.a1], [71, 0]]),
      'head.rot': s([[0, 0, 'out'], [20, bite.head], [29, bite.head], [35, up.head], [41, up.head + 2], [47, up.head], [53, up.head + 2],
        [59, up.head], [65, up.head + 2], [71, -2], [78, 0]]),
      'body.rot': s([[0, 0], [20, 6], [35, 5], [64, 5], [74, 0]]),
      'body.y': s([[0, 0], [20, 1.5], [64, 1.5], [74, 0]]),
      jaw: s([[0, 0], [18, 0], [21, bj], [27, bj], [28, bj], [29, 0], [35, 0], [41, 10], [47, 0], [53, 10], [59, 0], [65, 10], [71, 0]]),
      // the gulp: 3 f per stepped position (it has to be seen travelling), eyes closed
      gulp: [[0, 0], [g0, 1], [g0 + 3, 2], [g0 + 6, 3], [g0 + 9, 0]],
      face: [[0, N], [g0, C], [g0 + 9, N]],
      'tail.sway': s([[0, 0], [76, 0], [80, 12], [84, 0]]),
      act: K(ACT.eat), cue: s([[0, -26], [84, 58]]),
    }, { stage, len: L, next: 'idle' });
  }
  // the head's whole pitch stays <= 45 deg (body 24 + neck 12 + head 9): at 85 deg its top turned to face forward --
  // fire's horn bud read as a nose, shriekscale's fans as a trunk -- and the eye sat on the bowl's rim. The body bows
  // and crouches deeper instead, and the bowl stands >= 2 px under the eye (gallery bowlFor)
  const L = 56;
  return bake({
    'neck.a0': [[0, 0, 'out'], [12, 12], [23, 12], [26, 8], [29, 12], [32, 8], [35, 12], [38, 8], [40, 8], [46, 0]],
    'head.rot': [[0, 0, 'out'], [12, 9], [40, 8], [46, 0], [54, -4], [56, 0]],
    'body.rot': [[0, 0, 'out'], [12, 24], [40, 24], [46, 0]],
    'body.y': [[0, 0], [12, 3], [26, 3], [29, 3.5], [32, 2.5], [35, 3.5], [38, 2.5], [40, 3], [46, 0]],
    'legNF.slide': [[0, 0], [12, -1.5], [40, -1.5], [46, 0]], 'legFF.slide': [[0, 0], [12, -1.5], [40, -1.5], [46, 0]],
    squash: [[0, 1], [40, 1], [42, 1.07], [46, 1]],
    jaw: [[0, 0], [10, 0], [12, 20], [14, 20], [15, 0], [18, 0], [20, 20], [22, 20], [23, 0], [47, 0], [48, 20], [53, 20], [54, 0]],
    face: [[0, N], [40, H], [55, N]],
    'tail.sway': [[0, 0], [40, 0], [44, 18], [50, -18], [56, 0]],
    act: K(ACT.eat), cue: [[0, -14], [L, L - 14]],
  }, { stage, len: L, next: 'idle' });
}

// ---------- sleep and wake ----------

/**
 * How far the body settles for the belly to rest on the floor, px: the body's lowest point, pitched `bodyRot` deg
 * (+ = chest down: a pitched body puts the chest ball lower), to 1 px above y = 0. The baby's pot belly rests ON
 * the floor (`extra` 1): its bun is a loaf, not a hover.
 */
function settleOf(d: DragonDims | null, stage: Stage, bodyRot = 0, extra = 0): number {
  if (!d) return (stage === 'adult' ? 12 : stage === 'young' ? 9.5 : 5.5) + extra;
  const a = bodyRot * Math.PI / 180, s = Math.sin(a), c = Math.cos(a);
  const bottom = Math.max(-d.gap / 2 * s + d.hipR, d.gap / 2 * s - c + d.chestR, d.sag ? d.sag.cy * c + d.sag.ry : -1e9);
  return Math.max(0, d.bodyY - bottom - 1) + extra;
}

/** The asleep pose (the lie-down's end and the wake's start), per stage and element tuning. */
interface SleepPose {
  settle: number;
  bodyRot: number;
  head: HeadFit;
  hindTuck: number;
  frontTuck: number;
  squash: number;
}

/**
 * Young and adult rest the chin on the floor in front of the chest (or on the paws: tuning.sleep.chin), the head
 * nearly level (6 deg snout down), the neck fitted for the element; the body settles until the belly rests 1 px off the floor, and the legs fold under it
 * by IK -- an elbow the body pushes to the floor lies on it, the forearm flat forward (the rig's sphinx fold).
 * A BABY (no neck to lower) curls into the BUN (4.2): the head bowed onto its chest, chin down (about 34 deg snout
 * down), the belly on the floor, a squash of 1.08 (a loaf), the front paws drawn forward under the chin; its nubs lie
 * over the head (the tuck branch, 1.4) and rise over its crown (tuning: the anim keys wing.fold past 1).
 */
function sleepPose(stage: Stage, d: DragonDims | null, tune: AnimTuning): SleepPose {
  const sl = tune.sleep;
  if (stage === 'baby') {
    const settle = settleOf(d, stage, sl.bodyRot, 1);
    // net head pitch = a0 + head + body; a0 carries the hidden neck's root forward so the bowed head stays on the chest
    return { settle, bodyRot: sl.bodyRot, head: { a0: 16, a1: 0, head: 18 - sl.bodyRot }, hindTuck: 1, frontTuck: 1.5, squash: 1.08 };
  }
  const settle = settleOf(d, stage, sl.bodyRot);
  const head = d ? neckFit(d, settle, sl.bodyRot, 6, -sl.chin, 'chin') : { a0: 90, a1: -30, head: -80 };
  return { settle, bodyRot: sl.bodyRot, head, hindTuck: stage === 'young' ? 3 : 4, frontTuck: -2, squash: 1 };
}

/**
 * SLEEP (4.2: lie-down, then the loop; `wake` is its own one-shot). Lie-down (adult 40 f, young 34, baby 24): the
 * rump sits first, then the chest settles until the belly rests on the floor (sleepPose: the planted legs fold under
 * it by IK), the tail wraps forward (tuning.tailCurl per segment, tailLift at the root), the head lowers until the
 * chin rests on the floor (a baby bows it onto its chest), the eyes close from about half-way and `sleep` switches
 * on (fire banks its flame, lightning drops to the sad cock). The tuck branch (tuning.tuck: the baby bun) switches
 * with it. Loop, one breath (adult 180 f, 90 / 90; rock 240): squash +0.03 and 1 px of rise; the rig adds the "z"
 * glyphs. A baby's loop has a dream kick of the near hind paw (6 f) at f 90.
 */
export function sleepAnim(stage: Stage, dims: DragonDims | null, tune: AnimTuning): DragonAnim {
  const sl = tune.sleep, L = Math.round(sl.lieDown), B = Math.round(sl.breath), len = L + B, baby = stage === 'baby';
  const k = L / 40, s = (keys: Key[]) => stretchKeys(keys, k);
  const SP = sleepPose(stage, dims, tune), settle = SP.settle, { a0, a1, head: hr } = SP.head;
  // the lie-down, then the loop's breath: inhale to L + B/2, exhale back
  const breath = (rest: number, peak: number): Key[] => [[L, rest, 'inout'], [L + B / 2, peak, 'inout'], [len, rest]];
  // what lands ON the floor (the belly, the chin) eases in without the young's overshoot, which drove both through it
  const tracks: Tracks = {
    'body.y': [...s([[0, 0], [12, settle * 0.35, 'inout'], [32, settle, 'stage']]), ...breath(settle, settle - 1)],
    'body.rot': [...s([[0, 0], [12, -7, 'inout'], [32, SP.bodyRot, 'stage']]), [len, SP.bodyRot]],
    squash: [...s([[0, 1], [32, SP.squash]]), ...breath(SP.squash, SP.squash + 0.03)],
    'neck.a0': [...s([[0, 0], [14, 6, 'inout'], [36, a0, 'stage']]), [len, a0]],
    'neck.a1': [...s([[0, 0], [14, 0, 'inout'], [36, a1, 'stage']]), [len, a1]],
    'head.rot': [...s([[0, 0], [16, 4, 'inout'], [38, hr, 'stage']]), ...breath(hr, hr - 1)],
    'legNH.slide': [...s([[0, 0], [14, SP.hindTuck, 'stage']]), [len, SP.hindTuck]],
    'legFH.slide': [...s([[0, 0], [14, SP.hindTuck, 'stage']]), [len, SP.hindTuck]],
    'legNF.slide': [...s([[0, 0], [16, 0], [32, SP.frontTuck, 'stage']]), [len, SP.frontTuck]],
    'legFF.slide': [...s([[0, 0], [16, 0], [32, SP.frontTuck, 'stage']]), [len, SP.frontTuck]],
    'tail.curl': [...s([[0, 0], [14, 0], [36, sl.tailCurl, 'stage']]), [len, sl.tailCurl]],
    'tail.lift': [...s([[0, 0], [14, 0], [36, sl.tailLift, 'stage']]), [len, sl.tailLift]],
    // the tail lies on the floor: the breathing body does not swing it
    'tail.stiff': [...s([[0, 0], [30, 1]]), [len, 1]],
    face: [[0, DFACE.neutral], [Math.round(12 * k), DFACE.sleepy], [Math.round(22 * k), DFACE.closed]],
    sleep: [[0, 0], [Math.round(24 * k), 1]],
    tuck: [[0, 0], [Math.round(30 * k), sl.tuck]],
    act: K(ACT.sleep),
    cue: [[0, -L], [L, 0], [len, B]],
  };
  // the bun's nubs rise over the crown (fold past 1 carries the nub on past its 140 deg flutter angle: rig.ts)
  if (baby) tracks['wing.fold'] = [...s([[0, 0], [20, 0], [34, sl.nubFold, 'stage']]), [len, sl.nubFold]];
  if (baby) {
    // the dream kick: the near hind paw twitches twice in 6 f
    tracks['legNH.lift'] = [[0, 0], [L + 90, 0], [L + 91, 1.5], [L + 93, 0], [L + 94, 1], [L + 96, 0]];
  }
  return bake(tracks, { stage, len, loop: true, loopFrom: L });
}

/**
 * WAKE (4.2, one-shot from the sleep loop's first frame; the owner blends in from wherever the breath was).
 * Adult 30 f (young 26, baby 24), overlapping beats: the eyes open (sleepy) at f 3 and `sleep` switches off with
 * them, so fire's flame un-banks and lightning's bolts lift as the eyes open, never behind shut eyes; the STRETCH
 * 0-12 is a play-bow -- rump up, chest down (body rot +12), the front paws pushed forward flat along the floor, the
 * neck reaching forward and down with the head level -- a FULL wing spread 5-17 (a baby flutters its nubs), a yawn
 * 4-20 (jaw 30, the eyes squeezed shut at its peak), then a shake (root +-3, 3 x 4 f) back to standing.
 */
export function wakeAnim(stage: Stage, dims: DragonDims | null, tune: AnimTuning): DragonAnim {
  const baby = stage === 'baby', k = baby ? 24 / 30 : stage === 'young' ? 26 / 30 : 1, L = Math.round(30 * k), s = (keys: Key[]) => stretchKeys(keys, k);
  const sl = tune.sleep, SP = sleepPose(stage, dims, tune), settle = SP.settle, { a0, a1, head: hr } = SP.head;
  const reach = baby ? 2 : stage === 'young' ? 5 : 7;
  const tracks: Tracks = {
    'body.y': s([[0, settle], [10, settle * 0.5], [14, settle * 0.45], [20, 0, 'out'], [30, 0]]),
    'body.rot': s([[0, SP.bodyRot], [8, 12], [13, 12], [20, 0], [30, 0]]),
    squash: s([[0, SP.squash], [10, 1], [30, 1]]),
    'neck.a0': s([[0, a0], [8, 10], [13, 10], [20, -4], [24, 0]]),
    'neck.a1': s([[0, a1], [8, 0], [30, 0]]),
    // the head stays level through the bow (it cancels the neck and the body pitch), then lifts into the shake
    'head.rot': s([[0, hr], [8, -20], [13, -20], [20, -2], [24, 0]]),
    'legNH.slide': s([[0, SP.hindTuck], [8, 0]]), 'legFH.slide': s([[0, SP.hindTuck], [8, 0]]),
    'legNF.slide': s([[0, SP.frontTuck], [8, reach], [14, reach], [22, 0]]), 'legFF.slide': s([[0, SP.frontTuck], [8, reach], [14, reach], [22, 0]]),
    'tail.curl': s([[0, sl.tailCurl], [14, 0]]), 'tail.lift': s([[0, sl.tailLift], [12, 0], [30, 0]]),
    'tail.stiff': s([[0, 1], [12, 0.6], [30, 0]]),
    'wing.fold': baby ? s([[0, sl.nubFold], [5, 1], [8, 0.2], [11, 1], [14, 0.2], [17, 1], [20, 0]]) : s([[0, 0], [5, 1], [17, 1], [22, 0]]),
    jaw: s([[0, 0], [4, 0], [7, 30], [18, 30], [20, 0]]),
    'root.rot': s([[0, 0], [18, 0], [20, 3], [22, -3], [24, 3], [26, -3], [28, 3], [30, 0]]),
    face: [[0, DFACE.closed], [Math.round(3 * k), DFACE.sleepy], [Math.round(8 * k), DFACE.closed], [Math.round(18 * k), DFACE.sleepy], [Math.round(21 * k), DFACE.neutral]],
    sleep: [[0, 1], [Math.round(3 * k), 0]],
    tuck: [[0, sl.tuck], [Math.round(3 * k), 0]],
    act: K(ACT.wake), cue: [[0, 0], [L, L]],
  };
  return bake(tracks, { stage, len: L, next: 'idle' });
}

// ---------- breath ----------

/**
 * BREATH (4.2, the signature one-shot). pose.fx is the stream's envelope and pose.cue the frames since the snap,
 * for the element's breath renderer (element.ts). Adult 70 f: WIND-UP 0-18 (head back -8, neck a1 -10, the chest
 * puffs; spike's quills snap upright on `bristle`, shriekscale's fans fold flat on `flare`: the element's tell),
 * SNAP 18-24 (a neck thrust, neck a0 -6 with the head level to a little up, `out`; jaw to tuning.jaw, a 1 px
 * recoil; the fans snap to the dish), SUSTAIN 24-54 (fx 1; the head jitters 1 px every 4 f; the tail stiff),
 * RECOVER 54-70 (jaw closed, `happy` for 10 f: proud). The rig aims the stream along the snout, never more than
 * 10 deg below level (rig.ts mouthAng).
 * Young 56 f (14 / 5 / 22 / 15), a 3 px recoil (still learning). Baby 36 f (10 / 4 / 8 / 14): the stream is the
 * element's FIZZLE, then tuning.fizzleFace for 12 f (dazed; rock's proud "ptoo" and water's pop are happy) and a
 * 2 px sneeze-back.
 */
export function breathAnim(stage: Stage, tune: AnimTuning): DragonAnim {
  const b = tune.breath, H = DFACE.happy, N = DFACE.neutral;
  const baby = stage === 'baby', flop = baby ? Math.round(b.flop) : 0;
  const [w, sn, su, rc] = stage === 'adult' ? [18, 6, 30, 16] : stage === 'young' ? [14, 5, 22, 15] : [10, 4, 8, 14 + flop];
  const s0 = w, s1 = w + sn, e0 = s1 + su, L = e0 + rc;
  const recoil = stage === 'young' ? 3 : 1;
  // The snap is a neck THRUST, the head level to a little up: "head forward" keyed as head +12 (snout down) was a
  // nod, and every stream went 35-40 deg into the floor. The sustain's head jitter: 1 px (about 2 deg) every 4 f.
  const jit: Key[] = [];
  for (let t = s1; t < e0; t += 4) jit.push([t, -2 + (((t - s1) / 4) % 2 ? -2 : 2)], [t + 3, -2 + (((t - s1) / 4) % 2 ? -2 : 2)]);
  const tracks: Tracks = {
    'head.rot': [[0, 0], [s0, -8], [s0 + 3, -2, 'out'], ...(baby ? [] : jit), [e0, -2], [e0 + 6, baby ? b.fizzleChin : 0], [L, baby ? b.fizzleChin : 0]],
    'neck.a1': [[0, 0], [s0, -10], [s1, 0], [e0, 0], [L, 0]],
    'neck.a0': [[0, 0], [s0, -4], [s1, -6], [e0, -6], [L, 0]],
    'body.rot': [[0, 0], [s0, -3], [s1, 1], [e0, 1], [L, 0]],
    // (a baby that puffs up for its fizzle -- spike's puffball -- holds it wide through the fizzle, then deflates)
    squash: baby && b.puff > 1 ? [[0, 1], [s0 - 3, b.puff, 'out'], [e0, b.puff], [e0 + 4, 1], [L, 1]] : [[0, 1], [s0, 1.05], [s1, 1], [L, 1]],
    'root.x': baby
      ? [[0, 0], [s0, 0, 'out'], [s0 + 2, -1], [e0, -1, 'out'], [e0 + 2, -2], [e0 + 8, -2], [L, 0]]
      : [[0, 0], [s0, 0, 'out'], [s0 + 4, -recoil], [e0, -recoil], [L, 0]],
    // the jaw is open (>= its stage minimum) by the snap's first frame, cue 0, where the streams start: opening
    // over the snap's first 2 f, a bolt and a bubble left a still-closed mouth
    jaw: [[0, 0], [s0 - 2, 0], [s0, b.jaw], [e0, b.jaw], [e0 + 4, 0]],
    fx: [[0, 0], [s0, 0, 'linear'], [s0 + 2, 1], [e0, 1, 'linear'], [e0 + 3, 0]],
    bristle: [[0, 0], [4, 1, 'linear'], [s0, 1], [s1, 0]],
    flare: [[0, 0], [Math.min(10, s0), -1], [s0, -1, 'overshoot'], [s0 + 4, 1.3], [e0, 1.3], [L, 0]],
    'tail.lift': [[0, 0], [s0, -4], [e0, -4], [L, 0]],
    // "the tail is stiff" (4.2): the chain's lag held off from the wind-up through the sustain, eased back after
    'tail.stiff': [[0, 0], [6, 1], [e0, 1], [L, 0]],
    // (a baby with a fan-flop gag, E8: the fizzle face under the flopped fans, a blink as they pop back up)
    face: baby && flop ? [[0, N], [e0, DFACE[b.fizzleFace]], [e0 + flop, DFACE.closed], [e0 + flop + 4, N]]
      : baby ? [[0, N], [e0, DFACE[b.fizzleFace]], [e0 + 12, N]] : [[0, N], [e0 + 4, H], [e0 + 14, N]],
    act: K(ACT.breath), cue: [[0, -s0], [L, L - s0]],
  };
  if (flop) tracks.eyeClip = [[0, 1], [e0, 0], [e0 + flop, 1]];
  return bake(tracks, { stage, len: L, next: 'idle' });
}

// ---------- pet and beg ----------

/**
 * PET (4.2, loop while held). Adult 48 f (young 44, baby 36): the head leans 15 deg into the hand, `happy` (with
 * its blush), the tail wags, a 1 px purr every 4 f. The baby leans its whole body in (root rot 6). The game raises
 * the resting mood +0.2 per loop; the anim shows the cue content (mood +0.5 on top).
 */
export function petAnim(stage: Stage): DragonAnim {
  const L = stage === 'adult' ? 48 : stage === 'young' ? 44 : 36, baby = stage === 'baby';
  const tracks: Tracks = {
    'neck.a0': [[0, -6], [L / 2, -8]],
    'head.rot': [[0, 12], [L / 2, 16]],
    'body.y': (t) => (Math.floor(t / 2) % 2 ? 0.6 : 0),
    'tail.sway': baby ? [[0, 16], [L / 4, -16], [L / 2, 16], [(3 * L) / 4, -16]] : [[0, 12], [L / 2, -12]],
    'tail.lift': K(-4),
    face: K(DFACE.happy),
    mood: K(0.5),
    act: K(ACT.pet), cue: [[0, 0], [L, L]],
  };
  // (a baby's `happy` opens the jaw to its 20 deg minimum, tongue out (2.5): with the jaw shut its mouth-corner
  // notch sat right under the "^" and bent it into a hook, so faces.ts keeps marks off the eye and the smile is here)
  if (baby) { tracks['root.rot'] = [[0, 5], [L / 2, 7]]; tracks['head.rot'] = [[0, 8], [L / 2, 12]]; tracks.jaw = K(20); }
  return bake(tracks, { stage, len: L, loop: true });
}

/**
 * BEG (4.2, the hungry idle, loop 120 f at every stage): it SITS (rump down, chest up, the hind paws drawn under),
 * the head tilted up (tuning.beg.tilt; babies tilt further), `hungry`, the cue at tuning.beg.mood (-0.5), a slow
 * pleading bob, and a stomach growl at f 80 (3 shakes of 1 px, 2 f each). The element's hungry tell reads
 * act = beg.
 */
export function begAnim(stage: Stage, tune: AnimTuning): DragonAnim {
  const L = 120, g = tune.beg, baby = stage === 'baby';
  return bake({
    'body.rot': K(baby ? -10 : -14),
    'body.y': [[0, baby ? 1 : 2.5], [30, baby ? 0.6 : 2], [60, baby ? 1 : 2.5], [90, baby ? 0.6 : 2]],
    'legNH.slide': K(baby ? 1 : 3), 'legFH.slide': K(baby ? 1 : 3),
    'neck.a0': [[0, -8], [30, -10], [60, -8], [90, -10]],
    'head.rot': lag([[0, -g.tilt], [30, -g.tilt - 4], [60, -g.tilt], [90, -g.tilt - 4]], STAGE_TIMING[stage].headLag),
    squash: [[0, 1], [30, 1.02], [60, 1], [90, 1.02]],
    'root.x': [[0, 0], [80, 0, 'linear'], [81, 1, 'linear'], [83, -1, 'linear'], [85, 1, 'linear'], [87, -1, 'linear'], [88, 0]],
    'tail.lift': K(6),
    'tail.sway': [[0, -4], [60, 4]],
    face: K(DFACE.hungry),
    mood: K(g.mood),
    act: K(ACT.beg), cue: [[0, 0], [L, L]],
  }, { stage, len: L, loop: true });
}

// ---------- idle variants (4.2 "Variants every 6 to 10 s") ----------

/**
 * LOOK-AROUND (adult 40 f; young x 0.85, baby x 0.6): the head lifts to look up (-12) and dips to look down (+12),
 * the neck following, then settles. In a side view the look is a pitch: a turn toward the viewer cannot be drawn.
 */
export function lookAroundAnim(stage: Stage): DragonAnim {
  const k = STAGE_TIMING[stage].dur, s = (keys: Key[]) => stretchKeys(keys, k), L = Math.round(40 * k);
  return bake({
    'neck.a0': s([[0, 0], [8, -6], [18, -6], [26, 4], [33, 4], [40, 0]]),
    'head.rot': s([[0, 0], [8, -12], [18, -12], [26, 12], [33, 12], [40, 0]]),
    act: K(ACT.variant), cue: [[0, 0], [L, L]],
  }, { stage, len: L, next: 'idle' });
}

/** YAWN (adult 40 f): the head tips back, the jaw opens wide (30; the rig caps it per stage) with the eyes squeezed shut, a stretch up. */
export function yawnAnim(stage: Stage): DragonAnim {
  const k = STAGE_TIMING[stage].dur, s = (keys: Key[]) => stretchKeys(keys, k), L = Math.round(40 * k);
  return bake({
    'neck.a0': s([[0, 0], [10, -8], [26, -8], [34, 0]]),
    'head.rot': s([[0, 0], [10, -14], [26, -14], [34, 2], [40, 0]]),
    'body.rot': s([[0, 0], [12, -3], [26, -3], [34, 0]]),
    squash: s([[0, 1], [12, 0.97], [26, 0.97], [32, 1]]),
    jaw: s([[0, 0], [8, 0], [12, 30], [26, 30], [29, 0]]),
    face: [[0, DFACE.neutral], [Math.round(9 * k), DFACE.closed], [Math.round(28 * k), DFACE.sleepy], [Math.round(34 * k), DFACE.neutral]],
    act: K(ACT.variant), cue: [[0, 0], [L, L]],
  }, { stage, len: L, next: 'idle' });
}

/**
 * SCRATCH (young / adult, 36 f): the near hind paw comes up and forward under the belly (its IK target lifted and
 * slid: the leg folds), scratches in 3 f strokes, the head tilted down toward it, eyes blissfully shut, and returns.
 */
export function scratchAnim(stage: Stage, dims: DragonDims | null): DragonAnim {
  const k = STAGE_TIMING[stage].dur, s = (keys: Key[]) => stretchKeys(keys, k), L = Math.round(36 * k);
  const up = dims ? dims.bodyY * 0.5 : 9, fwd = dims ? dims.gap * 0.55 : 8;
  const strokes: Key[] = [[0, 0], [8, fwd]];
  for (let t = 10; t < 28; t += 3) strokes.push([t, fwd + (((t - 10) / 3) % 2 ? -2 : 1)]);
  strokes.push([28, fwd], [34, 0]);
  return bake({
    'legNH.lift': s([[0, 0], [8, up], [28, up], [34, 0]]),
    'legNH.slide': s(strokes),
    'body.rot': s([[0, 0], [8, 5], [28, 5], [34, 0]]),
    'neck.a0': s([[0, 0], [8, 8], [28, 8], [34, 0]]),
    'head.rot': s([[0, 0], [8, 10], [28, 10], [34, 0]]),
    face: [[0, DFACE.neutral], [Math.round(9 * k), DFACE.happy], [Math.round(28 * k), DFACE.neutral]],
    act: K(ACT.variant), cue: [[0, 0], [L, L]],
  }, { stage, len: L, next: 'idle' });
}

/**
 * TOPPLE (baby, 48 f): the baby's scratch -- a hind paw up, a wobble, and over it goes onto its rump (root rot -20:
 * nose up, the front paws off the floor), surprised, then sheepish as it rocks back onto its feet.
 */
export function toppleAnim(stage: Stage): DragonAnim {
  const L = 48;
  return bake({
    'legNH.lift': [[0, 0], [6, 3], [14, 3], [18, 0]],
    'root.rot': [[0, 0], [10, 0], [13, 4], [16, -4], [24, -20, 'out'], [34, -20], [44, 0]],
    'legNF.plant': [[0, 1], [18, 1], [22, 0], [38, 0], [42, 1]], 'legFF.plant': [[0, 1], [18, 1], [22, 0], [38, 0], [42, 1]],
    'legNF.upper': [[0, 0], [22, 0], [26, 20], [36, 20], [42, 0]], 'legFF.upper': [[0, 0], [22, 0], [26, 20], [36, 20], [42, 0]],
    'head.rot': lag([[0, 0], [12, 3], [16, -3], [24, 6], [34, 4], [44, 0]], STAGE_TIMING.baby.headLag, 1),
    'tail.stiff': [[0, 0], [16, 0.6], [40, 0.6], [48, 0]],
    face: [[0, DFACE.neutral], [22, DFACE.surprised], [34, DFACE.sheepish], [46, DFACE.neutral]],
    act: K(ACT.variant), cue: [[0, 0], [L, L]],
  }, { stage, len: L, next: 'idle' });
}

/**
 * PLOP-SIT (baby, 76 f): the hind legs fold over 10 f and it plops onto its rump (chest up), sits for 60 f looking
 * up, then pops up over 6 f with a stretch of 1.1.
 */
export function plopSitAnim(stage: Stage): DragonAnim {
  const L = 76;
  return bake({
    'body.rot': [[0, 0], [10, -16, 'out'], [70, -16], [76, 0]],
    'body.y': [[0, 0], [10, 2, 'out'], [70, 2], [73, -1], [76, 0]],
    squash: [[0, 1], [8, 1.06], [12, 1], [70, 1], [73, 0.91], [76, 1]],
    'legNH.slide': [[0, 0], [10, 1.5], [70, 1.5], [74, 0]], 'legFH.slide': [[0, 0], [10, 1.5], [70, 1.5], [74, 0]],
    'head.rot': [[0, 0], [12, -6], [40, -9], [70, -6], [76, 0]],
    'tail.lift': [[0, 0], [10, 10], [70, 10], [76, 0]],
    act: K(ACT.variant), cue: [[0, 0], [L, L]],
  }, { stage, len: L, next: 'idle' });
}

/**
 * The idle's variants by table name, for DragonAnimPlayer.setVariants('idle', ...): a name may repeat to weight it
 * (the baby's plop-sit comes up about one idle loop in four). 'fidget' is the element's own (ElementAnimHooks.fidget)
 * and is skipped where the element has none.
 */
export function idleVariants(stage: Stage): readonly string[] {
  return stage === 'baby' ? ['lookAround', 'yawn', 'topple', 'plopSit', 'plopSit', 'fidget'] : ['lookAround', 'yawn', 'scratch', 'fidget'];
}

// ---------- the table ----------

/** The shared table for a stage and tuning, before element overrides. `dims` (build.ts) sizes the lie-down. */
export function baseAnims(stage: Stage, tune: AnimTuning = animTuning(stage), dims: DragonDims | null = null): DragonAnimSet {
  return {
    idle: stage === 'adult' ? idleAdult() : stage === 'young' ? idleYoung() : idleBaby(),
    walk: walkAnim(stage, tune.walk),
    happy: happyAnim(stage),
    eat: eatAnim(stage, dims),
    sleep: sleepAnim(stage, dims, tune),
    wake: wakeAnim(stage, dims, tune),
    breath: breathAnim(stage, tune),
    pet: petAnim(stage),
    beg: begAnim(stage, tune),
    rest: REST,
    lookAround: lookAroundAnim(stage),
    yawn: yawnAnim(stage),
    ...(stage === 'baby' ? { topple: toppleAnim(stage), plopSit: plopSitAnim(stage) } : { scratch: scratchAnim(stage, dims) }),
  };
}

const CACHE = new Map<string, DragonAnimSet>();

/**
 * The table a pet plays: the stage's shared anims, built with the element's tuning, then the element's overrides
 * merged over them. Built once per element and stage (every pet of that look shares it: frames are read-only).
 */
export function dragonAnims(stage: Stage, spec?: ElementSpec | null, dims: DragonDims | null = null): DragonAnimSet {
  const key = `${spec ? spec.id : '-'}:${stage}:${dims ? 1 : 0}`;
  const hit = CACHE.get(key);
  if (hit) return hit;
  const set = baseAnims(stage, animTuning(stage, spec), dims);
  const ov = spec && spec.anims && spec.anims.overrides ? spec.anims.overrides(stage, dims) : null;
  if (ov) for (const k of Object.keys(ov)) { const a = ov[k]; if (a) set[k] = a; }
  // the element's idle fidget joins the table as 'fidget', where idleVariants schedules it (4.2, section 3)
  const fid = spec && spec.anims && spec.anims.fidget ? spec.anims.fidget(stage, dims) : null;
  if (fid) set.fidget = fid;
  CACHE.set(key, set);
  return set;
}

/** Anim names in the order the gallery's number keys pick them (1-9, then 0). */
export const ANIM_NAMES: readonly string[] = ['idle', 'walk', 'happy', 'eat', 'sleep', 'wake', 'breath', 'pet', 'beg', 'rest'];

/** The idle variants and the element fidget (one-shots the player's variant schedule cuts to, 4.2). */
export const VARIANT_NAMES: readonly string[] = ['lookAround', 'yawn', 'scratch', 'topple', 'plopSit', 'fidget'];

/** The one-shots: they end (the owner then plays `next`), everything else loops. */
export const ONE_SHOTS: readonly string[] = ['happy', 'eat', 'wake', 'breath', ...VARIANT_NAMES];
