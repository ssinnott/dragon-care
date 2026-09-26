// The elder garden, drawn (docs/BASE_DESIGN.md 3 "The Garden"; plan S6): outside, east of the right tower, a row of
// 176 px plots. One plot's tile is drawn once and kept (three kinds: plot 0's with the bench and the GARDEN sign's
// posts, every other plot's with an apple tree, the rest plain; and the strip past the last plot), and the view draws
// only the plots on screen, in world space after the building -- so no canvas grows with the garden (plan P11), and
// the tile covers the building canvas's own ground east of the tower. The house style: a 1 px #1a1018 outline, flat
// cel bands lit from the top left, no gradients, no mark under 2 px.
// Behind the feet (y < 688): a lawn band, rounded hedge blobs, an apple tree on every other plot, a bench on plot 0,
// one straw nest mound per plot (the resident naps before it), a lantern on its post, flowers on stalks in the lawn. Under
// the feet (the band, y 688-702): the path, FLOORS.path (gates i and Ki: pale, S 0.13, no green underfoot), then a
// stone kerb, and below the ground the earth and its 5 px grass strip: the only green below the feet. A picket fence
// stands 40 px in from the world's end, and moves out as the garden grows. At dusk and night each lantern throws two
// stepped rings on the hedge (never on the path: gate w, surfaces.ts LANTERN_RINGS). Nothing here is sad: no graves,
// no wilting, no autumn -- the garden is the elder's reward (B8, ART_BIBLE D21), always in leaf, apples on the trees.
import { makeTones } from '../lib/art/shading.ts';
import { GARDEN_X0, GARDEN_PLOT, GARDEN_END, GROUND, WORLD_H, BAND, SLAB, GARDEN_PLATE, floorTop, plotMid } from './layout.ts';
import { FLOORS, INK, BACKDROPS, NEST, LIGHTS, LANTERN_RINGS, PATH_EDGE } from './surfaces.ts';
import type { Lights } from './sky.ts';
import { plate } from './building.ts';
import { measureText } from '../lib/engine/text.ts';

/** The band a garden dragon's feet stand in (the ground floor's: y 688-702), the kerb under it, and the tile's top (a tree's crown). */
const BAND_Y = floorTop(0) + 88, KERB_Y = BAND_Y + BAND, TILE_Y = 520;
/** The hedge's blobs' middles (y), their radius, their spacing, and the lawn's top. */
const HEDGE_Y = 612, HEDGE_R = 13, HEDGE_DX = 22, LAWN_Y = 640;
/** A tile's lantern (x in the tile, the lamp's top-left y), and its tree's trunk x. */
const LANTERN_X = 164, LAMP_Y = 611, TREE_X = 112;
/** Every blob's y offset across one tile (8 blobs of 22 px: the tiles meet seamlessly). */
const BLOB_DY = [0, -3, 1, -2, 0, -4, 2, -1] as const;
/** The flowers in one tile's lawn: x, y (the blossom's middle), colour (drawn by `flower`). */
const FLOWERS: readonly (readonly [number, number, string])[] = [[14, 670, '#f3e6c8'], [41, 658, '#e89ab0'], [67, 676, '#f2d36a'], [96, 664, '#b8a8e0'], [125, 674, '#f3e6c8'], [149, 657, '#e89ab0'], [31, 681, '#f2d36a'], [138, 683, '#b8a8e0']];
/** A tree's apples on its crown (dx, dy from the crown's middle). */
const APPLES: readonly (readonly [number, number])[] = [[-14, -6], [-4, 4], [9, -10], [15, 3], [2, -18], [-18, 6]];

function rect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string): void { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
function disc(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, c: string): void { g.fillStyle = c; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill(); }
/**
 * A lawn flower: a round 4 x 4 blossom (its corners cut) on a 2 x 2 stalk in the lawn's shade -- every mark 2 px or
 * more, so it reads as a plant, never as a twinkle (a 1 px plus did).
 */
function flower(g: CanvasRenderingContext2D, x: number, y: number, c: string): void {
  rect(g, x - 1, y - 2, 2, 4, c); rect(g, x - 2, y - 1, 4, 2, c);
  rect(g, x - 1, y + 2, 2, 2, makeTones(BACKDROPS.lawn).sh);
}
/** An inked box with a lit top row (top-left light). */
function box(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string): void {
  rect(g, x, y, w, h, INK); rect(g, x + 1, y + 1, w - 2, h - 2, c); rect(g, x + 1, y + 1, w - 2, 1, makeTones(c).hi);
}

/** The middle of the hedge's k-th blob from a tile's left edge (k may run past the tile: the pattern repeats each tile). */
function blob(k: number): [number, number] { return [HEDGE_DX / 2 + k * HEDGE_DX, HEDGE_Y + BLOB_DY[((k % 8) + 8) % 8]]; }
/** The hedge's blobs across a tile (and one past each end, so the ink round their union meets the next tile's). */
function hedge(g: CanvasRenderingContext2D): void {
  const blobs: [number, number][] = [];
  for (let k = -1; k <= GARDEN_PLOT / HEDGE_DX; k++) blobs.push(blob(k));
  const tn = makeTones(BACKDROPS.hedge);
  for (const [x, y] of blobs) disc(g, x, y, HEDGE_R + 1, INK);
  for (const [x, y] of blobs) disc(g, x, y, HEDGE_R, BACKDROPS.hedge);
  rect(g, 0, HEDGE_Y, GARDEN_PLOT, LAWN_Y - HEDGE_Y + 2, BACKDROPS.hedge);
  // (a lit crescent on each blob's top left, and the hedge's shadow over the lawn)
  for (const [x, y] of blobs) rect(g, x - 7, y - 10, 6, 2, tn.hi);
  rect(g, 0, LAWN_Y - 3, GARDEN_PLOT, 3, tn.sh);
}

/** An apple tree behind the hedge: its trunk, a crown of hedge-green discs, and its apples (2 x 2). */
function tree(g: CanvasRenderingContext2D, x: number): void {
  const cy = 556;
  rect(g, x - 4, cy + 8, 8, HEDGE_Y - cy, INK); rect(g, x - 3, cy + 8, 6, HEDGE_Y - cy, BACKDROPS.trunk); rect(g, x - 3, cy + 8, 2, HEDGE_Y - cy, makeTones(BACKDROPS.trunk).hi);
  const crown: [number, number, number][] = [[x - 12, cy + 2, 14], [x + 11, cy + 1, 13], [x, cy - 10, 15], [x, cy + 6, 13]];
  for (const [a, b, r] of crown) disc(g, a, b, r + 1, INK);
  for (const [a, b, r] of crown) disc(g, a, b, r, BACKDROPS.hedge);
  const tn = makeTones(BACKDROPS.hedge);
  rect(g, x - 16, cy - 16, 8, 2, tn.hi); rect(g, x - 6, cy - 22, 7, 2, tn.hi);
  for (const [dx, dy] of APPLES) rect(g, x + dx, cy + dy, 2, 2, '#e0664a');
}

/** Plot 0's bench against the hedge, behind the path (a seat, a back rail and its legs). */
function bench(g: CanvasRenderingContext2D, x: number): void {
  const w = 44, seat = BAND_Y - 12;
  box(g, x, seat - 12, w, 4, BACKDROPS.trunk);
  box(g, x, seat, w, 4, BACKDROPS.trunk);
  for (const lx of [x + 3, x + w - 6]) { box(g, lx, seat - 10, 3, 10, BACKDROPS.trunk); box(g, lx, seat + 3, 3, BAND_Y - seat - 1, BACKDROPS.trunk); }
}

/** The GARDEN sign's two posts over plot 0 (the view draws its board, the plate, with the other plates). */
function signPosts(g: CanvasRenderingContext2D): void {
  const x = GARDEN_PLATE.x - GARDEN_X0, w = measureText('GARDEN', 1) + 6, y = GARDEN_PLATE.y + 8;
  for (const px of [x + 5, x + w - 7]) { rect(g, px - 1, y, 4, HEDGE_Y - y, INK); rect(g, px, y, 2, HEDGE_Y - y, BACKDROPS.trunk); }
}

/** A plot's nest mound, the straw its resident naps before: a low inked half-ellipse behind the band, its foot under it. */
function mound(g: CanvasRenderingContext2D, cx: number): void {
  const base = BAND_Y + 3, rx = 34, ry = 11;
  g.fillStyle = INK; g.beginPath(); g.ellipse(cx, base, rx + 1, ry + 1, 0, Math.PI, Math.PI * 2); g.closePath(); g.fill();
  g.fillStyle = NEST; g.beginPath(); g.ellipse(cx, base, rx, ry, 0, Math.PI, Math.PI * 2); g.closePath(); g.fill();
  for (const [dx, dy] of [[-26, 4], [-14, 8], [6, 9], [19, 6], [-3, 4]] as const) rect(g, cx + dx, base - dy, 4, 2, '#c8b68c');
}

/** A lantern on its post (the post 2 px, the lamp 6 x 6 in a 1 px ink box, a cap over it). */
function lantern(g: CanvasRenderingContext2D, x: number): void {
  rect(g, x - 2, LAMP_Y + 7, 4, BAND_Y - LAMP_Y - 7, INK); rect(g, x - 1, LAMP_Y + 7, 2, BAND_Y - LAMP_Y - 7, BACKDROPS.trunk);
  rect(g, x - 4, LAMP_Y, 8, 8, INK); rect(g, x - 3, LAMP_Y + 1, 6, 6, LIGHTS.lantern);
  rect(g, x - 5, LAMP_Y - 2, 10, 3, INK); rect(g, x - 4, LAMP_Y - 1, 8, 1, BACKDROPS.trunk);
}

/** Under the feet: the path band (its 1 px back edge), the stone kerb, the ground below (earth and its grass strip). */
function ground(g: CanvasRenderingContext2D, w: number): void {
  rect(g, 0, BAND_Y, w, BAND, FLOORS.path); rect(g, 0, BAND_Y, w, 1, PATH_EDGE);
  rect(g, 0, KERB_Y, w, SLAB, '#a49c90'); rect(g, 0, KERB_Y, w, 1, '#857d72');
  for (let x = 20; x < w; x += 40) rect(g, x, KERB_Y + 1, 1, SLAB - 1, '#857d72');
  rect(g, 0, GROUND, w, WORLD_H - GROUND, '#7a5a40'); rect(g, 0, GROUND, w, 5, '#86a860'); rect(g, 0, GROUND + 5, w, 1, '#5e7a44');
  for (let x = 7; x < w; x += 23) rect(g, x, GROUND + 14 + (x % 3) * 6, 3, 2, '#654834');
}

/** The kinds of tile: plot 0 (the bench and the sign's posts, a tree), an even plot (a tree), an odd one, and the end strip. */
type Tile = 'first' | 'tree' | 'plain' | 'end';
const TILES = new Map<Tile, HTMLCanvasElement>();
/** One kind of tile, drawn once: 176 px wide, from the trees' crowns (y 520) to the world's foot. */
function tile(kind: Tile): HTMLCanvasElement {
  const had = TILES.get(kind);
  if (had) return had;
  const c = document.createElement('canvas');
  c.width = GARDEN_PLOT; c.height = WORLD_H - TILE_Y;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.translate(0, -TILE_Y);
  if (kind === 'first') signPosts(g);
  if (kind === 'first' || kind === 'tree') tree(g, TREE_X);
  hedge(g);
  rect(g, 0, LAWN_Y, GARDEN_PLOT, BAND_Y - LAWN_Y, BACKDROPS.lawn);
  rect(g, 0, LAWN_Y, GARDEN_PLOT, 1, makeTones(BACKDROPS.lawn).sh);
  for (const [x, y, col] of FLOWERS) { if (kind === 'end' && x > GARDEN_END - 2) continue; flower(g, x, y, col); }
  if (kind !== 'end') {
    if (kind === 'first') bench(g, 16);
    mound(g, GARDEN_PLOT / 2);
    lantern(g, LANTERN_X);
  }
  ground(g, GARDEN_PLOT);
  TILES.set(kind, c);
  return c;
}

/** The picket fence 40 px in from the world's end: 3 px pickets with pointed tops on two rails, standing on the path's back edge. */
function fence(g: CanvasRenderingContext2D, worldW: number): void {
  const x0 = worldW - GARDEN_END - 8, top = BAND_Y - 26, c = BACKDROPS.fence;
  for (const ry of [top + 8, top + 18]) { rect(g, x0 - 2, ry - 1, worldW - x0 + 2, 4, INK); rect(g, x0 - 1, ry, worldW - x0, 2, c); }
  for (let x = x0; x < worldW - 2; x += 7) {
    g.fillStyle = INK; g.beginPath(); g.moveTo(x - 1, BAND_Y + 1); g.lineTo(x - 1, top + 2); g.lineTo(x + 1.5, top - 2); g.lineTo(x + 4, top + 2); g.lineTo(x + 4, BAND_Y + 1); g.closePath(); g.fill();
    g.fillStyle = c; g.beginPath(); g.moveTo(x, BAND_Y); g.lineTo(x, top + 2); g.lineTo(x + 1.5, top - 0.5); g.lineTo(x + 3, top + 2); g.lineTo(x + 3, BAND_Y); g.closePath(); g.fill();
  }
  // (its foot stands in the path's back edge, never over the band the feet are in)
  rect(g, x0 - 2, BAND_Y, worldW - x0 + 2, 1, PATH_EDGE);
}

/**
 * The garden, in world space (the caller translates by the camera), after the building and before the lights: each
 * plot on screen from its cached tile, the strip past the last plot, and the fence at the world's end. `view`: the
 * world x the screen spans.
 */
export function drawGarden(g: CanvasRenderingContext2D, plots: number, worldW: number, view: readonly [number, number]): void {
  for (let i = 0; i <= plots; i++) {
    const x = GARDEN_X0 + i * GARDEN_PLOT;
    if (x > view[1] || x + GARDEN_PLOT < view[0]) continue;
    const kind: Tile = i === plots ? 'end' : i === 0 ? 'first' : i % 2 === 0 ? 'tree' : 'plain';
    const w = Math.min(GARDEN_PLOT, worldW - x);
    if (w > 0) g.drawImage(tile(kind), 0, 0, w, WORLD_H - TILE_Y, x, TILE_Y, w, WORLD_H - TILE_Y);
  }
  if (worldW - 48 <= view[1]) fence(g, worldW);
}

/**
 * The lanterns' light, in world space after the lights of the building and before the plates (never over a dragon:
 * plan G8): as the dusk's sky turns, and until the dawn's has (sky.ts lightsOf, like the dorm's lamps), each lantern on
 * screen throws its stepped rings (the inner one, then both) on the hedge, clipped to the hedge's own shape -- its
 * blobs' fill and the band under them, so the light follows the scalloped top, inside its ink -- never on the sky over
 * it, the lawn or the path; and its lamp is drawn over them.
 */
export function drawGardenLights(g: CanvasRenderingContext2D, plots: number, lit: Lights, view: readonly [number, number]): void {
  if (lit.rings <= 0) return;
  for (let i = 0; i < plots; i++) {
    const t0 = GARDEN_X0 + i * GARDEN_PLOT, x = t0 + LANTERN_X;
    if (x + 20 < view[0] || x - 20 > view[1]) continue;
    g.save();
    g.beginPath(); g.rect(x - 20, HEDGE_Y - HEDGE_R - 8, 40, LAWN_Y - 3 - (HEDGE_Y - HEDGE_R - 8)); g.clip();
    g.beginPath();
    for (let k = 0; k <= GARDEN_PLOT / HEDGE_DX + 2; k++) { const [bx, by] = blob(k); g.moveTo(t0 + bx + HEDGE_R, by); g.arc(t0 + bx, by, HEDGE_R, 0, Math.PI * 2); }
    g.rect(t0, HEDGE_Y, GARDEN_PLOT + HEDGE_DX * 2, LAWN_Y - 3 - HEDGE_Y);
    g.clip();
    const cy = LAMP_Y + 4;
    if (lit.rings > 1) disc(g, x, cy, 16, LANTERN_RINGS[1]);
    disc(g, x, cy, 10, LANTERN_RINGS[0]);
    g.restore();
    lantern(g, x);
  }
}

/** The GARDEN plate on its sign over plot 0 (drawn with the other plates: under the cast, so it never covers a face). */
export function drawGardenPlate(g: CanvasRenderingContext2D, view: readonly [number, number]): void {
  if (GARDEN_PLATE.x > view[1] || GARDEN_PLATE.x + 60 < view[0]) return;
  plate(g, 'GARDEN', GARDEN_PLATE.x, GARDEN_PLATE.y);
}

/** Where a plot's nest mound lies (its middle, world x): the resident's bed. */
export { plotMid };
