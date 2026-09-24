// Default dragon part renderers (docs/ART_BIBLE.md 1.2), drawn with the engine's cel helpers.
//
// Every function draws in a documented local space that rig.ts has already entered (and pointed rig.light at), and
// allocates nothing: scratch arrays live at module scope. Each part is ONE outlined silhouette, stroked once and
// filled once (the drawLimbSegs lesson); any colour change inside a part is a clipped fill with no line (D13).
import { rad } from '../../lib/engine/math.ts';
import { celPath, flat, outlinePath, tones, wantSh, pathCap, pathRR } from '../../lib/art/shading.ts';
import type { ShadeTarget } from '../../lib/art/shading.ts';
import { drawLimbSegs } from '../../lib/art/rigParts.ts';
import type { Point } from '../../lib/art/rigParts.ts';
import { pathTaperedCapsule } from '../../lib/art/shapes.ts';
import type { DragonPalette } from './palettes.ts';
import type { DragonRig } from './rig.ts';
import type { WingParams } from './element.ts';
import { WING_ANGLES } from './stages.ts';

const R = Math.round;

// ---------- band helpers ----------

/**
 * The shadow half-plane celPath paints, for a SUB-REGION of a part: the same geometry (a band perpendicular to the
 * light, covering `sh` of the diameter from the far edge), so a pigment region inside a part (the belly band) gets
 * its shadow exactly where the part's own band runs and the band switches colour at the pigment edge instead of
 * restarting. Call with the region already clipped. Mirrors shading.ts celPath: keep the two in step.
 */
export function shadeBand(ctx: CanvasRenderingContext2D, rig: ShadeTarget, cx: number, cy: number, ext: number, sh: number, color: string): void {
  if (rig.override || !rig.shading || !wantSh(rig, ext)) return;
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(Math.atan2(rig.light.y, rig.light.x));
  const E = ext + 3;
  ctx.fillStyle = color; ctx.fillRect(-E, -E, E - ext + ext * 2 * sh, E * 2);
  ctx.restore();
}

// ---------- tubes: drawLimbSegs generalised to n nodes ----------

/** Append an n-node tube (tapered capsules node to node) to the current path. */
export function pathTube(ctx: CanvasRenderingContext2D, xs: ArrayLike<number>, ys: ArrayLike<number>, rs: ArrayLike<number>, n: number, from = 0): void {
  for (let i = from; i < n - 1; i++) pathTaperedCapsule(ctx, xs[i], ys[i], xs[i + 1], ys[i + 1], rs[i], rs[i + 1], true);
}

const OX = new Float32Array(16), OY = new Float32Array(16), OR = new Float32Array(16);

/**
 * The same tube offset toward a side and shrunk: node i moves `(1 - k) * r` along (nx, ny) and takes radius k * r.
 * Inside the original tube it covers the fraction k of the diameter on that side -- the drawLimbSegs shadow trick,
 * used for the shadow band (toward -light, k 0.6) and for the belly / throat stripe (toward the underside, k 0.4).
 */
function pathOffsetTube(ctx: CanvasRenderingContext2D, xs: ArrayLike<number>, ys: ArrayLike<number>, rs: ArrayLike<number>, n: number,
  nx: ArrayLike<number> | number, ny: ArrayLike<number> | number, k: number, upto = n): void {
  const m = Math.min(n, upto, 16);
  for (let i = 0; i < m; i++) {
    const ux = typeof nx === 'number' ? nx : nx[i], uy = typeof ny === 'number' ? ny : ny[i];
    const o = rs[i] * (1 - k);
    OX[i] = xs[i] + ux * o; OY[i] = ys[i] + uy * o; OR[i] = rs[i] * k;
  }
  pathTube(ctx, OX, OY, OR, m);
}

/**
 * An n-node tube (tail, neck) as ONE silhouette: stroke once, fill once, then clipped inside it an optional
 * underside stripe (belly colour on the first `stripeUpto` nodes, toward the per-node underside normals) and ONE
 * shadow band gated by the root radius, exactly as drawLimbSegs gates a limb. Root space (or any unrotated space:
 * the shadow offset reads rig.light).
 */
export function drawTube(ctx: CanvasRenderingContext2D, rig: DragonRig, xs: ArrayLike<number>, ys: ArrayLike<number>, rs: ArrayLike<number>, n: number,
  hex: string, stripeHex: string | null, vx: ArrayLike<number> | null, vy: ArrayLike<number> | null, stripeUpto: number, stripeK = 0.4,
  bulge: Readonly<Bulge> | null = null): void {
  ctx.beginPath(); pathTube(ctx, xs, ys, rs, n); pathBulge(ctx, bulge);
  outlinePath(ctx, rig);
  ctx.fillStyle = rig.col(tones(rig, hex).base); ctx.fill();
  if (bulge && bulge.r > 0) {
    // the bulge is the same silhouette (one stroke above), painted in its own skin: a colour change, no line
    ctx.beginPath(); pathBulge(ctx, bulge);
    ctx.fillStyle = rig.col(bulge.hex); ctx.fill();
  }
  if (rig.override || !rig.shading) return;
  ctx.save();
  ctx.beginPath(); pathTube(ctx, xs, ys, rs, n); ctx.clip();
  const shadow = wantSh(rig, rs[0]);
  if (stripeHex && vx && vy && stripeUpto > 1) {
    ctx.beginPath(); pathOffsetTube(ctx, xs, ys, rs, n, vx, vy, stripeK, stripeUpto);
    ctx.fillStyle = tones(rig, stripeHex).base; ctx.fill();
  }
  if (shadow) {
    ctx.beginPath(); pathOffsetTube(ctx, xs, ys, rs, n, -rig.light.x, -rig.light.y, 0.6);
    ctx.fillStyle = tones(rig, hex).sh; ctx.fill();
    if (stripeHex && vx && vy && stripeUpto > 1) {
      // the band switches to belly.sh where it crosses the stripe (bible 1.2 body note), never restarts
      ctx.save();
      ctx.beginPath(); pathOffsetTube(ctx, xs, ys, rs, n, vx, vy, stripeK, stripeUpto); ctx.clip();
      ctx.beginPath(); pathOffsetTube(ctx, xs, ys, rs, n, -rig.light.x, -rig.light.y, 0.6);
      ctx.fillStyle = tones(rig, stripeHex).sh; ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
}

/** An extra circle in a tube's contour (the throat sac): centre, radius and the skin it is painted in. */
export interface Bulge { x: number; y: number; r: number; hex: string }
function pathBulge(ctx: CanvasRenderingContext2D, b: Readonly<Bulge> | null): void {
  if (!b || b.r <= 0) return;
  ctx.moveTo(b.x + b.r, b.y); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
}

// ---------- body ----------

/**
 * Body space path: hip ball + chest ball as one tapered capsule, plus the baby belly-sag ellipse (same path).
 */
export function pathBody(ctx: CanvasRenderingContext2D, rig: DragonRig): void {
  const d = rig.dims, h = rig.hipB, c = rig.chestB;
  ctx.beginPath();
  pathTaperedCapsule(ctx, h.x, h.y, c.x, c.y, d.hipR, d.chestR, true);
  if (d.sag) { ctx.moveTo(d.sag.rx, d.sag.cy); ctx.ellipse(0, d.sag.cy, d.sag.rx, d.sag.ry, 0, 0, Math.PI * 2); }
}

/**
 * Body space: the belly region, a half-plane below the belly line that rises at the chest front into a bib up to
 * the neck root, so the throat stripe runs on into it (the stripe is continuous chin -> throat -> belly: 2.7).
 */
export function pathBelly(ctx: CanvasRenderingContext2D, rig: DragonRig): void {
  const c = rig.chestB, d = rig.dims, by = rig.bellyY, big = 200;
  const ny = d.neck.root[1] + d.neck.r0 * 0.9;
  ctx.beginPath();
  ctx.moveTo(-big, by); ctx.lineTo(c.x + d.chestR * 0.15, by);
  ctx.lineTo(c.x + d.chestR * 0.72, ny); ctx.lineTo(big, ny - 2);
  ctx.lineTo(big, big); ctx.lineTo(-big, big); ctx.closePath();
}

/** Body space: the body with its belly band (one shadow band that turns belly.sh inside the belly). */
export function drawBody(ctx: CanvasRenderingContext2D, rig: DragonRig, pal: Readonly<DragonPalette>): void {
  const d = rig.dims, cx = (rig.hipB.x - d.hipR + rig.chestB.x + d.chestR) / 2, cy = 0, ext = d.bodyLen / 2;
  pathBody(ctx, rig);
  celPath(ctx, rig, pal.scale, cx, cy, ext, BODY_SH, BODY_HI);
  if (rig.override || !rig.shading) return;
  ctx.save();
  pathBody(ctx, rig); ctx.clip();
  pathBelly(ctx, rig); ctx.clip();
  pathBody(ctx, rig);
  ctx.fillStyle = tones(rig, pal.belly).base; ctx.fill();
  shadeBand(ctx, rig, cx, cy, ext, BODY_SH, tones(rig, pal.belly).sh);
  ctx.restore();
}
/** Body band coverage: shadow 0.36 of the diameter, highlight 0.3 of the radius (engine defaults). */
export const BODY_SH = 0.36, BODY_HI = 0.3;

// ---------- legs and paws ----------

/** Scratch for the raised ankle node. */
const ANK: Point = { x: 0, y: 0 };

/**
 * Root space: one leg through the engine's drawLimbSegs (one silhouette, root sunk 0.35 r into the body), then the
 * paw. The tube's end node is raised so its round cap never dips below the paw's sole (the ankle sits pawH above
 * the ground, and an adult ankle radius is ~0.9 px bigger than its paw is tall).
 */
export function drawLeg(ctx: CanvasRenderingContext2D, rig: DragonRig, root: Point, knee: Point, ankle: Point, r1: number, r2: number, bulge: number,
  pawW: number, pawH: number, pawAng: number, hex: string, claws: boolean): void {
  const rC = (r1 + r2) / 2 * (1 - 0.2 * bulge);
  const lift = Math.max(0, rC - pawH);
  ANK.x = ankle.x; ANK.y = ankle.y - lift;
  const s = SUNK, dx = knee.x - root.x, dy = knee.y - root.y, L = Math.hypot(dx, dy) || 1, k = r1 * 0.35;
  s.x = root.x + dx / L * k; s.y = root.y + dy / L * k;
  drawLimbSegs(ctx, rig, s, knee, ANK, r1, r2, hex, hex, false, bulge);
  drawPaw(ctx, rig, ankle.x, ankle.y, rC, pawW, pawH, pawAng, hex, claws);
}
const SUNK: Point = { x: 0, y: 0 };

/**
 * A paw: celRect r 2 (ext < 5 at every stage, so one flat tone), its top at the ankle and its sole pawH below,
 * reaching back to the leg's back edge and forward to the toe. Near paws of young and adults carry 2 claws in
 * `horn`, drawn UN-INKED (D13, D16) inside the toe with their tips on the sole's ink line and a 2 px gap.
 */
export function drawPaw(ctx: CanvasRenderingContext2D, rig: DragonRig, ax: number, ay: number, rC: number, w: number, h: number, ang: number, hex: string, claws: boolean): void {
  const sc = rig.pxScale;
  // the heel is the leg's own round end; the paw starts under the middle of it and reaches forward to the toe
  const x0 = Math.round((ax - rC * 0.5) * sc) / sc, y0 = Math.round(ay * sc) / sc;
  ctx.save();
  ctx.translate(x0, y0);
  if (ang) ctx.rotate(rad(ang));
  pathRR(ctx, 0, 0, w, h, 2);
  flat(ctx, rig, hex);
  const cw = rig.dims.claws;
  if (claws && cw && !rig.override) {
    ctx.fillStyle = rig.pal.horn;
    ctx.fillRect(w - cw.w - 1, h - cw.h, cw.w, cw.h);
    ctx.fillRect(w - cw.w * 2 - 3, h - cw.h, cw.w, cw.h);
  }
  ctx.restore();
}

// ---------- wings ----------

/** Scratch polygon for membranes (x, y pairs). */
const MEM = new Float32Array(64);
const SPX = new Float32Array(6), SPY = new Float32Array(6);

/**
 * Wing space: a bat / leaf / fin wing as ONE silhouette (arm capsules + membrane polygon, unioned, stroked once),
 * the membrane matte (2 tones: hi 0) with the arm and spars painted over it in `scale` with no ink (1.2).
 * `fold` 0 = folded along the back, 1 = spread (2.2 angles lerped). `span` scales every bone; `drop` lowers the
 * folded wing (foldRise < 3).
 */
export function drawBatWing(ctx: CanvasRenderingContext2D, rig: DragonRig, wp: Readonly<WingParams>, fold: number, pal: Readonly<DragonPalette>): void {
  const wd = rig.dims.wing;
  if (!wd) return;
  const A = WING_ANGLES[rig.stage === 'adult' ? 'adult' : 'young'];
  const spars = wp.plus ? wd.sparsPlus : wd.spars, ang = wp.plus ? A.sparsPlus : A.spars;
  const f = Math.max(0, Math.min(1, fold)), span = wp.span;
  const drop = (3 - wp.foldRise) * (1 - f);
  const eh = angAt(A.humerus, f), ef = angAt(A.forearm, f);
  const ex = Math.cos(eh) * wd.humerus * span, ey = -Math.sin(eh) * wd.humerus * span + drop;
  const wx = ex + Math.cos(ef) * wd.forearm * span, wy = ey - Math.sin(ef) * wd.forearm * span;
  const n = spars.length;
  for (let i = 0; i < n; i++) {
    const a = angAt(ang[i], f), L = spars[i] * span;
    SPX[i] = wx + Math.cos(a) * L; SPY[i] = wy - Math.sin(a) * L;
  }
  const ax = wd.attach[0] * span, ay = wd.attach[1] + drop * 0.5;
  // membrane: root -> elbow -> wrist -> lead tip -> (edge) -> ... -> trail tip -> (edge) -> attach
  const thorn = wp.thorn * (rig.stage === 'adult' ? 1 : 0);
  let m = 0;
  MEM[m++] = 0; MEM[m++] = drop * 0.5;
  MEM[m++] = ex; MEM[m++] = ey;
  MEM[m++] = wx; MEM[m++] = wy;
  const depth = wp.scallop * (wp.scallop > 0 ? f : Math.max(0.35, f));
  ctx.beginPath();
  ctx.moveTo(MEM[0], MEM[1]); ctx.lineTo(MEM[2], MEM[3]); ctx.lineTo(MEM[4], MEM[5]);
  for (let i = 0; i < n; i++) {
    // pull each tip back along its spar by the thorn length: the spar pokes past the membrane
    const a = angAt(ang[i], f);
    const tx = SPX[i] - Math.cos(a) * thorn, ty = SPY[i] + Math.sin(a) * thorn;
    if (i === 0) ctx.lineTo(tx, ty);
    const an = i + 1 < n ? angAt(ang[i + 1], f) : 0;
    const nx = i + 1 < n ? SPX[i + 1] - Math.cos(an) * thorn : ax;
    const ny = i + 1 < n ? SPY[i + 1] + Math.sin(an) * thorn : ay;
    edgeTo(ctx, tx, ty, nx, ny, wx, wy, depth);
  }
  ctx.lineTo(MEM[0], MEM[1]);
  ctx.closePath();
  // the arm and spars join the silhouette: appended capsules, one stroke over the union
  const ar = wd.armR, sr = wd.sparR;
  pathCapA(ctx, 0, drop * 0.5, ex, ey, ar); pathCapA(ctx, ex, ey, wx, wy, ar);
  for (let i = 0; i < n; i++) pathCapA(ctx, wx, wy, SPX[i], SPY[i], sr * (i === 0 ? 1 : 0.8));
  if (wp.wristThorn && rig.stage === 'adult') pathThorn(ctx, wx, wy, eh, wp.wristThorn);
  // membrane: matte, 2 tones (hi 0)
  let minx = 0, maxx = 0, miny = 0, maxy = 0;
  for (let i = 0; i < n; i++) { minx = Math.min(minx, SPX[i]); maxx = Math.max(maxx, SPX[i]); miny = Math.min(miny, SPY[i]); maxy = Math.max(maxy, SPY[i]); }
  minx = Math.min(minx, ax, wx); maxx = Math.max(maxx, wx, ex); miny = Math.min(miny, wy, ey); maxy = Math.max(maxy, ay);
  celPath(ctx, rig, pal.membrane, (minx + maxx) / 2, (miny + maxy) / 2, Math.hypot(maxx - minx, maxy - miny) / 2, 0.4, 0);
  // bones over the membrane, in scale, no ink of their own. Folded, the humerus and the inner fingers lie inside
  // the folded membrane: only the leading edge (forearm + lead spar) shows, so the membrane reads under it.
  ctx.fillStyle = rig.col(pal.scale);
  ctx.beginPath();
  const open = f >= 0.3;
  if (open) pathCapA(ctx, 0, drop * 0.5, ex, ey, ar);
  pathCapA(ctx, ex, ey, wx, wy, ar);
  for (let i = 0; i < (open ? n : 1); i++) pathCapA(ctx, wx, wy, SPX[i], SPY[i], sr * (i === 0 ? 1 : 0.8));
  if (wp.wristThorn && rig.stage === 'adult') pathThorn(ctx, wx, wy, eh, wp.wristThorn);
  ctx.fill();
}

/** A [folded, spread] bone angle at fold f, in radians. */
function angAt(p: readonly [number, number], f: number): number { return rad(p[0] + (p[1] - p[0]) * f); }

/** Trailing edge from one tip to the next: a concave scallop (depth > 0, pulled toward the wrist) or a convex bulge (< 0). */
function edgeTo(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, wx: number, wy: number, depth: number): void {
  if (Math.abs(depth) < 0.3) { ctx.lineTo(x1, y1); return; }
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  let dx = wx - mx, dy = wy - my;
  const L = Math.hypot(dx, dy) || 1;
  dx /= L; dy /= L;
  // quadratic control at 2x the depth puts the curve's midpoint `depth` px in (or out)
  ctx.quadraticCurveTo(mx + dx * depth * 2, my + dy * depth * 2, x1, y1);
}

/** Append a round-capped capsule to the current path (no beginPath). */
function pathCapA(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, r: number): void {
  const dx = x1 - x0, dy = y1 - y0, a = Math.atan2(dy, dx);
  ctx.moveTo(x0 + Math.cos(a + Math.PI / 2) * r, y0 + Math.sin(a + Math.PI / 2) * r);
  ctx.arc(x0, y0, r, a + Math.PI / 2, a - Math.PI / 2);
  ctx.arc(x1, y1, r, a - Math.PI / 2, a + Math.PI / 2);
  ctx.closePath();
}

/** A small thorn wedge at the wrist, pointing forward-up along the humerus line reversed. */
function pathThorn(ctx: CanvasRenderingContext2D, wx: number, wy: number, humerusAng: number, len: number): void {
  const a = humerusAng + Math.PI; // continue past the wrist, away from the elbow side
  const ux = Math.cos(a), uy = -Math.sin(a);
  ctx.moveTo(wx - uy * 1.5, wy + ux * 1.5);
  ctx.lineTo(wx - ux * len * -1, wy - uy * len * -1);
  ctx.lineTo(wx + uy * 1.5, wy - ux * 1.5);
  ctx.closePath();
}

/**
 * Wing space: the baby's nub (1.3): no bones, one 7 x 5 polygon, membrane with a `scale` top edge, at elevation
 * `angDeg` (rest 170 = 10 deg above the back pointing back; 140 in flutter and happy).
 */
export function drawNub(ctx: CanvasRenderingContext2D, rig: DragonRig, angDeg: number, pal: Readonly<DragonPalette>): void {
  const nb = rig.dims.nub;
  if (!nb) return;
  const a = rad(angDeg), ux = Math.cos(a), uy = -Math.sin(a), px = -uy, py = ux; // (px, py) = the leading (top) side normal
  // leading edge straight along the direction, trailing edge a round belly back to the root: a little leaf
  pathNub(ctx, ux, uy, px, py, nb.w, nb.h);
  outlinePath(ctx, rig);
  ctx.fillStyle = rig.col(pal.membrane); ctx.fill();
  if (rig.override) return;
  // the scale top edge: a 2 px band along the leading edge, clipped inside
  const lx = px * (nb.h * 0.35), ly = py * (nb.h * 0.35);
  ctx.save();
  pathNub(ctx, ux, uy, px, py, nb.w, nb.h); ctx.clip();
  ctx.beginPath(); pathCap(ctx, -ux * 2 + lx, -uy * 2 + ly, ux * nb.w + lx * 0.3, uy * nb.w + ly * 0.3, 1.6);
  ctx.fillStyle = pal.scale; ctx.fill();
  ctx.restore();
}

/** The nub outline: direction (ux, uy), leading-side normal (px, py), length L, height H. */
function pathNub(ctx: CanvasRenderingContext2D, ux: number, uy: number, px: number, py: number, L: number, H: number): void {
  const lx = px * (H * 0.35), ly = py * (H * 0.35);
  ctx.beginPath();
  ctx.moveTo(-ux * 1.5 + lx, -uy * 1.5 + ly);
  ctx.lineTo(ux * L + lx * 0.3, uy * L + ly * 0.3);
  ctx.quadraticCurveTo(ux * L * 0.55 - px * H * 1.1, uy * L * 0.55 - py * H * 1.1, -ux * 1.5 - px * H * 0.45, -uy * 1.5 - py * H * 0.45);
  ctx.closePath();
}

// ---------- ground shadow ----------

/** Ground space (root x, y = 0): the flat shadow ellipse, `#1a1018` at alpha 0.28, shrinking as the root lifts. */
export function drawGroundShadow(ctx: CanvasRenderingContext2D, rig: DragonRig, lift: number): void {
  const d = rig.dims, k = Math.max(0.5, 1 - Math.max(0, lift) / 40);
  const w = (d.bodyLen + d.shadow.extra) * k, h = d.shadow.h * k;
  const cx = (rig.hipB.x - d.hipR + rig.chestB.x + d.chestR) / 2;
  ctx.fillStyle = rig.silhouette ? 'rgba(0,0,0,0)' : 'rgba(26,16,24,0.28)';
  ctx.beginPath(); ctx.ellipse(R(cx), 0, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.fill();
}

// ---------- neck ----------

/**
 * Root space: the neck as one n-node tube with the throat stripe (belly, lower 40 %) on its underside, which the
 * body's chest bib and the jaw's belly half continue (chin -> throat -> belly: 2.7). A gulp bulge (pose.gulp 1..3,
 * head -> chest) is an extra node grown 2 px appended to the SAME path, so it changes the silhouette (1.2).
 */
export function drawNeck(ctx: CanvasRenderingContext2D, rig: DragonRig, pal: Readonly<DragonPalette>, gulp: number, sac: number): void {
  const J = rig.j, n = J.neckN + 1;
  let rs: Float32Array = J.neckR;
  if (gulp >= 1 && gulp <= 3 && n > 1) {
    // one node grows 2 px; the bulge travels head (1) -> chest (3) on stepped keys
    for (let i = 0; i < n; i++) GR[i] = rs[i];
    const i = Math.max(0, Math.min(n - 1, Math.round((n - 1) * (1 - (gulp - 1) / 2))));
    GR[i] += 2;
    rs = GR;
  }
  let bulge: Bulge | null = null;
  if (sac > 0.5) {
    // the throat sac: a membrane bulge in the neck's lower contour just behind the jaw, `sac` px proud (3.7)
    const k = n - 1, r = rs[k];
    SAC.r = r * 0.55 + sac * 0.5;
    SAC.x = J.neckX[k] + J.neckVX[k] * (r + sac - SAC.r) - (J.neckX[k] - J.neckX[k - 1 < 0 ? 0 : k - 1]) * 0.25;
    SAC.y = J.neckY[k] + J.neckVY[k] * (r + sac - SAC.r) - (J.neckY[k] - J.neckY[k - 1 < 0 ? 0 : k - 1]) * 0.25;
    SAC.hex = pal.membrane;
    bulge = SAC;
  }
  drawTube(ctx, rig, J.neckX, J.neckY, rs, n, pal.scale, pal.belly, J.neckVX, J.neckVY, n, 0.4, bulge);
}
const SAC: Bulge = { x: 0, y: 0, r: 0, hex: '' };
const GR = new Float32Array(8);

// ---------- skull and jaw (cranium space) ----------

/**
 * Cranium space: the skull as ONE path (drawSkull's approach): cranium circle + snout taper + brow-ridge bump +
 * the element's optional bumps (rock's nose-horn root, shriekscale's nose-leaf). Bumps live in the contour, never
 * as new outlined objects.
 */
export function pathSkull(ctx: CanvasRenderingContext2D, rig: DragonRig): void {
  const h = rig.dims.head, s = h.snout, r = h.cranR;
  ctx.beginPath();
  ctx.moveTo(r, 0); ctx.arc(0, 0, r, 0, Math.PI * 2);
  pathTaperedCapsule(ctx, s.x0, s.y0, s.x1, s.y1, s.r0, s.r1, true);
  if (h.brow > 0) {
    // a bump over the eye's front-top, standing `brow` px proud of the cranium contour
    const a = rad(58), br = 3, d = r + h.brow - br;
    const bx = Math.cos(a) * d, by = -Math.sin(a) * d;
    ctx.moveTo(bx + br, by); ctx.arc(bx, by, br, 0, Math.PI * 2);
  }
  const bumps = rig.sp.skullBumps;
  if (bumps) for (let i = 0; i < bumps.length; i++) { const b = bumps[i]; ctx.moveTo(b.x + b.r, b.y); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); }
}

/** Cranium-space centre and extent of the whole head (cranium + snout), for the skull's cel bands. */
export function skullBands(rig: DragonRig): { cx: number; ext: number } {
  const h = rig.dims.head, tip = h.snout.x1 + h.snout.r1;
  SB.cx = (tip - h.cranR) / 2; SB.ext = (tip + h.cranR) / 2;
  return SB;
}
const SB = { cx: 0, ext: 0 };

/** Cranium space: the skull, cel-shaded as one part (ext = half the head length: babies 2 tones, others 3). */
export function drawSkull(ctx: CanvasRenderingContext2D, rig: DragonRig, pal: Readonly<DragonPalette>): void {
  const b = skullBands(rig);
  pathSkull(ctx, rig);
  celPath(ctx, rig, pal.scale, b.cx, 0, b.ext, 0.34, 0.3);
}

/**
 * Cranium space: the hinged jaw, drawn UNDER the skull (1.2): a celTaper hinge -> tip rotated `jawDeg` open, upper
 * half `scale`, lower half `belly` so the chin continues the throat stripe.
 */
export function drawJaw(ctx: CanvasRenderingContext2D, rig: DragonRig, jawDeg: number, pal: Readonly<DragonPalette>): void {
  const j = rig.dims.head.jaw;
  ctx.save();
  ctx.translate(j.hx, j.hy);
  if (jawDeg) ctx.rotate(rad(jawDeg));
  const tx = j.tx - j.hx, ty = j.ty - j.hy;
  pathTaperedCapsule(ctx, 0, 0, tx, ty, j.r0, j.r1);
  outlinePath(ctx, rig);
  ctx.fillStyle = rig.col(pal.scale); ctx.fill();
  if (!rig.override) {
    ctx.save(); ctx.clip();
    const a = Math.atan2(ty, tx);
    ctx.rotate(a);
    ctx.fillStyle = pal.belly; ctx.fillRect(-j.r0 - 2, 0, Math.hypot(tx, ty) + j.r0 + 4, j.r0 + 2);
    ctx.restore();
  }
  ctx.restore();
}

/**
 * Cranium space: the open mouth (drawn FIRST in the head group, 1.4 step 12.1): the wedge between the skull's
 * underside and the open jaw in mouth `#5a2030`, with a 2 x 2 tongue. Only called with the jaw at >= the stage
 * minimum, so the wedge is >= 2.5 px and shows (1.2).
 */
export function drawMouthInterior(ctx: CanvasRenderingContext2D, rig: DragonRig, jawDeg: number, mouth: string, tongue: string): void {
  const h = rig.dims.head, j = h.jaw, s = h.snout;
  const a = rad(jawDeg), tx = j.tx - j.hx, ty = j.ty - j.hy;
  const jx = j.hx + tx * Math.cos(a) - ty * Math.sin(a), jy = j.hy + tx * Math.sin(a) + ty * Math.cos(a);
  const ux = s.x1 - 1, uy = s.y1 + s.r1 * 0.6;
  ctx.beginPath();
  ctx.moveTo(j.hx - 1, j.hy - j.r0 * 0.5);
  ctx.lineTo(ux, uy);
  ctx.lineTo(jx, jy);
  ctx.closePath();
  ctx.fillStyle = rig.col(mouth); ctx.fill();
  if (rig.override) return;
  // tongue: 2 x 2 on the jaw, a third of the way in
  const tl = 0.45;
  const qx = j.hx + (tx * Math.cos(a) - ty * Math.sin(a)) * tl, qy = j.hy + (tx * Math.sin(a) + ty * Math.cos(a)) * tl - j.r0 * 0.9;
  ctx.fillStyle = tongue; ctx.fillRect(Math.round(qx), Math.round(qy), 2, 2);
}
