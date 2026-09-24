// SHRIEKSCALE: "Echo", the night-singer (docs/ART_BIBLE.md 3.7), a sound dragon. Zone: the head. Cue: ribbed
// ear-fans that double the head, laid back when scared, upright when curious, a dish when it shrieks.
import { DRAGON_PALETTES } from '../palettes.ts';
import { TAIL_REST } from '../stages.ts';
import type { Stage } from '../stages.ts';
import { wingParams } from '../element.ts';
import type { ElementSpec, ElementDraw, DragonInfo } from '../element.ts';
import type { DragonRig } from '../rig.ts';
import { cranToRootPt, enterFaceFromCranium, enterFaceFromLocal } from '../rig.ts';
import { pixelStroke } from '../features.ts';
import { celPath } from '../../../lib/art/shading.ts';
import { ACT } from '../pose.ts';
import type { DragonPose } from '../pose.ts';

const PAL = DRAGON_PALETTES.shriekscale;

/** Fan height x width, ribs, back-edge scallops (3.7 table). Babies' are round fennec ears on top of the cranium. */
const FAN: Readonly<Record<Stage, { h: number; w: number; ribs: number; scallops: number; depth: number }>> = {
  baby: { h: 10, w: 8, ribs: 1, scallops: 0, depth: 0 },
  young: { h: 12, w: 9, ribs: 2, scallops: 1, depth: 2 },
  adult: { h: 16, w: 12, ribs: 3, scallops: 2, depth: 2 },
};

/**
 * Ribs per stage, fan space: [angle back from straight up (deg), end radius as a fraction of the fan height, start
 * radius px]. They radiate from the root like fingers and spread over the WHOLE free edge -- the tall front-top to
 * the short back -- so their ends sit >= 5 px apart (2 px rib + >= 3 px membrane at the free edge: 3.7, 5.2), each
 * ending ~2 px inside the outline. They start 4 px out, where the fan is too narrow for them, except where two
 * would crowd there: that one starts once it sits ~3.6 px (centre to centre) from its neighbours.
 */
const RIBS: Readonly<Record<Stage, readonly (readonly [number, number, number])[]>> = {
  baby: [[14, 0.7, 4]],
  young: [[0, 0.78, 5.6], [34, 0.56, 4]],
  adult: [[-6, 0.84, 4], [22, 0.66, 7.6], [50, 0.45, 4]],
};

/** Eye-mask height per stage. */
const MASK: Readonly<Record<Stage, number>> = { baby: 6, young: 6, adult: 7 };

/**
 * The fan outline in fan space: root at (0, 0), the fan standing up (-y), its front edge toward +x. Narrow at the
 * root, widest at two-thirds of its height, a round top: a dish-shaped bat / fennec ear, not a rabbit's.
 */
function fanPath(ctx: CanvasRenderingContext2D, st: Stage, k: number, vary = 0): void {
  const F = FAN[st], h = (F.h + vary) * k, w = F.w * k;
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
 * The baby's squeak ends in the fan flop over its eyes (E8: pose.eyeClip 0 while it lasts). Still to do: the rib
 * rattle, the dish shape, the fan twitch ambient.
 */
function fan(ctx: CanvasRenderingContext2D, rig: DragonRig, info: DragonInfo, flareIn: number, pose: DragonPose): void {
  const st = info.stage, F = FAN[st], r = info.r;
  const flare = Math.max(-1, Math.min(1.3, flareIn));
  // ledger E8: after the baby's squeak its fans flop FORWARD over its eyes (the anim lifts the rig's eye clip for
  // exactly those frames: pose.eyeClip 0), landing deep and bouncing once, then pop back up with a blink. Tipped
  // only -62 / -72 from the crown's top they lay on it like a beret and the eye stayed in full view: pivoted from
  // the crown's front and tipped -145 / -135 (-110 still only capped the eye's top half), the near fan's lobe hangs
  // down over the eye, a sliver of it peeking out behind
  const flop = st === 'baby' && pose.act === ACT.breath && pose.eyeClip < 0.5;
  // Asleep the young and adult head lies level (on its paws: tuning), so "back along the neck" is flat and a fan
  // laid back there only reached the back line: the asleep silhouette lost the cue (5.1 #1). They lean 25 deg back
  // from the WORLD's vertical (the head's own pitch taken out), so their tips stand >= 4 px above the neck, back and
  // wing while they still read as laid back, the closed eye in view. The baby's bun lays them flat back (flare -1)
  // over its bowed head.
  const baby = st === 'baby';
  const lean = flop ? (pose.cue < 16 ? -145 : -135) : info.asleep ? (baby ? 95 : 25 + rig.j.headAng) : flare >= 0 ? 40 - 40 * Math.min(1, flare) : 40 - 55 * flare;
  const k = flare > 1 ? 1 + (flare - 1) : 1;
  // (flopped, the fans pivot from the FRONT of the crown, so the lobe hangs over the eye instead of the cheek)
  const a = (flop ? 72 : baby ? 100 : 128) * Math.PI / 180, rr = r * (baby ? 0.72 : 0.62);
  const tx = Math.cos(a) * rr + (info.far ? -4 : 0), ty = -Math.sin(a) * rr + (info.far ? -1 : 0);
  // the head pitch is already in the space; lean back = counter-clockwise
  const th = -(lean + (info.far ? 14 : 0) + (baby ? -18 : 0)) * Math.PI / 180;
  ctx.save();
  // the far fan: root 4 px behind and 1 px above, turned 14 deg further back, so >= 30 % of it shows (1.5)
  ctx.translate(tx, ty);
  ctx.rotate(th);
  // the pet's +-1 px fan-height variant (2.8)
  const vary = info.sp.lenVar || 0;
  fanPath(ctx, st, k, vary);
  celPath(ctx, rig, info.pal.membrane, 0, -F.h * k / 2, F.h * k / 2, 0.36, 0);
  if (!info.far && !rig.override && F.ribs) {
    // ribs: 2 px horn as WHOLE-PIXEL runs in a device-aligned space (a rotated 2 px stroke anti-aliases into a
    // pale smear), clipped to the fan
    ctx.save(); fanPath(ctx, st, k, vary); ctx.clip();
    const R = RIBS[st], h = (F.h + vary) * k, c = Math.cos(th), s = Math.sin(th);
    for (let i = 0; i < R.length; i++) {
      const ph = R[i][0] * Math.PI / 180, dx = -Math.sin(ph), dy = -Math.cos(ph), L = R[i][1] * h;
      const r0 = R[i][2] * k;
      // fan space -> cranium space -> root space, for both ends
      cranToRootPt(rig, tx + (dx * r0) * c - (dy * r0) * s, ty + (dx * r0) * s + (dy * r0) * c, P0);
      cranToRootPt(rig, tx + (dx * L) * c - (dy * L) * s, ty + (dx * L) * s + (dy * L) * c, P1);
      // out of fan space into cranium space, then face space (one save each, so two restores)
      ctx.save(); ctx.rotate(-th); ctx.translate(-tx, -ty);
      enterFaceFromCranium(ctx, rig, P0.x, P0.y);
      ctx.fillStyle = info.pal.horn;
      pixelStroke(ctx, 0, 0, P1.x - P0.x, P1.y - P0.y);
      ctx.restore(); ctx.restore();
    }
    ctx.restore();
  }
  ctx.restore();
}
const P0 = { x: 0, y: 0 }, P1 = { x: 0, y: 0 };
const farHead: ElementDraw = (ctx, rig, pose, info) => fan(ctx, rig, info, info.mood + pose.flare, pose);
const nearHead: ElementDraw = (ctx, rig, pose, info) => fan(ctx, rig, info, info.mood + pose.flare, pose);

/**
 * FIRST PASS: bible 3.7 table "Eye mask": a pale lilac "spectacles" patch from the snout base to behind the eye,
 * clipped to the skull (the rig clips), no ink. Drawn as a pixel bitmap in FACE space, centred on the eye like the
 * eye itself (a rect in the pitched cranium space stair-steps into a band that reads as a highlight): 3 px behind
 * the eye to 3 px in front of it, `MASK` rows tall, its four corners cut by 1 px so it reads as a soft patch.
 */
const headMarkings: ElementDraw = (ctx, rig, pose, info) => {
  const e = rig.dims.head.eye, h = MASK[info.stage];
  const x0 = -Math.floor(e.w / 2) - 3, w = e.w + 6, y0 = -Math.floor(h / 2);
  enterFaceFromCranium(ctx, rig, rig.j.eye.x, rig.j.eye.y);
  ctx.fillStyle = info.pal.marking;
  ctx.fillRect(x0 + 1, y0, w - 2, h); ctx.fillRect(x0, y0 + 1, w, h - 2);
  ctx.restore();
};

/** Throat-sac swell per stage (3.7 table), px. */
const SAC: Readonly<Record<Stage, number>> = { baby: 3, young: 5, adult: 7 };

/**
 * FIRST PASS: bible 3.7 table "Throat sac": swells through the breath's wind-up (act = breath, cue -10 .. 0), holds
 * through the release and empties as the arcs go out. Still to do: the lonely call's own swell.
 */
const neckSac = (pose: { act: number; cue: number }, info: DragonInfo): number => {
  if (pose.act !== ACT.breath) return 0;
  const c = pose.cue, k = c < -10 ? 0 : c < 0 ? (c + 10) / 10 : c < 4 ? 1 : c < 12 ? 1 - (c - 4) / 8 : 0;
  return SAC[info.stage] * k;
};

/**
 * One sound arc: 2 px `membrane` with a 1 px `scale` outer edge (47 % / 92 % from the floor), +-span deg about the
 * mouth's facing, as WHOLE-PIXEL runs in face space at the mouth: 2 x 2 stamps round the arc, the scale ring stamped
 * 1 px further out first so its outer pixel survives. Canvas arcs in the rotated mouth space smeared the 2 px pink and
 * its 1 px edge into soft bands at game scale (5.1 #12). Call in mouth space; `ang` = info.ang.
 */
function soundArc(ctx: CanvasRenderingContext2D, rig: DragonRig, info: DragonInfo, r: number, span: number): void {
  const J = rig.j, a0 = info.ang * Math.PI / 180, s = span * Math.PI / 180;
  enterFaceFromLocal(ctx, rig, J.mouth.x, J.mouth.y, info.ang, J.mouth.x, J.mouth.y);
  for (let pass = 0; pass < 2; pass++) {
    const rr = pass ? r : r + 1;
    ctx.fillStyle = rig.col(pass ? info.pal.membrane : info.pal.scale);
    const n = Math.max(2, Math.ceil(rr * s * 2));
    for (let i = 0; i <= n; i++) {
      const a = a0 - s + (2 * s * i) / n;
      ctx.fillRect(Math.round(Math.cos(a) * rr) - 1, Math.round(Math.sin(a) * rr) - 1, 2, 2);
    }
  }
  ctx.restore();
}

/**
 * FIRST PASS: bible 3.7 "Signature: Shriek". Mouth space. The wind-up is shared (the fans fold flat on `flare` -1,
 * the head pulls back) plus the throat sac (neckSac); the release snaps the fans to the dish (`flare` 1.3) and the
 * jaw to 40 (tuning.breath). ARCS (cue >= 0): 3 (young 2), one every 8 f, radius 6 -> 34 over 24 f (young -> 24),
 * fading by NARROWING, never alpha: span +-35 -> +-25 -> +-15 by thirds of their life. BABY: a squeak, one arc
 * r 4 -> 14 over 12 f, then the fans flop over its eyes (fan(), E8). Still to do: the rib rattle (+-1 px every 2 f),
 * the neighbours' flinch (event 'shriek').
 */
const breath: ElementDraw = (ctx, rig, pose, info) => {
  if (pose.act !== ACT.breath || pose.cue < 0 || rig.override) return;
  const c = pose.cue, st = info.stage;
  const n = st === 'adult' ? 3 : st === 'young' ? 2 : 1, life = st === 'baby' ? 12 : 24;
  const r0 = st === 'baby' ? 4 : 6, r1 = st === 'adult' ? 34 : st === 'young' ? 24 : 14;
  for (let k = 0; k < n; k++) {
    const age = c - 8 * k;
    if (age < 0 || age >= life) continue;
    const f = age / life;
    soundArc(ctx, rig, info, Math.round(r0 + (r1 - r0) * f), f < 1 / 3 ? 35 : f < 2 / 3 ? 25 : 15);
  }
};

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
  render: { farHead, nearHead, headMarkings, breath },
  neckSac,
  anims: {
    // FIRST PASS: bible 4.2 / 3.7: the shriek opens the jaw to its 40 deg. Still to do: the happy song (note glyphs
    // at cue 0), fans bobbing 1 f behind the head in the walk, the chirp-arc hungry tell with the fans pinned
    // forward, the snore arc on each sleeping exhale (act = sleep, cue), the lonely call (its own anim).
    // Asleep it rests its head on its paws, so the fans (25 deg back, fan()) stand clear above the back and wing.
    // The baby's squeak ends in the fan flop over its eyes, 24 f (ledger E8), then a blink.
    tuning: (st) => ({
      breath: { jaw: st === 'adult' ? 40 : st === 'young' ? 34 : 24, flop: st === 'baby' ? 24 : 0, fizzleFace: st === 'baby' ? 'sheepish' : 'dazed' },
      sleep: { chin: st === 'adult' ? 5.5 : 4.5 },
    }),
  },
};
