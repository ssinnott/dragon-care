// The world the missions go out into (docs/BASE_DESIGN.md 5): six regions, each with its climate, the challenges its
// roads hold, the little enemies that fight the team on them, the boss at the end of every one of them, and the eggs it
// can give; the eleven challenges and what meets each (a dragon's element for the land's, a rider's skill for the
// people's); the bosses' might and weak spots (BASE_DESIGN 5.3: fought, B8); the four keepers' rider skills; and the
// Map Room table's map (each region's land and its pin). Plain data: the words are missiondata.ts's (shared with the
// mission art and the scene), the rules are missions.ts's.
import type { DragonElement } from '../art/dragon/palettes.ts';
import type { KeeperId } from '../art/keeper/cast.ts';
import type { RegionId, Climate, ChallengeId, Skill, BaddieId, FoeId } from './missiondata.ts';

/** What meets a challenge: a team dragon of this element, or a rider with this skill. */
export interface Counter { element?: DragonElement; skill?: Skill }

/**
 * The eleven challenges (BASE_DESIGN 5.3's table): the land's met by an element, the people's by a rider's skill. `met`
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
 * The bosses (BASE_DESIGN 5.3, 6): one at the end of every road of its region, fought (B8). The team beats one when its
 * power reaches the boss's might (missions.ts powerOf: a dragon's stage, and more from one of the element the boss is
 * weak to: `weak`, its weak spot); `word` is the chooser's short name ("THE MOLE KING" -> "MOLE KING").
 */
export const BADDIES: Readonly<Record<BaddieId, { name: string; word: string; weak: DragonElement }>> = Object.freeze({
  bridgetroll: { name: 'THE BRIDGE TROLL', word: 'TROLL', weak: 'spike' },
  moleking: { name: 'THE MOLE KING', word: 'MOLE KING', weak: 'dusk' },
  briarboar: { name: 'THE BRIAR BOAR', word: 'BOAR', weak: 'rock' },
  stormroc: { name: 'THE STORM ROC', word: 'ROC', weak: 'lightning' },
  frostgiant: { name: 'THE FROST GIANT', word: 'GIANT', weak: 'fire' },
  cindergolem: { name: 'THE CINDER GOLEM', word: 'GOLEM', weak: 'water' },
});

/** The little enemies (BASE_DESIGN 5.3, 6): a pack of them fights the team between the challenges of every road of their region, and is always beaten. */
export const FOES: Readonly<Record<FoeId, { name: string }>> = Object.freeze({
  mudgoblin: { name: 'MUD GOBLINS' },
  moleminer: { name: 'MOLE MINERS' },
  thornsprite: { name: 'THORN SPRITES' },
  stormimp: { name: 'STORM IMPS' },
  frostimp: { name: 'FROST IMPS' },
  cinderimp: { name: 'CINDER IMPS' },
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
  /** The boss at the end of its roads, and the little enemies on them. */
  baddie: BaddieId;
  foe: FoeId;
  neighbours: readonly RegionId[];
  /** Explored from the start (else revealed at the dawn after a success in a neighbour). */
  start: boolean;
  /** Mission titles (a board draws one), and a hard road's: the boss's own ground. */
  titles: readonly string[];
  baddieTitle: string;
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

/** The six regions (BASE_DESIGN 5.1), in the order they are indexed (a board's difficulty draw keys on the index). */
export const REGIONS: readonly Region[] = Object.freeze([
  { id: 'millbrook', name: 'MILLBROOK', climate: 'meadow', word: 'MILD MEADOWS', pool: ['flood', 'miller', 'hurt', 'lost'], eggs: ['water', 'spike'], baddie: 'bridgetroll', foe: 'mudgoblin',
    neighbours: ['frostmere', 'bramblewood'], start: true, titles: ['THE MILL RACE', 'MEADOW ERRANDS', 'THE BROOK BRIDGE'], baddieTitle: 'UNDER THE TROLL BRIDGE',
    map: land(262, 266, 70, 44, [1.0, 0.92, 1.05, 0.96, 1.08, 0.94, 1.0, 1.06, 0.9, 1.02]) },
  { id: 'oldmine', name: 'OLD MINE ROAD', climate: 'caves', word: 'DRY HILLS AND CAVES', pool: ['dark', 'heavy', 'lost', 'gap'], eggs: ['rock', 'dusk'], baddie: 'moleking', foe: 'moleminer',
    neighbours: ['highfold', 'emberfell'], start: true, titles: ['THE DEEP SEAM', 'LANTERN RUN', 'THE OLD CART TRACK'], baddieTitle: 'THE MOLE KING\'S HALL',
    map: land(410, 186, 64, 42, [0.95, 1.05, 0.9, 1.04, 0.98, 1.08, 0.92, 1.0, 1.06, 0.94]) },
  { id: 'bramblewood', name: 'BRAMBLEWOOD', climate: 'forest', word: 'DEEP FOREST', pool: ['thorns', 'lost', 'fog', 'hurt'], eggs: ['spike', 'slinkwing'], baddie: 'briarboar', foe: 'thornsprite',
    neighbours: ['highfold', 'millbrook'], start: true, titles: ['THE THICKET', 'MOSSY HOLLOW', 'THE OWL WOOD'], baddieTitle: 'THE BRIAR BOAR\'S DEN',
    map: land(168, 150, 68, 46, [1.04, 0.94, 1.0, 1.08, 0.92, 1.0, 1.06, 0.95, 1.02, 0.9]) },
  { id: 'highfold', name: 'HIGHFOLD', climate: 'peaks', word: 'STORMY PEAKS', pool: ['storm', 'cold', 'fog', 'gap'], eggs: ['lightning', 'slinkwing'], baddie: 'stormroc', foe: 'stormimp',
    neighbours: ['oldmine', 'bramblewood', 'emberfell'], start: false, titles: ['THE HIGH PASS', 'THUNDER RIDGE', 'THE GOAT PATH'], baddieTitle: 'THE STORM ROC\'S CRAG',
    map: land(322, 94, 66, 42, [0.92, 1.06, 1.0, 0.94, 1.08, 0.96, 1.02, 0.9, 1.05, 1.0]) },
  { id: 'frostmere', name: 'FROSTMERE', climate: 'ice', word: 'FROZEN LAKE', pool: ['cold', 'flood', 'gap', 'hurt'], eggs: ['fire', 'water'], baddie: 'frostgiant', foe: 'frostimp',
    neighbours: ['millbrook', 'emberfell'], start: false, titles: ['THE ICE ROAD', 'THE THAW', 'SNOWBOUND'], baddieTitle: 'THE FROST GIANT\'S PASS',
    map: land(488, 266, 66, 42, [1.02, 0.96, 1.06, 0.92, 1.0, 1.04, 0.94, 1.08, 0.96, 1.0]) },
  { id: 'emberfell', name: 'EMBERFELL', climate: 'ash', word: 'WARM ASH HILLS', pool: ['heavy', 'dark', 'storm', 'miller'], eggs: ['fire', 'lightning', 'dusk'], baddie: 'cindergolem', foe: 'cinderimp',
    neighbours: ['highfold', 'frostmere', 'oldmine'], start: false, titles: ['THE CINDER FIELDS', 'THE HOT SPRINGS', 'ASHFALL'], baddieTitle: 'THE GOLEM\'S FORGE',
    map: land(548, 116, 58, 44, [0.96, 1.04, 0.92, 1.06, 1.0, 0.94, 1.08, 1.0, 0.9, 1.04]) },
] as Region[]);

export const REGION_IDS = Object.freeze(REGIONS.map((r) => r.id));
/** A region by id. */
export function regionOf(id: RegionId): Region { return REGIONS.find((r) => r.id === id)!; }

/** Where HOME (the barn) sits on the map, and each start region's road runs from it. */
export const MAP_HOME: readonly [number, number] = Object.freeze([52, 300]);
/** Each climate's land on the map: its flat fill (a 2-band cel: this and its shadow tone below). */
export const MAP_FILL: Readonly<Record<Climate, string>> = Object.freeze({ meadow: '#a8cc80', caves: '#cfae80', forest: '#7fa866', peaks: '#aab6cc', ice: '#d6e6ee', ash: '#d49a84' });
