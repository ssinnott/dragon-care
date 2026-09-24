// The dragon gallery: every view the art pipeline screenshots (docs/ART_BIBLE.md 5.1, 5.5), query-string driven.
//
// THE CONTRACT with tools/shot.ts: the query string picks the view, the anim and a frozen time `t` (60 Hz steps from
// the anim's start); with `t` the page draws exactly that frame and then sets window.__dragonCare.ready. Without `t`
// it runs live (keyboard: arrows / space cycle views, number keys pick anims) and sets ready after the first frame.
//
//   view=lineup (default)      18 dragons: six element columns (bible order) x baby / young / adult rows
//   view=silhouette            all 18 flat #1a1018 + the /3 area-coverage reduction at 3 sub-pixel phases (5.1 #1)
//   view=stages&el=<id>        one element's three stages side by side at scale 3
//   view=grey | view=cvd       the lineup in greyscale / simulated deuteranopia (post-processed)
//   view=strip&el=&stage=&anim=&n=   n evenly spaced frames of one anim, numbered, scale 2
//   view=habitat               640 x 360, straw floor, 8 mixed dragons, y-sorted, top-pass particles
//   params: anim, mood (-1..1), t, scale, bg, seed
import { drawText } from './lib/engine/text.ts';
import { dragonBuild } from './art/dragon/build.ts';
import { buildDragon, drawDragon, stepDragon } from './art/dragon/rig.ts';
import type { DragonRig, DrawDragonOpts } from './art/dragon/rig.ts';
import { DragonAnimPlayer, ADULT_BLINK, BABY_BLINK } from './art/dragon/anim.ts';
import { dragonAnims, ANIM_NAMES } from './art/dragon/anims.ts';
import { ELEMENTS, ELEMENT_IDS } from './art/dragon/elements/index.ts';
import { STAGES } from './art/dragon/stages.ts';
import { DP, DFACE } from './art/dragon/pose.ts';
import type { DFaceName, PartialDragonPose } from './art/dragon/pose.ts';
import type { Stage } from './art/dragon/stages.ts';
import type { DragonElement } from './art/dragon/palettes.ts';
import { TopPass, AmbientBudget } from './art/dragon/fx.ts';

/** The reference habitat floor (5.4, gate i). */
export const STRAW = '#e0d6b8';
const INK = '#1a1018';
const LABEL = '#3a2a30';

export const VIEWS = ['lineup', 'silhouette', 'stages', 'grey', 'cvd', 'strip', 'habitat', 'zoom', 'cast', 'mood', 'faces'] as const;
export type View = typeof VIEWS[number];

export interface GalleryParams {
  view: View;
  anim: string;
  mood: number;
  /** Frozen time in 60 Hz steps; null = live. */
  t: number | null;
  scale: number | null;
  bg: string | null;
  el: DragonElement;
  stage: Stage;
  n: number;
  seed: number;
  /** A static pose overlay (face, jaw, wing fold, sleep, tuck, fx): when set, pets hold it instead of playing `anim`. */
  pose: PartialDragonPose | null;
  /** Draw-option checks: the flash and tint offscreen passes. */
  flash: boolean;
  tint: string | null;
}

export function parseParams(search: string): GalleryParams {
  const q = new URLSearchParams(search);
  const num = (k: string, d: number) => { const v = q.get(k); return v != null && v !== '' && isFinite(Number(v)) ? Number(v) : d; };
  const view = (VIEWS as readonly string[]).includes(q.get('view') || '') ? q.get('view') as View : 'lineup';
  const el = (ELEMENT_IDS as readonly string[]).includes(q.get('el') || '') ? q.get('el') as DragonElement : 'fire';
  const stage = (STAGES as readonly string[]).includes(q.get('stage') || '') ? q.get('stage') as Stage : 'adult';
  return {
    view, el, stage,
    anim: q.get('anim') || 'idle',
    mood: Math.max(-1, Math.min(1, num('mood', 0))),
    t: q.has('t') ? Math.max(0, Math.round(num('t', 0))) : null,
    scale: q.has('scale') ? num('scale', 1) : null,
    bg: q.get('bg'),
    n: Math.max(1, Math.min(24, Math.round(num('n', 8)))),
    seed: Math.round(num('seed', 1)),
    pose: poseParams(q),
    flash: q.get('flash') === '1',
    tint: q.get('tint') ? '#' + (q.get('tint') || '').replace('#', '') : null,
  };
}

/** face=, jaw=, wing=, flap=, sleep=, tuck=, fx=, gulp=, flare=, bristle= as a static pose overlay (null if none). */
function poseParams(q: URLSearchParams): PartialDragonPose | null {
  const keys = ['jaw', 'wing', 'flap', 'sleep', 'tuck', 'fx', 'gulp', 'flare', 'bristle'];
  if (!q.has('face') && !keys.some((k) => q.has(k))) return null;
  const n = (k: string) => (q.has(k) ? Number(q.get(k)) : undefined);
  return DP({ face: (q.get('face') || 'neutral') as DFaceName, jaw: n('jaw'), wing: [n('wing') ?? 0, n('flap') ?? 0], sleep: n('sleep'), tuck: n('tuck'),
    fx: n('fx'), gulp: n('gulp'), flare: n('flare'), bristle: n('bristle') });
}

// ---------- pets: a rig + a player + where it stands ----------

export interface Pet {
  rig: DragonRig;
  player: DragonAnimPlayer;
  x: number;
  y: number;
  facing: number;
  scale: number;
  mood: number;
  label: string;
}

export function makePet(el: DragonElement, stage: Stage, seed: number, anim: string, x: number, y: number,
  opts: { scale?: number; facing?: number; mood?: number; desync?: boolean; blink?: boolean } = {}): Pet {
  const build = dragonBuild({ element: el, stage, seed });
  const rig = buildDragon(build);
  const player = new DragonAnimPlayer(dragonAnims(stage, build.spec), seed, stage === 'baby' ? BABY_BLINK : ADULT_BLINK);
  player.blink = opts.blink !== false;
  const desync = opts.desync !== false;
  player.play(anim, { restart: true, phase: desync ? build.phase : 0, speed: desync ? build.speed : 1 });
  if (STATIC_POSE) player.setStaticPose(STATIC_POSE);
  return {
    rig, player, x, y, facing: opts.facing ?? 1, scale: opts.scale ?? 1, mood: opts.mood ?? 0,
    label: `${ELEMENTS[el].name} ${stage}`,
  };
}

/** The query's static pose overlay, applied to every pet a scene makes (set by startGallery). */
let STATIC_POSE: PartialDragonPose | null = null;
/** The query's flash / tint, applied at draw time. */
let FLASH = false, TINT: string | null = null;

function petOpts(p: Pet, extra: Partial<DrawDragonOpts> = {}): DrawDragonOpts {
  return { x: p.x, y: p.y, facing: p.facing, scale: p.scale, mood: p.mood, flash: FLASH, tint: TINT, tintAlpha: 0.35, ...extra };
}

/** Advance a pet one 60 Hz step (anim + rig). */
export function stepPet(p: Pet): void {
  p.player.tick();
  stepDragon(p.rig, p.player.pose, petOpts(p));
}

/** Freeze a pet at frame t: replay t steps from its start, so the frame is deterministic. */
function seekPet(p: Pet, t: number): void { for (let i = 0; i < t; i++) stepPet(p); }

// ---------- the scene ----------

interface Scene {
  w: number;
  h: number;
  pets: Pet[];
  /** Draw the whole view (pets already stepped). */
  draw(ctx: CanvasRenderingContext2D): void;
}

const top = new TopPass(160);
const budget = new AmbientBudget();
let frame = 0;

function drawPets(ctx: CanvasRenderingContext2D, pets: Pet[], extra: Partial<DrawDragonOpts> = {}): void {
  // y-sort by the feet (5.4)
  const order = pets.slice().sort((a, b) => a.y - b.y);
  budget.begin(order.length, frame);
  for (let i = 0; i < order.length; i++) {
    const p = order[i];
    drawDragon(ctx, p.rig, p.player.pose, petOpts(p, { still: true, top, budget, slot: i, ...extra }));
  }
  top.flush(ctx);
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color = LABEL, size = 1): void {
  drawText(ctx, text, x, y, { size, color, align: 'center', shadow: false });
}

/** Lineup rows: [top, height] per stage. Each row fits its stage with wings spread (adult: ~75 px above ground). */
const ROWS: Readonly<Record<Stage, readonly [number, number]>> = { baby: [0, 140], young: [140, 180], adult: [320, 220] };

function lineupScene(P: GalleryParams): Scene {
  // scale 1 is the game scale; a larger scale renders the same layout proportionally larger (hi-res, not pixel zoom)
  const sc = P.scale || 1, cellW = 160 * sc;
  const pets: Pet[] = [];
  STAGES.forEach((st, r) => ELEMENT_IDS.forEach((el, c) => {
    const [top, h] = ROWS[st];
    const x = c * cellW + Math.round(cellW * 0.56), y = (top + h - 30) * sc;
    pets.push(makePet(el, st, P.seed + c * 7 + r * 131, P.anim, x, y, { mood: P.mood, scale: sc }));
  }));
  return {
    w: cellW * 6, h: 540 * sc, pets,
    draw(ctx) {
      ctx.fillStyle = P.bg || STRAW; ctx.fillRect(0, 0, this.w, this.h);
      drawPets(ctx, pets);
      for (const p of pets) label(ctx, p.label, p.x - 8 * sc, p.y + 10 * sc, LABEL, sc);
    },
  };
}

function stagesScene(P: GalleryParams): Scene {
  const sc = P.scale || 3;
  // baby, young, adult left to right, spaced by their real extents (tail back, snout front) at this scale
  const pets = STAGES.map((st) => makePet(P.el, st, P.seed, P.anim, 0, 400, { scale: sc, mood: P.mood }));
  const ext = pets.map((p) => {
    const d = p.rig.dims, tail = d.hipR + d.gap / 2 + d.tail.n * d.tail.len + 6, head = d.gap / 2 + d.chestR + d.headLen + 4;
    return [tail * sc, head * sc];
  });
  const total = ext.reduce((a, e) => a + e[0] + e[1], 0), gap = Math.max(8, (960 - total) / 4);
  let x = gap;
  pets.forEach((p, i) => { p.x = Math.round(x + ext[i][0]); x += ext[i][0] + ext[i][1] + gap; });
  return {
    w: Math.max(960, Math.ceil(x)), h: 540, pets,
    draw(ctx) {
      ctx.fillStyle = P.bg || STRAW; ctx.fillRect(0, 0, this.w, this.h);
      drawPets(ctx, pets);
      label(ctx, `${ELEMENTS[P.el].name} (${P.el})  ${P.anim}  mood ${P.mood}`, this.w / 2, 12, LABEL, 2);
      for (const p of pets) label(ctx, p.label, p.x, p.y + 24, LABEL, 2);
    },
  };
}

/**
 * view=zoom: one dragon (el, stage) drawn at game scale 1 and blown up `scale` times (default 6) with nearest
 * neighbour, so every game pixel is visible: this is how the sprite really looks, unlike a scale-3 render.
 */
function zoomScene(P: GalleryParams): Scene {
  const k = Math.max(1, Math.round(P.scale || 6));
  const p = makePet(P.el, P.stage, P.seed, P.anim, 0, 0, { mood: P.mood });
  const d = p.rig.dims;
  const back = Math.ceil(d.hipR + d.gap / 2 + d.tail.n * d.tail.len + 16), front = Math.ceil(d.gap / 2 + d.chestR + d.headLen + 16);
  const w = back + front, h = Math.ceil(d.bodyY + d.head.cranR * 2 + (d.neck.hidden ? 14 : d.neck.len * 2 + 14) + 26);
  p.x = back; p.y = h - 6;
  const off = document.createElement('canvas');
  off.width = w; off.height = h;
  return {
    w: w * k, h: h * k, pets: [p],
    draw(ctx) {
      const g = off.getContext('2d')!;
      g.fillStyle = P.bg || STRAW; g.fillRect(0, 0, w, h);
      drawPets(g, [p]);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, 0, 0, w * k, h * k);
    },
  };
}

/**
 * view=cast&stage=: all six elements of one stage drawn at game scale 1 and blown up `scale` times (default 4) with
 * nearest neighbour, 3 x 2: the pixel-level contact sheet for one stage.
 */
function castScene(P: GalleryParams): Scene {
  const k = Math.max(1, Math.round(P.scale || 4));
  const cw = P.stage === 'adult' ? 150 : P.stage === 'young' ? 116 : 70, ch = P.stage === 'adult' ? 84 : P.stage === 'young' ? 68 : 52;
  const pets = ELEMENT_IDS.map((el, i) => makePet(el, P.stage, P.seed + i * 7, P.anim, (i % 3) * cw + Math.round(cw * 0.6), Math.floor(i / 3) * ch + ch - 7, { mood: P.mood }));
  const off = document.createElement('canvas');
  off.width = cw * 3; off.height = ch * 2;
  return {
    w: cw * 3 * k, h: ch * 2 * k, pets,
    draw(ctx) {
      const g = off.getContext('2d')!;
      g.fillStyle = P.bg || STRAW; g.fillRect(0, 0, off.width, off.height);
      drawPets(g, pets);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, 0, 0, off.width * k, off.height * k);
    },
  };
}

/**
 * view=mood&stage=: the mood gauge (D7) -- every element at mood -1, 0 and +1 (columns), and asleep, one stage,
 * game scale 1 blown up `scale` times (default 2). The cue must keep >= 60 % of its silhouette at -1.
 */
function moodScene(P: GalleryParams): Scene {
  const k = Math.max(1, Math.round(P.scale || 2));
  const cw = P.stage === 'adult' ? 132 : P.stage === 'young' ? 104 : 64, ch = P.stage === 'adult' ? 84 : P.stage === 'young' ? 68 : 52;
  const moods = [-1, 0, 1];
  const pets: Pet[] = [];
  ELEMENT_IDS.forEach((el, r) => moods.forEach((m, c) => {
    pets.push(makePet(el, P.stage, P.seed + r * 7, P.anim, c * cw + Math.round(cw * 0.6), r * ch + ch - 7, { mood: m, blink: false }));
  }));
  // a fourth column: asleep (pose.sleep), mood -1
  const asleep: Pet[] = ELEMENT_IDS.map((el, r) => {
    const p = makePet(el, P.stage, P.seed + r * 7, 'rest', 3 * cw + Math.round(cw * 0.6), r * ch + ch - 7, { mood: -1, blink: false });
    p.player.setStaticPose({ sleep: 1 });
    return p;
  });
  const all = pets.concat(asleep);
  const off = document.createElement('canvas');
  off.width = cw * 4; off.height = ch * 6 + 12;
  return {
    w: off.width * k, h: off.height * k, pets: all,
    draw(ctx) {
      const g = off.getContext('2d')!;
      g.fillStyle = P.bg || STRAW; g.fillRect(0, 0, off.width, off.height);
      drawPets(g, all);
      ['MOOD -1', 'MOOD 0', 'MOOD +1', 'ASLEEP'].forEach((t, i) => label(g, t, i * cw + cw / 2, ch * 6 + 3, LABEL, 1));
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, 0, 0, off.width * k, off.height * k);
    },
  };
}

/**
 * view=faces&el=&stage=: the 11 DFACE faces (2.5) on one element and stage, cropped to the head at game scale 1 and
 * blown up `scale` times (default 6): the eye construction, lids in rows, brow, blush and mouth marks.
 */
function facesScene(P: GalleryParams): Scene {
  const k = Math.max(1, Math.round(P.scale || 6));
  const names = Object.keys(DFACE) as DFaceName[];
  const cell = 44, lab = 9, cols = 6, rows = Math.ceil(names.length / cols);
  const pets = names.map((f) => {
    const p = makePet(P.el, P.stage, P.seed, 'rest', 0, 0, { mood: P.mood, blink: false, desync: false });
    p.player.setStaticPose({ ...(STATIC_POSE || {}), face: DFACE[f], jaw: f === 'happy' && P.stage === 'baby' ? 20 : f === 'surprised' ? 40 : (STATIC_POSE?.jaw ?? 0) });
    return p;
  });
  const off = document.createElement('canvas');
  off.width = cell * cols; off.height = (cell + lab) * rows;
  return {
    w: off.width * k, h: off.height * k, pets,
    draw(ctx) {
      const g = off.getContext('2d')!;
      g.fillStyle = P.bg || STRAW; g.fillRect(0, 0, off.width, off.height);
      const tmp = document.createElement('canvas'); tmp.width = 400; tmp.height = 200;
      const t = tmp.getContext('2d')!;
      pets.forEach((p, i) => {
        t.fillStyle = P.bg || STRAW; t.fillRect(0, 0, 400, 200);
        p.x = 200; p.y = 150;
        drawDragon(t, p.rig, p.player.pose, petOpts(p, { still: true }));
        const e = p.rig.j.eye;
        const sx = Math.round(200 + e.x - cell / 2 + 4), sy = Math.round(150 + e.y - cell / 2);
        g.drawImage(tmp, sx, sy, cell, cell, (i % cols) * cell, Math.floor(i / cols) * (cell + lab), cell, cell);
        label(g, names[i], (i % cols) * cell + cell / 2, Math.floor(i / cols) * (cell + lab) + cell + 1, LABEL, 1);
      });
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, 0, 0, off.width * k, off.height * k);
    },
  };
}

function stripScene(P: GalleryParams): Scene {
  const sc = P.scale || 2;
  const probe = makePet(P.el, P.stage, P.seed, P.anim, 0, 0, { desync: false });
  const L = probe.player.length || 60;
  const d = probe.rig.dims;
  const cellW = Math.ceil((d.bodyLen + d.tail.n * d.tail.len + d.headLen + 20) * sc), cellH = Math.ceil((d.bodyY + 60) * sc);
  const cols = Math.max(1, Math.min(P.n, Math.floor(960 / cellW))), rows = Math.ceil(P.n / cols);
  const pets: Pet[] = [];
  const frames: number[] = [];
  for (let i = 0; i < P.n; i++) {
    const f = Math.round(i * L / P.n);
    frames.push(f);
    const c = i % cols, r = Math.floor(i / cols);
    const p = makePet(P.el, P.stage, P.seed, P.anim, c * cellW + Math.round(cellW * 0.55), r * cellH + cellH - 22, { scale: sc, desync: false, mood: P.mood });
    seekPet(p, f);
    pets.push(p);
  }
  return {
    w: Math.max(960, cols * cellW), h: Math.max(540, rows * cellH + 16), pets,
    draw(ctx) {
      ctx.fillStyle = P.bg || STRAW; ctx.fillRect(0, 0, this.w, this.h);
      drawPets(ctx, pets);
      pets.forEach((p, i) => label(ctx, `F${frames[i]}`, p.x, p.y + 8, LABEL, 1));
      label(ctx, `${ELEMENTS[P.el].name} ${P.stage} ${P.anim} (${L} F)`, this.w / 2, this.h - 10, LABEL, 1);
    },
  };
}

function habitatScene(P: GalleryParams): Scene {
  const cast: [DragonElement, Stage, number, number, number][] = [
    ['spike', 'adult', 470, 170, -1], ['shriekscale', 'young', 168, 182, 1],
    ['rock', 'adult', 120, 262, 1], ['fire', 'young', 330, 236, 1], ['water', 'adult', 520, 282, -1],
    ['lightning', 'baby', 250, 318, 1], ['spike', 'baby', 80, 336, 1], ['fire', 'baby', 372, 340, -1],
  ];
  const pets = cast.map(([el, st, x, y, f], i) => makePet(el, st, P.seed + i * 17, P.anim, x, y, { facing: f, mood: P.mood }));
  return {
    w: 640, h: 360, pets,
    draw(ctx) {
      ctx.fillStyle = P.bg || STRAW; ctx.fillRect(0, 0, this.w, this.h);
      drawPets(ctx, pets);
    },
  };
}

// ---------- silhouette sheet (5.1 #1) ----------

function silhouetteScene(P: GalleryParams): Scene {
  const cellW = 160, cellH = 110, W = cellW * 6, H = cellH * 3;
  const pets: Pet[] = [];
  STAGES.forEach((st, r) => ELEMENT_IDS.forEach((el, c) => {
    pets.push(makePet(el, st, P.seed + c * 7 + r * 131, P.anim, c * cellW + Math.round(cellW * 0.56), r * cellH + cellH - 14, { mood: P.mood }));
  }));
  return {
    w: 960, h: 540, pets,
    draw(ctx) {
      const light = P.bg || '#f4efe2';
      ctx.fillStyle = light; ctx.fillRect(0, 0, this.w, this.h);
      // the full-size sheet: everything one flat ink colour, no shadows or particles
      const sheet = document.createElement('canvas');
      sheet.width = W; sheet.height = H;
      const g = sheet.getContext('2d')!;
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
      for (const p of pets) drawDragon(g, p.rig, p.player.pose, petOpts(p, { still: true, silhouette: true }));
      ctx.drawImage(sheet, 0, 0);
      // the /3 area-coverage reductions: a reduced pixel is ink when >= 50 % of its 3 x 3 source box is covered
      const src = g.getImageData(0, 0, W, H).data;
      const RW = W / 3, RH = H / 3, y0 = H + 18;
      for (let ph = 0; ph < 3; ph++) {
        const out = ctx.createImageData(RW, RH);
        for (let Y = 0; Y < RH; Y++) for (let X = 0; X < RW; X++) {
          let cov = 0;
          for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) {
            const sx = X * 3 + dx - ph, sy = Y * 3 + dy - ph;
            if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
            cov += (255 - src[(sy * W + sx) * 4]) / (255 - 0x1a);
          }
          const o = (Y * RW + X) * 4, ink = cov / 9 >= 0.5;
          out.data[o] = ink ? 0x1a : 0xf4; out.data[o + 1] = ink ? 0x10 : 0xef; out.data[o + 2] = ink ? 0x18 : 0xe2; out.data[o + 3] = 255;
        }
        ctx.putImageData(out, ph * RW, y0);
        label(ctx, `/3 PHASE ${ph}`, ph * RW + RW / 2, y0 + RH + 6, LABEL, 1);
      }
      label(ctx, 'SILHOUETTE: FLAT INK AT IDLE, THEN /3 AREA COVERAGE (INK >= 50 %) AT 3 SUB-PIXEL PHASES', 480, this.h - 12, LABEL, 1);
    },
  };
}

// ---------- post-processes ----------

function lin(c: number): number { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }
function unlin(v: number): number { const c = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055; return Math.max(0, Math.min(255, Math.round(c * 255))); }
/** Vienot, Brettel & Mollon (1999) deuteranopia, the matrix tools/palette-check.ts gate (f) uses. */
const DEUTAN = [0.29275, 0.70725, 0, 0.29275, 0.70725, 0, -0.02234, 0.02234, 1];

function postProcess(ctx: CanvasRenderingContext2D, w: number, h: number, kind: 'grey' | 'cvd'): void {
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  const LUT = new Float32Array(256);
  for (let i = 0; i < 256; i++) LUT[i] = lin(i);
  for (let i = 0; i < d.length; i += 4) {
    const r = LUT[d[i]], g = LUT[d[i + 1]], b = LUT[d[i + 2]];
    if (kind === 'grey') { const y = unlin(0.2126 * r + 0.7152 * g + 0.0722 * b); d[i] = d[i + 1] = d[i + 2] = y; }
    else {
      const m = DEUTAN;
      d[i] = unlin(m[0] * r + m[1] * g + m[2] * b); d[i + 1] = unlin(m[3] * r + m[4] * g + m[5] * b); d[i + 2] = unlin(m[6] * r + m[7] * g + m[8] * b);
    }
  }
  ctx.putImageData(img, 0, 0);
}

// ---------- running it ----------

function makeScene(P: GalleryParams): Scene {
  switch (P.view) {
    case 'stages': return stagesScene(P);
    case 'strip': return stripScene(P);
    case 'habitat': return habitatScene(P);
    case 'silhouette': return silhouetteScene(P);
    case 'zoom': return zoomScene(P);
    case 'cast': return castScene(P);
    case 'mood': return moodScene(P);
    case 'faces': return facesScene(P);
    default: return lineupScene(P);
  }
}

function render(ctx: CanvasRenderingContext2D, scene: Scene, P: GalleryParams, live: boolean): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  scene.draw(ctx);
  if (P.view === 'grey' || P.view === 'cvd') {
    postProcess(ctx, scene.w, scene.h, P.view);
    label(ctx, P.view === 'grey' ? 'GREYSCALE' : 'SIMULATED DEUTERANOPIA', scene.w / 2, 4, P.view === 'grey' ? '#303030' : LABEL, 1);
  }
  if (live) label(ctx, `${P.view.toUpperCase()}  ANIM ${P.anim.toUpperCase()}   ARROWS/SPACE: VIEW  1-${ANIM_NAMES.length}: ANIM  E: ELEMENT`, scene.w / 2, scene.h - 10, '#5a4850', 1);
}

/** Start the gallery on a canvas; resolves once the requested frame is drawn. */
export function startGallery(canvas: HTMLCanvasElement, search: string, onReady: () => void): void {
  const ctx = canvas.getContext('2d')!;
  let P = parseParams(search);
  STATIC_POSE = P.pose; FLASH = P.flash; TINT = P.tint;
  let scene = makeScene(P);
  const size = () => { canvas.width = scene.w; canvas.height = scene.h; };
  size();
  if (P.t != null) {
    // frozen: replay t steps from each pet's start (strip pets are already seeked)
    if (P.view !== 'strip') for (const p of scene.pets) seekPet(p, P.t);
    frame = P.t;
    render(ctx, scene, P, false);
    onReady();
    return;
  }
  let first = true;
  const rebuild = () => { scene = makeScene(P); size(); };
  window.addEventListener('keydown', (e) => {
    const vi = VIEWS.indexOf(P.view);
    if (e.key === 'ArrowRight' || e.key === ' ') { P = { ...P, view: VIEWS[(vi + 1) % VIEWS.length] }; rebuild(); }
    else if (e.key === 'ArrowLeft') { P = { ...P, view: VIEWS[(vi + VIEWS.length - 1) % VIEWS.length] }; rebuild(); }
    else if (e.key === 'e' || e.key === 'E') { P = { ...P, el: ELEMENT_IDS[(ELEMENT_IDS.indexOf(P.el) + 1) % ELEMENT_IDS.length] }; rebuild(); }
    else if (/^[1-9]$/.test(e.key) && ANIM_NAMES[Number(e.key) - 1]) { P = { ...P, anim: ANIM_NAMES[Number(e.key) - 1] }; rebuild(); }
    else return;
    e.preventDefault();
  });
  let acc = 0, last = 0;
  const loop = (now: number) => {
    if (!last) last = now;
    acc = Math.min(acc + (now - last) / (1000 / 60), 5); last = now;
    while (acc >= 1) { if (P.view !== 'strip') for (const p of scene.pets) stepPet(p); frame++; acc -= 1; }
    render(ctx, scene, P, true);
    if (first) { first = false; onReady(); }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
