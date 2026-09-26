// The five needs every dragon has, how fast they drain, and what they do to its mood (docs/BASE_DESIGN.md 4.1, 4.2,
// 4.9). Plain data and functions: no drawing, no randomness and no clock of its own -- the care simulation (sim.ts)
// owns time and steps it 60 times a second.
import type { DragonElement } from '../art/dragon/palettes.ts';
import type { Stage } from '../art/dragon/stages.ts';

export const NEEDS = ['food', 'sleep', 'play', 'bath', 'love'] as const;
export type NeedKind = typeof NEEDS[number];
export type Needs = Record<NeedKind, number>;

/**
 * Each element's own need (ART_BIBLE 3.8: "fire's is food, spike's touch, rock's bond, lightning's play, water's
 * baths, slinkwing's company"; touch, bond and company are all love here). It drains OWN_RATE times as fast.
 */
export const OWN_NEED: Readonly<Record<DragonElement, NeedKind>> = Object.freeze({
  fire: 'food', spike: 'love', rock: 'love', lightning: 'play', water: 'bath', slinkwing: 'love', dusk: 'sleep',
});
export const OWN_RATE = 2;

/** Whether a dragon has a need at all: fire hates baths (3.2), so it has no bath need. */
export function hasNeed(el: DragonElement, k: NeedKind): boolean { return !(el === 'fire' && k === 'bath'); }

/** Fixed simulation steps per second. */
export const FPS = 60;
/**
 * Seconds of play a full need takes to fall to QUEUE at the base rate (4.9: tuning, not law). 420 since S3 (was 360):
 * with dragons walking to their needs' rooms and one lift between the floors, 360 kept the car busy nearly every step
 * and the waits long (measured: docs/BASE_DESIGN.md 4.9 and 8.1).
 */
export const HALF_LIFE_S = 420;
/** The base drain per step: 1 -> QUEUE in HALF_LIFE_S. */
export const BASE_DRAIN = 0.5 / (HALF_LIFE_S * FPS);
/** Stage scales every drain: a baby needs more, an elder less. */
export const STAGE_RATE: Readonly<Record<Stage, number>> = Object.freeze({ baby: 1.25, young: 1.1, adult: 1, elder: 0.8 });

/** How much a need drains in one step, for one dragon (0 for a need it hasn't got). */
export function drainRate(el: DragonElement, stage: Stage, k: NeedKind): number {
  if (!hasNeed(el, k)) return 0;
  return BASE_DRAIN * STAGE_RATE[stage] * (OWN_NEED[el] === k ? OWN_RATE : 1);
}

/** Under QUEUE a need opens a job (a white bubble); under SOON the bubble is yellow; under NOW, red with a "!". */
export const QUEUE = 0.5, SOON = 0.25, NOW = 0.1;
/** A need's tier: 0 queued, 1 soon, 2 now. */
export type Tier = 0 | 1 | 2;
export function tierOf(v: number): Tier { return v < NOW ? 2 : v < SOON ? 1 : 0; }

/** Every need full. */
export function fullNeeds(): Needs { return { food: 1, sleep: 1, play: 1, bath: 1, love: 1 }; }

/**
 * A dragon's mood (-1..1, the rig's mood channel: its cue is the gauge, D7) from its worst need: 0.8 while every need
 * is at 0.6 or more, falling to -1 as the worst empties. Only the worst counts, so one neglected need shows.
 */
export function moodOf(el: DragonElement, needs: Readonly<Needs>): number {
  let worst = 1;
  for (const k of NEEDS) if (hasNeed(el, k)) worst = Math.min(worst, needs[k]);
  const deficit = Math.max(0, 0.6 - worst) / 0.6;
  return Math.max(-1, Math.min(1, 0.8 - 1.8 * deficit));
}

/** Lightning's boredom charge (0..1, its crackle, then the zap: 3.5) from an unmet play need; 0 for anyone else. */
export function chargeOf(el: DragonElement, needs: Readonly<Needs>): number {
  return el === 'lightning' ? Math.max(0, Math.min(1, (QUEUE - needs.play) / (QUEUE - NOW))) : 0;
}
