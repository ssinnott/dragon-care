// The colours the base's people and dragons stand on and are seen against (docs/BASE_DESIGN.md 1, 2). Every surface a
// dragon or a keeper stands on -- a room's straw band, the lift car's deck, the landings, the ladder bay's floors, the
// towers' floors, the Aerie deck and its gantry -- is one of FLOORS, and tools/palette-check.ts gates every entry
// before anything stands on it: >= 25 % in luminance from every dragon body and belly colour at every stage (gate i),
// from every keeper's shoes and trousers (gate Ki), and HSV saturation under 0.20 (hue never helps on a floor). A
// room's identity is its wall and its props, never its floor. Plain data: no drawing, safe to import from Node.

/** The house outline (ART_BIBLE 1.1). */
export const INK = '#1a1018';

/** Every floor anyone stands on, by name. Later slices add their own (the garden path, the mission road). */
export const FLOORS = Object.freeze({
  /** Pale straw, the reference habitat floor (ART_BIBLE 5.4): L 0.674, S 0.18. */
  straw: '#e0d6b8',
});
export type FloorName = keyof typeof FLOORS;

/** The seams drawn over a straw floor: its top edge, and the towers' boards (a 1 px line, not a surface). */
export const STRAW_SEAM = '#c9bd9c';

/** The back wall of a barn slot no room fills, and of the keepers' ladder bay (L 0.26). */
export const EMPTY_WALL = '#9a8a76';
/** The Dragon Lift's shaft wall, in the barn and above its roof (L 0.32). */
export const LIFT_WALL = '#a8987e';
