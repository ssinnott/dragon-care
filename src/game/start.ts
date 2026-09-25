// The base a new game starts from, and the one view=base and tools/sim-check.ts run: the greybox mockups' rooms
// (docs/base/), seven dragons -- one of each element, every one newly adult, 0 days into the stage (#9: "start with a
// young adult dragon of each kind"; BASE_DESIGN's Decisions: *young adult* is the adult stage's first day) -- and the
// four named keepers. Views that need other stages build their own casts (src/game/presets.ts).
import type { RoomPlace, RoomKind } from './layout.ts';
import type { NeedKind } from './needs.ts';
import type { DragonElement } from '../art/dragon/palettes.ts';
import type { Stage } from '../art/dragon/stages.ts';
import type { KeeperId } from '../art/keeper/cast.ts';

export const START_ROOMS: readonly RoomPlace[] = [
  { kind: 'kitchen', part: 'barn', floor: 0, mod: 0, width: 2 },
  { kind: 'hatchery', part: 'barn', floor: 0, mod: 2 },
  { kind: 'bath', part: 'barn', floor: 0, mod: 3, width: 2 },
  { kind: 'store', part: 'barn', floor: 0, mod: 5 },
  { kind: 'romp', part: 'barn', floor: 1, mod: 0, width: 3 },
  { kind: 'groom', part: 'barn', floor: 1, mod: 3 },
  { kind: 'dorm', part: 'barn', floor: 1, mod: 4, width: 2 },
  { kind: 'sunloft', part: 'barn', floor: 2, mod: 0, width: 2 },
  { kind: 'haystore', part: 'barn', floor: 2, mod: 2 },
  { kind: 'roost', part: 'barn', floor: 2, mod: 3, width: 2 },
  { kind: 'attic', part: 'barn', floor: 2, mod: 5 },
  { kind: 'tack', part: 'towerL', floor: 0 },
  { kind: 'mess', part: 'towerL', floor: 1 },
  { kind: 'bunks', part: 'towerL', floor: 2 },
  { kind: 'bunks', part: 'towerL', floor: 3 },
  { kind: 'maproom', part: 'towerL', floor: 4 },
  { kind: 'infirmary', part: 'towerR', floor: 0 },
  { kind: 'library', part: 'towerR', floor: 1 },
  { kind: 'bunks', part: 'towerR', floor: 2 },
  { kind: 'workshop', part: 'towerR', floor: 3 },
  { kind: 'lookout', part: 'towerR', floor: 4 },
];

/**
 * A dragon at home: its room (the first of that kind), where it stands across the room (0..1) and which way it faces;
 * `days` is how far into its stage it is (game days, default 0: the stage has just begun).
 */
export interface DragonPlace { name: string; element: DragonElement; stage: Stage; seed: number; room: RoomKind; at: number; facing: 1 | -1; days?: number }
/** One of each element, in the art bible's order, every one at the very start of the adult stage (ids 0-6 in this order). */
export const START_DRAGONS: readonly DragonPlace[] = [
  { name: 'EMBER', element: 'fire', stage: 'adult', seed: 11, room: 'kitchen', at: 0.62, facing: 1, days: 0 },
  { name: 'BRAMBLE', element: 'spike', stage: 'adult', seed: 164, room: 'groom', at: 0.38, facing: 1, days: 0 },
  { name: 'COBBLE', element: 'rock', stage: 'adult', seed: 215, room: 'sunloft', at: 0.55, facing: 1, days: 0 },
  { name: 'ZAP', element: 'lightning', stage: 'adult', seed: 113, room: 'romp', at: 0.4, facing: 1, days: 0 },
  { name: 'RIPPLE', element: 'water', stage: 'adult', seed: 79, room: 'bath', at: 0.3, facing: 1, days: 0 },
  { name: 'ECHO', element: 'slinkwing', stage: 'adult', seed: 266, room: 'roost', at: 0.35, facing: 1, days: 0 },
  { name: 'WICK', element: 'dusk', stage: 'adult', seed: 181, room: 'dorm', at: 0.28, facing: 1, days: 0 },
];

/**
 * A keeper: which of the four named cast (docs/KEEPERS.md 2) they are, the need they're best at (4.4) and the room
 * they wait in (its post). Bea, Tomas, Iris and Pip -- the base's one job each, same as the yard's -- with Pip, the
 * apprentice who "pets the babies and cheers the others on", standing in for play; nobody specialises in a bath (no
 * named keeper has one), so the nearest free keeper takes it (sim.ts's assign: a specialist is a preference, not a rule).
 */
export interface KeeperPlace { name: string; look: KeeperId; specialty: NeedKind | null; station: RoomKind }
export const START_KEEPERS: readonly KeeperPlace[] = [
  { name: 'BEA', look: 'bea', specialty: 'food', station: 'kitchen' },
  { name: 'TOMAS', look: 'tomas', specialty: 'love', station: 'groom' },
  { name: 'IRIS', look: 'iris', specialty: 'sleep', station: 'dorm' },
  { name: 'PIP', look: 'pip', specialty: 'play', station: 'romp' },
];
