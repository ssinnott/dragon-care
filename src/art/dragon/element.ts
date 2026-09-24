// THE SEAM between the shared dragon rig and the six elements.
//
// One parameterised quadruped rig draws all 18 looks (ART_GENERATOR lesson 49: a renderer fix reaches the whole
// cast). What differs per element arrives through ONE object, an ElementSpec, which each element file
// (elements/<id>.ts) exports and nothing else. An element artist owns exactly that file and may touch nothing else,
// so everything they can change is reachable from here:
//
//   - DATA: palette, the 2.3 modifiers, and per stage the parameters of the SHARED features (horns, markings, wing
//     style, tail rest shape, dorsal fin). Shared features are drawn by features.ts / parts.ts, never per element.
//   - RENDERERS at FIXED ANCHORS the rig calls in the draw order of bible 1.4 (see ElementRenderers). Each gets
//     (ctx, rig, pose, info) in a documented local space, with the light already pointing the right way, and must
//     leave the context as it found it (save / restore anything it changes beyond paths and fill styles).
//   - ANIM hooks: per-stage overrides merged over the shared table (anims.ts), and the idle fidget.
//
// Renderer rules (the bible's hard rules, restated where an element artist will read them):
//   - allocation-free per frame: no arrays, closures or objects in a renderer body; module-level scratch only;
//   - deterministic: no Math.random / Date / performance.now. Drive motion from info.tick (the rig's step count),
//     pose values and the seeded fx.ts helpers, so a frozen-time screenshot is reproducible;
//   - colours from info.pal (already the far palette on a far call) and always through rig.col() for fills that
//     must honour flash / silhouette (the cel* helpers already do);
//   - pigment (markings, masks, spots) is clipped and never inked; separate objects are inked (bible 1.6);
//   - emitters (flame, crystals, bolts, sparks) are flat, never cel-banded (D20); features.ts has the helpers;
//   - the cue is the mood gauge (D7): read info.mood (-1..1) and keep >= 60 % of the cue's silhouette at -1.
import type { DragonElement, DragonPalette } from './palettes.ts';
import type { ElementModifiers, Stage, TailRest } from './stages.ts';
import type { DragonPose } from './pose.ts';
import type { DragonRig } from './rig.ts';
import type { DragonAnim } from './anim.ts';

// ---------- shared-feature parameters (drawn by features.ts / parts.ts) ----------

/**
 * Paired horns (fire, lightning) and brow thorns (spike), drawn by features.drawHorn. Cranium space. Quiet-zone
 * budget (3.0): <= 3 px thick, swept back within 20 deg of the neck line, <= 3 px above the skull top.
 */
export interface HornParams {
  /** Length, px. */
  len: number;
  /** Radius at the root and at the tip (1.5 -> 1 is a 3 px -> 2 px horn). */
  r0: number;
  r1: number;
  /** Root position on the cranium circle: angle in degrees, 0 = +x (snout side), 90 = straight up. */
  at: number;
  /** Root sunk this far inside the cranium circle, px. */
  sink: number;
  /** Direction, degrees BELOW straight back in cranium space (the neck line runs back and down). */
  sweep: number;
  /** Bend at the midpoint, degrees (+ = the tip curls up). */
  bend: number;
  /** 0..1 position of a sharp kink instead of a bend (lightning: 0.6); 0 = the bend is at the midpoint. */
  kinkAt: number;
}

/** Wing construction. `style` picks the renderer in parts.ts; 'custom' means ElementRenderers.wing replaces it. */
export type WingStyle = 'bat' | 'leaf' | 'fin' | 'custom';

export interface WingParams {
  style: WingStyle;
  /** Use the stage's "+1 spar" set (water, shriekscale: 3 young / 4 adult) instead of the standard 2 / 3. */
  plus: boolean;
  /** Trailing-edge cut between spar tips, px, x the fold channel (1.2). Negative = a convex bulge (leaf, fin). */
  scallop: number;
  /** Multiplier on every wing bone (rock's stubby 0.7). */
  span: number;
  /** Folded wrist knuckle rise above the back line, px (1.3: 3; spike and rock 0). Moves the folded wrist down by 3 - foldRise. */
  foldRise: number;
  /** Each spar pokes this far past the membrane as a thorn (spike adult 3); 0 = none. */
  thorn: number;
  /** Wrist thorn / thumb claw length (spike adult 4, shriekscale adult 3); 0 = none. */
  wristThorn: number;
  /** Baby nub rest angle override (spike 200: along the flank below the quills). */
  nubRest?: number;
  /** Wing root offset from the stage table's root, body space px (lightning's bolt sits 3 px back). */
  rootDx?: number;
  rootDy?: number;
}

export type MarkingKind = 'chevron' | 'ring' | 'zstripe' | 'spot';
/**
 * Where a marking sits. Body anchors are body space and are clipped to the body above the belly line; 'tail' is
 * clipped to the tail tube and drawn across it at fraction `t` of its length.
 */
export type MarkingAnchor = 'shoulder' | 'haunch' | 'flank' | 'tail';

export interface MarkingSpec {
  kind: MarkingKind;
  at: MarkingAnchor;
  /** 'tail': 0 = root .. 1 = tip. 'flank': 0 = hip centre .. 1 = chest centre. */
  t?: number;
  /** Width, px (the height too unless `h` is given). Bands are >= 3 px thick (5.2). */
  size: number;
  h?: number;
  /** Nudge in body space (tail: along / across the tail), px. */
  dx?: number;
  dy?: number;
}

/** Water's dorsal fin row (3.6): low, continuous, round scallops in membrane. Drawn by features.drawDorsalRow. */
export interface DorsalParams {
  height: number;
  scallops: number;
  /**
   * Span in body-space x, px from the hip centre (negative = behind it). Behind the rump the row runs on along the
   * TOP of the tail, so a crest can start on the tail root and climb onto the back.
   */
  from: number;
  to: number;
}

/** One stage's parameters for the shared features. */
export interface ElementStageParams {
  /** Tail rest shape (stages.ts TAIL_REST holds the bible's table). */
  tailRest: TailRest;
  /** Absolute tail radius [root, tip], replacing stage x modifier (water's baby 3.5 -> 1.5). */
  tailR?: readonly [number, number];
  /** Paired horns, or null. */
  horns: HornParams | null;
  /** Markings, first marking first: the first is an invariant (2.7), the rest vary with the pet seed (2.8). */
  markings: readonly MarkingSpec[];
  wing: WingParams;
  dorsal: DorsalParams | null;
  /**
   * Extra circles in the skull's contour, cranium space (rock's nose-horn root, shriekscale's nose-leaf): bumps in
   * the one skull path, never new outlined objects (1.2).
   */
  skullBumps?: readonly { x: number; y: number; r: number }[];
  /** Brow-ridge bump in px, replacing the stage table's 0 / 1 / 2 (rock's heavier 0 / 2 / 3). */
  brow?: number;
}

// ---------- the renderer anchors ----------

/** Which anchor a renderer is being called at (also what `info.anchor` says). */
export type AnchorName = 'farHead' | 'nearHead' | 'tailTip' | 'backRow' | 'bodyOver' | 'wing' | 'headMarkings' | 'breath' | 'ambient';

/**
 * The reusable info object every element renderer receives. The rig owns ONE per rig and refills it before every
 * call: read it, never retain it.
 */
export interface DragonInfo {
  anchor: AnchorName;
  element: DragonElement;
  stage: Stage;
  /** True on a far-side call (farHead, the far wing): `pal` is then already the far palette. */
  far: boolean;
  /** The palette to colour from: near, far legs or far wing/head (bible D8). */
  pal: Readonly<DragonPalette>;
  /** The near palette, always (for a far part that needs to know its near partner's colours). */
  near: Readonly<DragonPalette>;
  /** Resolved mood, -1..1: the pet's resting mood + pose.mood, clamped. The cue is the gauge (D7). */
  mood: number;
  /** pose.sleep >= 0.5. */
  asleep: boolean;
  /** The rig's step counter (rig.tick): the clock for flicker, crackle and ambient schedules. */
  tick: number;
  /** Per-pet seed (2.8), for seeded schedules and variants. */
  seed: number;
  /** This stage's shared-feature parameters (after the seeded variant). */
  sp: Readonly<ElementStageParams>;
  /**
   * Anchor size, px: cranium radius (head anchors), tail tip radius (tailTip), hip radius (backRow / bodyOver),
   * wing span scale (wing), jaw length (breath), 0 (ambient).
   */
  r: number;
  /** Anchor length, px: head length (head anchors), tail length (tailTip), body length (body anchors), 0 otherwise. */
  len: number;
  /**
   * Rotation of this anchor's space relative to ROOT space, degrees clockwise. Counter-rotate by it to stand
   * something upright: `ctx.rotate(-info.ang * Math.PI / 180)` (fire's flame). Includes body pitch.
   */
  ang: number;
}

/** An element renderer. The rig calls it in the anchor's space with the light set for that space. */
export type ElementDraw = (ctx: CanvasRenderingContext2D, rig: DragonRig, pose: DragonPose, info: DragonInfo) => void;

/**
 * Element renderers at fixed anchors, listed in the order drawDragon calls them (bible 1.4). All optional.
 *
 * SPACES (all authored facing right; facing -1 mirrors everything including the light):
 *   root space   : origin on the ground under the body centre, +x forward, y down (negative = up).
 *   body space   : origin at the body centre (rig.j.body), rotated by the body pitch; +x forward, y down.
 *                  Ball centres, the belly line and the tail nodes in body space are on rig.j (see DragonJoints).
 *   cranium space: origin at the cranium centre, rotated by the head angle; +x toward the snout, y down.
 *                  info.r = cranium radius. The eye centre is rig.dims.head.eye (x, y).
 *   tail-tip space: origin at the centre of the last tail node, rotated so +x is FORWARD along the last segment
 *                  (toward the body) and the tail continues toward -x; -y is the tail's top (dorsal) side. When the
 *                  tail is level this is root space's orientation. info.ang = its rotation (counter-rotate to stand
 *                  upright), info.r = tip radius.
 *   wing space   : origin at the wing root, rotated by body pitch and the flap; +x forward, y down. Bone angles are
 *                  elevations from +x (+ up), as in 2.2.
 *   mouth space  : origin at the jaw hinge, rotated to the upper jaw line; +x points OUT of the mouth.
 */
export interface ElementRenderers {
  /** Step 3: far head features (far horn, far ear-fan, far fin-ear). Cranium space, far palette. */
  farHead?: ElementDraw;
  /** Step 5: the tail-tip feature (flame, fluke), after the tail. Tail-tip space. */
  tailTip?: ElementDraw;
  /** Step 6: back row (quills, dorsal fin) BEFORE the body, so the body contour hides the roots. Body space. */
  backRow?: ElementDraw;
  /**
   * Step 7b / 8: after body, belly band and body markings. Body space. With `wingUnderBodyOver` (rock) the near
   * wing is drawn just before this, so the dome's rim lies over it.
   */
  bodyOver?: ElementDraw;
  /**
   * Steps 2 and 11: full wing replacement (lightning's bolt), called for the far wing (info.far, far wing palette)
   * and the near wing. Wing space. Only used when the stage's wing.style is 'custom'.
   */
  wing?: ElementDraw;
  /** Step 12.4: face markings, clipped to the skull (shriekscale's mask). Cranium space. */
  headMarkings?: ElementDraw;
  /** Step 12.6: near head features (horn-cues, ear-fans, fin-ears, rock's nose horn). Cranium space. */
  nearHead?: ElementDraw;
  /** Step 13: the signature breath / trick effect, driven by pose.fx and info.tick (plus the baby fizzle). Mouth space. */
  breath?: ElementDraw;
  /** Step 13: the idle ambient effect (embers, crackles, drips), through fx.ts caps; rising particles go to the top pass. Root space. */
  ambient?: ElementDraw;
}

/** Animation hooks, merged by anims.ts over the shared table. */
export interface ElementAnimHooks {
  /** Per-stage anim overrides by name (a fire strut for 'walk', rock's 110 f 'happy'...). */
  overrides?: (stage: Stage) => Partial<Record<string, DragonAnim>>;
  /** The idle fidget variant (section 3: fire chases its flame, rock sunbathes...). */
  fidget?: (stage: Stage) => DragonAnim | null;
}

/** Everything one element is. elements/<id>.ts exports exactly one of these. */
export interface ElementSpec {
  id: DragonElement;
  /** The bible nickname: 'Ember', 'Bramble', 'Cobble', 'Zap', 'Ripple', 'Echo'. */
  name: string;
  /** One line of identity, for tooltips and the care panel. */
  blurb: string;
  /** The element palette (palettes.ts DRAGON_PALETTES[id]; never per stage). */
  palette: Readonly<DragonPalette>;
  /** 2.3 proportion modifiers (full strength; build.ts halves them on babies). */
  modifiers: Readonly<ElementModifiers>;
  /** Shared-feature parameters per stage. */
  stages: Readonly<Record<Stage, Readonly<ElementStageParams>>>;
  /** Element renderers at the fixed anchors. */
  render: Readonly<ElementRenderers>;
  /** Rock: draw the near wing before bodyOver so the dome's rim tucks it under (bible 1.4 step 8). */
  wingUnderBodyOver?: boolean;
  /**
   * The colour the shared markings are painted in, per frame: water's pearl spots swap marking -> glow (mood >= 0.5)
   * or -> the dim spot (mood <= -0.3) (3.6, gate h). Omitted = `palette.marking`. Must return a stable string
   * (a palette slot or a module constant), never a freshly built one.
   */
  markingTone?: (info: DragonInfo) => string;
  /**
   * The throat sac (shriekscale, 3.7): px the neck's lower contour swells just behind the jaw this frame, as a
   * membrane bulge in the neck's own silhouette (inked with the neck, 1.2). Return 0 when not shrieking.
   */
  neckSac?: (pose: DragonPose, info: DragonInfo) => number;
  /** Lightning: the tail's secondary motion is stepped, snapping on holds of this many frames (4.1). 0 = smooth. */
  tailHold?: number;
  anims?: ElementAnimHooks;
}

/** A shorthand for the common wing params (a folded bat wing with the standard spar count). */
export function wingParams(p: Partial<WingParams> & { style: WingStyle }): WingParams {
  return { plus: false, scallop: 0, span: 1, foldRise: 3, thorn: 0, wristThorn: 0, ...p };
}

/** A shorthand for horn params with the house defaults (root at the top-back of the cranium, swept along the neck). */
export function hornParams(p: Partial<HornParams> & { len: number }): HornParams {
  return { r0: 1.5, r1: 1, at: 145, sink: 1, sweep: 18, bend: 0, kinkAt: 0, ...p };
}
