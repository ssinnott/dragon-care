// The Map Room's table (docs/BASE_DESIGN.md 5): the two overlays a mission is chosen and sent from -- the
// world map (worldmap.ts's little pixel-art world: the regions explored and the cloud over the rest, the roads, HOME,
// every place's landmark; over it here, each explored region's name, a pin and a name plate for each mission on the
// board at its place -- the road's challenges and its days on the plate -- and, while a team is out, its road from HOME
// and its flag walking it) and the mission chooser (the region's climate picture, the mission's rewards, its challenges with
// what meets them and who at home could, the big baddie, the team's pairs and riders, the eligible dragons, the odds,
// BEST TEAM and SEND FROM THE AERIE) -- and, while a team is out, its TEAM OUT chip under the top bar (a tap opens the
// watchable scene: BASE_DESIGN 6, missionview.ts) and the trip's log, opened over the scene by its TRIP LOG button (each stop
// met, unmet or still ahead, the log so far, the time left). Drawing and hit rects only, at the view's 640 x 360:
// base.ts owns what a tap does (tableTap, watchTap), and
// missions.ts every rule. House style: 1 px ink outlines, flat fills, the engine's 5 x 7 font (it has no tick, cross or
// arrow glyphs: those are small inked sprites), no alpha anywhere -- the regions not explored yet lie under cloud, never
// faded. The mission art (the climate picture, the challenge and skill icons, the baddie's portrait) is the mission art
// kit's (ART_BIBLE 5.10: backdrops.ts, baddies.ts, missionicons.ts).
import { drawText, drawTextOutlined, measureText } from '../lib/engine/text.ts';
import { drawSprite, ICONS, hit } from './icons.ts';
import type { Rect, Sprite } from './icons.ts';
import { drawClimate } from './backdrops.ts';
import { drawBaddiePortrait } from './baddies.ts';
import { CHALLENGE_ICONS, SKILL_ICONS } from './missionicons.ts';
import { barnRoom } from './life.ts';
import { INK } from './surfaces.ts';
import { REGIONS, CHALLENGES, BADDIES, KEEPER_SKILL, SKILL_NAME, regionOf, placeOf } from './regions.ts';
import type { Counter, Place } from './regions.ts';
import { MAP_RECT, PLACES, worldCanvas, drawAlive, drawLandmark, footprint, homeRect, regionAt, routeTo, alongRoute, regionBox } from './worldmap.ts';
import { stopShownAt, roadFraction } from './missionview.ts';
import {
  bestTeam, oddsOf, canSend, coverage, dragonReason, freeRider, autoRider, partnerOf, freeNest, hoursLeft, onTrip, MAX_PAIRS,
} from './missions.ts';
import type { Mission, Pair, Trip } from './trip.ts';
import type { CareSim, Dragon, Keeper } from './sim.ts';
import { KEEPER_PALETTES } from '../art/keeper/palettes.ts';
import { DRAGON_PALETTES } from '../art/dragon/palettes.ts';

/** Which overlay is open: none, the map, a mission's chooser, or the team out watched on its road (BASE_DESIGN 6). */
export type Screen = 'none' | 'map' | 'mission' | 'watch';
/**
 * The overlays' own state (the view's, never saved): the screen, the mission chosen (by id), the team being put
 * together for it, the frames left before the map opens (the camera easing to the Map Room first), and whether the
 * trip's log is open over the watch overlay.
 */
export interface MapUi { screen: Screen; mission: number | null; pairs: Pair[]; opening: number; card: boolean }
export function newUi(): MapUi { return { screen: 'none', mission: null, pairs: [], opening: 0, card: false }; }

/** What a tap on the table does. */
export type UiAct =
  | { kind: 'back' } | { kind: 'pin'; mission: number } | { kind: 'best' } | { kind: 'send' }
  | { kind: 'dragon'; dragon: number } | { kind: 'rider'; keeper: number } | { kind: 'cycle'; pair: number } | { kind: 'remove'; pair: number }
  | { kind: 'note'; text: string }
  | { kind: 'none' };
/**
 * A tap target drawn this frame (screen px), with its name for the page's hook (a pin, BACK, BEST TEAM, SEND; on the map
 * `place:<name>` for a place with no mission, `cloud:<region>` for a region under cloud), and, for a shape a rect can't
 * hold (a cloud's region), a test of the point too.
 */
export interface Hit { r: Rect; act: UiAct; name?: string; test?: (x: number, y: number) => boolean }

/** The overlay's panel (BASE_DESIGN 5), BACK's button, and the mission chooser's columns and buttons. */
export const PANEL: Readonly<Rect> = Object.freeze({ x: 8, y: 18, w: 624, h: 318 });
export const BACK: Readonly<Rect> = Object.freeze({ x: 560, y: 316, w: 64, h: 16 });
export const CLIMATE_RECT: Readonly<Rect> = Object.freeze({ x: 16, y: 26, w: 300, h: 112 });
export const BEST: Readonly<Rect> = Object.freeze({ x: 324, y: 290, w: 90, h: 18 });
export const SEND: Readonly<Rect> = Object.freeze({ x: 420, y: 290, w: 204, h: 18 });
export const ODDS_BAR: Readonly<Rect> = Object.freeze({ x: 324, y: 270, w: 150, h: 10 });
/** The team's two pair slots, and the eligible dragons' grid (96 x 18 buttons, three a row). */
const PAIR_SLOTS: readonly Rect[] = [{ x: 324, y: 40, w: 300, h: 44 }, { x: 324, y: 88, w: 300, h: 44 }];
const GRID = { x: 324, y: 142, w: 96, h: 18, dx: 102, dy: 21, cols: 3, rows: 5 } as const;
/**
 * The TEAM OUT chip under the top bar (a tap opens the watch overlay): at x 520 it covered the Lamp Dorm's plate at the
 * start camera (the upper floor's plates sit just under the bar there, and the dorm's starts at screen x 513); at x 394
 * it sits over the lift shaft's and the ladder bay's tops, where no plate or window is, still clear of the buttons over
 * it and of the canvas point (350, 200) where the smoke test's drag starts. And over the watch overlay, the trip's log
 * (its stops and the time left: under the scene's banner line, clear of the team's heads and the baddie's)
 * and its TRIP LOG button, beside BACK TO BARN (missionview.ts BACK_BUTTON, x 8-118).
 */
export const CHIP: Readonly<Rect> = Object.freeze({ x: 394, y: 19, w: 114, h: 15 });
export const TRIP_CARD: Readonly<Rect> = Object.freeze({ x: 8, y: 34, w: 300, h: 120 });
export const LOG_BUTTON: Readonly<Rect> = Object.freeze({ x: 124, y: 338, w: 64, h: 16 });

// ---------- colours ----------

const PARCHMENT = '#e8d8a8', BORDER = '#8a6a4a', INKY = '#4a3428', FADED = '#8a7a64', PLATE = '#f3e6c8';
const FACE = '#3a2e34', ACTIVE = '#6b4a34', TEXT = '#f3e6c8', OFF = '#a89c88', GOOD = '#5c9c4c';
const PIN = '#d04a3a', FLAG = '#f2c14e';

// ---------- the pen ----------

const text = (ctx: CanvasRenderingContext2D, s: string, x: number, y: number, color = INKY, align: 'left' | 'right' | 'center' = 'left') =>
  drawText(ctx, s, Math.round(x), Math.round(y), { color, align, shadow: false });
const title = (ctx: CanvasRenderingContext2D, s: string, x: number, y: number) =>
  drawTextOutlined(ctx, s, x, y, { size: 1, color: TEXT, outline: INK, thickness: 1, shadow: false });
function rect(ctx: CanvasRenderingContext2D, r: Rect, c: string): void { ctx.fillStyle = c; ctx.fillRect(Math.round(r.x), Math.round(r.y), Math.round(r.w), Math.round(r.h)); }
/** An inked box, flat. */
function box(ctx: CanvasRenderingContext2D, r: Rect, c: string): void { rect(ctx, r, INK); rect(ctx, { x: r.x + 1, y: r.y + 1, w: r.w - 2, h: r.h - 2 }, c); }
/** A button: an inked box on the HUD's face (or its active face), its label centred; greyed, its label in grey. */
function button(ctx: CanvasRenderingContext2D, r: Rect, label: string, on = true, active = false): void {
  box(ctx, r, active ? ACTIVE : FACE);
  text(ctx, label, r.x + r.w / 2, r.y + Math.round((r.h - 7) / 2), on ? TEXT : OFF, 'center');
}
/** The panel: parchment in an inked 2 px border. */
function panel(ctx: CanvasRenderingContext2D): void {
  box(ctx, PANEL, BORDER);
  rect(ctx, { x: PANEL.x + 3, y: PANEL.y + 3, w: PANEL.w - 6, h: PANEL.h - 6 }, INK);
  rect(ctx, { x: PANEL.x + 4, y: PANEL.y + 4, w: PANEL.w - 8, h: PANEL.h - 8 }, PARCHMENT);
}

/** Small inked marks the font hasn't got: a cross (unmet), a pending dot, the remove X, a flag. */
const CROSS: Sprite = { rows: ['r...r', '.r.r.', '..r..', '.r.r.', 'r...r'], colors: { r: '#d8402e' } };
const PENDING: Sprite = { rows: ['ww', 'ww'], colors: { w: '#b8ac8e' } };
const REMOVE: Sprite = { rows: ['x.....x', '.x...x.', '..x.x..', '...x...', '..x.x..', '.x...x.', 'x.....x'], colors: { x: '#f3e6c8' } };
const FLAG_SPRITE: Sprite = { rows: ['pffff', 'pfff.', 'pffff', 'p....', 'p....', 'p....'], colors: { p: '#6b4a34', f: FLAG } };
/** The team's flag on the map's road (bigger, and waving: two shapes of it, turn about). */
const TEAM_FLAGS: readonly Sprite[] = [
  { rows: ['pfffff', 'pffff.', 'pfffff', 'p.....', 'p.....', 'p.....', 'p.....'], colors: { p: '#6b4a34', f: FLAG } },
  { rows: ['pffff.', 'pfffff', 'pffff.', 'p.....', 'p.....', 'p.....', 'p.....'], colors: { p: '#6b4a34', f: FLAG } },
];
/** A mood's colour (the chooser's mood dot): good, so-so, low. */
const moodColour = (m: number) => (m >= 0.5 ? '#7bbf6a' : m >= 0 ? '#e3b23e' : '#d8402e');
const MOOD_DOT = (c: string): Sprite => ({ rows: ['.mm.', 'mmmm', 'mmmm', '.mm.'], colors: { m: c } });

// ---------- the map ----------

/** A name on a ribbon, centred on (cx, cy): parchment in an inked box, a notched tail behind each end. Returns its box. */
function ribbon(ctx: CanvasRenderingContext2D, s: string, cx: number, cy: number): Rect {
  const w = measureText(s) + 8, h = 11, x = Math.round(cx - w / 2), y = Math.round(cy - h / 2);
  for (const tx of [x - 5, x + w - 1]) {
    box(ctx, { x: tx, y: y + 2, w: 6, h: h - 4 }, BORDER);
    rect(ctx, { x: tx === x - 5 ? tx + 1 : tx + 4, y: y + 4, w: 1, h: h - 8 }, INK);
  }
  box(ctx, { x, y, w, h }, PLATE);
  text(ctx, s, x + 4, y + 2, INKY);
  return { x, y, w, h };
}
/** A plate of words (parchment in an inked box) with its top left at (x, y); returns its box. */
function plate(ctx: CanvasRenderingContext2D, s: string, x: number, y: number): Rect {
  const r = { x: Math.round(x), y: Math.round(y), w: measureText(s) + 8, h: 11 };
  box(ctx, r, PLATE);
  text(ctx, s, r.x + 4, r.y + 2, INKY);
  return r;
}

/** The compass in the map's corner: its north arm red, the others parchment, an N over it. */
const COMPASS: Sprite = {
  rows: ['....r....', '....r....', '...rRr...', '.c.rRr.c.', 'wwwwkWWWW', '.c.wWw.c.', '...wWw...', '....w....', '....w....'],
  colors: { r: '#d8402e', R: '#a83028', w: '#f3e6c8', W: '#c8b890', c: '#8a6a4a', k: INK },
};
/** The small crown a baddie's road shows on its plate (the trip log's too). */
const CROWN: Sprite = { rows: ['c.c.c', 'ccccc', 'ccccc'], colors: { c: FLAG } };
/** A mission's number on its pin's red head, its top left at (x, y). */
function pinBadge(ctx: CanvasRenderingContext2D, n: number, x: number, y: number): void { box(ctx, { x, y, w: 11, h: 11 }, PIN); text(ctx, String(n), x + 3, y + 2, '#fff8ee'); }

/** A mission's plate: its size for a title and a road (the number's badge and the title, then the icons and the days). */
function plateSize(m: Mission): { w: number; h: number } {
  const icons = m.challenges.length + (m.baddie ? 1 : 0), days = `${m.days} DAY${m.days > 1 ? 'S' : ''}`;
  return { w: Math.max(18 + measureText(m.title) + 4, 6 + icons * 11 + 4 + measureText(days) + 5), h: 27 };
}
/**
 * Where a mission's plate goes, near its place: over the landmark (a stalk down to it) where it fits, else under it,
 * each tried to the right of the stalk and then to its left -- inside the map, clear of its top line's words and BACK,
 * and of the plates already placed.
 */
function plateAt(m: Mission, p: Place, taken: readonly Rect[]): Rect {
  const f = footprint(p.art, p.at), { w, h } = plateSize(m), X = p.at[0];
  const tries = [
    { x: X - 8, y: f.y - 5 - h }, { x: X - w + 8, y: f.y - 5 - h }, { x: X - 8, y: p.at[1] + 5 }, { x: X - w + 8, y: p.at[1] + 5 },
  ].map((r) => ({ x: Math.max(MAP_RECT.x + 2, Math.min(MAP_RECT.x + MAP_RECT.w - w - 2, Math.round(r.x))), y: Math.round(r.y), w, h }));
  const off = (r: Rect) => r.y < MAP_RECT.y + 15 || r.y + r.h > MAP_RECT.y + MAP_RECT.h - 2 || overlaps(r, BACK)
    || taken.some((q) => overlaps(r, q)) || PLACES.some((q) => q.name !== p.name && overlaps(r, footprint(q.art, q.at)));
  return tries.find((r) => !off(r)) ?? tries.find((r) => !taken.some((q) => overlaps(r, q))) ?? tries[0];
}
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * A mission on the map at its place (BASE_DESIGN 5.1): its plate (the number's badge, the title, the road's challenge
 * icons -- the baddie's crown last -- and its days) and a stalk from it down (or up) to the landmark, whose top it marks
 * with a dot.
 */
function drawMission(ctx: CanvasRenderingContext2D, n: number, m: Mission, p: Place, r: Rect): void {
  const f = footprint(p.art, p.at), X = p.at[0], above = r.y + r.h <= f.y;
  const y0 = above ? r.y + r.h : p.at[1] + 2, y1 = above ? f.y - 2 : r.y;
  rect(ctx, { x: X - 1, y: Math.min(y0, y1), w: 3, h: Math.abs(y1 - y0) }, INK);
  rect(ctx, { x: X, y: Math.min(y0, y1), w: 1, h: Math.abs(y1 - y0) }, PIN);
  box(ctx, { x: X - 2, y: (above ? y1 : y0) - 2, w: 5, h: 5 }, PIN);
  box(ctx, r, PLATE);
  pinBadge(ctx, n, r.x + 3, r.y + 3);
  text(ctx, m.title, r.x + 17, r.y + 5, INKY);
  let x = r.x + 9;
  for (const c of m.challenges) { drawSprite(ctx, CHALLENGE_ICONS[c], x, r.y + 20); x += 11; }
  if (m.baddie) { drawSprite(ctx, CROWN, x, r.y + 20); x += 11; }
  text(ctx, `${m.days} DAY${m.days > 1 ? 'S' : ''}`, x + 1, r.y + 17, FADED);
}

/** A region under cloud: its "?" in an inked badge on the cloud, or, cleared by a success and waiting for the dawn, AT DAWN on a ribbon. */
function drawCloudMark(ctx: CanvasRenderingContext2D, x: number, y: number, pending: boolean): Rect {
  if (pending) return ribbon(ctx, 'CLEARS AT DAWN', x, y);
  const r = { x: x - 6, y: y - 6, w: 13, h: 13 };
  box(ctx, r, PLATE);
  text(ctx, '?', x - 2, y - 3, INKY);
  return r;
}

/**
 * The team out on the map: its road from HOME to the mission's place in red dots, a flag planted at the place, and the
 * team's own flag where it is on that road (roadFraction: the scene's own pace -- standing at a stop, walking home after a
 * turn-back, at HOME before it leaves and once it lands).
 */
function drawTeamRoad(ctx: CanvasRenderingContext2D, sim: CareSim, t: Trip, frame: number): void {
  const p = placeOf(t.mission), route = routeTo(p.name, sim.missions.explored);
  if (!route) return;
  let d = 0;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1], b = route[i], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let s = (4 - (d % 4)) % 4; s < len; s += 4) rect(ctx, { x: Math.round(a[0] + ((b[0] - a[0]) * s) / len), y: Math.round(a[1] + ((b[1] - a[1]) * s) / len), w: 2, h: 2 }, PIN);
    d += len;
  }
  const f = footprint(p.art, p.at);
  drawSprite(ctx, FLAG_SPRITE, f.x + f.w + 2, f.y + 2);
  const [x, y] = alongRoute(route, roadFraction(sim, t));
  drawSprite(ctx, TEAM_FLAGS[Math.floor(frame / 20) % 2], Math.round(x) + 2, Math.round(y) - 4);
}

/**
 * The map screen (BASE_DESIGN 5.1): the panel, the world map (worldmap.ts: its picture for the regions explored, cloud
 * over the rest, and its living parts at the view's frame `t`), MAP ROOM and what to do, the compass, each explored
 * region's name (a region under cloud shows "?", or CLEARS AT DAWN once a success next door has lifted it), the team out's
 * road and flag, a pin and plate for each mission on the board at its place, and BACK. Returns the tap targets: each
 * mission's plate (`pin<n>`, board order) and its landmark (`mark<n>`), every other place explored (`place:<name>`: its
 * line, what it is -- and that the team is there, when it is), each cloud (`cloud:<region>` its "?", and the cloud
 * itself: how it clears), HOME, and BACK.
 */
export function drawMapScreen(ctx: CanvasRenderingContext2D, sim: CareSim, t = 0): Hit[] {
  const ms = sim.missions, hits: Hit[] = [], explored = ms.explored;
  panel(ctx);
  ctx.drawImage(worldCanvas(explored), MAP_RECT.x, MAP_RECT.y);
  drawAlive(ctx, t, explored);
  // (the clouds and HOME first: the places and pins over them take a tap first)
  for (const r of REGIONS) {
    if (explored.includes(r.id)) continue;
    const pending = ms.pendingReveal.includes(r.id), next = r.neighbours.filter((n) => explored.includes(n)).map((n) => regionOf(n).name);
    const note = pending ? 'THE CLOUD OVER THIS LAND LIFTS AT DAWN' : next.length ? `UNDER CLOUD: A SUCCESS IN ${next.join(' OR ')} CLEARS IT` : 'UNDER CLOUD: EXPLORE NEXT DOOR TO CLEAR IT';
    hits.push({ r: regionBox(r.id), act: { kind: 'note', text: note }, test: (x, y) => regionAt(x, y) === r.id });
    hits.push({ r: drawCloudMark(ctx, r.map.label[0], r.map.label[1], pending), act: { kind: 'note', text: note }, name: `cloud:${r.id}` });
  }
  hits.push({ r: homeRect(), act: { kind: 'note', text: 'HOME: THE BARN. TEAMS SET OUT FROM THE AERIE' }, name: 'home' });
  for (const r of REGIONS) if (explored.includes(r.id)) ribbon(ctx, r.name, r.map.label[0], r.map.label[1]);
  // the places explored with no mission today: a tap says what each is
  const onBoard = new Set(ms.board.map((m) => placeOf(m).name)), out = ms.trip ? placeOf(ms.trip.mission).name : null;
  for (const p of PLACES) {
    if (!explored.includes(p.region) || onBoard.has(p.name)) continue;
    const f = footprint(p.art, p.at);
    hits.push({ r: { x: f.x - 2, y: f.y - 2, w: f.w + 4, h: f.h + 4 }, act: { kind: 'note', text: `${p.name}: ${p.blurb}${p.name === out ? ' - THE TEAM IS OUT THERE' : ''}` }, name: `place:${p.name}` });
  }
  // the team out, on its road
  const trip = ms.trip;
  if (trip) drawTeamRoad(ctx, sim, trip, t);
  // the missions at their places, their plates clear of each other
  const taken: Rect[] = [];
  ms.board.forEach((m, i) => {
    const p = placeOf(m), r = plateAt(m, p, taken), f = footprint(p.art, p.at);
    taken.push(r);
    drawMission(ctx, i + 1, m, p, r);
    hits.push({ r: { x: f.x - 2, y: f.y - 2, w: f.w + 4, h: f.h + 4 }, act: { kind: 'pin', mission: m.id }, name: `mark${i}` });
    hits.push({ r, act: { kind: 'pin', mission: m.id }, name: `pin${i}` });
  });
  // the words over the map: MAP ROOM, what to do (or where the team is), the compass
  ribbon(ctx, 'MAP ROOM', 48, 30);
  const at = trip ? placeOf(trip.mission).name : '';
  const hint = !trip ? (ms.board.length ? 'TAP A PIN TO PLAN A MISSION' : 'NO MISSIONS TODAY: NEW ONES AT DAWN')
    : trip.state === 'muster' ? `MUSTERING FOR ${at}` : trip.state === 'depart' ? `SETTING OUT FOR ${at}`
      : trip.state === 'away' ? `TEAM OUT AT ${at} - HOME IN ${hoursLeft(sim, trip)}H` : `TEAM HOME FROM ${at}`;
  plate(ctx, hint, MAP_RECT.x + MAP_RECT.w - measureText(hint) - 12, 25);
  drawSprite(ctx, COMPASS, 32, 312);
  drawTextOutlined(ctx, 'N', 32, 299, { size: 1, color: '#fff8ee', outline: INK, thickness: 1, align: 'center', shadow: false });
  button(ctx, BACK, 'BACK');
  hits.push({ r: BACK, act: { kind: 'back' }, name: 'back' });
  return hits;
}

// ---------- the mission chooser ----------

/** A counter in words: an element's name (NEEDS: DUSK) or a skill's (NEEDS: CHARM). */
const counterWord = (c: Counter) => (c.element ? c.element.toUpperCase() : SKILL_NAME[c.skill!]);
/** Whether a dragon or a keeper meets a counter. */
const meetsD = (c: Counter, d: Dragon) => !!c.element && d.element === c.element;
const meetsK = (c: Counter, k: Keeper) => !!c.skill && KEEPER_SKILL[k.look] === c.skill;

/**
 * The chooser's line about the egg, under its rewards: the Hatchery full (every nest holds an egg: no egg reward), or
 * the barn at its cap (life.ts BARN_CAP, read through life.ts barnRoom: the egg still comes home and waits in its nest,
 * BASE_DESIGN 5.6); null when neither. The hook's `ui.notice` reads it too.
 */
export type EggNotice = 'HATCHERY FULL: NO EGG' | 'BARN FULL: THE EGG WILL WAIT';
export function eggNotice(sim: CareSim): EggNotice | null {
  return freeNest(sim) == null ? 'HATCHERY FULL: NO EGG' : barnRoom(sim) <= 0 ? 'BARN FULL: THE EGG WILL WAIT' : null;
}

/** The mission the chooser shows (by id: on the board), or null. */
export function chosen(sim: CareSim, ui: MapUi): Mission | null { return sim.missions.board.find((m) => m.id === ui.mission) ?? null; }

/**
 * The chooser (BASE_DESIGN 5). Left: the climate picture (no dragons in it), the title, the region and its climate, the
 * rewards (days, coin, the egg's chance, sure on a first visit, or the Hatchery full), then a row per challenge -- its
 * icon, name and counter, and GOOD: the home dragons and free keepers who meet it (tap one to add it), a tick once the
 * team does -- and the big baddie's row. Right: the team's two pairs (the dragon, its element, stage and mood, its
 * rider's badge -- tap to cycle -- PARTNERS +5 %, and an X to remove), the dragons (a star and the word for what one
 * would meet that nobody on the team does; greyed with the reason one can't go), the odds, BEST TEAM, SEND FROM THE
 * AERIE (greyed with the reason when it can't) and BACK.
 */
export function drawMissionScreen(ctx: CanvasRenderingContext2D, sim: CareSim, ui: MapUi, frame = 0): Hit[] {
  const hits: Hit[] = [], m = chosen(sim, ui);
  panel(ctx);
  if (!m) { text(ctx, 'THIS MISSION IS GONE FROM THE BOARD', 320, 170, INKY, 'center'); button(ctx, BACK, 'BACK'); return [{ r: BACK, act: { kind: 'back' }, name: 'back' }]; }
  const region = regionOf(m.region), pairs = ui.pairs;
  const team = pairs.map((p) => sim.dragons.find((d) => d.id === p.dragon)!), riders = pairs.map((p) => sim.keepers.find((k) => k.id === p.keeper)!);
  // ---- the left column ----
  box(ctx, { x: CLIMATE_RECT.x - 1, y: CLIMATE_RECT.y - 1, w: CLIMATE_RECT.w + 2, h: CLIMATE_RECT.h + 2 }, INK);
  drawClimate(ctx, region.climate, 'day', CLIMATE_RECT);
  // (the place the road leads to, standing in the picture: its landmark, twice its size on the map)
  const place = placeOf(m);
  drawLandmark(ctx, place.art, CLIMATE_RECT.x + CLIMATE_RECT.w - 44, CLIMATE_RECT.y + CLIMATE_RECT.h - 6, 2, frame);
  title(ctx, m.title, 16, 142);
  text(ctx, `${place.name === m.title ? '' : `${place.name}, `}${region.name} - ${region.word}`, 16, 153, FADED);
  const notice = eggNotice(sim), days = `${m.days} DAY${m.days > 1 ? 'S' : ''}`, diff = m.difficulty.toUpperCase();
  if (notice === 'HATCHERY FULL: NO EGG') text(ctx, `${diff} - ${days} - ${m.coin} COIN`, 16, 163, INKY);
  else text(ctx, `${diff} - ${days} - ${m.coin} COIN - ${m.guaranteedEgg ? 'EGG: SURE (FIRST VISIT)' : `EGG ${Math.round(m.eggChance * 100)} %`}`, 16, 163, INKY);
  if (notice) text(ctx, notice, 16, 173, FADED);
  const cov = coverage(sim, m, pairs), home = sim.dragons.filter((d) => !dragonReason(sim, d, m)), freeKs = sim.keepers.filter((k) => freeRider(sim, k));
  let y = 184;
  m.challenges.forEach((c, i) => {
    const ch = CHALLENGES[c], met = cov.challenges[i].length > 0;
    drawSprite(ctx, CHALLENGE_ICONS[c], 21, y + 5);
    text(ctx, ch.name, 30, y + 2, INKY);
    text(ctx, `NEEDS: ${counterWord(ch.counter)}`, 300, y + 2, INKY, 'right');
    if (ch.counter.skill) drawSprite(ctx, SKILL_ICONS[ch.counter.skill], 309, y + 5);
    // GOOD: who at home could meet it -- each name a tap that adds it to the team
    let x = 30 + measureText('GOOD: ');
    text(ctx, 'GOOD:', 30, y + 11, FADED);
    const good: { name: string; act: UiAct }[] = [
      ...home.filter((d) => meetsD(ch.counter, d)).map((d) => ({ name: d.name, act: { kind: 'dragon', dragon: d.id } as UiAct })),
      ...freeKs.filter((k) => meetsK(ch.counter, k)).map((k) => ({ name: k.name, act: { kind: 'rider', keeper: k.id } as UiAct })),
    ];
    if (!good.length) text(ctx, 'NOBODY HOME', x, y + 11, FADED);
    good.forEach((g, n) => {
      const w = measureText(g.name), sep = n ? measureText(' - ') : 0;
      if (x + sep + w > 296) return;
      if (n) text(ctx, '-', x + measureText(' '), y + 11, FADED);
      x += sep;
      text(ctx, g.name, x, y + 11, GOOD);
      hits.push({ r: { x: x - 2, y: y + 9, w: w + 4, h: 11 }, act: g.act });
      x += w;
    });
    if (met) drawSprite(ctx, ICONS.check, 309, y + 15);
    y += 22;
  });
  if (m.baddie) {
    const b = BADDIES[m.baddie];
    drawBaddiePortrait(ctx, m.baddie, 16, y);
    text(ctx, `BIG BADDIE: ${b.name}`, 46, y + 3, INKY);
    text(ctx, `NEEDS ${b.counters.map(counterWord).join(' + ')}`, 46, y + 14, FADED);
    if (cov.baddie) drawSprite(ctx, ICONS.check, 309, y + 15);
  }
  // ---- the right column: the team ----
  text(ctx, 'TEAM', 324, 28, INKY);
  text(ctx, `${pairs.length} OF ${MAX_PAIRS} PAIRS - 2 KEEPERS STAY HOME`, 624, 28, FADED, 'right');
  PAIR_SLOTS.forEach((r, i) => {
    box(ctx, r, i < pairs.length ? '#f6ecd0' : '#e0d0a0');
    if (i >= pairs.length) { text(ctx, i === pairs.length ? 'TAP A DRAGON BELOW' : '', r.x + 150, r.y + 18, FADED, 'center'); return; }
    const d = team[i], k = riders[i];
    box(ctx, { x: r.x + 4, y: r.y + 4, w: 9, h: 9 }, DRAGON_PALETTES[d.element].scale);
    title(ctx, d.name, r.x + 17, r.y + 5);
    text(ctx, `${d.element.toUpperCase()} ${d.stage.toUpperCase()}`, r.x + 17 + measureText(d.name) + 8, r.y + 5, FADED);
    drawSprite(ctx, MOOD_DOT(moodColour(d.mood)), r.x + 268, r.y + 8);
    // (the X: take the pair off the team)
    box(ctx, { x: r.x + r.w - 17, y: r.y + 3, w: 13, h: 13 }, '#8a3a34');
    drawSprite(ctx, REMOVE, r.x + r.w - 10.5, r.y + 9.5);
    hits.push({ r: { x: r.x + r.w - 19, y: r.y + 1, w: 17, h: 17 }, act: { kind: 'remove', pair: i } });
    // the rider's badge (tap to cycle through the free keepers)
    const br = { x: r.x + 4, y: r.y + 23, w: 62, h: 15 };
    box(ctx, br, FACE);
    box(ctx, { x: br.x + 2, y: br.y + 3, w: 7, h: 9 }, KEEPER_PALETTES[k.look].primary);
    text(ctx, k.name, br.x + 12, br.y + 4, TEXT);
    drawSprite(ctx, SKILL_ICONS[KEEPER_SKILL[k.look]], br.x + br.w - 7, br.y + 7.5);
    hits.push({ r: br, act: { kind: 'cycle', pair: i } });
    text(ctx, `RIDES - ${SKILL_NAME[KEEPER_SKILL[k.look]]}`, br.x + br.w + 6, br.y + 4, INKY);
    if (partnerOf(sim, d)?.id === k.id) text(ctx, 'PARTNERS +5 %', r.x + r.w - 6, br.y + 4, GOOD, 'right');
  });
  // ---- the dragons ----
  const listed = [...sim.dragons.filter((d) => !dragonReason(sim, d, m)), ...sim.dragons.filter((d) => dragonReason(sim, d, m))].slice(0, GRID.cols * GRID.rows);
  const unmet = m.challenges.filter((_, i) => !cov.challenges[i].length);
  listed.forEach((d, i) => {
    const r = { x: GRID.x + (i % GRID.cols) * GRID.dx, y: GRID.y + Math.floor(i / GRID.cols) * GRID.dy, w: GRID.w, h: GRID.h };
    const why = dragonReason(sim, d, m), on = pairs.some((p) => p.dragon === d.id);
    const star = !why && !on ? unmet.find((c) => meetsD(CHALLENGES[c].counter, d)) : undefined;
    box(ctx, r, why ? '#5a5054' : on ? ACTIVE : FACE);
    text(ctx, `${star ? '★' : ''}${d.name}`, r.x + 3, r.y + 2, why ? OFF : TEXT);
    text(ctx, why ?? (on ? 'ON THE TEAM' : star ? CHALLENGES[star].word : d.stage.toUpperCase()), r.x + 3, r.y + 10, why ? OFF : star ? FLAG : OFF);
    if (!why) hits.push({ r, act: { kind: 'dragon', dragon: d.id } });
  });
  // ---- the odds and the buttons ----
  const odds = oddsOf(sim, m, pairs), segs = Math.round(odds * 10);
  box(ctx, ODDS_BAR, INK);
  for (let i = 0; i < 10; i++) rect(ctx, { x: ODDS_BAR.x + 1 + i * 15, y: ODDS_BAR.y + 1, w: 14, h: ODDS_BAR.h - 2 }, i < segs ? (odds >= 0.5 ? GOOD : '#e3b23e') : '#5a5054');
  text(ctx, `ODDS ${Math.round(odds * 100)} %`, ODDS_BAR.x + ODDS_BAR.w + 8, ODDS_BAR.y + 2, INKY);
  button(ctx, BEST, 'BEST TEAM');
  hits.push({ r: BEST, act: { kind: 'best' }, name: 'best' });
  const why = canSend(sim, m, pairs);
  button(ctx, SEND, why ?? 'SEND FROM THE AERIE', !why, !why);
  hits.push({ r: SEND, act: { kind: 'send' }, name: 'send' });
  button(ctx, BACK, 'BACK');
  hits.push({ r: BACK, act: { kind: 'back' }, name: 'back' });
  return hits;
}

/**
 * A tap on the chooser's team (base.ts applies the rest): a dragon added (with its auto rider) or, already on the team,
 * taken off; a keeper made the rider of the last pair; a pair's rider cycled to the next free keeper; a pair removed.
 * Returns what the view says of it (a toast), if anything: a keeper tapped with no dragon on the team yet, or one who
 * can't ride now, says so; one made a rider says whose.
 */
export function editTeam(sim: CareSim, ui: MapUi, act: UiAct): string | null {
  const m = chosen(sim, ui);
  if (!m) return null;
  const pairs = ui.pairs;
  if (act.kind === 'dragon') {
    const at = pairs.findIndex((p) => p.dragon === act.dragon), d = sim.dragons.find((q) => q.id === act.dragon);
    if (at >= 0) { pairs.splice(at, 1); return null; }
    if (!d || dragonReason(sim, d, m) || pairs.length >= MAX_PAIRS) return null;
    const k = autoRider(sim, d, m, pairs);
    if (k != null) pairs.push({ dragon: d.id, keeper: k });
  } else if (act.kind === 'rider') {
    const k = sim.keepers.find((q) => q.id === act.keeper);
    if (!k) return null;
    if (!pairs.length) return `PICK A DRAGON FIRST, THEN ${k.name} CAN RIDE`;
    if (!freeRider(sim, k)) return `${k.name} CAN'T RIDE NOW`;
    const last = pairs[pairs.length - 1], rides = (p: { dragon: number }) => `${k.name} RIDES ${sim.dragons.find((q) => q.id === p.dragon)?.name ?? 'WITH THE TEAM'}`;
    const already = pairs.find((p) => p.keeper === k.id);
    if (already) return rides(already);
    last.keeper = k.id;
    return rides(last);
  } else if (act.kind === 'cycle') {
    const p = pairs[act.pair];
    if (!p) return null;
    const ids = sim.keepers.filter((k) => freeRider(sim, k) && !pairs.some((q) => q !== p && q.keeper === k.id)).map((k) => k.id);
    if (ids.length) p.keeper = ids[(ids.indexOf(p.keeper) + 1) % ids.length];
  } else if (act.kind === 'remove') pairs.splice(act.pair, 1);
  else if (act.kind === 'best') ui.pairs = bestTeam(sim, m);
  return null;
}

// ---------- the team out ----------

/**
 * The chip's words: MUSTER, TEAM OUT - 14H (game hours to go); landed, LANDING while a dragon of the team is still
 * coming onto the deck, EGG TO THE NEST while its rider carries the egg down to the Hatchery, then HOME (the riders
 * hanging their saddles up, until the trip is over).
 */
export function chipText(sim: CareSim, t: Trip): string {
  if (t.state === 'muster') return 'MUSTER';
  if (t.state === 'return' || t.state === 'home') {
    if (t.pairs.some((p) => sim.dragons.find((d) => d.id === p.dragon)?.goal === 'muster')) return 'LANDING';
    return t.pairs.some((p) => sim.keepers.find((k) => k.id === p.keeper)?.carrying === 'egg') ? 'EGG TO THE NEST' : 'HOME';
  }
  return `TEAM OUT - ${t.state === 'away' ? hoursLeft(sim, t) : t.mission.days * 24}H`;
}
/** The TEAM OUT chip (a trip is out): its box, the team's flag and its words; returns its tap rect. */
export function drawTeamChip(ctx: CanvasRenderingContext2D, sim: CareSim, t: Trip, open: boolean): Rect {
  box(ctx, CHIP, open ? ACTIVE : FACE);
  drawSprite(ctx, FLAG_SPRITE, CHIP.x + 7, CHIP.y + 7.5);
  text(ctx, chipText(sim, t), CHIP.x + CHIP.w / 2 + 5, CHIP.y + 4, TEXT, 'center');
  return CHIP;
}

/** How far along the road a trip is (0 at the muster, 1 once it lands). */
export function tripProgress(sim: CareSim, t: Trip): number {
  if (t.state === 'muster' || t.state === 'depart' || t.departAt == null || t.returnAt == null) return 0;
  if (t.state !== 'away') return 1;
  return Math.max(0, Math.min(1, (sim.clock - t.departAt) / (t.returnAt - t.departAt)));
}
/**
 * Where each stop is at the world's clock (or `clock`): reached and met, reached and unmet (waited out), or not reached
 * yet -- the team reaches every one, a trip that fails too -- each told only once the scene has shown how it went
 * (missionview.ts stopShownAt: the banner's moment, the scene being the timer), so the card never tells a stop before
 * the scene does; and never the trip's outcome, which is the result card's, at the road's end.
 */
export function stopStates(sim: CareSim, t: Trip, clock = sim.clock): ('met' | 'unmet' | 'ahead')[] {
  const E = t.state === 'muster' || t.state === 'depart' || t.departAt == null ? -1 : t.state === 'away' ? clock - t.departAt : Infinity;
  const at = stopShownAt(sim, t);
  return t.stops.map((s, i) => (E < at[i] ? 'ahead' : s.covered ? 'met' : 'unmet'));
}

/** The words fitted to a width (cut on a space), as lines. */
function wrap(s: string, w: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of s.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (measureText(next) > w && line) { out.push(line); line = word; } else line = next;
  }
  if (line) out.push(line);
  return out;
}

/** The TRIP LOG button over the watch overlay (lit while the log is open). */
export function drawLogButton(ctx: CanvasRenderingContext2D, open: boolean): void { button(ctx, LOG_BUTTON, 'TRIP LOG', true, open); }

/**
 * The trip's log (over the watch overlay, opened by its TRIP LOG button: BASE_DESIGN 6): the mission and its region, each stop (its icon and name, a tick
 * met, a cross unmet, a mark still ahead), the trip log's latest lines, and the time left.
 */
export function drawTripCard(ctx: CanvasRenderingContext2D, sim: CareSim, t: Trip): void {
  const { x, y, w, h } = TRIP_CARD;
  box(ctx, TRIP_CARD, FACE);
  title(ctx, t.mission.title, x + 6, y + 5);
  text(ctx, regionOf(t.mission.region).name, x + w - 6, y + 5, OFF, 'right');
  const st = stopStates(sim, t);
  t.stops.forEach((s, i) => {
    const ly = y + 18 + i * 11;
    const icon = s.kind === 'baddie' ? null : CHALLENGE_ICONS[s.challenge!];
    if (icon) drawSprite(ctx, icon, x + 11, ly + 3.5); else drawBaddiePortraitSmall(ctx, x + 7, ly - 1);
    text(ctx, s.kind === 'baddie' ? BADDIES[s.baddie!].name : CHALLENGES[s.challenge!].name, x + 20, ly, TEXT);
    drawSprite(ctx, st[i] === 'met' ? ICONS.check : st[i] === 'unmet' ? CROSS : PENDING, x + 150, ly + 3.5);
  });
  // the log's latest lines (the stops reached), wrapped to the card
  const seen = t.stops.filter((_, i) => st[i] !== 'ahead').map((s) => s.log);
  const lines = seen.slice(-2).flatMap((l) => wrap(l, w - 12)).slice(-3);
  lines.forEach((l, i) => text(ctx, l, x + 6, y + 76 + i * 10, '#e8d8a8'));
  const left = t.state === 'muster' ? 'MUSTERING ON THE AERIE' : t.state === 'depart' ? 'LEAVING OVER THE SKY BRIDGE'
    : t.state === 'away' ? `HOME IN ${hoursLeft(sim, t)} HOURS` : 'LANDING ON THE AERIE';
  text(ctx, left, x + 6, y + h - 11, FLAG);
  text(ctx, `${t.pairs.length} PAIR${t.pairs.length > 1 ? 'S' : ''} - ODDS ${Math.round(t.odds * 100)} %`, x + w - 6, y + h - 11, OFF, 'right');
}
/** The baddie's mark on the card's line: a small inked crown. */
function drawBaddiePortraitSmall(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  drawSprite(ctx, CROWN, x + 4, y + 4.5);
}

/** A tap on an overlay: the hit under it (the last drawn first), or none (the overlay swallows the tap). */
export function hitAt(hits: readonly Hit[], sx: number, sy: number): UiAct {
  for (let i = hits.length - 1; i >= 0; i--) {
    const h = hits[i];
    if (hit(h.r, sx, sy) && (!h.test || h.test(sx, sy))) return h.act;
  }
  return { kind: 'none' };
}

/** Whether a keeper is on a trip (for the badges): re-exported for the view. */
export { onTrip };
