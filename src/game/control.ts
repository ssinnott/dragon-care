// Taking a keeper (docs/BASE_DESIGN.md 4.10; plan S7, D5, #6): the player may take any one keeper by hand. Care stays
// managerial by default (B2) -- the other keepers go on taking jobs on their own -- but the one taken is the player's:
// walked with WASD or the arrows (and the touch pad), up and down the ladders where they stand at one, and E (Space, or
// the pad's ACT) does the chore in reach: picks up a supply at its post (the bowl, the ball, the bucket), meets the need
// of a dragon waiting in its slot of that need's room -- or a garden resident waiting where it rests -- from the same
// stand spot a keeper sent there would use, or puts a supply back. Esc, a tap on empty space, or the pad's LET GO
// hands them back.
//
// The simulation takes the player's input as commands (CareSim.command), applied in the order they came at the start
// of the next step (applyCommands) and then cleared, so the same commands at the same steps always make the same world
// (G1). The taken keeper is `manual`: auto-assignment skips them, Rush never picks them or takes them off a job, and
// their `phase` is 'manual' (free under the player's hand), 'pickup' (taking a supply) or 'work' (meeting a need).
// DOM-free and deterministic like the rest of the simulation.
//
// Rules (plan S7):
// - take(k): another keeper held by hand is let go first; a keeper at work (a tuck-in, a meal under way) finishes that
//   job first (`pendingTake`), then is the player's where they stand; otherwise any job they hold goes back to the
//   queue (stats.taken counts every take), a climb under way is finished, and anything carried stays carried.
// - steer: the held direction, kept until it changes. A climb goes on; W or S within 8 px of a ladder on this floor
//   that stops at the next floor that way snaps to it and climbs one floor; A or D walks at WALK inside the floor's
//   span, facing that way. The bay rule holds (R1: never stepping into the lift bay while it is shut, waiting at its
//   edge) and R4: a keeper let stand in the bay walks on the way they face until clear (turning at a floor's end in
//   it), so the car is never held by them.
// - act, in this order: pick up (within 24 px of a post, not already carrying its supply: 40 steps, then carried; a
//   different supply carried is swapped); serve (an open job whose dragon has arrived at its slot in its need's room --
//   never one still walking there, D6 -- or a resident waiting; no keeper at work on it; the dragon on this floor with
//   its stand spot within 24 px; for food, play and bath the supply carried): the most pressing such job (the queue's
//   order), a keeper already sent for it handing it over (stats.handovers), the taken keeper stepping onto the stand
//   spot and working as any keeper would; put back (carrying a supply within 24 px of its post); else a "?" over the
//   head for half a second (`cue`).
// - release: no longer the player's; one at work finishes that job first and then goes home, anyone else walks home.
//
// A save never holds a keeper by hand (save.ts serialize): each is saved as released (`releasedState`), exactly the
// world a release that step would make.
import { WALK, CLIMB, PICKUP } from './sim.ts';
import type { CareSim, Keeper, Job } from './sim.ts';
import { ROOM_INFO, LIFT_X0, LIFT_X1, postX, spanOf, route, feetY, bayFloors, GATE_MID } from './layout.ts';
import type { Leg, Room } from './layout.ts';
import { NEED_ROOM, KEEPER_HALF, arrived, bayShut, inBay } from './travel.ts';
import type { NeedKind } from './needs.ts';

/** The player's input to the simulation, applied at the start of the next step: take a keeper (by id), let go, steer, act. */
export type Command = { kind: 'take'; keeper: number } | { kind: 'release' } | { kind: 'steer'; dx: -1 | 0 | 1; dy: -1 | 0 | 1 } | { kind: 'act' };

/**
 * What E would do now (the view's label; act() does the same): pick up a supply, serve a job (its id), put a supply
 * back, nothing yet (`wait`: the dragon is on its way), or nothing. `label` is the line the view shows for it.
 */
export interface ActionPreview { kind: 'pickup' | 'serve' | 'putback' | 'wait' | 'none'; label: string; job?: number }

/** How near a post or a stand spot the taken keeper must stand to use it (px); how near a ladder to climb it. */
export const REACH_PX = 24, LADDER_PX = 8;
/** How long the "?" shows over a keeper whose E did nothing (steps). */
export const CUE_STEPS = 30;
/** What each supply is called on screen. */
export const SUPPLY_NAME: Readonly<Partial<Record<NeedKind, string>>> = Object.freeze({ food: 'BOWL', play: 'BALL', bath: 'BUCKET' });
/** What meeting each need is called on screen: "E: FEED WICK". */
const VERB: Readonly<Record<NeedKind, string>> = Object.freeze({ food: 'FEED', love: 'GROOM', play: 'PLAY WITH', bath: 'BATHE', sleep: 'TUCK IN' });
/** ...and while it is being done. */
const DOING: Readonly<Record<NeedKind, string>> = Object.freeze({ food: 'FEEDING', love: 'GROOMING', play: 'PLAYING WITH', bath: 'BATHING', sleep: 'TUCKING IN' });

const BAY_FLOORS: ReadonlySet<number> = new Set(bayFloors());

/** The keeper held by hand (or about to be: finishing a job first), or null. */
export function controlledKeeper(sim: CareSim): Keeper | null { return sim.keepers.find((k) => k.manual || k.pendingTake) ?? null; }

/** Apply the commands given since the last step, in the order they came, then clear them (the start of CareSim.step). */
export function applyCommands(sim: CareSim): void {
  const cs = sim.commands;
  if (!cs.length) return;
  sim.commands = [];
  for (const c of cs) {
    const k = controlledKeeper(sim);
    switch (c.kind) {
      case 'take': take(sim, c.keeper); break;
      case 'release': if (k) release(sim, k); break;
      case 'steer': if (k) k.held = { dx: c.dx, dy: c.dy }; break;
      case 'act': if (k && k.manual) act(sim, k); break;
    }
  }
}

/** Take keeper `id` (plan S7's take: see the header). */
function take(sim: CareSim, id: number): void {
  const k = sim.keepers.find((q) => q.id === id);
  if (!k) return;
  for (const o of sim.keepers) if (o !== k && (o.manual || o.pendingTake)) release(sim, o);
  if (k.manual || k.pendingTake) return;
  sim.stats.taken++;
  k.held = { dx: 0, dy: 0 }; k.cue = 0;
  // (a job under way is finished first: a tuck-in is never left half done)
  if (k.phase === 'work') { k.pendingTake = true; k.rushing = false; return; }
  becomeManual(k);
}

/** A keeper's job back in the queue (not counted as pre-empted), a climb under way kept, and the keeper the player's. */
export function becomeManual(k: Keeper): void {
  if (k.job) { k.job.keeper = null; k.job = null; }
  k.rushing = false; k.t = 0; k.bayWait = 0; k.pendingTake = false;
  k.legs = k.climbing && k.legs.length ? [k.legs[0]] : [];
  k.phase = 'manual'; k.manual = true;
}

/**
 * The fields a keeper held by hand has once let go -- no longer the player's; at work, still at it (it finishes, then
 * goes home as any keeper does); else walking home (a climb under way first), or idle if already there. A release
 * applies it, and a save stores every keeper held by hand this way (save.ts).
 */
export function releasedState(sim: CareSim, k: Keeper): Pick<Keeper, 'manual' | 'pendingTake' | 'held' | 'cue' | 'phase' | 'legs' | 't'> {
  const base = { manual: false, pendingTake: false, held: { dx: 0 as const, dy: 0 as const }, cue: 0 };
  if (k.phase === 'work') return { ...base, phase: 'work', legs: k.legs.map((l) => ({ ...l })), t: k.t };
  const climb = k.climbing && k.legs.length ? { ...k.legs[0] } : null;
  const r = route(sim.spotOf(k), { f: k.station.floor, x: k.stationX }, sim.nets.keeper);
  const legs: Leg[] = [...(climb ? [climb] : []), ...(r ? r.legs : [])];
  return { ...base, phase: legs.length ? 'home' : 'idle', legs, t: 0 };
}

function release(sim: CareSim, k: Keeper): void { Object.assign(k, releasedState(sim, k)); }

// ---------- walking by hand ----------

/**
 * A step of the keeper held by hand (CareSim.stepKeeper, for any phase but work): the "?" fades; a pickup under way
 * runs on; a climb goes on; else the held direction: a ladder to climb, or a walk -- the bay rule holding.
 */
export function stepManual(sim: CareSim, k: Keeper): void {
  if (k.cue > 0) k.cue--;
  if (k.phase === 'pickup') {
    if (++k.t >= PICKUP) {
      const r = postNear(sim, k);
      if (r) { k.carrying = ROOM_INFO[r.kind].supplies!; sim.use(r.kind); }
      k.phase = 'manual'; k.t = 0;
    }
    return;
  }
  if (k.legs.length) { climbStep(k); return; }
  const { dx, dy } = k.held;
  if (dy) {
    const link = ladderAt(sim, k, dy);
    if (link) { k.x = link.x; k.legs = [{ f: link.to, x: link.x }]; k.bayWait = 0; climbStep(k); return; }
  }
  const inside = BAY_FLOORS.has(k.f) && inBay(k.x, KEEPER_HALF);
  // (R4: let stand in the bay, a keeper walks on the way they face until clear)
  const dir = dx || (inside ? k.facing : 0);
  if (!dir) { k.bayWait = 0; return; }
  walk(sim, k, dir, inside);
}

/** One step up or down the ladder being climbed (the keeper's CLIMB pace; a keeper held by hand never runs). */
function climbStep(k: Keeper): void {
  const leg = k.legs[0];
  k.climbing = true;
  const ty = feetY(leg.f), dy = ty - k.y;
  if (Math.abs(dy) <= CLIMB) { k.y = ty; k.f = leg.f; k.climbing = false; k.legs.shift(); }
  else k.y += Math.sign(dy) * CLIMB;
}

/** A ladder on the keeper's floor within LADDER_PX that goes on to the next floor up (dy -1) or down (dy 1): its x and that floor. */
export function ladderAt(sim: CareSim, k: Keeper, dy: -1 | 1): { x: number; to: number } | null {
  if (k.climbing) return null;
  const to = k.f - dy;
  let best: { x: number; to: number } | null = null;
  for (const l of sim.nets.keeper.links) {
    if (!l.stops.includes(k.f) || !l.stops.includes(to) || Math.abs(k.x - l.x) > LADDER_PX) continue;
    if (!best || Math.abs(k.x - l.x) < Math.abs(k.x - best.x)) best = { x: l.x, to };
  }
  return best;
}

/** Walk a step the way `dir`, inside the floor's span; held at the lift bay's edge while it is shut (R1); never stuck in it (R4). */
function walk(sim: CareSim, k: Keeper, dir: 1 | -1, inside: boolean): void {
  const net = sim.nets.keeper, s = spanOf(k.f, k.x, net);
  if (s < 0) return;
  const [a, b] = net.spans[k.f][s];
  const next = (d: number) => Math.max(a, Math.min(b, k.x + d * WALK));
  let to = next(dir);
  // (R4: at a floor's end inside the bay -- the Aerie deck ends in it -- turn and walk out the other way)
  if (inside && to === k.x) { dir = -dir as 1 | -1; to = next(dir); }
  k.facing = dir;
  if (!inside && BAY_FLOORS.has(k.f) && bayShut(sim, k.f)) {
    const edge = dir > 0 ? LIFT_X0 - KEEPER_HALF : LIFT_X1 + KEEPER_HALF;
    if ((edge - k.x) * dir >= 0 && (to - edge) * dir > 0) {
      if (k.x === edge) { k.bayWait++; return; }
      to = edge;
    }
  }
  k.bayWait = 0;
  const x0 = k.x;
  k.walked += Math.abs(to - x0);
  k.x = to;
  // (#11: a pass through the Garden Gate, counted as it crosses the arches' middle)
  if (k.f === 0 && (x0 < GATE_MID) !== (k.x < GATE_MID)) sim.use('gate');
}

// ---------- the action key ----------

/** The supply room on the keeper's floor whose post is within REACH_PX, or null. */
function postNear(sim: CareSim, k: Keeper): Room | null {
  if (k.climbing) return null;
  let best: Room | null = null;
  for (const r of sim.rooms) {
    if (!ROOM_INFO[r.kind].supplies || r.floor !== k.f || Math.abs(k.x - postX(r)) > REACH_PX) continue;
    if (!best || Math.abs(k.x - postX(r)) < Math.abs(k.x - postX(best))) best = r;
  }
  return best;
}

/** Whether a need is met with a supply fetched first (food, play, bath: a room supplies it). */
function needsSupply(sim: CareSim, need: NeedKind): boolean { return sim.rooms.some((r) => ROOM_INFO[r.kind].supplies === need); }

/** A job's dragon waiting to be met now: arrived at its slot in the need's room (or a resident waiting where it rests), awake, not holding, no one at work with it. */
function ready(sim: CareSim, j: Job): boolean {
  const d = j.dragon;
  if (d.goalJob !== j.id || d.act || d.asleep > 0 || d.hold > 0 || (j.keeper && j.keeper.phase === 'work')) return false;
  if (sim.jobs.some((o) => o !== j && o.dragon === d && o.keeper && o.keeper.phase === 'work')) return false;
  if (d.place === 'garden') return arrived(sim, d);
  return d.place === 'barn' && d.goal === 'need' && !!d.slot && sim.rooms[d.slot.room].kind === NEED_ROOM[j.need] && arrived(sim, d);
}

/** Whether keeper k stands at job j's stand spot (on its floor, within REACH_PX). */
function atStand(sim: CareSim, k: Keeper, j: Job): boolean {
  const d = j.dragon;
  if (k.climbing || (d.place === 'barn' && !d.slot)) return false;
  const sp = sim.standAt(d);
  return sp.f === k.f && Math.abs(k.x - sp.x) <= REACH_PX;
}

/** What E would do now for the keeper held by hand (plan S7's order: pick up, serve, put back; else nothing, or "on the way"). */
export function actionFor(sim: CareSim, k: Keeper): ActionPreview {
  const none = (label = ''): ActionPreview => ({ kind: 'none', label });
  if (!k.manual) return none();
  if (k.phase === 'pickup') { const r = postNear(sim, k); return none(r ? `TAKING THE ${SUPPLY_NAME[ROOM_INFO[r.kind].supplies!]}` : ''); }
  if (k.phase === 'work' && k.job) return none(`${DOING[k.job.need]} ${k.job.dragon.name}`);
  if (k.climbing) return none();
  const post = postNear(sim, k), sup = post ? ROOM_INFO[post.kind].supplies! : null;
  if (sup && k.carrying !== sup) return { kind: 'pickup', label: `E: TAKE ${SUPPLY_NAME[sup]}` };
  // (the jobs whose stand spot this is, most pressing first)
  const here = sim.queue().filter((j) => atStand(sim, k, j));
  const serve = here.find((j) => ready(sim, j) && (!needsSupply(sim, j.need) || k.carrying === j.need));
  if (serve) return { kind: 'serve', label: `E: ${VERB[serve.need]} ${serve.dragon.name}`, job: serve.id };
  if (sup && k.carrying === sup) return { kind: 'putback', label: `E: PUT ${SUPPLY_NAME[sup]} BACK` };
  const want = here.find((j) => ready(sim, j));
  if (want) return none(`${want.dragon.name} WANTS THE ${SUPPLY_NAME[want.need]}`);
  // (a dragon still walking to this slot can't be met yet, D6)
  const coming = here.find((j) => j.dragon.goalJob === j.id && !(j.keeper && j.keeper.phase === 'work') && !j.dragon.act);
  if (coming) return { kind: 'wait', label: `${coming.dragon.name} IS ON THE WAY` };
  return none();
}

/** E: do what actionFor says -- or, if that is nothing, show the "?" a moment. */
function act(sim: CareSim, k: Keeper): void {
  if (k.phase !== 'manual') return;
  const p = actionFor(sim, k);
  if (p.kind === 'pickup') { k.phase = 'pickup'; k.t = 0; k.bayWait = 0; return; }
  if (p.kind === 'putback') { k.carrying = null; return; }
  if (p.kind === 'serve') {
    const j = sim.jobs.find((q) => q.id === p.job)!;
    const other = j.keeper;
    // (a keeper already sent for it hands it over, and goes home)
    if (other && other !== k) { sim.drop(other); sim.stats.handovers++; }
    // (onto the same stand spot a keeper sent there would use: K7, eye-safe)
    const sp = sim.standAt(j.dragon);
    k.x = sp.x; k.legs = []; k.bayWait = 0;
    j.keeper = k; k.job = j; k.rushing = false;
    sim.startWork(k);
    return;
  }
  k.cue = CUE_STEPS;
}

