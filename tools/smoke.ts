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
// sunk root lies outside the body (1.2). Both run over all 28 looks.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from './server.ts';
import { AGE_STAGES, DRAGON_ELEMENTS, agedPalette } from '../src/art/dragon/palettes.ts';
import type { AgeStage } from '../src/art/dragon/palettes.ts';

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
interface Case { query: string; minColours: number; allScales: boolean; stages?: readonly AgeStage[]; timeout?: number; floor?: boolean; roots?: boolean }
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

for (const c of CASES) {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e: Error) => errors.push('pageerror: ' + e.message));
  page.on('console', (m: any) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  let msg = '';
  try {
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
    const colours: number[] = await page.evaluate(() => {
      const cv = document.getElementById('stage') as HTMLCanvasElement;
      const d = cv.getContext('2d')!.getImageData(0, 0, cv.width, cv.height).data;
      const seen = new Set<number>();
      for (let i = 0; i < d.length; i += 4) seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
      return [...seen];
    });
    const set = new Set(colours);
    if (colours.length < c.minColours) errors.push(`only ${colours.length} distinct colours (want >= ${c.minColours}): were dragons drawn?`);
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

await browser.close();
server.close();
console.log(bad ? `SMOKE: ${bad} of ${CASES.length} views failed` : `SMOKE: all ${CASES.length} views drew dragons, no page errors`);
process.exit(bad ? 1 : 0);
