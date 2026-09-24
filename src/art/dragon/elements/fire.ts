// FIRE: "Ember", the hearth dragon (docs/ART_BIBLE.md 3.2). Zone: above the tail tip. Cue: the torch tail, a
// flame on an up-curling tail, which is also its mood meter.
import { DRAGON_PALETTES } from '../palettes.ts';
import { NO_MODIFIERS, TAIL_REST } from '../stages.ts';
import type { Stage } from '../stages.ts';
import { hornParams, wingParams } from '../element.ts';
import type { ElementSpec, ElementDraw } from '../element.ts';
import { emitterFill, emitterCore, pathPts } from '../features.ts';
import { liveSpawns, stepAlpha } from '../fx.ts';
import type { TopItem } from '../fx.ts';
import { rootToScreen } from '../rig.ts';
import { tones } from '../../../lib/art/shading.ts';

const PAL = DRAGON_PALETTES.fire;

/** Flame box (w x h) and tongue count per stage (3.2 table). */
const FLAME: Readonly<Record<Stage, { w: number; h: number; tongues: number }>> = {
  baby: { w: 5, h: 7, tongues: 1 },
  young: { w: 7, h: 10, tongues: 2 },
  adult: { w: 10, h: 14, tongues: 3 },
};

/**
 * Tongue shapes in a unit box (x -0.5..0.5, y 0 at the base .. -1 at the top), 3 flicker keys per tongue count,
 * swapped on stepped keys (never tweened: 5.1 #12). Every tongue is >= 3 px wide at its base at the stage sizes.
 */
const SHAPES: readonly (readonly (readonly number[])[])[] = [
  [ // 1 tongue: a teardrop whose tip leans
    [0, 0.04, 0.42, -0.1, 0.5, -0.34, 0.3, -0.62, 0.02, -1, -0.26, -0.64, -0.5, -0.36, -0.42, -0.1],
    [0, 0.04, 0.44, -0.12, 0.5, -0.36, 0.34, -0.6, 0.18, -1, -0.2, -0.6, -0.5, -0.34, -0.42, -0.1],
    [0, 0.04, 0.42, -0.1, 0.5, -0.34, 0.24, -0.64, -0.14, -1, -0.32, -0.58, -0.5, -0.32, -0.44, -0.1],
  ],
  [ // 2 tongues: the main tip and a shorter side tongue
    [0, 0.04, 0.44, -0.1, 0.5, -0.36, 0.46, -0.58, 0.36, -0.8, 0.14, -0.56, 0.0, -1, -0.28, -0.6, -0.5, -0.34, -0.42, -0.1],
    [0, 0.04, 0.44, -0.1, 0.5, -0.36, 0.44, -0.56, 0.42, -0.74, 0.18, -0.54, 0.12, -1, -0.24, -0.62, -0.5, -0.34, -0.42, -0.1],
    [0, 0.04, 0.44, -0.1, 0.5, -0.36, 0.44, -0.6, 0.3, -0.84, 0.1, -0.58, -0.1, -1, -0.3, -0.58, -0.5, -0.34, -0.42, -0.1],
  ],
  [ // 3 tongues: left, main, right
    [0, 0.04, 0.46, -0.1, 0.5, -0.36, 0.48, -0.56, 0.4, -0.78, 0.18, -0.56, 0.04, -1, -0.16, -0.6, -0.36, -0.82, -0.44, -0.54, -0.5, -0.34, -0.44, -0.1],
    [0, 0.04, 0.46, -0.1, 0.5, -0.36, 0.5, -0.54, 0.46, -0.72, 0.2, -0.54, 0.16, -1, -0.12, -0.6, -0.3, -0.76, -0.46, -0.52, -0.5, -0.34, -0.44, -0.1],
    [0, 0.04, 0.46, -0.1, 0.5, -0.36, 0.48, -0.58, 0.34, -0.84, 0.14, -0.58, -0.08, -1, -0.2, -0.58, -0.42, -0.72, -0.48, -0.5, -0.5, -0.34, -0.44, -0.1],
  ],
];

/** Scratch: the current flame polygon in px. */
const PTS: number[] = new Array(24).fill(0);

/**
 * FIRST PASS: bible 3.2 "The cue: the torch tail". Complete the flame: tongue art per key, the bath shrink, the
 * breath tell. Tail-tip space, counter-rotated so the flame always points up ("fire rises").
 */
const tailTip: ElementDraw = (ctx, rig, pose, info) => {
  const f = FLAME[info.stage], m = info.mood;
  // mood gauge: 0.6x at -1 (never below 3 x 4) -> 1.0 -> 1.2x at +1; asleep: banked to 0.6x in glow.sh, no core
  let k = info.asleep ? 0.6 : m < 0 ? 1 + 0.4 * m : 1 + 0.2 * m;
  const w = Math.max(3, Math.round(f.w * k)), h = Math.max(4, Math.round(f.h * k));
  const period = Math.round(6 - 2 * m);
  const key = Math.floor(info.tick / Math.max(3, period)) % 3;
  const shape = SHAPES[f.tongues - 1][key];
  for (let i = 0; i < shape.length; i += 2) { PTS[i] = shape[i] * w; PTS[i + 1] = shape[i + 1] * h; }
  ctx.save();
  ctx.rotate(-info.ang * Math.PI / 180);
  ctx.translate(0, -Math.max(1, Math.round(info.r * 0.5)));
  const n = shape.length;
  pathPts(ctx, PTS, 1, 0, 0, n);
  emitterFill(ctx, rig, info.asleep ? tones(rig, info.pal.glow).sh : info.pal.glow);
  if (!info.asleep && m > -0.75) {
    // the core: glow.hi at 55 % size, no ink, sitting low in the flame
    pathPts(ctx, PTS, 0.55, 0, 0, n);
    emitterCore(ctx, rig, tones(rig, info.pal.glow).hi);
  }
  ctx.restore();
};

const EMB_AGES = new Float32Array(4), EMB_IDS = new Int32Array(4);
const SCR = { x: 0, y: 0 };

function drawEmber(ctx: CanvasRenderingContext2D, it: TopItem): void {
  ctx.fillStyle = it.c0;
  ctx.fillRect(it.x, it.y, Math.round(2 * it.sc), Math.round(2 * it.sc));
}

/**
 * FIRST PASS: bible 3.2 "Ambient". An ember (2 x 2 glow.hi) rises 10 px from the flame over 40 f in alpha steps,
 * every 90 +- 30 f, through the top pass. The tail-chase fidget is still to come.
 */
const ambient: ElementDraw = (ctx, rig, pose, info) => {
  if (!rig.top || info.asleep) return;
  const J = rig.j, tn = J.tailN, f = FLAME[info.stage];
  const n = liveSpawns(info.seed, info.tick, 90 * rig.budget.stretch, 30, 40, EMB_AGES, EMB_IDS);
  const allowed = rig.budget.take(rig.slot, n);
  for (let i = 0; i < allowed; i++) {
    const age = EMB_AGES[i], fr = age / 40;
    const x = J.tailX[tn] + (EMB_IDS[i] % 3 - 1) * 2, y = J.tailY[tn] - f.h * 0.8 - Math.round(fr * 10);
    rootToScreen(rig, x, y, SCR);
    const it = rig.top.push(drawEmber, SCR.x, SCR.y, rig.pxScale, rig.facing);
    if (it) { it.c0 = tones(rig, info.pal.glow).hi; it.alpha = stepAlpha(fr); }
  }
};

export const FIRE: ElementSpec = {
  id: 'fire',
  name: 'Ember',
  blurb: 'A warm, affectionate show-off with the fastest metabolism. Its tail flame is its mood.',
  palette: PAL,
  modifiers: NO_MODIFIERS,
  stages: {
    baby: {
      tailRest: TAIL_REST.fire.baby,
      horns: hornParams({ len: 3, r0: 1.5, r1: 1.5, at: 135 }),
      markings: [{ kind: 'chevron', at: 'shoulder', size: 4 }],
      wing: wingParams({ style: 'bat' }),
      dorsal: null,
    },
    young: {
      tailRest: TAIL_REST.fire.young,
      horns: hornParams({ len: 5 }),
      markings: [{ kind: 'chevron', at: 'shoulder', size: 5 }, { kind: 'chevron', at: 'haunch', size: 5 }],
      wing: wingParams({ style: 'bat', scallop: 2 }),
      dorsal: null,
    },
    adult: {
      tailRest: TAIL_REST.fire.adult,
      horns: hornParams({ len: 8, bend: 20 }),
      markings: [{ kind: 'chevron', at: 'shoulder', size: 6 }, { kind: 'chevron', at: 'haunch', size: 6 }, { kind: 'chevron', at: 'tail', t: 0.12, size: 6 }],
      wing: wingParams({ style: 'bat', scallop: 3 }),
      dorsal: null,
    },
  },
  render: { tailTip, ambient },
};
