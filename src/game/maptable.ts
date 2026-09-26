// The Map Room's table (docs/BASE_DESIGN.md 5; plan S8): the two overlays a mission is chosen and sent from -- the
// world map (the regions explored and the fog over the rest, the roads, HOME, a numbered pin per mission on the board,
// the team's flag) and the mission chooser (the region's climate picture, the mission's rewards, its challenges with
// what meets them and who at home could, the big baddie, the team's pairs and riders, the eligible dragons, the odds,
// BEST TEAM and SEND FROM THE AERIE) -- and, while a team is out, its TEAM OUT chip under the top bar (a tap opens the
// watchable scene: plan S9, missionview.ts) and the trip's log, opened over the scene by its TRIP LOG button (each stop
// met, unmet or still ahead, the log so far, the time left). Drawing and hit rects only, at the view's 640 x 360:
// base.ts owns what a tap does (tableTap, watchTap), and
// missions.ts every rule. House style: 1 px ink outlines, flat fills, the engine's 5 x 7 font (it has no tick, cross or
// arrow glyphs: those are small inked sprites), no alpha anywhere -- the fog over an unexplored region is hatched, not
// faded. The mission art (the climate picture, the challenge and skill icons, the baddie's portrait) comes through the
// art seam (artseams.ts: plan S9a's kit).
import { drawText, drawTextOutlined, measureText } from '../lib/engine/text.ts';
import { makeTones } from '../lib/art/shading.ts';
import { drawSprite, ICONS, hit } from './icons.ts';
import type { Rect, Sprite } from './icons.ts';
import { drawClimate, drawBaddiePortrait, CHALLENGE_ICONS, SKILL_ICONS } from './artseams.ts';
import { barnRoom } from './seams.ts';
import { stopShownAt } from './missionview.ts';
import { INK } from './surfaces.ts';
import { REGIONS, CHALLENGES, BADDIES, KEEPER_SKILL, SKILL_NAME, MAP_HOME, MAP_FILL, regionOf } from './regions.ts';
import type { Counter } from './regions.ts';
import {
  bestTeam, oddsOf, canSend, coverage, dragonReason, freeRider, autoRider, partnerOf, freeNest, hoursLeft, onTrip, MAX_PAIRS,
} from './missions.ts';
import type { Mission, Pair, Trip } from './trip.ts';
import type { CareSim, Dragon, Keeper } from './sim.ts';
import { KEEPER_PALETTES } from '../art/keeper/palettes.ts';
import { DRAGON_PALETTES } from '../art/dragon/palettes.ts';

/** Which overlay is open: none, the map, a mission's chooser, or (plan S9's) the team out watched on its road. */
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
  | { kind: 'none' };
/** A tap target drawn this frame (screen px), with its name for the page's hook (a pin, BACK, BEST TEAM, SEND). */
export interface Hit { r: Rect; act: UiAct; name?: string }

/** The overlay's panel (plan S8), BACK's button, and the mission chooser's columns and buttons. */
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
 * The TEAM OUT chip under the top bar (a tap opens the watch overlay): plan 3.11 put it at the right, x 520, but there
 * it covered the Lamp Dorm's plate at the start camera (the upper floor's plates sit just under the bar there, and the
 * dorm's starts at screen x 513); at x 394 it sits over the lift shaft's and the ladder bay's tops, where no plate or
 * window is, still clear of the buttons over it and of the canvas point (350, 200) (G9). And over the watch overlay,
 * the trip's log (plan S8's progress card: under the scene's banner line, clear of the team's heads and the baddie's)
 * and its TRIP LOG button, beside BACK TO BARN (missionview.ts BACK_BUTTON, x 8-118).
 */
export const CHIP: Readonly<Rect> = Object.freeze({ x: 394, y: 19, w: 114, h: 15 });
export const TRIP_CARD: Readonly<Rect> = Object.freeze({ x: 8, y: 34, w: 300, h: 120 });
export const LOG_BUTTON: Readonly<Rect> = Object.freeze({ x: 124, y: 338, w: 64, h: 16 });

// ---------- colours ----------

const PARCHMENT = '#e8d8a8', BORDER = '#8a6a4a', FOG = '#d8c898', HATCH = '#c0ae80', INKY = '#4a3428', FADED = '#8a7a64';
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
/** HOME on the map: the barn, 13 x 11. */
const HOME: Sprite = {
  rows: ['......r......', '.....rrr.....', '....rrrrr....', '...rrrrrrr...', '..rrrrrrrrr..', '.rrrrrrrrrrr.', 'rrrrrrrrrrrrr', '.bbbbbbbbbbb.', '.bbbwwwwwbbb.', '.bbbw.w.wbbb.', '.bbbwwwwwbbb.'],
  colors: { r: '#a0483a', b: '#c8784a', w: '#f3e6c8' },
};

/** A mood's colour (the chooser's mood dot): good, so-so, low. */
const moodColour = (m: number) => (m >= 0.5 ? '#7bbf6a' : m >= 0 ? '#e3b23e' : '#d8402e');
const MOOD_DOT = (c: string): Sprite => ({ rows: ['.mm.', 'mmmm', 'mmmm', '.mm.'], colors: { m: c } });

// ---------- the map ----------

/**
 * A polygon rasterised as pixel art: a mask over its bounding box of the pixels whose centre lies inside it (even-odd),
 * so a land is whole pixels with no anti-aliased edge (G6: flat fills), and its ink is the mask's own edge.
 */
interface Mask { x0: number; y0: number; w: number; h: number; in: Uint8Array }
function rasterise(pts: readonly number[]): Mask {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < pts.length; i += 2) { x0 = Math.min(x0, pts[i]); x1 = Math.max(x1, pts[i]); y0 = Math.min(y0, pts[i + 1]); y1 = Math.max(y1, pts[i + 1]); }
  x0 = Math.floor(x0); y0 = Math.floor(y0);
  const w = Math.ceil(x1) - x0 + 1, h = Math.ceil(y1) - y0 + 1, m: Mask = { x0, y0, w, h, in: new Uint8Array(w * h) }, n = pts.length;
  for (let r = 0; r < h; r++) {
    const yc = y0 + r + 0.5, xs: number[] = [];
    for (let i = 0; i < n; i += 2) {
      const ax = pts[i], ay = pts[i + 1], bx = pts[(i + 2) % n], by = pts[(i + 3) % n];
      if ((ay <= yc) !== (by <= yc)) xs.push(ax + ((yc - ay) * (bx - ax)) / (by - ay));
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.ceil(xs[i] - 0.5); x < Math.ceil(xs[i + 1] - 0.5); x++) m.in[r * w + x - x0] = 1;
  }
  return m;
}
/**
 * Paint a mask row by row in runs of one colour: a pixel on its edge (a 4-neighbour outside) is 1 px ink, the rest
 * `fill(x, y)`'s colour.
 */
function paintMask(ctx: CanvasRenderingContext2D, m: Mask, fill: (x: number, y: number) => string): void {
  const at = (c: number, r: number) => c >= 0 && r >= 0 && c < m.w && r < m.h && m.in[r * m.w + c] === 1;
  for (let r = 0; r < m.h; r++) {
    let run: string | null = null, from = 0;
    for (let c = 0; c <= m.w; c++) {
      const col = c < m.w && at(c, r) ? (at(c - 1, r) && at(c + 1, r) && at(c, r - 1) && at(c, r + 1) ? fill(m.x0 + c, m.y0 + r) : INK) : null;
      if (col === run) continue;
      if (run) { ctx.fillStyle = run; ctx.fillRect(m.x0 + from, m.y0 + r, c - from, 1); }
      run = col; from = c;
    }
  }
}
/** A region's land: a flat 2-band cel (its climate's fill, the lower third its shadow tone), inked. */
function landFill(ctx: CanvasRenderingContext2D, pts: readonly number[], c: string): void {
  let y0 = Infinity, y1 = -Infinity;
  for (let i = 1; i < pts.length; i += 2) { y0 = Math.min(y0, pts[i]); y1 = Math.max(y1, pts[i]); }
  const band = Math.round(y0 + (y1 - y0) * 0.68), sh = makeTones(c).sh;
  paintMask(ctx, rasterise(pts), (_x, y) => (y >= band ? sh : c));
}
/** An unexplored region: plain fog, hatched with 2 px diagonals every 6 px (no alpha: the fog never fades), inked, a "?". */
function fogFill(ctx: CanvasRenderingContext2D, pts: readonly number[], pin: readonly [number, number]): void {
  paintMask(ctx, rasterise(pts), (x, y) => ((((x + y) % 6) + 6) % 6 < 2 ? HATCH : FOG));
  drawTextOutlined(ctx, '?', pin[0], pin[1] - 3, { size: 1, color: '#f3e6c8', outline: INK, thickness: 1, align: 'center', shadow: false });
}
/** A dotted road: 2 x 2 dots every 6 px from a to b, clear of both ends by `pad`. */
function road(ctx: CanvasRenderingContext2D, a: readonly [number, number], b: readonly [number, number], pad = 10): void {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
  ctx.fillStyle = BORDER;
  for (let s = pad; s <= len - pad; s += 6) ctx.fillRect(Math.round(a[0] + (dx * s) / len) - 1, Math.round(a[1] + (dy * s) / len) - 1, 2, 2);
}
/** A mission's pin (9 x 11: a numbered inked head on a short stalk), its point at (x, y); returns its tap rect. */
function pin(ctx: CanvasRenderingContext2D, n: number, x: number, y: number): Rect {
  rect(ctx, { x: x - 1, y: y - 3, w: 3, h: 4 }, INK); rect(ctx, { x, y: y - 3, w: 1, h: 3 }, '#6b4a34');
  box(ctx, { x: x - 5, y: y - 14, w: 11, h: 11 }, PIN);
  text(ctx, String(n), x - 2, y - 12, '#fff8ee');
  return { x: x - 9, y: y - 18, w: 19, h: 22 };
}

/**
 * The map screen (plan S8): the panel, MAP ROOM, the regions (explored ones in their climate's colours and named, the
 * rest in hatched fog with a "?"), the roads between neighbours and from HOME to the start regions, a numbered pin per
 * mission on the board (at its region), the team's flag at the region it is out in, and BACK. Returns the tap targets.
 */
export function drawMapScreen(ctx: CanvasRenderingContext2D, sim: CareSim): Hit[] {
  const ms = sim.missions, hits: Hit[] = [];
  panel(ctx);
  title(ctx, 'MAP ROOM', 18, 25);
  text(ctx, ms.board.length ? 'TAP A PIN' : 'NO MISSIONS TODAY: NEW ONES AT DAWN', 620, 25, INKY, 'right');
  for (const r of REGIONS) {
    if (ms.explored.includes(r.id)) landFill(ctx, r.map.poly, MAP_FILL[r.climate]);
    else fogFill(ctx, r.map.poly, r.map.pin);
  }
  // (roads: between neighbours, and from HOME to the start regions)
  for (const r of REGIONS) for (const n of r.neighbours) if (r.id < n) road(ctx, r.map.pin, regionOf(n).map.pin, 14);
  for (const r of REGIONS) if (r.start) road(ctx, MAP_HOME, r.map.pin, 14);
  drawSprite(ctx, HOME, MAP_HOME[0], MAP_HOME[1]);
  text(ctx, 'HOME', MAP_HOME[0], MAP_HOME[1] + 9, INKY, 'center');
  for (const r of REGIONS) if (ms.explored.includes(r.id)) drawTextOutlined(ctx, r.name, r.map.pin[0], r.map.pin[1] + 6, { size: 1, color: '#fff8ee', outline: INK, thickness: 1, align: 'center', shadow: false });
  const t = ms.trip;
  if (t) { const p = regionOf(t.mission.region).map.pin; drawSprite(ctx, FLAG_SPRITE, p[0] + 14, p[1] - 10); }
  ms.board.forEach((m, i) => {
    const p = regionOf(m.region).map.pin;
    hits.push({ r: pin(ctx, i + 1, p[0], p[1]), act: { kind: 'pin', mission: m.id }, name: `pin${i}` });
  });
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

/** The mission the chooser shows (by id: on the board), or null. */
export function chosen(sim: CareSim, ui: MapUi): Mission | null { return sim.missions.board.find((m) => m.id === ui.mission) ?? null; }

/**
 * The chooser (plan S8). Left: the climate picture (no dragons in it), the title, the region and its climate, the
 * rewards (days, coin, the egg's chance, sure on a first visit, or the Hatchery full), then a row per challenge -- its
 * icon, name and counter, and GOOD: the home dragons and free keepers who meet it (tap one to add it), a tick once the
 * team does -- and the big baddie's row. Right: the team's two pairs (the dragon, its element, stage and mood, its
 * rider's badge -- tap to cycle -- PARTNERS +5 %, and an X to remove), the dragons (a star and the word for what one
 * would meet that nobody on the team does; greyed with the reason one can't go), the odds, BEST TEAM, SEND FROM THE
 * AERIE (greyed with the reason when it can't) and BACK.
 */
export function drawMissionScreen(ctx: CanvasRenderingContext2D, sim: CareSim, ui: MapUi): Hit[] {
  const hits: Hit[] = [], m = chosen(sim, ui);
  panel(ctx);
  if (!m) { text(ctx, 'THIS MISSION IS GONE FROM THE BOARD', 320, 170, INKY, 'center'); button(ctx, BACK, 'BACK'); return [{ r: BACK, act: { kind: 'back' }, name: 'back' }]; }
  const region = regionOf(m.region), pairs = ui.pairs;
  const team = pairs.map((p) => sim.dragons.find((d) => d.id === p.dragon)!), riders = pairs.map((p) => sim.keepers.find((k) => k.id === p.keeper)!);
  // ---- the left column ----
  box(ctx, { x: CLIMATE_RECT.x - 1, y: CLIMATE_RECT.y - 1, w: CLIMATE_RECT.w + 2, h: CLIMATE_RECT.h + 2 }, INK);
  drawClimate(ctx, region.climate, 'day', CLIMATE_RECT);
  title(ctx, m.title, 16, 142);
  text(ctx, `${region.name} - ${region.word}`, 16, 153, FADED);
  const nest = freeNest(sim), days = `${m.days} DAY${m.days > 1 ? 'S' : ''}`, diff = m.difficulty.toUpperCase();
  if (nest == null) { text(ctx, `${diff} - ${days} - ${m.coin} COIN`, 16, 163, INKY); text(ctx, 'HATCHERY FULL: NO EGG', 16, 173, FADED); }
  else {
    text(ctx, `${diff} - ${days} - ${m.coin} COIN - ${m.guaranteedEgg ? 'EGG: SURE (FIRST VISIT)' : `EGG ${Math.round(m.eggChance * 100)} %`}`, 16, 163, INKY);
    if (barnRoom(sim) <= 0) text(ctx, 'BARN FULL: THE EGG WILL WAIT', 16, 173, FADED);
  }
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
 */
export function editTeam(sim: CareSim, ui: MapUi, act: UiAct): void {
  const m = chosen(sim, ui);
  if (!m) return;
  const pairs = ui.pairs;
  if (act.kind === 'dragon') {
    const at = pairs.findIndex((p) => p.dragon === act.dragon), d = sim.dragons.find((q) => q.id === act.dragon);
    if (at >= 0) { pairs.splice(at, 1); return; }
    if (!d || dragonReason(sim, d, m) || pairs.length >= MAX_PAIRS) return;
    const k = autoRider(sim, d, m, pairs);
    if (k != null) pairs.push({ dragon: d.id, keeper: k });
  } else if (act.kind === 'rider') {
    const k = sim.keepers.find((q) => q.id === act.keeper);
    if (!pairs.length || !k || !freeRider(sim, k) || pairs.some((p) => p.keeper === k.id)) return;
    pairs[pairs.length - 1].keeper = k.id;
  } else if (act.kind === 'cycle') {
    const p = pairs[act.pair];
    if (!p) return;
    const ids = sim.keepers.filter((k) => freeRider(sim, k) && !pairs.some((q) => q !== p && q.keeper === k.id)).map((k) => k.id);
    if (ids.length) p.keeper = ids[(ids.indexOf(p.keeper) + 1) % ids.length];
  } else if (act.kind === 'remove') pairs.splice(act.pair, 1);
  else if (act.kind === 'best') ui.pairs = bestTeam(sim, m);
}

// ---------- the team out ----------

/** The chip's words: MUSTER, TEAM OUT - 14H (game hours to go), or LANDING. */
export function chipText(sim: CareSim, t: Trip): string {
  if (t.state === 'muster') return 'MUSTER';
  if (t.state === 'return' || t.state === 'home') return 'LANDING';
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
 * Where each stop is at the world's clock (or `clock`): reached and met, reached and unmet, not reached yet, or never
 * (past the turn-back) -- each told
 * only once the scene has shown how it went (missionview.ts stopShownAt: the banner's moment, the scene being the
 * timer), and the stops past the turn-back only once the turn-back stop's has, so the card never tells a stop, or a
 * failure, before the scene does.
 */
export function stopStates(sim: CareSim, t: Trip, clock = sim.clock): ('met' | 'unmet' | 'ahead' | 'never')[] {
  const E = t.state === 'muster' || t.state === 'depart' || t.departAt == null ? -1 : t.state === 'away' ? clock - t.departAt : Infinity;
  const at = stopShownAt(sim, t), shown = (i: number) => E >= at[i], turned = t.turnBack != null && shown(t.turnBack);
  return t.stops.map((s, i) => (turned && i > t.turnBack! ? 'never' : shown(i) ? (s.covered ? 'met' : 'unmet') : 'ahead'));
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
 * The trip's log (plan S8's progress card, over the watch overlay: plan S9's scene took the chip's tap, and the log
 * opens from it): the mission and its region, each stop (its icon and name, a tick
 * met, a cross unmet, a mark still ahead, a dash past the turn-back), the trip log's latest lines, and the time left.
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
    text(ctx, s.kind === 'baddie' ? BADDIES[s.baddie!].name : CHALLENGES[s.challenge!].name, x + 20, ly, st[i] === 'never' ? OFF : TEXT);
    const mark = st[i] === 'met' ? ICONS.check : st[i] === 'unmet' ? CROSS : st[i] === 'ahead' ? PENDING : null;
    if (mark) drawSprite(ctx, mark, x + 150, ly + 3.5); else text(ctx, '-', x + 148, ly, OFF);
  });
  // the log's latest lines (the stops reached), wrapped to the card
  const seen = t.stops.filter((_, i) => st[i] === 'met' || st[i] === 'unmet').map((s) => s.log);
  const lines = seen.slice(-2).flatMap((l) => wrap(l, w - 12)).slice(-3);
  lines.forEach((l, i) => text(ctx, l, x + 6, y + 76 + i * 10, '#e8d8a8'));
  const left = t.state === 'muster' ? 'MUSTERING ON THE AERIE' : t.state === 'depart' ? 'LEAVING OVER THE SKY BRIDGE'
    : t.state === 'away' ? `HOME IN ${hoursLeft(sim, t)} HOURS` : 'LANDING ON THE AERIE';
  text(ctx, left, x + 6, y + h - 11, FLAG);
  text(ctx, `${t.pairs.length} PAIR${t.pairs.length > 1 ? 'S' : ''} - ODDS ${Math.round(t.odds * 100)} %`, x + w - 6, y + h - 11, OFF, 'right');
}
/** The baddie's mark on the card's line: a small inked crown. */
function drawBaddiePortraitSmall(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  drawSprite(ctx, { rows: ['c.c.c', 'ccccc', 'ccccc'], colors: { c: FLAG } }, x + 4, y + 4.5);
}

/** A tap on an overlay: the hit under it (the last drawn first), or none (the overlay swallows the tap). */
export function hitAt(hits: readonly Hit[], sx: number, sy: number): UiAct {
  for (let i = hits.length - 1; i >= 0; i--) if (hit(hits[i].r, sx, sy)) return hits[i].act;
  return { kind: 'none' };
}

/** Whether a keeper is on a trip (for the badges): re-exported for the view. */
export { onTrip };
