// SHRIEKSCALE: "Echo", the night-singer (docs/ART_BIBLE.md 3.7), a sound dragon. Zone: the head. Cue: ribbed
// ear-fans that double the head, laid back when scared, upright when curious, a dish when it shrieks.
import { DRAGON_PALETTES } from '../palettes.ts';
import { TAIL_REST } from '../stages.ts';
import type { Stage } from '../stages.ts';
import { wingParams } from '../element.ts';
import type { ElementSpec, ElementDraw, DragonInfo } from '../element.ts';
import type { DragonRig } from '../rig.ts';
import { celPath } from '../../../lib/art/shading.ts';

const PAL = DRAGON_PALETTES.shriekscale;

/** Fan height x width, ribs, back-edge scallops (3.7 table). Babies' are round fennec ears on top of the cranium. */
const FAN: Readonly<Record<Stage, { h: number; w: number; ribs: number; scallops: number; depth: number }>> = {
  baby: { h: 10, w: 8, ribs: 1, scallops: 0, depth: 0 },
  young: { h: 12, w: 9, ribs: 2, scallops: 1, depth: 2 },
  adult: { h: 16, w: 12, ribs: 3, scallops: 2, depth: 2 },
};

/** Eye-mask height per stage. */
const MASK: Readonly<Record<Stage, number>> = { baby: 6, young: 6, adult: 7 };

/**
 * The fan outline in fan space: root at (0, 0), the fan standing up (-y), its front edge toward +x. Narrow at the
 * root, widest at two-thirds of its height, a round top: a dish-shaped bat / fennec ear, not a rabbit's.
 */
function fanPath(ctx: CanvasRenderingContext2D, st: Stage, k: number): void {
  const F = FAN[st], h = F.h * k, w = F.w * k;
  ctx.beginPath();
  ctx.moveTo(2, 0);
  ctx.quadraticCurveTo(w * 0.45, -h * 0.3, w * 0.4, -h * 0.72);
  ctx.quadraticCurveTo(w * 0.32, -h * 1.02, -w * 0.08, -h);
  if (F.scallops === 0) {
    ctx.quadraticCurveTo(-w * 0.62, -h * 0.9, -w * 0.58, -h * 0.5);
  } else {
    // the free back edge: scallops `depth` px deep between the rib ends
    const n = F.scallops + 1;
    let px = -w * 0.08, py = -h;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const x = -w * 0.08 - w * 0.52 * Math.sin(t * Math.PI * 0.5), y = -h + h * 0.5 * t;
      const mx = (px + x) / 2 + F.depth * 0.8, my = (py + y) / 2 + F.depth * 0.6;
      ctx.quadraticCurveTo(mx, my, x, y);
      px = x; py = y;
    }
  }
  ctx.quadraticCurveTo(-w * 0.45, -h * 0.15, -2, 0);
  ctx.closePath();
}

/**
 * FIRST PASS: bible 3.7 "The cue: ear-fans". Cranium space, near and far. Membrane on 2 px horn ribs (none on the
 * far fan), rooted behind the eye (babies: on top of the cranium). `flare` = mood + pose.flare: -1 laid back along
 * the neck (>= 60 % still above the neck line), 0 up and back at 40 deg, +1 upright, > 1 the shriek dish (1.3x).
 * Still to do: the rib rattle, the dish shape, the fan twitch ambient, the baby flop gag.
 */
function fan(ctx: CanvasRenderingContext2D, rig: DragonRig, info: DragonInfo, flareIn: number): void {
  const st = info.stage, F = FAN[st], r = info.r;
  const flare = Math.max(-1, Math.min(1.3, flareIn));
  const lean = info.asleep ? 95 : flare >= 0 ? 40 - 40 * Math.min(1, flare) : 40 - 55 * flare;
  const k = flare > 1 ? 1 + (flare - 1) : 1;
  const baby = st === 'baby';
  const a = (baby ? 100 : 128) * Math.PI / 180, rr = r * (baby ? 0.72 : 0.62);
  ctx.save();
  // the far fan: root 4 px behind and 1 px above, turned 14 deg further back, so >= 30 % of it shows (1.5)
  ctx.translate(Math.cos(a) * rr + (info.far ? -4 : 0), -Math.sin(a) * rr + (info.far ? -1 : 0));
  // the head pitch is already in the space; lean back = counter-clockwise
  ctx.rotate(-(lean + (info.far ? 14 : 0) + (baby ? -18 : 0)) * Math.PI / 180);
  fanPath(ctx, st, k);
  celPath(ctx, rig, info.pal.membrane, 0, -F.h * k / 2, F.h * k / 2, 0.36, 0);
  if (!info.far && !rig.override && F.ribs) {
    // ribs: 2 px horn, starting 4 px out from the root, fanning to the free edge with >= 2 px of membrane between
    ctx.save(); fanPath(ctx, st, k); ctx.clip();
    ctx.strokeStyle = info.pal.horn; ctx.lineWidth = 2; ctx.lineCap = 'butt';
    ctx.beginPath();
    const h = F.h * k, w = F.w * k;
    for (let i = 0; i < F.ribs; i++) {
      const t = F.ribs === 1 ? 0.5 : i / (F.ribs - 1);
      const ex = w * 0.28 - w * 0.72 * t, ey = -h * (0.96 - 0.3 * t * t);
      const L = Math.hypot(ex, ey) || 1, sx = ex / L * 4, sy = ey / L * 4;
      ctx.moveTo(sx, sy); ctx.lineTo(ex * 0.9, ey * 0.9);
    }
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}
const farHead: ElementDraw = (ctx, rig, pose, info) => fan(ctx, rig, info, info.mood + pose.flare);
const nearHead: ElementDraw = (ctx, rig, pose, info) => fan(ctx, rig, info, info.mood + pose.flare);

/**
 * FIRST PASS: bible 3.7 table "Eye mask": a pale lilac "spectacles" patch from the snout base to behind the eye,
 * clipped to the skull (the rig clips), no ink. Cranium space.
 */
const headMarkings: ElementDraw = (ctx, rig, pose, info) => {
  const e = rig.dims.head.eye, s = rig.dims.head.snout, h = MASK[info.stage];
  const x0 = Math.round(e.x - e.w / 2 - 3), x1 = Math.round(s.x0 + 4), y0 = Math.round(e.y - h / 2);
  ctx.fillStyle = info.pal.marking;
  ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, h); ctx.fill();
};

/** Throat-sac swell per stage (3.7 table), px. */
const SAC: Readonly<Record<Stage, number>> = { baby: 3, young: 5, adult: 7 };

/**
 * FIRST PASS: bible 3.7 table "Throat sac": swells while shrieking, driven here by pose.fx (the shriek anim keys it
 * in the wind-up). Still to do: key it in the shriek anim.
 */
const neckSac = (pose: { fx: number }, info: DragonInfo): number => (pose.fx > 0 ? SAC[info.stage] * Math.min(1, pose.fx) : 0);

const chevron = (t: number) => ({ kind: 'chevron' as const, at: 'tail' as const, t, size: 5, h: 4 });

export const SHRIEKSCALE: ElementSpec = {
  id: 'shriekscale',
  name: 'Echo',
  blurb: 'Dramatic, clingy and nocturnal. It shrieks when lonely, chirps when content and sings when happy.',
  palette: PAL,
  modifiers: {
    bodyLength: 1.0, bodyDepth: 1.0, legLength: 1.0, legR: 0.75, neckLength: 1.1, neckAngle: 0, tailLength: 1.1, tailR: 0.7,
    snout: 1.0, jawDepth: 1.3, jawMax: 40,
  },
  stages: {
    baby: {
      tailRest: TAIL_REST.shriekscale.baby, horns: null, markings: [],
      wing: wingParams({ style: 'bat' }), dorsal: null,
    },
    young: {
      tailRest: TAIL_REST.shriekscale.young, horns: null, markings: [chevron(0.4)],
      wing: wingParams({ style: 'bat', plus: true, scallop: 3 }), dorsal: null,
    },
    adult: {
      tailRest: TAIL_REST.shriekscale.adult, horns: null, markings: [chevron(0.35), chevron(0.52)],
      wing: wingParams({ style: 'bat', plus: true, scallop: 5, wristThorn: 3 }), dorsal: null,
      // the adult-only nose-leaf: a 4 x 4 bump in the skull path
      skullBumps: [{ x: 14, y: -1.5, r: 2 }],
    },
  },
  render: { farHead, nearHead, headMarkings },
  neckSac,
};
