// Deterministic particle helpers for dragon effects (docs/ART_BIBLE.md 1.4 steps 13-14, 5.1 #12, 5.4).
//
// Nothing here reads a clock or Math.random. An emitter is a SCHEDULE: spawn k happens at a seeded time derived
// from (seed, k), so the particles alive at tick t are a pure function of t. A frozen-time screenshot (t steps from
// play) is therefore reproducible, a stepped-back debugger frame shows the same embers, and there is no particle
// state to save with a pet. The house rules for anything that moves on the pixel grid are built in:
//   - positions are rounded to whole pixels (5.1 #12: no shimmer under nearest-neighbour upscaling);
//   - alpha changes in 3 steps (1 / 0.7 / 0.4), never smoothly;
//   - rising particles (embers, "z", bubbles, notes, dazed stars) are queued for the TOP PASS and drawn after every
//     dragon, so a neighbour never hides them (1.4 step 14);
//   - ambient particles are capped per dragon (6) and across the habitat (12), shared out round-robin (5.4).

/** A deterministic 0..1 hash of two integers (seed, index). */
export function hash01(seed: number, k: number): number {
  let h = (Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul((k | 0) + 0x632be5ab, 0x85ebca77)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

/** The 3-step alpha of a particle at life fraction `f` (0 = born, 1 = gone): 1, 0.7, 0.4. */
export function stepAlpha(f: number): number { return f < 1 / 3 ? 1 : f < 2 / 3 ? 0.7 : 0.4; }

/** A 3-step size: `size` shrinks to 2/3 and 1/3 over its life (floor-level effects fade by shrinking, never alpha: 5.4). */
export function stepShrink(f: number, size: number): number { return Math.max(1, Math.round(size * (f < 1 / 3 ? 1 : f < 2 / 3 ? 2 / 3 : 1 / 3))); }

/**
 * Ages of the spawns of a seeded schedule that are alive at `tick`. Spawn k fires at
 *   k * every + (hash01(seed, k) * 2 - 1) * jitter
 * and lives `life` ticks. Writes each live spawn's age into `ages` and its index into `ids`, returns the count.
 * `every` must exceed 2 * jitter so spawns keep their order.
 */
export function liveSpawns(seed: number, tick: number, every: number, jitter: number, life: number, ages: Float32Array, ids: Int32Array): number {
  const kLo = Math.max(0, Math.floor((tick - life - jitter) / every)), kHi = Math.floor((tick + jitter) / every);
  let n = 0;
  for (let k = kLo; k <= kHi && n < ages.length; k++) {
    const t0 = k * every + (hash01(seed, k) * 2 - 1) * jitter;
    const age = tick - t0;
    if (age >= 0 && age < life) { ages[n] = age; ids[n] = k; n++; }
  }
  return n;
}

/** Round to the device grid of a rig drawn at scale `sc`. */
export function snap(v: number, sc = 1): number { return Math.round(v * sc) / sc; }

// ---------- the top pass (1.4 step 14) ----------

/** A top-pass draw: called in SCREEN space with the item's numbers. Module-level functions only (no closures per frame). */
export type TopDraw = (ctx: CanvasRenderingContext2D, it: TopItem) => void;

/** One queued rising particle, in screen space. Pooled: never retain one. */
export interface TopItem {
  draw: TopDraw;
  /** Screen position (whole px). */
  x: number;
  y: number;
  /** Draw scale (device px per sprite px) and facing. */
  sc: number;
  facing: number;
  /** Free parameters (size, frame, phase...). */
  a: number;
  b: number;
  alpha: number;
  /** Colours (fill, ring). */
  c0: string;
  c1: string;
}

const NOOP: TopDraw = () => {};

/** The queue of rising particles drawn after every dragon. One per scene; the gallery and the game flush it. */
export class TopPass {
  items: TopItem[];
  n = 0;
  constructor(cap = 96) {
    this.items = [];
    for (let i = 0; i < cap; i++) this.items.push({ draw: NOOP, x: 0, y: 0, sc: 1, facing: 1, a: 0, b: 0, alpha: 1, c0: '', c1: '' });
  }
  /** Queue one item; returns it for the caller to fill in, or null when the pool is full (it is simply dropped). */
  push(draw: TopDraw, x: number, y: number, sc: number, facing: number): TopItem | null {
    if (this.n >= this.items.length) return null;
    const it = this.items[this.n++];
    it.draw = draw; it.x = Math.round(x); it.y = Math.round(y); it.sc = sc; it.facing = facing;
    it.a = 0; it.b = 0; it.alpha = 1; it.c0 = ''; it.c1 = '';
    return it;
  }
  /** Draw every queued item in queue order, then empty the queue. */
  flush(ctx: CanvasRenderingContext2D): void {
    for (let i = 0; i < this.n; i++) {
      const it = this.items[i];
      ctx.save();
      if (it.alpha < 1) ctx.globalAlpha *= it.alpha;
      it.draw(ctx, it);
      ctx.restore();
    }
    this.n = 0;
  }
  clear(): void { this.n = 0; }
}

// ---------- ambient caps (5.4) ----------

/** Per-dragon ambient particle cap. */
export const AMBIENT_PER_DRAGON = 6;
/** Habitat-wide ambient particle cap. */
export const AMBIENT_HABITAT = 12;

/**
 * Round-robin ambient budget for one scene. Call begin() once per frame with the dragon count, then each dragon's
 * ambient renderer asks take(slot, want) for how many particles it may draw this frame. The hand-out order rotates
 * every frame (starting at a different dragon), so under the habitat cap no dragon starves; it depends only on the
 * frame number, so it is deterministic. Beyond 4 dragons every ambient interval stretches 1.5x (`stretch`).
 */
export class AmbientBudget {
  perDragon = AMBIENT_PER_DRAGON;
  habitat = AMBIENT_HABITAT;
  /** Interval multiplier for ambient schedules: 1.5 with more than 4 dragons on screen. */
  stretch = 1;
  private used = 0;
  private count = 1;
  private start = 0;
  private granted = new Int32Array(64);
  private asked = 0;
  /** Start a frame: `dragons` on screen, `frame` = the scene's tick. */
  begin(dragons: number, frame: number): void {
    this.count = Math.max(1, dragons); this.used = 0; this.asked = 0;
    this.start = frame % this.count;
    this.stretch = dragons > 4 ? 1.5 : 1;
    this.granted.fill(0);
  }
  /**
   * Particles dragon `slot` (0..dragons-1, its draw index) may draw now. Dragons that come BEFORE the rotating start
   * in draw order get a fair share, the rest whatever the habitat cap leaves: over `count` frames everyone leads.
   */
  take(slot: number, want: number): number {
    const fair = Math.floor(this.habitat / this.count);
    const lead = ((slot - this.start + this.count) % this.count) < (this.habitat % this.count);
    const share = fair + (lead ? 1 : 0);
    const n = Math.max(0, Math.min(want, this.perDragon, share, this.habitat - this.used));
    this.used += n; this.asked++;
    if (slot >= 0 && slot < this.granted.length) this.granted[slot] = n;
    return n;
  }
}

/** A budget for a lone dragon (galleries, the care panel): 6 particles, no habitat sharing. */
export const SOLO_BUDGET = new AmbientBudget();

// ---------- the shared act effects (the rig schedules them: rig.ts drawActEffects) ----------

/** The 6 x 6 "z" of the sleep loop (4.2): rows 0-1 full, row 2 at columns 3-4, row 3 at 1-2, rows 4-5 full. */
const Z_ROWS: readonly number[] = [0b111111, 0b111111, 0b000110, 0b011000, 0b111111, 0b111111];
/**
 * A 5 x 5 four-point star (the dazed face's pair, 2.5): a solid body tapering to its four points, the centre 3 px
 * across. The 3 x 3 "+" it replaces had 1 px arms in an ink ring and read as a first-aid icon (5.2: no "+" sparkles
 * with 1 px arms).
 */
const STAR_ROWS: readonly number[] = [0b00100, 0b01110, 0b11111, 0b01110, 0b00100];

/**
 * Draw a small bitmap (rows as bit masks, the high bit on the left) at screen (x, y), `sc` device px per sprite px,
 * filled in `fill` with a 1 px `ink` ring round it (the mark floor's "inked" glyphs, 5.2). `counters` false rings
 * only OUTSIDE the glyph's w x h box (the "z": its 1-row counters stay open -- the 8-neighbour ring filled them and
 * the "z" read as a solid tile, a crate); true rings every off cell next to an on cell (a star). Never mirrored: a
 * "z" read backwards is not a "z".
 */
function drawGlyph(ctx: CanvasRenderingContext2D, rows: readonly number[], w: number, x: number, y: number, sc: number, fill: string, ink: string, counters: boolean): void {
  const h = rows.length;
  ctx.fillStyle = ink;
  for (let r = -1; r <= h; r++) for (let c = -1; c <= w; c++) {
    if (glyphOn(rows, w, c, r) || (!counters && r >= 0 && r < h && c >= 0 && c < w)) continue;
    // (the "z" rings its box's outside edge with 4-neighbours only: the 8-neighbour ring closed its corners into a
    // full cream frame, an 8 x 8 tile at game scale)
    let near = false;
    for (let dr = -1; dr <= 1 && !near; dr++) for (let dc = -1; dc <= 1 && !near; dc++) {
      if (!counters && dr && dc) continue;
      near = glyphOn(rows, w, c + dc, r + dr);
    }
    if (near) ctx.fillRect(x + c * sc, y + r * sc, sc, sc);
  }
  ctx.fillStyle = fill;
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) if (glyphOn(rows, w, c, r)) ctx.fillRect(x + c * sc, y + r * sc, sc, sc);
}
/** Is cell (c, r) of a glyph bitmap on (off the bitmap = off)? */
function glyphOn(rows: readonly number[], w: number, c: number, r: number): boolean {
  return r >= 0 && r < rows.length && c >= 0 && c < w && ((rows[r] >> (w - 1 - c)) & 1) === 1;
}

/**
 * Top-pass draw: the sleeping "z" (it.x, it.y = its top-left; c0 = the dragon's `belly`, c1 = ink), its strokes in
 * INK and the ring round its box in `belly`. The other way round, a belly-light "z" on the straw floor inside an ink
 * frame read as an empty box: the 1-row counters cannot hold a ring, and cream on straw is too faint to carry the
 * diagonal. Dark strokes carry it; the light ring keeps it off a dark neighbour.
 */
export function drawZGlyph(ctx: CanvasRenderingContext2D, it: TopItem): void { drawGlyph(ctx, Z_ROWS, 6, it.x, it.y, it.sc, it.c1, it.c0, false); }
/** Top-pass draw: one dazed star (it.x, it.y = its top-left; c0 = fill `#f8f4ec`, c1 = ink). */
export function drawStarGlyph(ctx: CanvasRenderingContext2D, it: TopItem): void { drawGlyph(ctx, STAR_ROWS, 5, it.x, it.y, it.sc, it.c0, it.c1, true); }

/** Crumb lifetime, frames from the chomp. */
export const CRUMB_LIFE = 36;
const CRUMB_G = 0.15;

/**
 * Where crumb k of an eat bite is `age` frames after the chomp, relative to the mouth, root-space px (into `out`;
 * out.z = its size, 0 = gone). A seeded ballistic spray (forward and back from the bowl) that lands at `floorDy`
 * below the mouth, at most CRUMB_REACH px from it (a crumb 10-25 px out read as litter, not as the bowl's), and
 * lies there. It stays 2 x 2 for its whole life and then is gone (5.2: crumbs >= 2 x 2 is a hard rule; shrunk in
 * steps it spent two-thirds of its life as a 1 px speck) -- floor-level, so never faded by alpha either (5.4).
 */
export function crumbAt(seed: number, k: number, age: number, floorDy: number, out: { x: number; y: number; z: number }): void {
  if (age < 0 || age >= CRUMB_LIFE) { out.z = 0; return; }
  const h1 = hash01(seed + 11, k), h2 = hash01(seed + 29, k);
  const vy = -(0.7 + 0.9 * h2);
  // time to reach the floor: vy t + g t^2 / 2 = floorDy
  const land = (-vy + Math.sqrt(vy * vy + 2 * CRUMB_G * Math.max(0, floorDy))) / CRUMB_G;
  const vx = Math.min(0.35 + 0.8 * h1, CRUMB_REACH / Math.max(1, land)) * (k % 2 ? 1 : -0.7);
  const t = Math.min(age, land);
  out.x = Math.round(vx * t); out.y = Math.min(Math.floor(floorDy), Math.round(vy * t + CRUMB_G * t * t / 2));
  out.z = 2;
}
/** How far from the mouth a crumb may land, px (about the bowl's half-width). */
const CRUMB_REACH = 8;
