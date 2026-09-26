// The base's screen furniture (docs/BASE_DESIGN.md 4.8, 7): the top bar -- the time of day (a sun or a moon and
// `DAY 3 14:00`), the open jobs, a badge per keeper and the buttons (NEW, pause, speed) with their hit rects -- the
// toasts over the barn, the hint at the bottom right, and a dragon's card (its name, element, stage, its day of the
// stage's 30 and its needs: a tap on a dragon with nothing waiting opens it). House style: every box a 1 px #1a1018 outline, flat fills,
// the engine's 5 x 7 font (it has no dot or arrow glyphs, so those are little inked sprites: icons.ts drawSprite).
// Drawing only: base.ts owns what the buttons do.
import { drawText, drawTextOutlined, measureText } from '../lib/engine/text.ts';
import { drawSprite, ICONS } from './icons.ts';
import type { Rect, Sprite } from './icons.ts';
import type { ClockRead, Speed } from './clock.ts';
import { clockLabel, STAGE_DAYS } from './clock.ts';
import { NEEDS, QUEUE, tierOf } from './needs.ts';
import type { NeedKind } from './needs.ts';
import { lightsOf } from './sky.ts';
import { INK } from './surfaces.ts';
import { KEEPER_PALETTES } from '../art/keeper/palettes.ts';
import type { KeeperId } from '../art/keeper/cast.ts';

/** The top bar's height; the text colour; a button's face, and its face while active; the hint's colour. */
export const BAR_H = 15;
const TEXT = '#f3e6c8', FACE = '#3a2e34', ACTIVE = '#6b4a34', HINT = '#b8ac8e';

/** The top bar's buttons (screen px, 640 x 360): NEW (tap twice), pause, and the speed that cycles 1x, 2x, 4x, 8x. */
export type ButtonName = 'new' | 'pause' | 'speed';
export const BUTTONS: Readonly<Record<ButtonName, Rect>> = Object.freeze({
  new: { x: 528, y: 1, w: 26, h: 13 },
  pause: { x: 558, y: 1, w: 16, h: 13 },
  speed: { x: 578, y: 1, w: 28, h: 13 },
});
/** The keepers' badges: 46 x 13 each from x 138, 48 apart (display only; S7 makes them tappable). */
export const BADGE_X0 = 138, BADGE_DX = 48, BADGE_W = 46;
/** The clock's x, and JOBS's while the clock is short (to day 9). */
export const CLOCK_X = 16, JOBS_X = 90;
/**
 * Where `JOBS n` starts after the clock `label`: x 90, or a space after a longer label (from day 10: 94) -- never over
 * it. With clock.ts's label (12 glyphs at most to day 99 999) and two-digit jobs it ends by x 135, clear of the badges
 * (sim-check 11 holds it).
 */
export function jobsAt(label: string): number { return Math.max(JOBS_X, CLOCK_X + measureText(label) + 7); }
/** A toast's life, frames (3 s). */
export const TOAST_FRAMES = 180;

/** The time of day in the corner, as the sky shows it (sky.ts lightsOf): the sun by day, a low orange sun at dawn and dusk, the moon at night (9 x 9). */
const SUN_ROWS = ['....s....', '.s.....s.', '...sss...', '..sssss..', 's.sssss.s', '..sssss..', '...sss...', '.s.....s.', '....s....'];
const SKY_ICONS: Readonly<Record<'sun' | 'low' | 'moon', Sprite>> = Object.freeze({
  sun: { rows: SUN_ROWS, colors: { s: '#f6c84a' } },
  low: { rows: SUN_ROWS, colors: { s: '#f0905a' } },
  moon: { rows: ['...mmmm..', '..mmm....', '.mmm.....', '.mm......', '.mm......', '.mm......', '.mmm.....', '..mmm....', '...mmmm..'], colors: { m: '#f0ecd8' } },
});
/** A keeper's state on their badge: at a job (the font has no dot: a 3 x 3 one). */
const BUSY: Sprite = { rows: ['bbb', 'bbb', 'bbb'], colors: { b: '#e3b23e' } };

/** What the top bar shows. */
export interface TopBar {
  clock: ClockRead;
  jobs: number;
  keepers: readonly { name: string; look: KeeperId; busy: boolean }[];
  /** World steps a frame: 0 paused, else the rate. */
  speed: Speed;
  /** The rate the speed button shows (and play resumes at). */
  rate: Exclude<Speed, 0>;
  /** NEW has been tapped once and waits for the second. */
  armed: boolean;
}

const text = (ctx: CanvasRenderingContext2D, s: string, x: number, y: number, color = TEXT, align: 'left' | 'right' | 'center' = 'left') =>
  drawText(ctx, s, x, y, { color, align, shadow: false });

function button(ctx: CanvasRenderingContext2D, r: Rect, label: string, active: boolean): void {
  ctx.fillStyle = INK; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = active ? ACTIVE : FACE; ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  text(ctx, label, r.x + r.w / 2, r.y + 3, TEXT, 'center');
}

/** The top bar (plan 3.11): the sky icon and the clock, the jobs, the keepers' badges, and the buttons. */
export function drawTopBar(ctx: CanvasRenderingContext2D, s: TopBar): void {
  ctx.fillStyle = INK; ctx.fillRect(0, 0, ctx.canvas.width, BAR_H);
  // (the sky's own phase, not the clock's: at 20:00 the sky is still the dusk's, and the moon comes with its stars)
  drawSprite(ctx, SKY_ICONS[lightsOf(s.clock).icon], 7, 7);
  const label = clockLabel(s.clock);
  text(ctx, label, CLOCK_X, 4);
  text(ctx, `JOBS ${s.jobs}`, jobsAt(label), 4);
  s.keepers.forEach((k, i) => {
    const x = BADGE_X0 + i * BADGE_DX;
    ctx.fillStyle = INK; ctx.fillRect(x, 1, BADGE_W, 13);
    ctx.fillStyle = FACE; ctx.fillRect(x + 1, 2, BADGE_W - 2, 11);
    // (a 5 x 7 chip in the keeper's own top colour: who it is at a glance, as the keeper is seen across the barn)
    ctx.fillStyle = INK; ctx.fillRect(x + 2, 3, 7, 9);
    ctx.fillStyle = KEEPER_PALETTES[k.look].primary; ctx.fillRect(x + 3, 4, 5, 7);
    text(ctx, k.name, x + 10, 4);
    if (k.busy) drawSprite(ctx, BUSY, x + 43, 7.5);
  });
  button(ctx, BUTTONS.new, 'NEW', s.armed);
  button(ctx, BUTTONS.pause, 'II', s.speed === 0);
  button(ctx, BUTTONS.speed, `>${s.rate}X`, s.speed > 1);
}

/** The button under a screen point, if any. */
export function buttonAt(sx: number, sy: number): ButtonName | null {
  for (const [name, r] of Object.entries(BUTTONS) as [ButtonName, Rect][]) if (sx >= r.x && sx < r.x + r.w && sy >= r.y && sy < r.y + r.h) return name;
  return null;
}

/** A toast: outlined text centred over the barn under the top bar. */
export function drawToast(ctx: CanvasRenderingContext2D, s: string): void {
  drawTextOutlined(ctx, s, ctx.canvas.width / 2, 20, { size: 1, color: TEXT, outline: INK, thickness: 1, align: 'center', shadow: false });
}

/**
 * The two gestures, right-aligned at x 634 on an ink strip level with the job strip's chips (its text on theirs), so it reads over
 * any wall -- unless the strip reaches it (`stripEnd`, screen x): the jobs come first.
 */
export function drawHint(ctx: CanvasRenderingContext2D, stripEnd: number): void {
  const s = 'DRAG: LOOK AROUND   TAP A BUBBLE: RUSH', w = measureText(s), x = ctx.canvas.width - 6, y = ctx.canvas.height - 21;
  if (stripEnd + 8 > x - w - 4) return;
  ctx.fillStyle = INK; ctx.fillRect(x - w - 4, y, w + 8, 17);
  text(ctx, s, x, y + 5, HINT, 'right');
}

// ---------- the dragon card (plan S5) ----------

/** Where a dragon's card opens (screen px): under the top bar at the left, clear of the toasts (centred at x 320). */
export const CARD: Readonly<Rect> = Object.freeze({ x: 8, y: 20, w: 160, h: 76 });
/**
 * What a dragon's card shows: its name, element and stage, its day of the stage (1..STAGE_DAYS), each need (null: one
 * it hasn't got, or a garden resident's held full), and whether it lives in the garden (plan S6: its stage line says so).
 */
export interface CardInfo { name: string; element: string; stage: string; day: number; needs: Readonly<Record<NeedKind, number | null>>; garden?: boolean }
/** A day of the stage's bar: a filled day, a day to come. A need's bar: full enough (over QUEUE), then by its tier (soon, now). */
const DAY_ON = '#e3b23e', DAY_OFF = '#2e2428', NEED_OK = '#7bbf6a', NEED_TIER = ['#f2d36a', '#e3b23e', '#d8402e'];

/**
 * A dragon's card (160 x 76 at 8, 20): its name (outlined) and element; its stage and `DAY d OF 30`; the stage's 30
 * days as a bar of 4 x 5 segments a px apart, the days so far filled; and its needs, each its icon over a 20 x 4 bar
 * (a need it hasn't got -- fire's bath -- left out, the rest centred). The stage's days are the art of the age readout: a player
 * sees how far into its month a dragon is.
 */
export function drawCard(ctx: CanvasRenderingContext2D, c: CardInfo): void {
  const { x, y, w, h } = CARD;
  ctx.fillStyle = INK; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = FACE; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  drawTextOutlined(ctx, c.name, x + 6, y + 5, { size: 1, color: TEXT, outline: INK, thickness: 1, shadow: false });
  text(ctx, c.element.toUpperCase(), x + w - 6, y + 5, HINT, 'right');
  // (a garden resident's month is done: its bar full, its stage line where it lives)
  const day = c.garden ? STAGE_DAYS : Math.max(1, Math.min(STAGE_DAYS, c.day));
  text(ctx, c.garden ? `${c.stage.toUpperCase()} - IN THE GARDEN` : `${c.stage.toUpperCase()} - DAY ${day} OF ${STAGE_DAYS}`, x + 6, y + 18);
  // (the stage's 30 days: 4 x 5 segments, 1 px of ink between)
  const bx = x + 5, by = y + 29;
  ctx.fillStyle = INK; ctx.fillRect(bx, by, STAGE_DAYS * 5 + 1, 7);
  for (let i = 0; i < STAGE_DAYS; i++) { ctx.fillStyle = i < day ? DAY_ON : DAY_OFF; ctx.fillRect(bx + 1 + i * 5, by + 1, 4, 5); }
  // (the needs it has: columns of 30 px, centred -- fire has four, no bath -- each its icon over its bar)
  const has = NEEDS.filter((k) => c.needs[k] != null), x0 = x + Math.round((w - has.length * 30) / 2);
  has.forEach((k, i) => {
    const v = c.needs[k]!;
    const cx = x0 + i * 30;
    drawSprite(ctx, ICONS[k], cx + 15, y + 50);
    ctx.fillStyle = INK; ctx.fillRect(cx + 4, y + 60, 22, 6);
    ctx.fillStyle = DAY_OFF; ctx.fillRect(cx + 5, y + 61, 20, 4);
    ctx.fillStyle = v >= QUEUE ? NEED_OK : NEED_TIER[tierOf(v)];
    ctx.fillRect(cx + 5, y + 61, Math.round(20 * Math.max(0, Math.min(1, v))), 4);
  });
}
