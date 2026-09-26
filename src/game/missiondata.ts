// The missions' shared vocabulary (plan S8/S9, docs/BASE_DESIGN.md 5 and 6): the six climates, the eleven challenges,
// the four rider skills and the three big baddies, with their faces, poses and exits. Data only, no drawing and no
// simulation: the mission art kit (backdrops.ts, setpieces.ts, baddies.ts, npcs.ts, missionicons.ts) draws from these
// names, and S8's regions.ts imports them rather than redefining them. Safe to import from Node.
//
// Cozy (D4, P14): a baddie is calmed, outwitted or driven off, never hurt -- no hurt, defeat or health exists here, and
// no face is angry (a grumpy face is a flat brow and a pout, never a V).

/** A region's kind of place: the chooser's climate picture and the road scene's backdrop (backdrops.ts). */
export type Climate = 'meadow' | 'caves' | 'forest' | 'peaks' | 'ice' | 'ash';
export const CLIMATES: readonly Climate[] = Object.freeze(['meadow', 'caves', 'forest', 'peaks', 'ice', 'ash'] as Climate[]);

/** What a mission meets on the road (S8's counters table): the first seven are met by a dragon's element, the last four by a rider's skill. */
export type ChallengeId = 'dark' | 'heavy' | 'cold' | 'storm' | 'flood' | 'thorns' | 'lost' | 'miller' | 'hurt' | 'fog' | 'gap';
export const CHALLENGE_IDS: readonly ChallengeId[] = Object.freeze(['dark', 'heavy', 'cold', 'storm', 'flood', 'thorns', 'lost', 'miller', 'hurt', 'fog', 'gap'] as ChallengeId[]);

/** A rider's skill (P13): Bea CHARM, Tomas MEDIC, Iris NAVIGATOR, Pip NIMBLE. */
export type Skill = 'charm' | 'medic' | 'navigator' | 'nimble';
export const SKILLS: readonly Skill[] = Object.freeze(['charm', 'medic', 'navigator', 'nimble'] as Skill[]);

/** The three big baddies (P14): THE MOLE KING (Old Mine Road), THE STORM ROC (Highfold), THE FROST GIANT (Frostmere). */
export type BaddieId = 'moleking' | 'stormroc' | 'frostgiant';
export const BADDIE_IDS: readonly BaddieId[] = Object.freeze(['moleking', 'stormroc', 'frostgiant'] as BaddieId[]);

/** How a baddie leaves the road, and the only ways it can: calmed (it dozes off), outwitted (it wanders the wrong way), driven off (it shuffles off grumbling). */
export type BaddieExit = 'calmed' | 'outwitted' | 'drivenOff';
export const BADDIE_EXITS: readonly BaddieExit[] = Object.freeze(['calmed', 'outwitted', 'drivenOff'] as BaddieExit[]);

/** A baddie's face: no angry one exists (grumpy is a flat, low brow and a pout). */
export type BaddieFace = 'neutral' | 'grumpy' | 'surprised' | 'sleepy';
export const BADDIE_FACES: readonly BaddieFace[] = Object.freeze(['neutral', 'grumpy', 'surprised', 'sleepy'] as BaddieFace[]);

/** A baddie's pose: no knockback, no hurt pose, nothing flung. */
export type BaddiePose = 'walk' | 'stand' | 'sit' | 'turn' | 'leave';
export const BADDIE_POSES: readonly BaddiePose[] = Object.freeze(['walk', 'stand', 'sit', 'turn', 'leave'] as BaddiePose[]);

/** The grumpy miller's two states (npcs.ts): grumpy at the mill until CHARM's moment, then talked round. */
export type MillerState = 'grumpy' | 'talkedRound';

/** A set piece's state on the road (setpieces.ts): still ahead of the team, met (the problem visibly solved), or unmet (nobody could help). */
export type SetPieceState = 'ahead' | 'met' | 'unmet';
