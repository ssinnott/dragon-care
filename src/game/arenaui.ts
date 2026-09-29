// The Arena's screens (docs/BASE_DESIGN.md 10): the chooser a bout is begun from -- the two corners (the player's
// dragon and its sparring partner: its level and XP, its stats, its spirits, the skills it knows and the next one it
// learns), how each one's moves land on the other (the ring of the elements: training.ts), what the bout brings, the
// dragons to pick from (greyed with why one can't spar), SWAP, START and BACK -- and, over the world while a bout is on
// and watched, the bout's own furniture: a plate under each fighter (its name and level in its corner's colour, its
// puff, its stats' stages), the bout's latest line, the move menu while the player's pick waits (each skill with what
// it does to this sparring partner), AUTO and BACK TO BARN, the result card once it is decided, and the popups over
// the fighters' heads as moves land; and, while a bout is on and the barn is on screen, its chip under the top bar.
// Drawing and hit rects only, at the view's 640 x 360: base.ts owns what a tap does, arena.ts and training.ts every
// rule. House style: 1 px ink outlines, flat fills, the engine's 5 x 7 font, no alpha (the Map Room's: maptable.ts).
import { drawText, drawTextOutlined, measureText } from '../lib/engine/text.ts';
import type { Rect } from './icons.ts';
import { INK } from './surfaces.ts';
import { ARENA_FLAGS } from './building.ts';
import { DRAGON_PALETTES } from '../art/dragon/palettes.ts';
import { canSpar, fighterReason } from './arena.ts';
import type { Bout, Fighter } from './arena.ts';
import {
  levelOf, xpInto, statsOf, spirits, skillsOf, skillOf, typeMult, boutXp, LEARN_AT, BEATS, BEATS_WHY, MAX_LEVEL, SKILL_KINDS,
} from './training.ts';
import type { Skill, SkillKind } from './training.ts';
import type { CareSim, Dragon } from './sim.ts';
import type { Hit, UiAct, MapUi } from './maptable.ts';

// ---------- where things are (screen px) ----------

/** The chooser's panel (the Map Room's: maptable.ts PANEL), its two corner cards, its dragons' grid and its buttons. */
export const ARENA_PANEL: Readonly<Rect> = Object.freeze({ x: 8, y: 18, w: 624, h: 318 });
export const CORNER_CARDS: readonly Readonly<Rect>[] = Object.freeze([{ x: 16, y: 38, w: 300, h: 100 }, { x: 16, y: 144, w: 300, h: 100 }]);
const GRID = { x: 324, y: 40, w: 96, h: 22, dx: 102, dy: 25, cols: 3, rows: 5 } as const;
export const SWAP: Readonly<Rect> = Object.freeze({ x: 324, y: 290, w: 90, h: 18 });
export const START: Readonly<Rect> = Object.freeze({ x: 420, y: 290, w: 204, h: 18 });
export const ARENA_BACK: Readonly<Rect> = Object.freeze({ x: 560, y: 316, w: 64, h: 16 });
/**
 * The bout's furniture over the world, the camera on the Arena (base.ts ARENA_CAM: the ring's middle at screen x 320,
 * the roof floor's feet at y 136): a plate under each corner's fighter, clear of every head (the deck's slab ends at
 * y 152); the bout's line under them; the move menu (and the result card, in its place) over the roof below; AUTO and
 * BACK TO BARN along the bottom, where the watch overlay has its buttons (the job strip isn't drawn under the bout).
 */
export const PLATES: readonly Readonly<Rect>[] = Object.freeze([{ x: 100, y: 158, w: 184, h: 34 }, { x: 356, y: 158, w: 184, h: 34 }]);
export const LOG_LINE: Readonly<Rect> = Object.freeze({ x: 60, y: 196, w: 520, h: 15 });
export const MENU: Readonly<Rect> = Object.freeze({ x: 120, y: 214, w: 400, h: 118 });
export const SKILL_BUTTONS: readonly Readonly<Rect>[] = Object.freeze([
  { x: 124, y: 232, w: 194, h: 46 }, { x: 322, y: 232, w: 194, h: 46 }, { x: 124, y: 282, w: 194, h: 46 }, { x: 322, y: 282, w: 194, h: 46 },
]);
export const BOUT_BACK: Readonly<Rect> = Object.freeze({ x: 8, y: 338, w: 110, h: 16 });
export const AUTO: Readonly<Rect> = Object.freeze({ x: 124, y: 338, w: 64, h: 16 });
/** The result card, in the move menu's place (the fighters stay in view over it: the winner preening, the other napping). */
export const RESULT: Readonly<Rect> = MENU;
/** The bout's chip under the top bar while the barn is on screen (a tap opens the bout): left of the TEAM OUT chip (maptable.ts CHIP, x 394). */
export const BOUT_CHIP: Readonly<Rect> = Object.freeze({ x: 274, y: 19, w: 114, h: 15 });

// ---------- colours ----------

const PARCHMENT = '#e8d8a8', BORDER = '#8a6a4a', INKY = '#4a3428', FADED = '#8a7a64';
const FACE = '#3a2e34', ACTIVE = '#6b4a34', TEXT = '#f3e6c8', OFF = '#a89c88', GOOD = '#5c9c4c', BAD = '#b8402e', FLAG = '#f2c14e';
const CARD = '#f6ecd0', EMPTY = '#e0d0a0', BAR_OFF = '#5a5054';
/** A corner's colour: the west's blue, the east's red (building.ts ARENA_FLAGS: the pennants on its poles). */
export const CORNER_COLOUR: readonly string[] = Object.freeze([ARENA_FLAGS.west, ARENA_FLAGS.east]);
/** The puff bar's colour by the share left: plenty, getting low, nearly out. */
const puffColour = (share: number) => (share > 0.5 ? '#7bbf6a' : share > 0.2 ? '#e3b23e' : '#d8402e');

// ---------- the pen ----------

const text = (ctx: CanvasRenderingContext2D, s: string, x: number, y: number, color = INKY, align: 'left' | 'right' | 'center' = 'left') =>
  drawText(ctx, s, Math.round(x), Math.round(y), { color, align, shadow: false });
const title = (ctx: CanvasRenderingContext2D, s: string, x: number, y: number, align: 'left' | 'right' | 'center' = 'left', size = 1) =>
  drawTextOutlined(ctx, s, Math.round(x), Math.round(y), { size, color: TEXT, outline: INK, thickness: 1, align, shadow: false });
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
/** An element's chip: its body colour in an ink square (the Map Room's). */
function chip(ctx: CanvasRenderingContext2D, x: number, y: number, d: Dragon): void { box(ctx, { x, y, w: 9, h: 9 }, DRAGON_PALETTES[d.element].scale); }

/** The Arena's own state in the overlays' (maptable.ts MapUi): the two corners chosen (the player's dragon, its partner; by id). */
export interface ArenaPick { corners: [number | null, number | null]; closed: boolean }
export function newArenaPick(): ArenaPick { return { corners: [null, null], closed: false }; }

// ---------- the chooser ----------

/** How one fighter's moves land on the other, in words: its breath's weight on the other's element (the ring: training.ts BEATS). */
export function matchLine(a: Dragon, b: Dragon, level: number): string {
  const s = skillsOf(a.element, level)[0], w = typeMult(a.element, b.element);
  if (w > 1) return `${BEATS_WHY[a.element]}: ${a.name}'S ${s.name} IS STRONG ON ${b.name}`;
  if (w < 1) return `${BEATS_WHY[b.element]}: ${a.name}'S ${s.name} IS WEAK ON ${b.name}`;
  return `${a.name}'S ${s.name}: AN EVEN MATCH FOR ${b.name}`;
}

/** A skill's line in words: an element move's element and power (and its accuracy under 100 %), a plain one's, or what a status skill does. */
function skillLine(s: Skill, el: string): string {
  if (s.type === 'status') return s.effect!.who === 'self' ? `YOUR ${s.effect!.stat.toUpperCase()} UP` : `THEIR ${s.effect!.stat.toUpperCase()} DOWN`;
  return `${s.type === 'element' ? el.toUpperCase() : 'PLAIN'} - POWER ${s.power}${s.acc < 1 ? ` - ${Math.round(s.acc * 100)} %` : ''}`;
}

/** The next skill a dragon of this element learns past `level`, and at which level (null: it knows them all). */
function nextSkill(el: Dragon['element'], level: number): { s: Skill; at: number } | null {
  const k = (['yawn', 'show', 'big'] as SkillKind[]).find((q) => LEARN_AT[q] > level);
  return k ? { s: skillOf(el, k), at: LEARN_AT[k] } : null;
}

/**
 * One corner's card: its dragon's name, element, stage and level; its XP to the next level; its stats (its spirits on
 * its power); the skills it knows and the next it learns; or, empty, how to fill it.
 */
function cornerCard(ctx: CanvasRenderingContext2D, r: Rect, i: 0 | 1, d: Dragon | null): void {
  box(ctx, r, d ? CARD : EMPTY);
  rect(ctx, { x: r.x + 1, y: r.y + 1, w: r.w - 2, h: 10 }, CORNER_COLOUR[i]);
  text(ctx, i === 0 ? 'YOUR DRAGON - YOU PICK ITS MOVES' : 'SPARRING PARTNER - ITS COACH PICKS', r.x + 5, r.y + 2, TEXT);
  if (!d) { text(ctx, i === 0 ? 'TAP A DRAGON ON THE RIGHT' : 'THEN ITS SPARRING PARTNER', r.x + r.w / 2, r.y + 50, FADED, 'center'); return; }
  const lv = levelOf(d.xp), st = statsOf(d.element, d.stage, lv), sp = spirits(d.mood), into = xpInto(d.xp);
  chip(ctx, r.x + 5, r.y + 15, d);
  title(ctx, d.name, r.x + 18, r.y + 16);
  text(ctx, `${d.element.toUpperCase()} ${d.stage.toUpperCase()}`, r.x + 24 + measureText(d.name), r.y + 16, FADED);
  title(ctx, `LV ${lv}`, r.x + r.w - 6, r.y + 16, 'right');
  // (the XP to the next level)
  if (lv >= MAX_LEVEL) text(ctx, `MAX LEVEL - ${d.xp} XP`, r.x + 6, r.y + 29, INKY);
  else {
    bar(ctx, r.x + 6, r.y + 29, 120, 7, into.into / into.need, FLAG);
    text(ctx, `XP ${into.into}/${into.need} TO LV ${lv + 1}`, r.x + 132, r.y + 29, INKY);
  }
  text(ctx, `PUFF ${st.puff}  POWER ${Math.round(st.power * sp)}  GUARD ${st.guard}  SPEED ${st.speed}`, r.x + 6, r.y + 41, INKY);
  if (sp !== 1) text(ctx, sp > 1 ? 'IN HIGH SPIRITS: POWER +10 %' : 'A LITTLE LOW: POWER -10 %', r.x + 6, r.y + 52, sp > 1 ? GOOD : BAD);
  else text(ctx, 'IN FAIR SPIRITS (HAPPY DRAGONS HIT HARDER)', r.x + 6, r.y + 52, FADED);
  const known = skillsOf(d.element, lv).map((s) => s.name), next = nextSkill(d.element, lv);
  text(ctx, `SKILLS: ${known.join(' - ')}`, r.x + 6, r.y + 64, INKY);
  text(ctx, next ? `NEXT: ${next.s.name} AT LV ${next.at}` : 'KNOWS EVERY SKILL', r.x + 6, r.y + 75, FADED);
  text(ctx, `STRONG VS ${BEATS[d.element].toUpperCase()} - WEAK VS ${(Object.keys(BEATS) as Dragon['element'][]).find((e) => BEATS[e] === d.element)!.toUpperCase()}`, r.x + 6, r.y + 87, FADED);
}

/**
 * The Arena's chooser (BASE_DESIGN 10): the panel, ARENA: TRAINING BOUTS, the two corner cards (tap one to empty it), the
 * matchup (how each one's breath lands on the other) and what the bout brings, the dragons (a tap puts one in the first
 * empty corner, or takes it out again; greyed with why one can't spar), SWAP, START BOUT (greyed with why not) and BACK.
 * Returns the tap targets.
 */
export function drawArenaScreen(ctx: CanvasRenderingContext2D, sim: CareSim, pick: ArenaPick): Hit[] {
  const hits: Hit[] = [], P = ARENA_PANEL;
  box(ctx, P, BORDER);
  rect(ctx, { x: P.x + 3, y: P.y + 3, w: P.w - 6, h: P.h - 6 }, INK);
  rect(ctx, { x: P.x + 4, y: P.y + 4, w: P.w - 8, h: P.h - 8 }, PARCHMENT);
  title(ctx, 'ARENA: TRAINING BOUTS', 18, 25);
  const ds = pick.corners.map((id) => (id == null ? null : sim.dragons.find((d) => d.id === id) ?? null));
  CORNER_CARDS.forEach((r, i) => {
    cornerCard(ctx, r, i as 0 | 1, ds[i]);
    if (ds[i]) hits.push({ r, act: { kind: 'corner', corner: i as 0 | 1 }, name: `corner${i}` });
  });
  // (the matchup, and what it brings: a win, and a loss, for each)
  const [a, b] = ds;
  if (a && b) {
    const la = levelOf(a.xp), lb = levelOf(b.xp);
    text(ctx, matchLine(a, b, la), 16, 252, typeMult(a.element, b.element) > 1 ? GOOD : typeMult(a.element, b.element) < 1 ? BAD : INKY);
    text(ctx, matchLine(b, a, lb), 16, 263, typeMult(b.element, a.element) > 1 ? GOOD : typeMult(b.element, a.element) < 1 ? BAD : INKY);
    text(ctx, `XP: ${a.name} +${boutXp(la, lb).winner} FOR A WIN, +${boutXp(lb, la).loser} IF NOT`, 16, 276, INKY);
    text(ctx, `${' '.repeat(4)}${b.name} +${boutXp(lb, la).winner} FOR A WIN, +${boutXp(la, lb).loser} IF NOT`, 16, 287, INKY);
  } else text(ctx, 'EACH KIND IS STRONG AGAINST ONE AND WEAK AGAINST ONE:', 16, 252, FADED);
  if (!(a && b)) text(ctx, 'WATER > FIRE > SPIKE > ROCK > LIGHTNING > SLINKWING > DUSK > WATER', 16, 263, FADED);
  text(ctx, 'BOTH GAIN XP. A SPAR, NOT A FIGHT: NOBODY IS HURT,', 16, 303, FADED);
  text(ctx, 'AND A DRAGON OUT OF PUFF TAKES A NAP.', 16, 314, FADED);
  // ---- the dragons ----
  text(ctx, 'DRAGONS', 324, 28, INKY);
  text(ctx, 'TAP TWO: YOURS, THEN ITS PARTNER', 624, 28, FADED, 'right');
  const ok = sim.dragons.filter((d) => !fighterReason(sim, d)), no = sim.dragons.filter((d) => fighterReason(sim, d));
  [...ok, ...no].slice(0, GRID.cols * GRID.rows).forEach((d, i) => {
    const r = { x: GRID.x + (i % GRID.cols) * GRID.dx, y: GRID.y + Math.floor(i / GRID.cols) * GRID.dy, w: GRID.w, h: GRID.h };
    const why = fighterReason(sim, d), at = pick.corners.indexOf(d.id);
    box(ctx, r, why ? '#5a5054' : at >= 0 ? ACTIVE : FACE);
    if (at >= 0) rect(ctx, { x: r.x + 1, y: r.y + 1, w: 3, h: r.h - 2 }, CORNER_COLOUR[at]);
    text(ctx, d.name, r.x + 6, r.y + 3, why ? OFF : TEXT);
    text(ctx, why ?? (at === 0 ? 'YOURS' : at === 1 ? 'PARTNER' : `LV ${levelOf(d.xp)} ${d.element.toUpperCase()}`), r.x + 6, r.y + 12, why ? OFF : at >= 0 ? FLAG : OFF);
    if (!why) hits.push({ r, act: { kind: 'dragon', dragon: d.id }, name: `fighter${d.id}` });
  });
  // ---- the buttons ----
  button(ctx, SWAP, 'SWAP', !!(a && b));
  hits.push({ r: SWAP, act: { kind: 'swap' }, name: 'swap' });
  const why = canSpar(sim, pick.corners[0], pick.corners[1]);
  button(ctx, START, why ?? 'START BOUT', !why, !why);
  hits.push({ r: START, act: { kind: 'start' }, name: 'start' });
  button(ctx, ARENA_BACK, 'BACK');
  hits.push({ r: ARENA_BACK, act: { kind: 'back' }, name: 'back' });
  return hits;
}

/**
 * A tap on the chooser's dragons or corners (base.ts applies the rest): a dragon in a corner is taken out of it; any
 * other goes to the first empty corner (the player's first), or with both full, in the partner's place; a corner card
 * tapped is emptied; SWAP trades the two.
 */
export function editCorners(pick: ArenaPick, act: UiAct): void {
  const c = pick.corners;
  if (act.kind === 'dragon') {
    const at = c.indexOf(act.dragon);
    if (at >= 0) c[at] = null;
    else if (c[0] == null) c[0] = act.dragon;
    else c[1] = act.dragon;
  } else if (act.kind === 'corner') c[act.corner] = null;
  else if (act.kind === 'swap') pick.corners = [c[1], c[0]];
}

// ---------- the bout, over the world ----------

/** The bout's chip's words: on the way up, the player's pick waiting, the turn, or how it went. */
export function boutChipText(sim: CareSim, b: Bout): string {
  const name = (f: Fighter) => sim.dragons.find((d) => d.id === f.dragon)?.name ?? '?';
  if (b.state === 'muster') return 'BOUT: ON THE WAY';
  if (b.state === 'over' || b.state === 'home') return b.winner == null ? 'BOUT: A DRAW' : `${name(b.fighters[b.winner])} WINS`;
  if (b.state === 'pick' && !b.auto) return 'BOUT: YOUR PICK!';
  return `BOUT: TURN ${Math.max(1, b.turn)}`;
}
/** The bout's chip (a bout is on, the barn on screen): its box, a pennant in each corner's colour and its words; returns its tap rect. */
export function drawBoutChip(ctx: CanvasRenderingContext2D, sim: CareSim, b: Bout): Rect {
  const r = BOUT_CHIP, waiting = b.state === 'pick' && !b.auto;
  box(ctx, r, waiting ? ACTIVE : FACE);
  rect(ctx, { x: r.x + 3, y: r.y + 4, w: 3, h: 7 }, CORNER_COLOUR[0]); rect(ctx, { x: r.x + 7, y: r.y + 4, w: 3, h: 7 }, CORNER_COLOUR[1]);
  text(ctx, boutChipText(sim, b), r.x + r.w / 2 + 5, r.y + 4, waiting ? FLAG : TEXT, 'center');
  return r;
}

/**
 * A fighter's plate under it (its corner's): its name and level in its corner's colour -- the level it began the bout at,
 * or once the bout is decided its new one, lit if it went up -- YOU on the player's, its puff, and its stats' stages.
 */
function plate(ctx: CanvasRenderingContext2D, sim: CareSim, b: Bout, f: Fighter, i: 0 | 1, corner: 0 | 1): void {
  const r = PLATES[corner], d = sim.dragons.find((q) => q.id === f.dragon)!, now = b.state === 'over' || b.state === 'home' ? levelOf(d.xp) : f.level;
  box(ctx, r, CORNER_COLOUR[corner]);
  rect(ctx, { x: r.x + 2, y: r.y + 2, w: r.w - 4, h: r.h - 4 }, FACE);
  chip(ctx, r.x + 5, r.y + 5, d);
  title(ctx, d.name, r.x + 18, r.y + 6);
  if (i === 0) text(ctx, 'YOU', r.x + 24 + measureText(d.name), r.y + 6, FLAG);
  if (now > f.level) text(ctx, `LV ${now}!`, r.x + r.w - 6, r.y + 6, FLAG, 'right'); else title(ctx, `LV ${now}`, r.x + r.w - 6, r.y + 6, 'right');
  const share = f.puff / f.stats.puff;
  bar(ctx, r.x + 5, r.y + 18, 104, 9, share, puffColour(share));
  const stages = ([['power', f.power], ['guard', f.guard]] as const).filter(([, n]) => n !== 0).map(([k, n]) => `${k === 'power' ? 'POW' : 'GRD'}${n > 0 ? '+' : ''}${n}`);
  text(ctx, stages.length ? stages.join(' ') : `${f.puff}/${f.stats.puff}`, r.x + 114, r.y + 20, stages.length ? FLAG : TEXT);
}

/** What the bout's line says: its latest line (and while the fighters are on their way, that they are). */
function boutLine(b: Bout): string { return b.log[b.log.length - 1] ?? ''; }

/**
 * The move menu (the player's pick waiting: BASE_DESIGN 10): WHAT WILL EMBER DO?, and a button per skill it knows -- its
 * name, what it is (its element and power, or what it does) and how it lands on this partner (strong, weak or even:
 * the ring) -- in the menu's order (training.ts skillsOf).
 */
function moveMenu(ctx: CanvasRenderingContext2D, sim: CareSim, b: Bout, hits: Hit[]): void {
  const f = b.fighters[0], d = sim.dragons.find((q) => q.id === f.dragon)!, o = sim.dragons.find((q) => q.id === b.fighters[1].dragon)!;
  box(ctx, MENU, BORDER);
  rect(ctx, { x: MENU.x + 2, y: MENU.y + 2, w: MENU.w - 4, h: MENU.h - 4 }, PARCHMENT);
  text(ctx, `WHAT WILL ${d.name} DO?  (TURN ${b.turn + 1})`, MENU.x + 6, MENU.y + 6, INKY);
  skillsOf(d.element, f.level).forEach((s, i) => {
    const r = SKILL_BUTTONS[i], w = s.type === 'element' ? typeMult(d.element, o.element) : 1;
    box(ctx, r, FACE);
    title(ctx, s.name, r.x + 6, r.y + 5);
    text(ctx, skillLine(s, d.element), r.x + 6, r.y + 19, OFF);
    const note = s.type === 'status' ? (s.kind === 'preen' ? (f.guard >= 2 ? 'AS HIGH AS IT GOES' : 'HARDER TO TIRE') : (b.fighters[1].power <= -2 ? `${o.name} IS AS DROWSY AS IT GETS` : `${o.name} HITS SOFTER`))
      : s.type === 'plain' ? `NEVER WEAK - ${o.name} IS IMPRESSED` : w > 1 ? `STRONG ON ${o.name}!` : w < 1 ? `WEAK ON ${o.name}` : `EVEN ON ${o.name}`;
    text(ctx, note, r.x + 6, r.y + 31, s.type === 'element' ? (w > 1 ? '#8fd07a' : w < 1 ? '#e87a64' : TEXT) : TEXT);
    hits.push({ r, act: { kind: 'skill', skill: s.kind }, name: `skill${i}` });
  });
}

/** The result card (the bout decided, until tapped away): who won (or a draw), each one's XP and what it brought, and that nobody is hurt. */
function resultCard(ctx: CanvasRenderingContext2D, sim: CareSim, b: Bout): void {
  const r = RESULT, ds = b.fighters.map((f) => sim.dragons.find((q) => q.id === f.dragon)!), cx = r.x + r.w / 2;
  box(ctx, r, BORDER);
  rect(ctx, { x: r.x + 2, y: r.y + 2, w: r.w - 4, h: r.h - 4 }, PARCHMENT);
  title(ctx, b.winner == null ? 'A DRAW!' : `${ds[b.winner].name} WINS!`, cx, r.y + 8, 'center', 2);
  b.fighters.forEach((f, i) => {
    const d = ds[i], now = levelOf(d.xp), learned = now > f.level ? skillsOf(d.element, now).filter((s) => s.level > f.level).map((s) => s.name) : [];
    const up = now > f.level ? `  LV ${now}!${learned.length ? ` NEW: ${learned.join(', ')}` : ''}` : '';
    text(ctx, `${d.name} +${b.xp[i]} XP${up}`, cx, r.y + 36 + i * 12, now > f.level ? '#3a6a2e' : INKY, 'center');
  });
  const loser = b.winner == null ? null : ds[1 - b.winner];
  text(ctx, loser ? `NOBODY IS HURT: ${loser.name} NAPS IT OFF.` : 'NOBODY IS HURT: BOTH DID WELL.', cx, r.y + 68, INKY, 'center');
  text(ctx, 'TIRED AND HUNGRY, THEY HEAD HOME.', cx, r.y + 80, FADED, 'center');
  text(ctx, 'TAP TO CLOSE', cx, r.y + 102, '#6b5a44', 'center');
}

/**
 * A popup over a fighter's head (`head`: its top, screen px) as a move lands: the puff it cost ("-9", with STRONG! or
 * WEAK under it), DODGED!, GUARD UP, POWER DOWN -- rising 8 px over its FACE_FRAMES-long life (arena.ts), `age` steps
 * after it landed. Drawn over the head's top, never over an eye (ART_BIBLE 1.4).
 */
export function drawPopup(ctx: CanvasRenderingContext2D, head: { x: number; y: number }, words: string, sub: string | null, age: number): void {
  const y = Math.round(head.y - 12 - Math.min(8, age / 4) - (sub ? 9 : 0));
  title(ctx, words, head.x, y, 'center');
  if (sub) title(ctx, sub, head.x, y + 9, 'center');
}

/** A landed move's popup words (and the ring's note under a cost), for the fighter it shows over (`on`: the other, or its own mover for a preen). */
export function popupOf(sim: CareSim, b: Bout, m: Bout['moves'][number]): { on: 0 | 1; words: string; sub: string | null } {
  const d = sim.dragons.find((q) => q.id === b.fighters[m.by].dragon)!, o = sim.dragons.find((q) => q.id === b.fighters[1 - m.by].dragon)!;
  if (m.skill === 'preen') return { on: m.by, words: m.moved ? 'GUARD UP' : 'NO HIGHER', sub: null };
  if (m.skill === 'yawn') return { on: (1 - m.by) as 0 | 1, words: m.moved ? 'POWER DOWN' : 'NO LOWER', sub: null };
  if (!m.hit) return { on: (1 - m.by) as 0 | 1, words: 'DODGED!', sub: null };
  const s = skillOf(d.element, m.skill), w = s.type === 'element' ? typeMult(d.element, o.element) : 1;
  return { on: (1 - m.by) as 0 | 1, words: `-${m.loss}`, sub: w > 1 ? 'STRONG!' : w < 1 ? 'WEAK' : null };
}

/**
 * The bout's furniture over the world (BASE_DESIGN 10; the camera on the Arena): a plate under each fighter once both
 * stand in their corners, the bout's line, then by its state -- the move menu while the player's pick waits (AUTO off,
 * and none given yet: `pending`, a pick the world has still to take), THE COACH PICKS with AUTO on, the result card once
 * decided (until tapped away: `closed`) -- and BACK TO BARN and AUTO. Before the bout's first step (`b` null: START
 * given while paused) BACK TO BARN alone. Returns the tap targets. (The popups are the view's: it knows where the heads are.)
 */
export function drawBoutHud(ctx: CanvasRenderingContext2D, sim: CareSim, b: Bout | null, closed: boolean, pending: boolean): Hit[] {
  const hits: Hit[] = [];
  if (b) {
    if (b.fighters.every((f) => f.corner != null)) b.fighters.forEach((f, i) => plate(ctx, sim, b, f, i as 0 | 1, f.corner!));
    const line = b.state === 'muster' ? boutLine(b).replace('HEAD UP TO THE ARENA', 'ARE ON THEIR WAY UP') : boutLine(b);
    if (line) {
      const w = Math.min(LOG_LINE.w, measureText(line) + 12), r = { x: 320 - w / 2, y: LOG_LINE.y, w, h: LOG_LINE.h };
      box(ctx, r, FACE);
      text(ctx, line, 320, r.y + 4, TEXT, 'center');
    }
    if ((b.state === 'over' || b.state === 'home') && !closed) {
      resultCard(ctx, sim, b);
      hits.push({ r: RESULT, act: { kind: 'result' }, name: 'result' });
    } else if (b.state === 'pick' && !b.auto && !pending) moveMenu(ctx, sim, b, hits);
    else if (b.auto && b.state !== 'over' && b.state !== 'home') text(ctx, 'THE COACH PICKS YOUR MOVES: TAP AUTO TO PICK THEM YOURSELF', 320, MENU.y + 10, TEXT, 'center');
  }
  button(ctx, BOUT_BACK, '← BACK TO BARN');
  hits.push({ r: BOUT_BACK, act: { kind: 'back' }, name: 'boutBack' });
  if (b) {
    button(ctx, AUTO, 'AUTO', true, b.auto);
    hits.push({ r: AUTO, act: { kind: 'auto' }, name: 'auto' });
  }
  return hits;
}

/** Whether a kind is a skill kind (a hit's act, checked). */
export function isSkill(k: string): k is SkillKind { return (SKILL_KINDS as readonly string[]).includes(k); }

/** The overlays' state with the Arena's in it (maptable.ts MapUi carries it). */
export type { MapUi };
