// Headless smoke test of the dragon gallery: load every view, assert no page errors, and assert dragons were
// actually drawn -- a page that loads clean but paints only its background is the quiet failure this catches.
//
//   node tools/smoke.ts            (npm run smoke; part of npm run check)
//
// For each view it waits for window.__dragonCare.ready (the page's frozen-frame contract, see tools/shot.ts), then
// reads the stage canvas back and counts DISTINCT colours: a straw floor alone is 1, a labelled floor a handful, a
// cast of cel-shaded dragons hundreds. Views that draw the whole cast must also contain every element's scale
// colour AT EVERY STAGE it draws (the stage's body hex, src/art/dragon/palettes.ts agedPalette: an adult is a little
// grey, an elder clearly grey), so an element or a stage that silently fails to draw -- or draws in the wrong
// stage's colours -- is caught too.
// The floor audit (view=floor) plays every core anim on every look and fails any frame where something the dragon
// draws, ground shadow aside, is >= 40 % covered more than 1 px under y = 0 (1.1, 5.1 #14): the idle variants (the
// elders' back stretch, reminisce and airing), every look's fidget at every stage and the element anims (dusk's
// tuck-in among them) included. The leg-root audit (view=roots) fails any walk, idle or rest frame where a far leg's
// sunk root lies outside the body (1.2). The tail-ceiling audit (view=tails) fails any standing frame of a core anim
// where a tail that ends in a shape (water's fluke) or caps its rise (dusk's) rises more than 3 px over the back at
// the hip (3.0: fire's zone), the pour-column audit (view=pour) any breath frame with one effect mark from 3 px under
// the mouth down to the floor (3.8: Nightfall is breathed out, never poured), and the neutral-area recorder
// (view=neutral) any look more than 40 % neutral at rest (3.1). All five run over all 28 looks.
// The keepers (docs/KEEPERS.md): the keeper views must show every keeper (its top colour on the canvas), and the two care
// audits -- every care act on all 28 looks (view=careaudit), every act the yard plays (view=yardaudit) -- fail a keeper
// at work covering the dragon's eye (K7), a stroking hand more than REACH_MISS px off its mark, or an act that never
// ends.
// The base (view=base, docs/BASE_DESIGN.md): frozen, it starts with a young adult of every element (#9), the ages
// preset has every stage, and a minute in the care simulation must have got jobs done with the dragons walking (#7:
// its hook reports each dragon's move, room and slot, the lift, and the px walked; and between the frames at t=600 and
// t=3600 at least three dragons stand somewhere else); live (never saving: save=0), a drag must pan the camera, a tap
// on the first job chip must Rush that job, and the gallery's keys (E, the arrows, Space, the digits) must neither
// rebuild the world nor leave it. Time (docs/BASE_DESIGN.md 7): hour=22 is night; the world drawn alone (layers=world)
// is the same picture and the same barn at noon and at ten at night, while the whole frame is not (night is drawn, and
// only in the sky and the lights); live, the speed button and the keys 1-4 and p run the world faster, and pause it;
// a frozen page with a save in storage neither loads nor writes it, and nor does a live page given hour=; a live page
// that saves resumes its world after a reload, and one whose save doesn't fit -- another version, or one of this
// version the view can't build or draw (an unknown element, keeper or need) -- starts a new barn without a page
// error, keeps the old save aside, and never writes it back.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from './server.ts';
import { AGE_STAGES, DRAGON_ELEMENTS, agedPalette } from '../src/art/dragon/palettes.ts';
import type { AgeStage } from '../src/art/dragon/palettes.ts';
import { KEEPER_PALETTES } from '../src/art/keeper/palettes.ts';
import { KEEPER_IDS } from '../src/art/keeper/cast.ts';
import { REACH_MISS } from '../src/care/limits.ts';
import { CareSim } from '../src/game/sim.ts';
import { START_ROOMS, START_DRAGONS, START_KEEPERS } from '../src/game/start.ts';
import { serialize } from '../src/game/save.ts';
import { SAVE_KEY, BACKUP_KEY } from '../src/game/storage.ts';

const require = createRequire(import.meta.url);
function loadPlaywright(): any {
  for (const c of ['/opt/node22/lib/node_modules/playwright', '/usr/lib/node_modules/playwright', 'playwright', 'playwright-core']) {
    try { return require(c); } catch { /* next */ }
  }
  throw new Error('Playwright not found');
}
async function launch(chromium: any): Promise<any> {
  try { return await chromium.launch(); }
  catch (e) {
    const exe = process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium';
    if (fs.existsSync(exe)) return chromium.launch({ executablePath: exe });
    throw e;
  }
}

/**
 * One view. `allScales`: every element's body colour must be on the canvas, at each of `stages` (default all four:
 * the lineup's rows) -- a one-stage view (cast, mood) names its stage.
 */
interface Case {
  query: string; minColours: number; allScales: boolean; stages?: readonly AgeStage[]; timeout?: number; floor?: boolean; roots?: boolean;
  tails?: boolean; pour?: boolean; neutral?: boolean;
  /** Every keeper's top colour must be on the canvas (the keepers were drawn). */
  keepers?: boolean;
  /** A care audit's rows (window.__dragonCare.care): at least this many acts, none with the eye covered, the hand off, or stuck. */
  care?: number;
  /** view=base: the care simulation must have done jobs by the frozen frame. */
  base?: boolean;
  /** view=base: what's wrong with the base's hook (window.__dragonCare.base) at the frozen frame. */
  check?: (hook: BaseHook) => string[];
  /** A live page to drive (pointer input); returns what went wrong. */
  act?: (page: any) => Promise<string[]>;
  /** Before the page loads (a save planted in its storage). */
  init?: (page: any) => Promise<void>;
  /** Hash the frame (an in-page FNV-1a over the canvas's pixels) for TINT: the whole frame, and the world between the HUD's bars (rows 16-338). */
  hash?: boolean;
}

type BaseHook = NonNullable<NonNullable<Window['__dragonCare']>['base']>;

/** The base's dragons: this many, every one at `stage` (null: any), with every element among them. */
function castIs(n: number, stage: string | null) {
  return (b: BaseHook): string[] => {
    const out: string[] = [], els = new Set(b.dragons.map((d) => d.element));
    if (b.dragons.length !== n) out.push(`${b.dragons.length} dragons, not ${n}`);
    const off = stage ? b.dragons.filter((d) => d.stage !== stage) : [];
    if (off.length) out.push(`not ${stage}: ${off.map((d) => `${d.name} (${d.stage})`).join(', ')}`);
    const missing = DRAGON_ELEMENTS.filter((el) => !els.has(el));
    if (missing.length) out.push(`no ${missing.join(', ')} dragon`);
    if (!/^[0-9a-f]{8}$/.test(b.digest)) out.push(`the digest is ${JSON.stringify(b.digest)}, not 8 hex digits`);
    return out;
  };
}
/** The hook reports the dragons on the move (#7): each one's move, room and slot, the lift's car, and the px walked. */
function travels(b: BaseHook): string[] {
  const out: string[] = [];
  for (const d of b.dragons) {
    if (typeof d.move !== 'string' || !d.move) out.push(`${d.name} has no move`);
    if (!(d.room === null || typeof d.room === 'string') || !(d.slot === null || /^[a-z]+:\d+$/.test(d.slot))) out.push(`${d.name}'s room ${d.room} / slot ${d.slot} is not a kind or null / kind:index or null`);
  }
  if (!b.lift || typeof b.lift.y !== 'number' || !(b.lift.rider === null || typeof b.lift.rider === 'number')) out.push(`the hook's lift is ${JSON.stringify(b.lift)}`);
  if (typeof b.walked !== 'number') out.push('the hook has no walked');
  return out;
}
/** The dragons have walked more than this many px by the frozen frame. */
function walkedOver(px: number) {
  return (b: BaseHook): string[] => [...travels(b), ...(b.walked > px ? [] : [`the dragons walked ${b.walked} px in ${b.tick} steps, not over ${px}`])];
}
/** Two frozen frames of one world (by query): at least `n` dragons stand at a different x in the second (#7: they move around the rooms). */
const PAIRS: { a: string; b: string; n: number }[] = [{ a: 'view=base&t=600', b: 'view=base&t=3600', n: 3 }];

/**
 * Day against night (plan S4): each pair is one world at noon and at ten at night. `same`: the world layer alone
 * (layers=world) must be the same picture and the same barn (barnDigest); otherwise the frames must differ, in the
 * world between the HUD's bars too (the sky and the lights, not only the clock).
 */
const TINT: { a: string; b: string; same: boolean }[] = [
  { a: 'view=base&t=600&hour=12&layers=world', b: 'view=base&t=600&hour=22&layers=world', same: true },
  { a: 'view=base&t=600&hour=12', b: 'view=base&t=600&hour=22', same: false },
];
/** The in-page hashes of each hashed case's frame, by query. */
const frames = new Map<string, { all: string; world: string }>();

/** A real save, built in Node: the new game stepped 5000 (the planted-save cases put it in the page's storage). */
const PLANTED = JSON.stringify((() => { const w = new CareSim(START_ROOMS, START_DRAGONS, START_KEEPERS, { seed: 1 }); for (let i = 0; i < 5000; i++) w.step(); return serialize(w); })());
/** Put a blob at the save's key before the page's scripts run. */
const plant = (blob: string) => async (page: any) => { await page.addInitScript(([k, v]: [string, string]) => { try { localStorage.setItem(k, v); } catch { /* none */ } }, [SAVE_KEY, blob]); };
const stored = (page: any, key: string): Promise<string | null> => page.evaluate((k: string) => localStorage.getItem(k), key);

/** The hook's time and saving fields (S4). */
function timeFields(phase: string | null, persist: boolean) {
  return (b: BaseHook): string[] => {
    const out: string[] = [];
    if (!b.clock || typeof b.clock.day !== 'number' || typeof b.clock.hour !== 'number') out.push(`the hook's clock is ${JSON.stringify(b.clock)}`);
    else if (phase && b.clock.phase !== phase) out.push(`it is ${b.clock.phase} at ${b.clock.hour}:${b.clock.minute}, not ${phase}`);
    if (b.speed !== 1) out.push(`a frozen page runs at speed ${b.speed}, not 1`);
    if (b.persist !== persist) out.push(`persist is ${b.persist}, not ${persist}`);
    if (!/^[0-9a-f]{8}$/.test(b.barnDigest)) out.push(`the barn digest is ${JSON.stringify(b.barnDigest)}`);
    for (const k of ['new', 'pause', 'speed']) { const r = b.buttons?.[k]; if (!r || !(r.w > 0 && r.h > 0) || r.y > 15) out.push(`no ${k} button in the top bar (${JSON.stringify(r)})`); }
    return out;
  };
}

/**
 * view=base, a frozen page with the player's save in storage (plan G4): it is not loaded -- the frame is the new game's
 * at t=600, the same digest as a clean page's -- and it is not written (the blob is as planted).
 */
async function plantedFrozen(page: any): Promise<string[]> {
  const out: string[] = [];
  const b: BaseHook = await page.evaluate(() => (window as any).__dragonCare?.base);
  const clean = hooks.get('view=base&t=600');
  if (b.tick !== 600) out.push(`the frozen page is at tick ${b.tick}, not 600: it loaded the save`);
  if (!clean) out.push('no clean view=base&t=600 hook to compare with');
  else if (b.digest !== clean.digest) out.push(`its digest ${b.digest} is not the clean page's ${clean.digest}: it loaded the save`);
  if (b.persist) out.push('a frozen page says it persists');
  if ((await stored(page, SAVE_KEY)) !== PLANTED) out.push('the frozen page wrote the save');
  return out;
}

/**
 * view=base, live and saving (no save=0; its own page, so its own storage): run to tick 300, save now, reload; the
 * world resumes (its tick at or past the save's: a new game would start again from 0) and says it persists.
 */
async function livePersist(page: any): Promise<string[]> {
  const out: string[] = [];
  await page.waitForFunction(() => ((window as any).__dragonCare?.base?.tick ?? 0) >= 300, null, { timeout: 20000 });
  const T: number = await page.evaluate(() => (window as any).__dragonCare.baseSaveNow());
  const saved = await stored(page, SAVE_KEY);
  if (!saved || JSON.parse(saved).tick !== T) out.push(`baseSaveNow returned ${T}, the stored save is at ${saved ? JSON.parse(saved).tick : 'nothing'}`);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => (window as any).__dragonCare?.ready === true && !!(window as any).__dragonCare?.base, null, { timeout: 15000 });
  const b: BaseHook = await page.evaluate(() => (window as any).__dragonCare.base);
  if (!(b.tick >= T)) out.push(`after the reload the world is at tick ${b.tick}, before the save's ${T}: it did not resume`);
  if (b.persist !== true) out.push(`after the reload persist is ${b.persist}`);
  return out;
}

/** view=base, live and saving, with a save of another version in storage: a new barn, no page error, the old save kept aside. */
async function liveOldSave(page: any): Promise<string[]> {
  const out: string[] = [];
  await page.waitForFunction(() => ((window as any).__dragonCare?.base?.tick ?? 0) > 5, null, { timeout: 15000 });
  const b: BaseHook = await page.evaluate(() => (window as any).__dragonCare.base);
  if (b.tick > 2000) out.push(`the world is at tick ${b.tick}: it loaded the old save`);
  if ((await stored(page, BACKUP_KEY)) !== OLD_SAVE) out.push('the old save was not kept at the backup key');
  return out;
}
const OLD_SAVE = JSON.stringify({ ...JSON.parse(PLANTED), v: 999, tick: 9999 });
/**
 * Saves of this version that parse but that the view can't build (a dragon of an element no one knows, a keeper no one
 * knows) or draw (a job for a need no one knows: it builds, and only the load's trial draw finds it), each with the
 * word that marks it.
 */
const BROKEN = (mark: string, f: (s: any) => void): { blob: string; mark: string } => { const s = JSON.parse(PLANTED); f(s); return { blob: JSON.stringify(s), mark }; };
const BROKEN_SAVES = [
  BROKEN('plasma', (s) => { s.dragons[2].element = 'plasma'; }),
  BROKEN('nobody', (s) => { s.keepers[1].look = 'nobody'; }),
  BROKEN('dance', (s) => { s.jobs[0].need = 'dance'; }),
];

/**
 * view=base, live and saving, with a broken save of this version in storage (plan 3.6): a new barn (the planted one is
 * at tick 5000), with its seven young adults, the page running (the runner fails on any page error), the save kept at
 * the backup key -- and a save now writes the new barn over it, never the broken one back.
 */
function liveBrokenSave({ blob, mark }: { blob: string; mark: string }) {
  return async (page: any): Promise<string[]> => {
    const out: string[] = [];
    await page.waitForFunction(() => ((window as any).__dragonCare?.base?.tick ?? 0) > 5, null, { timeout: 15000 });
    const b: BaseHook = await page.evaluate(() => (window as any).__dragonCare.base);
    if (b.tick > 2000) out.push(`the world is at tick ${b.tick}: it kept the broken save`);
    out.push(...castIs(7, 'adult')(b));
    if ((await stored(page, BACKUP_KEY)) !== blob) out.push('the broken save was not kept at the backup key');
    const T: number = await page.evaluate(() => (window as any).__dragonCare.baseSaveNow());
    const saved = await stored(page, SAVE_KEY), s = saved ? JSON.parse(saved) : null;
    if (!s || s.tick !== T || s.tick > 2000 || saved!.includes(`"${mark}"`)) out.push(`the save written is ${s ? `at tick ${s.tick}` : 'nothing'}, not the new barn: the broken one ('${mark}') was written back`);
    return out;
  };
}

/**
 * view=base&hour=22, live, with the player's save in storage: a page given its start hour is not the player's barn (like
 * a preset page) -- it neither loads the save (it is night, at a low tick, persist false) nor writes it.
 */
async function liveHourNoSave(page: any): Promise<string[]> {
  const out: string[] = [];
  await page.waitForFunction(() => ((window as any).__dragonCare?.base?.tick ?? 0) > 5, null, { timeout: 15000 });
  const b: BaseHook = await page.evaluate(() => (window as any).__dragonCare.base);
  if (b.tick > 2000) out.push(`the world is at tick ${b.tick}: it loaded the save`);
  if (b.persist) out.push('a page given hour= says it persists');
  if (b.clock?.phase !== 'night') out.push(`it is ${b.clock?.phase} on a page started at 22:00`);
  if (await page.evaluate(() => typeof (window as any).__dragonCare.baseSaveNow) !== 'undefined') out.push('a page given hour= lends baseSaveNow');
  if ((await stored(page, SAVE_KEY)) !== PLANTED) out.push('a page given hour= wrote the save');
  return out;
}

/**
 * view=base, live (save=0): the speed. The speed button's rect (the hook's) picks 2x; the key 4 picks 8x, which runs at
 * least four times as many world steps in a second as 1x did; p pauses (the tick stands still); 1 plays at 1x again.
 */
async function baseSpeed(page: any): Promise<string[]> {
  const out: string[] = [];
  const st = (): Promise<BaseHook> => page.evaluate(() => (window as any).__dragonCare?.base);
  await page.waitForFunction(() => ((window as any).__dragonCare?.base?.tick ?? 0) > 30, null, { timeout: 15000 });
  const delta = async (ms: number) => { const a = (await st()).tick; await page.waitForTimeout(ms); return (await st()).tick - a; };
  const one = await delta(1000);
  const box = await page.locator('#stage').boundingBox(), k = box.width / 640, r = (await st()).buttons.speed;
  await page.mouse.click(box.x + (r.x + r.w / 2) * k, box.y + (r.y + r.h / 2) * k);
  await page.waitForTimeout(100);
  if ((await st()).speed !== 2) out.push(`the speed button made the speed ${(await st()).speed}, not 2`);
  await page.keyboard.press('4');
  await page.waitForTimeout(100);
  if ((await st()).speed !== 8) out.push(`the key 4 made the speed ${(await st()).speed}, not 8`);
  const eight = await delta(1000);
  if (!(eight >= 4 * one)) out.push(`at 8x the world ran ${eight} steps in a second, at 1x ${one}: not 4 times as many`);
  await page.keyboard.press('p');
  await page.waitForTimeout(100);
  const paused = await delta(500);
  if (paused !== 0 || (await st()).speed !== 0) out.push(`paused, the world ran ${paused} steps in 500 ms (speed ${(await st()).speed})`);
  await page.keyboard.press('1');
  await page.waitForTimeout(200);
  const again = await delta(500);
  if ((await st()).speed !== 1 || !(again > 0)) out.push(`the key 1 left the speed ${(await st()).speed}, ${again} steps in 500 ms`);
  if (!out.length) console.log(`        speed: 1x ${one} steps in a second, 8x ${eight}; paused 0 in 500 ms`);
  return out;
}

/** The base's dragons include every stage. */
function everyStage(b: BaseHook): string[] {
  const st = new Set(b.dragons.map((d) => d.stage)), missing = AGE_STAGES.filter((s) => !st.has(s));
  return missing.length ? [`no ${missing.join(', ')} dragon`] : [];
}

/**
 * view=base, live: the gallery's keys are not the game's. Every one that once rebuilt the world (E, the digits) or
 * left it (the arrows, Space) is pressed; the base must still be there, the same world, still running. Each key is
 * judged on its own, by the clock and not by how long it took: a rebuilt world's tick starts again from 0 (any fall
 * fails), and leaving the base detaches it, which takes its hook away.
 */
async function baseKeys(page: any): Promise<string[]> {
  const out: string[] = [];
  const st = (): Promise<BaseHook | undefined> => page.evaluate(() => (window as any).__dragonCare?.base);
  await page.waitForFunction(() => ((window as any).__dragonCare?.base?.tick ?? 0) > 30, null, { timeout: 15000 });
  const a = (await st())!, ids = a.dragons.map((d) => d.id).join(',');
  let last = a.tick;
  for (const key of ['e', 'E', 'ArrowRight', 'ArrowLeft', 'Space', '5']) {
    await page.keyboard.press(key);
    await page.waitForTimeout(50);
    const b = await st();
    if (!b) { out.push(`the base hook is gone after ${key}: the page left the base`); break; }
    if (b.tick < last) out.push(`${key} restarted the world (tick ${last} -> ${b.tick})`);
    last = b.tick;
  }
  await page.waitForTimeout(300);
  const size = await page.evaluate(() => { const c = document.getElementById('stage') as HTMLCanvasElement; return [c.width, c.height]; });
  if (size[0] !== 640 || size[1] !== 360) out.push(`the canvas is ${size[0]} x ${size[1]} after the keys, not the base's 640 x 360`);
  const b = await st();
  if (!b) return out.length ? out : ['the base hook is gone after the keys'];
  if (!(b.tick >= a.tick + 10)) out.push(`the world restarted or stopped under the keys (tick ${a.tick} -> ${b.tick})`);
  if (b.dragons.map((d) => d.id).join(',') !== ids) out.push(`the dragons changed under the keys (${ids} -> ${b.dragons.map((d) => d.id).join(',')})`);
  return out;
}

/** view=base, live: a drag pans the camera the other way, and a tap on the first job chip Rushes that job. */
async function baseInput(page: any): Promise<string[]> {
  const out: string[] = [];
  const st = () => page.evaluate(() => (window as any).__dragonCare?.base);
  await page.waitForFunction(() => ((window as any).__dragonCare?.base?.chips?.length ?? 0) > 0, null, { timeout: 15000 });
  const box = await page.locator('#stage').boundingBox();
  const k = box.width / 640;
  const a = await st();
  await page.mouse.move(box.x + 700, box.y + 400);
  await page.mouse.down();
  await page.mouse.move(box.x + 400, box.y + 300, { steps: 8 });
  await page.mouse.up();
  const b = await st();
  if (!(b.camX > a.camX + 100)) out.push(`a drag to the left did not pan the camera right (x ${a.camX} -> ${b.camX})`);
  const c = b.chips[0];
  if (!c) return [...out, 'the job strip was empty'];
  await page.mouse.click(box.x + (c.x + c.w / 2) * k, box.y + (c.y + c.h / 2) * k);
  await page.waitForTimeout(300);
  const d = await st();
  if (d.rushes !== b.rushes + 1) out.push(`tapping ${c.dragon}'s ${c.need} chip Rushed ${d.rushes - b.rushes} jobs, not 1`);
  return out;
}
const CASES: Case[] = [
  { query: 'view=lineup&t=0', minColours: 150, allScales: true },
  { query: 'view=lineup&t=45&mood=-1', minColours: 150, allScales: true },
  { query: 'view=lineup&t=20&mood=1', minColours: 150, allScales: true },
  { query: 'view=silhouette&t=0', minColours: 4, allScales: false },
  { query: 'view=silhouette&set=all&t=0', minColours: 4, allScales: false },
  { query: 'view=grey&t=0', minColours: 40, allScales: false },
  { query: 'view=cvd&t=0', minColours: 80, allScales: false },
  { query: 'view=habitat&t=45', minColours: 80, allScales: false },
  { query: 'view=strip&el=water&stage=young&anim=idle&n=6&t=0', minColours: 40, allScales: false },
  { query: 'view=cast&stage=adult&t=0', minColours: 100, allScales: true, stages: ['adult'] },
  { query: 'view=cast&stage=elder&t=0', minColours: 100, allScales: true, stages: ['elder'] },
  { query: 'view=zoom&el=rock&stage=baby&t=0', minColours: 20, allScales: false },
  { query: 'view=zoom&el=fire&stage=elder&t=0', minColours: 20, allScales: false },
  { query: 'view=mood&stage=young&t=0', minColours: 100, allScales: true, stages: ['young'] },
  { query: 'view=mood&stage=elder&t=0', minColours: 100, allScales: true, stages: ['elder'] },
  { query: 'view=faces&el=slinkwing&stage=adult&t=0', minColours: 20, allScales: false },
  { query: 'view=faces&el=rock&stage=baby&t=0', minColours: 20, allScales: false },
  { query: 'view=faces&el=water&stage=elder&t=0', minColours: 20, allScales: false },
  // the elders' worn wings (2.9): full spread, the airing's hold, the resting spread
  { query: 'view=wings&t=0', minColours: 100, allScales: true, stages: ['elder'] },
  { query: 'view=lineup&t=0&wing=1&face=happy&jaw=20', minColours: 150, allScales: true },
  { query: 'view=zoom&el=rock&stage=adult&t=0&sleep=1&tuck=1', minColours: 20, allScales: false },
  { query: 'view=stages&el=lightning&t=0&flash=1', minColours: 4, allScales: false },
  ...DRAGON_ELEMENTS.map((el) => ({ query: `view=stages&el=${el}&t=0`, minColours: 40, allScales: false })),
  // the core anims (4.2): every one on the whole cast mid-play, and the strips that exercise the bowl, the tuck, the
  // stumble and the fizzles
  // (the breath at t 30: at 24 the elder's 22 f wind-up lands lightning's elder on its Spark Bolt snap, the one frame
  // its whole silhouette flashes flat glow.hi, and its body colour is rightly not on the canvas)
  ...['walk', 'happy', 'eat', 'sleep', 'wake', 'breath', 'pet', 'beg'].map((a) => ({ query: `view=lineup&anim=${a}&t=${a === 'breath' ? 30 : 24}`, minColours: 150, allScales: true })),
  { query: 'view=habitat&anim=mix&t=60', minColours: 80, allScales: false },
  { query: 'view=strip&el=rock&stage=adult&anim=sleep&n=6&t=0', minColours: 40, allScales: false },
  { query: 'view=strip&el=fire&stage=baby&anim=walk&n=8&from=120&span=24&t=0', minColours: 40, allScales: false },
  { query: 'view=strip&el=water&stage=baby&anim=eat&n=6&t=0', minColours: 40, allScales: false },
  { query: 'view=strip&el=lightning&stage=young&anim=breath&n=6&t=0', minColours: 40, allScales: false },
  // the elder column (4.2): its idle's "hmm", its two-stage lie-down, its never-failing breath, the airing
  { query: 'view=strip&el=fire&stage=elder&anim=idle&n=6&from=380&span=60&t=0', minColours: 40, allScales: false },
  { query: 'view=strip&el=spike&stage=elder&anim=sleep&n=6&t=0', minColours: 40, allScales: false },
  { query: 'view=strip&el=water&stage=elder&anim=breath&n=6&t=0', minColours: 40, allScales: false },
  { query: 'view=strip&el=dusk&stage=elder&anim=airing&n=6&t=0', minColours: 40, allScales: false },
  // the elders' own airings and finales (the element pass v2): lightning's storm-watch (the far bolt's tear, the
  // ladder, the break-off) and its turning ring, rock's sunning, dusk's lamp and moth in the face sheet, its tuck-in
  { query: 'view=strip&el=lightning&stage=elder&anim=airing&n=6&t=0', minColours: 40, allScales: false },
  { query: 'view=strip&el=lightning&stage=elder&anim=breath&n=6&t=0', minColours: 40, allScales: false },
  { query: 'view=strip&el=rock&stage=elder&anim=airing&n=6&t=0', minColours: 40, allScales: false },
  { query: 'view=faces&el=dusk&stage=elder&t=0', minColours: 20, allScales: false },
  { query: 'view=strip&el=dusk&stage=adult&anim=tuckin&n=6&t=0', minColours: 40, allScales: false },
  // the floor audit (1.1, 5.1 #14): every look plays every core anim frame by frame; nothing it draws (ground shadow
  // aside) may reach more than 1 row under the ground line -- the sole's own ink row
  { query: 'view=floor&t=0', minColours: 2, allScales: false, timeout: 240000, floor: true },
  // the leg-root audit (1.2 hard rule: roots sunk into the body): every look's walk, idle and rest pose frame by
  // frame; each far leg's sunk root must lie inside the rest of the silhouette drawn over it on every frame (a walk
  // that slid the far shoulder half a stride forward once hung the far front leg in front of the chest)
  { query: 'view=roots&t=0', minColours: 2, allScales: false, timeout: 120000, roots: true },
  // the tail-ceiling audit (3.0, fire's zone above the tail tip): every look's core anims frame by frame; a tail that
  // ends in a shape (water's fluke) may never rise more than 3 px over the back at the hip (cast review v2: it walked,
  // preened, ate and woke with its fluke at head height, fire's "U" at / 3)
  { query: 'view=tails&t=0', minColours: 2, allScales: false, timeout: 120000, tails: true },
  { query: 'view=pour&t=0', minColours: 2, allScales: false, timeout: 120000, pour: true },
  // the neutral-area recorder (3.1, a hard rule): no look's pixels more than 40 % neutral (HSV S < 0.25) at rest
  { query: 'view=neutral&t=0', minColours: 2, allScales: false, neutral: true },
  // the keepers (docs/KEEPERS.md): the cast, a walk and a kneel strip, the care vignettes and the yard
  { query: 'view=keepers&t=0', minColours: 40, allScales: false, keepers: true },
  { query: 'view=keepers&anim=walk&t=12', minColours: 40, allScales: false, keepers: true },
  { query: 'view=keepers&k=iris&anim=kneel&n=6&t=0', minColours: 20, allScales: false },
  { query: 'view=care&t=300', minColours: 60, allScales: false },
  { query: 'view=yard&t=600', minColours: 80, allScales: false, keepers: true },
  // the care audits (K7): every care act on all 28 looks, and the yard for 2.5 minutes (every keeper against every
  // dragon's eye, walking or at work); no keeper covers an eye, a stroking hand lands within REACH_MISS, every act ends
  { query: 'view=careaudit&t=0', minColours: 2, allScales: false, timeout: 300000, care: 112 },
  // (and mirrored, the dragons facing left, on two elements: every plan, walk and pose the other way round)
  { query: 'view=careaudit&facing=-1&els=fire,dusk&t=0', minColours: 2, allScales: false, timeout: 300000, care: 32 },
  { query: 'view=yardaudit&t=0', minColours: 2, allScales: false, timeout: 300000, care: 14 },
  // the base: its first seconds (a young adult of every element, #9), every stage (the ages preset), a minute of care
  // (jobs got done), and live input, never saving (a drag pans, a chip tap Rushes, the gallery's keys do nothing)
  { query: 'view=base&t=600', minColours: 150, allScales: false, check: (b) => [...castIs(7, 'adult')(b), ...travels(b)] },
  { query: 'view=base&preset=ages&t=60', minColours: 150, allScales: false, check: (b) => [...castIs(12, null)(b), ...everyStage(b), ...travels(b)] },
  { query: 'view=base&t=3600', minColours: 150, allScales: false, base: true, check: walkedOver(100) },
  { query: 'view=base&save=0', minColours: 150, allScales: false, act: baseInput },
  { query: 'view=base&save=0', minColours: 150, allScales: false, act: baseKeys },
  // time: night by the hour, day against night (the world layer the same, the frame not), the speed, and saves --
  // a frozen page ignores the one in storage, and so does a live page given hour=; a live page resumes its own after a
  // reload, and sets aside one that doesn't fit, of another version or broken (the only live cases without save=0,
  // each in its own page and storage)
  { query: 'view=base&t=600&hour=22', minColours: 150, allScales: false, hash: true, check: (b) => [...castIs(7, 'adult')(b), ...timeFields('night', false)(b)] },
  { query: 'view=base&t=600&hour=12', minColours: 150, allScales: false, hash: true, check: timeFields('day', false) },
  { query: 'view=base&t=600&hour=12&layers=world', minColours: 150, allScales: false, hash: true, check: timeFields('day', false) },
  { query: 'view=base&t=600&hour=22&layers=world', minColours: 150, allScales: false, hash: true, check: timeFields('night', false) },
  { query: 'view=base&save=0', minColours: 150, allScales: false, act: baseSpeed },
  { query: 'view=base&t=600', minColours: 150, allScales: false, init: plant(PLANTED), act: plantedFrozen },
  { query: 'view=base', minColours: 150, allScales: false, act: livePersist, timeout: 45000 },
  { query: 'view=base', minColours: 150, allScales: false, init: plant(OLD_SAVE), act: liveOldSave },
  ...BROKEN_SAVES.map((b): Case => ({ query: 'view=base', minColours: 150, allScales: false, init: plant(b.blob), act: liveBrokenSave(b) })),
  { query: 'view=base&hour=22', minColours: 150, allScales: false, init: plant(PLANTED), act: liveHourNoSave },
];

const hexToInt = (h: string) => parseInt(h.slice(1), 16);
/** Every element's body colour at every stage: the stage's own (greyed) scale hex. */
const SCALES = DRAGON_ELEMENTS.flatMap((el) => AGE_STAGES.map((st) => ({ el, st, rgb: hexToInt(agedPalette(el, st).scale) })));

const server = createServer();
await new Promise<void>((r) => server.listen(0, () => r()));
const port = (server.address() as { port: number }).port;
const { chromium } = loadPlaywright();
const browser = await launch(chromium);
let bad = 0;
/** The base's hook at each frozen base case's frame, by query (for PAIRS). */
const hooks = new Map<string, BaseHook>();

for (const c of CASES) {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e: Error) => errors.push('pageerror: ' + e.message));
  page.on('console', (m: any) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  let msg = '';
  try {
    if (c.init) await c.init(page);
    // (the audits run while the page loads, so the load itself gets the case's timeout)
    await page.goto(`http://localhost:${port}/index.html?${c.query}`, { waitUntil: 'load', timeout: c.timeout ?? 30000 });
    await page.waitForFunction(() => (window as any).__dragonCare?.ready === true, null, { timeout: c.timeout ?? 15000 });
    errors.push(...await page.evaluate(() => (window as any).__dragonCare?.errors ?? []));
    if (c.floor) {
      const rows: { id: string; anim: string; depth: number; frame: number }[] = await page.evaluate(() => (window as any).__dragonCare?.floor ?? []);
      if (!rows.length) errors.push('the floor audit reported nothing');
      for (const r of rows) if (r.depth > 1) errors.push(`${r.id} ${r.anim} sinks ${r.depth - 1} px under the floor at f${r.frame}`);
    }
    if (c.roots) {
      const rows: { id: string; anim: string; depth: number; frame: number; leg: string; floats: boolean }[] = await page.evaluate(() => (window as any).__dragonCare?.roots ?? []);
      if (!rows.length) errors.push('the leg-root audit reported nothing');
      for (const r of rows) if (r.floats) errors.push(`${r.id} ${r.anim}: the ${r.leg} root is only ${r.depth} px inside the body at f${r.frame}`);
    }
    if (c.tails) {
      const rows: { id: string; anim: string; over: number; frame: number; gated: boolean; high: boolean }[] = await page.evaluate(() => (window as any).__dragonCare?.tails ?? []);
      if (!rows.some((r) => r.gated)) errors.push('the tail-ceiling audit gated nothing');
      for (const r of rows) if (r.high) errors.push(`${r.id} ${r.anim}: the tail rises ${r.over} px over the back at f${r.frame}`);
    }
    if (c.pour) {
      const rows: { id: string; frame: number; column: boolean }[] = await page.evaluate(() => (window as any).__dragonCare?.pour ?? []);
      if (rows.length !== 28) errors.push(`the pour-column audit played ${rows.length} breaths, not 28`);
      for (const r of rows) if (r.column) errors.push(`${r.id} breath: one mark runs from the mouth to the floor at f${r.frame}`);
    }
    if (c.neutral) {
      const rows: { id: string; share: number; over: boolean }[] = await page.evaluate(() => (window as any).__dragonCare?.neutral ?? []);
      if (rows.length !== 28) errors.push(`the neutral-area recorder measured ${rows.length} looks, not 28`);
      for (const r of rows) if (r.over) errors.push(`${r.id} is ${Math.round(r.share * 100)} % neutral (the ceiling is 40 %)`);
    }
    if (c.care) {
      const rows: { act: string; id: string; covered: number; frame: number; phase: string; miss: number; done: boolean }[] = await page.evaluate(() => (window as any).__dragonCare?.care ?? []);
      if (rows.length < c.care) errors.push(`the care audit ran ${rows.length} acts, not ${c.care}`);
      for (const r of rows) {
        if (r.covered > 0) errors.push(`${r.act} ${r.id}: the keeper covers ${r.covered} px of the eye at f${r.frame} (${r.phase})`);
        if (r.miss > REACH_MISS) errors.push(`${r.act} ${r.id}: the hand lands ${r.miss} px off its mark`);
        if (!r.done) errors.push(`${r.act} ${r.id}: the act never ends`);
      }
    }
    if (c.base) {
      const b: { tick: number; done: number } | undefined = await page.evaluate(() => (window as any).__dragonCare?.base);
      if (!b) errors.push('the base reported nothing');
      else if (b.done < 1) errors.push(`the keepers finished no job in ${b.tick} steps`);
    }
    if (c.check) {
      const b: BaseHook | undefined = await page.evaluate(() => (window as any).__dragonCare?.base);
      if (!b) errors.push('the base reported nothing');
      else { errors.push(...c.check(b)); if (!hooks.has(c.query)) hooks.set(c.query, b); }
    }
    if (c.hash) {
      const h: { all: string; world: string } = await page.evaluate(() => {
        const cv = document.getElementById('stage') as HTMLCanvasElement, d = cv.getContext('2d')!.getImageData(0, 0, cv.width, cv.height).data;
        const fnv = (from: number, to: number) => { let x = 0x811c9dc5; for (let i = from; i < to; i++) x = Math.imul(x ^ d[i], 0x01000193); return (x >>> 0).toString(16).padStart(8, '0'); };
        return { all: fnv(0, d.length), world: fnv(16 * cv.width * 4, 339 * cv.width * 4) };
      });
      const b: BaseHook | undefined = await page.evaluate(() => (window as any).__dragonCare?.base);
      frames.set(c.query, h);
      if (b && !hooks.has(c.query)) hooks.set(c.query, b);
    }
    if (c.act) errors.push(...await c.act(page));
    const colours: number[] = await page.evaluate(() => {
      const cv = document.getElementById('stage') as HTMLCanvasElement;
      const d = cv.getContext('2d')!.getImageData(0, 0, cv.width, cv.height).data;
      const seen = new Set<number>();
      for (let i = 0; i < d.length; i += 4) seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
      return [...seen];
    });
    const set = new Set(colours);
    if (colours.length < c.minColours) errors.push(`only ${colours.length} distinct colours (want >= ${c.minColours}): were dragons drawn?`);
    if (c.keepers) {
      const missing = KEEPER_IDS.filter((id) => !set.has(hexToInt(KEEPER_PALETTES[id].primary)));
      if (missing.length) errors.push(`no top colour for: ${missing.join(', ')} (were the keepers drawn?)`);
    }
    if (c.allScales) {
      const want = c.stages ?? AGE_STAGES;
      const missing = SCALES.filter((s) => want.includes(s.st) && !set.has(s.rgb)).map((s) => `${s.el} ${s.st}`);
      if (missing.length) errors.push(`no body colour for: ${missing.join(', ')}`);
    }
    msg = `${colours.length} colours`;
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }
  if (errors.length) { bad++; console.log(`  FAIL: ${c.query} -> ${errors.join(' | ')}`); }
  else console.log(`  ok:   ${c.query}  (${msg})`);
  await page.close();
}

// the frozen pairs: the same world at two moments, its dragons moved between them
for (const p of PAIRS) {
  const a = hooks.get(p.a), b = hooks.get(p.b), errors: string[] = [];
  if (!a || !b) errors.push(`no hook from ${a ? p.b : p.a}`);
  else {
    const moved = a.dragons.filter((d) => { const e = b.dragons.find((q) => q.id === d.id); return e && (e.x !== d.x || e.f !== d.f); });
    if (moved.length < p.n) errors.push(`only ${moved.length} dragons moved from ${p.a} to ${p.b} (${moved.map((d) => d.name).join(', ') || 'none'}), not ${p.n} or more`);
    else console.log(`  ok:   ${p.a} -> ${p.b}  (${moved.length} dragons moved: ${moved.map((d) => d.name).join(', ')})`);
  }
  if (errors.length) { bad++; console.log(`  FAIL: ${p.a} -> ${p.b} -> ${errors.join(' | ')}`); }
}

// day against night: the world layer the same picture and the same barn; the whole frame (and its world) not
for (const p of TINT) {
  const a = frames.get(p.a), b = frames.get(p.b), ha = hooks.get(p.a), hb = hooks.get(p.b), errors: string[] = [];
  if (!a || !b || !ha || !hb) errors.push(`no frame from ${a && ha ? p.b : p.a}`);
  else if (p.same) {
    if (a.all !== b.all) errors.push(`the world layer differs by night (${a.all} / ${b.all}): night tints the world`);
    if (ha.barnDigest !== hb.barnDigest) errors.push(`the barn differs by night (${ha.barnDigest} / ${hb.barnDigest}): the simulation reads the hour`);
  } else if (a.all === b.all || a.world === b.world) errors.push(`noon and night draw ${a.all === b.all ? 'the same frame' : 'the same world under the HUD'}: night is not drawn`);
  if (errors.length) { bad++; console.log(`  FAIL: ${p.a} / ${p.b} -> ${errors.join(' | ')}`); }
  else console.log(`  ok:   ${p.a} / ${p.b}  (${p.same ? `the same frame ${a!.all} and barn ${ha!.barnDigest}` : `frames ${a!.all} / ${b!.all}, world ${a!.world} / ${b!.world}`})`);
}

await browser.close();
server.close();
const total = CASES.length + PAIRS.length + TINT.length;
console.log(bad ? `SMOKE: ${bad} of ${total} views and pairs failed` : `SMOKE: all ${CASES.length} views drew dragons (and keepers), no page errors; ${PAIRS.length} pair${PAIRS.length === 1 ? '' : 's'} moved; day and night: the world alike, the frame not`);
process.exit(bad ? 1 : 0);
