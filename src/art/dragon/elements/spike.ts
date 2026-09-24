// SPIKE: "Bramble", the bramble dragon (docs/ART_BIBLE.md 3.3). Zone: the back line, nape -> tail. Cue: a comb of
// pale bone quills, which lean with its mood; bristling is a separate alarm (pose.bristle).
import { DRAGON_PALETTES } from '../palettes.ts';
import type { DragonPalette } from '../palettes.ts';
import { TAIL_REST } from '../stages.ts';
import type { Stage } from '../stages.ts';
import { hornParams, wingParams } from '../element.ts';
import type { ElementSpec, ElementDraw } from '../element.ts';
import { backLineY, mouthToRoot, pixelStroke } from '../features.ts';
import { enterFaceFromLocal } from '../rig.ts';
import type { DragonRig } from '../rig.ts';
import { ACT, DFACE } from '../pose.ts';
import { bake } from '../anims.ts';
import { outlinePath, tones } from '../../../lib/art/shading.ts';
import { flat } from '../../../lib/art/shading.ts';

const PAL = DRAGON_PALETTES.spike;

/**
 * The comb per stage (3.3 table): back quills as [x fraction rump -> neck base, height, base], then tail quills [t,
 * height, base]. Bases are wide (young 6, adult 8): the comb is ONE silhouette, and at 5-6 px a leaning quill left
 * 1-2 px of bone between two ink edges, read as a grey ink scribble. Baby nubs: body-space x of the loin and rump
 * nubs, then the tail nub's t (the first spot past the hip, halfway along the baby's short tail), spaced so the
 * three stand >= 1 px apart (at -4 / -8.5 / 0.3 the rump and tail nubs touched and read as two).
 */
const COMB: Readonly<Record<Stage, { back: readonly (readonly number[])[]; tail: readonly (readonly number[])[]; blunt: boolean }>> = {
  // babies: 3 soft nubs on the loin, rump and tail root (the big head hides the front 60 % of the back)
  baby: { back: [[-2.5, 4, 4], [-7, 4, 4]], tail: [[0.5, 4, 4]], blunt: true },
  young: { back: [[0.04, 6, 6], [0.48, 9, 6], [0.92, 7, 6]], tail: [[0.22, 5, 5]], blunt: false },
  // the bible lists the back quills neck base -> rump, [7, 11, 12, 10, 7]; this list runs rump (0) -> neck base (1)
  adult: { back: [[0.0, 7, 8], [0.25, 10, 8], [0.5, 12, 8], [0.75, 11, 8], [1.0, 7, 8]], tail: [[0.14, 6, 6], [0.32, 5, 5], [0.5, 4, 4]], blunt: false },
};

/**
 * Append one quill to the current path: base centred at (bx, by), `h` tall along the unit normal (nx, ny), leaning
 * `lean` deg toward (tx, ty). A blunt nub ends in a flat 2 px cap instead of a point.
 */
function quill(ctx: CanvasRenderingContext2D, bx: number, by: number, nx: number, ny: number, tx: number, ty: number,
  h: number, base: number, lean: number, blunt: boolean): void {
  const a = lean * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const ux = nx * c + tx * s, uy = ny * c + ty * s;       // quill axis
  const hb = base / 2;
  ctx.moveTo(bx - tx * hb, by - ty * hb);                 // base, toward the head
  if (blunt) { ctx.lineTo(bx + ux * h - tx, by + uy * h - ty); ctx.lineTo(bx + ux * h + tx, by + uy * h + ty); }
  else ctx.lineTo(bx + ux * h, by + uy * h);              // tip
  ctx.lineTo(bx + tx * hb, by + ty * hb);                 // base, toward the tail
  ctx.closePath();
}

/**
 * The quill lean at `mood` (3.3, D7): 50 deg back at -1 (a sad droop that keeps 64 % of the upright height), 28 at
 * rest, 15 at +1 (perky); babies at half the range. At the old 35 deg rest a young quill's saw was down to 2 px
 * bumps at /3 (5.1 #1). Bristle snaps them upright, the only fully upright state.
 */
function leanOf(baby: boolean, m: number, bristle: number): number {
  const lean = baby ? 14 + (m < 0 ? -11 * m : -7 * m) : 28 + (m < 0 ? -22 * m : -13 * m);
  return lean * (1 - bristle);
}

/**
 * FIRST PASS: bible 3.3 "The cue: the comb back". Body space, before the body (its contour hides the roots). The
 * whole comb, back and tail quills, is ONE path stroked once and filled once in plain `horn` (the drawLimbSegs
 * lesson): overlapping neighbours share one outer ink line, where a celPoly per quill crossed each one's ink over
 * its neighbour's and left grey scribbles. Still to do: the ripple ambient, the bristle tremble, the fired-quill
 * regrow, the wary lean.
 */
const backRow: ElementDraw = (ctx, rig, pose, info) => {
  const comb = COMB[info.stage], d = rig.dims, J = rig.j;
  const baby = info.stage === 'baby', breathing = pose.act === ACT.breath;
  // asleep: the quill ball (4.3) -- upright in the WORLD (the body's pitch leaned back out, or they droop toward
  // the head), but no size-up or tremble, so it reads as a ball and not an alarm; the breath's wind-up snaps them
  // upright on `bristle` without the alarm's size-up either
  const lean = info.asleep ? info.ang : leanOf(baby, info.mood, pose.bristle);
  // the volley fires the back quills: they regrow from a stub over 30 f after the snap (3.3)
  const regrow = breathing && pose.cue >= 0 && !baby ? Math.min(1, 0.3 + 0.7 * Math.max(0, pose.cue - 4) / 30) : 1;
  const grow = (info.asleep || breathing ? 1 : 1 + 0.15 * pose.bristle), vary = info.sp.lenVar || 0;
  const x0 = rig.hipB.x - d.hipR * 0.35, x1 = rig.chestB.x + d.chestR * 0.05;
  ctx.beginPath();
  for (let i = 0; i < comb.back.length; i++) {
    const q = comb.back[i];
    const x = baby ? q[0] * (d.hipR / 6.5) : x0 + (x1 - x0) * q[0];
    const y = backLineY(rig, x) + 1.5;
    quill(ctx, x, y, 0, -1, -1, 0, (q[1] + vary) * grow * regrow + 1.5, q[2], lean, comb.blunt);
  }
  // quills carry on along the TOP of the tail, shrinking toward the tip (the tip itself is a plain taper: D5)
  const tn = J.tailN;
  for (let i = 0; i < comb.tail.length; i++) {
    const q = comb.tail[i];
    const f = q[0] * tn, k = Math.min(tn - 1, Math.floor(f)), u = f - k;
    const bx = J.tailBX[k] + (J.tailBX[k + 1] - J.tailBX[k]) * u, by = J.tailBY[k] + (J.tailBY[k + 1] - J.tailBY[k]) * u;
    let dx = J.tailBX[k + 1] - J.tailBX[k], dy = J.tailBY[k + 1] - J.tailBY[k];
    const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    const nx = -dy, ny = dx;                                   // dorsal side of a tail pointing away from the body
    // a tail curled under the body (the quill ball asleep) turns its dorsal side to the floor: a quill there lies
    // pressed flat under it, so only quills whose side faces up (in root space, the body's pitch included) stand
    if (nx * Math.sin(info.ang * Math.PI / 180) + ny * Math.cos(info.ang * Math.PI / 180) > -0.25) continue;
    const r = J.tailR[k] + (J.tailR[k + 1] - J.tailR[k]) * u;
    quill(ctx, bx + nx * (r - 1), by + ny * (r - 1), nx, ny, dx, dy, q[1] * grow + 1, q[2], lean, comb.blunt);
  }
  flat(ctx, rig, info.pal.horn);
  if (breathing && pose.cue >= 0 && !baby && !rig.override) drawVolley(ctx, rig, pose.cue, info.stage === 'adult' ? 5 : 3, info.pal);
};

/** Scratch for the volley. */
const QV = { x: 0, y: 0 };
/** Frames a fired quill flies before it pops, and how long its sparkle shows. */
const FLY = 20, POP = 6;

/**
 * Quill k of n of a volley `age` frames after ITS launch, root space (into QV): every quill leaves the neck base
 * (the front of the comb, each 2 px further back so they do not stack at launch) and flies toward the facing side
 * in a FAN, the first launched the most forward (20 deg above level) and the last the steepest (60 deg), 3 px/f
 * under a light gravity: clear of the head in ~7 f and ~55 px out along its line in its 20 f, so the fan opens in
 * front of and above the head (at 2 px/f they spent most of their flight behind it).
 * Launched straight up first (85 -> 40 deg, 2 f apart) the five stood in one column behind the head at every
 * instant and read as a crest or a feather duster (3.3, 5.4: breath points away from its own body).
 */
function volleyAt(rig: DragonRig, k: number, n: number, age: number): void {
  const J = rig.j, f = n > 1 ? k / (n - 1) : 0.5;
  const bx = rig.chestB.x + rig.dims.chestR * 0.05 - 2 * k, by = backLineY(rig, bx) + 1;
  const c = Math.cos(rad(J.bodyAng)), s = Math.sin(rad(J.bodyAng));
  const a = rad(20 + 40 * f), v = 3;
  QV.x = J.body.x + bx * c - by * s + Math.cos(a) * v * age;
  QV.y = Math.min(-2, J.body.y + bx * s + by * c - Math.sin(a) * v * age + 0.015 * age * age);
}
const rad = (d: number): number => d * Math.PI / 180;

/**
 * The volley (3.3), drawn from backRow in BODY space, before the body: the quills leave the back, so the neck and
 * the head lie over them until they clear the silhouette (drawn with the breath, after the head, they crossed the
 * face). Launched within 4 f, forward quill first (volleyAt). Each is a `horn` 3 x 6 inked quill along its flight
 * trailing a 6 px sap streak (`glow` 2 px on a 1 px `scale` edge, so it reads on the pale floor), the streak in
 * whole pixels (face space: a rotated 2 px stroke anti-aliased into a pale smear); at 20 f each pops into ONE ringed
 * 2 x 2 `glow.hi` sparkle for 6 f (two per quill read as pairs of rings, "oo oo oo"), its ring cut at the corners.
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
    if (age >= FLY) {
      // the ring hugs the 2 x 2 on its four sides only (corners cut): a full 4 x 4 box round a pale centre read as
      // a hollow square
      enterFaceFromLocal(ctx, rig, 0, 0, 0, Math.round(x), Math.round(y));
      ctx.fillStyle = rig.col(pal.scale); ctx.fillRect(-2, -1, 4, 2); ctx.fillRect(-1, -2, 2, 4);
      ctx.fillStyle = rig.col(hi); ctx.fillRect(-1, -1, 2, 2);
      ctx.restore();
      continue;
    }
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
 * FIRST PASS: bible 3.3 "Signature: Quill Volley". The wind-up is the shared anim's `bristle` (quills snap
 * upright). The VOLLEY itself is drawn by backRow (drawVolley), behind the body, neck and head it leaves from; the
 * fired quills regrow there too. BABY (this renderer, mouth space walked back to root space): one nub pops off the
 * rump, bounces once and lies there, while the anim holds the puffball squash (tuning.breath.puff 1.15). Still to
 * do: the sneeze.
 */
const breath: ElementDraw = (ctx, rig, pose, info) => {
  if (pose.act !== ACT.breath || pose.cue < 0 || rig.override || info.stage !== 'baby') return;
  const c = pose.cue;
  ctx.save();
  mouthToRoot(ctx, rig, info.ang);
  // one nub: off the rump, up and back, one bounce, then it lies on the floor
  const J = rig.j, x0 = J.body.x + rig.hipB.x - 2, y0 = J.body.y + backLineY(rig, rig.hipB.x - 2) - 2;
  let x = x0 - 0.5 * c, y = y0 - 1.6 * c + 0.15 * c * c;
  if (y > -2) { const t1 = c - 16; y = t1 < 8 ? -2 - Math.max(0, 1.2 * t1 - 0.15 * t1 * t1) : -2; x = x0 - 8 - 0.2 * Math.min(8, t1); }
  // the nub as the comb draws it: a 4 x 4 blunt triangle standing on its base (an inked square read as a crumb)
  const bx = Math.round(x), by = Math.round(y) + 2;
  ctx.beginPath(); ctx.moveTo(bx - 2, by); ctx.lineTo(bx - 1, by - 4); ctx.lineTo(bx + 1, by - 4); ctx.lineTo(bx + 2, by); ctx.closePath();
  outlinePath(ctx, rig);
  ctx.fillStyle = rig.col(info.pal.horn); ctx.fill();
  ctx.restore();
};

/**
 * FIRST PASS: bible 3.3 "Idle fidget: it grooms its quills with its head turned back (40 f)". The neck arches back
 * and the head turns round over the shoulder, snout down to the comb, nibbling (jaw open-shut every 4 f), eyes
 * shut, then it settles.
 */
function fidget(stage: Stage): ReturnType<typeof bake> {
  const k = stage === 'adult' ? 1 : stage === 'young' ? 0.85 : 0.6, L = Math.round(40 * k), t = (f: number) => Math.round(f * k);
  const nib: [number, number][] = [[0, 0]];
  for (let f = 10; f < 30; f += 4) nib.push([t(f), 16], [t(f + 2), 0]);
  return bake({
    // the head turned BACK over the shoulder, snout down toward the comb: the neck arches back and the head turns
    // past vertical (keyed +34, snout down, it dipped forward to its own chest)
    'neck.a0': [[0, 0], [t(8), -34], [t(32), -34], [t(40), 0]],
    'neck.a1': [[0, 0], [t(8), -34], [t(32), -34], [t(40), 0]],
    'head.rot': [[0, 0], [t(8), -150], [t(20), -140], [t(32), -150], [t(40), 0]],
    'body.rot': [[0, 0], [t(8), -3], [t(32), -3], [t(40), 0]],
    jaw: nib,
    face: [[0, DFACE.neutral], [t(8), DFACE.closed], [t(32), DFACE.neutral]],
    act: [[0, ACT.fidget]], cue: [[0, 0], [L, L]],
  }, { stage, len: L, next: 'idle' });
}

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
      horns: hornParams({ len: 3, at: 145, sink: 1, sweep: 14 }),
      markings: [{ kind: 'ring', at: 'tail', t: 0.15, size: 3 }, { kind: 'ring', at: 'tail', t: 0.45, size: 3 }],
      wing: wingParams({ style: 'leaf', scallop: -2, foldRise: 0 }),
      dorsal: null,
    },
    adult: {
      tailRest: TAIL_REST.spike.adult,
      horns: hornParams({ len: 6, at: 145, sink: 1, sweep: 12 }),
      markings: [{ kind: 'ring', at: 'tail', t: 0.15, size: 3 }, { kind: 'ring', at: 'tail', t: 0.4, size: 3 }, { kind: 'ring', at: 'tail', t: 0.62, size: 3 }],
      wing: wingParams({ style: 'leaf', scallop: -3, foldRise: 0, thorn: 3, wristThorn: 4 }),
      dorsal: null,
    },
  },
  render: { backRow, breath },
  anims: {
    // FIRST PASS: bible 4.3 "Spike": the shy creep (0.35 px/f, head down 8) and the quill-ball sleep (body rot +10).
    // Still to do: the stop-and-look every second cycle (a walk override), the wary lean near other dragons, the
    // happy quill ripple at cue 0, the drooping hungry tell. The grooming fidget: fidget().
    fidget,
    tuning: (st) => ({
      breath: { puff: st === 'baby' ? 1.15 : 1 },
      walk: { speed: st === 'adult' ? 0.35 : st === 'young' ? 0.4 : 0.24, head: st === 'baby' ? 4 : 8 },
      // the quill ball: pitched +10 (its chest rests on the floor: the settle allows for the pitch), the tail dropped
      // straight down behind the rump and curled forward along the floor under the body, the quills standing
      // world-upright (backRow): a round mound with a saw-tooth top. The baby's bun RAISES its tail a little above
      // level behind the rump instead, so its tail nub stands over the rump nub: lying flat, its 4 x 4 nubs vanished
      // at /3 and the asleep baby spike was baby rock's mound (5.1 #1)
      sleep: { bodyRot: st === 'baby' ? 6 : 10, tailLift: st === 'baby' ? -12 : 88, tailCurl: st === 'baby' ? 4 : 26 },
    }),
  },
};
