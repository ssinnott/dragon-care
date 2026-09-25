// Headless check of the base's care simulation (src/game/sim.ts; docs/BASE_DESIGN.md 4). No browser: the simulation
// is plain data and functions, so Node runs it directly.
//
//   node tools/sim-check.ts        (npm run sim; part of npm run check)
//
// 1. Routes on both nets: every keeper, from their station, reaches every slot's stand spot (for every stage that fits
//    the slot), every supply post, the riders' rooms and the Aerie deck, and back (the ladders, the doors); every stage's
//    dragon net joins every slot that fits it to every other and to the deck, both ways, by the Dragon Lift and never
//    through a tower; every stand spot is inside its room.
// 2. Thirty minutes of play on the starting base, with the invariants checked as it runs: needs stay in 0..1, one
//    job per dragon and need, a claimed job and its keeper point at each other, one keeper per dragon at a time,
//    nobody stands off a floor, nobody stalls; then the service it gave: no need ever empties, and the wait from a
//    job opening to a keeper starting on it stays short.
// 3. Two runs from one seed agree step for step (on the digest: the whole save, less the seed); two seeds differ.
// 4. Rush with every keeper busy: the job goes to the top, a keeper comes off the lowest job for it, and it's done.
// 5. The start cast (#9): seven dragons, one of each element, every one adult and 0 days into the stage, ids 0-6.
// 6. Saves: a world saved at step 5000 and loaded (through JSON) steps on to the same world as the one it came from,
//    from that save and from more taken mid-fetch, mid-climb, mid-job and mid-Rush; a save survives JSON unchanged,
//    every field is in it; another version throws.
// 7. rngAt: the same keys give the same draws, different tags different ones, and the draws are even.
// 8. Rooms (#11): every room kind and structure has a purpose, each need is met in exactly one kind of room, the plates
//    name only rooms and structures there are (none on a bare slot), placing rooms and dragons keeps the building's
//    rules (no room on the lift; a slot per dragon, fitting its stage); and over the whole suite every named room, the
//    lift and the Aerie were used (sim.stats.used), unless their mechanic is still PLANNED -- and a PLANNED one that
//    shows a use fails, so its entry must go.
import { isDeepStrictEqual } from 'node:util';
import { CareSim, REACH, DAY_STEPS, START_HOUR } from '../src/game/sim.ts';
import type { DragonPlace } from '../src/game/start.ts';
import type { Keeper } from '../src/game/sim.ts';
import { START_ROOMS, START_DRAGONS, START_KEEPERS } from '../src/game/start.ts';
import { startSpec, PRESETS } from '../src/game/presets.ts';
import { serialize, SaveVersionError, SAVE_VERSION } from '../src/game/save.ts';
import { rngAt, mix32, TAG } from '../src/game/rand.ts';
import {
  route, spanOf, postX, placeRooms, platesOf, standSpot, fitsSlot, dragonNet, feetY, floorTop, KEEPER_NET, ROOM_INFO, ROOM_KINDS, STRUCTURES,
  AERIE_F, BARN_X, TOWER_R, DECK_X0, DECK_X1, LIFT_X0, LIFT_X1, LIFT_CX, CLIMB_COST, WALL_H,
} from '../src/game/layout.ts';
import type { Spot, RoomKind } from '../src/game/layout.ts';
import { NEEDS, FPS, hasNeed } from '../src/game/needs.ts';
import { DRAGON_ELEMENTS } from '../src/art/dragon/palettes.ts';
import { STAGES } from '../src/art/dragon/stages.ts';

const fails: string[] = [];
const fail = (m: string) => { if (fails.length < 40) fails.push(m); };
const newSim = (seed = 1) => new CareSim(START_ROOMS, START_DRAGONS, START_KEEPERS, { seed });
/** Every use of a room or structure (stats.used) over the whole suite: each section notes the worlds it ran (8 checks it). */
const USED: Record<string, number> = {};
const noteUse = (...sims: CareSim[]) => { for (const w of sims) for (const [k, v] of Object.entries(w.stats.used)) USED[k] = (USED[k] ?? 0) + v; };
/**
 * The rooms and structures whose mechanic a later slice builds (plan 3.9): they must show no use yet, and each entry
 * goes when its mechanic lands (S3 the lift; S5 the hatchery; S8 the tack room, the bunks, the map room, the Aerie).
 */
const PLANNED: ReadonlySet<string> = new Set(['lift', 'hatchery', 'tack', 'bunks', 'maproom', 'aerie']);

// ---------- 1. routes on both nets ----------
{
  const sim = newSim();
  const at = (s: Spot) => `f${s.f} x ${Math.round(s.x)}`;
  // the keepers: every stand spot (every stage that fits its slot), every supply and riders' post, and the deck
  const targets: { what: string; at: Spot }[] = [];
  for (const r of sim.rooms) {
    for (const sl of r.slots) for (const st of STAGES) {
      if (!fitsSlot(sl, st)) continue;
      const sp = standSpot(sl, st, r);
      if (sp.f !== r.floor || sp.x < r.x0 + 10 || sp.x > r.x1 - 10) fail(`the ${r.kind}'s slot ${sl.i} stand spot for a ${st} is ${at(sp)}, outside the room's ${r.x0 + 10}..${r.x1 - 10}`);
      targets.push({ what: `the ${r.kind}'s slot ${sl.i} (${st})`, at: sp });
    }
    if (ROOM_INFO[r.kind].supplies || ROOM_INFO[r.kind].people) targets.push({ what: `the ${r.kind}'s post`, at: { f: r.floor, x: postX(r) } });
  }
  targets.push({ what: 'the Aerie deck', at: { f: AERIE_F, x: 300 } });
  for (const k of sim.keepers) for (const t of targets) {
    if (!route({ f: k.f, x: k.x }, t.at, KEEPER_NET)) fail(`no route from ${k.name}'s station to ${t.what} (${at(t.at)})`);
    if (!route(t.at, { f: k.f, x: k.x }, KEEPER_NET)) fail(`no route from ${t.what} (${at(t.at)}) back to ${k.name}'s station`);
  }
  // the dragons: per stage, every slot that fits to every other and to two deck spots, both ways, on its own net; every
  // leg in the barn (x 168..1192 on floors 0-2) or on the deck (x 8..648 on floor 5), a floor changed only by the lift
  let dragonRoutes = 0, liftRides = 0;
  for (const st of STAGES) {
    const net = dragonNet(st);
    const spots = [...sim.rooms.flatMap((r) => r.slots.filter((sl) => fitsSlot(sl, st)).map((sl) => ({ what: `the ${r.kind}'s slot ${sl.i}`, at: { f: sl.f, x: sl.x } }))),
      { what: 'the deck at 120', at: { f: AERIE_F, x: 120 } }, { what: 'the deck at 280', at: { f: AERIE_F, x: 280 } }];
    for (const a of spots) for (const b of spots) {
      if (a === b) continue;
      const rt = route(a.at, b.at, net);
      if (!rt) { fail(`${st}: no dragon route from ${a.what} (${at(a.at)}) to ${b.what} (${at(b.at)})`); continue; }
      dragonRoutes++;
      let f = a.at.f;
      for (const l of rt.legs) {
        if (l.f <= 2 ? l.x < BARN_X || l.x > TOWER_R : l.f !== AERIE_F || l.x < DECK_X0 || l.x > DECK_X1) fail(`${st}: the route from ${a.what} to ${b.what} has a leg at ${at(l)}, off the barn and the deck`);
        if (l.f !== f) { liftRides++; if (l.x !== LIFT_CX) fail(`${st}: the route from ${a.what} to ${b.what} changes floor at x ${l.x}, not the lift's ${LIFT_CX}`); }
        f = l.f;
      }
    }
  }
  // the lift's hayloft-to-Aerie run is one edge (floors 3 and 4 passed through), costed at its rise
  const up = route({ f: 2, x: 792 }, { f: AERIE_F, x: 280 }, dragonNet('adult'));
  const upCost = (792 - LIFT_CX) + (feetY(2) - feetY(AERIE_F)) * CLIMB_COST + (LIFT_CX - 280);
  if (!up || up.legs.map(at).join(' / ') !== `f2 x ${LIFT_CX} / f5 x ${LIFT_CX} / f5 x 280` || Math.abs(up.cost - upCost) > 1e-9) fail(`the lift from the hayloft to the Aerie: ${up ? `${up.legs.map(at).join(' / ')} costing ${up.cost}` : 'no route'}, not one ride costing ${upCost}`);
  // no dragon net reaches a tower, and no keeper rides the lift
  for (const st of STAGES) if (route({ f: 0, x: 792 }, { f: 3, x: 112 }, dragonNet(st))) fail(`${st}: a dragon route reaches the left tower's floor 3`);
  if (KEEPER_NET.links.some((l) => l.name === 'lift')) fail('the keepers\' net has the lift in it');
  for (const d of sim.dragons) if (spanOf(d.f, d.x, dragonNet(d.stage)) < 0) fail(`${d.name} stands off its stage's dragon floor (${at(d)})`);
  noteUse(sim);
  console.log(`  1 routes: keepers ${sim.keepers.length} x ${targets.length} places (every stand spot, post and the deck), both ways; dragons ${dragonRoutes} routes on ${STAGES.length} stages' nets, ${liftRides} lift rides among them, none through a tower; hayloft to Aerie ${up ? up.cost : '-'} px in one ride`);
}

// ---------- 2. thirty minutes of play ----------
{
  const sim = newSim(1), MIN = 30, steps = MIN * 60 * FPS;
  const still = new Map<Keeper, { key: string; since: number }>();
  for (let s = 0; s < steps; s++) {
    sim.step();
    if (s % 30) continue;
    for (const d of sim.dragons) for (const k of NEEDS) {
      const v = d.needs[k];
      if (!(v >= 0 && v <= 1)) fail(`step ${sim.tick}: ${d.name}'s ${k} is ${v}`);
      if (!hasNeed(d.element, k) && v !== 1) fail(`step ${sim.tick}: ${d.name} has a ${k} need it shouldn't`);
    }
    const seen = new Set<string>();
    for (const j of sim.jobs) {
      const key = `${j.dragon.id}/${j.need}`;
      if (seen.has(key)) fail(`step ${sim.tick}: two ${j.need} jobs for ${j.dragon.name}`);
      seen.add(key);
      if (j.keeper && j.keeper.job !== j) fail(`step ${sim.tick}: job ${j.id}'s keeper ${j.keeper.name} is on another job`);
    }
    for (const d of sim.dragons) if (sim.jobs.filter((j) => j.dragon === d && j.keeper).length > 1) fail(`step ${sim.tick}: two keepers on ${d.name}`);
    for (const k of sim.keepers) {
      if (k.job && !sim.jobs.includes(k.job)) fail(`step ${sim.tick}: ${k.name} is on a job that is gone`);
      if ((k.phase === 'idle') !== (!k.job && !k.legs.length)) fail(`step ${sim.tick}: ${k.name} is ${k.phase} with ${k.job ? 'a job' : 'no job'}`);
      if (!k.climbing && spanOf(k.f, k.x) < 0) fail(`step ${sim.tick}: ${k.name} stands off floor ${k.f} at x ${k.x.toFixed(1)}`);
      // a keeper who isn't idle, picking up or working must be getting somewhere
      const key = `${k.phase}@${k.x.toFixed(1)},${k.y.toFixed(1)}`, was = still.get(k);
      if (!was || was.key !== key) still.set(k, { key, since: sim.tick });
      else if (!['idle', 'pickup', 'work'].includes(k.phase) && sim.tick - was.since > 10 * FPS) fail(`step ${sim.tick}: ${k.name} has stood still ${k.phase} for 10 s`);
    }
  }
  const st = sim.stats, avg = st.waitSum / Math.max(1, st.started) / FPS, max = st.waitMax / FPS;
  console.log(`  2 ${MIN} min: ${st.opened} jobs opened, ${st.done} done, ${st.closed} closed by their rooms; wait avg ${avg.toFixed(1)} s, max ${max.toFixed(1)} s; queue at most ${st.queueMax}; ${st.emptySteps} steps with a need at 0; rooms used ${Object.entries(st.used).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  const busy = sim.keepers.map((k) => k.name).join(' ');
  if (st.done < 60) fail(`only ${st.done} jobs done in ${MIN} minutes (keepers: ${busy})`);
  if (st.emptySteps > 0) fail(`a need sat at 0 for ${st.emptySteps} dragon-steps: too few keepers for this barn`);
  if (avg > 30) fail(`jobs waited ${avg.toFixed(1)} s on average for a keeper to start (want <= 30)`);
  if (max > 120) fail(`a job waited ${max.toFixed(1)} s for a keeper to start (want <= 120)`);
  if (sim.jobs.length > sim.dragons.length * 2) fail(`the queue ended ${sim.jobs.length} long`);
  noteUse(sim);
}

// ---------- 3. the same seed, the same world ----------
{
  const a = newSim(7), b = newSim(7);
  for (let s = 1; s <= 20000; s++) {
    a.step(); b.step();
    if (s % 1000 === 0 && a.digest() !== b.digest()) { fail(`two runs from seed 7 differ by step ${s}`); break; }
  }
  if (newSim(7).digest() === newSim(8).digest()) fail('seeds 7 and 8 start the same world');
  noteUse(a);
  console.log('  3 determinism: two runs from one seed agree over 20000 steps; seeds 7 and 8 differ at step 0');
}

// ---------- 4. Rush with every keeper busy ----------
{
  const sim = newSim(3);
  // every dragon hungry and lonely at once: more jobs than keepers
  for (const d of sim.dragons) { d.needs.love = 0.2; if (hasNeed(d.element, 'food')) d.needs.food = 0.3; }
  sim.step();
  const waiting = sim.queue().filter((j) => !j.keeper && !sim.jobs.some((o) => o.dragon === j.dragon && o.keeper));
  if (sim.keepers.some((k) => !k.job)) fail('rush: a keeper was free with the queue full');
  const j = waiting[waiting.length - 1];
  if (!j) fail('rush: nothing waiting to rush');
  else {
    const before = sim.stats.preempted;
    sim.rush(j);
    if (sim.queue()[0] !== j) fail(`rush: ${j.dragon.name}'s ${j.need} is not first in the queue`);
    if (!j.keeper) fail('rush: no keeper took the rushed job');
    if (sim.stats.preempted !== before + 1) fail('rush: no keeper came off another job');
    const who = j.keeper, dragon = j.dragon.name, need = j.need;
    let s = 0;
    while (sim.jobs.includes(j) && s++ < 60 * FPS) sim.step();
    if (sim.jobs.includes(j)) fail(`rush: ${dragon}'s ${need} was not done within 60 s`);
    else console.log(`  4 rush: ${dragon}'s ${need} (last in a queue of ${waiting.length}) done by ${who?.name} in ${(s / FPS).toFixed(1)} s`);
    // the keeper stands in front of the snout to work (REACH), on the dragon's floor
    const d = sim.dragons[0], at = sim.standAt(d);
    if (at.f !== d.f || Math.abs(at.x - (d.x + d.facing * REACH[d.stage])) > 200) fail('standAt: not in front of the dragon');
  }
  noteUse(sim);
}

// ---------- 5. the start cast: a young adult of each kind (#9) ----------
{
  const sim = newSim(1);
  const ds = sim.dragons, els = new Set(ds.map((d) => d.element)), ids = ds.map((d) => d.id);
  if (ds.length !== 7) fail(`start: ${ds.length} dragons, not 7`);
  if (els.size !== 7 || DRAGON_ELEMENTS.some((el) => !els.has(el))) fail(`start: the elements are ${[...els].join(' ')}, not one of each`);
  for (const d of ds) {
    if (d.stage !== 'adult') fail(`start: ${d.name} is ${d.stage}, not adult`);
    if (sim.clock - d.stageSince !== 0) fail(`start: ${d.name} is ${sim.clock - d.stageSince} steps into adulthood, not 0`);
  }
  if (new Set(ids).size !== ids.length || ids.some((id, i) => id !== i)) fail(`start: the ids are ${ids.join(',')}, not 0-6`);
  if (sim.nextDragonId !== 7) fail(`start: the next dragon id is ${sim.nextDragonId}, not 7`);
  if (sim.dayLen !== DAY_STEPS || sim.clock !== START_HOUR * DAY_STEPS / 24) fail(`start: the clock starts at ${sim.clock} of a ${sim.dayLen}-step day, not 07:00`);
  // a start some days into its stage, on a short test day
  const later = new CareSim(START_ROOMS, [{ ...START_DRAGONS[0], days: 2.5 }], START_KEEPERS, { dayLen: 600 });
  if (later.clock0 !== 175 || later.clock - later.dragons[0].stageSince !== 1500) fail(`start: 2.5 days into a stage on a 600-step day is ${later.clock - later.dragons[0].stageSince} steps, not 1500`);
  // the presets: every stage among the ages cast; no name, or an unknown one, is the new game
  const ages = new CareSim(startSpec('ages').rooms, startSpec('ages').dragons, startSpec('ages').keepers);
  const stages = new Set(ages.dragons.map((d) => d.stage));
  if (STAGES.some((st) => !stages.has(st))) fail(`preset ages: stages ${[...stages].join(' ')}, not all four`);
  if (startSpec(null).dragons !== START_DRAGONS || startSpec('nope').dragons !== START_DRAGONS) fail('startSpec: no preset should be the new game');
  console.log(`  5 start: ${ds.map((d) => `${d.id} ${d.name} (${d.element})`).join(', ')}; all adult, 0 days in, at clock ${sim.clock}; presets ${Object.keys(PRESETS).join(' ')} (ages: ${ages.dragons.length} dragons, ${stages.size} stages)`);
}

// ---------- 6. saves: exact, by id, through JSON ----------
{
  const through = <T>(v: T): T => JSON.parse(JSON.stringify(v));
  const a = newSim(1);
  for (let s = 0; s < 5000; s++) a.step();
  const blob = serialize(a);
  if (!isDeepStrictEqual(blob, through(blob))) fail('save: the save changes through JSON');
  if (blob.v !== SAVE_VERSION || blob.seed !== 1) fail(`save: version ${blob.v}, seed ${blob.seed}`);
  // every field of every dragon, keeper and job is in the save
  const missing = (live: object, saved: object, what: string) => { for (const k of Object.keys(live)) if (!(k in saved)) fail(`save: ${what} has no ${k}`); };
  a.dragons.forEach((d, i) => missing(d, blob.dragons[i], `dragon ${d.name}`));
  a.keepers.forEach((k, i) => missing(k, blob.keepers[i], `keeper ${k.name}`));
  a.jobs.forEach((j, i) => missing(j, blob.jobs[i], `job ${j.id}`));
  missing(a.stats, blob.stats, 'stats');
  // and every field of the world itself: a field a later slice adds to CareSim (a lift, a garden, a board) fails here
  // until it is saved, or listed below with the reason it needn't be (the digest is the save, so it can't see one left out)
  const UNSAVED: Readonly<Record<string, string>> = { rooms: 'placed again from roomPlaces', roomPlaces: 'saved as rooms', events: 'one step\'s output, cleared by the next' };
  for (const k of Object.keys(a)) if (!(k in blob) && !(k in UNSAVED)) fail(`save: the world's ${k} is not in its save (save it, or say in sim-check why not)`);
  const b = CareSim.fromSave(through(serialize(a)));
  if (b.digest() !== a.digest()) fail('save: a loaded world differs from its save at once');
  // a slot comes back as its room's own slot (by room id and index), and the rooms' uses as a copy of their own
  for (const d of b.dragons) if (d.slot !== b.rooms[d.slot.room]?.slots[d.slot.i]) fail(`save: ${d.name}'s slot is not its room's own after loading`);
  if (!Object.keys(a.stats.used).length || !isDeepStrictEqual(b.stats.used, a.stats.used) || b.stats.used === blob.stats.used) fail('save: the rooms\' uses (stats.used) were not saved and loaded as their own copy');
  if (b.seed !== a.seed || b.clock !== a.clock) fail('save: the seed or the clock was not kept');
  for (let s = 0; s < 5000; s++) { a.step(); b.step(); }
  if (a.digest() !== b.digest()) fail('save: a world saved at step 5000 and loaded has drifted from its original by step 10000');
  // more saves, taken from one run whenever something is under way that no save so far has caught (a keeper fetching,
  // picking up, on the way, at work, going home or halfway up a ladder; a dragon mid-act or asleep; a rushed job),
  // each stepped 5000 on in lockstep with the run it came from (the Rush reaching every world alive then) and compared
  const ref = newSim(1), forks: { sim: CareSim; at: number }[] = [], live: typeof forks = [], caught = new Set<string>();
  const WANT = ['fetch', 'pickup', 'go', 'work', 'home', 'climbing', 'act', 'asleep', 'rushed'];
  const under = (w: CareSim) => new Set([...w.keepers.map((k) => (k.climbing ? 'climbing' : k.phase)), ...w.dragons.filter((d) => d.act).map((d) => (d.asleep ? 'asleep' : 'act')),
    ...(w.jobs.some((j) => j.rushed) ? ['rushed'] : [])]);
  let rushed = false;
  for (let s = 1; s <= 25000 && (s <= 20000 || live.length); s++) {
    // (a Rush on the last job in the queue, the first time one is open from step 6000, so a save catches one)
    if (s >= 6000 && !rushed && ref.jobs.length) {
      const id = ref.queue()[ref.jobs.length - 1].id;
      for (const w of [ref, ...live.map((f) => f.sim)]) { const j = w.jobs.find((q) => q.id === id); if (j) w.rush(j); else fail(`save: job ${id} is missing from a loaded world at step ${s}`); }
      rushed = true;
    }
    ref.step();
    for (const f of live) f.sim.step();
    for (let i = live.length - 1; i >= 0; i--) {
      const f = live[i];
      if (s < f.at + 5000) continue;
      if (f.sim.digest() !== ref.digest()) fail(`save: a world saved at step ${f.at} and loaded drifted by step ${s}`);
      live.splice(i, 1);
    }
    if (s >= 5000 && s <= 20000 && forks.length < 16) {
      const now = [...under(ref)].filter((p) => WANT.includes(p) && !caught.has(p));
      if (now.length) { const f = { sim: CareSim.fromSave(through(serialize(ref))), at: s }; forks.push(f); live.push(f); for (const p of now) caught.add(p); }
    }
  }
  if (live.length) fail(`save: ${live.length} loaded worlds were never compared`);
  noteUse(a, b, ref, ...forks.map((f) => f.sim));
  for (const p of WANT) if (!caught.has(p)) fail(`save: no save caught a world with something ${p}`);
  let threw: unknown = null;
  try { CareSim.fromSave({ ...serialize(a), v: 999 }); } catch (e) { threw = e; }
  if (!(threw instanceof SaveVersionError)) fail(`save: a version-999 save ${threw ? `threw ${threw}` : 'loaded'}, not a SaveVersionError`);
  console.log(`  6 saves: ${JSON.stringify(blob).length} bytes at step 5000; loaded, it and ${forks.length} more saves (steps ${forks.map((f) => f.at).join(' ')}: ${[...caught].join(', ')}) step on 5000 to the same world; v 999 throws ${threw instanceof Error ? threw.name : threw}`);
}

// ---------- 7. rngAt: stateless draws ----------
{
  const seq = (r: { next(): number }) => Array.from({ length: 100 }, () => r.next());
  if (!isDeepStrictEqual(seq(rngAt(1, TAG.EGG, 3, 4)), seq(rngAt(1, TAG.EGG, 3, 4)))) fail('rngAt: the same keys gave different draws');
  const tags = Object.values(TAG), firsts = tags.map((t) => rngAt(1, t, 0).next());
  if (new Set(firsts).size !== tags.length) fail(`rngAt: two tags share a first draw (${firsts.map((v) => v.toFixed(4)).join(' ')})`);
  if (mix32(1, 2) === mix32(2, 1) || mix32(1) === mix32(1, 0)) fail('mix32: the keys\' order or count is lost');
  if (rngAt(1, TAG.EGG, 3).next() === rngAt(2, TAG.EGG, 3).next()) fail('rngAt: two seeds gave the same draw');
  let keyed = 0, run = 0;
  for (let i = 0; i < 10000; i++) keyed += rngAt(1, TAG.BOARD, i).next();
  const one = rngAt(1, TAG.MISSION, 5);
  for (let i = 0; i < 10000; i++) run += one.next();
  keyed /= 10000; run /= 10000;
  if (!(keyed >= 0.49 && keyed <= 0.51)) fail(`rngAt: the first draws of 10000 keys average ${keyed.toFixed(4)}`);
  if (!(run >= 0.49 && run <= 0.51)) fail(`rngAt: 10000 draws from one key average ${run.toFixed(4)}`);
  console.log(`  7 rngAt: the same keys, the same draws; ${tags.length} tags, ${tags.length} first draws; the mean of 10000 draws is ${keyed.toFixed(4)} over keys, ${run.toFixed(4)} from one`);
}

// ---------- 8. rooms: a purpose each, and every named one used (#11) ----------
{
  // every room kind and structure says what it is for; each need is met in exactly one kind of room
  for (const k of ROOM_KINDS) if (!ROOM_INFO[k].purpose?.trim()) fail(`rooms: the ${k} has no purpose`);
  for (const [k, v] of Object.entries(STRUCTURES)) if (!v.purpose.trim()) fail(`rooms: the ${k} has no purpose`);
  for (const n of NEEDS) {
    const by = ROOM_KINDS.filter((k) => ROOM_INFO[k].meets === n);
    if (by.length !== 1) fail(`rooms: ${n} is met in ${by.length ? by.join(', ') : 'no room'}, not exactly one kind`);
  }
  // the plates: one per room, the lift's and the Aerie's; each names a room placed or a structure, and sits on it (so
  // never on a bare slot): a room's inside its wall, the lift's in its ground-floor bay, the Aerie's over the deck
  const sim = newSim(), plates = platesOf(sim.rooms);
  if (plates.length !== sim.rooms.length + 2) fail(`plates: ${plates.length} for ${sim.rooms.length} rooms and the 2 structures`);
  const inside = (p: { x: number; y: number; w: number; h: number }, x0: number, x1: number, y0: number, y1: number) => p.x >= x0 && p.x + p.w <= x1 && p.y >= y0 && p.y + p.h <= y1;
  for (const p of plates) {
    if (!(p.names in ROOM_INFO) && !(p.names in STRUCTURES)) { fail(`plates: "${p.text}" names ${p.names}, which is no room or structure`); continue; }
    const r = p.room == null ? null : sim.rooms[p.room];
    const ok = r ? r.kind === p.names && p.text === ROOM_INFO[r.kind].name && inside(p, r.x0, r.x1, floorTop(r.floor), floorTop(r.floor) + WALL_H)
      : p.names === 'lift' ? inside(p, LIFT_X0, LIFT_X1, floorTop(0), floorTop(0) + WALL_H)
      : p.names === 'aerie' && inside(p, DECK_X0, DECK_X1, 0, feetY(AERIE_F) - 8);
    if (!ok) fail(`plates: "${p.text}" at (${p.x}, ${p.y}) is not on the ${p.names} it names`);
  }
  // placing keeps the rules: no room on the lift's module; a dragon in a slot of its size, alone in it, and a module
  // holding one grown dragon or up to two babies (each of these must throw)
  const throws = (what: string, f: () => unknown) => { try { f(); fail(`rooms: ${what} was allowed`); } catch { /* as it should */ } };
  throws('a barn room on the lift', () => placeRooms([{ kind: 'bath', part: 'barn', floor: 1, mod: 1, width: 2 }]));
  throws('a dragon room in a tower', () => placeRooms([{ kind: 'kitchen', part: 'towerR', floor: 0 }]));
  const one = (p: Partial<DragonPlace> & { slot: { room: RoomKind; i: number } }): DragonPlace => ({ name: 'T', element: 'fire', stage: 'adult', seed: 1, ...p });
  throws('two dragons in one slot', () => new CareSim(START_ROOMS, [one({ slot: { room: 'kitchen', i: 0 } }), one({ name: 'U', slot: { room: 'kitchen', i: 0 } })], START_KEEPERS));
  throws('a grown dragon in a baby\'s sub-slot', () => new CareSim(START_ROOMS, [one({ slot: { room: 'kitchen', i: 2 } })], START_KEEPERS));
  throws('a baby in a module slot', () => new CareSim(START_ROOMS, [one({ stage: 'baby', slot: { room: 'kitchen', i: 0 } })], START_KEEPERS));
  throws('a baby beside a grown dragon in one module', () => new CareSim(START_ROOMS, [one({ slot: { room: 'kitchen', i: 0 } }), one({ name: 'U', stage: 'baby', slot: { room: 'kitchen', i: 2 } })], START_KEEPERS));
  throws('a grown dragon in the hatchery', () => new CareSim(START_ROOMS, [one({ slot: { room: 'hatchery', i: 0 } })], START_KEEPERS));
  // the start stands in the start slots of plan 3.3, facing its slot's way
  const want: Readonly<Record<string, string>> = { EMBER: 'kitchen 0', RIPPLE: 'bath 0', ZAP: 'romp 0', BRAMBLE: 'groom 0', COBBLE: 'groom 1', ECHO: 'groom 2', WICK: 'dorm 0' };
  for (const d of sim.dragons) {
    const got = `${sim.rooms[d.slot.room].kind} ${d.slot.i}`;
    if (got !== want[d.name] || d.x !== d.slot.x || d.f !== d.slot.f || d.facing !== d.slot.facing) fail(`start: ${d.name} stands in the ${got} at f${d.f} x ${d.x} facing ${d.facing}, not the ${want[d.name]} slot`);
  }
  // every named room in the start, the lift and the Aerie: used somewhere in this suite, unless PLANNED; a PLANNED one unused
  const named = [...new Set([...START_ROOMS.map((r) => r.kind as string), ...Object.keys(STRUCTURES)])];
  for (const k of named) {
    const n = USED[k] ?? 0;
    if (PLANNED.has(k) ? n > 0 : n === 0) fail(PLANNED.has(k) ? `rooms: the ${k} is PLANNED but was used ${n} times: its mechanic has landed, take it off PLANNED` : `rooms: the ${k} is named and furnished but nothing used it (#11)`);
  }
  for (const k of PLANNED) if (!named.includes(k)) fail(`rooms: PLANNED names ${k}, which the building hasn't got`);
  console.log(`  8 rooms: ${ROOM_KINDS.length} kinds and ${Object.keys(STRUCTURES).length} structures, each with a purpose; ${NEEDS.length} needs, one room each; ${plates.length} plates, none on a bare slot; used over the suite: ${named.filter((k) => !PLANNED.has(k)).map((k) => `${k} ${USED[k] ?? 0}`).join(', ')}; planned: ${[...PLANNED].join(', ')}`);
}

if (fails.length) { console.log('SIM: FAIL\n' + fails.map((f) => '  ' + f).join('\n')); process.exit(1); }
console.log('SIM: the barn runs: every check passed');
