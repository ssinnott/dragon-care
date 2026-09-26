// Dragons on the move (docs/BASE_DESIGN.md 2 "Moving around", 3 "Slots"; plan 3.3, 3.4): a dragon with an open need
// takes a slot in that need's room and walks there, riding the Dragon Lift between floors, and its keeper meets it at
// the slot (sim.ts). This file is the dragons' half of a step: each free dragon chooses where to go (and moves a
// lingerer out of a full room), every dragon walks or turns, and the lift runs. A walk moves the body by the walk
// anim's own root motion (gait.ts), so the view's paws stay planted; a reversal is a paper turn in place. The lift bay
// has one rule for everyone who walks across it (the bay rule): nobody steps into the bay while the car moves past
// their floor, the car never moves while anyone stands in its bay on a floor it passes, and a departure blocked too
// long closes the bay until it goes. DOM-free and deterministic: every loop in id order, every tie by id.
import { tierOf } from './needs.ts';
import type { NeedKind } from './needs.ts';
import { ROOM_INFO, ROOM_KINDS, LIFT_X0, LIFT_X1, LIFT_CX, DRAGON_PAD, CLIMB_COST, dragonNet, route, feetY, fitsSlot, spanOf, clampToSpan, bayFloors } from './layout.ts';
import type { Room, RoomKind, Slot } from './layout.ts';
import { gaitOf, moveAt } from './gait.ts';
import type { CareSim, Dragon, Job, LiftCall } from './sim.ts';

/** The room that meets each need (one kind each: layout.ts ROOM_INFO's `meets`): food the kitchen, bath the bathhouse, play the romp room, love the grooming parlour, sleep the lamp dorm. */
export const NEED_ROOM: Readonly<Record<NeedKind, RoomKind>> = Object.freeze(Object.fromEntries(
  ROOM_KINDS.filter((k) => ROOM_INFO[k].meets).map((k) => [ROOM_INFO[k].meets!, k]),
) as Record<NeedKind, RoomKind>);

/**
 * Tuning (4.9). A paper turn's steps (the facing flips at TURN_HALF: care/dragon.ts's TURN_HALF 3). A keeper may set
 * off for a dragon still this many px of route away (so they meet about when it arrives). A keeper waits this long at
 * the stand spot before giving the job back (2 min). A car's departure blocked this long closes the bay (4 s). The
 * car's pace, px per step (1.5: the plan's third lever, measured -- the one car is the barn's bottleneck). A call
 * waiting this long is served before the car's own floor's (1 min).
 */
export const TURN_STEPS = 6, TURN_HALF = 3, LEAD_PX = 300, WAIT_MAX = 7200, BAY_CLOSE = 240, LIFT_SPEED = 1.5, OVERDUE = 3600;
/** A keeper's half-width for the bay rule (layout.ts's PAD: how close to a wall their feet come). */
export const KEEPER_HALF = 10;

const BAY_FLOORS: ReadonlySet<number> = new Set(bayFloors());

// ---------- the bay rule ----------

/** Whether a body of half-width h at x overlaps the lift bay (x 488-648; touching its edge is outside). */
export function inBay(x: number, h: number): boolean { return x + h > LIFT_X0 && x - h < LIFT_X1; }

/** The floors the car's pending or current move passes, both ends in: [low, high], or null when it has none. */
export function liftRange(sim: CareSim): [number, number] | null {
  const L = sim.lift;
  return L.target == null ? null : [Math.min(L.f, L.target), Math.max(L.f, L.target)];
}

/** R1 and R3: whether a walker on floor f may not step into the bay now (the car moves, or is closing, past f). */
export function bayShut(sim: CareSim, f: number): boolean {
  const L = sim.lift, r = liftRange(sim);
  return !!r && (L.moving || L.closing) && BAY_FLOORS.has(f) && f >= r[0] && f <= r[1];
}

/** Whether a dragon's body (x +- its stage's pad) is in the bay on a floor the bay rule holds on. */
export function dragonInBay(d: Dragon): boolean { return BAY_FLOORS.has(d.f) && inBay(d.x, DRAGON_PAD[d.stage]); }

/**
 * R2: who stands in the bay on a floor from `lo` to `hi`, so the car may not move: a keeper (x +- 10) or a dragon
 * (x +- its pad) other than the car's rider. Null if nobody.
 */
export function inTheWay(sim: CareSim, lo: number, hi: number): string | null {
  const on = (f: number) => BAY_FLOORS.has(f) && f >= lo && f <= hi;
  for (const k of sim.keepers) if (!k.climbing && on(k.f) && inBay(k.x, KEEPER_HALF)) return k.name;
  for (const d of sim.dragons) if (d.id !== sim.lift.rider && on(d.f) && inBay(d.x, DRAGON_PAD[d.stage])) return d.name;
  return null;
}

// ---------- slots ----------

/** The room that meets a need (the first of its kind), or null if the base has none. */
export function needRoom(sim: CareSim, need: NeedKind): Room | null { return sim.rooms.find((r) => r.kind === NEED_ROOM[need]) ?? null; }

/**
 * Who stands in the way of dragon `d` taking slot s: its holder, or anyone holding or heading for a slot in the same
 * module that can't share it (a module holds one grown dragon, or up to two babies: 3.3).
 */
function blockers(sim: CareSim, d: Dragon, s: Slot): Dragon[] {
  return sim.dragons.filter((o) => o !== d && o.slot && o.slot.room === s.room && (o.slot === s || (o.slot.mod === s.mod && (!s.baby || !o.slot.baby))));
}

/** The lowest-index slot of the room that fits the dragon and is free for it, or null. */
function freeSlot(sim: CareSim, d: Dragon, room: Room): Slot | null {
  for (const s of room.slots) if (fitsSlot(s, d.stage) && !blockers(sim, d, s).length) return s;
  return null;
}

/** The nearest free slot that fits the dragon in any dragon room, by its route there (ties by room id, then slot index). */
function nearestFree(sim: CareSim, d: Dragon): Slot | null {
  const net = dragonNet(d.stage);
  let best: Slot | null = null, bestCost = Infinity;
  for (const r of sim.rooms) for (const s of r.slots) {
    if (!fitsSlot(s, d.stage) || blockers(sim, d, s).length) continue;
    const rt = route({ f: d.f, x: d.x }, { f: s.f, x: s.x }, net);
    if (rt && rt.cost < bestCost) { bestCost = rt.cost; best = s; }
  }
  return best;
}

/** A dragon standing still in its slot with nowhere to be, no act and no keeper coming (evictable, 3.3), for room `room`. */
function lingerer(sim: CareSim, o: Dragon, room: Room): boolean {
  const g = o.goalJob == null ? null : sim.jobs.find((j) => j.id === o.goalJob) ?? null;
  return (!g || NEED_ROOM[g.need] !== room.kind) && !o.act && o.asleep === 0 && !o.legs.length && o.move === 'still'
    && !sim.jobs.some((j) => j.dragon === o && j.keeper);
}

/** A holder a Rush may move on: no keeper at work with it, and not in the lift's hands or in its bay. */
function bumpable(sim: CareSim, o: Dragon): boolean {
  return !o.act && o.asleep === 0 && sim.lift.rider !== o.id && !['call', 'board', 'ride', 'alight', 'bay'].includes(o.move) && !dragonInBay(o);
}

/**
 * A slot in `room` for dragon d: a free one; else one whose holders are all lingerers (the lowest id among them), each
 * moved to the nearest free slot elsewhere (an eviction); else, for a Rush (`bump`), one whose holders' keepers have
 * not started work, the lowest-ranked of them moved on (a slot bump). Null: the room is full and nobody can move, or
 * nowhere is free for them to go.
 */
function takeSlot(sim: CareSim, d: Dragon, room: Room, bump: boolean): Slot | null {
  const free = freeSlot(sim, d, room);
  if (free) return free;
  const rank = (o: Dragon) => { const j = o.goalJob == null ? null : sim.jobs.find((q) => q.id === o.goalJob); return j ? sim.queue().indexOf(j) : Infinity; };
  let pick: { s: Slot; who: Dragon[]; key: number } | null = null;
  for (const s of room.slots) {
    if (!fitsSlot(s, d.stage)) continue;
    const who = blockers(sim, d, s);
    if (!who.length || !who.every((o) => (bump ? bumpable(sim, o) : lingerer(sim, o, room)))) continue;
    // an eviction takes the slot of the lowest id; a bump the slot whose most urgent holder ranks lowest in the queue
    const key = bump ? -Math.min(...who.map(rank)) : Math.min(...who.map((o) => o.id));
    if (!pick || key < pick.key) pick = { s, who, key };
  }
  if (!pick) return null;
  // (the slot is the requester's before anyone moves, so none of them is sent to it)
  const was = d.slot;
  d.slot = pick.s;
  const moved: { o: Dragon; slot: Slot | null }[] = [];
  for (const o of pick.who) {
    const to = nearestFree(sim, o);
    if (!to) { d.slot = was; for (const m of moved) m.o.slot = m.slot; return null; }
    moved.push({ o, slot: o.slot });
    o.slot = to;
  }
  for (const { o } of moved) {
    // a bumped dragon's keeper (not at work yet) gives the job back; it goes on to its new slot, or its own top job
    for (const k of sim.keepers) if (k.job && k.job.dragon === o) sim.drop(k);
    o.goal = 'evict'; o.goalJob = null;
    sendTo(sim, o, o.slot!);
    if (bump) {
      sim.stats.slotBumps++;
      const top = topJob(sim, o);
      if (top && NEED_ROOM[top.need] !== room.kind) goFor(sim, o, top, false);
    } else sim.stats.evictions++;
  }
  d.slot = was;
  return pick.s;
}

/** Route a dragon to a slot it now holds (reserved): from where it stands, on its stage's net. A call it was waiting on is dropped. */
function sendTo(sim: CareSim, d: Dragon, slot: Slot): void {
  d.slot = slot;
  if (d.move === 'call') { cancelCall(sim, d); d.move = 'still'; d.waited = 0; d.gaitT = 0; }
  if (d.move === 'bay') { d.move = 'still'; d.waited = 0; }
  const r = route({ f: d.f, x: d.x }, { f: slot.f, x: slot.x }, dragonNet(d.stage));
  if (!r) throw new Error(`${d.name}: no way from floor ${d.f} x ${Math.round(d.x)} to floor ${slot.f} x ${slot.x}`);
  d.legs = r.legs;
}

/**
 * Make job j the dragon's goal: its slot, if it already holds one in the need's room; else a slot taken there (free,
 * or by moving a lingerer on, or for a Rush by bumping a holder), and the walk to it. False if no slot could be had
 * (the dragon keeps what it was doing; its bubble keeps showing).
 */
export function goFor(sim: CareSim, d: Dragon, j: Job, bump: boolean): boolean {
  const room = needRoom(sim, j.need);
  if (!room) return false;
  if (d.slot && d.slot.room === room.id) { d.goal = 'need'; d.goalJob = j.id; return true; }
  const slot = takeSlot(sim, d, room, bump);
  if (!slot) return false;
  d.goal = 'need'; d.goalJob = j.id;
  sendTo(sim, d, slot);
  return true;
}

/** A dragon's most pressing open job (queue order), or null. */
function topJob(sim: CareSim, d: Dragon): Job | null {
  let best: Job | null = null;
  for (const j of sim.jobs) if (j.dragon === d && (!best || sim.compare(j, best) < 0)) best = j;
  return best;
}

/** The room a dragon stands in, still, in its own slot (null while it is anywhere else). */
function standingIn(sim: CareSim, d: Dragon): Room | null {
  const s = d.slot;
  return s && !d.legs.length && d.move !== 'turn' && d.f === s.f && d.x === s.x ? sim.rooms[s.room] : null;
}

/**
 * Free to choose a goal: no act, awake, not in the lift's hands (waiting for it once it is sent, boarding, riding,
 * alighting), not held at the bay's edge or turning, and not standing in the bay (a walker in it walks on out).
 */
function free(sim: CareSim, d: Dragon): boolean {
  return !d.act && d.asleep === 0 && sim.lift.rider !== d.id && !['board', 'ride', 'alight', 'bay', 'turn'].includes(d.move) && !dragonInBay(d);
}

/**
 * A free dragon at a leg boundary (standing, or at the landing waiting for the car) chooses its goal (plan S3): its
 * most pressing job -- or, if it stands in a room that meets another of its jobs in the same tier, that one, saving
 * the walk. A goal a keeper is already coming for is kept. No job: it lingers where it is.
 */
function choose(sim: CareSim, d: Dragon): void {
  const cur = d.goalJob == null ? null : sim.jobs.find((j) => j.id === d.goalJob) ?? null;
  if (cur && cur.keeper) return;
  let pick = topJob(sim, d);
  if (!pick) { if (d.goal === 'need') { d.goal = null; d.goalJob = null; } return; }
  const here = standingIn(sim, d);
  if (here && NEED_ROOM[pick.need] !== here.kind) {
    const tier = tierOf(pick.dragon.needs[pick.need]);
    let alt: Job | null = null;
    for (const j of sim.jobs) if (j.dragon === d && NEED_ROOM[j.need] === here.kind && tierOf(d.needs[j.need]) === tier && (!alt || sim.compare(j, alt) < 0)) alt = j;
    if (alt) pick = alt;
  }
  if (cur === pick && d.slot && sim.rooms[d.slot.room].kind === NEED_ROOM[pick.need]) return;
  goFor(sim, d, pick, false);
}

/** Rush (sim.ts rush): the dragon goes for job j at once -- mid-walk too, but never once the lift has it -- taking a slot in the room even from a holder. */
export function retarget(sim: CareSim, d: Dragon, j: Job): void {
  if (d.act || d.asleep > 0 || sim.lift.rider === d.id || ['board', 'ride', 'alight'].includes(d.move) || dragonInBay(d)) return;
  goFor(sim, d, j, true);
}

// ---------- walking ----------

/** Whether a dragon's move plays its walk (a caller stepping up its landing's queue too, while its gait runs). */
export function walking(d: Dragon): boolean { return d.move === 'walk' || d.move === 'board' || d.move === 'alight' || (d.move === 'call' && d.gaitT > 0); }

function startTurn(d: Dragon): void { d.move = 'turn'; d.turn = 0; d.gaitT = 0; }

/** A landing's side of the bay: west (-1) or east (+1). */
export type Side = -1 | 1;

/** The front of a landing: just outside the bay on that side (a body's half, DRAGON_PAD, from its edge). */
function edgeSpot(d: Dragon, s: Side): number { const P = DRAGON_PAD[d.stage]; return s < 0 ? LIFT_X0 - P : LIFT_X1 + P; }

/** The side of the bay a dragon waits on: its own (west of the car's middle, or east), or the other if its own landing is off its floor (the deck has only the west). */
export function sideOf(d: Dragon): Side {
  const own: Side = d.x <= LIFT_CX ? -1 : 1;
  return spanOf(d.f, edgeSpot(d, own), dragonNet(d.stage)) >= 0 ? own : own < 0 ? 1 : -1;
}

/**
 * The queue at a landing (floor f, side s): the dragons waiting there for the car, front first (the longest wait,
 * then the lowest id). They stand nose to tail, so no one stands over another's eye (ART_BIBLE 1.4).
 */
export function landing(sim: CareSim, f: number, s: Side): Dragon[] {
  return sim.dragons.filter((o) => o.move === 'call' && o.f === f && sideOf(o) === s).sort((a, b) => b.waited - a.waited || a.id - b.id);
}

/**
 * Where the next place in a landing's queue is, after the place `prev` (null: the front): its half-body and the one
 * ahead's, and 16 px, further from the bay -- the one behind's head over the rump of the one ahead -- kept on the floor.
 */
function placeAfter(d: Dragon, s: Side, prev: { x: number; d: Dragon } | null): number {
  const edge = edgeSpot(d, s);
  let x = prev ? prev.x + s * ((DRAGON_PAD[prev.d.stage] + DRAGON_PAD[d.stage]) / 2 + 16) : edge;
  x = s < 0 ? Math.min(x, edge) : Math.max(x, edge);
  return clampToSpan(d.f, x, dragonNet(d.stage), edge);
}

/** Where dragon d's place is in its landing's queue (it is in it), and its index there. */
export function landingPlace(sim: CareSim, d: Dragon): { x: number; i: number } {
  const s = sideOf(d), q = landing(sim, d.f, s);
  let prev: { x: number; d: Dragon } | null = null;
  for (let i = 0; i < q.length; i++) {
    const x = placeAfter(q[i], s, prev);
    if (q[i] === d) return { x, i };
    prev = { x, d: q[i] };
  }
  return { x: placeAfter(d, s, prev), i: q.length };
}

/**
 * Where a dragon walking to the lift stops to call: the place at the back of its landing's queue -- or where it is,
 * if it has already come past that place (a dragon from the room beside the landing never walks back to queue).
 */
function callX(sim: CareSim, d: Dragon): number {
  const at = landingPlace(sim, d).x, toward = -sideOf(d);
  return (at - d.x) * toward < 0 ? d.x : at;
}

/** Where the dragon's current walk goes: the leg's end, or the landing if the next leg is a ride (the car's middle once boarding). */
function walkTarget(sim: CareSim, d: Dragon): number {
  const leg = d.legs[0], next = d.legs[1];
  return d.move !== 'board' && next && next.f !== d.f ? callX(sim, d) : leg.x;
}

/** At the end of its route: it stands, turns to its slot's way if it faces the other, and an eviction is over. */
function settle(d: Dragon): void {
  if (d.move !== 'turn') { d.move = 'still'; d.gaitT = 0; }
  const s = d.slot;
  if (s && d.move === 'still' && d.f === s.f && d.x === s.x && d.facing !== s.facing) { startTurn(d); return; }
  if (d.goal === 'evict' && d.move === 'still') d.goal = null;
}

function callLift(sim: CareSim, d: Dragon, to: number): void {
  d.move = 'call'; d.gaitT = 0; d.waited = 0;
  sim.lift.calls.push({ dragon: d.id, f: d.f, to, tick: sim.tick, prio: callPrio(sim, d) });
}
/** A call's priority: 1 for a rushed job (a mission's muster or return is 2: S8), else 0. */
function callPrio(sim: CareSim, d: Dragon): 0 | 1 | 2 {
  const j = d.goalJob == null ? null : sim.jobs.find((q) => q.id === d.goalJob);
  return j && j.rushed ? 1 : 0;
}
function cancelCall(sim: CareSim, d: Dragon): void { sim.lift.calls = sim.lift.calls.filter((c) => c.dragon !== d.id); }
/** A dragon waiting at a landing whose goal was just rushed: its call goes up to priority 1. */
export function raiseCall(sim: CareSim, d: Dragon): void {
  for (const c of sim.lift.calls) if (c.dragon === d.id) c.prio = Math.max(c.prio, callPrio(sim, d)) as 0 | 1 | 2;
}

/** The walk leg in hand is walked: call the car at the landing, stand in the car, or go on to the next leg. */
function legDone(sim: CareSim, d: Dragon): void {
  if (d.move === 'board') {
    // in the car, at its middle: face the side it will walk off, and ride
    d.legs.shift();
    const off = d.legs[1], exit = off ? Math.sign(off.x - LIFT_CX) : 0;
    d.gaitT = 0;
    if (exit && exit !== d.facing) startTurn(d); else d.move = 'ride';
    return;
  }
  const next = d.legs[1];
  if (next && next.f !== d.f) {
    // (it waits facing the bay: one that stops where it stands, beside its landing's queue, turns first)
    if (d.facing !== -sideOf(d)) { startTurn(d); return; }
    callLift(sim, d, next.f);
    return;
  }
  d.legs.shift();
  if (!d.legs.length) settle(d);
}

/**
 * One step of a dragon's body (plan 3.4): a paper turn goes on, a wait goes on, or it walks. A walk step is the gait's
 * next frame (`gaitT += 1; x += facing * moveAt(gaitT)`: what the view's walk anim, restarted at the bout's start at
 * speed 1, moves on this same step), clamped on the leg's last step; a walk the other way starts with a turn; and R1
 * holds it at the bay's edge while the car moves past its floor.
 */
function stepDragon(sim: CareSim, d: Dragon): void {
  switch (d.move) {
    case 'ride': return;
    case 'call': {
      // waiting for the car: it steps up its landing's queue as the ones ahead go (one gait step at a time)
      d.waited++;
      const at = landingPlace(sim, d).x, rest = (at - d.x) * d.facing;
      if (rest <= 0 || d.facing !== -sideOf(d)) { d.gaitT = 0; return; }
      if (d.gaitT === 0) d.walkSeq++;
      d.gaitT++;
      const m = moveAt(gaitOf(d.element, d.stage), d.gaitT);
      if (m >= rest) { d.x = at; sim.stats.dragonWalked += rest; } else { d.x += d.facing * m; sim.stats.dragonWalked += m; }
      return;
    }
    case 'turn':
      d.turn++;
      if (d.turn === TURN_HALF) d.facing = d.facing > 0 ? -1 : 1;
      if (d.turn < TURN_STEPS) return;
      d.turn = -1; d.move = 'still';
      // (in the car: the turn done, it rides; the car's rider not in it yet: it goes on boarding)
      if (d.legs[0] && d.legs[0].f !== d.f) { d.move = 'ride'; return; }
      if (sim.lift.rider === d.id) d.move = 'board';
      break;
    case 'bay':
      if (bayShut(sim, d.f)) { d.waited++; return; }
      d.move = 'still'; d.waited = 0;
      break;
  }
  const leg = d.legs[0];
  if (!leg) { settle(d); return; }
  const target = walkTarget(sim, d), dx = target - d.x;
  if (!dx) { legDone(sim, d); return; }
  const dir = dx > 0 ? 1 : -1;
  if (dir !== d.facing) { startTurn(d); return; }
  let stop = target;
  if (sim.lift.rider !== d.id && !dragonInBay(d) && bayShut(sim, d.f)) {
    const P = DRAGON_PAD[d.stage], edge = dir > 0 ? LIFT_X0 - P : LIFT_X1 + P;
    if ((edge - d.x) * dir >= 0 && (target - edge) * dir > 0) {
      if (d.x === edge) { d.move = 'bay'; d.gaitT = 0; d.waited = 0; return; }
      stop = edge;
    }
  }
  if (d.gaitT === 0) d.walkSeq++;
  if (d.move !== 'board' && d.move !== 'alight') d.move = 'walk';
  d.gaitT++;
  const m = moveAt(gaitOf(d.element, d.stage), d.gaitT), rest = Math.abs(stop - d.x);
  if (m >= rest) { d.x = stop; sim.stats.dragonWalked += rest; } else { d.x += dir * m; sim.stats.dragonWalked += m; }
  if (d.move === 'alight' && !dragonInBay(d)) d.move = 'walk';
  if (d.x === target) legDone(sim, d);
}

// ---------- the lift ----------

function dragonById(sim: CareSim, id: number): Dragon {
  const d = sim.dragons.find((q) => q.id === id);
  if (!d) throw new Error(`lift: no dragon ${id}`);
  return d;
}

/**
 * The caller the car serves next: the highest priority first; then any call waiting OVERDUE or more (the oldest
 * first), so nobody waits on for ever; then a caller on the floor the car is at (no empty trip, and the next rider
 * boards while the last walks off); then the oldest call; then the lowest id.
 */
function nextCall(sim: CareSim): LiftCall | null {
  const L = sim.lift, over = (c: LiftCall) => (sim.tick - c.tick >= OVERDUE ? 1 : 0), here = (c: LiftCall) => (c.f === L.f ? 1 : 0);
  let best: LiftCall | null = null;
  for (const c of L.calls) {
    if (!best || (c.prio - best.prio || over(c) - over(best) || (over(c) ? 0 : here(c) - here(best)) || best.tick - c.tick || best.dragon - c.dragon) > 0) best = c;
  }
  return best;
}

function board(sim: CareSim, d: Dragon): void {
  sim.stats.liftWaitMax = Math.max(sim.stats.liftWaitMax, d.waited);
  d.move = 'board'; d.gaitT = 0; d.waited = 0;
}

/**
 * One step of the lift (plan 3.4): a parked car takes the next call (or its rider, once in the car and facing its way
 * off, to its floor); it sets off only when nobody stands in the bay on a floor it will pass (R2), and a departure
 * blocked BAY_CLOSE steps closes the bay to walkers (R3) until it goes; it moves LIFT_SPEED px a step. At the caller's
 * floor the caller boards; at the rider's floor the rider walks off, and the ride is counted (#11: the lift is used).
 */
function stepLift(sim: CareSim): void {
  const L = sim.lift;
  if (L.target == null) {
    if (L.rider != null) {
      const d = dragonById(sim, L.rider);
      if (d.move === 'call' && d.f === L.f) board(sim, d);
      else if (d.move === 'ride') L.target = d.legs[0].f;
    } else {
      const c = nextCall(sim);
      if (c) {
        L.calls = L.calls.filter((q) => q !== c);
        L.rider = c.dragon;
        if (c.f === L.f) board(sim, dragonById(sim, c.dragon)); else L.target = c.f;
      }
    }
  }
  if (L.target == null) return;
  if (!L.moving) {
    const r = liftRange(sim)!;
    if (inTheWay(sim, r[0], r[1])) {
      if (L.blockedSince < 0) L.blockedSince = sim.tick;
      if (sim.tick - L.blockedSince >= BAY_CLOSE) L.closing = true;
      return;
    }
    L.moving = true; L.closing = false; L.blockedSince = -1;
  }
  const ty = feetY(L.target), dy = ty - L.y;
  if (Math.abs(dy) > LIFT_SPEED) { L.y += Math.sign(dy) * LIFT_SPEED; return; }
  L.y = ty; L.f = L.target; L.target = null; L.moving = false;
  const d = L.rider == null ? null : dragonById(sim, L.rider);
  if (!d) return;
  if (d.move === 'ride') {
    d.f = L.f; d.legs.shift(); d.move = 'alight'; d.gaitT = 0;
    L.rider = null;
    sim.stats.liftRides++;
    sim.use('lift');
  } else if (d.move === 'call') board(sim, d);
}

// ---------- the step ----------

/**
 * The dragons' half of a step (plan S3): free dragons at a leg boundary choose their goals, in the queue order of their
 * most pressing job, then by id; every dragon walks, turns or waits, by id; then the lift steps.
 */
export function stepTravel(sim: CareSim): void {
  const who: { d: Dragon; top: Job | null }[] = [];
  for (const d of sim.dragons) if (free(sim, d) && (!d.legs.length || d.move === 'call')) who.push({ d, top: topJob(sim, d) });
  who.sort((a, b) => (a.top && b.top ? sim.compare(a.top, b.top) : a.top ? -1 : b.top ? 1 : 0) || a.d.id - b.d.id);
  for (const { d } of who) choose(sim, d);
  for (const d of sim.dragons) stepDragon(sim, d);
  stepLift(sim);
}

/** Whether a dragon is at its slot and ready to be met: standing on it, facing its way, not turning, with no route left. */
export function arrived(_sim: CareSim, d: Dragon): boolean {
  const s = d.slot;
  return !!s && !d.legs.length && d.move === 'still' && d.turn < 0 && d.f === s.f && d.x === s.x && d.facing === s.facing;
}

/** The route a dragon has still to go, in walked px (a ride costed at its rise x CLIMB_COST, as routes are). */
export function remainingCost(_sim: CareSim, d: Dragon): number {
  let f = d.f, x = d.x, c = 0;
  for (const l of d.legs) {
    if (l.f !== f) { c += Math.abs(feetY(l.f) - feetY(f)) * CLIMB_COST; f = l.f; }
    c += Math.abs(l.x - x); x = l.x;
  }
  return c;
}
