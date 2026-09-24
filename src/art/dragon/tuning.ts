// Anim tuning: the GENERIC knobs of the shared animation set (docs/ART_BIBLE.md 4.2 per stage, 4.3 per element).
//
// The shared anims (anims.ts) are authored once, from the adult key beats and the 4.1 stage timing rules. What
// the elements change about them in 4.3 is mostly a number -- rock's 60 f walk cycle, spike's shy 0.35 px/f creep
// with its head down 8 deg, fire's 5 px strut, water's slink, rock's 240 f sleep breath under its dome -- so an
// element file sets those numbers here (ElementSpec.anims.tuning) instead of re-authoring the anim. What is only
// its own (the embers of fire's happy flourish, rock's roll onto its back, spike's stop-and-look) is either drawn
// by its renderers from pose.act / pose.cue, or a whole-anim override (ElementSpec.anims.overrides).
//
// Pure data: the rig reads the sleep numbers (the "z" schedule) and anims.ts the rest, so this module imports
// nothing at runtime.
import type { Stage } from './stages.ts';
import type { ElementSpec } from './element.ts';
import type { DFaceName } from './pose.ts';

/** The walk (4.2, 4.3 "Walk"): a lateral-sequence gait NH -> NF -> FH -> FF, stance 60 % / swing 40 %. */
export interface WalkTuning {
  /** Cycle length, frames (8 keys): adult 48, young 40, baby 24; rock's adult 60, lightning 20 % faster. */
  cycle: number;
  /**
   * World speed along facing, px/f: adult 0.45, young 0.5, baby 0.3; spike creeps at 0.35. The stance stroke is
   * solved from it (stride = speed x stance frames), so a paw on the floor moves back at exactly this speed and
   * never skates when the owner moves the pet by the frames' `move`.
   */
  speed: number;
  /** Paw lift at passing, px: adult 3, young 2, baby 1.5; fire's strut 5. */
  lift: number;
  /** Head pitch held through the walk, deg (+ = snout down): fire's strut -4 (head up), spike's creep +8. */
  head: number;
  /** Body pitch sway per cycle, +-deg: water's slink 2. */
  sway: number;
  /** Neck and tail S-wave, frames it trails the legs (water 8); 0 = none. */
  wave: number;
}

/** Sleep (4.2 lie-down -> loop -> wake, 4.3 "Sleep pose"). */
export interface SleepTuning {
  /** Lie-down frames: adult 40, young 34, baby 24. */
  lieDown: number;
  /** One sleeping breath (the loop), frames: adult 180, young 150, baby 120; rock 240. */
  breath: number;
  /** Frames between "z" glyphs (the rig's top pass): adult 120, young 100, baby 90. */
  z: number;
  /**
   * The tuck branch of bible 1.4 while asleep: 0 = the head drawn last (young, adult; rock's sleep tuck too, whose
   * head rests OUTSIDE the rim), 2 = the baby sleep bun (the head group before the wing nubs). 1 (the head under
   * the dome) is rock's UPSET tuck, never sleep (4.3).
   */
  tuck: number;
  /**
   * Body pitch asleep, deg (+ = chest down): spike's quill ball +10 (at +30 its chest and elbows went through the
   * floor and it read as a butt-up crouch). The settle accounts for it, so a pitched body still rests on the floor.
   */
  bodyRot: number;
  /**
   * Tail curl added per segment, deg (+ droops: the tail wraps forward round the body). The baby bun wraps its tail
   * under its body by default (lift 70, curl 40: sticking straight back it made a loaf); fire, water and spike,
   * whose cue is on or over the tail, override it so the cue stays in the asleep silhouette (5.1 #1).
   */
  tailCurl: number;
  /**
   * Tail lift at the root, deg (+ droops toward the floor). Fire keeps its up-curl asleep (-4, curl 0) so the banked
   * flame still stands above the tail tip: the cue must name the element asleep too (5.1 #1).
   */
  tailLift: number;
  /**
   * Young / adult: how high the sleeping chin rests, px above the floor: 1.5 on the floor; shriekscale rests its head
   * on its paws (paw height + 1.5) so its laid-back fans stand clear above the back and wing line (5.1 #1).
   */
  chin: number;
  /**
   * Where the forepaws rest asleep, px slid along the floor from their standing spot (+ forward): young and adult -2,
   * drawn a little back under the settled chest (the sphinx fold), the baby's bun 1.5, under its chin; shriekscale's
   * young and adult 10, forward under its raised head, so the head held up at `chin` rests over its paws instead of
   * floating in front of the chest. The wake's play-bow starts from it.
   */
  frontTuck: number;
  /**
   * Baby only: the wing channel of the sleep bun, past 1 so the nubs rise on beyond their 140 deg flutter angle and
   * lie over the back of the bowed head like a blanket (3.3 = 71 deg, 30 deg per unit; the tuck branch draws them
   * over the head, 1.4).
   */
  nubFold: number;
}

/** The signature breath (4.2): wind-up, snap, sustain, recover; the baby always fizzles. */
export interface BreathTuning {
  /** Jaw at the snap, deg: adult 30, young 22, baby 20; rock's gravel roar 25, shriekscale's shriek 40. */
  jaw: number;
  /** The face after a baby's fizzle: dazed (fire, lightning, spike), happy (rock's proud "ptoo", water's pop). */
  fizzleFace: DFaceName;
  /** Head pitch on that face, deg (+ = snout down): rock's chin raised 6 = -6. */
  fizzleChin: number;
  /**
   * Baby: the squash held from the wind-up through the fizzle (1 = the plain chest puff): spike bristles into a
   * puffball, 1.15 wide (3.3).
   */
  puff: number;
  /**
   * Baby: frames of the fan-flop gag after the fizzle (ledger E8: shriekscale's fans flop over its eyes for 24 f,
   * then pop back up with a blink), 0 = none. The anim lifts the rig's eye clip for exactly those frames
   * (pose.eyeClip 0) and the element's fans draw the flop while it is off.
   */
  flop: number;
  /** The pupil contracts through the wind-up (pose.pupil 1 until the snap): lightning's Spark Bolt (3.5). */
  pupil: boolean;
}

/** Eat (4.2). */
export interface EatTuning {
  /**
   * Baby: the tail's droop through the bite, deg (+ droops toward the floor), cancelling most of the body's 24 deg
   * bow: riding the pitch, every baby tail rose about 10 px over its back line (spike's, lightning's, water's paddle
   * a stick with a knob on top, shriekscale's), into fire's zone above the tail tip (3.0). Fire 0: its comma
   * carries the flame, which is its own zone.
   */
  tailDroop: number;
}

/** Beg (4.2, 4.3 "Hungry tell"). */
export interface BegTuning {
  /** Mood the cue shows while begging (4.2: -0.5; spike's quills droop to 39 deg there). */
  mood: number;
  /** Head tilt up, deg (babies tilt further). */
  tilt: number;
}

/** Everything the shared set lets an element tune. */
export interface AnimTuning {
  walk: WalkTuning;
  sleep: SleepTuning;
  breath: BreathTuning;
  eat: EatTuning;
  beg: BegTuning;
}

/** What an element's tuning hook returns: any subset, per group. */
export type AnimTuningPatch = { [K in keyof AnimTuning]?: Partial<AnimTuning[K]> };

const BASE: Readonly<Record<Stage, AnimTuning>> = {
  baby: {
    walk: { cycle: 24, speed: 0.3, lift: 1.5, head: 0, sway: 0, wave: 0 },
    sleep: { lieDown: 24, breath: 120, z: 90, tuck: 2, bodyRot: 0, tailCurl: 40, tailLift: 70, nubFold: 3.3, chin: 1.5, frontTuck: 1.5 },
    breath: { jaw: 20, fizzleFace: 'dazed', fizzleChin: 0, puff: 1, flop: 0, pupil: false },
    eat: { tailDroop: 22 },
    beg: { mood: -0.5, tilt: 14 },
  },
  young: {
    walk: { cycle: 40, speed: 0.5, lift: 2, head: 0, sway: 0, wave: 0 },
    sleep: { lieDown: 34, breath: 150, z: 100, tuck: 0, bodyRot: 0, tailCurl: 18, tailLift: 8, nubFold: 0, chin: 1.5, frontTuck: -2 },
    breath: { jaw: 22, fizzleFace: 'dazed', fizzleChin: 0, puff: 1, flop: 0, pupil: false },
    eat: { tailDroop: 0 },
    beg: { mood: -0.5, tilt: 12 },
  },
  adult: {
    walk: { cycle: 48, speed: 0.45, lift: 3, head: 0, sway: 0, wave: 0 },
    sleep: { lieDown: 40, breath: 180, z: 120, tuck: 0, bodyRot: 0, tailCurl: 18, tailLift: 8, nubFold: 0, chin: 1.5, frontTuck: -2 },
    breath: { jaw: 30, fizzleFace: 'dazed', fizzleChin: 0, puff: 1, flop: 0, pupil: false },
    eat: { tailDroop: 0 },
    beg: { mood: -0.5, tilt: 12 },
  },
};

/** The stage's defaults with the element's patch merged over them. Allocates: once per rig / anim table. */
export function animTuning(stage: Stage, spec?: ElementSpec | null): AnimTuning {
  const b = BASE[stage];
  const p = spec && spec.anims && spec.anims.tuning ? spec.anims.tuning(stage) : null;
  return {
    walk: { ...b.walk, ...(p && p.walk) },
    sleep: { ...b.sleep, ...(p && p.sleep) },
    breath: { ...b.breath, ...(p && p.breath) },
    eat: { ...b.eat, ...(p && p.eat) },
    beg: { ...b.beg, ...(p && p.beg) },
  };
}
