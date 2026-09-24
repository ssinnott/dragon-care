// SPIKE: "Bramble", the bramble dragon (docs/ART_BIBLE.md 3.3). Zone: the back line, nape -> tail. Cue: a comb of
// pale bone quills, which lean with its mood; bristling is a separate alarm (pose.bristle).
import { DRAGON_PALETTES } from '../palettes.ts';
import { TAIL_REST } from '../stages.ts';
import type { Stage } from '../stages.ts';
import { hornParams, wingParams } from '../element.ts';
import type { ElementSpec, ElementDraw } from '../element.ts';
import { backLineY } from '../features.ts';
import type { DragonRig } from '../rig.ts';
import { celPoly } from '../../../lib/art/shading.ts';

const PAL = DRAGON_PALETTES.spike;

/** The comb per stage (3.3 table): back quills as [x fraction rump -> neck base, height, base], then tail quills [t, height, base]. */
const COMB: Readonly<Record<Stage, { back: readonly (readonly number[])[]; tail: readonly (readonly number[])[]; blunt: boolean }>> = {
  // babies: 3 soft nubs on the loin, rump and tail root (the big head hides the front 60 % of the back)
  baby: { back: [[-4, 4, 4], [-8.5, 4, 4]], tail: [[0.3, 4, 4]], blunt: true },
  young: { back: [[0.05, 5, 5], [0.32, 7, 5], [0.6, 7, 5], [0.88, 5, 5]], tail: [[0.22, 4, 4]], blunt: false },
  adult: { back: [[0.0, 7, 6], [0.25, 10, 6], [0.5, 12, 6], [0.75, 11, 6], [1.0, 7, 6]], tail: [[0.14, 6, 5], [0.32, 5, 4], [0.5, 4, 4]], blunt: false },
};

/** Scratch polygons (a pointed quill, a blunt nub): exact lengths, because celPoly walks the whole array. */
const Q6 = [0, 0, 0, 0, 0, 0], Q8 = [0, 0, 0, 0, 0, 0, 0, 0];

/** One quill: base centred at (bx, by), `h` tall along the unit normal (nx, ny), leaning `lean` deg toward (tx, ty). */
function quill(ctx: CanvasRenderingContext2D, rig: DragonRig, bx: number, by: number, nx: number, ny: number, tx: number, ty: number,
  h: number, base: number, lean: number, blunt: boolean): void {
  const a = lean * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const ux = nx * c + tx * s, uy = ny * c + ty * s;       // quill axis
  const hb = base / 2;
  if (blunt) {
    // a soft nub: a flat 2 px cap instead of a point
    Q8[0] = bx - tx * hb; Q8[1] = by - ty * hb;
    Q8[2] = bx + ux * h - tx; Q8[3] = by + uy * h - ty;
    Q8[4] = bx + ux * h + tx; Q8[5] = by + uy * h + ty;
    Q8[6] = bx + tx * hb; Q8[7] = by + ty * hb;
    celPoly(ctx, rig, Q8, rig.pal.horn);
    return;
  }
  Q6[0] = bx - tx * hb; Q6[1] = by - ty * hb;             // base, toward the head
  Q6[2] = bx + ux * h; Q6[3] = by + uy * h;               // tip
  Q6[4] = bx + tx * hb; Q6[5] = by + ty * hb;             // base, toward the tail
  celPoly(ctx, rig, Q6, rig.pal.horn);
}

/**
 * FIRST PASS: bible 3.3 "The cue: the comb back". Body space, before the body (its contour hides the roots). Still
 * to do: the ripple ambient, the bristle tremble, the fired-quill regrow, the wary lean.
 */
const backRow: ElementDraw = (ctx, rig, pose, info) => {
  const comb = COMB[info.stage], d = rig.dims, J = rig.j;
  const baby = info.stage === 'baby';
  // lean: 50 (sad droop, 64 % of the upright height) -> 35 -> 20 (perky); babies at half range; bristle snaps upright
  const m = info.mood;
  let lean = 35 - 15 * m;
  if (baby) lean = 20 - 10 * m;
  lean *= 1 - pose.bristle;
  const grow = 1 + 0.15 * pose.bristle;
  const x0 = rig.hipB.x - d.hipR * 0.35, x1 = rig.chestB.x + d.chestR * 0.05;
  for (let i = 0; i < comb.back.length; i++) {
    const q = comb.back[i];
    const x = baby ? q[0] * (d.hipR / 6.5) : x0 + (x1 - x0) * q[0];
    const y = backLineY(rig, x) + 1.5;
    quill(ctx, rig, x, y, 0, -1, -1, 0, q[1] * grow + 1.5, q[2], lean, comb.blunt);
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
    const r = J.tailR[k] + (J.tailR[k + 1] - J.tailR[k]) * u;
    quill(ctx, rig, bx + nx * (r - 1), by + ny * (r - 1), nx, ny, dx, dy, q[1] * grow + 1, q[2], lean, comb.blunt);
  }
};

export const SPIKE: ElementSpec = {
  id: 'spike',
  name: 'Bramble',
  blurb: 'Shy and prickly with strangers, a cuddle-bug once it trusts you. Its quills are its mood.',
  palette: PAL,
  modifiers: { bodyLength: 0.95, bodyDepth: 1.1, legLength: 0.9, legR: 1.05, neckLength: 0.8, neckAngle: 0, tailLength: 0.9, tailR: 1.0, snout: 1.0 },
  stages: {
    baby: {
      tailRest: TAIL_REST.spike.baby, horns: null,
      markings: [{ kind: 'ring', at: 'tail', t: 0.45, size: 3 }],
      wing: wingParams({ style: 'leaf', scallop: -2, foldRise: 0, nubRest: 200 }),
      dorsal: null,
    },
    young: {
      tailRest: TAIL_REST.spike.young,
      horns: hornParams({ len: 3, at: 72, sink: 1, sweep: -28 }),
      markings: [{ kind: 'ring', at: 'tail', t: 0.4, size: 3 }, { kind: 'ring', at: 'tail', t: 0.65, size: 3 }],
      wing: wingParams({ style: 'leaf', scallop: -2, foldRise: 0 }),
      dorsal: null,
    },
    adult: {
      tailRest: TAIL_REST.spike.adult,
      horns: hornParams({ len: 6, at: 72, sink: 1, sweep: -26 }),
      markings: [{ kind: 'ring', at: 'tail', t: 0.62, size: 3 }, { kind: 'ring', at: 'tail', t: 0.74, size: 3 }, { kind: 'ring', at: 'tail', t: 0.86, size: 3 }],
      wing: wingParams({ style: 'leaf', scallop: -3, foldRise: 0, thorn: 3, wristThorn: 4 }),
      dorsal: null,
    },
  },
  render: { backRow },
};
