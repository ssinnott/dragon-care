// The base's building (docs/BASE_DESIGN.md 2): a barn of six 160 px modules on three floors with a hay hoist up its
// middle, and a five-floor tower at each end, at the game's scale 1. Rooms are data placed on it; the walkable floor
// spans and the ladders and hoist between them make the keepers' routes. Geometry and data only: base.ts draws it,
// sim.ts walks it.
import type { NeedKind } from './needs.ts';

// ---------- the grid (px at scale 1) ----------

/** A barn module (one adult and a baby), the floor pitch, the hoist shaft and a tower's width (2's table). */
export const MOD = 160, PITCH = 112, HOIST_W = 64, TOWER_W = 112;
/** A room's box, top down: 88 px of wall, a 14 px straw band the feet stand in, a 10 px slab. */
export const WALL_H = 88, BAND = 14, SLAB = 10;
/** The towers' walls (the barn's two ends are the towers' inner walls). */
export const WALL = 8;
/** The world: about 2 x 2 screens, the ground at y 712. */
export const WORLD_W = 1360, WORLD_H = 760, GROUND = 712;
export const TOWER_L = 56, BARN_X = TOWER_L + TOWER_W, BARN_MODS = 6, BARN_W = BARN_MODS * MOD + HOIST_W, TOWER_R = BARN_X + BARN_W;
export const BARN_FLOORS = 3, TOWER_FLOORS = 5;
/** The hoist shaft, between barn modules 2 and 3. */
export const HOIST_X = BARN_X + 3 * MOD, HOIST_CX = HOIST_X + HOIST_W / 2;
/** The gambrel roof over the hayloft (floor 2): its ridge, and the knee where the steep lower slope turns. */
export const RIDGE_X = BARN_X + BARN_W / 2, RIDGE_Y = 276, KNEE_DX = 58, KNEE_Y = 360;

/** Top of floor f's room box (floor 0 is the ground floor). */
export function floorTop(f: number): number { return GROUND - (f + 1) * PITCH; }
/** Where feet stand on floor f: 8 px into the straw band, `d` px deeper (for depth order). */
export function feetY(f: number, d = 0): number { return floorTop(f) + WALL_H + 8 + d; }
/** Left edge of barn module i. */
export function modX(i: number): number { return BARN_X + i * MOD + (i >= 3 ? HOIST_W : 0); }

// ---------- rooms ----------

export type RoomKind = 'kitchen' | 'groom' | 'sunloft' | 'romp' | 'bath' | 'roost' | 'dorm' | 'hatchery' | 'store' | 'haystore' | 'attic'
  | 'bunks' | 'mess' | 'tack' | 'maproom' | 'lookout' | 'library' | 'workshop' | 'infirmary';

export interface RoomInfo {
  name: string;
  /** The need this room restores, a little at a time, for the dragons living in it (4.6). */
  restores?: NeedKind;
  /** The need whose supply keepers fetch here (4.4): the bowl, the ball, the bucket. */
  supplies?: NeedKind;
  /** Where the supply is, or the keepers' post, px from the room's left edge (default: the middle). */
  post?: number;
  /** A room for people (the towers'); no dragon lives in one. */
  people?: boolean;
}
export const ROOM_INFO: Readonly<Record<RoomKind, RoomInfo>> = Object.freeze({
  kitchen: { name: 'HEARTH KITCHEN', restores: 'food', supplies: 'food', post: 64 },
  groom: { name: 'GROOMING', restores: 'love', post: 120 },
  sunloft: { name: 'SUN LOFT', restores: 'love' },
  romp: { name: 'ROMP ROOM', restores: 'play', supplies: 'play', post: 107 },
  bath: { name: 'BATHHOUSE', restores: 'bath', supplies: 'bath', post: 226 },
  roost: { name: 'SONG ROOST', restores: 'love' },
  dorm: { name: 'LAMP DORM', restores: 'sleep' },
  hatchery: { name: 'HATCHERY' },
  store: { name: 'FEED STORE' },
  haystore: { name: 'HAY STORE' },
  attic: { name: 'ATTIC' },
  bunks: { name: 'BUNKS', people: true },
  mess: { name: 'MESS HALL', people: true },
  tack: { name: 'TACK ROOM', people: true },
  maproom: { name: 'MAP ROOM', people: true },
  lookout: { name: 'LOOKOUT', people: true },
  library: { name: 'LIBRARY', people: true },
  workshop: { name: 'WORKSHOP', people: true },
  infirmary: { name: 'INFIRMARY', people: true },
});

export type Part = 'barn' | 'towerL' | 'towerR';
/** Where a room goes: a barn room by its first module and width (never across the hoist), a tower room by floor. */
export interface RoomPlace { kind: RoomKind; part: Part; floor: number; mod?: number; width?: number }
export interface Room { id: number; kind: RoomKind; part: Part; floor: number; x0: number; x1: number }

/** Place rooms on the grid, checking each fits the building and overlaps no other. */
export function placeRooms(places: readonly RoomPlace[]): Room[] {
  const rooms = places.map((p, id): Room => {
    if (p.part === 'barn') {
      const m = p.mod ?? 0, w = p.width ?? 1;
      if (p.floor < 0 || p.floor >= BARN_FLOORS || m < 0 || w < 1 || w > 3 || m + w > BARN_MODS || (m < 3 && m + w > 3)) throw new Error(`room ${p.kind}: no barn slot at floor ${p.floor}, modules ${m}..${m + w - 1}`);
      return { id, kind: p.kind, part: p.part, floor: p.floor, x0: modX(m), x1: modX(m) + w * MOD };
    }
    if (p.floor < 0 || p.floor >= TOWER_FLOORS) throw new Error(`room ${p.kind}: no tower floor ${p.floor}`);
    const x = p.part === 'towerL' ? TOWER_L : TOWER_R;
    return { id, kind: p.kind, part: p.part, floor: p.floor, x0: x + WALL, x1: x + TOWER_W - WALL };
  });
  for (const a of rooms) for (const b of rooms) if (a.id < b.id && a.floor === b.floor && a.x0 < b.x1 && b.x0 < a.x1) throw new Error(`rooms ${a.kind} and ${b.kind} overlap`);
  return rooms;
}

/** A room's supply spot or post, world x. */
export function postX(r: Room): number { return r.x0 + (ROOM_INFO[r.kind].post ?? (r.x1 - r.x0) / 2); }

// ---------- walking: floor spans, ladders, the hoist, routes ----------

/** A keeper's half-width: how close to a wall their feet come. */
const PAD = 10;
const TL: [number, number] = [TOWER_L + WALL + PAD, TOWER_L + TOWER_W - WALL - PAD];
const TR: [number, number] = [TOWER_R + WALL + PAD, TOWER_R + TOWER_W - WALL - PAD];
/**
 * The walkable spans of each floor. The towers open into the barn on the ground and upper floors, so each of those
 * is one span end to end; the hayloft is cut off from the towers by the roof, and above it only the towers go on.
 */
export const SPANS: readonly (readonly [number, number])[][] = [
  [[TL[0], TR[1]]],
  [[TL[0], TR[1]]],
  [TL, [BARN_X + 16, TOWER_R - 16], TR],
  [TL, TR],
  [TL, TR],
];
/** A way between floors: a ladder or the hoist, at x, serving floors lo..hi. */
export interface Link { name: 'ladderL' | 'ladderR' | 'hoist'; x: number; lo: number; hi: number }
export const LINKS: readonly Link[] = [
  { name: 'ladderL', x: TOWER_L + 84, lo: 0, hi: TOWER_FLOORS - 1 },
  { name: 'ladderR', x: TOWER_R + TOWER_W - 84, lo: 0, hi: TOWER_FLOORS - 1 },
  { name: 'hoist', x: HOIST_CX, lo: 0, hi: BARN_FLOORS - 1 },
];
/** A px climbed costs this many walked (a keeper climbs at 0.8 of their walking pace). */
export const CLIMB_COST = 1.25;

export interface Spot { f: number; x: number }
/** One leg of a route: walk along floor f to x, or, where f changes from the leg before, climb to floor f at x. */
export type Leg = Spot;

/** The span of floor f holding x (-1: none). */
export function spanOf(f: number, x: number): number {
  const sp = SPANS[f];
  if (!sp) return -1;
  for (let i = 0; i < sp.length; i++) if (x >= sp[i][0] - 0.5 && x <= sp[i][1] + 0.5) return i;
  return -1;
}
/** x clamped into the span of floor f nearest it. */
export function clampToFloor(f: number, x: number): number {
  let best = x, d = Infinity;
  for (const [a, b] of SPANS[f]) { const c = Math.max(a, Math.min(b, x)), e = Math.abs(c - x); if (e < d) { d = e; best = c; } }
  return best;
}

/**
 * The cheapest route between two spots (Dijkstra over the ladder and hoist stops: at most 15 nodes), as legs, with its
 * cost in walked px; null if there is none. Ties go to the lower node index, so a route is the same every run.
 */
export function route(from: Spot, to: Spot): { legs: Leg[]; cost: number } | null {
  const fs = spanOf(from.f, from.x), ts = spanOf(to.f, to.x);
  if (fs < 0 || ts < 0) return null;
  if (from.f === to.f && fs === ts) return { legs: [{ f: to.f, x: to.x }], cost: Math.abs(to.x - from.x) };
  const nodes: Spot[] = [from, to];
  const up: number[] = [-1, -1];
  for (const l of LINKS) for (let f = l.lo; f <= l.hi; f++) { up.push(f > l.lo ? nodes.length - 1 : -1); nodes.push({ f, x: l.x }); }
  const n = nodes.length, dist = new Array<number>(n).fill(Infinity), prev = new Array<number>(n).fill(-1), done = new Array<boolean>(n).fill(false);
  const span = nodes.map((s) => spanOf(s.f, s.x));
  dist[0] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || u === 1) break;
    done[u] = true;
    const relax = (v: number, c: number) => { if (dist[u] + c < dist[v]) { dist[v] = dist[u] + c; prev[v] = u; } };
    for (let v = 0; v < n; v++) if (!done[v] && v !== u && nodes[v].f === nodes[u].f && span[v] === span[u] && span[u] >= 0) relax(v, Math.abs(nodes[v].x - nodes[u].x));
    // the climbs: to the stop below (up[u]) and above (the node whose up is u)
    if (up[u] >= 0 && !done[up[u]]) relax(up[u], PITCH * CLIMB_COST);
    const above = up.indexOf(u, 2);
    if (above >= 0 && !done[above]) relax(above, PITCH * CLIMB_COST);
  }
  if (dist[1] === Infinity) return null;
  const legs: Leg[] = [];
  for (let v = 1; v > 0; v = prev[v]) legs.unshift({ f: nodes[v].f, x: nodes[v].x });
  return { legs, cost: dist[1] };
}
