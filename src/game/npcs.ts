// The road's people who are not keepers (plan S9a; S9 draws them at their stop): THE GRUMPY MILLER, met at the mill on a
// `miller` stop, grumpy until CHARM's moment and then talked round. He is drawn on the keepers' own rig (the engine's
// humanoid through src/art/keeper: the same 1 px ink, cel bands, skull, hands and shoes), but he is NOT a keeper: he is
// not in KEEPER_IDS (which drives the four keepers everywhere), has no job and no agent, and only this file draws him.
//
// Who he is, at a glance: an older, stocky man -- never frail: no stoop, no cane, no tremor (the elders' rule) -- in a
// flat miller's cap, bushy grey brows and a grey moustache, a flour-dusted apron over a wheat shirt with its sleeves
// rolled, and his flour sack at his feet. At a third of his size the flat wide cap, the barrel of a body and the sack
// tell him from Bea (a bun), Tomas (a wide brim), Iris (a floppy cap) and Pip (tufts).
//
//   grumpy       READS GRUMPY AT 1X, within the no-V-brow rule: heavy flat brows pulled low onto narrowed eyes, a
//                clear pout (the lower lip pushed out under the moustache, its corners down), arms folded high across
//                his chest, chin tucked, turned away from the one he is talking to, and a small flat "hmph" puff from
//                his nose every so often;
//   talkedRound  brows up, a small smile lifting the moustache's ends, eyes creased happy, turned to face them, tipping
//                his cap with his near hand.
// Nobody is angry and nobody is hurt: grumpy is a mood, and it is talked round.
import { buildRig, jointScreen } from '../lib/art/rig.ts';
import { makePose } from '../lib/art/poses.ts';
import type { Pose } from '../lib/art/poses.ts';
import type { Rig, FullPose } from '../lib/art/rig.ts';
import type { Info } from '../lib/art/rigParts.ts';
import { celPath, celPoly, celRect, makeTones } from '../lib/art/shading.ts';
import { farPalette } from '../lib/art/palettes.ts';
import { keeperParts } from '../art/keeper/parts.ts';
import { drawKeeper } from '../art/keeper/rig.ts';
import type { KeeperRig, KeeperBuild } from '../art/keeper/rig.ts';
import { KEEPER_SHARED, KEEPER_FAR } from '../art/keeper/palettes.ts';
import type { KeeperPalette } from '../art/keeper/palettes.ts';
import type { KeeperSpec } from '../art/keeper/cast.ts';
import { resolveKPose, propsOf } from '../art/keeper/anims.ts';
import type { KPose } from '../art/keeper/anims.ts';
import { hipYOf } from '../art/keeper/ik.ts';
import { INK } from './surfaces.ts';
import { celTarget } from './cel.ts';
import type { MillerState } from './missiondata.ts';

/**
 * The miller's colours, in the keepers' slots (tools/palette-check.ts runs the keeper gates on them: the ladder between
 * the colours that touch, the ramps, the far side, the shoes and trousers on every floor, and his shirt told apart from
 * the four keepers' tops). `tool` is his flour sack, `trim` its tie and the flour dust.
 */
export const MILLER_PALETTE: Readonly<KeeperPalette> = Object.freeze({
  skin: '#e2a47e', hair: '#cfd0d4', primary: '#a8804a', secondary: '#6a5448', accent: '#6a4a2a',
  metal: '#c8c4bc', dark: '#4a3a32', glow: '#e8707a', apron: '#f6f1e6', hat: '#8a7866', tool: '#b89a6a', trim: '#fbf7ee',
});
/** His skin's hand-set warm shadow (the keepers' KEEPER_SKIN_SHADOW rule). */
export const MILLER_SKIN_SHADOW = '#b87050';

/**
 * His build on the engine's humanoid (DEFAULT_PROPORTIONS with a stocky, older man's changes: a broad barrel of a body,
 * shorter legs, thick arms), in the keepers' spec shape so the keeper parts read him as they read a keeper. His id is
 * his own ('miller'), never a KeeperId.
 */
export const MILLER_SPEC: Readonly<Omit<KeeperSpec, 'id'> & { id: 'miller' }> = Object.freeze({
  id: 'miller', name: 'The miller', title: 'the grumpy miller', job: 'help', age: 'elder',
  proportions: { torsoW: 27, torsoH: 25, hip: 22, upperLeg: 12, lowerLeg: 12, upperArm: 12, lowerArm: 11, legR: 6, armR: 5.5, handR: 4.5 },
  hair: 'cropped', hat: null, beard: true, apron: true, sleeves: 'short', over: null, tool: null,
  tempo: 1.2, speed: 0.5, stride: 24,
});
const SPEC = MILLER_SPEC as unknown as KeeperSpec;
const PAL = MILLER_PALETTE;
const R = Math.round;

/** The rig's own extra state: the state drawn (the parts read it) and the cap's tip (0..1). */
interface MillerRig extends KeeperRig { state: MillerState; tip: number }
const M = (rig: Rig): MillerRig => rig as MillerRig;

// ---------- the parts ----------

/**
 * His face (head space, facing +x; the keepers' eye construction: the near eye at +0.45 r, the far one at -0.12 r).
 * Grumpy: the whites narrowed to 2 rows under heavy 3 px FLAT brows sitting right on them (no gap, no tilt: never a V),
 * the pupils level, and under the moustache a pout: the lower lip a 3 x 2 bump pushed out, the mouth's corners down.
 * Talked round: the eyes creased shut in two happy "^"s, the brows lifted two rows, a smile at the moustache's ends.
 */
function drawMillerFace(ctx: CanvasRenderingContext2D, rig: Rig, _pose: Pose, info: Info): void {
  const k = M(rig), r = info.r, grumpy = k.state === 'grumpy';
  const ink = k.col(k.outline), white = k.col(KEEPER_SHARED.white), pupil = k.col(KEEPER_SHARED.pupil), brow = k.col(PAL.hair);
  const ey = R(-r * 0.15), ex = R(r * 0.45), fx = R(-r * 0.12);
  if (grumpy) {
    // narrowed eyes: two rows of white, the pupils in them
    ctx.fillStyle = white; ctx.fillRect(ex - 1, ey, 5, 2); ctx.fillRect(fx - 1, ey, 4, 2);
    ctx.fillStyle = pupil; ctx.fillRect(ex + 1, ey, 3, 2); ctx.fillRect(fx, ey, 2, 2);
    // the heavy flat brows pulled right down onto them (their ink line under them is the lid), bushy past the eye
    ctx.fillStyle = ink; ctx.fillRect(ex - 3, ey - 4, 9, 5); ctx.fillRect(fx - 2, ey - 4, 6, 5);
    ctx.fillStyle = brow; ctx.fillRect(ex - 2, ey - 3, 7, 3); ctx.fillRect(fx - 1, ey - 3, 4, 3);
  } else {
    // happy creased eyes ("^", 2 px), the brows lifted clear above them, still bushy
    ctx.fillStyle = ink;
    ctx.fillRect(ex - 1, ey, 1, 2); ctx.fillRect(ex, ey - 1, 3, 2); ctx.fillRect(ex + 3, ey, 1, 2);
    ctx.fillRect(fx - 1, ey, 1, 2); ctx.fillRect(fx, ey - 1, 2, 2);
    ctx.fillRect(ex - 3, ey - 7, 9, 4); ctx.fillRect(fx - 2, ey - 7, 6, 4);
    ctx.fillStyle = brow; ctx.fillRect(ex - 2, ey - 6, 7, 2); ctx.fillRect(fx - 1, ey - 6, 4, 2);
    ctx.fillStyle = k.col(PAL.glow); ctx.fillRect(ex, ey + 3, 3, 2);
  }
}

/** His hair: grey, cropped round the back and sides under the cap (the cap covers the top). */
function drawMillerHair(ctx: CanvasRenderingContext2D, rig: Rig, _pose: Pose, info: Info): void {
  const k = M(rig), r = info.r;
  ctx.beginPath();
  ctx.moveTo(-r * 0.2, -r * 0.62); ctx.lineTo(-r * 1.06, -r * 0.5); ctx.lineTo(-r * 1.08, r * 0.3); ctx.lineTo(-r * 0.78, r * 0.52);
  ctx.lineTo(-r * 0.5, r * 0.2); ctx.lineTo(-r * 0.46, -r * 0.2); ctx.closePath();
  celPath(ctx, k, info.color, -r * 0.6, -r * 0.1, r * 0.8, 0.4, 0);
}

/**
 * His moustache (after the face): a bushy grey one over the upper lip, its ends drooping (grumpy) or lifted (a smile),
 * and under it the mouth: grumpy, a pout -- the lower lip pushed out, the corners pulled down.
 */
function drawMillerMoustache(ctx: CanvasRenderingContext2D, rig: Rig, _pose: Pose, info: Info): void {
  const k = M(rig), r = info.r, grumpy = k.state === 'grumpy';
  const mx = R(r * 0.45), my = R(r * 0.5) + 1;
  // the mouth first, under the moustache
  if (grumpy) {
    ctx.fillStyle = k.col(INK); ctx.fillRect(mx - 1, my + 2, 5, 3);
    ctx.fillStyle = k.col('#b8605a'); ctx.fillRect(mx, my + 2, 3, 2);
    ctx.fillStyle = k.col(INK); ctx.fillRect(mx - 2, my + 3, 1, 2); ctx.fillRect(mx + 4, my + 3, 1, 2);
  } else {
    ctx.fillStyle = k.col(INK); ctx.fillRect(mx - 1, my + 2, 5, 1); ctx.fillRect(mx + 4, my + 1, 1, 1);
  }
  const d = grumpy ? 2 : -1;
  ctx.beginPath();
  ctx.moveTo(r * 0.02, my - 2); ctx.lineTo(r * 0.95, my - 3); ctx.lineTo(r * 1.08, my - 1);
  ctx.lineTo(r * 0.9, my + 1 + d); ctx.lineTo(r * 0.55, my + 1); ctx.lineTo(r * 0.12, my + 1); ctx.lineTo(-r * 0.12, my + 2 + d);
  ctx.closePath();
  celPath(ctx, k, PAL.hair, r * 0.45, my, r * 0.6, 0.4, 0);
}

/**
 * The flat miller's cap (head space): a wide, flat cloth crown sitting low over the brow, a short stiff brim at the
 * front, flour dust on it. Tipped (`tip`), it lifts off the brow a few px and tilts back, the near hand at its brim.
 */
function drawMillerCap(ctx: CanvasRenderingContext2D, rig: Rig, _pose: Pose, info: Info): void {
  const k = M(rig), r = info.r;
  ctx.save();
  if (k.tip > 0) { ctx.translate(-r * 0.2, -r * 0.6); ctx.rotate(-0.28 * k.tip); ctx.translate(r * 0.2, r * 0.6 - 3 * k.tip); }
  ctx.beginPath();
  ctx.moveTo(-r * 1.14, -r * 0.46); ctx.lineTo(-r * 1.2, -r * 0.92); ctx.quadraticCurveTo(-r * 1.1, -r * 1.22, -r * 0.4, -r * 1.2);
  ctx.lineTo(r * 0.8, -r * 1.16); ctx.quadraticCurveTo(r * 1.1, -r * 1.1, r * 1.04, -r * 0.7); ctx.lineTo(r * 1.62, -r * 0.62);
  ctx.lineTo(r * 1.6, -r * 0.46); ctx.lineTo(r * 0.7, -r * 0.46);
  ctx.closePath();
  celPath(ctx, k, PAL.hat!, 0, -r * 0.85, r * 1.2, 0.34, 0.3);
  if (!k.override) {
    // the brim's seam and the flour on the crown (2 px pale dust)
    ctx.fillStyle = k.col(INK); ctx.fillRect(R(r * 0.7), R(-r * 0.66), R(r * 0.9), 1);
    ctx.fillStyle = k.col(PAL.trim!); ctx.fillRect(R(-r * 0.6), R(-r * 1.08), 2, 2); ctx.fillRect(R(r * 0.3), R(-r * 1.02), 2, 2);
  }
  ctx.restore();
}

/**
 * His top (torso space: the hip centre at the origin, y up negative, the front at +x): a barrel-shaped wheat shirt, the
 * flour-dusted apron's bib over its front, and -- grumpy, arms folded -- the far forearm across his chest under the
 * near one (the far arm's own segments hang behind the body, the engine's draw order).
 */
function drawMillerTorso(ctx: CanvasRenderingContext2D, rig: Rig, _pose: Pose, info: Info): void {
  const k = M(rig), W = info.w ?? 27, H = info.h ?? 25;
  const hw = R(W / 2), hh = R((k.p.hip / 2) * 0.92), mid = R(-H * 0.5);
  celPoly(ctx, k, [-hw - 1, -H + 6, -hw + 4, -H, hw - 4, -H, hw + 1, -H + 6, hw + 2, mid, hh + 1, 2, -hh - 1, 2, -hw - 1, mid], PAL.primary, 0.36, 0.28);
  if (k.override) return;
  celPoly(ctx, k, [0, -H + 6, hw + 2, -H + 6, hw + 2, mid, hh + 1, 2, 0, 2], PAL.apron!, 0.3, 0);
  ctx.fillStyle = k.col(PAL.trim!); ctx.fillRect(4, -H + 12, 2, 2); ctx.fillRect(hw - 4, mid + 4, 2, 2); ctx.fillRect(6, -6, 2, 2);
  if (k.state === 'grumpy') {
    // the far forearm across the chest, rolled sleeve (skin), in the far shade: under the near one
    const far = farPalette({ skin: PAL.skin }, KEEPER_FAR.shade, KEEPER_FAR.desat) as { skin: string };
    celRect(ctx, k, -hw + 2, -H + 9, hw + 8, 8, 4, far.skin, 0.3, 0);
  }
}

/** His hips (hip space): the trousers' block, and the apron's skirt over the front to his knees. */
function drawMillerHips(ctx: CanvasRenderingContext2D, rig: Rig, _pose: Pose, info: Info): void {
  const k = M(rig), hip = info.w ?? 22, hw = R(hip / 2);
  celRect(ctx, k, -hw, -5, hip, 10, 3, PAL.secondary, 0.4, 0.2);
  if (k.override) return;
  const J = k.joints, y0 = J.hipN.y, hem = Math.max(J.kneeN.y, J.kneeF.y) - y0 - 1, front = Math.max(J.kneeN.x, J.kneeF.x, hw) + 3;
  celPoly(ctx, k, [0, -9, hw + 2, -9, front, hem, 0, hem], PAL.apron!, 0.3, 0);
  ctx.fillStyle = k.col(PAL.trim!); ctx.fillRect(hw - 2, R(hem * 0.5), 2, 2);
}

// ---------- building and drawing him ----------

let RIG: MillerRig | null = null;
/** His rig, built once (a KeeperRig on the engine's humanoid, the keeper parts with his own face, hair, cap, top and hips). */
function millerRig(): MillerRig {
  if (RIG) return RIG;
  const parts = { ...keeperParts('short'), face: drawMillerFace, hair: drawMillerHair, beard: drawMillerMoustache, hat: drawMillerCap, torso: drawMillerTorso, hips: drawMillerHips };
  const build: KeeperBuild = {
    keeper: SPEC, proportions: SPEC.proportions, basePalette: { ...PAL }, scale: 1,
    farShade: KEEPER_FAR.shade, farDesat: KEEPER_FAR.desat, outline: KEEPER_SHARED.outline,
    parts, weapon: null, accessories: [], face: { big: false },
  };
  const k = buildRig(build) as MillerRig;
  k.spec = SPEC; k.kpal = PAL; k.blink = 0; k.bowl = null; k.open = false; k.state = 'grumpy'; k.tip = 0;
  k.tones.set(PAL.skin, { ...makeTones(PAL.skin, k.ramp), sh: MILLER_SKIN_SHADOW });
  RIG = k;
  return k;
}

/** The pose for a state at step t: a slow breath (a px up and down, stepped), the arms and head as the state has them. */
function millerPose(state: MillerState, t: number): FullPose {
  const p = propsOf(SPEC), breath = Math.floor(t / 40) % 3 === 1 ? -1 : 0, hy = hipYOf(p);
  const kp: KPose = { torsoY: breath, footN: { x: 2, lift: 0, tilt: 0 }, footF: { x: -2, lift: 0, tilt: 0 }, face: 0 };
  if (state === 'grumpy') {
    // arms folded high: the near elbow out front, its forearm across the chest under the chin; chin tucked, leaning back
    kp.torso = -4; kp.head = 10;
    kp.armN = [28, -118]; kp.armF = [10, 10];
  } else {
    // tipping the cap: the near hand up at its brim, the far arm easy at his side, the chin up
    kp.torso = 2; kp.head = -6;
    // (with the FAR hand, drawn behind his head, lifting the cap by its crown: an arm raised on the near side crossed his
    // face in profile, whatever the elbow did; his near hand rests easy at his side)
    kp.reachF = { x: -2, y: Math.round(hy - p.torsoH - p.neck - p.headR * 2.45) + breath };
    kp.armN = [12, 18];
  }
  const partial = resolveKPose(p, kp);
  const pose = makePose(partial) as FullPose;
  Object.defineProperty(pose, '__full', { value: true, enumerable: false });
  return pose;
}

/**
 * Draw the grumpy miller standing on the road at (x, feetY) (the floor point between his feet, screen px), his flour
 * sack at his feet. `facing` is the side he talks to (the team): grumpy, he turns his back half to it (drawn facing
 * away), arms folded; talked round, he faces it and tips his cap. `t` is the scene's step (his breath, the "hmph" puff).
 * `silhouette`: every part flat in that colour (the gallery's silhouette sheet).
 */
export function drawMiller(ctx: CanvasRenderingContext2D, x: number, feetY: number, facing: 1 | -1, state: MillerState, t: number, silhouette: string | null = null): void {
  const k = millerRig(), grumpy = state === 'grumpy';
  k.state = state; k.tip = grumpy ? 0 : 1;
  const f = (grumpy ? -facing : facing) as 1 | -1;
  // his flour sack, behind his heels (the side he faces away from)
  drawSack(ctx, R(x) - f * 18, R(feetY), silhouette);
  drawKeeper(ctx, k, millerPose(state, t), { x, y: feetY, facing: f, shadow: !silhouette, silhouette });
  if (!grumpy) {
    // the far hand on the cap's crown, lifting it (drawn over the cap: behind his head it was lost)
    const h = jointScreen(k, 'handF', { x: 0, y: 0 }), c = celTarget(f, silhouette);
    celRect(ctx, c, R(h.x) - 4, R(h.y) - 3, 9, 7, 3, PAL.skin, 0.3, 0);
  }
  if (grumpy && !silhouette && Math.floor(t / 45) % 4 === 1) {
    // "hmph": a small flat puff out of his nose, level, in front of his face (two inked discs, flat)
    const hx = R(x) + f * 17, hy = R(feetY) - 56;
    for (const [dx, r] of [[0, 3], [f * 5, 4]] as const) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(hx + dx, hy, r + 1, 0, Math.PI * 2); ctx.fill(); }
    for (const [dx, r] of [[0, 3], [f * 5, 4]] as const) { ctx.fillStyle = PAL.trim!; ctx.beginPath(); ctx.arc(hx + dx, hy, r, 0, Math.PI * 2); ctx.fill(); }
  }
}

/** The flour sack standing at his feet (a separate prop, inked): a plump sack, its neck tied, a dusting of flour. */
function drawSack(ctx: CanvasRenderingContext2D, x: number, feetY: number, silhouette: string | null): void {
  const c = { tones: new Map(), ramp: millerRig().ramp, override: silhouette, shading: true, light: { x: -0.7071, y: -0.7071 }, outline: silhouette ?? INK, ow: 1, contactAlpha: 0, tonesN: 3, col(h: string) { return silhouette ?? h; } };
  celPoly(ctx, c, [x - 8, feetY, x - 9, feetY - 10, x - 6, feetY - 18, x - 3, feetY - 20, x + 3, feetY - 20, x + 6, feetY - 18, x + 9, feetY - 10, x + 8, feetY], PAL.tool!, 0.34, 0.3);
  celPoly(ctx, c, [x - 3, feetY - 20, x - 4, feetY - 25, x + 4, feetY - 25, x + 3, feetY - 20], PAL.tool!, 0.3, 0);
  if (silhouette) return;
  ctx.fillStyle = INK; ctx.fillRect(x - 4, feetY - 22, 8, 2);
  ctx.fillStyle = PAL.accent; ctx.fillRect(x - 3, feetY - 22, 6, 1);
  ctx.fillStyle = PAL.trim!; ctx.fillRect(x - 3, feetY - 12, 2, 2); ctx.fillRect(x + 2, feetY - 7, 2, 2);
}
