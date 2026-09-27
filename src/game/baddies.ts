// The six bosses (ART_BIBLE 5.10; BASE_DESIGN 6: the art here, their fights in missionview.ts), one at the end of every
// road of its region: THE BRIDGE TROLL of Millbrook, THE MOLE KING of Old Mine Road, THE BRIAR BOAR of Bramblewood,
// THE STORM ROC of Highfold, THE FROST GIANT of Frostmere and THE CINDER GOLEM of Emberfell, each 88-140 px, drawn in
// the house style from the engine's cel helpers (cel.ts: a 1 px #1a1018 ink, flat bands lit from the top left, no
// gradients, no alpha, no mark under 2 px).
//
// Fought (BASE_DESIGN B8): a boss walks onto the road fierce, trades blows with the team -- its big move thrown at a
// dragon, the dragons' breath back at it -- and, beaten, is knocked down seeing stars and runs off up the road; one too
// strong for the team stomps off up it unbeaten, in its walk. Its faces (BaddieFace): fierce (a heavy brow slanted down toward the snout, the eye
// narrowed under it, teeth gritted -- the one angry face in the game, and only the enemies wear it), hurt (the eye
// screwed shut, a wince) as a hit lands, dazed (the eye a spiral) knocked down. Its poses (BaddiePose): walk, stand,
// attack (it rears forward into its lunge), hit (rocked back), down (sat down hard, three stars circling its head),
// flee (scrambling off, 2 px dust at its heels). A hit also flashes its fills pale inside its ink (cel.ts HIT_FLASH),
// never a wound. Nothing is drawn over an eye (the Mole King's spectacles ring it; they never cover it).
//
// Gate (x) (tools/palette-check.ts): each fill on a boss's silhouette edge (BADDIE_EDGE) keeps >= 25 % luminance from
// the mission road (FLOORS.road), the scene's ground and every band of its home climate at every phase, and >= 6
// Oklab L from the ink; the colours that touch inside it pass the house ladder (BADDIE_PAIRS). In the meadow, the
// forest and the ash hills only dark fills pass (L <= 0.125), so the troll, the boar and the golem are dark shapes whose
// bright parts -- tusks, a snout, glowing seams -- lie inside their outlines.
import { celPath, celPoly, celBall, celRect, celCapsule, celTaper } from '../lib/art/shading.ts';
import { INK } from './surfaces.ts';
import { celTarget, HIT_FLASH } from './cel.ts';
import type { Cel } from './cel.ts';
import { drawStars } from './fightfx.ts';
import type { BaddieId, BaddieFace, BaddiePose, Climate } from './missiondata.ts';
import { REGIONS } from './regions.ts';

export type { BaddieId, BaddieFace, BaddiePose } from './missiondata.ts';

/**
 * A boss's art record: who, its size (px, the drawing's bounding box), its colours, and (drawing space: facing +x, feet
 * at 0) where the top of its head is standing and how far it drops sitting down (the knocked-down stars circle there),
 * where its big move's missile leaves it, and where the team's breath lands on it.
 */
export interface Baddie {
  id: BaddieId; name: string; w: number; h: number; palette: Readonly<Record<string, string>>;
  head: readonly [number, number]; drop: number; throwAt: readonly [number, number]; hitAt: readonly [number, number];
}

/** The shared face colours: the eye whites and pupils (the keepers' and dragons' own). */
const WHITE = '#f8f4ec', PUPIL = '#1a1418';

export const BADDIE_ART: Readonly<Record<BaddieId, Baddie>> = Object.freeze({
  bridgetroll: Object.freeze<Baddie>({
    id: 'bridgetroll', name: 'THE BRIDGE TROLL', w: 124, h: 124, head: [26, -116], drop: 16, throwAt: [40, -58], hitAt: [14, -70],
    palette: Object.freeze({ skin: '#3f4e38', moss: '#2e4226', belly: '#7a8a5c', cloth: '#4e3a2c', club: '#4a3424', tusk: '#e8e0c8' }),
  }),
  moleking: Object.freeze<Baddie>({
    id: 'moleking', name: 'THE MOLE KING', w: 112, h: 88, head: [28, -92], drop: 8, throwAt: [40, -34], hitAt: [18, -46],
    palette: Object.freeze({ velvet: '#5e4238', belly: '#8a6a58', paw: '#e8969c', crown: '#d8a838', jewel: '#b0304a', rim: '#d8a838' }),
  }),
  briarboar: Object.freeze<Baddie>({
    id: 'briarboar', name: 'THE BRIAR BOAR', w: 140, h: 92, head: [40, -86], drop: 12, throwAt: [62, -40], hitAt: [30, -50],
    palette: Object.freeze({ hide: '#3e3036', bristle: '#2a2226', snout: '#c87880', tusk: '#efe4c8', vine: '#5a8a3e', berry: '#d04a5a' }),
  }),
  stormroc: Object.freeze<Baddie>({
    id: 'stormroc', name: 'THE STORM ROC', w: 140, h: 100, head: [40, -110], drop: 22, throwAt: [66, -90], hitAt: [24, -60],
    palette: Object.freeze({ body: '#4a5a7a', wing: '#34405c', fluff: '#9aa6c4', beak: '#e8a848', leg: '#e8a848' }),
  }),
  frostgiant: Object.freeze<Baddie>({
    id: 'frostgiant', name: 'THE FROST GIANT', w: 96, h: 140, head: [6, -148], drop: 12, throwAt: [30, -48], hitAt: [12, -80],
    palette: Object.freeze({ wool: '#98a8c4', face: '#d8a4a0', scarf: '#a8323a', stripe: '#d89a48', nose: '#b83040', boot: '#503a34' }),
  }),
  cindergolem: Object.freeze<Baddie>({
    id: 'cindergolem', name: 'THE CINDER GOLEM', w: 104, h: 132, head: [12, -136], drop: 20, throwAt: [46, -46], hitAt: [14, -76],
    palette: Object.freeze({ rock: '#3a3236', facet: '#6a5e62', seam: '#f07a2a', core: '#ffd24a' }),
  }),
});

/**
 * Where each boss lives (BASE_DESIGN 5.1's regions: Millbrook is meadow, Old Mine Road caves, Bramblewood forest,
 * Highfold peaks, Frostmere ice, Emberfell ash): its backdrop for gate (x). Read off the regions' own table
 * (regions.ts REGIONS: each region's boss and climate), so the two never disagree.
 */
export const BADDIE_HOME: Readonly<Record<BaddieId, Climate>> = Object.freeze(Object.fromEntries(REGIONS.map((r) => [r.baddie, r.climate] as const)) as Record<BaddieId, Climate>);
/** The palette keys on each boss's silhouette edge (seen against the road and its climate: gate x); the rest lie inside it. */
export const BADDIE_EDGE: Readonly<Record<BaddieId, readonly string[]>> = Object.freeze({
  bridgetroll: ['skin', 'moss', 'cloth', 'club'],
  moleking: ['velvet', 'paw', 'crown'],
  briarboar: ['hide', 'bristle'],
  stormroc: ['body', 'wing', 'fluff', 'beak', 'leg'],
  frostgiant: ['wool', 'face', 'scarf', 'stripe', 'nose', 'boot'],
  cindergolem: ['rock'],
});
/**
 * The fills the watchable scene sees a boss by, for palette gate (x) (each >= 25 % in luminance from the road, the
 * scene's ground and its region's backdrop bands, >= 6 okL from ink): its palette's colours on its silhouette edge
 * (BADDIE_EDGE). The colours inside the silhouette (a belly, a tusk, the glowing seams) never meet the road or the sky:
 * gate (x) holds them to the house ladder against what they touch (BADDIE_PAIRS), and every fill to the ink.
 */
export const BADDIE_FILLS: Readonly<Record<BaddieId, readonly string[]>> = Object.freeze(Object.fromEntries(
  (Object.keys(BADDIE_EDGE) as BaddieId[]).map((id) => [id, Object.freeze([...new Set(BADDIE_EDGE[id].map((k) => BADDIE_ART[id].palette[k]))])]),
) as Record<BaddieId, readonly string[]>);
/** The pairs of colours that touch inside each boss (the house ladder, gate x), with where. */
export const BADDIE_PAIRS: Readonly<Record<BaddieId, readonly (readonly [string, string, string])[]>> = Object.freeze({
  bridgetroll: [['skin', 'belly', 'the belly on the body'], ['skin', 'tusk', 'the tusks on the jaw'], ['skin', 'cloth', 'the loincloth on the hips'], ['skin', 'club', 'the club in the hand'],
    ['skin', 'white', 'the eye on the face'], ['moss', 'white', 'the brow over the eye']],
  moleking: [['velvet', 'belly', 'the belly on the body'], ['velvet', 'paw', 'the paws and snout on the body'], ['belly', 'paw', 'the paws over the belly'],
    ['velvet', 'crown', 'the crown on the head'], ['crown', 'jewel', 'the jewel on the crown'], ['velvet', 'rim', 'the spectacles on the face'], ['velvet', 'white', 'the eye on the face']],
  briarboar: [['hide', 'snout', 'the snout on the head'], ['hide', 'tusk', 'the tusk on the jaw'], ['snout', 'tusk', 'the tusk by the snout'], ['hide', 'vine', 'the vines round the body'],
    ['vine', 'berry', 'the berries on the vines'], ['hide', 'white', 'the eye on the face']],
  stormroc: [['body', 'wing', 'the folded wing on the body'], ['body', 'fluff', 'the breast fluff on the body'], ['body', 'beak', 'the beak on the head'],
    ['wing', 'fluff', 'the wing over the fluff'], ['body', 'white', 'the eye on the face'], ['fluff', 'leg', 'the legs under the fluff']],
  frostgiant: [['wool', 'face', 'the face in the wool'], ['wool', 'scarf', 'the scarf on the wool'], ['scarf', 'stripe', 'the knitted stripes'],
    ['face', 'nose', 'the nose on the face'], ['wool', 'boot', 'the boots under the wool'], ['face', 'white', 'the eye on the face'], ['wool', 'scarf', 'the mittens on the arms']],
  cindergolem: [['rock', 'facet', 'the lit facets of the rock'], ['rock', 'seam', 'the glowing seams'], ['seam', 'core', 'the core at the chest\'s heart'], ['rock', 'core', 'the glowing eye']],
});
/** The eye whites, for the pairs above. */
export const BADDIE_WHITE = WHITE;

const R = Math.round, TAU = Math.PI * 2;

// ---------- the face ----------

/** Where a face sits (the head's own space, facing +x): the eye's middle, its radius, the brow's width, the mouth's middle. */
interface FaceAt { ex: number; ey: number; er: number; bw: number; mx: number; my: number }

/**
 * A face, facing +x: an eye, a brow in `brow`, a mouth. fierce: the eye white with its pupil looking ahead, a heavy
 * 3 px brow slanted DOWN toward the snout, its underside lidding the eye's top in `lid` (the eye narrowed), the teeth
 * gritted (a white bar split by ink). hurt: the eye screwed shut (a ">" into the face, 2 px strokes), the brow pushed
 * up the other way, a wince (an open mouth). dazed: the eye a spiral in its white, the brow high and flat, a wavy mouth.
 * `eye`: the white, or a glow (the golem's).
 */
function drawFace(g: CanvasRenderingContext2D, f: FaceAt, face: BaddieFace, lid: string, brow: string, eye = WHITE): void {
  const { ex, ey, er, bw, mx, my } = f;
  if (face === 'hurt') {
    // screwed shut: a ">" pointing into the face, 2 px strokes
    g.fillStyle = INK;
    for (let i = 0; i <= er; i++) { g.fillRect(R(ex - er + i * 1.4), R(ey - er + i), 2, 2); g.fillRect(R(ex - er + i * 1.4), R(ey + er - i - 1), 2, 2); }
  } else {
    g.fillStyle = INK; g.beginPath(); g.arc(ex, ey, er + 1, 0, TAU); g.fill();
    g.fillStyle = eye; g.beginPath(); g.arc(ex, ey, er, 0, TAU); g.fill();
    if (face === 'dazed') {
      // the spiral, a turn and a half from the middle out
      g.strokeStyle = INK; g.lineWidth = 1.5; g.beginPath();
      for (let i = 0; i <= 18; i++) { const a = (i / 18) * Math.PI * 3.2, r = 0.4 + (er - 1.2) * (i / 18), px = ex + Math.cos(a) * r, py = ey + Math.sin(a) * r; if (i) g.lineTo(px, py); else g.moveTo(px, py); }
      g.stroke();
    } else {
      g.fillStyle = PUPIL; g.fillRect(R(ex + er * 0.35 - 1.5), R(ey - 1), 3, 3);
      // the lid: the eye's top narrowed under the slanted brow, in the face's own colour
      g.fillStyle = lid; g.beginPath(); g.moveTo(ex - er - 1, ey - er - 1); g.lineTo(ex + er + 1, ey - er - 1); g.lineTo(ex + er + 1, ey - er * 0.1); g.lineTo(ex - er - 1, ey - er * 0.75); g.closePath(); g.fill();
      g.strokeStyle = INK; g.lineWidth = 1; g.beginPath(); g.moveTo(ex - er, ey - er * 0.75 + 0.5); g.lineTo(ex + er, ey - er * 0.1 + 0.5); g.stroke();
    }
  }
  // the brow: fierce slants down toward the snout; hurt the other way, pushed up; dazed flat and high
  const x0 = ex - bw / 2, x1 = ex + bw / 2, top = ey - er - 2;
  const [y0, y1] = face === 'fierce' ? [top - 5, top] : face === 'hurt' ? [top - 1, top - 5] : [top - 5, top - 5];
  g.fillStyle = INK; g.beginPath(); g.moveTo(x0 - 1, y0 - 1); g.lineTo(x1 + 1, y1 - 1); g.lineTo(x1 + 1, y1 + 4); g.lineTo(x0 - 1, y0 + 4); g.closePath(); g.fill();
  g.fillStyle = brow; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.lineTo(x1, y1 + 3); g.lineTo(x0, y0 + 3); g.closePath(); g.fill();
  // the mouth
  g.fillStyle = INK;
  if (face === 'fierce') {
    // teeth gritted: a white bar split by ink, in an ink frame
    g.fillRect(R(mx - 5), R(my - 2), 11, 5);
    g.fillStyle = WHITE; g.fillRect(R(mx - 4), R(my - 1), 9, 3);
    g.fillStyle = INK; g.fillRect(R(mx - 1), R(my - 1), 1, 3); g.fillRect(R(mx + 2), R(my - 1), 1, 3);
  } else if (face === 'hurt') {
    g.fillRect(R(mx - 3), R(my - 2), 7, 6); g.fillStyle = '#8a2a3a'; g.fillRect(R(mx - 2), R(my - 1), 5, 4);
  } else {
    for (let i = 0; i < 4; i++) g.fillRect(R(mx - 4 + i * 2), R(my + (i % 2 ? 1 : -1)), 2, 2);
  }
}

// ---------- the marks and the pose's motion ----------

/** Two 2 px dust puffs at the heels, stepping back and up (a boss running off). */
function dust(g: CanvasRenderingContext2D, x: number, t: number): void {
  const s = Math.floor(t / 4) % 3;
  for (const [dx, dy] of [[-4 - s * 4, -2 - s], [-10 - s * 3, -4 - s * 2]] as const) {
    g.fillStyle = INK; g.fillRect(R(x + dx) - 1, R(dy) - 1, 4, 4);
    g.fillStyle = '#e8e0cc'; g.fillRect(R(x + dx), R(dy), 2, 2);
  }
}

/** How a drawing holds its body: standing (fighting, hit, attacking), walking, running off, or sat down hard. */
type Body = 'stand' | 'walk' | 'run' | 'sit';
/** A walk's body bob and stride phase (stepped every 8 frames), a run's quicker. */
function gait(body: Body, t: number): { bob: number; step: number } {
  if (body === 'walk') { const k = Math.floor(t / 8) % 4; return { bob: [0, -2, 0, -2][k], step: [1, 0, -1, 0][k] }; }
  if (body === 'run') { const k = Math.floor(t / 4) % 4; return { bob: [0, -2, 0, -2][k], step: [1, 0, -1, 0][k] }; }
  return { bob: 0, step: 0 };
}

// ---------- the six ----------

/** THE BRIDGE TROLL, facing +x, feet on y 0: a hulking mossy troll, hunched, a big warty nose over tusks, long arms, a log club dragged behind it. */
function bridgeTroll(g: CanvasRenderingContext2D, c: Cel, face: BaddieFace, body: Body, t: number): void {
  const P = BADDIE_ART.bridgetroll.palette, sit = body === 'sit', { bob, step } = gait(body, t);
  const drop = sit ? 16 : 0, y0 = -62 + drop + bob, hx = 26, hy = y0 - 34, hand = y0 + 34 - drop / 2;
  // the club dragged in the far hand, its heavy end on the road behind, two knots on it
  celTaper(g, c, -30, hand, -70, -8, 4, 9, P.club, 0.25);
  g.fillStyle = INK; for (const [kx, ky] of [[-46, 0.45], [-60, 0.8]] as const) g.fillRect(kx, R(hand + (-8 - hand) * ky), 4, 2);
  // the far arm hanging behind the body down to that hand
  celTaper(g, c, -18, y0 - 18, -30, hand - 6, 10, 8, P.skin, 0);
  celBall(g, c, -31, hand, 8, P.skin, false);
  // the far leg
  if (!sit) celRect(g, c, -22 + step * 5, -26 + bob, 17, 26, 6, P.skin, 0.4, 0);
  // the hunched body and its hump, one mossy mass
  g.beginPath(); g.ellipse(-6, y0, 34, 36, 0, 0, TAU); g.moveTo(8, y0 - 30); g.arc(-14, y0 - 30, 22, 0, TAU);
  celPath(g, c, P.skin, -6, y0 - 10, 46, 0.3, 0.25);
  // the belly, low on the front, and the loincloth over the hips
  celPoly(g, c, [2, y0 - 4, 22, y0 - 10, 30, y0 + 4, 26, y0 + 20, 8, y0 + 26, -2, y0 + 14], P.belly, 0.3, 0);
  celPoly(g, c, [-30, y0 + 22, 26, y0 + 20, 22, y0 + 34, 4, y0 + 30, -10, y0 + 36, -28, y0 + 32], P.cloth, 0.35, 0);
  // the near leg (sat down: stuck out in front)
  if (!sit) celRect(g, c, 2 - step * 5, -26 + bob, 18, 26, 6, P.skin, 0.4, 0);
  else celRect(g, c, 6, -16, 34, 16, 7, P.skin, 0.4, 0);
  // moss tufts on the hump and the head
  for (const [mx, my, sz] of [[-26, -50, 7], [-10, -56, 8], [hx - 8, -52, 6]] as const) celPoly(g, c, [mx - sz, y0 + my + 4, mx - sz / 2, y0 + my - sz, mx, y0 + my + 1, mx + sz / 2, y0 + my - sz - 2, mx + sz, y0 + my + 4], P.moss, 0.3, 0);
  // the head, big and forward on the shoulders; the paler muzzle over the jaw, where the mouth and the tusks are
  celBall(g, c, hx, hy, 19, P.skin);
  g.beginPath(); g.ellipse(hx + 8, hy + 8, 10, 7, 0, 0, TAU); celPath(g, c, P.belly, hx + 8, hy + 8, 10, 0.3, 0);
  drawFace(g, { ex: hx + 4, ey: hy - 8, er: 4, bw: 14, mx: hx + 8, my: hy + 9 }, face, c.col(P.skin), P.moss);
  for (const tx of [hx + 2, hx + 13]) celPoly(g, c, [tx, hy + 14, tx + 2, hy + 5, tx + 4, hy + 14], P.tusk, 0.2, 0);
  // the big warty nose at the front of the face, over the muzzle
  celBall(g, c, hx + 19, hy + 1, 7, P.skin);
  g.fillStyle = INK; g.fillRect(hx + 21, hy - 3, 2, 2); g.fillRect(hx + 17, hy + 4, 2, 2);
  // the near arm hanging down in front of the belly, clear of the face, its big fist by the knees
  celTaper(g, c, 14, y0 - 12, 26, hand - 8, 10, 8, P.skin, 0);
  celBall(g, c, 28, hand - 2, 9, P.skin, false);
  g.fillStyle = INK; for (let i = 0; i < 3; i++) g.fillRect(25 + i * 3, R(hand - 5), 1, 6);
}

/** THE MOLE KING, facing +x, feet on y 0: a round velvet body, a tiny crown, big pink digging paws, spectacles. */
function moleKing(g: CanvasRenderingContext2D, c: Cel, face: BaddieFace, body: Body, t: number): void {
  const P = BADDIE_ART.moleking.palette, sit = body === 'sit', { bob, step } = gait(body, t);
  const drop = sit ? 8 : 0, y0 = -42 + drop + bob;
  // the stub of a tail, and the far foot
  celBall(g, c, -44, y0 + 22, 5, P.velvet, false);
  if (!sit) celRect(g, c, -26 + step * 4, -9 + bob, 16, 9, 4, P.velvet, 0.4, 0);
  // the body and the head as one velvet shape, the snout tapering out of the head
  g.beginPath(); g.ellipse(-8, y0, 42, 40 - drop / 2, 0, 0, TAU);
  g.moveTo(52, y0 - 16); g.arc(30, y0 - 16, 22, 0, TAU);
  g.moveTo(44, y0 - 26); g.quadraticCurveTo(62, y0 - 20, 64, y0 - 12); g.quadraticCurveTo(58, y0 - 4, 44, y0 - 4); g.closePath();
  celPath(g, c, P.velvet, 0, y0, 46, 0.3, 0.3);
  // the belly, low on the front
  celPoly(g, c, [2, y0 + 12, 22, y0 + 8, 32, y0 + 18, 28, y0 + 32, 12, y0 + 38, 0, y0 + 30], P.belly, 0.3, 0);
  // the pink nose on the snout's tip
  celBall(g, c, 64, y0 - 12, 5, P.paw, false);
  // the near foot
  if (!sit) celRect(g, c, 8 - step * 4, -9 + bob, 18, 9, 4, P.velvet, 0.4, 0);
  else celRect(g, c, 18, -10, 22, 10, 4, P.velvet, 0.4, 0);
  // the big pink digging paws, held up in front of the belly like fists, clear of the face: four fat toes each (ink-split)
  const paw = (px: number, py: number) => {
    celPoly(g, c, [px - 10, py - 5, px + 4, py - 10, px + 14, py - 6, px + 16, py + 5, px + 8, py + 10, px - 6, py + 8], P.paw, 0.3, 0.25);
    g.fillStyle = INK; for (let i = 0; i < 3; i++) g.fillRect(R(px + 2 + i * 4), R(py + 3), 1, 6);
  };
  const lift = body === 'walk' || body === 'run' ? step : 0;
  if (sit) { paw(22, y0 + 20); paw(32, y0 + 14); } else { paw(28, y0 + 22 - lift); paw(40, y0 + 12 + lift); }
  // the face: the eye in its spectacles (a gold ring round it, its arm back to the ear), the brow, the mouth under the snout
  const f: FaceAt = { ex: 38, ey: y0 - 24, er: 4, bw: 11, mx: 46, my: y0 - 5 };
  // the pale muzzle under the snout, where the mouth is (ink alone on the velvet would not show)
  g.beginPath(); g.ellipse(46, y0 - 5, 9, 6, 0, 0, TAU); celPath(g, c, P.belly, 46, y0 - 5, 9, 0.3, 0);
  g.fillStyle = INK; g.fillRect(16, R(y0 - 26), 14, 4);
  g.fillStyle = c.col(P.rim); g.fillRect(17, R(y0 - 25), 12, 2);
  g.beginPath(); g.arc(f.ex, f.ey, 9, 0, TAU); g.strokeStyle = INK; g.lineWidth = 4; g.stroke();
  g.beginPath(); g.arc(f.ex, f.ey, 9, 0, TAU); g.strokeStyle = c.col(P.rim); g.lineWidth = 2; g.stroke();
  drawFace(g, f, face, c.col(P.velvet), P.belly);
  // the tiny crown, a jewel on its front
  const cx = 28, cy = y0 - 40;
  celPoly(g, c, [cx - 10, cy + 4, cx - 10, cy - 6, cx - 5, cy - 1, cx, cy - 9, cx + 5, cy - 1, cx + 10, cy - 6, cx + 10, cy + 4], P.crown, 0.3, 0.3);
  g.fillStyle = INK; g.fillRect(cx - 2, cy - 1, 5, 4); g.fillStyle = c.col(P.jewel); g.fillRect(cx - 1, cy, 3, 2);
}

/** THE BRIAR BOAR, facing +x, feet on y 0: a huge dark boar, a bristling ridge down its back, bramble wound round it, tusks by its snout. */
function briarBoar(g: CanvasRenderingContext2D, c: Cel, face: BaddieFace, body: Body, t: number): void {
  const P = BADDIE_ART.briarboar.palette, sit = body === 'sit', { bob, step } = gait(body, t);
  const drop = sit ? 12 : 0, y0 = -46 + drop + bob;
  // the far legs, hind and front (sat down: folded under)
  if (!sit) { celRect(g, c, -44 + step * 4, -26 + bob, 12, 26, 4, P.hide, 0.45, 0); celRect(g, c, 18 - step * 4, -26 + bob, 12, 26, 4, P.hide, 0.45, 0); }
  // the tail, a little curl off the rump
  celTaper(g, c, -58, y0 - 8, -68, y0 - 18, 3, 2, P.hide, 0);
  // the bristle ridge along its back, dark spikes over the hump, their roots under the body
  for (let i = 0; i < 9; i++) {
    const u = i / 8, bx = -48 + u * 70, by = y0 - 22 - Math.sin(u * Math.PI) * 18 - (u > 0.5 ? (u - 0.5) * 16 : 0);
    celPoly(g, c, [bx - 6, by + 8, bx - 1, by - 8, bx + 5, by + 8], P.bristle, 0.3, 0);
  }
  // the body: a great barrel, the shoulders humped high
  g.beginPath(); g.ellipse(-10, y0, 50, 30, 0, 0, TAU); g.moveTo(42, y0 - 14); g.arc(14, y0 - 14, 28, 0, TAU);
  celPath(g, c, P.hide, -4, y0 - 6, 54, 0.3, 0.25);
  // the bramble wound round it: two vines across the flank, thorns and berries on them (inside the body's outline)
  g.save(); g.beginPath(); g.ellipse(-10, y0, 48, 28, 0, 0, TAU); g.clip();
  for (const [a, b, cc] of [[-50, 18, -20], [-30, 26, 6]] as const) {
    g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.moveTo(a, y0 - 30); g.quadraticCurveTo(cc, y0 + 6, b, y0 + 30); g.stroke();
    g.strokeStyle = c.col(P.vine); g.lineWidth = 3; g.stroke();
  }
  g.restore();
  for (const [bx, by] of [[-38, -8], [-24, 10], [-12, -4], [2, 18]] as const) { g.fillStyle = INK; g.fillRect(bx - 1, y0 + by - 1, 5, 5); g.fillStyle = c.col(P.berry); g.fillRect(bx, y0 + by, 3, 3); }
  // the near legs (sat down: the front one braced out)
  if (!sit) { celRect(g, c, -30 - step * 4, -26 + bob, 13, 26, 4, P.hide, 0.4, 0); celRect(g, c, 30 + step * 4, -26 + bob, 13, 26, 4, P.hide, 0.4, 0); }
  else celRect(g, c, 26, -14, 30, 14, 5, P.hide, 0.4, 0);
  // the head: a great wedge down and forward from the shoulders, the snout's disk at its tip
  celPoly(g, c, [28, y0 - 34, 52, y0 - 24, 70, y0 - 6, 72, y0 + 10, 60, y0 + 18, 38, y0 + 14, 24, y0 - 4], P.hide, 0.3, 0.25);
  // the ear, up and back off the crown
  celPoly(g, c, [34, y0 - 30, 30, y0 - 46, 44, y0 - 30], P.hide, 0.3, 0);
  // the snout's pink disk, inset in the tip; the tusk curving up beside it, both inside the head's outline
  celRect(g, c, 60, y0 - 2, 10, 14, 4, P.snout, 0.3, 0);
  g.fillStyle = INK; g.fillRect(64, y0 + 3, 2, 2); g.fillRect(64, y0 + 7, 2, 2);
  celPoly(g, c, [50, y0 + 12, 58, y0 + 12, 60, y0 - 2, 56, y0 - 8, 56, y0 + 6], P.tusk, 0.2, 0);
  drawFace(g, { ex: 46, ey: y0 - 12, er: 3.5, bw: 12, mx: 50, my: y0 + 16 }, face, c.col(P.hide), P.bristle);
}

/** THE STORM ROC, facing +x: a fluffy slate-blue bird, folded wings, a tufted crest, a hooked beak. */
function stormRoc(g: CanvasRenderingContext2D, c: Cel, face: BaddieFace, body: Body, t: number): void {
  const P = BADDIE_ART.stormroc.palette, sit = body === 'sit', { bob, step } = gait(body, t);
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
  g.beginPath(); g.ellipse(0, y0, 50, 36, 0, 0, TAU);
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
  drawFace(g, { ex: hx + 7, ey: hy - 4, er: 4, bw: 12, mx: hx + 18, my: hy + 10 }, face, c.col(P.body), P.wing);
}

/** THE FROST GIANT, facing +x: a tall woolly snow giant, a knitted scarf, a big red nose, mittens and boots. */
function frostGiant(g: CanvasRenderingContext2D, c: Cel, face: BaddieFace, body: Body, t: number): void {
  const P = BADDIE_ART.frostgiant.palette, sit = body === 'sit', { bob, step } = gait(body, t);
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
  g.beginPath(); g.ellipse(0, y0, 38, ry, 0, 0, TAU);
  for (const [lx, ly, r] of [[-36, y0 - 18, 9], [-38, y0 + 10, 9], [36, y0 - 20, 9], [38, y0 + 8, 9], [28, y0 + ry - 10, 9], [-28, y0 + ry - 8, 9], [hx - 16, hy - 12, 9], [hx - 2, hy - 20, 9], [hx + 12, hy - 16, 8]] as const) { g.moveTo(lx + r, ly); g.arc(lx, ly, r, 0, TAU); }
  g.moveTo(hx + 26, hy); g.ellipse(hx, hy, 26, 22, 0, 0, TAU);
  celPath(g, c, P.wool, 0, y0 - 10, 52, 0.3, 0.25);
  // wool curls: little 2 px ink hooks over the fleece
  g.fillStyle = INK; for (const [sx, sy] of [[-20, y0 - 6], [-6, y0 + 18], [-24, y0 + 24], [12, y0 + 28], [-14, hy - 4]] as const) { g.fillRect(sx, sy, 4, 1); g.fillRect(sx + 3, sy + 1, 1, 2); }
  // the face: a round patch at the head's front
  g.beginPath(); g.ellipse(hx + 14, hy + 2, 15, 15, 0, 0, TAU);
  celPath(g, c, P.face, hx + 14, hy + 2, 15, 0.3, 0);
  drawFace(g, { ex: hx + 16, ey: hy - 3, er: 4, bw: 12, mx: hx + 17, my: hy + 11 }, face, c.col(P.face), P.wool);
  // the big red nose
  celBall(g, c, hx + 28, hy + 3, 6.5, P.nose);
  // the knitted scarf round the neck, one end hanging, knitted stripes
  celRect(g, c, hx - 24, hy + 18, 50, 11, 5, P.scarf, 0.4, 0);
  celRect(g, c, hx - 18, hy + 22, 11, 30, 3, P.scarf, 0.4, 0);
  g.fillStyle = INK; g.fillRect(hx - 19, hy + 35, 13, 5); g.fillRect(hx - 19, hy + 44, 13, 5);
  g.fillStyle = c.col(P.stripe); g.fillRect(hx - 18, hy + 36, 11, 3); g.fillRect(hx - 18, hy + 45, 11, 3);
  // the near arm, stubby, its mitten (sitting: resting on the knee)
  const sw = !sit && (body === 'walk' || body === 'run') ? step * 4 : 0;
  if (sit) { celTaper(g, c, 16, y0 - 18, 30, y0 + 10, 10, 8, P.wool, 0); celBall(g, c, 34, y0 + 14, 8, P.scarf); }
  else { celTaper(g, c, 16, y0 - 20, 24 + sw, y0 + 12, 10, 8, P.wool, 0); celBall(g, c, 26 + sw, y0 + 18, 8, P.scarf); }
}

/** THE CINDER GOLEM, facing +x: a hulk of dark basalt boulders, glowing seams across it, a glowing core in its chest, glowing eyes. */
function cinderGolem(g: CanvasRenderingContext2D, c: Cel, face: BaddieFace, body: Body, t: number): void {
  const P = BADDIE_ART.cindergolem.palette, sit = body === 'sit', { bob, step } = gait(body, t);
  const drop = sit ? 20 : 0, y0 = -70 + drop + bob;
  /** A glowing seam: a zig-zag, 4 px of ink round 2 px of glow. */
  const seam = (pts: readonly number[]) => {
    for (const [lw, col] of [[4, INK], [2, c.col(P.seam)]] as const) {
      g.strokeStyle = col; g.lineWidth = lw; g.lineJoin = 'miter'; g.lineCap = 'square';
      g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.stroke();
    }
  };
  // the far arm: a boulder shoulder and forearm, its fist near the ground
  celPoly(g, c, [-30, y0 - 34, -48, y0 - 28, -52, y0 + 6, -44, y0 + 26, -30, y0 + 20, -26, y0 - 10], P.rock, 0.35, 0);
  celBall(g, c, -46, y0 + 34 - drop / 2, 12, P.rock, false);
  // the legs, two blocky boulders (sat down: stuck out in front)
  if (!sit) { celRect(g, c, -24 + step * 5, -30 + bob, 20, 30, 5, P.rock, 0.4, 0); celRect(g, c, 4 - step * 5, -30 + bob, 21, 30, 5, P.rock, 0.4, 0); }
  else celRect(g, c, 6, -18, 40, 18, 6, P.rock, 0.4, 0);
  // the torso: a great irregular boulder, its lit facets, and the seams across it
  celPoly(g, c, [-36, y0 - 26, -12, y0 - 40, 22, y0 - 38, 40, y0 - 20, 38, y0 + 18, 22, y0 + 36, -20, y0 + 38, -38, y0 + 14], P.rock, 0.3, 0.25);
  celPoly(g, c, [-24, y0 - 28, -6, y0 - 34, 8, y0 - 26, -12, y0 - 18], P.facet, 0.3, 0);
  seam([-30, y0 + 8, -18, y0 - 2, -20, y0 + 14, -6, y0 + 24]);
  seam([26, y0 - 26, 16, y0 - 14, 28, y0 - 4]);
  // the core: a glowing diamond at the chest's heart
  g.fillStyle = INK; g.beginPath(); g.moveTo(8, y0 - 12); g.lineTo(18, y0); g.lineTo(8, y0 + 12); g.lineTo(-2, y0); g.closePath(); g.fill();
  g.fillStyle = c.col(P.seam); g.beginPath(); g.moveTo(8, y0 - 10); g.lineTo(16, y0); g.lineTo(8, y0 + 10); g.lineTo(0, y0); g.closePath(); g.fill();
  g.fillStyle = c.col(P.core); g.fillRect(6, y0 - 3, 4, 6);
  // the head: a smaller boulder sunk into the shoulders, the eye glowing under a rock brow
  const hx = 12, hy = y0 - 52;
  celPoly(g, c, [hx - 16, hy + 12, hx - 18, hy - 4, hx - 6, hy - 16, hx + 12, hy - 14, hx + 20, hy - 2, hx + 18, hy + 14], P.rock, 0.3, 0.25);
  drawFace(g, { ex: hx + 8, ey: hy - 2, er: 4, bw: 12, mx: hx + 10, my: hy + 9 }, face, c.col(P.rock), P.facet, P.core);
  // the near arm: a boulder shoulder, the forearm, a great fist
  celPoly(g, c, [18, y0 - 34, 40, y0 - 30, 46, y0 - 4, 40, y0 + 12, 26, y0 + 8, 20, y0 - 12], P.rock, 0.3, 0.2);
  seam([36, y0 - 22, 30, y0 - 10, 38, y0]);
  celBall(g, c, 42, y0 + 20 - drop / 2, 13, P.rock, true);
  g.fillStyle = INK; for (let i = 0; i < 3; i++) g.fillRect(38 + i * 4, R(y0 + 16 - drop / 2), 1, 8);
}

const DRAW: Readonly<Record<BaddieId, (g: CanvasRenderingContext2D, c: Cel, face: BaddieFace, body: Body, t: number) => void>> = {
  bridgetroll: bridgeTroll, moleking: moleKing, briarboar: briarBoar, stormroc: stormRoc, frostgiant: frostGiant, cindergolem: cinderGolem,
};

/**
 * Draw a boss standing on the road: (x, feetY) the middle of its feet, facing +1 (right) or -1 (toward a team coming
 * from the left), its face and pose, `t` the scene's step (the walk's bob and stride, a run's dust, the knocked-down
 * stars), `flash` a hit just landed (its fills flat and pale inside its ink). The pose's lean pivots on its feet: an
 * attack rears it forward into its lunge, a hit rocks it back, down it sits back hard with the stars over its head.
 */
export function drawBaddie(ctx: CanvasRenderingContext2D, id: BaddieId, x: number, feetY: number, facing: 1 | -1, face: BaddieFace, pose: BaddiePose, t: number, flash = false): void {
  const g = ctx, B = BADDIE_ART[id];
  g.save();
  g.translate(R(x), R(feetY));
  // the ground shadow (the ink at the house's 0.28, a flat ellipse under the feet)
  g.fillStyle = 'rgba(26,16,24,0.28)'; g.beginPath(); g.ellipse(0, 0, B.w * 0.36, 3, 0, 0, TAU); g.fill();
  if (pose === 'flee') dust(g, -facing * B.w * 0.3, t);
  g.scale(facing, 1);
  if (pose === 'attack') { g.translate(10, 0); g.rotate(0.12); } else if (pose === 'hit') { g.translate(-6, 0); g.rotate(-0.08); } else if (pose === 'down') g.rotate(-0.05);
  const body: Body = pose === 'walk' ? 'walk' : pose === 'flee' ? 'run' : pose === 'down' ? 'sit' : 'stand';
  DRAW[id](g, celTarget(facing, flash ? HIT_FLASH : null, flash ? INK : null), pose === 'hit' ? 'hurt' : pose === 'down' ? 'dazed' : face, body, t);
  g.restore();
  if (pose === 'down') drawStars(g, R(x) + facing * B.head[0], R(feetY) + B.head[1] + B.drop, t);
}

/**
 * A boss's 24 x 24 portrait (the Map Room chooser's boss row: BASE_DESIGN 5): its own small drawing -- the head and its
 * tell (the troll's nose and tusk, the crown and spectacles, the boar's snout and tusk, the crest and beak, the woolly
 * dome, the nose and scarf, the golem's glowing eye and seam) -- in an inked frame, top-left at (x, y).
 */
export function drawBaddiePortrait(ctx: CanvasRenderingContext2D, id: BaddieId, x: number, y: number): void {
  const g = ctx, X = R(x), Y = R(y), c = celTarget(1), P = BADDIE_ART[id].palette;
  g.save();
  g.fillStyle = INK; g.fillRect(X, Y, 24, 24);
  g.fillStyle = '#e8e0cc'; g.fillRect(X + 1, Y + 1, 22, 22);
  g.beginPath(); g.rect(X + 1, Y + 1, 22, 22); g.clip();
  if (id === 'bridgetroll') {
    celPoly(g, c, [X + 4, Y + 8, X + 7, Y + 2, X + 10, Y + 7, X + 13, Y + 1, X + 16, Y + 7], P.moss, 0.3, 0);
    celBall(g, c, X + 11, Y + 14, 9, P.skin);
    celTaper(g, c, X + 16, Y + 11, X + 23, Y + 20, 3, 2.5, P.skin, 0.3);
    g.fillStyle = INK; g.fillRect(X + 12, Y + 9, 5, 4); g.fillStyle = WHITE; g.fillRect(X + 13, Y + 10, 3, 2); g.fillStyle = PUPIL; g.fillRect(X + 15, Y + 10, 1, 2);
    g.fillStyle = INK; g.fillRect(X + 11, Y + 7, 7, 2);
    celPoly(g, c, [X + 13, Y + 21, X + 14, Y + 16, X + 16, Y + 21], P.tusk, 0.2, 0);
  } else if (id === 'moleking') {
    celBall(g, c, X + 11, Y + 17, 10, P.velvet);
    celPoly(g, c, [X + 18, Y + 12, X + 24, Y + 15, X + 18, Y + 18], P.velvet, 0.3, 0);
    celBall(g, c, X + 22, Y + 15, 2.5, P.paw, false);
    celPoly(g, c, [X + 5, Y + 8, X + 5, Y + 3, X + 8, Y + 5, X + 10, Y + 1, X + 12, Y + 5, X + 15, Y + 3, X + 15, Y + 8], P.crown, 0.3, 0);
    g.beginPath(); g.arc(X + 15, Y + 13, 4, 0, TAU); g.strokeStyle = INK; g.lineWidth = 3; g.stroke(); g.strokeStyle = P.rim; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = WHITE; g.fillRect(X + 14, Y + 12, 3, 2); g.fillStyle = PUPIL; g.fillRect(X + 15, Y + 12, 2, 2);
  } else if (id === 'briarboar') {
    for (let i = 0; i < 3; i++) celPoly(g, c, [X + 2 + i * 4, Y + 9, X + 4 + i * 4, Y + 1, X + 7 + i * 4, Y + 9], P.bristle, 0.3, 0);
    celPoly(g, c, [X + 2, Y + 8, X + 14, Y + 6, X + 22, Y + 12, X + 23, Y + 20, X + 14, Y + 24, X + 2, Y + 22], P.hide, 0.3, 0.25);
    celRect(g, c, X + 18, Y + 12, 5, 8, 2, P.snout, 0.3, 0);
    celPoly(g, c, [X + 14, Y + 22, X + 17, Y + 22, X + 18, Y + 13, X + 16, Y + 16], P.tusk, 0.2, 0);
    g.fillStyle = INK; g.fillRect(X + 10, Y + 10, 5, 4); g.fillStyle = WHITE; g.fillRect(X + 11, Y + 11, 3, 2); g.fillStyle = PUPIL; g.fillRect(X + 13, Y + 11, 1, 2);
  } else if (id === 'stormroc') {
    celTaper(g, c, X + 8, Y + 9, X + 2, Y + 3, 2.5, 1, P.body);
    celTaper(g, c, X + 10, Y + 8, X + 6, Y + 1, 2.5, 1, P.body);
    celBall(g, c, X + 11, Y + 14, 9, P.body);
    celPoly(g, c, [X + 17, Y + 11, X + 24, Y + 12, X + 24, Y + 17, X + 21, Y + 18, X + 21, Y + 15, X + 17, Y + 16], P.beak, 0.3, 0);
    g.fillStyle = INK; g.fillRect(X + 12, Y + 10, 5, 5); g.fillStyle = WHITE; g.fillRect(X + 13, Y + 11, 3, 3); g.fillStyle = PUPIL; g.fillRect(X + 14, Y + 12, 2, 2);
  } else if (id === 'frostgiant') {
    celBall(g, c, X + 11, Y + 11, 10, P.wool);
    celPoly(g, c, [X + 11, Y + 6, X + 21, Y + 6, X + 23, Y + 13, X + 18, Y + 17, X + 12, Y + 15], P.face, 0.3, 0);
    celBall(g, c, X + 21, Y + 12, 3, P.nose, false);
    g.fillStyle = INK; g.fillRect(X + 15, Y + 8, 4, 4); g.fillStyle = WHITE; g.fillRect(X + 16, Y + 9, 2, 2);
    celRect(g, c, X + 2, Y + 18, 20, 5, 2, P.scarf, 0.3, 0);
    g.fillStyle = P.stripe; g.fillRect(X + 8, Y + 19, 2, 3); g.fillRect(X + 14, Y + 19, 2, 3);
  } else {
    celPoly(g, c, [X + 2, Y + 22, X + 1, Y + 8, X + 8, Y + 2, X + 18, Y + 3, X + 23, Y + 10, X + 22, Y + 22], P.rock, 0.3, 0.25);
    g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.moveTo(X + 4, Y + 18); g.lineTo(X + 8, Y + 14); g.lineTo(X + 7, Y + 21); g.stroke();
    g.strokeStyle = P.seam; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = INK; g.fillRect(X + 12, Y + 8, 7, 5); g.fillStyle = P.core; g.fillRect(X + 13, Y + 9, 5, 3); g.fillStyle = PUPIL; g.fillRect(X + 16, Y + 9, 2, 3);
    g.fillStyle = INK; g.fillRect(X + 11, Y + 6, 9, 2);
  }
  g.restore();
}
