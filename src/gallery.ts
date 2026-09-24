// The dragon gallery: every view the art pipeline screenshots (docs/ART_BIBLE.md 5.1, 5.5), query-string driven.
//
// THE CONTRACT with tools/shot.ts: the query string picks the view, the anim and a frozen time `t` (60 Hz steps from
// the anim's start); with `t` the page draws exactly that frame and then sets window.__dragonCare.ready. Without `t`
// it runs live (keyboard: arrows / space cycle views, number keys pick anims) and sets ready after the first frame.
//
//   view=lineup (default)      28 dragons: seven element columns (bible order) x baby / young / adult / elder rows
//   view=silhouette            all 28 flat #1a1018 + the /3 area-coverage reduction at 3 sub-pixel phases (5.1 #1);
//                              &set=all stacks idle, lowest mood and asleep on one sheet
//   view=stages&el=<id>        one element's four stages side by side at scale 3
//   view=wings                 every elder's worn wings (2.9), pixel zoom: full spread (the hole), the airing's hold
//                              (the hole at home) and the resting spread of the preen (the tears)
//   view=grey | view=cvd       the lineup in greyscale / simulated deuteranopia (post-processed)
//   view=strip&el=&stage=&anim=&n=   n evenly spaced frames of one anim, numbered, scale 2; from= / span= pick the
//                              frames (a walk defaults to one cycle, over ground ticks that scroll with its `move`)
//   view=habitat               640 x 360, straw floor, 8 mixed dragons, y-sorted, top-pass particles; walkers roam
//                              (two overlapping pairs hold their places); anim=mix plays every act at once
//   view=floor | view=roots    the floor audit (nothing sinks through y = 0) and the leg-root audit (no far leg floats
//                              free of the body); els= / stages= / anims= narrow them
//   anim: idle walk happy eat sleep wake breath pet beg rest (anims.ts ANIM_NAMES), and by name any variant or an
//   element anim (bath, upset, call); one-shots replay after a pause, an eating pet gets a bowl drawn after it
//   params: anim, mood (-1..1), t, scale, bg, seed, facing (-1: zoom and strip mirrored), bond (0..1, default 1),
//   charge (0..1); a static pose overlay: face, jaw, wing, flap, sleep, tuck, fx, gulp, flare, bristle,
//   body=<rot>,<y>, head, pupil; wear=0 draws the elders without their tears and hole (2.9's with / without measure)
import { drawText } from './lib/engine/text.ts';
import { dragonBuild } from './art/dragon/build.ts';
import { buildDragon, drawDragon, stepDragon, solveDragon, rootToScreen } from './art/dragon/rig.ts';
import { legRadii } from './art/dragon/parts.ts';
import type { DragonRig, DrawDragonOpts } from './art/dragon/rig.ts';
import { DragonAnimPlayer, blinkFor } from './art/dragon/anim.ts';
import { dragonAnims, ANIM_NAMES, ONE_SHOTS, VARIANT_NAMES, ELEMENT_ANIM_NAMES, idleVariants, variantEvery } from './art/dragon/anims.ts';
import { ELEMENTS, ELEMENT_IDS } from './art/dragon/elements/index.ts';
import { STAGES } from './art/dragon/stages.ts';
import { DP, DFACE, ACT } from './art/dragon/pose.ts';
import type { DFaceName, PartialDragonPose } from './art/dragon/pose.ts';
import type { Stage } from './art/dragon/stages.ts';
import type { DragonElement } from './art/dragon/palettes.ts';
import { TopPass, AmbientBudget } from './art/dragon/fx.ts';

/** The reference habitat floor (5.4, gate i). */
export const STRAW = '#e0d6b8';
const INK = '#1a1018';
const LABEL = '#3a2a30';

export const VIEWS = ['lineup', 'silhouette', 'stages', 'grey', 'cvd', 'strip', 'habitat', 'zoom', 'cast', 'mood', 'faces', 'floor', 'roots', 'wings'] as const;
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
  /** view=zoom / strip: 1 = facing right (default), -1 = mirrored (the facing checks of 1.1: light and face marks). */
  facing: number;
  /** Every pet's bond (0..1, rock's crystal count: 3.4) and boredom charge (0..1, lightning's crackle: 3.5). */
  bond: number;
  charge: number;
  /** A static pose overlay (face, jaw, wing fold, sleep, tuck, fx): when set, pets hold it instead of playing `anim`. */
  pose: PartialDragonPose | null;
  /** view=silhouette: 'all' stacks idle, lowest mood and asleep on one sheet (5.1 #1). */
  set: string | null;
  /** view=strip: the frames the n shots span (default: the anim; a walk: one cycle) and the first frame. */
  span: number | null;
  from: number;
  /** Draw-option checks: the flash and tint offscreen passes. */
  flash: boolean;
  tint: string | null;
  /** view=floor: which anims, elements and stages to audit (comma lists; null = all). */
  anims: string[] | null;
  els: DragonElement[] | null;
  stages: Stage[] | null;
  /** wear=0: the elders draw without their tears and hole (2.9), for measuring what the wear opens against the same frame. */
  wear: boolean;
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
    span: q.has('span') ? Math.max(1, Math.round(num('span', 60))) : null,
    from: Math.max(0, Math.round(num('from', 0))),
    seed: Math.round(num('seed', 1)),
    facing: num('facing', 1) < 0 ? -1 : 1,
    bond: Math.max(0, Math.min(1, num('bond', 1))),
    charge: Math.max(0, Math.min(1, num('charge', 0))),
    pose: poseParams(q),
    set: q.get('set'),
    flash: q.get('flash') === '1',
    tint: q.get('tint') ? '#' + (q.get('tint') || '').replace('#', '') : null,
    anims: q.get('anims') ? (q.get('anims') || '').split(',') : null,
    els: q.get('els') ? (q.get('els') || '').split(',').filter((e) => (ELEMENT_IDS as readonly string[]).includes(e)) as DragonElement[] : null,
    stages: q.get('stages') ? (q.get('stages') || '').split(',').filter((s) => (STAGES as readonly string[]).includes(s)) as Stage[] : null,
    wear: q.get('wear') !== '0',
  };
}

/**
 * face=, jaw=, wing=, flap=, sleep=, tuck=, fx=, gulp=, flare=, bristle=, body=<rot>,<y>, head=<rot>, pupil= as a
 * static pose overlay (null if none).
 */
function poseParams(q: URLSearchParams): PartialDragonPose | null {
  const keys = ['jaw', 'wing', 'flap', 'sleep', 'tuck', 'fx', 'gulp', 'flare', 'bristle', 'body', 'head', 'pupil'];
  if (!q.has('face') && !keys.some((k) => q.has(k))) return null;
  const n = (k: string) => (q.has(k) ? Number(q.get(k)) : undefined);
  const body = (q.get('body') || '').split(',').map(Number);
  return DP({ face: (q.get('face') || 'neutral') as DFaceName, jaw: n('jaw'), wing: [n('wing') ?? 0, n('flap') ?? 0], sleep: n('sleep'), tuck: n('tuck'),
    fx: n('fx'), gulp: n('gulp'), flare: n('flare'), bristle: n('bristle'), head: n('head'), pupil: n('pupil'),
    body: q.has('body') ? [body[0] || 0, body[1] || 0] : undefined });
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
  /** The anim the gallery asked for (a one-shot replays after a pause, so a live view keeps showing it). */
  anim: string;
  /** Frames the finished one-shot has been held. */
  hold: number;
  /** World distance walked, px along facing (the sum of the frames' `move`): the strip's ground ticks scroll by it. */
  wx: number;
  /** The eat bowl, root-space x of its centre and its height, px (null = no bowl). */
  bowl: { x: number; h: number; w: number } | null;
  /** Roaming: the pet really moves by its frames' `move` along facing, wrapping inside [x0, x1] (the habitat). */
  roam: readonly [number, number] | null;
  /** How wary the pet is of the nearest other dragon, 0..1 eased, and its latch (stepWary; DrawDragonOpts.wary). */
  wary: number;
  waryOn: boolean;
}

export function makePet(el: DragonElement, stage: Stage, seed: number, anim: string, x: number, y: number,
  opts: { scale?: number; facing?: number; mood?: number; desync?: boolean; blink?: boolean } = {}): Pet {
  const build = dragonBuild({ element: el, stage, seed });
  const rig = buildDragon(build);
  // (wear=0: the same elder without its tears and hole, the other half of 2.9's with / without measure)
  if (!WEAR) rig.sp = { ...rig.sp, wing: { ...rig.sp.wing, tears: undefined, hole: undefined } };
  const anims = dragonAnims(stage, build.spec, build.dims);
  const player = new DragonAnimPlayer(anims, seed, blinkFor(stage));
  player.blink = opts.blink !== false;
  const desync = opts.desync !== false;
  player.play(anim, { restart: true, phase: desync ? build.phase : 0, speed: desync ? build.speed : 1 });
  // an idle pet cuts to a look-around, a yawn, a scratch or its element's fidget every 6-10 s (the elder to its back
  // stretch, reminisce or airing too, every 8-12 s; rock's elder, with no hole to air, reminisces), seeded: 4.2
  if (anim === 'idle') { const [a, b] = variantEvery(stage); player.setVariants('idle', idleVariants(stage, build.sp.wing), a, b); }
  if (STATIC_POSE) player.setStaticPose(STATIC_POSE);
  return {
    rig, player, x, y, facing: opts.facing ?? 1, scale: opts.scale ?? 1, mood: opts.mood ?? 0,
    label: `${ELEMENTS[el].name} ${stage}`, anim, hold: 0, wx: 0, roam: null, wary: 0, waryOn: false,
    bowl: anim === 'eat' && !STATIC_POSE ? bowlFor(rig, anims.eat ? anims.eat.frames : []) : null,
  };
}

/**
 * Where the eat bowl stands (4.2: "the bowl is drawn after the dragon"): under the snout at the chomp (the frame
 * whose act clock is 0), its rim 2 px above the mouth line, so the snout tip dips in behind the rim.
 */
function bowlFor(rig: DragonRig, frames: readonly { pose?: import('./art/dragon/pose.ts').PartialDragonPose | null }[]): { x: number; h: number; w: number } {
  const f = frames.find((fr) => fr.pose && fr.pose.act === ACT.eat && Math.abs(fr.pose.cue ?? 1) < 0.5);
  // (solved with the jaw shut: an open jaw moves the mouth anchor down into the opening)
  const J = solveDragon(rig, f && f.pose ? { ...f.pose, jaw: 0 } : {}, { x: 0, y: 0 });
  const w = rig.stage === 'adult' || rig.stage === 'elder' ? 17 : rig.stage === 'young' ? 15 : 11;
  // the bowl is drawn AFTER the dragon, so its top (the food heaped 2 px over the rim) stays >= 2 px under the eye's
  // largest box: at the rim the baby's eye sat on it (hard rule: nothing covers the eye)
  const eyeBottom = J.eye.y + rig.info.eye.h / 2;
  return { x: Math.round(J.mouth.x - 1), h: Math.max(4, Math.min(Math.round(-J.mouth.y) + 1, Math.floor(-(eyeBottom + 2) - 2))), w };
}

/** The query's static pose overlay, applied to every pet a scene makes (set by startGallery). */
let STATIC_POSE: PartialDragonPose | null = null;
/** The query's flash / tint, bond and charge, applied at draw time. */
let FLASH = false, TINT: string | null = null, BOND = 1, CHARGE = 0, WEAR = true;

function petOpts(p: Pet, extra: Partial<DrawDragonOpts> = {}): DrawDragonOpts {
  return { x: p.x, y: p.y, facing: p.facing, scale: p.scale, mood: p.mood, flash: FLASH, tint: TINT, tintAlpha: 0.35, wary: p.wary, bond: BOND, charge: CHARGE, ...extra };
}

/** The wary latch (4.3, spike's wary lean): on under this many game px to the nearest other dragon, off over WARY_OFF. */
const WARY_ON = 30, WARY_OFF = 36;
/**
 * Step every pet's wary state once per tick, before the pets step (a scene's owner does this; the game's pet
 * renderer will too): the gap to the nearest OTHER pet in game px -- between the two sprites' extents along the
 * floor (tail tip to snout, whichever way each faces) and their depth apart -- latched with hysteresis and eased
 * over about 8 f, so a dragon walking past does not flicker the lean.
 */
function stepWary(pets: readonly Pet[]): void {
  for (const p of pets) {
    const [a0, a1] = extentX(p);
    let g = Infinity;
    for (const q of pets) {
      if (q === p) continue;
      const [b0, b1] = extentX(q), dx = Math.max(0, b0 - a1, a0 - b1), dy = Math.abs(q.y - p.y);
      g = Math.min(g, Math.hypot(dx, dy) / (p.scale || 1));
    }
    if (g < WARY_ON) p.waryOn = true; else if (g > WARY_OFF) p.waryOn = false;
    p.wary += ((p.waryOn ? 1 : 0) - p.wary) / 8;
  }
}
/** A pet's screen x extent, tail tip to snout, at its facing (from the build's dims, the rest pose). */
function extentX(p: Pet): [number, number] {
  const d = p.rig.dims, s = p.scale * p.rig.scale;
  const back = (d.hipR + d.gap / 2 + d.tail.n * d.tail.len) * s, front = (d.gap / 2 + d.chestR + d.headLen) * s;
  return p.facing < 0 ? [p.x - front, p.x + back] : [p.x - back, p.x + front];
}

/** One scene tick: the scene-wide state (the wary latch, where the scene has one), then every pet. */
function stepScene(scene: Scene): void {
  if (scene.wary) stepWary(scene.pets);
  for (const p of scene.pets) stepPet(p);
}

/** Frames a finished one-shot is held before the gallery replays it (a live view keeps showing the anim). */
const REPLAY = 40;

/** Advance a pet one 60 Hz step (anim + rig). */
export function stepPet(p: Pet): void {
  if (p.player.done && p.player.name === p.anim && ONE_SHOTS.includes(p.anim) && ++p.hold >= REPLAY) {
    p.hold = 0; p.player.play(p.anim, { restart: true, blend: 8 });
  }
  p.player.tick();
  const mv = p.player.move;
  p.wx += mv;
  if (p.roam && mv) {
    // a roaming pet walks for real: the whole sprite moves, so its planted paws stand still on the floor
    const [x0, x1] = p.roam, span = x1 - x0;
    p.x = x0 + ((((p.x + p.facing * mv * p.scale) - x0) % span) + span) % span;
  }
  stepDragon(p.rig, p.player.pose, petOpts(p));
}

/** Freeze a pet at frame t: replay t steps from its start, so the frame is deterministic. */
function seekPet(p: Pet, t: number): void { for (let i = 0; i < t; i++) stepPet(p); }

/** Frames of an anim's intro (the frames before its loopFrom): the lie-down of sleep. */
function animIntro(p: Pet, name: string): number {
  const a = p.player.anims[name];
  if (!a || !a.loopFrom) return 0;
  let n = 0;
  for (let i = 0; i < a.loopFrom; i++) n += a.frames[i].dur || 1;
  return n;
}

// ---------- the scene ----------

interface Scene {
  w: number;
  h: number;
  pets: Pet[];
  /** The pets share a floor and react to each other (the habitat): stepScene runs the wary latch. */
  wary?: boolean;
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
    if (p.bowl && !extra.silhouette) drawBowl(ctx, p);
  }
  top.flush(ctx);
}

const BOWL = '#8c4a3a', BOWL_SH = '#6a3428', FOOD_TOP = '#b87a3a';
/**
 * A simple food bowl in front of an eating pet (drawn AFTER it, 4.2), whole game pixels at the pet's scale: an inked
 * clay bowl, widest at the rim and rounding in toward its foot, with a low mound of food over the rim. Its rim sits
 * a couple of px over the snout at the chomp, so the snout dips in behind it.
 */
function drawBowl(ctx: CanvasRenderingContext2D, p: Pet): void {
  const b = p.bowl!, sc = p.scale * p.rig.scale, w = b.w, h = b.h;
  const cx = Math.round(p.x + p.facing * b.x * sc), gy = Math.round(p.y);
  const px = (x: number, y: number, ww: number, hh: number, c: string) => {
    ctx.fillStyle = c; ctx.fillRect(Math.round(cx + x * sc), Math.round(gy + y * sc), Math.max(1, Math.round(ww * sc)), Math.max(1, Math.round(hh * sc)));
  };
  const half = w >> 1;
  // row r (0 = the rim, h - 1 = the foot) is inset by a curve that rounds in toward the foot
  const inset = (r: number) => Math.round(3 * Math.pow(r / Math.max(1, h - 1), 2.2));
  for (let r = 0; r < h; r++) px(-half - 1 + inset(r), -h + r, w + 2 - 2 * inset(r), 1, INK);
  px(-half + inset(h - 1), 0, w - 2 * inset(h - 1), 1, INK);
  px(-half - 1, -h - 1, w + 2, 1, INK);
  for (let r = 0; r < h; r++) px(-half + inset(r), -h + r, w - 2 * inset(r), 1, r === 0 ? BOWL_SH : r > h * 0.6 ? BOWL_SH : BOWL);
  // the food: a low mound over the rim
  px(-half + 2, -h - 2, w - 4, 1, INK); px(-half + 1, -h - 1, w - 2, 1, FOOD_TOP);
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color = LABEL, size = 1): void {
  drawText(ctx, text, x, y, { size, color, align: 'center', shadow: false });
}

/**
 * Lineup rows: [top, height] per stage. Each row fits its stage with wings spread (adult: ~75 px above ground; the
 * elder's full spread, flap 0, about 71 px, its head no higher than the adult's).
 */
const ROWS: Readonly<Record<Stage, readonly [number, number]>> = { baby: [0, 140], young: [140, 180], adult: [320, 220], elder: [540, 220] };
/** The lineup's height: the last row's bottom. */
const LINEUP_H = ROWS.elder[0] + ROWS.elder[1];

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
    w: cellW * ELEMENT_IDS.length, h: LINEUP_H * sc, pets,
    draw(ctx) {
      ctx.fillStyle = P.bg || STRAW; ctx.fillRect(0, 0, this.w, this.h);
      drawPets(ctx, pets);
      for (const p of pets) label(ctx, p.label, p.x - 8 * sc, p.y + 10 * sc, LABEL, sc);
    },
  };
}

function stagesScene(P: GalleryParams): Scene {
  const sc = P.scale || 3;
  // baby, young, adult, elder left to right, spaced by their real extents (tail back, snout front) at this scale
  const pets = STAGES.map((st) => makePet(P.el, st, P.seed, P.anim, 0, 400, { scale: sc, mood: P.mood }));
  const ext = pets.map((p) => {
    const d = p.rig.dims, tail = d.hipR + d.gap / 2 + d.tail.n * d.tail.len + 6, head = d.gap / 2 + d.chestR + d.headLen + 4;
    return [tail * sc, head * sc];
  });
  const total = ext.reduce((a, e) => a + e[0] + e[1], 0), gap = Math.max(8, (960 - total) / (STAGES.length + 1));
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
  const p = makePet(P.el, P.stage, P.seed, P.anim, 0, 0, { mood: P.mood, facing: P.facing });
  const d = p.rig.dims;
  const back = Math.ceil(d.hipR + d.gap / 2 + d.tail.n * d.tail.len + 16), front = Math.ceil(d.gap / 2 + d.chestR + d.headLen + 16);
  const w = back + front, h = Math.ceil(d.bodyY + d.head.cranR * 2 + (d.neck.hidden ? 14 : d.neck.len * 2 + 14) + 36);
  // 16 rows below the ground, and the ground row marked in both margins, so anything sinking through the floor
  // shows (1.1, 5.1 #14)
  p.x = P.facing < 0 ? front : back; p.y = h - 16;
  const off = document.createElement('canvas');
  off.width = w; off.height = h;
  return {
    w: w * k, h: h * k, pets: [p],
    draw(ctx) {
      const g = off.getContext('2d')!;
      g.fillStyle = P.bg || STRAW; g.fillRect(0, 0, w, h);
      g.fillStyle = '#b8ab88'; g.fillRect(0, p.y, 4, 1); g.fillRect(w - 4, p.y, 4, 1);
      drawPets(g, [p]);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, 0, 0, w * k, h * k);
    },
  };
}

/**
 * view=cast&stage=: every element of one stage drawn at game scale 1 and blown up `scale` times (default 4) with
 * nearest neighbour, 3 x 2 for six, 4 x 2 for seven: the pixel-level contact sheet for one stage.
 */
function castScene(P: GalleryParams): Scene {
  const k = Math.max(1, Math.round(P.scale || 4));
  // (an elder is up to 1.10x the adult's length and no taller: 2.4)
  const grownUp = P.stage === 'adult' || P.stage === 'elder';
  const cw = P.stage === 'elder' ? 160 : grownUp ? 150 : P.stage === 'young' ? 116 : 70, ch = grownUp ? 84 : P.stage === 'young' ? 68 : 52;
  const cols = Math.ceil(ELEMENT_IDS.length / 2), rows = Math.ceil(ELEMENT_IDS.length / cols);
  const pets = ELEMENT_IDS.map((el, i) => makePet(el, P.stage, P.seed + i * 7, P.anim, (i % cols) * cw + Math.round(cw * 0.6), Math.floor(i / cols) * ch + ch - 7, { mood: P.mood }));
  const off = document.createElement('canvas');
  off.width = cw * cols; off.height = ch * rows;
  return {
    w: cw * cols * k, h: ch * rows * k, pets,
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
  const grownUp = P.stage === 'adult' || P.stage === 'elder';
  const cw = P.stage === 'elder' ? 142 : grownUp ? 132 : P.stage === 'young' ? 104 : 64, ch = grownUp ? 84 : P.stage === 'young' ? 68 : 52;
  const moods = [-1, 0, 1];
  const pets: Pet[] = [];
  ELEMENT_IDS.forEach((el, r) => moods.forEach((m, c) => {
    pets.push(makePet(el, P.stage, P.seed + r * 7, P.anim, c * cw + Math.round(cw * 0.6), r * ch + ch - 7, { mood: m, blink: false }));
  }));
  // a fourth column: asleep (pose.sleep), mood -1, 1.35 x as wide: lying down, the head rests a neck's length
  // further forward and the "z" rises in front of the snout (at the standing width both ran off the sheet's edge)
  const aw = Math.round(cw * 1.35);
  const asleep: Pet[] = ELEMENT_IDS.map((el, r) => {
    const p = makePet(el, P.stage, P.seed + r * 7, 'sleep', 3 * cw + Math.round(cw * 0.55), r * ch + ch - 7, { mood: -1, blink: false, desync: false });
    seekPet(p, animIntro(p, 'sleep'));
    return p;
  });
  const all = pets.concat(asleep);
  const off = document.createElement('canvas');
  off.width = cw * 3 + aw; off.height = ch * ELEMENT_IDS.length + 12;
  return {
    w: off.width * k, h: off.height * k, pets: all,
    draw(ctx) {
      const g = off.getContext('2d')!;
      g.fillStyle = P.bg || STRAW; g.fillRect(0, 0, off.width, off.height);
      drawPets(g, all);
      ['MOOD -1', 'MOOD 0', 'MOOD +1', 'ASLEEP'].forEach((t, i) => label(g, t, i * cw + (i < 3 ? cw : aw) / 2, ch * ELEMENT_IDS.length + 3, LABEL, 1));
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
  // cells wide enough for the adult head (skull + snout ~ 30 px) and the longest label ("SURPRISED", ~54 px)
  const cell = 64, cellH = 46, lab = 9, cols = 6, rows = Math.ceil(names.length / cols);
  const pets = names.map((f) => {
    const p = makePet(P.el, P.stage, P.seed, 'rest', 0, 0, { mood: P.mood, blink: false, desync: false });
    p.player.setStaticPose({ ...(STATIC_POSE || {}), face: DFACE[f], jaw: f === 'happy' && P.stage === 'baby' ? 20 : f === 'surprised' ? 40 : (STATIC_POSE?.jaw ?? 0) });
    return p;
  });
  const off = document.createElement('canvas');
  off.width = cell * cols; off.height = (cellH + lab) * rows;
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
        // a HEAD-sized window (the head's length + 9 px each side, so the brow, horns and fans fit), centred on the
        // head (cranium + snout) and centred in its cell: a full-cell crop showed a baby's whole body with its
        // face small in one corner
        const J = p.rig.j, hd = p.rig.dims.head, hx = J.cran.x + (hd.snout.x1 + hd.snout.r1 - hd.cranR) / 2;
        const cw = Math.min(cell, Math.ceil(p.rig.dims.headLen) + 18), ch = Math.min(cellH, Math.round(hd.cranR * 2 + 24));
        const sx = Math.round(200 + hx - cw / 2), sy = Math.round(150 + J.cran.y - ch / 2 - 4);
        g.drawImage(tmp, sx, sy, cw, ch, (i % cols) * cell + Math.round((cell - cw) / 2), Math.floor(i / cols) * (cellH + lab) + cellH - ch, cw, ch);
        label(g, names[i].toUpperCase(), (i % cols) * cell + cell / 2, Math.floor(i / cols) * (cellH + lab) + cellH + 1, LABEL, 1);
      });
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, 0, 0, off.width * k, off.height * k);
    },
  };
}

function stripScene(P: GalleryParams): Scene {
  const sc = P.scale || 2;
  const probe = makePet(P.el, P.stage, P.seed, P.anim, 0, 0, { desync: false });
  // the span the n frames cover: the whole anim, except a walk shows its 8 keys of ONE cycle (the baby's loop is
  // 6 cycles with the stumble; from=120&span=24 looks at that)
  const L = P.span ?? (P.anim === 'walk' ? Math.round(probe.rig.tune.walk.cycle) : probe.player.length || 60), from = P.from;
  const d = probe.rig.dims;
  // each cell spans the look's own extent: its tail behind the ground point, its head (and a breath's reach: the
  // stream runs ~45 px past the snout) in front, so the next cell's tail never lands on this cell's effect
  const back = d.hipR + d.gap / 2 + d.tail.n * d.tail.len + 14, front = d.gap / 2 + d.chestR + d.headLen + 10 + (P.anim === 'breath' ? 46 : 0);
  // the cell's height from the anim's own extent: the highest head top or tail node over its frames (+ 20 px for a
  // tip feature and horns), at least the standing look's; a fidget that raises the tail (fire's flame chase) or a
  // wake's spread ran off the cell's top
  let high = d.bodyY + 38;
  for (let t = 0, n = Math.min(600, L + from); t < n; t++) {
    stepPet(probe);
    const J = probe.rig.j;
    let y = J.top;
    for (let i = 0; i <= J.tailN; i++) y = Math.min(y, J.tailY[i]);
    high = Math.max(high, -y + 20);
  }
  const cellW = Math.ceil((back + front) * sc), cellH = Math.ceil((high + 22) * sc);
  const cols = Math.max(1, Math.min(P.n, Math.floor(960 / cellW))), rows = Math.ceil(P.n / cols);
  const pets: Pet[] = [];
  const frames: number[] = [];
  for (let i = 0; i < P.n; i++) {
    const f = from + Math.round(i * L / P.n);
    frames.push(f);
    const c = i % cols, r = Math.floor(i / cols);
    const p = makePet(P.el, P.stage, P.seed, P.anim, c * cellW + Math.round((P.facing < 0 ? front : back) * sc), r * cellH + cellH - 22, { scale: sc, desync: false, mood: P.mood, facing: P.facing });
    seekPet(p, f);
    pets.push(p);
  }
  const moves = pets.some((p) => p.wx !== 0);
  return {
    w: Math.max(960, cols * cellW), h: Math.max(540, rows * cellH + 26), pets,
    draw(ctx) {
      ctx.fillStyle = P.bg || STRAW; ctx.fillRect(0, 0, this.w, this.h);
      // a walking anim: ground ticks every 8 px of WORLD, scrolled back by the distance walked, so a planted paw
      // must hold still against them (it moves back with the ground: no skating)
      if (moves) for (const p of pets) {
        const x0 = p.x - (P.facing < 0 ? front : back) * sc, x1 = x0 + cellW;
        for (let k = -40; k < 80; k++) {
          const X = p.x + P.facing * (k * 8 - (p.wx % 8)) * sc;
          if (X < x0 + 4 || X > x1 - 4) continue;
          ctx.fillStyle = '#b8ab88'; ctx.fillRect(Math.round(X), p.y, sc, 2 * sc);
        }
      }
      drawPets(ctx, pets);
      pets.forEach((p, i) => label(ctx, `F${frames[i]}`, p.x, p.y + 8, LABEL, 1));
      // (a row above the live HUD line, which sits at h - 10)
      label(ctx, `${ELEMENTS[P.el].name} ${P.stage} ${P.anim} (${L} F)`, this.w / 2, this.h - 20, LABEL, 1);
    },
  };
}

/**
 * view=habitat (5.1 #13, 5.4): 8 dragons on straw, y-sorted. The cast carries the risky looks -- adult lightning (the
 * tallest cue) standing just BEHIND an adult slinkwing (spire behind fan), and an adult water with its baby
 * overlapping in front of it (parent over baby, one element) -- plus a young rock, and two ELDERS: spike's, roaming
 * with a baby spike (an elder shares the habitat with babies: 5.8's cross-stage gates), and fire's; those two pairs
 * hold their places (`fixed`), the others roam. (The first cast had no young or adult lightning, no adult slinkwing,
 * no young or baby water or rock, and no overlap that stayed put.)
 */
function habitatScene(P: GalleryParams): Scene {
  const cast: [DragonElement, Stage, number, number, number, boolean][] = [
    ['spike', 'elder', 470, 170, -1, false], ['lightning', 'adult', 196, 176, 1, true], ['slinkwing', 'adult', 214, 186, 1, true],
    ['rock', 'young', 110, 262, 1, false], ['fire', 'elder', 340, 236, 1, false], ['water', 'adult', 520, 290, -1, true],
    ['water', 'baby', 506, 306, -1, true], ['spike', 'baby', 90, 336, 1, false],
  ];
  // anim=mix: every act at once (the top pass carries the "z", the dazed stars and the embers; eat brings a bowl)
  const MIX = ['walk', 'happy', 'sleep', 'eat', 'breath', 'beg', 'pet', 'walk'];
  const pets = cast.map(([el, st, x, y, f, fixed], i) => {
    const p = makePet(el, st, P.seed + i * 17, P.anim === 'mix' ? MIX[i] : P.anim, x, y, { facing: f, mood: P.mood });
    p.roam = fixed ? null : [-40, 680];
    return p;
  });
  return {
    w: 640, h: 360, pets, wary: true,
    draw(ctx) {
      ctx.fillStyle = P.bg || STRAW; ctx.fillRect(0, 0, this.w, this.h);
      drawPets(ctx, pets);
    },
  };
}

// ---------- the floor audit (1.1 planted paws, 5.1 #14) ----------

/**
 * The anims view=floor plays by default: the core set (4.2), the idle variants and the element anims (fire's bath,
 * rock's upset tuck, slinkwing's lonely call), each through its whole length (sleep: lie-down + loop); an anim a
 * look has not got is skipped.
 */
const FLOOR_ANIMS = ['idle', 'walk', 'happy', 'eat', 'sleep', 'wake', 'breath', 'pet', 'beg', ...VARIANT_NAMES, ...ELEMENT_ANIM_NAMES];

/**
 * view=floor: nothing a dragon draws may sink through the floor (1.1: paws on the ground line; 5.1 #14). Every look
 * plays every core anim from its first frame to its last at game scale 1, and each frame is drawn alone on a flat
 * canvas with no ground shadow and no bowl; the audit reads back the rows below the ground line and keeps, per look
 * and anim, the deepest row where anything is >= 40 % covered. Depth 1 is the sole's own ink (the house outline
 * is a 2 px stroke centred on the path, so a sole on y = 0 inks the first row under it); 2 or more is a paw, a
 * limb, a tail, a fluke or an effect under the floor. The result goes on window.__dragonCare.floor for tools/smoke.ts and is drawn as a table.
 */
function floorScene(P: GalleryParams): Scene {
  const W = 320, H = 200, GX = 170, GY = 150, ROWS = 16, MIN_A = 102;
  const off = document.createElement('canvas');
  off.width = W; off.height = H;
  const g = off.getContext('2d', { willReadFrequently: true })!;
  const rows: { id: string; anim: string; depth: number; frame: number }[] = [];
  // each failing run's worst frame, cropped around the ground, so the sheet shows WHAT sank (drawn 3x below the list)
  const shots: HTMLCanvasElement[] = [], CROP = 70;
  const els = P.els || ELEMENT_IDS, stages = P.stages || STAGES, anims = P.anims || FLOOR_ANIMS;
  for (const el of els) for (const st of stages) for (const a of anims) {
    const p = makePet(el, st, P.seed, a, GX, GY, { desync: false, blink: false });
    if (p.player.name !== a) continue;
    p.bowl = null;
    const len = Math.max(1, p.player.length) + (ONE_SHOTS.includes(a) ? 2 : 0);
    let worst = 0, at = 0, snap: HTMLCanvasElement | null = null, shot: HTMLCanvasElement | null = null;
    for (let f = 0; f < len; f++) {
      // a transparent canvas: a pixel's alpha IS the dragon's coverage there, whatever its colour (a cream belly
      // and the straw floor are close in colour, not in coverage)
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, W, H);
      drawDragon(g, p.rig, p.player.pose, petOpts(p, { still: true, shadow: false, top: null }));
      const d = g.getImageData(0, GY, W, ROWS).data;
      for (let r = ROWS - 1; r >= worst; r--) {
        let hit = false;
        for (let x = 0; x < W && !hit; x++) hit = d[(r * W + x) * 4 + 3] >= MIN_A;
        if (hit) { if (r + 1 > worst) { worst = r + 1; at = f; if (worst > 1) snap = off; } break; }
      }
      if (snap) {
        shot = shot || document.createElement('canvas');
        shot.width = W; shot.height = CROP + ROWS;
        shot.getContext('2d')!.drawImage(off, 0, GY - CROP, W, CROP + ROWS, 0, 0, W, CROP + ROWS);
        snap = null;
      }
      stepPet(p);
    }
    rows.push({ id: `${el}-${st}`, anim: a, depth: worst, frame: at });
    if (worst > 1 && shot) shots.push(shot);
  }
  if (window.__dragonCare) window.__dragonCare.floor = rows;
  const bad = rows.filter((r) => r.depth > 1);
  const lines = bad.length ? bad.map((r) => `${r.id} ${r.anim}: ${r.depth} ROWS BELOW THE FLOOR AT F${r.frame}`) : ['EVERY LOOK, EVERY ANIM: NOTHING BELOW THE FLOOR'];
  const top = 20 + lines.length * 9, sh = (CROP + ROWS) * 3 + 6, h = Math.max(120, top + shots.length * sh);
  return {
    w: Math.max(480, W * 3), h, pets: [],
    draw(ctx) {
      ctx.fillStyle = P.bg || STRAW; ctx.fillRect(0, 0, this.w, this.h);
      label(ctx, `FLOOR AUDIT: ${rows.length} LOOK x ANIM RUNS, ${bad.length} SINK MORE THAN 1 ROW`, this.w / 2, 4, LABEL, 1);
      lines.forEach((t, i) => label(ctx, t.toUpperCase(), this.w / 2, 16 + i * 9, bad.length ? '#8a1c1c' : LABEL, 1));
      ctx.imageSmoothingEnabled = false;
      shots.forEach((c, i) => {
        const y = top + i * sh;
        ctx.drawImage(c, 0, y, W * 3, (CROP + ROWS) * 3);
        ctx.fillStyle = '#8a1c1c'; ctx.fillRect(0, y + CROP * 3, 12, 1); ctx.fillRect(W * 3 - 12, y + CROP * 3, 12, 1);
      });
    },
  };
}

// ---------- the leg-root audit (1.2 hard rule: roots sunk into the body) ----------

/** The anims view=roots plays by default: the walk (its far pair slides with the stride: 4.2 notes) and the idle. */
const ROOT_ANIMS = ['walk', 'idle', 'rest'];
/**
 * The least depth, px, a far leg's sunk root disc must keep inside the rest of the silhouette on every frame. Every
 * look measures >= 0.5 over seeds 1, 2, 3 and 5 (the babies' far roots lie shallowest: their big heads cover the
 * rest); the walk that hung the far front leg in front of the chest measured -0.2 to -3.6 on the looks it floated.
 */
export const ROOT_MIN = 0.25;

const RLR = new Float32Array(3);
const RPT = { x: 0, y: 0 };
/**
 * view=roots: no far leg may float free of the body (the cast review's blocker: a walk that slid the far shoulder
 * half a stride forward hung the far front leg in front of a young or baby chest, background all round its top).
 * Every look plays each anim frame by frame at game scale 1 and is drawn WITHOUT its far legs on a clear canvas
 * (DrawDragonOpts.farLegs); for each far leg the audit finds the silhouette pixel nearest its sunk root (the tube's
 * first node, 0.35 r down the upper bone: parts.ts drawLeg) and keeps r - that distance, the depth the root disc
 * lies inside what is drawn over it (body, neck, head, tail, near legs). The worst frame per look and anim goes on
 * window.__dragonCare.roots for tools/smoke.ts, which fails anything under ROOT_MIN.
 */
function rootsScene(P: GalleryParams): Scene {
  const W = 320, H = 200, GX = 170, GY = 150, R = 14;
  const off = document.createElement('canvas');
  off.width = W; off.height = H;
  const g = off.getContext('2d', { willReadFrequently: true })!;
  const rows: { id: string; anim: string; depth: number; frame: number; leg: string; floats: boolean }[] = [];
  const els = P.els || ELEMENT_IDS, stages = P.stages || STAGES, anims = P.anims || ROOT_ANIMS;
  for (const el of els) for (const st of stages) for (const a of anims) {
    const p = makePet(el, st, P.seed, a, GX, GY, { desync: false, blink: false });
    if (p.player.name !== a) continue;
    const rig = p.rig, d = rig.dims, len = Math.max(1, p.player.length);
    let worst = Infinity, at = 0, leg = '';
    for (let f = 0; f < len; f++) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, W, H);
      drawDragon(g, rig, p.player.pose, petOpts(p, { still: true, shadow: false, top: null, farLegs: false }));
      for (let i = 2; i < 4; i++) {
        const lg = rig.j.legs[i], L = i === 3 ? d.front : d.hind;
        const dx = lg.knee.x - lg.root.x, dy = lg.knee.y - lg.root.y, l = Math.hypot(dx, dy) || 1, k = L.r1 * 0.35;
        legRadii(L.r1, L.r2, L.bulge, RLR);
        const s = rootToScreen(rig, lg.root.x + dx / l * k, lg.root.y + dy / l * k, RPT);
        const x0 = Math.max(0, Math.floor(s.x) - R), y0 = Math.max(0, Math.floor(s.y) - R);
        const img = g.getImageData(x0, y0, 2 * R + 1, 2 * R + 1).data;
        let best = R;
        for (let y = 0; y <= 2 * R; y++) for (let x = 0; x <= 2 * R; x++) {
          if (img[(y * (2 * R + 1) + x) * 4 + 3] < 128) continue;
          best = Math.min(best, Math.hypot(x0 + x + 0.5 - s.x, y0 + y + 0.5 - s.y));
        }
        const depth = RLR[0] - best;
        if (depth < worst) { worst = depth; at = f; leg = i === 3 ? 'far front' : 'far hind'; }
      }
      stepPet(p);
    }
    rows.push({ id: `${el}-${st}`, anim: a, depth: Math.round(worst * 10) / 10, frame: at, leg, floats: worst < ROOT_MIN });
  }
  if (window.__dragonCare) window.__dragonCare.roots = rows;
  const bad = rows.filter((r) => r.floats);
  const lines = rows.map((r) => `${r.id} ${r.anim}: ${r.leg} ${r.depth.toFixed(1)} PX AT F${r.frame}${r.floats ? '  FLOATS' : ''}`);
  return {
    w: 480, h: Math.max(120, 24 + lines.length * 9), pets: [],
    draw(ctx) {
      ctx.fillStyle = P.bg || STRAW; ctx.fillRect(0, 0, this.w, this.h);
      label(ctx, `LEG ROOTS: ${rows.length} LOOK x ANIM RUNS, ${bad.length} WITH A FAR ROOT UNDER ${ROOT_MIN} PX DEEP`, this.w / 2, 4, LABEL, 1);
      lines.forEach((t, i) => label(ctx, t.toUpperCase(), this.w / 2, 16 + i * 9, t.endsWith('FLOATS') ? '#8a1c1c' : LABEL, 1));
    },
  };
}

// ---------- the elders' worn wings (2.9) ----------

/**
 * view=wings: every elder's wing wear (2.9) at game scale 1 blown up `scale` times (default 3), seven columns and three
 * rows: FULL SPREAD (wing 1, flap 0: the flight's spread, where the notched 3 x 3 hole shows the straw through both
 * wings), the AIRING's hold (the elder's idle variant: the hole seen at home, where the look can sit back far enough)
 * and the RESTING SPREAD of the preen (0.6 leaning back 48: the tears). Lightning's bolts and rock's stubby wings have
 * no hole (no room: 2.9); their tears are the element's (lightning) or one small notch (rock).
 */
function wingsScene(P: GalleryParams): Scene {
  const k = Math.max(1, Math.round(P.scale || 3)), cw = 150, ch = 100, n = ELEMENT_IDS.length;
  const rows: { name: string; pose: PartialDragonPose | null; anim: string; t: number }[] = [
    { name: 'FULL SPREAD (THE HOLE)', pose: DP({ wing: [1, 0], face: 'happy' }), anim: 'rest', t: 0 },
    { name: 'AIRING, THE HOLD (THE HOLE AT HOME)', pose: null, anim: 'airing', t: 40 },
    { name: 'RESTING SPREAD 0.6 / 48 (THE TEARS)', pose: DP({ wing: [0.6, 48] }), anim: 'rest', t: 0 },
  ];
  const pets: Pet[] = [];
  rows.forEach((r, j) => ELEMENT_IDS.forEach((el, i) => {
    const p = makePet(el, 'elder', P.seed, r.anim, i * cw + Math.round(cw * 0.58), j * ch + ch - 12, { mood: P.mood, desync: false, blink: false });
    if (r.pose) p.player.setStaticPose(r.pose);
    else seekPet(p, r.t);
    p.anim = 'rest';
    pets.push(p);
  }));
  const off = document.createElement('canvas');
  off.width = cw * n; off.height = ch * rows.length;
  return {
    w: off.width * k, h: off.height * k, pets,
    draw(ctx) {
      const g = off.getContext('2d')!;
      g.fillStyle = P.bg || STRAW; g.fillRect(0, 0, off.width, off.height);
      drawPets(g, pets);
      rows.forEach((r, j) => label(g, r.name, off.width / 2, j * ch + 3, LABEL, 1));
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, 0, 0, off.width * k, off.height * k);
    },
  };
}

// ---------- silhouette sheet (5.1 #1) ----------

/**
 * view=silhouette: 5.1 #1. Every dragon (seven columns, four stage rows) flat #1a1018 on a light ground, then the /3 area-coverage reduction at 3
 * sub-pixel phases. `set=all` stacks the sheets 5.1 #1 asks for on one page -- idle at the query's mood, idle at
 * the lowest mood, and asleep (the cue must still name the element) -- each a block of every look; the walk keys join it
 * once the walk is authored.
 */
function silhouetteScene(P: GalleryParams): Scene {
  const cellW = 160, cellH = 110, W = cellW * ELEMENT_IDS.length;
  const ALL: { name: string; mood: number; sleep: boolean; walk?: boolean; key: string }[] = [
    { name: `IDLE, MOOD ${P.mood}`, mood: P.mood, sleep: false, key: 'idle' }, { name: 'IDLE, MOOD -1', mood: -1, sleep: false, key: 'low' },
    { name: 'ASLEEP, MOOD -1', mood: -1, sleep: true, key: 'asleep' },
    { name: 'WALK, KEY 3 OF 8 (NEAR LEGS CLOSEST)', mood: P.mood, sleep: false, walk: true, key: 'walk' }];
  // set=all stacks every block; set=idle / low / asleep / walk shows that one block alone
  const blocks = P.set === 'all' ? ALL : ALL.some((b) => b.key === P.set) ? ALL.filter((b) => b.key === P.set)
    : [{ name: `${P.anim.toUpperCase()}, MOOD ${P.mood}`, mood: P.mood, sleep: false, key: '' }];
  const NS = STAGES.length, H = cellH * NS * blocks.length;
  const pets: Pet[] = [];
  blocks.forEach((b, k) => STAGES.forEach((st, r) => ELEMENT_IDS.forEach((el, c) => {
    const p = makePet(el, st, P.seed + c * 7 + r * 131, b.walk ? 'walk' : b.sleep ? 'sleep' : P.anim, c * cellW + Math.round(cellW * 0.56), (k * NS + r) * cellH + cellH - 14,
      { mood: b.mood, blink: !b.sleep, desync: !b.walk && !b.sleep });
    // asleep: the sleep loop's first frame (the lie-down's end pose); walk: key 3 of the 8 (2.5 / 8 of a cycle)
    if (b.sleep) seekPet(p, animIntro(p, 'sleep'));
    if (b.walk) seekPet(p, Math.round(p.rig.tune.walk.cycle * 2.5 / 8));
    pets.push(p);
  })));
  const RW = Math.ceil(W / 3), RH = H / 3;
  return {
    w: Math.max(960, 3 * RW), h: H + 18 + RH + 44, pets,
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
      blocks.forEach((b, k) => label(ctx, b.name, this.w / 2, k * cellH * NS + 4, LABEL, 1));
      // the /3 area-coverage reductions: a reduced pixel is ink when >= 50 % of its 3 x 3 source box is covered
      const src = g.getImageData(0, 0, W, H).data;
      const y0 = H + 18;
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
      // (a row above the live HUD line, which sits at h - 10: on it the two lines overprinted into garble)
      label(ctx, 'SILHOUETTE: FLAT INK, THEN /3 AREA COVERAGE (INK >= 50 %) AT 3 SUB-PIXEL PHASES', this.w / 2, this.h - 22, LABEL, 1);
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
    case 'floor': return floorScene(P);
    case 'roots': return rootsScene(P);
    case 'wings': return wingsScene(P);
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
  if (live) label(ctx, `${P.view.toUpperCase()}  ANIM ${P.anim.toUpperCase()}   ARROWS/SPACE: VIEW  1-9, 0: ANIM (${ANIM_NAMES.join(' ').toUpperCase()})  E: ELEMENT`, scene.w / 2, scene.h - 10, '#5a4850', 1);
}

/** Start the gallery on a canvas; resolves once the requested frame is drawn. */
export function startGallery(canvas: HTMLCanvasElement, search: string, onReady: () => void): void {
  const ctx = canvas.getContext('2d')!;
  let P = parseParams(search);
  STATIC_POSE = P.pose; FLASH = P.flash; TINT = P.tint; BOND = P.bond; CHARGE = P.charge; WEAR = P.wear;
  let scene = makeScene(P);
  const size = () => { canvas.width = scene.w; canvas.height = scene.h; };
  size();
  if (P.t != null) {
    // frozen: replay t steps from each pet's start, all pets in lockstep (the wary latch reads the others' places);
    // strip pets are already seeked
    if (P.view !== 'strip') for (let i = 0; i < P.t; i++) stepScene(scene);
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
    else if (/^[0-9]$/.test(e.key) && ANIM_NAMES[(Number(e.key) + 9) % 10]) { P = { ...P, anim: ANIM_NAMES[(Number(e.key) + 9) % 10] }; rebuild(); }
    else return;
    e.preventDefault();
  });
  let acc = 0, last = 0;
  const loop = (now: number) => {
    if (!last) last = now;
    acc = Math.min(acc + (now - last) / (1000 / 60), 5); last = now;
    while (acc >= 1) { if (P.view !== 'strip') stepScene(scene); frame++; acc -= 1; }
    render(ctx, scene, P, true);
    if (first) { first = false; onReady(); }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
