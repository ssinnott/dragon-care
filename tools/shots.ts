// The standard screenshot set for the dragon art, rendered into shots/ through tools/shot.ts (one browser run).
//
//   node tools/shots.ts [--scale N]      (npm run shots; default scale 3)
//
// The set (docs/ART_BIBLE.md 5.5 "to build with the rig"): the lineup at t = 0 and t = 45 (seven elements x four
// stages), the silhouette sheets (idle, and idle / lowest mood / asleep stacked),
// the stage sheet of every element (four stages), the greyscale and deuteranopia lineups, the habitat (idle, and
// every act at once; two elders in its cast), and strips of every anim in the table (4.2) for all four stages of three
// elements -- fire (the reference), rock (the dome tuck, the slow cycle, the roll-over happy) and slinkwing (the head
// cue) -- plus the baby's walk stumble, the idle variants (the elder's back stretch, reminisce and airing among them),
// every element's fidget and its own anims (bath, upset, call), the elders' worn wings (view=wings: full spread, the
// airing, the preen), the floor audit and the face sheets. A walk strip is the 8 keys of one cycle over scrolling
// ground ticks (a planted paw must hold still against them). Every shot is frozen-time, so the set is deterministic.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ANIM_NAMES, idleVariants } from '../src/art/dragon/anims.ts';
import { STAGES } from '../src/art/dragon/stages.ts';
import { ELEMENTS, ELEMENT_IDS } from '../src/art/dragon/elements/index.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const si = args.indexOf('--scale');
const scale = si >= 0 ? args[si + 1] : '3';

const pairs: string[] = [
  'shots/lineup_t0.png=view=lineup&t=0',
  'shots/lineup_t45.png=view=lineup&t=45',
  'shots/silhouette.png=view=silhouette&t=0',
  'shots/silhouette_all.png=view=silhouette&set=all&t=0',
  'shots/grey.png=view=grey&t=0',
  'shots/cvd.png=view=cvd&t=0',
  'shots/habitat.png=view=habitat&t=45',
  'shots/habitat_mix.png=view=habitat&anim=mix&t=60',
  'shots/lineup_walk.png=view=lineup&anim=walk&t=10',
  'shots/lineup_sleep.png=view=lineup&anim=sleep&t=10',
  ...ELEMENT_IDS.map((el) => `shots/stages_${el}.png=view=stages&el=${el}&t=0`),
  // review extras: the mood gauge (D7) and the pixel-zoom cast per stage
  ...STAGES.map((st) => `shots/mood_${st}.png=view=mood&stage=${st}&t=0&scale=1`),
  ...STAGES.map((st) => `shots/cast_${st}.png=view=cast&stage=${st}&t=0&scale=1`),
  // the elders' wing wear (2.9): the hole at full spread and at home (the airing), the tears in the preen
  'shots/wings_elder.png=view=wings&t=0',
];
for (const el of ['fire', 'rock', 'slinkwing']) {
  for (const stage of ['elder', 'adult', 'young', 'baby']) {
    for (const anim of ANIM_NAMES) {
      if (anim === 'rest') continue;
      pairs.push(`shots/strip_${el}_${stage}_${anim}.png=view=strip&el=${el}&stage=${stage}&anim=${anim}&n=8&t=0${stage === 'baby' ? '&scale=3' : ''}`);
    }
  }
}
// the baby walk's stumble (one cycle in 6: the loop's last 24 f)
pairs.push('shots/strip_fire_baby_walk_stumble.png=view=strip&el=fire&stage=baby&anim=walk&n=8&from=120&span=24&t=0&scale=3');
// the idle variants (4.2: the player cuts to one every 6-10 s) for the stages that have them, and every element's
// fidget (fire's flame chase, spike's grooming, rock's sunbathe, ...: 4.3)
for (const stage of ['elder', 'adult', 'baby'] as const) {
  for (const anim of new Set(idleVariants(stage))) {
    if (anim !== 'fidget') pairs.push(`shots/variant_fire_${stage}_${anim}.png=view=strip&el=fire&stage=${stage}&anim=${anim}&n=8&t=0${stage === 'baby' ? '&scale=3' : ''}`);
  }
}
for (const el of ELEMENT_IDS) {
  if (ELEMENTS[el].anims?.fidget) {
    pairs.push(`shots/fidget_${el}_adult.png=view=strip&el=${el}&stage=adult&anim=fidget&n=8&t=0`);
    // (the elder's at x 1.3 and 0.8x: 4.2)
    pairs.push(`shots/fidget_${el}_elder.png=view=strip&el=${el}&stage=elder&anim=fidget&n=8&t=0`);
  }
  // every elder's airing (4.2): the one spread at idle, the hole seen at home (rock, with no hole to air, reminisces)
  if (idleVariants('elder', ELEMENTS[el].stages.elder.wing).includes('airing')) pairs.push(`shots/airing_${el}_elder.png=view=strip&el=${el}&stage=elder&anim=airing&n=8&t=0`);
}
// the element anims past the shared table (fire's bath, rock's upset tuck, slinkwing's lonely call), young and adult
for (const [el, anim] of [['fire', 'bath'], ['rock', 'upset'], ['slinkwing', 'call']] as const) {
  for (const stage of ['adult', 'young']) pairs.push(`shots/element_${el}_${stage}_${anim}.png=view=strip&el=${el}&stage=${stage}&anim=${anim}&n=8&t=0`);
}
// the floor audit (5.1 #14: every look, every anim; failing runs show their worst frame), the leg-root audit (1.2)
// and the face sheets
pairs.push('shots/floor.png=view=floor&t=0', 'shots/roots.png=view=roots&t=0');
for (const st of STAGES) pairs.push(`shots/faces_${st}.png=view=faces&stage=${st}&t=0`);
// the breath stream of every element (adult sustain) and the six baby fizzles
for (const el of ELEMENT_IDS) {
  pairs.push(`shots/breath_${el}_adult.png=view=strip&el=${el}&stage=adult&anim=breath&n=6&from=20&span=36&t=0`);
  pairs.push(`shots/breath_${el}_elder.png=view=strip&el=${el}&stage=elder&anim=breath&n=6&from=24&span=48&t=0`);
  pairs.push(`shots/breath_${el}_baby.png=view=strip&el=${el}&stage=baby&anim=breath&n=6&t=0&scale=3`);
}

const r = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'shot.ts'), ...pairs, '--scale', scale], { cwd: ROOT, stdio: 'inherit' });
process.exit(r.status ?? 1);
