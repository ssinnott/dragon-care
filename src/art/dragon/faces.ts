// The dragon face (docs/ART_BIBLE.md 2.5): DFACE, the stage eye, lids counted in rows, brow bar, blush, nostril,
// mouth marks and teeth.
//
// FACE SPACE. The eye is a pixel construction (a 1 px ink ring round flat rects: 7 x 8 / 7 x 7 / 8 x 6), and a
// rotated or squashed rect is anti-aliased mush at this size. So rig.ts draws the face in a space that is
// device-aligned: origin snapped to a whole device pixel at the eye centre, one unit = one sprite pixel, mirrored
// by facing but never rotated with the head nor scaled by squash. Every function here draws there, in whole px.
// Everything goes through rig.col so the flash and silhouette overrides reach the face too.
//
// THE ELDER FACE (2.5, v2). The elder keeps the adult's 8 x 6 almond, its slit, catchlight and lid rows, and NO lid by
// default (a permanent lid is `sleepy`, a care signal). It reads "wise" from the frame round the eye: the 3 px brow
// ridge (the skull's contour, parts.ts), the grey MUZZLE (drawMuzzle: pigment, clipped to the skull, under the eye,
// nostril and mouth marks), the level grey brow TUFT at every face (drawBrow), the inked beard (parts.ts drawBeard)
// and fangs worn to 2 x 2. Its greys are rig.greys (palettes.ts muzzleOf / beardOf, set per element by luminance).
import { DRAGON_SHARED, TUFT_LUM, blushOf } from './palettes.ts';
import { DFACE } from './pose.ts';
import type { DragonRig } from './rig.ts';
import { inSkull, skullBands } from './parts.ts';
import { grown } from './stages.ts';

export { DFACE };

/** Eye box in face space (whole px): outer size including the ring, and its top-left corner. */
interface EyeBox { x: number; y: number; w: number; h: number }
const BOX: EyeBox = { x: 0, y: 0, w: 0, h: 0 };

function eyeBox(rig: DragonRig, grow: number): EyeBox {
  const e = rig.dims.head.eye;
  BOX.w = e.w + grow * 2; BOX.h = e.h + grow * 2;
  BOX.x = -Math.floor(BOX.w / 2); BOX.y = -Math.floor(BOX.h / 2);
  return BOX;
}

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void { ctx.fillRect(x, y, w, h); }

/**
 * How far the eye ring's corners are cut, px: 1 on babies; 2 on young and adults, so the wide 8 x 6 eye reads as
 * an almond instead of a box (a boxed iris | slit | iris read as a pause icon: bible 2.5 amendment) and the young's
 * 7 x 7 as a round eye (cut 1, its square ring with the pupil set at its top read as a boxed "U" glyph beside the
 * glossy baby eye and the adult almond: the cast review).
 */
function cutOf(rig: DragonRig): number { return rig.stage === 'baby' ? 1 : 2; }

/** The 1 px ink ring with `cut` px cut corners (1 or 2), filled with `fill` inside. */
function ring(ctx: CanvasRenderingContext2D, rig: DragonRig, b: EyeBox, fill: string): void {
  const k = cutOf(rig);
  ctx.fillStyle = rig.col(rig.outline);
  if (k === 1) { rect(ctx, b.x + 1, b.y, b.w - 2, b.h); rect(ctx, b.x, b.y + 1, b.w, b.h - 2); }
  else {
    rect(ctx, b.x + 2, b.y, b.w - 4, b.h); rect(ctx, b.x + 1, b.y + 1, b.w - 2, b.h - 2); rect(ctx, b.x, b.y + 2, b.w, b.h - 4);
  }
  ctx.fillStyle = rig.col(fill);
  if (k === 1) rect(ctx, b.x + 1, b.y + 1, b.w - 2, b.h - 2);
  else { rect(ctx, b.x + 2, b.y + 1, b.w - 4, b.h - 2); rect(ctx, b.x + 1, b.y + 2, b.w - 2, b.h - 4); }
}

/**
 * A lid: `scale` fill whose lowest row is its own 1 px ink edge, `rows[c]` interior rows deep over interior column c
 * (never < 2: a 1-row lid is just a thicker ring); a flat lid repeats one number, a wedge steps. The skin and the ink
 * edge span the WHOLE ring, its side columns and cut corners included, from the ring's top down (a side column
 * takes its neighbour's depth): a lid over the interior only left the ring's sides standing above its edge as two
 * ink posts, and every lidded eye (and the blink's half-lid) read as a "U" cup instead of a lidded almond.
 */
function lid(ctx: CanvasRenderingContext2D, rig: DragonRig, b: EyeBox, rows: readonly number[]): void {
  const k = cutOf(rig), lidCol = rig.col(rig.pal.scale), ink = rig.col(rig.outline), iw = b.w - 2;
  for (let X = 0; X < b.w; X++) {
    const r = rows[Math.max(0, Math.min(iw - 1, X - 1))];
    if (r <= 0) continue;
    const top = Math.max(0, k - Math.min(X, b.w - 1 - X));   // the ring's first row in this column (cut corners)
    ctx.fillStyle = lidCol; rect(ctx, b.x + X, b.y + top, 1, r - top);
    ctx.fillStyle = ink; rect(ctx, b.x + X, b.y + r, 1, 1);    // outer row r = interior row r - 1
  }
}

/**
 * The stage eye interior (open), into box b. `round`: a round pupil instead of the slit / oval (hungry, surprised...).
 * `pinned`: the stage pupil CONTRACTED (pose.pupil: lightning's wind-up, 3.5).
 */
function openEye(ctx: CanvasRenderingContext2D, rig: DragonRig, b: EyeBox, round: number, sparkle: boolean, look: number, pinned = false): void {
  const ix = b.x + 1, iy = b.y + 1, iw = b.w - 2, ih = b.h - 2;
  const iris = rig.pal.eye, pupil = rig.col(DRAGON_SHARED.pupil), cl = rig.col(DRAGON_SHARED.catchlight);
  ring(ctx, rig, b, iris);
  const st = rig.stage, c1 = cutOf(rig) - 1;   // c1: the almond's corners are ink one pixel further in
  if (round > 0) {
    // round pupil centred (look: 1 = down and back, the sheepish glance)
    const px = look ? ix + c1 : ix + Math.floor((iw - round) / 2), py = look ? iy + ih - round : iy + Math.floor((ih - round) / 2);
    ctx.fillStyle = pupil; rect(ctx, px, py, round, round);
    ctx.fillStyle = cl;
    if (!look) {
      if (round >= 4) rect(ctx, px, py, 2, 2);
      else rect(ctx, ix + c1, iy, 2, 2);
      if (sparkle) rect(ctx, ix + iw - 2 - c1, iy + ih - 2, 2, 2);
    }
    return;
  }
  ctx.fillStyle = pupil;
  if (st === 'baby') {
    // top 4 rows pupil (a dark glossy baby eye), bottom rows iris; catchlight top-left on the pupil. Contracted, a
    // 3 x 2 at the top of that block's place, the catchlight on its top-left
    if (pinned) rect(ctx, ix + 1, iy, 3, 2);
    else rect(ctx, ix, iy, iw, Math.min(4, ih - 2) + (ih - 6));
    ctx.fillStyle = cl; rect(ctx, pinned ? ix + 1 : ix, iy, 2, 2);
    if (sparkle) rect(ctx, ix + iw - 2, iy + 2, 2, 2);
  } else if (st === 'young') {
    // iris field, a 3 x 4 oval pupil centred across it and set at its top (columns 1..3, rows 0..3 of 5 x 5), so
    // iris frames it front, back and below; catchlight on its top-left. In the bottom-front corner it touched the
    // ring on two sides and fused with it into a 3 px black "L" (the adult's E2 problem): a boxy "P" glyph.
    // (contracted: 2 x 3 in the oval's place, the catchlight on its top-left as on the adult slit, which leaves an
    // "L" of dark beside and under the glint)
    const px = ix + ((iw - 3) >> 1), py = iy + Math.max(0, (ih - 5) >> 1);
    if (pinned) rect(ctx, px + 1, py, 2, 3);
    else rect(ctx, px, py, 3, 4);
    ctx.fillStyle = cl; rect(ctx, px, py, 2, 2);
    if (sparkle) rect(ctx, ix + iw - 2, iy + ih - 2, 2, 2);
  } else {
    // 2 x 4 slit in columns 2..3 with iris on BOTH sides (a slit touching the ring fuses into it: E2); the almond's
    // top-left interior pixel is ink, so the catchlight steps in a column and sits on the slit's top-left, a glint
    // on the pupil as on the young eye
    // (contracted: the slit is already at the 2 px floor, so the iris closes over its top row instead)
    rect(ctx, ix + 2, iy + (pinned ? 1 : 0), 2, ih - (pinned ? 1 : 0));
    ctx.fillStyle = cl; rect(ctx, ix + 1, iy, 2, 2);
    if (sparkle) rect(ctx, ix + 3, iy + ih - 2, 2, 2);
  }
}

/**
 * Lid depth per interior column, back -> front (2.5 table: rows, counted in the interior). The adult's sleepy lid is
 * 2 rows, not 3: over its 4-row almond a 3-row lid left one row whose cut corners split the iris into two lone
 * 1 x 1 pixels beside the slit (under the mark floor); at 2 it leaves 2 rows of iris | slit | iris. Its sad wedge
 * goes one row deeper over column 1 for the same reason: 3 rows there left a lone iris pixel beside the cut corner.
 */
const ADULT_LIDS = { sleepy: [2, 2, 2, 2, 2, 2], sad: [3, 4, 3, 2, 2, 2], grumpy: [2, 2, 2, 2, 2, 2], sheepish: [2, 2, 2, 2, 2, 2] } as const;
const LIDS = {
  baby: { sleepy: [4, 4, 4, 4, 4], sad: [3, 3, 2, 2, 2], grumpy: [2, 2, 2, 2, 2], sheepish: [3, 3, 3, 3, 3] },
  young: { sleepy: [3, 3, 3, 3, 3], sad: [3, 3, 2, 2, 2], grumpy: [2, 2, 2, 2, 2], sheepish: [2, 2, 2, 2, 2] },
  adult: ADULT_LIDS,
  // the elder has the adult's eye, so the adult's lids, row for row (2.5)
  elder: ADULT_LIDS,
} as const;

/**
 * Draw the eye for `face` in face space (origin at the eye centre). Only the near eye is drawn: the far eye is
 * hidden in profile. The eye is never covered: the head group is drawn last (bible 1.4).
 */
export function drawEye(ctx: CanvasRenderingContext2D, rig: DragonRig, face: number, pinned = false): void {
  const L = LIDS[rig.stage], ink = rig.col(rig.outline);
  const adult = grown(rig.stage);
  switch (face) {
    case DFACE.happy: {
      // "^" arc: 2 px ink, the eye's width, 3 tall. Upside down (rock's roll onto its back, face space flipped with
      // the head) the rows are mirrored, so the arc still reads "^" on screen: flipped with the head it read "v"
      const b = eyeBox(rig, 0), w = b.w, x = b.x, y = b.y + Math.floor(b.h / 2) - 1, flip = rig.tf.ss < 0;
      ctx.fillStyle = ink;
      const half = Math.floor(w / 2);
      for (let i = 0; i < half; i++) {
        const d0 = Math.max(0, 2 - Math.floor(i * 3 / half)), dy = flip ? 2 - d0 : d0;
        rect(ctx, x + i, y + dy, 1, 2);
        rect(ctx, x + w - 1 - i, y + dy, 1, 2);
      }
      if (w % 2) rect(ctx, x + half, y + (flip ? 2 : 0), 1, 2);
      return;
    }
    case DFACE.closed: {
      const b = eyeBox(rig, 0);
      ctx.fillStyle = ink; rect(ctx, b.x, b.y + Math.floor(b.h / 2), b.w, 2);
      return;
    }
    case DFACE.dazed: {
      // a 2 px ink ">" chevron, squeezed shut (the engine's 1 px X-eyes fall under the mark floor)
      const b = eyeBox(rig, 0), cy = b.y + Math.floor(b.h / 2), hw = Math.floor(b.w / 2);
      ctx.fillStyle = ink;
      for (let i = 0; i < hw; i++) {
        const dy = Math.floor((hw - 1 - i) * (b.h / 2 - 1) / Math.max(1, hw - 1));
        rect(ctx, b.x + 1 + i, cy - 1 - dy, 2, 2);
        rect(ctx, b.x + 1 + i, cy + dy - 1, 2, 2);
      }
      return;
    }
    case DFACE.hungry: {
      const b = eyeBox(rig, 1);
      openEye(ctx, rig, b, adult ? 4 : 0, true, 0);
      return;
    }
    case DFACE.surprised: case DFACE.scared: {
      if (rig.stage === 'baby') {
        // the baby: a 3 x 4 pupil with its iris a 1 px ring all round it, in the stage ring (grown, a 2 x 2 pupil
        // sat in a 7 x 8 field of iris: an orange square, and surprised and scared both read as it: the cast review)
        const b = eyeBox(rig, 0), ix = b.x + 1, iy = b.y + 1;
        ring(ctx, rig, b, rig.pal.eye);
        ctx.fillStyle = rig.col(DRAGON_SHARED.pupil); rect(ctx, ix + 1, iy + 1, b.w - 4, b.h - 4);
        ctx.fillStyle = rig.col(DRAGON_SHARED.catchlight); rect(ctx, ix + 1, iy + 1, 2, 2);
        return;
      }
      const b = eyeBox(rig, 1);
      openEye(ctx, rig, b, 2, false, 0);
      return;
    }
    case DFACE.sleepy: { const b = eyeBox(rig, 0); openEye(ctx, rig, b, 0, false, 0, pinned); lid(ctx, rig, b, L.sleepy); return; }
    case DFACE.sad: {
      const b = eyeBox(rig, 0);
      openEye(ctx, rig, b, 0, false, 0, pinned);
      lid(ctx, rig, b, L.sad);
      return;
    }
    case DFACE.grumpy: { const b = eyeBox(rig, 0); openEye(ctx, rig, b, 0, false, 0, pinned); lid(ctx, rig, b, L.grumpy); return; }
    case DFACE.sheepish: {
      const b = eyeBox(rig, 0);
      openEye(ctx, rig, b, adult ? 2 : 3, false, 1);
      lid(ctx, rig, b, L.sheepish);
      return;
    }
    default: { const b = eyeBox(rig, 0); openEye(ctx, rig, b, 0, false, 0, pinned); }
  }
}

/**
 * Is face-space pixel (fx, fy) -- its centre -- at least half a pixel inside the skull path? Face space is entered
 * at the eye (rig.ts drawHeadGroup), so the pixel is walked back to cranium space through the head's angle. A face
 * mark drawn only on such pixels never crosses the skull's contour, whatever the head's pitch.
 */
export function facePixelInSkull(rig: DragonRig, fx: number, fy: number, pad = 0.5): boolean {
  const J = rig.j, t = rig.tf, sc = t.fs || 1;
  // the face origin as faceTransform snaps it (to a whole device pixel), back in root space
  const X0 = Math.round(sc * (t.rx + J.eye.x)) / sc - t.rx, Y0 = Math.round(t.ss * (t.ry + J.eye.y)) / t.ss - t.ry;
  // (a head that looks back runs its face mirrored and its cranium space flipped in y: rig.ts J.headFlip)
  const a = J.headAng * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), hf = J.headFlip;
  const dx = X0 + hf * (fx + 0.5) - J.cran.x, dy = Y0 + (t.ss < 0 ? -1 : 1) * (fy + 0.5) - J.cran.y;
  return inSkull(rig, dx * c + dy * s, hf * (-dx * s + dy * c), pad);
}

/**
 * The 2 px brow bar in `scale.deep` (2.5 table), in whole pixels, placed from the eye actually drawn: its lowest
 * end 1 px clear of the ring's top (of the "^" arc's top when happy), the expression tilting its front end up or
 * down from there (a 3 px brow reads as a lid). The WHOLE bar must lie inside the skull (both pixels of every
 * column): bars placed 3 px above the box sat on the skull's top contour and read as a visor, and on a head tilted
 * up (beg) stood out of the silhouette as a dark tuft. Where the expression's lift does not fit, the bar is lowered
 * a pixel at a time, each end stopping at its floor (so a lift gives way to a tilt, then to a flat bar) rather than
 * dropped: the grow faces (hungry, surprised, scared: the ring 1 px bigger each way) have no room above their ring
 * on any head, and clipped to the skull their brow vanished or left a 2 px nick on the contour. Their floor is
 * measured from the UN-grown ring, so the bar may sit directly on the grown ring's top (its back end, tilted). Only
 * if no drop fits is the longest inside run drawn, and never one under 3 columns (a 2-column stub on the contour is
 * a speck). Babies show one only in expressions (2.1). Face space.
 */
export function drawBrow(ctx: CanvasRenderingContext2D, rig: DragonRig, face: number, deep: string): void {
  const hd = rig.dims.head, elder = rig.stage === 'elder';
  let len = hd.browLen;
  // (upside down, the brow would lie under the screen-upright "^" and read as a mouth line)
  if (rig.tf.ss < 0) return;
  // THE ELDER'S TUFT (2.5): the same bar, as pigment in the tuft grey (`deep` is rig.greys.tuft: the muzzle's, or a
  // pale grey of its own on water and rock), at EVERY face -- neutral, and shut (closed, dazed: relaxed, level) as
  // well, since it is hair on the hide, not an expression mark. 7 px from 1 px behind the ring, its top edge LEVEL: a
  // bar lower at the back is the `sad` tilt and put a worried brow on every neutral elder (the v2 review). Its length
  // and colour carry the age, never its tilt. On a pale-muzzled elder (palettes.ts TUFT_LUM) it is 5 px with rounded
  // ends, its two top corners dropped: 7 x 2 in the frost's near-white it read as a strip of tape (cast review v2).
  if (!elder && (face === DFACE.dazed || face === DFACE.closed)) return;
  // no bar at neutral on the other stages (2.5 amendment): on young and adult the brow-ridge bump in the skull contour
  // already carries the stage, and a flat dark bar over a resting eye read as a visor; the bar is for expressions
  if (!elder && face === DFACE.neutral) return;
  if (!len) {
    if (face === DFACE.happy || face === DFACE.sleepy) return;
    len = 5;
  }
  const short = elder && TUFT_LUM[rig.element] != null;
  if (short) len = 5;
  const grow = face === DFACE.hungry || face === DFACE.surprised || face === DFACE.scared ? 1 : 0;
  // the eye's VISIBLE top: the "^" arc's top when happy; a lid's ink edge on a lidded eye (the lid is skin, so the
  // ring's top row under it does not show: measured from the ring, a sleepy brow floated 3 px over the lid)
  const L = LIDS[rig.stage], lidRows = face === DFACE.sleepy ? L.sleepy : face === DFACE.sad ? L.sad
    : face === DFACE.grumpy ? L.grumpy : face === DFACE.sheepish ? L.sheepish : null;
  const b = eyeBox(rig, grow);
  // (shut, the elder's tuft keeps its open-eye place: the closed line and the ">" sit mid-eye, and a tuft lowered onto
  // them read as a heavy lid)
  const top = face === DFACE.happy ? b.y + Math.floor(b.h / 2) - 1 : lidRows ? b.y + minOf(lidRows) : b.y + grow;
  // (the elder's tuft runs from 1 px behind the ring forward; the bar is centred over the eye)
  const x0 = elder ? b.x - 1 : b.x + Math.max(0, Math.floor((b.w - len) / 2));
  // the bar's top row at its back end and front end (+x is the snout side): 1 px clear = top - 3
  let yb = top - 3, yf = top - 3;
  switch (face) {
    case DFACE.happy: case DFACE.surprised: yb = yf = top - 4; break;      // up 1 px
    case DFACE.hungry: case DFACE.scared: yf = top - 5; break;             // front end up 2 px (pleading)
    case DFACE.sad: case DFACE.sheepish: yf = top - 4; break;              // front end up 1 px
    case DFACE.grumpy: yf = top - 2; break;                                // front end down, pressed onto the lid
  }
  // lower the bar until it lies wholly inside the skull; each end stops at the floor (1 px clear), or where it
  // already sits if lower (grumpy's pressed front end)
  const lo = top - 3;
  let dyB = yb, dyF = yf, best0 = 0, bestN = 0, fit = false;
  for (let k = 0; k <= 3 && !fit; k++) {
    const qb = Math.max(yb, Math.min(yb + k, lo)), qf = Math.max(yf, Math.min(yf + k, lo));
    let run0 = 0, runN = 0, b0 = 0, bN = 0;
    for (let i = 0; i < len; i++) {
      const y = browRow(qb, qf, len, i);
      if (facePixelInSkull(rig, x0 + i, y) && facePixelInSkull(rig, x0 + i, y + 1)) {
        if (!runN) run0 = i;
        runN++;
        if (runN > bN) { bN = runN; b0 = run0; }
      } else runN = 0;
    }
    fit = bN === len;
    if (bN > bestN || fit) { bestN = bN; best0 = b0; dyB = qb; dyF = qf; }
  }
  if (bestN < 3) return;
  ctx.fillStyle = rig.col(deep);
  for (let i = best0; i < best0 + bestN; i++) {
    const x = x0 + i, y = browRow(dyB, dyF, len, i);
    if (!elder || rig.override) { rect(ctx, x, y, 1, 2); continue; }
    // the tuft is pigment: a pixel in the skull's highlight cap, or 4-adjacent to it, is dropped (a silvered cap and
    // a pale tuft need not clear each other: 2.5), so the tuft never smears the silver crown; the short tuft's end
    // columns keep their bottom pixel only (the top corners dropped: rounded, and level, no tilt either way)
    for (let k = 0; k < 2; k++) {
      if (short && k === 0 && (i === 0 || i === len - 1)) continue;
      if (!nearHiCap(rig, x, y + k)) rect(ctx, x, y + k, 1, 1);
    }
  }
}

/**
 * Is face-space pixel (fx, fy) in the skull's HIGHLIGHT cap, or 4-adjacent to it? The cap is celPath's (parts.ts
 * drawSkull): the part of the skull within 0.3 of the head's extent from its lit edge, toward the light in cranium
 * space, drawn only on a head long enough for a highlight (ext >= 10: young, adult, elder).
 */
function nearHiCap(rig: DragonRig, fx: number, fy: number): boolean {
  const b = skullBands(rig);
  if (b.ext < 10 || rig.tonesN === 2) return false;
  return inHiCap(rig, fx, fy, b.cx, b.ext) || inHiCap(rig, fx - 1, fy, b.cx, b.ext) || inHiCap(rig, fx + 1, fy, b.cx, b.ext)
    || inHiCap(rig, fx, fy - 1, b.cx, b.ext) || inHiCap(rig, fx, fy + 1, b.cx, b.ext);
}
function inHiCap(rig: DragonRig, fx: number, fy: number, cx: number, ext: number): boolean {
  if (!facePixelInSkull(rig, fx, fy)) return false;
  faceToCranium(rig, fx, fy, FC);
  // the root-space light (up-left; mirrored with the sprite, so a facing never changes it), turned into cranium space
  const J = rig.j, a = J.headAng * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), ly0 = rig.tf.ss < 0 ? 0.7071 : -0.7071;
  const lx = -0.7071 * c + ly0 * s, ly = (0.7071 * s + ly0 * c) * J.headFlip;
  return (FC.x - cx) * lx + FC.y * ly >= ext * 0.7;
}
const FC = { x: 0, y: 0 };

/** Face-space pixel (fx, fy)'s centre -> cranium space (the inverse facePixelInSkull walks), into `out`. */
function faceToCranium(rig: DragonRig, fx: number, fy: number, out: { x: number; y: number }): void {
  const J = rig.j, t = rig.tf, sc = t.fs || 1;
  const X0 = Math.round(sc * (t.rx + J.eye.x)) / sc - t.rx, Y0 = Math.round(t.ss * (t.ry + J.eye.y)) / t.ss - t.ry;
  const a = J.headAng * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), hf = J.headFlip;
  const dx = X0 + hf * (fx + 0.5) - J.cran.x, dy = Y0 + (t.ss < 0 ? -1 : 1) * (fy + 0.5) - J.cran.y;
  out.x = dx * c + dy * s; out.y = hf * (-dx * s + dy * c);
}

/**
 * The elder's grey MUZZLE (2.5): a face-space bitmap of every pixel on the skull whose cranium x >= x0 - 0.3 y (its back
 * edge slanting back 1 px for every 3 px down), about 8 x 6 px over the front of the snout, the nostril on it. Pigment:
 * never inked, drawn before the eye, nostril and mouth marks so they sit on it (1.4 step 12.4, after slinkwing's mask
 * and dusk's frost), and CLIPPED TO THE SKULL PATH by the caller (rig.ts drawHeadGroup): the bitmap takes every pixel
 * the skull touches and the clip trims it to the fill, so the grey meets the skull's ink as the scale does. (Taking
 * only pixels whose centre lay 0.5 px inside left a 1 px rim of scale and its shadow tone between the muzzle and the
 * ink along the snout's top and round its tip, under the mark floor: the elder core review.) It never meets the belly
 * (the closed jaw's sliver or the open mouth lies between them) nor the head's highlight cap on the top-back of the
 * cranium. x0 is 11 on fire's snout, and on a shorter snout keeps the same size from its tip, never closer than 2.5 px
 * to the eye's ring. Face space.
 */
export function drawMuzzle(ctx: CanvasRenderingContext2D, rig: DragonRig, hex: string): void {
  const H = rig.dims.head, tip = H.snout.x1 + H.snout.r1, x0 = Math.max(H.eye.x + H.eye.w / 2 + 2.5, Math.min(11, tip - 8.3));
  ctx.fillStyle = rig.col(hex);
  // the snout's box in face space, generously: the eye is face (0, 0), the snout runs forward and a little down
  const R = Math.ceil(tip - H.eye.x + 3);
  for (let fy = -R; fy <= R; fy++) {
    let run = 0;
    for (let fx = -R; fx <= R + 1; fx++) {
      let on = false;
      if (fx <= R && facePixelInSkull(rig, fx, fy, -0.75)) {
        faceToCranium(rig, fx, fy, FC);
        on = FC.x >= x0 - 0.3 * FC.y;
      }
      if (on) run++;
      else if (run) { rect(ctx, fx - run, fy, run, 1); run = 0; }
    }
  }
}
/** The smallest entry of a lid table row (allocation-free). */
function minOf(a: readonly number[]): number { let m = a[0]; for (let i = 1; i < a.length; i++) m = Math.min(m, a[i]); return m; }
/** Row of brow column i: the back end's row stepping to the front end's across the bar. */
function browRow(yb: number, yf: number, len: number, i: number): number { return Math.round(yb + (yf - yb) * (i / Math.max(1, len - 1))); }

/**
 * Opaque blush under and behind the eye (babies 4 x 2, others 3 x 2), `blushOf(element)`. Face space. Upside down
 * it stays under the eye ON SCREEN (the forehead side of the flipped head), with the "^" it goes with: above an
 * upright arc it read as a pink brow.
 */
export function drawBlush(ctx: CanvasRenderingContext2D, rig: DragonRig): void {
  const b = eyeBox(rig, 0), w = rig.stage === 'baby' ? 4 : 3;
  ctx.fillStyle = rig.col(blushOf(rig.element));
  rect(ctx, b.x - 1, rig.tf.ss < 0 ? b.y - 3 : b.y + b.h + 1, w, 2);
}

/** Faces that show the blush. */
export function faceBlushes(face: number): boolean { return face === DFACE.happy || face === DFACE.sheepish; }

/** 2 x 2 nostril in `dark`, at face-space (x, y). */
export function drawNostril(ctx: CanvasRenderingContext2D, rig: DragonRig, x: number, y: number): void {
  ctx.fillStyle = rig.col(rig.pal.dark); rect(ctx, x, y, 2, 2);
}

/**
 * Mouth-corner marks at face-space (x, y) -- the back end of the closed mouth line, on the skull's lower contour --
 * as 2 px wide strokes (the mark floor: 1 px ink stairs fell under it), whole pixels, each pixel drawn only where it
 * lies inside the skull (on rock and baby heads a notch that left the contour sat on the cheek and read as a tear;
 * the frown's ticks hung below the jaw line) and >= 2 px of skin clear of the eye's box: on a baby's head the mouth
 * corner lies just under the eye, and the happy notch against the "^" arc's front leg turned the eye into a hook or
 * a "?" (there the blush and the open jaw carry the smile, 2.5). Happy, an upturn rising toward the back ("\" at
 * the corner); hungry and sad, the corner pulled down (a "/" rising forward from it); grumpy, a flat 3 x 2 pout.
 */
export function drawMouthMark(ctx: CanvasRenderingContext2D, rig: DragonRig, face: number, x: number, y: number): void {
  const b = eyeBox(rig, face === DFACE.hungry || face === DFACE.surprised || face === DFACE.scared ? 1 : 0);
  EB.x = b.x - 2; EB.y = b.y - 2; EB.w = b.w + 4; EB.h = b.h + 4;
  ctx.fillStyle = rig.col(rig.outline);
  if (face === DFACE.happy) { stamp(ctx, rig, x - 1, y - 1); stamp(ctx, rig, x - 2, y - 2); }
  else if (face === DFACE.hungry || face === DFACE.sad) { stamp(ctx, rig, x - 1, y - 1); stamp(ctx, rig, x, y - 2); }
  else if (face === DFACE.grumpy) { stamp(ctx, rig, x - 2, y - 1); stamp(ctx, rig, x - 1, y - 1); }
}
/** The eye's box grown by the 2 px of skin a mouth mark keeps from it (drawMouthMark's scratch). */
const EB: EyeBox = { x: 0, y: 0, w: 0, h: 0 };
/** A 2 x 2 stamp at face-space (x, y), each pixel only inside the skull and outside EB. */
function stamp(ctx: CanvasRenderingContext2D, rig: DragonRig, x: number, y: number): void {
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
    const X = x + i, Y = y + j;
    if (X >= EB.x && X < EB.x + EB.w && Y >= EB.y && Y < EB.y + EB.h) continue;
    if (facePixelInSkull(rig, X, Y)) rect(ctx, X, Y, 1, 1);
  }
}

/** The egg tooth (babies): 2 x 2 catchlight-white on the snout tip. Face space. */
export function drawEggTooth(ctx: CanvasRenderingContext2D, rig: DragonRig, x: number, y: number): void {
  ctx.fillStyle = rig.col(DRAGON_SHARED.catchlight); rect(ctx, x, y, 2, 2);
}

/**
 * Fangs hanging from the upper jaw line (jaw open only): young 1 x (2 x 2), adult 2 x (2 x 3), the elder's worn to
 * 2 x (2 x 2) (still the mark floor: 2.1). Face space.
 */
export function drawFangs(ctx: CanvasRenderingContext2D, rig: DragonRig, x: number, y: number): void {
  const t = rig.dims.head.teeth;
  if (t === 'egg') return;
  ctx.fillStyle = rig.col(DRAGON_SHARED.catchlight);
  if (t === 'fang1') rect(ctx, x, y, 2, 2);
  else { const h = t === 'worn' ? 2 : 3; rect(ctx, x, y, 2, h); rect(ctx, x - 5, y, 2, h); }
}
