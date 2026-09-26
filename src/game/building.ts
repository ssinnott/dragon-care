// The base's building, drawn once (docs/BASE_DESIGN.md 2): the ground, the two stone towers with their window slits,
// every room with its props, the gambrel roof over the hayloft, the Dragon Lift's shaft from the ground floor up
// through the roof to its headframe over the Aerie, the keepers' centre ladder bay, and the Aerie deck on its gantry
// over the roof -- transparent above the ground and around its walls, where the view draws the sky (sky.ts: in screen
// space, behind it, so the day turns without redrawing this). Greybox:
// blocks in the house style (a 1 px #1a1018 outline, flat cel bands lit from the top-left, no gradients) standing in
// for the room art to come. Every surface anyone stands on -- a room's band, a landing, a tower's floor, the deck, the
// lift car's deck -- is a FLOORS colour (surfaces.ts; gated by tools/palette-check.ts, gates i and Ki). A room's
// identity is its wall colour and its props; a slot no room fills is bare (an empty wall, no props, no name, #11). The
// names go on a separate layer the view draws over the building and under the lift's car and the cast (so a name never
// covers a face); the car is drawn in the world layer (drawLiftCar). Night (7) is the sky and the lights alone: the lit
// window slits, the dorm lamps' and the hearth's light on their walls, the skylight's night (drawLights, drawn over the
// building and under the plates); nothing on a floor, a wall or a dragon changes colour, and every colour a dragon is
// seen against -- the walls, the props behind the slots, the light on the walls -- is a surfaces.ts backdrop, gate (w).
import { makeTones } from '../lib/art/shading.ts';
import { drawText, measureText } from '../lib/engine/text.ts';
import {
  WORLD_W, WORLD_H, GROUND, PITCH, MOD, TOWER_W, WALL, WALL_H, BAND, SLAB, TOWER_L, TOWER_R, BARN_X, RIDGE_X, RIDGE_Y,
  KNEE_DX, KNEE_Y, BARN_FLOORS, TOWER_FLOORS, BARN_MODS, LIFT_MOD, LIFT_X0, LIFT_X1, LIFT_STOPS, CAR_X0, CAR_X1, LADDER_BAY_X0,
  LADDER_BAY_X1, AERIE_F, DECK_X0, DECK_X1, HEAD_Y, PULLEY_Y, KEEPER_NET, NESTS, NEST_RX, NEST_RY, NEST_STRANDS, floorTop, feetY, modX, nestX, nestBase, platesOf,
} from './layout.ts';
import type { Room, Link } from './layout.ts';
import { FLOORS, INK, EMPTY_WALL, LIFT_WALL, STONE, STRAW_SEAM, WALLS, PROPS, NEST, LIGHTS, LAMP_RINGS, HEARTH_RING, skyBands } from './surfaces.ts';
import type { ClockRead } from './clock.ts';
import { lightsOf } from './sky.ts';

const STRAW = FLOORS.straw;
/** Timber (posts, frames, rails, the trusses), and its dark tone (slabs, the car's underframe, the guide rails). */
const TIMBER = '#8a6242', TIMBER_DK = '#6b4a34';
/** The lift car's side rails (px tall), its cables' colour and x (one over each rail), and the headframe's pulleys. */
const RAIL_H = 40, CABLE = '#5a4a40', CABLE_X = [CAR_X0 + 1, CAR_X1 - 2] as const, PULLEY_R = 4, PULLEY_X = [CAR_X0 + 5, CAR_X1 - 6] as const;

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
/** A timber member w px thick with a 1 px ink outline, end to end (a strut, a brace, a truss diagonal). */
function member(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, w: number, c = TIMBER): void {
  g.lineCap = 'butt';
  line(g, x0, y0, x1, y1, INK, w + 2); line(g, x0, y0, x1, y1, c, w);
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
  rect(g, x0, y + 1, x1 - x0, SLAB - 2, TIMBER_DK);
  rect(g, x0, y + 1, x1 - x0, 1, '#86603f');
  for (let x = x0 + 20; x < x1; x += 40) rect(g, x, y + 1, 1, SLAB - 2, '#4e3424');
}
/** A floor someone stands on: a straw band with its seam along the top, over its slab (y: the band's top). */
function floor(g: CanvasRenderingContext2D, x0: number, x1: number, y: number): void {
  rect(g, x0, y, x1 - x0, BAND, STRAW);
  rect(g, x0, y, x1 - x0, 1, STRAW_SEAM);
  slab(g, x0, x1, y + BAND);
}
function post(g: CanvasRenderingContext2D, x: number, y0: number, y1: number): void { rect(g, x - 2, y0, 4, y1 - y0, INK); rect(g, x - 1, y0, 2, y1 - y0, TIMBER); }

/** The gambrel's inside: the hayloft's ceiling line, eave to ridge to eave. */
const ROOF_IN: readonly number[] = [BARN_X + 4, GROUND - 2 * PITCH, BARN_X + KNEE_DX, KNEE_Y, RIDGE_X, RIDGE_Y, TOWER_R - KNEE_DX, KNEE_Y, TOWER_R - 4, GROUND - 2 * PITCH];
const ROOF_OUT: readonly number[] = [BARN_X - 4, GROUND - 2 * PITCH + 6, BARN_X + KNEE_DX - 12, KNEE_Y - 13, RIDGE_X, RIDGE_Y - 14, TOWER_R - KNEE_DX + 12, KNEE_Y - 13, TOWER_R + 4, GROUND - 2 * PITCH + 6];
/** The roof's outer line at x (y), over the barn's upper slopes: where the gantry's trestles and the lift's housing meet it. */
function roofAt(x: number): number {
  const [x0, y0, x1, y1] = x <= RIDGE_X ? [ROOF_OUT[2], ROOF_OUT[3], ROOF_OUT[4], ROOF_OUT[5]] : [ROOF_OUT[4], ROOF_OUT[5], ROOF_OUT[6], ROOF_OUT[7]];
  return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
}

/** A barn slot's back wall (planks), straw band and slab, from `top` down (the hayloft's walls run up into the roof). */
function barnWall(g: CanvasRenderingContext2D, x0: number, x1: number, f: number, wall: string, top = floorTop(f)): void {
  const t = floorTop(f), w = x1 - x0, tn = makeTones(wall);
  rect(g, x0, top, w, t + WALL_H - top, wall);
  for (let x = x0 + 12; x < x1 - 4; x += 16) rect(g, x, top, 1, t + WALL_H - top, tn.sh);
  rect(g, x0, t + WALL_H - 3, w, 3, tn.sh);
  floor(g, x0, x1, t + WALL_H);
}

/**
 * The Dragon Lift's shaft wall from y0 down to y1: the wall, the car's two guide rails, and a timber cross-brace in
 * each floor's height of it (floor boxes, ceiling to band), so the shaft reads the same in the barn and above the roof.
 */
function shaftWall(g: CanvasRenderingContext2D, y0: number, y1: number): void {
  const tn = makeTones(LIFT_WALL), w = LIFT_X1 - LIFT_X0;
  g.save(); g.beginPath(); g.rect(LIFT_X0, y0, w, y1 - y0); g.clip();
  rect(g, LIFT_X0, y0, w, y1 - y0, LIFT_WALL);
  for (let f = 0; f <= AERIE_F; f++) {
    const t = floorTop(f), b = t + WALL_H - 4;
    if (b < y0 || t > y1) continue;
    member(g, LIFT_X0 + 12, t + 6, LIFT_X1 - 12, b, 2, tn.sh);
    member(g, LIFT_X1 - 12, t + 6, LIFT_X0 + 12, b, 2, tn.sh);
    rect(g, LIFT_X0, t + 2, w, 3, INK); rect(g, LIFT_X0, t + 3, w, 1, TIMBER);
  }
  for (const x of [LIFT_X0 + 10, LIFT_X1 - 12]) rect(g, x, y0, 2, y1 - y0, TIMBER_DK);
  g.restore();
}
/** The lift bay on barn floor f: its shaft wall from `top` (the hayloft's runs up into the roof), and the landing across it. */
function liftBay(g: CanvasRenderingContext2D, f: number, top = floorTop(f)): void {
  const t = floorTop(f);
  shaftWall(g, top, t + WALL_H);
  rect(g, LIFT_X0, t + WALL_H - 3, LIFT_X1 - LIFT_X0, 3, makeTones(LIFT_WALL).sh);
  floor(g, LIFT_X0, LIFT_X1, t + WALL_H);
}

/** A tower room's stone wall, its floor of straw boards, and its slab. */
function towerWall(g: CanvasRenderingContext2D, x0: number, x1: number, f: number): void {
  const t = floorTop(f);
  rect(g, x0, t, x1 - x0, WALL_H, STONE);
  for (let y = t + 8, r = 0; y < t + WALL_H; y += 12, r++) {
    rect(g, x0, y, x1 - x0, 1, '#aaa396');
    for (let c = x0 + (r % 2 ? 6 : 14); c < x1; c += 20) rect(g, c, y, 1, Math.min(11, t + WALL_H - y), '#aaa396');
  }
  floor(g, x0, x1, t + WALL_H);
  for (let c = x0 + 7; c < x1; c += 14) rect(g, c, t + WALL_H + 1, 1, BAND - 1, STRAW_SEAM);
}

// ---------- props (placeholder blocks) ----------

function shelf(g: CanvasRenderingContext2D, x: number, y: number, w: number, items: readonly string[]): void {
  box(g, x, y, w, 4, TIMBER, false);
  items.forEach((c, i) => box(g, x + 3 + i * 11, y - 9, 8, 9, c));
}
function bunk(g: CanvasRenderingContext2D, x: number, fl: number, a: string, b: string): void {
  box(g, x, fl - 62, 4, 62, '#7a5838', false); box(g, x + 56, fl - 62, 4, 62, '#7a5838', false);
  for (const [dy, c] of [[16, a], [50, b]] as const) { box(g, x + 2, fl - dy, 56, 8, TIMBER); box(g, x + 6, fl - dy - 6, 40, 7, c); box(g, x + 44, fl - dy - 6, 12, 7, '#f0ead8'); }
}
/**
 * A nest on the band's back edge, its top well above the band: a heap of straw (surfaces.ts NEST; layout.ts NEST_RX,
 * NEST_RY, nestBase), inked round, its strands on its flanks; an egg lies nestled in the front of it (eggs.ts, drawn by
 * the view over the building), against the straw alone -- so the egg gate (tools/palette-check.ts) is what it is seen
 * against, and the strands keep clear of it.
 */
function nest(g: CanvasRenderingContext2D, cx: number, base: number): void {
  const rx = NEST_RX, ry = NEST_RY;
  g.fillStyle = INK; g.beginPath(); g.ellipse(cx, base, rx + 1, ry + 1, 0, Math.PI, Math.PI * 2); g.closePath(); g.fill();
  g.fillStyle = NEST; g.beginPath(); g.ellipse(cx, base, rx, ry, 0, Math.PI, Math.PI * 2); g.closePath(); g.fill();
  // (the straw's strands, 2 px, on the heap's flanks: an egg's place, its middle, is left plain)
  for (const [dx, dy] of NEST_STRANDS) rect(g, cx + dx, base - dy, 4, 2, '#c8b68c');
}
/** A low sleeping pallet against the dorm's back wall, behind the band (its top at most t + WALL_H - 2), the pillow at `head`'s end. */
function pallet(g: CanvasRenderingContext2D, cx: number, t: number, head: 1 | -1): void {
  box(g, cx - 62, t + WALL_H - 8, 124, 8, PROPS.pallet);
  box(g, cx - 58, t + WALL_H - 14, 116, 7, PROPS.mattress);
  box(g, cx + head * 44 - 11, t + WALL_H - 17, 22, 6, '#f0ead8');
}

/** A lamp hanging in the dorm: where its box's top-left is (x - 4, y), and where its cord hangs from. */
interface Lamp { x: number; y: number; cord: number }
/** The dorm's two lamps, hanging from the rafters in the hayloft (under the room's plate, which hangs at t + 20 there). */
function lampsOf(r: Room): Lamp[] {
  const t = floorTop(r.floor), y = t + (r.floor === 2 ? 32 : 16), cord = r.floor === 2 ? RIDGE_Y - 20 : t;
  return [r.x0 + 40, r.x0 + 280].map((x) => ({ x, y, cord }));
}
/** A lamp on its cord (the cord a flat 1 px ink column). */
function lamp(g: CanvasRenderingContext2D, l: Lamp): void { rect(g, l.x, l.cord, 1, l.y - l.cord, INK); box(g, l.x - 4, l.y, 8, 10, LIGHTS.lamp); }
/** A tower window slit's glass (6 x 10, inked round), one a floor in each tower's outer wall. */
const SLIT_W = 6, SLIT_H = 10;
const SLITS: readonly { x: number; y: number }[] = [TOWER_L + 1, TOWER_R + TOWER_W - 1 - SLIT_W].flatMap((x) =>
  Array.from({ length: TOWER_FLOORS }, (_, f) => ({ x, y: floorTop(f) + 30 })));
/**
 * A window in the barn's back wall: its pane (world px), cut out of the building so the sky (sky.ts) shows through it
 * -- by day the day's, at night the night's: the barn's own windows on the time of day, seen from the start frame. Two
 * flank the centre ladder on each floor of the ladder bay, and one sits in each bare hayloft module; never in a named
 * room, whose wall and props are its identity (#11), and each high on its wall, over a dragon's back.
 */
interface Pane { x: number; y: number; w: number; h: number }
function panes(bare: readonly (readonly [number, number, number])[]): Pane[] {
  const out: Pane[] = [];
  for (let f = 0; f < BARN_FLOORS; f++) {
    const t = floorTop(f);
    out.push({ x: LADDER_BAY_X0 + 7, y: t + 16, w: 14, h: 24 }, { x: LADDER_BAY_X1 - 21, y: t + 16, w: 14, h: 24 });
  }
  for (const [f, x0, x1] of bare) if (f === 2) out.push({ x: (x0 + x1) / 2 - 14, y: floorTop(f) + 18, w: 28, h: 22 });
  return out;
}
/** A window: its timber frame (inked) and sill, the pane cut out, a mullion down its middle (and a transom across a wide one). */
function windowIn(g: CanvasRenderingContext2D, p: Pane): void {
  rect(g, p.x - 3, p.y - 3, p.w + 6, p.h + 6, INK);
  rect(g, p.x - 2, p.y - 2, p.w + 4, p.h + 4, TIMBER);
  rect(g, p.x - 2, p.y - 2, p.w + 4, 1, '#a47a52');
  g.clearRect(p.x, p.y, p.w, p.h);
  rect(g, p.x + p.w / 2 - 1, p.y, 2, p.h, TIMBER);
  if (p.w > 20) rect(g, p.x, p.y + p.h / 2 - 1, p.w, 2, TIMBER);
  rect(g, p.x - 4, p.y + p.h + 2, p.w + 8, 3, INK); rect(g, p.x - 3, p.y + p.h + 3, p.w + 6, 1, TIMBER);
}

/** The hayloft's skylight, on the roof's right slope over the lamp dorm. */
const SKYLIGHT: readonly number[] = [930, 318, 884, 310, 886, 298, 932, 306];

/** Each room kind's props, over its wall. */
function props(g: CanvasRenderingContext2D, r: Room): void {
  const t = floorTop(r.floor), fl = t + WALL_H + 4, x = r.x0;
  switch (r.kind) {
    case 'kitchen': {
      // the hearth (the kitchen's post: keepers take the bowls from here) and a shelf of crocks
      const hx = x + 6, hf = t + WALL_H;
      box(g, hx, hf - 62, 60, 62, PROPS.hearth);
      for (let row = 0; row < 5; row++) for (let c = 0; c < 4; c++) rect(g, hx + 2 + c * 15 + (row % 2) * 7, hf - 60 + row * 12, 1, 11, '#7c746c');
      rect(g, hx + 12, hf - 34, 36, 34, INK); rect(g, hx + 13, hf - 33, 34, 33, PROPS.firebox);
      poly(g, [hx + 18, hf, hx + 24, hf - 18, hx + 30, hf - 8, hx + 34, hf - 24, hx + 42, hf], '#f39a2e');
      poly(g, [hx + 24, hf, hx + 28, hf - 10, hx + 34, hf - 14, hx + 38, hf], '#ffd86a', false);
      box(g, hx + 18, hf - 22, 24, 14, '#4a4450');
      box(g, hx + 4, hf - 88, 52, 26, '#8c847a');
      shelf(g, x + 150, t + 34, 60, ['#d08a5a', '#e8d8b0', '#8a9a6a', '#c86a4a', '#e8d8b0']);
      break;
    }
    case 'hatchery':
      // the heat lamp on its cord, and the three nests the eggs lie in (layout.ts nestX)
      rect(g, x + 40, t, 1, 30, INK); poly(g, [x + 30, t + 30, x + 50, t + 30, x + 46, t + 38, x + 34, t + 38], '#f2c14e');
      for (let i = 0; i < NESTS; i++) nest(g, nestX(r, i), nestBase(r.floor));
      break;
    case 'bath': {
      for (let y = t + 18; y < t + WALL_H; y += 10) rect(g, x, y, r.x1 - x, 1, '#a0adb6');
      // the tub (the bathhouse's post: the buckets are filled here), standing on the band's back edge like the hearth,
      // so a dragon in the slot in front of it has straw under its paws, not the tub
      const bx = x + 150, w = 150, bf = t + WALL_H;
      box(g, bx, bf - 34, w, 34, PROPS.tub);
      for (let i = 1; i < 4; i++) rect(g, bx + 1, bf - 34 + i * 8, w - 2, 1, '#6e4a30');
      rect(g, bx + 3, bf - 38, w - 6, 5, INK); rect(g, bx + 4, bf - 37, w - 8, 3, '#bfe3e0');
      for (const [cx, cy, cr] of [[bx + 20, bf - 44, 3], [bx + 36, bf - 50, 2], [bx + w - 30, bf - 46, 3], [bx + w - 18, bf - 55, 2]]) disc(g, cx, cy, cr, '#dff3f1');
      break;
    }
    case 'romp': {
      // bunting, and the play wheel that turns the mill (the romp room's post: the balls are kept in the box by it)
      const by = t + 8;
      rect(g, x + 110, by, r.x1 - 10 - (x + 110), 1, '#6e4a30');
      const cs = ['#e0664a', '#f2c14e', '#5aa0c8', '#7bbf6a'];
      for (let bx = x + 116, i = 0; bx < r.x1 - 18; bx += 16, i++) poly(g, [bx, by, bx + 10, by, bx + 5, by + 8], cs[i % 4]);
      const cx = x + 50, cy = t + 46, R = 36;
      disc(g, cx, cy, R, '#a47a52'); disc(g, cx, cy, R - 5, WALLS.romp!, false);
      for (let a = 0; a < 8; a++) { const th = a * Math.PI / 4; line(g, cx, cy, cx + Math.cos(th) * (R - 4), cy + Math.sin(th) * (R - 4), '#6e4a30', 2); }
      disc(g, cx, cy, 4, '#6e4a30');
      box(g, cx - 3, cy, 6, feetY(r.floor) - cy - 4, TIMBER, false);
      box(g, x + 96, fl - 14, 22, 14, '#a47a52'); disc(g, x + 103, fl - 17, 4, '#e0664a'); disc(g, x + 112, fl - 16, 3, '#5aa0c8');
      break;
    }
    case 'groom':
      // the brush rack
      box(g, x + 100, t + 22, 44, 5, TIMBER, false);
      for (let i = 0; i < 3; i++) { box(g, x + 104 + i * 13, t + 27, 6, 12, '#a47a52'); box(g, x + 103 + i * 13, t + 39, 8, 5, '#6b4a34'); }
      break;
    case 'dorm':
      // a low pallet behind each module slot (the pillow at the head's end), the middle post, and the two lamps
      // hanging from the rafters (under the room's plate, which hangs at t + 20 in the hayloft)
      for (const s of r.slots) if (!s.baby) pallet(g, s.x, t, s.facing);
      box(g, x + 157, t + 50, 6, WALL_H - 50, TIMBER, false);
      // (each cord a flat 1 px ink column)
      for (const l of lampsOf(r)) lamp(g, l);
      break;
    case 'tack':
      box(g, x + 6, t + 40, 40, 4, TIMBER, false);
      for (const sx of [x + 8, x + 28]) poly(g, [sx, t + 40, sx + 4, t + 30, sx + 14, t + 30, sx + 18, t + 40], '#9a5a3a');
      break;
    case 'bunks': bunk(g, x + (r.part === 'towerL' ? 4 : 28), fl, r.floor % 2 ? '#c86a4a' : '#7bbf6a', r.floor % 2 ? '#5a8ab0' : '#e0a040'); break;
    case 'maproom':
      box(g, x + 6, t + 20, 60, 36, '#e8d8a8');
      line(g, x + 12, t + 30, x + 32, t + 44, '#8a6a4a'); line(g, x + 32, t + 44, x + 54, t + 28, '#8a6a4a');
      for (const [px, py, c] of [[x + 16, t + 32, '#d04a3a'], [x + 36, t + 42, '#3a7ad0'], [x + 52, t + 30, '#d0a03a']] as const) disc(g, px, py, 2, c);
      break;
  }
}

/**
 * A ladder the length of its link: from a grab-rail stub over its top stop's floor down to its lowest floor's band,
 * through a hatch in every slab it climbs through.
 */
function ladder(g: CanvasRenderingContext2D, l: Link): void {
  const lo = l.stops[0], hi = l.stops[l.stops.length - 1], x = l.x - 6;
  const y0 = floorTop(hi) + WALL_H - 22, y1 = floorTop(lo) + WALL_H + BAND;
  for (let f = lo + 1; f <= hi; f++) {
    const y = floorTop(f) + WALL_H + BAND;
    rect(g, x - 4, y, 20, SLAB, INK); rect(g, x - 3, y + 1, 18, SLAB - 2, '#3a2a26');
  }
  rect(g, x, y0, 2, y1 - y0, '#7a5838'); rect(g, x + 10, y0, 2, y1 - y0, '#7a5838');
  for (let y = y0 + 4; y < y1; y += 8) rect(g, x, y, 12, 2, '#7a5838');
}

// ---------- the whole building ----------

/** The building, drawn once onto its own WORLD_W x WORLD_H canvas. */
export function drawBuilding(rooms: readonly Room[]): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = WORLD_W; c.height = WORLD_H;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;

  // the ground (the sky, the far hills and the clouds are the view's: sky.ts)
  rect(g, 0, GROUND, WORLD_W, WORLD_H - GROUND, '#7a5a40'); rect(g, 0, GROUND, WORLD_W, 5, '#86a860'); rect(g, 0, GROUND + 5, WORLD_W, 1, '#5e7a44');
  for (let x = 7; x < WORLD_W; x += 23) rect(g, x, GROUND + 14 + (x % 3) * 6, 3, 2, '#654834');

  // the towers' stone shells
  for (const tx of [TOWER_L, TOWER_R]) {
    const top = floorTop(TOWER_FLOORS - 1);
    rect(g, tx, top, TOWER_W, GROUND - top, '#a49c90');
    for (let y = top + 6; y < GROUND; y += 9) { rect(g, tx, y, WALL, 1, '#857d72'); rect(g, tx + TOWER_W - WALL, y, WALL, 1, '#857d72'); }
    rect(g, tx, top, 1, GROUND - top, INK); rect(g, tx + TOWER_W - 1, top, 1, GROUND - top, INK);
  }
  // their window slits, one a floor in each outer wall: day glass (drawLights lights them at dusk and night)
  for (const s of SLITS) { rect(g, s.x - 1, s.y - 1, SLIT_W + 2, SLIT_H + 2, INK); rect(g, s.x, s.y, SLIT_W, SLIT_H, LIGHTS.glass); }

  const barnRoom = (r: Room, top?: number) => { barnWall(g, r.x0, r.x1, r.floor, WALLS[r.kind] ?? EMPTY_WALL, top); props(g, r); };
  const barn = rooms.filter((r) => r.part === 'barn');
  /** The barn slots no room fills and the lift doesn't take, as [floor, x0, x1]: bare walls (no props, no name). */
  const empty: [number, number, number][] = [];
  for (let f = 0; f < BARN_FLOORS; f++) for (let m = 0; m < BARN_MODS; m++) {
    const x0 = modX(m);
    if (m !== LIFT_MOD && !barn.some((r) => r.floor === f && r.x0 <= x0 && r.x1 >= x0 + MOD)) empty.push([f, x0, x0 + MOD]);
  }

  // the ground and upper floors: the rooms, the bare slots, the lift bay and the ladder bay
  for (const r of barn) if (r.floor < 2) barnRoom(r);
  for (const [f, x0, x1] of empty) if (f < 2) barnWall(g, x0, x1, f, EMPTY_WALL);
  for (const f of [0, 1]) { liftBay(g, f); barnWall(g, LADDER_BAY_X0, LADDER_BAY_X1, f, EMPTY_WALL); }
  const windows = panes(empty);
  for (const p of windows) if (p.y > floorTop(2) + WALL_H) windowIn(g, p);
  // the roof; the lift's shaft up through it to the Aerie deck (a housing, the shaft wall between two posts); then the
  // hayloft inside the roof (its walls run up to the rafters)
  const topRow = RIDGE_Y - 20;
  poly(g, ROOF_OUT, '#8e3b30');
  g.save(); path(g, ROOF_OUT); g.clip();
  for (const k of [5, 10]) { g.beginPath(); g.moveTo(ROOF_OUT[0], ROOF_OUT[1] + k); for (let i = 2; i < ROOF_OUT.length; i += 2) g.lineTo(ROOF_OUT[i], ROOF_OUT[i + 1] + k); g.strokeStyle = '#6e2a24'; g.lineWidth = 1; g.stroke(); }
  g.restore();
  const deckBottom = feetY(AERIE_F) - 8 + BAND + SLAB, housingFoot = Math.ceil(roofAt(LIFT_X0)) + 24;
  shaftWall(g, deckBottom, housingFoot);
  for (const x of [LIFT_X0, LIFT_X1]) post(g, x, deckBottom, housingFoot);
  g.save(); path(g, ROOF_IN); g.clip();
  for (const r of barn) if (r.floor === 2) barnRoom(r, topRow);
  for (const [f, x0, x1] of empty) if (f === 2) barnWall(g, x0, x1, f, EMPTY_WALL, topRow);
  liftBay(g, 2, topRow);
  barnWall(g, LADDER_BAY_X0, LADDER_BAY_X1, 2, EMPTY_WALL, topRow);
  for (const p of windows) if (p.y < floorTop(2) + WALL_H) windowIn(g, p);
  g.restore();
  // the hayloft's skylight, on the right slope over the lamp dorm
  poly(g, SKYLIGHT, '#e8f4f8');

  // posts between the barn's rooms, the lift bay's two walls and the ladder bay's
  for (let f = 0; f < BARN_FLOORS; f++) {
    const t = f === 2 ? topRow : floorTop(f), b = floorTop(f) + WALL_H + BAND;
    const xs = new Set<number>([LIFT_X0, LIFT_X1, LADDER_BAY_X1]);
    for (const r of barn) if (r.floor === f) { xs.add(r.x0); xs.add(r.x1); }
    for (const [ef, x0, x1] of empty) if (ef === f) { xs.add(x0); xs.add(x1); }
    if (f === 2) { g.save(); path(g, ROOF_IN); g.clip(); }
    for (const x of xs) if (x > BARN_X + 1 && x < TOWER_R - 1) post(g, x, t, b);
    if (f === 2) g.restore();
  }

  // tower rooms (the rest of each tower's floors bare stone), and the doorways into the barn
  for (const tx of [TOWER_L, TOWER_R]) {
    const part = tx === TOWER_L ? 'towerL' : 'towerR';
    for (let f = 0; f < TOWER_FLOORS; f++) {
      towerWall(g, tx + WALL, tx + TOWER_W - WALL, f);
      const r = rooms.find((q) => q.part === part && q.floor === f);
      if (r) props(g, r);
    }
    for (const f of [0, 1]) {
      const fl = floorTop(f) + WALL_H, dx = tx === TOWER_L ? TOWER_L + TOWER_W - WALL : TOWER_R;
      rect(g, dx, fl - 70, WALL, 70, '#3a2a26'); rect(g, dx, fl - 72, WALL, 2, INK);
    }
  }
  // the right tower's cone roof and flag
  const rt = floorTop(TOWER_FLOORS - 1);
  poly(g, [TOWER_R - 8, rt + 2, TOWER_R + TOWER_W + 8, rt + 2, TOWER_R + TOWER_W / 2, 56], '#4f5f7f');
  rect(g, TOWER_R + TOWER_W / 2, 30, 1, 26, INK); poly(g, [TOWER_R + TOWER_W / 2, 30, TOWER_R + TOWER_W / 2 + 18, 35, TOWER_R + TOWER_W / 2, 40], '#e0664a');

  // the Aerie (floor 5): one straw deck from the flag at its west end over the left tower, a gantry on trestles over
  // the barn roof, and the lift head
  const deck = feetY(AERIE_F) - 8, gx0 = BARN_X, gx1 = LIFT_X0;
  // (under it: a strut to the tower's west wall, a knee brace to its east wall, and the gantry's two trestles, each a
  // pair of diagonals down to one foot on the roof)
  member(g, DECK_X0 + 14, deckBottom - 1, TOWER_L, deckBottom + 34, 3);
  member(g, gx0 + 34, deckBottom - 1, gx0, deckBottom + 40, 3);
  for (const fx of [288, 416]) {
    const fy = roofAt(fx) + 2;
    member(g, fx - 34, deckBottom - 1, fx, fy, 3); member(g, fx + 34, deckBottom - 1, fx, fy, 3);
    const ty = deckBottom + (fy - deckBottom) * 0.4, tw = 34 * 0.6 - 2;
    member(g, fx - tw, ty, fx + tw, ty, 2);
    box(g, fx - 6, fy - 3, 12, 5, TIMBER_DK, false);
  }
  // (the gantry's railing, along its back edge)
  for (let i = 0; i <= 8; i++) { const x = gx0 + 4 + i * (gx1 - gx0 - 8) / 8; rect(g, x - 2, deck - 18, 4, 18, INK); rect(g, x - 1, deck - 17, 2, 17, TIMBER); }
  rect(g, gx0, deck - 20, gx1 - gx0, 4, INK); rect(g, gx0 + 1, deck - 19, gx1 - gx0 - 2, 2, TIMBER);
  rect(g, DECK_X0 - 1, deck - 1, DECK_X1 - DECK_X0 + 2, BAND + SLAB + 1, INK);
  floor(g, DECK_X0, DECK_X1, deck);
  // (the flag, at the deck's west end)
  box(g, DECK_X0 + 1, deck - 40, 3, 40, TIMBER_DK, false); poly(g, [DECK_X0 + 3, deck - 40, DECK_X0 + 25, deck - 34, DECK_X0 + 3, deck - 28], '#f2c14e');
  // the lift's headframe over its head: two legs on the housing's posts, the beam a room's height over the deck, and
  // a pulley over each of the car's rails
  for (const x of [LIFT_X0, LIFT_X1]) { rect(g, x - 3, HEAD_Y, 6, deck - HEAD_Y, INK); rect(g, x - 2, HEAD_Y, 4, deck - HEAD_Y, TIMBER); rect(g, x - 2, HEAD_Y, 1, deck - HEAD_Y, '#a47a52'); }
  box(g, LIFT_X0 - 8, HEAD_Y - 8, LIFT_X1 - LIFT_X0 + 16, 9, TIMBER);
  for (const px of PULLEY_X) { disc(g, px, PULLEY_Y, PULLEY_R, '#8c847a'); disc(g, px, PULLEY_Y, 1, INK, false); }

  // the ladders: up each tower (the left one on to the Aerie) and the centre ladder bay's through the barn
  for (const l of KEEPER_NET.links) ladder(g, l);
  return c;
}

/**
 * The room names (layout.ts platesOf: one per named room, and the lift's and the Aerie's), on a transparent layer the
 * view draws over the building and under the lift's car and the cast: a name is on the wall, so whoever passes in
 * front of it covers it for a moment, and it never covers a face.
 */
export function drawPlates(rooms: readonly Room[]): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = WORLD_W; c.height = WORLD_H;
  const g = c.getContext('2d')!;
  for (const p of platesOf(rooms)) plate(g, p.text, p.x, p.y);
  return c;
}

/**
 * The Dragon Lift's car, its rider's feet at y (a room's feet: the deck's straw band tops at y - 8), drawn in the world
 * layer after the building and before the cast: an inked straw deck across x 492-644 on a timber underframe, a 40 px
 * side rail at each end, and a cable from each rail up to its pulley on the headframe.
 */
export function drawLiftCar(g: CanvasRenderingContext2D, y: number): void {
  const top = Math.round(y) - 8, w = CAR_X1 - CAR_X0, railTop = top - RAIL_H;
  // (the cables pass through each landing over the car, unseen: never drawn over a floor)
  let y1 = railTop;
  for (const f of LIFT_STOPS) {
    const fb = floorTop(f) + WALL_H - 1, fe = fb + 1 + BAND + SLAB;
    if (fe > railTop) continue;
    for (const x of CABLE_X) rect(g, x, fe, 1, y1 - fe, CABLE);
    y1 = fb;
  }
  for (const x of CABLE_X) rect(g, x, PULLEY_Y, 1, y1 - PULLEY_Y, CABLE);
  for (const [x, dx] of [[CAR_X0, 1], [CAR_X1 - 4, -1]] as const) {
    // a side rail, capped, with a knee brace in to the deck
    member(g, x + 2 + dx, top - 14, x + 2 + dx * 12, top - 1, 2);
    rect(g, x, railTop, 4, RAIL_H, INK); rect(g, x + 1, railTop + 1, 2, RAIL_H - 1, TIMBER);
    box(g, x - 1, railTop - 2, 6, 4, TIMBER_DK, false);
  }
  rect(g, CAR_X0, top - 1, w, BAND + SLAB + 1, INK);
  rect(g, CAR_X0 + 1, top, w - 2, BAND, STRAW); rect(g, CAR_X0 + 1, top, w - 2, 1, STRAW_SEAM);
  rect(g, CAR_X0 + 1, top + BAND + 1, w - 2, SLAB - 2, TIMBER_DK); rect(g, CAR_X0 + 1, top + BAND + 1, w - 2, 1, '#86603f');
}

/**
 * The lights (docs/BASE_DESIGN.md 7), drawn in the world layer over the building and under the plates, the lift's car
 * and the cast (never over a dragon: G8), in step with the sky (sky.ts lightsOf: the sky turns into a phase over its
 * first hour, and the lights with it, never on the phase's first step). As the dusk's sky turns, and until the dawn's
 * has, the towers' window slits are lit and each dorm lamp throws its stepped rings on its wall (r 10, then r 16 too,
 * the lamp's colour mixed into the wall's at a half and a quarter: flat), clipped to the wall above the band, never on
 * it; while the stars are out the hearth throws one flat ring on the kitchen wall round it, and the hayloft's skylight
 * shows the sky's top band and a star. By day, nothing.
 */
export function drawLights(g: CanvasRenderingContext2D, rooms: readonly Room[], c: ClockRead): void {
  const lit = lightsOf(c);
  if (lit.slits) for (const s of SLITS) rect(g, s.x, s.y, SLIT_W, SLIT_H, LIGHTS.slit);
  for (const r of rooms) {
    const t = floorTop(r.floor), band = t + WALL_H;
    if (r.kind === 'dorm' && lit.rings > 0) {
      g.save();
      g.beginPath(); g.rect(r.x0 + 3, t, r.x1 - r.x0 - 6, WALL_H); g.clip();
      if (r.floor === 2) { path(g, ROOF_IN); g.clip(); }
      for (const l of lampsOf(r)) {
        const cy = l.y + 5;
        if (lit.rings > 1) disc(g, l.x, cy, 16, LAMP_RINGS[1], false);
        disc(g, l.x, cy, 10, LAMP_RINGS[0], false);
        lamp(g, l);
      }
      g.restore();
    } else if (r.kind === 'kitchen' && lit.hearth) {
      // (round the hearth: clipped to the wall above its shadow line, the hearth and its hood cut out, so it lies behind them)
      const hx = r.x0 + 6;
      g.save();
      g.beginPath(); g.rect(r.x0 + 3, t, r.x1 - r.x0 - 6, WALL_H - 3); g.rect(hx, band - 62, 60, 62); g.rect(hx + 4, band - 88, 52, 26); g.clip('evenodd');
      disc(g, hx + 30, band - 17, 60, HEARTH_RING, false);
      g.restore();
    }
  }
  if (lit.skylight) { poly(g, SKYLIGHT, skyBands(c)[0]); rect(g, 905, 306, 2, 2, LIGHTS.star); }
}
