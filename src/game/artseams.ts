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
// and the two palette views the watchable scene's gate (x) reads (S9; tools/palette-check.ts): BADDIE_FILLS and
// climateBands, both the kit's own data.
import type { DayPhase } from './clock.ts';
import type { Climate, BaddieId } from './missiondata.ts';
import { BADDIE_ART, BADDIE_EDGE } from './baddies.ts';
import { BACKDROPS } from './surfaces.ts';

export { drawClimate } from './backdrops.ts';
export { drawSetPiece } from './setpieces.ts';
export { drawBaddie, drawBaddiePortrait } from './baddies.ts';
export { drawMiller } from './npcs.ts';
export { CHALLENGE_ICONS, SKILL_ICONS, SADDLE } from './missionicons.ts';

/**
 * The fills the scene sees a baddie by, for palette gate (x) (plan S9: each >= 25 % in luminance from the road, the
 * scene's ground and its region's backdrop bands, >= 6 okL from ink): the kit's BADDIE_ART[id].palette colours on the
 * baddie's silhouette edge (baddies.ts BADDIE_EDGE). The colours inside the silhouette (a belly, a jewel, the spectacle
 * rims) never meet the road or the sky: the kit's own half of gate (x) holds them to the house ladder against what they
 * touch (BADDIE_PAIRS), and every fill to the ink.
 */
export const BADDIE_FILLS: Readonly<Record<BaddieId, readonly string[]>> = Object.freeze(Object.fromEntries(
  (Object.keys(BADDIE_ART) as BaddieId[]).map((id) => [id, Object.freeze([...new Set(BADDIE_EDGE[id].map((k) => BADDIE_ART[id].palette[k]))])]),
) as Record<BaddieId, readonly string[]>);
/**
 * The backdrop bands a region's climate is drawn in at a phase (the kit's BACKDROPS.climate[climate][phase]: the three
 * sky bands, the far ridge, the near forms and their second colour), which gate (x) holds every baddie fill apart from.
 * The weather marks (a 2 px streak, a flake) and the caves' lamp pool are marks, not bands.
 */
export function climateBands(climate: Climate, phase: DayPhase): readonly string[] | null {
  const P = BACKDROPS.climate[climate][phase];
  return [P.sky[0], P.sky[1], P.sky[2], P.ridge, P.near, P.detail];
}
