// The little enemies (ART_BIBLE 5.10; BASE_DESIGN 5.3, 6: their fights in missionview.ts): a pack of them fights the
// team between the challenges of every road of their region -- MUD GOBLINS (Millbrook), MOLE MINERS (Old Mine Road),
// THORN SPRITES (Bramblewood), STORM IMPS (Highfold), FROST IMPS (Frostmere) and CINDER IMPS (Emberfell) -- each 20 to
// 26 px, a third of a keeper's height, drawn in the house style from the engine's cel helpers (cel.ts: a 1 px #1a1018
// ink, flat bands lit from the top left, no gradients, no alpha, no mark under 2 px) and seen in three quarters, both
// eyes showing.
//
// Each reads by its region's tell at a glance: the goblin's long ears, the miner's helmet and its lamp, the sprite's
// thorns, the imp's storm cloud of three puffs (it floats a little over the road) and the bolt on its belly, the frost imp's icicle
// crown, the cinder imp's charcoal crest glowing inside. Their faces are the enemies' (missiondata.ts BaddieFace):
// fierce (V brows slanted down onto the eyes, a scowl and a fang), hurt (the eyes screwed shut, an "o" mouth); a beaten
// one goes up in a puff of smoke (fightfx.ts drawPoof), never hurt. Poses: walk (scurrying in), stand, attack (a hop at
// the team, leaning in) and hit (knocked back, leaning away).
//
// Gate (x) (tools/palette-check.ts): every fill on a foe's silhouette edge (FOE_EDGE) keeps >= 25 % luminance from the
// road, the scene's ground and every band of its home climate at every phase, and >= 6 Oklab L from the ink, as a big
// baddie's does -- which leaves them dark (L <= 0.125) everywhere, or mid (L 0.36-0.46) in the caves, the peaks and
// the ice; their bright parts (eyes, the bolt, the glow) lie inside the silhouette, where the ladder holds them (FOE_PAIRS).
import { celPath, celPoly, celBall, celRect, celTaper } from '../lib/art/shading.ts';
import { INK } from './surfaces.ts';
import { celTarget, HIT_FLASH } from './cel.ts';
import type { Cel } from './cel.ts';
import type { FoeId, FoePose, BaddieFace, Climate } from './missiondata.ts';
import { REGIONS } from './regions.ts';

/** A foe's art record: its size (px, the drawing's bounding box), its colours, and where a hit lands and its throw leaves (drawing space: facing +x, feet at 0). */
export interface Foe { id: FoeId; w: number; h: number; palette: Readonly<Record<string, string>>; hitAt: readonly [number, number]; throwAt: readonly [number, number] }

/** The shared eye colours: the whites and pupils (the keepers' and dragons' own), and a glowing eye's. */
const WHITE = '#f8f4ec', PUPIL = '#1a1418', GLOW = '#ffd24a';

export const FOE_ART: Readonly<Record<FoeId, Foe>> = Object.freeze({
  mudgoblin: Object.freeze<Foe>({ id: 'mudgoblin', w: 28, h: 24, hitAt: [1, -13], throwAt: [8, -12],
    palette: Object.freeze({ skin: '#46562e', tunic: '#4a3a28', belt: '#a07a4a' }) }),
  moleminer: Object.freeze<Foe>({ id: 'moleminer', w: 30, h: 24, hitAt: [0, -10], throwAt: [10, -12],
    palette: Object.freeze({ velvet: '#5e4238', helmet: '#d8a838', paw: '#e8969c', handle: '#4a3426', pick: '#a8a8b4', lamp: '#fff2a8' }) }),
  thornsprite: Object.freeze<Foe>({ id: 'thornsprite', w: 24, h: 24, hitAt: [0, -12], throwAt: [8, -12],
    palette: Object.freeze({ bramble: '#2e3a24', thorn: '#72403a', vine: '#6a8a4a' }) }),
  stormimp: Object.freeze<Foe>({ id: 'stormimp', w: 26, h: 29, hitAt: [0, -17], throwAt: [9, -18],
    palette: Object.freeze({ cloud: '#3e4660', bolt: '#ffe45a', puff: '#7a86a8' }) }),
  frostimp: Object.freeze<Foe>({ id: 'frostimp', w: 22, h: 26, hitAt: [0, -11], throwAt: [8, -12],
    palette: Object.freeze({ ice: '#8eaecb', icicle: '#9ab8d4', boot: '#2e3a5a', frost: '#e8f4fc' }) }),
  cinderimp: Object.freeze<Foe>({ id: 'cinderimp', w: 22, h: 26, hitAt: [0, -10], throwAt: [8, -11],
    palette: Object.freeze({ char: '#2e2a2c', glow: '#f08a2e', core: '#ffd24a' }) }),
});

/** Where each foe lives (its region's climate: the backdrop gate x holds it against), read off the regions' own table. */
export const FOE_HOME: Readonly<Record<FoeId, Climate>> = Object.freeze(Object.fromEntries(REGIONS.map((r) => [r.foe, r.climate] as const)) as Record<FoeId, Climate>);
/** The palette keys on each foe's silhouette edge (gate x); the rest lie inside it. */
export const FOE_EDGE: Readonly<Record<FoeId, readonly string[]>> = Object.freeze({
  mudgoblin: ['skin', 'tunic'],
  moleminer: ['velvet', 'helmet', 'paw', 'handle', 'pick'],
  thornsprite: ['bramble', 'thorn'],
  stormimp: ['cloud'],
  frostimp: ['ice', 'icicle', 'boot'],
  cinderimp: ['char'],
});
/** The pairs of colours that touch inside each foe (the house ladder, gate x), with where. */
export const FOE_PAIRS: Readonly<Record<FoeId, readonly (readonly [string, string, string])[]>> = Object.freeze({
  mudgoblin: [['skin', 'tunic', 'the tunic under the head'], ['tunic', 'belt', 'the belt on the tunic'], ['skin', 'white', 'the eyes on the face']],
  moleminer: [['velvet', 'helmet', 'the helmet on the head'], ['velvet', 'paw', 'the paws and nose on the body'], ['helmet', 'lamp', 'the lamp on the helmet'], ['velvet', 'white', 'the eyes on the face'], ['paw', 'handle', 'the pick in the paw']],
  thornsprite: [['bramble', 'thorn', 'the thorns on the ball'], ['bramble', 'vine', 'the vines round the ball'], ['bramble', 'glow', 'the glowing eyes']],
  stormimp: [['cloud', 'bolt', 'the bolt on its belly'], ['cloud', 'puff', 'the pale tops of its puffs'], ['cloud', 'white', 'the eyes on the face']],
  frostimp: [['ice', 'boot', 'the boots under the body'], ['ice', 'frost', 'the frost on the cheeks'], ['icicle', 'boot', 'the crown over the dark brim'], ['ice', 'white', 'the eyes on the face']],
  cinderimp: [['char', 'glow', 'the glowing cracks'], ['glow', 'core', 'the glow at the crest\'s heart'], ['char', 'core', 'the glowing eyes']],
});
/** The eye whites and a glowing eye's colour, for the pairs above. */
export const FOE_WHITE = WHITE, FOE_GLOW = GLOW;
/** The fills the watchable scene sees a foe by (its edge fills), for gate (x). */
export const FOE_FILLS: Readonly<Record<FoeId, readonly string[]>> = Object.freeze(Object.fromEntries(
  (Object.keys(FOE_EDGE) as FoeId[]).map((id) => [id, Object.freeze([...new Set(FOE_EDGE[id].map((k) => FOE_ART[id].palette[k]))])]),
) as Record<FoeId, readonly string[]>);

const R = Math.round, TAU = Math.PI * 2;

// ---------- the face ----------

/**
 * A foe's eyes (three quarters: the near one's middle at (ex, ey), the far one `gap` px behind it) and mouth at (mx, my),
 * facing +x. fierce: each eye 4 x 3 inside its ink, the pupil 2 x 2 at its front, and a 2 px brow slanting down onto
 * it toward the face's middle (the two make a V, and lid the eyes' inner tops); a scowl with a 2 x 2 fang. hurt: the
 * eyes screwed shut (a ">" and a "<"), an "o" mouth. dazed: an "x" each, a wavy mouth. `eye`: the whites, or a glow.
 */
function foeFace(g: CanvasRenderingContext2D, ex: number, ey: number, gap: number, face: BaddieFace, mx: number, my: number, eye = WHITE): void {
  const xs = [ex - gap, ex];
  g.fillStyle = INK;
  if (face === 'fierce') {
    // each eye 4 x 3 inside its ink, the pupil 2 x 2 low at its front, the inner top corner lidded by the brow
    for (const [x, inner] of [[xs[0], 2], [xs[1], -1]] as const) {
      g.fillStyle = INK; g.fillRect(x - 2, ey - 2, 6, 5);
      g.fillStyle = eye; g.fillRect(x - 1, ey - 1, 4, 3);
      g.fillStyle = INK; g.fillRect(x + inner, ey - 1, 1, 1);
      g.fillStyle = PUPIL; g.fillRect(x + 1, ey, 2, 2);
    }
    // the brows, 2 px strokes: the far one down to the right, the near one down to the left -- a V over the eyes
    g.fillStyle = INK;
    for (let i = 0; i < 3; i++) { g.fillRect(xs[0] - 2 + 2 * i, ey - 4 + i, 2, 2); g.fillRect(xs[1] + 2 - 2 * i, ey - 4 + i, 2, 2); }
    // the scowl and its fang
    g.fillRect(mx - 3, my, 6, 1); g.fillRect(mx - 4, my + 1, 1, 1); g.fillRect(mx + 3, my + 1, 1, 1);
    g.fillRect(mx - 1, my + 1, 4, 3); g.fillStyle = WHITE; g.fillRect(mx, my + 1, 2, 2);
  } else if (face === 'hurt') {
    // screwed shut: ">" (far) and "<" (near), each 3 wide and 5 tall, in ink
    for (const [x, d] of [[xs[0], 1], [xs[1], -1]] as const) {
      const x0 = d > 0 ? x - 1 : x + 1;
      g.fillRect(x0, ey - 2, 1, 1); g.fillRect(x0 + d, ey - 1, 1, 1); g.fillRect(x0 + 2 * d, ey, 1, 1); g.fillRect(x0 + d, ey + 1, 1, 1); g.fillRect(x0, ey + 2, 1, 1);
    }
    g.fillRect(mx - 1, my, 4, 4); g.fillStyle = '#8a2a3a'; g.fillRect(mx, my + 1, 2, 2);
  } else {
    for (const x of xs) { g.fillRect(x - 1, ey - 1, 1, 1); g.fillRect(x + 1, ey - 1, 1, 1); g.fillRect(x, ey, 1, 1); g.fillRect(x - 1, ey + 1, 1, 1); g.fillRect(x + 1, ey + 1, 1, 1); }
    for (let i = 0; i < 6; i++) g.fillRect(mx - 3 + i, my + (i % 2), 1, 1);
  }
}

// ---------- the pose's motion ----------

/** A scurry's bob and stride (stepped every 5 frames): a walk bobs and steps, anything else stands. */
function gait(pose: FoePose, t: number): { bob: number; step: number } {
  if (pose !== 'walk') return { bob: 0, step: 0 };
  const k = Math.floor(t / 5) % 4;
  return { bob: [0, -1, 0, -1][k], step: [1, 0, -1, 0][k] };
}

// ---------- the six ----------

/** MUD GOBLIN, facing +x: a squat mossy goblin, a big round head with long pointed ears, a hooked nose, a tunic and a belt. */
function mudGoblin(g: CanvasRenderingContext2D, c: Cel, face: BaddieFace, pose: FoePose, t: number): void {
  const P = FOE_ART.mudgoblin.palette, { bob, step } = gait(pose, t), y = bob;
  celRect(g, c, -6 + step, -6, 5, 6, 2, P.skin, 0.4, 0);
  // the far ear, back and up behind the head
  celPoly(g, c, [-3, y - 18, -14, y - 25, -6, y - 13], P.skin, 0.4, 0);
  // the body in its tunic, the belt across it
  g.beginPath(); g.ellipse(-1, y - 8, 7, 6, 0, 0, TAU); celPath(g, c, P.tunic, -1, y - 8, 7, 0.35, 0);
  g.fillStyle = INK; g.fillRect(-8, y - 8, 14, 4); g.fillStyle = c.col(P.belt); g.fillRect(-7, y - 7, 12, 2);
  celRect(g, c, 1 - step, -6, 5, 6, 2, P.skin, 0.4, 0);
  // the head, big and round, the hooked nose at its front
  g.beginPath(); g.ellipse(1, y - 16, 9, 7.5, 0, 0, TAU); celPath(g, c, P.skin, 1, y - 16, 9, 0.35, 0.3);
  celPoly(g, c, [8, y - 18, 14, y - 14, 12, y - 12, 8, y - 13], P.skin, 0.3, 0);
  // the near ear, out over the back of the head
  celPoly(g, c, [-1, y - 19, -11, y - 29, -3, y - 14], P.skin, 0.4, 0.25);
  foeFace(g, 5, y - 18, 5, face, 5, y - 12);
}

/** MOLE MINER, facing +x: a little velvet mole in a yellow miner's helmet with its lamp lit, pink digging paws and a pick. */
function moleMiner(g: CanvasRenderingContext2D, c: Cel, face: BaddieFace, pose: FoePose, t: number): void {
  const P = FOE_ART.moleminer.palette, { bob, step } = gait(pose, t), y = bob;
  celRect(g, c, -8 + step, -4, 6, 4, 2, P.velvet, 0.4, 0);
  // the body, round velvet, the snout tapering out of it with the pink nose
  g.beginPath(); g.ellipse(-1, y - 9, 10, 8, 0, 0, TAU);
  g.moveTo(6, y - 13); g.quadraticCurveTo(14, y - 12, 15, y - 8); g.quadraticCurveTo(12, y - 5, 6, y - 5); g.closePath();
  celPath(g, c, P.velvet, 0, y - 9, 11, 0.35, 0.3);
  celBall(g, c, 15, y - 9, 2.5, P.paw, false);
  celRect(g, c, 1 - step, -4, 6, 4, 2, P.velvet, 0.4, 0);
  // the helmet: a yellow dome with a brim, the lamp lit on its front
  g.beginPath(); g.ellipse(0, y - 15, 8, 6.5, 0, Math.PI, 0); g.closePath(); celPath(g, c, P.helmet, 0, y - 18, 8, 0.3, 0.3);
  celRect(g, c, -9, y - 16, 19, 3, 1, P.helmet, 0.3, 0);
  g.fillStyle = INK; g.fillRect(4, y - 22, 5, 5); g.fillStyle = c.col(P.lamp); g.fillRect(5, y - 21, 3, 3);
  foeFace(g, 6, y - 12, 5, face, 10, y - 7);
  // the pick held up in the near paw: its handle, its head, and the paw round it
  celTaper(g, c, 6, y - 3, 14, y - 19, 1.5, 1.5, P.handle, 0);
  celPoly(g, c, [9, y - 21, 14, y - 23, 20, y - 20, 14, y - 19], P.pick, 0.3, 0);
  celBall(g, c, 9, y - 6, 3.5, P.paw, false);
}

/** THORN SPRITE, facing +x: a ball of bramble bristling with thorns on two twig legs, a vine round it, its eyes glowing. */
function thornSprite(g: CanvasRenderingContext2D, c: Cel, face: BaddieFace, pose: FoePose, t: number): void {
  const P = FOE_ART.thornsprite.palette, { bob, step } = gait(pose, t), y = bob, cy = y - 12;
  // the twig legs
  g.fillStyle = INK; g.fillRect(-4 + step, cy + 5, 4, 8); g.fillRect(2 - step, cy + 5, 4, 8);
  g.fillStyle = c.col(P.thorn); g.fillRect(-3 + step, cy + 6, 2, 6); g.fillRect(3 - step, cy + 6, 2, 6);
  // the thorns round the ball, then the ball over their roots
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + 0.3, ca = Math.cos(a), sa = Math.sin(a);
    if (sa > 0.55) continue;
    celPoly(g, c, [R(ca * 6 - sa * 3), R(cy + sa * 6 + ca * 3), R(ca * 13), R(cy + sa * 13), R(ca * 6 + sa * 3), R(cy + sa * 6 - ca * 3)], P.thorn, 0.3, 0);
  }
  celBall(g, c, 0, cy, 8.5, P.bramble);
  // a vine wound round it
  g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); g.arc(-1, cy + 1, 6, 2.3, 4.2); g.stroke();
  g.strokeStyle = c.col(P.vine); g.lineWidth = 2; g.stroke();
  foeFace(g, 4, cy - 1, 5, face, 3, cy + 4, GLOW);
}

/** STORM IMP, facing +x: a little dark storm cloud of three puffs floating over the road, a bolt on its belly, a scowl on its front puff. */
function stormImp(g: CanvasRenderingContext2D, c: Cel, face: BaddieFace, pose: FoePose, t: number): void {
  const P = FOE_ART.stormimp.palette, float = (pose === 'walk' ? Math.floor(t / 6) % 2 : 0) + 5, y = -float;
  // the puffs, back to front, each its own inked ball so the cloud reads as puffs; a flat underside under them
  celRect(g, c, -11, y - 11, 23, 6, 3, P.cloud, 0.45, 0);
  for (const [x, yy, r] of [[-7, -12, 6], [7, -12, 6.5], [0, -16, 8]] as const) celBall(g, c, x, y + yy, r, P.cloud);
  // the puffs' pale tops
  g.fillStyle = c.col(P.puff); g.fillRect(-9, y - 17, 3, 2); g.fillRect(-3, y - 22, 4, 2); g.fillRect(6, y - 17, 3, 2);
  // the bolt on its belly: a zig-zag, 2 px of glow inside its ink
  g.fillStyle = INK; g.fillRect(-6, y - 10, 5, 3); g.fillRect(-4, y - 8, 5, 3);
  g.fillStyle = c.col(P.bolt); g.fillRect(-5, y - 9, 3, 1); g.fillRect(-3, y - 7, 3, 1); g.fillRect(-4, y - 8, 2, 1);
  foeFace(g, 5, y - 15, 5, face, 5, y - 10);
}

/** FROST IMP, facing +x: a small ice-blue body in dark boots, a crown of three icicles, frost on its cheeks. */
function frostImp(g: CanvasRenderingContext2D, c: Cel, face: BaddieFace, pose: FoePose, t: number): void {
  const P = FOE_ART.frostimp.palette, { bob, step } = gait(pose, t), y = bob;
  celRect(g, c, -6 + step, -5, 5, 5, 2, P.boot, 0.4, 0);
  // the icicle crown, its roots under the head's top
  for (const [x, h] of [[-5, 7], [0, 10], [5, 7]] as const) celPoly(g, c, [x - 3, y - 17, x, y - 17 - h, x + 3, y - 17], P.icicle, 0.3, 0.3);
  // the body: an egg, the head its top
  g.beginPath(); g.ellipse(0, y - 11, 8.5, 9.5, 0, 0, TAU); celPath(g, c, P.ice, 0, y - 11, 9.5, 0.35, 0.3);
  celRect(g, c, 1 - step, -5, 5, 5, 2, P.boot, 0.4, 0);
  g.fillStyle = INK; g.fillRect(5, y - 9, 4, 3); g.fillStyle = c.col(P.frost); g.fillRect(6, y - 8, 2, 1);
  foeFace(g, 4, y - 13, 5, face, 4, y - 7);
}

/** CINDER IMP, facing +x: a round charcoal body cracked with glowing seams, a charcoal crest glowing at its heart, glowing eyes. */
function cinderImp(g: CanvasRenderingContext2D, c: Cel, face: BaddieFace, pose: FoePose, t: number): void {
  const P = FOE_ART.cinderimp.palette, { bob, step } = gait(pose, t), y = bob;
  celRect(g, c, -6 + step, -5, 5, 5, 2, P.char, 0.4, 0);
  // the crest: three charcoal tongues, the glow inside the middle one
  celPoly(g, c, [-7, y - 14, -6, y - 23, -2, y - 16, 0, y - 26, 3, y - 16, 6, y - 22, 7, y - 14], P.char, 0.3, 0);
  g.fillStyle = INK; g.fillRect(-1, y - 21, 3, 6); g.fillStyle = c.col(P.core); g.fillRect(0, y - 20, 1, 4);
  // the body, and the glowing seams across it
  celBall(g, c, 0, y - 10, 8.5, P.char);
  g.fillStyle = INK; g.fillRect(-7, y - 7, 6, 3); g.fillRect(-3, y - 5, 5, 3); g.fillRect(-6, y - 13, 3, 4);
  g.fillStyle = c.col(P.glow); g.fillRect(-6, y - 6, 4, 1); g.fillRect(-2, y - 4, 3, 1); g.fillRect(-5, y - 12, 1, 2);
  celRect(g, c, 1 - step, -5, 5, 5, 2, P.char, 0.4, 0);
  foeFace(g, 4, y - 12, 5, face, 4, y - 7, P.core);
}

const DRAW: Readonly<Record<FoeId, (g: CanvasRenderingContext2D, c: Cel, face: BaddieFace, pose: FoePose, t: number) => void>> = {
  mudgoblin: mudGoblin, moleminer: moleMiner, thornsprite: thornSprite, stormimp: stormImp, frostimp: frostImp, cinderimp: cinderImp,
};

/**
 * Draw a foe standing on the road: (x, feetY) the middle of its feet, facing +1 (right) or -1 (toward a team coming
 * from the left), its face and pose, `t` the scene's step (the scurry's bob and stride, the imp's float), `flash` a hit
 * just landed (its fills flat and pale inside its ink: cel.ts HIT_FLASH). An attack leans it in and lifts it in its
 * hop; a hit leans it back.
 */
export function drawFoe(ctx: CanvasRenderingContext2D, id: FoeId, x: number, feetY: number, facing: 1 | -1, face: BaddieFace, pose: FoePose, t: number, flash = false): void {
  const g = ctx, F = FOE_ART[id];
  g.save();
  g.translate(R(x), R(feetY));
  // the ground shadow (the ink at the house's 0.28), under the feet even as it hops
  g.fillStyle = 'rgba(26,16,24,0.28)'; g.beginPath(); g.ellipse(0, 0, F.w * 0.34, 2, 0, 0, TAU); g.fill();
  g.scale(facing, 1);
  if (pose === 'attack') { g.translate(2, -3); g.rotate(0.22); } else if (pose === 'hit') { g.translate(-3, 0); g.rotate(-0.3); }
  DRAW[id](g, celTarget(facing, flash ? HIT_FLASH : null, flash ? INK : null), pose === 'hit' ? 'hurt' : face, pose, t);
  g.restore();
}
