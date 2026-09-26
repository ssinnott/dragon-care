// A mission and a team's trip (docs/BASE_DESIGN.md 5; plan S8 and S9): plain data, JSON-safe, every reference an
// id. missions.ts makes and steps them (S8); the watchable scene (missionview.ts, S9) is a pure function of a Trip
// and the sim's clock, and never changes one.
import type { DragonElement } from '../art/dragon/palettes.ts';
import type { RegionId, ChallengeId, Difficulty, BaddieId, BaddieExit } from './missiondata.ts';

/** One mission on the Map Room's board. */
export interface Mission {
  id: number;
  region: RegionId;
  title: string;
  difficulty: Difficulty;
  /** The challenges, in road order (2 easy, 3 normal, 3 or 4 hard). */
  challenges: readonly ChallengeId[];
  /** A hard mission's big baddie at the end of the road, or null. */
  baddie: BaddieId | null;
  /** Length in game days (1, 2 or 3). */
  days: number;
  coin: number;
  /** The chance of an egg on a success (0..1); `guaranteedEgg` makes it sure (the region's first success). */
  eggChance: number;
  guaranteedEgg: boolean;
}

/** A pair on a trip: a dragon and the keeper who rides with it, by id. */
export interface Pair { dragon: number; keeper: number }

/** A stop on the road: a challenge, or the baddie at the end. */
export interface Stop {
  kind: 'challenge' | 'baddie';
  /** Set when kind is 'challenge'. */
  challenge: ChallengeId | null;
  /** Set when kind is 'baddie'. */
  baddie: BaddieId | null;
  /** Where on the road it sits, as a fraction of the trip's length: challenge i of n at (i+1)/(n+1)*0.85, the baddie at 0.9. */
  at: number;
  /** Whether the team counters it (a baddie: both of its counters met). */
  covered: boolean;
  /** Who met it: dragon and keeper names, for the banner (empty if uncovered). */
  by: readonly string[];
  /** The trip log's line for this stop, e.g. "PITCH DARK - WICK LIGHTS THE WAY". */
  log: string;
}

export type TripState = 'muster' | 'depart' | 'away' | 'return' | 'home';

/** A team out on a mission. The outcome is rolled when it is sent (seeded), so the whole road is known up front. */
export interface Trip {
  mission: Mission;
  pairs: readonly Pair[];
  /** The odds it was sent with (0.05..0.95), and the roll's result. */
  odds: number;
  success: boolean;
  /** The egg it brings home (its element) and the nest reserved for it at SEND, or null. */
  egg: DragonElement | null;
  nest: number | null;
  stops: readonly Stop[];
  /** On a failure, the index of the stop where the team turns back (the first uncovered, else the last); null on a success. */
  turnBack: number | null;
  state: TripState;
  /** Clock values (sim.clock) when the team left the Aerie and when it lands again; null until it has departed. */
  departAt: number | null;
  returnAt: number | null;
  /** The baddie's exit on a success, or null (no baddie, or a failure). */
  exit: BaddieExit | null;
}
