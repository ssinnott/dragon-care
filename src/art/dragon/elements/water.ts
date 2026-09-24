// WATER: "Ripple", the tide dragon (docs/ART_BIBLE.md 3.6). Zone: the tail end, low and level. Cue: a vertical
// crescent fluke at the end of the longest, flattest body in the cast. Its pearl spots are the mood gauge.
import { DRAGON_PALETTES, moodTones } from '../palettes.ts';
import { TAIL_REST } from '../stages.ts';
import type { Stage } from '../stages.ts';
import { wingParams } from '../element.ts';
import type { ElementSpec, ElementDraw, DragonInfo } from '../element.ts';
import type { DragonRig } from '../rig.ts';
import { celPath, outlinePath } from '../../../lib/art/shading.ts';

const PAL = DRAGON_PALETTES.water;
const DIM = moodTones(PAL).dimSpot;

/** Fluke height x depth, ray count, and whether it is the baby's round paddle (3.6 table). */
const FLUKE: Readonly<Record<Stage, { h: number; d: number; rays: number; round: boolean }>> = {
  baby: { h: 10, d: 6, rays: 0, round: true },
  young: { h: 11, d: 6, rays: 2, round: false },
  adult: { h: 16, d: 8, rays: 3, round: false },
};

/** Fin-ear length x height and ray count. */
const FIN: Readonly<Record<Stage, { l: number; h: number; ray: boolean }>> = {
  baby: { l: 3, h: 3, ray: false },
  young: { l: 5, h: 4, ray: false },
  adult: { l: 7, h: 6, ray: true },
};

function flukePath(ctx: CanvasRenderingContext2D, st: Stage): void {
  const F = FLUKE[st], H = F.h / 2, D = F.d;
  ctx.beginPath();
  if (F.round) { ctx.ellipse(-D / 2 + 0.5, 0, D / 2, H, 0, 0, Math.PI * 2); return; }
  // a vertical crescent: two lobes sweeping back, a concave trailing edge with a central notch >= 3 px deep
  ctx.moveTo(1, -2);
  ctx.quadraticCurveTo(-D * 0.3, -H * 0.9, -D, -H);
  ctx.quadraticCurveTo(-D * 0.55, -H * 0.35, -D + 3.5, 0);
  ctx.quadraticCurveTo(-D * 0.55, H * 0.35, -D, H);
  ctx.quadraticCurveTo(-D * 0.3, H * 0.9, 1, 2);
  ctx.closePath();
}

/**
 * FIRST PASS: bible 3.6 "The cue: the fluke tail". Tail-tip space (the tail continues toward -x). Membrane, 2 tones
 * (no highlight), 2 px rays in horn, glow dots 2 px in from the adult lobe tips; droops 15 deg when sad or dry.
 */
const tailTip: ElementDraw = (ctx, rig, pose, info) => {
  const st = info.stage, F = FLUKE[st];
  ctx.save();
  if (info.mood <= -0.3) ctx.rotate(-15 * Math.PI / 180);
  flukePath(ctx, st);
  celPath(ctx, rig, info.pal.membrane, -F.d / 2, 0, Math.max(F.h, F.d) / 2, 0.4, 0);
  if (!rig.override && F.rays) {
    ctx.save(); flukePath(ctx, st); ctx.clip();
    ctx.strokeStyle = info.pal.horn; ctx.lineWidth = 2; ctx.lineCap = 'butt';
    const H = F.h / 2 - 2.5;
    ctx.beginPath();
    for (let i = 0; i < F.rays; i++) {
      const v = F.rays === 1 ? 0 : -1 + (2 * i) / (F.rays - 1);
      if (F.rays === 3 && i === 1) continue; // the notch: the middle ray would fill it
      ctx.moveTo(-1, v * 1.5); ctx.lineTo(-F.d + 1.5, v * H);
    }
    ctx.stroke();
    ctx.restore();
    if (st === 'adult') {
      ctx.fillStyle = info.pal.glow;
      ctx.fillRect(Math.round(-F.d + 2), Math.round(-F.h / 2 + 2), 2, 2);
      ctx.fillRect(Math.round(-F.d + 2), Math.round(F.h / 2 - 4), 2, 2);
    }
  }
  ctx.restore();
};

/**
 * FIRST PASS: bible 3.6 table "Fin-ears": behind the cheek, pointing back along the neck, never up. Cranium space.
 * Flare (mood >= 0.5) fans the ray 2 px longer, rising <= 10 deg; sad or dry droops them 30 deg.
 */
function finEar(ctx: CanvasRenderingContext2D, rig: DragonRig, info: DragonInfo): void {
  const F = FIN[info.stage], r = info.r;
  const flare = info.mood >= 0.5, droop = info.mood <= -0.3;
  const ang = (22 + (droop ? 30 : 0) - (flare ? 12 : 0)) * Math.PI / 180;      // below straight back
  const L = F.l + (flare ? 2 : 0), H = F.h;
  ctx.save();
  ctx.translate(-r * 0.55 + (info.far ? -3 : 0), r * 0.2 + (info.far ? -1 : 0));
  ctx.rotate(-ang + (info.far ? -8 * Math.PI / 180 : 0));
  // local: the ear points toward -x; a lobe, widest near its root
  ctx.beginPath();
  ctx.moveTo(1.5, -H * 0.45);
  ctx.quadraticCurveTo(-L * 0.5, -H * 0.75, -L, -H * 0.05);
  ctx.quadraticCurveTo(-L * 0.55, H * 0.55, 1.5, H * 0.4);
  ctx.closePath();
  outlinePath(ctx, rig);
  ctx.fillStyle = rig.col(info.pal.membrane); ctx.fill();
  if (F.ray && !info.far && !rig.override) {
    ctx.fillStyle = info.pal.horn; ctx.save();
    ctx.beginPath(); ctx.moveTo(1, -1); ctx.lineTo(-L + 1.5, -1); ctx.lineTo(-L + 1.5, 1); ctx.lineTo(1, 1); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}
const farHead: ElementDraw = (ctx, rig, _pose, info) => finEar(ctx, rig, info);
const nearHead: ElementDraw = (ctx, rig, _pose, info) => finEar(ctx, rig, info);

/** Three spot states, each >= 40 % from the next (gate h): glow when happy, the dim spot when sad or dry. */
function markingTone(info: DragonInfo): string {
  return info.mood >= 0.5 ? info.pal.glow : info.mood <= -0.3 ? DIM : info.pal.marking;
}

const spots = (xs: readonly number[]) => xs.map((t) => ({ kind: 'spot' as const, at: 'flank' as const, t, size: 3, dy: 1 }));

// FIRST PASS: bible 3.6 table "Dorsal fin". The folded wing lies along the upper back (1.3) and would hide a fin
// there, so this pass runs the fin from the tail root over the rump, behind the wing's tip; settle it with the wing.
export const WATER: ElementSpec = {
  id: 'water',
  name: 'Ripple',
  blurb: 'Gentle, curious and playful. It loves baths, sings in bubbles and floats belly-up in the pond.',
  palette: PAL,
  modifiers: { bodyLength: 1.1, bodyDepth: 0.9, legLength: 0.8, legR: 1.0, neckLength: 1.3, neckAngle: 0, tailLength: 1.15, tailR: 1.0, snout: 1.0 },
  stages: {
    baby: {
      tailRest: TAIL_REST.water.baby, tailR: [3.5, 1.5], horns: null, markings: spots([0.1, 0.9]),
      wing: wingParams({ style: 'fin', plus: true, scallop: -2 }), dorsal: null,
    },
    young: {
      tailRest: TAIL_REST.water.young, horns: null, markings: spots([0.05, 0.5, 0.95]),
      wing: wingParams({ style: 'fin', plus: true, scallop: -2 }), dorsal: { height: 2, scallops: 2, from: -13, to: -5 },
    },
    adult: {
      tailRest: TAIL_REST.water.adult, horns: null, markings: spots([-0.2, 0.12, 0.44, 0.76, 1.08]),
      wing: wingParams({ style: 'fin', plus: true, scallop: -3 }), dorsal: { height: 3, scallops: 3, from: -19, to: -6 },
    },
  },
  render: { tailTip, farHead, nearHead },
  markingTone,
};

