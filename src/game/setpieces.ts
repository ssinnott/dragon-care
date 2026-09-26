// The challenges met on the road (plan S9's set-piece table; S9a): one set piece per challenge, drawn on the road at
// road x `x` (its middle) with its foot on the feet line `feetY`, in the house style (the engine's cel helpers through
// cel.ts: a 1 px #1a1018 ink, flat bands lit from the top left, no gradients, no alpha, no mark under 2 px). Its
// `state`: `ahead` (the problem, as the team walks up), `met` (the problem visibly solved by its counter) or `unmet`
// (nobody could help: the problem stays, drawn as ahead). `t` is the scene's step: small stepped motions only (the
// fog's drift, the water's ripples, the mill's sails, the bird's hop), so a frozen frame is the same every time.
// The scene draws the set pieces before the team, so each stands behind the dragons and riders -- the fog bank above
// all, in stepped flat bands BEHIND the team (never over a dragon or an eye).
//
//   dark    a cave mouth in a rock face; met: a lantern at its side and one stepped pool of its light on the road
//   heavy   a boulder across the road beside an empty cart; met: the boulder loaded in the cart
//   cold    a snowdrift across the road; met: melted to a low heap and a puddle, two steam puffs rising
//   storm   a storm cloud with 3 px bolts over the road; met: a small white cloud and the sun
//   flood   a ford over the road, the stepping stones under water; met: the water down, the stones showing
//   thorns  a bramble arch, a tangle of it across the road; met: the tangle pulled aside, the arch in flower
//   lost    a signpost fork, one board hanging, a "?"; met: the boards straight and the lost bundle found at its foot
//   miller  the mill, its sails still and its door shut; met: the sails turning and the door open, a flour sack out
//   hurt    a small bird on a tussock that can't fly, one wing held out; met: the wing in a neat bandage, hopping, a heart
//   fog     a fog bank in stepped flat bands; met: thinned to a low band, a waymark post showing the way
//   gap     two tall rocks with a narrow way between; met: a knotted rope over the gap and a flag on top
import { celPoly, celBall, celRect, celCapsule } from '../lib/art/shading.ts';
import { mix } from '../lib/art/palettes.ts';
import { drawSprite, ICONS } from './icons.ts';
import { INK, CAVE } from './surfaces.ts';
import { celTarget } from './cel.ts';
import type { ChallengeId, StopState } from './missiondata.ts';

/** The set pieces' own colours (props: light and mid, never the ink's value; the fog is a backdrop, pale). */
export const SETPIECE_COLOURS = Object.freeze({
  rock: '#b0a494', rockDark: '#948878', mouth: CAVE.mouth, lamp: CAVE.lamp,
  boulder: '#a8a096', wood: '#a47a52', wheel: '#7a5a40',
  snow: '#eef4f8', puddle: '#bfe0f0', steam: '#f4f6f8',
  cloud: '#9aa0b4', cloudMet: '#f0f2f6', bolt: '#ffe45a', sun: '#ffd24a', rain: '#dcebf4',
  water: '#6cb8d8', ripple: '#cdeefa', stone: '#b8b0a4', bank: '#c8b890',
  stem: '#5a8a3a', thorn: '#e0d49a', bloom: '#f0a0c0',
  post: '#a47a52', board: '#d8b878', bundle: '#b0664e',
  millWall: '#d8cbb0', millRoof: '#b04e3a', sail: '#f3e6c8', door: '#8a6242', sack: '#efe4cc',
  bird: '#a47a52', breast: '#e8904a', tussock: '#8fae76', bandage: '#fbf7ee',
  fog: ['#e4e6ea', '#d8dce2', '#ccd0d8'] as const, waymark: '#d8402e',
  flag: '#78b84a', rope: '#c8a870',
});
const C = SETPIECE_COLOURS;
const R = Math.round;

/** A 2 px-or-more inked rect. */
function box(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string): void {
  g.fillStyle = INK; g.fillRect(R(x) - 1, R(y) - 1, R(w) + 2, R(h) + 2);
  g.fillStyle = c; g.fillRect(R(x), R(y), R(w), R(h));
}
/** A flat inked ellipse (a puddle, a pool of light's ring is not inked: see `pool`). */
function ellipse(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, c: string, ink = true): void {
  if (ink) { g.fillStyle = INK; g.beginPath(); g.ellipse(R(cx), R(cy), rx + 1, ry + 1, 0, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = c; g.beginPath(); g.ellipse(R(cx), R(cy), rx, ry, 0, 0, Math.PI * 2); g.fill();
}
/** A 3 px bolt (inside a 5 px ink) along a zig-zag. */
function bolt(g: CanvasRenderingContext2D, pts: readonly number[]): void {
  for (const [lw, col] of [[5, INK], [3, C.bolt]] as const) {
    g.strokeStyle = col; g.lineWidth = lw; g.lineJoin = 'miter'; g.lineCap = 'square';
    g.beginPath(); g.moveTo(R(pts[0]), R(pts[1])); for (let i = 2; i < pts.length; i += 2) g.lineTo(R(pts[i]), R(pts[i + 1])); g.stroke();
  }
}

/** Draw one challenge's set piece on the road. */
export function drawSetPiece(ctx: CanvasRenderingContext2D, id: ChallengeId, x: number, feetY: number, state: StopState, t: number): void {
  const met = state === 'met', cel = celTarget(1);
  const X = R(x), Y = R(feetY) - 4; // (its foot a little behind the team's feet line, on the road's back half)
  const g = ctx;
  g.save();
  switch (id) {
    case 'dark': {
      celPoly(g, cel, [X - 48, Y, X - 44, Y - 30, X - 30, Y - 52, X - 6, Y - 62, X + 20, Y - 58, X + 40, Y - 40, X + 48, Y], C.rock, 0.34, 0.3);
      // the mouth: an arch, dark
      g.beginPath(); g.moveTo(X - 18, Y); g.lineTo(X - 18, Y - 24); g.arc(X, Y - 24, 18, Math.PI, 0); g.lineTo(X + 18, Y); g.closePath();
      g.strokeStyle = INK; g.lineWidth = 2; g.stroke(); g.fillStyle = C.mouth; g.fill();
      if (met) {
        // one stepped lamp pool: the light inside the mouth and on the road in front of it, two flat rings
        g.save(); g.beginPath(); g.moveTo(X - 17, Y); g.lineTo(X - 17, Y - 24); g.arc(X, Y - 24, 17, Math.PI, 0); g.lineTo(X + 17, Y); g.closePath(); g.clip();
        g.fillStyle = mix(C.mouth, C.lamp, 0.25); g.beginPath(); g.ellipse(X + 8, Y - 14, 22, 20, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = mix(C.mouth, C.lamp, 0.5); g.beginPath(); g.ellipse(X + 12, Y - 14, 11, 10, 0, 0, Math.PI * 2); g.fill();
        g.restore();
        g.fillStyle = mix('#dcd6c4', C.lamp, 0.25); g.beginPath(); g.ellipse(X + 6, Y + 3, 34, 4, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = mix('#dcd6c4', C.lamp, 0.5); g.beginPath(); g.ellipse(X + 8, Y + 3, 16, 2, 0, 0, Math.PI * 2); g.fill();
        // the lantern on its hook at the mouth's right
        g.fillStyle = INK; g.fillRect(X + 22, Y - 42, 2, 8);
        box(g, X + 19, Y - 34, 8, 9, C.lamp);
        g.fillStyle = INK; g.fillRect(X + 18, Y - 36, 10, 2);
      }
      break;
    }
    case 'heavy': {
      // the cart (at the left) and the boulder (on the road ahead of it, or in the cart)
      const cx = met ? X : X - 22;
      celCapsule(g, cel, cx + 22, Y - 16, cx + 40, Y - 26, 2.2, C.wood);
      celRect(g, cel, cx - 24, Y - 26, 48, 16, 2, C.wood, 0.4, 0.25);
      g.fillStyle = INK; g.fillRect(cx - 12, Y - 25, 2, 14); g.fillRect(cx + 10, Y - 25, 2, 14);
      celBall(g, cel, cx - 12, Y - 7, 7, C.wheel); celBall(g, cel, cx + 12, Y - 7, 7, C.wheel);
      g.fillStyle = INK; g.fillRect(cx - 13, Y - 8, 3, 3); g.fillRect(cx + 11, Y - 8, 3, 3);
      if (met) celBall(g, cel, cx, Y - 40, 16, C.boulder);
      else celBall(g, cel, X + 30, Y - 17, 19, C.boulder);
      break;
    }
    case 'cold': {
      if (!met) {
        celPoly(g, cel, [X - 50, Y + 2, X - 42, Y - 16, X - 22, Y - 30, X + 2, Y - 34, X + 26, Y - 26, X + 44, Y - 12, X + 52, Y + 2], C.snow, 0.3, 0.25);
        // icicle-ish wind ripples along its top, 2 px
        g.fillStyle = mix(C.snow, '#8aa0c0', 0.35); g.fillRect(X - 20, Y - 22, 14, 2); g.fillRect(X + 6, Y - 24, 12, 2); g.fillRect(X - 36, Y - 10, 10, 2);
      } else {
        ellipse(g, X + 6, Y + 2, 34, 4, C.puddle);
        celPoly(g, cel, [X - 34, Y + 1, X - 26, Y - 7, X - 12, Y - 10, X - 2, Y - 6, X + 2, Y + 1], C.snow, 0.3, 0);
        // two steam puffs, stepping up
        const s = Math.floor(t / 20) % 3;
        box(g, X + 2, Y - 14 - s * 6, 4, 3, C.steam); box(g, X + 14, Y - 20 - ((s + 1) % 3) * 6, 3, 3, C.steam);
      }
      break;
    }
    case 'storm': {
      const cy = Y - 86;
      if (!met) {
        bolt(g, [X + 4, cy + 12, X - 6, cy + 34, X + 4, cy + 34, X - 8, cy + 62]);
        bolt(g, [X + 28, cy + 12, X + 22, cy + 28, X + 30, cy + 28, X + 24, cy + 44]);
        const s = Math.floor(t / 8) % 4;
        for (let i = 0; i < 6; i++) box(g, X - 30 + i * 12, cy + 18 + ((i * 7 + s * 5) % 20), 2, 4, C.rain);
        for (const [dx, dy, r] of [[-26, 4, 13], [-6, -6, 17], [18, -2, 15], [36, 6, 10]] as const) celBall(g, cel, X + dx, cy + dy, r, C.cloud, false);
        celRect(g, cel, X - 38, cy + 2, 84, 12, 5, C.cloud, 0.45, 0);
      } else {
        celBall(g, cel, X + 22, cy - 6, 11, C.sun, false);
        for (const [dx, dy, r] of [[-14, 4, 8], [0, -2, 11], [14, 4, 7]] as const) celBall(g, cel, X + dx - 10, cy + dy + 6, r, C.cloudMet, false);
        celRect(g, cel, X - 32, cy + 6, 44, 8, 4, C.cloudMet, 0.3, 0);
      }
      break;
    }
    case 'flood': {
      // the far bank, the water over the road (a flat inked band), the stepping stones
      celPoly(g, cel, [X - 60, Y - 4, X - 54, Y - 12, X + 54, Y - 12, X + 60, Y - 4], C.bank, 0.3, 0);
      const wy = met ? Y - 5 : Y - 14, wh = met ? 8 : 22;
      g.fillStyle = INK; g.beginPath(); g.ellipse(X, wy + wh / 2, 58, wh / 2 + 1, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = C.water; g.beginPath(); g.ellipse(X, wy + wh / 2, 57, wh / 2, 0, 0, Math.PI * 2); g.fill();
      const s = Math.floor(t / 15) % 3;
      g.fillStyle = C.ripple;
      for (let i = 0; i < (met ? 4 : 8); i++) g.fillRect(X - 44 + (i % 4) * 24 + s * 3, wy + 3 + (i % 2) * 3 + (i >> 2) * 8, 8, 2);
      for (let i = 0; i < 4; i++) {
        const sx = X - 33 + i * 22;
        if (met) celRect(g, cel, sx - 6, wy - 1, 12, 6, 2, C.stone, 0.4, 0);
        else { g.fillStyle = mix(C.water, C.stone, 0.45); g.fillRect(sx - 5, wy + wh / 2 - 1, 10, 2); }
      }
      break;
    }
    case 'thorns': {
      // the arch: two thick stems bowing over the road, thorns on them
      const arch = (dx: number) => { g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.moveTo(X - 40 + dx, Y); g.bezierCurveTo(X - 44 + dx, Y - 70, X + 44 + dx, Y - 70, X + 40 + dx, Y); g.stroke(); g.strokeStyle = C.stem; g.lineWidth = 5; g.stroke(); };
      arch(0);
      for (const [dx, dy] of [[-40, -24], [-30, -44], [-10, -54], [12, -54], [30, -44], [40, -24]] as const) box(g, X + dx - 1, Y + dy - 3, 2, 3, C.thorn);
      if (!met) {
        // the tangle across the road, knee high
        g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.moveTo(X - 38, Y - 6); g.lineTo(X - 18, Y - 22); g.lineTo(X, Y - 8); g.lineTo(X + 18, Y - 24); g.lineTo(X + 38, Y - 6); g.stroke();
        g.strokeStyle = C.stem; g.lineWidth = 4; g.stroke();
        for (const dx of [-26, -8, 10, 26]) box(g, X + dx, Y - 18, 2, 3, C.thorn);
      } else {
        // pulled aside into two bundles at the arch's feet, and the arch in flower
        celPoly(g, cel, [X - 56, Y, X - 52, Y - 12, X - 42, Y - 14, X - 40, Y], C.stem, 0.3, 0);
        celPoly(g, cel, [X + 40, Y, X + 42, Y - 14, X + 52, Y - 12, X + 56, Y], C.stem, 0.3, 0);
        for (const [dx, dy] of [[-34, -36], [-18, -50], [2, -56], [22, -50], [36, -34]] as const) { box(g, X + dx - 2, Y + dy - 2, 4, 4, C.bloom); }
      }
      break;
    }
    case 'lost': {
      celRect(g, cel, X - 3, Y - 62, 6, 62, 1, C.post, 0.4, 0);
      // the two boards: one pointing each way of the fork
      const board = (y: number, dir: 1 | -1, hang: boolean) => {
        g.save(); g.translate(X, y); if (hang) g.rotate(dir * 0.5);
        celPoly(g, cel, dir > 0 ? [2, -5, 26, -5, 32, 0, 26, 5, 2, 5] : [-2, -5, -26, -5, -32, 0, -26, 5, -2, 5], C.board, 0.35, 0);
        g.restore();
      };
      board(Y - 54, 1, false);
      board(Y - 38, -1, !met);
      if (!met) drawText3(g, X - 22, Y - 74);
      else {
        // the lost bundle found, at the post's foot, and a check
        celPoly(g, cel, [X + 8, Y, X + 10, Y - 12, X + 16, Y - 16, X + 24, Y - 12, X + 26, Y], C.bundle, 0.35, 0);
        g.fillStyle = INK; g.fillRect(X + 14, Y - 18, 4, 2);
        drawSprite(g, ICONS.check, X + 30, Y - 22);
      }
      break;
    }
    case 'miller': {
      // the mill: a stone tower, its cap, a door and a window; four lattice sails from the cap's hub
      celPoly(g, cel, [X - 26, Y, X - 18, Y - 70, X + 18, Y - 70, X + 26, Y], C.millWall, 0.36, 0.3);
      celPoly(g, cel, [X - 22, Y - 68, X, Y - 92, X + 22, Y - 68], C.millRoof, 0.36, 0.3);
      box(g, X - 5, Y - 52, 8, 8, '#cfe3ea');
      if (met) { box(g, X - 8, Y - 22, 14, 22, '#3a2e36'); celPoly(g, cel, [X + 12, Y, X + 13, Y - 12, X + 18, Y - 16, X + 24, Y - 12, X + 25, Y], C.sack, 0.3, 0); }
      else box(g, X - 8, Y - 22, 14, 22, C.door);
      const hub = { x: X, y: Y - 72 }, a0 = met ? (Math.floor(t / 10) % 8) * (Math.PI / 16) : Math.PI / 4;
      for (let i = 0; i < 4; i++) {
        const a = a0 + i * Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a);
        const L = 44, W = 8, px = -sa, py = ca;
        const p = [hub.x + ca * 6, hub.y + sa * 6, hub.x + ca * L, hub.y + sa * L, hub.x + ca * L + px * W, hub.y + sa * L + py * W, hub.x + ca * 10 + px * W, hub.y + sa * 10 + py * W];
        celPoly(g, cel, p.map(R), C.sail, 0.2, 0);
        // the lattice: two cross bars in ink
        g.fillStyle = INK;
        for (const f of [0.45, 0.72]) g.fillRect(R(hub.x + ca * L * f + px * W / 2) - 1, R(hub.y + sa * L * f + py * W / 2) - 1, 2, 2);
      }
      celBall(g, cel, hub.x, hub.y, 4, C.door, false);
      break;
    }
    case 'hurt': {
      // a tussock on the verge, and the bird on it
      celPoly(g, cel, [X - 18, Y, X - 12, Y - 10, X, Y - 13, X + 12, Y - 10, X + 18, Y], C.tussock, 0.3, 0);
      const hop = met ? [0, -3, -4, -3, 0, 0][Math.floor(t / 6) % 6] : 0, by = Y - 20 + hop;
      celBall(g, cel, X, by, 8, C.bird);
      celBall(g, cel, X + 6, by - 7, 5.5, C.bird, false);
      celPoly(g, cel, [X + 1, by - 2, X + 8, by - 2, X + 6, by + 6, X + 1, by + 5], C.breast, 0.3, 0);
      g.fillStyle = INK; g.fillRect(X + 7, by - 9, 2, 2);
      celPoly(g, cel, [X + 10, by - 8, X + 15, by - 6, X + 10, by - 5], '#e8b040', 0.2, 0);
      g.fillStyle = INK; g.fillRect(X - 1, by + 7, 2, 4 - hop); g.fillRect(X + 3, by + 7, 2, 4 - hop);
      if (!met) {
        // the wing held out a little (it can't fold it to fly): no mark on it, nobody looks hurt
        celPoly(g, cel, [X - 4, by - 3, X - 16, by + 1, X - 14, by + 5, X - 3, by + 3], C.bird, 0.3, 0);
        drawSprite(g, QUESTION, X + 16, by - 18);
      } else {
        // the wing folded in a neat bandage, its tie, and a heart
        celPoly(g, cel, [X - 8, by - 4, X + 2, by - 4, X + 2, by + 4, X - 8, by + 4], C.bandage, 0.25, 0);
        g.fillStyle = INK; g.fillRect(X - 4, by - 4, 1, 8);
        drawSprite(g, ICONS.love, X + 16, by - 18);
      }
      break;
    }
    case 'fog': {
      // stepped flat bands with scalloped tops, drifting a px every half second; met: only the lowest, thinner, and a waymark
      const drift = (Math.floor(t / 30) % 6) - 3;
      const bands = met ? [[0, 14, 2]] as const : [[0, 20, 2], [18, 20, 1], [36, 22, 0]] as const;
      for (let i = bands.length - 1; i >= 0; i--) {
        const [up, hh, col] = bands[i], top = Y - up - hh, w = 72 - up * 0.5;
        g.beginPath();
        g.moveTo(X - w, Y - up);
        for (let s = 0; s <= 8; s++) { const sx = X - w + (2 * w * s) / 8 + drift; g.arc(sx, top + 6, 8, Math.PI, 0); }
        g.lineTo(X + w, Y - up); g.closePath();
        g.strokeStyle = INK; g.lineWidth = 2; g.stroke();
        g.fillStyle = C.fog[col]; g.fill();
      }
      if (met) { celRect(g, cel, X + 40, Y - 40, 4, 40, 1, C.post, 0.3, 0); box(g, X + 44, Y - 38, 10, 6, C.waymark); }
      break;
    }
    case 'gap': {
      celPoly(g, cel, [X - 50, Y, X - 46, Y - 58, X - 34, Y - 76, X - 18, Y - 72, X - 8, Y - 50, X - 7, Y], C.rock, 0.36, 0.3);
      celPoly(g, cel, [X + 7, Y, X + 8, Y - 60, X + 20, Y - 80, X + 38, Y - 70, X + 48, Y - 40, X + 50, Y], C.rockDark, 0.36, 0.3);
      if (met) {
        // a knotted rope over the gap, and a flag on the right rock's top
        g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); g.moveTo(X - 18, Y - 66); g.quadraticCurveTo(X, Y - 54, X + 20, Y - 70); g.stroke();
        g.strokeStyle = C.rope; g.lineWidth = 2; g.stroke();
        box(g, X - 2, Y - 61, 3, 3, C.rope);
        g.fillStyle = INK; g.fillRect(X + 20, Y - 96, 2, 18);
        celPoly(g, cel, [X + 22, Y - 96, X + 34, Y - 92, X + 22, Y - 88], C.flag, 0.3, 0);
      }
      break;
    }
  }
  g.restore();
}

/** A small "?" (the lost board's, the bird's), 5 x 7, drawn as a sprite. */
const QUESTION = Object.freeze({ rows: ['.qqq.', 'q...q', '...q.', '..q..', '..q..', '.....', '..q..'], colors: { q: '#f2b43a' } });
function drawText3(g: CanvasRenderingContext2D, x: number, y: number): void { drawSprite(g, QUESTION, x, y); }
