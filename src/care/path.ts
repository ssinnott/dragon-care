// Walking round the dragons (docs/KEEPERS.md 6.2). A keeper stands one and a half to two and a half dragons tall, and
// in front of a dragon (nearer the camera, lower on the screen) it is drawn over it: walking across a scene in a
// straight line it passed over dragons' heads, their eyes covered for up to 1.4 s at a time (the hard rule "nothing
// covers the eye", bible 1.4, K7), and walked through their bodies, its feet on a dragon's own floor line inside its
// length. So a walk is PLANNED: A* on a grid over the floor (CELL px), where a cell is closed to a keeper's feet if
//   - they would stand on a dragon's FOOTPRINT (along its length and the width of the keeper's feet: its floor line
//     and FOOT_BAND in front of it, and behind it up to the top of its back, where its body would hide the keeper's
//     feet and the keeper read as standing in the dragon), or
//   - the keeper standing there, level with a dragon or in front of it, would be drawn over the dragon's EYE box
//     (grown: the dragons move while the keeper walks). Behind a dragon a keeper is drawn under it and covers nothing.
// Walking into the scene costs DEPTH_COST x walking along it (a side-on walk cycle carries a walk along the floor; a
// keeper sliding up the screen reads as gliding), so a path runs along the floor and crosses between the rows on the
// diagonal. It is pulled taut into a few straight legs no steeper than MAX_SLOPE (acts.ts walkTo follows such a leg
// exactly), and a walk plans again every REPLAN frames, since the dragons move.
import type { Box } from './keeper.ts';

/** A keeper as its walk sees it, on screen: its half width, its feet's half span and its height over its feet, px. */
export interface Walker { hw: number; fw: number; h: number }

/**
 * A dragon as a walk sees it, on screen: its floor line, the top of its back, its length along the floor, and its eye
 * box (grown), px.
 */
export interface Obstacle { y: number; top: number; x0: number; x1: number; eye: Box }

/** The floor a walk may use, screen px. */
export interface Floor { x0: number; y0: number; x1: number; y1: number }

/** The grid, px. */
const CELL = 4;
/** What a px of walking into the scene costs against a px along it. */
const DEPTH_COST = 2.2;
/** A dragon's footprint: its floor line give or take this many px (a keeper at work stands just outside it). */
export const FOOT_BAND = 7;
/** The steepest a walk's leg runs on screen, px into the scene per px along it. */
const MAX_SLOPE = 1;
/** Frames between a walker's plans. */
export const REPLAN = 24;

/**
 * Is (x, y) closed to a walker's feet: on a dragon's footprint (its floor line give or take FOOT_BAND, and behind it up
 * to the top of its back, where the dragon's body hides the keeper's feet and the keeper reads as standing in it), or
 * (level with the dragon or in front) with the keeper over its eye?
 */
export function blocked(x: number, y: number, w: Walker, obs: readonly Obstacle[]): boolean {
  for (const o of obs) {
    if (y > o.top && y < o.y + FOOT_BAND && x + w.fw > o.x0 && x - w.fw < o.x1) return true;
    if (y >= o.y && x + w.hw > o.eye.x0 && x - w.hw < o.eye.x1 && y - w.h < o.eye.y1) return true;
  }
  return false;
}

/** A small binary min-heap of cell indices keyed by f (A*'s open set). */
class Heap {
  private a: number[] = [];
  constructor(private readonly f: Float64Array) {}
  get size(): number { return this.a.length; }
  push(i: number): void {
    const a = this.a, f = this.f;
    a.push(i);
    let c = a.length - 1;
    while (c > 0) { const p = (c - 1) >> 1; if (f[a[p]] <= f[a[c]]) break; [a[p], a[c]] = [a[c], a[p]]; c = p; }
  }
  pop(): number {
    const a = this.a, f = this.f, top = a[0], last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let c = 0;
      for (;;) {
        const l = 2 * c + 1, r = l + 1;
        let m = c;
        if (l < a.length && f[a[l]] < f[a[m]]) m = l;
        if (r < a.length && f[a[r]] < f[a[m]]) m = r;
        if (m === c) break;
        [a[m], a[c]] = [a[c], a[m]]; c = m;
      }
    }
    return top;
  }
}

/**
 * The way from (sx, sy) to (tx, ty) for a walker among the obstacles, on the floor: the points to walk to, in order,
 * the last of them (tx, ty). The start and the goal are open whatever stands there (a keeper may start, or work, next
 * to a dragon); with no way at all, the goal alone (walked to straight).
 */
export function findPath(sx: number, sy: number, tx: number, ty: number, w: Walker, obs: readonly Obstacle[], fl: Floor): { x: number; y: number }[] {
  const nx = Math.max(2, Math.ceil((fl.x1 - fl.x0) / CELL) + 1), ny = Math.max(2, Math.ceil((fl.y1 - fl.y0) / CELL) + 1);
  const cx = (x: number) => Math.min(nx - 1, Math.max(0, Math.round((x - fl.x0) / CELL)));
  const cy = (y: number) => Math.min(ny - 1, Math.max(0, Math.round((y - fl.y0) / CELL)));
  const px = (i: number) => fl.x0 + i * CELL, py = (j: number) => fl.y0 + j * CELL;
  const free = new Uint8Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) free[j * nx + i] = blocked(px(i), py(j), w, obs) ? 0 : 1;
  // a start or a goal on a closed cell (a dragon's eye came to the keeper; a keeper at work beside a dragon) goes by
  // the nearest open cell: out of it the shortest way, or up to the spot straight from it
  const nearestOpen = (c: number): number => {
    if (free[c]) return c;
    const seen = new Uint8Array(nx * ny), q = [c];
    seen[c] = 1;
    for (let h = 0; h < q.length; h++) {
      const i = q[h] % nx, j = (q[h] / nx) | 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const a = i + di, b = j + dj, n = b * nx + a;
        if (a < 0 || b < 0 || a >= nx || b >= ny || seen[n]) continue;
        if (free[n]) return n;
        seen[n] = 1; q.push(n);
      }
    }
    return c;
  };
  const s0 = cy(sy) * nx + cx(sx), g0 = cy(ty) * nx + cx(tx), s = nearestOpen(s0), g = nearestOpen(g0);
  const out: { x: number; y: number }[] = s !== s0 ? [{ x: px(s % nx), y: py((s / nx) | 0) }] : [];
  if (s !== s0) { sx = px(s % nx); sy = py((s / nx) | 0); }
  const gx = g !== g0 ? px(g % nx) : tx, gy = g !== g0 ? py((g / nx) | 0) : ty;
  const G = new Float64Array(nx * ny).fill(Infinity), F = new Float64Array(nx * ny).fill(Infinity), from = new Int32Array(nx * ny).fill(-1);
  const gi = g % nx, gj = (g / nx) | 0;
  const h = (i: number, j: number) => Math.hypot((gi - i) * CELL, (gj - j) * CELL * DEPTH_COST);
  const open = new Heap(F), done = new Uint8Array(nx * ny);
  G[s] = 0; F[s] = h(s % nx, (s / nx) | 0); open.push(s);
  while (open.size) {
    const c = open.pop();
    if (done[c]) continue;
    if (c === g) break;
    done[c] = 1;
    const ci = c % nx, cj = (c / nx) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const i = ci + di, j = cj + dj;
      if (i < 0 || j < 0 || i >= nx || j >= ny) continue;
      const n = j * nx + i;
      if (!free[n] || done[n]) continue;
      const cost = G[c] + Math.hypot(di * CELL, dj * CELL * DEPTH_COST);
      if (cost < G[n]) { G[n] = cost; F[n] = cost + h(i, j); from[n] = c; open.push(n); }
    }
  }
  if (from[g] < 0 && g !== s) return [...out, { x: tx, y: ty }];
  const cells: number[] = [];
  for (let c = g; c !== -1 && c !== s; c = from[c]) cells.push(c);
  cells.reverse();
  // pull it taut: from each corner, on to the farthest later cell the straight way to which stays on open cells and no
  // steeper than MAX_SLOPE
  const clear = (x0: number, y0: number, x1: number, y1: number): boolean => {
    const dx = x1 - x0, dy = y1 - y0;
    if (Math.abs(dy) > MAX_SLOPE * Math.abs(dx) + CELL) return false;
    const n = Math.ceil(Math.hypot(dx, dy) / (CELL / 2));
    for (let k = 1; k < n; k++) if (!free[cy(y0 + (dy * k) / n) * nx + cx(x0 + (dx * k) / n)]) return false;
    return true;
  };
  const pts: { x: number; y: number }[] = [...out];
  let ax = sx, ay = sy, k = 0;
  while (k < cells.length) {
    let far = k;
    for (let m = cells.length - 1; m > k; m--) {
      const c = cells[m], x = m === cells.length - 1 ? gx : px(c % nx), y = m === cells.length - 1 ? gy : py((c / nx) | 0);
      if (clear(ax, ay, x, y)) { far = m; break; }
    }
    const c = cells[far], last = far === cells.length - 1;
    ax = last ? gx : px(c % nx); ay = last ? gy : py((c / nx) | 0);
    pts.push({ x: ax, y: ay });
    k = far + 1;
  }
  if (g !== g0) pts.push({ x: tx, y: ty });
  return pts.length ? pts : [{ x: tx, y: ty }];
}
