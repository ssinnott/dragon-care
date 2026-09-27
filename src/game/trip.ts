// A mission and a team's trip (docs/BASE_DESIGN.md 5 and 6): plain data, JSON-safe, every reference an id.
// missions.ts makes and steps them; the watchable scene (missionview.ts) is a pure function of a Trip
// and the sim's clock, and never changes one.
import type { DragonElement } from '../art/dragon/palettes.ts';
import type { RegionId, ChallengeId, Difficulty, BaddieId, FoeId } from './missiondata.ts';

/** One mission on the Map Room's board. */
export interface Mission {
  id: number;
  region: RegionId;
  title: string;
  difficulty: Difficulty;
  /** The challenges, in road order (2 easy, 3 normal and hard). */
  challenges: readonly ChallengeId[];
  /** The boss at the end of the road (its region's: BASE_DESIGN 5.3), and its might: the team's power must reach it to beat the boss. */
  baddie: BaddieId;
  might: number;
  /** The little enemies on the road (its region's), how many fights with them, and how many in each pack. */
  foe: FoeId;
  fights: number;
  pack: number;
  /** Length in game days (1, 2 or 3). */
  days: number;
  coin: number;
  /** The chance of an egg on a success (0..1); `guaranteedEgg` makes it sure (the region's first success). */
  eggChance: number;
  guaranteedEgg: boolean;
}

/** A pair on a trip: a dragon and the keeper who rides with it, by id. */
export interface Pair { dragon: number; keeper: number }

/** A stop on the road: a challenge, a fight with a pack of the road's little enemies, or the boss at the end. */
export interface Stop {
  kind: 'challenge' | 'foes' | 'baddie';
  /** Set when kind is 'challenge'. */
  challenge: ChallengeId | null;
  /** Set when kind is 'foes'. */
  foe: FoeId | null;
  /** Set when kind is 'baddie'. */
  baddie: BaddieId | null;
  /**
   * Where on the road it sits, as a fraction of the way to the boss: stop i of the K before it at (i + 1) / (K + 1), the
   * boss at 1 (the scene puts the boss's fight at the road's end: missionview.ts bossStart).
   */
  at: number;
  /** Whether the team meets it: a challenge by its counter, a pack of foes always, the boss when the team's power reaches its might. */
  covered: boolean;
  /** Who met it: a challenge's first meeter, or the dragons who fight (empty if a challenge is uncovered). */
  by: readonly string[];
  /** The trip log's line for this stop, e.g. "PITCH DARK - WICK LIGHTS THE WAY": how the stop went, never the outcome. */
  log: string;
}

export type TripState = 'muster' | 'depart' | 'away' | 'return' | 'home';

/**
 * A team out on a mission. The outcome is rolled when it is sent (seeded), so the whole road is known up front; but the
 * road is the same either way -- the team never turns back, it walks every stop -- and the outcome is told at its end.
 */
export interface Trip {
  mission: Mission;
  pairs: readonly Pair[];
  /** The odds it was sent with (0.05..0.95), and the roll's result: told only at the road's end (the result card). */
  odds: number;
  success: boolean;
  /** The egg it brings home (its element) and the nest reserved for it at SEND, or null. */
  egg: DragonElement | null;
  nest: number | null;
  stops: readonly Stop[];
  state: TripState;
  /** Clock values (sim.clock) when the team left the Aerie and when it lands again; null until it has departed. */
  departAt: number | null;
  returnAt: number | null;
}
