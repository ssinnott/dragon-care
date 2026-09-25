// Headless check of the base's care simulation (src/game/sim.ts; docs/BASE_DESIGN.md 4). No browser: the simulation
// is plain data and functions, so Node runs it directly.
//
//   node tools/sim-check.ts        (npm run sim; part of npm run check)
//
// 1. Every keeper can reach every dragon and every supply from their station (the ladders, the hoist, the doors).
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
import { isDeepStrictEqual } from 'node:util';
import { CareSim, REACH, DAY_STEPS, START_HOUR } from '../src/game/sim.ts';
import type { Keeper } from '../src/game/sim.ts';
import { START_ROOMS, START_DRAGONS, START_KEEPERS } from '../src/game/start.ts';
import { startSpec, PRESETS } from '../src/game/presets.ts';
import { serialize, SaveVersionError, SAVE_VERSION } from '../src/game/save.ts';
import { rngAt, mix32, TAG } from '../src/game/rand.ts';
import { route, spanOf, postX, ROOM_INFO } from '../src/game/layout.ts';
import { NEEDS, FPS, hasNeed } from '../src/game/needs.ts';
import { DRAGON_ELEMENTS } from '../src/art/dragon/palettes.ts';
import { STAGES } from '../src/art/dragon/stages.ts';

const fails: string[] = [];
const fail = (m: string) => { if (fails.length < 40) fails.push(m); };
const newSim = (seed = 1) => new CareSim(START_ROOMS, START_DRAGONS, START_KEEPERS, { seed });

// ---------- 1. every trip exists ----------
{
  const sim = newSim();
  const targets = [...sim.dragons.map((d) => ({ what: d.name, at: sim.standAt(d) })),
    ...sim.rooms.filter((r) => ROOM_INFO[r.kind].supplies).map((r) => ({ what: r.kind, at: { f: r.floor, x: postX(r) } }))];
  for (const k of sim.keepers) for (const t of targets) {
    if (!route({ f: k.f, x: k.x }, t.at)) fail(`no route from ${k.name}'s station to ${t.what}`);
    if (!route(t.at, { f: k.f, x: k.x })) fail(`no route from ${t.what} back to ${k.name}'s station`);
  }
  for (const d of sim.dragons) if (spanOf(d.f, d.x) < 0) fail(`${d.name} stands off its floor`);
  console.log(`  1 routes: ${sim.keepers.length} keepers x ${targets.length} places (${sim.dragons.length} dragons), both ways`);
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
  console.log(`  2 ${MIN} min: ${st.opened} jobs opened, ${st.done} done, ${st.closed} closed by their rooms; wait avg ${avg.toFixed(1)} s, max ${max.toFixed(1)} s; queue at most ${st.queueMax}; ${st.emptySteps} steps with a need at 0`);
  const busy = sim.keepers.map((k) => k.name).join(' ');
  if (st.done < 60) fail(`only ${st.done} jobs done in ${MIN} minutes (keepers: ${busy})`);
  if (st.emptySteps > 0) fail(`a need sat at 0 for ${st.emptySteps} dragon-steps: too few keepers for this barn`);
  if (avg > 30) fail(`jobs waited ${avg.toFixed(1)} s on average for a keeper to start (want <= 30)`);
  if (max > 120) fail(`a job waited ${max.toFixed(1)} s for a keeper to start (want <= 120)`);
  if (sim.jobs.length > sim.dragons.length * 2) fail(`the queue ended ${sim.jobs.length} long`);
}

// ---------- 3. the same seed, the same world ----------
{
  const a = newSim(7), b = newSim(7);
  for (let s = 1; s <= 20000; s++) {
    a.step(); b.step();
    if (s % 1000 === 0 && a.digest() !== b.digest()) { fail(`two runs from seed 7 differ by step ${s}`); break; }
  }
  if (newSim(7).digest() === newSim(8).digest()) fail('seeds 7 and 8 start the same world');
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
  const b = CareSim.fromSave(through(serialize(a)));
  if (b.digest() !== a.digest()) fail('save: a loaded world differs from its save at once');
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

if (fails.length) { console.log('SIM: FAIL\n' + fails.map((f) => '  ' + f).join('\n')); process.exit(1); }
console.log('SIM: the barn runs: every check passed');
