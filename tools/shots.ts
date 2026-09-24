// The standard screenshot set for the dragon art, rendered into shots/ through tools/shot.ts (one browser run).
//
//   node tools/shots.ts [--scale N]      (npm run shots; default scale 3)
//
// The set (docs/ART_BIBLE.md 5.5 "to build with the rig"): the lineup at t = 0 and t = 45, the silhouette sheet,
// the stage sheet of every element, the greyscale and deuteranopia lineups, the habitat, and strips of every anim
// in the table for the adult and the baby of two elements. Every shot is frozen-time, so the set is deterministic.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ANIM_NAMES } from '../src/art/dragon/anims.ts';
import { ELEMENT_IDS } from '../src/art/dragon/elements/index.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const si = args.indexOf('--scale');
const scale = si >= 0 ? args[si + 1] : '3';

const pairs: string[] = [
  'shots/lineup_t0.png=view=lineup&t=0',
  'shots/lineup_t45.png=view=lineup&t=45',
  'shots/silhouette.png=view=silhouette&t=0',
  'shots/grey.png=view=grey&t=0',
  'shots/cvd.png=view=cvd&t=0',
  'shots/habitat.png=view=habitat&t=45',
  ...ELEMENT_IDS.map((el) => `shots/stages_${el}.png=view=stages&el=${el}&t=0`),
  // review extras: the mood gauge (D7) and the pixel-zoom cast per stage
  ...['baby', 'young', 'adult'].map((st) => `shots/mood_${st}.png=view=mood&stage=${st}&t=0&scale=1`),
  ...['baby', 'young', 'adult'].map((st) => `shots/cast_${st}.png=view=cast&stage=${st}&t=0&scale=1`),
];
for (const el of ['fire', 'shriekscale']) {
  for (const stage of ['adult', 'baby']) {
    for (const anim of ANIM_NAMES) pairs.push(`shots/strip_${el}_${stage}_${anim}.png=view=strip&el=${el}&stage=${stage}&anim=${anim}&n=8&t=0`);
  }
}

const r = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'shot.ts'), ...pairs, '--scale', scale], { cwd: ROOT, stdio: 'inherit' });
process.exit(r.status ?? 1);
