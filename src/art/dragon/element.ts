// THE SEAM between the shared dragon rig and the seven elements.
//
// One parameterised quadruped rig draws all 28 looks, 7 elements x 4 stages (ART_GENERATOR lesson 49: a renderer fix
// reaches the whole cast). What differs per element arrives through ONE object, an ElementSpec, which each element file
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
//
// THE ELDER (v2: bible 2.1, 2.5, 2.9, 3.9, 4.1, 4.2; D21 to D23). The fourth and final stage, permanent. What the
// shared rig already does for every element, and what the seam hands an element artist for the elder's own cue:
//   - `Stage` has 'elder'; stages.ts `grown(stage)` is true for the adult and the elder (the adult's eye, wing bones,
//     claws, thorns, fangs and adult-only extras). Branch on it rather than on stage === 'adult', or an elder falls
//     through to the baby's branch of a three-way ternary.
//   - COLOUR: every stage draws through palettes.ts agedPalette (3.9), so info.pal / info.near / rig.pal ARE the
//     greyed colours, and tones(rig, hex) of them are seeded from dragonTones (the silvered highlight band included).
//     Colour a renderer only from those, never from DRAGON_PALETTES at runtime (a module-level base hex would draw an
//     elder in its hatchling's colours); rig.moodT holds the stage's mood tones (the banked glow, water's dim spot)
//     and rig.greys the elder face greys (muzzle, beard: 2.5) and slinkwing's fan frost (fanFrostOf), ready-made.
//   - POSTURE and FACE are shared (rig.ts, parts.ts, faces.ts): the settled chest, the paunch, the level head, the grey
//     muzzle and brow tuft, the inked beard (with the floor guard), the worn fangs, the elder blink. An element's own
//     elder posture numbers go in its `elder` ElementStageParams: `neckAngle` (rock's -33, water's +2), `neckLen`
//     (water's 0.92), `tailLen` (slinkwing's adult length), `jawMax` (slinkwing's 36), `brow` (rock's 4), `bellyFrac`
//     (rock's adult 38 %). The beard's depth is fitted to each head by the rig (parts.ts fitBeard).
//   - WING WEAR: WingParams.tears / .hole on the elder stage (2.9's table), drawn by the shared bat / leaf / fin wing
//     (parts.ts drawBatWing) and the rig's whole-pixel hole stamp. A 'custom' wing (lightning's bolt) draws its own
//     tear from the same data with parts.ts pathTearEdge and wearOf.
//   - ANIMS: the shared set has an elder column (anims.ts: x 1.25 tempo, the soft ease, no key holds, the 10 f head
//     lag), the elder's idle variants (the back stretch, reminisce and AIRING THE WINGS, act = ACT.airing, the one
//     spread at idle: lightning flexes its bolts instead) and its breath (never fails; cue 0 = the snap at f 28, the
//     stream to cue 32 with fx 1, then the finale ring's window, cue 32 to 44, fx 0: the element draws its ring).
//     STAGE_TIMING.elder.dur scales an element's own anims.
//   - The element's ELDER CUE and ELDER-ONLY EXTRA (section 3: the hearth and coal bed, sap-buds, the fourth crystal,
//     the third tooth, the pearls, the frosted fans, the resident moth) are the element's renderers' work; each file
//     marks the spots where its elder still draws as its adult with "FIRST PASS (elder):".
import type { DragonElement, DragonPalette } from './palettes.ts';
import type { ElementModifiers, Stage, TailRest } from './stages.ts';
import type { DragonPose } from './pose.ts';
import type { DragonRig } from './rig.ts';
import type { DragonAnim } from './anim.ts';
import type { AnimTuningPatch } from './tuning.ts';
import type { DragonDims } from './build.ts';

// ---------- shared-feature parameters (drawn by features.ts / parts.ts) ----------

/**
 * Paired horns (fire, lightning) and brow thorns (spike), drawn by features.drawHorn. Cranium space. Quiet-zone
 * budget (3.0): <= 3 px thick, swept back within 20 deg of the neck line, <= 3 px above the skull top. The rig
 * measures the neck line every frame (the last neck segment, seen from the cranium), so `sweep` is authored
 * relative to it and holds at every stage, head pitch and pose; a baby's neck hides under its head, so its
 * reference is straight back instead.
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
  /**
   * Direction, degrees ABOVE the neck line (0 = lying along it, + lifts the tip away from the neck). Keep the whole
   * horn (sweep, plus half the bend) within +-20 (3.0). Babies: degrees above straight back.
   */
  sweep: number;
  /** Bend at the midpoint, degrees (+ = the tip curls up). */
  bend: number;
  /** 0..1 position of a sharp kink instead of a bend (lightning: 0.6); 0 = the bend is at the midpoint. */
  kinkAt: number;
  /**
   * Degrees the FAR horn forks further up than the near one (1.5). Omitted = the stage default: adult 28 (so
   * background shows between the tips of an 8 px pair), young 8 (a 3-5 px pair that close is culled by the
   * overlap test and reads as one horn). The far root also sits 2 px above the near one, across the horn's line.
   */
  farTilt?: number;
  /**
   * [up, down]: the most the horn may point above and below straight back IN THE WORLD, deg, whatever the neck line
   * does (features.ts hornRefClamped). Omitted = no clamp. Spike's brow thorn [20, 40], like water's fin-ear (3.0):
   * behind a head lowered asleep the neck line rises steeply, and the thorn lying along it stood upright behind the
   * eye as a white tusk or an ear.
   */
  worldClamp?: readonly [number, number];
}

/** Wing construction. `style` picks the renderer in parts.ts; 'custom' means ElementRenderers.wing replaces it. */
export type WingStyle = 'bat' | 'leaf' | 'fin' | 'custom';

/**
 * One ragged TEAR in an elder's trailing edge (2.9): a notch of the membrane polygon itself, so the wing's one stroke
 * inks it. `panel` counts the trailing-edge panels from the lead tip, 1-based (1 = lead tip -> the next tip; the arm
 * panel, trail tip -> body attach, is the spar count); `at` is the fraction along it from its leading tip. `depth`,
 * px into the membrane from the edge, is deeper than the wing's scallops by >= 2 px (fire's, slinkwing's and dusk's
 * 3 px scallops: 5; water's smooth fin 4, rock's 3); the mouth is 5 px, >= 3 px of background between its ink lines,
 * and one side is stepped 1 px halfway down so it reads torn, not as one more scallop. `bite`: a round bite instead,
 * 5 wide (spike's nibbled leaf, 3 deep).
 */
export interface WingTear { panel: number; at: number; depth: number; bite?: boolean }

/**
 * The elder's see-through HOLE (2.9): a whole-pixel 3 x 3 window with one corner notched (8 px of background) inside a
 * 4-neighbour 1 px ink ring, in the arm panel, at wing-space (x, y) of the FULL spread (it moves with the membrane:
 * fire and dusk (-9.5, -8.5), slinkwing (-9.5, -5), spike (-10.5, -6), water (-10.5, -7)). Drawn from `wing` >= `from`
 * (0.95 bat, 0.90 leaf and fin), stamped by the rig at the ROUNDED position in face space (rotated, a 2 px window
 * anti-aliased to 1 px and shimmered) and cut through the far wing too, so it shows the background. Never shrunk: a
 * frame where the window is not wholly on the membrane and above the back line + 1 px skips it.
 */
export interface WingHole { x: number; y: number; from: number }

export interface WingParams {
  style: WingStyle;
  /** Use the stage's "+1 spar" set (water, slinkwing: 3 young / 4 adult) instead of the standard 2 / 3. */
  plus: boolean;
  /** Trailing-edge cut between spar tips, px, x the fold channel (1.2). Negative = a convex bulge (leaf, fin). */
  scallop: number;
  /** Multiplier on every wing bone (rock's stubby 0.7). */
  span: number;
  /** Folded wrist knuckle rise above the back line, px (1.3: 3; spike and rock 0). Moves the folded wrist down by 3 - foldRise. */
  foldRise: number;
  /** Each spar pokes this far past the membrane as a thorn (spike adult 3); 0 = none. */
  thorn: number;
  /** Wrist thorn / thumb claw length (spike adult 4, slinkwing adult 3); 0 = none. */
  wristThorn: number;
  /** Baby nub rest angle override (spike 200: along the flank below the quills). */
  nubRest?: number;
  /** Wing root offset from the stage table's root, body space px (lightning's bolt sits 3 px back). */
  rootDx?: number;
  rootDy?: number;
  /**
   * Elder wing wear (2.9; the elder stage only, the same on every pet of an element: no seed reads "more worn"): the
   * trailing-edge tears, shown from `wing` 0.55 (parts.ts wearOf), and the full-spread hole. None on a baby, young or
   * adult; no hole on rock's stubby wing or lightning's bolt (no room: 2.9).
   */
  tears?: readonly WingTear[];
  hole?: WingHole;
}

export type MarkingKind = 'chevron' | 'ring' | 'zstripe' | 'spot';
/**
 * Where a marking sits. Every anchor is only a PREFERENCE, fitted once on the first draw (rig.ts fitMarkings),
 * since a hidden first marking breaks 2.7:
 *   - body anchors are body space, clipped to the body outside the belly region; the rig moves each to the nearest
 *     spot where all of it shows past the folded wing, the leg roots, the neck and a baby's head, a third of the
 *     body length from the others where the flank allows ('flank' sits on the lateral line, halfway down);
 *   - 'tail' is clipped to the tail tube; the rig slides it out along the tail from `t` to where all of it clears
 *     the hip and legs (a ring: 3/4 of its section) and sits >= 3 px from the tail marking before it, and may step
 *     a bitmap 1 px across the tail to centre it. Author `t` where you want it; the fit only ever moves it out.
 * A baby's flank is mostly head, nub and pot belly: put a first marking that must show at every stage on 'tail'
 * (the tail base) or low on the rear flank.
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
  /** Chevron only: no notch in its bottom row, a solid caret (fire's flame-licks: 5.2). */
  solid?: boolean;
  /** Nudge in body space (tail: along / across the tail), px. */
  dx?: number;
  dy?: number;
  /**
   * The seeded extra marking of 2.8 (build.ts adds it; element files never set it): drawn only where the rig's fit
   * shows all of it, since an optional mark may never become a hidden speck (5.2).
   */
  optional?: boolean;
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
  /**
   * Multiplier on this stage's tail length after the 2.3 modifier (2.6: a baby's tail is short and stiff): rock's
   * and lightning's babies 0.6. Omitted = 1.
   */
  tailLen?: number;
  /**
   * 0..1, a floor under pose.tail.stiff: how much of the tail chain's follow-through this look never takes (rock's
   * heavy tail 0.7: the chain's per-segment wobble bent its outline between segments into a wavy, limp flap).
   * Omitted = 0.
   */
  tailStiff?: number;
  /**
   * A box round the tail-tip feature in tail-tip space [x0, y0, x1, y1] (y down), ink and every mood's droop
   * included (water's fluke). The rig keeps all four corners on or above the floor whatever the tail's angle, lifting
   * the tail's end (1.1, 5.1 #14): a level tail's lowest point is a lobe tip, a drooping one's is the fluke's far
   * edge. Omit it for a feature that stands above the tip (fire's flame).
   */
  tipBox?: readonly [number, number, number, number];
  /** Paired horns, or null. */
  horns: HornParams | null;
  /** Markings, first marking first: the first is an invariant (2.7), the rest vary with the pet seed (2.8). */
  markings: readonly MarkingSpec[];
  wing: WingParams;
  dorsal: DorsalParams | null;
  /**
   * Extra circles in the skull's contour, cranium space (rock's nose-horn root, slinkwing's nose-leaf): bumps in
   * the one skull path, never new outlined objects (1.2).
   */
  skullBumps?: readonly { x: number; y: number; r: number }[];
  /** Brow-ridge bump in px, replacing the stage table's 0 / 1 / 2 / 3 (rock's heavier 0 / 2 / 3 / 4). */
  brow?: number;
  /**
   * Degrees replacing the 2.3 neck-angle modifier at this stage (ElementModifiers.neckAngle; rock's elder -33: half the
   * elder's lowering, so its head drops about 2 px and stays 6 px under the dome's top, 2.3). Omitted = the modifier.
   */
  neckAngle?: number;
  /** Multiplier on this stage's neck length after the 2.3 modifier (water's elder 0.92: the 1.10 length cap, 2.3). */
  neckLen?: number;
  /** The jaw's maximum opening, deg, replacing the stage table's and the modifier's (slinkwing's elder 36). */
  jawMax?: number;
  /**
   * The belly band's fraction of the chest depth, replacing the stage table's (38 %, babies 45 %, the elder's 42 %):
   * rock's elder keeps its adult's 38 %, since its pale cream band over the elder's paunch read as a nappy between
   * the legs (the elder core review).
   */
  bellyFrac?: number;
  /**
   * The pet's seeded length variant, -1 / 0 / +1 px (2.8), set by build.ts on every stage (the seed survives
   * stage-ups). Shared horns already carry it; element renderers add it to their OWN length features -- spike's
   * quills, slinkwing's fans -- never past a quiet-zone budget of 3.0.
   */
  lenVar?: number;
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
  /**
   * The eye's box in CRANIUM space at its largest (the hungry / surprised / scared ring, 1 px bigger each way):
   * centre (x, y) and outer size (w, h) including the ink ring. The head is drawn last so nothing covers the eye
   * (hard rule), and the rig CLIPS nearHead to exclude this box + 1 px on every side -- place head features clear
   * of it (rock's nose horn, a fin-ear) rather than relying on the clip.
   */
  eye: { x: number; y: number; w: number; h: number };
  /** The pet's bond, 0..1 (DrawDragonOpts.bond; omitted = 1): rock's crystal count grows with it (3.4). */
  bond: number;
  /**
   * 0..1, eased (DrawDragonOpts.wary; omitted = 0): how wary the pet is of the nearest OTHER dragon. Spike leans its
   * quills 15 deg toward upright, no size-up (4.3). The owner measures and eases it; a renderer only reads it.
   */
  wary: number;
  /**
   * 0..1 (DrawDragonOpts.charge; omitted = 0): lightning's static charge, built up by boredom and drained by play
   * (3.5): its crackle comes faster as it builds, down to every 40 f.
   */
  charge: number;
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
 *                  info.r = cranium radius. The eye centre is rig.dims.head.eye (x, y). A head pitched past
 *                  vertical LOOKS BACK (pose.ts DragonPose.head): cranium space is then also flipped in y
 *                  (rig.j.headFlip -1), so the skull's top stays up. rig.ts cranToRootPt and enterFaceFromCranium
 *                  honour it; a renderer that maps cranium points by hand (with rig.j.headAng) must multiply
 *                  cranium y by rig.j.headFlip, and its face-space x runs mirrored.
 *   tail-tip space: origin at the centre of the last tail node, rotated so +x is FORWARD along the last segment
 *                  (toward the body) and the tail continues toward -x; -y is the tail's top (dorsal) side. When the
 *                  tail is level this is root space's orientation. info.ang = its rotation (counter-rotate to stand
 *                  upright), info.r = tip radius.
 *   wing space   : origin at the wing root, rotated by body pitch and the flap; +x forward, y down. Bone angles are
 *                  elevations from +x (+ up), as in 2.2.
 *   mouth space  : origin in the mouth (rig.j.mouth: inside the snout tip while the jaw is shut; open, the middle of
 *                  the opening, halfway between the upper jaw line at the tip and the jaw's tip), rotated along the
 *                  snout but never more than 10 deg below level (rig.j.mouthAng); +x points OUT of the mouth. The
 *                  shared breath anim has the jaw open (>= its stage minimum) from cue 0, where streams start.
 */
export interface ElementRenderers {
  /**
   * Step 3: far head features (far horn, far ear-fan, far fin-ear). Cranium space, far palette. It may also draw a
   * NEAR-palette feature that must sit behind the neck and skull, only its contour-breaking part showing (water's
   * one fin-ear): colour it from info.near.
   */
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
  /** Step 12.4: face markings, clipped to the skull (slinkwing's mask). Cranium space. */
  headMarkings?: ElementDraw;
  /**
   * Step 12.6: near head features (horn-cues, ear-fans, fin-ears, rock's nose horn). Cranium space. Clipped to
   * exclude info.eye + 1 px: nothing drawn here can cover the eye. (The one sanctioned exception, baby slinkwing's
   * fan-flop gag of ledger E8, lifts the clip through the stepped pose.eyeClip for exactly those frames.) For a pixel
   * construction on the head (a rib, a mask) that must stay device-aligned, rig.ts enterFaceFromCranium +
   * cranToRootPt enter face space from here (from any other anchor space: enterFaceFromLocal + localToRootPt
   * with the anchor's origin and info.ang, as water's fluke rays do); features.ts pixelStroke draws 2 px
   * whole-pixel strokes there.
   */
  nearHead?: ElementDraw;
  /**
   * Step 13: the signature breath / trick effect. Mouth space. Called EVERY frame: draw only while
   * pose.act === ACT.breath. The shared breath anim (anims.ts) keys pose.cue = frames since the snap (the wind-up,
   * where the element's tell plays, is cue < 0) and pose.fx = the stream's envelope (0 wind-up, 1 sustain, back to
   * 0 in the recover). Age every particle from cue so a frozen frame is reproducible. A baby's breath always
   * fizzles (info.stage === 'baby'): draw the element's fizzle instead of the stream; the anim then plays the
   * fizzle face of tuning.breath. Emitted particles may leave mouth space: rig.j holds the root-space joints.
   */
  breath?: ElementDraw;
  /** Step 13: the idle ambient effect (embers, crackles, drips), through fx.ts caps; rising particles go to the top pass. Root space. */
  ambient?: ElementDraw;
}

/**
 * Animation hooks (bible 4.3), three levels deep, cheapest first:
 *   1. `tuning`: the generic numbers of the shared set (tuning.ts): rock's 60 f walk cycle, spike's creep speed and
 *      head-down, fire's 5 px strut, water's slink and S-wave, rock's dome tuck and 240 f sleep breath, the jaw of
 *      the breath snap, the face after a baby's fizzle. The shared anims are rebuilt from them.
 *   2. RENDERERS that read pose.act / pose.cue (pose.ts ACT): the shared anim says what is playing and hands over a
 *      clock, so a flourish needs no anim of its own -- the happy flourish at cue 0 (fire's 3 embers, water's
 *      bubbles, slinkwing's notes), the walk's cue for rock's dust at each hind contact, the hungry tell while
 *      act = beg, water's nostril bubble on each sleeping exhale, the breath tell while act = breath and cue < 0.
 *   3. `overrides`: a whole anim replaced (rock's 110 f roll-over happy, spike's stop-and-look walk). anims.ts
 *      exports its track authoring (bake, the stage timing, the shared builders) so an override is authored the
 *      same way, and can start from the shared builder with its own tuning.
 */
export interface ElementAnimHooks {
  /** Per-stage tuning of the shared set's generic knobs (tuning.ts). */
  tuning?: (stage: Stage) => AnimTuningPatch;
  /**
   * Per-stage anim overrides by name (rock's 110 f roll-over 'happy'...), merged over the shared table. `dims` (the
   * build's solved dimensions; null in dims-less tools) sizes them: settles, reaches, heights.
   */
  overrides?: (stage: Stage, dims: DragonDims | null) => Partial<Record<string, DragonAnim>>;
  /**
   * The idle fidget (section 3: fire chases its flame, rock sunbathes...): a one-shot joined to the table as
   * 'fidget', which the player's idle-variant schedule plays among the shared variants every 6-10 s and then blends
   * back to idle (anim.ts setVariants, anims.ts idleVariants). Key act = ACT.fidget and cue = its clock, so the
   * element's renderers can add the flourish (water's droplets). `dims` sizes it (anims.ts neckFit, the leg lengths).
   */
  fidget?: (stage: Stage, dims: DragonDims | null) => DragonAnim | null;
}

/** Everything one element is. elements/<id>.ts exports exactly one of these. */
export interface ElementSpec {
  id: DragonElement;
  /** The bible nickname: 'Ember', 'Bramble', 'Cobble', 'Zap', 'Ripple', 'Echo', 'Wick'. */
  name: string;
  /** One line of identity, for tooltips and the care panel. */
  blurb: string;
  /**
   * The element's BASE palette (palettes.ts DRAGON_PALETTES[id]: the hatchling's colours). Never per stage: the build
   * draws each stage through agedPalette(id, stage), the derived greying of 3.9, which renderers receive as info.pal.
   */
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
   * or -> the dim spot (mood <= -0.3), pulse with the sleeping breath and dim on the hungry beg (3.6, gate h).
   * Gets the pose and the rig of the frame being drawn. Omitted = `palette.marking`. Must return a stable string
   * (a palette slot or a module constant), never a freshly built one.
   */
  markingTone?: (info: DragonInfo, pose: DragonPose, rig: DragonRig) => string;
  /**
   * The engine's offscreen TINT over the whole dragon this frame, as an alpha in `glow` (0 = none); 1 is the opaque
   * flash, the silhouette flat in `glow.hi`: lightning's Spark Bolt flash on the snap (3.5; a partial yellow over its
   * blue came out grey). An element renderer cannot composite over its own silhouette (the
   * breath and ambient anchors draw on the scene canvas, where a source-atop would tint the floor), so the rig runs
   * the offscreen pass for it, as it does for DrawDragonOpts.tint.
   */
  tint?: (pose: DragonPose, info: DragonInfo) => number;
  /** Lightning: the tail's secondary motion is stepped, snapping on holds of this many frames (4.1). 0 = smooth. */
  tailHold?: number;
  anims?: ElementAnimHooks;
}

/** A shorthand for the common wing params (a folded bat wing with the standard spar count). */
export function wingParams(p: Partial<WingParams> & { style: WingStyle }): WingParams {
  return { plus: false, scallop: 0, span: 1, foldRise: 3, thorn: 0, wristThorn: 0, ...p };
}

/** A shorthand for horn params with the house defaults (root at the top-back of the cranium, along the neck line). */
export function hornParams(p: Partial<HornParams> & { len: number }): HornParams {
  return { r0: 1.5, r1: 1, at: 145, sink: 1, sweep: 0, bend: 0, kinkAt: 0, ...p };
}
