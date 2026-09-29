// The world the missions go out into (docs/BASE_DESIGN.md 5): six regions, each with its climate, the challenges its
// roads hold, its signature little enemies that fight the team on them, the boss at the end of every one of them, and
// the eggs it can give; the eleven challenges and what meets each (a dragon's element for the land's, a rider's skill
// for the people's); the bosses' two counters each (fought turn by turn, never wounded: BASE_DESIGN B8, 11); the four
// keepers' rider skills; and the Map Room table's map -- each region's places (a mission's title is its place's name:
// the little landmark on the map it is met at, placeOf; the boss's lair among them) and the point its land grows from.
// Plain data: the words are missiondata.ts's (shared with the mission art and the scene), the rules are missions.ts's,
// the map's drawing worldmap.ts's.
import type { DragonElement } from '../art/dragon/palettes.ts';
import type { KeeperId } from '../art/keeper/cast.ts';
import type { RegionId, Climate, ChallengeId, Skill, BaddieId, FoeId } from './missiondata.ts';

/** What meets a challenge: a team dragon of this element, or a rider with this skill. */
export interface Counter { element?: DragonElement; skill?: Skill }

/**
 * The eleven challenges (BASE_DESIGN 5.3's table): the land's met by an element, the people's by a rider's skill. `met`
 * is the trip log's verb for the one who meets it ("PITCH DARK - WICK LIGHTS THE WAY"); `word`, a short name for a
 * chooser button (15 glyphs a line). On the road (BASE_DESIGN 11, encounter.ts) a challenge is an obstacle the team
 * works at: `it` is what the menu calls it (`STRONG ON THE FLOOD!`), `clear` what the work is for (`20 WORK TO GET
 * ACROSS`), `done` its line once cleared by plain work (`THE WATER GOES DOWN`: its counter's `met` when the counter
 * clears it), `bite` its line for a turn it still stands (the team's puff goes down), and `charmed`, for the two that
 * are somebody -- the miller and the hurt animal -- what a dragon's show-off does to them.
 */
export const CHALLENGES: Readonly<Record<ChallengeId, { name: string; word: string; counter: Counter; met: string; it: string; clear: string; done: string; bite: string; charmed?: string }>> = Object.freeze({
  dark: { name: 'PITCH DARK', word: 'DARK', counter: { element: 'dusk' }, met: 'LIGHTS THE WAY', it: 'THE DARK', clear: 'LIGHT THE WAY', done: 'THE WAY IS LIT', bite: 'THE DARK IS SLOW GOING' },
  heavy: { name: 'HEAVY LOAD', word: 'HEAVY', counter: { element: 'rock' }, met: 'CARRIES THE LOAD', it: 'THE LOAD', clear: 'SHIFT THE LOAD', done: 'THE LOAD IS SHIFTED', bite: 'THE LOAD WEIGHS ON THE TEAM' },
  cold: { name: 'THE COLD', word: 'COLD', counter: { element: 'fire' }, met: 'KEEPS EVERYONE WARM', it: 'THE COLD', clear: 'SEE THE COLD OFF', done: 'THE COLD IS SEEN OFF', bite: 'THE COLD BITES' },
  storm: { name: 'STORM', word: 'STORM', counter: { element: 'lightning' }, met: 'RIDES THE STORM OUT', it: 'THE STORM', clear: 'RIDE IT OUT', done: 'THE STORM PASSES', bite: 'THE STORM BUFFETS THE TEAM' },
  flood: { name: 'SPRING FLOOD', word: 'FLOOD', counter: { element: 'water' }, met: 'SWIMS THEM ACROSS', it: 'THE FLOOD', clear: 'GET ACROSS', done: 'THE WATER GOES DOWN', bite: 'THE FLOOD SOAKS THE TEAM' },
  thorns: { name: 'THORNS', word: 'THORNS', counter: { element: 'spike' }, met: 'PUSHES THROUGH', it: 'THE THORNS', clear: 'PUSH THROUGH', done: 'THE TANGLE IS PULLED ASIDE', bite: 'THE THORNS SNAG THE TEAM' },
  lost: { name: 'LOST THINGS', word: 'LOST', counter: { element: 'slinkwing' }, met: 'SNIFFS THEM OUT', it: 'THE SEARCH', clear: 'FIND THEM', done: 'THE LOST THINGS TURN UP', bite: 'THE SEARCH WEARS THE TEAM DOWN' },
  miller: { name: 'GRUMPY MILLER', word: 'MILLER', counter: { skill: 'charm' }, met: 'TALKS HIM ROUND', it: 'THE MILLER', clear: 'TALK HIM ROUND', done: 'THE MILLER COMES ROUND', bite: 'THE MILLER GRUMBLES ON', charmed: 'THE MILLER CRACKS A SMILE' },
  hurt: { name: 'HURT ANIMAL', word: 'HURT', counter: { skill: 'medic' }, met: 'BANDAGES IT UP', it: 'THE BIRD', clear: 'CALM IT DOWN', done: 'THE BIRD SETTLES', bite: 'THE BIRD FLUTTERS AND FRETS', charmed: 'THE BIRD PERKS UP' },
  fog: { name: 'THICK FOG', word: 'FOG', counter: { skill: 'navigator' }, met: 'FINDS THE WAY', it: 'THE FOG', clear: 'FIND THE WAY', done: 'THE FOG THINS', bite: 'THE FOG IS SLOW GOING' },
  gap: { name: 'NARROW GAP', word: 'GAP', counter: { skill: 'nimble' }, met: 'SLIPS THROUGH', it: 'THE GAP', clear: 'GET THROUGH', done: 'THE TEAM SQUEEZES THROUGH', bite: 'THE SQUEEZE WEARS THE TEAM DOWN' },
});

/**
 * The bosses (BASE_DESIGN 5.3, 11): one at the end of every road of its region, fought turn by turn (encounter.ts) and
 * never wounded (B8): worn out of puff it sits down seeing stars and runs off, and one the team can't wear out stomps
 * off unbeaten -- either way it leaves the road. Its two counters: the element strong on it (its weak spot: a breath of
 * it costs the boss more) and the rider's skill whose special wears it down. `word` is the chip's and the chooser's
 * short name ("THE MOLE KING" -> "MOLE KING").
 */
export const BADDIES: Readonly<Record<BaddieId, { name: string; word: string; counters: readonly [Counter, Counter] }>> = Object.freeze({
  bridgetroll: { name: 'THE BRIDGE TROLL', word: 'TROLL', counters: [{ element: 'spike' }, { skill: 'medic' }] },
  moleking: { name: 'THE MOLE KING', word: 'MOLE KING', counters: [{ element: 'dusk' }, { skill: 'charm' }] },
  briarboar: { name: 'THE BRIAR BOAR', word: 'BOAR', counters: [{ element: 'rock' }, { skill: 'nimble' }] },
  stormroc: { name: 'THE STORM ROC', word: 'ROC', counters: [{ element: 'lightning' }, { skill: 'navigator' }] },
  frostgiant: { name: 'THE FROST GIANT', word: 'GIANT', counters: [{ element: 'fire' }, { skill: 'nimble' }] },
  cindergolem: { name: 'THE CINDER GOLEM', word: 'GOLEM', counters: [{ element: 'water' }, { skill: 'navigator' }] },
});

/**
 * The little enemies (BASE_DESIGN 5.3, 11): each region's own kind, a pack of which fights the team between the
 * challenges of every road of its region -- a short fight by the same rules as a boss's, its puff the pack's, one of
 * them going up in a puff of smoke for each share of it worn out. `word` is the chip's short name.
 */
export const FOES: Readonly<Record<FoeId, { name: string; word: string }>> = Object.freeze({
  mudgoblin: { name: 'MUD GOBLINS', word: 'GOBLINS' },
  moleminer: { name: 'MOLE MINERS', word: 'MINERS' },
  thornsprite: { name: 'THORN SPRITES', word: 'SPRITES' },
  stormimp: { name: 'STORM IMPS', word: 'IMPS' },
  frostimp: { name: 'FROST IMPS', word: 'IMPS' },
  cinderimp: { name: 'CINDER IMPS', word: 'IMPS' },
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
  /** The boss at the end of its roads, and its signature little enemies on them. */
  baddie: BaddieId;
  foe: FoeId;
  neighbours: readonly RegionId[];
  /** Explored from the start (else revealed at the dawn after a success in a neighbour). */
  start: boolean;
  /** Mission titles (a board draws one), and a hard road's: the boss's own lair. Each names one of its places. */
  titles: readonly string[];
  baddieTitle: string;
  /** Its places on the Map Room's map: one for each title, in the same order, then the boss's lair. */
  places: readonly Place[];
  /** Its land on the Map Room's map (screen px): the point its land grows from (worldmap.ts), and where its name is written. */
  map: { site: readonly [number, number]; label: readonly [number, number] };
}

/** The little landmark a place is drawn as on the Map Room's map (worldmap.ts PLACE_ART). */
export type PlaceArt =
  | 'windmill' | 'pond' | 'bridge' | 'trollbridge'
  | 'mine' | 'lanterns' | 'cart' | 'molehall'
  | 'thicket' | 'hollow' | 'owltree' | 'boarden'
  | 'pass' | 'ridge' | 'goat' | 'crag'
  | 'iceroad' | 'falls' | 'hut' | 'gate'
  | 'cinders' | 'springs' | 'village' | 'forge';

/**
 * A place in a region (BASE_DESIGN 5.1): a little landmark on the Map Room's map where a mission is met. A mission's
 * title is its place's name (a region's `titles` and `baddieTitle`), or one of its place's `also` (day 1's LOST NEST
 * at WILLOW POND, and the names a place had in older saves' boards). `at` is the landmark's foot (screen px).
 */
export interface Place { name: string; art: PlaceArt; at: readonly [number, number]; blurb: string; also?: readonly string[] }

/** The six regions (BASE_DESIGN 5.1), in the order they are indexed (a board's difficulty draw keys on the index). */
export const REGIONS: readonly Region[] = Object.freeze([
  { id: 'millbrook', name: 'MILLBROOK', climate: 'meadow', word: 'MILD MEADOWS', pool: ['flood', 'miller', 'hurt', 'lost'], eggs: ['water', 'spike'], baddie: 'bridgetroll', foe: 'mudgoblin',
    neighbours: ['frostmere', 'bramblewood'], start: true, titles: ['THE MILL RACE', 'WILLOW POND', 'THE BROOK BRIDGE'], baddieTitle: 'UNDER THE TROLL BRIDGE',
    places: [
      { name: 'THE MILL RACE', art: 'windmill', at: [302, 251], blurb: 'HOB\'S MILL, ITS SAILS TURNING BY THE BROOK' },
      { name: 'WILLOW POND', art: 'pond', at: [186, 232], blurb: 'REEDS, DUCKS AND AN OLD WILLOW', also: ['THE LOST NEST', 'MEADOW ERRANDS'] },
      { name: 'THE BROOK BRIDGE', art: 'bridge', at: [338, 288], blurb: 'THE STONE BRIDGE ON THE ROAD EAST' },
      { name: 'UNDER THE TROLL BRIDGE', art: 'trollbridge', at: [338, 258], blurb: 'A MOSSY ARCH, AND TWO EYES IN THE DARK UNDER IT' },
    ],
    map: { site: [214, 270], label: [226, 300] } },
  { id: 'oldmine', name: 'OLD MINE ROAD', climate: 'caves', word: 'DRY HILLS AND CAVES', pool: ['dark', 'heavy', 'lost', 'gap'], eggs: ['rock', 'dusk'], baddie: 'moleking', foe: 'moleminer',
    neighbours: ['highfold', 'emberfell'], start: true, titles: ['THE DEEP SEAM', 'LANTERN RUN', 'THE OLD CART TRACK'], baddieTitle: 'THE MOLE KING\'S HALL',
    places: [
      { name: 'THE DEEP SEAM', art: 'mine', at: [424, 120], blurb: 'THE OLDEST SHAFT, STILL DEEP AND DARK' },
      { name: 'LANTERN RUN', art: 'lanterns', at: [366, 152], blurb: 'A TUNNEL LIT BY A ROW OF LAMPS' },
      { name: 'THE OLD CART TRACK', art: 'cart', at: [438, 160], blurb: 'RUSTY RAILS AND A CART NOBODY PUSHES' },
      { name: 'THE MOLE KING\'S HALL', art: 'molehall', at: [396, 100], blurb: 'MOLEHILLS, AND A DOOR WITH A CROWN ON IT' },
    ],
    map: { site: [372, 138], label: [410, 176] } },
  { id: 'bramblewood', name: 'BRAMBLEWOOD', climate: 'forest', word: 'DEEP FOREST', pool: ['thorns', 'lost', 'fog', 'hurt'], eggs: ['spike', 'slinkwing'], baddie: 'briarboar', foe: 'thornsprite',
    neighbours: ['highfold', 'millbrook'], start: true, titles: ['THE THICKET', 'MOSSY HOLLOW', 'THE OWL WOOD'], baddieTitle: 'THE BRIAR BOAR\'S DEN',
    places: [
      { name: 'THE THICKET', art: 'thicket', at: [140, 90], blurb: 'BRAMBLES AS TALL AS A DRAGON' },
      { name: 'MOSSY HOLLOW', art: 'hollow', at: [162, 164], blurb: 'A MOSSY LOG AND ITS MUSHROOMS' },
      { name: 'THE OWL WOOD', art: 'owltree', at: [80, 138], blurb: 'OLD OAKS, AND AN OWL WHO KNOWS THE WAY' },
      { name: 'THE BRIAR BOAR\'S DEN', art: 'boarden', at: [110, 104], blurb: 'A MOUND OF BRAMBLES WITH TUSKS AT ITS DOOR' },
    ],
    map: { site: [96, 128], label: [110, 186] } },
  { id: 'highfold', name: 'HIGHFOLD', climate: 'peaks', word: 'STORMY PEAKS', pool: ['storm', 'cold', 'fog', 'gap'], eggs: ['lightning', 'slinkwing'], baddie: 'stormroc', foe: 'stormimp',
    neighbours: ['oldmine', 'bramblewood', 'emberfell'], start: false, titles: ['THE HIGH PASS', 'THUNDER RIDGE', 'THE GOAT PATH'], baddieTitle: 'THE STORM ROC\'S CRAG',
    places: [
      { name: 'THE HIGH PASS', art: 'pass', at: [228, 64], blurb: 'THE WAY OVER THE PEAKS, FLAGGED WITH A CAIRN' },
      { name: 'THUNDER RIDGE', art: 'ridge', at: [320, 52], blurb: 'WHERE THE STORMS COME TO GRUMBLE' },
      { name: 'THE GOAT PATH', art: 'goat', at: [272, 118], blurb: 'A PATH ONLY THE GOATS FIND EASY' },
      { name: 'THE STORM ROC\'S CRAG', art: 'crag', at: [244, 96], blurb: 'A NEST AS BIG AS A HAYSTACK, UP HIGH' },
    ],
    map: { site: [278, 58], label: [284, 138] } },
  { id: 'frostmere', name: 'FROSTMERE', climate: 'ice', word: 'FROZEN LAKE', pool: ['cold', 'flood', 'gap', 'hurt'], eggs: ['fire', 'water'], baddie: 'frostgiant', foe: 'frostimp',
    neighbours: ['millbrook', 'emberfell'], start: false, titles: ['THE ICE ROAD', 'THE FROZEN FALLS', 'SNOWBOUND'], baddieTitle: 'THE FROST GIANT\'S PASS',
    places: [
      { name: 'THE ICE ROAD', art: 'iceroad', at: [500, 234], blurb: 'STAKES ACROSS THE FROZEN MERE' },
      { name: 'THE FROZEN FALLS', art: 'falls', at: [566, 206], blurb: 'A WATERFALL, FROZEN MID-SPLASH', also: ['THE THAW'] },
      { name: 'SNOWBOUND', art: 'hut', at: [532, 264], blurb: 'A HUT UNDER THE SNOW, ITS CHIMNEY SMOKING' },
      { name: 'THE FROST GIANT\'S PASS', art: 'gate', at: [446, 290], blurb: 'TWO WALLS OF ICE, AND GIANT FOOTPRINTS' },
    ],
    map: { site: [500, 255], label: [470, 305] } },
  { id: 'emberfell', name: 'EMBERFELL', climate: 'ash', word: 'WARM ASH HILLS', pool: ['heavy', 'dark', 'storm', 'miller'], eggs: ['fire', 'lightning', 'dusk'], baddie: 'cindergolem', foe: 'cinderimp',
    neighbours: ['highfold', 'frostmere', 'oldmine'], start: false, titles: ['THE CINDER FIELDS', 'THE HOT SPRINGS', 'ASHFALL'], baddieTitle: 'THE GOLEM\'S FORGE',
    places: [
      { name: 'THE CINDER FIELDS', art: 'cinders', at: [517, 84], blurb: 'WARM BLACK ROCKS, STILL GLOWING' },
      { name: 'THE HOT SPRINGS', art: 'springs', at: [588, 114], blurb: 'STEAMING POOLS, JUST RIGHT FOR A BATH' },
      { name: 'ASHFALL', art: 'village', at: [516, 132], blurb: 'A VILLAGE UNDER THE SMOKING HILLS' },
      { name: 'THE GOLEM\'S FORGE', art: 'forge', at: [546, 134], blurb: 'A FORGE IN THE ROCK, ITS FIRE NEVER OUT' },
    ],
    map: { site: [545, 95], label: [548, 160] } },
] as Region[]);

export const REGION_IDS = Object.freeze(REGIONS.map((r) => r.id));
/** A region by id. */
export function regionOf(id: RegionId): Region { return REGIONS.find((r) => r.id === id)!; }

/**
 * Where a mission is met on the map: the place in its region named by its title, or the place whose `also` names it
 * (THE LOST NEST, or an older save's title); failing both, the region's first place.
 */
export function placeOf(m: { region: RegionId; title: string }): Place {
  const r = regionOf(m.region);
  return r.places.find((p) => p.name === m.title) ?? r.places.find((p) => p.also?.includes(m.title)) ?? r.places[0];
}

/** Where HOME (the barn) stands on the map (the landmark's foot, screen px): each start region's road runs from it. */
export const MAP_HOME: readonly [number, number] = Object.freeze([64, 262]);
