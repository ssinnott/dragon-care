// DragonAnimPlayer: the engine AnimPlayer's semantics (src/lib/art/animation.ts) over DragonPose.
//
// AnimPlayer / lerpPose are typed to the humanoid Pose, so the dragon gets this sibling (bible 4.1) that keeps the
// frame format unchanged -- { dur, pose, interp, ease, face, event, fx, sfx } at 60 Hz -- and the player contract:
// play / tick / progress / done / events / setStaticPose / speed, one fully populated pose reused every tick.
//
// Two things the humanoid player does not do, both runtime rather than keyed (bible 2.5, 4.1):
// - BLINKS. Open-eyed faces blink every 180-300 f (babies: 3/4/3 frames, 30 % double blinks). The schedule is a
//   seeded rng stepped once per tick, so replaying t ticks from play() lands on the same lid: frozen-time shots stay
//   deterministic.
// - DESYNC. A looping anim may start at a seeded phase and run at a seeded +-10 % speed, so a habitat never
//   breathes in lockstep. The owner passes `phase` / `speed` to play(); dragonBuild derives them from the pet seed.
//
// - VARIANTS. While a "home" loop plays (idle), every 6-10 s (seeded, so a frozen frame is reproducible) the player
//   cuts to one of the home's variants -- a look-around, a yawn, a scratch, the element's fidget -- with a blend, and
//   blends back to the home loop when it ends (setVariants; 4.2 "Variants every 6 to 10 s").
//
// And three small additions to the frame format's semantics, all opt-in:
// - `loopFrom`: a loop with an INTRO (sleep: the lie-down plays once, then the breathing loops). A desynced start
//   (phase > 0) lands inside the loop, so a pet that is already asleep is asleep, not lying down.
// - `move` per frame: root motion along facing, px/f, as the engine Frame's `move` (the walk's world speed; a
//   stance paw slides back at exactly it). The owner moves the pet by `player.move` each tick.
// - `blend` on play(): a cross-fade of N frames from the pose being shown, so idle -> walk or sleep -> wake never
//   pops. Stepped channels (face, act, cue...) switch at once.
import { ease } from '../../lib/art/poses.ts';
import type { EaseName } from '../../lib/art/poses.ts';
import type { FrameFx } from '../../lib/art/animation.ts';
import { makeRng } from '../../lib/engine/rng.ts';
import type { RngInstance } from '../../lib/engine/rng.ts';
import { DFACE, dfaceIndex, makeDragonPose, lerpDragonPose, copyDragonPose, blendDragonPose } from './pose.ts';
import type { DFaceRef, DragonPose, PartialDragonPose } from './pose.ts';

/** One frame. No index signature, like the engine's Frame: a misspelled key is a compile error. */
export interface DragonFrame {
  /** Frames at 60 Hz. */
  dur: number;
  pose?: PartialDragonPose | null;
  /** Lerp toward the next frame's pose over `dur` (default true; false holds). */
  interp?: boolean;
  /** Easing of that lerp (the engine's EASE names). */
  ease?: EaseName;
  /** Face override for this frame (stepped). */
  face?: DFaceRef;
  /** Raised into `events` on frame entry. */
  event?: string;
  /** Effect spawns raised into `events` on frame entry (the engine's FrameFx shape). */
  fx?: FrameFx[];
  sfx?: string;
  /** Root motion along facing, px per frame, while this frame plays (the walk's world speed). */
  move?: number;
}

/** One named animation. */
export interface DragonAnim {
  loop: boolean;
  frames: DragonFrame[];
  /**
   * A tail sway that runs on the player's own clock, ADDED to tail.sway: a sine of `amp` degrees over `period`
   * frames. It is how the idle tail sways "out of sync with the breath" (4.2: 150 f against a 120 f breath)
   * without authoring a 600 f loop. Deterministic: the clock is the tick count.
   */
  tailSway?: { period: number; amp: number };
  /** A loop with an intro: the frame index the loop returns to (frames before it play once). */
  loopFrom?: number;
  /** For a one-shot: what the owner plays when it ends (default 'idle'; the gallery follows it). */
  next?: string;
}
export type DragonAnimSet = Record<string, DragonAnim>;

/** One entry of `events`, as the engine's AnimEvent. */
export interface DragonAnimEvent {
  type: 'event' | 'sfx' | 'fx';
  name: string;
  value: string | FrameFx;
  frameIndex: number;
}

/** Options for play(). */
export interface DragonPlayOpts {
  restart?: boolean;
  /** Played instead when `name` is missing (default 'idle'). */
  fallback?: string;
  /** Steps advanced per tick (desync: 1 / (1 +- 0.1)). */
  speed?: number;
  /** 0..1 start phase for a LOOP (desync), within its loop part. One-shots always start at frame 0. */
  phase?: number;
  /** Cross-fade frames from the pose on screen into the new anim (0 = cut, the engine's behaviour). */
  blend?: number;
}

/** Blink timing per stage (bible 2.5 / 4.2). */
export interface BlinkTiming {
  /** Half-lid frames before and after the closed hold. */
  half: number;
  /** Closed frames. */
  closed: number;
  /** Interval range in frames. */
  min: number;
  max: number;
  /** Chance a blink is a double blink. */
  double: number;
}
export const ADULT_BLINK: Readonly<BlinkTiming> = Object.freeze({ half: 2, closed: 4, min: 180, max: 300, double: 0 });
export const BABY_BLINK: Readonly<BlinkTiming> = Object.freeze({ half: 3, closed: 4, min: 180, max: 300, double: 0.3 });
/** The elder's slower blink (2.5): 3 half-lid, 5 closed, 3 half-lid frames, every 200 to 340 f. */
export const ELDER_BLINK: Readonly<BlinkTiming> = Object.freeze({ half: 3, closed: 5, min: 200, max: 340, double: 0 });
/** The blink timing of a stage: the baby's (with its double blinks), the elder's slower one, or the young / adult's. */
export function blinkFor(stage: 'baby' | 'young' | 'adult' | 'elder'): Readonly<BlinkTiming> {
  return stage === 'baby' ? BABY_BLINK : stage === 'elder' ? ELDER_BLINK : ADULT_BLINK;
}

/** Faces with open eyes: only these blink. Happy, closed, surprised, scared and dazed never do. */
const BLINKS: Readonly<Record<number, true | undefined>> = Object.freeze({
  [DFACE.neutral]: true, [DFACE.hungry]: true, [DFACE.sad]: true, [DFACE.grumpy]: true, [DFACE.sheepish]: true,
});

const EMPTY: DragonFrame = Object.freeze({ dur: 1, pose: null });

export class DragonAnimPlayer {
  anims: DragonAnimSet;
  name: string | null = null;
  def: DragonAnim | null = null;
  frameIndex = 0;
  frameTime = 0;
  time = 0;
  done = false;
  speed = 1;
  newFrame = false;
  instance = 0;
  events: DragonAnimEvent[] = [];
  /** The resolved pose, rewritten every tick. Never keep references across frames. */
  pose: DragonPose = makeDragonPose();
  /** Runtime blinks on/off (off for contact sheets that want the authored face only). */
  blink = true;
  /** Ticks since construction: the blink clock. */
  clock = 0;
  private blinkT: Readonly<BlinkTiming>;
  private blinkRng: RngInstance;
  private nextBlink: number;
  private blinkAt = -1e9;
  private blinkTwice = false;
  private staticPose: PartialDragonPose | null = null;
  /** The idle-variant schedule (setVariants): the home loop, its variants, the interval range, the next cut. */
  private home: string | null = null;
  private variants: readonly string[] = [];
  private varMin = 360;
  private varMax = 600;
  private nextVariant = Infinity;
  private varRng: RngInstance;
  /** The pose a blend starts from, and the blend's length / frames left. */
  private blendFrom: DragonPose = makeDragonPose();
  private blendLen = 0;
  private blendLeft = 0;

  /**
   * @param anims the table (anims.ts `dragonAnims(stage)`)
   * @param seed per-pet seed: picks the blink schedule
   * @param blink blink timing for the stage
   */
  constructor(anims: DragonAnimSet = {}, seed = 1, blink: Readonly<BlinkTiming> = ADULT_BLINK) {
    this.anims = anims;
    this.blinkT = blink;
    this.blinkRng = makeRng(seed * 7919 + 17);
    this.varRng = makeRng(seed * 104729 + 31);
    this.nextBlink = 30 + Math.floor(this.blinkRng.next() * (blink.min - 30));
  }

  get frame(): DragonFrame { return this.def ? this.def.frames[this.frameIndex] || EMPTY : EMPTY; }
  /** Total frames (steps) in the current animation. */
  get length(): number { if (!this.def) return 0; let n = 0; for (const f of this.def.frames) n += f.dur || 1; return n; }
  has(name: string): boolean { const a = this.anims[name]; return !!(a && a.frames && a.frames.length); }
  /** Progress through the current animation in [0,1]. */
  get progress(): number { const L = this.length; return L ? Math.min(1, this.time / L) : 1; }

  /** Root motion of the current frame, px along facing (0 when the frame has none). */
  get move(): number { return this.done ? 0 : this.frame.move || 0; }

  /** Play an animation; restarting the one already playing needs restart: true. */
  play(name: string, { restart = false, fallback = 'idle', speed = 1, phase = 0, blend = 0 }: DragonPlayOpts = {}): boolean {
    let n: string | null = name;
    if (!this.has(n)) n = this.has(fallback) ? fallback : null;
    if (n === null) { this.name = null; this.def = null; this.done = true; return false; }
    if (n === this.name && !restart) return true;
    if (blend > 0) { copyDragonPose(this.pose as unknown as PartialDragonPose, this.blendFrom, true); this.blendLen = this.blendLeft = blend; }
    else this.blendLeft = 0;
    this.name = n;
    this.def = this.anims[n];
    this.staticPose = null;
    this.frameIndex = 0; this.frameTime = 0; this.time = 0; this.done = false;
    this.speed = speed; this.instance++; this.newFrame = true;
    if (this.def.loop && phase > 0) {
      // Seek without raising the skipped frames' events: a desynced loop starts mid-breath, not with a burst. A loop
      // with an intro starts inside its loop part (a pet already asleep is asleep, not lying down).
      const from = this.def.loopFrom || 0, frames = this.def.frames;
      let loopLen = 0;
      for (let i = from; i < frames.length; i++) loopLen += frames[i].dur || 1;
      let skip = (phase % 1) * loopLen;
      this.frameIndex = from;
      while (skip >= (this.frame.dur || 1)) { skip -= this.frame.dur || 1; this.frameIndex = this.frameIndex + 1 < frames.length ? this.frameIndex + 1 : from; }
      this.frameTime = skip;
    } else this.emitFrameEvents();
    this.updatePose();
    return true;
  }

  /**
   * Schedule idle variants: while `home` (a loop) plays, every `min`-`max` frames (seeded) cut to one of `names`
   * (one-shots in the table; a name may repeat to weight it) with an 8 f blend, and blend back to `home` when it ends.
   * Names missing from the table are skipped. An empty list switches the schedule off.
   */
  setVariants(home: string, names: readonly string[], min = 360, max = 600): void {
    this.home = home; this.variants = names.filter((n) => this.has(n)); this.varMin = min; this.varMax = Math.max(min, max);
    this.nextVariant = this.variants.length ? this.clock + this.varMin + Math.floor(this.varRng.next() * (this.varMax - this.varMin + 1)) : Infinity;
  }

  /** Is the current anim one of the home loop's variants (it returns to the home loop when it ends)? */
  get inVariant(): boolean { return !!this.name && this.name !== this.home && this.variants.includes(this.name); }

  /** Advance one fixed step (60 Hz). */
  tick(): void {
    this.newFrame = false;
    this.clock++;
    if (this.home && this.def) {
      if (this.name === this.home && this.clock >= this.nextVariant) {
        this.play(this.variants[Math.floor(this.varRng.next() * this.variants.length)], { restart: true, blend: 8 });
      } else if (this.done && this.inVariant) {
        this.play(this.home, { restart: true, blend: 10 });
        this.nextVariant = this.clock + this.varMin + Math.floor(this.varRng.next() * (this.varMax - this.varMin + 1));
      }
    }
    if (this.blendLeft > 0) this.blendLeft--;
    this.stepBlink();
    if (!this.def) { if (this.staticPose) { copyDragonPose(this.staticPose, this.pose, true); this.applyBlink(); } return; }
    const frames = this.def.frames;
    if (this.done) { this.updatePose(); return; }
    this.time += this.speed;
    this.frameTime += this.speed;
    let guard = 0;
    while (this.frameTime >= (frames[this.frameIndex].dur || 1) && guard++ < 64) {
      this.frameTime -= frames[this.frameIndex].dur || 1;
      if (this.frameIndex + 1 < frames.length) { this.frameIndex++; this.newFrame = true; this.emitFrameEvents(); }
      else if (this.def.loop) { this.frameIndex = this.def.loopFrom || 0; this.newFrame = true; this.emitFrameEvents(); }
      else { this.done = true; this.frameTime = (frames[this.frameIndex].dur || 1) - 0.0001; break; }
    }
    this.updatePose();
  }

  /** Hold a static (partial) pose with no table entry. Blinks still run on it. */
  setStaticPose(pose: PartialDragonPose | null | undefined): void {
    this.name = null; this.def = null; this.done = true;
    this.staticPose = pose || null;
    copyDragonPose(pose, this.pose, true);
    this.applyBlink();
  }

  private emitFrameEvents(): void {
    const f = this.frame;
    if (f.sfx) this.events.push({ type: 'sfx', name: f.sfx, value: f.sfx, frameIndex: this.frameIndex });
    if (f.fx) for (const fx of f.fx) this.events.push({ type: 'fx', name: fx.kind, value: fx, frameIndex: this.frameIndex });
    if (f.event) this.events.push({ type: 'event', name: f.event, value: f.event, frameIndex: this.frameIndex });
  }

  private updatePose(): void {
    const frames = this.def!.frames, f = frames[this.frameIndex];
    const interp = f.interp !== false && !this.done;
    let next = f;
    if (interp) next = this.frameIndex + 1 < frames.length ? frames[this.frameIndex + 1] : (this.def!.loop ? frames[this.def!.loopFrom || 0] : f);
    let t = interp ? Math.min(1, this.frameTime / (f.dur || 1)) : 0;
    if (f.ease) t = ease(f.ease, t);
    lerpDragonPose(f.pose, next.pose, t, this.pose);
    if (f.face != null) this.pose.face = dfaceIndex(f.face);
    const sw = this.def!.tailSway;
    if (sw) this.pose.tail.sway += sw.amp * Math.sin(this.clock * 2 * Math.PI / sw.period);
    if (this.blendLeft > 0) {
      // smoothstep, so the fade neither starts nor lands with a jolt
      const u = 1 - this.blendLeft / this.blendLen;
      blendDragonPose(this.blendFrom, this.pose, u * u * (3 - 2 * u));
    }
    this.applyBlink();
  }

  private stepBlink(): void {
    if (this.clock < this.nextBlink) return;
    const b = this.blinkT, r = this.blinkRng;
    this.blinkAt = this.clock;
    this.blinkTwice = r.next() < b.double;
    this.nextBlink = this.clock + b.min + Math.floor(r.next() * (b.max - b.min + 1));
  }

  /** Current blink lid: 0 open, 1 half (the sleepy lid), 2 closed. */
  get lid(): number {
    if (!this.blink) return 0;
    const b = this.blinkT, one = b.half * 2 + b.closed;
    let k = this.clock - this.blinkAt;
    if (this.blinkTwice && k >= one + 4) k -= one + 4;
    if (k < 0 || k >= one) return 0;
    return k < b.half || k >= b.half + b.closed ? 1 : 2;
  }

  /**
   * The blink goes on pose.blink, not pose.face: overriding the face with `sleepy` for the half-lid frames drew the
   * sleepy brow bar too, so every blink flashed a brow over a neutral eye (the rig reads blink for the eye only).
   */
  private applyBlink(): void {
    const p = this.pose;
    p.blink = p.sleep >= 0.5 || !BLINKS[p.face] ? 0 : this.lid;
  }
}
