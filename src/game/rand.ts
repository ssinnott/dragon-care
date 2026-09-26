// Stateless randomness for the base (docs/BASE_DESIGN.md 7: "every random choice goes through the engine's seeded
// RNG"). After the world is built, nothing keeps an RNG running: every draw comes from `rngAt(seed, TAG, ...keys)`, a
// fresh generator seeded by hashing the world's seed, a tag naming what the draw is for, and whatever keys pick out
// this one draw (a day, a dragon id, a board slot). The same keys give the same draws in every run, in any order, so
// no RNG state is ever saved -- only the world's seed is (src/game/save.ts).
import { makeRng } from '../lib/engine/rng.ts';
import type { RngInstance } from '../lib/engine/rng.ts';

/** What a draw is for: each use gets its own tag, so two uses never share a stream. */
export const TAG = Object.freeze({ BOARD: 1, MISSION: 2, EGG: 3, NAME: 4, GARDEN: 5, REGION: 6, SKY: 7 } as const);
export type Tag = typeof TAG[keyof typeof TAG];

/** murmur3's 32-bit finaliser: every input bit reaches every output bit. */
function fmix32(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * A 32-bit hash of a list of 32-bit integers (each key is truncated to one), order-sensitive: a murmur3-fmix chain,
 * each key folded in after the previous ones were mixed, the count folded in last so [a] and [a, 0] differ.
 */
export function mix32(...keys: number[]): number {
  let h = 0x9e3779b9;
  for (const k of keys) h = fmix32((h ^ Math.imul(k | 0, 0xcc9e2d51)) + 0x6b43a9b5);
  return fmix32(h ^ keys.length);
}

/** A generator for one draw (or one short run of draws): the same seed, tag and keys give the same sequence, always. */
export function rngAt(seed: number, tag: Tag, ...keys: number[]): RngInstance {
  return makeRng(mix32(seed, tag, ...keys) || 1);
}
