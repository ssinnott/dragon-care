// A mission and a team's trip (docs/BASE_DESIGN.md 5, 6 and 11): plain data, JSON-safe, every reference an id.
// missions.ts makes and steps them (the road walked in the world's own steps, an encounter at each stop: encounter.ts);
// the watchable scene (missionview.ts) is a pure function of a Trip's state, and never changes one.
import type { DragonElement } from '../art/dragon/palettes.ts';
import type { RegionId, ChallengeId, Difficulty, BaddieId, FoeId } from './missiondata.ts';
import type { Stats } from './training.ts';
import type { Encounter } from './encounter.ts';

/** One mission on the Map Room's board. */
export interface Mission {
  id: number;
  region: RegionId;
  title: string;
  difficulty: Difficulty;
  /** The challenges, in road order (2 easy, 3 normal and hard). */
  challenges: readonly ChallengeId[];
  /** The boss at the end of the road (its region's: BASE_DESIGN 5.3), fought as the road's last stop. */
  baddie: BaddieId;
  /** The little enemies on the road (its region's), how many fights with them, and how many in each pack. */
  foe: FoeId;
  fights: number;
  pack: number;
  /** Length in game days (1, 2 or 3): the walking; the stops' encounters take their own time on top. */
  days: number;
  coin: number;
  /** The chance of an egg on a success (0..1); `guaranteedEgg` makes it sure (the region's first success). */
  eggChance: number;
  guaranteedEgg: boolean;
}

/** A pair on a trip: a dragon and the keeper who rides with it, by id. */
export interface Pair { dragon: number; keeper: number }

/** How a stop went: not reached yet, cleared (an obstacle done, a pack or a boss worn out), or waited out (the team out of puff, or out of turns). */
export type StopResult = 'ahead' | 'met' | 'unmet';

/** A stop on the road: a challenge (an obstacle), a pack of the road's little enemies (a fight), or the boss at the end (a fight). */
export interface Stop {
  kind: 'challenge' | 'foes' | 'baddie';
  /** Set when kind is 'challenge'. */
  challenge: ChallengeId | null;
  /** Set when kind is 'foes'. */
  foe: FoeId | null;
  /** Set when kind is 'baddie'. */
  baddie: BaddieId | null;
  /** Where on the road it sits, as a fraction of the trip's walk: stop i of the K before the boss at (i + 1) / (K + 1) x ROAD_SPAN, the boss at BADDIE_AT (missions.ts). */
  at: number;
  /** Whether the team has its counter (a dragon of its element, or the rider with its skill; a boss: both; a pack has none, and is always so): the chooser's tick, and STRONG on the menu. */
  covered: boolean;
  /** Who has the counter: dragon and keeper names (empty if nobody). */
  by: readonly string[];
  /** How it went, once resolved (`SPRING FLOOD - RIPPLE SWIMS THEM ACROSS`, `... - THE TEAM WAITS IT OUT`); '' before. Never the trip's outcome. */
  log: string;
  result: StopResult;
  /** The turns its encounter took, and the clock it was resolved at (null until then: the baddie's exit is timed from it). */
  turns: number;
  resolvedAt: number | null;
}

export type TripState = 'muster' | 'depart' | 'away' | 'return' | 'home';

/**
 * A team out on a mission. It walks its road in the world's own steps (`walked` of `travel`), halting at each stop for
 * its encounter (encounter.ts) until the stop is cleared or waited out, and never turns back: it walks every stop to
 * the road's end, where the outcome -- HOME SAFE! when every stop was cleared -- is told, on the result card.
 */
export interface Trip {
  mission: Mission;
  pairs: readonly Pair[];
  /** The trail coach's forecast it was sent with (encounter.ts forecastRoad: the share of its stops the coach would clear). */
  forecast: number;
  /** The outcome, decided at the road's end (null until then): every stop cleared. */
  success: boolean | null;
  /** The egg it may bring home (its element, drawn at SEND: sure on a region's first success, else its chance) and the nest reserved for it, or null. It comes home on a success. */
  egg: DragonElement | null;
  nest: number | null;
  stops: Stop[];
  state: TripState;
  /** The clock (sim.clock) when the team left the Aerie; null until it has departed. */
  departAt: number | null;
  /** The steps of walking the road takes (its days), and the steps walked so far (the encounters don't count). */
  travel: number;
  walked: number;
  /** Each pair's dragon on the road (encounter.ts): its stats (its spirits on its power, fixed at the send), the puff it has left, and the XP the road has brought it. */
  stats: Stats[];
  puff: number[];
  xp: number[];
  /** The trail coach picks every move (AUTO). */
  auto: boolean;
  /** The encounter at the stop the team stands at, or null: walking. */
  encounter: Encounter | null;
}
