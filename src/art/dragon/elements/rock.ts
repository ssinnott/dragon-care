// ROCK: "Cobble", the boulder dragon (docs/ART_BIBLE.md 3.4). Zone: the body mass. Cue: one faceted dome carapace
// over the back plus a heavy, low stance. The dome never changes (the cue is always 100 %); its crystals' glow is
// the mood gauge, and their count grows with the bond.
//
// What lives here, by anchor:
//   bodyOver : the dome (facets toned in thirds), its crystal cluster (the gauge: dim / lit / glinting; the breath's
//              tell; the upset flicker), the upset tuck's hood (the dome's front rolled forward over the head), and
//              the pebble pile of the hungry tell;
//   nearHead : the blunt nose horn;
//   breath   : the Gravel Roar (a cone of dust, a spray of pebbles) and the baby's proud "ptoo";
//   ambient  : floor-level dust (walk contacts, the idle weight shift, a body settling, the roll's landing) and the
//              pebble crumb that rolls off the dome.
// And the anims of 4.3: the weight-shifting idle, the roll-over happy, the gravel roar, the pebble-licking beg, the
// sunbathe fidget, the upset tuck ('upset', a loop), plus the tuning of walk, sleep and breath.
import { DRAGON_PALETTES, DRAGON_SHARED } from '../palettes.ts';
import { STAGE_TIMING, FIDGET_TIMING, TAIL_REST, grown } from '../stages.ts';
import type { Stage } from '../stages.ts';
import { wingParams } from '../element.ts';
import type { DragonInfo, ElementSpec, ElementDraw } from '../element.ts';
import type { DragonRig } from '../rig.ts';
import { cranToRootPt, enterFaceFromLocal, localToRootPt } from '../rig.ts';
import { backLineY, disc, mouthToRoot } from '../features.ts';
import { ACT, DFACE } from '../pose.ts';
import type { DragonPose } from '../pose.ts';
import { bake, lag, stretchKeys } from '../anims.ts';
import type { Key, Tracks } from '../anims.ts';
import type { DragonAnim } from '../anim.ts';
import type { DragonDims } from '../build.ts';
import { liveSpawns, stepShrink } from '../fx.ts';
import { celTaper, outlinePath, tones } from '../../../lib/art/shading.ts';

const PAL = DRAGON_PALETTES.rock;
const RAD = Math.PI / 180;

/** Dome width x rise above the back and facet count (3.4 table). */
const DOME: Readonly<Record<Stage, { w: number; rise: number; facets: number }>> = {
  baby: { w: 12, rise: 5, facets: 1 },
  young: { w: 22, rise: 9, facets: 3 },
  adult: { w: 34, rise: 11, facets: 5 },
  // FIRST PASS (elder): the adult's dome. 3.4's elder dome grows to 36 x 12 with 6 facets, whole (never chipped)
  elder: { w: 34, rise: 11, facets: 5 },
};

/**
 * One crystal: its place along the dome (0 = the rear end .. 1 = the front end), its place in the glint's sweep
 * (rear to front), and its pixels -- the glow INSIDE its 1 px ink ring, which the renderer rings -- as rows from the
 * tip down to row 0 (sunk into the dome's line), the rows' first character at column `ox` from its centre column:
 *   '#' glow;  'f' the glow.hi facet (lit);  'a' / 'b' / 'c' glow under glint spot A / B / both;
 *   'A' / 'B' / 'C' the facet under glint spot A / B / both;  '.' nothing.
 * Spot A is the TIP (the point and the row under it, full width: a 2 x 2 on a 3 px crystal left a 1 px sliver of
 * glow beside it, under the mark floor); spot B, lower down, only on a seed, which glints alone while it is the
 * only crystal (A and B take turns, so a happy lone seed always glints).
 */
interface Crystal { u: number; sweep: number; ox: number; rows: readonly string[] }
/**
 * The crystals per stage, in the order the bond GROWS them (3.4): the first is the seed every rock hatches with,
 * grown with the stage (baby 3 x 4, young 3 x 5, adult 4 x 7), the rest join it on the rear third; the adult's third
 * is its adult-only extra, the 3-crystal cluster. (The baby's seed is 3 x 4, not 2 x 3: a 2 px crystal inside its ink
 * keeps a 1 px core, under the mark floor, and read as a speck at game scale.) A CLUSTER, not a row of pills: the
 * outer crystals splay 1 px outward every 3 rows, a geode's fan, their points on their outer side; the 4 x 7 has a
 * real point, an off-centre bevel stepping 4 -> 2 -> 1 with its high side on the lit left (a symmetric one-row
 * chamfer left a flat 2 px top: a bullet, a battery). The baby's seed stands at 0.15, clear of its big head's back
 * by >= 2 px (2.6: at 0.3 its ink touched the head's outline and read as a bow on the head).
 */
const CRYSTALS: Readonly<Record<Stage, readonly Crystal[]>> = {
  baby: [
    { u: 0.15, sweep: 0, ox: -1, rows: ['.a.', 'aaa', 'bbb', 'bbb', '###'] },
  ],
  young: [
    { u: 0.34, sweep: 1, ox: -1, rows: ['.a.', 'aaa', 'bbb', 'bbb', '###', '###'] },
    { u: 0.15, sweep: 0, ox: -2, rows: ['.a..', 'aaa.', '###.', '.###', '.###', '.###'] },
  ],
  adult: [
    { u: 0.27, sweep: 1, ox: -2, rows: ['.A..', 'AA..', 'AA##', 'ff##', 'BB##', 'BB##', '####', '####'] },
    { u: 0.11, sweep: 0, ox: -2, rows: ['.a..', 'aaa.', '###.', '.###', '.###', '.###'] },
    { u: 0.43, sweep: 2, ox: -1, rows: ['..a.', '.aaa', '.###', '###.', '###.', '###.'] },
  ],
  // FIRST PASS (elder): the adult's cluster of 3 (ceil(bond x 3)). 3.4's elder grows the big crystal to 4 x 8 and
  // adds its elder-only extra, THE FOURTH CRYSTAL (3 x 4 at u 0.55: ceil(bond x 3) + 1, always one more than an adult)
  elder: [
    { u: 0.27, sweep: 1, ox: -2, rows: ['.A..', 'AA..', 'AA##', 'ff##', 'BB##', 'BB##', '####', '####'] },
    { u: 0.11, sweep: 0, ox: -2, rows: ['.a..', 'aaa.', '###.', '.###', '.###', '.###'] },
    { u: 0.43, sweep: 2, ox: -1, rows: ['..a.', '.aaa', '.###', '###.', '###.', '###.'] },
  ],
};
/** A crystal's pixels, compiled once: x (from its centre column), y (0 = the sunk row, up is -), class (1..8: '#fabcABC'). */
const CRYSTAL_PX: Readonly<Record<Stage, readonly Int8Array[]>> = (() => {
  const cls = '#fabcABC';
  const out = {} as Record<Stage, Int8Array[]>;
  for (const st of ['baby', 'young', 'adult', 'elder'] as const) {
    out[st] = CRYSTALS[st].map((c) => {
      const px: number[] = [];
      c.rows.forEach((row, r) => {
        for (let i = 0; i < row.length; i++) {
          const k = cls.indexOf(row[i]);
          if (k >= 0) px.push(c.ox + i, r - (c.rows.length - 1), k + 1);
        }
      });
      return Int8Array.from(px);
    });
  }
  return out;
})();

/** Nose horn per stage: length, root and tip radius (3.4). */
const NOSE: Readonly<Record<Stage, { len: number; r0: number; r1: number }>> = {
  baby: { len: 2, r0: 1.5, r1: 1.2 },
  young: { len: 4, r0: 2, r1: 1.5 },
  adult: { len: 5, r0: 3, r1: 1.5 },
  elder: { len: 5, r0: 3, r1: 1.5 },
};

/** The breath's wind-up / snap / sustain / recover per stage (4.2), which the renderers key their beats on. */
// FIRST PASS (elder): the elder's beats (anims.ts elderBreath: 22 / 6 / 32 / 24, never failing) with the adult's
// roar in them; the finale's one ring of rock dust (4.2, cue 32 to 44) is not drawn yet
const BREATH_BEATS: Readonly<Record<Stage, readonly [number, number, number, number]>> = {
  baby: [10, 4, 8, 14], young: [14, 5, 22, 15], adult: [18, 6, 30, 16], elder: [22, 6, 32, 24],
};
/** The roar's jaw at the snap (3.4: 25; young 22; the baby's "ptoo" at its 20 minimum), and the proud chin after it. */
const ROAR_JAW: Readonly<Record<Stage, number>> = { baby: 20, young: 22, adult: 25, elder: 25 };
const PROUD_CHIN = -6;
/** The tell's two glow.hi flashes of the crystals (3.4: 4 f, twice), cue windows [from, to) before the snap. */
const FLASH: Readonly<Record<Stage, readonly number[]>> = {
  baby: [-9, -6, -4, -1], young: [-12, -8, -6, -2], adult: [-16, -12, -8, -4], elder: [-20, -15, -10, -5],
};
// ---------- ground space: where floor-level effects live ----------

const PT = { x: 0, y: 0 }, PG = { x: 0, y: 0 };

/**
 * From ROOT space into GROUND space: origin on the ground point under the body centre (a whole device pixel), one
 * unit = one sprite pixel along facing, y down, with the root's rotation, offset, squash and flip taken back out.
 * Dust and pebbles live here, so they sit on the floor line (y = 0) in whole pixels whatever the sprite does (a
 * waddle's root rotation, the roll's flip, the growl's shake). Pair with ctx.restore().
 */
function enterGround(ctx: CanvasRenderingContext2D, rig: DragonRig): void {
  const t = rig.tf;
  ctx.save();
  if (t.rot) ctx.rotate(-t.rot * RAD);
  ctx.translate(-t.rx, -t.ry);
  ctx.scale(1 / t.fs, 1 / t.ss);
  ctx.scale(rig.facing * rig.pxScale, rig.pxScale);
}
/** A root-space point in ground space (enterGround), into `out`. */
function rootToGround(rig: DragonRig, X: number, Y: number, out: { x: number; y: number }): { x: number; y: number } {
  const t = rig.tf;
  out.x = t.fs * (t.rx + X * t.c - Y * t.s) / (rig.facing * rig.pxScale);
  out.y = t.ss * (t.ry + X * t.s + Y * t.c) / rig.pxScale;
  return out;
}
/** A body-space point in ground space (body space: origin rig.j.body, rotated by the body pitch). */
function bodyToGround(rig: DragonRig, x: number, y: number, out: { x: number; y: number }): { x: number; y: number } {
  localToRootPt(rig.j.body.x, rig.j.body.y, rig.j.bodyAng, x, y, PT);
  return rootToGround(rig, PT.x, PT.y, out);
}
/** From body space (bodyOver) back to root space. Wrap it in save / restore. */
function bodyToRootSpace(ctx: CanvasRenderingContext2D, rig: DragonRig): void {
  ctx.rotate(-rig.j.bodyAng * RAD); ctx.translate(-rig.j.body.x, -rig.j.body.y);
}

/**
 * A pebble in whole pixels (ground space): a `w` x `w` fill of `hex` with its top-left at (x, y) in a 1 px ink ring
 * whose corners are cut, so it reads as a round stone, not a tile (pebbles are inked: 5.4). `facet`: from 4 px (5.2,
 * like a crystal's facet), its bottom row and right column in the fill's shadow tone, a lit 3 x 3 top-left face (the
 * roar's thrown stones: flat 3 x 3, they were brown dots).
 */
function pebble(ctx: CanvasRenderingContext2D, rig: DragonRig, x: number, y: number, w: number, hex: string, facet = false): void {
  x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = rig.col(rig.outline);
  ctx.fillRect(x - 1, y, w + 2, w); ctx.fillRect(x, y - 1, w, w + 2);
  ctx.fillStyle = rig.col(hex); ctx.fillRect(x, y, w, w);
  if (!facet || w < 4 || rig.override) return;
  ctx.fillStyle = tones(rig, hex).sh; ctx.fillRect(x + 1, y + w - 1, w - 1, 1); ctx.fillRect(x + w - 1, y + 1, 1, w - 2);
}

/** Frames a kick of dust lives. */
const DUST_LIFE = 12;
/** A dust bit's height off the floor over its life: up and back down, whole pixels. */
const DUST_RISE: readonly number[] = [1, 1, 2, 2, 3, 3, 3, 3, 2, 2, 1, 1];
/**
 * A kick of dust at ground x `gx` (a paw landing, a belly or a shell settling): `n` pairs of 2 x 2 bits of opaque
 * `scale` thrown out to both sides of a contact `half` px wide, rising and settling as they spread 1 px every 2 f,
 * then gone (5.2: 2 x 2 for their whole life; 5.4: opaque, never faded by alpha: rock's dust is 27 % from the straw
 * floor). Only the first `bits` bits are drawn (what the ambient budget granted: each bit is a particle). Ground
 * space. Nothing outside 0 <= age < DUST_LIFE.
 */
function kickDust(ctx: CanvasRenderingContext2D, rig: DragonRig, gx: number, half: number, age: number, n: number, bits: number): void {
  if (age < 0 || age >= DUST_LIFE) return;
  const a = age | 0, out = half + 1 + (a >> 1);
  ctx.fillStyle = rig.col(rig.pal.scale);
  for (let i = 0; i < n && bits > 0; i++) {
    const dx = out + i * 3, y = -2 - DUST_RISE[a] + i;
    ctx.fillRect(Math.round(gx - dx) - 2, y, 2, 2);
    if (--bits > 0) { ctx.fillRect(Math.round(gx + dx), y, 2, 2); bits--; }
  }
}

/**
 * A pebble thrown at t = 0 from (x0, y0) with velocity (vx, vy) px/f under gravity 0.15 px/f^2 (3.4), ground space,
 * with its centre resting at `floor`: it lands, bounces ONCE (0.4 of its speed), rolls a few px to a stop and lies
 * there. Into `out`.
 */
function ballistic(t: number, x0: number, y0: number, vx: number, vy: number, floor: number, out: { x: number; y: number }): void {
  const g = 0.15;
  const t1 = (-vy + Math.sqrt(Math.max(0, vy * vy + 2 * g * (floor - y0)))) / g;
  if (t <= t1) { out.x = x0 + vx * t; out.y = Math.min(floor, y0 + vy * t + g * t * t / 2); return; }
  const vb = -0.4 * (vy + g * t1), tb = -2 * vb / g, xb = x0 + vx * t1, u = t - t1;
  if (u <= tb) { out.x = xb + vx * 0.6 * u; out.y = Math.min(floor, floor + vb * u + g * u * u / 2); return; }
  const w = Math.min(u - tb, 8), v = vx * 0.3;
  out.x = xb + vx * 0.6 * tb + v * w - v * w * w / 16; out.y = floor;
}

// ---------- the dome ----------

const ARC_X = new Float32Array(12), ARC_Y = new Float32Array(12);
/** The last corner index of the dome's top arc as bodyOver last built it (the crumb rolls down it). */
let ARC_N = 0;
/** Facet tones, rear (lit) -> front: the dome is toned in thirds, lit rear facets, base top, shaded front (3.4). */
const TONE3: readonly (readonly number[])[] = [[0], [1, 0, -1], [], [1, 0, -1], [], [1, 1, 0, -1, -1]];

/**
 * The dome's top edge at u (-1 = rear end .. 1 = front end): the body's own back line lifted by a thickness that
 * is `rise` at the centre and tapers to 1.5 px at the ends, so the shell rests ON the back and slopes down with it
 * (an elliptical arc stands its ends vertical: a lampshade), a crown that stays convex over the straight run of the
 * back. `out` pushes the point a little further (the ridge vertex).
 */
function domePt(rig: DragonRig, cx: number, rx: number, rise: number, u: number, out: number, i: number): void {
  const x = cx + u * rx;
  ARC_X[i] = x; ARC_Y[i] = backLineY(rig, x) - 1.5 - (rise - 1.5 + out) * Math.pow(Math.max(0, 1 - u * u), 0.85);
}

/** y of the dome's top contour at x (on the polygon ARC[0..n]), for standing crystals on it. */
function domeTopY(x: number, n: number): number {
  for (let i = 0; i < n; i++) {
    const x0 = ARC_X[i], x1 = ARC_X[i + 1];
    if ((x - x0) * (x - x1) <= 0) return ARC_Y[i] + (ARC_Y[i + 1] - ARC_Y[i]) * ((x - x0) / ((x1 - x0) || 1));
  }
  return x < ARC_X[0] ? ARC_Y[0] : ARC_Y[n];
}

/** The pet's bond, 0..1 (DrawDragonOpts.bond, 1 when the owner passes none): the crystal count grows with it (3.4). */
function bondOf(info: DragonInfo): number {
  return Math.max(0, Math.min(1, info.bond));
}
/** How many of the stage's crystals the bond has grown: >= 1 from hatching (the seed), all of them at a full bond. */
function crystalCount(stage: Stage, bond: number): number {
  const n = CRYSTALS[stage].length;
  return Math.max(1, Math.min(n, Math.ceil(bond * n - 1e-6)));
}

/**
 * bible 3.4 "The cue: the boulder dome". Body space, after the body; the near wing is drawn just before this
 * (wingUnderBodyOver) so the rim tucks it under.
 *
 * ONE convex arc (3.0), never teeth: the facet corners sit on the back line lifted by the dome's thickness, and an
 * odd facet count gets a ridge vertex over its middle facet so no flat lid runs across the top. Facets are tone
 * steps with no line (form within one material): planes radiating from a point under the dome, toned in thirds --
 * marking.hi on the lit rear facets, the base on top, marking.sh on the front. The baby's single facet is a smooth
 * pebble in one tone. The UPSET tuck (young, adult; act ACT.upset, tuck 1: the head group was drawn before this)
 * rolls the dome's front forward over the head, down to the floor ahead of the snout, as its intro plays: a
 * boulder, one eye peeking out of the slit under its raised rim (hoodPoints). The crystals stand on the rear third
 * (drawCrystals); the hungry tell's pebble pile lies on the floor in front of the paws (begPile).
 */
const bodyOver: ElementDraw = (ctx, rig, pose, info) => {
  TOOK = 0;
  const st = info.stage, D = DOME[st];
  const cx = Math.round((rig.hipB.x + rig.chestB.x) / 2 - 1);
  const back = backLineY(rig, cx);
  const rim = back + D.rise * 0.55 + 2;
  const rx = D.w / 2 + 2, F = D.facets, pebbleDome = F === 1;
  // corners at the facet boundaries (rear end -> front end), plus the ridge vertex over the middle facet
  let n = 0;
  const mid = F >> 1;
  const steps = pebbleDome ? 8 : F;
  for (let f = 0; f <= steps; f++) {
    domePt(rig, cx, rx, D.rise, -1 + (2 * f) / steps, 0, n++);
    if (!pebbleDome && f === mid) domePt(rig, cx, rx, D.rise, 0, 0.7, n++);
  }
  n--;
  ARC_N = n;
  // the upset hood, grown over the tuck's intro (young, adult: the baby hides in its bun instead)
  const g = pose.act === ACT.upset && !pebbleDome ? Math.max(0, Math.min(1, pose.cue / HOOD_GROW[st])) : 0;
  const h0 = HOOD_FROM[st];
  if (g > 0) hoodPoints(rig, info, g, h0, n, cx, rx, back, rim);
  if (pose.act === ACT.beg && !rig.override) begPile(ctx, rig, info.stage);
  // (the hood lies over the head: it keeps off the eye's largest box + 1 px, as the rig's own effects do: E9)
  if (g > 0) clipOffEyeBody(ctx, rig, info);
  ctx.beginPath();
  ctx.moveTo(ARC_X[0], ARC_Y[0]);
  if (g > 0) {
    for (let i = 1; i <= h0; i++) ctx.lineTo(ARC_X[i], ARC_Y[i]);
    for (let i = 0; i < HOOD_N; i++) ctx.lineTo(HX[i], HY[i]);
  } else for (let i = 1; i <= n; i++) ctx.lineTo(ARC_X[i], ARC_Y[i]);
  // the rim, front end -> rear end: 1 px under the back line at the ends, sagging over the flank to `rim` mid-body
  // (under the hood, it takes over from the hood's own rim at HOOD_JOIN)
  for (let k = 1; k <= 8; k++) {
    const u = 1 - k / 4, x = cx + u * rx;
    if (g > 0 && u > HOOD_JOIN + 1e-6) continue;
    ctx.lineTo(x, backLineY(rig, x) + 1 + (rim - back - 1) * Math.sqrt(Math.max(0, 1 - u * u)));
  }
  ctx.closePath();
  outlinePath(ctx, rig);
  ctx.fillStyle = rig.col(info.pal.marking); ctx.fill();
  if (!rig.override && !pebbleDome) {
    ctx.save(); ctx.clip();
    const t = tones(rig, info.pal.marking), tone = TONE3[F] || TONE3[3];
    // facet f spans corners [f, f + 1] (+1 past the ridge); its plane radiates from a point under the dome. A run
    // of facets in one tone is ONE plane: two planes meeting edge to edge left a faint anti-aliased seam of the
    // base between them
    const ox = cx, oy = rim + D.rise;
    for (let f = 0, i = 0; f < F; f++) {
      const i0 = i;
      let i1 = i + (f === mid ? 2 : 1);
      while (f + 1 < F && tone[f + 1] === tone[f]) { f++; i1 += f === mid ? 2 : 1; }
      i = i1;
      if (!tone[f]) continue;
      ctx.fillStyle = tone[f] > 0 ? t.hi : t.sh;
      ctx.beginPath(); ctx.moveTo(ox, oy);
      if (g > 0 && tone[f] < 0) {
        // the front third ROLLED FORWARD: the crest runs on over the head lit, and everything ahead of the facet
        // line through the hood's shoulder is the front facet's shade -- so the shell reads as tipped over the head,
        // one facet step (base | shade) turning its top into its front. (Morphed from the dome's own first shaded
        // corner, as the hood is.)
        const sc = SHADE_FROM[st], qx = ARC_X[sc] + (HX[HOOD_SHOULDER] - ARC_X[sc]) * g, qy = ARC_Y[sc] + (HY[HOOD_SHOULDER] - ARC_Y[sc]) * g;
        ctx.lineTo(ox + (qx - ox) * 3, oy + (qy - oy) * 3);
        ctx.lineTo(ox + 200, oy - 200); ctx.lineTo(ox + 200, oy + 200); ctx.lineTo(ox, oy + 200);
        ctx.closePath(); ctx.fill();
        continue;
      }
      // reach past the outline so the clip trims the plane to it
      ctx.lineTo(ox + (ARC_X[i0] - ox) * 1.5, oy + (ARC_Y[i0] - oy) * 1.5);
      for (let k = i0; k <= i1; k++) ctx.lineTo(ARC_X[k] + (ARC_X[k] - ox) * 0.2, ARC_Y[k] + (ARC_Y[k] - oy) * 0.2);
      ctx.lineTo(ox + (ARC_X[i1] - ox) * 1.5, oy + (ARC_Y[i1] - oy) * 1.5);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  if (g > 0) ctx.restore();
  // flipped onto its back (the roll-over happy) the crystals are pressed under the shell against the floor
  if (rig.tf.ss > 0) drawCrystals(ctx, rig, pose, info, n);
};

// ---------- the upset tuck's hood ----------

/** The corner the hood rolls forward from: the dome's ridge vertex (its crest). */
const HOOD_FROM: Readonly<Record<Stage, number>> = { baby: 0, young: 2, adult: 3, elder: 3 };
/** The dome's first shaded corner (TONE3's front third): where its shade starts before the hood rolls over. */
const SHADE_FROM: Readonly<Record<Stage, number>> = { baby: 0, young: 3, adult: 4, elder: 4 };
/** The hood's shoulder: the outer arc's point where the lit top turns into the shaded front (an HX index). */
const HOOD_SHOULDER = 4;
/** Frames of the tuck's intro over which the hood rolls forward (upsetTuck's intro). */
const HOOD_GROW: Readonly<Record<Stage, number>> = { baby: 1, young: 13, adult: 16, elder: 20 };
/** How far (deg) the hood is swung up about the crest when it starts to roll forward (hoodPoints). */
const HOOD_SWING = 45;
/** Where along the dome (u, -1 rear .. 1 front) the hood's own rim hands over to the dome's rim. */
const HOOD_JOIN = 0.25;
/** The hood's outline after its first corner, body space: 10 points of its outer arc, then 6 of its rim. */
const HOOD_OUT = 10, HOOD_N = HOOD_OUT + 6;
const HX = new Float32Array(HOOD_N), HY = new Float32Array(HOOD_N);
/** The full hood's outline in ROOT space (hoodPoints), before it is morphed from the dome's own front. */
const RX = new Float32Array(HOOD_N), RY = new Float32Array(HOOD_N);
const PB = { x: 0, y: 0 };

/** A root-space point in body space (rig.j.body, pitched), into `out`. */
function rootToBody(rig: DragonRig, X: number, Y: number, out: { x: number; y: number }): { x: number; y: number } {
  const J = rig.j, c = Math.cos(J.bodyAng * RAD), s = Math.sin(J.bodyAng * RAD), dx = X - J.body.x, dy = Y - J.body.y;
  out.x = dx * c + dy * s; out.y = -dx * s + dy * c;
  return out;
}

/** y of a cubic Bezier (x monotonic in t) at x, by bisection. */
function bezYAt(x: number, x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): number {
  let lo = 0, hi = 1;
  for (let k = 0; k < 24; k++) {
    const t = (lo + hi) / 2, u = 1 - t;
    if (u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3 < x) lo = t; else hi = t;
  }
  const t = (lo + hi) / 2, u = 1 - t;
  return u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3;
}

/**
 * The UPSET tuck's hood (3.4; young, adult; act ACT.upset): the dome's front third ROLLS FORWARD over the lowered
 * head -- one convex arc on from the dome's crest, over the crown, the nose horn and the snout, down to a round lip
 * 2 px off the floor ahead of the snout tip: a boulder, with the head inside it, its lit top turning into its shaded
 * front at one facet step (bodyOver). Its rim runs back from
 * the lip under the snout, climbs the front wall 2 px ahead of the eye and runs back over it RAISED (rising 6 deg
 * toward the front, its ink >= 2 px clear of the eye's largest box), to hand over to the dome's rim over the
 * shoulder: a slit, where one `sad` eye peeks out from under the shell and nothing covers it (ledger E9). Built from
 * the joints of this frame, in root space, then carried into body space and MORPHED from the dome's own front
 * (g 0: the plain dome .. 1: the full hood) so the shell rolls forward over the intro instead of appearing.
 */
function hoodPoints(rig: DragonRig, info: DragonInfo, g: number, h0: number, n: number, cx: number, rx: number, back: number,
  rim: number): void {
  const J = rig.j, e = info.eye, s = rig.dims.head.snout, T6 = Math.tan(6 * RAD);
  // the eye's largest box + 1 px (the rig's clip), half a pixel more for the face space's snap, root space
  const hw = (e.w + 2) / 2 + 0.5, hh = (e.h + 2) / 2 + 0.5, ex = J.eye.x, ey = J.eye.y;
  const wall = ex + hw + 3, xb = ex - hw - 2;
  const y0 = ey - hh - 3 - T6 * (wall - (ex - hw));
  // what the arc must clear: the nose horn's tip (nearHead's geometry), the crown and the snout's tip
  const len = NOSE[info.stage].len + (info.sp.lenVar || 0), a = 60 * RAD;
  cranToRootPt(rig, s.x1 + s.r1 * Math.cos(a) - 0.5 + Math.cos(a) * (len + 1), s.y1 - s.r1 * Math.sin(a) + 1 - Math.sin(a) * (len + 1), PT);
  const hx = PT.x, hy = PT.y;
  cranToRootPt(rig, s.x1 + s.r1, s.y1, PG);
  const lip = Math.max(PG.x, hx) + 3, lipY = -3.5;
  const topX = J.cran.x, topY = J.cran.y - rig.dims.head.cranR - rig.dims.head.brow;
  // the arc: a cubic from the dome's crest, leaving it level along the body (the dome rises to its ridge, so the
  // turn is convex: no step) and arriving straight down at the lip
  localToRootPt(J.body.x, J.body.y, J.bodyAng, ARC_X[h0], ARC_Y[h0], PB);
  const x0 = PB.x, y0a = PB.y, tx = Math.cos(J.bodyAng * RAD), ty = Math.sin(J.bodyAng * RAD);
  const k1 = 0.55 * (lip - x0) / Math.max(0.3, tx);
  const x1 = x0 + tx * k1;
  let y1 = y0a + ty * k1, y2 = y1;
  // raise the shoulder until the arc clears the horn's tip and the crown by 2 px
  for (let it = 0; it < 4; it++) {
    const dh = Math.max(bezYAt(hx, x0, y0a, x1, y1, lip, y2, lip, lipY) - (hy - 2), bezYAt(topX, x0, y0a, x1, y1, lip, y2, lip, lipY) - (topY - 2));
    if (dh <= 0) break;
    y2 -= dh * 1.5; y1 = Math.min(y1, y2 + 1);
  }
  for (let k = 1; k <= HOOD_OUT; k++) {
    const t = k / HOOD_OUT, u = 1 - t;
    RX[k - 1] = u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * lip + t * t * t * lip;
    RY[k - 1] = u * u * u * y0a + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * lipY;
  }
  // the rim: the lip's round corner, back under the snout 2 px off the floor, up the wall, back over the eye
  let i = HOOD_OUT;
  RX[i] = lip - 1; RY[i++] = -2.2;
  RX[i] = wall + 1.5; RY[i++] = -2;
  RX[i] = wall; RY[i++] = -3.5;
  RX[i] = wall; RY[i++] = y0 + 1.5;
  RX[i] = wall - 1.5; RY[i++] = y0 + T6 * 1.5;
  RX[i] = xb; RY[i++] = y0 + T6 * (wall - xb);
  // into body space, morphed from the dome's own front: its front corners (resampled along their length) and its
  // rim from the front end to HOOD_JOIN
  const sw = Math.cos((1 - g) * HOOD_SWING * RAD), sn = Math.sin((1 - g) * HOOD_SWING * RAD);
  let total = 0;
  for (let k = h0; k < n; k++) total += Math.hypot(ARC_X[k + 1] - ARC_X[k], ARC_Y[k + 1] - ARC_Y[k]);
  for (let k = 0, seg = h0, acc = 0; k < HOOD_N; k++) {
    let nx: number, ny: number;
    if (k < HOOD_OUT) {
      const want = total * (k + 1) / HOOD_OUT;
      while (seg < n - 1 && acc + Math.hypot(ARC_X[seg + 1] - ARC_X[seg], ARC_Y[seg + 1] - ARC_Y[seg]) < want) {
        acc += Math.hypot(ARC_X[seg + 1] - ARC_X[seg], ARC_Y[seg + 1] - ARC_Y[seg]); seg++;
      }
      const L = Math.hypot(ARC_X[seg + 1] - ARC_X[seg], ARC_Y[seg + 1] - ARC_Y[seg]) || 1, f = Math.min(1, (want - acc) / L);
      nx = ARC_X[seg] + (ARC_X[seg + 1] - ARC_X[seg]) * f; ny = ARC_Y[seg] + (ARC_Y[seg + 1] - ARC_Y[seg]) * f;
    } else {
      const u = 1 - (1 - HOOD_JOIN) * (k - HOOD_OUT + 1) / 7;
      nx = cx + u * rx; ny = backLineY(rig, nx) + 1 + (rim - back - 1) * Math.sqrt(Math.max(0, 1 - u * u));
    }
    // (a visor, not a slide: the hood swings down about the crest as it grows, so its wall and rim close over the
    // face from above and in front and never sweep through the eye)
    const vx = RX[k] - x0, vy = RY[k] - y0a;
    rootToBody(rig, x0 + vx * sw + vy * sn, y0a - vx * sn + vy * sw, PB);
    // (the window's back end never runs behind the hand-over to the dome's rim)
    if (k === HOOD_N - 1) PB.x = Math.max(PB.x, cx + HOOD_JOIN * rx + 1.5);
    HX[k] = nx + (PB.x - nx) * g; HY[k] = ny + (PB.y - ny) * g;
  }
}

/**
 * Clip (body space in, body space out) to everything but the eye's largest box + 1 px: the rig's own rule for what
 * it draws after the head (rig.ts clipOffEye), for the hood that lies over it. Built in face space, where the eye is
 * a pixel construction, and walked back by hand, since a restore would drop the clip. Pair with ONE ctx.restore().
 */
function clipOffEyeBody(ctx: CanvasRenderingContext2D, rig: DragonRig, info: DragonInfo): void {
  const J = rig.j, t = rig.tf, gw = info.eye.w + 2, gh = info.eye.h + 2, X = J.eye.x, Y = J.eye.y;
  enterFaceFromLocal(ctx, rig, J.body.x, J.body.y, J.bodyAng, X, Y);
  ctx.beginPath(); ctx.rect(-400, -400, 800, 800); ctx.rect(-Math.floor(gw / 2), -Math.floor(gh / 2), gw, gh);
  ctx.clip('evenodd');
  const dx = t.fs * (t.rx + X * t.c - Y * t.s), dy = t.ss * (t.ry + X * t.s + Y * t.c);
  ctx.scale(1 / (rig.facing * rig.pxScale), 1 / (t.ss < 0 ? -rig.pxScale : rig.pxScale));
  ctx.translate(-Math.round(dx), -Math.round(dy));
  ctx.scale(t.fs, t.ss); ctx.translate(t.rx, t.ry); ctx.rotate(t.rot * RAD);
  ctx.translate(J.body.x, J.body.y); ctx.rotate(J.bodyAng * RAD);
}

/** Scratch for the ambient glint's schedule (drawCrystals). */
const GA = new Float32Array(2), GI = new Int32Array(2);
/** One crystal rasterised this frame (drawCrystals): a 16 x 16 grid of classes, the crystal's base at (GX, GY). */
const GRID = new Uint8Array(256), GX = 7, GY = 12;
/** Class (1..8, CRYSTAL_PX) -> colour this frame (drawCrystals fills it). */
const CCOL: string[] = ['', '', '', '', '', '', '', '', ''];
/**
 * Ambient particles this dragon's bodyOver took from the budget this frame (the crystal twinkle), so its ambient
 * renderer, which runs later in the same dragon's draw, stays within the per-dragon cap (5.4).
 */
let TOOK = 0;

/**
 * The crystals (3.4): flat `glow` emitters with ink (D20: never banded), standing on the dome's rear third, as many
 * as the bond has grown. They are the MOOD GAUGE (D7; the dome itself is always 100 %):
 *   - mood <= -0.3 and asleep: banked in `glow.sh`, 52 % under the lit colour, still inked, so the count still reads;
 *   - lit (`glow`), the 4 x 7 carrying its one glow.hi facet on the lit side (only a crystal >= 4 px wide: 5.2);
 *   - mood >= 0.5: a catchlight glint travels the cluster rear to front, 8 f on each crystal's tip, round and round;
 *     a lone seed's glint steps between its tip and its middle every 8 f -- so a happy rock sparkles in ANY single
 *     frame, and a happy lone seed never matches mood 0;
 *   - lit, any mood: a single glint twinkles on one crystal's tip every 200 +- 60 f (the ambient glint; it takes one
 *     of the dragon's ambient particles, and its interval stretches with a crowd: 5.4).
 * The breath's tell flashes them glow.hi for 4 f, twice; the upset tuck flickers them glow.sh <-> glow every 12 f.
 * Each is a pixel construction in face space (device-aligned: crystals grow UP whatever the body's pitch), its row 0
 * sunk into the dome's line where it stands, so a crystal on the sloping rear never floats off it. Only a dome
 * tipped past 12 deg (the roll-over's rocking and flip-back) leans them with it, row by row, so they never stand
 * screen-upright down a steep flank. The ink is the 4-neighbour ring of the (leaned) glow, so the points' corners
 * stay open and read pointed.
 */
function drawCrystals(ctx: CanvasRenderingContext2D, rig: DragonRig, pose: DragonPose, info: DragonInfo, n: number): void {
  const st = info.stage, list = CRYSTALS[st], pxs = CRYSTAL_PX[st], count = crystalCount(st, bondOf(info));
  const m = info.mood, J = rig.j, T = tones(rig, info.pal.glow);
  const c = pose.cue, fl = FLASH[st];
  const tell = pose.act === ACT.breath && ((c >= fl[0] && c < fl[1]) || (c >= fl[2] && c < fl[3]));
  const upset = pose.act === ACT.upset;
  const lit = !tell && (upset ? Math.floor(info.tick / 12) % 2 === 1 : m > -0.3 && !info.asleep);
  const col = rig.col(tell ? T.hi : lit ? info.pal.glow : rig.moodT.banked);
  // which crystal glints now, and where: the happy sweep, else the ambient twinkle (-1 = none)
  let glint = -1, spot = 1;
  if (lit && !upset && !rig.override) {
    if (m >= 0.5) {
      const k = Math.floor(info.tick / 8);
      if (count === 1) { glint = list[0].sweep; spot = k % 2 ? 2 : 1; } else glint = k % count;
    } else if (liveSpawns(info.seed + 5, info.tick, 200 * rig.budget.stretch, 60, 8, GA, GI) > 0 && rig.budget.take(rig.slot, 1)) {
      TOOK = 1;
      glint = list[GI[0] % count].sweep;
    }
  }
  // (the grown crystals' sweep places are always 0 .. count - 1: the seed is 1 and the rear crystal 0, grown first)
  const hi = lit && !rig.override ? rig.col(T.hi) : col;
  CCOL[1] = col; CCOL[2] = hi;
  // the lean: a dome tipped past 12 deg carries its crystals over with it (row y shifts -y * tan)
  const tilt = J.bodyAng + rig.tf.rot, lean = Math.abs(tilt) > 12 ? Math.tan(tilt * RAD) : 0;
  const x0 = ARC_X[0], span = ARC_X[n] - ARC_X[0], ink = rig.col(rig.outline), cat = rig.col(DRAGON_SHARED.catchlight);
  for (let i = 0; i < count; i++) {
    const cr = list[i], px = pxs[i], on = glint === cr.sweep;
    CCOL[3] = on && spot === 1 ? cat : col; CCOL[4] = on && spot === 2 ? cat : col; CCOL[5] = on ? cat : col;
    CCOL[6] = on && spot === 1 ? cat : hi; CCOL[7] = on && spot === 2 ? cat : hi; CCOL[8] = on ? cat : hi;
    // rasterise the (leaned) crystal into the grid
    GRID.fill(0);
    for (let k = 0; k < px.length; k += 3) {
      const y = px[k + 1], x = px[k] + Math.round(-y * lean);
      const gx = x + GX, gy = y + GY;
      if (gx >= 1 && gx < 15 && gy >= 1 && gy < 15) GRID[gy * 16 + gx] = px[k + 2];
    }
    const bx = Math.round(x0 + span * cr.u);
    // stand it on the dome's top line at its centre (y = 0 in face space)
    localToRootPt(J.body.x, J.body.y, J.bodyAng, bx, domeTopY(bx, n), PT);
    enterFaceFromLocal(ctx, rig, J.body.x, J.body.y, J.bodyAng, PT.x, PT.y);
    // the ink ring: every empty cell with a glow cell beside it (4-neighbour), in row runs
    ctx.fillStyle = ink;
    for (let gy = 0; gy < 16; gy++) {
      let run = -1;
      for (let gx = 0; gx <= 16; gx++) {
        let edge = false;
        if (gx < 16 && !GRID[gy * 16 + gx]) {
          edge = (gx > 0 && GRID[gy * 16 + gx - 1] > 0) || (gx < 15 && GRID[gy * 16 + gx + 1] > 0)
            || (gy > 0 && GRID[(gy - 1) * 16 + gx] > 0) || (gy < 15 && GRID[(gy + 1) * 16 + gx] > 0);
        }
        if (edge && run < 0) run = gx;
        else if (!edge && run >= 0) { ctx.fillRect(run - GX, gy - GY, gx - run, 1); run = -1; }
      }
    }
    // the glow, in row runs of one colour
    for (let gy = 0; gy < 16; gy++) {
      let run = -1, rc = '';
      for (let gx = 0; gx <= 16; gx++) {
        const v = gx < 16 ? GRID[gy * 16 + gx] : 0, cc = v ? CCOL[v] : '';
        if (cc !== rc) {
          if (run >= 0) { ctx.fillStyle = rc; ctx.fillRect(run - GX, gy - GY, gx - run, 1); }
          run = cc ? gx : -1; rc = cc;
        }
      }
    }
    ctx.restore();
  }
}

// ---------- the hungry tell's pebble pile ----------

/** The beg crouch per stage: body pitch and settle; the stare's and the lick's head (see begRock). */
const BEG: Readonly<Record<Stage, { rot: number; settle: number }>> = {
  baby: { rot: 20, settle: 3 }, young: { rot: 6, settle: 2 }, adult: { rot: 6, settle: 2.5 }, elder: { rot: 6, settle: 2.5 },
};
/** The baby's beg head poses (no neck to fit: it bows): [body rot, a0, head] for the stare and the lick. */
const BABY_STARE = [16, 10, 8] as const, BABY_LICK = [22, 12, 13] as const;
/** The pile's top, px above the floor (the 3 x 3 in its ink ring, resting on the two 2 x 2), and the lick / stare heights. */
const PILE_TOP = 7, LICK_Y = -(PILE_TOP + 1), STARE_Y = -(PILE_TOP + 6);

/** A head placement: neck offsets, head pitch, and where a cranium-space point lands (root space). */
const HP = { a0: 0, a1: 0, head: 0, x: 0, y: 0 };

/**
 * Where cranium point (px, py) lands in ROOT space with the body settled `settle` px and pitched `rot` and the neck
 * offsets (a0, a1) and head pitch `head` of a pose: the rig's own neck model (rig.ts computeDragonJoints: FK from the
 * neck root on the chest, then the head), unsnapped and without its floor lifts. Into HP.x / HP.y. Allocation-free:
 * the renderer and the anim builder share it, so the pebble pile lies exactly where the tongue reaches.
 */
function headPoint(d: DragonDims, settle: number, rot: number, a0: number, a1: number, head: number, px: number, py: number): void {
  const N = d.neck, H = d.head, bc = Math.cos(rot * RAD), bs = Math.sin(rot * RAD);
  const by = -d.bodyY + settle;
  let x = N.root[0] * bc - N.root[1] * bs, y = by + N.root[0] * bs + N.root[1] * bc, off = 0;
  for (let k = 0; k < N.n; k++) {
    off += k === 0 ? a0 : a1;
    const e = (N.rest[k] - off - rot) * RAD;
    x += Math.cos(e) * N.len; y -= Math.sin(e) * N.len;
  }
  const ha = (N.headPitch + a0 + (N.n > 1 ? a1 : 0) + head + rot) * RAD, hc = Math.cos(ha), hs = Math.sin(ha);
  const ox = H.fromNeck[0] + px, oy = H.fromNeck[1] + py;
  HP.a0 = a0; HP.a1 = a1; HP.head = head;
  HP.x = x + ox * hc - oy * hs; HP.y = y + ox * hs + oy * hc;
}

/**
 * The neck held straight at the elevation that puts cranium point (px, py) at root height `y`, the head at `headAng`
 * (+ = snout down) in the world: anims.ts neckFit, allocation-free and on the rig's own model (headPoint). Into HP.
 */
function fitHead(d: DragonDims, settle: number, rot: number, headAng: number, y: number, px: number, py: number): void {
  const N = d.neck, H = d.head, A = headAng * RAD, bc = Math.cos(rot * RAD), bs = Math.sin(rot * RAD);
  const ry = -d.bodyY + settle + N.root[0] * bs + N.root[1] * bc;
  const ox = H.fromNeck[0] + px, oy = H.fromNeck[1] + py, dy = ox * Math.sin(A) + oy * Math.cos(A);
  const reach = N.n * N.len;
  const e = Math.asin(Math.max(-1, Math.min(1, (ry + dy - y) / reach))) / RAD;
  const a0 = N.rest[0] - rot - Math.max(-75, Math.min(40, e)), a1 = N.n > 1 ? N.rest[1] - N.rest[0] : 0;
  headPoint(d, settle, rot, a0, a1, headAng - N.headPitch - a0 - a1 - rot, px, py);
}

/** The near front paw's toe at rest, root x: rig.ts's rest FK of the front leg (legRest) from the dims alone. */
function frontToe(d: DragonDims): number {
  const L = d.front, up = L.restUpper * RAD, lo = (L.restUpper + L.restLower + d.frontFix) * RAD;
  return d.gap / 2 + L.X + Math.sin(up) * L.upper + Math.sin(lo) * L.lower - L.r2 * 0.9 + L.pawW;
}

/**
 * Where the pebble pile lies, root x of its licked (top) pebble: where the snout comes down with the head pitched
 * 45 deg, but always >= 5 px ahead of the near front toe, so the pile's left pebble clears the paw by 1 px (young,
 * adult; the lick pose reaches out to it); the baby, with no neck to reach with, bows its big head over its paws
 * (drawn back 3 px), so its pile lies 4 px ahead of where that bow brings the snout: its tip touches the pile's side.
 */
function pileX(d: DragonDims, stage: Stage): number {
  const H = d.head, px = H.snout.x1, py = H.snout.y1 + H.snout.r1;
  if (stage === 'baby') {
    headPoint(d, BEG.baby.settle, BABY_LICK[0], BABY_LICK[1], 0, BABY_LICK[2], px, py);
    return Math.round(HP.x + 4);
  }
  fitHead(d, BEG[stage].settle, BEG[stage].rot, 45, LICK_Y, px, py);
  return Math.round(Math.max(frontToe(d) + 5, HP.x));
}

/**
 * The lick pose of a young or adult (the snout tip's underside 1 px over the pile's top): the head pitch whose
 * fitted neck brings the tip closest to the pile (pileX), searched once when the anim is built. Into HP.
 */
function lickPose(d: DragonDims, stage: Stage): number {
  const H = d.head, px = H.snout.x1, py = H.snout.y1 + H.snout.r1, B = BEG[stage], x = pileX(d, stage);
  let best = 40, err = 1e9;
  for (let a = 20; a <= 80; a += 2) {
    fitHead(d, B.settle, B.rot, a, LICK_Y, px, py);
    if (Math.abs(HP.x - x) < err) { err = Math.abs(HP.x - x); best = a; }
  }
  fitHead(d, B.settle, B.rot, best, LICK_Y, px, py);
  return best;
}

/**
 * The hungry tell's props (4.3 "stares at pebbles and licks a rock"): a little PILE of three pebbles in `marking`,
 * inked, on the floor ahead of the paws (pileX) -- two 2 x 2 side by side on the floor and the licked 3 x 3 resting
 * on them between, nestled 1 px into their tops: a triangle 7 px tall and wide (in a row they read as beads, "Ooo")
 * -- drawn under the head and the paws so the snout comes down onto the top one. The baby's is all 2 x 2 (6 px), just
 * ahead of its bowed snout: under the chin, its big head hid it. Called from bodyOver while act = beg.
 */
function begPile(ctx: CanvasRenderingContext2D, rig: DragonRig, stage: Stage): void {
  const x = pileX(rig.dims, stage), hex = rig.pal.marking;
  ctx.save(); bodyToRootSpace(ctx, rig); enterGround(ctx, rig);
  pebble(ctx, rig, x - 2, -3, 2, hex);
  pebble(ctx, rig, x + 1, -3, 2, hex);
  if (stage === 'baby') pebble(ctx, rig, x - 1, -5, 2, hex);
  else pebble(ctx, rig, x - 1, -(PILE_TOP - 1), 3, hex);
  ctx.restore(); ctx.restore();
}

// ---------- the head ----------

/**
 * bible 3.4 table "Nose horn": one blunt horn on the snout, up and forward. Cranium space. Young and adult root it
 * on the snout's rounded top-front, 2-3 px back from the tip (on the snout's end circle, 60 deg up from its front)
 * and lean it 60 deg up in head space (about 50 deg in the world at the rest pitch): rooted AT the tip beside the
 * nostril and angled 35 deg, it read as a cigar or a pipe. That root clears the eye's largest box (info.eye) by
 * >= 2 px. The baby's button snout has no top to root on: its 2 x 3 nub sits on the tip, leaning forward 35 deg
 * (behind the tip it sat on the eye's ring). (The rig also clips nearHead off the eye box.) The pet's seeded length
 * variant (2.8, sp.lenVar: +-1 px, 0 on babies) lengthens or shortens it: 3-6 px, under half the fans' height (3.0).
 */
const nearHead: ElementDraw = (ctx, rig, pose, info) => {
  const N = NOSE[info.stage], s = rig.dims.head.snout, len = N.len + (info.sp.lenVar || 0);
  const baby = info.stage === 'baby', t = (baby ? 35 : 60) * RAD;
  const x = s.x1 + s.r1 * (baby ? 0.55 : Math.cos(t)) - (baby ? 0 : 0.5), y = s.y1 - s.r1 * (baby ? 0.6 : Math.sin(t)) + (baby ? 0 : 1);
  celTaper(ctx, rig, x, y, x + Math.cos(t) * len, y - Math.sin(t) * len, N.r0, N.r1, info.pal.horn);
};

// ---------- the signature: Gravel Roar ----------

/** Each dust puff's ray off the jaw line, deg (+ = down): a cone, never a straight line of discs. */
const PUFF_RAY: readonly number[] = [2, -10, 11, -4, 16];
/**
 * The roar's puffs per stage: how many, the frames between their births (spread over the sustain's first ~20 f, so
 * the mouth is never open on nothing), how far each billows out past its 7 px start (eased: it rushes out and HOLDS,
 * 10-30 px from the mouth, through the sustain), and its top radius.
 */
const PUFFS: Readonly<Record<Stage, { n: number; every: number; reach: number; r1: number }>> = {
  baby: { n: 0, every: 1, reach: 0, r1: 0 }, young: { n: 3, every: 6, reach: 20, r1: 5 }, adult: { n: 5, every: 5, reach: 26, r1: 7 },
  elder: { n: 5, every: 5, reach: 26, r1: 7 },
};
/** Frames a roar puff lives: it grows over 18, holds, and shrinks away in 3 steps over the last 9. */
const PUFF_LIFE = 30;
/**
 * Each pebble's launch: vx, vy (px/f, - = up), delay after the snap (f) and size (px: the adult's 4 and 3 by turns,
 * the 4s faceted; all 3 x 3 flat, they were a spray of small brown dots beside fire's flame: the cast review, round 2).
 */
const PEB: readonly (readonly number[])[] = [[1.7, -1.1, 1, 4], [2.4, -0.6, 4, 3], [1.2, -1.5, 7, 4], [2.9, -0.3, 10, 3]];

/** The breath's last cue (its length from the snap): the lying pebbles shrink away over the 6 f before it. */
function breathEnd(st: Stage): number { const b = BREATH_BEATS[st]; return b[1] + b[2] + b[3]; }
/** A lying pebble's size at cue c: 3 x 3, then 2 x 2 over the breath's last 6 f, gone for its last 3 (never a pop). */
function pebbleSize(st: Stage, c: number): number { const e = breathEnd(st); return c < e - 6 ? 3 : c < e - 3 ? 2 : 0; }

/**
 * bible 3.4 "Signature: Gravel Roar", mouth space in, ground space out (the dust and the pebbles leave the head: they
 * travel in the world, sit on the floor line, never ride the head's jitter). The TELL is bodyOver's (the crystals
 * flash) and the anim's (the head lowers, the chest braces: gravelRoar). BLAST (cue >= 0): a cone of 5 dust puffs
 * (young 3), opaque `scale` discs, no ink, each on its own ray, born one every 5 f (young 6) through the sustain's
 * first 20 f so the open mouth always has dust coming out of it; each rushes out from 7 px (the head is `scale` too:
 * a puff on the snout vanished into it) and eases to a stop 26 px further (young 20), so the cloud BILLOWS and holds
 * 10-30 px from the mouth; growing r 3 -> 7 (young -> 5), sinking 0.1 px/f and never through the floor, then
 * shrinking away in 3 steps (never alpha: 5.4). 4 pebbles (young 2), 3 x 3 `marking` with ink, sprayed in a fan,
 * ballistic (g 0.15), one bounce, a short roll, lying where they stop until the breath's last 6 f, when they shrink
 * 3 x 3 -> 2 x 2 -> gone. BABY: "ptoo" -- a puff of cheek-dust (r 3 -> 2, 2 px clear of the snout, 8 f) and ONE
 * pebble that pops out in a little arc, bounces and rolls to a stop in front of its paws, shrinking away the same;
 * the anim then shows `happy`, chin up (proud).
 */
const breath: ElementDraw = (ctx, rig, pose, info) => {
  if (pose.act !== ACT.breath || pose.cue < 0 || rig.override) return;
  const c = pose.cue, st = info.stage, J = rig.j, baby = st === 'baby', ps = pebbleSize(st, c);
  ctx.save();
  mouthToRoot(ctx, rig, info.ang);
  enterGround(ctx, rig);
  rootToGround(rig, J.mouth.x, J.mouth.y, PG);
  const mx = PG.x, my = PG.y, a = J.mouthAng + rig.tf.rot, hex = info.pal.scale;
  if (baby) {
    // the "ptoo": one puff off the lips for 8 f, 2 px clear of the snout's tip (on the snout it vanished into it)
    if (c < 8) {
      const s = rig.dims.head.snout, r = c < 4 ? 3 : 2;
      cranToRootPt(rig, s.x1 + s.r1, s.y1, PT);
      rootToGround(rig, PT.x, PT.y, PT);
      disc(ctx, rig, Math.round(Math.max(PT.x, mx) + 2 + r), Math.round(my - 1), r, hex);
    }
    if (ps) {
      ballistic(Math.max(0, c - 1), mx + 1, my + 1, 0.6, -0.5, -2.5, PG);
      pebble(ctx, rig, PG.x - ps / 2, PG.y - ps / 2, ps, info.pal.marking);
    }
  } else {
    const P = PUFFS[st];
    // each puff ringed 1 px in the sand's shadow tone (under the disc, drawn 1 px larger): the cloud's lobes
    // overlap into a lumpy billow, and plain sand discs were a pale smudge 27 % from the straw floor
    const ring = tones(rig, hex).sh, adult = grown(st);
    for (let k = P.n - 1; k >= 0; k--) {
      const age = c - P.every * k;
      if (age < 0 || age >= PUFF_LIFE) continue;
      const q = 1 - age / PUFF_LIFE, ray = (a + PUFF_RAY[k]) * RAD, dist = 7 + P.reach * (1 - q * q);
      const grow = 3 + (P.r1 - 3) * Math.min(1, age / 18);
      const r = age < 21 ? Math.round(grow) : stepShrink((age - 21) / 9, grow);
      const x = mx + Math.cos(ray) * dist, y = Math.min(my + Math.sin(ray) * dist + 0.1 * age, -r - 2);
      if (adult && r > 0) disc(ctx, rig, Math.round(x), Math.round(y), r + 1, ring);
      disc(ctx, rig, Math.round(x), Math.round(y), r, hex);
    }
    const nb = adult ? 4 : 2, sv = adult ? 1 : 0.8;
    for (let k = 0; k < nb && ps; k++) {
      const p = PEB[k], t = c - p[2], w = adult ? ps + p[3] - 3 : ps;
      if (t < 0) continue;
      ballistic(t, mx + 1, my + 1, p[0] * sv, p[1], -2.5 - (w - 3) / 2, PG);
      pebble(ctx, rig, PG.x - w / 2, PG.y - w / 2, w, info.pal.marking, adult);
    }
  }
  ctx.restore(); ctx.restore();
};

// ---------- ambient: dust and the pebble crumb ----------

/** The idle's weight shifts (idleRock): the frames the near front paw sets down, per stage (the baby has none). */
// (FIRST PASS (elder): none -- the elder breathes the shared elder idle, its "hmm" every third loop; its weight shift
// is rock's to lay over it)
const SHUFFLE: Readonly<Record<Stage, readonly number[]>> = { baby: [], young: [127, 178], adult: [152, 212], elder: [] };

/** Frames the pebble crumb lives: rolling down the dome, dropping off its rear end, one bounce, lying a while. */
const CRUMB_LIFE = 80, CRUMB_ROLL = 22;
const CA = new Float32Array(2), CI = new Int32Array(2);

/**
 * bible 3.4 "Ambient" and 4.3 "Rock", ground space (floor-level: whole pixels on the floor line):
 *   - a 2 x 2 dust kick (opaque `scale`) at a paw on each weight shift: every other hind contact of the walk (the near
 *     hind's), the idle's weight shift as the near front paw sets down, and wherever the heavy body lands -- the
 *     belly settling into sleep or the sunbathe, the shell landing in the roll-over and the paws coming back down,
 *     the front paws bracing at the roar's snap;
 *   - a pebble crumb that rolls off the dome every 300 +- 60 f while it stands about (idle, variants, pet, beg):
 *     down the lit rear slope, off the rear end, one bounce, a short roll, a rest, gone.
 * (The crystal glint every 200 +- 60 f is drawCrystals'.) Every particle goes through the ambient budget (5.4): each
 * dust BIT is one (a kick of 2 or 3 pairs is 4 or 6), the crumb one, and the frame's twinkle counts toward the
 * dragon's 6; only what is granted is drawn, and the crumb's interval stretches with a crowd.
 */
const ambient: ElementDraw = (ctx, rig, pose, info) => {
  const J = rig.j, st = info.stage, act = pose.act, c = pose.cue;
  enterGround(ctx, rig);
  // ---- dust kicks: at most one live kick at a time ----
  let gx = 0, half = 0, age = -1, pairs = 1;
  const legNH = J.legs[0], legNF = J.legs[1], H = rig.dims.hind, Fr = rig.dims.front;
  if (act === ACT.walk) {
    const C = Math.round(rig.tune.walk.cycle), c0 = Math.round(0.4 * C);
    age = ((c - c0) % C + C) % C;
    rootToGround(rig, legNH.ankle.x, legNH.ankle.y, PG); gx = PG.x + H.pawW / 2 - 2; half = H.pawW / 2;
  } else if (act === ACT.none && SHUFFLE[st].length) {
    const s = SHUFFLE[st];
    age = c >= s[1] ? c - s[1] : c - s[0];
    rootToGround(rig, legNF.ankle.x, legNF.ankle.y, PG); gx = PG.x + Fr.pawW / 2 - 2; half = Fr.pawW / 2;
  } else if (act === ACT.sleep && c < 0 || act === ACT.fidget) {
    // the belly lands: the lie-down's settle (sleepAnim: body.y reaches it at 32 / 40 of the lie-down), the sunbathe's
    age = act === ACT.fidget ? c - Math.round(16 * FIDGET_TIMING[st].dur) : c - (Math.round(32 * rig.tune.sleep.lieDown / 40) - Math.round(rig.tune.sleep.lieDown));
    rootToGround(rig, J.body.x, 0, PG); gx = PG.x; half = rig.dims.bodyLen / 2 - 2; pairs = st === 'baby' ? 1 : 2;
  } else if (act === ACT.happy) {
    // the roll-over (rollOver): the shell lands at f 24, the paws come back down at f 84 (cue from f 14)
    const k = STAGE_TIMING[st].dur, land = Math.round(24 * k) - Math.round(14 * k), back = Math.round(84 * k) - Math.round(14 * k);
    age = c >= back ? c - back : c - land;
    rootToGround(rig, J.body.x, 0, PG); gx = PG.x; pairs = st === 'baby' ? 1 : c >= back ? 2 : 3;
    half = c >= back ? rig.dims.bodyLen / 2 : DOME[st].w / 2 - 2;
  } else if (act === ACT.breath && st !== 'baby') {
    age = c;
    rootToGround(rig, legNF.ankle.x, legNF.ankle.y, PG); gx = PG.x + Fr.pawW / 2 - 2; half = Fr.pawW / 2;
  }
  // (each dust bit is one particle; the per-dragon cap counts the crystal twinkle bodyOver took this frame: TOOK)
  let left = rig.budget.perDragon - TOOK;
  if (age >= 0 && age < DUST_LIFE && left > 0) {
    const bits = rig.budget.take(rig.slot, Math.min(2 * pairs, left));
    left -= bits;
    if (bits) kickDust(ctx, rig, gx, half, age, pairs, bits);
  }
  // ---- the pebble crumb ----
  const idle = act === ACT.none || act === ACT.variant || act === ACT.pet || act === ACT.beg;
  if (idle && !info.asleep && rig.tf.ss > 0 && ARC_N > 0 && left > 0) {
    const nc = liveSpawns(info.seed + 13, info.tick + 150, 300 * rig.budget.stretch, 60, CRUMB_LIFE, CA, CI);
    if (nc > 0 && rig.budget.take(rig.slot, 1)) {
      const t = CA[0], x0 = ARC_X[0], xs = x0 + (ARC_X[ARC_N] - x0) * 0.1;
      if (t < CRUMB_ROLL) {
        // down the rear slope, gathering speed: its ink ring's bottom on the dome's ink
        const u = (t / CRUMB_ROLL) * (t / CRUMB_ROLL), x = xs + (x0 + 1 - xs) * u;
        bodyToGround(rig, x, domeTopY(x, ARC_N) - 2, PG);
        pebble(ctx, rig, PG.x - 1, PG.y - 1, 2, info.pal.marking);
      } else {
        bodyToGround(rig, x0 + 1, domeTopY(x0 + 1, ARC_N) - 2, PT);
        ballistic(t - CRUMB_ROLL, PT.x, PT.y, -0.35, 0.1, -2, PG);
        pebble(ctx, rig, PG.x - 1, PG.y - 1, 2, info.pal.marking);
      }
    }
  }
  ctx.restore();
};

// ---------- anims ----------

/** Stage duration factor (4.1): adult 1, young 0.85, baby 0.6. */
const durOf = (stage: Stage): number => STAGE_TIMING[stage].dur;
/** How far the body settles for the belly to rest on the floor (level body), px. */
function settleOf(d: DragonDims | null, extra = 1): number {
  return d ? Math.max(0, d.bodyY - Math.max(d.hipR, d.chestR - 1, d.sag ? d.sag.cy + d.sag.ry : 0) - extra) : 6;
}

/**
 * IDLE (4.2, the stage's breath) with rock's WEIGHT SHIFT (3.4 "a dust puff at a paw on each weight shift"): two
 * breaths per loop (adult 240 f, young 200), the shared breath's keys exactly, and in the second one the heavy body
 * shifts forward onto the near front paw -- it lifts 1.5 px, sets down 2 px ahead, the chest dips 1 deg -- and back
 * again a second later, a dust kick at each set-down (ambient, SHUFFLE). The cue counts the loop's frames (act none).
 * The baby keeps the shared bob: a weight shift under a 4 px leg is a wobble.
 */
function idleRock(stage: Stage): DragonAnim | null {
  if (stage === 'baby' || stage === 'elder') return null;
  const young = stage === 'young', B = young ? 100 : 120, L = 2 * B, [c1, c2] = SHUFFLE[stage];
  const kf = young ? [0, 7, 47, 54] : [0, 8, 56, 64];
  const two = (v: readonly number[]): Key[] => [0, B].flatMap((o) => kf.map((f, i) => [o + f, v[i], 'inout'] as const));
  const tracks: Tracks = {
    'body.y': two([0, -0.15, -1, -0.95]),
    squash: two([1, 1.004, 1.03, 1.028]),
    'neck.a0': two(young ? [0.3, 0, -1.8, -2] : [0.25, -0.1, -1.6, -2]),
    'head.rot': two(young ? [-1, 1, 4, 5] : [0, 0, 0.4, 0.5]),
    'legNF.lift': [[0, 0], [c1 - 8, 0], [c1 - 4, 1.5], [c1, 0], [c2 - 8, 0], [c2 - 4, 1.5], [c2, 0]],
    'legNF.slide': [[0, 0], [c1 - 8, 0], [c1, 2], [c2 - 8, 2], [c2, 0]],
    'body.rot': [[0, 0], [c1 - 10, 0], [c1 + 2, 1], [c2 - 10, 1], [c2 + 2, 0]],
    // (the loop's clock as a function: a [L, L] key wraps onto frame 0 and runs the ramp backwards)
    cue: (t) => t,
  };
  if (!young) tracks['wing.fold'] = two([0, 0.005, 0.04, 0.04]);
  return bake(tracks, { stage, len: L, loop: true, ease: 'inout', tailSway: young ? { period: 100, amp: 8 } : { period: 150, amp: 5 } });
}

/**
 * The idle fidget (3.4): it SUNBATHES flat with its eyes closed (120 f; young x 0.85, baby x 0.6). It must never be
 * read as asleep (4.3), so it is the sleep's opposite in every channel that reads at game scale: it flops its belly
 * onto the floor with its legs SPRAWLED (hind paws pushed back, front paws forward: a basking lizard, where a
 * sleeper tucks them under), the tail laid straight out behind, the chin raised to the sun with the eyes shut in
 * bliss (`happy`: the "^" and the blush, where a sleeper's lie flat), two slow deep breaths, and the crystals soak
 * the sun up (mood +1: lit, glinting); no "z". Then it pushes itself up. Dust puffs as the belly lands (ambient).
 */
function sunbathe(stage: Stage, d: DragonDims | null): DragonAnim {
  // (the elder's at x 1.3, its sprawl, chin and tail at 0.8x, its belly still flat on the floor: FIDGET_TIMING, 4.2)
  const FT = FIDGET_TIMING[stage], k = FT.dur, g = FT.amp, L = Math.round(120 * k), t = (f: number) => Math.round(f * k), baby = stage === 'baby';
  const settle = settleOf(d), sp = (baby ? 1 : stage === 'young' ? 3 : 4) * g;
  const hold = (v: number, a: number, b: number): Key[] => [[0, 0], [t(a), v, 'inout'], [t(100), v, 'inout'], [t(b), 0]];
  return bake({
    'body.y': hold(settle, 16, 116),
    squash: [[0, 1], [t(16), 1], [t(40), 1.03, 'inout'], [t(62), 1, 'inout'], [t(84), 1.03, 'inout'], [t(100), 1], [L, 1]],
    'legNH.slide': hold(-sp, 14, 112), 'legFH.slide': hold(-sp, 14, 112),
    'legNF.slide': hold(sp + g, 14, 112), 'legFF.slide': hold(sp + g, 14, 112),
    'neck.a0': hold(baby ? 0 : -12 * g, 18, 114),
    'head.rot': hold((baby ? -14 : -16) * g, 20, 114),
    'tail.lift': hold(-6 * g, 16, 112),
    'tail.stiff': [[0, 0], [t(16), 1], [t(100), 1], [L, 0]],
    face: [[0, DFACE.neutral], [t(18), DFACE.happy], [t(102), DFACE.neutral]],
    mood: [[0, 0], [t(20), 2], [t(100), 2], [L, 0]],
    act: [[0, ACT.fidget]], cue: [[0, 0], [L, L]],
  }, { stage, len: L, next: 'idle' });
}

/**
 * bible 4.3 "Rock happy": no preen -- a slow roll onto its back, belly up, and back (110 f at the adult, so the 90 f
 * roll fits; young x 0.85, baby x 0.6). It settles low (0-14) and tips back onto its rump (14-24); in a side view
 * the roll onto its back IS a vertical flip, so at f 24 it flips in one held frame (stretch -1, root.y lifting the
 * upturned shell onto the floor: the rig keeps the light top-left and stands its floor guards aside while flipped)
 * and settles on its shell (24-34) in a kick of dust (ambient); belly up it rocks, paws paddling in the air on 4 f
 * beats with the knees and elbows bent (straight legs up, eyes shut and the head hanging was the "dead bug"
 * pictogram), the tail wagging, the face `happy` the whole way through (faces.ts keeps the "^" upright on screen
 * while flipped), the jaw open at the stage minimum with the tongue out, and the chin tucked toward its belly so the
 * face is seen nearly level (34-76); it tips and flips back (76-84-94), lands on its paws in another kick of dust and
 * stands up happy. `mood` +1 throughout, so the crystals glint.
 */
function rollOver(stage: Stage, d: DragonDims | null): DragonAnim {
  const k = durOf(stage), L = Math.round(110 * k), t = (f: number) => Math.round(f * k);
  const D = DOME[stage];
  const settle = settleOf(d, 2);
  // upside down, the dome's peak rests on the floor (bodyOver's geometry: the body's back line at the dome's centre,
  // lifted by the rise and the ridge vertex, plus half the ink); the crystals are pressed under the shell then
  let top = 30;
  if (d) {
    // features.ts backLineY with the dims alone: the highest of the hip ball's top, the chest ball's top and the
    // tangent between them, at the dome's centre x (-1); an odd facet count adds the 0.7 px ridge vertex
    const x = -1, hx = -d.gap / 2, cxb = d.gap / 2;
    const ball = (bx: number, by: number, r: number) => (Math.abs(x - bx) < r ? by - Math.sqrt(r * r - (x - bx) * (x - bx)) : 1e9);
    const tan = -d.hipR + (-1 - d.chestR + d.hipR) * ((x - hx) / (cxb - hx || 1));
    const back = Math.min(ball(hx, 0, d.hipR), ball(cxb, -1, d.chestR), tan);
    top = d.bodyY - settle - (back - D.rise - (D.facets > 1 ? 0.7 : 0)) + 0.5;
  }
  const f1 = t(24), f2 = t(84);
  // the paddle: +-40 deg on 4 f beats (a +-25 swing on 6 f read as legs held up stiff), far legs a beat behind, so
  // the four paws visibly alternate; the knees and elbows bend (lower) so the paws flop like a pet's, not a bug's
  const pad: Key[] = [[0, 0], [t(30), 0]], rock: Key[] = [[0, 0], [t(14), 0, 'inout'], [f1 - 1, -25], [f1, 25, 'out'], [t(34), 0]];
  for (let f = 34, s = 1; f < 74; f += 4, s = -s) pad.push([t(f), 40 * s]);
  pad.push([t(76), 0]);
  // (the front paddle swings about a base 25 deg forward: about 0 its back stroke laid the forearm flat on the belly)
  const padF = pad.map((q, i) => (i > 1 && i < pad.length - 1 ? [q[0], q[1] + 25] as const : q));
  const fold = (v: number): Key[] => [[0, 0], [f1 - 1, 0], [f1, v], [t(76), v], [f2 - 1, 0]];
  for (let f = 36; f < 72; f += 12) rock.push([t(f), 4], [t(f + 6), -4]);
  rock.push([t(76), 0, 'inout'], [f2 - 1, 25], [f2, -25, 'out'], [t(94), 0]);
  const plant: Key[] = [[0, 1], [t(12), 1], [t(16), 0], [t(94), 0], [t(100), 1]];
  // on its back it tucks its chin toward its belly (up, on screen): hanging off the shoulders the head pointed
  // snout-down with its face upside down; tucked, the face is seen nearly level. The baby's head rides higher
  // than its pebble, so it tucks further (lifted off the floor, peeking at its own paws)
  const tuck = stage === 'baby' ? 24 : 22, chin: Key[] = [[0, 0], [f1 - 1, 0], [f1, tuck], [f2 - 1, tuck], [f2, 0]];
  // the jaw at the stage minimum (1.2) with the tongue out while it is belly up: a happy "blep"
  const jmin = d ? d.head.jawMin : 20, jaw: Key[] = [[0, 0], [t(30), 0], [t(32), jmin], [t(76), jmin], [t(78), 0]];
  const anim = bake({
    'body.y': [[0, 0], [t(12), settle, 'inout'], [t(96), settle, 'inout'], [t(106), 0]],
    stretch: [[0, 1], [f1 - 1, 1], [f1, -1], [f2 - 1, -1], [f2, 1]],
    'root.y': [[0, 0], [f1 - 1, 0], [f1, top], [f2 - 1, top], [f2, 0]],
    'root.rot': rock,
    'neck.a0': chin, 'head.rot': chin, jaw,
    'legNH.plant': plant, 'legNF.plant': plant, 'legFH.plant': plant, 'legFF.plant': plant,
    'legNH.upper': pad, 'legNF.upper': lag(padF, 4), 'legFH.upper': lag(pad, 4), 'legFF.upper': padF,
    'legNH.lower': fold(40), 'legFH.lower': fold(40), 'legNF.lower': fold(-40), 'legFF.lower': fold(-40),
    'tail.stiff': [[0, 0], [t(10), 1], [t(96), 1], [L, 0]],
    'tail.sway': [[0, 0], [t(34), 0], [t(40), 20], [t(46), -20], [t(52), 20], [t(58), -20], [t(64), 20], [t(70), -20], [t(76), 0]],
    face: [[0, DFACE.neutral], [t(6), DFACE.happy], [t(106), DFACE.neutral]],
    mood: [[0, 0], [t(6), 2], [t(100), 2], [L, 0]],
    act: [[0, ACT.happy]], cue: [[0, -t(14)], [L, L - t(14)]],
  }, { stage, len: L, next: 'idle' });
  // the flips are cuts, not tweens: the frame before each holds its pose, so no in-between squashes the sprite flat
  const fr = anim.frames;
  for (let i = 0; i + 1 < fr.length; i++) {
    const a = fr[i].pose?.stretch ?? 1, b = fr[i + 1].pose?.stretch ?? 1;
    if (a * b < 0) fr[i].interp = false;
  }
  return anim;
}

/**
 * bible 3.4 "Signature: Gravel Roar", the anim (4.2's breath beats per stage: adult 70 f = 18 / 6 / 30 / 16, young
 * 56, baby 36). The TELL (wind-up): the head LOWERS -- snout down 14, the neck down, the chest dipping 4 deg into a
 * brace, a 1 px crouch and the chest puffed -- while bodyOver flashes the crystals glow.hi twice. SNAP: the head
 * thrusts up and forward into the roar, jaw 25 (young 22), the eyes squeezed SHUT for 8 f (the effort), a recoil
 * (adult 1 px, young 3: still learning) and the root JITTERS +-1 px on 2 f beats for 12 f. SUSTAIN: the jaw stays
 * open while the breath renderer still has puffs to give (the last is born 20 f after the snap, young 12) and shuts
 * as it leaves, the head jittering until then; the cloud billows on out through the rest of it, the tail stiff.
 * RECOVER: `happy` for 10 f. BABY: the cheeks puff (squash 1.1) through the wind-up, pop at the snap -- "ptoo" --
 * and the fizzle face is tuning.breath's `happy` with the chin raised 6 deg (proud), with the shared 2 px sneeze-back.
 */
function gravelRoar(stage: Stage): DragonAnim {
  const baby = stage === 'baby', young = stage === 'young', [w, sn, su, rc] = BREATH_BEATS[stage];
  const s0 = w, s1 = w + sn, e0 = s1 + su, L = e0 + rc, H = DFACE.happy, N = DFACE.neutral;
  const jaw = ROAR_JAW[stage], recoil = young ? 3 : 1, P = PUFFS[stage];
  // the jaw shuts 3 f after the last puff is born (it leaves the lips); the baby's "ptoo" at the sustain's end
  const shut = baby ? e0 : s0 + (P.n - 1) * P.every + 3;
  const rx: Key[] = [[0, 0], [s0, 0, 'out']];
  if (baby) rx.push([s0 + 2, -1], [e0, -1, 'out'], [e0 + 2, -2], [e0 + 8, -2], [L, 0]);
  else {
    for (let i = 0; i < 6; i++) rx.push([s0 + 1 + 2 * i, -recoil + (i % 2 ? 1 : -1), 'linear']);
    rx.push([s0 + 13, -recoil], [e0, -recoil], [L, 0]);
  }
  // the head jitter while it roars: about 1 px (2 deg) every 4 f, as the shared breath
  const jit: Key[] = [];
  if (!baby) for (let t = s1; t + 3 < shut; t += 4) jit.push([t, -3 + (((t - s1) / 4) % 2 ? -2 : 2)], [t + 3, -3 + (((t - s1) / 4) % 2 ? -2 : 2)]);
  return bake({
    'head.rot': [[0, 0], [s0 - 2, 14], [s0, 14], [s0 + 3, -3, 'out'], ...jit, [shut, -3], [e0, -2], [e0 + 6, baby ? PROUD_CHIN : 0], [L, baby ? PROUD_CHIN : 0]],
    'neck.a0': [[0, 0], [s0, 8], [s1, -5], [e0, -5], [L, 0]],
    'body.rot': [[0, 0], [s0, 4], [s1, -1], [e0, -1], [L, 0]],
    'body.y': [[0, 0], [s0, 1], [s1, 0], [L, 0]],
    squash: baby ? [[0, 1], [s0 - 3, 1.08, 'out'], [s0, 1.1], [s0 + 2, 0.94], [s0 + 6, 1], [L, 1]] : [[0, 1], [s0, 1.05], [s1, 1], [L, 1]],
    'root.x': rx,
    jaw: [[0, 0], [s0 - 2, 0], [s0, jaw], [shut, jaw], [shut + 4, 0]],
    fx: [[0, 0], [s0, 0, 'linear'], [s0 + 2, 1], [shut, 1, 'linear'], [shut + 3, 0]],
    'tail.lift': [[0, 0], [s0, -4], [e0, -4], [L, 0]],
    'tail.stiff': [[0, 0], [6, 1], [e0, 1], [L, 0]],
    face: baby ? [[0, N], [e0, H], [e0 + 12, N]] : [[0, N], [s0, DFACE.closed], [s0 + 8, N], [e0 + 4, H], [e0 + 14, N]],
    act: [[0, ACT.breath]], cue: [[0, -s0], [L, L - s0]],
  }, { stage, len: L, next: 'idle' });
}

/**
 * BEG, rock's hungry tell (4.3 "stares at pebbles and licks a rock"; 4.2's 120 f loop, `hungry`, the cue at the beg
 * mood, the stomach growl at f 80). It crouches over a little pile of pebbles (begPile) instead of sitting up: the
 * snout down at them and the big hungry eyes on them (0-22), it dips and licks one twice, eyes shut, the tongue out
 * on the jaw at its stage minimum (24-50), stares again, then lifts its head to look up at the owner, pleading
 * (62-96: the growl lands here), and goes back to staring. The lick pose is fitted so the snout's tip comes down on
 * the pile (lickPose), the stare hovers 5 px over it. The baby, with no neck to lower, bows its body instead.
 */
function begRock(stage: Stage, d: DragonDims | null): DragonAnim {
  // (the elder's loop is 4.2's 140 f: every beat x 140 / 120 but the growl, which lands where the shared beg's does)
  const L = stage === 'elder' ? 140 : 120, q = L / 120, baby = stage === 'baby', B = BEG[stage], hg = DFACE.hungry;
  const s = (keys: Key[]): Key[] => stretchKeys(keys, q);
  // [body rot, body y, a0, a1, head] of the stare, the lick and the plea
  let stare: readonly number[], lick: readonly number[];
  if (baby || !d) {
    stare = [BABY_STARE[0], B.settle - 0.5, BABY_STARE[1], 0, BABY_STARE[2]];
    lick = [BABY_LICK[0], B.settle, BABY_LICK[1], 0, BABY_LICK[2]];
  } else {
    const H = d.head, px = H.snout.x1, py = H.snout.y1 + H.snout.r1;
    const a = lickPose(d, stage);
    lick = [B.rot, B.settle, HP.a0, HP.a1, HP.head];
    fitHead(d, B.settle, B.rot, a - 6, STARE_Y, px, py);
    stare = [B.rot, B.settle, HP.a0, HP.a1, HP.head];
  }
  const plea = baby ? [-8, 1, -6, 0, -12] : [-4, 1, -8, 0, -12];
  const ch = (i: number): Key[] => s([[0, stare[i]], [20, stare[i]], [28, lick[i]], [50, lick[i]], [58, stare[i]], [64, stare[i]],
    [74, plea[i]], [98, plea[i]], [108, stare[i]]]);
  const jmin = d ? d.head.jawMin : 20;
  // (each lick's open jaw is held whole frames, stepped: stretched, its open and shut keys stay 1 f apart)
  const lk = (a: number, b: number): Key[] => { const A = Math.round(a * q), Bq = Math.round(b * q); return [[A - 1, 0], [A, jmin], [Bq, jmin], [Bq + 1, 0]]; };
  return bake({
    'body.rot': ch(0), 'body.y': ch(1), 'neck.a0': ch(2), 'neck.a1': ch(3), 'head.rot': ch(4),
    jaw: [[0, 0], ...lk(30, 36), ...lk(41, 47)],
    squash: s([[0, 1], [64, 1], [72, 1.02], [98, 1.02], [106, 1]]),
    'root.x': [[0, 0], [80, 0, 'linear'], [81, 1, 'linear'], [83, -1, 'linear'], [85, 1, 'linear'], [87, -1, 'linear'], [88, 0]],
    // (the baby draws its front paws back under its chest, so its pile lies clear of them under its bowed snout)
    'legNF.slide': [[0, baby ? -3 : 0]], 'legFF.slide': [[0, baby ? -3 : 0]],
    'tail.sway': s([[0, -4], [60, 4]]),
    face: s([[0, hg], [29, DFACE.closed], [49, hg]]),
    mood: [[0, -0.5]],
    act: [[0, ACT.beg]], cue: (t) => t,
  }, { stage, len: L, loop: true, ease: 'inout' });
}

/** How far the body settles for the belly to rest on the floor pitched `rot` deg (+ = chest down), px. */
function settleRot(d: DragonDims, rot: number, extra = 1): number {
  const a = rot * RAD, s = Math.sin(a), c = Math.cos(a);
  const bottom = Math.max(-d.gap / 2 * s + d.hipR, d.gap / 2 * s - c + d.chestR, d.sag ? d.sag.cy * c + d.sag.ry : -1e9);
  return Math.max(0, d.bodyY - bottom - extra);
}

/**
 * fitHead with the neck FOLDED (young, adult: two segments): the first segment at world elevation `e0` (steeply
 * down), the second solved so cranium point (px, py) lands at root height `y` with the head at `headAng` -- the head
 * drawn back toward the chest instead of held out on a straight neck. Into HP.
 */
function fitHeadFolded(d: DragonDims, settle: number, rot: number, e0: number, headAng: number, y: number, px: number, py: number): void {
  const N = d.neck, H = d.head, A = headAng * RAD, bc = Math.cos(rot * RAD), bs = Math.sin(rot * RAD);
  const ry = -d.bodyY + settle + N.root[0] * bs + N.root[1] * bc;
  const ox = H.fromNeck[0] + px, oy = H.fromNeck[1] + py, dy = ox * Math.sin(A) + oy * Math.cos(A);
  const e1 = Math.asin(Math.max(-1, Math.min(1, (ry - N.len * Math.sin(e0 * RAD) + dy - y) / N.len))) / RAD;
  const a0 = N.rest[0] - rot - e0, a1 = N.rest[1] - rot - e1 - a0;
  headPoint(d, settle, rot, a0, a1, headAng - N.headPitch - a0 - a1 - rot, px, py);
}

/** The upset tuck's pose per stage: body pitch, the neck's first segment (world deg), the head's world pitch. */
const UPSET: Readonly<Record<Stage, { rot: number; e0: number; head: number }>> = {
  baby: { rot: 0, e0: 0, head: 14 }, young: { rot: 7, e0: -55, head: 2 }, adult: { rot: 7, e0: -55, head: 2 },
  elder: { rot: 7, e0: -55, head: 2 },
};

/**
 * The UPSET tuck (3.4; bible 1.4 "the tuck branch"): hiding in its shell, the loop the game plays while it sulks or
 * is frightened -- 'upset' in the table (an intro of 16 f, adult; then a 96 f loop), act ACT.upset, cue = frames
 * into it. It must read "comfort me", never "leave me be" (the sleep tuck) and never cross (D18):
 *   - YOUNG, ADULT: belly down, pitched 7 deg nose-down, the legs folded in, the neck folded down so the head sits
 *     low and back against the chest, chin on the floor and the head LEVEL (2 deg: pitched snout-down, the upright
 *     `sad` brow tipped into a scowl); tuck 1 draws the head before the dome, whose front third rolls forward over
 *     it as the intro plays (hoodPoints) -- a boulder, one `sad` eye peeking out of the slit under its raised rim;
 *   - BABY: its sleep BUN (tuck 2), the head bowed a little onto its chest over its paws, the `sad` eye open and
 *     peeking over them (a hood over a head that big was a beret);
 *   - both: `scared` as it ducks, then `sad`; a 1 px tremble every 8 f; the crystals flicker glow.sh <-> glow every
 *     12 f (drawCrystals); no "z" -- it is awake. The sleep tuck rests its head OUTSIDE the rim, eyes shut.
 */
function upsetTuck(stage: Stage, d: DragonDims | null): DragonAnim {
  const I = HOOD_GROW[stage] > 1 ? HOOD_GROW[stage] : Math.round(16 * durOf(stage)), B = 96, len = I + B, baby = stage === 'baby';
  const U = UPSET[stage], rot = U.rot, settle = d ? settleRot(d, rot) : 6;
  // young, adult: the neck folded, the chin on the floor, the head level; the baby bows its head onto its chest
  let a0 = 10, a1 = 0, hr = U.head - 10;
  if (!baby && d) {
    const H = d.head;
    fitHeadFolded(d, settle, rot, U.e0, U.head, -1.5, H.jaw.hx + 2, H.jaw.hy + H.jaw.r0);
    a0 = HP.a0; a1 = HP.a1; hr = HP.head;
  }
  const hind = baby ? 1 : stage === 'young' ? 3 : 4, front = baby ? 1.5 : -2;
  const hold = (v: number): Key[] => [[0, 0], [I, v, 'out'], [len, v]];
  const late = (v: number): Key[] => [[0, 0], [Math.round(I / 2), 0], [I, v, 'inout'], [len, v]];
  // the tremble: 1 px, 1 f, every 8 f
  const tremble: Key[] = [[0, 0], [I, 0]];
  for (let f = I; f < len; f += 8) tremble.push([f + 6, 0], [f + 7, 1], [f + 8, 0]);
  return bake({
    'body.y': hold(settle), 'body.rot': hold(rot),
    'neck.a0': hold(a0), 'neck.a1': hold(a1), 'head.rot': hold(hr),
    'legNH.slide': hold(hind), 'legFH.slide': hold(hind), 'legNF.slide': hold(front), 'legFF.slide': hold(front),
    // (the tail curls in as the body settles, then droops onto the floor: drooped first, it swung through it)
    'tail.lift': late(baby ? 40 : 30), 'tail.curl': hold(baby ? 30 : 16), 'tail.stiff': hold(1),
    squash: baby ? hold(1.06) : [[0, 1]],
    'root.x': tremble,
    tuck: [[0, 0], [Math.round(I / 2), baby ? 2 : 1]],
    face: [[0, DFACE.scared], [Math.round(I * 0.75), DFACE.sad]],
    mood: [[0, -2]],
    act: [[0, ACT.upset]], cue: (t) => t,
  }, { stage, len, loop: true, loopFrom: I, ease: 'out' });
}

export const ROCK: ElementSpec = {
  id: 'rock',
  name: 'Cobble',
  blurb: 'Calm, sleepy, stubborn and patient: the easiest baby to raise. Crystals grow on its dome with its bond.',
  palette: PAL,
  modifiers: {
    // head low (3.4: carried below the dome top): the short neck runs out nearly level from low on the chest
    bodyLength: 1.1, bodyDepth: 1.2, legLength: 0.75, legR: 1.2, neckLength: 0.7, neckAngle: -40, neckDrop: 4, tailLength: 0.7, tailR: 1.2,
    snout: 0.9, snoutTaper: 0.9, tailTipRMax: 2,
  },
  stages: {
    // the dome is the marking (3.4): its facets in `marking` grow 1 -> 3 -> 5 with the stage, so no shared markings
    // the tail (2.6, 3.4): short and stiff. The baby's is 0.6 as long, on a thinner root, tapering to r 2 with its
    // tip on the floor (as long as its body and broad, rising up and back, it was a beaver's tail); the young's and
    // adult's leave the hip under the rim nearly level and curve down to the floor (TAIL_REST: a heavy tail with a
    // convex top, a concave step under the rim; run straight at 34 deg they continued the dome's back slope to the
    // floor, a doorstop), the chain's wobble mostly held (tailStiff): bent 6 deg a segment and let swing, the
    // outline went wavy between segments, a limp flap. The baby's wing nub roots 3 px further back (rootDx), under
    // the rim: at the stage root its front showed as a 3 px slate speck between shell, body and head
    baby: {
      tailRest: TAIL_REST.rock.baby, horns: null, markings: [], tailLen: 0.65, tailR: [3.4, 2], tailStiff: 0.7,
      wing: wingParams({ style: 'bat', foldRise: 0, rootDx: -3 }), dorsal: null,
    },
    young: {
      tailRest: TAIL_REST.rock.young, horns: null, markings: [], brow: 2, tailStiff: 0.7,
      wing: wingParams({ style: 'bat', scallop: 1, span: 0.7, foldRise: 0 }), dorsal: null,
    },
    adult: {
      tailRest: TAIL_REST.rock.adult, horns: null, markings: [], brow: 3, tailStiff: 0.7,
      wing: wingParams({ style: 'bat', scallop: 1, span: 0.7, foldRise: 0 }), dorsal: null,
    },
    // the elder (3.4's Elder column): a 4 px brow ridge, half the elder's neck lowering (-33 for -40: the head drops
    // about 2 px and stays under the dome's top, 2.3), the adult's 38 % belly band (at the elder's 42 %, over the
    // paunch and between the legs, the pale cream band read as a nappy: the elder core review), the stubby wing torn
    // once where its panel has room (2.9: no hole on rock). Its dome, crystals and nose horn: the FIRST PASS notes above
    elder: {
      tailRest: TAIL_REST.rock.elder, horns: null, markings: [], brow: 4, tailStiff: 0.7, neckAngle: -33, bellyFrac: 0.38,
      wing: wingParams({ style: 'bat', scallop: 1, span: 0.7, foldRise: 0, tears: [{ panel: 1, at: 0.5, depth: 3 }] }), dorsal: null,
    },
  },
  render: { bodyOver, nearHead, breath, ambient },
  wingUnderBodyOver: true,
  anims: {
    // bible 4.3 "Rock": the heavy 60 f walk (a slow 0.3 px/f: the stride has to fit 7-8 px legs) with a dust kick on
    // every other hind contact (ambient); the idle's weight shift (idleRock); the 110 f roll-over happy (rollOver);
    // the gravel roar with its lowered-head tell and root jitter (gravelRoar); the pebble-licking beg (begRock); the
    // sunbathe fidget (sunbathe); the upset tuck (upsetTuck, 'upset'). The sleep TUCK rests the head on the floor
    // OUTSIDE the rim (drawn last), breathing 240 f, its crystals banked (drawCrystals: asleep).
    fidget: sunbathe,
    overrides: (st, d) => {
      const idle = idleRock(st);
      return { ...(idle ? { idle } : {}), happy: rollOver(st, d), breath: gravelRoar(st), beg: begRock(st, d), upset: upsetTuck(st, d) };
    },
    tuning: (st) => ({
      // (a lumber: the shell pitches +-1.5 deg with the stride and the head plods 2 deg low)
      // (the elder: 72 f at 0.26 px/f, 4.2)
      walk: { cycle: st === 'adult' ? 60 : st === 'young' ? 50 : st === 'elder' ? 72 : 30, speed: st === 'adult' ? 0.3 : st === 'young' ? 0.32 : st === 'elder' ? 0.26 : 0.2,
        sway: st === 'baby' ? 0 : 1.5, head: st === 'baby' ? 0 : 2 },
      // the SLEEP tuck (3.4) rests the head on the ground OUTSIDE the rim, so it draws in the normal order (the head
      // last); tuck 1, the head under the dome, is the upset tuck's
      // FIRST PASS (elder): the adult's 240 f breath at the elder's x 1.2 (the shared 180 -> 216)
      // (its wake stretches with the wings kept folded under the rim: 1.3; spread, the stub poked a slate wedge below it)
      sleep: { tuck: st === 'baby' ? 2 : 0, nubFold: 0, breath: st === 'adult' ? 240 : st === 'young' ? 200 : st === 'elder' ? 288 : 160, wakeSpread: 0 },
      // (gravelRoar replaces the shared breath; these are its numbers, for anything that reads the tuning)
      breath: { jaw: ROAR_JAW[st], fizzleFace: 'happy', fizzleChin: PROUD_CHIN },
    }),
  },
};
