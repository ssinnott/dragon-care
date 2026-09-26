// Game time (docs/BASE_DESIGN.md 7): a day is a fixed number of 60 Hz steps at 1x, and the clock is steps since day
// 1's midnight (sim.ts: clock0 + tick). Reading it -- the day, the hour and minute, the day's phase and how far the
// sky has turned into it -- is the view's business alone (the sky, the lights, the HUD's clock): the barn's care
// simulation never reads the phase (plan G8), so a world started at noon and one started at ten at night, stepped
// alike, are the same barn. Plain data and arithmetic: safe to import from Node.

/** A game day, in steps at 1x: three minutes. Tests pass a shorter SimOptions.dayLen (600: a day in 10 s). */
export const DAY_STEPS = 10800;
/** A new game starts at this hour (07:00 on day 1, the day's first hour). */
export const START_HOUR = 7;
/** Game days a stage lasts before a dragon grows into the next (S5), an elder's days before it retires (S6), an egg's before it hatches (S5). */
export const STAGE_DAYS = 30, RETIRE_DAYS = 30, HATCH_DAYS = 2;

/** The view's speeds: world steps per frame (0: paused). Speed is the view's, never the world's: a save has none. */
export const SPEEDS = [0, 1, 2, 4, 8] as const;
export type Speed = typeof SPEEDS[number];

export type DayPhase = 'dawn' | 'day' | 'dusk' | 'night';
/** The hour each phase starts: dawn 05-07, day 07-18, dusk 18-20, night 20-05. */
export const PHASE_HOURS: Readonly<Record<DayPhase, number>> = Object.freeze({ dawn: 5, day: 7, dusk: 18, night: 20 });
/** The phases in the order the day turns through them, from midnight's. */
export const PHASE_ORDER: readonly DayPhase[] = Object.freeze(['night', 'dawn', 'day', 'dusk'] as DayPhase[]);
/** The phase before each (the sky turns from it over the first hour of the next). */
export const PREV_PHASE: Readonly<Record<DayPhase, DayPhase>> = Object.freeze({ dawn: 'night', day: 'dawn', dusk: 'day', night: 'dusk' });

/**
 * The clock, read: the day (1-based), the hour and minute, the phase and the one before it, and `blend`, how far the
 * sky has turned from `prev` into `phase`: 0 at the phase's first step, then 1, 2 and 3 at each third of its first
 * hour (three stepped mixes, never a gradient), 3 for the rest of the phase.
 */
export interface ClockRead { day: number; hour: number; minute: number; phase: DayPhase; prev: DayPhase; blend: 0 | 1 | 2 | 3 }

/** Steps in a game hour for a day of `dayLen` steps (450 at 1x). */
export const hourSteps = (dayLen: number): number => dayLen / 24;

/** The phase an hour (0-23) is in. */
export function phaseOf(hour: number): DayPhase {
  return hour >= PHASE_HOURS.night || hour < PHASE_HOURS.dawn ? 'night' : hour >= PHASE_HOURS.dusk ? 'dusk' : hour >= PHASE_HOURS.day ? 'day' : 'dawn';
}

/** Read a clock (steps since day 1's midnight) on a day of `dayLen` steps. */
export function readClock(clock: number, dayLen: number = DAY_STEPS): ClockRead {
  const hs = hourSteps(dayLen), c = Math.max(0, clock);
  const day = Math.floor(c / dayLen) + 1, within = c - (day - 1) * dayLen;
  const hour = Math.min(23, Math.floor(within / hs)), minute = Math.min(59, Math.floor((within - hour * hs) * 60 / hs));
  const phase = phaseOf(hour);
  // (night runs over midnight: before dawn it began at the day before's 20:00)
  let start = PHASE_HOURS[phase] * hs;
  if (start > within) start -= dayLen;
  const blend = Math.min(3, Math.floor(3 * (within - start) / hs)) as 0 | 1 | 2 | 3;
  return { day, hour, minute, phase, prev: PREV_PHASE[phase], blend };
}

/** The HUD's clock: 'DAY 3 14:00', the minutes floored to tens. */
export function clockLabel(c: ClockRead): string {
  const two = (n: number) => String(n).padStart(2, '0');
  return `DAY ${c.day} ${two(c.hour)}:${two(Math.floor(c.minute / 10) * 10)}`;
}
