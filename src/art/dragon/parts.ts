// Default dragon part renderers (docs/ART_BIBLE.md 1.2), drawn with the engine's cel helpers.
//
// Every function draws in a documented local space that rig.ts has already entered (and pointed rig.light at), and
// allocates nothing: scratch arrays live at module scope. Each part is ONE outlined silhouette, stroked once and
// filled once (the drawLimbSegs lesson); any colour change inside a part is a clipped fill with no line (D13).
import { rad } from '../../lib/engine/math.ts';
import { celPath, outlinePath, tones, wantSh, pathCap, flat } from '../../lib/art/shading.ts';
import type { ShadeTarget } from '../../lib/art/shading.ts';
import type { Point } from '../../lib/art/rigParts.ts';
import { pathTaperedCapsule } from '../../lib/art/shapes.ts';
import type { DragonPalette } from './palettes.ts';
import type { DragonRig } from './rig.ts';
import type { WingParams, WingTear } from './element.ts';
import { WING_ANGLES, grown } from './stages.ts';

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
 * shadow band (`shK` of the diameter) gated by the root radius, exactly as drawLimbSegs gates a limb. Root space (or any unrotated space:
 * the shadow offset reads rig.light).
 */
export function drawTube(ctx: CanvasRenderingContext2D, rig: DragonRig, xs: ArrayLike<number>, ys: ArrayLike<number>, rs: ArrayLike<number>, n: number,
  hex: string, stripeHex: string | null, vx: ArrayLike<number> | null, vy: ArrayLike<number> | null, stripeUpto: number, stripeK = 0.4,
  bulge: Readonly<Bulge> | null = null, shK = 0.6): void {
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
    ctx.beginPath(); pathOffsetTube(ctx, xs, ys, rs, n, -rig.light.x, -rig.light.y, shK);
    ctx.fillStyle = tones(rig, hex).sh; ctx.fill();
    if (stripeHex && vx && vy && stripeUpto > 1) {
      // the band switches to belly.sh where it crosses the stripe (bible 1.2 body note), never restarts
      ctx.save();
      ctx.beginPath(); pathOffsetTube(ctx, xs, ys, rs, n, vx, vy, stripeK, stripeUpto); ctx.clip();
      ctx.beginPath(); pathOffsetTube(ctx, xs, ys, rs, n, -rig.light.x, -rig.light.y, shK);
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
 * Body space path: hip ball + chest ball as one tapered capsule, plus the belly-sag ellipse (same path): the baby's
 * pot belly, the elder's paunch at this frame's radius (rig.sagRy: flattened on the floor and asleep, rig.ts).
 */
export function pathBody(ctx: CanvasRenderingContext2D, rig: DragonRig): void {
  const d = rig.dims, h = rig.hipB, c = rig.chestB;
  ctx.beginPath();
  pathTaperedCapsule(ctx, h.x, h.y, c.x, c.y, d.hipR, d.chestR, true);
  if (d.sag) { ctx.moveTo(d.sag.rx, d.sag.cy); ctx.ellipse(0, d.sag.cy, d.sag.rx, rig.sagRy, 0, 0, Math.PI * 2); }
}

/**
 * Body space: the belly region, a half-plane below the belly line that rises at the chest front into a bib whose top
 * runs along the throat stripe's inner edge at the neck root (the neck's rest direction), so the stripe runs on into
 * it (continuous chin -> throat -> belly: 2.7). A bib that stopped at a fixed height left a 2-4 px wedge of the
 * chest's scale shadow between the stripe and the belly.
 */
export function pathBelly(ctx: CanvasRenderingContext2D, rig: DragonRig, append = false): void {
  const c = rig.chestB, d = rig.dims, N = d.neck, by = rig.bellyY, big = 200;
  const e = rad(N.rest[0]), ux = Math.cos(e), uy = -Math.sin(e), k = (1 - 2 * NECK_STRIPE) * N.r0;
  // the stripe's inner edge at the neck root: the root moved toward the underside normal (sin e, cos e)
  const px = N.root[0] + Math.sin(e) * k, py = N.root[1] + Math.cos(e) * k;
  if (!append) ctx.beginPath();
  ctx.moveTo(-big, by); ctx.lineTo(c.x + d.chestR * 0.15, by);
  ctx.lineTo(px, py); ctx.lineTo(px + ux * 40, py + uy * 40);
  ctx.lineTo(big, py + uy * 40); ctx.lineTo(big, big); ctx.lineTo(-big, big); ctx.closePath();
}
/**
 * The neck's throat stripe (fraction of its diameter, on the underside) and shadow band (fraction, away from the
 * light). The neck's shadow side IS its underside, so the band lies over the stripe: at 0.4 / 0.26 about 1 px of
 * belly colour showed between them; at 0.45 / 0.2 it is 2+ px, with the band turning belly.sh along its edge.
 */
export const NECK_STRIPE = 0.45, NECK_SH = 0.2;

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

/**
 * The leg's radius profile [root, knee, ankle]. The engine's limbRadii averages r1 and r2, so a leg could never
 * taper; here r1 sets the root and r2 the ankle, with the engine's bulge on top. With r1 = r2 it IS limbRadii, and
 * a tapered hind shin (r2 < r1) is what lets the digitigrade Z read instead of a pillar (1.2, 2.1).
 */
export function legRadii(r1: number, r2: number, bulge: number, out: Float32Array): Float32Array {
  out[0] = r1 * (1 + 0.16 * bulge); out[1] = (r1 + r2) / 2 * (1 - 0.10 * bulge); out[2] = r2 * (1 - 0.20 * bulge);
  return out;
}
const LR = new Float32Array(3);
/** Scratch: the sunk root and the raised ankle node. */
const SUNK: Point = { x: 0, y: 0 }, ANK: Point = { x: 0, y: 0 };

/** Append a rounded rect to the current path (pathRR without its beginPath). */
function appendRR(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y); ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr); ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h); ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr); ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

/** The leg tube (sunk root -> knee -> raised ankle) plus the paw box, appended as one path. */
function pathLegPaw(ctx: CanvasRenderingContext2D, knee: Point, px: number, py: number, pawW: number, pawH: number, pawAng: number): void {
  ctx.beginPath();
  pathTaperedCapsule(ctx, SUNK.x, SUNK.y, knee.x, knee.y, LR[0], LR[1], true);
  pathTaperedCapsule(ctx, knee.x, knee.y, ANK.x, ANK.y, LR[1], LR[2], true);
  pathPawBox(ctx, px, py, pawW, pawH, pawAng);
}
/** The paw box: top-left (px, py) at the heel, tilted `pawAng` about the ankle top. The path survives restore. */
function pathPawBox(ctx: CanvasRenderingContext2D, px: number, py: number, w: number, h: number, ang: number): void {
  if (!ang) { appendRR(ctx, px, py, w, h, 2); return; }
  ctx.save(); ctx.translate(px, py); ctx.rotate(rad(ang)); appendRR(ctx, 0, 0, w, h, 2); ctx.restore();
}

/**
 * Root space: one leg AND its paw as ONE silhouette (1.2; the drawLimbSegs lesson): the tube root sunk 0.35 r into
 * the body, the paw box appended to the same path, stroked once and filled once, so no ink crosses the ankle. Then,
 * clipped inside, the limb's one shadow band (gated by the root radius, as drawLimbSegs gates it) with the paw kept
 * flat (ext < 5), and on near paws of young and adults 2 claws in `horn`, UN-INKED (D13, D16), their tips on the
 * sole's ink line with a 2 px gap. The paw reaches back to the leg's back edge (ankle - ankle radius), so the leg's
 * round end never pokes out behind the heel. Engine candidate: drawLimbSegs with an extra appended subpath.
 */
export function drawLeg(ctx: CanvasRenderingContext2D, rig: DragonRig, root: Point, knee: Point, ankle: Point, r1: number, r2: number, bulge: number,
  pawW: number, pawH: number, pawAng: number, hex: string, claws: boolean): void {
  legRadii(r1, r2, bulge, LR);
  const rC = LR[2];
  // the tube's end node rises so its round cap never dips below the sole (the ankle sits pawH above the ground)
  ANK.x = ankle.x; ANK.y = ankle.y - Math.max(0, rC - pawH);
  const dx = knee.x - root.x, dy = knee.y - root.y, L = Math.hypot(dx, dy) || 1, k = r1 * 0.35;
  SUNK.x = root.x + dx / L * k; SUNK.y = root.y + dy / L * k;
  // the paw box on the device grid -- except under a root rotation (a waddle), where root space is turned off the
  // grid and a rounded box lands up to half a pixel through the floor
  // (under a rotation the heel sits back from the ankle along the paw's OWN direction, so the box's sole stays level
  // with the floor: offset along root x, it tilted with the sprite and dipped half a pixel under)
  const sc = rig.pxScale, rot = rig.tf.rot !== 0, pa = rad(pawAng);
  const px = rot ? ankle.x - rC * Math.cos(pa) : Math.round((ankle.x - rC) * sc) / sc, py = rot ? ankle.y - rC * Math.sin(pa) : Math.round(ankle.y * sc) / sc;
  pathLegPaw(ctx, knee, px, py, pawW, pawH, pawAng);
  outlinePath(ctx, rig);
  const t = tones(rig, hex);
  ctx.fillStyle = rig.col(t.base); ctx.fill();
  if (rig.override || !rig.shading) return;
  ctx.save();
  ctx.clip();
  if (wantSh(rig, LR[0])) {
    // ONE shadow down the limb (the tube offset away from the light and shrunk: inside the silhouette)
    const lx = rig.light.x, ly = rig.light.y, kk = 0.6;
    ctx.beginPath();
    pathTaperedCapsule(ctx, SUNK.x - lx * LR[0] * (1 - kk), SUNK.y - ly * LR[0] * (1 - kk), knee.x - lx * LR[1] * (1 - kk), knee.y - ly * LR[1] * (1 - kk), LR[0] * kk, LR[1] * kk, true);
    pathTaperedCapsule(ctx, knee.x - lx * LR[1] * (1 - kk), knee.y - ly * LR[1] * (1 - kk), ANK.x - lx * rC * (1 - kk), ANK.y - ly * rC * (1 - kk), LR[1] * kk, rC * kk, true);
    ctx.fillStyle = t.sh; ctx.fill();
    // the paw stays one flat tone
    ctx.beginPath(); pathPawBox(ctx, px, py, pawW, pawH, pawAng);
    ctx.fillStyle = t.base; ctx.fill();
  }
  const cw = rig.dims.claws;
  if (claws && cw) {
    ctx.translate(px, py);
    if (pawAng) ctx.rotate(rad(pawAng));
    ctx.fillStyle = rig.pal.horn;
    ctx.fillRect(pawW - cw.w - 1, pawH - cw.h, cw.w, cw.h);
    ctx.fillRect(pawW - cw.w * 2 - 3, pawH - cw.h, cw.w, cw.h);
  }
  ctx.restore();
}

// ---------- wings ----------

/** Scratch polygon for membranes (x, y pairs). */
const MEM = new Float32Array(64);
/** Spar tips (bones), and the membrane's tips (pulled back along a spar by its thorn). */
const SPX = new Float32Array(6), SPY = new Float32Array(6), TPX = new Float32Array(6), TPY = new Float32Array(6);
/**
 * The last solved wing (solveWing), in the wing space drawBatWing draws in: the fold's shift from the root (sx, sy:
 * the translate drawBatWing enters), the spread f and its complement g, the elbow (ex, ey), the wrist (wx, wy), the
 * membrane's body attach (ax, ay), the root's drop, the trailing edge's scallop depth, the spar count and the
 * humerus angle (radians).
 */
const W = { sx: 0, sy: 0, f: 0, g: 1, ex: 0, ey: 0, wx: 0, wy: 0, ax: 0, ay: 0, drop: 0, depth: 0, n: 0, eh: 0, thorn: 0, ar: 1 };
/** The ARM PANEL of the last solved wing (root, elbow, wrist, trail tip, its edge to the attach), unshifted wing space. */
const ARM = new Float32Array(48);
let armN = 0;

/**
 * Solve a bat / leaf / fin wing's geometry at spread `fold` into W, SPX / SPY and TPX / TPY (no drawing): drawBatWing
 * draws from it, and the rig's hole stamp tests its arm panel (armPanelHas).
 */
function solveWing(rig: DragonRig, wp: Readonly<WingParams>, fold: number): void {
  const wd = rig.dims.wing!;
  // (the elder uses the adult's bones and angles: 2.2; only its membrane attach, wd.attach, moves)
  const A = WING_ANGLES[rig.stage === 'young' ? 'young' : 'adult'];
  const spars = wp.plus ? wd.sparsPlus : wd.spars, ang = wp.plus ? A.sparsPlus : A.spars;
  const f = Math.max(0, Math.min(1, fold)), g = 1 - f, span = wp.span, adult = grown(rig.stage) ? 1 : 0;
  const drop = (3 - wp.foldRise) * g;
  // (a low fold -- foldRise < 3: spike's under its quills, rock's under its dome rim -- takes the drop instead)
  const shy = FOLD_ROOT[adult][1] * g * wp.foldRise / 3;
  W.sx = FOLD_ROOT[adult][0] * g * span; W.sy = shy; W.f = f; W.g = g; W.drop = drop;
  // the folded lower edge's floor, wing-space y: >= 5 px above the belly line, so the flank colour always shows (1.3)
  // (wing space is body space moved to the root while folded: the flap is 0 there), a convex edge's bulge included
  const low = rig.bellyY - 5 - wd.root[1] - (wp.rootDy || 0) - shy - Math.max(0, -wp.scallop * 0.35);
  const eh = angAt(A.humerus, f), ef = angAt(A.forearm, f);
  const ex = Math.cos(eh) * wd.humerus * span, ey = -Math.sin(eh) * wd.humerus * span + drop;
  const wx = ex + Math.cos(ef) * wd.forearm * span, wy = ey - Math.sin(ef) * wd.forearm * span;
  const n = spars.length;
  // the thorns poke past the membrane on the adult and the elder (spike's: parts.ts lets the elder through, 3.3)
  const thorn = wp.thorn * adult;
  for (let i = 0; i < n; i++) {
    const a = angAt(ang[i], f), L = spars[i] * span;
    SPX[i] = wx + Math.cos(a) * L; SPY[i] = wy - Math.sin(a) * L;
    // (a finger tip the fan would drop below that floor -- a deep body, a low fold -- is lifted onto it)
    SPY[i] -= Math.max(0, SPY[i] - low) * g;
    // pull each membrane tip back along its spar by the thorn length: the spar pokes past the membrane
    TPX[i] = SPX[i] - Math.cos(a) * thorn; TPY[i] = SPY[i] + Math.sin(a) * thorn;
  }
  // the membrane's body attach: spread, the stage's point far back on the flank (the elder's further back, the old
  // membrane stretched: 2.9); FOLDED, just under the root, so the folded panel's lower edge runs from the trail tip
  // forward to the shoulder (at the spread attach the folded membrane was a 1-2 px sliver under the arm, and the wing
  // read as a strap)
  const ax = (wd.attach[0] * f + FOLD_ATTACH[0] * g) * span;
  let ay = wd.attach[1] * f + FOLD_ATTACH[1] * g + drop * 0.5;
  ay -= Math.max(0, ay - low) * g;
  // the trailing edge's scallops (x the fold, 1.2) keep a shallow cut folded, where the fanned tips land 4-6 px apart:
  // the folded wing's lower edge reads as a wing's, lobed between the finger tips
  const depth = wp.scallop > 0 ? wp.scallop * f + Math.min(wp.scallop, FOLD_SCALLOP[adult]) * g : wp.scallop * Math.max(0.35, f);
  W.ex = ex; W.ey = ey; W.wx = wx; W.wy = wy; W.ax = ax; W.ay = ay; W.depth = depth; W.n = n; W.eh = eh; W.thorn = thorn;
  // (the painted arm's radius: drawBatWing's `ar`, the folded adult's 3 px leading edge thinned to 2)
  W.ar = wd.armR - (wd.armR - 1) * g;
  // the arm panel (2.9: the rear panel, where an elder's hole goes): root, elbow, wrist, trail tip, then its trailing
  // edge to the attach sampled along the same curve edgeTo draws
  let k = 0;
  ARM[k++] = 0; ARM[k++] = drop * 0.5; ARM[k++] = ex; ARM[k++] = ey; ARM[k++] = wx; ARM[k++] = wy;
  const tx = TPX[n - 1], ty = TPY[n - 1], d = depth * f;
  edgeCtl(tx, ty, ax, ay, wx, wy, d);
  for (let i = 0; i <= 8; i++) {
    const t = i / 8, u = 1 - t;
    ARM[k++] = u * u * tx + 2 * u * t * EC.x + t * t * ax; ARM[k++] = u * u * ty + 2 * u * t * EC.y + t * t * ay;
  }
  armN = k >> 1;
}

/**
 * Wing space: a bat / leaf / fin wing as ONE silhouette (arm capsules + membrane polygon, unioned, stroked once),
 * the membrane matte (2 tones: hi 0) with the arm and spars painted over it in `scale` with no ink (1.2).
 * `fold` 0 = folded along the back, 1 = spread (2.2 angles lerped). `span` scales every bone; `drop` lowers the
 * folded wing (foldRise < 3). FOLDED (1.3) it is a wing, not a strap: a round knuckle knob standing over the back
 * line, the lead spar lying along the forearm as one leading edge to the rump, and under it a flat triangular panel
 * of membrane down to the fanned finger tips on a lobed lower edge, attached under the shoulder. (The old fold put
 * every tip on one line under a 3 px bar, the membrane attached far back: a bar over a 1-2 px dark sliver.)
 * An ELDER's wing carries its TEARS (2.9, wp.tears) as notches of the same membrane polygon, so the one stroke inks
 * them, growing in from `wing` 0.35 to full at 0.55 (wearOf): folded they are closed, and the lobed edge stays clean.
 * Its hole is the rig's (a whole-pixel window cut through both wings and ringed after the near one: rig.ts holeFrame,
 * stampHoleRing), and so is the far wing's cut under these tears (pathWingTears, rig.ts clipOffTears).
 */
export function drawBatWing(ctx: CanvasRenderingContext2D, rig: DragonRig, wp: Readonly<WingParams>, fold: number, pal: Readonly<DragonPalette>): void {
  const wd = rig.dims.wing;
  if (!wd) return;
  solveWing(rig, wp, fold);
  const { f, g, ex, ey, wx, wy, ax, ay, drop, depth, n, eh, thorn } = W;
  const adult = grown(rig.stage) ? 1 : 0;
  const A = WING_ANGLES[rig.stage === 'young' ? 'young' : 'adult'], ang = wp.plus ? A.sparsPlus : A.spars;
  ctx.save();
  ctx.translate(W.sx, W.sy);
  // membrane: root -> elbow -> wrist -> lead tip -> (edge) -> ... -> trail tip -> (edge) -> attach
  let m = 0;
  MEM[m++] = 0; MEM[m++] = drop * 0.5;
  // (folded, the elbow vertex slides up the forearm to the wrist: the panel's front edge runs from the root straight
  // up to the knuckle, and the membrane fills everything under the leading edge)
  MEM[m++] = ex + (wx - ex) * g; MEM[m++] = ey + (wy - ey) * g;
  MEM[m++] = wx; MEM[m++] = wy;
  const tears = rig.stage === 'elder' ? wp.tears : undefined, wear = tears ? wearOf(f) : 0;
  ctx.beginPath();
  ctx.moveTo(MEM[0], MEM[1]); ctx.lineTo(MEM[2], MEM[3]); ctx.lineTo(MEM[4], MEM[5]);
  for (let i = 0; i < n; i++) {
    const tx = TPX[i], ty = TPY[i];
    if (i === 0) ctx.lineTo(tx, ty);
    const nx = i + 1 < n ? TPX[i + 1] : ax, ny = i + 1 < n ? TPY[i + 1] : ay, dep = i + 1 < n ? depth : depth * f;
    // (an elder's tear in this panel -- panel i + 1 -- cuts the edge where it lies)
    let tear: Readonly<WingTear> | null = null;
    if (wear > 0 && tears) for (let k = 0; k < tears.length; k++) if (tears[k].panel === i + 1) { tear = tears[k]; break; }
    if (tear) edgeTornTo(ctx, tx, ty, nx, ny, wx, wy, dep, tear, wear);
    else edgeTo(ctx, tx, ty, nx, ny, wx, wy, dep);
  }
  ctx.lineTo(MEM[0], MEM[1]);
  ctx.closePath();
  // the arm and spars join the silhouette: appended capsules, one stroke over the union
  // (each spar's round cap ENDS at its membrane tip -- a capsule centred on the tip poked its radius past the
  // membrane as a bare stick, and on the far wing behind the near one as a brown twig -- except where a thorn is
  // meant to poke out: spike's)
  // (folded, the adult's 3 px leading edge thins to 2 px, so the membrane under it reads as the wing and the bone as
  // its edge: at 3 px over a 3-4 px panel the bone was most of it, a bar)
  const ar = wd.armR - (wd.armR - 1) * g, sr = wd.sparR - (wd.sparR - 1) * g;
  for (let i = 0; i < n; i++) {
    const a = angAt(ang[i], f), r = sr * (i === 0 ? 1 : 0.8), k = thorn > 0 ? 0 : r;
    SPX[i] -= Math.cos(a) * k; SPY[i] += Math.sin(a) * k;
  }
  // the wrist KNUCKLE (1.3: the "has wings" read): a round knob, grown as the wing folds so it stands above the back
  // line as a bump, not as the corner of a bar
  const kr = ar + (KNUCKLE[adult] - ar) * g;
  // (only the bones painted below join it: a capsule winds against the membrane polygon, so where one lies inside
  // the membrane it cuts a hole the bone paint then covers; an unpainted one -- the folded humerus and inner
  // fingers -- left its ink showing through the panel as scribbles)
  const open = f >= 0.3, bones = open ? n : 1, wrist = wp.wristThorn && adult;
  if (open) pathCapA(ctx, 0, drop * 0.5, ex, ey, ar);
  pathCapA(ctx, ex, ey, wx, wy, ar);
  for (let i = 0; i < bones; i++) pathCapA(ctx, wx, wy, SPX[i], SPY[i], sr * (i === 0 ? 1 : 0.8));
  ctx.moveTo(wx + kr, wy); ctx.arc(wx, wy, kr, 0, Math.PI * 2);
  if (wrist) pathThorn(ctx, wx, wy, eh, wp.wristThorn);
  // membrane: matte, 2 tones (hi 0)
  let minx = 0, maxx = 0, miny = 0, maxy = 0;
  for (let i = 0; i < n; i++) { minx = Math.min(minx, SPX[i]); maxx = Math.max(maxx, SPX[i]); miny = Math.min(miny, SPY[i]); maxy = Math.max(maxy, SPY[i]); }
  minx = Math.min(minx, ax, wx); maxx = Math.max(maxx, wx, ex); miny = Math.min(miny, wy, ey); maxy = Math.max(maxy, ay);
  // (the shading gate measures the part's own radius: the membrane's half-depth under the leading edge, the widest
  // any finger tip stands off the wrist -> lead tip line. Folded that is 3-4 px and the panel is one flat tone, as
  // a limb that thin is: a shadow band across a 4 px panel cut it into two slivers)
  const lx = SPX[0] - wx, ly = SPY[0] - wy, ll = Math.hypot(lx, ly) || 1;
  let deep = 0;
  for (let i = 1; i < n; i++) deep = Math.max(deep, Math.abs((SPX[i] - wx) * ly - (SPY[i] - wy) * lx) / ll);
  deep = Math.max(deep, Math.abs((ax - wx) * ly - (ay - wy) * lx) / ll);
  celPath(ctx, rig, pal.membrane, (minx + maxx) / 2, (miny + maxy) / 2, wantSh(rig, deep / 2) ? Math.hypot(maxx - minx, maxy - miny) / 2 : deep / 2, 0.4, 0);
  // bones over the membrane, in scale, no ink of their own: the forearm and the lead spar are the leading edge, the
  // other spars the fingers fanning from the knuckle to the lobes. Folded, the humerus lies along the body under
  // the membrane and is not drawn.
  ctx.fillStyle = rig.col(pal.scale);
  ctx.beginPath();
  if (open) pathCapA(ctx, 0, drop * 0.5, ex, ey, ar);
  pathCapA(ctx, ex, ey, wx, wy, ar);
  for (let i = 0; i < bones; i++) pathCapA(ctx, wx, wy, SPX[i], SPY[i], sr * (i === 0 ? 1 : 0.8));
  ctx.moveTo(wx + kr, wy); ctx.arc(wx, wy, kr, 0, Math.PI * 2);
  if (wrist) pathThorn(ctx, wx, wy, eh, wp.wristThorn);
  ctx.fill();
  ctx.restore();
}

// ---------- elder wing wear (2.9) ----------

/**
 * How much of an elder's wear shows at spread `fold` (0..1): clamp((wing - 0.35) / 0.2, 0, 1). Folded a tear is
 * closed (a 1-2 px nick would read as one more lobe); it is full from 0.55, so it shows in the elder's preen (0.6),
 * the wake stretch, the airing and flight. A 'custom' wing (lightning's bolt) scales its own tears by it.
 */
export function wearOf(fold: number): number { return Math.max(0, Math.min(1, (fold - 0.35) / 0.2)); }

/** The tear's mouth, px (2.9: 5, so >= 3 px of background shows between its ink lines). */
const TEAR_MOUTH = 5;
/** Edge a tear's mouth keeps clear of each spar tip, px: the spar's cap (1.5) and 1.5 px of membrane beside it. */
const TEAR_CLEAR = 3;

/**
 * Append a trailing edge from (x0, y0) (the current point) to (x1, y1) as edgeTo does, with an elder's TEAR cut into
 * it (2.9): the curve is split round the tear's fraction `at` so its mouth is TEAR_MOUTH px wide (tearMouth), and
 * between the two halves the notch runs `depth` x `wear` px into the membrane, square to the mouth (tearMouth):
 * a slot with one side stepped 1 px halfway down (pathTearNotch); or, `bite`, a round bite (spike's nibbled leaf).
 */
function edgeTornTo(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, wx: number, wy: number,
  depth: number, tear: Readonly<WingTear>, wear: number): void {
  tearMouth(x0, y0, x1, y1, wx, wy, depth, tear.at);
  const cx = EC.x, cy = EC.y, t0 = TM.t0, t1 = TM.t1;
  ctx.quadraticCurveTo(x0 + (cx - x0) * t0, y0 + (cy - y0) * t0, TM.ax, TM.ay);
  pathTearNotch(ctx, TM.ax, TM.ay, TM.bx, TM.by, TM.nx, TM.ny, tear.depth * wear, !!tear.bite);
  ctx.quadraticCurveTo(cx + (x1 - cx) * t1, cy + (y1 - cy) * t1, x1, y1);
}
/**
 * A tear's mouth on the trailing edge: its two points (ax, ay), (bx, by), their curve fractions t0, t1, and the notch's
 * inward direction (nx, ny).
 */
const TM = { ax: 0, ay: 0, bx: 0, by: 0, t0: 0, t1: 0, nx: 0, ny: 0 };
/**
 * Where a tear at fraction `at` opens on the trailing edge (x0, y0) -> (x1, y1) that edgeTo draws (`depth` toward the
 * wrist): the curve split round `at` so the mouth is TEAR_MOUTH px wide, into TM, and the curve's control into EC. The
 * notch runs SQUARE to the mouth, into the membrane (the side the wrist is on): aimed at the wrist, a tear near a spar
 * tip ran along that spar under its bone, and at the resting spread its cut was an ink line, not a notch.
 */
function tearMouth(x0: number, y0: number, x1: number, y1: number, wx: number, wy: number, depth: number, at: number): void {
  edgeCtl(x0, y0, x1, y1, wx, wy, depth);
  const cx = EC.x, cy = EC.y, L = Math.hypot(x1 - x0, y1 - y0) || 1;
  // the mouth keeps TEAR_CLEAR px of edge from each tip, sliding toward the panel's middle where the spread leaves it
  // too little (the middle of all on a panel too short for both): at the resting spread fire's first panel is an
  // 11 px edge, and its tear at 0.35 opened 1.3 px from the lead tip, cut along under the bone and showed an ink line
  const h = TEAR_MOUTH / 2 / L, m = h + TEAR_CLEAR / L, c = m > 0.5 ? 0.5 : Math.max(m, Math.min(1 - m, at));
  const t0 = Math.max(0.05, c - h), t1 = Math.min(0.95, c + h);
  // the two halves of the quadratic (de Casteljau): [0, t0] and [t1, 1] (inline: no closures in a renderer)
  const u0 = 1 - t0, u1 = 1 - t1;
  TM.ax = u0 * u0 * x0 + 2 * t0 * u0 * cx + t0 * t0 * x1; TM.ay = u0 * u0 * y0 + 2 * t0 * u0 * cy + t0 * t0 * y1;
  TM.bx = u1 * u1 * x0 + 2 * t1 * u1 * cx + t1 * t1 * x1; TM.by = u1 * u1 * y0 + 2 * t1 * u1 * cy + t1 * t1 * y1;
  TM.t0 = t0; TM.t1 = t1;
  const w = Math.hypot(TM.bx - TM.ax, TM.by - TM.ay) || 1;
  let nx = -(TM.by - TM.ay) / w, ny = (TM.bx - TM.ax) / w;
  if (nx * (wx - (TM.ax + TM.bx) / 2) + ny * (wy - (TM.ay + TM.by) / 2) < 0) { nx = -nx; ny = -ny; }
  TM.nx = nx; TM.ny = ny;
}

/**
 * Append the elder's TEAR CUTS of a bat / leaf / fin wing at spread `fold` to the current path, as closed regions in the
 * space the rig enters for the wing (the fold's shift included): each notch closed across its mouth. The rig clips
 * them off the FAR wing (rig.ts clipOffTears), so a near tear shows what lies behind the wings -- the room, or the
 * body -- and not the far wing's own darker membrane, which filled every near cut at the resting spread and left an
 * ink-lined dark slot in dark membrane (the elder core review). False when no tear shows (not an elder, none, folded).
 */
export function pathWingTears(ctx: CanvasRenderingContext2D, rig: DragonRig, wp: Readonly<WingParams>, fold: number): boolean {
  const tears = rig.stage === 'elder' && rig.dims.wing && wp.style !== 'custom' ? wp.tears : undefined;
  const wear = tears ? wearOf(fold) : 0;
  if (!tears || wear <= 0) return false;
  solveWing(rig, wp, fold);
  const n = W.n, sx = W.sx, sy = W.sy;
  for (let k = 0; k < tears.length; k++) {
    const tr = tears[k], i = tr.panel - 1;
    if (i < 0 || i >= n) continue;
    const last = i + 1 >= n, x1 = last ? W.ax : TPX[i + 1], y1 = last ? W.ay : TPY[i + 1];
    tearMouth(TPX[i], TPY[i], x1, y1, W.wx, W.wy, last ? W.depth * W.f : W.depth, tr.at);
    ctx.moveTo(TM.ax + sx, TM.ay + sy);
    pathTearNotch(ctx, TM.ax + sx, TM.ay + sy, TM.bx + sx, TM.by + sy, TM.nx, TM.ny, tr.depth * wear, !!tr.bite);
    ctx.closePath();
  }
  return true;
}
const EC = { x: 0, y: 0 };
/** The control point edgeTo uses for a trailing edge (x0, y0) -> (x1, y1) of `depth` toward the wrist, into EC. */
function edgeCtl(x0: number, y0: number, x1: number, y1: number, wx: number, wy: number, depth: number): void {
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  let dx = wx - mx, dy = wy - my;
  const L = Math.hypot(dx, dy) || 1;
  dx /= L; dy /= L;
  const k = Math.abs(depth) < 0.3 ? 0 : depth * 2;
  EC.x = mx + dx * k; EC.y = my + dy * k;
}

/**
 * Append a tear's notch from mouth point A (the current point) to mouth point B, `d` px deep along (nx, ny): the
 * ragged notch or a round `bite`. The notch is a SLOT, its sides running straight in from the mouth: A's side steps
 * 1 px toward B halfway down (it reads torn, not as one more smooth scallop), B's runs straight to the bottom. The
 * engine inks 1 px outside every fill, into the cut, so a 5 px mouth shows 3 px of background over the top half and
 * 2 over the bottom half, the whole depth. (A V, or a slot narrowed to a 1.5 px flat bottom, showed 2 rows of
 * 2-3 px at the mouth tapering to nothing under the ink: at the resting spread it could not be told from a scallop,
 * the elder core review.)
 */
function pathTearNotch(ctx: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, nx: number, ny: number, d: number, bite: boolean): void {
  if (d < 0.5) { ctx.lineTo(bx, by); return; }
  const mx = (ax + bx) / 2, my = (ay + by) / 2, w = Math.hypot(bx - ax, by - ay) || 1, ux = (bx - ax) / w, uy = (by - ay) / w;
  if (bite) { ctx.quadraticCurveTo(mx + nx * d * 2, my + ny * d * 2, bx, by); return; }
  // A down half the depth, a 1 px step toward B, down to the bottom, across it to under B, and straight back up to B
  const hx = ax + nx * d * 0.5, hy = ay + ny * d * 0.5;
  ctx.lineTo(hx, hy);
  ctx.lineTo(hx + ux, hy + uy);
  ctx.lineTo(ax + ux + nx * d, ay + uy + ny * d);
  ctx.lineTo(bx + nx * d, by + ny * d);
  ctx.lineTo(bx, by);
}

/**
 * For a CUSTOM wing's own renderer (lightning's bolt, 2.9): a straight edge from the current point (x0, y0) to
 * (x1, y1), appended to the current path, with an elder's tear cut into it at fraction `at` (a TEAR_MOUTH px mouth),
 * `depth` px along the inward normal (nx, ny: pointing into the membrane). Scale the depth by wearOf, or keep it
 * whole on a wing that never folds. The path's one stroke inks it.
 */
export function pathTearEdge(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, at: number, depth: number, nx: number, ny: number): void {
  const L = Math.hypot(x1 - x0, y1 - y0) || 1, h = TEAR_MOUTH / 2 / L, t0 = Math.max(0, at - h), t1 = Math.min(1, at + h);
  const ax = x0 + (x1 - x0) * t0, ay = y0 + (y1 - y0) * t0, bx = x0 + (x1 - x0) * t1, by = y0 + (y1 - y0) * t1;
  ctx.lineTo(ax, ay);
  pathTearNotch(ctx, ax, ay, bx, by, nx, ny, depth, false);
  ctx.lineTo(x1, y1);
}

/**
 * The elder's hole centre (2.9, wp.hole) at spread `fold`, in the space the rig ENTERS for the wing (wing space, the
 * fold's shift included), into `out`; false when no hole is drawn at this spread (not an elder, no hole, under
 * `from`). Solves the wing, so armPanelHas tests the same one.
 */
export function wingHoleAt(rig: DragonRig, wp: Readonly<WingParams>, fold: number, out: Point): boolean {
  const h = wp.hole;
  if (rig.stage !== 'elder' || !h || !rig.dims.wing || wp.style === 'custom' || fold < h.from) return false;
  solveWing(rig, wp, fold);
  out.x = h.x * wp.span + W.sx; out.y = h.y * wp.span + W.sy;
  return true;
}

/**
 * The elder's hole as face-space pixels (x, y pairs) round the pixel its centre rounds to (2.9): a 4 x 3 window with
 * its top-back corner notched (11 px of background: an irregular, torn hole, never a square; EL's round 2 x 2 window in
 * an ink ring read as a rivet or a grommet, and the first build's notched 3 x 3 in a closed ring as a ringed pale dot:
 * an eye on fire's wing, an eyespot on dusk's, one more of water's spots, the elder core review, rounds 1 and 2).
 */
export const HOLE_PX: readonly number[] = [-1, -1, 0, -1, 1, -1, -2, 0, -1, 0, 0, 0, 1, 0, -2, 1, -1, 1, 0, 1, 1, 1];
/**
 * Its 1 px ink ring's candidate pixels (the window's 4-neighbours; the notch pixel is never one): top, front, bottom,
 * then the back. The rig inks only those on the membrane away from the bone: none beside the leading-edge bone the
 * window is seated against (armBoneGap: the bone is that side's border, 2.9) and none along the notched BACK side
 * (HOLE_RING_OPEN), so the window breaks the membrane on two sides like a torn gap instead of sitting in a closed ring.
 */
export const HOLE_RING: readonly number[] = [-1, -2, 0, -2, 1, -2, 2, -1, 2, 0, 2, 1, -2, 2, -1, 2, 0, 2, 1, 2, -3, 0, -3, 1];
/** HOLE_RING's pixels from this index on (the notched back side) are never inked. */
export const HOLE_RING_OPEN = 20;

/**
 * Is wing-space point (x, y) (the space the rig enters: the fold's shift included) inside the arm panel of the wing
 * wingHoleAt last solved, with `pad` px of it all round? The bones along the leading edge count as panel: the hole
 * may take the forearm as one border (2.9).
 */
export function armPanelHas(x: number, y: number, pad: number): boolean {
  const px = x - W.sx, py = y - W.sy;
  let inside = false;
  for (let i = 0, j = armN - 1; i < armN; j = i++) {
    const xi = ARM[i * 2], yi = ARM[i * 2 + 1], xj = ARM[j * 2], yj = ARM[j * 2 + 1];
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
  }
  if (!inside || pad <= 0) return inside;
  // the distance to every edge but the leading one (root -> elbow -> wrist: the bone borders the hole there)
  for (let j = 2; j < armN; j++) {
    const a = (j + 1) % armN, xi = ARM[a * 2], yi = ARM[a * 2 + 1], xj = ARM[j * 2], yj = ARM[j * 2 + 1];
    const ex = xi - xj, ey = yi - yj, l2 = ex * ex + ey * ey || 1, t = Math.max(0, Math.min(1, ((px - xj) * ex + (py - yj) * ey) / l2));
    if (Math.hypot(px - xj - ex * t, py - yj - ey * t) < pad) return false;
  }
  return true;
}

/**
 * The membrane between wing-space point (x, y) (the space the rig enters: the fold's shift included) and the
 * leading-edge bone (root -> elbow -> wrist, painted `ar` px round its axis) of the wing wingHoleAt last solved, px:
 * <= 0 on the bone. The hole is seated against it (2.9: the bone is one border of the window).
 */
export function armBoneGap(x: number, y: number): number {
  const px = x - W.sx, py = y - W.sy;
  let best = 1e9;
  for (let j = 0; j < 2; j++) {
    const xj = ARM[j * 2], yj = ARM[j * 2 + 1], ex = ARM[j * 2 + 2] - xj, ey = ARM[j * 2 + 3] - yj;
    const l2 = ex * ex + ey * ey || 1, t = Math.max(0, Math.min(1, ((px - xj) * ex + (py - yj) * ey) / l2));
    best = Math.min(best, Math.hypot(px - xj - ex * t, py - yj - ey * t));
  }
  return best - W.ar;
}

/**
 * The folded wing's shift from the wing root, px [young, adult]: back along the back and down (the down part x
 * foldRise / 3), so the knuckle stands clear behind the neck's root, its top about 3 px over the back line.
 */
const FOLD_ROOT: readonly (readonly [number, number])[] = [[-3, 2], [-4, 3]];
/** Folded membrane attach, from the wing root (young and adult alike): under the shoulder. */
const FOLD_ATTACH: readonly [number, number] = [-1, 3];
/** The folded trailing edge's scallop depth cap, px [young, adult]. */
const FOLD_SCALLOP: readonly [number, number] = [1.5, 2];
/** The folded wrist knuckle's radius, px [young, adult]. */
const KNUCKLE: readonly [number, number] = [1.5, 2];

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
 * head -> chest) is an extra circle appended to the SAME path, so it changes the silhouette (1.2). (Slinkwing's
 * throat sac is its own: drawn at its breath anchor 0.6 of the way up the neck, clipped behind the head. A sac
 * centred on the last node, under the jaw, hid under the head drawn after the neck and never showed.)
 *
 * The neck and the body are one silhouette (1.2: the root sunk into the chest): the whole neck -- stroke, fill,
 * stripe and band -- is clipped to OUTSIDE the body capsule shrunk by 1 px. Its fill covers the body's ink ring
 * where the two overlap and its own ink stops at the body contour, so no collar arc is stroked across the chest.
 */
export function drawNeck(ctx: CanvasRenderingContext2D, rig: DragonRig, pal: Readonly<DragonPalette>, gulp: number): void {
  const J = rig.j, n = J.neckN + 1;
  let bulge: Bulge | null = null;
  if (gulp >= 1 && gulp <= 3 && n > 1) {
    // the swallowed lump (C15, 4.2): a circle in the neck's own contour, 2.5 px proud of the throat, stepping head
    // (gulp 1) -> chest (3) at 70 / 50 / 30 % of the neck from its root. Growing a node by 2 px changed the contour
    // by about 1 px, and two of the three nodes hide under the head and in the chest
    const f = (gulp === 1 ? 0.7 : gulp === 2 ? 0.5 : 0.3) * (n - 1), k = Math.min(n - 2, Math.floor(f)), u = f - k;
    const r = J.neckR[k] + (J.neckR[k + 1] - J.neckR[k]) * u;
    const vx = J.neckVX[k] + (J.neckVX[k + 1] - J.neckVX[k]) * u, vy = J.neckVY[k] + (J.neckVY[k + 1] - J.neckVY[k]) * u;
    const vl = Math.hypot(vx, vy) || 1;
    GB.r = r * 0.55 + 1.5;
    const out = r + 2.5 - GB.r;
    GB.x = J.neckX[k] + (J.neckX[k + 1] - J.neckX[k]) * u + vx / vl * out;
    GB.y = J.neckY[k] + (J.neckY[k + 1] - J.neckY[k]) * u + vy / vl * out;
    GB.hex = pal.belly;
    bulge = GB;
  }
  const rs: Float32Array = J.neckR;
  ctx.save();
  ctx.beginPath(); ctx.rect(-2000, -2000, 4000, 4000);
  const d = rig.dims, h = rig.hipB, c = rig.chestB;
  ctx.save(); ctx.translate(J.body.x, J.body.y); ctx.rotate(rad(J.bodyAng));
  pathTaperedCapsule(ctx, h.x, h.y, c.x, c.y, d.hipR - 1, d.chestR - 1, true);
  ctx.restore();
  ctx.clip('evenodd');
  // a narrower band than a limb's (NECK_SH, not 0.6): the neck's shadow side IS its underside (the throat), and
  // a wide band swallowed the stripe, so it showed belly.sh, never the belly colour
  drawTube(ctx, rig, J.neckX, J.neckY, rs, n, pal.scale, pal.belly, J.neckVX, J.neckVY, n, NECK_STRIPE, bulge, NECK_SH);
  ctx.restore();
}
const GB: Bulge = { x: 0, y: 0, r: 0, hex: '' };

// ---------- skull and jaw (cranium space) ----------

/**
 * Cranium space: the skull as ONE path (drawSkull's approach): cranium circle + snout taper + brow-ridge bump +
 * the element's optional bumps (rock's nose-horn root, slinkwing's nose-leaf). Bumps live in the contour, never
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

/** Is cranium-space point (x, y) at least `pad` px inside the skull path (pathSkull's circles and snout taper)? */
export function inSkull(rig: DragonRig, x: number, y: number, pad = 0): boolean {
  const h = rig.dims.head, s = h.snout, r = h.cranR - pad;
  if (x * x + y * y <= r * r) return true;
  // the snout taper: the nearest point on its axis, the radius lerped there
  const ax = s.x1 - s.x0, ay = s.y1 - s.y0, L2 = ax * ax + ay * ay || 1;
  const t = Math.max(0, Math.min(1, ((x - s.x0) * ax + (y - s.y0) * ay) / L2));
  const qx = x - s.x0 - ax * t, qy = y - s.y0 - ay * t, rr = s.r0 + (s.r1 - s.r0) * t - pad;
  if (rr > 0 && qx * qx + qy * qy <= rr * rr) return true;
  if (h.brow > 0) {
    const a = rad(58), br = 3 - pad, d = r + pad + h.brow - 3, bx = Math.cos(a) * d - x, by = -Math.sin(a) * d - y;
    if (br > 0 && bx * bx + by * by <= br * br) return true;
  }
  const bumps = rig.sp.skullBumps;
  if (bumps) for (let i = 0; i < bumps.length; i++) {
    const b = bumps[i], dx = b.x - x, dy = b.y - y, br = b.r - pad;
    if (br > 0 && dx * dx + dy * dy <= br * br) return true;
  }
  return false;
}

/** y of a tapered capsule's lower contour at x (end circles, straight between): NaN where it has none. */
function capsuleUnderY(x: number, x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): number {
  let y = NaN;
  if (Math.abs(x - x0) < r0) y = y0 + Math.sqrt(r0 * r0 - (x - x0) * (x - x0));
  if (Math.abs(x - x1) < r1) { const v = y1 + Math.sqrt(r1 * r1 - (x - x1) * (x - x1)); y = y === y ? Math.max(y, v) : v; }
  if (x > x0 && x < x1) { const v = y0 + r0 + (y1 + r1 - y0 - r0) * (x - x0) / (x1 - x0); y = y === y ? Math.max(y, v) : v; }
  return y;
}

/** Cranium space: y of the skull's lower contour at x (the cranium circle or the snout taper, whichever is lower). */
export function skullUnderY(rig: DragonRig, x: number): number {
  const h = rig.dims.head, s = h.snout, r = h.cranR;
  const c = Math.abs(x) < r ? Math.sqrt(r * r - x * x) : NaN, v = capsuleUnderY(x, s.x0, s.y0, s.r0, s.x1, s.y1, s.r1);
  return c === c ? (v === v ? Math.max(c, v) : c) : v;
}

/**
 * Cranium space, into `out`: the mouth corner, the back end of the closed mouth line -- the first x where the
 * closed jaw shows below the skull -- on the skull's lower contour (0.5 px in, so a mark there touches its ink).
 * Placed on the cheek at the jaw hinge, a mouth mark floated 2-2.5 px above the contour, and the happy notch read
 * as a tear under the eye.
 */
export function mouthCorner(rig: DragonRig, out: Point): Point {
  const j = rig.dims.head.jaw;
  let x = j.hx + 4;
  for (let t = j.hx; t <= j.tx; t += 0.25) {
    const jy = capsuleUnderY(t, j.hx, j.hy, j.r0, j.tx, j.ty, j.r1), sy = skullUnderY(rig, t);
    if (jy === jy && sy === sy && jy - sy >= 0.75) { x = t; break; }
  }
  out.x = x; out.y = skullUnderY(rig, x) - 0.5;
  return out;
}

/** Cranium-space centre and extent of the whole head (cranium + snout), for the skull's cel bands. */
export function skullBands(rig: DragonRig): { cx: number; ext: number } {
  const h = rig.dims.head, tip = h.snout.x1 + h.snout.r1;
  SB.cx = (tip - h.cranR) / 2; SB.ext = (tip + h.cranR) / 2;
  return SB;
}
const SB = { cx: 0, ext: 0 };

/**
 * Cranium space: the skull, cel-shaded as one part (ext = half the head length: babies 2 tones, others 3). The
 * shadow band covers 0.22 of the head on young and adult, not 0.34: the band runs perpendicular to the light across
 * a LONG head, and at 0.34 it crossed the snout at its root, so the whole muzzle sat in shadow (a dark muzzle, the
 * nostril lost in it); at 0.22 the snout's top stays base and the shadow takes its front-bottom and the chin. The
 * baby's round head and button snout keep 0.34 (its volume is that shadow).
 */
export function drawSkull(ctx: CanvasRenderingContext2D, rig: DragonRig, pal: Readonly<DragonPalette>): void {
  const b = skullBands(rig);
  pathSkull(ctx, rig);
  celPath(ctx, rig, pal.scale, b.cx, 0, b.ext, rig.stage === 'baby' ? 0.34 : 0.22, 0.3);
}

/**
 * Cranium space, into `out`: the point on the jaw's TOP edge at fraction u (0 = hinge, 1 = tip) with the jaw open
 * `jawDeg` (dropped and turned, as drawJaw draws it). The tongue lies there; an effect can too.
 */
export function jawTopAt(rig: DragonRig, jawDeg: number, u: number, out: Point): Point {
  const j = rig.dims.head.jaw, a = rad(jawDeg), c = Math.cos(a), s = Math.sin(a);
  const tx = j.tx - j.hx, ty = j.ty - j.hy, L = Math.hypot(tx, ty) || 1, r = j.r0 + (j.r1 - j.r0) * u;
  // along the axis, then out along its upper normal (the axis turned -90 deg), all turned by the opening
  const lx = tx * u + (ty / L) * r, ly = ty * u - (tx / L) * r;
  out.x = j.hx + lx * c - ly * s; out.y = j.hy + (jawDeg ? j.drop : 0) + lx * s + ly * c;
  return out;
}

/**
 * Cranium space: the hinged jaw, drawn UNDER the skull (1.2): a celTaper hinge -> tip rotated `jawDeg` open, upper
 * half `scale`, lower half `belly` so the chin continues the throat stripe. OPEN, it first drops `jaw.drop` px
 * (stages.ts: a jaw that only turned showed no mouth at its minimum). CLOSED, the belly half is tucked: all that
 * shows below the snout is a ~1 px sliver, and in belly it read as a lip line, or on slinkwing's near-white belly
 * as bared teeth at neutral; it is painted in the scale's shadow tone instead, the underside of the head.
 */
export function drawJaw(ctx: CanvasRenderingContext2D, rig: DragonRig, jawDeg: number, pal: Readonly<DragonPalette>): void {
  const j = rig.dims.head.jaw;
  ctx.save();
  ctx.translate(j.hx, j.hy + (jawDeg ? j.drop : 0));
  if (jawDeg) ctx.rotate(rad(jawDeg));
  const tx = j.tx - j.hx, ty = j.ty - j.hy;
  pathTaperedCapsule(ctx, 0, 0, tx, ty, j.r0, j.r1);
  outlinePath(ctx, rig);
  const t = tones(rig, pal.scale);
  ctx.fillStyle = rig.col(jawDeg ? t.base : rig.shading ? t.sh : t.base); ctx.fill();
  if (!rig.override && jawDeg) {
    ctx.save(); ctx.clip();
    const a = Math.atan2(ty, tx);
    ctx.rotate(a);
    ctx.fillStyle = pal.belly; ctx.fillRect(-j.r0 - 2, 0, Math.hypot(tx, ty) + j.r0 + 4, j.r0 + 2);
    ctx.restore();
  }
  ctx.restore();
}

/**
 * The elder's BEARD (1.2, 2.5) in the jaw's own axis frame: u along the jaw from its hinge, v down from its axis. A
 * small rounded tuft SET BACK under the chin, its root along the jaw's underside from u = tip - 8 to tip - 3 (so it
 * never lengthens the chin's point), 5 px wide and 3 px deep below the jaw (its lower points deeper where the skull
 * hangs below the jaw: rig.beardDv, fitBeard), its bottom round, its lowest point swept
 * back >= 3 px toward the throat: a teardrop pointing back along the throat, never down (EL's pointed goatee under
 * the jaw tip read as a tusk or a drip, and open it grew out of the chin stripe into one long pointed chin).
 * BEARD_UV: [front root, round front, lowest point, back point, back root], (u from the tip, v below the underside).
 */
const BEARD_UV: readonly number[] = [-3, -0.6, -3.2, 2.6, -6.2, 3, -9.2, 1.4, -8, -0.6];
/**
 * The beard's (u from the jaw tip, v below its underside) of BEARD_UV point `i` (0..4) on this rig: the three LOWER
 * points (the round front, the lowest, the back point) hang rig.beardDv px deeper (fitBeard), the root stays on the jaw.
 */
function beardV(rig: DragonRig, i: number): number { return BEARD_UV[i * 2 + 1] + (i >= 1 && i <= 3 ? rig.beardDv : 0); }
/** Map the beard's (u from the jaw tip, v below its underside) into cranium space at jaw opening `jawDeg`, into `out`. */
function beardPt(rig: DragonRig, jawDeg: number, u: number, v: number, out: Point): Point {
  const j = rig.dims.head.jaw, tx = j.tx - j.hx, ty = j.ty - j.hy, L = Math.hypot(tx, ty) || 1;
  const uu = L + u, r = j.r0 + (j.r1 - j.r0) * Math.max(0, Math.min(1, uu / L)), vv = r + v;
  // jaw-axis frame -> jaw space (the axis turned by atan2(ty, tx)) -> cranium space (dropped and turned open)
  const ca = tx / L, sa = ty / L, lx = uu * ca - vv * sa, ly = uu * sa + vv * ca;
  const a = rad(jawDeg), c = Math.cos(a), s = Math.sin(a);
  out.x = j.hx + lx * c - ly * s; out.y = j.hy + (jawDeg ? j.drop : 0) + lx * s + ly * c;
  return out;
}
const BP: Point = { x: 0, y: 0 }, BQ: Point = { x: 0, y: 0 };

/**
 * Cranium space: the elder's beard, drawn right after the jaw (1.4 step 12.2) so it moves with the jaw: its own
 * object with its own 1 px ink (hair, like a quill), flat in `hex` (rig.greys.beard: palettes.ts beardOf, >= 25 %
 * from the belly, its shadow tone, the closed jaw's sliver and the straw floor). Its root lies a little inside the
 * jaw's underside, so the jaw's ink under it is covered and the tuft grows from the chin, not beside it.
 */
export function drawBeard(ctx: CanvasRenderingContext2D, rig: DragonRig, jawDeg: number, hex: string): void {
  const B = BEARD_UV;
  ctx.beginPath();
  beardPt(rig, jawDeg, B[0], beardV(rig, 0), BP); ctx.moveTo(BP.x, BP.y);
  // the round front and bottom, then the sweep back and up to the point, and back along the jaw to the root
  beardPt(rig, jawDeg, B[2], beardV(rig, 1), BP); beardPt(rig, jawDeg, B[4], beardV(rig, 2), BQ); ctx.quadraticCurveTo(BP.x, BP.y, BQ.x, BQ.y);
  beardPt(rig, jawDeg, B[6], beardV(rig, 3), BP); ctx.lineTo(BP.x, BP.y);
  beardPt(rig, jawDeg, B[8], beardV(rig, 4), BP); ctx.lineTo(BP.x, BP.y);
  ctx.closePath();
  flat(ctx, rig, hex);
}

/** Cranium space, into `out`: the beard's lowest point at jaw opening `jawDeg` (rig.ts headSink's floor guard). */
export function beardLow(rig: DragonRig, jawDeg: number, out: Point): Point {
  // the round bottom's lowest point, and the back point, whichever the head's pitch puts lower is the floor's; the
  // cranium-space lowest (+y) serves: the guard maps both through the head angle, so take the bottom
  return beardPt(rig, jawDeg, BEARD_UV[4], beardV(rig, 2) + 0.5, out);
}

/**
 * How much deeper the beard's lower points hang on this head (rig.beardDv, px; build time): the least drop, in 0.25 px
 * steps, that shows at least 3 x 3 px of the tuft's fill below the skull's ink with the jaw shut (5.2: the beard is
 * the elder's face signal, 2.5). The one BEARD_UV shape sits under the jaw, and on a head whose skull hangs lower
 * than its jaw -- rock's boxy snout, dusk's short one under the cranium's round bottom -- the skull drawn after it
 * covered all but a 2 x 2 speck or a 2-row sliver. On fire's snout it drops about a pixel, so every elder shows the
 * same tuft under its chin whatever the snout. Allocates: call it once per rig.
 */
export function fitBeard(rig: DragonRig): number {
  const keep = rig.beardDv, poly: number[] = [];
  for (let dv = 0; dv <= 4; dv += 0.25) {
    rig.beardDv = dv;
    poly.length = 0;
    const B = BEARD_UV;
    beardPt(rig, 0, B[0], beardV(rig, 0), BP); const x0 = BP.x, y0 = BP.y;
    beardPt(rig, 0, B[2], beardV(rig, 1), BP); beardPt(rig, 0, B[4], beardV(rig, 2), BQ);
    for (let i = 0; i <= 12; i++) {
      const t = i / 12, u = 1 - t;
      poly.push(u * u * x0 + 2 * u * t * BP.x + t * t * BQ.x, u * u * y0 + 2 * u * t * BP.y + t * t * BQ.y);
    }
    beardPt(rig, 0, B[6], beardV(rig, 3), BP); poly.push(BP.x, BP.y);
    beardPt(rig, 0, B[8], beardV(rig, 4), BP); poly.push(BP.x, BP.y);
    let minx = 1e9, maxx = -1e9;
    for (let i = 0; i < poly.length; i += 2) { minx = Math.min(minx, poly[i]); maxx = Math.max(maxx, poly[i]); }
    // the widest run of columns (0.25 px apart) each showing >= 3.4 px of fill under the skull's 1 px of ink
    let run = 0, best = 0;
    for (let x = minx; x <= maxx; x += 0.25) {
      let vis = 0, most = 0;
      for (let y = -12; y <= 20; y += 0.1) {
        if (inPoly(poly, x, y) && !inSkull(rig, x, y, -1)) { vis += 0.1; most = Math.max(most, vis); } else vis = 0;
      }
      run = most >= 3.4 ? run + 0.25 : 0;
      best = Math.max(best, run);
    }
    if (best >= 3.25) return dv;
  }
  rig.beardDv = keep;
  return 4;
}
/** Is (x, y) inside the closed polygon `p` (x, y pairs)? Even-odd. */
function inPoly(p: readonly number[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    const xi = p[i], yi = p[i + 1], xj = p[j], yj = p[j + 1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Cranium space: the open mouth (drawn FIRST in the head group, 1.4 step 12.1): the whole gap between the skull's
 * underside and the open, dropped jaw in mouth `#5a2030` -- from behind the hinge, along under the snout to its
 * tip, down the front of the opening to the jaw's tip and back along the jaw. The skull and jaw drawn over it trim
 * it to the wedge that shows. (The 2 x 2 tongue is the rig's, on the jaw's top edge in face space: drawn here, under
 * the jaw, the jaw covered it.)
 */
export function drawMouthInterior(ctx: CanvasRenderingContext2D, rig: DragonRig, jawDeg: number, mouth: string): void {
  const h = rig.dims.head, j = h.jaw, s = h.snout, a = rad(jawDeg), c = Math.cos(a), sn = Math.sin(a);
  const dx = j.tx - j.hx, dy = j.ty - j.hy, hy = j.hy + j.drop;
  // the jaw tip's centre, and its front-top on the round end; the snout's front-bottom on its end circle: the
  // opening's front edge runs between the two, so the widest part of the gap (at the jaw's front) is mouth too
  const tx = j.hx + dx * c - dy * sn, ty = hy + dx * sn + dy * c, k = j.r1 * 0.7;
  ctx.beginPath();
  ctx.moveTo(j.hx - 1, j.hy - j.r0 * 0.5);
  ctx.lineTo(s.x1, s.y1);
  ctx.lineTo(s.x1 + s.r1 * 0.7, s.y1 + s.r1 * 0.7);
  ctx.lineTo(tx + k * c + k * sn, ty + k * sn - k * c);
  ctx.lineTo(tx, ty);
  ctx.lineTo(j.hx, hy);
  ctx.closePath();
  ctx.fillStyle = rig.col(mouth); ctx.fill();
}
