// The words missions are made of (docs/BASE_DESIGN.md 5, 6): regions and their climates, the challenges and the
// skills that meet them, and the big baddies with their faces, poses and cozy exits. Types only, shared by the
// mission model (missions.ts, regions.ts), the mission art (backdrops.ts, setpieces.ts, baddies.ts, missionicons.ts)
// and the mission scene (missionview.ts), so each can be built without the others.
export type RegionId = 'millbrook' | 'oldmine' | 'bramblewood' | 'highfold' | 'frostmere' | 'emberfell';
export type Climate = 'meadow' | 'caves' | 'forest' | 'peaks' | 'ice' | 'ash';
export type ChallengeId = 'dark' | 'heavy' | 'cold' | 'storm' | 'flood' | 'thorns' | 'lost' | 'miller' | 'hurt' | 'fog' | 'gap';
export type Skill = 'charm' | 'medic' | 'navigator' | 'nimble';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type BaddieId = 'moleking' | 'stormroc' | 'frostgiant';
/** How a baddie leaves the road on a success. There is no hurt or defeat state (D4, B8: nobody is hurt). */
export type BaddieExit = 'calmed' | 'outwitted' | 'drivenOff';
/** A baddie's face: no angry face exists; grumpy is a flat brow and a pout, never a V brow. */
export type BaddieFace = 'neutral' | 'grumpy' | 'surprised' | 'sleepy';
export type BaddiePose = 'walk' | 'stand' | 'sit' | 'turn' | 'leave';
/** The grumpy miller's two looks: before and after a CHARM rider talks him round. */
export type MillerMood = 'grumpy' | 'talkedRound';
/** A set piece's state on the road: not reached yet, met by the team's counter, or left unmet (they wait it out). */
export type StopState = 'ahead' | 'met' | 'unmet';
