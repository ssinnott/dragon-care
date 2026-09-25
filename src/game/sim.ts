// The care simulation (docs/BASE_DESIGN.md 4): dragons whose needs drain, one queue of jobs, and the keepers who take
// them -- fetch what a job needs from its room, walk and climb to the dragon, and do it while the need refills.
// Deterministic and DOM-free: fixed 60 Hz steps, every tie broken by id, and the only randomness the starting needs
// (seeded), so tools/sim-check.ts runs it headless and view=base's frozen frames (t=) come out the same every time.
import { makeRng } from '../lib/engine/rng.ts';
import { NEEDS, QUEUE, ROOM_REGEN, OWN_NEED, drainRate, hasNeed, moodOf, tierOf, fullNeeds } from './needs.ts';
import type { NeedKind, Needs } from './needs.ts';
import { ROOM_INFO, placeRooms, postX, route, feetY, clampToFloor } from './layout.ts';
import type { Room, RoomPlace, Leg, Spot } from './layout.ts';
import type { DragonPlace, KeeperPlace } from './start.ts';
import type { DragonElement } from '../art/dragon/palettes.ts';
import type { Stage } from '../art/dragon/stages.ts';

// ---------- tuning (4.9: first numbers, not law) ----------

/** A keeper's pace, px per step: walking, climbing (a ladder or the hoist), and Rush's multiplier on both (4.5). */
export const WALK = 1, CLIMB = 0.8, RUSH = 1.6;
/** Steps to pick a supply up (the bowl, the ball, the bucket). */
export const PICKUP = 40;
/** Steps a job takes at the dragon; a specialist takes SPECIALIST_TIME of it. Sleep's is the tuck-in alone. */
export const WORK: Readonly<Record<NeedKind, number>> = Object.freeze({ food: 200, love: 160, play: 200, bath: 200, sleep: 90 });
export const SPECIALIST_TIME = 0.75;
/** After its tuck-in a dragon sleeps this many steps (15 s) while its sleep refills; the keeper has gone. */
export const SLEEP_STEPS = 900;
/** An unclaimed job closes once its room has lifted the need this far back over QUEUE (4.6). */
const CLOSE_OVER = 0.05;
/** Where a keeper stands to work with a dragon: this far in front of its body centre, past the snout (2.4). */
export const REACH: Readonly<Record<Stage, number>> = Object.freeze({ baby: 30, young: 46, adult: 58, elder: 60 });
/** A specialist is worth this many px of walking when a keeper is chosen for a job (4.4). */
const SPECIALIST_PX = 300;

// ---------- the world's things ----------

/** What a job is doing to a dragon: the need refilling from `from` to 1 over `len` steps (sleep: the tuck-in, then the nap). */
export interface Act { need: NeedKind; t: number; len: number; from: number }

export interface Dragon {
  id: number;
  name: string;
  element: DragonElement;
  stage: Stage;
  seed: number;
  /** Its home room; it stands there, on the room's floor. */
  room: Room;
  f: number;
  x: number;
  facing: 1 | -1;
  needs: Needs;
  mood: number;
  act: Act | null;
  /** Steps of its nap left after the keeper who tucked it in has gone (0: awake, or still being tucked in). */
  asleep: number;
}

export type Phase = 'idle' | 'fetch' | 'pickup' | 'go' | 'work' | 'home';
export interface Keeper {
  id: number;
  name: string;
  look: string;
  specialty: NeedKind | null;
  station: Room;
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

export interface SimStats {
  opened: number;
  done: number;
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
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export class CareSim {
  tick = 0;
  readonly rooms: Room[];
  readonly dragons: Dragon[] = [];
  readonly keepers: Keeper[] = [];
  jobs: Job[] = [];
  readonly stats: SimStats = { opened: 0, done: 0, closed: 0, waitSum: 0, started: 0, waitMax: 0, queueMax: 0, rushes: 0, preempted: 0, emptySteps: 0 };
  private nextJob = 1;

  constructor(rooms: readonly RoomPlace[], dragons: readonly DragonPlace[], keepers: readonly KeeperPlace[], seed = 1) {
    this.rooms = placeRooms(rooms);
    const rng = makeRng(seed);
    const roomOf = (kind: string, who: string): Room => {
      const r = this.rooms.find((q) => q.kind === kind);
      if (!r) throw new Error(`${who}: no ${kind} in this base`);
      return r;
    };
    dragons.forEach((p, id) => {
      const room = roomOf(p.room, p.name);
      if (ROOM_INFO[room.kind].people) throw new Error(`${p.name}: the ${room.kind} is a room for people`);
      // the starting needs: seeded, most of them fine, a few already asking
      const needs = fullNeeds();
      for (const k of NEEDS) needs[k] = hasNeed(p.element, k) ? rng.range(0.42, 1) : 1;
      this.dragons.push({ id, name: p.name, element: p.element, stage: p.stage, seed: p.seed, room, f: room.floor,
        x: Math.round(room.x0 + p.at * (room.x1 - room.x0)), facing: p.facing, needs, mood: moodOf(p.element, needs), act: null, asleep: 0 });
    });
    keepers.forEach((p, id) => {
      const station = roomOf(p.station, p.name);
      // keepers sharing a station stand side by side at its post
      const mates = keepers.filter((q) => q.station === p.station), i = mates.indexOf(p);
      const stationX = clampToFloor(station.floor, Math.round(postX(station) + (i - (mates.length - 1) / 2) * 22));
      this.keepers.push({ id, name: p.name, look: p.look, specialty: p.specialty, station, stationX, f: station.floor, x: stationX, y: feetY(station.floor),
        climbing: false, legs: [], phase: 'idle', t: 0, job: null, carrying: null, rushing: false, facing: 1, walked: 0 });
    });
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

  step(): void {
    this.tick++;
    // needs drain, rooms restore theirs (4.6), and a job under way refills its need
    for (const d of this.dragons) {
      const restores = ROOM_INFO[d.room.kind].restores;
      for (const k of NEEDS) {
        if (!hasNeed(d.element, k)) continue;
        d.needs[k] = clamp01(d.needs[k] - drainRate(d.element, d.stage, k) + (restores === k ? ROOM_REGEN : 0));
      }
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
    // jobs open under QUEUE; an unclaimed one closes if the dragon's room has lifted the need back
    for (const d of this.dragons) for (const k of NEEDS) {
      if (!hasNeed(d.element, k) || d.needs[k] >= QUEUE || (d.act && d.act.need === k)) continue;
      if (this.jobs.some((j) => j.dragon === d && j.need === k)) continue;
      this.jobs.push({ id: this.nextJob++, dragon: d, need: k, opened: this.tick, keeper: null, rushed: false });
      this.stats.opened++;
    }
    this.jobs = this.jobs.filter((j) => {
      if (j.keeper || j.rushed || j.dragon.needs[j.need] < QUEUE + CLOSE_OVER) return true;
      this.stats.closed++;
      return false;
    });
    this.stats.queueMax = Math.max(this.stats.queueMax, this.jobs.length);
    this.assign();
    for (const k of this.keepers) this.stepKeeper(k);
  }

  /**
   * Free keepers take jobs in queue order; each job goes to the free keeper with the shortest trip, a specialist's
   * counted SPECIALIST_PX shorter. A job no free keeper can reach waits, and the jobs after it are still served.
   */
  private assign(): void {
    for (const j of this.queue()) {
      if (!this.keepers.some((k) => !k.job)) return;
      if (j.keeper || !this.servable(j)) continue;
      let best: Keeper | null = null, bestCost = Infinity;
      for (const k of this.keepers) {
        if (k.job) continue;
        const c = this.tripCost(k, j) - (k.specialty === j.need ? SPECIALIST_PX : 0);
        if (c < bestCost) { bestCost = c; best = k; }
      }
      if (best) this.claim(best, j);
    }
  }

  /** A job a keeper can start: its dragon is awake, and no other keeper is on it. */
  private servable(j: Job): boolean {
    const d = j.dragon;
    return d.asleep === 0 && !(d.act && d.act.need === 'sleep') && !this.jobs.some((o) => o !== j && o.dragon === d && o.keeper);
  }

  /** Rush (4.5): the job jumps the queue, and the nearest keeper runs to it -- a free one, else the one on the lowest job, which goes back in the queue. */
  rush(j: Job): void {
    if (!this.jobs.includes(j)) return;
    this.stats.rushes++;
    j.rushed = true;
    if (j.keeper) { j.keeper.rushing = true; return; }
    const d = j.dragon;
    // someone is already with the dragon for another job: they hurry, and this one is next for it
    const other = this.jobs.find((o) => o !== j && o.dragon === d && o.keeper);
    if (other) { other.keeper!.rushing = true; return; }
    if (!this.servable(j)) return;
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

  private stepKeeper(k: Keeper): void {
    switch (k.phase) {
      case 'idle': return;
      case 'pickup':
        if (++k.t >= PICKUP) { k.carrying = k.job!.need; this.walkTo(k, this.standAt(k.job!.dragon)); k.phase = 'go'; }
        return;
      case 'work':
        if (++k.t >= this.workLen(k, k.job!.need)) this.finish(k);
        return;
      default:
        if (this.move(k)) this.arrive(k);
    }
  }

  /** One step along the route; true once it is walked. A climb is at the link's x, floor to floor. */
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
      if (Math.abs(dx) <= sp) { k.walked += Math.abs(dx); k.x = leg.x; k.legs.shift(); }
      else { k.x += Math.sign(dx) * sp; k.walked += sp; }
    }
    return k.legs.length === 0;
  }

  private arrive(k: Keeper): void {
    if (k.phase === 'fetch') { k.phase = 'pickup'; k.t = 0; return; }
    if (k.phase === 'home') { k.phase = 'idle'; return; }
    // 'go': at the dragon; the job starts, and the dragon's anim with it (the bowl set down, the ball out, the bucket)
    const j = k.job!, d = j.dragon, len = this.workLen(k, j.need);
    k.phase = 'work'; k.t = 0; k.carrying = null;
    k.facing = d.x >= k.x ? 1 : -1;
    const wait = this.tick - j.opened;
    this.stats.started++; this.stats.waitSum += wait; this.stats.waitMax = Math.max(this.stats.waitMax, wait);
    d.act = { need: j.need, t: 0, len: j.need === 'sleep' ? len + SLEEP_STEPS : len, from: d.needs[j.need] };
  }

  private finish(k: Keeper): void {
    const j = k.job!, d = j.dragon;
    // a tuck-in leaves the dragon asleep, its act running on; any other job is done
    if (j.need === 'sleep' && d.act && d.act.need === 'sleep') d.asleep = d.act.len - d.act.t;
    else { d.needs[j.need] = 1; if (d.act && d.act.need === j.need) d.act = null; }
    this.jobs.splice(this.jobs.indexOf(j), 1);
    this.stats.done++;
    k.job = null; k.rushing = false; k.t = 0;
    this.walkTo(k, { f: k.station.floor, x: k.stationX });
    k.phase = 'home';
  }

  private workLen(k: Keeper, need: NeedKind): number { return Math.round(WORK[need] * (k.specialty === need ? SPECIALIST_TIME : 1)); }

  // ---------- where things are ----------

  /** Where a keeper is, for routing: a keeper on a ladder counts as already at the floor they're climbing to. */
  spotOf(k: Keeper): Spot { return k.climbing && k.legs.length ? { f: k.legs[0].f, x: k.x } : { f: k.f, x: k.x }; }

  /** Where a keeper stands to work with a dragon: in front of its snout, kept on the floor. */
  standAt(d: Dragon): Spot { return { f: d.f, x: clampToFloor(d.f, d.x + d.facing * REACH[d.stage]) }; }

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

  /** The state as one string: two runs from the same seed must agree on it, step for step. */
  digest(): string {
    const n = (v: number) => v.toFixed(6);
    return [this.tick, ...this.dragons.map((d) => NEEDS.map((k) => n(d.needs[k])).join(',') + (d.act ? `:${d.act.need}${d.act.t}` : '')),
      ...this.keepers.map((k) => `${k.phase}${k.job ? k.job.id : '-'}@${n(k.x)},${n(k.y)}`), this.jobs.map((j) => j.id).join(',')].join('|');
  }
}
