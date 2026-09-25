// Shared, parameterised dragon features used by several elements (ART_GENERATOR lesson 49: one renderer fix reaches
// the whole cast). The rig draws these from ElementStageParams; element renderers may also call them directly.
//
//   - paired horns / brow thorns (fire, spike, lightning): drawHorn, cranium space;
//   - markings (chevrons, rings, Z-stripes, spots): clipped pigment, never inked (D13);
//   - the dorsal fin row (water): a low scalloped membrane strip, drawn before the body so its root is hidden;
//   - emitter helpers (flame, crystals, sparks): flat inked blobs with an un-inked core, never cel-banded (D20).
import { rad } from '../../lib/engine/math.ts';
import { flat, outlinePath, tones } from '../../lib/art/shading.ts';
import type { DragonPalette } from './palettes.ts';
import type { DragonRig } from './rig.ts';
import type { DorsalParams, HornParams, MarkingSpec } from './element.ts';
import { pathTube } from './parts.ts';

const HX = new Float32Array(3), HY = new Float32Array(3), HR = new Float32Array(3);

/**
 * One horn's three nodes (cranium space) into (xs, ys, rs). Root on the cranium circle at `hp.at` degrees, sunk
 * `hp.sink` px; the first part runs `ref - hp.sweep - tilt` degrees BELOW straight back (`ref` = the neck line, as
 * the rig measures it), then bends `hp.bend` up at the midpoint -- or kinks at `hp.kinkAt` (lightning). (dx, dy)
 * offsets the root (the far horn: 3 px back, 1 px up).
 */
function hornNodes(hp: Readonly<HornParams>, cranR: number, ref: number, tilt: number, dx: number, dy: number,
  xs: Float32Array, ys: Float32Array, rs: Float32Array): void {
  const a = rad(hp.at), rr = cranR - hp.sink;
  xs[0] = Math.cos(a) * rr + dx; ys[0] = -Math.sin(a) * rr + dy;
  const split = hp.kinkAt > 0 ? hp.kinkAt : 0.5;
  const b0 = ref - hp.sweep - tilt, d0 = rad(b0), d1 = rad(b0 - hp.bend);
  const l0 = hp.len * split, l1 = hp.len * (1 - split);
  xs[1] = xs[0] - Math.cos(d0) * l0; ys[1] = ys[0] + Math.sin(d0) * l0;
  xs[2] = xs[1] - Math.cos(d1) * l1; ys[2] = ys[1] + Math.sin(d1) * l1;
  rs[0] = hp.r0; rs[2] = hp.r1; rs[1] = hp.r0 + (hp.r1 - hp.r0) * split;
}

/**
 * One horn in cranium space (origin at the cranium centre, +x toward the snout), `ref` degrees = the neck line
 * below straight back (rig.ts neckRef). `tilt` rotates the whole horn up (the far horn's fork: 1.5) and
 * (dx, dy) offsets its root. One inked silhouette in `horn`; at r <= 1.5 the gates make it one flat tone.
 */
export function drawHorn(ctx: CanvasRenderingContext2D, rig: DragonRig, hp: Readonly<HornParams>, cranR: number, pal: Readonly<DragonPalette>,
  ref = 0, tilt = 0, dx = 0, dy = 0): void {
  hornNodes(hp, cranR, ref, tilt, dx, dy, HX, HY, HR);
  ctx.beginPath(); pathTube(ctx, HX, HY, HR, 3);
  flat(ctx, rig, pal.horn);
}

/** Where a horn's tip lands (cranium space, neck line `ref`), for clearance checks and spark crawlers. */
export function hornTip(hp: Readonly<HornParams>, cranR: number, out: { x: number; y: number }, ref = 0): { x: number; y: number } {
  hornNodes(hp, cranR, ref, 0, 0, 0, HX, HY, HR);
  out.x = HX[2]; out.y = HY[2];
  return out;
}

/**
 * How far a horn's tip (the top of its end cap) rises above the cranium's top IN THE WORLD, px, with the head at
 * `headAng` (deg, + = snout down). 3.0: a horn stays <= 3 px above the skull top.
 */
export function hornRise(hp: Readonly<HornParams>, cranR: number, ref: number, headAng: number, tilt = 0, dx = 0, dy = 0): number {
  hornNodes(hp, cranR, ref, tilt, dx, dy, HX, HY, HR);
  const h = rad(headAng), s = Math.sin(h), c = Math.cos(h);
  let top = Infinity;
  for (let i = 1; i < 3; i++) top = Math.min(top, HX[i] * s + HY[i] * c - HR[i]);
  return -top - cranR;
}

/**
 * The neck-line reference to draw a horn at (rig.ts neckRef, deg below straight back) so it keeps the quiet-zone
 * height of 3.0 (<= `maxRise` px above the skull top) whatever the pose: `ref` itself, or lowered back along the
 * head in 5 deg steps. With the neck carried below level (eating from the bowl, asleep) "along the neck line" points
 * up-back in the world, and the pair stood 5-7 px over the skull as antennae. A horn with a `worldClamp` then keeps
 * its root direction within [up, down] deg of straight back in the world (spike's brow thorn).
 */
export function hornRefClamped(hp: Readonly<HornParams>, cranR: number, ref: number, headAng: number, maxRise = 3): number {
  for (let i = 0; i < 18 && hornRise(hp, cranR, ref, headAng) > maxRise; i++) ref += 5;
  const wc = hp.worldClamp;
  if (wc) ref = Math.max(-wc[0], Math.min(wc[1], ref - hp.sweep - headAng)) + hp.sweep + headAng;
  return ref;
}

const FX2 = new Float32Array(3), FY2 = new Float32Array(3), FR2 = new Float32Array(3);
function inTube(x: number, y: number, xs: Float32Array, ys: Float32Array, rs: Float32Array, pad = 0): boolean {
  for (let i = 0; i < 2; i++) {
    const ax = xs[i], ay = ys[i], bx = xs[i + 1] - ax, by = ys[i + 1] - ay, L2 = bx * bx + by * by || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * bx + (y - ay) * by) / L2));
    const r = rs[i] + (rs[i + 1] - rs[i]) * t + pad, ex = x - ax - bx * t, ey = y - ay - by * t;
    if (ex * ex + ey * ey <= r * r) return true;
  }
  return false;
}

/**
 * The share (0..1) of the FAR horn's area that its near partner covers, sampled on a 0.5 px grid. 1.5: a far
 * feature overlapping its near partner by more than 70 % is not drawn -- two horns stacked into one dark slab read
 * as a cap, not a pair. The near horn is DILATED by `pad` px (2) for the test: a far horn lying parallel within
 * 2 px of it shows only as a 1-2 px darker rim along it, and the pair fused into one two-tone wedge (a floppy ear,
 * a beret) instead of reading as two horns. At 2 every young pair (8 deg fork) measures >= 0.86 and every adult
 * pair (28 deg) <= 0.62 over all seeds, so the cull never flickers with the idle's neck motion (at 1.5 the young
 * sat on the 0.7 line). Allocation-free.
 */
export function hornOverlap(hp: Readonly<HornParams>, cranR: number, ref: number, tilt: number, dx: number, dy: number, pad = 2): number {
  hornNodes(hp, cranR, ref, 0, 0, 0, HX, HY, HR);
  hornNodes(hp, cranR, ref, tilt, dx, dy, FX2, FY2, FR2);
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (let i = 0; i < 3; i++) {
    x0 = Math.min(x0, FX2[i] - FR2[i]); x1 = Math.max(x1, FX2[i] + FR2[i]);
    y0 = Math.min(y0, FY2[i] - FR2[i]); y1 = Math.max(y1, FY2[i] + FR2[i]);
  }
  let far = 0, both = 0;
  for (let y = y0 + 0.25; y < y1; y += 0.5) for (let x = x0 + 0.25; x < x1; x += 0.5) {
    if (!inTube(x, y, FX2, FY2, FR2)) continue;
    far++;
    if (inTube(x, y, HX, HY, HR, pad)) both++;
  }
  return far ? both / far : 1;
}

// ---------- markings: clipped pigment, never inked ----------

/**
 * Is pixel (x, y) of a w x h marking inked? The marking bitmaps, in whole pixels, so a 4-9 px mark stays crisp at
 * scale 1 (an anti-aliased polygon this small dissolves into a smudge). Bands are 3 px thick (5.2):
 *   chevron: a CHUNKY FILLED caret pointing up (fire's flame-licks, slinkwing's volume bars): a solid wedge
 *            widening 2 px per step from a 1-2 px tip, with a 1-2 px notch cut in its bottom row from 5 px wide
 *            (`solid`: no notch -- fire's: notched, three on an adult read as "A A A"). An outline "^" cannot be
 *            >= 3 px thick across its arms inside a 4-6 px box (two diagonal arms need ~8.5 px), and the 3 px-per-
 *            column version read as a 1.3 px pale "A"; this one is >= 3 px thick everywhere but the tip and the two
 *            feet, which stay >= 2 px wide;
 *   zstripe: a lightning Z, 3 px wide: a diagonal from the top-right that steps back 2 px at mid-height;
 *   spot   : the whole box (pearl spots, 3 x 3);
 *   ring   : the whole box (a tail ring is drawn across the tube instead: drawTailRing).
 */
export function markingPixel(kind: MarkingSpec['kind'], w: number, h: number, x: number, y: number, solid = false): boolean {
  switch (kind) {
    case 'chevron': {
      const w0 = 2 - (w & 1), steps = Math.max(0, (w - w0) >> 1);
      const rowW = w0 + 2 * Math.min(steps, Math.floor((y + 1) * (steps + 1) / h));
      const dx = Math.abs(x + 0.5 - w / 2);
      if (dx > rowW / 2) return false;
      return solid || !(y === h - 1 && w >= 5 && h >= 4 && dx < w0 / 2 + 0.01);
    }
    case 'zstripe': {
      const mid = Math.floor(h / 2), run = Math.max(1, w - 3);
      const cx = y < mid ? (w - 2) - Math.round(y * run / Math.max(1, mid)) : (w - 2) - Math.round((y - mid) * run / Math.max(1, h - mid)) - 0;
      const shift = y < mid ? 0 : -1;
      return Math.abs(x - (cx + shift)) <= 1;
    }
    default: return true;
  }
}

/**
 * Draw a marking bitmap centred on the current origin, in a DEVICE-ALIGNED space (rig.ts enterFace): whole pixels,
 * `hex` flat, no ink. The caller has clipped to the part (the body above the belly line, or the tail).
 */
export function drawMarkingPixels(ctx: CanvasRenderingContext2D, mk: Readonly<MarkingSpec>, hex: string): void {
  const w = mk.size, h = mk.h ?? mk.size, x0 = -Math.floor(w / 2), y0 = -Math.floor(h / 2);
  ctx.fillStyle = hex;
  for (let y = 0; y < h; y++) {
    let run = -1;
    for (let x = 0; x <= w; x++) {
      const on = x < w && markingPixel(mk.kind, w, h, x, y, mk.solid);
      if (on && run < 0) run = x;
      else if (!on && run >= 0) { ctx.fillRect(x0 + run, y0 + y, x - run, 1); run = -1; }
    }
  }
}

/**
 * A tail ring: a `size`-wide band across the local x axis (the tail's own frame), tall enough to cross the tube.
 * Drawn rotated with the tail and clipped to it.
 */
export function drawTailRing(ctx: CanvasRenderingContext2D, mk: Readonly<MarkingSpec>, hex: string): void {
  const w = mk.size;
  ctx.fillStyle = hex;
  ctx.fillRect(-w / 2, -20, w, 40);
}

/**
 * A 2 px stroke as whole pixels, from (x0, y0) to (x1, y1) in a DEVICE-ALIGNED space (rig.ts enterFace): a 2 x 2
 * brush stamped at every step along the major axis, so the mark is >= 2 px across at any angle and never an
 * anti-aliased smear (fan ribs, fin rays; 5.2). fillStyle is the caller's.
 */
export function pixelStroke(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void {
  const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    ctx.fillRect(Math.round(x0 + (x1 - x0) * t) - 1, Math.round(y0 + (y1 - y0) * t) - 1, 2, 2);
  }
}

// ---------- the back line ----------

/**
 * Body space: y of the body's top contour at x (the upper tangent of the hip and chest balls, or a ball's own top
 * past the tangent points). Back-row features (quills, fins, the dome) stand on it.
 */
function ballTop(x: number, cx: number, cy: number, r: number): number { const dx = x - cx; return Math.abs(dx) >= r ? 1e9 : cy - Math.sqrt(r * r - dx * dx); }
export function backLineY(rig: DragonRig, x: number): number {
  const h = rig.hipB, c = rig.chestB, d = rig.dims;
  let y = Math.min(ballTop(x, h.x, h.y, d.hipR), ballTop(x, c.x, c.y, d.chestR));
  if (x > h.x && x < c.x) y = Math.min(y, (h.y - d.hipR) + ((c.y - d.chestR) - (h.y - d.hipR)) * (x - h.x) / (c.x - h.x));
  return y > 1e8 ? 0 : y;
}

// ---------- the dorsal fin row ----------

/**
 * Body space: y of the dorsal line at x -- the body's back line, or behind the rump the top of the tail (body-space
 * tail nodes), whichever is higher. The tail counts only as far as it runs BACK from the rump: from the first segment
 * that turns forward again (a tail raised and curled over the rump) it is no longer the back's line, and taken as it
 * was, the lowest y over every segment dragged water's dorsal fin up to a tail curled over its rump as a tall dark web
 * (the elder core review, round 2).
 */
export function dorsalLineY(rig: DragonRig, x: number): number {
  const J = rig.j, tn = J.tailN, d = rig.dims;
  let y = x > rig.hipB.x - d.hipR ? backLineY(rig, x) : 1e9;
  for (let k = 0; k < tn; k++) {
    const ax = J.tailBX[k], bx = J.tailBX[k + 1];
    if (bx > ax) break;
    if ((x - ax) * (x - bx) > 0) continue;
    const u = (x - ax) / ((bx - ax) || 1);
    const ty = J.tailBY[k] + (J.tailBY[k + 1] - J.tailBY[k]) * u - (J.tailR[k] + (J.tailR[k + 1] - J.tailR[k]) * u);
    y = Math.min(y, ty);
  }
  return y > 1e8 ? 0 : y;
}

/**
 * Body space, drawn at the back-row step (bible 1.4 step 6: before the body, so its root hides under the body
 * contour; on the tail its base sits on the tail's own top ink): a low continuous strip of round scallops in
 * `membrane`, inked. Height <= 3 px (spike's back-line budget, 3.0).
 */
export function drawDorsalRow(ctx: CanvasRenderingContext2D, rig: DragonRig, dp: Readonly<DorsalParams>, pal: Readonly<DragonPalette>): void {
  const h = rig.hipB;
  const x0 = h.x + dp.from, x1 = h.x + dp.to;
  const n = Math.max(1, dp.scallops), step = (x1 - x0) / n, height = dp.height;
  ctx.beginPath();
  ctx.moveTo(x0, dorsalLineY(rig, x0) + 2);
  for (let i = 0; i < n; i++) {
    const ax = x0 + step * i, bx = ax + step;
    const ay = dorsalLineY(rig, ax) + 0.5, by = dorsalLineY(rig, bx) + 0.5;
    ctx.lineTo(ax, ay);
    // a round scallop: the quadratic's midpoint stands `height` px proud of the line
    ctx.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 - height * 2, bx, by);
  }
  ctx.lineTo(x1, dorsalLineY(rig, x1) + 3);
  ctx.lineTo(x0, dorsalLineY(rig, x0) + 2);
  ctx.closePath();
  flat(ctx, rig, pal.membrane);
}

// ---------- emitters: flat, never banded (D20) ----------

/**
 * Stroke the current path in ink (when it is part of the silhouette) and fill it flat in `hex`: flame outer
 * shapes, crystals, bolts, sparks. The only light mark an emitter may carry is its listed core or facet.
 */
export function emitterFill(ctx: CanvasRenderingContext2D, rig: DragonRig, hex: string, inked = true): void {
  if (inked) outlinePath(ctx, rig);
  ctx.fillStyle = rig.col(hex); ctx.fill();
}

/** A flat un-inked core (flame core, crystal facet): fill the current path. */
export function emitterCore(ctx: CanvasRenderingContext2D, rig: DragonRig, hex: string): void {
  if (rig.override) return;
  ctx.fillStyle = hex; ctx.fill();
}

/** Trace a polygon from a flat [x0, y0, ...] list scaled by k about (0, 0) and offset by (ox, oy). */
export function pathPts(ctx: CanvasRenderingContext2D, pts: ArrayLike<number>, k = 1, ox = 0, oy = 0, n = pts.length): void {
  ctx.beginPath();
  ctx.moveTo(pts[0] * k + ox, pts[1] * k + oy);
  for (let i = 2; i < n; i += 2) ctx.lineTo(pts[i] * k + ox, pts[i + 1] * k + oy);
  ctx.closePath();
}

// ---------- effect discs (breath streams, dust, bubbles) ----------

/** A flat disc, no ink (a puff's layers, dust): through rig.col, so a flash or silhouette pass honours it. */
export function disc(ctx: CanvasRenderingContext2D, rig: DragonRig, x: number, y: number, r: number, hex: string): void {
  ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2);
  ctx.fillStyle = rig.col(hex); ctx.fill();
}

/**
 * A disc with a 1 px ring in a dark slot (5.4: an effect that can reach the floor carries its own dark edge, and
 * fades by shrinking, never by alpha): the ring is the disc drawn 1 px larger underneath.
 */
export function ringDisc(ctx: CanvasRenderingContext2D, rig: DragonRig, x: number, y: number, r: number, fill: string, ring: string): void {
  disc(ctx, rig, x, y, r + 1, ring);
  disc(ctx, rig, x, y, r, fill);
}

/**
 * From an element renderer's MOUTH space (the breath anchor) back to ROOT space, for particles that leave the
 * mouth and should not ride the head (pebbles, quills, dropped nubs). Wrap it in save / restore.
 */
export function mouthToRoot(ctx: CanvasRenderingContext2D, rig: DragonRig, angDeg: number): void {
  ctx.rotate(-rad(angDeg)); ctx.translate(-rig.j.mouth.x, -rig.j.mouth.y);
}
