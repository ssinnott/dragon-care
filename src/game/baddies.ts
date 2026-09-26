// The three big baddies (plan S9, P14; S9a builds the art, S9 the beat): THE MOLE KING of Old Mine Road, THE STORM ROC of
// Highfold and THE FROST GIANT of Frostmere, each 96-140 px, drawn in the house style from the engine's cel helpers
// (cel.ts: a 1 px #1a1018 ink, flat bands lit from the top left, no gradients, no alpha, no mark under 2 px).
//
// Cozy (D4): a baddie is calmed, outwitted or driven off -- never fought, never hurt. The types say so: a Baddie has no
// hurt, health or defeat field (the compile-time _NoHurt below), its exit is one of exactly three (_Exits), and its face
// one of four (BaddieFace: neutral, grumpy, surprised, sleepy -- no angry face exists; grumpy is a heavy FLAT brow pulled
// low onto the eye and a pout, never a V). Its poses: walk, stand, sit, turn (looking back over its shoulder) and leave
// (a shuffle, a puff of 2 px dust at its heels). The exits' looks (BADDIE_EXIT_LOOK, exitLook):
//   calmed     it sits down and dozes, three 3 x 3 stepped "z"s rising (sleepy)
//   outwitted  it turns, surprised, and wanders off the wrong way (neutral)
//   drivenOff  it shuffles off to colder hills, grumbling, 2 px dust puffs behind it (grumpy)
// No knockback, no hurt pose, nothing flung. Nothing is drawn over an eye (the spectacles ring it; they never cover it).
//
// Gate (x) (tools/palette-check.ts): each fill on a baddie's silhouette edge (BADDIE_EDGE) keeps >= 25 % luminance from
// the mission road (FLOORS.road) and from every band of its home climate at every phase, and >= 6 Oklab L from the ink;
// the colours that touch inside it pass the house ladder.
import { celPath, celPoly, celBall, celRect, celCapsule, celTaper } from '../lib/art/shading.ts';
import { drawText } from '../lib/engine/text.ts';
import { INK } from './surfaces.ts';
import { celTarget } from './cel.ts';
import type { Cel } from './cel.ts';
import type { BaddieId, BaddieExit, BaddieFace, BaddiePose, Climate } from './missiondata.ts';

export type { BaddieId, BaddieExit, BaddieFace, BaddiePose } from './missiondata.ts';

/** A baddie's art record: who, its size (px, the drawing's bounding box), its colours, and how it leaves the road. */
export interface Baddie { id: BaddieId; name: string; w: number; h: number; palette: Readonly<Record<string, string>>; exit: BaddieExit }
type Assert<T extends true> = T;
// (no hurt, health, defeat or damage state can exist on a baddie; and its exits are exactly the three cozy ones)
export type _NoHurt = Assert<Extract<keyof Baddie, 'hurt' | 'hp' | 'health' | 'defeated' | 'damage'> extends never ? true : false>;
export type _Exits = Assert<[BaddieExit] extends ['calmed' | 'outwitted' | 'drivenOff'] ? (['calmed' | 'outwitted' | 'drivenOff'] extends [BaddieExit] ? true : false) : false>;

/** The shared face colours: the eye whites and pupils (the keepers' and dragons' own). */
const WHITE = '#f8f4ec', PUPIL = '#1a1418';

export const BADDIE_ART: Readonly<Record<BaddieId, Baddie>> = Object.freeze({
  moleking: Object.freeze({
    id: 'moleking', name: 'THE MOLE KING', w: 112, h: 88, exit: 'calmed',
    palette: Object.freeze({ velvet: '#5e4238', belly: '#8a6a58', paw: '#e8969c', crown: '#d8a838', jewel: '#b0304a', rim: '#d8a838' }),
  }),
  stormroc: Object.freeze({
    id: 'stormroc', name: 'THE STORM ROC', w: 140, h: 100, exit: 'outwitted',
    palette: Object.freeze({ body: '#4a5a7a', wing: '#34405c', fluff: '#9aa6c4', beak: '#e8a848', leg: '#e8a848' }),
  }),
  frostgiant: Object.freeze({
    id: 'frostgiant', name: 'THE FROST GIANT', w: 96, h: 140, exit: 'drivenOff',
    palette: Object.freeze({ wool: '#98a8c4', face: '#d8a4a0', scarf: '#a8323a', stripe: '#d89a48', nose: '#b83040', boot: '#503a34' }),
  }),
});

/** Where each baddie lives (plan S8's regions: Old Mine Road is caves, Highfold peaks, Frostmere ice): its backdrop for gate (x). */
export const BADDIE_HOME: Readonly<Record<BaddieId, Climate>> = Object.freeze({ moleking: 'caves', stormroc: 'peaks', frostgiant: 'ice' });
/** The palette keys on each baddie's silhouette edge (seen against the road and its climate: gate x); the rest lie inside it. */
export const BADDIE_EDGE: Readonly<Record<BaddieId, readonly string[]>> = Object.freeze({
  moleking: ['velvet', 'paw', 'crown'],
  stormroc: ['body', 'wing', 'fluff', 'beak', 'leg'],
  frostgiant: ['wool', 'face', 'scarf', 'stripe', 'nose', 'boot'],
});
/** The pairs of colours that touch inside each baddie (the house ladder, gate x), with where. */
export const BADDIE_PAIRS: Readonly<Record<BaddieId, readonly (readonly [string, string, string])[]>> = Object.freeze({
  moleking: [['velvet', 'belly', 'the belly on the body'], ['velvet', 'paw', 'the paws and snout on the body'], ['belly', 'paw', 'the paws over the belly'],
    ['velvet', 'crown', 'the crown on the head'], ['crown', 'jewel', 'the jewel on the crown'], ['velvet', 'rim', 'the spectacles on the face'], ['velvet', 'white', 'the eye on the face']],
  stormroc: [['body', 'wing', 'the folded wing on the body'], ['body', 'fluff', 'the breast fluff on the body'], ['body', 'beak', 'the beak on the head'],
    ['wing', 'fluff', 'the wing over the fluff'], ['body', 'white', 'the eye on the face'], ['fluff', 'leg', 'the legs under the fluff']],
  frostgiant: [['wool', 'face', 'the face in the wool'], ['wool', 'scarf', 'the scarf on the wool'], ['scarf', 'stripe', 'the knitted stripes'],
    ['face', 'nose', 'the nose on the face'], ['wool', 'boot', 'the boots under the wool'], ['face', 'white', 'the eye on the face'], ['wool', 'scarf', 'the mittens on the arms']],
});
/** The eye whites, for the pairs above. */
export const BADDIE_WHITE = WHITE;

/** The look a baddie ends each exit in (the sheet's cells; exitLook gives the whole exit). Facing: -1 faces the team (it comes in from the right). */
export const BADDIE_EXIT_LOOK: Readonly<Record<BaddieExit, { pose: BaddiePose; face: BaddieFace; facing: 1 | -1 }>> = Object.freeze({
  calmed: Object.freeze({ pose: 'sit', face: 'sleepy', facing: -1 }),
  outwitted: Object.freeze({ pose: 'turn', face: 'surprised', facing: -1 }),
  drivenOff: Object.freeze({ pose: 'leave', face: 'grumpy', facing: 1 }),
});

/**
 * An exit played through, u 0..1 of its part of the beat (S9: the last 40 % of the baddie stop): the pose, face and
 * facing, and how far (px, + to the right) the baddie has gone from where it stood. Calmed: it sits at once and dozes
 * where it is. Outwitted: it turns, surprised, for the first third, then wanders off the wrong way (right), neutral.
 * Driven off: it shuffles off right at once, grumbling.
 */
export function exitLook(exit: BaddieExit, u: number): { pose: BaddiePose; face: BaddieFace; facing: 1 | -1; dx: number } {
  const v = Math.max(0, Math.min(1, u));
  if (exit === 'calmed') return { pose: v < 0.15 ? 'stand' : 'sit', face: v < 0.15 ? 'neutral' : 'sleepy', facing: -1, dx: 0 };
  if (exit === 'outwitted') return v < 0.35 ? { pose: 'turn', face: 'surprised', facing: -1, dx: 0 } : { pose: 'walk', face: 'neutral', facing: 1, dx: Math.round((v - 0.35) * 320) };
  return { pose: 'leave', face: 'grumpy', facing: 1, dx: Math.round(v * 260) };
}

const R = Math.round;

// ---------- the face ----------

/** Where a face sits (the head's own space, facing +x): the eye's middle, its radius, the brow's width, the mouth's middle. */
interface FaceAt { ex: number; ey: number; er: number; bw: number; mx: number; my: number }

/**
 * A face, facing +x: an eye (white, a pupil looking ahead), a brow in `brow`, a mouth. neutral: a level brow, a small
 * level mouth. grumpy: a heavy FLAT brow pulled down onto the eye (the eye narrowed under it: its top third lidded in
 * the body colour), a pout (a short mouth, its corners down a px, the lower lip pushed out). surprised: the brow raised,
 * the eye round and wide with a small pupil, an "o" mouth. sleepy: the eye shut, a 2 px lid line curving down, the
 * brow relaxed, the mouth soft. Never a V brow.
 */
function drawFace(g: CanvasRenderingContext2D, f: FaceAt, face: BaddieFace, lid: string, brow: string): void {
  const { ex, ey, er, bw, mx, my } = f;
  g.fillStyle = INK;
  if (face === 'sleepy') {
    // the shut eye: a 2 px line curving down at both ends (content, asleep)
    g.fillRect(R(ex - er), R(ey), 2, 2); g.fillRect(R(ex - er + 1), R(ey + 1), R(2 * er - 2), 2); g.fillRect(R(ex + er - 2), R(ey), 2, 2);
  } else {
    const wide = face === 'surprised' ? 1 : 0, r = er + wide;
    g.beginPath(); g.arc(ex, ey, r + 1, 0, Math.PI * 2); g.fill();
    g.fillStyle = WHITE; g.beginPath(); g.arc(ex, ey, r, 0, Math.PI * 2); g.fill();
    const ps = face === 'surprised' ? 2 : 3;
    g.fillStyle = PUPIL; g.fillRect(R(ex + r * 0.35 - ps / 2), R(ey - ps / 2 + 0.5), ps, ps);
    if (face === 'grumpy') {
      // the lid: the top third of the eye in the face's own colour, its edge a flat ink line
      g.fillStyle = lid; g.fillRect(R(ex - r - 1), R(ey - r - 1), R(2 * r + 2), R(r * 0.8) + 1);
      g.fillStyle = INK; g.fillRect(R(ex - r), R(ey - r * 0.2), R(2 * r), 1);
    }
  }
  // the brow: flat always (level, raised, or pulled low and heavy); never tilted into a V
  const bh = face === 'grumpy' ? 3 : 2;
  const by = face === 'surprised' ? ey - er - 6 : face === 'grumpy' ? ey - er - 1 : face === 'sleepy' ? ey - er - 2 : ey - er - 4;
  g.fillStyle = INK; g.fillRect(R(ex - bw / 2) - 1, R(by) - 1, R(bw) + 2, bh + 2);
  g.fillStyle = brow; g.fillRect(R(ex - bw / 2), R(by), R(bw), bh);
  // the mouth
  g.fillStyle = INK;
  if (face === 'grumpy') {
    // a pout: short, the corners down, the lower lip out under it
    g.fillRect(R(mx - 3), R(my + 1), 1, 2); g.fillRect(R(mx - 2), R(my), 5, 2); g.fillRect(R(mx + 3), R(my + 1), 1, 2);
    g.fillRect(R(mx - 1), R(my + 3), 4, 1);
  } else if (face === 'surprised') {
    g.fillRect(R(mx - 1), R(my - 1), 4, 1); g.fillRect(R(mx - 1), R(my + 2), 4, 1); g.fillRect(R(mx - 2), R(my), 1, 2); g.fillRect(R(mx + 3), R(my), 1, 2);
  } else if (face === 'sleepy') {
    g.fillRect(R(mx - 1), R(my + 1), 3, 2);
  } else g.fillRect(R(mx - 2), R(my), 5, 2);
}

/**
 * Three 5 x 5 "z" marks stepping up and out from (x, y), one more every 20 frames (a doze), inked. (The plan said 3 x 3,
 * but a 3 x 3 z -- two bars and a centre pixel -- reads as an "I" or a "=": ART_BIBLE C16's lesson for the dragons' z;
 * at 5 x 5 the diagonal has three steps and reads as a z.)
 */
function zeds(g: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  const n = 1 + (Math.floor(t / 20) % 3);
  for (let i = 0; i < n; i++) {
    const zx = R(x + i * 8), zy = R(y - i * 9);
    g.fillStyle = INK; g.fillRect(zx - 1, zy - 1, 7, 7);
    g.fillStyle = WHITE; g.fillRect(zx, zy, 5, 1); g.fillRect(zx + 3, zy + 1, 1, 1); g.fillRect(zx + 2, zy + 2, 1, 1); g.fillRect(zx + 1, zy + 3, 1, 1); g.fillRect(zx, zy + 4, 5, 1);
  }
}
/** Two 2 px dust puffs at the heels, stepping back and up (a shuffle's). */
function dust(g: CanvasRenderingContext2D, x: number, t: number): void {
  const s = Math.floor(t / 6) % 3;
  for (const [dx, dy] of [[-4 - s * 4, -2 - s], [-10 - s * 3, -4 - s * 2]] as const) {
    g.fillStyle = INK; g.fillRect(R(x + dx) - 1, R(dy) - 1, 4, 4);
    g.fillStyle = '#e8e0cc'; g.fillRect(R(x + dx), R(dy), 2, 2);
  }
}
/** A small flat grumble cloud over the head (driven off): an inked puff with a wavy 2 px line in it. */
function grumble(g: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  const b = Math.floor(t / 10) % 2;
  g.fillStyle = INK; g.fillRect(R(x) - 1, R(y) - 1 - b, 18, 11);
  g.fillStyle = WHITE; g.fillRect(R(x), R(y) - b, 16, 9);
  g.fillStyle = INK;
  for (let i = 0; i < 4; i++) g.fillRect(R(x) + 2 + i * 3, R(y) + 3 - b + (i % 2 ? 1 : -1), 3, 2);
}

// ---------- the pose's motion ----------

/** A walk's body bob and stride phase (stepped every 8 frames), a shuffle's smaller and quicker. */
function gait(pose: BaddiePose, t: number): { bob: number; step: number } {
  if (pose === 'walk') { const k = Math.floor(t / 8) % 4; return { bob: [0, -2, 0, -2][k], step: [1, 0, -1, 0][k] }; }
  if (pose === 'leave') { const k = Math.floor(t / 5) % 4; return { bob: [0, -1, 0, -1][k], step: [1, 0, -1, 0][k] }; }
  return { bob: 0, step: 0 };
}

// ---------- the three ----------

/** THE MOLE KING, facing +x, feet on y 0: a round velvet body, a tiny crown, big pink digging paws, spectacles. */
function moleKing(g: CanvasRenderingContext2D, c: Cel, face: BaddieFace, pose: BaddiePose, t: number): void {
  const P = BADDIE_ART.moleking.palette, sit = pose === 'sit', { bob, step } = gait(pose, t);
  const drop = sit ? 8 : 0, y0 = -42 + drop + bob;
  // the stub of a tail, and the far foot
  celBall(g, c, -44, y0 + 22, 5, P.velvet, false);
  if (!sit) celRect(g, c, -26 + step * 4, -9 + bob, 16, 9, 4, P.velvet, 0.4, 0);
  // the body and the head as one velvet shape, the snout tapering out of the head
  g.beginPath(); g.ellipse(-8, y0, 42, 40 - drop / 2, 0, 0, Math.PI * 2);
  g.moveTo(52, y0 - 16); g.arc(30, y0 - 16, 22, 0, Math.PI * 2);
  g.moveTo(44, y0 - 26); g.quadraticCurveTo(62, y0 - 20, 64, y0 - 12); g.quadraticCurveTo(58, y0 - 4, 44, y0 - 4); g.closePath();
  celPath(g, c, P.velvet, 0, y0, 46, 0.3, 0.3);
  // the belly, low on the front
  celPoly(g, c, [2, y0 + 12, 22, y0 + 8, 32, y0 + 18, 28, y0 + 32, 12, y0 + 38, 0, y0 + 30], P.belly, 0.3, 0);
  // the pink nose on the snout's tip
  celBall(g, c, 64, y0 - 12, 5, P.paw, false);
  // the near foot
  if (!sit) celRect(g, c, 8 - step * 4, -9 + bob, 18, 9, 4, P.velvet, 0.4, 0);
  else celRect(g, c, 18, -10, 22, 10, 4, P.velvet, 0.4, 0);
  // the big pink digging paws, held low in front of the belly, clear of the face: four fat toes each (ink-split)
  const paw = (px: number, py: number) => {
    celPoly(g, c, [px - 10, py - 5, px + 4, py - 10, px + 14, py - 6, px + 16, py + 5, px + 8, py + 10, px - 6, py + 8], P.paw, 0.3, 0.25);
    g.fillStyle = INK; for (let i = 0; i < 3; i++) g.fillRect(R(px + 2 + i * 4), R(py + 3), 1, 6);
  };
  const lift = pose === 'walk' ? step : 0;
  if (sit) { paw(22, y0 + 20); paw(32, y0 + 14); } else { paw(28, y0 + 24 - lift); paw(40, y0 + 16 + lift); }
  // the face: the eye in its spectacles (a gold ring round it, its arm back to the ear), the brow, the mouth under the snout
  const f: FaceAt = { ex: 38, ey: y0 - 24, er: 4, bw: 11, mx: 45, my: y0 - 6 };
  // the pale muzzle under the snout, where the mouth is (ink alone on the velvet would not show)
  g.beginPath(); g.ellipse(46, y0 - 5, 9, 6, 0, 0, Math.PI * 2); celPath(g, c, P.belly, 46, y0 - 5, 9, 0.3, 0);
  g.fillStyle = INK; g.fillRect(16, R(y0 - 26), 14, 4);
  g.fillStyle = P.rim; g.fillRect(17, R(y0 - 25), 12, 2);
  g.beginPath(); g.arc(f.ex, f.ey, 9, 0, Math.PI * 2); g.strokeStyle = INK; g.lineWidth = 4; g.stroke();
  g.beginPath(); g.arc(f.ex, f.ey, 9, 0, Math.PI * 2); g.strokeStyle = P.rim; g.lineWidth = 2; g.stroke();
  drawFace(g, f, face, P.velvet, P.belly);
  // the tiny crown, a jewel on its front
  const cx = 28, cy = y0 - 40;
  celPoly(g, c, [cx - 10, cy + 4, cx - 10, cy - 6, cx - 5, cy - 1, cx, cy - 9, cx + 5, cy - 1, cx + 10, cy - 6, cx + 10, cy + 4], P.crown, 0.3, 0.3);
  g.fillStyle = INK; g.fillRect(cx - 2, cy - 1, 5, 4); g.fillStyle = P.jewel; g.fillRect(cx - 1, cy, 3, 2);
  if (sit && face === 'sleepy') zeds(g, 50, y0 - 50, t);
}

/** THE STORM ROC, facing +x: a fluffy slate-blue bird, folded wings, a tufted crest, a hooked beak. */
function stormRoc(g: CanvasRenderingContext2D, c: Cel, face: BaddieFace, pose: BaddiePose, t: number): void {
  const P = BADDIE_ART.stormroc.palette, sit = pose === 'sit', { bob, step } = gait(pose, t);
  const drop = sit ? 22 : 0, y0 = -56 + drop + bob;
  // the legs and feet (hidden sitting: it settles on them)
  if (!sit) {
    for (const [lx, s] of [[-10, -step], [12, step]] as const) {
      celCapsule(g, c, lx, y0 + 30, lx + s * 5, -4, 3, P.leg);
      celPoly(g, c, [lx + s * 5 - 6, -3, lx + s * 5 + 10, -3, lx + s * 5 + 12, 0, lx + s * 5 - 6, 0], P.leg, 0.3, 0);
    }
  }
  // the tail feathers: a fan at the back
  celPoly(g, c, [-40, y0 - 4, -70, y0 - 10, -66, y0 + 2, -72, y0 + 12, -62, y0 + 16, -40, y0 + 18], P.wing, 0.35, 0);
  // the body: a big fluffy oval, its edge scalloped at the belly
  g.beginPath(); g.ellipse(0, y0, 50, 36, 0, 0, Math.PI * 2);
  celPath(g, c, P.body, 0, y0, 50);
  // the breast fluff: scallops down the front
  celPoly(g, c, [22, y0 - 20, 40, y0 - 14, 50, y0, 46, y0 + 16, 34, y0 + 28, 18, y0 + 32, 16, y0 + 10], P.fluff, 0.3, 0.25);
  g.fillStyle = INK; for (const [sx, sy] of [[30, y0 - 6], [36, y0 + 8], [28, y0 + 20]] as const) g.fillRect(sx, sy, 5, 1);
  // the folded wing over the body, its feather ends stepped
  celPoly(g, c, [-30, y0 - 22, 14, y0 - 26, 26, y0 - 12, 10, y0 + 10, -20, y0 + 20, -46, y0 + 16, -40, y0 + 4, -48, y0 - 6], P.wing, 0.35, 0.25);
  g.fillStyle = INK; for (const [sx, sy] of [[-30, y0 + 8], [-16, y0 + 12], [-2, y0 + 6], [8, y0 - 4]] as const) g.fillRect(sx, sy, 8, 1);
  // the head: round, on the body's front shoulder
  const hx = 40, hy = y0 - 34;
  // the crest: three tufts off the back of the head
  for (const [dx, dy, a] of [[-10, -16, 0.9], [-4, -20, 0.6], [2, -19, 0.3]] as const) celTaper(g, c, hx + dx + 4, hy - 8, hx + dx - Math.cos(a) * 14, hy + dy - Math.sin(a) * 6, 4, 1.5, P.body);
  celBall(g, c, hx, hy, 18, P.body);
  // the hooked beak
  celPoly(g, c, [hx + 14, hy - 6, hx + 30, hy - 4, hx + 34, hy + 4, hx + 28, hy + 8, hx + 28, hy + 3, hx + 14, hy + 4], P.beak, 0.3, 0);
  drawFace(g, { ex: hx + 7, ey: hy - 4, er: 4, bw: 12, mx: hx + 18, my: hy + 8 }, face, P.body, P.wing);
  if (sit && face === 'sleepy') zeds(g, hx + 10, hy - 26, t);
}

/** THE FROST GIANT, facing +x: a tall woolly snow giant, a knitted scarf, a big red nose, mittens and boots. */
function frostGiant(g: CanvasRenderingContext2D, c: Cel, face: BaddieFace, pose: BaddiePose, t: number): void {
  const P = BADDIE_ART.frostgiant.palette, sit = pose === 'sit', { bob, step } = gait(pose, t);
  const drop = sit ? 12 : 0, y0 = -58 + drop + bob, ry = sit ? 40 : 44;
  // the boots (sitting: stuck out in front)
  if (!sit) {
    celRect(g, c, -22 + step * 5, -14 + bob, 20, 14, 4, P.boot, 0.4, 0);
    celRect(g, c, 4 - step * 5, -14 + bob, 22, 14, 4, P.boot, 0.4, 0);
  } else { celRect(g, c, 16, -12, 26, 12, 4, P.boot, 0.4, 0); }
  // the far arm (behind the body): a stubby woolly arm and its mitten
  celTaper(g, c, -18, y0 - 22, -32, y0 + 8, 10, 8, P.wool, 0);
  celBall(g, c, -33, y0 + 14, 8, P.scarf, false);
  // the body and head: one big woolly mass, its edge in wool lumps, the head a dome on the shoulders
  const hx = 6, hy = y0 - 50;
  g.beginPath(); g.ellipse(0, y0, 38, ry, 0, 0, Math.PI * 2);
  for (const [lx, ly, r] of [[-36, y0 - 18, 9], [-38, y0 + 10, 9], [36, y0 - 20, 9], [38, y0 + 8, 9], [28, y0 + ry - 10, 9], [-28, y0 + ry - 8, 9], [hx - 16, hy - 12, 9], [hx - 2, hy - 20, 9], [hx + 12, hy - 16, 8]] as const) { g.moveTo(lx + r, ly); g.arc(lx, ly, r, 0, Math.PI * 2); }
  g.moveTo(hx + 26, hy); g.ellipse(hx, hy, 26, 22, 0, 0, Math.PI * 2);
  celPath(g, c, P.wool, 0, y0 - 10, 52, 0.3, 0.25);
  // wool curls: little 2 px ink hooks over the fleece
  g.fillStyle = INK; for (const [sx, sy] of [[-20, y0 - 6], [-6, y0 + 18], [-24, y0 + 24], [12, y0 + 28], [-14, hy - 4]] as const) { g.fillRect(sx, sy, 4, 1); g.fillRect(sx + 3, sy + 1, 1, 2); }
  // the face: a round patch at the head's front
  g.beginPath(); g.ellipse(hx + 14, hy + 2, 15, 15, 0, 0, Math.PI * 2);
  celPath(g, c, P.face, hx + 14, hy + 2, 15, 0.3, 0);
  drawFace(g, { ex: hx + 16, ey: hy - 3, er: 4, bw: 12, mx: hx + 17, my: hy + 10 }, face, P.face, P.wool);
  // the big red nose
  celBall(g, c, hx + 28, hy + 3, 6.5, P.nose);
  // the knitted scarf round the neck, one end hanging, knitted stripes
  celRect(g, c, hx - 24, hy + 18, 50, 11, 5, P.scarf, 0.4, 0);
  celRect(g, c, hx - 18, hy + 22, 11, 30, 3, P.scarf, 0.4, 0);
  g.fillStyle = INK; g.fillRect(hx - 19, hy + 35, 13, 5); g.fillRect(hx - 19, hy + 44, 13, 5);
  g.fillStyle = P.stripe; g.fillRect(hx - 18, hy + 36, 11, 3); g.fillRect(hx - 18, hy + 45, 11, 3);
  // the near arm, stubby, its mitten (sitting: resting on the knee)
  const sw = !sit && (pose === 'walk' || pose === 'leave') ? step * 4 : 0;
  if (sit) { celTaper(g, c, 16, y0 - 18, 30, y0 + 10, 10, 8, P.wool, 0); celBall(g, c, 34, y0 + 14, 8, P.scarf); }
  else { celTaper(g, c, 16, y0 - 20, 24 + sw, y0 + 12, 10, 8, P.wool, 0); celBall(g, c, 26 + sw, y0 + 18, 8, P.scarf); }
  if (sit && face === 'sleepy') zeds(g, hx + 24, hy - 30, t);
}

/**
 * Draw a baddie standing on the road: (x, feetY) the middle of its feet, facing +1 (right) or -1 (toward a team coming
 * from the left), its face and pose, `t` the scene's step (the walk's bob and stride, the dozing "z"s, the shuffle's
 * dust). `turn` draws it looking back over its shoulder: its head turned the other way (the body still).
 */
export function drawBaddie(ctx: CanvasRenderingContext2D, id: BaddieId, x: number, feetY: number, facing: 1 | -1, face: BaddieFace, pose: BaddiePose, t: number): void {
  const g = ctx;
  g.save();
  g.translate(R(x), R(feetY));
  // the ground shadow (the ink at the house's 0.28, a flat ellipse under the feet)
  const B = BADDIE_ART[id];
  g.fillStyle = 'rgba(26,16,24,0.28)'; g.beginPath(); g.ellipse(0, 0, B.w * 0.36, 3, 0, 0, Math.PI * 2); g.fill();
  if (pose === 'leave') dust(g, -facing * B.w * 0.3, t);
  // (turn: the body faces `facing`, the head looks back: drawn as the whole baddie facing the other way over a body
  // facing this way would double it, so a turn mirrors the drawing and keeps its feet where they stand)
  const f: 1 | -1 = pose === 'turn' ? (-facing as 1 | -1) : facing;
  g.scale(f, 1);
  const c = celTarget(f);
  const shown: BaddiePose = pose === 'turn' ? 'stand' : pose;
  if (id === 'moleking') moleKing(g, c, face, shown, t);
  else if (id === 'stormroc') stormRoc(g, c, face, shown, t);
  else frostGiant(g, c, face, shown, t);
  g.restore();
  if (pose === 'turn') {
    // the turn's cue: a small "!" over the head, the surprise of being shown the other way
    const top = R(feetY) - B.h - 12;
    g.fillStyle = INK; g.fillRect(R(x) - 3, top - 1, 7, 12);
    g.fillStyle = WHITE; g.fillRect(R(x) - 2, top, 5, 10);
    drawText(g, '!', R(x) - 2, top + 2, { color: INK, shadow: false });
  }
  if (pose === 'leave') grumble(g, R(x) + facing * 6 - 8, R(feetY) - B.h - 16, t);
}

/**
 * A baddie's 24 x 24 portrait (the chooser's baddie row, S8): its own small drawing -- the head and its tell (the
 * crown and spectacles, the crest and beak, the woolly dome, the nose and scarf) -- in an inked frame, top-left at (x, y).
 */
export function drawBaddiePortrait(ctx: CanvasRenderingContext2D, id: BaddieId, x: number, y: number): void {
  const g = ctx, X = R(x), Y = R(y), c = celTarget(1), P = BADDIE_ART[id].palette;
  g.save();
  g.fillStyle = INK; g.fillRect(X, Y, 24, 24);
  g.fillStyle = '#e8e0cc'; g.fillRect(X + 1, Y + 1, 22, 22);
  g.beginPath(); g.rect(X + 1, Y + 1, 22, 22); g.clip();
  if (id === 'moleking') {
    celBall(g, c, X + 11, Y + 17, 10, P.velvet);
    celPoly(g, c, [X + 18, Y + 12, X + 24, Y + 15, X + 18, Y + 18], P.velvet, 0.3, 0);
    celBall(g, c, X + 22, Y + 15, 2.5, P.paw, false);
    celPoly(g, c, [X + 5, Y + 8, X + 5, Y + 3, X + 8, Y + 5, X + 10, Y + 1, X + 12, Y + 5, X + 15, Y + 3, X + 15, Y + 8], P.crown, 0.3, 0);
    g.beginPath(); g.arc(X + 15, Y + 13, 4, 0, Math.PI * 2); g.strokeStyle = INK; g.lineWidth = 3; g.stroke(); g.strokeStyle = P.rim; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = WHITE; g.fillRect(X + 14, Y + 12, 3, 2); g.fillStyle = PUPIL; g.fillRect(X + 15, Y + 12, 2, 2);
  } else if (id === 'stormroc') {
    celTaper(g, c, X + 8, Y + 9, X + 2, Y + 3, 2.5, 1, P.body);
    celTaper(g, c, X + 10, Y + 8, X + 6, Y + 1, 2.5, 1, P.body);
    celBall(g, c, X + 11, Y + 14, 9, P.body);
    celPoly(g, c, [X + 17, Y + 11, X + 24, Y + 12, X + 24, Y + 17, X + 21, Y + 18, X + 21, Y + 15, X + 17, Y + 16], P.beak, 0.3, 0);
    g.fillStyle = INK; g.fillRect(X + 12, Y + 10, 5, 5); g.fillStyle = WHITE; g.fillRect(X + 13, Y + 11, 3, 3); g.fillStyle = PUPIL; g.fillRect(X + 14, Y + 12, 2, 2);
  } else {
    celBall(g, c, X + 11, Y + 11, 10, P.wool);
    celPoly(g, c, [X + 11, Y + 6, X + 21, Y + 6, X + 23, Y + 13, X + 18, Y + 17, X + 12, Y + 15], P.face, 0.3, 0);
    celBall(g, c, X + 21, Y + 12, 3, P.nose, false);
    g.fillStyle = INK; g.fillRect(X + 15, Y + 8, 4, 4); g.fillStyle = WHITE; g.fillRect(X + 16, Y + 9, 2, 2);
    celRect(g, c, X + 2, Y + 18, 20, 5, 2, P.scarf, 0.3, 0);
    g.fillStyle = P.stripe; g.fillRect(X + 8, Y + 19, 2, 3); g.fillRect(X + 14, Y + 19, 2, 3);
  }
  g.restore();
}
