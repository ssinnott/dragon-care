// The world the missions go out into (docs/BASE_DESIGN.md 5; plan S8): six regions, each with its climate, the
// challenges its roads hold, the eggs it can give and (three of them) a big baddie at the end of a hard road; the
// eleven challenges and what meets each (a dragon's element for the land's, a rider's skill for the people's); the
// baddies' two counters each and their cozy exits (D4, B8: calmed, outwitted or driven off -- never fought, and nobody
// is hurt); the four keepers' rider skills; and the Map Room table's map (each region's land and its pin). Plain data:
// the words are missiondata.ts's (shared with the mission art and the scene), the rules are missions.ts's.
import type { DragonElement } from '../art/dragon/palettes.ts';
import type { KeeperId } from '../art/keeper/cast.ts';
import type { RegionId, Climate, ChallengeId, Skill, BaddieId, BaddieExit } from './missiondata.ts';

/** What meets a challenge: a team dragon of this element, or a rider with this skill. */
export interface Counter { element?: DragonElement; skill?: Skill }

/**
 * The eleven challenges (plan S8's counters table): the land's met by an element, the people's by a rider's skill. `met`
 * is the trip log's verb for the one who meets it ("PITCH DARK - WICK LIGHTS THE WAY"); `word`, a short name for a
 * chooser button (15 glyphs a line).
 */
export const CHALLENGES: Readonly<Record<ChallengeId, { name: string; word: string; counter: Counter; met: string }>> = Object.freeze({
  dark: { name: 'PITCH DARK', word: 'DARK', counter: { element: 'dusk' }, met: 'LIGHTS THE WAY' },
  heavy: { name: 'HEAVY LOAD', word: 'HEAVY', counter: { element: 'rock' }, met: 'CARRIES THE LOAD' },
  cold: { name: 'THE COLD', word: 'COLD', counter: { element: 'fire' }, met: 'KEEPS EVERYONE WARM' },
  storm: { name: 'STORM', word: 'STORM', counter: { element: 'lightning' }, met: 'RIDES THE STORM OUT' },
  flood: { name: 'SPRING FLOOD', word: 'FLOOD', counter: { element: 'water' }, met: 'SWIMS THEM ACROSS' },
  thorns: { name: 'THORNS', word: 'THORNS', counter: { element: 'spike' }, met: 'PUSHES THROUGH' },
  lost: { name: 'LOST THINGS', word: 'LOST', counter: { element: 'slinkwing' }, met: 'SNIFFS THEM OUT' },
  miller: { name: 'GRUMPY MILLER', word: 'MILLER', counter: { skill: 'charm' }, met: 'TALKS HIM ROUND' },
  hurt: { name: 'HURT ANIMAL', word: 'HURT', counter: { skill: 'medic' }, met: 'BANDAGES IT UP' },
  fog: { name: 'THICK FOG', word: 'FOG', counter: { skill: 'navigator' }, met: 'FINDS THE WAY' },
  gap: { name: 'NARROW GAP', word: 'GAP', counter: { skill: 'nimble' }, met: 'SLIPS THROUGH' },
});

/**
 * The big baddies (plan S8, P14): each needs both of its counters on the team (a dragon's element and a rider's skill),
 * and leaves the road its own cozy way on a success (D4). There is no hurt state anywhere in this data.
 */
export const BADDIES: Readonly<Record<BaddieId, { name: string; counters: readonly [Counter, Counter]; exit: BaddieExit; how: string }>> = Object.freeze({
  moleking: { name: 'THE MOLE KING', counters: [{ element: 'dusk' }, { skill: 'charm' }], exit: 'calmed', how: 'CURLS UP AND DOZES' },
  stormroc: { name: 'THE STORM ROC', counters: [{ element: 'lightning' }, { skill: 'navigator' }], exit: 'outwitted', how: 'WANDERS OFF THE WRONG WAY' },
  frostgiant: { name: 'THE FROST GIANT', counters: [{ element: 'fire' }, { skill: 'nimble' }], exit: 'drivenOff', how: 'GRUMBLES OFF TO COLDER HILLS' },
});

/** The four keepers ride with these skills (docs/KEEPERS.md 2): Bea charms, Tomas mends, Iris finds the way, Pip slips through. */
export const KEEPER_SKILL: Readonly<Record<KeeperId, Skill>> = Object.freeze({ bea: 'charm', tomas: 'medic', iris: 'navigator', pip: 'nimble' });
/** A skill's name, as the chooser writes it ("NEEDS: CHARM"). */
export const SKILL_NAME: Readonly<Record<Skill, string>> = Object.freeze({ charm: 'CHARM', medic: 'MEDIC', navigator: 'NAVIGATOR', nimble: 'NIMBLE' });

export interface Region {
  id: RegionId;
  name: string;
  climate: Climate;
  /** The climate in words (the chooser's `REGION - WORD`). */
  word: string;
  /** The challenges its roads hold (drawn from without replacement). */
  pool: readonly ChallengeId[];
  /** The elements of the eggs it gives. */
  eggs: readonly DragonElement[];
  baddie: BaddieId | null;
  neighbours: readonly RegionId[];
  /** Explored from the start (else revealed at the dawn after a success in a neighbour). */
  start: boolean;
  /** Mission titles (a board draws one), and a hard road's title when it ends in the baddie. */
  titles: readonly string[];
  baddieTitle?: string;
  /** Its land on the Map Room's map (screen px, the map panel's own: an outline's x, y pairs) and its pin's point. */
  map: { poly: readonly number[]; pin: readonly [number, number] };
}

/** An irregular land around (cx, cy): ten points on an ellipse rx x ry, each pushed in or out by its own factor (fixed: the map never changes). */
function land(cx: number, cy: number, rx: number, ry: number, k: readonly number[]): { poly: number[]; pin: [number, number] } {
  const poly: number[] = [];
  for (let i = 0; i < k.length; i++) {
    const a = (i / k.length) * Math.PI * 2 - Math.PI / 2;
    poly.push(Math.round(cx + Math.cos(a) * rx * k[i]), Math.round(cy + Math.sin(a) * ry * k[i]));
  }
  return { poly, pin: [cx, cy] };
}

/** The six regions (plan S8's table), in the order they are indexed (a board's difficulty draw keys on the index). */
export const REGIONS: readonly Region[] = Object.freeze([
  { id: 'millbrook', name: 'MILLBROOK', climate: 'meadow', word: 'MILD MEADOWS', pool: ['flood', 'miller', 'hurt', 'lost'], eggs: ['water', 'spike'], baddie: null,
    neighbours: ['frostmere', 'bramblewood'], start: true, titles: ['THE MILL RACE', 'MEADOW ERRANDS', 'THE BROOK BRIDGE'],
    map: land(262, 266, 70, 44, [1.0, 0.92, 1.05, 0.96, 1.08, 0.94, 1.0, 1.06, 0.9, 1.02]) },
  { id: 'oldmine', name: 'OLD MINE ROAD', climate: 'caves', word: 'DRY HILLS AND CAVES', pool: ['dark', 'heavy', 'lost', 'gap'], eggs: ['rock', 'dusk'], baddie: 'moleking',
    neighbours: ['highfold', 'emberfell'], start: true, titles: ['THE DEEP SEAM', 'LANTERN RUN', 'THE OLD CART TRACK'], baddieTitle: 'THE MOLE KING\'S HALL',
    map: land(410, 186, 64, 42, [0.95, 1.05, 0.9, 1.04, 0.98, 1.08, 0.92, 1.0, 1.06, 0.94]) },
  { id: 'bramblewood', name: 'BRAMBLEWOOD', climate: 'forest', word: 'DEEP FOREST', pool: ['thorns', 'lost', 'fog', 'hurt'], eggs: ['spike', 'slinkwing'], baddie: null,
    neighbours: ['highfold', 'millbrook'], start: true, titles: ['THE THICKET', 'MOSSY HOLLOW', 'THE OWL WOOD'],
    map: land(168, 150, 68, 46, [1.04, 0.94, 1.0, 1.08, 0.92, 1.0, 1.06, 0.95, 1.02, 0.9]) },
  { id: 'highfold', name: 'HIGHFOLD', climate: 'peaks', word: 'STORMY PEAKS', pool: ['storm', 'cold', 'fog', 'gap'], eggs: ['lightning', 'slinkwing'], baddie: 'stormroc',
    neighbours: ['oldmine', 'bramblewood', 'emberfell'], start: false, titles: ['THE HIGH PASS', 'THUNDER RIDGE', 'THE GOAT PATH'], baddieTitle: 'THE STORM ROC\'S CRAG',
    map: land(322, 94, 66, 42, [0.92, 1.06, 1.0, 0.94, 1.08, 0.96, 1.02, 0.9, 1.05, 1.0]) },
  { id: 'frostmere', name: 'FROSTMERE', climate: 'ice', word: 'FROZEN LAKE', pool: ['cold', 'flood', 'gap', 'hurt'], eggs: ['fire', 'water'], baddie: 'frostgiant',
    neighbours: ['millbrook', 'emberfell'], start: false, titles: ['THE ICE ROAD', 'THE THAW', 'SNOWBOUND'], baddieTitle: 'THE FROST GIANT\'S PASS',
    map: land(488, 266, 66, 42, [1.02, 0.96, 1.06, 0.92, 1.0, 1.04, 0.94, 1.08, 0.96, 1.0]) },
  { id: 'emberfell', name: 'EMBERFELL', climate: 'ash', word: 'WARM ASH HILLS', pool: ['heavy', 'dark', 'storm', 'miller'], eggs: ['fire', 'lightning', 'dusk'], baddie: null,
    neighbours: ['highfold', 'frostmere', 'oldmine'], start: false, titles: ['THE CINDER FIELDS', 'THE HOT SPRINGS', 'ASHFALL'],
    map: land(548, 116, 58, 44, [0.96, 1.04, 0.92, 1.06, 1.0, 0.94, 1.08, 1.0, 0.9, 1.04]) },
] as Region[]);

export const REGION_IDS = Object.freeze(REGIONS.map((r) => r.id));
/** A region by id. */
export function regionOf(id: RegionId): Region { return REGIONS.find((r) => r.id === id)!; }

/** Where HOME (the barn) sits on the map, and each start region's road runs from it. */
export const MAP_HOME: readonly [number, number] = Object.freeze([52, 300]);
/** Each climate's land on the map: its flat fill (a 2-band cel: this and its shadow tone below). */
export const MAP_FILL: Readonly<Record<Climate, string>> = Object.freeze({ meadow: '#a8cc80', caves: '#cfae80', forest: '#7fa866', peaks: '#aab6cc', ice: '#d6e6ee', ash: '#d49a84' });
