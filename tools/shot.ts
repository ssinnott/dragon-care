// Headless screenshots of the page, for looking at art without a browser window.
//
//   node tools/shot.ts <out.png>=<query> [<out.png>=<query> ...] [--scale N]
//   node tools/shot.ts shots/lineup.png="view=lineup&anim=idle&t=40" --scale 3
//
// Each pair loads index.html?<query> through tools/server.ts in headless Chromium, waits for
// `window.__dragonCare.ready`, and writes the stage canvas to <out.png> upscaled N times (default 2) with
// nearest-neighbour, so one art pixel is an N x N block and nothing is smoothed. The upscale happens in the
// page, on a second canvas, so Node needs no image library.
//
// THE CONTRACT with the page (src/main.ts): the query string is the page's to interpret, and anything that
// should be screenshot-able must be reachable from it -- which view, which animation, and a frozen time
// (`t` in fixed 60 Hz steps) so a shot is deterministic. The page sets `ready` only once the frame the
// query asked for has been drawn. Page errors fail the run: a shot of a page that threw is not evidence.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createServer } from './server.ts';

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

const args = process.argv.slice(2);
let scale = 2;
const shots: { out: string; query: string }[] = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--scale') { scale = Math.max(1, Math.round(Number(args[++i]) || 2)); continue; }
  const eq = args[i].indexOf('=');
  if (eq < 0) { shots.push({ out: args[i], query: '' }); continue; }
  shots.push({ out: args[i].slice(0, eq), query: args[i].slice(eq + 1).replace(/^\?/, '') });
}
if (!shots.length) {
  console.error('usage: node tools/shot.ts <out.png>=<query> [...] [--scale N]');
  process.exit(2);
}

const server = createServer();
await new Promise<void>((r) => server.listen(0, () => r()));
const port = (server.address() as { port: number }).port;
const { chromium } = loadPlaywright();
const browser = await launch(chromium);
let bad = 0;

for (const { out, query } of shots) {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e: Error) => errors.push('pageerror: ' + e.message));
  page.on('console', (m: any) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  try {
    await page.goto(`http://localhost:${port}/index.html${query ? '?' + query : ''}`, { waitUntil: 'load' });
    await page.waitForFunction(() => (window as any).__dragonCare?.ready === true, null, { timeout: 15000 });
    const pageErrors: string[] = await page.evaluate(() => (window as any).__dragonCare?.errors ?? []);
    errors.push(...pageErrors);
    const dataUrl: string = await page.evaluate((k: number) => {
      const src = document.getElementById('stage') as HTMLCanvasElement;
      const big = document.createElement('canvas');
      big.width = src.width * k; big.height = src.height * k;
      const g = big.getContext('2d')!;
      g.imageSmoothingEnabled = false;
      g.drawImage(src, 0, 0, big.width, big.height);
      return big.toDataURL('image/png');
    }, scale);
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    fs.writeFileSync(out, Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'));
    if (errors.length) { bad++; console.log(`  FAIL: ${out} (${query}) -> ${errors.join(' | ')}`); }
    else console.log(`  ok:   ${out}${query ? '  (' + query + ')' : ''}`);
  } catch (e) {
    bad++;
    console.log(`  FAIL: ${out} (${query}) -> ${e instanceof Error ? e.message : e}${errors.length ? ' | ' + errors.join(' | ') : ''}`);
  }
  await page.close();
}

await browser.close();
server.close();
process.exit(bad ? 1 : 0);
