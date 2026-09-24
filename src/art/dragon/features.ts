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
 * One horn in cranium space (origin at the cranium centre, +x toward the snout). Root on the cranium circle at
 * `hp.at` degrees, sunk `hp.sink` px; runs back and down `hp.sweep` deg below straight back (the neck line), then
 * bends `hp.bend` up at the midpoint -- or kinks at `hp.kinkAt` (lightning). `tilt` rotates the whole horn (the far
 * horn is angled -8 deg: 1.5) and (dx, dy) offsets its root (far: 3 px back, 1 px up). One inked silhouette in
 * `horn`; at r <= 1.5 the gates make it one flat tone.
 */
export function drawHorn(ctx: CanvasRenderingContext2D, rig: DragonRig, hp: Readonly<HornParams>, cranR: number, pal: Readonly<DragonPalette>, tilt = 0, dx = 0, dy = 0): void {
  const a = rad(hp.at), rr = cranR - hp.sink;
  HX[0] = Math.cos(a) * rr + dx; HY[0] = -Math.sin(a) * rr + dy;
  const split = hp.kinkAt > 0 ? hp.kinkAt : 0.5;
  const d0 = rad(hp.sweep - tilt), d1 = rad(hp.sweep - tilt - hp.bend);
  const l0 = hp.len * split, l1 = hp.len * (1 - split);
  HX[1] = HX[0] - Math.cos(d0) * l0; HY[1] = HY[0] + Math.sin(d0) * l0;
  HX[2] = HX[1] - Math.cos(d1) * l1; HY[2] = HY[1] + Math.sin(d1) * l1;
  HR[0] = hp.r0; HR[2] = hp.r1; HR[1] = hp.r0 + (hp.r1 - hp.r0) * split;
  ctx.beginPath(); pathTube(ctx, HX, HY, HR, 3);
  flat(ctx, rig, pal.horn);
}

/** Where a horn's tip lands (cranium space), for clearance checks and spark crawlers. Writes into `out`. */
export function hornTip(hp: Readonly<HornParams>, cranR: number, out: { x: number; y: number }): { x: number; y: number } {
  const a = rad(hp.at), rr = cranR - hp.sink, split = hp.kinkAt > 0 ? hp.kinkAt : 0.5;
  const d0 = rad(hp.sweep), d1 = rad(hp.sweep - hp.bend);
  out.x = Math.cos(a) * rr - Math.cos(d0) * hp.len * split - Math.cos(d1) * hp.len * (1 - split);
  out.y = -Math.sin(a) * rr + Math.sin(d0) * hp.len * split + Math.sin(d1) * hp.len * (1 - split);
  return out;
}

// ---------- markings: clipped pigment, never inked ----------

/**
 * Is pixel (x, y) of a w x h marking inked? The marking bitmaps, in whole pixels, so a 4-9 px mark stays crisp at
 * scale 1 (an anti-aliased polygon this small dissolves into a smudge). Bands are 3 px thick (5.2):
 *   chevron: an upward "^" 3 px thick measured down each column (fire's flame-licks, shriekscale's volume bars);
 *   zstripe: a lightning Z, 3 px wide: a diagonal from the top-right that steps back 2 px at mid-height;
 *   spot   : the whole box (pearl spots, 3 x 3);
 *   ring   : the whole box (a tail ring is drawn across the tube instead: drawTailRing).
 */
export function markingPixel(kind: MarkingSpec['kind'], w: number, h: number, x: number, y: number): boolean {
  switch (kind) {
    case 'chevron': {
      const half = w / 2, dx = Math.abs(x + 0.5 - half), edge = Math.round(dx * h / half - 1);
      return y >= edge && y < edge + 3;
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
      const on = x < w && markingPixel(mk.kind, w, h, x, y);
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
 * tail nodes), whichever is higher.
 */
export function dorsalLineY(rig: DragonRig, x: number): number {
  const J = rig.j, tn = J.tailN, d = rig.dims;
  let y = x > rig.hipB.x - d.hipR ? backLineY(rig, x) : 1e9;
  for (let k = 0; k < tn; k++) {
    const ax = J.tailBX[k], bx = J.tailBX[k + 1];
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
