// FIRE: "Ember", the hearth dragon (docs/ART_BIBLE.md 3.2). Zone: above the tail tip. Cue: the torch tail, a
// flame on an up-curling tail, which is also its mood meter.
//
// Everything Ember is beyond the shared rig lives here:
//   - the FLAME (tailTip): seed / sprout / signature (1 / 2 / 3 tongues) and the elder's HEARTH with its elder-only
//     extra, the COAL BED; the mood gauge, the banked ember asleep, and every act that changes it (the strut, the
//     happy flare, the hungry gutter, the bath, the wake);
//   - the BREATH (breath): the nostril-smoke tell, the fire jet (young: a short lick), the baby's hiccup, the elder's
//     finale SMOKE RING; the beg's smoke sighs and the bath's hiss share that anchor, since they leave the same
//     nostrils;
//   - the rising EMBERS (ambient): the idle ember, the happy flourish's burst, the bath's steam off the flame;
//   - the ANIMS: the strut and the sigh laid over the shared walk and beg, the rekindle marked on the shared wake,
//     the bath, and the tail-chase fidget.
import { DRAGON_PALETTES, DRAGON_SHARED } from '../palettes.ts';
import { NO_MODIFIERS, TAIL_REST, FIDGET_TIMING, STAGE_TIMING, grown } from '../stages.ts';
import type { Stage } from '../stages.ts';
import { hornParams, wingParams } from '../element.ts';
import type { ElementSpec, ElementDraw, DragonInfo } from '../element.ts';
import { emitterFill, emitterCore, pathPts, disc, mouthToRoot } from '../features.ts';
import { ACT, DFACE } from '../pose.ts';
import type { DragonPose, PartialDragonPose } from '../pose.ts';
import { bake, stretchKeys, walkAnim, begAnim, wakeAnim, ELDER_FINALE } from '../anims.ts';
import type { Key, Tracks } from '../anims.ts';
import type { DragonAnim, DragonFrame } from '../anim.ts';
import { animTuning } from '../tuning.ts';
import { hash01, liveSpawns, stepAlpha } from '../fx.ts';
import type { TopItem } from '../fx.ts';
import { rootToScreen, enterFaceFromLocal } from '../rig.ts';
import type { DragonRig } from '../rig.ts';
import type { DragonDims } from '../build.ts';
import { tones } from '../../../lib/art/shading.ts';

const PAL = DRAGON_PALETTES.fire;
const D2R = Math.PI / 180;

// ---------- the flame: the torch tail (3.2), the mood meter ----------

/**
 * Flame box (w x h), tongue count, core size and how many frames slower it flickers, per stage (3.2 table): seed,
 * sprout, signature (the third tongue is adult-only) and THE HEARTH, the elder's: wider but not taller (12 x 14), its
 * three tongues a campfire's with the middle one tallest (HEARTH), a 65 % core (its area: HEART) standing on its coal
 * bed, the flicker 2 f slower (steadier). The hearth's elder-only extra, the COAL BED, is drawn in tailTip.
 */
const FLAME: Readonly<Record<Stage, { w: number; h: number; tongues: number; core: number; slow: number }>> = {
  baby: { w: 5, h: 7, tongues: 1, core: 0.55, slow: 0 },
  young: { w: 7, h: 10, tongues: 2, core: 0.55, slow: 0 },
  adult: { w: 10, h: 14, tongues: 3, core: 0.55, slow: 0 },
  elder: { w: 12, h: 14, tongues: 3, core: 0.65, slow: 2 },
};
/**
 * The smallest flame box awake, per stage: the width never drops a stage's tongues (3 need >= 9 px, 2 need >= 6:
 * below that a low adult showed the young's two-tongue flame, a low young the baby's seed), so the gauge reads
 * through the height and the core; the baby's seed never under 4 x 5 (at 3 x 4 it left a 2 x 3 speck of glow
 * inside its ink). Banked, one tongue, never under 4 x 5 either.
 */
const FLAME_MIN: Readonly<Record<Stage, { w: number; h: number }>> = { baby: { w: 4, h: 5 }, young: { w: 6, h: 6 }, adult: { w: 9, h: 9 }, elder: { w: 9, h: 9 } };
const BANKED_MIN = { w: 4, h: 5 };

/**
 * Tongue shapes in a unit box (x -0.5..0.5, y 0 at the base .. -1 at the top), 3 flicker keys per tongue count,
 * swapped on stepped keys (never tweened: 5.1 #12). Between keys the tip sways centre -> right -> left and the side
 * tongues trade heights, so the swap reads as a lick of flame rather than a jitter. Every tongue is >= 3 px wide
 * where it parts from its neighbour (3.2), which is why the flame box never narrows below FLAME_MIN (the notch
 * sits on the centre line: at 0.14 a 7 px sprout's side tongue was 2.5 px). SHAPES[0] is also the breath jet's
 * leading tongue.
 */
const SHAPES: readonly (readonly (readonly number[])[])[] = [
  [ // 1 tongue: a teardrop whose tip leans (the seed, and the banked ember)
    [0, 0.04, 0.42, -0.1, 0.5, -0.34, 0.34, -0.62, 0.04, -1, -0.26, -0.64, -0.5, -0.36, -0.42, -0.1],
    [0, 0.04, 0.44, -0.12, 0.5, -0.38, 0.36, -0.62, 0.2, -0.98, -0.18, -0.62, -0.5, -0.34, -0.42, -0.1],
    [0, 0.04, 0.42, -0.1, 0.5, -0.34, 0.22, -0.64, -0.14, -0.98, -0.34, -0.58, -0.5, -0.32, -0.44, -0.1],
  ],
  [ // 2 tongues: the main tip behind, a shorter side tongue in front, parted on the centre line
    [0, 0.04, 0.44, -0.1, 0.5, -0.36, 0.48, -0.58, 0.3, -0.84, 0.02, -0.52, -0.08, -1, -0.34, -0.62, -0.5, -0.36, -0.42, -0.1],
    [0, 0.04, 0.44, -0.1, 0.5, -0.36, 0.5, -0.56, 0.4, -0.74, 0.04, -0.5, 0.06, -1, -0.3, -0.64, -0.5, -0.36, -0.42, -0.1],
    [0, 0.04, 0.44, -0.1, 0.5, -0.36, 0.46, -0.62, 0.24, -0.9, 0, -0.56, -0.2, -0.98, -0.38, -0.6, -0.5, -0.34, -0.42, -0.1],
  ],
  [ // 3 tongues: back, main, front
    [0, 0.04, 0.46, -0.1, 0.5, -0.36, 0.48, -0.56, 0.4, -0.78, 0.17, -0.56, 0.04, -1, -0.16, -0.6, -0.36, -0.82, -0.44, -0.54, -0.5, -0.34, -0.44, -0.1],
    [0, 0.04, 0.46, -0.1, 0.5, -0.36, 0.5, -0.54, 0.46, -0.72, 0.18, -0.54, 0.16, -1, -0.12, -0.6, -0.3, -0.76, -0.46, -0.52, -0.5, -0.34, -0.44, -0.1],
    [0, 0.04, 0.46, -0.1, 0.5, -0.36, 0.48, -0.58, 0.34, -0.86, 0.16, -0.58, -0.08, -1, -0.17, -0.58, -0.42, -0.72, -0.48, -0.5, -0.5, -0.34, -0.44, -0.1],
  ],
];

/**
 * THE HEARTH (3.2, the elder): a campfire's flame, one broad middle tongue over two side licks, drawn so it never
 * reads as a crown (a box with three even points over a straight band and its two jewels, the elder review's):
 *   - a ROUND BOTTOM: widest at its notches, it rounds in over its bottom 3 rows (8, 11 and 12 px across at 12 wide),
 *     so the coal bed in them is the bowl of the fire, not a band across a box;
 *   - the licks never match: in each key one stands tall (0.72 to 0.76 of it) and the other short (0.6 to 0.62), their
 *     tips inboard of the flanks, and the middle tip leans away from the tall one; the keys trade them, as the
 *     signature's licks trade heights.
 * Every tongue is >= 3 px wide where it parts from its neighbour at the 9 x 9 of mood -1 too (3.2: 3 tongues kept):
 * the notches sit at +-0.17, where the flame is widest.
 */
const HEARTH: readonly (readonly number[])[] = [
  [0, 0, 0.2, 0, 0.36, -0.04, 0.45, -0.1, 0.5, -0.2, 0.5, -0.44, 0.44, -0.6, 0.34, -0.76, 0.17, -0.46, 0.23, -0.68, 0.19, -0.84, 0.1, -1, -0.08, -0.8, -0.17, -0.62, -0.17, -0.44, -0.36, -0.6, -0.47, -0.5, -0.5, -0.38, -0.5, -0.2, -0.45, -0.1, -0.36, -0.04, -0.2, 0],
  [0, 0, 0.2, 0, 0.36, -0.04, 0.45, -0.1, 0.5, -0.2, 0.5, -0.4, 0.46, -0.52, 0.36, -0.6, 0.17, -0.44, 0.17, -0.62, 0.08, -0.8, -0.1, -1, -0.2, -0.84, -0.24, -0.68, -0.17, -0.46, -0.34, -0.76, -0.44, -0.6, -0.5, -0.44, -0.5, -0.2, -0.45, -0.1, -0.36, -0.04, -0.2, 0],
  [0, 0, 0.2, 0, 0.36, -0.04, 0.45, -0.1, 0.5, -0.2, 0.5, -0.42, 0.46, -0.52, 0.38, -0.62, 0.17, -0.44, 0.24, -0.7, 0.18, -0.88, 0.04, -1, -0.1, -0.86, -0.17, -0.66, -0.17, -0.44, -0.36, -0.72, -0.45, -0.58, -0.5, -0.42, -0.5, -0.2, -0.45, -0.1, -0.36, -0.04, -0.2, 0],
];
/**
 * The hearth's HEART, its core: one tongue per key, its tip leaning with the flame's middle tongue, its foot a 2 px
 * point standing on the coal bed. 0.58 x 0.73 of the flame's box, from the bed's top edge (HEART_UP): the area of the
 * table's 65 % core, drawn narrower and taller, so the heat stands on the coals as one flame. (The scaled three-tongue
 * core, as the signature's, pushed its side tips out through the notches once lifted; a row of flame between it and
 * the coals stacked band, line and block, the crown again; a blunt foot left the specks no room.)
 */
const HEART: readonly (readonly number[])[] = [
  [0, 0, 0.14, -0.03, 0.34, -0.14, 0.5, -0.32, 0.46, -0.5, 0.3, -0.72, 0.14, -1, -0.14, -0.74, -0.38, -0.52, -0.5, -0.32, -0.34, -0.14, -0.14, -0.03],
  [0, 0, 0.14, -0.03, 0.34, -0.14, 0.5, -0.32, 0.38, -0.52, 0.14, -0.74, -0.14, -1, -0.3, -0.72, -0.46, -0.5, -0.5, -0.32, -0.34, -0.14, -0.14, -0.03],
  [0, 0, 0.14, -0.03, 0.34, -0.14, 0.5, -0.3, 0.44, -0.52, 0.24, -0.76, 0.06, -1, -0.2, -0.74, -0.42, -0.5, -0.5, -0.3, -0.34, -0.14, -0.14, -0.03],
];
const HEART_W = 0.58, HEART_H = FLAME.elder.core ** 2 / HEART_W, HEART_UP = 2;
/**
 * The coal bed's two lit specks per flicker key, [end, inset, lift] twice: the speck stands `inset` px in from the
 * bed's left (-1) or right (+1) end, low in the bed (lift 0: rows 0-1, measured on the narrower bottom row) or a row
 * up on its top edge (lift 1: rows 1-2). Never a matched pair: one lies low at one end, the other stands up at the
 * other, so the bed's top edge is broken, and each key moves both (a pair level on a straight band read as a crown's
 * jewels). At 12 wide they keep off the heart's 2 px foot (the third key's touch its rows 2 and 3 at a corner). With
 * no core (mood -1, the hungry gutter, the bath) only the first is lit: one ember left in the coals, since a lit pair
 * was the only glow.hi in a coreless flame and blunted the low-mood read.
 */
const COALS: readonly (readonly number[])[] = [[-1, 0, 0, 1, 0, 1], [1, 0, 0, -1, 0, 1], [1, 1, 0, -1, 1, 1]];
/** The round bottom every HEARTH key shares, (half-width, height) up its side: bedEnds reads the bed's rows off it. */
const BOTTOM: readonly number[] = [0.2, 0, 0.36, 0.04, 0.45, 0.1, 0.5, 0.2];
/** The coal bed's row `r` (0 = the bottom) of a w x h hearth standing `ox` over: its first and last whole columns. */
const BED = { a: 0, b: 0 };
function bedEnds(w: number, h: number, ox: number, r: number): void {
  const y = (r + 0.5) / h;
  let x = BOTTOM[6];
  for (let i = 2; i < BOTTOM.length; i += 2) {
    if (y > BOTTOM[i + 1]) continue;
    x = BOTTOM[i - 2] + (BOTTOM[i] - BOTTOM[i - 2]) * (y - BOTTOM[i - 1]) / (BOTTOM[i + 1] - BOTTOM[i - 1]);
    break;
  }
  BED.a = Math.ceil(ox - x * w); BED.b = Math.floor(ox + x * w) - 1;
}

/** Scratch: the current flame polygon in px (the tail's flame, or the breath jet's leading tongue). */
const PTS: number[] = new Array(44).fill(0);
/** Scratch: the hearth's heart (HEART, in px). */
const CORE: number[] = new Array(24).fill(0);

/**
 * The flame this frame, as flameState leaves it: the size multiplier and its px box, the tongue count and the
 * flicker key, whether it has its core, whether it is banked (asleep: glow.sh) and whether the banked ember grows
 * to the core (the sleeping inhale), and how far its tip leans back (px).
 */
const FS = { k: 1, w: 5, h: 7, tongues: 1, key: 0, core: true, banked: false, pip: false, lean: 0 };

/**
 * Work out the flame from the mood gauge and the act (3.2, 4.3), into FS. The gauge: 0.6x at mood -1 (no core,
 * swapping every 8 f) -> 1.0 -> 1.2x at +1 (every 4 f); shrunk, each axis rounds UP (60 % is a floor, D7), and the
 * width stops at FLAME_MIN. Over it, by act:
 *   asleep  banked: 0.6x in glow.sh, one slow tongue, no core, a 2 x 2 `glow` ember always lit low in it; on each
 *           sleeping inhale it grows a step to 0.7x and the ember to the core's shape (it breathes with the pet,
 *           alight but resting);
 *   beg     the hungry tell: guttered to 0.6x, no core, whatever the resting mood;
 *   bath    the mood key has it at 0.6x; while the water hits (4-24 of its 60 f clock, bathClock) it sputters on
 *           3 f swaps;
 *   happy   the flourish: 1.4x for 30 f from cue 0 (the elder's 38), roaring on 3 f swaps;
 *   walk    the strut: swapping every 4 f, the tip leaning back into the stride;
 *   wake    the rekindle: 1.2x on 3 f swaps while the wake's fx envelope is up (rekindleAnim: the 10 f from the
 *           first open eye).
 */
function flameState(rig: DragonRig, pose: DragonPose, info: DragonInfo): void {
  const f = FLAME[info.stage], m = info.mood, act = pose.act, c = pose.cue;
  let k = m < 0 ? 1 + 0.4 * m : 1 + 0.2 * m, period = 6 - 2 * m, core = m > -0.75, lean = 0, pip = false;
  if (info.asleep) {
    const B = rig.tune.sleep.breath;
    pip = act === ACT.sleep && c >= 0 && c % B < B / 2;
    k = pip ? 0.7 : 0.6; period = 12; core = false;
  } else if (act === ACT.beg) {
    k = Math.min(k, 0.6); period = 8; core = false;
  } else if (act === ACT.bath) {
    const bc = bathClock(info.stage, c);
    if (bc >= 4 && bc < 24) period = 3;
  } else if (act === ACT.happy && c >= 0 && c < (info.stage === 'elder' ? 38 : 30)) {
    // (the elder's flare x 1.25, its timing: 4.3's elders)
    k = 1.4; period = 3;
  } else if (act === ACT.walk) {
    period = 4; lean = 0.14;
  } else if (act === ACT.wake && pose.fx >= 0.5) {
    k = Math.max(k, 1.2); period = 3;
  }
  const lo = info.asleep ? BANKED_MIN : FLAME_MIN[info.stage];
  const w = Math.max(lo.w, gauge(f.w, k)), h = Math.max(lo.h, gauge(f.h, k));
  FS.k = k; FS.w = w; FS.h = h; FS.core = core; FS.banked = info.asleep; FS.pip = pip;
  FS.tongues = info.asleep ? 1 : Math.min(f.tongues, w >= 9 ? 3 : w >= 6 ? 2 : 1);
  FS.key = flickerKey(info.seed, info.tick, period + f.slow);
  FS.lean = Math.round(lean * h);
}
/** One flame axis at size k, px: shrunk it rounds up, so no axis ever shows under 60 % (D7). */
function gauge(n: number, k: number): number { return k < 1 ? Math.ceil(n * k - 1e-6) : Math.round(n * k); }

/**
 * The flicker key at `tick`, stepped every `period` frames (+-1 per pet, never over 6 where the gauge asks for 6
 * or less: 5.1 #12) from a per-pet phase. The keys run in a seeded order: each step moves on 1 or 2 keys round the
 * 3 (from an 8-step pattern of the pet's own), so the next key is never the current one and no two Embers lick in
 * the same rhythm (5.4, 4.1 desync). (The seed goes in hash01's second slot: in the first, small seeds all hashed
 * low.)
 */
function flickerKey(seed: number, tick: number, period: number): number {
  const b = Math.round(period), p = Math.min(Math.max(6, b), Math.max(3, b + Math.floor(hash01(71, seed) * 3) - 1));
  const s = Math.floor((tick + Math.floor(hash01(72, seed) * 48)) / p), cyc = Math.floor(s / 8), at = s - cyc * 8;
  let sum = 0, part = 0;
  for (let i = 0; i < 8; i++) { const d = hash01(80 + i, seed) < 0.5 ? 1 : 2; sum += d; if (i < at) part += d; }
  return (cyc * sum + part) % 3;
}

/** How far the flame's base stands above the tail tip's node, px: it sits on the tip's cap, not inside the tail. */
function flameBase(r: number): number { return Math.max(1, Math.round(r * 0.5)); }

/**
 * The cue: the torch tail (3.2). Drawn in FACE space at the tail tip (rig.ts enterFaceFromLocal): upright on screen
 * whatever the tail's angle and the sprite's root rotation ("fire rises": the baby's waddle, the dizzy wobble),
 * never squashed, so an emitter keeps its shape through a breath or a paper turn's 60 % frame (squashed with the
 * body, a turning flame's tongues fell under the mark floor), mirrored with the sprite, and with its base on a whole
 * pixel, so a swaying tail carries it in whole-pixel steps instead of re-antialiasing its edges every frame (5.1 #12)
 * and the coal bed's rows are pixel rows. One inked flat outer shape in `glow` (part of the silhouette), a `glow.hi`
 * core at 55 % size sitting low in it with no ink; banked asleep, the whole flame is `glow.sh` with no core, which
 * marks sleep at a glance (gate h), with a 2 x 2 `glow` ember always lit low in its base, grown on each sleeping
 * inhale to the core's shape (>= 2 px), so the bud reads as alight.
 * THE HEARTH (the elder, HEARTH) has its own core, the HEART (the 65 % core's area, one tongue standing on the
 * coals), and carries its elder-only extra at every mood awake, the COAL BED: the flame's bottom 2 rows in `glow.sh`
 * inside its ink, a bowl in its round bottom, with two 2 x 2 `glow.hi` specks that move with the flicker's key
 * (COALS; one with the core out). A banked hearth still has coals, so the bed stays at mood -1 and through the hungry
 * gutter and the bath; asleep the whole flame banks to `glow.sh`, the coals merge into it and the ember carries on.
 */
const tailTip: ElementDraw = (ctx, rig, pose, info) => {
  flameState(rig, pose, info);
  const hearth = info.stage === 'elder' && FS.tongues === 3;
  const shape = hearth ? HEARTH[FS.key] : SHAPES[FS.tongues - 1][FS.key], n = shape.length, w = FS.w, h = FS.h, lean = FS.lean;
  // the tip leans back (-x) by `lean` px at the top, sheared in from the base
  // (an odd-width hearth stands half a pixel over, so its edges and its coal rows are whole pixels too)
  const ox = hearth ? (w & 1) * 0.5 : 0;
  for (let i = 0; i < n; i += 2) { PTS[i] = shape[i] * w + shape[i + 1] * lean + ox; PTS[i + 1] = shape[i + 1] * h; }
  const T = tones(rig, info.pal.glow), J = rig.j, tn = J.tailN;
  enterFaceFromLocal(ctx, rig, J.tailX[tn], J.tailY[tn], info.ang, J.tailX[tn], J.tailY[tn]);
  ctx.translate(0, -flameBase(info.r));
  pathPts(ctx, PTS, 1, 0, 0, n);
  emitterFill(ctx, rig, FS.banked ? T.sh : info.pal.glow);
  if (hearth && !rig.override) {
    ctx.save();
    pathPts(ctx, PTS, 1, 0, 0, n);
    ctx.clip();
    if (FS.core) {
      // (sheared with the flame's lean, as the flame is)
      const cs = HEART[FS.key], cn = cs.length, ch = HEART_H * h;
      for (let i = 0; i < cn; i += 2) { CORE[i] = cs[i] * w * HEART_W + (cs[i + 1] * ch - HEART_UP) / h * lean; CORE[i + 1] = cs[i + 1] * ch; }
      pathPts(ctx, CORE, 1, ox, -HEART_UP, cn);
      emitterCore(ctx, rig, T.hi);
    }
    // the coal bed: the flame's bottom 2 rows, a bowl in its round bottom (clipped to the flame), and its specks
    ctx.fillStyle = T.sh; ctx.fillRect(-w, -2, 2 * w, 2);
    ctx.fillStyle = T.hi;
    const sp = COALS[FS.key];
    for (let i = 0; i < (FS.core ? 6 : 3); i += 3) {
      bedEnds(w, h, ox, sp[i + 2]);
      ctx.fillRect(sp[i] < 0 ? BED.a + sp[i + 1] : BED.b - 1 - sp[i + 1], -2 - sp[i + 2], 2, 2);
    }
    ctx.restore();
  } else if (FS.core && !FS.banked) {
    pathPts(ctx, PTS, FLAME[info.stage].core, 0, 0, n);
    emitterCore(ctx, rig, T.hi);
  } else if (FS.banked) {
    // the banked ember never goes out: a 2 x 2 of `glow` low in the bud on every sleeping frame, grown to the
    // core's shape on each inhale (lit only on the inhales, the glow.sh bud between them was a brown seed pod, a
    // cattail or an acorn, near the body's own value: the cast review)
    if (FS.pip) pathPts(ctx, PTS, Math.max(0.45, 2.4 / w), 0, 0, n);
    else { ctx.beginPath(); ctx.rect(-1, -3, 2, 2); }
    emitterCore(ctx, rig, info.pal.glow);
  }
  ctx.restore();
};

// ---------- rising particles: embers and steam (the top pass, 1.4 step 14) ----------

const EMB_AGES = new Float32Array(4), EMB_IDS = new Int32Array(4);
const SCR = { x: 0, y: 0 };
/** Steam: off-white with a 1 px `scale` ring (4.2 bath), so it reads on the straw floor and on a pale neighbour. */
const STEAM = DRAGON_SHARED.catchlight;

/**
 * Top-pass draw: one ember, a 2 x 2 core (c0: glow.hi) in a 1 px ring (c1: scale) on its four sides, corners open,
 * so it reads round. it.x, it.y = the core's top-left. A bare glow.hi pixel pair sits 4 % from the straw floor in
 * luminance and vanished in the habitat; the ring is the fire puff's own (5.4).
 */
function drawEmber(ctx: CanvasRenderingContext2D, it: TopItem): void {
  const s = it.sc, x = it.x, y = it.y;
  ctx.fillStyle = it.c1;
  ctx.fillRect(x - s, y, s, 2 * s); ctx.fillRect(x + 2 * s, y, s, 2 * s);
  ctx.fillRect(x, y - s, 2 * s, s); ctx.fillRect(x, y + 2 * s, 2 * s, s);
  ctx.fillStyle = it.c0; ctx.fillRect(x, y, 2 * s, 2 * s);
}

/**
 * Top-pass draws for one steam puff at (it.x, it.y), radius it.a sprite px: its 1 px ring (c1, radius + 1) and its
 * fill (c0). The ambient queues every puff's ring before any fill, all opaque, so overlapping puffs merge into one
 * cloud inside one ring (each puff ringed and alpha-faded on its own, overlaps showed as darker circles and the red
 * ring through the white blended to salmon: 5.1 #14 fades by shrinking, never alpha).
 */
function drawSteamRing(ctx: CanvasRenderingContext2D, it: TopItem): void {
  ctx.fillStyle = it.c1; ctx.beginPath(); ctx.arc(it.x, it.y, (it.a + 1) * it.sc, 0, Math.PI * 2); ctx.fill();
}
function drawSteamFill(ctx: CanvasRenderingContext2D, it: TopItem): void {
  ctx.fillStyle = it.c0; ctx.beginPath(); ctx.arc(it.x, it.y, it.a * it.sc, 0, Math.PI * 2); ctx.fill();
}

/** Screen position of the flame's top (SCR), for particles that leave it: upright on screen, like the flame. */
function flameTopScreen(rig: DragonRig): void {
  const J = rig.j, tn = J.tailN;
  rootToScreen(rig, J.tailX[tn], J.tailY[tn], SCR);
  SCR.y -= (flameBase(J.tailR[tn]) + FS.h * 0.85) * rig.pxScale;
}

/** Queue one ember at screen (x, y) + sprite-px offset (dx forward, dy), `f` = its life fraction (3 alpha steps). */
function pushEmber(rig: DragonRig, info: DragonInfo, x: number, y: number, dx: number, dy: number, f: number): void {
  const s = rig.pxScale;
  const it = rig.top!.push(drawEmber, x + Math.round(dx) * s * rig.facing - s, y + Math.round(dy) * s - s, s, rig.facing);
  if (it) { it.c0 = tones(rig, info.pal.glow).hi; it.c1 = info.pal.scale; it.alpha = stepAlpha(f); }
}

/** The bath's steam puff radius at life fraction f: it billows out, then fades by shrinking (baby capped at 3). */
function steamR(f: number, max: number): number { return f < 0.2 ? 2 : f < 0.5 ? max : f < 0.75 ? max - 1 : Math.max(1.5, max - 2); }

/**
 * Root space, drawing only into the top pass (rising particles, after every dragon):
 *   - the idle AMBIENT (3.2): an ember rises 10 px from the flame's top over 40 f, every 90 +- 30 f, swaying 1 px
 *     every 10 f, under the 5.4 caps. Only from a lit flame: never asleep (banked), begging (guttered), in the
 *     bath, or at a mood too low for the flame to keep its core. While it walks, an ember stays where it left the
 *     flame (it drifts back at the walk's speed), so a strutting Ember trails its sparks instead of towing them;
 *   - the HAPPY FLOURISH (4.3, cue 0): 3 embers burst out of the flared flame 2 f apart, starting 4 px apart (-4 /
 *     0 / +4) and fanning out 0.55 px/f apart, and arc over, 28 f each (launched from one spot they read as one
 *     clump or a chain for 10 f); the idle ember waits while they fly;
 *   - the BATH (4.2): 3 steam puffs hiss up off the shrunken flame (cue 4, 10, 16), rising 14 px over 30 f, r 2
 *     billowing to 4 (baby 3), then shrinking away; opaque, every ring queued before any fill (one cloud).
 * The flourish and the steam are act effects, not ambient, so they skip the ambient budget (like the eat crumbs).
 */
const ambient: ElementDraw = (ctx, rig, pose, info) => {
  if (!rig.top || rig.override) return;
  flameState(rig, pose, info);
  flameTopScreen(rig);
  const x0 = SCR.x, y0 = SCR.y, act = pose.act, c = pose.cue, s = rig.pxScale;
  if (act === ACT.happy && c >= 0 && c < 32) {
    // (the flourish stands in for the idle ember while it flies: an idle ember among the three read as a clump)
    for (let i = 0; i < 3; i++) {
      const age = c - i * 2;
      if (age < 0 || age >= 28) continue;
      const vx = (i - 1) * 0.55 + (hash01(info.seed + 3, i) - 0.5) * 0.2, vy = -(1 + 0.25 * hash01(info.seed + 5, i));
      pushEmber(rig, info, x0, y0, (i - 1) * 4 + vx * age, vy * age + 0.012 * age * age, age / 28);
    }
    return;
  }
  if (act === ACT.bath) {
    const max = info.stage === 'baby' ? 3 : 4;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < 3; i++) {
        const age = c - Math.round((4 + i * 6) * BATH_K[info.stage]);
        if (age < 0 || age >= 30) continue;
        const f = age / 30, sway = (Math.floor(age / 8) % 2 ? 1 : -1) * (i % 2 ? 1 : -1);
        const it = rig.top.push(pass ? drawSteamFill : drawSteamRing, x0 + (sway + (i - 1) * 2) * s * rig.facing, y0 - Math.round(age * 14 / 30) * s, s, rig.facing);
        if (it) { it.a = steamR(f, max); it.c0 = STEAM; it.c1 = info.pal.scale; }
      }
    }
    return;
  }
  if (info.asleep || act === ACT.beg || !FS.core) return;
  const n = liveSpawns(info.seed, info.tick, 90 * rig.budget.stretch, 30, 40, EMB_AGES, EMB_IDS);
  const allowed = rig.budget.take(rig.slot, n);
  const drift = act === ACT.walk ? rig.tune.walk.speed : 0;
  for (let i = 0; i < allowed; i++) {
    const age = EMB_AGES[i], id = EMB_IDS[i], fr = age / 40;
    const sway = (Math.floor(age / 10) + id) % 2 ? 1 : 0;
    pushEmber(rig, info, x0, y0, (id % 3 - 1) * 2 + sway - age * drift, -Math.round(fr * 10), fr);
  }
};

// ---------- the breath anchor: fire breath, the tell, the sighs, the hiss ----------

/**
 * Jet puff radii by age step (3 f each): adult 3, 4, 5, 6, 6, 5 (3.2) and the smoke step's 4; young max r 4. The
 * colour steps down with the same age (breath): hot to step 2, orange to 4, red at 5, smoke at 6.
 */
const PUFF_R: Readonly<Record<Stage, readonly number[]>> = {
  baby: [2, 3, 3, 3, 3, 3, 3], young: [2, 3, 4, 4, 4, 3, 3], adult: [3, 4, 5, 6, 6, 5, 4], elder: [3, 4, 5, 6, 6, 5, 4],
};
/**
 * The jet per stage: puffs, frames between them, how many of the last are all smoke, and its speed (px/f). Adult
 * 10 every 3 f at 5 px spacing, the last two smoke (3.2); young 3 fire puffs at 3 px spacing and then 2 of smoke:
 * one short lick that breaks up and sputters out; the elder the adult's jet at 1.1x reach (4.2: 5.5 px apart) over
 * its longer sustain, 11 puffs, all fire: its one smoke is the finale's ring (smokeRing), the last puff out.
 */
const STREAM: Readonly<Record<Stage, { n: number; every: number; smoke: number; v: number }>> = {
  baby: { n: 1, every: 3, smoke: 0, v: 1 }, young: { n: 5, every: 3, smoke: 2, v: 1 }, adult: { n: 10, every: 3, smoke: 2, v: 5 / 3 },
  elder: { n: 11, every: 3, smoke: 0, v: 5.5 / 3 },
};
/** The breath wind-up per stage, frames (anims.ts breathAnim): the tell's puffs are timed inside it. */
const WINDUP: Readonly<Record<Stage, number>> = { baby: 10, young: 14, adult: 18, elder: 22 };
/**
 * The elder's FINALE (4.2): the cue its smoke ring leaves the mouth at, the ring's life and the clock its drift is
 * timed on, frames. anims.ts elderBreath ends the stream at its e0, f 60 (the wind-up 22, the snap 6 and the sustain
 * 32 of breathAnim's elder row), and plays the finale over f 60-72, the jaw easing from 28 to 16 deg and held there
 * (the ring is blown through it) and shut at f 72. The breath's cue runs from the snap's first frame, f 22 (the
 * wind-up, WINDUP), so the finale is cue 38-50 (anims.ts ELDER_FINALE). The ring lives on 6 f into the recover,
 * where the old dragon watches it go, `happy`, and is gone at cue 56, before the breath ends (cue 62).
 */
const FINALE_AT = ELDER_FINALE.at, RING_LIFE = 18, RING_DRIFT = 20;
/**
 * A jet puff's life: 6 fire steps and a smoke step, 3 f each. The elder's burns all 7 steps, its last in the red
 * rim alone (r 4), so no smoke of the jet's shares the air with the finale's ring: the ring is its smoke.
 */
const PUFF_LIFE = 21, FIRE_LIFE = 18;

/** The breath stream's frame of reference, in ROOT space (streamFrame): its origin and unit direction. */
const SF = { x: 0, y: 0, dx: 1, dy: 0 };

/**
 * Where the stream comes from, in root space, with the head's own keyed rotation (pose.head.rot) taken out: the
 * mouth turned back about the cranium by it, aimed along the neck-carried snout (never more than 10 deg below
 * level, as the rig aims it). The sustain's 1 px head jitter and the recover's head settle then no longer drag the
 * puffs already in the air: they have left the head's motion behind, and only the neck's slower thrust moves them.
 */
function streamFrame(rig: DragonRig, pose: DragonPose): void {
  const J = rig.j, hr = -pose.head.rot * D2R, c = Math.cos(hr), s = Math.sin(hr);
  const mx = J.mouth.x - J.cran.x, my = J.mouth.y - J.cran.y;
  SF.x = J.cran.x + mx * c - my * s; SF.y = J.cran.y + mx * s + my * c;
  const a = Math.min(J.headAng - pose.head.rot, 10) * D2R;
  SF.dx = Math.cos(a); SF.dy = Math.sin(a);
}

/**
 * Where jet puff k is at `age` frames, root space, into P: out along the stream at `v` px/f (0.65 of it once past
 * age 9, as the jet slows), rising 0.15 px/f and then 0.45 px/f past age 9, so the jet's end curls up; and once
 * clear of the mouth (age >= 3) stepped a pixel to either side of the line every 3 f (seeded per puff), so it
 * licks and wavers instead of running as a ruled tube.
 */
const P = { x: 0, y: 0 };
function puffAt(age: number, k: number, seed: number, v: number): void {
  const d = 3 + (age <= 9 ? age * v : 9 * v + (age - 9) * v * 0.65), rise = age <= 9 ? age * 0.15 : 1.35 + (age - 9) * 0.45;
  const h = age < 3 ? 0.5 : hash01(seed + k, Math.floor(age / 3)), j = h < 0.3 ? -1 : h > 0.7 ? 1 : 0;
  P.x = Math.round(SF.x + SF.dx * d - SF.dy * j); P.y = Math.round(SF.y + SF.dy * d + SF.dx * j - rise);
}
/** The upward curl of a jet puff's heading at `age`, radians (the leading tongue turns up with it). */
function curlAt(age: number): number { return age <= 9 ? 0 : Math.min(45, (age - 9) * 5) * D2R; }

/**
 * Smoke: a flat puff of `catchlight`'s shadow tone, a cool pale grey, in a 1 px `horn` ring, opaque, fading by
 * shrinking (5.1 #14). Drawn in two passes (0: the ring, the puff 1 px larger; 1: the fill) over a whole group,
 * so a group's puffs merge into one cloud in one ring: alpha-faded horn discs read as pink bubbles, and each
 * overlap as a darker circle.
 */
function smokeDisc(ctx: CanvasRenderingContext2D, rig: DragonRig, info: DragonInfo, x: number, y: number, r: number, pass: number): void {
  if (pass) disc(ctx, rig, x, y, r, tones(rig, STEAM).sh);
  else disc(ctx, rig, x, y, r + 1, info.pal.horn);
}

/** A smoke puff's radius at `age` of `life`: it swells from 1.5 to r, then shrinks a step, and a step again. */
function smokeR(age: number, life: number, r: number): number {
  return age < 3 ? 1.5 : age < life * 0.6 ? r : age < life * 0.8 ? r - 1 : Math.max(1, r - 1.5);
}

/**
 * Smoke from the nostril, mouth space (+x out along the snout; the nostril sits about (-1, -4) from the closed
 * mouth's anchor), leaving up and forward, away from the eye behind it (the rig also clips this anchor off the eye
 * box). `age` frames old, `life` long, up to radius `r`; one pass of smokeDisc.
 */
function nostrilSmoke(ctx: CanvasRenderingContext2D, rig: DragonRig, info: DragonInfo, age: number, life: number, r: number, fwd: number, pass: number): void {
  if (age < 0 || age >= life) return;
  const a = info.ang * D2R, upx = -Math.sin(a), upy = -Math.cos(a);
  const dist = 1.5 + age * 0.6;
  smokeDisc(ctx, rig, info, Math.round(-1 + (fwd + upx) * dist * 0.7), Math.round(-4 + upy * dist * 0.7), smokeR(age, life, r), pass);
}

/**
 * The signature: FIRE BREATH (3.2). Mouth space on entry; the jet is drawn in root space (streamFrame).
 *   TELL (cue < 0): 2 nostril smoke puffs (r 2), timed inside the stage's wind-up;
 *   JET (adult): one puff every 3 f for 30 f, 5 px apart, flat and un-inked, each GRADED BY ITS AGE: a `scale`
 *     outer disc (it keeps the jet readable on any floor), a `glow` middle (3/4 of it) to age step 4 and a
 *     `glow.hi` core (1/2) to step 2, so the jet runs hot at the mouth, orange, then red at its end; radii 3, 4, 5,
 *     6, 6, 5; at step 6 each puff is smoke. The layers are drawn a layer at a time across all the puffs (every
 *     outer disc, then every middle, then every core), each run on unbroken from puff to puff, so the jet billows
 *     as one flame in a red rim with one hot streak down its middle, not a string of ringed coins or beads. The
 *     LEADING fire puff is a flame tongue (SHAPES[0], along the jet, swapping on 3 f keys), so the jet ends in a
 *     point, not a blunt bead; the jet slows and rises past age 9, so its end curls up. The last two puffs are all
 *     smoke;
 *   YOUNG: 3 fire puffs 3 px apart (max r 4) and the same leading tongue: one short lick that breaks up, then 2
 *     smoke puffs (half strength, still learning);
 *   ELDER: the adult's jet at 1.1x reach, 11 puffs, all fire to its end (step 6 in the red rim alone), then the
 *     FINALE's one smoke ring (smokeRing);
 *   BABY: the HICCUP (hiccup, below), and the anim goes `dazed` ("did I do that?").
 * The same anchor draws two other things out of the nostrils and mouth:
 *   BEG (4.3 hungry tell): a sigh of 2 smoke puffs (r 3) from the nostril on each of the loop's two sighs;
 *   BATH (4.2): the hiss, 2 small steam wisps from the half-open mouth while it pulls back from the water.
 */
const breath: ElementDraw = (ctx, rig, pose, info) => {
  if (rig.override) return;
  const act = pose.act, c = pose.cue, st = info.stage;
  if (act === ACT.beg) {
    for (let pass = 0; pass < 2; pass++) {
      for (let s = 0; s < 2; s++) for (let k = 0; k < 2; k++) nostrilSmoke(ctx, rig, info, c - SIGH_AT[s] - Math.round((8 + k * 4) * SIGH_Q[st]), 20, 3, 0.4, pass);
    }
    return;
  }
  if (act === ACT.bath) {
    const a = info.ang * D2R, upx = -Math.sin(a), upy = -Math.cos(a);
    for (let pass = 0; pass < 2; pass++) {
      for (let k = 0; k < 2; k++) {
        const age = c - Math.round((6 + k * 7) * BATH_K[st]);
        if (age < 0 || age >= 14) continue;
        // a steam wisp in its 1 px scale ring, shrinking a step (r 1.5 -> 1: never under the 2 px mark floor)
        const d = 2 + age * 0.5, x = Math.round(1 + d * 0.6 + upx * d), y = Math.round(upy * d), r = age < 7 ? 1.5 : 1;
        disc(ctx, rig, x, y, pass ? r : r + 1, pass ? STEAM : info.pal.scale);
      }
    }
    return;
  }
  if (act !== ACT.breath) return;
  if (c < 0) {
    const w = WINDUP[st];
    for (let pass = 0; pass < 2; pass++) {
      for (let k = 0; k < 2; k++) nostrilSmoke(ctx, rig, info, c + w - 2 - k * Math.round(w * 0.35), 9, 2, 1, pass);
    }
    return;
  }
  ctx.save();
  mouthToRoot(ctx, rig, info.ang);
  streamFrame(rig, pose);
  if (st === 'baby') { hiccup(ctx, rig, info, c); ctx.restore(); return; }
  const S = STREAM[st], R = PUFF_R[st], fire = S.n - S.smoke, seed = info.seed, fl = st === 'elder' ? PUFF_LIFE : FIRE_LIFE;
  // smoke first (it trails the fire, behind it): the all-smoke puffs and every fire puff's last step (the elder's
  // burns that step too: fl)
  for (let pass = 0; pass < 2; pass++) {
    for (let k = 0; k < S.n; k++) {
      const age = c - k * S.every;
      if (age < 0 || age >= PUFF_LIFE || (k < fire && age < fl)) continue;
      puffAt(age, k, seed, S.v);
      smokeDisc(ctx, rig, info, P.x, P.y, k < fire ? R[6] : smokeR(age, PUFF_LIFE, R[Math.min(6, Math.floor(age / 3))]), pass);
    }
  }
  // the leading fire puff (the oldest still burning) is the tongue
  let lead = -1;
  for (let k = 0; k < fire && lead < 0; k++) { const age = c - k * S.every; if (age >= 0 && age < fl) lead = k; }
  const T = tones(rig, info.pal.glow);
  for (let layer = 0; layer < 3; layer++) {
    const hex = layer === 0 ? info.pal.scale : layer === 1 ? info.pal.glow : T.hi, kr = layer === 0 ? 1 : layer === 1 ? 0.75 : 0.5;
    let px = 0, py = 0, pr = -1;
    for (let k = 0; k < fire; k++) {
      const age = c - k * S.every, step = Math.floor(age / 3);
      if (age < 0 || age >= fl || (layer === 1 && step > 4) || (layer === 2 && step > 2)) { pr = -1; continue; }
      puffAt(age, k, seed, S.v);
      const r = layer === 2 ? Math.max(1, R[step] * kr) : R[step] * kr;
      // each layer runs on unbroken from the puff before (a stroke as wide as the smaller of the two), so the hot
      // core is one streak from the mouth and the jet one tongue, not a string of beads
      if (pr > 0) {
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(P.x, P.y);
        ctx.lineWidth = 2 * Math.min(pr, r); ctx.lineCap = 'round'; ctx.strokeStyle = rig.col(hex); ctx.stroke();
      }
      if (k === lead && layer < 2) jetTongue(ctx, rig, R[step], age, layer ? 0.72 : 1, hex, c + seed);
      else disc(ctx, rig, P.x, P.y, r, hex);
      px = P.x; py = P.y; pr = r;
    }
  }
  if (st === 'elder') smokeRing(ctx, rig, info, c - FINALE_AT);
  ctx.restore();
};

/**
 * Fill the elliptical ring between radii (rx1, ry1) and (rx0, ry0) about (x, y) in `hex` (through rig.col), the middle
 * left open (rx0 0: filled): the finale ring's band and its ink.
 */
function annulus(ctx: CanvasRenderingContext2D, rig: DragonRig, x: number, y: number, rx1: number, ry1: number, rx0: number, ry0: number, hex: string): void {
  ctx.beginPath(); ctx.ellipse(x, y, rx1, ry1, 0, 0, Math.PI * 2);
  if (rx0 > 0) ctx.ellipse(x, y, rx0, ry0, 0, 0, Math.PI * 2, true);
  ctx.fillStyle = rig.col(hex); ctx.fill('evenodd');
}

/**
 * The elder's breath FINALE (4.2, required: 2.6's "ends in one ring", the last grow-up's reward), root space in the
 * stream's frame, `a` frames after the jet ends (FINALE_AT): one SMOKE RING, blown slow and wise through the jaw
 * easing shut. The last puff out of the mouth (the jet before it all fire, so it is the one smoke in the air) leaves
 * as a puff (r 2, 2 f), opens into a ring and widens as it drifts out and up, slowing, curling up as the jet's end
 * does: a band of fire's smoke 2 px thick (the catchlight's shadow tone, opaque) between two 1 px `horn` lines, its
 * floor-safe colours (5.4), round a hole of the room (R 4, 5, 6 at 2 / 5 / 10 f; the hole 2, 4 and 6 px across).
 * From 16 f it goes as a smoke ring does, spreading flat until its hole is a slit (7 x 4), and is gone at 18 f (5.1
 * #14: smoke fades by shrinking, never by alpha). (Broken into four wisps on the ring, it read as four bubbles, a
 * die's face; ended as a flat 5 x 2 wisp in its ink, it read as a pill.)
 */
function smokeRing(ctx: CanvasRenderingContext2D, rig: DragonRig, info: DragonInfo, a: number): void {
  if (a < 0 || a >= RING_LIFE) return;
  const u = a / RING_DRIFT, d = 5 + 11 * (1 - (1 - u) * (1 - u)), rise = 3 * u + 7 * u * u;
  const x = Math.round(SF.x + SF.dx * d), y = Math.round(SF.y + SF.dy * d - rise);
  const smoke = tones(rig, STEAM).sh, ink = info.pal.horn;
  if (a < 2) { for (let pass = 0; pass < 2; pass++) smokeDisc(ctx, rig, info, x, y, 2, pass); return; }
  const R = a < 5 ? 4 : a < 10 ? 5 : 6;
  // its size (rx, ry) and hole (hx, hy), the ink inside the band (ix, iy): round, then spread flat as it goes
  const rx = a < 16 ? R : 7, ry = a < 16 ? R : 4, hx = rx - 2, hy = ry - 2, ix = hx - 1, iy = hy - 1;
  annulus(ctx, rig, x, y, rx + 1, ry + 1, ix, iy, ink);
  annulus(ctx, rig, x, y, rx, ry, hx, hy, smoke);
}

/**
 * The jet's leading puff as a flame tongue (root space, at P): SHAPES[0] 2r wide and 2.4r long, its base 0.8r
 * behind the puff's centre, pointing along the jet and curling up with its age. `k` < 1 is its `glow` inside,
 * scaled about the tongue's widest part (40 % up it), so a `scale` rim runs all round it as round a puff. Its
 * flicker key swaps every 3 f.
 */
function jetTongue(ctx: CanvasRenderingContext2D, rig: DragonRig, r: number, age: number, k: number, hex: string, clock: number): void {
  const a = Math.atan2(SF.dy, SF.dx) - curlAt(age), ux = Math.cos(a), uy = Math.sin(a);
  const shape = SHAPES[0][((Math.floor(clock / 3) % 3) + 3) % 3], n = shape.length, w = 2 * r, l = 2.4 * r;
  for (let i = 0; i < n; i += 2) { PTS[i] = shape[i] * w; PTS[i + 1] = shape[i + 1] * l; }
  ctx.save();
  ctx.translate(P.x - ux * r * 0.8, P.y - uy * r * 0.8);
  ctx.rotate(Math.atan2(ux, -uy));
  pathPts(ctx, PTS, k, 0, -(1 - k) * 0.4 * l, n);
  emitterFill(ctx, rig, hex, false);
  ctx.restore();
}

/**
 * The baby's fizzle (3.2, D17), root space in the stream's frame: a HICCUP. It holds its breath puffed up round
 * (tuning.breath.puff 1.10) until a puff (the three fire discs) pops out of its mouth, r 2 at 3 px, then r 3.5
 * hopping out to 6 px and up a pixel ("hic!"); at cue 6 it POPS: a hollow ring of `glow` in its `scale` rim
 * bursts out to r 4 and r 5 over 2 f, a smoke cloud (smokeDisc: a puff and two lobes) swells r 3 -> 4 where it
 * was and shrinks away drifting up, and 2 embers (glow.hi in their scale ring) hop out of it, one on forward, one
 * back up over its own snout, falling as they fade (the rig's eye clip keeps them off the eye). All over by cue 28,
 * as the dazed stars circle.
 */
function hiccup(ctx: CanvasRenderingContext2D, rig: DragonRig, info: DragonInfo, c: number): void {
  const T = tones(rig, info.pal.glow), out = c < 2 ? 3 : 6;
  const px = Math.round(SF.x + SF.dx * out), py = Math.round(SF.y + SF.dy * out - (c < 2 ? 0 : 1));
  if (c < 6) {
    const r = c < 2 ? 2 : 3.5;
    disc(ctx, rig, px, py, r, info.pal.scale); disc(ctx, rig, px, py, r * 0.75, info.pal.glow); disc(ctx, rig, px, py, Math.max(1, r * 0.5), T.hi);
    return;
  }
  const age = c - 6;
  if (age < 16) {
    // a cloud: the puff and two lobes low at its sides, every ring before any fill
    const r = age < 3 ? 3 : age < 8 ? 4 : age < 12 ? 3 : 2, y = py - Math.round(age * 0.4), o = Math.round(r * 0.8);
    for (let pass = 0; pass < 2; pass++) {
      smokeDisc(ctx, rig, info, px, y - 1, r, pass);
      if (r > 2) { smokeDisc(ctx, rig, info, px - o, y + 1, r - 1, pass); smokeDisc(ctx, rig, info, px + o, y + 1, r - 1, pass); }
    }
  }
  if (age < 2) {
    // the pop: a 2 px ring of glow in a 1 px scale rim, hollow (even-odd), r 4 then 5
    const r = 4 + age;
    ctx.beginPath(); ctx.arc(px, py, r + 1, 0, Math.PI * 2); ctx.arc(px, py, r - 2, 0, Math.PI * 2, true);
    ctx.fillStyle = rig.col(info.pal.scale); ctx.fill('evenodd');
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.arc(px, py, r - 2, 0, Math.PI * 2, true);
    ctx.fillStyle = rig.col(info.pal.glow); ctx.fill('evenodd');
  }
  for (let k = 0; k < 2; k++) {
    const a = age - k * 2;
    if (a < 0 || a >= 20) continue;
    const vx = k ? -0.3 : 0.55, vy = k ? -1.3 : -1.1;
    const x = Math.round(px + vx * a), y = Math.round(py + vy * a + 0.05 * a * a);
    ctx.save(); ctx.globalAlpha *= stepAlpha(a / 20);
    ctx.fillStyle = rig.col(info.pal.scale);
    ctx.fillRect(x - 2, y - 1, 1, 2); ctx.fillRect(x + 1, y - 1, 1, 2); ctx.fillRect(x - 1, y - 2, 2, 1); ctx.fillRect(x - 1, y + 1, 2, 1);
    ctx.fillStyle = rig.col(T.hi); ctx.fillRect(x - 1, y - 1, 2, 2);
    ctx.restore();
  }
}

// ---------- anims (4.3): the strut, the sigh, the rekindle, the bath, the tail chase ----------

/** Walk a baked anim's frames with their start times, so a track can be laid over a shared builder's output. */
function eachFrame(a: DragonAnim, fn: (t: number, p: PartialDragonPose, f: DragonFrame) => void): DragonAnim {
  let t = 0;
  for (const f of a.frames) {
    if (!f.pose) f.pose = {};
    fn(t, f.pose, f);
    t += f.dur || 1;
  }
  return a;
}

/**
 * WALK (4.3): the show-off STRUT. The shared gait with fire's tuning (paw lift 5, head up 4: below), carried
 * proud: the chest up 2 deg and the torch held up (tail lift -6, young -5), so the flame rides high over the
 * hips while it walks (its tongues swap every 4 f then: flameState). The baby keeps its waddle; its comma tail
 * already carries the seed.
 */
function strutAnim(stage: Stage, dims: DragonDims | null): DragonAnim {
  const a = walkAnim(stage, animTuning(stage, FIRE).walk, dims);
  if (stage === 'baby') return a;
  const lift = grown(stage) ? -6 : -5;
  return eachFrame(a, (_t, p) => {
    const b = (p.body ??= {}), tl = (p.tail ??= {});
    b.rot = (b.rot ?? 0) - 2;
    tl.lift = (tl.lift ?? 0) + lift;
  });
}

/** The two sighs of the 120 f beg loop, cue frames: clear of the stomach growl at f 80-88. */
const SIGH_AT: readonly number[] = [22, 92];
/**
 * How much slower each sigh is drawn out, per stage: the elder's beg loop runs 140 f (4.2), so its sighs take
 * 140 / 120 as long (35 f), at the same two spots, still clear of the growl (f 80-88) and of the loop's end.
 */
const SIGH_Q: Readonly<Record<Stage, number>> = { baby: 1, young: 1, adult: 1, elder: 140 / 120 };

/**
 * BEG (4.3 hungry tell): the shared sit-and-plead loop, with the torch held up and two SIGHS laid over it. Sitting,
 * the shared beg's drooped tail (+6) laid the guttered flame out at the tail's far end at belly height and fire
 * lost its U: the young and adult lift it back (lift -12, curl -9 a segment), so the small flame stands behind the
 * sitting rump, over the hips (the baby's comma already carries it). Each sigh is a breath in (the chest up
 * 0.5 px, the head up 2), then a long breath out: the body sinks 1 px, the head droops 5 deg and 2 smoke puffs
 * leave the nostrils (breath, above), then it lifts its head to plead again. The flame gutters to 0.6x
 * (flameState). A breath out through the nose is how a fire dragon sighs. The elder sighs slower (SIGH_Q) through its
 * 140 f loop, the guttered hearth keeping its coals.
 */
function sighAnim(stage: Stage): DragonAnim {
  const a = begAnim(stage, animTuning(stage, FIRE)), baby = stage === 'baby', q = SIGH_Q[stage];
  const sigh = (t: number): number => {
    for (const s of SIGH_AT) {
      const u = (t - s) / q;
      if (u < 0 || u >= 30) continue;
      // in 0-6 (-0.5), out 6-16 (to +1), held to 22, back by 30
      return u < 6 ? -0.5 * u / 6 : u < 16 ? -0.5 + 1.5 * (u - 6) / 10 : u < 22 ? 1 : 1 - (u - 22) / 8;
    }
    return 0;
  };
  return eachFrame(a, (t, p) => {
    if (!baby) { const tl = (p.tail ??= {}); tl.lift = (tl.lift ?? 0) - 12; tl.curl = (tl.curl ?? 0) - 9; }
    const v = sigh(t);
    if (!v) return;
    const b = (p.body ??= {}), hd = (p.head ??= {});
    b.y = (b.y ?? 0) + (baby ? 0.7 : 1) * v;
    hd.rot = (hd.rot ?? 0) + (v > 0 ? 5 : 4) * v;
  });
}

/**
 * WAKE (4.3): the shared wake, with the REKINDLE marked on it: pose.fx (the element's effect envelope) is 1 for the
 * 10 f from the first frame whose `sleep` is off -- the eyes opening -- and the flame flares to 1.2x on 3 f swaps
 * while it is (flameState). Read off the shared anim, so it follows its timing wherever that moves.
 */
function rekindleAnim(stage: Stage, dims: DragonDims | null): DragonAnim {
  const a = wakeAnim(stage, dims, animTuning(stage, FIRE));
  let open = -1;
  eachFrame(a, (t, p) => { if (open < 0 && (p.sleep ?? 0) < 0.5) open = t; });
  return eachFrame(a, (t, p) => { p.fx = open >= 0 && t >= open && t < open + 10 ? 1 : 0; });
}

/**
 * BATH (4.2, fire's one-shot, 60 f at every stage, the stage's own squash range): fire hates baths. It flinches
 * and HISSES (jaw 10 deg -- the rig opens it to the stage minimum -- `grumpy`, head pulled back, a hunch) while
 * its flame shrinks to 0.6x (mood -2 pins the gauge at -1) and sputters, 3 steam puffs coming off it (ambient)
 * and 2 hiss wisps from its mouth (breath); then a dog-style SHAKE (root rot +-5 on 3 f beats, the head against
 * it, eyes shut, the tail stiff) and a grumpy settle. act = ACT.bath, cue = frames since it began. The elder's is
 * the same at its own timing (4.2): 75 f, the shake +-4 on ~4 f beats, a shake, never a tremor (D21).
 */
function bathAnim(stage: Stage): DragonAnim {
  const k = BATH_K[stage], g = stage === 'elder' ? 0.8 : 1, L = Math.round(60 * k), G = DFACE.grumpy, N = DFACE.neutral;
  const s = (keys: Key[]) => stretchKeys(keys, k);
  const rot: Key[] = [[0, 0], [26, 0]], hd: Key[] = [[0, 0], [6, -8], [22, -8], [26, 0]];
  for (let f = 28, i = 0; f < 50; f += 3, i++) { rot.push([f, (i % 2 ? -5 : 5) * g]); hd.push([f + 1, (i % 2 ? 8 : -8) * g]); }
  rot.push([52, 0]); hd.push([53, 0], [60, 0]);
  return bake({
    'root.rot': s(rot), 'head.rot': s(hd),
    'neck.a0': s([[0, 0], [6, -8], [22, -8], [28, 0]]),
    'body.y': s([[0, 0], [4, 1], [22, 1], [26, 0]]),
    squash: s([[0, 1], [4, 0.96], [22, 0.96], [26, 1], [28, 1.03], [50, 1.03], [54, 1]]),
    jaw: s([[0, 0], [5, 0], [6, 10], [22, 10], [23, 0]]),
    'tail.stiff': s([[0, 0], [4, 0.5], [50, 0.5], [60, 0]]),
    face: s([[0, N], [3, G], [26, DFACE.closed], [50, G], [58, N]]),
    mood: s([[0, 0], [3, -2], [56, -2], [60, 0]]),
    act: [[0, ACT.bath]], cue: [[0, 0], [L, L]],
  }, { stage, len: L, next: 'idle' });
}
/**
 * The bath's length per stage over its 60 f (3.2: 60 f at every stage; 4.2's elder column: the same at the elder's
 * timing, x 1.25, 75 f, its shake at 0.8x). The flame's sputter reads the bath's clock through bathClock; the steam
 * and the hiss start on its beats scaled by it.
 */
const BATH_K: Readonly<Record<Stage, number>> = { baby: 1, young: 1, adult: 1, elder: STAGE_TIMING.elder.dur };
/** The bath's clock on its 60 f timeline (the steam, the hiss and the sputter are timed on it). */
function bathClock(stage: Stage, cue: number): number { return cue / BATH_K[stage]; }

/**
 * The head's world pitch (deg, + = snout down) that stands the rig's nostril plumb over the eye (rig.ts
 * drawHeadGroup's nostril spot, in cranium space). The face marks are pixel constructions placed by their
 * root-space offset from the eye: they mirror with a mirrored sprite (rig.ts faceTransform), but are never
 * squashed, so on a turn's 80 % and 60 % frames a nostril ahead of the eye would land off the narrowed snout.
 * Plumb over the eye its offset has no sideways part and it lands on the snout at any width. Adult -100, young -92,
 * baby -88.
 */
function plumbPitch(d: DragonDims | null, stage: Stage): number {
  if (!d) return grown(stage) ? -100 : stage === 'young' ? -92 : -88;
  const H = d.head, sn = H.snout, ringR = H.eye.w - 1 - (H.eye.w >> 1);
  const ax = Math.max(sn.x1 + sn.r1 * 0.1 - 1, H.eye.x + ringR + 4) - H.eye.x, ay = sn.y1 - sn.r1 * 0.55 - H.eye.y;
  return Math.atan2(ax, ay) / D2R - 180;
}

/**
 * The tail chase's look back, per stage: the head's world pitch (deg; past -90 the snout points up and BACK) that
 * puts the snout on the flame the curled tail holds up behind it, and the neck's arch (a0, a1) that carries the head
 * back toward it. The baby's neck is one hidden segment.
 */
const CHASE: Readonly<Record<Stage, { aim: number; a0: number; a1: number }>> = {
  baby: { aim: -140, a0: -24, a1: 0 }, young: { aim: -145, a0: -30, a1: -30 }, adult: { aim: -150, a0: -30, a1: -30 },
  elder: { aim: -150, a0: -30, a1: -30 },
};
/** A paper turn's width on the frame either side of its flip (60 %) and the frame beyond that (80 %). */
const TURN_NARROW = 0.6, TURN_EASE = 0.8;

/**
 * The idle FIDGET (3.2): it chases its own tail flame. It NOTICES the flame (the tail curls up and forward over the
 * back, the flame flares on mood +2): the neck arches back (a0 / a1 -30) and the head pitches up and back past
 * vertical until its snout is at the flame (CHASE: adult -150 deg, young -145, baby -140). It crouches, then CHASES
 * it: four half-turns in place, accelerating, each one a hop, its eyes squeezed shut. In profile a turn in place is
 * a mirror flip, so each half-turn is a paper turn -- the sprite narrows to 80 % and 60 % over 2 f, flips, and
 * opens out over 2 f facing the other way -- the flame always just behind it. Then it stops, dizzy (`dazed`, the
 * stars circling, a wobble), shakes it off, pleased with itself (`happy`). Adult 72 f, young 61, baby 43.
 * The ELDER (4.2: x 1.3 and 0.8x, FIDGET_TIMING; D21) plays it as a gentle game: 2 half-turns, not 4, at the chase's
 * first and third beats, with no hops (its paws stay planted) and its eyes `happy`, the tail's lift and curl at 0.8x;
 * it stops content, never dizzy (no `dazed`, no stars, no wobble: a confused old dragon is banned, VC14). 94 f. Its
 * look back keeps the whole aim, the snout on the flame, since that is the reach the chase needs (4.1: the elder's
 * 0.8x is on the gestures, never on such a reach): at 0.8x (-120) it stared up at the sky past its flame.
 * The turns are laid over the baked tracks (bake clamps squash to the stage's range): a turn frame keys its own
 * stretch (the volume-preserving 1 / |squash| would stretch a 60 % sprite to 1.7x its height). The face marks
 * mirror with the sprite but are never squashed (rig.ts faceTransform), so on each turn's narrow frames the head
 * holds plumbPitch, where they land true (snout up, the flame at its side); wide again, whichever way it faces, it
 * aims back at the flame.
 */
function fidget(stage: Stage, dims: DragonDims | null): DragonAnim {
  const FT = FIDGET_TIMING[stage], k = FT.dur, g = FT.amp, t = (f: number) => Math.round(f * k), L = t(72);
  const baby = stage === 'baby', elder = stage === 'elder';
  const flips = elder ? [t(18), t(37)] : [t(18), t(28), t(37), t(44)], hh = Math.max(2, Math.round(3 * k));
  const hops: Key[] = [[0, 0]], lifts: Key[] = [[0, 0]];
  // (the elder turns with its paws on the floor: no hop)
  if (!elder) for (const a of flips) {
    hops.push([a - hh, 0, 'out'], [a, -3, 'in'], [a + hh, 0]);
    lifts.push([a - hh, 0], [a, 2], [a + hh, 0]);
  }
  const look = t(12), stop = t(50), done = t(64), C = CHASE[stage];
  const pitch = dims ? dims.neck.headPitch : grown(stage) ? (elder ? 0 : 10) : stage === 'young' ? 4 : 0;
  // head.rot is on top of the neck's arch and the head's rest pitch (rig.ts: headAng); the body stays level
  const off = pitch + C.a0 + (baby ? 0 : C.a1), aim = C.aim - off, plumb = plumbPitch(dims, stage) - off;
  const curl = (baby ? -10 : -18) * g, lift = -30 * g;
  const N = DFACE.neutral, face: Key[] = elder
    ? [[0, N], [flips[0] - 2, DFACE.happy], [L - 2, N]]
    : [[0, N], [flips[0] - 2, DFACE.closed], [stop, DFACE.dazed], [done, DFACE.happy], [L - 2, N]];
  const tracks: Tracks = {
    'tail.lift': [[0, 0], [look, lift], [stop, lift], [done, 0]],
    'tail.curl': [[0, 0], [look, curl], [stop, curl], [done, 0]],
    'tail.stiff': [[0, 0], [t(8), 1], [stop + t(4), 1], [L, 0]],
    'neck.a0': [[0, 0], [look, C.a0], [stop, C.a0], [done, 0]],
    'neck.a1': [[0, 0], [look, C.a1], [stop, C.a1], [done, 0]],
    'head.rot': [[0, 0], [look, aim], [stop, aim], [stop + t(4), -10 * g], [done, 0]],
    'body.y': [[0, 0], [look, 0], [t(16), 1], [flips[0], 0]],
    squash: [[0, 1], [look, 1], [t(16), 0.97], [flips[0], 1]],
    'root.y': hops,
    'legNH.lift': lifts, 'legNF.lift': lifts, 'legFH.lift': lifts, 'legFF.lift': lifts,
    // dizzy: a wobble about the ground point once it stops (never the elder's: it stops content)
    'root.rot': elder ? [[0, 0]] : [[0, 0], [stop, 0], [stop + t(3), 4], [stop + t(7), -4], [stop + t(11), 3], [done, 0]],
    face,
    mood: [[0, 0], [t(6), 2], [stop, 2], [L, 0]],
    act: [[0, ACT.fidget]], cue: [[0, 0], [L, L]],
  };
  const a = bake(tracks, { stage, len: L, next: 'idle', res: 1 });
  // facing right until the first flip, then each one mirrors the sprite (4 in all, the elder's 2: it ends facing right)
  const side = (tt: number): number => { let s = 1; for (const f of flips) if (tt >= f) s = -s; return s; };
  // the turn's width by frames from its flip (the flip frame f is the first mirrored one): 0 = not turning
  const turn = (tt: number): number => {
    for (const f of flips) { const d = tt < f ? f - 1 - tt : tt - f; if (d <= 1) return d ? TURN_EASE : TURN_NARROW; }
    return 0;
  };
  return eachFrame(a, (tt, p, fr) => {
    const w = turn(tt), s = side(tt), sq = p.squash ?? 1;
    if (w) (p.head ??= {}).rot = plumb;
    if (w) { p.squash = s * w; p.stretch = w < TURN_EASE ? 1.02 : 1.01; fr.interp = false; return; }
    // mirrored (the rig's volume-preserving stretch is 1 / |squash|, so a mirrored sprite stands the right way up)
    if (s < 0) p.squash = -sq;
    // the frame before a turn holds too: nothing in-between a wide and a narrow frame
    for (const f of flips) if (tt === f - 3) fr.interp = false;
  });
}

export const FIRE: ElementSpec = {
  id: 'fire',
  name: 'Ember',
  blurb: 'A warm, affectionate show-off with the fastest metabolism. Its tail flame is its mood.',
  palette: PAL,
  modifiers: NO_MODIFIERS,
  stages: {
    baby: {
      tailRest: TAIL_REST.fire.baby,
      // 3 px buds: a near-round nub on the top-back of the cranium, pointing up and back (3.2)
      horns: hornParams({ len: 1, r0: 1.5, r1: 1.4, at: 118, sink: 0.5, sweep: 50 }),
      // the first flame-lick sits on the tail base at every stage (2.7): the baby's head, nub and pot belly leave
      // no flank a 4 x 4 mark can show on. t is where all of it clears the hip (the rig's fit, rig.ts fitMarkings,
      // slides a tail marking out to there anyway; these values say where it lands)
      markings: [{ kind: 'chevron', at: 'tail', t: 0.26, size: 4, solid: true }],
      wing: wingParams({ style: 'bat' }),
      dorsal: null,
    },
    young: {
      tailRest: TAIL_REST.fire.young,
      horns: hornParams({ len: 5, sweep: 6 }),
      markings: [{ kind: 'chevron', at: 'tail', t: 0.19, size: 5, solid: true }, { kind: 'chevron', at: 'haunch', size: 5, solid: true }],
      wing: wingParams({ style: 'bat', scallop: 2 }),
      dorsal: null,
    },
    adult: {
      tailRest: TAIL_REST.fire.adult,
      // the adult-only extra with the third tongue: the horns bend up 20 deg at the midpoint (3.2). The flame-licks
      // are SOLID carets (5.2): with the chevron's notched foot the adult's three read as the letters "A A A"
      horns: hornParams({ len: 8, bend: 20, sweep: -4 }),
      markings: [{ kind: 'chevron', at: 'tail', t: 0.16, size: 6, solid: true }, { kind: 'chevron', at: 'haunch', size: 6, solid: true }, { kind: 'chevron', at: 'shoulder', size: 6, solid: true }],
      wing: wingParams({ style: 'bat', scallop: 3 }),
      dorsal: null,
    },
    // the elder (3.2's Elder column): the adult's horns and flame-licks (greyed at half strength by the palette), the
    // bat wing worn (2.9: tears in panels 1 and 2, a notched hole in the arm panel at full spread); its posture,
    // muzzle, tuft and beard are the shared rig's
    elder: {
      tailRest: TAIL_REST.fire.elder,
      horns: hornParams({ len: 8, bend: 20, sweep: -4 }),
      markings: [{ kind: 'chevron', at: 'tail', t: 0.16, size: 6, solid: true }, { kind: 'chevron', at: 'haunch', size: 6, solid: true }, { kind: 'chevron', at: 'shoulder', size: 6, solid: true }],
      wing: wingParams({
        style: 'bat', scallop: 3,
        tears: [{ panel: 1, at: 0.35, depth: 5 }, { panel: 2, at: 0.6, depth: 5 }],
        // (2.9's spot re-measured for the notched window AND the airing: at 2.9's (-9.5, -8.5) the window lay on the
        // back once the airing leaned the spread back far enough for the tip rule (1.3); here, up the arm panel toward
        // the forearm, it keeps the ring and 2 px of membrane round it and clears the back line at the airing's 20 deg
        // sit-back, anims.ts airingFit)
        hole: { x: -7, y: -12, from: 0.95 },
      }),
      dorsal: null,
    },
  },
  render: { tailTip, ambient, breath },
  anims: {
    // Asleep (4.3) the young and adult tail drops to the floor behind the rump, rests along it and curls its end
    // up, so the banked ember stands on the raised tip behind the hips: cozy, not a stiff pole, and the cue still in
    // the asleep silhouette (5.1 #1) in fire's own zone. Wrapped forward round the paws, the ember sat inside the
    // body's outline beside the head and the asleep silhouette was a plain mound. The baby keeps its comma.
    fidget,
    overrides: (st, dims) => ({ walk: strutAnim(st, dims), beg: sighAnim(st), wake: rekindleAnim(st, dims), bath: bathAnim(st) }),
    tuning: (st) => ({
      // the strut (4.3): paw lift 5 (young 4, baby 2.5), head up 4 (baby 2). The elder keeps its element's column at
      // its own timing and amplitude (4.1, 4.3): 3.5 px on its slower 64 f walk, its gait's 2 px lifted as the
      // adult's 3 is (x 1.7), and the head up 3 (0.8x) over its level carriage. (The adult's 5 px at that tempo lifted
      // each paw high and slow, a stalk, not a strut; at 3 the strut hardly showed beside the shared elder gait.)
      walk: { lift: st === 'adult' ? 5 : st === 'elder' ? 3.5 : st === 'young' ? 4 : 2.5, head: st === 'baby' ? -2 : st === 'elder' ? -3 : -4 },
      sleep: st === 'baby' ? { tailCurl: 0, tailLift: 0 } : { tailLift: 72, tailCurl: grown(st) ? -21 : -24 },
      // the baby holds its breath before the hiccup: puffed up round, 1.10 wide, until the puff pops out; and its
      // comma keeps riding the eating bow (no tail droop, tuning.eat): the flame above the tail tip is fire's zone
      ...(st === 'baby' ? { breath: { puff: 1.1 }, eat: { tailDroop: 0 } } : {}),
    }),
  },
};
