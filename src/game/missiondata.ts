// The words missions are made of (docs/BASE_DESIGN.md 5 and 6): the six regions and their climates, the eleven
// challenges and the four rider skills that meet some of them, the difficulties, the little enemies each region's roads
// hold and the six bosses at the ends of them, with the enemies' faces and poses. Data only, no drawing and no
// simulation: shared by the mission model (missions.ts, regions.ts), the mission art kit (backdrops.ts, setpieces.ts,
// baddies.ts, foes.ts, fightfx.ts, npcs.ts, missionicons.ts) and the mission scene (missionview.ts), none of which
// needs the others to name these. Safe to import from Node.
//
// Fights (BASE_DESIGN B8): every road has its region's little enemies to fight between its challenges and ends in its
// boss (the code's `baddie`), fought: the dragons' breath against the enemies' clods and claws, a flash where a hit
// lands, never a wound. A beaten foe poofs into smoke; a beaten boss is knocked down, sees stars and runs off; a boss
// too strong for the team stomps off unbeaten, and the team walks on to the road's end (it never turns back), tired
// but whole. The enemies may look fierce --
// the only angry faces in the game; the dragons and the keepers never do (ART_BIBLE D18, KEEPERS K3).

/** The six regions on the Map Room's board (regions.ts names and places them). */
export type RegionId = 'millbrook' | 'oldmine' | 'bramblewood' | 'highfold' | 'frostmere' | 'emberfell';

/** A region's kind of place: the chooser's climate picture and the road scene's backdrop (backdrops.ts). */
export type Climate = 'meadow' | 'caves' | 'forest' | 'peaks' | 'ice' | 'ash';
export const CLIMATES: readonly Climate[] = Object.freeze(['meadow', 'caves', 'forest', 'peaks', 'ice', 'ash'] as Climate[]);

/** What a mission meets on the road (BASE_DESIGN 5.3's counters table): the first seven are met by a dragon's element, the last four by a rider's skill. */
export type ChallengeId = 'dark' | 'heavy' | 'cold' | 'storm' | 'flood' | 'thorns' | 'lost' | 'miller' | 'hurt' | 'fog' | 'gap';
export const CHALLENGE_IDS: readonly ChallengeId[] = Object.freeze(['dark', 'heavy', 'cold', 'storm', 'flood', 'thorns', 'lost', 'miller', 'hurt', 'fog', 'gap'] as ChallengeId[]);

/** A rider's skill (BASE_DESIGN 5): Bea CHARM, Tomas MEDIC, Iris NAVIGATOR, Pip NIMBLE. */
export type Skill = 'charm' | 'medic' | 'navigator' | 'nimble';
export const SKILLS: readonly Skill[] = Object.freeze(['charm', 'medic', 'navigator', 'nimble'] as Skill[]);

/** A mission's difficulty: 2 challenges easy, 3 normal and hard; the fights on the road and the boss's might grow with it. */
export type Difficulty = 'easy' | 'normal' | 'hard';

/**
 * The six bosses (BASE_DESIGN 5.3, 6), one at the end of every road of its region, in the regions' order: THE BRIDGE
 * TROLL (Millbrook), THE MOLE KING (Old Mine Road), THE BRIAR BOAR (Bramblewood), THE STORM ROC (Highfold), THE FROST
 * GIANT (Frostmere), THE CINDER GOLEM (Emberfell).
 */
export type BaddieId = 'bridgetroll' | 'moleking' | 'briarboar' | 'stormroc' | 'frostgiant' | 'cindergolem';
export const BADDIE_IDS: readonly BaddieId[] = Object.freeze(['bridgetroll', 'moleking', 'briarboar', 'stormroc', 'frostgiant', 'cindergolem'] as BaddieId[]);

/**
 * The little enemies (BASE_DESIGN 5.3, 6), a pack of them between the challenges on every road of their region, in the
 * regions' order: MUD GOBLINS, MOLE MINERS, THORN SPRITES, STORM IMPS, FROST IMPS, CINDER IMPS.
 */
export type FoeId = 'mudgoblin' | 'moleminer' | 'thornsprite' | 'stormimp' | 'frostimp' | 'cinderimp';
export const FOE_IDS: readonly FoeId[] = Object.freeze(['mudgoblin', 'moleminer', 'thornsprite', 'stormimp', 'frostimp', 'cinderimp'] as FoeId[]);

/**
 * An enemy's face (a boss's or a foe's): fierce (a V brow over a narrowed eye and a toothy scowl -- the one angry face
 * in the game, and only the enemies wear it), hurt (the eye screwed shut as a hit lands), dazed (knocked down: the eye a
 * spiral, stars round the head).
 */
export type BaddieFace = 'fierce' | 'hurt' | 'dazed';
export const BADDIE_FACES: readonly BaddieFace[] = Object.freeze(['fierce', 'hurt', 'dazed'] as BaddieFace[]);

/**
 * A boss's pose: walk (onto the road, at the team), stand (squared up), attack (its big move: rearing up and lunging
 * at the team as it throws), hit (rocked back as a hit lands), down (knocked down, seeing stars), flee (beaten,
 * scrambling off up the road, dust at its heels).
 */
export type BaddiePose = 'walk' | 'stand' | 'attack' | 'hit' | 'down' | 'flee';
export const BADDIE_POSES: readonly BaddiePose[] = Object.freeze(['walk', 'stand', 'attack', 'hit', 'down', 'flee'] as BaddiePose[]);

/** A little enemy's pose: walk (scurrying in), stand, attack (a hop at the team as it throws), hit (knocked back as a hit lands). A beaten one is its poof (fightfx.ts). */
export type FoePose = 'walk' | 'stand' | 'attack' | 'hit';
export const FOE_POSES: readonly FoePose[] = Object.freeze(['walk', 'stand', 'attack', 'hit'] as FoePose[]);

/** The grumpy miller's two looks (npcs.ts): grumpy at the mill until a CHARM rider talks him round, then talked round. */
export type MillerMood = 'grumpy' | 'talkedRound';

/** A set piece's state on the road (setpieces.ts): not reached yet, met by the team's counter (the problem visibly solved), or left unmet (they wait it out). */
export type StopState = 'ahead' | 'met' | 'unmet';
