// The care simulation (docs/BASE_DESIGN.md 4): dragons whose needs drain, one queue of jobs, and the keepers who take
// them. A dragon with an open need walks to that need's room -- riding the Dragon Lift between floors -- and takes a
// slot there (travel.ts); its keeper fetches what the job needs from the room's post, meets it at the slot's stand
// spot, and does the job while the need refills. Nothing else raises a need (#7: rooms don't heal, keepers do).
// Deterministic and DOM-free: fixed 60 Hz steps, every tie broken by id, and the only randomness the starting needs
// (seeded; any later draw is stateless, src/game/rand.ts), so tools/sim-check.ts runs it headless and view=base's
// frozen frames (t=) come out the same every time. Dragons have stable ids (a new one takes nextDragonId), the world
// has a clock (game time, clock0 + tick), and the whole of it saves to plain JSON and loads back exactly (save.ts).
import { makeRng } from '../lib/engine/rng.ts';
import { NEEDS, QUEUE, OWN_NEED, drainRate, hasNeed, moodOf, tierOf, fullNeeds } from './needs.ts';
import type { NeedKind, Needs } from './needs.ts';
import { ROOM_INFO, REACH, LIFT_X0, LIFT_X1, placeRooms, postX, waitX, route, feetY, clampToFloor, standSpot, fitsSlot } from './layout.ts';
import type { Room, RoomPlace, RoomKind, Leg, Spot, Slot } from './layout.ts';
import { NEED_ROOM, LEAD_PX, WAIT_MAX, KEEPER_HALF, stepTravel, arrived, remainingCost, ridesLeft, retarget, raiseCall, bayShut, inBay } from './travel.ts';
import type { DragonPlace, KeeperPlace } from './start.ts';
import { SAVE_VERSION, SaveVersionError, worldKey } from './save.ts';
import type { SaveV } from './save.ts';
import type { DragonElement } from '../art/dragon/palettes.ts';
import type { Stage } from '../art/dragon/stages.ts';
import type { KeeperId } from '../art/keeper/cast.ts';

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

/** A game day, in steps at 1x: three minutes (docs/BASE_DESIGN.md 7). Tests pass a shorter SimOptions.dayLen. */
export const DAY_STEPS = 10800;
/** A new game starts at this hour (07:00 on day 1). */
export const START_HOUR = 7;

/** How a world is built: its seed (the starting needs, and every rngAt draw), the steps in a day, and the clock at tick 0. */
export interface SimOptions {
  /** Default 1. */
  seed?: number;
  /** Steps in a game day at 1x (default DAY_STEPS); a whole number divisible by 24. */
  dayLen?: number;
  /** The clock at tick 0, in steps from day 1's midnight (default START_HOUR's: 7 x dayLen / 24). */
  clock0?: number;
}

/** What happened in a step, for the view to show (a union later slices extend: a grow-up, a hatch, a departure...). */
export type SimEvent = { kind: 'none' };

// ---------- the world's things ----------

/** What a job is doing to a dragon: the need refilling from `from` to 1 over `len` steps (sleep: the tuck-in, then the nap). */
export interface Act { need: NeedKind; t: number; len: number; from: number }

/**
 * What a dragon's body is doing (travel.ts): standing; walking a floor; a paper turn in place; waiting at a lift landing
 * for the car (`call`); walking into the car (`board`), carried in it (`ride`), walking out of the bay (`alight`); held
 * at the lift bay's edge while the car moves (`bay`, the bay rule).
 */
export type DragonMove = 'still' | 'walk' | 'turn' | 'call' | 'board' | 'ride' | 'alight' | 'bay';
/** Why a dragon is on the move: to a slot in its need's room, or out of a slot another dragon needed (a later slice adds more). */
export type DragonGoal = 'need' | 'evict';

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
}

/** A keeper's phase: free; fetching a supply, picking it up; going to the dragon's stand spot, waiting there for it; at work; going back. */
export type Phase = 'idle' | 'fetch' | 'pickup' | 'go' | 'wait' | 'work' | 'home';
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
   * time a keeper starts meeting its need there, a supply room each time its supply is picked up, and the lift each
   * ride completed.
   */
  used: Record<string, number>;
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
    dragonWalked: 0, liftRides: 0, liftWaitMax: 0, keeperWaitSum: 0, keeperWaits: 0, waitTimeouts: 0, evictions: 0, slotBumps: 0, used: {} };
  /** The Dragon Lift: its car starts parked at the ground floor. */
  lift: LiftState = { y: feetY(0), f: 0, target: null, rider: null, moving: false, closing: false, blockedSince: -1, calls: [] };
  /** What the last step did (cleared at the start of every step). */
  events: SimEvent[] = [];
  /** The id the next dragon gets, and the next job (public so a save can keep them). */
  nextDragonId = 0;
  nextJob = 1;

  constructor(rooms: readonly RoomPlace[], dragons: readonly DragonPlace[], keepers: readonly KeeperPlace[], opts: SimOptions = {}) {
    this.seed = opts.seed ?? 1;
    this.dayLen = opts.dayLen ?? DAY_STEPS;
    if (!Number.isInteger(this.dayLen) || this.dayLen < 24 || this.dayLen % 24) throw new Error(`dayLen ${this.dayLen}: a day must be a whole number of steps divisible by 24`);
    this.clock0 = opts.clock0 ?? START_HOUR * this.dayLen / 24;
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
        needs, mood: moodOf(p.element, needs), act: null, asleep: 0, stageSince: this.clock0 - Math.round((p.days ?? 0) * this.dayLen) });
    }
    keepers.forEach((p, id) => {
      const station = roomOf(p.station, p.name);
      // a keeper waits at their room's waiting spot (layout.ts waitX: clear of every slot's body, so never hidden behind a
      // dragon), and keepers sharing a station stand side by side there
      const mates = keepers.filter((q) => q.station === p.station), i = mates.indexOf(p);
      const stationX = clampToFloor(station.floor, Math.round(waitX(station) + (i - (mates.length - 1) / 2) * 22));
      this.keepers.push({ id, name: p.name, look: p.look, specialty: p.specialty, station, stationX, f: station.floor, x: stationX, y: feetY(station.floor),
        climbing: false, legs: [], phase: 'idle', t: 0, job: null, carrying: null, rushing: false, facing: 1, walked: 0, bayWait: 0 });
    });
  }

  /** Game time: steps since day 1's midnight. */
  get clock(): number { return this.clock0 + this.tick; }

  /**
   * A world from its save (save.ts serialize), exactly as it was: the rooms placed again, then every dragon, job and
   * keeper rebuilt and their references relinked by id. A save of another version throws SaveVersionError.
   */
  static fromSave(s: SaveV): CareSim {
    if (!s || typeof s !== 'object' || s.v !== SAVE_VERSION) throw new SaveVersionError(s && typeof s === 'object' ? s.v : s);
    const sim = new CareSim(s.rooms, [], [], { seed: s.seed, dayLen: s.dayLen, clock0: s.clock0 });
    sim.tick = s.tick; sim.nextDragonId = s.nextDragonId; sim.nextJob = s.nextJob;
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
    for (const d of s.dragons) sim.dragons.push({ ...d, slot: d.slot ? slotOf(d.slot) : null, needs: { ...d.needs }, act: d.act ? { ...d.act } : null, legs: d.legs.map((l) => ({ ...l })) });
    const jobs: Job[] = s.jobs.map((j) => ({ ...j, dragon: byId(sim.dragons, j.dragon, 'dragon'), keeper: null }));
    for (const k of s.keepers) {
      sim.keepers.push({ ...k, station: byId(sim.rooms, k.station, 'room'), job: k.job == null ? null : byId(jobs, k.job, 'job'), legs: k.legs.map((l) => ({ ...l })) });
    }
    s.jobs.forEach((j, i) => { jobs[i].keeper = j.keeper == null ? null : byId(sim.keepers, j.keeper, 'keeper'); });
    sim.jobs = jobs;
    Object.assign(sim.stats, s.stats, { used: { ...s.stats.used } });
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
   * One step (plan S3): the needs drain and the acts under way refill theirs; jobs open under QUEUE (and close only by
   * being done: a need rises through a keeper's act alone); the dragons choose where to go, walk and turn, and the lift
   * runs (travel.ts); then free keepers take jobs, and every keeper steps.
   */
  step(): void {
    this.events = [];
    this.tick++;
    for (const d of this.dragons) {
      for (const k of NEEDS) if (hasNeed(d.element, k)) d.needs[k] = clamp01(d.needs[k] - drainRate(d.element, d.stage, k));
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
    for (const d of this.dragons) for (const k of NEEDS) {
      if (!hasNeed(d.element, k) || d.needs[k] >= QUEUE || (d.act && d.act.need === k)) continue;
      if (this.jobs.some((j) => j.dragon === d && j.need === k)) continue;
      this.jobs.push({ id: this.nextJob++, dragon: d, need: k, opened: this.tick, keeper: null, rushed: false });
      this.stats.opened++;
    }
    this.stats.queueMax = Math.max(this.stats.queueMax, this.jobs.length);
    stepTravel(this);
    this.assign();
    for (const k of this.keepers) this.stepKeeper(k);
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
      if (!this.keepers.some((k) => !k.job)) return;
      let best: Keeper | null = null, bestCost = Infinity;
      for (const k of this.keepers) {
        if (k.job) continue;
        const c = this.tripCost(k, j) - (k.specialty === j.need ? SPECIALIST_PX : 0);
        if (c < bestCost) { bestCost = c; best = k; }
      }
      if (best) this.claim(best, j);
    }
  }

  /**
   * A job a keeper can go to (plan S3): its dragon is going for it, to a slot in the need's own room, and is there, or
   * nearly (LEAD_PX of route left) -- or, rushed, past its lift ride (the keeper runs: they meet about when it
   * arrives, and no keeper stands waiting while it queues for the car); the dragon is awake; and no other keeper is on it.
   */
  private servable(j: Job): boolean {
    const d = j.dragon;
    if (d.goalJob !== j.id || !d.slot || this.rooms[d.slot.room].kind !== NEED_ROOM[j.need]) return false;
    if (d.asleep > 0 || (d.act && d.act.need === 'sleep')) return false;
    if (this.jobs.some((o) => o !== j && o.dragon === d && o.keeper)) return false;
    return arrived(this, d) || remainingCost(this, d) <= LEAD_PX || (j.rushed && !ridesLeft(this, d));
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
    if (j.keeper) { j.keeper.rushing = true; return; }
    const d = j.dragon;
    // someone is already with the dragon for another job: they hurry, and this one is next for it
    const other = this.jobs.find((o) => o !== j && o.dragon === d && o.keeper);
    if (other) { other.keeper!.rushing = true; return; }
    if (d.goalJob !== j.id && !d.act) retarget(this, d, j);
    raiseCall(this, d);
    if (this.servable(j)) this.sendRushed(j);
  }

  /** A keeper for a rushed job: the nearest free one, else the one on the lowest job, taken off it; they run. */
  private sendRushed(j: Job): void {
    const d = j.dragon;
    // (a keeper who can't reach the job is never chosen for it)
    let best: Keeper | null = null, bestCost = Infinity;
    for (const k of this.keepers) if (!k.job) { const c = this.tripCost(k, j); if (c < bestCost) { bestCost = c; best = k; } }
    if (!best) {
      let low: Job | null = null;
      for (const k of this.keepers) {
        const kj = k.job;
        // (never a keeper mid-tuck-in: a dragon half put to bed would be left lying awake)
        if (!kj || kj.rushed || kj.dragon === d || (k.phase === 'work' && kj.need === 'sleep') || this.tripCost(k, j) === Infinity) continue;
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
    this.walkTo(k, { f: k.station.floor, x: k.stationX });
    k.phase = 'home';
  }

  private stepKeeper(k: Keeper): void {
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
      const rest = Math.abs(to - k.x);
      if (rest <= sp) { k.walked += rest; k.x = to; if (to === leg.x) k.legs.shift(); }
      else { k.x += Math.sign(dx) * sp; k.walked += sp; }
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

  /** The job starts, and the dragon's anim with it (the bowl set down, the ball out, the bucket). */
  private startWork(k: Keeper): void {
    const j = k.job!, d = j.dragon, len = this.workLen(k, j.need);
    this.stats.keeperWaits++;
    if (k.phase === 'wait') this.stats.keeperWaitSum += k.t;
    k.phase = 'work'; k.t = 0; k.carrying = null;
    k.facing = d.x >= k.x ? 1 : -1;
    const wait = this.tick - j.opened;
    this.stats.started++; this.stats.waitSum += wait; this.stats.waitMax = Math.max(this.stats.waitMax, wait);
    // (#11: a need room is used when its own need is met in it -- always, now: a dragon is met only in its need's room)
    const room = this.rooms[d.slot!.room];
    if (ROOM_INFO[room.kind].meets === j.need) this.use(room.kind);
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
    this.walkTo(k, { f: k.station.floor, x: k.stationX });
    k.phase = 'home';
  }

  private workLen(k: Keeper, need: NeedKind): number { return Math.round(WORK[need] * (k.specialty === need ? SPECIALIST_TIME : 1)); }

  /** Count one use of a room or structure (stats.used, #11): travel.ts counts the lift's rides here too. */
  use(kind: RoomKind | 'lift' | 'aerie'): void { this.stats.used[kind] = (this.stats.used[kind] ?? 0) + 1; }

  // ---------- where things are ----------

  /** Where a keeper is, for routing: a keeper on a ladder counts as already at the floor they're climbing to. */
  spotOf(k: Keeper): Spot { return k.climbing && k.legs.length ? { f: k.legs[0].f, x: k.x } : { f: k.f, x: k.x }; }

  /**
   * Where a keeper stands to work with a dragon: its slot's stand spot (layout.ts standSpot), in front of its snout,
   * inside the room -- always the slot's fixed spot, never the dragon's own x (so never through a wall).
   */
  standAt(d: Dragon): Spot {
    if (!d.slot) throw new Error(`${d.name} has no slot to be met at`);
    return standSpot(d.slot, d.stage, this.rooms[d.slot.room]);
  }

  /** The room a need's supply comes from (the nearest, if there were more than one); null if it needs none. */
  private supplyRoom(need: NeedKind, from: Spot): Room | null {
    let best: Room | null = null, bestCost = Infinity;
    for (const r of this.rooms) {
      if (ROOM_INFO[r.kind].supplies !== need) continue;
      const rt = route(from, { f: r.floor, x: postX(r) });
      if (rt && rt.cost < bestCost) { bestCost = rt.cost; best = r; }
    }
    return best;
  }

  /** The walk (and climb) a job would take this keeper, via its supply if they aren't carrying it; Infinity if there's no way. */
  tripCost(k: Keeper, j: Job): number {
    const from = this.spotOf(k), stand = this.standAt(j.dragon);
    const sup = k.carrying === j.need ? null : this.supplyRoom(j.need, from);
    if (!sup) { const r = route(from, stand); return r ? r.cost : Infinity; }
    const at = { f: sup.floor, x: postX(sup) }, a = route(from, at), b = route(at, stand);
    return a && b ? a.cost + b.cost : Infinity;
  }

  private walkTo(k: Keeper, to: Spot): void {
    // (a keeper halfway up a ladder finishes the climb first)
    const climb = k.climbing && k.legs.length ? k.legs[0] : null;
    const r = route(this.spotOf(k), to);
    if (!r) throw new Error(`${k.name}: no way from floor ${k.f} x ${Math.round(k.x)} to floor ${to.f} x ${Math.round(to.x)}`);
    k.legs = climb ? [climb, ...r.legs] : r.legs;
  }

  /** The state as one string (the save's JSON, less the seed: save.ts worldKey): two runs from the same seed must agree on it, step for step. */
  digest(): string { return worldKey(this); }
}
