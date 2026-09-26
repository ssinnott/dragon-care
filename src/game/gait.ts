// A dragon's pace, read from its own walk (docs/BASE_DESIGN.md 2, "Moving around"; plan 3.4): the walk anim's frames
// carry their root motion (`move`, px along facing per step), and a planted paw stands still on the floor only while
// the body moves by exactly that much each step. So the care simulation (travel.ts) moves a walking dragon by its walk's
// own per-frame `move`, at the anim's speed 1, and the view (base.ts) plays that walk from the start of the same bout at
// speed 1: the two are the same numbers, step for step, and nothing skates. A walk is not a constant pace -- a baby's
// stumble, spike's creep and slinkwing's pointer pause stand still for whole frames -- so the table is kept frame by
// frame. The frames' durations and moves depend on the element and the stage only, never the seed (sim-check 9), and
// build under plain Node (no DOM): about 20 ms per element and stage, once, the first time a dragon of it walks. The
// same tables give a `happy`'s length (happyLen): how long the simulation holds a dragon that has just grown up, so the
// view's `happy` -- its grow-up's cheer -- plays through (life.ts).
import { dragonBuild } from '../art/dragon/build.ts';
import { dragonAnims } from '../art/dragon/anims.ts';
import type { DragonElement } from '../art/dragon/palettes.ts';
import type { Stage } from '../art/dragon/stages.ts';

/**
 * A walk's root motion: its frames (duration in steps, `move` px per step), the whole cycle's length in steps, and the
 * mean pace (px per step). `steps[t]` is the move at anim time t in [0, len): the frame containing t (frame i covers
 * [cum_i, cum_i+1)); `loopStart` is the time the loop returns to (0: the whole anim loops).
 */
export interface Gait {
  frames: readonly { dur: number; move: number }[];
  len: number;
  avg: number;
  steps: readonly number[];
  loopStart: number;
}

const GAITS = new Map<string, Gait>();

/** A walk anim's frames as a gait table. */
export function gaitFrom(frames: readonly { dur?: number; move?: number }[], loopFrom = 0): Gait {
  const fr = frames.map((f) => ({ dur: f.dur || 1, move: f.move || 0 }));
  const steps: number[] = [];
  let loopStart = 0, sum = 0;
  fr.forEach((f, i) => {
    if (i === loopFrom) loopStart = steps.length;
    for (let k = 0; k < f.dur; k++) steps.push(f.move);
    sum += f.dur * f.move;
  });
  return { frames: fr, len: steps.length, avg: steps.length ? sum / steps.length : 0, steps, loopStart };
}

/**
 * The gait of an element's walk at a stage: built once, from the walk the pets play (anims.ts dragonAnims(stage, spec,
 * dims).walk, a seed-1 build's dims), and kept.
 */
export function gaitOf(el: DragonElement, stage: Stage): Gait {
  const key = `${el}:${stage}`, had = GAITS.get(key);
  if (had) return had;
  const b = dragonBuild({ element: el, stage, seed: 1 });
  const walk = dragonAnims(stage, b.spec, b.dims).walk;
  if (!walk || !walk.frames.length) throw new Error(`gait: ${el} ${stage} has no walk`);
  const g = gaitFrom(walk.frames, walk.loopFrom ?? 0);
  GAITS.set(key, g);
  return g;
}

const HAPPY = new Map<string, number>();

/**
 * The steps an element's `happy` lasts at a stage, played from its start at speed 1 (its frames' durations summed): the
 * grow-up's cheer (life.ts), which the view plays as the dragon's one `happy` -- the simulation holds a dragon that has
 * just grown up where it stands for exactly this long, so nothing cuts the cheer short. Like the walk, read from the
 * table the pets play (a seed-1 build's dims), the same whatever the seed (sim-check 9), and built once.
 */
export function happyLen(el: DragonElement, stage: Stage): number {
  const key = `${el}:${stage}`, had = HAPPY.get(key);
  if (had != null) return had;
  const b = dragonBuild({ element: el, stage, seed: 1 });
  const happy = dragonAnims(stage, b.spec, b.dims).happy;
  if (!happy || !happy.frames.length) throw new Error(`happy: ${el} ${stage} has no happy`);
  const len = happy.frames.reduce((n, f) => n + (f.dur || 1), 0);
  HAPPY.set(key, len);
  return len;
}

/**
 * Anim time t of a walk played from its start, folded into its first pass [0, len): the loop wraps at its length back
 * to its loop start (a walk with an intro plays the intro once). The view catches a pet's walk up to a bout already
 * under way by ticking its player this many times (base.ts sync).
 */
export function wrapT(g: Gait, t: number): number {
  if (t < g.len) return t < 0 ? 0 : t;
  return g.loopStart + ((t - g.loopStart) % (g.len - g.loopStart));
}

/**
 * The walk's move at anim time t (t steps after it was played from its start at speed 1): the frame containing t,
 * the loop wrapping at its length back to its loop start. `DragonAnimPlayer.tick` at speed 1 leaves its `move` at
 * exactly this after its t-th tick.
 */
export function moveAt(g: Gait, t: number): number { return g.steps[wrapT(g, t)]; }
