// LIGHTNING: "Zap", the storm dragon (docs/ART_BIBLE.md 3.5). Zone: the space above the back, behind the head.
// Cue: bolt wings, held cocked upright and leaning back -- a yellow membrane with a zigzag trailing edge on a blue
// body. They never fold flat: asleep they drop to the sad cock. The cock angle is the mood gauge.
import { DRAGON_PALETTES } from '../palettes.ts';
import { TAIL_REST } from '../stages.ts';
import type { Stage } from '../stages.ts';
import { hornParams, wingParams } from '../element.ts';
import type { ElementSpec, ElementDraw } from '../element.ts';
import { pathPts } from '../features.ts';
import { celPath } from '../../../lib/art/shading.ts';

const PAL = DRAGON_PALETTES.lightning;

/**
 * The bolt polygons in wing space (root at 0,0, +x forward, up negative), as drawn at their authored cock `at`.
 * Adult: 3.5's simple polygon, 15 x 28 -- leading edge, then the zigzag trailing edge whose two shelves end 5.7 and
 * 9.2 px behind the leading edge, so the 3 px spar plus >= 2 px of yellow survive at both steps.
 * Young: the adult's scaled to 16 x 7. Baby: a 12 x 5 bolt nub with one 2 px zigzag step at 55 % of its height.
 */
const ADULT = [0, 0, -3, -13, -8, -28, -14, -17, -10, -17, -15, -8, -11, -8, -8, 0];
const scalePts = (p: readonly number[], kx: number, ky: number) => p.map((v, i) => (i % 2 ? v * ky : v * kx));
const BOLT: Readonly<Record<Stage, { pts: readonly number[]; spar: readonly number[]; at: number; sparR: number; w: number; h: number }>> = {
  baby: { pts: [0, 0, -1.5, -6, -3, -12, -5.5, -5.4, -3.5, -5.4, -5, 0], spar: [], at: 105, sparR: 0, w: 5, h: 12 },
  young: { pts: scalePts(ADULT, 7 / 15, 16 / 28), spar: scalePts([0, 0, -3, -13, -8, -28], 7 / 15, 16 / 28), at: 115, sparR: 1, w: 7, h: 16 },
  adult: { pts: ADULT, spar: [0, 0, -3, -13, -8, -28], at: 115, sparR: 1.5, w: 15, h: 28 },
};

/** Cock angle (1.1 convention: from +x, + up): sad 140 (baby 125) -> rest 115 (105) -> excited 95. */
function cockOf(stage: Stage, mood: number, asleep: boolean, spread: number): number {
  const rest = stage === 'baby' ? 105 : 115, sad = stage === 'baby' ? 125 : 140;
  let c = asleep ? sad : mood < 0 ? rest + (rest - sad) * mood : rest - (rest - 95) * mood;
  c += (95 - c) * Math.max(0, Math.min(1, spread));
  return c;
}

/**
 * FIRST PASS: bible 3.5 "The cue: bolt wings, held cocked". Wing space; replaces the wing (style 'custom').
 * Still to do: the charge sparks between horn and wing tips (adult, mood > 0.5), the crackle ambient, the flap.
 */
const wing: ElementDraw = (ctx, rig, pose, info) => {
  const B = BOLT[info.stage];
  const cock = cockOf(info.stage, info.mood, info.asleep, pose.wing.fold);
  ctx.save();
  if (info.far) ctx.translate(-4, 0);                 // the far bolt: (-4, -2) and 8 deg further back (the rig adds -2 / 8)
  ctx.rotate(-(cock - B.at) * Math.PI / 180);
  pathPts(ctx, B.pts);
  // the membrane is matte (hi 0): one shadow band
  celPath(ctx, rig, info.pal.membrane, -B.w * 0.45, -B.h / 2, Math.hypot(B.w, B.h) / 2, 0.3, 0);
  if (B.spar.length && !rig.override) {
    // one leading spar in scale, no ink of its own, just inside the leading edge
    ctx.strokeStyle = info.pal.scale; ctx.lineWidth = B.sparR * 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(B.spar[0] - B.sparR, B.spar[1] - 1);
    for (let i = 2; i < B.spar.length; i += 2) ctx.lineTo(B.spar[i] - B.sparR, B.spar[i + 1] + (i + 2 < B.spar.length ? 0 : 1.5));
    ctx.stroke();
  }
  ctx.restore();
};

export const LIGHTNING: ElementSpec = {
  id: 'lightning',
  name: 'Zap',
  blurb: 'Hyper, zippy and curious. Static builds when it is bored, so play with it before you pet it.',
  palette: PAL,
  modifiers: { bodyLength: 1.0, bodyDepth: 0.85, legLength: 1.2, legR: 0.9, neckLength: 1.0, neckAngle: 0, tailLength: 1.0, tailR: 0.85, snout: 1.2 },
  stages: {
    baby: {
      tailRest: TAIL_REST.lightning.baby,
      horns: hornParams({ len: 3, r0: 1.5, r1: 1.5, at: 135 }),
      markings: [{ kind: 'zstripe', at: 'shoulder', size: 5, h: 6 }],
      // the nubs root over the hips at (-3, -6): the generic (+1, -6) is inside the baby's cranium
      wing: wingParams({ style: 'custom', rootDx: -4 }),
      dorsal: null,
    },
    young: {
      tailRest: TAIL_REST.lightning.young,
      horns: hornParams({ len: 5, kinkAt: 0.6, bend: 35 }),
      markings: [{ kind: 'zstripe', at: 'shoulder', size: 5, h: 7 }, { kind: 'zstripe', at: 'haunch', size: 5, h: 7 }],
      wing: wingParams({ style: 'custom', rootDx: -3 }),
      dorsal: null,
    },
    adult: {
      tailRest: TAIL_REST.lightning.adult,
      horns: hornParams({ len: 8, kinkAt: 0.6, bend: 35 }),
      markings: [{ kind: 'zstripe', at: 'shoulder', size: 6, h: 9 }, { kind: 'zstripe', at: 'haunch', size: 6, h: 9 }, { kind: 'zstripe', at: 'tail', t: 0.1, size: 5, h: 7 }],
      wing: wingParams({ style: 'custom', rootDx: -3 }),
      dorsal: null,
    },
  },
  render: { wing },
  tailHold: 4,
};
