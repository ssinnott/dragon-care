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
//   view=habitat               640 x 360, straw floor, 12 mixed dragons, y-sorted, top-pass particles; walkers roam
//                              (two overlapping pairs and the elders' dark trio hold their places); anim=mix plays
//                              every act at once
//   view=yard                  640 x 360: six dragons with needs and the four keepers answering them (docs/KEEPERS.md)
//   view=keepers | view=care   the keepers (anim=, k= for a strip) | the care acts (act=, el=, stage=, k=; n= a strip)
//   view=careaudit             every care act on every look: the eye never covered, the hand on its mark, the act ends
//   view=yardaudit             the same checks on every act the yard plays in two and a half minutes
//   view=floor | view=roots    the floor audit (nothing sinks through y = 0) and the leg-root audit (no far leg floats
//                              free of the body); els= / stages= / anims= narrow them
//   view=tails                 the tail-ceiling audit (a fluke never rises over 3 px above the back: 3.0), narrowed the same
//   view=pour                  the pour-column audit (no breath effect joins the mouth to the floor: 3.8), narrowed the same
//   view=neutral               the neutral-area recorder (each look's share of HSV S < 0.25 pixels, <= 40 %: 3.1)
//   anim: idle walk happy eat sleep wake breath pet beg rest (anims.ts ANIM_NAMES), and by name any variant or an
//   element anim (bath, upset, call); one-shots replay after a pause, an eating pet gets a bowl drawn after it
//   params: anim, mood (-1..1), t, scale, bg, seed, facing (-1: zoom and strip mirrored), bond (0..1, default 1),
//   charge (0..1), post (grey | cvd: any view post-processed, the habitat's check in grey and CVD); a static pose
//   overlay: face, jaw, wing, flap, sleep, tuck, fx, gulp, flare, bristle, body=<rot>,<y>, head, pupil; wear=0 draws
//   the elders without their tears and hole (2.9's with / without measure)
import { drawText } from './lib/engine/text.ts';
import { dragonBuild } from './art/dragon/build.ts';
import { buildDragon, drawDragon, stepDragon, rootToScreen } from './art/dragon/rig.ts';
import { legRadii } from './art/dragon/parts.ts';
import type { DragonRig, DrawDragonOpts } from './art/dragon/rig.ts';
import { DragonAnimPlayer, blinkFor } from './art/dragon/anim.ts';
import { dragonAnims, ANIM_NAMES, ONE_SHOTS, VARIANT_NAMES, ELEMENT_ANIM_NAMES, ELEMENT_ANIM_FALLBACK, idleVariants, variantEvery, SPREAD_VARIANTS, CROWD_GAP } from './art/dragon/anims.ts';
import { ELEMENTS, ELEMENT_IDS } from './art/dragon/elements/index.ts';
import { STAGES } from './art/dragon/stages.ts';
import { DP, DFACE } from './art/dragon/pose.ts';
import type { DFaceName, PartialDragonPose } from './art/dragon/pose.ts';
import type { Stage } from './art/dragon/stages.ts';
import type { DragonElement } from './art/dragon/palettes.ts';
import { TopPass, AmbientBudget } from './art/dragon/fx.ts';
import { bowlFor, drawBowl as drawBowlAt } from './art/props.ts';
import { KEEPERS, KEEPER_IDS } from './art/keeper/cast.ts';
import type { KeeperId } from './art/keeper/cast.ts';
import { KEEPER_ANIM_NAMES, KEEPER_ONE_SHOTS } from './art/keeper/anims.ts';
import { makeKeeper, stepKeeperAgent, drawKeeperAgent } from './care/keeper.ts';
import { TOOL_BOWL } from './art/keeper/parts.ts';
import { keeperJoint } from './art/keeper/rig.ts';
import type { KeeperAgent } from './care/keeper.ts';
import { makeDragon, drawDragonAgent, stepDragonAgent, eyeBox } from './care/dragon.ts';
import type { DragonAgent } from './care/dragon.ts';
import { beginFeed, beginPet, beginTuck, stepAct, approachSide } from './care/acts.ts';
import type { ActKind, CareAct } from './care/acts.ts';
import { Yard } from './care/yard.ts';
import { REACH_MISS, ACT_MAX, YARD_ACT_MAX } from './care/limits.ts';

/** The reference habitat floor (5.4, gate i). */
export const STRAW = '#e0d6b8';
const LABEL = '#3a2a30';

export const VIEWS = ['lineup', 'silhouette', 'stages', 'grey', 'cvd', 'strip', 'habitat', 'zoom', 'cast', 'mood', 'faces', 'floor', 'roots', 'tails', 'pour', 'neutral', 'wings', 'keepers', 'care', 'careaudit', 'yard', 'yardaudit'] as const;
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
  /** view=floor / roots / tails: which anims, elements and stages to audit (comma lists; null = all). */
  anims: string[] | null;
  els: DragonElement[] | null;
  stages: Stage[] | null;
  /** wear=0: the elders draw without their tears and hole (2.9), for measuring what the wear opens against the same frame. */
  wear: boolean;
  /** post=grey | cvd: any view post-processed as view=grey / cvd do the lineup (the habitat's grey and CVD check: 5.4). */
  post: 'grey' | 'cvd' | null;
  /** k=<keeper>: view=keepers shows that keeper's anim as a strip (docs/KEEPERS.md); view=care, the keeper doing it. */
  k: KeeperId | null;
  /** act=feed | pet | tuck: view=care plays that one care act (on el= / stage=) instead of the three. */
  act: ActKind | null;
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
    post: q.get('post') === 'grey' || q.get('post') === 'cvd' ? q.get('post') as 'grey' | 'cvd' : null,
    k: (KEEPER_IDS as readonly string[]).includes(q.get('k') || '') ? q.get('k') as KeeperId : null,
    act: ['feed', 'pet', 'tuck'].includes(q.get('act') || '') ? q.get('act') as ActKind : null,
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
  // (wear=0: the same elder without its tears and hole, the other half of 2.9's with / without measure; the renderers'
  // info.sp too, or an element that reads its wear there -- a custom wing's tear -- ignored it)
  if (!WEAR) { rig.sp = { ...rig.sp, wing: { ...rig.sp.wing, tears: undefined, hole: undefined } }; rig.info.sp = rig.sp; }
  const anims = dragonAnims(stage, build.spec, build.dims);
  const player = new DragonAnimPlayer(anims, seed, blinkFor(stage));
  player.blink = opts.blink !== false;
  const desync = opts.desync !== false;
  // (an element anim the look has not got plays its fallback: dusk's tuck-in is every other look's sleep)
  player.play(anim, { restart: true, phase: desync ? build.phase : 0, speed: desync ? build.speed : 1, fallback: ELEMENT_ANIM_FALLBACK[anim] });
  // an idle pet cuts to a look-around, a yawn, a scratch or its element's fidget every 6-10 s (the elder to its back
  // stretch, reminisce or airing too, every 8-12 s; rock's elder, with no hole to air, airs its own way: its sunning),
  // seeded: 4.2
  // (the airing is skipped while the pet is crowded: stepWary marks it, 5.4)
  if (anim === 'idle') { const [a, b] = variantEvery(stage); player.setVariants('idle', idleVariants(stage, build.sp.wing), a, b, SPREAD_VARIANTS); }
  if (STATIC_POSE) player.setStaticPose(STATIC_POSE);
  return {
    rig, player, x, y, facing: opts.facing ?? 1, scale: opts.scale ?? 1, mood: opts.mood ?? 0,
    label: `${ELEMENTS[el].name} ${stage}`, anim, hold: 0, wx: 0, roam: null, wary: 0, waryOn: false,
    bowl: anim === 'eat' && !STATIC_POSE ? bowlFor(rig, anims.eat ? anims.eat.frames : []) : null,
  };
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
 * over about 8 f, so a dragon walking past does not flicker the lean. The same gap marks the pet `crowded` under
 * CROWD_GAP, so its idle schedule starts no spread-wing variant (5.4).
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
    // the same gap keeps a spread-wing variant from starting beside a neighbour (5.4: the crowd rule)
    p.player.crowded = g < CROWD_GAP;
  }
}
/** A pet's screen x extent, tail tip to snout, at its facing (from the build's dims, the rest pose). */
function extentX(p: Pet): [number, number] {
  const d = p.rig.dims, s = p.scale * p.rig.scale;
  const back = (d.hipR + d.gap / 2 + d.tail.n * d.tail.len) * s, front = (d.gap / 2 + d.chestR + d.headLen) * s;
  return p.facing < 0 ? [p.x - front, p.x + back] : [p.x - back, p.x + front];
}

/** One scene tick: the scene-wide state (the wary latch, where the scene has one), then every pet, then its own step. */
function stepScene(scene: Scene): void {
  if (scene.wary) stepWary(scene.pets);
  for (const p of scene.pets) stepPet(p);
  if (scene.step) scene.step();
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
  /** Whatever else the scene steps once per tick, after its pets (the keepers). */
  step?(): void;
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

/**
 * The food bowl in front of an eating pet (drawn AFTER it, 4.2), at the pet's scale: props.ts drawBowl, the one bowl
 * the keepers carry in and set down too (src/care/acts.ts).
 */
function drawBowl(ctx: CanvasRenderingContext2D, p: Pet): void {
  const b = p.bowl!, sc = p.scale * p.rig.scale;
  drawBowlAt(ctx, Math.round(p.x + p.facing * b.x * sc), Math.round(p.y), b.w, b.h, sc);
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
  // (the head's side takes the cue's reach past the snout too: dusk's lantern, and the elder's moth ahead of it, were
  // cut at the canvas edge; and each side a margin for what the straight tail and the head don't measure -- water's
  // fluke past the tail's last segment, fire's flame, the lamp's swing and the moth's open wings -- with at least 8 px
  // of straw between two stages (cast review v2: the elder dusk's lantern was cut at the right edge, and water's baby
  // fluke sat 3 px off the left one)
  const reach = ELEMENTS[P.el].reach;
  const ext = pets.map((p, i) => {
    const d = p.rig.dims, tail = d.hipR + d.gap / 2 + d.tail.n * d.tail.len + 10, head = d.gap / 2 + d.chestR + d.headLen + 8 + (reach?.[STAGES[i]] ?? 0);
    return [tail * sc, head * sc];
  });
  const total = ext.reduce((a, e) => a + e[0] + e[1], 0), gap = Math.max(8 * sc, (960 - total) / (STAGES.length + 1));
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
  // (the front takes the cue's reach past the snout too: the elder dusk's lantern sat on the right edge)
  const back = Math.ceil(d.hipR + d.gap / 2 + d.tail.n * d.tail.len + 16), front = Math.ceil(d.gap / 2 + d.chestR + d.headLen + 16 + (ELEMENTS[P.el].reach?.[P.stage] ?? 0));
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
  const pets = names.map((f) => {
    const p = makePet(P.el, P.stage, P.seed, 'rest', 0, 0, { mood: P.mood, blink: false, desync: false });
    p.player.setStaticPose({ ...(STATIC_POSE || {}), face: DFACE[f], jaw: f === 'happy' && P.stage === 'baby' ? 20 : f === 'surprised' ? 40 : (STATIC_POSE?.jaw ?? 0) });
    return p;
  });
  // cells wide enough for the adult head (skull + snout ~ 30 px) and the longest label ("SURPRISED", ~54 px), and for
  // the cue's reach past the snout (ElementSpec.reach: dusk's lantern and the elder's moth, cropped to one ink line)
  const reach = ELEMENTS[P.el].reach?.[P.stage] ?? 0;
  const cell = Math.max(64, Math.ceil(pets[0].rig.dims.headLen) + 18 + reach), cellH = 46, lab = 9, cols = 6, rows = Math.ceil(names.length / cols);
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
        // (widened forward by the reach)
        const J = p.rig.j, hd = p.rig.dims.head, hx = J.cran.x + (hd.snout.x1 + hd.snout.r1 - hd.cranR + reach) / 2;
        const cw = Math.min(cell, Math.ceil(p.rig.dims.headLen) + 18 + reach), ch = Math.min(cellH, Math.round(hd.cranR * 2 + 24));
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
  // wake's spread ran off the cell's top. A breath gets 36 px more: its effects rise past the head (spike's volley
  // about 55 px over the neck base, the elder's finale ring up to about 88 px over the ground) and landed in the
  // row above, read as the wrong frame's
  let high = d.bodyY + 38 + (P.anim === 'breath' ? 36 : 0);
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
 * view=habitat (5.1 #13, 5.4): 12 dragons on straw, y-sorted, every element among them. The cast carries the risky
 * looks -- adult lightning (the tallest cue) standing just BEHIND an adult slinkwing (spire behind fan), and an adult
 * water with its baby overlapping in front of it (parent over baby, one element) -- plus a young rock, an adult dusk
 * (its coral lamp ahead of the face, E12's neighbour of fire's glow; its Nightfall on the floor in the mix), and five
 * ELDERS: spike's, roaming with a baby spike (an elder shares the habitat with babies: 5.8's cross-stage gates), fire's,
 * and the dark trio's at the back -- lightning's behind slinkwing's, the greyed spire behind the greyed fans, its head
 * clear of the fans by >= 4 px, with dusk's facing them, spaced by its lamp's reach (ElementSpec.reach) so its lantern
 * hangs in the air between them, not on a neighbour (cast review v2: the check had only two elders, none of the dark
 * three, and no airing; round 2: 18 px apart and airing together, lightning's and slinkwing's elders merged into one
 * two-headed dragon). The adult dusk stands clear of the water pair by its reach and Nightfall's bank (round 2: its mist
 * stood by the water's head and read as its spout). Those pairs and the trio hold their places (`fixed`), the others
 * roam. (The first cast had no young or adult lightning, no adult slinkwing, no young or baby water or rock, and no
 * overlap that stayed put; the v1 cast had no dusk.)
 */
function habitatScene(P: GalleryParams): Scene {
  const cast: [DragonElement, Stage, number, number, number, boolean][] = [
    ['lightning', 'elder', 286, 110, 1, true], ['slinkwing', 'elder', 336, 120, 1, true],
    ['spike', 'elder', 470, 170, -1, false], ['lightning', 'adult', 196, 176, 1, true], ['slinkwing', 'adult', 214, 186, 1, true],
    ['dusk', 'adult', 552, 212, -1, false],
    ['rock', 'young', 110, 262, 1, false], ['fire', 'elder', 340, 236, 1, false], ['water', 'adult', 520, 298, -1, true],
    ['water', 'baby', 506, 314, -1, true], ['spike', 'baby', 90, 336, 1, false],
  ];
  cast.splice(2, 0, ['dusk', 'elder', 0, cast[1][3] + 4, -1, true]);
  // anim=mix: every act at once (the top pass carries the "z", the dazed stars and the embers; eat brings a bowl), an
  // elder's airing among them (lightning's storm-watch; slinkwing's elder beside it reminisces, one spread of the pair
  // at a time as the crowd rule would have it: 5.4) and dusk's lamp-bat
  const MIX = ['airing', 'reminisce', 'fidget', 'walk', 'happy', 'sleep', 'breath', 'eat', 'breath', 'beg', 'pet', 'walk'];
  const pets = cast.map(([el, st, x, y, f, fixed], i) => {
    const p = makePet(el, st, P.seed + i * 17, P.anim === 'mix' ? MIX[i] : P.anim, x, y, { facing: f, mood: P.mood });
    p.roam = fixed ? null : [-40, 680];
    return p;
  });
  // the dusk elder faces the slinkwing elder, its snout clear of the slinkwing's by its lamp's reach and 6 px more
  const [slink, dusk] = [pets[1], pets[2]];
  dusk.x = Math.round(extentX(slink)[1] + (ELEMENTS.dusk.reach?.elder ?? 0) + 6 + (dusk.x - extentX(dusk)[0]));
  return {
    w: 640, h: 360, pets, wary: true,
    draw(ctx) {
      ctx.fillStyle = P.bg || STRAW; ctx.fillRect(0, 0, this.w, this.h);
      drawPets(ctx, pets);
    },
  };
}

// ---------- the keepers (docs/KEEPERS.md) ----------

/** Step a gallery keeper, replaying a finished one-shot after a pause (so a live view keeps showing it). */
function stepKeeperShown(k: KeeperAgent, anim: string, hold: { n: number }): void {
  if (k.player.done && KEEPER_ONE_SHOTS.includes(anim) && ++hold.n >= REPLAY) { hold.n = 0; k.player.play(anim, { restart: true, blend: 8 }); }
  stepKeeperAgent(k);
}

/**
 * view=keepers: the four keepers side by side at game scale 1, blown up `scale` times (default 3), each labelled with
 * name and job, playing `anim` (any keeper anim: idle, walk, carry, hold, watch, kneel, kneelIdle, rise, pet, petLow,
 * shh, tiptoe, cheer, wave). A walking keeper walks in place: its root motion is taken off again each tick, and ground
 * ticks under it scroll by the distance walked, so a planted foot must hold still against them (no skating). A
 * carry or a hold has a young dragon's full bowl in the hands (the hands of an empty one held air).
 * &k=<keeper>: that keeper's anim as a strip of n frames instead (from= / span= as view=strip).
 */
function keepersScene(P: GalleryParams): Scene {
  const k = Math.max(1, Math.round(P.scale || 3)), anim = KEEPER_ANIM_NAMES.includes(P.anim) ? P.anim : 'idle';
  const walking = ['walk', 'carry', 'tiptoe'].includes(anim);
  const cw = P.k ? 58 : 80, ch = 112, gy = ch - 22;
  const spot = anim === 'carry' || anim === 'hold' ? makeDragon('fire', 'young', P.seed, 'idle', 0, 0).spot : null;
  type Cell = { a: KeeperAgent; x0: number; wx: number; hold: { n: number }; label: string };
  const cells: Cell[] = [];
  const add = (id: KeeperId, x0: number, seek: number, label: string) => {
    const a = makeKeeper(id, anim, x0, gy, { facing: P.facing, seed: P.seed + cells.length, blinks: !P.k });
    if (spot) { a.rig.bowl = { w: spot.w, h: spot.h, full: true }; a.rig.weapon = TOOL_BOWL; }
    const c: Cell = { a, x0, wx: 0, hold: { n: 0 }, label };
    for (let i = 0; i < seek; i++) stepCell(c);
    cells.push(c);
  };
  const stepCell = (c: Cell) => { const x = c.a.x; stepKeeperShown(c.a, anim, c.hold); c.wx += (c.a.x - x) * c.a.facing; c.a.x = c.x0; };
  if (P.k) {
    const probe = makeKeeper(P.k, anim, 0, 0);
    const L = P.span ?? (probe.player.length || 60);
    for (let i = 0; i < P.n; i++) {
      const f = P.from + Math.round((i * L) / P.n);
      add(P.k, i * cw + Math.round(cw / 2), f, `F${f}`);
    }
  } else KEEPER_IDS.forEach((id, i) => add(id, i * cw + Math.round(cw / 2), 0, `${KEEPERS[id].name.toUpperCase()}`));
  const off = document.createElement('canvas');
  off.width = cw * cells.length; off.height = ch;
  return {
    w: off.width * k, h: off.height * k, pets: [],
    step() { for (const c of cells) stepCell(c); },
    draw(ctx) {
      const g = off.getContext('2d')!;
      g.fillStyle = P.bg || STRAW; g.fillRect(0, 0, off.width, off.height);
      // ground ticks every 8 px of world under a walker, scrolled back by the distance walked (view=strip's check)
      if (walking) for (const c of cells) for (let t = -8; t < 8; t++) {
        const X = Math.round(c.x0 + c.a.facing * (t * 8 - (c.wx % 8)));
        if (Math.abs(X - c.x0) < cw / 2 - 2) { g.fillStyle = '#b8ab88'; g.fillRect(X, gy, 1, 2); }
      }
      for (const c of cells) drawKeeperAgent(g, c.a);
      for (const c of cells) label(g, c.label, c.x0, gy + 5, LABEL, 1);
      if (!P.k) cells.forEach((c) => label(g, KEEPERS[c.a.id].title.replace(/^the /, '').toUpperCase(), c.x0, gy + 12, '#6a5a60', 1));
      else label(g, `${KEEPERS[P.k].name.toUpperCase()} ${anim.toUpperCase()}`, off.width / 2, 2, LABEL, 1);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, 0, 0, off.width * k, off.height * k);
    },
  };
}

// ---------- the care acts (docs/KEEPERS.md 6) ----------

/** The keeper whose job an act is (Bea feeds, Tomas grooms, Iris tucks in). */
const ACT_KEEPER: Readonly<Record<ActKind, KeeperId>> = { feed: 'bea', pet: 'tomas', tuck: 'iris' };
/** view=care's three vignettes: a cook and a young dragon, a groomer and a grown one (from the side), a tuck-in. */
const CARE_SET: readonly (readonly [ActKind, DragonElement, Stage])[] = [['feed', 'fire', 'young'], ['pet', 'water', 'adult'], ['tuck', 'dusk', 'adult']];

/** Draw a care scene's dragons and keepers y-sorted by the feet; on one floor line a dragon (and its bowl) goes first. */
export function drawCareCast(ctx: CanvasRenderingContext2D, dragons: readonly DragonAgent[], keepers: readonly KeeperAgent[]): void {
  const all: { y: number; o: number; draw: () => void }[] = [
    ...dragons.map((d) => ({ y: d.y, o: 0, draw: () => drawDragonAgent(ctx, d, { top, budget }) })),
    ...keepers.map((k) => ({ y: k.y, o: 1, draw: () => drawKeeperAgent(ctx, k) })),
  ];
  all.sort((a, b) => a.y - b.y || a.o - b.o);
  budget.begin(dragons.length, frame);
  for (const it of all) it.draw();
  top.flush(ctx);
}

/**
 * view=care: the care acts, each a vignette at game scale 1 blown up `scale` times (default 3): a keeper walks in and
 * does its job with a dragon, which answers with its own anims (feed: beg -> eat -> happy; pet: pet -> happy; tuck:
 * the lie-down -> asleep). Freeze any moment with t. act=feed | pet | tuck (with el=, stage=, k=) plays one.
 */
/** One care vignette: a dragon at (x0, gy) facing right and a keeper walking in from the right to do `kind`. */
interface Vignette { act: CareAct; d: DragonAgent; kp: KeeperAgent; label: string }
function makeVignette(kind: ActKind, el: DragonElement, st: Stage, kid: KeeperId, seed: number, x0: number, gy: number, left: number, right: number, facing = 1): Vignette {
  const d = makeDragon(el, st, seed, kind === 'feed' ? 'beg' : 'idle', x0, gy, { facing, mood: kind === 'feed' ? -0.3 : 0 });
  // the keeper walks in from the side the act comes from (a feed from in front, the rest from behind: acts.ts
  // approachSide) and leaves that way
  const side = approachSide(kind, d), kx = side > 0 ? right : left;
  const kp = makeKeeper(kid, 'walk', kx, gy, { facing: -side, seed });
  // (the floor its walks may use: its own cell, from a little behind the floor line to just above the cell's edge)
  const scene = { floor: { x0: left, y0: gy - 30, x1: right, y1: gy + 11 } };
  const act: CareAct = kind === 'feed' ? beginFeed(kp, d, kx, gy, scene) : kind === 'pet' ? beginPet(kp, d, kx, gy, scene) : beginTuck(kp, d, kx, gy, scene);
  const verb = kind === 'feed' ? 'FEEDS' : kind === 'pet' ? (KEEPERS[kid].tool === 'brush' ? 'GROOMS' : 'PETS') : 'TUCKS IN';
  return { act, d, kp, label: `${KEEPERS[kid].name.toUpperCase()} ${verb} ${ELEMENTS[el].name.toUpperCase()} (${st.toUpperCase()})` };
}
/** One tick of a vignette: its act, or once it is done its keeper on its own; its dragon once the act lets it go. */
function stepVignette(v: Vignette): void {
  if (!v.act.done) stepAct(v.act); else stepKeeperAgent(v.kp);
  if (!v.act.ownsDragon) stepDragonAgent(v.d, false);
}

function careScene(P: GalleryParams): Scene {
  const k = Math.max(1, Math.round(P.scale || 3)), W = 260, H = 104;
  const strip = !!P.act && P.n > 1;
  const set = P.act ? [[P.act, P.el, P.stage] as const] : CARE_SET;
  // a strip: the one act n times, each cell stepped to its own frame (from= / span=, default the first 900 f)
  const cells = strip ? Array.from({ length: P.n }, (_, i) => P.from + Math.round((i * (P.span ?? 900)) / P.n)) : set.map(() => 0);
  const cols = strip ? Math.min(P.n, 4) : 1;
  const scenes = cells.map((f, i) => {
    const [kind, el, st] = strip ? set[0] : set[i];
    const x = (i % cols) * W, gy = Math.floor(i / cols) * H + H - 12;
    const v = makeVignette(kind, el, st, P.act && P.k ? P.k : ACT_KEEPER[kind], P.seed + (strip ? 0 : i), x + 100, gy, x + 14, x + W - 14);
    for (let t = 0; t < f; t++) stepVignette(v);
    return { v, x, y: Math.floor(i / cols) * H, f };
  });
  const off = document.createElement('canvas');
  off.width = W * cols; off.height = H * Math.ceil(scenes.length / cols);
  return {
    w: off.width * k, h: off.height * k, pets: [],
    step() { for (const s of scenes) stepVignette(s.v); },
    draw(ctx) {
      const g = off.getContext('2d')!;
      g.fillStyle = P.bg || STRAW; g.fillRect(0, 0, off.width, off.height);
      for (const s of scenes) {
        g.fillStyle = '#cfc4a4'; g.fillRect(s.x, s.y, W, 1); g.fillRect(s.x, s.y, 1, H);
        // (each cell's cast clipped to its cell: a keeper walking off, or a long tail, drew into the next one)
        g.save(); g.beginPath(); g.rect(s.x + 1, s.y + 1, W - 1, H - 1); g.clip();
        drawCareCast(g, [s.v.d], [s.v.kp]);
        g.restore();
        if (!strip || s === scenes[0]) label(g, s.v.label, s.x + W / 2, s.y + 3, LABEL, 1);
        label(g, `${strip ? `F${s.f} ` : ''}${s.v.act.done ? 'DONE' : s.v.act.phase.toUpperCase()}`, s.x + W / 2, s.y + H - 8, '#6a5a60', 1);
      }
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, 0, 0, off.width * k, off.height * k);
    },
  };
}

// ---------- the care audit (docs/KEEPERS.md K7: a keeper never covers a dragon's eye) ----------




/**
 * view=careaudit: every care act on every look (feed by Bea, a groom by Tomas, a pet by Pip, a tuck-in by Iris), run
 * from the keeper's walk-in to its walk-off at game scale 1. Every frame, walking in and out too, the keeper is drawn
 * alone on a clear canvas and the pixels it covers inside the dragon's eye box (its largest box: rig.info.eye) are
 * counted: the hard rule, "nothing covers the eye", holds for a keeper too (bible 1.4; K7). It also measures how far a stroking hand lands from its mark
 * (the crown, or the neck under the brush) and whether the act finishes. The rows go on window.__dragonCare.care for
 * tools/smoke.ts, which fails an eye covered, a hand more than REACH_MISS px off, or an act that never ends.
 */
function careAuditScene(P: GalleryParams): Scene {
  const W = 320, H = 200, GY = 150, MIN_A = 128;
  const off = document.createElement('canvas');
  off.width = W; off.height = H;
  const g = off.getContext('2d', { willReadFrequently: true })!;
  const runs: [ActKind, KeeperId][] = P.act ? [[P.act, P.k ?? ACT_KEEPER[P.act]]] : [['feed', 'bea'], ['pet', 'tomas'], ['pet', 'pip'], ['tuck', 'iris']];
  const rows: { act: string; id: string; covered: number; frame: number; phase: string; miss: number; done: boolean; frames: number }[] = [];
  const pt = { x: 0, y: 0 };
  for (const [kind, kid] of runs) for (const el of P.els || ELEMENT_IDS) for (const st of P.stages || STAGES) {
    const v = makeVignette(kind, el, st, kid, P.seed, 150, GY, 20, 300, P.facing);
    let covered = 0, at = 0, phase = '', miss = 0, f = 0;
    for (; f < ACT_MAX && !v.act.done; f++) {
      stepVignette(v);
      // (every phase, the walks in and out among them: a walk goes round the eye, path.ts)
      const b = eyeBox(v.d), x0 = Math.max(0, b.x0), y0 = Math.max(0, b.y0), w = Math.min(W, b.x1) - x0, h = Math.min(H, b.y1) - y0;
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
      drawKeeperAgent(g, v.kp, { shadow: false });
      if (w > 0 && h > 0) {
        const px = g.getImageData(x0, y0, w, h).data;
        let n = 0;
        for (let i = 3; i < px.length; i += 4) if (px[i] >= MIN_A) n++;
        if (n > covered) { covered = n; at = f; phase = v.act.phase; }
      }
      const r = v.kp.reach;
      if (r && v.act.phase === 'stroke') {
        keeperJoint(v.kp.rig, 'handN', pt);
        miss = Math.max(miss, Math.hypot(pt.x - (v.kp.x + v.kp.facing * r.x * v.kp.scale), pt.y - (v.kp.y + r.y * v.kp.scale)));
      }
    }
    rows.push({ act: `${kind}:${kid}`, id: `${el}-${st}`, covered, frame: at, phase, miss: Math.round(miss * 10) / 10, done: v.act.done, frames: f });
  }
  if (window.__dragonCare) window.__dragonCare.care = rows;
  const bad = rows.filter((r) => r.covered > 0 || r.miss > REACH_MISS || !r.done);
  const lines = rows.map((r) => `${r.act} ${r.id}: ${r.covered ? `EYE COVERED ${r.covered} PX AT F${r.frame} (${r.phase})` : 'EYE CLEAR'}  HAND ${r.miss} PX  ${r.done ? `DONE AT F${r.frames}` : 'NEVER ENDS'}${r.covered > 0 || r.miss > REACH_MISS || !r.done ? '  FAIL' : ''}`);
  return {
    w: 560, h: Math.max(120, 24 + lines.length * 9), pets: [],
    draw(ctx) {
      ctx.fillStyle = P.bg || STRAW; ctx.fillRect(0, 0, this.w, this.h);
      label(ctx, `CARE AUDIT: ${rows.length} ACT RUNS, ${bad.length} FAILING (EYE COVERED, HAND OFF ITS MARK BY MORE THAN ${REACH_MISS} PX, OR NEVER ENDS)`, this.w / 2, 4, LABEL, 1);
      lines.forEach((t, i) => label(ctx, t.toUpperCase(), this.w / 2, 16 + i * 9, t.endsWith('FAIL') ? '#8a1c1c' : LABEL, 1));
    },
  };
}

// ---------- the yard (docs/KEEPERS.md 7) ----------

/**
 * view=yard: the keepers at work (src/care/yard.ts). 640 x 360 on the straw floor, six dragons whose needs rise and
 * show, and the four keepers, each sent by the yard's director to the neediest dragon its job covers; y-sorted by the
 * feet, the top pass over all. A caption along the top says what each keeper is doing.
 */
function yardScene(P: GalleryParams): Scene {
  const yard = new Yard(P.seed);
  return {
    w: 640, h: 360, pets: [],
    step() { yard.step(); },
    draw(ctx) {
      ctx.fillStyle = P.bg || STRAW; ctx.fillRect(0, 0, this.w, this.h);
      drawCareCast(ctx, yard.dragons.map((y) => y.d), yard.keepers.map((k) => k.k));
      // (along the top: the live gallery's key hint runs along the bottom)
      label(ctx, yard.captions().join('    '), this.w / 2, 4, '#6a5a60', 1);
    },
  };
}

/** How long the yard audit runs the yard, frames (at 60 Hz: two and a half minutes). */
const YARD_AUDIT_T = 9000;

/**
 * view=yardaudit: the yard run for YARD_AUDIT_T frames with the care audit's checks on every keeper, all the time:
 * each frame each keeper is drawn alone and the pixels it covers inside the eye box of EVERY dragon it is level with or
 * in front of (drawn over: a keeper behind a dragon is drawn under it) are counted, walking or at work, in an act or
 * between acts (a row per act, and one per keeper for its walks home); a stroking hand's miss; and every act ends
 * within YARD_ACT_MAX frames. Rows go on window.__dragonCare.care (tools/smoke.ts fails any bad one).
 */
function yardAuditScene(P: GalleryParams): Scene {
  const W = 640, H = 360, MIN_A = 128;
  const off = document.createElement('canvas');
  off.width = W; off.height = H;
  const g = off.getContext('2d', { willReadFrequently: true })!;
  const yard = new Yard(P.seed);
  type Row = { act: string; id: string; covered: number; frame: number; phase: string; miss: number; done: boolean; frames: number; start: number };
  const rows: Row[] = [], open = new Map<CareAct, Row>(), between = new Map<KeeperId, Row>(), pt = { x: 0, y: 0 };
  for (const yk of yard.keepers) {
    const r: Row = { act: `walks:${yk.k.id}`, id: 'between acts', covered: 0, frame: 0, phase: '', miss: 0, done: true, frames: 0, start: 0 };
    between.set(yk.k.id, r); rows.push(r);
  }
  for (let f = 0; f < YARD_AUDIT_T; f++) {
    yard.step();
    for (const yk of yard.keepers) {
      const a = yk.act, k = yk.k;
      let r: Row;
      if (a && yk.with) {
        let o = open.get(a);
        if (!o) {
          o = { act: `${a.kind}:${k.id}`, id: `${yk.with.d.el}-${yk.with.d.stage}@${f}`, covered: 0, frame: 0, phase: '', miss: 0, done: false, frames: 0, start: f };
          open.set(a, o); rows.push(o);
        }
        o.frames = f - o.start; r = o;
      } else r = between.get(k.id)!;
      // the eyes this keeper could be drawn over: level with it or behind it, and near enough to matter
      const eyes = yard.dragons.filter((y) => y.d.y <= k.y).map((y) => ({ y, b: eyeBox(y.d) })).filter(({ b }) => b.x1 > k.x - 60 && b.x0 < k.x + 60 && b.y1 > k.y - 110);
      if (eyes.length) {
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
        drawKeeperAgent(g, k, { shadow: false });
        for (const { y, b } of eyes) {
          const x0 = Math.max(0, b.x0), y0 = Math.max(0, b.y0), w = Math.min(W, b.x1) - x0, h = Math.min(H, b.y1) - y0;
          if (w <= 0 || h <= 0) continue;
          const px = g.getImageData(x0, y0, w, h).data;
          let n = 0;
          for (let i = 3; i < px.length; i += 4) if (px[i] >= MIN_A) n++;
          if (n > r.covered) { r.covered = n; r.frame = f; r.phase = `${a ? a.phase : 'walk'} over ${y.name}`; }
        }
      }
      const rc = k.reach;
      if (a && rc && a.phase === 'stroke') {
        keeperJoint(k.rig, 'handN', pt);
        r.miss = Math.max(r.miss, Math.round(Math.hypot(pt.x - (k.x + k.facing * rc.x * k.scale), pt.y - (k.y + rc.y * k.scale)) * 10) / 10);
      }
    }
    for (const [a, r] of open) if (a.done) { r.done = r.frames <= YARD_ACT_MAX; open.delete(a); }
  }
  // (an act still running when the run ends is fine if it is young; one older than YARD_ACT_MAX is stuck, and so is
  // one that ended but took longer)
  for (const [, r] of open) r.done = r.frames < YARD_ACT_MAX;
  if (window.__dragonCare) window.__dragonCare.care = rows.map(({ start: _s, ...r }) => r);
  const bad = rows.filter((r) => r.covered > 0 || r.miss > REACH_MISS || !r.done);
  const lines = rows.map((r) => `${r.act} ${r.id}: ${r.covered ? `EYE COVERED ${r.covered} PX AT F${r.frame} (${r.phase})` : 'EYE CLEAR'}  HAND ${r.miss} PX  ${r.done ? `${r.frames} F` : 'STUCK'}${r.covered > 0 || r.miss > REACH_MISS || !r.done ? '  FAIL' : ''}`);
  return {
    w: 560, h: Math.max(120, 24 + lines.length * 9), pets: [],
    draw(ctx) {
      ctx.fillStyle = P.bg || STRAW; ctx.fillRect(0, 0, this.w, this.h);
      label(ctx, `YARD AUDIT: ${rows.length} ROWS IN ${YARD_AUDIT_T} F, ${bad.length} FAILING (AN EYE COVERED, A HAND OFF ITS MARK BY MORE THAN ${REACH_MISS} PX, OR STUCK)`, this.w / 2, 4, LABEL, 1);
      lines.forEach((t, i) => label(ctx, t.toUpperCase(), this.w / 2, 16 + i * 9, t.endsWith('FAIL') ? '#8a1c1c' : LABEL, 1));
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

// ---------- the tail-ceiling audit (3.0: fire's zone above the tail tip) ----------

/**
 * The most a tail that ENDS IN A SHAPE (a look with a `tipBox`: water's fluke) may rise over the back at the hip, px,
 * on any frame of a core anim (3.0: "no other tail rises > 3 px above the back line"). The fluke carried up to head
 * height is fire's "U" at / 3 (cast review v2: the adult walk peaked 23 px over the back on 45 of 96 frames, the
 * happy 26, the pet, eat and wake 16 to 23). A look that caps its tail's rise (`tailRise` under 1: dusk's smoke-tipped
 * taper, 2.3's "never above the back line") is gated too (cast review v2 round 2: its adult happy swung the pale tip 7
 * px over the back, into fire's zone). Any other plain taper is reported, not gated: lightning's and slinkwing's thin
 * tails lift 10 to 15 px in the eat, happy and pet with no tip shape to name another element.
 */
export const TAIL_CEIL = 3;
/** view=tails: the core set (4.2); a loop runs twice its length (the chain's steady state), a one-shot 16 f past its end. */
const TAIL_ANIMS = ANIM_NAMES;

/**
 * view=tails: how far each look's tail rises over its back (3.0, 5.1 #1). Every look plays every core anim frame by
 * frame at game scale 1, drawn flat with its wings folded (a preen's spread wing over the hip is not the back, nor a
 * tail). The BACK is the silhouette's top in the hip's column (the back row and the dorsal crest count), or the
 * standing back's where the pose lowers it; the TAIL is the topmost ink behind the haunch, 2 px past the hip ball's
 * back edge. Asleep is skipped (the body lies on the straw and the fluke stands clear of the laid-out tail: the asleep
 * cue, 3.6). The worst frame per look and anim goes on window.__dragonCare.tails for tools/smoke.ts, which fails a
 * tip-shaped tail (a tipBox: the fluke) or a capped one (tailRise < 1: dusk's) over TAIL_CEIL; fire, whose flame owns
 * the zone, and any other plain taper are listed but never gated.
 */
function tailsScene(P: GalleryParams): Scene {
  const W = 320, H = 200, GX = 170, GY = 150;
  const off = document.createElement('canvas');
  off.width = W; off.height = H;
  const g = off.getContext('2d', { willReadFrequently: true })!;
  const rows: { id: string; anim: string; over: number; frame: number; gated: boolean; high: boolean }[] = [];
  const els = P.els || ELEMENT_IDS, stages = P.stages || STAGES, anims = P.anims || TAIL_ANIMS;
  const pt = { x: 0, y: 0 };
  for (const el of els) for (const st of stages) for (const a of anims) {
    const p = makePet(el, st, P.seed, a, GX, GY, { desync: false, blink: false });
    if (p.player.name !== a) continue;
    const rig = p.rig, one = ONE_SHOTS.includes(a);
    const len = one ? Math.max(1, p.player.length) + 16 : Math.max(96, 2 * p.player.length);
    // the back's top in the hip's column and the tail's top behind the haunch (x under the hip's back edge - 2 px),
    // drawn flat with the wings folded
    const backOf = (pose: PartialDragonPose): number => {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, W, H);
      drawDragon(g, rig, { ...pose, wing: { fold: 0, flap: 0 } }, petOpts(p, { still: true, shadow: false, top: null, silhouette: true }));
      rootToScreen(rig, rig.j.hip.x, rig.j.hip.y, pt);
      const col = g.getImageData(Math.round(pt.x), 0, 1, H).data;
      for (let y = 0; y < H; y++) if (col[y * 4 + 3] >= 128) return y;
      return H;
    };
    const tailOf = (): number => {
      const tx = Math.max(1, Math.round(pt.x - rig.dims.hipR - 2)), img = g.getImageData(0, 0, tx, H).data;
      for (let y = 0; y < H; y++) for (let x = 0; x < tx; x++) if (img[(y * tx + x) * 4 + 3] >= 128) return y;
      return H;
    };
    // (a back LOWERED -- sat to beg, bowed, lying down or getting up -- is measured against the standing one: the
    // fluke on the straw behind a sitting dragon is low, not over its back)
    const stand = backOf(DP({}));
    let worst = -Infinity, at = 0;
    for (let f = 0; f < len; f++) {
      const pose = p.player.pose, back = Math.min(stand, backOf(pose)), over = back - tailOf();
      // (asleep the body lies on the floor and the fluke stands clear of the tail laid out along it, the asleep cue:
      // 3.6, 5.1 #1's asleep sheet; the ceiling is for a standing back)
      if (pose.sleep < 0.5 && over > worst) { worst = over; at = f; }
      stepPet(p);
    }
    const gated = (!!rig.sp.tipBox || (rig.sp.tailRise ?? 1) < 1) && el !== 'fire';
    rows.push({ id: `${el}-${st}`, anim: a, over: worst, frame: at, gated, high: gated && worst > TAIL_CEIL });
  }
  if (window.__dragonCare) window.__dragonCare.tails = rows;
  const bad = rows.filter((r) => r.high);
  const lines = rows.map((r) => `${r.id} ${r.anim}: ${r.over} PX AT F${r.frame}${r.high ? '  OVER' : r.gated ? '  (GATED)' : ''}`);
  return {
    w: 480, h: Math.max(120, 24 + lines.length * 9), pets: [],
    draw(ctx) {
      ctx.fillStyle = P.bg || STRAW; ctx.fillRect(0, 0, this.w, this.h);
      label(ctx, `TAIL CEILING: ${rows.length} LOOK x ANIM RUNS, ${bad.length} TIP SHAPES OVER ${TAIL_CEIL} PX ABOVE THE BACK`, this.w / 2, 4, LABEL, 1);
      lines.forEach((t, i) => label(ctx, t.toUpperCase(), this.w / 2, 16 + i * 9, t.endsWith('OVER') ? '#8a1c1c' : LABEL, 1));
    },
  };
}

// ---------- the pour-column audit (3.8: Nightfall is breathed out, never poured) ----------

/**
 * view=pour: no breath effect may be ONE connected mark from the mouth down to the floor (3.8, 5.1 #12: a column of
 * mist from the lip to a puddle reads as the dragon being sick, a rope of beads as a stream: cast review v2, both
 * rounds). Every look plays its breath from its first frame to 16 f past its last at game scale 1, and each frame is
 * drawn twice on a clear canvas with no ground shadow and no top pass: as it is, and flat (a silhouette draw, which
 * draws no breath), so what the first has and the second has not is the dragon's effects off its body. Of those
 * pixels (alpha >= 50 %, 8-connected) a component that reaches from POUR_LIP px under the mouth or higher down to
 * the floor row is a pour column. The worst frame per look (the tallest such component, or the component nearest
 * to it) goes on window.__dragonCare.pour for tools/smoke.ts, which fails any column; the babies' fizzles, which
 * rise, are played too.
 */
export const POUR_LIP = 3;
function pourScene(P: GalleryParams): Scene {
  const W = 320, H = 200, GX = 150, GY = 150, MIN_A = 128;
  const a = document.createElement('canvas'), b = document.createElement('canvas');
  a.width = b.width = W; a.height = b.height = H;
  const ga = a.getContext('2d', { willReadFrequently: true })!, gb = b.getContext('2d', { willReadFrequently: true })!;
  const rows: { id: string; frame: number; top: number; lip: number; column: boolean }[] = [];
  const els = P.els || ELEMENT_IDS, stages = P.stages || STAGES;
  const pt = { x: 0, y: 0 }, lab = new Int32Array(W * H), stack = new Int32Array(W * H);
  for (const el of els) for (const st of stages) {
    const p = makePet(el, st, P.seed, 'breath', GX, GY, { desync: false, blink: false });
    if (p.player.name !== 'breath') continue;
    const len = Math.max(1, p.player.length) + 16;
    // the worst frame: a column if any, else the effect component whose top came nearest the lip line, among those
    // that reach the floor (none reaching the floor: top = H)
    let worst = { frame: 0, top: H, lip: 0, column: false };
    for (let f = 0; f < len; f++) {
      const pose = p.player.pose;
      for (const [g, sil] of [[ga, false], [gb, true]] as const) {
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
        drawDragon(g, p.rig, pose, petOpts(p, { still: true, shadow: false, top: null, silhouette: sil ? '#0000ff' : undefined }));
      }
      rootToScreen(p.rig, p.rig.j.mouth.x, p.rig.j.mouth.y, pt);
      const lip = Math.round(pt.y) + POUR_LIP;
      const da = ga.getImageData(0, 0, W, H).data, db = gb.getImageData(0, 0, W, H).data;
      lab.fill(0);
      let next = 1;
      for (let i = 0; i < W * H; i++) {
        if (lab[i] || da[i * 4 + 3] < MIN_A || db[i * 4 + 3] >= MIN_A) continue;
        // flood one component, keeping its top row and whether it touches the floor row
        let sp = 0, top = H, floor = false;
        stack[sp++] = i; lab[i] = next;
        while (sp) {
          const j = stack[--sp], x = j % W, y = (j - x) / W;
          if (y < top) top = y;
          if (y >= GY - 1) floor = true;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const X = x + dx, Y = y + dy, k = Y * W + X;
            if (X < 0 || Y < 0 || X >= W || Y >= H || lab[k] || da[k * 4 + 3] < MIN_A || db[k * 4 + 3] >= MIN_A) continue;
            lab[k] = next; stack[sp++] = k;
          }
        }
        next++;
        if (floor && top - lip < worst.top - worst.lip) worst = { frame: f, top, lip, column: top <= lip };
      }
      stepPet(p);
    }
    rows.push({ id: `${el}-${st}`, ...worst });
  }
  if (window.__dragonCare) window.__dragonCare.pour = rows;
  const bad = rows.filter((r) => r.column);
  const lines = rows.map((r) => `${r.id}: ${r.top >= H ? 'NOTHING ON THE FLOOR' : `TOP ${r.top - r.lip + POUR_LIP} PX UNDER THE MOUTH AT F${r.frame}`}${r.column ? '  COLUMN' : ''}`);
  return {
    w: 480, h: Math.max(120, 24 + lines.length * 9), pets: [],
    draw(ctx) {
      ctx.fillStyle = P.bg || STRAW; ctx.fillRect(0, 0, this.w, this.h);
      label(ctx, `POUR COLUMN: ${rows.length} BREATHS, ${bad.length} WITH ONE MARK FROM ${POUR_LIP} PX UNDER THE MOUTH TO THE FLOOR`, this.w / 2, 4, LABEL, 1);
      lines.forEach((t, i) => label(ctx, t.toUpperCase(), this.w / 2, 16 + i * 9, t.endsWith('COLUMN') ? '#8a1c1c' : LABEL, 1));
    },
  };
}

// ---------- the neutral-area recorder (3.1: neutral area <= 40 %) ----------

/** The most of a look's silhouette that may be neutral (3.1, a hard rule): HSV saturation under NEUTRAL_S. */
export const NEUTRAL_MAX = 0.4, NEUTRAL_S = 0.25;

/**
 * view=neutral: the share of each look's pixels that are NEUTRAL (3.1: "neutral area <= 40 %"; 5.5's recorder). Every
 * look at game scale 1, standing at rest at mood 0 (the lineup's pose), drawn alone on a transparent canvas: of the
 * pixels it covers (alpha >= 50 %) the share whose colour has HSV S < 0.25, the ink and the anti-aliased edge included
 * (the ink `#1a1018` is S 0.38: not neutral), the ground shadow and the top pass left out. The rows go on
 * window.__dragonCare.neutral for tools/smoke.ts, which fails any over NEUTRAL_MAX. (Cast review v2's first count, on the
 * 1x lineup over the straw with its edges blended into it, put the elder dusk near 50 %: the one the recorder was
 * wanted for, 3.8's open risk.)
 */
function neutralScene(P: GalleryParams): Scene {
  const W = 200, H = 140;
  const off = document.createElement('canvas');
  off.width = W; off.height = H;
  const g = off.getContext('2d', { willReadFrequently: true })!;
  const rows: { id: string; share: number; over: boolean }[] = [];
  const els = P.els || ELEMENT_IDS, stages = P.stages || STAGES;
  for (const el of els) for (const st of stages) {
    const p = makePet(el, st, P.seed, 'rest', 110, 110, { desync: false, blink: false });
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    drawDragon(g, p.rig, p.player.pose, petOpts(p, { still: true, shadow: false, top: null }));
    const d = g.getImageData(0, 0, W, H).data;
    let n = 0, grey = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue;
      n++;
      const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
      if (mx === 0 || (mx - mn) / mx < NEUTRAL_S) grey++;
    }
    const share = n ? grey / n : 0;
    rows.push({ id: `${el}-${st}`, share: Math.round(share * 1000) / 1000, over: share > NEUTRAL_MAX });
  }
  if (window.__dragonCare) window.__dragonCare.neutral = rows;
  const bad = rows.filter((r) => r.over);
  const lines = rows.map((r) => `${r.id}: ${Math.round(r.share * 100)} % NEUTRAL${r.over ? '  OVER' : ''}`);
  return {
    w: 480, h: Math.max(120, 24 + lines.length * 9), pets: [],
    draw(ctx) {
      ctx.fillStyle = P.bg || STRAW; ctx.fillRect(0, 0, this.w, this.h);
      label(ctx, `NEUTRAL AREA: ${rows.length} LOOKS, ${bad.length} OVER ${Math.round(NEUTRAL_MAX * 100)} % (HSV S < ${NEUTRAL_S})`, this.w / 2, 4, LABEL, 1);
      lines.forEach((t, i) => label(ctx, t, this.w / 2, 16 + i * 9, t.endsWith('OVER') ? '#8a1c1c' : LABEL, 1));
    },
  };
}

// ---------- the elders' worn wings (2.9) ----------

/**
 * view=wings: every elder's wing wear (2.9) at game scale 1 blown up `scale` times (default 3), seven columns and three
 * rows: FULL SPREAD (wing 1, flap 0: the flight's spread, where the notched 4 x 3 hole, seated against the forearm, shows
 * the straw through both wings), the AIRING's hold (the elder's idle variant: the hole seen at home, where the look can
 * sit back far enough; lightning's storm-watch and rock's sunning are their own airings) and THE PREEN'S HOLD (the
 * happy anim at f 30, in the elder preen's hold: each look's real resting spread, 0.6 leaning back 48 or slinkwing's
 * own 0.9 leaning back 60, where the tears show; a static 0.6 / 48 showed slinkwing at a spread it never takes, and
 * rock rolls over instead). Lightning's bolts and rock's stubby wings have no hole (no room: 2.9); their tears are the element's
 * (lightning's, shown in its storm-watch) or one small notch (rock).
 */
function wingsScene(P: GalleryParams): Scene {
  const k = Math.max(1, Math.round(P.scale || 3)), cw = 150, ch = 100, n = ELEMENT_IDS.length;
  const rows: { name: string; pose: PartialDragonPose | null; anim: string; t: number }[] = [
    { name: 'FULL SPREAD (THE HOLE)', pose: DP({ wing: [1, 0], face: 'happy' }), anim: 'rest', t: 0 },
    { name: 'AIRING, THE HOLD (THE HOLE AT HOME)', pose: null, anim: 'airing', t: 40 },
    { name: "THE PREEN'S HOLD (THE TEARS)", pose: null, anim: 'happy', t: 30 },
  ];
  const pets: Pet[] = [];
  rows.forEach((r, j) => ELEMENT_IDS.forEach((el, i) => {
    const p = makePet(el, 'elder', P.seed, r.anim, i * cw + Math.round(cw * 0.58), j * ch + ch - 12, { mood: P.mood, desync: false, blink: false });
    if (r.pose) p.player.setStaticPose(r.pose);
    else seekPet(p, r.t);
    p.anim = 'rest';
    pets.push(p);
  }));
  // (the last column's cue may reach past its cell: dusk's elder lantern and moth, ElementSpec.reach)
  const pad = Math.max(0, ...ELEMENT_IDS.map((el) => ELEMENTS[el].reach?.elder ?? 0));
  const off = document.createElement('canvas');
  off.width = cw * n + pad; off.height = ch * rows.length;
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
    case 'tails': return tailsScene(P);
    case 'pour': return pourScene(P);
    case 'neutral': return neutralScene(P);
    case 'wings': return wingsScene(P);
    case 'keepers': return keepersScene(P);
    case 'care': return careScene(P);
    case 'careaudit': return careAuditScene(P);
    case 'yard': return yardScene(P);
    case 'yardaudit': return yardAuditScene(P);
    default: return lineupScene(P);
  }
}

function render(ctx: CanvasRenderingContext2D, scene: Scene, P: GalleryParams, live: boolean): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  scene.draw(ctx);
  const post = P.view === 'grey' || P.view === 'cvd' ? P.view : P.post;
  if (post) {
    postProcess(ctx, scene.w, scene.h, post);
    label(ctx, post === 'grey' ? 'GREYSCALE' : 'SIMULATED DEUTERANOPIA', scene.w / 2, 4, post === 'grey' ? '#303030' : LABEL, 1);
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
