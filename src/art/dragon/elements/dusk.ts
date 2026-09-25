// DUSK: "Wick", the lamplighter (docs/ART_BIBLE.md 3.8), the seventh element (v2; nickname and element name to be
// confirmed by the user). Zone: ahead of the face. Cue: a crook lamp, a thin stalk from the brow arching forward to a
// small lantern (taller than wide, capped, hung by a bail) ahead of the snout, which is also its mood gauge.
//
// Everything Wick is beyond the shared rig lives here:
//   - the LAMP (nearHead: lampFrame, drawLamp, drawStalk): the baby's bud on its fiddlehead curl, the young's arch
//     and small lantern, the adult's lantern crook, the elder's with its full-moon core and the RESIDENT MOTH; the
//     gauge (moon phase and droop), the lexicon's other states (guttering = tired, the nightlight on the floor =
//     asleep, out = the baby's fizzle), its clearance off the snout and the floor, and every act that moves it (the
//     lantern carry's swing, the happy flare, the lamplight search, the lamp-bat, the wake's relight);
//   - the SMOKE TAIL TIP (tailTip: the stepped flat fade navy -> slate band -> smoke) and the NOSE FROST
//     (headMarkings): the grey creeping in from the edges, stage by stage;
//   - the BREATH (breath): Nightfall, a mist that rolls along the floor, its elder's finale ring, and the baby's
//     fizzle (it blows out its own nightlight);
//   - the TOP PASS (ambient): motes (the happy flourish, the breath's, an idle one), the adult's visiting moth and
//     the fizzle's curl of smoke;
//   - the ANIMS: the lantern carry, the breathing lamp in the idle, the lamplight search, the tell and `hush` of its
//     breath, the baby's fizzle, the lamp-bat fidget.
import { DRAGON_PALETTES, smokeBandOf } from '../palettes.ts';
import type { DragonPalette } from '../palettes.ts';
import { TAIL_REST, FIDGET_TIMING } from '../stages.ts';
import type { Stage } from '../stages.ts';
import { wingParams } from '../element.ts';
import type { ElementSpec, ElementDraw, DragonInfo } from '../element.ts';
import { mouthToRoot } from '../features.ts';
import { ACT, DFACE, makeDragonPose, lerpDragonPose, dfaceIndex } from '../pose.ts';
import type { DragonPose, PartialDragonPose } from '../pose.ts';
import { bake, walkAnim, begAnim, breathAnim, wakeAnim, sleepAnim, baseAnims, lag } from '../anims.ts';
import type { Key } from '../anims.ts';
import type { DragonAnim, DragonFrame } from '../anim.ts';
import { animTuning } from '../tuning.ts';
import { hash01, liveSpawns, stepAlpha } from '../fx.ts';
import type { TopItem } from '../fx.ts';
import { cranToRootPt, enterFace, enterFaceFromCranium, rootToScreen } from '../rig.ts';
import type { DragonRig } from '../rig.ts';
import type { DragonDims } from '../build.ts';
import { facePixelInSkull } from '../faces.ts';
import { pathTaperedCapsule } from '../../../lib/art/shapes.ts';
import { tones } from '../../../lib/art/shading.ts';
import { ease } from '../../../lib/art/poses.ts';

const PAL = DRAGON_PALETTES.dusk;
const D2R = Math.PI / 180;

// ---------- the lamp: its shape per stage (3.8 table) ----------

/**
 * One stage's crook lamp. Cranium space (+x to the snout, y down): the stalk's root angle on the cranium circle (0.5
 * px inside it) and its cubic's P1, P2, P3 (P3, the hook, is where the lantern hangs); the stalk's width inside its
 * 1 px ink. The lantern in LAMP space (the pivot, P3, at (0, 0), y down, +x forward): the body `bw` x `bh` (the
 * baby's round bud: `bud`), the cap `cw` x 2 on top (horn), the finial `fw` x 2 under it (horn: a knob 2 px narrower
 * each side than the body, 3.8's text; at the table's 1 px a side it was as wide as the cap and the lantern read the
 * same both ways up, a battery or a capsule: the v2 element review), the bail's gap
 * between the hook's ink and the cap's (0: the baby's bud hangs straight from the hook), the core (glow.hi, none on
 * the baby) and the waning crescent's lit width at `mood` -1 (the mark floor's 2 on the young and baby).
 */
interface LampSpec {
  at: number;
  p1: readonly [number, number];
  p2: readonly [number, number];
  p3: readonly [number, number];
  stalk: number;
  bud: boolean;
  bw: number;
  bh: number;
  cw: number;
  fw: number;
  bail: number;
  core: readonly [number, number];
  crescent: number;
  /** The droop's scale at `mood` -1 (the baby's x 0.7). */
  droop: number;
  /** Background kept between the lantern's ink and the snout's or jaw's, px (the baby's 3). */
  clear: number;
}

const ADULT_LAMP: LampSpec = {
  at: 62, p1: [7, -15], p2: [20.5, -16], p3: [26.5, -13.5], stalk: 2.5,
  bud: false, bw: 7, bh: 9, cw: 7, fw: 3, bail: 2, core: [3, 3], crescent: 3, droop: 1, clear: 4,
};
const LAMP: Readonly<Record<Stage, LampSpec>> = {
  // the seed: a glowing bud on a fiddlehead curl, hung straight from the hook, no core (babies have no highlights)
  baby: {
    at: 60, p1: [5.5, -11], p2: [13, -12], p3: [18, -10], stalk: 2,
    bud: true, bw: 6, bh: 6, cw: 4, fw: 0, bail: 0, core: [0, 0], crescent: 2, droop: 0.7, clear: 3,
  },
  // the sprout: the curl opens into an arch, a small lantern with its 2 x 2 core
  young: {
    at: 64, p1: [5.5, -12.5], p2: [18, -13.5], p3: [23.5, -11.5], stalk: 2,
    bud: false, bw: 6, bh: 7, cw: 6, fw: 2, bail: 2, core: [2, 2], crescent: 2, droop: 1, clear: 4,
  },
  adult: ADULT_LAMP,
  // the adult's crook, unchanged in shape and place (a stooped lamplighter is D21's cane), with the full-moon core
  // 3 x 5; its resident moth lives on the cap (drawMothOnCap)
  elder: { ...ADULT_LAMP, core: [3, 5] },
};

/** The droop at `mood` -1 (3.8 gauge): P2 and P3 move (+x, +y) by these, x the stage's `droop`. */
const DROOP_P2: readonly [number, number] = [1, 3.5], DROOP_P3: readonly [number, number] = [1.5, 5];
/** "Full": no dark face (a lit width no lamp reaches). */
const FULL = 99;

/**
 * The lantern as a whole-pixel mask per stage, built once: cells of LAMP space in a small grid, 0 empty, 1 horn (the
 * bail, cap and finial), 2 the body (the lamp's glass: glow, its dark face, its core). The ink is not stored: it is
 * every empty cell 4-adjacent to a filled one (drawLamp), so the corners stay open and the silhouette reads rounded
 * (the body's "corners rounded 1 px", the cap's top corners). The body's rows: its first column per row (the bud's
 * round rows start further in), for the moon's lit columns counted from the dragon's side (-x).
 */
interface LampMask {
  cell: Uint8Array;
  /** Body rows (lamp y) and each row's first and last column. */
  bodyY: number;
  rowA: Int8Array;
  rowB: Int8Array;
  /** Lamp y of the cap's top fill row, and of the bottom ink row's lower edge (the lamp's foot on the floor). */
  capTop: number;
  bottom: number;
  /** The body's box (lamp px) and the core's. */
  bx: number;
  cx: number;
  cy: number;
}
/** The mask grid: lamp x -6 .. 6, lamp y -2 .. 21. */
const GX0 = -6, GY0 = -2, GW = 13, GH = 24;

function buildMask(S: LampSpec): LampMask {
  const cell = new Uint8Array(GW * GH);
  const set = (x: number, y: number, v: number): void => { cell[(y - GY0) * GW + (x - GX0)] = v; };
  const hook = S.stalk / 2 + 1;
  // the lamp's columns: bw wide from -floor(bw / 2) (an odd lamp's middle sits half a pixel forward of the pivot)
  const bx = -Math.floor(S.bw / 2);
  let y = 0;
  if (S.bail) {
    // the bail: 2 px wide under the pivot, from inside the hook down to the cap's ink, `bail` whole rows of it showing
    // between the hook's ink and the cap's (rounded, the adult's 2.25 px hook left one row: the v2 element review)
    const capInk = Math.ceil(hook) + S.bail;
    for (let r = 1; r < capInk; r++) { set(-1, r, 1); set(0, r, 1); }
    y = capInk + 1;
  } else y = 2;
  // the cap: its bottom row as wide as the body, its top row a pixel in from each side, a lantern's roof (square, a
  // 7 x 11 box on a narrower foot read as a battery or a jar)
  const capTop = y, cx0 = bx + ((S.bw - S.cw) >> 1);
  for (let r = 0; r < 2; r++) for (let x = r ? 0 : 1; x < (r ? S.cw : S.cw - 1); x++) set(cx0 + x, y + r, 1);
  y += 2;
  const bodyY = y, rowA = new Int8Array(S.bh), rowB = new Int8Array(S.bh);
  for (let r = 0; r < S.bh; r++) {
    // the bud's round: its first and last rows 2 px narrower each side... one each side (a 6 px disc, r 3)
    const inset = S.bud && (r === 0 || r === S.bh - 1) ? 1 : 0;
    rowA[r] = bx + inset; rowB[r] = bx + S.bw - 1 - inset;
    for (let x = rowA[r]; x <= rowB[r]; x++) set(x, y + r, 2);
  }
  y += S.bh;
  if (S.fw) {
    const fx0 = bx + ((S.bw - S.fw) >> 1);
    for (let r = 0; r < 2; r++) for (let x = 0; x < S.fw; x++) set(fx0 + x, y + r, 1);
    y += 2;
  }
  const cx = bx + ((S.bw - S.core[0]) >> 1), cy = bodyY + Math.ceil((S.bh - S.core[1]) / 2);
  return { cell, bodyY, rowA, rowB, capTop, bottom: y + 1, bx, cx, cy };
}
const MASK: Readonly<Record<Stage, LampMask>> = {
  baby: buildMask(LAMP.baby), young: buildMask(LAMP.young), adult: buildMask(LAMP.adult), elder: buildMask(LAMP.elder),
};
/** The mask's cell at lamp (x, y): 0 outside the grid. */
function cellAt(M: LampMask, x: number, y: number): number {
  const gx = x - GX0, gy = y - GY0;
  return gx < 0 || gy < 0 || gx >= GW || gy >= GH ? 0 : M.cell[gy * GW + gx];
}

// ---------- the lamp this frame ----------

/**
 * The lamp as lampFrame leaves it, ROOT space: the stalk's cubic (P0 .. P3; its root end is carried 3 px into the
 * skull along its first tangent, so no round end shows), the lantern's pivot (P3), what the glass shows -- `lit`
 * columns lit from the dragon's side (FULL, a crescent's width, 0: dark), the new-moon `sliver`'s taper, the `core`
 * -- the swing of its foot (px, + forward), how far it is set down on the floor (`w`, 0 hanging .. 1 the nightlight),
 * whether it TURNS with it (`turn`: the lamp-bat's big swings alone; every other swing moves it by whole pixels, the
 * bail leaning, so it never flips between the crisp mask and a turned, anti-aliased one mid-walk: the v2 element
 * review), where its glass sits (bx, by: the body's centre, swung), its foot (the bottom ink row) and the floor
 * under it, and the elder moth's wing flick.
 */
const LF = {
  x0: 0, y0: 0, x1: 0, y1: 0, x2: 0, y2: 0, x3: 0, y3: 0,
  lit: FULL, sliver: false, wide: 0, core: false, swing: 0, turn: false, w: 0, bx: 0, by: 0, foot: 0, floor: 0,
  flick: false,
};
const PT = { x: 0, y: 0 }, PU = { x: 0, y: 0 };

/** Smoothstep of u clamped to 0..1. */
function smooth(u: number): number { const v = Math.max(0, Math.min(1, u)); return v * v * (3 - 2 * v); }

/** The wake's length and the frame its eyes first open (anims.ts wakeAnim: 30 f x 24/30, 26/30, 36/30; open at 3). */
function wakeK(st: Stage): number { return st === 'baby' ? 24 / 30 : st === 'young' ? 26 / 30 : st === 'elder' ? 36 / 30 : 1; }

/** Root-space y of the floor at root x for this pose (rig.ts floorY: root.y lifts, root.rot tilts). */
function floorAt(pose: DragonPose, x: number): number {
  const a = pose.root.rot * D2R;
  return -(pose.root.y + x * Math.sin(a)) / (Math.cos(a) || 1e-6);
}

/**
 * How many frames of its idle breath the lamp's core shows at the top of an inhale (3.8 "the lamp breathes"): the
 * idle override (breathingIdle) keys pose.fx 1 for this long around every other inhale's peak.
 */
const BREATH_CORE = 16;

/**
 * Work out the lamp this frame, into LF (3.8, 4.3). The GAUGE: `mood` >= +0.5 full + core, the lamp end lifted 1 px
 * (P3 up; P2 stays, so the arch's peak keeps its budget); -0.3 < mood < 0.5 full, its core breathing with the idle
 * (every other inhale, 16 f, at mood >= 0); mood <= -0.3 (and the `sad` / `scared` faces) a waning crescent, lit on
 * the dragon's side, and the stalk droops toward -1 (P2 + (1, 3.5), P3 + (1.5, 5), the baby's x 0.7), the lamp about
 * 5 px lower. The LEXICON's other states each mean one thing: guttering (a 2 f flicker to the dark face every 60 f on
 * the `sleepy` face) = tired; the new-moon nightlight on the floor = asleep; out = the baby's fizzle. Over them, by act:
 *   happy  the flare: full + core for 30 f from cue 0, the stalk bobbing up 1 px at cue 0 and 12;
 *   breath the tell turns the lamp up in two steps (full, then full + core with the +1 lift) and keeps it so through
 *          the stream; the baby's fizzle puts it OUT at cue 6 and flickers it back at 14 (on 2, off 2, on);
 *   eat    the +1 shape, and the lamp kept >= 2 px over the food (4.3's rule);
 *   sleep  set down over the lie-down's second half onto the floor ahead of the snout (`w`), the new moon;
 *   wake   switched on as the eyes first open (on 3 f, off 2 f, on), REFILLED by the nap (full + core through the
 *          rest of the wake), and lifted back up as the head rises;
 *   fidget the lamp-bat's swing and the core's flash at the bonk.
 * Hanging, it keeps the stage's background to the snout and jaw (>= 4 px, the baby's 3) and 1 px over the floor, the
 * stalk's end reaching forward or up as far as it must (a head tipped nose-up, the lamp-bat's sit, the beg's look up,
 * the eating bow). Allocation-free.
 */
function lampFrame(rig: DragonRig, pose: DragonPose, info: DragonInfo): void {
  const st = info.stage, S = LAMP[st], M = MASK[st], J = rig.j, H = rig.dims.head;
  const act = pose.act, c = pose.cue, face = pose.face | 0, m = info.mood;
  const sad = face === DFACE.sad || face === DFACE.scared;
  // ---- the asleep weight: set down over the lie-down's second half, lifted over the wake's first half ----
  let w = info.asleep ? 1 : 0;
  const Lw = Math.round(30 * wakeK(st)), open = Math.round(3 * wakeK(st));
  if (act === ACT.sleep) {
    const L = rig.tune.sleep.lieDown;
    w = c >= 0 ? 1 : smooth((c + L * 0.5) / (L * 0.45));
  } else if (act === ACT.wake) w = 1 - smooth((c - open - 2) / (Lw * 0.45));
  // ---- the gauge ----
  const droop = sad ? 1 : Math.max(0, Math.min(1, (-0.3 - m) / 0.7));
  let lift = m >= 0.5 ? 1 : 0, lit = FULL, core = false, sliver = false, wide = 0;
  if (m <= -0.3 || sad) lit = S.crescent;
  else core = m >= 0.5 || (act === ACT.none && pose.fx >= 0.5 && m >= 0);
  if (act === ACT.happy && c >= 0 && c < 30) {
    // (the flare's bobs ARE its lift: added to the +1 of its mood they rose past the head budget, 3.0)
    lit = FULL; core = true;
    lift = c < 4 || (c >= 12 && c < 16) ? 1 : 0;
  } else if (act === ACT.breath && st !== 'baby') {
    const s0 = st === 'young' ? 14 : st === 'elder' ? 22 : 18;
    if (c >= -s0 && (c < 0 || pose.fx > 0.05)) {
      lit = FULL; core = c >= -s0 / 2;
      if (core) lift = Math.max(lift, 1);
    }
  } else if (act === ACT.breath) {
    // the baby's fizzle: out at cue 6, back at 14 on 2 f, off 2 f, on
    if (c >= 6 && (c < 14 || (c >= 16 && c < 18))) lit = 0;
  } else if (act === ACT.eat) lift = Math.max(lift, 1);
  else if (act === ACT.wake && c >= open) {
    lit = c < open + 3 || c >= open + 5 ? FULL : 0;
    core = c >= open + 5;
  } else if (act === ACT.fidget) {
    const f = c / FIDGET_TIMING[st].dur;
    if (st !== 'baby' && f >= 47 && f < 52) core = true;
  }
  // guttering: tired, and only tired (3.8's lexicon): the `sleepy` face awake, outside the sleep, the wake and the beg
  if (face === DFACE.sleepy && !info.asleep && act !== ACT.sleep && act !== ACT.wake && act !== ACT.beg && act !== ACT.breath) {
    if ((info.tick + Math.floor(hash01(91, info.seed) * 60)) % 60 < 2) { lit = 0; core = false; }
  }
  if (act === ACT.sleep && !info.asleep && pose.fx > 0.05) {
    // lying awake (the tuck-in's wait: tuckinAnim): the lamp lit on the floor, turned down in steps as it is tucked in
    lit = pose.fx >= 0.75 ? FULL : pose.fx >= 0.45 ? S.crescent : 2; sliver = pose.fx < 0.45; core = false;
  } else if (info.asleep || (act === ACT.wake && c < open)) {
    // the new-moon nightlight: a lit sliver on the dragon's side that widens 1 px for 20 f on each sleeping exhale
    lit = 2; sliver = true; core = false;
    if (act === ACT.sleep && c >= 0) { const B = rig.tune.sleep.breath, e = c - B / 2; if (e >= 0 && e < 20) wide = 1; }
  }
  if (lit !== FULL || !S.core[0]) core = false;
  // ---- the crook, cranium space -> root ----
  const r = H.cranR - 0.5, a = S.at * D2R, k = droop * S.droop;
  const cx0 = Math.cos(a) * r, cy0 = -Math.sin(a) * r;
  cranToRootPt(rig, cx0, cy0, PT); LF.x0 = PT.x; LF.y0 = PT.y;
  cranToRootPt(rig, S.p1[0], S.p1[1], PT); LF.x1 = PT.x; LF.y1 = PT.y;
  cranToRootPt(rig, S.p2[0] + DROOP_P2[0] * k, S.p2[1] + DROOP_P2[1] * k, PT); LF.x2 = PT.x; LF.y2 = PT.y;
  cranToRootPt(rig, S.p3[0] + DROOP_P3[0] * k, S.p3[1] + DROOP_P3[1] * k - lift, PT); LF.x3 = PT.x; LF.y3 = PT.y;
  // ---- hanging: the clearance off the snout and jaw, the food, the floor ----
  // (the stage's clearance and half a pixel for the rounding at rest, and a pixel more in the lantern carry, room for
  // its swing back, which is held to the clearance below: a margin of 2 px at rest hung the adult's 6 px off,
  // stretching the crook, and the baby's full 3 px swing on top stretched its curl flat)
  const need = S.clear + 0.5 + (act === ACT.walk ? 1 : 0);
  let gap = lampGap(rig, M, LF.x3, LF.y3);
  for (let i = 0; i < 8 && gap < need; i++) {
    const dx = need - gap + 0.25;
    LF.x3 += dx; LF.x2 += dx * 0.5;
    gap = lampGap(rig, M, LF.x3, LF.y3);
  }
  let low = floorAt(pose, LF.x3) - 1;
  if (act === ACT.eat) low = Math.min(low, J.mouth.y - 5);
  const over = LF.y3 + M.bottom - low;
  if (over > 0) { LF.y3 -= over; LF.y2 -= over * 0.5; }
  // ---- set down: the nightlight on the floor 2 px ahead of the snout, the stalk slack from the brow to its bail ----
  if (w > 0) {
    const sn = H.snout;
    cranToRootPt(rig, sn.x1, sn.y1, PU);
    // the lamp's glass starts 1 px (the snout's ink) + 2 px (the background) + 1 px (its own ink) past the snout; the
    // baby's bud 4 px further out, beside the bed, not under the chin
    const px = Math.round(PU.x + sn.r1 + 4 + (S.bud ? 4 : 0) - M.bx), py = floorAt(pose, px) - M.bottom;
    // (bowed forward over the snout and down into the bail, a fishing rod with its catch set down: straight down from
    // the brow, the baby's read as a trunk; the baby's curl, short, runs out level from its brow in a low arch and
    // drops into the bud, its drop 2 px or more ahead of the face: tucked in, it dropped past the nose, a trunk again)
    const qx1 = S.bud ? LF.x0 + (px - LF.x0) * 0.55 : LF.x0 + (px - LF.x0) * 0.7, qy1 = Math.min(LF.y0, py) - 3;
    const qx2 = S.bud ? px + 1 : px + 3, qy2 = S.bud ? Math.min(LF.y0, py - 4) : py - 6;
    LF.x1 += (qx1 - LF.x1) * w; LF.y1 += (qy1 - LF.y1) * w;
    LF.x2 += (qx2 - LF.x2) * w; LF.y2 += (qy2 - LF.y2) * w;
    LF.x3 += (px - LF.x3) * w; LF.y3 += (py - LF.y3) * w;
  }
  LF.lit = lit; LF.core = core; LF.sliver = sliver; LF.wide = wide; LF.w = w;
  // (after the clearance: the bonk's swing is measured from where the lamp hangs; a swing back toward the face that
  // would close the clearance -- the carry's, the growl's -- stops short, in whole pixels)
  let swing = w > 0.5 ? 0 : lampSwing(rig, pose, info);
  LF.turn = act === ACT.fidget && Math.abs(swing) > 2.5;
  if (!LF.turn && act !== ACT.fidget) {
    for (let i = 0; i < 4 && swing <= -0.5 && lampGap(rig, M, LF.x3 + (S.bud ? swing : Math.round(swing)), LF.y3) < S.clear; i++) swing += 1;
    if (swing > -0.5 && swing < 0) swing = 0;
  }
  // (the baby's bud hangs straight from its hook, no bail to lean: its swing moves the curl's end instead)
  if (S.bud && !LF.turn) { LF.x3 += swing; LF.x2 += swing * 0.5; LF.swing = 0; } else LF.swing = swing;
  LF.bx = LF.x3 + M.bx + LAMP[st].bw / 2 + (LF.turn ? 0 : Math.round(LF.swing));
  LF.by = LF.y3 + M.bodyY + LAMP[st].bh / 2; LF.foot = LF.y3 + M.bottom - 1; LF.floor = floorAt(pose, LF.bx);
  LF.flick = st === 'elder' && !info.asleep && ((info.tick + Math.floor(hash01(93, info.seed) * 60)) % 60 < 8 || (act === ACT.fidget && c / FIDGET_TIMING[st].dur >= 47 && c / FIDGET_TIMING[st].dur < 55));
}

/**
 * The background between the hanging lamp's ink (its pivot at root (X, Y)) and the head's -- the snout's tip and
 * middle, the jaw's tip (dropped and opened as drawn), the cranium -- in px (fill to fill, less the two 1 px inks):
 * the clearance of 3.8 ("measured on the rig, with the head's pitch").
 */
function lampGap(rig: DragonRig, M: LampMask, X: number, Y: number): number {
  const H = rig.dims.head, sn = H.snout, jw = H.jaw, J = rig.j, S = LAMP[rig.stage];
  const x0 = X + M.bx, x1 = x0 + S.bw, y0 = Y + M.capTop, y1 = Y + M.bottom - 1;
  let d = circGap(rig, x0, y0, x1, y1, sn.x1, sn.y1, sn.r1);
  d = Math.min(d, circGap(rig, x0, y0, x1, y1, (sn.x0 + sn.x1) / 2, (sn.y0 + sn.y1) / 2, (sn.r0 + sn.r1) / 2));
  d = Math.min(d, circGap(rig, x0, y0, x1, y1, 0, 0, H.cranR + H.brow));
  const ja = J.jaw * D2R, hy = jw.hy + (J.jaw ? jw.drop : 0), tx = jw.tx - jw.hx, ty = jw.ty - jw.hy;
  d = Math.min(d, circGap(rig, x0, y0, x1, y1, jw.hx + tx * Math.cos(ja) - ty * Math.sin(ja), hy + tx * Math.sin(ja) + ty * Math.cos(ja), jw.r1));
  return d - 2;
}
/** Fill-to-fill distance from a root-space box to a cranium-space circle. */
function circGap(rig: DragonRig, x0: number, y0: number, x1: number, y1: number, cx: number, cy: number, r: number): number {
  cranToRootPt(rig, cx, cy, PU);
  const dx = Math.max(x0 - PU.x, 0, PU.x - x1), dy = Math.max(y0 - PU.y, 0, PU.y - y1);
  return Math.hypot(dx, dy) - r;
}

/** Linear interpolation through [frame, value] pairs (a keyed swing), held at the ends. */
function keyed(keys: readonly number[], f: number): number {
  if (f <= keys[0]) return keys[1];
  for (let i = 2; i < keys.length; i += 2) {
    if (f <= keys[i]) { const u = (f - keys[i - 2]) / (keys[i] - keys[i - 2] || 1); return keys[i - 1] + (keys[i + 1] - keys[i - 1]) * u; }
  }
  return keys[keys.length - 1];
}
/**
 * The lamp-bat's swing of the lantern's foot, px (+ away from the face), on the fidget's adult frames: the kick as it
 * notices (2 px), swung away 5 px by the first swipe from the frame its paw lands (25), back and forth past it, away
 * again as swipe 2 misses, and at the bonk (BONK: into the snout, however far that is: bonkSwing) the rebound. The
 * baby's swings from its topple's jolt (f 28), and never comes back to bonk it: it has toppled onto its rump.
 */
const BAT_SWING: readonly number[] = [0, 0, 2, 2, 5, -1, 8, 1, 10, 0, 22, 0, 25, 0, 28, 5, 32, 1, 35, -3, 38, 0, 41, 3, 44, 4, 47, 0, 50, 0, 52, 3, 56, -1, 60, 0];
/** The bonk's share of the swing (the rest the keys'), on the fidget's adult frames: it swings in over 3 f, rests on the nose 3 f. */
const BONK: readonly number[] = [0, 0, 44, 0, 47, 1, 50, 1, 52, 0];
const BAT_SWING_BABY: readonly number[] = [0, 0, 2, 2, 5, -1, 8, 1, 10, 0, 28, 0, 30, 4, 33, -3, 36, 2, 40, -1, 44, 0];

/**
 * The pendulum (3.8 ambient: the lantern lags the stalk's tip), as a swing of the lantern's foot in px (+ forward),
 * keyed from the act and its clock so a frozen frame is reproducible: none at idle (the lamp hangs still: "at most
 * 1 px"), +-2 px a beat behind the stride in the lantern carry (the baby's waddle +-3), 2 px with each shake of the
 * beg's stomach growl, and the lamp-bat's swings (its bonk as far as the snout: bonkSwing).
 */
function lampSwing(rig: DragonRig, pose: DragonPose, info: DragonInfo): number {
  const act = pose.act, c = pose.cue, st = info.stage;
  if (act === ACT.walk) {
    const C = Math.max(1, Math.round(rig.tune.walk.cycle));
    return (st === 'baby' ? 3 : 2) * Math.sin(2 * Math.PI * (c / C) - Math.PI / 4);
  }
  if (act === ACT.beg && c >= 80 && c < 88) return Math.floor((c - 80) / 2) % 2 ? -2 : 2;
  if (act === ACT.fidget) {
    const FT = FIDGET_TIMING[st], f = c / FT.dur, v = keyed(st === 'baby' ? BAT_SWING_BABY : BAT_SWING, f) * FT.amp;
    const b = st === 'baby' ? 0 : keyed(BONK, f);
    return b > 0 ? v + (bonkSwing(rig) - v) * b : v;
  }
  return 0;
}

/**
 * The lantern's turn off plumb for a swing of its foot `s` px (+ forward), radians, + turning its foot forward: at most
 * 25 deg (3.8), but for the lamp-bat's bonk, which swings it as far as the snout (bonkSwing: up to 45).
 */
function swingAngle(s: number, M: LampMask): number {
  const a = Math.asin(Math.max(-1, Math.min(1, s / M.bottom)));
  return Math.max(-45 * D2R, Math.min(25 * D2R, a));
}
/**
 * The bonk (the lamp-bat, f 46-52): the swing back that brings the lantern's ink onto the snout's, px of its foot:
 * turned back a degree at a time about the pivot (root space, +x forward) until a point of its back edge or foot
 * comes within the two inks of the snout's tip, 45 deg at most.
 */
function bonkSwing(rig: DragonRig): number {
  const st = rig.stage, S = LAMP[st], M = MASK[st], sn = rig.dims.head.snout;
  cranToRootPt(rig, sn.x1, sn.y1, PU);
  const R = sn.r1 + 2, xb = M.bx, xf = M.bx + S.bw;
  for (let d = 1; d <= 45; d++) {
    const a = d * D2R, c = Math.cos(a), sn2 = Math.sin(a);
    for (let y = M.capTop; y <= M.bottom; y += 1) for (let x = xb; x <= xf; x += y < M.bottom - 1 ? xf - xb : 1) {
      const px = LF.x3 + x * c - y * sn2, py = LF.y3 + x * sn2 + y * c;
      if (Math.hypot(px - PU.x, py - PU.y) <= R) return -Math.sin(a) * M.bottom;
    }
  }
  return -Math.sin(45 * D2R) * M.bottom;
}

// ---------- the lamp drawn ----------

/**
 * The lantern in FACE space at the pivot (whole pixels, never squashed: a made thing), its foot swung LF.swing px:
 * it hangs upright moved over by whole pixels, the bail leaning from the hook to it; only the lamp-bat's big swings
 * (LF.turn) turn it about the pivot, up to 25 deg off plumb. The ink first (every empty cell 4-adjacent to the
 * lamp: one silhouette, its corners open), then the horn (bail, cap, finial: silver), the glass (glow, its dark
 * face `moodT.banked` on the far side of the lit columns, counted from the dragon's side, -x), then the core. An
 * emitter: flat, never banded (D20).
 */
function drawLamp(ctx: CanvasRenderingContext2D, rig: DragonRig, info: DragonInfo): void {
  const st = info.stage, M = MASK[st];
  const s = LF.swing, small = !LF.turn, dx = small ? Math.round(s) : 0;
  enterFace(ctx, rig, LF.x3, LF.y3);
  // (turned, each run overlaps the next by half a pixel, so no anti-aliased seam shows the ink between them)
  const pad = small ? 0 : 0.5;
  if (!small) ctx.rotate(-swingAngle(s, M));
  const capInk = M.capTop - 1;
  for (let pass = 0; pass < 2; pass++) {
    for (let y = GY0; y < GY0 + GH; y++) {
      // the bail leans with a small swing: its rows shift part of the way
      const sh = y < capInk ? Math.round(dx * Math.max(0, y) / Math.max(1, capInk)) : dx;
      let run = 0, from = GX0;
      for (let x = GX0; x <= GX0 + GW; x++) {
        const k = x < GX0 + GW ? lampCell(rig, info, M, x, y, pass) : 0;
        if (k !== run) {
          if (run) { ctx.fillStyle = CELL_HEX[run]; ctx.fillRect(from + sh, y, x - from + pad, 1 + pad); }
          run = k; from = x;
        }
      }
    }
  }
  ctx.restore();
}
/** This frame's colours by lampCell's code (1 ink, 2 horn, 3 glow, 4 the dark face, 5 the core), set by lampCell. */
const CELL_HEX: string[] = ['', '', '', '', '', ''];
/**
 * What lamp cell (x, y) shows on `pass` (0 the ink, 1 the fills), as a CELL_HEX code (0 nothing): the ink on every
 * empty cell 4-adjacent to the lamp (none above the bail's top, which runs up under the hook), the horn of the bail,
 * cap and finial, and the glass lit from the dragon's side (litWidth), dark beyond, the core over it.
 */
function lampCell(rig: DragonRig, info: DragonInfo, M: LampMask, x: number, y: number, pass: number): number {
  const v = cellAt(M, x, y);
  if (pass === 0) {
    if (v || y < 1 || !(cellAt(M, x - 1, y) || cellAt(M, x + 1, y) || cellAt(M, x, y - 1) || cellAt(M, x, y + 1))) return 0;
    CELL_HEX[1] = rig.col(rig.outline);
    return 1;
  }
  if (!v) return 0;
  if (v === 1) { CELL_HEX[2] = rig.col(info.pal.horn); return 2; }
  const S = LAMP[info.stage], r = y - M.bodyY;
  if (LF.core && x >= M.cx && x < M.cx + S.core[0] && y >= M.cy && y < M.cy + S.core[1]) { CELL_HEX[5] = rig.col(tones(rig, info.pal.glow).hi); return 5; }
  if (x - M.rowA[r] < litWidth(S, r)) { CELL_HEX[3] = rig.col(info.pal.glow); return 3; }
  CELL_HEX[4] = rig.col(rig.moodT.banked);
  return 4;
}

/**
 * Lit columns of glass row r this frame, from the dragon's side: all of them (full); the waning crescent, shaped so no
 * row goes under the mark floor's 2 px (5.2): the adult's and elder's 3 with its end rows a pixel thinner, the young's
 * and baby's 2 with the dark face inset a pixel over its middle third instead (their 1 px end rows read as a bar at
 * 1x: the v2 element review); or the new moon's sliver, 2 px on every row (3 for 20 f on each sleeping exhale: its
 * 1 px ends made the sleeping lamp read as off).
 */
function litWidth(S: LampSpec, r: number): number {
  const L = LF.lit;
  if (L >= FULL) return FULL;
  if (L <= 0) return 0;
  if (LF.sliver) return 2 + LF.wide;
  const third = Math.floor(S.bh / 3), mid = r >= third && r < S.bh - third, end = r === 0 || r === S.bh - 1;
  return L - 1 >= 2 ? (end ? L - 1 : L) : mid ? L + 1 : L;
}

/**
 * The stalk: the cubic P0 .. P3 stroked in flat `scale` (it is flesh), `stalk` px inside a 1 px ink line each side,
 * ROOT space, with a round end at the hook. It runs 3 px on into the skull along its first tangent and the caller
 * clips it to OUTSIDE the skull shrunk 1 px (clipOffSkull), so its fill covers the skull's ink where they meet and its
 * own ink stops at the skull's contour: stalk and skull are one silhouette, as neck and body are (1.2).
 */
function drawStalk(ctx: CanvasRenderingContext2D, rig: DragonRig, info: DragonInfo): void {
  const S = LAMP[info.stage];
  let tx = LF.x1 - LF.x0, ty = LF.y1 - LF.y0;
  const tl = Math.hypot(tx, ty) || 1;
  tx /= tl; ty /= tl;
  ctx.beginPath();
  ctx.moveTo(LF.x0 - tx * 3, LF.y0 - ty * 3); ctx.lineTo(LF.x0, LF.y0);
  ctx.bezierCurveTo(LF.x1, LF.y1, LF.x2, LF.y2, LF.x3, LF.y3);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = rig.col(rig.outline); ctx.lineWidth = S.stalk + 2 * rig.ow; ctx.stroke();
  ctx.strokeStyle = rig.col(info.pal.scale); ctx.lineWidth = S.stalk; ctx.stroke();
}

/**
 * Clip (cranium space) to outside the skull shrunk 1 px: off the cranium circle and off the brow-ridge bump (the stalk
 * roots on the brow, 60 to 64 deg, just past the bump's 58), each a clip of its own, since an even-odd clip of two
 * overlapping circles would let the stalk through where they overlap.
 */
function clipOffSkull(ctx: CanvasRenderingContext2D, rig: DragonRig): void {
  const H = rig.dims.head, r = H.cranR - 1;
  ctx.beginPath(); ctx.rect(-80, -80, 160, 160); ctx.moveTo(r, 0); ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip('evenodd');
  if (H.brow > 0) {
    const a = 58 * D2R, d = H.cranR + H.brow - 3, bx = Math.cos(a) * d, by = -Math.sin(a) * d;
    ctx.beginPath(); ctx.rect(-80, -80, 160, 160); ctx.moveTo(bx + 2, by); ctx.arc(bx, by, 2, 0, Math.PI * 2);
    ctx.clip('evenodd');
  }
}
/** From cranium space (the head anchors) back to root space, the clip kept. */
function craniumToRoot(ctx: CanvasRenderingContext2D, rig: DragonRig): void {
  const J = rig.j;
  if (J.headFlip < 0) ctx.scale(1, -1);
  ctx.rotate(-J.headAng * D2R); ctx.translate(-J.cran.x, -J.cran.y);
}

/**
 * The moth glyphs (3.8): open, a 5 x 3 bow-tie (its notched top and bottom make it a moth, not a star); closed, a 3 x 4
 * delta, the folded wings: a flat top, the point down and back (the first draft's wedge, point up at the back, read in
 * its ink ring as a teardrop or a nozzle: the v2 element review). Rows as bit masks, the high bit on the left (the back).
 */
const MOTH_OPEN: readonly number[] = [0b11011, 0b11111, 0b11011];
const MOTH_SHUT: readonly number[] = [0b111, 0b111, 0b110, 0b100];
/** Is cell (x, y) of a moth glyph on? */
function mothOn(rows: readonly number[], w: number, x: number, y: number): boolean {
  return y >= 0 && y < rows.length && x >= 0 && x < w && ((rows[y] >> (w - 1 - x)) & 1) === 1;
}
/**
 * Draw a moth glyph with its top-left at lamp (x0, y0), in whole pixels: `fill` (the moth grey `membrane`) in a
 * 4-neighbour ink ring, whose cells that would land on the lamp it sits on (M, shifted `sh` px with its swing) are left
 * out: it sits on the cap's pale fill.
 */
function mothGlyph(ctx: CanvasRenderingContext2D, rig: DragonRig, open: boolean, x0: number, y0: number, fill: string, M: LampMask, sh: number): void {
  const rows = open ? MOTH_OPEN : MOTH_SHUT, w = open ? 5 : 3, h = rows.length;
  ctx.fillStyle = rig.col(rig.outline);
  for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
    if (mothOn(rows, w, x, y)) continue;
    if (!(mothOn(rows, w, x - 1, y) || mothOn(rows, w, x + 1, y) || mothOn(rows, w, x, y - 1) || mothOn(rows, w, x, y + 1))) continue;
    if (cellAt(M, x0 + x - sh, y0 + y)) continue;
    ctx.fillRect(x0 + x, y0 + y, 1, 1);
  }
  ctx.fillStyle = rig.col(fill);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mothOn(rows, w, x, y)) ctx.fillRect(x0 + x, y0 + y, 1, 1);
}

/**
 * The elder's RESIDENT MOTH (3.8, its elder-only extra; permanent at every mood): it lives on the lamp, perched on the
 * cap's front end, its point on the corner of the lantern's ink and its body over the front edge, with its wings
 * closed (the 3 x 4 delta), and flicks them open (the 5 x 3 bow-tie, lifted a pixel off the corner) for 8 f every 60 f
 * and at the lamp-bat's bonk; asleep it rests on the nightlight, still. Its ink keeps a pixel of background from the
 * bail's and the hook's: perched beside the bail, it filled the gap that says the lantern is hung, and at 1x the
 * lantern read as a spray can (the v2 element review). Face space at the pivot, swung with the lantern.
 */
function drawMothOnCap(ctx: CanvasRenderingContext2D, rig: DragonRig, info: DragonInfo): void {
  const M = MASK[info.stage], S = LAMP[info.stage], s = LF.swing, small = !LF.turn, dx = small ? Math.round(s) : 0;
  enterFace(ctx, rig, LF.x3, LF.y3);
  if (!small) ctx.rotate(-swingAngle(s, M));
  mothGlyph(ctx, rig, LF.flick, M.bx + S.bw + dx, M.capTop - 3, info.pal.membrane, M, dx);
  ctx.restore();
}

/**
 * THE CUE: bible 3.8 "The cue: the crook lamp". Cranium space in; the lantern first (face space, at the pivot), then
 * the stalk over its bail's top (root space, clipped outside the skull), so the hook's end sits in front of the bail
 * like a loop round it; then the elder's resident moth. The rig clips this anchor off the eye's box + 1 px. One lamp
 * (1.5: no far stalk), in the near palette.
 */
const nearHead: ElementDraw = (ctx, rig, pose, info) => {
  lampFrame(rig, pose, info);
  ctx.save();
  craniumToRoot(ctx, rig);
  drawLamp(ctx, rig, info);
  ctx.restore();
  ctx.save();
  clipOffSkull(ctx, rig);
  craniumToRoot(ctx, rig);
  drawStalk(ctx, rig, info);
  ctx.restore();
  if (info.stage === 'elder') {
    ctx.save();
    craniumToRoot(ctx, rig);
    drawMothOnCap(ctx, rig, info);
    ctx.restore();
  }
};

// ---------- the smoke tail tip ----------

/**
 * The smoke tail tip (3.8, the first marking, an invariant): px of smoke from the tail's tip back, and of the slate
 * band before it. The elder's is about half its tail.
 */
const TIP: Readonly<Record<Stage, { tip: number; band: number }>> = {
  baby: { tip: 4, band: 3 }, young: { tip: 7, band: 3 }, adult: { tip: 10, band: 4 }, elder: { tip: 16, band: 6 },
};
/** The slate band per palette (smokeBandOf), made once per stage's palette (a renderer builds no strings). */
const BAND = new WeakMap<Readonly<DragonPalette>, string>();
function bandOf(p: Readonly<DragonPalette>): string {
  let b = BAND.get(p);
  if (!b) { b = smokeBandOf(p); BAND.set(p, b); }
  return b;
}

/**
 * The SMOKE TAIL TIP (3.8): a stepped, flat fade, navy -> the slate band (smokeBandOf) -> the smoke grey (`marking`),
 * each step one flat tone with a clean cut across the tail, measured along the tail from its very end (the tip's
 * round cap included). Pigment: never inked (1.6), and painted SEGMENT BY SEGMENT, each part clipped to its own
 * capsule (tipBand): one wide stroke clipped to the whole tube painted straight across a folded tail, a pale slab
 * behind the hind leg as the lamp-bat stood up (the v2 element review). Drawn at the tail-tip anchor, walked back to
 * root space: the shared marking kinds have no `tip` (see the report), so the tail's own markings list is empty and
 * this is its first marking.
 */
const tailTip: ElementDraw = (ctx, rig, _pose, info) => {
  if (rig.override) return;
  const J = rig.j, tn = J.tailN, T = TIP[info.stage];
  ctx.save();
  ctx.rotate(-info.ang * D2R); ctx.translate(-J.tailX[tn], -J.tailY[tn]);
  ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
  tipBand(ctx, J, T.tip + T.band, bandOf(info.pal));
  tipBand(ctx, J, T.tip, info.pal.marking);
  ctx.restore();
};
/**
 * Paint the tail from `d` px before its very end (the last node plus its cap) out to the end in `hex`, root space: in
 * each tail segment the band reaches, its own stretch of the centreline stroked butt-capped, 2 px wider than the
 * segment each side, clipped to that segment's capsule alone; a stretch runs on past its nodes by the capsule's round
 * ends (so the bend's outer wedge is painted), but never back past the band's cut.
 */
function tipBand(ctx: CanvasRenderingContext2D, J: DragonRig['j'], d: number, hex: string): void {
  const tn = J.tailN, X = J.tailX, Y = J.tailY, R = J.tailR;
  // the cut: walk back from the end, into PT, and the segment it lies in (ks: nodes ks .. ks + 1)
  let rem = d - R[tn], ks = tn - 1;
  PT.x = X[tn]; PT.y = Y[tn];
  if (rem < 0) {
    const ux = X[tn] - X[tn - 1], uy = Y[tn] - Y[tn - 1], ul = Math.hypot(ux, uy) || 1;
    PT.x -= ux / ul * rem; PT.y -= uy / ul * rem;
  } else {
    for (ks = tn - 1; ks >= 0; ks--) {
      const ax = X[ks] - X[ks + 1], ay = Y[ks] - Y[ks + 1], L = Math.hypot(ax, ay) || 1;
      if (rem <= L || ks === 0) { const q = Math.min(1, rem / L); PT.x = X[ks + 1] + ax * q; PT.y = Y[ks + 1] + ay * q; break; }
      rem -= L;
    }
  }
  for (let i = ks; i < tn; i++) {
    const ux0 = X[i + 1] - X[i], uy0 = Y[i + 1] - Y[i], ul = Math.hypot(ux0, uy0) || 1, ux = ux0 / ul, uy = uy0 / ul;
    // (back past node i by its round end, but not behind the cut)
    const back = i === ks ? 0 : Math.min(R[i], Math.hypot(X[i] - PT.x, Y[i] - PT.y));
    const x0 = i === ks ? PT.x : X[i] - ux * back, y0 = i === ks ? PT.y : Y[i] - uy * back;
    const on = R[i + 1] + (i === tn - 1 ? 3 : 0);
    ctx.save();
    ctx.beginPath(); pathTaperedCapsule(ctx, X[i], Y[i], X[i + 1], Y[i + 1], R[i], R[i + 1], true); ctx.clip();
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(X[i + 1] + ux * on, Y[i + 1] + uy * on);
    ctx.lineWidth = 2 * Math.max(R[i], R[i + 1]) + 4; ctx.strokeStyle = hex; ctx.stroke();
    ctx.restore();
  }
}

// ---------- the nose frost ----------

/**
 * Face-space pixel (fx, fy)'s centre -> cranium space, into FC (faces.ts faceToCranium's walk: the face origin is the
 * eye, snapped as faceTransform snaps it).
 */
const FC = { x: 0, y: 0 };
function faceToCran(rig: DragonRig, fx: number, fy: number): void {
  const J = rig.j, t = rig.tf, sc = t.fs || 1;
  const X0 = Math.round(sc * (t.rx + J.eye.x)) / sc - t.rx, Y0 = Math.round(t.ss * (t.ry + J.eye.y)) / t.ss - t.ry;
  const a = J.headAng * D2R, c = Math.cos(a), s = Math.sin(a), hf = J.headFlip;
  const dx = X0 + hf * (fx + 0.5) - J.cran.x, dy = Y0 + (t.ss < 0 ? -1 : 1) * (fy + 0.5) - J.cran.y;
  FC.x = dx * c + dy * s; FC.y = hf * (-dx * s + dy * c);
}

/**
 * The NOSE FROST (3.8): the grey creeping in from the nose, a face-space bitmap of every skull pixel whose cranium x
 * is past a line slanting back 1 px for every 3 px down (the elder muzzle's edge, 2.5), in the smoke grey `marking`,
 * clipped to the skull by the rig: the front 3 px of the snout on the young, 5 on the adult, and on the elder back to
 * the eye line (its grey muzzle, drawn over it in the same grey, with its tuft and beard). The eye is never covered
 * (it stops 2 px short of the eye's ring: never a mask like Echo's); the nostril sits on it (98 %).
 */
const headMarkings: ElementDraw = (ctx, rig, _pose, info) => {
  const st = info.stage, J = rig.j;
  if (st === 'baby' || rig.override || J.headFlip < 0) return;
  const H = rig.dims.head, tip = H.snout.x1 + H.snout.r1, ring = H.eye.x + H.eye.w / 2;
  const x0 = st === 'young' ? tip - 3 : st === 'adult' ? tip - 5 : ring + 2;
  enterFaceFromCranium(ctx, rig, J.eye.x, J.eye.y);
  ctx.fillStyle = info.pal.marking;
  const R = Math.ceil(tip - H.eye.x + 3);
  for (let fy = -R; fy <= R; fy++) {
    let run = 0;
    for (let fx = -R; fx <= R + 1; fx++) {
      let on = false;
      if (fx <= R && facePixelInSkull(rig, fx, fy, -0.75)) { faceToCran(rig, fx, fy); on = FC.x >= x0 - 0.3 * FC.y; }
      if (on) run++;
      else if (run) { ctx.fillRect(fx - run, fy, run, 1); run = 0; }
    }
  }
  ctx.restore();
};

// ---------- the top pass: motes, moths, smoke ----------

/**
 * Top-pass draw: one mote, a 2 x 2 of `glow` (c0) in a 1 px ink ring (c1) on its four sides, corners open. it.x, it.y
 * = the mote's top-left.
 */
function drawMote(ctx: CanvasRenderingContext2D, it: TopItem): void {
  const s = it.sc, x = it.x, y = it.y;
  ctx.fillStyle = it.c1;
  ctx.fillRect(x - s, y, s, 2 * s); ctx.fillRect(x + 2 * s, y, s, 2 * s);
  ctx.fillRect(x, y - s, 2 * s, s); ctx.fillRect(x, y + 2 * s, 2 * s, s);
  ctx.fillStyle = it.c0; ctx.fillRect(x, y, 2 * s, 2 * s);
}
/** Top-pass draw: a moth glyph (it.a 1 = open, 0 = closed), its top-left at (it.x, it.y), mirrored with it.facing. */
function drawMothTop(ctx: CanvasRenderingContext2D, it: TopItem): void {
  const open = it.a > 0.5, rows = open ? MOTH_OPEN : MOTH_SHUT, w = open ? 5 : 3, h = rows.length, s = it.sc;
  // (cell x's screen x: counted from the right edge when mirrored)
  const x0 = it.facing < 0 ? it.x + (w - 1) * s : it.x, sx = it.facing < 0 ? -s : s;
  ctx.fillStyle = it.c1;
  for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
    if (mothOn(rows, w, x, y)) continue;
    if (mothOn(rows, w, x - 1, y) || mothOn(rows, w, x + 1, y) || mothOn(rows, w, x, y - 1) || mothOn(rows, w, x, y + 1)) ctx.fillRect(x0 + x * sx, it.y + y * s, s, s);
  }
  ctx.fillStyle = it.c0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mothOn(rows, w, x, y)) ctx.fillRect(x0 + x * sx, it.y + y * s, s, s);
}
/**
 * Top-pass draws for a puff of smoke at (it.x, it.y), radius it.a sprite px: its ring (c1, radius + 1) and its fill
 * (c0). The fizzle queues every ring before any fill, all opaque, so the two puffs merge into one curl in one ring.
 */
function drawPuffRing(ctx: CanvasRenderingContext2D, it: TopItem): void {
  ctx.fillStyle = it.c1; ctx.beginPath(); ctx.arc(it.x, it.y, (it.a + 1) * it.sc, 0, Math.PI * 2); ctx.fill();
}
function drawPuffFill(ctx: CanvasRenderingContext2D, it: TopItem): void {
  ctx.fillStyle = it.c0; ctx.beginPath(); ctx.arc(it.x, it.y, it.a * it.sc, 0, Math.PI * 2); ctx.fill();
}

const SCR = { x: 0, y: 0 };
/** Queue a mote at ROOT point (X, Y) (its 2 x 2's centre), at life fraction f (3 alpha steps, or 1: none). */
function pushMote(rig: DragonRig, info: DragonInfo, X: number, Y: number, f: number): void {
  rootToScreen(rig, Math.round(X), Math.round(Y), SCR);
  const s = rig.pxScale, it = rig.top!.push(drawMote, SCR.x - s, SCR.y - s, s, rig.facing);
  if (it) { it.c0 = info.pal.glow; it.c1 = rig.outline; it.alpha = f < 0 ? 1 : stepAlpha(f); }
}

/**
 * The orbit the motes and the visiting moth fly round the lamp (3.8: rx 7, ry 4; the baby's, under a bud that hangs
 * lower, 6 x 2), centred ahead of and below the lantern so its top passes a pixel of background under the lamp's foot
 * (`h`: the glyph's reach above its point, ink included: a mote's 2, the moth's 3) and its back end stays off the
 * chin: never across the glass or the finial (the first orbit's top crossed both, and the happy motes piled on the
 * lamp in a scribble: the v2 element review), kept 2 px over the floor. Point at turn u (0..1, from its front, going
 * down and back under the lamp) into PT, root space.
 */
function orbitPt(u: number, h: number, baby: boolean): void {
  const a = u * Math.PI * 2, rx = baby ? 6 : 7, ry = baby ? 2 : 4;
  const cy = Math.min(LF.foot + 2 + h + ry, LF.floor - 3 - ry);
  PT.x = LF.bx + 3 + Math.cos(a) * rx; PT.y = cy + Math.sin(a) * ry;
}


const AM_AGES = new Float32Array(2), AM_IDS = new Int32Array(2);
/** The adult's visiting moth's flight, frames: in from 20 px forward, twice round the lamp, off 24 px and out. */
const MOTH_IN = 16, MOTH_ROUND = 72, MOTH_OUT = 20, MOTH_LIFE = MOTH_IN + MOTH_ROUND + MOTH_OUT;

/**
 * Root space, drawing only into the top pass (1.4 step 14):
 *   - the HAPPY FLOURISH (4.3, cue 0): 3 motes leave the lamp 4 f apart and orbit it once on the moth's ellipse (24 f
 *     each, a quarter of a turn apart: orbitPt), then wink out beside it (the "comes home" of its breath; the first
 *     draft's rising fan copied fire's embers);
 *   - the BREATH's motes (3.8 Nightfall, breathTop): 4 (young 2) rise 12 px out of the bank's front over 24 f, 6 f
 *     apart from the stage's `moteAt` (cue 26; the elder's 44, after its finale ring), swaying together 1 px every
 *     4 f and blinking (8 f on, 2 off); the adult's last one turns back at age 8, flies home in 6 f and goes once
 *     round the lamp on the orbit (24 f) before it winks out beside it;
 *   - the FIZZLE's curl of smoke (the baby's breath): 2 puffs off its blown-out bud's front shoulder, rising 8 px over
 *     20 f, r 2 -> 3, then shrinking out, `marking` in ink rings, every ring before any fill;
 *   - the IDLE MOTE (awake, the lamp lit, mood >= 0): one mote now and then (every 300 +- 100 f) slips out of the lamp,
 *     goes once round it and winks out: the lamp is alive, and nothing rises off it (fire's embers do);
 *   - the adult's VISITING MOTH (its adult-only extra: 3.8): at mood >= 0 with the lamp lit, every 360 +- 120 f, a moth
 *     arrives from 20 px forward, circles the lamp twice (72 f), flutters off 24 px and shrinks out; its wings step
 *     every 4 f; it never rises above the cranium's top and never lands on the dragon. The elder has its own, living on
 *     the cap (two moths round an old head read as a confused old dragon: D21).
 * The flourish, the breath's motes and the smoke are act effects (no budget); the idle mote and the moth go through
 * the ambient caps (5.4) and stretch 1.5x in a crowd.
 */
const ambient: ElementDraw = (ctx, rig, pose, info) => {
  if (!rig.top || rig.override) return;
  lampFrame(rig, pose, info);
  const act = pose.act, c = pose.cue, st = info.stage;
  if (act === ACT.happy) {
    if (c >= 0) for (let i = 0; i < 3; i++) {
      const age = c - 4 * i;
      if (age < 0 || age >= 24) continue;
      // (a quarter of a turn apart: the 4 f stagger's sixth stacked two in an "8" at the orbit's back end, and the
      // first draft's extra 0.12 of a turn cancelled it, 2 px apart: the v2 element review)
      orbitPt(age / 24 - i / 12, 2, st === 'baby'); pushMote(rig, info, PT.x, PT.y, -1);
    }
    return;
  }
  if (act === ACT.breath) { breathTop(rig, pose, info); return; }
  if (info.asleep || !(act === ACT.none || act === ACT.walk || act === ACT.variant) || LF.lit < FULL || info.mood < 0) return;
  const stretch = rig.budget.stretch;
  let n = liveSpawns(info.seed + 11, info.tick, 300 * stretch, 100, 30, AM_AGES, AM_IDS);
  let left = rig.budget.take(rig.slot, n);
  for (let i = 0; i < n && left > 0; i++, left--) {
    const age = AM_AGES[i];
    orbitPt(age / 30 + hash01(info.seed, AM_IDS[i]) * 0.5, 2, st === 'baby'); pushMote(rig, info, PT.x, PT.y, -1);
  }
  if (st !== 'adult') return;
  n = liveSpawns(info.seed + 13, info.tick, 360 * stretch, 120, MOTH_LIFE, AM_AGES, AM_IDS);
  left = rig.budget.take(rig.slot, n);
  for (let i = 0; i < n && left > 0; i++, left--) pushMoth(rig, info, AM_AGES[i]);
};

/** Queue the visiting moth `age` frames into its flight. */
function pushMoth(rig: DragonRig, info: DragonInfo, age: number): void {
  let x: number, y: number, k = 2;
  orbitPt(0, 3, false);
  const ox = PT.x, oy = PT.y;
  if (age < MOTH_IN) { const u = 1 - age / MOTH_IN; x = ox + 20 * u; y = oy - 6 * u; }
  else if (age < MOTH_IN + MOTH_ROUND) { orbitPt((age - MOTH_IN) / (MOTH_ROUND / 2), 3, false); x = PT.x; y = PT.y; }
  else { const u = (age - MOTH_IN - MOTH_ROUND) / MOTH_OUT; x = ox + 24 * u; y = oy - 8 * u; k = u < 0.5 ? 2 : u < 0.8 ? 1 : 0; }
  // never above the cranium's top
  y = Math.max(y, rig.j.top + 2);
  rootToScreen(rig, Math.round(x), Math.round(y), SCR);
  const s = rig.pxScale;
  if (!k) {
    // shrunk out: the last of it a 2 x 2 speck of moth grey in its ring, then gone
    const it = rig.top!.push(drawMote, SCR.x - s, SCR.y - s, s, rig.facing);
    if (it) { it.c0 = info.pal.membrane; it.c1 = rig.outline; }
    return;
  }
  // (wings stepping open and closed every 4 f; folded, the smaller glyph, as it flies off)
  const open = k > 1 && Math.floor(age / 4) % 2 === 0;
  const it = rig.top!.push(drawMothTop, SCR.x - (open ? 2 : 1) * s, SCR.y - 2 * s, s, rig.facing);
  if (it) { it.a = open ? 1 : 0; it.c0 = info.pal.membrane; it.c1 = rig.outline; }
}

// ---------- the breath: Nightfall ----------

/**
 * The mist per stage (3.8, re-timed by the v2 element review): `n` lobes born every 3 f from cue 2 pour from the mouth
 * in one column, each leaving at r `r0` and falling over `fall` frames, grown to `rPour`, onto the floor under the chin,
 * `land` px ahead of the chest's front. Every other one (the odd lobes) is the pour's alone, sinking into the bank as
 * it lands; the even ones ARE the bank (the adult's and elder's 5, the young's 3: 3.8's count), each spreading to its
 * own size (`sizes`: a lumpy top, a cloud) as it rolls along the floor to its place (`rolls`, px from where it landed):
 * the first out forward, the next back toward the paws, and so on, closer in each time, so the bank spreads both ways
 * from the pour as a mist landing does, creeping out to about 34 px ahead of the chest (young 25, elder 38). (Rolled
 * only forward, the lobes bunched into one smooth pill, and the growing bank and the pour made a boot.) It lies there
 * whole until it shrinks away lobe by lobe, the rearmost first, the front lobe gone at cue `end` (the anim's last
 * frame: nightfallAnim). Its motes, and whether the last one comes home to the lamp.
 */
interface MistSpec {
  n: number; r0: number; rPour: number; land: number; rolls: readonly number[]; sizes: readonly number[]; fall: number;
  end: number; motes: number; moteAt: number; home: boolean;
}
const MIST: Readonly<Record<Stage, MistSpec>> = {
  baby: { n: 0, r0: 2, rPour: 2, land: 0, rolls: [0], sizes: [3], fall: 1, end: 0, motes: 0, moteAt: 0, home: false },
  young: {
    n: 5, r0: 2.5, rPour: 4, land: 13, rolls: [7, -5, 1], sizes: [5, 4, 4.5], fall: 14, end: 60, motes: 2, moteAt: 26,
    home: false,
  },
  adult: {
    n: 9, r0: 2.5, rPour: 5, land: 18, rolls: [10, -8, 5.5, -3.5, 1], sizes: [5, 4.5, 6, 5.5, 4], fall: 16, end: 82,
    motes: 4, moteAt: 26, home: true,
  },
  // the elder's slow, wise breath: the adult's stream at 1.1x reach over its longer sustain, then the finale ring
  // (its front lobe, rising off the bank) and only then its motes; none comes home (3.8: the adult's; the elder's
  // lamp has its moth)
  elder: {
    n: 9, r0: 2.5, rPour: 5, land: 23, rolls: [9, -8, 5, -3.5, 0.5], sizes: [5, 4.5, 6, 5.5, 4], fall: 16, end: 86,
    motes: 4, moteAt: 44, home: false,
  },
};
/**
 * The breath's motes rise out of the bank's front, ahead of the pour, from the stage's `moteAt`, 6 f apart, each this
 * far ahead of where the pour lands, px (the adult's; the others' in proportion to their bank): two in the air 6 f
 * apart are 6 px apart across, 12 f apart 6 px apart up (the first build's, 3 px apart, chained into one scribble: the
 * v2 element review).
 */
const MOTE_X: readonly number[] = [9, 15, 10, 16];
/** Frames a bank lobe shrinks over at its end (3 steps: 5.1 #14, never alpha), and between one lobe's end and the next's. */
const MIST_FADE = 9, MIST_STEP = 2.5;
const LB = { x: 0, y: 0, r: 0, ry: 0 };

/**
 * Where mist lobe k is at cue c, ROOT space, into LB (centre, radius, and its height ry; LB.r 0 = not there). Born at
 * cue 2 + 3k at the mouth at r `r0`, it POURS to the floor under the chin over `fall` frames, out and down in an arc
 * (forward on an ease-out, down on a steady fall that gathers a little speed, 0.7 v + 0.3 v^2: lobes 3 f apart
 * overlap into one column, where the first build's quadratic fall, 5 f apart, spread them into a string of drips),
 * each a pixel to one side or the other of the last so the column's edges billow; round as it falls. An odd lobe then
 * sinks into the bank (shrinking out over 4 f); an even one FLATTENS (ry 0.9 r -> 0.6 r over 4 f, a low bank) and
 * ROLLS forward along the floor, easing from 1 px/f to its place in the bank. It rests on the floor, its ring's lowest
 * row on the floor line; over its last 9 f it shrinks away in 3 steps, the rear lobe first.
 */
function lobeAt(rig: DragonRig, pose: DragonPose, st: Stage, k: number, c: number): void {
  const Mi = MIST[st], J = rig.j, d = rig.dims, age = c - 2 - 3 * k, bank = k % 2 === 0, j = k >> 1;
  // (a bank lobe ends MIST_STEP frames before each one that lies ahead of it: the rearmost first)
  let ahead = 0;
  if (bank) for (let i = 0; i < Mi.rolls.length; i++) if (Mi.rolls[i] > Mi.rolls[j]) ahead++;
  const dieAt = bank ? Mi.end - 1 - MIST_STEP * ahead : 2 + 3 * k + Mi.fall + 4;
  LB.r = 0;
  if (age < 0 || c >= dieAt) return;
  const xL = d.gap / 2 + d.chestR + Mi.land, rk = bank ? Mi.sizes[j] : Mi.rPour;
  // (the pour thin, every other lobe a size smaller; a bank lobe spreads to its own size over its first 8 f down)
  let r = age < Mi.fall ? (Mi.r0 + (Mi.rPour - Mi.r0) * age / Mi.fall) * (bank ? 1 : 0.75)
    : bank ? Mi.rPour + (rk - Mi.rPour) * Math.min(1, (age - Mi.fall) / 8) : Mi.rPour * 0.75;
  const fade = c - (dieAt - (bank ? MIST_FADE : 4));
  if (fade >= 0) r = Math.max(1, bank ? r * (fade < 3 ? 0.75 : fade < 6 ? 0.5 : 0.3) : r * (fade < 2 ? 0.7 : 0.4));
  if (age < Mi.fall) {
    // (out along the snout on an ease-out and down, billowing a pixel and a half to either side mid-fall)
    const v = age / Mi.fall, mx = J.mouth.x, my = J.mouth.y, ry = r * 0.9;
    const rest = floorAt(pose, xL) - ry - 1, side = (k % 2 ? 2 : -1.5) * Math.sin(Math.PI * v);
    LB.x = mx + (xL - mx) * (1 - (1 - v) * (1 - v)) + side;
    LB.y = my + (rest - my) * (0.7 * v + 0.3 * v * v);
    LB.r = r; LB.ry = ry;
    return;
  }
  const D = bank ? Mi.rolls[j] : 0, T = Math.max(1, 2 * Math.abs(D));
  const u = Math.min(1, (age - Mi.fall) / T);
  LB.x = xL + D * (1 - (1 - u) * (1 - u));
  LB.ry = r * (0.9 - 0.3 * Math.min(1, (age - Mi.fall) / 4));
  LB.y = floorAt(pose, LB.x) - LB.ry - 1;
  LB.r = r;
}

/** A lobe's ellipse filled flat (its ring is the same ellipse 1 px larger each way, drawn first). */
function lobe(ctx: CanvasRenderingContext2D, rig: DragonRig, x: number, y: number, rx: number, ry: number, hex: string): void {
  ctx.beginPath(); ctx.ellipse(Math.round(x), Math.round(y), rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = rig.col(hex); ctx.fill();
}

/**
 * The signature: NIGHTFALL (3.8), the only breath that goes DOWN and lies on the floor. Mouth space in; the mist is
 * drawn in root space. A lobe is born every 3 f from cue 2 (9 of them, young 5), and they pour from the mouth in one
 * billowing column onto the floor under the chin, where every other one sinks into the bank and the rest spread out
 * both ways along it into one long, low bank reaching 34 px ahead of the chest (young 25), which lies there whole
 * through the recover (16 f or more) and then shrinks away lobe by lobe, the rearmost first (MIST, lobeAt). Opaque `membrane` lobes, each in a 1 px `scale` ring, EVERY RING BEFORE ANY FILL so column and bank
 * read as one cloud (fire's smoke technique). (The first build's 5 lobes, 5 f apart, fell in a string of separate
 * ringed discs, drool or bubbles, and piled into one lump under the lamp that read as a stone: the v2 element
 * review.) The elder's FINALE (cue 32 to 44): the bank's front lobe lifts off the floor as one ring of mist that
 * widens and drifts up and forward, away from the face, 2 px of `membrane` between 1 px `scale` edges. The baby's
 * FIZZLE: one huff of 2 small lobes rises from its mouth into its own bud (cue 0 to 6), which goes out (lampFrame);
 * the smoke is the top pass's (breathTop).
 */
const breath: ElementDraw = (ctx, rig, pose, info) => {
  if (pose.act !== ACT.breath || rig.override) return;
  const st = info.stage, c = pose.cue;
  ctx.save();
  mouthToRoot(ctx, rig, info.ang);
  if (st === 'baby') { huff(ctx, rig, info, c); ctx.restore(); return; }
  const Mi = MIST[st], elder = st === 'elder';
  for (let pass = 0; pass < 2; pass++) {
    for (let k = Mi.n - 1; k >= 0; k--) {
      // (the elder's front lobe becomes the finale's ring at cue 32)
      if (elder && k === 0 && c >= 32) continue;
      lobeAt(rig, pose, st, k, c);
      if (LB.r > 0) lobe(ctx, rig, LB.x, LB.y, pass ? LB.r : LB.r + 1, pass ? LB.ry : LB.ry + 1, pass ? info.pal.membrane : info.pal.scale);
    }
  }
  if (elder && c >= 32 && c < 44) {
    lobeAt(rig, pose, st, 0, 31);
    const u = (c - 32) / 12, R = Math.round(4 + 5 * u), x = Math.round(LB.x + 6 * u);
    const y = Math.round(floorAt(pose, x) - R - 2 - 6 * u);
    ringOf(ctx, rig, x, y, R + 1, R - 3, info.pal.scale);
    ringOf(ctx, rig, x, y, R, R - 2, info.pal.membrane);
  }
  ctx.restore();
};
/** An annulus (outer radius R, inner r) filled flat. */
function ringOf(ctx: CanvasRenderingContext2D, rig: DragonRig, x: number, y: number, R: number, r: number, hex: string): void {
  if (R <= 0) return;
  ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2);
  if (r > 0) ctx.arc(x, y, r, 0, Math.PI * 2, true);
  ctx.fillStyle = rig.col(hex); ctx.fill('evenodd');
}

/**
 * The baby's huff (3.8 "it blows out its own nightlight"), root space: 2 lobes, r 2 -> 3, leave its mouth at cue 0
 * and 2 and rise into its own bud over 6 f (`membrane` in `scale` rings, rings before fills); at cue 6 the bud goes out.
 */
function huff(ctx: CanvasRenderingContext2D, rig: DragonRig, info: DragonInfo, c: number): void {
  const J = rig.j;
  for (let pass = 0; pass < 2; pass++) {
    for (let k = 0; k < 2; k++) {
      const age = c - 2 * k;
      if (age < 0 || age >= 6 - k) continue;
      const u = age / 6, r = 2 + u, x = J.mouth.x + (LF.bx - J.mouth.x) * u, y = J.mouth.y + (LF.by - J.mouth.y) * u * (0.6 + 0.4 * u);
      lobe(ctx, rig, x, y, pass ? r : r + 1, pass ? r : r + 1, pass ? info.pal.membrane : info.pal.scale);
    }
  }
}

/**
 * The breath's top-pass particles (ambient calls it while act = breath): the motes rising out of the mist (and the
 * adult's and elder's last one coming home to the lamp), and the baby's curl of smoke off its blown-out bud.
 */
function breathTop(rig: DragonRig, pose: DragonPose, info: DragonInfo): void {
  const st = info.stage, c = pose.cue, Mi = MIST[st];
  if (st === 'baby') {
    // the curl of smoke: 2 puffs off the bud's front shoulder, clear of its hook, r 2 -> 3: each starts with its ring
    // 2 px over the cap's ink and rises 3 px in its first 4 f, then 5 more over 16 f, drifting forward, the two
    // swaying opposite ways, and shrinks out (from the bud's middle the first puff sat on the relit bud, a snowman)
    const M = MASK.baby, cap = LF.y3 + M.capTop - 1;
    for (let pass = 0; pass < 2; pass++) for (let k = 0; k < 2; k++) {
      const age = c - 6 - 3 * k;
      if (age < 0 || age >= 20) continue;
      const u = age / 20, r = u < 0.3 ? 2 : u < 0.7 ? 3 : u < 0.85 ? 2 : 1;
      const sway = (Math.floor(age / 5) + k) % 2 ? 1 : -1, rise = 3 * Math.min(1, age / 4) + 5 * Math.max(0, (age - 4) / 16);
      rootToScreen(rig, Math.round(LF.bx + 3 + sway + 3 * u), Math.round(cap - 5 - rise), SCR);
      const it = rig.top!.push(pass ? drawPuffFill : drawPuffRing, SCR.x, SCR.y, rig.pxScale, rig.facing);
      if (it) { it.a = r; it.c0 = info.pal.marking; it.c1 = rig.outline; }
    }
    return;
  }
  const d = rig.dims, xL = d.gap / 2 + d.chestR + Mi.land;
  for (let i = 0; i < Mi.motes; i++) {
    const age = c - Mi.moteAt - 6 * i;
    const home = Mi.home && i === Mi.motes - 1;
    if (age < 0 || age >= (home ? 38 : 24)) continue;
    const x0 = xL + MOTE_X[i] * (Mi.rolls[0] + Mi.sizes[0]) / 15, y0 = floorAt(pose, x0) - 10;
    if (home && age >= 8) {
      // it comes home: 6 f to the lamp, once round it on the orbit (24 f), and out beside it
      const ex = x0 - 1, ey = y0 - 4;
      if (age < 14) {
        orbitPt(0, 2, false); const u = (age - 8) / 6;
        pushMote(rig, info, ex + (PT.x - ex) * u, ey + (PT.y - ey) * u, -1);
      } else { orbitPt((age - 14) / 24, 2, false); pushMote(rig, info, PT.x, PT.y, -1); }
      continue;
    }
    // blinking: 8 f on, 2 off
    if (age % 10 >= 8) continue;
    // (all swaying together, on the act's clock, so their spacing holds)
    const sway = Math.floor(c / 4) % 2 ? 1 : -1;
    pushMote(rig, info, x0 + sway, y0 - age * 12 / 24, age / 24);
  }
}

// ---------- anims (4.3): the lantern carry, the lamplight search, the tell, the fizzle, the lamp-bat ----------

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
 * WALK (4.3): the LANTERN CARRY. The shared gait with dusk's tuning (0.4 px/f, young 0.45, baby 0.28; paw lift 2.5 /
 * 2 / 1.5; the elder's own 64 f at 0.34 with its 2 px lift), the head held level with its counter-bob halved (0.5 px),
 * so the lamp is carried steady and only the lantern swings, a beat behind the stride (lampSwing); the tail lifted
 * 4 deg (it droops, trailing like smoke, never above the back line: fire's zone).
 */
function carryAnim(stage: Stage, dims: DragonDims | null): DragonAnim {
  const a = walkAnim(stage, animTuning(stage, DUSK).walk, dims);
  return eachFrame(a, (_t, p) => {
    const nk = (p.neck ??= {}), tl = (p.tail ??= {}), hd = (p.head ??= {});
    nk.a0 = (nk.a0 ?? 0) * 0.5;
    tl.lift = (tl.lift ?? 0) - 4;
    // (the baby's heavy-headed wobble halved too, but not its stumble's face-plant)
    if (stage === 'baby' && Math.abs(hd.rot ?? 0) <= 3) hd.rot = (hd.rot ?? 0) * 0.5;
  });
}

/**
 * BEG (4.3): SEARCHING BY LAMPLIGHT. The shared sit at `mood` -0.5 (the lamp a crescent, the stalk drooping), the head
 * LOWERED so the lamp hangs low over where the bowl goes, peering at the empty spot (f 0-40): the neck carried down
 * 50 deg and the head 28 over the sit (3.8's 18 on the head alone left the lamp 30 px up by the sitting dragon's
 * chin; this way its foot hangs 3 to 6 px over the floor; the baby bows its body 16, its head 36 and its neck 24,
 * its bud's foot about 5 px up); it looks up at the owner (f 50-90, the stomach's growl landing
 * there, and the lamp swinging 2 px with each shake: lampSwing), then peers again. No guttering: that is tired's alone
 * (3.8's lexicon). The elder's 140 f loop scales every beat.
 */
const PEER_HEAD = 28, PEER_NECK = 50;
function searchAnim(stage: Stage): DragonAnim {
  const a = begAnim(stage, animTuning(stage, DUSK)), q = stage === 'elder' ? 140 / 120 : 1, L = Math.round(120 * q), baby = stage === 'baby';
  const peer = (t: number): number => {
    const u = t / q;
    return u < 40 ? 1 : u < 50 ? 1 - smooth((u - 40) / 10) : u < 90 ? 0 : u < 100 ? smooth((u - 90) / 10) : 1;
  };
  return eachFrame(a, (t, p) => {
    const hd = (p.head ??= {}), nk = (p.neck ??= {}), bd = (p.body ??= {});
    // (the elder peers at 0.8x, as its fidget's gestures play: FIDGET_TIMING; the baby's hidden neck only bows its
    // head, so it takes a third of the neck's reach: at the full 50 its face sank into its chest)
    const k = peer(t % L) * FIDGET_TIMING[stage].amp;
    hd.rot = (hd.rot ?? 0) + (baby ? 36 : PEER_HEAD) * k;
    nk.a0 = (nk.a0 ?? 0) + (baby ? 24 : PEER_NECK) * k;
    // (the baby bows its whole body forward out of the sit, 16 deg, as it bows to eat, and its head past its begging
    // tilt: 20 on the head and 16 on the neck left its bud 22 px up, at head height, and the peer and the look up read
    // the same: the v2 element review)
    if (baby) bd.rot = (bd.rot ?? 0) + 16 * k;
  });
}

/**
 * TUCKIN (3.8's care hook, bedtime; an element anim like fire's `bath`, played when the owner pets it once it has lain
 * down; a loop with its intro, ending in the shared sleep loop): it lies down as it does to sleep, but AWAKE, its lamp
 * set down on the floor still lit (the untucked Wick, which "lies awake with its lamp lit"), and waits, eyes lidded,
 * for 60 f (the adult's; x the stage's lie-down); the tuck-in (60-96): petted, it purrs, `happy`; then its lamp turns
 * down in steps (full, the crescent, the sliver, the new-moon nightlight: 96-116) as its eyes close, and it sleeps
 * well. pose.fx carries the lamp's level while it lies awake (lampFrame: 1 full .. 0 the nightlight); act = sleep and
 * cue 0 through the tuck-in, so the lamp lies on the floor. A baby's is its nightlight the same way, in its bun.
 */
function tuckinAnim(stage: Stage, dims: DragonDims | null): DragonAnim {
  const sl = sleepAnim(stage, dims, animTuning(stage, DUSK)), fr = sl.frames, from = sl.loopFrom || 0;
  const k = animTuning(stage, DUSK).sleep.lieDown / 40, T = (f: number) => Math.round(f * k);
  const frames: DragonFrame[] = [];
  // the lie-down, awake: lidded where it would close its eyes, the sleep switch left off, the lamp lit
  for (let i = 0; i < from; i++) {
    const f = fr[i], p: PartialDragonPose = { ...(f.pose || {}), sleep: 0, fx: 1 };
    const fc = dfaceIndex(p.face);
    if (fc === DFACE.closed) p.face = DFACE.sleepy;
    frames.push({ ...f, pose: p });
  }
  const rest = fr[from].pose || {}, tail = rest.tail || {}, body = rest.body || {};
  const L = T(120);
  for (let t = 0; t < L; t += 2) {
    const pet = t >= T(60) && t < T(96);
    const lvl = t < T(100) ? 1 : t < T(106) ? 0.6 : t < T(112) ? 0.3 : 0;
    const face = t >= T(112) ? DFACE.closed : pet ? DFACE.happy : DFACE.sleepy;
    frames.push({
      dur: 2,
      pose: {
        ...rest, body: { ...body, y: (body.y ?? 0) + (pet && (t / 2) % 2 ? 0.6 : 0) }, tail: { ...tail },
        face, fx: lvl, sleep: t >= T(116) ? 1 : 0, mood: pet ? 0.5 : 0, cue: 0,
      },
    });
  }
  const loopFrom = frames.length;
  for (let i = from; i < fr.length; i++) frames.push(fr[i]);
  return { loop: true, frames, loopFrom, ...(sl.tailSway ? { tailSway: sl.tailSway } : {}) };
}

/**
 * WAKE (4.3): the shared wake (the lamp switched on as the eyes first open and refilled by the nap: lampFrame), with the
 * long tail kept low: the chain faded to 0.3 through it. Let go as the play-bow's pitch lifted off it, dusk's tail (x 1.2,
 * the cast's fullest but water's) swung up past 45 deg over the rump, into fire's zone above the tail tip (3.0).
 */
function relightAnim(stage: Stage, dims: DragonDims | null): DragonAnim {
  return eachFrame(wakeAnim(stage, dims, animTuning(stage, DUSK)), (_t, p) => {
    const tl = (p.tail ??= {});
    tl.stiff = Math.max(0.7, tl.stiff ?? 0);
  });
}

/**
 * BREATH (3.8 Nightfall), young and older: the shared breath with its tell and its event. The TELL: the lamp turns up
 * in two steps (lampFrame) and the eyes close for the wind-up's last 4 f (it makes a wish); `event: 'hush'` at the
 * snap (cue 0), meant to calm the neighbours (5.4: nothing consumes it yet). The anim runs on after the shared
 * recover, holding its last pose, to the mist's `end` (cue 60 / 82 / 86: the bank lies whole through the recover and
 * then shrinks away, and the adult's last mote comes home to the lamp: breathTop); 75 / 101 / 109 f in all.
 */
function nightfallAnim(stage: Stage): DragonAnim {
  const a = breathAnim(stage, animTuning(stage, DUSK));
  eachFrame(a, (_t, p, f) => {
    const c = p.cue ?? 0;
    if (c >= -4 && c < 0) p.face = DFACE.closed;
    if (c === 0) f.event = 'hush';
  });
  return extendOneShot(a, MIST[stage].end - (a.frames[a.frames.length - 1].pose?.cue ?? 0));
}
/** Append `n` frames holding a one-shot's last pose, its act's clock running on (2 f a frame). */
function extendOneShot(a: DragonAnim, n: number): DragonAnim {
  const last = a.frames[a.frames.length - 1], p = last.pose || {}, c0 = p.cue ?? 0;
  last.dur = 2;
  for (let i = 1; i <= n / 2; i++) a.frames.push({ dur: i === n / 2 ? 1 : 2, pose: { ...p, cue: c0 + 2 * i } });
  return a;
}

/**
 * The baby's breath (3.8): IT BLOWS OUT ITS OWN NIGHTLIGHT. 48 f (the shared fizzle's 36, with the "phew" and the
 * sheepish end given time to read). It puffs up round (squash 1.10) for the wind-up, jaw 20 at the snap (cue 0, f 10);
 * one huff rises into its own bud (breath: huff) and at cue 6 the bud goes OUT, a curl of smoke rising off it
 * (breathTop); `surprised` for 8 f (a blink of "oh!", never fear: the v2 review); at cue 14 the bud flickers back on
 * (on 2, off 2, on) with a "phew" -- a 1 px sag of the body and a slow blink -- then `sheepish` with the 2 px
 * sneeze-back. No event: a baby's breath hushes no one.
 */
function babyBreath(): DragonAnim {
  const L = 48, N = DFACE.neutral;
  return bake({
    squash: [[0, 1], [7, 1.1, 'out'], [16, 1.1], [19, 1], [L, 1]],
    'head.rot': [[0, 0], [10, -8], [13, -3, 'out'], [16, -3], [22, 0], [L, 0]],
    'neck.a0': [[0, 0], [10, -4], [16, -4], [24, 0]],
    jaw: [[0, 0], [8, 0], [10, 20], [16, 20], [17, 0]],
    'body.y': [[0, 0], [24, 0], [27, 1], [33, 1], [37, 0]],
    'root.x': [[0, 0], [33, 0, 'out'], [35, -2], [42, -2], [L, 0]],
    'tail.stiff': [[0, 0], [6, 1], [22, 1], [L, 0]],
    face: [[0, N], [16, DFACE.surprised], [24, DFACE.sleepy], [26, DFACE.closed], [30, DFACE.sleepy], [32, DFACE.sheepish], [46, N]],
    act: [[0, ACT.breath]], cue: [[0, -10], [L, L - 10]],
  }, { stage: 'baby', len: L, next: 'idle' });
}

/**
 * IDLE with THE LAMP BREATHING (3.8 ambient: "its core shows for 16 f at the top of every other inhale, stepped, like
 * water's spots"): the shared idle, resampled every 2 f over two of its loops (the player's own ease, so the motion is
 * the shared one), with pose.fx 1 for 16 f round every other inhale's peak (the body's highest point: a local minimum
 * of body.y), which lampFrame reads while act = none. Built once per stage, when the table is.
 */
function breathingIdle(stage: Stage): DragonAnim {
  const src = baseAnims(stage).idle, fr = src.frames;
  let len = 0;
  for (const f of fr) len += f.dur || 1;
  const n = Math.round(len / 2), P = makeDragonPose(), ys = new Float32Array(n);
  const poses: DragonPose[] = [];
  for (let i = 0; i < n; i++) {
    let t = i * 2, j = 0;
    while (j < fr.length - 1 && t >= (fr[j].dur || 1)) { t -= fr[j].dur || 1; j++; }
    const f = fr[j], next = j + 1 < fr.length ? fr[j + 1] : fr[src.loopFrom || 0];
    let u = Math.min(1, t / (f.dur || 1));
    if (f.ease) u = ease(f.ease, u);
    lerpDragonPose(f.pose, next.pose, u, P);
    if (f.face != null) P.face = dfaceIndex(f.face);
    poses.push(makeDragonPose(P as unknown as PartialDragonPose));
    ys[i] = P.body.y;
  }
  // the inhale peaks: samples lowest within 24 f either way (wrapped), and within 0.3 px of the lowest
  let lo = Infinity;
  for (let i = 0; i < n; i++) lo = Math.min(lo, ys[i]);
  const peaks: number[] = [];
  for (let i = 0; i < n; i++) {
    let best = true;
    for (let d = 1; d <= 12 && best; d++) if (ys[(i + d) % n] < ys[i] - 1e-6 || ys[(i - d + n) % n] <= ys[i] - 1e-6) best = false;
    if (best && ys[i] <= lo + 0.3 && (!peaks.length || i - peaks[peaks.length - 1] > 6)) peaks.push(i);
  }
  const frames: DragonFrame[] = [];
  for (let loop = 0; loop < 2; loop++) for (let i = 0; i < n; i++) {
    const idx = loop * peaks.length;
    let on = false;
    for (let k = 0; k < peaks.length; k++) if ((idx + k) % 2 === 0 && Math.abs(i - peaks[k]) * 2 < BREATH_CORE / 2) on = true;
    frames.push({ dur: 2, pose: { ...(poses[i] as unknown as PartialDragonPose), fx: on ? 1 : 0, act: ACT.none, cue: loop * len + i * 2 } });
  }
  const a: DragonAnim = { loop: true, frames };
  if (src.tailSway) a.tailSway = src.tailSway;
  return a;
}

/**
 * The idle FIDGET (3.8): THE LAMP-BAT, a kitten batting a toy (adult 93 f; young x 0.85, elder x 1.3 with its head
 * tracking and the lamp's swings at 0.8x: FIDGET_TIMING; the baby's 70 f x 0.6). 0-10 it notices (the lamp kicks
 * 2 px, `surprised`); 10-22 it sits back (body -22) and tucks its chin, DANGLING the lamp in front of its chest
 * (BAT_SIT); 22-25 swipe 1 (the near front leg off the floor, reaching forward and up), the paw landing on the
 * lantern's foot at 25, and the lamp swings away 5 px from that frame; 28-40 it tracks the swing with its head
 * (+-5); 40-46 swipe 2 misses (the lamp is swung away); 46-52 BONK: the lamp swings back into its snout, the head
 * rears off it, the eyes `closed` 4 f, the core flashes (and the elder's moth flicks); 52-62 `happy`; 62-81 it
 * stands back up over 19 f (the elder's 25), the tail's lift eased out with the pitch and the tail held stiff to 81,
 * let go by 93. The baby, whose bud hangs out of any reach of its paw (the curl is longer than its leg), swings at it,
 * misses and topples onto its rump, and blinks there, `happy`, its bud jolted swinging by the topple. act = fidget,
 * cue = its clock (the lamp's swing keys on it: lampSwing).
 */
function batAnim(stage: Stage): DragonAnim {
  const FT = FIDGET_TIMING[stage], k = FT.dur, g = FT.amp, L = Math.round((stage === 'baby' ? 70 : 93) * k), t = (f: number) => Math.round(f * k);
  const G = (keys: readonly (readonly [number, number])[]): Key[] => keys.map(([f, v]) => [t(f), v * g] as const);
  const N = DFACE.neutral, baby = stage === 'baby';
  if (baby) {
    return bake({
      'body.rot': G([[0, 0], [10, 0], [20, -16], [24, -16], [58, -16], [66, 0]]),
      'body.y': G([[0, 0], [10, 0], [20, 2], [58, 2], [66, 0]]),
      'root.rot': G([[0, 0], [24, 0], [28, -14], [32, -12], [56, -12], [64, 0]]),
      'legNH.slide': G([[0, 0], [10, 0], [20, 1.5], [60, 1.5], [66, 0]]), 'legFH.slide': G([[0, 0], [10, 0], [20, 1.5], [60, 1.5], [66, 0]]),
      'legNF.plant': [[0, 1], [t(21), 1], [t(22), 0], [t(58), 0], [t(62), 1]],
      'legNF.upper': G([[0, 0], [22, 0], [25, 70], [30, 20], [58, 20], [62, 0]]),
      'legFF.plant': [[0, 1], [t(27), 1], [t(28), 0], [t(58), 0], [t(62), 1]],
      'legFF.upper': G([[0, 0], [28, 0], [30, 20], [58, 20], [62, 0]]),
      'head.rot': lag([[0, 0], [4, -4], [10, -2], [22, -8], [30, -4], [58, -4], [66, 0]].map(([f, v]) => [t(f), v] as const), 3, 1),
      'tail.stiff': [[0, 0], [t(8), 0.85], [t(60), 0.85], [L, 0]],
      face: [[0, DFACE.surprised], [t(8), N], [t(28), DFACE.closed], [t(31), DFACE.happy], [t(62), N]],
      act: [[0, ACT.fidget]], cue: [[0, 0], [L, L]],
    }, { stage, len: L, next: 'idle' });
  }
  // the sit: the body pitched back, and the head DANGLING the lamp for the paw (the v2 element review: sat back with
  // its nose up, the lantern hung 20 px above and ahead of the paw's reach, and the swipes waved at nothing): the
  // neck drawn back up over the chest and the chin tucked (the head pitched down), so the crook arches out over its
  // chest and the lantern hangs in front of it, where the near front paw reaches; the tail lowered to the floor
  // behind the rump as the airing lowers it, held stiff until the rump is down again (the stand-up over 19 f, the
  // tail's lift eased out with the pitch: stood up in 8 f with the tail let go, it folded under the rump)
  const S = BAT_SIT[stage], nk = S.neck, hd = S.head;
  // (each swipe: up to the lamp's foot in 3 f, the paw landing on it at the peak, then down to the waiting 60)
  const swipe = (a: number, b: number): (readonly [number, number])[] => [[a, 0], [a + 3, S.up], [b, 60]];
  const K = (keys: readonly (readonly [number, number])[]): Key[] => keys.map(([f, v]) => [t(f), v] as const);
  return bake({
    'body.rot': K([[0, 0], [10, 0], [22, S.body], [62, S.body], [81, 0]]),
    'body.y': K([[0, 0], [10, 0], [22, 3], [62, 3], [81, 0]]),
    'legNH.slide': K([[0, 0], [10, 0], [22, 4], [62, 4], [81, 0]]), 'legFH.slide': K([[0, 0], [10, 0], [22, 4], [62, 4], [81, 0]]),
    // the bonk: it rears its head back off the lamp (47-49) and settles again
    'neck.a0': K([[0, 0], [6, -3], [22, nk], [47, nk], [49, nk - 4], [54, nk], [62, nk], [81, 0]]),
    // (tracking the swing: nose after the lamp, +-5 x the stage's gesture)
    'head.rot': K([[0, 0], [4, -4], [10, -2], [22, hd], [28, hd - 5 * g], [34, hd + 4 * g], [40, hd - 2 * g], [46, hd], [47, hd], [49, hd - 12 * g], [54, hd], [62, hd], [81, 0]]),
    'legNF.plant': [[0, 1], [t(21), 1], [t(22), 0], [t(56), 0], [t(62), 1]],
    'legNF.upper': K([[0, 0], ...swipe(22, 29), [40, 60], ...swipe(40, 46), [52, 40], [58, 0]]),
    'legNF.lower': K([[0, 0], [22, 0], [25, S.low], [29, 0], [40, 0], [43, S.low], [46, 0], [58, 0]]),
    'tail.stiff': [[0, 0], [t(8), 0.85], [t(81), 0.85], [L, 0]],
    'tail.lift': K([[0, 0], [22, 11], [62, 11], [81, 0]]),
    face: [[0, DFACE.surprised], [t(8), N], [t(47), DFACE.closed], [t(51), N], [t(52), DFACE.happy], [t(62), N]],
    act: [[0, ACT.fidget]], cue: [[0, 0], [L, L]],
  }, { stage, len: L, next: 'idle' });
}

/**
 * The lamp-bat's sit per stage, measured on the rig so the swipe's peak puts the near front paw on the lantern's
 * foot: the body's pitch, the neck drawn back (a0), the chin tucked (head, + down), the swipe's upper and lower.
 */
const BAT_SIT: Readonly<Record<Stage, Readonly<{ body: number; neck: number; head: number; up: number; low: number }>>> = {
  baby: { body: -16, neck: 0, head: -8, up: 70, low: 0 },
  young: { body: -22, neck: -60, head: 75, up: 140, low: -20 },
  adult: { body: -22, neck: -60, head: 85, up: 140, low: -20 },
  elder: { body: -22, neck: -70, head: 100, up: 145, low: -40 },
};

export const DUSK: ElementSpec = {
  id: 'dusk',
  name: 'Wick',
  blurb: 'Gentle, dreamy and sleepy: the early sleeper. It carries its lamp into the evening and likes to be tucked in at bedtime.',
  palette: PAL,
  // 3.8's build (v2, after the care review: its first build was slinkwing's in six of eight columns): soft and
  // sleepy, a deep round body (1.2) low on short legs (0.85), thin and flat (x 0.76: the adult hind root under FLAT_R,
  // so no shadow band a far leg would have to clear: D8, E4), a short soft snout (0.8), a plain neck carried a little
  // up (+6 deg: the stargazing +12 read proud and alert), a long, full, drooping tail (1.2, r 1.0) trailing like
  // smoke. Body length 1.0: at 0.95 the baby walk's far front root lay 0.2 px inside the chest (the leg-root audit
  // wants 0.25; 5.1 #5)
  modifiers: {
    bodyLength: 1.0, bodyDepth: 1.2, legLength: 0.85, legR: 0.76, neckLength: 1.0, neckAngle: 6, tailLength: 1.2,
    tailR: 1.0, snout: 0.8,
  },
  stages: {
    // the first marking is the smoke tail tip (tailTip: the shared kinds have no stepped `tip`), the second the nose
    // frost (headMarkings), so no shared marking is listed: the baby carries its tip alone (D15)
    baby: {
      tailRest: TAIL_REST.dusk.baby, horns: null, markings: [],
      wing: wingParams({ style: 'bat' }), dorsal: null,
    },
    young: {
      tailRest: TAIL_REST.dusk.young, horns: null, markings: [],
      wing: wingParams({ style: 'bat', scallop: -1 }), dorsal: null,
    },
    adult: {
      tailRest: TAIL_REST.dusk.adult, horns: null, markings: [],
      wing: wingParams({ style: 'bat', scallop: -1.5 }), dorsal: null,
    },
    // the elder (3.8's Elder column): the elder's posture with dusk's +6 deg on top (2.3: net 58 / 28), the storm
    // slate of its greying curve (palettes.ts), its smoke tip half its tail and its frost back to the eye line (the
    // shared muzzle in the same smoke grey: palettes.ts MUZZLE_SLOT), the adult's crook with the full-moon core and
    // the resident moth (nearHead), the moth wing worn as fire's is (2.9: tears in panels 1 and 2, the notched hole
    // from full spread, re-measured for the airing)
    elder: {
      tailRest: TAIL_REST.dusk.elder, horns: null, markings: [],
      wing: wingParams({
        style: 'bat', scallop: -1.5,
        tears: [{ panel: 1, at: 0.35, depth: 5 }, { panel: 2, at: 0.6, depth: 5 }],
        // (2.9's spot re-measured for the notched window AND the airing: at 2.9's (-9.5, -8.5) the window lay on the back once
        // the airing leaned the spread back far enough for the tip rule (1.3); here, up the arm panel toward the
        // forearm, it keeps the ring and 2 px of membrane round it and clears the back line at the airing's 20 deg
        // sit-back, anims.ts airingFit)
        hole: { x: -5.5, y: -13, from: 0.95 },
      }),
      dorsal: null,
    },
  },
  render: { nearHead, headMarkings, tailTip, breath, ambient },
  // the lamp's reach past the snout tip (the elder's moth 4 px ahead of the lantern, the baby's nightlight 4 px further
  // out): the gallery's stage and face sheets make room for it
  reach: { baby: 12, young: 13, adult: 16, elder: 20 },
  anims: {
    fidget: (st) => batAnim(st),
    overrides: (st, dims) => ({
      idle: breathingIdle(st), walk: carryAnim(st, dims), beg: searchAnim(st), wake: relightAnim(st, dims),
      breath: st === 'baby' ? babyBreath() : nightfallAnim(st), tuckin: tuckinAnim(st, dims),
    }),
    tuning: (st) => ({
      // the lantern carry (4.3): 0.4 px/f (young 0.45, baby 0.28), paw lift 2.5 / 2 / 1.5; the elder at its own 0.34
      // and 2 px (4.2's elder column)
      walk: st === 'elder' ? {} : { speed: st === 'adult' ? 0.4 : st === 'young' ? 0.45 : 0.28, lift: st === 'adult' ? 2.5 : st === 'young' ? 2 : 1.5 },
      // Nightfall's snap: jaw 26 (young 22); the baby's fizzle ends sheepish, puffed up round before it (babyBreath)
      breath: st === 'baby' ? { fizzleFace: 'sheepish', puff: 1.1 } : { jaw: st === 'young' ? 22 : 26 },
    }),
  },
};
