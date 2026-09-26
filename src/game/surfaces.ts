// The colours the base's people and dragons stand on and are seen against (docs/BASE_DESIGN.md 1, 2, 7). Every
// surface a dragon or a keeper stands on -- a room's straw band, the lift car's deck, the landings, the ladder bay's
// floors, the towers' floors, the Aerie deck and its gantry -- is one of FLOORS, and tools/palette-check.ts gates every
// entry before anything stands on it: >= 25 % in luminance from every dragon body and belly colour at every stage (gate
// i), from every keeper's shoes and trousers (gate Ki), and HSV saturation under 0.20 (hue never helps on a floor). A
// room's identity is its wall and its props, never its floor. Everything a dragon is seen against -- the sky's bands at
// every phase of the day and every stepped mix between two phases, the far hills and the clouds, every room's wall,
// the bare and lift-shaft walls, the towers' stone, the big props that stand right behind a slot, and the light the
// lamps throw on the walls at night -- is here too, and gate (w) holds each >= 25 % LIGHTER than every dark body (a
// scale under L 0.15 at any stage: lightning, dusk, slinkwing; so L >= 0.159, never black) -- a big prop behind a slot
// >= 25 % from them either way (the firebox is a dark mouth) -- and >= 6 Oklab L from the ink. Night is these
// colours and the lights, never a tint on a dragon or a floor (plan G8): by night the walls and the building's shell
// take their NIGHT colours (plan S6c: a day colour to its night colour, one table, each gated by (w) too), stepped in
// thirds with the lights. Plain data: no drawing, safe to import from Node.
import { mix } from '../lib/art/palettes.ts';
import type { RoomKind } from './layout.ts';
import type { ClockRead, DayPhase } from './clock.ts';

/** The house outline (ART_BIBLE 1.1). */
export const INK = '#1a1018';

/** Every floor anyone stands on, by name. Later slices add their own (the mission road). */
export const FLOORS = Object.freeze({
  /** Pale straw, the reference habitat floor (ART_BIBLE 5.4): L 0.674, S 0.18. */
  straw: '#e0d6b8',
  /** The elder garden's path, pale gravel (plan S6: no green underfoot, D3): L 0.671, S 0.13. */
  path: '#dcd6c0',
});
export type FloorName = keyof typeof FLOORS;

/** The seams drawn over a straw floor: its top edge, and the towers' boards (a 1 px line, not a surface). */
export const STRAW_SEAM = '#c9bd9c';
/** The garden path's back edge (a 1 px line, not a surface). */
export const PATH_EDGE = '#c2baa2';

/** The back wall of a barn slot no room fills, and of the keepers' ladder bay (L 0.26). */
export const EMPTY_WALL = '#9a8a76';
/** The Dragon Lift's shaft wall, in the barn and above its roof (L 0.32). */
export const LIFT_WALL = '#a8987e';
/** The towers' room walls, dressed stone (L 0.50). */
export const STONE = '#c2bbb0';

/** Barn room walls: mid-light and low in saturation, each room its own (the floor stays straw). Gate (w). */
export const WALLS: Readonly<Partial<Record<RoomKind, string>>> = Object.freeze({
  kitchen: '#c8ac92', hatchery: '#d4bc98', bath: '#b8c4cc', romp: '#b9b3cf', groom: '#cdb9a3', dorm: '#a39cb8',
});

/**
 * The big props that stand right behind a slot, so a dragon standing there is seen against them (gate w, as a wall
 * is): the hearth's stone face and its firebox (kitchen slot 0), the tub (bath slot 1), the dorm's pallets and their
 * mattresses (behind every dorm slot). The tub and the pallets' frames were the timber `#8e6240` / `#8a6242` (L 0.15,
 * 20 % from lightning's body) until gate (w): now the lighter wood of the romp room's wheel. A prop's 1 px lines and its
 * cel shadow band are marks, not backdrops.
 */
export const PROPS = Object.freeze({ hearth: '#9c948a', firebox: '#3a2626', tub: '#a47a52', pallet: '#a47a52', mattress: '#e6dcc4', gateLeaf: '#a47a52' });

/**
 * The Hatchery's nests' straw heaps, the straw an egg lies nestled in (L 0.72): every element's egg -- its baby's scale
 * colour, eggs.ts -- keeps >= 25 % luminance from it (tools/palette-check.ts, the egg gate), so a dark egg and a pale
 * one both read in the nest, and the egg is seen against this straw alone (the gate's egg-lie: layout.ts NEST_RY). Its
 * strands are 2 px marks on the heap's flanks, clear of the egg.
 */
export const NEST = '#e6dcc4';

/** Every sky, hill and cloud colour at each phase of the day (the bands top to bottom: world y 0-200, 200-420, 420 to the ground), and the building's own backdrops. */
export interface Backdrops {
  sky: Readonly<Record<DayPhase, readonly [string, string, string]>>;
  hills: Readonly<Record<DayPhase, string>>;
  clouds: Readonly<Record<DayPhase, string>>;
  liftWall: string;
  emptyWall: string;
  stone: string;
  /** The elder garden, behind its residents (plan S6: green only behind and below the feet, never under them). */
  hedge: string;
  lawn: string;
  trunk: string;
  fence: string;
}
/**
 * The day's backdrops. Night is a mid-value blue hour (its bands L 0.19-0.28, never black: a dark dragon on the Aerie
 * stays readable against it, section 1's "night outdoors stays mid-value"); dawn lilac to peach, dusk mauve to amber.
 */
export const BACKDROPS: Readonly<Backdrops> = Object.freeze({
  sky: Object.freeze({
    day: ['#bcd8e4', '#cfe3ea', '#e0eef0'] as const,
    dawn: ['#b8b0d0', '#d8d0e0', '#ecd6c8'] as const,
    dusk: ['#b89ab0', '#e0b8a0', '#e8c8a8'] as const,
    night: ['#6a78a8', '#6f7fa8', '#7f8fb8'] as const,
  }),
  hills: Object.freeze({ day: '#b3cfae', dawn: '#a8b8a4', dusk: '#9aa890', night: '#6a7aa0' }),
  clouds: Object.freeze({ day: '#eef6f7', dawn: '#f0e0e0', dusk: '#f0d0c0', night: '#8090b0' }),
  liftWall: LIFT_WALL,
  emptyWall: EMPTY_WALL,
  stone: STONE,
  // (the garden: the hedge and the apple trees' crowns, the lawn behind the path, the trees' trunks, the bench, the
  // lantern posts and the sign's posts -- a lighter wood than the barn's timber, which is too dark behind a dark
  // body -- and the picket fence at the garden's end)
  hedge: '#7f9e6c',
  lawn: '#8fae76',
  trunk: '#a47a52',
  fence: '#e8e0cc',
});

/** The lights (docs/BASE_DESIGN.md 7): the towers' window slits by day and lit, the dorm's lamps, the hearth's fire, the stars and the moon, and the garden's lanterns. */
export const LIGHTS = Object.freeze({ glass: '#cfe3ea', slit: '#ffd98a', lamp: '#ffa98c', fire: '#f39a2e', star: '#e8ecf8', moon: '#f0ecd8', lantern: '#f2d36a' });
/** The two stepped rings a dorm lamp throws on the wall at dusk and night: inner (r 10) and outer (r 16), flat. Gate (w). */
export const LAMP_RINGS: readonly [string, string] = Object.freeze([mix(WALLS.dorm!, LIGHTS.lamp, 0.5), mix(WALLS.dorm!, LIGHTS.lamp, 0.25)] as [string, string]);
/** The one flat ring the hearth throws on the kitchen wall at night. Gate (w). */
export const HEARTH_RING = mix(WALLS.kitchen!, LIGHTS.fire, 0.25);
/** The two stepped rings each garden lantern throws on the hedge at dusk and night (never on the path): inner and outer, flat. Gate (w). */
export const LANTERN_RINGS: readonly [string, string] = Object.freeze([mix(BACKDROPS.hedge, LIGHTS.lantern, 0.5), mix(BACKDROPS.hedge, LIGHTS.lantern, 0.25)] as [string, string]);

// ---------- night (plan S6c: night you can see) ----------

/**
 * The moonlight: at night every colour of the building's shell and the garden (the walls, the towers' stone, the barn's
 * boards, timber and roof, the lift and ladder bays, the Aerie's gantry, the ground, the hedge, lawn, trees and fence,
 * and the props behind the slots) is its day colour mixed half way to this mid blue -- cooler and darker, never black:
 * every night wall and backdrop, and each stepped mix toward it, still passes gate (w) (tools/palette-check.ts), so a
 * dark dragon stays readable against it (the art bible's darkness rule). Never a dragon, never a floor (FLOORS, the
 * straw's seam, the path's edge), never a light (plan G8).
 */
export const MOONLIGHT = '#5c6a9c';
/** A day colour by moonlight: half way to MOONLIGHT. */
export function moonlit(day: string): string { return mix(day, MOONLIGHT, 0.5); }

/**
 * The day colours the night moonlights (NIGHT), by what they are. A slice that adds a structure, a wall or a backdrop
 * adds its day colours here (or to NIGHT_KEEPS, with the reason it stays): gate (w) fails any WALLS / BACKDROPS / PROPS
 * colour -- and anything else it gates -- that has no NIGHT entry, and fails a floor that has one that changes it.
 */
const NIGHT_MOONLIT: readonly string[] = [
  // the walls (gate w): every room's, the bare and lift-shaft walls, the towers' dressed stone
  ...Object.values(WALLS) as string[], EMPTY_WALL, LIFT_WALL, STONE,
  // the barn's boards and timber: posts, frames, rails and trusses, the slabs under the straw and their seams, the
  // ladders, the lines on the tub and the wheel, the lift's cables; the lighter wood of the tub, pallets, wheel, trunks,
  // bench, gate leaf and window frames (gate w as props and the garden's trunks)
  '#8a6242', '#6b4a34', '#86603f', '#4e3424', '#7a5838', '#6e4a30', '#a47a52', '#5a4a40',
  // the towers' outer stone and its courses, the stone's mortar, the hearth's face (gate w) and mortar and its hood, the
  // headframe's pulleys, the Garden Gate's keystones and the garden's kerb
  '#a49c90', '#857d72', '#aaa396', PROPS.hearth, '#7c746c', '#8c847a',
  // the roof and its courses, the right tower's cone
  '#8e3b30', '#6e2a24', '#4f5f7f',
  // the elder garden behind its residents (gate w): the hedge and the trees' crowns, the lawn, the fence
  BACKDROPS.hedge, BACKDROPS.lawn, BACKDROPS.fence,
  // the ground: the earth, its grass strip and its stones
  '#7a5a40', '#86a860', '#5e7a44', '#654834',
  // the bathhouse's tile lines, the Map Room's map and its lines, the tack room's saddles
  '#a0adb6', '#e8d8a8', '#8a6a4a', '#9a5a3a',
  // the bathhouse tub's water and its bubbles (left at the day's they read as lit in the moonlit room)
  '#bfe3e0', '#dff3f1',
];
/**
 * Day colours that are the same at night, on purpose (so they are in NIGHT, mapped to themselves): the nests' and the
 * garden's mounds' straw (and the dorm's mattresses: the same colour), which is straw like the floor and keeps the egg
 * gate's contrast; the hearth's firebox and the doorways' dark, already the dark of a mouth.
 */
const NIGHT_KEEPS: readonly string[] = [NEST, PROPS.mattress, PROPS.firebox, '#3a2a26'];
/**
 * The ONE night table: a day colour to its night colour (plan S6c N4). The building (building.ts) and the garden
 * (gardenArt.ts) are drawn through it -- every fill, and the cel tones made from it -- at the night's step (sky.ts
 * lightsOf: walls), a canvas cached per step; a colour not in it (a floor, the ink, a light, a flag) is drawn as it is.
 */
export const NIGHT: Readonly<Record<string, string>> = Object.freeze(Object.fromEntries([
  ...NIGHT_MOONLIT.map((c) => [c, moonlit(c)] as const),
  ...NIGHT_KEEPS.map((c) => [c, c] as const),
]));
/** A colour at the night's step (0: the day's, 3: its NIGHT colour, 1 and 2: the stepped mixes); unchanged if NIGHT has no entry. */
export function nightColour(day: string, step: number): string {
  const n = step > 0 ? NIGHT[day] : undefined;
  return n === undefined ? day : stepped(day, n, step);
}

/** A colour stepped from `a` toward `b` by blend thirds (0: a, 3: b): the sky's three stepped mixes, never a gradient. */
export function stepped(a: string, b: string, blend: number): string {
  return blend <= 0 ? a : blend >= 3 ? b : mix(a, b, blend / 3);
}
/** A per-phase colour as the clock reads: `prev`'s, stepped into `phase`'s over the first hour of the phase. */
export function phaseColour(rec: Readonly<Record<DayPhase, string>>, c: ClockRead): string { return stepped(rec[c.prev], rec[c.phase], c.blend); }
/** The sky's three bands as the clock reads (top, middle, low). */
export function skyBands(c: ClockRead): readonly [string, string, string] {
  const a = BACKDROPS.sky[c.prev], b = BACKDROPS.sky[c.phase];
  return [stepped(a[0], b[0], c.blend), stepped(a[1], b[1], c.blend), stepped(a[2], b[2], c.blend)];
}
