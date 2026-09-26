// KeeperPlayer: the engine's AnimPlayer (src/lib/art/animation.ts) for a keeper, with the two things the dragons'
// player adds to it that a person needs too (bible 4.1, docs/KEEPERS.md 5):
//   - a CROSS-FADE on play(): N frames from the pose on screen into the new anim, so walk -> kneel -> pet never pops.
//     Stepped channels (the face, weaponBack) switch at once, as the dragons' do.
//   - runtime BLINKS: every 180 to 300 f (seeded, so a frozen frame is reproducible) the open-eyed faces shut for 5 f.
//     The blink goes on the rig (KeeperRig.blink), not on pose.face, so an expression's brows and mouth are kept.
// Frames are the engine's own (dur, pose, ease, face, move, event); `move` is a number, px per frame along facing.
import { AnimPlayer } from '../../lib/art/animation.ts';
import type { AnimEvent, AnimSet } from '../../lib/art/animation.ts';
import { makePose, lerpPose, copyPose } from '../../lib/art/poses.ts';
import type { Pose } from '../../lib/art/poses.ts';
import { markFull } from '../../lib/art/rig.ts';
import type { FullPose } from '../../lib/art/rig.ts';
import { makeRng } from '../../lib/engine/rng.ts';
import type { RngInstance } from '../../lib/engine/rng.ts';

/** Options for play(). */
export interface KeeperPlayOpts {
  restart?: boolean;
  /** Cross-fade frames from the pose on screen (0 = cut). */
  blend?: number;
  /** Steps per tick (1 = authored speed). */
  speed?: number;
}

/** A blink's length and the interval range between blinks, frames. */
const BLINK_LEN = 5, BLINK_MIN = 180, BLINK_MAX = 300;

export class KeeperPlayer {
  readonly anims: AnimSet;
  /** The resolved pose, rewritten every tick; never keep a reference across frames. */
  readonly pose: FullPose = markFull(makePose());
  /** Ticks since construction: the blink clock. */
  clock = 0;
  /** Runtime blinks on (off for contact sheets that want the authored face only). */
  blinks = true;
  private inner: AnimPlayer;
  private from: Pose = makePose();
  private blendLen = 0;
  private blendLeft = 0;
  private rng: RngInstance;
  private nextBlink: number;
  private blinkAt = -1e9;

  constructor(anims: AnimSet, seed = 1) {
    this.anims = anims;
    this.inner = new AnimPlayer(anims);
    this.rng = makeRng(seed * 6007 + 11);
    this.nextBlink = 40 + Math.floor(this.rng.next() * BLINK_MIN);
  }

  get name(): string | null { return this.inner.name; }
  get done(): boolean { return this.inner.done; }
  /** Frames in the current anim. */
  get length(): number { return this.inner.length; }
  /** Frames into the current anim. */
  get time(): number { return this.inner.time; }
  /** Root motion of the current frame, px along facing (0 once a one-shot is done). */
  get move(): number { const m = this.inner.move; return this.inner.done ? 0 : typeof m === 'number' ? m : m && m.x ? m.x : 0; }
  /** Events raised on frame entry since the owner last cleared them (`events.length = 0`). */
  get events(): AnimEvent[] { return this.inner.events; }
  has(name: string): boolean { return this.inner.has(name); }

  /** Play an anim; restarting the one already playing needs restart: true. */
  play(name: string, { restart = false, blend = 0, speed = 1 }: KeeperPlayOpts = {}): boolean {
    if (name === this.inner.name && !restart) return true;
    if (blend > 0) { copyPose(this.pose, this.from, true); this.blendLen = this.blendLeft = blend; }
    else this.blendLeft = 0;
    const ok = this.inner.play(name, { restart: true, fallback: 'idle', speed });
    this.resolve();
    return ok;
  }

  /**
   * Play on at `s` steps per tick without restarting (a walk kept in step with the pace its owner moves the keeper at:
   * a walk's `move` is its world speed at 1).
   */
  setSpeed(s: number): void { this.inner.speed = s; }

  /** Advance one fixed step (60 Hz). */
  tick(): void {
    this.clock++;
    this.inner.tick();
    if (this.blendLeft > 0) this.blendLeft--;
    if (this.clock >= this.nextBlink) { this.blinkAt = this.clock; this.nextBlink = this.clock + BLINK_MIN + Math.floor(this.rng.next() * (BLINK_MAX - BLINK_MIN + 1)); }
    this.resolve();
  }

  /** 1 while a blink holds the eyes shut, else 0 (the rig's face reads it: KeeperRig.blink). */
  get lid(): number { const k = this.clock - this.blinkAt; return this.blinks && k >= 0 && k < BLINK_LEN ? 1 : 0; }

  private resolve(): void {
    const src = this.inner.pose;
    if (this.blendLeft > 0) {
      const u = 1 - this.blendLeft / this.blendLen;
      lerpPose(this.from, src, u * u * (3 - 2 * u), this.pose);
      // (the engine's lerp holds a stepped key at its FIRST pose; a new anim's face and hold show at once)
      this.pose.face = src.face; this.pose.weaponBack = src.weaponBack;
    } else copyPose(src, this.pose, true);
  }
}
