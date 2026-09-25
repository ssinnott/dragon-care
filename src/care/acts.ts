// The care acts (docs/KEEPERS.md 6): a keeper and a dragon, choreographed. Each act is a small phase machine stepped
// once per tick; it reads what finished on the last tick, starts what comes next, then steps the two agents it owns.
// The dragon answers with its own anims (bible 4.2), none of them new:
//   feed  a keeper carries a bowl to a begging dragon, kneels and sets it down a little way out in front of it, steps
//         back, and the dragon walks up to it (a dog trotting to its bowl), eats two bites and is happy; the keeper
//         cheers, the dragon turns and trots off, and the keeper takes the empty bowl away;
//   pet   a keeper strokes the dragon while it plays its pet loop (it leans into the hand), lets go, and watches the
//         happy that thanks it. Tomas grooms instead: his brush, bristles down, along its neck or its back;
//   tuck  the night keeper kneels by a sleepy dragon while it lies down, strokes its back until it is asleep (dusk's
//         own tuck-in: petted, it purrs, then its lamp steps down to its nightlight), rises, puts a finger to her lips,
//         and tiptoes away.
// STAGING (K7). A feed is FRONT on (the bowl goes in front of the dragon); a pet, a groom and a tuck-in are from the
// SIDE, the way a person pets a pony: the keeper at the dragon's shoulder, a step nearer the camera, facing the way it
// faces, reaching forward, kneeling on both knees for a small or a lying dragon. WHERE the hand goes and where the
// keeper stands are PLANNED before it walks over (planSide): the back of the crown if it can, else the top of the neck,
// else the back (a baby's: its rump); a spot a stroke's length from it. Each is checked by dry runs of the keeper's own
// poses, drawn off screen, against the dragon's eye as the dragon will be posed at every point of the act (keeper.ts
// dryRun): the keeper's body, arms, hat and brush never cover the eye, and the hand reaches its mark. The eyes are
// big and a keeper's fist is 9 or 10 px, so on a baby, or a head laid on the floor, the head is out: no fixed spacing
// or mark does for every look. Gallery view=careaudit runs every act on every look and fails any frame where these do
// not hold.
import { clamp } from '../lib/engine/math.ts';
import { setDownAnim, petStroke, propsOf } from '../art/keeper/anims.ts';
import type { HandT } from '../art/keeper/anims.ts';
import { armReach, hipYOf } from '../art/keeper/ik.ts';
import { TOOL_BOWL, TOOL_BRUSH, BRUSH_DROP } from '../art/keeper/parts.ts';
import type { KeeperAgent, Box } from './keeper.ts';
import { stepKeeperAgent, toGround, coverage, dryRun, frameAt, shoulderAt } from './keeper.ts';
import type { DragonAgent } from './dragon.ts';
import { playDragon, stepDragonAgent, turnDragon, quiet, craniumPoint, pointIn, neckTop, backTop, eyeBox, bowlScreenX, bodySpan } from './dragon.ts';

export type ActKind = 'feed' | 'pet' | 'tuck';

export interface CareAct {
  kind: ActKind;
  k: KeeperAgent;
  d: DragonAgent;
  /** The phase, and frames spent in it. */
  phase: string;
  t: number;
  /** Where the keeper does it: screen position and facing. */
  standX: number;
  standY: number;
  face: number;
  /** Front on (a feed: the bowl goes in front) or from the side (a pet, a groom, a tuck-in); kneeling or not. */
  staging: 'front' | 'side';
  low: boolean;
  /** Tomas grooms: the brush on the dragon's neck (a baby's: the back of its head). */
  groom: boolean;
  /** Where the stroking hand goes (planSide's choice). */
  mark: Mark;
  /** Feed: ground px from the kneeling keeper to the bowl's centre; the bowl's screen x; where the dragon eats from. */
  bowlAt: number;
  bowlX: number;
  eatX: number;
  /** Feed: where the keeper waits while the dragon eats (screen x). */
  backX: number;
  /** Bites eaten, strokes given; the frame index where a lying dragon's lie-down ends (a tuck-in). */
  count: number;
  lieEnd: number;
  /** Where the keeper walks off to when it is done (screen x, y). */
  exitX: number;
  exitY: number;
  /** A point to walk by first (behind the dragon, when the straight way crosses it), or null. */
  via: { x: number; y: number } | null;
  done: boolean;
  /**
   * The act steps its dragon until the keeper walks off (`leave`): from then on the dragon is its owner's again (the
   * yard lets it go home, or sleep; a gallery vignette steps it), while the act walks the keeper away.
   */
  ownsDragon: boolean;
}

/** How many bites a fed dragon eats (each is its one-bite eat anim: bible 4.2). */
export const FEED_BITES = 2;
/** Strokes in a pet (at the stroke period), and in a tuck-in once the dragon is asleep. */
export const PET_STROKES = 4, TUCK_STROKES = 2;
/** Frames per stroke: a pet's brisk, a tuck-in's slow. */
const STROKE = 26, STROKE_TUCK = 40;
/** Frames a keeper takes to settle into its working pose (the anim's blend) before its hand moves (the plan's poses). */
const SETTLE = 8;
/**
 * The stroke's arc over the head, cranium degrees (0 toward the snout, -90 the crown): the back of the crown on a young
 * or grown head, the back of the head on a baby's, whose crown is right over its big eye.
 */
const ARC: Readonly<Record<string, readonly [number, number]>> = { baby: [-150, -176], young: [-112, -150], adult: [-112, -150], elder: [-112, -150] };
/** Feed: how far the dragon walks up to its bowl at least, px, by stage (the keeper sets it down that far out). */
const FEED_GAP: Readonly<Record<string, number>> = { baby: 9, young: 12, adult: 14, elder: 14 };
/** Feed: how far the keeper steps back while the dragon eats, px. */
const FEED_BACK = 20;
/** Feed: how far the fed dragon trots off before the keeper comes back for the bowl, px. */
const FEED_TROT = 30;
/** Tuck-in: how far the keeper tiptoes away from the sleeping dragon before it walks, px. */
const TIPTOE = 40;

const PT = { x: 0, y: 0 }, SH = { x: 0, y: 0 };

/** Is this act's keeper grooming (it carries the brush)? */
const grooms = (k: KeeperAgent): boolean => k.rig.spec.tool === 'brush';

/**
 * Which side a keeper comes to a dragon from, as a direction along the floor from the dragon: a feed from in front
 * (+ its facing: the bowl goes there), a pet, a groom or a tuck-in from behind (- its facing), so a keeper walking in
 * to the side staging never crosses the dragon's face.
 */
export function approachSide(kind: ActKind, d: DragonAgent): number { return kind === 'feed' ? d.facing : -d.facing; }

/** A box grown by `pad` px each side. */
function grow(b: Box, pad: number): Box { return { x0: b.x0 - pad, y0: b.y0 - pad, x1: b.x1 + pad, y1: b.y1 + pad }; }

/**
 * Where a stroking hand goes: along the back of the crown (`from` .. `to` in cranium degrees), along the top of the
 * neck (neckTop's u: 0 behind the head .. 1 at the shoulders), or along the back (backTop's u: 0 the withers .. 1 the
 * rump).
 */
export interface Mark { on: 'crown' | 'neck' | 'back'; from: number; to: number }

/**
 * The marks a keeper tries, in order (planSide takes the first it can reach with the eye clear throughout). A PET:
 * the back of the crown (a baby's: the back of its head), then the same arc slid back 10 deg at a time (a baby's big
 * eye comes up to its crown, and the fist lay over it); the top of the neck behind the head, then lower down it; the
 * withers and the back last (a child beside a grown dragon pats its neck or its back, as a child pats a pony). A
 * GROOM (Tomas's brush, 11 px wide under his fist): the top of the neck, then the back. A TUCK-IN strokes the back of
 * a dragon lying down: on a head laid on the floor the eye is most of the head's side, and no stroke of it kept off.
 */
function marksFor(a: Pick<CareAct, 'd' | 'groom' | 'kind'>): readonly Mark[] {
  const st = a.d.stage, [c0, c1] = ARC[st], crown: Mark[] = [];
  for (let back = 0; back <= (st === 'baby' ? 40 : 30); back += 10) crown.push({ on: 'crown', from: c0 - back, to: c1 - back });
  const neck = (from: number, to: number): Mark => ({ on: 'neck', from, to });
  const back = (from: number, to: number): Mark => ({ on: 'back', from, to });
  // (a baby's short back hides under its head: its hand goes on the rump, round the hip ball)
  const backs = st === 'baby' ? [back(0.8, 1.3), back(1.1, 1.6), back(1.4, 1.9)] : [back(0.05, 0.4), back(0.3, 0.65), back(0.6, 1)];
  if (a.kind === 'tuck') return backs;
  if (a.groom) return st === 'baby' ? backs : [neck(0.15, 0.6), neck(0.3, 0.75), neck(0.45, 0.9), ...backs];
  return st === 'baby' ? [...crown, ...backs] : [...crown, neck(0.1, 0.45), neck(0.3, 0.65), neck(0.45, 0.85), ...backs];
}

/**
 * Can a mark work at all: does the part of the hand that is there whichever way the forearm points (the engine's fist,
 * rigParts.ts drawFist, runs -0.6 r to +1.6 r along the forearm and +-r across it: a disc of 0.6 r and its ink round
 * the joint) stay off the eye at both ends of the stroke, on every sampled pose? A quick test before the search;
 * the dry runs decide the rest. A brush adds the 11 x 8 px under the fist (parts.ts drawHeldBrush), which is drawn
 * level whatever the arm does.
 */
function handClear(a: CareAct, S: readonly DSample[]): boolean {
  const k = a.k, sc = k.scale, f = a.face, R = (0.6 * k.rig.p.handR + 1) * sc;
  for (const s of S) for (const t of [s.t0, s.t1]) {
    let x0 = t.x - R, x1 = t.x + R, y1 = t.y + R;
    const y0 = t.y - R;
    if (a.groom) { x0 = Math.min(x0, t.x - (f > 0 ? 6 : 7) * sc); x1 = Math.max(x1, t.x + (f > 0 ? 7 : 6) * sc); y1 = Math.max(y1, t.y + 9 * sc); }
    if (x0 < s.eye.x1 && x1 > s.eye.x0 && y0 < s.eye.y1 && y1 > s.eye.y0) return false;
  }
  return true;
}

/**
 * The hand's mark on the dragon as it is posed now, at `u` along the stroke (0 its start, 1 its far end): on the mark
 * a hand's radius out (the fist resting on it); a brush's fist BRUSH_DROP over it, so the bristles lie on it.
 */
function careTarget(a: Pick<CareAct, 'd' | 'k' | 'groom' | 'mark'>, u: number, out: { x: number; y: number }): { x: number; y: number } {
  const m = a.mark, v = m.from + (m.to - m.from) * u, off = a.groom ? 0 : a.k.rig.p.handR - 2;
  if (m.on === 'neck') neckTop(a.d, v, off, out);
  else if (m.on === 'back') backTop(a.d, v, off, out);
  else craniumPoint(a.d, v, off, out);
  if (a.groom) out.y -= BRUSH_DROP;
  return out;
}

/** A hand within this of its mark is on it, px (the audit allows REACH_MISS; the joints snap to whole pixels). */
const REACH_OK = 1.5;
/** A stroke's every mark lies this far inside the straight arm's reach, px (the poses between the samples wander). */
const REACH_SLACK = 1.5;
/**
 * The plan keeps a keeper this far off the eye box, px: the poses between the ones it samples (a blend from one anim
 * to the next, a hand easing on, a dragon between two sampled frames) wander a pixel or two.
 */
const EYE_MARGIN = 2;

/** The dragon in one pose the plan checks against: its eye (grown EYE_MARGIN) and the stroke's two ends, on screen. */
interface DSample { eye: Box; t0: { x: number; y: number }; t1: { x: number; y: number } }
/**
 * One check at a spot: frame `frame` of the keeper's anim `anim` against the dragon posed as `s`, the near hand
 * reaching for the stroke's ends (`reach`: blended in by `w`, as a hand eases on and off) or not reaching (null).
 */
interface Check { anim: string; frame: number; s: DSample; reach: number | null }

/** The frames of a keeper anim at fractions of its length. */
function kFrames(k: KeeperAgent, anim: string, at: readonly number[]): number[] {
  const a = k.player.anims[anim], fr = a?.frames ?? [];
  let len = 0;
  for (const f of fr) len += f.dur || 1;
  return at.map((u) => frameAt(fr, u * Math.max(0, len - 1), false));
}

/**
 * PLAN the side staging (K7): where the keeper stands, whether it kneels and which mark it strokes, so that its hand
 * reaches the mark on every sampled pose of the dragon and nothing of it covers the dragon's eye at any point of the
 * act. Every phase the keeper spends at the spot is checked by a dry run against the dragon as it will be then
 * (`plan`: which of the dragon's poses go with which of the keeper's). For each mark (marksFor), kneeling or standing
 * (the posture the mark's height suggests first), spots run 1 px apart outward from where the first mark sits at 0.7
 * of the arm's reach. A spot must first REACH: every end of the stroke on every sampled pose within the straight arm
 * less REACH_SLACK of the shoulder (the poses between the samples wander), and the hand's joint within REACH_OK of it
 * as a tick places it (keeper.ts dryRun, snapped to the pixel grid); then its dry runs must keep the eye clear. The
 * first such spot wins. None (no look in the audit needs it): the eye-clear spot whose stroke overreaches least.
 */
function planSide(a: CareAct, plan: (low: boolean, sample: (anim: string, frame: number) => DSample) => { work: Check[]; around: Check[] }, lying: boolean): void {
  const { k, d } = a, p = propsOf(k.rig.spec), face = d.facing, standY = d.y + 5, sc = k.scale;
  a.face = face; a.standY = standY; a.staging = 'side';
  const ground = (t: { x: number; y: number }, x: number): HandT => ({ x: ((t.x - x) * face) / sc, y: (t.y - standY) / sc });
  const reach = (armReach(p) - REACH_SLACK) * sc;
  // the dragon in each pose a check asks for, solved once: its eye and every mark's two ends
  const marks = marksFor(a), poses = new Map<string, DSample[]>();
  const posed = (anim: string, frame: number): DSample[] => {
    const key = `${anim}:${frame}`;
    let v = poses.get(key);
    if (!v) {
      v = pointIn(d, anim, frame, () => {
        const eye = grow(eyeBox(d), EYE_MARGIN);
        return marks.map((m) => { a.mark = m; return { eye, t0: { ...careTarget(a, 0, PT) }, t1: { ...careTarget(a, 1, PT) } }; });
      });
      poses.set(key, v);
    }
    return v;
  };
  // (two passes: the first takes only spots that reach; the second, if no mark had one, the spot that overreaches
  // least with the eye clear)
  for (const pass of [0, 1]) {
    let fallback: { x: number; low: boolean; mark: Mark; over: number } | null = null;
    for (let mi = 0; mi < marks.length; mi++) {
      const mark = marks[mi], sample = (anim: string, frame: number): DSample => posed(anim, frame)[mi];
      a.mark = mark;
      const firstWork = plan(false, sample).work;
      if (!handClear(a, firstWork.map((c) => c.s))) continue;
      // kneel for a mark under the standing shoulder by more than a third of the reach (always for one lying down),
      // and try the other posture after
      const lowFirst = lying || d.y - firstWork[0].s.t0.y < (-hipYOf(p) + p.torsoH - 5 - armReach(p) * 0.35) * sc;
      for (const low of lying ? [true] : [lowFirst, !lowFirst]) {
        const { work, around } = plan(low, sample);
        // the near shoulder of each working frame (ground space, scaled), and the spots in order from the ideal one out
        const sh = work.map((c) => { shoulderAt(k, c.anim, c.frame, SH); return { x: SH.x * sc, y: SH.y * sc }; });
        const t0 = work[0].s.t0, vy = t0.y - (standY + sh[0].y);
        const ideal = Math.round(t0.x - face * (sh[0].x + Math.sqrt(Math.max(0, (reach * 0.7) ** 2 - vy * vy))));
        const cands: number[] = [ideal];
        for (let dx = 1; dx <= 40; dx++) cands.push(ideal - face * dx, ideal + face * dx);
        // the checks, one draw each (a reaching one per end of the stroke); the one that last failed goes first,
        // since a spot's neighbours fail the same way
        const draws: { c: Check; t: { x: number; y: number } | null }[] = [];
        for (const c of [...work, ...around]) for (const t of c.reach == null ? [null] : [c.s.t0, c.s.t1]) draws.push({ c, t });
        const quick = draws.filter((q) => q.t);
        let killer = 0, qkiller = 0;
        for (const x of cands) {
          let over = -Infinity;
          work.forEach((c, i) => { for (const t of [c.s.t0, c.s.t1]) over = Math.max(over, Math.hypot(t.x - (x + face * sh[i].x), t.y - (standY + sh[i].y)) - reach); });
          if (pass === 0 ? over > 0 : fallback && over >= fallback.over) continue;
          // the fist alone first, from its joints (cheap: most spots that fail, fail there), then every check drawn
          let clear = true;
          for (let j = 0; j < quick.length && clear; j++) {
            const i = j === 0 ? qkiller : j <= qkiller ? j - 1 : j, { c, t } = quick[i];
            if (dryRun(k, c.anim, c.frame, x, standY, face, ground(t!, x), c.s.eye, c.reach ?? 1, true).cover > 0) { clear = false; qkiller = i; }
          }
          for (let j = 0; j < draws.length && clear; j++) {
            const i = j === 0 ? killer : j <= killer ? j - 1 : j, { c, t } = draws[i];
            if (dryRun(k, c.anim, c.frame, x, standY, face, t && ground(t, x), c.s.eye, c.reach ?? 1).cover > 0) { clear = false; killer = i; }
          }
          if (!clear) continue;
          if (pass === 1) { fallback = { x, low, mark, over }; continue; }
          // (the hand's joint as a tick places it, snapped to the pixel grid)
          let miss = 0;
          for (const c of work) for (const t of [c.s.t0, c.s.t1]) miss = Math.max(miss, dryRun(k, c.anim, c.frame, x, standY, face, ground(t, x), null).miss);
          if (miss <= REACH_OK) { a.standX = x; a.low = low; a.mark = mark; return; }
        }
      }
    }
    if (fallback) { a.standX = fallback.x; a.low = fallback.low; a.mark = fallback.mark; return; }
  }
  a.standX = Math.round(d.x - face * 20); a.low = lying; a.mark = marksFor(a)[0];
}

/**
 * The plans made so far, by keeper, act and look (element, stage, seed: the same dragon), facing and scales: where to
 * stand relative to the dragon, kneeling or not, and the mark (a pet's, a groom's, a tuck-in's), or the bowl's gap (a
 * feed's). A plan is a few dozen ms of dry runs; the yard (yard.ts) makes the same few again and again.
 */
const PLANS = new Map<string, { dx: number; low: boolean; mark: Mark; gap: number }>();
function planKey(a: CareAct): string {
  const { k, d } = a;
  return `${a.kind}:${k.id}:${d.el}:${d.stage}:${d.seed}:${d.facing}:${d.scale}:${k.scale}`;
}

/** A blank act (the fields every kind fills in). */
function act(kind: ActKind, k: KeeperAgent, d: DragonAgent, exitX: number, exitY: number): CareAct {
  return {
    kind, k, d, phase: 'go', t: 0, standX: k.x, standY: k.y, face: 1, staging: 'side', low: false, groom: false,
    mark: { on: 'crown', from: ARC[d.stage][0], to: ARC[d.stage][1] }, bowlAt: 0, bowlX: 0, eatX: d.x, backX: k.x, count: 0, lieEnd: 0, exitX, exitY, via: null, done: false, ownsDragon: true,
  };
}

/**
 * Start a feed: the keeper picks up a full bowl the size of the dragon's (props.ts bowlFor) and sets off. Where the
 * bowl goes is solved first: the stage's gap out from the begging dragon's eating spot, widened 2 px at a time until
 * a dry run of the set-down (every third frame, with the bowl in the hands up to its release) covers none of the
 * begging dragon's eye (K7): a kneeling grown-up keeper is as big as a baby dragon, and a fixed gap put the bowl, the
 * arms or the keeper's head over a baby's face.
 */
export function beginFeed(k: KeeperAgent, d: DragonAgent, exitX: number, exitY = k.y): CareAct {
  const sp = k.rig.spec, p = propsOf(sp), f = d.facing, a = act('feed', k, d, exitX, exitY);
  a.bowlAt = Math.round(p.upperLeg * 0.95);
  a.standY = d.y; a.face = -f; a.low = true; a.staging = 'front';
  k.rig.bowl = { w: d.spot.w, h: d.spot.h, full: true }; k.rig.weapon = TOOL_BOWL;
  const set = k.player.anims.setDown = setDownAnim(sp, a.bowlAt, d.spot.h);
  // (the dragon begs while the bowl comes, its idle variants held off: quiet)
  if (d.player.name !== 'beg') playDragon(d, 'beg', { blend: 10 });
  quiet(d, true);
  const key = planKey(a), known = PLANS.get(key);
  let gap = known ? known.gap : FEED_GAP[d.stage] * d.scale;
  if (!known) {
    const release = set.frames.findIndex((fr) => fr.event === 'release');
    const box = grow(pointIn(d, 'beg', 0, () => eyeBox(d)), 2), held = k.rig.bowl;
    for (let tries = 0; tries < 30; tries++, gap += 2) {
      const standX = bowlScreenX(d) + f * (gap + a.bowlAt * k.scale);
      let hit = false;
      for (let i = 0; i < set.frames.length && !hit; i += 3) {
        k.rig.bowl = i <= release ? held : null;
        hit = coverage(k, 'setDown', i, standX, a.standY, a.face, null, box) > 0;
      }
      if (!hit) break;
    }
    k.rig.bowl = held;
    PLANS.set(key, { dx: 0, low: true, mark: a.mark, gap });
  }
  a.eatX = d.x + f * gap;
  a.bowlX = bowlScreenX(d) + f * gap;
  a.standX = a.bowlX + f * a.bowlAt * k.scale;
  a.backX = a.standX + f * FEED_BACK * k.scale;
  // (on the dragon's own floor line, so the bowl the keeper lowers and the bowl that stands there are one bowl; the
  // scene draws a keeper after a dragon on the same line, and the bowl between them)
  a.via = roundBehind(d, k.x, k.y, a.standX, a.standY);
  k.player.play('carry', { restart: true, blend: 6 });
  return a;
}

/** A dragon about to be petted or tucked in waits in its plain idle (the plan's first pose), its variants held off. */
function holdForCare(d: DragonAgent): void {
  if (d.player.name !== 'idle' && !d.player.inVariant) playDragon(d, 'idle', { blend: 10 });
  quiet(d, true);
}

/** planSide, once per keeper, act and look (PLANS): a plan made before is placed relative to the dragon again. */
function planOnce(a: CareAct, lying: boolean, plan: Parameters<typeof planSide>[1]): void {
  const key = planKey(a), known = PLANS.get(key);
  if (known) {
    a.face = a.d.facing; a.standY = a.d.y + 5; a.staging = 'side';
    a.standX = Math.round(a.d.x) + known.dx; a.low = known.low; a.mark = known.mark;
    return;
  }
  planSide(a, plan, lying);
  PLANS.set(key, { dx: a.standX - Math.round(a.d.x), low: a.low, mark: a.mark, gap: 0 });
}

/** The frames of an anim `every` frames apart in time, from its first to its last. */
function everyFrames(frames: readonly { dur?: number }[], every: number): number[] {
  let len = 0;
  for (const f of frames) len += f.dur || 1;
  const out: number[] = [];
  for (let t = 0; t < len; t += every) { const i = frameAt(frames, t, false); if (!out.includes(i)) out.push(i); }
  return out;
}

/** The hand eased part way onto its mark (reachW), as the reach and the let-go pass through it. */
const EASE_W = [0.25, 0.5, 0.75] as const;

/**
 * Start a pet (for Tomas, a grooming). The plan checks the keeper settling into its pose and easing its hand on while
 * the dragon is idle and as it leans into the hand (its pet loop, at four points), stroking through it, letting go,
 * kneeling and rising beside the idle dragon, and resting beside it (kneeling, or standing watching) through the happy
 * that thanks it.
 */
export function beginPet(k: KeeperAgent, d: DragonAgent, exitX: number, exitY = k.y): CareAct {
  const a = act('pet', k, d, exitX, exitY), pet = d.player.anims.pet?.frames ?? [], happy = d.player.anims.happy?.frames ?? [];
  a.groom = grooms(k);
  holdForCare(d);
  const petF = everyFrames(pet, Math.max(1, Math.round(pet.reduce((n, f) => n + (f.dur || 1), 0) / 4)));
  const happyF = everyFrames(happy, 3), happyIn = everyFrames(happy, 2).slice(0, 6);
  planOnce(a, false, (low, sample) => {
    const work = low ? 'petLow' : 'pet', rest = low ? 'kneelIdle' : 'watch', wf = kFrames(k, work, [0.25, 0.75]);
    const idle = sample('idle', 0), P = petF.map((f) => sample('pet', f)), H = happyF.map((f) => sample('happy', f));
    const checks: Check[] = wf.flatMap((f) => P.map((s) => ({ anim: work, frame: f, s, reach: 1 })));
    const around: Check[] = [
      // resting beside it through its happy, and the let-go's end (the pose's own arm) as the happy begins
      ...kFrames(k, rest, [0, 0.5]).flatMap((f) => H.map((s) => ({ anim: rest, frame: f, s, reach: null }))),
      ...wf.flatMap((f) => happyIn.map((h) => ({ anim: work, frame: f, s: sample('happy', h), reach: null }))),
      // the hand easing on (the dragon idle, then leaning in) and off (at one frame of the keeper's loop: the other
      // leans 3 deg further)
      ...[idle, ...P].flatMap((s) => [null, ...EASE_W].map((w) => ({ anim: work, frame: wf[0], s, reach: w }))),
    ];
    if (low) for (const an of ['kneel', 'rise']) for (const f of kFrames(k, an, [0, 0.33, 0.66, 1])) around.push({ anim: an, frame: f, s: idle, reach: null });
    return { work: checks, around };
  });
  a.via = roundBehind(d, k.x, k.y, a.standX, a.standY);
  k.player.play('walk', { restart: true, blend: 6 });
  return a;
}

/**
 * Start a tuck-in. The dragon lies down as the keeper kneels beside it and is stroked only once it lies still, so the
 * plan checks the keeper's kneel against the lie-down frame by frame, the hand easing on and the stroke against the
 * dragon lying (the end of its lie-down, and on into its tuck-in or its sleep), and the rise and the shh over it
 * asleep.
 */
export function beginTuck(k: KeeperAgent, d: DragonAgent, exitX: number, exitY = k.y): CareAct {
  const a = act('tuck', k, d, exitX, exitY), anim = d.player.has('tuckin') ? 'tuckin' : 'sleep', A = d.player.anims[anim]?.frames ?? [];
  a.lieEnd = d.player.anims.sleep?.loopFrom ?? 0;
  const n = A.length, lyingF = [0, 8, 30, 60].map((i) => Math.min(n - 1, a.lieEnd + i));
  holdForCare(d);
  planOnce(a, true, (_low, sample) => {
    const wf = kFrames(k, 'petLow', [0.25, 0.75]), L = lyingF.map((f) => sample(anim, f));
    const work: Check[] = wf.flatMap((f) => L.map((s) => ({ anim: 'petLow', frame: f, s, reach: 1 })));
    const around: Check[] = L.flatMap((s) => [null, ...EASE_W].map((w) => ({ anim: 'petLow', frame: wf[0], s, reach: w })));
    // the kneel (and then the kneel held) at the same moment as each third frame of the lie-down
    const kn = k.player.anims.kneel?.frames ?? [];
    let kLen = 0, t = 0;
    for (const f of kn) kLen += f.dur || 1;
    for (let i = 0; i < a.lieEnd; i++) {
      if (i % 3 === 0) around.push(t < kLen ? { anim: 'kneel', frame: frameAt(kn, t, false), s: sample(anim, i), reach: null } : { anim: 'kneelIdle', frame: 0, s: sample(anim, i), reach: null });
      t += A[i].dur || 1;
    }
    for (const an of ['kneelIdle', 'rise', 'shh']) for (const f of kFrames(k, an, [0, 0.33, 0.66, 1])) for (const s of L) around.push({ anim: an, frame: f, s, reach: null });
    return { work, around };
  });
  a.via = roundBehind(d, k.x, k.y, a.standX, a.standY);
  k.player.play('walk', { restart: true, blend: 6 });
  return a;
}

function next(a: CareAct, phase: string): void {
  a.phase = phase; a.t = 0;
  if (phase === 'leave') { a.ownsDragon = false; a.via = roundBehind(a.d, a.k.x, a.k.y, a.exitX, a.exitY); }
}

/**
 * Walk a keeper toward (x, y) with `anim` (walk, carry, tiptoe), turning to face the way it goes. Along the floor it is
 * carried by the anim's own root motion (its planted feet hold still); into or out of the scene it moves at the pace
 * that arrives with the walk along the floor (a diagonal), no faster than the walk itself, and once it is there along
 * the floor it walks on the spot (pinX) for whatever depth is left. Returns true on arrival (snapped onto the spot).
 */
export function walkTo(k: KeeperAgent, x: number, y: number, anim: string): boolean {
  const dx = x - k.x, dy = y - k.y;
  if (Math.abs(dx) < 0.75 && Math.abs(dy) < 0.75) { k.x = x; k.y = y; k.pinX = false; return true; }
  k.pinX = Math.abs(dx) < 0.75;
  if (!k.pinX) k.facing = Math.sign(dx);
  if (k.player.name !== anim) k.player.play(anim, { restart: true, blend: 6 });
  const v = (Math.abs(k.player.move) || 0.5) * k.scale;
  if (Math.abs(dy) >= 0.75) {
    const ticks = k.pinX ? 1 : Math.max(1, Math.abs(dx) / v);
    k.y += Math.sign(dy) * Math.min(Math.abs(dy), v, Math.max(Math.abs(dy) / ticks, 0.25));
  }
  return false;
}

/** Keep a walker from overshooting its spot (the anim's root motion moves it by `move` along facing each tick). */
function clampTo(k: KeeperAgent, x: number, x0: number): void {
  if ((x - x0) * (x - k.x) < 0) k.x = x;
}

/** How far behind a dragon's floor line a keeper walks round it, px. */
const ROUND_BEHIND = 26;

/**
 * The way round a dragon: if a keeper's straight walk from (sx, sy) to (tx, ty) would cross the floor the dragon takes
 * up (bodySpan: walking through a baby, it walked over it), a point behind the dragon's middle to go by (drawn behind
 * it there, the dragon hides the keeper's feet as it passes); else null.
 */
function roundBehind(d: DragonAgent, sx: number, sy: number, tx: number, ty: number): { x: number; y: number } | null {
  const b = bodySpan(d);
  // (the segment against the box, Liang-Barsky)
  let t0 = 0, t1 = 1;
  const dx = tx - sx, dy = ty - sy;
  for (const [p, q] of [[-dx, sx - b.x0], [dx, b.x1 - sx], [-dy, sy - b.y0], [dy, b.y1 - sy]] as const) {
    if (p === 0) { if (q < 0) return null; continue; }
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r); else t1 = Math.min(t1, r);
    if (t0 > t1) return null;
  }
  return { x: Math.round(d.x), y: Math.round(b.y0 - ROUND_BEHIND * d.scale) };
}

/** Walk a keeper to (x, y), by the act's way round first if it has one; true on arrival. */
function walkLeg(a: CareAct, x: number, y: number, anim: string): boolean {
  const k = a.k;
  if (a.via) {
    const x0 = k.x, v = a.via;
    if (walkTo(k, v.x, v.y, anim)) a.via = null;
    stepKeeperAgent(k); clampTo(k, v.x, x0);
    return false;
  }
  const x0 = k.x, there = walkTo(k, x, y, anim);
  if (!there) { stepKeeperAgent(k); clampTo(k, x, x0); }
  return there;
}

/** The stroke's target this tick, in the keeper's ground space; the hand lifts a pixel on its way back. */
function strokeTarget(a: CareAct, period: number): HandT {
  careTarget(a, petStroke(a.t, period, 1).x, PT);
  const g = toGround(a.k, PT.x, PT.y);
  if (a.t % period >= period * 0.6) g.y -= 1;
  return g;
}

/** Is the dragon done lying down (a tuck-in's lie-down: its sleep or tuck-in anim past the lie-down's frames)? */
function lyingDown(a: CareAct): boolean { return a.d.player.frameIndex >= a.lieEnd && a.d.player.time > 0; }

/**
 * One tick of an act: its phase machine, then the keeper and the dragon it owns (the dragon holds its place, but for
 * the feed's walk up to its bowl and its trot off).
 */
export function stepAct(a: CareAct): void {
  const { k, d } = a, sp = k.rig.spec;
  // the events the keeper's anim raised on the last tick (release, grab), taken before this tick raises more
  const evs = k.player.events.slice();
  k.player.events.length = 0;
  let roam = false;
  a.t++;
  switch (a.phase) {
    case 'go':
    case 'return': {
      if (walkLeg(a, a.standX, a.standY, a.kind === 'feed' && a.phase === 'go' ? 'carry' : 'walk')) {
        k.facing = a.face;
        if (a.kind === 'feed' && a.phase === 'go') { k.player.play('hold', { restart: true, blend: 8 }); next(a, 'settle'); }
        else if (a.kind === 'feed') {
          k.player.anims.pickUp = setDownAnim(sp, a.bowlAt, d.spot.h, true);
          k.player.play('pickUp', { restart: true, blend: 8 }); next(a, 'collect');
        } else {
          // a tuck-in: the dragon lies down while the keeper kneels beside it
          // (from its first frame: a loop played at the pet's phase starts inside its loop part, asleep already, and
          // skipped the lie-down, and dusk's whole tuck-in with it)
          if (a.kind === 'tuck') playDragon(d, d.player.has('tuckin') ? 'tuckin' : 'sleep', { blend: 10, phase: 0 });
          if (a.low) { k.player.play('kneel', { restart: true, blend: 8 }); next(a, 'kneel'); }
          else { k.player.play('pet', { restart: true, blend: SETTLE }); next(a, 'reach'); }
        }
        stepKeeperAgent(k);
      }
      break;
    }
    // ---- feed ----
    case 'settle':
      // a beat with the bowl held out, then kneel to set it down (the set-down anim was built for this bowl)
      if (a.t >= 10) { k.player.play('setDown', { restart: true, blend: 6 }); next(a, 'set'); }
      stepKeeperAgent(k);
      break;
    case 'set':
      for (const e of evs) if (e.name === 'release') { d.bowl = { full: true, x: a.bowlX }; k.rig.bowl = null; k.rig.weapon = sp.tool === 'brush' ? TOOL_BRUSH : null; }
      if (k.player.done) { k.facing = -a.face; next(a, 'back'); }
      stepKeeperAgent(k);
      break;
    case 'back': {
      const x0 = k.x;
      if (walkTo(k, a.backX, a.standY, 'walk')) {
        k.facing = a.face; k.player.play('watch', { restart: true, blend: 10 });
        playDragon(d, 'walk', { blend: 8 }); next(a, 'approach');
      }
      stepKeeperAgent(k); clampTo(k, a.backX, x0);
      break;
    }
    case 'approach':
      // the dragon walks up to its bowl, and stops on its eating spot
      roam = true;
      if ((a.eatX - d.x) * d.facing <= Math.abs(d.player.move) * d.scale + 0.01) {
        d.x = a.eatX; roam = false; playDragon(d, 'eat', { blend: 8 }); a.count = 0; next(a, 'eat');
      }
      stepKeeperAgent(k);
      break;
    case 'eat':
      if (d.player.done && d.player.name === 'eat') {
        a.count++;
        if (a.count < FEED_BITES) playDragon(d, 'eat', { blend: 4 });
        else { if (d.bowl) d.bowl.full = false; playDragon(d, 'happy', { blend: 8 }); d.mood = clamp(d.mood + 0.5, -1, 1); next(a, 'happy'); }
      }
      stepKeeperAgent(k);
      break;
    case 'happy':
      if (a.t === 12) k.player.play('cheer', { restart: true, blend: 6 });
      if (k.player.done && k.player.name === 'cheer') k.player.play('watch', { restart: true, blend: 10 });
      // (fed and happy, the dragon turns and trots off before the keeper comes for the bowl: kneeling at a bowl with
      // the dragon still over it, the keeper covered its face)
      if (d.player.name !== 'happy' && a.t > 30 && k.player.name !== 'cheer') { turnDragon(d); next(a, 'trot'); }
      stepKeeperAgent(k);
      break;
    case 'trot':
      if (d.turning < 0) {
        if (d.player.name !== 'walk') { playDragon(d, 'walk', { blend: 6 }); a.count = 0; }
        roam = true; a.count += Math.abs(d.player.move) * d.scale;
        if (a.count >= FEED_TROT) { roam = false; playDragon(d, 'idle', { blend: 10 }); next(a, 'return'); }
      }
      stepKeeperAgent(k);
      break;
    case 'collect':
      for (const e of evs) if (e.name === 'grab') { d.bowl = null; k.rig.bowl = { w: d.spot.w, h: d.spot.h, full: false }; k.rig.weapon = TOOL_BOWL; }
      if (k.player.done) { k.facing = -a.face; next(a, 'leave'); }
      stepKeeperAgent(k);
      break;
    // ---- pet, groom and tuck-in ----
    case 'kneel':
      // (a tuck-in reaches only once the dragon has lain down: its head sweeping down past a waiting hand crossed its eye)
      if (k.player.done && k.player.name === 'kneel') k.player.play('kneelIdle', { restart: true, blend: 8 });
      if (k.player.name === 'kneelIdle' && (a.kind !== 'tuck' || lyingDown(a))) { k.player.play('petLow', { restart: true, blend: SETTLE }); next(a, 'reach'); }
      stepKeeperAgent(k);
      break;
    case 'reach':
      // the keeper settles into its pose (the anim's blend), then the hand eases onto its mark; a pet's dragon starts
      // its pet loop as the hand lands
      if (a.t === SETTLE + 6 && a.kind === 'pet') playDragon(d, 'pet', { blend: 10 });
      k.reachW = clamp((a.t - SETTLE) / 12, 0, 1);
      k.reach = strokeTarget(a, a.kind === 'tuck' ? STROKE_TUCK : STROKE);
      if (a.t >= SETTLE + 12) { a.count = 0; next(a, 'stroke'); }
      stepKeeperAgent(k);
      break;
    case 'stroke': {
      const period = a.kind === 'tuck' ? STROKE_TUCK : STROKE;
      k.reach = strokeTarget(a, period);
      // a pet counts its strokes; a tuck-in strokes on until the dragon is asleep and counts the ones after that
      if (a.t % period === 0 && (a.kind !== 'tuck' || d.player.pose.sleep >= 0.5)) a.count++;
      if (a.count >= (a.kind === 'tuck' ? TUCK_STROKES : PET_STROKES)) next(a, 'let');
      stepKeeperAgent(k);
      break;
    }
    case 'let':
      k.reachW = clamp(1 - a.t / 10, 0, 1);
      k.reach = strokeTarget(a, a.kind === 'tuck' ? STROKE_TUCK : STROKE);
      if (a.t >= 10) {
        k.reach = null; k.reachW = 0;
        if (a.kind === 'pet') {
          // the hand off it, the dragon thanks the keeper (its happy), the keeper resting beside it and watching
          playDragon(d, 'happy', { blend: 8 }); d.mood = clamp(d.mood + 0.4, -1, 1);
          k.player.play(a.low ? 'kneelIdle' : 'watch', { restart: true, blend: 10 }); next(a, 'watch');
        } else { k.player.play('rise', { restart: true, blend: 8 }); next(a, 'rise'); }
      }
      stepKeeperAgent(k);
      break;
    case 'watch':
      // until the happy is over, then up off its knees and away
      if (a.t >= 20 && d.player.name !== 'happy') {
        if (a.low) { k.player.play('rise', { restart: true, blend: 8 }); next(a, 'rise'); }
        else { k.facing = -a.face; next(a, 'leave'); }
      }
      stepKeeperAgent(k);
      break;
    case 'rise':
      if (k.player.done) {
        if (a.kind === 'tuck') { k.player.play('shh', { restart: true, blend: 8 }); next(a, 'shh'); }
        else { k.facing = -a.face; next(a, 'leave'); }
      }
      stepKeeperAgent(k);
      break;
    case 'shh':
      if (k.player.done) { k.facing = -a.face; next(a, 'leave'); }
      stepKeeperAgent(k);
      break;
    case 'leave': {
      // (off on tiptoe from a sleeping dragon, for the first TIPTOE px, then an ordinary walk)
      const anim = a.kind === 'feed' ? 'carry' : a.kind === 'tuck' && Math.abs(k.x - a.standX) < TIPTOE * k.scale ? 'tiptoe' : 'walk';
      if (walkLeg(a, a.exitX, a.exitY, anim)) {
        k.player.play(a.kind === 'feed' ? 'hold' : 'idle', { restart: true, blend: 8 });
        a.done = true;
        quiet(d, false);
        stepKeeperAgent(k);
      }
      break;
    }
  }
  if (a.ownsDragon) stepDragonAgent(d, roam);
}
