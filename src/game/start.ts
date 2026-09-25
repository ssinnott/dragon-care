// The base a new game starts from, and the one view=base and tools/sim-check.ts run: the greybox mockups' rooms
// (docs/base/), twelve dragons -- every element and every stage among them -- and five keepers.
import type { RoomPlace, RoomKind } from './layout.ts';
import type { NeedKind } from './needs.ts';
import type { DragonElement } from '../art/dragon/palettes.ts';
import type { Stage } from '../art/dragon/stages.ts';

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

/** A dragon at home: its room (the first of that kind), where it stands across the room (0..1) and which way it faces. */
export interface DragonPlace { name: string; element: DragonElement; stage: Stage; seed: number; room: RoomKind; at: number; facing: 1 | -1 }
export const START_DRAGONS: readonly DragonPlace[] = [
  { name: 'EMBER', element: 'fire', stage: 'adult', seed: 11, room: 'kitchen', at: 0.62, facing: 1 },
  { name: 'CINDER', element: 'fire', stage: 'baby', seed: 28, room: 'kitchen', at: 0.9, facing: -1 },
  { name: 'PEBBLE', element: 'rock', stage: 'baby', seed: 62, room: 'hatchery', at: 0.78, facing: -1 },
  { name: 'RIPPLE', element: 'water', stage: 'adult', seed: 79, room: 'bath', at: 0.3, facing: 1 },
  { name: 'ZAP', element: 'lightning', stage: 'young', seed: 113, room: 'romp', at: 0.4, facing: 1 },
  { name: 'BURR', element: 'spike', stage: 'baby', seed: 45, room: 'romp', at: 0.64, facing: -1 },
  { name: 'SPLASH', element: 'water', stage: 'young', seed: 147, room: 'romp', at: 0.87, facing: -1 },
  { name: 'BRAMBLE', element: 'spike', stage: 'adult', seed: 164, room: 'groom', at: 0.38, facing: 1 },
  { name: 'WICK', element: 'dusk', stage: 'adult', seed: 181, room: 'dorm', at: 0.28, facing: 1 },
  { name: 'ASH', element: 'fire', stage: 'elder', seed: 198, room: 'dorm', at: 0.8, facing: -1 },
  { name: 'COBBLE', element: 'rock', stage: 'elder', seed: 215, room: 'sunloft', at: 0.55, facing: 1 },
  { name: 'ECHO', element: 'slinkwing', stage: 'adult', seed: 266, room: 'roost', at: 0.35, facing: 1 },
];

/** A keeper: their look (people.ts), the need they're best at (4.4) and the room they wait in (its post). */
export interface KeeperPlace { name: string; look: string; specialty: NeedKind | null; station: RoomKind }
export const START_KEEPERS: readonly KeeperPlace[] = [
  { name: 'MARTA', look: 'cook', specialty: 'food', station: 'kitchen' },
  { name: 'TAM', look: 'groom', specialty: 'love', station: 'groom' },
  { name: 'ROSA', look: 'handler', specialty: 'play', station: 'romp' },
  { name: 'BEN', look: 'hand', specialty: null, station: 'mess' },
  { name: 'ODA', look: 'hand2', specialty: 'bath', station: 'library' },
];
