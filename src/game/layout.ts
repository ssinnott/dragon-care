// The base's building (docs/BASE_DESIGN.md 2): a barn of six 160 px modules on three floors, and a five-floor tower at
// each end, at the game's scale 1. Barn module 2 is the Dragon Lift, from the ground floor up through the roof to the
// Aerie (floor 5, a deck over the left tower and the barn roof); where the hay hoist was, between modules 2 and 3,
// is the keepers' centre ladder bay. Rooms are data placed on the grid, each with a purpose (#11), and a dragon room's
// dragons stand in fixed slots. Walking is two nets of floor spans and links: the keepers' (the ladders) and one per
// dragon stage (the lift, the spans kept a body's length clear of the walls). Geometry and data only: building.ts
// draws it, sim.ts walks it.
import type { NeedKind } from './needs.ts';
import type { Stage } from '../art/dragon/stages.ts';
import { measureText } from '../lib/engine/text.ts';

// ---------- the grid (px at scale 1) ----------

/** A barn module (one adult, or two babies), the floor pitch, the keepers' ladder bay and a tower's width (2's table). */
export const MOD = 160, PITCH = 112, LADDER_BAY_W = 64, TOWER_W = 112;
/** A room's box, top down: 88 px of wall, a 14 px straw band the feet stand in, a 10 px slab. */
export const WALL_H = 88, BAND = 14, SLAB = 10;
/** The towers' walls (the barn's two ends are the towers' inner walls). */
export const WALL = 8;
/** The world: about 2 x 2 screens, the ground at y 712. */
export const WORLD_W = 1360, WORLD_H = 760, GROUND = 712;
export const TOWER_L = 56, BARN_X = TOWER_L + TOWER_W, BARN_MODS = 6, BARN_W = BARN_MODS * MOD + LADDER_BAY_W, TOWER_R = BARN_X + BARN_W;
export const BARN_FLOORS = 3, TOWER_FLOORS = 5;
/** The keepers' centre ladder bay (where the hay hoist was), between barn modules 2 and 3, and its ladder's x. */
export const LADDER_BAY_X0 = BARN_X + 3 * MOD, LADDER_BAY_X1 = LADDER_BAY_X0 + LADDER_BAY_W, LADDER_M_X = LADDER_BAY_X0 + LADDER_BAY_W / 2;
/** The Dragon Lift: barn module 2 (x 488-648), its middle (where a rider stands), and its car's deck (152 px: the longest elder is 137). */
export const LIFT_MOD = 2, LIFT_X0 = BARN_X + LIFT_MOD * MOD, LIFT_X1 = LIFT_X0 + MOD, LIFT_CX = LIFT_X0 + MOD / 2, CAR_X0 = LIFT_X0 + 4, CAR_X1 = LIFT_X1 - 4;
/** The floors the lift stops at: the barn's three and the Aerie; floors 3 and 4 are passed through. */
export const LIFT_STOPS = [0, 1, 2, 5] as const;
/** The Aerie: walkable floor 5, one deck from x 8 to 648 (over the left tower, a gantry over the barn roof, the lift head). */
export const AERIE_F = 5, DECK_X0 = 8, DECK_X1 = LIFT_X1;
/** The gambrel roof over the hayloft (floor 2): its ridge, and the knee where the steep lower slope turns. */
export const RIDGE_X = BARN_X + BARN_W / 2, RIDGE_Y = 276, KNEE_DX = 58, KNEE_Y = 360;

/** Top of floor f's room box (floor 0 is the ground floor; floor 5 is the Aerie's, over the towers' tops). */
export function floorTop(f: number): number { return GROUND - (f + 1) * PITCH; }
/** Where feet stand on floor f: 8 px into the straw band, `d` px deeper (for depth order). */
export function feetY(f: number, d = 0): number { return floorTop(f) + WALL_H + 8 + d; }
/** Left edge of barn module i. */
export function modX(i: number): number { return BARN_X + i * MOD + (i >= 3 ? LADDER_BAY_W : 0); }
/** The lift's headframe over the Aerie: its beam's underside (a room's height over the deck: floor 5's top), and its pulleys' centre. */
export const HEAD_Y = floorTop(AERIE_F), PULLEY_Y = HEAD_Y + 4;

// ---------- rooms ----------

export type RoomKind = 'kitchen' | 'bath' | 'hatchery' | 'romp' | 'groom' | 'dorm' | 'tack' | 'bunks' | 'maproom';

export interface RoomInfo {
  name: string;
  /** Why the room exists (#11): a dragon need, or a human or other action. Never empty. */
  purpose: string;
  /** The need a keeper meets here (each need is met in exactly one kind of room). */
  meets?: NeedKind;
  /** The supply keepers pick up at the post (4.4): the bowl, the ball, the bucket. */
  supplies?: NeedKind;
  /** Where the supply is, or the keepers' post, px from the room's left edge (default: the middle). */
  post?: number;
  /**
   * Where the room's keepers wait between jobs, px from its left edge (default: the post): clear of the body of a
   * dragon of any stage in any of its slots, so a waiting keeper is never hidden behind one (the post, where a supply
   * is picked up, may lie behind a slot).
   */
  wait?: number;
  /** A room for people (the towers'); no dragon stands in one. */
  people?: boolean;
  /** Its dragon slots: 'module' (one per module, and two baby sub-slots each), 'baby' (the sub-slots only), or none. */
  slots?: 'module' | 'baby';
}
/** Every room there is (#11: a room is named and furnished only for a real purpose; the rest of the building is bare). */
export const ROOM_INFO: Readonly<Record<RoomKind, RoomInfo>> = Object.freeze({
  kitchen: { name: 'HEARTH KITCHEN', purpose: 'meets food: a keeper feeds the dragon here, with the bowl taken at the hearth', meets: 'food', supplies: 'food', post: 64, wait: 160, slots: 'module' },
  bath: { name: 'BATHHOUSE', purpose: 'meets bath: a keeper washes the dragon here, with the bucket filled at the tub', meets: 'bath', supplies: 'bath', post: 226, slots: 'module' },
  hatchery: { name: 'HATCHERY', purpose: 'eggs lie in its three nests and hatch into babies', slots: 'baby' },
  romp: { name: 'ROMP ROOM', purpose: 'meets play: a keeper plays with the dragon here, with a ball from the box by the wheel', meets: 'play', supplies: 'play', post: 107, wait: 160, slots: 'module' },
  groom: { name: 'GROOMING PARLOUR', purpose: 'meets love, the busiest need (the own need of spike, rock and slinkwing): a keeper grooms and pets the dragon here', meets: 'love', post: 120, wait: 320, slots: 'module' },
  dorm: { name: 'LAMP DORM', purpose: 'meets sleep: a keeper tucks the dragon in here', meets: 'sleep', slots: 'module' },
  tack: { name: 'TACK ROOM', purpose: 'riders take their saddles here before a mission and hang them back after', people: true },
  bunks: { name: 'BUNKS', purpose: 'riders rest here after a mission', people: true },
  maproom: { name: 'MAP ROOM', purpose: 'the mission table: the world map and the mission chooser', people: true },
});
export const ROOM_KINDS = Object.freeze(Object.keys(ROOM_INFO) as RoomKind[]);
/** The named parts of the building that are not rooms, with their purposes too: the lift and the Aerie deck. */
export type Structure = 'lift' | 'aerie';
export const STRUCTURES: Readonly<Record<Structure, { name: string; purpose: string }>> = Object.freeze({
  lift: { name: 'LIFT', purpose: 'carries dragons between the barn\'s floors and up to the Aerie' },
  aerie: { name: 'AERIE', purpose: 'teams gather here, leave and land' },
});

export type Part = 'barn' | 'towerL' | 'towerR';
/** Where a room goes: a barn room by its first module and width (never on the lift, never across the ladder bay), a tower room by floor. */
export interface RoomPlace { kind: RoomKind; part: Part; floor: number; mod?: number; width?: number }
/**
 * Where one dragon stands in a room: its room (id), its index in the room's slots, its floor, x (the body's root),
 * the way it faces, whether it is a baby's sub-slot, and its barn module. A module holds either one non-baby (in its
 * module slot) or up to two babies (in its sub-slots).
 */
export interface Slot { room: number; i: number; f: number; x: number; facing: 1 | -1; baby: boolean; mod: number }
export interface Room { id: number; kind: RoomKind; part: Part; floor: number; x0: number; x1: number; slots: Slot[] }

/**
 * A room's slots (3.3): first one per module at its middle -- one module faces its post, two face each other (+1, -1:
 * their keepers work between them), three face +1, +1, -1 -- then two baby sub-slots per module, 40 px in from each
 * side (facing +1 and -1). A 'baby' room has the sub-slots only.
 */
function slotsOf(id: number, kind: RoomKind, f: number, m: number, w: number, x0: number): Slot[] {
  const info = ROOM_INFO[kind], out: Slot[] = [];
  if (!info.slots) return out;
  if (info.slots === 'module') {
    const post = x0 + (info.post ?? (w * MOD) / 2);
    for (let k = 0; k < w; k++) {
      const x = modX(m + k) + MOD / 2;
      const facing: 1 | -1 = w === 1 ? (post >= x ? 1 : -1) : k === w - 1 ? -1 : 1;
      out.push({ room: id, i: out.length, f, x, facing, baby: false, mod: m + k });
    }
  }
  for (let k = 0; k < w; k++) {
    out.push({ room: id, i: out.length, f, x: modX(m + k) + 40, facing: 1, baby: true, mod: m + k });
    out.push({ room: id, i: out.length, f, x: modX(m + k) + 120, facing: -1, baby: true, mod: m + k });
  }
  return out;
}

/** Place rooms on the grid, checking each fits the building (a barn room never on the lift) and overlaps no other. */
export function placeRooms(places: readonly RoomPlace[]): Room[] {
  const rooms = places.map((p, id): Room => {
    if (p.part === 'barn') {
      const m = p.mod ?? 0, w = p.width ?? 1;
      if (p.floor < 0 || p.floor >= BARN_FLOORS || m < 0 || w < 1 || w > 3 || m + w > BARN_MODS || (m < 3 && m + w > 3)) throw new Error(`room ${p.kind}: no barn slot at floor ${p.floor}, modules ${m}..${m + w - 1}`);
      if (m <= LIFT_MOD && m + w > LIFT_MOD) throw new Error(`room ${p.kind}: module ${LIFT_MOD} is the Dragon Lift, not a room`);
      const x0 = modX(m);
      return { id, kind: p.kind, part: p.part, floor: p.floor, x0, x1: x0 + w * MOD, slots: slotsOf(id, p.kind, p.floor, m, w, x0) };
    }
    if (p.floor < 0 || p.floor >= TOWER_FLOORS) throw new Error(`room ${p.kind}: no tower floor ${p.floor}`);
    if (ROOM_INFO[p.kind].slots) throw new Error(`room ${p.kind}: a dragon room must be in the barn (a tower's doors are human-sized)`);
    const x = p.part === 'towerL' ? TOWER_L : TOWER_R;
    return { id, kind: p.kind, part: p.part, floor: p.floor, x0: x + WALL, x1: x + TOWER_W - WALL, slots: [] };
  });
  for (const a of rooms) for (const b of rooms) if (a.id < b.id && a.floor === b.floor && a.x0 < b.x1 && b.x0 < a.x1) throw new Error(`rooms ${a.kind} and ${b.kind} overlap`);
  return rooms;
}

/** A room's supply spot or post, world x. */
export function postX(r: Room): number { return r.x0 + (ROOM_INFO[r.kind].post ?? (r.x1 - r.x0) / 2); }
/** Where a room's keepers wait between jobs, world x (RoomInfo.wait; default the post): clear of every slot's body. */
export function waitX(r: Room): number { const w = ROOM_INFO[r.kind].wait; return w == null ? postX(r) : r.x0 + w; }

/** Whether a dragon of this stage fits a slot: a baby takes a sub-slot, anyone older a module slot. */
export function fitsSlot(slot: Slot, stage: Stage): boolean { return slot.baby === (stage === 'baby'); }

// ---------- walking: nets of floor spans and links, routes ----------

/** A floor's walkable stretch, [x0, x1]. */
export type Span = readonly [number, number];
/** A way between floors, at x, stopping at `stops` (ascending): a keeper's ladder, or the Dragon Lift. */
export interface Link { name: 'ladderL' | 'ladderR' | 'ladderM' | 'lift'; x: number; stops: readonly number[] }
/** Who can go where: each floor's spans (floors 0-5), and the links between floors. */
export interface Net { spans: readonly (readonly Span[])[]; links: readonly Link[] }

/** A keeper's half-width: how close to a wall their feet come. */
const PAD = 10;
const TL: Span = [TOWER_L + WALL + PAD, TOWER_L + TOWER_W - WALL - PAD];
const TR: Span = [TOWER_R + WALL + PAD, TOWER_R + TOWER_W - WALL - PAD];
/**
 * The keepers' net. The towers open into the barn on the ground and upper floors, so each of those is one span end to
 * end; the hayloft is cut off from the towers by the roof, and above it only the towers go on, up to the Aerie deck
 * (floor 5), reached by the left tower's ladder. Three ladders: one up each tower, and the centre ladder bay's through
 * the barn's three floors. Keepers never ride the lift.
 */
export const KEEPER_NET: Net = Object.freeze<Net>({
  spans: [
    [[TL[0], TR[1]]],
    [[TL[0], TR[1]]],
    [TL, [BARN_X + 16, TOWER_R - 16], TR],
    [TL, TR],
    [TL, TR],
    [[DECK_X0 + PAD, DECK_X1 - PAD]],
  ],
  links: [
    { name: 'ladderL', x: TOWER_L + 84, stops: [0, 1, 2, 3, 4, AERIE_F] },
    { name: 'ladderR', x: TOWER_R + TOWER_W - 84, stops: [0, 1, 2, 3, 4] },
    { name: 'ladderM', x: LADDER_M_X, stops: [0, 1, 2] },
  ],
});

/**
 * A dragon's body behind and ahead of its root x, by stage: the most over every element and seed (measured headless
 * over the idles; the art's extentX). A body facing +1 spans x - back .. x + front.
 */
export const DRAGON_BODY: Readonly<Record<Stage, { readonly back: number; readonly front: number }>> = Object.freeze({
  baby: { back: 26.5, front: 29.8 }, young: { back: 54.4, front: 41.8 }, adult: { back: 70.7, front: 50.8 }, elder: { back: 74.7, front: 52.0 },
});
/** Where the body of a dragon of this stage in this slot reaches, [x0, x1]. */
export function slotBody(slot: Slot, stage: Stage): Span {
  const b = DRAGON_BODY[stage];
  return slot.facing > 0 ? [slot.x - b.back, slot.x + b.front] : [slot.x - b.front, slot.x + b.back];
}
/** Half a dragon's body, by stage, from the measured extents (DRAGON_BODY's larger side, rounded up). */
export const DRAGON_PAD: Readonly<Record<Stage, number>> = Object.freeze({ baby: 30, young: 56, adult: 72, elder: 76 });
const DRAGON_NETS = new Map<Stage, Net>();
/**
 * A dragon's net at a stage: the barn's ground and upper floors wall to wall, the hayloft between modules 1 and 5
 * (clear of the low roof slopes), and the Aerie deck, each kept DRAGON_PAD in from its ends; the one link is the lift.
 * No tower span: a tower's doors are human-sized. Built once per stage.
 */
export function dragonNet(stage: Stage): Net {
  const had = DRAGON_NETS.get(stage);
  if (had) return had;
  const P = DRAGON_PAD[stage], barn: Span = [BARN_X + P, TOWER_R - P];
  const n = Object.freeze<Net>({
    spans: [[barn], [barn], [[modX(1) + P, modX(5) - P]], [], [], [[DECK_X0 + P, DECK_X1 - P]]],
    links: [{ name: 'lift', x: LIFT_CX, stops: LIFT_STOPS }],
  });
  DRAGON_NETS.set(stage, n);
  return n;
}
/** The floors the lift bay is walked on (and the bay rule holds on): the lift's stops. */
export function bayFloors(): readonly number[] { return LIFT_STOPS; }

/** A px climbed costs this many walked (a keeper climbs at 0.8 of their walking pace; the lift is costed the same). */
export const CLIMB_COST = 1.25;

export interface Spot { f: number; x: number }
/** One leg of a route: walk along floor f to x, or, where f changes from the leg before, climb (or ride) to floor f at x. */
export type Leg = Spot;

/** The span of floor f holding x in a net (-1: none). */
export function spanOf(f: number, x: number, net: Net = KEEPER_NET): number {
  const sp = net.spans[f];
  if (!sp) return -1;
  for (let i = 0; i < sp.length; i++) if (x >= sp[i][0] - 0.5 && x <= sp[i][1] + 0.5) return i;
  return -1;
}
/** x clamped into the span of floor f nearest it. */
export function clampToFloor(f: number, x: number, net: Net = KEEPER_NET): number {
  let best = x, d = Infinity;
  for (const [a, b] of net.spans[f] ?? []) { const c = Math.max(a, Math.min(b, x)), e = Math.abs(c - x); if (e < d) { d = e; best = c; } }
  return best;
}
/** x clamped into the span of floor f that holds `near` (or, if none does, the span nearest `near`). */
export function clampToSpan(f: number, x: number, net: Net, near: number): number {
  const sp = net.spans[f] ?? [];
  let s = spanOf(f, near, net);
  if (s < 0) { let d = Infinity; sp.forEach(([a, b], i) => { const e = Math.abs(Math.max(a, Math.min(b, near)) - near); if (e < d) { d = e; s = i; } }); }
  if (s < 0) return x;
  return Math.max(sp[s][0], Math.min(sp[s][1], x));
}

/** Where a keeper stands to work with a dragon: this far in front of its body's root, past the snout (2.4). */
export const REACH: Readonly<Record<Stage, number>> = Object.freeze({ baby: 30, young: 46, adult: 58, elder: 60 });
/** Where a keeper stands to meet the dragon in a slot (3.3): in front of its snout, kept 10 px inside the room's walls. */
export function standSpot(slot: Slot, stage: Stage, room: Room): Spot {
  return { f: slot.f, x: Math.max(room.x0 + 10, Math.min(room.x1 - 10, slot.x + slot.facing * REACH[stage])) };
}

/**
 * The cheapest route between two spots on a net (the keepers' by default), as legs, with its cost in walked px; null
 * if there is none. Dijkstra over one node per link and stop: along a link, each stop to the next costs its rise x
 * CLIMB_COST (the lift's 2 -> 5 is one edge), and along a floor, nodes in the same span of that net are joined.
 * Ties go to the lower node index, so a route is the same every run. A ride on the lift is always one leg, from the
 * stop it boards at straight to the one it alights at (the stops passed on the way are dropped: a rider never gets
 * off between); a ladder climb stays one leg per floor, so a keeper sent elsewhere mid-climb can stop at the next.
 */
export function route(from: Spot, to: Spot, net: Net = KEEPER_NET): { legs: Leg[]; cost: number } | null {
  const fs = spanOf(from.f, from.x, net), ts = spanOf(to.f, to.x, net);
  if (fs < 0 || ts < 0) return null;
  if (from.f === to.f && fs === ts) return { legs: [{ f: to.f, x: to.x }], cost: Math.abs(to.x - from.x) };
  const nodes: Spot[] = [from, to];
  /** Each link node's stop below it on its link (-1: the lowest, or not a link node), and its link (null: from, to). */
  const below: number[] = [-1, -1], link: (Link | null)[] = [null, null];
  for (const l of net.links) l.stops.forEach((f, i) => { below.push(i > 0 ? nodes.length - 1 : -1); link.push(l); nodes.push({ f, x: l.x }); });
  const n = nodes.length, dist = new Array<number>(n).fill(Infinity), prev = new Array<number>(n).fill(-1), done = new Array<boolean>(n).fill(false);
  const span = nodes.map((s) => spanOf(s.f, s.x, net));
  const rise = (a: number, b: number) => Math.abs(feetY(nodes[a].f) - feetY(nodes[b].f)) * CLIMB_COST;
  dist[0] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || u === 1) break;
    done[u] = true;
    const relax = (v: number, c: number) => { if (dist[u] + c < dist[v]) { dist[v] = dist[u] + c; prev[v] = u; } };
    for (let v = 0; v < n; v++) if (!done[v] && v !== u && nodes[v].f === nodes[u].f && span[v] === span[u] && span[u] >= 0) relax(v, Math.abs(nodes[v].x - nodes[u].x));
    // along the link: to the stop below (below[u]) and the stop above (the node whose below is u)
    if (below[u] >= 0 && !done[below[u]]) relax(below[u], rise(u, below[u]));
    const above = below.indexOf(u, 2);
    if (above >= 0 && !done[above]) relax(above, rise(u, above));
  }
  if (dist[1] === Infinity) return null;
  const path: number[] = [];
  for (let v = 1; v > 0; v = prev[v]) path.unshift(v);
  path.unshift(0);
  /** Whether the step from path[i - 1] to path[i] is a ride between two of the lift's stops. */
  const ride = (i: number) => link[path[i]]?.name === 'lift' && link[path[i - 1]] === link[path[i]] && nodes[path[i]].f !== nodes[path[i - 1]].f;
  const legs: Leg[] = [];
  for (let i = 1; i < path.length; i++) if (!(ride(i) && i + 1 < path.length && ride(i + 1))) legs.push({ f: nodes[path[i]].f, x: nodes[path[i]].x });
  return { legs, cost: dist[1] };
}

// ---------- name plates ----------

/** A name plate: its text, box (world px) and what it names -- a room (by id) or a structure. */
export interface Plate { text: string; x: number; y: number; w: number; h: number; names: RoomKind | Structure; room: number | null }
export const PLATE_H = 11;
/**
 * Every plate the building shows: one per room (#11: a named room, and nothing on a bare slot), the lift's on its
 * ground-floor bay, and the Aerie's over the deck's west end.
 */
export function platesOf(rooms: readonly Room[]): Plate[] {
  const mk = (text: string, x: number, y: number, names: RoomKind | Structure, room: number | null): Plate => ({ text, x, y, w: measureText(text, 1) + 6, h: PLATE_H, names, room });
  const out = rooms.map((r) => {
    const t = floorTop(r.floor), barn = r.part === 'barn';
    // (a hayloft plate hangs lower, clear of the HUD's top bar when the start camera shows the hayloft's floor; one at
    // the barn's west end moves 44 px in: in the hayloft clear of the roof's slope, and on every floor whole in the
    // opening frame, whose left edge is at x 204: base.ts START_CAM)
    const loft = barn && r.floor === 2, x = barn && r.x0 === BARN_X ? r.x0 + 44 : r.x0 + (barn ? 5 : 3);
    return mk(ROOM_INFO[r.kind].name, x, loft ? t + 20 : t + 3, r.kind, r.id);
  });
  out.push(mk(STRUCTURES.lift.name, LIFT_X0 + 7, floorTop(0) + 3, 'lift', null));
  out.push(mk(STRUCTURES.aerie.name, 12, feetY(AERIE_F) - 24, 'aerie', null));
  return out;
}
