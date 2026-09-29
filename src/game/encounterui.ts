// The encounter's screen (docs/BASE_DESIGN.md 11): the furniture drawn over the watchable scene while the team stands at
// a stop -- a plate for each pair (its dragon's name and level, its puff as a bar, its stats' stages), the stop's plate
// (an obstacle's mark to beat and the try it is on, its tries left as a bar; a baddie's puff, as a bar), the pick menu
// while a pair's pick waits (each ability it has here: its name, what it is, and how it lands at this stop -- at an
// obstacle its roll's bonus and its chance, `ROLL + 22` and `95 %: STRONG ON THE FLOOD!`, `50 %: HELPS`, `CHARMS THE
// MILLER`; +8 PUFF; the rider's special), THE TRAIL COACH PICKS with AUTO on, AUTO itself, and the popups over the
// heads as moves land (-9, +8, GUARD UP, POWER DOWN, DODGED!, PASSED! or NOT QUITE with the score against the mark
// over the obstacle). The scene's own banner carries the encounter's latest line. Drawing and hit rects only, at the view's 640 x 360: base.ts owns what a tap does, and
// encounter.ts every rule. House style: 1 px ink outlines, flat fills, the engine's 5 x 7 font, no alpha (the Arena's:
// arenaui.ts), the whole of it in the sky over the road, so it never covers a dragon, a rider or the baddie.
import { drawText, drawTextOutlined, measureText } from '../lib/engine/text.ts';
import type { Rect } from './icons.ts';
import { INK } from './surfaces.ts';
import { DRAGON_PALETTES } from '../art/dragon/palettes.ts';
import { BADDIES, CHALLENGES } from './regions.ts';
import type { CareSim } from './sim.ts';
import type { Trip } from './trip.ts';
import type { Hit } from './maptable.ts';
import type { SceneFrame, ScenePets } from './missionview.ts';
import { baddieHead, pieceAt } from './missionview.ts';
import { partyOf, offersFor, pendingPair, popupOf, stopName, tryOf, FOE, FACE_FRAMES, ABILITY_NAME, MAX_OBSTACLE_TURNS } from './encounter.ts';
import type { Encounter, Offer } from './encounter.ts';

// ---------- where things are (screen px) ----------

/** The pairs' plates at the left under the top bar, the stop's plate at the right, the menu between them: all in the sky over the road (the heads stand at y 230 and below). */
export const PAIR_PLATES: readonly Readonly<Rect>[] = Object.freeze([{ x: 8, y: 38, w: 108, h: 34 }, { x: 8, y: 76, w: 108, h: 34 }]);
export const STOP_PLATE: Readonly<Rect> = Object.freeze({ x: 524, y: 38, w: 108, h: 34 });
export const MENU: Readonly<Rect> = Object.freeze({ x: 120, y: 38, w: 400, h: 124 });
/** The menu's rows: one an ability, seven at most (a fight at LV 4 and up: the breath, the big breath, the show-off, PREEN, YAWN, REST and the rider's special). */
export const ROW_H = 15, ROW_Y0 = 16, MAX_ROWS = 7;
/** AUTO (the trail coach), beside TRIP LOG (maptable.ts LOG_BUTTON, x 8-72) at the bottom left, clear of the follow line at the right (maptable.ts FOLLOW_LINE_X1). */
export const TRAIL_AUTO: Readonly<Rect> = Object.freeze({ x: 78, y: 338, w: 64, h: 16 });
/** Where a row's middle column starts (the longest name, IRIS: NAVIGATOR, ends short of it). */
const WHAT_X = 120;
/** What the menu's place says with AUTO on. */
export const COACH_NOTICE = 'THE TRAIL COACH PICKS: TAP AUTO TO PICK YOURSELF';
/** How long a landed move's popup shows over a head (steps: encounter.ts FACE_FRAMES and a little). */
export const POP_FRAMES = FACE_FRAMES + 12;

// ---------- colours (the Map Room's and the Arena's) ----------

const PARCHMENT = '#e8d8a8', BORDER = '#8a6a4a', INKY = '#4a3428', FADED = '#8a7a64';
const FACE = '#3a2e34', ACTIVE = '#6b4a34', TEXT = '#f3e6c8', OFF = '#a89c88', GOOD = '#8fd07a', BAD = '#e87a64', FLAG = '#f2c14e', BAR_OFF = '#5a5054';
/** The puff bar's colour by the share left: plenty, getting low, nearly out; an obstacle's tries bar. */
const puffColour = (share: number) => (share > 0.5 ? '#7bbf6a' : share > 0.2 ? '#e3b23e' : '#d8402e');
const TRIES = '#8ecaf0';

// ---------- the pen ----------

const text = (ctx: CanvasRenderingContext2D, s: string, x: number, y: number, color = INKY, align: 'left' | 'right' | 'center' = 'left') =>
  drawText(ctx, s, Math.round(x), Math.round(y), { color, align, shadow: false });
const title = (ctx: CanvasRenderingContext2D, s: string, x: number, y: number, align: 'left' | 'right' | 'center' = 'left') =>
  drawTextOutlined(ctx, s, Math.round(x), Math.round(y), { size: 1, color: TEXT, outline: INK, thickness: 1, align, shadow: false });
function rect(ctx: CanvasRenderingContext2D, r: Rect, c: string): void { ctx.fillStyle = c; ctx.fillRect(Math.round(r.x), Math.round(r.y), Math.round(r.w), Math.round(r.h)); }
function box(ctx: CanvasRenderingContext2D, r: Rect, c: string): void { rect(ctx, r, INK); rect(ctx, { x: r.x + 1, y: r.y + 1, w: r.w - 2, h: r.h - 2 }, c); }
function button(ctx: CanvasRenderingContext2D, r: Rect, label: string, on = true, active = false): void {
  box(ctx, r, active ? ACTIVE : FACE);
  text(ctx, label, r.x + r.w / 2, r.y + Math.round((r.h - 7) / 2), on ? TEXT : OFF, 'center');
}
/** A bar of `w` px, `share` of it filled in `c`, in an ink frame. */
function bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, share: number, c: string): void {
  box(ctx, { x, y, w, h }, BAR_OFF);
  const f = Math.round((w - 2) * Math.max(0, Math.min(1, share)));
  if (f > 0) rect(ctx, { x: x + 1, y: y + 1, w: f, h: h - 2 }, c);
}

// ---------- the plates ----------

/** A pair's plate: its dragon's name (its element's chip) and level, YOU, its puff as a bar with the numbers, its stages this stop. */
function pairPlate(ctx: CanvasRenderingContext2D, sim: CareSim, trip: Trip, enc: Encounter, i: number): void {
  const r = PAIR_PLATES[i], d = sim.dragons.find((q) => q.id === trip.pairs[i].dragon);
  if (!r || !d) return;
  box(ctx, r, FACE);
  box(ctx, { x: r.x + 4, y: r.y + 4, w: 9, h: 9 }, DRAGON_PALETTES[d.element].scale);
  title(ctx, d.name, r.x + 16, r.y + 5);
  const whole = trip.stats[i].puff, puff = trip.puff[i], share = whole ? puff / whole : 0;
  bar(ctx, r.x + 4, r.y + 16, 100, 7, share, puffColour(share));
  const stages = ([['POW', enc.power[i]], ['GRD', enc.guard[i]]] as const).filter(([, n]) => n !== 0).map(([k, n]) => `${k}${n > 0 ? '+' : ''}${n}`).join(' ');
  puffLine(ctx, r, puff > 0 ? `${puff}/${whole} PUFF` : 'OUT OF PUFF', puff > 0 ? `${puff}/${whole}` : 'OUT', puff > 0 ? TEXT : BAD, stages);
}

/** A plate's second line: the puff at the left and the stages at the right -- the short puff when both won't fit the plate. */
function puffLine(ctx: CanvasRenderingContext2D, r: Rect, long: string, short: string, tone: string, stages: string): void {
  const fits = (s: string) => measureText(s) + (stages ? measureText(stages) + 6 : 0) <= r.w - 8;
  text(ctx, fits(long) ? long : short, r.x + 4, r.y + 25, tone);
  if (stages) text(ctx, stages, r.x + r.w - 4, r.y + 25, FLAG, 'right');
}

/** The stop's plate: an obstacle's name, the mark to beat and the try it is on (its tries left as a bar), or the baddie's name and its puff left. */
function stopPlate(ctx: CanvasRenderingContext2D, trip: Trip, enc: Encounter): void {
  const r = STOP_PLATE, stop = trip.stops[enc.stop];
  box(ctx, r, FACE);
  title(ctx, stopName(stop), r.x + 4, r.y + 5);
  if (enc.kind === 'fight') {
    const f = enc.foe!, share = f.stats.puff ? f.puff / f.stats.puff : 0;
    bar(ctx, r.x + 4, r.y + 16, 100, 7, share, puffColour(share));
    const stages = ([['POW', f.power], ['GRD', f.guard]] as const).filter(([, n]) => n !== 0).map(([k, n]) => `${k}${n > 0 ? '+' : ''}${n}`).join(' ');
    puffLine(ctx, r, `${f.puff}/${f.stats.puff} PUFF`, `${f.puff}/${f.stats.puff}`, TEXT, stages);
  } else {
    const t = tryOf(enc), left = enc.outcome ? (enc.outcome === 'cleared' ? MAX_OBSTACLE_TURNS - t + 1 : 0) : MAX_OBSTACLE_TURNS - t + 1;
    bar(ctx, r.x + 4, r.y + 16, 100, 7, left / MAX_OBSTACLE_TURNS, TRIES);
    text(ctx, enc.outcome === 'cleared' ? 'PASSED!' : enc.outcome === 'waited' ? 'WAITED OUT' : `BEAT ${enc.mark}`, r.x + 4, r.y + 25, TEXT);
    text(ctx, `TRY ${t}/${MAX_OBSTACLE_TURNS}`, r.x + r.w - 4, r.y + 25, OFF, 'right');
  }
}

// ---------- the menu ----------

/** An offer's row on the menu: its name, what it is, and how it lands here. */
function row(ctx: CanvasRenderingContext2D, r: Rect, o: Offer, i: number): void {
  box(ctx, r, FACE);
  title(ctx, o.name, r.x + 6, r.y + 4);
  // (three columns: the name, what it is from WHAT_X, and the note right-aligned; the middle one is cut short rather than run under the note)
  const tone = o.ability === 'rider' ? FLAG : o.weight > 1 ? GOOD : o.weight > 0 && o.weight < 1 ? BAD : TEXT;
  const limit = r.x + r.w - 6 - measureText(o.note) - 8;
  let what = o.what;
  while (what.length && r.x + WHAT_X + measureText(what) > limit) what = what.slice(0, -1).trimEnd();
  text(ctx, what, r.x + WHAT_X, r.y + 4, OFF);
  text(ctx, o.note, r.x + r.w - 6, r.y + 4, tone, 'right');
  void i;
}

/**
 * The pick menu for the pair whose pick waits (BASE_DESIGN 11): WHAT WILL RIPPLE DO? (TRY 2 OF 3; a fight's TURN 2), and
 * a row for each ability it has at this stop (encounter.ts offersFor), in the menu's order. Returns the rows' tap targets.
 */
function pickMenu(ctx: CanvasRenderingContext2D, sim: CareSim, trip: Trip, enc: Encounter, pair: number, hits: Hit[]): void {
  const party = partyOf(sim, trip), stop = trip.stops[enc.stop], offers = offersFor(enc, party, stop, pair).slice(0, MAX_ROWS);
  const d = sim.dragons.find((q) => q.id === trip.pairs[pair].dragon);
  box(ctx, MENU, BORDER);
  rect(ctx, { x: MENU.x + 2, y: MENU.y + 2, w: MENU.w - 4, h: MENU.h - 4 }, PARCHMENT);
  text(ctx, `WHAT WILL ${d?.name ?? 'THE TEAM'} DO?  (${enc.kind === 'fight' ? `TURN ${enc.turn + 1}` : `TRY ${tryOf(enc)} OF ${MAX_OBSTACLE_TURNS}`})`, MENU.x + 6, MENU.y + 5, INKY);
  text(ctx, enc.kind === 'fight' ? `${stopName(stop)}: ${enc.foe!.puff} PUFF LEFT` : `BEAT ${enc.mark} TO ${CHALLENGES[stop.challenge!].clear}`, MENU.x + MENU.w - 6, MENU.y + 5, FADED, 'right');
  offers.forEach((o, i) => {
    const r = { x: MENU.x + 4, y: MENU.y + ROW_Y0 + i * ROW_H, w: MENU.w - 8, h: ROW_H - 1 };
    row(ctx, r, o, i);
    hits.push({ r, act: { kind: 'ability', pair, ability: o.ability }, name: `ability${i}` });
  });
}

// ---------- the popups ----------

/**
 * A popup over a head (`at`: its top, screen px) as a move lands: the words (and a note under them), rising 8 px over
 * POP_FRAMES, `age` steps after it landed. Drawn over the head's top, never over an eye (ART_BIBLE 1.4).
 */
export function drawPopup(ctx: CanvasRenderingContext2D, at: { x: number; y: number }, words: string, sub: string | null, age: number): void {
  const y = Math.round(at.y - 12 - Math.min(8, age / 4) - (sub ? 9 : 0));
  title(ctx, words, at.x, y, 'center');
  if (sub) title(ctx, sub, at.x, y + 9, 'center');
}

/** The popups of the move playing, if it has landed within POP_FRAMES: over a pair's head, the baddie's, or the obstacle. */
function popups(ctx: CanvasRenderingContext2D, enc: Encounter, f: SceneFrame, cast: ScenePets): void {
  if (enc.state !== 'play') return;
  const m = enc.moves[enc.cur];
  if (!m || !m.landed || m.t - m.at >= POP_FRAMES) return;
  const pop = popupOf(enc, m);
  if (!pop) return;
  const age = m.t - m.at;
  if (pop.on === 'work') { const p = pieceAt(f, enc.stop); if (p) drawPopup(ctx, p, pop.words, pop.sub, age); return; }
  if (pop.on === FOE) { const h = baddieHead(f); if (h) drawPopup(ctx, h, pop.words, pop.sub, age); return; }
  const heads = cast.heads(), h = heads[pop.on];
  if (h) drawPopup(ctx, { x: Math.round(h.x - f.camX), y: h.y }, pop.words, pop.sub, age);
}

// ---------- the whole ----------

/**
 * The encounter's furniture over the scene (BASE_DESIGN 11): the pairs' plates and the stop's, the pick menu while a
 * pair's pick waits (AUTO off, and none given yet: `pending`, a pick the world has still to take), THE TRAIL COACH
 * PICKS with AUTO on, AUTO, and the popups over the heads as moves land. Returns the tap targets (the rows, AUTO).
 */
export function drawEncounterHud(ctx: CanvasRenderingContext2D, sim: CareSim, trip: Trip, enc: Encounter, f: SceneFrame, cast: ScenePets, pending: boolean): Hit[] {
  const hits: Hit[] = [];
  trip.pairs.forEach((_, i) => pairPlate(ctx, sim, trip, enc, i));
  stopPlate(ctx, trip, enc);
  const pair = pendingPair(trip);
  if (enc.state === 'pick' && pair >= 0 && !trip.auto && !pending) pickMenu(ctx, sim, trip, enc, pair, hits);
  else if (trip.auto && enc.state !== 'done') {
    // (the notice sits between the pairs' plates and the stop's: 48 characters at most)
    const w = measureText(COACH_NOTICE) + 12, r = { x: 320 - w / 2, y: MENU.y + 4, w, h: 15 };
    box(ctx, r, FACE);
    text(ctx, COACH_NOTICE, 320, r.y + 4, TEXT, 'center');
  }
  popups(ctx, enc, f, cast);
  button(ctx, TRAIL_AUTO, 'AUTO', true, trip.auto);
  hits.push({ r: TRAIL_AUTO, act: { kind: 'trail' }, name: 'trail' });
  return hits;
}


/** The words for a pick, as the lines and the hook write it (an ability's name on the menu is the offer's: offersFor). */
export function pickWord(p: string): string { return p === 'rest' || p === 'rider' || p === 'sit' ? ABILITY_NAME[p as 'rest' | 'rider' | 'sit'] : p.toUpperCase(); }

/** Re-exported for the view: the baddies' words (the stop's plate names the fight's baddie by them). */
export { BADDIES };
