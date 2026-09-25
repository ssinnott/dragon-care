// The base's small UI art (docs/BASE_DESIGN.md 4.2, 4.8): the need icons, the thought bubble over a dragon and the
// chips of the job strip. House style (ART_BIBLE's "the house style"): every mark inked in #1a1018, flat fills, no
// gradients. An icon is a tiny sprite of letters; drawing it rings every filled pixel in ink first, so a 7 px icon
// reads at 1x.
import { drawText, measureText } from '../lib/engine/text.ts';
import type { NeedKind, Tier } from './needs.ts';

const INK = '#1a1018';

export interface Sprite { rows: readonly string[]; colors: Readonly<Record<string, string>> }

export const ICONS: Readonly<Record<NeedKind | 'check' | 'wait' | 'rush', Sprite>> = Object.freeze({
  food: { rows: ['..ooooo..', '.ooyyyoo.', 'bbbbbbbbb', '.bbbbbbb.', '..bbbbb..'], colors: { o: '#e0903a', y: '#f6c46a', b: '#8c4a3a' } },
  play: { rows: ['..rrr..', '.rrrrr.', 'rrrrrrr', 'wwwwwww', 'rrrrrrr', '.rrrrr.', '..rrr..'], colors: { r: '#e0664a', w: '#f6ecd6' } },
  bath: { rows: ['...b...', '..bbb..', '.bbbbb.', 'bbwbbbb', 'bwbbbbb', 'bbbbbbb', '.bbbbb.'], colors: { b: '#4aa8d8', w: '#cdeefa' } },
  sleep: { rows: ['..yyyy.', '.yyy...', 'yyy....', 'yyy....', 'yyy....', '.yyy...', '..yyyy.'], colors: { y: '#f2d36a' } },
  love: { rows: ['.pp.pp.', 'ppppppp', 'ppwpppp', '.ppppp.', '..ppp..', '...p...'], colors: { p: '#e8507a', w: '#ffc0d0' } },
  check: { rows: ['....g', '...gg', 'g.gg.', 'ggg..', '.g...'], colors: { g: '#5cc05c' } },
  wait: { rows: ['wwwww', '.sss.', '..s..', '.s.s.', 'wwwww'], colors: { w: '#c8b8a0', s: '#e3c35e' } },
  rush: { rows: ['r..r..', 'rr.rr.', 'rrrrrr', 'rr.rr.', 'r..r..'], colors: { r: '#ff8a6a' } },
});

/** Draw a sprite centred on (cx, cy), every pixel ringed in ink. */
export function drawSprite(ctx: CanvasRenderingContext2D, sp: Sprite, cx: number, cy: number): void {
  const h = sp.rows.length, w = sp.rows[0].length, x0 = Math.round(cx - w / 2), y0 = Math.round(cy - h / 2);
  ctx.fillStyle = INK;
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) if (sp.rows[r][c] !== '.') ctx.fillRect(x0 + c - 1, y0 + r - 1, 3, 3);
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    const k = sp.rows[r][c];
    if (k !== '.') { ctx.fillStyle = sp.colors[k]; ctx.fillRect(x0 + c, y0 + r, 1, 1); }
  }
}

/** The tiers' colours: a bubble's fill (white, cream-yellow, pink) and a chip's tab (straw, amber, red). */
const BUBBLE_FILL = ['#fbf7ee', '#fff3c4', '#ffe0d8'], TAB = ['#b8ac8e', '#e3b23e', '#d8402e'];

export interface Rect { x: number; y: number; w: number; h: number }
export const hit = (r: Rect, x: number, y: number) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

/**
 * A thought bubble whose tail points down at (tipX, tipY), just over a dragon's head: the need's icon in a rounded
 * inked box, tinted by tier, a red "!" tab at tier 2 (now), and a green check once a keeper has the job. Returns
 * the box, for tapping.
 */
export function drawBubble(ctx: CanvasRenderingContext2D, tipX: number, tipY: number, need: NeedKind, tier: Tier, claimed: boolean): Rect {
  const fill = BUBBLE_FILL[tier], w = 17, h = 15, x = Math.round(tipX - 5), y = Math.round(tipY - h - 7);
  const dot = (cx: number, cy: number, r: number) => {
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(cx, cy, r + 1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  };
  dot(Math.round(tipX) - 0.5, Math.round(tipY) - 1.5, 1.5); dot(Math.round(tipX) - 1.5, Math.round(tipY) - 5.5, 2);
  ctx.fillStyle = INK; ctx.fillRect(x + 1, y, w - 2, h); ctx.fillRect(x, y + 1, w, h - 2);
  ctx.fillStyle = fill; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  drawSprite(ctx, ICONS[need], x + w / 2, y + h / 2);
  if (tier === 2) {
    ctx.fillStyle = INK; ctx.fillRect(x + w - 4, y - 5, 7, 10);
    ctx.fillStyle = '#d8402e'; ctx.fillRect(x + w - 3, y - 4, 5, 8);
    drawText(ctx, '!', x + w - 3, y - 4, { color: '#fff8ee', shadow: false });
  }
  if (claimed) drawSprite(ctx, ICONS.check, x + w - 1, y + h - 1);
  return { x, y: y - (tier === 2 ? 5 : 0), w: w + (tier === 2 ? 3 : 0), h: h + 7 + (tier === 2 ? 5 : 0) };
}

/**
 * One chip of the job strip: its place in the queue on a tab in the tier's colour, the need, the dragon's name, and a
 * check (a keeper has it) or an hourglass (waiting); a rushed job wears the rush mark. Returns its width.
 */
export function drawChip(ctx: CanvasRenderingContext2D, x: number, y: number, n: number, need: NeedKind, name: string, tier: Tier, claimed: boolean, rushed: boolean): number {
  const nw = measureText(name, 1), w = 8 + 13 + nw + 14 + (rushed ? 9 : 0);
  ctx.fillStyle = INK; ctx.fillRect(x, y, w, 17);
  ctx.fillStyle = rushed ? '#4a2a2c' : '#2e2428'; ctx.fillRect(x + 1, y + 1, w - 2, 15);
  ctx.fillStyle = TAB[tier]; ctx.fillRect(x + 1, y + 1, 7, 15);
  drawText(ctx, String(n), x + 2, y + 5, { color: INK, shadow: false });
  drawSprite(ctx, ICONS[need], x + 15, y + 8);
  drawText(ctx, name, x + 22, y + 5, { color: '#f3e6c8', shadow: false });
  drawSprite(ctx, claimed ? ICONS.check : ICONS.wait, x + 22 + nw + 6, y + 8);
  if (rushed) drawSprite(ctx, ICONS.rush, x + 22 + nw + 15, y + 8);
  return w;
}
