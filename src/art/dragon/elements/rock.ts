// ROCK: "Cobble", the boulder dragon (docs/ART_BIBLE.md 3.4). Zone: the body mass. Cue: one faceted dome carapace
// over the back plus a heavy, low stance. The dome never changes (the cue is always 100 %); its crystals' glow is
// the mood gauge, and their count grows with the bond.
import { DRAGON_PALETTES, DRAGON_SHARED, moodTones } from '../palettes.ts';
import { TAIL_REST } from '../stages.ts';
import type { Stage } from '../stages.ts';
import { wingParams } from '../element.ts';
import type { ElementSpec, ElementDraw } from '../element.ts';
import type { DragonRig } from '../rig.ts';
import { backLineY, emitterFill, emitterCore, disc, mouthToRoot } from '../features.ts';
import { ACT, DFACE } from '../pose.ts';
import { bake, lag, neckFit } from '../anims.ts';
import type { Key } from '../anims.ts';
import type { DragonDims } from '../build.ts';
import { stepShrink } from '../fx.ts';
import { celTaper, outlinePath, tones } from '../../../lib/art/shading.ts';

const PAL = DRAGON_PALETTES.rock;
const BANKED = moodTones(PAL).banked;

/** Dome width x rise above the back and facet count; crystals as [position along the dome 0..1 (0 = rear), w, h]. */
const DOME: Readonly<Record<Stage, { w: number; rise: number; facets: number; crystals: readonly (readonly number[])[] }>> = {
  baby: { w: 12, rise: 5, facets: 1, crystals: [[0.3, 2, 3]] },
  young: { w: 22, rise: 9, facets: 3, crystals: [[0.18, 3, 5], [0.36, 3, 5]] },
  adult: { w: 34, rise: 11, facets: 5, crystals: [[0.14, 3, 5], [0.27, 4, 7], [0.4, 3, 5]] },
};

/** Nose horn per stage: length, root and tip radius (3.4). */
const NOSE: Readonly<Record<Stage, { len: number; r0: number; r1: number }>> = {
  baby: { len: 2, r0: 1.5, r1: 1.2 },
  young: { len: 4, r0: 2, r1: 1.5 },
  adult: { len: 5, r0: 3, r1: 1.5 },
};

const ARC_X = new Float32Array(12), ARC_Y = new Float32Array(12);
/** Facet tones, rear (lit) -> front: the dome is toned in thirds, lit rear facets, base top, shaded front (3.4). */
const TONE3: readonly (readonly number[])[] = [[0], [1, 0, -1], [], [1, 0, -1], [], [1, 1, 0, -1, -1]];

/**
 * The dome's top edge at u (-1 = rear end .. 1 = front end): the body's own back line lifted by a thickness that
 * is `rise` at the centre and tapers to 1.5 px at the ends, so the shell rests ON the back and slopes down with it
 * (an elliptical arc stands its ends vertical: a lampshade), a crown that stays convex over the straight run of the back.
 * `out` pushes the point a little further (the ridge vertex).
 */
function domePt(rig: DragonRig, cx: number, rx: number, rise: number, u: number, out: number, i: number): void {
  const x = cx + u * rx;
  ARC_X[i] = x; ARC_Y[i] = backLineY(rig, x) - 1.5 - (rise - 1.5 + out) * Math.pow(Math.max(0, 1 - u * u), 0.85);
}

/** y of the dome's top contour at x (on the polygon ARC[0..n]), for standing crystals on it. */
function domeTopY(x: number, n: number): number {
  for (let i = 0; i < n; i++) {
    const x0 = ARC_X[i], x1 = ARC_X[i + 1];
    if ((x - x0) * (x - x1) <= 0) return ARC_Y[i] + (ARC_Y[i + 1] - ARC_Y[i]) * ((x - x0) / ((x1 - x0) || 1));
  }
  return ARC_Y[0];
}

/**
 * FIRST PASS: bible 3.4 "The cue: the boulder dome". Body space, after the body; the near wing is drawn just before
 * this (wingUnderBodyOver) so the rim tucks it under. Still to do: the travelling glint, the crystal count from the
 * bond, the tucks (pose.tuck = 1 draws the head under the dome), the pebble crumb ambient.
 *
 * ONE convex arc (3.0), never teeth: the facet corners sit on a superellipse (p 2.6), bulged past the half-ellipse
 * so the outline reads as a dome, not a trapezoid, and an odd facet count gets a ridge vertex over its middle
 * facet so no flat lid runs across the top. Facets are tone steps with no line (form within one material): planes
 * radiating from a point under the dome, toned in thirds -- marking.hi on the lit rear facets, the base on top,
 * marking.sh on the front. The baby's single facet is a smooth pebble in one tone.
 */
const bodyOver: ElementDraw = (ctx, rig, pose, info) => {
  const D = DOME[info.stage];
  const cx = Math.round((rig.hipB.x + rig.chestB.x) / 2 - 1);
  const back = backLineY(rig, cx);
  const rim = back + D.rise * 0.55 + 2;
  const rx = D.w / 2 + 2, F = D.facets, pebble = F === 1;
  // corners at the facet boundaries (rear end -> front end), plus the ridge vertex over the middle facet
  let n = 0;
  const mid = F >> 1;
  const steps = pebble ? 8 : F;
  for (let f = 0; f <= steps; f++) {
    domePt(rig, cx, rx, D.rise, -1 + (2 * f) / steps, 0, n++);
    if (!pebble && f === mid) domePt(rig, cx, rx, D.rise, 0, 0.7, n++);
  }
  n--;
  ctx.beginPath();
  ctx.moveTo(ARC_X[0], ARC_Y[0]);
  for (let i = 1; i <= n; i++) ctx.lineTo(ARC_X[i], ARC_Y[i]);
  // the rim, front end -> rear end: 1 px under the back line at the ends, sagging over the flank to `rim` mid-body
  for (let k = 1; k <= 8; k++) {
    const u = 1 - k / 4, x = cx + u * rx;
    ctx.lineTo(x, backLineY(rig, x) + 1 + (rim - back - 1) * Math.sqrt(Math.max(0, 1 - u * u)));
  }
  ctx.closePath();
  outlinePath(ctx, rig);
  ctx.fillStyle = rig.col(info.pal.marking); ctx.fill();
  if (!rig.override && !pebble) {
    ctx.save(); ctx.clip();
    const t = tones(rig, info.pal.marking), tone = TONE3[F] || TONE3[3];
    // facet f spans corners [f, f + 1] (+1 past the ridge); its plane radiates from a point under the dome. A run
    // of facets in one tone is ONE plane: two planes meeting edge to edge left a faint anti-aliased seam of the
    // base between them
    const ox = cx, oy = rim + D.rise;
    for (let f = 0, i = 0; f < F; f++) {
      const i0 = i;
      let i1 = i + (f === mid ? 2 : 1);
      while (f + 1 < F && tone[f + 1] === tone[f]) { f++; i1 += f === mid ? 2 : 1; }
      i = i1;
      if (!tone[f]) continue;
      ctx.fillStyle = tone[f] > 0 ? t.hi : t.sh;
      ctx.beginPath(); ctx.moveTo(ox, oy);
      // reach past the outline so the clip trims the plane to it
      ctx.lineTo(ox + (ARC_X[i0] - ox) * 1.5, oy + (ARC_Y[i0] - oy) * 1.5);
      for (let k = i0; k <= i1; k++) ctx.lineTo(ARC_X[k] + (ARC_X[k] - ox) * 0.2, ARC_Y[k] + (ARC_Y[k] - oy) * 0.2);
      ctx.lineTo(ox + (ARC_X[i1] - ox) * 1.5, oy + (ARC_Y[i1] - oy) * 1.5);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  // crystals on the rear third: flat glow with ink, dim (banked) when sad, a glint when happy; the breath's tell
  // flashes them glow.hi for 4 f, twice (3.4). Flipped onto its back (the roll-over happy) they are pressed under
  // the shell against the floor: not drawn
  if (rig.tf.ss < 0) return;
  const m = info.mood, lit = m > -0.3 && !info.asleep;
  const tell = pose.act === ACT.breath && ((pose.cue >= -14 && pose.cue < -10) || (pose.cue >= -7 && pose.cue < -3));
  const col = tell ? tones(rig, info.pal.glow).hi : lit ? info.pal.glow : BANKED;
  for (let i = 0; i < D.crystals.length; i++) {
    const c = D.crystals[i];
    const x = Math.round(ARC_X[0] + (ARC_X[n] - ARC_X[0]) * c[0]);
    // stand on the arc at x
    const y = Math.round(domeTopY(x, n)) + 1;
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

/**
 * FIRST PASS: bible 3.4 table "Nose horn": one blunt horn on the snout, up and forward. Cranium space. Young and
 * adult root it on the snout's rounded top-front, 2-3 px back from the tip (on the snout's end circle, 60 deg up
 * from its front) and lean it 60 deg up in head space (about 50 deg in the world at the rest pitch): rooted AT the
 * tip beside the nostril and angled 35 deg, it read as a cigar or a pipe. That root clears the eye's largest box
 * (info.eye) by >= 2 px. The baby's button snout has no top to root on: its 2 x 3 nub sits on the tip, leaning
 * forward 35 deg (behind the tip it sat on the eye's ring). (The rig also clips nearHead off the eye box.)
 */
const nearHead: ElementDraw = (ctx, rig, pose, info) => {
  const N = NOSE[info.stage], s = rig.dims.head.snout;
  const baby = info.stage === 'baby', t = (baby ? 35 : 60) * Math.PI / 180;
  const x = s.x1 + s.r1 * (baby ? 0.55 : Math.cos(t)) - (baby ? 0 : 0.5), y = s.y1 - s.r1 * (baby ? 0.6 : Math.sin(t)) + (baby ? 0 : 1);
  const a = (baby ? 35 : 60) * Math.PI / 180;
  celTaper(ctx, rig, x, y, x + Math.cos(a) * N.len, y - Math.sin(a) * N.len, N.r0, N.r1, info.pal.horn);
};

/**
 * FIRST PASS: bible 3.4 "Signature: Gravel Roar". Mouth space for the dust, root space for the pebbles. The tell is
 * in bodyOver (the crystals flash). BLAST (cue >= 0): a cone of 5 dust puffs (young 3), opaque `scale`, r 3 -> 7 as
 * they travel 5 px apart, sinking 0.1 px/f, then shrinking away in 3 steps (never alpha: 5.4); 4 pebbles (young
 * 2), 3 x 3 `marking` with ink, ballistic (g 0.15), one bounce. BABY: "ptoo" -- one pebble drops out of the mouth
 * and rolls; the anim then shows `happy`, chin up (tuning.breath). Still to do: the 12 f root jitter.
 */
const breath: ElementDraw = (ctx, rig, pose, info) => {
  if (pose.act !== ACT.breath || pose.cue < 0 || rig.override) return;
  const c = pose.cue, st = info.stage, a = info.ang * Math.PI / 180;
  if (st !== 'baby') {
    const n = st === 'adult' ? 5 : 3, downx = Math.sin(a), downy = Math.cos(a);
    for (let k = n - 1; k >= 0; k--) {
      const age = c - 3 * k;
      if (age < 0 || age >= 24) continue;
      // the cone: each puff on its own ray, +-12 deg about the jaw line
      const spread = (k % 3 - 1) * 0.2, dist = 3 + age * 1.3;
      const r = stepShrink(Math.max(0, age - 12) / 18, Math.min(7, 3 + age * 0.25));
      disc(ctx, rig, Math.round(dist), Math.round(dist * spread + (downx * 0 + downy) * age * 0.1), r, info.pal.scale);
    }
  }
  const np = st === 'adult' ? 4 : st === 'young' ? 2 : 1;
  ctx.save();
  mouthToRoot(ctx, rig, info.ang);
  const J = rig.j;
  for (let k = 0; k < np; k++) {
    const t = c - 2 * k;
    if (t < 0 || t >= 40) continue;
    // out of the mouth along the jaw (the baby's just drops), one bounce on the floor, then it lies there
    const vx = st === 'baby' ? 0.3 : 1.2 + 0.35 * k, vy = st === 'baby' ? 0.2 : -0.9 + 0.3 * k, g = 0.15, floor = -2;
    const x0 = J.mouth.x, y0 = J.mouth.y;
    let x = x0 + vx * t, y = y0 + vy * t + g * t * t / 2;
    if (y > floor) {
      const tl = (-vy + Math.sqrt(vy * vy + 2 * g * (floor - y0))) / g, t1 = t - tl;
      const b = Math.max(0, 0.9 * t1 - g * t1 * t1 / 2);
      x = x0 + vx * tl + vx * 0.5 * Math.min(t1, 12); y = floor - b;
    }
    ctx.beginPath(); ctx.rect(Math.round(x) - 1.5, Math.round(y) - 1.5, 3, 3);
    outlinePath(ctx, rig);
    ctx.fillStyle = rig.col(info.pal.marking); ctx.fill();
  }
  ctx.restore();
};

/**
 * FIRST PASS: bible 3.4 "Idle fidget: it sunbathes flat with its eyes closed (120 f)": it settles until its belly
 * rests on the floor, lays its chin down (neckFit), shuts its eyes and basks -- the crystals lit (mood up), no "z":
 * it is awake -- then gets up.
 */
function fidget(stage: Stage, d: DragonDims | null): ReturnType<typeof bake> {
  const k = stage === 'adult' ? 1 : stage === 'young' ? 0.85 : 0.6, L = Math.round(120 * k), t = (f: number) => Math.round(f * k);
  const settle = d ? Math.max(0, d.bodyY - Math.max(d.hipR, d.chestR - 1, d.sag ? d.sag.cy + d.sag.ry : 0) - 1) : 6;
  const h = d && !d.neck.hidden ? neckFit(d, settle, 0, 4, -1.5, 'chin') : { a0: 12, a1: 0, head: 10 };
  return bake({
    'body.y': [[0, 0], [t(16), settle, 'inout'], [t(100), settle, 'inout'], [t(116), 0]],
    'neck.a0': [[0, 0], [t(18), h.a0, 'inout'], [t(100), h.a0, 'inout'], [t(114), 0]],
    'neck.a1': [[0, 0], [t(18), h.a1, 'inout'], [t(100), h.a1, 'inout'], [t(114), 0]],
    'head.rot': [[0, 0], [t(20), h.head, 'inout'], [t(100), h.head, 'inout'], [t(114), 0]],
    'legNH.slide': [[0, 0], [t(14), 3], [t(102), 3], [t(112), 0]], 'legFH.slide': [[0, 0], [t(14), 3], [t(102), 3], [t(112), 0]],
    'tail.stiff': [[0, 0], [t(16), 1], [t(100), 1], [L, 0]],
    face: [[0, DFACE.neutral], [t(18), DFACE.closed], [t(100), DFACE.neutral]],
    mood: [[0, 0], [t(20), 1], [t(100), 1], [L, 0]],
    act: [[0, ACT.fidget]], cue: [[0, 0], [L, L]],
  }, { stage, len: L, next: 'idle' });
}

/**
 * FIRST PASS: bible 4.3 "Rock happy": no preen -- a slow roll onto its back, belly up, and back (110 f at the adult,
 * so the 90 f roll fits; young x 0.85, baby x 0.6). It settles low (0-14) and tips back onto its rump (14-24); in a
 * side view the roll onto its back IS a vertical flip, so at f 24 it flips in one held frame (stretch -1, root.y
 * lifting the upturned shell onto the floor: the rig keeps the light top-left and stands its floor guards aside
 * while flipped) and settles on its shell (24-34); belly up it rocks, paws paddling in the air on 4 f beats with
 * the knees and elbows bent (straight legs up, eyes shut and the head hanging was the "dead bug" pictogram), the
 * tail wagging, the face `happy` the whole way through (faces.ts keeps the "^" upright on screen while flipped),
 * the jaw open at the stage minimum with the tongue out, and the chin tucked toward its belly so the face is seen
 * nearly level (34-76); it tips and flips back (76-84-94) and stands up happy. `mood` +1 throughout, so the
 * crystals glint. Still to do: a dust puff as the shell lands.
 */
function rollOver(stage: Stage, d: DragonDims | null): ReturnType<typeof bake> {
  const k = stage === 'adult' ? 1 : stage === 'young' ? 0.85 : 0.6, L = Math.round(110 * k), t = (f: number) => Math.round(f * k);
  const D = DOME[stage];
  const settle = d ? Math.max(0, d.bodyY - Math.max(d.hipR, d.chestR - 1, d.sag ? d.sag.cy + d.sag.ry : 0) - 2) : 6;
  // upside down, the dome's peak rests on the floor (bodyOver's geometry: the body's back line at the dome's centre,
  // lifted by the rise and the ridge vertex, plus half the ink); the crystals are pressed under the shell then
  let top = 30;
  if (d) {
    // features.ts backLineY with the dims alone: the highest of the hip ball's top, the chest ball's top and the
    // tangent between them, at the dome's centre x (-1); an odd facet count adds the 0.7 px ridge vertex
    const x = -1, hx = -d.gap / 2, cxb = d.gap / 2;
    const ball = (bx: number, by: number, r: number) => (Math.abs(x - bx) < r ? by - Math.sqrt(r * r - (x - bx) * (x - bx)) : 1e9);
    const tan = -d.hipR + (-1 - d.chestR + d.hipR) * ((x - hx) / (cxb - hx || 1));
    const back = Math.min(ball(hx, 0, d.hipR), ball(cxb, -1, d.chestR), tan);
    top = d.bodyY - settle - (back - D.rise - (D.facets > 1 ? 0.7 : 0)) + 0.5;
  }
  const f1 = t(24), f2 = t(84);
  // the paddle: +-40 deg on 4 f beats (a +-25 swing on 6 f read as legs held up stiff), far legs a beat behind, so
  // the four paws visibly alternate; the knees and elbows bend (lower) so the paws flop like a pet's, not a bug's
  const pad: Key[] = [[0, 0], [t(30), 0]], rock: Key[] = [[0, 0], [t(14), 0, 'inout'], [f1 - 1, -25], [f1, 25, 'out'], [t(34), 0]];
  for (let f = 34, s = 1; f < 74; f += 4, s = -s) pad.push([t(f), 40 * s]);
  pad.push([t(76), 0]);
  // (the front paddle swings about a base 25 deg forward: about 0 its back stroke laid the forearm flat on the belly)
  const padF = pad.map((k, i) => (i > 1 && i < pad.length - 1 ? [k[0], k[1] + 25] as const : k));
  const fold = (v: number): Key[] => [[0, 0], [f1 - 1, 0], [f1, v], [t(76), v], [f2 - 1, 0]];
  for (let f = 36; f < 72; f += 12) rock.push([t(f), 4], [t(f + 6), -4]);
  rock.push([t(76), 0, 'inout'], [f2 - 1, 25], [f2, -25, 'out'], [t(94), 0]);
  const plant: Key[] = [[0, 1], [t(12), 1], [t(16), 0], [t(94), 0], [t(100), 1]];
  // on its back it tucks its chin toward its belly (up, on screen): hanging off the shoulders the head pointed
  // snout-down with its face upside down; tucked, the face is seen nearly level. The baby's head rides higher
  // than its pebble, so it tucks further (lifted off the floor, peeking at its own paws)
  const tuck = stage === 'baby' ? 24 : 22, chin: Key[] = [[0, 0], [f1 - 1, 0], [f1, tuck], [f2 - 1, tuck], [f2, 0]];
  // the jaw at the stage minimum (1.2) with the tongue out while it is belly up: a happy "blep"
  const jmin = d ? d.head.jawMin : 20, jaw: Key[] = [[0, 0], [t(30), 0], [t(32), jmin], [t(76), jmin], [t(78), 0]];
  const anim = bake({
    'body.y': [[0, 0], [t(12), settle, 'inout'], [t(96), settle, 'inout'], [t(106), 0]],
    stretch: [[0, 1], [f1 - 1, 1], [f1, -1], [f2 - 1, -1], [f2, 1]],
    'root.y': [[0, 0], [f1 - 1, 0], [f1, top], [f2 - 1, top], [f2, 0]],
    'root.rot': rock,
    'neck.a0': chin, 'head.rot': chin, jaw,
    'legNH.plant': plant, 'legNF.plant': plant, 'legFH.plant': plant, 'legFF.plant': plant,
    'legNH.upper': pad, 'legNF.upper': lag(padF, 4), 'legFH.upper': lag(pad, 4), 'legFF.upper': padF,
    'legNH.lower': fold(40), 'legFH.lower': fold(40), 'legNF.lower': fold(-40), 'legFF.lower': fold(-40),
    'tail.stiff': [[0, 0], [t(10), 1], [t(96), 1], [L, 0]],
    'tail.sway': [[0, 0], [t(34), 0], [t(40), 20], [t(46), -20], [t(52), 20], [t(58), -20], [t(64), 20], [t(70), -20], [t(76), 0]],
    face: [[0, DFACE.neutral], [t(6), DFACE.happy], [t(106), DFACE.neutral]],
    mood: [[0, 0], [t(6), 2], [t(100), 2], [L, 0]],
    act: [[0, ACT.happy]], cue: [[0, -t(14)], [L, L - t(14)]],
  }, { stage, len: L, next: 'idle' });
  // the flips are cuts, not tweens: the frame before each holds its pose, so no in-between squashes the sprite flat
  const fr = anim.frames;
  for (let i = 0; i + 1 < fr.length; i++) {
    const a = fr[i].pose?.stretch ?? 1, b = fr[i + 1].pose?.stretch ?? 1;
    if (a * b < 0) fr[i].interp = false;
  }
  return anim;
}

export const ROCK: ElementSpec = {
  id: 'rock',
  name: 'Cobble',
  blurb: 'Calm, sleepy, stubborn and patient: the easiest baby to raise. Crystals grow on its dome with its bond.',
  palette: PAL,
  modifiers: {
    // head low (3.4: carried below the dome top): the short neck runs out nearly level from low on the chest
    bodyLength: 1.1, bodyDepth: 1.2, legLength: 0.75, legR: 1.2, neckLength: 0.7, neckAngle: -40, neckDrop: 4, tailLength: 0.7, tailR: 1.2,
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
  render: { bodyOver, nearHead, breath },
  wingUnderBodyOver: true,
  anims: {
    // FIRST PASS: bible 4.3 "Rock": the heavy 60 f walk cycle on short legs (a slow 0.3 px/f: the stride has to fit
    // 7-8 px legs), the sleep TUCK (the head resting on the floor outside the rim, drawn last) with its 240 f
    // breath, the gravel roar's 25 deg jaw and the baby's proud "ptoo", the 110 f roll-over happy (rollOver), the
    // sunbathe fidget (fidget). Still to do: dust puffs at every other hind contact (walk cue), the pebble-staring
    // hungry tell, the upset tuck.
    fidget,
    // the roll onto its back replaces the preen and the hops (4.3)
    overrides: (st, d) => ({ happy: rollOver(st, d) }),
    tuning: (st) => ({
      walk: { cycle: st === 'adult' ? 60 : st === 'young' ? 50 : 30, speed: st === 'adult' ? 0.3 : st === 'young' ? 0.32 : 0.2 },
      // the SLEEP tuck (3.4) rests the head on the ground OUTSIDE the rim, so it draws in the normal order (the head
      // last); tuck 1, the head under the dome, is the upset tuck's
      sleep: { tuck: st === 'baby' ? 2 : 0, nubFold: 0, breath: st === 'adult' ? 240 : st === 'young' ? 200 : 160 },
      breath: { jaw: st === 'adult' ? 25 : st === 'young' ? 22 : 20, fizzleFace: 'happy', fizzleChin: -6 },
    }),
  },
};
