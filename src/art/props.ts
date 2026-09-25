// Habitat props the dragons and the keepers share. The food bowl first (bible 4.2: "the bowl is drawn after the
// dragon"): the gallery once drew it for an eating pet on its own; now a keeper carries it in, sets it where the
// dragon's snout will dip, and takes it away again (src/care/acts.ts), so the one bowl lives here.
import { solveDragon } from './dragon/rig.ts';
import type { DragonRig } from './dragon/rig.ts';
import { ACT } from './dragon/pose.ts';
import type { PartialDragonPose } from './dragon/pose.ts';

/** The clay bowl, its shadow tone and the food heaped in it. */
export const BOWL = '#8c4a3a', BOWL_SH = '#6a3428', FOOD_TOP = '#b87a3a';
const INK = '#1a1018';

/** Where a dragon's bowl stands: root-space x of its centre (along facing), its height and width, px. */
export interface BowlSpot { x: number; h: number; w: number }

/**
 * Where the eat bowl stands (4.2: "the bowl is drawn after the dragon"): under the snout at the chomp (the frame
 * whose act clock is 0), its rim 2 px above the mouth line, so the snout tip dips in behind the rim.
 */
export function bowlFor(rig: DragonRig, frames: readonly { pose?: PartialDragonPose | null }[]): BowlSpot {
  const f = frames.find((fr) => fr.pose && fr.pose.act === ACT.eat && Math.abs(fr.pose.cue ?? 1) < 0.5);
  // (solved with the jaw shut: an open jaw moves the mouth anchor down into the opening)
  const J = solveDragon(rig, f && f.pose ? { ...f.pose, jaw: 0 } : {}, { x: 0, y: 0 });
  const w = rig.stage === 'adult' || rig.stage === 'elder' ? 17 : rig.stage === 'young' ? 15 : 11;
  // the bowl is drawn AFTER the dragon, so its top (the food heaped 2 px over the rim) stays >= 2 px under the eye's
  // largest box: at the rim the baby's eye sat on it (hard rule: nothing covers the eye)
  const eyeBottom = J.eye.y + rig.info.eye.h / 2;
  return { x: Math.round(J.mouth.x - 1), h: Math.max(4, Math.min(Math.round(-J.mouth.y) + 1, Math.floor(-(eyeBottom + 2) - 2))), w };
}

/**
 * A simple food bowl, whole game pixels at scale `sc`, its foot on the floor row `gy` and its centre at `cx` (screen):
 * an inked clay bowl, widest at the rim and rounding in toward its foot, with a low mound of food over the rim while
 * `full`. Its rim sits a couple of px over a dragon's snout at the chomp, so the snout dips in behind it.
 */
export function drawBowl(ctx: CanvasRenderingContext2D, cx: number, gy: number, w: number, h: number, sc: number, full = true): void {
  const px = (x: number, y: number, ww: number, hh: number, c: string) => {
    ctx.fillStyle = c; ctx.fillRect(Math.round(cx + x * sc), Math.round(gy + y * sc), Math.max(1, Math.round(ww * sc)), Math.max(1, Math.round(hh * sc)));
  };
  const half = w >> 1;
  // row r (0 = the rim, h - 1 = the foot) is inset by a curve that rounds in toward the foot
  const inset = (r: number) => Math.round(3 * Math.pow(r / Math.max(1, h - 1), 2.2));
  for (let r = 0; r < h; r++) px(-half - 1 + inset(r), -h + r, w + 2 - 2 * inset(r), 1, INK);
  px(-half + inset(h - 1), 0, w - 2 * inset(h - 1), 1, INK);
  px(-half - 1, -h - 1, w + 2, 1, INK);
  for (let r = 0; r < h; r++) px(-half + inset(r), -h + r, w - 2 * inset(r), 1, r === 0 ? BOWL_SH : r > h * 0.6 ? BOWL_SH : BOWL);
  // the food: a low mound over the rim (eaten: the rim's inside shows, one row of shadow)
  if (full) { px(-half + 2, -h - 2, w - 4, 1, INK); px(-half + 1, -h - 1, w - 2, 1, FOOD_TOP); }
}
