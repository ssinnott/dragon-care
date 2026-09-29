// The passages (docs/BASE_DESIGN.md 6): the stretch of road a land challenge's stop opens onto, walked through after
// it -- the dark's CAVE (a tunnel of rock the whole way, lit by the lanterns when the way was lit, else just its glints),
// the narrow gap's CANYON (a rock wall behind the road, flagged along its rim once the rope is over), the thorns'
// BRAMBLE TUNNEL (arches over the road, in flower once pushed through, else with the tangle still along the verge),
// the fog's FOG BANK (the bands drifting along the whole stretch, thinned with waymarks once the way was found), the
// cold's SNOW LANE (drifts along the verge and the snow falling, melted to heaps and puddles once the cold is seen
// off), the storm's RAIN (a cloud band overhead and the rain, a white band and a stepped rainbow once ridden out), the
// flood's WATER MEADOW (water along the verge, down to puddles and the stones once across), the heavy load's ROCKFALL
// (boulders along the verge, stacked into cairns once the load is shifted) and the lost things' WAYMARKS (signposts
// along the way, hanging and questioning until the lost things turn up). The people's stops (the miller, the hurt
// animal) open onto no passage: they are met at a place, not in the land.
//
// Drawing only (ART_BIBLE 5.10): a pure function of (id, x0, x1, state, t) in road px -- the scene's camera translates
// -- in the house style (a 1 px #1a1018 ink, flat fills, no gradients, no alpha, no mark under 2 px), everything BEHIND
// the team (never over a dragon or an eye), from the scene's top down to the road's back edge. The stepped motions
// (the fog's drift, the snow, the rain, the ripples) are steps of `t`, so a frozen frame is the same every time. The
// cave's and the canyon's walls are backdrops the team is seen against, gated like the fog bank's bands (palette-check
// gate w: each lighter than every dark body, off the ink); the rest reuse the set pieces' own colours.
import { celPoly, celBall, celRect } from '../lib/art/shading.ts';
import { mix } from '../lib/art/palettes.ts';
import { drawSprite, ICONS } from './icons.ts';
import { INK, CAVE, FLOORS } from './surfaces.ts';
import { celTarget } from './cel.ts';
import { SETPIECE_COLOURS as C } from './setpieces.ts';
import type { ChallengeId, StopState } from './missiondata.ts';

/** A passage's length along the road (road px): about a screen's width, a few seconds' walk. */
export const PASSAGE_LEN = 600;
/** A passage begins this far past its stop's set piece (the piece's middle: the cave mouth's rock face reaches 48 px). */
export const PASSAGE_FROM = 48;
/** The passages: which land challenge opens onto which. */
export type PassageKind = 'cave' | 'canyon' | 'bramble' | 'fogbank' | 'snowlane' | 'rain' | 'watermeadow' | 'rockfall' | 'waymarks';
export const PASSAGES: Readonly<Partial<Record<ChallengeId, PassageKind>>> = Object.freeze({
  dark: 'cave', gap: 'canyon', thorns: 'bramble', fog: 'fogbank', cold: 'snowlane', storm: 'rain', flood: 'watermeadow', heavy: 'rockfall', lost: 'waymarks',
});
/** Whether a challenge's stop opens onto a passage. */
export function hasPassage(id: ChallengeId): boolean { return PASSAGES[id] !== undefined; }

/** The passages' own backdrop colours (gate w: lighter than every dark body, off the ink): the cave's wall, its darker seams and ceiling, its glints; the canyon's wall and rim. */
export const PASSAGE_COLOURS = Object.freeze({
  caveWall: '#8c7c94', caveDeep: '#7e6e86', caveGlint: '#cfe3ea',
  canyonWall: '#b0a494', canyonDeep: '#948878',
  rainbow: ['#f0a0a0', '#f0d090', '#a8d8a0', '#a0c0f0'] as const,
});
const P = PASSAGE_COLOURS;
const R = Math.round;

/** A 2 px-or-more inked rect. */
function box(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string): void {
  g.fillStyle = INK; g.fillRect(R(x) - 1, R(y) - 1, R(w) + 2, R(h) + 2);
  g.fillStyle = c; g.fillRect(R(x), R(y), R(w), R(h));
}
/** An inked polygon (flat fill). */
function inkPoly(g: CanvasRenderingContext2D, pts: readonly number[], fill: string): void {
  g.beginPath(); g.moveTo(R(pts[0]), R(pts[1]));
  for (let i = 2; i < pts.length; i += 2) g.lineTo(R(pts[i]), R(pts[i + 1]));
  g.closePath();
  g.strokeStyle = INK; g.lineWidth = 2; g.lineJoin = 'round'; g.stroke();
  g.fillStyle = fill; g.fill();
}
/** A flat ellipse, inked or not. */
function ellipse(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, c: string, ink = true): void {
  if (ink) { g.fillStyle = INK; g.beginPath(); g.ellipse(R(cx), R(cy), rx + 1, ry + 1, 0, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = c; g.beginPath(); g.ellipse(R(cx), R(cy), rx, ry, 0, 0, Math.PI * 2); g.fill();
}
/** A deterministic 0..1 for (i, salt): placement only. */
function hash(i: number, salt: number): number {
  let h = (i * 374761393 + salt * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** The cave mouth's arch path (the set piece's shape, mirrored for the way out): 18 px wide, 24 to the arch's spring. */
function archPath(g: CanvasRenderingContext2D, X: number, Y: number): void {
  g.moveTo(X - 18, Y); g.lineTo(X - 18, Y - 24); g.arc(X, Y - 24, 18, Math.PI, 0); g.lineTo(X + 18, Y); g.closePath();
}

/**
 * Draw the passage after challenge `id`'s stop, from road x `x0` to `x1`, its foot on the feet line `feetY`, the scene
 * reaching up to `top` (screen y); `state` how the stop went (`ahead`: not reached -- the passage still draws, the
 * team will walk it whatever happens; `met`, `unmet`), `t` the scene's step.
 */
export function drawPassage(ctx: CanvasRenderingContext2D, id: ChallengeId, x0: number, x1: number, feetY: number, top: number, state: StopState, t: number): void {
  const kind = PASSAGES[id];
  if (!kind) return;
  const met = state === 'met', cel = celTarget(1), g = ctx;
  const X0 = R(x0), X1 = R(x1), Y = R(feetY) - 4, T = R(top);
  g.save();
  switch (kind) {
    case 'cave': {
      // the tunnel: the wall from the scene's top to the road, its seams and a rubble band along the foot; the ceiling
      // hanging in stalactites; the way out at the far end, an arch the daylight shows through
      const wall = met ? P.caveWall : P.caveDeep, end = X1 - 30;
      g.fillStyle = INK; g.fillRect(X0 - 12, T, end - X0 + 12, Y - T + 2);
      g.fillStyle = wall; g.fillRect(X0 - 12, T, end - X0 + 12, Y - T + 1);
      // seams: stepped flat bands of the deeper tone along the wall
      g.fillStyle = met ? P.caveDeep : mix(P.caveDeep, INK, 0.12);
      for (let i = Math.floor(X0 / 56); i * 56 < end; i++) {
        const sx = i * 56, sy = T + 40 + R(hash(i, 3) * (Y - T - 90));
        if (sx + 30 > X0 && sx < end) g.fillRect(Math.max(X0 - 12, sx), sy, Math.min(30, end - sx), 3);
      }
      // the rubble band at the foot
      g.fillStyle = P.caveDeep; g.fillRect(X0 - 12, Y - 5, end - X0 + 12, 6);
      g.fillStyle = INK; g.fillRect(X0 - 12, Y - 6, end - X0 + 12, 1);
      // stalactites from the ceiling, every 40 px
      for (let i = Math.floor(X0 / 40); i * 40 < end - 20; i++) {
        const sx = i * 40 + 20 + R(hash(i, 5) * 12), h = 14 + R(hash(i, 7) * 22);
        if (sx - 8 < X0 - 12 || sx + 8 > end) continue;
        inkPoly(g, [sx - 8, T - 2, sx + 8, T - 2, sx + 1, T + h], P.caveDeep);
      }
      if (met) {
        // the lanterns along the wall, every 150 px, each with its stepped pool of light on the wall and on the road
        for (let i = Math.floor(X0 / 150); i * 150 < end - 40; i++) {
          const lx = i * 150 + 75;
          if (lx - 30 < X0 || lx + 30 > end) continue;
          const ly = Y - 58;
          g.fillStyle = mix(wall, CAVE.lamp, 0.25); g.beginPath(); g.ellipse(lx, ly + 4, 30, 26, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = mix(wall, CAVE.lamp, 0.5); g.beginPath(); g.ellipse(lx, ly + 4, 15, 13, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = mix(FLOORS.road, CAVE.lamp, 0.25); g.beginPath(); g.ellipse(lx, Y + 3, 34, 4, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = mix(FLOORS.road, CAVE.lamp, 0.5); g.beginPath(); g.ellipse(lx, Y + 3, 16, 2, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = INK; g.fillRect(lx - 1, ly - 12, 2, 8);
          box(g, lx - 4, ly - 4, 8, 9, CAVE.lamp);
          g.fillStyle = INK; g.fillRect(lx - 5, ly - 6, 10, 2);
        }
      } else {
        // dark going: only a few glints on the wall (2 x 2, pale) catch what light there is
        for (let i = Math.floor(X0 / 34); i * 34 < end; i++) {
          const gx = i * 34 + R(hash(i, 11) * 20), gy = T + 30 + R(hash(i, 13) * (Y - T - 70));
          if (gx < X0 - 10 || gx > end - 4) continue;
          g.fillStyle = P.caveGlint; g.fillRect(gx, gy, 2, 2);
        }
      }
      // the way out: the rock face round the far arch, the daylight through it (the climate behind: the arch is cut out)
      g.beginPath();
      g.moveTo(end - 2, Y + 2); g.lineTo(end - 2, T - 2); g.lineTo(X1 + 40, T - 2); g.lineTo(X1 + 40, Y - 40); g.lineTo(X1 + 48, Y + 2); g.closePath();
      archPath(g, X1, Y);
      g.fillStyle = INK; g.fill('evenodd');
      g.beginPath();
      g.moveTo(end, Y + 1); g.lineTo(end, T - 2); g.lineTo(X1 + 38, T - 2); g.lineTo(X1 + 38, Y - 40); g.lineTo(X1 + 46, Y + 1); g.closePath();
      g.moveTo(X1 - 16, Y + 1); g.lineTo(X1 - 16, Y - 24); g.arc(X1, Y - 24, 16, Math.PI, 0); g.lineTo(X1 + 16, Y + 1); g.closePath();
      g.fillStyle = C.rock; g.fill('evenodd');
      if (met) { g.fillStyle = INK; g.fillRect(X1 - 24, Y - 42, 2, 8); box(g, X1 - 27, Y - 34, 8, 9, C.lamp); g.fillStyle = INK; g.fillRect(X1 - 28, Y - 36, 10, 2); }
      break;
    }
    case 'canyon': {
      // the far wall of the gap behind the road, its rim jagged against the sky, its face banded; flags along the rim once met
      const rim = (u: number) => Y - 92 - R(14 * Math.abs(Math.sin(u / 37)) + 6 * Math.sin(u / 11));
      g.beginPath(); g.moveTo(X0 - 8, Y + 2);
      for (let x = X0 - 8; x <= X1 + 8; x += 4) g.lineTo(x, rim(x));
      g.lineTo(X1 + 8, Y + 2); g.closePath();
      g.strokeStyle = INK; g.lineWidth = 2; g.lineJoin = 'round'; g.stroke(); g.fillStyle = P.canyonWall; g.fill();
      // the face's bands and a scatter of dark blocks
      for (let i = Math.floor(X0 / 44); i * 44 < X1; i++) {
        const bx = i * 44 + 10, by = Y - 30 - R(hash(i, 17) * 44), bw = 18 + R(hash(i, 19) * 16);
        if (bx < X0 || bx + bw > X1) continue;
        celRect(g, cel, bx, by, bw, 8, 2, P.canyonDeep, 0.3, 0);
      }
      g.fillStyle = P.canyonDeep; g.fillRect(X0 - 8, Y - 4, X1 - X0 + 16, 5);
      g.fillStyle = INK; g.fillRect(X0 - 8, Y - 5, X1 - X0 + 16, 1);
      if (met) for (let i = Math.floor(X0 / 120); i * 120 < X1; i++) {
        const fx = i * 120 + 60;
        if (fx < X0 + 10 || fx > X1 - 10) continue;
        const fy = rim(fx);
        g.fillStyle = INK; g.fillRect(fx, fy - 18, 2, 18);
        celPoly(g, cel, [fx + 2, fy - 18, fx + 14, fy - 14, fx + 2, fy - 10], C.flag, 0.3, 0);
      }
      break;
    }
    case 'bramble': {
      // arches over the road every 70 px (the set piece's, smaller), in flower once met; else the tangle along the verge
      for (let i = Math.floor(X0 / 70); i * 70 < X1; i++) {
        const ax = i * 70 + 35;
        if (ax - 34 < X0 || ax + 34 > X1) continue;
        g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.moveTo(ax - 32, Y); g.bezierCurveTo(ax - 36, Y - 62, ax + 36, Y - 62, ax + 32, Y); g.stroke();
        g.strokeStyle = C.stem; g.lineWidth = 4; g.stroke();
        for (const [dx, dy] of [[-30, -22], [-18, -40], [0, -48], [18, -40], [30, -22]] as const) {
          if (met) box(g, ax + dx - 2, Y + dy - 2, 4, 4, C.bloom);
          else box(g, ax + dx - 1, Y + dy - 3, 2, 3, C.thorn);
        }
      }
      if (!met) {
        g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.moveTo(X0, Y - 4);
        for (let x = X0; x <= X1; x += 18) g.lineTo(x, Y - 4 - (((x / 18) | 0) % 2) * 10);
        g.stroke(); g.strokeStyle = C.stem; g.lineWidth = 3; g.stroke();
        for (let x = X0 + 9; x < X1; x += 36) box(g, x, Y - 16, 2, 3, C.thorn);
      }
      break;
    }
    case 'fogbank': {
      // the fog's bands along the whole stretch, drifting a px every half second (the set piece's, continued); thinned to the low one with waymarks once met
      const drift = (Math.floor(t / 30) % 6) - 3;
      const bands = met ? [[0, 14, 2]] as const : [[0, 20, 2], [18, 20, 1], [36, 22, 0]] as const;
      for (let i = bands.length - 1; i >= 0; i--) {
        const [up, hh, col] = bands[i], topY = Y - up - hh;
        g.beginPath(); g.moveTo(X0 - 12, Y - up);
        for (let sx = X0 - 12; sx <= X1 + 12; sx += 16) g.arc(sx + drift, topY + 6, 8, Math.PI, 0);
        g.lineTo(X1 + 12, Y - up); g.closePath();
        g.strokeStyle = INK; g.lineWidth = 2; g.stroke(); g.fillStyle = C.fog[col]; g.fill();
      }
      if (met) for (let i = Math.floor(X0 / 120); i * 120 < X1; i++) {
        const px = i * 120 + 60;
        if (px < X0 + 10 || px > X1 - 10) continue;
        celRect(g, cel, px, Y - 40, 4, 40, 1, C.post, 0.3, 0); box(g, px + 4, Y - 38, 10, 6, C.waymark);
      }
      break;
    }
    case 'snowlane': {
      // drifts along the verge every 90 px (melted to low heaps with puddles once met) and, unmet, the snow falling (2 x 2)
      for (let i = Math.floor(X0 / 90); i * 90 < X1; i++) {
        const dx = i * 90 + 45, s = 0.7 + 0.6 * hash(i, 23);
        if (dx - 40 < X0 || dx + 40 > X1) continue;
        if (met) {
          ellipse(g, dx + 4, Y + 2, R(22 * s), 3, C.puddle);
          celPoly(g, cel, [dx - 20 * s, Y + 1, dx - 14 * s, Y - 6 * s, dx - 2 * s, Y - 9 * s, dx + 6 * s, Y - 5 * s, dx + 10 * s, Y + 1].map(R), C.snow, 0.3, 0);
        } else celPoly(g, cel, [dx - 36 * s, Y + 2, dx - 28 * s, Y - 12 * s, dx - 12 * s, Y - 24 * s, dx + 6 * s, Y - 26 * s, dx + 22 * s, Y - 18 * s, dx + 36 * s, Y + 2].map(R), C.snow, 0.3, 0.25);
      }
      if (!met) {
        const fall = Math.floor(t / 6) % 24;
        for (let i = Math.floor(X0 / 26); i * 26 < X1; i++) {
          const fx = i * 26 + R(hash(i, 29) * 18), fy = T + 10 + (R(hash(i, 31) * (Y - T - 30)) + fall * 3) % (Y - T - 20);
          if (fx < X0 || fx > X1 - 2) continue;
          box(g, fx, fy, 2, 2, C.snow);
        }
      }
      break;
    }
    case 'rain': {
      // a cloud band overhead the whole stretch: dark with rain streaks, or (met) white, the sun and a stepped rainbow
      const cy = T + 26;
      if (!met) {
        const s = Math.floor(t / 8) % 4;
        for (let i = Math.floor(X0 / 12); i * 12 < X1; i++) {
          const rx = i * 12 + 4, ry = cy + 26 + ((i * 7 + s * 5) % 36) + R(hash(i, 37) * 60);
          if (rx < X0 || rx > X1 - 2 || ry > Y - 30) continue;
          box(g, rx, ry, 2, 4, C.rain);
        }
        for (let i = Math.floor(X0 / 56); i * 56 < X1; i++) {
          const cx = i * 56 + 28;
          if (cx - 30 < X0 || cx + 30 > X1) continue;
          for (const [dx, dy, r] of [[-18, 6, 11], [0, -2, 14], [18, 6, 10]] as const) celBall(g, cel, cx + dx, cy + dy, r, C.cloud, false);
        }
        celRect(g, cel, X0, cy + 8, X1 - X0, 12, 5, C.cloud, 0.45, 0);
      } else {
        // the rainbow: four stepped flat arcs from the verge up and over, then the sun and small white clouds
        const mx = (X0 + X1) / 2, r0 = Math.min(220, (X1 - X0) / 2 - 20);
        for (let k = 0; k < P.rainbow.length; k++) {
          g.strokeStyle = P.rainbow[k]; g.lineWidth = 4; g.beginPath(); g.arc(R(mx), Y + 30, r0 - k * 4, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
        }
        celBall(g, cel, X0 + 60, cy, 11, C.sun, false);
        for (let i = Math.floor(X0 / 130); i * 130 < X1; i++) {
          const cx = i * 130 + 90;
          if (cx - 24 < X0 || cx + 24 > X1) continue;
          for (const [dx, dy, r] of [[-12, 4, 8], [0, -2, 10], [12, 4, 7]] as const) celBall(g, cel, cx + dx, cy + 8 + dy, r, C.cloudMet, false);
        }
      }
      break;
    }
    case 'watermeadow': {
      // water along the verge the whole stretch (a flat inked band, its ripples stepping), or (met) puddles and the stones showing
      const s = Math.floor(t / 15) % 3;
      if (!met) {
        g.fillStyle = INK; g.fillRect(X0 - 8, Y - 15, X1 - X0 + 16, 17);
        g.fillStyle = C.water; g.fillRect(X0 - 8, Y - 14, X1 - X0 + 16, 15);
        g.fillStyle = C.ripple;
        for (let i = Math.floor(X0 / 24); i * 24 < X1; i++) { const rx = i * 24 + s * 3; if (rx >= X0 && rx + 8 <= X1) g.fillRect(rx, Y - 10 + (i % 2) * 5, 8, 2); }
      } else {
        for (let i = Math.floor(X0 / 80); i * 80 < X1; i++) {
          const px = i * 80 + 40;
          if (px - 30 < X0 || px + 30 > X1) continue;
          ellipse(g, px, Y - 2, 22 + R(hash(i, 41) * 8), 4, C.water);
          g.fillStyle = C.ripple; g.fillRect(px - 10 + s * 3, Y - 3, 6, 2);
          celRect(g, cel, px + 26, Y - 6, 12, 6, 2, C.stone, 0.4, 0);
        }
      }
      break;
    }
    case 'rockfall': {
      // boulders along the verge every 60 px; stacked into cairns once the load is shifted
      for (let i = Math.floor(X0 / 60); i * 60 < X1; i++) {
        const bx = i * 60 + 30, s = 0.6 + 0.8 * hash(i, 43);
        if (bx - 24 < X0 || bx + 24 > X1) continue;
        if (met) { celBall(g, cel, bx, Y - 6, R(7 * s) + 3, C.boulder); celBall(g, cel, bx, Y - 16 - R(4 * s), R(5 * s) + 2, C.boulder); celBall(g, cel, bx, Y - 24 - R(7 * s), R(3 * s) + 2, C.boulder); }
        else celBall(g, cel, bx + R((hash(i, 47) - 0.5) * 20), Y - R(11 * s) - 3, R(12 * s) + 4, C.boulder);
      }
      break;
    }
    case 'waymarks': {
      // signposts along the way every 150 px: hanging boards and a "?" while the lost things are lost; straight, a check on the last, once found
      for (let i = Math.floor(X0 / 150); i * 150 < X1; i++) {
        const px = i * 150 + 75;
        if (px - 34 < X0 || px + 34 > X1) continue;
        celRect(g, cel, px - 3, Y - 54, 6, 54, 1, C.post, 0.4, 0);
        g.save(); g.translate(px, Y - 46); if (!met) g.rotate(-0.4);
        celPoly(g, cel, [2, -5, 26, -5, 32, 0, 26, 5, 2, 5], C.board, 0.35, 0);
        g.restore();
        if (met) drawSprite(g, ICONS.check, px + 8, Y - 66);
        else drawSprite(g, QUESTION, px - 20, Y - 66);
      }
      break;
    }
  }
  g.restore();
}

/** A small "?" (the waymarks' hanging boards), 5 x 7, as the set pieces draw it. */
const QUESTION = Object.freeze({ rows: ['.qqq.', 'q...q', '...q.', '..q..', '..q..', '.....', '..q..'], colors: { q: '#f2b43a' } });
