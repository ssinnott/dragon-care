// A shading target for the mission art kit (setpieces.ts, baddies.ts): the engine's cel helpers (src/lib/art/shading.ts
// celPath, celBall, celPoly, ...) paint any "rig-shaped" object, so a set piece or a baddie gets the dragons' and the
// keepers' exact look -- the 1 px #1a1018 ink, a flat base, a shadow band away from the light and a highlight cap toward
// it, the THIN_R / FLAT_R / HI_MIN gates -- without a rig. The light is the house's, top left in SCREEN space: a
// drawing mirrored by facing (ctx.scale(-1, 1)) turns its light with it, so it stays top left on screen.
import { LIGHT_X, LIGHT_Y, RAMP } from '../lib/art/shading.ts';
import type { ShadeTarget, Tones } from '../lib/art/shading.ts';
import { INK } from './surfaces.ts';

/** A shading target with its own tone cache; `flat` paints every fill in one colour (a silhouette). */
export interface Cel extends ShadeTarget { override: string | null }

const cache = new Map<string, Tones>();
/**
 * A cel target lit from the screen's top left for a drawing mirrored by `facing` (1 as drawn, -1 mirrored). `flat`
 * paints every fill in one colour, its outline too (a silhouette) -- unless `ink` keeps the outline: a fight's hit flash
 * (HIT_FLASH: the fills flat and pale inside their own ink, as the dragons' grow-up flash, ART_BIBLE 4.2).
 */
export function celTarget(facing: 1 | -1 = 1, flat: string | null = null, ink: string | null = null): Cel {
  return {
    tones: cache, ramp: RAMP, override: flat, shading: true, light: { x: LIGHT_X * facing, y: LIGHT_Y },
    outline: ink ?? flat ?? INK, ow: 1, contactAlpha: 0, tonesN: 3,
    // (the outline goes through here too: a kept ink stays ink under the flat colour)
    col(hex: string) { return this.override != null && !(ink != null && hex === ink) ? this.override : hex; },
  };
}
/** The fills of an enemy a hit has just landed on (a few steps: missionview.ts), flat inside its ink. */
export const HIT_FLASH = '#fff6e4';
