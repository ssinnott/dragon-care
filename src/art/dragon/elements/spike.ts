// SPIKE: "Bramble", the bramble dragon (docs/ART_BIBLE.md 3.3). Zone: the back line, nape -> tail. Cue: a comb of
// pale bone quills, which lean with its mood; bristling is a separate alarm (pose.bristle).
//
// Everything that moves the comb is drawn by backRow, from the pose and the rig's clock (no state kept):
//   - the MOOD lean and length (D7: 30 deg at x 0.8 / 28 / 15 deg, babies' lean at half), the back's measured from
//     the WORLD's upright (the body's pitch leaned out), never drooping past 64 % of the upright height; quills
//     drooping past 30 deg (the beg's growl) are thorns (quill());
//   - the idle AMBIENT, the quill ripple (each quill 15 deg toward upright in turn, rump -> neck, each wave
//     240 +- 60 f after the last, seeded, at mood >= 0); the happy flourish runs it twice, and each pet loop once;
//   - the BRISTLE alarm (upright, x 1.15, a 1 px tremble every 4 f), and the breath's wind-up (upright only);
//   - the volley: each back quill leaves the comb as its flight comes out from behind the head, and regrows over
//     30 f; the baby's rump nub pops off, bonks it on the head and hops back into its socket (breath);
//   - the WARY lean (15 deg toward upright, no size-up): in the creep's stop-and-look, and awake whenever another
//     dragon is near (info.wary: the owner latches it under 30 px and eases it over 8 f), the beg's sag on each
//     growl, the grooming fidget's pecked quills, and asleep the long low LEVEL comb (COMB sleepBack / sleepTail),
//     20 deg back from the world's upright, settling on each exhale.
import { DRAGON_PALETTES } from '../palettes.ts';
import type { DragonPalette } from '../palettes.ts';
import { TAIL_REST, FIDGET_TIMING } from '../stages.ts';
import type { Stage } from '../stages.ts';
import { hornParams, wingParams } from '../element.ts';
import type { ElementSpec, ElementDraw } from '../element.ts';
import { backLineY, mouthToRoot, pixelStroke } from '../features.ts';
import { enterFaceFromLocal } from '../rig.ts';
import type { DragonRig } from '../rig.ts';
import { ACT, DFACE } from '../pose.ts';
import { bake, breathAnim, walkAnim } from '../anims.ts';
import type { Key, Track, Tracks } from '../anims.ts';
import type { DragonAnim, DragonFrame } from '../anim.ts';
import type { DragonDims } from '../build.ts';
import { animTuning } from '../tuning.ts';
import { liveSpawns } from '../fx.ts';
import { outlinePath, tones } from '../../../lib/art/shading.ts';
import { flat } from '../../../lib/art/shading.ts';

const PAL = DRAGON_PALETTES.spike;

/**
 * The comb per stage (3.3 table): back quills as [x fraction rump -> neck base, height, base], then tail quills [t,
 * height, base]. Bases are wide (young 6, adult 8): the comb is ONE silhouette, and at 5-6 px a leaning quill left
 * 1-2 px of bone between two ink edges, read as a grey scribble. Baby nubs: body-space x of the rump and loin nubs
 * (rump first, like the others' rump -> neck order), 6 px apart centre to centre, then the tail nub's t (60 % along
 * the baby's short tail, clear of the rump nub). Each is 6 tall (the tail's 5) on a base of 5, its point rounded
 * 1 px: the 4 x 4 blunt nubs never covered half of a 3 x 3 cell and were gone at /3 in every block, the baby a blob
 * with a tail stub beside baby rock and baby water (5.1 #1, the cast review). The young's are [7, 10, 8] rump ->
 * neck: at [6, 9, 7] its /3 saw was 1 px nicks even at rest.
 * ASLEEP the comb is LEVEL (sleepBack / sleepTail, eased in and out with the lean): the adult's tall and short by
 * turns, the tall three 11 px apart, tallest at the rump where the back line is lowest, so their tips run flat from
 * nape to rump and read as a crown of 3 teeth at /3; the young's graded against its back line the same way. With the
 * awake heights (peaking mid-back) the sleeper was a crest of 1 px nicks on a mound, rock's closest pair (the cast
 * review, round 2).
 */
interface Comb {
  back: readonly (readonly number[])[];
  tail: readonly (readonly number[])[];
  /** Asleep, the heights of the back quills and of the tail quills (the same order): a LEVEL comb (backRow). */
  sleepBack: readonly number[];
  sleepTail: readonly number[];
  blunt: boolean;
}
const COMB: Readonly<Record<Stage, Comb>> = {
  // babies: 3 soft nubs on the rump, loin and tail root (the big head hides the front 60 % of the back)
  baby: { back: [[-7.75, 6, 5], [-2, 6, 5]], tail: [[0.6, 5, 5]], sleepBack: [6, 6], sleepTail: [5], blunt: true },
  young: { back: [[0.04, 7, 6], [0.48, 10, 6], [0.92, 8, 6]], tail: [[0.22, 5, 5]], sleepBack: [8, 7, 6], sleepTail: [6], blunt: false },
  // the bible lists the back quills neck base -> rump, [7, 11, 12, 10, 7]; this list runs rump (0) -> neck base (1)
  adult: {
    back: [[0.0, 7, 8], [0.25, 10, 8], [0.5, 12, 8], [0.75, 11, 8], [1.0, 7, 8]], tail: [[0.14, 6, 6], [0.32, 5, 5], [0.5, 4, 4]],
    sleepBack: [12, 5, 11, 5, 10], sleepTail: [7, 6, 5], blunt: false,
  },
  // FIRST PASS (elder): the adult's comb, unworn (3.3: the elder keeps the adult's comb exactly). Its elder-only
  // extra, the SAP-BUDS (two 3 x 3 glow.sh buds, inked, between the rump quill and its neighbour and between the
  // first two tail quills, with a 2 x 2 glow glint at mood >= 0.5), and v2's spikier comb (D26) are spike's own pass
  elder: {
    back: [[0.0, 7, 8], [0.25, 10, 8], [0.5, 12, 8], [0.75, 11, 8], [1.0, 7, 8]], tail: [[0.14, 6, 6], [0.32, 5, 5], [0.5, 4, 4]],
    sleepBack: [12, 5, 11, 5, 10], sleepTail: [7, 6, 5], blunt: false,
  },
};

/**
 * Append one quill to the current path: base centred at (bx, by), `h` tall along the unit normal (nx, ny), leaning
 * `lean` deg toward (tx, ty), its tip nudged `jit` px along (tx, ty) (the bristle's tremble). A blunt nub rounds its
 * point off by 1 px (a soft nub, not a thorn).
 * A drooping quill is a THORN: its tail-side base corner runs back with the tip, by up to half the tip's lean (h sin
 * lean / 2, eased in from 30 deg to full at 50), so its back face stays steep and the bone as wide as the tip is far
 * back. Sheared at a fixed base, a quill at the 39-50 deg droop was a sliver with 1-2 px of bone between two ink
 * edges, the comb hatching, "//////"; widened at the 28 deg rest too, its notches filled and the saw was a smooth
 * hump at /3. (A rigid turn about the root raises the head-side corner out of the contour, and the tail quills lie
 * OVER the tail, so nothing there can sink a root.)
 */
function quill(ctx: CanvasRenderingContext2D, bx: number, by: number, nx: number, ny: number, tx: number, ty: number,
  h: number, base: number, lean: number, blunt: boolean, jit: number): void {
  const a = lean * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const ux = nx * c + tx * s, uy = ny * c + ty * s;       // quill axis
  const k = 0.5 * Math.min(1, Math.max(0, (lean - 30) / 20));
  const hb = base / 2, tb = hb + k * h * s, px = bx + ux * h + tx * jit, py = by + uy * h + ty * jit;
  ctx.moveTo(bx - tx * hb, by - ty * hb);                 // base, toward the head
  if (blunt) ctx.arcTo(px, py, bx + tx * tb, by + ty * tb, 1);   // a soft nub's tip, rounded 1 px
  else ctx.lineTo(px, py);                                // tip
  ctx.lineTo(bx + tx * tb, by + ty * tb);                 // base, toward the tail
  ctx.closePath();
}

/**
 * The quill lean at `mood` (3.3, D7): 28 deg back at rest, 15 at +1 (perky); babies at half the range (25 at -1).
 * The young and adult droop to only 30 at -1 and take the rest of the droop in LENGTH (lenOf: quills x 0.8, bases
 * too, so the comb keeps 0.8 cos 30 = 69 % of its upright height, over the gauge's 60 % floor): each tip overhangs
 * the notch behind it by 0.4 of its height. Leaning 50 deg (the adult) or 36 (the young), a tip overhung by h sin(lean),
 * 9.2 and 5.3 px, about the gap between quills (adult 5.5, young 7.3), and lay over the notch behind it: at /3 the
 * young's back was flat with one step and the adult's a flat-topped box (5.1 #1, the cast reviews: identity must
 * never depend on the dragon being happy, D7). At x 0.74 the young's teeth stood 4 px and phase 2 kept two nicks.
 * At the old 35 deg rest a young quill's saw was down to 2 px bumps at /3. Bristle snaps them upright and full
 * length, the only fully upright state.
 */
const DROOP_LEAN = 30, DROOP_LEN = 0.8, GAUGE = Math.cos(50 * Math.PI / 180);
function leanOf(st: Stage, m: number): number {
  return st === 'baby' ? 14 + (m < 0 ? -11 * m : -7 * m) : 28 + (m < 0 ? -(DROOP_LEAN - 28) * m : -13 * m);
}
/** The quills' length factor at `mood`: 1 from 0 up, DROOP_LEN at -1 (young and adult; the baby's nubs lean only). */
function lenOf(st: Stage, m: number): number {
  return st === 'baby' || m >= 0 ? 1 : 1 + (1 - DROOP_LEN) * m;
}
/**
 * Asleep, the comb leans this far back from the WORLD's upright (backRow): the sleeper lies long and low and its
 * comb runs nape -> tail at a slant, each tip clear of the next. World-upright in a curled ball, the quills packed
 * 4 px apart on a round mound and the asleep young and adult spike were rock's dome with points at /3 (5.1 #1).
 */
const SLEEP_LEAN = 20;

/** A trapezoid envelope: 0 up to a, rising to 1 at b, held to c, back to 0 at d. */
function env(t: number, a: number, b: number, c: number, d: number): number {
  return t <= a || t >= d ? 0 : t < b ? (t - a) / (b - a) : t <= c ? 1 : (d - t) / (d - c);
}

/**
 * The quill ripple (3.3 Ambient, 4.3 happy): each quill leans RIPPLE_DEG toward upright (babies 0.6 x: a 15 deg
 * turn of a 4 px nub moves nothing, so theirs also stand 1 px taller at the peak, as every quill does), RIPPLE_GAP f
 * after the one behind it, over RIPPLE_LEN f. Never quite upright (RIPPLE_FLOOR): upright is the alarm's alone.
 */
const RIPPLE_DEG = 15, RIPPLE_GAP = 4, RIPPLE_LEN = 10, RIPPLE_FLOOR = 4;
/** How far quill number `o` of the wave (0 = the outermost tail quill; rump -> neck) is through its lean, 0..1. */
function rippleBump(age: number, o: number): number {
  const u = (age - RIPPLE_GAP * o) / RIPPLE_LEN;
  return u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * u);
}
const RIP_AGES = new Float32Array(2), RIP_IDS = new Int32Array(2);
/**
 * The idle ripple's age at this tick (-1 = none): one wave 240 +- 60 f after the last, seeded per pet (fx.ts
 * liveSpawns, so a frozen frame is reproducible), stretched 1.5 x with more than 4 dragons on screen like every
 * ambient (5.4). Each wave is jittered +- 30 f about its 240 f slot, so the GAP between two runs 180-300 f (jittered
 * +- 60, the gaps ran 120-360).
 */
function idleWave(rig: DragonRig, seed: number, tick: number, n: number): number {
  const k = liveSpawns(seed * 31 + 7, tick, 240 * rig.budget.stretch, 30, RIPPLE_GAP * (n - 1) + RIPPLE_LEN, RIP_AGES, RIP_IDS);
  return k ? RIP_AGES[0] : -1;
}

/**
 * The fidget's stage duration factor (fidget(): the adult's 44 f x 1 / 0.85 / 0.6, the elder's x 1.3: FIDGET_TIMING,
 * 4.2). The elder's 0.8x amplitude takes the body's lean only: the arched neck and the look back put the snout on the
 * comb, a reach the grooming needs.
 */
const fidK = (st: Stage): number => FIDGET_TIMING[st].dur;
/** The grooming pecks' period, frames (adult 4; x the stage factor, never under 3). */
const peckP = (st: Stage): number => Math.max(3, Math.round(4 * fidK(st)));
/**
 * Where the grooming snout is at fidget clock `c` (fidget() keys the same beat): +1 dipped into the comb (the first
 * half of each peck), -1 drawn back, 0 outside the grooming (adult f 10-30).
 */
function peckAt(st: Stage, c: number): number {
  const k = fidK(st), a = Math.round(10 * k), b = Math.round(30 * k);
  if (c < a || c >= b) return 0;
  return Math.floor(2 * (c - a) / peckP(st)) % 2 ? -1 : 1;
}
/** The creep's stop-and-look, frames (4.3: 24 f, x the stage's 0.85 young, 0.6 baby), clocked on past the cycle. */
const STOP: Readonly<Record<Stage, number>> = { baby: 14, young: 20, adult: 24, elder: 30 };

/**
 * Back quill i's height factor through the breath (3.3 Quill Volley): the front quill fires first, at the snap
 * (cue 0), each one behind it 1 f later, and every fired quill regrows from nothing over 30 f. Each leaves the comb
 * HIDDEN f after it fires, as its flight (volleyAt) comes out from behind the neck and head: gone from the snap,
 * the whole comb vanished at once, and gone at its own fire frame, the back was bare for 4 f with nothing in the
 * air yet. The baby's popped rump nub (breath) is gone from the pop until it lands back in its socket.
 */
const HIDDEN = 5;
function regrowOf(baby: boolean, breathing: boolean, c: number, i: number, nb: number): number {
  if (!breathing || c < 0) return 1;
  if (baby) return i === 0 && c < HOME ? 0 : 1;
  const f = nb - 1 - i + HIDDEN;                             // it stands until then
  return c < f ? 1 : Math.min(1, (c - f) / 30);
}

/**
 * A quill grown to `g` of its height `h`: its base shrinks with it (full from 2/3 up, never under the 4 px floor of
 * 5.2), and one under 3 px is not drawn at all. At full base, the first frames of a regrowing adult quill were an
 * 8 px base with 1-2 px showing, crumbs of ink along the back line. Returns the base, or 0 = not drawn.
 */
function grownBase(h: number, base: number, g: number): number {
  if (g >= 1) return base;
  return h < 3 ? 0 : Math.max(Math.min(4, base), base * Math.min(1, 1.5 * g));
}

/**
 * Bible 3.3 "The cue: the comb back". Body space, before the body (its contour hides the roots). The whole comb,
 * back and tail quills, is ONE path stroked once and filled once in plain `horn` (the drawLimbSegs lesson):
 * overlapping neighbours share one outer ink line, where a celPoly per quill crossed each one's ink over its
 * neighbour's and left grey scribbles. The lean of each quill is the header's list, summed here.
 */
const backRow: ElementDraw = (ctx, rig, pose, info) => {
  const st = info.stage, comb = COMB[st], d = rig.dims, J = rig.j, c = pose.cue;
  const baby = st === 'baby', breathing = pose.act === ACT.breath, k = baby ? 0.5 : 1;
  const nb = comb.back.length, nt = comb.tail.length;
  let floor = RIPPLE_FLOOR, wave = -1, wave2 = -1, peck = 0, jit = false, zs = 0;
  // the mood lean
  let lean = leanOf(st, info.mood), len = lenOf(st, info.mood);
  // the hungry tell's sigh: on each stomach growl (f 80-88 of the beg loop) the drooping quills sag 8 deg further
  if (pose.act === ACT.beg) lean += 8 * k * env(c, 76, 82, 90, 100);
  // wary, 15 deg toward upright: the creep's stop-and-look (creepWalk keys the walk's clock on past its cycle), and
  // awake near another dragon (info.wary, 4.3), whichever is more
  const C = Math.round(rig.tune.walk.cycle), stop = pose.act === ACT.walk && c >= C ? env(c - C, 0, 4, STOP[st] - 5, STOP[st]) : 0;
  if (!info.asleep) lean -= 15 * k * Math.max(stop, info.wary);
  // The back's lean is measured from the WORLD's upright (the body's pitch leaned back out: the beg sits 14 deg nose
  // up, and measured from the body its 39-47 deg droop stuck out flat behind like twigs); the tail quills lean from
  // their own segment. Either way the droop never passes the mood gauge's 60 % floor (D7): lean and length together
  // keep GAUGE of the upright height (at full length 50 deg, at -1's x 0.74 about 30), a baby's lean 25. The breath's
  // wind-up snaps them upright and full length on `bristle` (upright on the BODY: the alarm), without the alarm's
  // size-up (grow, below).
  const cap = baby ? 25 : Math.acos(Math.min(1, GAUGE / len)) * 180 / Math.PI, up = 1 - pose.bristle;
  let tail = Math.min(cap, lean) * up;
  lean = Math.min(cap, lean + info.ang) * up;
  len = 1 - (1 - len) * up;
  if (info.asleep) {
    // asleep (4.3) the comb leans SLEEP_LEAN back from the WORLD's upright (the body's pitch leaned back out), with
    // no size-up or tremble, so it reads as a resting comb and not an alarm, and settles 5 deg further back on each
    // exhale (the sleep clock: 0 = inhale, the peak at half the breath). The lie-down eases the comb into it over
    // the 10 f after `sleep` switches on (its f 24 of 40, on the clock that counts up to the loop): it snapped
    const B = rig.tune.sleep.breath, s = pose.act === ACT.sleep && c >= 0 ? 0.5 - 0.5 * Math.cos(2 * Math.PI * c / B) : 1;
    const Ld = rig.tune.sleep.lieDown, u = pose.act === ACT.sleep && c < 0 ? Math.min(1, Math.max(0, (c - Math.round(0.6 * Ld) + Ld) / 10)) : 1;
    const z = info.ang + SLEEP_LEAN + 5 * (1 - s);
    lean += (z - lean) * u; tail += (z - tail) * u; len += (1 - len) * u; zs = u; floor = -90;
  } else {
    // waking, the comb eases back to the mood lean over 16 f (it snapped as the eyes opened)
    if (pose.act === ACT.wake) {
      const w = Math.min(1, Math.max(0, c / 16)), z = info.ang + SLEEP_LEAN;
      lean = z + (lean - z) * w; tail = z + (tail - z) * w; len = 1 + (len - 1) * w; zs = 1 - w;
    }
    if (pose.bristle > 0.01) floor = 0;
    jit = pose.bristle > 0.5 && !breathing;
    // the happy flourish: the ripple from cue 0 and again 20 f on (the adult's preening wings, spread over f 14-30,
    // hide the first wave's back quills; the second runs as they fold and ends with the anim), then the perky
    // 15 deg of the happy mood
    if (pose.act === ACT.happy) { wave = c; wave2 = c - 20; }
    else if (pose.act === ACT.pet) wave = c;
    else if (pose.act === ACT.fidget) peck = peckAt(st, c);
    else if ((pose.act === ACT.none || pose.act === ACT.variant) && info.mood >= 0 && pose.bristle < 0.01) {
      wave = idleWave(rig, info.seed, info.tick, nb + nt);
    }
  }
  const grow = (info.asleep || breathing ? 1 : 1 + 0.15 * pose.bristle), vary = info.sp.lenVar || 0;
  const tq = Math.floor(info.tick / 4);
  const x0 = rig.hipB.x - d.hipR * 0.35, x1 = rig.chestB.x + d.chestR * 0.05;
  ctx.beginPath();
  for (let i = 0; i < nb; i++) {
    const q = comb.back[i], o = nt + i;
    const g = regrowOf(baby, breathing, c, i, nb), h = (q[1] + (comb.sleepBack[i] - q[1]) * zs + vary) * grow * g * len, w = grownBase(h, q[2] * len, g);
    if (!w) continue;                                          // fired: nothing shows over the contour yet
    const x = baby ? q[0] * (d.hipR / 6.5) : x0 + (x1 - x0) * q[0];
    const y = backLineY(rig, x) + 1.5;
    const b = Math.max(rippleBump(wave, o), rippleBump(wave2, o));
    let l = lean - RIPPLE_DEG * (baby ? 0.6 : 1) * b;
    // grooming: the snout works the front two quills (the head hides the neck-base one), each peck pushing one
    // back and letting the other spring up
    if (peck && i >= nb - 2) l += 8 * peck * (i === nb - 1 ? 1 : -1);
    quill(ctx, x, y, 0, -1, -1, 0, h + 1.5 + b, w, Math.max(floor, l), comb.blunt, jit ? ((tq + o) & 1 ? 0.5 : -0.5) : 0);
  }
  // quills carry on along the TOP of the tail, shrinking toward the tip (the tip itself is a plain taper: D5)
  const tn = J.tailN;
  for (let i = 0; i < comb.tail.length; i++) {
    const q = comb.tail[i], o = nt - 1 - i;
    const f = q[0] * tn, kk = Math.min(tn - 1, Math.floor(f)), u = f - kk;
    const bx = J.tailBX[kk] + (J.tailBX[kk + 1] - J.tailBX[kk]) * u, by = J.tailBY[kk] + (J.tailBY[kk + 1] - J.tailBY[kk]) * u;
    let dx = J.tailBX[kk + 1] - J.tailBX[kk], dy = J.tailBY[kk + 1] - J.tailBY[kk];
    const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    const nx = -dy, ny = dx;                                   // dorsal side of a tail pointing away from the body
    // a tail curled under the body (the quill ball asleep) turns its dorsal side to the floor: a quill there lies
    // pressed flat under it, so only quills whose side faces well up (in root space, the body's pitch included)
    // stand, from 37 deg above level, grown in by 53: from 14 deg the first quill of a tail hanging from the rump
    // (the young's ball, the lie-down, the wake) stuck straight back out of it, a lone stinger
    const upw = -(nx * Math.sin(info.ang * Math.PI / 180) + ny * Math.cos(info.ang * Math.PI / 180));
    const g = Math.min(1, Math.max(0, (upw - 0.6) / 0.2)), hq = q[1] + (comb.sleepTail[i] - q[1]) * zs, h = hq * grow * g * len, w = grownBase(h, q[2] * len * Math.max(1, hq / q[1]), g);
    if (!w) continue;
    const r = J.tailR[kk] + (J.tailR[kk + 1] - J.tailR[kk]) * u;
    const b = Math.max(rippleBump(wave, o), rippleBump(wave2, o));
    const l = Math.max(floor, tail - RIPPLE_DEG * (baby ? 0.6 : 1) * b);
    quill(ctx, bx + nx * (r - 1), by + ny * (r - 1), nx, ny, dx, dy, h + 1 + b, w, l, comb.blunt, jit ? ((tq + o) & 1 ? 0.5 : -0.5) : 0);
  }
  flat(ctx, rig, info.pal.horn);
  if (breathing && c >= 0 && !baby && !rig.override) drawVolley(ctx, rig, c, nb, info.pal);
};

/** Scratch for the volley and the baby's nub. */
const QV = { x: 0, y: 0 };
/** Frames a fired quill flies before it pops, and how long its sparkle shows. */
const FLY = 20, POP = 6;
const rad = (d: number): number => d * Math.PI / 180;

/** Body space -> root space (unsnapped), into `out`. */
function bodyToRoot(rig: DragonRig, bx: number, by: number, out: { x: number; y: number }): void {
  const J = rig.j, c = Math.cos(rad(J.bodyAng)), s = Math.sin(rad(J.bodyAng));
  out.x = J.body.x + bx * c - by * s; out.y = J.body.y + bx * s + by * c;
}

/**
 * Quill k of n of a volley `age` frames after ITS launch, root space (into QV): every quill leaves the neck base
 * (the front of the comb, each 2 px further back so they do not stack at launch) and flies toward the facing side
 * in a FAN, the first launched the most forward (20 deg above level) and the last the steepest (60 deg), 3 px/f
 * under a light gravity: clear of the head in ~7 f and ~55 px out along its line in its 20 f, so the fan opens in
 * front of and above the head (at 2 px/f they spent most of their flight behind it).
 * Launched straight up first (85 -> 40 deg, 2 f apart) the five stood in one column behind the head at every
 * instant and read as a crest or a feather duster (3.3, 5.4: breath points away from its own body); launched each
 * from its own place on the back, they flew as a row of parallel quills over the back and head, a crest again.
 */
function volleyAt(rig: DragonRig, k: number, n: number, age: number): void {
  const f = n > 1 ? k / (n - 1) : 0.5;
  const bx = rig.chestB.x + rig.dims.chestR * 0.05 - 2 * k;
  bodyToRoot(rig, bx, backLineY(rig, bx) + 1, QV);
  const a = rad(20 + 40 * f), v = 3;
  QV.x += Math.cos(a) * v * age;
  QV.y = Math.min(-2, QV.y - Math.sin(a) * v * age + 0.015 * age * age);
}

/**
 * One sap sparkle (3.3): a 2 x 2 `hex` centre ringed in `scale` on its four sides only, corners cut (a full 4 x 4 box
 * round a pale centre read as a hollow square), in whole pixels at root point (x, y). The context must be in ROOT
 * space. Fired quills pop into one, the baby's nub pops off its rump in one, and its sneeze sprays three.
 */
function sparkle(ctx: CanvasRenderingContext2D, rig: DragonRig, x: number, y: number, hex: string, pal: Readonly<DragonPalette>): void {
  enterFaceFromLocal(ctx, rig, 0, 0, 0, Math.round(x), Math.round(y));
  ctx.fillStyle = rig.col(pal.scale); ctx.fillRect(-2, -1, 4, 2); ctx.fillRect(-1, -2, 2, 4);
  ctx.fillStyle = rig.col(hex); ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}

/**
 * The volley (3.3), drawn from backRow in BODY space, before the body: the quills leave the back, so the neck and
 * the head lie over them until they clear the silhouette (drawn with the breath, after the head, they crossed the
 * face). Launched within 4 f from the neck base, forward quill first (volleyAt); each back quill leaves the comb as
 * its flight comes out from behind the head (regrowOf). Each
 * is a `horn` 3 x 6 inked quill along its flight trailing a 6 px sap streak (`glow` 2 px on a 1 px `scale` edge, so
 * it reads on the pale floor), the streak in whole pixels (face space: a rotated 2 px stroke anti-aliased into a
 * pale smear); at 20 f each pops into ONE sparkle in `glow.hi` for 6 f (two per quill read as pairs of rings,
 * "oo oo oo").
 */
function drawVolley(ctx: CanvasRenderingContext2D, rig: DragonRig, c: number, n: number, pal: DragonPalette): void {
  const J = rig.j, hi = tones(rig, pal.glow).hi;
  ctx.save();
  ctx.rotate(-rad(J.bodyAng)); ctx.translate(-J.body.x, -J.body.y);    // body space -> root space
  for (let k = 0; k < n; k++) {
    const age = c - k;
    if (age < 0 || age >= FLY + POP) continue;
    volleyAt(rig, k, n, Math.min(age, FLY));
    const x = QV.x, y = QV.y;
    if (age >= FLY) { sparkle(ctx, rig, x, y, hi, pal); continue; }
    volleyAt(rig, k, n, age + 1);
    let dx = QV.x - x, dy = QV.y - y; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    // the streak: from 2 px behind the quill's base to 6 px further back (shorter while it is still launching),
    // in face space at the quill's rounded root point
    const len = Math.min(6, age * 2);
    if (len >= 2) {
      const X = Math.round(x), Y = Math.round(y);
      enterFaceFromLocal(ctx, rig, 0, 0, 0, X, Y);
      const ax = x - X - dx * 2, ay = y - Y - dy * 2, bx = ax - dx * len, by = ay - dy * len;
      ctx.fillStyle = rig.col(pal.scale); edgeStroke(ctx, ax, ay, bx, by);
      ctx.fillStyle = rig.col(pal.glow); pixelStroke(ctx, ax, ay, bx, by);
      ctx.restore();
    }
    ctx.beginPath();
    ctx.moveTo(x + dx * 4, y + dy * 4); ctx.lineTo(x - dx * 2 - dy * 1.5, y - dy * 2 + dx * 1.5); ctx.lineTo(x - dx * 2 + dy * 1.5, y - dy * 2 - dx * 1.5);
    ctx.closePath();
    outlinePath(ctx, rig);
    ctx.fillStyle = rig.col(pal.horn); ctx.fill();
  }
  ctx.restore();
}
/** pixelStroke's 2 x 2 run grown to 4 x 4: the 1 px dark edge under a 2 px streak. Device-aligned space. */
function edgeStroke(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void {
  const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= n; i++) ctx.fillRect(Math.round(x0 + (x1 - x0) * i / n) - 2, Math.round(y0 + (y1 - y0) * i / n) - 2, 4, 4);
}

/**
 * The baby's fizzle, by its breath clock (cue: frames since the snap). The rump nub pops off (a sparkle where it
 * stood) and is thrown high over the head, tumbling a quarter turn every 4 f, while the baby tips its head back to
 * watch it ("ah-": sneezeBreath). At SNEEZE it lands on the back of its head: BONK, and the baby sneezes ("CHOO": the
 * head snaps down, the dazed face comes on and three sap drops spray out of its snout for SPRAY f). The nub hops off
 * back along the back and drops into its own socket at HOME, upright again.
 */
const SNEEZE = 12, HOME = 18, SPRAY = 8;
/**
 * Sneeze drops: directions (deg below level, root space: forward, away from the body) and speeds, px/f, the level
 * one fastest, so the three spread as a cone, ">", out of the nose (fastest up and slowest down, they flew as one
 * upright column of rings, "o o o", not a burst).
 */
const SPRAY_ANG: readonly number[] = [-40, 0, 30], SPRAY_V: readonly number[] = [2, 2.4, 1.6];

/**
 * A thrown arc into QV: from (xa, ya) to (xb, yb) in T f, `t` f in, over its highest point at root y `top` (above
 * both ends), under constant gravity, at a constant speed along x.
 */
function arcAt(xa: number, ya: number, xb: number, yb: number, top: number, t: number, T: number): void {
  const H = Math.max(0.5, ya - top), D = Math.max(0.5, yb - top), q = (Math.sqrt(H) + Math.sqrt(D)) / T, g = 2 * q * q;
  QV.x = xa + (xb - xa) * t / T; QV.y = ya - Math.sqrt(2 * g * H) * t + g * t * t / 2;
}

/**
 * The popped nub's centre `c` frames after the pop, root space (into QV), from its socket (x0, y0): up at least
 * 14 px and 8 px over the head, down onto the BACK of the head at SNEEZE (sitting on the cranium circle 45 deg back
 * from its top), then a 3 px hop off it back into the socket at HOME. Both ends are read from this frame's joints,
 * so it lands where the head IS. (Landed on the crown, it sat and hopped among the dazed stars, which lie over it;
 * thrown up and back over the tail, it hung over the tail nub as a second nub and then lay behind the tail tip like
 * a crumb, away from the face, the sneeze and the stars.)
 */
function nubAt(rig: DragonRig, x0: number, y0: number, c: number): void {
  const J = rig.j, e = (rig.dims.head.cranR + 3) * Math.SQRT1_2, xc = J.cran.x - e, yc = J.cran.y - e;
  if (c < SNEEZE) arcAt(x0, y0, xc, yc, Math.min(y0 - 14, J.top - 8), c, SNEEZE);
  else arcAt(xc, yc, x0, y0, yc - 3, Math.min(c, HOME) - SNEEZE, HOME - SNEEZE);
}

/**
 * Bible 3.3 "Signature: Quill Volley". The wind-up is the shared anim's `bristle` (quills snap upright). The VOLLEY
 * itself is drawn by backRow (drawVolley), behind the body, neck and head it leaves from; the fired quills regrow
 * there too. BABY (this renderer, mouth space walked back to root space): bristled into a puffball (the anim holds
 * tuning.breath.puff 1.15), it pops its rump nub (backRow hides it until HOME), which bonks it on the head: it
 * sneezes (nubAt, SNEEZE).
 */
const breath: ElementDraw = (ctx, rig, pose, info) => {
  if (pose.act !== ACT.breath || pose.cue < 0 || rig.override || info.stage !== 'baby') return;
  const c = pose.cue, J = rig.j, pal = info.pal, hi = tones(rig, pal.glow).hi;
  ctx.save();
  mouthToRoot(ctx, rig, info.ang);
  // the rump nub's socket, where it pops from and lands back: a sparkle there for the first POP frames
  const nx = COMB.baby.back[0][0] * (rig.dims.hipR / 6.5);
  bodyToRoot(rig, nx, backLineY(rig, nx) - 1, QV);
  const x0 = QV.x, y0 = QV.y;
  if (c < POP) sparkle(ctx, rig, x0, y0 - 1, hi, pal);
  if (c < HOME) {
    // the nub as the comb draws it, 5 wide and 6 tall, its point rounded 1 px (an inked square read as a crumb),
    // tumbling a quarter turn every 4 f until it comes upright again (f 16), to drop into its socket; whole-pixel
    // centre, so every turn stays on the grid. Its base half is in the horn's shadow tone (clipped): all pale, on
    // the straw floor only its ink read, a hollow play glyph ">" or "v"
    nubAt(rig, x0, y0, c);
    ctx.save();
    ctx.translate(Math.round(QV.x), Math.round(QV.y)); ctx.rotate((Math.min(4, Math.floor(c / 4)) & 3) * Math.PI / 2);
    ctx.beginPath(); ctx.moveTo(-2.5, 3); ctx.arcTo(0, -3, 2.5, 3, 1); ctx.lineTo(2.5, 3); ctx.closePath();
    outlinePath(ctx, rig);
    ctx.fillStyle = rig.col(pal.horn); ctx.fill();
    ctx.clip();
    ctx.fillStyle = rig.col(tones(rig, pal.horn).sh); ctx.fillRect(-3, 1, 6, 3);
    ctx.restore();
  }
  // the sneeze: three sap drops fanning out of the snout under a little gravity, born 3 px clear of its contour
  // (the mouth point sits a snout-tip radius and more inside it): born on it, they sat on the snout for 2 f
  const age = c - SNEEZE;
  if (age >= 0 && age < SPRAY) {
    const r0 = rig.dims.head.snout.r1 + 8;
    for (let k = 0; k < SPRAY_ANG.length; k++) {
      const a = rad(SPRAY_ANG[k]), r = r0 + SPRAY_V[k] * age;
      // (kept 2 px over the floor: a sparkle is 4 x 4 about its centre)
      sparkle(ctx, rig, J.mouth.x + Math.cos(a) * r, Math.min(-2, J.mouth.y + Math.sin(a) * r + 0.05 * age * age), pal.glow, pal);
    }
  }
  ctx.restore();
};

/**
 * Bible 3.3 "Idle fidget: it grooms its quills with its head turned back (40 f)". The neck arches back and the head
 * turns round over the shoulder, snout down to the comb, pecking into it (every 4 f from f 10 to 30: peckAt; backRow
 * works the front quills with it), eyes shut from f 3 (the head eased round, inout, so the young's overshoot does
 * not swing it past upright first), then it eases back round over 12 f (inout, 44 f in all) and opens its eyes at
 * f 40, the head within 40 deg of level. (In profile a head turned back to the comb is a head pitched past
 * vertical, which the rig draws LOOKING BACK -- upright, the thorn on top -- where it once hung upside down with
 * its thorns as tusks: keyed +34, snout down, it dipped forward to its own chest. It nibbled with its jaw first: the open mouth,
 * upside down, showed as a red cap on the crown. Shutting its eyes at f 8 and opening them at f 32, whipping round
 * 150 deg in 8 f, it showed an upside-down open eye on the way round and back.)
 */
function fidget(stage: Stage): ReturnType<typeof bake> {
  const k = fidK(stage), L = Math.round(44 * k), t = (f: number) => Math.round(f * k), P = peckP(stage);
  const head: Key[] = [[0, 0, 'inout'], [t(8), -150]];
  for (let f = t(10); f < t(30); f += P) head.push([f, -156], [f + P / 2, -146]);
  head.push([t(32), -150, 'inout'], [t(44), 0]);
  return bake({
    'neck.a0': [[0, 0], [t(8), -34], [t(32), -34, 'inout'], [t(44), 0]],
    'neck.a1': [[0, 0], [t(8), -34], [t(32), -34, 'inout'], [t(44), 0]],
    'head.rot': head,
    'body.rot': [[0, 0], [t(8), -3 * FIDGET_TIMING[stage].amp], [t(32), -3 * FIDGET_TIMING[stage].amp, 'inout'], [t(44), 0]],
    face: [[0, DFACE.neutral], [t(3), DFACE.closed], [t(40), DFACE.neutral]],
    act: [[0, ACT.fidget]], cue: [[0, 0], [L, L]],
  }, { stage, len: L, next: 'idle' });
}

/**
 * Bible 4.3 "Spike" walk: the shy CREEP (tuning: 0.35 px/f, head down 8) with a stop-and-look every second cycle.
 * The shared walk's own cycle plays twice, then STOP f standing still on its phase-0 stride (move 0), the head
 * raised to look (a small peek down and up again), the quills leaning wary (backRow: the walk's clock runs on
 * past the cycle, C + f), then the head lowers back into the stride. A baby keeps its stumble, one cycle in six,
 * and still stops after every second cycle: cycle, cycle, stop, cycle, cycle, stop, cycle, stumble, stop (the
 * stumble's end is the stride's phase 0, where the stop stands).
 */
function creepWalk(stage: Stage, dims: DragonDims | null): DragonAnim {
  const w = animTuning(stage, SPIKE).walk, C = Math.round(w.cycle), S = STOP[stage], baby = stage === 'baby';
  const base = walkAnim(stage, w, dims);
  const cycle: DragonFrame[] = [], stumble: DragonFrame[] = [];
  let t = 0;
  for (const f of base.frames) { if (t < C) cycle.push(f); else if (t >= 5 * C) stumble.push(f); t += f.dur || 1; }
  // every channel of the stride's first frame held, so the stop starts and ends exactly where the cycle wraps
  const p0 = (base.frames[0].pose || {}) as unknown as Record<string, number | Record<string, number> | undefined>;
  const tr: Record<string, Track> = {};
  for (const ch of Object.keys(p0)) {
    const v = p0[ch];
    if (typeof v === 'number') tr[ch] = [[0, v]];
    else if (v) for (const sk of Object.keys(v)) tr[`${ch}.${sk}`] = [[0, v[sk]]];
  }
  const h0 = typeof p0.head === 'object' ? p0.head.rot || 0 : 0, n0 = typeof p0.neck === 'object' ? p0.neck.a0 || 0 : 0;
  const T = (f: number) => Math.round(f * S / 24), look = baby ? -8 : -10;
  tr['head.rot'] = [[0, h0, 'out'], [T(6), look], [T(10), look + 5, 'inout'], [T(14), look], [T(18), look, 'inout']] as Key[];
  if (!baby) tr['neck.a0'] = [[0, n0, 'out'], [T(6), n0 - 6], [T(18), n0 - 6, 'inout']] as Key[];
  tr.cue = (f: number) => C + f;
  const stop = bake(tr as Tracks, { stage, len: S, loop: true, res: baby ? 1 : 2, ease: 'linear' });
  const two = [...cycle, ...cycle, ...stop.frames];
  return { loop: true, frames: baby ? [...two, ...two, ...cycle, ...stumble, ...stop.frames] : two };
}

/**
 * The baby's fizzle with its SNEEZE (3.3): the shared breath with the head tipping back ("ah-", watching its nub
 * fly) over the fizzle's last frames and snapping down ("CHOO") at breath cue SNEEZE, as the nub bonks it, the
 * puffball deflates, the anim's 2 px sneeze-back recoils and the dazed face comes on; the nub and the drops are the
 * breath renderer's.
 */
function sneezeBreath(): DragonAnim {
  const a = breathAnim('baby', animTuning('baby', SPIKE));
  const keys: readonly (readonly number[])[] = [[SNEEZE - 8, 0], [SNEEZE - 2, -8], [SNEEZE, 10], [SNEEZE + 2, 7], [SNEEZE + 8, 0]];
  const nod = (c: number): number => {
    for (let i = 0; i + 1 < keys.length; i++) {
      const [ta, va] = keys[i], [tb, vb] = keys[i + 1];
      if (c >= ta && c < tb) return va + (vb - va) * (c - ta) / (tb - ta);
    }
    return 0;
  };
  return {
    ...a,
    frames: a.frames.map((f) => {
      const p = f.pose, add = p && p.cue != null ? nod(p.cue) : 0;
      return p && add ? { ...f, pose: { ...p, head: { ...p.head, rot: (p.head && p.head.rot || 0) + add } } } : f;
    }),
  };
}

/**
 * The brow thorn's world clamp (3.0, HornParams.worldClamp): never more than 20 deg above or 40 deg below straight
 * back, like water's fin-ear. Laid along the neck line behind a head lowered asleep it stood upright behind the eye
 * as a white tusk or an ear (the fixed fault of the grooming's look-back, back in the sleep: the cast review). The
 * thorn also TAPERS to a point (r 1.5 -> 0.5): with the shared horn's round 2 px end it read at game scale as a pale
 * capsule on the skull, a hair clip or a bandage.
 */
const THORN_CLAMP: readonly [number, number] = [20, 40];

export const SPIKE: ElementSpec = {
  id: 'spike',
  name: 'Bramble',
  blurb: 'Shy and prickly with strangers, a cuddle-bug once it trusts you. Its quills are its mood.',
  palette: PAL,
  modifiers: { bodyLength: 0.95, bodyDepth: 1.1, legLength: 0.9, legR: 1.05, neckLength: 0.8, neckAngle: 0, tailLength: 0.9, tailR: 1.0, snout: 1.0 },
  stages: {
    baby: {
      tailRest: TAIL_REST.spike.baby, horns: null,
      // the first ring sits at the tail base at every stage (2.7, 3.3), just behind the hip where the tail shows:
      // 15 % of a young or adult tail, 32 % of the baby's short one (at 15 % the hip hid it); later rings further out
      markings: [{ kind: 'ring', at: 'tail', t: 0.32, size: 3 }],
      wing: wingParams({ style: 'leaf', scallop: -2, foldRise: 0, nubRest: 200 }),
      dorsal: null,
    },
    young: {
      tailRest: TAIL_REST.spike.young,
      // brow thorns lying back along the neck line (3.0: within 20 deg of it), rooted on the BACK contour of the
      // cranium as fire's are: rooted on its top (105 deg) they lay along the skull's own contour and read as a pale
      // strap or goggles on the forehead instead of sticking out of the silhouette
      horns: hornParams({ len: 3, at: 145, sink: 1, sweep: 14, r1: 0.5, worldClamp: THORN_CLAMP }),
      markings: [{ kind: 'ring', at: 'tail', t: 0.15, size: 3 }, { kind: 'ring', at: 'tail', t: 0.45, size: 3 }],
      wing: wingParams({ style: 'leaf', scallop: -2, foldRise: 0 }),
      dorsal: null,
    },
    adult: {
      tailRest: TAIL_REST.spike.adult,
      // the far thorn forked at the young's 8 deg, so the overlap cull takes it and one thorn shows: at the adult
      // default 28 (and still at 16-20) it lay stacked over the near one as a flat grey slab, a hair clip (1.5)
      horns: hornParams({ len: 6, at: 145, sink: 1, sweep: 12, farTilt: 8, r1: 0.5, worldClamp: THORN_CLAMP }),
      markings: [{ kind: 'ring', at: 'tail', t: 0.15, size: 3 }, { kind: 'ring', at: 'tail', t: 0.4, size: 3 }, { kind: 'ring', at: 'tail', t: 0.62, size: 3 }],
      // the adult-only extra: each spar pokes 3 px past the leaf as a thorn, plus a 4 px wrist thorn
      wing: wingParams({ style: 'leaf', scallop: -3, foldRise: 0, thorn: 3, wristThorn: 4 }),
      dorsal: null,
    },
    // the elder (3.3's Elder column): the adult's thorns, rings and leaf, the thorns kept (parts.ts lets the elder
    // through the adult-only thorn test), the leaf worn: a round BITE 5 x 3 in panel 1 (a nibbled leaf) and the
    // notched hole in the arm panel from `wing` 0.90 (2.9)
    elder: {
      tailRest: TAIL_REST.spike.elder,
      horns: hornParams({ len: 6, at: 145, sink: 1, sweep: 12, farTilt: 8, r1: 0.5, worldClamp: THORN_CLAMP }),
      markings: [{ kind: 'ring', at: 'tail', t: 0.15, size: 3 }, { kind: 'ring', at: 'tail', t: 0.4, size: 3 }, { kind: 'ring', at: 'tail', t: 0.62, size: 3 }],
      wing: wingParams({
        style: 'leaf', scallop: -3, foldRise: 0, thorn: 3, wristThorn: 4,
        tears: [{ panel: 1, at: 0.5, depth: 3, bite: true }],
        // (2.9's spot re-measured for the notched window AND the airing: at 2.9's (-10.5, -6) the window lay on the back once
        // the airing leaned the spread back far enough for the tip rule (1.3); here, up the arm panel toward the
        // forearm, it keeps the ring and 2 px of membrane round it and clears the back line at the airing's 20 deg
        // sit-back, anims.ts airingFit)
        hole: { x: -5, y: -13, from: 0.9 },
      }),
      dorsal: null,
    },
  },
  render: { backRow, breath },
  anims: {
    // Bible 4.3 "Spike". The shy creep (tuning: 0.35 px/f, head down 8) with its stop-and-look (creepWalk); the
    // happy flourish (the quill ripple from cue 0, then the perky 15 deg of the happy mood) and the hungry tell (the
    // beg's mood -0.5 droop, x 0.9 at 29 deg, sagging on each growl) are backRow's; the long, low sleep is tuning. The
    // grooming fidget: fidget(); the baby's sneeze: sneezeBreath().
    fidget,
    overrides: (st, dims) => (st === 'baby' ? { walk: creepWalk(st, dims), breath: sneezeBreath() } : { walk: creepWalk(st, dims) }),
    tuning: (st) => ({
      breath: { puff: st === 'baby' ? 1.15 : 1 },
      // FIRST PASS (elder): the creep slowed as the shared walk slows (0.35 x 0.34 / 0.45) on the elder's 64 f cycle
      walk: { speed: st === 'adult' ? 0.35 : st === 'young' ? 0.4 : st === 'elder' ? 0.26 : 0.24, head: st === 'baby' ? 4 : 8 },
      // young and adult sleep LONG AND LOW: the body level, the tail dropped to the floor behind the rump and laid
      // straight back along it top side up (a J round the rump: lift 30, curl -8 a segment levels it), so its quills
      // stand (the 37 deg gate) and the comb runs nape -> tail, leaning SLEEP_LEAN back (backRow): a low saw on a bar
      // twice as long as it is tall. Curled into a quill ball (pitched +10, the tail under the body, the quills
      // world-upright 4 px apart) it was a round mound with points, rock's dome at /3 (5.1 #1, the cast review).
      // The baby's bun RAISES its tail a little above level behind the rump instead, so its tail nub stands over the
      // rump nub: lying flat, its nubs vanished at /3 and the asleep baby spike was baby rock's mound. Its wing nub
      // rises to 71 deg like every other bun's (nubFold 2.15 from spike's 200 deg rest; the shared 3.3 swung it on
      // to 2 deg, flat forward over the face, where it met the shut-eye bar in one dark band, a sleep mask)
      sleep: st === 'baby' ? { bodyRot: 6, tailLift: -20, tailCurl: 4, nubFold: 2.15 } : { bodyRot: 0, tailLift: 30, tailCurl: -8 },
    }),
  },
};
