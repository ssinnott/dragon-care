// A mission region's picture (plan S8/S9, S9a; docs/ART_BIBLE.md "Mission art"): its climate in stepped flat layers,
// drawn into any rect -- the Map Room chooser's 300 x 112 climate picture, or the whole 640 x ~300 road scene, where S9
// advances `scroll` and the layers slide at their own parallax. Drawing only: no dragons in it, no state, and every
// quantity a pure function of (climate, phase, rect, scroll), so a frozen view draws the same picture every time.
//
// The layers, back to front, all flat fills inside a 1 px #1a1018 ink (no gradients, no alpha: the house style):
//   - three sky bands (the top 28 %, the middle to 50 %, the low sky under them), fixed (0 parallax); at night a few
//     2 x 2 stars in the top band;
//   - the far ridge at 0.2 parallax, its silhouette each climate's own (rolling downs, mesas, a row of firs, jagged
//     snow peaks, low white hills, round ash cones);
//   - the near forms at 0.5 parallax (meadow hills and hedgerows, dry hills with a cave mouth, round-crowned trees,
//     crags, the frozen lake and its floes, cones with their flank bands);
//   - the weather, marks >= 2 px: meadow and forest rain (2 x 4 streaks), ice snow (2 x 2), peaks' storm clouds and
//     3 px bolts, ash's heat bands (2 px stepped wavy lines), and the caves' one cave mouth with one stepped lamp pool.
// Every colour is a surfaces.ts CLIMATE_BACKDROPS entry (or the cave's own props): gate (w) holds each lighter than
// every dark body, and night stays a mid-value blue hour (the darkness rule), never black.
import { mix } from '../lib/art/palettes.ts';
import { CLIMATE_BACKDROPS, CAVE, INK, LIGHTS } from './surfaces.ts';
import type { ClimatePhase } from './surfaces.ts';
import type { DayPhase } from './clock.ts';
import type { Climate } from './missiondata.ts';
import { mix32 } from './rand.ts';

export interface PicRect { x: number; y: number; w: number; h: number }

/** The chooser's climate picture size (plan S8: 300 x 112 at (16, 26)). */
export const CLIMATE_PIC = Object.freeze({ w: 300, h: 112 });
/** The layers' parallax against `scroll` (the road scene's camera x): sky 0, far ridge 0.2, near forms 0.5, weather 0.35. */
export const PARALLAX = Object.freeze({ sky: 0, ridge: 0.2, near: 0.5, weather: 0.35 });

/** The caves' lamp pool: two stepped rings in front of the cave mouth, inner and outer (flat, never a gradient). */
export function lampPool(near: string): readonly [string, string] { return [mix(near, CAVE.lamp, 0.5), mix(near, CAVE.lamp, 0.25)]; }

/** A deterministic 0..1 for (a, b, salt): placement only, never simulation state. */
const hash = (a: number, b: number, salt: number): number => mix32(a, b, salt) / 4294967296;
const R = Math.round;

/**
 * Fill the band under a ridge line (heights from `top(u)`, u a world x) from the line down to `bottom`, inked along
 * the line. The ink is a 2 px stroke drawn under the fill, so 1 px of it shows above the edge.
 */
function ridgeFill(g: CanvasRenderingContext2D, x0: number, x1: number, bottom: number, off: number, top: (u: number) => number, fill: string, step = 2): void {
  g.beginPath();
  g.moveTo(x0 - 2, bottom + 2);
  for (let x = x0 - 2; x <= x1 + 2; x += step) g.lineTo(x, R(top(x + off)));
  g.lineTo(x1 + 2, bottom + 2);
  g.closePath();
  g.strokeStyle = INK; g.lineWidth = 2; g.lineJoin = 'round'; g.stroke();
  g.fillStyle = fill; g.fill();
}
/** An inked polygon (flat fill). */
function inkPoly(g: CanvasRenderingContext2D, pts: readonly number[], fill: string): void {
  g.beginPath(); g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
  g.strokeStyle = INK; g.lineWidth = 2; g.lineJoin = 'round'; g.stroke();
  g.fillStyle = fill; g.fill();
}
/** An inked disc. */
function inkDisc(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, fill: string): void {
  g.fillStyle = INK; g.beginPath(); g.arc(cx, cy, r + 1, 0, Math.PI * 2); g.fill();
  g.fillStyle = fill; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
}
/** An inked axis-aligned mark (a snowflake, a rain streak, a star): w x h in `fill` with its 1 px ink ring. */
function mark(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, ink = true): void {
  if (ink) { g.fillStyle = INK; g.fillRect(x - 1, y - 1, w + 2, h + 2); }
  g.fillStyle = fill; g.fillRect(x, y, w, h);
}
/** The positive remainder. */
const mod = (a: number, n: number): number => ((a % n) + n) % n;

/**
 * Draw a climate at a phase of the day into `rect` (screen px), the layers slid by `scroll` at their parallax. The
 * picture scales with the rect's height (k = h / 112: 1 in the chooser, about 2.7 in a 300 px road scene); the weather
 * marks keep their px sizes. Clipped to the rect, inked round it.
 */
export function drawClimate(ctx: CanvasRenderingContext2D, climate: Climate, phase: DayPhase, rect: PicRect, scroll = 0): void {
  const P = CLIMATE_BACKDROPS[climate][phase];
  const { x, y, w, h } = rect, k = Math.max(0.5, h / CLIMATE_PIC.h);
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  // the sky's three stepped bands
  const b1 = y + R(h * 0.28), b2 = y + R(h * 0.5);
  ctx.fillStyle = P.sky[0]; ctx.fillRect(x, y, w, b1 - y);
  ctx.fillStyle = P.sky[1]; ctx.fillRect(x, b1, w, b2 - b1);
  ctx.fillStyle = P.sky[2]; ctx.fillRect(x, b2, w, y + h - b2);
  if (phase === 'night') {
    // a few 2 x 2 stars in the top band, and the moon
    const n = Math.max(4, R(w / 40));
    for (let i = 0; i < n; i++) mark(ctx, x + R(hash(i, 1, 71) * (w - 6)) + 2, y + 2 + R(hash(i, 2, 71) * Math.max(1, b1 - y - 6)), 2, 2, LIGHTS.star, false);
    inkDisc(ctx, x + w - R(28 * Math.min(k, 1.6)), y + R(12 * Math.min(k, 1.6)) + 2, R(5 * Math.min(k, 1.6)), LIGHTS.moon);
  }
  const off = (p: number) => R(scroll * p);
  // The ridge, near forms and storm clouds place in world u = (screen x - rect.x) + scroll * parallax, so a picture
  // depends only on its size, phase and scroll, never on where on the canvas it sits: their offsets carry -x.
  const ro = off(PARALLAX.ridge) - x, no = off(PARALLAX.near) - x, wo = off(PARALLAX.weather);
  const bottom = y + h;
  // weather behind the ridge (heat bands in the low sky, storm clouds high)
  if (climate === 'ash') heatBands(ctx, x, w, b1, b2 + R(h * 0.1), wo, P, k);
  if (climate === 'peaks') stormClouds(ctx, x, y, w, h, wo - x, P, k);
  drawRidge(ctx, climate, x, w, y, h, bottom, ro, P, k);
  drawNear(ctx, climate, x, w, y, h, bottom, no, P, k);
  if (climate === 'meadow' || climate === 'forest') rain(ctx, x, y, w, h, wo, P);
  if (climate === 'ice') snow(ctx, x, y, w, h, wo, P);
  ctx.restore();
  // the frame
  ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

/** The far ridge's silhouette, per climate (u: world x at the ridge's parallax; y0: the ridge's middle line). */
function drawRidge(g: CanvasRenderingContext2D, c: Climate, x: number, w: number, y: number, h: number, bottom: number, off: number, P: ClimatePhase, k: number): void {
  const base = y + h * 0.56;
  let top: (u: number) => number;
  switch (c) {
    case 'meadow': top = (u) => base - k * (6 + 5 * Math.sin(u / (38 * k)) + 3 * Math.sin(u / (17 * k) + 1)); break;
    case 'caves': {
      // flat-topped mesas: a stepped profile, 60 px plateaus between slopes
      const per = 120 * k;
      top = (u) => { const q = mod(u, per) / per; const lift = q < 0.15 ? q / 0.15 : q < 0.55 ? 1 : q < 0.7 ? (0.7 - q) / 0.15 : 0; return base - k * (4 + 11 * lift + (q > 0.25 && q < 0.4 ? 3 : 0)); };
      break;
    }
    case 'forest': {
      // a row of fir tips: a saw of 14 px teeth of varying height
      const per = 14 * k;
      top = (u) => { const i = Math.floor(u / per), q = mod(u, per) / per; const hh = 10 + 8 * hash(i, 3, 17); return base - k * (2 + hh * (1 - Math.abs(q - 0.5) * 2)); };
      break;
    }
    case 'peaks': {
      // jagged peaks: two sizes of triangle
      const per = 70 * k;
      top = (u) => { const i = Math.floor(u / per), q = mod(u, per) / per; const hh = 20 + 12 * hash(i, 5, 23); const tri = 1 - Math.abs(q - 0.5) * 2; return base - k * (2 + hh * tri + 4 * Math.max(0, 1 - Math.abs(q - 0.25) * 8)); };
      break;
    }
    case 'ice': top = (u) => base + k * 4 - k * (4 + 3 * Math.sin(u / (50 * k)) + 2 * Math.sin(u / (23 * k) + 2)); break;
    case 'ash': {
      // round cones with a flattened top (a gentle crater)
      const per = 110 * k;
      top = (u) => { const q = mod(u, per) / per, d = Math.abs(q - 0.5) * 2; const cone = Math.max(0, 1 - d * 1.4); return base - k * (3 + 18 * Math.min(cone, 0.85)); };
      break;
    }
  }
  ridgeFill(g, x, x + w, bottom, off, top, P.ridge, Math.max(1, R(k)));
  if (c === 'peaks') {
    // snow caps: the top of each peak in the lighter of the sky's bands, as a stepped flat cap (no gradient)
    const per = 70 * k;
    for (let i = Math.floor((off + x - per) / per); i * per - off < x + w + per; i++) {
      const cx = i * per - off + per / 2 + 0, hh = 20 + 12 * hash(i, 5, 23), tipY = base - k * (2 + hh);
      const cw = hh * k * 0.35;
      inkPoly(g, [R(cx), R(tipY), R(cx + cw * 0.6), R(tipY + hh * k * 0.3), R(cx + cw * 0.15), R(tipY + hh * k * 0.24), R(cx - cw * 0.2), R(tipY + hh * k * 0.33), R(cx - cw * 0.6), R(tipY + hh * k * 0.3)], P.sky[2]);
    }
  }
}

/** The near forms, per climate, and the ground under them to the rect's bottom. */
function drawNear(g: CanvasRenderingContext2D, c: Climate, x: number, w: number, y: number, h: number, bottom: number, off: number, P: ClimatePhase, k: number): void {
  const base = y + h * 0.74;
  const x1 = x + w;
  switch (c) {
    case 'meadow': {
      ridgeFill(g, x, x1, bottom, off, (u) => base - k * (5 + 6 * Math.sin(u / (46 * k) + 0.5)), P.near, Math.max(1, R(k)));
      // hedgerows: rows of round blobs on the hills, every 90 px
      const per = 90 * k;
      for (let i = Math.floor((off + x - per) / per); i * per - off < x1 + per; i++) {
        const cx = i * per - off + per * hash(i, 7, 3) * 0.5, n = 3 + (mix32(i, 9) % 3);
        const gy = base - k * (5 + 6 * Math.sin((cx + off) / (46 * k) + 0.5));
        for (let j = 0; j < n; j++) inkDisc(g, R(cx + j * 7 * k), R(gy - 2 * k), R(4.5 * k), P.detail);
      }
      break;
    }
    case 'caves': {
      ridgeFill(g, x, x1, bottom, off, (u) => base - k * (4 + 7 * Math.sin(u / (40 * k)) * Math.sin(u / (97 * k) + 1)), P.near, Math.max(1, R(k)));
      // rocks (the detail colour) and, once a period, the cave mouth with its one stepped lamp pool
      const per = 260 * k;
      for (let i = Math.floor((off + x - per) / per); i * per - off < x1 + per; i++) {
        const mx = i * per - off + per * 0.55, gy = bottom - R(h * 0.08);
        caveMouth(g, mx, gy, k, P);
        for (const [dx, s] of [[-90, 1], [70, 0.8], [110, 0.6]] as const) inkPoly(g, [R(mx + dx * k - 9 * s * k), R(gy), R(mx + dx * k - 6 * s * k), R(gy - 8 * s * k), R(mx + dx * k + 4 * s * k), R(gy - 10 * s * k), R(mx + dx * k + 10 * s * k), R(gy)], P.detail);
      }
      break;
    }
    case 'forest': {
      // the forest floor, then round-crowned trees on trunks (the trunks in the detail wood)
      ridgeFill(g, x, x1, bottom, off, (u) => base + k * 6 - k * (2 + 2 * Math.sin(u / (30 * k))), P.near, Math.max(1, R(k)));
      const per = 54 * k;
      for (let i = Math.floor((off + x - per) / per); i * per - off < x1 + per; i++) {
        const cx = i * per - off + per * 0.5 + (hash(i, 11, 5) - 0.5) * 16 * k, s = 0.8 + 0.4 * hash(i, 13, 5);
        const foot = base + k * 8, crown = foot - k * (30 * s);
        inkPoly(g, [R(cx - 3 * k), R(foot), R(cx - 2 * k), R(crown + 6 * k), R(cx + 2 * k), R(crown + 6 * k), R(cx + 3 * k), R(foot)], P.detail);
        for (const [dx, dy, r] of [[-8, 4, 10], [8, 3, 9], [0, -5, 12]] as const) inkDisc(g, R(cx + dx * k * s), R(crown + dy * k * s), R(r * k * s), P.near);
      }
      break;
    }
    case 'peaks': {
      // crags: jagged near rocks, their faces a stepped second colour
      ridgeFill(g, x, x1, bottom, off, (u) => { const per = 46 * k, i = Math.floor(u / per), q = mod(u, per) / per; return base - k * (4 + (10 + 8 * hash(i, 17, 7)) * (1 - Math.abs(q - 0.4) * 1.7)); }, P.near, Math.max(1, R(k)));
      const per = 46 * k;
      for (let i = Math.floor((off + x - per) / per); i * per - off < x1 + per; i++) {
        const ux = i * per - off, hh = (10 + 8 * hash(i, 17, 7)), tip = base - k * (4 + hh);
        inkPoly(g, [R(ux + per * 0.4), R(tip), R(ux + per * 0.62), R(tip + hh * k * 0.55), R(ux + per * 0.46), R(tip + hh * k * 0.7)], P.detail);
      }
      break;
    }
    case 'ice': {
      // the snowbank, then the frozen lake from the bank to the bottom (the lake a step bluer), floes on it
      const lake = base - R(h * 0.02);
      ridgeFill(g, x, x1, bottom, off, (u) => lake - k * (4 + 4 * Math.sin(u / (36 * k))), P.detail, Math.max(1, R(k)));
      ridgeFill(g, x, x1, bottom, off, () => lake + 5 * k, P.near, Math.max(1, R(k)));
      const per = 70 * k;
      for (let i = Math.floor((off + x - per) / per); i * per - off < x1 + per; i++) {
        const cx = i * per - off + per * hash(i, 19, 3), fy = lake + k * (12 + 12 * hash(i, 21, 3)), fw = k * (8 + 8 * hash(i, 23, 3));
        inkPoly(g, [R(cx - fw), R(fy), R(cx - fw * 0.6), R(fy - 3 * k), R(cx + fw * 0.7), R(fy - 3 * k), R(cx + fw), R(fy), R(cx + fw * 0.5), R(fy + 2 * k), R(cx - fw * 0.5), R(fy + 2 * k)], P.detail);
      }
      break;
    }
    case 'ash': {
      ridgeFill(g, x, x1, bottom, off, (u) => base - k * (3 + 5 * Math.sin(u / (52 * k) + 2)), P.near, Math.max(1, R(k)));
      // small cones on the near hills, a stepped flank band on each (lit left, the detail colour)
      const per = 130 * k;
      for (let i = Math.floor((off + x - per) / per); i * per - off < x1 + per; i++) {
        const cx = i * per - off + per * 0.4, s = 0.7 + 0.4 * hash(i, 29, 1), foot = base + k * 4, top = foot - 22 * k * s;
        const q = k * s;
        inkPoly(g, [R(cx - 26 * q), R(foot), R(cx - 16 * q), R(top + 10 * q), R(cx - 9 * q), R(top + 2 * q), R(cx - 5 * q), R(top), R(cx - 2 * q), R(top + 2 * q), R(cx + 2 * q), R(top + 2 * q), R(cx + 5 * q), R(top), R(cx + 9 * q), R(top + 2 * q), R(cx + 16 * q), R(top + 10 * q), R(cx + 26 * q), R(foot)], P.near);
        inkPoly(g, [R(cx - 26 * q), R(foot), R(cx - 16 * q), R(top + 10 * q), R(cx - 9 * q), R(top + 2 * q), R(cx - 5 * q), R(top), R(cx - 4 * q), R(top + 8 * q), R(cx - 12 * q), R(foot)], P.detail);
      }
      break;
    }
  }
}

/** The caves' one cave mouth (a dark arch in a rock face) with its lamp (a 4 x 5 lantern, scaled with the picture) and one stepped pool of its light on the ground. */
function caveMouth(g: CanvasRenderingContext2D, mx: number, gy: number, k: number, P: ClimatePhase): void {
  const rw = 30 * k, rh = 26 * k, mw = 13 * k, mh = 17 * k;
  // the rock face round the mouth
  inkPoly(g, [R(mx - rw), R(gy), R(mx - rw * 0.8), R(gy - rh * 0.7), R(mx - rw * 0.3), R(gy - rh), R(mx + rw * 0.4), R(gy - rh * 0.94), R(mx + rw * 0.85), R(gy - rh * 0.6), R(mx + rw), R(gy)], P.detail);
  // the mouth: an arch
  g.beginPath();
  g.moveTo(R(mx - mw), R(gy)); g.lineTo(R(mx - mw), R(gy - mh + mw)); g.arc(R(mx), R(gy - mh + mw), R(mw), Math.PI, 0); g.lineTo(R(mx + mw), R(gy)); g.closePath();
  g.strokeStyle = INK; g.lineWidth = 2; g.stroke(); g.fillStyle = CAVE.mouth; g.fill();
  // the lamp pool: two stepped half-ellipses on the ground in front of the mouth (outer, then inner), never a gradient
  const [inner, outer] = lampPool(P.near);
  g.fillStyle = outer; g.beginPath(); g.ellipse(R(mx), R(gy + 1), R(mw * 1.9), R(4 * k), 0, Math.PI, 0); g.fill();
  g.fillStyle = inner; g.beginPath(); g.ellipse(R(mx), R(gy + 1), R(mw * 1.1), R(2.5 * k), 0, Math.PI, 0); g.fill();
  // the lamp on its hook at the mouth's side (a 4 x 5 lantern, inked)
  const lx = R(mx + mw + 3 * k), ly = R(gy - mh * 0.7), lw = Math.max(4, R(4 * k)), lh = Math.max(5, R(5 * k));
  g.fillStyle = INK; g.fillRect(lx - 1, ly - 3, 2, 3);
  mark(g, lx - R(lw / 2), ly, lw, lh, CAVE.lamp);
}

/** Rain: 2 x 4 streaks (slanted a px), flat in the rain's colour, scattered over the rect (deterministic places), sliding with the weather's parallax. */
function rain(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, off: number, P: ClimatePhase): void {
  const cell = 26;
  for (let cy = 0; cy < h; cy += cell) for (let cx = -cell; cx < w + cell; cx += cell) {
    const ix = Math.floor((cx + off) / cell), iy = cy / cell;
    const px = x + mod(ix * cell - off, w + 2 * cell) - cell + R(hash(ix, iy, 41) * 16), py = y + cy + R(hash(ix, iy, 43) * 18);
    if (hash(ix, iy, 47) < 0.6) { g.fillStyle = P.mark; g.fillRect(px + 1, py, 2, 2); g.fillRect(px, py + 2, 2, 2); }
  }
}
/** Snow: 2 x 2 flakes, inked, scattered over the rect. */
function snow(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, off: number, P: ClimatePhase): void {
  const cell = 20;
  for (let cy = 0; cy < h; cy += cell) for (let cx = -cell; cx < w + cell; cx += cell) {
    const ix = Math.floor((cx + off) / cell), iy = cy / cell;
    const px = x + mod(ix * cell - off, w + 2 * cell) - cell + R(hash(ix, iy, 53) * 14), py = y + cy + R(hash(ix, iy, 59) * 14);
    if (hash(ix, iy, 61) < 0.6) mark(g, px, py, 2, 2, P.mark);
  }
}
/** Heat bands: 2 px stepped wavy lines in the low sky (the warm air over the ash hills), never a gradient. */
function heatBands(g: CanvasRenderingContext2D, x: number, w: number, y0: number, y1: number, off: number, P: ClimatePhase, k: number): void {
  const rows = 3;
  for (let r = 0; r < rows; r++) {
    const by = R(y0 + (y1 - y0) * (r + 0.5) / rows);
    for (let sx = 0; sx < w; sx += 6) {
      const u = sx + off * (1 + r * 0.3), dy = [0, -1, -2, -1, 0, 1, 2, 1][mod(Math.floor(u / 6), 8)];
      if (mod(Math.floor(u / 48) + r, 3) === 2) continue;
      g.fillStyle = P.mark; g.fillRect(x + sx, by + R(dy * Math.min(k, 1.5)), 6, 2);
    }
  }
}
/** The peaks' storm: flat inked cloud banks high in the sky and a 3 px bolt out of each (ink round it). */
function stormClouds(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, off: number, P: ClimatePhase, k: number): void {
  const per = 150 * k;
  for (let i = Math.floor((off + x - per) / per); i * per - off < x + w + per; i++) {
    const cx = i * per - off + per * 0.4, cy = y + h * 0.16;
    for (const [dx, dy, r] of [[-16, 3, 9], [0, -2, 12], [16, 2, 10], [28, 5, 7]] as const) inkDisc(g, R(cx + dx * k), R(cy + dy * k), R(r * k), P.detail);
    g.fillStyle = P.detail; g.fillRect(R(cx - 16 * k), R(cy + 2 * k), R(44 * k), R(7 * k));
    g.fillStyle = INK; g.fillRect(R(cx - 16 * k), R(cy + 9 * k), R(44 * k), 1);
    // the bolt: a zig-zag, 3 px wide in its colour inside a 5 px ink stroke
    const bx = cx + 6 * k, by = cy + 9 * k, pts = [bx, by, bx - 5 * k, by + 9 * k, bx + 1 * k, by + 9 * k, bx - 4 * k, by + 19 * k];
    for (const [lw, col] of [[5, INK], [3, P.mark]] as const) {
      g.strokeStyle = col; g.lineWidth = lw; g.lineJoin = 'miter'; g.lineCap = 'butt';
      g.beginPath(); g.moveTo(R(pts[0]), R(pts[1])); for (let j = 2; j < pts.length; j += 2) g.lineTo(R(pts[j]), R(pts[j + 1])); g.stroke();
    }
  }
}
