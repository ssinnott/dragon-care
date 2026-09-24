// WATER: "Ripple", the tide dragon (docs/ART_BIBLE.md 3.6). Zone: the tail end, low and level. Cue: a vertical
// crescent fluke at the end of the longest, flattest body in the cast. Its pearl spots are the mood gauge.
import { DRAGON_PALETTES, moodTones } from '../palettes.ts';
import { TAIL_REST } from '../stages.ts';
import type { Stage } from '../stages.ts';
import { wingParams } from '../element.ts';
import type { ElementSpec, ElementDraw, DragonInfo } from '../element.ts';
import type { DragonRig } from '../rig.ts';
import { cranToRootPt, enterFaceFromCranium, enterFaceFromLocal, localToRootPt } from '../rig.ts';
import { pixelStroke, disc } from '../features.ts';
import { ACT, DFACE } from '../pose.ts';
import { bake } from '../anims.ts';
import { hash01 } from '../fx.ts';
import { DRAGON_SHARED } from '../palettes.ts';
import { celPath, outlinePath } from '../../../lib/art/shading.ts';
import { pathTaperedCapsule } from '../../../lib/art/shapes.ts';

const PAL = DRAGON_PALETTES.water;
const DIM = moodTones(PAL).dimSpot;

/**
 * Fluke height x depth, ray count, and whether it is the baby's round paddle (3.6 table). The adult carries 2 rays,
 * one per lobe, like the young: a third down the middle filled the notch (the old code skipped it), and a lobe is
 * 4-5 px thick, room for one 2 px ray. Its adult-only extra is the lobe glow dots.
 */
const FLUKE: Readonly<Record<Stage, { h: number; d: number; rays: number; round: boolean }>> = {
  baby: { h: 10, d: 6, rays: 0, round: true },
  young: { h: 11, d: 6, rays: 2, round: false },
  adult: { h: 16, d: 8, rays: 2, round: false },
};

/** Fin-ear length x height and ray count. */
const FIN: Readonly<Record<Stage, { l: number; h: number; ray: boolean }>> = {
  baby: { l: 3, h: 3, ray: false },
  young: { l: 5, h: 4, ray: false },
  adult: { l: 7, h: 6, ray: true },
};

/**
 * The fluke outline, tail-tip space (the tail continues toward -x, the body is toward +x). The baby's round paddle
 * is a tadpole fin: its top and bottom edges leave the tail's own contour 3.5 px before the tip (rT = the tail's
 * radius there) and swell round the tip to the 10 px paddle, so the tail runs INTO it instead of carrying a disc on
 * a stick (a lollipop). The front closing edge lies inside the tail and is clipped away (tailTip).
 */
function flukePath(ctx: CanvasRenderingContext2D, st: Stage, rT = 2): void {
  const F = FLUKE[st], H = F.h / 2, D = F.d;
  ctx.beginPath();
  if (F.round) {
    ctx.moveTo(3.5, -rT);
    ctx.quadraticCurveTo(1, -H, -D * 0.4, -H);
    ctx.quadraticCurveTo(-D * 0.8, -H, -D * 0.8, 0);
    ctx.quadraticCurveTo(-D * 0.8, H, -D * 0.4, H);
    ctx.quadraticCurveTo(1, H, 3.5, rT);
    ctx.closePath();
    return;
  }
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
 * (no highlight), 2 px rays in horn (one per lobe), glow dots 2 px in from the adult lobe tips; droops 15 deg
 * when sad or dry.
 */
const tailTip: ElementDraw = (ctx, rig, pose, info) => {
  const st = info.stage, F = FLUKE[st], J = rig.j, tn = J.tailN;
  ctx.save();
  if (F.round) {
    // the paddle wraps the tail's tip: draw it only OUTSIDE the last tail segment and its ink ring, so the tail's
    // contour and round end stay visible running into the fin, and no fin ink crosses the tail
    const r0 = J.tailR[tn] + 1, r1 = J.tailR[tn - 1] + 1, L = rig.dims.tail.len;
    ctx.beginPath(); ctx.rect(-50, -50, 100, 100);
    pathTaperedCapsule(ctx, 0, 0, L, 0, r0, r1, true);
    ctx.clip('evenodd');
  }
  const droop = info.mood <= -0.3 ? -15 : 0;
  if (droop) ctx.rotate(droop * Math.PI / 180);
  flukePath(ctx, st, (J.tailR[tn] + (J.tailR[tn - 1] - J.tailR[tn]) * (3.5 / rig.dims.tail.len)) + 0.5);
  celPath(ctx, rig, info.pal.membrane, -F.d / 2, 0, Math.max(F.h, F.d) / 2, 0.4, 0);
  if (!rig.override && F.rays) {
    // rays: 2 px horn as WHOLE-PIXEL runs in face space (features.pixelStroke), clipped to the fluke: a 2 px
    // stroke in the rotated tail-tip space anti-aliased into multi-tone mush. One down each lobe, starting 2.5 px
    // out so the pair never merges into a pale blob at the tail tip
    ctx.save(); flukePath(ctx, st); ctx.clip();
    const H = F.h / 2 - 2.5, a = info.ang + droop, ox = J.tailX[tn], oy = J.tailY[tn];
    for (let i = 0; i < F.rays; i++) {
      const v = F.rays === 1 ? 0 : -1 + (2 * i) / (F.rays - 1);
      localToRootPt(ox, oy, a, -2.5, v * 2.5, R0);
      localToRootPt(ox, oy, a, -F.d + 1.5, v * H, R1);
      ctx.save(); if (droop) ctx.rotate(-droop * Math.PI / 180);
      enterFaceFromLocal(ctx, rig, ox, oy, info.ang, R0.x, R0.y);
      ctx.fillStyle = info.pal.horn;
      pixelStroke(ctx, 0, 0, R1.x - R0.x, R1.y - R0.y);
      ctx.restore(); ctx.restore();
    }
    // the adult's glow dots, 2 x 2 in face space too, 2 px in from each lobe tip
    for (let k = st === 'adult' ? 0 : 2; k < 2; k++) {
      localToRootPt(ox, oy, a, -F.d + 3, (k ? 1 : -1) * (F.h / 2 - 3), R0);
      ctx.save(); if (droop) ctx.rotate(-droop * Math.PI / 180);
      enterFaceFromLocal(ctx, rig, ox, oy, info.ang, R0.x, R0.y);
      ctx.fillStyle = info.pal.glow; ctx.fillRect(-1, -1, 2, 2);
      ctx.restore(); ctx.restore();
    }
    ctx.restore();
  }
  ctx.restore();
};
const R0 = { x: 0, y: 0 }, R1 = { x: 0, y: 0 };

/**
 * FIRST PASS: bible 3.6 table "Fin-ears": behind the cheek, pointing back along the neck, never up. Cranium space.
 * Flare (mood >= 0.5) fans the ray 2 px longer, rising <= 10 deg; sad or dry droops them 30 deg.
 */
function finEar(ctx: CanvasRenderingContext2D, rig: DragonRig, info: DragonInfo): void {
  const F = FIN[info.stage], r = info.r;
  const flare = info.mood >= 0.5, droop = info.mood <= -0.3;
  const ang = (22 + (droop ? 30 : 0) - (flare ? 12 : 0)) * Math.PI / 180;      // below straight back
  const L = F.l + (flare ? 2 : 0), H = F.h;
  const ex = -r * 0.55 + (info.far ? -3 : 0), ey = r * 0.2 + (info.far ? -1 : 0);
  ctx.save();
  ctx.translate(ex, ey);
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
    // the ray: 2 px horn as a whole-pixel run in face space, clipped to the ear (a rotated 2 px rect was mush)
    ctx.save(); ctx.clip();
    const c = Math.cos(-ang), s = Math.sin(-ang);
    cranToRootPt(rig, ex + 1 * c, ey + 1 * s, R0);
    cranToRootPt(rig, ex + (-L + 2) * c, ey + (-L + 2) * s, R1);
    ctx.rotate(ang); ctx.translate(-ex, -ey);
    enterFaceFromCranium(ctx, rig, R0.x, R0.y);
    ctx.fillStyle = info.pal.horn;
    pixelStroke(ctx, 0, 0, R1.x - R0.x, R1.y - R0.y);
    ctx.restore(); ctx.restore();
  }
  ctx.restore();
}
const farHead: ElementDraw = (ctx, rig, _pose, info) => finEar(ctx, rig, info);
const nearHead: ElementDraw = (ctx, rig, _pose, info) => finEar(ctx, rig, info);

/** Three spot states, each >= 40 % from the next (gate h): glow when happy, the dim spot when sad or dry. */
function markingTone(info: DragonInfo): string {
  return info.mood >= 0.5 ? info.pal.glow : info.mood <= -0.3 ? DIM : info.pal.marking;
}

// Pearl spots along the lateral line: the first on the rear flank (it shows at every stage: 2.7), the rest forward
// along the flank and back along the tail's side, where the line runs on. Each is 3 x 3 (5.2); the rig fits flank
// spots to where they show and the pet seed jitters every spot after the first by +-1 px up or down (2.8), so the
// row reads as spots, not a dashed stripe.
const spot = (t: number) => ({ kind: 'spot' as const, at: 'flank' as const, t, size: 3 });
const tailSpot = (t: number) => ({ kind: 'spot' as const, at: 'tail' as const, t, size: 3 });

// FIRST PASS: bible 3.6 table "Dorsal fin". The folded wing lies along the upper back (1.3) and would hide a fin
// there, so this pass runs the fin from the tail root over the rump, behind the wing's tip; settle it with the wing.
/** One bubble: a `glow` fill at alpha 0.45 on a 1 px `membrane` ring (it reads on a pale floor), a 2 x 2 highlight. */
function bubble(ctx: CanvasRenderingContext2D, rig: DragonRig, info: DragonInfo, x: number, y: number, r: number): void {
  ctx.beginPath(); ctx.arc(x, y, r + 0.5, 0, Math.PI * 2);
  ctx.lineWidth = 1; ctx.strokeStyle = rig.col(info.pal.membrane); ctx.stroke();
  ctx.save(); ctx.globalAlpha *= 0.45; disc(ctx, rig, x, y, r, info.pal.glow); ctx.restore();
  if (r >= 3) { ctx.fillStyle = rig.col(DRAGON_SHARED.catchlight); ctx.fillRect(Math.round(x - r * 0.5) - 1, Math.round(y - r * 0.5) - 1, 2, 2); }
}
/** A pop: 2 f of a 4-dot star. */
function pop(ctx: CanvasRenderingContext2D, rig: DragonRig, info: DragonInfo, x: number, y: number, r: number): void {
  ctx.fillStyle = rig.col(info.pal.membrane);
  ctx.fillRect(x - r - 1, y - 1, 2, 2); ctx.fillRect(x + r - 1, y - 1, 2, 2); ctx.fillRect(x - 1, y - r - 1, 2, 2); ctx.fillRect(x - 1, y + r - 1, 2, 2);
}

/**
 * FIRST PASS: bible 3.6 "Signature: Bubble Jet". Mouth space. STREAM (cue >= 0): 8 bubbles (young 4), r 2 to 4,
 * along the snout line, one every 3 f at 2 px/f (6 px apart), each rising 0.2 px/f with a +-1 px wobble stepped
 * every 4 f, life 22 f, then a 2 f pop. BABY: one big bubble grows on its own snout from the wind-up, r 2 -> 6, and pops in its face at cue 8;
 * the anim then shows `happy` (tuning.breath). Still to do: the cheek puff and fin flare of the wind-up, the 4
 * droplets.
 */
const breath: ElementDraw = (ctx, rig, pose, info) => {
  if (pose.act !== ACT.breath || rig.override) return;
  const c = pose.cue, st = info.stage, a = info.ang * Math.PI / 180, upx = -Math.sin(a), upy = -Math.cos(a);
  if (st === 'baby') {
    if (c < -6 || c > 10) return;
    if (c >= 8) { pop(ctx, rig, info, 3, -2, 6); return; }
    const r = Math.round(2 + 4 * (c + 6) / 14);
    bubble(ctx, rig, info, 1 + r * 0.6, -2, r);
    return;
  }
  if (c < 0) return;
  // one bubble every 3 f at 2 px/f: 6 px apart along the stream, radii alternating small / large (adjacent pairs sum
  // <= 7), so the jet reads as a string of bubbles; 8 bubbles 3.6 px apart at r 2-5 clumped into a bunch of grapes
  const n = st === 'adult' ? 8 : 4;
  for (let k = 0; k < n; k++) {
    const age = c - 3 * k;
    if (age < 0 || age >= 24) continue;
    const r = BUB_R[k % BUB_R.length], wob = Math.floor(age / 4) % 2 ? 1 : -1;
    const x = Math.round(3 + age * 2 + upx * age * 0.2), y = Math.round(upy * age * 0.2 + wob + (k % 2 ? -1 : 1));
    if (age >= 22) pop(ctx, rig, info, x, y, r); else bubble(ctx, rig, info, x, y, r);
  }
};
/** Stream bubble radii, in spawn order. */
const BUB_R: readonly number[] = [3, 2, 4, 2, 3, 2, 4, 3];

/**
 * FIRST PASS: bible 3.6 "Idle fidget: a dog-style shake that throws droplets (36 f)": the body twists side to side
 * (root rot +-5 on 3 f beats, planted paws counter-rotated so they stay down), the head shakes against it, eyes
 * shut; ambient() flings the droplets while act = fidget.
 */
function fidget(stage: Stage): ReturnType<typeof bake> {
  const k = stage === 'adult' ? 1 : stage === 'young' ? 0.85 : 0.6, L = Math.round(36 * k), t = (f: number) => Math.round(f * k);
  const rot: [number, number][] = [[0, 0]], hd: [number, number][] = [[0, 0]];
  for (let f = 4, i = 0; f < 28; f += 3, i++) { rot.push([t(f), i % 2 ? -5 : 5]); hd.push([t(f + 1), i % 2 ? 8 : -8]); }
  rot.push([t(30), 0]); hd.push([t(31), 0]);
  return bake({
    'root.rot': rot, 'head.rot': hd,
    squash: [[0, 1], [t(4), 1.03], [t(28), 1.03], [t(32), 1]],
    'tail.stiff': [[0, 0], [t(4), 0.4], [t(30), 0.4], [L, 0]],
    face: [[0, DFACE.neutral], [t(4), DFACE.closed], [t(30), DFACE.neutral]],
    act: [[0, ACT.fidget]], cue: [[0, 0], [L, L]],
  }, { stage, len: L, next: 'idle' });
}

/**
 * FIRST PASS: bible 3.6 "Ambient". While the shake fidget plays (act = fidget): 6 droplets flung off the back and
 * flanks from cue 6, each 2 x 3 `glow` with a 1 px `membrane` ring (bare glow sat 12 % from the floor), ballistic,
 * lying on the floor at the end. Root space; seeded, aged from the pose's cue. Still to do: the chin / fin-ear drip
 * every 180 +- 60 f and the breathing spots.
 */
const ambient: ElementDraw = (ctx, rig, pose, info) => {
  if (pose.act !== ACT.fidget || rig.override) return;
  const J = rig.j, d = rig.dims;
  for (let i = 0; i < 6; i++) {
    const age = pose.cue - 6 - (i >> 1) * 3;
    if (age < 0 || age > 30) continue;
    const h1 = hash01(info.seed + 5, i), h2 = hash01(info.seed + 9, i), side = i % 2 ? 1 : -1;
    const x0 = J.body.x + (h1 - 0.5) * d.bodyLen, y0 = J.body.y - d.chestR;
    const vx = side * (0.6 + 0.8 * h2), vy = -(1.0 + 0.6 * h1), g = 0.12;
    const x = Math.round(x0 + vx * age), y = Math.round(Math.min(-3, y0 + vy * age + g * age * age / 2));
    ctx.fillStyle = rig.col(info.pal.membrane); ctx.fillRect(x - 2, y - 2, 4, 5);
    ctx.fillStyle = rig.col(info.pal.glow); ctx.fillRect(x - 1, y - 1, 2, 3);
  }
};

export const WATER: ElementSpec = {
  id: 'water',
  name: 'Ripple',
  blurb: 'Gentle, curious and playful. It loves baths, sings in bubbles and floats belly-up in the pond.',
  palette: PAL,
  modifiers: { bodyLength: 1.1, bodyDepth: 0.9, legLength: 0.8, legR: 1.0, neckLength: 1.3, neckAngle: 0, tailLength: 1.15, tailR: 1.0, snout: 1.0 },
  stages: {
    baby: {
      // tipBox: round the fluke, drooped 15 deg and with its ink (tailTip): the rig lifts the tail's end so it never
      // hangs through the floor, asleep on the floor, begging with the tail down or plopped on its rump (1.1, 5.1 #14)
      tailRest: TAIL_REST.water.baby, tailR: [3.5, 1.5], tipBox: [-6, -6.5, 3.5, 6.5], horns: null, markings: [spot(-0.1), tailSpot(0.3)],
      wing: wingParams({ style: 'fin', plus: true, scallop: -2 }), dorsal: null,
    },
    young: {
      tailRest: TAIL_REST.water.young, tipBox: [-7, -7.5, 1.5, 8], horns: null, markings: [spot(-0.1), spot(0.45), tailSpot(0.22)],
      wing: wingParams({ style: 'fin', plus: true, scallop: -2 }), dorsal: { height: 2, scallops: 2, from: -13, to: -5 },
    },
    adult: {
      tailRest: TAIL_REST.water.adult, tipBox: [-9, -10, 1.5, 11], horns: null, markings: [spot(-0.1), spot(0.3), spot(0.7), tailSpot(0.16), tailSpot(0.34)],
      wing: wingParams({ style: 'fin', plus: true, scallop: -3 }), dorsal: { height: 3, scallops: 3, from: -19, to: -6 },
    },
  },
  render: { tailTip, farHead, nearHead, breath, ambient },
  markingTone,
  anims: {
    // FIRST PASS: bible 4.3 "Water": the slinky walk (body pitch +-2, an S-wave through neck and tail 8 f behind the
    // legs) and the baby's bubble that pops in its own face, then `happy`. Still to do: the happy flourish (3 bubbles,
    // fin-ears flare at cue 0), the lip-lick hungry tell, the spots pulsing with each sleeping breath and a nostril
    // bubble on every exhale (act = sleep, cue). The shake fidget: fidget(), its droplets: ambient().
    fidget,
    tuning: (st) => ({
      walk: { sway: st === 'baby' ? 1 : 2, wave: st === 'adult' ? 8 : st === 'young' ? 7 : 4 },
      // asleep the long tail lies out along the floor, so the fluke (the cue) stands clear of it (the baby too: not
      // the bun's default wrap under the body, which would hide its paddle)
      sleep: st === 'baby' ? { tailCurl: 3, tailLift: 14 } : { tailCurl: 3 },
      breath: { fizzleFace: 'happy' },
    }),
  },
};

