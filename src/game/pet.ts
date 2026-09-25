// A pet: one dragon on screen -- its rig, its anim player and where it stands -- and what a scene does with its pets
// every tick (the wary latch and the crowd rule: docs/ART_BIBLE.md 5.4) and every frame (y-sorted, with the eat bowl).
// Shared by the gallery (src/gallery.ts), which shows the art pipeline every look, and the base (src/game/base.ts),
// which drives its pets from the care simulation. Moved out of the gallery unchanged; what was the gallery's query
// state (its static pose overlay, the elders' wear, every pet's bond and charge) is now per pet or per call. The eat
// bowl is the one the keepers carry in and set down too (src/art/props.ts).
import { dragonBuild } from '../art/dragon/build.ts';
import { buildDragon, drawDragon, stepDragon } from '../art/dragon/rig.ts';
import type { DragonRig, DrawDragonOpts } from '../art/dragon/rig.ts';
import { DragonAnimPlayer, blinkFor } from '../art/dragon/anim.ts';
import { dragonAnims, ONE_SHOTS, ELEMENT_ANIM_FALLBACK, idleVariants, variantEvery, SPREAD_VARIANTS, CROWD_GAP } from '../art/dragon/anims.ts';
import { ELEMENTS } from '../art/dragon/elements/index.ts';
import type { PartialDragonPose } from '../art/dragon/pose.ts';
import { bowlFor, drawBowl as drawBowlAt } from '../art/props.ts';
import type { Stage } from '../art/dragon/stages.ts';
import type { DragonElement } from '../art/dragon/palettes.ts';
import type { TopPass, AmbientBudget } from '../art/dragon/fx.ts';

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
  /** Its bond (0..1, rock's crystal count: 3.4) and boredom charge (0..1, lightning's crackle: 3.5), drawn as given. */
  bond: number;
  charge: number;
}

export interface MakePetOpts {
  scale?: number;
  facing?: number;
  mood?: number;
  desync?: boolean;
  blink?: boolean;
  /** A static pose overlay: the pet holds it instead of playing its anim (the gallery's pose query). */
  staticPose?: PartialDragonPose | null;
  /** false: an elder without its tears and hole (2.9's with / without measure). Default true. */
  wear?: boolean;
}

export function makePet(el: DragonElement, stage: Stage, seed: number, anim: string, x: number, y: number, opts: MakePetOpts = {}): Pet {
  const build = dragonBuild({ element: el, stage, seed });
  const rig = buildDragon(build);
  // (wear=0: the same elder without its tears and hole, the other half of 2.9's with / without measure; the renderers'
  // info.sp too, or an element that reads its wear there -- a custom wing's tear -- ignored it)
  if (opts.wear === false) { rig.sp = { ...rig.sp, wing: { ...rig.sp.wing, tears: undefined, hole: undefined } }; rig.info.sp = rig.sp; }
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
  const pose = opts.staticPose ?? null;
  if (pose) player.setStaticPose(pose);
  return {
    rig, player, x, y, facing: opts.facing ?? 1, scale: opts.scale ?? 1, mood: opts.mood ?? 0,
    label: `${ELEMENTS[el].name} ${stage}`, anim, hold: 0, wx: 0, roam: null, wary: 0, waryOn: false, bond: 1, charge: 0,
    bowl: anim === 'eat' && !pose ? bowlFor(rig, anims.eat ? anims.eat.frames : []) : null,
  };
}

/** Where the eat bowl stands (src/art/props.ts bowlFor: under the snout at the chomp). */
export { bowlFor };

/** A pet's draw options: where it stands, its mood, wariness, bond and charge, then `extra` (a scene's own). */
export function petOpts(p: Pet, extra: Partial<DrawDragonOpts> = {}): DrawDragonOpts {
  return { x: p.x, y: p.y, facing: p.facing, scale: p.scale, mood: p.mood, wary: p.wary, bond: p.bond, charge: p.charge, ...extra };
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
export function stepWary(pets: readonly Pet[]): void {
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
export function extentX(p: Pet): [number, number] {
  const d = p.rig.dims, s = p.scale * p.rig.scale;
  const back = (d.hipR + d.gap / 2 + d.tail.n * d.tail.len) * s, front = (d.gap / 2 + d.chestR + d.headLen) * s;
  return p.facing < 0 ? [p.x - front, p.x + back] : [p.x - back, p.x + front];
}

/** Frames a finished one-shot is held before the gallery replays it (a live view keeps showing the anim). */
export const REPLAY = 40;

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
export function seekPet(p: Pet, t: number): void { for (let i = 0; i < t; i++) stepPet(p); }

/** Frames of an anim's intro (the frames before its loopFrom): the lie-down of sleep. */
export function animIntro(p: Pet, name: string): number {
  const a = p.player.anims[name];
  if (!a || !a.loopFrom) return 0;
  let n = 0;
  for (let i = 0; i < a.loopFrom; i++) n += a.frames[i].dur || 1;
  return n;
}

/** What a scene's pets share when they are drawn: the top pass, the ambient budget (5.4) and the frame count. */
export interface PetFx {
  top: TopPass;
  budget: AmbientBudget;
  frame: number;
}

/** Draw pets y-sorted by the feet (5.4), each eating pet's bowl after it, then the top pass. */
export function drawPets(ctx: CanvasRenderingContext2D, pets: readonly Pet[], fx: PetFx, extra: Partial<DrawDragonOpts> = {}): void {
  const order = pets.slice().sort((a, b) => a.y - b.y);
  fx.budget.begin(order.length, fx.frame);
  for (let i = 0; i < order.length; i++) {
    const p = order[i];
    drawDragon(ctx, p.rig, p.player.pose, petOpts(p, { still: true, top: fx.top, budget: fx.budget, slot: i, ...extra }));
    if (p.bowl && !extra.silhouette) drawBowl(ctx, p);
  }
  fx.top.flush(ctx);
}

/**
 * The food bowl in front of an eating pet (drawn AFTER it, 4.2), at the pet's scale: props.ts drawBowl, the one bowl
 * the keepers carry in and set down too (src/care/acts.ts).
 */
export function drawBowl(ctx: CanvasRenderingContext2D, p: Pet): void {
  const b = p.bowl!, sc = p.scale * p.rig.scale;
  drawBowlAt(ctx, Math.round(p.x + p.facing * b.x * sc), Math.round(p.y), b.w, b.h, sc);
}
