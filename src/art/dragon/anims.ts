// The dragon animation table per stage (docs/ART_BIBLE.md 4.2), authored once from the adult key beats with the
// 4.1 stage timing rules, then merged with the element's own overrides (ElementSpec.anims).
//
// This phase ships the IDLE loop per stage (the gallery breathes) plus a static 'rest'. The remaining core set --
// walk, happy, eat, sleep (with the tuck branch: pose.tuck / pose.sleep), breath (pose.fx), pet, beg -- is keyed
// on the same channels and needs no structural change to the pose or the rig.
//
// Blinks are NOT keyed: DragonAnimPlayer runs them at runtime (2.5).
import { DP } from './pose.ts';
import type { DragonAnim, DragonAnimSet, DragonFrame } from './anim.ts';
import type { Stage } from './stages.ts';
import type { ElementSpec } from './element.ts';

const F = (dur: number, pose: ReturnType<typeof DP> | null, extra: Partial<DragonFrame> = {}): DragonFrame => ({ dur, pose, ...extra });

/**
 * ADULT idle, 120 f: inhale 0-56 (inout) -- body up 1 px, squash 1.03, the folded wing's knuckle up 1 px, neck
 * a0 -2 -- then exhale 56-120. The head follows the body 8 f late (its keys sit 8 f behind the body's). The tail
 * sways +-5 deg over 150 f, out of sync with the breath (tailSway, on the player's clock).
 */
function idleAdult(): DragonAnim {
  return {
    loop: true,
    tailSway: { period: 150, amp: 5 },
    frames: [
      F(8, DP({ body: [0, 0], squash: 1, neck: [0.25], head: 0, wing: 0 }), { ease: 'inout' }),
      F(48, DP({ body: [0, -0.15], squash: 1.004, neck: [-0.1], head: 0, wing: 0.005 }), { ease: 'inout' }),
      F(8, DP({ body: [0, -1], squash: 1.03, neck: [-1.6], head: 0.4, wing: 0.04 }), { ease: 'inout' }),
      F(56, DP({ body: [0, -0.95], squash: 1.028, neck: [-2], head: 0.5, wing: 0.04 }), { ease: 'inout' }),
    ],
  };
}

/** YOUNG idle, 100 f: the adult breath at 0.85x, the tail +-8 over 100 f, a curious head tilt of +-5. */
function idleYoung(): DragonAnim {
  return {
    loop: true,
    tailSway: { period: 100, amp: 8 },
    frames: [
      F(7, DP({ body: [0, 0], squash: 1, neck: [0.3], head: -1 }), { ease: 'inout' }),
      F(40, DP({ body: [0, -0.15], squash: 1.004, neck: [0], head: 1 }), { ease: 'inout' }),
      F(7, DP({ body: [0, -1], squash: 1.03, neck: [-1.8], head: 4 }), { ease: 'inout' }),
      F(46, DP({ body: [0, -0.95], squash: 1.028, neck: [-2], head: 5 }), { ease: 'inout' }),
    ],
  };
}

/**
 * BABY idle, 72 f: a 2 px bob with squash 0.97 <-> 1.03, the head wobbling +-4 deg 15 f behind the body, the tail
 * WAGGING +-12 over 48 f. (30 % of its blinks are doubles: BABY_BLINK. The plop-sit variant comes with the variants.)
 */
function idleBaby(): DragonAnim {
  return {
    loop: true,
    tailSway: { period: 48, amp: 12 },
    frames: [
      F(15, DP({ body: [0, 0], squash: 1.03, head: 2 }), { ease: 'inout' }),
      F(21, DP({ body: [0, -1.2], squash: 1.0, head: -4 }), { ease: 'inout' }),
      F(15, DP({ body: [0, -2], squash: 0.97, head: -2 }), { ease: 'inout' }),
      F(21, DP({ body: [0, -0.8], squash: 1.0, head: 4 }), { ease: 'inout' }),
    ],
  };
}

/** A held rest pose (contact sheets, the silhouette test). */
const REST: DragonAnim = { loop: true, frames: [F(60, DP({}))] };

/** The shared table for a stage, before element overrides. */
export function baseAnims(stage: Stage): DragonAnimSet {
  return {
    idle: stage === 'adult' ? idleAdult() : stage === 'young' ? idleYoung() : idleBaby(),
    rest: REST,
  };
}

/** The table a pet plays: the stage's shared anims with the element's overrides merged over them. */
export function dragonAnims(stage: Stage, spec?: ElementSpec | null): DragonAnimSet {
  const set = baseAnims(stage);
  const ov = spec && spec.anims && spec.anims.overrides ? spec.anims.overrides(stage) : null;
  if (ov) for (const k of Object.keys(ov)) { const a = ov[k]; if (a) set[k] = a; }
  return set;
}

/** Anim names in the order the gallery's number keys pick them. */
export const ANIM_NAMES: readonly string[] = ['idle', 'rest'];
