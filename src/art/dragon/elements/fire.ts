// FIRE: "Ember", the hearth dragon (docs/ART_BIBLE.md 3.2). Zone: above the tail tip. Cue: the torch tail, a
// flame on an up-curling tail, which is also its mood meter.
import { DRAGON_PALETTES } from '../palettes.ts';
import { NO_MODIFIERS, TAIL_REST } from '../stages.ts';
import type { Stage } from '../stages.ts';
import { hornParams, wingParams } from '../element.ts';
import type { ElementSpec, ElementDraw } from '../element.ts';
import { emitterFill, emitterCore, pathPts, disc } from '../features.ts';
import { ACT } from '../pose.ts';
import { bake } from '../anims.ts';
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
 * every 90 +- 30 f, through the top pass, never while asleep. (The tail-chase fidget is fidget().)
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

/** Stream puff radii by age step (3 f each): 3, 4, 5, 6, 6, 5 at 5 px spacing (3.2); young max r 4. */
const PUFF_R: Readonly<Record<Stage, readonly number[]>> = { baby: [3, 3, 3, 3, 2, 2], young: [2, 3, 4, 4, 3, 3], adult: [3, 4, 5, 6, 6, 5] };

/**
 * FIRST PASS: bible 3.2 "Signature: Fire Breath". Mouth space (+x out of the mouth). The TELL (cue < 0): 2 nostril
 * smoke puffs in `horn`, alpha 0.5, r 2, rising off the snout top. The STREAM (cue >= 0 while fx > 0): one puff every
 * 3 f for 30 f (young: 3 puffs), each 3 concentric flat discs -- `scale` outer (it keeps the puff readable on any
 * floor), `glow`, `glow.hi` core -- moving out 5 px per 3 f, growing through PUFF_R, drifting up 0.15 px/f, life
 * 18 f; the last two puffs are smoke (`horn`, alpha 0.45). BABY: a hiccup -- one puff (r 3) and 2 embers, then the
 * anim's dazed face. Still to do: the hiss for bath, puffs that leave the head's motion behind.
 */
const breath: ElementDraw = (ctx, rig, pose, info) => {
  if (pose.act !== ACT.breath || rig.override) return;
  const c = pose.cue, st = info.stage, a = info.ang * Math.PI / 180;
  // world "up" in mouth space, for the drift
  const upx = -Math.sin(a), upy = -Math.cos(a);
  const T = tones(rig, info.pal.glow);
  if (c < 0) {
    // the tell: two smoke puffs leaving the nostril (the snout's top, 2 px back from the tip) and drifting up AND
    // forward, away from the eye behind it: drifting straight up, a baby's puffs sat on its pupil (the rig also
    // clips this anchor off the eye box)
    // (mouth space: +x runs out along the snout, world-up is (upx, upy); the nostril sits ~(-1, -4) from the origin)
    const dx = 1 + upx, dy = upy, dl = Math.hypot(dx, dy) || 1;
    for (let k = 0; k < 2; k++) {
      const age = c + 14 - k * 6;
      if (age < 0 || age >= 8) continue;
      const dist = 2 + age * 0.7;
      ctx.save(); ctx.globalAlpha *= 0.5;
      disc(ctx, rig, Math.round(-1 + dx / dl * dist), Math.round(-4 + dy / dl * dist), 2, info.pal.horn);
      ctx.restore();
    }
    return;
  }
  if (st === 'baby') {
    // the hiccup: one puff and two embers popping out and up
    if (c < 9) {
      const r = c < 3 ? 2 : 3;
      disc(ctx, rig, 3, 0, r + 1, info.pal.scale); disc(ctx, rig, 3, 0, r, info.pal.glow); disc(ctx, rig, 3, 0, Math.max(1, r - 2), T.hi);
    }
    for (let k = 0; k < 2; k++) {
      const age = c - 2 - k * 2;
      if (age < 0 || age >= 14) continue;
      ctx.fillStyle = rig.col(T.hi);
      ctx.fillRect(Math.round(4 + age * 0.5 + upx * age * 0.6) - 1, Math.round((k ? 2 : -2) + upy * age * 0.6) - 1, 2, 2);
    }
    return;
  }
  const n = st === 'adult' ? 10 : 3, every = st === 'adult' ? 3 : 6, R = PUFF_R[st];
  for (let k = n - 1; k >= 0; k--) {
    const age = c - k * every;
    if (age < 0 || age >= 18) continue;
    const step = Math.min(5, Math.floor(age / 3)), r = R[step];
    const x = Math.round(3 + age * (5 / 3) + upx * age * 0.15), y = Math.round(upy * age * 0.15);
    if (k >= n - 2 && st === 'adult') {
      ctx.save(); ctx.globalAlpha *= 0.45; disc(ctx, rig, x, y, r, info.pal.horn); ctx.restore();
      continue;
    }
    disc(ctx, rig, x, y, r, info.pal.scale);
    disc(ctx, rig, x, y, r * 0.72, info.pal.glow);
    disc(ctx, rig, x, y, Math.max(1, r * 0.4), T.hi);
  }
};

/**
 * FIRST PASS: bible 3.2 "Idle fidget: it chases its own tail flame (60 f)". A side view cannot turn the head round,
 * so the flame comes to the head instead: the tail sweeps up and forward over the hips, the head tips up and back
 * to watch it, two little hops after it (paws tucked), then it settles. Still to do: a real chase (a turn in place).
 */
function fidget(stage: Stage): ReturnType<typeof bake> {
  const k = stage === 'adult' ? 1 : stage === 'young' ? 0.85 : 0.6, L = Math.round(60 * k), t = (f: number) => Math.round(f * k);
  const hop = (a: number): [number, number][] => [[t(a), 0], [t(a + 4), -3], [t(a + 8), 0]];
  const lift = (a: number): [number, number][] => [[t(a), 0], [t(a + 3), 2], [t(a + 8), 0]];
  return bake({
    'tail.lift': [[0, 0], [t(12), -28], [t(44), -28], [t(58), 0]],
    'tail.curl': [[0, 0], [t(12), -14], [t(44), -14], [t(58), 0]],
    'tail.stiff': [[0, 0], [t(10), 0.6], [t(48), 0.6], [L, 0]],
    // the look BACK: the neck arches back and the head turns up and over past vertical, snout toward the flame
    // (tipped up only -14 / -18 it looked up and forward, away from the tail it was chasing)
    'neck.a0': [[0, 0], [t(12), -30], [t(44), -30], [t(56), 0]],
    'neck.a1': [[0, 0], [t(12), -30], [t(44), -30], [t(56), 0]],
    'head.rot': [[0, 0], [t(14), -115], [t(24), -105], [t(30), -120], [t(36), -105], [t(44), -115], [t(56), 0]],
    'root.y': [[0, 0], ...hop(18), ...hop(30), [L, 0]],
    'legNH.lift': [[0, 0], ...lift(18), ...lift(30)], 'legNF.lift': [[0, 0], ...lift(18), ...lift(30)],
    'legFH.lift': [[0, 0], ...lift(18), ...lift(30)], 'legFF.lift': [[0, 0], ...lift(18), ...lift(30)],
    mood: [[0, 0], [t(12), 1], [t(48), 1], [L, 0]],
    act: [[0, ACT.fidget]], cue: [[0, 0], [L, L]],
  }, { stage, len: L, next: 'idle' });
}

export const FIRE: ElementSpec = {
  id: 'fire',
  name: 'Ember',
  blurb: 'A warm, affectionate show-off with the fastest metabolism. Its tail flame is its mood.',
  palette: PAL,
  modifiers: NO_MODIFIERS,
  stages: {
    baby: {
      tailRest: TAIL_REST.fire.baby,
      // 3 px buds: a near-round nub on the top-back of the cranium, pointing up and back (3.2)
      horns: hornParams({ len: 1, r0: 1.5, r1: 1.4, at: 118, sink: 0.5, sweep: 50 }),
      // the first flame-lick sits on the tail base at every stage (2.7): the baby's head, nub and pot belly leave
      // no flank a 4 x 4 mark can show on. t is where all of it clears the hip (the rig's fit, rig.ts fitMarkings,
      // slides a tail marking out to there anyway; these values say where it lands)
      markings: [{ kind: 'chevron', at: 'tail', t: 0.26, size: 4 }],
      wing: wingParams({ style: 'bat' }),
      dorsal: null,
    },
    young: {
      tailRest: TAIL_REST.fire.young,
      horns: hornParams({ len: 5, sweep: 6 }),
      markings: [{ kind: 'chevron', at: 'tail', t: 0.19, size: 5 }, { kind: 'chevron', at: 'haunch', size: 5 }],
      wing: wingParams({ style: 'bat', scallop: 2 }),
      dorsal: null,
    },
    adult: {
      tailRest: TAIL_REST.fire.adult,
      horns: hornParams({ len: 8, bend: 20, sweep: -4 }),
      markings: [{ kind: 'chevron', at: 'tail', t: 0.16, size: 6 }, { kind: 'chevron', at: 'haunch', size: 6 }, { kind: 'chevron', at: 'shoulder', size: 6 }],
      wing: wingParams({ style: 'bat', scallop: 3 }),
      dorsal: null,
    },
  },
  render: { tailTip, ambient, breath },
  anims: {
    // FIRST PASS: bible 4.3 "Fire": the show-off strut (paw lift 5, head up 4). Still to do: the flame's tongues
    // swapping every 4 f while it walks (tailTip, act = walk), the happy flourish (3 embers, flame 1.4x for 30 f at
    // cue 0), the hungry tell (flame 0.6x, sighing smoke puffs while act = beg). The tail-chase fidget: fidget().
    // Asleep (4.3) the young and adult tail drops to the floor behind the rump, rests along it and curls its end
    // up, so the banked ember stands on the raised tip behind the hips: cozy, not a stiff pole, and the cue still in
    // the asleep silhouette (5.1 #1) in fire's own zone. Wrapped forward round the paws, the ember sat inside the
    // body's outline beside the head and the asleep silhouette was a plain mound. The baby keeps its comma.
    fidget,
    tuning: (st) => ({
      walk: { lift: st === 'adult' ? 5 : st === 'young' ? 4 : 2.5, head: st === 'baby' ? -2 : -4 },
      sleep: st === 'baby' ? { tailCurl: 0, tailLift: 0 } : { tailLift: 72, tailCurl: st === 'adult' ? -21 : -24 },
    }),
  },
};
