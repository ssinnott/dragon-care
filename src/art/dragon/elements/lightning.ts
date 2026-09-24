// LIGHTNING: "Zap", the storm dragon (docs/ART_BIBLE.md 3.5). Zone: the space above the back, behind the head.
// Cue: bolt wings, held cocked upright and leaning back -- a yellow membrane with a zigzag trailing edge on a blue
// body. They never fold flat: asleep they drop to the sad cock. The cock angle is the mood gauge.
import { DRAGON_PALETTES } from '../palettes.ts';
import { TAIL_REST } from '../stages.ts';
import type { Stage } from '../stages.ts';
import { hornParams, wingParams } from '../element.ts';
import type { ElementSpec, ElementDraw } from '../element.ts';
import { pathPts, hornTip, mouthToRoot } from '../features.ts';
import { ACT } from '../pose.ts';
import { bake } from '../anims.ts';
import { hash01 } from '../fx.ts';
import { celPath, outlinePath } from '../../../lib/art/shading.ts';
import { cranToRootPt, enterFaceFromLocal, localToRootPt } from '../rig.ts';

const PAL = DRAGON_PALETTES.lightning;

/**
 * The bolt polygons in wing space (root at 0,0, +x forward, up negative), as drawn at their authored cock `at`.
 * Adult: 3.5's simple polygon, 15 x 28 -- leading edge, then the zigzag trailing edge whose two shelves end 5.7 and
 * 9.2 px behind the leading edge, so the 3 px spar plus >= 2 px of yellow survive at both steps.
 * Young: the adult's scaled to 16 x 9. Baby: a 12 x 5 bolt nub with one 2 px zigzag step at 55 % of its height.
 */
const ADULT = [0, 0, -3, -13, -8, -28, -14, -17, -10, -17, -15, -8, -11, -8, -8, 0];
const scalePts = (p: readonly number[], kx: number, ky: number) => p.map((v, i) => (i % 2 ? v * ky : v * kx));
const BOLT: Readonly<Record<Stage, { pts: readonly number[]; spar: readonly number[]; at: number; sparR: number; w: number; h: number }>> = {
  baby: { pts: [0, 0, -1.5, -6, -3, -12, -5.5, -5.4, -3.5, -5.4, -5, 0], spar: [], at: 105, sparR: 0, w: 5, h: 12 },
  // young: the adult's scaled to 16 x 9 (not 7): at 7 wide its 2 px spar left only 2-3 px of yellow beside it
  young: { pts: scalePts(ADULT, 9 / 15, 16 / 28), spar: scalePts([0, 0, -3, -13, -8, -28], 9 / 15, 16 / 28), at: 115, sparR: 1, w: 9, h: 16 },
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
  // the breath's wind-up flares the bolts to 95 deg and they hold it through the snap and the stream (3.5 "Spark
  // Bolt"), easing back with the stream's envelope: keyed on `cue < 0 || fx > 0`, they dropped back to the rest cock
  // for the 2-3 f between the wind-up and the stream, right at the snap
  const flare = pose.act === ACT.breath ? (pose.cue < 6 ? Math.min(1, (pose.cue + 20) / 4) : pose.fx) : pose.wing.fold;
  const cock = cockOf(info.stage, info.mood, info.asleep, flare);
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

/** The bolt's nodes (mouth space), rewritten per frame, and the tapered outline built round them. */
const BX = new Float32Array(6), BY = new Float32Array(6), OUT = new Float32Array(24), MX = new Float32Array(6), MY = new Float32Array(6);
const SEGS = [8, 6, 8, 6];

/**
 * Fill the polyline BX/BY[0..n] as a TAPERED bolt in `glow` with a 1 px ink outline: `w0` px wide at the mouth,
 * narrowing to 40 % of that at the tip, the sides offset along each node's averaged normal. A constant 3 px zig with
 * mitred +-30 deg bends read as a bent drinking straw; tapered to a point, its last segment and the fork were a
 * 1 px ink hair under the mark floor (5.2).
 */
function zig(ctx: CanvasRenderingContext2D, rig: import('../rig.ts').DragonRig, n: number, glow: string, w0: number): void {
  let m = 0;
  for (let side = 0; side < 2; side++) for (let j = 0; j <= n; j++) {
    const i = side ? n - j : j;
    const ax = BX[Math.min(n, i + 1)] - BX[Math.max(0, i - 1)], ay = BY[Math.min(n, i + 1)] - BY[Math.max(0, i - 1)];
    const L = Math.hypot(ax, ay) || 1, h = (w0 / 2) * (1 - 0.6 * i / n) * (side ? -1 : 1);
    OUT[m++] = BX[i] - ay / L * h; OUT[m++] = BY[i] + ax / L * h;
  }
  pathPts(ctx, OUT, 1, 0, 0, m);
  outlinePath(ctx, rig);
  ctx.fillStyle = rig.col(glow); ctx.fill();
}

/** The 5 x 5 impact diamond, whole pixels (rows as masks, high bit left), with its ink ring. */
const DIAMOND: readonly number[] = [0b00100, 0b01110, 0b11111, 0b01110, 0b00100];

/**
 * FIRST PASS: bible 3.5 "Signature: Spark Bolt". Mouth space. The wind-up flares the wings (wing(), above). BOLT
 * (cue 0..20): a 4-segment polyline from the mouth (young 2), lengths 8 / 6 / 8 / 6, each segment kinked 40-49 deg
 * the OTHER way from the last (seeded, re-rolled every 4 f) so it zigzags like a bolt (at 50-60 deg it folded up
 * into a 16 px "N"), filled as a taper from 3.5 px to 40 % with ink, a 6 px fork off the middle node (3 px wide: at
 * 2 px to a point it was an ink hair), and a 5 x 5 impact diamond at the tip drawn in whole
 * pixels in face space (a diamond in the rotated mouth space rendered as a square block). WIND-UP (cue < 0): the
 * spark crawlers between the horn and bolt tips (crawlers()). BABY: a 4 f "static pop": one 2-segment spark off the
 * nose, then the anim's dazed face. Still to do: the pupil contracting, the 2 f glow tint on the dragon.
 */
const breath: ElementDraw = (ctx, rig, pose, info) => {
  if (pose.act !== ACT.breath || rig.override) return;
  if (pose.cue < 0) { crawlers(ctx, rig, pose, info); return; }
  const c = pose.cue, st = info.stage, baby = st === 'baby';
  if (c >= (baby ? 4 : 20)) return;
  const n = st === 'adult' ? 4 : 2, roll = Math.floor(c / 4), seed = info.seed * 31 + roll;
  const base = baby ? -0.5 : 0, s0 = hash01(seed, 7) > 0.5 ? 1 : -1;
  let x = baby ? -1 : 1, y = baby ? -3 : 0;
  BX[0] = x; BY[0] = y;
  for (let i = 0; i < n; i++) {
    const ang = base + (i % 2 ? -s0 : s0) * (0.7 + 0.15 * hash01(seed, i));
    const L = baby ? 3 : SEGS[i];
    x += Math.cos(ang) * L; y += Math.sin(ang) * L;
    BX[i + 1] = Math.round(x); BY[i + 1] = Math.round(y);
  }
  const tx = BX[n], ty = BY[n];
  if (!baby) {
    // the fork first, so the main bolt's ink runs over its root: one 6 px segment off the middle node, splitting
    // away from the main line's next segment (3.5)
    MX.set(BX); MY.set(BY);
    const fk = n >> 1, fx = MX[fk], fy = MY[fk], nx = MX[fk + 1] - fx, ny = MY[fk + 1] - fy;
    const a = Math.atan2(ny, nx) + (ny > 0 ? -0.8 : 0.8);
    BX[0] = fx; BY[0] = fy; BX[1] = Math.round(fx + Math.cos(a) * 6); BY[1] = Math.round(fy + Math.sin(a) * 6);
    zig(ctx, rig, 1, info.pal.glow, 3);
    BX.set(MX); BY.set(MY);
  }
  zig(ctx, rig, n, info.pal.glow, baby ? 2 : 3.5);
  if (baby) return;
  const J = rig.j;
  localToRootPt(J.mouth.x, J.mouth.y, info.ang, tx, ty, TP);
  enterFaceFromLocal(ctx, rig, J.mouth.x, J.mouth.y, info.ang, TP.x, TP.y);
  for (let pass = 0; pass < 2; pass++) {
    ctx.fillStyle = rig.col(pass ? info.pal.glow : rig.outline);
    for (let r = 0; r < 5; r++) for (let q = 0; q < 5; q++) {
      if (!((DIAMOND[r] >> (4 - q)) & 1)) continue;
      if (pass) ctx.fillRect(q - 2, r - 2, 1, 1); else ctx.fillRect(q - 3, r - 3, 3, 3);
    }
  }
  ctx.restore();
};
const TP = { x: 0, y: 0 }, HT = { x: 0, y: 0 }, WT = { x: 0, y: 0 };

/**
 * The wind-up's spark crawlers (3.5): two FLAT 2 x 2 `glow` sparks (they never reach the floor, so no ring: ringed
 * in `scale` they read as hollow square boxes) hopping between the near horn's tip and the near bolt's tip in 6 whole-pixel steps, one hop every
 * 3 f, the second a half-trip behind the first, over the wind-up's last 18 f. Root space, from the mouth anchor.
 * Young and adult (a baby's nubs and buds are too close: its static pop is enough).
 */
function crawlers(ctx: CanvasRenderingContext2D, rig: import('../rig.ts').DragonRig, pose: import('../pose.ts').DragonPose, info: import('../element.ts').DragonInfo): void {
  const hp = info.sp.horns, B = BOLT[info.stage];
  if (!hp || info.stage === 'baby' || pose.cue < -18) return;
  const J = rig.j;
  hornTip(hp, rig.dims.head.cranR, HT, J.neckRef);
  cranToRootPt(rig, HT.x, HT.y, HT);
  // the bolt's top vertex, turned by the flared cock (95) from its authored one, in wing space -> root space
  const a = -(95 - B.at) * Math.PI / 180, vx = B.pts[4], vy = B.pts[5];
  localToRootPt(J.wingN.x, J.wingN.y, J.wingAngN, vx * Math.cos(a) - vy * Math.sin(a), vx * Math.sin(a) + vy * Math.cos(a), WT);
  ctx.save();
  mouthToRoot(ctx, rig, info.ang);
  for (let k = 0; k < 2; k++) {
    const step = Math.floor((pose.cue + 18) / 3) + k * 3, u = step % 12 < 6 ? (step % 6) / 5 : 1 - (step % 6) / 5;
    const x = Math.round(HT.x + (WT.x - HT.x) * u), y = Math.round(HT.y + (WT.y - HT.y) * u);
    ctx.fillStyle = rig.col(info.pal.glow); ctx.fillRect(x - 1, y - 1, 2, 2);
  }
  ctx.restore();
}

/**
 * FIRST PASS: bible 3.5 "Idle fidget: zoomies, dashing 40 px and back (50 f)": bunny-hop dashes out and back
 * (root.x, paws tucked on every 6 f hop so they never skate), the bolts flared excited. Still to do: a real run
 * (the walk's gait at 3x) and the turn at the far end.
 */
function fidget(stage: Stage): ReturnType<typeof bake> {
  const k = stage === 'adult' ? 1 : stage === 'young' ? 0.85 : 0.6, L = Math.round(50 * k), t = (f: number) => Math.round(f * k);
  const dist = stage === 'adult' ? 40 : stage === 'young' ? 32 : 20;
  const hy: [number, number][] = [[0, 0]], lf: [number, number][] = [[0, 0]];
  for (let f = 4; f < 46; f += 6) { hy.push([t(f), 0], [t(f + 3), -3], [t(f + 6), 0]); lf.push([t(f), 0], [t(f + 1), 2], [t(f + 5), 2], [t(f + 6), 0]); }
  return bake({
    'root.x': [[0, 0], [t(4), 0, 'inout'], [t(24), dist, 'inout'], [t(28), dist, 'inout'], [t(46), 0]],
    'root.y': hy,
    'legNH.lift': lf, 'legNF.lift': lf, 'legFH.lift': lf, 'legFF.lift': lf,
    'body.rot': [[0, 0], [t(4), 4], [t(24), 4], [t(28), -4], [t(46), 0]],
    'tail.stiff': [[0, 0], [t(4), 0.5], [t(46), 0.5], [L, 0]],
    mood: [[0, 0], [t(4), 1], [t(46), 1], [L, 0]],
    act: [[0, ACT.fidget]], cue: [[0, 0], [L, L]],
  }, { stage, len: L, next: 'idle' });
}

export const LIGHTNING: ElementSpec = {
  id: 'lightning',
  name: 'Zap',
  blurb: 'Hyper, zippy and curious. Static builds when it is bored, so play with it before you pet it.',
  palette: PAL,
  modifiers: { bodyLength: 1.0, bodyDepth: 0.85, legLength: 1.2, legR: 0.9, neckLength: 1.0, neckAngle: 0, tailLength: 1.0, tailR: 0.85, snout: 1.2 },
  stages: {
    baby: {
      tailRest: TAIL_REST.lightning.baby,
      horns: hornParams({ len: 1, r0: 1.5, r1: 1.4, at: 118, sink: 0.5, sweep: 50 }),
      // the first Z sits on the tail base at every stage (2.7): the baby's flank is under its head and pot belly.
      // 5 x 5, where all of it clears the hip: a 6 px Z never fits whole inside the baby's thin tail
      markings: [{ kind: 'zstripe', at: 'tail', t: 0.26, size: 5, h: 5 }],
      // the nubs root over the hips at (-3, -6): the generic (+1, -6) is inside the baby's cranium
      wing: wingParams({ style: 'custom', rootDx: -4 }),
      dorsal: null,
    },
    young: {
      tailRest: TAIL_REST.lightning.young,
      horns: hornParams({ len: 5, kinkAt: 0.6, bend: 35, sweep: -4 }),
      markings: [{ kind: 'zstripe', at: 'tail', t: 0.16, size: 5, h: 6 }, { kind: 'zstripe', at: 'haunch', size: 5, h: 7 }],
      wing: wingParams({ style: 'custom', rootDx: -3 }),
      dorsal: null,
    },
    adult: {
      tailRest: TAIL_REST.lightning.adult,
      horns: hornParams({ len: 8, kinkAt: 0.6, bend: 35, sweep: -6 }),
      // haunch and shoulder Zs 6 x 8, not 6 x 9: between the leg roots and the back, the lean body's flank is too
      // shallow for a 9 px Z anywhere (the fit shows 96 % of one at best), and a clipped Z is a speck (5.2); 6 wide
      // keeps the Z's step (at 5 it reads as a slash)
      markings: [{ kind: 'zstripe', at: 'tail', t: 0.14, size: 5, h: 7 }, { kind: 'zstripe', at: 'haunch', size: 6, h: 8 }, { kind: 'zstripe', at: 'shoulder', size: 6, h: 8 }],
      wing: wingParams({ style: 'custom', rootDx: -3 }),
      dorsal: null,
    },
  },
  render: { wing, breath },
  tailHold: 4,
  anims: {
    // FIRST PASS: bible 4.3 "Lightning": it walks 20 % faster (a shorter cycle, a faster world speed); its tail is
    // already stepped (tailHold). Still to do: the happy crackles and spark shower (cue 0), the irregular hungry
    // sparks, the dream-twitch every 6 sleeping breaths. The zoomies fidget: fidget().
    fidget,
    tuning: (st) => ({ walk: st === 'adult' ? { cycle: 40, speed: 0.54 } : st === 'young' ? { cycle: 34, speed: 0.6 } : { cycle: 20, speed: 0.36 } }),
  },
};
