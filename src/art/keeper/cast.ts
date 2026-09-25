// The keepers: the four people who look after the dragons (docs/KEEPERS.md 2). Data only: who each keeper is, the
// care job they do, their build on the engine's humanoid proportions, and the parts that make their silhouette.
//
// Each keeper is told apart the way each dragon is, by one shape in one place (bible D1's zones, on a person): the
// HEAD's silhouette and the thing in the HANDS. At the ÷ 3 silhouette size a keeper reads as: a bun and a bowl (Bea),
// a wide brim and a brush (Tomas), a floppy cap with a ball on its tip (Iris), a small body under spiky tufts (Pip).
import type { Proportions } from '../../lib/art/rig.ts';

/** Keeper ids, in cast order. */
export const KEEPER_IDS = ['bea', 'tomas', 'iris', 'pip'] as const;
export type KeeperId = typeof KEEPER_IDS[number];

/**
 * A care job: what a keeper does for a dragon (src/care/acts.ts). `feed` answers a begging dragon with a bowl, `groom`
 * pets and brushes (the dragon's pet anim), `tuck` puts a sleepy dragon to bed, `help` is the apprentice's: it pets the
 * babies and cheers the others on.
 */
export type CareJob = 'feed' | 'groom' | 'tuck' | 'help';

export type HairStyle = 'bun' | 'cropped' | 'bob' | 'tufts';
export type HatStyle = 'straw' | 'nightcap';
export type ToolKind = 'bowl' | 'brush';

export interface KeeperSpec {
  id: KeeperId;
  /** First name, and the job title the gallery labels them with. */
  name: string;
  title: string;
  job: CareJob;
  /** 'elder' keeps the elder dragons' rule (bible D21): slower, steadier, never frail -- no stoop, no cane, no tremor. */
  age: 'child' | 'adult' | 'elder';
  /** Overrides of the engine's DEFAULT_PROPORTIONS (an adult ~78 px; the child ~58). */
  proportions: Partial<Proportions>;
  hair: HairStyle;
  hat: HatStyle | null;
  beard: boolean;
  apron: boolean;
  /** Long sleeves colour the forearm in the top's colour; short (or rolled) ones leave it skin. */
  sleeves: 'long' | 'short';
  /** What the keeper wears over the top: Tomas's braces, Iris's open cardigan, Pip's overall bib. */
  over: 'braces' | 'cardigan' | 'overalls' | null;
  /** The tool the keeper's job hands them (a bowl is picked up per feed; the brush is always carried). */
  tool: ToolKind | null;
  /** Anim durations x this (the child quick, the elder unhurried: the dragons' 4.1 stage timing on people). */
  tempo: number;
  /** Walk speed, px per frame (the dragons amble at 0.26 to 0.5). */
  speed: number;
  /** The walk cycle's stride, px of floor per cycle (2 steps). */
  stride: number;
}

/**
 * The cast. Proportions are the engine's DEFAULT_PROPORTIONS (headR 9, torso 22 x 26, 15 + 15 legs: 78 px) with a
 * few changes each: Bea shorter and rounder, Tomas broad, Iris slight, Pip a child whose head is as big as an
 * adult's (a child reads by the head's share of the height, as a baby dragon does: bible 2.6).
 */
export const KEEPERS: Readonly<Record<KeeperId, Readonly<KeeperSpec>>> = Object.freeze({
  bea: Object.freeze({
    id: 'bea', name: 'Bea', title: 'the cook', job: 'feed', age: 'elder',
    proportions: { torsoW: 24, torsoH: 25, hip: 21, upperLeg: 13, lowerLeg: 13, upperArm: 12, lowerArm: 11, legR: 5.5, armR: 4.5 },
    hair: 'bun', hat: null, beard: false, apron: true, sleeves: 'short', over: null, tool: 'bowl',
    tempo: 1.2, speed: 0.55, stride: 26,
  }),
  tomas: Object.freeze({
    id: 'tomas', name: 'Tomas', title: 'the groomer', job: 'groom', age: 'adult',
    proportions: { torsoW: 25, torsoH: 27, hip: 19, armR: 5, legR: 6, handR: 4.5 },
    hair: 'cropped', hat: 'straw', beard: true, apron: false, sleeves: 'short', over: 'braces', tool: 'brush',
    tempo: 1, speed: 0.7, stride: 34,
  }),
  iris: Object.freeze({
    id: 'iris', name: 'Iris', title: 'the night keeper', job: 'tuck', age: 'adult',
    proportions: { torsoW: 21, torsoH: 26, hip: 18, armR: 4, legR: 5 },
    hair: 'bob', hat: 'nightcap', beard: false, apron: false, sleeves: 'long', over: 'cardigan', tool: null,
    tempo: 1.1, speed: 0.6, stride: 30,
  }),
  pip: Object.freeze({
    id: 'pip', name: 'Pip', title: 'the apprentice', job: 'help', age: 'child',
    proportions: {
      headR: 9, neck: 2, torsoW: 17, torsoH: 18, hip: 15, upperArm: 9, lowerArm: 8, handR: 3.5, upperLeg: 10, lowerLeg: 10,
      footL: 8, footH: 4, armR: 3.5, legR: 4, neckR: 3, shoulderX: 1.5, hipX: 3,
    },
    hair: 'tufts', hat: null, beard: false, apron: false, sleeves: 'short', over: 'overalls', tool: null,
    tempo: 0.8, speed: 0.75, stride: 26,
  }),
});
