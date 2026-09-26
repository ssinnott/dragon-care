// The mission art's seam (plan S9a): the art kit's exports under the names and signatures the mission contract
// (af25650) fixed, so the mission screens (S8) and the scene (S9) were built against them before the art landed.
// Now plain re-exports of the kit -- backdrops.ts, setpieces.ts, baddies.ts, npcs.ts and missionicons.ts -- and
// callers import from here only.
//   drawClimate(ctx, climate, phase, rect: Rect, scroll = 0)                    backdrops.ts
//   drawSetPiece(ctx, id: ChallengeId, x, feetY, state: StopState, t)           setpieces.ts
//   drawBaddie(ctx, id: BaddieId, x, feetY, facing: 1 | -1, face, pose, t)     baddies.ts
//   drawBaddiePortrait(ctx, id: BaddieId, x, y)                                 baddies.ts
//   drawMiller(ctx, mood: MillerMood, x, feetY, facing: 1 | -1, t)              npcs.ts
//   CHALLENGE_ICONS, SKILL_ICONS (9 x 9 Sprite records), SADDLE (Sprite)        missionicons.ts
export { drawClimate } from './backdrops.ts';
export { drawSetPiece } from './setpieces.ts';
export { drawBaddie, drawBaddiePortrait } from './baddies.ts';
export { drawMiller } from './npcs.ts';
export { CHALLENGE_ICONS, SKILL_ICONS, SADDLE } from './missionicons.ts';
