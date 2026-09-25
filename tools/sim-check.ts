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
// 3. Two runs from one seed agree step for step.
// 4. Rush with every keeper busy: the job goes to the top, a keeper comes off the lowest job for it, and it's done.
import { CareSim, REACH } from '../src/game/sim.ts';
import type { Keeper } from '../src/game/sim.ts';
import { START_ROOMS, START_DRAGONS, START_KEEPERS } from '../src/game/start.ts';
import { route, spanOf, postX, ROOM_INFO } from '../src/game/layout.ts';
import { NEEDS, FPS, hasNeed } from '../src/game/needs.ts';

const fails: string[] = [];
const fail = (m: string) => { if (fails.length < 40) fails.push(m); };
const newSim = (seed = 1) => new CareSim(START_ROOMS, START_DRAGONS, START_KEEPERS, seed);

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
  console.log(`  routes: ${sim.keepers.length} keepers x ${targets.length} places, both ways`);
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
  console.log(`  ${MIN} min: ${st.opened} jobs opened, ${st.done} done, ${st.closed} closed by their rooms; wait avg ${avg.toFixed(1)} s, max ${max.toFixed(1)} s; queue at most ${st.queueMax}; ${st.emptySteps} steps with a need at 0`);
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
  console.log('  determinism: two runs from one seed agree over 20000 steps');
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
    else console.log(`  rush: ${dragon}'s ${need} (last in a queue of ${waiting.length}) done by ${who?.name} in ${(s / FPS).toFixed(1)} s`);
    // the keeper stands in front of the snout to work (REACH), on the dragon's floor
    const d = sim.dragons[0], at = sim.standAt(d);
    if (at.f !== d.f || Math.abs(at.x - (d.x + d.facing * REACH[d.stage])) > 200) fail('standAt: not in front of the dragon');
  }
}

if (fails.length) { console.log('SIM: FAIL\n' + fails.map((f) => '  ' + f).join('\n')); process.exit(1); }
console.log('SIM: the barn runs: every check passed');
