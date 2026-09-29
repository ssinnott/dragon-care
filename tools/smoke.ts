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
// rebuild the world nor leave it. Time (docs/BASE_DESIGN.md 7): hour=22 is night; the cast drawn alone (layers=cast)
// is the same picture and the same barn at noon and at ten at night, while the whole frame is not: at least 35 % of
// its pixels change, darker and cooler, and no floor pixel does (BASE_DESIGN 7: the sky, the lights and the moonlit
// walls, never a dragon or a floor), and the walls step with the dusk and the dawn; live, the speed button and the keys 1-4 and p run the world faster, and pause it;
// a frozen page with a save in storage neither loads nor writes it, and nor does a live page given hour=; a live page
// that saves resumes its world after a reload, one with a version 9 save (before the Arena) loads it brought up to
// date -- every dragon at LV 1 -- and saves it back as this build's version, and one whose save doesn't fit -- another version, or one of this
// version the view can't build or draw (an unknown element, keeper or need) -- starts a new barn without a page
// error, keeps the old save aside, and never writes it back. Growing up and eggs (BASE_DESIGN 7): the growup preset's EMBER
// is an elder a second in, the eggs preset shows its three eggs in the Hatchery's nests, the hatch preset's egg has
// hatched into a baby by t=120; live, a tap on the head of a dragon with nothing waiting opens its card (clear of the
// other heads on screen where it can be), a tap on the card closes it, and a tap on the head of one with a job waiting
// opens its card and Rushes the job -- a head drawn over a keeper included. The elder garden (BASE_DESIGN 3): the new game's garden has its two empty plots; the garden preset's
// three residents live on three plots, by day and by night (each dragon says where it lives: the barn or the garden).
// The watchable scene (BASE_DESIGN 6, 11): frozen with a team away (preset=trip&trip=...), the game follows it -- its road is
// on screen with no panel= asking, TRIP LOG and no way back to the barn, and a take= refused -- just past the Mole King's
// fight (the Mole King gone off up the road, the fight won -- and gone just the same where the team sat it out, the team
// on its road just where the winning one is), at the fight itself with the picks waiting (the encounter's menu, its rows
// and AUTO on screen, every head clear of them) and played by the trail coach (`:auto`): a hit landing on the Mole
// King (rocked back and flashing) and the Mole King worn out, down seeing stars; a pack of mud goblins fought on the
// Millbrook road -- a dragon's bolt in flight, the goblins' clods in flight, one gone up in a puff of smoke -- each
// frame the scene's own pure function at that step (the page's hook against Node's); at a challenge
// the team cleared (with its banner), on a road with a stop waited out (the team walks on: it never turns back, and
// nothing tells the outcome early), and home with the result card (HOME SAFE!, or NOT THIS TIME when a stop was waited
// out); live, the road is on screen from the start and the world steps on under it, Esc, a badge, Tab, b, ARENA and a
// tap leave it there with nobody held, MAP opens the map at once and BACK shuts it onto the road, and at the road's end
// the result card comes up with the world waiting on it -- Esc shuts the trip's log over it first -- and tapped away (or
// put away by Esc) it is the barn again, the world on, with the camera on the Aerie as the team lands.
// The encounter, live (BASE_DESIGN 11): at the Mole King's stop the menu comes up on the road the game follows and the
// world waits for the pick, the first row takes the first pair's pick (the menu turning to the second pair's), AUTO lets
// the trail coach play the fight, the Mole King worn out sits down seeing stars and runs off, and the team walks on, the
// road still on screen.
// Taking a keeper (BASE_DESIGN 4.10, #6; take= frames too): a tap on a keeper or their badge takes them, d and the pad's
// arrows walk them, the pad and the line over it (what E does) show while one is held, Esc and LET GO let go, a touch
// in the pad's gaps is the pad's, and a badge takes and lets go while paused; no dragon's head is under the pad or the
// line.
// The Map Room (BASE_DESIGN 5; panel=map and panel=mission frames too): MAP opens the world map, a pin its chooser
// (the climate picture, the challenges and who meets them, the trail coach's forecast, the egg's notice), BEST TEAM fills the team and
// SEND starts the muster and the game follows the team: the camera held on the Aerie through a drag, a badge taking
// nobody, the muster preset's gathering frame with no camera asked for on the Aerie too, the job strip given way. The
// world map's places, live: a place with no mission today says what it is, a cloud how it clears, and a mission's
// landmark opens its chooser; the map's panel stays flat pixel art (a colour budget) and the places sheet draws every
// landmark. The mission loop, live at 8x: the muster to the deck (the barn on screen), the team's road on screen by
// itself as it leaves, TRIP LOG open and shut, Esc leaving the road there.
// The mission art kit (ART_BIBLE 5.10, view=missionart): every sheet -- the climates (and one as a scrolling road scene), the
// set pieces, the six bosses, the six little enemies, the fights' marks, the people (the miller beside the keepers), the
// icons and the places -- draws every item on it, with no page error, in enough colours.
// Barn capacity (BASE_DESIGN 4.7): the hook counts the barn's dragons against its cap (7 of 12 in the new game, the twelve
// preset at the cap, the full preset forced over it with its due egg waiting in its nest, and the capped preset at the
// cap with its due egg waiting in plain view, nobody in front of its nest).
// The Arena (BASE_DESIGN 10): the sparring audit (view=arenaaudit) plays every sparring skill of every look against
// every look in the other corner and fails any frame where one fighter covers the other's eye, or its own (ART_BIBLE
// 1.4); frozen, the chooser (panel=arena) offers every dragon free to spar, and the bout preset's move menu
// (preset=bout&panel=bout&t=90) shows EMBER's three skills with both fighters' heads on screen, clear of every panel;
// live, b opens and closes the chooser, ARENA opens it (the world waits under it), two dragons tapped into the corners
// and SWAP, START BOUT opens the bout, BACK TO BARN leaves it on under its chip and the chip opens it again, the world
// waits for the player's pick, a skill tapped plays, AUTO lets the coach pick, and once decided the toasts, the result
// card (tapped away) and the XP, and the pair home with the bout over.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from './server.ts';
import { AGE_STAGES, DRAGON_ELEMENTS, agedPalette } from '../src/art/dragon/palettes.ts';
import type { AgeStage } from '../src/art/dragon/palettes.ts';
import { KEEPER_PALETTES } from '../src/art/keeper/palettes.ts';
import { KEEPER_IDS } from '../src/art/keeper/cast.ts';
import { REACH_MISS } from '../src/care/limits.ts';
import { CareSim } from '../src/game/sim.ts';
import { buildSim, tripStart } from '../src/game/presets.ts';
import { sceneAt } from '../src/game/missionview.ts';
import type { SceneFrame } from '../src/game/missionview.ts';
import type { Trip } from '../src/game/trip.ts';
import { MISSILES, SPARK_LEN, POOF_LEN } from '../src/game/fightfx.ts';
import { START_ROOMS, START_DRAGONS, START_KEEPERS } from '../src/game/start.ts';
import { serialize, SAVE_VERSION } from '../src/game/save.ts';
import { SAVE_KEY, BACKUP_KEY } from '../src/game/storage.ts';
import { FLOORS, STRAW_SEAM, PATH_EDGE } from '../src/game/surfaces.ts';
import { CLIMATES, CHALLENGE_IDS, SKILLS, BADDIE_IDS, FOE_IDS } from '../src/game/missiondata.ts';
import { PASSAGES } from '../src/game/passages.ts';
import { PHASE_ORDER } from '../src/game/clock.ts';
import { PLACES, growthSamples } from '../src/game/worldmap.ts';
import { PLATES, LOG_LINE, MENU, AUTO, BOUT_BACK } from '../src/game/arenaui.ts';

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
  /** view=missionart (ART_BIBLE 5.10): the sheet the page's hook must name, and every item it must have drawn. */
  art?: { sheet: string; want: readonly string[] };
  /**
   * The Map Room's panel (inside its border, screen px 12-628 x 22-332): at most this many colours -- flat pixel-art
   * fills, no anti-aliased edge anywhere (the house style: a single smoothed edge brings in a spread of in-between shades).
   * The world map is a painted little world now (worldmap.ts: its land, growths, landmarks and cloud), 96 colours in the
   * new game's frame at t=60, all of them flat.
   */
  maxPanelColours?: number;
  /** Hash the frame (an in-page FNV-1a over the canvas's pixels) for TINT: the whole frame, and the world between the HUD's bars (rows 16-338). */
  hash?: boolean;
  /** Keep the frame's pixels (0xRRGGBB each) for TINT's day-and-night comparison (BASE_DESIGN 7). */
  pixels?: boolean;
  /** view=arenaaudit (BASE_DESIGN 10): at least this many sparring skills played, none covering an eye. */
  arena?: number;
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
/**
 * While a keeper is held, the pad and the line under it cover no dragon's eye (ART_BIBLE 1.4): no dragon's head
 * (its cranium, 6 px either way for the eye) inside a pad button or the line's strip.
 */
function hudClear(b: BaseHook): string[] {
  if (!b.action) return [];
  const rects = [...Object.entries(b.pad), ...(b.line ? [['line', b.line] as const] : [])];
  const out: string[] = [];
  for (const d of b.dragons) {
    if (!d.head) continue;
    for (const [name, r] of rects) if (d.head.x + 6 > r.x && d.head.x - 6 < r.x + r.w && d.head.y + 6 > r.y && d.head.y - 6 < r.y + r.h) out.push(`${d.name}'s head (${d.head.x.toFixed(0)}, ${d.head.y.toFixed(0)}) under the ${name} (t ${b.tick}, cam ${b.camX.toFixed(0)},${b.camY.toFixed(0)})`);
  }
  return out;
}
/** The keeper held by hand (by name) shows whole under the top bar: their mark (17 px over the head, 5 tall) and the "?" (30 over) at y 16 or more. */
function markShown(name: string) {
  return (b: BaseHook): string[] => {
    const k = b.keepers.find((q) => q.name === name);
    if (!k || b.controlled !== name) return [`${name} is not held (controlled ${b.controlled})`];
    return k.box.y - 30 - 5 >= 16 ? [] : [`${name}'s mark and "?" are under the top bar (head at screen y ${k.box.y.toFixed(0)}, cam ${b.camX.toFixed(0)},${b.camY.toFixed(0)})`];
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
 * Day against night (BASE_DESIGN 7): each pair is one world at noon and at ten at night. `same`: the cast alone
 * (layers=cast: the dragons, the keepers and the bubbles on a flat colour) must be the same picture and the same barn
 * (barnDigest) -- night never tints a dragon (BASE_DESIGN 7). Otherwise the frames must differ, in the world between the HUD's
 * bars too; with `differ`, in at least that share of the frame's pixels, the changed pixels darker and cooler by night
 * than by day (it reads as night: BASE_DESIGN 7), and every floor pixel of the day's frame (FLOORS) the same by night.
 */
const TINT: { a: string; b: string; same: boolean; differ?: number }[] = [
  { a: 'view=base&t=600&hour=12&layers=cast', b: 'view=base&t=600&hour=22&layers=cast', same: true },
  { a: 'view=base&t=600&hour=12', b: 'view=base&t=600&hour=22', same: false, differ: 0.35 },
];
/** The in-page hashes of each hashed case's frame, by query. */
const frames = new Map<string, { all: string; world: string }>();
/** The kept pixels of each case that keeps them (0xRRGGBB, row by row), and the frame's width, by query. */
const pixels = new Map<string, { w: number; px: number[] }>();

/** A real save, built in Node: the new game stepped 5000 (the planted-save cases put it in the page's storage). */
const PLANTED = JSON.stringify((() => { const w = new CareSim(START_ROOMS, START_DRAGONS, START_KEEPERS, { seed: 1 }); for (let i = 0; i < 5000; i++) w.step(); return serialize(w); })());
/** Put a blob at the save's key before the page's scripts run. */
const plant = (blob: string) => async (page: any) => { await page.addInitScript(([k, v]: [string, string]) => { try { localStorage.setItem(k, v); } catch { /* none */ } }, [SAVE_KEY, blob]); };
const stored = (page: any, key: string): Promise<string | null> => page.evaluate((k: string) => localStorage.getItem(k), key);

/** The hook's time and saving fields (BASE_DESIGN 7: the clock, the speed, saves). */
function timeFields(phase: string | null, persist: boolean, night?: number) {
  return (b: BaseHook): string[] => {
    const out: string[] = [];
    // (BASE_DESIGN 7: the building's walls and shell drawn at the night's step, 0 by day to 3 at night)
    if (night !== undefined && b.night !== night) out.push(`the building is drawn at night step ${b.night}, not ${night}`);
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
 * view=base, a frozen page with the player's save in storage (BASE_DESIGN 7, Saves): it is not loaded -- the frame is the new game's
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
/** A version 9 save (before the Arena: BASE_DESIGN 7, Saves): the planted world less every dragon's XP and the Arena. */
const V9_SAVE = JSON.stringify((() => {
  const s = JSON.parse(PLANTED);
  s.v = 9; delete s.arena;
  for (const d of s.dragons) delete d.xp;
  return s;
})());
/**
 * view=base, live and saving, with a version 9 save in storage: it loads, brought up to date (save.ts migrateSave, a
 * version at a time) -- the world resumed, every dragon at LV 1 and no bout -- nothing is kept aside, and it is saved
 * back as this build's version.
 */
async function liveV9Save(page: any): Promise<string[]> {
  const out: string[] = [];
  await page.waitForFunction(() => ((window as any).__dragonCare?.base?.tick ?? 0) > 5, null, { timeout: 15000 });
  const b: BaseHook = await page.evaluate(() => (window as any).__dragonCare.base);
  if (b.tick < 5000) out.push(`the world is at tick ${b.tick}: the version 9 save was not loaded`);
  if (b.dragons.some((d) => d.level !== 1 || d.xp !== 0) || b.arena.bout || b.arena.bouts) out.push(`loaded, the dragons are at ${b.dragons.map((d) => `${d.name} LV ${d.level} (${d.xp} XP)`).join(', ')}, the Arena ${JSON.stringify(b.arena)}`);
  if ((await stored(page, BACKUP_KEY)) !== null) out.push('the version 9 save was kept aside as one that didn\'t fit');
  await page.evaluate(() => (window as any).__dragonCare.baseSaveNow());
  const saved = await stored(page, SAVE_KEY);
  if (!saved || JSON.parse(saved).v !== SAVE_VERSION) out.push(`saved again as version ${saved ? JSON.parse(saved).v : 'nothing'}, not ${SAVE_VERSION}`);
  return out;
}
/**
 * Saves of this version that parse but that the view can't build (a dragon of an element no one knows, a keeper no one
 * knows) or draw (a job for a need no one knows: it builds, and only the load's trial draw finds it), or whose egg this
 * build can't hatch (an element no one knows, a nest there isn't: the egg lies unstepped and off the start's camera for
 * days, so only CareSim.fromSave's own checks find it), or whose dragon lives somewhere this build hasn't got (BASE_DESIGN 3, The Garden:
 * CareSim.fromSave's garden checks), each with the text that marks it in a save.
 */
const BROKEN = (mark: string, f: (s: any) => void): { blob: string; mark: string } => { const s = JSON.parse(PLANTED); f(s); return { blob: JSON.stringify(s), mark }; };
const EGG = (s: any, e: object) => { s.eggs = [{ id: 0, element: 'fire', seed: 77, laid: s.clock0 + s.tick, nest: 0, ...e }]; s.nextEggId = 1; };
const BROKEN_SAVES = [
  BROKEN('"plasma"', (s) => { s.dragons[2].element = 'plasma'; }),
  BROKEN('"nobody"', (s) => { s.keepers[1].look = 'nobody'; }),
  BROKEN('"dance"', (s) => { s.jobs[0].need = 'dance'; }),
  BROKEN('"lava"', (s) => EGG(s, { element: 'lava' })),
  BROKEN('"nest":7', (s) => EGG(s, { nest: 7 })),
  // (a dragon somewhere this build has no place for: the elder garden's saves, BASE_DESIGN 3, The Garden)
  BROKEN('"moon"', (s) => { s.dragons[0].place = 'moon'; }),
];

/**
 * view=base, live and saving, with a broken save of this version in storage (BASE_DESIGN 7, Saves): a new barn (the planted one is
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
    if (!s || s.tick !== T || s.tick > 2000 || saved!.includes(mark)) out.push(`the save written is ${s ? `at tick ${s.tick}` : 'nothing'}, not the new barn: the broken one (${mark}) was written back`);
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

/** view=base&preset=growup: EMBER has grown up, an elder (BASE_DESIGN 7), and nobody else has. */
function grownUp(b: BaseHook): string[] {
  const e = b.dragons.find((d) => d.name === 'EMBER'), others = b.dragons.filter((d) => d.name !== 'EMBER' && d.stage !== 'adult');
  return [...(e?.stage === 'elder' ? [] : [`EMBER is ${e?.stage ?? 'missing'}, not an elder`]), ...(others.length ? [`${others.map((d) => d.name).join(', ')} grew too`] : [])];
}
/** view=base&preset=eggs: three eggs in the nests, each its element in its nest, as far on as the preset laid it (and 600 steps more). */
function eggsIn(b: BaseHook): string[] {
  const want = [['rock', 0.028], ['dusk', 0.578], ['water', 0.928]] as const;
  if (!Array.isArray(b.eggs) || b.eggs.length !== 3) return [`the hook has ${b.eggs?.length ?? 'no'} eggs, not 3`];
  return b.eggs.flatMap((e, i) => (e.element === want[i][0] && e.nest === i && Math.abs(e.progress - want[i][1]) < 0.002 ? [] : [`egg ${i} is ${e.element} in nest ${e.nest} at ${e.progress.toFixed(3)}, not ${want[i][0]} at ${want[i][1]}`]));
}
/** view=base&preset=hatch: the egg has hatched into a baby (the start's seven and one more), and the nests are empty. */
function hatchedOne(b: BaseHook): string[] {
  const babies = b.dragons.filter((d) => d.stage === 'baby');
  return [...(babies.length === 1 && b.dragons.length === 8 ? [] : [`${babies.length} babies among ${b.dragons.length} dragons, not 1 among 8`]), ...(b.eggs?.length === 0 ? [] : [`${b.eggs?.length} eggs left in the nests`])];
}

/**
 * view=base, live (save=0): the dragon card. Paused (so nothing changes under the pointer), a tap on the head of a
 * dragon on screen that has no job waiting (the hook's `waiting` false, its `head` clear of the top bar, the job strip
 * and every waiting dragon's bubble) opens its card (the hook's `card` is its name) on the far side of the screen from
 * it (`cardBox`: at the right for a dragon in the left half, at 8, 20 for one in the right half -- never over the head
 * tapped -- or on the near side if another head is under the far one and none under the near) and Rushes nothing; a tap
 * on the card closes it; and a tap on the head of a dragon with a job waiting opens its card too, and Rushes that job
 * (exactly one Rush) -- a head drawn in front of a keeper included: the tap is the dragon's, not the keeper's.
 */
async function baseCard(page: any): Promise<string[]> {
  const out: string[] = [];
  const st = (): Promise<BaseHook> => page.evaluate(() => (window as any).__dragonCare?.base);
  await page.waitForFunction(() => ((window as any).__dragonCare?.base?.tick ?? 0) > 30, null, { timeout: 15000 });
  await page.keyboard.press('p');
  await page.waitForTimeout(150);
  const b = await st(), box = await page.locator('#stage').boundingBox(), k = box.width / 640;
  // (clear: on the canvas, off the top bar and the job strip, under no waiting dragon's bubble -- it stands up to 60 px
  // over that dragon's head -- and no other dragon's head near: the tap is its alone)
  const clear = (d: BaseHook['dragons'][number], h: { x: number; y: number }) => h.x > 12 && h.x < 628 && h.y > 24 && h.y < 330
    && !b.dragons.some((o) => o !== d && o.head && ((o.waiting && Math.abs(o.head.x - h.x) < 36 && o.head.y - h.y > -8 && o.head.y - h.y < 64) || (Math.abs(o.head.x - h.x) < 70 && Math.abs(o.head.y - h.y) < 40)));
  const d = b.dragons.find((q) => !q.waiting && q.head && clear(q, q.head));
  if (!d) return [`no dragon with nothing waiting has its head on screen clear of the bubbles (${b.dragons.map((q) => `${q.name} ${q.waiting ? 'waiting' : 'free'} ${q.head ? `${Math.round(q.head.x)},${Math.round(q.head.y)}` : 'off'}`).join('; ')})`];
  const rushes = b.rushes;
  await page.mouse.click(box.x + d.head!.x * k, box.y + d.head!.y * k);
  await page.waitForTimeout(150);
  const c = await st();
  if (c.card !== d.name) out.push(`tapping ${d.name}'s head (nothing waiting) opened ${c.card === null ? 'no card' : `${c.card}'s card`}`);
  if (c.rushes !== rushes) out.push(`tapping ${d.name} (nothing waiting) Rushed a job`);
  // (the far side -- 472, 38 for a head left of x 320, else 8, 20 -- unless a head on screen is under it there and none
  // is on the near side: hud.ts cardAt, each head's centre kept 10 px clear)
  const cb = c.cardBox, h = d.head!, heads = b.dragons.flatMap((q) => (q.head ? [q.head] : []));
  const LEFT = { x: 8, y: 20, w: 160, h: 76 }, RIGHT = { x: 472, y: 38, w: 160, h: 76 }, [farR, nearR] = h.x < 320 ? [RIGHT, LEFT] : [LEFT, RIGHT];
  const covers = (r: typeof LEFT) => heads.some((q) => q.x > r.x - 10 && q.x < r.x + r.w + 10 && q.y > r.y - 10 && q.y < r.y + r.h + 10);
  const want = covers(farR) && !covers(nearR) ? nearR : farR, side = want === farR ? 'the far side' : 'the near side (a head under the far side)';
  if (!cb || cb.x !== want.x || cb.y !== want.y || cb.w !== want.w || cb.h !== want.h || (h.x >= cb.x && h.x <= cb.x + cb.w && h.y >= cb.y && h.y <= cb.y + cb.h)) out.push(`${d.name}'s card (head at ${Math.round(h.x)}, ${Math.round(h.y)}) opened at ${JSON.stringify(cb)}, not at ${JSON.stringify(want)} (${side})`);
  const at = cb ?? { x: 8, y: 20, w: 160, h: 76 };
  await page.mouse.click(box.x + (at.x + at.w / 2) * k, box.y + (at.y + at.h / 2) * k);
  await page.waitForTimeout(150);
  if ((await st()).card !== null) out.push('tapping the card did not close it');
  // (a waiting dragon's head, clear of the card, the bars and every other bubble but its own)
  const w = b.dragons.find((q) => q.waiting && q.head && q.head.x > 180 && clear(q, q.head));
  if (w) {
    await page.mouse.click(box.x + w.head!.x * k, box.y + w.head!.y * k);
    await page.waitForTimeout(150);
    const e = await st();
    if (e.card !== w.name) out.push(`tapping ${w.name}'s head (a job waiting) opened ${e.card === null ? 'no card' : `${e.card}'s card`}`);
    if (e.rushes !== rushes + 1) out.push(`tapping ${w.name} (a job waiting) made ${e.rushes - rushes} Rushes, not 1`);
  } else out.push(`no dragon with a job waiting has its head on screen clear of the bubbles (${b.dragons.map((q) => `${q.name} ${q.waiting ? 'waiting' : 'free'} ${q.head ? `${Math.round(q.head.x)},${Math.round(q.head.y)}` : 'off'}`).join('; ')})`);
  await page.keyboard.press('p');
  if (!out.length) console.log(`        card: ${d.name}'s opened by a tap on its head (x ${Math.round(h.x)}: nothing waiting, no Rush) at ${at.x}, ${at.y}, ${side}, closed by a tap on it; ${w!.name}'s opened by a tap on its head and its job Rushed`);
  return out;
}

/**
 * The elder garden (BASE_DESIGN 3, The Garden): this many residents on this many plots, the world as wide as that garden makes it
 * (1304 + 176 a plot + 32), every dragon saying where it lives -- each resident an elder, in the garden.
 */
function gardenIs(residents: number, plots: number) {
  return (b: BaseHook): string[] => {
    const out: string[] = [], g = b.garden;
    if (!g || g.residents !== residents || g.plots !== plots || g.worldW !== 1304 + 176 * plots + 32) out.push(`the garden is ${JSON.stringify(g)}, not ${residents} residents on ${plots} plots`);
    const inGarden = b.dragons.filter((d) => d.place === 'garden');
    if (b.dragons.some((d) => d.place !== 'barn' && d.place !== 'garden')) out.push(`a dragon lives nowhere: ${b.dragons.map((d) => `${d.name} ${d.place}`).join(', ')}`);
    if (inGarden.length !== residents || inGarden.some((d) => d.stage !== 'elder' || d.f !== 0 || d.x < 1304 || d.slot !== null)) out.push(`the garden's dragons are ${inGarden.map((d) => `${d.name} (${d.stage}, f${d.f} x ${Math.round(d.x)}, slot ${d.slot})`).join(', ') || 'none'}`);
    return out;
  };
}

/**
 * The watchable scene (BASE_DESIGN 6), frozen: the game follows the team out -- the overlay is the scene though no panel
 * asked for it, with TRIP LOG and no way back to the barn (but the result card, once the road is done) -- and the scene is
 * as `want` says (the last stop reached, whether it was met, the baddie in view, its exit, the way the team faces...),
 * with a banner once a stop is reached.
 */
function sceneIs(want: Partial<NonNullable<BaseHook['scene']>>) {
  return (b: BaseHook): string[] => {
    const out: string[] = [], s = b.scene;
    if (b.ui?.screen !== 'watch' || b.ui.follow !== 'road') out.push(`the overlay is ${b.ui?.screen} (following ${b.ui?.follow}), not the team followed on its road`);
    // (the buttons: TRIP LOG, the result card once the road is done, and -- only while the team stands at a stop -- the
    // encounter's rows and AUTO: BASE_DESIGN 11)
    const keys = Object.keys(b.ui?.buttons ?? {}), encounters = (k: string) => k.startsWith('ability') || k === 'trail';
    const ways = keys.filter((k) => !encounters(k)).sort().join(' '), only = s?.done ? 'log result' : 'log';
    if (ways !== only) out.push(`over the road the buttons are ${ways || 'none'}, not ${only}`);
    if (s?.at == null && keys.some(encounters)) out.push(`the encounter's buttons (${keys.join(' ')}) with the team walking`);
    if (!s) return [...out, 'no scene in the hook'];
    for (const [k, v] of Object.entries(want)) if ((s as Record<string, unknown>)[k] !== v) out.push(`scene.${k} is ${JSON.stringify((s as Record<string, unknown>)[k])}, not ${JSON.stringify(v)}`);
    if (s.stop != null && !s.banner) out.push(`the team is past the ${s.stop} and no banner shows`);
    if (!(s.progress >= 0 && s.progress <= 1)) out.push(`the progress is ${s.progress}`);
    return out;
  };
}

/**
 * The scene a trip preset's page shows at its frozen step `t` (trip=<region>:<progress>), read in Node from the scene's
 * own pure function as the page's hook reports it (base.ts sceneHook): the last stop reached, how it went, whether the
 * team has its counter, the encounter's state if the team stands at a stop, the banner, and not done -- the page must
 * show just this.
 */
function succeedingScene(trip: string, t: number): Partial<NonNullable<BaseHook['scene']>> {
  const w = buildSim(tripStart(trip, t), 1);
  for (let i = 0; i < t; i++) w.step();
  const tr = w.missions.trip!, f = sceneAt(w, tr), s = f.last == null ? null : tr.stops[f.last];
  return { stop: s ? (s.kind === 'challenge' ? s.challenge : s.kind) : null, result: s ? s.result : null, covered: s ? s.covered : null, at: tr.encounter?.state ?? null, banner: f.banner, done: false, result_card: null };
}
/**
 * The first step (1..max) at which a trip preset's world, stepped on, shows what `pred` asks of its scene (a fight's
 * moment for a frozen page's t=: the encounter plays the same whatever step the team left at), or it throws.
 */
function firstStep(trip: string, pred: (f: SceneFrame, t: Trip) => boolean, max = 6000): number {
  const w = buildSim(tripStart(trip, 0), 1);
  for (let i = 1; i <= max; i++) { w.step(); const tr = w.missions.trip; if (tr && pred(sceneAt(w, tr), tr)) return i; }
  throw new Error(`smoke: trip=${trip} never shows the moment wanted in ${max} steps`);
}
/**
 * A fight's frozen frame (BASE_DESIGN 6, 11): the page's scene, read from its hook, just what Node's own run of the
 * scene's pure function says at that step -- the stop and its encounter's state, the boss (its face, pose and flash),
 * the pack's ones in view, what is in flight, the sparks and puffs of smoke, the riders' places and the dragons'
 * flashes -- and `also` of it (the moment the case is for).
 */
function fightIs(trip: string, t: number, also: (s: NonNullable<BaseHook['scene']>) => string | null) {
  const w = buildSim(tripStart(trip, t), 1);
  for (let i = 0; i < t; i++) w.step();
  const tr = w.missions.trip!, f = sceneAt(w, tr), last = f.last == null ? null : tr.stops[f.last];
  const want = { stop: last ? (last.kind === 'challenge' ? last.challenge : last.kind) : null, at: tr.encounter?.state ?? null, baddie: f.baddie?.id ?? null, face: f.baddie?.face ?? null, pose: f.baddie?.pose ?? null, flash: !!f.baddie?.flash,
    foes: f.foes.map((q) => `${q.id}:${q.pose}:${q.facing}`).join(), shots: f.shots.length, marks: f.marks.map((m) => `${m.kind}:${m.age}`).join(), riders: f.riders.map((r) => r.dx).join(), hit: f.flash.join() };
  return (b: BaseHook): string[] => {
    const s = b.scene;
    if (!s) return ['no scene in the hook'];
    const got = { stop: s.stop, at: s.at, baddie: s.baddie, face: s.face, pose: s.pose, flash: s.flash, foes: s.foes.map((q) => `${q.id}:${q.pose}:${q.facing}`).join(), shots: s.shots, marks: s.marks.map((m) => `${m.kind}:${m.age}`).join(), riders: s.riders.join(), hit: s.hit.join() };
    const out = Object.entries(want).filter(([k, v]) => (got as Record<string, unknown>)[k] !== v).map(([k, v]) => `scene.${k} is ${JSON.stringify((got as Record<string, unknown>)[k])}, not the pure scene's ${JSON.stringify(v)}`);
    const why = also(s);
    return why ? [...out, why] : out;
  };
}
/** The fights' moments the frozen cases show (the first step each is on screen): a bolt at a pack of mud goblins, their clods in flight, one gone up in smoke; a hit on the Mole King, and the Mole King down seeing stars. */
const PACK_TRIP = 'millbrook:0.12:auto', BOSS_TRIP = 'oldmine:0.9:auto';
const atPack = (tr: Trip) => !!tr.encounter && tr.stops[tr.encounter.stop].kind === 'foes';
const PACK_BOLT_T = firstStep(PACK_TRIP, (f, tr) => atPack(tr) && f.shots.some((q) => q.el) && f.foes.length >= 2);
const PACK_THROW_T = firstStep(PACK_TRIP, (f, tr) => atPack(tr) && f.shots.filter((q) => q.missile).length >= 2);
const PACK_POOF_T = firstStep(PACK_TRIP, (f, tr) => atPack(tr) && f.marks.some((m) => m.kind === 'poof' && m.age === 8));
const BOSS_HIT_T = firstStep(BOSS_TRIP, (f) => f.baddie?.pose === 'hit' && f.baddie.flash);
const BOSS_DOWN_T = firstStep(BOSS_TRIP, (f) => f.baddie?.pose === 'down') + 120;
/**
 * The same page with `:fail`: the team on its road just where the succeeding one is (the same stop, the same standing),
 * the last stop reached waited out -- its result and its banner (`THORNS - THE TEAM WAITS IT OUT`, a baddie's `... SITS
 * DOWN FOR A BREATHER ...`) the failing road's own, everything else the succeeding road's.
 */
function failingScene(trip: string, t: number): Partial<NonNullable<BaseHook['scene']>> {
  const ok = succeedingScene(trip, t), bad = succeedingScene(`${trip}:fail`, t);
  if (ok.stop !== bad.stop || ok.at !== bad.at || ok.covered !== bad.covered || bad.result !== 'unmet' || !/WAITS IT OUT|SITS DOWN/.test(bad.banner ?? '')) throw new Error(`smoke: trip=${trip}:fail is not the succeeding road waited out: ${JSON.stringify({ ok, bad })}`);
  return { ...ok, result: 'unmet', banner: bad.banner };
}

/**
 * The encounter's screen, frozen at the Mole King's fight with the picks waiting (BASE_DESIGN 11): the menu's rows
 * (ability0...: the pair's breath, PREEN, REST and its rider's special at least) and AUTO among the buttons, TRIP LOG
 * beside them, the trip's encounter at `pick` with pair 0 pending, and every dragon's head on screen clear of the
 * furniture in the sky (ART_BIBLE 1.4: nothing over an eye).
 */
function encounterMenu(b: BaseHook): string[] {
  const out: string[] = [], e = b.trip?.encounter;
  if (!e || e.state !== 'pick' || e.pending !== 0 || e.kind !== 'fight') return [`the trip's encounter is ${JSON.stringify(e && { state: e.state, pending: e.pending, kind: e.kind })}, not the fight's first pick`];
  const rows = Object.keys(b.ui.buttons).filter((k) => k.startsWith('ability'));
  if (rows.length < 3 || !b.ui.buttons.trail || !b.ui.buttons.log) out.push(`the encounter's buttons: ${Object.keys(b.ui.buttons).join(' ')} (want ability0-2 at least, trail, log)`);
  const sky = [...rows.map((k) => b.ui.buttons[k]), ...(b.ui.buttons.trail ? [b.ui.buttons.trail] : [])];
  for (const d of b.dragons) {
    if (!d.head) continue;
    for (const r of sky) if (d.head.x + 6 > r.x && d.head.x - 6 < r.x + r.w && d.head.y + 6 > r.y && d.head.y - 6 < r.y + r.h) out.push(`${d.name}'s head (${d.head.x.toFixed(0)}, ${d.head.y.toFixed(0)}) under the encounter's menu`);
  }
  if (b.ui.chip) out.push('the TEAM OUT chip shows over the scene');
  return out;
}

/**
 * view=base&preset=trip&trip=oldmine:0.9, live (save=0; BASE_DESIGN 6, 11): the team at the Mole King's stop from the
 * first step, the game following it (its road on screen); once the walk-in is done the picks wait -- the menu up, and
 * the world waiting for the pick; the first row tapped (the first pair's breath) is taken and the menu turns to the
 * second pair (pending 1, the world still waiting); AUTO on lets the trail coach pick the rest at once and the turn
 * plays (the encounter at `play`, a move under way); the fight ends (the stop met), the Mole King dozes off and the
 * team walks on, the road still on screen (Esc only says the game is following the team).
 */
async function baseEncounter(page: any): Promise<string[]> {
  const out: string[] = [];
  const st = (): Promise<BaseHook> => page.evaluate(() => (window as any).__dragonCare?.base);
  const until = (fn: string, ms: number) => page.waitForFunction(fn, null, { timeout: ms }).then(() => true, () => false);
  const box = await page.locator('#stage').boundingBox(), k = box.width / 640;
  const click = (r: { x: number; y: number; w: number; h: number }) => page.mouse.click(box.x + (r.x + r.w / 2) * k, box.y + (r.y + r.h / 2) * k);
  if (!(await until('window.__dragonCare?.base?.trip?.encounter?.state === "pick"', 15000))) return [`the fight's picks never waited (the encounter ${JSON.stringify((await st()).trip?.encounter)})`];
  const a = await st();
  if (a.ui.screen !== 'watch' || a.ui.follow !== 'road' || !a.ui.buttons.ability0 || !a.ui.buttons.trail || a.trip?.encounter?.pending !== 0) return [`at the stop the view is ${a.ui.screen} (following ${a.ui.follow}), buttons ${Object.keys(a.ui.buttons).join(' ')}, pending ${a.trip?.encounter?.pending}`];
  const t1 = a.tick;
  await page.waitForTimeout(400);
  if ((await st()).tick !== t1) out.push(`the world ran on while the pick waited on screen (tick ${t1} -> ${(await st()).tick})`);
  await click(a.ui.buttons.ability0);
  if (!(await until('window.__dragonCare?.base?.trip?.encounter?.pending === 1', 3000))) out.push(`the first row tapped left the encounter at ${JSON.stringify((await st()).trip?.encounter && { state: (await st()).trip!.encounter!.state, pending: (await st()).trip!.encounter!.pending })}`);
  const p2 = await st(), t2 = p2.tick;
  await page.waitForTimeout(300);
  if ((await st()).tick !== t2) out.push(`the world ran on while the second pick waited on screen (tick ${t2} -> ${(await st()).tick})`);
  if (!p2.ui.buttons.ability0) out.push('the second pair got no menu');
  await click(a.ui.buttons.trail);
  if (!(await until('window.__dragonCare?.base?.trip?.auto === true', 3000))) out.push('AUTO did not put the trail coach on');
  if (!(await until('window.__dragonCare?.base?.trip?.encounter?.state === "play"', 3000))) out.push(`AUTO left the encounter at ${(await st()).trip?.encounter?.state}`);
  else if ((await st()).trip?.encounter?.move?.by === -1 ? false : (await st()).trip?.encounter?.move?.ability == null) out.push(`the move playing is ${JSON.stringify((await st()).trip?.encounter?.move)}`);
  await page.keyboard.press('4');
  // (the boss is the road's last stop)
  if (!(await until('((s) => !!s && s[s.length - 1].result !== "ahead")(window.__dragonCare?.base?.trip?.stops)', 80000))) return [...out, `the fight never ended (${JSON.stringify((await st()).trip?.encounter)})`];
  const done = await st(), fight = done.trip!.stops[done.trip!.stops.length - 1];
  if (fight.kind !== 'baddie' || fight.result !== 'met' || !fight.log.includes('WORN OUT: IT SEES STARS')) out.push(`the fight ended ${JSON.stringify(fight)}`);
  if (done.scene?.baddie !== 'moleking' || (done.scene.pose !== 'down' && done.scene.pose !== 'flee')) out.push(`as the fight ended the Mole King is ${JSON.stringify(done.scene && { baddie: done.scene.baddie, pose: done.scene.pose })}, not down seeing stars`);
  if (!(await until('window.__dragonCare?.base?.trip?.encounter === null', 30000))) out.push(`the Mole King's exit never let the team walk on (${JSON.stringify((await st()).trip?.encounter)})`);
  const on = await st();
  if ((on.scene?.baddie != null && on.scene.pose !== 'flee') || on.trip!.walked <= done.trip!.walked - 1) out.push(`after the fight the scene shows ${JSON.stringify(on.scene)}, walked ${on.trip?.walked}`);
  await page.keyboard.press('1');
  await page.keyboard.press('Escape');
  if (!(await until('(window.__dragonCare?.base?.toast ?? "").startsWith("FOLLOWING THE TEAM")', 2000))) out.push(`Esc on the road after the fight said ${JSON.stringify((await st()).toast)}`);
  const e = await st();
  if (e.ui.screen !== 'watch' || e.ui.follow !== 'road') out.push(`after the fight the view is ${e.ui.screen} (following ${e.ui.follow}), not the road`);
  if (!out.length) console.log(`        encounter: the Mole King's picks waited at step ${a.tick} on the road the game follows, the menu up with ${Object.keys(a.ui.buttons).filter((q) => q.startsWith('ability')).length} rows and the world waiting; the first row took RIPPLE's pick and the menu turned to the second pair; AUTO on, the fight ended at step ${done.tick} in a win ("${fight.log}"), the Mole King down seeing stars and off up the road as the team walked on, the road still on screen`);
  return out;
}

/**
 * view=base&preset=trip, live (save=0; BASE_DESIGN 6): the game follows the team out -- its riders BEA and IRIS away on
 * the road, near its end. The road is on screen from the first frame, the world stepping on under it, with no way back
 * to the barn: Esc says the game is following the team, and it, TOMAS's badge (TOMAS is not a rider), Tab, b, ARENA and
 * a tap on the road all leave the road on screen and nobody held. MAP opens the map at once, the world waiting under
 * it, and BACK shuts it onto the road again; TRIP LOG opens the trip's log and Esc shuts it. At 8x the road ends in the
 * result card, the road still on screen; the card tapped away, the game's following is over: the barn again, the camera
 * on the Aerie as the team lands, and TOMAS's badge takes him.
 */
async function baseFollow(page: any): Promise<string[]> {
  const out: string[] = [];
  const st = (): Promise<BaseHook> => page.evaluate(() => (window as any).__dragonCare?.base);
  const until = (fn: string, ms: number) => page.waitForFunction(fn, null, { timeout: ms }).then(() => true, () => false);
  await page.waitForFunction(() => ((window as any).__dragonCare?.base?.tick ?? 0) > 10, null, { timeout: 15000 });
  const box = await page.locator('#stage').boundingBox(), k = box.width / 640;
  const click = (r: { x: number; y: number; w: number; h: number }) => page.mouse.click(box.x + (r.x + r.w / 2) * k, box.y + (r.y + r.h / 2) * k);
  const onRoad = 'window.__dragonCare?.base?.ui?.screen === "watch" && window.__dragonCare?.base?.ui?.follow === "road"';
  const a = await st();
  if (a.ui.screen !== 'watch' || a.ui.follow !== 'road' || !a.scene) return [`with a team away the view is ${a.ui.screen} (following ${a.ui.follow}), not its road`];
  await page.waitForTimeout(300);
  const b = await st();
  if (!(b.tick > a.tick)) out.push(`the world stood still under the road (tick ${a.tick} -> ${b.tick})`);
  // (nothing leaves the road, and nobody is taken)
  await page.keyboard.press('Escape');
  if (!(await until('(window.__dragonCare?.base?.toast ?? "").startsWith("FOLLOWING THE TEAM")', 2000))) out.push(`Esc on the road said ${JSON.stringify((await st()).toast)}`);
  await click(b.badges.TOMAS);
  await page.keyboard.press('Tab');
  await page.keyboard.press('b');
  await click(b.buttons.arena);
  await click({ x: 320, y: 200, w: 0, h: 0 });
  await page.waitForTimeout(300);
  const c = await st();
  if (c.ui.screen !== 'watch' || c.ui.follow !== 'road' || c.controlled !== null) out.push(`Esc, TOMAS's badge, Tab, b, ARENA and a tap on the road: the view ${c.ui.screen} (following ${c.ui.follow}), ${c.controlled ?? 'nobody'} held`);
  // (MAP: the map at once, the world waiting under it; BACK, the road again)
  await click(c.buttons.map);
  if (!(await until('window.__dragonCare?.base?.ui?.screen === "map"', 1000))) out.push(`MAP on the road opened ${(await st()).ui.screen}, not the map at once`);
  else {
    const m0 = (await st()).tick;
    await page.waitForTimeout(300);
    const m = await st();
    if (m.tick !== m0) out.push(`the world ran on under the map (tick ${m0} -> ${m.tick})`);
    await click(m.ui.buttons.back);
    if (!(await until(onRoad, 1000))) out.push(`BACK on the map left the view ${(await st()).ui.screen} (following ${(await st()).ui.follow}), not the road`);
  }
  // (the trip's log: TRIP LOG opens it, Esc shuts it, the road still on screen)
  await click((await st()).ui.buttons.log);
  if (!(await until('window.__dragonCare?.base?.ui?.log === true', 1000))) out.push('TRIP LOG did not open the log');
  await page.keyboard.press('Escape');
  if (!(await until(`window.__dragonCare?.base?.ui?.log === false && ${onRoad}`, 1000))) out.push(`Esc on the log: the log ${(await st()).ui.log ? 'still open' : 'shut'}, the view ${(await st()).ui.screen}`);
  // (8x to the road's end: the result card over the road)
  await page.keyboard.press('4');
  if (!(await until('window.__dragonCare?.base?.scene?.done === true', 20000))) return [...out, `the road never ended (${Math.round(((await st()).scene?.progress ?? 0) * 100)} % along)`];
  await page.keyboard.press('1');
  const d = await st();
  if (d.ui.screen !== 'watch' || d.ui.follow !== 'road' || !d.ui.buttons.result || d.scene?.result_card !== 'HOME SAFE!') out.push(`at the road's end: the view ${d.ui.screen} (following ${d.ui.follow}), the result card ${JSON.stringify(d.ui.buttons.result ?? null)} saying ${d.scene?.result}`);
  if (!d.ui.buttons.result) return out;
  // (the world waits on the card; Esc shuts the trip's log over it first, and leaves the card up)
  await click(d.ui.buttons.log);
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  const w = await st();
  if (w.tick !== d.tick) out.push(`the world ran on under the result card (tick ${d.tick} -> ${w.tick})`);
  if (w.ui.log || w.ui.screen !== 'watch' || !w.ui.buttons.result) out.push(`TRIP LOG then Esc over the result card: the log ${w.ui.log ? 'open' : 'shut'}, the view ${w.ui.screen}, the card ${w.ui.buttons.result ? 'up' : 'gone'}`);
  // (the card tapped away: the barn again, the world on, the camera on the Aerie as the team lands, the keepers the
  // player's again)
  await click(d.ui.buttons.result);
  if (!(await until('window.__dragonCare?.base?.ui?.screen === "none" && window.__dragonCare?.base?.ui?.follow === null', 1000))) out.push(`the result card tapped away left the view ${(await st()).ui.screen} (following ${(await st()).ui.follow})`);
  if (!(await until('window.__dragonCare?.base?.camX === 0 && window.__dragonCare?.base?.camY === 20', 3000))) out.push(`home, the camera is at ${(await st()).camX}, ${(await st()).camY}, not on the Aerie (0, 20)`);
  const e = await st();
  if (!(e.tick > d.tick)) out.push(`the result card tapped away, the world stood still (tick ${d.tick} -> ${e.tick})`);
  if (e.trip?.state !== 'return') out.push(`home, the trip is ${JSON.stringify(e.trip?.state ?? null)}, not landing`);
  await click(e.badges.TOMAS);
  if (!(await until('window.__dragonCare?.base?.controlled === "TOMAS"', 3000))) out.push(`home, TOMAS's badge: ${(await st()).controlled ?? 'nobody'} held`);
  if (!out.length) console.log(`        follow: the road on screen from the start (${Math.round((a.scene?.progress ?? 0) * 100)} % along), the world stepping on under it; Esc, TOMAS's badge, Tab, b, ARENA and a tap on the road left it there, nobody held; MAP at once and BACK to the road; TRIP LOG and Esc; at 8x the result card (${d.scene?.result}) at step ${d.tick}, the world waiting on it, Esc shutting the log over it; tapped away, the barn with the camera on the Aerie, the world on, the team landing, and TOMAS taken`);
  return out;
}

/**
 * view=base&preset=trip, live (save=0; BASE_DESIGN 6): a failure's road about to end -- its result card (NOT THIS TIME)
 * comes up, the world waiting on it, and Esc puts it away as a tap would: the barn again, the game's following over.
 */
async function baseHomeEsc(page: any): Promise<string[]> {
  const st = (): Promise<BaseHook> => page.evaluate(() => (window as any).__dragonCare?.base);
  const until = (fn: string, ms: number) => page.waitForFunction(fn, null, { timeout: ms }).then(() => true, () => false);
  if (!(await until('window.__dragonCare?.base?.scene?.done === true', 15000))) return [`the road never ended (${Math.round(((await st()).scene?.progress ?? 0) * 100)} % along)`];
  const a = await st();
  if (a.scene?.result_card !== 'NOT THIS TIME' || !a.ui.buttons.result) return [`at the road's end, the result card ${JSON.stringify(a.ui.buttons.result ?? null)} saying ${a.scene?.result_card}`];
  await page.keyboard.press('Escape');
  if (!(await until('window.__dragonCare?.base?.ui?.screen === "none" && window.__dragonCare?.base?.ui?.follow === null', 1000))) return [`Esc on the result card left the view ${(await st()).ui.screen} (following ${(await st()).ui.follow})`];
  console.log(`        home by Esc: the result card (${a.scene.result_card}) at step ${a.tick}, put away by Esc, the barn again`);
  return [];
}

/**
 * The Map Room's table (BASE_DESIGN 5): the overlay open is `screen`, with the board's three missions (day 1: THE LOST NEST
 * first) and the coin on the hook; the map shows a pin per mission, the chooser its BEST TEAM, SEND and BACK.
 */
function tableIs(screen: 'map' | 'mission') {
  return (b: BaseHook): string[] => {
    const out: string[] = [];
    if (!b.ui || b.ui.screen !== screen) out.push(`the table's screen is ${b.ui?.screen}, not ${screen}`);
    if (!Array.isArray(b.board) || b.board.length !== 3 || b.board[0].title !== 'THE LOST NEST') out.push(`the board is ${JSON.stringify(b.board?.map((m) => m.title))}, not three missions with THE LOST NEST first`);
    if (b.coin !== 0 || b.trip !== null) out.push(`coin ${b.coin}, trip ${JSON.stringify(b.trip)}: a new game has none`);
    if (screen === 'map' && (b.ui?.pins.length !== 3 || !b.ui.buttons.back)) out.push(`the map has ${b.ui?.pins.length} pins and buttons ${Object.keys(b.ui?.buttons ?? {})}`);
    if (screen === 'mission' && (!b.ui?.buttons.best || !b.ui.buttons.send || !b.ui.buttons.back || b.ui.mission !== b.board[0]?.id)) out.push(`the chooser shows mission ${b.ui?.mission} with buttons ${Object.keys(b.ui?.buttons ?? {})}`);
    return out;
  };
}
/** The chooser's line about the egg (the hook's `ui.notice`, as drawMissionScreen draws it): `want`, or none. */
function noticeIs(want: string | null) {
  return (b: BaseHook): string[] => (b.ui?.notice === want ? [] : [`the chooser's egg line is ${JSON.stringify(b.ui?.notice)}, not ${JSON.stringify(want)}`]);
}
/**
 * The muster preset at the step its team all stands on the Aerie deck (npm run sim section 20): leaving now, every dragon
 * in the barn's world (none away yet), and the game following it there -- the barn on screen.
 */
function mustered(b: BaseHook): string[] {
  const t = b.trip, team = t ? t.pairs.map((p) => b.dragons.find((d) => d.id === p.dragon)) : [];
  if (!t || t.state !== 'depart' || t.mission !== 'THE LOST NEST') return [`the trip is ${JSON.stringify(t)}, not THE LOST NEST departing`];
  const out = b.ui.follow === 'gather' && b.ui.screen === 'none' ? [] : [`the team setting out: following ${b.ui.follow}, the view ${b.ui.screen}, not the barn`];
  return team.every((d) => d && d.f === 5 && d.place === 'barn') ? out : [...out, `the team is ${team.map((d) => d && `${d.name} f${d.f} ${d.place}`).join(', ')}, not on the Aerie`];
}
/**
 * The muster preset as its team gathers, the page asking for no camera (BASE_DESIGN 6): the game follows the team -- the
 * barn on screen with the camera held on the Aerie deck, the TEAM OUT chip up, and the job strip given way (the barn runs
 * itself).
 */
function gathering(b: BaseHook): string[] {
  const out: string[] = [];
  if (b.trip?.state !== 'muster' || b.ui.follow !== 'gather' || b.ui.screen !== 'none') out.push(`the trip ${b.trip?.state}, following ${b.ui.follow}, the view ${b.ui.screen}: not the team gathering, followed in the barn`);
  if (b.camX !== 0 || b.camY !== 20) out.push(`the camera is at ${b.camX}, ${b.camY}, not held on the Aerie (0, 20)`);
  if (!b.ui.chip || b.chips.length) out.push(`the TEAM OUT chip ${JSON.stringify(b.ui.chip)} and ${b.chips.length} job chips: the job strip gives way while the game follows the team`);
  return out;
}
/**
 * view=base, live (save=0): the Map Room's table (BASE_DESIGN 5, #5: launched from the Aerie). MAP eases the camera to the Map Room and opens the
 * map (within 2 s); a tap on the first pin opens its mission's chooser; BEST TEAM puts a team together; SEND sends it
 * -- the table closes, the trip is mustering, and the game follows the team (BASE_DESIGN 6): the camera held on the Aerie
 * within 2 s (a drag leaves it there), and a keeper at home not taken by a tap on their badge, which says why.
 */
async function baseMission(page: any): Promise<string[]> {
  const out: string[] = [];
  const st = (): Promise<BaseHook> => page.evaluate(() => (window as any).__dragonCare?.base);
  await page.waitForFunction(() => ((window as any).__dragonCare?.base?.tick ?? 0) > 30, null, { timeout: 15000 });
  const box = await page.locator('#stage').boundingBox(), k = box.width / 640;
  const click = (r: { x: number; y: number; w: number; h: number }) => page.mouse.click(box.x + (r.x + r.w / 2) * k, box.y + (r.y + r.h / 2) * k);
  await click((await st()).buttons.map);
  try { await page.waitForFunction(() => (window as any).__dragonCare?.base?.ui?.screen === 'map', null, { timeout: 2000 }); } catch { return [`MAP did not open the map within 2 s (screen ${(await st()).ui.screen})`]; }
  const tick = (await st()).tick;
  await page.waitForTimeout(300);
  if ((await st()).tick !== tick) out.push(`the world ran on under the map (tick ${tick} -> ${(await st()).tick})`);
  const pin = (await st()).ui.pins[0];
  if (!pin) return [...out, 'the map has no pin'];
  await click(pin);
  await page.waitForTimeout(100);
  const m = await st();
  if (m.ui.screen !== 'mission' || !m.ui.buttons.best) return [...out, `the pin opened ${m.ui.screen}, not a mission's chooser`];
  await click(m.ui.buttons.best);
  await page.waitForTimeout(100);
  const team = (await st()).ui.pairs;
  if (!team.length) out.push('BEST TEAM put nobody on the team');
  await click((await st()).ui.buttons.send);
  await page.waitForTimeout(100);
  const s = await st();
  if (!s.trip || s.trip.state !== 'muster' || s.ui.screen !== 'none' || s.ui.follow !== 'gather') out.push(`after SEND the trip is ${JSON.stringify(s.trip?.state)}, the table ${s.ui.screen}, following ${s.ui.follow}`);
  try { await page.waitForFunction(() => (window as any).__dragonCare?.base?.camX === 0 && (window as any).__dragonCare?.base?.camY === 20, null, { timeout: 2000 }); } catch { out.push(`the camera is at ${(await st()).camX}, ${(await st()).camY} 2 s after SEND, not held on the Aerie (0, 20)`); }
  if (!(await st()).ui.buttons.chip) out.push('no TEAM OUT chip with the team out');
  // (following the team as it gathers: a drag leaves the camera on the Aerie, and a badge takes nobody, saying why)
  await page.mouse.move(box.x + 350 * k, box.y + 200 * k);
  await page.mouse.down();
  await page.mouse.move(box.x + 150 * k, box.y + 300 * k, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const g = await st();
  if (g.camX !== 0 || g.camY !== 20) out.push(`a drag moved the camera off the Aerie to ${g.camX}, ${g.camY} while the team gathers`);
  // (a keeper at home: not on the trip's phases, missions.ts TRIP_PHASES)
  const home = g.keepers.find((q) => !['muster', 'depart', 'away', 'deliver'].includes(q.phase))?.name;
  if (!home) return [...out, `nobody is at home: ${g.keepers.map((q) => `${q.name} ${q.phase}`).join(', ')}`];
  await click(g.badges[home]);
  await page.waitForTimeout(200);
  const h = await st();
  if (h.controlled !== null || !h.toast?.startsWith('FOLLOWING THE TEAM')) out.push(`a tap on ${home}'s badge while the team gathers: ${h.controlled ?? 'nobody'} held, the toast ${JSON.stringify(h.toast)}`);
  if (!out.length) console.log(`        mission: MAP, pin 1 (${m.board[0].title}), BEST TEAM (${team.length} pairs), SEND: mustering, followed -- the camera held on the Aerie through a drag, ${home}'s badge taking nobody`);
  return out;
}

/**
 * view=base, live (save=0; BASE_DESIGN 5, 6): the whole mission loop, as a player plays it -- MAP opens the Map Room's
 * map; the first pin (THE LOST NEST) its chooser; BEST TEAM puts a team together; SEND (a command the world takes at its
 * next step) closes the table and the team musters, the game following it; at 8x the team stands together on the Aerie
 * deck (the muster done: leaving over the sky bridge), the barn still on screen; and as it walks off the bridge, its
 * road comes on screen by itself -- the world stepping on underneath, Esc leaving it there -- where TRIP LOG opens the
 * trip's log and closes it again.
 */
async function baseLoop(page: any): Promise<string[]> {
  const out: string[] = [];
  const st = (): Promise<BaseHook> => page.evaluate(() => (window as any).__dragonCare?.base);
  const until = (fn: string, ms: number) => page.waitForFunction(fn, null, { timeout: ms }).then(() => true, () => false);
  await page.waitForFunction(() => ((window as any).__dragonCare?.base?.tick ?? 0) > 30, null, { timeout: 15000 });
  const box = await page.locator('#stage').boundingBox(), k = box.width / 640;
  const click = (r: { x: number; y: number; w: number; h: number }) => page.mouse.click(box.x + (r.x + r.w / 2) * k, box.y + (r.y + r.h / 2) * k);
  await click((await st()).buttons.map);
  if (!(await until('window.__dragonCare?.base?.ui?.screen === "map"', 2000))) return [`MAP did not open the map (screen ${(await st()).ui.screen})`];
  await click((await st()).ui.pins[0]);
  if (!(await until('window.__dragonCare?.base?.ui?.screen === "mission"', 2000))) return [`the first pin opened ${(await st()).ui.screen}, not its chooser`];
  const m = await st(), title = m.board.find((q) => q.id === m.ui.mission)?.title;
  await click(m.ui.buttons.best);
  await page.waitForTimeout(100);
  const pairs = (await st()).ui.pairs;
  if (!pairs.length) return ['BEST TEAM put nobody on the team'];
  await click((await st()).ui.buttons.send);
  if (!(await until('window.__dragonCare?.base?.trip?.state === "muster"', 2000))) return [`after SEND the trip is ${JSON.stringify((await st()).trip)} (the table ${(await st()).ui.screen})`];
  // (8x: the muster -- the team's dragons up by the lift, the riders' saddles from the Tack Room -- in a few seconds)
  await page.keyboard.press('4');
  if (!(await until('["depart", "away"].includes(window.__dragonCare?.base?.trip?.state)', 40000))) return [`the team never stood together on the Aerie (the trip ${(await st()).trip?.state})`];
  const deck = await st();
  if (deck.trip?.state === 'depart' && (deck.ui.screen !== 'none' || deck.ui.follow !== 'gather')) out.push(`the team setting out over the sky bridge: the view ${deck.ui.screen} (following ${deck.ui.follow}), not the barn`);
  // (off the bridge, away: its road on screen by itself)
  const onRoad = 'window.__dragonCare?.base?.ui?.screen === "watch" && window.__dragonCare?.base?.ui?.follow === "road"';
  if (!(await until(`window.__dragonCare?.base?.trip?.state === "away" && ${onRoad}`, 10000))) return [...out, `the trip ${(await st()).trip?.state}: the view ${(await st()).ui.screen} (following ${(await st()).ui.follow}), not the team's road`];
  await page.keyboard.press('1');
  const w = await st();
  if (!w.scene || w.scene.progress < 0 || !w.ui.buttons.log || Object.keys(w.ui.buttons).length !== 1) out.push(`the road: scene ${JSON.stringify(w.scene)}, buttons ${Object.keys(w.ui.buttons).join(' ')} (TRIP LOG alone)`);
  await click(w.ui.buttons.log);
  if (!(await until('window.__dragonCare?.base?.ui?.log === true', 2000))) out.push('TRIP LOG did not open the trip\'s log');
  await click(w.ui.buttons.log);
  if (!(await until('window.__dragonCare?.base?.ui?.log === false', 2000))) out.push('TRIP LOG again did not close the log');
  const t0 = (await st()).tick;
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const e = await st();
  if (!(e.tick > t0)) out.push('the world stood still under the road');
  if (e.ui.screen !== 'watch' || e.ui.follow !== 'road') out.push(`Esc on the road left the view ${e.ui.screen} (following ${e.ui.follow})`);
  if (!out.length) console.log(`        loop: MAP, pin 1 (${title}), BEST TEAM (${pairs.length} pairs), SEND, the muster at 8x to the Aerie deck (${deck.trip?.state} at step ${deck.tick}, the barn on screen), the team's road on screen by itself as it left (${Math.round((w.scene?.progress ?? 0) * 100)} % along, step ${w.tick}), TRIP LOG open and shut, Esc leaving the road there`);
  return out;
}

/**
 * view=base, live (save=0): the world map's places (BASE_DESIGN 5.1). MAP opens the map; a tap on a place with no
 * mission today says what it is (the toast opens with its name) and the map stays open; a tap on a region under cloud
 * (its "?") says how the cloud clears -- a success next door, named; a tap on the first mission's landmark (not its
 * plate) opens its chooser.
 */
async function baseMapPlaces(page: any): Promise<string[]> {
  const out: string[] = [];
  const st = (): Promise<BaseHook> => page.evaluate(() => (window as any).__dragonCare?.base);
  const until = (fn: string, ms: number) => page.waitForFunction(fn, null, { timeout: ms }).then(() => true, () => false);
  await page.waitForFunction(() => ((window as any).__dragonCare?.base?.tick ?? 0) > 30, null, { timeout: 15000 });
  const box = await page.locator('#stage').boundingBox(), k = box.width / 640;
  const click = (r: { x: number; y: number; w: number; h: number }) => page.mouse.click(box.x + (r.x + r.w / 2) * k, box.y + (r.y + r.h / 2) * k);
  await click((await st()).buttons.map);
  if (!(await until('window.__dragonCare?.base?.ui?.screen === "map"', 2000))) return [`MAP did not open the map (screen ${(await st()).ui.screen})`];
  const m = await st(), places = Object.entries(m.ui.places), clouds = Object.entries(m.ui.clouds);
  if (places.length !== 9 || clouds.length !== 3) out.push(`the new game's map has ${places.length} quiet places (want 9: the start regions' twelve, their bosses' lairs among them, less the board's three) and ${clouds.length} clouds (want 3)`);
  const [name, pr] = places[0] ?? [], said: string[] = [];
  if (pr) {
    await click(pr);
    if (!(await until(`(window.__dragonCare?.base?.toast ?? '').startsWith(${JSON.stringify(name)})`, 2000))) out.push(`tapping ${name} said ${JSON.stringify((await st()).toast)}`);
    if ((await st()).ui.screen !== 'map') out.push(`tapping ${name} left the map for ${(await st()).ui.screen}`);
    said.push(`${(await st()).toast}`);
  }
  const [region, cr] = clouds[0] ?? [];
  if (cr) {
    await click(cr);
    if (!(await until(`(window.__dragonCare?.base?.toast ?? '').startsWith('UNDER CLOUD: A SUCCESS IN ')`, 2000))) out.push(`tapping ${region}'s cloud said ${JSON.stringify((await st()).toast)}`);
    said.push(`${(await st()).toast}`);
  }
  const mark = (await st()).ui.buttons.mark0;
  if (!mark) return [...out, 'the map has no landmark for its first mission'];
  await click(mark);
  if (!(await until('window.__dragonCare?.base?.ui?.screen === "mission"', 2000))) return [...out, `the first mission's landmark opened ${(await st()).ui.screen}, not its chooser`];
  if ((await st()).ui.mission !== m.board[0].id) out.push(`the first mission's landmark opened mission ${(await st()).ui.mission}, not ${m.board[0].id}`);
  if (!out.length) console.log(`        map places: ${name} told of ("${said[0]}"), ${region}'s cloud how it clears ("${said[1]}"), ${m.board[0].title}'s landmark opened its chooser`);
  return out;
}

/**
 * view=base&panel=arena (BASE_DESIGN 10): the Arena's chooser, open over a world that waits, with a button for every
 * dragon free to spar (every one, a minute into the new game), no corner filled and no bout on.
 */
function chooserIs(b: BaseHook): string[] {
  const out: string[] = [], picks = b.dragons.filter((d) => b.ui.buttons[`fighter${d.id}`]);
  if (b.ui.screen !== 'arena') out.push(`the screen is ${b.ui.screen}, not the Arena's chooser`);
  if (picks.length !== b.dragons.length) out.push(`only ${picks.map((d) => d.name).join(', ') || 'nobody'} may be picked`);
  for (const k of ['start', 'swap', 'back']) if (!b.ui.buttons[k]) out.push(`no ${k} button`);
  if (b.ui.corners.some((c) => c != null) || b.arena.bout || b.arena.bouts) out.push(`the corners ${JSON.stringify(b.ui.corners)}, the bout ${JSON.stringify(b.arena.bout?.state ?? null)} (${b.arena.bouts} begun)`);
  return out;
}
/**
 * view=base&preset=bout&panel=bout&t=90 (BASE_DESIGN 10): the bout preset at its move menu -- EMBER (LV 3, the player's)
 * in the west corner and BRAMBLE (LV 2) in the east, the pick waiting with AUTO off, a button for each of EMBER's three
 * skills (its breath, the preen and the yawn), AUTO and BACK TO BARN -- and both fighters' heads on screen, under the
 * top bar and clear of every panel by 8 px (ART_BIBLE 1.4: nothing covers an eye).
 */
function boutMenu(b: BaseHook): string[] {
  const out: string[] = [], bt = b.arena.bout;
  if (b.ui.screen !== 'bout' || !bt || bt.state !== 'pick' || bt.auto || bt.t !== 30) return [`the screen ${b.ui.screen}, the bout ${JSON.stringify(bt && { state: bt.state, t: bt.t, auto: bt.auto })}: not the move menu`];
  const want = [['EMBER', 3, 0], ['BRAMBLE', 2, 1]] as const;
  bt.fighters.forEach((f, i) => { if (f.name !== want[i][0] || f.level !== want[i][1] || f.corner !== want[i][2] || f.puff !== f.max) out.push(`fighter ${i} is ${f.name} LV ${f.level} in corner ${f.corner} (${f.puff}/${f.max} puff), not ${want[i][0]} LV ${want[i][1]} in corner ${want[i][2]}, fresh`); });
  const skills = ['skill0', 'skill1', 'skill2', 'skill3'].filter((k) => b.ui.buttons[k]);
  if (skills.length !== 3 || !b.ui.buttons.auto || !b.ui.buttons.boutBack) out.push(`the menu's buttons: ${Object.keys(b.ui.buttons).join(' ')} (want skill0-skill2, auto, boutBack)`);
  const panels = [...PLATES, LOG_LINE, MENU, AUTO, BOUT_BACK], M = 8;
  for (const f of bt.fighters) {
    const h = b.dragons.find((d) => d.id === f.dragon)?.head;
    if (!h) { out.push(`${f.name}'s head was not drawn`); continue; }
    if (h.x < M || h.x > 640 - M || h.y - M < 16) out.push(`${f.name}'s head (${h.x.toFixed(0)}, ${h.y.toFixed(0)}) is off screen or under the top bar`);
    for (const r of panels) if (h.x + M > r.x && h.x - M < r.x + r.w && h.y + M > r.y && h.y - M < r.y + r.h) out.push(`${f.name}'s head (${h.x.toFixed(0)}, ${h.y.toFixed(0)}) is under a panel at (${r.x}, ${r.y}, ${r.w} x ${r.h})`);
  }
  return out;
}

/**
 * The Arena's loop, live (BASE_DESIGN 10): b opens the chooser and b again closes it; ARENA opens it (the world waits
 * under it); EMBER then BRAMBLE tapped into the corners, SWAP and SWAP back; START BOUT opens the bout, its muster
 * begun; BACK TO BARN leaves it on under its chip, and the chip opens it again; at 8x the pair up to their corners and
 * the move menu -- the world waits for the pick; the breath tapped plays; AUTO lets the coach pick; decided, the toasts
 * (who won, and the level and skill it brought), the result card (tapped away: the barn again), and at 8x the pair home,
 * the bout over, the XP each got in the hook.
 */
async function baseArena(page: any): Promise<string[]> {
  const out: string[] = [];
  const st = (): Promise<BaseHook> => page.evaluate(() => (window as any).__dragonCare?.base);
  const until = (fn: string, ms: number) => page.waitForFunction(fn, null, { timeout: ms }).then(() => true, () => false);
  await page.waitForFunction(() => ((window as any).__dragonCare?.base?.tick ?? 0) > 30, null, { timeout: 15000 });
  const box = await page.locator('#stage').boundingBox(), k = box.width / 640;
  const click = (r: { x: number; y: number; w: number; h: number }) => page.mouse.click(box.x + (r.x + r.w / 2) * k, box.y + (r.y + r.h / 2) * k);
  await page.keyboard.press('b');
  if (!(await until('window.__dragonCare?.base?.ui?.screen === "arena"', 3000))) return [`b did not open the Arena (screen ${(await st()).ui.screen})`];
  await page.keyboard.press('b');
  if (!(await until('window.__dragonCare?.base?.ui?.screen === "none"', 3000))) return [`b again did not close the Arena (screen ${(await st()).ui.screen})`];
  await click((await st()).buttons.arena);
  if (!(await until('window.__dragonCare?.base?.ui?.screen === "arena"', 3000))) return [`ARENA did not open the chooser (screen ${(await st()).ui.screen})`];
  let s = await st();
  const t0 = s.tick, ember = s.dragons.find((d) => d.name === 'EMBER')!, bramble = s.dragons.find((d) => d.name === 'BRAMBLE')!;
  if (!s.ui.buttons[`fighter${ember.id}`] || !s.ui.buttons[`fighter${bramble.id}`]) return [`EMBER or BRAMBLE can't be picked (${Object.keys(s.ui.buttons).join(' ')})`];
  await click(s.ui.buttons[`fighter${ember.id}`]);
  await click((await st()).ui.buttons[`fighter${bramble.id}`]);
  await page.waitForTimeout(100);
  s = await st();
  if (s.ui.corners[0] !== ember.id || s.ui.corners[1] !== bramble.id) out.push(`EMBER then BRAMBLE tapped put ${JSON.stringify(s.ui.corners)} in the corners`);
  await click(s.ui.buttons.swap);
  await page.waitForTimeout(100);
  if ((await st()).ui.corners[0] !== bramble.id) out.push(`SWAP left the corners ${JSON.stringify((await st()).ui.corners)}`);
  await click((await st()).ui.buttons.swap);
  await page.waitForTimeout(100);
  if ((await st()).tick !== t0) out.push(`the world stepped under the chooser (tick ${t0} to ${(await st()).tick})`);
  await click((await st()).ui.buttons.start);
  if (!(await until('window.__dragonCare?.base?.ui?.screen === "bout" && window.__dragonCare?.base?.arena?.bout?.state === "muster"', 3000))) return [...out, `START BOUT left the screen ${(await st()).ui.screen} and the bout ${JSON.stringify((await st()).arena.bout?.state ?? null)}`];
  await click((await st()).ui.buttons.boutBack);
  if (!(await until('window.__dragonCare?.base?.ui?.screen === "none" && !!window.__dragonCare?.base?.ui?.boutChip', 3000))) out.push(`BACK TO BARN left the screen ${(await st()).ui.screen}, the bout's chip ${JSON.stringify((await st()).ui.boutChip)}`);
  else {
    await click((await st()).ui.boutChip!);
    if (!(await until('window.__dragonCare?.base?.ui?.screen === "bout"', 3000))) out.push(`the bout's chip opened ${(await st()).ui.screen}, not the bout`);
  }
  // (8x: up to the corners, and the move menu: the world waits for the pick)
  await page.keyboard.press('4');
  if (!(await until('window.__dragonCare?.base?.arena?.bout?.state === "pick"', 60000))) return [...out, `the pair never stood in their corners (the bout ${(await st()).arena.bout?.state})`];
  const up = await st();
  await page.waitForTimeout(400);
  if ((await st()).tick !== up.tick) out.push(`the world stepped on with the move menu up (tick ${up.tick} to ${(await st()).tick})`);
  await page.keyboard.press('1');
  await click((await st()).ui.buttons.skill0);
  if (!(await until('window.__dragonCare?.base?.arena?.bout?.state === "play"', 3000))) out.push(`the breath tapped left the bout at ${(await st()).arena.bout?.state}`);
  else if ((await st()).arena.bout?.moves.find((m) => m.by === 0)?.skill !== 'breath') out.push(`EMBER's move is ${(await st()).arena.bout?.moves.find((m) => m.by === 0)?.skill}, not the breath tapped`);
  await click((await st()).ui.buttons.auto);
  if (!(await until('window.__dragonCare?.base?.arena?.bout?.auto === true', 3000))) out.push('AUTO did not let the coach pick');
  await page.keyboard.press('4');
  if (!(await until('["over", "home"].includes(window.__dragonCare?.base?.arena?.bout?.state)', 60000))) return [...out, `the bout never ended (${(await st()).arena.bout?.state})`];
  await page.keyboard.press('1');
  const won = await until('/WINS THE BOUT|A DRAW/.test(window.__dragonCare?.base?.toast ?? "")', 5000);
  const decided = await st(), bt = decided.arena.bout!, name = bt.winner == null ? null : bt.fighters[bt.winner].name;
  if (!won) out.push(`no toast of the bout's end (the toast ${JSON.stringify(decided.toast)})`);
  const levelled = name ? await until(`/${name} IS LEVEL 2! NEW SKILL: YAWN/.test(window.__dragonCare?.base?.toast ?? "")`, 8000) : true;
  if (!levelled) out.push(`no toast of ${name}'s level and new skill (the toast ${JSON.stringify((await st()).toast)})`);
  if (!(await st()).ui.buttons.result) out.push('no result card once the bout was decided');
  else {
    await click((await st()).ui.buttons.result);
    if (!(await until('window.__dragonCare?.base?.ui?.screen === "none"', 3000))) out.push(`the result card tapped left the screen ${(await st()).ui.screen}`);
  }
  await page.keyboard.press('4');
  if (!(await until('window.__dragonCare?.base?.arena?.bout === null', 60000))) return [...out, `the pair never got home (the bout ${(await st()).arena.bout?.state})`];
  const home = await st(), xp = [ember, bramble].map((d) => home.dragons.find((q) => q.id === d.id)!);
  if (xp[0].xp !== bt.xp[0] || xp[1].xp !== bt.xp[1] || home.arena.bouts !== 1 || home.ui.boutChip) out.push(`home: EMBER ${xp[0].xp} XP LV ${xp[0].level}, BRAMBLE ${xp[1].xp} XP LV ${xp[1].level} (the bout gave ${JSON.stringify(bt.xp)}); ${home.arena.bouts} bouts begun; the chip ${JSON.stringify(home.ui.boutChip)}`);
  if (!out.length) console.log(`        arena: b open and shut, ARENA, EMBER and BRAMBLE tapped into the corners, SWAP and back, START BOUT, BACK TO BARN and the chip, the move menu at step ${up.tick} (the world waiting), the breath tapped, AUTO; ${name ?? 'nobody'} ${name ? 'won' : 'drew'} in ${bt.turn} turns (+${bt.xp.join(' and +')} XP), the toasts, the result card tapped away; the pair home by step ${home.tick}`);
  return out;
}

/**
 * Barn capacity (BASE_DESIGN 4.7): the hook's count of the barn's dragons against its cap (life.ts BARN_CAP, 12) -- every
 * dragon not living in the garden -- as the top bar's `BARN n/12` shows it.
 */
function barnIs(count: number) {
  return (b: BaseHook): string[] => {
    const inBarn = b.dragons.filter((d) => d.place !== 'garden').length;
    return b.barn && b.barn.count === count && b.barn.cap === 12 && inBarn === count ? [] : [`the barn is ${JSON.stringify(b.barn)} with ${inBarn} dragons out of the garden, not ${count} of 12`];
  };
}
/** view=base&preset=full and capped: the due egg still in its nest (the barn at or over its cap: it waits, and its nest shows it). */
function eggWaits(b: BaseHook): string[] {
  return b.eggs?.length === 1 && b.eggs[0].progress === 1 ? [] : [`the eggs are ${JSON.stringify(b.eggs)}, not one due and waiting`];
}
/**
 * view=base&preset=capped: nobody stands in front of the waiting egg's nest (the first, world x 228 in the hayloft), so
 * the egg and its dots show (a baby's body reaches 30 px either way of its root: layout.ts DRAGON_PAD).
 */
function nestClear(b: BaseHook): string[] {
  const by = b.dragons.filter((d) => d.f === 2 && Math.abs(d.x - 228) < 40);
  return by.length ? [`${by.map((d) => `${d.name} (x ${Math.round(d.x)})`).join(', ')} stands in front of the waiting egg's nest`] : [];
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
/**
 * view=base, live (save=0): taking a keeper (BASE_DESIGN 4.10, #6). A tap on BEA's badge takes her (the hook's `controlled`);
 * holding d walks her right; Esc lets go; a tap on her body (low in her box: a bubble over a dragon's head may stand
 * over its top) takes her again; holding the pad's right arrow walks her right; a tap on LET GO lets go. The pad and the
 * line over it are there while she is held (the hook's `action`), and gone after.
 */
async function baseControl(page: any): Promise<string[]> {
  const out: string[] = [];
  const st = (): Promise<BaseHook> => page.evaluate(() => (window as any).__dragonCare?.base);
  const bea = (b: BaseHook) => b.keepers.find((k) => k.name === 'BEA')!;
  const held = (name: string | null) => page.waitForFunction((n: string | null) => (window as any).__dragonCare?.base?.controlled === n, name, { timeout: 5000 }).then(() => true, () => false);
  await page.waitForFunction(() => ((window as any).__dragonCare?.base?.tick ?? 0) > 30, null, { timeout: 15000 });
  const box = await page.locator('#stage').boundingBox(), k = box.width / 640;
  const click = (x: number, y: number) => page.mouse.click(box.x + x * k, box.y + y * k);
  const b0 = await st(), badge = b0.badges.BEA;
  if (!badge || badge.y + badge.h > 15) return [`BEA's badge is ${JSON.stringify(badge)}, not in the top bar`];
  // 1. her badge
  await click(badge.x + badge.w / 2, badge.y + badge.h / 2);
  if (!(await held('BEA'))) out.push(`a tap on BEA's badge: controlled is ${(await st()).controlled}`);
  const b1 = await st();
  if (!b1.action || !b1.action.startsWith('BEA')) out.push(`BEA held, the line over the pad is ${JSON.stringify(b1.action)}`);
  // 2. d held 600 ms
  await page.waitForTimeout(200);
  const x1 = bea(await st()).x;
  await page.keyboard.down('d');
  for (let i = 0; i < 6; i++) { await page.waitForTimeout(100); out.push(...hudClear(await st())); }
  await page.keyboard.up('d');
  await page.waitForTimeout(100);
  const x2 = bea(await st()).x;
  if (!(x2 > x1 + 5)) out.push(`holding d walked BEA from x ${x1.toFixed(1)} to ${x2.toFixed(1)}`);
  // 3. Esc
  await page.keyboard.press('Escape');
  if (!(await held(null))) out.push(`Esc left ${(await st()).controlled} held`);
  if ((await st()).action !== null) out.push('let go, the line over the pad is still there');
  // 4. her body
  await page.waitForTimeout(150);
  const kb = bea(await st()).box;
  await click(kb.x + kb.w / 2, kb.y + kb.h * 0.75);
  if (!(await held('BEA'))) out.push(`a tap on BEA's body (${JSON.stringify(kb)}): controlled is ${(await st()).controlled}`);
  // 5. the pad's right arrow held 500 ms
  await page.waitForTimeout(200);
  const b5 = await st(), right = b5.pad.right, x5 = bea(b5).x;
  await page.mouse.move(box.x + (right.x + right.w / 2) * k, box.y + (right.y + right.h / 2) * k);
  await page.mouse.down(); await page.waitForTimeout(500); await page.mouse.up();
  await page.waitForTimeout(100);
  const b6 = await st(), x6 = bea(b6).x;
  if (!(x6 > x5 + 5)) out.push(`the pad's right arrow held walked BEA from x ${x5.toFixed(1)} to ${x6.toFixed(1)}`);
  if (b6.controlled !== 'BEA') out.push(`holding the pad let go of BEA (controlled ${b6.controlled})`);
  out.push(...hudClear(b6));
  // (a tap in the pad's gaps goes to the nearest button, never through to the world: that would let go)
  await click(b6.pad.up.x - 1, b6.pad.up.y + b6.pad.up.h / 2);
  await click(b6.pad.act.x + b6.pad.act.w / 2, b6.pad.act.y - 3);
  await page.waitForTimeout(150);
  if ((await st()).controlled !== 'BEA') out.push(`a tap between the pad's buttons let go of BEA (controlled ${(await st()).controlled})`);
  // 6. LET GO
  const lg = b6.pad.letgo;
  await click(lg.x + lg.w / 2, lg.y + lg.h / 2);
  if (!(await held(null))) out.push(`a tap on LET GO left ${(await st()).controlled} held`);
  // 7. paused (p): a badge takes TOMAS at once as far as the screen goes (his line), a second tap lets go again, and
  // played on, nobody is held
  await page.keyboard.press('p');
  const tb = b6.badges.TOMAS;
  await click(tb.x + tb.w / 2, tb.y + tb.h / 2);
  await page.waitForTimeout(100);
  const p1 = await st();
  if (p1.speed !== 0 || !p1.action?.startsWith('TOMAS')) out.push(`paused, a tap on TOMAS's badge: speed ${p1.speed}, the line ${JSON.stringify(p1.action)}`);
  await click(tb.x + tb.w / 2, tb.y + tb.h / 2);
  await page.waitForTimeout(100);
  if ((await st()).action !== null) out.push(`paused, a second tap on TOMAS's badge left the line ${JSON.stringify((await st()).action)}`);
  await page.keyboard.press('p');
  await page.waitForTimeout(200);
  if ((await st()).controlled !== null) out.push(`paused, TOMAS taken and let go: played on, ${(await st()).controlled} is held`);
  if (!out.length) console.log(`        control: BEA taken by her badge, walked by d (x ${x1.toFixed(0)} -> ${x2.toFixed(0)}), let go by Esc, taken by a tap on her, walked by the pad (x ${x5.toFixed(0)} -> ${x6.toFixed(0)}), held through taps in the pad's gaps, let go by LET GO; paused, TOMAS taken and let go by his badge; no dragon's head under the pad or the line`);
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
  { query: 'view=base&t=600', minColours: 150, allScales: false, check: (b) => [...castIs(7, 'adult')(b), ...travels(b), ...gardenIs(0, 2)(b), ...barnIs(7)(b)] },
  { query: 'view=base&preset=ages&t=60', minColours: 150, allScales: false, check: (b) => [...castIs(12, null)(b), ...everyStage(b), ...travels(b)] },
  { query: 'view=base&t=3600', minColours: 150, allScales: false, base: true, check: walkedOver(100) },
  { query: 'view=base&save=0', minColours: 150, allScales: false, act: baseInput },
  { query: 'view=base&save=0', minColours: 150, allScales: false, act: baseKeys },
  // time: night by the hour, day against night (the world layer the same, the frame not), the speed, and saves --
  // a frozen page ignores the one in storage, and so does a live page given hour=; a live page resumes its own after a
  // reload, and sets aside one that doesn't fit, of another version or broken (the only live cases without save=0,
  // each in its own page and storage)
  { query: 'view=base&t=600&hour=22', minColours: 150, allScales: false, hash: true, pixels: true, check: (b) => [...castIs(7, 'adult')(b), ...timeFields('night', false, 3)(b)] },
  { query: 'view=base&t=600&hour=12', minColours: 150, allScales: false, hash: true, pixels: true, check: timeFields('day', false, 0) },
  { query: 'view=base&t=600&hour=12&layers=cast', minColours: 150, allScales: false, hash: true, check: timeFields('day', false, 0) },
  { query: 'view=base&t=600&hour=22&layers=cast', minColours: 150, allScales: false, hash: true, check: timeFields('night', false, 3) },
  // (the dusk's and the dawn's turn: the walls a third and two thirds of the way, 18:20 and 05:20)
  { query: 'view=base&t=600&hour=17', minColours: 150, allScales: false, check: timeFields('dusk', false, 1) },
  { query: 'view=base&t=600&hour=4', minColours: 150, allScales: false, check: timeFields('dawn', false, 2) },
  { query: 'view=base&save=0', minColours: 150, allScales: false, act: baseSpeed },
  { query: 'view=base&t=600', minColours: 150, allScales: false, init: plant(PLANTED), act: plantedFrozen },
  { query: 'view=base', minColours: 150, allScales: false, act: livePersist, timeout: 45000 },
  { query: 'view=base', minColours: 150, allScales: false, init: plant(OLD_SAVE), act: liveOldSave },
  { query: 'view=base', minColours: 150, allScales: false, init: plant(V9_SAVE), act: liveV9Save },
  ...BROKEN_SAVES.map((b): Case => ({ query: 'view=base', minColours: 150, allScales: false, init: plant(b.blob), act: liveBrokenSave(b) })),
  { query: 'view=base&hour=22', minColours: 150, allScales: false, init: plant(PLANTED), act: liveHourNoSave },
  // growing up and eggs (BASE_DESIGN 7): EMBER grown an elder, three eggs in the Hatchery's nests, an egg hatched into a baby;
  // live, a dragon's card
  { query: 'view=base&preset=growup&t=60', minColours: 150, allScales: false, check: (b) => [...grownUp(b), ...travels(b)] },
  { query: 'view=base&preset=eggs&t=600&cam=168,280', minColours: 150, allScales: false, check: (b) => [...eggsIn(b), ...travels(b)] },
  { query: 'view=base&preset=hatch&t=120&cam=168,280', minColours: 150, allScales: false, check: (b) => [...hatchedOne(b), ...travels(b)] },
  { query: 'view=base&save=0', minColours: 150, allScales: false, act: baseCard },
  // taking a keeper (BASE_DESIGN 4.10): frozen, BEA held from the first step (the pad, her mark, the line); live, taken and let
  // go by her badge, the keys, a tap on her and the pad
  { query: 'view=base&t=120&take=bea', minColours: 150, allScales: false, check: (b) => [...castIs(7, 'adult')(b), ...(b.controlled === 'BEA' && b.action?.startsWith('BEA') && b.keepers.find((k) => k.name === 'BEA')?.phase === 'manual' ? [] : [`take=bea: controlled ${b.controlled}, the line ${JSON.stringify(b.action)}`]), ...markShown('BEA')(b), ...hudClear(b)] },
  // (held in the hayloft, at night: the camera frames her floor, so her mark shows under the top bar, and the ground
  // floor's heads are off the screen, not under the pad)
  { query: 'view=base&t=200&hour=22&take=iris', minColours: 120, allScales: false, check: (b) => [...markShown('IRIS')(b), ...hudClear(b), ...(b.keepers.find((k) => k.name === 'IRIS')?.f === 2 ? [] : ['take=iris: IRIS is not in the hayloft'])] },
  { query: 'view=base&save=0', minColours: 150, allScales: false, act: baseControl },
  // the elder garden (BASE_DESIGN 3, The Garden): the garden preset's three residents on their plots, past the Garden Gate, by day and at
  // night (napping, the lanterns lit)
  { query: 'view=base&preset=garden&cam=1304,376&t=600', minColours: 150, allScales: false, check: (b) => [...gardenIs(3, 3)(b), ...travels(b)] },
  { query: 'view=base&preset=garden&cam=1304,376&t=600&hour=22', minColours: 150, allScales: false, check: (b) => [...gardenIs(3, 3)(b), ...timeFields('night', false, 3)(b)] },
  // barn capacity (BASE_DESIGN 4.7): the capacity benchmark's twelve, the barn at its cap (BARN 12/12), every element among
  // them; and the full preset, forced 9 over it (BARN 21/12), its due egg waiting in its nest in the hayloft's corner
  { query: 'view=base&preset=twelve&t=600', minColours: 150, allScales: false, check: (b) => [...castIs(12, null)(b), ...travels(b), ...barnIs(12)(b)] },
  { query: 'view=base&preset=full&t=60&cam=168,280', minColours: 150, allScales: false, check: (b) => [...castIs(21, null)(b), ...barnIs(21)(b), ...eggWaits(b)] },
  // and the capped preset, the barn at its cap (BARN 12/12), its egg due on the first step waiting in the Hatchery's
  // first nest with nobody in front of it (the nest's dots in view)
  { query: 'view=base&preset=capped&t=60&cam=168,280', minColours: 150, allScales: false, check: (b) => [...castIs(12, null)(b), ...barnIs(12)(b), ...eggWaits(b), ...nestClear(b)] },
  // (a team away: the game follows it, its road on screen with no panel= asking -- and a keeper asked for by take= is
  // not taken, the game saying why. The walked road, BASE_DESIGN 11: 0.905 is just past the Mole King's stop, its fight
  // won -- the Mole King dozing off calmed, in view; with :fail the team sat that fight out (the banner says so) and it
  // dozed off just the same, the team on its road just where the winning one is; 0.9 is the fight itself from its
  // walk-in: at t=200 the picks wait -- the menu on screen, its rows and AUTO among the buttons, the fighters' plates and
  // the Mole King's, every head clear of them; 0.3 on Millbrook's road is past its first stop, cleared, as the scene's
  // own function says)
  { query: 'view=base&preset=trip&trip=oldmine:0.905&take=tomas&t=60', minColours: 150, allScales: false, check: (b) => [...sceneIs({ stop: 'baddie', result: 'met', baddie: null, at: null })(b), ...(b.controlled === null && b.toast?.startsWith('FOLLOWING THE TEAM') ? [] : [`take=tomas on the road: ${b.controlled ?? 'nobody'} held, the toast ${JSON.stringify(b.toast)}`])] },
  { query: 'view=base&preset=trip&trip=oldmine:0.905:fail&t=60', minColours: 150, allScales: false, check: sceneIs({ ...failingScene('oldmine:0.905', 60), baddie: null }) },
  { query: 'view=base&preset=trip&trip=oldmine:0.9&t=200', minColours: 150, allScales: false, check: (b) => [...sceneIs({ stop: 'baddie', result: 'ahead', at: 'pick', baddie: 'moleking', face: 'fierce', pose: 'stand' })(b), ...encounterMenu(b)] },
  // (`:auto`: the trail coach plays the fight -- at t=209 BEA's CHARM, the first move, has just landed on the Mole King:
  // the encounter at play, the Mole King surprised, no menu on screen (THE TRAIL COACH PICKS in its place) and AUTO lit)
  { query: `view=base&preset=trip&trip=${BOSS_TRIP}&t=${BOSS_HIT_T}`, minColours: 150, allScales: false, check: (b) => [...sceneIs({ stop: 'baddie', result: 'ahead', at: 'play', baddie: 'moleking', face: 'hurt', pose: 'hit', flash: true })(b), ...fightIs(BOSS_TRIP, BOSS_HIT_T, () => null)(b), ...(b.trip?.auto && !Object.keys(b.ui.buttons).some((k) => k.startsWith('ability')) && b.ui.buttons.trail ? [] : [`with AUTO the buttons are ${Object.keys(b.ui.buttons).join(' ')}, auto ${b.trip?.auto}`])] },
  { query: `view=base&preset=trip&trip=${BOSS_TRIP}&t=${BOSS_DOWN_T}`, minColours: 150, allScales: false, check: (b) => [...sceneIs({ stop: 'baddie', result: 'met', at: 'done', baddie: 'moleking', face: 'dazed', pose: 'down' })(b), ...fightIs(BOSS_TRIP, BOSS_DOWN_T, (s) => (s.riders.every((r) => r === 56) ? null : `the riders stand at ${s.riders.join(', ')}, not beside their dragons again`))(b)] },
  { query: `view=base&preset=trip&trip=${PACK_TRIP}&t=${PACK_BOLT_T}`, minColours: 150, allScales: false, check: fightIs(PACK_TRIP, PACK_BOLT_T, (s) => (s.stop === 'foes' && s.at === 'play' && s.foes.length >= 2 && s.shots >= 1 && s.riders.every((r) => r < 0) ? null : `a pack's fight shows ${JSON.stringify({ stop: s.stop, at: s.at, foes: s.foes.length, shots: s.shots, riders: s.riders })}`)) },
  { query: `view=base&preset=trip&trip=${PACK_TRIP}&t=${PACK_THROW_T}`, minColours: 150, allScales: false, check: fightIs(PACK_TRIP, PACK_THROW_T, (s) => (s.shots >= 2 && s.foes.every((q) => q.id === 'mudgoblin') ? null : `the goblins' throw shows ${s.shots} in flight`)) },
  { query: `view=base&preset=trip&trip=${PACK_TRIP}&t=${PACK_POOF_T}`, minColours: 150, allScales: false, check: fightIs(PACK_TRIP, PACK_POOF_T, (s) => (s.marks.some((m) => m.kind === 'poof') ? null : 'no puff of smoke')) },
  { query: 'view=base&preset=trip&trip=millbrook:0.3&t=60', minColours: 150, allScales: false, check: (b) => [...sceneIs({ ...succeedingScene('millbrook:0.3', 60), result: 'met', baddie: null, at: null })(b), ...(b.scene?.stop && b.scene.stop !== 'baddie' ? [] : [`the last stop is ${b.scene?.stop}, not a challenge`])] },
  { query: 'view=base&preset=trip&trip=bramblewood:0.7:fail&t=60', minColours: 150, allScales: false, check: sceneIs({ ...failingScene('bramblewood:0.7', 60), baddie: null }) },
  { query: 'view=base&preset=trip&trip=oldmine:1&t=60', minColours: 150, allScales: false, check: sceneIs({ done: true, result_card: 'HOME SAFE!' }) },
  { query: 'view=base&preset=trip&trip=bramblewood:1:fail&t=60', minColours: 150, allScales: false, check: sceneIs({ done: true, result_card: 'NOT THIS TIME' }) },
  // (panel=watch asks for the scene the game shows anyway)
  { query: 'view=base&preset=trip&trip=millbrook:0.3&panel=watch&t=60', minColours: 150, allScales: false, check: sceneIs({ ...succeedingScene('millbrook:0.3', 60), baddie: null }) },
  { query: 'view=base&preset=trip&trip=oldmine:0.97&save=0', minColours: 150, allScales: false, act: baseFollow },
  { query: 'view=base&preset=trip&trip=bramblewood:0.998:fail&save=0', minColours: 150, allScales: false, act: baseHomeEsc },
  { query: 'view=base&preset=trip&trip=oldmine:0.9&save=0', minColours: 150, allScales: false, act: baseEncounter, timeout: 90000 },
  // the mission art kit (ART_BIBLE 5.10): every sheet draws everything on it (the page's hook lists it), in its colours
  { query: 'view=missionart&sheet=climates&t=0', minColours: 1000, allScales: false, art: { sheet: 'climates', want: CLIMATES.flatMap((c) => PHASE_ORDER.map((p) => `${c}:${p}`)) } },
  { query: 'view=missionart&sheet=climates&climate=peaks&phase=night&t=90', minColours: 500, allScales: false, art: { sheet: 'climates', want: ['peaks:night:scene'] } },
  { query: 'view=missionart&sheet=setpieces&t=60', minColours: 1000, allScales: false, art: { sheet: 'setpieces', want: CHALLENGE_IDS } },
  { query: 'view=missionart&sheet=passages&t=60', minColours: 300, allScales: false, art: { sheet: 'passages', want: (Object.keys(PASSAGES) as string[]).flatMap((id) => [`${id}:unmet`, `${id}:met`]) } },
  { query: 'view=missionart&sheet=baddies&t=30', minColours: 1000, allScales: false, art: { sheet: 'baddies', want: [...BADDIE_IDS, ...BADDIE_IDS.map((b) => `${b}:portrait`)] } },
  { query: 'view=missionart&sheet=foes&t=30', minColours: 400, allScales: false, art: { sheet: 'foes', want: FOE_IDS } },
  { query: 'view=missionart&sheet=fights&t=30', minColours: 100, allScales: false, art: { sheet: 'fights', want: [...DRAGON_ELEMENTS.map((e) => `bolt:${e}`), ...Object.keys(MISSILES).map((k) => `missile:${k}`),
    ...Array.from({ length: SPARK_LEN / 2 }, (_, i) => `spark:${i * 2}`), ...Array.from({ length: POOF_LEN / 5 }, (_, i) => `poof:${i * 5}`), 'stars'] } },
  { query: 'view=missionart&sheet=people&t=50', minColours: 1000, allScales: false, keepers: true, art: { sheet: 'people', want: ['miller:grumpy', 'miller:talkedRound', ...KEEPER_IDS] } },
  { query: 'view=missionart&sheet=icons&t=0', minColours: 300, allScales: false, art: { sheet: 'icons', want: [...CHALLENGE_IDS.map((c) => `challenge:${c}`), ...SKILLS.map((k) => `skill:${k}`), 'saddle', ...DRAGON_ELEMENTS.map((e) => `egg:${e}`), ...BADDIE_IDS.map((b) => `portrait:${b}`), 'fight'] } },
  // (the world map's landmarks, HOME and the land's growths: BASE_DESIGN 5.1)
  { query: 'view=missionart&sheet=places&t=0', minColours: 90, allScales: false, art: { sheet: 'places', want: [...new Set(PLACES.map((p) => `place:${p.art}`)), 'home', ...growthSamples().map((g) => `growth:${g.name}`)] } },
  // missions (BASE_DESIGN 5): the Map Room's world map and a mission's chooser (frozen, the world stepped first), the muster
  // preset's team all on the Aerie deck and gathering there, followed (BASE_DESIGN 6), and live, MAP -> a pin -> BEST
  // TEAM -> SEND, the camera held on the Aerie
  { query: 'view=base&t=60&panel=map', minColours: 100, maxPanelColours: 110, allScales: false, check: tableIs('map') },
  { query: 'view=base&t=60&panel=mission&mission=0', minColours: 100, allScales: false, check: (b) => [...tableIs('mission')(b), ...noticeIs(null)(b)] },
  // (and over a full barn: the twelve preset at the cap, the chooser open on THE LOST NEST, its egg to wait)
  { query: 'view=base&preset=twelve&t=60&panel=mission&mission=0', minColours: 100, allScales: false, check: (b) => [...tableIs('mission')(b), ...barnIs(12)(b), ...noticeIs('BARN FULL: THE EGG WILL WAIT')(b)] },
  { query: 'view=base&preset=muster&t=2186&cam=0,20', minColours: 150, allScales: false, check: (b) => [...mustered(b), ...travels(b)] },
  { query: 'view=base&preset=muster&t=900', minColours: 100, allScales: false, check: (b) => [...gathering(b), ...travels(b)] },
  { query: 'view=base&save=0', minColours: 150, allScales: false, act: baseMission },
  // (the world map's places, live: a quiet place told of, a cloud's way to clear, a mission's landmark to its chooser)
  { query: 'view=base&save=0', minColours: 150, allScales: false, act: baseMapPlaces },
  // the whole loop live (BASE_DESIGN 5, 6): MAP -> a pin -> BEST TEAM -> SEND -> the muster on the Aerie, followed -> the
  // team's road on screen as it leaves (its trip log; Esc leaves it there)
  { query: 'view=base&save=0', minColours: 150, allScales: false, act: baseLoop },
  // the Arena (BASE_DESIGN 10): the sparring audit (every look's every sparring skill against every look: no eye
  // covered), the chooser and the bout preset's move menu frozen, and the loop live
  { query: 'view=arenaaudit&t=0', minColours: 2, allScales: false, timeout: 300000, arena: 84 },
  { query: 'view=base&t=60&panel=arena', minColours: 100, allScales: false, check: chooserIs },
  { query: 'view=base&preset=bout&panel=bout&t=90', minColours: 150, allScales: false, check: boutMenu },
  { query: 'view=base&save=0', minColours: 150, allScales: false, act: baseArena, timeout: 60000 },
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
    if (c.arena) {
      const rows: { id: string; covered: number; against: string; frame: number; reach: number; own: number; gap: number }[] = await page.evaluate(() => (window as any).__dragonCare?.arena ?? []);
      if (rows.length < c.arena) errors.push(`the sparring audit played ${rows.length} skills, not ${c.arena}`);
      for (const r of rows) {
        if (r.covered > 0) errors.push(`${r.id} covers ${r.covered} px of ${r.against}'s eye at f${r.frame}`);
        if (r.own > 0) errors.push(`${r.against} covers ${r.own} px of ${r.id}'s own eye at f${r.frame}`);
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
    if (c.pixels) {
      pixels.set(c.query, await page.evaluate(() => {
        const cv = document.getElementById('stage') as HTMLCanvasElement, d = cv.getContext('2d')!.getImageData(0, 0, cv.width, cv.height).data;
        const px: number[] = [];
        for (let i = 0; i < d.length; i += 4) px.push((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
        return { w: cv.width, px };
      }));
    }
    if (c.art) {
      const h: { sheet: string; drawn: string[] } | undefined = await page.evaluate(() => (window as any).__dragonCare?.missionart);
      if (!h) errors.push('the mission art sheet reported nothing');
      else {
        if (h.sheet !== c.art.sheet) errors.push(`the sheet is ${h.sheet}, not ${c.art.sheet}`);
        const missing = c.art.want.filter((w) => !h.drawn.includes(w));
        if (missing.length) errors.push(`not drawn: ${missing.join(', ')}`);
      }
    }
    if (c.act) errors.push(...await c.act(page));
    const colours: number[] = await page.evaluate(() => {
      const cv = document.getElementById('stage') as HTMLCanvasElement;
      const d = cv.getContext('2d')!.getImageData(0, 0, cv.width, cv.height).data;
      const seen = new Set<number>();
      for (let i = 0; i < d.length; i += 4) seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
      return [...seen];
    });
    if (c.maxPanelColours != null) {
      const n: number = await page.evaluate(() => {
        const cv = document.getElementById('stage') as HTMLCanvasElement, s = cv.width / 640;
        const d = cv.getContext('2d')!.getImageData(Math.round(12 * s), Math.round(22 * s), Math.round(616 * s), Math.round(310 * s)).data, seen = new Set<number>();
        for (let i = 0; i < d.length; i += 4) seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
        return seen.size;
      });
      if (n > c.maxPanelColours) errors.push(`the map's panel has ${n} colours (want <= ${c.maxPanelColours}): anti-aliased edges?`);
    }
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

/**
 * Day against night, pixel by pixel (BASE_DESIGN 7): the share of the frame's pixels that differ; over those, the
 * mean luminance and the mean blue less red (warmth) by day and by night; and the day's floor pixels (a FLOORS colour, the straw seam or the path edge,
 * in the world between the HUD's bars) and how many of them differ by night.
 */
function nightDiff(w: number, day: number[], night: number[]) {
  const floors = new Set([...Object.values(FLOORS), STRAW_SEAM, PATH_EDGE].map(hexToInt));
  const lum = (c: number) => (0.2126 * ((c >> 16) & 255) + 0.7152 * ((c >> 8) & 255) + 0.0722 * (c & 255)) / 255;
  const cool = (c: number) => (c & 255) - ((c >> 16) & 255);
  let changed = 0, lumDay = 0, lumNight = 0, coolDay = 0, coolNight = 0, floor = 0, floorMoved = 0;
  for (let i = 0; i < day.length; i++) {
    const a = day[i], b = night[i], y = Math.floor(i / w);
    if (a !== b) { changed++; lumDay += lum(a); lumNight += lum(b); coolDay += cool(a); coolNight += cool(b); }
    if (y >= 16 && y < 339 && floors.has(a)) { floor++; if (a !== b) floorMoved++; }
  }
  const k = Math.max(1, changed);
  return { share: changed / day.length, lumDay: lumDay / k, lumNight: lumNight / k, coolDay: coolDay / k, coolNight: coolNight / k, floor, floorMoved };
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
  let seen = '';
  if (p.differ !== undefined && a && b) {
    const pa = pixels.get(p.a), pb = pixels.get(p.b);
    if (!pa || !pb || pa.px.length !== pb.px.length) errors.push('no pixels kept for the day-and-night comparison');
    else {
      const n = nightDiff(pa.w, pa.px, pb.px);
      if (n.share < p.differ) errors.push(`night changes ${(n.share * 100).toFixed(1)} % of the frame's pixels, under ${p.differ * 100} %: night can't be told from day at a glance`);
      if (!(n.lumNight < n.lumDay)) errors.push(`the changed pixels are no darker by night (L ${n.lumDay.toFixed(3)} by day, ${n.lumNight.toFixed(3)} by night)`);
      if (!(n.coolNight > n.coolDay)) errors.push(`the changed pixels are no cooler by night (blue less red ${n.coolDay.toFixed(1)} by day, ${n.coolNight.toFixed(1)} by night)`);
      if (n.floorMoved > 0) errors.push(`${n.floorMoved} of the day's ${n.floor} floor pixels change by night: a floor is moonlit`);
      seen = `; ${(n.share * 100).toFixed(1)} % of the pixels changed, darker (L ${n.lumDay.toFixed(3)} -> ${n.lumNight.toFixed(3)}) and cooler (blue less red ${n.coolDay.toFixed(1)} -> ${n.coolNight.toFixed(1)}); all ${n.floor} floor pixels the same`;
    }
  }
  if (errors.length) { bad++; console.log(`  FAIL: ${p.a} / ${p.b} -> ${errors.join(' | ')}`); }
  else console.log(`  ok:   ${p.a} / ${p.b}  (${p.same ? `the same frame ${a!.all} and barn ${ha!.barnDigest}` : `frames ${a!.all} / ${b!.all}, world ${a!.world} / ${b!.world}${seen}`})`);
}

await browser.close();
server.close();
const total = CASES.length + PAIRS.length + TINT.length;
console.log(bad ? `SMOKE: ${bad} of ${total} views and pairs failed` : `SMOKE: all ${CASES.length} views drew dragons (and keepers), no page errors; ${PAIRS.length} pair${PAIRS.length === 1 ? '' : 's'} moved; day and night: the cast alike, the frame not`);
process.exit(bad ? 1 : 0);
