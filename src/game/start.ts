// The base a new game starts from, and the one view=base and tools/sim-check.ts run: the need rooms, repeated on the
// floors (a room meets one need, and a need's rooms repeat: plan S6b), the hatchery, the riders' rooms and the Garden
// Gate (docs/BASE_DESIGN.md 3), seven dragons -- one of each element, every one newly adult, 0 days into the stage (#9:
// "start with a young adult dragon of each kind"; BASE_DESIGN's Decisions: *young adult* is the adult stage's first
// day), each in a slot of its own need's room -- and the four named keepers, each at a fixed station. Views that need
// other stages build their own casts (src/game/presets.ts).
import type { RoomPlace, RoomKind } from './layout.ts';
import type { NeedKind } from './needs.ts';
import type { DragonElement } from '../art/dragon/palettes.ts';
import type { Stage } from '../art/dragon/stages.ts';
import type { KeeperId } from '../art/keeper/cast.ts';

export const START_ROOMS: readonly RoomPlace[] = [
  // the barn (plan S6b, "fewer floor changes"): each room meets one need, and the need rooms are repeated so that a
  // dragon's needs are met on the floor it stands on -- the ground and upper floors have all five, one module each; the
  // hayloft has food, love and sleep, and the Hatchery in its west corner, under the roof's low slope (babies fit there,
  // tail to the slope; a grown dragon does not); module 2 on every floor is the Dragon Lift, and the hayloft's module 5
  // (under the east slope) is bare. A room's id is its index here (0-13 the barn's)
  { kind: 'kitchen', part: 'barn', floor: 0, mod: 0 },
  { kind: 'groom', part: 'barn', floor: 0, mod: 1 },
  { kind: 'bath', part: 'barn', floor: 0, mod: 3 },
  { kind: 'romp', part: 'barn', floor: 0, mod: 4 },
  { kind: 'dorm', part: 'barn', floor: 0, mod: 5 },
  { kind: 'hatchery', part: 'barn', floor: 2, mod: 0 },
  { kind: 'kitchen', part: 'barn', floor: 1, mod: 0 },
  { kind: 'romp', part: 'barn', floor: 1, mod: 1 },
  { kind: 'groom', part: 'barn', floor: 1, mod: 3 },
  { kind: 'bath', part: 'barn', floor: 1, mod: 4 },
  { kind: 'dorm', part: 'barn', floor: 1, mod: 5 },
  { kind: 'kitchen', part: 'barn', floor: 2, mod: 1 },
  { kind: 'groom', part: 'barn', floor: 2, mod: 3 },
  { kind: 'dorm', part: 'barn', floor: 2, mod: 4 },
  // the left tower: the riders' rooms (its floors 1 and 3 are bare)
  { kind: 'tack', part: 'towerL', floor: 0 },
  { kind: 'bunks', part: 'towerL', floor: 2 },
  { kind: 'maproom', part: 'towerL', floor: 4 },
  // the right tower's ground floor: the Garden Gate, the dragons' way out to the elder garden (its floors 1-4 are bare)
  { kind: 'gate', part: 'towerR', floor: 0 },
];

/**
 * A dragon at home: which slot it stands in (a room kind -- the `n`th room of that kind, default the first -- and the
 * index into its slots: layout.ts slotsOf; it faces the slot's way), and `days`, how far into its stage it is (game days, default 0:
 * the stage has just begun).
 */
export interface DragonPlace { name: string; element: DragonElement; stage: Stage; seed: number; slot: { room: RoomKind; i: number; n?: number }; days?: number }
/**
 * One of each element, in the art bible's order, every one at the very start of the adult stage (ids 0-6 in this
 * order), each in a slot of its own need's room: fire's food in the kitchen, water's bath in the bathhouse,
 * lightning's play in the romp room, the love of spike, rock and slinkwing in the grooming parlour, dusk's sleep in
 * the lamp dorm.
 */
export const START_DRAGONS: readonly DragonPlace[] = [
  { name: 'EMBER', element: 'fire', stage: 'adult', seed: 11, slot: { room: 'kitchen', i: 0 }, days: 0 },
  { name: 'BRAMBLE', element: 'spike', stage: 'adult', seed: 164, slot: { room: 'groom', i: 0 }, days: 0 },
  { name: 'COBBLE', element: 'rock', stage: 'adult', seed: 215, slot: { room: 'groom', i: 0, n: 1 }, days: 0 },
  { name: 'ZAP', element: 'lightning', stage: 'adult', seed: 113, slot: { room: 'romp', i: 0, n: 1 }, days: 0 },
  { name: 'RIPPLE', element: 'water', stage: 'adult', seed: 79, slot: { room: 'bath', i: 0 }, days: 0 },
  { name: 'ECHO', element: 'slinkwing', stage: 'adult', seed: 266, slot: { room: 'groom', i: 0, n: 2 }, days: 0 },
  { name: 'WICK', element: 'dusk', stage: 'adult', seed: 181, slot: { room: 'dorm', i: 0 }, days: 0 },
];

/**
 * A keeper: which of the four named cast (docs/KEEPERS.md 2) they are, the need they're best at (4.4) and the room
 * they wait in, their station (the nth of its kind: fixed, plan S6b -- BEA the ground floor's kitchen, TOMAS the upper
 * floor's grooming parlour, PIP its romp room, IRIS the hayloft's lamp dorm; the supplies come from whichever hearth,
 * tub or ball box makes a job's trip shortest: sim.ts). Bea, Tomas, Iris and Pip -- the base's one job each, same as the yard's -- with Pip, the
 * apprentice who "pets the babies and cheers the others on", standing in for play; nobody specialises in a bath (no
 * named keeper has one), so the nearest free keeper takes it (sim.ts's assign: a specialist is a preference, not a rule).
 */
export interface KeeperPlace { name: string; look: KeeperId; specialty: NeedKind | null; station: RoomKind; /** The station is the `n`th room of its kind (START_ROOMS order; default the first). */ n?: number }
export const START_KEEPERS: readonly KeeperPlace[] = [
  { name: 'BEA', look: 'bea', specialty: 'food', station: 'kitchen' },
  { name: 'TOMAS', look: 'tomas', specialty: 'love', station: 'groom', n: 1 },
  { name: 'IRIS', look: 'iris', specialty: 'sleep', station: 'dorm', n: 2 },
  { name: 'PIP', look: 'pip', specialty: 'play', station: 'romp', n: 1 },
];
