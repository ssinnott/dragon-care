// The base's building, drawn once (docs/BASE_DESIGN.md 2): sky and ground, the two stone towers, every room with
// its props, the gambrel roof over the hayloft, the hoist shaft and the aerie. Greybox: blocks in the house style (a
// 1 px #1a1018 outline, flat cel bands lit from the top-left, no gradients) standing in for the room art to come. The
// floors a dragon stands on are straw, the gate (i) reference (ART_BIBLE 5.4); a room's identity is its wall colour
// and its props. The room names go on a separate layer, drawn over the cast.
import { makeTones } from '../lib/art/shading.ts';
import { drawText, measureText } from '../lib/engine/text.ts';
import { DRAGON_PALETTES } from '../art/dragon/palettes.ts';
import type { DragonElement } from '../art/dragon/palettes.ts';
import {
  WORLD_W, WORLD_H, GROUND, PITCH, MOD, TOWER_W, WALL, WALL_H, BAND, SLAB, TOWER_L, TOWER_R, BARN_X, BARN_W, HOIST_X, HOIST_W,
  RIDGE_X, RIDGE_Y, KNEE_DX, KNEE_Y, BARN_FLOORS, TOWER_FLOORS, BARN_MODS, LINKS, ROOM_INFO, floorTop, feetY, modX,
} from './layout.ts';
import type { Room, RoomKind } from './layout.ts';

const INK = '#1a1018', STRAW = '#e0d6b8';
/** Barn room walls: mid-light and low in saturation, each room its own (1: the floor stays straw). */
const WALLS: Readonly<Partial<Record<RoomKind, string>>> = {
  kitchen: '#c8ac92', hatchery: '#d4bc98', bath: '#b8c4cc', store: '#bfae90', romp: '#b9b3cf', groom: '#cdb9a3',
  dorm: '#a39cb8', sunloft: '#efe4c8', haystore: '#c8a878', roost: '#9fb0c0', attic: '#b0a08a',
};
const EMPTY_WALL = '#9a8a76';

// ---------- the pen ----------

function rect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string): void {
  g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
/** An inked box with a cel band: a lit top row and a shadow at the bottom (top-left light). */
function box(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string, cel = true): void {
  rect(g, x, y, w, h, INK);
  rect(g, x + 1, y + 1, w - 2, h - 2, c);
  if (cel && w > 4 && h > 4) {
    const t = makeTones(c), s = Math.max(1, Math.round((h - 2) * 0.28));
    rect(g, x + 1, y + 1, w - 2, 1, t.hi);
    rect(g, x + 1, y + h - 1 - s, w - 2, s, t.sh);
  }
}
function disc(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, c: string, ink = true): void {
  if (ink) { g.fillStyle = INK; g.beginPath(); g.arc(cx, cy, r + 1, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = c; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
}
function oval(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, c: string): void {
  g.fillStyle = INK; g.beginPath(); g.ellipse(cx, cy, rx + 1, ry + 1, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = c; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.fill();
}
function path(g: CanvasRenderingContext2D, pts: readonly number[]): void {
  g.beginPath(); g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
}
function poly(g: CanvasRenderingContext2D, pts: readonly number[], c: string, ink = true): void {
  path(g, pts); g.fillStyle = c; g.fill();
  if (ink) { g.strokeStyle = INK; g.lineWidth = 1; g.stroke(); }
}
function line(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, c: string, w = 1): void {
  g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.strokeStyle = c; g.lineWidth = w; g.stroke();
}
/** A room's name plate. */
export function plate(g: CanvasRenderingContext2D, s: string, x: number, y: number): void {
  const w = measureText(s, 1) + 6;
  box(g, x, y, w, 11, '#6b4a34', false);
  rect(g, x + 1, y + 1, w - 2, 1, '#8a6446');
  drawText(g, s, x + 3, y + 2, { color: '#f3e6c8', shadow: false });
}

// ---------- the structure ----------

function slab(g: CanvasRenderingContext2D, x0: number, x1: number, y: number): void {
  rect(g, x0, y, x1 - x0, SLAB, INK);
  rect(g, x0, y + 1, x1 - x0, SLAB - 2, '#6b4a34');
  rect(g, x0, y + 1, x1 - x0, 1, '#86603f');
  for (let x = x0 + 20; x < x1; x += 40) rect(g, x, y + 1, 1, SLAB - 2, '#4e3424');
}
function post(g: CanvasRenderingContext2D, x: number, y0: number, y1: number): void { rect(g, x - 2, y0, 4, y1 - y0, INK); rect(g, x - 1, y0, 2, y1 - y0, '#8a6242'); }

/** The gambrel's inside: the hayloft's ceiling line, eave to ridge to eave. */
const ROOF_IN: readonly number[] = [BARN_X + 4, GROUND - 2 * PITCH, BARN_X + KNEE_DX, KNEE_Y, RIDGE_X, RIDGE_Y, TOWER_R - KNEE_DX, KNEE_Y, TOWER_R - 4, GROUND - 2 * PITCH];
const ROOF_OUT: readonly number[] = [BARN_X - 4, GROUND - 2 * PITCH + 6, BARN_X + KNEE_DX - 12, KNEE_Y - 13, RIDGE_X, RIDGE_Y - 14, TOWER_R - KNEE_DX + 12, KNEE_Y - 13, TOWER_R + 4, GROUND - 2 * PITCH + 6];

/** A barn slot's back wall (planks), straw band and slab, from `top` down (the hayloft's walls run up into the roof). */
function barnWall(g: CanvasRenderingContext2D, x0: number, x1: number, f: number, wall: string, top = floorTop(f)): void {
  const t = floorTop(f), w = x1 - x0, tn = makeTones(wall);
  rect(g, x0, top, w, t + WALL_H - top, wall);
  for (let x = x0 + 12; x < x1 - 4; x += 16) rect(g, x, top, 1, t + WALL_H - top, tn.sh);
  rect(g, x0, t + WALL_H - 3, w, 3, tn.sh);
  rect(g, x0, t + WALL_H, w, BAND, STRAW);
  rect(g, x0, t + WALL_H, w, 1, '#c9bd9c');
  slab(g, x0, x1, t + WALL_H + BAND);
}

/** A tower room's stone wall, plank floor and slab. */
function towerWall(g: CanvasRenderingContext2D, x0: number, x1: number, f: number): void {
  const t = floorTop(f);
  rect(g, x0, t, x1 - x0, WALL_H + BAND, '#c2bbb0');
  for (let y = t + 8, r = 0; y < t + WALL_H; y += 12, r++) {
    rect(g, x0, y, x1 - x0, 1, '#aaa396');
    for (let c = x0 + (r % 2 ? 6 : 14); c < x1; c += 20) rect(g, c, y, 1, 11, '#aaa396');
  }
  rect(g, x0, t + WALL_H, x1 - x0, BAND, '#b08a62');
  for (let c = x0 + 7; c < x1; c += 14) rect(g, c, t + WALL_H + 1, 1, BAND - 1, '#8e6c4a');
  slab(g, x0, x1, t + WALL_H + BAND);
}

// ---------- props (placeholder blocks) ----------

function egg(g: CanvasRenderingContext2D, cx: number, fl: number, el: DragonElement): void {
  oval(g, cx, fl - 4, 12, 4, '#c8b27a');
  const p = DRAGON_PALETTES[el];
  oval(g, cx, fl - 13, 7, 10, p.scale);
  disc(g, cx - 2, fl - 16, 2, p.belly, false);
}
function bale(g: CanvasRenderingContext2D, x: number, y: number, w = 30, h = 20): void {
  box(g, x, y, w, h, '#e3c35e'); rect(g, x + 1, y + 7, w - 2, 1, '#a88a2e'); rect(g, x + 1, y + 13, w - 2, 1, '#a88a2e');
}
function shelf(g: CanvasRenderingContext2D, x: number, y: number, w: number, items: readonly string[]): void {
  box(g, x, y, w, 4, '#8a6242', false);
  items.forEach((c, i) => box(g, x + 3 + i * 11, y - 9, 8, 9, c));
}
function bunk(g: CanvasRenderingContext2D, x: number, fl: number, a: string, b: string): void {
  box(g, x, fl - 62, 4, 62, '#7a5838', false); box(g, x + 56, fl - 62, 4, 62, '#7a5838', false);
  for (const [dy, c] of [[16, a], [50, b]] as const) { box(g, x + 2, fl - dy, 56, 8, '#8a6242'); box(g, x + 6, fl - dy - 6, 40, 7, c); box(g, x + 44, fl - dy - 6, 12, 7, '#f0ead8'); }
}

/** Each room kind's props, over its wall. */
function props(g: CanvasRenderingContext2D, r: Room): void {
  const t = floorTop(r.floor), fl = t + WALL_H + 4, x = r.x0;
  switch (r.kind) {
    case 'kitchen': {
      // the hearth (the kitchen's post: keepers take the bowls from here) and a shelf of crocks
      const hx = x + 6, hf = t + WALL_H;
      box(g, hx, hf - 62, 60, 62, '#9c948a');
      for (let row = 0; row < 5; row++) for (let c = 0; c < 4; c++) rect(g, hx + 2 + c * 15 + (row % 2) * 7, hf - 60 + row * 12, 1, 11, '#7c746c');
      rect(g, hx + 12, hf - 34, 36, 34, INK); rect(g, hx + 13, hf - 33, 34, 33, '#3a2626');
      poly(g, [hx + 18, hf, hx + 24, hf - 18, hx + 30, hf - 8, hx + 34, hf - 24, hx + 42, hf], '#f39a2e');
      poly(g, [hx + 24, hf, hx + 28, hf - 10, hx + 34, hf - 14, hx + 38, hf], '#ffd86a', false);
      box(g, hx + 18, hf - 22, 24, 14, '#4a4450');
      box(g, hx + 4, hf - 88, 52, 26, '#8c847a');
      shelf(g, x + 150, t + 34, 60, ['#d08a5a', '#e8d8b0', '#8a9a6a', '#c86a4a', '#e8d8b0']);
      break;
    }
    case 'hatchery':
      line(g, x + 40, t, x + 40, t + 30, INK); poly(g, [x + 30, t + 30, x + 50, t + 30, x + 46, t + 38, x + 34, t + 38], '#f2c14e');
      egg(g, x + 24, fl + 2, 'water'); egg(g, x + 48, fl + 4, 'dusk');
      break;
    case 'bath': {
      for (let y = t + 18; y < t + WALL_H; y += 10) rect(g, x, y, r.x1 - x, 1, '#a0adb6');
      // the tub (the bathhouse's post: the buckets are filled here)
      const bx = x + 150, w = 150, bf = t + WALL_H + 8;
      box(g, bx, bf - 34, w, 34, '#8e6240');
      for (let i = 1; i < 4; i++) rect(g, bx + 1, bf - 34 + i * 8, w - 2, 1, '#6e4a30');
      rect(g, bx + 3, bf - 38, w - 6, 5, INK); rect(g, bx + 4, bf - 37, w - 8, 3, '#bfe3e0');
      for (const [cx, cy, cr] of [[bx + 20, bf - 44, 3], [bx + 36, bf - 50, 2], [bx + w - 30, bf - 46, 3], [bx + w - 18, bf - 55, 2]]) disc(g, cx, cy, cr, '#dff3f1');
      break;
    }
    case 'store':
      for (const [sx, dy] of [[8, 0], [22, 1], [14, -18]]) { box(g, x + sx, fl + dy - 20, 16, 20, '#cdb88c'); rect(g, x + sx + 5, fl + dy - 22, 6, 3, INK); }
      bale(g, x + 40, fl - 20); bale(g, x + 40, fl - 40);
      break;
    case 'romp': {
      // bunting, and the play wheel that turns the mill (the romp room's post: the balls are kept by it)
      const by = t + 8;
      line(g, x + 110, by, r.x1 - 10, by, '#6e4a30');
      const cs = ['#e0664a', '#f2c14e', '#5aa0c8', '#7bbf6a'];
      for (let bx = x + 116, i = 0; bx < r.x1 - 18; bx += 16, i++) poly(g, [bx, by, bx + 10, by, bx + 5, by + 8], cs[i % 4]);
      const cx = x + 50, cy = t + 46, R = 36;
      disc(g, cx, cy, R, '#a47a52'); disc(g, cx, cy, R - 5, WALLS.romp!, false);
      for (let a = 0; a < 8; a++) { const th = a * Math.PI / 4; line(g, cx, cy, cx + Math.cos(th) * (R - 4), cy + Math.sin(th) * (R - 4), '#6e4a30', 2); }
      disc(g, cx, cy, 4, '#6e4a30');
      box(g, cx - 3, cy, 6, feetY(r.floor) - cy - 4, '#8a6242', false);
      box(g, x + 96, fl - 14, 22, 14, '#a47a52'); disc(g, x + 103, fl - 17, 4, '#e0664a'); disc(g, x + 112, fl - 16, 3, '#5aa0c8');
      break;
    }
    case 'groom':
      box(g, x + 100, t + 22, 44, 5, '#8a6242', false);
      for (let i = 0; i < 3; i++) { box(g, x + 104 + i * 13, t + 27, 6, 12, '#a47a52'); box(g, x + 103 + i * 13, t + 39, 8, 5, '#6b4a34'); }
      break;
    case 'dorm':
      for (const cx of [x + 80, x + 240]) oval(g, cx, fl + 1, 60, 5, '#d8c890');
      box(g, x + 157, t + 50, 6, WALL_H - 50, '#8a6242', false);
      for (const lx of [x + 40, x + 280]) { line(g, lx, t, lx, t + 16, INK); box(g, lx - 4, t + 16, 8, 10, '#ffa98c'); }
      break;
    case 'sunloft':
      // sunlight from the skylight (drawn with the roof), flat and pale
      g.globalAlpha = 0.35;
      poly(g, [x + 92, 346, x + 136, 338, x + 236, t + WALL_H + 10, x + 172, t + WALL_H + 10], '#fff2a0', false);
      g.globalAlpha = 1;
      break;
    case 'haystore':
      bale(g, x + 10, fl - 20); bale(g, x + 86, fl - 20); bale(g, x + 116, fl - 20); bale(g, x + 101, fl - 40);
      break;
    case 'roost':
      box(g, x + 20, t + 6, 280, 5, '#8a6242', false); box(g, x + 40, t + 11, 4, 10, '#6b4a34', false); box(g, x + 276, t + 11, 4, 10, '#6b4a34', false);
      break;
    case 'attic':
      box(g, x + 30, fl - 22, 24, 22, '#a47a52'); box(g, x + 56, fl - 16, 18, 16, '#8a6242');
      break;
    case 'tack':
      box(g, x + 6, t + 40, 40, 4, '#8a6242', false);
      for (const sx of [x + 8, x + 28]) poly(g, [sx, t + 40, sx + 4, t + 30, sx + 14, t + 30, sx + 18, t + 40], '#9a5a3a');
      break;
    case 'mess':
      box(g, x + 4, fl - 22, 44, 5, '#8a6242', false); rect(g, x + 8, fl - 17, 3, 17, '#6b4a34'); rect(g, x + 42, fl - 17, 3, 17, '#6b4a34');
      box(g, x + 12, fl - 27, 9, 5, '#e8d8b0'); box(g, x + 28, fl - 27, 9, 5, '#e8d8b0');
      break;
    case 'bunks': bunk(g, x + (r.part === 'towerL' ? 4 : 28), fl, r.floor % 2 ? '#c86a4a' : '#7bbf6a', r.floor % 2 ? '#5a8ab0' : '#e0a040'); break;
    case 'maproom':
      box(g, x + 6, t + 20, 60, 36, '#e8d8a8');
      line(g, x + 12, t + 30, x + 32, t + 44, '#8a6a4a'); line(g, x + 32, t + 44, x + 54, t + 28, '#8a6a4a');
      for (const [px, py, c] of [[x + 16, t + 32, '#d04a3a'], [x + 36, t + 42, '#3a7ad0'], [x + 52, t + 30, '#d0a03a']] as const) disc(g, px, py, 2, c);
      break;
    case 'infirmary':
      box(g, x + 40, fl - 16, 44, 8, '#8a6242'); box(g, x + 42, fl - 20, 40, 5, '#f0ead8');
      shelf(g, x + 44, t + 40, 40, ['#7bbf6a', '#c8a0d8', '#7bbf6a']);
      break;
    case 'library': {
      box(g, x + 34, t + 18, 42, 70, '#7a5838', false);
      const cs = ['#a04a4a', '#4a6a9a', '#6a8a4a', '#c8a050', '#7a4a7a'];
      for (let row = 0; row < 4; row++) for (let i = 0; i < 6; i++) rect(g, x + 37 + i * 6, t + 22 + row * 17, 5, 13, cs[(row * 3 + i) % 5]);
      break;
    }
    case 'workshop':
      box(g, x + 52, fl - 22, 30, 5, '#8a6242', false); rect(g, x + 56, fl - 17, 3, 17, '#6b4a34'); rect(g, x + 76, fl - 17, 3, 17, '#6b4a34');
      box(g, x + 30, fl - 14, 20, 6, '#4a4450'); box(g, x + 36, fl - 8, 8, 8, '#3a343e');
      break;
    case 'lookout':
      rect(g, r.x1, t + 26, WALL, 30, '#cfe3ea');
      line(g, x + 62, t + 48, x + 92, t + 36, '#8a6242', 4); line(g, x + 64, t + 48, x + 56, t + WALL_H, '#6b4a34', 2); line(g, x + 64, t + 48, x + 72, t + WALL_H, '#6b4a34', 2);
      break;
  }
}

/** A ladder up through one tower floor, at a link's x. */
function ladder(g: CanvasRenderingContext2D, cx: number, f: number): void {
  const t = floorTop(f), x = cx - 6;
  rect(g, x, t, 2, WALL_H + BAND, '#7a5838'); rect(g, x + 10, t, 2, WALL_H + BAND, '#7a5838');
  for (let y = t + 4; y < t + WALL_H + BAND; y += 8) rect(g, x, y, 12, 2, '#7a5838');
}

// ---------- the whole building ----------

/** The building, drawn once onto its own WORLD_W x WORLD_H canvas. */
export function drawBuilding(rooms: readonly Room[]): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = WORLD_W; c.height = WORLD_H;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;

  // sky, clouds, far hills, ground
  rect(g, 0, 0, WORLD_W, WORLD_H, '#cfe3ea');
  for (const [cx, cy, s] of [[240, 90, 1], [640, 60, 1.4], [980, 120, 1], [1250, 250, 0.8], [360, 250, 0.7]]) {
    for (const [dx, dy, r] of [[0, 0, 14], [16, -6, 18], [34, 0, 13], [18, 6, 12]]) disc(g, cx + dx * s, cy + dy * s, r * s, '#eef6f7', false);
  }
  poly(g, [0, 640, 180, 600, 420, 630, 700, 590, 980, 626, 1200, 596, WORLD_W, 620, WORLD_W, GROUND, 0, GROUND], '#b3cfae', false);
  rect(g, 0, GROUND, WORLD_W, WORLD_H - GROUND, '#7a5a40'); rect(g, 0, GROUND, WORLD_W, 5, '#86a860'); rect(g, 0, GROUND + 5, WORLD_W, 1, '#5e7a44');
  for (let x = 7; x < WORLD_W; x += 23) rect(g, x, GROUND + 14 + (x % 3) * 6, 3, 2, '#654834');

  // the towers' stone shells
  for (const tx of [TOWER_L, TOWER_R]) {
    const top = floorTop(TOWER_FLOORS - 1);
    rect(g, tx, top, TOWER_W, GROUND - top, '#a49c90');
    for (let y = top + 6; y < GROUND; y += 9) { rect(g, tx, y, WALL, 1, '#857d72'); rect(g, tx + TOWER_W - WALL, y, WALL, 1, '#857d72'); }
    rect(g, tx, top, 1, GROUND - top, INK); rect(g, tx + TOWER_W - 1, top, 1, GROUND - top, INK);
  }

  const barnRoom = (r: Room, top?: number) => { barnWall(g, r.x0, r.x1, r.floor, WALLS[r.kind] ?? EMPTY_WALL, top); props(g, r); };
  const barn = rooms.filter((r) => r.part === 'barn');
  /** The barn slots no room fills, as [floor, x0, x1]: bare walls. */
  const empty: [number, number, number][] = [];
  for (let f = 0; f < BARN_FLOORS; f++) for (let m = 0; m < BARN_MODS; m++) {
    const x0 = modX(m);
    if (!barn.some((r) => r.floor === f && r.x0 <= x0 && r.x1 >= x0 + MOD)) empty.push([f, x0, x0 + MOD]);
  }

  // the ground and upper floors
  for (const r of barn) if (r.floor < 2) barnRoom(r);
  for (const [f, x0, x1] of empty) if (f < 2) barnWall(g, x0, x1, f, EMPTY_WALL);
  // the roof, then the hayloft inside it (its walls run up to the rafters)
  const topRow = RIDGE_Y - 20;
  poly(g, ROOF_OUT, '#8e3b30');
  g.save(); path(g, ROOF_OUT); g.clip();
  for (const k of [5, 10]) { g.beginPath(); g.moveTo(ROOF_OUT[0], ROOF_OUT[1] + k); for (let i = 2; i < ROOF_OUT.length; i += 2) g.lineTo(ROOF_OUT[i], ROOF_OUT[i + 1] + k); g.strokeStyle = '#6e2a24'; g.lineWidth = 1; g.stroke(); }
  g.restore();
  g.save(); path(g, ROOF_IN); g.clip();
  for (const r of barn) if (r.floor === 2) barnRoom(r, topRow);
  for (const [f, x0, x1] of empty) if (f === 2) barnWall(g, x0, x1, f, EMPTY_WALL, topRow);
  g.restore();
  poly(g, [modX(0) + 88, 350, modX(0) + 134, 342, modX(0) + 132, 330, modX(0) + 86, 338], '#e8f4f8');

  // posts between the barn's rooms, and the hoist's two walls
  for (let f = 0; f < BARN_FLOORS; f++) {
    const t = f === 2 ? topRow : floorTop(f), b = floorTop(f) + WALL_H + BAND;
    const xs = new Set<number>([HOIST_X, HOIST_X + HOIST_W]);
    for (const r of barn) if (r.floor === f) { xs.add(r.x0); xs.add(r.x1); }
    for (const [ef, x0, x1] of empty) if (ef === f) { xs.add(x0); xs.add(x1); }
    if (f === 2) { g.save(); path(g, ROOF_IN); g.clip(); }
    for (const x of xs) if (x > BARN_X + 1 && x < TOWER_R - 1) post(g, x, t, b);
    if (f === 2) g.restore();
  }
  // the hoist shaft, ground to rafters, with a ledge at each floor
  g.save(); path(g, [...ROOF_IN, TOWER_R, GROUND, BARN_X, GROUND]); g.clip();
  rect(g, HOIST_X + 2, topRow, HOIST_W - 4, GROUND - topRow, '#5a4436');
  for (let x = HOIST_X + 10; x < HOIST_X + HOIST_W - 4; x += 12) rect(g, x, topRow, 1, GROUND - topRow, '#4a362a');
  for (let f = 0; f < BARN_FLOORS; f++) { const y = floorTop(f) + WALL_H + BAND; rect(g, HOIST_X + 2, y, 6, SLAB, '#6b4a34'); rect(g, HOIST_X + HOIST_W - 8, y, 6, SLAB, '#6b4a34'); }
  g.restore();
  disc(g, RIDGE_X, RIDGE_Y + 12, 10, '#8a6242'); disc(g, RIDGE_X, RIDGE_Y + 12, 3, '#4a362a', false);

  // tower rooms, the ladders through them, and the doorways into the barn
  for (const tx of [TOWER_L, TOWER_R]) {
    const part = tx === TOWER_L ? 'towerL' : 'towerR', link = LINKS.find((l) => l.name === (tx === TOWER_L ? 'ladderL' : 'ladderR'))!;
    for (let f = 0; f < TOWER_FLOORS; f++) {
      towerWall(g, tx + WALL, tx + TOWER_W - WALL, f);
      const r = rooms.find((q) => q.part === part && q.floor === f);
      if (r) props(g, r);
      if (f >= link.lo && f <= link.hi) ladder(g, link.x, f);
    }
    for (const f of [0, 1]) {
      const fl = floorTop(f) + WALL_H, dx = tx === TOWER_L ? TOWER_L + TOWER_W - WALL : TOWER_R;
      rect(g, dx, fl - 70, WALL, 70, '#3a2a26'); rect(g, dx, fl - 72, WALL, 2, INK);
    }
  }
  // the right tower's cone roof and flag; the left tower's aerie deck
  const rt = floorTop(TOWER_FLOORS - 1);
  poly(g, [TOWER_R - 8, rt + 2, TOWER_R + TOWER_W + 8, rt + 2, TOWER_R + TOWER_W / 2, 56], '#4f5f7f');
  line(g, TOWER_R + TOWER_W / 2, 56, TOWER_R + TOWER_W / 2, 30, INK); poly(g, [TOWER_R + TOWER_W / 2, 30, TOWER_R + TOWER_W / 2 + 18, 35, TOWER_R + TOWER_W / 2, 40], '#e0664a');
  const deck = rt - 8;
  box(g, 4, deck, 200, 8, '#8a6242'); rect(g, 5, deck + 1, 198, 1, '#a47a52');
  box(g, 196, deck - 16, 4, 16, '#6b4a34', false);
  for (const bx of [18, 188]) line(g, bx, deck + 8, bx < TOWER_L ? TOWER_L : TOWER_L + TOWER_W, deck + 34, '#6b4a34', 3);
  box(g, 6, deck - 18, 3, 18, '#6b4a34', false); line(g, 8, deck - 18, 8, deck - 44, INK); poly(g, [8, deck - 44, 30, deck - 38, 8, deck - 32], '#f2c14e');
  return c;
}

/** The room names, on a transparent layer the view draws over the cast. */
export function drawPlates(rooms: readonly Room[]): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = WORLD_W; c.height = WORLD_H;
  const g = c.getContext('2d')!;
  for (const r of rooms) {
    const t = floorTop(r.floor);
    // (the hayloft's left room sits under the roof's slope: its plate moves in clear of it)
    const x = r.part === 'barn' && r.floor === 2 && r.x0 === BARN_X ? r.x0 + 44 : r.x0 + (r.part === 'barn' ? 5 : 3);
    plate(g, ROOM_INFO[r.kind].name, x, r.floor === 2 && r.part === 'barn' ? t + 20 : t + 3);
  }
  plate(g, 'HOIST', HOIST_X + 7, floorTop(0) + 3);
  plate(g, 'AERIE', 10, floorTop(TOWER_FLOORS - 1) + 4);
  return c;
}

/** The hoist's car with its ropes up to the pulley, its floor at y (it rides with whoever is on it). */
export function drawHoistCar(g: CanvasRenderingContext2D, y: number): void {
  const x = HOIST_X, top = Math.round(y) - 50;
  line(g, RIDGE_X - 9.5, RIDGE_Y + 12, RIDGE_X - 9.5, top, '#d8c49a'); line(g, RIDGE_X + 9.5, RIDGE_Y + 12, RIDGE_X + 9.5, top, '#d8c49a');
  box(g, x + 4, top, HOIST_W - 8, 4, '#8a6242', false);
  line(g, x + 8, top + 4, x + 8, top + 44, '#8a6242', 2); line(g, x + HOIST_W - 8, top + 4, x + HOIST_W - 8, top + 44, '#8a6242', 2);
  box(g, x + 4, top + 44, HOIST_W - 8, 8, '#a47a52');
}
