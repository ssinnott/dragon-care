// The sky behind the base (docs/BASE_DESIGN.md 7), drawn every frame in SCREEN space before the building, which is
// transparent above the ground and around its walls (building.ts): so no canvas grows with the world (plan P11), and
// the day turns without a redraw of anything else. Three flat bands fixed to world y, far hills and clouds at half
// the camera's pace, and at night the moon and the stars at a fifth of it. The phases change in three stepped mixes over
// a phase's first hour (surfaces.ts skyBands): no gradient, no alpha. Night is only this and the lights (building.ts
// drawLights): it never tints a dragon, a floor or a wall (plan G8).
import type { ClockRead, DayPhase } from './clock.ts';
import { BACKDROPS, LIGHTS, INK, skyBands, phaseColour } from './surfaces.ts';
import { GROUND } from './layout.ts';
import { rngAt, TAG } from './rand.ts';

/** The bands' lower edges, world y: the top band 0-200, the middle 200-420, the low one to the ground. */
const BAND_Y = [200, 420, GROUND] as const;
/** The far layers' pace against the camera's: the hills and clouds at half, the moon and the stars at a fifth. */
const FAR = 0.5, VERY_FAR = 0.2;
/** The far hills: one period of the ridge (x in the layer's own px, y world), repeated along the whole world. */
const HILLS: readonly (readonly [number, number])[] = [[0, 640], [180, 600], [420, 630], [700, 590], [980, 626], [1200, 596]];
const HILL_P = 1360;
/** The clouds: clusters (layer x, world y, scale), repeated every CLOUD_P; each a few flat discs. */
const CLOUDS: readonly (readonly [number, number, number])[] = [[300, 64, 1], [760, 84, 1.4], [980, 170, 1], [1250, 250, 0.8], [360, 250, 0.7]];
const CLOUD_P = 1400, PUFFS: readonly (readonly [number, number, number])[] = [[0, 0, 14], [16, -6, 18], [34, 0, 13], [18, 6, 12]];
/** The stars: 24 flat 2 x 2 marks at fixed seeded places (layer x, world y), repeated every STAR_P; the moon, one inked disc. */
const STAR_P = 800, STARS: readonly (readonly [number, number])[] = Array.from({ length: 24 }, (_, i) => {
  const r = rngAt(1, TAG.SKY, i);
  return [Math.floor(r.next() * STAR_P), 6 + Math.floor(r.next() * 400)] as const;
});
const MOON = { x: 420, y: 44, r: 5 } as const;

/**
 * How far into the night the sky is, 0 to 3: the night's blend as it comes on (from 20:00), 3 through the small hours,
 * then 3 less the dawn's as it goes. The stars come out in steps of a third with it, and the moon with the first.
 */
export function nightness(c: ClockRead): number {
  return c.phase === 'night' ? c.blend : c.phase === 'dawn' ? 3 - c.blend : 0;
}

/**
 * How far the sky has turned from the day's toward the dark, 0 to 3, in its own thirds: 0 by day and in the dawn's
 * colours, rising through the dusk's turn (18:00 to 19:00), 3 from then through the night, and falling through the
 * dawn's turn (05:00 to 06:00). The lamps follow it, never the phase alone: at a phase's first step the sky still
 * shows the phase before's colours.
 */
export function dimness(c: ClockRead): number {
  return c.phase === 'dusk' ? c.blend : c.phase === 'night' ? 3 : c.phase === 'dawn' ? 3 - c.blend : 0;
}

/** The phase the sky mostly shows: the phase before's until two thirds into a phase's first hour, then its own. */
export function skyPhase(c: ClockRead): DayPhase { return c.blend >= 2 ? c.phase : c.prev; }

/** What the lights show (building.ts drawLights) and the HUD's time-of-day icon (hud.ts). */
export interface Lights {
  /** The towers' window slits lit. */
  slits: boolean;
  /** The rings each dorm lamp throws on its wall: none, the inner one, or both (they come on, and go, by shrinking). */
  rings: 0 | 1 | 2;
  /** The hearth's ring on the kitchen wall, and the skylight showing the night's sky and a star. */
  hearth: boolean;
  skylight: boolean;
  /** The top bar's icon: the sun, the low sun of dawn and dusk, the moon. */
  icon: 'sun' | 'low' | 'moon';
}
/**
 * The lights as the sky stands, so the two never disagree: the slits and the dorm lamps' rings with the dimness (the
 * inner ring from its first third, both from its second), the hearth's ring and the skylight's night with the stars
 * (nightness), and the icon with the phase the sky mostly shows.
 */
export function lightsOf(c: ClockRead): Lights {
  const dim = dimness(c), stars = nightness(c) > 0, sky = skyPhase(c);
  return { slits: dim > 0, rings: Math.min(2, dim) as 0 | 1 | 2, hearth: stars, skylight: stars, icon: sky === 'night' ? 'moon' : sky === 'day' ? 'sun' : 'low' };
}

/** Each copy of a repeating layer that can reach the screen: its offset, screen x, for a layer at `pace`. */
function copies(camX: number, pace: number, period: number, width: number, screenW: number): number[] {
  const shift = camX * pace, out: number[] = [];
  for (let k = Math.floor((shift - width) / period); k * period - shift < screenW + width; k++) out.push(k * period - shift);
  return out;
}

/** The sky for the clock `c`, drawn over the whole screen (camX, camY: the camera, world px; worldW: the world's width, whose far layers repeat). */
export function drawSky(ctx: CanvasRenderingContext2D, c: ClockRead, camX: number, camY: number, _worldW: number): void {
  const cx = Math.round(camX), cy = Math.round(camY), W = ctx.canvas.width, H = ctx.canvas.height;
  const bands = skyBands(c);
  let top = -cy;
  for (let i = 0; i < 3; i++) {
    const bottom = i === 2 ? H : BAND_Y[i] - cy;
    if (bottom > 0 && top < H) { ctx.fillStyle = bands[i]; ctx.fillRect(0, Math.max(0, top), W, Math.min(H, bottom) - Math.max(0, top)); }
    top = BAND_Y[i] - cy;
  }
  const n = nightness(c);
  // the stars (a third of them per step of the night) and the moon, furthest back
  if (n > 0) {
    ctx.fillStyle = LIGHTS.star;
    const shown = STARS.length * n / 3;
    for (const ox of copies(cx, VERY_FAR, STAR_P, 4, W)) {
      for (let i = 0; i < shown; i++) { const [sx, sy] = STARS[i]; ctx.fillRect(Math.round(ox + sx), sy - cy, 2, 2); }
    }
    const mx = Math.round(MOON.x - cx * VERY_FAR), my = MOON.y - cy;
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(mx, my, MOON.r + 1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = LIGHTS.moon; ctx.beginPath(); ctx.arc(mx, my, MOON.r, 0, Math.PI * 2); ctx.fill();
  }
  // the clouds, flat discs
  ctx.fillStyle = phaseColour(BACKDROPS.clouds, c);
  for (const ox of copies(cx, FAR, CLOUD_P, 80, W)) {
    for (const [x, y, s] of CLOUDS) for (const [dx, dy, r] of PUFFS) {
      ctx.beginPath(); ctx.arc(Math.round(ox + x + dx * s), Math.round(y + dy * s - cy), r * s, 0, Math.PI * 2); ctx.fill();
    }
  }
  // the far hills, meeting the ground
  ctx.fillStyle = phaseColour(BACKDROPS.hills, c);
  for (const ox of copies(cx, FAR, HILL_P, 0, W)) {
    ctx.beginPath(); ctx.moveTo(ox, GROUND - cy);
    for (const [x, y] of HILLS) ctx.lineTo(ox + x, y - cy);
    ctx.lineTo(ox + HILL_P, HILLS[0][1] - cy); ctx.lineTo(ox + HILL_P, GROUND - cy); ctx.closePath(); ctx.fill();
  }
}
