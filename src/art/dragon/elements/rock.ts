// ROCK: "Cobble", the boulder dragon (docs/ART_BIBLE.md 3.4). Zone: the body mass. Cue: one faceted dome carapace
// over the back plus a heavy, low stance. The dome never changes (the cue is always 100 %); its crystals' glow is
// the mood gauge, and their count grows with the bond.
import { DRAGON_PALETTES, DRAGON_SHARED, moodTones } from '../palettes.ts';
import { TAIL_REST } from '../stages.ts';
import type { Stage } from '../stages.ts';
import { wingParams } from '../element.ts';
import type { ElementSpec, ElementDraw } from '../element.ts';
import { backLineY, emitterFill, emitterCore } from '../features.ts';
import { celTaper, outlinePath, tones } from '../../../lib/art/shading.ts';

const PAL = DRAGON_PALETTES.rock;
const BANKED = moodTones(PAL).banked;

/** Dome width x rise above the back and facet count; crystals as [position along the dome 0..1 (0 = rear), w, h]. */
const DOME: Readonly<Record<Stage, { w: number; rise: number; facets: number; crystals: readonly (readonly number[])[] }>> = {
  baby: { w: 12, rise: 5, facets: 1, crystals: [[0.3, 2, 3]] },
  young: { w: 22, rise: 7, facets: 3, crystals: [[0.18, 3, 5], [0.36, 3, 5]] },
  adult: { w: 34, rise: 11, facets: 5, crystals: [[0.14, 3, 5], [0.27, 4, 7], [0.4, 3, 5]] },
};

/** Nose horn per stage: length, root and tip radius (3.4). */
const NOSE: Readonly<Record<Stage, { len: number; r0: number; r1: number }>> = {
  baby: { len: 2, r0: 1.5, r1: 1.2 },
  young: { len: 4, r0: 2, r1: 1.5 },
  adult: { len: 5, r0: 3, r1: 1.5 },
};

const ARC_X = new Float32Array(12), ARC_Y = new Float32Array(12);

/**
 * FIRST PASS: bible 3.4 "The cue: the boulder dome". Body space, after the body; the near wing is drawn just before
 * this (wingUnderBodyOver) so the rim tucks it under. Still to do: the travelling glint, the crystal count from the
 * bond, the tucks (pose.tuck = 1 draws the head under the dome), the pebble crumb ambient.
 */
const bodyOver: ElementDraw = (ctx, rig, pose, info) => {
  const D = DOME[info.stage];
  const cx = Math.round((rig.hipB.x + rig.chestB.x) / 2 - 1);
  const back = backLineY(rig, cx);
  const top = Math.round(back - D.rise), rim = Math.round(back + D.rise * 0.55 + 2);
  // the baby's single facet is a smooth pebble; young and adult domes are flat planes, one per facet
  const rx = D.w / 2 + 2, ry = rim - top, n = D.facets === 1 ? 6 : D.facets;
  // the arc: n + 1 corner points on a half-ellipse, so the facets are flat planes (no lines between them: form
  // within one material is a tone step)
  for (let i = 0; i <= n; i++) {
    const a = Math.PI - (i / n) * Math.PI;
    ARC_X[i] = Math.round(cx + Math.cos(a) * rx); ARC_Y[i] = Math.round(rim - Math.sin(a) * ry);
  }
  ctx.beginPath();
  ctx.moveTo(ARC_X[0], rim);
  for (let i = 0; i <= n; i++) ctx.lineTo(ARC_X[i], ARC_Y[i]);
  ctx.lineTo(ARC_X[n], rim);
  ctx.quadraticCurveTo(cx, rim + 2, ARC_X[0], rim);
  ctx.closePath();
  outlinePath(ctx, rig);
  ctx.fillStyle = rig.col(info.pal.marking); ctx.fill();
  if (!rig.override && D.facets >= 3) {
    ctx.save(); ctx.clip();
    const t = tones(rig, info.pal.marking);
    // lit left facet, shadowed right facet
    ctx.fillStyle = t.hi; ctx.beginPath();
    ctx.moveTo(ARC_X[0], rim + 3); ctx.lineTo(ARC_X[0], ARC_Y[0]); ctx.lineTo(ARC_X[1], ARC_Y[1]); ctx.lineTo(ARC_X[1], rim + 3); ctx.fill();
    ctx.fillStyle = t.sh; ctx.beginPath();
    ctx.moveTo(ARC_X[n - 1], rim + 3); ctx.lineTo(ARC_X[n - 1], ARC_Y[n - 1]); ctx.lineTo(ARC_X[n], ARC_Y[n]); ctx.lineTo(ARC_X[n], rim + 3); ctx.fill();
    ctx.restore();
  }
  // crystals on the rear third: flat glow with ink, dim (banked) when sad, a glint when happy
  const m = info.mood, lit = m > -0.3 && !info.asleep;
  const col = lit ? info.pal.glow : BANKED;
  for (let i = 0; i < D.crystals.length; i++) {
    const c = D.crystals[i];
    const x = Math.round(ARC_X[0] + (ARC_X[n] - ARC_X[0]) * c[0]);
    // stand on the arc at x
    const u = Math.max(-1, Math.min(1, (x - cx) / rx)), y = Math.round(rim - Math.sqrt(1 - u * u) * ry) + 1;
    const w = c[1], h = c[2], hw = w / 2;
    ctx.beginPath();
    ctx.moveTo(x - hw, y); ctx.lineTo(x - hw, y - h + hw); ctx.lineTo(x, y - h); ctx.lineTo(x + hw, y - h + hw); ctx.lineTo(x + hw, y);
    ctx.closePath();
    emitterFill(ctx, rig, col);
    if (w >= 4 && lit) {
      // one glow.hi facet, only on a crystal >= 4 px wide (a narrower facet is under the mark floor)
      ctx.beginPath(); ctx.rect(x - hw, y - h + hw, 2, h - hw - 1);
      emitterCore(ctx, rig, tones(rig, info.pal.glow).hi);
    }
    if (m >= 0.5 && lit && !rig.override && Math.floor(info.tick / 20) % D.crystals.length === i) {
      ctx.fillStyle = DRAGON_SHARED.catchlight; ctx.fillRect(x - 1, y - h + 1, 2, 2);
    }
  }
};

/** FIRST PASS: bible 3.4 table "Nose horn": one blunt horn on the snout, up and forward. Cranium space. */
const nearHead: ElementDraw = (ctx, rig, pose, info) => {
  const N = NOSE[info.stage], s = rig.dims.head.snout, e = rig.dims.head.eye;
  // on the snout, well forward of the eye: never closer than 1 px to the eye's ring (the eye is never covered)
  const f = Math.max(0.62, Math.min(1, (e.x + e.w / 2 + 1 + N.r0 - s.x0) / (s.x1 - s.x0 || 1)));
  const x = s.x0 + (s.x1 - s.x0) * f, y = s.y0 + (s.y1 - s.y0) * f - (s.r0 + (s.r1 - s.r0) * f) + 1.5;
  const a = 65 * Math.PI / 180;
  celTaper(ctx, rig, x, y, x + Math.cos(a) * N.len, y - Math.sin(a) * N.len, N.r0, N.r1, info.pal.horn);
};

export const ROCK: ElementSpec = {
  id: 'rock',
  name: 'Cobble',
  blurb: 'Calm, sleepy, stubborn and patient: the easiest baby to raise. Crystals grow on its dome with its bond.',
  palette: PAL,
  modifiers: {
    bodyLength: 1.1, bodyDepth: 1.2, legLength: 0.75, legR: 1.2, neckLength: 0.7, neckAngle: -25, tailLength: 0.7, tailR: 1.2,
    snout: 0.9, snoutTaper: 0.9, tailTipRMax: 2,
  },
  stages: {
    baby: {
      tailRest: TAIL_REST.rock.baby, horns: null, markings: [],
      wing: wingParams({ style: 'bat', foldRise: 0 }), dorsal: null,
    },
    young: {
      tailRest: TAIL_REST.rock.young, horns: null, markings: [], brow: 2,
      wing: wingParams({ style: 'bat', scallop: 1, span: 0.7, foldRise: 0 }), dorsal: null,
    },
    adult: {
      tailRest: TAIL_REST.rock.adult, horns: null, markings: [], brow: 3,
      wing: wingParams({ style: 'bat', scallop: 1, span: 0.7, foldRise: 0 }), dorsal: null,
    },
  },
  render: { bodyOver, nearHead },
  wingUnderBodyOver: true,
};
