// Dragons on the move (docs/BASE_DESIGN.md 2 "Moving around", 3 "Slots"; plan 3.3, 3.4): a dragon with an open need
// takes a slot in that need's room and walks there, riding the Dragon Lift between floors, and its keeper meets it at
// the slot (sim.ts). This file is the dragons' half of a step: each free dragon chooses where to go (and moves a
// lingerer out of a full room), every dragon walks or turns, and the lift runs. A walk moves the body by the walk
// anim's own root motion (gait.ts), so the view's paws stay planted; a reversal is a paper turn in place. The lift bay
// has one rule for everyone who walks across it (the bay rule): nobody steps into the bay while the car moves past
// their floor, the car never moves while anyone stands in its bay on a floor it passes, and a departure blocked too
// long closes the bay until it goes -- and its shaft shows one dragon at a time (R5): the car serves one rider from its
// call until it has walked off clear of the bay, the next may follow it in nose to tail, and nobody steps in over
// another. Dragons waiting at a landing, or at the bay's edge, stand in that side's line where they cover no eye
// (ART_BIBLE 1.4). DOM-free and deterministic: every loop in id order, every tie by id.
import { tierOf } from './needs.ts';
import type { NeedKind } from './needs.ts';
import { ROOM_INFO, ROOM_KINDS, LIFT_X0, LIFT_X1, LIFT_CX, DRAGON_PAD, DRAGON_BODY, CLIMB_COST, dragonNet, route, feetY, fitsSlot, spanOf, bayFloors } from './layout.ts';
import type { Room, RoomKind, Slot } from './layout.ts';
import type { Stage } from '../art/dragon/stages.ts';
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
 * car's pace, px per step (2: the plan's third lever, 1 -> 1.5, taken to the cap the orchestrator set -- the one car
 * is the barn's bottleneck; a floor in 0.93 s, though a ride's time is mostly its rider walking in and off: 4.7). A
 * call waiting this long is served before the car's own floor's (1 min).
 */
export const TURN_STEPS = 6, TURN_HALF = 3, LEAD_PX = 300, WAIT_MAX = 7200, BAY_CLOSE = 240, LIFT_SPEED = 2, OVERDUE = 3600;
/** How far behind the last rider walking off (px, body to body) the next one walks in after it. */
export const FOLLOW_GAP = 8;
/** Within this many px of the bay's edge, a dragon walking up to the bay keeps FOLLOW_GAP behind one walking up ahead of it. */
export const APPROACH = 250;
/** What a lift ride is worth in walked px when a dragon moved out of a slot picks where to go (the car is the barn's bottleneck). */
export const RIDE_PX = 600;
/** How far short of the bay's edge a dragon waiting at a landing keeps its snout, px (DRAGON_BODY is measured to 0.1 px). */
export const LANDING_CLEAR = 2;
/** A dragon held at the bay's edge this long in all (40 s, over its whole approach) crosses before the car's next rider on its floor boards. */
export const CROSS_MAX = 2400;
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

/**
 * R1 and R3: whether a walker on floor f may not step into the bay now: the car moves past f, or its departure past f
 * is waiting (closing) -- or its rider is walking in and its ride will pass f, so f's bay is clear when it goes
 * (the car's own floor is the rider's until it leaves: bayBusy).
 */
export function bayShut(sim: CareSim, f: number): boolean {
  const L = sim.lift, r = liftRange(sim);
  if (!BAY_FLOORS.has(f)) return false;
  if (r) return (L.moving || L.closing) && f >= r[0] && f <= r[1];
  const d = L.rider == null ? null : sim.dragons.find((q) => q.id === L.rider);
  if (!d || d.f !== L.f || f === L.f || (d.move !== 'board' && d.move !== 'turn' && d.move !== 'ride')) return false;
  const to = d.legs.find((l) => l.f !== d.f)?.f;
  return to != null && f >= Math.min(L.f, to) && f <= Math.max(L.f, to);
}

/**
 * R5 (the shaft holds one dragon): whether the car stands at floor f serving its rider there -- the rider about to
 * board, walking in, aboard while the car waits to leave, or walking off until clear of the bay. No other dragon
 * steps into the bay on f meanwhile (keepers, drawn behind every dragon, still may: R1 alone holds them).
 */
export function bayBusy(sim: CareSim, f: number): boolean {
  const L = sim.lift;
  if (L.rider == null || L.moving || L.f !== f) return false;
  const d = sim.dragons.find((q) => q.id === L.rider);
  // (a rider still waiting to board lets dragons held at the bay's edge on this floor CROSS_MAX or more go first)
  return !!d && d.f === f && !(d.move === 'call' && crossersDue(sim, f));
}

/**
 * Whether a dragon has been held at the bay's edge on floor f CROSS_MAX steps or more: it goes before the next rider
 * there boards. (Its wait counts on through the step it sets off again, until it has walked: not its `bay` move, which
 * that step ends, or it would be held again at once by the rider it was let past.)
 */
function crossersDue(sim: CareSim, f: number): boolean { return sim.dragons.some((o) => o.f === f && o.move !== 'call' && o.waited >= CROSS_MAX); }

/** Whether the car's rider is at work in its bay: walking in, turning, aboard or walking off -- not still waiting to board. */
function riderAtWork(sim: CareSim): boolean {
  const d = sim.lift.rider == null ? null : sim.dragons.find((q) => q.id === sim.lift.rider);
  return !!d && d.move !== 'call';
}

/** Whether a dragon (not the car's rider) may not step into the bay on floor f now: R1/R3, or R5. */
export function bayClosed(sim: CareSim, f: number): boolean { return bayShut(sim, f) || bayBusy(sim, f); }
/**
 * Whether the bay is closed to dragon d: as bayClosed -- but one held at its edge CROSS_MAX or more may step into a
 * bay that is only closing (R3: the car still stands, held by someone else), and the car waits for it too.
 */
function closedTo(sim: CareSim, d: Dragon): boolean {
  if (!bayClosed(sim, d.f)) return false;
  return !(d.waited >= CROSS_MAX && !sim.lift.moving && !bayBusy(sim, d.f));
}

/**
 * R5, the lane: a dragon steps into the bay walking way `dir` only if everyone in it walks the same way (it follows
 * them in, nose to tail) -- never into one coming the other way, or standing there -- so no two dragons ever show one
 * over the other in the shaft; and not while one held at the bay's other edge has waited CROSS_MAX or more, and longer
 * than it (yields): that one crosses next, so a stream of crossers one way never keeps one the other way waiting on.
 */
function laneOpen(sim: CareSim, d: Dragon, dir: 1 | -1): boolean {
  return !yields(sim, d, dir) && !sim.dragons.some((o) => o !== d && o.f === d.f && (dragonInBay(o) || committed(sim, o) === -dir)
    && !(o.facing === dir && (o.move === 'walk' || o.move === 'board' || o.move === 'alight')));
}
/** Whether dragon d, stepping into the bay way `dir`, gives way to one held at the other edge CROSS_MAX or more, and longer than d (then by id). */
function yields(sim: CareSim, d: Dragon, dir: 1 | -1): boolean {
  return sim.dragons.some((o) => o !== d && o.f === d.f && o.move === 'bay' && o.facing === -dir && o.waited >= CROSS_MAX && (o.waited > d.waited || (o.waited === d.waited && o.id < d.id)));
}

/**
 * Whether a walk crosses the bay: the dragon at x (facing its way, clear of the bay) walks through it to `target`.
 * Returns the landing side it steps in from, or null.
 */
function crossing(d: Dragon, target: number): Side | null {
  if (!BAY_FLOORS.has(d.f) || target === d.x) return null;
  const way: 1 | -1 = target > d.x ? 1 : -1, [w0, w1] = bodySpan(d.stage, way, d.x), F = DRAGON_BODY[d.stage].front;
  // (clear of the bay on the near side, and walking to where its body would be in it or past it)
  if (way > 0) return w1 <= LIFT_X0 && target + F > LIFT_X0 ? -1 : null;
  return w0 >= LIFT_X1 && target - F < LIFT_X1 ? 1 : null;
}

/**
 * R4 before the bay: a crosser walking to the bay that has come past its place in that side's landing line (it
 * stepped through the ones waiting there) goes on in rather than stop over them -- held a moment behind one walking
 * in ahead of it (FOLLOW_GAP) too: it is still walking -- the way it walks (+1 or -1), or 0.
 * Until it has crossed, the car does not set off past its floor (R2), no rider boards there, and nobody steps into
 * the bay the other way.
 */
function committed(sim: CareSim, d: Dragon): 0 | 1 | -1 {
  if (d.move !== 'walk' || sim.lift.rider === d.id || !d.legs.length || d.legs[0].f !== d.f) return 0;
  const target = walkTarget(sim, d), side = crossing(d, target), way: 1 | -1 = side === -1 ? 1 : -1;
  if (side == null || d.facing !== way) return 0;
  return (landingPlace(sim, d, side).x - d.x) * way < 0 ? way : 0;
}

/**
 * Where a dragon's body reaches now, [x0, x1]: its stage's body the way it faces (DRAGON_BODY: the tail's side the
 * longer), or either way (its pad, DRAGON_PAD) while it turns.
 */
export function dragonSpan(d: Dragon): [number, number] {
  if (d.move === 'turn') { const P = DRAGON_PAD[d.stage]; return [d.x - P, d.x + P]; }
  return bodySpan(d.stage, d.facing, d.x);
}
/** Whether a dragon's body is in the bay on a floor the bay rule holds on (touching its edge is outside). */
export function dragonInBay(d: Dragon): boolean { const [a, b] = dragonSpan(d); return BAY_FLOORS.has(d.f) && b > LIFT_X0 && a < LIFT_X1; }
/**
 * Whether a dragon may start a paper turn where it stands: not if, turning, its body would swing into a bay it is not
 * in yet while the car moves past, or serves, that floor (R1, R5), or over one in the bay there; it waits at the bay's
 * edge (`bay`) until it may.
 */
function turnClear(sim: CareSim, d: Dragon): boolean {
  const P = DRAGON_PAD[d.stage];
  if (!BAY_FLOORS.has(d.f) || dragonInBay(d) || !inBay(d.x, P)) return true;
  return !bayClosed(sim, d.f) && !sim.dragons.some((o) => o !== d && o.f === d.f && o.move !== 'ride' && dragonInBay(o) && dragonSpan(o)[1] > d.x - P && dragonSpan(o)[0] < d.x + P);
}

/**
 * R2: who stands in the bay on a floor from `lo` to `hi`, so the car may not move: a keeper (x +- 10) or a dragon
 * (its body: dragonSpan) other than the car's rider -- or a crosser with the right of way on its way in (committed).
 * Null if nobody.
 */
export function inTheWay(sim: CareSim, lo: number, hi: number): string | null {
  const on = (f: number) => BAY_FLOORS.has(f) && f >= lo && f <= hi;
  for (const d of sim.dragons) if (d.id !== sim.lift.rider && on(d.f) && !dragonInBay(d) && committed(sim, d)) return d.name;
  return inTheBay(sim, lo, hi);
}

/** Who is in the bay on a floor from `lo` to `hi` (the bay invariant: nobody, while the car moves): a keeper, or a dragon but the car's rider. Null if nobody. */
export function inTheBay(sim: CareSim, lo: number, hi: number): string | null {
  const on = (f: number) => BAY_FLOORS.has(f) && f >= lo && f <= hi;
  for (const k of sim.keepers) if (!k.climbing && on(k.f) && inBay(k.x, KEEPER_HALF)) return k.name;
  for (const d of sim.dragons) if (d.id !== sim.lift.rider && on(d.f) && dragonInBay(d)) return d.name;
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

/**
 * The lowest-index slot of the room that fits the dragon (or a dragon of `stage`: the one it is about to grow into,
 * life.ts) and is free for it (nobody in its way, no one waiting over it), or null.
 */
export function freeSlot(sim: CareSim, d: Dragon, room: Room, stage: Stage = d.stage): Slot | null {
  for (const s of room.slots) if (fitsSlot(s, stage) && !blockers(sim, d, s).length && !lineBlocks(sim, d, s, true, stage)) return s;
  return null;
}

/**
 * The nearest free slot that fits the dragon (or a dragon of `stage`) in any dragon room but the kinds in `not`, by its
 * route there on its own net -- a ride counted RIDE_PX more, for the car's time and the wait for it, so one on its own
 * floor comes first -- ties by room id, then slot index.
 */
export function nearestFree(sim: CareSim, d: Dragon, stage: Stage = d.stage, not: readonly RoomKind[] = []): Slot | null {
  const net = dragonNet(d.stage);
  let best: Slot | null = null, bestCost = Infinity;
  for (const r of sim.rooms) for (const s of r.slots) {
    if (not.includes(r.kind) || !fitsSlot(s, stage) || blockers(sim, d, s).length || lineBlocks(sim, d, s, true, stage)) continue;
    const rt = route({ f: d.f, x: d.x }, { f: s.f, x: s.x }, net), cost = rt ? rt.cost + (s.f !== d.f ? RIDE_PX : 0) : Infinity;
    if (cost < bestCost) { bestCost = cost; best = s; }
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
    if (!fitsSlot(s, d.stage) || lineBlocks(sim, d, s)) continue;
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

/**
 * Route a dragon to a slot it now holds (reserved): from where it stands, on its stage's net. A call it was waiting
 * on is dropped -- unless the new route rides from this landing too, when the call keeps its turn, its wait and its
 * place, with its new stop.
 */
export function sendTo(sim: CareSim, d: Dragon, slot: Slot): void {
  d.slot = slot;
  const r = route({ f: d.f, x: d.x }, { f: slot.f, x: slot.x }, dragonNet(d.stage));
  if (!r) throw new Error(`${d.name}: no way from floor ${d.f} x ${Math.round(d.x)} to floor ${slot.f} x ${slot.x}`);
  if (d.move === 'call') {
    // (a new route that rides from this landing too keeps the call -- its turn, its wait and its place in the line --
    // with its new stop: one waiting at the front never turns back to join the line anew)
    const call = sim.lift.calls.find((c) => c.dragon === d.id), next = r.legs[1];
    if (call && next && r.legs[0].f === d.f && next.f !== d.f) { call.to = next.f; d.legs = r.legs; return; }
    cancelCall(sim, d); d.move = 'still'; d.waited = 0; d.gaitT = 0;
  }
  if (d.move === 'bay') { d.move = 'still'; d.waited = 0; }
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

/** The floor of the room that meets a need (-1: the base has none). */
function roomFloor(sim: CareSim, need: NeedKind): number { return needRoom(sim, need)?.floor ?? -1; }

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
  // (one waiting at a landing for its goal keeps it, and its turn for the car, unless a need falls a tier lower or a job is rushed)
  if (d.move === 'call' && cur && d.slot && sim.rooms[d.slot.room].kind === NEED_ROOM[cur.need]
    && (cur.rushed || !pick.rushed) && tierOf(d.needs[pick.need]) <= tierOf(d.needs[cur.need])) return;
  const here = standingIn(sim, d);
  if (here && NEED_ROOM[pick.need] !== here.kind) {
    const tier = tierOf(pick.dragon.needs[pick.need]);
    let alt: Job | null = null;
    for (const j of sim.jobs) if (j.dragon === d && NEED_ROOM[j.need] === here.kind && tierOf(d.needs[j.need]) === tier && (!alt || sim.compare(j, alt) < 0)) alt = j;
    if (alt) pick = alt;
  }
  if (!pick.rushed && roomFloor(sim, pick.need) !== d.f) {
    // (and one met on its own floor before one a ride away, in the same tier: the one car is the barn's bottleneck)
    const tier = tierOf(d.needs[pick.need]);
    let alt: Job | null = null;
    for (const j of sim.jobs) if (j.dragon === d && roomFloor(sim, j.need) === d.f && tierOf(d.needs[j.need]) === tier && (!alt || sim.compare(j, alt) < 0)) alt = j;
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
/** Held at the bay's edge (the bay rule), standing (its wait, `waited`, counts on until it walks on, into the bay if it crosses). */
function hold(d: Dragon): void { d.move = 'bay'; d.gaitT = 0; }

/** A landing's side of the bay: west (-1) or east (+1). */
export type Side = -1 | 1;

/**
 * The front of a landing: just outside the bay on that side, for a dragon facing the bay (its snout LANDING_CLEAR px
 * short of the bay's edge: DRAGON_BODY's front, the shorter end, so the walk into the car is as short as it can be).
 */
export function landingEdge(stage: Stage, s: Side): number { const F = DRAGON_BODY[stage].front + LANDING_CLEAR; return s < 0 ? LIFT_X0 - F : LIFT_X1 + F; }
const edgeSpot = landingEdge;

/** The side of the bay a dragon waits on: its own (west of the car's middle, or east), or the other if its own landing is off its floor (the deck has only the west). */
export function sideOf(d: Dragon): Side {
  const own: Side = d.x <= LIFT_CX ? -1 : 1;
  return spanOf(d.f, edgeSpot(d.stage, own), dragonNet(d.stage)) >= 0 ? own : own < 0 ? 1 : -1;
}

/**
 * Where a dragon's eye can be, px ahead of its root x when it faces +1, by stage: measured headless over every
 * element's idle, walk and beg (baby 6.5-15.3, young 17.1-24.6, adult 24.7-34.4, elder 26.2-35.1), widened by the
 * eye's ring, 3 px each way.
 */
export const DRAGON_EYE: Readonly<Record<Stage, readonly [number, number]>> = Object.freeze({ baby: [3, 19], young: [14, 28], adult: [21, 38], elder: [23, 39] });
/** Where the body of a dragon of this stage facing this way at x reaches, [x0, x1] (layout.ts DRAGON_BODY). */
export function bodySpan(stage: Stage, facing: 1 | -1, x: number): [number, number] {
  const b = DRAGON_BODY[stage];
  return facing > 0 ? [x - b.back, x + b.front] : [x - b.front, x + b.back];
}
/** Where the eye of a dragon of this stage facing this way at x can be, [x0, x1]. */
export function eyeSpan(stage: Stage, facing: 1 | -1, x: number): [number, number] {
  const [a, b] = DRAGON_EYE[stage];
  return facing > 0 ? [x + a, x + b] : [x - b, x - a];
}

/**
 * A dragon in a landing's line, the place it waits at (or is walking to), and whether it waits drawn behind the
 * dragons standing about it (`back`: its eye clear of their bodies) rather than over them (its body clear of their eyes).
 */
export interface Waiter { d: Dragon; x: number; back: boolean }

/**
 * The side of the bay whose landing line a dragon is in, or null: waiting there for the car (`call`), held at the
 * bay's edge (`bay`: on the side it stands), or on its way to call (its next leg a ride) -- never once the car has it
 * (boarding, riding, walking off) or while it is in the bay.
 */
function lineSide(sim: CareSim, o: Dragon): Side | null {
  if (o.move === 'call') return sideOf(o);
  if (o.move === 'bay') return o.x <= LIFT_CX ? -1 : 1;
  if (sim.lift.rider === o.id || (o.move !== 'walk' && o.move !== 'still' && o.move !== 'turn')) return null;
  const next = o.legs[1];
  return next && next.f !== o.f && !dragonInBay(o) ? sideOf(o) : null;
}

/**
 * The frontmost x in [lo, hi] (the bay's way: the highest on the west side, the lowest on the east) outside every
 * interval in `no` (closed), or null.
 */
function frontmost(s: Side, lo: number, hi: number, no: readonly (readonly [number, number])[]): number | null {
  let x = s < 0 ? hi : lo;
  for (let moved = true; moved;) {
    moved = false;
    for (const [a, b] of no) if (x >= a && x <= b) { x = s < 0 ? a - 0.5 : b + 0.5; moved = true; }
    if (x < lo || x > hi) return null;
  }
  return x;
}

/**
 * A landing's line (floor f, side s): the dragons waiting at it for the car or at the bay's edge, and the ones on their
 * way there, nearest the bay first (then by id), each with the place it waits at. The place is the one nearest the
 * bay on that side of the floor, nose to tail behind the ones ahead (half of each pad and 16 px apart: its head over
 * their rumps), where its body covers no eye: not a slot's (held, or reserved and not reached yet), not a standing
 * dragon's, not one's ahead of it in the line (it is drawn over all of those: depthOf; ART_BIBLE 1.4) -- so one on its
 * way may have to walk back to it (an evictee leaving the slot beside the landing that its evicter is coming to). With
 * no such place, one clear of every eye closer than nose to tail; with none of those either, where it is. One already
 * waiting never walks back, and one held at the bay's edge stays where it stopped. `extra`: a dragon counted in as if
 * it were in this line (a crosser about to be held).
 */
export function landingLine(sim: CareSim, f: number, s: Side, extra: Dragon | null = null): Waiter[] {
  const dist = (o: Dragon) => (s < 0 ? LIFT_X0 - o.x : o.x - LIFT_X1);
  const line = sim.dragons.filter((o) => o.f === f && (o === extra || lineSide(sim, o) === s)).sort((a, b) => dist(a) - dist(b) || a.id - b.id);
  if (!line.length) return [];
  const inLine = new Set(line);
  // who stands about: every slot on this floor (held, or reserved), and every dragon standing on it outside the line and
  // off its slot (not one turning or stopped a moment on its way somewhere: it is gone the next moment)
  const about: { who: Dragon; eye: [number, number]; body: [number, number] }[] = [];
  for (const o of sim.dragons) {
    if (o.slot && o.slot.f === f) about.push({ who: o, eye: eyeSpan(o.stage, o.slot.facing, o.slot.x), body: bodySpan(o.stage, o.slot.facing, o.slot.x) });
    if (o.f === f && o.move !== 'ride' && !walking(o) && !inLine.has(o) && !(o.slot && o.slot.f === f && o.x === o.slot.x) && !(o.legs.length && (o.move === 'turn' || o.move === 'still'))) about.push({ who: o, eye: eyeSpan(o.stage, o.facing, o.x), body: dragonSpan(o) });
  }
  // (the ones waiting there are placed first, nearest the bay first: they never walk back; then the ones on their way,
  // clear of every one waiting whichever is drawn over the other)
  const waiting = line.filter((o) => o.move === 'call' || o.move === 'bay'), isWaiting = new Set(waiting), coming = line.filter((o) => !isWaiting.has(o));
  const out: Waiter[] = [];
  for (const d of [...waiting, ...coming]) {
    const facing: 1 | -1 = s < 0 ? 1 : -1, b = DRAGON_BODY[d.stage], [ea, eb] = DRAGON_EYE[d.stage], edge = edgeSpot(d.stage, s);
    // (anywhere on its side of the floor, from the bay's edge back to the wall)
    const net = dragonNet(d.stage), span = net.spans[f]?.[spanOf(f, edge, net)] ?? [edge, edge];
    const lo = s < 0 ? Math.min(span[0], edge) : edge, hi = s < 0 ? edge : Math.max(span[1], edge);
    // (the x's where its body would reach an eye [e0, e1]; where its eye would be under a body [b0, b1])
    const covers = (e: readonly [number, number]): [number, number] => (facing > 0 ? [e[0] - b.front, e[1] + b.back] : [e[0] - b.back, e[1] + b.front]);
    const under = (o: readonly [number, number]): [number, number] => (facing > 0 ? [o[0] - eb, o[1] - ea] : [o[0] + ea, o[1] + eb]);
    const front: [number, number][] = [], back: [number, number][] = [], gap: [number, number][] = [];
    for (const a of about) if (a.who !== d) { front.push(covers(a.eye)); back.push(under(a.body)); }
    for (const w of out) {
      const wf: 1 | -1 = w.d.move === 'bay' ? w.d.facing : facing, we = eyeSpan(w.d.stage, wf, w.x), wb = bodySpan(w.d.stage, wf, w.x);
      // (drawn over the ones ahead, it covers no eye of theirs; drawn behind, none of theirs covers its eye either; one
      // on its way keeps both clear of every one waiting)
      front.push(covers(we)); back.push(covers(we), under(wb));
      if (!isWaiting.has(d) && isWaiting.has(w.d)) front.push(under(wb));
      const g = (DRAGON_PAD[w.d.stage] + DRAGON_PAD[d.stage]) / 2 + 16;
      gap.push([w.x - g + 0.5, w.x + g - 0.5]);
    }
    const inside = (x: number, no: readonly (readonly [number, number])[]) => no.some(([p, q]) => x >= p && x <= q);
    let w: Waiter | null = null;
    if (d.move !== 'bay') {
      // (one on its way, with nowhere clear, keeps at least nose to tail with the line rather than stop over one in it)
      const tries: [readonly (readonly [number, number])[], boolean][] = [[[...front, ...gap], false], [[...back, ...gap], true], [front, false], [back, true]];
      if (!isWaiting.has(d)) tries.push([gap, false]);
      for (const [no, bk] of tries) {
        const x = frontmost(s, lo, hi, no);
        if (x != null) { w = { d, x, back: bk }; break; }
      }
    }
    // (held at the bay's edge, where it stopped; with nowhere clear, where it is; one already waiting never walks back:
    // it keeps to where it stands until its place is ahead of it -- drawn behind the ones about if that is clear there)
    if (!w || (d.move === 'call' && (w.x - d.x) * facing < 0)) w = { d, x: d.x, back: inside(d.x, front) && !inside(d.x, back) };
    out.push(w);
  }
  // (front first, by place)
  const at = (w: Waiter) => (s < 0 ? LIFT_X0 - w.x : w.x - LIFT_X1);
  return out.sort((a, b) => at(a) - at(b) || a.d.id - b.d.id);
}

/** Where dragon d waits in its landing's line (counted in if it isn't in it yet), and its index there (0: the front). */
export function landingPlace(sim: CareSim, d: Dragon, s: Side = lineSide(sim, d) ?? sideOf(d)): { x: number; i: number } {
  const line = landingLine(sim, d.f, s, d), i = line.findIndex((w) => w.d === d);
  return { x: line[i].x, i };
}

/** Where a dragon walking to the lift stops to call: its place in its landing's line. */
function callX(sim: CareSim, d: Dragon): number { return landingPlace(sim, d).x; }

/**
 * Whether dragon d standing in slot s (as a dragon of `stage`) would have its eye under the body of a dragon waiting in
 * a landing's line on that floor (drawn over it): the slot is not d's to take while that one waits there (3.3;
 * ART_BIBLE 1.4).
 */
function lineBlocks(sim: CareSim, d: Dragon, s: Slot, callers = true, stage: Stage = d.stage): boolean {
  const eye = eyeSpan(stage, s.facing, s.x), body = bodySpan(stage, s.facing, s.x);
  const meet = (p: readonly [number, number], q: readonly [number, number]) => p[0] <= q[1] && p[1] >= q[0];
  for (const side of [-1, 1] as const) {
    for (const w of landingLine(sim, s.f, side)) {
      if (w.d === d || (!callers && w.d.move === 'call')) continue;
      const wf: 1 | -1 = w.d.move === 'bay' ? w.d.facing : side < 0 ? 1 : -1;
      // (one drawn over the slot's dragon must not cover its eye; one drawn behind it must not have its own covered)
      if (w.back ? meet(body, eyeSpan(w.d.stage, wf, w.x)) : meet(bodySpan(w.d.stage, wf, w.x), eye)) return true;
    }
  }
  return false;
}

/**
 * How deep a dragon's feet are drawn on its floor's straw band (px below the floor's feet line; the cast is y-sorted
 * by the feet): waiting in a landing's line, 2 at the front and 1 more per place behind (at most 5), so each one
 * waiting is drawn over the ones ahead of it and over every dragon in a slot -- or, where it waits drawn behind them
 * (landingLine's `back`), -2, behind every dragon standing there and still in front of the keepers (-3); anyone else
 * -1..1 by id, so the sort never ties.
 */
export function depthOf(sim: CareSim, d: Dragon): number {
  const s = d.move === 'call' || d.move === 'bay' ? lineSide(sim, d) : null;
  if (s == null) return (d.id % 3) - 1;
  const line = landingLine(sim, d.f, s), i = line.findIndex((w) => w.d === d);
  return i >= 0 && line[i].back ? -2 : 2 + Math.min(3, Math.max(0, i));
}

/** Where a dragon's feet are drawn: on the lift's car while it rides, else on its floor's band at its depth (depthOf). */
export function feetOf(sim: CareSim, d: Dragon): number { return d.move === 'ride' ? sim.lift.y : feetY(d.f, depthOf(sim, d)); }

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
    // in the car, at its middle: face the side it will walk off (once the last rider, walking off, is clear of its turn), and ride
    const off = d.legs[2], exit = off ? Math.sign(off.x - LIFT_CX) : 0, P = DRAGON_PAD[d.stage];
    d.gaitT = 0;
    if (exit && exit !== d.facing && sim.dragons.some((o) => o !== d && o.f === d.f && o.move !== 'ride' && dragonSpan(o)[1] > d.x - P && dragonSpan(o)[0] < d.x + P)) return;
    d.legs.shift();
    if (exit && exit !== d.facing) startTurn(d); else d.move = 'ride';
    return;
  }
  const next = d.legs[1];
  if (next && next.f !== d.f) {
    // (it waits facing the bay: one that stops where it stands, beside its landing's queue, turns first)
    if (d.facing !== -sideOf(d)) { if (turnClear(sim, d)) startTurn(d); else hold(d); return; }
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
      // (in the car: the turn done, it rides; the car's rider not in it yet goes on boarding, one already carried walking off)
      if (d.legs[0] && d.legs[0].f !== d.f) { d.move = 'ride'; return; }
      if (sim.lift.rider === d.id) d.move = d.legs[1] && d.legs[1].f !== d.f ? 'board' : 'alight';
      break;
    case 'bay':
      // (held: it waits while the bay is closed to it; open, it goes on -- held again at once, the wait going on, if it
      // still may not step in or turn)
      d.waited++;
      if (closedTo(sim, d) || !laneOpen(sim, d, d.facing)) return;
      d.move = 'still';
      break;
  }
  const leg = d.legs[0];
  if (!leg) { settle(d); return; }
  const target = walkTarget(sim, d);
  if (target === d.x) { legDone(sim, d); return; }
  const way: 1 | -1 = target > d.x ? 1 : -1;
  let aim = target;
  const side = sim.lift.rider === d.id ? null : crossing(d, target);
  if (side != null && (closedTo(sim, d) || !laneOpen(sim, d, way))) {
    // (a crosser that would step into a closed bay, or into one coming the other way, waits in that side's landing
    // line, where it covers no eye, facing the bay -- one that has come past its place there goes on in, with the
    // right of way, and waits at the bay's edge only while the car moves past this floor, or its rider is at work in
    // the bay here (one still waiting to board waits for the crosser instead: clearToBoard), or one comes the other way
    // in the bay, or one long held at the other edge goes first (yields); held, it stands short of the places of the
    // ones waiting ahead of it there, its snout clear of their eyes -- or, come too close already, where it is)
    const edge = edgeSpot(d.stage, side), place = landingPlace(sim, d, side).x;
    if ((place - d.x) * way >= 0 || !(d.facing === way && d.move === 'walk')) aim = place;
    else if ((sim.lift.moving && bayShut(sim, d.f)) || (bayBusy(sim, d.f) && riderAtWork(sim)) || yields(sim, d, way) || sim.dragons.some((o) => o !== d && o.f === d.f && dragonInBay(o) && o.facing !== way)) {
      aim = edge;
      for (const w of landingLine(sim, d.f, side)) {
        if (w.d === d || (w.x - d.x) * way < 0) continue;
        const short = w.x - way * (DRAGON_BODY[d.stage].front - DRAGON_EYE[w.d.stage][0] + 2);
        aim = way > 0 ? Math.min(aim, Math.max(d.x, short)) : Math.max(aim, Math.min(d.x, short));
      }
    }
    if (aim === d.x) {
      if (d.facing !== way && turnClear(sim, d)) startTurn(d); else hold(d);
      return;
    }
  }
  const dir: 1 | -1 = aim > d.x ? 1 : -1;
  if (dir !== d.facing) { if (turnClear(sim, d)) startTurn(d); else hold(d); return; }
  let stop = aim;
  // (in the bay, or stepping in, behind one walking the same way: its body FOLLOW_GAP behind that one's, never through
  // it -- the next rider in behind the last walking off, a crosser behind a crosser; and stepping in, behind one ahead
  // of it stepping in too, not yet in the bay: two let go from the bay's edge at once go in one after the other; and
  // walking up to the bay, behind one ahead of it walking up too, within APPROACH of the bay's edge: the two never stop
  // one on the other at the landing -- one held at the bay's edge and one come to wait there)
  const body = DRAGON_BODY[d.stage], [n0, n1] = bodySpan(d.stage, dir, d.x + dir), entering = BAY_FLOORS.has(d.f) && n1 > LIFT_X0 && n0 < LIFT_X1;
  const toward = d.move === 'walk' && sim.lift.rider !== d.id && BAY_FLOORS.has(d.f) && (dir > 0 ? d.x < LIFT_X0 : d.x > LIFT_X1);
  for (const o of sim.dragons) {
    if (o === d || o.f !== d.f || o.facing !== dir || !walking(o)) continue;
    const near = toward && (dir > 0 ? o.x <= LIFT_X1 && LIFT_X0 - o.x < APPROACH : o.x >= LIFT_X0 && o.x - LIFT_X1 < APPROACH);
    if (!(entering || near || dragonInBay(o))) continue;
    const [o0, o1] = bodySpan(o.stage, o.facing, o.x);
    if (dir > 0 && o.x > d.x) stop = Math.min(stop, Math.max(d.x, o0 - FOLLOW_GAP - body.front));
    if (dir < 0 && o.x < d.x) stop = Math.max(stop, Math.min(d.x, o1 + FOLLOW_GAP + body.front));
  }
  // (held a moment: it stands -- the walk bout ends, so the view idles and no paw slides -- and walks on in a new one)
  if (stop === d.x) { d.gaitT = 0; return; }
  if (d.gaitT === 0) d.walkSeq++;
  if (d.move !== 'board' && d.move !== 'alight') d.move = 'walk';
  d.gaitT++;
  // (a crosser's wait at the bay's edge counts on over the whole approach -- let go a moment, held again -- until it is in)
  if (d.move === 'walk' && side == null) d.waited = 0;
  const m = moveAt(gaitOf(d.element, d.stage), d.gaitT), rest = Math.abs(stop - d.x);
  if (m >= rest) { d.x = stop; sim.stats.dragonWalked += rest; } else { d.x += dir * m; sim.stats.dragonWalked += m; }
  // (off the car and clear of the bay: the car is free for its next call)
  if (d.move === 'alight' && !dragonInBay(d)) { d.move = 'walk'; if (sim.lift.rider === d.id) sim.lift.rider = null; }
  if (d.x === target) legDone(sim, d);
}

// ---------- the lift ----------

function dragonById(sim: CareSim, id: number): Dragon {
  const d = sim.dragons.find((q) => q.id === id);
  if (!d) throw new Error(`lift: no dragon ${id}`);
  return d;
}

/**
 * Whether a caller may walk in behind dragon `off`, walking off the car at the caller's floor: it waits on the side
 * `off` walks away from, so the two walk the same way, nose to tail, and never through each other.
 */
function behind(sim: CareSim, c: LiftCall, off: Dragon | null): boolean {
  return !!off && c.f === off.f && sideOf(dragonById(sim, c.dragon)) === -off.facing;
}

/**
 * The dragons standing still (not riding, not walking) with an eye under the body of one standing drawn over it on
 * their floor, or a body over the eye of one standing drawn under it -- both of each such pair (depthOf; DRAGON_BODY
 * and DRAGON_EYE, the worst of every element: ART_BIBLE 1.4). The landing lines place their waiters clear of that;
 * where a crowded landing leaves no such place (4.7), the car takes the one caught up in it first.
 */
export function eyeClashes(sim: CareSim): Set<Dragon> {
  const standing = sim.dragons.filter((o) => o.move !== 'ride' && !(walking(o) && o.gaitT > 0)), out = new Set<Dragon>();
  const lines = new Map<string, Waiter[]>();
  const depth = new Map(standing.map((d) => {
    const s = d.move === 'call' || d.move === 'bay' ? lineSide(sim, d) : null;
    if (s == null) return [d, (d.id % 3) - 1];
    const key = `${d.f}/${s}`, line = lines.get(key) ?? landingLine(sim, d.f, s), i = line.findIndex((w) => w.d === d);
    lines.set(key, line);
    return [d, i >= 0 && line[i].back ? -2 : 2 + Math.min(3, Math.max(0, i))];
  }));
  for (const a of standing) for (const b of standing) {
    if (a === b || a.f !== b.f) continue;
    const da = depth.get(a)!, db = depth.get(b)!;
    if (!(db > da || (db === da && b.id > a.id))) continue;
    const e = eyeSpan(a.stage, a.facing, a.x), [b0, b1] = dragonSpan(b);
    if (b0 <= e[1] && b1 >= e[0]) { out.add(a); out.add(b); }
  }
  return out;
}

/**
 * The caller the car serves next: the highest priority first (a Rush); then one whose waiting has it over another's
 * eye or under another's body (eyeClashes: a crowded landing), so that ends; then the one going for the most pressing
 * need (its tier, as the job queue ranks: 4.3); then any call waiting OVERDUE or more (the oldest first), so nobody
 * waits on for ever; then, while its last rider walks off (`off`), a caller who can walk in behind it; then a caller on
 * the floor the car is at (no empty trip); then the front of a landing's line (it walks through nobody to the car);
 * then the oldest call; then the lowest id.
 */
function nextCall(sim: CareSim, off: Dragon | null = null): LiftCall | null {
  const L = sim.lift, over = (c: LiftCall) => (sim.tick - c.tick >= OVERDUE ? 1 : 0), here = (c: LiftCall) => (c.f === L.f ? 1 : 0);
  let clashes: Set<Dragon> | null = null;
  const clash = (c: LiftCall) => ((clashes ??= eyeClashes(sim)).has(dragonById(sim, c.dragon)) ? 1 : 0);
  const after = (c: LiftCall) => (behind(sim, c, off) ? 1 : 0);
  const tier = (c: LiftCall) => { const d = dragonById(sim, c.dragon), j = d.goalJob == null ? null : sim.jobs.find((q) => q.id === d.goalJob); return j ? tierOf(d.needs[j.need]) : 0; };
  // (the front of its landing's line: nobody to walk through to the car)
  const first = (c: LiftCall) => { const d = dragonById(sim, c.dragon), line = landingLine(sim, d.f, sideOf(d)).filter((w) => w.d.move === 'call' || w.d.move === 'bay'); return line[0]?.d === d ? 1 : 0; };
  let best: LiftCall | null = null;
  for (const c of L.calls) {
    if (!best || (c.prio - best.prio || clash(c) - clash(best) || tier(c) - tier(best) || over(c) - over(best) || (over(c) ? 0 : after(c) - after(best) || here(c) - here(best) || first(c) - first(best)) || best.tick - c.tick || best.dragon - c.dragon) > 0) best = c;
  }
  return best;
}

/**
 * Whether a caller at the car's floor may start walking in: no other dragon in the bay there, but the last rider
 * walking off away from it (it follows that one in, nose to tail: stepDragon keeps it FOLLOW_GAP behind).
 */
function clearToBoard(sim: CareSim, d: Dragon): boolean {
  const way = sideOf(d) < 0 ? 1 : -1;
  if (crossersDue(sim, d.f)) return false;
  return !sim.dragons.some((o) => o !== d && o.f === d.f && ((dragonInBay(o) && !(o.move === 'alight' && o.facing === way)) || committed(sim, o)));
}

function board(sim: CareSim, d: Dragon): void {
  sim.stats.liftWaitMax = Math.max(sim.stats.liftWaitMax, d.waited);
  d.move = 'board'; d.gaitT = 0; d.waited = 0;
}

/**
 * One step of the lift (plan 3.4): a parked car takes the next call (or its rider, once in the car and facing its way
 * off, to its floor); it sets off only when nobody stands in the bay on a floor it will pass (R2), and a departure
 * blocked BAY_CLOSE steps closes the bay to walkers (R3) until it goes; it moves LIFT_SPEED px a step. At the caller's
 * floor the caller boards, once no other dragon is in the bay there; at the rider's floor the rider walks off, and the
 * ride is counted (#11: the lift is used). The car serves one dragon at a time, from its call until it has walked off
 * clear of the bay (R5: the shaft never shows two dragons; travel.ts stepDragon frees the car).
 */
function stepLift(sim: CareSim): void {
  const L = sim.lift;
  if (L.target == null) {
    const d = L.rider == null ? null : dragonById(sim, L.rider);
    if (d && d.move === 'call' && d.f === L.f) { if (clearToBoard(sim, d)) board(sim, d); }
    else if (d && d.move === 'ride') L.target = d.legs[0].f;
    else if (!d || d.move === 'alight') {
      // (free, or its rider walking off: the next call; while one walks off, only a caller who can walk in behind it)
      const c = nextCall(sim, d);
      if (c && (!d || behind(sim, c, d))) {
        L.calls = L.calls.filter((q) => q !== c);
        L.rider = c.dragon;
        if (c.f !== L.f) L.target = c.f;
        else { const n = dragonById(sim, c.dragon); if (clearToBoard(sim, n)) board(sim, n); }
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
    sim.stats.liftRides++;
    sim.use('lift');
  } else if (d.move === 'call' && clearToBoard(sim, d)) board(sim, d);
}

// ---------- the step ----------

/**
 * A lingerer (3.3) standing in a slot beside a landing where a dragon waits or is on its way to wait, its body over
 * the line's front or its eye under it (kitchen and romp slot 1: back to back with the west landing), moves over to a
 * free slot of its own room clear of the landing, so the line can use its front (counted as a dragon moved on).
 */
function clearLandings(sim: CareSim): void {
  const meet = (p: readonly [number, number], q: readonly [number, number]) => p[0] <= q[1] && p[1] >= q[0];
  const first = new Map<string, Dragon>();
  for (const o of sim.dragons) { const s = lineSide(sim, o); if (s != null && !first.has(`${o.f}/${s}`)) first.set(`${o.f}/${s}`, o); }
  if (!first.size) return;
  for (const f of BAY_FLOORS) for (const side of [-1, 1] as const) {
    const w = first.get(`${f}/${side}`);
    if (!w) continue;
    const facing: 1 | -1 = side < 0 ? 1 : -1, e = edgeSpot(w.stage, side), frontEye = eyeSpan(w.stage, facing, e), frontBody = bodySpan(w.stage, facing, e);
    const clear = (st: Stage, sl: Slot) => !meet(bodySpan(st, sl.facing, sl.x), frontEye) && !meet(frontBody, eyeSpan(st, sl.facing, sl.x));
    for (const d of sim.dragons) {
      const sl = d.slot;
      if (!sl || sl.f !== f || d.f !== f || d.x !== sl.x || !lingerer(sim, d, sim.rooms[sl.room]) || clear(d.stage, sl)) continue;
      // (a caller waiting behind the slots steps up to the front it leaves: only the others' places hold it)
      const to = sim.rooms[sl.room].slots.find((q) => q !== sl && fitsSlot(q, d.stage) && clear(d.stage, q) && !blockers(sim, d, q).length && !lineBlocks(sim, d, q, false));
      if (!to) continue;
      d.goal = 'evict'; d.goalJob = null;
      sendTo(sim, d, to);
      sim.stats.evictions++;
    }
  }
}

/**
 * The dragons' half of a step (plan S3): free dragons at a leg boundary choose their goals, in the queue order of their
 * most pressing job, then by id; a lingerer still in the way of a landing's line moves over (clearLandings); every
 * dragon walks, turns or waits, by id; then the lift steps.
 */
export function stepTravel(sim: CareSim): void {
  const who: { d: Dragon; top: Job | null }[] = [];
  for (const d of sim.dragons) if (free(sim, d) && (!d.legs.length || d.move === 'call')) who.push({ d, top: topJob(sim, d) });
  who.sort((a, b) => (a.top && b.top ? sim.compare(a.top, b.top) : a.top ? -1 : b.top ? 1 : 0) || a.d.id - b.d.id);
  for (const { d } of who) choose(sim, d);
  clearLandings(sim);
  for (const d of sim.dragons) stepDragon(sim, d);
  stepLift(sim);
}

/** Whether a dragon is at its slot and ready to be met: standing on it, facing its way, not turning, with no route left. */
export function arrived(_sim: CareSim, d: Dragon): boolean {
  const s = d.slot;
  return !!s && !d.legs.length && d.move === 'still' && d.turn < 0 && d.f === s.f && d.x === s.x && d.facing === s.facing;
}

/** Whether a dragon has a lift ride still to take (or to finish: boarding, or aboard). */
export function ridesLeft(_sim: CareSim, d: Dragon): boolean {
  let f = d.f;
  for (const l of d.legs) { if (l.f !== f) return true; f = l.f; }
  return false;
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
