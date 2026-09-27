// The Map Room's world map (docs/BASE_DESIGN.md 5.1; ART_BIBLE 5.10 "The world map"): the land the missions go out
// into, drawn as a little pixel-art world. The sea round its coast; each region's own ground and what grows or stands on
// it -- Millbrook's fields, hedges and trees, Bramblewood's wood, the Highfold peaks, the Old Mine Road's mesas and
// rocks, Frostmere's snow, pines and frozen mere, Emberfell's smoking cones and cinders; the lake in the middle and the
// brook that runs down from the peaks, through it and out to the sea; the roads between the places; HOME (the barn
// between its two towers); every place's landmark (regions.ts Place: the mill, the mine mouth, the owl's oak...); and
// cloud over each region not explored yet, so its land and places are hidden until a success next door clears it.
//
// House style (ART_BIBLE "the house style"): every mark whole pixels -- no anti-aliased edge, no alpha, never a
// gradient -- each shape ringed in 1 px #1a1018 ink, flat fills lit from the top left. The land is a pure function of
// the constants below: every choice is a fixed hash of where it is (value noise, jittered grids; a road's bends by its
// ends' names), never Math.random, so the map is the same in every game and every run. It is painted once into a raster (`worldRaster`: plain RGBA, so Node reads it too --
// sim-check's map checks) per set of regions under cloud; the view keeps each as a canvas (`worldCanvas`) and draws
// the living parts over it every frame (`drawAlive`: the sea's glints, the mill's turning sails, smoke and steam, the
// ridge's lightning), from the view's own frame count: the world waits while the map is open, the map does not.
import { mix32 } from './rand.ts';
import { INK } from './surfaces.ts';
import { REGIONS, MAP_HOME, regionOf } from './regions.ts';
import type { Place, PlaceArt } from './regions.ts';
import type { Climate, RegionId } from './missiondata.ts';
import type { Rect, Sprite } from './icons.ts';

/** The map's picture: the Map Room panel's parchment, inside its border (maptable.ts PANEL), screen px. */
export const MAP_RECT: Readonly<Rect> = Object.freeze({ x: 12, y: 22, w: 616, h: 310 });
const X0 = MAP_RECT.x, Y0 = MAP_RECT.y, W = MAP_RECT.w, H = MAP_RECT.h;

// ---------- noise (placement only: never simulation state) ----------

/** A deterministic 0..1 for three integer keys (a murmur3-style finaliser over them: cheap enough for a pixel loop). */
function h01(a: number, b: number, salt: number): number {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b1);
  h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
/** A value-noise lattice over the map's range (and a margin), for one salt at one frequency: made once, then read. */
interface Lattice { f: number; ox: number; oy: number; gw: number; gh: number; v: Float32Array }
const LATTICES = new Map<number, Lattice>();
function lattice(salt: number, f: number): Lattice {
  const had = LATTICES.get(salt);
  if (had && had.f === f) return had;
  const ox = Math.floor((X0 - 64) * f) - 1, oy = Math.floor((Y0 - 64) * f) - 1;
  const gw = Math.ceil((X0 + W + 64) * f) - ox + 3, gh = Math.ceil((Y0 + H + 64) * f) - oy + 3, v = new Float32Array(gw * gh);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) v[j * gw + i] = h01(ox + i, oy + j, salt);
  const l = { f, ox, oy, gw, gh, v };
  LATTICES.set(salt, l);
  return l;
}
/** Smooth value noise from a lattice already made, at (x, y) px, 0..1. */
function lvalue(L: Lattice, x: number, y: number, salt: number): number {
  const gx = x * L.f, gy = y * L.f, xi = Math.floor(gx), yi = Math.floor(gy);
  const fx = gx - xi, fy = gy - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const i = xi - L.ox, j = yi - L.oy;
  let a: number, b: number, c: number, d: number;
  if (i >= 0 && j >= 0 && i + 1 < L.gw && j + 1 < L.gh) { const o = j * L.gw + i; a = L.v[o]; b = L.v[o + 1]; c = L.v[o + L.gw]; d = L.v[o + L.gw + 1]; }
  else { a = h01(xi, yi, salt); b = h01(xi + 1, yi, salt); c = h01(xi, yi + 1, salt); d = h01(xi + 1, yi + 1, salt); }
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/**
 * Fractal value noise at a feature size of `scale` px, `oct` octaves, about -1..1, as a function of (x, y) px: its
 * lattices made once, so a pixel loop reads it cheaply.
 */
type Field = (x: number, y: number) => number;
const FIELDS_MADE = new Map<string, Field>();
function field(scale: number, salt: number, oct = 3): Field {
  const key = `${scale}:${salt}:${oct}`, had = FIELDS_MADE.get(key);
  if (had) return had;
  const ls: Lattice[] = [], salts: number[] = [];
  for (let o = 0, f = 1 / scale; o < oct; o++, f *= 2) { ls.push(lattice(salt + o * 131, f)); salts.push(salt + o * 131); }
  const norm = (2 - Math.pow(0.5, oct - 1));
  const fn: Field = (x, y) => {
    let sum = 0, amp = 1;
    for (let o = 0; o < oct; o++) { sum += amp * (lvalue(ls[o], x, y, salts[o]) * 2 - 1); amp *= 0.5; }
    return sum / norm;
  };
  FIELDS_MADE.set(key, fn);
  return fn;
}
/** fbm at one point (a field made on its first use). */
const fbm = (x: number, y: number, scale: number, salt: number, oct = 3): number => field(scale, salt, oct)(x, y);

// ---------- the land's shape ----------

/**
 * The continent: a rounded box around (cx, cy), half sizes (a, b), squareness p, its coast pushed about by noise (warp
 * px, and `rough` of its size); `bumps` hold land out into the sea (HOME's shore), `bays` let the sea in.
 */
const COAST = Object.freeze({ cx: 322, cy: 178, a: 288, b: 144, p: 2.4, warp: 16, rough: 0.1 });
const BUMPS: readonly (readonly [number, number, number])[] = [[64, 262, 30], [30, 176, 18], [604, 250, 16], [296, 22, 14]];
const BAYS: readonly (readonly [number, number, number])[] = [
  [20, 334, 34], [624, 22, 30], [424, 350, 28], [14, 28, 26], [176, 12, 22], [636, 176, 18], [256, 346, 14], [20, 96, 12],
];
/** Islets off the coast (centre, radius): each is its nearest region's land. */
const ISLETS: readonly (readonly [number, number, number])[] = [[36, 54, 7], [600, 312, 7], [474, 326, 5], [146, 320, 5], [604, 48, 6], [232, 32, 4]];
/** The lake in the middle (fresh water: the brook runs into it from the peaks, and out of it to the sea), and Frostmere's frozen mere. */
const LAKE_AT = Object.freeze({ cx: 322, cy: 204, rx: 74, ry: 26 });
const MERE_AT = Object.freeze({ cx: 502, cy: 236, rx: 38, ry: 13 });
/** How strongly each region's land grows from its site (a weighted nearest-site split: more is wider). */
const REACH: Readonly<Record<RegionId, number>> = Object.freeze({ millbrook: 1.0, oldmine: 0.96, bramblewood: 1.1, highfold: 0.94, frostmere: 1.06, emberfell: 1.0 });

/** What a pixel of the map is. */
export const SEA = 0, LAND = 1, LAKE = 2, MERE = 3;
/** The land: each pixel's kind (SEA, LAND, LAKE or MERE: the mere is Frostmere's, frozen), its region (an index into REGIONS; -1 for water but the mere), and its distance across the shore (1..8, 9 further: land from water, water from land). */
export interface Land { kind: Uint8Array; region: Int8Array; shore: Uint8Array }

let LAND_CACHE: Land | null = null;
/** The map's land, pixel by pixel (MAP_RECT's, row by row): made once, the same every time. */
export function worldLand(): Land {
  if (LAND_CACHE) return LAND_CACHE;
  const kind = new Uint8Array(W * H), region = new Int8Array(W * H), shore = new Uint8Array(W * H);
  const sites = REGIONS.map((r) => ({ x: r.map.site[0], y: r.map.site[1], k2: 1 / (REACH[r.id] * REACH[r.id]) }));
  const frost = REGIONS.findIndex((r) => r.id === 'frostmere');
  const coastX = field(46, 11), coastY = field(46, 12), rough = field(22, 13);
  const regX = field(72, 21), regY = field(72, 22), lakeN = field(14, 31), mereN = field(12, 32);
  const inv = 1 / COAST.p;
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const x = X0 + i, y = Y0 + j, at = j * W + i;
      // the coast (warped: never a smooth curve)
      const wx = x + coastX(x, y) * COAST.warp, wy = y + coastY(x, y) * COAST.warp;
      const q = Math.pow(Math.pow(Math.abs(wx - COAST.cx) / COAST.a, COAST.p) + Math.pow(Math.abs(wy - COAST.cy) / COAST.b, COAST.p), inv);
      let land = q < 1 + COAST.rough * rough(x, y);
      for (let n = 0; n < BUMPS.length; n++) { const b = BUMPS[n], dx = wx - b[0], dy = wy - b[1]; if (dx * dx + dy * dy < b[2] * b[2]) land = true; }
      for (let n = 0; n < BAYS.length; n++) { const b = BAYS[n], dx = wx - b[0], dy = wy - b[1]; if (dx * dx + dy * dy < b[2] * b[2]) land = false; }
      for (let n = 0; n < ISLETS.length; n++) {
        const bx = ISLETS[n][0], by = ISLETS[n][1], br = ISLETS[n][2];
        if (Math.abs(x - bx) > br + 2 || Math.abs(y - by) > br + 2) continue;
        // (a wobbly round: its radius swells and dips three times round it)
        const a = Math.atan2(y - by, x - bx), r = br * (1 + 0.18 * Math.sin(a * 3 + bx));
        if ((x - bx) ** 2 + (y - by) ** 2 < r * r) land = true;
      }
      if (!land) { kind[at] = SEA; region[at] = -1; continue; }
      // the regions' borders: the nearest site, weighted, over a coarser warp
      const rx = x + regX(x, y) * 50, ry = y + regY(x, y) * 40;
      let best = 0, bestD = Infinity;
      for (let n = 0; n < sites.length; n++) { const S = sites[n], dx = rx - S.x, dy = ry - S.y, d = (dx * dx + dy * dy) * S.k2; if (d < bestD) { bestD = d; best = n; } }
      const lx = (wx - LAKE_AT.cx) / LAKE_AT.rx, ly = (wy - LAKE_AT.cy) / LAKE_AT.ry;
      const mx = (wx - MERE_AT.cx) / MERE_AT.rx, my = (wy - MERE_AT.cy) / MERE_AT.ry;
      if (lx * lx + ly * ly < 1.3 && lx * lx + ly * ly < 1 + 0.12 * lakeN(x, y)) { kind[at] = LAKE; region[at] = -1; }
      else if (mx * mx + my * my < 1.3 && mx * mx + my * my < 1 + 0.1 * mereN(x, y)) { kind[at] = MERE; region[at] = frost; }
      else { kind[at] = LAND; region[at] = best; }
    }
  }
  // the distance across the shore, both ways (4-neighbour steps, 1..8; 9 further): a breadth-first walk from every pixel
  // that touches the other side
  const wet = new Uint8Array(W * H);
  for (let at = 0; at < W * H; at++) wet[at] = kind[at] === SEA || kind[at] === LAKE ? 1 : 0;
  let front = new Int32Array(W * H), next = new Int32Array(W * H), nf = 0;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const at = j * W + i, w0 = wet[at];
    if ((i > 0 && wet[at - 1] !== w0) || (i < W - 1 && wet[at + 1] !== w0) || (j > 0 && wet[at - W] !== w0) || (j < H - 1 && wet[at + W] !== w0)) { shore[at] = 1; front[nf++] = at; }
  }
  for (let d = 2; d <= 8 && nf; d++) {
    let nn = 0;
    for (let k = 0; k < nf; k++) {
      const at = front[k], i = at % W, w0 = wet[at];
      if (i > 0 && !shore[at - 1] && wet[at - 1] === w0) { shore[at - 1] = d; next[nn++] = at - 1; }
      if (i < W - 1 && !shore[at + 1] && wet[at + 1] === w0) { shore[at + 1] = d; next[nn++] = at + 1; }
      if (at >= W && !shore[at - W] && wet[at - W] === w0) { shore[at - W] = d; next[nn++] = at - W; }
      if (at < W * (H - 1) && !shore[at + W] && wet[at + W] === w0) { shore[at + W] = d; next[nn++] = at + W; }
    }
    [front, next] = [next, front]; nf = nn;
  }
  for (let at = 0; at < W * H; at++) if (!shore[at]) shore[at] = 9;
  return (LAND_CACHE = { kind, region, shore });
}

/** The pixel's index in the land's arrays, or -1 off the map. */
export function landAt(x: number, y: number): number {
  const i = Math.round(x) - X0, j = Math.round(y) - Y0;
  return i < 0 || j < 0 || i >= W || j >= H ? -1 : j * W + i;
}
const BOXES = new Map<RegionId, Rect>();
/** A region's bounding box on the map (screen px): its land's, its frozen mere's among it (a tap on its cloud). */
export function regionBox(id: RegionId): Rect {
  const had = BOXES.get(id);
  if (had) return had;
  const L = worldLand(), ri = REGIONS.findIndex((r) => r.id === id);
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (L.region[j * W + i] === ri) { x0 = Math.min(x0, i); x1 = Math.max(x1, i); y0 = Math.min(y0, j); y1 = Math.max(y1, j); }
  const r = x1 < 0 ? { x: 0, y: 0, w: 0, h: 0 } : { x: X0 + x0, y: Y0 + y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  BOXES.set(id, r);
  return r;
}
/** The region a map point is in (by id), or null for water. */
export function regionAt(x: number, y: number): RegionId | null {
  const at = landAt(x, y), L = worldLand();
  return at < 0 || L.region[at] < 0 ? null : REGIONS[L.region[at]].id;
}

// ---------- the brook and the roads ----------

/** The brook: down from the Highfold snows into the lake, and out of it south to the sea (control points; widths at each end). */
const RIVERS: readonly { pts: readonly (readonly [number, number])[]; w0: number; w1: number }[] = [
  { pts: [[296, 70], [304, 96], [296, 122], [310, 150], [316, 184]], w0: 2, w1: 3 },
  { pts: [[334, 226], [340, 250], [332, 270], [338, 292], [344, 340]], w0: 3, w1: 4 },
];

/**
 * Road junctions (screen px) the roads meet at: west of HOME, by the lake's north-west shore, where the road east to
 * Frostmere forks, and on the road over the north from Thunder Ridge to Emberfell.
 */
const JUNCTIONS: Readonly<Record<string, readonly [number, number]>> = Object.freeze({
  'west': [112, 240], 'lakeside': [236, 170], 'frostroad': [392, 282], 'northroad': [436, 66],
});
/**
 * The roads (BASE_DESIGN 5.1): each between two of HOME, a junction and a place (by name), drawn as a gentle curve
 * (its bend and its side seeded by the pair). The start regions' roads run from HOME; the rest follow the regions'
 * neighbours (regions.ts): Millbrook to Bramblewood and Frostmere, Highfold to Bramblewood, Old Mine Road and Emberfell,
 * Old Mine Road to Emberfell, Emberfell to Frostmere.
 */
export const ROADS: readonly (readonly [string, string])[] = [
  ['HOME', 'west'], ['west', 'WILLOW POND'], ['WILLOW POND', 'THE MILL RACE'], ['THE MILL RACE', 'THE BROOK BRIDGE'],
  ['THE BROOK BRIDGE', 'frostroad'], ['frostroad', 'THE FROST GIANT\'S PASS'], ['THE FROST GIANT\'S PASS', 'SNOWBOUND'],
  ['frostroad', 'THE ICE ROAD'], ['THE ICE ROAD', 'THE FROZEN FALLS'],
  ['west', 'MOSSY HOLLOW'], ['MOSSY HOLLOW', 'THE OWL WOOD'], ['MOSSY HOLLOW', 'THE THICKET'],
  ['THE THICKET', 'THE HIGH PASS'], ['THE HIGH PASS', 'THE STORM ROC\'S CRAG'], ['THE STORM ROC\'S CRAG', 'THE GOAT PATH'], ['THE HIGH PASS', 'THUNDER RIDGE'],
  ['MOSSY HOLLOW', 'lakeside'], ['lakeside', 'LANTERN RUN'], ['THE GOAT PATH', 'LANTERN RUN'],
  ['LANTERN RUN', 'THE DEEP SEAM'], ['THE DEEP SEAM', 'THE MOLE KING\'S HALL'], ['LANTERN RUN', 'THE OLD CART TRACK'],
  ['THE OLD CART TRACK', 'ASHFALL'], ['ASHFALL', 'THE CINDER FIELDS'], ['ASHFALL', 'THE HOT SPRINGS'],
  ['THUNDER RIDGE', 'northroad'], ['northroad', 'THE CINDER FIELDS'], ['THE HOT SPRINGS', 'THE FROZEN FALLS'],
];

/** Every place on the map with its region. */
export const PLACES: readonly (Place & { region: RegionId })[] = Object.freeze(REGIONS.flatMap((r) => r.places.map((p) => ({ ...p, region: r.id }))));
/** A road node's point: HOME, a junction or a place. */
function nodeAt(name: string): readonly [number, number] {
  if (name === 'HOME') return MAP_HOME;
  const j = JUNCTIONS[name];
  if (j) return j;
  const p = PLACES.find((q) => q.name === name);
  if (!p) throw new Error(`worldmap: no road node ${name}`);
  return p.at;
}

/** Catmull-Rom through the points, `per` samples a span (the ends held). */
function spline(pts: readonly (readonly [number, number])[], per: number): [number, number][] {
  const out: [number, number][] = [];
  for (let s = 0; s < pts.length - 1; s++) {
    const p0 = pts[Math.max(0, s - 1)], p1 = pts[s], p2 = pts[s + 1], p3 = pts[Math.min(pts.length - 1, s + 2)];
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push([pts[pts.length - 1][0], pts[pts.length - 1][1]]);
  return out;
}
const LINES = new Map<string, [number, number][]>();
/**
 * A road's line from a to b: a gentle S, its two bends (each up to 14 % of its length, either side) seeded by the pair,
 * sampled about every px -- the bends eased off, a step at a time, wherever the line would dip into the sea or the lake.
 * Worked out once for each road.
 */
export function roadLine(a: string, b: string): [number, number][] {
  const key = `${a}|${b}`, had = LINES.get(key);
  if (had) return had;
  const A = nodeAt(a), B = nodeAt(b), dx = B[0] - A[0], dy = B[1] - A[1], len = Math.hypot(dx, dy) || 1;
  const seed = mix32(...[...(a + '|' + b)].map((c) => c.charCodeAt(0)));
  const o1 = ((seed % 1000) / 1000 - 0.5) * 0.28 * len, o2 = ((Math.floor(seed / 1000) % 1000) / 1000 - 0.5) * 0.28 * len;
  const nx = -dy / len, ny = dx / len, L = worldLand();
  let line: [number, number][] = [];
  for (const k of [1, 0.6, 0.3, 0]) {
    const p1: [number, number] = [A[0] + dx / 3 + nx * o1 * k, A[1] + dy / 3 + ny * o1 * k];
    const p2: [number, number] = [A[0] + (2 * dx) / 3 + nx * o2 * k, A[1] + (2 * dy) / 3 + ny * o2 * k];
    line = spline([A, p1, p2, B], Math.max(4, Math.ceil(len / 3)));
    if (line.every(([x, y]) => { const at = landAt(x, y); return at < 0 || (L.kind[at] !== SEA && L.kind[at] !== LAKE); })) break;
  }
  LINES.set(key, line);
  return line;
}

/** Masks over the map's pixels: the brook's water, the roads, and what the decorations keep clear of. */
interface Ways { river: Uint8Array; road: Uint8Array; clear: Uint8Array }
let WAYS_CACHE: Ways | null = null;
/** Stamp a disc of radius r into a mask at (x, y) (screen px). */
function disc(mask: Uint8Array, x: number, y: number, r: number): void {
  const R = Math.ceil(r);
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    if (dx * dx + dy * dy > r * r + 0.3) continue;
    const at = landAt(x + dx, y + dy);
    if (at >= 0) mask[at] = 1;
  }
}
/** The brook's and the roads' pixels, and the ground the decorations keep off (the ways, the places, HOME, a margin from the water). */
function ways(): Ways {
  if (WAYS_CACHE) return WAYS_CACHE;
  const L = worldLand(), river = new Uint8Array(W * H), road = new Uint8Array(W * H), clear = new Uint8Array(W * H);
  for (const r of RIVERS) {
    // (meandering: each sample pushed across the stream by noise)
    const line = spline(r.pts, 40);
    line.forEach(([x, y], n) => {
      const u = n / (line.length - 1), w = r.w0 + (r.w1 - r.w0) * u, m = fbm(x, y, 18, 41) * 3;
      disc(river, Math.round(x + m), Math.round(y), (w - 1) / 2 + 0.4);
    });
  }
  // (the brook only over land: in the lake and the sea it is the lake and the sea)
  for (let at = 0; at < W * H; at++) if (L.kind[at] !== LAND) river[at] = 0;
  // (a road is a 2 x 2 pen dragged along its line: 2 px wide whichever way it runs)
  for (const [a, b] of ROADS) for (const [x, y] of roadLine(a, b)) for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const at = landAt(Math.floor(x) + dx, Math.floor(y) + dy); if (at >= 0) road[at] = 1; }
  for (let at = 0; at < W * H; at++) if (L.kind[at] === SEA || L.kind[at] === LAKE) road[at] = 0;
  // what the decorations keep clear of: the ways (2 px round), the water's edge, the places and HOME
  for (let at = 0; at < W * H; at++) {
    if (river[at] || road[at]) { const i = at % W, j = (at - i) / W; disc(clear, X0 + i, Y0 + j, 2.5); }
    if (L.kind[at] !== LAND || L.shore[at] <= 2) clear[at] = 1;
  }
  for (const p of PLACES) { const f = footprint(p.art, p.at); for (let y = f.y - 2; y < f.y + f.h + 2; y++) for (let x = f.x - 2; x < f.x + f.w + 2; x++) { const at = landAt(x, y); if (at >= 0) clear[at] = 1; } }
  { const f = homeRect(); for (let y = f.y - 3; y < f.y + f.h + 3; y++) for (let x = f.x - 3; x < f.x + f.w + 3; x++) { const at = landAt(x, y); if (at >= 0) clear[at] = 1; } }
  return (WAYS_CACHE = { river, road, clear });
}

// ---------- the palette ----------

/** Every colour the map's land is painted in (ART_BIBLE 5.10, the world map): flat, lit from the top left. */
export const MAP_COLOURS = Object.freeze({
  sea: '#5a8cc2', seaShallow: '#72a4d4', seaGlint: '#d4ecf8', lake: '#6aa2d6', lakeShallow: '#84b8e0',
  road: '#eadcae', roadEdge: '#b89a6a', plank: '#a87a4e',
  cloud: '#f2f0ea', cloudShade: '#d2d4de', cloudLit: '#ffffff',
});
/** Each climate's ground: a base and a patch tone, and the pale strand along its shore. */
const GROUND: Readonly<Record<Climate, { base: string; patch: string; shore: string }>> = Object.freeze({
  meadow: { base: '#9cca6a', patch: '#8cbc5e', shore: '#e8d8a0' },
  forest: { base: '#6ea45c', patch: '#629854', shore: '#e8d8a0' },
  caves: { base: '#dcbc8c', patch: '#d0ae7e', shore: '#eadcae' },
  peaks: { base: '#a8b4a2', patch: '#9aa896', shore: '#c8ccc4' },
  ice: { base: '#e6eef4', patch: '#d4e2ee', shore: '#f4f8fc' },
  ash: { base: '#c4927e', patch: '#b48472', shore: '#a88478' },
});
/** A region's ground colour (its base), by id: the gallery's sheet stands each landmark on its own. */
export const GROUND_OF = (id: RegionId): string => GROUND[regionOf(id).climate].base;
const LEAF = Object.freeze({ lit: '#7cbe5a', mid: '#58984a', shade: '#3e7446', trunk: '#7a5238', pine: '#3e7650', pineLit: '#5c9660' });
const ROCK = Object.freeze({ lit: '#aeb6c8', mid: '#8e98b0', shade: '#737c98', snow: '#f4f6fa', snowShade: '#cfd8e8' });
const MESA = Object.freeze({ top: '#ecd2a2', side: '#c8966a', band: '#b4825a', shade: '#a47450' });
const CONE = Object.freeze({ lit: '#a47c72', mid: '#8a645e', shade: '#72504e', glow: '#f08a3c', hot: '#ffd06a', cinder: '#5a4448', smoke: '#d8d0cc' });
const FIELDS = Object.freeze(['#e2d06e', '#b2d86e', '#c8ae78', '#d6de86']);
const HEDGE = '#4e8a44';

/**
 * The land's own big shapes, set by hand before anything else grows (not places: scenery): Highfold's great peaks,
 * Emberfell's smoking cones, the Old Mine Road's tallest mesas. `size` scales each.
 */
const FEATURES: readonly { kind: 'peak' | 'volcano' | 'mesa'; at: readonly [number, number]; size: number }[] = [
  { kind: 'peak', at: [204, 44], size: 2 },
  { kind: 'volcano', at: [556, 100], size: 3 }, { kind: 'volcano', at: [480, 94], size: 2 }, { kind: 'volcano', at: [574, 150], size: 2 },
  { kind: 'mesa', at: [446, 136], size: 3 }, { kind: 'mesa', at: [362, 124], size: 2 }, { kind: 'mesa', at: [400, 62], size: 2 },
];

/** A colour's 0xRRGGBB. */
const rgb = (hex: string): number => parseInt(hex.slice(1), 16);

// ---------- the raster ----------

/** Plain RGBA over MAP_RECT (screen px in, clipped): the map is painted here, never through a canvas, so it is the same in Node. */
export class Raster {
  readonly data = new Uint8ClampedArray(W * H * 4);
  set(x: number, y: number, c: number): void {
    const i = x - X0, j = y - Y0;
    if (i < 0 || j < 0 || i >= W || j >= H) return;
    const o = (j * W + i) * 4;
    this.data[o] = c >> 16; this.data[o + 1] = (c >> 8) & 255; this.data[o + 2] = c & 255; this.data[o + 3] = 255;
  }
  get(x: number, y: number): number {
    const i = x - X0, j = y - Y0;
    if (i < 0 || j < 0 || i >= W || j >= H) return -1;
    const o = (j * W + i) * 4;
    return (this.data[o] << 16) | (this.data[o + 1] << 8) | this.data[o + 2];
  }
  rect(x: number, y: number, w: number, h: number, c: number): void { for (let v = y; v < y + h; v++) for (let u = x; u < x + w; u++) this.set(u, v, c); }
  /** A sprite with its top left at (x, y), every pixel ringed in ink first (icons.ts drawSprite's look). */
  sprite(sp: Sprite, x: number, y: number): void {
    const ink = rgb(INK), rows = sp.rows;
    for (let r = 0; r < rows.length; r++) for (let c = 0; c < rows[r].length; c++) if (rows[r][c] !== '.') this.rect(x + c - 1, y + r - 1, 3, 3, ink);
    for (let r = 0; r < rows.length; r++) for (let c = 0; c < rows[r].length; c++) { const k = rows[r][c]; if (k !== '.') this.set(x + c, y + r, rgb(sp.colors[k])); }
  }
}

// ---------- sprites: the land's growths ----------

const sp = (rows: readonly string[], colors: Readonly<Record<string, string>>): Sprite => Object.freeze({ rows: Object.freeze([...rows]), colors: Object.freeze({ ...colors }) });

/** Broadleaf trees (the meadow's and the wood's), a pine, a snowy pine, a bush, a dead tree, a rock, a snowdrift, cinders. */
const TREES: readonly Sprite[] = [
  sp(['..lll..', '.lllmm.', 'llmmmms', 'lmmmmss', '.mmmss.', '..sts..', '...t...'], { l: LEAF.lit, m: LEAF.mid, s: LEAF.shade, t: LEAF.trunk }),
  sp(['.lll.', 'llmms', 'lmmss', '.mss.', '..t..'], { l: LEAF.lit, m: LEAF.mid, s: LEAF.shade, t: LEAF.trunk }),
  sp(['..ll...', '.llmm..', 'lllmmm.', 'lmmmmms', '.mmmss.', '..sss..', '...t...', '...t...'], { l: LEAF.lit, m: LEAF.mid, s: LEAF.shade, t: LEAF.trunk }),
];
const PINE = sp(['..p..', '.lpp.', '.lpp.', 'lpppd', '.lpd.', 'lpppd', 'ppddd', '..t..'], { l: LEAF.pineLit, p: LEAF.pine, d: LEAF.shade, t: LEAF.trunk });
const SNOW_PINE = sp(['..w..', '.wpp.', '.wpp.', 'wwppd', '.wpd.', 'wwppd', 'wpddd', '..t..'], { w: ROCK.snow, p: LEAF.pine, d: LEAF.shade, t: LEAF.trunk });
const BUSH = sp(['.ll.', 'lmms'], { l: LEAF.lit, m: LEAF.mid, s: LEAF.shade });
const DEAD_TREE = sp(['t...t', '.t.t.', '..t..', '..t..'], { t: '#6a5048' });
const ROCKS: readonly Sprite[] = [
  sp(['.ll.', 'lmms'], { l: '#c8bcaa', m: '#a89a88', s: '#8a7e70' }),
  sp(['.l.', 'lms'], { l: '#c8bcaa', m: '#a89a88', s: '#8a7e70' }),
];
const DRIFT = sp(['.www.', 'wwwss'], { w: ROCK.snow, s: ROCK.snowShade });
const CINDER = sp(['cc.', 'coc'], { c: CONE.cinder, o: CONE.glow });

/** A peak (Highfold's): half width `hw`, height `h`, lit on the left, snow on its top `snow` of it, its peak `lean` px off centre. */
function mountain(hw: number, h: number, snow: number, lean: number): Sprite {
  const w = 2 * hw + 1, rows: string[] = [];
  const px = hw + lean;
  for (let y = 0; y < h; y++) {
    let row = '';
    const t = (y + 1) / h, l = Math.round(px - t * px), r = Math.round(px + t * (w - 1 - px));
    const snowLine = Math.round(h * snow) + ((y * 7 + lean) % 3 === 0 ? 1 : 0);
    for (let x = 0; x < w; x++) {
      if (x < l || x > r) { row += '.'; continue; }
      const lit = x < px || (x === px && y < 2);
      row += y < snowLine ? (lit ? 'w' : 's') : lit ? (x < l + 2 && y > 1 ? 'l' : 'm') : x > r - 2 ? 'd' : 'k';
    }
    rows.push(row);
  }
  return sp(rows, { w: ROCK.snow, s: ROCK.snowShade, l: ROCK.lit, m: ROCK.mid, k: ROCK.shade, d: '#646c88' });
}
/**
 * A mesa (the Old Mine Road's): a flat-topped butte -- a pale top face, steep sides that widen a px every third row down,
 * strata bands across them, lit on its left edge, its right third in shade.
 */
function mesa(w: number, h: number): Sprite {
  const rows: string[] = [];
  for (let y = 0; y < h; y++) {
    let row = '';
    const inset = Math.floor((h - 1 - y) / 3) + (y === 0 ? 1 : 0), a = inset, b = w - 1 - inset;
    for (let x = 0; x < w; x++) {
      if (x < a || x > b) { row += '.'; continue; }
      if (y < 2) { row += y === 1 && x > b - 2 ? 'd' : 't'; continue; }
      const right = x > a + (b - a) * 0.66;
      row += x === a ? 'l' : right ? (y % 3 === 0 ? 'D' : 'd') : y % 3 === 0 ? 'b' : 's';
    }
    rows.push(row);
  }
  return sp(rows, { t: MESA.top, l: MESA.top, s: MESA.side, b: MESA.band, d: MESA.shade, D: '#8e6244' });
}
/** A cone (Emberfell's): a round-topped hill with a glowing crater, lit on the left. */
function cone(hw: number, h: number): Sprite {
  const w = 2 * hw + 1, rows: string[] = [];
  for (let y = 0; y < h; y++) {
    let row = '';
    const half = Math.round(1.5 + (y / (h - 1)) * (hw - 1.5));
    for (let x = 0; x < w; x++) {
      if (Math.abs(x - hw) > half) { row += '.'; continue; }
      if (y === 0) row += Math.abs(x - hw) <= 1 ? 'o' : 'm';
      else if (y === 1 && Math.abs(x - hw) <= 0) row += 'h';
      else if (y > 1 && y < h - 2 && x === hw + 1 && y % 4 === 2) row += 'o';
      else row += x < hw - half / 3 ? 'l' : x > hw + half / 2 ? 'd' : 'm';
    }
    rows.push(row);
  }
  return sp(rows, { l: CONE.lit, m: CONE.mid, d: CONE.shade, o: CONE.glow, h: CONE.hot });
}

// ---------- sprites: the places ----------

const WOOD = '#9a6a44', DARK_WOOD = '#6a4632', STONE = '#bcb4a8', STONE_SHADE = '#8e867c', ROOF = '#c0503c', ROOF_SHADE = '#8e3a30';
const CREAM = '#f6eedc', CREAM_SHADE = '#d8ccb4', MOUTH = '#3a2e36', LAMP = '#ffd86a', WATER = '#6aa2d6', WATER_LIT = '#bfe0f4';
const ICE = '#dff0fa', ICE_SHADE = '#a8cce4';

/**
 * Each place's landmark (regions.ts PlaceArt), its foot at the bottom row's middle. The windmill's sails, the springs'
 * steam and the chimneys' smoke are drawAlive's: they move.
 */
export const PLACE_ART: Readonly<Record<PlaceArt, Sprite>> = Object.freeze({
  // Millbrook: the mill's tower by the brook (its sails turn: drawAlive), the willow over its pond, the stone bridge
  windmill: sp([
    '.....rrr.....', '....rrrrR....', '...rrrrrRR...', '..rrrrrrrRR..', '...wwwwwwc...', '...wwwwwwc...', '...wwkwwwc...',
    '..wwwwwwwcc..', '..wwwwwwwcc..', '..wwwwwwwcc..', '.wwwwddwwwcc.', '.wwwwddwwwcc.', '.wwwwddwwwcc.',
  ], { r: ROOF, R: ROOF_SHADE, w: CREAM, c: CREAM_SHADE, k: DARK_WOOD, d: DARK_WOOD }),
  pond: sp([
    '..llll...........', '.lllmmmm.........', 'llmmmmmmmm.......', 'lmmmmmmmmms......', 'lmm.mmm.mms......', '.m.m.mtm.m.s.....',
    '.m.m.mtm.m.s..e..', '...m..t..m...eEe.', '......t.bbbbbbbe.', '....bbbbbbWbbbbb.', '...bbbbbbbbbbWbbb', '....bbbbbbbbbbbb.',
  ], { l: '#a8d67a', m: '#7cb45a', s: '#5a8e4a', t: LEAF.trunk, e: '#8a9a4a', E: '#7a5238', b: WATER, W: WATER_LIT }),
  bridge: sp([
    '...sssssssss...', '.sSsssSsssSsss.', 'sssssssssssssss', 'sssSs.....sSsss', 'ssss.bbbbb.ssss', 'sss.bbWbbbb.sss', 'sss.bbbbbbb.sss',
  ], { s: STONE, S: STONE_SHADE, b: WATER, W: WATER_LIT }),
  // Old Mine Road: the deep seam's timbered mouth and its rails, the lamps along the run, the cart, the Mole King's door
  mine: sp([
    '......hhhhh......', '....hhhhhhhhh....', '...hhhhhhhhhhhH..', '..hhhwwwwwwwhhHH.', '.hhhhwdddddwhhHHH', 'hhhyhwdddddwhhHHH',
    'hhhhhwdddddwhhhHH', 'hhhhhwdddddwhhhHH', '......r...r......', '.....r.....r.....',
  ], { h: MESA.side, H: MESA.shade, w: WOOD, d: MOUTH, y: LAMP, r: STONE_SHADE }),
  lanterns: sp([
    '...........hhhh..', '.........hhhhhhH.', 'yy..yy..hhhhhhhHH', 'yy..yy..hhhddddhH', '.b...b..hhddddddH', '.b...b..hhddddddH',
    '.b...b.hhhddddddH', '.b...b.hhhddddddH',
  ], { y: LAMP, b: DARK_WOOD, h: MESA.band, H: MESA.shade, d: MOUTH }),
  cart: sp([
    '.....oogo......', '...ooooooo.....', '..mmmmmmmmmmm..', '..mMmmmmmmmMm..', '...mmmmmmmmm...', '...kk.....kk...', 'rrrrrrrrrrrrrrr', '.t...t...t...t.',
  ], { o: '#5a4c54', g: LAMP, m: '#9a92a0', M: '#6a6272', k: INK, r: STONE_SHADE, t: DARK_WOOD }),
  molehall: sp([
    '........y.y.y......', '........yyyyy......', '......hhhhhhhhh....', '....hhhhhhhhhhhhh..', '...hhhhhhwwwhhhhhH.',
    '..hhhhhhwdddwhhhhHH', '..hhhhhwdddddwhhhHH', '.hhhhhhwdddddwhhHHH', 'mm.hhhhwdddddwhhHH.',
  ], { y: LAMP, h: '#9a7452', H: '#7a5a42', w: WOOD, d: MOUTH, m: '#8a6a4a' }),
  // Bramblewood: the thicket's brambles and berries, the mossy log and its mushrooms, the owl's great oak
  thicket: sp([
    '...t....t...t....', '..GGgt.GGgt.GGg..', '.GGgggpGggggpggD.', 'GGgpgggggggggggDD', 'GggggggpgggpggggD', 'ggggpgggggggpgggD',
    '.ggggggggggggggD.', '..gg.ggg..ggg.gg.',
  ], { G: '#6aa24a', g: '#4a7a3a', D: '#34583a', p: '#c04a7a', t: '#d8c888' }),
  hollow: sp([
    '..mwm.....mm...', '.mmmmm...mwmm..', '...c......c....', '.GGGGGGGGGGGeee', 'bbbbbbbbbbbeoe.', 'bbbbbbbbbbbeooe', 'bBbbbbBbbbbeoe.', '.BBBBBBBBBBBee.',
  ], { m: '#d8503c', w: CREAM, c: CREAM, G: '#7cbe5a', b: WOOD, B: DARK_WOOD, e: '#c89a6a', o: MOUTH }),
  owltree: sp([
    '.....lllll.....', '...llllmmmmm...', '..llmmmmmmmmm..', '.llmmmmmmmmmss.', 'llmmmmmmmmmmsss', 'lmmmmmmmmmmmsss', 'lmmmmmmmmmmssss',
    '.mmmmmmmmmsssss', '..mmmsmmsssss..', '......tttt.....', '.....tooooT....', '.....toyoyT....', '.....tooooT....', '.....ttttTT....',
    '....tttttTTT...', '...tt..tt..TT..',
  ], { l: LEAF.lit, m: LEAF.mid, s: LEAF.shade, t: '#7a5a42', T: '#5a4232', o: MOUTH, y: LAMP }),
  // Highfold: the pass's notch and its cairn, the ridge under its storm (the bolt flashes: drawAlive), the goat on its
  // crag, the Storm Roc's spire and the egg in its nest
  pass: sp([
    '...w...........w...', '..wws.........wws..', '..wwss.......wwsss.', '.wwwsss..f..wwwssss', '.lllmmk..p..lllmmkk', 'llllmmkk.c.lllmmmkk',
    'lllmmmmk.cclllmmmkk', 'llmmmmmmkcclmmmmmkk', 'lmmmmmmmmmmmmmmmkkk',
  ], { w: ROCK.snow, s: ROCK.snowShade, l: ROCK.lit, m: ROCK.mid, k: ROCK.shade, c: STONE, f: '#d8402e', p: DARK_WOOD }),
  ridge: sp([
    '....ggggg........', '..ggggggggg......', '.gggggggggggg....', '..GGGGGGGGGG.....', '......y..........', '.....yy..........',
    '......y......w...', '.....y......wws..', '..w........wwsss.', '.wws..l...lwmmkk.', 'lwwssllm.llmmmmkk', 'llmmmmmmmmmmmmmkk',
  ], { g: '#8a8ea6', G: '#6a6e86', y: '#ffe45a', w: ROCK.snow, s: ROCK.snowShade, l: ROCK.lit, m: ROCK.mid, k: ROCK.shade }),
  goat: sp([
    '..........hh...', '.........hh.h..', '.........hwwh..', '........wwwkw..', '..ww...wwwww...', '.wwwwwwwwwwb...', '.wwwwwwwwww....',
    '..WWWWWWWWW....', '..w.w...w.w....', '.lllmmmmmmmmK..', 'llllmmmmmmmmKK.', 'lllmmmmmmmmmmKK',
  ], { w: '#f4f0e6', W: '#d8d0c0', h: STONE_SHADE, k: INK, b: '#b8b0a4', l: ROCK.lit, m: ROCK.mid, K: ROCK.shade }),
  crag: sp([
    '.....Ee......', '....eeee.....', '..nNeeeeNn...', '.nNnnnnnnNn..', '..nnNnnNnn...', '....lmmK.....', '....lmmK.....', '...llmmKK....',
    '...lmmmmK....', '...lmmmmK....', '..llmmmmKK...', '..lmmmmmmK...', '.llmmmmmmKK..', '.lmmmmmmmmK..', 'llmmmmmmmmKK.', 'lmmmmmmmmmmKK',
  ], { e: '#c8d8f0', E: '#eef4fc', n: '#9a7a52', N: '#7a5a3a', l: ROCK.lit, m: ROCK.mid, K: ROCK.shade }),
  // Frostmere: the ice road's stakes and a sledge, the frozen falls, the snowbound hut (its chimney smokes: drawAlive),
  // the giant's pass and its footprints
  iceroad: sp([
    'r.......r......r.', 'w.......w......w.', 'r.......r......r.', 'w..bbbb.w......w.', 'k.bBBBBbk......k.', '..kkkkkk.........',
  ], { r: '#d8402e', w: '#f6f0e6', k: '#6a5a50', b: WOOD, B: DARK_WOOD }),
  falls: sp([
    'lllmmmmmmmmmKK.', 'llmmmiiiiimmmKK', 'lmmmiIiiiIimmKK', 'lmmmiiiiiiimmKK', 'lmmmiIiiiIimmKK', 'lmmmiiiiiiimmmK', 'lmmmiiIiiiimmmK',
    '.mmmiiiiiIimmK.', '..miiiiiiiiim..', '.iiiiIiiiiIiii.', 'iiIiiiiiiiiiIii', '.iiiiiiiiiiiii.',
  ], { l: ROCK.lit, m: ROCK.mid, K: ROCK.shade, i: ICE, I: ICE_SHADE }),
  hut: sp([
    '...........c...', '....nnnnnnncn..', '..nnnnnnnnnnnn.', '.nnnnnnnnnnnnnn', 'nnnnnnnnnnnnnnn', '.wwwwwwwwwwwww.', '.wWwyyWwwwddWw.',
    '.wwwyywwwwddww.', '.wWwwwWwwwddWw.', 'nnnnnnnnnnnnnnn', 'nnnnnnnnnnnnnnn',
  ], { n: ROCK.snow, c: STONE_SHADE, w: WOOD, W: DARK_WOOD, y: LAMP, d: DARK_WOOD }),
  gate: sp([
    '.ii..........ii..', 'iiiI........iiII.', 'iiiiI......iiiII.', 'iiIiiI....iiIiII.', 'iiiiiI....iiiiIII', 'iIiiiI....iiIiIII',
    'iiiiiI....iiiiIII', 'iiiiiI....iiiiIII', 'nnnnnnFnnFnnnnnnn', '.nnnnnnnnnnnnnnn.',
  ], { i: ICE, I: ICE_SHADE, n: ROCK.snow, F: '#b8c8e0' }),
  // Emberfell: the cinder field's glowing rocks, the steaming pools (their steam: drawAlive), the village of Ashfall
  cinders: sp([
    '....o............', '...oho.....o.....', '...coc....oho....', '..ccocc...coc..c.', '.cccccco.ccccccoc', 'ccocccccccccocccc', '.cccccccocccccc..',
  ], { c: CONE.cinder, o: CONE.glow, h: CONE.hot }),
  springs: sp([
    '..sssss.....sss..', '.sbbbbbss..sbbbs.', 'sbbWbbbbbs.sbWbs.', 'sbbbbbbbbs..sbs..', '.sbbbbbbs........', '..ssssss.........',
  ], { s: STONE, b: '#5ec8c0', W: '#c8f4f0' }),
  village: sp([
    '...aaa...........', '..aaaaa......c...', '.aaaaaaa...aaac..', 'aaaaaaaaa.aaaaaa.', '.wwwwwww.aaaaaaaa', '.wyywdww..wwwwww.',
    '.wyywdww..wydwyw.', '.wwwwdww..wwdwww.',
  ], { a: '#8a8290', w: CREAM, y: LAMP, d: DARK_WOOD, c: STONE_SHADE }),
});

/**
 * HOME: the barn in small (BASE_DESIGN 2) -- its red gable between the left tower, the Aerie's deck on top and the
 * team's yellow flag over it, and the right tower under its blue spire and red pennant; lamplit windows.
 */
export const HOME_ART: Sprite = sp([
  '.pff................rr.', '.pff................B..', '.p.................BBC.', '.p.................BBC.', '.p................BBBCC',
  'wwwwww.....r......BBBCC', 'sssss.....rrR.....sssss', 'sssss....rrrRR....sssss', 'syyss...rrrrRRR...ssyys', 'sssss..rrrrrRRRR..sssss',
  'sssss.rrrrrrRRRRR.sssss', 'sssssooooooooooooosssss', 'syyssooyyooooyyooossyys', 'sssssooyyooooyyooosssss', 'sssssoooooddoooooosssss',
  'sssssoooooddoooooosssss',
], { p: DARK_WOOD, f: '#f2c14e', r: ROOF, R: ROOF_SHADE, B: '#5a6a9a', C: '#44527e', w: WOOD, s: STONE, y: LAMP, o: '#c8784a', d: DARK_WOOD });

/** A sprite's size. */
const sizeOf = (s: Sprite) => ({ w: s.rows[0].length, h: s.rows.length });
/** A landmark's box (screen px): its sprite with its foot at `at` (the bottom row's middle). */
export function footprint(art: PlaceArt, at: readonly [number, number]): Rect {
  const { w, h } = sizeOf(PLACE_ART[art]);
  return { x: Math.round(at[0] - w / 2), y: Math.round(at[1] - h + 1), w, h };
}
/** HOME's box (screen px). */
export function homeRect(): Rect {
  const { w, h } = sizeOf(HOME_ART);
  return { x: Math.round(MAP_HOME[0] - w / 2), y: Math.round(MAP_HOME[1] - h + 1), w, h };
}

// ---------- the land's growths ----------

/** One growth on the land: its sprite and its top left (screen px), sorted back to front by its foot. */
interface Growth { s: Sprite; x: number; y: number; foot: number }
/** An Emberfell cone's crater (its smoke rises from it: drawAlive). */
export interface Crater { x: number; y: number }
let GROWTH_CACHE: { growths: Growth[]; fields: { x: number; y: number; w: number; h: number; c: string }[]; craters: Crater[]; missed: string[] } | null = null;

/** Whether a box of land is all one region's, dry, and clear of the ways, the places and HOME. */
function clearBox(x: number, y: number, w: number, h: number, ri: number): boolean {
  const L = worldLand(), C = ways().clear;
  for (let v = y; v < y + h; v++) for (let u = x; u < x + w; u++) {
    const at = landAt(u, v);
    if (at < 0 || L.region[at] !== ri || L.kind[at] !== LAND || C[at]) return false;
  }
  return true;
}

/**
 * What grows and stands on the land (placed on seeded jittered grids, each climate its own): Millbrook's fields and
 * hedgerow trees, Bramblewood's close wood, the Highfold peaks, the mesas and rocks of the Old Mine Road, Frostmere's
 * snowy pines and drifts, Emberfell's cones, cinders and dead trees -- each only on its own region's dry land, clear of
 * the roads, the brook, the places and HOME.
 */
function growths(): NonNullable<typeof GROWTH_CACHE> {
  if (GROWTH_CACHE) return GROWTH_CACHE;
  const out: Growth[] = [], fields: { x: number; y: number; w: number; h: number; c: string }[] = [], craters: Crater[] = [], missed: string[] = [];
  // (a growth with its foot at (fx, fy), if its box and its ink round it are all clear)
  const put = (s: Sprite, fx: number, fy: number, ri: number): boolean => {
    const { w, h } = sizeOf(s), x = Math.round(fx - w / 2), y = Math.round(fy - h + 1);
    if (!clearBox(x - 1, y - 1, w + 2, h + 2, ri)) return false;
    out.push({ s, x, y, foot: fy });
    return true;
  };
  // the big shapes first (a cone's crater smokes)
  for (const f of FEATURES) {
    const ri = worldLand().region[landAt(f.at[0], f.at[1])];
    if (ri < 0) { missed.push(`the ${f.kind} at ${f.at.join(', ')} (in the water)`); continue; }
    const s = f.kind === 'peak' ? mountain(6 + 2 * f.size, 9 + 3 * f.size, 0.42, f.size % 2 ? -1 : 1)
      : f.kind === 'volcano' ? cone(5 + 3 * f.size, 7 + 3 * f.size) : mesa(14 + 6 * f.size, 6 + 2 * f.size);
    const want: Climate = f.kind === 'peak' ? 'peaks' : f.kind === 'volcano' ? 'ash' : 'caves';
    if (REGIONS[ri].climate !== want) { missed.push(`the ${f.kind} at ${f.at.join(', ')} (in ${REGIONS[ri].name})`); continue; }
    // (where it was set, or the nearest room within 14 px)
    let at: readonly [number, number] | null = null;
    for (let r = 0; r <= 14 && !at; r += 2) for (let k = 0; k < Math.max(1, r * 3) && !at; k++) {
      const a = (k / Math.max(1, r * 3)) * Math.PI * 2, x = Math.round(f.at[0] + Math.cos(a) * r), y = Math.round(f.at[1] + Math.sin(a) * r);
      if (worldLand().region[landAt(x, y)] === ri && put(s, x, y, ri)) at = [x, y];
    }
    if (!at) { missed.push(`the ${f.kind} at ${f.at.join(', ')} (no room)`); continue; }
    if (f.kind === 'volcano') { const { w, h } = sizeOf(s); craters.push({ x: Math.round(at[0] - w / 2) + (w - 1) / 2, y: at[1] - h + 1 }); }
  }
  REGIONS.forEach((r, ri) => {
    const grid = (sx: number, sy: number, salt: number, fn: (x: number, y: number, u: number, v: number) => void) => {
      for (let y = Y0 + sy / 2; y < Y0 + H; y += sy) for (let x = X0 + sx / 2; x < X0 + W; x += sx) {
        const u = h01(x * 7 + salt, y, 51 + ri), v = h01(x, y * 7 + salt, 52 + ri);
        fn(Math.round(x + (u - 0.5) * sx * 0.8), Math.round(y + (v - 0.5) * sy * 0.8), u, v);
      }
    };
    switch (r.climate) {
      case 'meadow': {
        // fields first (flat ground, a hedge along their tops and left sides), then hedgerow trees and bushes
        grid(22, 14, 1, (x, y, u) => {
          if (u < 0.3) return;
          const w = 14 + Math.round(u * 8), h = 8 + Math.round(h01(x, y, 61) * 4);
          if (clearBox(x - 1, y - 1, w + 2, h + 2, ri)) fields.push({ x, y, w, h, c: FIELDS[Math.floor(h01(x, y, 62) * FIELDS.length)] });
        });
        grid(15, 11, 2, (x, y, u) => { if (u < 0.34) put(u < 0.2 ? TREES[1] : TREES[0], x, y, ri); else if (u > 0.93) put(BUSH, x, y, ri); });
        break;
      }
      case 'forest':
        grid(7, 6, 3, (x, y, u) => { if (u < 0.9) put(u < 0.12 ? PINE : TREES[Math.floor(u * 7) % 3], x, y, ri); });
        break;
      case 'peaks':
        grid(15, 11, 4, (x, y, u, v) => {
          if (u < 0.12) return;
          // (now and then a great one)
          const hw = v > 0.86 ? 9 + Math.floor(u * 3) : 5 + Math.floor(v * 4), h = hw + 3 + Math.floor(u * 4);
          if (!put(mountain(hw, h, 0.4, Math.floor(u * 3) - 1), x, y, ri)) put(PINE, x, y, ri);
        });
        break;
      case 'caves':
        grid(26, 18, 5, (x, y, u) => { if (u < 0.45) put(mesa(12 + Math.floor(u * 16), 6 + Math.floor(u * 6)), x, y, ri); });
        grid(11, 9, 6, (x, y, u) => { if (u < 0.3) put(ROCKS[u < 0.15 ? 0 : 1], x, y, ri); else if (u > 0.9) put(BUSH, x, y, ri); });
        break;
      case 'ice':
        grid(12, 10, 7, (x, y, u) => { if (u < 0.45) put(SNOW_PINE, x, y, ri); else if (u > 0.94) put(DRIFT, x, y, ri); });
        break;
      case 'ash':
        grid(30, 22, 8, (x, y, u, v) => {
          if (u < 0.45) {
            const s = cone(6 + Math.floor(v * 5), 8 + Math.floor(v * 5));
            if (put(s, x, y, ri)) { const { w, h } = sizeOf(s); craters.push({ x: Math.round(x - w / 2) + (w - 1) / 2, y: y - h + 1 }); }
          }
        });
        grid(10, 8, 9, (x, y, u) => { if (u < 0.22) put(CINDER, x, y, ri); else if (u > 0.9) put(DEAD_TREE, x, y, ri); });
        break;
    }
  });
  out.sort((a, b) => a.foot - b.foot || a.x - b.x);
  return (GROWTH_CACHE = { growths: out, fields, craters, missed });
}
/** Emberfell's craters (their smoke: drawAlive). */
export function craters(): readonly Crater[] { return growths().craters; }

/** One of every growth the land has, by name (the gallery's map sheet lays them out). */
export function growthSamples(): readonly { name: string; s: Sprite }[] {
  return [
    ...TREES.map((s, i) => ({ name: `tree${i}`, s })), { name: 'pine', s: PINE }, { name: 'snowpine', s: SNOW_PINE }, { name: 'bush', s: BUSH },
    { name: 'deadtree', s: DEAD_TREE }, ...ROCKS.map((s, i) => ({ name: `rock${i}`, s })), { name: 'drift', s: DRIFT }, { name: 'cinder', s: CINDER },
    { name: 'peak', s: mountain(12, 18, 0.42, -1) }, { name: 'hill', s: mountain(6, 9, 0.4, 0) }, { name: 'volcano', s: cone(14, 16) },
    { name: 'cone', s: cone(6, 8) }, { name: 'mesa', s: mesa(32, 12) }, { name: 'butte', s: mesa(14, 7) },
  ];
}

// ---------- painting ----------

/** The land and the water under everything: the sea (shallow by the shore), the lake, the frozen mere, each region's ground (its patches, a pale shore), and the coast in ink. */
function paintGround(R: Raster): void {
  const L = worldLand(), ink = rgb(INK);
  const C = Object.fromEntries(Object.entries(MAP_COLOURS).map(([k, v]) => [k, rgb(v)])) as Record<keyof typeof MAP_COLOURS, number>;
  const G = REGIONS.map((r) => ({ base: rgb(GROUND[r.climate].base), patch: rgb(GROUND[r.climate].patch), shore: rgb(GROUND[r.climate].shore) }));
  const mere = rgb('#b8d8ee'), crack = rgb('#eef8fc'), patches = REGIONS.map((_, ri) => field(16, 81 + ri)), cracks = field(9, 71);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const at = j * W + i, x = X0 + i, y = Y0 + j, k = L.kind[at], d = L.shore[at];
    let c: number;
    if (k === SEA) c = d <= 3 ? C.seaShallow : C.sea;
    else if (k === LAKE) c = d <= 2 ? C.lakeShallow : C.lake;
    else if (d === 1) c = ink;
    else if (k === MERE) {
      // the frozen mere: pale ice, a few long cracks
      c = Math.abs(cracks(x, y)) < 0.04 ? crack : mere;
    } else {
      const g = G[L.region[at]];
      c = d === 2 ? g.shore : patches[L.region[at]](x, y) > 0.28 ? g.patch : g.base;
    }
    R.set(x, y, c);
  }
  // the mere's own rim in ink (it is ice on land, so the shore walk never saw it)
  for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
    const at = j * W + i;
    if (L.kind[at] !== MERE) continue;
    if ([at - 1, at + 1, at - W, at + W].some((b) => L.kind[b] === LAND)) R.set(X0 + i, Y0 + j, ink);
  }
}

/**
 * The brook (its water, a glint here and there, inked along both banks as the coast is), then the roads (a pale
 * track, a darker edge on the dry land beside it, and a plank bridge wherever one crosses the brook, inked along its
 * sides).
 */
function paintWays(R: Raster): void {
  const { river, road } = ways(), L = worldLand();
  const water = rgb(MAP_COLOURS.lake), glint = rgb('#bfe0f4');
  const track = rgb(MAP_COLOURS.road), edge = rgb(MAP_COLOURS.roadEdge), plank = rgb(MAP_COLOURS.plank), ink = rgb(INK);
  const isR = (i: number, j: number) => i >= 0 && j >= 0 && i < W && j < H && river[j * W + i] === 1;
  const isRd = (i: number, j: number) => i >= 0 && j >= 0 && i < W && j < H && road[j * W + i] === 1;
  const near = (i: number, j: number, f: (i: number, j: number) => boolean) => f(i - 1, j) || f(i + 1, j) || f(i, j - 1) || f(i, j + 1);
  // (a bank: dry land beside the brook)
  const bank = (i: number, j: number) => !isR(i, j) && L.kind[j * W + i] === LAND && near(i, j, isR);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (isR(i, j)) R.set(X0 + i, Y0 + j, h01(i >> 1, j, 43) < 0.12 && isR(i - 1, j) && isR(i + 1, j) ? glint : water);
    else if (bank(i, j)) R.set(X0 + i, Y0 + j, ink);
  }
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const at = j * W + i;
    if (isRd(i, j)) {
      if (isR(i, j)) {
        // a plank bridge over the brook, inked along its sides
        R.set(X0 + i, Y0 + j, plank);
        for (const [di, dj] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) if (!isRd(i + di, j + dj) && isR(i + di, j + dj)) R.set(X0 + i + di, Y0 + j + dj, ink);
      } else R.set(X0 + i, Y0 + j, track);
    } else if (L.kind[at] === LAND && L.shore[at] > 1 && !isR(i, j) && !bank(i, j) && near(i, j, isRd)) R.set(X0 + i, Y0 + j, edge);
  }
}

/** Millbrook's fields: flat patches of crop, a hedge along the top and the left. */
function paintFields(R: Raster): void {
  const hedge = rgb(HEDGE);
  for (const f of growths().fields) {
    R.rect(f.x, f.y, f.w, f.h, rgb(f.c));
    R.rect(f.x, f.y, f.w, 1, hedge); R.rect(f.x, f.y, 1, f.h, hedge);
    // furrows: every third row a step darker, as 2 px dashes
    for (let v = f.y + 3; v < f.y + f.h; v += 3) for (let u = f.x + 2; u < f.x + f.w - 1; u += 4) R.rect(u, v, 2, 1, rgb(shade(f.c)));
  }
}
/** A colour a step darker (a furrow). */
function shade(hex: string): string {
  const n = rgb(hex), k = 0.88, r = Math.round(((n >> 16) & 255) * k), g = Math.round(((n >> 8) & 255) * k), b = Math.round((n & 255) * k);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/**
 * Cloud over a region not explored yet (every pixel of its land and its places' landmarks under it): a flat mass over
 * them grown by 2 px, lumps every 11 px or so along its edge (a scalloped rim) and a few big ones inside, drawn back to
 * front -- the whole ringed in ink, each lump's upper rim over the one behind in the cloud's shade, lit inside its top
 * left and shaded along its bottom.
 */
function paintCloud(R: Raster, ri: number): void {
  const L = worldLand(), ink = rgb(INK), base = rgb(MAP_COLOURS.cloud), lit = rgb(MAP_COLOURS.cloudLit), dark = rgb(MAP_COLOURS.cloudShade);
  const inMap = (u: number, v: number) => u >= 0 && v >= 0 && u < W && v < H;
  // the cover: the region's own pixels (its frozen mere among them), grown by 2 px
  const cover = new Uint8Array(W * H), own = new Uint8Array(W * H);
  for (let at = 0; at < W * H; at++) if (L.region[at] === ri) own[at] = 1;
  // (and every place of its: a landmark on the shore stands partly over the water)
  for (const p of PLACES) if (p.region === REGIONS[ri].id) { const f = footprint(p.art, p.at); for (let v = f.y - 1; v <= f.y + f.h; v++) for (let u = f.x - 1; u <= f.x + f.w; u++) { const at = landAt(u, v); if (at >= 0) own[at] = 1; } }
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (own[j * W + i]) for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
    if (di * di + dj * dj <= 5 && inMap(i + di, j + dj)) cover[(j + dj) * W + i + di] = 1;
  }
  // the lumps: one every 11 px or so along the cover's edge (so the cloud's rim is scalloped), then a few big ones
  // inside, on a jittered grid, well in from the edge
  const lumps: { x: number; y: number; r: number }[] = [];
  const far = (x: number, y: number, d: number) => lumps.every((l) => (l.x - x) ** 2 + (l.y - y) ** 2 >= d * d);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const at = j * W + i;
    if (!cover[at] || [[-1, 0], [1, 0], [0, -1], [0, 1]].every(([di, dj]) => inMap(i + di, j + dj) && cover[at + dj * W + di])) continue;
    if (far(i, j, 11)) lumps.push({ x: i, y: j, r: 6 + Math.round(h01(i, j, 93 + ri) * 3) });
  }
  const rim = lumps.length;
  for (let j = 10; j < H; j += 20) for (let i = 12; i < W; i += 26) {
    const x = Math.round(i + (h01(i, j, 91 + ri) - 0.5) * 12), y = Math.round(j + (h01(j, i, 92 + ri) - 0.5) * 8);
    if (!inMap(x, y) || !cover[y * W + x]) continue;
    let deep = true;
    for (let dj = -12; dj <= 12 && deep; dj += 4) for (let di = -12; di <= 12; di += 4) if (!inMap(x + di, y + dj) || !cover[(y + dj) * W + x + di]) { deep = false; break; }
    if (deep) lumps.push({ x, y, r: 8 + Math.round(h01(x, y, 94 + ri) * 4) });
  }
  // (back to front: the lower a lump, the nearer)
  const order = lumps.map((_, n) => n).sort((a, b) => lumps[a].y - lumps[b].y || lumps[a].x - lumps[b].x);
  // who is on top at each pixel: a lump's index, -1 the flat body of the cloud, -2 no cloud
  const top = new Int16Array(W * H).fill(-2);
  for (let at = 0; at < W * H; at++) if (cover[at]) top[at] = -1;
  for (const n of order) {
    const p = lumps[n];
    for (let dj = -p.r; dj <= p.r; dj++) for (let di = -p.r; di <= p.r; di++) {
      if (di * di + dj * dj > p.r * p.r + p.r * 0.6 || !inMap(p.x + di, p.y + dj)) continue;
      top[(p.y + dj) * W + p.x + di] = n;
    }
  }
  const rank = new Int32Array(lumps.length);
  order.forEach((n, k) => { rank[n] = k; });
  const nearer = (a: number, b: number) => rank[a] > rank[b];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const who = top[j * W + i];
    if (who === -2) continue;
    let c = base;
    // the cloud's outside edge in ink; where a lump stands over the one behind it (or over the body), its upper rim
    // in the shade, so the lumps stack like a cumulus
    const out = [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([di, dj]) => !inMap(i + di, j + dj) || top[(j + dj) * W + i + di] === -2);
    if (out) c = ink;
    else if (who >= 0) {
      const p = lumps[who], dx = i - p.x, dy = j - p.y, rr = Math.sqrt(dx * dx + dy * dy);
      const up = top[(j - 1) * W + i], left = top[j * W + i - 1];
      const over = (o: number) => o !== who && (o === -1 ? who >= rim || dy < 0 : o >= 0 && nearer(who, o));
      if (dy <= 1 && (over(up) || (dx < 0 && over(left)))) c = dark;
      else if (dy > p.r * 0.35 && rr > p.r - 2.2) c = dark;
      else if (dx + dy < -p.r * 0.6 && rr < p.r - 2) c = lit;
    }
    R.set(X0 + i, Y0 + j, c);
  }
}

/**
 * The map's picture with the given regions under cloud: the ground and the water, the brook and the roads, Millbrook's
 * fields, the growths back to front with the places' landmarks and HOME among them (sorted by their feet), then the
 * clouds. Plain RGBA over MAP_RECT.
 */
export function worldRaster(clouded: readonly RegionId[]): Raster {
  const R = new Raster();
  paintGround(R);
  paintWays(R);
  paintFields(R);
  const things: Growth[] = [...growths().growths];
  for (const p of PLACES) { const f = footprint(p.art, p.at); things.push({ s: PLACE_ART[p.art], x: f.x, y: f.y, foot: p.at[1] }); }
  { const f = homeRect(); things.push({ s: HOME_ART, x: f.x, y: f.y, foot: MAP_HOME[1] }); }
  things.sort((a, b) => a.foot - b.foot || a.x - b.x);
  for (const g of things) R.sprite(g.s, g.x, g.y);
  REGIONS.forEach((r, ri) => { if (clouded.includes(r.id)) paintCloud(R, ri); });
  return R;
}

// ---------- the view's canvas ----------

const CANVASES = new Map<string, HTMLCanvasElement>();
/** The map's picture as a canvas (MAP_RECT's size), with the regions not in `explored` under cloud: made once for each set, and kept. */
export function worldCanvas(explored: readonly RegionId[]): HTMLCanvasElement {
  const clouded = REGIONS.filter((r) => !explored.includes(r.id)).map((r) => r.id), key = clouded.join(',');
  let c = CANVASES.get(key);
  if (c) return c;
  const R = worldRaster(clouded);
  c = document.createElement('canvas');
  c.width = W; c.height = H;
  c.getContext('2d')!.putImageData(new ImageData(R.data, W, H), 0, 0);
  if (CANVASES.size >= 4) CANVASES.clear();
  CANVASES.set(key, c);
  return c;
}

// ---------- the living parts ----------

/**
 * The mill's sails at `step` (0-3, a quarter turn in four): four 6 px arms from the hub, each with its cloth on the side
 * it turns toward, the hub in the cap's shade (13 x 13, the hub at its middle).
 */
const SAILS: readonly Sprite[] = [0, 1, 2, 3].map((step) => {
  const g = Array.from({ length: 13 }, () => Array<string>(13).fill('.'));
  const a0 = (step * Math.PI) / 8;
  for (let k = 0; k < 4; k++) {
    const a = a0 + (k * Math.PI) / 2, dx = Math.cos(a), dy = Math.sin(a), px = -dy, py = dx;
    for (let r = 1; r <= 6; r++) {
      const x = Math.round(6 + dx * r), y = Math.round(6 + dy * r);
      g[y][x] = 's';
      if (r >= 2) { const cx = Math.round(6 + dx * r + px), cy = Math.round(6 + dy * r + py); if (g[cy]?.[cx] === '.') g[cy][cx] = 'c'; }
    }
  }
  g[6][6] = 'R';
  return sp(g.map((row) => row.join('')), { s: WOOD, c: CREAM, R: ROOF_SHADE });
});
/** A puff of smoke or steam (2 x 2, inked): its colour. */
function puff(ctx: CanvasRenderingContext2D, x: number, y: number, c: string): void {
  ctx.fillStyle = INK; ctx.fillRect(x - 1, y - 1, 4, 4);
  ctx.fillStyle = c; ctx.fillRect(x, y, 2, 2);
}
/** A column of puffs rising from (x, y): three, stepping up and drifting right, over a 90-frame loop. */
function rising(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, c: string, salt: number): void {
  for (let n = 0; n < 3; n++) {
    const u = ((t + salt * 37 + n * 30) % 90) / 90;
    puff(ctx, Math.round(x + u * 4 + Math.sin((u + n) * 3) * 1.2), Math.round(y - 3 - u * 12), c);
  }
}

/**
 * The map's living parts over its picture, at the view's frame `t`: the sea's glints winking, the mill's sails turning,
 * smoke from Emberfell's cones and from Ashfall's and Snowbound's chimneys, steam off the hot springs, and a bolt
 * flickering over Thunder Ridge -- each only where its region is explored.
 */
export function drawAlive(ctx: CanvasRenderingContext2D, t: number, explored: readonly RegionId[]): void {
  const L = worldLand();
  // the sea's glints: a few short marks on the open sea, each lit for part of its own loop
  ctx.fillStyle = MAP_COLOURS.seaGlint;
  for (let n = 0; n < 60; n++) {
    const i = Math.floor(h01(n, 1, 97) * (W - 4)), j = Math.floor(h01(n, 2, 97) * (H - 2)), at = j * W + i;
    if (L.kind[at] !== SEA || L.shore[at] < 5 || L.shore[at + 3] < 5) continue;
    const phase = (t + Math.floor(h01(n, 3, 97) * 240)) % 240;
    if (phase < 120) ctx.fillRect(X0 + i + (phase < 60 ? 0 : 1), Y0 + j, 3, 1);
  }
  const mill = PLACES.find((p) => p.art === 'windmill');
  if (mill && explored.includes(mill.region)) {
    // (the hub over the cap's lower edge: the sprite's row 3, its middle column)
    const f = footprint('windmill', mill.at), s = SAILS[Math.floor(t / 12) % SAILS.length];
    drawSpriteAt(ctx, s, f.x + 6 - 6, f.y + 3 - 6);
  }
  if (explored.includes('emberfell')) craters().forEach((c, n) => rising(ctx, c.x, c.y, t, CONE.smoke, n));
  const chimney = (name: string, dx: number, dy: number, c: string, salt: number) => {
    const p = PLACES.find((q) => q.name === name);
    if (!p || !explored.includes(p.region)) return;
    const f = footprint(p.art, p.at);
    rising(ctx, f.x + dx, f.y + dy, t, c, salt);
  };
  chimney('ASHFALL', 13, 1, CONE.smoke, 7);
  chimney('SNOWBOUND', 11, 0, CONE.smoke, 8);
  chimney('THE HOT SPRINGS', 4, 1, '#f4f8fc', 9);
  chimney('THE HOT SPRINGS', 13, 1, '#f4f8fc', 10);
  // Thunder Ridge's bolt: lit for 8 frames in every 150
  const ridge = PLACES.find((p) => p.art === 'ridge');
  if (ridge && explored.includes(ridge.region) && t % 150 < 8) {
    const f = footprint('ridge', ridge.at);
    drawSpriteAt(ctx, BOLT, f.x + 5, f.y + 4);
  }
}
/**
 * A place's landmark at `k` times its size, its foot at (cx, footY) -- every pixel a k x k block, ringed in k px of ink
 * (the map's own drawing, blown up whole) -- the mill with its sails at the view's frame `t` (the chooser's picture).
 */
export function drawLandmark(ctx: CanvasRenderingContext2D, art: PlaceArt, cx: number, footY: number, k: number, t = 0): void {
  const s = PLACE_ART[art], { w, h } = sizeOf(s), x = Math.round(cx - (w * k) / 2), y = Math.round(footY - h * k);
  drawScaled(ctx, s, x, y, k);
  if (art === 'windmill') drawScaled(ctx, SAILS[Math.floor(t / 12) % SAILS.length], x + (6 - 6) * k, y + (3 - 6) * k, k);
}
/** A sprite at its top left, `k` times its size, every pixel ringed in ink. */
export function drawScaled(ctx: CanvasRenderingContext2D, s: Sprite, x: number, y: number, k: number): void {
  ctx.fillStyle = INK;
  for (let r = 0; r < s.rows.length; r++) for (let c = 0; c < s.rows[r].length; c++) if (s.rows[r][c] !== '.') ctx.fillRect(x + (c - 1) * k, y + (r - 1) * k, 3 * k, 3 * k);
  for (let r = 0; r < s.rows.length; r++) for (let c = 0; c < s.rows[r].length; c++) { const q = s.rows[r][c]; if (q !== '.') { ctx.fillStyle = s.colors[q]; ctx.fillRect(x + c * k, y + r * k, k, k); } }
}

/** Thunder Ridge's bolt, lit white for its flash (over the drawn one: the ridge's sprite, rows 4-7). */
const BOLT = sp(['.y', 'yy', '.y', 'y.'], { y: '#fffbe0' });
/** A sprite at its top left on a canvas, every pixel ringed in ink (icons.ts drawSprite, at a top left). */
const drawSpriteAt = (ctx: CanvasRenderingContext2D, s: Sprite, x: number, y: number): void => drawScaled(ctx, s, x, y, 1);

// ---------- routes ----------

const ROUTES = new Map<string, [number, number][] | null>();
/**
 * The way a team walks from HOME to a place (the road network's shortest, through explored regions but for the place
 * itself): its points (screen px), HOME first; null if no road reaches it. Worked out once for each place and map.
 */
export function routeTo(place: string, explored: readonly RegionId[]): [number, number][] | null {
  const key = `${place}|${[...explored].sort().join(',')}`;
  if (ROUTES.has(key)) return ROUTES.get(key)!;
  const route = findRoute(place, explored);
  ROUTES.set(key, route);
  return route;
}
function findRoute(place: string, explored: readonly RegionId[]): [number, number][] | null {
  const nodes = new Set<string>(['HOME', ...Object.keys(JUNCTIONS), ...PLACES.map((p) => p.name)]);
  const ok = (n: string) => { const p = PLACES.find((q) => q.name === n); return !p || explored.includes(p.region) || n === place; };
  const dist = new Map<string, number>([['HOME', 0]]), prev = new Map<string, [string, [number, number][]]>(), done = new Set<string>();
  while (true) {
    let cur: string | null = null, cd = Infinity;
    for (const [n, d] of dist) if (!done.has(n) && d < cd) { cur = n; cd = d; }
    if (cur == null) return null;
    if (cur === place) break;
    done.add(cur);
    for (const [a, b] of ROADS) {
      const next = a === cur ? b : b === cur ? a : null;
      if (!next || !nodes.has(next) || done.has(next) || !ok(next)) continue;
      const line = a === cur ? roadLine(a, b) : [...roadLine(a, b)].reverse();
      let len = 0;
      for (let i = 1; i < line.length; i++) len += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
      if (cd + len < (dist.get(next) ?? Infinity)) { dist.set(next, cd + len); prev.set(next, [cur, line]); }
    }
  }
  const parts: [number, number][][] = [];
  for (let n = place; n !== 'HOME'; n = prev.get(n)![0]) parts.unshift(prev.get(n)![1]);
  return parts.flat();
}

/** The point a fraction u (0..1) of the way along a route (by length). */
export function alongRoute(route: readonly (readonly [number, number])[], u: number): [number, number] {
  let total = 0;
  for (let i = 1; i < route.length; i++) total += Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]);
  let want = Math.max(0, Math.min(1, u)) * total;
  for (let i = 1; i < route.length; i++) {
    const d = Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]);
    if (want <= d) { const k = d ? want / d : 0; return [route[i - 1][0] + (route[i][0] - route[i - 1][0]) * k, route[i - 1][1] + (route[i][1] - route[i - 1][1]) * k]; }
    want -= d;
  }
  const e = route[route.length - 1];
  return [e[0], e[1]];
}

/**
 * What is wrong with the map's layout, if anything (sim-check's map checks; each a line): a landmark off its own
 * region's land, or much of it over water; two landmarks (or one and HOME) too close; a region's name point off its
 * land; a big shape with no room; a road over the sea or the lake; a place no road reaches from HOME.
 */
export function mapProblems(): string[] {
  const out: string[] = [], L = worldLand();
  for (const p of PLACES) {
    const f = footprint(p.art, p.at), ri = REGIONS.findIndex((r) => r.id === p.region);
    let off = 0, wet = 0;
    for (let v = f.y; v < f.y + f.h; v++) for (let u = f.x; u < f.x + f.w; u++) {
      const at = landAt(u, v);
      if (at < 0) off++;
      else if (L.kind[at] === SEA || L.kind[at] === LAKE) wet++;
      else if (L.region[at] !== ri) off++;
    }
    if (off) out.push(`${p.name}: ${off} px of its landmark off ${regionOf(p.region).name}`);
    let brook = 0;
    for (let v = f.y; v < f.y + f.h; v++) for (let u = f.x; u < f.x + f.w; u++) { const at = landAt(u, v); if (at >= 0 && ways().river[at]) brook++; }
    if (brook && p.art !== 'bridge') out.push(`${p.name}: its landmark stands in the brook (${brook} px)`);
    if (wet > f.w * f.h * 0.15) out.push(`${p.name}: ${wet} of its landmark's ${f.w * f.h} px over water`);
  }
  const boxes = [...PLACES.map((p) => ({ name: p.name, r: footprint(p.art, p.at) })), { name: 'HOME', r: homeRect() }];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i].r, b = boxes[j].r;
    if (a.x < b.x + b.w + 3 && b.x < a.x + a.w + 3 && a.y < b.y + b.h + 3 && b.y < a.y + a.h + 3) out.push(`${boxes[i].name} and ${boxes[j].name} stand too close`);
  }
  for (const r of REGIONS) { const at = landAt(r.map.label[0], r.map.label[1]); if (at < 0 || L.region[at] !== REGIONS.indexOf(r)) out.push(`${r.name}'s name point is off its land`); }
  out.push(...growths().missed.map((m) => `${m}: not placed`));
  for (const [a, b] of ROADS) {
    const wet = roadLine(a, b).filter(([x, y]) => { const at = landAt(x, y); return at >= 0 && (L.kind[at] === SEA || L.kind[at] === LAKE); }).length;
    if (wet) out.push(`the road ${a} - ${b} crosses water (${wet} samples)`);
  }
  const all = REGIONS.map((r) => r.id);
  for (const p of PLACES) if (!routeTo(p.name, all)) out.push(`no road reaches ${p.name}`);
  return out;
}

