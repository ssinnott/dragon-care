// LIGHTNING: "Zap", the storm dragon (docs/ART_BIBLE.md 3.5). Zone: the space above the back, behind the head.
// Cue: bolt wings, held cocked upright and leaning back -- a yellow membrane with a zigzag trailing edge on a blue
// body. They never fold flat: asleep they drop to the sad cock. The cock angle is the mood gauge.
//
// What is only Zap's, and where it lives in this file:
//   - the bolts (wing, style 'custom') and every angle they take: cockNow() is the one place the cock is decided
//     (mood, asleep, the breath's flare, the happy / wake spread, the hungry twitch, the dream twitch, the zoomies'
//     sweep, the storm-watch's tip forward; that V's opening is watchOpen()), and boltTip() / boltPt() find the tip
//     the sparks sit on through the same transform the renderer draws with;
//   - the ELDER's bolts (3.5, 2.9): the elder-only THIRD TOOTH (BOLT.elder), the far bolt's TEAR cut from the stage's
//     wing data, opened as the storm-watch fans that bolt back (boltPath, boltTear), and the far bolt stepping further
//     back as they cock up (farOffset);
//   - sparks: flat signal yellow (`membrane`, D20: in the pale `glow` they were the dazed stars' white), whole
//     pixels in face space, drawn as a tiny inked stepped bolt (spark(): why not 3.5's bare or scale-ringed 2 x 2,
//     nor a "+" star);
//   - the ambient crackle, the adult's (and elder's) charge, the elder's arc hopping tip to tip, and the flourishes
//     the shared anims hand over through pose.act / pose.cue (4.3): the happy crackles and spark shower, the hungry
//     tell's sputtering sparks, the dream-twitch spark, the zoomies' skid sparks, the storm-watch's ladder
//     (ambient());
//   - the signature Spark Bolt, the elder's slower 1.1x one ending in its turning ring of sparks, and the baby's pop
//     (breath());
//   - the anims of its own: the zoomies fidget (the elder's a content lope), the sleep loop with its dream-twitch
//     every 6 breaths, the baby breath's hair-on-end jolt, the adult's and elder's shorter sustains (cutBreath), and
//     the elder's airing, a STORM-WATCH (stormWatch()).
import { DRAGON_PALETTES } from '../palettes.ts';
import { TAIL_REST, FIDGET_TIMING, grown } from '../stages.ts';
import type { Stage } from '../stages.ts';
import { hornParams, wingParams } from '../element.ts';
import type { ElementSpec, ElementDraw, DragonInfo, WingTear } from '../element.ts';
import { pathPts, hornTip, hornRefClamped, mouthToRoot } from '../features.ts';
import { ACT, DFACE } from '../pose.ts';
import type { DragonPose, PartialDragonPose } from '../pose.ts';
import { bake, breathAnim, sleepAnim } from '../anims.ts';
import type { Key, Tracks } from '../anims.ts';
import type { DragonAnim, DragonFrame } from '../anim.ts';
import type { DragonDims } from '../build.ts';
import { animTuning } from '../tuning.ts';
import { hash01, liveSpawns } from '../fx.ts';
import { flat, outlinePath } from '../../../lib/art/shading.ts';
import { cranToRootPt, enterFace, enterFaceFromLocal, localToRootPt } from '../rig.ts';
import type { DragonRig } from '../rig.ts';

const PAL = DRAGON_PALETTES.lightning;
const D2R = Math.PI / 180;
type Pt = { x: number; y: number };

/**
 * The bolt polygons in wing space (root at 0,0, +x forward, up negative), as drawn at their authored cock `at`: the
 * leading edge (the first 3 vertices), then the zigzag trailing edge. The tip (the top vertex, pts[4], pts[5]) is
 * where the sparks sit.
 *   - Adult: 3.5's simple polygon, 15 x 28, its two shelves ending 5.7 and 9.2 px behind the leading edge.
 *   - Elder: the adult's leading edge and height, 16.5 x 28, with the elder-only THIRD TOOTH (3.5): its shelves end
 *     5.7, 9.2 and 11.3 px behind the leading edge, so the 3 px spar and >= 2 px of yellow survive at every step, the
 *     teeth 7-8 px apart. Its TEAR (2.9) is the stage's data (sp.wing.tears), cut into the FAR bolt by boltPath.
 *   - Young: hand-authored, 16 x 10, the shelves ending 4.8 and 6.4 px behind the leading edge (at the 9 / 15
 *     scale of the adult's they ended 3.4 and 5.5 px back, and past the 2 px spar only 0-2 px of yellow survived:
 *     the far bolt's olive outweighed the near one's yellow, and the sprout read as a brown pine cone).
 *   - Baby: a 12 x 5 bolt nub with one 2 px zigzag step at 55 % of its height, no spar (5.2).
 * `farDx`: the far bolt's step back, px (3.5's -4; the young's -2.5, so its far bolt is a 3 px olive rim behind
 * the near one's yellow, not a second bolt as big), and `farDy` its step down (the rig roots a far wing 2 px
 * higher). The baby's far nub tucks INSIDE the near one's outline, (-1, -1) net: stepped 4 px back it stood apart
 * as a second 12 px tooth, and the pair over the hips gave the baby a two- or three-point top edge at /3, the saw
 * language on spike's back line (3.0; the cast review). `spar`: the leading spar's line, running up the leading
 * edge from under the root to 70 % of the height (sparTo), so the spire's peak is yellow.
 */
interface BoltShape { pts: readonly number[]; spar: readonly number[]; at: number; sparR: number; farDx: number; farDy: number; farBack: number }
const ADULT = [0, 0, -3, -13, -8, -28, -14, -17, -10, -17, -15, -8, -11, -8, -8, 0];
const ELDER = [0, 0, -3, -13, -8, -28, -15, -20, -11, -20, -16, -12, -12, -12, -16.5, -5, -12.5, -5, -8.5, 0];
const YOUNG = [0, 0, -2, -7, -5, -16, -10, -9, -7.5, -9, -10, -4, -7.5, -4, -5, 0];
/** The spar's line: from 1 px under the root up the leading edge (pts' first 3 vertices) to `k` of the height. */
function sparTo(p: readonly number[], k: number): number[] {
  const ye = p[5] * k;
  if (ye >= p[3]) return [p[0], 1, p[0] + (p[2] - p[0]) * ye / p[3], ye];
  const t = (ye - p[3]) / (p[5] - p[3]);
  return [p[0], 1, p[2], p[3], p[2] + (p[4] - p[2]) * t, ye];
}
const BOLT: Readonly<Record<Stage, BoltShape>> = {
  baby: { pts: [0, 0, -1.5, -6, -3, -12, -5.5, -5.4, -3.5, -5.4, -5, 0], spar: [], at: 105, sparR: 0, farDx: -1, farDy: 1, farBack: 0 },
  young: { pts: YOUNG, spar: sparTo(YOUNG, 0.7), at: 115, sparR: 1, farDx: -2.5, farDy: 0, farBack: 0 },
  adult: { pts: ADULT, spar: sparTo(ADULT, 0.7), at: 115, sparR: 1.5, farDx: -4, farDy: 0, farBack: 0 },
  elder: { pts: ELDER, spar: sparTo(ELDER, 0.7), at: 115, sparR: 1.5, farDx: -4, farDy: 0, farBack: 3 },
};

/**
 * Path the bolt `p` (wing space, as authored), with the elder's TEAR cut into its trailing edge (2.9, sp.wing.tears)
 * `open` of its full depth: a tear's `panel` counts the bolt's TEETH from the tip, 1-based -- the trailing edge's
 * slanting run from one tooth's point down to the next (the tip -> the first tooth is panel 1) -- and `at` is the
 * fraction along it from its upper end. The notch is boltTear's slot, so the bolt's one stroke inks it.
 * The tear is the FAR bolt's (wing()), and it opens as the storm-watch fans that bolt back (`open`: watchOpen, 0 at
 * rest), the way a membrane elder's tears open with its spread (2.9 "When it shows"): in the V its trailing edge
 * faces the room with the bolt's whole width behind it. At rest the far bolt shows only a 4-6 px band past the near
 * one, and a 5 px tear there cut it nearly through (1 px olive necks; at the sad cock and asleep the slot ran across
 * the band and left the far tip floating over an "F"); shallower it was an ink nick with 1-2 px of background. The
 * first pass's tear on the near bolt lay over the far one, and the room cut through behind it showed as a closed pale
 * pocket, an eye, with the tooth point under it cut loose as a 1-3 px speck.
 */
function boltPath(ctx: CanvasRenderingContext2D, p: readonly number[], tears: readonly WingTear[] | undefined, open: number): void {
  ctx.beginPath(); ctx.moveTo(p[0], p[1]);
  for (let i = 2; i < p.length; i += 2) {
    const k = tears && open > 0 ? tearOn(tears, i - 2) : -1;
    if (!tears || k < 0) { ctx.lineTo(p[i], p[i + 1]); continue; }
    tearNormal(p, i - 2);
    boltTear(ctx, p[i - 2], p[i - 1], p[i], p[i + 1], tears[k].at, tears[k].depth * open);
  }
  ctx.closePath();
}

/**
 * The bolt's tear slot (2.9's shape, re-aimed for a tooth run): TEAR_MOUTH px wide at the edge, `d` deep, its LOWER
 * side stepped TEAR_STEP px toward the upper halfway down and then running in to meet the upper side in a point (a
 * rip), the sides running into the bolt along the run's normal turned TEAR_TILT deg up. A tooth run is 8-10 px long,
 * and square to it (parts.ts pathTearEdge) the slot's sides aimed down at the next shelf's inner corner: at 4 deep
 * its bottom crossed the shelf, the tooth point below it was cut loose as a separate flag, and the far bolt read as
 * an "E". Turned up and stepped on the lower side, the tooth keeps a neck of about 3 px. From the current point on
 * the edge (x0, y0) -> (x1, y1), appended; TN is the run's normal into the bolt.
 */
const TEAR_MOUTH = 6.5, TEAR_STEP = 1.5, TEAR_TILT = 20;
function boltTear(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, at: number, d: number): void {
  if (d < 0.5) { ctx.lineTo(x1, y1); return; }
  const L = Math.hypot(x1 - x0, y1 - y0) || 1, ux = (x1 - x0) / L, uy = (y1 - y0) / L;
  const a = Math.atan2(TN.y, TN.x) - TEAR_TILT * D2R, dx = Math.cos(a), dy = Math.sin(a), st = TEAR_STEP;
  // the mouth's span along the run, so the slot is TEAR_MOUTH wide square to its turned sides
  const h = TEAR_MOUTH / Math.abs(ux * dy - uy * dx) / 2 / L, t0 = at - h, t1 = at + h;
  const ax = x0 + (x1 - x0) * t0, ay = y0 + (y1 - y0) * t0, bx = x0 + (x1 - x0) * t1, by = y0 + (y1 - y0) * t1;
  // square to the sides, from the lower side B toward the upper A
  let px = -dy, py = dx;
  if ((ax - bx) * px + (ay - by) * py < 0) { px = -px; py = -py; }
  ctx.lineTo(ax, ay);
  // (its bottom a POINT, a rip, 1 px in from the upper side: with a flat bottom the slot was a clean square chunk, a
  // bite out of the bolt's back edge, not wear: cast review v2)
  ctx.lineTo(ax + dx * d - px, ay + dy * d - py);
  ctx.lineTo(bx + px * st + dx * d / 2, by + py * st + dy * d / 2);
  ctx.lineTo(bx + dx * d / 2, by + dy * d / 2);
  ctx.lineTo(bx, by);
  ctx.lineTo(x1, y1);
}
/** The index into `tears` of the tear on the edge from vertex pair `v` (an index into pts, even) on, or -1. */
function tearOn(tears: readonly WingTear[], v: number): number {
  // (the teeth's slanting runs start at the tip, pts[4], and at every shelf's end after it: 4, 8, 12...)
  if (v < 4 || v % 4) return -1;
  for (let k = 0; k < tears.length; k++) if (tears[k].panel === v / 4) return k;
  return -1;
}
/** The unit normal into the bolt (toward the leading edge, +x) of the edge from pts[v] on, into TN. */
const TN: Pt = { x: 0, y: 0 };
function tearNormal(p: readonly number[], v: number): void {
  const dx = p[v + 2] - p[v], dy = p[v + 3] - p[v + 1], L = Math.hypot(dx, dy) || 1;
  TN.x = dy / L; TN.y = -dx / L;
  if (TN.x < 0) { TN.x = -TN.x; TN.y = -TN.y; }
}

/** The shared breath's wind-up, frames (anims.ts breathAnim: 18 / 14 / 10, the elder's 22): cue runs from -WINDUP to the snap. */
const WINDUP: Readonly<Record<Stage, number>> = { baby: 10, young: 14, adult: 18, elder: 22 };

/** Cock angle (1.1 convention: from +x, + up): sad 140 (baby 125) -> rest 115 (105) -> excited 95. */
function cockOf(stage: Stage, mood: number, asleep: boolean, spread: number): number {
  const rest = stage === 'baby' ? 105 : 115, sad = stage === 'baby' ? 125 : 140;
  let c = asleep ? sad : mood < 0 ? rest + (rest - sad) * mood : rest - (rest - 95) * mood;
  c += (95 - c) * Math.max(0, Math.min(1, spread));
  return c;
}

/**
 * The cock this frame, every rule in one place:
 *   - asleep: the sad cock (3.5 "never fold flat"), whatever the wing channel says -- the baby bun keys wing.fold
 *     past 1 to lift ordinary nubs over its crown, and as a spread it stood the sleeping bolts up excited; the
 *     dream-twitch (4.3) flicks them up for 4 f;
 *   - the breath: the wind-up flares them to 95 over its first 4 f and they hold it through the snap and the
 *     stream, easing back with the stream's envelope (keyed on `cue < 0 || fx > 0` they dropped back to rest for
 *     the 2-3 f between the wind-up and the stream, right at the snap);
 *   - otherwise the wing channel is the spread (happy 0.8, the wake's full spread: both read as "excited");
 *   - begging (the hungry tell): an irregular stepped twitch, up 6 or down 4 for 3 f, about one beat in five;
 *   - the zoomies (fidget()): swept back to 130 (baby 125) through the gallop, snapped to 95 at the skid. Left at
 *     the fidget's excited 95 the whole way, nothing in the cue sold the speed;
 *   - the elder's storm-watch (its airing, stormWatch()): raised to 95 on the keyed spread and tipped WATCH.tip
 *     further forward as the V opens (watchOpen), the far bolt fanned WATCH.fan back (wing()).
 */
function cockNow(rig: DragonRig, pose: DragonPose, info: DragonInfo): number {
  const st = info.stage;
  if (info.asleep) {
    const c = cockOf(st, info.mood, true, 0);
    if (pose.act === ACT.sleep) { const d = pose.cue - dreamAt(rig); if (d >= 2 && d < 6) return c - 15; }
    return c;
  }
  const spread = pose.act === ACT.breath ? (pose.cue < 6 ? Math.min(1, (pose.cue + WINDUP[st]) / 4) : pose.fx) : pose.wing.fold;
  let c = cockOf(st, info.mood, false, spread);
  if (pose.act === ACT.fidget) {
    // the zoomies: swept back into the wind through the gallop (over its first 6 f), snapped up at the skid's whoa
    const z = ZOOM[st], back = st === 'baby' ? 125 : 130, u = Math.min(1, (pose.cue - z.dash0) / 6);
    if (pose.cue >= z.dash0 && pose.cue < z.dashEnd) c += (back - c) * u * u * (3 - 2 * u);
  } else if (pose.act === ACT.airing && st === 'elder') {
    c -= WATCH.tip * watchOpen(pose, info);
  } else if (pose.act === ACT.beg) {
    const h = hash01(info.seed * 7 + 1, Math.floor(info.tick / 3));
    if (h > 0.8) c += h > 0.9 ? -6 : 4;
  }
  return c;
}

/**
 * The baby's static pop raises every feature (hair on end, 3.5): its nubs, already flared to 95, jump 2 px more for
 * the pop's 4 f (cue 0..4). At 1 px for 8 f the jolt did not show at game scale.
 */
function popLift(pose: DragonPose, info: DragonInfo): number {
  return info.stage === 'baby' && pose.act === ACT.breath && pose.cue >= 0 && pose.cue < 4 ? 2 : 0;
}

/**
 * The far bolt's offset in the renderer's own frame (before the cock turns it), into `out`: its step back and down
 * (BoltShape.farDx, farDy) and, as the bolts cock up past rest, a drop of up to 3 px. The rig roots the far wing
 * 2 px higher and turns it 8 deg further back, so at the excited 95 its tip stood 1.5 px ABOVE the near one's and
 * the far bolt took the spire's peak -- olive over yellow. The elder's also steps up to `farBack` (3) px further
 * back: dropped 3 px with three teeth, the far bolt's teeth fell between the near one's, and the excited spire was
 * a crumpled saw of six jags; stepped back as well, it stays a whole second bolt behind the first. `open`: this
 * frame's watchOpen (the storm-watch's fan parts the pair on its own, so the step and the drop ease out as it opens).
 */
function farOffset(info: DragonInfo, cock: number, open: number, out: Pt): Pt {
  const rest = info.stage === 'baby' ? 105 : 115;
  const B = BOLT[info.stage], ex = Math.max(0, Math.min(1, (rest - cock) / (rest - 95))) * (1 - open);
  out.x = B.farDx - B.farBack * ex; out.y = B.farDy + 3 * ex;
  return out;
}
const FO: Pt = { x: 0, y: 0 };

/**
 * Bible 3.5 "The cue: bolt wings, held cocked". Wing space; replaces the wing (style 'custom'), called for the far
 * bolt (info.far: the far palette; the rig roots it 2 px higher and turns it 8 deg further back; farOffset steps
 * it back and drops it as the bolts cock up) and the near. The polygon turns about its root by (cock - its authored
 * angle). FLIGHT: the rig turns wing space by the whole `flap` (+-40, 4.2 "fly"); the bolts give half of it back,
 * so they flap +-20 about the cock with the spars closed and the spire never turns into a bat wing (flapBack).
 * SHADING: none -- each bolt is one FLAT tone, inked, like the signal colour's other shapes (D20). Cel-banded as a
 * bat membrane is (1.2: matte, one shadow band), the near bolt's band `#a88f30` sat about 20 % from the far bolt
 * `#96803d` behind it, under the 25 % ladder, and the two bolts' bases fused into one olive mass on the adult.
 * ELDER: the FAR bolt carries the tear (boltPath), opened as the storm-watch fans it back (watchOpen).
 */
/**
 * How much of the rig's `flap` turn the bolts give back: half in flight, all of it in the preen and the wake,
 * whose flap leans the other elements' resting spread back out of the space over the back (SPREAD_BACK: that space
 * is lightning's own, and its bolts stand excited there instead).
 */
function flapBack(pose: DragonPose): number { return pose.act === ACT.happy || pose.act === ACT.wake ? 1 : 0.5; }

const wing: ElementDraw = (ctx, rig, pose, info) => {
  const B = BOLT[info.stage], cock = cockNow(rig, pose, info), flap = pose.wing.flap * flapBack(pose);
  const open = info.far ? watchOpen(pose, info) : 0;
  ctx.save();
  if (flap) ctx.rotate(flap * D2R);
  const lift = popLift(pose, info);
  if (lift) ctx.translate(0, -lift);
  if (info.far) { farOffset(info, cock, open, FO); ctx.translate(FO.x, FO.y); }
  ctx.rotate(-(cock + WATCH.fan * open - B.at) * D2R);
  // (rig.sp, not info.sp: the gallery's wear=0 replaces rig.sp alone)
  boltPath(ctx, B.pts, info.far ? rig.sp.wing.tears : undefined, open);
  flat(ctx, rig, info.pal.membrane);
  if (B.spar.length && !rig.override && !info.far) {
    // one leading spar in scale, no ink of its own, CLIPPED to the bolt just inside its leading edge, up to 70 % of
    // the height: unclipped, its round-capped stroke ran wider than the bolt near the tip, and the spire's top 5 px
    // were bare blue with no ink on the back edge (1.2: a spar ends at its membrane tip, never a bare stick). The
    // far bolt has none (1.5: far details under the mark floor go): its dark spar showed through the near bolt's
    // notches as a blue stripe between two yellows, and the double bolt read as a striped fan
    ctx.save(); ctx.clip();
    ctx.strokeStyle = rig.col(info.pal.scale); ctx.lineWidth = B.sparR * 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(B.spar[0] - B.sparR, B.spar[1]);
    for (let i = 2; i < B.spar.length; i += 2) ctx.lineTo(B.spar[i] - B.sparR, B.spar[i + 1]);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
};

/**
 * The storm-watch's opening this frame, 0..1 (stormWatch(): eased in over WATCH.open0..open1, out over
 * shut0..shut1), 0 in any other act: the far bolt fans back WATCH.fan deg by it and the near one tips forward
 * WATCH.tip (cockNow), so the pair opens into a V from the tips, and the far bolt's tear opens with it (boltPath).
 */
function watchOpen(pose: DragonPose, info: DragonInfo): number {
  if (pose.act !== ACT.airing || info.stage !== 'elder') return 0;
  const c = pose.cue, W = WATCH;
  const u = c < W.open0 || c >= W.shut1 ? 0 : c < W.open1 ? (c - W.open0) / (W.open1 - W.open0) : c < W.shut0 ? 1 : (W.shut1 - c) / (W.shut1 - W.shut0);
  return u * u * (3 - 2 * u);
}

// ---------- where the sparks sit ----------

const HT: Pt = { x: 0, y: 0 }, WT: Pt = { x: 0, y: 0 }, TP: Pt = { x: 0, y: 0 }, SP: Pt = { x: 0, y: 0 }, GP: Pt = { x: 0, y: 0 };

/**
 * The bolt's tip this frame, ROOT space, into `out`: the wing renderer's own transform (the halved flap, the pop's
 * lift, farOffset, the cock, the far bolt's fan) applied to the polygon's top vertex (or the polygon-space point
 * (vx, vy): boltPt), then the rig's wing space. `cock` overrides this frame's (a spark's birth pose, so its source
 * holds still once the bolts have moved on).
 */
function boltTip(rig: DragonRig, pose: DragonPose, info: DragonInfo, far: boolean, out: Pt, cock = 0): Pt {
  const B = BOLT[info.stage];
  return boltPt(rig, pose, info, far, B.pts[4], B.pts[5], out, cock);
}
function boltPt(rig: DragonRig, pose: DragonPose, info: DragonInfo, far: boolean, vx: number, vy: number, out: Pt, cock = 0): Pt {
  const B = BOLT[info.stage], J = rig.j, ck = cock || cockNow(rig, pose, info), open = far ? watchOpen(pose, info) : 0;
  const a = -(ck + WATCH.fan * open - B.at) * D2R;
  if (far) farOffset(info, ck, open, FO); else { FO.x = 0; FO.y = 0; }
  const x = vx * Math.cos(a) - vy * Math.sin(a) + FO.x, y = vx * Math.sin(a) + vy * Math.cos(a) + FO.y - popLift(pose, info);
  const f = pose.wing.flap * flapBack(pose) * D2R, c = Math.cos(f), s = Math.sin(f);
  return localToRootPt(far ? J.wingF.x : J.wingN.x, far ? J.wingF.y : J.wingN.y, far ? J.wingAngF : J.wingAngN, x * c - y * s, x * s + y * c, out);
}

/** The near horn's tip this frame, ROOT space, into `out` (the rig draws the horn at the quiet-zone-clamped neck line). */
function hornTipRoot(rig: DragonRig, info: DragonInfo, out: Pt): Pt {
  const hp = info.sp.horns, J = rig.j, cr = rig.dims.head.cranR;
  if (!hp) return cranToRootPt(rig, 0, -cr, out);
  hornTip(hp, cr, out, hornRefClamped(hp, cr, J.neckRef, J.headAng));
  return cranToRootPt(rig, out.x, out.y, out);
}

/** Tip `k` (0 near horn, 1 near bolt, 2 far bolt, 3 tail tip), ROOT space, into `out`. */
function tipAt(rig: DragonRig, pose: DragonPose, info: DragonInfo, k: number, out: Pt): Pt {
  if (k === 0) return hornTipRoot(rig, info, out);
  if (k < 3) return boltTip(rig, pose, info, k === 2, out);
  const J = rig.j;
  out.x = J.tailX[J.tailN]; out.y = J.tailY[J.tailN];
  return out;
}

/**
 * GROUND space is root space without the root's own offset and turn (the sprite's hop, recoil and dash): a spark
 * thrown off the dragon flies and lands in it, so it never rides the hop that threw it. Root -> ground, into `out`.
 */
function rootToGround(rig: DragonRig, x: number, y: number, out: Pt): Pt {
  const t = rig.tf;
  out.x = t.rx + x * t.c - y * t.s; out.y = t.ry + x * t.s + y * t.c;
  return out;
}
/** Ground -> root, into `out`. */
function groundToRoot(rig: DragonRig, x: number, y: number, out: Pt): Pt {
  const t = rig.tf, gx = x - t.rx, gy = y - t.ry;
  out.x = gx * t.c + gy * t.s; out.y = -gx * t.s + gy * t.c;
  return out;
}

// ---------- sparks ----------

/**
 * The spark glyph (every spark but the lip static): a 4 x 6 STEPPED BOLT of `membrane` yellow (in the pale `glow`
 * it was the dazed stars' white), two 2 px strokes slanting down to the left, jogged 1 px right at the middle (rows
 * as masks, high bit left), in a 1 px INK outline that follows the zigzag (4-neighbours only: the 8-neighbour ring
 * filled the notches and left a slanted blob). A 3 x 3 "+" in an
 * ink ring (5.2: no "+" sparkles with 1 px arms) read as the dazed face's four-point star and as a first-aid
 * sign, "dizzy" or "shiny" over the head rather than static; bare 2 x 2 `glow` (3.5's crackle, crawler and shower
 * spark) sat 25 % from the straw floor and at game scale was not there at all; ringed in `scale` (3.5's floor
 * spark) it read as a blue bubble. The ink clears the floor (gate i) and carries it on the blue body alike.
 */
const SPARK_ROWS: readonly number[] = [0b0011, 0b0110, 0b1110, 0b0111, 0b0110, 0b1100];
const SPARK_W = 4, SPARK_H = 6;
/** Is cell (q, r) of the spark glyph on (off the bitmap = off)? */
function sparkOn(q: number, r: number): boolean {
  return q >= 0 && q < SPARK_W && r >= 0 && r < SPARK_H && ((SPARK_ROWS[r] >> (SPARK_W - 1 - q)) & 1) === 1;
}

/** Spark forms: bare 2 x 2 glow; the bolt glyph (ZIG) and mirrored (ZAG), swapped on a hop or a flicker (5.1 #12). */
const BARE = 0, ZIG = 1, ZAG = 2;

/**
 * One spark centred on ROOT point (x, y), whole pixels in face space (5.1 #12), flat (D20), of form `f` (BARE /
 * ZIG / ZAG). The eye's box (+ the spark's reach) is never drawn on: the ambient anchor is not clipped off it
 * as the breath's is, and a crackle on the horn of a head pitched back could otherwise land there. BARE only where
 * the mouth's dark is behind it (the static between the jaws after the bolt).
 */
function spark(ctx: CanvasRenderingContext2D, rig: DragonRig, info: DragonInfo, x: number, y: number, f: number): void {
  const J = rig.j, e = info.eye, m = f === BARE ? 3 : 5;
  if (Math.abs(x - J.eye.x) < e.w / 2 + m && Math.abs(y - J.eye.y) < e.h / 2 + m) return;
  enterFace(ctx, rig, x, y);
  if (f === BARE) {
    ctx.fillStyle = rig.col(info.pal.membrane); ctx.fillRect(-1, -1, 2, 2);
  } else {
    const flip = f === ZAG;
    ctx.fillStyle = rig.col(rig.outline);
    for (let r = -1; r <= SPARK_H; r++) for (let q = -1; q <= SPARK_W; q++) {
      if (sparkOn(q, r) || !(sparkOn(q - 1, r) || sparkOn(q + 1, r) || sparkOn(q, r - 1) || sparkOn(q, r + 1))) continue;
      ctx.fillRect((flip ? SPARK_W - 1 - q : q) - 2, r - 3, 1, 1);
    }
    ctx.fillStyle = rig.col(info.pal.membrane);
    for (let r = 0; r < SPARK_H; r++) for (let q = 0; q < SPARK_W; q++) {
      if (sparkOn(q, r)) ctx.fillRect((flip ? SPARK_W - 1 - q : q) - 2, r - 3, 1, 1);
    }
  }
  ctx.restore();
}

/**
 * Gravity on thrown sparks, px / f^2 (at 0.12 a spark hung in the air for 30 f and drifted like a bubble), and the
 * height a landed one rests at: its star's bottom row on the floor's top row.
 */
const G = 0.25, REST_Y = -3;

/**
 * A spark thrown from GROUND point (x0, y0) at (vx, vy) px/f, `age` frames on: a ballistic arc that lands on the
 * floor and lies there `lie` frames, then is gone (floor-level: it never fades by alpha, 5.4).
 */
function thrown(ctx: CanvasRenderingContext2D, rig: DragonRig, info: DragonInfo, x0: number, y0: number, vx: number, vy: number, age: number, lie: number): void {
  if (age < 0) return;
  const d = Math.max(0, REST_Y - y0), land = (-vy + Math.sqrt(vy * vy + 2 * G * d)) / G;
  if (age >= land + lie) return;
  const t = Math.min(age, land);
  groundToRoot(rig, Math.round(x0 + vx * t), Math.min(REST_Y, Math.round(y0 + vy * t + G * t * t / 2)), GP);
  spark(ctx, rig, info, GP.x, GP.y, (age >> 2) & 1 ? ZAG : ZIG);
}

/**
 * A crackle (3.5 "Ambient"): a spark on tip `k` for 4 f, which then hops 3 px (up, up-back or up-forward by `h`) for
 * 4 more. `age` 0..8.
 */
function crackleAt(ctx: CanvasRenderingContext2D, rig: DragonRig, pose: DragonPose, info: DragonInfo, k: number, age: number, h: number): void {
  if (age < 0 || age >= 8) return;
  tipAt(rig, pose, info, k, SP);
  let x = SP.x, y = SP.y;
  if (age >= 4) { const a = (h * 2 - 1) * 0.9; x += Math.round(Math.sin(a) * 3); y -= Math.round(Math.cos(a) * 3); }
  spark(ctx, rig, info, Math.round(x), Math.round(y), age >= 4 ? ZAG : ZIG);
}

/**
 * Spark crawlers (the breath's wind-up, 3.5): two sparks hopping between the near horn's tip and the bolt tips --
 * the first to the near bolt's, the second, half a trip behind, to the far one's -- in 6 whole-pixel steps, one hop
 * every 3 f. `clock` in frames. Root space. (The adult's charge makes single trips of its own: idleSparks.)
 */
function crawl(ctx: CanvasRenderingContext2D, rig: DragonRig, pose: DragonPose, info: DragonInfo, clock: number): void {
  hornTipRoot(rig, info, HT);
  for (let k = 0; k < 2; k++) {
    boltTip(rig, pose, info, k === 1, WT);
    const step = Math.floor(clock / 3) + k * 3, u = step % 12 < 6 ? (step % 6) / 5 : 1 - (step % 6) / 5;
    spark(ctx, rig, info, Math.round(HT.x + (WT.x - HT.x) * u), Math.round(HT.y + (WT.y - HT.y) * u), step & 1 ? ZAG : ZIG);
  }
}

// ---------- the ambient and the act flourishes (root space) ----------

const AG = new Float32Array(4), ID = new Int32Array(4), AG2 = new Float32Array(2), ID2 = new Int32Array(2), AG3 = new Float32Array(2), ID3 = new Int32Array(2);

/** The adult's charge: one horn -> bolt trip of 6 hops, 3 f each (18 f), every 90 +- 30 f while excited. */
const TRIP = 18;

/**
 * 3.5 "Ambient": the idle crackle, the adult's CHARGE and the elder's ARC, one budget between them (5.4: 6 per
 * dragon, 12 per habitat, every interval stretched 1.5 x in a crowd).
 *   - CRACKLE: a spark on a bolt tip for 4 f, hopping 3 px for 4 more (on the horn's tip it sat where the dazed
 *     stars circle, and read as one), every 120 +- 40 f,
 *     faster as boredom charge builds (info.charge 0 -> 1: down to every 40 +- 13 f), every 30 +- 10 f when
 *     excited (`mood` > 0.5).
 *   - CHARGE (grown, `mood` > 0.5): now and then a spark crawls from the near horn's tip to a bolt tip, the
 *     near and the far one in turn ("horn tips and wing tips") -- a seeded burst, one 18 f trip every 90 +- 30 f.
 *     Crawling every frame (two sparks hopping for good) a well-kept adult, above 0.5 most of its life, flickered
 *     all the time and never rested. The elder keeps it.
 *   - ARC (elder only, `mood` >= 0.5, 3.5 "Ambient (elder)"): every ARC_EVERY +- 40 f, a spark jumps from the near
 *     bolt's tip over the gap onto the far one's, three hops of ARC_HOP f (tipHop), the grown charge.
 */
function idleSparks(ctx: CanvasRenderingContext2D, rig: DragonRig, pose: DragonPose, info: DragonInfo): void {
  const hot = info.mood > 0.5, st = rig.budget.stretch, every = hot ? 30 : 120 - 80 * Math.max(0, Math.min(1, info.charge));
  let n = liveSpawns(info.seed * 13 + 5, info.tick, every * st, every / 3, 8, AG, ID);
  const m = grown(info.stage) && hot ? liveSpawns(info.seed * 19 + 7, info.tick, 90 * st, 30, TRIP, AG2, ID2) : 0;
  const a = info.stage === 'elder' && info.mood >= 0.5 ? liveSpawns(info.seed * 23 + 11, info.tick, ARC_EVERY * st, 40, 3 * ARC_HOP, AG3, ID3) : 0;
  // (an arc stands in for the tip crackle while it lasts: a crackle on a tip beside it made one yellow knot of the two)
  if (a) n = 0;
  let ok = rig.budget.take(rig.slot, n + m + a);
  for (let i = 0; i < a && ok > 0; i++, ok--) tipHop(ctx, rig, pose, info, AG3[i]);
  for (let i = 0; i < n && ok > 0; i++, ok--) {
    const h = hash01(info.seed + 3, ID[i]);
    crackleAt(ctx, rig, pose, info, 1 + Math.min(1, Math.floor(h * 2)), AG[i], hash01(info.seed + 9, ID[i]));
  }
  if (!m) return;
  hornTipRoot(rig, info, HT);
  for (let i = 0; i < m && ok > 0; i++, ok--) {
    boltTip(rig, pose, info, (ID2[i] & 1) === 1, WT);
    const step = Math.min(5, Math.floor(AG2[i] / 3)), u = step / 5;
    spark(ctx, rig, info, Math.round(HT.x + (WT.x - HT.x) * u), Math.round(HT.y + (WT.y - HT.y) * u), step & 1 ? ZAG : ZIG);
  }
}

/**
 * The elder's idle arc (3.5 "Ambient (elder)", tipHop): one every ARC_EVERY +- 40 f while excited, three hops of
 * ARC_HOP f. The storm-watch's rungs (airingArcs): ARC_LIFE f each, their kinks swapped after ARC_FLIP f (two keys of
 * 3, 5.1 #12).
 */
const ARC_EVERY = 150, ARC_HOP = 3, ARC_LIFE = 6, ARC_FLIP = 3;

/**
 * The ELDER's idle arc (3.5, the grown charge): the spark glyph JUMPS from the near bolt's tip to a point over the gap
 * between the tips and down onto the far one's, ARC_HOP f a hop (5.1 #12's keys), turning over at each; 9 f in all.
 * `age` 0 .. 3 ARC_HOP. As a 3-segment stroke run tip to tip the 5-7 px between the tips took it whole: straight it
 * lay on them as a flat yellow lid (a crown), and bowed 3-5 px over them it was a yellow hoop, a bag's handle.
 */
function tipHop(ctx: CanvasRenderingContext2D, rig: DragonRig, pose: DragonPose, info: DragonInfo, age: number): void {
  const k = Math.floor(age / ARC_HOP);
  if (k < 0 || k > 2) return;
  boltTip(rig, pose, info, false, HT); boltTip(rig, pose, info, true, WT);
  // the apex: over the middle of the gap, the glyph's foot 2 px clear of the higher tip
  const x = k === 0 ? HT.x : k === 2 ? WT.x : (HT.x + WT.x) / 2, y = k === 0 ? HT.y : k === 2 ? WT.y : Math.min(HT.y, WT.y) - 5;
  spark(ctx, rig, info, Math.round(x), Math.round(y), k === 1 ? ZAG : ZIG);
}

/** A rung's cells, face space round its near end (ARC_C, ARC_C): a module scratch bitmap, cleared per draw. */
const ARC_N = 40, ARC_C = 20, ARC = new Uint8Array(ARC_N * ARC_N);
/** Stamp a 2 x 2 brush along the cells from (x0, y0) to (x1, y1) into ARC (pixelStroke's walk). */
function arcSeg(x0: number, y0: number, x1: number, y1: number): void {
  const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + (x1 - x0) * i / n) + ARC_C - 1, y = Math.round(y0 + (y1 - y0) * i / n) + ARC_C - 1;
    for (let q = 0; q < 2; q++) for (let r = 0; r < 2; r++) {
      if (x + q >= 0 && x + q < ARC_N && y + r >= 0 && y + r < ARC_N) ARC[(y + r) * ARC_N + x + q] = 1;
    }
  }
}
function arcOn(q: number, r: number): boolean { return q >= 0 && q < ARC_N && r >= 0 && r < ARC_N && ARC[r * ARC_N + q] === 1; }

/**
 * A storm-watch rung (airingArcs): a 3-segment stepped spark in the signal yellow jumping between two ROOT points,
 * HT (on the near bolt) and WT (on the far one), 2 px strokes in a 1 px ink outline on 4-neighbours (the spark
 * glyph's construction), whole pixels in face space; its kinks, a third and two thirds along, jog `amp` px either
 * side of the chord, and swap after ARC_FLIP f. `age` 0..ARC_LIFE, `id` its rung.
 */
function arcSpark(ctx: CanvasRenderingContext2D, rig: DragonRig, info: DragonInfo, age: number, id: number, amp: number): void {
  // WT in face space round HT (enterFace's origin: HT snapped to the device grid; one unit a sprite px, mirrored)
  const t = rig.tf, kx = (t.fs < 0 ? -1 : 1) * (rig.pxScale || 1), ky = (t.ss < 0 ? -1 : 1) * (rig.pxScale || 1);
  const x0 = Math.round(t.fs * (t.rx + HT.x * t.c - HT.y * t.s)), y0 = Math.round(t.ss * (t.ry + HT.x * t.s + HT.y * t.c));
  const dx = Math.round((t.fs * (t.rx + WT.x * t.c - WT.y * t.s) - x0) / kx), dy = Math.round((t.ss * (t.ry + WT.x * t.s + WT.y * t.c) - y0) / ky);
  const L = Math.hypot(dx, dy) || 1;
  // the chord's normal pointing up the screen, and the kinks' side (seeded, swapped for the second key)
  let nx = -dy / L, ny = dx / L;
  if (ny > 0) { nx = -nx; ny = -ny; }
  const k = (hash01(info.seed + 61, id) > 0.5 ? 1 : -1) * (age < ARC_FLIP ? 1 : -1) * amp;
  const ax = dx / 3 + nx * k, ay = dy / 3 + ny * k, bx = dx * 2 / 3 - nx * k, by = dy * 2 / 3 - ny * k;
  ARC.fill(0);
  arcSeg(0, 0, ax, ay); arcSeg(ax, ay, bx, by); arcSeg(bx, by, dx, dy);
  enterFace(ctx, rig, HT.x, HT.y);
  ctx.fillStyle = rig.col(rig.outline);
  for (let r = 0; r < ARC_N; r++) for (let q = 0; q < ARC_N; q++) {
    if (!arcOn(q, r) && (arcOn(q - 1, r) || arcOn(q + 1, r) || arcOn(q, r - 1) || arcOn(q, r + 1))) ctx.fillRect(q - ARC_C, r - ARC_C, 1, 1);
  }
  ctx.fillStyle = rig.col(info.pal.membrane);
  for (let r = 0; r < ARC_N; r++) for (let q = 0; q < ARC_N; q++) if (arcOn(q, r)) ctx.fillRect(q - ARC_C, r - ARC_C, 1, 1);
  ctx.restore();
}

/**
 * The storm-watch's sparks (stormWatch): a slow JACOB'S LADDER on WATCH.arcs, drawn from the ambient budget in place
 * of the idle crackle and the charge. Two RUNGS (arcSpark, ARC_LIFE f each) zigzag across the V, from the near bolt's
 * trailing edge to the far one's leading edge (WATCH_RUNS): the first where the two stand 9-10 px apart, the second
 * 4 px higher, 11-13 px apart under the tips; then the ladder BREAKS OFF the top: a spark flies up off each tip, SNAP px
 * over it and SNAP_HOP more after ARC_FLIP f, 4 px over the second rung again. Each rung stops 2 px short of either
 * bolt (arcEnds), so its ink meets their edges and it never lies on the near bolt's yellow. The first build ran three
 * rungs 0.6 / 0.45 / 0.3 down the tips' runs, where a V opened only 20 deg by the far bolt's fan was 3-5 px across:
 * each landed on the near bolt as a yellow knot, and the ladder climbed 3 px in all; a third rung tip to tip lay over
 * both tips like a headband, and bowed over them it was a 21 px bucket handle.
 */
function airingArcs(ctx: CanvasRenderingContext2D, rig: DragonRig, pose: DragonPose, info: DragonInfo): void {
  const A = WATCH.arcs;
  for (let k = 0; k < A.length; k++) {
    const age = pose.cue - A[k];
    if (age < 0 || age >= ARC_LIFE) continue;
    if (k < WATCH_RUNS.length) {
      if (rig.budget.take(rig.slot, 1) <= 0) continue;
      arcEnds(rig, pose, info, WATCH_RUNS[k]);
      arcSpark(ctx, rig, info, age, k, WATCH_RUNS[k].amp);
      continue;
    }
    const n = rig.budget.take(rig.slot, 2);
    for (let j = 0; j < n; j++) {
      boltTip(rig, pose, info, j === 1, SP);
      const up = SNAP + (age < ARC_FLIP ? 0 : SNAP_HOP);
      spark(ctx, rig, info, Math.round(SP.x), Math.round(SP.y - up), (age < ARC_FLIP) !== (j === 1) ? ZIG : ZAG);
    }
  }
}
/** The break-off sparks' rise over their tips, px, and their second hop (airingArcs). */
const SNAP = 4, SNAP_HOP = 3;
/**
 * Where each rung of the storm-watch's ladder runs, in the order they jump: from the NEAR bolt's edge that starts at
 * pts[`nv`], `nu` of the way along it (the first rung leaps from its first tooth's point, the second from halfway down
 * its tip run), to the FAR bolt's upper leading edge, `fu` of the way down from its tip; `amp`, the kinks' jog. From
 * the inner corner under the first tooth instead, the first rung's end lay 3 px into the near bolt's yellow.
 */
interface ArcRun { nv: number; nu: number; fu: number; amp: number }
const WATCH_RUNS: readonly ArcRun[] = [{ nv: 4, nu: 1, fu: 0.25, amp: 1 }, { nv: 4, nu: 0.45, fu: 0.06, amp: 2 }];
/** A rung's two ends (ArcRun) into HT and WT, root space, on the bolts as they stand this frame, each 2 px in. */
function arcEnds(rig: DragonRig, pose: DragonPose, info: DragonInfo, run: ArcRun): void {
  const P = BOLT.elder.pts, v = run.nv;
  boltPt(rig, pose, info, false, P[v] + (P[v + 2] - P[v]) * run.nu, P[v + 1] + (P[v + 3] - P[v + 1]) * run.nu, HT);
  boltPt(rig, pose, info, true, P[4] + (P[2] - P[4]) * run.fu, P[5] + (P[3] - P[5]) * run.fu, WT);
  const dx = WT.x - HT.x, dy = WT.y - HT.y, L = Math.hypot(dx, dy) || 1;
  HT.x += dx * 2 / L; HT.y += dy * 2 / L; WT.x -= dx * 2 / L; WT.y -= dy * 2 / L;
}

/**
 * The shower of 4.3's happy flourish: sparks per stage, one launched every SHOWER_GAP f off the bolt tips in turn,
 * each flying SHOWER_LIFE f, so no more than 3 are ever in the air; LIE is how long a landed spark (the dream's,
 * the skid's) lies on the floor.
 */
const SHOWER: Readonly<Record<Stage, number>> = { baby: 3, young: 4, adult: 6, elder: 6 };
const SHOWER_GAP = 5, SHOWER_LIFE = 14, LIE = 8;
/**
 * The shower's fan, deg from straight forward (+ up): each spark leaves along the next heading, up and back, away
 * from the head, alternating high and low so two in the air are never on one line.
 */
const FAN: readonly number[] = [100, 150, 75, 125, 170, 95];
/** The shower sparks drawn this frame (root space), older first: a younger one whose ink ring would touch is left out. */
const DRAWN = new Float32Array(8);

/**
 * 4.3 "Happy flourish: 3 crackles and a spark shower", from cue 0 (the adult's preen at f 14, the young's take-off,
 * the baby's first hop): crackles on the near horn, the near bolt and the far bolt 5 f apart, then from cue 18 the
 * shower: the sparks leave the near and far bolt tips in turn, one every SHOWER_GAP f, each along its own heading
 * of the FAN at 1.5 px/f under a light pull down, so it is 6 px clear of its tip within 4 f, and pops after
 * SHOWER_LIFE f: 3 in the air at most, their ink rings never touching (DRAWN). Launched 1 f apart in pairs, 4-6 of
 * them stacked on the bolt tips for a few frames, a pale clump of popcorn, a crown. Thrown in ground space from
 * where the tips stand, so a hop never carries them.
 */
function happyFlourish(ctx: CanvasRenderingContext2D, rig: DragonRig, pose: DragonPose, info: DragonInfo): void {
  const c = pose.cue;
  if (c < 0) return;
  for (let k = 0; k < 3; k++) crackleAt(ctx, rig, pose, info, k, c - k * 5, hash01(info.seed + 21, k));
  // (from cue 18, as the last crackle ends: at 12 the first shower spark sat on the far bolt's crackle)
  const n = SHOWER[info.stage], t0 = 18;
  let drawn = 0;
  for (let k = 0; k < n; k++) {
    const age = c - t0 - k * SHOWER_GAP;
    if (age < 0 || age >= SHOWER_LIFE) continue;
    boltTip(rig, pose, info, k % 2 === 1, SP);
    // the source where the tip stands on the ground (the hop's lift left out: rootToGround with t.ry would carry it)
    const a = FAN[(k + (info.seed & 1)) % FAN.length] * D2R, v = 1.5;
    groundToRoot(rig, Math.round(rig.tf.rx + SP.x + Math.cos(a) * v * age), Math.round(SP.y - Math.sin(a) * v * age + 0.04 * age * age), GP);
    let clear = true;
    for (let j = 0; j < drawn; j++) if (Math.abs(DRAWN[j * 2] - GP.x) < 7 && Math.abs(DRAWN[j * 2 + 1] - GP.y) < 9) clear = false;
    if (!clear) continue;
    if (drawn < 4) { DRAWN[drawn * 2] = GP.x; DRAWN[drawn * 2 + 1] = GP.y; drawn++; }
    spark(ctx, rig, info, GP.x, GP.y, (age >> 2) & 1 ? ZAG : ZIG);
  }
}

/**
 * 4.3 "Hungry tell: sparks come out irregular and jittery": while begging, sparks sputter off the horn, the bolts
 * and the tail tip on an uneven schedule (every 22 +- 10 f), each flickering on and off at random for 12 f and
 * jumping 1-2 px every 3 f (5.1 #12) instead of hopping cleanly -- a charge with no energy behind it. It stands in
 * for the idle crackle, so it draws from the same ambient budget (5.4). (The bolts twitch with it: cockNow.)
 */
function begTell(ctx: CanvasRenderingContext2D, rig: DragonRig, pose: DragonPose, info: DragonInfo): void {
  const n = rig.budget.take(rig.slot, liveSpawns(info.seed * 17 + 3, info.tick, 22 * rig.budget.stretch, 10, 12, AG, ID));
  for (let i = 0; i < n; i++) {
    const id = ID[i], beat = Math.floor(AG[i] / 3);
    if (hash01(id * 5 + 1, beat) < 0.35) continue;
    tipAt(rig, pose, info, Math.floor(hash01(info.seed + id, 1) * 4), SP);
    const dx = Math.round((hash01(id * 7 + 2, beat) - 0.5) * 4), dy = -Math.round(hash01(id * 11 + 3, beat) * 3);
    spark(ctx, rig, info, Math.round(SP.x) + dx, Math.round(SP.y) + dy, hash01(id * 13 + 5, beat) > 0.5 ? ZAG : ZIG);
  }
}

/** The sleep loop runs this many breaths (the override below); the dream-twitch plays in the last. */
const DREAM_LOOPS = 6;
/** Where the dream-twitch starts, frames from the sleep loop's start (sleep cue): 60 % into the last breath. */
function dreamAtB(B: number): number { return (DREAM_LOOPS - 1) * B + Math.round(B * 0.6); }
function dreamAt(rig: DragonRig): number { return dreamAtB(Math.round(rig.tune.sleep.breath)); }

/**
 * 4.3 "Sleep: a dream-twitch every 6 loops (leg kick + 1 spark)": the kick is the sleep override's; the spark pops
 * off the near bolt's tip as the bolts flick (cockNow), arcs back and drops to the floor.
 */
function dreamSpark(ctx: CanvasRenderingContext2D, rig: DragonRig, pose: DragonPose, info: DragonInfo): void {
  const age = pose.cue - dreamAt(rig) - 3;
  if (age < 0 || age > 90) return;
  // from the tip where the flick put it (cockNow's -15), held there as the bolts drop back
  boltTip(rig, pose, info, false, SP, cockOf(info.stage, info.mood, true, 0) - 15);
  rootToGround(rig, SP.x, SP.y, TP);
  thrown(ctx, rig, info, TP.x, TP.y, -0.3, -0.9, age, LIE);
}

/**
 * The zoomies' skid (fidget(), below): as the paws brake, static jumps off them -- two sparks thrown up and
 * forward off the near front toe, landing a few px on.
 */
function skidSparks(ctx: CanvasRenderingContext2D, rig: DragonRig, pose: DragonPose, info: DragonInfo): void {
  const z = ZOOM[info.stage], age = pose.cue - z.dashEnd;
  if (age < 0 || age > 30) return;
  // the source is the toe where the skid begins (the dash's full distance on from its rest spot), so the sparks stay
  // put on the floor while the sprite skids on and bounces back
  const toe = rig.j.legs[1].ankle.x + rig.dims.front.pawW * 0.6 + z.dist;
  for (let k = 0; k < 2; k++) thrown(ctx, rig, info, toe, REST_Y, 0.5 + 0.3 * k, -0.9 - 0.3 * k, age - 2 * k, LIE);
}

/**
 * Root space: the idle crackle and the adult's charge (idleSparks), and the flourishes of 4.3 that the shared anims
 * hand over by act / cue. An act's own sparks stand in for the idle ones: while it is happy (the flourish's 3
 * crackles ARE its crackle; with the charge and the hot crackle on top, 6 to 8 sparks hung round the head at
 * once), begging (the hungry tell's sputter), breathing (the wind-up's crawlers) or, an elder, airing (the
 * storm-watch's arcs). Asleep only the dream spark shows (a lamp switched off).
 */
const ambient: ElementDraw = (ctx, rig, pose, info) => {
  if (rig.override) return;
  const act = pose.act;
  if (info.asleep) { if (act === ACT.sleep) dreamSpark(ctx, rig, pose, info); return; }
  if (act === ACT.happy) happyFlourish(ctx, rig, pose, info);
  else if (act === ACT.beg) begTell(ctx, rig, pose, info);
  else if (act === ACT.airing && info.stage === 'elder') airingArcs(ctx, rig, pose, info);
  else if (act !== ACT.breath) {
    if (act === ACT.fidget) skidSparks(ctx, rig, pose, info);
    idleSparks(ctx, rig, pose, info);
  }
};

// ---------- the signature: Spark Bolt ----------

/** The bolt's nodes (mouth space), rewritten per frame, and the tapered outline built round them. */
const BX = new Float32Array(6), BY = new Float32Array(6), OUT = new Float32Array(24), MX = new Float32Array(6), MY = new Float32Array(6);
/**
 * The bolt's segment lengths per stage: the adult's 4, 10 / 8 / 10 / 8, about 28 px out (at 8 / 6 / 8 / 6 it was the
 * young's 20 px zigzag again, and the adult breath no reward: the cast review, round 2); the young's 3, 6 / 5 / 6
 * (3.5's "2 segments", one kink, was a pale bent stick with a knob on it: a pipe or a bone in the mouth, and no
 * zigzag; at 5 / 4 / 5, 40 deg kinks, a 14 px pale stick with a pip still read as a bone); the baby pop's 2; the
 * elder's the adult's at 1.1x reach (4.2), 11 / 9 / 11 / 9, about 31 px out.
 */
const SEGS: Readonly<Record<Stage, readonly number[]>> = { baby: [5, 4], young: [6, 5, 6], adult: [10, 8, 10, 8], elder: [11, 9, 11, 9] };
/** The adult fork's length (3.5: 8 px), the elder's at 1.1x. */
const FORK: Readonly<Record<Stage, number>> = { baby: 0, young: 0, adult: 8, elder: 9 };
/** Each segment's kink off the bolt's line, radians: the least, and the seeded spread on top (young >= 45 deg). */
const KINK: Readonly<Record<Stage, readonly [number, number]>> = { baby: [0.7, 0.15], young: [0.79, 0.1], adult: [0.7, 0.15], elder: [0.7, 0.15] };

/**
 * The bolt's polyline into BX / BY[0..n] (mouth space) for re-roll `roll`, returning n: from the mouth (the baby's
 * from the nose), each segment kinked 40-49 deg the OTHER way from the last (seeded), so it zigzags like a bolt: at
 * +-30 deg it read as a bent straw, at 50-60 deg it folded up into a 16 px "N".
 */
function boltNodes(seed: number, roll: number, stage: Stage): number {
  const baby = stage === 'baby', L = SEGS[stage], n = L.length;
  const s = seed * 31 + roll, base = baby ? -0.5 : 0, s0 = hash01(s, 7) > 0.5 ? 1 : -1;
  let x = baby ? -1 : 1, y = baby ? -3 : 0;
  BX[0] = x; BY[0] = y;
  for (let i = 0; i < n; i++) {
    const ang = base + (i % 2 ? -s0 : s0) * (KINK[stage][0] + KINK[stage][1] * hash01(s, i));
    x += Math.cos(ang) * L[i]; y += Math.sin(ang) * L[i];
    BX[i + 1] = Math.round(x); BY[i + 1] = Math.round(y);
  }
  return n;
}

/**
 * Fill the polyline BX/BY[0..n] as a TAPERED bolt in `hex` with a 1 px ink outline (`ink` false: none, the adult's
 * hot core): `w0` px wide at the mouth, narrowing to `tip` of that at the tip, the sides offset along each node's
 * averaged normal. A constant 3 px zig with mitred +-30 deg bends read as a bent drinking straw; tapered to a
 * point, its last segment and the fork were a 1 px ink hair under the mark floor (5.2). The bolt is filled in the
 * signal yellow `membrane` (3.5, 5.4): in the pale `glow` it was carried only by its ink, a pale stick, and its
 * sparks were the dazed stars' white.
 */
function zig(ctx: CanvasRenderingContext2D, rig: DragonRig, n: number, hex: string, w0: number, ink = true, tip = 0.4): void {
  let m = 0;
  for (let side = 0; side < 2; side++) for (let j = 0; j <= n; j++) {
    const i = side ? n - j : j;
    const ax = BX[Math.min(n, i + 1)] - BX[Math.max(0, i - 1)], ay = BY[Math.min(n, i + 1)] - BY[Math.max(0, i - 1)];
    const L = Math.hypot(ax, ay) || 1, h = (w0 / 2) * (1 - (1 - tip) * i / n) * (side ? -1 : 1);
    OUT[m++] = BX[i] - ay / L * h; OUT[m++] = BY[i] + ax / L * h;
  }
  pathPts(ctx, OUT, 1, 0, 0, m);
  if (ink) outlinePath(ctx, rig);
  ctx.fillStyle = rig.col(hex); ctx.fill();
}

/**
 * The impact mark at the bolt's tip, whole pixels (rows as masks, high bit left), in its ink ring: a 5 x 5 DIAMOND
 * (an 8-neighbour ring) at every stage. The young's 3 x 3 pip on its 14 px bolt read as the knob of a bone.
 */
const DIAMOND: readonly number[] = [0b00100, 0b01110, 0b11111, 0b01110, 0b00100];

/** Impact mark `rows` (w wide; ring8: an 8-neighbour ring) centred at mouth-space point (x, y), in face space. */
function impact(ctx: CanvasRenderingContext2D, rig: DragonRig, info: DragonInfo, x: number, y: number, rows: readonly number[], w: number, ring8: boolean): void {
  const J = rig.j, h = rows.length, o = w >> 1;
  localToRootPt(J.mouth.x, J.mouth.y, info.ang, x, y, TP);
  enterFaceFromLocal(ctx, rig, J.mouth.x, J.mouth.y, info.ang, TP.x, TP.y);
  for (let pass = 0; pass < 2; pass++) {
    ctx.fillStyle = rig.col(pass ? info.pal.membrane : rig.outline);
    for (let r = 0; r < h; r++) for (let q = 0; q < w; q++) {
      if (!((rows[r] >> (w - 1 - q)) & 1)) continue;
      if (pass) ctx.fillRect(q - o, r - o, 1, 1);
      else if (ring8) ctx.fillRect(q - o - 1, r - o - 1, 3, 3);
      else { ctx.fillRect(q - o - 1, r - o, 3, 1); ctx.fillRect(q - o, r - o - 1, 1, 3); }
    }
  }
  ctx.restore();
}

/**
 * Bolt lifetime (3.5: 20 f) and its re-roll, frames; the elder's at its x 1.25 tempo (4.1), 25 f re-rolled every 5
 * (still inside 5.1 #12's 3 to 6 f), so the slow, wise strike holds each shape a beat longer. BURST: the burst's
 * 3 steps of 3 f after it (young and adult).
 */
const BOLT_LIFE: Readonly<Record<Stage, number>> = { baby: 4, young: 20, adult: 20, elder: 25 };
const ROLL: Readonly<Record<Stage, number>> = { baby: 4, young: 4, adult: 4, elder: 5 };
const BURST = 9;
/**
 * The elder's FINALE (4.2 "ends in one ring"; 3.5): 5 steps of 3 f from the bolt's end. Step 0 the impact collapses
 * into one spark; steps 1-4 it is RING_N sparks on a circle round where the impact was, the circle widening (RING_R)
 * and drifting up 2 px a step (RING_UP) as the jaw eases shut, each spark turning over on every step; then gone.
 * The ring TURNS 45 deg a step, from the diagonals to the compass points and back, so its four sparks trace the circle
 * as it widens: held on the diagonals they were a square burst of four, the adult's. From r 7: at r 6 the upper and
 * lower pairs' ink rings touched (the glyph is 6 x 8 with its ink) and the first step was one X-shaped scribble.
 */
const RING_R: readonly number[] = [0, 7, 9, 11, 13];
const RING_N = 4, RING_UP = 2, RING_STEP = 3;

/** A spark at MOUTH-space point (x, y) (the breath anchor), whole pixels, of form `f` (spark()). */
function mouthSpark(ctx: CanvasRenderingContext2D, rig: DragonRig, info: DragonInfo, x: number, y: number, f: number): void {
  const J = rig.j;
  localToRootPt(J.mouth.x, J.mouth.y, info.ang, x, y, SP);
  ctx.save(); mouthToRoot(ctx, rig, info.ang);
  spark(ctx, rig, info, Math.round(SP.x), Math.round(SP.y), f);
  ctx.restore();
}

/**
 * Bible 3.5 "Signature: Spark Bolt". Mouth space, clipped off the eye by the rig.
 *   WIND-UP (cue < 0): the bolts flare to 95 (cockNow) and spark crawlers hop between the horn and bolt tips
 *   (crawl()) over its last 18 f. BOLT (cue 0..20): a zig polyline from the mouth (SEGS: adult 10 / 8 / 10 / 8,
 *   young 6 / 5 / 6), kinked 40-49 deg alternately (the young 45-51: boltNodes, re-rolled every 4 f), filled in the
 *   signal yellow as a taper from 3.5 px to 40 % with ink, a 5 x 5 impact diamond at its tip; the adult's 4.5 px to
 *   60 %, with an 8 px fork off the middle node (3 px wide: at 2 px to a point it was an ink hair) and a 1.6 px hot
 *   core of `glow` down all but its last segment. BURST (cue 20..29): the impact
 *   collapses into one spark that splits into 3 (young 2) flying out, while static flickers between the still-open
 *   jaws; the jaw starts closing at cue 28 (cutBreath; the young's shared sustain already ends at 27), so the
 *   mouth never hangs open over nothing. Nothing of it reaches the floor.
 *   ELDER (4.2, slow and wise, never failing): the adult's bolt and fork at 1.1x reach (SEGS, FORK), living 25 f
 *   and re-rolled every 5 (the x 1.25 tempo), then the FINALE in place of the burst: the impact collapses into one
 *   spark and becomes a ring of 4 that widens and drifts up as the jaw eases shut (finale(), RING_R; cutBreath).
 *   BABY, the fizzle: static builds on its nub tips and horn buds through the wind-up (its nubs flare), then a 4 f
 *   "static pop" -- one 2-segment spark off the nose with a pop diamond at its tip while every feature jolts up
 *   (babyBreath's stretch and tail, the nubs' popLift: hair on end) -- then the dazed face (babyBreath brings it
 *   on 4 f after the pop, not 8 f later with the shared stream's end) as two last sparks sputter off the nub tips.
 */
const breath: ElementDraw = (ctx, rig, pose, info) => {
  if (pose.act !== ACT.breath || rig.override) return;
  const c = pose.cue, st = info.stage, baby = st === 'baby';
  if (c < 0) {
    ctx.save(); mouthToRoot(ctx, rig, info.ang);
    if (!baby) { if (c >= -18) crawl(ctx, rig, pose, info, c + WINDUP[st]); }
    else if (c >= -8) {
      // static building: a spark flickers on a nub tip or a bud every 3 f, alternating, both at once at the end
      const beat = Math.floor((c + 8) / 3) % 3;
      crackleAt(ctx, rig, pose, info, beat === 0 ? 1 : beat === 1 ? 0 : 2, (c + 8) % 3, 0.5);
      if (c >= -3) crackleAt(ctx, rig, pose, info, 2, 1, 0.5);
    }
    ctx.restore();
    return;
  }
  if (baby) {
    if (c < 4) {
      boltNodes(info.seed, 0, st);
      zig(ctx, rig, 2, info.pal.membrane, 3.5);
      if (c >= 1) impact(ctx, rig, info, BX[2], BY[2], DIAMOND, 5, true);
    }
    if (c >= 3 && c < 11) {
      ctx.save(); mouthToRoot(ctx, rig, info.ang);
      crackleAt(ctx, rig, pose, info, 1, c - 3, 0.2); crackleAt(ctx, rig, pose, info, 2, c - 5, 0.8);
      ctx.restore();
    }
    return;
  }
  const adult = grown(st), life = BOLT_LIFE[st], roll = ROLL[st];
  if (c < life) {
    const n = boltNodes(info.seed, Math.floor(c / roll), st);
    if (adult) {
      // the fork first, so the main bolt's ink runs over its root: one 8 px segment (the elder's 9) off the second
      // kink, splitting away from the main line's next segment (3.5). The young's has none: at its half reach a fork
      // and a knob left no zigzag to read
      MX.set(BX); MY.set(BY);
      const fk = n >> 1, fx = MX[fk], fy = MY[fk], nx = MX[fk + 1] - fx, ny = MY[fk + 1] - fy, fl = FORK[st];
      const a = Math.atan2(ny, nx) + (ny > 0 ? -0.8 : 0.8);
      BX[0] = fx; BY[0] = fy; BX[1] = Math.round(fx + Math.cos(a) * fl); BY[1] = Math.round(fy + Math.sin(a) * fl);
      zig(ctx, rig, 1, info.pal.membrane, 3);
      BX.set(MX); BY.set(MY);
      // the adult's bolt stays 3 px or more to its tip (4.5 -> 2.7), a hot 1-2 px core of the pale `glow` down all
      // but its last segment (no ink): tapered to 1.4 px, its last segment was the young's hair-thin zigzag
      zig(ctx, rig, n, info.pal.membrane, 4.5, true, 0.6);
      zig(ctx, rig, n - 1, info.pal.glow, 1.6, false, 0.7);
    } else zig(ctx, rig, n, info.pal.membrane, 3.5);
    impact(ctx, rig, info, BX[n], BY[n], DIAMOND, 5, true);
  }
  const age = c - life;
  if (st === 'elder') { finale(ctx, rig, pose, info, age); return; }
  if (age >= 0 && age < BURST) {
    // the burst, on 3 f steps (5.1 #12): the impact collapses into one spark on the last roll's tip, which splits
    // into 3 (young 2) flying out 6 then 10 px, fanned 75 deg apart with a seeded wobble (on seeded headings alone,
    // starting 2 px out, two or three often stacked into one scribble), each turning over on every step
    const n = boltNodes(info.seed, Math.floor((life - 1) / roll), st), step = Math.floor(age / 3);
    const tx = BX[n], ty = BY[n], r = step ? 2 + 4 * step : 0, m = step ? (adult ? 3 : 2) : 1;
    for (let k = 0; k < m; k++) {
      const a = (k - (m - 1) / 2) * 1.3 + (hash01(info.seed * 9 + 1, k) - 0.5) * 0.4;
      mouthSpark(ctx, rig, info, Math.round(tx + Math.cos(a) * r), Math.round(ty + Math.sin(a) * r), (k + step) & 1 ? ZAG : ZIG);
    }
  }
  if (age >= 0 && age < BURST) jawStatic(ctx, rig, pose, info, age);
};

/**
 * Static between the jaws after the bolt: a bare 2 x 2 spark every 3 f, flickering over the mouth's dark interior
 * (x -1..1: at +2..5 it sat out on the straw in front of the lips, pale on pale, and was not there), while the jaw is
 * open. `age` frames since the bolt's end.
 */
function jawStatic(ctx: CanvasRenderingContext2D, rig: DragonRig, pose: DragonPose, info: DragonInfo, age: number): void {
  const beat = Math.floor(age / 3);
  if (pose.jaw <= 0 || hash01(info.seed + 41, beat) <= 0.2) return;
  mouthSpark(ctx, rig, info, Math.floor(hash01(info.seed + 43, beat) * 3) - 1, Math.floor(hash01(info.seed + 47, beat) * 3) - 1, BARE);
}

/**
 * The elder's finale (RING_R): `age` frames since its bolt's end, mouth space. Round the last roll's impact: one
 * spark, then the ring of RING_N sparks widening and drifting up (4.2's "the last puff becomes one ring", in the
 * spark glyph's floor-safe yellow and ink, 5.4), while static flickers between the jaws until they shut.
 */
function finale(ctx: CanvasRenderingContext2D, rig: DragonRig, pose: DragonPose, info: DragonInfo, age: number): void {
  if (age < 0) return;
  const st = info.stage, step = Math.floor(age / RING_STEP);
  if (step < RING_R.length) {
    const n = boltNodes(info.seed, Math.floor((BOLT_LIFE[st] - 1) / ROLL[st]), st);
    const tx = BX[n], ty = BY[n] - RING_UP * step, r = RING_R[step], m = step ? RING_N : 1;
    for (let k = 0; k < m; k++) {
      // (turned 45 deg a step: diagonals, compass points, diagonals...)
      const a = (k + step * 0.5) * Math.PI * 2 / RING_N;
      mouthSpark(ctx, rig, info, Math.round(tx + Math.cos(a) * r), Math.round(ty + Math.sin(a) * r), (k + step) & 1 ? ZAG : ZIG);
    }
  }
  jawStatic(ctx, rig, pose, info, age);
}

// ---------- the anims of its own ----------

/**
 * Zoomies timing per stage (frames, adult x 1 / young x 0.85 / baby x 0.6 / elder x 1.2: 4.2's 28 px in 60 f), reach,
 * gallop cycle, paw lift and the suspension's rise, px. The ELDER lopes: the adult's gallop at FIDGET_TIMING's x 1.3
 * and 0.8x, a 13 f cycle, 4.8 px paw lift, 1.6 px rise. On the young's 9 f cycle, at the elder's 1.3 px/f, its strides
 * were 3.4 px: a scurry of short quick steps under the big old body.
 */
interface ZoomTiming { len: number; dash0: number; dashEnd: number; skidEnd: number; dist: number; cycle: number; lift: number; air: number }
const zoomTiming = (stage: Stage): ZoomTiming => {
  const elder = stage === 'elder', k = stage === 'adult' ? 1 : stage === 'young' ? 0.85 : elder ? 1.2 : 0.6, t = (f: number) => Math.round(f * k);
  return {
    len: t(50), dash0: t(5), dashEnd: t(23), skidEnd: t(29),
    dist: stage === 'adult' ? 40 : stage === 'young' ? 32 : elder ? 28 : 18,
    cycle: stage === 'adult' ? 10 : stage === 'young' ? 9 : elder ? 13 : 6,
    lift: stage === 'adult' ? 6 : stage === 'young' ? 4 : elder ? 4.8 : 2.5,
    air: stage === 'adult' ? 2 : stage === 'young' ? 1.5 : elder ? 1.6 : 1,
  };
};
const ZOOM: Readonly<Record<Stage, ZoomTiming>> = { baby: zoomTiming('baby'), young: zoomTiming('young'), adult: zoomTiming('adult'), elder: zoomTiming('elder') };

/**
 * The zoomies' ROTARY GALLOP, phase 0 = that leg's lift-off: the hinds a tenth apart, the fronts a tenth apart a
 * third of a stride later. At a 30 % stance the fronts are down over 0.05-0.45 of the stride and the hinds over
 * 0.7-1.1, which leaves one SUSPENSION, 0.45-0.7, gathered after the fronts push off (RUN_AIR). At the walk's
 * 60 % (and at 40 %) a paw was always down and the dash read as a fast shuffle.
 */
const RUN_OFF = { legNH: 0, legFH: 0.1, legNF: 0.35, legFF: 0.45 } as const;
const RUN_STANCE = 0.3, RUN_AIR0 = 0.45, RUN_AIR1 = 0.7;
const RL = { slide: 0, lift: 0 };

/**
 * One galloping leg at its own phase u (0 = lift-off): the walk's construction (anims.ts gaitLeg) at a gallop's
 * stance share. STANCE: planted, sliding back linearly by the stride S at exactly the dash's speed, so a paw on the
 * floor holds still while root.x carries the sprite forward. SWING: a cubic whose end tangents match that speed,
 * lifted on a sine.
 */
function runLeg(u: number, S: number, c: number, lift: number, out: { slide: number; lift: number }): void {
  const sw = 1 - RUN_STANCE;
  if (u < sw) {
    const v = u / sw, m = -sw / RUN_STANCE;
    const h = (v * v * v - 2 * v * v + v) * m + (-2 * v * v * v + 3 * v * v) + (v * v * v - v * v) * m;
    out.slide = c - S / 2 + S * h; out.lift = lift * Math.sin(Math.PI * v);
  } else {
    const v = (u - sw) / RUN_STANCE;
    out.slide = c + S / 2 - S * v; out.lift = 0;
  }
}

/**
 * Bible 3.5 "Idle fidget: zoomies, dashing 40 px and back (50 f)" (young 32 px, 43 f; baby 18 px, 30 f). A crouch
 * with the bolts flaring (the fidget keys mood +1), then a real DASH: a rotary gallop at 2.2 px/f whose planted paws
 * slide back at exactly the dash's speed, so they grip the floor, the body rocking with the stride and rising in its
 * suspension, head low and stretched forward, tail out straight, the bolts swept back (cockNow); a SKID to a stop
 * (the paws planted and sliding with the sprite, the fronts braced forward, leaning back, a surprised "whoa", the
 * bolts snapping up, static jumping off the toes: skidSparks) -- and back in three BOUNCES, springing backwards on
 * happy "^" eyes, tongue out, then settling. It never turns: a turn in place is a paper turn in profile (a mirrored
 * squash, the face marks mirroring with it: fire's flame chase), and a run backwards read as a moonwalk; springing
 * back is what a puppy does anyway.
 */
function fidget(stage: Stage): DragonAnim {
  const z = ZOOM[stage], L = z.len, R0 = z.dash0, R1 = z.dashEnd, SK = z.skidEnd, elder = stage === 'elder';
  // (the elder's gestures at FIDGET_TIMING's 0.8x: the head's fling and bob, the tail, the lean, the bounces)
  const g = FIDGET_TIMING[stage].amp, G = (keys: Key[]): Key[] => keys.map((k) => [k[0], k[1] * g]);
  const v = z.dist / (R1 - R0), S = v * RUN_STANCE * z.cycle, ph = (t: number) => (((t - R0) / z.cycle) % 1 + 1) % 1;
  // the skid eases out from the dash's speed: an 'out' cube starts at 3x its mean speed, so it covers v T / 3
  const xs = Math.round(z.dist + v * (SK - R1) / 3);
  const hl = (L - 3 - SK) / 3, hop = (i: number) => SK + i * hl;
  const inDash = (t: number) => t >= R0 && t < R1, inHop = (t: number) => t >= SK && t < hop(3);
  const hopU = (t: number) => ((t - SK) % hl) / hl;
  const legs: Tracks = {};
  for (const leg of ['legNH', 'legFH', 'legNF', 'legFF'] as const) {
    const front = leg === 'legNF' || leg === 'legFF', c = front ? -0.3 * S : -0.1 * S;
    const brace = front ? 3 : -1;
    legs[`${leg}.slide`] = (t) => {
      if (inDash(t)) { runLeg(((t - R0) / z.cycle + 1 - RUN_OFF[leg]) % 1, S, c, z.lift, RL); return RL.slide; }
      return t >= R1 && t < SK + 2 ? brace : 0;
    };
    legs[`${leg}.lift`] = (t) => {
      if (inDash(t)) { runLeg(((t - R0) / z.cycle + 1 - RUN_OFF[leg]) % 1, S, c, z.lift, RL); return RL.lift; }
      return inHop(t) ? 2 * Math.sin(Math.PI * hopU(t)) : 0;
    };
  }
  const rootX: Key[] = [[0, 0], [R0, 0, 'linear'], [R1, z.dist, 'out'], [SK, xs, 'inout']];
  for (let i = 0; i < 3; i++) {
    const b = hop(i + 1);
    rootX.push([b - 1, Math.round(xs * (2 - i) / 3), 'inout']);
    if (i < 2) rootX.push([b, Math.round(xs * (2 - i) / 3), 'inout']);
  }
  rootX.push([L, 0]);
  // the body pitches chest-down as the fronts land (0.15) and rump-down as the hinds do (0.75), dipping at each
  const pitch = (t: number) => Math.cos(2 * Math.PI * (ph(t) - 0.15));
  const N = DFACE.neutral, H = DFACE.happy, O = DFACE.surprised;
  return bake({
    ...legs,
    'root.x': rootX,
    // the gallop's suspension (every paw lifted then, so the sprite rises with them) and the three bounces
    'root.y': (t) => {
      if (inDash(t)) { const p = ph(t); return p >= RUN_AIR0 && p < RUN_AIR1 ? -z.air * Math.sin(Math.PI * (p - RUN_AIR0) / (RUN_AIR1 - RUN_AIR0)) : 0; }
      return inHop(t) ? -3 * g * Math.sin(Math.PI * Math.min(1, hopU(t) * hl / (hl - 1))) : 0;
    },
    'body.rot': (t) => (t < R0 ? 5 * t / R0 : inDash(t) ? 2 + 4 * pitch(t) : t < SK ? -8 * g : inHop(t) ? -3 * g : -3 * g * (1 - (t - hop(3)) / 3)),
    'body.y': (t) => (t < R0 ? 1.5 * t / R0 : inDash(t) ? 0.4 + 0.6 * Math.abs(pitch(t)) : t < SK ? 1 : 0),
    // head low and stretched out through the dash, flung up at the skid ("whoa"), bobbing on the bounces
    'neck.a0': G([[0, 0], [R0, 4], [R0 + 2, 10], [R1, 10], [R1 + 3, -8], [SK, -6], [hop(1), -3], [L, 0]]),
    'head.rot': G([[0, 0], [R0, -2], [R0 + 2, -8], [R1, -8], [R1 + 3, -4], [SK, -2], [L, 0]]),
    'tail.lift': G([[0, 0], [R0, -8], [R1, -6], [R1 + 3, -14], [SK, -12], [hop(3), -6], [L, 0]]),
    'tail.stiff': [[0, 0], [R0, 0.6], [hop(3), 0.6], [L, 0]],
    // the mouth shut and the eyes on the goal through the dash (open-mouthed with the fangs out and neutral eyes it
    // read as a charge, not play), a "whoa" at the skid (surprised, the jaw at its minimum), then happy bounces with
    // the tongue out. The ELDER stops content (D21; fire's elder chase too): no "whoa", `happy` from the skid, and a
    // chuckle for the bounces, the jaw at its 16 on each hop and easing to 4 as it lands (its happy's 3-bob chuckle)
    jaw: elder ? [[0, 0], [SK - 2, 0], [SK + 1, 16], [hop(1) - 1, 16], [hop(1) + 1, 4], [hop(1) + 3, 16], [hop(2) - 1, 16], [hop(2) + 1, 4], [hop(2) + 3, 16], [hop(3) - 2, 16], [hop(3), 0]]
      : [[0, 0], [R1, 0], [R1 + 1, 16], [SK - 1, 16], [SK, 20], [hop(3) - 2, 20], [hop(3), 0]],
    face: elder ? [[0, N], [R1, H], [L - 2, N]] : [[0, N], [R1, O], [SK, H], [L - 2, N]],
    mood: [[0, 0], [Math.max(1, R0 - 2), 1], [L - 3, 1], [L, 0]],
    act: [[0, ACT.fidget]], cue: [[0, 0], [L, L]],
  }, { stage, len: L, next: 'idle', ease: 'inout' });
}

/**
 * The elder's STORM-WATCH timing (stormWatch), frames (= cue): the bolts rise over `up0..up1`; over `open0..open1` the
 * far one fans `fan` deg back and the near one tips `tip` forward (watchOpen), and they close over `shut0..shut1`;
 * the ladder's two rungs and its break-off jump at `arcs` (airingArcs). The V opens from the tips: fanned back 20 deg
 * alone, the far bolt's straight leading edge lay under the near one's teeth and the pair read as an olive fir tree
 * beside a yellow half-bolt, with 3-5 px between them where the arcs crossed. Tipped 5 and fanned 32, the far bolt's
 * leading edge shows 10 px above the overlap, 9 to 13 px from the near one where the rungs cross. The near bolt tips
 * no further: at 7 the head's swept-back horn came within 1 px of its leading edge (3 px here).
 */
const WATCH = { len: 106, up0: 16, up1: 30, open0: 26, open1: 40, shut0: 72, shut1: 86, fan: 32, tip: 5, arcs: [44, 54, 64] } as const;

/**
 * The ELDER's AIRING (4.2's "airing the wings", 106 f): a STORM-WATCH. Where the membrane elders sit back and sun
 * their worn wings with their eyes shut (the sit-back only leans a full spread under the tip rule, anims.ts
 * airingFit, and bolts that never spread have nothing to lean), Zap stands tall and WATCHES the weather: the chest
 * lifts 8 deg and the body 2 px on straightened legs (0-24), the head rises until the snout points 18 deg up into the
 * wind, EYES OPEN, the tail held out straight behind like a weathervane; the bolts rise to the excited 95 (the keyed
 * spread: cockNow) and open into a V (WATCH: the far one fans back, its excited step and drop easing out as it opens,
 * farOffset; the near one tips forward), the far bolt's torn edge against the room and the third tooth against the
 * sky; a slow Jacob's ladder climbs the V, 10 f a rung, and breaks off the tips (ambient: airingArcs), a storm dragon
 * charging up; a slow breath under it, then the V closes, the face goes `happy` and it stands easy (72-106).
 * act = ACT.airing, cue = frames. Lifted 4 deg and 1 px with `happy` eyes throughout, it was idle with its eyes shut
 * at game scale, the membrane elders' sunning; the shared airing only flexed the bolts to 95 for 40 f, the look of any
 * happy moment.
 */
const K = (v: number): Key[] => [[0, v]];
function stormWatch(): DragonAnim {
  const W = WATCH, L = W.len, H = DFACE.happy, N = DFACE.neutral;
  return bake({
    'body.rot': [[0, 0], [24, -8], [72, -8], [96, 0]],
    'body.y': [[0, 0], [24, -2], [40, -2.5], [54, -2], [68, -2.5], [74, -2], [96, 0]],
    'neck.a0': [[0, 0], [24, -2], [50, -3], [72, -2], [98, 0]],
    // (the head's world pitch is the rest's + neck + head + body: -2 - 8 - 8 puts the snout 18 up, 20 at the
    // breath's top; raised on the neck instead, its swept-back horn came within 1 px of the near bolt's leading edge)
    'head.rot': [[0, 0], [26, -8], [52, -9], [74, -8], [100, 0]],
    'tail.lift': [[0, 0], [24, -3], [74, -3], [100, 0]],
    'tail.stiff': [[0, 0], [16, 0.5], [80, 0.5], [100, 0]],
    'tail.sway': [[0, 0], [34, 0], [48, 4], [62, -3], [74, 0]],
    'wing.fold': [[0, 0], [W.up0, 0], [W.up1, 1], [W.shut0, 1], [W.shut1 + 2, 0]],
    face: [[0, N], [W.shut0, H], [W.shut1 + 8, N]],
    mood: [[0, 0], [W.up1, 1], [W.shut0, 1], [W.shut1 + 2, 0]],
    act: K(ACT.airing), cue: [[0, 0], [L, L]],
  }, { stage: 'elder', len: L, next: 'idle' });
}

/**
 * The dream-twitch, one row per 2 f frame from its start, each HELD (a twitch is stepped, not tweened), ADDED to
 * the sleep pose: [near hind slide, near hind lift, near front lift, tail lift, body y] (px; the tail in deg).
 * Two 4 f kicks of the near hind out behind the rump, the near front paddling, one 4 f tail flick and a 1 px jolt
 * of the whole body on the first kick. (Lifts of 2.5 px alone, on paws tucked under the body, did not read: only
 * the bolts' flick and the spark did.) Scaled per stage by KICK_K.
 */
const KICK: readonly (readonly number[])[] = [
  [0, 0, 0, 0, 0], [-5, 3, 0, -10, -1], [-5, 3, 1.5, -10, 0], [0, 0, 0.5, 0, 0],
  [-5, 3, 1.5, 0, 0], [-5, 3, 0, 0, 0], [0, 0, 1.5, 0, 0], [0, 0, 0, 0, 0],
];
const KICK_K: Readonly<Record<Stage, number>> = { baby: 0.5, young: 0.8, adult: 1, elder: 0.8 };

/**
 * SLEEP (4.2 / 4.3 "Lightning"): the shared lie-down and breathing loop, the loop run 6 breaths long so the
 * dream-twitch plays once in six: in the last breath the near hind kicks out twice, the near front paddles, the
 * tail flicks and the body jolts (KICK), the bolts flick up and one spark pops off (dreamSpark). The loop's copies
 * keep counting `cue` on (0 .. 6 breaths), which only this file's renderers read for sleep. The bolts drop to the
 * sad cock on the shared `sleep` switch (cockNow) and the horns keep their colour.
 */
function sleepOverride(stage: Stage, dims: DragonDims | null): DragonAnim {
  const tune = animTuning(stage, LIGHTNING), base = sleepAnim(stage, dims, tune);
  const lf = base.loopFrom ?? 0, B = Math.round(tune.sleep.breath), k0 = dreamAtB(B), K = KICK_K[stage];
  const frames: DragonFrame[] = base.frames.slice(0, lf);
  for (let k = 0; k < DREAM_LOOPS; k++) {
    let t = k * B;
    for (let i = lf; i < base.frames.length; i++) {
      const f = base.frames[i], src: PartialDragonPose = f.pose || {}, p: PartialDragonPose = { ...src, cue: t };
      const j = (t - k0) / 2;
      if (j >= 0 && j < KICK.length && j === Math.floor(j)) {
        const r = KICK[j];
        p.legNH = { ...src.legNH, slide: (src.legNH?.slide ?? 0) + r[0] * K, lift: (src.legNH?.lift ?? 0) + r[1] * K };
        p.legNF = { ...src.legNF, lift: (src.legNF?.lift ?? 0) + r[2] * K };
        p.tail = { ...src.tail, lift: (src.tail?.lift ?? 0) + r[3] * K };
        p.body = { ...src.body, y: (src.body?.y ?? 0) + r[4] };
        frames.push({ ...f, pose: p, interp: false });
      } else frames.push({ ...f, pose: p });
      t += f.dur;
    }
  }
  return { ...base, frames, loopFrom: lf };
}

/**
 * The BABY breath (4.2, the fizzle): the shared one, re-timed round the static pop. The pop's 4 f jolt up (a stretch
 * of 1.06: every feature raised, the head's top 2 px; the nubs 2 more by popLift; the tail snapped straight up,
 * stiff, then dropping back on the next key): hair on end. Then `dazed` from
 * 4 f after the pop, the jaw shut 2 f later (the shared anim held the mouth open and the face neutral for 8 f after
 * a 4 f pop, waiting on a stream the baby never had, and the gag's beat went dead), and `sheepish` once the stars
 * are done (2.5: "after a failed baby breath"), the 2 px sneeze-back riding under it ("did I do that?").
 */
function babyBreath(): DragonAnim {
  const base = breathAnim('baby', animTuning('baby', LIGHTNING));
  const frames = base.frames.map((f): DragonFrame => {
    const c = f.pose && f.pose.cue != null ? f.pose.cue : -1;
    if (c < 0) return f;
    const p: PartialDragonPose = { ...f.pose };
    if (c < 4) { p.squash = 1; p.stretch = 1.06; p.tail = { ...f.pose?.tail, lift: -80, stiff: 1 }; }
    if (c >= 6) p.jaw = 0;
    p.face = c < 4 ? p.face : c < 18 ? DFACE.dazed : c < 26 ? DFACE.sheepish : DFACE.neutral;
    return { ...f, pose: p };
  });
  return { ...base, frames };
}

/**
 * The ADULT breath (4.2): the shared one with its sustain cut from 30 f to 22, so the jaw starts closing at cue 28,
 * as the bolt's burst (cue 20..29) flies. The bolt lives 20 f (3.5); the shared sustain ran on 16 f past it, and
 * the mouth hung open over nothing for 8 f before the recover -- the strike read as a fizzle. The frames of cue
 * 28..36 go and the rest close up, their cue counted on without the gap. (The young's sustain already ends at cue
 * 27; the baby's is babyBreath.) 62 f in all.
 * The ELDER breath (4.2, slow and wise): the shared elder one cut the same way, cue 28..38, so the jaw starts easing
 * shut at cue 28 as its finale ring (cue 25..40: finale()) rises off the 25 f bolt, and shuts at cue 40 as the ring
 * goes; the recover (`happy`, the 2 deg nod) follows. 74 f in all, 1.2x the adult's: uncut, the jaw hung open 13 f
 * past the bolt, and the finale's window (cue 38..50) came after the strike was long gone.
 */
function cutBreath(stage: Stage, closeAt: number, sustainEnd: number): DragonAnim {
  const base = breathAnim(stage, animTuning(stage, LIGHTNING)), cut = sustainEnd - closeAt;
  const frames: DragonFrame[] = [];
  for (const f of base.frames) {
    const c = f.pose && f.pose.cue != null ? f.pose.cue : -1;
    if (c >= closeAt && c < sustainEnd) continue;
    frames.push(c >= sustainEnd ? { ...f, pose: { ...f.pose, cue: c - cut } } : f);
  }
  return { ...base, frames };
}

export const LIGHTNING: ElementSpec = {
  id: 'lightning',
  name: 'Zap',
  blurb: 'Hyper, zippy and curious. Static builds when it is bored, so play with it before you pet it.',
  palette: PAL,
  modifiers: { bodyLength: 1.0, bodyDepth: 0.85, legLength: 1.2, legR: 0.9, neckLength: 1.0, neckAngle: 0, tailLength: 1.0, tailR: 0.85, snout: 1.2 },
  stages: {
    // the tail (3.5 table, 2.6): a sharp taper, true to a point (r 0.5: round-capped at r 1.3 to 1.9 its tip read as
    // a rod's end, a spear), lifted a little at rest (young and adult 5 deg, the baby a perky 12) and, on the baby,
    // short (0.65): straight, level and as long as the body, it stuck out behind like a stick
    baby: {
      tailRest: TAIL_REST.lightning.baby, tailLen: 0.65, tailR: [3.7, 0.5],
      horns: hornParams({ len: 1, r0: 1.5, r1: 1.4, at: 118, sink: 0.5, sweep: 50 }),
      // the first Z sits on the tail base at every stage (2.7): the baby's flank is under its head and pot belly.
      // 5 x 5, where all of it clears the hip: a 6 px Z never fits whole inside the baby's thin tail
      markings: [{ kind: 'zstripe', at: 'tail', t: 0.26, size: 5, h: 5 }],
      // the nubs root over the hips at (-3, -6): the generic (+1, -6) is inside the baby's cranium
      wing: wingParams({ style: 'custom', rootDx: -4 }),
      dorsal: null,
    },
    young: {
      tailRest: TAIL_REST.lightning.young, tailR: [3.8, 0.5],
      horns: hornParams({ len: 5, kinkAt: 0.6, bend: 35, sweep: -4 }),
      markings: [{ kind: 'zstripe', at: 'tail', t: 0.16, size: 6, h: 6 }, { kind: 'zstripe', at: 'haunch', size: 6, h: 7 }],
      wing: wingParams({ style: 'custom', rootDx: -3 }),
      dorsal: null,
    },
    adult: {
      tailRest: TAIL_REST.lightning.adult, tailR: [4.7, 0.5],
      horns: hornParams({ len: 8, kinkAt: 0.6, bend: 35, sweep: -6 }),
      // haunch and shoulder Zs 6 x 8, not 6 x 9: between the leg roots and the back, the lean body's flank is too
      // shallow for a 9 px Z anywhere (the fit shows 96 % of one at best), and a clipped Z is a speck (5.2); 6 wide
      // keeps the Z's step (at 5 it reads as a slash)
      markings: [{ kind: 'zstripe', at: 'tail', t: 0.14, size: 5, h: 7 }, { kind: 'zstripe', at: 'haunch', size: 6, h: 8 }, { kind: 'zstripe', at: 'shoulder', size: 6, h: 8 }],
      wing: wingParams({ style: 'custom', rootDx: -3 }),
      dorsal: null,
    },
    // the elder (3.5's Elder column): its tail straight, stepped and at the adult's rest (2.3: EL's level 0 deg read
    // as a lower mood), the adult's horns and Zs. Its TEAR (2.9), cut by boltPath into the FAR bolt and opened by the
    // storm-watch's V: on the second tooth's run (panel 2), halfway along, a 6.5 px mouth 4.5 deep (boltTear), 4 px of
    // background across its top half and 2 across its bottom half in the V at game scale. At 5 px the mouth showed
    // 1-2 px between its ink lines on a 9 px run. On the first run (2.9's "55 % down from the tip") the bolt is 3-5 px
    // across and a notch made its tip a knob, the chipped cue D21 bans
    elder: {
      tailRest: TAIL_REST.lightning.elder, tailR: [4.7, 0.5],
      horns: hornParams({ len: 8, kinkAt: 0.6, bend: 35, sweep: -6 }),
      markings: [{ kind: 'zstripe', at: 'tail', t: 0.14, size: 5, h: 7 }, { kind: 'zstripe', at: 'haunch', size: 6, h: 8 }, { kind: 'zstripe', at: 'shoulder', size: 6, h: 8 }],
      wing: wingParams({ style: 'custom', rootDx: -3, tears: [{ panel: 2, at: 0.5, depth: 4.5 }] }),
      dorsal: null,
    },
  },
  render: { wing, breath, ambient },
  // the Spark Bolt's flash (3.5 "Tint"): the whole dragon flat in `glow.hi` (the rig's opaque flash, tint 1) on the
  // snap's first cue step, young and adult. Any partial `glow` over the blue body was grey: at 0.35 held 2 f a
  // ghosted dragon, at 0.5 a grey-blue dropout (the cast review, round 2)
  tint: (p, i) => (i.stage !== 'baby' && p.act === ACT.breath && p.cue >= 0 && p.cue < 1 ? 1 : 0),
  tailHold: 4,
  anims: {
    // bible 4.3 "Lightning": it walks 20 % faster (a shorter cycle at a faster world speed, the stride solved from
    // it) with its tail stepped (tailHold: the chain snaps on 4 f holds). The happy crackles and spark shower, the
    // hungry tell and the dream spark are renderers on act / cue (ambient()); the dream-twitch's kick and the baby
    // pop's jolt are overrides; the zoomies are fidget().
    fidget,
    overrides: (st, dims) => ({ sleep: sleepOverride(st, dims), ...(st === 'baby' ? { breath: babyBreath() } : st === 'adult' ? { breath: cutBreath('adult', 28, 36) } : st === 'elder' ? { breath: cutBreath('elder', 28, 38), airing: stormWatch() } : {}) }),
    tuning: (st) => ({
      // (the elder's 54 f at 0.38 px/f: 4.2)
      walk: st === 'adult' ? { cycle: 40, speed: 0.54 } : st === 'young' ? { cycle: 34, speed: 0.6 } : st === 'elder' ? { cycle: 54, speed: 0.38 } : { cycle: 20, speed: 0.36 },
      // the Spark Bolt's wind-up contracts the pupil (3.5); the baby's static pop keeps its dark baby eye
      ...(st === 'baby' ? {} : { breath: { pupil: true } }),
    }),
  },
};
