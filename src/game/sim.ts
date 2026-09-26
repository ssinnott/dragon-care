// The care simulation (docs/BASE_DESIGN.md 4): dragons whose needs drain, one queue of jobs, and the keepers who take
// them. A dragon with an open need walks to that need's room -- riding the Dragon Lift between floors -- and takes a
// slot there (travel.ts); its keeper fetches what the job needs from the room's post, meets it at the slot's stand
// spot, and does the job while the need refills. Nothing else raises a need (#7: rooms don't heal, keepers do).
// Deterministic and DOM-free: fixed 60 Hz steps, every tie broken by id, and the only randomness the starting needs
// (seeded; any later draw is stateless, src/game/rand.ts), so tools/sim-check.ts runs it headless and view=base's
// frozen frames (t=) come out the same every time. Dragons have stable ids (a new one takes nextDragonId), the world
// has a clock (game time, clock0 + tick), and the whole of it saves to plain JSON and loads back exactly (save.ts).
// Life (life.ts) runs in every step once the needs have drained and the acts under way have run, before any job opens
// or anyone moves: a dragon grows into its next stage 30 game days into its stage, once it is settled with room to grow
// (then it cheers where it stands a moment), and an egg in the Hatchery's nests (addEgg) hatches into a baby 2 game days
// after it was laid; 30 game days into the elder stage an elder retires to the garden, as soon as it may be sent
// somewhere new (travel.ts redirectable: not being met, not in the lift's hands or its bay). The garden (garden.ts,
// after the keepers in every step) is the retired elders' home: its residents keep a nap, sit and stroll rhythm, and
// need only food and love, slowly -- a keeper comes out to them (plan S6).
import { makeRng } from '../lib/engine/rng.ts';
import { NEEDS, QUEUE, OWN_NEED, GARDEN_NEEDS, drainRate, gardenDrain, hasNeed, moodOf, tierOf, fullNeeds } from './needs.ts';
import type { NeedKind, Needs } from './needs.ts';
import { ROOM_INFO, REACH, LIFT_X0, LIFT_X1, NESTS, GARDEN_MIN_PLOTS, GATE_MID, placeRooms, postX, waitX, route, feetY, clampToFloor, standSpot, fitsSlot, makeNets, worldWOf } from './layout.ts';
import type { Room, RoomPlace, RoomKind, Structure, Leg, Spot, Slot, Nets } from './layout.ts';
import { NEED_ROOM, LEAD_PX, WAIT_MAX, KEEPER_HALF, stepTravel, arrived, remainingCost, ridesLeft, retarget, raiseCall, bayShut, inBay } from './travel.ts';
import { stepLife } from './life.ts';
import { stepGarden, standAtResident } from './garden.ts';
import { mix32, TAG } from './rand.ts';
import type { DragonPlace, KeeperPlace } from './start.ts';
import { SAVE_VERSION, SaveVersionError, worldKey } from './save.ts';
import type { SaveV } from './save.ts';
import { DRAGON_ELEMENTS } from '../art/dragon/palettes.ts';
import type { DragonElement } from '../art/dragon/palettes.ts';
import type { Stage } from '../art/dragon/stages.ts';
import type { KeeperId } from '../art/keeper/cast.ts';
import { DAY_STEPS, START_HOUR, hourSteps } from './clock.ts';
import { applyCommands, stepManual, becomeManual } from './control.ts';
import type { Command } from './control.ts';

// ---------- tuning (4.9: first numbers, not law) ----------

/** A keeper's pace, px per step: walking, climbing a ladder, and Rush's multiplier on both (4.5). */
export const WALK = 1, CLIMB = 0.8, RUSH = 1.6;
/** Steps to pick a supply up (the bowl, the ball, the bucket). */
export const PICKUP = 40;
/** Steps a job takes at the dragon; a specialist takes SPECIALIST_TIME of it. Sleep's is the tuck-in alone. */
export const WORK: Readonly<Record<NeedKind, number>> = Object.freeze({ food: 200, love: 160, play: 200, bath: 200, sleep: 90 });
export const SPECIALIST_TIME = 0.75;
/** After its tuck-in a dragon sleeps this many steps (15 s) while its sleep refills; the keeper has gone. */
export const SLEEP_STEPS = 900;
/** Where a keeper stands to work with a dragon: this far in front of its body's root, past the snout (2.4; layout.ts standSpot). */
export { REACH };
/** A specialist is worth this many px of walking when a keeper is chosen for a job (4.4). */
const SPECIALIST_PX = 300;

// ---------- time ----------

/**
 * A game day, in steps at 1x (three minutes), and the hour a new game starts at: clock.ts, which reads the clock for
 * the view. The simulation keeps the clock and never reads the day's phase (plan G8): care runs the same by night.
 */
export { DAY_STEPS, START_HOUR };

/** How a world is built: its seed (the starting needs, and every rngAt draw), the steps in a day, and the clock at tick 0. */
export interface SimOptions {
  /** Default 1. */
  seed?: number;
  /** Steps in a game day at 1x (default DAY_STEPS); a whole number divisible by 24. */
  dayLen?: number;
  /** The hour of day 1 the world starts at, 0-23 (default START_HOUR, 07:00): clock0 is that many hours of steps. */
  hour?: number;
  /** The clock at tick 0, in steps from day 1's midnight (default the hour's: 7 x dayLen / 24); it wins over `hour`. */
  clock0?: number;
}

/**
 * What happened in a step, for the view to show (a union later slices extend: a departure, a return...): a dragon grew
 * into `stage` (life.ts), or an egg hatched into a baby, the dragon `dragon`; an elder retired and set off for the
 * garden, or a retiree arrived at its plot there, a resident now (garden.ts).
 */
export type SimEvent = { kind: 'grow'; dragon: number; stage: Stage } | { kind: 'hatch'; dragon: number; egg: number }
  | { kind: 'retire'; dragon: number } | { kind: 'garden'; dragon: number; plot: number };

/**
 * An egg in the Hatchery (plan S5): its id, its element, the seed its baby will have (a stateless draw from the world's
 * seed and the egg's id), the clock it was laid at, and its nest (0-2). It hatches HATCH_DAYS game days after it was
 * laid, once a baby sub-slot is free for the baby (life.ts).
 */
export interface Egg { id: number; element: DragonElement; seed: number; laid: number; nest: 0 | 1 | 2 }

// ---------- the world's things ----------

/** What a job is doing to a dragon: the need refilling from `from` to 1 over `len` steps (sleep: the tuck-in, then the nap). */
export interface Act { need: NeedKind; t: number; len: number; from: number }

/**
 * What a dragon's body is doing (travel.ts): standing; walking a floor; a paper turn in place; waiting at a lift landing
 * for the car (`call`); walking into the car (`board`), carried in it (`ride`), walking out of the bay (`alight`); held
 * at the lift bay's edge while the car moves (`bay`, the bay rule).
 */
export type DragonMove = 'still' | 'walk' | 'turn' | 'call' | 'board' | 'ride' | 'alight' | 'bay';
/**
 * Why a dragon is on the move: to a slot in its need's room; out of a slot another dragon needed; a baby due to grow
 * up, to a module slot its next stage fits (life.ts: it grows once it is settled there); or an elder retired, to its
 * plot in the garden (garden.ts). A later slice adds more.
 */
export type DragonGoal = 'need' | 'evict' | 'settle' | 'retire';
/** Where a dragon lives: the barn, or (retired) the garden. S8 adds 'away'. */
export type Place = 'barn' | 'garden';
/** What a garden resident is doing (garden.ts): napping, sitting, strolling to a resting place, or waiting for its keeper. */
export type GardenMode = 'nap' | 'sit' | 'stroll' | 'wait';
/**
 * A resident's rhythm (garden.ts): its mode, the tick a nap or a sit ends (-1: none), and its resting place's x (where
 * it stands, or where its stroll ends).
 */
export interface GardenState { mode: GardenMode; until: number; tx: number }

export interface Dragon {
  id: number;
  name: string;
  element: DragonElement;
  stage: Stage;
  seed: number;
  /**
   * The slot it has reserved (heading there) or holds (standing in it): layout.ts Slot, its room's own object. There is
   * no home room: after a job a dragon keeps its slot until it leaves for another need, or is moved on (3.3).
   */
  slot: Slot | null;
  /** Why it is moving (null: lingering in its slot), and the job it is going to or being served for (by id). */
  goal: DragonGoal | null;
  goalJob: number | null;
  /** Its floor (while riding, the floor it boarded at), x (the body's root) and facing. */
  f: number;
  x: number;
  facing: 1 | -1;
  /** The route still to go, on its stage's net (a leg on another floor is one lift ride). */
  legs: Leg[];
  move: DragonMove;
  /** Steps into the current walk bout (0: not walking); the bout's number (the view restarts its walk on a new one). */
  gaitT: number;
  walkSeq: number;
  /** Steps into a paper turn (0..TURN_STEPS - 1), or -1. */
  turn: number;
  /** Steps it has waited at a lift landing or the bay's edge (the current wait). */
  waited: number;
  needs: Needs;
  mood: number;
  act: Act | null;
  /** Steps of its nap left after the keeper who tucked it in has gone (0: awake, or still being tucked in). */
  asleep: number;
  /** The clock when its stage began (clock0 less the days it started into the stage). */
  stageSince: number;
  /**
   * Steps it holds still where it is, growing up (life.ts; 0: none): its grow-up's cheer, while the view plays its
   * `happy` through (gait.ts happyLen), or a step at a time while a keeper is still where its new body will be. Holding,
   * it chooses no goal, no keeper comes for it and no one moves it on.
   */
  hold: number;
  /** Where it lives (the barn, or retired, the garden), its plot there (a resident's, or a retiree's on its way; else null), and its rhythm there (a resident's; else null). */
  place: Place;
  home: number | null;
  garden: GardenState | null;
}

/**
 * A keeper's phase: free; fetching a supply, picking it up; going to the dragon's stand spot, waiting there for it; at
 * work; going back; or held by the player's hand, free to be walked (control.ts: a keeper held by hand picks up and
 * works in 'pickup' and 'work' too).
 */
export type Phase = 'idle' | 'fetch' | 'pickup' | 'go' | 'wait' | 'work' | 'home' | 'manual';
export interface Keeper {
  id: number;
  name: string;
  look: KeeperId;
  specialty: NeedKind | null;
  station: Room;
  /** Where they wait between jobs: their station's waiting spot (layout.ts waitX), not its post. */
  stationX: number;
  /** Their floor (while climbing, the floor they left), x, and feet y (between floors while climbing). */
  f: number;
  x: number;
  y: number;
  climbing: boolean;
  /** The route still to go. */
  legs: Leg[];
  phase: Phase;
  /** Steps into a pickup or a job. */
  t: number;
  job: Job | null;
  carrying: NeedKind | null;
  rushing: boolean;
  facing: 1 | -1;
  /** Px walked in all, for the view's stride. */
  walked: number;
  /** Steps held at the lift bay's edge while the car moves (the bay rule, R1); 0 when not held. */
  bayWait: number;
  /**
   * Held by the player's hand (control.ts, plan S7): auto-assignment and Rush leave them be. The direction the player
   * holds (dx -1 left, 1 right; dy -1 up, 1 down), kept until it changes; the steps left of the "?" a keeper shows when
   * E does nothing; and taken while at work: the player's once that job is done.
   */
  manual: boolean;
  held: { dx: -1 | 0 | 1; dy: -1 | 0 | 1 };
  cue: number;
  pendingTake: boolean;
}

export interface Job {
  id: number;
  dragon: Dragon;
  need: NeedKind;
  /** The step it opened on. */
  opened: number;
  keeper: Keeper | null;
  rushed: boolean;
}

/** A dragon waiting at a landing for the car: its floor, where it rides to, when it called, and its priority (2 a mission, 1 a rushed job, 0 anything else). */
export interface LiftCall { dragon: number; f: number; to: number; tick: number; prio: 0 | 1 | 2 }
/**
 * The Dragon Lift's one car (travel.ts; plan 3.4): its y (a rider's feet), the stop it is at or last left, the stop it
 * is going to (null: parked), its rider (a dragon id, from the moment the car is sent for it until it walks off),
 * whether it is moving, whether it is closing the bay to walkers (a departure blocked BAY_CLOSE steps), the tick its
 * waiting departure was first blocked (-1: none), and the calls not yet served.
 */
export interface LiftState {
  y: number;
  f: number;
  target: number | null;
  rider: number | null;
  moving: boolean;
  closing: boolean;
  blockedSince: number;
  calls: LiftCall[];
}

export interface SimStats {
  opened: number;
  done: number;
  /** Jobs closed without a keeper: none (#7: only a keeper meets a need). */
  closed: number;
  /** Steps from a job opening to its keeper starting work: the sum over started jobs, and the most. */
  waitSum: number;
  started: number;
  waitMax: number;
  queueMax: number;
  rushes: number;
  preempted: number;
  /** Dragon-need-steps spent at 0. */
  emptySteps: number;
  /** Px walked by dragons in all; lift rides completed; the longest a dragon waited at a landing for the car, steps. */
  dragonWalked: number;
  liftRides: number;
  liftWaitMax: number;
  /** Steps keepers stood at a stand spot waiting for the dragon (the sum over jobs started, and how many started). */
  keeperWaitSum: number;
  keeperWaits: number;
  /** Keepers who gave up waiting (WAIT_MAX); dragons moved out of a slot for another's need; slots taken by a Rush. */
  waitTimeouts: number;
  evictions: number;
  slotBumps: number;
  /**
   * Each room's (and structure's) uses by kind (#11: a named room earns its name by being used): a need room each
   * time a keeper starts meeting its need there, a supply room each time its supply is picked up, the lift each ride
   * completed, the Hatchery each egg laid in it and each egg hatched, the Garden Gate each pass through it (a dragon or
   * a keeper), and the garden each resident arriving and each resident's job met there.
   */
  used: Record<string, number>;
  /** The longest a stage-up waited, steps, from falling due to being applied (the dragon settled: life.ts). */
  growDelayMax: number;
  /** The longest a retirement waited, steps, from falling due (30 days into the elder stage) to the elder setting off (garden.ts). */
  retireDelayMax: number;
  /**
   * Keepers taken by the player's hand (control.ts); keepers sent for a job who handed it over to the one taken; and
   * the jobs each keeper did while held by hand, by name.
   */
  taken: number;
  handovers: number;
  doneBy: Record<string, number>;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export class CareSim {
  readonly seed: number;
  readonly dayLen: number;
  readonly clock0: number;
  /** Steps since the world was built. */
  tick = 0;
  /** The rooms as placed (what a save keeps), and the rooms themselves (a room's id is its index in both). */
  readonly roomPlaces: readonly RoomPlace[];
  readonly rooms: Room[];
  /** In id order; a dragon's id is never reused. */
  readonly dragons: Dragon[] = [];
  readonly keepers: Keeper[] = [];
  jobs: Job[] = [];
  readonly stats: SimStats = { opened: 0, done: 0, closed: 0, waitSum: 0, started: 0, waitMax: 0, queueMax: 0, rushes: 0, preempted: 0, emptySteps: 0,
    dragonWalked: 0, liftRides: 0, liftWaitMax: 0, keeperWaitSum: 0, keeperWaits: 0, waitTimeouts: 0, evictions: 0, slotBumps: 0, used: {}, growDelayMax: 0, retireDelayMax: 0,
    taken: 0, handovers: 0, doneBy: {} };
  /** The Dragon Lift: its car starts parked at the ground floor. */
  lift: LiftState = { y: feetY(0), f: 0, target: null, rider: null, moving: false, closing: false, blockedSince: -1, calls: [] };
  /** What the last step did (cleared at the start of every step). */
  events: SimEvent[] = [];
  /** The id the next dragon gets, and the next job (public so a save can keep them). */
  nextDragonId = 0;
  nextJob = 1;
  /** The eggs in the Hatchery's nests, in id order (at most one a nest), and the id the next egg gets. */
  eggs: Egg[] = [];
  nextEggId = 0;
  /** The elder garden: its plots (one a resident or retiree, never fewer than two; it only grows). */
  readonly garden: { plots: number } = { plots: GARDEN_MIN_PLOTS };
  /** Who can go where: the keepers' net and a dragon net per stage, out to the garden's end (layout.ts makeNets; rebuilt as it grows, never saved). */
  nets: Nets = makeNets(worldWOf(GARDEN_MIN_PLOTS));
  /** The player's commands for the next step (control.ts: applied at its start, in this order, then cleared; never saved: input, not the world). */
  commands: Command[] = [];

  constructor(rooms: readonly RoomPlace[], dragons: readonly DragonPlace[], keepers: readonly KeeperPlace[], opts: SimOptions = {}) {
    this.seed = opts.seed ?? 1;
    this.dayLen = opts.dayLen ?? DAY_STEPS;
    if (!Number.isInteger(this.dayLen) || this.dayLen < 24 || this.dayLen % 24) throw new Error(`dayLen ${this.dayLen}: a day must be a whole number of steps divisible by 24`);
    const hour = opts.hour ?? START_HOUR;
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new Error(`hour ${hour}: a start hour is a whole hour, 0-23`);
    this.clock0 = opts.clock0 ?? hour * hourSteps(this.dayLen);
    if (!Number.isInteger(this.clock0)) throw new Error(`clock0 ${this.clock0}: the clock counts whole steps`);
    this.roomPlaces = rooms.map((p) => ({ ...p }));
    this.rooms = placeRooms(rooms);
    const rng = makeRng(this.seed);
    const roomOf = (kind: string, who: string): Room => {
      const r = this.rooms.find((q) => q.kind === kind);
      if (!r) throw new Error(`${who}: no ${kind} in this base`);
      return r;
    };
    // each dragon in its slot: one that fits its stage, free, in a module no one else's size clashes with (a module
    // holds one grown dragon, or up to two babies)
    const held = new Map<string, { grown: number; babies: number }>();
    for (const p of dragons) {
      const room = roomOf(p.slot.room, p.name);
      if (ROOM_INFO[room.kind].people) throw new Error(`${p.name}: the ${room.kind} is a room for people`);
      const slot = room.slots[p.slot.i];
      if (!slot) throw new Error(`${p.name}: the ${room.kind} has no slot ${p.slot.i}`);
      if (!fitsSlot(slot, p.stage)) throw new Error(`${p.name}: ${/^[aeiou]/.test(p.stage) ? 'an' : 'a'} ${p.stage} doesn't fit the ${room.kind}'s ${slot.baby ? 'baby sub-slot' : 'module slot'} ${slot.i}`);
      const taken = this.dragons.find((d) => d.slot === slot);
      if (taken) throw new Error(`${p.name}: the ${room.kind}'s slot ${slot.i} is ${taken.name}'s`);
      const key = `${room.id}/${slot.mod}`, h = held.get(key) ?? { grown: 0, babies: 0 };
      if (slot.baby) h.babies++; else h.grown++;
      if (h.grown > 1 || h.babies > 2 || (h.grown && h.babies)) throw new Error(`${p.name}: module ${slot.mod} of the ${room.kind} is full (one grown dragon, or two babies)`);
      held.set(key, h);
      // the starting needs: seeded, most of them fine, a few already asking
      const needs = fullNeeds();
      for (const k of NEEDS) needs[k] = hasNeed(p.element, k) ? rng.range(0.42, 1) : 1;
      this.dragons.push({ id: this.nextDragonId++, name: p.name, element: p.element, stage: p.stage, seed: p.seed, slot, goal: null, goalJob: null,
        f: slot.f, x: slot.x, facing: slot.facing, legs: [], move: 'still', gaitT: 0, walkSeq: 0, turn: -1, waited: 0,
        needs, mood: moodOf(p.element, needs), act: null, asleep: 0, stageSince: this.clock0 - Math.round((p.days ?? 0) * this.dayLen), hold: 0,
        place: 'barn', home: null, garden: null });
    }
    keepers.forEach((p, id) => {
      const station = roomOf(p.station, p.name);
      // a keeper waits at their room's waiting spot (layout.ts waitX: clear of every slot's body, so never hidden behind a
      // dragon), and keepers sharing a station stand side by side there
      const mates = keepers.filter((q) => q.station === p.station), i = mates.indexOf(p);
      const stationX = clampToFloor(station.floor, Math.round(waitX(station) + (i - (mates.length - 1) / 2) * 22), this.nets.keeper);
      this.keepers.push({ id, name: p.name, look: p.look, specialty: p.specialty, station, stationX, f: station.floor, x: stationX, y: feetY(station.floor),
        climbing: false, legs: [], phase: 'idle', t: 0, job: null, carrying: null, rushing: false, facing: 1, walked: 0, bayWait: 0,
        manual: false, held: { dx: 0, dy: 0 }, cue: 0, pendingTake: false });
    });
  }

  /** Game time: steps since day 1's midnight. */
  get clock(): number { return this.clock0 + this.tick; }

  /** The keeper the player holds by hand (by id; also one taken at work, finishing that job first), or null (control.ts). */
  get controlled(): number | null { return this.keepers.find((k) => k.manual || k.pendingTake)?.id ?? null; }

  /** The player's input (control.ts Command): applied at the start of the next step, after any given before it. */
  command(c: Command): void { this.commands.push(c); }

  /** The world's walkable width: out to the garden's end (1688 with its first two plots, 2568 with seven: layout.ts worldWOf). */
  get worldW(): number { return worldWOf(this.garden.plots); }

  /**
   * Give the garden `plots` plots (garden.ts, as elders retire; it only grows): the world widens, and its nets are
   * rebuilt out to the new end. A route already under way stays one on the new nets (they only reach further east).
   */
  setPlots(plots: number): void {
    if (plots < this.garden.plots) throw new Error(`the garden has ${this.garden.plots} plots and never shrinks (asked for ${plots})`);
    if (plots === this.garden.plots) return;
    this.garden.plots = plots;
    this.nets = makeNets(this.worldW);
  }

  /**
   * A world from its save (save.ts serialize), exactly as it was: the rooms placed again, then every dragon, job and
   * keeper rebuilt and their references relinked by id. A save of another version throws SaveVersionError. The life
   * state is checked here (the eggs, each dragon's stage start and hold), and a save whose life state this build can't
   * run throws too: an egg lies unseen and unstepped for days before it hatches or is drawn (off the start's camera), so
   * the view's trial step and draw at load (base.ts load) would never meet a bad one, and the page would freeze days on.
   */
  static fromSave(s: SaveV): CareSim {
    if (!s || typeof s !== 'object' || s.v !== SAVE_VERSION) throw new SaveVersionError(s && typeof s === 'object' ? s.v : s);
    const sim = new CareSim(s.rooms, [], [], { seed: s.seed, dayLen: s.dayLen, clock0: s.clock0 });
    sim.tick = s.tick; sim.nextDragonId = s.nextDragonId; sim.nextJob = s.nextJob; sim.nextEggId = s.nextEggId;
    const whole = (v: unknown, min = -Infinity): v is number => Number.isInteger(v) && (v as number) >= min;
    if (!whole(s.nextEggId, 0) || !Array.isArray(s.eggs) || s.eggs.length > NESTS) throw new Error(`save: the eggs (${Array.isArray(s.eggs) ? s.eggs.length : typeof s.eggs}, next id ${s.nextEggId}) are not a hatchery's`);
    let lastId = -1;
    const nests = new Set<number>();
    for (const e of s.eggs) {
      if (!e || typeof e !== 'object' || !(DRAGON_ELEMENTS as readonly string[]).includes(e.element) || !whole(e.id, lastId + 1) || e.id >= s.nextEggId
        || !whole(e.nest, 0) || e.nest >= NESTS || nests.has(e.nest) || !whole(e.laid) || !whole(e.seed, 1)) throw new Error(`save: an egg this build can't hatch: ${JSON.stringify(e)}`);
      lastId = e.id; nests.add(e.nest);
    }
    sim.eggs = s.eggs.map((e) => ({ ...e }));
    const byId = <T extends { id: number }>(list: readonly T[], id: number, what: string): T => {
      const v = list.find((q) => q.id === id);
      if (!v) throw new Error(`save: no ${what} ${id}`);
      return v;
    };
    const slotOf = (r: { room: number; i: number }): Slot => {
      const slot = byId(sim.rooms, r.room, 'room').slots[r.i];
      if (!slot) throw new Error(`save: no slot ${r.i} in room ${r.room}`);
      return slot;
    };
    // (the garden: its plots, at least two and one for each resident or retiree, each on a plot of its own; a resident
    // an elder out of the barn with its rhythm, anyone else in the barn with none)
    const plots = s.garden && typeof s.garden === 'object' ? s.garden.plots : undefined;
    if (!whole(plots, GARDEN_MIN_PLOTS)) throw new Error(`save: the garden's plots (${JSON.stringify(s.garden)}) are not a garden's`);
    sim.setPlots(plots);
    const homes = new Set<number>();
    for (const d of s.dragons) {
      if (!whole(d.stageSince) || !whole(d.hold, 0)) throw new Error(`save: ${d.name}'s stage began at ${d.stageSince}, its hold ${d.hold}`);
      const out = d.place === 'garden' || d.goal === 'retire', g = d.garden;
      if ((d.place !== 'barn' && d.place !== 'garden') || (out ? d.stage !== 'elder' || d.slot || !whole(d.home, 0) || d.home >= plots || homes.has(d.home) : d.home != null)
        || (d.place === 'garden' ? !g || typeof g !== 'object' || !['nap', 'sit', 'stroll', 'wait'].includes(g.mode) || !whole(g.until, -1) || !Number.isFinite(g.tx) : g != null)) {
        throw new Error(`save: ${d.name} is not where this build can keep it: ${JSON.stringify({ place: d.place, home: d.home, goal: d.goal, garden: d.garden })}`);
      }
      if (out) homes.add(d.home!);
      sim.dragons.push({ ...d, slot: d.slot ? slotOf(d.slot) : null, needs: { ...d.needs }, act: d.act ? { ...d.act } : null, legs: d.legs.map((l) => ({ ...l })), garden: g ? { ...g } : null });
    }
    const jobs: Job[] = s.jobs.map((j) => ({ ...j, dragon: byId(sim.dragons, j.dragon, 'dragon'), keeper: null }));
    for (const k of s.keepers) {
      // (a save never holds a keeper by hand: save.ts stores them released)
      const h = k.held, dir = (v: unknown) => v === -1 || v === 0 || v === 1;
      if (k.manual !== false || k.pendingTake !== false || k.phase === 'manual' || !h || typeof h !== 'object' || !dir(h.dx) || !dir(h.dy) || !whole(k.cue, 0)) {
        throw new Error(`save: ${k.name} is held by hand: ${JSON.stringify({ manual: k.manual, pendingTake: k.pendingTake, phase: k.phase, held: k.held, cue: k.cue })}`);
      }
      sim.keepers.push({ ...k, held: { ...h }, station: byId(sim.rooms, k.station, 'room'), job: k.job == null ? null : byId(jobs, k.job, 'job'), legs: k.legs.map((l) => ({ ...l })) });
    }
    s.jobs.forEach((j, i) => { jobs[i].keeper = j.keeper == null ? null : byId(sim.keepers, j.keeper, 'keeper'); });
    sim.jobs = jobs;
    Object.assign(sim.stats, s.stats, { used: { ...s.stats.used }, doneBy: { ...s.stats.doneBy } });
    sim.lift = { ...s.lift, calls: s.lift.calls.map((c) => ({ ...c })) };
    return sim;
  }

  // ---------- the queue (4.3) ----------

  /**
   * Queue order: rushed first; then by tier (red, yellow, white); then the dragon's own need; then the lower need;
   * then the older job (the longer wait); then the lower id, so the order never flickers.
   */
  compare(a: Job, b: Job): number {
    const va = a.dragon.needs[a.need], vb = b.dragon.needs[b.need];
    return (+b.rushed - +a.rushed) || (tierOf(vb) - tierOf(va))
      || (+(OWN_NEED[b.dragon.element] === b.need) - +(OWN_NEED[a.dragon.element] === a.need))
      || (va - vb) || (a.opened - b.opened) || (a.id - b.id);
  }
  /** Every open job, in queue order. */
  queue(): Job[] { return this.jobs.slice().sort((a, b) => this.compare(a, b)); }

  // ---------- a step ----------

  /**
   * One step (plan S3, S5, S6, S7): the player's commands are applied (control.ts); the needs drain and the acts under way refill theirs (an act done ends here); then life --
   * a hold counts down, a dragon due, settled and with room grows up, an egg due hatches (life.ts) -- after the acts, so a dragon
   * whose nap or job ended this step is caught settled before it can set off; then jobs open under QUEUE (and close only
   * by being done: a need rises through a keeper's act alone), so a hatchling's food job opens the step it hatches; the
   * dragons choose where to go, walk and turn, and the lift runs (travel.ts); then free keepers take jobs, and every
   * keeper steps; then the garden (garden.ts): a retiree at its plot settles in, and the residents keep their rhythm
   * (a job opened this step has one waiting for its keeper from the next).
   */
  step(): void {
    this.events = [];
    this.tick++;
    // (the player's commands first: a take, a steer or E given before this step acts in it -- control.ts)
    applyCommands(this);
    for (const d of this.dragons) {
      // (a garden resident, or an elder on its way there, drains only food and love, slowly: needs.ts gardenDrain)
      const out = d.place === 'garden' || d.goal === 'retire';
      for (const k of NEEDS) if (hasNeed(d.element, k)) d.needs[k] = clamp01(d.needs[k] - (out ? gardenDrain(d.element, k) : drainRate(d.element, d.stage, k)));
      const a = d.act;
      if (a) {
        a.t++;
        d.needs[a.need] = Math.min(1, a.from + (1 - a.from) * a.t / a.len);
        if (a.t >= a.len) { d.needs[a.need] = 1; d.act = null; d.asleep = 0; }
        else if (d.asleep > 0) d.asleep--;
      }
      d.mood = moodOf(d.element, d.needs);
      for (const k of NEEDS) if (d.needs[k] <= 0) this.stats.emptySteps++;
    }
    stepLife(this);
    for (const d of this.dragons) for (const k of NEEDS) {
      if (!hasNeed(d.element, k) || d.needs[k] >= QUEUE || (d.act && d.act.need === k)) continue;
      // (an elder on its way to the garden asks for nothing until it is there; a resident, only for food and love)
      if (d.goal === 'retire' || (d.place === 'garden' && !GARDEN_NEEDS.includes(k))) continue;
      if (this.jobs.some((j) => j.dragon === d && j.need === k)) continue;
      this.jobs.push({ id: this.nextJob++, dragon: d, need: k, opened: this.tick, keeper: null, rushed: false });
      this.stats.opened++;
    }
    this.stats.queueMax = Math.max(this.stats.queueMax, this.jobs.length);
    stepTravel(this);
    this.assign();
    for (const k of this.keepers) this.stepKeeper(k);
    stepGarden(this);
  }

  /**
   * Free keepers take jobs in queue order; each job goes to the free keeper with the shortest trip, a specialist's
   * counted SPECIALIST_PX shorter. A job no free keeper can reach waits, and the jobs after it are still served.
   */
  private assign(): void {
    for (const j of this.queue()) {
      if (j.keeper || !this.servable(j)) continue;
      // (a rushed job, its dragon near now: a keeper runs to it, off another job if none is free: 4.5)
      if (j.rushed) { this.sendRushed(j); continue; }
      if (!this.keepers.some((k) => this.free(k))) return;
      let best: Keeper | null = null, bestCost = Infinity;
      for (const k of this.keepers) {
        if (!this.free(k)) continue;
        const c = this.tripCost(k, j) - (k.specialty === j.need ? SPECIALIST_PX : 0);
        if (c < bestCost) { bestCost = c; best = k; }
      }
      if (best) this.claim(best, j);
    }
  }

  /** A keeper free for a job: none in hand, and not held by the player's hand (control.ts: auto-assignment skips them). */
  private free(k: Keeper): boolean { return !k.job && !k.manual && !k.pendingTake; }

  /**
   * A job a keeper can go to (plan S3): its dragon is going for it, to a slot in the need's own room, and is there, or
   * past its lift ride and nearly there (LEAD_PX of route left) -- or, rushed, anywhere past its ride (the keeper runs:
   * they meet about when it arrives); so no keeper stands waiting at a stand spot while the dragon queues for the car.
   * The dragon is awake, not holding still to grow up (life.ts), and no other keeper is on it. A garden resident's job
   * can be gone to while the resident waits for it where it rests (garden.ts).
   */
  private servable(j: Job): boolean {
    const d = j.dragon;
    // (a garden resident: waiting for this job where it rests -- garden.ts; its keeper comes out to it)
    if (d.place === 'garden') return d.goalJob === j.id && arrived(this, d) && !d.act && !this.jobs.some((o) => o !== j && o.dragon === d && o.keeper);
    if (d.goalJob !== j.id || !d.slot || this.rooms[d.slot.room].kind !== NEED_ROOM[j.need]) return false;
    if (d.asleep > 0 || d.hold > 0 || (d.act && d.act.need === 'sleep')) return false;
    if (this.jobs.some((o) => o !== j && o.dragon === d && o.keeper)) return false;
    return arrived(this, d) || (!ridesLeft(this, d) && (j.rushed || remainingCost(this, d) <= LEAD_PX));
  }

  /**
   * Rush (4.5): the job jumps the queue; its dragon, if it wasn't going for it, goes for it at once (taking a slot in
   * the room from its lowest holder if the room is full, and calling the lift at priority); and as soon as the dragon
   * is near (servable), the nearest keeper runs to it -- a free one, else the one on the lowest job, which goes back in
   * the queue.
   */
  rush(j: Job): void {
    if (!this.jobs.includes(j)) return;
    this.stats.rushes++;
    j.rushed = true;
    // (a keeper held by hand is never rushed: the player walks them)
    if (j.keeper) { if (!j.keeper.manual) j.keeper.rushing = true; return; }
    const d = j.dragon;
    // someone is already with the dragon for another job: they hurry, and this one is next for it
    const other = this.jobs.find((o) => o !== j && o.dragon === d && o.keeper);
    if (other) { if (!other.keeper!.manual) other.keeper!.rushing = true; return; }
    // (a garden resident waits where it is: its keeper comes out to it)
    if (d.goalJob !== j.id && !d.act && d.place === 'barn') retarget(this, d, j);
    raiseCall(this, d);
    if (this.servable(j)) this.sendRushed(j);
  }

  /** A keeper for a rushed job: the nearest free one, else the one on the lowest job, taken off it; they run. */
  private sendRushed(j: Job): void {
    const d = j.dragon;
    // (a keeper who can't reach the job is never chosen for it)
    let best: Keeper | null = null, bestCost = Infinity;
    for (const k of this.keepers) if (this.free(k)) { const c = this.tripCost(k, j); if (c < bestCost) { bestCost = c; best = k; } }
    if (!best) {
      let low: Job | null = null;
      for (const k of this.keepers) {
        const kj = k.job;
        // (never a keeper mid-tuck-in: a dragon half put to bed would be left lying awake)
        // (nor one held by the player's hand, or finishing a job before they are: control.ts)
        if (!kj || kj.rushed || kj.dragon === d || k.manual || k.pendingTake || (k.phase === 'work' && kj.need === 'sleep') || this.tripCost(k, j) === Infinity) continue;
        if (!low || this.compare(kj, low) > 0 || (this.compare(kj, low) === 0 && this.tripCost(k, j) < this.tripCost(low.keeper!, j))) low = kj;
      }
      if (low) { best = low.keeper!; this.release(best); }
    }
    if (best) { this.claim(best, j); best.rushing = true; }
  }

  // ---------- keepers ----------

  private claim(k: Keeper, j: Job): void {
    j.keeper = k; k.job = j; k.rushing = j.rushed; k.t = 0;
    if (k.carrying && k.carrying !== j.need) k.carrying = null;
    const sup = k.carrying === j.need ? null : this.supplyRoom(j.need, this.spotOf(k));
    if (sup) { this.walkTo(k, { f: sup.floor, x: postX(sup) }); k.phase = 'fetch'; }
    else { this.walkTo(k, this.standAt(j.dragon)); k.phase = 'go'; }
  }

  /** A keeper drops their job back into the queue (a Rush took them); a job under way stops where it got to. */
  private release(k: Keeper): void {
    const j = k.job!;
    if (k.phase === 'work' && j.dragon.act && j.dragon.act.need === j.need && j.need !== 'sleep') j.dragon.act = null;
    j.keeper = null; k.job = null; k.rushing = false;
    this.stats.preempted++;
  }

  /**
   * A keeper gives a job back and walks home (a Rush took the dragon's slot, or the dragon never came: WAIT_MAX). The
   * job goes back in the queue; the keeper can be given another on the way.
   */
  drop(k: Keeper): void {
    const j = k.job;
    if (j) j.keeper = null;
    k.job = null; k.rushing = false; k.t = 0;
    // (one held by hand stays where they are, the player's)
    if (k.manual) { k.phase = 'manual'; return; }
    this.walkTo(k, { f: k.station.floor, x: k.stationX });
    k.phase = 'home';
  }

  private stepKeeper(k: Keeper): void {
    // (held by the player's hand: walked, climbing and picking up by control.ts; at work like anyone)
    if (k.manual && k.phase !== 'work') { stepManual(this, k); return; }
    // (a job its dragon has stopped going for -- it was moved out of the slot -- is given back)
    const j = k.job;
    if (j && k.phase !== 'work' && j.dragon.goalJob !== j.id) { this.drop(k); return; }
    switch (k.phase) {
      case 'idle': return;
      case 'pickup':
        if (++k.t >= PICKUP) {
          const need = k.job!.need, sup = this.rooms.find((r) => ROOM_INFO[r.kind].supplies === need && r.floor === k.f && k.x >= r.x0 && k.x <= r.x1);
          if (sup) this.use(sup.kind);
          k.carrying = need; this.walkTo(k, this.standAt(k.job!.dragon)); k.phase = 'go';
        }
        return;
      case 'wait':
        // at the stand spot before the dragon: the job starts the first step it stands in its slot, facing its way
        if (arrived(this, k.job!.dragon)) this.startWork(k);
        else if (++k.t > WAIT_MAX) { this.stats.waitTimeouts++; this.drop(k); }
        return;
      case 'work':
        if (++k.t >= this.workLen(k, k.job!.need)) this.finish(k);
        return;
      default:
        if (this.move(k)) this.arrive(k);
    }
  }

  /**
   * One step along the route; true once it is walked. A climb is at the link's x, floor to floor. On a floor, the bay
   * rule (R1): a keeper does not step into the lift bay while the car is moving (or closing) past this floor, but waits
   * at its edge; one already in it walks on out.
   */
  private move(k: Keeper): boolean {
    const leg = k.legs[0];
    if (!leg) return true;
    const pace = k.rushing ? RUSH : 1;
    if (leg.f !== k.f) {
      k.climbing = true;
      const ty = feetY(leg.f), sp = CLIMB * pace, dy = ty - k.y;
      if (Math.abs(dy) <= sp) { k.y = ty; k.f = leg.f; k.climbing = false; k.legs.shift(); }
      else k.y += Math.sign(dy) * sp;
    } else {
      const sp = WALK * pace, dx = leg.x - k.x;
      if (dx) k.facing = dx > 0 ? 1 : -1;
      let to = leg.x;
      if (dx && bayShut(this, k.f) && !inBay(k.x, KEEPER_HALF)) {
        const edge = dx > 0 ? LIFT_X0 - KEEPER_HALF : LIFT_X1 + KEEPER_HALF;
        if ((edge - k.x) * dx >= 0 && (leg.x - edge) * dx > 0) {
          if (k.x === edge) { k.bayWait++; return false; }
          to = edge;
        }
      }
      k.bayWait = 0;
      const rest = Math.abs(to - k.x), x0 = k.x;
      if (rest <= sp) { k.walked += rest; k.x = to; if (to === leg.x) k.legs.shift(); }
      else { k.x += Math.sign(dx) * sp; k.walked += sp; }
      // (#11: a pass through the Garden Gate, counted as it crosses the arches' middle)
      if (k.f === 0 && (x0 < GATE_MID) !== (k.x < GATE_MID)) this.use('gate');
    }
    return k.legs.length === 0;
  }

  private arrive(k: Keeper): void {
    if (k.phase === 'fetch') { k.phase = 'pickup'; k.t = 0; return; }
    if (k.phase === 'home') { k.phase = 'idle'; return; }
    // 'go': at the stand spot; the job starts now if the dragon is in its slot, else the keeper waits for it
    const d = k.job!.dragon;
    if (arrived(this, d)) { this.startWork(k); return; }
    k.phase = 'wait'; k.t = 0;
    if (d.slot) k.facing = d.slot.x >= k.x ? 1 : -1;
  }

  /** The job starts, and the dragon's anim with it (the bowl set down, the ball out, the bucket). A keeper held by hand starts it with E (control.ts). */
  startWork(k: Keeper): void {
    const j = k.job!, d = j.dragon, len = this.workLen(k, j.need);
    this.stats.keeperWaits++;
    if (k.phase === 'wait') this.stats.keeperWaitSum += k.t;
    k.phase = 'work'; k.t = 0; k.carrying = null;
    k.facing = d.x >= k.x ? 1 : -1;
    const wait = this.tick - j.opened;
    this.stats.started++; this.stats.waitSum += wait; this.stats.waitMax = Math.max(this.stats.waitMax, wait);
    // (#11: a need room is used when its own need is met in it -- always, now: a dragon is met only in its need's room;
    // and the garden when a resident's need is met there, the one room a keeper goes out to)
    if (d.place === 'garden') this.use('garden');
    else { const room = this.rooms[d.slot!.room]; if (ROOM_INFO[room.kind].meets === j.need) this.use(room.kind); }
    d.act = { need: j.need, t: 0, len: j.need === 'sleep' ? len + SLEEP_STEPS : len, from: d.needs[j.need] };
  }

  private finish(k: Keeper): void {
    const j = k.job!, d = j.dragon;
    // a tuck-in leaves the dragon asleep, its act running on; any other job is done
    if (j.need === 'sleep' && d.act && d.act.need === 'sleep') d.asleep = d.act.len - d.act.t;
    else { d.needs[j.need] = 1; if (d.act && d.act.need === j.need) d.act = null; }
    this.jobs.splice(this.jobs.indexOf(j), 1);
    this.stats.done++;
    // (the dragon lingers in its slot until it leaves for another need)
    if (d.goalJob === j.id) { d.goal = null; d.goalJob = null; }
    k.job = null; k.rushing = false; k.t = 0;
    // (held by hand, or taken while at it: the player's again where they stand -- control.ts)
    if (k.manual) { this.stats.doneBy[k.name] = (this.stats.doneBy[k.name] ?? 0) + 1; k.phase = 'manual'; k.legs = []; return; }
    if (k.pendingTake) { becomeManual(k); return; }
    this.walkTo(k, { f: k.station.floor, x: k.stationX });
    k.phase = 'home';
  }

  private workLen(k: Keeper, need: NeedKind): number { return Math.round(WORK[need] * (k.specialty === need ? SPECIALIST_TIME : 1)); }

  /** Count one use of a room or structure (stats.used, #11): travel.ts counts the lift's rides and the gate's passes here too, life.ts the hatches, garden.ts the arrivals. */
  use(kind: RoomKind | Structure): void { this.stats.used[kind] = (this.stats.used[kind] ?? 0) + 1; }

  // ---------- eggs ----------

  /**
   * Lay an egg of an element in the Hatchery (a mission brings eggs home: S8), in its lowest free nest, laid at clock
   * `laidAt` (default now; a preset may lay one earlier). Its baby's seed is a stateless draw from the world's seed and
   * the egg's id. Null if every nest holds an egg (or the base has no hatchery): the egg is not taken. #11: the
   * Hatchery is used.
   */
  addEgg(element: DragonElement, laidAt: number = this.clock): Egg | null {
    if (!this.rooms.some((r) => r.kind === 'hatchery')) return null;
    let nest = -1;
    for (let i = 0; i < NESTS && nest < 0; i++) if (!this.eggs.some((e) => e.nest === i)) nest = i;
    if (nest < 0) return null;
    const id = this.nextEggId++;
    const egg: Egg = { id, element, seed: (mix32(this.seed, TAG.EGG, id) & 0x7fffffff) || 1, laid: laidAt, nest: nest as 0 | 1 | 2 };
    this.eggs.push(egg);
    this.use('hatchery');
    return egg;
  }

  // ---------- where things are ----------

  /** Where a keeper is, for routing: a keeper on a ladder counts as already at the floor they're climbing to. */
  spotOf(k: Keeper): Spot { return k.climbing && k.legs.length ? { f: k.legs[0].f, x: k.x } : { f: k.f, x: k.x }; }

  /**
   * Where a keeper stands to work with a dragon: its slot's stand spot (layout.ts standSpot), in front of its snout,
   * inside the room -- always the slot's fixed spot, never the dragon's own x (so never through a wall). A garden
   * resident is met where it rests (garden.ts standAtResident).
   */
  standAt(d: Dragon): Spot {
    // (a garden resident: in front of its snout where it rests, inside the garden)
    if (d.place === 'garden') return standAtResident(this, d);
    if (!d.slot) throw new Error(`${d.name} has no slot to be met at`);
    return standSpot(d.slot, d.stage, this.rooms[d.slot.room]);
  }

  /** The room a need's supply comes from (the nearest, if there were more than one); null if it needs none. */
  private supplyRoom(need: NeedKind, from: Spot): Room | null {
    let best: Room | null = null, bestCost = Infinity;
    for (const r of this.rooms) {
      if (ROOM_INFO[r.kind].supplies !== need) continue;
      const rt = route(from, { f: r.floor, x: postX(r) }, this.nets.keeper);
      if (rt && rt.cost < bestCost) { bestCost = rt.cost; best = r; }
    }
    return best;
  }

  /** The walk (and climb) a job would take this keeper, via its supply if they aren't carrying it; Infinity if there's no way. */
  tripCost(k: Keeper, j: Job): number {
    const from = this.spotOf(k), stand = this.standAt(j.dragon);
    const sup = k.carrying === j.need ? null : this.supplyRoom(j.need, from);
    if (!sup) { const r = route(from, stand, this.nets.keeper); return r ? r.cost : Infinity; }
    const at = { f: sup.floor, x: postX(sup) }, a = route(from, at, this.nets.keeper), b = route(at, stand, this.nets.keeper);
    return a && b ? a.cost + b.cost : Infinity;
  }

  private walkTo(k: Keeper, to: Spot): void {
    // (a keeper halfway up a ladder finishes the climb first)
    const climb = k.climbing && k.legs.length ? k.legs[0] : null;
    const r = route(this.spotOf(k), to, this.nets.keeper);
    if (!r) throw new Error(`${k.name}: no way from floor ${k.f} x ${Math.round(k.x)} to floor ${to.f} x ${Math.round(to.x)}`);
    k.legs = climb ? [climb, ...r.legs] : r.legs;
  }

  /** The state as one string (the save's JSON, less the seed: save.ts worldKey): two runs from the same seed must agree on it, step for step. */
  digest(): string { return worldKey(this); }
}
