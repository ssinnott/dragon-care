// The dragon face (docs/ART_BIBLE.md 2.5): DFACE, the stage eye, lids counted in rows, brow bar, blush, nostril,
// mouth marks and teeth.
//
// FACE SPACE. The eye is a pixel construction (a 1 px ink ring round flat rects: 7 x 8 / 7 x 7 / 8 x 6), and a
// rotated or squashed rect is anti-aliased mush at this size. So rig.ts draws the face in a space that is
// device-aligned: origin snapped to a whole device pixel at the eye centre, one unit = one sprite pixel, mirrored
// by facing but never rotated with the head nor scaled by squash. Every function here draws there, in whole px.
// Everything goes through rig.col so the flash and silhouette overrides reach the face too.
import { brow } from '../../lib/art/rigParts.ts';
import { DRAGON_SHARED, blushOf } from './palettes.ts';
import { DFACE } from './pose.ts';
import type { DragonRig } from './rig.ts';

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

/** The 1 px ink ring with 1 px cut corners, filled with `fill` inside. */
function ring(ctx: CanvasRenderingContext2D, rig: DragonRig, b: EyeBox, fill: string): void {
  ctx.fillStyle = rig.col(rig.outline);
  rect(ctx, b.x + 1, b.y, b.w - 2, b.h); rect(ctx, b.x, b.y + 1, b.w, b.h - 2);
  ctx.fillStyle = rig.col(fill);
  rect(ctx, b.x + 1, b.y + 1, b.w - 2, b.h - 2);
}

/**
 * A lid of `rows` interior rows: `scale` fill whose lowest row is its own 1 px ink edge (never < 2 rows: a 1-row lid
 * is just a thicker ring). `back` / `front` give a wedge: rows over the back columns and the front columns.
 */
function lid(ctx: CanvasRenderingContext2D, rig: DragonRig, b: EyeBox, backRows: number, frontRows: number, backCols: number): void {
  const ix = b.x + 1, iy = b.y + 1, iw = b.w - 2;
  const lidCol = rig.col(rig.pal.scale), ink = rig.col(rig.outline);
  for (let c = 0; c < iw; c++) {
    const rows = c < backCols ? backRows : frontRows;
    if (rows <= 0) continue;
    ctx.fillStyle = lidCol; rect(ctx, ix + c, iy - 1, 1, rows);          // covers the ring top too, so the lid is skin
    ctx.fillStyle = ink; rect(ctx, ix + c, iy - 1 + rows, 1, 1);
  }
}

/** The stage eye interior (open), into box b. `round`: a round pupil instead of the slit / oval (hungry, surprised...). */
function openEye(ctx: CanvasRenderingContext2D, rig: DragonRig, b: EyeBox, round: number, sparkle: boolean, look: number): void {
  const ix = b.x + 1, iy = b.y + 1, iw = b.w - 2, ih = b.h - 2;
  const iris = rig.pal.eye, pupil = rig.col(DRAGON_SHARED.pupil), cl = rig.col(DRAGON_SHARED.catchlight);
  ring(ctx, rig, b, iris);
  const st = rig.stage;
  if (round > 0) {
    // round pupil centred (look: 1 = down and back, the sheepish glance)
    const px = look ? ix : ix + Math.floor((iw - round) / 2), py = look ? iy + ih - round : iy + Math.floor((ih - round) / 2);
    ctx.fillStyle = pupil; rect(ctx, px, py, round, round);
    ctx.fillStyle = cl;
    if (!look) {
      if (round >= 4) rect(ctx, px, py, 2, 2);
      else rect(ctx, ix, iy, 2, 2);
      if (sparkle) rect(ctx, ix + iw - 2, iy + ih - 2, 2, 2);
    }
    return;
  }
  ctx.fillStyle = pupil;
  if (st === 'baby') {
    // top 4 rows pupil (a dark glossy baby eye), bottom rows iris; catchlight top-left on the pupil
    rect(ctx, ix, iy, iw, Math.min(4, ih - 2) + (ih - 6));
    ctx.fillStyle = cl; rect(ctx, ix, iy, 2, 2);
    if (sparkle) rect(ctx, ix + iw - 2, iy + 2, 2, 2);
  } else if (st === 'young') {
    // iris field, a 3 x 4 oval pupil in columns 2..4, catchlight on its top-left
    rect(ctx, ix + 2, iy + ih - 4, 3, 4);
    ctx.fillStyle = cl; rect(ctx, ix + 2, iy + ih - 4, 2, 2);
    if (sparkle) rect(ctx, ix, iy + ih - 2, 2, 2);
  } else {
    // 2 x 4 slit in columns 2..3 with iris on BOTH sides (a slit touching the ring fuses into it: E2)
    rect(ctx, ix + 2, iy, 2, ih);
    ctx.fillStyle = cl; rect(ctx, ix, iy, 2, 2);
    if (sparkle) rect(ctx, ix + 4, iy + ih - 2, 2, 2);
  }
}

/** Lid rows per stage (2.5 table): [sleepy, sad back, sad front, sad back cols, grumpy, sheepish]. */
const LIDS = {
  baby: { sleepy: 4, sadB: 3, sadF: 2, sadCols: 2, grumpy: 2, sheepish: 3 },
  young: { sleepy: 3, sadB: 3, sadF: 2, sadCols: 2, grumpy: 2, sheepish: 2 },
  adult: { sleepy: 3, sadB: 3, sadF: 2, sadCols: 3, grumpy: 2, sheepish: 2 },
} as const;

/**
 * Draw the eye for `face` in face space (origin at the eye centre). Only the near eye is drawn: the far eye is
 * hidden in profile. The eye is never covered: the head group is drawn last (bible 1.4).
 */
export function drawEye(ctx: CanvasRenderingContext2D, rig: DragonRig, face: number): void {
  const L = LIDS[rig.stage], ink = rig.col(rig.outline);
  const adult = rig.stage === 'adult';
  switch (face) {
    case DFACE.happy: {
      // "^" arc: 2 px ink, the eye's width, 3 tall
      const b = eyeBox(rig, 0), w = b.w, x = b.x, y = b.y + Math.floor(b.h / 2) - 1;
      ctx.fillStyle = ink;
      const half = Math.floor(w / 2);
      for (let i = 0; i < half; i++) {
        const dy = Math.max(0, 2 - Math.floor(i * 3 / half));
        rect(ctx, x + i, y + dy, 1, 2);
        rect(ctx, x + w - 1 - i, y + dy, 1, 2);
      }
      if (w % 2) rect(ctx, x + half, y, 1, 2);
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
      const b = eyeBox(rig, 1);
      openEye(ctx, rig, b, 2, false, 0);
      return;
    }
    case DFACE.sleepy: { const b = eyeBox(rig, 0); openEye(ctx, rig, b, 0, false, 0); lid(ctx, rig, b, L.sleepy, L.sleepy, 0); return; }
    case DFACE.sad: {
      const b = eyeBox(rig, 0);
      openEye(ctx, rig, b, 0, false, 0);
      lid(ctx, rig, b, L.sadB, L.sadF, L.sadCols);
      return;
    }
    case DFACE.grumpy: { const b = eyeBox(rig, 0); openEye(ctx, rig, b, 0, false, 0); lid(ctx, rig, b, L.grumpy, L.grumpy, 0); return; }
    case DFACE.sheepish: {
      const b = eyeBox(rig, 0);
      openEye(ctx, rig, b, adult ? 2 : 3, false, 1);
      lid(ctx, rig, b, L.sheepish, L.sheepish, 0);
      return;
    }
    default: { const b = eyeBox(rig, 0); openEye(ctx, rig, b, 0, false, 0); }
  }
}

/**
 * The 2 px brow bar in `scale.deep`, 1 px clear above the eye's ring (a 3 px brow reads as a lid). Babies show one
 * only in expressions (2.1). Shapes per DFACE (2.5 table). Face space.
 */
export function drawBrow(ctx: CanvasRenderingContext2D, rig: DragonRig, face: number, deep: string): void {
  const hd = rig.dims.head;
  let len = hd.browLen;
  if (face === DFACE.dazed || face === DFACE.closed) return;
  if (!len) {
    if (face === DFACE.neutral || face === DFACE.happy || face === DFACE.sleepy) return;
    len = 5;
  }
  const grow = face === DFACE.hungry || face === DFACE.surprised || face === DFACE.scared ? 1 : 0;
  const b = eyeBox(rig, grow);
  const x0 = b.x + Math.max(0, Math.floor((b.w - len) / 2)), x1 = x0 + len, y = b.y - 3;
  ctx.fillStyle = rig.col(deep);
  // front = +x (the eye's snout side). "front end up" = y1 smaller.
  switch (face) {
    case DFACE.happy: case DFACE.surprised: brow(ctx, x0, y - 1, x1, y - 1, 2); break;
    case DFACE.hungry: case DFACE.scared: brow(ctx, x0, y, x1, y - 2, 2); break;
    case DFACE.sad: case DFACE.sheepish: brow(ctx, x0, y, x1, y - 1, 2); break;
    case DFACE.grumpy: brow(ctx, x0, y, x1, y + 1, 2); break;
    case DFACE.sleepy: brow(ctx, x0, y + 1, x1, y + 1, 2); break;
    default: brow(ctx, x0, y, x1, y, 2);
  }
}

/** Opaque blush under and behind the eye (babies 4 x 2, others 3 x 2), `blushOf(element)`. Face space. */
export function drawBlush(ctx: CanvasRenderingContext2D, rig: DragonRig): void {
  const b = eyeBox(rig, 0), w = rig.stage === 'baby' ? 4 : 3;
  ctx.fillStyle = rig.col(blushOf(rig.element));
  rect(ctx, b.x - 1, b.y + b.h + 1, w, 2);
}

/** Faces that show the blush. */
export function faceBlushes(face: number): boolean { return face === DFACE.happy || face === DFACE.sheepish; }

/** 2 x 2 nostril in `dark`, at face-space (x, y). */
export function drawNostril(ctx: CanvasRenderingContext2D, rig: DragonRig, x: number, y: number): void {
  ctx.fillStyle = rig.col(rig.pal.dark); rect(ctx, x, y, 2, 2);
}

/** Mouth-corner marks at face-space (x, y): happy 2 px up-notch, hungry corner down, grumpy pout. */
export function drawMouthMark(ctx: CanvasRenderingContext2D, rig: DragonRig, face: number, x: number, y: number): void {
  ctx.fillStyle = rig.col(rig.outline);
  if (face === DFACE.happy) { rect(ctx, x, y - 1, 1, 2); rect(ctx, x - 1, y - 2, 1, 2); }
  else if (face === DFACE.hungry || face === DFACE.sad) { rect(ctx, x, y, 1, 2); rect(ctx, x - 1, y + 1, 1, 2); }
  else if (face === DFACE.grumpy) { rect(ctx, x - 2, y + 1, 3, 1); }
}

/** The egg tooth (babies): 2 x 2 catchlight-white on the snout tip. Face space. */
export function drawEggTooth(ctx: CanvasRenderingContext2D, rig: DragonRig, x: number, y: number): void {
  ctx.fillStyle = rig.col(DRAGON_SHARED.catchlight); rect(ctx, x, y, 2, 2);
}

/** Fangs hanging from the upper jaw line (jaw open only): young 1 x (2 x 2), adult 2 x (2 x 3). Face space. */
export function drawFangs(ctx: CanvasRenderingContext2D, rig: DragonRig, x: number, y: number): void {
  const t = rig.dims.head.teeth;
  if (t === 'egg') return;
  ctx.fillStyle = rig.col(DRAGON_SHARED.catchlight);
  if (t === 'fang1') rect(ctx, x, y, 2, 2);
  else { rect(ctx, x, y, 2, 3); rect(ctx, x - 5, y, 2, 3); }
}
