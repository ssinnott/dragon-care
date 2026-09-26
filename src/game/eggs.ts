// The Hatchery's eggs, drawn (ART_BIBLE 5.9; plan S5): drawing only -- the simulation keeps the eggs (sim.ts Egg,
// life.ts). An egg is a 9 x 12 letter sprite drawn by icons.ts drawSprite, so every pixel is ringed in ink (11 x 14
// with its outline): its shell the element's BABY scale colour (the baby inside is that colour; gated >= 25 % in
// luminance from the nest's straw, tools/palette-check.ts), lit from the top left in flat cel bands (a highlight row
// at the top left, a shadow band low on the right), with a 3 x 3 spot in the baby's belly colour (the mark floor for a
// spot). It cracks as it comes due: one 2 px ink zig-zag from half way, a second from 85 % (each with a lit rim on its
// left, the shell's highlight, so it reads on a dark shell); and over its last 15 % it
// wobbles, a px either way, stepping 0, +1, 0, -1 every 30 steps of the world's own tick (so a frozen frame is the same
// every time). It lies nestled in the front of its nest's straw heap, against the straw alone (layout.ts NEST_RY,
// eggBottom). When it hatches, six 2 x 2 bits of its shell jump outward and up over three stepped places across 20
// frames, from behind the baby standing up where the egg lay (drawn under the cast: never over it or an eye) and out
// wide of it, then are gone: no alpha, no gradient.
import { makeTones } from '../lib/art/shading.ts';
import { agedPalette } from '../art/dragon/palettes.ts';
import type { DragonElement } from '../art/dragon/palettes.ts';
import { drawSprite } from './icons.ts';
import type { Sprite } from './icons.ts';
import { INK } from './surfaces.ts';

/** The egg sprite's size (without its ink ring). */
export const EGG_W = 9, EGG_H = 12;
/** From this far on (0..1 of its time in the nest) an egg shows its first crack, its second, and wobbles. */
export const CRACK1 = 0.5, CRACK2 = 0.85, WOBBLE_FROM = 0.85;
/** The wobble: a px offset per 30-step beat of the world's tick. */
export const WOBBLE = [0, 1, 0, -1] as const;
const WOBBLE_BEAT = 30;
/** Frames the hatch's shell bits fly, and the frames each of their three places lasts. */
export const BITS_FRAMES = 20;

// s: shell, h: its highlight (top-left), d: its shadow band (low right), b: the belly-colour spot, k: a crack (ink)
export const SHELL: readonly string[] = [
  '...hhs...',
  '..hhsss..',
  '.hhsssss.',
  '.hssssss.',
  'hsssssssd',
  'sssssssdd',
  'sbbbsssdd',
  'sbbbssddd',
  'sbbbssddd',
  '.ssssddd.',
  '.sssdddd.',
  '...ddd...',
];
/** Each crack's pixels (row, column): a 2 px zig-zag stepping down one column a row -- the first down from the top, the second across the right side. */
const CRACKS: readonly (readonly [number, number][])[] = [
  [[0, 4], [0, 5], [1, 5], [1, 6], [2, 4], [2, 5], [3, 3], [3, 4], [4, 4], [4, 5]],
  [[4, 7], [4, 8], [5, 6], [5, 7], [6, 7], [6, 8], [7, 6], [7, 7], [8, 5], [8, 6]],
];

const sprites = new Map<string, Sprite>();
/** An element's egg with `cracks` (0, 1 or 2) cracks, built once (missionicons.ts carries the whole one: the rider's egg). */
export function eggSprite(el: DragonElement, cracks: number): Sprite {
  const key = `${el}/${cracks}`, had = sprites.get(key);
  if (had) return had;
  const pal = agedPalette(el, 'baby'), t = makeTones(pal.scale);
  const rows = SHELL.map((r) => r.split(''));
  for (let c = 0; c < cracks; c++) for (const [y, x] of CRACKS[c]) if (rows[y][x] !== '.') rows[y][x] = 'k';
  // (each crack's lit rim: the shell just left of it catches the light from the top left, so a crack reads on a dark
  // shell too -- ink on dusk's navy alone was a faint streak)
  for (let c = 0; c < cracks; c++) for (const [y, x] of CRACKS[c]) if (x > 0 && (rows[y][x - 1] === 's' || rows[y][x - 1] === 'd' || rows[y][x - 1] === 'b')) rows[y][x - 1] = 'h';
  const sp: Sprite = { rows: rows.map((r) => r.join('')), colors: { s: pal.scale, h: t.hi, d: t.sh, b: pal.belly, k: INK } };
  sprites.set(key, sp);
  return sp;
}

/** How many cracks an egg shows at `progress` (0..1 of its time in the nest). */
export function cracksAt(progress: number): number { return progress >= CRACK2 ? 2 : progress >= CRACK1 ? 1 : 0; }
/** The egg's wobble at `progress` and the world's `tick`, px. */
export function wobbleAt(progress: number, tick: number): number { return progress >= WOBBLE_FROM ? WOBBLE[Math.floor(tick / WOBBLE_BEAT) % WOBBLE.length] : 0; }

/**
 * An egg lying in its nest: (x, y) is its ink ring's bottom row, the middle column (world px: layout.ts nestX,
 * eggBottom; the shell's own rows are y - 12 .. y - 1, its columns x - 4 .. x + 4, the ring one more all round),
 * `progress` 0..1 of its time in the nest (its cracks and wobble), `tick` the world's (the wobble's beat).
 */
export function drawEgg(ctx: CanvasRenderingContext2D, el: DragonElement, x: number, y: number, progress: number, tick: number): void {
  drawSprite(ctx, eggSprite(el, cracksAt(progress)), Math.round(x) + wobbleAt(progress, tick) + 0.5, Math.round(y) - EGG_H / 2);
}

/**
 * The six shell bits' three places, px from the egg's middle: up and out to both sides, then falling a little. The
 * second and third clear the baby's head (up to 22 px over its feet: the bits there fly over it), and none goes more
 * than 26 px to a side, so from a nest 30 px in from the Hatchery's wall (layout.ts nestX) none flies through it. (The
 * baby's need bubble waits for the bits to land: base.ts.)
 */
const BITS: readonly (readonly [number, number][])[] = [
  [[-6, -18], [-15, -34], [-23, -28]],
  [[-3, -22], [-8, -42], [-13, -39]],
  [[-10, -12], [-21, -26], [-26, -18]],
  [[3, -22], [8, -42], [13, -39]],
  [[6, -18], [15, -34], [23, -28]],
  [[10, -12], [21, -26], [26, -18]],
];

/**
 * The hatch: six 2 x 2 bits of the shell (its colour, inked round) jumping out of the nest at (x, y) (the egg's bottom
 * middle, world px), `age` frames since it hatched: three stepped places across BITS_FRAMES frames, then nothing. The
 * view draws them under the cast, so they burst from behind the baby standing up in the nest -- never over it, nor over
 * any dragon's eye -- and fly out wide of it (BITS).
 */
export function drawShellBits(ctx: CanvasRenderingContext2D, el: DragonElement, x: number, y: number, age: number): void {
  if (age < 0 || age >= BITS_FRAMES) return;
  const step = Math.min(2, Math.floor(age * 3 / BITS_FRAMES)), shell = agedPalette(el, 'baby').scale;
  const cx = Math.round(x), cy = Math.round(y) - EGG_H / 2;
  for (const b of BITS) {
    const [dx, dy] = b[step], bx = cx + dx - 1, by = cy + dy - 1;
    ctx.fillStyle = INK; ctx.fillRect(bx - 1, by - 1, 4, 4);
    ctx.fillStyle = shell; ctx.fillRect(bx, by, 2, 2);
  }
}
