// SHRIEKSCALE: "Echo", the night-singer (docs/ART_BIBLE.md 3.7), a sound dragon. Zone: the head. Cue: ribbed
// ear-fans that double the head, laid back when scared, upright when curious, a dish when it shrieks.
//
// What is its own, and where it lives:
//   - the ear-fans (farHead / nearHead: fan()), the mood gauge, with everything that moves them: the shriek's dish
//     and rib rattle, the fan twitch, the walk's bob, the hungry tell's pinned-forward fans, the curled sleeping
//     fans and the baby's fan flop (ledger E8);
//   - the lilac eye mask (headMarkings) and the throat sac (drawSac, at the breath anchor);
//   - every sound arc (breath: the shriek, the squeak, the hungry chirp, the snore, the lonely call, the fidget's
//     echo-ping) and the ambient chirp and song notes (ambient);
//   - its anims: the shriek with its 'shriek' flinch event, the chirping beg, the echo-ping fidget and the lonely
//     call ('call', an anim of its own).
import { DRAGON_PALETTES } from '../palettes.ts';
import { STAGE_TIMING, TAIL_REST } from '../stages.ts';
import type { Stage } from '../stages.ts';
import { wingParams } from '../element.ts';
import type { ElementSpec, ElementDraw, DragonInfo } from '../element.ts';
import type { DragonRig } from '../rig.ts';
import { cranToRootPt, enterFaceFromCranium, enterFaceFromLocal, rootToScreen } from '../rig.ts';
import { mouthToRoot } from '../features.ts';
import { pathTube } from '../parts.ts';
import { pathTaperedCapsule } from '../../../lib/art/shapes.ts';
import { celPath } from '../../../lib/art/shading.ts';
import { ACT, DFACE } from '../pose.ts';
import type { DragonPose } from '../pose.ts';
import { bake, begAnim, breathAnim } from '../anims.ts';
import type { Key } from '../anims.ts';
import type { DragonAnim } from '../anim.ts';
import type { DragonDims } from '../build.ts';
import { animTuning } from '../tuning.ts';
import { liveSpawns, stepAlpha } from '../fx.ts';
import type { TopItem } from '../fx.ts';

const PAL = DRAGON_PALETTES.shriekscale;
const DEG = Math.PI / 180;

/**
 * The lonely call's act (3.7: "a different animation from the trick"). ACT has no slot for it yet (sharedRequests:
 * ACT.call = 11); the call keys this value, so the breath renderer draws its one long arc and the sac swells, never
 * the trick's three arcs.
 */
const ACT_CALL = 11;

// ---------- the ear-fans ----------

/**
 * One stage's fan, in FAN space: the root on the skull at (0, 0), the fan standing up (-y), its front edge toward
 * +x. The outline is POLAR about a pivot `pz` px below the root (inside the head), so the ribs radiate like fingers
 * from under the root and still start >= 3.6 px apart (5.2): about the root itself they converged into a pale
 * blob. `env` is the free edge's radius per angle ([deg back from straight up, fraction of the pivot-to-top
 * height], front to back: the tall front-top to the shorter back, 3.7). On the NEAR fan the trailing edge dips in
 * round scallops, `depth` px deep, cusp to cusp between the rib ends and behind the last (a bat wing's trailing
 * edge: the young's one, the adult's two); across the top-front they cleft the fan into a heart, and at 2 px across
 * the whole gap they were a 1 px nick at game scale. The far fan has no ribs, so no scallops either: rib-less, its
 * scallops read as a lumpy cauliflower edge.
 * SIZE: 10 / 13 / 17 px tall (+-1 with the pet's variant, 2.8) and broad, the adult's ~17 px across upright: every
 * rib keeps 2 px of membrane to every edge (5.2), and in the table's 16 x 12 three ribs so placed were 1-2 px
 * specks, gone altogether on a pet whose variant is -1 (the young's 12 x 9 likewise). Broad, they double the head.
 */
interface FanSpec {
  h: number;
  pz: number;
  /** Half the root's width, px (where the fan's sides meet the skull). */
  root: number;
  env: readonly number[];
  /** [angle deg back from straight up, start px from the pivot] per rib, front to back. */
  ribs: readonly (readonly [number, number])[];
  /** The scallops, [from, to] deg back from straight up, each a round dip `depth` px deep; none on the far fan. */
  scal: readonly (readonly [number, number])[];
  depth: number;
  /** The angle the dish spreads about (the fan's middle), deg. */
  mid: number;
  /** Root on the cranium circle: angle deg (0 = the snout side, 90 = straight up) and radius as a fraction of r. */
  at: number;
  rr: number;
  /** Lean offset, deg: the baby's ears sit up on its crown, 8 deg more upright than the others at every mood. */
  lean0: number;
  /**
   * The dish at a full shriek (flare 1.3): how far the ribs splay (1.35 = 1.3x the area) and how much the whole fan
   * grows. The baby's round ear splayed 1.35 flattened into a wide half-disc, a mushroom cap on its head: it splays
   * less and grows instead.
   */
  spread: number;
  grow: number;
}

const FANS: Readonly<Record<Stage, FanSpec>> = {
  // a tall fennec leaf on top of the cranium, 10 x 8 (a 10 x 10 disc read as a mouse ear, and as a shiny ball with
  // its short rib where a gloss highlight sits), one rib up its middle from low in the ear: the ear's inner ridge
  baby: {
    h: 10, pz: 1.5, root: 1.5, depth: 0, mid: 12, at: 100, rr: 0.84, lean0: -8, spread: 1.12, grow: 1.1,
    env: [-30, 0.6, -18, 0.84, -4, 0.94, 10, 1, 22, 0.92, 34, 0.8, 46, 0.64, 56, 0.46],
    ribs: [[12, 2.5]], scal: [],
  },
  young: {
    h: 13, pz: 3, root: 2, depth: 2.5, mid: 22, at: 128, rr: 0.88, lean0: 0, spread: 1.35, grow: 1,
    env: [-20, 0.6, -6, 0.94, 4, 1, 18, 0.97, 32, 0.92, 46, 0.86, 58, 0.76, 68, 0.62],
    ribs: [[4, 6.5], [28, 7.5]], scal: [[34, 62]],
  },
  adult: {
    h: 17, pz: 4, root: 2, depth: 2.5, mid: 24, at: 128, rr: 0.88, lean0: 0, spread: 1.35, grow: 1,
    env: [-20, 0.6, -6, 0.94, 6, 1, 18, 0.97, 32, 0.93, 46, 0.86, 58, 0.78, 68, 0.66],
    ribs: [[-2, 7.5], [18, 10.4], [38, 7.5]], scal: [[18, 38], [38, 60]],
  },
};

/** Edge samples between the front and the back edge (one per ~3 deg). */
const EDGE_N = 32;
/** A pixel lies wholly inside the fan's path when its centre is this far inside (a 45 deg edge cuts its corner at 0.71). */
const PIX_IN = 0.65;
/**
 * Where a rib runs at all, px from its CENTRE line to the path, tested in fan space: its length then follows the
 * fan's shape and pose alone, never the sub-pixel position of the head, so a rib never pops in and out as the idle
 * breath bobs the head (5.1 #12); ribClear only trims its end stamps on the grid (the mark floor: drawn to fixed
 * ends, the ribs ran 1 px from the edge or onto its ink and read as a pale lip).
 */
const RIB_SIDE = 2.75;
/** The shortest rib worth drawing, samples 0.5 px apart: shorter, a clipped rib is a speck (5.2). */
const RIB_MIN = 6;
/** Rib-start spacing, px centre to centre: a rib that would crowd its neighbours starts once this far from them (3.7). */
const RIB_GAP = 3.6;

/** Radius of the fan's free edge at `th` deg (from the pivot), `depth` px scallops included, for a fan `H` px tall. */
function edgeAt(F: FanSpec, th: number, H: number, depth: number): number {
  const e = F.env, n = e.length;
  let f = e[1];
  if (th >= e[n - 2]) f = e[n - 1];
  else for (let i = 0; i + 2 < n; i += 2) {
    if (th >= e[i] && th <= e[i + 2]) { f = e[i + 1] + (e[i + 3] - e[i + 1]) * (th - e[i]) / (e[i + 2] - e[i]); break; }
  }
  let rho = f * (H + F.pz);
  // the scallops: a round dip `depth` px deep across each span, cusp to cusp
  for (let i = 0; depth && i < F.scal.length; i++) {
    const a = F.scal[i][0], b = F.scal[i][1], hw = (b - a) / 2, u = (th - (a + hw)) / hw;
    if (u > -1 && u < 1) rho -= depth * 0.5 * (1 + Math.cos(Math.PI * u));
  }
  return rho;
}

/** Scratch for fanPt. */
const FP = { x: 0, y: 0 };
/**
 * A polar fan point (deg back from straight up, px from the pivot) -> fan space, with the dish's SPREAD (the ribs
 * splay about the fan's middle like a hand fan opening: 1.35 = 1.3x the area) and the sleeping CURL (deg the
 * outer half bends further back, growing toward the tip: its tips curl down, 4.3).
 */
function fanPt(F: FanSpec, th: number, rho: number, H: number, spread: number, curl: number, out: { x: number; y: number }): void {
  let t = F.mid + (th - F.mid) * spread;
  if (curl) { const u = (rho - (H + F.pz) * 0.45) / ((H + F.pz) * 0.55); if (u > 0) t += curl * u * u; }
  out.x = -rho * Math.sin(t * DEG); out.y = F.pz - rho * Math.cos(t * DEG);
}

/** The fan outline in fan space, one closed polygon: root corner, the edge front to back, the other root corner. */
const OLN = EDGE_N + 3;
const OLX = new Float32Array(OLN), OLY = new Float32Array(OLN);
function fanOutline(F: FanSpec, H: number, spread: number, curl: number, depth: number): void {
  const t0 = F.env[0], t1 = F.env[F.env.length - 2];
  OLX[0] = F.root; OLY[0] = 0;
  for (let i = 0; i <= EDGE_N; i++) {
    const th = t0 + (t1 - t0) * i / EDGE_N;
    fanPt(F, th, edgeAt(F, th, H, depth), H, spread, curl, FP);
    OLX[i + 1] = FP.x; OLY[i + 1] = FP.y;
  }
  OLX[OLN - 1] = -F.root; OLY[OLN - 1] = 0;
}
/** Trace the outline fanOutline last built. */
function fanPath(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(OLX[0], OLY[0]);
  for (let i = 1; i < OLN; i++) ctx.lineTo(OLX[i], OLY[i]);
  ctx.closePath();
}
/** Is fan-space (x, y) inside the outline fanOutline last built, and at least `d` px from every edge of it? */
function insideBy(x: number, y: number, d: number): boolean {
  const d2 = d * d;
  let inside = false;
  for (let i = 0; i < OLN; i++) {
    const j = i + 1 < OLN ? i + 1 : 0, ax = OLX[i], ay = OLY[i], bx = OLX[j] - ax, by = OLY[j] - ay;
    if ((ay > y) !== (OLY[j] > y) && x < ax + (bx * (y - ay)) / by) inside = !inside;
    const L2 = bx * bx + by * by, u = L2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * bx + (y - ay) * by) / L2)) : 0;
    const dx = x - ax - bx * u, dy = y - ay - by * u;
    if (dx * dx + dy * dy < d2) return false;
  }
  return inside;
}

/**
 * The rib frame of the fan being drawn: fan space -> cranium space (the fan's root (tx, ty) and turn th) -> root
 * space -> FACE space, whose origin enterFace snaps to the device pixel nearest the root point RT: `RO` is where RT
 * itself lands in face space, so a face pixel maps back to the fan exactly (no squash or root turn: the head's
 * pixel constructions ignore both, faces.ts).
 */
const RF = { tx: 0, ty: 0, c: 1, s: 0, cx: 0, cy: 0, hc: 1, hs: 0 };
const RO = { x: 0, y: 0 };
function ribFrame(rig: DragonRig, tx: number, ty: number, th: number): void {
  const J = rig.j, t = rig.tf, ha = J.headAng * DEG;
  RF.tx = tx; RF.ty = ty; RF.c = Math.cos(th); RF.s = Math.sin(th);
  RF.cx = J.cran.x; RF.cy = J.cran.y; RF.hc = Math.cos(ha); RF.hs = Math.sin(ha);
  cranToRootPt(rig, tx, ty, RT);
  const dx = t.fs * (t.rx + RT.x * t.c - RT.y * t.s), dy = t.ss * (t.ry + RT.x * t.s + RT.y * t.c);
  RO.x = (dx - Math.round(dx)) / (rig.facing * rig.pxScale);
  RO.y = (dy - Math.round(dy)) / (t.ss < 0 ? -rig.pxScale : rig.pxScale);
}
/** Scratch: a rib stamp's top-left face pixel. */
const ST = { x: 0, y: 0 };
/** The 2 x 2 stamp of the rib sample (deg, px from the pivot), into ST (pixelStroke's rounding). */
function ribStamp(F: FanSpec, th: number, q: number, H: number, spread: number, curl: number): void {
  fanPt(F, th, q, H, spread, curl, FP);
  cranToRootPtRF(RF.tx + FP.x * RF.c - FP.y * RF.s, RF.ty + FP.x * RF.s + FP.y * RF.c);
  ST.x = Math.round(FP.x - RT.x + RO.x) - 1; ST.y = Math.round(FP.y - RT.y + RO.y) - 1;
}
/** Cranium -> root space into FP, from the rib frame (localToRootPt). */
function cranToRootPtRF(x: number, y: number): void {
  FP.x = RF.cx + x * RF.hc - y * RF.hs; FP.y = RF.cy + x * RF.hs + y * RF.hc;
}
/**
 * The mark floor on the grid: is there >= 2 px of membrane on all four sides of the 2 x 2 stamp at face (px, py)?
 * The two pixels beyond the stamp in each axis direction (x -1 / -2 and +2 / +3, the same in y) must lie wholly
 * inside the fan's path, their centres >= PIX_IN inside it (the ink is outside the path, and a pixel the path cuts
 * blends into it): the floor as it is counted, in rows and columns (5.2).
 */
function ribClear(px: number, py: number): boolean {
  for (let k = 0; k < 16; k++) {
    // k: side (0 left, 1 right, 2 up, 3 down), which of the stamp's two rows / columns, 1 or 2 px out
    const side = k >> 2, lane = (k >> 1) & 1, out = (k & 1) + 1;
    const cx = side === 0 ? px - out : side === 1 ? px + 1 + out : px + lane;
    const cy = side === 2 ? py - out : side === 3 ? py + 1 + out : py + lane;
    // the pixel centre: face -> root -> cranium -> fan
    const X = RT.x + cx + 0.5 - RO.x - RF.cx, Y = RT.y + cy + 0.5 - RO.y - RF.cy;
    const lx = X * RF.hc + Y * RF.hs - RF.tx, ly = -X * RF.hs + Y * RF.hc - RF.ty;
    if (!insideBy(lx * RF.c + ly * RF.s, -lx * RF.s + ly * RF.c, PIX_IN)) return false;
  }
  return true;
}

/** Beg (4.3 "hungry tell"): the fans pinned FORWARD of upright, deg (the baby's lean offset comes on top). */
const BEG_LEAN = -28;
/** The dish tips its rim this far forward of upright at a full shriek, deg: cupped toward the sound it throws. */
const DISH_TIP = 8;
/**
 * Asleep (4.3), young and adult: the fans lean this far back from the WORLD's vertical, their tips curled `SLEEP_CURL`
 * down. The baby's lie back `SLEEP_LEAN_BABY` from its bowed crown.
 */
const SLEEP_LEAN = 42, SLEEP_CURL = 20, SLEEP_FAR = 34, SLEEP_LEAN_BABY = 55;
/** Frames the fans take to ease between the asleep lean and the awake one, at the eyes' switch (4.1: no pops). */
const DROWSE = 8;

const twAges = new Float32Array(2), twIds = new Int32Array(2);
/**
 * The fan twitch (3.7 ambient): one fan flicks 0.3 of the gauge for 6 f, alternating near and far, every
 * 120 +- 40 f (x 1.5 in a crowd, 5.4). Awake and not busy only: never through the shriek, the beg or the call.
 */
function twitch(rig: DragonRig, pose: DragonPose, info: DragonInfo): boolean {
  const a = pose.act;
  if (info.asleep || !(a === ACT.none || a === ACT.walk || a === ACT.variant || a === ACT.pet)) return false;
  const n = liveSpawns(info.seed + 2, info.tick, 120 * rig.budget.stretch, 40, 6, twAges, twIds);
  for (let i = 0; i < n; i++) if ((twIds[i] % 2 === 1) === info.far) return true;
  return false;
}

/**
 * THE GAUGE, -1..1 (D7): the pet's mood, or -1 on the `sad` and `scared` faces (2.5; 3.7 "loud noises make it
 * flatten its fans"), then PULLED by the anim's `flare`: a flare of +-p moves the gauge the fraction p of the way to
 * +-1, so a flare of +-1 lands it on +-1 at ANY mood (the shriek's fold, the echo-ping's pricked fans, the call's
 * flattened ones) and 0 hands it back to the mood without a pop. Adding the flare to the mood, the shriek never
 * folded flat on a happy pet (mood +1 + fold -1 = rest) and never opened on a sad one. The twitch flicks it 0.3
 * toward upright, or back from it when there is no room left (mood > 0.7): past 1 it flashed a dish.
 */
function fanGauge(rig: DragonRig, pose: DragonPose, info: DragonInfo): number {
  const fc = pose.face | 0;
  let g = fc === DFACE.sad || fc === DFACE.scared ? -1 : info.mood;
  const p = Math.max(-1, Math.min(1, pose.flare));
  g += ((p >= 0 ? 1 : -1) - g) * Math.abs(p);
  if (twitch(rig, pose, info)) g += g > 0.7 ? -0.3 : 0.3;
  return g;
}

/**
 * 0 awake .. 1 asleep, easing the fans across the eyes' switch (pose.sleep is stepped): over the last DROWSE frames
 * before the sleep anim shuts the eyes (anims.ts sleepAnim: `sleep` at f 24 of 40, scaled with the lie-down) and the
 * first DROWSE after the wake opens them (wakeAnim: f 3 of 30, scaled baby 24 / young 26 f). Stepped, they jumped
 * ~25 deg in one frame.
 */
function drowse(rig: DragonRig, pose: DragonPose, st: Stage): number {
  const c = pose.cue;
  let u = 0;
  if (pose.act === ACT.wake) {
    const open = Math.round(3 * (st === 'baby' ? 24 / 30 : st === 'young' ? 26 / 30 : 1));
    u = 1 - (c - open) / DROWSE;
  } else if (pose.act === ACT.sleep && c < 0) {
    const L = Math.round(rig.tune.sleep.lieDown), shut = Math.round(24 * L / 40) - L;
    u = (c - (shut - DROWSE)) / DROWSE;
  }
  u = Math.max(0, Math.min(1, u));
  return u * u * (3 - 2 * u);
}

/**
 * The walk (4.3): the fans bob 1 f behind the head, deg added to the lean. The head counter-bobs the body's dip
 * at each hind contact `lag` frames late (anims.ts walkAnim: 4 f, the baby's heavy head 6), so the fans swing
 * back as the head rises and forward as it drops, one frame after it: floppy, not bolted on.
 */
function walkBob(rig: DragonRig, cue: number, st: Stage): number {
  const C = Math.max(1, Math.round(rig.tune.walk.cycle)), lagF = st === 'baby' ? STAGE_TIMING.baby.headLag : 4;
  const u = (cue - lagF - 1) / C, dip = 0.5 + 0.5 * Math.cos(4 * Math.PI * (u - 0.4));
  return (st === 'baby' ? 12 : 9) * (dip - 0.5);
}

/**
 * THE CUE: bible 3.7 "The cue: ear-fans". Cranium space, near and far. Pink membrane with 2 px `horn` ribs (none on
 * the far fan: 1.5), rooted on the skull's top-back behind the eye (the baby's on top of its cranium), at 0.88 of
 * the cranium's radius: rooted at 0.62 a third of the fan lay over the skull and the pair read as mouse ears, not a
 * head doubled. The lean follows the GAUGE (fanGauge): -1 laid back along the neck (88 deg back from the head's
 * up), 0 up and back at 40 deg, +1 upright. The DISH comes from the anim alone, `flare` past 1 (the shriek, the
 * echo-ping's flick): the ribs splay open (1.3x the area) and the rim cups forward, with the adult's ribs rattling
 * +-1 px every 2 f (its adult-only extra). Measured on the silhouette (fans on against off, pet seeds 1, 2 and 5),
 * mood -1 keeps >= 60 % of the standing fans' area (D7; laid back the full 95 deg, the adult kept 61 %). The far
 * fan: root 4 px behind and 1 px above, turned 14 deg further back, so it widens the head's silhouette instead of
 * hiding behind the near one.
 */
function fan(ctx: CanvasRenderingContext2D, rig: DragonRig, pose: DragonPose, info: DragonInfo): void {
  const st = info.stage, F = FANS[st], r = info.r, far = info.far, act = pose.act, c = pose.cue;
  const baby = st === 'baby';
  const dish = Math.max(0, Math.min(1.5, (pose.flare - 1) / 0.3));
  // ledger E8: after the baby's squeak its fans flop FORWARD over its eyes (the anim lifts the rig's eye clip for
  // exactly those frames: pose.eyeClip 0), landing deep and bouncing once, then pop back up with a blink. Tipped
  // only -62 / -72 from the crown's top they lay on it like a beret and the eye stayed in full view: pivoted from
  // the crown's front and tipped -145 / -135 (-110 still only capped the eye's top half), the near fan's lobe hangs
  // down over the eye, a sliver of it peeking out behind
  const flop = baby && act === ACT.breath && pose.eyeClip < 0.5;
  let lean: number, spread = 1, grow = 1, curl = 0, farOff = 14;
  if (flop) lean = c < 16 ? -145 : -135;
  else if (act === ACT.beg && !info.asleep) lean = BEG_LEAN + F.lean0;
  else {
    const g = fanGauge(rig, pose, info);
    let awake = (dish > 0 ? -DISH_TIP * Math.min(1, dish) : g >= 0 ? 40 - 40 * g : 40 - 48 * g) + F.lean0;
    if (dish > 0) { spread = 1 + (F.spread - 1) * dish; grow = 1 + (F.grow - 1) * dish; }
    if (act === ACT.walk) awake += walkBob(rig, c, st);
    // Asleep (4.3) the young and adult head rests on its paws, so "back along the neck" is level and a fan laid back
    // there only reached the back line: the asleep silhouette lost the cue (5.1 #1). They lean SLEEP_LEAN back from
    // the WORLD's vertical (the head's own pitch taken out), their tips curled SLEEP_CURL down: drowsy, well back of
    // the awake rest lean (at 22 they stood more upright than an alert pet's and read "ears up"), and with the head
    // raised on its paws (tuning sleep.chin) still clear above the neck, back and wing. The far fan stands 8 deg MORE
    // upright behind it (turned further back, it sank into the lying back). The baby's bun lays them back
    // SLEEP_LEAN_BABY from its bowed crown (at 95 they lay flat over the bun and kept 41 %).
    const w = info.asleep ? 1 : drowse(rig, pose, st);
    if (w > 0) {
      const sl = baby ? SLEEP_LEAN_BABY : SLEEP_LEAN + rig.j.headAng;
      lean = awake + (sl - awake) * w; curl = SLEEP_CURL * w;
      if (!baby) farOff = 14 - SLEEP_FAR * w;
    } else lean = awake;
  }
  // (flopped, the fans pivot from the FRONT of the crown, so the lobe hangs over the eye instead of the cheek)
  const a = (flop ? 72 : F.at) * DEG, rr = r * (flop ? 0.72 : F.rr);
  const tx = Math.cos(a) * rr + (far ? -4 : 0), ty = -Math.sin(a) * rr + (far ? -1 : 0);
  // the head pitch is already in the space; lean back = counter-clockwise
  const th = -(lean + (far ? farOff : 0)) * DEG;
  // the pet's +-1 px fan-height variant (2.8)
  const H = (F.h + (info.sp.lenVar || 0)) * grow;
  const depth = far ? 0 : F.depth;
  fanOutline(F, H, spread, curl, depth);
  ctx.save();
  ctx.translate(tx, ty);
  ctx.rotate(th);
  fanPath(ctx);
  celPath(ctx, rig, info.pal.membrane, 0, -H / 2, H / 2, 0.36, 0);
  if (!far && !rig.override) {
    // ribs: 2 px horn as WHOLE-PIXEL 2 x 2 stamps in face space (a rotated 2 px stroke anti-aliases into a pale
    // smear), sampled every 0.5 px up the longest run of the rib that clears the edges by RIB_SIDE (a rib shorter
    // than RIB_MIN is not drawn), each stamp only if 2 px of membrane surround it (ribClear): no
    // clip, so no anti-aliased rib end either. The
    // adult's rattle through the shriek's sustain: each rib steps 1 px to and fro every 2 f, neighbours in
    // counter-phase
    const rattle = st === 'adult' && act === ACT.breath && c >= 0 && pose.fx > 0.5;
    ribFrame(rig, tx, ty, th);
    // out of fan space into cranium space, then face space at the fan's root (one save each, so two restores)
    ctx.save(); ctx.rotate(-th); ctx.translate(-tx, -ty);
    enterFaceFromCranium(ctx, rig, RT.x, RT.y);
    ctx.fillStyle = info.pal.horn;
    for (let i = 0; i < F.ribs.length; i++) {
      const rb = F.ribs[i], jig = rattle ? ((Math.floor(c / 2) + i) % 2 ? 1 : -1) : 0;
      const end = edgeAt(F, rb[0], H, depth);
      // the longest run of samples whose stamps clear, then draw it
      let a0 = 0, a1 = 0, b0 = -1, best = -1;
      for (let q = rb[1]; q <= end; q += 0.5) {
        fanPt(F, rb[0], q, H, spread, curl, FP);
        if (insideBy(FP.x, FP.y, RIB_SIDE)) { if (b0 < 0) b0 = q; if (q - b0 > best) { best = q - b0; a0 = b0; a1 = q; } } else b0 = -1;
      }
      if (best < 0 || best * 2 + 1 < RIB_MIN) continue;
      for (let q = a0; q <= a1 + 0.01; q += 0.5) {
        ribStamp(F, rb[0], q, H, spread, curl);
        if (ribClear(ST.x + jig, ST.y)) ctx.fillRect(ST.x + jig, ST.y, 2, 2);
      }
    }
    ctx.restore(); ctx.restore();
  }
  ctx.restore();
}
const RT = { x: 0, y: 0 };
const farHead: ElementDraw = (ctx, rig, pose, info) => fan(ctx, rig, pose, info);
const nearHead: ElementDraw = (ctx, rig, pose, info) => fan(ctx, rig, pose, info);

// ---------- the eye mask ----------

/** Eye-mask height per stage (3.7 table). */
const MASK: Readonly<Record<Stage, number>> = { baby: 6, young: 6, adult: 7 };

/**
 * Bible 3.7 table "Eye mask": a pale lilac "spectacles" patch from the snout base to behind the eye (the mint iris
 * sits inside it), clipped to the skull (the rig clips), no ink. A pixel bitmap in FACE space, centred on the eye
 * like the eye itself (a rect in the pitched cranium space stair-stepped into a band that read as a highlight): 3 px
 * behind the eye to 3 px in front of it, `MASK` rows tall, its four corners cut by 1 px so it reads as a soft
 * patch. The ink face marks read on it (97 %) as on every other dragon (gate a).
 */
const headMarkings: ElementDraw = (ctx, rig, _pose, info) => {
  const e = rig.dims.head.eye, h = MASK[info.stage];
  const x0 = -Math.floor(e.w / 2) - 3, w = e.w + 6, y0 = -Math.floor(h / 2);
  enterFaceFromCranium(ctx, rig, rig.j.eye.x, rig.j.eye.y);
  ctx.fillStyle = info.pal.marking;
  ctx.fillRect(x0 + 1, y0, w - 2, h); ctx.fillRect(x0, y0 + 1, w, h - 2);
  ctx.restore();
};

// ---------- the lonely call's timing (shared by the anim and the renderers) ----------

/** Stage duration factor (4.1: baby 0.6, young 0.85). */
const durOf = (st: Stage): number => STAGE_TIMING[st].dur;
/** The call, adult frames: the wind-up (head up, the sac filling), the call itself, the sad settle. */
const CALL_WIND = 20, CALL_SING = 50, CALL_REST = 30;

// ---------- the throat sac ----------

/** Throat-sac swell per stage (3.7 table), px. */
const SAC: Readonly<Record<Stage, number>> = { baby: 3, young: 5, adult: 7 };
/** Where on the neck the sac sits, a fraction of the neck from its root (the gulp's head-end ball: 0.7). */
const SAC_AT = 0.6;

/**
 * Bible 3.7 table "Throat sac", px proud of the neck this frame. The SHRIEK fills it through the wind-up (act =
 * breath, cue -10 .. 0), holds it through the release and empties it as the arcs go out; the LONELY CALL fills it
 * over its wind-up and keeps it full while the one long note lasts (the resonator), emptying as the call dies away.
 */
function sacPx(pose: DragonPose, st: Stage): number {
  const c = pose.cue;
  let k = 0;
  if (pose.act === ACT.breath) k = c < -10 ? 0 : c < 0 ? (c + 10) / 10 : c < 4 ? 1 : c < 12 ? 1 - (c - 4) / 8 : 0;
  else if (pose.act === ACT_CALL) {
    const sing = CALL_SING * durOf(st), w = 12 * durOf(st);
    k = c < -w ? 0 : c < 0 ? (c + w) / w : c < sing - 8 ? 1 : c < sing ? (sing - c) / 8 : 0;
  }
  return SAC[st] * k;
}

/**
 * The THROAT SAC, a `membrane` bulge in the neck's lower contour just behind the jaw (1.2), drawn by Echo itself at
 * the breath anchor. Root space (walked back from mouth space). The shared hook (ElementSpec.neckSac) centres it on
 * the neck's LAST node, under the jaw and cranium, and the head is drawn after the neck: at 7 px it showed 0 px, at
 * 3x the radius a sliver. So it sits SAC_AT up the neck from its root, on the throat's normal, `sacPx` proud of the
 * contour, and is painted behind the head by clipping off the cranium and the jaw (each grown by the ink) and ONE
 * contour with the neck: the ink ring only outside the neck, the membrane over the neck's own skin where they
 * overlap (a colour change, no line: parts.ts drawTube's bulge). Flat, like the gulp's ball.
 */
function drawSac(ctx: CanvasRenderingContext2D, rig: DragonRig, pose: DragonPose, info: DragonInfo): void {
  const s = sacPx(pose, info.stage), J = rig.j, n = J.neckN + 1;
  if (s < 0.5 || n < 2) return;
  const f = SAC_AT * (n - 1), k = Math.min(n - 2, Math.floor(f)), u = f - k;
  const nr = J.neckR[k] + (J.neckR[k + 1] - J.neckR[k]) * u;
  let vx = J.neckVX[k] + (J.neckVX[k + 1] - J.neckVX[k]) * u, vy = J.neckVY[k] + (J.neckVY[k + 1] - J.neckVY[k]) * u;
  const vl = Math.hypot(vx, vy) || 1;
  vx /= vl; vy /= vl;
  const R = nr * 0.55 + s * 0.5, out = nr + s - R;
  const x = J.neckX[k] + (J.neckX[k + 1] - J.neckX[k]) * u + vx * out, y = J.neckY[k] + (J.neckY[k + 1] - J.neckY[k]) * u + vy * out;
  const H = rig.dims.head, jw = H.jaw, ca = J.headAng * DEG, ja = J.jaw * DEG;
  ctx.save();
  mouthToRoot(ctx, rig, info.ang);
  // behind the head: off the cranium, then off the (dropped, opened) jaw, each clip built in its own space and the
  // transform walked back by hand (a restore would drop the clip)
  ctx.translate(J.cran.x, J.cran.y); ctx.rotate(ca);
  ctx.beginPath(); ctx.rect(-400, -400, 800, 800); ctx.moveTo(H.cranR + 1, 0); ctx.arc(0, 0, H.cranR + 1, 0, Math.PI * 2);
  ctx.rotate(-ca); ctx.translate(-J.cran.x, -J.cran.y);
  ctx.clip('evenodd');
  const hy = jw.hy + (J.jaw ? jw.drop : 0);
  ctx.translate(J.cran.x, J.cran.y); ctx.rotate(ca); ctx.translate(jw.hx, hy); ctx.rotate(ja);
  ctx.beginPath(); ctx.rect(-400, -400, 800, 800);
  pathTaperedCapsule(ctx, 0, 0, jw.tx - jw.hx, jw.ty - jw.hy, jw.r0 + 1, jw.r1 + 1, true);
  ctx.rotate(-ja); ctx.translate(-jw.hx, -hy); ctx.rotate(-ca); ctx.translate(-J.cran.x, -J.cran.y);
  ctx.clip('evenodd');
  // the ink ring, the membrane, then the membrane again over the ring's inner half wherever it lies on the neck
  ctx.fillStyle = rig.col(rig.outline);
  ctx.beginPath(); ctx.arc(x, y, R + 1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = rig.col(info.pal.membrane);
  ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); pathTube(ctx, J.neckX, J.neckY, J.neckR, n); ctx.clip();
  ctx.beginPath(); ctx.arc(x, y, R + 1, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ---------- sound arcs ----------

/**
 * One sound arc of radius `r`, +-`span` deg about the world direction `dir` (deg, 0 = forward, + = down), centred
 * on ROOT point (X, Y): 2 px `membrane` with a 1 px `scale` outer edge (47 % / 92 % from the floor, 5.4), as
 * WHOLE-PIXEL runs in face space: 2 x 2 stamps round the arc, the scale ring stamped 1 px further out first so its
 * outer pixel survives. Canvas arcs in the rotated mouth space smeared the 2 px pink and its 1 px edge into soft
 * bands at game scale (5.1 #12). Call it from an anchor space entered at root (ox, oy) rotated `ang` deg (mouth
 * space: J.mouth and info.ang; root space: 0, 0, 0). An arc fades by NARROWING, never by alpha (3.7).
 */
function soundArc(ctx: CanvasRenderingContext2D, rig: DragonRig, info: DragonInfo, ox: number, oy: number, ang: number,
  X: number, Y: number, dir: number, r: number, span: number): void {
  const a0 = dir * DEG, s = span * DEG;
  enterFaceFromLocal(ctx, rig, ox, oy, ang, X, Y);
  for (let pass = 0; pass < 2; pass++) {
    const rr = pass ? r : r + 1;
    ctx.fillStyle = rig.col(pass ? info.pal.membrane : info.pal.scale);
    const n = Math.max(2, Math.ceil(rr * s * 2));
    for (let i = 0; i <= n; i++) {
      const a = a0 - s + (2 * s * i) / n;
      ctx.fillRect(Math.round(Math.cos(a) * rr) - 1, Math.round(Math.sin(a) * rr) - 1, 2, 2);
    }
  }
  ctx.restore();
}
/** The arc's span by life thirds: +-hi, then +-mid, then +-lo. */
const spanAt = (f: number, hi: number, mid: number, lo: number): number => (f < 1 / 3 ? hi : f < 2 / 3 ? mid : lo);

/** Scratch: the snout's front point, root space. */
const SN = { x: 0, y: 0 };
/**
 * Root space: the front of the snout, where a CLOSED mouth's chirps and snores leave (echolocating through its
 * nose: the adult's nose-leaf sits right behind it), so a small arc clears the snout's own ink.
 */
function snoutFront(rig: DragonRig, out: { x: number; y: number }): { x: number; y: number } {
  const sn = rig.dims.head.snout;
  return cranToRootPt(rig, sn.x1 + sn.r1 + 0.5, sn.y1 - sn.r1 * 0.25, out);
}
/**
 * Where a nose sound points, world deg (+ = down): the head's facing, never more than 10 deg below level (the
 * mouth's rule, element.ts mouth space) nor 30 above, so a small arc's two ends sit level with each other: aimed
 * down the snout of a lowered head, it read as a hook ("J").
 */
const noseDir = (rig: DragonRig): number => Math.max(-30, Math.min(10, rig.j.headAng + rig.tf.rot));

/** A chirp's life, frames. */
const CHIRP = 12;
/**
 * One CHIRP `age` frames old off the nose (the echolocation chirp and the hungry tell, 3.7 / 4.3): r 5 -> 10 over
 * 12 f, narrowing +-45 -> +-38 -> +-30. A small arc needs span to show its curve: at the bible's r 3 and +-15 it was
 * a pink crumb, and at +-25 -> +-15 a 3 x 6 "J". From an anchor space entered at root (ox, oy) rotated `ang`.
 */
function chirp(ctx: CanvasRenderingContext2D, rig: DragonRig, info: DragonInfo, ox: number, oy: number, ang: number, age: number): void {
  if (age < 0 || age >= CHIRP) return;
  const f = age / CHIRP;
  snoutFront(rig, SN);
  soundArc(ctx, rig, info, ox, oy, ang, SN.x, SN.y, noseDir(rig), Math.round(5 + age * 0.45), spanAt(f, 45, 38, 30));
}

/** The echo-ping's arcs (fidget), adult frames: the chirp goes out at 12 for 14 f, the echo comes home at 30 for 12. */
const PING_OUT = 12, PING_OUT_LIFE = 14, PING_BACK = 30, PING_BACK_LIFE = 12;

/**
 * Bible 3.7 "Signature: Shriek", and every other sound the head makes that an act keys. Mouth space (clipped off
 * the eye by the rig); every arc is soundArc in face space.
 *   BREATH (the trick): the wind-up is the shared anim's (the fans fold flat on `flare` -1, the head pulls back)
 *     plus the throat sac (drawSac, drawn here too); the release snaps the fans to the dish (`flare` 1.3, fan())
 *     and the jaw to 40 (tuning.breath). ARCS from cue 0: 3 (young 2), one every 8 f, radius 6 -> 34 over 24 f
 *     (young -> 24), fading by NARROWING, +-35 -> +-28 -> +-22 by thirds of their life (at +-15 an arc of r 30 is
 *     a straight bar, 1 px of bow). The adult's ribs rattle (fan()); neighbours flinch on the anim's 'shriek' event
 *     (overrides). BABY: a squeak, one arc r 4 -> 14 over 12 f at +-45 -> +-38 -> +-30, then its fans flop over its
 *     eyes (fan(), E8).
 *   BEG (4.3 hungry tell): one short chirp arc every 60 f off the nose (chirp()), the jaw popping open for it.
 *   SLEEP (4.3): a snore arc off the nose on each exhale, tipped 20 deg up: r 6 -> 9 over 24 f, narrowing
 *     +-50 -> +-34 (at a flat r 3 and +-15 it was a 2 x 2 pink dot, and at r 4 -> 6 and +-25 a tick).
 *   CALL (3.7 lonely call): ONE long, slow arc from the open mouth, out to 40 px over the whole call (young 30,
 *     baby 20), narrowing as it goes, +-35 -> +-22; no dish, no flinch.
 *   FIDGET (the echo-ping): a PAIR of chirp arcs off the nose, "))", then its ECHO comes home as a pair facing the
 *     dragon, "((", centred out ahead where the chirp struck and closing in on it; the fans flick as it lands.
 */
const breath: ElementDraw = (ctx, rig, pose, info) => {
  const act = pose.act, c = pose.cue, st = info.stage, J = rig.j, mx = J.mouth.x, my = J.mouth.y, ma = info.ang;
  if (act === ACT.breath || act === ACT_CALL) drawSac(ctx, rig, pose, info);
  if (rig.override) return;
  if (act === ACT.breath) {
    if (c < 0) return;
    const n = st === 'adult' ? 3 : st === 'young' ? 2 : 1, life = st === 'baby' ? 12 : 24;
    const r0 = st === 'baby' ? 4 : 6, r1 = st === 'adult' ? 34 : st === 'young' ? 24 : 14;
    for (let k = 0; k < n; k++) {
      const age = c - 8 * k;
      if (age < 0 || age >= life) continue;
      const f = age / life, sp = st === 'baby' ? spanAt(f, 45, 38, 30) : spanAt(f, 35, 28, 22);
      soundArc(ctx, rig, info, mx, my, ma, mx, my, ma + rig.tf.rot, Math.round(r0 + (r1 - r0) * f), sp);
    }
    return;
  }
  if (act === ACT.beg) { chirp(ctx, rig, info, mx, my, ma, c % 60); return; }
  if (act === ACT.sleep) {
    const B = Math.round(rig.tune.sleep.breath), age = c - Math.round(B / 2);
    if (c < 0 || age < 0 || age >= 24) return;
    snoutFront(rig, SN);
    soundArc(ctx, rig, info, mx, my, ma, SN.x, SN.y, noseDir(rig) - 20, 6 + Math.floor(age / 6), spanAt(age / 24, 50, 42, 34));
    return;
  }
  if (act === ACT_CALL) {
    const life = Math.round(CALL_SING * durOf(st)), R = st === 'adult' ? 40 : st === 'young' ? 30 : 20;
    if (c < 0 || c >= life) return;
    const f = c / life;
    soundArc(ctx, rig, info, mx, my, ma, mx, my, ma + rig.tf.rot, Math.round(5 + (R - 5) * f), spanAt(f, 35, 28, 22));
    return;
  }
  if (act === ACT.fidget) {
    const k = durOf(st), t1 = Math.round(PING_OUT * k), out = Math.round(PING_OUT_LIFE * k);
    const t2 = Math.round(PING_BACK * k), back = Math.round(PING_BACK_LIFE * k);
    const reach = st === 'adult' ? 30 : st === 'young' ? 26 : 20, dir = noseDir(rig);
    snoutFront(rig, SN);
    if (c >= t1 && c < t1 + out) {
      // going out: ")" then a second ")" 4 px behind it, r 8 -> 60 % of the reach
      const f = (c - t1) / out, R = Math.round(8 + (reach * 0.6 - 8) * f);
      soundArc(ctx, rig, info, mx, my, ma, SN.x, SN.y, dir, R, 40);
      if (R - 4 >= 5) soundArc(ctx, rig, info, mx, my, ma, SN.x, SN.y, dir, R - 4, 40);
    }
    if (c >= t2 && c < t2 + back) {
      // the echo: centred where the chirp struck (out ahead along the snout), its arcs facing back at the dragon and
      // widening toward it, "((" coming home against the chirp's "))" going out
      const f = (c - t2) / back, R = Math.round(8 + (reach - 16) * f);
      const wx = SN.x + Math.cos(dir * DEG) * reach, wy = SN.y + Math.sin(dir * DEG) * reach;
      soundArc(ctx, rig, info, mx, my, ma, wx, wy, dir + 180, R, 35);
      if (R - 4 >= 5) soundArc(ctx, rig, info, mx, my, ma, wx, wy, dir + 180, R - 4, 35);
    }
  }
};

// ---------- ambient: the chirp, the song ----------

/**
 * The note glyph (3.7 "it sings"), an eighth note: a 3 x 3 ball, a 2 px stem rising from its right side and a flag
 * hooking down beside the stem's top, 5 x 7, rows as bit masks (the high bit on the left). Drawn in `glow` with a
 * 1 px ink ring on its four sides (5.2: inked glyphs), never mirrored. The ring's notch between the flag's foot and
 * the stem is what reads "note": with the flag a solid 2 x 2 block, or an 8-neighbour ring filling that notch, the
 * glyph was a pink boot or a bean at game scale.
 */
const NOTE_ROWS: readonly number[] = [0b00110, 0b00111, 0b00111, 0b00101, 0b11100, 0b11100, 0b11100];
const NOTE_W = 5;
/** Is cell (c, r) of the note on? */
function noteOn(c: number, r: number): boolean {
  return r >= 0 && r < NOTE_ROWS.length && c >= 0 && c < NOTE_W && ((NOTE_ROWS[r] >> (NOTE_W - 1 - c)) & 1) === 1;
}
/** Top-pass draw: one note (it.x, it.y = its top-left; c0 = fill, c1 = ink). */
function drawNote(ctx: CanvasRenderingContext2D, it: TopItem): void {
  const sc = it.sc, h = NOTE_ROWS.length;
  ctx.fillStyle = it.c1;
  for (let r = -1; r <= h; r++) for (let c = -1; c <= NOTE_W; c++) {
    if (noteOn(c, r)) continue;
    if (noteOn(c - 1, r) || noteOn(c + 1, r) || noteOn(c, r - 1) || noteOn(c, r + 1)) ctx.fillRect(it.x + c * sc, it.y + r * sc, sc, sc);
  }
  ctx.fillStyle = it.c0;
  for (let r = 0; r < h; r++) for (let c = 0; c < NOTE_W; c++) if (noteOn(c, r)) ctx.fillRect(it.x + c * sc, it.y + r * sc, sc, sc);
}

const NT = { x: 0, y: 0 };
/**
 * Queue note k of a song `age` frames after it was sung (life `life` f): it leaves above the snout, each note of the
 * scale starting 5 px higher and 10 px further out than the last (rising in pitch: a scale climbing a staff), and
 * floats up 8 px and on 3 px in 3 alpha steps (the top pass: 1.4 step 14). Root space.
 */
function note(rig: DragonRig, k: number, age: number, life: number): void {
  if (!rig.top || age < 0 || age >= life) return;
  const f = age / life;
  snoutFront(rig, SN);
  rootToScreen(rig, SN.x + 2 + 10 * k + Math.round(f * 3), SN.y - 8 - 5 * k - Math.round(f * 8), NT);
  const it = rig.top.push(drawNote, NT.x - 2 * rig.pxScale, NT.y - 7 * rig.pxScale, rig.pxScale, rig.facing);
  if (it) { it.c0 = rig.pal.glow; it.c1 = rig.outline; it.alpha = stepAlpha(f); }
}

const AM_AGES = new Float32Array(3), AM_IDS = new Int32Array(3);
/**
 * Bible 3.7 "Ambient" and 4.3's happy flourish. Root space.
 *   HAPPY (act = happy, from cue 0): it SINGS a rising 3-note scale, one note every 8 f.
 *   Awake and idle (or walking, or in a shared idle variant), through the ambient caps (5.4):
 *     content (mood < 0.6): the ECHOLOCATION CHIRP, a small arc off the nose (chirp()) every 150 +- 50 f;
 *     happy (mood >= 0.6): it hums instead, 2 rising notes every 200 +- 60 f ("chirps when content, sings when
 *     happy").
 * (The fan twitch of 3.7 moves the fans themselves: fan().)
 */
const ambient: ElementDraw = (ctx, rig, pose, info) => {
  if (rig.override || info.asleep) return;
  const act = pose.act, c = pose.cue;
  if (act === ACT.happy) {
    if (c >= 0) for (let k = 0; k < 3; k++) note(rig, k, c - 8 * k, 40);
    return;
  }
  if (!(act === ACT.none || act === ACT.walk || act === ACT.variant)) return;
  const stretch = rig.budget.stretch;
  if (info.mood >= 0.6) {
    const n = liveSpawns(info.seed + 3, info.tick, 200 * stretch, 60, 44, AM_AGES, AM_IDS);
    let want = 0;
    for (let i = 0; i < n; i++) want += AM_AGES[i] >= 8 ? 2 : 1;
    let left = rig.budget.take(rig.slot, want);
    for (let i = 0; i < n && left > 0; i++) for (let k = 0; k < 2 && left > 0; k++) {
      if (AM_AGES[i] - 8 * k < 0) continue;
      note(rig, k, AM_AGES[i] - 8 * k, 36); left--;
    }
    return;
  }
  const n = rig.budget.take(rig.slot, liveSpawns(info.seed + 1, info.tick, 150 * stretch, 50, CHIRP, AM_AGES, AM_IDS));
  if (!n) return;
  for (let i = 0; i < n; i++) chirp(ctx, rig, info, 0, 0, 0, AM_AGES[i]);
};

// ---------- anims ----------

/** A constant track. */
const K = (v: number): Key[] => [[0, v]];

/**
 * The idle fidget: the ECHO-PING (adult 64 f; young x 0.85, baby x 0.6). A cave dragon checking its cave: it lifts
 * its head 15 deg and pricks its fans upright (flare +1: from any mood), sends a pair of chirp arcs off its nose at
 * f 12 (breath(): "))" going out), leans in to listen (root +2 px, the chest dipping), and at f 30 the echo comes
 * home (a pair facing back at it, "((", closing in); as it lands at f 42 the fans flick into a half dish and the
 * head tips in a pleased little nod, then it settles. act = fidget, cue = its clock. (Lifting 9 deg with a single
 * small arc each way, it read as "looks up, smiles".)
 */
function fidget(stage: Stage): DragonAnim {
  const k = durOf(stage), L = Math.round(64 * k), t = (f: number) => Math.round(f * k);
  return bake({
    'neck.a0': [[0, 0], [t(10), -7], [t(26), -7], [t(34), -3], [t(42), -3], [t(48), -2], [t(58), 0]],
    'head.rot': [[0, 0], [t(10), -15], [t(26), -15], [t(34), -10], [t(42), -10], [t(45), 5], [t(50), 3], [t(60), 0]],
    'body.rot': [[0, 0], [t(10), -2], [t(26), -2], [t(34), 1], [t(44), 1], [t(56), 0]],
    'root.x': [[0, 0], [t(26), 0], [t(34), 2], [t(44), 2], [t(56), 0]],
    flare: [[0, 0], [t(8), 1], [t(40), 1], [t(43), 1.25, 'out'], [t(47), 1], [t(54), 0.5], [L, 0]],
    face: [[0, DFACE.neutral], [t(45), DFACE.happy], [t(56), DFACE.neutral]],
    act: K(ACT.fidget), cue: [[0, 0], [L, L]],
  }, { stage, len: L, next: 'idle' });
}

/**
 * The LONELY CALL (3.7: "a different animation from the trick"): the head lifts and the throat sac fills over the
 * wind-up (drawSac), then one long, mournful note -- the jaw at 25, the `sad` face, the fans pinned at -1 whatever
 * its mood (flare -1, fanGauge), ONE slow arc (breath()) -- and the head sinks as it dies away. No dish, no overshoot, no
 * flinch: its 'call' event turns the neighbours' heads toward it instead (5.4). Adult 100 f; young x 0.85, baby x
 * 0.6. act = the call (ACT_CALL), cue from the note's start.
 */
function callAnim(stage: Stage): DragonAnim {
  const k = durOf(stage), W = Math.round(CALL_WIND * k), S = Math.round(CALL_SING * k), L = W + S + Math.round(CALL_REST * k);
  const t = (f: number) => Math.round(f * k);
  return bake({
    'neck.a0': [[0, 0], [W, -10], [W + S, -8], [W + S + t(12), 4], [L, 0]],
    'head.rot': [[0, 0], [W, -18], [W + S - t(10), -14], [W + S + t(12), 8], [L, 0]],
    'body.rot': [[0, 0], [W, -4], [W + S, -3], [L, 0]],
    squash: [[0, 1], [W - t(4), 1.03], [W + S, 1.01], [L, 1]],
    jaw: [[0, 0], [W - 1, 0], [W, 25], [W + S - 1, 25], [W + S, 0]],
    flare: [[0, 0], [t(8), -1], [L - t(8), -1], [L, 0]],
    'tail.lift': [[0, 0], [W, 5], [W + S + t(10), 8], [L, 0]],
    face: [[0, DFACE.neutral], [t(8), DFACE.sad], [L - t(6), DFACE.neutral]],
    act: K(ACT_CALL), cue: [[0, -W], [L, L - W]],
  }, { stage, len: L, next: 'idle', events: [[W, 'call']] });
}

/**
 * The anim overrides (4.3), each the shared builder's own output with its element additions:
 *   breath: the shriek raises `event: 'shriek'` at the snap (young, adult), so up to 2 neighbours flinch (5.4); the
 *     baby's squeak does not;
 *   beg: the hungry tell's chirp opens the jaw (its stage minimum) for 6 f at each chirp, f 0 and f 60 (breath()
 *     draws the arc; fan() pins the fans forward);
 *   call: the lonely call, an anim of its own (callAnim).
 */
function overrides(stage: Stage, dims: DragonDims | null): Partial<Record<string, DragonAnim>> {
  const tune = animTuning(stage, SHRIEKSCALE);
  const br = breathAnim(stage, tune);
  if (stage !== 'baby') {
    for (const f of br.frames) if (f.pose && f.pose.act === ACT.breath && (f.pose.cue ?? -1) >= 0) { f.event = 'shriek'; break; }
  }
  const beg = begAnim(stage, tune), jaw = dims ? dims.head.jawMin : STAGE_JAW_MIN[stage];
  let t = 0;
  for (const f of beg.frames) {
    // (the shared loop's `cue: [[0, 0], [L, L]]` folds its last key onto frame 0 and runs 120 -> 0 backwards: the
    // clock is rewritten here as the frame time, which is what pose.cue promises for beg)
    if (f.pose) { f.pose.cue = t; if (t % 60 < 6) f.pose.jaw = jaw; }
    t += f.dur;
  }
  return { breath: br, beg, call: callAnim(stage) };
}
/** The open jaw's stage minimum (1.2), deg, for a dims-less table (the build's `head.jawMin` otherwise). */
const STAGE_JAW_MIN: Readonly<Record<Stage, number>> = { baby: 20, young: 20, adult: 16 };

/**
 * A "volume-bar" chevron on the tail (3.7 table), a chunky filled caret (5.2). The adult's pair steps DOWN in size
 * along the thinning whip, 6 x 5 then 5 x 4: a sound fading out toward the tip.
 */
const chevron = (t: number, size = 5, h = 4) => ({ kind: 'chevron' as const, at: 'tail' as const, t, size, h });

export const SHRIEKSCALE: ElementSpec = {
  id: 'shriekscale',
  name: 'Echo',
  blurb: 'Dramatic, clingy and nocturnal. It shrieks when lonely, chirps when content and sings when happy.',
  palette: PAL,
  modifiers: {
    bodyLength: 1.0, bodyDepth: 1.0, legLength: 1.0, legR: 0.75, neckLength: 1.1, neckAngle: 0, tailLength: 1.1, tailR: 0.7,
    snout: 1.0, jawDepth: 1.3, jawMax: 40,
  },
  stages: {
    // the first marking is the eye mask (headMarkings), present from hatching; the baby carries it alone (D15)
    baby: {
      tailRest: TAIL_REST.shriekscale.baby, horns: null, markings: [],
      wing: wingParams({ style: 'bat' }), dorsal: null,
    },
    // + 1 "volume-bar" chevron on the tail
    young: {
      tailRest: TAIL_REST.shriekscale.young, horns: null, markings: [chevron(0.4)],
      wing: wingParams({ style: 'bat', plus: true, scallop: 3 }), dorsal: null,
    },
    // + 2 chevrons; the adult-only nose-leaf: a 4 x 4 bump in the skull path
    adult: {
      tailRest: TAIL_REST.shriekscale.adult, horns: null, markings: [chevron(0.3, 6, 5), chevron(0.5)],
      wing: wingParams({ style: 'bat', plus: true, scallop: 5, wristThorn: 3 }), dorsal: null,
      skullBumps: [{ x: 14, y: -1.5, r: 2 }],
    },
  },
  render: { farHead, nearHead, headMarkings, breath, ambient },
  anims: {
    // 4.3 "Shriekscale": the walk's fan bob, the happy song, the hungry chirp with the fans pinned forward and the
    // sleeping snore are renderer flourishes keyed on act / cue (fan(), breath(), ambient()); the shriek's event,
    // the chirping beg and the lonely call are overrides; the echo-ping is the fidget. Asleep it rests its head on
    // its crossed paws with its neck a little up (chin 9 / 7 px: resting on the floor, or at the paws' 5.5 / 4.5, the
    // asleep silhouette was a mound with a 3 px knob at ÷3, 5.1 #1), so the curled fans stand clear above the back
    // and wing. The shriek opens the jaw to 40 deg (the young too: the element's jawMax 40 replaces the stage's 34);
    // the baby's squeak ends in the fan flop over its eyes, 24 f (ledger E8), then a blink.
    tuning: (st) => ({
      breath: { jaw: st === 'baby' ? 24 : 40, flop: st === 'baby' ? 24 : 0, fizzleFace: st === 'baby' ? 'sheepish' : 'dazed' },
      sleep: { chin: st === 'adult' ? 10 : 8 },
    }),
    overrides: (st, dims) => overrides(st, dims),
    fidget: (st) => fidget(st),
  },
};

